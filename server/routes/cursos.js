'use strict';

const express = require('express');
const { db }  = require('../db');

const router = express.Router();

// ── GET /api/cursos ───────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { estado, mes } = req.query;
    const conditions = [];
    const params = [];

    if (estado) {
      conditions.push('c.estado = ?');
      params.push(estado);
    }
    if (mes) {
      conditions.push("strftime('%Y-%m', c.fecha_inicio) = ?");
      params.push(mes);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const cursos = db.prepare(`
      SELECT
        c.*,
        COUNT(DISTINCT ci.id)          AS num_inscritas,
        COALESCE(SUM(ci.monto_total),0) AS ingresos_esperados,
        COALESCE(SUM(ci.monto_pagado),0) AS ingresos_cobrados,
        COALESCE((SELECT SUM(cg.monto) FROM curso_gastos cg WHERE cg.curso_id = c.id),0) AS total_gastos
      FROM cursos c
      LEFT JOIN curso_inscripciones ci ON ci.curso_id = c.id
      ${where}
      GROUP BY c.id
      ORDER BY c.fecha_inicio DESC
    `).all(...params);

    res.json(cursos);
  } catch (err) {
    console.error('GET cursos error:', err);
    res.status(500).json({ error: 'Error al obtener cursos' });
  }
});

// ── POST /api/cursos ──────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const { nombre, descripcion, fecha_inicio, fecha_fin, precio, cupo, notas } = req.body;

  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  if (!fecha_inicio)             return res.status(400).json({ error: 'Fecha de inicio requerida' });
  const precioNum = parseFloat(precio);
  if (isNaN(precioNum) || precioNum < 0) return res.status(400).json({ error: 'Precio inválido' });

  try {
    const result = db.prepare(`
      INSERT INTO cursos (nombre, descripcion, fecha_inicio, fecha_fin, precio, cupo, notas)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      nombre.trim(), descripcion || null, fecha_inicio,
      fecha_fin || null, precioNum, cupo ? parseInt(cupo) : null, notas || null
    );
    const curso = db.prepare('SELECT * FROM cursos WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(curso);
  } catch (err) {
    console.error('POST cursos error:', err);
    res.status(500).json({ error: 'Error al crear curso' });
  }
});

// ── GET /api/cursos/:id ───────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const curso = db.prepare('SELECT * FROM cursos WHERE id = ?').get(req.params.id);
    if (!curso) return res.status(404).json({ error: 'Curso no encontrado' });

    const sesiones = db.prepare(
      'SELECT * FROM curso_sesiones WHERE curso_id = ? ORDER BY fecha'
    ).all(curso.id);

    const inscripciones = db.prepare(`
      SELECT ci.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
      FROM curso_inscripciones ci
      LEFT JOIN clientes c ON c.id = ci.cliente_id
      WHERE ci.curso_id = ?
      ORDER BY ci.created_at
    `).all(curso.id);

    const gastos = db.prepare(
      'SELECT * FROM curso_gastos WHERE curso_id = ? ORDER BY fecha'
    ).all(curso.id);

    const stats = {
      num_inscritas:      inscripciones.length,
      ingresos_esperados: inscripciones.reduce((s, i) => s + i.monto_total, 0),
      ingresos_cobrados:  inscripciones.reduce((s, i) => s + i.monto_pagado, 0),
      total_gastos:       gastos.reduce((s, g) => s + g.monto, 0),
    };
    stats.utilidad = stats.ingresos_cobrados - stats.total_gastos;

    res.json({ ...curso, sesiones, inscripciones, gastos, stats });
  } catch (err) {
    console.error('GET cursos/:id error:', err);
    res.status(500).json({ error: 'Error al obtener curso' });
  }
});

// ── PATCH /api/cursos/:id ─────────────────────────────────────────────────────
router.patch('/:id', (req, res) => {
  try {
    const curso = db.prepare('SELECT * FROM cursos WHERE id = ?').get(req.params.id);
    if (!curso) return res.status(404).json({ error: 'Curso no encontrado' });

    const {
      nombre      = curso.nombre,
      descripcion = curso.descripcion,
      fecha_inicio= curso.fecha_inicio,
      fecha_fin   = curso.fecha_fin,
      precio      = curso.precio,
      cupo        = curso.cupo,
      estado      = curso.estado,
      notas       = curso.notas,
    } = req.body;

    db.prepare(`
      UPDATE cursos SET nombre=?, descripcion=?, fecha_inicio=?, fecha_fin=?,
        precio=?, cupo=?, estado=?, notas=? WHERE id=?
    `).run(
      nombre, descripcion || null, fecha_inicio, fecha_fin || null,
      parseFloat(precio), cupo ? parseInt(cupo) : null, estado, notas || null, curso.id
    );

    res.json(db.prepare('SELECT * FROM cursos WHERE id = ?').get(curso.id));
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar curso' });
  }
});

// ── DELETE /api/cursos/:id ────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const curso = db.prepare('SELECT * FROM cursos WHERE id = ?').get(req.params.id);
    if (!curso) return res.status(404).json({ error: 'Curso no encontrado' });
    db.prepare('DELETE FROM cursos WHERE id = ?').run(curso.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar curso' });
  }
});

// ── POST /api/cursos/:id/sesiones ─────────────────────────────────────────────
router.post('/:id/sesiones', (req, res) => {
  const { fecha, descripcion } = req.body;
  if (!fecha) return res.status(400).json({ error: 'Fecha requerida' });

  try {
    const result = db.prepare(
      'INSERT INTO curso_sesiones (curso_id, fecha, descripcion) VALUES (?, ?, ?)'
    ).run(req.params.id, fecha, descripcion || null);

    res.status(201).json(db.prepare('SELECT * FROM curso_sesiones WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) {
    res.status(500).json({ error: 'Error al agregar sesión' });
  }
});

// ── DELETE /api/cursos/:id/sesiones/:sid ──────────────────────────────────────
router.delete('/:id/sesiones/:sid', (req, res) => {
  try {
    db.prepare('DELETE FROM curso_sesiones WHERE id = ? AND curso_id = ?').run(req.params.sid, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar sesión' });
  }
});

// ── POST /api/cursos/:id/inscripciones ────────────────────────────────────────
router.post('/:id/inscripciones', (req, res) => {
  const { cliente_id, nombre_libre, monto_total, monto_pagado = 0, notas } = req.body;

  if (!cliente_id && !nombre_libre) {
    return res.status(400).json({ error: 'Se requiere cliente o nombre' });
  }
  const total  = parseFloat(monto_total);
  const pagado = parseFloat(monto_pagado);
  if (isNaN(total) || total < 0) return res.status(400).json({ error: 'Monto total inválido' });

  const estado_pago = pagado <= 0 ? 'pendiente' : pagado >= total ? 'pagado' : 'parcial';

  try {
    const result = db.prepare(`
      INSERT INTO curso_inscripciones
        (curso_id, cliente_id, nombre_libre, monto_total, monto_pagado, estado_pago, notas)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.params.id, cliente_id || null, nombre_libre || null,
      total, pagado, estado_pago, notas || null
    );
    res.status(201).json(db.prepare('SELECT * FROM curso_inscripciones WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) {
    console.error('POST inscripcion error:', err);
    res.status(500).json({ error: 'Error al agregar inscripción' });
  }
});

