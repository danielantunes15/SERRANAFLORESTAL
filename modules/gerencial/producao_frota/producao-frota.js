// ==========================================
// js/producao-frota.js - PRODUÇÃO E FATURAMENTO (TRANSPORTE VS CARREGAMENTO)
// ==========================================

if(typeof Chart !== 'undefined') {
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

// Agora usamos um Map para guardar as propriedades detalhadas das gruas
var gruasPropriasCache = new Map(); 

var chartVolumesObj = null;
var chartReceitasObj = null;
var chartFaturamentoTotalObj = null; // Instância do novo gráfico

const TOLERANCIA_DISTANCIA_KM = 5.0; // Tolerância em km para agrupar as tarifas

function getSupabaseClient() {
    if (window.supabaseClient) return window.supabaseClient;
    if (typeof supabaseClient !== 'undefined') return supabaseClient;
    console.error("[PRODUCAO] FATAL: Nenhum cliente Supabase encontrado!");
    return null;
}

window.initProducaoFrota = async function() {
    console.log("[PRODUCAO] Módulo iniciado.");
    configurarEventos();
    definirDatasPadrao();
    await buscarTarifadorAtivo();
    buscarTodosDadosSupabase();
};

function configurarEventos() {
    const btnFiltros = document.getElementById('btnAplicarFiltros');
    if(btnFiltros) btnFiltros.addEventListener('click', processarFiltrosEExibir);

    const btnExcel = document.getElementById('btnExportarExcel');
    if(btnExcel) btnExcel.addEventListener('click', exportarParaExcel);
    
    const btnResProd = document.getElementById('btnExportarResumoProd');
    if(btnResProd) btnResProd.addEventListener('click', exportarResumoDiarioExcel);
}

function definirDatasPadrao() {
    const dataFim = new Date();
    const dataInicio = new Date();
    dataInicio.setDate(dataFim.getDate() - 7);
    
    const elFim = document.getElementById('dataFim');
    if(elFim) elFim.value = dataFim.toISOString().split('T')[0];

    const elInicio = document.getElementById('dataInicio');
    if(elInicio) elInicio.value = dataInicio.toISOString().split('T')[0];
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
            const precoCarreg = parseFloat(tarifadorAtivoGlobal.preco_carregamento) || 0;
            if(displayNome) displayNome.innerText = `${tarifadorAtivoGlobal.nome} (Carregamento: R$ ${precoCarreg.toFixed(2)})`;
            if(badge) {
                badge.classList.remove('bg-indigo-600/20', 'text-indigo-400', 'border-indigo-500/50', 'bg-rose-600/20', 'text-rose-400', 'border-rose-500/50');
                badge.classList.add('bg-emerald-600/20', 'text-emerald-400', 'border-emerald-500/50');
            }
        } else {
            tarifadorAtivoGlobal = null;
            if(displayNome) displayNome.innerText = "Nenhum Tarifador Ativo no Sistema";
            if(badge) {
                badge.classList.remove('bg-indigo-600/20', 'text-indigo-400', 'border-indigo-500/50', 'bg-emerald-600/20', 'text-emerald-400', 'border-emerald-500/50');
                badge.classList.add('bg-rose-600/20', 'text-rose-400', 'border-rose-500/50');
            }
        }
    } catch(err) {
        console.error("[PRODUCAO] Erro ao buscar tarifador:", err);
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
        if(tStatus) tStatus.innerText = "Baixando configurações de Gruas...";
        const { data: gruasData } = await client.from('config_gruas').select('codigos, tipo_frente, ordem, frente');
        
        gruasPropriasCache = new Map();
        if (gruasData) {
            gruasData.forEach(g => {
                if (g.tipo_frente && g.tipo_frente.trim().toUpperCase() === 'PROPRIA' && g.codigos) {
                    g.codigos.split(',').forEach(c => {
                        gruasPropriasCache.set(c.trim().toUpperCase(), {
                            ordem: g.ordem || 'CX',
                            frente: g.frente || 'FRENTE DESCONHECIDA',
                            tipo_frente: g.tipo_frente
                        });
                    });
                }
            });
        }

        if(tStatus) tStatus.innerText = "Baixando histórico de viagens...";
        dadosHistoricoGlobal = [];
        
        let from = 0;
        const step = 1000;
        let fetchMore = true;
        
        while (fetchMore) {
            let query = client.from('historico_viagens').select('*').range(from, from + step - 1);
            if (typeof window.aplicarFiltroLocal === 'function') query = window.aplicarFiltroLocal(query);

            const { data, error } = await query;
            if (error) { console.error("Erro ao buscar viagens:", error); break; }

            if (data && data.length > 0) { 
                dadosHistoricoGlobal = dadosHistoricoGlobal.concat(data); 
                from += step; 
                if(tStatus) tStatus.innerText = `Baixando... (${dadosHistoricoGlobal.length} registros)`;
            }
            if (!data || data.length < step) { fetchMore = false; }
        }
        
        popularDropdownTransportadoras(dadosHistoricoGlobal);
        processarFiltrosEExibir();
        
    } catch (e) {
        console.error("[PRODUCAO] Erro global na busca:", e);
        if(tStatus) tStatus.innerText = "Erro ao carregar dados.";
    }
}

