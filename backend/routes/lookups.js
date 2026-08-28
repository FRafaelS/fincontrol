const express = require('express');
const router = express.Router();
const { query } = require('../database/postgres');
const { exigirTela } = require('../middleware/auth');

const exigirParametros = exigirTela('parametros');

const texto = (valor) => {
  if (valor === undefined || valor === null) return '';
  return String(valor).trim();
};

const normalizarPayload = (body) => ({
  LOOKUP_TYPE: texto(body.LOOKUP_TYPE ?? body.lookup_type),
  LOOKUP_CODE: texto(body.LOOKUP_CODE ?? body.lookup_code),
  MEANING: texto(body.MEANING ?? body.meaning),
  DESCRIPTION: texto(body.DESCRIPTION ?? body.description),
  TAG: texto(body.TAG ?? body.tag),
  ENABLED_FLAG: texto(body.ENABLED_FLAG ?? body.enabled_flag) || 'S',
  ATTRIBUTE1: texto(body.ATTRIBUTE1 ?? body.attribute1),
  ATTRIBUTE2: texto(body.ATTRIBUTE2 ?? body.attribute2),
  ATTRIBUTE3: texto(body.ATTRIBUTE3 ?? body.attribute3),
  CRIADO_POR_LOGIN: texto(body.CRIADO_POR_LOGIN ?? body.criado_por_login),
  ATUALIZADO_POR_LOGIN: texto(body.ATUALIZADO_POR_LOGIN ?? body.atualizado_por_login),
});

const validarPayload = (payload) => {
  if (!payload.LOOKUP_TYPE || !payload.LOOKUP_CODE || !payload.MEANING) {
    return 'LOOKUP_TYPE, LOOKUP_CODE e MEANING são obrigatórios.';
  }
  if (!['S', 'N'].includes(payload.ENABLED_FLAG)) {
    return 'ENABLED_FLAG deve ser S ou N.';
  }
  return '';
};

const validarTipoPai = async (lookupType) => {
  if (lookupType === 'LOOKUP TYPE') return '';

  const pai = await query(
    "SELECT id FROM mdr_lookup WHERE lookup_type = 'LOOKUP TYPE' AND lookup_code = $1 AND enabled_flag = 'S'",
    [lookupType]
  );

  return pai.rows.length === 0
    ? `O tipo "${lookupType}" não existe. Cadastre-o primeiro na aba Geral.`
    : '';
};

const buscarDuplicado = (lookupType, lookupCode, idIgnorado = null) => {
  if (idIgnorado) {
    return query(
      'SELECT id FROM mdr_lookup WHERE lookup_type = $1 AND lookup_code = $2 AND id <> $3',
      [lookupType, lookupCode, idIgnorado]
    );
  }

  return query(
    'SELECT id FROM mdr_lookup WHERE lookup_type = $1 AND lookup_code = $2',
    [lookupType, lookupCode]
  );
};

