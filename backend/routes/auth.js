const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../database/postgres');
const { autenticar, SECRET } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: 'Email e senha são obrigatórios.' });
  try {
    const result = await query('SELECT * FROM usuarios WHERE email = $1 AND ativo = 1', [email]);
    const usuario = result.rows[0];
    if (!usuario) return res.status(401).json({ erro: 'Email ou senha inválidos.' });
    const senhaValida = bcrypt.compareSync(senha, usuario.senha);
    if (!senhaValida) return res.status(401).json({ erro: 'Email ou senha inválidos.' });
    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
      SECRET, { expiresIn: '24h' }
    );
    res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil } });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/usuarios', autenticar, async (req, res) => {
  const { nome, email, senha, perfil } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios.' });
  try {
    const existe = await query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (existe.rows.length > 0) return res.status(400).json({ erro: 'Este email já está cadastrado.' });
    const hash = bcrypt.hashSync(senha, 10);
    const result = await query(
      'INSERT INTO usuarios (nome, email, senha, perfil) VALUES ($1, $2, $3, $4) RETURNING id',
      [nome, email, hash, perfil || 'USER']
    );
    res.status(201).json({ id: result.rows[0].id, mensagem: 'Usuário criado com sucesso.' });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/usuarios', autenticar, async (req, res) => {
  try {
    const result = await query('SELECT id, nome, email, perfil, ativo, created_at FROM usuarios ORDER BY nome');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/perfil', autenticar, async (req, res) => {
  try {
    const result = await query('SELECT id, nome, email, perfil, ativo, created_at FROM usuarios WHERE id = $1', [req.usuario.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.put('/perfil', autenticar, async (req, res) => {
  const { nome, email } = req.body;
  if (!nome || !email) return res.status(400).json({ erro: 'Nome e email são obrigatórios.' });
  try {
    const existe = await query('SELECT id FROM usuarios WHERE email = $1 AND id != $2', [email, req.usuario.id]);
    if (existe.rows.length > 0) return res.status(400).json({ erro: 'Este email já está em uso.' });
    await query('UPDATE usuarios SET nome = $1, email = $2, updated_at = NOW() WHERE id = $3', [nome, email, req.usuario.id]);
    res.json({ mensagem: 'Perfil atualizado com sucesso.' });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.put('/trocar-senha', autenticar, async (req, res) => {
  const { senhaAtual, novaSenha } = req.body;
  if (!senhaAtual || !novaSenha) return res.status(400).json({ erro: 'Senha atual e nova senha são obrigatórias.' });
  if (novaSenha.length < 6) return res.status(400).json({ erro: 'A nova senha deve ter ao menos 6 caracteres.' });
  try {
    const result = await query('SELECT * FROM usuarios WHERE id = $1', [req.usuario.id]);
    const usuario = result.rows[0];
    if (!bcrypt.compareSync(senhaAtual, usuario.senha)) return res.status(401).json({ erro: 'Senha atual incorreta.' });
    const hash = bcrypt.hashSync(novaSenha, 10);
    await query('UPDATE usuarios SET senha = $1, updated_at = NOW() WHERE id = $2', [hash, req.usuario.id]);
    res.json({ mensagem: 'Senha alterada com sucesso.' });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.put('/usuarios/:id/status', autenticar, async (req, res) => {
  if (req.usuario.perfil !== 'ADMIN') return res.status(403).json({ erro: 'Acesso restrito.' });
  try {
    await query('UPDATE usuarios SET ativo = $1, updated_at = NOW() WHERE id = $2', [req.body.ativo ? 1 : 0, req.params.id]);
    res.json({ mensagem: 'Status atualizado.' });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;