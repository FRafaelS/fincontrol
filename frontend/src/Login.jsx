import React, { useEffect, useState } from 'react';
import API_URL from './api';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [modoAcesso, setModoAcesso] = useState('PESSOAL');
  const [modoTela, setModoTela] = useState('login');
  const [resetToken, setResetToken] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [devResetUrl, setDevResetUrl] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenUrl = params.get('reset_token') || params.get('token');
    if (tokenUrl) {
      setResetToken(tokenUrl);
      setModoTela('redefinir');
    }
  }, []);

  const limparFeedback = () => {
    setErro('');
    setMensagem('');
    setDevResetUrl('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    limparFeedback();
    setCarregando(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha, modo_acesso: modoAcesso }),
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

  const solicitarRecuperacao = async (e) => {
    e.preventDefault();
    limparFeedback();
    setCarregando(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/recuperar-senha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.erro || 'Erro ao solicitar recuperação de senha.');
        return;
      }
      setMensagem(data.mensagem || 'Confira seu e-mail para redefinir a senha.');
      if (data.dev_reset_url) setDevResetUrl(data.dev_reset_url);
    } catch {
      setErro('Erro ao conectar com o servidor.');
    } finally {
      setCarregando(false);
    }
  };

  const redefinirSenha = async (e) => {
    e.preventDefault();
    limparFeedback();

    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não conferem.');
      return;
    }
    if (novaSenha.length < 6) {
      setErro('A nova senha deve ter ao menos 6 caracteres.');
      return;
    }

    setCarregando(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/redefinir-senha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, novaSenha }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.erro || 'Erro ao redefinir senha.');
        return;
      }
      window.history.replaceState(null, '', window.location.pathname);
      setModoTela('login');
      setSenha('');
      setNovaSenha('');
      setConfirmarSenha('');
      setResetToken('');
      setMensagem(data.mensagem || 'Senha redefinida com sucesso.');
    } catch {
      setErro('Erro ao conectar com o servidor.');
    } finally {
      setCarregando(false);
    }
  };

  const voltarLogin = () => {
    limparFeedback();
    if (resetToken) window.history.replaceState(null, '', window.location.pathname);
    setResetToken('');
    setNovaSenha('');
    setConfirmarSenha('');
    setModoTela('login');
  };

  const titulo = modoTela === 'recuperar'
    ? 'Recuperar senha'
    : modoTela === 'redefinir'
      ? 'Redefinir senha'
      : 'Entrar na sua conta';

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
            {titulo}
          </h2>

          {mensagem && (
            <div style={{ background: 'var(--app-success-soft)', border: '1px solid var(--app-success)', borderRadius: '8px', padding: '12px', marginBottom: '20px', color: 'var(--app-success-text)', fontSize: '14px', fontWeight: '700' }}>
              {mensagem}
            </div>
          )}
          {erro && (
            <div style={{ background: 'var(--app-danger-soft)', border: '1px solid var(--app-danger)', borderRadius: '8px', padding: '12px', marginBottom: '20px', color: 'var(--app-danger-text)', fontSize: '14px', fontWeight: '700' }}>
              ⚠️ {erro}
            </div>
          )}

          {modoTela === 'login' && (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={label}>Email</label>
                <input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required autoFocus />
              </div>
              <div style={{ marginBottom: '18px' }}>
                <label style={label}>Senha</label>
                <input style={input} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" required />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '18px' }}>
                <button type="button" onClick={() => { limparFeedback(); setModoTela('recuperar'); }} style={btnLink}>
                  Esqueci minha senha
                </button>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={label}>Perfil de entrada</label>
                <select style={input} value={modoAcesso} onChange={(e) => setModoAcesso(e.target.value)}>
                  <option value="PESSOAL">Meu financeiro</option>
                  <option value="PLATAFORMA">Administração da plataforma</option>
                </select>
              </div>
              <button type="submit" disabled={carregando} style={btnPrimario}>
                {carregando ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          )}

          {modoTela === 'recuperar' && (
            <form onSubmit={solicitarRecuperacao}>
              <div style={{ marginBottom: '20px' }}>
                <label style={label}>Email cadastrado</label>
                <input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required autoFocus />
              </div>
              <button type="submit" disabled={carregando} style={btnPrimario}>
                {carregando ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>
              {devResetUrl && (
                <a href={devResetUrl} style={{ ...btnDevLink, marginTop: '12px' }}>
                  Abrir link de teste
                </a>
              )}
              <button type="button" onClick={voltarLogin} style={{ ...btnSecundario, marginTop: '12px' }}>
                Voltar para login
              </button>
            </form>
          )}

          {modoTela === 'redefinir' && (
            <form onSubmit={redefinirSenha}>
              <div style={{ display: 'grid', gap: '16px', marginBottom: '22px' }}>
                <div>
                  <label style={label}>Nova senha</label>
                  <input style={input} type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} required autoFocus />
                </div>
                <div>
                  <label style={label}>Confirmar nova senha</label>
                  <input style={input} type="password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} required />
                </div>
              </div>
              <button type="submit" disabled={carregando || !resetToken} style={btnPrimario}>
                {carregando ? 'Redefinindo...' : 'Redefinir senha'}
              </button>
              <button type="button" onClick={voltarLogin} style={{ ...btnSecundario, marginTop: '12px' }}>
                Voltar para login
              </button>
            </form>
          )}
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
const btnPrimario = { width: '100%', background: 'var(--app-accent)', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '15px', fontWeight: '700', cursor: 'pointer' };
const btnSecundario = { width: '100%', background: 'var(--app-surface-soft)', color: 'var(--app-text)', border: '1px solid var(--app-border)', borderRadius: '8px', padding: '11px 12px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' };
const btnLink = { background: 'transparent', color: 'var(--app-accent-strong)', border: 'none', padding: 0, cursor: 'pointer', fontSize: '13px', fontWeight: '800' };
const btnDevLink = { display: 'block', textAlign: 'center', background: 'var(--app-warning-soft)', color: 'var(--app-warning-text)', border: '1px solid var(--app-warning)', borderRadius: '8px', padding: '10px 12px', textDecoration: 'none', fontSize: '13px', fontWeight: '800' };

export default Login;
