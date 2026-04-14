import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import API_URL from './api';

const CAMPOS_SISTEMA = [
  { value: '', label: '— Ignorar —' },
  { value: 'responsavel', label: 'Responsável' },
  { value: 'tipo', label: 'Tipo' },
  { value: 'descricao', label: 'Descrição' },
  { value: 'parcela', label: 'Parcela' },
  { value: 'categoria', label: 'Categoria' },
  { value: 'forma_pgto', label: 'Forma Pagamento' },
  { value: 'valor_total', label: 'Valor Total' },
  { value: 'valor_individual', label: 'Valor Individual' },
  { value: 'data_venc', label: 'Data Vencimento' },
  { value: 'mes', label: 'Mês' },
  { value: 'ano', label: 'Ano' },
  { value: 'status', label: 'Status' },
  { value: 'obs', label: 'Observação' },
];

// 🧠 Auto mapeamento
const mapearAutomatico = (coluna) => {
  const c = coluna.toLowerCase();
  if (c.includes('resp')) return 'responsavel';
  if (c.includes('tipo')) return 'tipo';
  if (c.includes('desc')) return 'descricao';
  if (c.includes('parcela')) return 'parcela';
  if (c.includes('categ')) return 'categoria';
  if (c.includes('pgto')) return 'forma_pgto';
  if (c.includes('total')) return 'valor_total';
  if (c.includes('individual')) return 'valor_individual';
  if (c.includes('venc')) return 'data_venc';
  if (c.includes('mes')) return 'mes';
  if (c.includes('ano')) return 'ano';
  if (c.includes('status')) return 'status';
  if (c.includes('obs')) return 'obs';
  return '';
};

// 💰 Corrige número BR
const parseBR = (v) => {
  if (!v) return 0;
  return parseFloat(
    String(v)
      .replace(/\./g, '')
      .replace(',', '.')
  ) || 0;
};

// 📅 Data Excel
const converterDataExcel = (valor) => {
  if (!valor) return '';
  if (typeof valor === 'string') return valor;

  const data = new Date((valor - 25569) * 86400 * 1000);
  return data.toISOString().split('T')[0];
};

function Importacao({ token, onVoltar }) {
  const [etapa, setEtapa] = useState('upload');
  const [colunas, setColunas] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [mapeamento, setMapeamento] = useState({});
  const [preview, setPreview] = useState([]);
  const [resultado, setResultado] = useState(null);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // =========================
  // 📂 Upload arquivo
  // =========================
  const handleArquivo = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (evt) => {
      const workbook = XLSX.read(evt.target.result, { type: 'binary' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const dados = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (!dados.length) {
        alert('Planilha vazia');
        return;
      }

      const cols = Object.keys(dados[0]);
      const mapAuto = {};

      cols.forEach((c) => {
        mapAuto[c] = mapearAutomatico(c);
      });

      setColunas(cols);
      setLinhas(dados);
      setMapeamento(mapAuto);
      setEtapa('mapeamento');
    };

    reader.readAsBinaryString(file);
  };

  // =========================
  // 👀 Gerar preview
  // =========================
  const gerarPreview = () => {
    const dadosPreview = linhas.map((linha) => {
      const registro = {};

      Object.entries(mapeamento).forEach(([col, campo]) => {
        if (!campo) return;

        let valor = linha[col];

        if (campo === 'valor_total' || campo === 'valor_individual') {
          valor = parseBR(valor);
        }

        if (campo === 'data_venc') {
          valor = converterDataExcel(valor);
        }

        registro[campo] = valor;
      });

      return registro;
    });

    setPreview(dadosPreview);
    setEtapa('revisao');
  };

  // =========================
  // 🚀 Importar
  // =========================
  const importar = async () => {
    let sucesso = 0;
    let erros = 0;
    const errosList = [];

    for (const reg of preview) {
      try {
        if (!reg.descricao) throw new Error('Sem descrição');

        const res = await fetch(`${API_URL}/api/gastos`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...reg,
            valor_total: Number(reg.valor_total || 0),
            valor_individual: Number(reg.valor_individual || 0),
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text);
        }

        sucesso++;
      } catch (err) {
        erros++;
        errosList.push(`${reg.descricao || 'Linha'} → ${err.message}`);
      }
    }

    setResultado({ sucesso, erros, errosList });
    setEtapa('resultado');
  };

  // =========================
  // 🖥️ Render
  // =========================
  return (
    <div style={{ padding: 20 }}>
      <h1>Importação de Gastos</h1>

      {etapa === 'upload' && (
        <>
          <input type="file" accept=".xlsx,.xls" onChange={handleArquivo} />
        </>
      )}

      {etapa === 'mapeamento' && (
        <>
          <h3>Mapeamento</h3>
          {colunas.map((col) => (
            <div key={col}>
              <label>{col}</label>
              <select
                value={mapeamento[col] || ''}
                onChange={(e) =>
                  setMapeamento({ ...mapeamento, [col]: e.target.value })
                }
              >
                {CAMPOS_SISTEMA.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          ))}

          <button onClick={gerarPreview}>Avançar</button>
        </>
      )}

      {etapa === 'revisao' && (
        <>
          <h3>Preview ({(preview || []).length} registros)</h3>
          <button onClick={importar}>Confirmar Importação</button>
        </>
      )}

      {etapa === 'resultado' && resultado && (
        <>
          <h3>Resultado</h3>
          <p>Sucesso: {resultado.sucesso}</p>
          <p>Erros: {resultado.erros}</p>

          {(resultado.errosList || []).map((e, i) => (
            <p key={i}>{e}</p>
          ))}

          <button onClick={onVoltar}>Voltar</button>
        </>
      )}
    </div>
  );
}

export default Importacao;