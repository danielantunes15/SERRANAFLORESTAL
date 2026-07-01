// ==================== modules/gerencial/evolucao_fazendas/evolucao_fazendas.js ====================
if(typeof Chart !== 'undefined') {
    Chart.register(ChartDataLabels);
}

var dadosViagensEvolucao = [];
var dadosFiltradosEvolucao = [];
var dicionarioUpFazenda = {}; 

var chartEvolucaoDiariaObj = null;
var chartEvolucaoTopFazendasObj = null;

// ==================== PARSERS E CLASSIFICADORES ====================
function getSupabaseClientEvolucao() {
    return window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
}

function getCampo(obj, possiveisNomes) {
    if (!obj) return '';
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
    if (typeof val === 'number') return val;
    let strLimpa = String(val).replace('R$', '').trim().replace(',', '.');
    let num = parseFloat(strLimpa);
    return isNaN(num) ? 0 : num;
}

// NOVA FUNÇÃO: Agrupa Transportadoras (Serrana vs Resto)
function classificarTransportadora(nomeOriginal) {
    const nome = String(nomeOriginal || '').trim().toUpperCase();
    if (nome.includes('SERRANALOG') || nome.includes('SERRANA LOG')) {
        return 'SERRANALOG TRANSPORTES LTDA';
    }
    return 'OUTRAS TRANSPORTADORAS';
}
// ========================================================

window.initEvolucaoFazendas = async function() {
    console.log("[EVOLUCAO_FAZENDAS] Módulo ativado.");
    configurarEventosEvolucao();
    definirDatasPadraoEvolucao();
    
    await mapearFazendasUPs();
    buscarDadosEvolucao();
};

