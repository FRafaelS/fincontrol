const express = require('express');
const router = express.Router();
const { query } = require('../database/postgres');

router.get('/tipos', async (req, res) => {
  try {
    const result = await query(
      "SELECT * FROM mdr_lookup WHERE lookup_type = 'LOOKUP TYPE' AND enabled_flag = 'S' ORDER BY meaning"
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/valores/:tipo', async (req, res) => {
  try {
    const result = await query(
      "SELECT * FROM mdr_lookup WHERE lookup_type = $1 AND enabled_flag = 'S' ORDER BY meaning",
      [req.params.tipo]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM mdr_lookup ORDER BY lookup_type, meaning');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM mdr_lookup WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ erro: 'Lookup não encontrado' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/', async (req, res) => {
  const { LOOKUP_TYPE, LOOKUP_CODE, MEANING, DESCRIPTION, TAG, ENABLED_FLAG,
    ATTRIBUTE1, ATTRIBUTE2, ATTRIBUTE3, CRIADO_POR_LOGIN } = req.body;
  try {
    if (LOOKUP_TYPE !== 'LOOKUP TYPE') {
      const pai = await query(
        "SELECT id FROM mdr_lookup WHERE lookup_type = 'LOOKUP TYPE' AND lookup_code = $1 AND enabled_flag = 'S'",
        [LOOKUP_TYPE]
      );
      if (pai.rows.length === 0)
        return res.status(400).json({ erro: `O tipo "${LOOKUP_TYPE}" não existe. Cadastre-o primeiro na aba Geral.` });
    }
    const result = await query(
      `INSERT INTO mdr_lookup (lookup_type, lookup_code, meaning, description, tag, enabled_flag,
        attribute1, attribute2, attribute3, criado_por_login)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [LOOKUP_TYPE, LOOKUP_CODE, MEANING, DESCRIPTION, TAG, ENABLED_FLAG || 'S',
       ATTRIBUTE1, ATTRIBUTE2, ATTRIBUTE3, CRIADO_POR_LOGIN]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.put('/:id', async (req, res) => {
  const { LOOKUP_TYPE, LOOKUP_CODE, MEANING, DESCRIPTION, TAG, ENABLED_FLAG,
    ATTRIBUTE1, ATTRIBUTE2, ATTRIBUTE3, ATUALIZADO_POR_LOGIN } = req.body;
  try {
    await query(
      `UPDATE mdr_lookup SET lookup_type=$1, lookup_code=$2, meaning=$3, description=$4,
        tag=$5, enabled_flag=$6, attribute1=$7, attribute2=$8, attribute3=$9,
        atualizado_por_login=$10, updated_at=NOW() WHERE id=$11`,
      [LOOKUP_TYPE, LOOKUP_CODE, MEANING, DESCRIPTION, TAG, ENABLED_FLAG,
       ATTRIBUTE1, ATTRIBUTE2, ATTRIBUTE3, ATUALIZADO_POR_LOGIN, req.params.id]
    );
    res.json({ sucesso: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const lookup = await query('SELECT * FROM mdr_lookup WHERE id = $1', [req.params.id]);
    if (lookup.rows[0]?.lookup_type === 'LOOKUP TYPE') {
      const filhos = await query('SELECT COUNT(*) as total FROM mdr_lookup WHERE lookup_type = $1', [lookup.rows[0].lookup_code]);
      if (parseInt(filhos.rows[0].total) > 0)
        return res.status(400).json({ erro: `Não é possível excluir. Existem ${filhos.rows[0].total} valor(es) cadastrado(s).` });
    }
    await query('DELETE FROM mdr_lookup WHERE id = $1', [req.params.id]);
    res.json({ sucesso: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;