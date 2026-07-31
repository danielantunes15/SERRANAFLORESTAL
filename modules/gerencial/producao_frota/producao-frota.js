// ==========================================
// js/producao-frota.js - PRODUÇÃO E FATURAMENTO COM METAS
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

// Armazena as propriedades detalhadas das gruas
var gruasPropriasCache = new Map(); 

// Instâncias dos Gráficos ECharts
var chartVolumesObj = null;
var chartTransporteEvoObj = null;
var chartCarregamentoEvoObj = null;
var chart7DiasObj = null; // GRÁFICO 7 DIAS FIXO (FLUIDO)

// Metas Diárias Globais
var metaTransporteDiaria = 0;
var metaCarregamentoDiaria = 0;
const TOLERANCIA_ASFALTO_KM = 2.0; 
const TOLERANCIA_TERRA_KM = 2.0; 

function getSupabaseClient() {
    if (typeof window.supabaseClient !== 'undefined') return window.supabaseClient;
    if (typeof window.db !== 'undefined' && typeof window.db.from === 'function') return window.db; 
    if (typeof window.db !== 'undefined' && window.db.supabase) return window.db.supabase;
    if (typeof supabaseClient !== 'undefined') return supabaseClient;
    console.error("[PRODUCAO] FATAL: Nenhum cliente Supabase encontrado!");
    return null;
}

