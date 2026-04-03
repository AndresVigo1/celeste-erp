'use strict';

const express = require('express');
const { db } = require('../db');

const router = express.Router();

/**
 * GET /api/ventas
 * Query: ?mes=YYYY-MM&canal=whatsapp&estado=pagada
 */
router.get('/', (req, res) => {
  try {
    const { mes, canal, estado } = req.query;
    const conditions = [];
    const params = [];

    if (mes) {
      conditions.push("strftime('%Y-%m', v.fecha) = ?");
      params.push(mes);
    }
    if (canal) {
      conditions.push('v.canal = ?');
      params.push(canal);
    }
    if (estado) {
      conditions.push('v.estado = ?');
      params.push(estado);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const ventas = db.prepare(`
      SELECT v.id, v.fecha, v.cliente_id, v.cliente_nombre, v.canal, v.tipo,
             v.subtotal, v.descuento, v.total, v.costo_total,
             v.estado, v.metodo_pago, v.notas, v.created_at,
             (SELECT COUNT(*) FROM venta_items vi WHERE vi.venta_id = v.id) AS num_items
      FROM ventas v
      ${where}
      ORDER BY v.id DESC
    `).all(...params);

    res.json(ventas);
  } catch (err) {
    console.error('GET ventas error:', err);
    res.status(500).json({ error: 'Error al obtener ventas' });
  }
});

/**
 * POST /api/ventas
 * Creates a sale with items, deducts stock, recalculates totals server-side.
 * Body: { cliente_id?, cliente_nombre, canal, tipo, descuento, estado, metodo_pago, notas, items: [{producto_id?, descripcion, cantidad, precio_unitario, costo_unitario}] }
 */
router.post('/', (req, res) => {
  const { cliente_id, cliente_nombre, canal, tipo, descuento = 0, estado = 'pagada', metodo_pago = 'efectivo', notas, items, fecha } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Se requiere al menos un producto' });
  }

  const validCanales = ['whatsapp', 'instagram', 'feria', 'local', 'otro'];
  const validTipos   = ['encargo', 'stock'];
  const validEstados = ['pagada', 'pendiente', 'cancelada'];
  const validMetodos = ['efectivo', 'transferencia', 'mixto'];

  if (!validCanales.includes(canal)) return res.status(400).json({ error: 'Canal inválido' });
  if (!validTipos.includes(tipo))   return res.status(400).json({ error: 'Tipo inválido' });
  if (!validEstados.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
  if (!validMetodos.includes(metodo_pago)) return res.status(400).json({ error: 'Método de pago inválido' });

  try {
    const createVenta = db.transaction(() => {
      // Validate and enrich items
      let subtotal   = 0;
      let costoTotal = 0;
      const enrichedItems = [];

      for (const item of items) {
        const cantidad = parseInt(item.cantidad, 10);
        if (!cantidad || cantidad < 1) throw new Error('Cantidad inválida en item');

        let precio   = parseFloat(item.precio_unitario);
        let costo    = parseFloat(item.costo_unitario || 0);
        let desc     = item.descripcion || '';

        if (isNaN(precio) || precio < 0) throw new Error('Precio inválido');

        // If producto_id provided, verify it exists and has stock
        if (item.producto_id) {
          const prod = db.prepare('SELECT * FROM productos WHERE id = ? AND activo = 1').get(item.producto_id);
          if (!prod) throw new Error(`Producto ${item.producto_id} no encontrado`);
          // Use stored costo if client didn't provide a valid one
          if (!item.costo_unitario || isNaN(costo)) costo = prod.costo_material;
          if (!desc) desc = prod.nombre;
          // Check stock (only deduct on non-cancelled sales)
          if (estado !== 'cancelada' && prod.stock_actual < cantidad) {
            throw new Error(`Stock insuficiente para "${prod.nombre}". Disponible: ${prod.stock_actual}`);
          }
        }

        subtotal   += cantidad * precio;
        costoTotal += cantidad * costo;
        enrichedItems.push({ producto_id: item.producto_id || null, descripcion: desc, cantidad, precio_unitario: precio, costo_unitario: costo });
      }

      const descuentoNum = Math.max(0, parseFloat(descuento) || 0);
      const total = Math.max(0, subtotal - descuentoNum);
      const fechaVenta = fecha || new Date().toISOString().slice(0, 10);

      // Determine client name
      let clienteNombre = cliente_nombre || 'Cliente sin nombre';
      if (cliente_id) {
        const cli = db.prepare('SELECT nombre FROM clientes WHERE id = ?').get(cliente_id);
        if (cli) clienteNombre = cli.nombre;
      }

      // Insert venta
      const result = db.prepare(`
        INSERT INTO ventas (fecha, cliente_id, cliente_nombre, canal, tipo, subtotal, descuento, total, costo_total, estado, metodo_pago, notas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        fechaVenta, cliente_id || null, clienteNombre, canal, tipo,
        parseFloat(subtotal.toFixed(2)), descuentoNum, parseFloat(total.toFixed(2)),
        parseFloat(costoTotal.toFixed(2)), estado, metodo_pago, notas || null
      );

      const ventaId = result.lastInsertRowid;

      // Insert items and deduct stock
      const insertItem = db.prepare(`
        INSERT INTO venta_items (venta_id, producto_id, descripcion, cantidad, precio_unitario, costo_unitario)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const updateStock = db.prepare(`
        UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ?
      `);

      for (const item of enrichedItems) {
        insertItem.run(ventaId, item.producto_id, item.descripcion, item.cantidad, item.precio_unitario, item.costo_unitario);
        if (item.producto_id && estado !== 'cancelada') {
          updateStock.run(item.cantidad, item.producto_id);
        }
      }

      return ventaId;
    });

    const ventaId = createVenta();
    const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(ventaId);
    const ventaItems = db.prepare('SELECT * FROM venta_items WHERE venta_id = ?').all(ventaId);

    res.status(201).json({ ...venta, items: ventaItems });
  } catch (err) {
    console.error('POST ventas error:', err);
    res.status(400).json({ error: err.message || 'Error al crear venta' });
  }
});

/**
 * GET /api/ventas/:id
 * Returns venta with its items.
 */
router.get('/:id', (req, res) => {
  try {
    const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.id);
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

    const items = db.prepare('SELECT * FROM venta_items WHERE venta_id = ?').all(venta.id);
    res.json({ ...venta, items });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener venta' });
  }
});

/**
 * PATCH /api/ventas/:id
 * Updates estado or metodo_pago.
 */
router.patch('/:id', (req, res) => {
  try {
    const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.id);
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

    const { estado, metodo_pago, notas } = req.body;
    const validEstados = ['pagada', 'pendiente', 'cancelada'];
    const validMetodos = ['efectivo', 'transferencia', 'mixto'];

    if (estado && !validEstados.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
    if (metodo_pago && !validMetodos.includes(metodo_pago)) return res.status(400).json({ error: 'Método de pago inválido' });

    const patchVenta = db.transaction(() => {
      const nuevoEstado  = estado      ?? venta.estado;
      const nuevoMetodo  = metodo_pago ?? venta.metodo_pago;
      const nuevasNotas  = notas !== undefined ? notas : venta.notas;

      // Handle stock changes when cancelling or uncancelling
      if (estado && estado !== venta.estado) {
        const items = db.prepare('SELECT * FROM venta_items WHERE venta_id = ?').all(venta.id);
        const updateStock = db.prepare('UPDATE productos SET stock_actual = stock_actual + ? WHERE id = ?');
        const deductStock = db.prepare('UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ?');

        if (estado === 'cancelada' && venta.estado !== 'cancelada') {
          // Restore stock
          for (const item of items) {
            if (item.producto_id) updateStock.run(item.cantidad, item.producto_id);
          }
        } else if (estado !== 'cancelada' && venta.estado === 'cancelada') {
          // Deduct stock again
          for (const item of items) {
            if (item.producto_id) deductStock.run(item.cantidad, item.producto_id);
          }
        }
      }

      db.prepare(`
        UPDATE ventas SET estado = ?, metodo_pago = ?, notas = ? WHERE id = ?
      `).run(nuevoEstado, nuevoMetodo, nuevasNotas, venta.id);
    });

    patchVenta();

    const updated = db.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.id);
    const items   = db.prepare('SELECT * FROM venta_items WHERE venta_id = ?').all(venta.id);
    res.json({ ...updated, items });
  } catch (err) {
    console.error('PATCH ventas error:', err);
    res.status(500).json({ error: 'Error al actualizar venta' });
  }
});

/**
 * DELETE /api/ventas/:id
 * Sets estado = cancelada and restores stock.
 */
router.delete('/:id', (req, res) => {
  try {
    const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.id);
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
    if (venta.estado === 'cancelada') return res.status(400).json({ error: 'La venta ya está cancelada' });

    const cancelVenta = db.transaction(() => {
      const items = db.prepare('SELECT * FROM venta_items WHERE venta_id = ?').all(venta.id);
      const restoreStock = db.prepare('UPDATE productos SET stock_actual = stock_actual + ? WHERE id = ?');
      for (const item of items) {
        if (item.producto_id) restoreStock.run(item.cantidad, item.producto_id);
      }
      db.prepare("UPDATE ventas SET estado = 'cancelada' WHERE id = ?").run(venta.id);
    });

    cancelVenta();
    res.json({ ok: true, message: 'Venta cancelada y stock restaurado' });
  } catch (err) {
    console.error('DELETE ventas error:', err);
    res.status(500).json({ error: 'Error al cancelar venta' });
  }
});

module.exports = router;
