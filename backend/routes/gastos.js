const express = require('express');
const router = express.Router();
const { query } = require('../database/postgres');

const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

const texto = (valor) => {
  if (valor === undefined || valor === null) return '';
  return String(valor).trim();
};

const numero = (valor) => {
  if (valor === undefined || valor === null || valor === '') return 0;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;

  const limpo = String(valor)
    .replace(/[R$\s]/g, '')
    .trim();

  if (!limpo) return 0;

  const normalizado = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo;

  const convertido = Number(normalizado);
  return Number.isFinite(convertido) ? convertido : 0;
};

const inteiro = (valor, padrao = null) => {
  const convertido = parseInt(valor, 10);
  return Number.isFinite(convertido) ? convertido : padrao;
};

const habilitado = (valor) => valor === true || valor === 1 || valor === '1' || valor === 'true';

const normalizarTipo = (valor) => {
  const tipo = texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (tipo === 'I' || tipo === 'INDIVIDUAL') return 'I';
  if (tipo === 'C' || tipo === 'COMPARTILHADO') return 'C';
  return tipo;
};

const normalizarPeriodo = (valor) => {
  const periodo = texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (!periodo) return '';
  if (periodo === 'Q' || periodo === 'QUINZENA' || periodo === 'QUIZENA') return 'Q';
  if (periodo === 'F' || periodo === 'FINAL' || periodo === 'FINAL_MES' || periodo === 'FIM_MES') return 'F';
  return periodo;
};

const normalizarStatus = (valor) => {
  const status = texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (!status) return 'PENDENTE';
  if (status === 'PAGO') return 'PAGO';
  if (status === 'PENDENTE') return 'PENDENTE';
  return status;
};

const normalizarChave = (valor) =>
  texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

const parseDataVencimento = (valor) => {
  const dataTexto = texto(valor);
  if (!dataTexto) return null;

  if (dataTexto.includes('-')) {
    const [ano, mes, dia] = dataTexto.split('-');
    return parseDataVencimento(`${dia}/${mes}/${ano}`);
  }

  const partes = dataTexto.split('/');
  if (partes.length !== 3) return null;

  const dia = inteiro(partes[0]);
  const mes = inteiro(partes[1]);
  const anoTexto = texto(partes[2]);
  const anoNumero = inteiro(anoTexto);
  const ano = anoTexto.length === 2
    ? (anoNumero === null ? null : 2000 + anoNumero)
    : anoNumero;

  if (!dia || !mes || !ano || mes < 1 || mes > 12) return null;

  const data = new Date(ano, mes - 1, dia);
  if (
    data.getFullYear() !== ano ||
    data.getMonth() !== mes - 1 ||
    data.getDate() !== dia
  ) {
    return null;
  }

  return { dia, mes, ano };
};

const formatarDataVencimento = ({ dia, mes, ano }) =>
  `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${String(ano).slice(-2)}`;

const buscarDivisorComum = async (responsavel = '') => {
  const result = await query(
    `SELECT lookup_code, meaning, tag
     FROM mdr_lookup
     WHERE lookup_type = 'DIVISAO_COMUM' AND enabled_flag = 'S'
     ORDER BY id`
  );

  const chaveResponsavel = normalizarChave(responsavel);
  if (chaveResponsavel) {
    const participantes = new Set();
    result.rows.forEach((lookup) => {
      if (normalizarChave(lookup.meaning) === chaveResponsavel && texto(lookup.lookup_code)) {
        participantes.add(normalizarChave(lookup.lookup_code));
      }
    });
    if (participantes.size > 0) return participantes.size;
  }

  const lookup = result.rows[0] || {};
  const divisor = [lookup.tag, lookup.meaning, lookup.lookup_code]
    .map(numero)
    .find((valor) => valor > 0);

  return divisor || 2;
};

const normalizarPayload = (body) => ({
  responsavel: texto(body.responsavel),
  tipo: texto(body.tipo),
  periodo: texto(body.periodo),
  descricao: texto(body.descricao),
  parcela: texto(body.parcela),
  tp_despesa: texto(body.tp_despesa),
  categoria: texto(body.categoria),
  forma_pgto: texto(body.forma_pgto),
  valor_total: numero(body.valor_total),
  data_venc: texto(body.data_venc),
  data_pgto: texto(body.data_pgto),
  status: normalizarStatus(body.status),
  obs: texto(body.obs),
  grupo_id: inteiro(body.grupo_id),
});

