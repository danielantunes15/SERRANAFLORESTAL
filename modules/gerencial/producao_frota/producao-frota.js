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
var dadosFiltradosAtual = [];
var agrupamentoDiarioGlobal = {}; 
var tarifadorAtivoGlobal = null;
var gruasPropriasCache = new Set(); // Guarda as gruas que são da Serrana (tipo_frente = 'Propria')

var chartVolumesObj = null;
var chartReceitasObj = null;

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
        // 1. PRIMEIRO: BUSCAR AS GRUAS QUE SÃO "PROPRIAS"
        if(tStatus) tStatus.innerText = "Baixando configurações de Gruas...";
        const { data: gruasData } = await client.from('config_gruas').select('codigos, tipo_frente');
        
        gruasPropriasCache = new Set();
        if (gruasData) {
            gruasData.forEach(g => {
                if (g.tipo_frente && g.tipo_frente.trim().toUpperCase() === 'PROPRIA' && g.codigos) {
                    // Trata caso existam várias gruas separadas por vírgula no cadastro
                    g.codigos.split(',').forEach(c => {
                        gruasPropriasCache.add(c.trim().toUpperCase());
                    });
                }
            });
        }

        // 2. SEGUNDO: BUSCAR HISTÓRICO DE VIAGENS
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
        
        let opsHtml = '<option value="">TODAS AS TRANSPORTADORAS (Geral)</option>';
        opsHtml += '<option value="SOMENTE_SERRANA">📦 APENAS PRÓPRIAS (Serrana)</option>';
        opsHtml += '<option value="SOMENTE_TERCEIROS">🤝 APENAS TERCEIROS</option>';
        
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

// CÁLCULO DE TARIFA ESTRITAMENTE PARA TRANSPORTE
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

            // REGRA 1: Se não é a nossa transportadora E TAMBÉM não é a nossa Grua, esconde da tela
            if (!isSerrana && !isNossaGrua) return false;

            // Filtros do Dropdown
            if (filtroTransp === 'SOMENTE_SERRANA' && !isSerrana) return false;
            if (filtroTransp === 'SOMENTE_TERCEIROS' && isSerrana) return false;
            if (filtroTransp !== '' && filtroTransp !== 'SOMENTE_SERRANA' && filtroTransp !== 'SOMENTE_TERCEIROS' && tr !== filtroTransp) return false;

            // Filtros de Data - PUXANDO PELA dtFimDescarFabrica prioritariamente
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
        const agrupamentoDiario = {};
        
        let tTranspViagens = 0, tTranspVol = 0, tTranspRec = 0;
        let tCarregViagens = 0, tCarregVol = 0, tCarregRec = 0;

        let precoCarregamento = parseFloat(tarifadorAtivoGlobal?.preco_carregamento) || 0;

        dadosFiltradosAtual.forEach(registro => {
            // Data Oficial da Viagem baseada no Descarregamento
            const d = registro.dtFimDescarFabrica || registro.dataDaBaseExcel;
            
            const pl = registro.placa ? registro.placa.trim().toUpperCase() : 'N/A';
            const tr = registro.transportadora ? registro.transportadora.toUpperCase() : 'N/A';
            const isSerrana = tr.includes('SERRANALOG') || tr.includes('SERRANA LOG');
            
            const gruaReg = registro.grua ? registro.grua.trim().toUpperCase() : '';
            const isNossaGrua = gruasPropriasCache.has(gruaReg);
            
            const v = parseFloat(String(registro.volumeReal).replace(',','.')) || 0;
            const asfalto = parseFloat(String(registro.distanciaAsfalto).replace(',','.')) || 0;
            const terra = parseFloat(String(registro.distanciaTerra).replace(',','.')) || 0;
            
            // Lógica de cálculo financeiro
            let tarifaTransporte = isSerrana ? calcularTarifaTransporte(asfalto, terra) : 0;
            let recTransporte = isSerrana ? (v * tarifaTransporte) : 0;
            
            // REGRA 2: Carregamento só gera receita se a grua for nossa (Propria)
            let recCarregamento = isNossaGrua ? (v * precoCarregamento) : 0;

            // Acumuladores Globais
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

            // Acumulador Tabela 
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

            // Acumulador Diário para os Gráficos
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
        });

        dadosAgrupadosAtual = Object.values(agrupamentoTabela).sort((a, b) => {
            if (a.placa === b.placa) return b.viagens - a.viagens; 
            return a.placa.localeCompare(b.placa); 
        });
        agrupamentoDiarioGlobal = agrupamentoDiario;

        // Atualização dos Cards Superiores
        document.getElementById('valTranspViagens').innerText = tTranspViagens.toLocaleString('pt-BR');
        document.getElementById('valTranspVolume').innerText = tTranspVol.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' m³';
        document.getElementById('valTranspReceita').innerText = tTranspRec.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        document.getElementById('valCarregViagens').innerText = tCarregViagens.toLocaleString('pt-BR');
        document.getElementById('valCarregVolume').innerText = tCarregVol.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' m³';
        document.getElementById('valCarregReceita').innerText = tCarregRec.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const totalConsolidado = tTranspRec + tCarregRec;
        document.getElementById('valTotalReceita').innerText = totalConsolidado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        desenharGraficos(agrupamentoDiarioGlobal);
        renderizarTabela(dadosAgrupadosAtual);

        if(tStatus) tStatus.innerText = `${dadosAgrupadosAtual.length} rotas analisadas`;
        
    } catch (errInterface) {
        console.error("[PRODUCAO] Erro Crítico na montagem da tela:", errInterface);
    }
}

