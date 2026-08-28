require('dotenv').config();

const express = require('express');
const cors = require('cors');
const {
  admin,
  adminSql,
  corsOptions,
  setupRouteEnabled,
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
const { autenticar, apenasAdmin, exigirSenhaDefinitiva, exigirTela, exigirAlgumaTela } = require('./middleware/auth');
const { TELAS_PADRAO_ADMIN } = require('./config/telas');

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
if (adminSql.enabled) {
  app.use('/api/admin-sql', autenticar, exigirSenhaDefinitiva, apenasAdmin, exigirTela('sql'), adminSqlRoutes);
} else {
  app.use('/api/admin-sql', autenticar, exigirSenhaDefinitiva, apenasAdmin, (req, res) => {
    res.status(403).json({ erro: 'SQL IDE desativada neste ambiente.' });
  });
}

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
    // Insere lookups padrão
    const lookups = [
      ['LOOKUP TYPE', 'CATEGORIA', 'Categoria de gasto', 'S'],
      ['LOOKUP TYPE', 'FORMA_PGTO', 'Forma de pagamento', 'S'],
      ['LOOKUP TYPE', 'RESPONSAVEL', 'Responsável pelo gasto', 'S'],
      ['LOOKUP TYPE', 'STATUS_GASTO', 'Status do gasto', 'S'],
      ['LOOKUP TYPE', 'TIPO_GASTO', 'Tipo do gasto', 'S'],
      ['LOOKUP TYPE', 'CONFIG_ALERTAS', 'Configurações de alertas', 'S'],
      ['LOOKUP TYPE', 'DIVISAO_COMUM', 'Divisão comum', 'S'],
      ['CATEGORIA', 'ELETRONICOS', 'Eletrônicos', 'S'],
      ['CATEGORIA', 'SERVICOS', 'Serviços', 'S'],
      ['CATEGORIA', 'TRANSPORTE', 'Transporte', 'S'],
      ['CATEGORIA', 'ALIMENTACAO', 'Alimentação', 'S'],
      ['CATEGORIA', 'SAUDE', 'Saúde', 'S'],
      ['CATEGORIA', 'EDUCACAO', 'Educação', 'S'],
      ['CATEGORIA', 'LAZER', 'Lazer', 'S'],
      ['CATEGORIA', 'OUTROS', 'Outros', 'S'],
      ['FORMA_PGTO', 'CARTAO_BRADESCO', 'Cartão Bradesco', 'S'],
      ['FORMA_PGTO', 'CARTAO_NUBANK', 'Cartão Nubank', 'S'],
      ['FORMA_PGTO', 'PIX', 'Pix', 'S'],
      ['FORMA_PGTO', 'DINHEIRO', 'Dinheiro', 'S'],
      ['FORMA_PGTO', 'DEBITO', 'Débito', 'S'],
      ['RESPONSAVEL', 'Rafael Silva', 'R', 'S', '1'],
      ['RESPONSAVEL', 'Diana Paula', 'D', 'S', '1'],
      ['RESPONSAVEL', 'Rafael e Diana', 'RD', 'S', '2'],
      ['STATUS_GASTO', 'Pendente', 'PENDENTE', 'S'],
      ['STATUS_GASTO', 'Pago', 'PAGO', 'S'],
      ['TIPO_GASTO', 'Individual', 'I', 'S'],
      ['TIPO_GASTO', 'Compartilhado', 'C', 'S'],
      ['CONFIG_ALERTAS', 'DIAS_ALERTA_VENCIMENTO', 'Dias de antecedência', 'S', '7'],
      ['DIVISAO_COMUM', 'PADRAO', 'Divisão padrão', 'S', '2'],
    ];

    for (const [type, code, meaning, flag, tag = ''] of lookups) {
      await query(
        `INSERT INTO mdr_lookup (lookup_type, lookup_code, meaning, enabled_flag, tag)
         SELECT $1, $2, $3, $4, $5
         WHERE NOT EXISTS (
           SELECT 1 FROM mdr_lookup WHERE lookup_type = $1 AND lookup_code = $2
         )`,
        [type, code, meaning, flag, tag]
      );
      if (tag) {
        await query(
          `UPDATE mdr_lookup
           SET tag = $3
           WHERE lookup_type = $1 AND lookup_code = $2 AND (tag IS NULL OR tag = '')`,
          [type, code, tag]
        );
      }
    }

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
  const hash = bcrypt.hashSync(admin.senhaInicial, 10);
  const senhaTemporaria = admin.forcarTrocaSenha ? 1 : 0;
  const result = await query(
    `INSERT INTO usuarios (nome, email, senha, perfil, ativo, senha_temporaria)
     VALUES ($1, $2, $3, 'ADMIN', 1, $4)
     ON CONFLICT (email)
     DO UPDATE SET perfil = 'ADMIN', ativo = 1, updated_at = NOW()
     RETURNING id, senha, senha_temporaria`,
    [admin.nome, admin.email, hash, senhaTemporaria]
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

  for (const tela of TELAS_PADRAO_ADMIN) {
    await query(
      `INSERT INTO usuario_telas (usuario_id, tela, pode_acessar)
       VALUES ($1, $2, 1)
       ON CONFLICT (usuario_id, tela)
       DO UPDATE SET pode_acessar = 1, updated_at = NOW()`,
      [usuarioId, tela]
    );
  }

  let grupo = await query(
    'SELECT id FROM grupos WHERE nome = $1 AND criado_por = $2 ORDER BY id LIMIT 1',
    ['Família Raphael', usuarioId]
  );
  if (!grupo.rows[0]) {
    grupo = await query(
      'INSERT INTO grupos (nome, descricao, criado_por) VALUES ($1, $2, $3) RETURNING id',
      ['Família Raphael', 'Dados financeiros compartilhados', usuarioId]
    );
  }

  await query(
    `INSERT INTO usuario_grupos (usuario_id, grupo_id, permissao, pode_ver_todos, pode_editar, pode_excluir)
     VALUES ($1, $2, 'ADMIN', 1, 1, 1)
     ON CONFLICT (usuario_id, grupo_id)
     DO UPDATE SET permissao = 'ADMIN', pode_ver_todos = 1, pode_editar = 1, pode_excluir = 1`,
    [usuarioId, grupo.rows[0].id]
  );

  await query(
    'UPDATE gastos SET grupo_id = $1 WHERE usuario_id = $2 AND grupo_id IS NULL',
    [grupo.rows[0].id, usuarioId]
  );
  await query(
    'UPDATE receitas SET grupo_id = $1 WHERE usuario_id = $2 AND grupo_id IS NULL',
    [grupo.rows[0].id, usuarioId]
  );
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
