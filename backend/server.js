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
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
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
// Rota temporária de setup — remover após uso
app.get('/setup', (req, res) => {
  try {
    const db = require('./database/db');
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT OR IGNORE INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)')
      .run('Administrador', 'admin@fincontrol.com', hash, 'ADMIN');
    res.json({ mensagem: 'Usuário admin criado com sucesso!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});