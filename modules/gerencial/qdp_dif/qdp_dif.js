// ==========================================
// modules/gerencial/qdp_dif/qdp_dif.js
// AUDITORIA EXECUTIVA E COMPARAÇÃO QDP SUZANO vs SGF
// ==========================================

window.qdpResultadoConciliacao = [];
window.qdpFaltantesNoQdp = [];
window.qdpResumoCache = null;
window.tarifadorQdpAtivo = null;
window.qdpLinhasBrutasCache = null;
window.qdpViagensSgfCache = null;
window.qdpMetaInfoCache = null;

const CACHE_KEY_QDP_DIF = 'sgf_qdp_dif_audit_cache_v4';

window.initQdpDif = async function() {
    console.log("[QDP-DIF] Módulo Iniciado.");

    carregarBibliotecaXlsxStyle();

    const inputQdp = document.getElementById('inputArquivoQdp');
    if (inputQdp) {
        inputQdp.removeEventListener('change', handleFileUploadQdp);
        inputQdp.addEventListener('change', handleFileUploadQdp);
    }

    const btnExport = document.getElementById('btnExportarQdpDif');
    if (btnExport) {
        btnExport.removeEventListener('click', exportarQdpDifParaExcel);
        btnExport.addEventListener('click', exportarQdpDifParaExcel);
    }

    const btnLimpar = document.getElementById('btnLimparCacheQdp');
    if (btnLimpar) {
        btnLimpar.removeEventListener('click', limparCacheQdpDif);
        btnLimpar.addEventListener('click', limparCacheQdpDif);
    }

    await carregarTarifadorAtivoQdp();
    restaurarCacheQdpDif();
};

// Carrega o plugin xlsx-js-style para exportar Excel com bordas, cores, centralização e máscara R$
function carregarBibliotecaXlsxStyle() {
    if (window.XLSX_STYLE_LOADED) return;
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js';
    script.onload = () => {
        window.XLSX_STYLE_LOADED = true;
        console.log("[QDP-DIF] Motor de estilização Excel (xlsx-js-style) carregado com sucesso.");
    };
    document.head.appendChild(script);
}

function getSupabaseClientQDP() {
    if (typeof window.supabaseClient !== 'undefined') return window.supabaseClient;
    if (typeof window.db !== 'undefined' && typeof window.db.from === 'function') return window.db;
    if (typeof window.db !== 'undefined' && window.db.supabase) return window.db.supabase;
    if (typeof supabaseClient !== 'undefined') return supabaseClient;
    return null;
}

function toNumberQDP(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let str = String(val).replace('R$', '').replace(/\s/g, '').trim();
    if (str.includes(',') && str.includes('.')) {
        str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',')) {
        str = str.replace(',', '.');
    }
    let num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

function normalizeKeyQDP(str) {
    if (!str) return "";
    return String(str)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();
}

function limparMovimentoQDP(val) {
    if (val === null || val === undefined) return "";
    let s = String(val).trim();
    if (s.endsWith('.0')) s = s.slice(0, -2);
    return s.replace(/^0+/, '') || s;
}

function limparPlacaQDP(val) {
    if (!val) return "";
    return String(val).toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
}

function mostrarLoadingQdp(show, text = 'Processando...') {
    const overlay = document.getElementById('loadingOverlayQdp');
    const title = document.getElementById('loadingTitleQdp');
    if (overlay) {
        if (show) {
            if (title) title.innerText = text;
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }
}

async function carregarTarifadorAtivoQdp() {
    const client = getSupabaseClientQDP();
    const displayNome = document.getElementById('nomeTarifadorQdpDisplay');
    const badge = document.getElementById('badgeTarifadorQdp');
    if (!client) return;

    try {
        let query = client.from('tarifadores').select('*').eq('ativo', true).limit(1);
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
            window.tarifadorQdpAtivo = data[0];
            if (displayNome) displayNome.innerText = `Tarifador Ativo: ${window.tarifadorQdpAtivo.nome}`;
            if (badge) {
                badge.className = "bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 font-bold px-3 py-2 rounded-xl flex items-center gap-2 text-xs shadow-md";
            }
        } else {
            window.tarifadorQdpAtivo = null;
            if (displayNome) displayNome.innerText = "Sem Tarifador Ativo (Usando CTE/QDP)";
        }
    } catch (e) {
        console.warn("[QDP-DIF] Erro ao buscar tarifador:", e);
    }
}

function calcularTarifaPeloTarifadorSGF(asfalto, terra) {
    if (!window.tarifadorQdpAtivo || !Array.isArray(window.tarifadorQdpAtivo.dados) || window.tarifadorQdpAtivo.dados.length === 0) {
        return 0;
    }
    const asfaltoVal = toNumberQDP(asfalto);
    const terraVal = toNumberQDP(terra);
    const dadosMatriz = window.tarifadorQdpAtivo.dados;

    if (dadosMatriz[0].is_raio || dadosMatriz[0].raio_inicial !== undefined) {
        let distanciaTotal = asfaltoVal + terraVal;
        let distArredondada = Math.round(distanciaTotal * 100) / 100;
        let faixa = dadosMatriz.find(t => distArredondada >= t.raio_inicial && distArredondada <= t.raio_final);
        if (!faixa) {
            let ordenados = [...dadosMatriz].sort((a, b) => a.raio_final - b.raio_final);
            faixa = ordenados.find(t => t.raio_final >= distArredondada) || ordenados[ordenados.length - 1];
        }
        return faixa ? toNumberQDP(faixa.tarifa) : 0;
    } else {
        const exato = dadosMatriz.find(t => Math.abs(t.asfalto - asfaltoVal) < 0.01 && Math.abs(t.terra - terraVal) < 0.01);
        if (exato) return toNumberQDP(exato.tarifa);

        let maisProximo = null;
        let menorDist = Infinity;
        for (let i = 0; i < dadosMatriz.length; i++) {
            const t = dadosMatriz[i];
            const da = t.asfalto - asfaltoVal;
            const dt = t.terra - terraVal;
            const dSq = (da * da) + (dt * dt);
            if (dSq < menorDist) {
                menorDist = dSq;
                maisProximo = t;
            }
        }
        return maisProximo ? toNumberQDP(maisProximo.tarifa) : 0;
    }
}

function parseQualquerDataQDP(val) {
    if (val === null || val === undefined || val === '') return null;

    if (val instanceof Date) {
        if (!isNaN(val.getTime())) {
            return new Date(val.getFullYear(), val.getMonth(), val.getDate(), 12, 0, 0);
        }
        return null;
    }

    if (typeof val === 'number') {
        if (val > 20000 && val < 90000) {
            const utcDays = Math.floor(val - 25569);
            const d = new Date(utcDays * 86400 * 1000);
            return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0);
        }
        return null;
    }

    let str = String(val).trim();
    if (!str || str === '-') return null;

    let mIso = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (mIso) {
        return new Date(parseInt(mIso[1], 10), parseInt(mIso[2], 10) - 1, parseInt(mIso[3], 10), 12, 0, 0);
    }

    let mBr = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (mBr) {
        let y = parseInt(mBr[3], 10);
        if (y < 100) y += 2000;
        return new Date(y, parseInt(mBr[2], 10) - 1, parseInt(mBr[1], 10), 12, 0, 0);
    }

    let dt = new Date(str);
    if (!isNaN(dt.getTime())) {
        return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 12, 0, 0);
    }
    return null;
}

function formatarDataBR_QDP(dObj) {
    if (!dObj || isNaN(dObj.getTime())) return '-';
    let d = String(dObj.getDate()).padStart(2, '0');
    let m = String(dObj.getMonth() + 1).padStart(2, '0');
    let y = dObj.getFullYear();
    return `${d}/${m}/${y}`;
}

function formatarDataChaveISO_QDP(dObj) {
    if (!dObj || isNaN(dObj.getTime())) return '';
    let d = String(dObj.getDate()).padStart(2, '0');
    let m = String(dObj.getMonth() + 1).padStart(2, '0');
    let y = dObj.getFullYear();
    return `${y}-${m}-${d}`;
}

async function handleFileUploadQdp(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (typeof XLSX === 'undefined') {
        alert("A biblioteca Excel ainda não foi carregada. Aguarde um instante e tente novamente.");
        return;
    }

    mostrarLoadingQdp(true, 'Varrendo Abas da Planilha QDP...');

    const reader = new FileReader();
    reader.onload = async function(evt) {
        try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });

            let targetSheetName = null;
            let headerRowIndex = -1;
            let rawDataEscolhido = null;

            for (const sheetName of workbook.SheetNames) {
                const ws = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
                if (!rows || rows.length === 0) continue;

                for (let r = 0; r < Math.min(rows.length, 25); r++) {
                    if (!Array.isArray(rows[r])) continue;
                    const rowNorm = rows[r].map(cell => normalizeKeyQDP(cell));
                    const temMovimento = rowNorm.some(c => c.includes('movimento'));
                    const temDataEmissao = rowNorm.some(c => c.includes('dataemisaomvt') || c.includes('dataemissaomvt') || c.includes('dataemissao') || c.includes('datadocumento'));
                    const temVolumeOuContainer = rowNorm.some(c => c.includes('volumereal') || c.includes('idcontainer') || c.includes('distanciaasfalto'));

                    if (temMovimento && (temDataEmissao || temVolumeOuContainer)) {
                        targetSheetName = sheetName;
                        headerRowIndex = r;
                        rawDataEscolhido = rows;
                        break;
                    }
                }
                if (targetSheetName) break;
            }

            if (!targetSheetName) {
                const abaBase = workbook.SheetNames.find(n => normalizeKeyQDP(n).includes('basededados') || normalizeKeyQDP(n).includes('base'));
                if (abaBase) {
                    const ws = workbook.Sheets[abaBase];
                    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
                    let maxFilled = 0;
                    let bestRow = 0;
                    for (let r = 0; r < Math.min(rows.length, 15); r++) {
                        const count = (rows[r] || []).filter(c => String(c).trim() !== '').length;
                        if (count > maxFilled) {
                            maxFilled = count;
                            bestRow = r;
                        }
                    }
                    targetSheetName = abaBase;
                    headerRowIndex = bestRow;
                    rawDataEscolhido = rows;
                }
            }

            if (!targetSheetName || !rawDataEscolhido || headerRowIndex === -1) {
                alert("Não foi possível localizar a aba 'Base de dados' com as colunas 'Nrº Movimento' e 'Data Emisão Mvt'.");
                mostrarLoadingQdp(false);
                e.target.value = null;
                return;
            }

            const rawHeaders = rawDataEscolhido[headerRowIndex];
            const headersNorm = rawHeaders.map(h => normalizeKeyQDP(h));

            const jsonData = [];
            for (let i = headerRowIndex + 1; i < rawDataEscolhido.length; i++) {
                const row = rawDataEscolhido[i];
                if (!row || row.length === 0) continue;

                let obj = {};
                let hasContent = false;
                for (let c = 0; c < headersNorm.length; c++) {
                    const key = headersNorm[c];
                    if (key) {
                        obj[key] = row[c];
                        if (row[c] !== "" && row[c] !== null && row[c] !== undefined) {
                            hasContent = true;
                        }
                    }
                }
                if (hasContent) jsonData.push(obj);
            }

            await processarQdpECruzarComBanco(jsonData, file.name, targetSheetName, headerRowIndex + 1);
            e.target.value = null;
        } catch (err) {
            console.error("[QDP-DIF] Erro ao ler arquivo:", err);
            alert("Erro ao ler a planilha: " + (err.message || err));
            mostrarLoadingQdp(false);
            e.target.value = null;
        }
    };
    reader.readAsArrayBuffer(file);
}

