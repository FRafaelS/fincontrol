const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../database/postgres');
const { autenticar, apenasAdmin, exigirSenhaDefinitiva, SECRET } = require('../middleware/auth');
const {
  TELAS_SISTEMA,
  TELAS_IDS,
  TELAS_PADRAO_ADMIN,
  TELAS_PADRAO_SUPER_ADMIN,
  TELAS_PADRAO_USUARIO,
} = require('../config/telas');
const { PERFIS, ehSuperAdmin, normalizarPerfil } = require('../utils/perfis');

const inteiro = (valor, padrao = null) => {
  const convertido = parseInt(valor, 10);
  return Number.isFinite(convertido) ? convertido : padrao;
};

const telasPadraoPorPerfil = (perfil) => {
  const perfilFinal = normalizarPerfil(perfil);
  if (perfilFinal === PERFIS.SUPER_ADMIN) return TELAS_PADRAO_SUPER_ADMIN;
  if (perfilFinal === PERFIS.ADMIN) return TELAS_PADRAO_ADMIN;
  return TELAS_PADRAO_USUARIO;
};

const filtrarTelasPermitidas = (telas = [], perfil = 'USER') => {
  const perfilFinal = normalizarPerfil(perfil);
  if (perfilFinal === PERFIS.SUPER_ADMIN) return [...TELAS_PADRAO_SUPER_ADMIN];
  if (perfilFinal === PERFIS.ADMIN) return [...TELAS_PADRAO_ADMIN];

  const solicitadas = new Set(Array.isArray(telas) ? telas : []);
  return TELAS_SISTEMA
    .filter((tela) => !tela.adminOnly && solicitadas.has(tela.id))
    .map((tela) => tela.id);
};

const garantirTelasUsuario = async (usuarioId, perfil) => {
  const telasPadrao = telasPadraoPorPerfil(perfil);
  for (const tela of telasPadrao) {
    await query(
      `INSERT INTO usuario_telas (tenant_id, usuario_id, tela, pode_acessar)
       SELECT tenant_id, id, $2, 1 FROM usuarios WHERE id = $1
       ON CONFLICT (usuario_id, tela) DO NOTHING`,
      [usuarioId, tela]
    );
  }
};

const buscarTelasUsuario = async (usuarioId, perfil) => {
  await garantirTelasUsuario(usuarioId, perfil);

  const perfilFinal = normalizarPerfil(perfil);
  if (perfilFinal === PERFIS.SUPER_ADMIN) {
    return [...TELAS_PADRAO_SUPER_ADMIN];
  }
  if (perfilFinal === PERFIS.ADMIN) {
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
      `INSERT INTO usuario_telas (tenant_id, usuario_id, tela, pode_acessar, updated_at)
       SELECT tenant_id, id, $2, $3, NOW() FROM usuarios WHERE id = $1
       ON CONFLICT (usuario_id, tela)
       DO UPDATE SET pode_acessar = EXCLUDED.pode_acessar, updated_at = NOW()`,
      [usuarioId, tela, telasSelecionadas.has(tela) ? 1 : 0]
    );
  }

  return buscarTelasUsuario(usuarioId, perfil);
};

