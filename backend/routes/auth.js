const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../database/postgres');
const { autenticar, apenasAdmin, SECRET } = require('../middleware/auth');
const {
  TELAS_SISTEMA,
  TELAS_IDS,
  TELAS_PADRAO_ADMIN,
  TELAS_PADRAO_USUARIO,
} = require('../config/telas');

const normalizarPerfil = (perfil) => String(perfil || '').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'USER';

const telasPadraoPorPerfil = (perfil) =>
  normalizarPerfil(perfil) === 'ADMIN' ? TELAS_PADRAO_ADMIN : TELAS_PADRAO_USUARIO;

const filtrarTelasPermitidas = (telas = [], perfil = 'USER') => {
  if (normalizarPerfil(perfil) === 'ADMIN') return [...TELAS_PADRAO_ADMIN];

  const solicitadas = new Set(Array.isArray(telas) ? telas : []);
  return TELAS_SISTEMA
    .filter((tela) => !tela.adminOnly && solicitadas.has(tela.id))
    .map((tela) => tela.id);
};

const garantirTelasUsuario = async (usuarioId, perfil) => {
  const telasPadrao = telasPadraoPorPerfil(perfil);
  for (const tela of telasPadrao) {
    await query(
      `INSERT INTO usuario_telas (usuario_id, tela, pode_acessar)
       VALUES ($1, $2, 1)
       ON CONFLICT (usuario_id, tela) DO NOTHING`,
      [usuarioId, tela]
    );
  }
};

const buscarTelasUsuario = async (usuarioId, perfil) => {
  await garantirTelasUsuario(usuarioId, perfil);

  if (normalizarPerfil(perfil) === 'ADMIN') {
    return [...TELAS_PADRAO_ADMIN];
  }

  const result = await query(
    `SELECT tela
     FROM usuario_telas
     WHERE usuario_id = $1 AND pode_acessar = 1
     ORDER BY tela`,
    [usuarioId]
  );
  return result.rows.map((row) => row.tela).filter((tela) => TELAS_IDS.includes(tela));
};

const salvarTelasUsuario = async (usuarioId, perfil, telas) => {
  const telasSelecionadas = new Set(filtrarTelasPermitidas(telas, perfil));

  for (const tela of TELAS_IDS) {
    await query(
      `INSERT INTO usuario_telas (usuario_id, tela, pode_acessar, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (usuario_id, tela)
       DO UPDATE SET pode_acessar = EXCLUDED.pode_acessar, updated_at = NOW()`,
      [usuarioId, tela, telasSelecionadas.has(tela) ? 1 : 0]
    );
  }

  return buscarTelasUsuario(usuarioId, perfil);
};

const buscarUsuarioPorId = async (id) => {
  const result = await query('SELECT id, nome, email, perfil, ativo, senha_temporaria FROM usuarios WHERE id = $1', [id]);
  return result.rows[0] || null;
};

const exigeTrocaSenha = (usuario = {}) => Number(usuario.senha_temporaria) === 1;

router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: 'Email e senha são obrigatórios.' });
  try {
    const result = await query('SELECT * FROM usuarios WHERE email = $1 AND ativo = 1', [email]);
    const usuario = result.rows[0];
    if (!usuario) return res.status(401).json({ erro: 'Email ou senha inválidos.' });
    const senhaValida = bcrypt.compareSync(senha, usuario.senha);
    if (!senhaValida) return res.status(401).json({ erro: 'Email ou senha inválidos.' });
    const telas = await buscarTelasUsuario(usuario.id, usuario.perfil);
    const usuarioPublico = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      telas,
      trocar_senha_obrigatorio: exigeTrocaSenha(usuario),
    };
    const token = jwt.sign(
      {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        trocar_senha_obrigatorio: exigeTrocaSenha(usuario),
      },
      SECRET, { expiresIn: '24h' }
    );
    await query('UPDATE usuarios SET ultimo_login = NOW() WHERE id = $1', [usuario.id]);
    res.json({ token, usuario: usuarioPublico });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/usuarios', autenticar, apenasAdmin, async (req, res) => {
  const { nome, email, senha, perfil } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios.' });
  if (senha.length < 6) return res.status(400).json({ erro: 'A senha deve ter ao menos 6 caracteres.' });
  try {
    const existe = await query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (existe.rows.length > 0) return res.status(400).json({ erro: 'Este email já está cadastrado.' });
    const hash = bcrypt.hashSync(senha, 10);
    const perfilFinal = normalizarPerfil(perfil);
    const result = await query(
      'INSERT INTO usuarios (nome, email, senha, perfil, senha_temporaria) VALUES ($1, $2, $3, $4, 1) RETURNING id',
      [nome, email, hash, perfilFinal]
    );
    const telas = await salvarTelasUsuario(result.rows[0].id, perfilFinal, req.body.telas || telasPadraoPorPerfil(perfilFinal));
    res.status(201).json({ id: result.rows[0].id, telas, mensagem: 'Usuário criado com sucesso.' });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/usuarios', autenticar, apenasAdmin, async (req, res) => {
  try {
    const result = await query('SELECT id, nome, email, perfil, ativo, senha_temporaria, ultimo_login, created_at FROM usuarios ORDER BY nome');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/telas', autenticar, async (req, res) => {
  try {
    const telas = await buscarTelasUsuario(req.usuario.id, req.usuario.perfil);
    res.json({ telas, telasSistema: TELAS_SISTEMA });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/telas/sistema', autenticar, apenasAdmin, async (req, res) => {
  res.json(TELAS_SISTEMA);
});

router.get('/usuarios/:id/telas', autenticar, apenasAdmin, async (req, res) => {
  try {
    const usuario = await buscarUsuarioPorId(req.params.id);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    const telas = await buscarTelasUsuario(usuario.id, usuario.perfil);
    res.json({ usuario, telas, telasSistema: TELAS_SISTEMA });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.put('/usuarios/:id/telas', autenticar, apenasAdmin, async (req, res) => {
  try {
    const usuario = await buscarUsuarioPorId(req.params.id);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    const telas = await salvarTelasUsuario(usuario.id, usuario.perfil, req.body.telas || []);
    res.json({ sucesso: true, telas });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/perfil', autenticar, async (req, res) => {
  try {
    const result = await query('SELECT id, nome, email, perfil, ativo, senha_temporaria, ultimo_login, created_at FROM usuarios WHERE id = $1', [req.usuario.id]);
    const usuario = result.rows[0];
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    const telas = await buscarTelasUsuario(usuario.id, usuario.perfil);
    res.json({ ...usuario, telas, trocar_senha_obrigatorio: exigeTrocaSenha(usuario) });
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
    await query('UPDATE usuarios SET senha = $1, senha_temporaria = 0, updated_at = NOW() WHERE id = $2', [hash, req.usuario.id]);
    res.json({ mensagem: 'Senha alterada com sucesso.' });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.put('/usuarios/:id/status', autenticar, apenasAdmin, async (req, res) => {
  try {
    await query('UPDATE usuarios SET ativo = $1, updated_at = NOW() WHERE id = $2', [req.body.ativo ? 1 : 0, req.params.id]);
    res.json({ mensagem: 'Status atualizado.' });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;
