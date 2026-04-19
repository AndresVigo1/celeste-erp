'use strict';

const express = require('express');
const { db } = require('../db');

const router = express.Router();

const ESTADOS = ['pendiente', 'en_proceso', 'listo', 'entregado', 'cancelado'];

/**
 * GET /api/pedidos
 * Query: ?estado=pendiente
 */
router.get('/', (req, res) => {
  try {
    const { estado } = req.query;
    let pedidos;

    if (estado && ESTADOS.includes(estado)) {
      pedidos = db.prepare(`
        SELECT * FROM pedidos WHERE estado = ?
        ORDER BY fecha_entrega ASC
      `).all(estado);
    } else {
      pedidos = db.prepare(`
        SELECT * FROM pedidos
        ORDER BY CASE
          WHEN estado = 'pendiente'   THEN 1
          WHEN estado = 'en_proceso'  THEN 2
          WHEN estado = 'listo'       THEN 3
          WHEN estado = 'entregado'   THEN 4
          WHEN estado = 'cancelado'   THEN 5
          ELSE 6
        END, fecha_entrega ASC
      `).all();
    }

    res.json(pedidos);
  } catch (err) {
    console.error('GET pedidos error:', err);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
});

/**
 * POST /api/pedidos
 */
router.post('/', (req, res) => {
  const {
    cliente_id, cliente_nombre, fecha_encargo, fecha_entrega,
    descripcion, monto_total, adelanto = 0, notas
  } = req.body;

  if (!descripcion || descripcion.trim() === '') return res.status(400).json({ error: 'Descripción requerida' });
  const montoNum   = parseFloat(monto_total);
  const adelantoNum= parseFloat(adelanto) || 0;
  if (isNaN(montoNum) || montoNum < 0)   return res.status(400).json({ error: 'Monto total inválido' });
  if (adelantoNum < 0 || adelantoNum > montoNum) return res.status(400).json({ error: 'Adelanto inválido' });

  try {
    let clienteNombre = cliente_nombre || 'Cliente';
    if (cliente_id) {
      const cli = db.prepare('SELECT nombre FROM clientes WHERE id = ?').get(cliente_id);
      if (cli) clienteNombre = cli.nombre;
    }

    const fechaEncargo = fecha_encargo || new Date().toISOString().slice(0, 10);

    const result = db.prepare(`
      INSERT INTO pedidos (cliente_id, cliente_nombre, fecha_encargo, fecha_entrega, descripcion, monto_total, adelanto, estado, notas)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente', ?)
    `).run(
      cliente_id || null, clienteNombre, fechaEncargo,
      fecha_entrega || null, descripcion.trim(), montoNum, adelantoNum, notas || null
    );

    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(pedido);
  } catch (err) {
    console.error('POST pedidos error:', err);
    res.status(500).json({ error: 'Error al crear pedido' });
  }
});

/**
 * GET /api/pedidos/:id
 */
router.get('/:id', (req, res) => {
  try {
    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(pedido);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener pedido' });
  }
});

/**
 * PATCH /api/pedidos/:id
 */
router.patch('/:id', (req, res) => {
  try {
    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

    const {
      estado         = pedido.estado,
      fecha_entrega  = pedido.fecha_entrega,
      descripcion    = pedido.descripcion,
      monto_total    = pedido.monto_total,
      adelanto       = pedido.adelanto,
      notas          = pedido.notas,
      venta_id       = pedido.venta_id
    } = req.body;

    if (!ESTADOS.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });

    const montoNum    = parseFloat(monto_total);
    const adelantoNum = parseFloat(adelanto) || 0;
    if (isNaN(montoNum) || montoNum < 0) return res.status(400).json({ error: 'Monto total inválido' });

    db.prepare(`
      UPDATE pedidos
      SET estado=?, fecha_entrega=?, descripcion=?, monto_total=?, adelanto=?, notas=?, venta_id=?
      WHERE id=?
    `).run(estado, fecha_entrega || null, descripcion, montoNum, adelantoNum, notas || null, venta_id || null, pedido.id);

    const updated = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedido.id);
    res.json(updated);
  } catch (err) {
    console.error('PATCH pedidos error:', err);
    res.status(500).json({ error: 'Error al actualizar pedido' });
  }
});

/**
 * POST /api/pedidos/:id/convertir
 * Converts an order into a completed sale.
 * Body: { metodo_pago, canal, notas }
 */
router.post('/:id/convertir', (req, res) => {
  try {
    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (pedido.estado === 'entregado' || pedido.estado === 'cancelado') {
      return res.status(400).json({ error: 'Este pedido ya está ' + pedido.estado });
    }
    if (pedido.venta_id) {
      return res.status(400).json({ error: 'Este pedido ya tiene una venta asociada' });
    }

    const { metodo_pago = 'efectivo', canal = 'whatsapp', notas } = req.body;
    const validMetodos = ['efectivo', 'transferencia', 'mixto'];
    const validCanales = ['whatsapp', 'instagram', 'feria', 'local', 'otro'];
    if (!validMetodos.includes(metodo_pago)) return res.status(400).json({ error: 'Método de pago inválido' });
    if (!validCanales.includes(canal)) return res.status(400).json({ error: 'Canal inválido' });

    const convertir = db.transaction(() => {
      const fecha = new Date().toISOString().slice(0, 10);
      // Create sale from order data
      const ventaResult = db.prepare(`
        INSERT INTO ventas (fecha, cliente_id, cliente_nombre, canal, tipo, subtotal, descuento, total, costo_total, estado, metodo_pago, notas)
        VALUES (?, ?, ?, ?, 'encargo', ?, 0, ?, 0, 'pagada', ?, ?)
      `).run(
        fecha, pedido.cliente_id || null, pedido.cliente_nombre,
        canal, pedido.monto_total, pedido.monto_total,
        metodo_pago, notas || `Pedido #${pedido.id}: ${pedido.descripcion}`
      );

      const ventaId = ventaResult.lastInsertRowid;

      // Add single item representing the order
      db.prepare(`
        INSERT INTO venta_items (venta_id, producto_id, descripcion, cantidad, precio_unitario, costo_unitario)
        VALUES (?, NULL, ?, 1, ?, 0)
      `).run(ventaId, pedido.descripcion, pedido.monto_total);

      // Update pedido
      db.prepare(`
        UPDATE pedidos SET estado = 'entregado', venta_id = ? WHERE id = ?
      `).run(ventaId, pedido.id);

      return ventaId;
    });

    const ventaId = convertir();
    const venta   = db.prepare('SELECT * FROM ventas WHERE id = ?').get(ventaId);
    const pedidoUpdated = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedido.id);

    res.json({ venta, pedido: pedidoUpdated });
  } catch (err) {
    console.error('POST pedidos/convertir error:', err);
    res.status(500).json({ error: 'Error al convertir pedido' });
  }
});

/**
 * DELETE /api/pedidos/:id
 * Hard-deletes a pedido (use only to correct data entry mistakes).
 */
router.delete('/:id', (req, res) => {
  try {
    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    db.prepare('DELETE FROM pedidos WHERE id = ?').run(pedido.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE pedidos error:', err);
    res.status(500).json({ error: 'Error al eliminar pedido' });
  }
});

module.exports = router;
