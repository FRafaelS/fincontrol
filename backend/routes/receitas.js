const express = require('express');
const router = express.Router();
const { query } = require('../database/postgres');

const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
const TIPOS_RECEBIMENTO = ['QUINZENA', 'FINAL_MES', 'OUTRO'];

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

const parseDataBR = (valor) => {
  const partes = texto(valor).split('/');
  if (partes.length !== 3) return null;

  const dia = inteiro(partes[0]);
  const mes = inteiro(partes[1]);
  const anoInformado = texto(partes[2]);
  const anoNumero = inteiro(anoInformado);
  const ano = anoInformado.length === 2
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

const formatarDataBR = ({ dia, mes, ano }) =>
  `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${String(ano).slice(-2)}`;

const normalizarTipo = (valor) => {
  const tipo = texto(valor).toUpperCase();
  return tipo || 'QUINZENA';
};

const normalizarPayload = (body) => {
  const dataInfo = parseDataBR(body.data_receita);

  return {
    responsavel: texto(body.responsavel),
    descricao: texto(body.descricao),
    valor: numero(body.valor),
    data_receita: dataInfo ? formatarDataBR(dataInfo) : texto(body.data_receita),
    mes: dataInfo ? MESES[dataInfo.mes - 1] : texto(body.mes).toUpperCase(),
    ano: dataInfo ? dataInfo.ano : inteiro(body.ano, new Date().getFullYear()),
    tipo_recebimento: normalizarTipo(body.tipo_recebimento),
    obs: texto(body.obs),
    grupo_id: inteiro(body.grupo_id),
  };
};

const validarPayload = (payload) => {
  if (!payload.responsavel) return 'Responsável é obrigatório.';
  if (!payload.descricao) return 'Descrição é obrigatória.';
  if (payload.valor <= 0) return 'Valor da receita deve ser maior que zero.';
  if (!payload.data_receita) return 'Data da receita é obrigatória.';
  if (!parseDataBR(payload.data_receita)) return 'Data da receita deve estar no formato DD/MM/AA.';
  if (!MESES.includes(payload.mes)) return 'Mês da receita inválido.';
  if (!payload.ano || payload.ano < 2000) return 'Ano da receita inválido.';
  if (!TIPOS_RECEBIMENTO.includes(payload.tipo_recebimento)) return 'Tipo de recebimento inválido.';
  return '';
};

const buscarReceita = async (id) => {
  const result = await query('SELECT * FROM receitas WHERE id = $1', [id]);
  return result.rows[0] || null;
};

const podeAcessarReceita = async (usuario, receita, acao = 'ver') => {
  if (receita.usuario_id === usuario.id) return true;
  if (!receita.grupo_id) return false;

  const permissao = await query(
    'SELECT pode_ver_todos, pode_editar, pode_excluir FROM usuario_grupos WHERE usuario_id = $1 AND grupo_id = $2',
    [usuario.id, receita.grupo_id]
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
          'SELECT * FROM receitas WHERE grupo_id = ANY($1::int[]) OR usuario_id = $2 ORDER BY id DESC',
          [gruposVerTodos, id]
        )
      : await query('SELECT * FROM receitas WHERE usuario_id = $1 ORDER BY id DESC', [id]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const receita = await buscarReceita(req.params.id);
    if (!receita) return res.status(404).json({ erro: 'Receita não encontrada.' });
    if (!(await podeAcessarReceita(req.usuario, receita, 'ver'))) {
      return res.status(403).json({ erro: 'Você não tem permissão para ver esta receita.' });
    }
    res.json(receita);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.post('/', async (req, res) => {
  const payload = normalizarPayload(req.body);
  const erroValidacao = validarPayload(payload);
  if (erroValidacao) return res.status(400).json({ erro: erroValidacao });

  try {
    if (!payload.grupo_id) {
      payload.grupo_id = await buscarGrupoPadraoEdicao(req.usuario);
    }

    if (!(await podeUsarGrupo(req.usuario, payload.grupo_id))) {
      return res.status(403).json({ erro: 'Você não tem permissão para lançar receitas neste grupo.' });
    }

    const result = await query(
      `INSERT INTO receitas (usuario_id, grupo_id, responsavel, descricao, valor, data_receita,
        mes, ano, tipo_recebimento, obs)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [req.usuario.id, payload.grupo_id, payload.responsavel, payload.descricao, payload.valor,
       payload.data_receita, payload.mes, payload.ano, payload.tipo_recebimento,
       payload.obs]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const payload = normalizarPayload(req.body);
  const erroValidacao = validarPayload(payload);
  if (erroValidacao) return res.status(400).json({ erro: erroValidacao });

  try {
    const receita = await buscarReceita(req.params.id);
    if (!receita) return res.status(404).json({ erro: 'Receita não encontrada.' });
    if (!(await podeAcessarReceita(req.usuario, receita, 'editar'))) {
      return res.status(403).json({ erro: 'Você não tem permissão para editar esta receita.' });
    }
    const grupoIdFinal = Object.prototype.hasOwnProperty.call(req.body, 'grupo_id')
      ? payload.grupo_id
      : receita.grupo_id;

    if (grupoIdFinal !== receita.grupo_id && !(await podeUsarGrupo(req.usuario, grupoIdFinal))) {
      return res.status(403).json({ erro: 'Você não tem permissão para mover esta receita para o grupo informado.' });
    }

    await query(
      `UPDATE receitas SET grupo_id=$1, responsavel=$2, descricao=$3, valor=$4, data_receita=$5,
        mes=$6, ano=$7, tipo_recebimento=$8, obs=$9, updated_at=CURRENT_TIMESTAMP
       WHERE id=$10`,
      [grupoIdFinal, payload.responsavel, payload.descricao, payload.valor, payload.data_receita,
       payload.mes, payload.ano, payload.tipo_recebimento, payload.obs, req.params.id]
    );
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const receita = await buscarReceita(req.params.id);
    if (!receita) return res.status(404).json({ erro: 'Receita não encontrada.' });
    if (!(await podeAcessarReceita(req.usuario, receita, 'excluir'))) {
      return res.status(403).json({ erro: 'Você não tem permissão para excluir esta receita.' });
    }

    await query('DELETE FROM receitas WHERE id = $1', [req.params.id]);
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
