// ==========================================
// js/producao-frota.js - PRODUÇÃO E FATURAMENTO (ZERO LAG NAS TROCAS DE FILTRO)
// ==========================================
if(typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';
    Chart.defaults.font.family = "'Inter', sans-serif";
}

var dadosHistoricoGlobal = [];
var dadosAgrupadosAtual = [];
var dadosFrentesAtual = [];
var dadosFiltradosAtual = [];
var agrupamentoDiarioGlobal = {};

var tarifadorAtivoGlobal = null; 

var gruasPropriasCache = new Map(); 
var dicionarioUpFazenda = {}; 

var chartVolumesObj = null;
var chartTransporteEvoObj = null;
var chartCarregamentoEvoObj = null;
var chart7DiasObj = null; 

var metaTransporteDiaria = 0;
var metaCarregamentoDiaria = 0;
var diaCorte1 = 5;  
var diaCorte2 = 20; 
const TOLERANCIA_ASFALTO_KM = 2.0; 
const TOLERANCIA_TERRA_KM = 2.0; 

// Caches de Alta Performance em Memória
const dateCache = new Map();
const tarifaCache = new Map();
var cacheJanelaMin = null;
var cacheJanelaMax = null;
var cacheFilialId = undefined;

function getSupabaseClient() {
    if (typeof window.supabaseClient !== 'undefined') return window.supabaseClient;
    if (typeof window.db !== 'undefined' && typeof window.db.from === 'function') return window.db; 
    if (typeof window.db !== 'undefined' && window.db.supabase) return window.db.supabase;
    if (typeof supabaseClient !== 'undefined') return supabaseClient;
    console.error("[PRODUCAO] FATAL: Nenhum cliente Supabase encontrado!");
    return null;
}

function getCampo(obj, possiveisNomes) {
    if (!obj) return '';
    for (let nome of possiveisNomes) {
        if (obj[nome] !== undefined && obj[nome] !== null && obj[nome] !== '') return obj[nome];
    }
    const chavesReais = Object.keys(obj);
    for (let nomeProcurado of possiveisNomes) {
        const chaveEncontrada = chavesReais.find(k => k.toLowerCase() === nomeProcurado.toLowerCase());
        if (chaveEncontrada && obj[chaveEncontrada] !== null && obj[chaveEncontrada] !== undefined) {
            return obj[chaveEncontrada];
        }
    }
    return '';
}

function toNumber(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let strLimpa = String(val).replace('R$', '').trim().replace(',', '.');
    let num = parseFloat(strLimpa);
    return isNaN(num) ? 0 : num;
}

function getInfoGruaSerrana(gruaString) {
    let g = String(gruaString || '').trim().toUpperCase().replace(/[-\s]/g, '');
    if (!g || g === 'NULL' || g === '-') return null;
         
    if (gruasPropriasCache.has(g)) {
        return gruasPropriasCache.get(g);
    }
         
    if (g.startsWith('GSR')) {
        return {
            ordem: 'CX',
            frente: 'FRENTE SERRANA (GSR)',
            tipo_frente: 'PROPRIA'
        };
    }
    return null;
}

