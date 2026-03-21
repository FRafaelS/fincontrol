#!/bin/bash

# ─────────────────────────────────────────
# FinControl — Script de atualização GitHub
# Uso: ./atualizar.sh "descrição do que foi feito"
# ─────────────────────────────────────────

if [ -z "$1" ]; then
  echo "❌ Erro: informe a descrição do commit."
  echo "   Uso: ./atualizar.sh \"descricao do que foi feito\""
  exit 1
fi

echo "🚀 Iniciando atualização do FinControl..."
echo ""

cd ~/RafaelDev/controle-gastos

echo "📋 Arquivos modificados:"
git status --short
echo ""

git add .
git commit -m "$1"
git push origin main

echo ""
echo "✅ Código atualizado no GitHub com sucesso!"
echo "🔗 github.com/FRafaelS/fincontrol"