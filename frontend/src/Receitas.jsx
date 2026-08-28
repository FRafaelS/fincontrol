import React, { useMemo, useState } from 'react';
import API_URL from './api';
import { formatarMoeda, toNumber } from './utils/formatters';
import { getLookupLabel, lookupKey } from './utils/lookups';

const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

const TIPOS_RECEBIMENTO = [
  { value: 'QUINZENA', label: 'Quinzena' },
  { value: 'FINAL_MES', label: 'Final do mês' },
  { value: 'OUTRO', label: 'Outra data' },
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

const hojeISO = () => {
  const hoje = new Date();
  const local = new Date(hoje.getTime() - hoje.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const campoInicial = () => ({
  responsavel: '',
  grupo_id: '',
  descricao: '',
  valor: '',
  data_receita: hojeISO(),
  tipo_recebimento: 'QUINZENA',
  obs: '',
});

const periodoAtual = () => {
  const hoje = new Date();
  return `${MESES[hoje.getMonth()]}/${hoje.getFullYear()}`;
};

const separarPeriodo = (periodo = periodoAtual()) => {
  const [mes, ano] = String(periodo).split('/');
  return { mes, ano: Number(ano) || new Date().getFullYear() };
};

const isoParaBR = (valor) => {
  const [ano, mes, dia] = String(valor || '').split('-');
  if (!ano || !mes || !dia) return '';
  return `${dia}/${mes}/${String(ano).slice(-2)}`;
};

const brParaISO = (valor) => {
  const [dia, mes, ano] = String(valor || '').split('/');
  if (!dia || !mes || !ano) return '';
  const anoCompleto = ano.length === 2 ? `20${ano}` : ano;
  return `${anoCompleto}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
};

const periodoDaDataISO = (valor) => {
  const [ano, mes] = String(valor || '').split('-');
  const indiceMes = Number(mes) - 1;
  const anoNumero = Number(ano);
  if (!Number.isFinite(anoNumero) || indiceMes < 0 || indiceMes > 11) return null;
  return { mes: MESES[indiceMes], ano: anoNumero };
};

const tipoLabel = (tipo) =>
  TIPOS_RECEBIMENTO.find((item) => item.value === tipo)?.label || tipo || '-';

const dataOrdenacao = (data) => {
  const [dia, mes, ano] = String(data || '').split('/');
  if (!dia || !mes || !ano) return 0;
  const anoCompleto = ano.length === 2 ? 2000 + Number(ano) : Number(ano);
  const timestamp = new Date(anoCompleto, Number(mes) - 1, Number(dia)).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const normalizarReceita = (receita = {}) => ({
  ...receita,
  valor: toNumber(receita.valor),
});

const lerJsonSeguro = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.erro || 'Erro ao processar a solicitação.');
  return data;
};

function Receitas({
  token,
  receitas = [],
  responsaveis = [],
  grupos = [],
  periodoSelecionado = periodoAtual(),
  onAtualizar,
}) {
  const [form, setForm] = useState(campoInicial);
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroBusca, setFiltroBusca] = useState('');

  const fetchAuth = (url, options = {}) =>
    fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

  const receitasNormalizadas = useMemo(
    () => receitas.map(normalizarReceita),
    [receitas]
  );

  const { mes, ano } = separarPeriodo(periodoSelecionado);

  const receitasPeriodo = useMemo(
    () => receitasNormalizadas.filter((r) => r.mes === mes && Number(r.ano) === ano),
    [receitasNormalizadas, mes, ano]
  );

  const receitasFiltradas = useMemo(() => {
    const termo = filtroBusca.trim().toLowerCase();
    return receitasPeriodo
      .filter((r) => filtroResponsavel ? r.responsavel === filtroResponsavel : true)
      .filter((r) => filtroTipo ? r.tipo_recebimento === filtroTipo : true)
      .filter((r) => termo
        ? String(r.descricao || '').toLowerCase().includes(termo) ||
          String(getLookupLabel(responsaveis, r.responsavel)).toLowerCase().includes(termo) ||
          String(r.obs || '').toLowerCase().includes(termo)
        : true)
      .sort((a, b) => dataOrdenacao(b.data_receita) - dataOrdenacao(a.data_receita) || Number(b.id || 0) - Number(a.id || 0));
  }, [filtroBusca, filtroResponsavel, filtroTipo, receitasPeriodo, responsaveis]);

  const totalPeriodo = receitasPeriodo.reduce((s, r) => s + toNumber(r.valor), 0);
  const totalQuinzena = receitasPeriodo
    .filter((r) => r.tipo_recebimento === 'QUINZENA')
    .reduce((s, r) => s + toNumber(r.valor), 0);
  const totalFinalMes = receitasPeriodo
    .filter((r) => r.tipo_recebimento === 'FINAL_MES')
    .reduce((s, r) => s + toNumber(r.valor), 0);

  const porResponsavel = Object.values(
    receitasPeriodo.reduce((acc, r) => {
      const responsavel = getLookupLabel(responsaveis, r.responsavel) || 'Sem responsável';
      if (!acc[responsavel]) acc[responsavel] = { responsavel, total: 0, quantidade: 0 };
      acc[responsavel].total += toNumber(r.valor);
      acc[responsavel].quantidade += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (erro) setErro('');
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const limparFormulario = () => {
    setForm(campoInicial());
    setEditandoId(null);
    setErro('');
  };

  const handleEditar = (receita) => {
    setForm({
      responsavel: receita.responsavel || '',
      grupo_id: receita.grupo_id || '',
      descricao: receita.descricao || '',
      valor: receita.valor || '',
      data_receita: brParaISO(receita.data_receita) || hojeISO(),
      tipo_recebimento: receita.tipo_recebimento || 'QUINZENA',
      obs: receita.obs || '',
    });
    setEditandoId(receita.id);
    setErro('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const validarForm = () => {
    if (!form.responsavel.trim()) return 'Informe o responsável pela receita.';
    if (!form.descricao.trim()) return 'Informe a descrição da receita.';
    if (toNumber(form.valor) <= 0) return 'Informe um valor de receita maior que zero.';
    if (!form.data_receita) return 'Informe a data de recebimento.';
    if (!periodoDaDataISO(form.data_receita)) return 'Data de recebimento inválida.';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const erroValidacao = validarForm();
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    const periodo = periodoDaDataISO(form.data_receita);
    const payload = {
      ...form,
      valor: toNumber(form.valor),
      data_receita: isoParaBR(form.data_receita),
      mes: periodo.mes,
      ano: periodo.ano,
    };

    setSalvando(true);
    setErro('');
    try {
      const url = editandoId
        ? `${API_URL}/api/receitas/${editandoId}`
        : `${API_URL}/api/receitas`;
      const res = await fetchAuth(url, {
        method: editandoId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      await lerJsonSeguro(res);
      limparFormulario();
      await onAtualizar?.();
    } catch (err) {
      setErro(err.message || 'Erro ao salvar receita.');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (receita) => {
    if (!window.confirm(`Excluir a receita "${receita.descricao}"?`)) return;

    try {
      const res = await fetchAuth(`${API_URL}/api/receitas/${receita.id}`, { method: 'DELETE' });
      await lerJsonSeguro(res);
      if (editandoId === receita.id) limparFormulario();
      await onAtualizar?.();
    } catch (err) {
      setErro(err.message || 'Erro ao excluir receita.');
    }
  };

  const filtrosAtivos = filtroResponsavel || filtroTipo || filtroBusca;

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
      {erro && (
        <div style={alertaErro}>
          {erro}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '18px' }}>
        <ResumoCard titulo="Receitas do período" valor={formatarMoeda(totalPeriodo)} detalhe={`${receitasPeriodo.length} lançamento(s)`} cor={cores.positivo} />
        <ResumoCard titulo="Quinzena" valor={formatarMoeda(totalQuinzena)} detalhe="Recebimentos intermediários" cor={cores.destaque} />
        <ResumoCard titulo="Final do mês" valor={formatarMoeda(totalFinalMes)} detalhe="Recebimentos de fechamento" cor={cores.alerta} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px', alignItems: 'start' }}>
        <section style={painel}>
          <div style={cabecalhoPainel}>
            <div>
              <h2 style={tituloPainel}>{editandoId ? `Editando receita #${editandoId}` : 'Nova receita'}</h2>
              <p style={subtituloPainel}>Data escolhida define o mês do dashboard</p>
            </div>
            {editandoId && (
              <button type="button" onClick={limparFormulario} title="Cancelar edição" style={botaoSecundario}>
                Cancelar
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gap: '14px' }}>
              <div>
                <label style={label}>Responsável *</label>
                {responsaveis.length > 0 ? (
                  <select style={input} name="responsavel" value={form.responsavel} onChange={handleChange} required>
                    <option value="">Selecione...</option>
                    {responsaveis.map((l) => (
                      <option key={lookupKey(l)} value={l.MEANING}>{l.LOOKUP_CODE}</option>
                    ))}
                  </select>
                ) : (
                  <input style={input} name="responsavel" value={form.responsavel} onChange={handleChange} required />
                )}
              </div>

              <div>
                <label style={label}>Grupo de dados</label>
                <select style={input} name="grupo_id" value={form.grupo_id} onChange={handleChange}>
                  <option value="">Padrão</option>
                  {grupos.map((grupo) => (
                    <option key={grupo.id} value={grupo.id}>{grupo.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={label}>Descrição *</label>
                <input style={input} name="descricao" value={form.descricao} onChange={handleChange} placeholder="Salário, vale, extra..." required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={label}>Valor (R$) *</label>
                  <input style={input} name="valor" type="number" min="0" step="0.01" value={form.valor} onChange={handleChange} required />
                </div>
                <div>
                  <label style={label}>Data *</label>
                  <input style={input} name="data_receita" type="date" value={form.data_receita} onChange={handleChange} required />
                </div>
              </div>

              <div>
                <label style={label}>Tipo de recebimento</label>
                <select style={input} name="tipo_recebimento" value={form.tipo_recebimento} onChange={handleChange}>
                  {TIPOS_RECEBIMENTO.map((tipo) => (
                    <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={label}>Observação</label>
                <input style={input} name="obs" value={form.obs} onChange={handleChange} placeholder="Banco, referência, detalhes..." />
              </div>
            </div>

            <button type="submit" disabled={salvando} style={botaoPrimario}>
              {salvando ? 'Salvando...' : editandoId ? 'Atualizar receita' : 'Salvar receita'}
            </button>
          </form>
        </section>

        <section style={painel}>
          <div style={cabecalhoPainel}>
            <div>
              <h2 style={tituloPainel}>Receitas cadastradas</h2>
              <p style={subtituloPainel}>{periodoSelecionado} · {receitasFiltradas.length} registro(s)</p>
            </div>
          </div>

          <div style={barraFiltros}>
            <input
              style={{ ...input, margin: 0, minWidth: '190px' }}
              value={filtroBusca}
              onChange={(e) => setFiltroBusca(e.target.value)}
              placeholder="Buscar..."
            />
            <select style={{ ...input, margin: 0, minWidth: '150px' }} value={filtroResponsavel} onChange={(e) => setFiltroResponsavel(e.target.value)}>
              <option value="">Responsável</option>
              {responsaveis.map((l) => (
                <option key={lookupKey(l)} value={l.MEANING}>{l.LOOKUP_CODE}</option>
              ))}
            </select>
            <select style={{ ...input, margin: 0, minWidth: '142px' }} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="">Tipo</option>
              {TIPOS_RECEBIMENTO.map((tipo) => (
                <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
              ))}
            </select>
            {filtrosAtivos && (
              <button
                type="button"
                onClick={() => { setFiltroResponsavel(''); setFiltroTipo(''); setFiltroBusca(''); }}
                style={botaoFiltro}
              >
                Limpar
              </button>
            )}
          </div>

          {porResponsavel.length > 0 && (
            <div style={{ display: 'grid', gap: '10px', marginBottom: '16px' }}>
              {porResponsavel.slice(0, 4).map((item) => (
                <div key={item.responsavel} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '5px' }}>
                      <span style={{ color: cores.texto, fontSize: '13px', fontWeight: '800', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.responsavel}</span>
                      <span style={{ color: cores.textoSuave, fontSize: '12px', fontWeight: '700' }}>{item.quantidade}x</span>
                    </div>
                    <div style={{ height: '7px', background: 'var(--app-accent-soft)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, (item.total / Math.max(totalPeriodo, 1)) * 100)}%`, height: '100%', background: cores.positivo }} />
                    </div>
                  </div>
                  <strong style={{ color: cores.positivo, fontSize: '13px' }}>{formatarMoeda(item.total)}</strong>
                </div>
              ))}
            </div>
          )}

          {receitasFiltradas.length > 0 ? (
            <div style={tabelaContainer}>
              <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr>
                    <th style={th}>Data</th>
                    <th style={th}>Responsável</th>
                    <th style={th}>Descrição</th>
                    <th style={th}>Tipo</th>
                    <th style={{ ...th, textAlign: 'right' }}>Valor</th>
                    <th style={{ ...th, textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {receitasFiltradas.map((receita) => (
                    <tr key={receita.id} style={{ borderTop: `1px solid ${cores.borda}` }}>
                      <td style={td}>{receita.data_receita || '-'}</td>
                      <td style={td}>{getLookupLabel(responsaveis, receita.responsavel)}</td>
                      <td style={{ ...td, color: cores.texto, fontWeight: '800' }}>
                        {receita.descricao || '-'}
                        {receita.obs && <span style={{ display: 'block', marginTop: '3px', color: cores.textoSuave, fontSize: '12px', fontWeight: '600' }}>{receita.obs}</span>}
                      </td>
                      <td style={td}>
                        <span style={tagTipo(receita.tipo_recebimento)}>
                          {tipoLabel(receita.tipo_recebimento)}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: 'right', color: cores.positivo, fontWeight: '900' }}>
                        +{formatarMoeda(receita.valor)}
                      </td>
                      <td style={{ ...td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button type="button" onClick={() => handleEditar(receita)} title="Editar receita" style={botaoIcone}>
                          Editar
                        </button>
                        <button type="button" onClick={() => handleExcluir(receita)} title="Excluir receita" style={{ ...botaoIcone, color: cores.negativo }}>
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Vazio texto={filtrosAtivos ? 'Nenhuma receita encontrada.' : 'Nenhuma receita cadastrada neste período.'} />
          )}
        </section>
      </div>
    </div>
  );
}

function ResumoCard({ titulo, valor, detalhe, cor }) {
  return (
    <section style={cardResumo}>
      <p style={cardLabel}>{titulo}</p>
      <p style={{ ...cardValor, color: cor }}>{valor}</p>
      <p style={cardSub}>{detalhe}</p>
    </section>
  );
}

function Vazio({ texto }) {
  return (
    <div style={{ minHeight: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: cores.textoSuave, fontSize: '14px' }}>
      {texto}
    </div>
  );
}

const tagTipo = (tipo) => ({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '26px',
  padding: '0 10px',
  borderRadius: '8px',
  border: `1px solid ${tipo === 'FINAL_MES' ? 'var(--app-warning)' : 'var(--app-accent)'}`,
  background: tipo === 'FINAL_MES' ? 'var(--app-warning-soft)' : 'var(--app-accent-soft)',
  color: tipo === 'FINAL_MES' ? 'var(--app-warning-text)' : 'var(--app-accent-strong)',
  fontSize: '12px',
  fontWeight: '800',
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
const cardResumo = { ...painel, minHeight: '126px' };
const cardLabel = { margin: '0 0 10px', fontSize: '12px', color: cores.textoSuave, textTransform: 'uppercase', letterSpacing: '0', fontWeight: '800' };
const cardValor = { margin: '0 0 8px', fontSize: '28px', fontWeight: '900' };
const cardSub = { margin: 0, fontSize: '12px', color: cores.textoSuave, fontWeight: '700' };
const barraFiltros = { display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '16px' };
const label = { display: 'block', fontSize: '13px', color: cores.textoSuave, marginBottom: '6px', fontWeight: '800' };
const input = { width: '100%', minHeight: '38px', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${cores.borda}`, fontSize: '14px', boxSizing: 'border-box', color: cores.texto, background: 'var(--app-input-bg)' };
const botaoPrimario = { marginTop: '18px', width: '100%', minHeight: '42px', background: cores.destaque, color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontSize: '14px', fontWeight: '800' };
const botaoSecundario = { minHeight: '34px', background: 'var(--app-surface-soft)', color: cores.textoSuave, border: `1px solid ${cores.borda}`, borderRadius: '8px', padding: '0 12px', cursor: 'pointer', fontSize: '13px', fontWeight: '800' };
const botaoFiltro = { minHeight: '38px', background: 'var(--app-surface-soft)', color: cores.textoSuave, border: `1px solid ${cores.borda}`, borderRadius: '8px', padding: '0 12px', cursor: 'pointer', fontSize: '13px', fontWeight: '800' };
const botaoIcone = { minWidth: '56px', minHeight: '30px', marginLeft: '6px', background: 'var(--app-surface)', color: cores.destaque, border: `1px solid ${cores.borda}`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '800' };
const alertaErro = { background: 'var(--app-danger-soft)', border: '1px solid var(--app-danger)', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px', color: 'var(--app-danger-text)', fontSize: '14px', fontWeight: '700' };
const tabelaContainer = { overflowX: 'auto', border: `1px solid ${cores.borda}`, borderRadius: '8px', background: 'var(--app-surface)' };
const th = { padding: '11px 12px', color: cores.textoSuave, textAlign: 'left', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0', fontWeight: '800' };
const td = { padding: '13px 12px', color: cores.textoSuave, verticalAlign: 'top' };

export default Receitas;
