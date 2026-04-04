import React, { useState, useEffect } from 'react';
import API_URL from './api';

const campoVazio = {
  LOOKUP_TYPE: '', LOOKUP_CODE: '', MEANING: '', DESCRIPTION: '',
  TAG: '', ENABLED_FLAG: 'S', ATTRIBUTE1: '', ATTRIBUTE2: '', ATTRIBUTE3: '',
};

function Lookups({ onVoltar, token }) {
  const [abaSelecionada, setAbaSelecionada] = useState('geral');
  const [lookups, setLookups] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [tipoSelecionado, setTipoSelecionado] = useState('');
  const [filhos, setFilhos] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(campoVazio);
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const buscarTodos = () => {
    fetch(`${API_URL}/api/lookups`, { headers })
      .then((r) => r.json())
      .then((dados) => Array.isArray(dados) && setLookups(dados.filter((l) => l.LOOKUP_TYPE === 'LOOKUP TYPE')));
  };

  const buscarTipos = () => {
    fetch(`${API_URL}/api/lookups/tipos`, { headers })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setTipos(d));
  };

  const buscarFilhos = (tipo) => {
    if (!tipo) return setFilhos([]);
    fetch(`${API_URL}/api/lookups/valores/${tipo}`, { headers })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setFilhos(d));
  };

  useEffect(() => { buscarTodos(); buscarTipos(); }, []);
  useEffect(() => { buscarFilhos(tipoSelecionado); }, [tipoSelecionado]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleNovoGeral = () => {
    setForm({ ...campoVazio, LOOKUP_TYPE: 'LOOKUP TYPE' });
    setEditandoId(null); setErro(''); setMostrarForm(true);
  };

  const handleNovoFilho = () => {
    setForm({ ...campoVazio, LOOKUP_TYPE: tipoSelecionado });
    setEditandoId(null); setErro(''); setMostrarForm(true);
  };

  const handleEditar = (lookup) => {
    setForm({
      LOOKUP_TYPE: lookup.LOOKUP_TYPE || '', LOOKUP_CODE: lookup.LOOKUP_CODE || '',
      MEANING: lookup.MEANING || '', DESCRIPTION: lookup.DESCRIPTION || '',
      TAG: lookup.TAG || '', ENABLED_FLAG: lookup.ENABLED_FLAG || 'S',
      ATTRIBUTE1: lookup.ATTRIBUTE1 || '', ATTRIBUTE2: lookup.ATTRIBUTE2 || '',
      ATTRIBUTE3: lookup.ATTRIBUTE3 || '',
    });
    setEditandoId(lookup.ID); setErro(''); setMostrarForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletar = (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este lookup?')) return;
    fetch(`${API_URL}/api/lookups/${id}`, { method: 'DELETE', headers })
      .then((r) => r.json())
      .then((data) => {
        if (data.erro) { alert(data.erro); return; }
        buscarTodos(); buscarTipos(); buscarFilhos(tipoSelecionado);
      });
  };

  const handleSubmit = (e) => {
    e.preventDefault(); setSalvando(true); setErro('');
    const url = editandoId ? `${API_URL}/api/lookups/${editandoId}` : `${API_URL}/api/lookups`;
    const method = editandoId ? 'PUT' : 'POST';
    fetch(url, { method, headers, body: JSON.stringify(form) })
      .then((r) => r.json())
      .then((data) => {
        if (data.erro) { setErro(data.erro); setSalvando(false); return; }
        setForm(campoVazio); setMostrarForm(false); setEditandoId(null); setSalvando(false);
        buscarTodos(); buscarTipos(); buscarFilhos(tipoSelecionado);
      })
      .catch(() => setSalvando(false));
  };

  const handleCancelar = () => { setForm(campoVazio); setEditandoId(null); setMostrarForm(false); setErro(''); };
  const dadosTabela = abaSelecionada === 'geral' ? lookups : filhos;

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '32px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', margin: 0 }}>Cadastro de Parâmetros</h1>
        <button onClick={onVoltar} style={btnSecundario}>← Voltar</button>
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '2px solid #dee2e6' }}>
        <button onClick={() => { setAbaSelecionada('geral'); setMostrarForm(false); }} style={abaSelecionada === 'geral' ? abaAtiva : abaInativa}>Geral (Tipos)</button>
        <button onClick={() => { setAbaSelecionada('lookups'); setMostrarForm(false); }} style={abaSelecionada === 'lookups' ? abaAtiva : abaInativa}>Lookups (Valores)</button>
      </div>

      {abaSelecionada === 'geral' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>Cadastre os <strong>tipos</strong> de lookup.</p>
            <button onClick={handleNovoGeral} style={btnPrimario}>+ Novo Tipo</button>
          </div>
          {mostrarForm && abaSelecionada === 'geral' && (
            <Formulario form={form} editandoId={editandoId} salvando={salvando} erro={erro}
              onChange={handleChange} onSubmit={handleSubmit} onCancelar={handleCancelar} abaAtual="geral" tipos={tipos} />
          )}
          <Tabela dados={dadosTabela} onEditar={handleEditar} onDeletar={handleDeletar} />
        </>
      )}

      {abaSelecionada === 'lookups' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '14px', color: '#555' }}>Tipo:</label>
              <select style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ced4da', fontSize: '14px', minWidth: '220px' }}
                value={tipoSelecionado} onChange={(e) => { setTipoSelecionado(e.target.value); setMostrarForm(false); }}>
                <option value="">Selecione um tipo...</option>
                {tipos.map((t) => <option key={t.ID} value={t.LOOKUP_CODE}>{t.LOOKUP_CODE} — {t.MEANING}</option>)}
              </select>
            </div>
            <button onClick={handleNovoFilho} disabled={!tipoSelecionado}
              style={tipoSelecionado ? btnPrimario : { ...btnPrimario, background: '#adb5bd', cursor: 'default' }}>
              + Novo Valor
            </button>
          </div>
          {!tipoSelecionado && <p style={{ color: '#999', fontSize: '14px' }}>Selecione um tipo para ver e cadastrar seus valores.</p>}
          {mostrarForm && abaSelecionada === 'lookups' && (
            <Formulario form={form} editandoId={editandoId} salvando={salvando} erro={erro}
              onChange={handleChange} onSubmit={handleSubmit} onCancelar={handleCancelar} abaAtual="lookups" tipos={tipos} />
          )}
          {tipoSelecionado && <Tabela dados={filhos} onEditar={handleEditar} onDeletar={handleDeletar} />}
        </>
      )}
    </div>
  );
}