async function mapearFazendasUPs() {
    const client = getSupabaseClientEvolucao();
    const statusEl = document.getElementById('statusEvolucao');
    if(!client) return;

    if(statusEl) statusEl.innerText = "Sincronizando UPs e Fazendas...";
    dicionarioUpFazenda = {}; 

    try {
        const { data: tbFazendas } = await client.from('monitoramento_fazendas').select('id, nome');
        const mapFaz = {};
        if (tbFazendas) {
            tbFazendas.forEach(f => mapFaz[f.id] = f.nome);
        }

        const { data: tbUps } = await client.from('monitoramento_ups').select('codigo, fazenda_id');
        if (tbUps) {
            tbUps.forEach(u => {
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

function configurarEventosEvolucao() {
    const btnFiltrar = document.getElementById('btnFiltrarEvolucao');
    if(btnFiltrar) btnFiltrar.addEventListener('click', processarFiltrosEExibirEvolucao);

    const btnExcel = document.getElementById('btnExportarEvolucao');
    if(btnExcel) btnExcel.addEventListener('click', exportarExcelEvolucao);

    const btnPNG = document.getElementById('btnExportarPNG');
    if(btnPNG) btnPNG.addEventListener('click', exportarTelaParaPNG);

    const filtroTransp = document.getElementById('filtroTransportadoraEvol');
    if(filtroTransp) {
        filtroTransp.addEventListener('change', () => {
            atualizarDropdownFazenda();
            processarFiltrosEExibirEvolucao();
        });
    }

    const filtroFazenda = document.getElementById('filtroFazenda');
    if(filtroFazenda) {
        filtroFazenda.addEventListener('change', processarFiltrosEExibirEvolucao);
    }
}

async function exportarTelaParaPNG() {
    if (typeof html2canvas === 'undefined') {
        alert('A biblioteca html2canvas não foi carregada no index.html.');
        return;
    }

    const btn = document.getElementById('btnExportarPNG');
    const originalText = btn.innerHTML;
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando Alta Qualidade...';
    btn.disabled = true;

    try {
        const areaPrint = document.getElementById('conteudoEvolucaoFazendas');
        await new Promise(resolve => setTimeout(resolve, 500));

        const canvas = await html2canvas(areaPrint, {
            scale: 2, 
            useCORS: true, 
            backgroundColor: '#0f172a'
        });

        const imagemDataUrl = canvas.toDataURL('image/png');
        
        const link = document.createElement('a');
        link.download = `Dashboard_Fazendas_${new Date().toISOString().slice(0,10)}.png`;
        link.href = imagemDataUrl;
        link.click();

    } catch (error) {
        console.error('Erro ao gerar PNG:', error);
        alert('Ocorreu um erro ao tentar gerar a imagem.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function definirDatasPadraoEvolucao() {
    const dataFim = new Date();
    const dataInicio = new Date();
    dataInicio.setMonth(dataFim.getMonth() - 4); 
    
    const elFim = document.getElementById('dataFimEvol');
    if(elFim) elFim.value = dataFim.toISOString().split('T')[0];

    const elInicio = document.getElementById('dataInicioEvol');
    if(elInicio) elInicio.value = dataInicio.toISOString().split('T')[0];
}

async function buscarDadosEvolucao() {
    const client = getSupabaseClientEvolucao();
    const statusEl = document.getElementById('statusEvolucao');
    
    if (!client) {
        if(statusEl) statusEl.innerText = "Erro na conexão com banco.";
        return;
    }

    try {
        dadosViagensEvolucao = [];
        let from = 0;
        const step = 1000;
        let fetchMore = true;
        
        while (fetchMore) {
            let query = client.from('historico_viagens').select('*').range(from, from + step - 1);
            if (typeof window.aplicarFiltroLocal === 'function') {
                query = window.aplicarFiltroLocal(query);
            }

            const { data, error } = await query;
            if (error) { console.error(error); break; }
            
            if (data && data.length > 0) { 
                dadosViagensEvolucao = dadosViagensEvolucao.concat(data); 
                from += step; 
                if(statusEl) statusEl.innerText = `Lendo viagens (${dadosViagensEvolucao.length})...`;
            }
            if (!data || data.length < step) fetchMore = false;
        }

        popularDropdownsIniciais();
        processarFiltrosEExibirEvolucao();
        
    } catch (e) {
        console.error(e);
        if(statusEl) statusEl.innerText = "Erro ao processar dados.";
    }
}

function popularDropdownsIniciais() {
    const selectTransp = document.getElementById('filtroTransportadoraEvol');
    if(!selectTransp) return;

    // Filtro Injetado com as duas opções de Visão Gerencial Fixas
    let html = '<option value="">Todas as Transportadoras</option>';
    html += '<option value="SERRANALOG TRANSPORTES LTDA">SERRANALOG TRANSPORTES LTDA</option>';
    html += '<option value="OUTRAS TRANSPORTADORAS">OUTRAS TRANSPORTADORAS</option>';
    
    selectTransp.innerHTML = html;

    atualizarDropdownFazenda();
}

function atualizarDropdownFazenda() {
    const selectTransp = document.getElementById('filtroTransportadoraEvol');
    const selectFazenda = document.getElementById('filtroFazenda');
    if(!selectTransp || !selectFazenda) return;

    const transpSelecionada = selectTransp.value;
    const fazendas = new Set();

    dadosViagensEvolucao.forEach(v => {
        // Usa o classificador para saber de qual "balde" é a viagem
        const tClassificada = classificarTransportadora(getCampo(v, ['transportadora']));
        
        if(transpSelecionada === '' || tClassificada === transpSelecionada) {
            const codUp = String(getCampo(v, ['up'])).trim().toUpperCase();
            let nomeDaFazenda = dicionarioUpFazenda[codUp] || "NÃO VINCULADA";
            fazendas.add(nomeDaFazenda.toUpperCase());
        }
    });

    let htmlFaz = '<option value="">Todas as Fazendas</option>';
    Array.from(fazendas).sort().forEach(faz => { htmlFaz += `<option value="${faz}">${faz}</option>`; });
    selectFazenda.innerHTML = htmlFaz;
}

function converterDataExcel(dataStr) { 
    if (!dataStr) return new Date(0);
    const str = String(dataStr).trim();
    if(str.includes('T')) return new Date(str);
    if(str.includes('/')) {
        const p = str.split('/');
        if (p.length === 3) return new Date(p[2], parseInt(p[1]) - 1, p[0]);
    }
    if(str.includes('-')) {
        const p = str.split('-');
        if(p.length >= 3) return new Date(p[0], parseInt(p[1]) - 1, p[2].substring(0,2));
    }
    return new Date(str); 
}

function processarFiltrosEExibirEvolucao() {
    const statusEl = document.getElementById('statusEvolucao');
    
    const transpFiltro = document.getElementById('filtroTransportadoraEvol') ? document.getElementById('filtroTransportadoraEvol').value : '';
    const fazendaFiltro = document.getElementById('filtroFazenda') ? document.getElementById('filtroFazenda').value : '';
    
    const strInicio = document.getElementById('dataInicioEvol') ? document.getElementById('dataInicioEvol').value : ''; 
    const strFim = document.getElementById('dataFimEvol') ? document.getElementById('dataFimEvol').value : ''; 

    let timeInicio = strInicio ? new Date(strInicio.split('-')[0], parseInt(strInicio.split('-')[1]) - 1, strInicio.split('-')[2]).getTime() : 0;
    let timeFim = strFim ? new Date(strFim.split('-')[0], parseInt(strFim.split('-')[1]) - 1, strFim.split('-')[2], 23, 59, 59).getTime() : Infinity;

    dadosFiltradosEvolucao = dadosViagensEvolucao.filter(registro => {
        let dataV = getCampo(registro, ['dataDaBaseExcel', 'dataLancamento']);
        if (!dataV || dataV === '') dataV = getCampo(registro, ['created_at']);
        
        const timeV = converterDataExcel(dataV).getTime();
        if (timeV < timeInicio || timeV > timeFim) return false;

        // Compara com a classificação Master (Serrana x Outras)
        const tClassificada = classificarTransportadora(getCampo(registro, ['transportadora']));
        if (transpFiltro !== '' && tClassificada !== transpFiltro) return false;

        const codUp = String(getCampo(registro, ['up'])).trim().toUpperCase();
        let nomeDaFazenda = dicionarioUpFazenda[codUp] ? dicionarioUpFazenda[codUp].toUpperCase() : "NÃO VINCULADA";
        if (fazendaFiltro !== '' && nomeDaFazenda !== fazendaFiltro) return false;

        return true;
    });

    calcularAgrupamentosERenderizar();
    
    if(statusEl) {
        statusEl.innerText = `${dadosFiltradosEvolucao.length} registros analisados`;
        statusEl.className = dadosFiltradosEvolucao.length === 0 
            ? "text-xs font-bold bg-slate-900 border border-slate-700 text-amber-400 px-3 py-1 rounded-lg font-mono"
            : "text-xs font-bold bg-slate-900 border border-slate-700 text-emerald-400 px-3 py-1 rounded-lg font-mono";
    }
}

function calcularAgrupamentosERenderizar() {
    let totVolumeGlobal = 0;
    const agrupamentoDiario = {};
    const agrupamentoFazenda = {};

    dadosFiltradosEvolucao.forEach(r => {
        const vol = toNumber(getCampo(r, ['volumeReal', 'pesoLiquido']));
        const rpv = toNumber(getCampo(r, ['rpv']));
        const dmt = toNumber(getCampo(r, ['distanciaAsfalto'])) + toNumber(getCampo(r, ['distanciaTerra']));
        
        let dataStr = getCampo(r, ['dataDaBaseExcel', 'dataLancamento']);
        if (!dataStr || dataStr === '') {
            let crAt = getCampo(r, ['created_at']);
            dataStr = crAt ? String(crAt).split('T')[0] : 'S/D';
        }

        // Aplica o Nome Classificado para a Transportadora
        const transpAgrupada = classificarTransportadora(getCampo(r, ['transportadora']));
        
        const codUp = String(getCampo(r, ['up'])).trim().toUpperCase();
        let nomeDaFazenda = dicionarioUpFazenda[codUp] ? dicionarioUpFazenda[codUp].toUpperCase() : "NÃO VINCULADA";
        const chaveGrupo = `${nomeDaFazenda} || ${transpAgrupada}`;

        totVolumeGlobal += vol;

        if(!agrupamentoDiario[dataStr]) {
            agrupamentoDiario[dataStr] = {};
        }
        if(!agrupamentoDiario[dataStr][nomeDaFazenda]) {
            agrupamentoDiario[dataStr][nomeDaFazenda] = { viagens: 0, volume: 0 };
        }
        agrupamentoDiario[dataStr][nomeDaFazenda].viagens += 1;
        agrupamentoDiario[dataStr][nomeDaFazenda].volume += vol;

        if(!agrupamentoFazenda[chaveGrupo]) {
            agrupamentoFazenda[chaveGrupo] = { fazenda: nomeDaFazenda, transportadora: transpAgrupada, viagens: 0, volume: 0, scoreDMT: 0, scoreRPV: 0 };
        }
        agrupamentoFazenda[chaveGrupo].viagens += 1;
        agrupamentoFazenda[chaveGrupo].volume += vol;
        agrupamentoFazenda[chaveGrupo].scoreDMT += dmt;
        agrupamentoFazenda[chaveGrupo].scoreRPV += rpv;
    });

    const listaOrdenadaFazendas = Object.values(agrupamentoFazenda).sort((a,b) => b.volume - a.volume);

    renderizarQuadroLadoALado(listaOrdenadaFazendas, totVolumeGlobal);
    renderizarGraficosEvolucao(agrupamentoDiario, listaOrdenadaFazendas);
    renderizarTabelaEvolucao(listaOrdenadaFazendas);
}

function renderizarQuadroLadoALado(fazendas, totalVolumePeriodo) {
    const quadro = document.getElementById('quadroEvolucaoLadoALado');
    if(!quadro) return;

    if(fazendas.length === 0) {
        quadro.innerHTML = `
            <div class="col-span-full text-center text-amber-400 py-8 border border-dashed border-slate-700 rounded-xl bg-slate-800/20 font-bold text-sm">
                <i class="fas fa-exclamation-circle mr-2"></i>Nenhum registro encontrado nas datas selecionadas.
            </div>`;
        return;
    }

    let html = '';
    fazendas.forEach(f => {
        const dmtMedio = f.viagens > 0 ? (f.scoreDMT / f.viagens) : 0;
        const partVolume = totalVolumePeriodo > 0 ? ((f.volume / totalVolumePeriodo) * 100).toFixed(1) : 0;
        const colorTitle = f.fazenda === "NÃO VINCULADA" ? "text-rose-400" : "text-white";

        // Cores Dinâmicas Baseadas na Transportadora (Serrana = Verde/Azul | Outras = Roxo/Amarelo)
        const isSerrana = f.transportadora.includes('SERRANALOG');
        const iconColor = isSerrana ? 'text-sky-500' : 'text-purple-400';

        html += `
            <div class="bg-slate-800/70 p-5 rounded-2xl border border-slate-700/60 hover:border-emerald-500/50 hover:bg-slate-800 transition-all shadow-md flex flex-col justify-between group relative overflow-hidden">
                <div class="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl transition-all group-hover:bg-emerald-500/10"></div>
                
                <div>
                    <div class="flex justify-between items-start gap-2 mb-2">
                        <span class="text-[10px] font-bold text-slate-400 font-mono flex items-center gap-1">
                            <i class="fas fa-chart-pie text-emerald-500"></i> ${partVolume}% da Produção
                        </span>
                    </div>
                    
                    <h4 class="${colorTitle} font-black text-sm tracking-wide uppercase truncate mb-1" title="${f.fazenda}">
                        <i class="fas fa-tractor text-slate-500 text-xs mr-1"></i> ${f.fazenda}
                    </h4>
                    <p class="text-[10px] text-slate-500 uppercase font-bold tracking-tight truncate border-b border-slate-700/50 pb-2 mb-3" title="${f.transportadora}">
                        <i class="fas fa-truck ${iconColor} mr-1"></i> ${f.transportadora}
                    </p>
                </div>

                <div class="space-y-2.5">
                    <div class="flex justify-between items-center">
                        <span class="text-xs text-slate-400 flex items-center gap-1.5"><i class="fas fa-route text-sky-400 text-[10px]"></i> Viagens:</span>
                        <span class="text-sm font-black text-white font-mono bg-slate-900/50 px-2 py-0.5 rounded border border-slate-700/30">${f.viagens}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-xs text-slate-400 flex items-center gap-1.5"><i class="fas fa-cube text-emerald-400 text-[10px]"></i> Volume:</span>
                        <span class="text-sm font-black text-emerald-400 font-mono">${f.volume.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}<span class="text-[10px] text-slate-500 ml-0.5">m³</span></span>
                    </div>
                    <div class="flex justify-between items-center pt-1 border-t border-slate-700/30">
                        <span class="text-[10px] text-slate-500">DMT Médio:</span>
                        <span class="text-xs font-bold text-amber-400 font-mono">${dmtMedio.toFixed(1)} km</span>
                    </div>
                </div>

                <div class="w-full bg-slate-950 h-1 rounded-full mt-4 overflow-hidden">
                    <div class="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500" style="width: ${partVolume}%"></div>
                </div>
            </div>
        `;
    });
    quadro.innerHTML = html;
}

function renderizarGraficosEvolucao(agrDiario, listaFazendas) {
    const diasOrd = Object.keys(agrDiario).filter(d => d !== 'S/D').sort((a,b) => converterDataExcel(a).getTime() - converterDataExcel(b).getTime());
    const labelsDiario = diasOrd.map(d => d.substring(0,5));

    const fazendasNoPeriodoSet = new Set();
    diasOrd.forEach(d => {
        Object.keys(agrDiario[d]).forEach(faz => fazendasNoPeriodoSet.add(faz));
    });
    const arrayFazendas = Array.from(fazendasNoPeriodoSet).sort();

    const paleta = ['#10b981', '#38bdf8', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

    const datasetsDiario = arrayFazendas.map((faz, index) => {
        const dataVol = [];
        const dataViagens = []; 
        
        diasOrd.forEach(d => {
            const inf = agrDiario[d][faz] || { volume: 0, viagens: 0 };
            dataVol.push(parseFloat(inf.volume.toFixed(1)));
            dataViagens.push(inf.viagens);
        });

        return {
            type: 'bar',
            label: faz,
            data: dataVol,
            _viagens: dataViagens, 
            backgroundColor: paleta[index % paleta.length],
            borderRadius: 4,
            barPercentage: 0.85,
            categoryPercentage: 0.85
        };
    });

    if(chartEvolucaoDiariaObj) chartEvolucaoDiariaObj.destroy();
    const ctxDiaria = document.getElementById('chartEvolucaoDiaria');
    if(ctxDiaria) {
        chartEvolucaoDiariaObj = new Chart(ctxDiaria, {
            type: 'bar',
            data: {
                labels: labelsDiario,
                datasets: datasetsDiario
            },
            options: {
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { 
                    legend: { 
                        position: 'top',
                        labels: { color: '#e2e8f0', font: { weight: 'bold', size: 11 }, usePointStyle: true, boxWidth: 8 } 
                    },
                    datalabels: {
                        labels: {
                            volumeTop: {
                                align: 'top',
                                anchor: 'end',
                                color: '#fff',
                                font: { weight: 'bold', size: 10 },
                                formatter: (val) => val > 0 ? val.toLocaleString('pt-BR') : ''
                            },
                            viagensBase: {
                                align: 'top',
                                anchor: 'start',
                                offset: 4,
                                color: '#0f172a',
                                backgroundColor: 'rgba(255,255,255,0.85)',
                                borderRadius: 4,
                                font: { weight: 'bold', size: 9 },
                                padding: { top: 2, bottom: 2, left: 4, right: 4 },
                                formatter: (val, ctx) => {
                                    const viags = ctx.dataset._viagens[ctx.dataIndex];
                                    return viags > 0 ? viags + ' vgs' : '';
                                }
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { weight: 'bold' } } },
                    y: { 
                        display: true, 
                        position: 'left', 
                        grid: { color: 'rgba(255,255,255,0.05)' }, 
                        ticks: { color: '#94a3b8' },
                        grace: '10%' 
                    }
                }
            }
        });
    }

    const agrupamentoPuroFazenda = {};
    listaFazendas.forEach(f => {
        if(!agrupamentoPuroFazenda[f.fazenda]) agrupamentoPuroFazenda[f.fazenda] = 0;
        agrupamentoPuroFazenda[f.fazenda] += f.volume;
    });
    
    const arrPuroFazendas = Object.keys(agrupamentoPuroFazenda).map(key => {
        return { fazenda: key, volume: agrupamentoPuroFazenda[key] };
    }).sort((a,b) => b.volume - a.volume).slice(0, 10);

    const labelsTop = arrPuroFazendas.map(f => f.fazenda);
    const volTop = arrPuroFazendas.map(f => parseFloat(f.volume.toFixed(1)));

    if(chartEvolucaoTopFazendasObj) chartEvolucaoTopFazendasObj.destroy();
    const ctxTop = document.getElementById('chartEvolucaoTopFazendas');
    if(ctxTop) {
        chartEvolucaoTopFazendasObj = new Chart(ctxTop, {
            type: 'bar',
            data: {
                labels: labelsTop,
                datasets: [{ label: 'Volume (m³)', data: volTop, backgroundColor: '#818cf8', borderRadius: 5 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    datalabels: { 
                        display: true, 
                        color: '#fff', 
                        font: { weight: 'bold', size: 10 }, 
                        anchor: 'end', 
                        align: 'bottom' 
                    }
                },
                scales: {
                    x: { ticks: { color: '#94a3b8', font: { size: 10, weight: 'bold' } }, grid: { display: false } },
                    y: { display: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#818cf8' } }
                }
            }
        });
    }
}

function renderizarTabelaEvolucao(dados) {
    const tbody = document.getElementById('tbodyEvolucaoFazendas');
    if(!tbody) return;
    tbody.innerHTML = '';

    if(dados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-slate-500">Nenhum registro encontrado.</td></tr>`;
        return;
    }

    dados.forEach(d => {
        const dmtMedio = d.viagens > 0 ? (d.scoreDMT / d.viagens) : 0;
        const rpvMedio = d.viagens > 0 ? (d.scoreRPV / d.viagens) : 0;
        
        const corFazenda = d.fazenda === "NÃO VINCULADA" ? "text-rose-400" : "text-white";
        // Destaca a fonte da transportadora se for "OUTRAS" para fácil identificação
        const isSerrana = d.transportadora.includes('SERRANALOG');
        const corTransportadora = isSerrana ? "text-slate-300" : "text-purple-300 font-bold";

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-700/30 transition-colors";
        tr.innerHTML = `
            <td class="px-6 py-3 ${corFazenda} font-bold text-xs uppercase">${d.fazenda}</td>
            <td class="px-6 py-3 ${corTransportadora} text-xs uppercase">${d.transportadora}</td>
            <td class="px-6 py-3 text-center text-sky-400 font-black font-mono">${d.viagens}</td>
            <td class="px-6 py-3 text-right text-emerald-400 font-mono font-bold">${d.volume.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
            <td class="px-6 py-3 text-right text-amber-400 font-mono">${dmtMedio.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
            <td class="px-6 py-3 text-right text-indigo-400 font-mono">${rpvMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        `;
        tbody.appendChild(tr);
    });
}

function exportarExcelEvolucao() {
    if(!dadosFiltradosEvolucao || dadosFiltradosEvolucao.length === 0) {
        alert("Sem dados para exportar."); return;
    }
    if (typeof XLSX === 'undefined') {
        alert("Biblioteca XLSX não disponível."); return;
    }

    const obj = {};
    dadosFiltradosEvolucao.forEach(r => {
        const transpAgrupada = classificarTransportadora(getCampo(r, ['transportadora']));
        const codUp = String(getCampo(r, ['up'])).trim().toUpperCase();
        let nomeDaFazenda = dicionarioUpFazenda[codUp] ? dicionarioUpFazenda[codUp].toUpperCase() : "NÃO VINCULADA";
        
        let dataStr = getCampo(r, ['dataDaBaseExcel', 'dataLancamento']);
        if (!dataStr || dataStr === '') {
            let crAt = getCampo(r, ['created_at']);
            dataStr = crAt ? String(crAt).split('T')[0] : 'S/D';
        }
        
        const ch = `${dataStr}_${nomeDaFazenda}_${transpAgrupada}`;
        const vol = toNumber(getCampo(r, ['volumeReal', 'pesoLiquido']));
        const dmt = toNumber(getCampo(r, ['distanciaAsfalto'])) + toNumber(getCampo(r, ['distanciaTerra']));
        const rpv = toNumber(getCampo(r, ['rpv']));

        if(!obj[ch]) {
            obj[ch] = { Data: dataStr, Fazenda: nomeDaFazenda, Transportadora: transpAgrupada, Viagens: 0, Volume: 0, SomaDMT: 0, SomaRPV: 0 };
        }
        obj[ch].Viagens += 1;
        obj[ch].Volume += vol;
        obj[ch].SomaDMT += dmt;
        obj[ch].SomaRPV += rpv;
    });

    const excelArr = Object.values(obj).map(i => ({
        "Data": i.Data,
        "Fazenda": i.Fazenda,
        "Transportadora": i.Transportadora,
        "Nº Viagens": i.Viagens,
        "Volume Total (m³)": parseFloat(i.Volume.toFixed(1)),
        "DMT Médio (km)": parseFloat((i.Viagens > 0 ? i.SomaDMT/i.Viagens : 0).toFixed(1)),
        "RPV Médio": parseFloat((i.Viagens > 0 ? i.SomaRPV/i.Viagens : 0).toFixed(2))
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(excelArr), "Evolucao_Fazendas");
    XLSX.writeFile(wb, `Relatorio_Evolucao_Fazendas_${new Date().getTime()}.xlsx`);
}