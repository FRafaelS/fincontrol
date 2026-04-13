const express = require('express');
const router = express.Router();
const { query } = require('../database/postgres');

router.get('/', async (req, res) => {
  try {
    const { perfil, id } = req.usuario;
    let result;
    if (perfil === 'ADMIN') {
      result = await query('SELECT * FROM gastos ORDER BY id DESC');
    } else {
      // Verifica grupos do usuário e permissões
      const grupos = await query(
        'SELECT ug.grupo_id, ug.pode_ver_todos FROM usuario_grupos ug WHERE ug.usuario_id = $1',
        [id]
      );
      const gruposVerTodos = grupos.rows.filter(g => g.pode_ver_todos).map(g => g.grupo_id);
      const gruposMembros = grupos.rows.map(g => g.grupo_id);

      if (gruposVerTodos.length > 0) {
        result = await query(
          'SELECT * FROM gastos WHERE grupo_id = ANY($1) OR usuario_id = $2 ORDER BY id DESC',
          [gruposVerTodos, id]
        );
      } else {
        result = await query('SELECT * FROM gastos WHERE usuario_id = $1 ORDER BY id DESC', [id]);
      }
    }
    res.json(result.rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM gastos WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ erro: 'Gasto não encontrado' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/', async (req, res) => {
  const { responsavel, tipo, descricao, parcela, tp_despesa, categoria, forma_pgto,
    valor_total, valor_individual, data_venc, mes, ano, status, obs, grupo_id } = req.body;
  try {
    const result = await query(
      `INSERT INTO gastos (usuario_id, grupo_id, responsavel, tipo, descricao, parcela, tp_despesa,
        categoria, forma_pgto, valor_total, valor_individual, data_venc, mes, ano, status, obs)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
      [req.usuario.id, grupo_id || null, responsavel, tipo, descricao, parcela, tp_despesa,
       categoria, forma_pgto, valor_total, valor_individual, data_venc, mes, ano, status || 'PENDENTE', obs]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.put('/:id', async (req, res) => {
  const { responsavel, tipo, descricao, parcela, tp_despesa, categoria, forma_pgto,
    valor_total, valor_individual, data_venc, mes, ano, status, obs } = req.body;
  try {
    await query(
      `UPDATE gastos SET responsavel=$1, tipo=$2, descricao=$3, parcela=$4, tp_despesa=$5,
        categoria=$6, forma_pgto=$7, valor_total=$8, valor_individual=$9, data_venc=$10,
        mes=$11, ano=$12, status=$13, obs=$14 WHERE id=$15`,
      [responsavel, tipo, descricao, parcela, tp_despesa, categoria, forma_pgto,
       valor_total, valor_individual, data_venc, mes, ano, status, obs, req.params.id]
    );
    res.json({ sucesso: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM gastos WHERE id = $1', [req.params.id]);
    res.json({ sucesso: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;