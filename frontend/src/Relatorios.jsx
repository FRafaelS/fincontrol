import React, { useMemo, useState, useEffect } from 'react';
import API_URL from './api';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatarMoeda, percentual, toNumber } from './utils/formatters';
import { getLookupLabel, lookupKey, normalizarLookups } from './utils/lookups';
import { agruparPagamentosPorResponsavel } from './utils/rateioResponsaveis';

const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

const PERIODOS_GASTO = [
  { value: 'Q', label: 'Q - Quinzena' },
  { value: 'F', label: 'F - Final do mês' },
];

const normalizarPeriodoGasto = (periodo) => {
  const valor = String(periodo || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (!valor) return '';
  if (valor === 'Q' || valor === 'QUINZENA' || valor === 'QUIZENA') return 'Q';
  if (valor === 'F' || valor === 'FINAL' || valor === 'FINAL_MES' || valor === 'FIM_MES') return 'F';
  return valor;
};

const periodoGastoLabel = (periodo) =>
  PERIODOS_GASTO.find((item) => item.value === normalizarPeriodoGasto(periodo))?.label || '—';

const normalizarGasto = (gasto = {}) => ({
  ...gasto,
  valor_total: toNumber(gasto.valor_total),
  valor_individual: toNumber(gasto.valor_individual),
});

const lerJsonSeguro = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.erro || 'Erro ao carregar dados.');
  return data;
};

const formatarPercentual = (parte, total) => `${percentual(parte, total).toFixed(1)}%`;

