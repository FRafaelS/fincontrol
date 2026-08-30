const executar = (executor, sql, params = []) => {
  if (typeof executor === 'function') return executor(sql, params);
  return executor.query(sql, params);
};

const LOOKUP_TYPES_PADRAO = [
  ['LOOKUP TYPE', 'CATEGORIA', 'Categoria de gasto', 'S'],
  ['LOOKUP TYPE', 'FORMA_PGTO', 'Forma de pagamento', 'S'],
  ['LOOKUP TYPE', 'RESPONSAVEL', 'Responsavel pelo gasto', 'S'],
  ['LOOKUP TYPE', 'STATUS_GASTO', 'Status do gasto', 'S'],
  ['LOOKUP TYPE', 'TIPO_GASTO', 'Tipo do gasto', 'S'],
  ['LOOKUP TYPE', 'CONFIG_ALERTAS', 'Configuracoes de alertas', 'S'],
  ['LOOKUP TYPE', 'CONFIG_SISTEMA', 'Configuracoes do sistema', 'S'],
  ['LOOKUP TYPE', 'DIVISAO_COMUM', 'Divisao comum', 'S'],
];

const LOOKUPS_OPERACIONAIS_PADRAO = [
  ['STATUS_GASTO', 'Pendente', 'PENDENTE', 'S'],
  ['STATUS_GASTO', 'Pago', 'PAGO', 'S'],
  ['TIPO_GASTO', 'Individual', 'I', 'S'],
  ['TIPO_GASTO', 'Compartilhado', 'C', 'S'],
  ['CONFIG_ALERTAS', 'DIAS_ALERTA_VENCIMENTO', 'Dias de antecedencia', 'S', '7'],
  ['CONFIG_SISTEMA', 'SQL_IDE_ENABLED', 'Ativar SQL IDE', 'S', 'N'],
  ['DIVISAO_COMUM', 'PADRAO', 'Divisao padrao', 'S', '2'],
];

const LOOKUPS_EXEMPLO_CONTA_PADRAO = [
  ['CATEGORIA', 'ELETRONICOS', 'Eletronicos', 'S'],
  ['CATEGORIA', 'SERVICOS', 'Servicos', 'S'],
  ['CATEGORIA', 'TRANSPORTE', 'Transporte', 'S'],
  ['CATEGORIA', 'ALIMENTACAO', 'Alimentacao', 'S'],
  ['CATEGORIA', 'SAUDE', 'Saude', 'S'],
  ['CATEGORIA', 'EDUCACAO', 'Educacao', 'S'],
  ['CATEGORIA', 'LAZER', 'Lazer', 'S'],
  ['CATEGORIA', 'OUTROS', 'Outros', 'S'],
  ['FORMA_PGTO', 'CARTAO_BRADESCO', 'Cartao Bradesco', 'S'],
  ['FORMA_PGTO', 'CARTAO_NUBANK', 'Cartao Nubank', 'S'],
  ['FORMA_PGTO', 'PIX', 'Pix', 'S'],
  ['FORMA_PGTO', 'DINHEIRO', 'Dinheiro', 'S'],
  ['FORMA_PGTO', 'DEBITO', 'Debito', 'S'],
  ['RESPONSAVEL', 'Rafael Silva', 'R', 'S', '1'],
  ['RESPONSAVEL', 'Diana Paula', 'D', 'S', '1'],
  ['RESPONSAVEL', 'Rafael e Diana', 'RD', 'S', '2'],
];

const LOOKUPS_PADRAO = [
  ...LOOKUP_TYPES_PADRAO,
  ...LOOKUPS_OPERACIONAIS_PADRAO,
  ...LOOKUPS_EXEMPLO_CONTA_PADRAO,
];

const LOOKUPS_NOVA_CONTA = [
  ...LOOKUP_TYPES_PADRAO,
  ...LOOKUPS_OPERACIONAIS_PADRAO,
];

const normalizarSlug = (valor) => {
  const slug = String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return slug || 'conta';
};

