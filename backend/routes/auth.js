const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query, pool } = require('../database/postgres');
const { isProduction, passwordReset } = require('../config/env');
const { autenticar, apenasAdmin, exigirSenhaDefinitiva, SECRET } = require('../middleware/auth');
const { enviarEmailRecuperacaoSenha } = require('../services/email');
const {
  TELAS_SISTEMA,
  TELAS_IDS,
  TELAS_PADRAO_ADMIN,
  TELAS_PADRAO_SUPER_ADMIN,
  TELAS_PADRAO_USUARIO,
} = require('../config/telas');
const {
  PERFIS,
  ehSuperAdmin,
  normalizarPerfil,
  normalizarModoAcesso,
  perfilAtivoPorModo,
} = require('../utils/perfis');

const inteiro = (valor, padrao = null) => {
  const convertido = parseInt(valor, 10);
  return Number.isFinite(convertido) ? convertido : padrao;
};

const texto = (valor) => {
  if (valor === undefined || valor === null) return '';
  return String(valor).trim();
};

const respostaRecuperacaoSenha = {
  mensagem: 'Se o e-mail estiver cadastrado e ativo, enviaremos instruções para redefinir a senha.',
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const montarUrlRecuperacao = (token) => {
  const base = String(passwordReset.frontendUrl || '').replace(/\/+$/, '') || 'http://localhost:3000';
  return `${base}/?reset_token=${encodeURIComponent(token)}`;
};

const invalidarTokensAbertos = (usuarioId, client = { query }) =>
  client.query(
    'UPDATE password_reset_tokens SET usado_em = NOW() WHERE usuario_id = $1 AND usado_em IS NULL',
    [usuarioId]
  );

const criarTokenRecuperacaoSenha = async (usuario, origem = {}) => {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);

  await query('DELETE FROM password_reset_tokens WHERE expires_at < NOW() - INTERVAL \'1 day\'');
  await invalidarTokensAbertos(usuario.id);
  await query(
    `INSERT INTO password_reset_tokens
      (tenant_id, usuario_id, token_hash, expires_at, criado_por_usuario_id, ip_solicitacao)
     VALUES ($1, $2, $3, NOW() + ($4::int * INTERVAL '1 minute'), $5, $6)`,
    [
      usuario.tenant_id,
      usuario.id,
      tokenHash,
      passwordReset.expiresMinutes,
      origem.criadoPorUsuarioId || null,
      origem.ip || '',
    ]
  );

  return token;
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

const montarUsuarioSessao = async (usuario, modoInformado) => {
  const perfilReal = normalizarPerfil(usuario.perfil);
  const modoAcesso = normalizarModoAcesso(modoInformado, perfilReal);
  const perfilAtivo = perfilAtivoPorModo(perfilReal, modoAcesso);
  const telas = await buscarTelasUsuario(usuario.id, perfilAtivo);

  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    perfil: perfilAtivo,
    perfil_real: perfilReal,
    modo_acesso: modoAcesso,
    tenant_id: usuario.tenant_id,
    tenant_nome: usuario.tenant_nome,
    telas,
    trocar_senha_obrigatorio: exigeTrocaSenha(usuario),
  };
};

const buscarUsuarioAtivoPorEmail = async (email) => {
  const result = await query(
    `SELECT u.id, u.nome, u.email, u.perfil, u.ativo, u.senha_temporaria,
      u.tenant_id, t.nome AS tenant_nome, t.ativo AS tenant_ativo
     FROM usuarios u
     LEFT JOIN tenants t ON t.id = u.tenant_id
     WHERE LOWER(u.email) = LOWER($1) AND u.ativo = 1`,
    [email]
  );
  const usuario = result.rows[0];
  if (!usuario || !usuario.tenant_id || Number(usuario.tenant_ativo) !== 1) return null;
  return usuario;
};

