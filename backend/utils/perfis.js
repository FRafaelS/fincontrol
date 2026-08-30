const PERFIS = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  USER: 'USER',
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

const rotuloPerfil = (perfil) => {
  const normalizado = normalizarPerfil(perfil);
  if (normalizado === PERFIS.SUPER_ADMIN) return 'Super admin';
  if (normalizado === PERFIS.ADMIN) return 'Administrador';
  return 'Usuario';
};

module.exports = {
  PERFIS,
  normalizarPerfil,
  ehSuperAdmin,
  ehAdminConta,
  rotuloPerfil,
};
