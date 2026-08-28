import React, { useState } from 'react';
import API_URL from './api';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErro(data.erro || 'Erro ao fazer login.');
        setCarregando(false);
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('usuario', JSON.stringify(data.usuario));
      onLogin(data.usuario, data.token);
    } catch {
      setErro('Erro ao conectar com o servidor.');
    }

    setCarregando(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <p style={{ fontSize: '48px', margin: '0 0 8px' }}>💳</p>
          <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: '700', margin: '0 0 4px' }}>
            FinControl
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: 0 }}>
            Controle de Gastos Pessoais
          </p>
        </div>

        <div style={{ background: 'var(--app-surface)', borderRadius: '16px', padding: '32px', boxShadow: 'var(--app-shadow)', border: '1px solid var(--app-border)' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--app-text)', margin: '0 0 24px' }}>
            Entrar na sua conta
          </h2>

          {erro && (
            <div style={{ background: 'var(--app-danger-soft)', border: '1px solid var(--app-danger)', borderRadius: '8px', padding: '12px', marginBottom: '20px', color: 'var(--app-danger-text)', fontSize: '14px', fontWeight: '700' }}>
              ⚠️ {erro}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={label}>Email</label>
              <input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required autoFocus />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={label}>Senha</label>
              <input style={input} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" required />
            </div>
            <button type="submit" disabled={carregando} style={{ width: '100%', background: carregando ? 'var(--app-faint)' : 'var(--app-accent)', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '15px', fontWeight: '700', cursor: carregando ? 'default' : 'pointer' }}>
              {carregando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '24px' }}>
          FinControl v1.0 · Dados protegidos
        </p>
      </div>
    </div>
  );
}

const label = { display: 'block', fontSize: '13px', color: 'var(--app-muted)', marginBottom: '6px', fontWeight: '700' };
const input = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--app-border)', fontSize: '14px', boxSizing: 'border-box', color: 'var(--app-text)', background: 'var(--app-input-bg)', outline: 'none' };

export default Login;
