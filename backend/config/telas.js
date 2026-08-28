const sqlIdeEnabled = process.env.ENABLE_ADMIN_SQL === 'true' ||
  (process.env.NODE_ENV !== 'production' && process.env.ENABLE_ADMIN_SQL !== 'false');

const TELAS_SISTEMA = [
  { id: 'dashboard', label: 'Início', padraoUsuario: true },
  { id: 'gastos', label: 'Lançamentos', padraoUsuario: true },
  { id: 'receitas', label: 'Receitas', padraoUsuario: true },
  { id: 'parcelas', label: 'Cartões', padraoUsuario: true },
  { id: 'metas', label: 'Metas', padraoUsuario: true },
  { id: 'relatorios', label: 'Relatórios', padraoUsuario: true },
  { id: 'importacao', label: 'Importar', padraoUsuario: false },
  { id: 'parametros', label: 'Configurações', padraoUsuario: false },
  sqlIdeEnabled ? { id: 'sql', label: 'SQL', padraoUsuario: false, adminOnly: true } : null,
].filter(Boolean);

const TELAS_IDS = TELAS_SISTEMA.map((tela) => tela.id);
const TELAS_PADRAO_USUARIO = TELAS_SISTEMA
  .filter((tela) => tela.padraoUsuario && !tela.adminOnly)
  .map((tela) => tela.id);
const TELAS_PADRAO_ADMIN = [...TELAS_IDS];

module.exports = {
  TELAS_SISTEMA,
  TELAS_IDS,
  TELAS_PADRAO_USUARIO,
  TELAS_PADRAO_ADMIN,
};
