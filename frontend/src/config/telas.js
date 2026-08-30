export const TELAS_SISTEMA = [
  { id: 'dashboard', label: 'Início', icon: '⌂', padraoUsuario: true },
  { id: 'gastos', label: 'Lançamentos', icon: '+', padraoUsuario: true },
  { id: 'receitas', label: 'Receitas', icon: '$', padraoUsuario: true },
  { id: 'parcelas', label: 'Cartões', icon: '▦', padraoUsuario: true },
  { id: 'metas', label: 'Metas', icon: '◎', padraoUsuario: true },
  { id: 'relatorios', label: 'Relatórios', icon: '▤', padraoUsuario: true },
  { id: 'importacao', label: 'Importar', icon: '⇧', padraoUsuario: false },
  { id: 'parametros', label: 'Configurações', icon: '⚙', padraoUsuario: false },
  { id: 'sql', label: 'SQL', icon: '{}', padraoUsuario: false, adminOnly: true, superAdminOnly: true },
];

export const TELAS_PADRAO_USUARIO = TELAS_SISTEMA
  .filter((tela) => tela.padraoUsuario && !tela.adminOnly)
  .map((tela) => tela.id);

export const TELAS_PADRAO_ADMIN = TELAS_SISTEMA
  .filter((tela) => !tela.superAdminOnly)
  .map((tela) => tela.id);

export const TELAS_PADRAO_SUPER_ADMIN = TELAS_SISTEMA.map((tela) => tela.id);
