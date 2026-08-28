import { toNumber } from './formatters';
import { getLookupLabel, normalizarLookups } from './lookups';

const texto = (valor) => String(valor ?? '').trim();

const normalizarChave = (valor) =>
  texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

const lookupAtiva = (lookup) => {
  const flag = texto(lookup.ENABLED_FLAG || lookup.enabled_flag || 'S').toUpperCase();
  return flag !== 'N';
};

const normalizarTipo = (tipo) => {
  const valor = normalizarChave(tipo);
  if (valor === 'I' || valor === 'INDIVIDUAL') return 'I';
  if (valor === 'C' || valor === 'COMPARTILHADO') return 'C';
  return valor;
};

const normalizarPeriodoPadrao = (periodo) => {
  const valor = normalizarChave(periodo);
  if (valor === 'Q' || valor === 'QUINZENA' || valor === 'QUIZENA') return 'Q';
  if (valor === 'F' || valor === 'FINAL' || valor === 'FINAL_MES' || valor === 'FIM_MES') return 'F';
  return valor;
};

const rotuloResponsavel = (responsavel, lookupsResponsavel = []) => {
  const label = getLookupLabel(lookupsResponsavel, responsavel);
  if (label && label !== '—') return label;
  return texto(responsavel) || 'Sem responsável';
};

const chavesResponsavel = (responsavel, lookupsResponsavel = []) => {
  const chaves = new Set();
  const adicionar = (valor) => {
    const chave = normalizarChave(valor);
    if (chave) chaves.add(chave);
  };

  adicionar(responsavel);
  adicionar(getLookupLabel(lookupsResponsavel, responsavel));

  normalizarLookups(lookupsResponsavel).forEach((lookup) => {
    const code = lookup.LOOKUP_CODE;
    const meaning = lookup.MEANING;
    const chaveResponsavel = normalizarChave(responsavel);
    if (!chaveResponsavel) return;

    if (normalizarChave(code) === chaveResponsavel || normalizarChave(meaning) === chaveResponsavel) {
      adicionar(code);
      adicionar(meaning);
    }
  });

  return chaves;
};

export const obterParticipantesDivisaoComum = (
  responsavel,
  lookupsDivisaoComum = [],
  lookupsResponsavel = []
) => {
  const gruposPossiveis = chavesResponsavel(responsavel, lookupsResponsavel);
  if (gruposPossiveis.size === 0) return [];

  const adicionados = new Set();
  const participantes = [];

  normalizarLookups(lookupsDivisaoComum).forEach((lookup) => {
    if (!lookupAtiva(lookup)) return;
    if (!gruposPossiveis.has(normalizarChave(lookup.MEANING))) return;

    const participante = texto(lookup.LOOKUP_CODE);
    const chaveParticipante = normalizarChave(participante);
    if (!participante || adicionados.has(chaveParticipante)) return;

    adicionados.add(chaveParticipante);
    participantes.push(rotuloResponsavel(participante, lookupsResponsavel));
  });

  return participantes;
};

export const obterDivisorComum = (
  lookupsDivisaoComum = [],
  responsavel = '',
  lookupsResponsavel = []
) => {
  const participantes = obterParticipantesDivisaoComum(
    responsavel,
    lookupsDivisaoComum,
    lookupsResponsavel
  );
  if (participantes.length > 0) return participantes.length;

  const lookup = normalizarLookups(lookupsDivisaoComum).find(lookupAtiva) || {};
  const divisor = [lookup.TAG, lookup.MEANING, lookup.LOOKUP_CODE]
    .map(toNumber)
    .find((valor) => valor > 0);

  return divisor || 2;
};

export const calcularValorIndividualPorDivisao = (
  valorTotal,
  tipo,
  responsavel,
  lookupsDivisaoComum = [],
  lookupsResponsavel = []
) => {
  const total = toNumber(valorTotal);
  const tipoNormalizado = normalizarTipo(tipo);
  if (tipoNormalizado === 'I') return total;
  if (tipoNormalizado === 'C') {
    return total / Math.max(obterDivisorComum(lookupsDivisaoComum, responsavel, lookupsResponsavel), 1);
  }
  return 0;
};

export const calcularParticipacoesGasto = (
  gasto = {},
  { lookupsResponsavel = [], lookupsDivisaoComum = [] } = {}
) => {
  const tipo = normalizarTipo(gasto.tipo);
  const total = toNumber(gasto.valor_total);
  const individual = toNumber(gasto.valor_individual);

  if (tipo === 'C') {
    const participantes = obterParticipantesDivisaoComum(
      gasto.responsavel,
      lookupsDivisaoComum,
      lookupsResponsavel
    );

    if (participantes.length > 0) {
      const valorRateado = total > 0 ? total / participantes.length : individual;
      return participantes.map((responsavel) => ({
        responsavel,
        valorCheio: total,
        valorIndividual: valorRateado,
        dividido: true,
      }));
    }
  }

  return [{
    responsavel: rotuloResponsavel(gasto.responsavel, lookupsResponsavel),
    valorCheio: total,
    valorIndividual: individual > 0 ? individual : total,
    dividido: false,
  }];
};

export const agruparPagamentosPorResponsavel = (
  gastos = [],
  {
    lookupsResponsavel = [],
    lookupsDivisaoComum = [],
    estaPago = () => false,
    normalizarPeriodo = normalizarPeriodoPadrao,
  } = {}
) => {
  const agrupado = gastos.reduce((acc, gasto) => {
    const periodo = normalizarPeriodo(gasto.periodo);
    const pendente = !estaPago(gasto);
    const participacoes = calcularParticipacoesGasto(gasto, {
      lookupsResponsavel,
      lookupsDivisaoComum,
    });

    participacoes.forEach((item) => {
      const chave = normalizarChave(item.responsavel) || item.responsavel;
      if (!acc[chave]) {
        acc[chave] = {
          responsavel: item.responsavel,
          qtd: 0,
          totalCheio: 0,
          totalIndividual: 0,
          aPagar: 0,
          quinzena: 0,
          finalMes: 0,
        };
      }

      acc[chave].qtd += 1;
      acc[chave].totalCheio += item.valorCheio;
      acc[chave].totalIndividual += item.valorIndividual;

      if (pendente) {
        acc[chave].aPagar += item.valorIndividual;
        if (periodo === 'Q') acc[chave].quinzena += item.valorIndividual;
        if (periodo === 'F') acc[chave].finalMes += item.valorIndividual;
      }
    });

    return acc;
  }, {});

  return Object.values(agrupado)
    .sort((a, b) => b.aPagar - a.aPagar || b.totalIndividual - a.totalIndividual);
};
