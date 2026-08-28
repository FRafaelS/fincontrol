import API_URL from './api';
import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import Layout from './Layout';
import Login from './Login';
import Perfil from './Perfil';
import Dashboard from './Dashboard';
import Lookups from './Lookups';
import Importacao from './Importacao';
import Parcelas from './Parcelas';
import Relatorios from './Relatorios';
import Metas from './Metas';
import Receitas from './Receitas';
import SqlIde from './SqlIde';
import { TELAS_SISTEMA, TELAS_PADRAO_ADMIN, TELAS_PADRAO_USUARIO } from './config/telas';
import { classificarVencimento, diasParaVencer } from './utils/datas';
import { formatarMoeda, toNumber } from './utils/formatters';
import { getLookupLabel, lookupKey, normalizarLookups } from './utils/lookups';
import {
  agruparPagamentosPorResponsavel,
  calcularValorIndividualPorDivisao,
  obterDivisorComum,
} from './utils/rateioResponsaveis';

const campoVazio = {
  responsavel: '', grupo_id: '', tipo: '', periodo: '', descricao: '', parcela: '',
  categoria: '', forma_pgto: '', valor_total: '',
  data_venc: '', data_pgto: '', status: '', obs: '',
};

const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

const PERIODOS_GASTO = [
  { value: 'Q', label: 'Q - Quinzena' },
  { value: 'F', label: 'F - Final do mês' },
];

const periodoAtual = () => {
  const hoje = new Date();
  return `${MESES[hoje.getMonth()]}/${hoje.getFullYear()}`;
};

const ordenarPeriodos = (a, b) => {
  const [mesA, anoA] = String(a).split('/');
  const [mesB, anoB] = String(b).split('/');
  const valorA = (Number(anoA) || 0) * 12 + MESES.indexOf(mesA);
  const valorB = (Number(anoB) || 0) * 12 + MESES.indexOf(mesB);
  return valorB - valorA;
};

const normalizarStatusGasto = (status) => {
  const valor = String(status || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (valor === 'PAGO') return 'PAGO';
  if (valor === 'PENDENTE') return 'PENDENTE';
  return valor;
};

const statusIgual = (status, valor) => normalizarStatusGasto(status) === normalizarStatusGasto(valor);

const normalizarTipoGasto = (tipo) => {
  const valor = String(tipo || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (valor === 'I' || valor === 'INDIVIDUAL') return 'I';
  if (valor === 'C' || valor === 'COMPARTILHADO') return 'C';
  return valor;
};

const normalizarPeriodoGasto = (periodo) => {
  const valor = String(periodo || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (!valor) return '';
  if (valor === 'Q' || valor === 'QUINZENA' || valor === 'QUIZENA') return 'Q';
  if (valor === 'F' || valor === 'FINAL' || valor === 'FINAL_MES' || valor === 'FIM_MES') return 'F';
  return valor;
};

const periodoGastoLabel = (periodo) =>
  PERIODOS_GASTO.find((item) => item.value === normalizarPeriodoGasto(periodo))?.label || '—';

const normalizarTextoBusca = (valor) =>
  String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const periodoPorData = (dataVenc) => {
  const partes = String(dataVenc || '').split('/');
  if (partes.length !== 3) return null;

  const [diaTexto, mesTexto, anoTexto] = partes;
  const dia = parseInt(diaTexto, 10);
  const mes = parseInt(mesTexto, 10);
  const anoNumero = parseInt(anoTexto, 10);
  const ano = anoTexto.length === 2 ? 2000 + anoNumero : anoNumero;

  if (!dia || !mes || !ano || mes < 1 || mes > 12) return null;

  const data = new Date(ano, mes - 1, dia);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
    return null;
  }

  return { mes: MESES[mes - 1], ano };
};

const normalizarGasto = (gasto = {}) => ({
  ...gasto,
  valor_total: toNumber(gasto.valor_total),
  valor_individual: toNumber(gasto.valor_individual),
});

const normalizarReceita = (receita = {}) => ({
  ...receita,
  valor: toNumber(receita.valor),
});

const obterTelasUsuario = (usuario) => {
  if (Array.isArray(usuario?.telas) && usuario.telas.length > 0) return usuario.telas;
  return usuario?.perfil === 'ADMIN' ? TELAS_PADRAO_ADMIN : TELAS_PADRAO_USUARIO;
};

const usuarioPodeAcessarTela = (usuario, telaId) => {
  if (!usuario) return false;
  const tela = TELAS_SISTEMA.find((item) => item.id === telaId);
  if (!tela) return false;
  if (tela.adminOnly && usuario.perfil !== 'ADMIN') return false;
  return obterTelasUsuario(usuario).includes(telaId);
};

const primeiraTelaPermitida = (usuario) =>
  TELAS_SISTEMA.find((tela) => usuarioPodeAcessarTela(usuario, tela.id))?.id || 'dashboard';

const lerJsonSeguro = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.erro || 'Erro ao processar a solicitação.');
  return data;
};

