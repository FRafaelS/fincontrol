import React, { useState, useEffect } from 'react';

const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

const campoVazio = {
  responsavel: '',
  tipo: '',
  descricao: '',
  categoria: '',
  forma_pgto: '',
  valor_total: '',
  total_parcelas: '',
  dia_vencimento: '',
  mes_inicial: '',
  ano_inicial: new Date().getFullYear(),
  status: '',
  obs: '',
};

function Parcelas({ onVoltar }) {
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

  useEffect(() => {
    const buscar = (tipo, setter) => {
      fetch(`${API_URL}/api/lookups/valores/${tipo}')
        .then((r) => r.json())
        .then(setter)
        .catch(() => setter([]));
    };
    buscar('RESPONSAVEL', setLkResponsavel);
    buscar('CATEGORIA', setLkCategoria);
    buscar('FORMA_PGTO', setLkFormaPgto);
    buscar('STATUS_GASTO', setLkStatus);
    buscar('TIPO_GASTO', setLkTipo);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const novo = { ...prev, [name]: value };

      // Recalcula valor individual
      if (['tipo', 'responsavel', 'valor_total'].includes(name)) {
        const valorTotal = parseFloat(name === 'valor_total' ? value : prev.valor_total) || 0;
        const tipoAtual = name === 'tipo' ? value : prev.tipo;
        const respAtual = name === 'responsavel' ? value : prev.responsavel;

        if (tipoAtual === 'I') {
          novo.valor_individual = valorTotal.toFixed(2);
        } else if (tipoAtual === 'C') {
          const resp = lkResponsavel.find((l) => l.MEANING === respAtual);
          const divisor = resp?.TAG ? parseFloat(resp.TAG) : 1;
          novo.valor_individual = (valorTotal / divisor).toFixed(2);
        }
      }

      return novo;
    });
    setPreview([]);
    setResultado(null);
    setErro('');
  };

  const gerarPreview = () => {
    const { total_parcelas, dia_vencimento, mes_inicial, ano_inicial } = form;

    if (!total_parcelas || !dia_vencimento || !mes_inicial) {
      setErro('Preencha número de parcelas, dia de vencimento e mês inicial.');
      return;
    }

    const idxMesInicial = MESES.indexOf(mes_inicial.toUpperCase());
    const parcelas = [];

    for (let i = 0; i < parseInt(total_parcelas); i++) {
      const idxMes = (idxMesInicial + i) % 12;
      const anosExtras = Math.floor((idxMesInicial + i) / 12);
      const anoAtual = parseInt(ano_inicial) + anosExtras;
      const mesAtual = MESES[idxMes];

      const diaStr = String(dia_vencimento).padStart(2, '0');
      const mesNumStr = String(idxMes + 1).padStart(2, '0');
      const anoStr = String(anoAtual).slice(-2);
      const dataVenc = `${diaStr}/${mesNumStr}/${anoStr}`;
      const parcela = `${String(i + 1).padStart(2, '0')} DE ${String(total_parcelas).padStart(2, '0')}`;

      parcelas.push({ parcela, mesAtual, anoAtual, dataVenc });
    }

    setPreview(parcelas);
    setErro('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (preview.length === 0) {
      setErro('Clique em "Visualizar Parcelas" antes de salvar.');
      return;
    }

    setSalvando(true);
    setErro('');

    try {
      const valorIndividual = form.tipo === 'I'
        ? parseFloat(form.valor_total)
        : (() => {
            const resp = lkResponsavel.find((l) => l.MEANING === form.responsavel);
            const divisor = resp?.TAG ? parseFloat(resp.TAG) : 1;
            return parseFloat(form.valor_total) / divisor;
          })();

      const res = await fetch(`${API_URL}/api/parcelas/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          valor_total: parseFloat(form.valor_total),
          valor_individual: valorIndividual,
          total_parcelas: parseInt(form.total_parcelas),
          dia_vencimento: parseInt(form.dia_vencimento),
          ano_inicial: parseInt(form.ano_inicial),
        }),
      });

      const data = await res.json();
      if (data.erro) { setErro(data.erro); setSalvando(false); return; }

      setResultado(data);
      setForm(campoVazio);
      setPreview([]);
    } catch {
      setErro('Erro ao conectar com o servidor.');
    }

    setSalvando(false);
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '32px', maxWidth: '900px', margin: '0 auto' }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', margin: 0 }}>Cadastro de Parcelas</h1>
        <button onClick={onVoltar} style={btnSecundario}>← Voltar</button>
      </div>

      {/* Resultado */}
      {resultado && (
        <div style={{ background: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
          <p style={{ margin: 0, fontWeight: '600', color: '#155724' }}>
            🎉 {resultado.total} parcela(s) gerada(s) com sucesso!
          </p>
          <button
            onClick={() => setResultado(null)}
            style={{ ...btnPrimario, marginTop: '12px', fontSize: '13px', padding: '6px 14px' }}
          >
            Cadastrar novo parcelamento
          </button>
        </div>
      )}

      {!resultado && (
        <form onSubmit={handleSubmit}>

          {erro && (
            <div style={{ background: '#f8d7da', border: '1px solid #f5c2c7', borderRadius: '6px', padding: '12px', marginBottom: '16px', color: '#842029', fontSize: '14px' }}>
              {erro}
            </div>
          )}

          {/* Dados do gasto */}
          <div style={secao}>
            <h2 style={tituloSecao}>Dados do Gasto</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div style={{ gridColumn: 'span 3' }}>
                <label style={label}>Descrição *</label>
                <input style={input} name="descricao" value={form.descricao} onChange={handleChange} required />
              </div>
              <div>
                <label style={label}>Categoria</label>
                <select style={input} name="categoria" value={form.categoria} onChange={handleChange}>
                  <option value="">Selecione...</option>
                  {lkCategoria.map((l) => <option key={l.ID} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Forma de Pagamento</label>
                <select style={input} name="forma_pgto" value={form.forma_pgto} onChange={handleChange}>
                  <option value="">Selecione...</option>
                  {lkFormaPgto.map((l) => <option key={l.ID} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Responsável</label>
                <select style={input} name="responsavel" value={form.responsavel} onChange={handleChange}>
                  <option value="">Selecione...</option>
                  {lkResponsavel.map((l) => <option key={l.ID} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Tipo</label>
                <select style={input} name="tipo" value={form.tipo} onChange={handleChange}>
                  <option value="">Selecione...</option>
                  {lkTipo.map((l) => <option key={l.ID} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Status</label>
                <select style={input} name="status" value={form.status} onChange={handleChange}>
                  <option value="">Selecione...</option>
                  {lkStatus.map((l) => <option key={l.ID} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Observação</label>
                <input style={input} name="obs" value={form.obs} onChange={handleChange} />
              </div>
            </div>
          </div>

          {/* Dados do parcelamento */}
          <div style={secao}>
            <h2 style={tituloSecao}>Configuração das Parcelas</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
              <div>
                <label style={label}>Valor Total (R$) *</label>
                <input style={input} name="valor_total" type="number" step="0.01" value={form.valor_total} onChange={handleChange} required />
              </div>
              <div>
                <label style={label}>Valor Individual (R$)</label>
                <input
                  style={{ ...input, background: '#e9ecef', cursor: 'not-allowed' }}
                  value={form.valor_individual || ''}
                  readOnly
                  tabIndex={-1}
                />
                <span style={{ fontSize: '11px', color: '#888', marginTop: '4px', display: 'block' }}>
                  {form.tipo === 'C' && form.responsavel
                    ? `Total ÷ ${lkResponsavel.find(l => l.MEANING === form.responsavel)?.TAG || 1}`
                    : form.tipo === 'I' ? 'Igual ao valor total' : '—'}
                </span>
              </div>
              <div>
                <label style={label}>Número de Parcelas *</label>
                <input style={input} name="total_parcelas" type="number" min="2" max="120" value={form.total_parcelas} onChange={handleChange} required />
              </div>
              <div>
                <label style={label}>Dia de Vencimento *</label>
                <input style={input} name="dia_vencimento" type="number" min="1" max="31" value={form.dia_vencimento} onChange={handleChange} required placeholder="ex: 10" />
              </div>
              <div>
                <label style={label}>Mês da 1ª Parcela *</label>
                <select style={input} name="mes_inicial" value={form.mes_inicial} onChange={handleChange} required>
                  <option value="">Selecione...</option>
                  {MESES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Ano da 1ª Parcela *</label>
                <input style={input} name="ano_inicial" type="number" value={form.ano_inicial} onChange={handleChange} required />
              </div>
            </div>

            <button
              type="button"
              onClick={gerarPreview}
              style={{ ...btnPrimario, marginTop: '16px', background: '#6f42c1' }}
            >
              👁 Visualizar Parcelas
            </button>
          </div>

          {/* Preview das parcelas */}
          {preview.length > 0 && (
            <div style={secao}>
              <h2 style={tituloSecao}>Preview — {preview.length} parcela(s)</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={th}>Parcela</th>
                    <th style={th}>Mês</th>
                    <th style={th}>Ano</th>
                    <th style={th}>Vencimento</th>
                    <th style={th}>Valor Individual</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #eee', background: i === 0 ? '#e8f4fd' : 'transparent' }}>
                      <td style={td}>{p.parcela}</td>
                      <td style={td}>{p.mesAtual}</td>
                      <td style={td}>{p.anoAtual}</td>
                      <td style={td}>{p.dataVenc}</td>
                      <td style={td}>R$ {parseFloat(form.valor_individual || 0).toFixed(2).replace('.', ',')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button
                type="submit"
                disabled={salvando}
                style={{ ...btnPrimario, marginTop: '20px', background: '#198754' }}
              >
                {salvando ? 'Gerando parcelas...' : `✓ Confirmar e gerar ${preview.length} parcela(s)`}
              </button>
            </div>
          )}

        </form>
      )}
    </div>
  );
}

const secao = { background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '8px', padding: '20px', marginBottom: '24px' };
const tituloSecao = { fontSize: '16px', fontWeight: '600', margin: '0 0 16px' };
const th = { padding: '10px 12px', fontWeight: '600', borderBottom: '2px solid #ddd', textAlign: 'left' };
const td = { padding: '10px 12px' };
const label = { display: 'block', fontSize: '13px', color: '#555', marginBottom: '4px' };
const input = { width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ced4da', fontSize: '14px', boxSizing: 'border-box' };
const btnPrimario = { background: '#0d6efd', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px' };
const btnSecundario = { background: '#6c757d', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontSize: '14px' };

export default Parcelas;