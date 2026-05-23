// ==========================================
// js/configuracoes/importacao.js
// ==========================================

window.processAndSaveFile = processAndSaveFile;
window.processAndSaveJornadasFile = processAndSaveJornadasFile;

async function processAndSaveJornadasFile(file) {
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
            
            const valTrabalho = getVal(['total de trabalho', 'total trabalho', 'tempo de trabalho']);
            const totalHoras = timeParaDecimal(valTrabalho);
            
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
                refeicao_horas: timeParaDecimal(getVal(['refeição', 'refeicao'])),
                repouso_horas: timeParaDecimal(getVal(['repouso'])),
                direcao_horas: timeParaDecimal(getVal(['direção', 'direcao'])),
                estourou_jornada: totalHoras > 12,
                horas_noturnas: timeParaDecimal(getVal(['noturnas', 'noturna', 'horas noturnas'])),
                horas_extras: timeParaDecimal(getVal(['extra normal', 'extranormal'])) + timeParaDecimal(getVal(['extra excedente', 'extraexcedente'])),
                eps: 'SERRANALOG - BA',
                unidade: 'BA',
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
            let queryJor = supabaseClient.from('historico_jornadas').select('motorista, inicio, fim').range(startJor, startJor + stepJor - 1);
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

        const { error: insErr } = await supabaseClient.from('historico_jornadas').insert(jornadasNovas);
        if (insErr) throw insErr;

        await supabaseClient.from('historico_importacoes').insert([{
            "dataBase": `Jornadas Ponto`,
            "qtdViagens": jornadasNovas.length,
            "dataLancamento": new Date().toLocaleString('pt-PT'),
            "filial_id": window.currentUser ? window.currentUser.filial_id : null
        }]);
        
        alert(`Sucesso! Salvas ${jornadasNovas.length} NOVAS jornadas.`);
        if (typeof carregarHistoricoImportacoes === 'function') carregarHistoricoImportacoes(); 
        
    } catch (err) {
        if(errorMsgDiv) { errorMsgDiv.innerText = "Erro: " + err.message; errorMsgDiv.classList.remove('hidden'); } 
        else alert("Erro: " + err.message);
    } finally {
        if(loadingSpinner) { loadingSpinner.classList.add('hidden'); loadingSpinner.classList.remove('flex'); }
    }
}