const normalizarStatusGasto = (status) => {
  const valor = String(status || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (valor === 'PAGO') return 'PAGO';
  if (valor === 'PENDENTE') return 'PENDENTE';
  return valor;
};

const statusIgual = (status, valor) => normalizarStatusGasto(status) === normalizarStatusGasto(valor);
const estaPago = (gasto) => statusIgual(gasto.status, 'PAGO');
const valorTotalGasto = (gasto) => toNumber(gasto.valor_total);
const valorIndividualGasto = (gasto) => toNumber(gasto.valor_individual);

function Relatorios({ onVoltar, token, grupoAtivoId = '' }) {
  const [gastos, setGastos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [lkResponsavel, setLkResponsavel] = useState([]);
  const [lkCategoria, setLkCategoria] = useState([]);
  const [lkStatus, setLkStatus] = useState([]);
  const [lkDivisaoComum, setLkDivisaoComum] = useState([]);

  const [filtroMes, setFiltroMes] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [filtroAno, setFiltroAno] = useState('');

  const headers = useMemo(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => {
    fetch(`${API_URL}/api/gastos`, { headers })
      .then(lerJsonSeguro)
      .then((d) => { setGastos(Array.isArray(d) ? d.map(normalizarGasto) : []); setCarregando(false); })
      .catch(() => setCarregando(false));

    const buscar = (tipo, setter) =>
      fetch(`${API_URL}/api/lookups/valores/${encodeURIComponent(tipo)}`, { headers })
        .then(lerJsonSeguro)
        .then((d) => setter(normalizarLookups(d)))
        .catch(() => setter([]));

    buscar('RESPONSAVEL', setLkResponsavel);
    buscar('CATEGORIA', setLkCategoria);
    buscar('STATUS_GASTO', setLkStatus);
    buscar('DIVISAO_COMUM', setLkDivisaoComum);
  }, [headers]);

  const gastosContexto = useMemo(
    () => grupoAtivoId ? gastos.filter((g) => String(g.grupo_id || '') === String(grupoAtivoId)) : gastos,
    [gastos, grupoAtivoId]
  );

  const gastosFiltrados = gastosContexto.filter((g) => {
    const okMes = filtroMes ? g.mes === filtroMes : true;
    const okPeriodo = filtroPeriodo ? normalizarPeriodoGasto(g.periodo) === filtroPeriodo : true;
    const okStatus = filtroStatus ? statusIgual(g.status, filtroStatus) : true;
    const okResp = filtroResponsavel ? g.responsavel === filtroResponsavel : true;
    const okAno = filtroAno ? String(g.ano) === filtroAno : true;
    return okMes && okPeriodo && okStatus && okResp && okAno;
  });

  const anos = [...new Set(gastosContexto.map((g) => g.ano).filter(Boolean))].sort((a, b) => b - a);
  const totalCheio = gastosFiltrados.reduce((s, g) => s + valorTotalGasto(g), 0);
  const porResponsavel = agruparPagamentosPorResponsavel(gastosFiltrados, {
    lookupsResponsavel: lkResponsavel,
    lookupsDivisaoComum: lkDivisaoComum,
    estaPago,
    normalizarPeriodo: normalizarPeriodoGasto,
  });
  const totalIndividual = porResponsavel.reduce((s, r) => s + r.totalIndividual, 0);
  const totalAPagar = porResponsavel.reduce((s, r) => s + r.aPagar, 0);

  const porCategoria = Object.values(
    gastosFiltrados.reduce((acc, g) => {
      const cat = getLookupLabel(lkCategoria, g.categoria);
      if (!acc[cat]) acc[cat] = { categoria: cat, total: 0, qtd: 0 };
      acc[cat].total += valorTotalGasto(g);
      acc[cat].qtd++;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);

  const descricaoFiltros = () => {
    const partes = [];
    if (filtroMes) partes.push(`Mês: ${filtroMes}`);
    if (filtroAno) partes.push(`Ano: ${filtroAno}`);
    if (filtroPeriodo) partes.push(`Período: ${periodoGastoLabel(filtroPeriodo)}`);
    if (filtroStatus) partes.push(`Status: ${getLookupLabel(lkStatus, filtroStatus)}`);
    if (filtroResponsavel) partes.push(`Responsável: ${getLookupLabel(lkResponsavel, filtroResponsavel)}`);
    return partes.length > 0 ? partes.join(' · ') : 'Todos os registros';
  };

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    const dadosGastos = gastosFiltrados.map((g) => ({
      ID: g.id,
      Tipo: g.tipo || '',
      Período: periodoGastoLabel(g.periodo),
      Parcela: g.parcela || '—',
      'Descrição': g.descricao,
      Categoria: getLookupLabel(lkCategoria, g.categoria),
      'Responsável': getLookupLabel(lkResponsavel, g.responsavel),
      'Forma Pgto': g.forma_pgto,
      Vencimento: g.data_venc, 'Mês': g.mes, Ano: g.ano,
      'Valor Total': valorTotalGasto(g), 'Valor Individual': valorIndividualGasto(g),
      'Data Pgto': g.data_pgto || '',
      Status: getLookupLabel(lkStatus, g.status), Obs: g.obs || '',
    }));
    const ws1 = XLSX.utils.json_to_sheet(dadosGastos);
    XLSX.utils.book_append_sheet(wb, ws1, 'Gastos');

    const ws2 = XLSX.utils.json_to_sheet(porCategoria.map((c) => ({
      Categoria: c.categoria, Quantidade: c.qtd, Total: c.total,
      Percentual: formatarPercentual(c.total, totalCheio),
    })));
    XLSX.utils.book_append_sheet(wb, ws2, 'Por Categoria');

    const ws3 = XLSX.utils.json_to_sheet(porResponsavel.map((r) => ({
      'Responsável': r.responsavel,
      Quantidade: r.qtd,
      'Valor Cheio': r.totalCheio,
      'Valor Individual': r.totalIndividual,
      'A Pagar': r.aPagar,
      Quinzena: r.quinzena,
      'Final do Mês': r.finalMes,
      'Percentual A Pagar': formatarPercentual(r.aPagar, totalAPagar),
    })));
    XLSX.utils.book_append_sheet(wb, ws3, 'Por Responsável');
    XLSX.writeFile(wb, `relatorio_gastos_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const exportarPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Gastos', 14, 16);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${dataHoje}`, 14, 23);
    doc.text(`Filtros: ${descricaoFiltros()}`, 14, 29);
    doc.text(`Valor cheio: ${formatarMoeda(totalCheio)} | A pagar: ${formatarMoeda(totalAPagar)} | ${gastosFiltrados.length} lançamento(s)`, 14, 35);
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text('Detalhamento', 14, 44);
    autoTable(doc, {
      startY: 48,
      head: [['ID', 'Tipo', 'Período', 'Parcela', 'Descrição', 'Categoria', 'Responsável', 'Vencimento', 'Valor Total', 'Valor Ind.', 'Data Pgto', 'Status']],
      body: gastosFiltrados.map((g) => [
        g.id, g.tipo || '—', periodoGastoLabel(g.periodo), g.parcela || '—',
        g.descricao, getLookupLabel(lkCategoria, g.categoria), getLookupLabel(lkResponsavel, g.responsavel),
        g.data_venc || '—', formatarMoeda(g.valor_total), formatarMoeda(g.valor_individual), g.data_pgto || '—',
        getLookupLabel(lkStatus, g.status),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [13, 110, 253], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    const y1 = (doc.lastAutoTable?.finalY || 48) + 10;
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text('Resumo por Categoria', 14, y1);
    autoTable(doc, {
      startY: y1 + 4,
      head: [['Categoria', 'Qtd', 'Total', '%']],
      body: porCategoria.map((c) => [c.categoria, c.qtd, formatarMoeda(c.total), formatarPercentual(c.total, totalCheio)]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [25, 135, 84], textColor: 255, fontStyle: 'bold' },
      tableWidth: 120,
    });
    const y2 = (doc.lastAutoTable?.finalY || y1) + 10;
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text('Resumo por Responsável', 14, y2);
    autoTable(doc, {
      startY: y2 + 4,
      head: [['Responsável', 'Qtd', 'Valor Ind.', 'A Pagar', 'Q', 'F']],
      body: porResponsavel.map((r) => [
        r.responsavel, r.qtd, formatarMoeda(r.totalIndividual), formatarMoeda(r.aPagar),
        formatarMoeda(r.quinzena), formatarMoeda(r.finalMes),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [111, 66, 193], textColor: 255, fontStyle: 'bold' },
      tableWidth: 120,
    });
    doc.save(`relatorio_gastos_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const limparFiltros = () => { setFiltroMes(''); setFiltroPeriodo(''); setFiltroStatus(''); setFiltroResponsavel(''); setFiltroAno(''); };
  const filtersAtivos = filtroMes || filtroPeriodo || filtroStatus || filtroResponsavel || filtroAno;

  if (carregando) return <p style={{ padding: '32px' }}>Carregando...</p>;

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '32px', maxWidth: '1100px', margin: '0 auto', color: 'var(--app-text)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', margin: 0, color: 'var(--app-text)' }}>Relatórios</h1>
        <button onClick={onVoltar} style={btnSecundario}>← Voltar</button>
      </div>

      {/* Filtros */}
      <div style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', borderRadius: '8px', padding: '16px', marginBottom: '24px', boxShadow: 'var(--app-shadow)' }}>
        <p style={{ margin: '0 0 12px', fontWeight: '800', fontSize: '14px', color: 'var(--app-text)' }}>Filtros do Relatório</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', alignItems: 'end' }}>
          <div>
            <label style={label}>Mês</label>
            <select style={input} value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)}>
              <option value="">Todos</option>
              {MESES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Ano</label>
            <select style={input} value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)}>
              <option value="">Todos</option>
              {anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Período</label>
            <select style={input} value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value)}>
              <option value="">Todos</option>
              {PERIODOS_GASTO.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Status</label>
            <select style={input} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="">Todos</option>
              {lkStatus.map((l) => <option key={lookupKey(l)} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Responsável</label>
            <select style={input} value={filtroResponsavel} onChange={(e) => setFiltroResponsavel(e.target.value)}>
              <option value="">Todos</option>
              {lkResponsavel.map((l) => <option key={lookupKey(l)} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}
            </select>
          </div>
          <button onClick={limparFiltros} disabled={!filtersAtivos} style={{ background: filtersAtivos ? 'var(--app-surface-soft)' : 'var(--app-border)', color: filtersAtivos ? 'var(--app-text)' : 'var(--app-muted)', border: '1px solid var(--app-border)', borderRadius: '6px', padding: '8px 14px', cursor: filtersAtivos ? 'pointer' : 'default', fontSize: '13px', fontWeight: '700' }}>
            Limpar
          </button>
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={card}>
          <p style={cardLabel}>Valor cheio</p>
          <p style={{ ...cardValor, color: '#0d6efd' }}>{formatarMoeda(totalCheio)}</p>
          <p style={cardSub}>{gastosFiltrados.length} lançamentos · {descricaoFiltros()}</p>
        </div>
        <div style={card}>
          <p style={cardLabel}>Valor individual</p>
          <p style={{ ...cardValor, color: '#6f42c1' }}>{formatarMoeda(totalIndividual)}</p>
          <p style={cardSub}>Soma rateada por responsável</p>
        </div>
        <div style={card}>
          <p style={cardLabel}>A pagar</p>
          <p style={{ ...cardValor, color: '#d97706' }}>{formatarMoeda(totalAPagar)}</p>
          <p style={cardSub}>Somente lançamentos pendentes</p>
        </div>
        <div style={card}>
          <p style={cardLabel}>Exportar</p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button onClick={exportarExcel} style={{ ...btnExportar, background: '#198754' }}>📊 Excel</button>
            <button onClick={exportarPDF} style={{ ...btnExportar, background: '#dc3545' }}>📄 PDF</button>
          </div>
          <p style={cardSub}>{gastosFiltrados.length} registro(s) serão exportados</p>
        </div>
      </div>

      {/* Por responsável */}
      <div style={secao}>
        <h2 style={tituloSecao}>A Pagar por Responsável</h2>
        <div style={tabelaContainer}>
          <table style={{ width: '100%', minWidth: '820px', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead><tr style={{ background: 'var(--app-surface-soft)' }}>
            <th style={th}>Responsável</th>
            <th style={{ ...th, textAlign: 'right' }}>Qtd</th>
            <th style={{ ...th, textAlign: 'right' }}>Valor Cheio</th>
            <th style={{ ...th, textAlign: 'right' }}>Valor Ind.</th>
            <th style={{ ...th, textAlign: 'right' }}>A Pagar</th>
            <th style={{ ...th, textAlign: 'right' }}>Q</th>
            <th style={{ ...th, textAlign: 'right' }}>F</th>
            <th style={th}>Participação</th>
            </tr></thead>
            <tbody>
              {porResponsavel.map((r) => (
                <tr key={r.responsavel} style={{ borderBottom: '1px solid var(--app-border)' }}>
                  <td style={td}>{r.responsavel}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{r.qtd}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{formatarMoeda(r.totalCheio)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{formatarMoeda(r.totalIndividual)}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: '800', color: 'var(--app-warning-text)' }}>{formatarMoeda(r.aPagar)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{formatarMoeda(r.quinzena)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{formatarMoeda(r.finalMes)}</td>
                  <td style={td}><div style={barraBase}><div style={{ background: '#6f42c1', borderRadius: '4px', height: '8px', width: `${percentual(r.aPagar, totalAPagar)}%` }} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Por categoria */}
      <div style={secao}>
        <h2 style={tituloSecao}>Por Categoria</h2>
        <div style={tabelaContainer}>
          <table style={{ width: '100%', minWidth: '640px', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead><tr style={{ background: 'var(--app-surface-soft)' }}>
            <th style={th}>Categoria</th>
            <th style={{ ...th, textAlign: 'right' }}>Qtd</th>
            <th style={{ ...th, textAlign: 'right' }}>Total</th>
            <th style={{ ...th, textAlign: 'right' }}>%</th>
            <th style={th}>Participação</th>
            </tr></thead>
            <tbody>
              {porCategoria.map((c) => (
                <tr key={c.categoria} style={{ borderBottom: '1px solid var(--app-border)' }}>
                  <td style={td}>{c.categoria}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{c.qtd}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{formatarMoeda(c.total)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{formatarPercentual(c.total, totalCheio)}</td>
                  <td style={td}><div style={barraBase}><div style={{ background: 'var(--app-accent)', borderRadius: '4px', height: '8px', width: `${percentual(c.total, totalCheio)}%` }} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detalhamento */}
      <div style={secao}>
        <h2 style={tituloSecao}>Detalhamento — {gastosFiltrados.length} registro(s)</h2>
        <div style={tabelaContainer}>
          <table style={{ width: '100%', minWidth: '1040px', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead><tr style={{ background: 'var(--app-surface-soft)' }}>
              <th style={th}>ID</th><th style={th}>Tipo</th><th style={th}>Período</th>
              <th style={th}>Parcela</th><th style={th}>Descrição</th><th style={th}>Categoria</th>
              <th style={th}>Responsável</th><th style={th}>Vencimento</th>
              <th style={{ ...th, textAlign: 'right' }}>Valor Total</th><th style={{ ...th, textAlign: 'right' }}>Valor Ind.</th>
              <th style={th}>Data Pgto</th><th style={th}>Status</th>
            </tr></thead>
            <tbody>
              {gastosFiltrados.map((g) => (
                <tr key={g.id} style={{ borderBottom: '1px solid var(--app-border)' }}>
                  <td style={td}>{g.id}</td>
                  <td style={td}>{g.tipo || '—'}</td>
                  <td style={td}>{periodoGastoLabel(g.periodo)}</td>
                  <td style={td}>{g.parcela || '—'}</td>
                  <td style={td}>{g.descricao}</td>
                  <td style={td}>{getLookupLabel(lkCategoria, g.categoria)}</td>
                  <td style={td}>{getLookupLabel(lkResponsavel, g.responsavel)}</td>
                  <td style={td}>{g.data_venc || '—'}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{formatarMoeda(g.valor_total)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{formatarMoeda(g.valor_individual)}</td>
                  <td style={td}>{g.data_pgto || '—'}</td>
                  <td style={td}>
                    <span style={{ background: statusIgual(g.status, 'PENDENTE') ? 'var(--app-warning-soft)' : 'var(--app-success-soft)', color: statusIgual(g.status, 'PENDENTE') ? 'var(--app-warning-text)' : 'var(--app-success-text)', border: `1px solid ${statusIgual(g.status, 'PENDENTE') ? 'var(--app-warning)' : 'var(--app-success)'}`, padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '800' }}>
                      {getLookupLabel(lkStatus, g.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const secao = { background: 'var(--app-surface)', border: '1px solid var(--app-border)', borderRadius: '8px', padding: '20px', marginBottom: '24px', boxShadow: 'var(--app-shadow)' };
const tituloSecao = { fontSize: '16px', fontWeight: '800', margin: '0 0 16px', color: 'var(--app-text)' };
const tabelaContainer = { overflowX: 'auto', border: '1px solid var(--app-border)', borderRadius: '8px', background: 'var(--app-surface)' };
const th = { padding: '10px 12px', fontWeight: '800', borderBottom: '1px solid var(--app-border)', textAlign: 'left', color: 'var(--app-muted)' };
const td = { padding: '10px 12px', color: 'var(--app-text)', verticalAlign: 'middle' };
const label = { display: 'block', fontSize: '13px', color: 'var(--app-muted)', marginBottom: '4px', fontWeight: '700' };
const input = { width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--app-border)', fontSize: '14px', boxSizing: 'border-box', background: 'var(--app-input-bg)', color: 'var(--app-text)' };
const btnSecundario = { background: 'var(--app-surface-soft)', color: 'var(--app-text)', border: '1px solid var(--app-border)', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontSize: '14px', fontWeight: '700' };
const btnExportar = { color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' };
const card = { background: 'var(--app-surface)', border: '1px solid var(--app-border)', borderRadius: '8px', padding: '20px', boxShadow: 'var(--app-shadow)' };
const cardLabel = { margin: '0 0 8px', fontSize: '13px', color: 'var(--app-muted)', fontWeight: '700' };
const cardValor = { margin: '0 0 4px', fontSize: '28px', fontWeight: '800' };
const cardSub = { margin: '8px 0 0', fontSize: '12px', color: 'var(--app-muted)', fontWeight: '700' };
const barraBase = { background: 'var(--app-surface-soft)', borderRadius: '4px', height: '8px', overflow: 'hidden' };

export default Relatorios;
