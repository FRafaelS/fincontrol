const { Pool } = require('pg');
const {
  TELAS_PADRAO_ADMIN,
  TELAS_PADRAO_SUPER_ADMIN,
  TELAS_PADRAO_USUARIO,
} = require('../config/telas');
const { tenant: tenantConfig } = require('../config/env');
const {
  garantirLookupsPadrao,
  garantirTenantPadrao,
  limparLookupsExemploOutrasContas,
} = require('../services/tenants');

const isProduction = process.env.NODE_ENV === 'production';
const sslEnabled = process.env.DB_SSL === 'true' || (isProduction && process.env.DB_SSL !== 'false');
const sslRejectUnauthorized = ['1', 'true', 's', 'sim', 'yes'].includes(
  String(process.env.DB_SSL_REJECT_UNAUTHORIZED || '').toLowerCase()
);

const connectionOptions = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    };

const pool = new Pool({
  ...connectionOptions,
  ssl: sslEnabled ? { rejectUnauthorized: sslRejectUnauthorized } : false,
});

const query = (text, params) => pool.query(text, params);

const inicializar = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      slug TEXT UNIQUE,
      descricao TEXT,
      ativo INTEGER DEFAULT 1,
      owner_usuario_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE tenants ADD COLUMN IF NOT EXISTS slug TEXT;
    ALTER TABLE tenants ADD COLUMN IF NOT EXISTS descricao TEXT;
    ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ativo INTEGER DEFAULT 1;
    ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_usuario_id INTEGER;
    ALTER TABLE tenants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug_unique ON tenants(slug);

    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id),
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha TEXT NOT NULL,
      perfil TEXT DEFAULT 'USER',
      ativo INTEGER DEFAULT 1,
      senha_temporaria INTEGER DEFAULT 0,
      ultimo_login TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS senha_temporaria INTEGER DEFAULT 0;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_login TIMESTAMP;

    CREATE TABLE IF NOT EXISTS grupos (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id),
      nome TEXT NOT NULL,
      descricao TEXT,
      criado_por INTEGER REFERENCES usuarios(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE grupos ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);

    CREATE TABLE IF NOT EXISTS usuario_grupos (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id),
      usuario_id INTEGER REFERENCES usuarios(id),
      grupo_id INTEGER REFERENCES grupos(id),
      permissao TEXT DEFAULT 'MEMBRO',
      pode_ver_todos INTEGER DEFAULT 0,
      pode_editar INTEGER DEFAULT 0,
      pode_excluir INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(usuario_id, grupo_id)
    );

    ALTER TABLE usuario_grupos ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);

    CREATE TABLE IF NOT EXISTS usuario_telas (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id),
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
      tela TEXT NOT NULL,
      pode_acessar INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(usuario_id, tela)
    );

    ALTER TABLE usuario_telas ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);

    CREATE TABLE IF NOT EXISTS gastos (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id),
      usuario_id INTEGER REFERENCES usuarios(id),
      grupo_id INTEGER REFERENCES grupos(id),
      responsavel TEXT,
      tipo TEXT,
      periodo TEXT,
      descricao TEXT,
      parcela TEXT,
      tp_despesa TEXT,
      categoria TEXT,
      forma_pgto TEXT,
      valor_total NUMERIC(15,2),
      valor_individual NUMERIC(15,2),
      data_venc TEXT,
      mes TEXT,
      ano INTEGER,
      data_pgto TEXT,
      status TEXT DEFAULT 'PENDENTE',
      obs TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE gastos ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
    ALTER TABLE gastos ADD COLUMN IF NOT EXISTS grupo_id INTEGER REFERENCES grupos(id);
    ALTER TABLE gastos ADD COLUMN IF NOT EXISTS periodo TEXT;
    ALTER TABLE gastos ADD COLUMN IF NOT EXISTS data_pgto TEXT;

    CREATE TABLE IF NOT EXISTS receitas (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id),
      usuario_id INTEGER REFERENCES usuarios(id),
      grupo_id INTEGER REFERENCES grupos(id),
      responsavel TEXT,
      descricao TEXT,
      valor NUMERIC(15,2),
      data_receita TEXT,
      mes TEXT,
      ano INTEGER,
      tipo_recebimento TEXT,
      obs TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE receitas ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
    ALTER TABLE receitas ADD COLUMN IF NOT EXISTS grupo_id INTEGER REFERENCES grupos(id);

    CREATE TABLE IF NOT EXISTS mdr_lookup (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id),
      lookup_type VARCHAR(30),
      lookup_code VARCHAR(30),
      meaning VARCHAR(80),
      description VARCHAR(240),
      tag VARCHAR(150),
      enabled_flag VARCHAR(1) DEFAULT 'S',
      attribute1 VARCHAR(150),
      attribute2 VARCHAR(150),
      attribute3 VARCHAR(150),
      criado_por_login VARCHAR(255),
      atualizado_por_login VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE mdr_lookup ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);

    CREATE INDEX IF NOT EXISTS idx_tenants_ativo ON tenants(ativo);
    CREATE INDEX IF NOT EXISTS idx_usuarios_tenant ON usuarios(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_usuario_telas_usuario ON usuario_telas(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_usuario_telas_tenant ON usuario_telas(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_usuario_grupos_usuario ON usuario_grupos(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_usuario_grupos_grupo ON usuario_grupos(grupo_id);
    CREATE INDEX IF NOT EXISTS idx_usuario_grupos_tenant ON usuario_grupos(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_gastos_usuario ON gastos(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_gastos_grupo ON gastos(grupo_id);
    CREATE INDEX IF NOT EXISTS idx_gastos_tenant ON gastos(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_gastos_periodo ON gastos(ano, mes);
    CREATE INDEX IF NOT EXISTS idx_gastos_status ON gastos(status);
    CREATE INDEX IF NOT EXISTS idx_receitas_usuario ON receitas(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_receitas_grupo ON receitas(grupo_id);
    CREATE INDEX IF NOT EXISTS idx_receitas_tenant ON receitas(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_receitas_periodo ON receitas(ano, mes);
    CREATE INDEX IF NOT EXISTS idx_mdr_lookup_tipo_codigo ON mdr_lookup(lookup_type, lookup_code);
    CREATE INDEX IF NOT EXISTS idx_mdr_lookup_tenant_tipo_codigo ON mdr_lookup(tenant_id, lookup_type, lookup_code);
  `);

  const tenantPadrao = await garantirTenantPadrao(pool, tenantConfig);
  const tenantPadraoId = tenantPadrao?.id;

  if (tenantPadraoId) {
    await pool.query('UPDATE usuarios SET tenant_id = $1 WHERE tenant_id IS NULL', [tenantPadraoId]);
    await pool.query(
      `UPDATE grupos
       SET tenant_id = COALESCE((SELECT tenant_id FROM usuarios WHERE usuarios.id = grupos.criado_por), $1)
       WHERE tenant_id IS NULL`,
      [tenantPadraoId]
    );
    await pool.query(
      `UPDATE usuario_grupos
       SET tenant_id = COALESCE(
         (SELECT tenant_id FROM grupos WHERE grupos.id = usuario_grupos.grupo_id),
         (SELECT tenant_id FROM usuarios WHERE usuarios.id = usuario_grupos.usuario_id),
         $1
       )
       WHERE tenant_id IS NULL`,
      [tenantPadraoId]
    );
    await pool.query(
      `UPDATE usuario_telas
       SET tenant_id = COALESCE((SELECT tenant_id FROM usuarios WHERE usuarios.id = usuario_telas.usuario_id), $1)
       WHERE tenant_id IS NULL`,
      [tenantPadraoId]
    );
    await pool.query(
      `UPDATE gastos
       SET tenant_id = COALESCE(
         (SELECT tenant_id FROM grupos WHERE grupos.id = gastos.grupo_id),
         (SELECT tenant_id FROM usuarios WHERE usuarios.id = gastos.usuario_id),
         $1
       )
       WHERE tenant_id IS NULL`,
      [tenantPadraoId]
    );
    await pool.query(
      `UPDATE receitas
       SET tenant_id = COALESCE(
         (SELECT tenant_id FROM grupos WHERE grupos.id = receitas.grupo_id),
         (SELECT tenant_id FROM usuarios WHERE usuarios.id = receitas.usuario_id),
         $1
       )
       WHERE tenant_id IS NULL`,
      [tenantPadraoId]
    );
    await pool.query('UPDATE mdr_lookup SET tenant_id = $1 WHERE tenant_id IS NULL', [tenantPadraoId]);
    await garantirLookupsPadrao(pool, tenantPadraoId, { incluirExemplos: true });
    await limparLookupsExemploOutrasContas(pool, tenantPadraoId);
  }

  for (const tela of TELAS_PADRAO_SUPER_ADMIN) {
    await pool.query(
      `INSERT INTO usuario_telas (tenant_id, usuario_id, tela, pode_acessar)
       SELECT tenant_id, id, $1, 1 FROM usuarios WHERE perfil = 'SUPER_ADMIN'
       ON CONFLICT (usuario_id, tela) DO NOTHING`,
      [tela]
    );
  }

  for (const tela of TELAS_PADRAO_ADMIN) {
    await pool.query(
      `INSERT INTO usuario_telas (tenant_id, usuario_id, tela, pode_acessar)
       SELECT tenant_id, id, $1, 1 FROM usuarios WHERE perfil = 'ADMIN'
       ON CONFLICT (usuario_id, tela) DO NOTHING`,
      [tela]
    );
  }

  for (const tela of TELAS_PADRAO_USUARIO) {
    await pool.query(
      `INSERT INTO usuario_telas (tenant_id, usuario_id, tela, pode_acessar)
       SELECT tenant_id, id, $1, 1 FROM usuarios WHERE perfil NOT IN ('ADMIN', 'SUPER_ADMIN')
       ON CONFLICT (usuario_id, tela) DO NOTHING`,
      [tela]
    );
  }

  await pool.query(
    `UPDATE usuario_telas
     SET pode_acessar = 1, updated_at = NOW()
     WHERE tela = ANY($1::text[])
       AND usuario_id IN (SELECT id FROM usuarios WHERE perfil = 'ADMIN')`,
    [TELAS_PADRAO_ADMIN]
  );

  await pool.query(
    `UPDATE usuario_telas
     SET pode_acessar = 1, updated_at = NOW()
     WHERE tela = ANY($1::text[])
       AND usuario_id IN (SELECT id FROM usuarios WHERE perfil = 'SUPER_ADMIN')`,
    [TELAS_PADRAO_SUPER_ADMIN]
  );

  console.log('Banco PostgreSQL inicializado!');
};

module.exports = { query, inicializar, pool };
