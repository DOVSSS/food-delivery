#!/bin/sh
set -e

echo "[entrypoint] Applying migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "[entrypoint] Generating Prisma client..."
npx prisma generate --schema=./prisma/schema.prisma

node -e "
const fs = require('fs');
const client = fs.readFileSync('node_modules/.prisma/client/index.d.ts', 'utf8');
if (!client.includes('openTime')) {
  console.error('[entrypoint] FATAL: Prisma client missing openTime after generate');
  process.exit(1);
}
console.log('[entrypoint] Prisma client OK (openTime present)');
"

if ! grep -q 'pushToken' dist/user/user.service.js; then
  echo "[entrypoint] FATAL: stale dist/user/user.service.js (findAll must omit pushToken)"
  exit 1
fi

echo "[entrypoint] Starting NestJS..."
exec node dist/main
