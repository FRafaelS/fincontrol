#!/bin/bash

if [ -z "$1" ]; then
  echo "Erro: informe a descricao do commit."
  echo "Uso: ./atualizar.sh \"descricao do que foi feito\""
  exit 1
fi

echo "Iniciando atualizacao do FinControl..."

cd ~/RafaelDev/controle-gastos

git add .
git commit -m "$1"
git push origin main

echo "Codigo atualizado no GitHub com sucesso!"
echo "github.com/FRafaelS/fincontrol"
