const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { autenticar, SECRET } = require('../middleware/auth');

// Login
router.post('/login', (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: 'Email e senha são obrigatórios.' });
  }

  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ? AND ativo = 1').get(email);

  if (!usuario) {
    return res.status(401).json({ erro: 'Email ou senha inválidos.' });
  }

  const senhaValida = bcrypt.compareSync(senha, usuario.senha);
  if (!senhaValida) {
    return res.status(401).json({ erro: 'Email ou senha inválidos.' });
  }

  const token = jwt.sign(
    { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
    SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
  });
});

// Cadastrar usuário (apenas admin)
router.post('/usuarios', autenticar, (req, res) => {
  const { nome, email, senha, perfil } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios.' });
  }

  const existe = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
  if (existe) {
    return res.status(400).json({ erro: 'Este email já está cadastrado.' });
  }

  const hash = bcrypt.hashSync(senha, 10);
  const result = db.prepare(`
    INSERT INTO usuarios (nome, email, senha, perfil)
    VALUES (?, ?, ?, ?)
  `).run(nome, email, hash, perfil || 'USER');

  res.status(201).json({ id: result.lastInsertRowid, mensagem: 'Usuário criado com sucesso.' });
});

// Listar usuários (apenas admin)
router.get('/usuarios', autenticar, (req, res) => {
  const usuarios = db.prepare(
    'SELECT id, nome, email, perfil, ativo, created_at FROM usuarios ORDER BY nome'
  ).all();
  res.json(usuarios);
});

// Meu perfil
router.get('/perfil', autenticar, (req, res) => {
  const usuario = db.prepare(
    'SELECT id, nome, email, perfil, ativo, created_at FROM usuarios WHERE id = ?'
  ).get(req.usuario.id);
  res.json(usuario);
});

// Atualizar perfil
router.put('/perfil', autenticar, (req, res) => {
  const { nome, email } = req.body;

  if (!nome || !email) {
    return res.status(400).json({ erro: 'Nome e email são obrigatórios.' });
  }

  const emailExiste = db.prepare(
    'SELECT id FROM usuarios WHERE email = ? AND id != ?'
  ).get(email, req.usuario.id);

  if (emailExiste) {
    return res.status(400).json({ erro: 'Este email já está em uso.' });
  }

  db.prepare(`
    UPDATE usuarios SET nome = ?, email = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(nome, email, req.usuario.id);

  res.json({ mensagem: 'Perfil atualizado com sucesso.' });
});

// Trocar senha
router.put('/trocar-senha', autenticar, (req, res) => {
  const { senhaAtual, novaSenha } = req.body;

  if (!senhaAtual || !novaSenha) {
    return res.status(400).json({ erro: 'Senha atual e nova senha são obrigatórias.' });
  }

  if (novaSenha.length < 6) {
    return res.status(400).json({ erro: 'A nova senha deve ter ao menos 6 caracteres.' });
  }

  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.usuario.id);
  const senhaValida = bcrypt.compareSync(senhaAtual, usuario.senha);

  if (!senhaValida) {
    return res.status(401).json({ erro: 'Senha atual incorreta.' });
  }

  const hash = bcrypt.hashSync(novaSenha, 10);
  db.prepare('UPDATE usuarios SET senha = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(hash, req.usuario.id);

  res.json({ mensagem: 'Senha alterada com sucesso.' });
});

// Ativar/desativar usuário (apenas admin)
router.put('/usuarios/:id/status', autenticar, (req, res) => {
  if (req.usuario.perfil !== 'ADMIN') {
    return res.status(403).json({ erro: 'Acesso restrito a administradores.' });
  }

  const { ativo } = req.body;
  db.prepare('UPDATE usuarios SET ativo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(ativo ? 1 : 0, req.params.id);

  res.json({ mensagem: 'Status atualizado.' });
});

module.exports = router;