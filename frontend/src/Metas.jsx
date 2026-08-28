import React, { useEffect, useState } from 'react';
import { formatarMoeda, percentual, toNumber } from './utils/formatters';

const cores = {
  principal: 'var(--app-primary)',
  destaque: 'var(--app-accent)',
  borda: 'var(--app-border)',
  texto: 'var(--app-text)',
  textoSuave: 'var(--app-muted)',
  positivo: 'var(--app-success)',
  negativo: 'var(--app-danger)',
  alerta: 'var(--app-warning)',
};

const separarPeriodo = (periodo) => {
  const [mes, ano] = String(periodo || '').split('/');
  return { mes, ano: Number(ano) };
};

function Metas({ gastos, periodoSelecionado }) {
  const [metaMensal, setMetaMensal] = useState(() => localStorage.getItem('meta_mensal') || '');
  const [mensagem, setMensagem] = useState('');
  const { mes, ano } = separarPeriodo(periodoSelecionado);

  const despesasMes = gastos
    .filter((g) => g.mes === mes && Number(g.ano) === ano)
    .reduce((s, g) => s + toNumber(g.valor_individual), 0);

  const meta = toNumber(metaMensal);
  const usado = percentual(despesasMes, meta);
  const restante = meta - despesasMes;
  const corProgresso = usado >= 100 ? cores.negativo : usado >= 80 ? cores.alerta : cores.positivo;

  useEffect(() => {
    if (!mensagem) return undefined;
    const timer = setTimeout(() => setMensagem(''), 2200);
    return () => clearTimeout(timer);
  }, [mensagem]);

  const salvarMeta = (e) => {
    e.preventDefault();
    localStorage.setItem('meta_mensal', String(toNumber(metaMensal)));
    setMetaMensal(String(toNumber(metaMensal)));
    setMensagem('Meta salva.');
  };

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '18px' }}>
        <section style={painel}>
          <p style={label}>Meta do mês</p>
          <p style={{ ...valor, color: cores.destaque }}>{formatarMoeda(meta)}</p>
          <p style={sub}>{periodoSelecionado}</p>
        </section>
        <section style={painel}>
          <p style={label}>Gasto atual</p>
          <p style={{ ...valor, color: cores.negativo }}>{formatarMoeda(despesasMes)}</p>
          <p style={sub}>{usado.toFixed(0)}% da meta</p>
        </section>
        <section style={painel}>
          <p style={label}>Disponível</p>
          <p style={{ ...valor, color: restante >= 0 ? cores.positivo : cores.negativo }}>{formatarMoeda(restante)}</p>
          <p style={sub}>{restante >= 0 ? 'Dentro da meta' : 'Acima da meta'}</p>
        </section>
      </div>

      <section style={painel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '18px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', color: cores.texto }}>Meta mensal</h2>
            <p style={{ margin: '4px 0 0', color: cores.textoSuave, fontSize: '13px' }}>Acompanhamento de gastos por período</p>
          </div>
          {mensagem && <span style={{ color: cores.positivo, fontWeight: '800', fontSize: '13px' }}>{mensagem}</span>}
        </div>

        <form onSubmit={salvarMeta} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 260px) auto', gap: '10px', alignItems: 'end', marginBottom: '22px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: cores.textoSuave, fontWeight: '700' }}>Valor da meta</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={metaMensal}
              onChange={(e) => setMetaMensal(e.target.value)}
              style={input}
            />
          </div>
          <button type="submit" style={botao}>Salvar Meta</button>
        </form>

        <div style={{ height: '14px', borderRadius: '8px', background: 'var(--app-accent-soft)', overflow: 'hidden', marginBottom: '10px' }}>
          <div style={{ width: `${Math.min(usado, 100)}%`, height: '100%', background: corProgresso, transition: 'width 0.2s ease' }} />
        </div>
        <p style={{ margin: 0, color: cores.textoSuave, fontSize: '13px' }}>
          {formatarMoeda(despesasMes)} usados de {formatarMoeda(meta)}
        </p>
      </section>
    </div>
  );
}

const painel = {
  background: 'var(--app-surface)',
  border: `1px solid ${cores.borda}`,
  borderRadius: '8px',
  padding: '20px',
  boxShadow: 'var(--app-shadow)',
};
const label = { margin: '0 0 10px', fontSize: '12px', color: cores.textoSuave, textTransform: 'uppercase', letterSpacing: '0', fontWeight: '800' };
const valor = { margin: '0 0 8px', fontSize: '30px', fontWeight: '900' };
const sub = { margin: 0, color: cores.textoSuave, fontSize: '13px', fontWeight: '700' };
const input = { width: '100%', height: '40px', border: `1px solid ${cores.borda}`, borderRadius: '8px', padding: '0 12px', color: cores.texto, background: 'var(--app-input-bg)', fontSize: '14px' };
const botao = { height: '40px', border: 'none', borderRadius: '8px', background: cores.destaque, color: '#fff', padding: '0 18px', cursor: 'pointer', fontSize: '14px', fontWeight: '800' };

export default Metas;