router.get('/tipos', exigirParametros, async (req, res) => {
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

router.get('/', exigirParametros, async (req, res) => {
  try {
    const result = await query('SELECT * FROM mdr_lookup ORDER BY lookup_type, meaning');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/:id', exigirParametros, async (req, res) => {
  try {
    const result = await query('SELECT * FROM mdr_lookup WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ erro: 'Lookup não encontrado.' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/', exigirParametros, async (req, res) => {
  const payload = normalizarPayload(req.body);
  const erroValidacao = validarPayload(payload);
  if (erroValidacao) return res.status(400).json({ erro: erroValidacao });

  try {
    const erroTipo = await validarTipoPai(payload.LOOKUP_TYPE);
    if (erroTipo) return res.status(400).json({ erro: erroTipo });

    const duplicado = await buscarDuplicado(payload.LOOKUP_TYPE, payload.LOOKUP_CODE);
    if (duplicado.rows.length > 0) {
      return res.status(400).json({ erro: 'Já existe um lookup com este tipo e código.' });
    }

    const result = await query(
      `INSERT INTO mdr_lookup (lookup_type, lookup_code, meaning, description, tag, enabled_flag,
        attribute1, attribute2, attribute3, criado_por_login)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [payload.LOOKUP_TYPE, payload.LOOKUP_CODE, payload.MEANING, payload.DESCRIPTION, payload.TAG,
       payload.ENABLED_FLAG, payload.ATTRIBUTE1, payload.ATTRIBUTE2, payload.ATTRIBUTE3,
       payload.CRIADO_POR_LOGIN]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.put('/:id', exigirParametros, async (req, res) => {
  const payload = normalizarPayload(req.body);
  const erroValidacao = validarPayload(payload);
  if (erroValidacao) return res.status(400).json({ erro: erroValidacao });

  try {
    const atual = await query('SELECT * FROM mdr_lookup WHERE id = $1', [req.params.id]);
    if (!atual.rows[0]) return res.status(404).json({ erro: 'Lookup não encontrado.' });

    const erroTipo = await validarTipoPai(payload.LOOKUP_TYPE);
    if (erroTipo) return res.status(400).json({ erro: erroTipo });

    const duplicado = await buscarDuplicado(payload.LOOKUP_TYPE, payload.LOOKUP_CODE, req.params.id);
    if (duplicado.rows.length > 0) {
      return res.status(400).json({ erro: 'Já existe um lookup com este tipo e código.' });
    }

    const lookupAtual = atual.rows[0];
    const renomeandoTipoComFilhos =
      lookupAtual.lookup_type === 'LOOKUP TYPE' &&
      payload.LOOKUP_TYPE === 'LOOKUP TYPE' &&
      lookupAtual.lookup_code !== payload.LOOKUP_CODE;

    if (renomeandoTipoComFilhos) {
      const filhos = await query('SELECT COUNT(*) as total FROM mdr_lookup WHERE lookup_type = $1', [lookupAtual.lookup_code]);
      if (parseInt(filhos.rows[0].total, 10) > 0) {
        return res.status(400).json({ erro: 'Não é possível alterar o código de um tipo que possui valores cadastrados.' });
      }
    }

    await query(
      `UPDATE mdr_lookup SET lookup_type=$1, lookup_code=$2, meaning=$3, description=$4,
        tag=$5, enabled_flag=$6, attribute1=$7, attribute2=$8, attribute3=$9,
        atualizado_por_login=$10, updated_at=NOW() WHERE id=$11`,
      [payload.LOOKUP_TYPE, payload.LOOKUP_CODE, payload.MEANING, payload.DESCRIPTION, payload.TAG,
       payload.ENABLED_FLAG, payload.ATTRIBUTE1, payload.ATTRIBUTE2, payload.ATTRIBUTE3,
       payload.ATUALIZADO_POR_LOGIN, req.params.id]
    );
    res.json({ sucesso: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.delete('/:id', exigirParametros, async (req, res) => {
  try {
    const lookup = await query('SELECT * FROM mdr_lookup WHERE id = $1', [req.params.id]);
    if (!lookup.rows[0]) return res.status(404).json({ erro: 'Lookup não encontrado.' });

    if (lookup.rows[0].lookup_type === 'LOOKUP TYPE') {
      const filhos = await query('SELECT COUNT(*) as total FROM mdr_lookup WHERE lookup_type = $1', [lookup.rows[0].lookup_code]);
      const paisAtivosRestantes = await query(
        "SELECT COUNT(*) as total FROM mdr_lookup WHERE lookup_type = 'LOOKUP TYPE' AND lookup_code = $1 AND enabled_flag = 'S' AND id <> $2",
        [lookup.rows[0].lookup_code, req.params.id]
      );

      if (parseInt(filhos.rows[0].total, 10) > 0 && parseInt(paisAtivosRestantes.rows[0].total, 10) === 0) {
        return res.status(400).json({ erro: `Não é possível excluir o último tipo ativo. Existem ${filhos.rows[0].total} valor(es) cadastrado(s).` });
      }
    }
    await query('DELETE FROM mdr_lookup WHERE id = $1', [req.params.id]);
    res.json({ sucesso: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;
