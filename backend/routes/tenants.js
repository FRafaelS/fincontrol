const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { query } = require('../database/postgres');
const { criarTenant, garantirLookupsPadrao } = require('../services/tenants');
const { TELAS_PADRAO_ADMIN } = require('../config/telas');
const { PERFIS } = require('../utils/perfis');

const texto = (valor) => {
  if (valor === undefined || valor === null) return '';
  return String(valor).trim();
};

const inteiro = (valor, padrao = null) => {
  const convertido = parseInt(valor, 10);
  return Number.isFinite(convertido) ? convertido : padrao;
};

const criarGrupoPadrao = async (tenantId, usuarioId, nomeConta) => {
  const grupo = await query(
    `INSERT INTO grupos (tenant_id, nome, descricao, criado_por)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [tenantId, nomeConta, 'Dados financeiros compartilhados', usuarioId]
  );

  await query(
    `INSERT INTO usuario_grupos (tenant_id, usuario_id, grupo_id, permissao, pode_ver_todos, pode_editar, pode_excluir)
     VALUES ($1, $2, $3, 'ADMIN', 1, 1, 1)
     ON CONFLICT (usuario_id, grupo_id)
     DO UPDATE SET permissao = 'ADMIN', pode_ver_todos = 1, pode_editar = 1, pode_excluir = 1`,
    [tenantId, usuarioId, grupo.rows[0].id]
  );

  return grupo.rows[0];
};

const garantirTelasAdminConta = async (tenantId, usuarioId) => {
  for (const tela of TELAS_PADRAO_ADMIN) {
    await query(
      `INSERT INTO usuario_telas (tenant_id, usuario_id, tela, pode_acessar)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (usuario_id, tela)
       DO UPDATE SET pode_acessar = 1, updated_at = NOW()`,
      [tenantId, usuarioId, tela]
    );
  }
};

router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT
         t.id, t.nome, t.slug, t.descricao, t.ativo, t.owner_usuario_id,
         t.created_at, t.updated_at,
         owner.nome AS owner_nome,
         owner.email AS owner_email,
         COUNT(u.id)::int AS total_usuarios
       FROM tenants t
       LEFT JOIN usuarios owner ON owner.id = t.owner_usuario_id
       LEFT JOIN usuarios u ON u.tenant_id = t.id
       GROUP BY t.id, owner.nome, owner.email
       ORDER BY t.created_at DESC, t.nome`
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.post('/', async (req, res) => {
  const nome = texto(req.body.nome);
  const descricao = texto(req.body.descricao);
  const adminNome = texto(req.body.admin_nome);
  const adminEmail = texto(req.body.admin_email).toLowerCase();
  const adminSenha = texto(req.body.admin_senha);

  if (!nome) return res.status(400).json({ erro: 'Nome da conta e obrigatorio.' });
  if ((adminNome || adminEmail || adminSenha) && (!adminNome || !adminEmail || !adminSenha)) {
    return res.status(400).json({ erro: 'Informe nome, email e senha do administrador da conta.' });
  }
  if (adminSenha && adminSenha.length < 6) {
    return res.status(400).json({ erro: 'A senha deve ter ao menos 6 caracteres.' });
  }

  try {
    if (adminEmail) {
      const existe = await query('SELECT id FROM usuarios WHERE email = $1', [adminEmail]);
      if (existe.rows.length > 0) {
        return res.status(400).json({ erro: 'Este email ja esta cadastrado em outra conta.' });
      }
    }

    const tenant = await criarTenant(query, {
      nome,
      descricao,
      slug: req.body.slug,
      ownerUsuarioId: req.usuario.id,
    });

    let usuarioAdmin = null;
    let grupo = null;

    if (adminEmail) {
      const hash = bcrypt.hashSync(adminSenha, 10);
      const usuario = await query(
        `INSERT INTO usuarios (tenant_id, nome, email, senha, perfil, ativo, senha_temporaria)
         VALUES ($1, $2, $3, $4, $5, 1, 1)
         RETURNING id, nome, email, perfil, tenant_id`,
        [tenant.id, adminNome, adminEmail, hash, PERFIS.ADMIN]
      );
      usuarioAdmin = usuario.rows[0];

      await garantirTelasAdminConta(tenant.id, usuarioAdmin.id);
      grupo = await criarGrupoPadrao(tenant.id, usuarioAdmin.id, nome);
      await query('UPDATE tenants SET owner_usuario_id = $1, updated_at = NOW() WHERE id = $2', [usuarioAdmin.id, tenant.id]);
    }

    await garantirLookupsPadrao(query, tenant.id);

    res.status(201).json({
      tenant,
      usuario_admin: usuarioAdmin,
      grupo_padrao: grupo,
      mensagem: 'Conta criada com sucesso.',
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.put('/:id/status', async (req, res) => {
  const id = inteiro(req.params.id);
  if (!id) return res.status(400).json({ erro: 'Conta invalida.' });
  if (id === Number(req.usuario.tenant_id)) {
    return res.status(400).json({ erro: 'Nao desative a propria conta em uso.' });
  }

  try {
    await query(
      'UPDATE tenants SET ativo = $1, updated_at = NOW() WHERE id = $2',
      [req.body.ativo ? 1 : 0, id]
    );
    res.json({ mensagem: 'Status da conta atualizado.' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
