require('dotenv').config();

const express = require('express');
const cors = require('cors');
const {
  admin,
  corsOptions,
  setupRouteEnabled,
  tenant,
  validarAmbiente,
} = require('./config/env');

validarAmbiente();

const { inicializar, query, pool } = require('./database/postgres');
const gastosRoutes = require('./routes/gastos');
const receitasRoutes = require('./routes/receitas');
const lookupsRoutes = require('./routes/lookups');
const parcelasRoutes = require('./routes/parcelas');
const authRoutes = require('./routes/auth');
const gruposRoutes = require('./routes/grupos');
const adminSqlRoutes = require('./routes/adminSql');
const tenantsRoutes = require('./routes/tenants');
const { autenticar, apenasSuperAdmin, exigirSenhaDefinitiva, exigirTela, exigirAlgumaTela } = require('./middleware/auth');
const { TELAS_PADRAO_SUPER_ADMIN } = require('./config/telas');
const {
  garantirLookupsPadrao,
  garantirTenantPadrao,
  limparLookupsExemploOutrasContas,
} = require('./services/tenants');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors(corsOptions));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/gastos',   autenticar, exigirSenhaDefinitiva, exigirAlgumaTela(['dashboard', 'gastos', 'relatorios', 'metas', 'importacao']), gastosRoutes);
app.use('/api/receitas', autenticar, exigirSenhaDefinitiva, exigirAlgumaTela(['dashboard', 'receitas']), receitasRoutes);
app.use('/api/lookups',  autenticar, exigirSenhaDefinitiva, lookupsRoutes);
app.use('/api/parcelas', autenticar, exigirSenhaDefinitiva, exigirTela('parcelas'), parcelasRoutes);
app.use('/api/grupos',   autenticar, exigirSenhaDefinitiva, gruposRoutes);
app.use('/api/tenants',  autenticar, exigirSenhaDefinitiva, apenasSuperAdmin, tenantsRoutes);
app.use('/api/admin-sql', autenticar, exigirSenhaDefinitiva, apenasSuperAdmin, adminSqlRoutes);

app.get('/', (req, res) => res.json({ mensagem: 'API FinControl funcionando!', versao: '2.0' }));
app.get('/health', (req, res) => res.json({ status: 'ok', app: 'FinControl', uptime: Math.round(process.uptime()) }));
app.get('/ready', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});

const setupHandler = async (req, res) => {
  try {
    const tenantPadrao = await garantirTenantPadrao(pool, tenant);
    await garantirLookupsPadrao(pool, tenantPadrao.id, { incluirExemplos: true });
    await limparLookupsExemploOutrasContas(pool, tenantPadrao.id);

    await garantirAdminPadrao();

    res.json({ mensagem: 'Setup concluído! Admin, permissões e lookups criados.' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
};

if (setupRouteEnabled) {
  app.get('/setup', setupHandler);
} else {
  app.get('/setup', (req, res) => res.status(404).json({ erro: 'Setup desativado neste ambiente.' }));
}

const garantirAdminPadrao = async () => {
  const bcrypt = require('bcryptjs');
  const tenantPadrao = await garantirTenantPadrao(pool, tenant);
  const tenantPadraoId = tenantPadrao.id;
  const hash = bcrypt.hashSync(admin.senhaInicial, 10);
  const senhaTemporaria = admin.forcarTrocaSenha ? 1 : 0;
  const result = await query(
    `INSERT INTO usuarios (tenant_id, nome, email, senha, perfil, ativo, senha_temporaria)
     VALUES ($1, $2, $3, $4, 'SUPER_ADMIN', 1, $5)
     ON CONFLICT (email)
     DO UPDATE SET
       perfil = 'SUPER_ADMIN',
       tenant_id = COALESCE(usuarios.tenant_id, EXCLUDED.tenant_id),
       ativo = 1,
       updated_at = NOW()
     RETURNING id, tenant_id, senha, senha_temporaria`,
    [tenantPadraoId, admin.nome, admin.email, hash, senhaTemporaria]
  );
  const usuarioAdmin = result.rows[0] || {};
  const usuarioId = usuarioAdmin.id;
  if (!usuarioId) return;

  if (
    admin.forcarTrocaSenha &&
    usuarioAdmin.senha &&
    bcrypt.compareSync(admin.senhaInicial, usuarioAdmin.senha) &&
    Number(usuarioAdmin.senha_temporaria) !== 1
  ) {
    await query('UPDATE usuarios SET senha_temporaria = 1, updated_at = NOW() WHERE id = $1', [usuarioId]);
  }

  for (const tela of TELAS_PADRAO_SUPER_ADMIN) {
    await query(
      `INSERT INTO usuario_telas (tenant_id, usuario_id, tela, pode_acessar)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (usuario_id, tela)
       DO UPDATE SET pode_acessar = 1, updated_at = NOW()`,
      [usuarioAdmin.tenant_id || tenantPadraoId, usuarioId, tela]
    );
  }

  let grupo = await query(
    'SELECT id FROM grupos WHERE nome = $1 AND criado_por = $2 AND tenant_id = $3 ORDER BY id LIMIT 1',
    ['Familia Raphael', usuarioId, usuarioAdmin.tenant_id || tenantPadraoId]
  );
  if (!grupo.rows[0]) {
    grupo = await query(
      'INSERT INTO grupos (tenant_id, nome, descricao, criado_por) VALUES ($1, $2, $3, $4) RETURNING id',
      [usuarioAdmin.tenant_id || tenantPadraoId, 'Familia Raphael', 'Dados financeiros compartilhados', usuarioId]
    );
  }

  await query(
    `INSERT INTO usuario_grupos (tenant_id, usuario_id, grupo_id, permissao, pode_ver_todos, pode_editar, pode_excluir)
     VALUES ($1, $2, $3, 'ADMIN', 1, 1, 1)
     ON CONFLICT (usuario_id, grupo_id)
     DO UPDATE SET permissao = 'ADMIN', pode_ver_todos = 1, pode_editar = 1, pode_excluir = 1`,
    [usuarioAdmin.tenant_id || tenantPadraoId, usuarioId, grupo.rows[0].id]
  );

  await query(
    'UPDATE gastos SET tenant_id = $1, grupo_id = $2 WHERE usuario_id = $3 AND grupo_id IS NULL',
    [usuarioAdmin.tenant_id || tenantPadraoId, grupo.rows[0].id, usuarioId]
  );
  await query(
    'UPDATE receitas SET tenant_id = $1, grupo_id = $2 WHERE usuario_id = $3 AND grupo_id IS NULL',
    [usuarioAdmin.tenant_id || tenantPadraoId, grupo.rows[0].id, usuarioId]
  );
  await garantirLookupsPadrao(pool, usuarioAdmin.tenant_id || tenantPadraoId, { incluirExemplos: true });
};

const iniciar = async () => {
  await inicializar();
  await garantirAdminPadrao();
  const server = app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

  const encerrar = async (signal) => {
    console.log(`${signal} recebido. Encerrando servidor...`);
    server.close(async () => {
      await pool.end().catch(() => {});
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => encerrar('SIGTERM'));
  process.on('SIGINT', () => encerrar('SIGINT'));
};

iniciar().catch(err => {
  console.error('Erro ao inicializar banco:', err);
  process.exit(1);
});