async function processarQdpECruzarComBanco(jsonData, fileName, sheetName, headerLineNumber) {
    if (!jsonData || jsonData.length === 0) {
        alert("A aba selecionada na planilha está vazia.");
        mostrarLoadingQdp(false);
        return;
    }

    let minDate = null;
    let maxDate = null;

    const linhasBrutasQdp = [];

    for (let idx = 0; idx < jsonData.length; idx++) {
        const row = jsonData[idx];

        const getVal = (possiveis) => {
            for (const p of possiveis) {
                const k = normalizeKeyQDP(p);
                if (row[k] !== undefined && row[k] !== null && row[k] !== "") {
                    return row[k];
                }
            }
            return "";
        };

        const rawMov = getVal(['Nrº Movimento', 'Nº Movimento', 'Nr Movimento', 'Movimento', 'Nro Movimento']);
        const nrMovimento = limparMovimentoQDP(rawMov);
        if (!nrMovimento || nrMovimento === '0') continue;

        const idContainer = limparPlacaQDP(getVal(['ID container', 'Placa', 'Placa Cavalo', 'Veiculo']));
        const meioTransp = String(getVal(['Meio de transporte', 'Tipo Conjunto'])).trim().toUpperCase();
        const placaReal = idContainer || meioTransp || '-';

        const rawDate = getVal(['Data Emisão Mvt', 'Data Emissao Mvt', 'Data Emisão', 'Data documento', 'Data MIRO']);
        const parsedDate = parseQualquerDataQDP(rawDate);

        if (parsedDate) {
            if (!minDate || parsedDate < minDate) minDate = new Date(parsedDate.getTime());
            if (!maxDate || parsedDate > maxDate) maxDate = new Date(parsedDate.getTime());
        }

        const up = String(getVal(['UP', 'Projeto', 'Talhao'])).trim().toUpperCase();
        const municipio = String(getVal(['Municipío Partida', 'Municipio Partida'])).trim();
        const transportadora = String(getVal(['Nome Transp. Transporte', 'Transportadora Transporte'])).trim();
        const nf = String(getVal(['Nr. NF 1', 'Nr NFe 1', 'Nº documento'])).trim();

        const volume = toNumberQDP(getVal(['Volume Real', 'Base da condição', 'Peso Liquido Remessa']));
        const pesoReal = toNumberQDP(getVal(['Peso Real', 'Peso Liquido Remessa']));
        
        const colDistAsfaltoPlanilha = toNumberQDP(getVal(['Distância Asfalto', 'Distancia Asfalto', 'Asfalto']));
        const colDistTerraPlanilha = toNumberQDP(getVal(['Distância Terra', 'Distancia Terra', 'Terra']));
        
        const tarifa = toNumberQDP(getVal(['Tarifa', 'Montante de condição']));
        const valorCondicao = toNumberQDP(getVal(['Valor condição', 'Valor condicao']));
        const valorLiquido = toNumberQDP(getVal(['Valor líquido', 'Valor liquido']));

        const valorBrutoQdp = valorCondicao > 0 ? valorCondicao : (volume * tarifa);

        linhasBrutasQdp.push({
            nrMovimento,
            nf,
            placa: placaReal,
            meioTransporte: meioTransp,
            up,
            municipio,
            transportadora,
            dataStr: formatarDataBR_QDP(parsedDate),
            keyData: formatarDataChaveISO_QDP(parsedDate),
            volume,
            pesoReal,
            colDistAsfaltoPlanilha,
            colDistTerraPlanilha,
            tarifa,
            valorBrutoQdp,
            valorLiquido
        });
    }

    if (linhasBrutasQdp.length === 0 || !minDate || !maxDate) {
        alert("Não foi possível identificar viagens válidas ou datas na coluna 'Data Emisão Mvt'.");
        mostrarLoadingQdp(false);
        return;
    }

    mostrarLoadingQdp(true, `Buscando viagens no SGF (${formatarDataBR_QDP(minDate)} a ${formatarDataBR_QDP(maxDate)})...`);

    const client = getSupabaseClientQDP();
    if (!client) {
        alert("Erro de conexão com o banco de dados Supabase.");
        mostrarLoadingQdp(false);
        return;
    }

    let todasViagensBanco = [];
    let start = 0;
    const step = 1000;

    let dataBuscaMin = new Date(minDate.getTime());
    dataBuscaMin.setDate(dataBuscaMin.getDate() - 15);
    let strIsoMin = dataBuscaMin.toISOString().split('T')[0] + 'T00:00:00';

    while (true) {
        let query = client.from('historico_viagens')
            .select('id, movimento, placa, transportadora, volumeReal, pesoLiquido, distanciaAsfalto, distanciaTerra, up, grua, valor_cte, dtFimDescarFabrica, dataDaBaseExcel, created_at')
            .gte('created_at', strIsoMin)
            .range(start, start + step - 1);

        if (typeof window.aplicarFiltroFilial === 'function') {
            query = window.aplicarFiltroFilial(query);
        } else if (window.currentUser && window.currentUser.filial_id && window.currentUser.filial_id !== 'CENTRAL') {
            query = query.eq('filial_id', window.currentUser.filial_id);
        }

        const { data: lote, error } = await query;
        if (error) {
            console.error("[QDP-DIF] Erro na consulta ao Supabase:", error);
            alert("Erro ao consultar viagens no banco de dados: " + error.message);
            mostrarLoadingQdp(false);
            return;
        }
        if (!lote || lote.length === 0) break;
        todasViagensBanco = todasViagensBanco.concat(lote);
        if (lote.length < step) break;
        start += step;
    }

    const minTime = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate(), 0, 0, 0).getTime();
    const maxTime = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate(), 23, 59, 59).getTime();

    const setMovimentosQdp = new Set(linhasBrutasQdp.map(x => x.nrMovimento));

    const viagensSgfNoPeriodo = [];
    todasViagensBanco.forEach(r => {
        const movLimpo = limparMovimentoQDP(r.movimento);
        const rawDataViagem = (r.dtFimDescarFabrica && r.dtFimDescarFabrica !== '-') ? r.dtFimDescarFabrica : ((r.dataDaBaseExcel && r.dataDaBaseExcel !== '-') ? r.dataDaBaseExcel : r.created_at);
        const dtObj = parseQualquerDataQDP(rawDataViagem);
        const ts = dtObj ? dtObj.getTime() : 0;

        const trStr = String(r.transportadora || '').toUpperCase();
        const isSerrana = trStr.includes('SERRANA');

        const dentroDoPeriodo = (ts >= minTime && ts <= maxTime);
        const estaNoQdp = setMovimentosQdp.has(movLimpo);

        if ((dentroDoPeriodo && isSerrana) || estaNoQdp) {
            viagensSgfNoPeriodo.push({
                id: r.id,
                nrMovimento: movLimpo,
                placa: limparPlacaQDP(r.placa),
                transportadora: trStr,
                up: String(r.up || '').trim().toUpperCase(),
                dataStr: formatarDataBR_QDP(dtObj),
                keyData: formatarDataChaveISO_QDP(dtObj),
                volume: toNumberQDP(r.volumeReal) > 0 ? toNumberQDP(r.volumeReal) : toNumberQDP(r.pesoLiquido),
                asfalto: toNumberQDP(r.distanciaAsfalto),
                terra: toNumberQDP(r.distanciaTerra),
                valor_cte: toNumberQDP(r.valor_cte)
            });
        }
    });

    window.qdpLinhasBrutasCache = linhasBrutasQdp;
    window.qdpViagensSgfCache = viagensSgfNoPeriodo;
    window.qdpMetaInfoCache = {
        fileName,
        sheetName,
        headerLineNumber,
        periodoStr: `${formatarDataBR_QDP(minDate)} até ${formatarDataBR_QDP(maxDate)}`
    };

    executarConciliacaoCompleta();
}

window.reprocessarOpcoesQdp = function() {
    if (window.qdpLinhasBrutasCache && window.qdpViagensSgfCache && window.qdpMetaInfoCache) {
        executarConciliacaoCompleta();
    }
};

window.reprocessarComInversaoQdp = window.reprocessarOpcoesQdp;

function executarConciliacaoCompleta() {
    const linhasBrutas = window.qdpLinhasBrutasCache || [];
    const viagensSgfOrig = window.qdpViagensSgfCache || [];
    const metaInfo = window.qdpMetaInfoCache || {};

    const chkInverter = document.getElementById('chkInverterDistQdp');
    const desinverterQdp = chkInverter ? chkInverter.checked : true;

    const selColunaValor = document.getElementById('selectColunaValorQdp');
    const modoColunaValor = selColunaValor ? selColunaValor.value : 'LIQUIDO';

    const viagensSgf = viagensSgfOrig.map(v => ({ ...v, _usada: false }));
    const mapaSgfPorMovimento = new Map();
    viagensSgf.forEach(v => {
        if (v.nrMovimento) {
            mapaSgfPorMovimento.set(v.nrMovimento, v);
        }
    });

    const resultado = [];
    let countOk = 0;
    let countDivergentes = 0;
    let countFaltantesSgf = 0;

    let somaVolQdp = 0;
    let somaVolSgf = 0;
    let somaBrutoQdp = 0;
    let somaLiqQdp = 0;
    let somaConsideradoQdp = 0;
    let somaCalculadoSgf = 0;

    // Acumuladores financeiros por causa raiz
    let impFinanceiroCorteLiquido = 0;
    let impFinanceiroTarifa = 0;
    let impFinanceiroVolume = 0;
    let impFinanceiroFaltamSgf = 0;
    let impFinanceiroFaltamQdp = 0;

    linhasBrutas.forEach(rawQ => {
        const asfaltoQdpCorrigido = desinverterQdp ? rawQ.colDistTerraPlanilha : rawQ.colDistAsfaltoPlanilha;
        const terraQdpCorrigido = desinverterQdp ? rawQ.colDistAsfaltoPlanilha : rawQ.colDistTerraPlanilha;

        const valorQdpEscolhido = (modoColunaValor === 'LIQUIDO') ? rawQ.valorLiquido : rawQ.valorBrutoQdp;
        const descontoInternoQdp = rawQ.valorBrutoQdp - rawQ.valorLiquido;

        const q = {
            ...rawQ,
            asfalto: asfaltoQdpCorrigido,
            terra: terraQdpCorrigido,
            valorQdpComparado: valorQdpEscolhido,
            descontoInternoQdp: descontoInternoQdp
        };

        somaVolQdp += q.volume;
        somaBrutoQdp += q.valorBrutoQdp;
        somaLiqQdp += q.valorLiquido;
        somaConsideradoQdp += valorQdpEscolhido;
        impFinanceiroCorteLiquido += descontoInternoQdp;

        let match = mapaSgfPorMovimento.get(q.nrMovimento);

        if (!match) {
            match = viagensSgf.find(v =>
                !v._usada &&
                v.placa === q.placa &&
                v.keyData === q.keyData &&
                Math.abs(v.volume - q.volume) <= 1.0
            );
        }

        if (!match) {
            const tarifaDeveriaQdp = calcularTarifaPeloTarifadorSGF(q.asfalto, q.terra);
            countFaltantesSgf++;
            impFinanceiroFaltamSgf += valorQdpEscolhido;

            resultado.push({
                ...q,
                status: 'FALTANTE_SGF',
                statusLabel: 'FALTA NO SGF',
                sist_movimento: '-',
                sist_volume: 0,
                sist_asfalto: 0,
                sist_terra: 0,
                sist_tarifa: tarifaDeveriaQdp,
                difTarifa: tarifaDeveriaQdp > 0 ? (q.tarifa - tarifaDeveriaQdp) : 0,
                sist_valor: 0,
                difValor: valorQdpEscolhido,
                difCondicaoVsSgf: q.valorBrutoQdp,
                difLiquidoVsSgf: q.valorLiquido,
                flagsErro: ['FALTANTE_SGF'],
                motivo: 'Viagem consta no QDP da Suzano, mas não foi lançada no SGF'
            });
        } else {
            match._usada = true;

            const sistAsfalto = match.asfalto;
            const sistTerra = match.terra;
            const sistVolume = match.volume;
            somaVolSgf += sistVolume;

            let nossaTarifaDeveria = calcularTarifaPeloTarifadorSGF(sistAsfalto, sistTerra);
            if (nossaTarifaDeveria === 0 && match.valor_cte > 0 && sistVolume > 0) {
                nossaTarifaDeveria = match.valor_cte / sistVolume;
            }
            const tarifaReferencia = nossaTarifaDeveria > 0 ? nossaTarifaDeveria : q.tarifa;
            const sistValorBruto = sistVolume * tarifaReferencia;

            somaCalculadoSgf += sistValorBruto;

            const diffAsf = q.asfalto - sistAsfalto;
            const diffTer = q.terra - sistTerra;
            const diffVol = q.volume - sistVolume;
            const diffTarifa = q.tarifa - tarifaReferencia;

            const diffValor = valorQdpEscolhido - sistValorBruto;
            const diffCondicaoVsSgf = q.valorBrutoQdp - sistValorBruto;
            const diffLiquidoVsSgf = q.valorLiquido - sistValorBruto;

            impFinanceiroTarifa += (diffTarifa * q.volume);
            impFinanceiroVolume += (diffVol * tarifaReferencia);

            const motivos = [];
            const flags = [];

            if (Math.abs(diffAsf) > 0.5) {
                motivos.push(`Asfalto diverge (QDP ${q.asfalto.toFixed(2)} vs SGF ${sistAsfalto.toFixed(2)} km)`);
                flags.push('DISTANCIA');
            }
            if (Math.abs(diffTer) > 0.5) {
                motivos.push(`Terra diverge (QDP ${q.terra.toFixed(2)} vs SGF ${sistTerra.toFixed(2)} km)`);
                flags.push('DISTANCIA');
            }
            if (nossaTarifaDeveria > 0 && Math.abs(diffTarifa) > 0.05) {
                motivos.push(`Tarifa diverge (QDP R$ ${q.tarifa.toFixed(2)} vs Nossa R$ ${tarifaReferencia.toFixed(2)})`);
                flags.push('TARIFA');
            }
            if (Math.abs(diffVol) > 0.2) {
                motivos.push(`Volume diverge (${diffVol > 0 ? '+' : ''}${diffVol.toFixed(2)} m³)`);
                flags.push('VOLUME');
            }
            if (modoColunaValor === 'LIQUIDO' && Math.abs(descontoInternoQdp) > 1.5) {
                motivos.push(`Corte no Valor Líquido (-R$ ${Math.abs(descontoInternoQdp).toFixed(2)} vs Condição)`);
                flags.push('DESCONTO_LIQUIDO');
            }
            if (Math.abs(diffValor) > 2.0 && motivos.length === 0) {
                motivos.push(`Valor diverge em R$ ${diffValor.toFixed(2)}`);
                flags.push('VALOR');
            }

            if (motivos.length > 0) {
                countDivergentes++;
                resultado.push({
                    ...q,
                    status: 'DIVERGENTE',
                    statusLabel: 'DIVERGENTE',
                    sist_movimento: match.nrMovimento,
                    sist_volume: sistVolume,
                    sist_asfalto: sistAsfalto,
                    sist_terra: sistTerra,
                    sist_tarifa: tarifaReferencia,
                    difTarifa: diffTarifa,
                    sist_valor: sistValorBruto,
                    difValor: diffValor,
                    difCondicaoVsSgf: diffCondicaoVsSgf,
                    difLiquidoVsSgf: diffLiquidoVsSgf,
                    flagsErro: flags,
                    motivo: motivos.join(' | ')
                });
            } else {
                countOk++;
                resultado.push({
                    ...q,
                    status: 'OK',
                    statusLabel: 'CONCILIADA',
                    sist_movimento: match.nrMovimento,
                    sist_volume: sistVolume,
                    sist_asfalto: sistAsfalto,
                    sist_terra: sistTerra,
                    sist_tarifa: tarifaReferencia,
                    difTarifa: diffTarifa,
                    sist_valor: sistValorBruto,
                    difValor: diffValor,
                    difCondicaoVsSgf: diffCondicaoVsSgf,
                    difLiquidoVsSgf: diffLiquidoVsSgf,
                    flagsErro: [],
                    motivo: 'Conciliada sem divergências'
                });
            }
        }
    });

    const faltantesNoQdp = [];
    viagensSgf.forEach(v => {
        if (!v._usada) {
            const tarifaEsp = calcularTarifaPeloTarifadorSGF(v.asfalto, v.terra);
            const valEsp = v.volume * tarifaEsp;
            somaVolSgf += v.volume;
            somaCalculadoSgf += valEsp;
            impFinanceiroFaltamQdp += valEsp;

            const itemFaltanteQdp = {
                nrMovimento: v.nrMovimento || 'SEM-MOV',
                nf: '-',
                placa: v.placa,
                meioTransporte: '-',
                up: v.up || '-',
                municipio: '-',
                transportadora: v.transportadora,
                dataStr: v.dataStr,
                keyData: v.keyData,
                volume: 0,
                asfalto: 0,
                terra: 0,
                tarifa: 0,
                valorBrutoQdp: 0,
                valorLiquido: 0,
                valorQdpComparado: 0,
                descontoInternoQdp: 0,
                status: 'FALTANTE_QDP',
                statusLabel: 'FALTA NO QDP',
                sist_movimento: v.nrMovimento,
                sist_volume: v.volume,
                sist_asfalto: v.asfalto,
                sist_terra: v.terra,
                sist_tarifa: tarifaEsp,
                difTarifa: -tarifaEsp,
                sist_valor: valEsp,
                difValor: -valEsp,
                difCondicaoVsSgf: -valEsp,
                difLiquidoVsSgf: -valEsp,
                flagsErro: ['FALTANTE_QDP'],
                motivo: 'Viagem consta no SGF, mas não veio no QDP da Suzano'
            };
            faltantesNoQdp.push(itemFaltanteQdp);
            resultado.push(itemFaltanteQdp);
        }
    });

    window.qdpResultadoConciliacao = resultado;
    window.qdpFaltantesNoQdp = faltantesNoQdp;
    window.qdpResumoCache = {
        metaInfo,
        desinvertido: desinverterQdp,
        modoColunaValor,
        totalQdp: linhasBrutas.length,
        totalSgf: viagensSgf.length,
        countOk,
        countDivergentes,
        countFaltantesSgf,
        countFaltantesQdp: faltantesNoQdp.length,
        somaVolQdp,
        somaVolSgf,
        somaBrutoQdp,
        somaLiqQdp,
        somaConsideradoQdp,
        somaCalculadoSgf,
        impFinanceiroCorteLiquido,
        impFinanceiroTarifa,
        impFinanceiroVolume,
        impFinanceiroFaltamSgf,
        impFinanceiroFaltamQdp
    };

    salvarCacheQdpDif();
    atualizarPainelQdpDif();
    mostrarLoadingQdp(false);
}

