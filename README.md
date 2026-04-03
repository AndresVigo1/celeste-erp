# Celeste Taller Creativo — ERP

Mini sistema ERP móvil para gestionar ventas, gastos, inventario, clientes y pedidos de un taller artesanal.

## Stack

- **Backend:** Node.js + Express.js + SQLite (better-sqlite3) + JWT
- **Frontend:** HTML5 + CSS3 + Vanilla JS — PWA mobile-first
- **Acceso remoto:** Cloudflare Tunnel (opcional)

---

## 1. Prerequisitos

- Node.js v18 o superior
- npm v8 o superior
- (Opcional) cloudflared para acceso externo

---

## 2. Instalación

```bash
cd celeste-erp
npm install
```

---

## 3. Configuración

Copia el archivo de ejemplo y edítalo:

```bash
cp .env.example .env
```

Edita `.env`:

```env
PORT=3000
JWT_SECRET=pon_aqui_un_secreto_muy_largo_minimo_32_caracteres_random
DB_PATH=./celeste.db
NODE_ENV=production
```

> **Importante:** Cambia `JWT_SECRET` por una cadena aleatoria larga antes de usar en producción.
> Puedes generar una con: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

---

## 4. Inicializar base de datos

```bash
npm run db:init
```

Esto crea todas las tablas y carga datos de ejemplo (5 productos, 3 clientes, 10 ventas, 8 gastos, 3 pedidos).

**PIN de acceso por defecto: `123456`**

---

## 5. Iniciar el servidor

### Con npm:
```bash
npm start
```

### Con el script de inicio (recomendado):
```bash
chmod +x start.sh
./start.sh
```

El script verifica que la base de datos exista y la inicializa automáticamente si es necesario.

### Modo desarrollo (con auto-reload):
```bash
npm run dev
```

El servidor estará disponible en: **http://localhost:3000**

---

## 6. Cloudflare Tunnel (acceso externo)

Esto permite acceder al ERP desde cualquier dispositivo a través de internet, sin abrir puertos en el router.

### Paso 1: Instalar cloudflared

```bash
# macOS
brew install cloudflare/cloudflare/cloudflared

# Linux
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

### Paso 2: Autenticarse

```bash
cloudflared tunnel login
```

### Paso 3: Crear el tunnel

```bash
cloudflared tunnel create celeste-erp
```

Anota el **Tunnel ID** que aparece en la salida.

### Paso 4: Configurar el archivo YAML

Edita `cloudflared-config.yml` con tu Tunnel ID y dominio:

```yaml
tunnel: TU_TUNNEL_ID_AQUI
credentials-file: /Users/TU_USUARIO/.cloudflared/TU_TUNNEL_ID_AQUI.json

ingress:
  - hostname: celeste.tu-dominio.com
    service: http://localhost:3000
  - service: http_status:404
```

### Paso 5: Crear registro DNS

```bash
cloudflared tunnel route dns celeste-erp celeste.tu-dominio.com
```

### Paso 6: Iniciar el tunnel

```bash
# En una terminal separada (mientras el servidor Node corre)
cloudflared tunnel --config cloudflared-config.yml run
```

Para que se inicie automáticamente al arrancar el sistema:

```bash
sudo cloudflared service install
```

---

## 7. Instalar como PWA en iPhone

1. Abre Safari en tu iPhone
2. Navega a la URL de tu servidor (local o Cloudflare)
3. Toca el botón **Compartir** (cuadrado con flecha hacia arriba)
4. Selecciona **"Agregar a la pantalla de inicio"**
5. Confirma el nombre y toca **"Agregar"**

La app aparecerá en tu pantalla de inicio y se abrirá en modo pantalla completa, sin la barra del navegador.

---

## 8. PIN de acceso

### PIN por defecto: `123456`

### Cómo cambiar el PIN

Ejecuta este script en Node.js (desde la carpeta del proyecto):

```javascript
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
require('dotenv').config();
const db = new Database(process.env.DB_PATH || './celeste.db');

const nuevoPin = '654321'; // Cambia esto por tu nuevo PIN
const hash = bcrypt.hashSync(nuevoPin, 10);
db.prepare("UPDATE config SET valor = ? WHERE clave = 'pin_hash'").run(hash);
db.close();
console.log('PIN actualizado correctamente');
```

Guarda como `scripts/change-pin.js` y ejecuta:

```bash
node scripts/change-pin.js
```

---

## Estructura del proyecto

```
celeste-erp/
├── server/
│   ├── index.js              # Servidor Express principal
│   ├── db.js                 # Conexión SQLite
│   ├── middleware/
│   │   └── auth.js           # Verificación JWT
│   └── routes/
│       ├── auth.js           # Login + verify
│       ├── dashboard.js      # Resumen del negocio
│       ├── ventas.js         # CRUD ventas
│       ├── gastos.js         # CRUD gastos
│       ├── productos.js      # CRUD inventario
│       ├── clientes.js       # CRUD clientes
│       └── pedidos.js        # CRUD pedidos + convertir
├── public/
│   ├── index.html            # SPA shell
│   ├── manifest.json         # PWA manifest
│   ├── service-worker.js     # Offline support
│   ├── css/app.css           # Estilos mobile-first
│   └── js/
│       ├── api.js            # Fetch wrapper
│       ├── app.js            # Router principal
│       ├── components/       # Toast, Modal, BottomNav
│       └── views/            # Dashboard, Ventas, Gastos...
├── scripts/
│   └── init-db.js            # Inicialización de DB
├── .env.example
├── cloudflared-config.yml
├── start.sh
└── package.json
```

---

## API Endpoints

Todos los endpoints (excepto `/api/auth/login`) requieren header `Authorization: Bearer <token>`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login con PIN |
| GET  | `/api/auth/verify` | Verificar token |
| GET  | `/api/dashboard` | Resumen del negocio |
| GET/POST | `/api/ventas` | Listar / crear ventas |
| GET/PATCH/DELETE | `/api/ventas/:id` | Detalle / editar / cancelar |
| GET/POST | `/api/gastos` | Listar / crear gastos |
| GET/PATCH/DELETE | `/api/gastos/:id` | Detalle / editar / eliminar |
| GET/POST | `/api/productos` | Listar / crear productos |
| PATCH/DELETE | `/api/productos/:id` | Editar / desactivar |
| GET/POST | `/api/clientes` | Listar / crear clientes |
| GET/PATCH | `/api/clientes/:id` | Detalle / editar |
| GET/POST | `/api/pedidos` | Listar / crear pedidos |
| PATCH | `/api/pedidos/:id` | Actualizar estado / datos |
| POST | `/api/pedidos/:id/convertir` | Convertir pedido en venta |
