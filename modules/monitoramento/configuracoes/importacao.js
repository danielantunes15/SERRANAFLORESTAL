// ==========================================
// js/configuracoes/importacao.js (MAESTRO CENTRAL)
// ==========================================

// =========================================================================
// FUNÇÕES UTILITÁRIAS GLOBAIS
// =========================================================================
window.obterDataHoraLocal = function() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

window.timeParaDecimal = function(timeStr) {
    if (!timeStr) return 0;
    const str = String(timeStr).trim();
    const parts = str.split(':');
    if (parts.length >= 2) {
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        return h + (m / 60);
    }
    const num = parseFloat(str.replace(',', '.'));
    return isNaN(num) ? 0 : num;
};

window.parseTime = function(timeStr) {
    if (!timeStr) return null;
    const val = parseFloat(timeStr);
    if (!isNaN(val) && val < 1) {
        const totalMinutes = Math.round(val * 24 * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    const match = String(timeStr).match(/(\d{1,2}):(\d{2})/);
    return match ? `${String(match[1]).padStart(2, '0')}:${match[2]}` : null;
};

window.parseNumero = function(valor) {
    if (valor === undefined || valor === null || valor === '') return null;
    if (typeof valor === 'number') return valor;
    let str = String(valor).trim().replace(/\./g, '').replace(',', '.');
    return parseFloat(str) || null;
};

// =========================================================================
// 1. IMPORTAÇÃO BRACELL (SÃO PAULO - FILIAL 5)
// =========================================================================
window.processarImportacaoBracell = async function(input) {
    let file = null;
    if (input instanceof File) file = input;
    else if (input && input.target && input.target.files) file = input.target.files[0];
    
    if (!file) return;

    const errorMsgDiv = document.getElementById('errorMsgBracell');
    const loadingSpinner = document.getElementById('loadingSpinnerBracell');
    
    if (errorMsgDiv) errorMsgDiv.classList.add('hidden'); 
    if (loadingSpinner) { loadingSpinner.classList.remove('hidden'); loadingSpinner.classList.add('flex'); }

    if (typeof XLSX === 'undefined') {
        if(errorMsgDiv) {
            errorMsgDiv.innerText = "A biblioteca Excel (XLSX) não está carregada.";
            errorMsgDiv.classList.remove('hidden');
        } else {
            alert("A biblioteca Excel (XLSX) não está carregada.");
        }
        if (loadingSpinner) { loadingSpinner.classList.add('hidden'); loadingSpinner.classList.remove('flex'); }
        return;
    }

    const formatarDataExcel = (valor) => {
        if (valor === undefined || valor === null || valor === '') return null;
        if (typeof valor === 'number') {
            const dateObj = XLSX.SSF.parse_date_code(valor);
            const d = String(dateObj.d).padStart(2, '0');
            const m = String(dateObj.m).padStart(2, '0');
            const y = dateObj.y;
            const h = String(dateObj.H).padStart(2, '0');
            const min = String(dateObj.M).padStart(2, '0');
            return `${d}/${m}/${y} ${h}:${min}`;
        }
        return String(valor).trim();
    };

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            let dadosCompletosParaSalvar = [];
            const abas = ['SP', 'MG'];

            abas.forEach(nomeAba => {
                if (workbook.SheetNames.includes(nomeAba)) {
                    const worksheet = workbook.Sheets[nomeAba];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null });

                    jsonData.forEach(row => {
                        if (!row['Ordem de busca'] || !row['Equipamento cavalo']) return;

                        const ordemStr = String(row['Ordem de busca']).trim();
                        const cavaloStr = String(row['Equipamento cavalo']).trim();
                        const chaveUnica = `${ordemStr}_${cavaloStr}`;
                        
                        const dataChegadaStr = formatarDataExcel(row['Data chegada balança']);
                        const dataBaseExcel = dataChegadaStr ? dataChegadaStr.split(' ')[0] : 'Desconhecida';

                        const registro = {
                            movimento: `MOV-SP-${chaveUnica}`,
                            dataLancamento: new Date().toLocaleDateString('pt-PT'),
                            dataDaBaseExcel: dataBaseExcel,
                            placa: cavaloStr,
                            transportadora: row['Fornecedor'] ? String(row['Fornecedor']).trim() : 'BRACELL',
                            
                            pesoLiquido: window.parseNumero(row['Peso Liquido']),
                            peso_na_entrada: window.parseNumero(row['Peso bruto']), 
                            volumeReal: window.parseNumero(row['Volume']),
                            distanciaAsfalto: window.parseNumero(row['Distancia Asfalto']),
                            distanciaTerra: window.parseNumero(row['Distancia Chão']),
                            
                            ordem_busca: ordemStr,
                            ctm: row['CTM'] ? String(row['CTM']).trim() : null,
                            nota_fiscal: row['Nota Fiscal'] ? String(row['Nota Fiscal']).trim() : null,
                            data_chegada_balanca: dataChegadaStr,
                            data_saida_patio: formatarDataExcel(row['Data saida patio']),
                            tipo_conjunto: row['Tipo de conjunto'] ? String(row['Tipo de conjunto']).trim() : null,
                            fornecedor: row['Fornecedor'] ? String(row['Fornecedor']).trim() : null,
                            equipamento_cavalo: cavaloStr,
                            peso_bruto: window.parseNumero(row['Peso bruto']), 
                            tara: window.parseNumero(row['Tara']),
                            projeto: row['Projeto'] ? String(row['Projeto']).trim() : null,
                            talhao: row['Talhão'] ? String(row['Talhão']).trim() : null,
                            distancia_total: window.parseNumero(row['Distancia Total']),
                            regional: row['Regional'] ? String(row['Regional']).trim() : null,
                            cte: row['CTE'] ? String(row['CTE']).trim() : null,
                            chave_acesso: row['Chave de acesso'] ? String(row['Chave de acesso']).trim() : null,
                            valor_cte: window.parseNumero(row['VALOR DO CTE']),
                            
                            filial_id: 5,
                            chave_unica: chaveUnica
                        };

                        dadosCompletosParaSalvar.push(registro);
                    });
                }
            });

            if (dadosCompletosParaSalvar.length === 0) {
                throw new Error('Nenhum dado válido encontrado nas abas "SP" ou "MG".');
            }

            const chavesExcel = dadosCompletosParaSalvar.map(r => r.chave_unica);
            let chavesJaNoBanco = new Set();
            
            const queryBatchSize = 1000;
            for (let i = 0; i < chavesExcel.length; i += queryBatchSize) {
                const loteChaves = chavesExcel.slice(i, i + queryBatchSize);
                const { data: dadosBanco, error: errBusca } = await window.supabaseClient
                    .from('historico_viagens')
                    .select('chave_unica')
                    .in('chave_unica', loteChaves);

                if (errBusca) throw errBusca;
                if (dadosBanco) {
                    dadosBanco.forEach(d => chavesJaNoBanco.add(d.chave_unica));
                }
            }

            const registrosNovos = dadosCompletosParaSalvar.filter(r => !chavesJaNoBanco.has(r.chave_unica));
            const qtdRepetidos = dadosCompletosParaSalvar.length - registrosNovos.length;

            if (registrosNovos.length > 0) {
                const insertBatchSize = 1000;
                for (let i = 0; i < registrosNovos.length; i += insertBatchSize) {
                    const loteInsert = registrosNovos.slice(i, i + insertBatchSize);
                    const { error: errInsert } = await window.supabaseClient
                        .from('historico_viagens')
                        .insert(loteInsert);
                    if (errInsert) throw errInsert;
                }

                const dataLocalExata = window.obterDataHoraLocal();
                const usuarioLogado = window.currentUser ? (window.currentUser.nome_completo || window.currentUser.username) : 'Sistema';
                const filialLogada = (window.currentUser && window.currentUser.filial_id !== null && window.currentUser.filial_id !== undefined) 
                                     ? String(window.currentUser.filial_id) 
                                     : null;

                await window.supabaseClient.from('historico_importacoes').insert([{
                    dataLancamento: dataLocalExata,
                    dataBase: 'Viagens Bracell (SP/MG)',
                    qtdViagens: registrosNovos.length,
                    usuario: usuarioLogado,
                    filial_id: filialLogada
                }]);

                if(typeof window.carregarHistoricoImportacoes === 'function') {
                    window.carregarHistoricoImportacoes();
                }
            }

            if (typeof Swal !== 'undefined') {
                if (registrosNovos.length === 0) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Atenção: Nenhuma viagem nova!',
                        html: `A planilha contém <b>${dadosCompletosParaSalvar.length}</b> viagens, mas <b>todas</b> já haviam sido importadas anteriormente.<br><br><span style="color:#94a3b8; font-size:13px;">Nada foi adicionado ao banco.</span>`,
                        background: '#1e293b',
                        color: '#f8fafc'
                    });
                } else if (qtdRepetidos > 0) {
                    Swal.fire({
                        icon: 'info',
                        title: 'Importação Parcial',
                        html: `<span style="color:#10b981; font-weight:bold; font-size:16px;">${registrosNovos.length} novas viagens cadastradas.</span><br><br><span style="color:#ef4444; font-size:13px;">Atenção: ${qtdRepetidos} linhas da planilha foram ignoradas porque já existiam no sistema.</span>`,
                        background: '#1e293b',
                        color: '#f8fafc'
                    });
                } else {
                    Swal.fire({
                        icon: 'success',
                        title: 'Sucesso!',
                        text: `${registrosNovos.length} registros enviados com sucesso.`,
                        background: '#1e293b',
                        color: '#f8fafc'
                    });
                }
            } else {
                if (registrosNovos.length === 0) alert(`Aviso: Todas as ${dadosCompletosParaSalvar.length} viagens já existiam no banco.`);
                else if (qtdRepetidos > 0) alert(`Foram salvas ${registrosNovos.length} novas viagens.\n${qtdRepetidos} linhas repetidas foram ignoradas.`);
                else alert(`Sucesso! ${registrosNovos.length} viagens importadas.`);
            }

        } catch (err) {
            console.error("Erro na importação Bracell:", err);
            if (errorMsgDiv) {
                errorMsgDiv.innerText = "Erro: " + err.message;
                errorMsgDiv.classList.remove('hidden');
            } else {
                alert("Erro: " + err.message);
            }
        } finally {
            if (loadingSpinner) { loadingSpinner.classList.add('hidden'); loadingSpinner.classList.remove('flex'); }
            if (input && input.target) {
                input.target.value = "";
            }
        }
    };

    reader.readAsArrayBuffer(file);
};

