#!/bin/sh
set -e

echo "→ Aplicando migrações do banco..."
npx prisma migrate deploy

echo "→ Garantindo usuários de acesso..."
node prisma/ensure-users.cjs

echo "→ Iniciando API..."
exec node dist/main.js