function atualizarPainelQdpDif() {
    const r = window.qdpResumoCache;
    if (!r) return;

    const fmtMoney = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    document.getElementById('kpi-total-qdp').innerText = r.totalQdp.toLocaleString('pt-BR');
    document.getElementById('sub-vol-qdp').innerText = `Volume QDP: ${r.somaVolQdp.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³`;

    document.getElementById('kpi-total-sist').innerText = r.totalSgf.toLocaleString('pt-BR');
    document.getElementById('sub-batidas-sist').innerText = `Conciliadas OK: ${r.countOk.toLocaleString('pt-BR')} viagens`;

    document.getElementById('kpi-faltantes-sgf').innerText = r.countFaltantesSgf.toLocaleString('pt-BR');
    document.getElementById('kpi-faltantes-qdp').innerText = r.countFaltantesQdp.toLocaleString('pt-BR');
    document.getElementById('kpi-divergentes').innerText = r.countDivergentes.toLocaleString('pt-BR');

    document.getElementById('periodoQdpIdentificado').innerText = r.metaInfo.periodoStr;
    document.getElementById('valTotalCalculadoSgf').innerText = fmtMoney(r.somaCalculadoSgf);
    document.getElementById('valTotalBrutoQdp').innerText = fmtMoney(r.somaBrutoQdp);
    document.getElementById('valTotalLiqQdp').innerText = fmtMoney(r.somaLiqQdp);

    const descontoQdp = r.somaBrutoQdp - r.somaLiqQdp;
    const elDesconto = document.getElementById('valDescontoIndevidoQdp');
    if (elDesconto) {
        elDesconto.innerText = `-${fmtMoney(Math.abs(descontoQdp))}`;
    }

    const isLiquido = r.modoColunaValor === 'LIQUIDO';
    const valorQdpBase = isLiquido ? r.somaLiqQdp : r.somaBrutoQdp;
    const difQdpMenosSgf = valorQdpBase - r.somaCalculadoSgf;
    const difSgfMenosQdp = r.somaCalculadoSgf - valorQdpBase;

    const lblTitDif = document.getElementById('lblTituloDiferencaFin');
    if (lblTitDif) {
        lblTitDif.innerText = isLiquido ? 'Diferença (QDP Líquido vs SGF)' : 'Diferença (QDP Condição vs SGF)';
    }

    const thDif = document.getElementById('thColunaDifValor');
    if (thDif) {
        thDif.innerHTML = isLiquido
            ? `Dif. R$<br><span class="text-[9px] text-amber-400">(Líq. QDP - SGF)</span>`
            : `Dif. R$<br><span class="text-[9px] text-sky-400">(Cond. QDP - SGF)</span>`;
    }

    const boxCond = document.getElementById('boxCardCondicaoQdp');
    const boxLiq = document.getElementById('boxCardLiquidoQdp');
    if (boxCond && boxLiq) {
        if (isLiquido) {
            boxLiq.className = "border-r border-slate-700/50 pr-2 bg-amber-500/10 rounded-lg py-1 ring-1 ring-amber-500/40";
            boxCond.className = "border-r border-slate-700/50 pr-2 opacity-80";
        } else {
            boxCond.className = "border-r border-slate-700/50 pr-2 bg-sky-500/10 rounded-lg py-1 ring-1 ring-sky-500/40";
            boxLiq.className = "border-r border-slate-700/50 pr-2 opacity-80";
        }
    }

    const elDif = document.getElementById('valDiferencaFinanceira');
    const elSubDif = document.getElementById('subDiferencaFinanceira');
    if (elDif) {
        elDif.innerText = `${difQdpMenosSgf >= 0 ? '+' : ''}${fmtMoney(difQdpMenosSgf)}`;
        elDif.className = `text-base font-black font-mono mt-1 ${Math.abs(difQdpMenosSgf) < 5 ? 'text-emerald-400' : (difQdpMenosSgf > 0 ? 'text-sky-400' : 'text-rose-400')}`;
    }
    if (elSubDif) {
        if (difSgfMenosQdp > 5) {
            elSubDif.innerText = `SGF - QDP: Falta ${fmtMoney(difSgfMenosQdp)}`;
            elSubDif.className = "text-[10px] font-mono text-rose-300 font-bold mt-0.5";
        } else if (difSgfMenosQdp < -5) {
            elSubDif.innerText = `QDP acima do SGF em ${fmtMoney(Math.abs(difSgfMenosQdp))}`;
            elSubDif.className = "text-[10px] font-mono text-sky-300 font-bold mt-0.5";
        } else {
            elSubDif.innerText = `Valores conciliados`;
            elSubDif.className = "text-[10px] font-mono text-emerald-400 mt-0.5";
        }
    }

    // Atualiza Diagnóstico de Causas Raiz
    const painelCausas = document.getElementById('painelCausasRaizQdp');
    if (painelCausas) {
        painelCausas.classList.remove('hidden');
        const qtdCorteLiq = window.qdpResultadoConciliacao.filter(x => x.flagsErro && x.flagsErro.includes('DESCONTO_LIQUIDO')).length;
        const qtdErroTarifa = window.qdpResultadoConciliacao.filter(x => x.flagsErro && x.flagsErro.includes('TARIFA')).length;
        const qtdErroDist = window.qdpResultadoConciliacao.filter(x => x.flagsErro && x.flagsErro.includes('DISTANCIA')).length;

        document.getElementById('causa-val-liquido').innerText = `-${fmtMoney(Math.abs(descontoQdp))}`;
        document.getElementById('causa-qtd-liquido').innerText = `${qtdCorteLiq} viagens com desconto`;

        document.getElementById('causa-val-tarifa').innerText = `${(r.impFinanceiroTarifa || 0) >= 0 ? '+' : ''}${fmtMoney(r.impFinanceiroTarifa || 0)}`;
        document.getElementById('causa-qtd-tarifa').innerText = `${qtdErroTarifa} viagens com tarifa dif.`;

        document.getElementById('causa-val-distancia').innerText = `${qtdErroDist} viagens`;
        document.getElementById('causa-qtd-distancia').innerText = `Divergência de km Asf/Ter`;

        document.getElementById('causa-val-faltam-qdp').innerText = `-${fmtMoney(r.impFinanceiroFaltamQdp || 0)}`;
        document.getElementById('causa-qtd-faltam-qdp').innerText = `${r.countFaltantesQdp} viagens não pagas`;

        document.getElementById('causa-val-faltam-sgf').innerText = `+${fmtMoney(r.impFinanceiroFaltamSgf || 0)}`;
        document.getElementById('causa-qtd-faltam-sgf').innerText = `${r.countFaltantesSgf} viagens só no QDP`;
    }

    const infoAba = document.getElementById('infoAbaLidaQdp');
    if (infoAba) {
        const nomeCol = isLiquido ? 'Valor líquido (c/ desconto)' : 'Valor condição (s/ desconto)';
        infoAba.innerText = `Arquivo: ${r.metaInfo.fileName} | Base Cálculo: ${nomeCol} | Asfalto/Terra: ${r.desinvertido ? 'Desinvertido' : 'Original'}`;
    }

    document.getElementById('btnResumoEmailQdp')?.classList.remove('hidden');
    document.getElementById('btnExportarQdpDif')?.classList.remove('hidden');
    document.getElementById('btnLimparCacheQdp')?.classList.remove('hidden');

    popularFiltroUpsQdp();
    renderizarTabelaQdp();
}

