import React, { useCallback, useEffect, useMemo, useState } from 'react';
import API_URL from './api';
import { lookupKey, normalizarLookups } from './utils/lookups';

const campoVazio = {
  LOOKUP_TYPE: '',
  LOOKUP_CODE: '',
  MEANING: '',
  DESCRIPTION: '',
  TAG: '',
  ENABLED_FLAG: 'S',
  ATTRIBUTE1: '',
  ATTRIBUTE2: '',
  ATTRIBUTE3: '',
};

const lerJson = async (res) => {
  const texto = await res.text();
  let data = {};

  try {
    data = texto ? JSON.parse(texto) : {};
  } catch {
    throw new Error('A API não retornou JSON válido.');
  }

  if (!res.ok) {
    throw new Error(data.erro || 'Erro ao processar a solicitação.');
  }

  return data;
};

const limparPayload = (form) =>
  Object.fromEntries(
    Object.entries(form).map(([campo, valor]) => [
      campo,
      typeof valor === 'string' ? valor.trim() : valor,
    ])
  );

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
  const [erroCarregamento, setErroCarregamento] = useState('');

  const headers = useMemo(
    () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    [token]
  );

  const buscarTodos = useCallback(async () => {
    try {
      const dados = await fetch(`${API_URL}/api/lookups`, { headers }).then(lerJson);
      const normalizados = normalizarLookups(dados);
      setLookups(normalizados.filter((l) => l.LOOKUP_TYPE === 'LOOKUP TYPE'));
      setErroCarregamento('');
    } catch (err) {
      setLookups([]);
      setErroCarregamento(err.message || 'Erro ao carregar os tipos.');
    }
  }, [headers]);

  const buscarTipos = useCallback(async () => {
    try {
      const dados = await fetch(`${API_URL}/api/lookups/tipos`, { headers }).then(lerJson);
      setTipos(normalizarLookups(dados));
      setErroCarregamento('');
    } catch (err) {
      setTipos([]);
      setErroCarregamento(err.message || 'Erro ao carregar os tipos.');
    }
  }, [headers]);

  const buscarFilhos = useCallback(async (tipo) => {
    if (!tipo) {
      setFilhos([]);
      return;
    }

    try {
      const dados = await fetch(`${API_URL}/api/lookups/valores/${encodeURIComponent(tipo)}`, { headers }).then(lerJson);
      setFilhos(normalizarLookups(dados));
      setErroCarregamento('');
    } catch (err) {
      setFilhos([]);
      setErroCarregamento(err.message || 'Erro ao carregar os valores.');
    }
  }, [headers]);

  useEffect(() => {
    buscarTodos();
    buscarTipos();
  }, [buscarTodos, buscarTipos]);

  useEffect(() => {
    buscarFilhos(tipoSelecionado);
  }, [buscarFilhos, tipoSelecionado]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleNovoGeral = () => {
    setForm({ ...campoVazio, LOOKUP_TYPE: 'LOOKUP TYPE' });
    setEditandoId(null);
    setErro('');
    setMostrarForm(true);
  };

  const handleNovoFilho = () => {
    if (!tipoSelecionado) return;
    setForm({ ...campoVazio, LOOKUP_TYPE: tipoSelecionado });
    setEditandoId(null);
    setErro('');
    setMostrarForm(true);
  };

  const handleEditar = (lookup) => {
    setForm({
      LOOKUP_TYPE: lookup.LOOKUP_TYPE || '',
      LOOKUP_CODE: lookup.LOOKUP_CODE || '',
      MEANING: lookup.MEANING || '',
      DESCRIPTION: lookup.DESCRIPTION || '',
      TAG: lookup.TAG || '',
      ENABLED_FLAG: lookup.ENABLED_FLAG || 'S',
      ATTRIBUTE1: lookup.ATTRIBUTE1 || '',
      ATTRIBUTE2: lookup.ATTRIBUTE2 || '',
      ATTRIBUTE3: lookup.ATTRIBUTE3 || '',
    });
    setEditandoId(lookup.ID);
    setErro('');
    setMostrarForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const recarregarDados = async () => {
    await Promise.all([buscarTodos(), buscarTipos()]);
    await buscarFilhos(tipoSelecionado);
  };

  const handleDeletar = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este lookup?')) return;

    try {
      await fetch(`${API_URL}/api/lookups/${id}`, { method: 'DELETE', headers }).then(lerJson);
      await recarregarDados();
    } catch (err) {
      alert(err.message || 'Erro ao excluir lookup.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = limparPayload(form);

    if (!payload.LOOKUP_TYPE || !payload.LOOKUP_CODE || !payload.MEANING) {
      setErro('Preencha LOOKUP_TYPE, LOOKUP_CODE e MEANING.');
      return;
    }

    setSalvando(true);
    setErro('');

    const url = editandoId
      ? `${API_URL}/api/lookups/${editandoId}`
      : `${API_URL}/api/lookups`;

    try {
      await fetch(url, {
        method: editandoId ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(payload),
      }).then(lerJson);

      setForm(campoVazio);
      setMostrarForm(false);
      setEditandoId(null);
      await recarregarDados();
    } catch (err) {
      setErro(err.message || 'Erro ao salvar lookup.');
    } finally {
      setSalvando(false);
    }
  };

  const handleCancelar = () => {
    setForm(campoVazio);
    setEditandoId(null);
    setMostrarForm(false);
    setErro('');
  };

  const dadosTabela = abaSelecionada === 'geral' ? lookups : filhos;

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '32px', maxWidth: '1100px', margin: '0 auto', color: 'var(--app-text)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', margin: 0, color: 'var(--app-text)' }}>Cadastro de Parâmetros</h1>
        <button onClick={onVoltar} style={btnSecundario}>← Voltar</button>
      </div>

      {erroCarregamento && (
        <div style={{ background: 'var(--app-warning-soft)', border: '1px solid var(--app-warning)', borderRadius: '6px', padding: '12px', marginBottom: '16px', color: 'var(--app-warning-text)', fontSize: '14px', fontWeight: '700' }}>
          {erroCarregamento}
        </div>
      )}

      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '2px solid var(--app-border)', flexWrap: 'wrap' }}>
        <button onClick={() => { setAbaSelecionada('geral'); setMostrarForm(false); }} style={abaSelecionada === 'geral' ? abaAtiva : abaInativa}>Geral (Tipos)</button>
        <button onClick={() => { setAbaSelecionada('lookups'); setMostrarForm(false); }} style={abaSelecionada === 'lookups' ? abaAtiva : abaInativa}>Lookups (Valores)</button>
      </div>

      {abaSelecionada === 'geral' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <p style={{ margin: 0, color: 'var(--app-muted)', fontSize: '14px' }}>Cadastre os <strong>tipos</strong> de lookup.</p>
            <button onClick={handleNovoGeral} style={btnPrimario}>+ Novo Tipo</button>
          </div>
          {mostrarForm && (
            <Formulario form={form} editandoId={editandoId} salvando={salvando} erro={erro}
              onChange={handleChange} onSubmit={handleSubmit} onCancelar={handleCancelar} abaAtual="geral" />
          )}
          <Tabela dados={dadosTabela} onEditar={handleEditar} onDeletar={handleDeletar} />
        </>
      )}

      {abaSelecionada === 'lookups' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '14px', color: 'var(--app-muted)', fontWeight: '700' }}>Tipo:</label>
              <select style={{ ...input, minWidth: '220px' }}
                value={tipoSelecionado} onChange={(e) => { setTipoSelecionado(e.target.value); setMostrarForm(false); }}>
                <option value="">Selecione um tipo...</option>
                {tipos.map((t) => <option key={lookupKey(t)} value={t.LOOKUP_CODE}>{t.LOOKUP_CODE} — {t.MEANING}</option>)}
              </select>
            </div>
            <button onClick={handleNovoFilho} disabled={!tipoSelecionado}
              style={tipoSelecionado ? btnPrimario : { ...btnPrimario, background: 'var(--app-border)', color: 'var(--app-muted)', cursor: 'default' }}>
              + Novo Valor
            </button>
          </div>
          {!tipoSelecionado && <p style={{ color: 'var(--app-muted)', fontSize: '14px' }}>Selecione um tipo para ver e cadastrar seus valores.</p>}
          {mostrarForm && (
            <Formulario form={form} editandoId={editandoId} salvando={salvando} erro={erro}
              onChange={handleChange} onSubmit={handleSubmit} onCancelar={handleCancelar} abaAtual="lookups" />
          )}
          {tipoSelecionado && <Tabela dados={filhos} onEditar={handleEditar} onDeletar={handleDeletar} />}
        </>
      )}
    </div>
  );
}

