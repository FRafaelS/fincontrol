import API_URL from './api';
import React, { useState } from 'react';
import * as XLSX from 'xlsx';

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
  if (c.includes('desc') || c.includes('despesa')) return 'descricao';
  if (c.includes('parcela')) return 'parcela';
  if (c.includes('categ')) return 'categoria';
  if (c.includes('pgto') || c.includes('pagamento') || c.includes('forma')) return 'forma_pgto';
  if (c.includes('total')) return 'valor_total';
  if (c.includes('individual')) return 'valor_individual';
  if (c.includes('venc')) return 'data_venc';
  if (c === 'mes' || c === 'mês') return 'mes';
  if (c === 'ano') return 'ano';
  if (c.includes('status')) return 'status';
  if (c.includes('obs')) return 'obs';
  return '';
};
const converterDataExcel = (valor) => {
  if (!valor) return '';

  // Se já for string no formato DD/MM/AA ou DD/MM/YYYY, retorna como está
  if (typeof valor === 'string' && valor.includes('/')) return valor;

  // Se for número, converte de serial do Excel para data
  if (typeof valor === 'number') {
    // Excel conta dias desde 01/01/1900 (com bug do ano 1900)
    const data = new Date((valor - 25569) * 86400 * 1000);
    const dia = String(data.getUTCDate()).padStart(2, '0');
    const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
    const ano = String(data.getUTCFullYear()).slice(-2);
    return `${dia}/${mes}/${ano}`;
  }

  return String(valor);
};