function popularFiltroUpsQdp() {
    const selectUp = document.getElementById('filtroUpQdp');
    if (!selectUp) return;

    const ups = new Set();
    window.qdpResultadoConciliacao.forEach(item => {
        if (item.up && item.up !== '-') ups.add(item.up);
    });

    const valAtual = selectUp.value;
    let html = '<option value="">Todas as UPs</option>';
    Array.from(ups).sort().forEach(u => {
        html += `<option value="${u}">${u}</option>`;
    });
    selectUp.innerHTML = html;
    if (valAtual && ups.has(valAtual)) selectUp.value = valAtual;
}

window.filtrarPorCardQdp = function(statusDesejado) {
    const selectStatus = document.getElementById('filtroStatusQdp');
    const selectMotivo = document.getElementById('filtroMotivoQdp');
    if (selectMotivo) selectMotivo.value = '';
    if (selectStatus) {
        selectStatus.value = statusDesejado;
        renderizarTabelaQdp();
    }
};

window.filtrarPorMotivoDiretoQdp = function(motivoDesejado) {
    const selectStatus = document.getElementById('filtroStatusQdp');
    const selectMotivo = document.getElementById('filtroMotivoQdp');
    if (selectStatus) selectStatus.value = 'TODOS';
    if (selectMotivo) {
        selectMotivo.value = motivoDesejado;
        renderizarTabelaQdp();
    }
};

