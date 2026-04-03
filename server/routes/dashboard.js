'use strict';

const express = require('express');
const { db } = require('../db');

const router = express.Router();

/**
 * GET /api/dashboard
 * Returns summary data for the dashboard.
 */
router.get('/', (req, res) => {
  try {
    // Current month boundaries
    const now = new Date();
    const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const mesAnteriorDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const mesAnterior = `${mesAnteriorDate.getFullYear()}-${String(mesAnteriorDate.getMonth() + 1).padStart(2, '0')}`;

    // ── Ingresos y costo mes actual ───────────────────────────────────────
    const ventasMes = db.prepare(`
      SELECT
        COALESCE(SUM(total), 0)      AS ingresos,
        COALESCE(SUM(costo_total), 0) AS costos
      FROM ventas
      WHERE strftime('%Y-%m', fecha) = ? AND estado != 'cancelada'
    `).get(mesActual);

    // ── Gastos mes actual ─────────────────────────────────────────────────
    const gastosMes = db.prepare(`
      SELECT COALESCE(SUM(monto), 0) AS total
      FROM gastos
      WHERE strftime('%Y-%m', fecha) = ?
    `).get(mesActual);

    const ingresosActual = ventasMes.ingresos;
    const costosActual   = ventasMes.costos + gastosMes.total;
    const utilidadActual = ingresosActual - costosActual;
    const margenActual   = ingresosActual > 0
      ? parseFloat(((utilidadActual / ingresosActual) * 100).toFixed(1))
      : 0;

    // ── Mes anterior ──────────────────────────────────────────────────────
    const ventasMesAnt = db.prepare(`
      SELECT
        COALESCE(SUM(total), 0)      AS ingresos,
        COALESCE(SUM(costo_total), 0) AS costos
      FROM ventas
      WHERE strftime('%Y-%m', fecha) = ? AND estado != 'cancelada'
    `).get(mesAnterior);

    const gastosMesAnt = db.prepare(`
      SELECT COALESCE(SUM(monto), 0) AS total
      FROM gastos
      WHERE strftime('%Y-%m', fecha) = ?
    `).get(mesAnterior);

    const ingresosAnterior  = ventasMesAnt.ingresos;
    const costosAnterior    = ventasMesAnt.costos + gastosMesAnt.total;
    const utilidadAnterior  = ingresosAnterior - costosAnterior;

    // ── Ventas por canal (mes actual) ─────────────────────────────────────
    const ventasPorCanal = db.prepare(`
      SELECT canal, COUNT(*) as cantidad, COALESCE(SUM(total), 0) as monto
      FROM ventas
      WHERE strftime('%Y-%m', fecha) = ? AND estado != 'cancelada'
      GROUP BY canal
      ORDER BY monto DESC
    `).all(mesActual);

    // ── Pedidos pendientes ────────────────────────────────────────────────
    const pedidosPendientes = db.prepare(`
      SELECT id, cliente_nombre, descripcion, fecha_entrega, monto_total, adelanto, saldo, estado
      FROM pedidos
      WHERE estado IN ('pendiente','en_proceso','listo')
      ORDER BY fecha_entrega ASC
      LIMIT 10
    `).all();

    // ── Stock bajo ────────────────────────────────────────────────────────
    const stockBajo = db.prepare(`
      SELECT id, nombre, stock_actual, stock_minimo, categoria
      FROM productos
      WHERE activo = 1 AND stock_actual <= stock_minimo
      ORDER BY (stock_actual - stock_minimo) ASC
      LIMIT 10
    `).all();

    // ── Últimas ventas ────────────────────────────────────────────────────
    const ultimasVentas = db.prepare(`
      SELECT id, fecha, cliente_nombre, canal, total, estado, metodo_pago
      FROM ventas
      ORDER BY id DESC
      LIMIT 5
    `).all();

    res.json({
      mes_actual: {
        ingresos: parseFloat(ingresosActual.toFixed(2)),
        gastos:   parseFloat(costosActual.toFixed(2)),
        utilidad: parseFloat(utilidadActual.toFixed(2)),
        margen_pct: margenActual
      },
      mes_anterior: {
        ingresos: parseFloat(ingresosAnterior.toFixed(2)),
        gastos:   parseFloat(costosAnterior.toFixed(2)),
        utilidad: parseFloat(utilidadAnterior.toFixed(2))
      },
      ventas_por_canal: ventasPorCanal,
      pedidos_pendientes: pedidosPendientes,
      stock_bajo: stockBajo,
      ultimas_ventas: ultimasVentas
    });

  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Error al cargar el dashboard' });
  }
});

module.exports = router;
