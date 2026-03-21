const express = require('express');
const cors = require('cors');
const gastosRoutes = require('./routes/gastos');
const lookupsRoutes = require('./routes/lookups');
const parcelasRoutes = require('./routes/parcelas');
const authRoutes = require('./routes/auth');
const { autenticar } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/gastos',   autenticar, gastosRoutes);
app.use('/api/lookups',  autenticar, lookupsRoutes);
app.use('/api/parcelas', autenticar, parcelasRoutes);

app.get('/', (req, res) => {
  res.json({ mensagem: 'API FinControl funcionando!', versao: '1.0' });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});