function Formulario({ form, editandoId, salvando, erro, onChange, onSubmit, onCancelar, abaAtual }) {
  return (
    <form onSubmit={onSubmit} style={{ background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '8px', padding: '24px', marginBottom: '24px' }}>
      <h2 style={{ fontSize: '18px', marginTop: 0, marginBottom: '20px' }}>
        {editandoId ? `Editando #${editandoId}` : abaAtual === 'geral' ? 'Novo Tipo' : 'Novo Valor'}
      </h2>
      {erro && <div style={{ background: '#f8d7da', border: '1px solid #f5c2c7', borderRadius: '6px', padding: '12px', marginBottom: '16px', color: '#842029', fontSize: '14px' }}>{erro}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        <div><label style={label}>LOOKUP_TYPE *</label><input style={input} name="LOOKUP_TYPE" value={form.LOOKUP_TYPE} onChange={onChange} readOnly={true} required /></div>
        <div><label style={label}>LOOKUP_CODE *</label><input style={input} name="LOOKUP_CODE" value={form.LOOKUP_CODE} onChange={onChange} required /></div>
        <div><label style={label}>MEANING *</label><input style={input} name="MEANING" value={form.MEANING} onChange={onChange} required /></div>
        <div style={{ gridColumn: 'span 3' }}><label style={label}>DESCRIPTION</label><input style={input} name="DESCRIPTION" value={form.DESCRIPTION} onChange={onChange} /></div>
        <div><label style={label}>TAG</label><input style={input} name="TAG" value={form.TAG} onChange={onChange} /></div>
        <div><label style={label}>ENABLED_FLAG</label>
          <select style={input} name="ENABLED_FLAG" value={form.ENABLED_FLAG} onChange={onChange}>
            <option value="S">S — Ativo</option><option value="N">N — Inativo</option>
          </select>
        </div>
        <div><label style={label}>ATTRIBUTE1</label><input style={input} name="ATTRIBUTE1" value={form.ATTRIBUTE1} onChange={onChange} /></div>
        <div><label style={label}>ATTRIBUTE2</label><input style={input} name="ATTRIBUTE2" value={form.ATTRIBUTE2} onChange={onChange} /></div>
        <div><label style={label}>ATTRIBUTE3</label><input style={input} name="ATTRIBUTE3" value={form.ATTRIBUTE3} onChange={onChange} /></div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
        <button type="submit" disabled={salvando} style={{ background: editandoId ? '#fd7e14' : '#198754', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px 24px', cursor: 'pointer', fontSize: '14px' }}>
          {salvando ? 'Salvando...' : editandoId ? 'Atualizar' : 'Salvar'}
        </button>
        <button type="button" onClick={onCancelar} style={btnSecundario}>Cancelar</button>
      </div>
    </form>
  );
}

function Tabela({ dados, onEditar, onDeletar }) {
  if (!dados || dados.length === 0) return <p style={{ color: '#999', fontSize: '14px' }}>Nenhum registro encontrado.</p>;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
      <thead>
        <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
          <th style={th}>ID</th><th style={th}>LOOKUP_TYPE</th><th style={th}>LOOKUP_CODE</th>
          <th style={th}>MEANING</th><th style={th}>DESCRIPTION</th><th style={th}>ENABLED</th><th style={th}>Ações</th>
        </tr>
      </thead>
      <tbody>
        {dados.map((l) => (
          <tr key={l.ID} style={{ borderBottom: '1px solid #eee' }}>
            <td style={td}>{l.ID}</td><td style={td}>{l.LOOKUP_TYPE}</td><td style={td}>{l.LOOKUP_CODE}</td>
            <td style={td}>{l.MEANING}</td><td style={td}>{l.DESCRIPTION || '—'}</td>
            <td style={td}>
              <span style={{ background: l.ENABLED_FLAG === 'S' ? '#d4edda' : '#f8d7da', color: l.ENABLED_FLAG === 'S' ? '#155724' : '#842029', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                {l.ENABLED_FLAG === 'S' ? 'Ativo' : 'Inativo'}
              </span>
            </td>
            <td style={td}>
              <button onClick={() => onEditar(l)} style={btnEditar}>Editar</button>
              <button onClick={() => onDeletar(l.ID)} style={btnDeletar}>Excluir</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const th = { padding: '10px 12px', fontWeight: '600', borderBottom: '2px solid #ddd' };
const td = { padding: '10px 12px' };
const label = { display: 'block', fontSize: '13px', color: '#555', marginBottom: '4px' };
const input = { width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ced4da', fontSize: '14px', boxSizing: 'border-box' };
const btnPrimario = { background: '#0d6efd', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontSize: '14px' };
const btnSecundario = { background: '#6c757d', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontSize: '14px' };
const btnEditar = { background: '#fd7e14', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', marginRight: '6px' };
const btnDeletar = { background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px' };
const abaAtiva = { padding: '8px 20px', border: 'none', borderBottom: '2px solid #0d6efd', background: 'transparent', color: '#0d6efd', cursor: 'pointer', fontSize: '14px', fontWeight: '600', marginBottom: '-2px' };
const abaInativa = { padding: '8px 20px', border: 'none', borderBottom: '2px solid transparent', background: 'transparent', color: '#666', cursor: 'pointer', fontSize: '14px', marginBottom: '-2px' };

export default Lookups;