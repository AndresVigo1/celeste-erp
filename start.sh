#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Cargar .env si existe
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Inicializar DB si no existe
if [ ! -f "${DB_PATH:-./celeste.db}" ]; then
  echo "Inicializando base de datos..."
  node scripts/init-db.js
fi

echo "Iniciando Celeste ERP en puerto ${PORT:-3000}..."
node server/index.js
