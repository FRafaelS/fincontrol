const express = require('express');
const router = express.Router();
const { query, pool } = require('../database/postgres');
const { ehAdminConta, ehSuperAdmin } = require('../utils/perfis');

const permissaoGrupo = async (usuario, grupoId) => {
  if (ehAdminConta(usuario)) {
    const grupo = await query('SELECT id FROM grupos WHERE id = $1 AND tenant_id = $2', [grupoId, usuario.tenant_id]);
    return grupo.rows[0] ? { admin: true } : null;
  }

  const result = await query(
    `SELECT ug.permissao
     FROM usuario_grupos ug
     JOIN grupos g ON g.id = ug.grupo_id
     WHERE ug.usuario_id = $1 AND ug.grupo_id = $2 AND g.tenant_id = $3`,
    [usuario.id, grupoId, usuario.tenant_id]
  );

  return result.rows[0] || null;
};

const podeVerGrupo = async (usuario, grupoId) => Boolean(await permissaoGrupo(usuario, grupoId));

const podeGerenciarGrupo = async (usuario, grupoId) => {
  const permissao = await permissaoGrupo(usuario, grupoId);
  return Boolean(permissao?.admin || permissao?.permissao === 'ADMIN');
};

const booleano = (valor) => {
  const texto = String(valor ?? '').trim().toUpperCase();
  return valor === true || valor === 1 || ['1', 'S', 'SIM', 'TRUE', 'YES', 'Y'].includes(texto);
};

const normalizarPermissao = (permissao) => {
  const valor = String(permissao || '').trim().toUpperCase();
  return valor === 'ADMIN' ? 'ADMIN' : 'MEMBRO';
};

const resumoDadosGrupo = async (grupoId, tenantId) => {
  const [gastos, receitas] = await Promise.all([
    query('SELECT COUNT(*)::int AS total FROM gastos WHERE grupo_id = $1 AND tenant_id = $2', [grupoId, tenantId]),
    query('SELECT COUNT(*)::int AS total FROM receitas WHERE grupo_id = $1 AND tenant_id = $2', [grupoId, tenantId]),
  ]);

  return {
    gastos: gastos.rows[0]?.total || 0,
    receitas: receitas.rows[0]?.total || 0,
  };
};

const resumoCompartilhamento = async (usuarioId, grupoId) => {
  const [gastos, receitas, membros] = await Promise.all([
    query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE grupo_id = $1)::int AS no_grupo,
         COUNT(*) FILTER (WHERE grupo_id IS DISTINCT FROM $1)::int AS fora_grupo
       FROM gastos
       WHERE usuario_id = $2
         AND tenant_id = (SELECT tenant_id FROM grupos WHERE id = $1)`,
      [grupoId, usuarioId]
    ),
    query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE grupo_id = $1)::int AS no_grupo,
         COUNT(*) FILTER (WHERE grupo_id IS DISTINCT FROM $1)::int AS fora_grupo
       FROM receitas
       WHERE usuario_id = $2
         AND tenant_id = (SELECT tenant_id FROM grupos WHERE id = $1)`,
      [grupoId, usuarioId]
    ),
    query(
      `SELECT COUNT(*)::int AS total
       FROM usuario_grupos
       WHERE grupo_id = $1
         AND tenant_id = (SELECT tenant_id FROM grupos WHERE id = $1)`,
      [grupoId]
    ),
  ]);

  return {
    gastos: gastos.rows[0] || { total: 0, no_grupo: 0, fora_grupo: 0 },
    receitas: receitas.rows[0] || { total: 0, no_grupo: 0, fora_grupo: 0 },
    membros: membros.rows[0]?.total || 0,
  };
};

