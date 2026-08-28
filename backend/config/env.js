const isProduction = process.env.NODE_ENV === 'production';

const DEV_JWT_SECRET = 'fincontrol_dev_secret_2026';
const JWT_SECRET = process.env.JWT_SECRET || (isProduction ? '' : DEV_JWT_SECRET);

const parseLista = (valor) =>
  String(valor || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const corsOrigins = parseLista(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN);
const temDatabaseUrl = Boolean(process.env.DATABASE_URL);
const temConfigDbSeparada = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'].every((nome) =>
  Boolean(process.env[nome])
);

const validarAmbiente = () => {
  const erros = [];

  if (!temDatabaseUrl && !temConfigDbSeparada) {
    erros.push('Configure DATABASE_URL ou DB_HOST, DB_NAME, DB_USER e DB_PASSWORD.');
  }

  if (isProduction) {
    if (!JWT_SECRET || JWT_SECRET === DEV_JWT_SECRET || JWT_SECRET.length < 32) {
      erros.push('Configure JWT_SECRET de produção com ao menos 32 caracteres.');
    }

    if (corsOrigins.length === 0 || corsOrigins.includes('*')) {
      erros.push('Configure CORS_ORIGINS com o(s) domínio(s) do frontend em produção.');
    }
  }

  if (erros.length > 0) {
    throw new Error(`Configuração inválida: ${erros.join(' ')}`);
  }
};

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (!isProduction && corsOrigins.length === 0) return callback(null, true);
    if (corsOrigins.includes('*') || corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origem não permitida pelo CORS.'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const boolEnv = (nome, padrao = false) => {
  const valor = process.env[nome];
  if (valor === undefined || valor === '') return padrao;
  return ['1', 'true', 's', 'sim', 'yes'].includes(String(valor).toLowerCase());
};

const intEnv = (nome, padrao) => {
  const valor = parseInt(process.env[nome], 10);
  return Number.isFinite(valor) ? valor : padrao;
};

module.exports = {
  isProduction,
  JWT_SECRET,
  corsOptions,
  validarAmbiente,
  admin: {
    nome: process.env.ADMIN_NAME || 'Raphael Administrador',
    email: process.env.ADMIN_EMAIL || 'ps.raphael@hotmail.com',
    senhaInicial: process.env.ADMIN_INITIAL_PASSWORD || 'admin123',
    forcarTrocaSenha: boolEnv('ADMIN_FORCE_PASSWORD_CHANGE', true),
  },
  adminSql: {
    enabled: boolEnv('ENABLE_ADMIN_SQL', !isProduction),
    writeEnabled: boolEnv('ENABLE_ADMIN_SQL_WRITE', !isProduction),
    maxRows: Math.min(Math.max(intEnv('ADMIN_SQL_MAX_ROWS', 1000), 1), 5000),
    statementTimeoutMs: Math.min(Math.max(intEnv('ADMIN_SQL_TIMEOUT_MS', 15000), 1000), 60000),
  },
  setupRouteEnabled: boolEnv('ENABLE_SETUP_ROUTE', !isProduction),
};
