const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Listar todos os gastos
router.get('/', (req, res) => {
  const gastos = db.prepare('SELECT * FROM gastos').all();
  res.json(gastos);
});

// Buscar um gasto por ID
router.get('/:id', (req, res) => {
  const gasto = db.prepare('SELECT * FROM gastos WHERE id = ?').get(req.params.id);
  if (!gasto) return res.status(404).json({ erro: 'Gasto não encontrado' });
  res.json(gasto);
});

// Criar novo gasto
router.post('/', (req, res) => {
  const {
    responsavel, tipo, descricao, parcela, tp_despesa,
    categoria, forma_pgto, valor_total, valor_individual,
    data_venc, mes, ano, status, obs
  } = req.body;

  const result = db.prepare(`
    INSERT INTO gastos (
      responsavel, tipo, descricao, parcela, tp_despesa,
      categoria, forma_pgto, valor_total, valor_individual,
      data_venc, mes, ano, status, obs
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    responsavel, tipo, descricao, parcela, tp_despesa,
    categoria, forma_pgto, valor_total, valor_individual,
    data_venc, mes, ano, status || 'PENDENTE', obs
  );

  res.status(201).json({ id: result.lastInsertRowid });
});

// Editar gasto
router.put('/:id', (req, res) => {
  const {
    responsavel, tipo, descricao, parcela, tp_despesa,
    categoria, forma_pgto, valor_total, valor_individual,
    data_venc, mes, ano, status, obs
  } = req.body;

  db.prepare(`
    UPDATE gastos SET
      responsavel = ?, tipo = ?, descricao = ?, parcela = ?,
      tp_despesa = ?, categoria = ?, forma_pgto = ?,
      valor_total = ?, valor_individual = ?, data_venc = ?,
      mes = ?, ano = ?, status = ?, obs = ?
    WHERE id = ?
  `).run(
    responsavel, tipo, descricao, parcela, tp_despesa,
    categoria, forma_pgto, valor_total, valor_individual,
    data_venc, mes, ano, status, obs, req.params.id
  );

  res.json({ sucesso: true });
});

// Deletar gasto
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM gastos WHERE id = ?').run(req.params.id);
  res.json({ sucesso: true });
});

module.exports = router;