// =========================================================================
// 2. IMPORTAÇÃO DE JORNADAS DE PONTO
// =========================================================================
window.processAndSaveJornadasFile = async function(file) {
    const errorMsgDiv = document.getElementById('errorMsgJornadas');
    const loadingSpinner = document.getElementById('loadingSpinnerJornadas');
    if (errorMsgDiv) errorMsgDiv.classList.add('hidden'); 
    if (loadingSpinner) { loadingSpinner.classList.remove('hidden'); loadingSpinner.classList.add('flex'); }

    try {
        const text = await file.text();
        const workbook = XLSX.read(text, { type: 'string', raw: true, FS: ';' }); 
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        if (!rawData || rawData.length === 0) throw new Error("Planilha vazia ou em formato incorreto.");

        const calcularSemanaImportacao = (dataString) => {
            if (!dataString) return '-';
            const match = dataString.match(/(\d{1,2})/);
            if (!match) return '-';
            const dia = parseInt(match[1]);
            const semana = Math.ceil(dia / 7);
            return `${semana}ª Semana`;
        };

        const mappedData = rawData.map(row => {
            const getVal = (possibleNames) => {
                for (let k of Object.keys(row)) {
                    const normK = k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                    if (possibleNames.includes(normK)) return row[k];
                }
                return null;
            };

            const motorista = getVal(['pessoa', 'motorista', 'nome']);
            if (!motorista || String(motorista).trim() === '-' || String(motorista).trim() === '') return null;
            
            const totalHoras = window.timeParaDecimal(getVal(['total de trabalho', 'total trabalho', 'tempo de trabalho']));
            
            const colDataExtra = getVal(['data', 'data da jornada', 'data inicial', 'data do movimento']);
            let strInicio = String(getVal(['início', 'inicio']) || '').trim();
            let strFim = String(getVal(['fim', 'final']) || '').trim();

            if (colDataExtra) {
                const dataLimpa = String(colDataExtra).trim();
                if (strInicio && !strInicio.match(/(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{1,2}-\d{1,2})/)) strInicio = `${dataLimpa} ${strInicio}`;
                if (strFim && !strFim.match(/(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{1,2}-\d{1,2})/)) strFim = `${dataLimpa} ${strFim}`;
            }

            return {
                motorista: String(motorista).trim(),
                cpf: getVal(['cpf']) || '',
                placa: getVal(['placa', 'placa do cavalo', 'veiculo', 'veículo']) || '',
                inicio: strInicio,
                fim: strFim,
                total_trabalho_horas: totalHoras,
                refeicao_horas: window.timeParaDecimal(getVal(['refeição', 'refeicao'])),
                repouso_horas: window.timeParaDecimal(getVal(['repouso'])),
                direcao_horas: window.timeParaDecimal(getVal(['direção', 'direcao'])),
                estourou_jornada: totalHoras > 12,
                horas_noturnas: window.timeParaDecimal(getVal(['noturnas', 'noturna', 'horas noturnas'])),
                horas_extras: window.timeParaDecimal(getVal(['extra normal', 'extranormal'])) + window.timeParaDecimal(getVal(['extra excedente', 'extraexcedente'])),
                eps: 'SERRANALOG',
                unidade: 'GERAL',
                semana: calcularSemanaImportacao(strInicio),
                filial_id: window.currentUser ? window.currentUser.filial_id : null
            };
        }).filter(item => {
            if (item === null || item.motorista === '' || item.total_trabalho_horas < 8) return false;
            if (typeof MOTORISTAS_EXCLUIDOS !== 'undefined' && MOTORISTAS_EXCLUIDOS.includes(item.motorista.toUpperCase())) return false;
            return true;
        });

        if(mappedData.length === 0) throw new Error("Nenhuma jornada válida foi encontrada.");

        let existingJornadas = [];
        let startJor = 0; const stepJor = 1000;
        while (true) {
            let queryJor = window.supabaseClient.from('historico_jornadas').select('motorista, inicio, fim').range(startJor, startJor + stepJor - 1);
            if (typeof window.aplicarFiltroFilial === 'function') queryJor = window.aplicarFiltroFilial(queryJor); 
            
            const { data, error: selErr } = await queryJor;
            if (selErr) throw selErr;
            if (!data || data.length === 0) break;
            existingJornadas.push(...data);
            if (data.length < stepJor) break;
            startJor += stepJor;
        }

        const chavesExistentes = new Set(existingJornadas.map(j => `${j.motorista}|${j.inicio}|${j.fim}`));
        let duplicadasIgnoradas = 0;
        const jornadasNovas = mappedData.filter(item => {
            const chaveUnica = `${item.motorista}|${item.inicio}|${item.fim}`;
            if (chavesExistentes.has(chaveUnica)) { duplicadasIgnoradas++; return false; } 
            else { chavesExistentes.add(chaveUnica); return true; }
        });

        if (jornadasNovas.length === 0) throw new Error(`Todas as jornadas já existem. (${duplicadasIgnoradas} duplicadas ignoradas).`);

        const { error: insErr } = await window.supabaseClient.from('historico_jornadas').insert(jornadasNovas);
        if (insErr) throw insErr;

        await window.supabaseClient.from('historico_importacoes').insert([{
            "dataBase": `Jornadas Ponto`,
            "qtdViagens": jornadasNovas.length,
            "dataLancamento": new Date().toLocaleString('pt-PT'),
            "filial_id": window.currentUser ? window.currentUser.filial_id : null,
            "usuario": window.currentUser ? (window.currentUser.nome_completo || window.currentUser.username) : 'Sistema'
        }]);
        
        alert(`Sucesso! Salvas ${jornadasNovas.length} NOVAS jornadas.`);
        if (typeof carregarHistoricoImportacoes === 'function') carregarHistoricoImportacoes(); 
        
    } catch (err) {
        if(errorMsgDiv) { errorMsgDiv.innerText = "Erro: " + err.message; errorMsgDiv.classList.remove('hidden'); } 
        else alert("Erro: " + err.message);
    } finally {
        if(loadingSpinner) { loadingSpinner.classList.add('hidden'); loadingSpinner.classList.remove('flex'); }
    }
};

