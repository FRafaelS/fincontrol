// Converte DD/MM/AA para objeto Date
export function parseData(dataStr) {
  if (!dataStr) return null;
  const partes = dataStr.split('/');
  if (partes.length !== 3) return null;
  const [dia, mes, ano] = partes;
  const anoFull = ano.length === 2 ? `20${ano}` : ano;
  const date = new Date(`${anoFull}-${mes.padStart(2,'0')}-${dia.padStart(2,'0')}`);
  return isNaN(date.getTime()) ? null : date;
}

// Retorna diferença em dias entre hoje e a data (negativo = vencido)
export function diasParaVencer(dataStr) {
  const data = parseData(dataStr);
  if (!data) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  data.setHours(0, 0, 0, 0);
  return Math.floor((data - hoje) / (1000 * 60 * 60 * 24));
}

// Classifica o status do vencimento
export function classificarVencimento(dataStr, diasAlerta = 7) {
  const dias = diasParaVencer(dataStr);
  if (dias === null) return 'normal';
  if (dias < 0) return 'vencido';
  if (dias === 0) return 'hoje';
  if (dias <= diasAlerta) return 'proximo';
  return 'normal';
}