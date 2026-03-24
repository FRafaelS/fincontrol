import React, { useState, useEffect } from 'react';

function Perfil({ usuario, token, onVoltar, onAtualizar }) {
  const [abaSelecionada, setAbaSelecionada] = useState('perfil');
  const [form, setForm] = useState({ nome: usuario.nome, email: usuario.email });
  const [senhaForm, setSenhaForm] = useState({ senhaAtual: '', novaSenha: '', confirmarSenha: '' });
  const [usuarios, setUsuarios] = useState([]);
  const [novoUsuario, setNovoUsuario] = useState({ nome: '', email: '', senha: '', perfil: 'USER' });
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const buscarUsuarios = () => {
    fetch(`${API_URL}/api/auth/usuarios', { headers })
      .then((r) => r.json())
      .then(setUsuarios)
      .catch(() => {});
  };

  useEffect(() => {
    if (usuario.perfil === 'ADMIN') buscarUsuarios();
  }, []);

  const mostrarMensagem = (msg, isErro = false) => {
    if (isErro) setErro(msg);
    else setMensagem(msg);
    setTimeout(() => { setMensagem(''); setErro(''); }, 3000);
  };

  const salvarPerfil = async (e) => {
    e.preventDefault();
    setSalvando(true);
    const res = await fetch(`${API_URL}/api/auth/perfil', {
      method: 'PUT', headers,
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { mostrarMensagem(data.erro, true); }
    else {
      mostrarMensagem('Perfil atualizado com sucesso!');
      onAtualizar({ ...usuario, nome: form.nome, email: form.email });
    }
    setSalvando(false);
  };

  const trocarSenha = async (e) => {
    e.preventDefault();
    if (senhaForm.novaSenha !== senhaForm.confirmarSenha) {
      mostrarMensagem('As senhas não conferem.', true); return;
    }
    if (senhaForm.novaSenha.length < 6) {
      mostrarMensagem('A nova senha deve ter ao menos 6 caracteres.', true); return;
    }
    setSalvando(true);
    const res = await fetch(`${API_URL}/api/auth/trocar-senha', {
      method: 'PUT', headers,
      body: JSON.stringify({ senhaAtual: senhaForm.senhaAtual, novaSenha: senhaForm.novaSenha }),
    });
    const data = await res.json();
    if (!res.ok) mostrarMensagem(data.erro, true);
    else { mostrarMensagem('Senha alterada com sucesso!'); setSenhaForm({ senhaAtual: '', novaSenha: '', confirmarSenha: '' }); }
    setSalvando(false);
  };

  const cadastrarUsuario = async (e) => {
    e.preventDefault();
    setSalvando(true);
    const res = await fetch(`${API_URL}/api/auth/usuarios', {
      method: 'POST', headers,
      body: JSON.stringify(novoUsuario),
    });
    const data = await res.json();
    if (!res.ok) mostrarMensagem(data.erro, true);
    else {
      mostrarMensagem('Usuário cadastrado com sucesso!');
      setNovoUsuario({ nome: '', email: '', senha: '', perfil: 'USER' });
      buscarUsuarios();
    }
    setSalvando(false);
  };

  const toggleStatus = async (id, ativo) => {
    await fetch(`${API_URL}/api/auth/usuarios/${id}/status', {
      method: 'PUT', headers,
      body: JSON.stringify({ ativo: !ativo }),
    });
    buscarUsuarios();
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '32px', maxWidth: '800px', margin: '0 auto' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', margin: 0, color: '#1e293b' }}>Minha Conta</h1>
        <button onClick={onVoltar} style={btnSecundario}>← Voltar</button>
      </div>

      {/* Mensagens */}
      {mensagem && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#059669', fontSize: '14px' }}>
          ✓ {mensagem}
        </div>
      )}
      {erro && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#dc2626', fontSize: '14px' }}>
          ⚠️ {erro}
        </div>
      )}

      {/* Abas */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '2px solid #e2e8f0' }}>
        {[
          { id: 'perfil', label: '👤 Perfil' },
          { id: 'senha',  label: '🔒 Senha' },
          ...(usuario.perfil === 'ADMIN' ? [{ id: 'usuarios', label: '👥 Usuários' }] : []),
        ].map((aba) => (
          <button
            key={aba.id}
            onClick={() => setAbaSelecionada(aba.id)}
            style={{
              padding: '8px 20px', border: 'none', background: 'transparent',
              borderBottom: abaSelecionada === aba.id ? '2px solid #1d4ed8' : '2px solid transparent',
              color: abaSelecionada === aba.id ? '#1d4ed8' : '#64748b',
              cursor: 'pointer', fontSize: '14px',
              fontWeight: abaSelecionada === aba.id ? '600' : '400',
              marginBottom: '-2px',
            }}
          >
            {aba.label}
          </button>
        ))}
      </div>

      {/* Aba Perfil */}
      {abaSelecionada === 'perfil' && (
        <div style={card}>
          <h2 style={tituloCard}>Dados Pessoais</h2>
          <form onSubmit={salvarPerfil}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={label}>Nome *</label>
                <input style={input} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
              </div>
              <div>
                <label style={label}>Email *</label>
                <input style={input} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <label style={label}>Perfil</label>
                <input style={{ ...input, background: '#f8fafc', cursor: 'not-allowed' }} value={usuario.perfil} readOnly />
              </div>
            </div>
            <button type="submit" disabled={salvando} style={btnPrimario}>
              {salvando ? 'Salvando...' : 'Salvar Perfil'}
            </button>
          </form>
        </div>
      )}

      {/* Aba Senha */}
      {abaSelecionada === 'senha' && (
        <div style={card}>
          <h2 style={tituloCard}>Trocar Senha</h2>
          <form onSubmit={trocarSenha}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px', marginBottom: '20px' }}>
              <div>
                <label style={label}>Senha Atual *</label>
                <input style={input} type="password" value={senhaForm.senhaAtual} onChange={(e) => setSenhaForm({ ...senhaForm, senhaAtual: e.target.value })} required />
              </div>
              <div>
                <label style={label}>Nova Senha * (mín. 6 caracteres)</label>
                <input style={input} type="password" value={senhaForm.novaSenha} onChange={(e) => setSenhaForm({ ...senhaForm, novaSenha: e.target.value })} required />
              </div>
              <div>
                <label style={label}>Confirmar Nova Senha *</label>
                <input style={input} type="password" value={senhaForm.confirmarSenha} onChange={(e) => setSenhaForm({ ...senhaForm, confirmarSenha: e.target.value })} required />
              </div>
            </div>
            <button type="submit" disabled={salvando} style={btnPrimario}>
              {salvando ? 'Salvando...' : '🔒 Trocar Senha'}
            </button>
          </form>
        </div>
      )}

      {/* Aba Usuários (apenas admin) */}
      {abaSelecionada === 'usuarios' && usuario.perfil === 'ADMIN' && (
        <div>
          {/* Cadastrar novo usuário */}
          <div style={{ ...card, marginBottom: '24px' }}>
            <h2 style={tituloCard}>Cadastrar Novo Usuário</h2>
            <form onSubmit={cadastrarUsuario}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={label}>Nome *</label>
                  <input style={input} value={novoUsuario.nome} onChange={(e) => setNovoUsuario({ ...novoUsuario, nome: e.target.value })} required />
                </div>
                <div>
                  <label style={label}>Email *</label>
                  <input style={input} type="email" value={novoUsuario.email} onChange={(e) => setNovoUsuario({ ...novoUsuario, email: e.target.value })} required />
                </div>
                <div>
                  <label style={label}>Senha * (mín. 6 caracteres)</label>
                  <input style={input} type="password" value={novoUsuario.senha} onChange={(e) => setNovoUsuario({ ...novoUsuario, senha: e.target.value })} required />
                </div>
                <div>
                  <label style={label}>Perfil</label>
                  <select style={input} value={novoUsuario.perfil} onChange={(e) => setNovoUsuario({ ...novoUsuario, perfil: e.target.value })}>
                    <option value="USER">Usuário</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={salvando} style={btnPrimario}>
                {salvando ? 'Cadastrando...' : '+ Cadastrar Usuário'}
              </button>
            </form>
          </div>

          {/* Lista de usuários */}
          <div style={card}>
            <h2 style={tituloCard}>Usuários Cadastrados</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={th}>Nome</th>
                  <th style={th}>Email</th>
                  <th style={th}>Perfil</th>
                  <th style={th}>Status</th>
                  <th style={th}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f1f4f8' }}>
                    <td style={td}>{u.nome}</td>
                    <td style={td}>{u.email}</td>
                    <td style={td}>
                      <span style={{ background: u.perfil === 'ADMIN' ? '#eff6ff' : '#f8fafc', color: u.perfil === 'ADMIN' ? '#1d4ed8' : '#475569', border: `1px solid ${u.perfil === 'ADMIN' ? '#bfdbfe' : '#dde3ec'}`, padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>
                        {u.perfil === 'ADMIN' ? 'Admin' : 'Usuário'}
                      </span>
                    </td>
                    <td style={td}>
                      <span style={{ background: u.ativo ? '#f0fdf4' : '#fef2f2', color: u.ativo ? '#059669' : '#dc2626', border: `1px solid ${u.ativo ? '#bbf7d0' : '#fecaca'}`, padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td style={td}>
                      {u.id !== usuario.id && (
                        <button
                          onClick={() => toggleStatus(u.id, u.ativo)}
                          style={{ background: u.ativo ? '#fef2f2' : '#f0fdf4', color: u.ativo ? '#dc2626' : '#059669', border: `1px solid ${u.ativo ? '#fecaca' : '#bbf7d0'}`, borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          {u.ativo ? 'Desativar' : 'Ativar'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const card = { background: '#fff', border: '1px solid #dde3ec', borderRadius: '12px', padding: '24px' };
const tituloCard = { fontSize: '16px', fontWeight: '600', color: '#1e293b', margin: '0 0 20px', paddingBottom: '12px', borderBottom: '1px solid #f1f4f8' };
const th = { padding: '10px 12px', fontWeight: '600', fontSize: '12px', color: '#475569', borderBottom: '1px solid #e2e8f0', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.04em' };
const td = { padding: '12px' };
const label = { display: 'block', fontSize: '13px', color: '#475569', marginBottom: '6px', fontWeight: '500' };
const input = { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #dde3ec', fontSize: '14px', boxSizing: 'border-box', color: '#1e293b' };
const btnPrimario = { background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' };
const btnSecundario = { background: '#f1f4f8', color: '#475569', border: '1px solid #dde3ec', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontSize: '14px' };

export default Perfil;