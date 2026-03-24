import API_URL from './api';
import React, { useState, useEffect, useRef } from 'react';
import Layout from './Layout';
import Login from './Login';
import Perfil from './Perfil';
import Dashboard from './Dashboard';
import Lookups from './Lookups';
import Importacao from './Importacao';
import Parcelas from './Parcelas';
import Relatorios from './Relatorios';
import { classificarVencimento, diasParaVencer } from './utils/datas';

const campoVazio = {
  responsavel: '', tipo: '', descricao: '', parcela: '',
  categoria: '', forma_pgto: '', valor_total: '', valor_individual: '',
  data_venc: '', mes: '', ano: new Date().getFullYear(), status: '', obs: '',
};

const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

const COR_VENCIMENTO = {
  vencido: { fundo: '#fef2f2', texto: '#dc2626' },
  hoje:    { fundo: '#fffbeb', texto: '#d97706' },
  proximo: { fundo: '#fff7ed', texto: '#ea580c' },
  normal:  { fundo: 'transparent', texto: 'inherit' },
};

function App() {
  const [pagina, setPagina] = useState('gastos');
  const [gastos, setGastos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(campoVazio);
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [diasAlerta, setDiasAlerta] = useState(7);
  const [bannerFechado, setBannerFechado] = useState(false);
  const [verPerfil, setVerPerfil] = useState(false);

  // Auth
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [usuario, setUsuario] = useState(() => {
    try { return JSON.parse(localStorage.getItem('usuario')) || null; }
    catch { return null; }
  });

  const [selecionados, setSelecionados] = useState([]);
  const [menuAcoesAberto, setMenuAcoesAberto] = useState(false);
  const [modalPagamento, setModalPagamento] = useState(false);
  const [dataPagamento, setDataPagamento] = useState('');
  const [confirmandoPagamento, setConfirmandoPagamento] = useState(false);
  const menuRef = useRef(null);

  const [lkResponsavel, setLkResponsavel] = useState([]);
  const [lkCategoria, setLkCategoria] = useState([]);
  const [lkFormaPgto, setLkFormaPgto] = useState([]);
  const [lkStatus, setLkStatus] = useState([]);
  const [lkTipo, setLkTipo] = useState([]);

  const [filtroMes, setFiltroMes] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [filtroBusca, setFiltroBusca] = useState('');

  // Fetch autenticado
  const fetchAuth = (url, options = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  };

  const handleLogin = (novoUsuario, novoToken) => {
    setToken(novoToken);
    setUsuario(novoUsuario);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setToken('');
    setUsuario(null);
  };

  const buscarLookup = (tipo, setter) =>
    fetchAuth(`${API_URL}/api/lookups/valores/${tipo}`)
      .then((r) => r.json()).then(setter).catch(() => setter([]));

  const buscarTodasLookups = () => {
    buscarLookup('RESPONSAVEL', setLkResponsavel);
    buscarLookup('CATEGORIA', setLkCategoria);
    buscarLookup('FORMA_PGTO', setLkFormaPgto);
    buscarLookup('STATUS_GASTO', setLkStatus);
    buscarLookup('TIPO_GASTO', setLkTipo);
    fetchAuth(`${API_URL}/api/lookups/valores/CONFIG_ALERTAS')
      .then((r) => r.json())
      .then((configs) => {
        const c = configs.find((c) => c.LOOKUP_CODE === 'DIAS_ALERTA_VENCIMENTO');
        if (c?.TAG) setDiasAlerta(parseInt(c.TAG));
      }).catch(() => {});
  };

  const buscarGastos = () => {
    fetchAuth(`${API_URL}/api/gastos')
      .then((r) => {
        if (r.status === 401) { handleLogout(); return []; }
        return r.json();
      })
      .then((d) => { setGastos(d); setCarregando(false); })
      .catch(() => setCarregando(false));
  };

  useEffect(() => {
    if (token) { buscarGastos(); buscarTodasLookups(); }
    else setCarregando(false);
  }, [token]);

  useEffect(() => {
    const handleClickFora = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuAcoesAberto(false);
    };
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  const getLookupLabel = (lista, meaning) => {
    const item = lista.find((l) => l.MEANING === meaning);
    return item ? item.LOOKUP_CODE : meaning || '—';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const novo = { ...prev, [name]: value };
      if (['tipo', 'responsavel', 'valor_total'].includes(name)) {
        const vt = parseFloat(name === 'valor_total' ? value : prev.valor_total) || 0;
        const t = name === 'tipo' ? value : prev.tipo;
        const r = name === 'responsavel' ? value : prev.responsavel;
        if (t === 'I') novo.valor_individual = vt.toFixed(2);
        else if (t === 'C') {
          const resp = lkResponsavel.find((l) => l.MEANING === r);
          const div = resp?.TAG ? parseFloat(resp.TAG) : 1;
          novo.valor_individual = (vt / div).toFixed(2);
        }
      }
      return novo;
    });
  };

  const handleNovoGasto = () => { setForm(campoVazio); setEditandoId(null); setMostrarForm(true); };

  const handleEditar = (gasto) => {
    setForm({
      responsavel: gasto.responsavel || '', tipo: gasto.tipo || '',
      descricao: gasto.descricao || '', parcela: gasto.parcela || '',
      categoria: gasto.categoria || '', forma_pgto: gasto.forma_pgto || '',
      valor_total: gasto.valor_total || '', valor_individual: gasto.valor_individual || '',
      data_venc: gasto.data_venc || '', mes: gasto.mes || '',
      ano: gasto.ano || new Date().getFullYear(),
      status: gasto.status || '', obs: gasto.obs || '',
    });
    setEditandoId(gasto.id);
    setMostrarForm(true);
    setMenuAcoesAberto(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletar = () => {
    if (!window.confirm(`Excluir ${selecionados.length} registro(s)?`)) return;
    setMenuAcoesAberto(false);
    Promise.all(selecionados.map((id) =>
      fetchAuth(`${API_URL}/api/gastos/${id}`, { method: 'DELETE' }).then((r) => r.json())
    )).then(() => { setSelecionados([]); buscarGastos(); });
  };

  const handleSubmit = (e) => {
    e.preventDefault(); setSalvando(true);
    const url = editandoId
      ? `${API_URL}/api/gastos/${editandoId}`
      : `${API_URL}/api/gastos';
    fetchAuth(url, {
      method: editandoId ? 'PUT' : 'POST',
      body: JSON.stringify({
        ...form,
        valor_total: parseFloat(form.valor_total),
        valor_individual: parseFloat(form.valor_individual),
        ano: parseInt(form.ano),
      }),
    }).then((r) => r.json()).then(() => {
      setForm(campoVazio); setMostrarForm(false);
      setEditandoId(null); setSalvando(false);
      setSelecionados([]); buscarGastos();
    }).catch(() => setSalvando(false));
  };

  const toggleSelecionado = (id) =>
    setSelecionados((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);

  const toggleSelecionarTodos = () =>
    setSelecionados(selecionados.length === gastosFiltrados.length ? [] : gastosFiltrados.map((g) => g.id));

  const abrirModalPagamento = () => {
    const hoje = new Date();
    const d = String(hoje.getDate()).padStart(2,'0');
    const m = String(hoje.getMonth()+1).padStart(2,'0');
    const a = String(hoje.getFullYear()).slice(-2);
    setDataPagamento(`${d}/${m}/${a}`);
    setModalPagamento(true);
    setMenuAcoesAberto(false);
  };

  const confirmarPagamento = async () => {
    if (!dataPagamento) return;
    setConfirmandoPagamento(true);
    const statusPago = lkStatus.find((l) => l.LOOKUP_CODE === 'Pago' || l.LOOKUP_CODE === 'PAGO');
    const statusMeaning = statusPago?.MEANING || 'PAGO';
    await Promise.all(selecionados.map(async (id) => {
      const g = gastos.find((g) => g.id === id);
      if (!g) return;
      return fetchAuth(`${API_URL}/api/gastos/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...g, status: statusMeaning, obs: `Pago em ${dataPagamento}${g.obs ? ' · ' + g.obs : ''}` }),
      });
    }));
    setConfirmandoPagamento(false);
    setModalPagamento(false);
    setSelecionados([]);
    buscarGastos();
  };

  const limparFiltros = () => {
    setFiltroMes(''); setFiltroStatus('');
    setFiltroResponsavel(''); setFiltroBusca('');
  };

  const gastosFiltrados = gastos.filter((g) => {
    const okMes = filtroMes ? g.mes === filtroMes : true;
    const okStatus = filtroStatus ? g.status === filtroStatus : true;
    const okResp = filtroResponsavel ? g.responsavel === filtroResponsavel : true;
    const okBusca = filtroBusca
      ? g.descricao?.toLowerCase().includes(filtroBusca.toLowerCase()) ||
        g.categoria?.toLowerCase().includes(filtroBusca.toLowerCase())
      : true;
    return okMes && okStatus && okResp && okBusca;
  });

  const gastosPendentes = gastos.filter((g) => g.status !== 'PAGO');
  const vencidos = gastosPendentes.filter((g) => classificarVencimento(g.data_venc, diasAlerta) === 'vencido');
  const vencem_hoje = gastosPendentes.filter((g) => classificarVencimento(g.data_venc, diasAlerta) === 'hoje');
  const proximos = gastosPendentes.filter((g) => classificarVencimento(g.data_venc, diasAlerta) === 'proximo');
  const alertas = [...vencidos, ...vencem_hoje, ...proximos];

  const total = gastosFiltrados.reduce((s, g) => s + g.valor_individual, 0);
  const filtersAtivos = filtroMes || filtroStatus || filtroResponsavel || filtroBusca;
  const todosSelecionados = gastosFiltrados.length > 0 && selecionados.length === gastosFiltrados.length;

  // Tela de login
  if (!usuario) return <Login onLogin={handleLogin} />;

  if (carregando) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f1f4f8' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '40px', marginBottom: '12px' }}>💳</p>
        <p style={{ color: '#64748b', fontSize: '14px' }}>Carregando FinControl...</p>
      </div>
    </div>
  );

  // Tela de perfil
  if (verPerfil) return (
    <Perfil
      usuario={usuario}
      token={token}
      onVoltar={() => setVerPerfil(false)}
      onAtualizar={(u) => {
        setUsuario(u);
        localStorage.setItem('usuario', JSON.stringify(u));
      }}
    />
  );

  const renderPagina = () => {
    if (pagina === 'dashboard')  return <Dashboard gastos={gastos} onVoltar={() => setPagina('gastos')} />;
    if (pagina === 'parametros') return <Lookups onVoltar={() => { setPagina('gastos'); buscarTodasLookups(); }} />;
    if (pagina === 'importacao') return <Importacao onVoltar={() => { setPagina('gastos'); buscarGastos(); }} token={token} />;
    if (pagina === 'parcelas')   return <Parcelas onVoltar={() => { setPagina('gastos'); buscarGastos(); }} token={token} />;
    if (pagina === 'relatorios') return <Relatorios onVoltar={() => setPagina('gastos')} token={token} />;
    return renderGastos();
  };

  const renderGastos = () => (
    <div>
      {/* Modal Pagamento */}
      {modalPagamento && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', width: '400px', boxShadow: '0 20px 60px rgba(30,58,95,0.25)', border: '1px solid #dde3ec' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '8px', color: '#1e293b' }}>💰 Registrar Pagamento</h2>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>
              {selecionados.length} registro(s) serão marcados como <strong>Pago</strong>.
            </p>
            <label style={label}>Data do Pagamento *</label>
            <input style={{ ...input, marginBottom: '24px' }} value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} placeholder="DD/MM/AA" autoFocus />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={confirmarPagamento} disabled={confirmandoPagamento || !dataPagamento} style={{ flex: 1, background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
                {confirmandoPagamento ? 'Confirmando...' : '✓ Confirmar Pagamento'}
              </button>
              <button onClick={() => setModalPagamento(false)} style={{ background: '#f1f4f8', color: '#475569', border: '1px solid #dde3ec', borderRadius: '8px', padding: '12px 16px', cursor: 'pointer', fontSize: '14px' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Banner alertas */}
      {!bannerFechado && alertas.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: '0 0 8px', fontWeight: '600', color: '#92400e', fontSize: '14px' }}>
                ⚠️ {alertas.length} gasto(s) precisam de atenção
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {vencidos.length > 0 && <span style={badge('#dc2626', '#fff')}>🔴 {vencidos.length} vencido(s)</span>}
                {vencem_hoje.length > 0 && <span style={badge('#d97706', '#fff')}>🟡 {vencem_hoje.length} hoje</span>}
                {proximos.length > 0 && <span style={badge('#ea580c', '#fff')}>🟠 {proximos.length} em até {diasAlerta}d</span>}
              </div>
            </div>
            <button onClick={() => setBannerFechado(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', fontSize: '18px' }}>✕</button>
          </div>
        </div>
      )}

      {/* Cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
        {[
          { label: 'Total do período',  valor: `R$ ${total.toFixed(2).replace('.', ',')}`, sub: `${gastosFiltrados.length} lançamentos`, cor: '#1d4ed8', icone: '💰' },
          { label: 'Vencidos',          valor: vencidos.length,    sub: 'precisam de atenção', cor: '#dc2626', icone: '🔴' },
          { label: 'Vencem hoje',       valor: vencem_hoje.length, sub: 'pague hoje',           cor: '#d97706', icone: '🟡' },
          { label: 'Próx. vencimentos', valor: proximos.length,    sub: `nos próx. ${diasAlerta} dias`, cor: '#ea580c', icone: '🟠' },
        ].map((c) => (
          <div key={c.label} style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(30,58,95,0.08)', border: '1px solid #dde3ec', borderTopColor: c.cor, borderTopWidth: '3px' }}>
            <p style={{ margin: '0 0 6px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '600' }}>{c.icone} {c.label}</p>
            <p style={{ margin: '0 0 4px', fontSize: '26px', fontWeight: '700', color: c.cor }}>{c.valor}</p>
            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Barra de ações */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(30,58,95,0.08)', border: '1px solid #dde3ec', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={mostrarForm ? () => { setForm(campoVazio); setEditandoId(null); setMostrarForm(false); } : handleNovoGasto} style={{ background: mostrarForm ? '#dc2626' : '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
            {mostrarForm ? '✕ Cancelar' : '+ Novo Gasto'}
          </button>
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button onClick={() => setMenuAcoesAberto(!menuAcoesAberto)} disabled={selecionados.length === 0} style={{ background: selecionados.length > 0 ? '#1e3a5f' : '#f1f4f8', color: selecionados.length > 0 ? '#fff' : '#94a3b8', border: `1px solid ${selecionados.length > 0 ? '#1e3a5f' : '#dde3ec'}`, borderRadius: '8px', padding: '8px 16px', cursor: selecionados.length > 0 ? 'pointer' : 'default', fontSize: '14px', fontWeight: '500' }}>
              Ações {selecionados.length > 0 && `(${selecionados.length})`} ▾
            </button>
            {menuAcoesAberto && (
              <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 100, background: '#fff', border: '1px solid #dde3ec', borderRadius: '10px', boxShadow: '0 8px 24px rgba(30,58,95,0.12)', minWidth: '210px', overflow: 'hidden' }}>
                <button onClick={() => selecionados.length === 1 && handleEditar(gastos.find((g) => g.id === selecionados[0]))} disabled={selecionados.length !== 1} style={itemMenu(selecionados.length === 1)}>
                  ✏️ Editar {selecionados.length !== 1 && <span style={{ fontSize: '11px', color: '#94a3b8' }}>(selecione 1)</span>}
                </button>
                <div style={{ borderTop: '1px solid #f1f4f8' }} />
                <button onClick={abrirModalPagamento} style={itemMenu(true)}>💰 Registrar Pagamento</button>
                <div style={{ borderTop: '1px solid #f1f4f8' }} />
                <button onClick={handleDeletar} style={{ ...itemMenu(true), color: '#dc2626' }}>🗑 Excluir</button>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
          <input style={{ ...input, maxWidth: '200px', margin: 0 }} placeholder="🔍 Buscar..." value={filtroBusca} onChange={(e) => setFiltroBusca(e.target.value)} />
          <select style={{ ...input, maxWidth: '110px', margin: 0 }} value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)}>
            <option value="">Mês</option>
            {MESES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select style={{ ...input, maxWidth: '120px', margin: 0 }} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            <option value="">Status</option>
            {lkStatus.map((l) => <option key={l.ID} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}
          </select>
          <select style={{ ...input, maxWidth: '150px', margin: 0 }} value={filtroResponsavel} onChange={(e) => setFiltroResponsavel(e.target.value)}>
            <option value="">Responsável</option>
            {lkResponsavel.map((l) => <option key={l.ID} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}
          </select>
          {filtersAtivos && (
            <button onClick={limparFiltros} style={{ background: '#f1f4f8', color: '#475569', border: '1px solid #dde3ec', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap' }}>
              ✕ Limpar
            </button>
          )}
        </div>
      </div>

      {/* Formulário */}
      {mostrarForm && (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(30,58,95,0.08)', border: '1px solid #dde3ec' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '20px', color: '#1e293b', paddingBottom: '12px', borderBottom: '1px solid #f1f4f8' }}>
            {editandoId ? `✏️ Editando gasto #${editandoId}` : '+ Novo Gasto'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div><label style={label}>Descrição *</label><input style={input} name="descricao" value={form.descricao} onChange={handleChange} required /></div>
              <div><label style={label}>Categoria</label><select style={input} name="categoria" value={form.categoria} onChange={handleChange}><option value="">Selecione...</option>{lkCategoria.map((l) => <option key={l.ID} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}</select></div>
              <div><label style={label}>Forma de Pagamento</label><select style={input} name="forma_pgto" value={form.forma_pgto} onChange={handleChange}><option value="">Selecione...</option>{lkFormaPgto.map((l) => <option key={l.ID} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}</select></div>
              <div><label style={label}>Valor Total (R$) *</label><input style={input} name="valor_total" type="number" step="0.01" value={form.valor_total} onChange={handleChange} required /></div>
              <div>
                <label style={label}>Valor Individual (R$)</label>
                <input style={{ ...input, background: '#f8fafc', cursor: 'not-allowed' }} value={form.valor_individual} readOnly tabIndex={-1} />
                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                  {form.tipo === 'C' && form.responsavel ? `Total ÷ ${lkResponsavel.find(l => l.MEANING === form.responsavel)?.TAG || 1}` : form.tipo === 'I' ? 'Igual ao valor total' : 'Preencha tipo e responsável'}
                </span>
              </div>
              <div><label style={label}>Parcela (ex: 02 DE 10)</label><input style={input} name="parcela" value={form.parcela} onChange={handleChange} /></div>
              <div><label style={label}>Responsável</label><select style={input} name="responsavel" value={form.responsavel} onChange={handleChange}><option value="">Selecione...</option>{lkResponsavel.map((l) => <option key={l.ID} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}</select></div>
              <div><label style={label}>Tipo</label><select style={input} name="tipo" value={form.tipo} onChange={handleChange}><option value="">Selecione...</option>{lkTipo.map((l) => <option key={l.ID} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}</select></div>
              <div><label style={label}>Status</label><select style={input} name="status" value={form.status} onChange={handleChange}><option value="">Selecione...</option>{lkStatus.map((l) => <option key={l.ID} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}</select></div>
              <div><label style={label}>Vencimento</label><input style={input} name="data_venc" value={form.data_venc} onChange={handleChange} placeholder="31/03/26" /></div>
              <div><label style={label}>Mês</label><select style={input} name="mes" value={form.mes} onChange={handleChange}><option value="">Selecione...</option>{MESES.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
              <div><label style={label}>Ano</label><input style={input} name="ano" type="number" value={form.ano} onChange={handleChange} /></div>
            </div>
            <div style={{ marginTop: '16px' }}><label style={label}>Observação</label><input style={{ ...input, width: '100%' }} name="obs" value={form.obs} onChange={handleChange} /></div>
            <button type="submit" disabled={salvando} style={{ marginTop: '20px', background: editandoId ? '#d97706' : '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
              {salvando ? 'Salvando...' : editandoId ? 'Atualizar Gasto' : 'Salvar Gasto'}
            </button>
          </form>
        </div>
      )}

      {/* Tabela */}
      <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(30,58,95,0.08)', border: '1px solid #dde3ec', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f4f8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc' }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            {gastosFiltrados.length} registro(s)
            {selecionados.length > 0 && <strong style={{ color: '#1d4ed8', marginLeft: '8px' }}> · {selecionados.length} selecionado(s)</strong>}
          </span>
          <span style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>Total: R$ {total.toFixed(2).replace('.', ',')}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th style={{ ...th, width: '40px' }}><input type="checkbox" checked={todosSelecionados} onChange={toggleSelecionarTodos} style={{ cursor: 'pointer' }} /></th>
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
              {gastosFiltrados.length === 0 ? (
                <tr><td colSpan="9" style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                  {filtersAtivos ? '🔍 Nenhum gasto encontrado.' : '💡 Nenhum gasto cadastrado ainda.'}
                </td></tr>
              ) : gastosFiltrados.map((g) => {
                const tipoVenc = g.status !== 'PAGO' ? classificarVencimento(g.data_venc, diasAlerta) : 'normal';
                const cor = COR_VENCIMENTO[tipoVenc];
                const dias = diasParaVencer(g.data_venc);
                const sel = selecionados.includes(g.id);
                return (
                  <tr key={g.id} onClick={() => toggleSelecionado(g.id)} style={{ borderBottom: '1px solid #f1f4f8', background: sel ? '#eff6ff' : cor.fundo, cursor: 'pointer' }}>
                    <td style={{ ...td, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel} onChange={() => toggleSelecionado(g.id)} style={{ cursor: 'pointer' }} /></td>
                    <td style={{ ...td, color: '#94a3b8', fontSize: '12px' }}>{g.id}</td>
                    <td style={{ ...td, fontWeight: '500', color: '#1e293b' }}>{g.descricao}</td>
                    <td style={{ ...td, color: '#475569' }}>{getLookupLabel(lkCategoria, g.categoria)}</td>
                    <td style={{ ...td, color: '#475569' }}>{getLookupLabel(lkResponsavel, g.responsavel)}</td>
                    <td style={{ ...td, fontSize: '12px', color: '#64748b' }}>{g.parcela || '—'}</td>
                    <td style={{ ...td, color: cor.texto, fontWeight: tipoVenc !== 'normal' ? '600' : 'normal' }}>
                      {g.data_venc || '—'}
                      {g.status !== 'PAGO' && tipoVenc === 'vencido' && <span style={{ marginLeft: '6px', fontSize: '11px', background: '#dc2626', color: '#fff', padding: '2px 7px', borderRadius: '20px' }}>{Math.abs(dias)}d atrás</span>}
                      {g.status !== 'PAGO' && tipoVenc === 'hoje' && <span style={{ marginLeft: '6px', fontSize: '11px', background: '#d97706', color: '#fff', padding: '2px 7px', borderRadius: '20px' }}>hoje</span>}
                      {g.status !== 'PAGO' && tipoVenc === 'proximo' && <span style={{ marginLeft: '6px', fontSize: '11px', background: '#ea580c', color: '#fff', padding: '2px 7px', borderRadius: '20px' }}>{dias}d</span>}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: '600', color: '#1e293b' }}>R$ {g.valor_individual.toFixed(2).replace('.', ',')}</td>
                    <td style={td}>
                      <span style={{ background: g.status === 'PENDENTE' ? '#eff6ff' : '#f0fdf4', color: g.status === 'PENDENTE' ? '#1d4ed8' : '#059669', border: `1px solid ${g.status === 'PENDENTE' ? '#bfdbfe' : '#bbf7d0'}`, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>
                        {getLookupLabel(lkStatus, g.status)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <Layout
      paginaAtual={pagina}
      onNavegar={setPagina}
      alertas={alertas.length}
      nomeUsuario={usuario?.nome}
      onPerfil={() => setVerPerfil(true)}
      onLogout={handleLogout}
    >
      {renderPagina()}
    </Layout>
  );
}

const badge = (bg, color) => ({ background: bg, color, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' });
const itemMenu = (ativo) => ({ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'transparent', cursor: ativo ? 'pointer' : 'not-allowed', fontSize: '14px', color: ativo ? '#1e293b' : '#94a3b8', opacity: ativo ? 1 : 0.6 });
const th = { padding: '11px 16px', fontWeight: '600', fontSize: '12px', color: '#475569', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.04em', background: '#f8fafc' };
const td = { padding: '12px 16px' };
const label = { display: 'block', fontSize: '13px', color: '#475569', marginBottom: '6px', fontWeight: '500' };
const input = { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #dde3ec', fontSize: '14px', boxSizing: 'border-box', color: '#1e293b', background: '#fff', transition: 'border-color 0.15s' };

export default App;