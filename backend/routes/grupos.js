const express = require('express');
const router = express.Router();
const { query } = require('../database/postgres');

const permissaoGrupo = async (usuario, grupoId) => {
  if (usuario.perfil === 'ADMIN') return { admin: true };

  const result = await query(
    'SELECT permissao FROM usuario_grupos WHERE usuario_id = $1 AND grupo_id = $2',
    [usuario.id, grupoId]
  );

  return result.rows[0] || null;
};

const podeVerGrupo = async (usuario, grupoId) => Boolean(await permissaoGrupo(usuario, grupoId));

const podeGerenciarGrupo = async (usuario, grupoId) => {
  const permissao = await permissaoGrupo(usuario, grupoId);
  return Boolean(permissao?.admin || permissao?.permissao === 'ADMIN');
};

const resumoCompartilhamento = async (usuarioId, grupoId) => {
  const [gastos, receitas, membros] = await Promise.all([
    query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE grupo_id = $1)::int AS no_grupo,
         COUNT(*) FILTER (WHERE grupo_id IS DISTINCT FROM $1)::int AS fora_grupo
       FROM gastos
       WHERE usuario_id = $2`,
      [grupoId, usuarioId]
    ),
    query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE grupo_id = $1)::int AS no_grupo,
         COUNT(*) FILTER (WHERE grupo_id IS DISTINCT FROM $1)::int AS fora_grupo
       FROM receitas
       WHERE usuario_id = $2`,
      [grupoId, usuarioId]
    ),
    query('SELECT COUNT(*)::int AS total FROM usuario_grupos WHERE grupo_id = $1', [grupoId]),
  ]);

  return {
    gastos: gastos.rows[0] || { total: 0, no_grupo: 0, fora_grupo: 0 },
    receitas: receitas.rows[0] || { total: 0, no_grupo: 0, fora_grupo: 0 },
    membros: membros.rows[0]?.total || 0,
  };
};