window.renderizarTabelaQdp = function() {
    const tbody = document.getElementById('tbodyQdpDif');
    if (!tbody) return;

    if (!window.qdpResultadoConciliacao || window.qdpResultadoConciliacao.length === 0) {
        tbody.innerHTML = `<tr><td colspan="15" class="text-center p-10 text-slate-500 font-medium">Nenhum dado importado ainda.</td></tr>`;
        return;
    }

    const filtroStatus = document.getElementById('filtroStatusQdp')?.value || 'TODOS';
    const filtroMotivo = document.getElementById('filtroMotivoQdp')?.value || '';
    const filtroUp = document.getElementById('filtroUpQdp')?.value || '';
    const termoBusca = (document.getElementById('inputBuscaQdp')?.value || '').trim().toUpperCase();

    const filtrados = window.qdpResultadoConciliacao.filter(item => {
        if (filtroStatus === 'PROBLEMAS' && item.status === 'OK') return false;
        if (filtroStatus !== 'TODOS' && filtroStatus !== 'PROBLEMAS' && item.status !== filtroStatus) return false;

        if (filtroMotivo && (!item.flagsErro || !item.flagsErro.includes(filtroMotivo))) return false;
        if (filtroUp && item.up !== filtroUp) return false;

        if (termoBusca) {
            const matchMov = String(item.nrMovimento).toUpperCase().includes(termoBusca);
            const matchPlaca = String(item.placa).toUpperCase().includes(termoBusca);
            const matchUp = String(item.up).toUpperCase().includes(termoBusca);
            if (!matchMov && !matchPlaca && !matchUp) return false;
        }
        return true;
    });

    const lblCount = document.getElementById('contadorLinhasQdp');
    if (lblCount) lblCount.innerText = `${filtrados.length.toLocaleString('pt-BR')} registros exibidos`;

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="15" class="text-center p-8 text-slate-500 font-medium">Nenhuma viagem encontrada para os filtros selecionados.</td></tr>`;
        return;
    }

    const fmtMoney = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const isLiquido = (window.qdpResumoCache?.modoColunaValor || 'LIQUIDO') === 'LIQUIDO';

    const rowsHtml = filtrados.map(q => {
        let badgeClass = '';
        if (q.status === 'OK') badgeClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
        else if (q.status === 'DIVERGENTE') badgeClass = 'bg-amber-500/20 text-amber-400 border-amber-500/50';
        else if (q.status === 'FALTANTE_SGF') badgeClass = 'bg-rose-500/20 text-rose-400 border-rose-500/50';
        else badgeClass = 'bg-purple-500/20 text-purple-400 border-purple-500/50';

        const errVol = q.status === 'DIVERGENTE' && Math.abs(q.volume - q.sist_volume) > 0.2;
        const errAsf = q.status === 'DIVERGENTE' && Math.abs(q.asfalto - q.sist_asfalto) > 0.5;
        const errTer = q.status === 'DIVERGENTE' && Math.abs(q.terra - q.sist_terra) > 0.5;
        const errTar = q.status === 'DIVERGENTE' && q.sist_tarifa > 0 && Math.abs(q.tarifa - q.sist_tarifa) > 0.05;

        const strVol = q.status === 'FALTANTE_SGF'
            ? `${q.volume.toFixed(2)} / <span class="text-rose-400">Falta</span>`
            : (q.status === 'FALTANTE_QDP'
                ? `<span class="text-purple-400">Falta</span> / ${q.sist_volume.toFixed(2)}`
                : `<span class="${errVol ? 'text-amber-400 font-bold' : ''}">${q.volume.toFixed(2)} / ${q.sist_volume.toFixed(2)}</span>`);

        const strAsf = q.status === 'FALTANTE_SGF'
            ? `${q.asfalto.toFixed(2)} / -`
            : (q.status === 'FALTANTE_QDP'
                ? `- / ${q.sist_asfalto.toFixed(2)}`
                : `<span class="${errAsf ? 'text-amber-400 font-bold' : ''}">${q.asfalto.toFixed(2)} / ${q.sist_asfalto.toFixed(2)}</span>`);

        const strTer = q.status === 'FALTANTE_SGF'
            ? `${q.terra.toFixed(2)} / -`
            : (q.status === 'FALTANTE_QDP'
                ? `- / ${q.sist_terra.toFixed(2)}`
                : `<span class="${errTer ? 'text-amber-400 font-bold' : ''}">${q.terra.toFixed(2)} / ${q.sist_terra.toFixed(2)}</span>`);

        const strTarQdp = q.status === 'FALTANTE_QDP' ? '-' : fmtMoney(q.tarifa);
        const strTarSgf = q.sist_tarifa > 0 ? fmtMoney(q.sist_tarifa) : '-';

        const strValCondicao = q.status === 'FALTANTE_QDP' ? '-' : fmtMoney(q.valorBrutoQdp);
        const strValLiquido = q.status === 'FALTANTE_QDP' ? '-' : fmtMoney(q.valorLiquido);
        const strValSgf = q.status === 'FALTANTE_SGF' ? '-' : fmtMoney(q.sist_valor);

        const corDif = Math.abs(q.difValor) < 1.5 ? 'text-slate-400' : (q.difValor > 0 ? 'text-sky-400 font-bold' : 'text-rose-400 font-bold');

        return `<tr class="hover:bg-slate-700/30 transition-colors divide-x divide-slate-800/60">
            <td class="px-3 py-2.5 text-center whitespace-nowrap"><span class="px-2 py-0.5 text-[10px] font-bold rounded border ${badgeClass}">${q.statusLabel}</span></td>
            <td class="px-3 py-2.5 text-center font-mono text-white font-bold whitespace-nowrap">${q.nrMovimento}</td>
            <td class="px-3 py-2.5 text-center font-mono text-slate-300 whitespace-nowrap">${q.dataStr}</td>
            <td class="px-3 py-2.5 text-center whitespace-nowrap">
                <span class="bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-sky-400 font-mono font-bold">${q.placa}</span>
            </td>
            <td class="px-3 py-2.5 text-center font-mono text-emerald-400 font-bold whitespace-nowrap">${q.up || '-'}</td>
            <td class="px-3 py-2.5 text-center font-mono whitespace-nowrap">${strVol}</td>
            <td class="px-3 py-2.5 text-center font-mono whitespace-nowrap">${strAsf}</td>
            <td class="px-3 py-2.5 text-center font-mono whitespace-nowrap">${strTer}</td>
            <td class="px-3 py-2.5 text-center font-mono font-bold text-sky-300 whitespace-nowrap">${strTarQdp}</td>
            <td class="px-3 py-2.5 text-center font-mono font-bold ${errTar ? 'text-amber-400' : 'text-emerald-400'} whitespace-nowrap">${strTarSgf}</td>
            <td class="px-3 py-2.5 text-center font-mono whitespace-nowrap ${!isLiquido ? 'text-white font-bold bg-sky-500/5' : 'text-slate-400'}">${strValCondicao}</td>
            <td class="px-3 py-2.5 text-center font-mono whitespace-nowrap ${isLiquido ? 'text-amber-300 font-bold bg-amber-500/5' : 'text-slate-400'}">${strValLiquido}</td>
            <td class="px-3 py-2.5 text-center font-mono font-bold text-emerald-400 whitespace-nowrap">${strValSgf}</td>
            <td class="px-3 py-2.5 text-center font-mono whitespace-nowrap ${corDif}">${q.difValor >= 0 ? '+' : ''}${fmtMoney(q.difValor)}</td>
            <td class="px-3 py-2.5 text-[11px] font-semibold ${q.status === 'OK' ? 'text-slate-400' : 'text-amber-300'}">${q.motivo}</td>
        </tr>`;
    }).join('');

    tbody.innerHTML = rowsHtml;
};

// =========================================================
// AGRUPAMENTO POR UP E GERADOR DE RESUMO EXECUTIVO
// =========================================================
function montarDadosAgrupadosPorUp() {
    const mapaUp = {};
    window.qdpResultadoConciliacao.forEach(q => {
        const up = q.up || 'SEM UP';
        if (!mapaUp[up]) {
            mapaUp[up] = {
                up,
                municipio: q.municipio || '-',
                viagensQdp: 0,
                viagensSgf: 0,
                faltantesSgf: 0,
                faltantesQdp: 0,
                divergentes: 0,
                volQdp: 0,
                volSgf: 0,
                asfaltoQdp: q.asfalto || 0,
                terraQdp: q.terra || 0,
                asfaltoSgf: q.sist_asfalto || 0,
                terraSgf: q.sist_terra || 0,
                tarifaQdp: q.tarifa || 0,
                nossaTarifa: q.sist_tarifa || 0,
                valorCondicaoQdp: 0,
                valorLiquidoQdp: 0,
                valorSgf: 0,
                difValorEscolhido: 0
            };
        }
        const m = mapaUp[up];
        if (q.status !== 'FALTANTE_QDP') {
            m.viagensQdp++;
            m.volQdp += q.volume;
            m.valorCondicaoQdp += q.valorBrutoQdp;
            m.valorLiquidoQdp += q.valorLiquido;
            if (q.asfalto > 0) m.asfaltoQdp = q.asfalto;
            if (q.terra > 0) m.terraQdp = q.terra;
            if (q.tarifa > 0) m.tarifaQdp = q.tarifa;
        }
        if (q.status !== 'FALTANTE_SGF') {
            m.viagensSgf++;
            m.volSgf += q.sist_volume;
            m.valorSgf += q.sist_valor;
            if (q.sist_asfalto > 0) m.asfaltoSgf = q.sist_asfalto;
            if (q.sist_terra > 0) m.terraSgf = q.sist_terra;
            if (q.sist_tarifa > 0) m.nossaTarifa = q.sist_tarifa;
        }
        if (q.status === 'FALTANTE_SGF') m.faltantesSgf++;
        if (q.status === 'FALTANTE_QDP') m.faltantesQdp++;
        if (q.status === 'DIVERGENTE') m.divergentes++;
        m.difValorEscolhido += q.difValor;
    });
    return Object.values(mapaUp).sort((a, b) => Math.abs(b.difValorEscolhido) - Math.abs(a.difValorEscolhido));
}

window.abrirModalResumoEmailQdp = function() {
    const r = window.qdpResumoCache;
    if (!r) return;

    const fmtMoney = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const fmtNum = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const qtdErroDist = window.qdpResultadoConciliacao.filter(x => x.flagsErro && x.flagsErro.includes('DISTANCIA')).length;
    const qtdErroTarifa = window.qdpResultadoConciliacao.filter(x => x.flagsErro && x.flagsErro.includes('TARIFA')).length;
    const qtdErroVol = window.qdpResultadoConciliacao.filter(x => x.flagsErro && x.flagsErro.includes('VOLUME')).length;
    const qtdCorteLiq = window.qdpResultadoConciliacao.filter(x => x.flagsErro && x.flagsErro.includes('DESCONTO_LIQUIDO')).length;

    const difLiquidoVsSgf = r.somaLiqQdp - r.somaCalculadoSgf;
    const faltaPagarLiquido = r.somaCalculadoSgf - r.somaLiqQdp;
    const difCondicaoVsSgf = r.somaBrutoQdp - r.somaCalculadoSgf;
    const descontoEntreCondicaoELiquido = r.somaBrutoQdp - r.somaLiqQdp;

    const resumoUps = montarDadosAgrupadosPorUp();

    // Monta Tabela HTML Rica (Com bordas e cores inline) para colar direto no Outlook / Gmail
    let linhasUpHtml = resumoUps.map(u => {
        const difLiqSgf = u.valorLiquidoQdp - u.valorSgf;
        const difCondSgf = u.valorCondicaoQdp - u.valorSgf;
        return `<tr>
            <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:center; font-weight:bold;">${u.up}</td>
            <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:center;">${u.municipio}</td>
            <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:center;">${u.viagensQdp} / ${u.viagensSgf}</td>
            <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:center;">${fmtNum(u.volQdp)} / ${fmtNum(u.volSgf)}</td>
            <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:center;">${u.asfaltoQdp.toFixed(1)} / ${u.asfaltoSgf.toFixed(1)}</td>
            <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:center;">${u.terraQdp.toFixed(1)} / ${u.terraSgf.toFixed(1)}</td>
            <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:center;">${fmtMoney(u.tarifaQdp)}</td>
            <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:center; font-weight:bold; color:#047857;">${fmtMoney(u.nossaTarifa)}</td>
            <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:center; font-weight:bold;">${fmtMoney(u.valorSgf)}</td>
            <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:center;">${fmtMoney(u.valorCondicaoQdp)}</td>
            <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:center; color:#b45309; font-weight:bold;">${fmtMoney(u.valorLiquidoQdp)}</td>
            <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:center; color:${difCondSgf < 0 ? '#be123c' : '#0369a1'}; font-weight:bold;">${fmtMoney(difCondSgf)}</td>
            <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:center; color:${difLiqSgf < 0 ? '#be123c' : '#0369a1'}; font-weight:bold;">${fmtMoney(difLiqSgf)}</td>
        </tr>`;
    }).join('');

    const tabelaHtmlEmail = `
        <div id="conteudoHtmlCopiavelEmail" style="font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; background: #ffffff; padding: 16px; border-radius: 8px;">
            <h3 style="margin: 0 0 10px 0; color: #0f172a; font-size: 15px; border-bottom: 2px solid #0f172a; padding-bottom: 6px;">
                RESUMO EXECUTIVO DE AUDITORIA: QDP SUZANO vs SGF SERRANALOG (${r.metaInfo.periodoStr})
            </h3>
            <table style="border-collapse: collapse; width: 100%; margin-bottom: 16px; font-size: 12px;">
                <thead>
                    <tr style="background-color: #0f172a; color: #ffffff;">
                        <th style="border:1px solid #334155; padding:8px; text-align:left;">INDICADOR FINANCEIRO / OPERACIONAL</th>
                        <th style="border:1px solid #334155; padding:8px; text-align:center;">NOSSO SGF (DEVERIA SER)</th>
                        <th style="border:1px solid #334155; padding:8px; text-align:center;">QDP VALOR CONDIÇÃO (S/ DESC.)</th>
                        <th style="border:1px solid #334155; padding:8px; text-align:center;">QDP VALOR LÍQUIDO (CONSIDERADO)</th>
                        <th style="border:1px solid #334155; padding:8px; text-align:center;">DIFERENÇA (LÍQUIDO - SGF)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="border:1px solid #cbd5e1; padding:7px 8px; font-weight:bold;">Faturamento Total Apurado (R$)</td>
                        <td style="border:1px solid #cbd5e1; padding:7px 8px; text-align:center; font-weight:bold; color:#047857;">${fmtMoney(r.somaCalculadoSgf)}</td>
                        <td style="border:1px solid #cbd5e1; padding:7px 8px; text-align:center; font-weight:bold;">${fmtMoney(r.somaBrutoQdp)}</td>
                        <td style="border:1px solid #cbd5e1; padding:7px 8px; text-align:center; font-weight:bold; color:#b45309;">${fmtMoney(r.somaLiqQdp)}</td>
                        <td style="border:1px solid #cbd5e1; padding:7px 8px; text-align:center; font-weight:bold; color:#be123c; background:#ffe4e6;">${fmtMoney(difLiquidoVsSgf)} (Falta ${fmtMoney(faltaPagarLiquido)})</td>
                    </tr>
                    <tr>
                        <td style="border:1px solid #cbd5e1; padding:7px 8px; font-weight:bold;">Quantidade de Viagens / Volume (m³)</td>
                        <td style="border:1px solid #cbd5e1; padding:7px 8px; text-align:center;">${r.totalSgf} viagens (${fmtNum(r.somaVolSgf || 0)} m³)</td>
                        <td style="border:1px solid #cbd5e1; padding:7px 8px; text-align:center;" colspan="2">${r.totalQdp} viagens (${fmtNum(r.somaVolQdp)} m³)</td>
                        <td style="border:1px solid #cbd5e1; padding:7px 8px; text-align:center; font-weight:bold;">Faltam no QDP: ${r.countFaltantesQdp} | Faltam no SGF: ${r.countFaltantesSgf}</td>
                    </tr>
                    <tr>
                        <td style="border:1px solid #cbd5e1; padding:7px 8px; font-weight:bold;">Diagnóstico das Divergências</td>
                        <td style="border:1px solid #cbd5e1; padding:7px 8px; text-align:center;" colspan="4">
                            <b>Corte no Valor Líquido (Condição - Líquido):</b> -${fmtMoney(descontoEntreCondicaoELiquido)} (${qtdCorteLiq} viagens) |
                            <b>Dif. se usado Valor Condição:</b> ${fmtMoney(difCondicaoVsSgf)} |
                            <b>Erros Tarifa:</b> ${qtdErroTarifa} |
                            <b>Erros Distância:</b> ${qtdErroDist} (Colunas Asfalto/Terra invertidas no QDP)
                        </td>
                    </tr>
                </tbody>
            </table>

            <h4 style="margin: 12px 0 6px 0; color: #0f172a; font-size: 13px;">QUADRO COMPARATIVO POR UP / PROJETO:</h4>
            <table style="border-collapse: collapse; width: 100%; font-size: 11px;">
                <thead>
                    <tr style="background-color: #1e293b; color: #ffffff;">
                        <th style="border:1px solid #334155; padding:6px; text-align:center;">UP</th>
                        <th style="border:1px solid #334155; padding:6px; text-align:center;">Município</th>
                        <th style="border:1px solid #334155; padding:6px; text-align:center;">Viagens (QDP/SGF)</th>
                        <th style="border:1px solid #334155; padding:6px; text-align:center;">Volume m³ (QDP/SGF)</th>
                        <th style="border:1px solid #334155; padding:6px; text-align:center;">Asfalto km (QDP/SGF)</th>
                        <th style="border:1px solid #334155; padding:6px; text-align:center;">Terra km (QDP/SGF)</th>
                        <th style="border:1px solid #334155; padding:6px; text-align:center;">Tarifa QDP</th>
                        <th style="border:1px solid #334155; padding:6px; text-align:center;">Nossa Tarifa</th>
                        <th style="border:1px solid #334155; padding:6px; text-align:center;">Nosso Valor SGF</th>
                        <th style="border:1px solid #334155; padding:6px; text-align:center;">QDP Condição</th>
                        <th style="border:1px solid #334155; padding:6px; text-align:center;">QDP Líquido</th>
                        <th style="border:1px solid #334155; padding:6px; text-align:center;">Dif (Cond - SGF)</th>
                        <th style="border:1px solid #334155; padding:6px; text-align:center;">Dif (Líq - SGF)</th>
                    </tr>
                </thead>
                <tbody>
                    ${linhasUpHtml}
                </tbody>
            </table>
        </div>
    `;

    const containerHtml = document.getElementById('containerTabelaHtmlEmail');
    if (containerHtml) containerHtml.innerHTML = tabelaHtmlEmail;

    let linhasUpTexto = resumoUps.map(u => {
        const difTar = u.tarifaQdp - u.nossaTarifa;
        return `  • UP ${u.up.padEnd(7, ' ')} | Viagens (QDP: ${u.viagensQdp} / SGF: ${u.viagensSgf}) | Dist. QDP (Asf: ${u.asfaltoQdp.toFixed(1)} / Ter: ${u.terraQdp.toFixed(1)} km) vs SGF (Asf: ${u.asfaltoSgf.toFixed(1)} / Ter: ${u.terraSgf.toFixed(1)} km) | Tarifa QDP: ${fmtMoney(u.tarifaQdp)} vs Nossa Tarifa: ${fmtMoney(u.nossaTarifa)} (Dif: ${fmtMoney(difTar)}) | Nosso SGF: ${fmtMoney(u.valorSgf)} | QDP Condição: ${fmtMoney(u.valorCondicaoQdp)} | QDP Líquido: ${fmtMoney(u.valorLiquidoQdp)}`;
    }).join('\n');

    const listaFaltantesQdp = window.qdpResultadoConciliacao.filter(x => x.status === 'FALTANTE_QDP');
    const listaFaltantesSgf = window.qdpResultadoConciliacao.filter(x => x.status === 'FALTANTE_SGF');

    let blocoFaltantes = '';
    if (listaFaltantesQdp.length > 0) {
        blocoFaltantes += `\n4. VIAGENS REALIZADAS (SGF) QUE NÃO CONSTAM NO QDP (${listaFaltantesQdp.length} viagens - Impacto: -${fmtMoney(r.impFinanceiroFaltamQdp || 0)}):\n`;
        blocoFaltantes += listaFaltantesQdp.slice(0, 25).map(v => `  - Mov: ${v.nrMovimento} | Data: ${v.dataStr} | Placa: ${v.placa} | UP: ${v.up} | Vol: ${v.sist_volume.toFixed(2)} m³ | Valor SGF: ${fmtMoney(v.sist_valor)}`).join('\n');
        if (listaFaltantesQdp.length > 25) blocoFaltantes += `\n  (... e mais ${listaFaltantesQdp.length - 25} viagens na aba '4. Viagens Faltantes' da planilha anexa)`;
    }
    if (listaFaltantesSgf.length > 0) {
        blocoFaltantes += `\n\n5. VIAGENS NO QDP NÃO LOCALIZADAS NO SGF (${listaFaltantesSgf.length} viagens):\n`;
        blocoFaltantes += listaFaltantesSgf.slice(0, 25).map(v => `  - Mov: ${v.nrMovimento} | Data: ${v.dataStr} | Placa: ${v.placa} | UP: ${v.up} | Vol: ${v.volume.toFixed(2)} m³ | Valor Condição QDP: ${fmtMoney(v.valorBrutoQdp)}`).join('\n');
    }

    const textoEmail = `Prezados,

Segue o Resumo Executivo da Auditoria e Conciliação do QDP (${r.metaInfo.periodoStr}), cruzando os dados enviados pela Suzano com o nosso controle operacional SGF e Tarifador Vigente:

================================================================================
1. SÍNTESE FINANCEIRA DIRETA (POR QUE OS VALORES NÃO BATEM)
================================================================================
  • Nosso Valor SGF (Deveria Ser): ................... ${fmtMoney(r.somaCalculadoSgf)}
  • Valor QDP (Coluna 'Valor condição' s/ desconto): . ${fmtMoney(r.somaBrutoQdp)}
  • Valor Líquido QDP (Coluna 'Valor líquido' pago): . ${fmtMoney(r.somaLiqQdp)}
  ------------------------------------------------------------------------------
  ► DIFERENÇA (Nosso SGF - Valor Líquido QDP): ....... Falta pagar ${fmtMoney(faltaPagarLiquido)} (${fmtMoney(difLiquidoVsSgf)})
  ► Desconto aplicado no QDP (Condição - Líquido): ... -${fmtMoney(descontoEntreCondicaoELiquido)} (em ${qtdCorteLiq} viagens)
  ► Diferença se usado 'Valor condição' (Cond - SGF):  ${difCondicaoVsSgf >= 0 ? '+' : ''}${fmtMoney(difCondicaoVsSgf)}

  * Diagnóstico Principal:
    1) O QDP está considerando a coluna 'Valor líquido' (${fmtMoney(r.somaLiqQdp)}) com desconto de ${fmtMoney(descontoEntreCondicaoELiquido)}, quando deveria considerar o valor cheio da coluna 'Valor condição' (${fmtMoney(r.somaBrutoQdp)}) sem descontos.
    2) Na planilha do QDP, as colunas 'Distância Asfalto' e 'Distância Terra' estão invertidas (a coluna Asfalto exibe a quilometragem de Terra e vice-versa).

