import React, { useState } from 'react';

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

      const data = await res.json();

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

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <p style={{ fontSize: '48px', margin: '0 0 8px' }}>💳</p>
          <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: '700', margin: '0 0 4px' }}>
            FinControl
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: 0 }}>
            Controle de Gastos Pessoais
          </p>
        </div>

        {/* Card de login */}
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b', margin: '0 0 24px' }}>
            Entrar na sua conta
          </h2>

          {erro && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: '8px', padding: '12px', marginBottom: '20px',
              color: '#dc2626', fontSize: '14px',
            }}>
              ⚠️ {erro}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={label}>Email</label>
              <input
                style={input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoFocus
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={label}>Senha</label>
              <input
                style={input}
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={carregando}
              style={{
                width: '100%',
                background: carregando ? '#93c5fd' : '#1d4ed8',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: carregando ? 'default' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
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

const label = { display: 'block', fontSize: '13px', color: '#475569', marginBottom: '6px', fontWeight: '500' };
const input = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #dde3ec', fontSize: '14px', boxSizing: 'border-box', color: '#1e293b', outline: 'none' };

export default Login;