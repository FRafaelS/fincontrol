export const normalizarLookup = (lookup = {}) => ({
  ID: lookup.ID ?? lookup.id ?? '',
  LOOKUP_TYPE: lookup.LOOKUP_TYPE ?? lookup.lookup_type ?? '',
  LOOKUP_CODE: lookup.LOOKUP_CODE ?? lookup.lookup_code ?? '',
  MEANING: lookup.MEANING ?? lookup.meaning ?? '',
  DESCRIPTION: lookup.DESCRIPTION ?? lookup.description ?? '',
  TAG: lookup.TAG ?? lookup.tag ?? '',
  ENABLED_FLAG: lookup.ENABLED_FLAG ?? lookup.enabled_flag ?? 'S',
  ATTRIBUTE1: lookup.ATTRIBUTE1 ?? lookup.attribute1 ?? '',
  ATTRIBUTE2: lookup.ATTRIBUTE2 ?? lookup.attribute2 ?? '',
  ATTRIBUTE3: lookup.ATTRIBUTE3 ?? lookup.attribute3 ?? '',
});

export const normalizarLookups = (dados) =>
  Array.isArray(dados) ? dados.map(normalizarLookup) : [];

export const getLookupLabel = (lista, valor) => {
  if (!valor) return '—';
  const valorTexto = String(valor);
  const item = normalizarLookups(lista).find(
    (lookup) => String(lookup.MEANING) === valorTexto || String(lookup.LOOKUP_CODE) === valorTexto
  );
  return item?.LOOKUP_CODE || valorTexto;
};

export const lookupKey = (lookup) => {
  const item = normalizarLookup(lookup);
  return item.ID || `${item.LOOKUP_TYPE}-${item.LOOKUP_CODE}-${item.MEANING}`;
};