function Formulario({ form, editandoId, salvando, erro, onChange, onSubmit, onCancelar, abaAtual }) {
  return (
    <form onSubmit={onSubmit} style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', borderRadius: '8px', padding: '24px', marginBottom: '24px', boxShadow: 'var(--app-shadow)' }}>
      <h2 style={{ fontSize: '18px', marginTop: 0, marginBottom: '20px', color: 'var(--app-text)' }}>
        {editandoId ? `Editando #${editandoId}` : abaAtual === 'geral' ? 'Novo Tipo' : 'Novo Valor'}
      </h2>
      {erro && <div style={{ background: 'var(--app-danger-soft)', border: '1px solid var(--app-danger)', borderRadius: '6px', padding: '12px', marginBottom: '16px', color: 'var(--app-danger-text)', fontSize: '14px', fontWeight: '700' }}>{erro}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
        <div><label style={label}>LOOKUP_TYPE *</label><input style={input} name="LOOKUP_TYPE" value={form.LOOKUP_TYPE} onChange={onChange} readOnly required /></div>
        <div><label style={label}>LOOKUP_CODE *</label><input style={input} name="LOOKUP_CODE" value={form.LOOKUP_CODE} onChange={onChange} required /></div>
        <div><label style={label}>MEANING *</label><input style={input} name="MEANING" value={form.MEANING} onChange={onChange} required /></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={label}>DESCRIPTION</label><input style={input} name="DESCRIPTION" value={form.DESCRIPTION} onChange={onChange} /></div>
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
      <div style={{ display: 'flex', gap: '8px', marginTop: '20px', flexWrap: 'wrap' }}>
        <button type="submit" disabled={salvando} style={{ background: editandoId ? 'var(--app-warning)' : 'var(--app-success)', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px 24px', cursor: salvando ? 'default' : 'pointer', fontSize: '14px', fontWeight: '700' }}>
          {salvando ? 'Salvando...' : editandoId ? 'Atualizar' : 'Salvar'}
        </button>
        <button type="button" onClick={onCancelar} style={btnSecundario}>Cancelar</button>
      </div>
    </form>
  );
}

function Tabela({ dados, onEditar, onDeletar }) {
  if (!dados || dados.length === 0) return <p style={{ color: 'var(--app-muted)', fontSize: '14px' }}>Nenhum registro encontrado.</p>;
  return (
    <div style={tabelaContainer}>
      <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          <tr style={{ background: 'var(--app-surface-soft)', textAlign: 'left' }}>
            <th style={th}>ID</th><th style={th}>LOOKUP_TYPE</th><th style={th}>LOOKUP_CODE</th>
            <th style={th}>MEANING</th><th style={th}>TAG</th><th style={th}>DESCRIPTION</th><th style={th}>ENABLED</th><th style={th}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {dados.map((l) => (
            <tr key={lookupKey(l)} style={{ borderBottom: '1px solid var(--app-border)' }}>
              <td style={td}>{l.ID}</td><td style={td}>{l.LOOKUP_TYPE}</td><td style={td}>{l.LOOKUP_CODE}</td>
              <td style={td}>{l.MEANING}</td><td style={td}>{l.TAG || '—'}</td><td style={td}>{l.DESCRIPTION || '—'}</td>
              <td style={td}>
                <span style={{ background: l.ENABLED_FLAG === 'S' ? 'var(--app-success-soft)' : 'var(--app-danger-soft)', color: l.ENABLED_FLAG === 'S' ? 'var(--app-success-text)' : 'var(--app-danger-text)', border: `1px solid ${l.ENABLED_FLAG === 'S' ? 'var(--app-success)' : 'var(--app-danger)'}`, padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '800' }}>
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
    </div>
  );
}

const tabelaContainer = { overflowX: 'auto', border: '1px solid var(--app-border)', borderRadius: '8px', background: 'var(--app-surface)' };
const th = { padding: '10px 12px', fontWeight: '800', borderBottom: '1px solid var(--app-border)', color: 'var(--app-muted)' };
const td = { padding: '10px 12px', color: 'var(--app-text)', verticalAlign: 'middle' };
const label = { display: 'block', fontSize: '13px', color: 'var(--app-muted)', marginBottom: '4px', fontWeight: '700' };
const input = { width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--app-border)', fontSize: '14px', boxSizing: 'border-box', background: 'var(--app-input-bg)', color: 'var(--app-text)' };
const btnPrimario = { background: 'var(--app-accent)', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontSize: '14px', fontWeight: '700' };
const btnSecundario = { background: 'var(--app-surface-soft)', color: 'var(--app-text)', border: '1px solid var(--app-border)', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontSize: '14px', fontWeight: '700' };
const btnEditar = { background: 'var(--app-warning)', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', marginRight: '6px', fontWeight: '700' };
const btnDeletar = { background: 'var(--app-danger)', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' };
const abaAtiva = { padding: '8px 20px', border: 'none', borderBottom: '2px solid var(--app-accent)', background: 'transparent', color: 'var(--app-accent-strong)', cursor: 'pointer', fontSize: '14px', fontWeight: '800', marginBottom: '-2px' };
const abaInativa = { padding: '8px 20px', border: 'none', borderBottom: '2px solid transparent', background: 'transparent', color: 'var(--app-muted)', cursor: 'pointer', fontSize: '14px', marginBottom: '-2px', fontWeight: '700' };

export default Lookups;