function App() {
  const [pagina, setPagina] = useState('dashboard');
  const [tema, setTema] = useState(() => {
    const padraoEscuroAplicado = localStorage.getItem('tema_padrao_escuro_v2');
    return padraoEscuroAplicado ? localStorage.getItem('tema') || 'dark' : 'dark';
  });
  const [gastos, setGastos] = useState([]);
  const [receitas, setReceitas] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(campoVazio);
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');
  const [diasAlerta, setDiasAlerta] = useState(7);
  const [bannerFechado, setBannerFechado] = useState(false);
  const [verPerfil, setVerPerfil] = useState(false);

  // Auth
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [usuario, setUsuario] = useState(() => {
    try { return JSON.parse(localStorage.getItem('usuario')) || null; }
    catch { return null; }
  });

  const [selecionados, setSelecionados] = useState([]);
  const [menuAcoesAberto, setMenuAcoesAberto] = useState(false);
  const [modalPagamento, setModalPagamento] = useState(false);
  const [dataPagamento, setDataPagamento] = useState('');
  const [confirmandoPagamento, setConfirmandoPagamento] = useState(false);
  const menuRef = useRef(null);

  const [lkResponsavel, setLkResponsavel] = useState([]);
  const [lkCategoria, setLkCategoria] = useState([]);
  const [lkFormaPgto, setLkFormaPgto] = useState([]);
  const [lkStatus, setLkStatus] = useState([]);
  const [lkTipo, setLkTipo] = useState([]);
  const [lkDivisaoComum, setLkDivisaoComum] = useState([]);

  const [filtroMes, setFiltroMes] = useState('');
  const [filtroAno, setFiltroAno] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [filtroBusca, setFiltroBusca] = useState('');
  const [periodoSelecionado, setPeriodoSelecionado] = useState(periodoAtual);
  const telasPermitidas = obterTelasUsuario(usuario);

  const periodosDisponiveis = useMemo(() => {
    const periodos = new Set([periodoAtual()]);
    gastos.forEach((g) => {
      if (g.mes && g.ano) periodos.add(`${g.mes}/${g.ano}`);
    });
    receitas.forEach((r) => {
      if (r.mes && r.ano) periodos.add(`${r.mes}/${r.ano}`);
    });
    return [...periodos].sort(ordenarPeriodos);
  }, [gastos, receitas]);

  const anosLancamentos = useMemo(
    () => [...new Set(gastos.map((g) => g.ano).filter(Boolean))].sort((a, b) => Number(b) - Number(a)),
    [gastos]
  );

  useEffect(() => {
    const temaSeguro = tema === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', temaSeguro);
    document.body.setAttribute('data-theme', temaSeguro);
    localStorage.setItem('tema', temaSeguro);
    localStorage.setItem('tema_padrao_escuro_v2', 'S');
  }, [tema]);

  const alternarTema = () => setTema((atual) => (atual === 'dark' ? 'light' : 'dark'));

  // Fetch autenticado
  const fetchAuth = useCallback((url, options = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  }, [token]);

  const handleLogin = (novoUsuario, novoToken) => {
    setToken(novoToken);
    setUsuario(novoUsuario);
    setPagina(primeiraTelaPermitida(novoUsuario));
  };

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setToken('');
    setUsuario(null);
    setGastos([]);
    setReceitas([]);
    setGrupos([]);
    setSelecionados([]);
    setVerPerfil(false);
    setPagina('dashboard');
  }, []);

  const buscarLookup = useCallback((tipo, setter) =>
    fetchAuth(`${API_URL}/api/lookups/valores/${encodeURIComponent(tipo)}`)
      .then(lerJsonSeguro)
      .then((dados) => setter(normalizarLookups(dados)))
      .catch(() => setter([])), [fetchAuth]);

  const buscarTodasLookups = useCallback(() => {
    buscarLookup('RESPONSAVEL', setLkResponsavel);
    buscarLookup('CATEGORIA', setLkCategoria);
    buscarLookup('FORMA_PGTO', setLkFormaPgto);
    buscarLookup('STATUS_GASTO', setLkStatus);
    buscarLookup('TIPO_GASTO', setLkTipo);
    buscarLookup('DIVISAO_COMUM', setLkDivisaoComum);
    fetchAuth(`${API_URL}/api/lookups/valores/CONFIG_ALERTAS`)
      .then(lerJsonSeguro)
      .then(normalizarLookups)
      .then((configs) => {
        const c = configs.find((c) => c.LOOKUP_CODE === 'DIAS_ALERTA_VENCIMENTO');
        const dias = parseInt(c?.TAG, 10);
        if (Number.isFinite(dias) && dias > 0) setDiasAlerta(dias);
      }).catch(() => {});
  }, [buscarLookup, fetchAuth]);

  const buscarGastos = useCallback(() => {
    fetchAuth(`${API_URL}/api/gastos`)
      .then((r) => {
        if (r.status === 401) { handleLogout(); return []; }
        return r.json();
      })
      .then((d) => { setGastos(Array.isArray(d) ? d.map(normalizarGasto) : []); setCarregando(false); })
      .catch(() => setCarregando(false));
  }, [fetchAuth, handleLogout]);

  const buscarReceitas = useCallback(() => {
    fetchAuth(`${API_URL}/api/receitas`)
      .then((r) => {
        if (r.status === 401) { handleLogout(); return []; }
        return r.json();
      })
      .then((d) => setReceitas(Array.isArray(d) ? d.map(normalizarReceita) : []))
      .catch(() => setReceitas([]));
  }, [fetchAuth, handleLogout]);

  const buscarGrupos = useCallback(() => {
    fetchAuth(`${API_URL}/api/grupos/meus`)
      .then((r) => {
        if (r.status === 401) { handleLogout(); return []; }
        return r.json();
      })
      .then((d) => setGrupos(Array.isArray(d) ? d : []))
      .catch(() => setGrupos([]));
  }, [fetchAuth, handleLogout]);

  const buscarTelasUsuarioAtual = useCallback(() => {
    fetchAuth(`${API_URL}/api/auth/telas`)
      .then(lerJsonSeguro)
      .then((data) => {
        let usuarioLocal = {};
        try {
          usuarioLocal = JSON.parse(localStorage.getItem('usuario') || 'null') || {};
        } catch {
          usuarioLocal = {};
        }
        setUsuario((usuarioAtual) => {
          const usuarioAtualizado = {
            ...usuarioLocal,
            ...usuarioAtual,
            telas: Array.isArray(data.telas) ? data.telas : [],
          };
          localStorage.setItem('usuario', JSON.stringify(usuarioAtualizado));
          return usuarioAtualizado;
        });
      })
      .catch(() => {});
  }, [fetchAuth]);

  useEffect(() => {
    if (token && !usuario?.trocar_senha_obrigatorio) {
      buscarGastos();
      buscarReceitas();
      buscarTodasLookups();
      buscarGrupos();
      buscarTelasUsuarioAtual();
    }
    else setCarregando(false);
  }, [token, usuario?.trocar_senha_obrigatorio, buscarGastos, buscarReceitas, buscarTodasLookups, buscarGrupos, buscarTelasUsuarioAtual]);

  useEffect(() => {
    if (usuario && !usuarioPodeAcessarTela(usuario, pagina)) {
      setPagina(primeiraTelaPermitida(usuario));
    }
  }, [usuario, pagina]);

  useEffect(() => {
    const handleClickFora = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuAcoesAberto(false);
    };
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (erroForm) setErroForm('');
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleNovoGasto = () => { setForm(campoVazio); setEditandoId(null); setErroForm(''); setMostrarForm(true); };

  const abrirNovoLancamento = () => {
    if (!usuarioPodeAcessarTela(usuario, 'gastos')) return;
    handleNovoGasto();
    setPagina('gastos');
  };

  const abrirReceitas = () => {
    if (!usuarioPodeAcessarTela(usuario, 'receitas')) return;
    setPagina('receitas');
  };

  const navegarPara = (tela) => {
    if (usuarioPodeAcessarTela(usuario, tela)) setPagina(tela);
  };

  const handleEditar = (gasto) => {
    setForm({
      responsavel: gasto.responsavel || '', grupo_id: gasto.grupo_id || '',
      tipo: gasto.tipo || '', periodo: gasto.periodo || '',
      descricao: gasto.descricao || '', parcela: gasto.parcela || '',
      categoria: gasto.categoria || '', forma_pgto: gasto.forma_pgto || '',
      valor_total: gasto.valor_total || '',
      data_venc: gasto.data_venc || '', data_pgto: gasto.data_pgto || '',
      status: gasto.status || '', obs: gasto.obs || '',
    });
    setEditandoId(gasto.id);
    setErroForm('');
    setMostrarForm(true);
    setMenuAcoesAberto(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletar = () => {
    if (!window.confirm(`Excluir ${selecionados.length} registro(s)?`)) return;
    setMenuAcoesAberto(false);
    Promise.all(selecionados.map((id) =>
      fetchAuth(`${API_URL}/api/gastos/${id}`, { method: 'DELETE' }).then(lerJsonSeguro)
    )).then(() => { setSelecionados([]); buscarGastos(); })
      .catch((err) => alert(err.message || 'Erro ao excluir registro(s).'));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const tipoNormalizado = normalizarTipoGasto(form.tipo);
    const periodoGasto = normalizarPeriodoGasto(form.periodo);
    const mesAno = periodoPorData(form.data_venc);

    if (!form.descricao.trim()) {
      setErroForm('Descrição é obrigatória.');
      return;
    }
    if (!['I', 'C'].includes(tipoNormalizado)) {
      setErroForm('Selecione o tipo Individual ou Compartilhado.');
      return;
    }
    if (!['Q', 'F'].includes(periodoGasto)) {
      setErroForm('Selecione o período Q ou F.');
      return;
    }
    if (toNumber(form.valor_total) <= 0) {
      setErroForm('Valor total deve ser maior que zero.');
      return;
    }
    if (!mesAno) {
      setErroForm('Informe o vencimento no formato DD/MM/AA.');
      return;
    }
    if (form.data_pgto && !periodoPorData(form.data_pgto)) {
      setErroForm('Informe a data de pagamento no formato DD/MM/AA.');
      return;
    }

    setSalvando(true); setErroForm('');
    const url = editandoId
      ? `${API_URL}/api/gastos/${editandoId}`
      : `${API_URL}/api/gastos`;
    fetchAuth(url, {
      method: editandoId ? 'PUT' : 'POST',
      body: JSON.stringify({
        ...form,
        tipo: tipoNormalizado,
        periodo: periodoGasto,
        valor_total: toNumber(form.valor_total),
      }),
    }).then(lerJsonSeguro).then(() => {
      setForm(campoVazio); setMostrarForm(false);
      setEditandoId(null);
      setSelecionados([]); buscarGastos();
    }).catch((err) => setErroForm(err.message || 'Erro ao salvar gasto.'))
      .finally(() => setSalvando(false));
  };

  const toggleSelecionado = (id) =>
    setSelecionados((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);

  const toggleSelecionarTodos = () =>
    setSelecionados((prev) => {
      const idsFiltrados = gastosFiltrados.map((g) => g.id);
      const todosDaTela = idsFiltrados.length > 0 && idsFiltrados.every((id) => prev.includes(id));
      if (todosDaTela) return prev.filter((id) => !idsFiltrados.includes(id));
      return [...new Set([...prev, ...idsFiltrados])];
    });

  const abrirModalPagamento = () => {
    const hoje = new Date();
    const d = String(hoje.getDate()).padStart(2,'0');
    const m = String(hoje.getMonth()+1).padStart(2,'0');
    const a = String(hoje.getFullYear()).slice(-2);
    setDataPagamento(`${d}/${m}/${a}`);
    setModalPagamento(true);
    setMenuAcoesAberto(false);
  };

  const confirmarPagamento = async () => {
    if (!dataPagamento) return;
    setConfirmandoPagamento(true);
    const statusPago = lkStatus.find((l) =>
      [l.LOOKUP_CODE, l.MEANING].some((valor) => String(valor || '').toUpperCase() === 'PAGO')
    );
    const statusPagoValor = statusPago?.LOOKUP_CODE || 'PAGO';
    try {
      await Promise.all(selecionados.map(async (id) => {
        const g = gastos.find((g) => g.id === id);
        if (!g) return;
        return fetchAuth(`${API_URL}/api/gastos/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ ...g, status: statusPagoValor, data_pgto: dataPagamento }),
        }).then(lerJsonSeguro);
      }));
      setModalPagamento(false);
      setSelecionados([]);
      buscarGastos();
    } catch (err) {
      alert(err.message || 'Erro ao registrar pagamento.');
    } finally {
      setConfirmandoPagamento(false);
    }
  };

  const limparFiltros = () => {
    setFiltroMes(''); setFiltroAno(''); setFiltroPeriodo(''); setFiltroStatus('');
    setFiltroResponsavel(''); setFiltroBusca('');
  };

  const termoBusca = normalizarTextoBusca(filtroBusca);
  const gastosFiltrados = gastos.filter((g) => {
    const okMes = filtroMes ? g.mes === filtroMes : true;
    const okAno = filtroAno ? String(g.ano) === filtroAno : true;
    const okPeriodo = filtroPeriodo ? normalizarPeriodoGasto(g.periodo) === filtroPeriodo : true;
    const okStatus = filtroStatus ? statusIgual(g.status, filtroStatus) : true;
    const okResp = filtroResponsavel ? g.responsavel === filtroResponsavel : true;
    const okBusca = termoBusca
      ? [
          g.id,
          g.tipo,
          normalizarTipoGasto(g.tipo),
          periodoGastoLabel(g.periodo),
          normalizarPeriodoGasto(g.periodo),
          g.parcela,
          g.descricao,
          g.categoria,
          getLookupLabel(lkCategoria, g.categoria),
          g.responsavel,
          getLookupLabel(lkResponsavel, g.responsavel),
          g.forma_pgto,
          getLookupLabel(lkFormaPgto, g.forma_pgto),
          g.data_venc,
          g.data_pgto,
          g.status,
          getLookupLabel(lkStatus, g.status),
          g.obs,
          formatarMoeda(g.valor_total),
          formatarMoeda(g.valor_individual),
        ].some((valor) => normalizarTextoBusca(valor).includes(termoBusca))
      : true;
    return okMes && okAno && okPeriodo && okStatus && okResp && okBusca;
  });

  const gastosPendentes = gastos.filter((g) => !statusIgual(g.status, 'PAGO'));
  const vencidos = gastosPendentes.filter((g) => classificarVencimento(g.data_venc, diasAlerta) === 'vencido');
  const vencem_hoje = gastosPendentes.filter((g) => classificarVencimento(g.data_venc, diasAlerta) === 'hoje');
  const proximos = gastosPendentes.filter((g) => classificarVencimento(g.data_venc, diasAlerta) === 'proximo');
  const alertas = [...vencidos, ...vencem_hoje, ...proximos];

  const totalCheio = gastosFiltrados.reduce((s, g) => s + toNumber(g.valor_total), 0);
  const totalIndividual = gastosFiltrados.reduce((s, g) => s + toNumber(g.valor_individual), 0);
  const responsaveisAPagar = agruparPagamentosPorResponsavel(gastosFiltrados, {
    lookupsResponsavel: lkResponsavel,
    lookupsDivisaoComum: lkDivisaoComum,
    estaPago: (gasto) => statusIgual(gasto.status, 'PAGO'),
    normalizarPeriodo: normalizarPeriodoGasto,
  }).filter((item) => item.aPagar > 0);
  const filtersAtivos = filtroMes || filtroAno || filtroPeriodo || filtroStatus || filtroResponsavel || filtroBusca;
  const todosSelecionados = gastosFiltrados.length > 0 && gastosFiltrados.every((g) => selecionados.includes(g.id));
  const divisorComum = obterDivisorComum(lkDivisaoComum, form.responsavel, lkResponsavel);
  const valorIndividualCalculado = calcularValorIndividualPorDivisao(
    form.valor_total,
    form.tipo,
    form.responsavel,
    lkDivisaoComum,
    lkResponsavel
  );
  const mesAnoCalculado = periodoPorData(form.data_venc);
  const temaEscuro = tema === 'dark';
  const tabelaLancamentos = temaEscuro
    ? {
        surface: '#111827',
        surfaceAlt: '#0F172A',
        header: '#0B1220',
        summary: '#111827',
        text: '#E5E7EB',
        muted: '#94A3B8',
        faint: '#64748B',
        border: '#253348',
        selected: '#1E293B',
        vencido: '#2A1518',
        hoje: '#241C10',
        proximo: '#231A12',
        marker: { vencido: '#F87171', hoje: '#FBBF24', proximo: '#FB923C', normal: 'transparent' },
        vencimento: { vencido: '#FB7185', hoje: '#FBBF24', proximo: '#FB923C', normal: '#CBD5E1' },
      }
    : {
        surface: '#fff',
        surfaceAlt: '#F8FAFC',
        header: '#F8FAFC',
        summary: '#0F172A',
        text: '#0F172A',
        muted: '#64748B',
        faint: '#94A3B8',
        border: '#E2E8F0',
        selected: '#EFF6FF',
        vencido: '#FEF2F2',
        hoje: '#FFFBEB',
        proximo: '#FFF7ED',
        marker: { vencido: '#EF4444', hoje: '#F59E0B', proximo: '#F97316', normal: 'transparent' },
        vencimento: { vencido: '#DC2626', hoje: '#D97706', proximo: '#EA580C', normal: '#475569' },
      };
  const thLancamento = {
    ...th,
    color: tabelaLancamentos.muted,
    background: tabelaLancamentos.header,
    borderBottom: `1px solid ${tabelaLancamentos.border}`,
    whiteSpace: 'nowrap',
  };
  const tdLancamento = {
    ...td,
    color: tabelaLancamentos.text,
    borderBottom: `1px solid ${tabelaLancamentos.border}`,
    verticalAlign: 'middle',
  };
  const linhaLancamento = (tipoVenc, selecionado, index) => {
    const fundoPadrao = index % 2 === 0 ? tabelaLancamentos.surface : tabelaLancamentos.surfaceAlt;
    const fundoAlerta = tipoVenc === 'normal' ? fundoPadrao : tabelaLancamentos[tipoVenc];
    return {
      background: selecionado ? tabelaLancamentos.selected : fundoAlerta,
      boxShadow: `inset 4px 0 0 ${selecionado ? '#6366F1' : tabelaLancamentos.marker[tipoVenc]}`,
      cursor: 'pointer',
      transition: 'background 0.12s ease, border-color 0.12s ease',
    };
  };
  const chipLancamento = (cor, fundo) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '24px',
    borderRadius: '999px',
    padding: '2px 9px',
    background: fundo,
    color: cor,
    fontSize: '12px',
    fontWeight: '800',
    whiteSpace: 'nowrap',
  });
  const statusLancamento = (status) => {
    const pago = statusIgual(status, 'PAGO');
    if (temaEscuro) {
      return chipLancamento(pago ? '#34D399' : '#93C5FD', pago ? 'rgba(16,185,129,0.12)' : 'rgba(37,99,235,0.16)');
    }
    return chipLancamento(pago ? '#059669' : '#1D4ED8', pago ? '#F0FDF4' : '#EFF6FF');
  };
  const badgeVencimento = (tipoVenc) => ({
    marginLeft: '6px',
    fontSize: '11px',
    background: tabelaLancamentos.marker[tipoVenc],
    color: '#fff',
    padding: '2px 7px',
    borderRadius: '999px',
    fontWeight: '800',
  });
  const menuAcoesStyle = {
    position: 'absolute',
    top: '110%',
    left: 0,
    zIndex: 100,
    background: temaEscuro ? '#111827' : '#FFFFFF',
    border: `1px solid ${temaEscuro ? '#334155' : '#DDE3EC'}`,
    borderRadius: '10px',
    boxShadow: temaEscuro ? '0 18px 34px rgba(0,0,0,0.36)' : '0 8px 24px rgba(30,58,95,0.12)',
    minWidth: '230px',
    overflow: 'hidden',
  };
  const divisorMenuAcoes = { borderTop: `1px solid ${temaEscuro ? '#253348' : '#F1F4F8'}` };
  const itemMenuAcoes = (ativo, perigo = false) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    textAlign: 'left',
    padding: '11px 16px',
    border: 'none',
    background: 'transparent',
    cursor: ativo ? 'pointer' : 'not-allowed',
    fontSize: '14px',
    color: perigo
      ? (temaEscuro ? '#FCA5A5' : '#DC2626')
      : ativo
        ? (temaEscuro ? '#E5E7EB' : '#1E293B')
        : (temaEscuro ? '#64748B' : '#94A3B8'),
    opacity: ativo ? 1 : 0.65,
    fontWeight: ativo ? '700' : '600',
  });
  const textoAuxiliarMenuAcoes = {
    fontSize: '11px',
    color: temaEscuro ? '#64748B' : '#94A3B8',
  };
  const buscaTabelaInput = {
    ...input,
    width: '100%',
    maxWidth: 'none',
    margin: 0,
    paddingLeft: '36px',
    paddingRight: filtroBusca ? '36px' : '12px',
    color: tabelaLancamentos.text,
    background: temaEscuro ? '#0B1220' : '#FFFFFF',
    border: `1px solid ${temaEscuro ? '#334155' : '#CBD5E1'}`,
    boxShadow: temaEscuro ? 'inset 0 1px 0 rgba(255,255,255,0.04)' : '0 1px 2px rgba(15,23,42,0.05)',
  };

  // Tela de login
  if (!usuario) return <Login onLogin={handleLogin} />;

  if (carregando) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--app-bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '40px', marginBottom: '12px' }}>💳</p>
        <p style={{ color: 'var(--app-muted)', fontSize: '14px' }}>Carregando FinControl...</p>
      </div>
    </div>
  );

  // Tela de perfil
  if (verPerfil || usuario?.trocar_senha_obrigatorio) return (
    <Perfil
      usuario={usuario}
      token={token}
      trocaSenhaObrigatoria={Boolean(usuario?.trocar_senha_obrigatorio)}
      onVoltar={() => setVerPerfil(false)}
      onAtualizar={(u) => {
        setUsuario(u);
        localStorage.setItem('usuario', JSON.stringify(u));
        if (!u?.trocar_senha_obrigatorio) setVerPerfil(false);
      }}
      onGruposAtualizar={buscarGrupos}
    />
  );

  const renderPagina = () => {
    if (!usuarioPodeAcessarTela(usuario, pagina)) return <AcessoNegado />;
    if (pagina === 'dashboard')  return <Dashboard gastos={gastos} receitas={receitas} periodoSelecionado={periodoSelecionado} onAdicionarLancamento={usuarioPodeAcessarTela(usuario, 'gastos') ? abrirNovoLancamento : null} onAdicionarReceita={usuarioPodeAcessarTela(usuario, 'receitas') ? abrirReceitas : null} lookupsResponsavel={lkResponsavel} lookupsDivisaoComum={lkDivisaoComum} />;
    if (pagina === 'parametros') return <Lookups onVoltar={() => { setPagina('gastos'); buscarTodasLookups(); }} token={token} />;
    if (pagina === 'importacao') return <Importacao onVoltar={() => { setPagina('gastos'); buscarGastos(); }} token={token} grupos={grupos} />;
    if (pagina === 'parcelas')   return <Parcelas onVoltar={() => { setPagina('gastos'); buscarGastos(); }} token={token} grupos={grupos} />;
    if (pagina === 'relatorios') return <Relatorios onVoltar={() => setPagina('gastos')} token={token} />;
    if (pagina === 'metas')      return <Metas gastos={gastos} periodoSelecionado={periodoSelecionado} />;
    if (pagina === 'receitas')   return <Receitas token={token} receitas={receitas} responsaveis={lkResponsavel} periodoSelecionado={periodoSelecionado} onAtualizar={buscarReceitas} grupos={grupos} />;
    if (pagina === 'sql')        return usuario?.perfil === 'ADMIN' ? <SqlIde token={token} /> : renderGastos();
    return renderGastos();
  };

  const renderGastos = () => (
    <div>
      {/* Modal Pagamento */}
      {modalPagamento && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--app-surface)', borderRadius: '16px', padding: '32px', width: 'min(400px, calc(100vw - 32px))', boxShadow: 'var(--app-shadow)', border: '1px solid var(--app-border)' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--app-text)' }}>💰 Registrar Pagamento</h2>
            <p style={{ color: 'var(--app-muted)', fontSize: '14px', marginBottom: '24px' }}>
              {selecionados.length} registro(s) serão marcados como <strong>Pago</strong>.
            </p>
            <label style={label}>Data do Pagamento *</label>
            <input style={{ ...input, marginBottom: '24px' }} value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} placeholder="DD/MM/AA" autoFocus />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={confirmarPagamento} disabled={confirmandoPagamento || !dataPagamento} style={{ flex: 1, background: 'var(--app-accent)', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px', cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>
                {confirmandoPagamento ? 'Confirmando...' : '✓ Confirmar Pagamento'}
              </button>
              <button onClick={() => setModalPagamento(false)} style={{ background: 'var(--app-surface-soft)', color: 'var(--app-text)', border: '1px solid var(--app-border)', borderRadius: '8px', padding: '12px 16px', cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Banner alertas */}
      {!bannerFechado && alertas.length > 0 && (
        <div style={{ background: 'var(--app-warning-soft)', border: '1px solid var(--app-warning)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: '0 0 8px', fontWeight: '700', color: 'var(--app-warning-text)', fontSize: '14px' }}>
                ⚠️ {alertas.length} gasto(s) precisam de atenção
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {vencidos.length > 0 && <span style={badge('#dc2626', '#fff')}>🔴 {vencidos.length} vencido(s)</span>}
                {vencem_hoje.length > 0 && <span style={badge('#d97706', '#fff')}>🟡 {vencem_hoje.length} hoje</span>}
                {proximos.length > 0 && <span style={badge('#ea580c', '#fff')}>🟠 {proximos.length} em até {diasAlerta}d</span>}
              </div>
            </div>
            <button onClick={() => setBannerFechado(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--app-warning-text)', fontSize: '18px' }}>✕</button>
          </div>
        </div>
      )}

      {/* Cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {[
          { label: 'Total do período',  valor: formatarMoeda(totalCheio), sub: `${gastosFiltrados.length} lançamentos · valor cheio`, cor: 'var(--app-accent)', icone: '💰' },
          { label: 'Responsáveis a pagar', custom: true, cor: 'var(--app-accent)', icone: '$' },
          { label: 'Vencidos',          valor: vencidos.length,    sub: 'precisam de atenção', cor: 'var(--app-danger)', icone: '🔴' },
          { label: 'Vencem hoje',       valor: vencem_hoje.length, sub: 'pague hoje',           cor: 'var(--app-warning)', icone: '🟡' },
          { label: 'Próx. vencimentos', valor: proximos.length,    sub: `nos próx. ${diasAlerta} dias`, cor: '#ea580c', icone: '🟠' },
        ].map((c) => (
          <div key={c.label} style={{ background: 'var(--app-surface)', borderRadius: '12px', padding: '20px', boxShadow: 'var(--app-shadow)', border: '1px solid var(--app-border)', borderTopColor: c.cor, borderTopWidth: '3px' }}>
            <p style={{ margin: '0 0 6px', fontSize: '11px', color: 'var(--app-muted)', textTransform: 'uppercase', letterSpacing: 0, fontWeight: '700' }}>{c.icone} {c.label}</p>
            {c.custom ? (
              responsaveisAPagar.length > 0 ? (
                <div style={{ display: 'grid', gap: '7px', marginTop: '10px' }}>
                  {responsaveisAPagar.slice(0, 4).map((item) => (
                    <div key={item.responsavel} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '8px', alignItems: 'center' }}>
                      <span style={{ color: 'var(--app-text)', fontSize: '13px', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.responsavel}</span>
                      <strong style={{ color: c.cor, fontSize: '13px' }}>{formatarMoeda(item.aPagar)}</strong>
                    </div>
                  ))}
                  {responsaveisAPagar.length > 4 && <p style={{ margin: 0, color: 'var(--app-faint)', fontSize: '12px' }}>+{responsaveisAPagar.length - 4} responsável(is)</p>}
                </div>
              ) : (
                <p style={{ margin: '16px 0 0', color: 'var(--app-faint)', fontSize: '13px', fontWeight: '700' }}>Nada pendente nos filtros</p>
              )
            ) : (
              <>
                <p style={{ margin: '0 0 4px', fontSize: '26px', fontWeight: '700', color: c.cor }}>{c.valor}</p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--app-faint)' }}>{c.sub}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Barra de ações */}
      <div style={{ background: 'var(--app-surface)', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px', boxShadow: 'var(--app-shadow)', border: '1px solid var(--app-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={mostrarForm ? () => { setForm(campoVazio); setEditandoId(null); setErroForm(''); setMostrarForm(false); } : handleNovoGasto} style={{ background: mostrarForm ? 'var(--app-danger)' : 'var(--app-accent)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>
            {mostrarForm ? '✕ Cancelar' : '+ Novo Gasto'}
          </button>
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button onClick={() => setMenuAcoesAberto(!menuAcoesAberto)} disabled={selecionados.length === 0} style={{ background: selecionados.length > 0 ? 'var(--app-primary)' : 'var(--app-surface-soft)', color: selecionados.length > 0 ? '#fff' : 'var(--app-faint)', border: `1px solid ${selecionados.length > 0 ? 'var(--app-primary)' : 'var(--app-border)'}`, borderRadius: '8px', padding: '8px 16px', cursor: selecionados.length > 0 ? 'pointer' : 'default', fontSize: '14px', fontWeight: '700' }}>
              Ações {selecionados.length > 0 && `(${selecionados.length})`} ▾
            </button>
            {menuAcoesAberto && (
              <div style={menuAcoesStyle}>
                <button onClick={() => selecionados.length === 1 && handleEditar(gastos.find((g) => g.id === selecionados[0]))} disabled={selecionados.length !== 1} style={itemMenuAcoes(selecionados.length === 1)}>
                  ✏️ Editar {selecionados.length !== 1 && <span style={textoAuxiliarMenuAcoes}>(selecione 1)</span>}
                </button>
                <div style={divisorMenuAcoes} />
                <button onClick={abrirModalPagamento} style={itemMenuAcoes(true)}>💰 Registrar Pagamento</button>
                <div style={divisorMenuAcoes} />
                <button onClick={handleDeletar} style={itemMenuAcoes(true, true)}>🗑 Excluir</button>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <select style={{ ...input, maxWidth: '110px', margin: 0 }} value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)}>
            <option value="">Mês</option>
            {MESES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select style={{ ...input, maxWidth: '94px', margin: 0 }} value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)}>
            <option value="">Ano</option>
            {anosLancamentos.map((ano) => <option key={ano} value={ano}>{ano}</option>)}
          </select>
          <select style={{ ...input, maxWidth: '128px', margin: 0 }} value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value)}>
            <option value="">Período</option>
            {PERIODOS_GASTO.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select style={{ ...input, maxWidth: '120px', margin: 0 }} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            <option value="">Status</option>
            {lkStatus.map((l) => <option key={lookupKey(l)} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}
          </select>
          <select style={{ ...input, maxWidth: '150px', margin: 0 }} value={filtroResponsavel} onChange={(e) => setFiltroResponsavel(e.target.value)}>
            <option value="">Responsável</option>
            {lkResponsavel.map((l) => <option key={lookupKey(l)} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}
          </select>
          {filtersAtivos && (
            <button onClick={limparFiltros} style={{ background: 'var(--app-surface-soft)', color: 'var(--app-text)', border: '1px solid var(--app-border)', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap', fontWeight: '700' }}>
              ✕ Limpar
            </button>
          )}
        </div>
      </div>

      {/* Formulário */}
      {mostrarForm && (
        <div style={{ background: 'var(--app-surface)', borderRadius: '12px', padding: '24px', marginBottom: '16px', boxShadow: 'var(--app-shadow)', border: '1px solid var(--app-border)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '20px', color: 'var(--app-text)', paddingBottom: '12px', borderBottom: '1px solid var(--app-border)' }}>
            {editandoId ? `✏️ Editando gasto #${editandoId}` : '+ Novo Gasto'}
          </h2>
          {erroForm && (
            <div style={{ background: 'var(--app-danger-soft)', border: '1px solid var(--app-danger)', borderRadius: '8px', padding: '12px', marginBottom: '16px', color: 'var(--app-danger-text)', fontSize: '14px', fontWeight: '700' }}>
              {erroForm}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div><label style={label}>Descrição *</label><input style={input} name="descricao" value={form.descricao} onChange={handleChange} required /></div>
              <div><label style={label}>Categoria</label><select style={input} name="categoria" value={form.categoria} onChange={handleChange}><option value="">Selecione...</option>{lkCategoria.map((l) => <option key={lookupKey(l)} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}</select></div>
              <div><label style={label}>Forma de Pagamento</label><select style={input} name="forma_pgto" value={form.forma_pgto} onChange={handleChange}><option value="">Selecione...</option>{lkFormaPgto.map((l) => <option key={lookupKey(l)} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}</select></div>
              <div>
                <label style={label}>Valor Total (R$) *</label>
                <input style={input} name="valor_total" type="number" step="0.01" value={form.valor_total} onChange={handleChange} required />
              </div>
              <div><label style={label}>Parcela (ex: 02 DE 10)</label><input style={input} name="parcela" value={form.parcela} onChange={handleChange} /></div>
              <div><label style={label}>Responsável</label><select style={input} name="responsavel" value={form.responsavel} onChange={handleChange}><option value="">Selecione...</option>{lkResponsavel.map((l) => <option key={lookupKey(l)} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}</select></div>
              <div>
                <label style={label}>Grupo de dados</label>
                <select style={input} name="grupo_id" value={form.grupo_id} onChange={handleChange}>
                  <option value="">Padrão</option>
                  {grupos.map((grupo) => <option key={grupo.id} value={grupo.id}>{grupo.nome}</option>)}
                </select>
              </div>
              <div><label style={label}>Tipo *</label><select style={input} name="tipo" value={form.tipo} onChange={handleChange} required><option value="">Selecione...</option>{lkTipo.map((l) => <option key={lookupKey(l)} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}</select></div>
              <div><label style={label}>Período *</label><select style={input} name="periodo" value={form.periodo} onChange={handleChange} required><option value="">Selecione...</option>{PERIODOS_GASTO.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div>
              <div><label style={label}>Vencimento *</label><input style={input} name="data_venc" value={form.data_venc} onChange={handleChange} placeholder="31/03/26" required /></div>
              <div><label style={label}>Data Pgto</label><input style={input} name="data_pgto" value={form.data_pgto} onChange={handleChange} placeholder="31/03/26" /></div>
              <div><label style={label}>Status</label><select style={input} name="status" value={form.status} onChange={handleChange}><option value="">Selecione...</option>{lkStatus.map((l) => <option key={lookupKey(l)} value={l.MEANING}>{l.LOOKUP_CODE}</option>)}</select></div>
              <div style={autoInfo}>
                <span style={{ color: 'var(--app-muted)', fontSize: '12px', fontWeight: '700' }}>Valor individual</span>
                <strong style={{ color: 'var(--app-text)', fontSize: '18px' }}>{formatarMoeda(valorIndividualCalculado)}</strong>
                <span style={{ color: 'var(--app-faint)', fontSize: '11px' }}>
                  {normalizarTipoGasto(form.tipo) === 'C' ? `Divisão comum: ${divisorComum}` : 'Calculado pelo tipo'}
                </span>
              </div>
              <div style={autoInfo}>
                <span style={{ color: 'var(--app-muted)', fontSize: '12px', fontWeight: '700' }}>Mês/Ano</span>
                <strong style={{ color: 'var(--app-text)', fontSize: '18px' }}>{mesAnoCalculado ? `${mesAnoCalculado.mes}/${mesAnoCalculado.ano}` : '—'}</strong>
                <span style={{ color: 'var(--app-faint)', fontSize: '11px' }}>Baseado no vencimento</span>
              </div>
            </div>
            <div style={{ marginTop: '16px' }}><label style={label}>Observação</label><input style={{ ...input, width: '100%' }} name="obs" value={form.obs} onChange={handleChange} /></div>
            <button type="submit" disabled={salvando} style={{ marginTop: '20px', background: editandoId ? 'var(--app-warning)' : 'var(--app-accent)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>
              {salvando ? 'Salvando...' : editandoId ? 'Atualizar Gasto' : 'Salvar Gasto'}
            </button>
          </form>
        </div>
      )}

      {/* Tabela */}
      <div style={{ background: tabelaLancamentos.surface, borderRadius: '12px', boxShadow: temaEscuro ? '0 18px 36px rgba(0,0,0,0.22)' : '0 1px 3px rgba(30,58,95,0.08)', border: `1px solid ${tabelaLancamentos.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '15px 20px', borderBottom: `1px solid ${tabelaLancamentos.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', background: tabelaLancamentos.summary, flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: '4px', minWidth: '230px' }}>
            <span style={{ fontSize: '13px', color: '#94A3B8', fontWeight: '800' }}>
              {gastosFiltrados.length} registro(s)
              {selecionados.length > 0 && <strong style={{ color: '#A5B4FC', marginLeft: '8px' }}> · {selecionados.length} selecionado(s)</strong>}
            </span>
            <span style={{ fontSize: '14px', fontWeight: '900', color: '#E5E7EB' }}>
              Total cheio: {formatarMoeda(totalCheio)} · Individual: {formatarMoeda(totalIndividual)}
            </span>
          </div>
          <div style={{ position: 'relative', width: 'min(100%, 520px)', flex: '1 1 320px' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: tabelaLancamentos.muted, fontSize: '15px', pointerEvents: 'none' }}>⌕</span>
            <input
              aria-label="Buscar lançamentos"
              style={buscaTabelaInput}
              placeholder="Buscar na tabela..."
              value={filtroBusca}
              onChange={(e) => setFiltroBusca(e.target.value)}
            />
            {filtroBusca && (
              <button
                type="button"
                onClick={() => setFiltroBusca('')}
                aria-label="Limpar busca"
                style={{
                  position: 'absolute',
                  right: '7px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '24px',
                  height: '24px',
                  borderRadius: '999px',
                  border: 'none',
                  background: temaEscuro ? '#1E293B' : '#E2E8F0',
                  color: temaEscuro ? '#CBD5E1' : '#475569',
                  cursor: 'pointer',
                  fontSize: '14px',
                  lineHeight: 1,
                  fontWeight: '900',
                }}
              >
                ×
              </button>
            )}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '1320px', borderCollapse: 'separate', borderSpacing: 0, fontSize: '13px' }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th style={{ ...thLancamento, width: '44px' }}><input type="checkbox" checked={todosSelecionados} onChange={toggleSelecionarTodos} style={{ cursor: 'pointer' }} /></th>
                <th style={{ ...thLancamento, width: '78px' }}>ID</th>
                <th style={{ ...thLancamento, width: '78px' }}>Tipo</th>
                <th style={{ ...thLancamento, width: '92px' }}>Período</th>
                <th style={{ ...thLancamento, width: '112px' }}>Parcela</th>
                <th style={{ ...thLancamento, minWidth: '220px' }}>Descrição</th>
                <th style={{ ...thLancamento, width: '150px' }}>Categoria</th>
                <th style={{ ...thLancamento, width: '170px' }}>Responsável</th>
                <th style={{ ...thLancamento, width: '150px' }}>Vencimento</th>
                <th style={{ ...thLancamento, width: '130px', textAlign: 'right' }}>Valor Total</th>
                <th style={{ ...thLancamento, width: '126px', textAlign: 'right' }}>Valor Ind.</th>
                <th style={{ ...thLancamento, width: '118px' }}>Data Pgto</th>
                <th style={{ ...thLancamento, width: '128px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {gastosFiltrados.length === 0 ? (
                <tr><td colSpan="13" style={{ ...tdLancamento, padding: '48px', textAlign: 'center', color: tabelaLancamentos.muted }}>
                  {filtersAtivos ? '🔍 Nenhum gasto encontrado.' : '💡 Nenhum gasto cadastrado ainda.'}
                </td></tr>
              ) : gastosFiltrados.map((g, index) => {
                const tipoVenc = !statusIgual(g.status, 'PAGO') ? classificarVencimento(g.data_venc, diasAlerta) : 'normal';
                const periodoNormalizado = normalizarPeriodoGasto(g.periodo);
                const tipoNormalizado = normalizarTipoGasto(g.tipo);
                const dias = diasParaVencer(g.data_venc);
                const sel = selecionados.includes(g.id);
                return (
                  <tr key={g.id} onClick={() => toggleSelecionado(g.id)} style={linhaLancamento(tipoVenc, sel, index)}>
                    <td style={{ ...tdLancamento, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel} onChange={() => toggleSelecionado(g.id)} style={{ cursor: 'pointer' }} /></td>
                    <td style={{ ...tdLancamento, color: tabelaLancamentos.muted, fontSize: '12px', fontWeight: '800' }}>{g.id}</td>
                    <td style={tdLancamento}>
                      <span style={chipLancamento(tipoNormalizado === 'C' ? (temaEscuro ? '#A5B4FC' : '#4338CA') : (temaEscuro ? '#6EE7B7' : '#047857'), tipoNormalizado === 'C' ? 'rgba(99,102,241,0.16)' : 'rgba(16,185,129,0.14)')}>
                        {tipoNormalizado || '—'}
                      </span>
                    </td>
                    <td style={tdLancamento}>
                      <span title={periodoGastoLabel(g.periodo)} style={chipLancamento(periodoNormalizado === 'Q' ? (temaEscuro ? '#93C5FD' : '#1D4ED8') : (temaEscuro ? '#FDBA74' : '#C2410C'), periodoNormalizado === 'Q' ? 'rgba(37,99,235,0.16)' : 'rgba(249,115,22,0.16)')}>
                        {periodoNormalizado || '—'}
                      </span>
                    </td>
                    <td style={{ ...tdLancamento, color: tabelaLancamentos.muted, fontWeight: '800' }}>{g.parcela || '—'}</td>
                    <td style={{ ...tdLancamento, fontWeight: '800', color: tabelaLancamentos.text, whiteSpace: 'normal', lineHeight: 1.35 }}>{g.descricao}</td>
                    <td style={{ ...tdLancamento, color: tabelaLancamentos.muted, fontWeight: '700' }}>{getLookupLabel(lkCategoria, g.categoria)}</td>
                    <td style={{ ...tdLancamento, color: tabelaLancamentos.text, fontWeight: '800', whiteSpace: 'normal', lineHeight: 1.35 }}>{getLookupLabel(lkResponsavel, g.responsavel)}</td>
                    <td style={{ ...tdLancamento, color: tabelaLancamentos.vencimento[tipoVenc], fontWeight: tipoVenc !== 'normal' ? '900' : '800', whiteSpace: 'nowrap' }}>
                      {g.data_venc || '—'}
                      {!statusIgual(g.status, 'PAGO') && tipoVenc === 'vencido' && <span style={badgeVencimento('vencido')}>{Math.abs(dias)}d atrás</span>}
                      {!statusIgual(g.status, 'PAGO') && tipoVenc === 'hoje' && <span style={badgeVencimento('hoje')}>hoje</span>}
                      {!statusIgual(g.status, 'PAGO') && tipoVenc === 'proximo' && <span style={badgeVencimento('proximo')}>{dias}d</span>}
                    </td>
                    <td style={{ ...tdLancamento, textAlign: 'right', fontWeight: '900', color: tabelaLancamentos.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatarMoeda(g.valor_total)}</td>
                    <td style={{ ...tdLancamento, textAlign: 'right', fontWeight: '900', color: tabelaLancamentos.muted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatarMoeda(g.valor_individual)}</td>
                    <td style={{ ...tdLancamento, color: tabelaLancamentos.muted, fontWeight: '700' }}>{g.data_pgto || '—'}</td>
                    <td style={tdLancamento}>
                      <span style={statusLancamento(g.status)}>
                        {getLookupLabel(lkStatus, g.status)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <Layout
      paginaAtual={pagina}
      onNavegar={navegarPara}
      alertas={alertas.length}
      nomeUsuario={usuario?.nome}
      onPerfil={() => setVerPerfil(true)}
      onLogout={handleLogout}
      periodoSelecionado={periodoSelecionado}
      periodosDisponiveis={periodosDisponiveis}
      onPeriodoChange={setPeriodoSelecionado}
      perfilUsuario={usuario?.perfil}
      telasPermitidas={telasPermitidas}
      tema={tema}
      onTemaChange={alternarTema}
    >
      {renderPagina()}
    </Layout>
  );
}

function AcessoNegado() {
  return (
    <div style={{ maxWidth: '720px', margin: '48px auto', background: 'var(--app-surface)', border: '1px solid var(--app-border)', borderRadius: '12px', padding: '28px', color: 'var(--app-text)', boxShadow: 'var(--app-shadow)' }}>
      <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>Acesso não liberado</h2>
      <p style={{ margin: 0, color: 'var(--app-muted)', fontSize: '14px' }}>Esta tela não está habilitada para o seu usuário.</p>
    </div>
  );
}

const badge = (bg, color) => ({ background: bg, color, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' });
const th = { padding: '11px 16px', fontWeight: '800', fontSize: '12px', color: 'var(--app-muted)', borderBottom: '1px solid var(--app-border)', textTransform: 'uppercase', letterSpacing: 0, background: 'var(--app-surface-soft)' };
const td = { padding: '12px 16px' };
const label = { display: 'block', fontSize: '13px', color: 'var(--app-muted)', marginBottom: '6px', fontWeight: '700' };
const input = { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--app-border)', fontSize: '14px', boxSizing: 'border-box', color: 'var(--app-text)', background: 'var(--app-input-bg)', transition: 'border-color 0.15s' };
const autoInfo = { minHeight: '57px', borderRadius: '8px', border: '1px solid var(--app-border)', background: 'var(--app-surface-soft)', padding: '8px 12px', display: 'grid', alignContent: 'center', gap: '2px', boxSizing: 'border-box' };

export default App;
