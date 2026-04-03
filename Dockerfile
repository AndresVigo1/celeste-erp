FROM node:20-alpine

# Dependencias nativas para better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# El volumen de Fly.io se monta en /data
ENV DB_PATH=/data/celeste.db
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Inicializa la DB si no existe, luego arranca el servidor
CMD ["sh", "-c", "[ ! -f /data/celeste.db ] && node scripts/init-db.js; node server/index.js"]
