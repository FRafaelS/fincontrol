import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import API_URL from './api';
import { toNumber } from './utils/formatters';

const CAMPOS_SISTEMA = [
  { value: '', label: '— Ignorar coluna —' },
  { value: 'responsavel', label: 'Responsável' },
  { value: 'tipo', label: 'Tipo (I/C)' },
  { value: 'periodo', label: 'Período (Q/F)' },
  { value: 'descricao', label: 'Descrição' },
  { value: 'parcela', label: 'Parcela' },
  { value: 'categoria', label: 'Categoria' },
  { value: 'forma_pgto', label: 'Forma de Pagamento' },
  { value: 'valor_total', label: 'Valor Total' },
  { value: 'data_venc', label: 'Data Vencimento' },
  { value: 'data_pgto', label: 'Data Pagamento' },
  { value: 'status', label: 'Status' },
  { value: 'obs', label: 'Observação' },
];

const COLUNAS_MODELO = [
  { header: 'RESPONSAVEL', exemplo: 'Rafael Silva', dica: 'Nome igual ao cadastro de responsáveis' },
  { header: 'TIPO', exemplo: 'I', dica: 'I para individual ou C para compartilhado' },
  { header: 'PERIODO', exemplo: 'Q', dica: 'Q para quinzena ou F para final do mês' },
  { header: 'DESCRICAO', exemplo: 'Supermercado', dica: 'Descrição do lançamento' },
  { header: 'PARCELA', exemplo: '01 DE 01', dica: 'Texto livre para controle de parcelas' },
  { header: 'CATEGORIA', exemplo: 'Alimentação', dica: 'Categoria do gasto' },
  { header: 'FORMA_PGTO', exemplo: 'Pix', dica: 'Forma de pagamento' },
  { header: 'VALOR_TOTAL', exemplo: 250.9, dica: 'Valor total do gasto' },
  { header: 'DATA_VENC', exemplo: '31/03/26', dica: 'Data no formato DD/MM/AA' },
  { header: 'DATA_PGTO', exemplo: '31/03/26', dica: 'Data de pagamento no formato DD/MM/AA' },
  { header: 'STATUS', exemplo: 'PENDENTE', dica: 'PENDENTE ou PAGO' },
  { header: 'OBS', exemplo: 'Compra mensal', dica: 'Observação opcional' },
];

const mapearAutomatico = (coluna) => {
  const c = coluna.toLowerCase().trim();
  if (c.includes('resp')) return 'responsavel';
  if (c.includes('tipo')) return 'tipo';
  if (c.includes('periodo') || c.includes('período')) return 'periodo';
  if (c.includes('desc') || c.includes('despesa')) return 'descricao';
  if (c.includes('parcela')) return 'parcela';
  if (c.includes('data') && (c.includes('pgto') || c.includes('pagamento') || c.includes('pago'))) return 'data_pgto';
  if (c.includes('categ')) return 'categoria';
  if (c.includes('pgto') || c.includes('pagamento') || c.includes('forma')) return 'forma_pgto';
  if (c.includes('individual') || c === 'mes' || c === 'mês' || c === 'ano') return '';
  if (c.includes('total')) return 'valor_total';
  if (c.includes('venc')) return 'data_venc';
  if (c.includes('status')) return 'status';
  if (c.includes('obs')) return 'obs';
  return '';
};

