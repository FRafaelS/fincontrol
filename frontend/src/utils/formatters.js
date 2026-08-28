export const toNumber = (valor) => {
  if (valor === null || valor === undefined || valor === '') return 0;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;

  const texto = String(valor)
    .replace(/[R$\s]/g, '')
    .trim();

  if (!texto) return 0;

  const normalizado = texto.includes(',')
    ? texto.replace(/\./g, '').replace(',', '.')
    : texto;

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : 0;
};

export const formatarMoeda = (valor) =>
  toNumber(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

export const percentual = (parte, total) => {
  const totalNumero = toNumber(total);
  if (totalNumero <= 0) return 0;
  return (toNumber(parte) / totalNumero) * 100;
};
