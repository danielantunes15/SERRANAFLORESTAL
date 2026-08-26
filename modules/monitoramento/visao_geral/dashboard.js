// ==========================================
// js/dashboard.js - LÓGICA DO DASHBOARD
// ==========================================
Chart.register(ChartDataLabels);
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';
Chart.defaults.font.family = "'Inter', sans-serif";

let fullHistoricoData = [];
let metasGlobaisObj = null; 
let configGruasObj = []; 

// Força inicialização automática no Dia Anterior (D-1)
let activeQuickFilter = 'D-1'; 
let chartCiclo = null, chartTransp = null;
let osParaMeta = [];
let frotasParaMeta = [];

let filterTransportadora, filterData, filterMes, filterDataInicio, filterDataFim, btnQFs;
let chkKeysCache = null; 

function corrigirDataSupabaseLocal(dateStr) {
    if (!dateStr || dateStr === 'null' || dateStr === 'undefined') return null;
    let str = String(dateStr).trim();
    if (!str.includes('T')) str = str.replace(' ', 'T');
    const partes = str.split('T');
    if (partes.length === 2) {
        const horaStr = partes[1];
        if (!horaStr.includes('Z') && !horaStr.includes('+') && !horaStr.includes('-')) {
            str += 'Z';
        }
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

window.carregarDadosDashboardAnalitico = async function() {
    filterTransportadora = document.getElementById('filterTransportadora');
    filterData = document.getElementById('filterData');
    filterMes = document.getElementById('filterMes');
    filterDataInicio = document.getElementById('filterDataInicio');
    filterDataFim = document.getElementById('filterDataFim');
    btnQFs = document.querySelectorAll('.btn-qf');

    setupDashboardFilters();
    
    // Ativa botão D-1 visualmente logo ao carregar a página
    setQuickFilterUI('D-1'); 
    
    await loadDashboardDataInit();

    const btnExportarComparativo = document.getElementById('btnExportarComparativo');
    if(btnExportarComparativo) {
        btnExportarComparativo.addEventListener('click', () => {
            const container = document.getElementById('comparativoContainer');
            
            html2canvas(container, {
                scale: 3, 
                backgroundColor: '#0f172a', 
                useCORS: true
            }).then(canvas => {
                const link = document.createElement('a');
                link.download = 'Comparativo_Cenarios_Serrana.png';
                link.href = canvas.toDataURL('image/png', 1.0);
                link.click();
            }).catch(err => {
                console.error("Erro ao gerar a imagem PNG:", err);
                alert("Houve um erro ao tentar salvar a imagem. Tente novamente.");
            });
        });
    }
}

function normalizarCiclos(dataArr) {
    const pMap = new Map();
    
    dataArr.forEach(d => {
        if (d.cicloHorasOriginal === undefined) {
            d.cicloHorasOriginal = d.cicloHoras;
        }
        if (d.cicloHorasOriginal > 0 && d.cicloHorasOriginal <= 12) { 
            const pl = d.placa || 'N/A';
            if (!pMap.has(pl)) pMap.set(pl, { ciclos: 0, count: 0 });
            pMap.get(pl).ciclos += d.cicloHorasOriginal;
            pMap.get(pl).count++;
        }
    });
    
    const frotas = Array.from(pMap.values())
        .map(x => x.ciclos / x.count)
        .sort((a, b) => a - b)
        .slice(0, 20);
        
    if (frotas.length === 0) return;
    
    const mediaMenores = frotas.reduce((a, b) => a + b, 0) / frotas.length;
    
    dataArr.forEach(d => {
        if (d.cicloHorasOriginal > 12) {
            d.cicloHoras = mediaMenores; 
        } else {
            d.cicloHoras = d.cicloHorasOriginal; 
        }
    });
}

function setupDashboardFilters() {
    if(filterTransportadora) filterTransportadora.addEventListener('change', () => loadDashboardData());
    
    if(filterData) filterData.addEventListener('change', () => { 
        setQuickFilterUI('ALL'); 
        if(filterMes) filterMes.value = 'ALL';
        if(filterDataInicio) filterDataInicio.value = '';
        if(filterDataFim) filterDataFim.value = '';
        loadDashboardData(); 
    });
    if(filterMes) filterMes.addEventListener('change', () => { 
        setQuickFilterUI('ALL'); 
        if(filterData) filterData.value = 'ALL';
        if(filterDataInicio) filterDataInicio.value = '';
        if(filterDataFim) filterDataFim.value = '';
        loadDashboardData(); 
    });
    if(filterDataInicio) filterDataInicio.addEventListener('change', () => {
        setQuickFilterUI('ALL');
        if(filterMes) filterMes.value = 'ALL';
        if(filterData) filterData.value = 'ALL';
        loadDashboardData();
    });
    if(filterDataFim) filterDataFim.addEventListener('change', () => {
        setQuickFilterUI('ALL');
        if(filterMes) filterMes.value = 'ALL';
        if(filterData) filterData.value = 'ALL';
        loadDashboardData();
    });

    btnQFs.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const qf = e.currentTarget.getAttribute('data-qf');
            setQuickFilterUI(qf);
            if (qf !== 'ALL' && filterData) filterData.value = 'ALL';
            if (qf !== 'ALL' && filterMes) filterMes.value = 'ALL';
            if (qf !== 'ALL' && filterDataInicio) filterDataInicio.value = '';
            if (qf !== 'ALL' && filterDataFim) filterDataFim.value = '';
            loadDashboardData();
        });
    });
}

function setQuickFilterUI(qf) {
    activeQuickFilter = qf;
    btnQFs.forEach(b => {
        if (b.getAttribute('data-qf') === qf) {
            b.classList.add('active', 'bg-sky-900/50', 'text-sky-400', 'border-sky-800/50');
            b.classList.remove('text-slate-400', 'hover:bg-slate-700/50', 'border-transparent');
        } else {
            b.classList.remove('active', 'bg-sky-900/50', 'text-sky-400', 'border-sky-800/50');
            b.classList.add('text-slate-400', 'hover:bg-slate-700/50', 'border-transparent');
        }
    });
}

