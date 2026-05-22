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

let activeQuickFilter = 'ALL';
let chartCiclo = null, chartTransp = null;

let osParaMeta = [];
let frotasParaMeta = [];
const supabaseClientMan = window.supabase.createClient('https://ihgiyxzxdldqmrkziijl.supabase.co', 'sb_publishable_JpMZhW5ZrFKBr7m9KXBkoQ_cpxy1k3x');

const filterTransportadora = document.getElementById('filterTransportadora');
const filterData = document.getElementById('filterData');
const filterMes = document.getElementById('filterMes');
const filterDataInicio = document.getElementById('filterDataInicio');
const filterDataFim = document.getElementById('filterDataFim');
const btnQFs = document.querySelectorAll('.btn-qf');

document.addEventListener('DOMContentLoaded', () => {
    setupDashboardFilters();
    loadDashboardDataInit();

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
});

// --- NOVA REGRA DO CICLO MÉDIO (VERSÃO BLINDADA) ---
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
// ---------------------------------

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
    
    if (!metaData || metaData <= 0) {
        el.innerText = strReal;
        return;
    }
    const strMeta = formatarHorasMinutos(metaData);

    let corClasse = "text-white";
    let icone = "";

    if (mediaReal > metaData) {
        corClasse = "text-rose-500";
        icone = `<i class="fas fa-exclamation-circle text-rose-500 text-sm ml-2" title="Acima da meta"></i>`;
    } else {
        corClasse = "text-emerald-400";
        icone = `<i class="fas fa-check-circle text-emerald-400 text-sm ml-2" title="Dentro da meta"></i>`;
    }

    el.innerHTML = `
        <span class="${corClasse}">${strReal}</span>${icone}
        <div class="text-[12px] text-slate-400 font-bold uppercase mt-4 pt-2 border-t border-slate-700/50 tracking-wider">
            Padrão: <span class="text-slate-200 text-[15px] font-black ml-1">${strMeta}</span>
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
};

async function loadDashboardDataInit() {
    try {
        const [osResp, frotasResp] = await Promise.all([
            supabaseClientMan.from('ordens_servico').select('*'),
            supabaseClientMan.from('frotas_manutencao').select('*')
        ]);
        if (osResp.data) osParaMeta = osResp.data;
        if (frotasResp.data) frotasParaMeta = frotasResp.data;
    } catch (e) { console.error("Erro ao puxar dados da manutenção:", e); }

    try {
        const { data: metasData } = await supabaseClient.from('metas_globais').select('*').eq('id', 1).single();
        if (metasData) {
            metasGlobaisObj = metasData;
        }
    } catch(e) {
        console.error("Erro ao puxar metas globais no dashboard:", e);
    }

    try {
        const { data: gruasData } = await supabaseClient.from('config_gruas').select('*');
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

    while (fetchMore) {
        const { data, error } = await supabaseClient
            .from('historico_viagens')
            .select('*')
            .range(from, from + step - 1);
            
        if (error) {
            console.error(error);
            break;
        }
        
        if (data && data.length > 0) {
            allData = allData.concat(data);
            from += step;
        }
        
        if (!data || data.length < step) {
            fetchMore = false;
        }
    }

    if(allData.length > 0) {
        fullHistoricoData = allData;
        normalizarCiclos(fullHistoricoData);
        loadDashboardData();
    }
}

function calcStats(dataArr) {
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

function loadDashboardData() {
    const storedData = fullHistoricoData;
    if(!storedData.length) return;

    // Popula Transportadoras
    const allTransps = [...new Set(storedData.map(d => d.transportadora))].filter(Boolean).sort();
    const currT = filterTransportadora ? filterTransportadora.value : 'ALL';
    if (filterTransportadora) {
        filterTransportadora.innerHTML = '<option value="ALL">TODAS AS TRANSPORTADORAS</option>';
        allTransps.forEach(t => filterTransportadora.insertAdjacentHTML('beforeend', `<option value="${t}" ${t===currT?'selected':''}>${t}</option>`));
    }

    // Popula Dias
    const allDates = [...new Set(storedData.map(d => d.dataDaBaseExcel))].filter(d => d && d !== 'Desconhecida').sort((a,b)=>{const pA=a.split('/');const pB=b.split('/');return new Date(pA[2],pA[1]-1,pA[0])-new Date(pB[2],pB[1]-1,pB[0]);});
    const currD = filterData ? filterData.value : 'ALL';
    if (filterData) {
        filterData.innerHTML = '<option value="ALL">TODO O PERÍODO</option>';
        allDates.forEach(dt => filterData.insertAdjacentHTML('beforeend', `<option value="${dt}" ${dt===currD?'selected':''}>${dt}</option>`));
    }

    // Popula Meses
    let currM = filterMes ? filterMes.value : 'ALL';
    if (!window.dashMesInicializado && filterMes) {
        const hj = new Date();
        const mesAtualStr = String(hj.getMonth() + 1).padStart(2, '0') + '/' + hj.getFullYear();
        currM = mesAtualStr;
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
    
    // Filtros Globais
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
        if(document.getElementById('dbStatusLabel')) document.getElementById('dbStatusLabel').innerText = "Sem dados para o filtro";
        if(document.getElementById('totalViagens')) document.getElementById('totalViagens').innerText = '0';
        if(document.getElementById('totalPesoLiq')) document.getElementById('totalPesoLiq').innerHTML = '<span class="text-white">0 t</span>';
        if(document.getElementById('produtividadeGlobal')) document.getElementById('produtividadeGlobal').innerText = '0.0';
        if(document.getElementById('ociosidadeGlobal')) document.getElementById('ociosidadeGlobal').innerText = '0%';
        if(document.getElementById('bestPlacaValue')) document.getElementById('bestPlacaValue').innerText = '0.0';
        if(document.getElementById('bestPlacaName')) document.getElementById('bestPlacaName').innerText = 'Nenhum cavalo encontrado';
        if(document.getElementById('tempoCarregamento')) document.getElementById('tempoCarregamento').innerText = '0 h';
        
        if(chartCiclo) chartCiclo.destroy();
        if(chartTransp) chartTransp.destroy();

        const tbodyComp = document.getElementById('comparativoBody');
        if (tbodyComp) tbodyComp.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-slate-500">Sem dados para comparar</td></tr>';

        return;
    }

    // =========================================================================================
    // --- LÓGICA DE IDENTIFICAÇÃO DE GRUAS E TRANSPORTADORAS - TOTALMENTE BLINDADA ---
    // =========================================================================================

    let serranaLoaders = ['GSR0001', 'GSR0002', 'GSR0003', 'GSR0007', 'GSR0008', 'GRB0015', 'GRB0022'];
    let reflorestarLoaders = ['GRB0017', 'GRB0020', 'GRB0029', 'GRB0013', 'GRB0014', 'GRB0028', 'GRB0026', 'GRB0016', 'GRB0012', 'GRB0023', 'GRB0018'];
    let jslLoaders = ['GSL0012', 'GSL0016'];
    
    if (configGruasObj && configGruasObj.length > 0) {
        serranaLoaders = [];
        reflorestarLoaders = [];
        jslLoaders = [];
        
        configGruasObj.forEach(item => {
            const codes = (item.codigos || '').split(',').map(c => c.trim().toUpperCase().replace(/\s+/g, '')).filter(c => c !== '');
            const fName = (item.frente || '').toUpperCase();
            
            if (fName.includes('SERRANA')) {
                serranaLoaders.push(...codes);
            } else if (fName.includes('REFLORESTAR')) {
                reflorestarLoaders.push(...codes);
            } else if (fName.includes('JSL')) {
                jslLoaders.push(...codes);
            }
        });
    }

    // 1) Identifica de quem é a Transportadora
    function isSerranaTransp(d) {
        let valTransp = String(d.transportadora || d['Nome da Transportadora'] || d.nomeTransportadora || '').toUpperCase().replace(/\s+/g, '');
        if (valTransp.includes('SERRANALOG') || valTransp.includes('SERRANA')) return true;

        // Varredura extra em todas as colunas caso a coluna original tenha vindo com nome muito esquisito
        for (let key in d) {
            if (d[key] && typeof d[key] === 'string') {
                let val = d[key].toUpperCase().replace(/\s+/g, '');
                if (val.includes('SERRANALOG') || val.includes('SERRANATRANSPORTES')) {
                    return true;
                }
            }
        }
        return false;
    }

    // 2) Faz a verificação lógica das gruas cruzando com as Regras de Negócio (Sistema blindado)
    function checkLoader(d, loaderArray, prefix = '') {
        let colunasPrioritarias = [];
        let outrasColunas = [];

        for (let key in d) {
            let keyUpper = key.toUpperCase();
            let val = d[key];
            if (val && typeof val === 'string') {
                let vClean = val.trim().toUpperCase().replace(/\s+/g, '');
                if (!vClean || vClean === '-' || vClean === 'N/A' || vClean === '0') continue;

                if (keyUpper.includes('GRUA') || keyUpper.includes('CARREG') || keyUpper.includes('EQUIP') || keyUpper.includes('FRENTE')) {
                    colunasPrioritarias.push(vClean);
                } else {
                    outrasColunas.push(vClean);
                }
            }
        }

        let valoresParaChecar = colunasPrioritarias.length > 0 ? colunasPrioritarias : outrasColunas;

        for (let v of valoresParaChecar) {
            for (let code of loaderArray) {
                let codeClean = code.replace(/\s+/g, '');
                if (v === codeClean || v.includes(codeClean)) {
                    return true;
                }
            }

            if (prefix) {
                if (prefix === 'GSR') {
                    if (v.startsWith('GSR') || v.includes('GSR0')) return true;
                    if (v.includes('GRB0015') || v.includes('GRB0022')) return true; 
                } 
                else if (prefix === 'GRB') {
                    if (v.startsWith('GRB') || v.includes('GRB0')) {
                        if (v.includes('0015') || v.includes('0022')) continue; 
                        return true;
                    }
                } 
                else if (prefix === 'GSL') {
                    if (v.startsWith('GSL') || v.includes('GSL0')) return true;
                }
            }
        }

        return false;
    }
    // =========================================================================================

    // === LÓGICA DE DADOS PARA OS CARDS (INDICADORES INICIAIS) ===
    let cardsData = filteredData;
    
    if (activeT === 'ALL') {
        // Indicadores do topo focados em 100% das viagens transportadas pela Serrana (ignora trava de grua)
        cardsData = filteredData.filter(d => isSerranaTransp(d));
        if(document.getElementById('dbStatusLabel')) {
            document.getElementById('dbStatusLabel').innerHTML = `<i class="fas fa-database text-sky-500 mr-1"></i> Geral: ${filteredData.length} Viagens | Frota Própria: ${cardsData.length} Viagens`;
        }
    } else {
        if(document.getElementById('dbStatusLabel')) {
            document.getElementById('dbStatusLabel').innerText = `${filteredData.length} Viagens`;
        }
    }

    const totalViagens = cardsData.length;
    
    // --- LÓGICA DE CÁLCULO DE DISPONIBILIDADE E METAS (CORRIGIDO PARA A DATA DE ENTRADA DO VEÍCULO) ---
    let diasConsideradosCalc = 1;
    let mediaAtivosReal = 0;
    const elMetaTexto = document.getElementById('metaViagensText');
    const elIconeMeta = document.getElementById('iconeMetaViagens');

    if (elMetaTexto && frotasParaMeta && osParaMeta) {
        const frotasAtivas = frotasParaMeta.filter(f => {
            const st = String(f.status || '').trim().toUpperCase();
            return st === 'ATIVO' || st === 'ATIVA';
        });
        let totalFrota = frotasAtivas.length;

        let dataInicioCalc = new Date(); dataInicioCalc.setHours(0,0,0,0);
        let dataFimCalc = new Date(); dataFimCalc.setHours(23,59,59,999);
        const hjCalc = new Date(); hjCalc.setHours(0,0,0,0);

        // Identifica os dias considerados pelo filtro atual
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

        let msTotalPeriodo = dataFimCalc - dataInicioCalc;
        if (msTotalPeriodo <= 0) msTotalPeriodo = 1;

        // Desconta tempo de oficina e cruza com a Data Inicial do veículo
        let msManutTotal = 0;
        let totalMsDisponivelPeriodo = 0; // Calculado de forma inteligente

        frotasAtivas.forEach(frota => {
            // CORREÇÃO: Respeita a data de entrada (cadastro) do veículo no sistema para não somá-lo na frota global em dias anteriores
            let frotaInicioStr = frota.data_inicial ? frota.data_inicial : '2026-04-01';
            let dtEntradaVeiculo = new Date(frotaInicioStr + 'T00:00:00');

            let overlapDispInicio = dtEntradaVeiculo > dataInicioCalc ? dtEntradaVeiculo : dataInicioCalc;
            if (overlapDispInicio < dataFimCalc) {
                totalMsDisponivelPeriodo += (dataFimCalc - overlapDispInicio);
            }

            const todasOSCavalo = osParaMeta.filter(o => o.placa === frota.cavalo && o.status !== 'Agendada' && o.tipo !== 'Cavalo Disponível S/ Carreta');
            todasOSCavalo.forEach(os => {
                let osInicioStr = os.data_abertura;
                if (!osInicioStr) return;
                if (!osInicioStr.includes('T')) osInicioStr += 'T00:00:00';
                const osInicio = new Date(osInicioStr.replace('Z', '').replace('+00:00', ''));
                
                let osFim = new Date(); 
                if (os.data_conclusao) {
                    let osFimStr = os.data_conclusao;
                    if (!osFimStr.includes('T')) osFimStr += 'T00:00:00';
                    osFim = new Date(osFimStr.replace('Z', '').replace('+00:00', ''));
                }
                
                // CORREÇÃO: Respeita a entrada do veículo também para o histórico de manutenções
                let inicioValido = osInicio > dtEntradaVeiculo ? osInicio : dtEntradaVeiculo;
                const overlapInicio = inicioValido > dataInicioCalc ? inicioValido : dataInicioCalc;
                const overlapFim = osFim < dataFimCalc ? osFim : dataFimCalc;
                if (overlapInicio < overlapFim) { msManutTotal += (overlapFim - overlapInicio); }
            });
        });

        let dispNoPeriodoMs = totalMsDisponivelPeriodo - msManutTotal;
        if (dispNoPeriodoMs < 0) dispNoPeriodoMs = 0;
        
        mediaAtivosReal = Math.round(dispNoPeriodoMs / msTotalPeriodo);

        // Aplica validações no card do DOM
        if (activeT === 'ALL' || activeT.toUpperCase().includes('SERRANALOG')) {
            let metaViagensCalculada = mediaAtivosReal * 2 * diasConsideradosCalc; // Regra de 2 viagens/dia
            
            elMetaTexto.innerHTML = `Disp: <b class="text-emerald-400">${mediaAtivosReal}</b> carros | Meta: <b class="text-sky-400">${metaViagensCalculada}</b>`;
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

    const totalPesoKg = cardsData.reduce((sum, r) => sum + r.pesoLiquido, 0);

    const mediaPBTC = totalViagens > 0 ? (totalPesoKg / 1000) / totalViagens : 0;
    
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
    
    let pbtcCor = "text-white";
    let pbtcIcone = "";
    
    if (mediaPBTC > 0) {
        if (mediaPBTC < 74) {
            pbtcCor = "text-yellow-400";
            pbtcIcone = '<i class="fas fa-exclamation-triangle text-yellow-400 text-sm ml-2" title="Abaixo do ideal"></i>';
        } else if (mediaPBTC >= 74 && mediaPBTC <= 77.7) {
            pbtcCor = "text-green-400";
            pbtcIcone = '<i class="fas fa-check-circle text-green-400 text-sm ml-2" title="Ideal"></i>';
        } else if (mediaPBTC > 77.7) {
            pbtcCor = "text-red-500";
            pbtcIcone = '<i class="fas fa-times-circle text-red-500 text-sm ml-2" title="Acima do ideal"></i>';
        }
    }

    if(document.getElementById('totalPesoLiq')) document.getElementById('totalPesoLiq').innerHTML = `<span class="${pbtcCor}">${mediaPBTC.toLocaleString('pt-PT', {maximumFractionDigits: 1})} t</span>${pbtcIcone}`;
    
    if(document.getElementById('mediaVolumeViagem')) document.getElementById('mediaVolumeViagem').innerText = mediaVolume.toLocaleString('pt-PT', {maximumFractionDigits: 1}) + " m³";
    if(document.getElementById('totalVolumeReal')) document.getElementById('totalVolumeReal').innerText = totalVolumeReal.toLocaleString('pt-PT', {maximumFractionDigits: 1}) + " m³";
    
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

    // === TABELAS COMPARATIVAS E GRÁFICOS ===
    const tbodyComp = document.getElementById('comparativoBody');
    if (tbodyComp) {
        
        // Passando a verificação reestruturada em todas as tabelas
        const dataC1 = filteredData.filter(d => checkLoader(d, serranaLoaders, 'GSR') && isSerranaTransp(d));
        const dataC2 = filteredData.filter(d => checkLoader(d, serranaLoaders, 'GSR') && !isSerranaTransp(d));
        const dataC3 = filteredData.filter(d => checkLoader(d, reflorestarLoaders, 'GRB') && isSerranaTransp(d));
        const dataC4 = filteredData.filter(d => checkLoader(d, jslLoaders, 'GSL') && isSerranaTransp(d));
        
        const stC1 = calcStats(dataC1);
        const stC2 = calcStats(dataC2);
        const stC3 = calcStats(dataC3);
        const stC4 = calcStats(dataC4);
        const stGlobal = calcStats(filteredData);

        tbodyComp.innerHTML = `
            <tr class="hover:bg-slate-800/30 transition-colors">
                <td class="px-6 py-4 font-bold text-white text-sm"><i class="fas fa-route text-slate-400 w-5"></i> Viagens Realizadas</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${dataC1.length}</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${dataC2.length}</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right text-emerald-400">${dataC3.length}</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right text-indigo-400">${dataC4.length}</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${filteredData.length}</td>
            </tr>
            <tr class="hover:bg-slate-800/30 transition-colors">
                <td class="px-6 py-4 font-bold text-white text-sm"><i class="fas fa-box-open text-indigo-400 w-5"></i> Caixa de Carga Média</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${stC1.medVol.toLocaleString('pt-PT',{maximumFractionDigits:1})} m³</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${stC2.medVol.toLocaleString('pt-PT',{maximumFractionDigits:1})} m³</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${stC3.medVol.toLocaleString('pt-PT',{maximumFractionDigits:1})} m³</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${stC4.medVol.toLocaleString('pt-PT',{maximumFractionDigits:1})} m³</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${stGlobal.medVol.toLocaleString('pt-PT',{maximumFractionDigits:1})} m³</td>
            </tr>
            <tr class="hover:bg-slate-800/30 transition-colors">
                <td class="px-6 py-4 font-bold text-white text-sm"><i class="fas fa-cubes text-cyan-400 w-5"></i> Volume Total</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${stC1.volTotal.toLocaleString('pt-PT',{maximumFractionDigits:1})} m³</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${stC2.volTotal.toLocaleString('pt-PT',{maximumFractionDigits:1})} m³</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${stC3.volTotal.toLocaleString('pt-PT',{maximumFractionDigits:1})} m³</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${stC4.volTotal.toLocaleString('pt-PT',{maximumFractionDigits:1})} m³</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${stGlobal.volTotal.toLocaleString('pt-PT',{maximumFractionDigits:1})} m³</td>
            </tr>
            <tr class="hover:bg-slate-800/30 transition-colors">
                <td class="px-6 py-4 font-bold text-white text-sm"><i class="fas fa-stopwatch text-blue-400 w-5"></i> Ciclo Médio Total</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(stC1.medCiclo)}</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(stC2.medCiclo)}</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(stC3.medCiclo)}</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(stC4.medCiclo)}</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(stGlobal.medCiclo)}</td>
            </tr>
            <tr class="hover:bg-slate-800/30 transition-colors border-t border-slate-700/50">
                <td class="px-6 py-4 font-bold text-slate-300 text-xs uppercase tracking-wider"><i class="fas fa-hourglass-half text-amber-500 w-5"></i> Espera Média no Campo</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(stC1.medFilaCpo)}</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(stC2.medFilaCpo)}</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(stC3.medFilaCpo)}</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(stC4.medFilaCpo)}</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(stGlobal.medFilaCpo)}</td>
            </tr>
            <tr class="hover:bg-slate-800/30 transition-colors">
                <td class="px-6 py-4 font-bold text-slate-300 text-xs uppercase tracking-wider"><i class="fas fa-truck-loading text-emerald-500 w-5"></i> Tempo Médio Carregamento</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(stC1.medCarreg)}</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(stC2.medCarreg)}</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(stC3.medCarreg)}</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(stC4.medCarreg)}</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(stGlobal.medCarreg)}</td>
            </tr>
            <tr class="hover:bg-slate-800/30 transition-colors">
                <td class="px-6 py-4 font-bold text-slate-300 text-xs uppercase tracking-wider"><i class="fas fa-industry text-rose-500 w-5"></i> Espera Média na Fábrica</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(stC1.medFilaFab)}</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(stC2.medFilaFab)}</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(stC3.medFilaFab)}</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(stC4.medFilaFab)}</td>
                <td class="px-6 py-4 font-mono text-white text-[15px] font-bold text-right">${formatarHorasMinutos(stGlobal.medFilaFab)}</td>
            </tr>
            <tr class="hover:bg-slate-800/30 transition-colors border-t border-slate-700">
                <td class="px-6 py-4 font-bold text-slate-300 text-xs uppercase tracking-wider"><i class="fas fa-road text-slate-400 w-5"></i> Dist. Média (Asfalto / Terra)</td>
                <td class="px-6 py-4 font-mono text-white text-[13px] font-bold text-right">
                    <span class="text-sky-300" title="Asfalto">Asf: ${stC1.medAsfalto.toLocaleString('pt-PT',{minimumFractionDigits:2, maximumFractionDigits:2})}</span><br>
                    <span class="text-amber-400" title="Terra">Ter: ${stC1.medTerra.toLocaleString('pt-PT',{minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                </td>
                <td class="px-6 py-4 font-mono text-white text-[13px] font-bold text-right">
                    <span class="text-sky-300" title="Asfalto">Asf: ${stC2.medAsfalto.toLocaleString('pt-PT',{minimumFractionDigits:2, maximumFractionDigits:2})}</span><br>
                    <span class="text-amber-400" title="Terra">Ter: ${stC2.medTerra.toLocaleString('pt-PT',{minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                </td>
                <td class="px-6 py-4 font-mono text-white text-[13px] font-bold text-right">
                    <span class="text-sky-300" title="Asfalto">Asf: ${stC3.medAsfalto.toLocaleString('pt-PT',{minimumFractionDigits:2, maximumFractionDigits:2})}</span><br>
                    <span class="text-amber-400" title="Terra">Ter: ${stC3.medTerra.toLocaleString('pt-PT',{minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                </td>
                <td class="px-6 py-4 font-mono text-white text-[13px] font-bold text-right">
                    <span class="text-sky-300" title="Asfalto">Asf: ${stC4.medAsfalto.toLocaleString('pt-PT',{minimumFractionDigits:2, maximumFractionDigits:2})}</span><br>
                    <span class="text-amber-400" title="Terra">Ter: ${stC4.medTerra.toLocaleString('pt-PT',{minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                </td>
                <td class="px-6 py-4 font-mono text-white text-[13px] font-bold text-right">
                    <span class="text-sky-300" title="Asfalto">Asf: ${stGlobal.medAsfalto.toLocaleString('pt-PT',{minimumFractionDigits:2, maximumFractionDigits:2})}</span><br>
                    <span class="text-amber-400" title="Terra">Ter: ${stGlobal.medTerra.toLocaleString('pt-PT',{minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                </td>
            </tr>
        `;
    }

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