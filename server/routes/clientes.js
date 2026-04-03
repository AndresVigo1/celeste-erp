'use strict';

const express = require('express');
const { db } = require('../db');

const router = express.Router();

/**
 * GET /api/clientes
 * Query: ?q=busqueda
 */
router.get('/', (req, res) => {
  try {
    const { q } = req.query;
    let clientes;

    if (q && q.trim()) {
      const term = `%${q.trim()}%`;
      clientes = db.prepare(`
        SELECT c.*,
          (SELECT COUNT(*) FROM ventas v WHERE v.cliente_id = c.id AND v.estado != 'cancelada') AS total_compras,
          (SELECT COALESCE(SUM(v.total), 0) FROM ventas v WHERE v.cliente_id = c.id AND v.estado != 'cancelada') AS monto_total
        FROM clientes c
        WHERE c.activo = 1 AND (c.nombre LIKE ? OR c.telefono LIKE ? OR c.instagram LIKE ?)
        ORDER BY c.nombre ASC
      `).all(term, term, term);
    } else {
      clientes = db.prepare(`
        SELECT c.*,
          (SELECT COUNT(*) FROM ventas v WHERE v.cliente_id = c.id AND v.estado != 'cancelada') AS total_compras,
          (SELECT COALESCE(SUM(v.total), 0) FROM ventas v WHERE v.cliente_id = c.id AND v.estado != 'cancelada') AS monto_total
        FROM clientes c
        WHERE c.activo = 1
        ORDER BY c.nombre ASC
      `).all();
    }

    res.json(clientes);
  } catch (err) {
    console.error('GET clientes error:', err);
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

/**
 * POST /api/clientes
 */
router.post('/', (req, res) => {
  const { nombre, telefono, instagram, canal_preferido = 'whatsapp', notas } = req.body;

  if (!nombre || nombre.trim() === '') return res.status(400).json({ error: 'Nombre requerido' });

  const validCanales = ['whatsapp', 'instagram', 'referido', 'feria', 'otro'];
  if (!validCanales.includes(canal_preferido)) return res.status(400).json({ error: 'Canal preferido inválido' });

  try {
    const result = db.prepare(`
      INSERT INTO clientes (nombre, telefono, instagram, canal_preferido, notas)
      VALUES (?, ?, ?, ?, ?)
    `).run(nombre.trim(), telefono || null, instagram || null, canal_preferido, notas || null);

    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(cliente);
  } catch (err) {
    console.error('POST clientes error:', err);
    res.status(500).json({ error: 'Error al crear cliente' });
  }
});

/**
 * GET /api/clientes/:id
 * Returns client with purchase and order history.
 */
router.get('/:id', (req, res) => {
  try {
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

    const ventas = db.prepare(`
      SELECT id, fecha, canal, tipo, total, estado, metodo_pago,
             (SELECT COUNT(*) FROM venta_items vi WHERE vi.venta_id = ventas.id) AS num_items
      FROM ventas
      WHERE cliente_id = ? AND estado != 'cancelada'
      ORDER BY id DESC
      LIMIT 20
    `).all(cliente.id);

    const pedidos = db.prepare(`
      SELECT id, fecha_encargo, fecha_entrega, descripcion, monto_total, adelanto, saldo, estado
      FROM pedidos
      WHERE cliente_id = ?
      ORDER BY id DESC
      LIMIT 10
    `).all(cliente.id);

    const stats = db.prepare(`
      SELECT
        COUNT(*) AS total_compras,
        COALESCE(SUM(total), 0) AS monto_total,
        MAX(fecha) AS ultima_compra
      FROM ventas
      WHERE cliente_id = ? AND estado != 'cancelada'
    `).get(cliente.id);

    res.json({ ...cliente, ventas, pedidos, stats });
  } catch (err) {
    console.error('GET cliente/:id error:', err);
    res.status(500).json({ error: 'Error al obtener cliente' });
  }
});

/**
 * PATCH /api/clientes/:id
 */
router.patch('/:id', (req, res) => {
  try {
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

    const {
      nombre         = cliente.nombre,
      telefono       = cliente.telefono,
      instagram      = cliente.instagram,
      canal_preferido= cliente.canal_preferido,
      notas          = cliente.notas,
      activo         = cliente.activo
    } = req.body;

    const validCanales = ['whatsapp', 'instagram', 'referido', 'feria', 'otro'];
    if (!validCanales.includes(canal_preferido)) return res.status(400).json({ error: 'Canal preferido inválido' });

    db.prepare(`
      UPDATE clientes SET nombre=?, telefono=?, instagram=?, canal_preferido=?, notas=?, activo=?
      WHERE id=?
    `).run(nombre, telefono || null, instagram || null, canal_preferido, notas || null, activo ? 1 : 0, cliente.id);

    const updated = db.prepare('SELECT * FROM clientes WHERE id = ?').get(cliente.id);
    res.json(updated);
  } catch (err) {
    console.error('PATCH clientes error:', err);
    res.status(500).json({ error: 'Error al actualizar cliente' });
  }
});

module.exports = router;
