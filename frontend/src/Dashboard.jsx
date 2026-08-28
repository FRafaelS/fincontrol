import React from 'react';
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatarMoeda, percentual, toNumber } from './utils/formatters';
import { agruparPagamentosPorResponsavel } from './utils/rateioResponsaveis';

const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
const CORES_CATEGORIAS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#0EA5E9', '#8B5CF6'];

const PERIODOS_GASTO = [
  { value: 'Q', label: 'Quinzena' },
  { value: 'F', label: 'Final do mês' },
];

const cores = {
  principal: 'var(--app-primary)',
  destaque: 'var(--app-accent)',
  fundo: 'var(--app-bg)',
  borda: 'var(--app-border)',
  texto: 'var(--app-text)',
  textoSuave: 'var(--app-muted)',
  positivo: 'var(--app-success)',
  negativo: 'var(--app-danger)',
  alerta: 'var(--app-warning)',
};

const periodoAtual = () => {
  const hoje = new Date();
  return `${MESES[hoje.getMonth()]}/${hoje.getFullYear()}`;
};

const separarPeriodo = (periodo = periodoAtual()) => {
  const [mes, ano] = String(periodo).split('/');
  return { mes, ano: Number(ano) || new Date().getFullYear() };
};

const periodoAnterior = (periodo) => {
  const { mes, ano } = separarPeriodo(periodo);
  const idx = MESES.indexOf(mes);
  if (idx <= 0) return `${MESES[11]}/${ano - 1}`;
  return `${MESES[idx - 1]}/${ano}`;
};

const obterDia = (dataVenc) => {
  const partes = String(dataVenc || '').split('/');
  if (partes.length !== 3) return null;
  const dia = Number(partes[0]);
  return Number.isFinite(dia) && dia > 0 ? dia : null;
};

const variacao = (atual, anterior) => {
  const base = toNumber(anterior);
  const valorAtual = toNumber(atual);
  if (base === 0 && valorAtual === 0) return 0;
  if (base === 0) return 100;
  return ((valorAtual - base) / base) * 100;
};