function parseSheetToData(sheet) {
    const rawData = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    if (!rawData || rawData.length === 0) throw new Error("Planilha vazia.");

    const normKeys = Object.keys(rawData[0]).map(k => ({ orig: k, norm: normalizeStr(k) }));
    function findKey(possibilities) {
        for (let p of possibilities) { const normP = normalizeStr(p); let found = normKeys.find(k => k.norm === normP || k.norm.includes(normP)); if (found) return found.orig; }
        return null;
    }

    const movimentoKey = findKey(['movimento', 'id_movimento']);
    const transpKey = findKey(['transportadora', 'nome da transportadora']);
    const placaKey = findKey(['placa do cavalo', 'placa cavalo', 'placa']);
    const pesoLiqKey = findKey(['Peso na Entrada', 'peso na entrada']);
    const volumeKey = findKey(['volume real', 'volume_real']);
    const gruaKey = findKey(['carregador florestal', 'carregador', 'grua']); 
    
    // Chaves
    const dtSaidaBaseKey = findKey(['data de saída', 'data saída', 'data saída fábrica']);
    const dtSaidaFabKey = findKey(['data saída fábrica', 'data saida fabrica', 'data de saída', 'data saída']);
    const hrSaidaFabKey = findKey(['hora saída fábrica', 'hora saida fabrica', 'hora saída', 'hora saida']);
    
    const dtFimDescarFabKey = findKey(['dt fim descar fáb', 'dt fim descar fab']);
    const hrFimDescarFabKey = findKey(['hr fim descar fáb', 'hr fim descar fab']);

    const dtInicioCarregCpoKey = findKey(['dt início carreg cpo', 'dt inicio carreg cpo', 'data inicio carregamento']);
    const hrInicioCarregCpoKey = findKey(['hr início carreg cpo', 'hr inicio carreg cpo', 'hora inicio carregamento']);
    const dtFimCarregCpoKey = findKey(['dt final carreg cpo', 'dt fim carreg cpo', 'data final carregamento']);
    const hrFimCarregCpoKey = findKey(['hr final carreg cpo', 'hr fim carreg cpo', 'hora final carregamento']);

    const dtChegadaCampoKey = findKey(['data chegada campo', 'dt chegada campo']);
    const hrChegadaCampoKey = findKey(['hora chegada campo', 'hr chegada campo']);
    
    const dtSaidaCampoKey = findKey(['data saída campo', 'data saida campo', 'dt saida campo']);
    const hrSaidaCampoKey = findKey(['hora saída campo', 'hora saida campo', 'hr saida campo']);

    const dtEntradaFabKey = findKey(['data de entrada', 'dt entrada']);
    const hrEntradaFabKey = findKey(['hora de entrada', 'hr entrada']);
    const dtInicioDescarFabKey = findKey(['dt início descar fáb', 'dt inicio descar fab']);
    const hrInicioDescarFabKey = findKey(['hr início descar fáb', 'hr inicio descar fab']);

    const mappedData = rawData.map((row, idx) => {
        const getValue = (key) => (key && row[key] !== undefined && row[key] !== "") ? row[key] : null;
        
        const rawDtSaida = getValue(dtSaidaBaseKey) || getValue(dtSaidaFabKey);
        const rawHrSaida = getValue(hrSaidaFabKey);
        let strDataBase = 'Desconhecida';

        if (rawDtSaida) {
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
            const d = parseDateTime(val, null);
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

        return {
            movimento: String(getValue(movimentoKey) || `MOV-GEN-${Date.now()}-${idx}`),
            dataDaBaseExcel: strDataBase,
            dataLancamento: new Date().toLocaleDateString('pt-PT'),
            transportadora: String(getValue(transpKey) || "Outras").trim(),
            placa: String(getValue(placaKey) || "-").trim(),
            pesoLiquido: parsePtBrNumber(getValue(pesoLiqKey)),
            volumeReal: parsePtBrNumber(getValue(volumeKey)),
            grua: String(getValue(gruaKey) || "-").trim(),
            distanciaAsfalto: parsePtBrNumber(getValue(findKey(['distancia por asfalto', 'distância por asfalto', 'distancia asfalto']))),
            distanciaTerra: parsePtBrNumber(getValue(findKey(['distancia por terra', 'distância por terra', 'distancia terra']))),
            
            cicloHoras: calcHoursDiff(getSafeDate(dtSaidaFabKey), getValue(hrSaidaFabKey), getSafeDate(dtFimDescarFabKey), getValue(hrFimDescarFabKey)),
            tempoCarregamentoHoras: calcHoursDiff(getSafeDate(dtInicioCarregCpoKey), getValue(hrInicioCarregCpoKey), getSafeDate(dtFimCarregCpoKey), getValue(hrFimCarregCpoKey)),
            filaCampoHoras: calcHoursDiff(getSafeDate(dtChegadaCampoKey), getValue(hrChegadaCampoKey), getSafeDate(dtInicioCarregCpoKey), getValue(hrInicioCarregCpoKey)),
            filaFabricaHoras: calcHoursDiff(getSafeDate(dtEntradaFabKey), getValue(hrEntradaFabKey), getSafeDate(dtInicioDescarFabKey), getValue(hrInicioDescarFabKey)),
            cicloCampoHoras: calcHoursDiff(getSafeDate(dtChegadaCampoKey), getValue(hrChegadaCampoKey), getSafeDate(dtSaidaCampoKey), getValue(hrSaidaCampoKey)),

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
    
    return mappedData.filter(item => item.pesoLiquido > 0 || item.volumeReal > 0);
}

async function processAndSaveFile(file) {
    const errorMsgDiv = document.getElementById('errorMsg');
    const loadingSpinner = document.getElementById('loadingSpinner');
    if(errorMsgDiv) errorMsgDiv.classList.add('hidden');
    if(loadingSpinner) { loadingSpinner.classList.remove('hidden'); loadingSpinner.classList.add('flex'); }

    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });
        const newRows = parseSheetToData(workbook.Sheets[workbook.SheetNames[0]]);
        if (!newRows || newRows.length === 0) throw new Error("Planilha vazia ou sem dados válidos.");

        // BUSCAR NOME DA TRANSPORTADORA NAS METAS
        let transpPropriaConfig = 'SERRANALOG';
        try {
            const { data: metasData } = await supabaseClient.from('metas_globais').select('transp_propria').eq('id', 1).single();
            if (metasData && metasData.transp_propria) {
                transpPropriaConfig = metasData.transp_propria.trim().toUpperCase();
            }
        } catch(e) { console.warn("Erro ao puxar transp_propria, usando padrão:", e); }

        // BUSCAR GRUAS NO BANCO
        let queryGruas = supabaseClient.from('config_gruas').select('*');
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

        // APLICAÇÃO DA REGRA DE FILTRO
        const operacaoRows = newRows.filter(row => {
            const transp = String(row.transportadora || '').trim().toUpperCase();
            const grua = String(row.grua || '').trim().toUpperCase();
            
            const isTransportadoraPropria = transp.includes(transpPropriaConfig) || transp === transpPropriaConfig;
            const isGruaDaOperacao = allMappedLoaders.includes(grua) || grua.startsWith('GSR');

            // Regra mestre: Se for nosso transporte OU tiver nossa grua -> Importa
            if (isTransportadoraPropria || isGruaDaOperacao) {
                return true;
            }
            return false;
        });

        if (operacaoRows.length === 0) {
            throw new Error("A planilha não contém nenhuma viagem da nossa operação baseada nas regras definidas (Grua Própria ou Transporte Próprio).");
        }

        let linhasDescartadas = newRows.length - operacaoRows.length;

        let existingIds = [];
        let startVia = 0; const stepVia = 1000;
        while (true) {
            let queryVia = supabaseClient.from('historico_viagens').select('movimento').range(startVia, startVia + stepVia - 1);
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

        const { error: insErr } = await supabaseClient.from('historico_viagens').insert(viagensNovasArray);
        if (insErr) throw insErr;

        await supabaseClient.from('historico_importacoes').insert([{ 
            "dataBase": `Viagens: ${strHistoricoDatas}`, 
            "qtdViagens": viagensNovasArray.length, 
            "dataLancamento": new Date().toLocaleString('pt-PT'),
            "filial_id": window.currentUser ? window.currentUser.filial_id : null 
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
}

function initImportacao() {
    const dropZone = document.getElementById('dropZone');
    if(dropZone){
        dropZone.ondragover = e => { e.preventDefault(); dropZone.classList.add('bg-sky-900/20'); };
        dropZone.ondragleave = () => dropZone.classList.remove('bg-sky-900/20');
        dropZone.ondrop = e => { 
            e.preventDefault(); 
            dropZone.classList.remove('bg-sky-900/20'); 
            if (e.dataTransfer.files.length > 0) {
                window.processAndSaveFile(e.dataTransfer.files[0]);
            }
        };
    }

    const dropZoneJornadas = document.getElementById('dropZoneJornadas');
    if(dropZoneJornadas){
        dropZoneJornadas.ondragover = e => { e.preventDefault(); dropZoneJornadas.classList.add('bg-amber-900/20'); };
        dropZoneJornadas.ondragleave = () => dropZoneJornadas.classList.remove('bg-amber-900/20');
        dropZoneJornadas.ondrop = e => { 
            e.preventDefault(); 
            dropZoneJornadas.classList.remove('bg-amber-900/20'); 
            if (e.dataTransfer.files.length > 0) {
                window.processAndSaveJornadasFile(e.dataTransfer.files[0]);
            }
        };
    }
}

document.addEventListener('DOMContentLoaded', initImportacao);