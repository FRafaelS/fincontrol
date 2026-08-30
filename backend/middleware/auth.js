const jwt = require('jsonwebtoken');
const { query } = require('../database/postgres');
const { JWT_SECRET: SECRET } = require('../config/env');
const { ehAdminConta, ehSuperAdmin } = require('../utils/perfis');

const autenticar = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ erro: 'Token não informado.' });
  }

  try {
    const dados = jwt.verify(token, SECRET);
    req.usuario = dados;
    next();
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
};

const apenasAdmin = (req, res, next) => {
  if (!ehAdminConta(req.usuario)) {
    return res.status(403).json({ erro: 'Acesso restrito a administradores.' });
  }
  next();
};

const apenasSuperAdmin = (req, res, next) => {
  if (!ehSuperAdmin(req.usuario)) {
    return res.status(403).json({ erro: 'Acesso restrito ao administrador da plataforma.' });
  }
  next();
};

const habilitado = (valor) => valor === true || valor === 1 || valor === '1' || valor === 'true';

const exigirSenhaDefinitiva = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.nome, u.email, u.perfil, u.tenant_id, u.senha_temporaria,
        t.nome AS tenant_nome, t.ativo AS tenant_ativo
       FROM usuarios u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1 AND u.ativo = 1`,
      [req.usuario?.id]
    );
    const usuario = result.rows[0];

    if (!usuario) {
      return res.status(401).json({ erro: 'Usuário não encontrado ou inativo.' });
    }

    if (!usuario.tenant_id) {
      return res.status(403).json({ erro: 'Usuário sem conta vinculada.' });
    }

    if (!habilitado(usuario.tenant_ativo)) {
      return res.status(403).json({ erro: 'Conta inativa.' });
    }

    if (habilitado(usuario.senha_temporaria)) {
      return res.status(403).json({
        erro: 'Troque a senha inicial antes de continuar.',
        codigo: 'TROCA_SENHA_OBRIGATORIA',
      });
    }

    req.usuario = {
      ...req.usuario,
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      tenant_id: usuario.tenant_id,
      tenant_nome: usuario.tenant_nome,
    };

    next();
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
};

const exigirAlgumaTela = (telas = []) => async (req, res, next) => {
  const listaTelas = Array.isArray(telas) ? telas.filter(Boolean) : [telas].filter(Boolean);
  if (listaTelas.length === 0 || ehAdminConta(req.usuario)) {
    next();
    return;
  }

  try {
    const result = await query(
      `SELECT tela, pode_acessar
       FROM usuario_telas
       WHERE usuario_id = $1 AND tela = ANY($2::text[])`,
      [req.usuario.id, listaTelas]
    );
    const podeAcessar = result.rows.some((permissao) => habilitado(permissao.pode_acessar));

    if (!podeAcessar) {
      return res.status(403).json({ erro: 'Você não tem acesso a esta tela.' });
    }

    next();
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
};

const exigirTela = (tela) => exigirAlgumaTela([tela]);

module.exports = {
  autenticar,
  apenasAdmin,
  apenasSuperAdmin,
  exigirSenhaDefinitiva,
  exigirTela,
  exigirAlgumaTela,
  SECRET,
};
