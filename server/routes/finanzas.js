'use strict';

const express = require('express');
const { db }  = require('../db');

const router = express.Router();

/**
 * GET /api/finanzas?mes=YYYY-MM
 * Returns consolidated P&L for the month:
 *   ingresos: ventas + cursos
 *   gastos:   gastos_generales + costo_ventas + gastos_cursos
 */
router.get('/', (req, res) => {
  try {
    const mes = req.query.mes || (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    })();

    // ── INGRESOS ──────────────────────────────────────────────────────────────

    // Ventas del mes (no canceladas)
    const ventasRows = db.prepare(`
      SELECT id, fecha, cliente_nombre, canal, total, costo_total, estado
      FROM ventas
      WHERE strftime('%Y-%m', fecha) = ? AND estado != 'cancelada'
      ORDER BY fecha DESC
    `).all(mes);

    const totalVentas = ventasRows.reduce((s, v) => s + v.total, 0);

    // Ingresos por cursos del mes (pagos recibidos de inscritas)
    const cursosIngresosRows = db.prepare(`
      SELECT
        c.id, c.nombre AS curso_nombre, c.fecha_inicio,
        ci.id AS inscripcion_id,
        COALESCE(ci.nombre_libre, cl.nombre) AS inscrita,
        ci.monto_pagado, ci.monto_total, ci.estado_pago
      FROM curso_inscripciones ci
      JOIN cursos c ON c.id = ci.curso_id
      LEFT JOIN clientes cl ON cl.id = ci.cliente_id
      WHERE strftime('%Y-%m', c.fecha_inicio) = ? AND c.estado != 'cancelado'
      ORDER BY c.fecha_inicio DESC
    `).all(mes);

    const totalCursos = cursosIngresosRows.reduce((s, r) => s + r.monto_pagado, 0);

    // Agrupado por curso para resumen
    const cursosResumen = Object.values(
      cursosIngresosRows.reduce((acc, r) => {
        if (!acc[r.id]) acc[r.id] = { id: r.id, nombre: r.curso_nombre, fecha: r.fecha_inicio, cobrado: 0, inscritas: 0 };
        acc[r.id].cobrado   += r.monto_pagado;
        acc[r.id].inscritas += 1;
        return acc;
      }, {})
    );

    // ── GASTOS ────────────────────────────────────────────────────────────────

    // Gastos generales del mes
    const gastosGeneralesRows = db.prepare(`
      SELECT id, fecha, categoria, descripcion, proveedor, monto, metodo_pago
      FROM gastos
      WHERE strftime('%Y-%m', fecha) = ?
      ORDER BY fecha DESC
    `).all(mes);

    const totalGastosGenerales = gastosGeneralesRows.reduce((s, g) => s + g.monto, 0);

    // Costo de ventas del mes
    const costoVentasRows = db.prepare(`
      SELECT id, fecha, cliente_nombre, canal, costo_total
      FROM ventas
      WHERE strftime('%Y-%m', fecha) = ? AND estado != 'cancelada' AND costo_total > 0
      ORDER BY fecha DESC
    `).all(mes);

    const totalCostoVentas = costoVentasRows.reduce((s, v) => s + v.costo_total, 0);

    // Gastos de cursos del mes
    const gastosCursosRows = db.prepare(`
      SELECT cg.id, cg.fecha, cg.descripcion, cg.monto, c.nombre AS curso_nombre
      FROM curso_gastos cg
      JOIN cursos c ON c.id = cg.curso_id
      WHERE strftime('%Y-%m', c.fecha_inicio) = ?
      ORDER BY cg.fecha DESC
    `).all(mes);

    const totalGastosCursos = gastosCursosRows.reduce((s, g) => s + g.monto, 0);

    // ── TOTALES ───────────────────────────────────────────────────────────────
    const totalIngresos = totalVentas + totalCursos;
    const totalGastos   = totalGastosGenerales + totalCostoVentas + totalGastosCursos;
    const utilidad      = totalIngresos - totalGastos;
    const margen        = totalIngresos > 0
      ? parseFloat(((utilidad / totalIngresos) * 100).toFixed(1))
      : 0;

    res.json({
      mes,
      resumen: {
        total_ingresos:   parseFloat(totalIngresos.toFixed(2)),
        total_gastos:     parseFloat(totalGastos.toFixed(2)),
        utilidad:         parseFloat(utilidad.toFixed(2)),
        margen_pct:       margen,
      },
      ingresos: {
        ventas: {
          total: parseFloat(totalVentas.toFixed(2)),
          filas: ventasRows
        },
        cursos: {
          total:   parseFloat(totalCursos.toFixed(2)),
          resumen: cursosResumen,
          filas:   cursosIngresosRows
        }
      },
      gastos: {
        generales: {
          total: parseFloat(totalGastosGenerales.toFixed(2)),
          filas: gastosGeneralesRows
        },
        costo_ventas: {
          total: parseFloat(totalCostoVentas.toFixed(2)),
          filas: costoVentasRows
        },
        cursos: {
          total: parseFloat(totalGastosCursos.toFixed(2)),
          filas: gastosCursosRows
        }
      }
    });

  } catch (err) {
    console.error('GET finanzas error:', err);
    res.status(500).json({ error: 'Error al cargar finanzas' });
  }
});

module.exports = router;
