# Informações de Produção

Admin padrão criado automaticamente no start do backend:

- Email: `ps.raphael@hotmail.com`
- Senha inicial: `admin123`

Depois do primeiro login, o sistema força a troca da senha quando `ADMIN_FORCE_PASSWORD_CHANGE=true`.

Endpoints úteis:

- Saúde da API: `/health`
- Prontidão do banco: `/ready`
- Setup manual: `/setup`, disponível apenas quando `ENABLE_SETUP_ROUTE=true` ou fora de produção.

Em produção, mantenha a SQL IDE desligada por padrão. Para manutenção controlada:

- `ENABLE_ADMIN_SQL=true` habilita a tela/rota.
- `ENABLE_ADMIN_SQL_WRITE=true` libera `INSERT`, `UPDATE` e `DELETE`.
