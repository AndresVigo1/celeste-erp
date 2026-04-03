'use strict';

const express = require('express');
const { db } = require('../db');

const router = express.Router();

const CATEGORIAS = ['materiales', 'empaque', 'publicidad', 'herramientas', 'servicios', 'transporte', 'otros'];

/**
 * GET /api/gastos
 * Query: ?mes=YYYY-MM&categoria=materiales
 */
router.get('/', (req, res) => {
  try {
    const { mes, categoria } = req.query;
    const conditions = [];
    const params = [];

    if (mes) {
      conditions.push("strftime('%Y-%m', fecha) = ?");
      params.push(mes);
    }
    if (categoria) {
      conditions.push('categoria = ?');
      params.push(categoria);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const gastos = db.prepare(`SELECT * FROM gastos ${where} ORDER BY id DESC`).all(...params);

    // Also return totals
    const totales = db.prepare(`
      SELECT categoria, COALESCE(SUM(monto), 0) AS total
      FROM gastos ${where}
      GROUP BY categoria
      ORDER BY total DESC
    `).all(...params);

    res.json({ gastos, totales });
  } catch (err) {
    console.error('GET gastos error:', err);
    res.status(500).json({ error: 'Error al obtener gastos' });
  }
});

/**
 * POST /api/gastos
 */
router.post('/', (req, res) => {
  const { fecha, categoria, descripcion, proveedor, monto, metodo_pago = 'efectivo', notas } = req.body;

  if (!categoria || !CATEGORIAS.includes(categoria)) {
    return res.status(400).json({ error: 'Categoría inválida' });
  }
  if (!descripcion || descripcion.trim() === '') {
    return res.status(400).json({ error: 'Descripción requerida' });
  }
  const montoNum = parseFloat(monto);
  if (isNaN(montoNum) || montoNum <= 0) {
    return res.status(400).json({ error: 'Monto inválido' });
  }
  if (!['efectivo', 'transferencia'].includes(metodo_pago)) {
    return res.status(400).json({ error: 'Método de pago inválido' });
  }

  try {
    const fechaGasto = fecha || new Date().toISOString().slice(0, 10);
    const result = db.prepare(`
      INSERT INTO gastos (fecha, categoria, descripcion, proveedor, monto, metodo_pago, notas)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(fechaGasto, categoria, descripcion.trim(), proveedor || null, montoNum, metodo_pago, notas || null);

    const gasto = db.prepare('SELECT * FROM gastos WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(gasto);
  } catch (err) {
    console.error('POST gastos error:', err);
    res.status(500).json({ error: 'Error al crear gasto' });
  }
});

/**
 * GET /api/gastos/:id
 */
router.get('/:id', (req, res) => {
  try {
    const gasto = db.prepare('SELECT * FROM gastos WHERE id = ?').get(req.params.id);
    if (!gasto) return res.status(404).json({ error: 'Gasto no encontrado' });
    res.json(gasto);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener gasto' });
  }
});

/**
 * PATCH /api/gastos/:id
 */
router.patch('/:id', (req, res) => {
  try {
    const gasto = db.prepare('SELECT * FROM gastos WHERE id = ?').get(req.params.id);
    if (!gasto) return res.status(404).json({ error: 'Gasto no encontrado' });

    const {
      fecha       = gasto.fecha,
      categoria   = gasto.categoria,
      descripcion = gasto.descripcion,
      proveedor   = gasto.proveedor,
      monto       = gasto.monto,
      metodo_pago = gasto.metodo_pago,
      notas       = gasto.notas
    } = req.body;

    if (!CATEGORIAS.includes(categoria)) return res.status(400).json({ error: 'Categoría inválida' });
    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) return res.status(400).json({ error: 'Monto inválido' });

    db.prepare(`
      UPDATE gastos SET fecha=?, categoria=?, descripcion=?, proveedor=?, monto=?, metodo_pago=?, notas=?
      WHERE id=?
    `).run(fecha, categoria, descripcion, proveedor || null, montoNum, metodo_pago, notas || null, gasto.id);

    const updated = db.prepare('SELECT * FROM gastos WHERE id = ?').get(gasto.id);
    res.json(updated);
  } catch (err) {
    console.error('PATCH gastos error:', err);
    res.status(500).json({ error: 'Error al actualizar gasto' });
  }
});

/**
 * DELETE /api/gastos/:id
 */
router.delete('/:id', (req, res) => {
  try {
    const gasto = db.prepare('SELECT * FROM gastos WHERE id = ?').get(req.params.id);
    if (!gasto) return res.status(404).json({ error: 'Gasto no encontrado' });
    db.prepare('DELETE FROM gastos WHERE id = ?').run(gasto.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar gasto' });
  }
});

module.exports = router;
