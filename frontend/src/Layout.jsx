import React, { useState } from 'react';
import { TELAS_SISTEMA, TELAS_PADRAO_ADMIN, TELAS_PADRAO_SUPER_ADMIN, TELAS_PADRAO_USUARIO } from './config/telas';

const cores = {
  principal: '#0F172A',
  destaque: '#6366F1',
  fundo: '#EEF2F7',
  borda: '#E2E8F0',
  texto: '#0F172A',
  textoSuave: '#64748B',
  alerta: '#F59E0B',
  negativo: '#EF4444',
  superficie: '#fff',
  superficieSuave: '#F8FAFC',
  cabecalho: 'rgba(255,255,255,0.92)',
};

const coresEscuras = {
  principal: '#090D16',
  destaque: '#818CF8',
  fundo: '#090D16',
  borda: '#253348',
  texto: '#E5E7EB',
  textoSuave: '#94A3B8',
  alerta: '#F59E0B',
  negativo: '#F87171',
  superficie: '#111827',
  superficieSuave: '#151C2C',
  cabecalho: 'rgba(17,24,39,0.92)',
};

function Layout({
  paginaAtual,
  onNavegar,
  children,
  alertas = 0,
  nomeUsuario = '',
  onPerfil,
  onLogout,
  periodoSelecionado = '',
  periodosDisponiveis = [],
  onPeriodoChange,
  tenantNome = '',
  perfilUsuario = '',
  telasPermitidas = [],
  tema = 'light',
  onTemaChange,
}) {
  const [recolhido, setRecolhido] = useState(false);
  const paleta = tema === 'dark' ? coresEscuras : cores;
  const ehAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(perfilUsuario);
  const ehSuperAdmin = perfilUsuario === 'SUPER_ADMIN';
  const telasBase = telasPermitidas.length > 0
    ? telasPermitidas
    : ehSuperAdmin
      ? TELAS_PADRAO_SUPER_ADMIN
      : perfilUsuario === 'ADMIN'
      ? TELAS_PADRAO_ADMIN
      : TELAS_PADRAO_USUARIO;
  const telasLiberadas = new Set(telasBase);
  const menuItems = TELAS_SISTEMA.filter((item) =>
    (!item.superAdminOnly || ehSuperAdmin) &&
    (!item.adminOnly || ehAdmin) &&
    telasLiberadas.has(item.id)
  );
  const pagina = menuItems.find((m) => m.id === paginaAtual);
  const primeiroNome = nomeUsuario?.split(' ')[0] || 'usuário';

  return (
    <div data-theme={tema} style={{ display: 'flex', minHeight: '100vh', background: paleta.fundo, color: paleta.texto }}>
      <aside style={{
        width: recolhido ? '72px' : '248px',
        background: paleta.principal,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        flexShrink: 0,
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        zIndex: 200,
        boxShadow: '8px 0 24px rgba(15,23,42,0.18)',
      }}>
        <div style={{
          padding: recolhido ? '18px 0' : '18px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: recolhido ? 'center' : 'space-between',
          minHeight: '68px',
        }}>
          {!recolhido && (
            <div>
              <p style={{ margin: 0, color: '#fff', fontWeight: '800', fontSize: '17px' }}>FinControl</p>
              <p style={{ margin: 0, color: '#94A3B8', fontSize: '12px', marginTop: '2px' }}>Controle financeiro</p>
            </div>
          )}
          <button
            onClick={() => setRecolhido(!recolhido)}
            title={recolhido ? 'Expandir menu' : 'Recolher menu'}
            style={{
              width: '32px',
              height: '32px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px',
              color: '#E2E8F0',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            {recolhido ? '›' : '‹'}
          </button>
        </div>

        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {menuItems.map((item) => {
            const ativo = paginaAtual === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavegar(item.id)}
                title={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  minHeight: '42px',
                  padding: recolhido ? '0' : '0 12px',
                  justifyContent: recolhido ? 'center' : 'flex-start',
                  background: ativo ? 'rgba(99,102,241,0.18)' : 'transparent',
                  border: `1px solid ${ativo ? 'rgba(129,140,248,0.35)' : 'transparent'}`,
                  borderRadius: '8px',
                  color: ativo ? '#fff' : '#CBD5E1',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: ativo ? '700' : '500',
                  textAlign: 'left',
                  marginBottom: '6px',
                }}
              >
                <span style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '7px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: ativo ? paleta.destaque : 'rgba(148,163,184,0.12)',
                  color: '#fff',
                  fontSize: '14px',
                  flexShrink: 0,
                }}>{item.icon}</span>
                {!recolhido && (
                  <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {item.label}
                    {item.id === 'gastos' && alertas > 0 && (
                      <span style={{ background: paleta.negativo, color: '#fff', borderRadius: '999px', padding: '1px 7px', fontSize: '11px', fontWeight: '800' }}>
                        {alertas}
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {!recolhido && (
          <div style={{ padding: '14px 18px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ margin: 0, color: '#64748B', fontSize: '12px' }}>FinControl v2.0</p>
          </div>
        )}
      </aside>

      <main style={{
        flex: 1,
        marginLeft: recolhido ? '72px' : '248px',
        transition: 'margin-left 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}>
        <header style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: paleta.cabecalho,
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${paleta.borda}`,
          padding: '0 28px',
          minHeight: '68px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '18px',
        }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '13px', color: paleta.textoSuave }}>
              Olá, {primeiroNome}{tenantNome ? ` · ${tenantNome}` : ''}
            </p>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: paleta.texto }}>
              {pagina?.label || 'FinControl'}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {periodosDisponiveis.length > 0 && (
              <select
                value={periodoSelecionado}
                onChange={(e) => onPeriodoChange?.(e.target.value)}
                title="Selecionar mês"
                style={{
                  height: '38px',
                  minWidth: '142px',
                  border: `1px solid ${paleta.borda}`,
                  borderRadius: '8px',
                  background: paleta.superficie,
                  color: paleta.texto,
                  padding: '0 10px',
                  fontSize: '13px',
                  fontWeight: '600',
                }}
              >
                {periodosDisponiveis.map((periodo) => (
                  <option key={periodo} value={periodo}>{periodo}</option>
                ))}
              </select>
            )}
            <button
              title="Notificações"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                border: `1px solid ${alertas > 0 ? 'var(--app-warning)' : paleta.borda}`,
                background: alertas > 0 ? 'var(--app-warning-soft)' : paleta.superficie,
                color: alertas > 0 ? 'var(--app-warning-text)' : paleta.textoSuave,
                cursor: 'pointer',
                fontWeight: '800',
              }}
            >
              {alertas > 0 ? alertas : '•'}
            </button>
            <button onClick={onTemaChange} title={tema === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} style={{
              background: paleta.superficie,
              border: `1px solid ${paleta.borda}`,
              borderRadius: '8px',
              padding: '8px 12px',
              cursor: 'pointer',
              color: paleta.textoSuave,
              fontSize: '13px',
              fontWeight: '800',
              minHeight: '38px',
            }}>
              {tema === 'dark' ? 'Claro' : 'Escuro'}
            </button>
            <button onClick={onPerfil} title="Perfil" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: paleta.superficie,
              border: `1px solid ${paleta.borda}`,
              borderRadius: '8px',
              padding: '5px 10px 5px 5px',
              cursor: 'pointer',
              minHeight: '38px',
            }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: paleta.destaque,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: '800',
              }}>
                {nomeUsuario?.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: '13px', color: paleta.texto, fontWeight: '700' }}>{primeiroNome}</span>
            </button>
            <button onClick={onLogout} style={{
              background: paleta.superficie,
              border: `1px solid ${paleta.borda}`,
              borderRadius: '8px',
              padding: '8px 12px',
              cursor: 'pointer',
              color: paleta.textoSuave,
              fontSize: '13px',
              fontWeight: '700',
            }}>
              Sair
            </button>
          </div>
        </header>

        <div style={{ flex: 1, padding: '26px 28px' }}>
          {children}
        </div>
      </main>
    </div>
  );
}

export default Layout;