function popularDropdownTransportadoras(dados) {
    try {
        const select = document.getElementById('filtroTransportadora');
        if(!select) return;

        const transpSet = new Set();
        dados.forEach(d => {
             if (d.transportadora) {
                transpSet.add(d.transportadora.trim().toUpperCase());
             }
        });
        
        let opsHtml = '<option value="">TODAS AS TRANSPORTADORAS E FRENTES</option>';
        opsHtml += '<option value="SOMENTE_SERRANA">📦 APENAS NOSSOS CAMINHÕES (Serrana)</option>';
        opsHtml += '<option value="SOMENTE_TERCEIROS">🤝 APENAS CAMINHÕES TERCEIROS</option>';
        
        Array.from(transpSet).sort().forEach(t => {
            opsHtml += `<option value="${t}">${t}</option>`;
        });
        
        select.innerHTML = opsHtml;
    } catch(e) { console.error("[PRODUCAO] Erro dropdown transportadora:", e); }
}

function converterDataString(dataStr) {
    if (!dataStr) return new Date(0);
    const p = dataStr.split('/');
    if (p.length === 3) return new Date(p[2], parseInt(p[1]) - 1, p[0]);
    if (dataStr.includes('-')) {
        const p2 = dataStr.split('-');
        return new Date(p2[0], parseInt(p2[1]) - 1, p2[2].substring(0,2));
    }
    return new Date(dataStr);
}

function calcularTarifaTransporte(asfalto, terra) {
    if (!tarifadorAtivoGlobal || !tarifadorAtivoGlobal.dados) return 0;

    let asfaltoVal = parseFloat(String(asfalto).replace(',','.')) || 0;
    let terraVal = parseFloat(String(terra).replace(',','.')) || 0;
    const dadosMatriz = tarifadorAtivoGlobal.dados;
    
    const exato = dadosMatriz.find(t => Math.abs(t.asfalto - asfaltoVal) < 0.001 && Math.abs(t.terra - terraVal) < 0.001);
    if (exato) return exato.tarifa;

    let maisProximo = null;
    let menorDistancia = Infinity;
    
    dadosMatriz.forEach(t => {
        const distancia = Math.sqrt(Math.pow(t.asfalto - asfaltoVal, 2) + Math.pow(t.terra - terraVal, 2));
        if (distancia < menorDistancia) {
            menorDistancia = distancia;
            maisProximo = t;
        }
    });

    return maisProximo ? maisProximo.tarifa : 0;
}

function atualizarPaineisReceita(f5, f6) {
    const formatarDinheiro = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formatarNumero = (valor) => valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    // Cálculos Frente 5 (Acumulados e Médias Corretas)
    const f5TranspRS = f5.recTranspTotal;
    const f5CarrRS = f5.recCarregTotal;
    
    document.getElementById('f5_transporte_rs').innerText = formatarDinheiro(f5TranspRS);
    document.getElementById('f5_carregamento_rs').innerText = formatarDinheiro(f5CarrRS);
    document.getElementById('f5_receita_total').innerText = formatarDinheiro(f5TranspRS + f5CarrRS);
    document.getElementById('f5_vol_transportado').innerText = formatarNumero(f5.volTransp);
    document.getElementById('f5_vol_carregado').innerText = formatarNumero(f5.volCarreg);
    document.getElementById('f5_qtd_viagens').innerText = f5.viagens;
    document.getElementById('f5_distancias').innerText = `${formatarNumero(f5.asfalto)} km / ${formatarNumero(f5.terra)} km`;
    document.getElementById('f5_tarifa_transporte').innerText = formatarNumero(f5.tarifaT);
    document.getElementById('f5_tarifa_carregamento').innerText = formatarNumero(f5.tarifaC);

    // Cálculos Frente 6 (Acumulados e Médias Corretas)
    const f6TranspRS = f6.recTranspTotal;
    const f6CarrRS = f6.recCarregTotal;

    document.getElementById('f6_transporte_rs').innerText = formatarDinheiro(f6TranspRS);
    document.getElementById('f6_carregamento_rs').innerText = formatarDinheiro(f6CarrRS);
    document.getElementById('f6_receita_total').innerText = formatarDinheiro(f6TranspRS + f6CarrRS);
    document.getElementById('f6_vol_transportado').innerText = formatarNumero(f6.volTransp);
    document.getElementById('f6_vol_carregado').innerText = formatarNumero(f6.volCarreg);
    document.getElementById('f6_qtd_viagens').innerText = f6.viagens;
    document.getElementById('f6_distancias').innerText = `${formatarNumero(f6.asfalto)} km / ${formatarNumero(f6.terra)} km`;
    document.getElementById('f6_tarifa_transporte').innerText = formatarNumero(f6.tarifaT);
    document.getElementById('f6_tarifa_carregamento').innerText = formatarNumero(f6.tarifaC);
}

