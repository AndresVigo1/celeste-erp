'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express    = require('express');
const cors       = require('cors');

const authMiddleware  = require('./middleware/auth');
const authRoutes      = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const ventasRoutes    = require('./routes/ventas');
const gastosRoutes    = require('./routes/gastos');
const productosRoutes = require('./routes/productos');
const clientesRoutes  = require('./routes/clientes');
const pedidosRoutes   = require('./routes/pedidos');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static files ──────────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Public routes (no auth) ───────────────────────────────────────────────────

app.use('/api/auth', authRoutes);

// ── Protected routes (JWT required) ──────────────────────────────────────────

app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/ventas',    authMiddleware, ventasRoutes);
app.use('/api/gastos',    authMiddleware, gastosRoutes);
app.use('/api/productos', authMiddleware, productosRoutes);
app.use('/api/clientes',  authMiddleware, clientesRoutes);
app.use('/api/pedidos',   authMiddleware, pedidosRoutes);

// ── SPA fallback — serve index.html for all non-API routes ───────────────────

app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── Global error handler ──────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ── Start server ──────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Celeste Taller Creativo ERP`);
  console.log(`  Servidor corriendo en http://localhost:${PORT}`);
  console.log(`  Entorno: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