window.initProducaoFrota = async function() {
    console.log("[PRODUCAO] Módulo iniciado.");
    configurarEventos();
    definirDatasPadrao();
    await carregarMetas(); 
    await buscarTarifadorAtivo();
    buscarTodosDadosSupabase();

    function configurarEventos() {
        const btnFiltros = document.getElementById('btnAplicarFiltros');
        if(btnFiltros) btnFiltros.addEventListener('click', processarFiltrosEExibir);
        
        const btnExcel = document.getElementById('btnExportarExcel');
        if(btnExcel) btnExcel.addEventListener('click', exportarParaExcel);
        
        const btnResProd = document.getElementById('btnExportarResumoProd');
        if(btnResProd) btnResProd.addEventListener('click', exportarResumoDiarioExcel);
        
        // Garante o redimensionamento perfeito caso a janela mude de tamanho
        window.addEventListener('resize', () => {
            if (chartTransporteEvoObj) chartTransporteEvoObj.resize();
            if (chartCarregamentoEvoObj) chartCarregamentoEvoObj.resize();
            if (chartVolumesObj) chartVolumesObj.resize();
            if (chart7DiasObj) chart7DiasObj.resize(); // Resize 7 dias
        });
    }

    function definirDatasPadrao() {
        const dataFim = new Date();
        // Ajuste D-1: Reduz 1 dia para não pegar o dia atual incompleto
        dataFim.setDate(dataFim.getDate() - 1);
        
        const dataInicio = new Date();
        // PADRÃO ÚLTIMOS 30 DIAS a partir do D-1
        dataInicio.setDate(dataFim.getDate() - 29);
        
        const elFim = document.getElementById('dataFim');
        if(elFim) elFim.value = dataFim.toISOString().split('T')[0];
        
        const elInicio = document.getElementById('dataInicio');
        if(elInicio) elInicio.value = dataInicio.toISOString().split('T')[0];
    }

    async function carregarMetas() {
        try {
            const client = getSupabaseClient();
            const filialAtual = (typeof currentUser !== 'undefined' && currentUser.filial_id) ? currentUser.filial_id : 'CENTRAL';
            
            if (client) {
                const { data, error } = await client
                    .from('metas_gerenciais')
                    .select('*')
                    .eq('filial_id', filialAtual)
                    .maybeSingle();
                    
                if (data) {
                    metaTransporteDiaria = parseFloat(data.meta_diaria_transporte || 0);
                    metaCarregamentoDiaria = parseFloat(data.meta_diaria_carregamento || 0);
                    return;
                }
            }
            
            const metasSalvas = JSON.parse(localStorage.getItem(`metas_gerenciais_${filialAtual}`));
            if (metasSalvas) {
                metaTransporteDiaria = parseFloat(metasSalvas.meta_diaria_transporte || 0);
                metaCarregamentoDiaria = parseFloat(metasSalvas.meta_diaria_carregamento || 0);
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
                const precoCarreg = parseFloat(tarifadorAtivoGlobal.preco_carregamento) || 0;
                
                if(displayNome) displayNome.innerText = `${tarifadorAtivoGlobal.nome} (Carregamento: R$ ${precoCarreg.toFixed(2)})`;
                if(badge) {
                    badge.classList.remove('bg-indigo-600/20', 'text-indigo-400', 'border-indigo-500/50', 'bg-rose-600/20', 'text-rose-400', 'border-rose-500/50');
                    badge.classList.add('bg-emerald-600/20', 'text-emerald-400', 'border-emerald-500/50');
                }
            } else {
                tarifadorAtivoGlobal = null;
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

    async function buscarTodosDadosSupabase() {
        const client = getSupabaseClient();
        const tStatus = document.getElementById('tabelaStatus');
        
        if (!client) {
            if(tStatus) tStatus.innerText = "Erro de conexão com o banco.";
            return;
        }
        
        try {
            if(tStatus) tStatus.innerText = "Baixando configurações...";
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
            
            if(tStatus) tStatus.innerText = "Baixando viagens...";
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
                if (d.transportadora) transpSet.add(d.transportadora.trim().toUpperCase());
            });
            
            let opsHtml = '<option value="">TODAS AS TRANSPORTADORAS E FRENTES</option>';
            opsHtml += '<option value="SOMENTE_SERRANA">✓ APENAS NOSSOS CAMINHÕES (Serrana)</option>';
            opsHtml += '<option value="SOMENTE_TERCEIROS">✓ APENAS CAMINHÕES TERCEIROS</option>';
            
            Array.from(transpSet).sort().forEach(t => { opsHtml += `<option value="${t}">${t}</option>`; });
            select.innerHTML = opsHtml;
        } catch(e) {}
    }

    const formatarDataChave = (dateObj) => {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
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
        
        document.getElementById('f5_transporte_rs').innerText = formatarDinheiro(f5.recTranspTotal);
        document.getElementById('f5_carregamento_rs').innerText = formatarDinheiro(f5.recCarregTotal);
        document.getElementById('f5_receita_total').innerText = formatarDinheiro(f5.recTranspTotal + f5.recCarregTotal);
        document.getElementById('f5_vol_transportado').innerText = formatarNumero(f5.volTransp);
        document.getElementById('f5_vol_carregado').innerText = formatarNumero(f5.volCarreg);
        document.getElementById('f5_qtd_viagens').innerText = f5.viagens;
        document.getElementById('f5_distancias').innerText = `${formatarNumero(f5.asfalto)} km / ${formatarNumero(f5.terra)} km`;
        document.getElementById('f5_tarifa_transporte').innerText = formatarNumero(f5.tarifaT);
        document.getElementById('f5_tarifa_carregamento').innerText = formatarNumero(f5.tarifaC);
        
        document.getElementById('f6_transporte_rs').innerText = formatarDinheiro(f6.recTranspTotal);
        document.getElementById('f6_carregamento_rs').innerText = formatarDinheiro(f6.recCarregTotal);
        document.getElementById('f6_receita_total').innerText = formatarDinheiro(f6.recTranspTotal + f6.recCarregTotal);
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
            
            if (!strInicio || !strFim) {
                mostrarAlerta("Selecione um período válido.", "error");
                return;
            }
            
            let dateIniObj = new Date(strInicio.split('-')[0], parseInt(strInicio.split('-')[1]) - 1, strInicio.split('-')[2]);
            let dateFimObj = new Date(strFim.split('-')[0], parseInt(strFim.split('-')[1]) - 1, strFim.split('-')[2]);
            let timeInicio = dateIniObj.getTime();
            let timeFim = new Date(dateFimObj.getFullYear(), dateFimObj.getMonth(), dateFimObj.getDate(), 23, 59, 59).getTime();
            
            const diffTime = Math.abs(timeFim - timeInicio);
            let diasNoPeriodo = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diasNoPeriodo < 1) diasNoPeriodo = 1;
            
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
                } else { return false; }
                return true;
            });
            
            const agrupamentoTabela = {};
            const agrupamentoFrente = {};
            const agrupamentoDiario = {};
            let dadosEnriquecidos = [];
            
            let tTranspViagens = 0, tTranspVol = 0, tTranspRec = 0;
            let tCarregViagens = 0, tCarregVol = 0, tCarregRec = 0;
            let precoCarregamento = parseFloat(tarifadorAtivoGlobal?.preco_carregamento) || 0;
            let f5 = { volTransp: 0, volCarreg: 0, viagens: 0, asfalto: 0, terra: 0, tarifaT: 0, tarifaC: 0, totalAsfalto: 0, totalTerra: 0, totalTarifaT: 0, recTranspTotal: 0, recCarregTotal: 0 };
            let f6 = { volTransp: 0, volCarreg: 0, viagens: 0, asfalto: 0, terra: 0, tarifaT: 0, tarifaC: 0, totalAsfalto: 0, totalTerra: 0, totalTarifaT: 0, recTranspTotal: 0, recCarregTotal: 0 };
            
            dadosFiltradosAtual.forEach(registro => {
                const d = registro.dtFimDescarFabrica || registro.dataDaBaseExcel;
                const dateVal = converterDataString(d);
                const keyData = formatarDataChave(dateVal);
                
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
                
                if (isSerrana) { tTranspViagens++; tTranspVol += v; tTranspRec += recTransporte; }
                if (isNossaGrua) { tCarregViagens++; tCarregVol += v; tCarregRec += recCarregamento; }
                
                let nomeFrente = infoGrua ? infoGrua.frente.toUpperCase() : (registro.frente ? String(registro.frente).toUpperCase() : '');
                
                if (nomeFrente.includes('5')) {
                    if (isSerrana) { f5.volTransp += v; f5.viagens++; f5.totalAsfalto += asfalto; f5.totalTerra += terra; f5.totalTarifaT += tarifaTransporte; f5.recTranspTotal += recTransporte; }
                    if (isNossaGrua) { f5.volCarreg += v; f5.recCarregTotal += recCarregamento; f5.tarifaC = precoCarregamento; }
                } else if (nomeFrente.includes('6')) {
                    if (isSerrana) { f6.volTransp += v; f6.viagens++; f6.totalAsfalto += asfalto; f6.totalTerra += terra; f6.totalTarifaT += tarifaTransporte; f5.recTranspTotal += recTransporte; }
                    if (isNossaGrua) { f6.volCarreg += v; f6.recCarregTotal += recCarregamento; f6.tarifaC = precoCarregamento; }
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
                    agrupamentoFrente[chaveFrente] = { categoria: nomeCategoria, asfalto: asfalto, terra: terra, tarifa: tarifaTransporte, viagens: 0, volume: 0, receita: 0 };
                }
                agrupamentoFrente[chaveFrente].viagens++;
                agrupamentoFrente[chaveFrente].volume += v;
                agrupamentoFrente[chaveFrente].receita += totalReceitaItem;
                
                const chaveTabela = `${pl}_${asfalto}_${terra}`;
                if (!agrupamentoTabela[chaveTabela]) {
                    agrupamentoTabela[chaveTabela] = { placa: pl, transp: tr, isSerrana: isSerrana, isNossaGrua: isNossaGrua, asfalto: asfalto, terra: terra, tarifa: tarifaTransporte, viagens: 0, volume: 0, recTransp: 0, recCarreg: 0 };
                }
                agrupamentoTabela[chaveTabela].viagens++;
                agrupamentoTabela[chaveTabela].volume += v;
                agrupamentoTabela[chaveTabela].recTransp += recTransporte;
                agrupamentoTabela[chaveTabela].recCarreg += recCarregamento;
                
                if (!agrupamentoDiario[keyData]) agrupamentoDiario[keyData] = { volTransp: 0, recTransp: 0, volCarreg: 0, recCarreg: 0 };
                if (isSerrana) { agrupamentoDiario[keyData].volTransp += v; agrupamentoDiario[keyData].recTransp += recTransporte; }
                if (isNossaGrua) { agrupamentoDiario[keyData].volCarreg += v; agrupamentoDiario[keyData].recCarreg += recCarregamento; }
                
                dadosEnriquecidos.push({
                    data: d, up: nomeFrente, placa: pl, distAsfalto: asfalto, distTerra: terra, distTotal: asfalto + terra, tarifaTransporte: tarifaTransporte,
                    recTransp: recTransporte, recCarreg: recCarregamento, recTotal: totalReceitaItem, volume: v, viagens: 1, isSerrana: isSerrana, isNossaGrua: isNossaGrua
                });
            });
            
            if (f5.viagens > 0) { f5.asfalto = f5.totalAsfalto / f5.viagens; f5.terra = f5.totalTerra / f5.viagens; f5.tarifaT = f5.totalTarifaT / f5.viagens; }
            if (f6.viagens > 0) { f6.asfalto = f6.totalAsfalto / f6.viagens; f6.terra = f6.totalTerra / f6.viagens; f6.tarifaT = f6.totalTarifaT / f6.viagens; }
            
            dadosAgrupadosAtual = Object.values(agrupamentoTabela).sort((a, b) => {
                if (a.placa === b.placa) return b.viagens - a.viagens; 
                return a.placa.localeCompare(b.placa); 
            });
            dadosFrentesAtual = Object.values(agrupamentoFrente).sort((a, b) => b.volume - a.volume);
            agrupamentoDiarioGlobal = agrupamentoDiario;
            
            // === CÁLCULOS DOS KPIS DE METAS ===
            const formatMoney = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            
            let hojeTransporte = 0;
            let hojeCarregamento = 0;
            const hojeKey = formatarDataChave(new Date());
            
            if (agrupamentoDiario[hojeKey]) {
                hojeTransporte = agrupamentoDiario[hojeKey].recTransp;
                hojeCarregamento = agrupamentoDiario[hojeKey].recCarreg;
            } else if (Object.keys(agrupamentoDiario).length > 0) {
                const sortedKeys = Object.keys(agrupamentoDiario).sort();
                const lastKey = sortedKeys[sortedKeys.length - 1];
                hojeTransporte = agrupamentoDiario[lastKey].recTransp;
                hojeCarregamento = agrupamentoDiario[lastKey].recCarreg;
            }
            
            const metaPeriodoTransporte = metaTransporteDiaria * diasNoPeriodo;
            const metaPeriodoCarregamento = metaCarregamentoDiaria * diasNoPeriodo;
            const percTransPeriodo = metaPeriodoTransporte > 0 ? ((tTranspRec / metaPeriodoTransporte) * 100) : 0;
            const percCarrPeriodo = metaPeriodoCarregamento > 0 ? ((tCarregRec / metaPeriodoCarregamento) * 100) : 0;
            const percTransHoje = metaTransporteDiaria > 0 ? ((hojeTransporte / metaTransporteDiaria) * 100) : 0;
            const percCarrHoje = metaCarregamentoDiaria > 0 ? ((hojeCarregamento / metaCarregamentoDiaria) * 100) : 0;
            
            // Atualiza Dom KPIs
            document.getElementById('valTranspReceita').innerText = formatMoney(tTranspRec);
            document.getElementById('valCarregReceita').innerText = formatMoney(tCarregRec);
            document.getElementById('kpi-transporte-hoje').innerText = formatMoney(hojeTransporte);
            document.getElementById('kpi-carregamento-hoje').innerText = formatMoney(hojeCarregamento);
            document.getElementById('desc-transporte-periodo').innerText = `Meta Período (${diasNoPeriodo}d): ${formatMoney(metaPeriodoTransporte)}`;
            document.getElementById('desc-carregamento-periodo').innerText = `Meta Período (${diasNoPeriodo}d): ${formatMoney(metaPeriodoCarregamento)}`;
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
            
            // Prepara dados e datas rigorosamente sequenciais para os Gráficos
            const dadosEvolucao = [];
            let dataCorrente = new Date(dateIniObj.getTime());
            const dataLimite = new Date(timeFim);
            
            while(dataCorrente <= dataLimite) {
                const k = formatarDataChave(dataCorrente);
                const label = dataCorrente.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                
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
            desenharGrafico7DiasFixo(); // <-- CHAMADA DO NOVO GRÁFICO 7 DIAS FLUIDO
            
            atualizarPaineisReceita(f5, f6); 
            renderizarTabela(dadosAgrupadosAtual);
            atualizarPainelDinamico(dadosEnriquecidos);
            
            if(tStatus) tStatus.innerText = `${dadosAgrupadosAtual.length} rotas analisadas`;
            
        } catch (errInterface) {
            console.error("[PRODUCAO] Erro Crítico na montagem da tela:", errInterface);
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
                let grupoExistente = gruposTarifarios.find(g => Math.abs(g.asfaltoBase - registro.distAsfalto) <= TOLERANCIA_ASFALTO_KM && Math.abs(g.terraBase - registro.distTerra) <= TOLERANCIA_TERRA_KM);
                if (grupoExistente) {
                    grupoExistente.registros.push(registro);
                    grupoExistente.totalTransp += registro.recTransp;
                    grupoExistente.totalCarreg += registro.recCarreg;
                    grupoExistente.totalReceita += registro.recTotal;
                    if (registro.isSerrana) grupoExistente.totalVolTransp += registro.volume;
                    if (registro.isNossaGrua) grupoExistente.totalVolCarreg += registro.volume;
                    grupoExistente.viagens += 1;
                    if (!grupoExistente.ups.includes(registro.up)) grupoExistente.ups.push(registro.up);
                } else {
                    gruposTarifarios.push({
                        idGrupo: Math.random().toString(36).substr(2, 9),
                        distanciaBase: registro.distTotal,
                        asfaltoBase: registro.distAsfalto,
                        terraBase: registro.distTerra,
                        tarifaBase: registro.tarifaTransporte,
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
            gruposTarifarios.sort((a,b) => a.distanciaBase - b.distanciaBase);
            resultadoDinamico.push({ data: data, grupos: gruposTarifarios });
        }
        
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
                            <div class="flex justify-between"><span class="text-slate-400">Tarifa Ref. (R$):</span> <span class="font-mono text-white">${formatMoney(grupo.tarifaBase)}</span></div>
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
            
            html += `</div></div>`;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }

    // ==========================================
    // FUNÇÃO QUE DESENHA OS GRÁFICOS (ECHARTS EM DIVS)
    // ==========================================
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
            
            // 1. Gráfico Transporte vs Meta
            const domTransporte = document.getElementById('chartTransporteEvolucao');
            if (domTransporte) {
                if (chartTransporteEvoObj) chartTransporteEvoObj.dispose();
                chartTransporteEvoObj = echarts.init(domTransporte);
                chartTransporteEvoObj.setOption({
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
                                    html += `<div style="margin-left: 14px; font-size: 11.5px; color: ${corPerc}; margin-bottom: 3px; margin-top: 1px;">✓ Atingido no Dia: <b>${perc}%</b></div>`;
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
                });
            }
            
            // 2. Gráfico Carregamento vs Meta
            const domCarregamento = document.getElementById('chartCarregamentoEvolucao');
            if (domCarregamento) {
                if (chartCarregamentoEvoObj) chartCarregamentoEvoObj.dispose();
                chartCarregamentoEvoObj = echarts.init(domCarregamento);
                chartCarregamentoEvoObj.setOption({
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
                                    html += `<div style="margin-left: 14px; font-size: 11.5px; color: ${corPerc}; margin-bottom: 3px; margin-top: 1px;">✓ Atingido no Dia: <b>${perc}%</b></div>`;
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
                });
            }
            
            // 3. Gráfico Comparativo Volumes
            const domVolumes = document.getElementById('chartVolumes');
            if (domVolumes) {
                if (chartVolumesObj) chartVolumesObj.dispose();
                chartVolumesObj = echarts.init(domVolumes);
                chartVolumesObj.setOption({
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
                });
            }
            
            setTimeout(() => {
                if (chartTransporteEvoObj) chartTransporteEvoObj.resize();
                if (chartCarregamentoEvoObj) chartCarregamentoEvoObj.resize();
                if (chartVolumesObj) chartVolumesObj.resize();
                if (chart7DiasObj) chart7DiasObj.resize();
            }, 150);
            
        } catch (errEcharts) {
            console.error("Erro ao desenhar gráficos ECharts:", errEcharts);
        }
    }

    // ==========================================
    // FUNÇÃO QUE DESENHA O NOVO GRÁFICO 7 DIAS FIXOS (MODERNO E FLUIDO)
    // ==========================================
    function desenharGrafico7DiasFixo() {
        try {
            const hoje = new Date();
            const dias7 = [];
            
            // Pega os últimos 7 dias encerrando no D-1 (ontem) para não mostrar o dia atual incompleto
            for (let i = 7; i >= 1; i--) {
                const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - i);
                dias7.push(formatarDataChave(d));
            }

            const elFiltroTransp = document.getElementById('filtroTransportadora');
            const filtroTransp = elFiltroTransp ? elFiltroTransp.value : '';
            let precoCarregamento = parseFloat(tarifadorAtivoGlobal?.preco_carregamento) || 0;

            let agg7 = {};
            dias7.forEach(k => agg7[k] = { recTransp: 0, recCarreg: 0 });

            // Calcula agregando da base histórica inteira
            dadosHistoricoGlobal.forEach(registro => {
                const dataViagem = registro.dtFimDescarFabrica || registro.dataDaBaseExcel;
                if (!dataViagem) return;
                
                const dateVal = converterDataString(dataViagem);
                const keyData = formatarDataChave(dateVal);

                if (agg7[keyData]) {
                    const tr = registro.transportadora ? registro.transportadora.trim().toUpperCase() : 'N/A';
                    const isSerrana = tr.includes('SERRANALOG') || tr.includes('SERRANA LOG');
                    const gruaReg = registro.grua ? registro.grua.trim().toUpperCase() : '';
                    const isNossaGrua = gruasPropriasCache.has(gruaReg);

                    if (!isSerrana && !isNossaGrua) return;
                    if (filtroTransp === 'SOMENTE_SERRANA' && !isSerrana) return;
                    if (filtroTransp === 'SOMENTE_TERCEIROS' && isSerrana) return;
                    if (filtroTransp !== '' && filtroTransp !== 'SOMENTE_SERRANA' && filtroTransp !== 'SOMENTE_TERCEIROS' && tr !== filtroTransp) return;

                    const v = parseFloat(String(registro.volumeReal).replace(',', '.')) || 0;
                    const asfalto = parseFloat(String(registro.distanciaAsfalto).replace(',', '.')) || 0;
                    const terra = parseFloat(String(registro.distanciaTerra).replace(',', '.')) || 0;

                    let tarifaTransporte = isSerrana ? calcularTarifaTransporte(asfalto, terra) : 0;
                    let recTransporte = isSerrana ? (v * tarifaTransporte) : 0;
                    let recCarregamento = isNossaGrua ? (v * precoCarregamento) : 0;

                    agg7[keyData].recTransp += recTransporte;
                    agg7[keyData].recCarreg += recCarregamento;
                }
            });

            // Preparação dos dados pro ECharts
            const labels = dias7.map(k => {
                const p = k.split('-');
                return `${p[2]}/${p[1]}`;
            });
            
            const metaTotalVal = metaTransporteDiaria + metaCarregamentoDiaria;
            
            // Soma Transporte + Carregamento do Dia
            const dataTotalDiario = dias7.map(k => agg7[k].recTransp + agg7[k].recCarreg);
            
            // Linha da Meta Fixa
            const dataMetaCombinada = dias7.map(() => metaTotalVal);

            const dom7Dias = document.getElementById('chart7DiasFixo');
            if (dom7Dias) {
                if (chart7DiasObj) chart7DiasObj.dispose();
                chart7DiasObj = echarts.init(dom7Dias);
                chart7DiasObj.setOption({
                    backgroundColor: 'transparent',
                    tooltip: {
                        trigger: 'axis',
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        borderColor: 'rgba(51, 65, 85, 0.8)',
                        textStyle: { color: '#f8fafc' },
                        padding: 12,
                        formatter: function(params) {
                            let html = `<div style="font-weight:900; color:#94a3b8; font-size: 11px; text-transform:uppercase; letter-spacing:1px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px; margin-bottom: 12px;">📅 Data: ${params[0].axisValue}</div>`;
                            let totalVal = 0;
                            
                            params.forEach(p => {
                                if(p.seriesName === 'Faturamento Total (Transp + Carreg)') {
                                    totalVal = p.value;
                                }
                            });
                            
                            let valFormatado = totalVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                            let metaFormatada = metaTotalVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                            
                            // Linha Valor Alcançado
                            html += `<div style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; gap: 20px; font-size: 13px;">
                                        <span style="color: #cbd5e1;"><span style="display:inline-block;margin-right:6px;border-radius:50%;width:8px;height:8px;background-color:#38bdf8;box-shadow:0 0 5px #38bdf8;"></span>Faturamento Total:</span>
                                        <b style="color: #fff; font-size: 14px;">${valFormatado}</b>
                                     </div>`;
                                     
                            // Linha Meta Combinada
                            html += `<div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; gap: 20px; font-size: 13px;">
                                        <span style="color: #94a3b8;"><span style="display:inline-block;margin-right:6px;width:10px;height:3px;background-color:#fbbf24;"></span>Meta Combinada:</span>
                                        <b style="color: #94a3b8;">${metaFormatada}</b>
                                     </div>`;
                            
                            // Cálculos de Status
                            let perc = metaTotalVal > 0 ? ((totalVal / metaTotalVal) * 100).toFixed(1) : 0;
                            let corPerc = totalVal >= metaTotalVal ? '#10b981' : '#ef4444'; // Verde ou Vermelho
                            let icone = totalVal >= metaTotalVal ? '▲ Acima da Meta' : '▼ Abaixo da Meta';
                            let bgAlert = totalVal >= metaTotalVal ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
                            
                            // Box Destacado Final (Percentual e Status)
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
                });
            }
        } catch (e) {
            console.error("Erro ao desenhar grafico 7 dias fixo", e);
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
                const isSerranaBadge = l.isSerrana ? `<span class="bg-sky-500/10 text-sky-400 font-bold px-2 py-0.5 rounded text-[10px]">${l.transp}</span>` : `<span class="text-slate-400 text-xs">${l.transp}</span>`;
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
        if (typeof XLSX === 'undefined') { alert("A biblioteca Excel ainda não foi carregada. Aguarde."); return; }
        
        const dtInicio = document.getElementById('dataInicio') ? document.getElementById('dataInicio').value : '';
        const dtFim = document.getElementById('dataFim') ? document.getElementById('dataFim').value : '';
        const fileBase = `Placas_Operacao_Financeira_${dtInicio}_a_${dtFim}`;
        
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
            if(!obj[ch]) obj[ch] = { Data: dataViagem, Placa: r.placa, Transp: tr, Asfalto: asfalto, Terra: terra, Tarifa: tarifaTransp, Viagens: 0, Vol: 0, RecTransp: 0, RecCarreg: 0 };
            
            obj[ch].Viagens += 1;
            obj[ch].Vol += v;
            obj[ch].RecTransp += recTransp;
            obj[ch].RecCarreg += recCarreg;
        });
        
        const excelArr = Object.values(obj).sort((a,b) => converterDataString(a.Data).getTime() - converterDataString(b.Data).getTime()).map(i => ({
            "Data": i.Data, "Placa": i.Placa, "Transportadora": i.Transp, "Dist. Asfalto (km)": i.Asfalto, "Dist. Terra (km)": i.Terra, "Tarifa Base (R$)": parseFloat(i.Tarifa.toFixed(4)),
            "Viagens": i.Viagens, "Volume Total (m³)": parseFloat(i.Vol.toFixed(2)), "Receita Transporte (R$)": parseFloat(i.RecTransp.toFixed(2)), "Receita Carregamento (R$)": parseFloat(i.RecCarreg.toFixed(2)),
            "Receita Total (R$)": parseFloat((i.RecTransp + i.RecCarreg).toFixed(2))
        }));
        
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(excelArr), "Detalhamento de Rotas");
        XLSX.writeFile(wb, `${fileBase}.xlsx`);
    }

    function exportarResumoDiarioExcel() {
        const chaves = Object.keys(agrupamentoDiarioGlobal).sort((a, b) => converterDataString(a).getTime() - converterDataString(b).getTime());
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