const completarPayload = async (payload) => {
  const dataInfo = parseDataVencimento(payload.data_venc);
  const dataPgtoInfo = parseDataVencimento(payload.data_pgto);
  const tipo = normalizarTipo(payload.tipo);
  const periodo = normalizarPeriodo(payload.periodo);
  const divisor = tipo === 'C' ? await buscarDivisorComum(payload.responsavel) : 1;

  return {
    ...payload,
    tipo,
    periodo,
    data_venc: dataInfo ? formatarDataVencimento(dataInfo) : payload.data_venc,
    data_pgto: dataPgtoInfo ? formatarDataVencimento(dataPgtoInfo) : payload.data_pgto,
    valor_individual: tipo === 'C'
      ? payload.valor_total / divisor
      : payload.valor_total,
    mes: dataInfo ? MESES[dataInfo.mes - 1] : '',
    ano: dataInfo ? dataInfo.ano : null,
  };
};

const validarPayload = (payload, { exigirPeriodo = false } = {}) => {
  if (!payload.descricao) return 'Descrição é obrigatória.';
  if (!['I', 'C'].includes(payload.tipo)) return 'Tipo deve ser Individual ou Compartilhado.';
  if (exigirPeriodo && !payload.periodo) return 'Período é obrigatório.';
  if (payload.periodo && !['Q', 'F'].includes(payload.periodo)) return 'Período deve ser Q ou F.';
  if (payload.valor_total <= 0) return 'Valor total deve ser maior que zero.';
  if (!payload.data_venc) return 'Data de vencimento é obrigatória.';
  if (!parseDataVencimento(payload.data_venc)) return 'Data de vencimento deve estar no formato DD/MM/AA.';
  if (payload.data_pgto && !parseDataVencimento(payload.data_pgto)) return 'Data de pagamento deve estar no formato DD/MM/AA.';
  return '';
};

const buscarGasto = async (id) => {
  const result = await query('SELECT * FROM gastos WHERE id = $1', [id]);
  return result.rows[0] || null;
};

const podeAcessarGasto = async (usuario, gasto, acao) => {
  if (gasto.usuario_id === usuario.id) return true;
  if (!gasto.grupo_id) return false;

  const permissao = await query(
    'SELECT pode_ver_todos, pode_editar, pode_excluir FROM usuario_grupos WHERE usuario_id = $1 AND grupo_id = $2',
    [usuario.id, gasto.grupo_id]
  );
  const grupo = permissao.rows[0];
  if (!grupo) return false;

  if (acao === 'ver') return habilitado(grupo.pode_ver_todos);
  if (acao === 'editar') return habilitado(grupo.pode_editar);
  if (acao === 'excluir') return habilitado(grupo.pode_excluir);
  return false;
};

const podeUsarGrupo = async (usuario, grupoId) => {
  if (!grupoId) return true;

  const permissao = await query(
    'SELECT pode_editar FROM usuario_grupos WHERE usuario_id = $1 AND grupo_id = $2',
    [usuario.id, grupoId]
  );

  return Boolean(permissao.rows[0]) && habilitado(permissao.rows[0].pode_editar);
};

const buscarGrupoPadraoEdicao = async (usuario) => {
  const result = await query(
    `SELECT grupo_id
     FROM usuario_grupos
     WHERE usuario_id = $1 AND pode_editar = 1
     ORDER BY CASE WHEN permissao = 'ADMIN' THEN 0 ELSE 1 END, id
     LIMIT 1`,
    [usuario.id]
  );

  return result.rows[0]?.grupo_id || null;
};

const gruposVisiveisUsuario = async (usuario) => {
  const grupos = await query(
    'SELECT ug.grupo_id, ug.pode_ver_todos FROM usuario_grupos ug WHERE ug.usuario_id = $1',
    [usuario.id]
  );

  return grupos.rows.filter((g) => habilitado(g.pode_ver_todos)).map((g) => g.grupo_id);
};