// =========================================================================
// 3. IMPORTAÇÃO GENÉRICA (SUZANO/LINHARES/ETC)
// =========================================================================
function parseSheetToData(sheet) {
    const rawData = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    if (!rawData || rawData.length === 0) throw new Error("Planilha vazia.");

    // Detecta dinamicamente se o usuário está acessando a filial de Linhares (ID 7)
    const isLinhares = (window.currentUser && String(window.currentUser.filial_id) === '7');

    const normKeys = Object.keys(rawData[0]).map(k => ({ orig: k, norm: typeof normalizeStr === 'function' ? normalizeStr(k) : k.toLowerCase() }));
    function findKey(possibilities) {
        for (let p of possibilities) { 
            const normP = typeof normalizeStr === 'function' ? normalizeStr(p) : p.toLowerCase(); 
            let found = normKeys.find(k => k.norm === normP || k.norm.includes(normP)); 
            if (found) return found.orig; 
        }
        return null;
    }

    // MAPEAMENTO INTELIGENTE DAS COLUNAS (Adapta as chaves baseadas na Filial)
    const movimentoKey = findKey(['movimento', 'id_movimento']);
    const transpKey = findKey(['transportadora', 'nome da transportadora']);
    const placaKey = findKey(['placa do cavalo', 'placa cavalo', 'placa']);
    const upKey = findKey(['up', 'u.p', 'u.p.', 'unidade de producao', 'unidade de produção', 'código up', 'codigo up']);
    
    // As colunas abaixo alteram o dicionário de busca se o usuário for Filial 7 (Linhares)
    const pesoLiqKey = findKey(isLinhares ? ['líquido', 'liquido'] : ['peso liquido', 'peso líquido', 'peso_liquido']); 
    const pesoBrutoKey = findKey(isLinhares ? ['peso entr'] : ['Peso na Entrada', 'peso na entrada', 'peso bruto', 'pbtc']); 
    const volumeKey = findKey(isLinhares ? ['vol real'] : ['volume real', 'volume_real', 'volume']);
    const gruaKey = findKey(isLinhares ? ['carreg.fl.', 'carreg fl'] : ['carregador florestal', 'carregador', 'grua']); 
    
    const dtSaidaBaseKey = findKey(isLinhares ? ['dtsaídafáb', 'dtsaidafab'] : ['data de saída', 'data saída', 'data saída fábrica']);
    const dtSaidaFabKey = findKey(isLinhares ? ['dtsaídafáb', 'dtsaidafab'] : ['data saída fábrica', 'data saida fabrica', 'data de saída', 'data saída']);
    const hrSaidaFabKey = findKey(isLinhares ? ['hrsaídafab', 'hrsaidafab'] : ['hora saída fábrica', 'hora saida fabrica', 'hora saída', 'hora saida']);
    
    const dtFimDescarFabKey = findKey(isLinhares ? ['dtfimdesfb'] : ['dt fim descar fáb', 'dt fim descar fab']);
    const hrFimDescarFabKey = findKey(isLinhares ? ['hrfimdesfb'] : ['hr fim descar fáb', 'hr fim descar fab']);

    const dtInicioCarregCpoKey = findKey(isLinhares ? ['dtinicarcp'] : ['dt início carreg cpo', 'dt inicio carreg cpo', 'data inicio carregamento']);
    const hrInicioCarregCpoKey = findKey(isLinhares ? ['hrinicarcp'] : ['hr início carreg cpo', 'hr inicio carreg cpo', 'hora inicio carregamento']);
    const dtFimCarregCpoKey = findKey(isLinhares ? ['dtfimcarcp'] : ['dt final carreg cpo', 'dt fim carreg cpo', 'data final carregamento']);
    const hrFimCarregCpoKey = findKey(isLinhares ? ['hrfimcarcp'] : ['hr final carreg cpo', 'hr fim carreg cpo', 'hora final carregamento']);

    const dtChegadaCampoKey = findKey(isLinhares ? ['dtcheg.cpo', 'dtcheg cpo'] : ['data chegada campo', 'dt chegada campo']);
    const hrChegadaCampoKey = findKey(isLinhares ? ['hrcheg.cpo', 'hrcheg cpo'] : ['hora chegada campo', 'hr chegada campo']);
    
    const dtSaidaCampoKey = findKey(isLinhares ? ['dtsaídacpo', 'dtsaidacpo'] : ['data saída campo', 'data saida campo', 'dt saida campo']);
    const hrSaidaCampoKey = findKey(isLinhares ? ['hrsaídacpo', 'hrsaidacpo'] : ['hora saída campo', 'hora saida campo', 'hr saida campo']);

    const dtEntradaFabKey = findKey(isLinhares ? ['data entr'] : ['data de entrada', 'dt entrada']);
    const hrEntradaFabKey = findKey(isLinhares ? ['hora entr'] : ['hora de entrada', 'hr entrada']);
    const dtInicioDescarFabKey = findKey(isLinhares ? ['dtinidesfb'] : ['dt início descar fáb', 'dt inicio descar fab']);
    const hrInicioDescarFabKey = findKey(isLinhares ? ['hrinidesfb'] : ['hr início descar fáb', 'hr inicio descar fab']);
    
    const distAsfaltoKey = findKey(isLinhares ? ['dist asfal'] : ['distancia por asfalto', 'distância por asfalto', 'distancia asfalto']);
    const distTerraKey = findKey(isLinhares ? ['dist terra'] : ['distancia por terra', 'distância por terra', 'distancia terra']);

    const mappedData = rawData.map((row, idx) => {
        const getValue = (key) => (key && row[key] !== undefined && row[key] !== "") ? row[key] : null;
        
        let rawDtSaida;
        let rawHrSaida;

        // ISOLAMENTO DE REGRA: Prioriza DtFimDesFb apenas para filial Linhares (ID 7)
        if (isLinhares) {
            rawDtSaida = getValue(dtFimDescarFabKey) || getValue(dtSaidaBaseKey) || getValue(dtSaidaFabKey);
            rawHrSaida = getValue(hrFimDescarFabKey) || getValue(hrSaidaFabKey);
        } else {
            rawDtSaida = getValue(dtSaidaBaseKey) || getValue(dtSaidaFabKey);
            rawHrSaida = getValue(hrSaidaFabKey);
        }

        let strDataBase = 'Desconhecida';

        if (rawDtSaida && typeof parseDateTime === 'function') {
            const parsed = parseDateTime(rawDtSaida, rawHrSaida);
            if (parsed) strDataBase = parsed.toLocaleDateString('pt-PT');
        }

        const getSafeDate = (key) => {
            const d = getValue(key);
            return (d !== null && d !== undefined && d !== "" && String(d).trim() !== "-") ? d : rawDtSaida; 
        };

        const formatDbDate = (val) => {
            if (val === null || val === undefined || val === "") return null;
            if (String(val).trim() === "-") return null;
            const d = typeof parseDateTime === 'function' ? parseDateTime(val, null) : null;
            return d ? d.toLocaleDateString('pt-PT') : String(val);
        };

        const formatDbTime = (val) => {
            if (val === null || val === undefined || val === "") return null;
            if (typeof val === 'number') {
                let fraction = val % 1;
                if (fraction < 0) fraction += 1;
                let totalSeconds = Math.round(fraction * 24 * 3600);
                let hours = Math.floor(totalSeconds / 3600);
                let minutes = Math.floor((totalSeconds % 3600) / 60);
                let seconds = totalSeconds % 60;
                return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
            if (String(val).trim() === "-") return null;
            return String(val);
        };

        const parserNum = typeof parsePtBrNumber === 'function' ? parsePtBrNumber : (v) => parseFloat(String(v).replace(',','.')) || 0;
        const calcHr = typeof calcHoursDiff === 'function' ? calcHoursDiff : () => 0;

        const valorPesoLiquido = parserNum(getValue(pesoLiqKey)); 
        const valorPesoBruto = parserNum(getValue(pesoBrutoKey)); 
        const valorVolumeReal = parserNum(getValue(volumeKey));
        
        let calculoRpv = null;
        if (valorPesoLiquido > 0 && valorVolumeReal > 0) {
            let resultadoDivisao = valorPesoLiquido / valorVolumeReal;
            calculoRpv = Number(resultadoDivisao.toFixed(2));
        }

        return {
            movimento: String(getValue(movimentoKey) || `MOV-GEN-${Date.now()}-${idx}`),
            dataDaBaseExcel: strDataBase,
            dataLancamento: new Date().toLocaleDateString('pt-PT'),
            transportadora: String(getValue(transpKey) || "Outras").trim(),
            placa: String(getValue(placaKey) || "-").trim(),
            
            pesoLiquido: valorPesoLiquido,
            peso_na_entrada: valorPesoBruto,
            volumeReal: valorVolumeReal,
            rpv: calculoRpv,
            
            grua: String(getValue(gruaKey) || "-").trim(),
            up: String(getValue(upKey) || "-").trim(),
            distanciaAsfalto: parserNum(getValue(distAsfaltoKey)),
            distanciaTerra: parserNum(getValue(distTerraKey)),
            
            cicloHoras: calcHr(getSafeDate(dtSaidaFabKey), getValue(hrSaidaFabKey), getSafeDate(dtFimDescarFabKey), getValue(hrFimDescarFabKey)),
            tempoCarregamentoHoras: calcHr(getSafeDate(dtInicioCarregCpoKey), getValue(hrInicioCarregCpoKey), getSafeDate(dtFimCarregCpoKey), getValue(hrFimCarregCpoKey)),
            filaCampoHoras: calcHr(getSafeDate(dtChegadaCampoKey), getValue(hrChegadaCampoKey), getSafeDate(dtInicioCarregCpoKey), getValue(hrInicioCarregCpoKey)),
            filaFabricaHoras: calcHr(getSafeDate(dtEntradaFabKey), getValue(hrEntradaFabKey), getSafeDate(dtInicioDescarFabKey), getValue(hrInicioDescarFabKey)),
            cicloCampoHoras: calcHr(getSafeDate(dtChegadaCampoKey), getValue(hrChegadaCampoKey), getSafeDate(dtSaidaCampoKey), getValue(hrSaidaCampoKey)),

            dtSaidaFabrica: formatDbDate(getValue(dtSaidaFabKey)),
            hrSaidaFabrica: formatDbTime(getValue(hrSaidaFabKey)),
            dtFimDescarFabrica: formatDbDate(getValue(dtFimDescarFabKey)),
            hrFimDescarFabrica: formatDbTime(getValue(hrFimDescarFabKey)),
            dtInicioCarregCampo: formatDbDate(getValue(dtInicioCarregCpoKey)),
            hrInicioCarregCampo: formatDbTime(getValue(hrInicioCarregCpoKey)),
            dtFimCarregCampo: formatDbDate(getValue(dtFimCarregCpoKey)),
            hrFimCarregCampo: formatDbTime(getValue(hrFimCarregCpoKey)),
            dtChegadaCampo: formatDbDate(getValue(dtChegadaCampoKey)),
            hrChegadaCampo: formatDbTime(getValue(hrChegadaCampoKey)),
            dtEntradaFabrica: formatDbDate(getValue(dtEntradaFabKey)),
            hrEntradaFabrica: formatDbTime(getValue(hrEntradaFabKey)),
            dtSaidaCampo: formatDbDate(getValue(dtSaidaCampoKey)),
            hrSaidaCampo: formatDbTime(getValue(hrSaidaCampoKey)),
            dtInicioDescarFabrica: formatDbDate(getValue(dtInicioDescarFabKey)),
            hrInicioDescarFabrica: formatDbTime(getValue(hrInicioDescarFabKey)),
            
            filial_id: window.currentUser ? window.currentUser.filial_id : null 
        };
    });
    
    return mappedData.filter(item => item.pesoLiquido > 0 || item.peso_na_entrada > 0 || item.volumeReal > 0);
}

window.processAndSaveFile = async function(file) {
    const errorMsgDiv = document.getElementById('errorMsg');
    const loadingSpinner = document.getElementById('loadingSpinner');
    if(errorMsgDiv) errorMsgDiv.classList.add('hidden');
    if(loadingSpinner) { loadingSpinner.classList.remove('hidden'); loadingSpinner.classList.add('flex'); }

    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });
        const newRows = parseSheetToData(workbook.Sheets[workbook.SheetNames[0]]);
        if (!newRows || newRows.length === 0) throw new Error("Planilha vazia ou sem dados válidos.");

        let transpPropriaConfig = 'SERRANALOG';
        try {
            const { data: metasData } = await window.supabaseClient.from('metas_globais').select('transp_propria').eq('id', 1).single();
            if (metasData && metasData.transp_propria) {
                transpPropriaConfig = metasData.transp_propria.trim().toUpperCase();
            }
        } catch(e) {}

        let queryGruas = window.supabaseClient.from('config_gruas').select('*');
        if (typeof window.aplicarFiltroFilial === 'function') {
            queryGruas = window.aplicarFiltroFilial(queryGruas);
        }
        const { data: gruasData } = await queryGruas;
        
        let allMappedLoaders = [];
        if (gruasData) {
            gruasData.forEach(item => {
                const codes = (item.codigos || '').split(',')
                    .map(c => c.trim().toUpperCase())
                    .filter(c => c && c !== '-' && c !== 'OUTRAS' && c !== 'OUTROS' && c !== '0');
                allMappedLoaders.push(...codes);
            });
        }

        const operacaoRows = newRows.filter(row => {
            const transp = String(row.transportadora || '').trim().toUpperCase();
            const grua = String(row.grua || '').trim().toUpperCase();
            
            const isTransportadoraPropria = transp.includes(transpPropriaConfig) || transp === transpPropriaConfig;
            const isGruaDaOperacao = allMappedLoaders.includes(grua) || grua.startsWith('GSR');

            if (isTransportadoraPropria || isGruaDaOperacao) return true;
            return false;
        });

        if (operacaoRows.length === 0) {
            throw new Error("A planilha não contém nenhuma viagem da nossa operação baseada nas regras definidas.");
        }

        let linhasDescartadas = newRows.length - operacaoRows.length;

        let existingIds = [];
        let startVia = 0; const stepVia = 1000;
        while (true) {
            let queryVia = window.supabaseClient.from('historico_viagens').select('movimento').range(startVia, startVia + stepVia - 1);
            if (typeof window.aplicarFiltroFilial === 'function') {
                queryVia = window.aplicarFiltroFilial(queryVia);
            }
            const { data: dbData, error: selErr } = await queryVia;
            
            if (selErr) throw selErr;
            if (!dbData || dbData.length === 0) break;
            existingIds.push(...dbData);
            if (dbData.length < stepVia) break;
            startVia += stepVia;
        }
        
        const existingSet = new Set(existingIds.map(e => e.movimento));
        let duplicadasIgnoradas = 0;
        
        const viagensNovasArray = operacaoRows.filter(item => {
            if (existingSet.has(item.movimento)) { duplicadasIgnoradas++; return false; } 
            else { existingSet.add(item.movimento); return true; }
        });

        if (viagensNovasArray.length === 0) {
            let msg = `Todas as viagens já existem. (${duplicadasIgnoradas} duplicadas ignoradas).`;
            if (linhasDescartadas > 0) msg += ` E ${linhasDescartadas} viagens de outras operações foram bloqueadas.`;
            throw new Error(msg);
        }

        const gruasDesconhecidas = new Set();
        viagensNovasArray.forEach(v => {
            const gruaRaw = String(v.grua || '').trim().toUpperCase();
            if (gruaRaw && gruaRaw !== '-' && !allMappedLoaders.includes(gruaRaw)) {
                gruasDesconhecidas.add(gruaRaw);
            }
        });

        const datasEncontradas = [...new Set(viagensNovasArray.map(r => r.dataDaBaseExcel).filter(d => d && d !== 'Desconhecida'))];
        let strHistoricoDatas = 'Desconhecida';
        
        if (datasEncontradas.length > 0) {
            datasEncontradas.sort((a, b) => {
                const pA = a.split('/'); const pB = b.split('/');
                let anoA = parseInt(pA[2]); if(anoA < 100) anoA += 2000;
                let anoB = parseInt(pB[2]); if(anoB < 100) anoB += 2000;
                return new Date(anoA, parseInt(pA[1])-1, parseInt(pA[0])) - new Date(anoB, parseInt(pB[1])-1, parseInt(pB[0]));
            });
            strHistoricoDatas = datasEncontradas.length === 1 ? datasEncontradas[0] : 
                                `${datasEncontradas[0]} a ${datasEncontradas[datasEncontradas.length - 1]}`;
        }

        const { error: insErr } = await window.supabaseClient.from('historico_viagens').insert(viagensNovasArray);
        if (insErr) throw insErr;

        await window.supabaseClient.from('historico_importacoes').insert([{ 
            "dataBase": `Viagens: ${strHistoricoDatas}`, 
            "qtdViagens": viagensNovasArray.length, 
            "dataLancamento": new Date().toLocaleString('pt-PT'),
            "filial_id": window.currentUser ? window.currentUser.filial_id : null,
            "usuario": window.currentUser ? (window.currentUser.nome_completo || window.currentUser.username) : 'Sistema'
        }]);
        
        let msgSucesso = `Sucesso! Salvas ${viagensNovasArray.length} NOVAS viagens.\nDatas: ${strHistoricoDatas}`;
        
        if (linhasDescartadas > 0) {
            msgSucesso += `\n\n🛡️ BLOQUEIO ATIVO: ${linhasDescartadas} viagens de outras operações foram descartadas (Sem nosso transporte ou grua).`;
        }

        if (gruasDesconhecidas.size > 0) {
            msgSucesso += `\n\n⚠️ ALERTA: Foram importadas viagens com GRUAS NOVAS (${Array.from(gruasDesconhecidas).join(', ')}).`;
        }

        alert(msgSucesso);
        if (typeof carregarHistoricoImportacoes === 'function') carregarHistoricoImportacoes(); 
        
    } catch (err) {
        if(errorMsgDiv) { errorMsgDiv.innerText = "Erro: " + err.message; errorMsgDiv.classList.remove('hidden'); } else alert("Erro: " + err.message);
    } finally {
        if(loadingSpinner) { loadingSpinner.classList.add('hidden'); loadingSpinner.classList.remove('flex'); }
    }
};