const converterDataExcel = (valor) => {
  if (!valor) return '';
  if (typeof valor === 'string' && valor.includes('/')) return valor;
  if (typeof valor === 'number') {
    const data = new Date((valor - 25569) * 86400 * 1000);
    const dia = String(data.getUTCDate()).padStart(2, '0');
    const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
    const ano = String(data.getUTCFullYear()).slice(-2);
    return `${dia}/${mes}/${ano}`;
  }
  return String(valor);
};
function Importacao({ onVoltar, token, grupos = [] }) {
  const [etapa, setEtapa] = useState('upload');
  const [colunas, setColunas] = useState([]);
  const [mapeamento, setMapeamento] = useState({});
  const [linhas, setLinhas] = useState([]);
  const [preview, setPreview] = useState([]);
  const [grupoImportacao, setGrupoImportacao] = useState('');
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erroArquivo, setErroArquivo] = useState('');

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const exportarModelo = () => {
    const wb = XLSX.utils.book_new();
    const wsModelo = XLSX.utils.aoa_to_sheet([
      COLUNAS_MODELO.map((coluna) => coluna.header),
      COLUNAS_MODELO.map((coluna) => coluna.exemplo),
    ]);
    wsModelo['!cols'] = COLUNAS_MODELO.map((coluna) => ({
      wch: Math.max(coluna.header.length, String(coluna.exemplo).length, 14),
    }));

    const wsInstrucoes = XLSX.utils.aoa_to_sheet([
      ['COLUNA', 'OBRIGATORIEDADE', 'ORIENTAÇÃO'],
      ['RESPONSAVEL', 'Recomendado', 'Usado para identificar quem é responsável pelo gasto.'],
      ['TIPO', 'Obrigatório', 'Use I para gasto individual ou C para gasto compartilhado.'],
      ['PERIODO', 'Obrigatório', 'Use Q para quinzena ou F para final do mês.'],
      ['DESCRICAO', 'Obrigatório', 'Sem descrição o backend rejeita o registro.'],
      ['PARCELA', 'Opcional', 'Exemplo: 02 DE 10.'],
      ['CATEGORIA', 'Opcional', 'Pode usar as categorias cadastradas em Parâmetros.'],
      ['FORMA_PGTO', 'Opcional', 'Pode usar as formas cadastradas em Parâmetros.'],
      ['VALOR_TOTAL', 'Obrigatório', 'Use número sem R$, exemplo: 250.90.'],
      ['DATA_VENC', 'Obrigatório', 'Formato recomendado: DD/MM/AA. Mês e ano são calculados por esta data.'],
      ['DATA_PGTO', 'Opcional', 'Informe quando a despesa já foi paga. Formato recomendado: DD/MM/AA.'],
      ['STATUS', 'Opcional', 'Se ficar vazio, usa PENDENTE.'],
      ['OBS', 'Opcional', 'Texto livre.'],
      ['Campos automáticos', '-', 'VALOR_INDIVIDUAL, MES e ANO são calculados pelo sistema e não devem ser preenchidos.'],
    ]);
    wsInstrucoes['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 64 }];

    XLSX.utils.book_append_sheet(wb, wsModelo, 'Modelo');
    XLSX.utils.book_append_sheet(wb, wsInstrucoes, 'Instruções');
    XLSX.writeFile(wb, 'modelo_importacao_gastos.xlsx');
  };

  const handleArquivo = (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    setErroArquivo('');
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const workbook = XLSX.read(evt.target.result, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const dados = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (dados.length === 0) { setErroArquivo('A planilha está vazia ou sem dados.'); return; }
        const cols = Object.keys(dados[0]);
        const mapAuto = {};
        cols.forEach((c) => { mapAuto[c] = mapearAutomatico(c); });
        setColunas(cols); setMapeamento(mapAuto); setLinhas(dados); setEtapa('mapeamento');
      } catch { setErroArquivo('Erro ao ler o arquivo. Certifique-se que é um .xlsx ou .xls válido.'); }
    };
    reader.readAsBinaryString(arquivo);
  };

  const handleMapeamento = (coluna, campo) => {
    setMapeamento((prev) => ({ ...prev, [coluna]: campo }));
  };

  const gerarPreview = () => {
    const registros = linhas.map((linha) => {
      const registro = {};
      Object.entries(mapeamento).forEach(([coluna, campo]) => {
        if (campo) {
          registro[campo] = ['data_venc', 'data_pgto'].includes(campo)
            ? converterDataExcel(linha[coluna])
            : linha[coluna];
        }
      });
      return registro;
    });
    setPreview(registros); setEtapa('revisao');
  };

  const confirmarImportacao = async () => {
    setImportando(true);
    let sucesso = 0, erros = 0;
    const errosList = [];
    for (const registro of preview) {
      try {
        const valorTotal = toNumber(registro.valor_total);
        const res = await fetch(`${API_URL}/api/gastos`, {
          method: 'POST', headers,
          body: JSON.stringify({
            ...registro,
            grupo_id: grupoImportacao || undefined,
            valor_total: valorTotal,
            status: registro.status || 'PENDENTE',
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          let mensagem = text;
          try { mensagem = JSON.parse(text).erro || text; } catch {}
          throw new Error(mensagem || 'Erro ao importar registro.');
        }

        const data = await res.json();

        if (data.erro) { erros++; errosList.push(data.erro); } else sucesso++;
      } catch (err) {
        erros++;
        errosList.push(err.message || `Erro ao importar: ${registro.descricao || 'registro sem descrição'}`);
      }
    }
    setResultado({ sucesso, erros, errosList }); setImportando(false); setEtapa('resultado');
  };

  const reiniciar = () => {
    setEtapa('upload'); setColunas([]); setMapeamento({});
    setLinhas([]); setPreview([]); setResultado(null); setErroArquivo('');
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '32px', maxWidth: '1100px', margin: '0 auto', color: 'var(--app-text)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', margin: 0, color: 'var(--app-text)' }}>Importar Excel</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {grupos.length > 0 && (
            <select value={grupoImportacao} onChange={(e) => setGrupoImportacao(e.target.value)} style={{ ...input, width: '190px' }} title="Grupo de dados">
              <option value="">Grupo padrão</option>
              {grupos.map((grupo) => <option key={grupo.id} value={grupo.id}>{grupo.nome}</option>)}
            </select>
          )}
          <button onClick={exportarModelo} style={btnModelo}>Exportar modelo</button>
          <button onClick={onVoltar} style={btnSecundario}>← Voltar</button>
        </div>
      </div>

      {/* Etapas */}
      <div style={{ display: 'flex', marginBottom: '32px' }}>
        {['Upload', 'Mapeamento', 'Revisão', 'Resultado'].map((e, i) => {
          const etapas = ['upload', 'mapeamento', 'revisao', 'resultado'];
          const ativo = etapas[i] === etapa;
          const concluido = etapas.indexOf(etapa) > i;
          return (
            <div key={e} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ padding: '8px', background: concluido ? 'var(--app-success)' : ativo ? 'var(--app-accent)' : 'var(--app-surface-soft)', color: ativo || concluido ? '#fff' : 'var(--app-muted)', border: '1px solid var(--app-border)', borderLeftWidth: i === 0 ? '1px' : 0, fontSize: '13px', fontWeight: '700', borderRadius: i === 0 ? '6px 0 0 6px' : i === 3 ? '0 6px 6px 0' : '0' }}>
                {concluido ? '✓ ' : ''}{e}
              </div>
            </div>
          );
        })}
      </div>

      {etapa === 'upload' && (
        <div style={{ textAlign: 'center', padding: '48px', border: '2px dashed var(--app-border)', borderRadius: '12px', background: 'var(--app-surface)' }}>
          <p style={{ fontSize: '48px', margin: '0 0 16px' }}>📊</p>
          <h2 style={{ fontSize: '20px', marginBottom: '8px', color: 'var(--app-text)' }}>Selecione sua planilha</h2>
          <p style={{ color: 'var(--app-muted)', marginBottom: '24px' }}>Formatos suportados: <strong>.xlsx</strong> e <strong>.xls</strong></p>
          <label style={{ background: 'var(--app-accent)', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px 24px', cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>
            Escolher arquivo
            <input type="file" accept=".xlsx,.xls" onChange={handleArquivo} style={{ display: 'none' }} />
          </label>
          {erroArquivo && <p style={{ color: 'var(--app-danger-text)', marginTop: '16px', fontSize: '14px', fontWeight: '700' }}>{erroArquivo}</p>}
          <div style={{ marginTop: '32px', background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)', borderRadius: '8px', padding: '16px', textAlign: 'left' }}>
            <p style={{ margin: '0 0 8px', fontWeight: '700', fontSize: '14px', color: 'var(--app-text)' }}>Colunas sugeridas:</p>
            <code style={{ fontSize: '13px', color: 'var(--app-muted)', whiteSpace: 'normal' }}>{COLUNAS_MODELO.map((coluna) => coluna.header).join(' | ')}</code>
          </div>
        </div>
      )}

      {etapa === 'mapeamento' && (
        <>
          <div style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', borderRadius: '8px', padding: '20px', marginBottom: '24px', boxShadow: 'var(--app-shadow)' }}>
            <p style={{ margin: '0 0 4px', fontWeight: '700', color: 'var(--app-text)' }}>Planilha carregada!</p>
            <p style={{ margin: 0, color: 'var(--app-muted)', fontSize: '14px' }}>{linhas.length} linha(s) · {colunas.length} coluna(s)</p>
          </div>
          <div style={{ ...tabelaContainer, marginBottom: '24px' }}>
            <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead><tr style={{ background: 'var(--app-surface-soft)' }}>
                <th style={th}>Coluna na planilha</th><th style={th}>Exemplo de valor</th><th style={th}>Campo no sistema</th>
              </tr></thead>
              <tbody>
                {colunas.map((col) => (
                  <tr key={col} style={{ borderBottom: '1px solid var(--app-border)' }}>
                    <td style={{ ...td, fontWeight: '700' }}>{col}</td>
                    <td style={{ ...td, color: 'var(--app-muted)' }}>{String(linhas[0]?.[col] || '—').substring(0, 40)}</td>
                    <td style={td}>
                      <select style={{ ...input, margin: 0 }} value={mapeamento[col] || ''} onChange={(e) => handleMapeamento(col, e.target.value)}>
                        {CAMPOS_SISTEMA.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={gerarPreview} style={btnPrimario}>Avançar para Revisão →</button>
            <button onClick={reiniciar} style={btnSecundario}>Recomeçar</button>
          </div>
        </>
      )}

      {etapa === 'revisao' && (
        <>
          <div style={{ background: 'var(--app-warning-soft)', border: '1px solid var(--app-warning)', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
            <p style={{ margin: 0, fontWeight: '700', color: 'var(--app-warning-text)' }}>⚠️ Revise os dados — {preview.length} registro(s) serão criados</p>
          </div>
          <div style={{ ...tabelaContainer, marginBottom: '24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead><tr style={{ background: 'var(--app-surface-soft)' }}>
                <th style={th}>#</th>
                {Object.values(mapeamento).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).map((campo) => (
                  <th key={campo} style={th}>{CAMPOS_SISTEMA.find((c) => c.value === campo)?.label || campo}</th>
                ))}
              </tr></thead>
              <tbody>
                {preview.slice(0, 20).map((reg, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--app-border)' }}>
                    <td style={{ ...td, color: 'var(--app-muted)' }}>{i + 1}</td>
                    {Object.values(mapeamento).filter(Boolean).filter((v, idx, a) => a.indexOf(v) === idx).map((campo) => (
                      <td key={campo} style={td}>{reg[campo] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 20 && <p style={{ color: 'var(--app-muted)', fontSize: '13px', padding: '8px 12px' }}>Mostrando 20 de {preview.length} registros...</p>}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={confirmarImportacao} disabled={importando} style={{ ...btnPrimario, background: 'var(--app-success)' }}>
              {importando ? 'Importando...' : `✓ Confirmar e importar ${preview.length} registro(s)`}
            </button>
            <button onClick={() => setEtapa('mapeamento')} style={btnSecundario}>← Voltar</button>
          </div>
        </>
      )}

      {etapa === 'resultado' && resultado && (
        <div style={{ textAlign: 'center', padding: '32px' }}>
          <p style={{ fontSize: '48px', margin: '0 0 16px' }}>{resultado.erros === 0 ? '🎉' : '⚠️'}</p>
          <h2 style={{ fontSize: '20px', marginBottom: '16px', color: 'var(--app-text)' }}>{resultado.erros === 0 ? 'Importação concluída!' : 'Concluída com avisos'}</h2>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '24px' }}>
            <div style={{ background: 'var(--app-success-soft)', border: '1px solid var(--app-success)', borderRadius: '8px', padding: '16px 32px' }}>
              <p style={{ margin: 0, fontSize: '32px', fontWeight: '800', color: 'var(--app-success-text)' }}>{resultado.sucesso}</p>
              <p style={{ margin: 0, color: 'var(--app-success-text)', fontSize: '14px', fontWeight: '700' }}>importado(s)</p>
            </div>
            {resultado.erros > 0 && (
              <div style={{ background: 'var(--app-danger-soft)', border: '1px solid var(--app-danger)', borderRadius: '8px', padding: '16px 32px' }}>
                <p style={{ margin: 0, fontSize: '32px', fontWeight: '800', color: 'var(--app-danger-text)' }}>{resultado.erros}</p>
                <p style={{ margin: 0, color: 'var(--app-danger-text)', fontSize: '14px', fontWeight: '700' }}>erro(s)</p>
              </div>
            )}
          </div>
          {resultado.errosList.length > 0 && (
            <div style={{ background: 'var(--app-danger-soft)', border: '1px solid var(--app-danger)', borderRadius: '8px', padding: '16px', marginBottom: '24px', textAlign: 'left' }}>
              {resultado.errosList.map((e, i) => <p key={i} style={{ margin: '4px 0', fontSize: '13px', color: 'var(--app-danger-text)' }}>• {e}</p>)}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button onClick={onVoltar} style={btnPrimario}>← Ver gastos importados</button>
            <button onClick={reiniciar} style={btnSecundario}>Importar outro arquivo</button>
          </div>
        </div>
      )}
    </div>
  );
}

const tabelaContainer = { overflowX: 'auto', border: '1px solid var(--app-border)', borderRadius: '8px', background: 'var(--app-surface)' };
const th = { padding: '10px 12px', fontWeight: '800', borderBottom: '1px solid var(--app-border)', textAlign: 'left', color: 'var(--app-muted)' };
const td = { padding: '10px 12px', color: 'var(--app-text)' };
const input = { width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--app-border)', fontSize: '14px', boxSizing: 'border-box', background: 'var(--app-input-bg)', color: 'var(--app-text)' };
const btnPrimario = { background: 'var(--app-accent)', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontWeight: '700' };
const btnSecundario = { background: 'var(--app-surface-soft)', color: 'var(--app-text)', border: '1px solid var(--app-border)', borderRadius: '6px', padding: '10px 16px', cursor: 'pointer', fontSize: '14px', fontWeight: '700' };
const btnModelo = { background: 'var(--app-accent)', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px 16px', cursor: 'pointer', fontSize: '14px', fontWeight: '700' };

export default Importacao;
