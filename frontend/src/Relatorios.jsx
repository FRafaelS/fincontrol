import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

function Relatorios({ onVoltar }) {
  const [gastos, setGastos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [lkResponsavel, setLkResponsavel] = useState([]);
  const [lkCategoria, setLkCategoria] = useState([]);
  const [lkStatus, setLkStatus] = useState([]);

  const [filtroMes, setFiltroMes] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [filtroAno, setFiltroAno] = useState('');

  useEffect(() => {
    fetch('${API_URL}/api/gastos')
      .then((r) => r.json())
      .then((d) => { setGastos(d); setCarregando(false); });

    const buscar = (tipo, setter) =>
      fetch('${API_URL}/api/lookups/valores/${tipo}')
        .then((r) => r.json()).then(setter).catch(() => setter([]));

    buscar('RESPONSAVEL', setLkResponsavel);
    buscar('CATEGORIA', setLkCategoria);
    buscar('STATUS_GASTO', setLkStatus);
  }, []);

  const getLookupLabel = (lista, meaning) => {
    const item = lista.find((l) => l.MEANING === meaning);
    return item ? item.LOOKUP_CODE : meaning || '—';
  };

  const gastosFiltrados = gastos.filter((g) => {
    const okMes = filtroMes ? g.mes === filtroMes : true;
    const okStatus = filtroStatus ? g.status === filtroStatus : true;
    const okResp = filtroResponsavel ? g.responsavel === filtroResponsavel : true;
    const okAno = filtroAno ? String(g.ano) === filtroAno : true;
    return okMes && okStatus && okResp && okAno;
  });

  const anos = [...new Set(gastos.map((g) => g.ano).filter(Boolean))].sort((a, b) => b - a);

  const totalGeral = gastosFiltrados.reduce((s, g) => s + g.valor_individual, 0);

  const porCategoria = Object.values(
    gastosFiltrados.reduce((acc, g) => {
      const cat = getLookupLabel(lkCategoria, g.categoria);
      if (!acc[cat]) acc[cat] = { categoria: cat, total: 0, qtd: 0 };
      acc[cat].total += g.valor_individual;
      acc[cat].qtd++;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);

  const porResponsavel = Object.values(
    gastosFiltrados.reduce((acc, g) => {
      const resp = getLookupLabel(lkResponsavel, g.responsavel);
      if (!acc[resp]) acc[resp] = { responsavel: resp, total: 0, qtd: 0 };
      acc[resp].total += g.valor_individual;
      acc[resp].qtd++;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);

  const descricaoFiltros = () => {
    const partes = [];
    if (filtroMes) partes.push(`Mês: ${filtroMes}`);
    if (filtroAno) partes.push(`Ano: ${filtroAno}`);
    if (filtroStatus) partes.push(`Status: ${getLookupLabel(lkStatus, filtroStatus)}`);
    if (filtroResponsavel) partes.push(`Responsável: ${getLookupLabel(lkResponsavel, filtroResponsavel)}`);
    return partes.length > 0 ? partes.join(' · ') : 'Todos os registros';
  };

  // ── Exportar Excel ──
  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();

    // Aba 1: Gastos detalhados
    const dadosGastos = gastosFiltrados.map((g) => ({
      ID: g.id,
      Descrição: g.descricao,
      Categoria: getLookupLabel(lkCategoria, g.categoria),
      Responsável: getLookupLabel(lkResponsavel, g.responsavel),
      Parcela: g.parcela || '—',
      'Forma Pgto': g.forma_pgto,
      Vencimento: g.data_venc,
      Mês: g.mes,
      Ano: g.ano,
      'Valor Total': g.valor_total,
      'Valor Individual': g.valor_individual,
      Status: getLookupLabel(lkStatus, g.status),
      Obs: g.obs || '',
    }));
    const ws1 = XLSX.utils.json_to_sheet(dadosGastos);
    ws1['!cols'] = [
      {wch:6},{wch:30},{wch:15},{wch:15},{wch:12},{wch:18},
      {wch:12},{wch:6},{wch:6},{wch:14},{wch:16},{wch:10},{wch:20},
    ];
    XLSX.utils.book_append_sheet(wb, ws1, 'Gastos');

    // Aba 2: Resumo por categoria
    const dadosCategoria = porCategoria.map((c) => ({
      Categoria: c.categoria,
      Quantidade: c.qtd,
      Total: c.total,
      Percentual: `${((c.total / totalGeral) * 100).toFixed(1)}%`,
    }));
    const ws2 = XLSX.utils.json_to_sheet(dadosCategoria);
    ws2['!cols'] = [{wch:20},{wch:12},{wch:14},{wch:12}];
    XLSX.utils.book_append_sheet(wb, ws2, 'Por Categoria');

    // Aba 3: Resumo por responsável
    const dadosResp = porResponsavel.map((r) => ({
      Responsável: r.responsavel,
      Quantidade: r.qtd,
      Total: r.total,
      Percentual: `${((r.total / totalGeral) * 100).toFixed(1)}%`,
    }));
    const ws3 = XLSX.utils.json_to_sheet(dadosResp);
    ws3['!cols'] = [{wch:20},{wch:12},{wch:14},{wch:12}];
    XLSX.utils.book_append_sheet(wb, ws3, 'Por Responsável');

    const nomeArquivo = `relatorio_gastos_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, nomeArquivo);
  };

  // ── Exportar PDF ──
  const exportarPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const dataHoje = new Date().toLocaleDateString('pt-BR');

    // Cabeçalho
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Gastos', 14, 16);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${dataHoje}`, 14, 23);
    doc.text(`Filtros: ${descricaoFiltros()}`, 14, 29);
    doc.text(`Total: R$ ${totalGeral.toFixed(2).replace('.', ',')} · ${gastosFiltrados.length} lançamento(s)`, 14, 35);

    // Tabela de gastos
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Detalhamento', 14, 44);

    autoTable(doc, {
      startY: 48,
      head: [['ID', 'Descrição', 'Categoria', 'Responsável', 'Parcela', 'Vencimento', 'Valor Ind.', 'Status']],
      body: gastosFiltrados.map((g) => [
        g.id,
        g.descricao,
        getLookupLabel(lkCategoria, g.categoria),
        getLookupLabel(lkResponsavel, g.responsavel),
        g.parcela || '—',
        g.data_venc || '—',
        `R$ ${g.valor_individual.toFixed(2).replace('.', ',')}`,
        getLookupLabel(lkStatus, g.status),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [13, 110, 253], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 55 },
        2: { cellWidth: 28 },
        3: { cellWidth: 28 },
        4: { cellWidth: 22 },
        5: { cellWidth: 22 },
        6: { cellWidth: 24 },
        7: { cellWidth: 20 },
      },
    });

    // Resumo por categoria
    const y1 = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo por Categoria', 14, y1);

    autoTable(doc, {
      startY: y1 + 4,
      head: [['Categoria', 'Qtd', 'Total', '%']],
      body: porCategoria.map((c) => [
        c.categoria,
        c.qtd,
        `R$ ${c.total.toFixed(2).replace('.', ',')}`,
        `${((c.total / totalGeral) * 100).toFixed(1)}%`,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [25, 135, 84], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      tableWidth: 120,
    });

    // Resumo por responsável
    const y2 = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo por Responsável', 14, y2);

    autoTable(doc, {
      startY: y2 + 4,
      head: [['Responsável', 'Qtd', 'Total', '%']],
      body: porResponsavel.map((r) => [
        r.responsavel,
        r.qtd,
        `R$ ${r.total.toFixed(2).replace('.', ',')}`,
        `${((r.total / totalGeral) * 100).toFixed(1)}%`,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [111, 66, 193], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      tableWidth: 120,
    });

    const nomeArquivo = `relatorio_gastos_${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(nomeArquivo);
  };

  const limparFiltros = () => {
    setFiltroMes('');
    setFiltroStatus('');
    setFiltroResponsavel('');
    setFiltroAno('');
  };

  const filtersAtivos = filtroMes || filtroStatus || filtroResponsavel || filtroAno;

  if (carregando) return <p style={{ padding: '32px' }}>Carregando...</p>;

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '32px', maxWidth: '1100px', margin: '0 auto' }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', margin: 0 }}>Relatórios</h1>
        <button onClick={onVoltar} style={btnSecundario}>← Voltar</button>
      </div>

      {/* Filtros */}
      <div style={{ background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
        <p style={{ margin: '0 0 12px', fontWeight: '600', fontSize: '14px' }}>Filtros do Relatório</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
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
            <label style={label}>Status</label>
            <select style={input} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="">Todos</option>
              {lkStatus.map((l) => <option key={l.ID} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Responsável</label>
            <select style={input} value={filtroResponsavel} onChange={(e) => setFiltroResponsavel(e.target.value)}>
              <option value="">Todos</option>
              {lkResponsavel.map((l) => <option key={l.ID} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}
            </select>
          </div>
          <button onClick={limparFiltros} disabled={!filtersAtivos} style={{
            background: filtersAtivos ? '#6c757d' : '#e9ecef',
            color: filtersAtivos ? '#fff' : '#adb5bd',
            border: 'none', borderRadius: '6px', padding: '8px 14px',
            cursor: filtersAtivos ? 'pointer' : 'default', fontSize: '13px',
          }}>
            Limpar
          </button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div style={card}>
          <p style={cardLabel}>Total do período</p>
          <p style={{ ...cardValor, color: '#0d6efd' }}>R$ {totalGeral.toFixed(2).replace('.', ',')}</p>
          <p style={cardSub}>{gastosFiltrados.length} lançamentos · {descricaoFiltros()}</p>
        </div>
        <div style={card}>
          <p style={cardLabel}>Maior categoria</p>
          <p style={{ ...cardValor, color: '#198754', fontSize: '20px' }}>
            {porCategoria[0]?.categoria || '—'}
          </p>
          <p style={cardSub}>
            {porCategoria[0] ? `R$ ${porCategoria[0].total.toFixed(2).replace('.', ',')}` : '—'}
          </p>
        </div>
        <div style={card}>
          <p style={cardLabel}>Exportar</p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button onClick={exportarExcel} style={{ ...btnExportar, background: '#198754' }}>
              📊 Excel
            </button>
            <button onClick={exportarPDF} style={{ ...btnExportar, background: '#dc3545' }}>
              📄 PDF
            </button>
          </div>
          <p style={cardSub}>{gastosFiltrados.length} registro(s) serão exportados</p>
        </div>
      </div>

      {/* Resumo por categoria */}
      <div style={secao}>
        <h2 style={tituloSecao}>Por Categoria</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={th}>Categoria</th>
              <th style={{ ...th, textAlign: 'right' }}>Qtd</th>
              <th style={{ ...th, textAlign: 'right' }}>Total</th>
              <th style={{ ...th, textAlign: 'right' }}>%</th>
              <th style={th}>Participação</th>
            </tr>
          </thead>
          <tbody>
            {porCategoria.map((c) => (
              <tr key={c.categoria} style={{ borderBottom: '1px solid #eee' }}>
                <td style={td}>{c.categoria}</td>
                <td style={{ ...td, textAlign: 'right' }}>{c.qtd}</td>
                <td style={{ ...td, textAlign: 'right' }}>R$ {c.total.toFixed(2).replace('.', ',')}</td>
                <td style={{ ...td, textAlign: 'right' }}>{((c.total / totalGeral) * 100).toFixed(1)}%</td>
                <td style={td}>
                  <div style={{ background: '#e9ecef', borderRadius: '4px', height: '8px' }}>
                    <div style={{ background: '#0d6efd', borderRadius: '4px', height: '8px', width: `${(c.total / totalGeral) * 100}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Resumo por responsável */}
      <div style={secao}>
        <h2 style={tituloSecao}>Por Responsável</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={th}>Responsável</th>
              <th style={{ ...th, textAlign: 'right' }}>Qtd</th>
              <th style={{ ...th, textAlign: 'right' }}>Total</th>
              <th style={{ ...th, textAlign: 'right' }}>%</th>
              <th style={th}>Participação</th>
            </tr>
          </thead>
          <tbody>
            {porResponsavel.map((r) => (
              <tr key={r.responsavel} style={{ borderBottom: '1px solid #eee' }}>
                <td style={td}>{r.responsavel}</td>
                <td style={{ ...td, textAlign: 'right' }}>{r.qtd}</td>
                <td style={{ ...td, textAlign: 'right' }}>R$ {r.total.toFixed(2).replace('.', ',')}</td>
                <td style={{ ...td, textAlign: 'right' }}>{((r.total / totalGeral) * 100).toFixed(1)}%</td>
                <td style={td}>
                  <div style={{ background: '#e9ecef', borderRadius: '4px', height: '8px' }}>
                    <div style={{ background: '#6f42c1', borderRadius: '4px', height: '8px', width: `${(r.total / totalGeral) * 100}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tabela detalhada */}
      <div style={secao}>
        <h2 style={tituloSecao}>Detalhamento — {gastosFiltrados.length} registro(s)</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={th}>ID</th>
                <th style={th}>Descrição</th>
                <th style={th}>Categoria</th>
                <th style={th}>Responsável</th>
                <th style={th}>Parcela</th>
                <th style={th}>Vencimento</th>
                <th style={{ ...th, textAlign: 'right' }}>Valor Ind.</th>
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {gastosFiltrados.map((g) => (
                <tr key={g.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={td}>{g.id}</td>
                  <td style={td}>{g.descricao}</td>
                  <td style={td}>{getLookupLabel(lkCategoria, g.categoria)}</td>
                  <td style={td}>{getLookupLabel(lkResponsavel, g.responsavel)}</td>
                  <td style={td}>{g.parcela || '—'}</td>
                  <td style={td}>{g.data_venc || '—'}</td>
                  <td style={{ ...td, textAlign: 'right' }}>R$ {g.valor_individual.toFixed(2).replace('.', ',')}</td>
                  <td style={td}>
                    <span style={{
                      background: g.status === 'PENDENTE' ? '#fff3cd' : '#d4edda',
                      color: g.status === 'PENDENTE' ? '#856404' : '#155724',
                      padding: '2px 8px', borderRadius: '4px', fontSize: '12px',
                    }}>
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

const secao = { background: '#fff', border: '1px solid #dee2e6', borderRadius: '8px', padding: '20px', marginBottom: '24px' };
const tituloSecao = { fontSize: '16px', fontWeight: '600', margin: '0 0 16px' };
const th = { padding: '10px 12px', fontWeight: '600', borderBottom: '2px solid #ddd', textAlign: 'left' };
const td = { padding: '10px 12px' };
const label = { display: 'block', fontSize: '13px', color: '#555', marginBottom: '4px' };
const input = { width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ced4da', fontSize: '14px', boxSizing: 'border-box' };
const btnSecundario = { background: '#6c757d', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontSize: '14px' };
const btnExportar = { color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' };
const card = { background: '#fff', border: '1px solid #dee2e6', borderRadius: '8px', padding: '20px' };
const cardLabel = { margin: '0 0 8px', fontSize: '13px', color: '#666' };
const cardValor = { margin: '0 0 4px', fontSize: '28px', fontWeight: '700' };
const cardSub = { margin: '8px 0 0', fontSize: '12px', color: '#999' };

export default Relatorios;