const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'gastos.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS gastos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    responsavel TEXT,
    tipo TEXT,
    descricao TEXT,
    parcela TEXT,
    tp_despesa TEXT,
    categoria TEXT,
    forma_pgto TEXT,
    valor_total REAL,
    valor_individual REAL,
    data_venc TEXT,
    mes TEXT,
    ano INTEGER,
    status TEXT DEFAULT 'PENDENTE',
    obs TEXT
  );

  CREATE TABLE IF NOT EXISTS MDR_LOOKUP (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    LOOKUP_TYPE VARCHAR(30),
    LOOKUP_CODE VARCHAR(30),
    MEANING VARCHAR(80),
    DESCRIPTION VARCHAR(240),
    TAG VARCHAR(150),
    ENABLED_FLAG VARCHAR(1) DEFAULT 'S',
    ATTRIBUTE1 VARCHAR(150),
    ATTRIBUTE2 VARCHAR(150),
    ATTRIBUTE3 VARCHAR(150),
    CRIADO_POR_LOGIN VARCHAR(255),
    ATUALIZADO_POR_LOGIN VARCHAR(255),
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha TEXT NOT NULL,
    perfil TEXT DEFAULT 'USER',
    ativo INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);

module.exports = db;