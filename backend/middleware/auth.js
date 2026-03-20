const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'fincontrol_secret_2026';

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

module.exports = { autenticar, apenasAdmin, SECRET };