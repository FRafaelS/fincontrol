const express = require('express');
const router = express.Router();
const { query } = require('../database/postgres');

const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

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

const inteiro = (valor) => parseInt(valor, 10) || 0;

const habilitado = (valor) => valor === true || valor === 1 || valor === '1' || valor === 'true';

const texto = (valor) => {
  if (valor === undefined || valor === null) return '';
  return String(valor).trim();
};

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

const criarDataVencimento = (dia, idxMes, ano) => {
  const ultimoDiaMes = new Date(ano, idxMes + 1, 0).getDate();
  const diaSeguro = Math.min(Math.max(dia, 1), ultimoDiaMes);
  const diaStr = String(diaSeguro).padStart(2, '0');
  const mesNumStr = String(idxMes + 1).padStart(2, '0');
  const anoStr = String(ano).slice(-2);
  return `${diaStr}/${mesNumStr}/${anoStr}`;
};

router.post('/gerar', async (req, res) => {
  const { responsavel, tipo, periodo, descricao, categoria, forma_pgto, valor_total,
    total_parcelas, dia_vencimento, mes_inicial, ano_inicial,
    status, obs, grupo_id } = req.body;

  const totalParcelas = inteiro(total_parcelas);
  const diaVencimento = inteiro(dia_vencimento);
  const anoInicial = inteiro(ano_inicial);
  const valorTotal = numero(valor_total);
  const tipoNormalizado = normalizarTipo(tipo);
  const periodoNormalizado = normalizarPeriodo(periodo);
  let grupoId = inteiro(grupo_id) || null;

  if (!descricao) return res.status(400).json({ erro: 'Descrição é obrigatória.' });
  if (!['I', 'C'].includes(tipoNormalizado))
    return res.status(400).json({ erro: 'Tipo deve ser Individual ou Compartilhado.' });
  if (!periodoNormalizado)
    return res.status(400).json({ erro: 'Período é obrigatório.' });
  if (!['Q', 'F'].includes(periodoNormalizado))
    return res.status(400).json({ erro: 'Período deve ser Q ou F.' });
  if (!totalParcelas || totalParcelas < 2)
    return res.status(400).json({ erro: 'Informe ao menos 2 parcelas.' });
  if (diaVencimento < 1 || diaVencimento > 31)
    return res.status(400).json({ erro: 'Dia de vencimento inválido.' });
  if (!anoInicial)
    return res.status(400).json({ erro: 'Ano inicial inválido.' });
  if (valorTotal <= 0)
    return res.status(400).json({ erro: 'Valor total deve ser maior que zero.' });

  const idxMesInicial = MESES.indexOf(String(mes_inicial || '').toUpperCase());
  if (idxMesInicial === -1) return res.status(400).json({ erro: 'Mês inicial inválido.' });

  try {
    if (!grupoId) {
      grupoId = await buscarGrupoPadraoEdicao(req.usuario);
    }

    if (!(await podeUsarGrupo(req.usuario, grupoId))) {
      return res.status(403).json({ erro: 'Você não tem permissão para gerar parcelas neste grupo.' });
    }

    const divisor = tipoNormalizado === 'C' ? await buscarDivisorComum(responsavel) : 1;
    const valorIndividual = (valorTotal / totalParcelas) / divisor;
    const ids = [];
    for (let i = 0; i < totalParcelas; i++) {
      const idxMes = (idxMesInicial + i) % 12;
      const anosExtras = Math.floor((idxMesInicial + i) / 12);
      const anoAtual = anoInicial + anosExtras;
      const mesAtual = MESES[idxMes];
      const dataVenc = criarDataVencimento(diaVencimento, idxMes, anoAtual);
      const parcela = `${String(i + 1).padStart(2, '0')} DE ${String(totalParcelas).padStart(2, '0')}`;

      const result = await query(
        `INSERT INTO gastos (usuario_id, grupo_id, responsavel, tipo, periodo, descricao, parcela,
          categoria, forma_pgto, valor_total, valor_individual, data_venc, mes, ano, status, obs)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
        [req.usuario.id, grupoId, responsavel, tipoNormalizado, periodoNormalizado, descricao,
         parcela, categoria, forma_pgto, valorTotal, valorIndividual, dataVenc, mesAtual,
         anoAtual, normalizarStatus(status), obs]
      );
      ids.push(result.rows[0].id);
    }
    res.status(201).json({ sucesso: true, total: ids.length, ids });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;
