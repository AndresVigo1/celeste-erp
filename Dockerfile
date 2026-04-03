FROM --platform=linux/amd64 node:20-alpine

# Dependencias nativas para better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./

# Forzar descarga del prebuilt binario para linux/x64
# npm_config_platform y npm_config_arch le dicen a prebuild-install
# qué arquitectura descargar, independiente del host del builder
RUN npm_config_platform=linux npm_config_arch=x64 npm ci --only=production

COPY . .

ENV DB_PATH=/data/celeste.db
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["sh", "-c", "[ ! -f /data/celeste.db ] && node scripts/init-db.js; node server/index.js"]
