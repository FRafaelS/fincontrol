const express = require('express');
const cors = require('cors');
const gastosRoutes = require('./routes/gastos');
const lookupsRoutes = require('./routes/lookups');
const parcelasRoutes = require('./routes/parcelas');
const authRoutes = require('./routes/auth');
const { autenticar } = require('./middleware/auth');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Rotas públicas
app.use('/api/auth', authRoutes);

// Rotas protegidas
app.use('/api/gastos',   autenticar, gastosRoutes);
app.use('/api/lookups',  autenticar, lookupsRoutes);
app.use('/api/parcelas', autenticar, parcelasRoutes);

app.get('/', (req, res) => {
  res.json({ mensagem: 'API FinControl funcionando!' });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});