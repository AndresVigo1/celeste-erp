FROM node:20-slim

RUN apt-get update && \
    apt-get install -y python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# Con imagen Debian (glibc), los prebuilts de better-sqlite3 funcionan en linux/amd64
RUN npm ci --only=production

COPY . .

ENV DB_PATH=/data/celeste.db
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["sh", "-c", "echo '=== ARCH CHECK ===' && uname -m && node -e 'console.log(\"Node arch:\", process.arch)' && [ ! -f /data/celeste.db ] && node scripts/init-db.js; node server/index.js"]
