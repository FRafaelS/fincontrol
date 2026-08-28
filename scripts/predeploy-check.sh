#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

echo "Checando sintaxe do backend..."
node --check backend/server.js
node --check backend/config/env.js
node --check backend/database/postgres.js
node --check backend/middleware/auth.js
node --check backend/routes/auth.js
node --check backend/routes/adminSql.js
node --check backend/routes/gastos.js
node --check backend/routes/receitas.js
node --check backend/routes/grupos.js
node --check backend/routes/lookups.js
node --check backend/routes/parcelas.js

echo "Rodando testes do frontend..."
cd "$ROOT_DIR/frontend"
CI=true npm test -- --watchAll=false

echo "Gerando build do frontend..."
npm run build

echo "Checando diff por whitespace..."
cd "$ROOT_DIR"
git diff --check

echo "Predeploy finalizado com sucesso."