const normalizarStatusGasto = (status) => {
  const valor = String(status || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (valor === 'PAGO') return 'PAGO';
  if (valor === 'PENDENTE') return 'PENDENTE';
  return valor;
};

const normalizarPeriodoGasto = (periodo) => {
  const valor = String(periodo || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (valor === 'Q' || valor === 'QUINZENA' || valor === 'QUIZENA') return 'Q';
  if (valor === 'F' || valor === 'FINAL' || valor === 'FINAL_MES' || valor === 'FIM_MES') return 'F';
  return '';
};

const estaPago = (gasto) => normalizarStatusGasto(gasto.status) === 'PAGO';
const valorTotal = (gasto) => toNumber(gasto.valor_total);
const valorReceita = (receita) => toNumber(receita.valor);

function Dashboard({
  gastos,
  receitas = [],
  periodoSelecionado = periodoAtual(),
  onAdicionarLancamento,
  onAdicionarReceita,
  lookupsResponsavel = [],
  lookupsDivisaoComum = [],
}) {
  const { mes, ano } = separarPeriodo(periodoSelecionado);
  const periodoAnteriorSelecionado = periodoAnterior(periodoSelecionado);
  const { mes: mesAnterior, ano: anoAnterior } = separarPeriodo(periodoAnteriorSelecionado);

  const gastosPeriodo = gastos.filter((g) => g.mes === mes && Number(g.ano) === ano);
  const gastosPeriodoAnterior = gastos.filter((g) => g.mes === mesAnterior && Number(g.ano) === anoAnterior);
  const receitasPeriodo = receitas.filter((r) => r.mes === mes && Number(r.ano) === ano);
  const receitasPeriodoAnterior = receitas.filter((r) => r.mes === mesAnterior && Number(r.ano) === anoAnterior);

  const receitasMes = receitasPeriodo.reduce((s, r) => s + valorReceita(r), 0);
  const receitasMesAnterior = receitasPeriodoAnterior.reduce((s, r) => s + valorReceita(r), 0);
  const despesasMes = gastosPeriodo.reduce((s, g) => s + valorTotal(g), 0);
  const despesasMesAnterior = gastosPeriodoAnterior.reduce((s, g) => s + valorTotal(g), 0);
  const porResponsavel = agruparPagamentosPorResponsavel(gastosPeriodo, {
    lookupsResponsavel,
    lookupsDivisaoComum,
    estaPago,
    normalizarPeriodo: normalizarPeriodoGasto,
  });
  const porResponsavelAnterior = agruparPagamentosPorResponsavel(gastosPeriodoAnterior, {
    lookupsResponsavel,
    lookupsDivisaoComum,
    estaPago,
    normalizarPeriodo: normalizarPeriodoGasto,
  });
  const despesasRateadasMes = porResponsavel.reduce((s, r) => s + r.totalIndividual, 0);
  const aPagarMes = porResponsavel.reduce((s, r) => s + r.aPagar, 0);
  const aPagarMesAnterior = porResponsavelAnterior.reduce((s, r) => s + r.aPagar, 0);
  const saldoTotal = receitasMes - despesasMes;

  const idxMes = MESES.indexOf(mes);
  const diasNoMes = idxMes >= 0 ? new Date(ano, idxMes + 1, 0).getDate() : 31;
  const fluxoCaixa = Array.from({ length: diasNoMes }, (_, i) => {
    const dia = i + 1;
    const entradas = receitasPeriodo
      .filter((r) => obterDia(r.data_receita) === dia)
      .reduce((s, r) => s + valorReceita(r), 0);
    const saidas = gastosPeriodo
      .filter((g) => obterDia(g.data_venc) === dia)
      .reduce((s, g) => s + valorTotal(g), 0);
    return { dia: String(dia).padStart(2, '0'), entradas, saidas };
  });

  const porCategoria = Object.values(
    gastosPeriodo.reduce((acc, g) => {
      const categoria = g.categoria || 'Sem categoria';
      if (!acc[categoria]) acc[categoria] = { categoria, total: 0 };
      acc[categoria].total += valorTotal(g);
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);

  const porPeriodoPagamento = PERIODOS_GASTO.map((periodo) => {
    const itens = gastosPeriodo.filter((g) => normalizarPeriodoGasto(g.periodo) === periodo.value);
    const resumoResponsaveis = agruparPagamentosPorResponsavel(itens, {
      lookupsResponsavel,
      lookupsDivisaoComum,
      estaPago,
      normalizarPeriodo: normalizarPeriodoGasto,
    });
    return {
      ...periodo,
      qtd: itens.length,
      totalCheio: itens.reduce((s, g) => s + valorTotal(g), 0),
      aPagar: resumoResponsaveis.reduce((s, r) => s + r.aPagar, 0),
    };
  });

  return (
    <div style={{ position: 'relative', maxWidth: '1240px', margin: '0 auto', paddingBottom: '92px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '18px' }}>
        <ResumoCard
          titulo="Saldo do mês"
          valor={formatarMoeda(saldoTotal)}
          variacao={variacao(saldoTotal, receitasMesAnterior - despesasMesAnterior)}
          cor={saldoTotal >= 0 ? cores.positivo : cores.negativo}
        />
        <ResumoCard
          titulo="Receitas"
          valor={formatarMoeda(receitasMes)}
          variacao={variacao(receitasMes, receitasMesAnterior)}
          cor={cores.positivo}
        />
        <ResumoCard
          titulo="Despesa cheia"
          valor={formatarMoeda(despesasMes)}
          variacao={variacao(despesasMes, despesasMesAnterior)}
          cor={cores.negativo}
        />
        <ResumoCard
          titulo="A pagar"
          valor={formatarMoeda(aPagarMes)}
          variacao={variacao(aPagarMes, aPagarMesAnterior)}
          cor={cores.alerta}
          sub={`${formatarMoeda(despesasRateadasMes)} rateado no mês`}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '18px', marginBottom: '18px' }}>
        <section style={painel}>
          <div style={cabecalhoPainel}>
            <div>
              <h2 style={tituloPainel}>A pagar por responsável</h2>
              <p style={subtituloPainel}>Valores pendentes usando a divisão comum</p>
            </div>
            <span style={pill}>{formatarMoeda(aPagarMes)}</span>
          </div>
          {porResponsavel.length > 0 ? (
            <div style={{ display: 'grid', gap: '10px' }}>
              {porResponsavel.map((item) => (
                <div key={item.responsavel} style={linhaResponsavel}>
                  <div style={{ minWidth: 0 }}>
                    <p style={nomeLinha}>{item.responsavel}</p>
                    <p style={detalheLinha}>{item.qtd} lançamento(s) · total rateado {formatarMoeda(item.totalIndividual)}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ display: 'block', color: cores.texto, fontSize: '16px' }}>{formatarMoeda(item.aPagar)}</strong>
                    <span style={{ color: cores.textoSuave, fontSize: '12px', fontWeight: '700' }}>
                      Q {formatarMoeda(item.quinzena)} · F {formatarMoeda(item.finalMes)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Vazio texto="Sem despesas neste período." />
          )}
        </section>

        <section style={painel}>
          <div style={cabecalhoPainel}>
            <div>
              <h2 style={tituloPainel}>Quinzena e final</h2>
              <p style={subtituloPainel}>Pendente por período de pagamento</p>
            </div>
          </div>
          <div style={{ display: 'grid', gap: '12px' }}>
            {porPeriodoPagamento.map((item) => (
              <div key={item.value} style={boxPeriodo}>
                <div>
                  <p style={nomeLinha}>{item.value} - {item.label}</p>
                  <p style={detalheLinha}>{item.qtd} lançamento(s) · cheio {formatarMoeda(item.totalCheio)}</p>
                </div>
                <strong style={{ color: item.value === 'Q' ? cores.destaque : cores.alerta, fontSize: '18px' }}>
                  {formatarMoeda(item.aPagar)}
                </strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '18px', marginBottom: '18px' }}>
        <section style={painel}>
          <div style={cabecalhoPainel}>
            <div>
              <h2 style={tituloPainel}>Despesas por categoria</h2>
              <p style={subtituloPainel}>{porCategoria.length} categoria(s)</p>
            </div>
          </div>
          {porCategoria.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie
                    data={porCategoria}
                    dataKey="total"
                    nameKey="categoria"
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={92}
                    paddingAngle={3}
                  >
                    {porCategoria.map((_, index) => (
                      <Cell key={index} fill={CORES_CATEGORIAS[index % CORES_CATEGORIAS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => formatarMoeda(v)}
                    contentStyle={tooltip}
                    itemStyle={{ color: 'var(--app-text)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'grid', gap: '10px' }}>
                {porCategoria.slice(0, 5).map((item, index) => (
                  <div key={item.categoria} style={{ display: 'grid', gridTemplateColumns: '14px 1fr auto', gap: '8px', alignItems: 'center' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: CORES_CATEGORIAS[index % CORES_CATEGORIAS.length] }} />
                    <span style={{ color: cores.texto, fontSize: '13px', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.categoria}</span>
                    <span style={{ color: cores.textoSuave, fontSize: '12px', fontWeight: '700' }}>{percentual(item.total, despesasMes).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <Vazio texto="Sem despesas neste período." />
          )}
        </section>

        <section style={painel}>
          <div style={cabecalhoPainel}>
            <div>
              <h2 style={tituloPainel}>Fluxo de caixa</h2>
              <p style={subtituloPainel}>{periodoSelecionado}</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', fontSize: '12px', color: cores.textoSuave, fontWeight: '700' }}>
              <span><span style={legenda(cores.positivo)} />Entradas</span>
              <span><span style={legenda(cores.negativo)} />Saídas</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={310}>
            <LineChart data={fluxoCaixa} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="var(--app-border)" />
              <XAxis dataKey="dia" tick={{ fontSize: 12, fill: cores.textoSuave }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 12, fill: cores.textoSuave }} tickFormatter={(v) => `R$${v}`} width={64} />
              <Tooltip
                formatter={(v, name) => [formatarMoeda(v), name === 'entradas' ? 'Entradas' : 'Saídas']}
                contentStyle={tooltip}
                labelStyle={{ color: 'var(--app-muted)' }}
                itemStyle={{ color: 'var(--app-text)' }}
              />
              <Line type="monotone" dataKey="entradas" stroke={cores.positivo} strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="saidas" stroke={cores.negativo} strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      </div>

      <div style={{ position: 'fixed', right: '28px', bottom: '28px', display: 'grid', gap: '10px', zIndex: 150 }}>
        {onAdicionarReceita && (
          <button
            onClick={onAdicionarReceita}
            title="Adicionar receita"
            style={{ ...fab, background: cores.positivo, boxShadow: '0 18px 34px rgba(16,185,129,0.30)', fontSize: '22px' }}
          >
            $
          </button>
        )}
        {onAdicionarLancamento && (
          <button
            onClick={onAdicionarLancamento}
            title="Adicionar lançamento"
            style={{ ...fab, background: cores.destaque, boxShadow: '0 18px 34px rgba(99,102,241,0.36)' }}
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}

function ResumoCard({ titulo, valor, variacao: valorVariacao, cor, sub }) {
  const variacaoFormatada = `${valorVariacao >= 0 ? '+' : ''}${valorVariacao.toFixed(0)}% que o mês passado`;

  return (
    <section style={cardResumo}>
      <p style={cardLabel}>{titulo}</p>
      <p style={{ ...cardValor, color: cor }}>{valor}</p>
      <p style={{ ...cardSub, color: valorVariacao >= 0 ? cores.positivo : cores.negativo }}>
        {sub || variacaoFormatada}
      </p>
    </section>
  );
}

function Vazio({ texto }) {
  return (
    <div style={{ minHeight: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: cores.textoSuave, fontSize: '14px' }}>
      {texto}
    </div>
  );
}

const legenda = (cor) => ({
  display: 'inline-block',
  width: '9px',
  height: '9px',
  borderRadius: '3px',
  background: cor,
  marginRight: '6px',
});

const painel = {
  background: 'var(--app-surface)',
  border: `1px solid ${cores.borda}`,
  borderRadius: '8px',
  padding: '20px',
  boxShadow: 'var(--app-shadow)',
};
const cabecalhoPainel = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' };
const tituloPainel = { margin: 0, fontSize: '16px', fontWeight: '800', color: cores.texto };
const subtituloPainel = { margin: '3px 0 0', fontSize: '13px', color: cores.textoSuave };
const cardResumo = { ...painel, minHeight: '132px' };
const cardLabel = { margin: '0 0 10px', fontSize: '12px', color: cores.textoSuave, textTransform: 'uppercase', letterSpacing: 0, fontWeight: '800' };
const cardValor = { margin: '0 0 8px', fontSize: '30px', fontWeight: '900' };
const cardSub = { margin: 0, fontSize: '12px', fontWeight: '800' };
const pill = { display: 'inline-flex', minHeight: '28px', alignItems: 'center', borderRadius: '999px', background: 'var(--app-warning-soft)', color: 'var(--app-warning-text)', border: '1px solid var(--app-warning)', padding: '0 10px', fontSize: '12px', fontWeight: '900', whiteSpace: 'nowrap' };
const linhaResponsavel = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '12px', alignItems: 'center', border: `1px solid ${cores.borda}`, borderRadius: '8px', padding: '12px', background: 'var(--app-surface-soft)' };
const boxPeriodo = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', border: `1px solid ${cores.borda}`, borderRadius: '8px', padding: '14px', background: 'var(--app-surface-soft)' };
const nomeLinha = { margin: 0, color: cores.texto, fontSize: '14px', fontWeight: '800', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const detalheLinha = { margin: '3px 0 0', color: cores.textoSuave, fontSize: '12px', fontWeight: '700' };
const tooltip = { background: 'var(--app-surface)', border: '1px solid var(--app-border)', borderRadius: '8px', color: 'var(--app-text)', boxShadow: 'var(--app-shadow)' };
const fab = {
  width: '58px',
  height: '58px',
  borderRadius: '18px',
  border: 'none',
  color: '#fff',
  fontSize: '28px',
  lineHeight: 1,
  cursor: 'pointer',
  fontWeight: '900',
};

export default Dashboard;
