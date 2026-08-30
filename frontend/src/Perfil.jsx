import API_URL from './api';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TELAS_SISTEMA, TELAS_PADRAO_ADMIN, TELAS_PADRAO_SUPER_ADMIN, TELAS_PADRAO_USUARIO } from './config/telas';

const ehPerfilAdmin = (perfil) => ['ADMIN', 'SUPER_ADMIN'].includes(perfil);
const ehPerfilSuperAdmin = (perfil) => perfil === 'SUPER_ADMIN';

const telasPadraoPerfil = (perfil) => {
  if (ehPerfilSuperAdmin(perfil)) return TELAS_PADRAO_SUPER_ADMIN;
  if (perfil === 'ADMIN') return TELAS_PADRAO_ADMIN;
  return TELAS_PADRAO_USUARIO;
};

const rotuloPerfil = (perfil) => {
  if (perfil === 'SUPER_ADMIN') return 'Super admin';
  if (perfil === 'ADMIN') return 'Admin';
  return 'Usuário';
};

const valorBooleano = (valor) => {
  const texto = String(valor ?? '').trim().toUpperCase();
  return valor === true || valor === 1 || ['1', 'S', 'SIM', 'TRUE', 'YES', 'Y'].includes(texto);
};

function Perfil({ usuario, token, onVoltar, onAtualizar, onGruposAtualizar, trocaSenhaObrigatoria = false }) {
  const ehAdmin = ehPerfilAdmin(usuario.perfil);
  const ehSuperAdmin = ehPerfilSuperAdmin(usuario.perfil);
  const [abaSelecionada, setAbaSelecionada] = useState(() => trocaSenhaObrigatoria ? 'senha' : 'perfil');
  const [form, setForm] = useState({ nome: usuario.nome, email: usuario.email });
  const [senhaForm, setSenhaForm] = useState({ senhaAtual: '', novaSenha: '', confirmarSenha: '' });
  const [usuarios, setUsuarios] = useState([]);
  const [novoUsuario, setNovoUsuario] = useState({ nome: '', email: '', senha: '', perfil: 'USER', tenant_id: usuario.tenant_id || '' });
  const [tenants, setTenants] = useState([]);
  const [novoTenant, setNovoTenant] = useState({
    nome: '',
    descricao: '',
    admin_nome: '',
    admin_email: '',
    admin_senha: '',
  });
  const [usuarioAcessoId, setUsuarioAcessoId] = useState('');
  const [telasSelecionadas, setTelasSelecionadas] = useState([]);
  const [carregandoAcessos, setCarregandoAcessos] = useState(false);
  const [grupos, setGrupos] = useState([]);
  const [novoGrupo, setNovoGrupo] = useState({ nome: '', descricao: '' });
  const [grupoSelecionadoId, setGrupoSelecionadoId] = useState('');
  const [grupoForm, setGrupoForm] = useState({ nome: '', descricao: '' });
  const [membrosGrupo, setMembrosGrupo] = useState([]);
  const [resumoCompartilhamento, setResumoCompartilhamento] = useState(null);
  const [membroGrupo, setMembroGrupo] = useState({
    usuario_id: '',
    permissao: 'MEMBRO',
    pode_ver_todos: true,
    pode_editar: true,
    pode_excluir: false,
  });
  const [salvando, setSalvando] = useState(false);
  const [compartilhandoDados, setCompartilhandoDados] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  const headers = useMemo(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }), [token]);
  const usuarioSelecionado = useMemo(
    () => usuarios.find((u) => String(u.id) === String(usuarioAcessoId)),
    [usuarios, usuarioAcessoId]
  );
  const usuarioSelecionadoEhAdmin = ehPerfilAdmin(usuarioSelecionado?.perfil);
  const usuarioSelecionadoEhSuperAdmin = ehPerfilSuperAdmin(usuarioSelecionado?.perfil);
  const telasDisponiveis = TELAS_SISTEMA.filter((tela) =>
    (!tela.superAdminOnly || usuarioSelecionadoEhSuperAdmin) &&
    (!tela.adminOnly || usuarioSelecionadoEhAdmin)
  );
  const usuariosGrupoDisponiveis = useMemo(
    () => usuarios.filter((u) => Number(u.tenant_id) === Number(usuario.tenant_id)),
    [usuarios, usuario.tenant_id]
  );
  const grupoSelecionado = useMemo(
    () => grupos.find((grupo) => String(grupo.id) === String(grupoSelecionadoId)) || null,
    [grupos, grupoSelecionadoId]
  );

  const lerResposta = useCallback(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const erroResposta = new Error(data.erro || `Erro ao processar a solicitação. Status ${res.status}.`);
      erroResposta.status = res.status;
      throw erroResposta;
    }
    return data;
  }, []);

  const mostrarMensagem = useCallback((msg, isErro = false) => {
    if (isErro) setErro(msg);
    else setMensagem(msg);
    setTimeout(() => { setMensagem(''); setErro(''); }, 3500);
  }, []);

  const buscarUsuarios = useCallback(() => {
    fetch(`${API_URL}/api/auth/usuarios`, { headers })
      .then(lerResposta)
      .then((dados) => setUsuarios(Array.isArray(dados) ? dados : []))
      .catch(() => setUsuarios([]));
  }, [headers, lerResposta]);

  const buscarGrupos = useCallback(() => {
    fetch(`${API_URL}/api/grupos`, { headers })
      .then(lerResposta)
      .then((dados) => {
        const lista = Array.isArray(dados) ? dados : [];
        setGrupos(lista);
        setGrupoSelecionadoId((atual) => {
          if (!atual && lista[0]) return String(lista[0].id);
          if (atual && !lista.some((grupo) => String(grupo.id) === String(atual))) {
            return lista[0] ? String(lista[0].id) : '';
          }
          return atual;
        });
      })
      .catch(() => {
        setGrupos([]);
        setGrupoSelecionadoId('');
      });
  }, [headers, lerResposta]);

  const buscarTenants = useCallback(() => {
    if (!ehSuperAdmin) return;
    fetch(`${API_URL}/api/tenants`, { headers })
      .then(lerResposta)
      .then((dados) => {
        const lista = Array.isArray(dados) ? dados : [];
        setTenants(lista);
        setNovoUsuario((atual) => ({
          ...atual,
          tenant_id: atual.tenant_id || usuario.tenant_id || lista[0]?.id || '',
        }));
      })
      .catch(() => setTenants([]));
  }, [ehSuperAdmin, headers, lerResposta, usuario.tenant_id]);

  const buscarTelasUsuario = useCallback((usuarioId) => {
    if (!usuarioId) return;
    const usuarioAlvo = usuarios.find((u) => String(u.id) === String(usuarioId));
    if (ehPerfilAdmin(usuarioAlvo?.perfil)) {
      setTelasSelecionadas(telasPadraoPerfil(usuarioAlvo?.perfil));
      return;
    }

    setCarregandoAcessos(true);
    fetch(`${API_URL}/api/auth/usuarios/${usuarioId}/telas`, { headers })
      .then(lerResposta)
      .then((data) => setTelasSelecionadas(Array.isArray(data.telas) ? data.telas : []))
      .catch((err) => {
        const telasPadrao = telasPadraoPerfil(usuarioAlvo?.perfil);
        setTelasSelecionadas(telasPadrao);

        if (err.status === 404) {
          mostrarMensagem('A rota de controle de telas não foi encontrada na API atual. Reinicie ou publique o backend atualizado.', true);
          return;
        }

        mostrarMensagem(err.message || 'Erro ao carregar acessos.', true);
      })
      .finally(() => setCarregandoAcessos(false));
  }, [headers, lerResposta, mostrarMensagem, usuarios]);

  const buscarMembrosGrupo = useCallback((grupoId) => {
    if (!grupoId) {
      setMembrosGrupo([]);
      return;
    }
    fetch(`${API_URL}/api/grupos/${grupoId}/membros`, { headers })
      .then(lerResposta)
      .then((dados) => setMembrosGrupo(Array.isArray(dados) ? dados : []))
      .catch(() => setMembrosGrupo([]));
  }, [headers, lerResposta]);

  const buscarResumoCompartilhamento = useCallback((grupoId) => {
    if (!grupoId) {
      setResumoCompartilhamento(null);
      return;
    }

    fetch(`${API_URL}/api/grupos/${grupoId}/compartilhamento`, { headers })
      .then(lerResposta)
      .then(setResumoCompartilhamento)
      .catch(() => setResumoCompartilhamento(null));
  }, [headers, lerResposta]);

  useEffect(() => {
    if (!ehAdmin) return;

    if (abaSelecionada === 'usuarios' || abaSelecionada === 'acessos') {
      buscarUsuarios();
    }

    if ((abaSelecionada === 'usuarios' || abaSelecionada === 'contas') && ehSuperAdmin) {
      buscarTenants();
    }

    if (abaSelecionada === 'acessos') {
      buscarGrupos();
    }
  }, [abaSelecionada, ehAdmin, ehSuperAdmin, buscarUsuarios, buscarGrupos, buscarTenants]);

  useEffect(() => {
    if (ehAdmin && abaSelecionada === 'acessos' && usuarios.length > 0 && !usuarioAcessoId) {
      setUsuarioAcessoId(String(usuarios[0].id));
    }
  }, [abaSelecionada, ehAdmin, usuarios, usuarioAcessoId]);

  useEffect(() => {
    if (ehAdmin && abaSelecionada === 'acessos' && usuarioAcessoId) {
      buscarTelasUsuario(usuarioAcessoId);
    }
  }, [abaSelecionada, ehAdmin, usuarioAcessoId, usuarios, buscarTelasUsuario]);

  useEffect(() => {
    if (ehAdmin && abaSelecionada === 'acessos') {
      buscarMembrosGrupo(grupoSelecionadoId);
      buscarResumoCompartilhamento(grupoSelecionadoId);
    }
  }, [abaSelecionada, ehAdmin, grupoSelecionadoId, buscarMembrosGrupo, buscarResumoCompartilhamento]);

  useEffect(() => {
    setGrupoForm({
      nome: grupoSelecionado?.nome || '',
      descricao: grupoSelecionado?.descricao || '',
    });
  }, [grupoSelecionado]);

  const salvarPerfil = async (e) => {
    e.preventDefault();
    setSalvando(true);
    try {
      await fetch(`${API_URL}/api/auth/perfil`, {
        method: 'PUT', headers,
        body: JSON.stringify(form),
      }).then(lerResposta);
      mostrarMensagem('Perfil atualizado com sucesso!');
      onAtualizar({ ...usuario, nome: form.nome, email: form.email });
    } catch (err) {
      mostrarMensagem(err.message || 'Erro ao atualizar perfil.', true);
    } finally {
      setSalvando(false);
    }
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
    try {
      await fetch(`${API_URL}/api/auth/trocar-senha`, {
        method: 'PUT', headers,
        body: JSON.stringify({ senhaAtual: senhaForm.senhaAtual, novaSenha: senhaForm.novaSenha }),
      }).then(lerResposta);
      mostrarMensagem('Senha alterada com sucesso!');
      setSenhaForm({ senhaAtual: '', novaSenha: '', confirmarSenha: '' });
      onAtualizar?.({ ...usuario, trocar_senha_obrigatorio: false, senha_temporaria: 0 });
    } catch (err) {
      mostrarMensagem(err.message || 'Erro ao trocar senha.', true);
    } finally {
      setSalvando(false);
    }
  };

  const cadastrarUsuario = async (e) => {
    e.preventDefault();
    setSalvando(true);
    try {
      await fetch(`${API_URL}/api/auth/usuarios`, {
        method: 'POST', headers,
        body: JSON.stringify({
          ...novoUsuario,
          tenant_id: ehSuperAdmin ? novoUsuario.tenant_id : usuario.tenant_id,
          telas: telasPadraoPerfil(novoUsuario.perfil),
        }),
      }).then(lerResposta);
      mostrarMensagem('Usuário cadastrado com sucesso!');
      setNovoUsuario({ nome: '', email: '', senha: '', perfil: 'USER', tenant_id: ehSuperAdmin ? (novoUsuario.tenant_id || usuario.tenant_id || '') : usuario.tenant_id || '' });
      buscarUsuarios();
    } catch (err) {
      mostrarMensagem(err.message || 'Erro ao cadastrar usuário.', true);
    } finally {
      setSalvando(false);
    }
  };

  const criarConta = async (e) => {
    e.preventDefault();
    if (!novoTenant.nome.trim()) return;
    setSalvando(true);
    try {
      await fetch(`${API_URL}/api/tenants`, {
        method: 'POST',
        headers,
        body: JSON.stringify(novoTenant),
      }).then(lerResposta);
      mostrarMensagem('Conta criada com sucesso!');
      setNovoTenant({ nome: '', descricao: '', admin_nome: '', admin_email: '', admin_senha: '' });
      buscarTenants();
      buscarUsuarios();
    } catch (err) {
      mostrarMensagem(err.message || 'Erro ao criar conta.', true);
    } finally {
      setSalvando(false);
    }
  };

  const toggleStatus = async (id, ativo) => {
    try {
      await fetch(`${API_URL}/api/auth/usuarios/${id}/status`, {
        method: 'PUT', headers,
        body: JSON.stringify({ ativo: !ativo }),
      }).then(lerResposta);
      buscarUsuarios();
    } catch (err) {
      mostrarMensagem(err.message || 'Erro ao atualizar usuário.', true);
    }
  };

  const toggleTela = (telaId) => {
    if (usuarioSelecionadoEhAdmin) return;
    setTelasSelecionadas((atual) =>
      atual.includes(telaId)
        ? atual.filter((id) => id !== telaId)
        : [...atual, telaId]
    );
  };

  const salvarAcessos = async () => {
    if (!usuarioAcessoId) return;
    setSalvando(true);
    try {
      await fetch(`${API_URL}/api/auth/usuarios/${usuarioAcessoId}/telas`, {
        method: 'PUT', headers,
        body: JSON.stringify({ telas: telasSelecionadas }),
      }).then(lerResposta);
      mostrarMensagem('Acessos atualizados com sucesso!');
      if (String(usuarioAcessoId) === String(usuario.id)) {
        onAtualizar({ ...usuario, telas: telasSelecionadas });
      }
      buscarTelasUsuario(usuarioAcessoId);
    } catch (err) {
      mostrarMensagem(err.message || 'Erro ao salvar acessos.', true);
    } finally {
      setSalvando(false);
    }
  };

  const criarGrupo = async (e) => {
    e.preventDefault();
    if (!novoGrupo.nome.trim()) return;
    setSalvando(true);
    try {
      const data = await fetch(`${API_URL}/api/grupos`, {
        method: 'POST', headers,
        body: JSON.stringify(novoGrupo),
      }).then(lerResposta);
      mostrarMensagem('Grupo criado com sucesso!');
      setNovoGrupo({ nome: '', descricao: '' });
      setGrupoSelecionadoId(String(data.id));
      buscarGrupos();
      onGruposAtualizar?.();
    } catch (err) {
      mostrarMensagem(err.message || 'Erro ao criar grupo.', true);
    } finally {
      setSalvando(false);
    }
  };

  const salvarGrupoDados = async (e) => {
    e.preventDefault();
    if (!grupoSelecionadoId || !grupoForm.nome.trim()) return;
    setSalvando(true);
    try {
      await fetch(`${API_URL}/api/grupos/${grupoSelecionadoId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(grupoForm),
      }).then(lerResposta);
      mostrarMensagem('Grupo atualizado com sucesso!');
      buscarGrupos();
      onGruposAtualizar?.();
    } catch (err) {
      mostrarMensagem(err.message || 'Erro ao atualizar grupo.', true);
    } finally {
      setSalvando(false);
    }
  };

  const excluirGrupo = async (excluirDados = false) => {
    if (!grupoSelecionadoId) return;
    const nomeGrupo = grupoSelecionado?.nome || grupoSelecionadoId;
    const mensagemConfirmacao = excluirDados
      ? `Excluir o grupo "${nomeGrupo}" e apagar definitivamente ${totalDadosGrupo} registro(s) vinculado(s)?`
      : `Excluir o grupo "${nomeGrupo}" mantendo os dados? Os lançamentos e receitas vinculados ficarão sem grupo.`;

    if (!window.confirm(mensagemConfirmacao)) return;

    setSalvando(true);
    try {
      const queryString = excluirDados ? '?excluirDados=S' : '';
      const data = await fetch(`${API_URL}/api/grupos/${grupoSelecionadoId}${queryString}`, {
        method: 'DELETE',
        headers,
      }).then(lerResposta);

      const gastosAfetados = Number(data?.dados?.gastos || 0);
      const receitasAfetadas = Number(data?.dados?.receitas || 0);
      mostrarMensagem(
        excluirDados
          ? `Grupo excluído. ${gastosAfetados} gasto(s) e ${receitasAfetadas} receita(s) apagado(s).`
          : `Grupo excluído. ${gastosAfetados} gasto(s) e ${receitasAfetadas} receita(s) foram mantidos sem grupo.`
      );
      setGrupoSelecionadoId('');
      setGrupoForm({ nome: '', descricao: '' });
      setMembrosGrupo([]);
      setResumoCompartilhamento(null);
      buscarGrupos();
      onGruposAtualizar?.();
    } catch (err) {
      mostrarMensagem(err.message || 'Erro ao excluir grupo.', true);
    } finally {
      setSalvando(false);
    }
  };

  const salvarMembroGrupo = async (e) => {
    e.preventDefault();
    if (!grupoSelecionadoId || !membroGrupo.usuario_id) return;
    setSalvando(true);
    try {
      await fetch(`${API_URL}/api/grupos/${grupoSelecionadoId}/membros`, {
        method: 'POST', headers,
        body: JSON.stringify(membroGrupo),
      }).then(lerResposta);
      mostrarMensagem('Membro atualizado no grupo!');
      setMembroGrupo({
        usuario_id: '',
        permissao: 'MEMBRO',
        pode_ver_todos: true,
        pode_editar: true,
        pode_excluir: false,
      });
      buscarMembrosGrupo(grupoSelecionadoId);
      buscarResumoCompartilhamento(grupoSelecionadoId);
      onGruposAtualizar?.();
    } catch (err) {
      mostrarMensagem(err.message || 'Erro ao atualizar grupo.', true);
    } finally {
      setSalvando(false);
    }
  };

  const salvarPermissoesMembroGrupo = async (usuarioId, dadosMembro) => {
    if (!grupoSelecionadoId || !usuarioId) return;
    setSalvando(true);
    try {
      await fetch(`${API_URL}/api/grupos/${grupoSelecionadoId}/membros/${usuarioId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(dadosMembro),
      }).then(lerResposta);
      mostrarMensagem('Permissões do membro atualizadas!');
      buscarMembrosGrupo(grupoSelecionadoId);
      onGruposAtualizar?.();
    } catch (err) {
      mostrarMensagem(err.message || 'Erro ao atualizar membro.', true);
    } finally {
      setSalvando(false);
    }
  };

  const removerMembroGrupo = async (usuarioId) => {
    if (!grupoSelecionadoId || !window.confirm('Remover este usuário do grupo?')) return;
    try {
      await fetch(`${API_URL}/api/grupos/${grupoSelecionadoId}/membros/${usuarioId}`, {
        method: 'DELETE', headers,
      }).then(lerResposta);
      buscarMembrosGrupo(grupoSelecionadoId);
      buscarResumoCompartilhamento(grupoSelecionadoId);
      onGruposAtualizar?.();
    } catch (err) {
      mostrarMensagem(err.message || 'Erro ao remover membro.', true);
    }
  };

  const compartilharMeusDadosGrupo = async () => {
    if (!grupoSelecionadoId) return;
    const grupo = grupos.find((item) => String(item.id) === String(grupoSelecionadoId));
    if (!window.confirm(`Mover seus lançamentos e receitas existentes para o grupo "${grupo?.nome || grupoSelecionadoId}"?`)) return;

    setCompartilhandoDados(true);
    try {
      const data = await fetch(`${API_URL}/api/grupos/${grupoSelecionadoId}/compartilhar-meus-dados`, {
        method: 'POST',
        headers,
      }).then(lerResposta);
      setResumoCompartilhamento(data.resumo || null);
      mostrarMensagem(`${data.gastos || 0} gasto(s) e ${data.receitas || 0} receita(s) movido(s) para o grupo.`);
      onGruposAtualizar?.();
    } catch (err) {
      mostrarMensagem(err.message || 'Erro ao compartilhar dados.', true);
    } finally {
      setCompartilhandoDados(false);
    }
  };

  const gastosForaGrupo = Number(resumoCompartilhamento?.gastos?.fora_grupo || 0);
  const receitasForaGrupo = Number(resumoCompartilhamento?.receitas?.fora_grupo || 0);
  const gastosNoGrupo = Number(resumoCompartilhamento?.gastos?.no_grupo || 0);
  const receitasNoGrupo = Number(resumoCompartilhamento?.receitas?.no_grupo || 0);
  const totalForaGrupo = gastosForaGrupo + receitasForaGrupo;
  const totalDadosGrupo = gastosNoGrupo + receitasNoGrupo;
  const abasDisponiveis = trocaSenhaObrigatoria
    ? [{ id: 'senha', label: 'Senha' }]
    : [
        { id: 'perfil', label: 'Perfil' },
        { id: 'senha', label: 'Senha' },
        ...(ehAdmin ? [
          { id: 'usuarios', label: 'Usuários' },
          { id: 'acessos', label: 'Acessos' },
        ] : []),
        ...(ehSuperAdmin ? [
          { id: 'contas', label: 'Contas' },
        ] : []),
      ];

  useEffect(() => {
    if (trocaSenhaObrigatoria) setAbaSelecionada('senha');
  }, [trocaSenhaObrigatoria]);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '32px', maxWidth: '1100px', margin: '0 auto', minHeight: '100vh', background: 'var(--app-bg)', color: 'var(--app-text)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', margin: 0, color: 'var(--app-text)' }}>
            {trocaSenhaObrigatoria ? 'Trocar senha inicial' : 'Minha Conta'}
          </h1>
          {trocaSenhaObrigatoria && (
            <p style={{ margin: '4px 0 0', color: 'var(--app-muted)', fontSize: '13px', fontWeight: '700' }}>
              Defina uma senha própria antes de continuar.
            </p>
          )}
        </div>
        {!trocaSenhaObrigatoria && <button onClick={onVoltar} style={btnSecundario}>← Voltar</button>}
      </div>

      {mensagem && (
        <div style={{ background: 'var(--app-success-soft)', border: '1px solid var(--app-success)', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: 'var(--app-success-text)', fontSize: '14px', fontWeight: '700' }}>
          {mensagem}
        </div>
      )}
      {erro && (
        <div style={{ background: 'var(--app-danger-soft)', border: '1px solid var(--app-danger)', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: 'var(--app-danger-text)', fontSize: '14px', fontWeight: '700' }}>
          {erro}
        </div>
      )}

      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '2px solid var(--app-border)', flexWrap: 'wrap' }}>
        {abasDisponiveis.map((aba) => (
          <button
            key={aba.id}
            onClick={() => setAbaSelecionada(aba.id)}
            style={{
              padding: '8px 20px',
              border: 'none',
              background: 'transparent',
              borderBottom: abaSelecionada === aba.id ? '2px solid var(--app-accent)' : '2px solid transparent',
              color: abaSelecionada === aba.id ? 'var(--app-accent-strong)' : 'var(--app-muted)',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: abaSelecionada === aba.id ? '700' : '500',
              marginBottom: '-2px',
            }}
          >
            {aba.label}
          </button>
        ))}
      </div>

      {abaSelecionada === 'perfil' && (
        <div style={card}>
          <h2 style={tituloCard}>Dados Pessoais</h2>
          <form onSubmit={salvarPerfil}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
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
                <input style={{ ...input, background: 'var(--app-surface-soft)', cursor: 'not-allowed' }} value={rotuloPerfil(usuario.perfil)} readOnly />
              </div>
              <div>
                <label style={label}>Conta</label>
                <input style={{ ...input, background: 'var(--app-surface-soft)', cursor: 'not-allowed' }} value={usuario.tenant_nome || usuario.tenant_id || '—'} readOnly />
              </div>
            </div>
            <button type="submit" disabled={salvando} style={btnPrimario}>
              {salvando ? 'Salvando...' : 'Salvar Perfil'}
            </button>
          </form>
        </div>
      )}

      {abaSelecionada === 'senha' && (
        <div style={card}>
          <h2 style={tituloCard}>{trocaSenhaObrigatoria ? 'Definir nova senha' : 'Trocar Senha'}</h2>
          <form onSubmit={trocarSenha}>
            <div style={{ display: 'grid', gap: '16px', maxWidth: '420px', marginBottom: '20px' }}>
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
              {salvando ? 'Salvando...' : trocaSenhaObrigatoria ? 'Definir Senha' : 'Trocar Senha'}
            </button>
          </form>
        </div>
      )}

      {abaSelecionada === 'usuarios' && ehAdmin && (
        <div style={{ display: 'grid', gap: '24px' }}>
          <div style={card}>
            <h2 style={tituloCard}>Cadastrar Novo Usuário</h2>
            <form onSubmit={cadastrarUsuario}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
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
                    {ehSuperAdmin && <option value="SUPER_ADMIN">Super admin</option>}
                  </select>
                </div>
                {ehSuperAdmin && (
                  <div>
                    <label style={label}>Conta</label>
                    <select style={input} value={novoUsuario.tenant_id} onChange={(e) => setNovoUsuario({ ...novoUsuario, tenant_id: e.target.value })}>
                      <option value="">Conta atual</option>
                      {tenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>{tenant.nome}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <button type="submit" disabled={salvando} style={btnPrimario}>
                {salvando ? 'Cadastrando...' : 'Cadastrar Usuário'}
              </button>
            </form>
          </div>

          <div style={card}>
            <h2 style={tituloCard}>Usuários Cadastrados</h2>
            <TabelaUsuarios usuarios={usuarios} usuarioAtual={usuario} onToggleStatus={toggleStatus} mostrarConta={ehSuperAdmin} />
          </div>
        </div>
      )}

      {abaSelecionada === 'acessos' && ehAdmin && (
        <div style={{ display: 'grid', gap: '24px' }}>
          <div style={card}>
            <h2 style={tituloCard}>Controle de Telas</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', alignItems: 'end', marginBottom: '18px' }}>
              <div>
                <label style={label}>Usuário</label>
                <select style={input} value={usuarioAcessoId} onChange={(e) => setUsuarioAcessoId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>{u.nome} - {u.email}</option>
                  ))}
                </select>
              </div>
              <button type="button" onClick={salvarAcessos} disabled={salvando || carregandoAcessos || !usuarioAcessoId || usuarioSelecionadoEhAdmin} style={btnPrimario}>
                {salvando ? 'Salvando...' : 'Salvar Acessos'}
              </button>
            </div>

            {usuarioSelecionadoEhAdmin && (
              <p style={avisoInfo}>Administradores têm acesso completo ao sistema.</p>
            )}

            <div style={gridTelas}>
              {telasDisponiveis.map((tela) => {
                const ativo = usuarioSelecionadoEhAdmin || telasSelecionadas.includes(tela.id);
                return (
                  <label key={tela.id} style={{ ...cardTela, opacity: carregandoAcessos ? 0.65 : 1 }}>
                    <input
                      type="checkbox"
                      checked={ativo}
                      disabled={carregandoAcessos || usuarioSelecionadoEhAdmin}
                      onChange={() => toggleTela(tela.id)}
                    />
                    <span style={{ display: 'grid', gap: '2px' }}>
                      <strong style={{ color: 'var(--app-text)', fontSize: '14px' }}>{tela.label}</strong>
                      <span style={{ color: 'var(--app-muted)', fontSize: '12px' }}>{tela.id}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div style={card}>
            <h2 style={tituloCard}>Grupos de Dados</h2>
            <form onSubmit={criarGrupo} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', alignItems: 'end', marginBottom: '20px' }}>
              <div>
                <label style={label}>Novo grupo</label>
                <input style={input} value={novoGrupo.nome} onChange={(e) => setNovoGrupo({ ...novoGrupo, nome: e.target.value })} placeholder="Família Rafael" />
              </div>
              <div>
                <label style={label}>Descrição</label>
                <input style={input} value={novoGrupo.descricao} onChange={(e) => setNovoGrupo({ ...novoGrupo, descricao: e.target.value })} placeholder="Dados compartilhados" />
              </div>
              <button type="submit" disabled={salvando || !novoGrupo.nome.trim()} style={btnPrimario}>Criar Grupo</button>
            </form>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px', alignItems: 'start' }}>
              <div>
                <label style={label}>Grupo</label>
                <select style={input} value={grupoSelecionadoId} onChange={(e) => setGrupoSelecionadoId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {grupos.map((grupo) => (
                    <option key={grupo.id} value={grupo.id}>{grupo.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            {grupoSelecionado && (
              <form onSubmit={salvarGrupoDados} style={boxGerenciamentoGrupo}>
                <div>
                  <h3 style={subtituloCard}>Editar grupo selecionado</h3>
                  <p style={textoResumo}>
                    {totalDadosGrupo} registro(s) vinculado(s): {gastosNoGrupo} gasto(s) e {receitasNoGrupo} receita(s).
                  </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={label}>Nome do grupo</label>
                    <input style={input} value={grupoForm.nome} onChange={(e) => setGrupoForm({ ...grupoForm, nome: e.target.value })} required />
                  </div>
                  <div>
                    <label style={label}>Descrição</label>
                    <input style={input} value={grupoForm.descricao} onChange={(e) => setGrupoForm({ ...grupoForm, descricao: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button type="submit" disabled={salvando || !grupoForm.nome.trim()} style={btnPrimario}>
                    {salvando ? 'Salvando...' : 'Salvar Grupo'}
                  </button>
                  <button type="button" disabled={salvando} onClick={() => excluirGrupo(false)} style={btnPerigoGrande}>
                    Excluir grupo
                  </button>
                  {ehSuperAdmin && (
                    <button type="button" disabled={salvando} onClick={() => excluirGrupo(true)} style={btnPerigoGrande}>
                      Excluir grupo e dados
                    </button>
                  )}
                </div>
              </form>
            )}

            <div style={{ marginTop: '18px' }}>
              <form onSubmit={salvarMembroGrupo} style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={label}>Membro</label>
                    <select style={input} value={membroGrupo.usuario_id} onChange={(e) => setMembroGrupo({ ...membroGrupo, usuario_id: e.target.value })}>
                      <option value="">Selecione...</option>
                      {usuariosGrupoDisponiveis.map((u) => (
                        <option key={u.id} value={u.id}>{u.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={label}>Papel</label>
                    <select style={input} value={membroGrupo.permissao} onChange={(e) => setMembroGrupo({ ...membroGrupo, permissao: e.target.value })}>
                      <option value="MEMBRO">Membro</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <label style={checkLinha}><input type="checkbox" checked={membroGrupo.pode_ver_todos} onChange={(e) => setMembroGrupo({ ...membroGrupo, pode_ver_todos: e.target.checked })} /> Ver dados</label>
                  <label style={checkLinha}><input type="checkbox" checked={membroGrupo.pode_editar} onChange={(e) => setMembroGrupo({ ...membroGrupo, pode_editar: e.target.checked })} /> Editar</label>
                  <label style={checkLinha}><input type="checkbox" checked={membroGrupo.pode_excluir} onChange={(e) => setMembroGrupo({ ...membroGrupo, pode_excluir: e.target.checked })} /> Excluir</label>
                  <button type="submit" disabled={salvando || !grupoSelecionadoId || !membroGrupo.usuario_id} style={btnSecundario}>Salvar Membro</button>
                </div>
              </form>
            </div>

            {grupoSelecionadoId && (
              <div style={boxCompartilhamento}>
                <div>
                  <h3 style={subtituloCard}>Compartilhamento de Dados</h3>
                  <p style={textoResumo}>
                    No grupo: {gastosNoGrupo} gasto(s) e {receitasNoGrupo} receita(s). Fora deste grupo: {gastosForaGrupo} gasto(s) e {receitasForaGrupo} receita(s).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={compartilharMeusDadosGrupo}
                  disabled={compartilhandoDados || totalForaGrupo === 0}
                  style={{
                    ...btnPrimario,
                    background: totalForaGrupo === 0 ? 'var(--app-border)' : 'var(--app-accent)',
                    color: totalForaGrupo === 0 ? 'var(--app-muted)' : '#fff',
                    cursor: totalForaGrupo === 0 ? 'default' : 'pointer',
                  }}
                >
                  {compartilhandoDados ? 'Movendo...' : 'Mover meus dados para este grupo'}
                </button>
              </div>
            )}

            {grupoSelecionadoId && (
              <div style={{ marginTop: '18px' }}>
                <TabelaMembros
                  membros={membrosGrupo}
                  usuarioAtual={usuario}
                  onRemover={removerMembroGrupo}
                  onSalvar={salvarPermissoesMembroGrupo}
                  salvando={salvando}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {abaSelecionada === 'contas' && ehSuperAdmin && (
        <div style={{ display: 'grid', gap: '24px' }}>
          <div style={card}>
            <h2 style={tituloCard}>Nova Conta</h2>
            <form onSubmit={criarConta}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={label}>Nome da conta *</label>
                  <input style={input} value={novoTenant.nome} onChange={(e) => setNovoTenant({ ...novoTenant, nome: e.target.value })} placeholder="Familia do cliente" required />
                </div>
                <div>
                  <label style={label}>Descrição</label>
                  <input style={input} value={novoTenant.descricao} onChange={(e) => setNovoTenant({ ...novoTenant, descricao: e.target.value })} placeholder="Uso familiar, pessoal ou compartilhado" />
                </div>
              </div>

              <h3 style={subtituloCard}>Administrador inicial</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', margin: '12px 0 20px' }}>
                <div>
                  <label style={label}>Nome</label>
                  <input style={input} value={novoTenant.admin_nome} onChange={(e) => setNovoTenant({ ...novoTenant, admin_nome: e.target.value })} placeholder="Nome do responsável" />
                </div>
                <div>
                  <label style={label}>Email</label>
                  <input style={input} type="email" value={novoTenant.admin_email} onChange={(e) => setNovoTenant({ ...novoTenant, admin_email: e.target.value })} placeholder="email@dominio.com" />
                </div>
                <div>
                  <label style={label}>Senha inicial</label>
                  <input style={input} type="password" value={novoTenant.admin_senha} onChange={(e) => setNovoTenant({ ...novoTenant, admin_senha: e.target.value })} placeholder="mín. 6 caracteres" />
                </div>
              </div>
              <button type="submit" disabled={salvando || !novoTenant.nome.trim()} style={btnPrimario}>
                {salvando ? 'Criando...' : 'Criar Conta'}
              </button>
            </form>
          </div>

          <div style={card}>
            <h2 style={tituloCard}>Contas Cadastradas</h2>
            <TabelaTenants tenants={tenants} />
          </div>
        </div>
      )}
    </div>
  );
}

function TabelaUsuarios({ usuarios, usuarioAtual, onToggleStatus, mostrarConta = false }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          <tr style={{ background: 'var(--app-surface-soft)' }}>
            <th style={th}>Nome</th>
            <th style={th}>Email</th>
            {mostrarConta && <th style={th}>Conta</th>}
            <th style={th}>Perfil</th>
            <th style={th}>Status</th>
            <th style={th}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id} style={{ borderBottom: '1px solid var(--app-border)' }}>
              <td style={td}>{u.nome}</td>
              <td style={td}>{u.email}</td>
              {mostrarConta && <td style={td}>{u.tenant_nome || '—'}</td>}
              <td style={td}>
                <span style={tag(
                  u.perfil === 'SUPER_ADMIN'
                    ? 'var(--app-warning-soft)'
                    : u.perfil === 'ADMIN'
                      ? 'var(--app-accent-soft)'
                      : 'var(--app-surface-soft)',
                  u.perfil === 'SUPER_ADMIN'
                    ? 'var(--app-warning-text)'
                    : u.perfil === 'ADMIN'
                      ? 'var(--app-accent-strong)'
                      : 'var(--app-muted)',
                  u.perfil === 'SUPER_ADMIN'
                    ? 'var(--app-warning)'
                    : u.perfil === 'ADMIN'
                      ? 'var(--app-accent)'
                      : 'var(--app-border)'
                )}>
                  {rotuloPerfil(u.perfil)}
                </span>
              </td>
              <td style={td}>
                <span style={tag(
                  u.ativo ? 'var(--app-success-soft)' : 'var(--app-danger-soft)',
                  u.ativo ? 'var(--app-success-text)' : 'var(--app-danger-text)',
                  u.ativo ? 'var(--app-success)' : 'var(--app-danger)'
                )}>
                  {u.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </td>
              <td style={td}>
                {u.id !== usuarioAtual.id && u.perfil !== 'SUPER_ADMIN' && (
                  <button
                    onClick={() => onToggleStatus(u.id, u.ativo)}
                    style={{ background: u.ativo ? 'var(--app-danger-soft)' : 'var(--app-success-soft)', color: u.ativo ? 'var(--app-danger-text)' : 'var(--app-success-text)', border: `1px solid ${u.ativo ? 'var(--app-danger)' : 'var(--app-success)'}`, borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: '800' }}
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
  );
}

function TabelaTenants({ tenants }) {
  if (tenants.length === 0) {
    return <p style={{ color: 'var(--app-muted)', fontSize: '13px', margin: 0 }}>Nenhuma conta cadastrada.</p>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          <tr style={{ background: 'var(--app-surface-soft)' }}>
            <th style={th}>Conta</th>
            <th style={th}>Identificador</th>
            <th style={th}>Responsável</th>
            <th style={th}>Usuários</th>
            <th style={th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((tenant) => (
            <tr key={tenant.id} style={{ borderBottom: '1px solid var(--app-border)' }}>
              <td style={td}>
                <strong>{tenant.nome}</strong>
                {tenant.descricao && (
                  <div style={{ color: 'var(--app-muted)', fontSize: '12px', marginTop: '2px' }}>{tenant.descricao}</div>
                )}
              </td>
              <td style={td}>{tenant.slug || tenant.id}</td>
              <td style={td}>{tenant.owner_nome || tenant.owner_email || '—'}</td>
              <td style={td}>{tenant.total_usuarios || 0}</td>
              <td style={td}>
                <span style={tag(
                  tenant.ativo ? 'var(--app-success-soft)' : 'var(--app-danger-soft)',
                  tenant.ativo ? 'var(--app-success-text)' : 'var(--app-danger-text)',
                  tenant.ativo ? 'var(--app-success)' : 'var(--app-danger)'
                )}>
                  {tenant.ativo ? 'Ativa' : 'Inativa'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabelaMembros({ membros, usuarioAtual, onRemover, onSalvar, salvando = false }) {
  if (membros.length === 0) {
    return <p style={{ color: 'var(--app-muted)', fontSize: '13px', margin: 0 }}>Nenhum membro neste grupo.</p>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          <tr style={{ background: 'var(--app-surface-soft)' }}>
            <th style={th}>Nome</th>
            <th style={th}>Email</th>
            <th style={th}>Papel</th>
            <th style={th}>Ver</th>
            <th style={th}>Editar</th>
            <th style={th}>Excluir</th>
            <th style={th}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {membros.map((membro) => (
            <LinhaMembro
              key={membro.id}
              membro={membro}
              usuarioAtual={usuarioAtual}
              onRemover={onRemover}
              onSalvar={onSalvar}
              salvando={salvando}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LinhaMembro({ membro, usuarioAtual, onRemover, onSalvar, salvando }) {
  const [form, setForm] = useState({
    permissao: membro.permissao || 'MEMBRO',
    pode_ver_todos: valorBooleano(membro.pode_ver_todos),
    pode_editar: valorBooleano(membro.pode_editar),
    pode_excluir: valorBooleano(membro.pode_excluir),
  });

  useEffect(() => {
    setForm({
      permissao: membro.permissao || 'MEMBRO',
      pode_ver_todos: valorBooleano(membro.pode_ver_todos),
      pode_editar: valorBooleano(membro.pode_editar),
      pode_excluir: valorBooleano(membro.pode_excluir),
    });
  }, [membro]);

  const salvar = () => onSalvar?.(membro.id, form);

  return (
    <tr style={{ borderBottom: '1px solid var(--app-border)' }}>
      <td style={td}>{membro.nome}</td>
      <td style={td}>{membro.email}</td>
      <td style={td}>
        <select
          style={inputTabela}
          value={form.permissao}
          onChange={(e) => setForm({ ...form, permissao: e.target.value })}
        >
          <option value="MEMBRO">Membro</option>
          <option value="ADMIN">Admin</option>
        </select>
      </td>
      <td style={td}>
        <input
          type="checkbox"
          checked={form.pode_ver_todos}
          onChange={(e) => setForm({ ...form, pode_ver_todos: e.target.checked })}
          aria-label={`Permitir que ${membro.nome} veja dados`}
        />
      </td>
      <td style={td}>
        <input
          type="checkbox"
          checked={form.pode_editar}
          onChange={(e) => setForm({ ...form, pode_editar: e.target.checked })}
          aria-label={`Permitir que ${membro.nome} edite dados`}
        />
      </td>
      <td style={td}>
        <input
          type="checkbox"
          checked={form.pode_excluir}
          onChange={(e) => setForm({ ...form, pode_excluir: e.target.checked })}
          aria-label={`Permitir que ${membro.nome} exclua dados`}
        />
      </td>
      <td style={td}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" onClick={salvar} disabled={salvando} style={btnSecundarioPequeno}>
            Salvar
          </button>
          {membro.id !== usuarioAtual.id && (
            <button type="button" onClick={() => onRemover(membro.id)} disabled={salvando} style={btnPerigo}>
              Remover
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

const tag = (background, color, borderColor = background) => ({
  background,
  color,
  border: `1px solid ${borderColor}`,
  padding: '2px 10px',
  borderRadius: '20px',
  fontSize: '12px',
  fontWeight: '800',
});

const card = { background: 'var(--app-surface)', border: '1px solid var(--app-border)', borderRadius: '12px', padding: '24px' };
const tituloCard = { fontSize: '16px', fontWeight: '800', color: 'var(--app-text)', margin: '0 0 20px', paddingBottom: '12px', borderBottom: '1px solid var(--app-border)' };
const subtituloCard = { fontSize: '14px', fontWeight: '900', color: 'var(--app-text)', margin: '0 0 4px' };
const textoResumo = { margin: 0, color: 'var(--app-muted)', fontSize: '13px', fontWeight: '700' };
const th = { padding: '10px 12px', fontWeight: '800', fontSize: '12px', color: 'var(--app-muted)', borderBottom: '1px solid var(--app-border)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: 0 };
const td = { padding: '12px', color: 'var(--app-text)', verticalAlign: 'middle' };
const label = { display: 'block', fontSize: '13px', color: 'var(--app-muted)', marginBottom: '6px', fontWeight: '800' };
const input = { width: '100%', minHeight: '38px', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--app-border)', fontSize: '14px', boxSizing: 'border-box', color: 'var(--app-text)', background: 'var(--app-surface)' };
const inputTabela = { ...input, minHeight: '34px', padding: '6px 8px', fontSize: '13px', minWidth: '110px' };
const btnPrimario = { minHeight: '38px', background: 'var(--app-accent)', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', cursor: 'pointer', fontSize: '14px', fontWeight: '800' };
const btnSecundario = { minHeight: '38px', background: 'var(--app-surface-soft)', color: 'var(--app-text)', border: '1px solid var(--app-border)', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontSize: '14px', fontWeight: '800' };
const btnSecundarioPequeno = { ...btnSecundario, minHeight: '30px', padding: '4px 10px', fontSize: '12px' };
const btnPerigo = { background: 'var(--app-danger-soft)', color: 'var(--app-danger-text)', border: '1px solid var(--app-danger)', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: '800' };
const btnPerigoGrande = { minHeight: '38px', background: 'var(--app-danger-soft)', color: 'var(--app-danger-text)', border: '1px solid var(--app-danger)', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontSize: '14px', fontWeight: '800' };
const avisoInfo = { margin: '0 0 14px', background: 'var(--app-accent-soft)', color: 'var(--app-accent-strong)', border: '1px solid var(--app-accent)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', fontWeight: '800' };
const gridTelas = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' };
const cardTela = { display: 'flex', gap: '10px', alignItems: 'flex-start', border: '1px solid var(--app-border)', borderRadius: '8px', padding: '12px', background: 'var(--app-surface-soft)', cursor: 'pointer' };
const checkLinha = { display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--app-muted)', fontSize: '13px', fontWeight: '800' };
const boxGerenciamentoGrupo = {
  marginTop: '18px',
  display: 'grid',
  gap: '14px',
  border: '1px solid var(--app-border)',
  borderRadius: '10px',
  padding: '14px',
  background: 'var(--app-surface-soft)',
};
const boxCompartilhamento = {
  marginTop: '22px',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '14px',
  alignItems: 'center',
  border: '1px solid var(--app-border)',
  borderRadius: '10px',
  padding: '14px',
  background: 'var(--app-surface-soft)',
};

export default Perfil;