// ── PATCH /api/cursos/:id/inscripciones/:iid ──────────────────────────────────
router.patch('/:id/inscripciones/:iid', (req, res) => {
  try {
    const ins = db.prepare('SELECT * FROM curso_inscripciones WHERE id = ? AND curso_id = ?')
      .get(req.params.iid, req.params.id);
    if (!ins) return res.status(404).json({ error: 'Inscripción no encontrada' });

    const {
      monto_total  = ins.monto_total,
      monto_pagado = ins.monto_pagado,
      notas        = ins.notas,
    } = req.body;

    const total  = parseFloat(monto_total);
    const pagado = parseFloat(monto_pagado);
    const estado_pago = pagado <= 0 ? 'pendiente' : pagado >= total ? 'pagado' : 'parcial';

    db.prepare(`
      UPDATE curso_inscripciones SET monto_total=?, monto_pagado=?, estado_pago=?, notas=? WHERE id=?
    `).run(total, pagado, estado_pago, notas || null, ins.id);

    res.json(db.prepare('SELECT * FROM curso_inscripciones WHERE id = ?').get(ins.id));
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar inscripción' });
  }
});

// ── DELETE /api/cursos/:id/inscripciones/:iid ─────────────────────────────────
router.delete('/:id/inscripciones/:iid', (req, res) => {
  try {
    db.prepare('DELETE FROM curso_inscripciones WHERE id = ? AND curso_id = ?')
      .run(req.params.iid, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar inscripción' });
  }
});

// ── POST /api/cursos/:id/gastos ───────────────────────────────────────────────
router.post('/:id/gastos', (req, res) => {
  const { descripcion, monto, fecha } = req.body;
  if (!descripcion) return res.status(400).json({ error: 'Descripción requerida' });
  const montoNum = parseFloat(monto);
  if (isNaN(montoNum) || montoNum <= 0) return res.status(400).json({ error: 'Monto inválido' });

  try {
    const result = db.prepare(
      'INSERT INTO curso_gastos (curso_id, descripcion, monto, fecha) VALUES (?, ?, ?, ?)'
    ).run(req.params.id, descripcion.trim(), montoNum, fecha || new Date().toISOString().slice(0, 10));

    res.status(201).json(db.prepare('SELECT * FROM curso_gastos WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) {
    res.status(500).json({ error: 'Error al agregar gasto' });
  }
});

// ── DELETE /api/cursos/:id/gastos/:gid ───────────────────────────────────────
router.delete('/:id/gastos/:gid', (req, res) => {
  try {
    db.prepare('DELETE FROM curso_gastos WHERE id = ? AND curso_id = ?')
      .run(req.params.gid, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar gasto' });
  }
});

module.exports = router;
