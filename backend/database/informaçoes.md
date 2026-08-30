# Informações de Produção

Admin padrão criado automaticamente no start do backend:

- Email: `ps.raphael@hotmail.com`
- Senha inicial: `admin123`

Depois do primeiro login, o sistema força a troca da senha quando `ADMIN_FORCE_PASSWORD_CHANGE=true`.

Na V2, esse usuario vira `SUPER_ADMIN` da plataforma. O primeiro start tambem cria a conta padrao definida por:

- `DEFAULT_TENANT_NAME`
- `DEFAULT_TENANT_SLUG`
- `DEFAULT_TENANT_DESCRIPTION`

Gastos, receitas, grupos, permissoes e lookups possuem `tenant_id`. Assim, cada familia/cliente usa o mesmo backend/frontend, mas os dados ficam separados por conta.

Novas contas recebem somente os tipos de lookup e parametros operacionais. Responsaveis, categorias e formas de pagamento nao sao compartilhados entre contas e devem ser cadastrados pelo administrador da propria conta.

Endpoints úteis:

- Saúde da API: `/health`
- Prontidão do banco: `/ready`
- Setup manual: `/setup`, disponível apenas quando `ENABLE_SETUP_ROUTE=true` ou fora de produção.

Em produção, mantenha a SQL IDE desligada por padrão. Para manutenção controlada:

- Na lookup `CONFIG_SISTEMA / SQL_IDE_ENABLED`, use `TAG = S` para habilitar e `TAG = N` para desligar.
- A rota continua restrita ao perfil `SUPER_ADMIN`.
- `ENABLE_ADMIN_SQL_WRITE=true` libera `INSERT`, `UPDATE` e `DELETE`; mantenha `false` para permitir apenas consultas.