function processarFiltrosEExibir() {
    try {
        const tStatus = document.getElementById('tabelaStatus');
        if(tStatus) tStatus.innerText = "Processando cálculos financeiros...";
        
        const elFiltroTransp = document.getElementById('filtroTransportadora');
        const filtroTransp = elFiltroTransp ? elFiltroTransp.value : '';

        const elStrInicio = document.getElementById('dataInicio');
        const strInicio = elStrInicio ? elStrInicio.value : '';
        
        const elStrFim = document.getElementById('dataFim');
        const strFim = elStrFim ? elStrFim.value : '';

        let timeInicio = strInicio ? new Date(strInicio.split('-')[0], parseInt(strInicio.split('-')[1]) - 1, strInicio.split('-')[2]).getTime() : 0;
        let timeFim = strFim ? new Date(strFim.split('-')[0], parseInt(strFim.split('-')[1]) - 1, strFim.split('-')[2], 23, 59, 59).getTime() : Infinity;

        // Limpeza dos filtros
        dadosFiltradosAtual = dadosHistoricoGlobal.filter(registro => {
            const tr = registro.transportadora ? registro.transportadora.trim().toUpperCase() : 'N/A';
            const isSerrana = tr.includes('SERRANALOG') || tr.includes('SERRANA LOG');
            
            const gruaReg = registro.grua ? registro.grua.trim().toUpperCase() : '';
            const isNossaGrua = gruasPropriasCache.has(gruaReg);

            if (!isSerrana && !isNossaGrua) return false;

            if (filtroTransp === 'SOMENTE_SERRANA' && !isSerrana) return false;
            if (filtroTransp === 'SOMENTE_TERCEIROS' && isSerrana) return false;
            if (filtroTransp !== '' && filtroTransp !== 'SOMENTE_SERRANA' && filtroTransp !== 'SOMENTE_TERCEIROS' && tr !== filtroTransp) return false;

            const dataViagem = registro.dtFimDescarFabrica || registro.dataDaBaseExcel;
            
            if (dataViagem) {
                const trTime = converterDataString(dataViagem).getTime();
                if (trTime < timeInicio || trTime > timeFim) return false;
            } else {
                return false; 
            }
            return true;
        });

        const agrupamentoTabela = {};
        const agrupamentoFrente = {}; 
        const agrupamentoDiario = {};
        let dadosEnriquecidos = [];
        
        let tTranspViagens = 0, tTranspVol = 0, tTranspRec = 0;
        let tCarregViagens = 0, tCarregVol = 0, tCarregRec = 0;

        let precoCarregamento = parseFloat(tarifadorAtivoGlobal?.preco_carregamento) || 0;

        // Estrutura de acúmulo financeiro e de distância real das frentes
        let f5 = { 
            volTransp: 0, volCarreg: 0, viagens: 0, asfalto: 0, terra: 0, tarifaT: 0, tarifaC: 0,
            totalAsfalto: 0, totalTerra: 0, totalTarifaT: 0, recTranspTotal: 0, recCarregTotal: 0 
        };
        let f6 = { 
            volTransp: 0, volCarreg: 0, viagens: 0, asfalto: 0, terra: 0, tarifaT: 0, tarifaC: 0,
            totalAsfalto: 0, totalTerra: 0, totalTarifaT: 0, recTranspTotal: 0, recCarregTotal: 0 
        };

        dadosFiltradosAtual.forEach(registro => {
            const d = registro.dtFimDescarFabrica || registro.dataDaBaseExcel;
            
            const pl = registro.placa ? registro.placa.trim().toUpperCase() : 'N/A';
            const tr = registro.transportadora ? registro.transportadora.toUpperCase() : 'N/A';
            const isSerrana = tr.includes('SERRANALOG') || tr.includes('SERRANA LOG');
            
            const gruaReg = registro.grua ? registro.grua.trim().toUpperCase() : '';
            const infoGrua = gruasPropriasCache.get(gruaReg);
            const isNossaGrua = !!infoGrua;
            
            const v = parseFloat(String(registro.volumeReal).replace(',','.')) || 0;
            const asfalto = parseFloat(String(registro.distanciaAsfalto).replace(',','.')) || 0;
            const terra = parseFloat(String(registro.distanciaTerra).replace(',','.')) || 0;
            
            let tarifaTransporte = isSerrana ? calcularTarifaTransporte(asfalto, terra) : 0;
            let recTransporte = isSerrana ? (v * tarifaTransporte) : 0;
            let recCarregamento = isNossaGrua ? (v * precoCarregamento) : 0;
            let totalReceitaItem = recTransporte + recCarregamento;

            if (isSerrana) {
                tTranspViagens += 1;
                tTranspVol += v;
                tTranspRec += recTransporte;
            }
            
            if (isNossaGrua) {
                tCarregViagens += 1;
                tCarregVol += v;
                tCarregRec += recCarregamento;
            }

            let nomeFrente = infoGrua ? infoGrua.frente.toUpperCase() : (registro.frente ? String(registro.frente).toUpperCase() : '');
            
            if (nomeFrente.includes('5')) {
                if (isSerrana) {
                    f5.volTransp += v;
                    f5.viagens += 1;
                    f5.totalAsfalto += asfalto;
                    f5.totalTerra += terra;
                    f5.totalTarifaT += tarifaTransporte;
                    f5.recTranspTotal += recTransporte;
                }
                if (isNossaGrua) {
                    f5.volCarreg += v;
                    f5.recCarregTotal += recCarregamento;
                    f5.tarifaC = precoCarregamento;
                }
            } else if (nomeFrente.includes('6')) {
                if (isSerrana) {
                    f6.volTransp += v;
                    f6.viagens += 1;
                    f6.totalAsfalto += asfalto;
                    f6.totalTerra += terra;
                    f6.totalTarifaT += tarifaTransporte;
                    f6.recTranspTotal += recTransporte;
                }
                if (isNossaGrua) {
                    f6.volCarreg += v;
                    f6.recCarregTotal += recCarregamento;
                    f6.tarifaC = precoCarregamento;
                }
            }

            let nomeCategoria = "DESCONHECIDO";
            if (isSerrana && isNossaGrua) {
                let ordem = infoGrua.ordem || 'CX';
                let frenteNome = infoGrua.frente || 'FRENTE DESCONHECIDA';
                nomeCategoria = `${ordem}: SERRANA - ${frenteNome}`.toUpperCase();
            } else if (!isSerrana && isNossaGrua) {
                let nomeTr = tr.split(' ')[0]; 
                nomeCategoria = `${nomeTr}: TRANSP. ${tr}`.toUpperCase();
            } else if (isSerrana && !isNossaGrua) {
                nomeCategoria = `OUTRAS FRENTES: NOSSOS CAMINHÕES`.toUpperCase();
            }

            const chaveFrente = `${nomeCategoria}_${asfalto}_${terra}`;
            if (!agrupamentoFrente[chaveFrente]) {
                agrupamentoFrente[chaveFrente] = {
                    categoria: nomeCategoria,
                    asfalto: asfalto,
                    terra: terra,
                    tarifa: tarifaTransporte,
                    viagens: 0,
                    volume: 0,
                    receita: 0
                };
            }
            agrupamentoFrente[chaveFrente].viagens += 1;
            agrupamentoFrente[chaveFrente].volume += v;
            agrupamentoFrente[chaveFrente].receita += totalReceitaItem;

            const chaveTabela = `${pl}_${asfalto}_${terra}`;
            if (!agrupamentoTabela[chaveTabela]) {
                agrupamentoTabela[chaveTabela] = { 
                    placa: pl, 
                    transp: tr, 
                    isSerrana: isSerrana, 
                    isNossaGrua: isNossaGrua,
                    asfalto: asfalto, 
                    terra: terra, 
                    tarifa: tarifaTransporte,
                    viagens: 0, 
                    volume: 0, 
                    recTransp: 0, 
                    recCarreg: 0 
                };
            }
            agrupamentoTabela[chaveTabela].viagens += 1;
            agrupamentoTabela[chaveTabela].volume += v;
            agrupamentoTabela[chaveTabela].recTransp += recTransporte;
            agrupamentoTabela[chaveTabela].recCarreg += recCarregamento;

            if (d) {
                if (!agrupamentoDiario[d]) agrupamentoDiario[d] = { volTransp: 0, recTransp: 0, volCarreg: 0, recCarreg: 0 };
                if (isSerrana) {
                    agrupamentoDiario[d].volTransp += v;
                    agrupamentoDiario[d].recTransp += recTransporte;
                }
                if (isNossaGrua) {
                    agrupamentoDiario[d].volCarreg += v;
                    agrupamentoDiario[d].recCarreg += recCarregamento;
                }
            }

            dadosEnriquecidos.push({
                data: d,
                up: nomeFrente,
                placa: pl,
                distAsfalto: asfalto,
                distTerra: terra,
                distTotal: asfalto + terra,
                tarifaTransporte: tarifaTransporte,
                recTransp: recTransporte,
                recCarreg: recCarregamento,
                recTotal: totalReceitaItem,
                volume: v,
                viagens: 1,
                isSerrana: isSerrana,
                isNossaGrua: isNossaGrua
            });
        });

        // Cálculo das Médias de Distância e Tarifas do Período Filtrado
        if (f5.viagens > 0) {
            f5.asfalto = f5.totalAsfalto / f5.viagens;
            f5.terra = f5.totalTerra / f5.viagens;
            f5.tarifaT = f5.totalTarifaT / f5.viagens;
        }
        if (f6.viagens > 0) {
            f6.asfalto = f6.totalAsfalto / f6.viagens;
            f6.terra = f6.totalTerra / f6.viagens;
            f6.tarifaT = f6.totalTarifaT / f6.viagens;
        }

        dadosAgrupadosAtual = Object.values(agrupamentoTabela).sort((a, b) => {
            if (a.placa === b.placa) return b.viagens - a.viagens; 
            return a.placa.localeCompare(b.placa); 
        });

        dadosFrentesAtual = Object.values(agrupamentoFrente).sort((a, b) => b.volume - a.volume);
        agrupamentoDiarioGlobal = agrupamentoDiario;

        // === CÁLCULO SEPARADO E EXCLUSIVO DOS ÚLTIMOS 7 DIAS (GRÁFICO FINANCEIRO 2) ===
        let dataFimGrafico = new Date();
        dataFimGrafico.setDate(dataFimGrafico.getDate() - 1); // <-- DEFINE A DATA FINAL COMO ONTEM
        
        const milissegundosEm7Dias = 7 * 24 * 60 * 60 * 1000;
        const referenciaTime = dataFimGrafico.getTime();
        
        const temDadosRecentes = dadosHistoricoGlobal.some(r => {
            const dt = r.dtFimDescarFabrica || r.dataDaBaseExcel;
            if (!dt) return false;
            const t = converterDataString(dt).getTime();
            return (referenciaTime - t) < milissegundosEm7Dias && t <= referenciaTime;
        });

        if (!temDadosRecentes) {
            let maxTime = 0;
            dadosHistoricoGlobal.forEach(r => {
                const dt = r.dtFimDescarFabrica || r.dataDaBaseExcel;
                if (dt) {
                    const t = converterDataString(dt).getTime();
                    if (t > maxTime && t <= referenciaTime) maxTime = t;
                }
            });
            if (maxTime > 0) dataFimGrafico = new Date(maxTime);
        }

        dataFimGrafico.setHours(23, 59, 59, 999);
        const dataInicioGrafico = new Date(dataFimGrafico);
        dataInicioGrafico.setDate(dataFimGrafico.getDate() - 6);
        dataInicioGrafico.setHours(0, 0, 0, 0);

        const formatarDataChave = (dateObj) => {
            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const d = String(dateObj.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        const ultimos7DiasArray = [];
        for (let i = 0; i < 7; i++) {
            const dTemp = new Date(dataInicioGrafico);
            dTemp.setDate(dataInicioGrafico.getDate() + i);
            ultimos7DiasArray.push(dTemp);
        }

        const agrupamento7Dias = {};
        ultimos7DiasArray.forEach(dt => {
            const key = formatarDataChave(dt);
            agrupamento7Dias[key] = {
                volTransp: 0,
                recTransp: 0,
                volCarreg: 0,
                recCarreg: 0,
                label: dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
            };
        });

        dadosHistoricoGlobal.forEach(registro => {
            const tr = registro.transportadora ? registro.transportadora.trim().toUpperCase() : 'N/A';
            const isSerrana = tr.includes('SERRANALOG') || tr.includes('SERRANA LOG');
            
            const gruaReg = registro.grua ? registro.grua.trim().toUpperCase() : '';
            const infoGrua = gruasPropriasCache.get(gruaReg);
            const isNossaGrua = !!infoGrua;

            if (filtroTransp === 'SOMENTE_SERRANA' && !isSerrana) return;
            if (filtroTransp === 'SOMENTE_TERCEIROS' && isSerrana) return;
            if (filtroTransp !== '' && filtroTransp !== 'SOMENTE_SERRANA' && filtroTransp !== 'SOMENTE_TERCEIROS' && tr !== filtroTransp) return;

            const dataViagemStr = registro.dtFimDescarFabrica || registro.dataDaBaseExcel;
            if (!dataViagemStr) return;

            const dateViagem = converterDataString(dataViagemStr);
            const timeViagem = dateViagem.getTime();

            if (timeViagem >= dataInicioGrafico.getTime() && timeViagem <= dataFimGrafico.getTime()) {
                const key = formatarDataChave(dateViagem);
                if (agrupamento7Dias[key]) {
                    const v = parseFloat(String(registro.volumeReal).replace(',','.')) || 0;
                    const asfalto = parseFloat(String(registro.distanciaAsfalto).replace(',','.')) || 0;
                    const terra = parseFloat(String(registro.distanciaTerra).replace(',','.')) || 0;
                    
                    let tarifaTransporte = isSerrana ? calcularTarifaTransporte(asfalto, terra) : 0;
                    let recTransporte = isSerrana ? (v * tarifaTransporte) : 0;
                    let recCarregamento = isNossaGrua ? (v * precoCarregamento) : 0;

                    if (isSerrana) {
                        agrupamento7Dias[key].volTransp += v;
                        agrupamento7Dias[key].recTransp += recTransporte;
                    }
                    if (isNossaGrua) {
                        agrupamento7Dias[key].volCarreg += v;
                        agrupamento7Dias[key].recCarreg += recCarregamento;
                    }
                }
            }
        });

        // Atualização dos Cards Superiores
        document.getElementById('valTranspViagens').innerText = tTranspViagens.toLocaleString('pt-BR');
        document.getElementById('valTranspVolume').innerText = tTranspVol.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' m³';
        document.getElementById('valTranspReceita').innerText = tTranspRec.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        document.getElementById('valCarregViagens').innerText = tCarregViagens.toLocaleString('pt-BR');
        document.getElementById('valCarregVolume').innerText = tCarregVol.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' m³';
        document.getElementById('valCarregReceita').innerText = tCarregRec.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const totalConsolidado = tTranspRec + tCarregRec;
        document.getElementById('valTotalReceita').innerText = totalConsolidado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        desenharGraficos(agrupamentoDiarioGlobal, agrupamento7Dias);
        atualizarPaineisReceita(f5, f6); 
        renderizarTabela(dadosAgrupadosAtual);
        atualizarPainelDinamico(dadosEnriquecidos); // Chamada para o novo painel dinâmico

        if(tStatus) tStatus.innerText = `${dadosAgrupadosAtual.length} rotas analisadas`;
        
    } catch (errInterface) {
        console.error("[PRODUCAO] Erro Crítico na montagem da tela:", errInterface);
    }
}

function atualizarPainelDinamico(dadosEnriquecidos) {
    const entradasPorDia = {};
    dadosEnriquecidos.forEach(r => {
        if (!r.data) return;
        if (!entradasPorDia[r.data]) entradasPorDia[r.data] = [];
        entradasPorDia[r.data].push(r);
    });

    const resultadoDinamico = [];
    
    for (const data in entradasPorDia) {
        const registrosDia = entradasPorDia[data];
        let gruposTarifarios = [];

        registrosDia.forEach(registro => {
            let grupoExistente = gruposTarifarios.find(g => 
                Math.abs(g.distanciaBase - registro.distTotal) <= TOLERANCIA_DISTANCIA_KM
            );

            if (grupoExistente) {
                grupoExistente.registros.push(registro);
                grupoExistente.totalTransp += registro.recTransp;
                grupoExistente.totalCarreg += registro.recCarreg;
                grupoExistente.totalReceita += registro.recTotal;
                if (registro.isSerrana) grupoExistente.totalVolTransp += registro.volume;
                if (registro.isNossaGrua) grupoExistente.totalVolCarreg += registro.volume;
                grupoExistente.viagens += 1;
                if (!grupoExistente.ups.includes(registro.up)) {
                    grupoExistente.ups.push(registro.up);
                }
            } else {
                gruposTarifarios.push({
                    idGrupo: Math.random().toString(36).substr(2, 9),
                    distanciaBase: registro.distTotal,
                    asfaltoBase: registro.distAsfalto,
                    terraBase: registro.distTerra,
                    registros: [registro],
                    totalTransp: registro.recTransp,
                    totalCarreg: registro.recCarreg,
                    totalReceita: registro.recTotal,
                    totalVolTransp: registro.isSerrana ? registro.volume : 0,
                    totalVolCarreg: registro.isNossaGrua ? registro.volume : 0,
                    viagens: 1,
                    ups: [registro.up]
                });
            }
        });

        // Ordena os grupos pela distancia total
        gruposTarifarios.sort((a,b) => a.distanciaBase - b.distanciaBase);

        resultadoDinamico.push({
            data: data,
            grupos: gruposTarifarios
        });
    }
    
    // Ordena por data
    resultadoDinamico.sort((a,b) => converterDataString(a.data).getTime() - converterDataString(b.data).getTime());

    renderizarPainelDinamico(resultadoDinamico);
}

function renderizarPainelDinamico(resultadoDinamico) {
    const container = document.getElementById('conteudo-painel-dinamico');
    if (!container) return;
    
    if (resultadoDinamico.length === 0) {
        container.innerHTML = '<div class="text-center text-slate-400 py-8">Nenhum dado para o período selecionado.</div>';
        return;
    }

    let html = '<div class="space-y-6">';
    const formatMoney = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formatVol = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    resultadoDinamico.forEach(dia => {
        html += `
        <div class="bg-slate-900/50 rounded-lg border border-slate-700/50 overflow-hidden">
            <div class="bg-slate-800 px-4 py-2 border-b border-slate-700">
                <h4 class="font-bold text-slate-200"><i class="fas fa-calendar-day text-amber-500 mr-2"></i> Data: ${dia.data}</h4>
            </div>
            <div class="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        `;
        
        dia.grupos.forEach((grupo, idx) => {
            html += `
                <div class="bg-slate-800/80 rounded border border-slate-600 p-4 hover:border-amber-500/50 transition-colors">
                    <div class="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1">
                        Tarifa/Fazenda ${idx + 1}
                    </div>
                    <div class="text-sm text-slate-300 space-y-1 mb-3">
                        <div class="flex justify-between"><span class="text-slate-400">Ref. Total (km):</span> <span class="font-mono text-white">${formatVol(grupo.distanciaBase)}</span></div>
                        <div class="flex justify-between"><span class="text-slate-400">Asf / Terra (Ref):</span> <span class="font-mono text-white">${formatVol(grupo.asfaltoBase)} / ${formatVol(grupo.terraBase)}</span></div>
                        <div class="flex justify-between"><span class="text-slate-400">Vol. Transp (m³):</span> <span class="font-mono text-white">${formatVol(grupo.totalVolTransp)}</span></div>
                        <div class="flex justify-between"><span class="text-slate-400">Vol. Carreg (m³):</span> <span class="font-mono text-white">${formatVol(grupo.totalVolCarreg)}</span></div>
                        <div class="flex justify-between"><span class="text-slate-400">Viagens:</span> <span class="font-mono text-white">${grupo.viagens}</span></div>
                        <div class="flex justify-between mt-1 pt-1 border-t border-slate-700"><span class="text-slate-400">Frentes:</span> <span class="text-white text-right truncate ml-2" title="${grupo.ups.join(', ')}">${grupo.ups.join(', ')}</span></div>
                    </div>
                    <div class="bg-slate-900 rounded p-2 text-sm border border-slate-700">
                        <div class="flex justify-between items-center"><span class="text-sky-400 text-xs uppercase font-bold">Transp:</span> <span class="font-mono text-sky-400">${formatMoney(grupo.totalTransp)}</span></div>
                        <div class="flex justify-between items-center"><span class="text-emerald-400 text-xs uppercase font-bold">Carreg:</span> <span class="font-mono text-emerald-400">${formatMoney(grupo.totalCarreg)}</span></div>
                        <div class="flex justify-between items-center mt-1 pt-1 border-t border-slate-700"><span class="text-amber-400 text-xs uppercase font-bold">Receita Total:</span> <span class="font-mono font-bold text-amber-400 text-base">${formatMoney(grupo.totalReceita)}</span></div>
                    </div>
                </div>
            `;
        });
        
        html += `
            </div>
        </div>`;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function desenharGraficos(agrupamento, agrupamento7Dias) {
    try {
        // Gráfico 1: Volumes (Respeita filtros de data)
        const datasOrdenadas = Object.keys(agrupamento).sort((a, b) => converterDataString(a).getTime() - converterDataString(b).getTime());
        const labels = [];
        const volTranspArr = []; 
        const volCarregArr = [];
        const faturamentoTotalArr = []; // Array para o novo gráfico

        datasOrdenadas.forEach(d => {
            labels.push(d.substring(0, 5)); 
            volTranspArr.push(parseFloat(agrupamento[d].volTransp.toFixed(2)));
            volCarregArr.push(parseFloat(agrupamento[d].volCarreg.toFixed(2)));
            
            // Soma o faturamento total diário
            const totalDia = agrupamento[d].recTransp + agrupamento[d].recCarreg;
            faturamentoTotalArr.push(parseFloat(totalDia.toFixed(2)));
        });

        if (chartVolumesObj) chartVolumesObj.destroy();
        const ctx1 = document.getElementById('chartVolumes');
        if(ctx1) {
            chartVolumesObj = new Chart(ctx1, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Vol. Transportado (Serrana)', data: volTranspArr, backgroundColor: '#38bdf8', borderRadius: 4 },
                        { label: 'Vol. Carregado (Nossas Gruas)', data: volCarregArr, backgroundColor: '#10b981', borderRadius: 4 }
                    ]
                },
                options: getBasicChartOptions('Volume (m³)', false)
            });
        }

        // Gráfico 2: Receitas (Autônomo - Últimos 7 Dias)
        const datas7DiasOrdenadas = Object.keys(agrupamento7Dias).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        const labels7Dias = [];
        const recTransp7Dias = []; 
        const recCarreg7Dias = [];

        datas7DiasOrdenadas.forEach(k => {
            const item = agrupamento7Dias[k];
            labels7Dias.push(item.label);
            recTransp7Dias.push(parseFloat(item.recTransp.toFixed(2)));
            recCarreg7Dias.push(parseFloat(item.recCarreg.toFixed(2)));
        });

        if (chartReceitasObj) chartReceitasObj.destroy();
        const ctx2 = document.getElementById('chartReceitas');
        if(ctx2) {
            const ctx2Context = ctx2.getContext('2d');
            
            // Gradientes modernos para as áreas das curvas de faturamento
            const gradTransp = ctx2Context.createLinearGradient(0, 0, 0, 320);
            gradTransp.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
            gradTransp.addColorStop(1, 'rgba(56, 189, 248, 0.00)');

            const gradCarreg = ctx2Context.createLinearGradient(0, 0, 0, 320);
            gradCarreg.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
            gradCarreg.addColorStop(1, 'rgba(16, 185, 129, 0.00)');

            chartReceitasObj = new Chart(ctx2, {
                type: 'line',
                data: {
                    labels: labels7Dias,
                    datasets: [
                        { 
                            label: 'Rec. Transporte (Serrana)', 
                            data: recTransp7Dias, 
                            borderColor: '#38bdf8', 
                            backgroundColor: gradTransp, 
                            borderWidth: 4, 
                            pointBackgroundColor: '#0f172a', 
                            pointBorderColor: '#38bdf8', 
                            pointBorderWidth: 2,
                            pointRadius: 5,
                            pointHoverRadius: 7,
                            fill: true, 
                            tension: 0.4 
                        },
                        { 
                            label: 'Rec. Carregamento (Nossas Gruas)', 
                            data: recCarreg7Dias, 
                            borderColor: '#10b981', 
                            backgroundColor: gradCarreg, 
                            borderWidth: 4, 
                            pointBackgroundColor: '#0f172a', 
                            pointBorderColor: '#10b981', 
                            pointBorderWidth: 2,
                            pointRadius: 5,
                            pointHoverRadius: 7,
                            fill: true, 
                            tension: 0.4 
                        }
                    ]
                },
                options: getBasicChartOptions('Receita (R$)', true)
            });
        }

        // Gráfico 3: Faturamento Total (Diário) baseado nos filtros aplicados
        if (chartFaturamentoTotalObj) chartFaturamentoTotalObj.destroy();
        const ctx3 = document.getElementById('chartFaturamentoTotal');
        if(ctx3) {
            const ctx3Context = ctx3.getContext('2d');
            
            const gradTotal = ctx3Context.createLinearGradient(0, 0, 0, 320);
            gradTotal.addColorStop(0, 'rgba(168, 85, 247, 0.4)'); // Purple-500
            gradTotal.addColorStop(1, 'rgba(168, 85, 247, 0.0)');

            chartFaturamentoTotalObj = new Chart(ctx3, {
                type: 'line',
                data: {
                    labels: labels, // Mesmo eixo X do gráfico de volumes (dados filtrados)
                    datasets: [
                        {
                            label: 'Faturamento Total Bruto (R$)',
                            data: faturamentoTotalArr,
                            borderColor: '#a855f7', // Purple-400/500
                            backgroundColor: gradTotal,
                            borderWidth: 4,
                            pointBackgroundColor: '#0f172a',
                            pointBorderColor: '#a855f7',
                            pointBorderWidth: 2,
                            pointRadius: 5,
                            pointHoverRadius: 7,
                            fill: true,
                            tension: 0.4
                        }
                    ]
                },
                options: getBasicChartOptions('Faturamento (R$)', true)
            });
        }

    } catch(e) { console.error("[PRODUCAO] Erro nos gráficos:", e); }
}

function getBasicChartOptions(titleY, isMoney = false) {
    return {
        responsive: true, 
        maintainAspectRatio: false,
        plugins: {
            legend: { 
                position: 'top',
                labels: { 
                    color: '#cbd5e1', 
                    font: { weight: 'bold', size: 11 },
                    padding: 15,
                    usePointStyle: true
                } 
            },
            datalabels: {
                display: true,
                align: 'top',
                anchor: 'end',
                color: '#f8fafc',
                font: { weight: 'bold', size: 9 },
                formatter: (val) => {
                    if (val === 0) return '';
                    if (isMoney) return 'R$ ' + (val/1000).toFixed(1) + 'k'; 
                    return val.toLocaleString('pt-BR') + ' m³';
                }
            }
        },
        scales: {
            x: { 
                grid: { display: false }, 
                ticks: { color: '#94a3b8', font: { weight: 'bold', size: 11 } } 
            },
            y: { 
                display: true, 
                grid: { 
                    color: 'rgba(255, 255, 255, 0.06)',
                    drawBorder: false
                }, 
                ticks: { 
                    color: '#94a3b8',
                    font: { size: 10 },
                    callback: function(value) {
                        if (isMoney) {
                            if (value >= 1000) return 'R$ ' + (value / 1000) + 'k';
                            return 'R$ ' + value;
                        }
                        return value;
                    }
                } 
            }
        }
    }
}

function renderizarTabela(dados) {
    try {
        const tbody = document.getElementById('tbodyProducaoFrota');
        if(!tbody) return;
        
        tbody.innerHTML = '';
        
        if (dados.length === 0) { 
            tbody.innerHTML = `<tr><td colspan="10" class="text-center p-8 text-slate-500">Nenhum dado encontrado para os filtros selecionados.</td></tr>`; 
            return; 
        }

        dados.forEach(l => {
            const totalGerado = l.recTransp + l.recCarreg;
            
            const isSerranaBadge = l.isSerrana 
                ? `<span class="bg-sky-500/10 text-sky-400 font-bold px-2 py-0.5 rounded text-[10px]">${l.transp}</span>` 
                : `<span class="text-slate-400 text-xs">${l.transp}</span>`;
                
            const tarifaStr = l.isSerrana && l.tarifa > 0 ? l.tarifa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-';

            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-700/30 transition-colors";
            
            tr.innerHTML = `
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
            `;
            tbody.appendChild(tr);
        });

    } catch(e) { console.error("[PRODUCAO] Erro ao renderizar tabela:", e); }
}

function exportarParaExcel() {
    if (!dadosFiltradosAtual || dadosFiltradosAtual.length === 0) { alert("Sem dados para exportar."); return; }
    
    if (typeof XLSX === 'undefined') {
        alert("A biblioteca Excel ainda não foi carregada. Aguarde.");
        return;
    }
    
    const dtInicio = document.getElementById('dataInicio') ? document.getElementById('dataInicio').value : '';
    const dtFim = document.getElementById('dataFim') ? document.getElementById('dataFim').value : '';
    const fileBase = `Placas_Operacao_Financeira_${dtInicio}_a_${dtFim}`;
    
    const wb = XLSX.utils.book_new();

    // 1. ABA DE FRENTES (RESUMO)
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

    // 2. ABA DETALHADA POR PLACA E ROTA
    const obj = {};
    let precoCarregamento = parseFloat(tarifadorAtivoGlobal?.preco_carregamento) || 0;

    dadosFiltradosAtual.forEach(r => {
        const dataViagem = r.dtFimDescarFabrica || r.dataDaBaseExcel;
        const tr = r.transportadora ? r.transportadora.toUpperCase() : 'N/A';
        const isSerrana = tr.includes('SERRANALOG') || tr.includes('SERRANA LOG');
        
        const gruaReg = r.grua ? r.grua.trim().toUpperCase() : '';
        const isNossaGrua = gruasPropriasCache.has(gruaReg);
        
        let asfalto = parseFloat(String(r.distanciaAsfalto).replace(',','.')) || 0;
        let terra = parseFloat(String(r.distanciaTerra).replace(',','.')) || 0;
        let v = parseFloat(String(r.volumeReal).replace(',','.')) || 0;
        
        let tarifaTransp = isSerrana ? calcularTarifaTransporte(asfalto, terra) : 0;
        let recTransp = isSerrana ? (v * tarifaTransp) : 0;
        let recCarreg = isNossaGrua ? (v * precoCarregamento) : 0;

        const ch = `${dataViagem}_${r.placa}_${asfalto}_${terra}`;

        if(!obj[ch]) obj[ch] = { 
            Data: dataViagem, 
            Placa: r.placa, 
            Transp: tr, 
            Asfalto: asfalto, 
            Terra: terra, 
            Tarifa: tarifaTransp,
            Viagens: 0, 
            Vol: 0, 
            RecTransp: 0, 
            RecCarreg: 0 
        };
        
        obj[ch].Viagens += 1;
        obj[ch].Vol += v;
        obj[ch].RecTransp += recTransp;
        obj[ch].RecCarreg += recCarreg;
    });
    
    const excelArr = Object.values(obj).sort((a,b) => converterDataString(a.Data).getTime() - converterDataString(b.Data).getTime()).map(i => ({
        "Data": i.Data, 
        "Placa": i.Placa, 
        "Transportadora": i.Transp, 
        "Dist. Asfalto (km)": i.Asfalto,
        "Dist. Terra (km)": i.Terra,
        "Tarifa Base (R$)": parseFloat(i.Tarifa.toFixed(4)),
        "Viagens": i.Viagens, 
        "Volume Total (m³)": parseFloat(i.Vol.toFixed(2)), 
        "Receita Transporte (R$)": parseFloat(i.RecTransp.toFixed(2)),
        "Receita Carregamento (R$)": parseFloat(i.RecCarreg.toFixed(2)),
        "Receita Total (R$)": parseFloat((i.RecTransp + i.RecCarreg).toFixed(2))
    }));

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(excelArr), "Detalhamento de Rotas");
    XLSX.writeFile(wb, `${fileBase}.xlsx`);
}

function exportarResumoDiarioExcel() {
    const chaves = Object.keys(agrupamentoDiarioGlobal).sort((a, b) => converterDataString(a).getTime() - converterDataString(b).getTime());
    if (chaves.length === 0) { alert("Sem dados para resumo."); return; }

    if (typeof XLSX === 'undefined') {
        alert("A biblioteca Excel ainda não foi carregada. Aguarde.");
        return;
    }

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
