const TELAS_SISTEMA = [
  { id: 'dashboard', label: 'Início', padraoUsuario: true },
  { id: 'gastos', label: 'Lançamentos', padraoUsuario: true },
  { id: 'receitas', label: 'Receitas', padraoUsuario: true },
  { id: 'parcelas', label: 'Cartões', padraoUsuario: true },
  { id: 'metas', label: 'Metas', padraoUsuario: true },
  { id: 'relatorios', label: 'Relatórios', padraoUsuario: true },
  { id: 'importacao', label: 'Importar', padraoUsuario: false },
  { id: 'parametros', label: 'Configurações', padraoUsuario: false },
  { id: 'sql', label: 'SQL', padraoUsuario: false, adminOnly: true, superAdminOnly: true },
];

const TELAS_IDS = TELAS_SISTEMA.map((tela) => tela.id);
const TELAS_PADRAO_USUARIO = TELAS_SISTEMA
  .filter((tela) => tela.padraoUsuario && !tela.adminOnly)
  .map((tela) => tela.id);
const TELAS_PADRAO_ADMIN = TELAS_SISTEMA
  .filter((tela) => !tela.superAdminOnly)
  .map((tela) => tela.id);
const TELAS_PADRAO_SUPER_ADMIN = [...TELAS_IDS];

module.exports = {
  TELAS_SISTEMA,
  TELAS_IDS,
  TELAS_PADRAO_USUARIO,
  TELAS_PADRAO_ADMIN,
  TELAS_PADRAO_SUPER_ADMIN,
};
