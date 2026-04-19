'use strict';

const express = require('express');
const { db } = require('../db');

const router = express.Router();

/**
 * GET /api/dashboard
 * Query params:
 *   desde=YYYY-MM  — start month (inclusive)
 *   hasta=YYYY-MM  — end month   (inclusive)
 *   todo=1         — all time (overrides desde/hasta)
 *
 * Defaults to current month when nothing is provided.
 */
router.get('/', (req, res) => {
  try {
    const now   = new Date();
    const thisM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const todo  = req.query.todo === '1';
    const desde = req.query.desde || thisM;
    const hasta = req.query.hasta || thisM;

    // ── Build date-range WHERE helpers ───────────────────────────────────────
    // Returns SQL fragment for a date column filtered by the selected period
    function rangeWhere(col) {
      if (todo) return '1=1';
      return `strftime('%Y-%m', ${col}) BETWEEN '${desde}' AND '${hasta}'`;
    }

    // For comparison: shift the period back by the same number of months
    function prevRange(col) {
      if (todo) return '1=0'; // no comparison for "all time"
      const d0 = new Date(desde + '-01');
      const d1 = new Date(hasta + '-01');
      // Duration in months
      const months = (d1.getFullYear() - d0.getFullYear()) * 12 + (d1.getMonth() - d0.getMonth()) + 1;
      const prevEnd   = new Date(d0.getFullYear(), d0.getMonth() - 1, 1);
      const prevStart = new Date(d0.getFullYear(), d0.getMonth() - months, 1);
      const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return `strftime('%Y-%m', ${col}) BETWEEN '${fmt(prevStart)}' AND '${fmt(prevEnd)}'`;
    }

    // ── CURRENT PERIOD ───────────────────────────────────────────────────────

    const ventasMes = db.prepare(`
      SELECT COALESCE(SUM(total),0) AS ingresos, COALESCE(SUM(costo_total),0) AS costos
      FROM ventas WHERE ${rangeWhere('fecha')} AND estado != 'cancelada'
    `).get();

    const gastosMes = db.prepare(`
      SELECT COALESCE(SUM(monto),0) AS total
      FROM gastos WHERE ${rangeWhere('fecha')}
    `).get();

    const cursosMes = db.prepare(`
      SELECT COALESCE(SUM(ci.monto_pagado),0) AS ingresos
      FROM curso_inscripciones ci
      JOIN cursos c ON c.id = ci.curso_id
      WHERE ${rangeWhere('c.fecha_inicio')} AND c.estado != 'cancelado'
    `).get();

    const cursosGastosMes = db.prepare(`
      SELECT COALESCE(SUM(cg.monto),0) AS total
      FROM curso_gastos cg
      JOIN cursos c ON c.id = cg.curso_id
      WHERE ${rangeWhere('c.fecha_inicio')}
    `).get();

    const ingresosActual = ventasMes.ingresos + cursosMes.ingresos;
    const costosActual   = ventasMes.costos + gastosMes.total + cursosGastosMes.total;
    const utilidadActual = ingresosActual - costosActual;
    const margenActual   = ingresosActual > 0
      ? parseFloat(((utilidadActual / ingresosActual) * 100).toFixed(1)) : 0;

    // ── PREVIOUS PERIOD (for delta arrows) ───────────────────────────────────

    const ventasAnt = db.prepare(`
      SELECT COALESCE(SUM(total),0) AS ingresos, COALESCE(SUM(costo_total),0) AS costos
      FROM ventas WHERE ${prevRange('fecha')} AND estado != 'cancelada'
    `).get();

    const gastosAnt = db.prepare(`
      SELECT COALESCE(SUM(monto),0) AS total
      FROM gastos WHERE ${prevRange('fecha')}
    `).get();

    const cursosAnt = db.prepare(`
      SELECT COALESCE(SUM(ci.monto_pagado),0) AS ingresos
      FROM curso_inscripciones ci
      JOIN cursos c ON c.id = ci.curso_id
      WHERE ${prevRange('c.fecha_inicio')} AND c.estado != 'cancelado'
    `).get();

    const cursosGastosAnt = db.prepare(`
      SELECT COALESCE(SUM(cg.monto),0) AS total
      FROM curso_gastos cg
      JOIN cursos c ON c.id = cg.curso_id
      WHERE ${prevRange('c.fecha_inicio')}
    `).get();

    const ingresosAnterior = ventasAnt.ingresos + cursosAnt.ingresos;
    const costosAnterior   = ventasAnt.costos + gastosAnt.total + cursosGastosAnt.total;
    const utilidadAnterior = ingresosAnterior - costosAnterior;

    // ── Ventas por canal ──────────────────────────────────────────────────────
    const ventasPorCanal = db.prepare(`
      SELECT canal, COUNT(*) as cantidad, COALESCE(SUM(total),0) as monto
      FROM ventas WHERE ${rangeWhere('fecha')} AND estado != 'cancelada'
      GROUP BY canal ORDER BY monto DESC
    `).all();

    // ── Pedidos pendientes (always live, not filtered by period) ──────────────
    const pedidosPendientes = db.prepare(`
      SELECT id, cliente_nombre, descripcion, fecha_entrega, monto_total, adelanto, saldo, estado
      FROM pedidos WHERE estado IN ('pendiente','en_proceso','listo')
      ORDER BY fecha_entrega ASC LIMIT 10
    `).all();

    // ── Stock bajo ────────────────────────────────────────────────────────────
    const stockBajo = db.prepare(`
      SELECT id, nombre, stock_actual, stock_minimo, categoria
      FROM productos WHERE activo = 1 AND stock_actual <= stock_minimo
      ORDER BY (stock_actual - stock_minimo) ASC LIMIT 10
    `).all();

    // ── Últimas ventas (within period) ────────────────────────────────────────
    const ultimasVentas = db.prepare(`
      SELECT id, fecha, cliente_nombre, canal, total, estado, metodo_pago
      FROM ventas WHERE ${rangeWhere('fecha')}
      ORDER BY id DESC LIMIT 10
    `).all();

    // ── Cursos activos ────────────────────────────────────────────────────────
    const cursosActivos = db.prepare(`
      SELECT c.id, c.nombre, c.fecha_inicio, c.fecha_fin, c.precio, c.estado,
        COUNT(ci.id) AS num_inscritas,
        COALESCE(SUM(ci.monto_pagado),0) AS cobrado,
        COALESCE(SUM(ci.monto_total),0)  AS esperado
      FROM cursos c
      LEFT JOIN curso_inscripciones ci ON ci.curso_id = c.id
      WHERE c.estado = 'activo'
      GROUP BY c.id ORDER BY c.fecha_inicio DESC LIMIT 5
    `).all();

    res.json({
      periodo: { desde, hasta, todo },
      mes_actual: {
        ingresos:   parseFloat(ingresosActual.toFixed(2)),
        gastos:     parseFloat(costosActual.toFixed(2)),
        utilidad:   parseFloat(utilidadActual.toFixed(2)),
        margen_pct: margenActual
      },
      mes_anterior: {
        ingresos: parseFloat(ingresosAnterior.toFixed(2)),
        gastos:   parseFloat(costosAnterior.toFixed(2)),
        utilidad: parseFloat(utilidadAnterior.toFixed(2))
      },
      ventas_por_canal:   ventasPorCanal,
      pedidos_pendientes: pedidosPendientes,
      stock_bajo:         stockBajo,
      ultimas_ventas:     ultimasVentas,
      cursos_activos:     cursosActivos
    });

  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Error al cargar el dashboard' });
  }
});

module.exports = router;
