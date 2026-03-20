const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Gerar parcelas automaticamente
router.post('/gerar', (req, res) => {
  const {
    responsavel, tipo, descricao, categoria, forma_pgto,
    valor_total, valor_individual, total_parcelas,
    dia_vencimento, mes_inicial, ano_inicial,
    status, obs,
  } = req.body;

  if (!total_parcelas || total_parcelas < 2) {
    return res.status(400).json({ erro: 'Informe ao menos 2 parcelas.' });
  }

  const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
  const idxMesInicial = MESES.indexOf(mes_inicial.toUpperCase());

  if (idxMesInicial === -1) {
    return res.status(400).json({ erro: 'Mês inicial inválido.' });
  }

  const inserir = db.prepare(`
    INSERT INTO gastos (
      responsavel, tipo, descricao, parcela, categoria, forma_pgto,
      valor_total, valor_individual, data_venc, mes, ano, status, obs
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const gerarTodas = db.transaction(() => {
    const ids = [];
    for (let i = 0; i < total_parcelas; i++) {
      const idxMes = (idxMesInicial + i) % 12;
      const anosExtras = Math.floor((idxMesInicial + i) / 12);
      const anoAtual = parseInt(ano_inicial) + anosExtras;
      const mesAtual = MESES[idxMes];

      // Formata data DD/MM/AA
      const diaStr = String(dia_vencimento).padStart(2, '0');
      const mesNumStr = String(idxMes + 1).padStart(2, '0');
      const anoStr = String(anoAtual).slice(-2);
      const dataVenc = `${diaStr}/${mesNumStr}/${anoStr}`;

      const parcela = `${String(i + 1).padStart(2, '0')} DE ${String(total_parcelas).padStart(2, '0')}`;

      const result = inserir.run(
        responsavel, tipo, descricao, parcela, categoria, forma_pgto,
        valor_total, valor_individual, dataVenc, mesAtual, anoAtual,
        status || 'PENDENTE', obs
      );
      ids.push(result.lastInsertRowid);
    }
    return ids;
  });

  try {
    const ids = gerarTodas();
    res.status(201).json({ sucesso: true, total: ids.length, ids });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao gerar parcelas: ' + err.message });
  }
});

module.exports = router;