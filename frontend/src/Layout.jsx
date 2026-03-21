import React, { useState } from 'react';

const MENU_ITEMS = [
  { id: 'gastos',     label: 'Gastos',      icon: '💰' },
  { id: 'parcelas',   label: 'Parcelas',    icon: '📅' },
  { id: 'importacao', label: 'Importar',    icon: '📊' },
  { id: 'relatorios', label: 'Relatórios',  icon: '📄' },
  { id: 'dashboard',  label: 'Dashboard',   icon: '📈' },
  { id: 'parametros', label: 'Parâmetros',  icon: '⚙️' },
];

function Layout({ paginaAtual, onNavegar, children, alertas = 0, nomeUsuario = '', onPerfil, onLogout }) {
  const [recolhido, setRecolhido] = useState(false);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f1f4f8' }}>

      {/* Sidebar */}
      <aside style={{
        width: recolhido ? '64px' : '224px',
        background: '#1e3a5f',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.2s ease',
        flexShrink: 0, position: 'fixed',
        top: 0, left: 0, height: '100vh',
        zIndex: 200,
        boxShadow: '3px 0 12px rgba(30,58,95,0.18)',
      }}>

        {/* Logo */}
        <div style={{
          padding: recolhido ? '18px 0' : '18px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center',
          justifyContent: recolhido ? 'center' : 'space-between',
          minHeight: '64px',
        }}>
          {!recolhido && (
            <div>
              <p style={{ margin: 0, color: '#fff', fontWeight: '700', fontSize: '16px' }}>💳 FinControl</p>
              <p style={{ margin: 0, color: '#93c5fd', fontSize: '11px', marginTop: '2px' }}>Controle de Gastos</p>
            </div>
          )}
          <button onClick={() => setRecolhido(!recolhido)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: '#93c5fd', cursor: 'pointer', padding: '5px 8px', fontSize: '11px' }}>
            {recolhido ? '▶' : '◀'}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {MENU_ITEMS.map((item) => {
            const ativo = paginaAtual === item.id;
            return (
              <button key={item.id} onClick={() => onNavegar(item.id)} title={recolhido ? item.label : ''} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                width: '100%', padding: recolhido ? '11px 0' : '11px 16px',
                justifyContent: recolhido ? 'center' : 'flex-start',
                background: ativo ? 'rgba(37,99,235,0.35)' : 'transparent',
                border: 'none',
                borderLeft: ativo ? '3px solid #3b82f6' : '3px solid transparent',
                borderRight: 'none', borderTop: 'none', borderBottom: 'none',
                color: ativo ? '#fff' : '#93c5fd',
                cursor: 'pointer', fontSize: '14px',
                fontWeight: ativo ? '600' : '400',
                textAlign: 'left',
              }}>
                <span style={{ fontSize: '17px', flexShrink: 0, opacity: ativo ? 1 : 0.75 }}>{item.icon}</span>
                {!recolhido && (
                  <span style={{ flex: 1 }}>
                    {item.label}
                    {item.id === 'gastos' && alertas > 0 && (
                      <span style={{ background: '#dc2626', color: '#fff', borderRadius: '10px', padding: '1px 7px', fontSize: '11px', marginLeft: '8px', fontWeight: '700' }}>
                        {alertas}
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Rodapé */}
        {!recolhido && (
          <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <p style={{ margin: 0, color: 'rgba(147,197,253,0.4)', fontSize: '11px' }}>FinControl v1.0</p>
          </div>
        )}
      </aside>

      {/* Conteúdo */}
      <main style={{ flex: 1, marginLeft: recolhido ? '64px' : '224px', transition: 'margin-left 0.2s ease', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

        {/* Topbar */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: '#fff', borderBottom: '1px solid #e2e8f0',
          padding: '0 28px', height: '64px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(30,58,95,0.07)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>{MENU_ITEMS.find(m => m.id === paginaAtual)?.icon}</span>
            <h1 style={{ margin: 0, fontSize: '17px', fontWeight: '600', color: '#1e293b' }}>
              {MENU_ITEMS.find(m => m.id === paginaAtual)?.label || 'FinControl'}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {alertas > 0 && (
              <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', padding: '4px 12px', fontSize: '13px', fontWeight: '500' }}>
                ⚠️ {alertas} alerta(s)
              </span>
            )}
            <button onClick={onPerfil} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f1f4f8', border: '1px solid #dde3ec', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #1d4ed8, #1e3a5f)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700' }}>
                {nomeUsuario?.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: '13px', color: '#1e293b', fontWeight: '500' }}>{nomeUsuario}</span>
            </button>
            <button onClick={onLogout} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', color: '#dc2626', fontSize: '13px', fontWeight: '500' }}>
              Sair
            </button>
          </div>
        </header>

        {/* Página */}
        <div style={{ flex: 1, padding: '24px 28px' }}>
          {children}
        </div>
      </main>
    </div>
  );
}

export default Layout;