================================================================================
2. BALANÇO DE VIAGENS E CAUSAS OPERACIONAIS (${r.metaInfo.periodoStr})
================================================================================
  • Viagens no QDP: ${r.totalQdp.toLocaleString('pt-BR')} viagens (${fmtNum(r.somaVolQdp)} m³)
  • Viagens no SGF: ${r.totalSgf.toLocaleString('pt-BR')} viagens (${fmtNum(r.somaVolSgf || 0)} m³)
  • Viagens Faltando no QDP (Realizadas no SGF): ${r.countFaltantesQdp} viagens (-${fmtMoney(r.impFinanceiroFaltamQdp || 0)})
  • Viagens Faltando no SGF (Apenas no QDP):     ${r.countFaltantesSgf} viagens (+${fmtMoney(r.impFinanceiroFaltamSgf || 0)})
  • Viagens com Divergência de Tarifa (R$/m³):   ${qtdErroTarifa} viagens (Impacto: ${fmtMoney(r.impFinanceiroTarifa || 0)})
  • Viagens com Divergência de Distância (km):   ${qtdErroDist} viagens
  • Viagens com Divergência de Volume (m³):      ${qtdErroVol} viagens (Impacto: ${fmtMoney(r.impFinanceiroVolume || 0)})

================================================================================
3. RESUMO TABULADO POR UP / PROJETO
================================================================================
${linhasUpTexto}
${blocoFaltantes}

Segue em anexo a planilha Excel devidamente tabulada, formatada em moeda (R$) e separada em 5 abas (1. Resumo Executivo, 2. Resumo por UP, 3. Divergências, 4. Viagens Faltantes e 5. Base Completa) para validação.

