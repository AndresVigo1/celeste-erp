'use strict';

const express = require('express');
const { db } = require('../db');

const router = express.Router();

/**
 * GET /api/productos
 * Returns all active products.
 */
router.get('/', (req, res) => {
  try {
    const productos = db.prepare(`
      SELECT * FROM productos WHERE activo = 1 ORDER BY nombre ASC
    `).all();
    res.json(productos);
  } catch (err) {
    console.error('GET productos error:', err);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

/**
 * POST /api/productos
 */
router.post('/', (req, res) => {
  const { nombre, descripcion, categoria, precio_venta, costo_material, stock_actual = 0, stock_minimo = 5, unidad = 'unidad' } = req.body;

  if (!nombre || nombre.trim() === '') return res.status(400).json({ error: 'Nombre requerido' });

  const precio = parseFloat(precio_venta);
  const costo  = parseFloat(costo_material);
  if (isNaN(precio) || precio < 0) return res.status(400).json({ error: 'Precio de venta inválido' });
  if (isNaN(costo)  || costo  < 0) return res.status(400).json({ error: 'Costo de material inválido' });

  try {
    const result = db.prepare(`
      INSERT INTO productos (nombre, descripcion, categoria, precio_venta, costo_material, stock_actual, stock_minimo, unidad)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      nombre.trim(), descripcion || null, categoria || null,
      precio, costo, parseInt(stock_actual, 10) || 0, parseInt(stock_minimo, 10) || 5,
      unidad || 'unidad'
    );

    const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(producto);
  } catch (err) {
    console.error('POST productos error:', err);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

/**
 * GET /api/productos/:id
 */
router.get('/:id', (req, res) => {
  try {
    const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener producto' });
  }
});

/**
 * PATCH /api/productos/:id
 * Can update any field including stock adjustment.
 * Accepts stock_ajuste (positive or negative delta) or stock_actual (absolute value).
 */
router.patch('/:id', (req, res) => {
  try {
    const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

    const {
      nombre        = producto.nombre,
      descripcion   = producto.descripcion,
      categoria     = producto.categoria,
      precio_venta  = producto.precio_venta,
      costo_material= producto.costo_material,
      stock_minimo  = producto.stock_minimo,
      unidad        = producto.unidad,
      stock_ajuste,
      stock_actual
    } = req.body;

    let nuevoStock = producto.stock_actual;
    if (stock_ajuste !== undefined) {
      nuevoStock = Math.max(0, producto.stock_actual + parseInt(stock_ajuste, 10));
    } else if (stock_actual !== undefined) {
      nuevoStock = Math.max(0, parseInt(stock_actual, 10));
    }

    const precio = parseFloat(precio_venta);
    const costo  = parseFloat(costo_material);
    if (isNaN(precio) || precio < 0) return res.status(400).json({ error: 'Precio inválido' });
    if (isNaN(costo)  || costo  < 0) return res.status(400).json({ error: 'Costo inválido' });

    db.prepare(`
      UPDATE productos
      SET nombre=?, descripcion=?, categoria=?, precio_venta=?, costo_material=?,
          stock_actual=?, stock_minimo=?, unidad=?
      WHERE id=?
    `).run(
      nombre, descripcion || null, categoria || null,
      precio, costo, nuevoStock, parseInt(stock_minimo, 10) || 5,
      unidad, producto.id
    );

    const updated = db.prepare('SELECT * FROM productos WHERE id = ?').get(producto.id);
    res.json(updated);
  } catch (err) {
    console.error('PATCH productos error:', err);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

/**
 * DELETE /api/productos/:id
 * Marks product as inactive (soft delete).
 */
router.delete('/:id', (req, res) => {
  try {
    const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    db.prepare('UPDATE productos SET activo = 0 WHERE id = ?').run(producto.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

module.exports = router;