const buscarSlugDisponivel = async (executor, nome, slugInformado = '') => {
  const base = normalizarSlug(slugInformado || nome);
  let tentativa = base;
  let contador = 2;

  while (true) {
    const existente = await executar(executor, 'SELECT id FROM tenants WHERE slug = $1', [tentativa]);
    if (existente.rows.length === 0) return tentativa;
    tentativa = `${base}-${contador}`;
    contador += 1;
  }
};

const garantirLookupsPadrao = async (executor, tenantId, opcoes = {}) => {
  if (!tenantId) return;

  const lookups = opcoes.incluirExemplos ? LOOKUPS_PADRAO : LOOKUPS_NOVA_CONTA;

  for (const [type, code, meaning, flag, tag = ''] of lookups) {
    await executar(
      executor,
      `INSERT INTO mdr_lookup (tenant_id, lookup_type, lookup_code, meaning, enabled_flag, tag)
       SELECT $1::integer, $2::varchar(30), $3::varchar(30), $4::varchar(80), $5::varchar(1), $6::varchar(150)
       WHERE NOT EXISTS (
         SELECT 1 FROM mdr_lookup
         WHERE tenant_id = $1::integer
           AND lookup_type = $2::varchar(30)
           AND lookup_code = $3::varchar(30)
       )`,
      [tenantId, type, code, meaning, flag, tag]
    );

    if (tag) {
      await executar(
        executor,
        `UPDATE mdr_lookup
         SET tag = $4, updated_at = NOW()
         WHERE tenant_id = $1
           AND lookup_type = $2
           AND lookup_code = $3
           AND (tag IS NULL OR tag = '')`,
        [tenantId, type, code, tag]
      );
    }
  }
};

const limparLookupsExemploOutrasContas = async (executor, tenantPadraoId) => {
  if (!tenantPadraoId) return;

  const pares = LOOKUPS_EXEMPLO_CONTA_PADRAO.map(([lookupType, lookupCode]) => [lookupType, lookupCode]);

  await executar(
    executor,
    `DELETE FROM mdr_lookup
     WHERE tenant_id <> $1
       AND (lookup_type, lookup_code) IN (
         SELECT lookup_type, lookup_code
         FROM UNNEST($2::text[], $3::text[]) AS exemplo(lookup_type, lookup_code)
       )`,
    [
      tenantPadraoId,
      pares.map(([lookupType]) => lookupType),
      pares.map(([, lookupCode]) => lookupCode),
    ]
  );
};


const garantirTenantPadrao = async (executor, config = {}) => {
  const nome = String(config.nome || 'Familia Raphael').trim();
  const slug = normalizarSlug(config.slug || nome);
  const descricao = String(config.descricao || 'Conta padrao criada automaticamente').trim();

  await executar(
    executor,
    `INSERT INTO tenants (nome, slug, descricao, ativo)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (slug) DO NOTHING`,
    [nome, slug, descricao]
  );

  const result = await executar(executor, 'SELECT * FROM tenants WHERE slug = $1 LIMIT 1', [slug]);
  return result.rows[0] || null;
};

const criarTenant = async (executor, { nome, descricao = '', slug = '', ownerUsuarioId = null }) => {
  const nomeFinal = String(nome || '').trim();
  if (!nomeFinal) throw new Error('Nome da conta e obrigatorio.');

  const slugFinal = await buscarSlugDisponivel(executor, nomeFinal, slug);
  const result = await executar(
    executor,
    `INSERT INTO tenants (nome, slug, descricao, owner_usuario_id, ativo)
     VALUES ($1, $2, $3, $4, 1)
     RETURNING *`,
    [nomeFinal, slugFinal, String(descricao || '').trim(), ownerUsuarioId]
  );

  const tenant = result.rows[0];
  await garantirLookupsPadrao(executor, tenant.id);
  return tenant;
};

module.exports = {
  LOOKUPS_PADRAO,
  LOOKUPS_NOVA_CONTA,
  normalizarSlug,
  buscarSlugDisponivel,
  garantirLookupsPadrao,
  garantirTenantPadrao,
  limparLookupsExemploOutrasContas,
  criarTenant,
};
