import React, { useMemo, useState, useEffect } from 'react';
import API_URL from './api';
import { formatarMoeda, toNumber } from './utils/formatters';
import { lookupKey, normalizarLookups } from './utils/lookups';
import { obterDivisorComum } from './utils/rateioResponsaveis';

const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

const PERIODOS_GASTO = [
  { value: 'Q', label: 'Q - Quinzena' },
  { value: 'F', label: 'F - Final do mês' },
];

const campoVazio = {
  responsavel: '', grupo_id: '', tipo: '', periodo: '', descricao: '', categoria: '', forma_pgto: '',
  valor_total: '', valor_individual: '', total_parcelas: '', dia_vencimento: '',
  mes_inicial: '', ano_inicial: new Date().getFullYear(), status: '', obs: '',
};

const toInt = (valor) => parseInt(valor, 10) || 0;

const normalizarTipoGasto = (tipo) => {
  const valor = String(tipo || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (valor === 'I' || valor === 'INDIVIDUAL') return 'I';
  if (valor === 'C' || valor === 'COMPARTILHADO') return 'C';
  return valor;
};

const dataVencimento = (dia, indiceMes, ano) => {
  const ultimoDiaMes = new Date(ano, indiceMes + 1, 0).getDate();
  const diaSeguro = Math.min(Math.max(toInt(dia), 1), ultimoDiaMes);
  const diaStr = String(diaSeguro).padStart(2, '0');
  const mesNumStr = String(indiceMes + 1).padStart(2, '0');
  const anoStr = String(ano).slice(-2);
  return `${diaStr}/${mesNumStr}/${anoStr}`;
};

function Parcelas({ onVoltar, token, grupos = [] }) {
  const [form, setForm] = useState(campoVazio);
  const [salvando, setSalvando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');
  const [preview, setPreview] = useState([]);

  const [lkResponsavel, setLkResponsavel] = useState([]);
  const [lkCategoria, setLkCategoria] = useState([]);
  const [lkFormaPgto, setLkFormaPgto] = useState([]);
  const [lkStatus, setLkStatus] = useState([]);
  const [lkTipo, setLkTipo] = useState([]);
  const [lkDivisaoComum, setLkDivisaoComum] = useState([]);

  const headers = useMemo(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }), [token]);

  const calcularValorIndividual = (dados) => {
    const total = toNumber(dados.valor_total);
    const totalParcelas = Math.max(toInt(dados.total_parcelas), 1);
    const valorParcela = total / totalParcelas;
    const tipo = normalizarTipoGasto(dados.tipo);

    if (tipo === 'I') return valorParcela;
    if (tipo === 'C') return valorParcela / obterDivisorComum(lkDivisaoComum, dados.responsavel, lkResponsavel);

    return 0;
  };

  useEffect(() => {
    const buscar = (tipo, setter) =>
      fetch(`${API_URL}/api/lookups/valores/${encodeURIComponent(tipo)}`, { headers })
        .then((r) => r.json())
        .then((d) => setter(normalizarLookups(d)))
        .catch(() => setter([]));
    buscar('RESPONSAVEL', setLkResponsavel);
    buscar('CATEGORIA', setLkCategoria);
    buscar('FORMA_PGTO', setLkFormaPgto);
    buscar('STATUS_GASTO', setLkStatus);
    buscar('TIPO_GASTO', setLkTipo);
    buscar('DIVISAO_COMUM', setLkDivisaoComum);
  }, [headers]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const novo = { ...prev, [name]: value };
      if (['tipo', 'responsavel', 'valor_total', 'total_parcelas'].includes(name)) {
        novo.valor_individual = formatarMoeda(calcularValorIndividual(novo));
      }
      return novo;
    });
    setPreview([]); setResultado(null); setErro('');
  };

  const gerarPreview = () => {
    const { total_parcelas, dia_vencimento, mes_inicial, ano_inicial } = form;
    const totalParcelas = toInt(total_parcelas);
    const diaVencimento = toInt(dia_vencimento);
    const anoInicial = toInt(ano_inicial);

    if (totalParcelas < 2 || !diaVencimento || !mes_inicial || !anoInicial) {
      setErro('Preencha número de parcelas, dia de vencimento e mês inicial.'); return;
    }
    if (diaVencimento < 1 || diaVencimento > 31) {
      setErro('O dia de vencimento deve ficar entre 1 e 31.'); return;
    }
    const idxMesInicial = MESES.indexOf(mes_inicial.toUpperCase());
    if (idxMesInicial === -1) {
      setErro('Mês inicial inválido.'); return;
    }
    const parcelas = [];
    for (let i = 0; i < totalParcelas; i++) {
      const idxMes = (idxMesInicial + i) % 12;
      const anosExtras = Math.floor((idxMesInicial + i) / 12);
      const anoAtual = anoInicial + anosExtras;
      const mesAtual = MESES[idxMes];
      const dataVenc = dataVencimento(diaVencimento, idxMes, anoAtual);
      const parcela = `${String(i + 1).padStart(2, '0')} DE ${String(totalParcelas).padStart(2, '0')}`;
      parcelas.push({ parcela, mesAtual, anoAtual, dataVenc });
    }
    setPreview(parcelas); setErro('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (preview.length === 0) { setErro('Clique em "Visualizar Parcelas" antes de salvar.'); return; }
    setSalvando(true); setErro('');
    try {
      const valorIndividual = calcularValorIndividual(form);
      const res = await fetch(`${API_URL}/api/parcelas/gerar`, {
        method: 'POST', headers,
        body: JSON.stringify({
          ...form, valor_total: toNumber(form.valor_total),
          valor_individual: valorIndividual,
          total_parcelas: toInt(form.total_parcelas),
          dia_vencimento: toInt(form.dia_vencimento),
          ano_inicial: toInt(form.ano_inicial),
        }),
      });
      const data = await res.json();
      if (data.erro) { setErro(data.erro); setSalvando(false); return; }
      setResultado(data); setForm(campoVazio); setPreview([]);
    } catch { setErro('Erro ao conectar com o servidor.'); }
    setSalvando(false);
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '32px', maxWidth: '900px', margin: '0 auto', color: 'var(--app-text)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', margin: 0, color: 'var(--app-text)' }}>Cadastro de Parcelas</h1>
        <button onClick={onVoltar} style={btnSecundario}>← Voltar</button>
      </div>

      {resultado && (
        <div style={{ background: 'var(--app-success-soft)', border: '1px solid var(--app-success)', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
          <p style={{ margin: 0, fontWeight: '700', color: 'var(--app-success-text)' }}>🎉 {resultado.total} parcela(s) gerada(s) com sucesso!</p>
          <button onClick={() => setResultado(null)} style={{ ...btnPrimario, marginTop: '12px', fontSize: '13px', padding: '6px 14px' }}>Cadastrar novo parcelamento</button>
        </div>
      )}

      {!resultado && (
        <form onSubmit={handleSubmit}>
          {erro && <div style={{ background: 'var(--app-danger-soft)', border: '1px solid var(--app-danger)', borderRadius: '6px', padding: '12px', marginBottom: '16px', color: 'var(--app-danger-text)', fontSize: '14px', fontWeight: '700' }}>{erro}</div>}

          <div style={secao}>
            <h2 style={tituloSecao}>Dados do Gasto</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
              <div style={{ gridColumn: '1 / -1' }}><label style={label}>Descrição *</label><input style={input} name="descricao" value={form.descricao} onChange={handleChange} required /></div>
              <div><label style={label}>Categoria</label>
                <select style={input} name="categoria" value={form.categoria} onChange={handleChange}>
                  <option value="">Selecione...</option>
                  {lkCategoria.map((l) => <option key={lookupKey(l)} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}
                </select>
              </div>
              <div><label style={label}>Forma de Pagamento</label>
                <select style={input} name="forma_pgto" value={form.forma_pgto} onChange={handleChange}>
                  <option value="">Selecione...</option>
                  {lkFormaPgto.map((l) => <option key={lookupKey(l)} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}
                </select>
              </div>
              <div><label style={label}>Responsável</label>
                <select style={input} name="responsavel" value={form.responsavel} onChange={handleChange}>
                  <option value="">Selecione...</option>
                  {lkResponsavel.map((l) => <option key={lookupKey(l)} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}
                </select>
              </div>
              <div><label style={label}>Grupo de dados</label>
                <select style={input} name="grupo_id" value={form.grupo_id} onChange={handleChange}>
                  <option value="">Padrão</option>
                  {grupos.map((grupo) => <option key={grupo.id} value={grupo.id}>{grupo.nome}</option>)}
                </select>
              </div>
              <div><label style={label}>Tipo *</label>
                <select style={input} name="tipo" value={form.tipo} onChange={handleChange} required>
                  <option value="">Selecione...</option>
                  {lkTipo.map((l) => <option key={lookupKey(l)} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}
                </select>
              </div>
              <div><label style={label}>Período *</label>
                <select style={input} name="periodo" value={form.periodo} onChange={handleChange} required>
                  <option value="">Selecione...</option>
                  {PERIODOS_GASTO.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div><label style={label}>Status</label>
                <select style={input} name="status" value={form.status} onChange={handleChange}>
                  <option value="">Selecione...</option>
                  {lkStatus.map((l) => <option key={lookupKey(l)} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}
                </select>
              </div>
              <div><label style={label}>Observação</label><input style={input} name="obs" value={form.obs} onChange={handleChange} /></div>
            </div>
          </div>

          <div style={secao}>
            <h2 style={tituloSecao}>Configuração das Parcelas</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              <div><label style={label}>Valor Total (R$) *</label><input style={input} name="valor_total" type="number" step="0.01" value={form.valor_total} onChange={handleChange} required /></div>
              <div>
                <label style={label}>Valor Individual (R$)</label>
                <input style={{ ...input, background: 'var(--app-surface-soft)', cursor: 'not-allowed' }} value={form.valor_individual || ''} readOnly tabIndex={-1} />
                <span style={{ fontSize: '11px', color: 'var(--app-muted)', marginTop: '4px', display: 'block' }}>
                  {normalizarTipoGasto(form.tipo) === 'C' ? `Total ÷ parcelas ÷ ${obterDivisorComum(lkDivisaoComum, form.responsavel, lkResponsavel)}` : normalizarTipoGasto(form.tipo) === 'I' ? 'Total ÷ parcelas' : '—'}
                </span>
              </div>
              <div><label style={label}>Número de Parcelas *</label><input style={input} name="total_parcelas" type="number" min="2" max="120" value={form.total_parcelas} onChange={handleChange} required /></div>
              <div><label style={label}>Dia de Vencimento *</label><input style={input} name="dia_vencimento" type="number" min="1" max="31" value={form.dia_vencimento} onChange={handleChange} required placeholder="ex: 10" /></div>
              <div><label style={label}>Mês da 1ª Parcela *</label>
                <select style={input} name="mes_inicial" value={form.mes_inicial} onChange={handleChange} required>
                  <option value="">Selecione...</option>
                  {MESES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div><label style={label}>Ano da 1ª Parcela *</label><input style={input} name="ano_inicial" type="number" value={form.ano_inicial} onChange={handleChange} required /></div>
            </div>
            <button type="button" onClick={gerarPreview} style={{ ...btnPrimario, marginTop: '16px', background: 'var(--app-accent)' }}>👁 Visualizar Parcelas</button>
          </div>

          {preview.length > 0 && (
            <div style={secao}>
              <h2 style={tituloSecao}>Preview — {preview.length} parcela(s)</h2>
              <div style={tabelaContainer}>
                <table style={{ width: '100%', minWidth: '680px', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead><tr style={{ background: 'var(--app-surface-soft)' }}>
                    <th style={th}>Parcela</th><th style={th}>Período</th><th style={th}>Mês</th><th style={th}>Ano</th><th style={th}>Vencimento</th><th style={th}>Valor Individual</th>
                  </tr></thead>
                  <tbody>
                    {preview.map((p, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--app-border)', background: i === 0 ? 'var(--app-accent-soft)' : 'transparent' }}>
                        <td style={td}>{p.parcela}</td><td style={td}>{form.periodo || '—'}</td><td style={td}>{p.mesAtual}</td>
                        <td style={td}>{p.anoAtual}</td><td style={td}>{p.dataVenc}</td>
                        <td style={td}>{formatarMoeda(form.valor_individual)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="submit" disabled={salvando} style={{ ...btnPrimario, marginTop: '20px', background: 'var(--app-success)' }}>
                {salvando ? 'Gerando parcelas...' : `✓ Confirmar e gerar ${preview.length} parcela(s)`}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

const secao = { background: 'var(--app-surface)', border: '1px solid var(--app-border)', borderRadius: '8px', padding: '20px', marginBottom: '24px', boxShadow: 'var(--app-shadow)' };
const tituloSecao = { fontSize: '16px', fontWeight: '800', margin: '0 0 16px', color: 'var(--app-text)' };
const tabelaContainer = { overflowX: 'auto', border: '1px solid var(--app-border)', borderRadius: '8px', background: 'var(--app-surface)' };
const th = { padding: '10px 12px', fontWeight: '800', borderBottom: '1px solid var(--app-border)', textAlign: 'left', color: 'var(--app-muted)' };
const td = { padding: '10px 12px', color: 'var(--app-text)' };
const label = { display: 'block', fontSize: '13px', color: 'var(--app-muted)', marginBottom: '4px', fontWeight: '700' };
const input = { width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--app-border)', fontSize: '14px', boxSizing: 'border-box', color: 'var(--app-text)', background: 'var(--app-input-bg)' };
const btnPrimario = { background: 'var(--app-accent)', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontWeight: '700' };
const btnSecundario = { background: 'var(--app-surface-soft)', color: 'var(--app-text)', border: '1px solid var(--app-border)', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontSize: '14px', fontWeight: '700' };

export default Parcelas;