Atenciosamente,
Gestão Florestal - Serranalog`;

    const textarea = document.getElementById('textoResumoEmailQdp');
    if (textarea) textarea.value = textoEmail;

    const modal = document.getElementById('modalResumoEmailQdp');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

window.fecharModalResumoEmailQdp = function() {
    const modal = document.getElementById('modalResumoEmailQdp');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

window.copiarTabelaHtmlEmailQdp = function() {
    const el = document.getElementById('conteudoHtmlCopiavelEmail');
    if (!el) return;
    try {
        const blobHtml = new Blob([el.outerHTML], { type: 'text/html' });
        const blobText = new Blob([el.innerText], { type: 'text/plain' });
        const item = new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText });
        navigator.clipboard.write([item]).then(() => {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success',
                    title: 'Tabela Formatada Copiada!',
                    text: 'Cole diretamente no corpo do seu e-mail (Ctrl+V) com todas as bordas e cores.',
                    timer: 2400,
                    showConfirmButton: false,
                    background: '#1e293b',
                    color: '#f8fafc'
                });
            } else {
                alert("Tabela copiada! Cole no seu e-mail com Ctrl+V.");
            }
        });
    } catch (e) {
        copiarResumoEmailQdp();
    }
};

window.copiarResumoEmailQdp = function() {
    const textarea = document.getElementById('textoResumoEmailQdp');
    if (!textarea) return;
    textarea.select();
    navigator.clipboard.writeText(textarea.value).then(() => {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Texto Copiado!',
                text: 'O resumo executivo foi copiado para a área de transferência.',
                timer: 2200,
                showConfirmButton: false,
                background: '#1e293b',
                color: '#f8fafc'
            });
        } else {
            alert("Resumo copiado para a área de transferência!");
        }
    });
};

// =========================================================
// MOTOR DE ESTILIZAÇÃO EXCEL PROFISSIONAL (BORDAS, MOEDA, CENTRALIZAÇÃO)
// =========================================================
function estilizarPlanilhaExcelProfissional(ws, jsonData, opcoes = {}) {
    if (!ws || !jsonData || jsonData.length === 0) return;

    const headers = Object.keys(jsonData[0]);
    const range = XLSX.utils.decode_range(ws['!ref']);

    const borderThin = {
        top: { style: "thin", color: { rgb: "CBD5E1" } },
        bottom: { style: "thin", color: { rgb: "CBD5E1" } },
        left: { style: "thin", color: { rgb: "CBD5E1" } },
        right: { style: "thin", color: { rgb: "CBD5E1" } }
    };

    const borderHeader = {
        top: { style: "medium", color: { rgb: "0F172A" } },
        bottom: { style: "medium", color: { rgb: "0F172A" } },
        left: { style: "thin", color: { rgb: "334155" } },
        right: { style: "thin", color: { rgb: "334155" } }
    };

    // Identifica o tipo de cada coluna pelo título
    const colTypes = headers.map((h, idx) => {
        const hn = h.toUpperCase();
        if (opcoes.isResumoExecutivo) {
            if (idx === 0 || idx === 1 || idx === 5) return 'TEXT_LEFT';
            return 'AUTO_RESUMO';
        }
        if (hn.includes('DIAGNÓSTICO') || hn.includes('MOTIVO') || hn.includes('OBSERVAÇÃO') || hn.includes('EXPLICAÇÃO')) return 'TEXT_LEFT';
        if (hn.includes('(R$)') || hn.includes('VALOR') || hn.includes('TARIFA') || hn.includes('DESCONTO') || hn.includes('IMPACTO') || hn.includes('DIF. (')) return 'CURRENCY';
        if (hn.includes('(M³)') || hn.includes('VOLUME') || hn.includes('(KM)') || hn.includes('ASFALTO') || hn.includes('TERRA')) return 'DECIMAL';
        if (hn.includes('VIAGENS') || hn.includes('FALTAM') || hn.includes('QTD')) return 'INTEGER';
        return 'TEXT_CENTER';
    });

    for (let R = range.s.r; R <= range.e.r; ++R) {
        const isHeader = (R === 0);
        const rowObj = !isHeader ? jsonData[R - 1] : null;
        const isTotalRow = rowObj && Object.values(rowObj).some(v => String(v).toUpperCase().includes('TOTAL GERAL'));
        const isSectionRow = rowObj && String(Object.values(rowObj)[0] || '').startsWith('►');

        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            let cell = ws[cellAddress];
            if (!cell) continue;

            if (isHeader) {
                cell.s = {
                    fill: { fgColor: { rgb: "0F172A" } },
                    font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
                    alignment: { horizontal: "center", vertical: "center", wrapText: true },
                    border: borderHeader
                };
                continue;
            }

            const cType = colTypes[C];
            let bgRgb = (R % 2 === 0) ? "F8FAFC" : "FFFFFF";
            let fontColor = "0F172A";
            let isBold = false;
            let alignH = "center";
            let numFmt = undefined;

            if (isSectionRow) {
                bgRgb = "E2E8F0";
                fontColor = "0F172A";
                isBold = true;
                alignH = (C === 0 || C === 1) ? "left" : "center";
            } else if (isTotalRow) {
                bgRgb = "FEF3C7";
                fontColor = "92400E";
                isBold = true;
            }

            if (cType === 'TEXT_LEFT') {
                alignH = "left";
            } else if (cType === 'CURRENCY') {
                alignH = "center";
                if (typeof cell.v === 'number') {
                    cell.t = 'n';
                    numFmt = 'R$ #,##0.00;[Red]-R$ #,##0.00;"-"';
                    if (cell.v < -0.01 && !isTotalRow) fontColor = "BE123C";
                }
            } else if (cType === 'DECIMAL') {
                alignH = "center";
                if (typeof cell.v === 'number') {
                    cell.t = 'n';
                    numFmt = '#,##0.00';
                }
            } else if (cType === 'INTEGER') {
                alignH = "center";
                if (typeof cell.v === 'number') {
                    cell.t = 'n';
                    numFmt = '#,##0';
                }
            } else if (cType === 'AUTO_RESUMO') {
                alignH = "center";
                const indicadorNome = String(rowObj[headers[1]] || '').toUpperCase();
                if (typeof cell.v === 'number') {
                    cell.t = 'n';
                    if (indicadorNome.includes('(R$)') || indicadorNome.includes('FATURAMENTO') || indicadorNome.includes('FINANCEIR') || indicadorNome.includes('CORTE') || indicadorNome.includes('TARIFA') || indicadorNome.includes('IMPACTO')) {
                        numFmt = 'R$ #,##0.00;[Red]-R$ #,##0.00;"R$ 0,00"';
                        isBold = true;
                        if (cell.v < -0.01) fontColor = "BE123C";
                    } else if (indicadorNome.includes('M³') || indicadorNome.includes('VOLUME') || indicadorNome.includes('CAIXA')) {
                        numFmt = '#,##0.00 "m³"';
                    } else {
                        numFmt = '#,##0';
                    }
                }
            }

            // Destaque suave para a coluna Status
            if (C === 0 && !opcoes.isResumoExecutivo) {
                const stVal = String(cell.v || '').toUpperCase();
                isBold = true;
                if (stVal.includes('CONCILIADA')) { bgRgb = "DCFCE7"; fontColor = "166534"; }
                else if (stVal.includes('DIVERGENTE')) { bgRgb = "FEF3C7"; fontColor = "92400E"; }
                else if (stVal.includes('FALTA NO SGF')) { bgRgb = "FFE4E6"; fontColor = "9F1239"; }
                else if (stVal.includes('FALTA NO QDP')) { bgRgb = "F3E8FF"; fontColor = "6B21A8"; }
            }

            cell.s = {
                fill: { fgColor: { rgb: bgRgb } },
                font: { name: "Calibri", sz: 10, bold: isBold, color: { rgb: fontColor } },
                alignment: { horizontal: alignH, vertical: "center", wrapText: false },
                border: borderThin
            };

            if (numFmt) {
                cell.z = numFmt;
                cell.s.numFmt = numFmt;
            }
        }
    }

    // Calcula largura ideal de cada coluna com folga para máscara R$
    const colWidths = headers.map((k, colIdx) => {
        let maxLen = k.length + 4;
        for (let i = 0; i < Math.min(jsonData.length, 400); i++) {
            const val = jsonData[i][k];
            let strLen = 0;
            if (typeof val === 'number') {
                strLen = colTypes[colIdx] === 'CURRENCY' ? 18 : 12;
            } else if (val !== null && val !== undefined) {
                strLen = String(val).length;
            }
            if (strLen > maxLen) maxLen = strLen;
        }
        return { wch: Math.min(Math.max(maxLen + 4, 14), 58) };
    });
    ws['!cols'] = colWidths;

    // Altura das linhas mais confortável para leitura
    const rowsHeights = [{ hpt: 28 }];
    for (let r = 1; r <= range.e.r; r++) {
        rowsHeights.push({ hpt: 20 });
    }
    ws['!rows'] = rowsHeights;

    if (ws['!ref']) {
        ws['!autofilter'] = { ref: ws['!ref'] };
    }
}

function exportarQdpDifParaExcel() {
    if (!window.qdpResultadoConciliacao || window.qdpResultadoConciliacao.length === 0) {
        alert("Não há dados de auditoria para exportar.");
        return;
    }
    if (typeof XLSX === 'undefined') {
        alert("Biblioteca Excel não carregada.");
        return;
    }

    const r = window.qdpResumoCache;
    const wb = XLSX.utils.book_new();

    const qtdErroDist = window.qdpResultadoConciliacao.filter(x => x.flagsErro && x.flagsErro.includes('DISTANCIA')).length;
    const qtdErroTarifa = window.qdpResultadoConciliacao.filter(x => x.flagsErro && x.flagsErro.includes('TARIFA')).length;
    const qtdErroVol = window.qdpResultadoConciliacao.filter(x => x.flagsErro && x.flagsErro.includes('VOLUME')).length;
    const qtdCorteLiq = window.qdpResultadoConciliacao.filter(x => x.flagsErro && x.flagsErro.includes('DESCONTO_LIQUIDO')).length;

    const difLiquidoVsSgf = r.somaLiqQdp - r.somaCalculadoSgf;
    const faltaPagarSgfMenosLiq = r.somaCalculadoSgf - r.somaLiqQdp;
    const difCondicaoVsSgf = r.somaBrutoQdp - r.somaCalculadoSgf;
    const descontoCondicaoMenosLiq = r.somaBrutoQdp - r.somaLiqQdp;

    const volMedioSgf = r.totalSgf > 0 ? (r.somaVolSgf / r.totalSgf) : 0;
    const volMedioQdp = r.totalQdp > 0 ? (r.somaVolQdp / r.totalQdp) : 0;
    const tarifaMediaSgf = r.somaVolSgf > 0 ? (r.somaCalculadoSgf / r.somaVolSgf) : 0;
    const tarifaMediaCondQdp = r.somaVolQdp > 0 ? (r.somaBrutoQdp / r.somaVolQdp) : 0;
    const tarifaMediaLiqQdp = r.somaVolQdp > 0 ? (r.somaLiqQdp / r.somaVolQdp) : 0;

    // =========================================================================
    // ABA 1: RESUMO EXECUTIVO COMPLETO (ESTRUTURADO EM BLOCOS CLAROS)
    // =========================================================================
    const abaResumoExecutivo = [
        {
            "Bloco Executivo": "► 1. PARÂMETROS DA AUDITORIA",
            "Indicador / Métrica Analisada": "Período de Emissão Auditado (Data Emisão Mvt)",
            "Nosso Controle (SGF)": r.metaInfo.periodoStr,
            "QDP Valor Condição (s/ Desc.)": r.metaInfo.fileName,
            "QDP Valor Líquido (Considerado)": r.modoColunaValor === 'LIQUIDO' ? "Base Ativa: Valor Líquido" : "Base Ativa: Valor Condição",
            "Diferença / Impacto Apurado": r.desinvertido ? "Asfalto/Terra QDP Desinvertido" : "Distâncias Originais",
            "Diagnóstico Executivo / Explicação Direta": `Tarifador SGF utilizado: ${window.tarifadorQdpAtivo ? window.tarifadorQdpAtivo.nome : 'Padrão CTE'}`
        },
        {
            "Bloco Executivo": "► 2. BALANÇO OPERACIONAL",
            "Indicador / Métrica Analisada": "Quantidade Total de Viagens no Período",
            "Nosso Controle (SGF)": r.totalSgf,
            "QDP Valor Condição (s/ Desc.)": r.totalQdp,
            "QDP Valor Líquido (Considerado)": r.totalQdp,
            "Diferença / Impacto Apurado": r.totalQdp - r.totalSgf,
            "Diagnóstico Executivo / Explicação Direta": `Conciliadas OK: ${r.countOk} | Faltam no QDP: ${r.countFaltantesQdp} | Faltam no SGF: ${r.countFaltantesSgf}`
        },
        {
            "Bloco Executivo": "2. BALANÇO OPERACIONAL",
            "Indicador / Métrica Analisada": "Volume Total Transportado (m³)",
            "Nosso Controle (SGF)": Number((r.somaVolSgf || 0).toFixed(2)),
            "QDP Valor Condição (s/ Desc.)": Number(r.somaVolQdp.toFixed(2)),
            "QDP Valor Líquido (Considerado)": Number(r.somaVolQdp.toFixed(2)),
            "Diferença / Impacto Apurado": Number((r.somaVolQdp - (r.somaVolSgf || 0)).toFixed(2)),
            "Diagnóstico Executivo / Explicação Direta": "Diferença física de volume entre a base QDP e o banco SGF"
        },
        {
            "Bloco Executivo": "2. BALANÇO OPERACIONAL",
            "Indicador / Métrica Analisada": "Caixa Média por Viagem (m³)",
            "Nosso Controle (SGF)": Number(volMedioSgf.toFixed(2)),
            "QDP Valor Condição (s/ Desc.)": Number(volMedioQdp.toFixed(2)),
            "QDP Valor Líquido (Considerado)": Number(volMedioQdp.toFixed(2)),
            "Diferença / Impacto Apurado": Number((volMedioQdp - volMedioSgf).toFixed(2)),
            "Diagnóstico Executivo / Explicação Direta": "Volume médio por viagem apurado no período"
        },
        {
            "Bloco Executivo": "► 3. BALANÇO FINANCEIRO (R$)",
            "Indicador / Métrica Analisada": "Faturamento Total Apurado (R$)",
            "Nosso Controle (SGF)": Number(r.somaCalculadoSgf.toFixed(2)),
            "QDP Valor Condição (s/ Desc.)": Number(r.somaBrutoQdp.toFixed(2)),
            "QDP Valor Líquido (Considerado)": Number(r.somaLiqQdp.toFixed(2)),
            "Diferença / Impacto Apurado": Number(difLiquidoVsSgf.toFixed(2)),
            "Diagnóstico Executivo / Explicação Direta": `Suzano está pagando pelo Valor Líquido (Falta pagar R$ ${faltaPagarSgfMenosLiq.toLocaleString('pt-BR', {minimumFractionDigits:2})} frente ao SGF)`
        },
        {
            "Bloco Executivo": "3. BALANÇO FINANCEIRO (R$)",
            "Indicador / Métrica Analisada": "Diferença se Considerado 'Valor condição' (Sem Desconto) (R$)",
            "Nosso Controle (SGF)": Number(r.somaCalculadoSgf.toFixed(2)),
            "QDP Valor Condição (s/ Desc.)": Number(r.somaBrutoQdp.toFixed(2)),
            "QDP Valor Líquido (Considerado)": Number(r.somaBrutoQdp.toFixed(2)),
            "Diferença / Impacto Apurado": Number(difCondicaoVsSgf.toFixed(2)),
            "Diagnóstico Executivo / Explicação Direta": "Caso a Suzano pagasse a coluna 'Valor condição' sem descontos, a diferença seria mínima"
        },
        {
            "Bloco Executivo": "3. BALANÇO FINANCEIRO (R$)",
            "Indicador / Métrica Analisada": "Tarifa Média Efetiva por m³ (R$)",
            "Nosso Controle (SGF)": Number(tarifaMediaSgf.toFixed(2)),
            "QDP Valor Condição (s/ Desc.)": Number(tarifaMediaCondQdp.toFixed(2)),
            "QDP Valor Líquido (Considerado)": Number(tarifaMediaLiqQdp.toFixed(2)),
            "Diferença / Impacto Apurado": Number((tarifaMediaLiqQdp - tarifaMediaSgf).toFixed(2)),
            "Diagnóstico Executivo / Explicação Direta": "Queda na tarifa média efetiva causada pelo corte no Valor Líquido"
        },
        {
            "Bloco Executivo": "► 4. DIAGNÓSTICO POR CAUSA RAIZ (R$)",
            "Indicador / Métrica Analisada": "Causa 1: Corte Indevido no Valor Líquido (Condição - Líquido) (R$)",
            "Nosso Controle (SGF)": 0,
            "QDP Valor Condição (s/ Desc.)": Number(r.somaBrutoQdp.toFixed(2)),
            "QDP Valor Líquido (Considerado)": Number(r.somaLiqQdp.toFixed(2)),
            "Diferença / Impacto Apurado": Number((-descontoCondicaoMenosLiq).toFixed(2)),
            "Diagnóstico Executivo / Explicação Direta": `${qtdCorteLiq} viagens sofreram desconto entre a coluna 'Valor condição' e 'Valor líquido'`
        },
        {
            "Bloco Executivo": "4. DIAGNÓSTICO POR CAUSA RAIZ (R$)",
            "Indicador / Métrica Analisada": "Causa 2: Divergência de Tarifa Unitária (QDP vs Tarifador SGF) (R$)",
            "Nosso Controle (SGF)": Number(tarifaMediaSgf.toFixed(2)),
            "QDP Valor Condição (s/ Desc.)": Number(tarifaMediaCondQdp.toFixed(2)),
            "QDP Valor Líquido (Considerado)": Number(tarifaMediaCondQdp.toFixed(2)),
            "Diferença / Impacto Apurado": Number((r.impFinanceiroTarifa || 0).toFixed(2)),
            "Diagnóstico Executivo / Explicação Direta": `${qtdErroTarifa} viagens com tarifa no QDP diferente da nossa tabela e ${qtdErroDist} com erro de km Asfalto/Terra`
        },
        {
            "Bloco Executivo": "4. DIAGNÓSTICO POR CAUSA RAIZ (R$)",
            "Indicador / Métrica Analisada": "Causa 3: Divergência de Volume nas Viagens Conciliadas (R$)",
            "Nosso Controle (SGF)": Number((r.somaVolSgf || 0).toFixed(2)),
            "QDP Valor Condição (s/ Desc.)": Number(r.somaVolQdp.toFixed(2)),
            "QDP Valor Líquido (Considerado)": Number(r.somaVolQdp.toFixed(2)),
            "Diferença / Impacto Apurado": Number((r.impFinanceiroVolume || 0).toFixed(2)),
            "Diagnóstico Executivo / Explicação Direta": `${qtdErroVol} viagens apresentaram diferença de cubagem (m³) entre QDP e SGF`
        },
        {
            "Bloco Executivo": "4. DIAGNÓSTICO POR CAUSA RAIZ (R$)",
            "Indicador / Métrica Analisada": "Causa 4: Viagens Realizadas no SGF que Faltam no QDP (R$)",
            "Nosso Controle (SGF)": r.countFaltantesQdp,
            "QDP Valor Condição (s/ Desc.)": 0,
            "QDP Valor Líquido (Considerado)": 0,
            "Diferença / Impacto Apurado": Number((-(r.impFinanceiroFaltamQdp || 0)).toFixed(2)),
            "Diagnóstico Executivo / Explicação Direta": `${r.countFaltantesQdp} viagens estão registradas no nosso SGF mas não vieram no QDP para pagamento`
        },
        {
            "Bloco Executivo": "4. DIAGNÓSTICO POR CAUSA RAIZ (R$)",
            "Indicador / Métrica Analisada": "Causa 5: Viagens no QDP que Faltam Lançar no SGF (R$)",
            "Nosso Controle (SGF)": 0,
            "QDP Valor Condição (s/ Desc.)": r.countFaltantesSgf,
            "QDP Valor Líquido (Considerado)": r.countFaltantesSgf,
            "Diferença / Impacto Apurado": Number((r.impFinanceiroFaltamSgf || 0).toFixed(2)),
            "Diagnóstico Executivo / Explicação Direta": `${r.countFaltantesSgf} viagens vieram pagas no QDP mas ainda não constam na base do SGF`
        }
    ];
    const wsResumo = XLSX.utils.json_to_sheet(abaResumoExecutivo);
    estilizarPlanilhaExcelProfissional(wsResumo, abaResumoExecutivo, { isResumoExecutivo: true });
    XLSX.utils.book_append_sheet(wb, wsResumo, "1. Resumo Executivo");

    // =========================================================================
    // ABA 2: RESUMO TABULADO POR UP / PROJETO (COM LINHA DE TOTAL GERAL)
    // =========================================================================
    const dadosUpsBrutos = montarDadosAgrupadosPorUp();
    const resumoUps = dadosUpsBrutos.map(u => ({
        "UP / Projeto": u.up,
        "Município": u.municipio,
        "Viagens QDP": u.viagensQdp,
        "Viagens SGF": u.viagensSgf,
        "Faltam no SGF": u.faltantesSgf,
        "Faltam no QDP": u.faltantesQdp,
        "Com Divergência": u.divergentes,
        "Volume QDP (m³)": Number(u.volQdp.toFixed(2)),
        "Volume SGF (m³)": Number(u.volSgf.toFixed(2)),
        "Asfalto QDP Corrigido (km)": Number(u.asfaltoQdp.toFixed(2)),
        "Asfalto SGF (km)": Number(u.asfaltoSgf.toFixed(2)),
        "Terra QDP Corrigido (km)": Number(u.terraQdp.toFixed(2)),
        "Terra SGF (km)": Number(u.terraSgf.toFixed(2)),
        "Tarifa QDP Considerada (R$)": Number(u.tarifaQdp.toFixed(2)),
        "Nossa Tarifa Deveria Ser (R$)": Number(u.nossaTarifa.toFixed(2)),
        "Diferença Tarifa (R$)": Number((u.tarifaQdp - u.nossaTarifa).toFixed(2)),
        "Nosso Valor SGF (Deveria Ser R$)": Number(u.valorSgf.toFixed(2)),
        "Valor Condição QDP (s/ Desc. R$)": Number(u.valorCondicaoQdp.toFixed(2)),
        "Valor Líquido QDP (c/ Desc. R$)": Number(u.valorLiquidoQdp.toFixed(2)),
        "Desconto QDP (Cond - Líq R$)": Number((u.valorCondicaoQdp - u.valorLiquidoQdp).toFixed(2)),
        "Dif. (Condição QDP - SGF) (R$)": Number((u.valorCondicaoQdp - u.valorSgf).toFixed(2)),
        "Dif. (Líquido QDP - SGF) (R$)": Number((u.valorLiquidoQdp - u.valorSgf).toFixed(2))
    }));

    if (resumoUps.length > 0) {
        resumoUps.push({
            "UP / Projeto": "TOTAL GERAL",
            "Município": `${resumoUps.length} UPs`,
            "Viagens QDP": r.totalQdp,
            "Viagens SGF": r.totalSgf,
            "Faltam no SGF": r.countFaltantesSgf,
            "Faltam no QDP": r.countFaltantesQdp,
            "Com Divergência": r.countDivergentes,
            "Volume QDP (m³)": Number(r.somaVolQdp.toFixed(2)),
            "Volume SGF (m³)": Number((r.somaVolSgf || 0).toFixed(2)),
            "Asfalto QDP Corrigido (km)": 0,
            "Asfalto SGF (km)": 0,
            "Terra QDP Corrigido (km)": 0,
            "Terra SGF (km)": 0,
            "Tarifa QDP Considerada (R$)": Number(tarifaMediaCondQdp.toFixed(2)),
            "Nossa Tarifa Deveria Ser (R$)": Number(tarifaMediaSgf.toFixed(2)),
            "Diferença Tarifa (R$)": Number((tarifaMediaCondQdp - tarifaMediaSgf).toFixed(2)),
            "Nosso Valor SGF (Deveria Ser R$)": Number(r.somaCalculadoSgf.toFixed(2)),
            "Valor Condição QDP (s/ Desc. R$)": Number(r.somaBrutoQdp.toFixed(2)),
            "Valor Líquido QDP (c/ Desc. R$)": Number(r.somaLiqQdp.toFixed(2)),
            "Desconto QDP (Cond - Líq R$)": Number(descontoCondicaoMenosLiq.toFixed(2)),
            "Dif. (Condição QDP - SGF) (R$)": Number(difCondicaoVsSgf.toFixed(2)),
            "Dif. (Líquido QDP - SGF) (R$)": Number(difLiquidoVsSgf.toFixed(2))
        });

        const wsUps = XLSX.utils.json_to_sheet(resumoUps);
        estilizarPlanilhaExcelProfissional(wsUps, resumoUps);
        XLSX.utils.book_append_sheet(wb, wsUps, "2. Resumo por UP");
    }

    // Formatador padrão para as abas de listagem de viagens + Linha de Totalização
    const montarListaFormatadaComTotal = (listaViagens) => {
        const linhas = listaViagens.map(q => ({
            "Status Conciliação": q.statusLabel,
            "Nº Movimento": q.nrMovimento,
            "Data Emissão": q.dataStr,
            "Placa (ID Container)": q.placa,
            "Tipo Conjunto": q.meioTransporte || '-',
            "UP": q.up || '-',
            "Município Partida": q.municipio || '-',
            "Volume QDP (m³)": Number(q.volume.toFixed(2)),
            "Volume SGF (m³)": Number(q.sist_volume.toFixed(2)),
            "Dif. Volume (m³)": Number((q.volume - q.sist_volume).toFixed(2)),
            "Asfalto QDP Corrigido (km)": Number(q.asfalto.toFixed(2)),
            "Asfalto SGF (km)": Number(q.sist_asfalto.toFixed(2)),
            "Dif. Asfalto (km)": Number((q.asfalto - q.sist_asfalto).toFixed(2)),
            "Terra QDP Corrigido (km)": Number(q.terra.toFixed(2)),
            "Terra SGF (km)": Number(q.sist_terra.toFixed(2)),
            "Dif. Terra (km)": Number((q.terra - q.sist_terra).toFixed(2)),
            "Tarifa QDP Considerada (R$)": Number(q.tarifa.toFixed(2)),
            "Nossa Tarifa Deveria Ser (R$)": Number(q.sist_tarifa.toFixed(2)),
            "Dif. Tarifa (R$)": Number((q.difTarifa || 0).toFixed(2)),
            "Nosso Valor SGF (Deveria Ser R$)": Number(q.sist_valor.toFixed(2)),
            "Valor Condição QDP (s/ Desc. R$)": Number(q.valorBrutoQdp.toFixed(2)),
            "Valor Líquido QDP (c/ Desc. R$)": Number(q.valorLiquido.toFixed(2)),
            "Desconto no QDP (Cond - Líq R$)": Number((q.descontoInternoQdp || 0).toFixed(2)),
            "Dif. (Valor Condição - SGF R$)": Number((q.difCondicaoVsSgf || 0).toFixed(2)),
            "Dif. (Valor Líquido - SGF R$)": Number((q.difLiquidoVsSgf || 0).toFixed(2)),
            "Diagnóstico / Motivo da Divergência": q.motivo
        }));

        if (linhas.length > 0) {
            const totVolQdp = listaViagens.reduce((acc, x) => acc + x.volume, 0);
            const totVolSgf = listaViagens.reduce((acc, x) => acc + x.sist_volume, 0);
            const totValSgf = listaViagens.reduce((acc, x) => acc + x.sist_valor, 0);
            const totValCond = listaViagens.reduce((acc, x) => acc + x.valorBrutoQdp, 0);
            const totValLiq = listaViagens.reduce((acc, x) => acc + x.valorLiquido, 0);
            const totDesc = listaViagens.reduce((acc, x) => acc + (x.descontoInternoQdp || 0), 0);
            const totDifCond = listaViagens.reduce((acc, x) => acc + (x.difCondicaoVsSgf || 0), 0);
            const totDifLiq = listaViagens.reduce((acc, x) => acc + (x.difLiquidoVsSgf || 0), 0);

            linhas.push({
                "Status Conciliação": "TOTAL GERAL",
                "Nº Movimento": `${listaViagens.length} viagens`,
                "Data Emissão": "-",
                "Placa (ID Container)": "-",
                "Tipo Conjunto": "-",
                "UP": "-",
                "Município Partida": "-",
                "Volume QDP (m³)": Number(totVolQdp.toFixed(2)),
                "Volume SGF (m³)": Number(totVolSgf.toFixed(2)),
                "Dif. Volume (m³)": Number((totVolQdp - totVolSgf).toFixed(2)),
                "Asfalto QDP Corrigido (km)": 0,
                "Asfalto SGF (km)": 0,
                "Dif. Asfalto (km)": 0,
                "Terra QDP Corrigido (km)": 0,
                "Terra SGF (km)": 0,
                "Dif. Terra (km)": 0,
                "Tarifa QDP Considerada (R$)": 0,
                "Nossa Tarifa Deveria Ser (R$)": 0,
                "Dif. Tarifa (R$)": 0,
                "Nosso Valor SGF (Deveria Ser R$)": Number(totValSgf.toFixed(2)),
                "Valor Condição QDP (s/ Desc. R$)": Number(totValCond.toFixed(2)),
                "Valor Líquido QDP (c/ Desc. R$)": Number(totValLiq.toFixed(2)),
                "Desconto no QDP (Cond - Líq R$)": Number(totDesc.toFixed(2)),
                "Dif. (Valor Condição - SGF R$)": Number(totDifCond.toFixed(2)),
                "Dif. (Valor Líquido - SGF R$)": Number(totDifLiq.toFixed(2)),
                "Diagnóstico / Motivo da Divergência": "Soma consolidada dos registros acima"
            });
        }
        return linhas;
    };

    // ABA 3: SOMENTE DIVERGÊNCIAS E DESCONTOS
    const listaErros = window.qdpResultadoConciliacao.filter(q => q.status === 'DIVERGENTE');
    if (listaErros.length > 0) {
        const rowsErros = montarListaFormatadaComTotal(listaErros);
        const wsErros = XLSX.utils.json_to_sheet(rowsErros);
        estilizarPlanilhaExcelProfissional(wsErros, rowsErros);
        XLSX.utils.book_append_sheet(wb, wsErros, "3. Divergencias e Descontos");
    }

    // ABA 4: VIAGENS FALTANTES (SGF E QDP)
    const listaFaltantes = window.qdpResultadoConciliacao.filter(q => q.status === 'FALTANTE_SGF' || q.status === 'FALTANTE_QDP');
    if (listaFaltantes.length > 0) {
        const rowsFaltantes = montarListaFormatadaComTotal(listaFaltantes);
        const wsFaltantes = XLSX.utils.json_to_sheet(rowsFaltantes);
        estilizarPlanilhaExcelProfissional(wsFaltantes, rowsFaltantes);
        XLSX.utils.book_append_sheet(wb, wsFaltantes, "4. Viagens Faltantes");
    }

    // ABA 5: BASE COMPLETA CONCILIADA
    const rowsTodos = montarListaFormatadaComTotal(window.qdpResultadoConciliacao);
    const wsTodos = XLSX.utils.json_to_sheet(rowsTodos);
    estilizarPlanilhaExcelProfissional(wsTodos, rowsTodos);
    XLSX.utils.book_append_sheet(wb, wsTodos, "5. Base Completa Auditada");

    const dataLimpa = (r.metaInfo.periodoStr || 'Periodo').replace(/[^0-9a-zA-Z]/g, '_');
    XLSX.writeFile(wb, `Auditoria_QDP_Serranalog_${dataLimpa}.xlsx`);
}

// =========================================================
// CACHE EM SESSÃO
// =========================================================
function salvarCacheQdpDif() {
    try {
        const payload = {
            timestamp: Date.now(),
            resumo: window.qdpResumoCache,
            dados: window.qdpResultadoConciliacao,
            linhasBrutas: window.qdpLinhasBrutasCache,
            viagensSgf: window.qdpViagensSgfCache,
            metaInfo: window.qdpMetaInfoCache
        };
        sessionStorage.setItem(CACHE_KEY_QDP_DIF, JSON.stringify(payload));
    } catch (e) {
        console.warn("[QDP-DIF] Não foi possível salvar no cache de sessão:", e);
    }
}

function restaurarCacheQdpDif() {
    try {
        const raw = sessionStorage.getItem(CACHE_KEY_QDP_DIF);
        if (!raw) return;
        const payload = JSON.parse(raw);
        if (payload && payload.resumo && Array.isArray(payload.dados)) {
            window.qdpResumoCache = payload.resumo;
            window.qdpResultadoConciliacao = payload.dados;
            window.qdpLinhasBrutasCache = payload.linhasBrutas || null;
            window.qdpViagensSgfCache = payload.viagensSgf || null;
            window.qdpMetaInfoCache = payload.metaInfo || payload.resumo.metaInfo;

            const chk = document.getElementById('chkInverterDistQdp');
            if (chk && payload.resumo.desinvertido !== undefined) {
                chk.checked = payload.resumo.desinvertido;
            }
            const selCol = document.getElementById('selectColunaValorQdp');
            if (selCol && payload.resumo.modoColunaValor) {
                selCol.value = payload.resumo.modoColunaValor;
            }
            atualizarPainelQdpDif();
        }
    } catch (e) {
        console.warn("[QDP-DIF] Falha ao restaurar cache:", e);
    }
}

function limparCacheQdpDif() {
    sessionStorage.removeItem(CACHE_KEY_QDP_DIF);
    window.qdpResultadoConciliacao = [];
    window.qdpFaltantesNoQdp = [];
    window.qdpResumoCache = null;
    window.qdpLinhasBrutasCache = null;
    window.qdpViagensSgfCache = null;
    window.qdpMetaInfoCache = null;

    document.getElementById('kpi-total-qdp').innerText = '0';
    document.getElementById('sub-vol-qdp').innerText = 'Volume QDP: 0,00 m³';
    document.getElementById('kpi-total-sist').innerText = '0';
    document.getElementById('sub-batidas-sist').innerText = 'Conciliadas OK: 0 viagens';
    document.getElementById('kpi-faltantes-sgf').innerText = '0';
    document.getElementById('kpi-faltantes-qdp').innerText = '0';
    document.getElementById('kpi-divergentes').innerText = '0';
    document.getElementById('periodoQdpIdentificado').innerText = 'Aguardando planilha...';
    document.getElementById('valTotalBrutoQdp').innerText = 'R$ 0,00';
    document.getElementById('valTotalLiqQdp').innerText = 'R$ 0,00';
    document.getElementById('valTotalCalculadoSgf').innerText = 'R$ 0,00';
    document.getElementById('valDescontoIndevidoQdp').innerText = 'R$ 0,00';
    document.getElementById('valDiferencaFinanceira').innerText = 'R$ 0,00';
    document.getElementById('subDiferencaFinanceira').innerText = 'Falta pagar: R$ 0,00';
    document.getElementById('infoAbaLidaQdp').innerText = 'Nenhuma planilha carregada';
    document.getElementById('contadorLinhasQdp').innerText = '0 registros exibidos';

    document.getElementById('painelCausasRaizQdp')?.classList.add('hidden');
    document.getElementById('btnResumoEmailQdp')?.classList.add('hidden');
    document.getElementById('btnExportarQdpDif')?.classList.add('hidden');
    document.getElementById('btnLimparCacheQdp')?.classList.add('hidden');

    const tbody = document.getElementById('tbodyQdpDif');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="15" class="text-center p-10 text-slate-500 font-medium">Cache limpo. Importe uma nova planilha QDP para analisar.</td></tr>`;
    }
}