// Listar grupos do usuário
router.get('/', async (req, res) => {
  try {
    const { perfil, id } = req.usuario;
    let result;
    if (ehAdminConta(req.usuario)) {
      result = await query(
        `SELECT g.*, u.nome as criador
         FROM grupos g
         LEFT JOIN usuarios u ON g.criado_por = u.id
         WHERE g.tenant_id = $1
         ORDER BY g.nome`,
        [req.usuario.tenant_id]
      );
    } else {
      result = await query(
        `SELECT g.*, u.nome as criador, ug.permissao, ug.pode_ver_todos, ug.pode_editar, ug.pode_excluir
         FROM grupos g
         JOIN usuario_grupos ug ON g.id = ug.grupo_id
         LEFT JOIN usuarios u ON g.criado_por = u.id
         WHERE ug.usuario_id = $1 AND g.tenant_id = $2 ORDER BY g.nome`,
        [id, req.usuario.tenant_id]
      );
    }
    res.json(result.rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/meus', async (req, res) => {
  try {
    const result = ehAdminConta(req.usuario)
      ? await query(
          `SELECT g.*, u.nome as criador, 'ADMIN' AS permissao,
            1 AS pode_ver_todos, 1 AS pode_editar, 1 AS pode_excluir
           FROM grupos g
           LEFT JOIN usuarios u ON g.criado_por = u.id
           WHERE g.tenant_id = $1
           ORDER BY g.nome`,
          [req.usuario.tenant_id]
        )
      : await query(
          `SELECT g.*, u.nome as criador, ug.permissao, ug.pode_ver_todos, ug.pode_editar, ug.pode_excluir
           FROM grupos g
           JOIN usuario_grupos ug ON g.id = ug.grupo_id
           LEFT JOIN usuarios u ON g.criado_por = u.id
           WHERE ug.usuario_id = $1 AND g.tenant_id = $2
           ORDER BY g.nome`,
          [req.usuario.id, req.usuario.tenant_id]
        );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// Criar grupo
router.post('/', async (req, res) => {
  const { nome, descricao } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório.' });
  try {
    const result = await query(
      'INSERT INTO grupos (tenant_id, nome, descricao, criado_por) VALUES ($1, $2, $3, $4) RETURNING id',
      [req.usuario.tenant_id, nome, descricao, req.usuario.id]
    );
    const grupoId = result.rows[0].id;
    // Adiciona criador como admin do grupo
    await query(
      `INSERT INTO usuario_grupos (tenant_id, usuario_id, grupo_id, permissao, pode_ver_todos, pode_editar, pode_excluir)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.usuario.tenant_id, req.usuario.id, grupoId, 'ADMIN', 1, 1, 1]
    );
    res.status(201).json({ id: grupoId });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// Atualizar grupo
router.put('/:id', async (req, res) => {
  const { nome, descricao } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório.' });
  try {
    if (!(await podeGerenciarGrupo(req.usuario, req.params.id))) {
      return res.status(403).json({ erro: 'Você não tem permissão para atualizar este grupo.' });
    }
    await query(
      'UPDATE grupos SET nome = $1, descricao = $2 WHERE id = $3 AND tenant_id = $4',
      [nome, descricao, req.params.id, req.usuario.tenant_id]
    );
    res.json({ sucesso: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// Deletar grupo
router.delete('/:id', async (req, res) => {
  try {
    if (!(await podeGerenciarGrupo(req.usuario, req.params.id))) {
      return res.status(403).json({ erro: 'Você não tem permissão para excluir este grupo.' });
    }

    const excluirDados = booleano(req.query.excluirDados ?? req.body?.excluirDados);
    if (excluirDados && !ehSuperAdmin(req.usuario)) {
      return res.status(403).json({ erro: 'Somente o super administrador pode excluir os dados do grupo.' });
    }

    const dados = await resumoDadosGrupo(req.params.id, req.usuario.tenant_id);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      if (excluirDados) {
        await client.query('DELETE FROM gastos WHERE grupo_id = $1 AND tenant_id = $2', [req.params.id, req.usuario.tenant_id]);
        await client.query('DELETE FROM receitas WHERE grupo_id = $1 AND tenant_id = $2', [req.params.id, req.usuario.tenant_id]);
      } else {
        await client.query('UPDATE gastos SET grupo_id = NULL WHERE grupo_id = $1 AND tenant_id = $2', [req.params.id, req.usuario.tenant_id]);
        await client.query('UPDATE receitas SET grupo_id = NULL WHERE grupo_id = $1 AND tenant_id = $2', [req.params.id, req.usuario.tenant_id]);
      }

      await client.query('DELETE FROM usuario_grupos WHERE grupo_id = $1 AND tenant_id = $2', [req.params.id, req.usuario.tenant_id]);
      const grupo = await client.query('DELETE FROM grupos WHERE id = $1 AND tenant_id = $2 RETURNING id', [req.params.id, req.usuario.tenant_id]);

      if (!grupo.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ erro: 'Grupo não encontrado.' });
      }

      await client.query('COMMIT');
      res.json({
        sucesso: true,
        dados,
        acao_dados: excluirDados ? 'excluidos' : 'desvinculados',
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/:id/compartilhamento', async (req, res) => {
  try {
    if (!(await podeVerGrupo(req.usuario, req.params.id))) {
      return res.status(403).json({ erro: 'Você não tem permissão para ver este grupo.' });
    }

    res.json(await resumoCompartilhamento(req.usuario.id, req.params.id));
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/:id/compartilhar-meus-dados', async (req, res) => {
  try {
    if (!(await podeGerenciarGrupo(req.usuario, req.params.id))) {
      return res.status(403).json({ erro: 'Você não tem permissão para compartilhar dados neste grupo.' });
    }

    const gastos = await query(
      `UPDATE gastos
       SET grupo_id = $1
       WHERE usuario_id = $2 AND tenant_id = $3 AND grupo_id IS DISTINCT FROM $1`,
      [req.params.id, req.usuario.id, req.usuario.tenant_id]
    );
    const receitas = await query(
      `UPDATE receitas
       SET grupo_id = $1
       WHERE usuario_id = $2 AND tenant_id = $3 AND grupo_id IS DISTINCT FROM $1`,
      [req.params.id, req.usuario.id, req.usuario.tenant_id]
    );

    res.json({
      sucesso: true,
      gastos: gastos.rowCount || 0,
      receitas: receitas.rowCount || 0,
      resumo: await resumoCompartilhamento(req.usuario.id, req.params.id),
    });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// Listar membros do grupo
router.get('/:id/membros', async (req, res) => {
  try {
    if (!(await podeVerGrupo(req.usuario, req.params.id))) {
      return res.status(403).json({ erro: 'Você não tem permissão para ver este grupo.' });
    }
    const result = await query(
      `SELECT u.id, u.nome, u.email, u.perfil, ug.permissao,
        ug.pode_ver_todos, ug.pode_editar, ug.pode_excluir
       FROM usuario_grupos ug
       JOIN usuarios u ON ug.usuario_id = u.id
       WHERE ug.grupo_id = $1 AND ug.tenant_id = $2 AND u.tenant_id = $2
       ORDER BY u.nome`,
      [req.params.id, req.usuario.tenant_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// Adicionar membro ao grupo
router.post('/:id/membros', async (req, res) => {
  const { usuario_id, permissao, pode_ver_todos, pode_editar, pode_excluir } = req.body;
  if (!usuario_id) return res.status(400).json({ erro: 'Usuário é obrigatório.' });
  try {
    if (!(await podeGerenciarGrupo(req.usuario, req.params.id))) {
      return res.status(403).json({ erro: 'Você não tem permissão para adicionar membros.' });
    }
    const usuarioAlvo = await query('SELECT id FROM usuarios WHERE id = $1 AND tenant_id = $2 AND ativo = 1', [usuario_id, req.usuario.tenant_id]);
    if (!usuarioAlvo.rows[0]) {
      return res.status(400).json({ erro: 'Usuário não pertence a esta conta.' });
    }
    await query(
      `INSERT INTO usuario_grupos (tenant_id, usuario_id, grupo_id, permissao, pode_ver_todos, pode_editar, pode_excluir)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (usuario_id, grupo_id) DO UPDATE SET
         permissao = $4, pode_ver_todos = $5, pode_editar = $6, pode_excluir = $7`,
      [
        req.usuario.tenant_id,
        usuario_id,
        req.params.id,
        normalizarPermissao(permissao),
        booleano(pode_ver_todos) ? 1 : 0,
        booleano(pode_editar) ? 1 : 0,
        booleano(pode_excluir) ? 1 : 0,
      ]
    );
    res.status(201).json({ sucesso: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// Remover membro do grupo
router.delete('/:id/membros/:usuarioId', async (req, res) => {
  try {
    if (!(await podeGerenciarGrupo(req.usuario, req.params.id))) {
      return res.status(403).json({ erro: 'Você não tem permissão para remover membros.' });
    }
    await query(
      'DELETE FROM usuario_grupos WHERE grupo_id = $1 AND usuario_id = $2 AND tenant_id = $3',
      [req.params.id, req.params.usuarioId, req.usuario.tenant_id]
    );
    res.json({ sucesso: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// Atualizar permissões do membro
router.put('/:id/membros/:usuarioId', async (req, res) => {
  const { permissao, pode_ver_todos, pode_editar, pode_excluir } = req.body;
  try {
    if (!(await podeGerenciarGrupo(req.usuario, req.params.id))) {
      return res.status(403).json({ erro: 'Você não tem permissão para atualizar membros.' });
    }
    const membro = await query(
      `SELECT ug.id
       FROM usuario_grupos ug
       JOIN usuarios u ON u.id = ug.usuario_id
       WHERE ug.grupo_id = $1 AND ug.usuario_id = $2 AND ug.tenant_id = $3 AND u.tenant_id = $3`,
      [req.params.id, req.params.usuarioId, req.usuario.tenant_id]
    );
    if (!membro.rows[0]) return res.status(404).json({ erro: 'Membro não encontrado neste grupo.' });

    await query(
      `UPDATE usuario_grupos SET permissao = $1, pode_ver_todos = $2, pode_editar = $3, pode_excluir = $4
       WHERE grupo_id = $5 AND usuario_id = $6 AND tenant_id = $7`,
      [
        normalizarPermissao(permissao),
        booleano(pode_ver_todos) ? 1 : 0,
        booleano(pode_editar) ? 1 : 0,
        booleano(pode_excluir) ? 1 : 0,
        req.params.id,
        req.params.usuarioId,
        req.usuario.tenant_id,
      ]
    );
    res.json({ sucesso: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;
