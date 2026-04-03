'use strict';

require('dotenv').config();
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(process.env.DB_PATH || './celeste.db');
console.log(`Inicializando base de datos en: ${dbPath}`);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ────────────────────────────────────────────────────────────────────

db.exec(`
CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  telefono TEXT,
  instagram TEXT,
  canal_preferido TEXT CHECK(canal_preferido IN ('whatsapp','instagram','referido','feria','otro')) DEFAULT 'whatsapp',
  notas TEXT,
  activo INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  categoria TEXT,
  precio_venta REAL NOT NULL DEFAULT 0,
  costo_material REAL NOT NULL DEFAULT 0,
  stock_actual INTEGER NOT NULL DEFAULT 0,
  stock_minimo INTEGER NOT NULL DEFAULT 5,
  unidad TEXT DEFAULT 'unidad',
  activo INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS ventas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT DEFAULT (date('now','localtime')),
  cliente_id INTEGER REFERENCES clientes(id),
  cliente_nombre TEXT,
  canal TEXT CHECK(canal IN ('whatsapp','instagram','feria','local','otro')) DEFAULT 'whatsapp',
  tipo TEXT CHECK(tipo IN ('encargo','stock')) DEFAULT 'stock',
  subtotal REAL NOT NULL DEFAULT 0,
  descuento REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  costo_total REAL NOT NULL DEFAULT 0,
  estado TEXT CHECK(estado IN ('pagada','pendiente','cancelada')) DEFAULT 'pagada',
  metodo_pago TEXT CHECK(metodo_pago IN ('efectivo','transferencia','mixto')) DEFAULT 'efectivo',
  notas TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS venta_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id INTEGER REFERENCES productos(id),
  descripcion TEXT,
  cantidad INTEGER NOT NULL DEFAULT 1,
  precio_unitario REAL NOT NULL DEFAULT 0,
  costo_unitario REAL NOT NULL DEFAULT 0,
  subtotal REAL GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

CREATE TABLE IF NOT EXISTS gastos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT DEFAULT (date('now','localtime')),
  categoria TEXT CHECK(categoria IN ('materiales','empaque','publicidad','herramientas','servicios','transporte','otros')) NOT NULL,
  descripcion TEXT NOT NULL,
  proveedor TEXT,
  monto REAL NOT NULL,
  metodo_pago TEXT CHECK(metodo_pago IN ('efectivo','transferencia')) DEFAULT 'efectivo',
  notas TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER REFERENCES clientes(id),
  cliente_nombre TEXT,
  fecha_encargo TEXT DEFAULT (date('now','localtime')),
  fecha_entrega TEXT,
  descripcion TEXT NOT NULL,
  monto_total REAL NOT NULL DEFAULT 0,
  adelanto REAL NOT NULL DEFAULT 0,
  saldo REAL GENERATED ALWAYS AS (monto_total - adelanto) STORED,
  estado TEXT CHECK(estado IN ('pendiente','en_proceso','listo','entregado','cancelado')) DEFAULT 'pendiente',
  notas TEXT,
  venta_id INTEGER REFERENCES ventas(id),
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor TEXT
);
`);

console.log('Tablas creadas correctamente.');

// ── Check if already seeded ───────────────────────────────────────────────────

const alreadySeeded = db.prepare("SELECT COUNT(*) as cnt FROM productos").get();
if (alreadySeeded.cnt > 0) {
  console.log('La base de datos ya tiene datos. Saltando seed.');
  db.close();
  process.exit(0);
}

// ── Seed Data ─────────────────────────────────────────────────────────────────

