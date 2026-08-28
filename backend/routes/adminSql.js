const express = require('express');
const router = express.Router();
const { pool } = require('../database/postgres');
const { adminSql } = require('../config/env');

const MAX_ROWS = adminSql.maxRows;
const COMANDOS_PERMITIDOS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

const limparSql = (valor) => {
  const sql = String(valor || '').trim();
  if (!sql) return '';
  return sql.endsWith(';') ? sql.slice(0, -1).trim() : sql;
};

const sqlSemComentariosIniciais = (sql) =>
  sql.replace(/^(\s*(--[^\n]*(\n|$)|\/\*[\s\S]*?\*\/))*\s*/, '');

const obterComando = (sql) => {
  const match = sqlSemComentariosIniciais(sql).match(/^([a-z]+)/i);
  return match ? match[1].toUpperCase() : '';
};

const validarSql = (sql, confirmarEscrita) => {
  if (!sql) return 'Informe um comando SQL.';
  if (sql.includes(';')) return 'Execute apenas um comando por vez.';

  const comando = obterComando(sql);
  if (!COMANDOS_PERMITIDOS.includes(comando)) {
    return 'Comando permitido: SELECT, INSERT, UPDATE ou DELETE.';
  }
  if (comando !== 'SELECT' && !adminSql.writeEnabled) {
    return 'Comandos de escrita estão desativados neste ambiente.';
  }
  if (comando !== 'SELECT' && confirmarEscrita !== true) {
    return 'Confirme a execução para comandos que alteram dados.';
  }
  return '';
};

router.get('/tabelas', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    );
    res.json(result.rows.map((row) => row.table_name));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.get('/tabelas/:nome/colunas', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [req.params.nome]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.post('/executar', async (req, res) => {
  const sql = limparSql(req.body?.sql);
  const confirmarEscrita = req.body?.confirmarEscrita === true;
  const erroValidacao = validarSql(sql, confirmarEscrita);

  if (erroValidacao) return res.status(400).json({ erro: erroValidacao });

  const client = await pool.connect();
  const inicio = Date.now();

  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL statement_timeout = ${adminSql.statementTimeoutMs}`);
    const result = await client.query(sql);
    await client.query('COMMIT');

    const rows = result.rows || [];
    res.json({
      comando: result.command || obterComando(sql),
      rowCount: result.rowCount ?? rows.length,
      campos: (result.fields || []).map((field) => field.name),
      rows: rows.slice(0, MAX_ROWS),
      totalRows: rows.length,
      truncado: rows.length > MAX_ROWS,
      tempoMs: Date.now() - inicio,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(400).json({ erro: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
