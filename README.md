# FinControl

Sistema de controle financeiro pessoal/familiar com lancamentos, receitas, metas, relatorios, importacao, grupos de dados, controle de acesso por tela e isolamento por conta.

## Ambientes

- Backend: Node.js + Express + PostgreSQL.
- Frontend: React.
- Admin inicial: `ps.raphael@hotmail.com` com senha `admin123`.
- Por padrao, a primeira senha e temporaria e deve ser trocada no primeiro acesso.
- Recuperacao de senha por e-mail configuravel por SMTP.
- O admin inicial vira `SUPER_ADMIN`; cada familia/cliente deve ficar em uma conta propria.
- Cada conta possui seus proprios valores de parametros. Novas contas recebem apenas os tipos e configuracoes operacionais; responsaveis, categorias e formas de pagamento devem ser cadastrados dentro da propria conta.

## Predeploy

Antes de publicar, rode:

```bash
./scripts/predeploy-check.sh
```

Esse script valida sintaxe do backend, testes do frontend, build de producao e whitespace do diff.

## Deploy

Veja o passo a passo em [DEPLOY.md](docs/DEPLOY.md).
