const jwt = require('jsonwebtoken');
const { query } = require('../database/postgres');
const { JWT_SECRET: SECRET } = require('../config/env');

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
  if (req.usuario?.perfil !== 'ADMIN') {
    return res.status(403).json({ erro: 'Acesso restrito a administradores.' });
  }
  next();
};

const habilitado = (valor) => valor === true || valor === 1 || valor === '1' || valor === 'true';

const exigirSenhaDefinitiva = async (req, res, next) => {
  try {
    const result = await query('SELECT senha_temporaria FROM usuarios WHERE id = $1 AND ativo = 1', [req.usuario?.id]);
    const usuario = result.rows[0];

    if (!usuario) {
      return res.status(401).json({ erro: 'Usuário não encontrado ou inativo.' });
    }

    if (habilitado(usuario.senha_temporaria)) {
      return res.status(403).json({
        erro: 'Troque a senha inicial antes de continuar.',
        codigo: 'TROCA_SENHA_OBRIGATORIA',
      });
    }

    next();
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
};

const exigirAlgumaTela = (telas = []) => async (req, res, next) => {
  const listaTelas = Array.isArray(telas) ? telas.filter(Boolean) : [telas].filter(Boolean);
  if (listaTelas.length === 0 || req.usuario?.perfil === 'ADMIN') {
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

module.exports = { autenticar, apenasAdmin, exigirSenhaDefinitiva, exigirTela, exigirAlgumaTela, SECRET };