function desenharGraficos(agrupamento) {
    try {
        const datasOrdenadas = Object.keys(agrupamento).sort((a, b) => converterDataString(a).getTime() - converterDataString(b).getTime());

        const labels = [];
        const volTranspArr = []; const volCarregArr = [];
        const recTranspArr = []; const recCarregArr = [];

        datasOrdenadas.forEach(d => {
            labels.push(d.substring(0, 5)); 
            volTranspArr.push(parseFloat(agrupamento[d].volTransp.toFixed(2)));
            volCarregArr.push(parseFloat(agrupamento[d].volCarreg.toFixed(2)));
            recTranspArr.push(parseFloat(agrupamento[d].recTransp.toFixed(2)));
            recCarregArr.push(parseFloat(agrupamento[d].recCarreg.toFixed(2)));
        });

        // Gráfico 1: Volumes
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

        // Gráfico 2: Receitas Financeiras
        if (chartReceitasObj) chartReceitasObj.destroy();
        const ctx2 = document.getElementById('chartReceitas');
        if(ctx2) {
            chartReceitasObj = new Chart(ctx2, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Rec. Transporte (Serrana)', data: recTranspArr, borderColor: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.1)', borderWidth: 3, pointBackgroundColor: '#0f172a', pointBorderColor: '#38bdf8', fill: true, tension: 0.3 },
                        { label: 'Rec. Carregamento (Nossas Gruas)', data: recCarregArr, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 3, pointBackgroundColor: '#0f172a', pointBorderColor: '#10b981', fill: true, tension: 0.3 }
                    ]
                },
                options: getBasicChartOptions('Receita (R$)', true)
            });
        }
    } catch(e) { console.error("[PRODUCAO] Erro nos gráficos:", e); }
}

function getBasicChartOptions(titleY, isMoney = false) {
    return {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: '#e2e8f0', font: { weight: 'bold' } } },
            datalabels: {
                display: true,
                align: 'top',
                anchor: 'end',
                color: '#fff',
                font: { weight: 'bold', size: 9 },
                formatter: (val) => {
                    if (val === 0) return '';
                    if (isMoney) return (val/1000).toFixed(1) + 'k'; 
                    return val;
                }
            }
        },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { weight: 'bold' } } },
            y: { display: true, title: { display: true, text: titleY, color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
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
                <td class="px-6 py-3 text-center text-slate-300 font-mono">${l.asfalto} km</td>
                <td class="px-6 py-3 text-center text-slate-300 font-mono">${l.terra} km</td>
                <td class="px-6 py-3 text-center text-sky-400 font-mono font-bold">${tarifaStr}</td>
                <td class="px-6 py-3 text-center text-slate-300 font-black">${l.viagens}</td>
                <td class="px-6 py-3 text-right text-slate-300 font-mono font-bold">${l.volume.toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
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
    
    const obj = {};
    let precoCarregamento = parseFloat(tarifadorAtivoGlobal?.preco_carregamento) || 0;

    dadosFiltradosAtual.forEach(r => {
        const dataViagem = r.dtFimDescarFabrica || r.dataDaBaseExcel; // Puxando prioritariamente dtFimDescarFabrica
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

    const wb = XLSX.utils.book_new();
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