// Listar grupos do usuário
router.get('/', async (req, res) => {
  try {
    const { perfil, id } = req.usuario;
    let result;
    if (perfil === 'ADMIN') {
      result = await query('SELECT g.*, u.nome as criador FROM grupos g LEFT JOIN usuarios u ON g.criado_por = u.id ORDER BY g.nome');
    } else {
      result = await query(
        `SELECT g.*, u.nome as criador, ug.permissao, ug.pode_ver_todos, ug.pode_editar, ug.pode_excluir
         FROM grupos g
         JOIN usuario_grupos ug ON g.id = ug.grupo_id
         LEFT JOIN usuarios u ON g.criado_por = u.id
         WHERE ug.usuario_id = $1 ORDER BY g.nome`,
        [id]
      );
    }
    res.json(result.rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/meus', async (req, res) => {
  try {
    const result = await query(
      `SELECT g.*, u.nome as criador, ug.permissao, ug.pode_ver_todos, ug.pode_editar, ug.pode_excluir
       FROM grupos g
       JOIN usuario_grupos ug ON g.id = ug.grupo_id
       LEFT JOIN usuarios u ON g.criado_por = u.id
       WHERE ug.usuario_id = $1
       ORDER BY g.nome`,
      [req.usuario.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// Criar grupo
router.post('/', async (req, res) => {
  const { nome, descricao } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório.' });
  try {
    const result = await query(
      'INSERT INTO grupos (nome, descricao, criado_por) VALUES ($1, $2, $3) RETURNING id',
      [nome, descricao, req.usuario.id]
    );
    const grupoId = result.rows[0].id;
    // Adiciona criador como admin do grupo
    await query(
      'INSERT INTO usuario_grupos (usuario_id, grupo_id, permissao, pode_ver_todos, pode_editar, pode_excluir) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.usuario.id, grupoId, 'ADMIN', 1, 1, 1]
    );
    res.status(201).json({ id: grupoId });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// Atualizar grupo
router.put('/:id', async (req, res) => {
  const { nome, descricao } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório.' });
  try {
    if (!(await podeGerenciarGrupo(req.usuario, req.params.id))) {
      return res.status(403).json({ erro: 'Você não tem permissão para atualizar este grupo.' });
    }
    await query('UPDATE grupos SET nome = $1, descricao = $2 WHERE id = $3', [nome, descricao, req.params.id]);
    res.json({ sucesso: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// Deletar grupo
router.delete('/:id', async (req, res) => {
  try {
    if (!(await podeGerenciarGrupo(req.usuario, req.params.id))) {
      return res.status(403).json({ erro: 'Você não tem permissão para excluir este grupo.' });
    }
    await query('DELETE FROM usuario_grupos WHERE grupo_id = $1', [req.params.id]);
    await query('DELETE FROM grupos WHERE id = $1', [req.params.id]);
    res.json({ sucesso: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/:id/compartilhamento', async (req, res) => {
  try {
    if (!(await podeVerGrupo(req.usuario, req.params.id))) {
      return res.status(403).json({ erro: 'Você não tem permissão para ver este grupo.' });
    }

    res.json(await resumoCompartilhamento(req.usuario.id, req.params.id));
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/:id/compartilhar-meus-dados', async (req, res) => {
  try {
    if (!(await podeGerenciarGrupo(req.usuario, req.params.id))) {
      return res.status(403).json({ erro: 'Você não tem permissão para compartilhar dados neste grupo.' });
    }

    const gastos = await query(
      'UPDATE gastos SET grupo_id = $1 WHERE usuario_id = $2 AND grupo_id IS DISTINCT FROM $1',
      [req.params.id, req.usuario.id]
    );
    const receitas = await query(
      'UPDATE receitas SET grupo_id = $1 WHERE usuario_id = $2 AND grupo_id IS DISTINCT FROM $1',
      [req.params.id, req.usuario.id]
    );

    res.json({
      sucesso: true,
      gastos: gastos.rowCount || 0,
      receitas: receitas.rowCount || 0,
      resumo: await resumoCompartilhamento(req.usuario.id, req.params.id),
    });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// Listar membros do grupo
router.get('/:id/membros', async (req, res) => {
  try {
    if (!(await podeVerGrupo(req.usuario, req.params.id))) {
      return res.status(403).json({ erro: 'Você não tem permissão para ver este grupo.' });
    }
    const result = await query(
      `SELECT u.id, u.nome, u.email, u.perfil, ug.permissao,
        ug.pode_ver_todos, ug.pode_editar, ug.pode_excluir
       FROM usuario_grupos ug
       JOIN usuarios u ON ug.usuario_id = u.id
       WHERE ug.grupo_id = $1 ORDER BY u.nome`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// Adicionar membro ao grupo
router.post('/:id/membros', async (req, res) => {
  const { usuario_id, permissao, pode_ver_todos, pode_editar, pode_excluir } = req.body;
  if (!usuario_id) return res.status(400).json({ erro: 'Usuário é obrigatório.' });
  try {
    if (!(await podeGerenciarGrupo(req.usuario, req.params.id))) {
      return res.status(403).json({ erro: 'Você não tem permissão para adicionar membros.' });
    }
    await query(
      `INSERT INTO usuario_grupos (usuario_id, grupo_id, permissao, pode_ver_todos, pode_editar, pode_excluir)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (usuario_id, grupo_id) DO UPDATE SET
         permissao = $3, pode_ver_todos = $4, pode_editar = $5, pode_excluir = $6`,
      [usuario_id, req.params.id, permissao || 'MEMBRO', pode_ver_todos ? 1 : 0, pode_editar ? 1 : 0, pode_excluir ? 1 : 0]
    );
    res.status(201).json({ sucesso: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// Remover membro do grupo
router.delete('/:id/membros/:usuarioId', async (req, res) => {
  try {
    if (!(await podeGerenciarGrupo(req.usuario, req.params.id))) {
      return res.status(403).json({ erro: 'Você não tem permissão para remover membros.' });
    }
    await query('DELETE FROM usuario_grupos WHERE grupo_id = $1 AND usuario_id = $2', [req.params.id, req.params.usuarioId]);
    res.json({ sucesso: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// Atualizar permissões do membro
router.put('/:id/membros/:usuarioId', async (req, res) => {
  const { permissao, pode_ver_todos, pode_editar, pode_excluir } = req.body;
  try {
    if (!(await podeGerenciarGrupo(req.usuario, req.params.id))) {
      return res.status(403).json({ erro: 'Você não tem permissão para atualizar membros.' });
    }
    await query(
      `UPDATE usuario_grupos SET permissao = $1, pode_ver_todos = $2, pode_editar = $3, pode_excluir = $4
       WHERE grupo_id = $5 AND usuario_id = $6`,
      [permissao, pode_ver_todos ? 1 : 0, pode_editar ? 1 : 0, pode_excluir ? 1 : 0, req.params.id, req.params.usuarioId]
    );
    res.json({ sucesso: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;