function formatarDataChave(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function converterDataString(dataStr) {
    if (!dataStr) return new Date(0);
    const info = getFastDateInfo(dataStr);
    return info.ts > 0 ? new Date(info.ts) : new Date(NaN);
}

function getFastDateInfo(dataStr) {
    if (!dataStr) return { ts: 0, key: '' };
    if (dateCache.has(dataStr)) return dateCache.get(dataStr);
    
    let time = 0;
    let key = '';
    try {
        const str = String(dataStr).trim();
        if (str.includes('/')) {
            const p = str.split(' ')[0].split('/');
            if (p.length === 3) {
                let y = parseInt(p[2], 10);
                if (y < 100) y += 2000;
                let m = parseInt(p[1], 10);
                let d = parseInt(p[0], 10);
                time = new Date(y, m - 1, d).getTime();
                key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            }
        } else if (str.includes('-')) {
            const p2 = str.split('T')[0].split(' ')[0].split('-');
            if (p2.length >= 3) {
                let y = parseInt(p2[0], 10) > 1000 ? parseInt(p2[0], 10) : parseInt(p2[2], 10);
                let m = parseInt(p2[1], 10);
                let d = parseInt(p2[0], 10) > 1000 ? parseInt(p2[2].substring(0, 2), 10) : parseInt(p2[0], 10);
                if (y < 100) y += 2000;
                time = new Date(y, m - 1, d).getTime();
                key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            }
        } else {
            const dt = new Date(str);
            time = dt.getTime();
            if (!isNaN(time)) key = formatarDataChave(dt);
        }
    } catch (e) {
        time = 0;
    }
    
    if (isNaN(time)) {
        time = 0;
        key = '';
    }
    const result = { ts: time, key: key };
    dateCache.set(dataStr, result);
    return result;
}

function getFastTime(dataStr) {
    return getFastDateInfo(dataStr).ts;
}

// Reutiliza a instância do ECharts se o elemento DOM for o mesmo (Evita travamento de dispose/init)
function obterInstanciaECharts(domElement, instanciaAtual) {
    if (!domElement) return null;
    if (instanciaAtual && instanciaAtual.getDom() === domElement && !instanciaAtual.isDisposed()) {
        return instanciaAtual;
    }
    if (instanciaAtual && !instanciaAtual.isDisposed()) {
        instanciaAtual.dispose();
    }
    return echarts.init(domElement);
}

window.initProducaoFrota = async function() {
    console.log("[PRODUCAO] Módulo iniciado (Modo Zero-Lag).");
    
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('hidden');
    
    cacheJanelaMin = null;
    cacheJanelaMax = null;
    tarifaCache.clear();
    
    configurarEventos();
         
    await Promise.all([
        carregarMetas(),
        buscarTarifadorAtivo(),
        mapearFazendasUPs()
    ]);
    
    popularDropdownQuinzenas();
    await buscarTodosDadosSupabase();

    function configurarEventos() {
        const btnFiltros = document.getElementById('btnAplicarFiltros');
        if(btnFiltros) btnFiltros.addEventListener('click', () => agendarProcessamento(false));
                 
        const btnExcel = document.getElementById('btnExportarExcel');
        if(btnExcel) btnExcel.addEventListener('click', exportarParaExcel);
                 
        const btnResProd = document.getElementById('btnExportarResumoProd');
        if(btnResProd) btnResProd.addEventListener('click', exportarResumoDiarioExcel);
        
        const selectTransp = document.getElementById('filtroTransportadora');
        if(selectTransp) {
            selectTransp.addEventListener('change', () => agendarProcessamento(false));
        }

        const selectPeriodo = document.getElementById('filtroPeriodoQuinzenal');
        if(selectPeriodo) {
            selectPeriodo.addEventListener('change', (e) => {
                if (e.target.value !== "") {
                    aplicarDatasNosInputs(e.target.value);
                    agendarProcessamento(false);
                }
            });
        }
        
        const resetDropdown = () => {
            if(selectPeriodo) selectPeriodo.value = ""; 
        };
        document.getElementById('dataInicioTransp')?.addEventListener('change', resetDropdown);
        document.getElementById('dataFimTransp')?.addEventListener('change', resetDropdown);
        document.getElementById('dataInicioCarreg')?.addEventListener('change', resetDropdown);
        document.getElementById('dataFimCarreg')?.addEventListener('change', resetDropdown);

        window.addEventListener('resize', () => {
            if (chartTransporteEvoObj) chartTransporteEvoObj.resize();
            if (chartCarregamentoEvoObj) chartCarregamentoEvoObj.resize();
            if (chartVolumesObj) chartVolumesObj.resize();
            if (chart7DiasObj) chart7DiasObj.resize(); 
         });
    }

    // Deixa o navegador fechar o dropdown/calendário suavemente antes de atualizar a tela
    function agendarProcessamento(forcarRecarga) {
        const tStatus = document.getElementById('tabelaStatus');
        if (tStatus) tStatus.innerText = "Atualizando...";
        requestAnimationFrame(() => {
            setTimeout(() => {
                processarFiltrosEExibir(forcarRecarga);
            }, 10);
        });
    }

    function popularDropdownQuinzenas() {
        const select = document.getElementById('filtroPeriodoQuinzenal');
        if(!select) return;
        
        let opsHtml = '<option value="">Personalizado</option>';
        const hoje = new Date();
        const nomeMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        
        for(let i = -1; i < 6; i++) {
            let dataRef = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
            let ano = dataRef.getFullYear();
            let mes = dataRef.getMonth(); 
            let mesNome = nomeMeses[mes];
            
            let dataQ1Inicio = new Date(ano, mes - 1, diaCorte2 + 1);
            let dataQ1Fim = new Date(ano, mes, diaCorte1);
            
            let dataQ2Inicio = new Date(ano, mes, diaCorte1 + 1);
            let dataQ2Fim = new Date(ano, mes, diaCorte2);

            let strValQ1 = `${formatarDataChave(dataQ1Inicio)}|${formatarDataChave(dataQ1Fim)}`;
            let strValQ2 = `${formatarDataChave(dataQ2Inicio)}|${formatarDataChave(dataQ2Fim)}`;
            let strValMes = `${formatarDataChave(dataQ1Inicio)}|${formatarDataChave(dataQ2Fim)}`;
            
            opsHtml += `<option value="${strValMes}" class="font-black text-sky-400">■ MÊS COMPLETO: ${mesNome}/${String(ano).slice(2)}</option>`;
            
            let strTextQ1 = `Q1 ${mesNome}/${String(ano).slice(2)} - ${String(dataQ1Inicio.getDate()).padStart(2,'0')}/${String(dataQ1Inicio.getMonth()+1).padStart(2,'0')} a ${String(dataQ1Fim.getDate()).padStart(2,'0')}/${String(dataQ1Fim.getMonth()+1).padStart(2,'0')}`;
            opsHtml += `<option value="${strValQ1}">-- ${strTextQ1}</option>`;
            
            let strTextQ2 = `Q2 ${mesNome}/${String(ano).slice(2)} - ${String(dataQ2Inicio.getDate()).padStart(2,'0')}/${String(dataQ2Inicio.getMonth()+1).padStart(2,'0')} a ${String(dataQ2Fim.getDate()).padStart(2,'0')}/${String(dataQ2Fim.getMonth()+1).padStart(2,'0')}`;
            opsHtml += `<option value="${strValQ2}">-- ${strTextQ2}</option>`;
        }
        
        select.innerHTML = opsHtml;
        
        let achouAtual = false;
        Array.from(select.options).forEach(opt => {
            if(!opt.value) return;
            let [inicio, fim] = opt.value.split('|');
            let tInicio = getFastTime(inicio);
            let dFim = new Date(getFastTime(fim));
            dFim.setHours(23, 59, 59, 999); 
            
            if(hoje.getTime() >= tInicio && hoje.getTime() <= dFim.getTime() && !opt.text.includes("MÊS COMPLETO")) {
                select.value = opt.value;
                achouAtual = true;
            }
        });

        if (!achouAtual && select.options.length > 1) {
            select.selectedIndex = 1; 
        }

        aplicarDatasNosInputs(select.value);
    }

    function aplicarDatasNosInputs(valorSelect) {
        if(!valorSelect) return;
        const [inicio, fim] = valorSelect.split('|');
        
        const elInicioTransp = document.getElementById('dataInicioTransp');
        const elFimTransp = document.getElementById('dataFimTransp');
        const elInicioCarreg = document.getElementById('dataInicioCarreg');
        const elFimCarreg = document.getElementById('dataFimCarreg');

        if(elInicioTransp) elInicioTransp.value = inicio;
        if(elFimTransp) elFimTransp.value = fim;
        if(elInicioCarreg) elInicioCarreg.value = inicio;
        if(elFimCarreg) elFimCarreg.value = fim;
    }

    async function carregarMetas() {
        try {
            const client = getSupabaseClient();
            const filialAtual = (typeof currentUser !== 'undefined' && currentUser.filial_id) ? currentUser.filial_id : 'CENTRAL';
                         
            if (client) {
                const { data } = await client
                    .from('metas_gerenciais')
                    .select('*')
                    .eq('filial_id', filialAtual)
                    .maybeSingle();
                                     
                if (data) {
                    metaTransporteDiaria = parseFloat(data.meta_diaria_transporte || 0);
                    metaCarregamentoDiaria = parseFloat(data.meta_diaria_carregamento || 0);
                    diaCorte1 = parseInt(data.dia_fechamento_1) || 5;
                    diaCorte2 = parseInt(data.dia_fechamento_2) || 20;
                    return;
                }
            }
                         
            const metasSalvas = JSON.parse(localStorage.getItem(`metas_gerenciais_${filialAtual}`));
            if (metasSalvas) {
                metaTransporteDiaria = parseFloat(metasSalvas.meta_diaria_transporte || 0);
                metaCarregamentoDiaria = parseFloat(metasSalvas.meta_diaria_carregamento || 0);
                diaCorte1 = parseInt(metasSalvas.dia_fechamento_1) || 5;
                diaCorte2 = parseInt(metasSalvas.dia_fechamento_2) || 20;
            }
        } catch (error) {
            console.error("[PRODUCAO] Erro ao buscar metas:", error);
        }
    }

    async function buscarTarifadorAtivo() {
        const client = getSupabaseClient();
        const displayNome = document.getElementById('nomeTarifadorDisplay');
        const badge = document.getElementById('badgeTarifadorAtivo');
                 
        if (!client) return;
                 
        try {
            let query = client.from('tarifadores').select('*').eq('ativo', true).limit(1);
            if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
                         
            const { data, error } = await query;
            if (error) throw error;
                         
            if (data && data.length > 0) {
                tarifadorAtivoGlobal = data[0];
                tarifaCache.clear();
                const precoCarreg = parseFloat(tarifadorAtivoGlobal.preco_carregamento) || 0;
                                 
                if(displayNome) displayNome.innerText = `${tarifadorAtivoGlobal.nome} (Carregamento: R$ ${precoCarreg.toFixed(2)})`;
                if(badge) {
                    badge.classList.remove('bg-indigo-600/20', 'text-indigo-400', 'border-indigo-500/50', 'bg-rose-600/20', 'text-rose-400', 'border-rose-500/50');
                    badge.classList.add('bg-emerald-600/20', 'text-emerald-400', 'border-emerald-500/50');
                }
            } else {
                tarifadorAtivoGlobal = null;
                tarifaCache.clear();
                if(displayNome) displayNome.innerText = "Nenhum Tarifador Ativo";
                if(badge) {
                    badge.classList.remove('bg-indigo-600/20', 'text-indigo-400', 'border-indigo-500/50', 'bg-emerald-600/20', 'text-emerald-400', 'border-emerald-500/50');
                    badge.classList.add('bg-rose-600/20', 'text-rose-400', 'border-rose-500/50');
                }
            }
        } catch(err) {
            console.error("[PRODUCAO] Erro ao buscar tarifador:", err);
        }
    }

    async function mapearFazendasUPs() {
        const client = getSupabaseClient();
        if(!client) return;
        dicionarioUpFazenda = {}; 

        try {
            const [resFaz, resUps] = await Promise.all([
                client.from('monitoramento_fazendas').select('id, nome'),
                client.from('monitoramento_ups').select('codigo, fazenda_id')
            ]);
            const mapFaz = {};
            if (resFaz.data) {
                resFaz.data.forEach(f => mapFaz[f.id] = f.nome);
            }
            if (resUps.data) {
                resUps.data.forEach(u => {
                    const codUp = String(u.codigo).trim().toUpperCase();
                    if (u.fazenda_id && mapFaz[u.fazenda_id]) {
                        dicionarioUpFazenda[codUp] = mapFaz[u.fazenda_id];
                    }
                });
            }
        } catch (e) {
            console.error("Erro ao mapear UPs e Fazendas:", e);
        }
    }

    async function buscarTodosDadosSupabase() {
        const client = getSupabaseClient();
        const tStatus = document.getElementById('tabelaStatus');
                 
        if (!client) {
            if(tStatus) tStatus.innerText = "Erro de conexão com o banco.";
            return;
        }
                 
        try {
            const { data: gruasData } = await client.from('config_gruas').select('codigos, tipo_frente, ordem, frente');
                         
            gruasPropriasCache = new Map();
            if (gruasData) {
                gruasData.forEach(g => {
                    const tipo = String(g.tipo_frente || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    if (tipo.includes('PROPRIA') && g.codigos) {
                        g.codigos.split(',').forEach(c => {
                            const cod = c.trim().toUpperCase().replace(/[-\s]/g, '');
                            if (cod && cod !== 'OUTRAS' && cod !== 'OUTROS' && cod !== '0') {
                                gruasPropriasCache.set(cod, {
                                    ordem: g.ordem || 'CX',
                                    frente: g.frente || 'FRENTE DESCONHECIDA',
                                    tipo_frente: g.tipo_frente
                                });
                            }
                        });
                    }
                });
            }
                         
            await processarFiltrosEExibir(true);
                     
        } catch (e) {
            console.error("[PRODUCAO] Erro global na busca:", e);
            if(tStatus) tStatus.innerText = "Erro ao carregar dados.";
        }
    }

    function popularDropdownTransportadoras(dados = []) {
        try {
            const select = document.getElementById('filtroTransportadora');
            if(!select) return;
                         
            const transpSet = new Set();
            dados.forEach(d => {
                const tName = d.transportadora;
                if (tName && tName !== '-' && tName !== 'N/A') transpSet.add(tName);
            });
                         
            const currentVal = select.value;
            let opsHtml = '<option value="">Todas Transportadoras</option>';
            opsHtml += '<option value="SOMENTE_SERRANA">  NOSSOS CAMINHÕES (Serrana)</option>';
            opsHtml += '<option value="SOMENTE_TERCEIROS">  CAMINHÕES TERCEIROS</option>';
                         
            Array.from(transpSet).sort().forEach(t => { opsHtml += `<option value="${t}">${t}</option>`; });
            select.innerHTML = opsHtml;
            if(currentVal) select.value = currentVal;
        } catch(e) {}
    }

    // Cálculo de tarifa com Memoization (Não recalcula a mesma distância duas vezes)
    function calcularTarifaTransporte(asfalto, terra) {
        if (!tarifadorAtivoGlobal || !tarifadorAtivoGlobal.dados) return 0;
        const chaveCache = `${asfalto}_${terra}`;
        if (tarifaCache.has(chaveCache)) return tarifaCache.get(chaveCache);

        let asfaltoVal = typeof asfalto === 'number' ? asfalto : (parseFloat(String(asfalto).replace(',','.')) || 0);
        let terraVal = typeof terra === 'number' ? terra : (parseFloat(String(terra).replace(',','.')) || 0);
        const dadosMatriz = tarifadorAtivoGlobal.dados;
        
        if (dadosMatriz.length === 0) return 0;

        let resultado = 0;
        if (dadosMatriz[0].is_raio || dadosMatriz[0].raio_inicial !== undefined) {
            let distanciaTotal = asfaltoVal + terraVal;
            let distArredondada = Math.round(distanciaTotal * 100) / 100;
            
            let faixa = dadosMatriz.find(t => distArredondada >= t.raio_inicial && distArredondada <= t.raio_final);
            
            if (!faixa) {
                let ordenados = [...dadosMatriz].sort((a,b) => a.raio_final - b.raio_final);
                faixa = ordenados.find(t => t.raio_final >= distArredondada);
                if(!faixa) faixa = ordenados[ordenados.length - 1]; 
            }
            resultado = faixa ? parseFloat(faixa.tarifa) : 0;
        } else {
            const exato = dadosMatriz.find(t => Math.abs(t.asfalto - asfaltoVal) < 0.001 && Math.abs(t.terra - terraVal) < 0.001);
            if (exato) {
                resultado = exato.tarifa;
            } else {
                let maisProximo = null;
                let menorDistancia = Infinity;
                         
                for (let i = 0; i < dadosMatriz.length; i++) {
                    const t = dadosMatriz[i];
                    const da = t.asfalto - asfaltoVal;
                    const dt = t.terra - terraVal;
                    const distSq = (da * da) + (dt * dt);
                    if (distSq < menorDistancia) {
                        menorDistancia = distSq;
                        maisProximo = t;
                    }
                }
                resultado = maisProximo ? maisProximo.tarifa : 0;
            }
        }

        tarifaCache.set(chaveCache, resultado);
        return resultado;
    }

    async function carregarDadosDoServidor(minTime, maxTime) {
        const client = getSupabaseClient();
        const filialQuery = (window.currentUser && window.currentUser.filial_id !== undefined && window.currentUser.filial_id !== null) 
                            ? parseInt(window.currentUser.filial_id, 10) 
                            : null;

        // Se o período selecionado já está dentro da janela em cache na RAM, retorna em 0ms sem ir na rede!
        if (
            dadosHistoricoGlobal.length > 0 &&
            cacheFilialId === filialQuery &&
            cacheJanelaMin !== null &&
            cacheJanelaMax !== null &&
            minTime >= cacheJanelaMin &&
            maxTime <= cacheJanelaMax
        ) {
            return;
        }

        // Pré-carrega 400 dias (mais de 1 ano inteiro) no pacote JSON compacto!
        // Assim, qualquer troca de quinzena/mês que o usuário fizer depois será 100% em memória local (0ms de rede).
        let janelaMinDate = new Date(minTime);
        janelaMinDate.setDate(janelaMinDate.getDate() - 400);
        let janelaMaxDate = new Date(maxTime);
        janelaMaxDate.setDate(janelaMaxDate.getDate() + 15);

        let strMinISO = janelaMinDate.toISOString().split('T')[0] + 'T00:00:00';
        let strMaxISO = janelaMaxDate.toISOString().split('T')[0] + 'T23:59:59';

        const { data: rpcJson, error: rpcErr } = await client.rpc('get_producao_agrupada_json', {
            p_filial_id: filialQuery,
            p_data_inicio: strMinISO,
            p_data_fim: strMaxISO
        });

        if (!rpcErr && Array.isArray(rpcJson)) {
            dadosHistoricoGlobal = rpcJson.map(r => {
                const dInfo = getFastDateInfo(r.d);
                const tr = (r.tr || 'N/A').trim().toUpperCase();
                const isSerrana = tr.includes('SERRANALOG') || tr.includes('SERRANA LOG') || tr.includes('SERRANA');
                const infoGrua = getInfoGruaSerrana(r.g);
                return {
                    dataViagem: r.d,
                    _ts: dInfo.ts,
                    _keyData: dInfo.key,
                    placa: (r.p || 'N/A').trim().toUpperCase(),
                    transportadora: tr,
                    _isSerrana: isSerrana,
                    grua: r.g,
                    _infoGrua: infoGrua,
                    _isNossaGrua: !!infoGrua,
                    distanciaAsfalto: toNumber(r.a),
                    distanciaTerra: toNumber(r.te),
                    up: (r.u || '').trim().toUpperCase(),
                    qtdViagens: parseInt(r.q, 10) || 1,
                    volumeReal: toNumber(r.v),
                    valor_cte: toNumber(r.c)
                };
            });

            cacheJanelaMin = janelaMinDate.getTime();
            cacheJanelaMax = janelaMaxDate.getTime();
            cacheFilialId = filialQuery;
            popularDropdownTransportadoras(dadosHistoricoGlobal);
            return;
        }

        console.warn("[PRODUCAO] RPC não encontrada ou falhou, usando fallback:", rpcErr?.message);
        
        let minFallback = new Date(minTime);
        minFallback.setDate(minFallback.getDate() - 15);
        let strMinFb = minFallback.toISOString().split('T')[0] + 'T00:00:00';

        let queryCount = client.from('historico_viagens').select('*', { count: 'exact', head: true })
            .gte('created_at', strMinFb).lte('created_at', strMaxISO);
        if (typeof window.aplicarFiltroLocal === 'function') queryCount = window.aplicarFiltroLocal(queryCount);
        else if (filialQuery !== null) queryCount = queryCount.eq('filial_id', filialQuery);

        const { count, error: countErr } = await queryCount;
        if (countErr) throw countErr;

        let dadosBrutos = [];
        if (count > 0) {
            const step = 1000;
            const promises = [];
            for (let from = 0; from < count; from += step) {
                let q = client.from('historico_viagens')
                    .select('transportadora, placa, pesoLiquido, volumeReal, distanciaAsfalto, distanciaTerra, grua, created_at, dtFimDescarFabrica, dataDaBaseExcel, up, valor_cte')
                    .gte('created_at', strMinFb)
                    .lte('created_at', strMaxISO)
                    .range(from, from + step - 1);
                if (typeof window.aplicarFiltroLocal === 'function') q = window.aplicarFiltroLocal(q);
                else if (filialQuery !== null) q = q.eq('filial_id', filialQuery);
                promises.push(q);
            }
            const responses = await Promise.all(promises);
            responses.forEach(res => {
                if (res.data) dadosBrutos = dadosBrutos.concat(res.data);
            });
        }

        dadosHistoricoGlobal = dadosBrutos.map(r => {
            const dtFim = r.dtFimDescarFabrica && String(r.dtFimDescarFabrica).trim() !== '' && String(r.dtFimDescarFabrica).trim() !== '-' ? r.dtFimDescarFabrica : null;
            const dtBase = r.dataDaBaseExcel && String(r.dataDaBaseExcel).trim() !== '' && String(r.dataDaBaseExcel).trim() !== '-' ? r.dataDaBaseExcel : null;
            const dStr = dtFim || dtBase || r.created_at;
            const dInfo = getFastDateInfo(dStr);
            const tr = (r.transportadora || 'N/A').trim().toUpperCase();
            const isSerrana = tr.includes('SERRANALOG') || tr.includes('SERRANA LOG') || tr.includes('SERRANA');
            const gruaStr = (r.grua || '').trim().toUpperCase();
            const infoGrua = getInfoGruaSerrana(gruaStr);
            return {
                dataViagem: dStr,
                _ts: dInfo.ts,
                _keyData: dInfo.key,
                placa: (r.placa || 'N/A').trim().toUpperCase(),
                transportadora: tr,
                _isSerrana: isSerrana,
                grua: gruaStr,
                _infoGrua: infoGrua,
                _isNossaGrua: !!infoGrua,
                distanciaAsfalto: toNumber(r.distanciaAsfalto),
                distanciaTerra: toNumber(r.distanciaTerra),
                up: String(r.up || '').trim().toUpperCase(),
                qtdViagens: 1,
                volumeReal: toNumber(r.volumeReal) > 0 ? toNumber(r.volumeReal) : toNumber(r.pesoLiquido),
                valor_cte: toNumber(r.valor_cte)
            };
        });

        cacheJanelaMin = minTime;
        cacheJanelaMax = maxTime;
        cacheFilialId = filialQuery;
        popularDropdownTransportadoras(dadosHistoricoGlobal);
    }

    async function processarFiltrosEExibir(forcarRecarga = false) {
        const tStatus = document.getElementById('tabelaStatus');
        try {
            if (forcarRecarga) {
                cacheJanelaMin = null;
                cacheJanelaMax = null;
            }
                             
            const elFiltroTransp = document.getElementById('filtroTransportadora');
            const filtroTransp = elFiltroTransp ? elFiltroTransp.value : '';
                             
            const strInicioTransp = document.getElementById('dataInicioTransp')?.value || '';
            const strFimTransp = document.getElementById('dataFimTransp')?.value || '';
            const strInicioCarreg = document.getElementById('dataInicioCarreg')?.value || '';
            const strFimCarreg = document.getElementById('dataFimCarreg')?.value || '';
            
            if (!strInicioTransp || !strFimTransp || !strInicioCarreg || !strFimCarreg) {
                mostrarAlerta("Selecione períodos válidos para Transporte e Carregamento nas datas.", "error");
                return;
            }
                             
            let timeInicioTransp = new Date(strInicioTransp.split('-')[0], parseInt(strInicioTransp.split('-')[1]) - 1, strInicioTransp.split('-')[2]).getTime();
            let timeFimTransp = new Date(strFimTransp.split('-')[0], parseInt(strFimTransp.split('-')[1]) - 1, strFimTransp.split('-')[2], 23, 59, 59).getTime();
            let timeInicioCarreg = new Date(strInicioCarreg.split('-')[0], parseInt(strInicioCarreg.split('-')[1]) - 1, strInicioCarreg.split('-')[2]).getTime();
            let timeFimCarreg = new Date(strFimCarreg.split('-')[0], parseInt(strFimCarreg.split('-')[1]) - 1, strFimCarreg.split('-')[2], 23, 59, 59).getTime();
                             
            let minTime = Math.min(timeInicioTransp, timeInicioCarreg);
            let maxTime = Math.max(timeFimTransp, timeFimCarreg);
            let dataHoje = new Date();
            let timeSeteDiasAtras = new Date(dataHoje.getFullYear(), dataHoje.getMonth(), dataHoje.getDate() - 7).getTime();
            minTime = Math.min(minTime, timeSeteDiasAtras);
            maxTime = Math.max(maxTime, dataHoje.getTime());

            await carregarDadosDoServidor(minTime, maxTime);
                             
            let diasNoPeriodoTransp = Math.max(1, Math.ceil(Math.abs(timeFimTransp - timeInicioTransp) / (1000 * 60 * 60 * 24)));
            let diasNoPeriodoCarreg = Math.max(1, Math.ceil(Math.abs(timeFimCarreg - timeInicioCarreg) / (1000 * 60 * 60 * 24)));
                             
            const agrupamentoTabela = {};
            const agrupamentoFrente = {};
            const agrupamentoDiario = {};
            dadosFiltradosAtual = [];
                             
            let tTranspViagens = 0, tTranspVol = 0, tTranspRec = 0;
            let tCarregViagens = 0, tCarregVol = 0, tCarregRec = 0;
            let precoCarregamento = parseFloat(tarifadorAtivoGlobal?.preco_carregamento) || 0;
            
            // Passo Único Ultra-Rápido: Filtra e Agrupa em uma só passada usando propriedades pré-calculadas (_ts, _isSerrana)
            for (let i = 0, len = dadosHistoricoGlobal.length; i < len; i++) {
                const registro = dadosHistoricoGlobal[i];
                const trTime = registro._ts;
                if (trTime === 0) continue;

                const isSerranaFull = registro._isSerrana;
                const isNossaGruaFull = registro._isNossaGrua;
                if (!isSerranaFull && !isNossaGruaFull) continue;

                const tr = registro.transportadora;
                if (filtroTransp === 'SOMENTE_SERRANA' && !isSerranaFull) continue;
                if (filtroTransp === 'SOMENTE_TERCEIROS' && isSerranaFull) continue;
                if (filtroTransp !== '' && filtroTransp !== 'SOMENTE_SERRANA' && filtroTransp !== 'SOMENTE_TERCEIROS' && tr !== filtroTransp) continue;

                const inTranspPeriod = trTime >= timeInicioTransp && trTime <= timeFimTransp;
                const inCarregPeriod = trTime >= timeInicioCarreg && trTime <= timeFimCarreg;
                if (!inTranspPeriod && !inCarregPeriod) continue;

                const isSerrana = isSerranaFull && inTranspPeriod;
                const isNossaGrua = isNossaGruaFull && inCarregPeriod;
                if (!isSerrana && !isNossaGrua) continue;

                dadosFiltradosAtual.push(registro);

                const keyData = registro._keyData;
                const pl = registro.placa;
                const infoGrua = registro._infoGrua;
                const v = registro.volumeReal;
                const qtdViagens = registro.qtdViagens;
                const asfalto = registro.distanciaAsfalto;
                const terra = registro.distanciaTerra;
                const codUp = registro.up;

                let tarifaTransporte = 0;
                let recTransporte = 0;
                
                if (isSerrana && tarifadorAtivoGlobal) {
                    tarifaTransporte = calcularTarifaTransporte(asfalto, terra);
                    recTransporte = tarifaTransporte * v;
                } else if (isSerrana) {
                    recTransporte = registro.valor_cte;
                    if (v > 0) tarifaTransporte = recTransporte / v;
                }
                let recCarregamento = isNossaGrua ? (v * precoCarregamento) : 0;
                let totalReceitaItem = recTransporte + recCarregamento;
                                     
                if (isSerrana) { tTranspViagens += qtdViagens; tTranspVol += v; tTranspRec += recTransporte; }
                if (isNossaGrua) { tCarregViagens += qtdViagens; tCarregVol += v; tCarregRec += recCarregamento; }
                                     
                let nomeFazendaReal = dicionarioUpFazenda[codUp] ? dicionarioUpFazenda[codUp].toUpperCase() : "";
                
                let nomeCategoria = "DESCONHECIDO";
                if (isSerranaFull && isNossaGruaFull) {
                    let ordem = infoGrua.ordem || 'CX';
                    let frenteNome = infoGrua.frente || 'FRENTE DESCONHECIDA';
                    nomeCategoria = `${ordem}: SERRANA - ${frenteNome}`.toUpperCase();
                } else if (!isSerranaFull && isNossaGruaFull) {
                    let nomeTr = tr.split(' ')[0];
                    nomeCategoria = `${nomeTr}: TRANSP. ${tr}`.toUpperCase();
                } else if (isSerranaFull && !isNossaGruaFull) {
                    if (nomeFazendaReal) {
                        nomeCategoria = `TRANSP SERRANA - FAZ. ${nomeFazendaReal}`.toUpperCase();
                    } else {
                        nomeCategoria = `OUTRAS FRENTES: NOSSOS CAMINHÕES`;
                    }
                }
                                     
                const chaveFrente = `${nomeCategoria}_${asfalto}_${terra}`;
                let itemFrente = agrupamentoFrente[chaveFrente];
                if (!itemFrente) {
                    itemFrente = { categoria: nomeCategoria, asfalto: asfalto, terra: terra, tarifa: tarifaTransporte, viagens: 0, volume: 0, receita: 0, ups: [codUp] };
                    agrupamentoFrente[chaveFrente] = itemFrente;
                }
                itemFrente.viagens += qtdViagens;
                itemFrente.volume += v;
                itemFrente.receita += totalReceitaItem;
                if (!itemFrente.ups.includes(codUp)) itemFrente.ups.push(codUp);
                                     
                const chaveTabela = `${pl}_${asfalto}_${terra}`;
                let itemTab = agrupamentoTabela[chaveTabela];
                if (!itemTab) {
                    itemTab = { placa: pl, transp: tr, isSerrana: isSerranaFull, isNossaGrua: isNossaGruaFull, asfalto: asfalto, terra: terra, tarifa: tarifaTransporte, viagens: 0, volume: 0, recTransp: 0, recCarreg: 0 };
                    agrupamentoTabela[chaveTabela] = itemTab;
                }
                itemTab.viagens += qtdViagens;
                itemTab.volume += v;
                itemTab.recTransp += recTransporte;
                itemTab.recCarreg += recCarregamento;
                                     
                let itemDia = agrupamentoDiario[keyData];
                if (!itemDia) {
                    itemDia = { volTransp: 0, recTransp: 0, volCarreg: 0, recCarreg: 0 };
                    agrupamentoDiario[keyData] = itemDia;
                }
                if (isSerrana) { itemDia.volTransp += v; itemDia.recTransp += recTransporte; }
                if (isNossaGrua) { itemDia.volCarreg += v; itemDia.recCarreg += recCarregamento; }
            }
                             
            dadosAgrupadosAtual = Object.values(agrupamentoTabela).sort((a, b) => {
                if (a.placa === b.placa) return b.viagens - a.viagens; 
                return a.placa.localeCompare(b.placa); 
            });
            dadosFrentesAtual = Object.values(agrupamentoFrente).sort((a, b) => b.volume - a.volume);
            agrupamentoDiarioGlobal = agrupamentoDiario;
                             
            const formatMoney = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                             
            let hojeTransporte = 0;
            let hojeCarregamento = 0;
                             
            const dataOntem = new Date();
            dataOntem.setDate(dataOntem.getDate() - 1);
            const d1Key = formatarDataChave(dataOntem);
                             
            if (agrupamentoDiario[d1Key]) {
                hojeTransporte = agrupamentoDiario[d1Key].recTransp;
                hojeCarregamento = agrupamentoDiario[d1Key].recCarreg;
            } else if (Object.keys(agrupamentoDiario).length > 0) {
                const sortedKeys = Object.keys(agrupamentoDiario).sort();
                const lastKey = sortedKeys[sortedKeys.length - 1];
                hojeTransporte = agrupamentoDiario[lastKey].recTransp;
                hojeCarregamento = agrupamentoDiario[lastKey].recCarreg;
            }
                             
            const metaPeriodoTransporte = metaTransporteDiaria * diasNoPeriodoTransp;
            const metaPeriodoCarregamento = metaCarregamentoDiaria * diasNoPeriodoCarreg;
            
            let dataHojeFim = new Date();
            dataHojeFim.setHours(23, 59, 59, 999);
            let timeHoje = dataHojeFim.getTime();
            
            let diasDecorridosTransp = timeInicioTransp > timeHoje ? 0 : Math.max(1, Math.ceil((Math.min(timeFimTransp, timeHoje) - timeInicioTransp) / (1000 * 60 * 60 * 24)));
            let diasDecorridosCarreg = timeInicioCarreg > timeHoje ? 0 : Math.max(1, Math.ceil((Math.min(timeFimCarreg, timeHoje) - timeInicioCarreg) / (1000 * 60 * 60 * 24)));
            
            diasDecorridosTransp = Math.min(diasDecorridosTransp, diasNoPeriodoTransp);
            diasDecorridosCarreg = Math.min(diasDecorridosCarreg, diasNoPeriodoCarreg);
            
            const metaAteHojeTransporte = metaTransporteDiaria * diasDecorridosTransp;
            const metaAteHojeCarregamento = metaCarregamentoDiaria * diasDecorridosCarreg;

            const percTransPeriodo = metaAteHojeTransporte > 0 ? ((tTranspRec / metaAteHojeTransporte) * 100) : 0;
            const percCarrPeriodo = metaAteHojeCarregamento > 0 ? ((tCarregRec / metaAteHojeCarregamento) * 100) : 0;
            
            const percTransHoje = metaTransporteDiaria > 0 ? ((hojeTransporte / metaTransporteDiaria) * 100) : 0;
            const percCarrHoje = metaCarregamentoDiaria > 0 ? ((hojeCarregamento / metaCarregamentoDiaria) * 100) : 0;
                             
            document.getElementById('valTranspReceita').innerText = formatMoney(tTranspRec);
            document.getElementById('valCarregReceita').innerText = formatMoney(tCarregRec);
            document.getElementById('kpi-transporte-hoje').innerText = formatMoney(hojeTransporte);
            document.getElementById('kpi-carregamento-hoje').innerText = formatMoney(hojeCarregamento);
            
            document.getElementById('desc-transporte-periodo').innerText = `Meta Atual (${diasDecorridosTransp}d): ${formatMoney(metaAteHojeTransporte)} | Total (${diasNoPeriodoTransp}d): ${formatMoney(metaPeriodoTransporte)}`;
            document.getElementById('desc-carregamento-periodo').innerText = `Meta Atual (${diasDecorridosCarreg}d): ${formatMoney(metaAteHojeCarregamento)} | Total (${diasNoPeriodoCarreg}d): ${formatMoney(metaPeriodoCarregamento)}`;
            
            document.getElementById('desc-transporte-hoje').innerText = `Meta Diária: ${formatMoney(metaTransporteDiaria)}`;
            document.getElementById('desc-carregamento-hoje').innerText = `Meta Diária: ${formatMoney(metaCarregamentoDiaria)}`;
                             
            aplicarBadge('badge-transporte-periodo', percTransPeriodo);
            aplicarBadge('badge-carregamento-periodo', percCarrPeriodo);
            aplicarBadge('badge-transporte-hoje', percTransHoje);
            aplicarBadge('badge-carregamento-hoje', percCarrHoje);
                             
            document.getElementById('valTranspViagens').innerText = tTranspViagens.toLocaleString('pt-BR');
            document.getElementById('valTranspVolume').innerText = tTranspVol.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' m³';
            document.getElementById('valCarregViagens').innerText = tCarregViagens.toLocaleString('pt-BR');
            document.getElementById('valCarregVolume').innerText = tCarregVol.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' m³';
            document.getElementById('valTotalReceita').innerText = formatMoney(tTranspRec + tCarregRec);
                             
            const dadosEvolucao = [];
            const minTimeEvo = Math.min(timeInicioTransp, timeInicioCarreg);
            const maxTimeEvo = Math.max(timeFimTransp, timeFimCarreg);
            let dataCorrente = new Date(minTimeEvo);
            const dataLimite = new Date(maxTimeEvo);
                             
            while(dataCorrente <= dataLimite) {
                const k = formatarDataChave(dataCorrente);
                const label = `${String(dataCorrente.getDate()).padStart(2, '0')}/${String(dataCorrente.getMonth() + 1).padStart(2, '0')}`;
                                     
                if (agrupamentoDiario[k]) {
                    dadosEvolucao.push({ 
                        label: label, 
                        recTransp: agrupamentoDiario[k].recTransp, 
                        recCarreg: agrupamentoDiario[k].recCarreg, 
                        volTransp: agrupamentoDiario[k].volTransp, 
                        volCarreg: agrupamentoDiario[k].volCarreg 
                    });
                } else {
                    dadosEvolucao.push({ label: label, recTransp: 0, recCarreg: 0, volTransp: 0, volCarreg: 0 });
                }
                dataCorrente.setDate(dataCorrente.getDate() + 1);
            }
                             
            desenharGraficosEvolucao(dadosEvolucao);
            desenharGrafico7DiasFixo();
                             
            renderizarTabela(dadosAgrupadosAtual);
                             
            if(tStatus) tStatus.innerText = `${dadosAgrupadosAtual.length} rotas consolidadas`;
                         
        } catch (errInterface) {
            console.error("[PRODUCAO] Erro Crítico na montagem da tela:", errInterface);
            mostrarAlerta("Ocorreu um erro ao processar os dados financeiros.", "error");
            
            const tbody = document.getElementById('tbodyProducaoFrota');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="10" class="text-center p-8 text-red-400 font-bold"><i class="fas fa-exclamation-triangle mr-2"></i> Erro ao processar os dados do período selecionado. Verifique a conexão ou tente um período diferente.</td></tr>`;
            }
            if (tStatus) tStatus.innerText = "Falha no processamento.";
        }
    }

    function aplicarBadge(id, percent) {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerText = percent.toFixed(1) + '%';
        el.className = 'px-2 py-1 text-[11px] font-bold rounded shadow-sm border ';
        if (percent >= 100) el.classList.add('bg-emerald-500/20', 'text-emerald-400', 'border-emerald-500/50');
        else if (percent >= 80) el.classList.add('bg-yellow-500/20', 'text-yellow-400', 'border-yellow-500/50');
        else el.classList.add('bg-red-500/20', 'text-red-400', 'border-red-500/50');
    }

    function desenharGraficosEvolucao(dadosEvolucao) {
        if(!dadosEvolucao || dadosEvolucao.length === 0) return;
                 
        try {
            const labels = dadosEvolucao.map(d => d.label);
            const recTranspArr = dadosEvolucao.map(d => d.recTransp);
            const metaTranspArr = dadosEvolucao.map(d => metaTransporteDiaria);
            const recCarregArr = dadosEvolucao.map(d => d.recCarreg);
            const metaCarregArr = dadosEvolucao.map(d => metaCarregamentoDiaria);
            const volTranspArr = dadosEvolucao.map(d => d.volTransp);
            const volCarregArr = dadosEvolucao.map(d => d.volCarreg);
                         
            const domTransporte = document.getElementById('chartTransporteEvolucao');
            if (domTransporte) {
                chartTransporteEvoObj = obterInstanciaECharts(domTransporte, chartTransporteEvoObj);
                chartTransporteEvoObj.setOption({
                    animationDurationUpdate: 200,
                    backgroundColor: 'transparent',
                    tooltip: { 
                        trigger: 'axis', 
                        axisPointer: { type: 'shadow' }, 
                        backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                        borderColor: 'rgba(51, 65, 85, 0.8)', 
                        textStyle: { color: '#f8fafc' }, 
                        formatter: function(params) {
                            let html = `<div style="font-weight:bold; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; margin-bottom: 4px;">${params[0].axisValue}</div>`;
                            params.forEach(p => {
                                let valFormatado = p.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                                html += `${p.marker} ${p.seriesName}: <b style="color: #fff">${valFormatado}</b><br/>`;
                                                                 
                                if (p.seriesName.includes('Realizado')) {
                                    let perc = metaTransporteDiaria > 0 ? ((p.value / metaTransporteDiaria) * 100).toFixed(1) : 0;
                                    let corPerc = perc >= 100 ? '#34d399' : (perc >= 80 ? '#fbbf24' : '#f87171');
                                    html += `<div style="margin-left: 14px; font-size: 11.5px; color: ${corPerc}; margin-bottom: 3px; margin-top: 1px;">  Atingido no Dia: <b>${perc}%</b></div>`;
                                }
                            });
                            return html;
                        }
                    },
                    grid: { top: 25, right: '3%', bottom: '5%', left: '4%', containLabel: true },
                    xAxis: { type: 'category', data: labels, axisLabel: { color: '#94a3b8', fontSize: 11, margin: 15 }, axisLine: { lineStyle: { color: '#334155' } } },
                    yAxis: { type: 'value', axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v) => v >= 1000 ? (v/1000)+'k' : v }, splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } } },
                    series: [
                        { 
                            name: `Realizado (Transporte)`, 
                            type: 'bar', 
                            data: recTranspArr, 
                            barMaxWidth: 50, 
                            label: {
                                show: true,
                                position: 'top',
                                distance: 5,
                                formatter: function(params) {
                                    if (params.value === 0) return '';
                                    if (params.value >= 1000) return (params.value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k';
                                    return params.value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
                                },
                                color: '#94a3b8',
                                fontSize: 10,
                                fontWeight: 'bold'
                            },
                            itemStyle: { 
                                color: function(params) {
                                    if (params.value >= metaTransporteDiaria && metaTransporteDiaria > 0) {
                                        return new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#34d399' }, { offset: 1, color: '#059669' }]);
                                    }
                                    return new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#38bdf8' }, { offset: 1, color: '#0284c7' }]);
                                }, 
                                borderRadius: [4, 4, 0, 0] 
                            } 
                        },
                        { name: 'Meta Diária', type: 'line', data: metaTranspArr, symbol: 'none', lineStyle: { color: '#fbbf24', width: 3, type: 'dashed' }, z: 10 }
                    ]
                }, { notMerge: true });
            }
                         
            const domCarregamento = document.getElementById('chartCarregamentoEvolucao');
            if (domCarregamento) {
                chartCarregamentoEvoObj = obterInstanciaECharts(domCarregamento, chartCarregamentoEvoObj);
                chartCarregamentoEvoObj.setOption({
                    animationDurationUpdate: 200,
                    backgroundColor: 'transparent',
                    tooltip: { 
                        trigger: 'axis', 
                        axisPointer: { type: 'shadow' }, 
                        backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                        borderColor: 'rgba(51, 65, 85, 0.8)', 
                        textStyle: { color: '#f8fafc' }, 
                        formatter: function(params) {
                            let html = `<div style="font-weight:bold; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; margin-bottom: 4px;">${params[0].axisValue}</div>`;
                            params.forEach(p => {
                                let valFormatado = p.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                                html += `${p.marker} ${p.seriesName}: <b style="color: #fff">${valFormatado}</b><br/>`;
                                                                 
                                if (p.seriesName.includes('Realizado')) {
                                    let perc = metaCarregamentoDiaria > 0 ? ((p.value / metaCarregamentoDiaria) * 100).toFixed(1) : 0;
                                    let corPerc = perc >= 100 ? '#34d399' : (perc >= 80 ? '#fbbf24' : '#f87171');
                                    html += `<div style="margin-left: 14px; font-size: 11.5px; color: ${corPerc}; margin-bottom: 3px; margin-top: 1px;">  Atingido no Dia: <b>${perc}%</b></div>`;
                                }
                            });
                            return html;
                        }
                    },
                    grid: { top: 25, right: '3%', bottom: '5%', left: '4%', containLabel: true },
                    xAxis: { type: 'category', data: labels, axisLabel: { color: '#94a3b8', fontSize: 11, margin: 15 }, axisLine: { lineStyle: { color: '#334155' } } },
                    yAxis: { type: 'value', axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v) => v >= 1000 ? (v/1000)+'k' : v }, splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } } },
                    series: [
                        { 
                            name: `Realizado (Carregamento)`, 
                            type: 'bar', 
                            data: recCarregArr, 
                            barMaxWidth: 50,
                            label: {
                                show: true,
                                position: 'top',
                                distance: 5,
                                formatter: function(params) {
                                    if (params.value === 0) return '';
                                    if (params.value >= 1000) return (params.value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k';
                                    return params.value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
                                },
                                color: '#94a3b8',
                                fontSize: 10,
                                fontWeight: 'bold'
                            }, 
                            itemStyle: { 
                                color: function(params) {
                                    if (params.value >= metaCarregamentoDiaria && metaCarregamentoDiaria > 0) {
                                        return new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#34d399' }, { offset: 1, color: '#059669' }]);
                                    }
                                    return new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#a855f7' }, { offset: 1, color: '#7e22ce' }]);
                                }, 
                                borderRadius: [4, 4, 0, 0] 
                            } 
                        },
                        { name: 'Meta Diária', type: 'line', data: metaCarregArr, symbol: 'none', lineStyle: { color: '#fbbf24', width: 3, type: 'dashed' }, z: 10 }
                    ]
                }, { notMerge: true });
            }
                         
            const domVolumes = document.getElementById('chartVolumes');
            if (domVolumes) {
                chartVolumesObj = obterInstanciaECharts(domVolumes, chartVolumesObj);
                chartVolumesObj.setOption({
                    animationDurationUpdate: 200,
                    backgroundColor: 'transparent',
                    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'rgba(51, 65, 85, 0.8)', textStyle: { color: '#f8fafc' }, valueFormatter: (v) => v.toLocaleString('pt-BR') + ' m³' },
                    legend: { top: '0%', left: '0%', textStyle: { color: '#cbd5e1', fontSize: 12 } },
                    grid: { top: 40, right: '3%', bottom: '5%', left: '4%', containLabel: true },
                    xAxis: { type: 'category', data: labels, axisLabel: { color: '#94a3b8', fontSize: 11, margin: 15 }, axisLine: { lineStyle: { color: '#334155' } } },
                    yAxis: { type: 'value', axisLabel: { color: '#94a3b8', fontSize: 11 }, splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } } },
                    series: [
                        { 
                            name: 'Vol. Transportado', 
                            type: 'bar', 
                            data: volTranspArr, 
                            barMaxWidth: 40, 
                            label: {
                                show: true,
                                position: 'top',
                                formatter: function(params) {
                                    if (params.value === 0) return '';
                                    if (params.value >= 1000) return (params.value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k';
                                    return params.value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
                                },
                                color: '#94a3b8',
                                fontSize: 9
                            },
                            itemStyle: { color: '#6366f1', borderRadius: [2, 2, 0, 0] } 
                        },
                        { 
                            name: 'Vol. Carregado', 
                            type: 'bar', 
                            data: volCarregArr, 
                            barMaxWidth: 40,
                            label: {
                                show: true,
                                position: 'top',
                                formatter: function(params) {
                                    if (params.value === 0) return '';
                                    if (params.value >= 1000) return (params.value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k';
                                    return params.value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
                                },
                                color: '#94a3b8',
                                fontSize: 9
                            }, 
                            itemStyle: { color: '#a855f7', borderRadius: [2, 2, 0, 0] } 
                        }
                    ]
                }, { notMerge: true });
            }
                     
        } catch (errEcharts) {
            console.error("Erro ao desenhar gráficos ECharts:", errEcharts);
        }
    }

    function desenharGrafico7DiasFixo() {
        try {
            const hoje = new Date();
            const dias7 = [];
                         
            for (let i = 7; i >= 1; i--) {
                const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - i);
                dias7.push(formatarDataChave(d));
            }
            const elFiltroTransp = document.getElementById('filtroTransportadora');
            const filtroTransp = elFiltroTransp ? elFiltroTransp.value : '';
            let precoCarregamento = parseFloat(tarifadorAtivoGlobal?.preco_carregamento) || 0;
            let agg7 = {};
            dias7.forEach(k => agg7[k] = { recTransp: 0, recCarreg: 0 });

            for (let i = 0, len = dadosHistoricoGlobal.length; i < len; i++) {
                const registro = dadosHistoricoGlobal[i];
                const keyData = registro._keyData;
                if (!keyData || !agg7[keyData]) continue;

                const isSerrana = registro._isSerrana;
                const isNossaGrua = registro._isNossaGrua;
                if (!isSerrana && !isNossaGrua) continue;

                const tr = registro.transportadora;
                if (filtroTransp === 'SOMENTE_SERRANA' && !isSerrana) continue;
                if (filtroTransp === 'SOMENTE_TERCEIROS' && isSerrana) continue;
                if (filtroTransp !== '' && filtroTransp !== 'SOMENTE_SERRANA' && filtroTransp !== 'SOMENTE_TERCEIROS' && tr !== filtroTransp) continue;
                
                const v = registro.volumeReal;
                let recTransporte = 0;
                if (isSerrana && tarifadorAtivoGlobal) {
                    recTransporte = calcularTarifaTransporte(registro.distanciaAsfalto, registro.distanciaTerra) * v;
                } else if (isSerrana) {
                    recTransporte = registro.valor_cte;
                }
                let recCarregamento = isNossaGrua ? (v * precoCarregamento) : 0;
                agg7[keyData].recTransp += recTransporte;
                agg7[keyData].recCarreg += recCarregamento;
            }

            const labels = dias7.map(k => {
                const p = k.split('-');
                return `${p[2]}/${p[1]}`;
            });
                         
            const metaTotalVal = metaTransporteDiaria + metaCarregamentoDiaria;
            const dataTotalDiario = dias7.map(k => agg7[k].recTransp + agg7[k].recCarreg);
            const dataMetaCombinada = dias7.map(() => metaTotalVal);
            const dom7Dias = document.getElementById('chart7DiasFixo');
            if (dom7Dias) {
                chart7DiasObj = obterInstanciaECharts(dom7Dias, chart7DiasObj);
                chart7DiasObj.setOption({
                    animationDurationUpdate: 200,
                    backgroundColor: 'transparent',
                    tooltip: {
                        trigger: 'axis',
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        borderColor: 'rgba(51, 65, 85, 0.8)',
                        textStyle: { color: '#f8fafc' },
                        padding: 12,
                        formatter: function(params) {
                            let html = `<div style="font-weight:900; color:#94a3b8; font-size: 11px; text-transform:uppercase; letter-spacing:1px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px; margin-bottom: 12px;">  Data: ${params[0].axisValue}</div>`;
                            let totalVal = 0;
                                                         
                            params.forEach(p => {
                                if(p.seriesName === 'Faturamento Total (Transp + Carreg)') {
                                    totalVal = p.value;
                                }
                            });
                                                         
                            let valFormatado = totalVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                            let metaFormatada = metaTotalVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                                                         
                            html += `<div style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; gap: 20px; font-size: 13px;">
                                        <span style="color: #cbd5e1;"><span style="display:inline-block;margin-right:6px;border-radius:50%;width:8px;height:8px;background-color:#38bdf8;box-shadow:0 0 5px #38bdf8;"></span>Faturamento Total:</span>
                                        <b style="color: #fff; font-size: 14px;">${valFormatado}</b>
                                     </div>`;
                                                                  
                            html += `<div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; gap: 20px; font-size: 13px;">
                                        <span style="color: #94a3b8;"><span style="display:inline-block;margin-right:6px;width:10px;height:3px;background-color:#fbbf24;"></span>Meta Combinada:</span>
                                        <b style="color: #94a3b8;">${metaFormatada}</b>
                                     </div>`;
                                                         
                            let perc = metaTotalVal > 0 ? ((totalVal / metaTotalVal) * 100).toFixed(1) : 0;
                            let corPerc = totalVal >= metaTotalVal ? '#10b981' : '#ef4444'; 
                            let icone = totalVal >= metaTotalVal ? '  Acima da Meta' : '  Abaixo da Meta';
                            let bgAlert = totalVal >= metaTotalVal ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
                                                         
                            html += `<div style="background: ${bgAlert}; padding: 10px; border-radius: 8px; font-size: 13px; color: ${corPerc}; border: 1px solid ${corPerc}40; text-align: center;">
                                <span style="font-size: 22px; font-weight: 900; display: block; margin-bottom: 2px; text-shadow: 0 0 10px ${corPerc}40;">${perc}%</span>
                                <span style="font-size:11px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">${icone}</span>
                            </div>`;
                                                         
                            return html;
                        }
                    },
                    grid: { top: 40, right: '4%', bottom: '5%', left: '5%', containLabel: true },
                    xAxis: { 
                        type: 'category', 
                        boundaryGap: false, 
                        data: labels, 
                        axisLabel: { color: '#94a3b8', fontSize: 11, margin: 12 }, 
                        axisLine: { lineStyle: { color: '#334155' } } 
                    },
                    yAxis: { 
                        type: 'value', 
                        axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v) => v >= 1000 ? (v / 1000) + 'k' : v }, 
                        splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } } 
                    },
                    series: [
                        {
                            name: 'Faturamento Total (Transp + Carreg)', 
                            type: 'line', 
                            data: dataTotalDiario,
                            smooth: true, 
                            symbol: 'circle',
                            symbolSize: 8,
                            showSymbol: true,
                            label: {
                                show: true,
                                position: 'top',
                                distance: 10,
                                formatter: function(params) {
                                    if (params.value === 0) return '';
                                    return params.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
                                },
                                color: '#f8fafc',
                                fontSize: 10,
                                fontWeight: 'bold',
                                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                                borderColor: 'rgba(56, 189, 248, 0.4)',
                                borderWidth: 1,
                                borderRadius: 6,
                                padding: [4, 8],
                                shadowColor: 'rgba(0, 0, 0, 0.5)',
                                shadowBlur: 4,
                                shadowOffsetY: 2
                            },
                            itemStyle: { color: '#0ea5e9' },
                            lineStyle: { 
                                width: 4, 
                                color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#38bdf8' }, { offset: 1, color: '#818cf8' }]),
                                shadowColor: 'rgba(56,189,248,0.4)', 
                                shadowBlur: 15, 
                                shadowOffsetY: 5
                            },
                            areaStyle: {
                                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                    { offset: 0, color: 'rgba(56,189,248,0.4)' },
                                    { offset: 0.8, color: 'rgba(129,140,248,0.05)' },
                                    { offset: 1, color: 'rgba(129,140,248,0)' }
                                ])
                            },
                            z: 5
                        },
                        { 
                            name: 'Meta Combinada', 
                            type: 'line', 
                            data: dataMetaCombinada, 
                            symbol: 'none', 
                            lineStyle: { color: '#fbbf24', width: 2, type: 'dashed' }, 
                            z: 10 
                        }
                    ]
                }, { notMerge: true });
            }
        } catch (e) {
            console.error("Erro ao desenhar grafico 7 dias fixo", e);
        }
    }

    function renderizarTabela(dados) {
        try {
            const tbody = document.getElementById('tbodyProducaoFrota');
            if(!tbody) return;
                         
            if (dados.length === 0) { 
                tbody.innerHTML = `<tr><td colspan="10" class="text-center p-8 text-slate-500">Nenhum dado encontrado para os filtros selecionados.</td></tr>`; 
                return; 
            }
                         
            const rowsHtml = dados.map(l => {
                const totalGerado = l.recTransp + l.recCarreg;
                const isSerranaBadge = l.isSerrana ? `<span class="bg-sky-500/10 text-sky-400 font-bold px-2 py-0.5 rounded text-[10px]">${l.transp}</span>` : `<span class="text-slate-400 text-xs">${l.transp}</span>`;
                const tarifaStr = l.isSerrana && l.tarifa > 0 ? l.tarifa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-';
                                 
                return `<tr class="hover:bg-slate-700/30 transition-colors">
                    <td class="px-6 py-3 font-bold text-white"><span class="bg-slate-900 px-2 py-1 rounded border border-slate-700 font-mono tracking-widest">${l.placa}</span></td>
                    <td class="px-6 py-3 uppercase">${isSerranaBadge}</td>
                    <td class="px-6 py-3 text-center text-slate-300 font-mono">${l.asfalto.toFixed(1)} km</td>
                    <td class="px-6 py-3 text-center text-slate-300 font-mono">${l.terra.toFixed(1)} km</td>
                    <td class="px-6 py-3 text-center text-sky-400 font-mono font-bold">${tarifaStr}</td>
                    <td class="px-6 py-3 text-center text-slate-300 font-black">${l.viagens}</td>
                    <td class="px-6 py-3 text-right text-slate-300 font-mono font-bold">${l.volume.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                    <td class="px-6 py-3 text-right text-sky-400 font-mono">${l.recTransp.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td class="px-6 py-3 text-right text-emerald-400 font-mono">${l.recCarreg.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td class="px-6 py-3 text-right text-purple-400 font-mono font-black bg-purple-500/5">${totalGerado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                </tr>`;
            }).join('');

            tbody.innerHTML = rowsHtml;
        } catch(e) { console.error("[PRODUCAO] Erro ao renderizar tabela:", e); }
    }

    function exportarParaExcel() {
        if (!dadosFiltradosAtual || dadosFiltradosAtual.length === 0) { alert("Sem dados para exportar."); return; }
        if (typeof XLSX === 'undefined') { alert("A biblioteca Excel ainda não foi carregada. Aguarde."); return; }
                 
        const elPeriodo = document.getElementById('filtroPeriodoQuinzenal');
        const periodoTexto = elPeriodo ? elPeriodo.options[elPeriodo.selectedIndex].text.replace(/[^a-zA-Z0-9]/g, '_') : 'Exportacao';
        const fileBase = `Placas_Operacao_Financeira_${periodoTexto}`;
                 
        const wb = XLSX.utils.book_new();
        const excelFrentesArr = dadosFrentesAtual.map(i => ({
            "Frente / Categoria": i.categoria,
            "Dist. Asfalto (km)": i.asfalto,
            "Dist. Terra (km)": i.terra,
            "Tarifa Transporte (R$)": parseFloat(i.tarifa.toFixed(4)),
            "Viagens": i.viagens,
            "Volume Total (m³)": parseFloat(i.volume.toFixed(2)),
            "Caixa Média (m³)": parseFloat((i.viagens > 0 ? i.volume/i.viagens : 0).toFixed(2)),
            "Receita Total (R$)": parseFloat(i.receita.toFixed(2))
        }));
                 
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(excelFrentesArr), "Resumo por Frente");
                 
        const obj = {};
        let precoCarregamento = parseFloat(tarifadorAtivoGlobal?.preco_carregamento) || 0;
                 
        dadosFiltradosAtual.forEach(r => {
            const dataViagem = r.dataViagem;
            const tr = r.transportadora || 'N/A';
            const isSerrana = r._isSerrana;
            const isNossaGrua = r._isNossaGrua;
                         
            let asfalto = r.distanciaAsfalto;
            let terra = r.distanciaTerra;
            let v = r.volumeReal;
            let viagens = r.qtdViagens || 1;
                         
            let tarifaTransp = 0;
            let recTransp = 0;
            if (isSerrana && tarifadorAtivoGlobal) {
                tarifaTransp = calcularTarifaTransporte(asfalto, terra);
                recTransp = tarifaTransp * v;
            } else if (isSerrana) {
                recTransp = r.valor_cte;
                if (v > 0) tarifaTransp = recTransp / v;
            }
            let recCarreg = isNossaGrua ? (v * precoCarregamento) : 0;
                         
            const ch = `${dataViagem}_${r.placa}_${asfalto}_${terra}`;
            if(!obj[ch]) obj[ch] = { Data: dataViagem, Placa: r.placa, Transp: tr, Asfalto: asfalto, Terra: terra, Tarifa: tarifaTransp, Viagens: 0, Vol: 0, RecTransp: 0, RecCarreg: 0 };
                         
            obj[ch].Viagens += viagens;
            obj[ch].Vol += v;
            obj[ch].RecTransp += recTransp;
            obj[ch].RecCarreg += recCarreg;
        });
                 
        const excelArr = Object.values(obj).sort((a,b) => getFastTime(a.Data) - getFastTime(b.Data)).map(i => ({
            "Data": i.Data, "Placa": i.Placa, "Transportadora": i.Transp, "Dist. Asfalto (km)": i.Asfalto, "Dist. Terra (km)": i.Terra, "Tarifa Base (R$)": parseFloat(i.Tarifa.toFixed(4)),
            "Viagens": i.Viagens, "Volume Total (m³)": parseFloat(i.Vol.toFixed(2)), "Receita Transporte (R$)": parseFloat(i.RecTransp.toFixed(2)), "Receita Carregamento (R$)": parseFloat(i.RecCarreg.toFixed(2)),
            "Receita Total (R$)": parseFloat((i.RecTransp + i.RecCarreg).toFixed(2))
        }));
                 
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(excelArr), "Detalhamento de Rotas");
        XLSX.writeFile(wb, `${fileBase}.xlsx`);
    }

    function exportarResumoDiarioExcel() {
        const chaves = Object.keys(agrupamentoDiarioGlobal).sort((a, b) => getFastTime(a) - getFastTime(b));
        if (chaves.length === 0) { alert("Sem dados para resumo."); return; }
        if (typeof XLSX === 'undefined') { alert("A biblioteca Excel ainda não foi carregada. Aguarde."); return; }
                 
        const excelArr = chaves.map(d => {
            const item = agrupamentoDiarioGlobal[d];
            return {
                "Data": d,
                "Volume Transporte (m³)": parseFloat(item.volTransp.toFixed(2)),
                "Volume Carregamento (m³)": parseFloat(item.volCarreg.toFixed(2)),
                "Receita Transporte (R$)": parseFloat(item.recTransp.toFixed(2)),
                "Receita Carregamento (R$)": parseFloat(item.recCarreg.toFixed(2)),
                "Receita Total do Dia (R$)": parseFloat((item.recTransp + item.recCarreg).toFixed(2))
            };
        });
                 
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(excelArr), "Resumo Diario");
        XLSX.writeFile(wb, `Resumo_Operacional_Diario.xlsx`);
    }

    function mostrarAlerta(mensagem, tipo) {
        const alertContainer = document.getElementById('producao-alert-container');
        if(!alertContainer) return;
        let bgClass, borderClass, textClass, iconClass;
                 
        if (tipo === 'error') { bgClass = 'bg-red-500/10'; borderClass = 'border-red-500/30'; textClass = 'text-red-400'; iconClass = 'fa-exclamation-triangle'; }
        else if (tipo === 'warning') { bgClass = 'bg-yellow-500/10'; borderClass = 'border-yellow-500/30'; textClass = 'text-yellow-400'; iconClass = 'fa-exclamation-circle'; }
        else { bgClass = 'bg-blue-500/10'; borderClass = 'border-blue-500/30'; textClass = 'text-blue-400'; iconClass = 'fa-info-circle'; }
                 
        alertContainer.innerHTML = `<div class="${bgClass} ${borderClass} border p-4 rounded-xl flex items-center gap-3 shadow-sm mb-4"><div class="${textClass} text-xl"><i class="fas ${iconClass}"></i></div><p class="${textClass} text-sm font-medium">${mensagem}</p></div>`;
        setTimeout(() => { alertContainer.innerHTML = ''; }, 5000);
    }
}