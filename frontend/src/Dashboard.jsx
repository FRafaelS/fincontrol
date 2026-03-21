import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts';

const CORES = ['#0d6efd', '#198754', '#fd7e14', '#dc3545', '#6f42c1', '#20c997'];

function Dashboard({ gastos, onVoltar }) {

  // Total por mês
  const porMes = MESES.reduce((acc, mes) => {
    const total = gastos
      .filter((g) => g.mes === mes)
      .reduce((s, g) => s + g.valor_individual, 0);
    if (total > 0) acc.push({ mes, total });
    return acc;
  }, []);

  // Total por categoria
  const porCategoria = Object.values(
    gastos.reduce((acc, g) => {
      const cat = g.categoria || 'Sem categoria';
      if (!acc[cat]) acc[cat] = { categoria: cat, total: 0 };
      acc[cat].total += g.valor_individual;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);

  // Total por status
  const porStatus = [
    { name: 'Pendente', value: gastos.filter((g) => g.status === 'PENDENTE').reduce((s, g) => s + g.valor_individual, 0) },
    { name: 'Pago', value: gastos.filter((g) => g.status === 'PAGO').reduce((s, g) => s + g.valor_individual, 0) },
  ].filter((s) => s.value > 0);

  // Total por responsável
  const porResponsavel = Object.values(
    gastos.reduce((acc, g) => {
      const resp = g.responsavel || 'N/A';
      if (!acc[resp]) acc[resp] = { responsavel: resp, total: 0 };
      acc[resp].total += g.valor_individual;
      return acc;
    }, {})
  );

  const totalGeral = gastos.reduce((s, g) => s + g.valor_individual, 0);
  const totalPendente = gastos.filter((g) => g.status === 'PENDENTE').reduce((s, g) => s + g.valor_individual, 0);
  const totalPago = gastos.filter((g) => g.status === 'PAGO').reduce((s, g) => s + g.valor_individual, 0);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '32px', maxWidth: '1100px', margin: '0 auto' }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', margin: 0 }}>Dashboard</h1>
        <button
          onClick={onVoltar}
          style={{
            background: '#6c757d',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          ← Voltar
        </button>
      </div>

      {/* Cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '32px' }}>
        <div style={card}>
          <p style={cardLabel}>Total Geral</p>
          <p style={{ ...cardValor, color: '#0d6efd' }}>R$ {totalGeral.toFixed(2).replace('.', ',')}</p>
          <p style={cardSub}>{gastos.length} lançamentos</p>
        </div>
        <div style={card}>
          <p style={cardLabel}>Pendente</p>
          <p style={{ ...cardValor, color: '#dc3545' }}>R$ {totalPendente.toFixed(2).replace('.', ',')}</p>
          <p style={cardSub}>{gastos.filter((g) => g.status === 'PENDENTE').length} lançamentos</p>
        </div>
        <div style={card}>
          <p style={cardLabel}>Pago</p>
          <p style={{ ...cardValor, color: '#198754' }}>R$ {totalPago.toFixed(2).replace('.', ',')}</p>
          <p style={cardSub}>{gastos.filter((g) => g.status === 'PAGO').length} lançamentos</p>
        </div>
      </div>

      {/* Gráfico de barras — por mês */}
      {porMes.length > 0 && (
        <div style={secao}>
          <h2 style={titulo}>Gastos por Mês</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={porMes} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="mes" tick={{ fontSize: 13 }} />
              <YAxis tick={{ fontSize: 13 }} tickFormatter={(v) => `R$${v}`} />
              <Tooltip formatter={(v) => [`R$ ${v.toFixed(2).replace('.', ',')}`, 'Total']} />
              <Bar dataKey="total" fill="#0d6efd" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Gráficos lado a lado — categoria e status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>

        {/* Pizza — por status */}
        {porStatus.length > 0 && (
          <div style={secao}>
            <h2 style={titulo}>Pendente vs Pago</h2>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={porStatus}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {porStatus.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? '#dc3545' : '#198754'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `R$ ${v.toFixed(2).replace('.', ',')}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Barras — por responsável */}
        {porResponsavel.length > 0 && (
          <div style={secao}>
            <h2 style={titulo}>Gastos por Responsável</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={porResponsavel} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="responsavel" tick={{ fontSize: 13 }} />
                <YAxis tick={{ fontSize: 13 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v) => [`R$ ${v.toFixed(2).replace('.', ',')}`, 'Total']} />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {porResponsavel.map((_, i) => (
                    <Cell key={i} fill={CORES[i % CORES.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Tabela — top categorias */}
      {porCategoria.length > 0 && (
        <div style={secao}>
          <h2 style={titulo}>Gastos por Categoria</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={th}>Categoria</th>
                <th style={{ ...th, textAlign: 'right' }}>Total</th>
                <th style={{ ...th, textAlign: 'right' }}>%</th>
                <th style={th}>Participação</th>
              </tr>
            </thead>
            <tbody>
              {porCategoria.map((c) => (
                <tr key={c.categoria} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={td}>{c.categoria}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    R$ {c.total.toFixed(2).replace('.', ',')}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    {((c.total / totalGeral) * 100).toFixed(1)}%
                  </td>
                  <td style={td}>
                    <div style={{ background: '#e9ecef', borderRadius: '4px', height: '8px', width: '100%' }}>
                      <div style={{
                        background: '#0d6efd',
                        borderRadius: '4px',
                        height: '8px',
                        width: `${(c.total / totalGeral) * 100}%`,
                      }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}

const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

const card = { background: '#fff', border: '1px solid #dee2e6', borderRadius: '8px', padding: '20px' };
const cardLabel = { margin: '0 0 8px', fontSize: '13px', color: '#666' };
const cardValor = { margin: '0 0 4px', fontSize: '28px', fontWeight: '700' };
const cardSub = { margin: 0, fontSize: '12px', color: '#999' };
const secao = { background: '#fff', border: '1px solid #dee2e6', borderRadius: '8px', padding: '20px', marginBottom: '24px' };
const titulo = { fontSize: '16px', fontWeight: '600', margin: '0 0 16px' };
const th = { padding: '10px 12px', fontWeight: '600', borderBottom: '2px solid #ddd', textAlign: 'left' };
const td = { padding: '10px 12px' };

export default Dashboard;