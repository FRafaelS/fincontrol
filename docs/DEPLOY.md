# Deploy do FinControl

Este checklist prepara a primeira versao produtiva do FinControl com backend Node.js, frontend React e PostgreSQL.

Na V2, o sistema trabalha com contas separadas (`tenants`). Cada familia/cliente fica na propria conta, com usuarios, grupos, parametros, receitas e despesas isolados.

Ao criar uma nova conta, o sistema cria somente os tipos de parametro e configuracoes operacionais. Valores de uso da familia/cliente, como responsaveis, categorias e formas de pagamento, devem ser cadastrados na propria conta e aparecem apenas para os usuarios dessa conta.

## 1. Banco PostgreSQL

Crie um banco PostgreSQL e guarde a string de conexao.

O backend tambem executa migracoes basicas no start, mas o schema de referencia fica em:

```text
backend/database/Criar_Tabelas.sql
```

Para backup:

```bash
pg_dump "$DATABASE_URL" > backup-fincontrol.sql
```

Para restaurar:

```bash
psql "$DATABASE_URL" < backup-fincontrol.sql
```

## 2. Backend

Configure as variaveis de ambiente da API usando `backend/.env.example` como base.

Obrigatorias em producao:

```bash
NODE_ENV=production
DATABASE_URL=postgres://usuario:senha@host:5432/fincontrol
JWT_SECRET=um_segredo_longo_com_32_ou_mais_caracteres
CORS_ORIGINS=https://seu-frontend.vercel.app
FRONTEND_URL=https://seu-frontend.vercel.app
```

Para habilitar recuperacao de senha por e-mail em producao, configure tambem:

```bash
PASSWORD_RESET_ENABLED=true
PASSWORD_RESET_EXPIRES_MINUTES=30
EMAIL_FROM="FinControl <nao-responda@seudominio.com>"
SMTP_HOST=smtp.seudominio.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=usuario
SMTP_PASS=senha
```

Recomendadas:

```bash
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false
ADMIN_EMAIL=ps.raphael@hotmail.com
ADMIN_INITIAL_PASSWORD=admin123
ADMIN_FORCE_PASSWORD_CHANGE=true
DEFAULT_TENANT_NAME=Familia Raphael
DEFAULT_TENANT_SLUG=familia-raphael
ENABLE_SETUP_ROUTE=false
ENABLE_ADMIN_SQL=false
ENABLE_ADMIN_SQL_WRITE=false
```

O primeiro start cria a conta padrao, vincula os dados existentes a ela e transforma o email configurado em `ADMIN_EMAIL` em `SUPER_ADMIN`.

Comandos:

```bash
cd backend
npm install
npm run build
npm start
```

Endpoints de monitoramento:

```text
/health
/ready
```

## 3. Frontend

Configure `frontend/.env.production` usando `frontend/.env.production.example` como base:

```bash
REACT_APP_API_URL=https://sua-api.onrender.com
CI=false
```

Depois gere o build:

```bash
cd frontend
npm install
npm run build
```

Publique a pasta:

```text
frontend/build
```

## 4. SQL IDE

Em producao, deixe desligada por padrao. A ativacao agora fica em parametro do sistema:

```text
Configurações > Lookups > CONFIG_SISTEMA > SQL_IDE_ENABLED
TAG = S para ligar
TAG = N para desligar
```

A tela só aparece para `SUPER_ADMIN`. Depois de alterar a lookup, volte para o menu principal ou recarregue a aplicação.

Comandos de escrita continuam travados por variavel de ambiente. Para permitir apenas `SELECT`, mantenha:

```bash
ENABLE_ADMIN_SQL_WRITE=false
```

Para permitir escrita, use somente durante a manutencao:

```bash
ENABLE_ADMIN_SQL_WRITE=true
```

Depois volte para:

```bash
TAG = N na lookup CONFIG_SISTEMA / SQL_IDE_ENABLED
ENABLE_ADMIN_SQL_WRITE=false
```

## 5. Teste final

Antes de liberar para outras pessoas:

```bash
./scripts/predeploy-check.sh
```

Valide manualmente:

- Login do admin inicial.
- Troca obrigatoria da senha inicial.
- Recuperacao de senha pelo link enviado por e-mail.
- Criacao de usuario.
- Criacao de uma nova conta em Perfil > Contas.
- Controle de telas em Perfil > Acessos.
- Criacao de grupo e compartilhamento de dados.
- Cadastro de lancamento e receita.
- Importacao pelo modelo.
- Relatorios.
- Temas claro e escuro.
- Isolamento: um usuario fora do grupo nao deve ver dados de outro.

## 6. Operacao

- Agende backup diario do PostgreSQL.
- Acompanhe `/health` e `/ready`.
- Nunca publique arquivos `.env` reais.
- Troque `JWT_SECRET` se houver suspeita de vazamento.
- Mantenha a SQL IDE desligada quando nao estiver em uso.
