const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Listar todos os tipos (pais) cadastrados
router.get('/tipos', (req, res) => {
  const tipos = db.prepare(`
    SELECT * FROM MDR_LOOKUP
    WHERE LOOKUP_TYPE = 'LOOKUP TYPE'
    AND ENABLED_FLAG = 'S'
    ORDER BY MEANING
  `).all();
  res.json(tipos);
});

// Listar valores de um tipo específico (filhos)
router.get('/valores/:tipo', (req, res) => {
  const valores = db.prepare(`
    SELECT * FROM MDR_LOOKUP
    WHERE LOOKUP_TYPE = ?
    AND ENABLED_FLAG = 'S'
    ORDER BY MEANING
  `).all(req.params.tipo);
  res.json(valores);
});

// Listar todos os lookups (para tela de gestão)
router.get('/', (req, res) => {
  const lookups = db.prepare(`
    SELECT * FROM MDR_LOOKUP
    ORDER BY LOOKUP_TYPE, MEANING
  `).all();
  res.json(lookups);
});

// Buscar um lookup por ID
router.get('/:id', (req, res) => {
  const lookup = db.prepare('SELECT * FROM MDR_LOOKUP WHERE ID = ?').get(req.params.id);
  if (!lookup) return res.status(404).json({ erro: 'Lookup não encontrado' });
  res.json(lookup);
});

// Criar novo lookup
router.post('/', (req, res) => {
  const {
    LOOKUP_TYPE, LOOKUP_CODE, MEANING, DESCRIPTION,
    TAG, ENABLED_FLAG, ATTRIBUTE1, ATTRIBUTE2, ATTRIBUTE3,
    CRIADO_POR_LOGIN,
  } = req.body;

  // RN003: se não for um tipo pai, verifica se o LOOKUP_TYPE pai existe
  if (LOOKUP_TYPE !== 'LOOKUP TYPE') {
    const pai = db.prepare(`
      SELECT ID FROM MDR_LOOKUP
      WHERE LOOKUP_TYPE = 'LOOKUP TYPE'
      AND LOOKUP_CODE = ?
      AND ENABLED_FLAG = 'S'
    `).get(LOOKUP_TYPE);

    if (!pai) {
      return res.status(400).json({
        erro: `O tipo "${LOOKUP_TYPE}" não existe. Cadastre-o primeiro na aba Geral.`
      });
    }
  }

  const result = db.prepare(`
    INSERT INTO MDR_LOOKUP (
      LOOKUP_TYPE, LOOKUP_CODE, MEANING, DESCRIPTION,
      TAG, ENABLED_FLAG, ATTRIBUTE1, ATTRIBUTE2, ATTRIBUTE3,
      CRIADO_POR_LOGIN, CREATED_AT, UPDATED_AT
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    LOOKUP_TYPE, LOOKUP_CODE, MEANING, DESCRIPTION,
    TAG, ENABLED_FLAG || 'S', ATTRIBUTE1, ATTRIBUTE2, ATTRIBUTE3,
    CRIADO_POR_LOGIN
  );

  res.status(201).json({ id: result.lastInsertRowid });
});

// Editar lookup
router.put('/:id', (req, res) => {
  const {
    LOOKUP_TYPE, LOOKUP_CODE, MEANING, DESCRIPTION,
    TAG, ENABLED_FLAG, ATTRIBUTE1, ATTRIBUTE2, ATTRIBUTE3,
    ATUALIZADO_POR_LOGIN,
  } = req.body;

  db.prepare(`
    UPDATE MDR_LOOKUP SET
      LOOKUP_TYPE = ?, LOOKUP_CODE = ?, MEANING = ?,
      DESCRIPTION = ?, TAG = ?, ENABLED_FLAG = ?,
      ATTRIBUTE1 = ?, ATTRIBUTE2 = ?, ATTRIBUTE3 = ?,
      ATUALIZADO_POR_LOGIN = ?, UPDATED_AT = CURRENT_TIMESTAMP
    WHERE ID = ?
  `).run(
    LOOKUP_TYPE, LOOKUP_CODE, MEANING, DESCRIPTION,
    TAG, ENABLED_FLAG, ATTRIBUTE1, ATTRIBUTE2, ATTRIBUTE3,
    ATUALIZADO_POR_LOGIN, req.params.id
  );

  res.json({ sucesso: true });
});

// Deletar lookup
router.delete('/:id', (req, res) => {
  // Verifica se é um pai com filhos
  const lookup = db.prepare('SELECT * FROM MDR_LOOKUP WHERE ID = ?').get(req.params.id);

  if (lookup && lookup.LOOKUP_TYPE === 'LOOKUP TYPE') {
    const filhos = db.prepare(`
      SELECT COUNT(*) as total FROM MDR_LOOKUP
      WHERE LOOKUP_TYPE = ?
    `).get(lookup.LOOKUP_CODE);

    if (filhos.total > 0) {
      return res.status(400).json({
        erro: `Não é possível excluir. Existem ${filhos.total} valor(es) cadastrado(s) para este tipo.`
      });
    }
  }

  db.prepare('DELETE FROM MDR_LOOKUP WHERE ID = ?').run(req.params.id);
  res.json({ sucesso: true });
});

module.exports = router;