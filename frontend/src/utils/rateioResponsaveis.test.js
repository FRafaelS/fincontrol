import {
  agruparPagamentosPorResponsavel,
  calcularValorCompraGasto,
  calcularValorParcela,
  calcularValorTotalPeriodoGasto,
  calcularValorIndividualPorDivisao,
  obterTotalParcelas,
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

  it('calcula o valor mensal antes de dividir uma compra parcelada', () => {
    expect(obterTotalParcelas('01 DE 12')).toBe(12);
    expect(calcularValorParcela(2999.64, '01 DE 12')).toBeCloseTo(249.97, 2);
    expect(calcularValorIndividualPorDivisao(
      2999.64,
      'C',
      'Diana e Rafael',
      lookupsDivisaoComum,
      lookupsResponsavel,
      '01 DE 12'
    )).toBeCloseTo(124.99, 2);
  });

  it('usa o valor da parcela no resumo quando o gasto antigo guardou o valor cheio da compra', () => {
    const gasto = {
      responsavel: 'Diana e Rafael',
      tipo: 'C',
      periodo: 'Q',
      parcela: '01 DE 12',
      valor_total: 2999.64,
      valor_individual: 124.99,
      status: 'PENDENTE',
    };

    expect(calcularValorTotalPeriodoGasto(gasto, {
      lookupsResponsavel,
      lookupsDivisaoComum,
    })).toBeCloseTo(249.97, 2);

    const resumo = agruparPagamentosPorResponsavel([gasto], {
      lookupsResponsavel,
      lookupsDivisaoComum,
      estaPago,
      normalizarPeriodo,
    });

    const rafael = resumo.find((item) => item.responsavel === 'Rafael');
    const diana = resumo.find((item) => item.responsavel === 'Diana');

    expect(rafael.qtd).toBe(1);
    expect(rafael.aPagar).toBeCloseTo(124.99, 2);
    expect(rafael.quinzena).toBeCloseTo(124.99, 2);
    expect(diana.qtd).toBe(1);
    expect(diana.aPagar).toBeCloseTo(124.99, 2);
    expect(diana.quinzena).toBeCloseTo(124.99, 2);
  });

  it('reconstroi o valor cheio da compra quando o registro antigo ja esta salvo pelo valor da parcela', () => {
    const gasto = {
      responsavel: 'Diana e Rafael',
      tipo: 'C',
      parcela: '01 DE 12',
      valor_total: 249.97,
      valor_individual: 124.99,
    };

    expect(calcularValorTotalPeriodoGasto(gasto, {
      lookupsResponsavel,
      lookupsDivisaoComum,
    })).toBeCloseTo(249.97, 2);
    expect(calcularValorCompraGasto(gasto, {
      lookupsResponsavel,
      lookupsDivisaoComum,
    })).toBeCloseTo(2999.64, 2);
  });

  it('soma o rateio pelo total consolidado, sem acumular arredondamento por linha', () => {
    const totais = [
      2394.50, 179.60, 326.59, 89.99, 95.33, 120.00, 97.99,
      129.47, 80.95, 269.85, 837.96, 298.88, 262.48, 66.90,
      19.99, 98.91, 111.45, 56.25, 249.97, 293.99, 995.55,
    ];
    const gastos = totais.map((valor_total) => ({
      responsavel: 'Diana e Rafael',
      tipo: 'C',
      periodo: 'Q',
      valor_total,
      status: 'PENDENTE',
    }));

    const resumo = agruparPagamentosPorResponsavel(gastos, {
      lookupsResponsavel,
      lookupsDivisaoComum,
      estaPago,
      normalizarPeriodo,
    });

    expect(totais.reduce((s, total) => s + total, 0)).toBeCloseTo(7076.60, 2);
    expect(resumo.find((item) => item.responsavel === 'Rafael').aPagar).toBeCloseTo(3538.30, 2);
    expect(resumo.find((item) => item.responsavel === 'Diana').aPagar).toBeCloseTo(3538.30, 2);
  });
});