const buscarUsuarioPorId = async (id) => {
  const result = await query(
    `SELECT u.id, u.nome, u.email, u.perfil, u.ativo, u.senha_temporaria,
      u.tenant_id, t.nome AS tenant_nome
     FROM usuarios u
     LEFT JOIN tenants t ON t.id = u.tenant_id
     WHERE u.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const exigeTrocaSenha = (usuario = {}) => Number(usuario.senha_temporaria) === 1;

const podeGerenciarUsuario = (usuarioAtual, usuarioAlvo) => {
  if (!usuarioAlvo) return false;
  if (ehSuperAdmin(usuarioAtual)) return true;
  if (normalizarPerfil(usuarioAlvo.perfil) === PERFIS.SUPER_ADMIN) return false;
  return Number(usuarioAtual?.tenant_id) === Number(usuarioAlvo.tenant_id);
};

const validarTenantAtivo = async (tenantId) => {
  const result = await query('SELECT id, nome FROM tenants WHERE id = $1 AND ativo = 1', [tenantId]);
  return result.rows[0] || null;
};

router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: 'Email e senha são obrigatórios.' });
  try {
    const result = await query(
      `SELECT u.*, t.nome AS tenant_nome, t.ativo AS tenant_ativo
       FROM usuarios u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       WHERE u.email = $1 AND u.ativo = 1`,
      [email]
    );
    const usuario = result.rows[0];
    if (!usuario) return res.status(401).json({ erro: 'Email ou senha inválidos.' });
    if (!usuario.tenant_id) return res.status(403).json({ erro: 'Usuário sem conta vinculada.' });
    if (Number(usuario.tenant_ativo) !== 1) return res.status(403).json({ erro: 'Conta inativa.' });
    const senhaValida = bcrypt.compareSync(senha, usuario.senha);
    if (!senhaValida) return res.status(401).json({ erro: 'Email ou senha inválidos.' });
    const telas = await buscarTelasUsuario(usuario.id, usuario.perfil);
    const usuarioPublico = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      tenant_id: usuario.tenant_id,
      tenant_nome: usuario.tenant_nome,
      telas,
      trocar_senha_obrigatorio: exigeTrocaSenha(usuario),
    };
    const token = jwt.sign(
      {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        tenant_id: usuario.tenant_id,
        tenant_nome: usuario.tenant_nome,
        trocar_senha_obrigatorio: exigeTrocaSenha(usuario),
      },
      SECRET, { expiresIn: '24h' }
    );
    await query('UPDATE usuarios SET ultimo_login = NOW() WHERE id = $1', [usuario.id]);
    res.json({ token, usuario: usuarioPublico });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/usuarios', autenticar, exigirSenhaDefinitiva, apenasAdmin, async (req, res) => {
  const { nome, email, senha, perfil } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios.' });
  if (senha.length < 6) return res.status(400).json({ erro: 'A senha deve ter ao menos 6 caracteres.' });
  try {
    const existe = await query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (existe.rows.length > 0) return res.status(400).json({ erro: 'Este email já está cadastrado.' });
    const tenantId = ehSuperAdmin(req.usuario)
      ? inteiro(req.body.tenant_id, req.usuario.tenant_id)
      : req.usuario.tenant_id;
    const tenant = await validarTenantAtivo(tenantId);
    if (!tenant) return res.status(400).json({ erro: 'Conta inválida ou inativa.' });

    const hash = bcrypt.hashSync(senha, 10);
    let perfilFinal = normalizarPerfil(perfil);
    if (perfilFinal === PERFIS.SUPER_ADMIN && !ehSuperAdmin(req.usuario)) {
      perfilFinal = PERFIS.ADMIN;
    }

    const result = await query(
      `INSERT INTO usuarios (tenant_id, nome, email, senha, perfil, senha_temporaria)
       VALUES ($1, $2, $3, $4, $5, 1)
       RETURNING id`,
      [tenant.id, nome, email, hash, perfilFinal]
    );
    const telas = await salvarTelasUsuario(result.rows[0].id, perfilFinal, req.body.telas || telasPadraoPorPerfil(perfilFinal));
    res.status(201).json({ id: result.rows[0].id, telas, mensagem: 'Usuário criado com sucesso.' });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/usuarios', autenticar, exigirSenhaDefinitiva, apenasAdmin, async (req, res) => {
  try {
    const result = ehSuperAdmin(req.usuario)
      ? await query(
          `SELECT u.id, u.nome, u.email, u.perfil, u.ativo, u.senha_temporaria,
            u.ultimo_login, u.created_at, u.tenant_id, t.nome AS tenant_nome
           FROM usuarios u
           LEFT JOIN tenants t ON t.id = u.tenant_id
           ORDER BY t.nome, u.nome`
        )
      : await query(
          `SELECT u.id, u.nome, u.email, u.perfil, u.ativo, u.senha_temporaria,
            u.ultimo_login, u.created_at, u.tenant_id, t.nome AS tenant_nome
           FROM usuarios u
           LEFT JOIN tenants t ON t.id = u.tenant_id
           WHERE u.tenant_id = $1
           ORDER BY u.nome`,
          [req.usuario.tenant_id]
        );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/telas', autenticar, async (req, res) => {
  try {
    const telas = await buscarTelasUsuario(req.usuario.id, req.usuario.perfil);
    res.json({ telas, telasSistema: TELAS_SISTEMA });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/telas/sistema', autenticar, exigirSenhaDefinitiva, apenasAdmin, async (req, res) => {
  res.json(TELAS_SISTEMA);
});

router.get('/usuarios/:id/telas', autenticar, exigirSenhaDefinitiva, apenasAdmin, async (req, res) => {
  try {
    const usuario = await buscarUsuarioPorId(req.params.id);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    if (!podeGerenciarUsuario(req.usuario, usuario)) {
      return res.status(403).json({ erro: 'Você não tem permissão para gerenciar este usuário.' });
    }

    const telas = await buscarTelasUsuario(usuario.id, usuario.perfil);
    res.json({ usuario, telas, telasSistema: TELAS_SISTEMA });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.put('/usuarios/:id/telas', autenticar, exigirSenhaDefinitiva, apenasAdmin, async (req, res) => {
  try {
    const usuario = await buscarUsuarioPorId(req.params.id);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    if (!podeGerenciarUsuario(req.usuario, usuario)) {
      return res.status(403).json({ erro: 'Você não tem permissão para gerenciar este usuário.' });
    }

    const telas = await salvarTelasUsuario(usuario.id, usuario.perfil, req.body.telas || []);
    res.json({ sucesso: true, telas });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/perfil', autenticar, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.nome, u.email, u.perfil, u.ativo, u.senha_temporaria,
        u.ultimo_login, u.created_at, u.tenant_id, t.nome AS tenant_nome
       FROM usuarios u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1`,
      [req.usuario.id]
    );
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

router.put('/usuarios/:id/status', autenticar, exigirSenhaDefinitiva, apenasAdmin, async (req, res) => {
  try {
    const usuario = await buscarUsuarioPorId(req.params.id);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    if (!podeGerenciarUsuario(req.usuario, usuario)) {
      return res.status(403).json({ erro: 'Você não tem permissão para gerenciar este usuário.' });
    }
    if (Number(usuario.id) === Number(req.usuario.id)) {
      return res.status(400).json({ erro: 'Não altere o status do próprio usuário.' });
    }
    await query('UPDATE usuarios SET ativo = $1, updated_at = NOW() WHERE id = $2', [req.body.ativo ? 1 : 0, req.params.id]);
    res.json({ mensagem: 'Status atualizado.' });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;
