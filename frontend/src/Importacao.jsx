import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import API_URL from './api';

const CAMPOS_SISTEMA = [
  { value: '', label: '— Ignorar coluna —' },
  { value: 'responsavel', label: 'Responsável' },
  { value: 'tipo', label: 'Tipo (I/C)' },
  { value: 'descricao', label: 'Descrição' },
  { value: 'parcela', label: 'Parcela' },
  { value: 'categoria', label: 'Categoria' },
  { value: 'forma_pgto', label: 'Forma de Pagamento' },
  { value: 'valor_total', label: 'Valor Total' },
  { value: 'valor_individual', label: 'Valor Individual' },
  { value: 'data_venc', label: 'Data Vencimento' },
  { value: 'mes', label: 'Mês' },
  { value: 'ano', label: 'Ano' },
  { value: 'status', label: 'Status' },
  { value: 'obs', label: 'Observação' },
];

const mapearAutomatico = (coluna) => {
  const c = coluna.toLowerCase().trim();
  if (c.includes('resp')) return 'responsavel';
  if (c.includes('tipo')) return 'tipo';
  if (c.includes('desc')) return 'descricao';
  if (c.includes('parcela')) return 'parcela';
  if (c.includes('categ')) return 'categoria';
  if (c.includes('pgto') || c.includes('forma')) return 'forma_pgto';
  if (c.includes('total')) return 'valor_total';
  if (c.includes('individual')) return 'valor_individual';
  if (c.includes('venc')) return 'data_venc';
  if (c === 'mes' || c === 'mês') return 'mes';
  if (c === 'ano') return 'ano';
  if (c.includes('status')) return 'status';
  if (c.includes('obs')) return 'obs';
  return '';
};

// 💰 Conversão BR → número
const parseBR = (v) => {
  if (!v) return 0;
  return parseFloat(
    String(v)
      .replace(/\./g, '')
      .replace(',', '.')
  ) || 0;
};

// 📅 Converter data Excel
const converterDataExcel = (valor) => {
  if (!valor) return '';
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number') {
    const data = new Date((valor - 25569) * 86400 * 1000);
    const dia = String(data.getUTCDate()).padStart(2, '0');
    const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
    const ano = data.getUTCFullYear();
    return `${ano}-${mes}-${dia}`; // formato melhor
  }
  return '';
};

function Importacao({ onVoltar, token }) {
  const [etapa, setEtapa] = useState('upload');
  const [colunas, setColunas] = useState([]);
  const [mapeamento, setMapeamento] = useState({});
  const [linhas, setLinhas] = useState([]);
  const [preview, setPreview] = useState([]);
  const [resultado, setResultado] = useState(null);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const handleArquivo = (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const workbook = XLSX.read(evt.target.result, { type: 'binary' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const dados = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      const cols = Object.keys(dados[0] || {});
      const mapAuto = {};

      cols.forEach((c) => {
        mapAuto[c] = mapearAutomatico(c);
      });

      setColunas(cols);
      setMapeamento(mapAuto);
      setLinhas(dados);
      setEtapa('mapeamento');
    };

    reader.readAsBinaryString(arquivo);
  };

  const gerarPreview = () => {
    const registros = linhas.map((linha) => {
      const registro = {};

      Object.entries(mapeamento).forEach(([coluna, campo]) => {
        if (campo) {
          registro[campo] =
            campo === 'data_venc'
              ? converterDataExcel(linha[coluna])
              : linha[coluna];
        }
      });

      return registro;
    });

    console.log('Preview:', registros);

    setPreview(registros);
    setEtapa('revisao');
  };

  const confirmarImportacao = async () => {
    let sucesso = 0;
    let erros = 0;
    const errosList = [];

    for (const registro of preview) {
      try {
        // 🧠 Validação mínima
        if (!registro.descricao) {
          throw new Error('Registro sem descrição');
        }

        console.log('Enviando:', registro);

        const res = await fetch(`${API_URL}/api/gastos`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...registro,
            valor_total: parseBR(registro.valor_total),
            valor_individual: parseBR(registro.valor_individual),
            ano: parseInt(registro.ano) || new Date().getFullYear(),
            status: registro.status || 'PENDENTE',
          }),
        });

        // 🚨 TRATAMENTO REAL DE ERRO
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status} - ${text}`);
        }

        const data = await res.json();

        if (data.erro) {
          throw new Error(data.erro);
        }

        sucesso++;
      } catch (err) {
        erros++;
        errosList.push(`${registro.descricao || 'Sem descrição'} → ${err.message}`);
      }
    }

    setResultado({ sucesso, erros, errosList });
    setEtapa('resultado');
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Importar Excel</h1>

      {etapa === 'upload' && (
        <input type="file" accept=".xlsx,.xls" onChange={handleArquivo} />
      )}

      {etapa === 'mapeamento' && (
        <button onClick={gerarPreview}>Avançar</button>
      )}

      {etapa === 'revisao' && (
        <>
          <p>{preview.length} registros</p>
          <button onClick={confirmarImportacao}>Importar</button>
        </>
      )}

      {etapa === 'resultado' && resultado && (
        <>
          <h2>Resultado</h2>
          <p>Sucesso: {resultado.sucesso}</p>
          <p>Erros: {resultado.erros}</p>

          {resultado.errosList.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </>
      )}
    </div>
  );
}

export default Importacao;