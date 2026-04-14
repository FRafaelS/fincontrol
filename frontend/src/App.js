import React, { useEffect, useState } from 'react';
import API_URL from './api';

// 💰 Formatação de moeda
const formatarMoeda = (v) => {
  return Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
};

function App() {
  const [gastos, setGastos] = useState([]);
  const [erro, setErro] = useState(null);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem('token'); // ou de onde você pega

  useEffect(() => {
    const carregarGastos = async () => {
      try {
        setLoading(true);

        const res = await fetch(`${API_URL}/api/gastos`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!res.ok) {
          throw new Error(`Erro HTTP ${res.status}`);
        }

        const data = await res.json();

        // 🧠 Normaliza dados vindos do backend
        const dadosTratados = (data || []).map(g => ({
          ...g,
          valor_total: Number(g.valor_total),
          valor_individual: Number(g.valor_individual)
        }));

        setGastos(dadosTratados);
      } catch (err) {
        console.error('Erro ao carregar gastos:', err);
        setErro(err.message);
      } finally {
        setLoading(false);
      }
    };

    carregarGastos();
  }, [token]);

  // 🧱 Estado de loading
  if (loading) {
    return <div style={{ padding: 20 }}>Carregando gastos...</div>;
  }

  // 🚨 Estado de erro
  if (erro) {
    return <div style={{ padding: 20, color: 'red' }}>Erro: {erro}</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Controle de Gastos</h1>

      <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th>Descrição</th>
            <th>Categoria</th>
            <th>Responsável</th>
            <th>Valor Total</th>
            <th>Valor Individual</th>
          </tr>
        </thead>

        <tbody>
          {gastos.length === 0 ? (
            <tr>
              <td colSpan="5" style={{ textAlign: 'center' }}>
                Nenhum gasto encontrado
              </td>
            </tr>
          ) : (
            gastos.map((g) => (
              <tr key={g.id}>
                <td>{g.descricao || '-'}</td>
                <td>{g.categoria || '-'}</td>
                <td>{g.responsavel || '-'}</td>
                <td>{formatarMoeda(g.valor_total)}</td>
                <td>{formatarMoeda(g.valor_individual)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default App;