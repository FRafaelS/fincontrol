const express = require('express');
const cors = require('cors');
const { inicializar } = require('./database/postgres');
const gastosRoutes = require('./routes/gastos');
const lookupsRoutes = require('./routes/lookups');
const parcelasRoutes = require('./routes/parcelas');
const authRoutes = require('./routes/auth');
const gruposRoutes = require('./routes/grupos');
const { autenticar } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/gastos',   autenticar, gastosRoutes);
app.use('/api/lookups',  autenticar, lookupsRoutes);
app.use('/api/parcelas', autenticar, parcelasRoutes);
app.use('/api/grupos',   autenticar, gruposRoutes);

app.get('/', (req, res) => res.json({ mensagem: 'API FinControl funcionando!', versao: '2.0' }));

app.get('/setup', async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const { query } = require('./database/postgres');
    const hash = bcrypt.hashSync('admin123', 10);
    await query(
      'INSERT INTO usuarios (nome, email, senha, perfil) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING',
      ['Administrador', 'admin@fincontrol.com', hash, 'ADMIN']
    );

    // Insere lookups padrão
    const lookups = [
      ['LOOKUP TYPE', 'CATEGORIA', 'Categoria de gasto', 'S'],
      ['LOOKUP TYPE', 'FORMA_PGTO', 'Forma de pagamento', 'S'],
      ['LOOKUP TYPE', 'RESPONSAVEL', 'Responsável pelo gasto', 'S'],
      ['LOOKUP TYPE', 'STATUS_GASTO', 'Status do gasto', 'S'],
      ['LOOKUP TYPE', 'TIPO_GASTO', 'Tipo do gasto', 'S'],
      ['LOOKUP TYPE', 'CONFIG_ALERTAS', 'Configurações de alertas', 'S'],
      ['CATEGORIA', 'ELETRONICOS', 'Eletrônicos', 'S'],
      ['CATEGORIA', 'SERVICOS', 'Serviços', 'S'],
      ['CATEGORIA', 'TRANSPORTE', 'Transporte', 'S'],
      ['CATEGORIA', 'ALIMENTACAO', 'Alimentação', 'S'],
      ['CATEGORIA', 'SAUDE', 'Saúde', 'S'],
      ['CATEGORIA', 'EDUCACAO', 'Educação', 'S'],
      ['CATEGORIA', 'LAZER', 'Lazer', 'S'],
      ['CATEGORIA', 'OUTROS', 'Outros', 'S'],
      ['FORMA_PGTO', 'CARTAO_BRADESCO', 'Cartão Bradesco', 'S'],
      ['FORMA_PGTO', 'CARTAO_NUBANK', 'Cartão Nubank', 'S'],
      ['FORMA_PGTO', 'PIX', 'Pix', 'S'],
      ['FORMA_PGTO', 'DINHEIRO', 'Dinheiro', 'S'],
      ['FORMA_PGTO', 'DEBITO', 'Débito', 'S'],
      ['RESPONSAVEL', 'Rafael Silva', 'R', 'S'],
      ['RESPONSAVEL', 'Diana Paula', 'D', 'S'],
      ['RESPONSAVEL', 'Rafael e Diana', 'RD', 'S'],
      ['STATUS_GASTO', 'Pendente', 'PENDENTE', 'S'],
      ['STATUS_GASTO', 'Pago', 'PAGO', 'S'],
      ['TIPO_GASTO', 'Individual', 'I', 'S'],
      ['TIPO_GASTO', 'Compartilhado', 'C', 'S'],
      ['CONFIG_ALERTAS', 'DIAS_ALERTA_VENCIMENTO', 'Dias de antecedência', 'S'],
    ];

    for (const [type, code, meaning, flag] of lookups) {
      await query(
        'INSERT INTO mdr_lookup (lookup_type, lookup_code, meaning, enabled_flag) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        [type, code, meaning, flag]
      );
    }

    res.json({ mensagem: 'Setup concluído! Admin e lookups criados.' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

inicializar().then(() => {
  app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
}).catch(err => {
  console.error('Erro ao inicializar banco:', err);
  process.exit(1);
});