router.get('/', async (req, res) => {
  try {
    const { id } = req.usuario;
    const gruposVerTodos = await gruposVisiveisUsuario(req.usuario);
    const result = gruposVerTodos.length > 0
      ? await query(
          'SELECT * FROM gastos WHERE grupo_id = ANY($1::int[]) OR usuario_id = $2 ORDER BY id DESC',
          [gruposVerTodos, id]
        )
      : await query('SELECT * FROM gastos WHERE usuario_id = $1 ORDER BY id DESC', [id]);

    res.json(result.rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/grupos-visiveis/lista', async (req, res) => {
  try {
    const gruposVerTodos = await gruposVisiveisUsuario(req.usuario);
    if (gruposVerTodos.length === 0) {
      res.json([]);
      return;
    }
    const result = await query(
      'SELECT id, nome FROM grupos WHERE id = ANY($1::int[]) ORDER BY nome',
      [gruposVerTodos]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const gasto = await buscarGasto(req.params.id);
    if (!gasto) return res.status(404).json({ erro: 'Gasto não encontrado.' });
    if (!(await podeAcessarGasto(req.usuario, gasto, 'ver'))) {
      return res.status(403).json({ erro: 'Você não tem permissão para ver este gasto.' });
    }
    res.json(gasto);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const payload = await completarPayload(normalizarPayload(req.body));
    const erroValidacao = validarPayload(payload, { exigirPeriodo: true });
    if (erroValidacao) return res.status(400).json({ erro: erroValidacao });

    if (!payload.grupo_id) {
      payload.grupo_id = await buscarGrupoPadraoEdicao(req.usuario);
    }

    if (!(await podeUsarGrupo(req.usuario, payload.grupo_id))) {
      return res.status(403).json({ erro: 'Você não tem permissão para lançar gastos neste grupo.' });
    }

    const result = await query(
      `INSERT INTO gastos (usuario_id, grupo_id, responsavel, tipo, periodo, descricao, parcela,
        tp_despesa, categoria, forma_pgto, valor_total, valor_individual, data_venc, mes,
        ano, data_pgto, status, obs)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
      [req.usuario.id, payload.grupo_id, payload.responsavel, payload.tipo, payload.periodo,
       payload.descricao, payload.parcela, payload.tp_despesa, payload.categoria,
       payload.forma_pgto, payload.valor_total, payload.valor_individual, payload.data_venc,
       payload.mes, payload.ano, payload.data_pgto, payload.status, payload.obs]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const payload = await completarPayload(normalizarPayload(req.body));
    const erroValidacao = validarPayload(payload);
    if (erroValidacao) return res.status(400).json({ erro: erroValidacao });

    const gasto = await buscarGasto(req.params.id);
    if (!gasto) return res.status(404).json({ erro: 'Gasto não encontrado.' });
    if (!(await podeAcessarGasto(req.usuario, gasto, 'editar'))) {
      return res.status(403).json({ erro: 'Você não tem permissão para editar este gasto.' });
    }
    const grupoIdFinal = Object.prototype.hasOwnProperty.call(req.body, 'grupo_id')
      ? payload.grupo_id
      : gasto.grupo_id;

    if (grupoIdFinal !== gasto.grupo_id && !(await podeUsarGrupo(req.usuario, grupoIdFinal))) {
      return res.status(403).json({ erro: 'Você não tem permissão para mover este gasto para o grupo informado.' });
    }

    await query(
      `UPDATE gastos SET grupo_id=$1, responsavel=$2, tipo=$3, periodo=$4, descricao=$5,
        parcela=$6, tp_despesa=$7, categoria=$8, forma_pgto=$9, valor_total=$10,
        valor_individual=$11, data_venc=$12, mes=$13, ano=$14, data_pgto=$15,
        status=$16, obs=$17 WHERE id=$18`,
      [grupoIdFinal, payload.responsavel, payload.tipo, payload.periodo, payload.descricao,
       payload.parcela, payload.tp_despesa, payload.categoria, payload.forma_pgto,
       payload.valor_total, payload.valor_individual, payload.data_venc, payload.mes,
       payload.ano, payload.data_pgto, payload.status, payload.obs, req.params.id]
    );
    res.json({ sucesso: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const gasto = await buscarGasto(req.params.id);
    if (!gasto) return res.status(404).json({ erro: 'Gasto não encontrado.' });
    if (!(await podeAcessarGasto(req.usuario, gasto, 'excluir'))) {
      return res.status(403).json({ erro: 'Você não tem permissão para excluir este gasto.' });
    }

    await query('DELETE FROM gastos WHERE id = $1', [req.params.id]);
    res.json({ sucesso: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;
