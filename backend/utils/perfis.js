const PERFIS = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  USER: 'USER',
};

const MODOS_ACESSO = {
  PESSOAL: 'PESSOAL',
  PLATAFORMA: 'PLATAFORMA',
};

const normalizarPerfil = (perfil) => {
  const valor = String(perfil || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

  if (valor === PERFIS.SUPER_ADMIN || valor === 'SUPERADMIN' || valor === 'ROOT') {
    return PERFIS.SUPER_ADMIN;
  }

  if (valor === PERFIS.ADMIN || valor === 'ADMIN_CONTA' || valor === 'ADMIN_DA_CONTA') {
    return PERFIS.ADMIN;
  }

  return PERFIS.USER;
};

const ehSuperAdmin = (usuario = {}) => normalizarPerfil(usuario.perfil) === PERFIS.SUPER_ADMIN;

const ehAdminConta = (usuario = {}) => {
  const perfil = normalizarPerfil(usuario.perfil);
  return perfil === PERFIS.SUPER_ADMIN || perfil === PERFIS.ADMIN;
};

const normalizarModoAcesso = (modo, perfilReal = PERFIS.USER) => {
  const perfil = normalizarPerfil(perfilReal);
  if (perfil !== PERFIS.SUPER_ADMIN) return MODOS_ACESSO.PESSOAL;

  const valor = String(modo || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

  if (['PLATAFORMA', 'SUPER_ADMIN', 'SUPERADMIN', 'ADMINISTRACAO', 'ADMINISTRADOR_PLATAFORMA'].includes(valor)) {
    return MODOS_ACESSO.PLATAFORMA;
  }

  return MODOS_ACESSO.PESSOAL;
};

const perfilAtivoPorModo = (perfilReal, modoAcesso) => {
  const perfil = normalizarPerfil(perfilReal);
  if (perfil === PERFIS.SUPER_ADMIN && normalizarModoAcesso(modoAcesso, perfil) === MODOS_ACESSO.PESSOAL) {
    return PERFIS.USER;
  }
  return perfil;
};

const rotuloPerfil = (perfil) => {
  const normalizado = normalizarPerfil(perfil);
  if (normalizado === PERFIS.SUPER_ADMIN) return 'Super admin';
  if (normalizado === PERFIS.ADMIN) return 'Administrador';
  return 'Usuario';
};

module.exports = {
  PERFIS,
  MODOS_ACESSO,
  normalizarPerfil,
  normalizarModoAcesso,
  perfilAtivoPorModo,
  ehSuperAdmin,
  ehAdminConta,
  rotuloPerfil,
};