router.post('/login', async (req, res) => {
  const { email, senha, modo_acesso } = req.body;
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
    const usuarioPublico = await montarUsuarioSessao(usuario, modo_acesso);
    const token = jwt.sign(usuarioPublico, SECRET, { expiresIn: '24h' });
    await query('UPDATE usuarios SET ultimo_login = NOW() WHERE id = $1', [usuario.id]);
    res.json({ token, usuario: usuarioPublico });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/recuperar-senha', async (req, res) => {
  const email = texto(req.body.email);
  if (!email) return res.status(400).json({ erro: 'Informe o e-mail cadastrado.' });
  if (!passwordReset.enabled) return res.status(503).json({ erro: 'Recuperação de senha desativada.' });

  try {
    const usuario = await buscarUsuarioAtivoPorEmail(email);
    const resposta = { ...respostaRecuperacaoSenha };

    if (usuario) {
      const token = await criarTokenRecuperacaoSenha(usuario, { ip: req.ip });
      const resetUrl = montarUrlRecuperacao(token);

      try {
        const envio = await enviarEmailRecuperacaoSenha({
          destino: usuario.email,
          nome: usuario.nome,
          resetUrl,
          expiraMinutos: passwordReset.expiresMinutes,
        });

        if (!envio.enviado && !isProduction) {
          resposta.dev_reset_url = resetUrl;
        }
      } catch (err) {
        console.error('Erro ao enviar e-mail de recuperação:', err.message);
        if (!isProduction) {
          resposta.aviso = 'E-mail não enviado. Confira a configuração SMTP.';
          resposta.dev_reset_url = resetUrl;
        }
      }
    }

    res.json(resposta);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.post('/redefinir-senha', async (req, res) => {
  const token = texto(req.body.token);
  const novaSenha = texto(req.body.novaSenha);
  if (!token || !novaSenha) return res.status(400).json({ erro: 'Token e nova senha são obrigatórios.' });
  if (novaSenha.length < 6) return res.status(400).json({ erro: 'A nova senha deve ter ao menos 6 caracteres.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `SELECT prt.id AS token_id, u.id AS usuario_id
       FROM password_reset_tokens prt
       JOIN usuarios u ON u.id = prt.usuario_id
       JOIN tenants t ON t.id = u.tenant_id
       WHERE prt.token_hash = $1
         AND prt.usado_em IS NULL
         AND prt.expires_at > NOW()
         AND u.ativo = 1
         AND t.ativo = 1
       FOR UPDATE`,
      [hashToken(token)]
    );
    const registro = result.rows[0];
    if (!registro) {
      await client.query('ROLLBACK');
      return res.status(400).json({ erro: 'Link de recuperação inválido ou expirado.' });
    }

    const hash = bcrypt.hashSync(novaSenha, 10);
    await client.query(
      'UPDATE usuarios SET senha = $1, senha_temporaria = 0, updated_at = NOW() WHERE id = $2',
      [hash, registro.usuario_id]
    );
    await invalidarTokensAbertos(registro.usuario_id, client);

    await client.query('COMMIT');
    res.json({ mensagem: 'Senha redefinida com sucesso. Faça login com a nova senha.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ erro: err.message });
  } finally {
    client.release();
  }
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
    res.json(await montarUsuarioSessao(usuario, req.usuario?.modo_acesso));
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

router.put('/usuarios/:id/senha', autenticar, exigirSenhaDefinitiva, apenasAdmin, async (req, res) => {
  const novaSenha = texto(req.body.novaSenha);
  if (!novaSenha) return res.status(400).json({ erro: 'Informe a nova senha temporária.' });
  if (novaSenha.length < 6) return res.status(400).json({ erro: 'A senha deve ter ao menos 6 caracteres.' });

  try {
    const usuario = await buscarUsuarioPorId(req.params.id);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    if (Number(usuario.id) === Number(req.usuario.id)) {
      return res.status(400).json({ erro: 'Use a aba Senha para alterar a própria senha.' });
    }
    if (!podeGerenciarUsuario(req.usuario, usuario)) {
      return res.status(403).json({ erro: 'Você não tem permissão para redefinir a senha deste usuário.' });
    }

    const hash = bcrypt.hashSync(novaSenha, 10);
    await query(
      `UPDATE usuarios
       SET senha = $1, senha_temporaria = 1, updated_at = NOW()
       WHERE id = $2`,
      [hash, usuario.id]
    );
    await invalidarTokensAbertos(usuario.id);
    res.json({ mensagem: 'Senha temporária definida. O usuário deverá trocá-la no próximo login.' });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;