function parseDateTime(dateVal, timeVal) {
    if (!dateVal) return null;
    let baseDate = null;
    if (typeof dateVal === 'number') {
        const dateInfo = XLSX.SSF.parse_date_code(dateVal);
        if (dateInfo) baseDate = new Date(dateInfo.y, dateInfo.m - 1, dateInfo.d);
    } else if (typeof dateVal === 'string') {
        const str = dateVal.trim();
        if (str.includes('/')) {
            const parts = str.split(' ')[0].split('/');
            if (parts.length >= 3) {
                let year = parseInt(parts[2], 10);
                if (year < 100) year += 2000;
                baseDate = new Date(year, parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
            }
        } else if (str.includes('-')) {
            const parts = str.split(' ')[0].split('-');
            if (parts.length >= 3) {
                let year = parseInt(parts[0], 10) > 1000 ? parseInt(parts[0], 10) : parseInt(parts[2], 10);
                let month = parseInt(parts[1], 10) - 1;
                let day = parseInt(parts[0], 10) > 1000 ? parseInt(parts[2], 10) : parseInt(parts[0], 10);
                if (year < 100) year += 2000;
                baseDate = new Date(year, month, day);
            }
        } else { baseDate = new Date(str); }
    }
    if (!baseDate || isNaN(baseDate.getTime())) return null;
    let hours = 0, minutes = 0, seconds = 0;
    if (typeof timeVal === 'number') {
        let fraction = timeVal % 1; 
        if (fraction < 0) fraction += 1;
        let totalSeconds = Math.round(fraction * 24 * 3600);
        hours = Math.floor(totalSeconds / 3600);
        totalSeconds %= 3600;
        minutes = Math.floor(totalSeconds / 60);
    } else if (typeof timeVal === 'string' && timeVal.trim() !== "") {
        const tParts = timeVal.trim().split(':');
        hours = parseInt(tParts[0], 10) || 0;
        minutes = parseInt(tParts[1], 10) || 0;
    }
    baseDate.setHours(hours, minutes, seconds, 0);
    return baseDate;
}

function formatarHorasMinutos(horasDecimais) {
    if (horasDecimais === null || horasDecimais === undefined || isNaN(horasDecimais) || horasDecimais <= 0) return '-';
    const horas = Math.floor(horasDecimais);
    const minutos = Math.round((horasDecimais - horas) * 60);
    if (horas === 0 && minutos === 0) return '0m';
    if (horas === 0) return `${minutos}m`;
    if (minutos === 0) return `${horas}h`;
    return `${horas}h ${minutos.toString().padStart(2, '0')}m`;
}

function atualizarElementoTempo(idElemento, mediaReal, metaData) {
    const el = document.getElementById(idElemento);
    if (!el) return;
    
    const strReal = formatarHorasMinutos(mediaReal);
    const metaVal = (metaData && !isNaN(metaData)) ? metaData : 0;
    const strMeta = formatarHorasMinutos(metaVal);

    let corClasse = "text-white";
    let icone = "";

    if (metaVal > 0) {
        if (mediaReal > metaVal) {
            corClasse = "text-rose-500";
            icone = `<i class="fas fa-arrow-up text-rose-500 text-lg ml-2" title="Acima da meta"></i>`;
        } else {
            corClasse = "text-emerald-400";
            icone = `<i class="fas fa-check text-emerald-400 text-lg ml-2" title="Dentro da meta"></i>`;
        }
    } else {
        icone = `<i class="fas fa-minus-circle text-slate-600 text-sm ml-2" title="Meta não definida ou zero"></i>`;
    }

    el.innerHTML = `
        <div class="flex items-center w-full">
            <span class="${corClasse} leading-none">${strReal}</span>${icone}
        </div>
        <div class="text-[11px] text-slate-400 font-bold uppercase mt-3 pt-2 border-t border-slate-700/50 tracking-wider w-full">
            Meta: <span class="text-slate-200 text-xs font-black ml-1">${strMeta}</span>
        </div>
    `;
}

const centerTextPlugin = {
    id: 'centerText',
    beforeDraw: function(chart) {
        if (chart.config.type !== 'doughnut') return;
        const ctx = chart.ctx;
        const chartArea = chart.chartArea;
        const centerX = (chartArea.left + chartArea.right) / 2;
        const centerY = (chartArea.top + chartArea.bottom) / 2;
        
        const total = chart.config.data.datasets[0].data.reduce((a, b) => a + b, 0);

        ctx.restore();
        ctx.font = "bold 28px 'Inter', sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#38bdf8"; 

        const text = total.toLocaleString('pt-PT');
        const textX = centerX - (ctx.measureText(text).width / 2);
        ctx.fillText(text, textX, centerY - 8);
        
        ctx.font = "bold 11px 'Inter', sans-serif";
        ctx.fillStyle = "#94a3b8"; 
        const subText = "VIAGENS";
        const subTextX = centerX - (ctx.measureText(subText).width / 2);
        ctx.fillText(subText, subTextX, centerY + 16);
        ctx.save();
    }
}

async function loadDashboardDataInit() {
    try {
        // Tenta puxar a variável global primeiro (idêntico ao grafico_evolucao_dm.js)
        if (window.ordensServico && window.ordensServico.length > 0) {
            osParaMeta = window.ordensServico;
        } else {
            let allOS = [];
            let fromOS = 0;
            const stepOS = 1000;
            let fetchMoreOS = true;
            while (fetchMoreOS) {
                const osResp = await window.supabaseClient
                    .from('ordens_servico')
                    .select('*')
                    .neq('status', 'Agendada')
                    .order('data_abertura', { ascending: false })
                    .range(fromOS, fromOS + stepOS - 1);
                    
                if (osResp.error) {
                    fetchMoreOS = false;
                } else if (osResp.data && osResp.data.length > 0) {
                    allOS = allOS.concat(osResp.data);
                    fromOS += osResp.data.length;
                    if (osResp.data.length < stepOS) fetchMoreOS = false;
                } else {
                    fetchMoreOS = false;
                }
            }
            osParaMeta = allOS;
        }

        if (window.frotasManutencao && window.frotasManutencao.length > 0) {
            frotasParaMeta = window.frotasManutencao;
        } else {
            let frotasResp = await window.supabaseClient.from('frotas_manutencao').select('*').limit(5000);
            if (!frotasResp.data || frotasResp.data.length === 0) {
                frotasResp = await window.supabaseClient.from('cadastro_frota').select('*').limit(5000);
            }
            if (frotasResp.data) frotasParaMeta = frotasResp.data;
        }
    } catch (e) { console.error("Erro ao puxar dados da manutenção:", e); }

    try {
        let queryMeta = window.supabaseClient.from('metas_globais').select('*').eq('id', 1).single();
        const { data: metasData } = await queryMeta;
        if (metasData) {
            metasGlobaisObj = metasData;
        }
    } catch(e) {
        console.error("Erro ao puxar metas globais no dashboard:", e);
    }

    try {
        let queryGruas = window.supabaseClient.from('config_gruas').select('*');
        if (typeof window.aplicarFiltroFilial === 'function') {
            queryGruas = window.aplicarFiltroFilial(queryGruas);
        }
        const { data: gruasData } = await queryGruas;
        if (gruasData) {
            configGruasObj = gruasData;
        }
    } catch(e) {
        console.error("Erro ao puxar gruas cadastradas:", e);
    }

    let allData = [];
    let from = 0;
    const step = 1000;
    let fetchMore = true;

    const statusLabel = document.getElementById('dbStatusLabel');
    if (statusLabel) {
        statusLabel.innerHTML = `<i class="fas fa-spinner fa-spin mr-1"></i> Sincronizando Base de Dados...`;
    }

    while (fetchMore) {
        let queryVia = window.supabaseClient
            .from('historico_viagens')
            .select('*')
            .order('id', { ascending: false })
            .range(from, from + step - 1);

        if (typeof window.aplicarFiltroFilial === 'function') {
            queryVia = window.aplicarFiltroFilial(queryVia);
        }

        const { data, error } = await queryVia;

        if (error) {
            console.error("Erro Crítico ao buscar viagens no Supabase:", error);
            fetchMore = false;
            break;
        }

        if (data && data.length > 0) {
            allData = allData.concat(data);
            from += data.length; 

            if (statusLabel) {
                statusLabel.innerHTML = `<i class="fas fa-spinner fa-spin mr-1"></i> Baixando: ${allData.length} viagens`;
            }

            if (data.length < step) {
                fetchMore = false;
            }
        } else {
            fetchMore = false;
        }
    }

    if(allData.length > 0) {
        fullHistoricoData = allData;
        normalizarCiclos(fullHistoricoData);
        loadDashboardData();
    } else {
        loadDashboardData(); 
    }
}

function calcStats(dataArr) {
    if(!dataArr || dataArr.length === 0) {
        return { volTotal: 0, medVol: 0, medCiclo: 0, prod: 0, medFilaCpo: 0, medCarreg: 0, medFilaFab: 0, medAsfalto: 0, medTerra: 0 };
    }
    const viagens = dataArr.length;
    const vol = dataArr.reduce((s,d) => s + (parseFloat(String(d.volumeReal).replace(',','.'))||0), 0);
    const medVol = viagens > 0 ? vol / viagens : 0;
    const validCiclos = dataArr.filter(d => d.cicloHoras > 0);
    const somaCiclos = validCiclos.reduce((s,d) => s + d.cicloHoras, 0);
    const medCiclo = validCiclos.length > 0 ? somaCiclos / validCiclos.length : 0;
    const prod = somaCiclos > 0 ? vol / somaCiclos : 0;
    const validFilaCpo = dataArr.filter(d => d.filaCampoHoras > 0);
    const medFilaCpo = validFilaCpo.length > 0 ? validFilaCpo.reduce((s,d) => s + d.filaCampoHoras, 0) / validFilaCpo.length : 0;
    const validCarreg = dataArr.filter(d => d.tempoCarregamentoHoras > 0);
    const medCarreg = validCarreg.length > 0 ? validCarreg.reduce((s,d) => s + d.tempoCarregamentoHoras, 0) / validCarreg.length : 0;
    const validFilaFab = dataArr.filter(d => d.filaFabricaHoras > 0);
    const medFilaFab = validFilaFab.length > 0 ? validFilaFab.reduce((s,d) => s + d.filaFabricaHoras, 0) / validFilaFab.length : 0;
    const medAsfalto = viagens > 0 ? dataArr.reduce((s, d) => s + (d.distanciaAsfalto || 0), 0) / viagens : 0;
    const medTerra = viagens > 0 ? dataArr.reduce((s, d) => s + (d.distanciaTerra || 0), 0) / viagens : 0;
    return { volTotal: vol, medVol, medCiclo, prod, medFilaCpo, medCarreg, medFilaFab, medAsfalto, medTerra };
}

function checkLoaderDynamic(d, loaderArray) {
    if (!loaderArray || loaderArray.length === 0) return false;
    
    if (chkKeysCache === null) {
        chkKeysCache = [];
        for (let key in d) {
            let keyUpper = key.toUpperCase();
            if (keyUpper.includes('GRUA') || keyUpper.includes('CARREG') || keyUpper.includes('EQUIP') || keyUpper.includes('FRENTE')) {
                chkKeysCache.push(key);
            }
        }
        if (chkKeysCache.length === 0) {
            chkKeysCache = ['grua', 'equipamento_carregamento', 'frente', 'loader']; 
        }
    }

    for (let i = 0; i < chkKeysCache.length; i++) {
        let val = d[chkKeysCache[i]];
        if (val && typeof val === 'string') {
            let vClean = val.trim().toUpperCase().replace(/\s+/g, '');
            if (vClean && vClean !== '-' && vClean !== 'N/A' && vClean !== '0') {
                for (let j = 0; j < loaderArray.length; j++) {
                    if (vClean === loaderArray[j] || vClean.includes(loaderArray[j])) return true;
                }
            }
        }
    }
    return false;
}

function renderizarTabelaComparativo(dadosFiltrados) {
    const theadComp = document.getElementById('comparativoHead');
    const tbodyComp = document.getElementById('comparativoBody');
    
    if (!theadComp || !tbodyComp) return;

    let cenariosPropria = [];
    let cenariosOutros = [];
    const colorVariants = [
        { text: 'text-indigo-400', bg: 'bg-indigo-900/10' },
        { text: 'text-amber-400', bg: 'bg-amber-900/10' },
        { text: 'text-rose-400', bg: 'bg-rose-900/10' },
        { text: 'text-cyan-400', bg: 'bg-cyan-900/10' },
        { text: 'text-purple-400', bg: 'bg-purple-900/10' }
    ];

    let transpPropriaConfig = 'SERRANALOG';
    if (metasGlobaisObj && metasGlobaisObj.transp_propria) {
        transpPropriaConfig = metasGlobaisObj.transp_propria.toUpperCase();
    }

    function isTransportadoraPropria(d) {
        const transp = String(d.transportadora || '').trim().toUpperCase();
        return transp.includes(transpPropriaConfig) || transp === transpPropriaConfig;
    }

    if (configGruasObj && configGruasObj.length > 0) {
        const gruasSorted = [...configGruasObj].sort((a, b) => {
            const oa = a.ordem || 'ZZZ';
            const ob = b.ordem || 'ZZZ';
            return oa.localeCompare(ob);
        });
        gruasSorted.forEach((item, index) => {
            const nome = (item.frente || `Frente ${index+1}`).toUpperCase();
            const tipo = item.tipo_frente || 'Outros';
            const ordemDefinida = item.ordem ? item.ordem.toUpperCase() : `C${index+1}`;
            const codes = (item.codigos || '').split(',').map(c => c.trim().toUpperCase().replace(/\s+/g, '')).filter(Boolean);
            
            const style = colorVariants[index % colorVariants.length];
            const isPropria = (tipo === 'Propria' || tipo === 'Própria');
            const icon = isPropria ? 'fa-star' : 'fa-leaf';

            let dadosCenario = dadosFiltrados.filter(d => checkLoaderDynamic(d, codes) && isTransportadoraPropria(d));
            
            let cenarioObj = {
                nome: nome,
                tipo: tipo,
                style: style,
                icon: icon,
                dados: dadosCenario,
                stats: calcStats(dadosCenario),
                ordemLabel: ordemDefinida
            };

            if (isPropria) {
                cenariosPropria.push(cenarioObj);
            } else {
                cenariosOutros.push(cenarioObj);
            }
        });
    }

    let codesPropria = [];
    if (configGruasObj && configGruasObj.length > 0) {
        configGruasObj.forEach(item => {
            if(item.tipo_frente === 'Propria' || item.tipo_frente === 'Própria') {
                const codes = (item.codigos || '').split(',').map(c => c.trim().toUpperCase().replace(/\s+/g, '')).filter(Boolean);
                codesPropria.push(...codes);
            }
        });
    }

    function isASN(d) {
        if (codesPropria.length > 0 && checkLoaderDynamic(d, codesPropria)) return true;
        let grua = String(d.grua || '').trim().toUpperCase();
        if (grua.startsWith('GSR')) return true; 
        return false;
    }

    let dadosASN = dadosFiltrados.filter(d => !isTransportadoraPropria(d) && isASN(d));
    let cenarioASN = {
        nome: 'TRANSP. ASN',
        tipo: 'ASN',
        style: { text: 'text-purple-400', bg: 'bg-purple-900/10' }, 
        icon: 'fa-truck-moving',
        dados: dadosASN,
        stats: calcStats(dadosASN),
        ordemLabel: 'ASN'
    };

    let cenarios = [...cenariosPropria, cenarioASN, ...cenariosOutros];
    
    let todasViagensValidas = [];
    cenarios.forEach(c => {
        todasViagensValidas = todasViagensValidas.concat(c.dados);
    });
    todasViagensValidas = [...new Set(todasViagensValidas)];
    const stGlobal = calcStats(todasViagensValidas);

    let thHtml = `<tr><th class="px-6 py-4 text-slate-300">Indicador de Performance</th>`;
    
    cenarios.forEach((c) => {
        thHtml += `<th class="px-6 py-4 text-white ${c.style.bg} text-right whitespace-nowrap"><i class="fas ${c.icon} mr-1 ${c.style.text}"></i> ${c.ordemLabel}: ${c.nome}</th>`;
    });
    thHtml += `<th class="px-6 py-4 text-white bg-sky-900/10 text-right"><i class="fas fa-globe mr-1 text-sky-400"></i> Total (Geral)</th></tr>`;
    theadComp.innerHTML = thHtml;

    let trViagens = `<tr class="hover:bg-slate-800/30 transition-colors"><td class="px-6 py-4 font-bold text-white text-sm"><i class="fas fa-route text-slate-400 w-5"></i> Viagens Realizadas</td>`;
    cenarios.forEach(c => { trViagens += `<td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right ${c.style.text}">${c.dados.length}</td>`; });
    trViagens += `<td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${todasViagensValidas.length}</td></tr>`;

    let trCaixa = `<tr class="hover:bg-slate-800/30 transition-colors"><td class="px-6 py-4 font-bold text-white text-sm"><i class="fas fa-box-open text-indigo-400 w-5"></i> Caixa de Carga Média</td>`;
    cenarios.forEach(c => { trCaixa += `<td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${c.stats.medVol.toLocaleString('pt-PT',{maximumFractionDigits:1})} m³</td>`; });
    trCaixa += `<td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${stGlobal.medVol.toLocaleString('pt-PT',{maximumFractionDigits:1})} m³</td></tr>`;

    let trVol = `<tr class="hover:bg-slate-800/30 transition-colors"><td class="px-6 py-4 font-bold text-white text-sm"><i class="fas fa-cubes text-cyan-400 w-5"></i> Volume Total</td>`;
    cenarios.forEach(c => { trVol += `<td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${c.stats.volTotal.toLocaleString('pt-PT',{maximumFractionDigits:1})} m³</td>`; });
    trVol += `<td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${stGlobal.volTotal.toLocaleString('pt-PT',{maximumFractionDigits:1})} m³</td></tr>`;

    let trCiclo = `<tr class="hover:bg-slate-800/30 transition-colors"><td class="px-6 py-4 font-bold text-white text-sm"><i class="fas fa-stopwatch text-blue-400 w-5"></i> Ciclo Médio Total</td>`;
    cenarios.forEach(c => { trCiclo += `<td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(c.stats.medCiclo)}</td>`; });
    trCiclo += `<td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(stGlobal.medCiclo)}</td></tr>`;

    let trFilaCpo = `<tr class="hover:bg-slate-800/30 transition-colors border-t border-slate-700/50"><td class="px-6 py-4 font-bold text-slate-300 text-xs uppercase tracking-wider"><i class="fas fa-hourglass-half text-amber-500 w-5"></i> Espera Média no Campo</td>`;
    cenarios.forEach(c => { trFilaCpo += `<td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(c.stats.medFilaCpo)}</td>`; });
    trFilaCpo += `<td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(stGlobal.medFilaCpo)}</td></tr>`;

    let trCarreg = `<tr class="hover:bg-slate-800/30 transition-colors"><td class="px-6 py-4 font-bold text-slate-300 text-xs uppercase tracking-wider"><i class="fas fa-truck-loading text-emerald-500 w-5"></i> Tempo Médio Carregamento</td>`;
    cenarios.forEach(c => { trCarreg += `<td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(c.stats.medCarreg)}</td>`; });
    trCarreg += `<td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(stGlobal.medCarreg)}</td></tr>`;

    let trFilaFab = `<tr class="hover:bg-slate-800/30 transition-colors"><td class="px-6 py-4 font-bold text-slate-300 text-xs uppercase tracking-wider"><i class="fas fa-industry text-rose-500 w-5"></i> Espera Média na Fábrica</td>`;
    cenarios.forEach(c => { trFilaFab += `<td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(c.stats.medFilaFab)}</td>`; });
    trFilaFab += `<td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(stGlobal.medFilaFab)}</td></tr>`;

    let trDist = `<tr class="hover:bg-slate-800/30 transition-colors border-t border-slate-700"><td class="px-6 py-4 font-bold text-slate-300 text-xs uppercase tracking-wider"><i class="fas fa-road text-slate-400 w-5"></i> Dist. Média (Asfalto / Terra)</td>`;
    cenarios.forEach(c => {
        trDist += `<td class="px-6 py-4 font-mono text-white text-[13px] font-bold text-right">
            <span class="text-sky-300" title="Asfalto">Asf: ${c.stats.medAsfalto.toLocaleString('pt-PT',{minimumFractionDigits:2, maximumFractionDigits:2})}</span><br>
            <span class="text-amber-400" title="Terra">Ter: ${c.stats.medTerra.toLocaleString('pt-PT',{minimumFractionDigits:2, maximumFractionDigits:2})}</span>
        </td>`;
    });
    trDist += `<td class="px-6 py-4 font-mono text-white text-[13px] font-bold text-right">
            <span class="text-sky-300" title="Asfalto">Asf: ${stGlobal.medAsfalto.toLocaleString('pt-PT',{minimumFractionDigits:2, maximumFractionDigits:2})}</span><br>
            <span class="text-amber-400" title="Terra">Ter: ${stGlobal.medTerra.toLocaleString('pt-PT',{minimumFractionDigits:2, maximumFractionDigits:2})}</span>
        </td></tr>`;

    tbodyComp.innerHTML = trViagens + trCaixa + trVol + trCiclo + trFilaCpo + trCarreg + trFilaFab + trDist;
}

function loadDashboardData() {
    const storedData = fullHistoricoData;
    if(!storedData.length) {
        if(document.getElementById('dbStatusLabel')) document.getElementById('dbStatusLabel').innerText = "Sem dados no banco";
        renderizarTabelaComparativo([]); 
        return;
    }

    const allTransps = [...new Set(storedData.map(d => d.transportadora))].filter(Boolean).sort();
    const currT = filterTransportadora ? filterTransportadora.value : 'ALL';
    if (filterTransportadora) {
        filterTransportadora.innerHTML = '<option value="ALL">TODAS AS TRANSPORTADORAS</option>';
        allTransps.forEach(t => filterTransportadora.insertAdjacentHTML('beforeend', `<option value="${t}" ${t===currT?'selected':''}>${t}</option>`));
    }

    const allDates = [...new Set(storedData.map(d => d.dataDaBaseExcel))].filter(d => d && d !== 'Desconhecida').sort((a,b)=>{const pA=a.split('/');const pB=b.split('/');return new Date(pA[2],pA[1]-1,pA[0])-new Date(pB[2],pB[1]-1,pB[0]);});
    const currD = filterData ? filterData.value : 'ALL';
    if (filterData) {
        filterData.innerHTML = '<option value="ALL">TODO O PERÍODO</option>';
        allDates.forEach(dt => filterData.insertAdjacentHTML('beforeend', `<option value="${dt}" ${dt===currD?'selected':''}>${dt}</option>`));
    }

    let currM = filterMes ? filterMes.value : 'ALL';
    if (!window.dashMesInicializado && filterMes) {
        currM = 'ALL'; 
        window.dashMesInicializado = true;
    }

    if (filterMes) {
        const mesesSet = new Set();
        storedData.forEach(d => {
            if(d.dataDaBaseExcel && d.dataDaBaseExcel !== 'Desconhecida') {
                const p = d.dataDaBaseExcel.split('/');
                if(p.length >= 3) {
                    let y = p[2]; if(y.length === 2) y = "20"+y;
                    mesesSet.add(`${p[1]}/${y}`); 
                }
            }
        });
        const allMeses = Array.from(mesesSet).sort((a,b) => {
              const pA = a.split('/'); const pB = b.split('/');
              return new Date(pA[1], pA[0]-1, 1) - new Date(pB[1], pB[0]-1, 1);
        });
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        
        filterMes.innerHTML = '<option value="ALL">TODOS OS MESES</option>';
        
        let optionExists = false;
        allMeses.forEach(mStr => {
            const p = mStr.split('/');
            const mesIdx = parseInt(p[0]) - 1;
            const nomeMes = monthNames[mesIdx] + '/' + p[1].substring(2);
            if (mStr === currM) optionExists = true;
            filterMes.insertAdjacentHTML('beforeend', `<option value="${mStr}" ${mStr===currM?'selected':''}>${nomeMes}</option>`);
        });

        if (!optionExists && currM !== 'ALL') {
            filterMes.value = 'ALL';
            currM = 'ALL';
        } else {
            filterMes.value = currM;
        }
    }

    const activeT = filterTransportadora ? filterTransportadora.value : 'ALL';
    const activeD = filterData ? filterData.value : 'ALL';
    const activeM = filterMes ? filterMes.value : 'ALL';
    const activeInicio = filterDataInicio ? filterDataInicio.value : '';
    const activeFim = filterDataFim ? filterDataFim.value : '';
    
    const filteredData = storedData.filter(d => {
        const mTransp = activeT === 'ALL' || d.transportadora === activeT;
        let mData = true;

        if (activeInicio || activeFim) {
            const parsed = parseDateTime(d.dataDaBaseExcel, null);
            if (parsed) {
                parsed.setHours(0,0,0,0);
                if (activeInicio) {
                    const parts = activeInicio.split('-');
                    const inicioDt = new Date(parts[0], parts[1]-1, parts[2]);
                    if (parsed < inicioDt) mData = false;
                }
                if (activeFim) {
                    const parts = activeFim.split('-');
                    const fimDt = new Date(parts[0], parts[1]-1, parts[2]);
                    if (parsed > fimDt) mData = false;
                }
            } else {
                mData = false;
            }
        }
        else if (activeM !== 'ALL') {
            const p = d.dataDaBaseExcel.split('/');
            if(p.length >= 3) {
                  let y = p[2]; if(y.length === 2) y = "20"+y;
                  mData = (`${p[1]}/${y}` === activeM);
            } else { mData = false; }
        } 
        else if (activeQuickFilter !== 'ALL') {
            const parsed = parseDateTime(d.dataDaBaseExcel, null);
            if (parsed) {
                parsed.setHours(0,0,0,0); const hj = new Date(); hj.setHours(0,0,0,0);
                const diff = Math.round((hj - parsed)/86400000);
                
                if (activeQuickFilter === 'D-1') mData = (diff === 1);
                else if (activeQuickFilter === 'D-2') mData = (diff === 2);
                else if (activeQuickFilter === 'D-7') mData = (diff >= 0 && diff <= 7);
                else if (activeQuickFilter === 'D-30') mData = (diff >= 0 && diff <= 30);
                else if (activeQuickFilter === 'SEM') {
                    const inicioSemana = new Date(hj);
                    inicioSemana.setDate(hj.getDate() - hj.getDay());
                    mData = (parsed >= inicioSemana && parsed <= hj);
                }
            } else mData = false;
        } else {
            mData = activeD === 'ALL' || d.dataDaBaseExcel === activeD;
        }
        
        return mTransp && mData;
    });

    if (filteredData.length === 0) {
        if(document.getElementById('dbStatusLabel')) document.getElementById('dbStatusLabel').innerText = "Filtro Vazio";
        if(document.getElementById('totalViagens')) document.getElementById('totalViagens').innerText = '0';
        if(document.getElementById('totalPesoLiq')) document.getElementById('totalPesoLiq').innerHTML = '<span class="text-white">0 t</span>';
        if(document.getElementById('mediaRPV')) document.getElementById('mediaRPV').innerText = '0';
        if(document.getElementById('produtividadeGlobal')) document.getElementById('produtividadeGlobal').innerText = '0.0';
        if(document.getElementById('ociosidadeGlobal')) document.getElementById('ociosidadeGlobal').innerText = '0%';
        if(document.getElementById('bestPlacaValue')) document.getElementById('bestPlacaValue').innerText = '0.0';
        if(document.getElementById('bestPlacaName')) document.getElementById('bestPlacaName').innerText = 'Nenhum cavalo encontrado';
        if(document.getElementById('tempoCarregamento')) document.getElementById('tempoCarregamento').innerText = '0 h';
        
        if(document.getElementById('mediaVolumeViagem')) {
            const el = document.getElementById('mediaVolumeViagem');
            el.className = "text-3xl font-extrabold text-white m-0 transition-all";
            el.innerHTML = '0 m³';
            const sub = el.parentElement.nextElementSibling;
            if(sub) { sub.innerText = "Caixa de Carga"; sub.className = "mt-auto pt-3 border-t border-slate-700/50 text-[10px] font-bold text-slate-500 uppercase tracking-widest"; }
        }
        if(document.getElementById('totalVolumeReal')) {
            const el = document.getElementById('totalVolumeReal');
            el.className = "text-3xl font-extrabold text-white m-0 transition-all";
            el.innerHTML = '0 m³';
            const sub = el.parentElement.nextElementSibling;
            if(sub) { sub.innerText = "Acumulado Período"; sub.className = "mt-auto pt-3 border-t border-slate-700/50 text-[10px] font-bold text-slate-500 uppercase tracking-widest"; }
        }

        renderizarTabelaComparativo([]); 
        
        if(chartCiclo) chartCiclo.destroy();
        if(chartTransp) chartTransp.destroy();
        return;
    }

    let codesPropria = [];
    if (configGruasObj && configGruasObj.length > 0) {
        configGruasObj.forEach(item => {
            if(item.tipo_frente === 'Propria' || item.tipo_frente === 'Própria') {
                const codes = (item.codigos || '').split(',').map(c => c.trim().toUpperCase().replace(/\s+/g, '')).filter(Boolean);
                codesPropria.push(...codes);
            }
        });
    }
    
    let transpPropriaConfig = 'SERRANALOG';
    if (metasGlobaisObj && metasGlobaisObj.transp_propria) {
        transpPropriaConfig = metasGlobaisObj.transp_propria.toUpperCase();
    }

    function isViagemPropriaDashboard(d) {
        const transp = String(d.transportadora || '').trim().toUpperCase();
        return transp.includes(transpPropriaConfig) || transp === transpPropriaConfig;
    }

    let cardsData = filteredData;
    
    if (activeT === 'ALL') {
        cardsData = filteredData.filter(d => isViagemPropriaDashboard(d));
        if(document.getElementById('dbStatusLabel')) {
            document.getElementById('dbStatusLabel').innerHTML = `<i class="fas fa-database text-sky-500 mr-1"></i> Geral: ${filteredData.length} Vg | Próprias: ${cardsData.length} Vg`;
        }
    } else {
        if(document.getElementById('dbStatusLabel')) {
            document.getElementById('dbStatusLabel').innerText = `${filteredData.length} Viagens`;
        }
    }

    const totalViagens = cardsData.length;
    
    let diasConsideradosCalc = 1;
    let mediaAtivosReal = 0;
    let metaViagensCalculada = 0;
    const elMetaTexto = document.getElementById('metaViagensText');
    const elIconeMeta = document.getElementById('iconeMetaViagens');

    if (elMetaTexto && frotasParaMeta && osParaMeta) {

        let dataInicioCalc = new Date(); dataInicioCalc.setHours(0,0,0,0);
        let dataFimCalc = new Date(); dataFimCalc.setHours(23,59,59,999);
        const hjCalc = new Date(); hjCalc.setHours(0,0,0,0);

        if (activeInicio || activeFim) {
            if(activeInicio) { const p = activeInicio.split('-'); dataInicioCalc = new Date(p[0], p[1]-1, p[2], 0,0,0); }
            if(activeFim) { const p = activeFim.split('-'); dataFimCalc = new Date(p[0], p[1]-1, p[2], 23,59,59,999); }
            diasConsideradosCalc = Math.max(1, Math.ceil((dataFimCalc - dataInicioCalc) / 86400000));
        } else if (activeM !== 'ALL') {
            const p = activeM.split('/');
            let ano = parseInt(p[1]); if(ano < 100) ano += 2000;
            let mes = parseInt(p[0]) - 1;
            dataInicioCalc = new Date(ano, mes, 1, 0,0,0);
            dataFimCalc = new Date(ano, mes + 1, 0, 23,59,59,999);
            if (dataInicioCalc.getFullYear() === hjCalc.getFullYear() && dataInicioCalc.getMonth() === hjCalc.getMonth()) {
                dataFimCalc = new Date(); dataFimCalc.setDate(hjCalc.getDate() - 1); dataFimCalc.setHours(23,59,59,999);
            }
            diasConsideradosCalc = Math.max(1, Math.ceil((dataFimCalc - dataInicioCalc) / 86400000));
        } else if (activeQuickFilter !== 'ALL') {
            if (activeQuickFilter === 'D-1') { dataInicioCalc.setDate(hjCalc.getDate() - 1); dataFimCalc = new Date(dataInicioCalc); dataFimCalc.setHours(23,59,59,999); diasConsideradosCalc = 1; }
            else if (activeQuickFilter === 'D-2') { dataInicioCalc.setDate(hjCalc.getDate() - 2); dataFimCalc = new Date(dataInicioCalc); dataFimCalc.setHours(23,59,59,999); diasConsideradosCalc = 1; }
            else if (activeQuickFilter === 'D-7') { dataInicioCalc.setDate(hjCalc.getDate() - 7); dataFimCalc = new Date(hjCalc); dataFimCalc.setDate(hjCalc.getDate() - 1); dataFimCalc.setHours(23,59,59,999); diasConsideradosCalc = 7; }
            else if (activeQuickFilter === 'D-30') { dataInicioCalc.setDate(hjCalc.getDate() - 30); dataFimCalc = new Date(hjCalc); dataFimCalc.setDate(hjCalc.getDate() - 1); dataFimCalc.setHours(23,59,59,999); diasConsideradosCalc = 30; }
            else if (activeQuickFilter === 'SEM') { dataInicioCalc.setDate(hjCalc.getDate() - hjCalc.getDay()); dataFimCalc = new Date(hjCalc); dataFimCalc.setDate(hjCalc.getDate() - 1); dataFimCalc.setHours(23,59,59,999); diasConsideradosCalc = Math.max(1, hjCalc.getDay()); }
        } else if (activeD !== 'ALL') {
            const parsed = parseDateTime(activeD, null);
            if (parsed) { dataInicioCalc = new Date(parsed); dataFimCalc = new Date(parsed); dataFimCalc.setHours(23,59,59,999); diasConsideradosCalc = 1; }
        } else {
            if (filteredData.length > 0) {
                const datasSort = filteredData.map(d => parseDateTime(d.dataDaBaseExcel, null)).filter(Boolean).sort((a,b) => a-b);
                if (datasSort.length > 0) {
                    dataInicioCalc = datasSort[0]; dataFimCalc = datasSort[datasSort.length - 1]; dataFimCalc.setHours(23,59,59,999);
                    diasConsideradosCalc = Math.max(1, Math.ceil((dataFimCalc - dataInicioCalc) / 86400000));
                }
            }
        }

        // =========================================================================
        // REPLICA EXATA DA "DISPONIBILIDADE HORÁRIA" (HORA A HORA TETO 24H)
        // Utiliza exatamente `o.placa === frota.cavalo` e soma os registros pontuais
        // =========================================================================
        let somaDisponibilidadeHoraria = 0;
        let horasContadas = 0;
        let totalMetaCalculadaExata = 0;

        const agora = new Date();

        for (let d = 0; d < diasConsideradosCalc; d++) {
            let currentDay = new Date(dataInicioCalc);
            currentDay.setDate(currentDay.getDate() + d);
            
            let ehHoje = (currentDay.getDate() === agora.getDate() && 
                          currentDay.getMonth() === agora.getMonth() && 
                          currentDay.getFullYear() === agora.getFullYear());
                          
            let horaLimite = ehHoje ? agora.getHours() : 23;

            for (let i = 0; i <= horaLimite; i++) {
                const inicioHora = new Date(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate(), i, 0, 0, 0);
                const fimHora = new Date(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate(), i, 59, 59, 999);
                
                let qtdFrotaAtivaHora = 0;
                let qtdEmManutencao = 0;
                let qtdEmSOS = 0;
                
                frotasParaMeta.forEach(frota => {
                    if(frota.status !== 'Ativo' || !frota.categoria) return;
                    const cat = frota.categoria.toUpperCase();
                    if(cat !== 'TRITREM') return;
                    
                    let frotaInicioStr = frota.data_inicial ? frota.data_inicial : '2026-04-01';
                    let dtEntradaVeiculo = new Date(frotaInicioStr + 'T00:00:00');
                    if (dtEntradaVeiculo > fimHora) return; 
                    
                    let teveManutencaoComum = false;
                    let teveSOS = false;

                    // O SEGREDO ESTAVA AQUI: A filtragem na outra tela é "o.placa === frota.cavalo"
                    const todasOSCavalo = osParaMeta.filter(o => o.placa === frota.cavalo && o.tipo !== 'Cavalo Disponível S/ Carreta');
                    
                    todasOSCavalo.forEach(os => {
                        const osInicio = corrigirDataSupabaseLocal(os.data_abertura);
                        if (!osInicio) return;
                        
                        let osFim = os.data_conclusao ? corrigirDataSupabaseLocal(os.data_conclusao) : agora;
                        
                        let inicioValido = osInicio > dtEntradaVeiculo ? osInicio : dtEntradaVeiculo;
                        const overlapInicio = inicioValido > inicioHora ? inicioValido : inicioHora;
                        const overlapFim = osFim < fimHora ? osFim : fimHora;

                        if (overlapInicio < overlapFim && os.status !== 'Agendada') {
                            const tipoOS = (os.tipo || os.tipo_manutencao || '').toUpperCase();
                            const descOS = (os.descricao || '').toUpperCase();
                            const prioridadeOS = (os.prioridade || '').toUpperCase();

                            if (
                                tipoOS.includes('S.O.S') || tipoOS.includes('SOS') || tipoOS.includes('SOCORRO') ||
                                descOS.includes('S.O.S') || descOS.includes('SOS') || descOS.includes('SOCORRO') ||
                                prioridadeOS.includes('EMERGÊNCIA')
                            ) {
                                teveSOS = true;
                            } else {
                                teveManutencaoComum = true;
                            }
                        }
                    });

                    if (cat === 'TRITREM') {
                        qtdFrotaAtivaHora++;
                        if (teveSOS) {
                            qtdEmSOS++;
                        } else if (teveManutencaoComum) {
                            qtdEmManutencao++;
                        } else {
                            let metaDiariaVeiculo = 2;
                            if (frota.meta !== null && frota.meta !== undefined && frota.meta !== '') {
                                let parsedMeta = parseFloat(frota.meta);
                                if (!isNaN(parsedMeta) && parsedMeta > 0) metaDiariaVeiculo = parsedMeta;
                            }
                            totalMetaCalculadaExata += (metaDiariaVeiculo / 24);
                        }
                    }
                });

                let qtdAtivos = qtdFrotaAtivaHora - qtdEmManutencao - qtdEmSOS;
                if (qtdAtivos < 0) qtdAtivos = 0;

                somaDisponibilidadeHoraria += qtdAtivos;
                horasContadas++;
            }
        }

        // Teto exato da matemática do gráfico da segunda tela
        mediaAtivosReal = Math.ceil(somaDisponibilidadeHoraria / (horasContadas > 0 ? horasContadas : 1));
        
        let configTPropria = transpPropriaConfig ? transpPropriaConfig : 'SERRANALOG';
        if (activeT === 'ALL' || activeT.toUpperCase().includes(configTPropria)) {
            metaViagensCalculada = Math.round(totalMetaCalculadaExata);
            
            elMetaTexto.innerHTML = `Disp: <b class="text-emerald-400">${mediaAtivosReal}</b> carros (DM) | Meta Total: <b class="text-sky-400">${metaViagensCalculada}</b> viag.`;
            elMetaTexto.classList.remove('hidden');
            
            let elTotalViagens = document.getElementById('totalViagens');
            if (metaViagensCalculada > 0) {
                if (totalViagens >= metaViagensCalculada) {
                    if(elTotalViagens) elTotalViagens.className = "text-3xl font-extrabold text-emerald-400 m-0 transition-all";
                    if(elIconeMeta) elIconeMeta.innerHTML = '<i class="fas fa-check-circle text-emerald-400 text-xl drop-shadow-md" title="Meta Atingida"></i>';
                } else {
                    if(elTotalViagens) elTotalViagens.className = "text-3xl font-extrabold text-rose-500 m-0 transition-all";
                    if(elIconeMeta) elIconeMeta.innerHTML = '<i class="fas fa-exclamation-circle text-rose-500 text-xl drop-shadow-md" title="Abaixo da Meta"></i>';
                }
            } else {
                if(elIconeMeta) elIconeMeta.innerHTML = '';
                if(elTotalViagens) elTotalViagens.className = "text-3xl font-extrabold text-white m-0 transition-all";
            }

        } else {
            elMetaTexto.classList.add('hidden');
            if(elIconeMeta) elIconeMeta.innerHTML = '';
            let elTotalViagens = document.getElementById('totalViagens');
            if(elTotalViagens) elTotalViagens.className = "text-3xl font-extrabold text-white m-0 transition-all";
        }

    } else {
        if(elMetaTexto) elMetaTexto.classList.add('hidden');
        if(elIconeMeta) elIconeMeta.innerHTML = '';
        let elTotalViagens = document.getElementById('totalViagens');
        if(elTotalViagens) elTotalViagens.className = "text-3xl font-extrabold text-white m-0 transition-all";
    }

    if(document.getElementById('totalViagens')) document.getElementById('totalViagens').innerText = totalViagens.toLocaleString('pt-PT');

    // =========================================================================================
    // CÁLCULOS PRINCIPAIS - RPV E PBTC (COM REGRAS DE SLA DO CONTRATO)
    // =========================================================================================
    
    const totalPesoKg = cardsData.reduce((sum, r) => sum + (r.peso_na_entrada || 0), 0);
    const mediaPBTC = totalViagens > 0 ? (totalPesoKg / 1000) / totalViagens : 0;
    
    const validRpv = cardsData.filter(d => d.rpv !== null && d.rpv > 0);
    const mediaRPV = validRpv.length > 0 ? validRpv.reduce((sum, r) => sum + r.rpv, 0) / validRpv.length : 0;

    let reqPbtc = 74.0;
    if (mediaRPV <= 700 && mediaRPV > 0) reqPbtc = 71.0;
    else if (mediaRPV > 700 && mediaRPV < 800) reqPbtc = 73.0;
    else reqPbtc = 74.0;

    let slaAtendido = (mediaPBTC >= reqPbtc);

    const elRpv = document.getElementById('mediaRPV');
    if (elRpv) {
        let rpvStr = mediaRPV > 0 ? mediaRPV.toLocaleString('pt-PT', {maximumFractionDigits: 2}) : "0";
        const pSub = elRpv.parentElement.nextElementSibling;
        
        if (mediaRPV > 0) {
            if (slaAtendido) {
                elRpv.className = "text-3xl font-extrabold text-emerald-400 m-0 transition-all drop-shadow-md";
                elRpv.innerHTML = `${rpvStr} <i class="fas fa-check-circle text-[20px] ml-2" title="SLA Atendido (PBTC >= ${reqPbtc}t)"></i>`;
                if(pSub) {
                    pSub.innerText = `SLA OK (Alvo PBTC: ${reqPbtc}t)`;
                    pSub.className = "mt-auto pt-3 border-t border-slate-700/50 text-[10px] font-bold text-emerald-500 uppercase tracking-widest";
                }
            } else {
                elRpv.className = "text-3xl font-extrabold text-rose-500 m-0 transition-all drop-shadow-md";
                elRpv.innerHTML = `${rpvStr} <i class="fas fa-exclamation-circle text-[20px] ml-2" title="SLA Não Atendido (Faltou PBTC >= ${reqPbtc}t)"></i>`;
                if(pSub) {
                    pSub.innerText = `SLA PENDENTE (Falta PBTC: ${reqPbtc}t)`;
                    pSub.className = "mt-auto pt-3 border-t border-slate-700/50 text-[10px] font-bold text-rose-500 uppercase tracking-widest";
                }
            }
        } else {
            elRpv.className = "text-3xl font-extrabold text-white m-0 transition-all";
            elRpv.innerText = "0";
            if(pSub) {
                pSub.innerText = "kg / m³";
                pSub.className = "mt-auto pt-3 border-t border-slate-700/50 text-[10px] font-bold text-slate-500 uppercase tracking-widest";
            }
        }
    }

    let pbtcCor = "text-white";
    let pbtcIcone = "";
    
    if (mediaPBTC > 0) {
        if (mediaPBTC < reqPbtc) { 
            pbtcCor = "text-rose-500"; 
            pbtcIcone = `<i class="fas fa-exclamation-circle text-rose-500 text-sm ml-2" title="Abaixo da Meta SLA (${reqPbtc}t)"></i>`; 
        }
        else if (mediaPBTC >= reqPbtc && mediaPBTC <= 77.7) { 
            pbtcCor = "text-emerald-400"; 
            pbtcIcone = `<i class="fas fa-check-circle text-emerald-400 text-sm ml-2" title="Dentro do SLA (${reqPbtc}t)"></i>`; 
        }
        else if (mediaPBTC > 77.7) { 
            pbtcCor = "text-amber-500"; 
            pbtcIcone = '<i class="fas fa-exclamation-triangle text-amber-500 text-sm ml-2" title="Acima da Tolerância Legal"></i>'; 
        }
    }

    if(document.getElementById('totalPesoLiq')) document.getElementById('totalPesoLiq').innerHTML = `<span class="${pbtcCor}">${mediaPBTC.toLocaleString('pt-PT', {maximumFractionDigits: 1})} t</span>${pbtcIcone}`;
    
    // =========================================================================================

    const totalVolumeReal = cardsData.reduce((sum, r) => sum + (parseFloat(String(r.volumeReal).replace(',','.')) || 0), 0);
    const mediaVolume = totalViagens > 0 ? totalVolumeReal / totalViagens : 0;

    const mediaAsfalto = totalViagens > 0 ? cardsData.reduce((sum, r) => sum + (r.distanciaAsfalto||0), 0) / totalViagens : 0;
    const mediaTerra = totalViagens > 0 ? cardsData.reduce((sum, r) => sum + (r.distanciaTerra||0), 0) / totalViagens : 0;
    const mediaDistTotal = mediaAsfalto + mediaTerra;

    const validCycles = cardsData.filter(d => d.cicloHoras !== null && d.cicloHoras > 0);
    const somaCiclosTotais = validCycles.reduce((s, d) => s + d.cicloHoras, 0);
    const mediaCiclo = validCycles.length > 0 ? somaCiclosTotais / validCycles.length : 0;
    
    const validFilaCampo = cardsData.filter(d => d.filaCampoHoras !== null && d.filaCampoHoras > 0);
    const mediaFilaCampo = validFilaCampo.length > 0 ? validFilaCampo.reduce((s, d) => s + d.filaCampoHoras, 0) / validFilaCampo.length : 0;

    const validTempoCarregamento = cardsData.filter(d => d.tempoCarregamentoHoras !== null && d.tempoCarregamentoHoras > 0);
    const mediaTempoCarregamento = validTempoCarregamento.length > 0 ? validTempoCarregamento.reduce((s, d) => s + d.tempoCarregamentoHoras, 0) / validTempoCarregamento.length : 0;
    
    const validFilaFabrica = cardsData.filter(d => d.filaFabricaHoras !== null && d.filaFabricaHoras > 0);
    const mediaFilaFabrica = validFilaFabrica.length > 0 ? validFilaFabrica.reduce((s, d) => s + d.filaFabricaHoras, 0) / validFilaFabrica.length : 0;

    const produtividadeGlobalM3 = somaCiclosTotais > 0 ? (totalVolumeReal / somaCiclosTotais) : 0;
    
    let metaCaixaFinal = (metasGlobaisObj && metasGlobaisObj.cx_prog) ? parseFloat(metasGlobaisObj.cx_prog) : 48;
    
    let metaVolumeCalculada = 0;
    if (metasGlobaisObj && metasGlobaisObj.vol_prog > 0) {
        metaVolumeCalculada = metasGlobaisObj.vol_prog * diasConsideradosCalc; 
    } else if (metaViagensCalculada > 0) {
        metaVolumeCalculada = metaViagensCalculada * metaCaixaFinal; 
    } else {
        metaVolumeCalculada = (50 * 2 * diasConsideradosCalc) * metaCaixaFinal; 
    }

    let elMediaVol = document.getElementById('mediaVolumeViagem');
    if (elMediaVol) {
        if (metaCaixaFinal > 0) {
            if (mediaVolume >= metaCaixaFinal) {
                elMediaVol.className = "text-3xl font-extrabold text-emerald-400 m-0 transition-all drop-shadow-md";
                elMediaVol.innerHTML = `${mediaVolume.toLocaleString('pt-PT', {maximumFractionDigits: 1})} m³ <i class="fas fa-check-circle text-[20px] ml-2" title="Meta Atendida (>= ${metaCaixaFinal} m³)"></i>`;
                const subMedia = elMediaVol.parentElement.nextElementSibling;
                if(subMedia) {
                    subMedia.innerText = `Meta: ${metaCaixaFinal} m³`;
                    subMedia.className = "mt-auto pt-3 border-t border-slate-700/50 text-[10px] font-bold text-emerald-500 uppercase tracking-widest";
                }
            } else {
                elMediaVol.className = "text-3xl font-extrabold text-rose-500 m-0 transition-all drop-shadow-md";
                elMediaVol.innerHTML = `${mediaVolume.toLocaleString('pt-PT', {maximumFractionDigits: 1})} m³ <i class="fas fa-exclamation-circle text-[20px] ml-2" title="Abaixo da Meta"></i>`;
                const subMedia = elMediaVol.parentElement.nextElementSibling;
                if(subMedia) {
                    subMedia.innerText = `Meta: ${metaCaixaFinal} m³`;
                    subMedia.className = "mt-auto pt-3 border-t border-slate-700/50 text-[10px] font-bold text-rose-500 uppercase tracking-widest";
                }
            }
        } else {
            elMediaVol.className = "text-3xl font-extrabold text-white m-0 transition-all";
            elMediaVol.innerText = mediaVolume.toLocaleString('pt-PT', {maximumFractionDigits: 1}) + " m³";
        }
    }

    let elTotalVol = document.getElementById('totalVolumeReal');
    if (elTotalVol) {
        if (metaVolumeCalculada > 0) {
            if (totalVolumeReal >= metaVolumeCalculada) {
                elTotalVol.className = "text-3xl font-extrabold text-emerald-400 m-0 transition-all drop-shadow-md";
                elTotalVol.innerHTML = `${totalVolumeReal.toLocaleString('pt-PT', {maximumFractionDigits: 1})} m³ <i class="fas fa-check-circle text-[20px] ml-2" title="Meta Atendida (>= ${metaVolumeCalculada.toLocaleString('pt-PT')} m³)"></i>`;
                const subTotal = elTotalVol.parentElement.nextElementSibling;
                if(subTotal) {
                    subTotal.innerHTML = `Meta: <b class="text-emerald-400">${metaVolumeCalculada.toLocaleString('pt-PT')} m³</b>`;
                    subTotal.className = "mt-auto pt-3 border-t border-slate-700/50 text-[10px] font-bold text-emerald-500 uppercase tracking-widest";
                }
            } else {
                elTotalVol.className = "text-3xl font-extrabold text-rose-500 m-0 transition-all drop-shadow-md";
                elTotalVol.innerHTML = `${totalVolumeReal.toLocaleString('pt-PT', {maximumFractionDigits: 1})} m³ <i class="fas fa-exclamation-circle text-[20px] ml-2" title="Abaixo da Meta"></i>`;
                const subTotal = elTotalVol.parentElement.nextElementSibling;
                if(subTotal) {
                    subTotal.innerHTML = `Meta: <b class="text-rose-500">${metaVolumeCalculada.toLocaleString('pt-PT')} m³</b>`;
                    subTotal.className = "mt-auto pt-3 border-t border-slate-700/50 text-[10px] font-bold text-rose-500 uppercase tracking-widest";
                }
            }
        } else {
            elTotalVol.className = "text-3xl font-extrabold text-white m-0 transition-all";
            elTotalVol.innerText = totalVolumeReal.toLocaleString('pt-PT', {maximumFractionDigits: 1}) + " m³";
        }
    }

    if(document.getElementById('mediaDistancia')) document.getElementById('mediaDistancia').innerText = mediaDistTotal.toLocaleString('pt-PT', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + " km";
    if(document.getElementById('mediaAsfalto')) document.getElementById('mediaAsfalto').innerText = mediaAsfalto.toLocaleString('pt-PT', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    if(document.getElementById('mediaTerra')) document.getElementById('mediaTerra').innerText = mediaTerra.toLocaleString('pt-PT', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    
    atualizarElementoTempo('cicloMedio', mediaCiclo, metasGlobaisObj ? metasGlobaisObj.meta_ciclo : 0);
    atualizarElementoTempo('filaCampo', mediaFilaCampo, metasGlobaisObj ? metasGlobaisObj.meta_fila_campo : 0);
    atualizarElementoTempo('tempoCarregamento', mediaTempoCarregamento, metasGlobaisObj ? metasGlobaisObj.meta_carga : 0);
    atualizarElementoTempo('filaFabrica', mediaFilaFabrica, metasGlobaisObj ? metasGlobaisObj.meta_fila_fabrica : 0);
    
    if(document.getElementById('produtividadeGlobal')) document.getElementById('produtividadeGlobal').innerText = produtividadeGlobalM3.toLocaleString('pt-PT', {maximumFractionDigits: 2});

    const somaFilas = cardsData.reduce((s, d) => s + (d.filaCampoHoras || 0) + (d.filaFabricaHoras || 0), 0);
    const taxaOciosidade = somaCiclosTotais > 0 ? (somaFilas / somaCiclosTotais) * 100 : 0;
    if(document.getElementById('ociosidadeGlobal')) document.getElementById('ociosidadeGlobal').innerText = taxaOciosidade.toLocaleString('pt-PT', {maximumFractionDigits: 1}) + '%';

    const mapaPlacas = new Map();
    validCycles.forEach(d => {
        const placaFormatada = (d.placa && d.placa.trim() !== '-' && d.placa.trim() !== '') ? d.placa.trim().toUpperCase() : 'DESCONHECIDA';
        if (placaFormatada === 'DESCONHECIDA') return;

        if (!mapaPlacas.has(placaFormatada)) mapaPlacas.set(placaFormatada, { volumeAcumulado: 0, ciclosAcumulados: 0 });
        
        const p = mapaPlacas.get(placaFormatada);
        p.volumeAcumulado += parseFloat(String(d.volumeReal).replace(',','.')) || 0;
        p.ciclosAcumulados += d.cicloHoras;
    });

    let melhorPlacaNome = "---", melhorPlacaProdutividade = 0;
    mapaPlacas.forEach((dados, placa) => {
        if (dados.ciclosAcumulados > 0.5) {
            const prod = dados.volumeAcumulado / dados.ciclosAcumulados;
            if (prod > melhorPlacaProdutividade) { melhorPlacaProdutividade = prod; melhorPlacaNome = placa; }
        }
    });
    
    if(document.getElementById('bestPlacaValue')) document.getElementById('bestPlacaValue').innerText = melhorPlacaProdutividade > 0 ? melhorPlacaProdutividade.toLocaleString('pt-PT', {maximumFractionDigits: 1}) : "0.0";
    if(document.getElementById('bestPlacaName')) document.getElementById('bestPlacaName').innerText = `Placa: ${melhorPlacaNome}`;

    renderizarTabelaComparativo(filteredData);

    const transpCount = new Map();
    const transpCicloSum = new Map();
    const transpCicloCount = new Map();

    filteredData.forEach(d => {
        const nome = d.transportadora || "Outras";
        transpCount.set(nome, (transpCount.get(nome) || 0) + 1);
        
        if (d.cicloHoras !== null && d.cicloHoras > 0) {
            transpCicloSum.set(nome, (transpCicloSum.get(nome) || 0) + d.cicloHoras);
            transpCicloCount.set(nome, (transpCicloCount.get(nome) || 0) + 1);
        }
    });

    const topParaBarras = Array.from(transpCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const labelsBarras = topParaBarras.map(t => t[0].length > 18 ? t[0].substring(0, 16) + "..." : t[0]);
    const cicloMedioPorTransp = topParaBarras.map(([nome]) => {
        const count = transpCicloCount.get(nome) || 0;
        return count > 0 ? parseFloat((transpCicloSum.get(nome) / count).toFixed(1)) : 0;
    });

    const topParaDonut = Array.from(transpCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const labelsDonut = topParaDonut.map(t => t[0].length > 18 ? t[0].substring(0, 16) + "..." : t[0]);
    const valoresDonut = topParaDonut.map(t => t[1]);

    if (chartCiclo) chartCiclo.destroy();
    if (chartTransp) chartTransp.destroy();

    const ctxCiclo = document.getElementById('cicloChart');
    if(ctxCiclo) {
        const ctxC = ctxCiclo.getContext('2d');
        let gradientBar = ctxC.createLinearGradient(0, 0, 0, 400);
        gradientBar.addColorStop(0, '#38bdf8'); gradientBar.addColorStop(1, '#0284c7'); 

        chartCiclo = new Chart(ctxC, {
            type: 'bar',
            data: { labels: labelsBarras, datasets: [{ label: 'Ciclo (h)', data: cicloMedioPorTransp, backgroundColor: gradientBar, borderRadius: 6, barPercentage: 0.6 }] },
            options: {
                responsive: true, maintainAspectRatio: true, layout: { padding: { top: 30 } },
                plugins: { legend: { display: false }, datalabels: { color: '#bae6fd', anchor: 'end', align: 'top', font: { weight: 'bold', size: 11 }, formatter: (v) => v > 0 ? formatarHorasMinutos(v) : '-' } },
                scales: { y: { beginAtZero: true }, x: { ticks: { font: { size: 10 } } } }
            }
        });
    }

    const ctxTransp = document.getElementById('transportadorasChart');
    if(ctxTransp) {
        const ctxT = ctxTransp.getContext('2d');
        chartTransp = new Chart(ctxT, {
            type: 'doughnut',
            data: { labels: labelsDonut, datasets: [{ data: valoresDonut, backgroundColor: ['#0ea5e9', '#06b6d4', '#6366f1', '#8b5cf6', '#3b82f6'], borderWidth: 2, borderColor: '#1e293b' }] },
            plugins: [centerTextPlugin],
            options: {
                responsive: true, maintainAspectRatio: true, cutout: '70%', layout: { padding: 20 },
                plugins: { legend: { position: 'right', labels: { font: { size: 11, family: "'Inter', sans-serif" } } }, datalabels: { color: '#f8fafc', anchor: 'end', align: 'end', offset: 4, font: { weight: 'bold', size: 12 } } }
            }
        });
    }
}