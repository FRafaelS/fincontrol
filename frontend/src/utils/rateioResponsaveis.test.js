import {
  agruparPagamentosPorResponsavel,
  calcularValorIndividualPorDivisao,
  obterParticipantesDivisaoComum,
} from './rateioResponsaveis';

const lookupsResponsavel = [
  { LOOKUP_CODE: 'Rafael', MEANING: 'Rafael', ENABLED_FLAG: 'S' },
  { LOOKUP_CODE: 'Diana', MEANING: 'Diana', ENABLED_FLAG: 'S' },
  { LOOKUP_CODE: 'Diana e Rafael', MEANING: 'Diana e Rafael', ENABLED_FLAG: 'S' },
];

const lookupsDivisaoComum = [
  { LOOKUP_TYPE: 'DIVISAO_COMUM', LOOKUP_CODE: 'Rafael', MEANING: 'Diana e Rafael', TAG: '2', ENABLED_FLAG: 'S' },
  { LOOKUP_TYPE: 'DIVISAO_COMUM', LOOKUP_CODE: 'Diana', MEANING: 'Diana e Rafael', TAG: '2', ENABLED_FLAG: 'S' },
];

const estaPago = (gasto) => gasto.status === 'PAGO';
const normalizarPeriodo = (periodo) => periodo;

describe('rateio por responsáveis', () => {
  it('divide despesas comuns pelos participantes cadastrados na DIVISAO_COMUM', () => {
    const gastos = [
      {
        responsavel: 'Diana e Rafael',
        tipo: 'C',
        periodo: 'Q',
        valor_total: 100,
        valor_individual: 50,
        status: 'PENDENTE',
      },
      {
        responsavel: 'Rafael',
        tipo: 'I',
        periodo: 'F',
        valor_total: 80,
        valor_individual: 80,
        status: 'PENDENTE',
      },
    ];

    const resumo = agruparPagamentosPorResponsavel(gastos, {
      lookupsResponsavel,
      lookupsDivisaoComum,
      estaPago,
      normalizarPeriodo,
    });

    expect(resumo).toEqual([
      expect.objectContaining({ responsavel: 'Rafael', qtd: 2, aPagar: 130, quinzena: 50, finalMes: 80 }),
      expect.objectContaining({ responsavel: 'Diana', qtd: 1, aPagar: 50, quinzena: 50, finalMes: 0 }),
    ]);
  });

  it('mantem o responsavel original quando nao existe regra de divisao para o grupo', () => {
    const resumo = agruparPagamentosPorResponsavel([
      {
        responsavel: 'Outro grupo',
        tipo: 'C',
        periodo: 'Q',
        valor_total: 100,
        valor_individual: 50,
        status: 'PENDENTE',
      },
    ], {
      lookupsResponsavel,
      lookupsDivisaoComum,
      estaPago,
      normalizarPeriodo,
    });

    expect(resumo).toEqual([
      expect.objectContaining({ responsavel: 'Outro grupo', qtd: 1, aPagar: 50, quinzena: 50 }),
    ]);
  });

  it('usa a quantidade de participantes da lookup para a previa do valor individual', () => {
    expect(obterParticipantesDivisaoComum('Diana e Rafael', lookupsDivisaoComum, lookupsResponsavel))
      .toEqual(['Rafael', 'Diana']);
    expect(calcularValorIndividualPorDivisao(300, 'C', 'Diana e Rafael', lookupsDivisaoComum, lookupsResponsavel))
      .toBe(150);
  });
});