const seedAll = db.transaction(() => {

  // ── Config ────────────────────────────────────────────────────────────────
  const pinHash = bcrypt.hashSync('123456', 10);
  const insertConfig = db.prepare("INSERT OR REPLACE INTO config (clave, valor) VALUES (?, ?)");
  insertConfig.run('pin_hash', pinHash);
  insertConfig.run('nombre_negocio', 'Celeste Taller Creativo');
  insertConfig.run('moneda', 'USD');

  // ── Productos ─────────────────────────────────────────────────────────────
  const insertProducto = db.prepare(`
    INSERT INTO productos (nombre, descripcion, categoria, precio_venta, costo_material, stock_actual, stock_minimo, unidad)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const p1 = insertProducto.run('Llavero de resina', 'Llavero artesanal de resina epoxi con flores y colores personalizados', 'Accesorios', 3.50, 0.80, 42, 10, 'unidad');
  const p2 = insertProducto.run('Cuadro de macramé', 'Cuadro decorativo tejido en macramé, marco de madera natural 30x40cm', 'Decoración', 25.00, 8.00, 8, 5, 'unidad');
  const p3 = insertProducto.run('Set de regalo spa', 'Set con jabón artesanal, vela de soya y sales de baño. Ideal para regalo', 'Regalos', 18.00, 6.00, 15, 5, 'unidad');
  const p4 = insertProducto.run('Aretes de arcilla', 'Aretes hechos a mano en arcilla polimérica, diseños únicos', 'Joyería', 8.00, 2.00, 28, 8, 'par');
  const p5 = insertProducto.run('Cesta de mimbre decorada', 'Cesta de mimbre natural decorada con cintas, flores secas y personalización', 'Decoración', 35.00, 12.00, 4, 5, 'unidad');

  const prod_ids = [p1.lastInsertRowid, p2.lastInsertRowid, p3.lastInsertRowid, p4.lastInsertRowid, p5.lastInsertRowid];

  // ── Clientes ──────────────────────────────────────────────────────────────
  const insertCliente = db.prepare(`
    INSERT INTO clientes (nombre, telefono, instagram, canal_preferido, notas)
    VALUES (?, ?, ?, ?, ?)
  `);

  const c1 = insertCliente.run('María González', '+593 99 123 4567', '@maria.gonzalez', 'whatsapp', 'Cliente frecuente, le gustan los aretes y llaveros');
  const c2 = insertCliente.run('Sofía Andrade', '+593 98 765 4321', '@sofi.andrade.ec', 'instagram', 'Compró set spa para regalo, muy satisfecha');
  const c3 = insertCliente.run('Carmen Loja', '+593 97 555 8899', null, 'referido', 'Referida por María González, interesada en macramé');

  const cli_ids = [c1.lastInsertRowid, c2.lastInsertRowid, c3.lastInsertRowid];

  // ── Helper: date N days ago ───────────────────────────────────────────────
  function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  // ── Ventas ────────────────────────────────────────────────────────────────
  const insertVenta = db.prepare(`
    INSERT INTO ventas (fecha, cliente_id, cliente_nombre, canal, tipo, subtotal, descuento, total, costo_total, estado, metodo_pago, notas)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertItem = db.prepare(`
    INSERT INTO venta_items (venta_id, producto_id, descripcion, cantidad, precio_unitario, costo_unitario)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Venta 1: hace 58 días — 3 llaveros
  const v1 = insertVenta.run(daysAgo(58), cli_ids[0], 'María González', 'whatsapp', 'stock', 10.50, 0, 10.50, 2.40, 'pagada', 'efectivo', null);
  insertItem.run(v1.lastInsertRowid, prod_ids[0], 'Llavero de resina', 3, 3.50, 0.80);

  // Venta 2: hace 52 días — cuadro macramé
  const v2 = insertVenta.run(daysAgo(52), cli_ids[2], 'Carmen Loja', 'whatsapp', 'encargo', 25.00, 0, 25.00, 8.00, 'pagada', 'transferencia', 'Encargo personalizado, referida por María González');
  insertItem.run(v2.lastInsertRowid, prod_ids[1], 'Cuadro de macramé', 1, 25.00, 8.00);

  // Venta 3: hace 45 días — set spa + aretes
  const v3 = insertVenta.run(daysAgo(45), cli_ids[1], 'Sofía Andrade', 'instagram', 'stock', 26.00, 0, 26.00, 8.00, 'pagada', 'transferencia', null);
  insertItem.run(v3.lastInsertRowid, prod_ids[2], 'Set de regalo spa', 1, 18.00, 6.00);
  insertItem.run(v3.lastInsertRowid, prod_ids[3], 'Aretes de arcilla', 1, 8.00, 2.00);

  // Venta 4: hace 40 días — 5 llaveros (feria)
  const v4 = insertVenta.run(daysAgo(40), null, 'Cliente feria', 'feria', 'stock', 17.50, 0, 17.50, 4.00, 'pagada', 'efectivo', 'Feria de artesanías del parque');
  insertItem.run(v4.lastInsertRowid, prod_ids[0], 'Llavero de resina', 5, 3.50, 0.80);

  // Venta 5: hace 35 días — cesta mimbre
  const v5 = insertVenta.run(daysAgo(35), cli_ids[0], 'María González', 'whatsapp', 'encargo', 35.00, 5.00, 30.00, 12.00, 'pagada', 'mixto', 'Descuento cliente frecuente');
  insertItem.run(v5.lastInsertRowid, prod_ids[4], 'Cesta de mimbre decorada', 1, 35.00, 12.00);

  // Venta 6: hace 28 días — 2 sets spa (feria)
  const v6 = insertVenta.run(daysAgo(28), null, 'Cliente feria', 'feria', 'stock', 36.00, 0, 36.00, 12.00, 'pagada', 'efectivo', null);
  insertItem.run(v6.lastInsertRowid, prod_ids[2], 'Set de regalo spa', 2, 18.00, 6.00);

  // Venta 7: hace 20 días — aretes (Instagram)
  const v7 = insertVenta.run(daysAgo(20), cli_ids[1], 'Sofía Andrade', 'instagram', 'stock', 16.00, 0, 16.00, 4.00, 'pagada', 'transferencia', null);
  insertItem.run(v7.lastInsertRowid, prod_ids[3], 'Aretes de arcilla', 2, 8.00, 2.00);

  // Venta 8: hace 14 días — llaveros + aretes
  const v8 = insertVenta.run(daysAgo(14), cli_ids[2], 'Carmen Loja', 'whatsapp', 'stock', 15.50, 0, 15.50, 4.40, 'pagada', 'efectivo', null);
  insertItem.run(v8.lastInsertRowid, prod_ids[0], 'Llavero de resina', 2, 3.50, 0.80);
  insertItem.run(v8.lastInsertRowid, prod_ids[3], 'Aretes de arcilla', 1, 8.00, 2.00);

  // Venta 9: hace 7 días — cuadro macramé
  const v9 = insertVenta.run(daysAgo(7), null, 'Luisa Mora', 'local', 'stock', 25.00, 0, 25.00, 8.00, 'pagada', 'transferencia', null);
  insertItem.run(v9.lastInsertRowid, prod_ids[1], 'Cuadro de macramé', 1, 25.00, 8.00);

  // Venta 10: hace 2 días — set spa + llavero
  const v10 = insertVenta.run(daysAgo(2), cli_ids[0], 'María González', 'whatsapp', 'stock', 21.50, 0, 21.50, 6.80, 'pagada', 'efectivo', null);
  insertItem.run(v10.lastInsertRowid, prod_ids[2], 'Set de regalo spa', 1, 18.00, 6.00);
  insertItem.run(v10.lastInsertRowid, prod_ids[0], 'Llavero de resina', 1, 3.50, 0.80);

  // ── Gastos ────────────────────────────────────────────────────────────────
  const insertGasto = db.prepare(`
    INSERT INTO gastos (fecha, categoria, descripcion, proveedor, monto, metodo_pago, notas)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertGasto.run(daysAgo(55), 'materiales', 'Resina epoxi kit 1kg + pigmentos', 'Distribuidora Manos Creativas', 28.50, 'transferencia', null);
  insertGasto.run(daysAgo(50), 'empaque', 'Bolsas kraft y cintas decorativas x50', 'Mercado Central Quito', 12.00, 'efectivo', null);
  insertGasto.run(daysAgo(42), 'materiales', 'Hilo macramé natural 3mm 500g', 'Artesanías del Norte', 18.00, 'efectivo', null);
  insertGasto.run(daysAgo(38), 'publicidad', 'Anuncio Instagram promoción feria', 'Meta Ads', 15.00, 'transferencia', 'Campaña 7 días');
  insertGasto.run(daysAgo(30), 'materiales', 'Arcilla polimérica Sculpey x10 bloques', 'Distribuidora Manos Creativas', 22.00, 'transferencia', null);
  insertGasto.run(daysAgo(22), 'herramientas', 'Moldes silicona formas geométricas x8', 'AliExpress / Importación', 14.50, 'transferencia', null);
  insertGasto.run(daysAgo(15), 'empaque', 'Cajas regalo pequeñas x30 + papel tissue', 'Papelería El Sol', 9.00, 'efectivo', null);
  insertGasto.run(daysAgo(5), 'transporte', 'Envíos a domicilio semana', 'Servicio propio', 8.00, 'efectivo', '4 entregas a domicilio');

  // ── Pedidos ───────────────────────────────────────────────────────────────
  const insertPedido = db.prepare(`
    INSERT INTO pedidos (cliente_id, cliente_nombre, fecha_encargo, fecha_entrega, descripcion, monto_total, adelanto, estado, notas)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Pedido futuro próximo
  const futuro1 = new Date(); futuro1.setDate(futuro1.getDate() + 5);
  const futuro2 = new Date(); futuro2.setDate(futuro2.getDate() + 12);
  const futuro3 = new Date(); futuro3.setDate(futuro3.getDate() + 20);

  insertPedido.run(
    cli_ids[0], 'María González',
    daysAgo(3), futuro1.toISOString().slice(0, 10),
    '3 llaveros de resina personalizados con fotos y 2 pares de aretes flores pastel',
    26.50, 13.00, 'en_proceso',
    'Los llaveros llevan foto de mascota. Aretes en tonos rosa y lila.'
  );

  insertPedido.run(
    cli_ids[2], 'Carmen Loja',
    daysAgo(1), futuro2.toISOString().slice(0, 10),
    'Cuadro de macramé grande 50x60cm con personalización de iniciales',
    45.00, 20.00, 'pendiente',
    'Iniciales "C&R" en el centro. Pide colores tierra y beige.'
  );

  insertPedido.run(
    cli_ids[1], 'Sofía Andrade',
    daysAgo(0), futuro3.toISOString().slice(0, 10),
    'Set regalo spa premium para baby shower: 2 sets spa + cesta de mimbre decorada con moño',
    71.00, 35.00, 'pendiente',
    'Baby shower el ' + futuro3.toISOString().slice(0, 10) + '. Decoración en azul y blanco.'
  );

});

seedAll();

// Ajustar stock real después de ventas (ventas en los 60 días ya descontadas)
db.prepare("UPDATE productos SET stock_actual = 42 WHERE id = 1").run();
db.prepare("UPDATE productos SET stock_actual = 8  WHERE id = 2").run();
db.prepare("UPDATE productos SET stock_actual = 15 WHERE id = 3").run();
db.prepare("UPDATE productos SET stock_actual = 28 WHERE id = 4").run();
db.prepare("UPDATE productos SET stock_actual = 4  WHERE id = 5").run();

db.close();
console.log('✓ Base de datos inicializada con datos de prueba.');
console.log('  PIN de acceso por defecto: 123456');
