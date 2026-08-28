import React, { useEffect, useMemo, useState } from 'react';
import API_URL from './api';

const comandoSql = (sql) => {
  const limpo = String(sql || '')
    .replace(/^(\s*(--[^\n]*(\n|$)|\/\*[\s\S]*?\*\/))*\s*/, '')
    .trim();
  const match = limpo.match(/^([a-z]+)/i);
  return match ? match[1].toUpperCase() : '';
};

const quoteIdent = (nome) => `"${String(nome || '').replace(/"/g, '""')}"`;

const formatarValor = (valor) => {
  if (valor === null || valor === undefined) return 'NULL';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
};

function SqlIde({ token }) {
  const [tabelas, setTabelas] = useState([]);
  const [buscaTabela, setBuscaTabela] = useState('');
  const [tabelaSelecionada, setTabelaSelecionada] = useState('');
  const [colunas, setColunas] = useState([]);
  const [sql, setSql] = useState('');
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [executando, setExecutando] = useState(false);

  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  const lerJsonSeguro = async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.erro || 'Erro ao processar SQL.');
    return data;
  };

  useEffect(() => {
    setCarregando(true);
    fetch(`${API_URL}/api/admin-sql/tabelas`, { headers })
      .then(lerJsonSeguro)
      .then((dados) => {
        const lista = Array.isArray(dados) ? dados : [];
        const tabelaInicial = lista.includes('gastos') ? 'gastos' : lista[0] || '';
        setTabelas(lista);
        setTabelaSelecionada(tabelaInicial);
        setSql(tabelaInicial ? `SELECT * FROM ${quoteIdent(tabelaInicial)} LIMIT 100;` : '');
      })
      .catch((err) => setErro(err.message))
      .finally(() => setCarregando(false));
  }, [headers]);

  useEffect(() => {
    if (!tabelaSelecionada) {
      setColunas([]);
      return;
    }

    fetch(`${API_URL}/api/admin-sql/tabelas/${encodeURIComponent(tabelaSelecionada)}/colunas`, { headers })
      .then(lerJsonSeguro)
      .then((dados) => setColunas(Array.isArray(dados) ? dados : []))
      .catch(() => setColunas([]));
  }, [headers, tabelaSelecionada]);

  const tabelasFiltradas = tabelas.filter((tabela) =>
    tabela.toLowerCase().includes(buscaTabela.toLowerCase())
  );

  const preencherSelect = (nome = tabelaSelecionada) => {
    if (!nome) return;
    setSql(`SELECT * FROM ${quoteIdent(nome)} LIMIT 100;`);
    setResultado(null);
    setErro('');
  };

  const executarSql = async () => {
    const comando = comandoSql(sql);
    const alteraDados = ['INSERT', 'UPDATE', 'DELETE'].includes(comando);

    if (alteraDados && !window.confirm(`Executar ${comando}? Esta ação altera dados do banco.`)) {
      return;
    }

    setExecutando(true);
    setErro('');
    setResultado(null);

    try {
      const data = await fetch(`${API_URL}/api/admin-sql/executar`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ sql, confirmarEscrita: alteraDados }),
      }).then(lerJsonSeguro);
      setResultado(data);
    } catch (err) {
      setErro(err.message || 'Erro ao executar SQL.');
    } finally {
      setExecutando(false);
    }
  };

  const camposResultado = resultado?.campos?.length
    ? resultado.campos
    : Object.keys(resultado?.rows?.[0] || {});

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '18px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', color: 'var(--app-text)' }}>Manutenção SQL</h1>
          <p style={{ margin: 0, color: 'var(--app-muted)', fontSize: '13px' }}>Acesso administrativo</p>
        </div>
        <button onClick={executarSql} disabled={executando || !sql.trim()} style={{ ...btnPrimario, opacity: executando || !sql.trim() ? 0.6 : 1 }}>
          {executando ? 'Executando...' : 'Executar'}
        </button>
      </div>

      {erro && (
        <div style={{ background: 'var(--app-danger-soft)', border: '1px solid var(--app-danger)', color: 'var(--app-danger-text)', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px', fontSize: '14px', fontWeight: '700' }}>
          {erro}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr)', gap: '16px', alignItems: 'start' }}>
        <aside style={painel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={tituloPainel}>Tabelas</h2>
            <span style={contador}>{tabelas.length}</span>
          </div>
          <input
            style={{ ...input, marginBottom: '12px' }}
            value={buscaTabela}
            onChange={(e) => setBuscaTabela(e.target.value)}
            placeholder="Buscar tabela"
          />
          <div style={{ display: 'grid', gap: '6px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
            {carregando && <p style={textoVazio}>Carregando...</p>}
            {!carregando && tabelasFiltradas.length === 0 && <p style={textoVazio}>Nenhuma tabela encontrada.</p>}
            {tabelasFiltradas.map((tabela) => {
              const ativa = tabela === tabelaSelecionada;
              return (
                <button
                  key={tabela}
                  onClick={() => setTabelaSelecionada(tabela)}
                  onDoubleClick={() => preencherSelect(tabela)}
                  style={{
                    ...botaoTabela,
                    background: ativa ? 'var(--app-accent-soft)' : 'var(--app-surface)',
                    borderColor: ativa ? 'var(--app-accent)' : 'var(--app-border)',
                    color: ativa ? 'var(--app-accent-strong)' : 'var(--app-text)',
                  }}
                >
                  {tabela}
                </button>
              );
            })}
          </div>

          {tabelaSelecionada && (
            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--app-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h2 style={tituloPainel}>Colunas</h2>
                <button onClick={() => preencherSelect()} style={btnSecundario}>SELECT</button>
              </div>
              <div style={{ display: 'grid', gap: '6px', maxHeight: '260px', overflowY: 'auto' }}>
                {colunas.map((coluna) => (
                  <div key={coluna.column_name} style={linhaColuna}>
                    <strong style={{ color: 'var(--app-text)' }}>{coluna.column_name}</strong>
                    <span style={{ color: 'var(--app-muted)' }}>{coluna.data_type}{coluna.is_nullable === 'NO' ? ' · NOT NULL' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        <section style={{ display: 'grid', gap: '16px', minWidth: 0 }}>
          <div style={painel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
              <h2 style={tituloPainel}>Editor</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => preencherSelect()} disabled={!tabelaSelecionada} style={btnSecundario}>SELECT tabela</button>
                <button onClick={() => { setSql(''); setResultado(null); setErro(''); }} style={btnSecundario}>Limpar</button>
              </div>
            </div>
            <textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              spellCheck={false}
              style={editor}
              placeholder="SELECT * FROM gastos LIMIT 100;"
            />
          </div>

          <div style={painel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={tituloPainel}>Resultado</h2>
              {resultado && (
                <span style={contador}>
                  {resultado.comando} · {resultado.rowCount ?? 0} linha(s) · {resultado.tempoMs} ms
                </span>
              )}
            </div>

            {!resultado && <p style={textoVazio}>Sem execução nesta sessão.</p>}

            {resultado && camposResultado.length === 0 && (
              <div style={{ background: 'var(--app-success-soft)', border: '1px solid var(--app-success)', color: 'var(--app-success-text)', borderRadius: '8px', padding: '14px', fontSize: '14px', fontWeight: '700' }}>
                Comando executado. Linhas afetadas: {resultado.rowCount ?? 0}.
              </div>
            )}

            {resultado && camposResultado.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                {resultado.truncado && (
                  <p style={{ margin: '0 0 10px', color: 'var(--app-warning-text)', fontSize: '13px', fontWeight: '700' }}>
                    Mostrando as primeiras {resultado.rows.length} de {resultado.totalRows} linha(s).
                  </p>
                )}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      {camposResultado.map((campo) => <th key={campo} style={th}>{campo}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.rows.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--app-border)' }}>
                        {camposResultado.map((campo) => (
                          <td key={campo} style={td}>{formatarValor(row[campo])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

const painel = { background: 'var(--app-surface)', border: '1px solid var(--app-border)', borderRadius: '8px', padding: '16px', boxShadow: 'var(--app-shadow)' };
const tituloPainel = { margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--app-text)' };
const contador = { display: 'inline-flex', alignItems: 'center', minHeight: '24px', borderRadius: '999px', background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)', color: 'var(--app-muted)', padding: '0 9px', fontSize: '12px', fontWeight: '700' };
const input = { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--app-border)', fontSize: '14px', boxSizing: 'border-box', color: 'var(--app-text)', background: 'var(--app-input-bg)' };
const botaoTabela = { width: '100%', border: '1px solid var(--app-border)', borderRadius: '8px', padding: '9px 10px', cursor: 'pointer', fontSize: '13px', textAlign: 'left', fontWeight: '700' };
const linhaColuna = { display: 'grid', gap: '2px', border: '1px solid var(--app-border)', borderRadius: '8px', padding: '8px 10px', fontSize: '12px', background: 'var(--app-surface-soft)' };
const btnPrimario = { background: 'var(--app-accent)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', cursor: 'pointer', fontSize: '14px', fontWeight: '800' };
const btnSecundario = { background: 'var(--app-surface-soft)', color: 'var(--app-text)', border: '1px solid var(--app-border)', borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '800' };
const editor = { width: '100%', minHeight: '180px', resize: 'vertical', borderRadius: '8px', border: '1px solid var(--app-border-soft)', background: '#0F172A', color: '#E2E8F0', padding: '14px', boxSizing: 'border-box', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: '13px', lineHeight: 1.55 };
const th = { padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--app-border)', background: 'var(--app-surface-soft)', color: 'var(--app-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: 0 };
const td = { padding: '10px 12px', color: 'var(--app-text)', maxWidth: '360px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const textoVazio = { margin: 0, color: 'var(--app-muted)', fontSize: '13px' };

export default SqlIde;