function Importacao({ onVoltar }) {
  const [etapa, setEtapa] = useState('upload');
  const [colunas, setColunas] = useState([]);
  const [mapeamento, setMapeamento] = useState({});
  const [linhas, setLinhas] = useState([]);
  const [preview, setPreview] = useState([]);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erroArquivo, setErroArquivo] = useState('');

  const handleArquivo = (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    setErroArquivo('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const workbook = XLSX.read(evt.target.result, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const dados = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (dados.length === 0) {
          setErroArquivo('A planilha está vazia ou sem dados.');
          return;
        }

        const cols = Object.keys(dados[0]);
        const mapAuto = {};
        cols.forEach((c) => { mapAuto[c] = mapearAutomatico(c); });

        setColunas(cols);
        setMapeamento(mapAuto);
        setLinhas(dados);
        setEtapa('mapeamento');
      } catch {
        setErroArquivo('Erro ao ler o arquivo. Certifique-se que é um .xlsx ou .xls válido.');
      }
    };
    reader.readAsBinaryString(arquivo);
  };

  const handleMapeamento = (coluna, campo) => {
    setMapeamento((prev) => ({ ...prev, [coluna]: campo }));
  };

  const gerarPreview = () => {
  const registros = linhas.map((linha) => {
    const registro = {};
    Object.entries(mapeamento).forEach(([coluna, campo]) => {
      if (campo) {
        // Converte automaticamente campos de data
        if (campo === 'data_venc') {
          registro[campo] = converterDataExcel(linha[coluna]);
        } else {
          registro[campo] = linha[coluna];
        }
      }
    });
    return registro;
  });
  setPreview(registros);
  setEtapa('revisao');
};

  const confirmarImportacao = async () => {
    setImportando(true);
    let sucesso = 0;
    let erros = 0;
    const errosList = [];

    for (const registro of preview) {
      try {
        const res = await fetch(`${API_URL}/api/gastos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...registro,
            valor_total: parseFloat(registro.valor_total) || 0,
            valor_individual: parseFloat(registro.valor_individual) || 0,
            ano: parseInt(registro.ano) || new Date().getFullYear(),
            status: registro.status || 'PENDENTE',
          }),
        });
        const data = await res.json();
        if (data.erro) { erros++; errosList.push(data.erro); }
        else sucesso++;
      } catch {
        erros++;
        errosList.push(`Erro ao importar: ${registro.descricao}`);
      }
    }

    setResultado({ sucesso, erros, errosList });
    setImportando(false);
    setEtapa('resultado');
  };

  const reiniciar = () => {
    setEtapa('upload');
    setColunas([]);
    setMapeamento({});
    setLinhas([]);
    setPreview([]);
    setResultado(null);
    setErroArquivo('');
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '32px', maxWidth: '1100px', margin: '0 auto' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', margin: 0 }}>Importar Excel</h1>
        <button onClick={onVoltar} style={btnSecundario}>← Voltar</button>
      </div>

      {/* Etapas */}
      <div style={{ display: 'flex', marginBottom: '32px' }}>
        {['Upload', 'Mapeamento', 'Revisão', 'Resultado'].map((e, i) => {
          const etapas = ['upload', 'mapeamento', 'revisao', 'resultado'];
          const ativo = etapas[i] === etapa;
          const concluido = etapas.indexOf(etapa) > i;
          return (
            <div key={e} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                padding: '8px',
                background: concluido ? '#198754' : ativo ? '#0d6efd' : '#e9ecef',
                color: ativo || concluido ? '#fff' : '#6c757d',
                fontSize: '13px', fontWeight: '600',
                borderRadius: i === 0 ? '6px 0 0 6px' : i === 3 ? '0 6px 6px 0' : '0',
              }}>
                {concluido ? '✓ ' : ''}{e}
              </div>
            </div>
          );
        })}
      </div>

      {/* Etapa 1: Upload */}
      {etapa === 'upload' && (
        <div style={{ textAlign: 'center', padding: '48px', border: '2px dashed #dee2e6', borderRadius: '12px' }}>
          <p style={{ fontSize: '48px', margin: '0 0 16px' }}>📊</p>
          <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Selecione sua planilha</h2>
          <p style={{ color: '#666', marginBottom: '24px' }}>
            Formatos suportados: <strong>.xlsx</strong> e <strong>.xls</strong>
          </p>
          <label style={{
            background: '#0d6efd', color: '#fff', border: 'none',
            borderRadius: '6px', padding: '10px 24px', cursor: 'pointer', fontSize: '14px',
          }}>
            Escolher arquivo
            <input type="file" accept=".xlsx,.xls" onChange={handleArquivo} style={{ display: 'none' }} />
          </label>
          {erroArquivo && (
            <p style={{ color: '#dc3545', marginTop: '16px', fontSize: '14px' }}>{erroArquivo}</p>
          )}
          <div style={{ marginTop: '32px', background: '#f8f9fa', borderRadius: '8px', padding: '16px', textAlign: 'left' }}>
            <p style={{ margin: '0 0 8px', fontWeight: '600', fontSize: '14px' }}>Colunas sugeridas na planilha:</p>
            <code style={{ fontSize: '13px', color: '#666' }}>
              RESP | TIPO | DESCRICAO | PARCELA | CATEGORIA | FORMA_PGTO | VALOR_TOTAL | DATA_VENC | MES | ANO | STATUS | OBS
            </code>
          </div>
        </div>
      )}

      {/* Etapa 2: Mapeamento */}
      {etapa === 'mapeamento' && (
        <>
          <div style={{ background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
            <p style={{ margin: '0 0 4px', fontWeight: '600' }}>Planilha carregada!</p>
            <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
              {linhas.length} linha(s) · {colunas.length} coluna(s) detectada(s)
            </p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginBottom: '24px' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={th}>Coluna na planilha</th>
                <th style={th}>Exemplo de valor</th>
                <th style={th}>Campo no sistema</th>
              </tr>
            </thead>
            <tbody>
              {colunas.map((col) => (
                <tr key={col} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ ...td, fontWeight: '600' }}>{col}</td>
                  <td style={{ ...td, color: '#666' }}>{String(linhas[0]?.[col] || '—').substring(0, 40)}</td>
                  <td style={td}>
                    <select
                      style={{ ...input, margin: 0 }}
                      value={mapeamento[col] || ''}
                      onChange={(e) => handleMapeamento(col, e.target.value)}
                    >
                      {CAMPOS_SISTEMA.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={gerarPreview} style={btnPrimario}>Avançar para Revisão →</button>
            <button onClick={reiniciar} style={btnSecundario}>Recomeçar</button>
          </div>
        </>
      )}

      {/* Etapa 3: Revisão */}
      {etapa === 'revisao' && (
        <>
          <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
            <p style={{ margin: 0, fontWeight: '600', color: '#856404' }}>
              ⚠️ Revise os dados — {preview.length} registro(s) serão criados
            </p>
          </div>

          <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={th}>#</th>
                  {Object.values(mapeamento).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).map((campo) => (
                    <th key={campo} style={th}>
                      {CAMPOS_SISTEMA.find((c) => c.value === campo)?.label || campo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 20).map((reg, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ ...td, color: '#999' }}>{i + 1}</td>
                    {Object.values(mapeamento).filter(Boolean).filter((v, idx, a) => a.indexOf(v) === idx).map((campo) => (
                      <td key={campo} style={td}>{reg[campo] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 20 && (
              <p style={{ color: '#666', fontSize: '13px', padding: '8px 12px' }}>
                Mostrando 20 de {preview.length} registros...
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={confirmarImportacao} disabled={importando} style={{ ...btnPrimario, background: '#198754' }}>
              {importando ? 'Importando...' : `✓ Confirmar e importar ${preview.length} registro(s)`}
            </button>
            <button onClick={() => setEtapa('mapeamento')} style={btnSecundario}>← Voltar</button>
          </div>
        </>
      )}

      {/* Etapa 4: Resultado */}
      {etapa === 'resultado' && resultado && (
        <div style={{ textAlign: 'center', padding: '32px' }}>
          <p style={{ fontSize: '48px', margin: '0 0 16px' }}>{resultado.erros === 0 ? '🎉' : '⚠️'}</p>
          <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>
            {resultado.erros === 0 ? 'Importação concluída!' : 'Concluída com avisos'}
          </h2>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '24px' }}>
            <div style={{ background: '#d4edda', borderRadius: '8px', padding: '16px 32px' }}>
              <p style={{ margin: 0, fontSize: '32px', fontWeight: '700', color: '#155724' }}>{resultado.sucesso}</p>
              <p style={{ margin: 0, color: '#155724', fontSize: '14px' }}>importado(s)</p>
            </div>
            {resultado.erros > 0 && (
              <div style={{ background: '#f8d7da', borderRadius: '8px', padding: '16px 32px' }}>
                <p style={{ margin: 0, fontSize: '32px', fontWeight: '700', color: '#842029' }}>{resultado.erros}</p>
                <p style={{ margin: 0, color: '#842029', fontSize: '14px' }}>erro(s)</p>
              </div>
            )}
          </div>
          {resultado.errosList.length > 0 && (
            <div style={{ background: '#f8d7da', borderRadius: '8px', padding: '16px', marginBottom: '24px', textAlign: 'left' }}>
              {resultado.errosList.map((e, i) => (
                <p key={i} style={{ margin: '4px 0', fontSize: '13px', color: '#842029' }}>• {e}</p>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button onClick={onVoltar} style={btnPrimario}>← Ver gastos importados</button>
            <button onClick={reiniciar} style={btnSecundario}>Importar outro arquivo</button>
          </div>
        </div>
      )}
    </div>
  );
}

const th = { padding: '10px 12px', fontWeight: '600', borderBottom: '2px solid #ddd', textAlign: 'left' };
const td = { padding: '10px 12px' };
const input = { width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ced4da', fontSize: '14px', boxSizing: 'border-box' };
const btnPrimario = { background: '#0d6efd', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px' };
const btnSecundario = { background: '#6c757d', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px 16px', cursor: 'pointer', fontSize: '14px' };

export default Importacao;