# FinControl

Sistema de controle financeiro pessoal/familiar com lancamentos, receitas, metas, relatorios, importacao, grupos de dados e controle de acesso por tela.

## Ambientes

- Backend: Node.js + Express + PostgreSQL.
- Frontend: React.
- Admin inicial: `ps.raphael@hotmail.com` com senha `admin123`.
- Por padrao, a primeira senha e temporaria e deve ser trocada no primeiro acesso.

## Predeploy

Antes de publicar, rode:

```bash
./scripts/predeploy-check.sh
```

Esse script valida sintaxe do backend, testes do frontend, build de producao e whitespace do diff.

## Deploy

Veja o passo a passo em [DEPLOY.md](docs/DEPLOY.md).
