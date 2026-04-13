const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const query = (text, params) => pool.query(text, params);

const inicializar = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha TEXT NOT NULL,
      perfil TEXT DEFAULT 'USER',
      ativo INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS grupos (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT,
      criado_por INTEGER REFERENCES usuarios(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS usuario_grupos (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER REFERENCES usuarios(id),
      grupo_id INTEGER REFERENCES grupos(id),
      permissao TEXT DEFAULT 'MEMBRO',
      pode_ver_todos INTEGER DEFAULT 0,
      pode_editar INTEGER DEFAULT 0,
      pode_excluir INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(usuario_id, grupo_id)
    );

    CREATE TABLE IF NOT EXISTS gastos (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER REFERENCES usuarios(id),
      grupo_id INTEGER REFERENCES grupos(id),
      responsavel TEXT,
      tipo TEXT,
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
      status TEXT DEFAULT 'PENDENTE',
      obs TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS mdr_lookup (
      id SERIAL PRIMARY KEY,
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
  `);
  console.log('Banco PostgreSQL inicializado!');
};

module.exports = { query, inicializar, pool };