// =========================================================================
// 4. PLACEHOLDERS (Módulos em Desenvolvimento)
// =========================================================================
window.processarImportacaoVeracel = async function(input) { alert('Importação de viagens Veracel em desenvolvimento'); };
window.processAndSaveJornadasFileVeracel = async function(file) { alert('Importação de jornadas Veracel em desenvolvimento'); };
window.processAndSaveEventosFileVeracel = async function(file) { alert('Importação de eventos Veracel em desenvolvimento'); };
window.processAndSaveJornadasFileBracell = async function(file) { alert('Importação de jornadas Bracell em desenvolvimento'); };
window.processAndSaveEventosFileBracell = async function(file) { alert('Importação de eventos Bracell em desenvolvimento'); };
window.processAndSaveEventosFile = async function(file) { alert('Importação de eventos em desenvolvimento'); };

// =========================================================================
// INICIALIZADOR DE EVENTOS (DRAG AND DROP CENTRALIZADO)
// =========================================================================
window.initImportacao = function() {
    const dropZonesMap = [
        { id: 'dropZone', func: window.processAndSaveFile, bgHover: 'bg-emerald-900/20' },
        { id: 'dropZoneJornadas', func: window.processAndSaveJornadasFile, bgHover: 'bg-amber-900/20' },
        { id: 'dropZoneEventos', func: window.processAndSaveEventosFile, bgHover: 'bg-rose-900/20' },
        
        { id: 'dropZoneBracell', func: window.processarImportacaoBracell, bgHover: 'bg-sky-900/20' },
        { id: 'dropZoneJornadasBracell', func: window.processAndSaveJornadasFileBracell, bgHover: 'bg-amber-900/20' },
        { id: 'dropZoneEventosBracell', func: window.processAndSaveEventosFileBracell, bgHover: 'bg-rose-900/20' },
        
        { id: 'dropZoneVeracel', func: window.processarImportacaoVeracel, bgHover: 'bg-teal-900/20' },
        { id: 'dropZoneJornadasVeracel', func: window.processAndSaveJornadasFileVeracel, bgHover: 'bg-amber-900/20' },
        { id: 'dropZoneEventosVeracel', func: window.processAndSaveEventosFileVeracel, bgHover: 'bg-rose-900/20' }
    ];

    dropZonesMap.forEach(zone => {
        const dz = document.getElementById(zone.id);
        if (dz) {
            dz.ondragover = e => { e.preventDefault(); dz.classList.add(...zone.bgHover.split(' ')); };
            dz.ondragleave = () => dz.classList.remove(...zone.bgHover.split(' '));
            dz.ondrop = e => { 
                e.preventDefault(); 
                dz.classList.remove(...zone.bgHover.split(' ')); 
                if (e.dataTransfer.files.length > 0 && typeof zone.func === 'function') {
                    zone.func(e.dataTransfer.files[0]);
                } else if (!zone.func) {
                    alert('Módulo de importação em desenvolvimento.');
                }
            };
        }
    });
};

document.addEventListener('DOMContentLoaded', window.initImportacao);