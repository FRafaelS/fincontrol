const express = require('express');
const router = express.Router();
const { query } = require('../database/postgres');

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
  try {
    await query('UPDATE grupos SET nome = $1, descricao = $2 WHERE id = $3', [nome, descricao, req.params.id]);
    res.json({ sucesso: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// Deletar grupo
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM usuario_grupos WHERE grupo_id = $1', [req.params.id]);
    await query('DELETE FROM grupos WHERE id = $1', [req.params.id]);
    res.json({ sucesso: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// Listar membros do grupo
router.get('/:id/membros', async (req, res) => {
  try {
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
  try {
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
    await query('DELETE FROM usuario_grupos WHERE grupo_id = $1 AND usuario_id = $2', [req.params.id, req.params.usuarioId]);
    res.json({ sucesso: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// Atualizar permissões do membro
router.put('/:id/membros/:usuarioId', async (req, res) => {
  const { permissao, pode_ver_todos, pode_editar, pode_excluir } = req.body;
  try {
    await query(
      `UPDATE usuario_grupos SET permissao = $1, pode_ver_todos = $2, pode_editar = $3, pode_excluir = $4
       WHERE grupo_id = $5 AND usuario_id = $6`,
      [permissao, pode_ver_todos ? 1 : 0, pode_editar ? 1 : 0, pode_excluir ? 1 : 0, req.params.id, req.params.usuarioId]
    );
    res.json({ sucesso: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;