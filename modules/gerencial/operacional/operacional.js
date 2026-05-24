// ==========================================
// js/operacional.js - LÓGICA DO PAINEL DE METAS
// ==========================================

if(typeof Chart !== 'undefined') {
    Chart.register(ChartDataLabels);
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';
    Chart.defaults.font.family = "'Inter', sans-serif";
}

var fullHistoricoDataOp = [];
var fullHistoricoManutencao = []; 
var metasGlobais = {};
var activeQuickFilterOp = 'ALL';

var chartCarregamento = null;
var chartTransporte = null; 
var chartManutencao = null; 

var globalTopVol = [];
var globalTopCiclo = [];
var diasConsideradosGlobais = 1;

// Retorna o cliente do Supabase de forma segura
function getSupabaseClient() {
    if (window.supabaseClient) return window.supabaseClient;
    if (typeof supabaseClient !== 'undefined') return supabaseClient;
    console.error("[OPERACIONAL] FATAL: Nenhum cliente Supabase encontrado!");
    return null;
}

// ================= LÓGICA SAAS (MULTI-FILIAL) =================
function aplicarFiltroLocal(query) {
    if (typeof window.aplicarFiltroFilial === 'function') {
        return window.aplicarFiltroFilial(query);
    }
    if (!window.currentUser) return query; 
    if (window.currentUser.filial_id === null && (window.currentUser.role === 'SuperAdmin' || window.currentUser.role === 'Admin')) {
        return query; 
    }
    if (window.currentUser.filial_id === undefined || window.currentUser.filial_id === null) {
        return query.is('filial_id', null); 
    }
    return query.eq('filial_id', window.currentUser.filial_id);
}
// ===============================================================

// INICIALIZAÇÃO INSTANTÂNEA SPA
window.initOperacional = function() {
    console.log("[OPERACIONAL] Módulo iniciado instantaneamente via SPA.");
    setupOperacionalFilters();
    loadOperacionalData();
};

function normalizarCiclos(dataArr) {
    try {
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
    } catch(e) {
        console.error("[OPERACIONAL] Erro na função normalizarCiclos:", e);
    }
}

function setupOperacionalFilters() {
    const btnQFs = document.querySelectorAll('.btn-op-qf');
    const datePicker = document.getElementById('opDatePicker');
    const filterMesOp = document.getElementById('filterMesOp');
    
    btnQFs.forEach(btn => {
        btn.addEventListener('click', (e) => {
            activeQuickFilterOp = e.currentTarget.getAttribute('data-op-qf');
            btnQFs.forEach(b => {
                if(b.getAttribute('data-op-qf') === activeQuickFilterOp) {
                    b.classList.add('active', 'border-emerald-500/50', 'text-emerald-400', 'bg-emerald-900/30');
                    b.classList.remove('border-transparent', 'text-slate-400', 'hover:bg-slate-700/50');
                } else {
                    b.classList.remove('active', 'border-emerald-500/50', 'text-emerald-400', 'bg-emerald-900/30');
                    b.classList.add('border-transparent', 'text-slate-400', 'hover:bg-slate-700/50');
                }
            });
            if(datePicker) datePicker.value = '';
            if(filterMesOp) filterMesOp.value = 'ALL';
            atualizarPainelOperacional();
        });
    });

    if(datePicker) {
        datePicker.addEventListener('change', () => {
            if(datePicker.value) {
                activeQuickFilterOp = 'DATE';
                btnQFs.forEach(b => {
                    b.classList.remove('active', 'border-emerald-500/50', 'text-emerald-400', 'bg-emerald-900/30');
                    b.classList.add('border-transparent', 'text-slate-400', 'hover:bg-slate-700/50');
                });
                if(filterMesOp) filterMesOp.value = 'ALL';
                atualizarPainelOperacional();
            }
        });
    }

    if(filterMesOp) {
        filterMesOp.addEventListener('change', () => {
            if(filterMesOp.value !== 'ALL') {
                activeQuickFilterOp = 'ALL';
                btnQFs.forEach(b => {
                    b.classList.remove('active', 'border-emerald-500/50', 'text-emerald-400', 'bg-emerald-900/30');
                    b.classList.add('border-transparent', 'text-slate-400', 'hover:bg-slate-700/50');
                });
                if(datePicker) datePicker.value = '';
            }
            atualizarPainelOperacional();
        });
    }
}

function verificarStatusAtualizacao(datasArray) {
    const indicador = document.getElementById('indicadorAtualizacao');
    const icone = document.getElementById('iconeAtualizacao');
    const texto = document.getElementById('textoAtualizacao');
    
    if(!indicador) return;
    indicador.classList.remove('hidden');

    if (!datasArray || datasArray.length === 0) {
        indicador.className = "flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] sm:text-xs font-bold uppercase tracking-widest shadow-inner bg-slate-900/50 text-slate-400 border-slate-600";
        if(icone) icone.className = "fas fa-times-circle";
        if(texto) texto.innerText = "Sem Dados";
        return;
    }

    let maxDate = new Date(0);
    let maxDateStr = "";
    
    datasArray.forEach(dStr => {
        let dt = null;
        const p = String(dStr).split('/');
        if(p.length === 3) {
            let ano = parseInt(p[2]); if(ano < 100) ano += 2000;
            dt = new Date(ano, parseInt(p[1])-1, parseInt(p[0]));
        }
        if (dt && dt > maxDate) {
            maxDate = dt;
            const dia = String(dt.getDate()).padStart(2, '0');
            const mes = String(dt.getMonth() + 1).padStart(2, '0');
            const ano = dt.getFullYear();
            maxDateStr = `${dia}/${mes}/${ano}`;
        }
    });

    const hoje = new Date();
    const diaH = String(hoje.getDate()).padStart(2, '0');
    const mesH = String(hoje.getMonth() + 1).padStart(2, '0');
    const anoH = hoje.getFullYear();
    const hojeStr = `${diaH}/${mesH}/${anoH}`;

    if (maxDateStr === hojeStr) {
        indicador.className = "flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] sm:text-xs font-bold uppercase tracking-widest shadow-inner bg-emerald-900/30 text-emerald-400 border-emerald-500/50 transition-colors";
        if(icone) icone.className = "fas fa-check-circle";
        if(texto) texto.innerText = "Atualizado Hoje";
    } else {
        indicador.className = "flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] sm:text-xs font-bold uppercase tracking-widest shadow-inner bg-amber-900/30 text-amber-400 border-amber-500/50 transition-colors";
        if(icone) icone.className = "fas fa-exclamation-triangle";
        if(texto) texto.innerText = `Base: ${maxDateStr}`;
    }
}

async function loadOperacionalData() {
    const elStatus = document.getElementById('opStatusFetch');
    const client = getSupabaseClient();
    
    if (!client) {
        if(elStatus) elStatus.innerText = "Erro: SupabaseClient não encontrado.";
        return;
    }

    try {
        try {
            let queryMetas = client.from('metas_globais').select('*').eq('id', 1).single();
            const { data: metas, error: errMetas } = await queryMetas;
            
            if (errMetas) {
                metasGlobais = {};
            } else {
                metasGlobais = metas || {};
            }
        } catch(errMetaEx) {
            metasGlobais = {};
        }

        let historico = [];
        let from = 0;
        const step = 1000;
        let fetchMore = true;
        
        while (fetchMore) {
            let queryViagens = client.from('historico_viagens').select('*').range(from, from + step - 1);
            queryViagens = aplicarFiltroLocal(queryViagens);
                
            const { data, error } = await queryViagens;
                
            if (error) {
                if(elStatus) elStatus.innerText = "Erro ao baixar viagens do banco.";
                fetchMore = false;
                break;
            }
            if (data && data.length > 0) {
                historico = historico.concat(data);
                from += step;
            }
            if (!data || data.length < step) {
                fetchMore = false;
            }
        }
        
        if(historico && historico.length > 0) {
            fullHistoricoDataOp = historico.reverse();
            normalizarCiclos(fullHistoricoDataOp);
        }

        try {
            let manutencoes = [];
            let fromManut = 0;
            let fetchMoreManut = true;
            
            while (fetchMoreManut) {
                let queryManutencao = client.from('ordens_servico').select('*').range(fromManut, fromManut + step - 1);
                queryManutencao = aplicarFiltroLocal(queryManutencao);
                    
                const { data: mData, error: errManut } = await queryManutencao;
                    
                if(errManut) {
                    break;
                }
                
                if(mData && mData.length > 0) {
                    manutencoes = manutencoes.concat(mData);
                    fromManut += step;
                }
                
                if(!mData || mData.length < step) {
                    fetchMoreManut = false;
                }
            }

            if(manutencoes.length > 0) {
                fullHistoricoManutencao = manutencoes;
            }

        } catch(errManutencao) {
            console.error("[OPERACIONAL] Exceção ao carregar manutenções:", errManutencao);
        }

        const filterMesOp = document.getElementById('filterMesOp');
        if(filterMesOp && fullHistoricoDataOp.length > 0) {
            let currMesOp = filterMesOp.value;

            if (!window.opMesInicializado) {
                const hj = new Date();
                const mesAtualStr = String(hj.getMonth() + 1).padStart(2, '0') + '/' + hj.getFullYear();
                currMesOp = mesAtualStr;
                window.opMesInicializado = true;
            }

            const mesesSet = new Set();
            
            fullHistoricoDataOp.forEach(d => {
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
            
            filterMesOp.innerHTML = '<option value="ALL">Todos os Meses</option>';
            
            let optionExists = false;
            allMeses.forEach(mStr => {
                const p = mStr.split('/');
                const mesIdx = parseInt(p[0]) - 1;
                const nomeMes = monthNames[mesIdx] + '/' + p[1].substring(2);
                if (mStr === currMesOp) optionExists = true;
                filterMesOp.insertAdjacentHTML('beforeend', `<option value="${mStr}" ${mStr===currMesOp?'selected':''}>${nomeMes}</option>`);
            });

            if (!optionExists && currMesOp !== 'ALL') {
                filterMesOp.value = 'ALL';
            } else {
                filterMesOp.value = currMesOp;
            }
        }

        if(fullHistoricoDataOp.length > 0) {
            const allDates = [...new Set(fullHistoricoDataOp.map(d => d.dataDaBaseExcel))].filter(d => d && d !== 'Desconhecida');
            verificarStatusAtualizacao(allDates);
        } else {
            verificarStatusAtualizacao([]);
        }
        
        atualizarPainelOperacional();

    } catch(e) { 
        console.error("[OPERACIONAL] ERRO GLOBAL em loadOperacionalData:", e); 
        const elStatus = document.getElementById('opStatusFetch');
        if(elStatus) elStatus.innerHTML = "<span class='text-rose-500 font-bold'>Erro ao carregar (F12)</span>";
    }
}

function parseDateTime(dateVal, timeVal) {
    if (!dateVal) return null;
    let baseDate = null;

    try {
        if (typeof dateVal === 'number') {
            if(typeof XLSX !== 'undefined') {
                const dateInfo = XLSX.SSF.parse_date_code(dateVal);
                if (dateInfo) baseDate = new Date(dateInfo.y, dateInfo.m - 1, dateInfo.d);
            }
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
        if (timeVal) {
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
        }

        baseDate.setHours(hours, minutes, seconds, 0);
        return baseDate;
    } catch (e) {
        return null;
    }
}

function atualizarPainelOperacional() {
    try {
        const elDatePicker = document.getElementById('opDatePicker');
        const dataRef = elDatePicker ? elDatePicker.value : null;
        const elFilterMesOp = document.getElementById('filterMesOp');
        const mesRef = elFilterMesOp ? elFilterMesOp.value : 'ALL';
        
        let diasConsiderados = 1;

        const filteredGlobal = fullHistoricoDataOp.filter(d => {
            const parsed = parseDateTime(d.dataDaBaseExcel, null);
            if(!parsed) return false;

            if (mesRef !== 'ALL') {
                const p = d.dataDaBaseExcel.split('/');
                if(p.length >= 3) {
                      let y = p[2]; if(y.length === 2) y = "20"+y;
                      if(`${p[1]}/${y}` !== mesRef) return false;
                } else return false;
            } else {
                if(activeQuickFilterOp === 'ALL' && !dataRef) return true;
            }

            if (mesRef === 'ALL') {
                parsed.setHours(0,0,0,0); 
                const hj = new Date(); hj.setHours(0,0,0,0);
                
                if (activeQuickFilterOp === 'DATE' && dataRef) {
                    const dr = new Date(dataRef + "T00:00:00");
                    dr.setHours(0,0,0,0);
                    return parsed.getTime() === dr.getTime();
                }

                const diff = Math.round((hj - parsed)/86400000);

                if (activeQuickFilterOp === 'D-1') return diff === 1;
                if (activeQuickFilterOp === 'D-2') return diff === 2;
                if (activeQuickFilterOp === 'D-7') return diff >= 0 && diff <= 7;
                if (activeQuickFilterOp === 'D-30') return diff >= 0 && diff <= 30;
                if (activeQuickFilterOp === 'SEM') {
                    const inicioSemana = new Date(hj);
                    inicioSemana.setDate(hj.getDate() - hj.getDay());
                    return (parsed >= inicioSemana && parsed <= hj);
                }
            }
            
            return mesRef !== 'ALL';
        });

        const transpPropriaConfig = metasGlobais.transp_propria ? metasGlobais.transp_propria.toUpperCase() : 'SERRANALOG';

        const filteredSerrana = filteredGlobal.filter(d => {
            const transp = String(d.transportadora || "").toUpperCase();
            return transp.includes(transpPropriaConfig) || transp === transpPropriaConfig || transp.includes('SERRANA');
        });

        const filteredManutencao = fullHistoricoManutencao.filter(d => {
            const dateStr = d.data_abertura || d.created_at;
            if(!dateStr) return false;
            
            const parsed = new Date(dateStr);
            parsed.setHours(0,0,0,0); 

            if (mesRef !== 'ALL') {
                const m = String(parsed.getMonth() + 1).padStart(2, '0');
                const y = parsed.getFullYear();
                if (`${m}/${y}` !== mesRef) return false;
            } else {
                if(activeQuickFilterOp === 'ALL' && !dataRef) return true;
            }

            if (mesRef === 'ALL') {
                const hj = new Date(); hj.setHours(0,0,0,0);
                
                if (activeQuickFilterOp === 'DATE' && dataRef) {
                    const dr = new Date(dataRef + "T00:00:00");
                    return parsed.getTime() === dr.getTime();
                }

                const diff = Math.round((hj - parsed)/86400000);

                if (activeQuickFilterOp === 'D-1') return diff === 1;
                if (activeQuickFilterOp === 'D-2') return diff === 2;
                if (activeQuickFilterOp === 'D-7') return diff >= 0 && diff <= 7;
                if (activeQuickFilterOp === 'D-30') return diff >= 0 && diff <= 30;
                if (activeQuickFilterOp === 'SEM') {
                    const inicioSemana = new Date(hj);
                    inicioSemana.setDate(hj.getDate() - hj.getDay());
                    return (parsed >= inicioSemana && parsed <= hj);
                }
            }
            
            return mesRef !== 'ALL';
        });

        if(activeQuickFilterOp === 'D-7') diasConsiderados = 7;
        else if(activeQuickFilterOp === 'D-30') diasConsiderados = 30;
        else if(activeQuickFilterOp === 'SEM') diasConsiderados = new Date().getDay() + 1; 
        else {
            const dts = new Set(filteredSerrana.map(x=>x.dataDaBaseExcel));
            diasConsiderados = dts.size || 1;
        }

        const placasUnicasSerrana = new Set(filteredSerrana.map(d => d.placa).filter(p => p && p !== '-' && p.trim() !== '')).size || 0;
        const placasUnicasGlobal = new Set(filteredGlobal.map(d => d.placa).filter(p => p && p !== '-' && p.trim() !== '')).size || 0;

        const opStatusFetch = document.getElementById('opStatusFetch');
        if(opStatusFetch) {
            opStatusFetch.innerHTML = `
                <span class="text-sky-400 font-bold">F. Própria: ${placasUnicasSerrana}</span> | 
                <span class="text-emerald-400 font-bold">F. Global: ${placasUnicasGlobal}</span> | 
                ${diasConsiderados} dia(s)
            `;
        }
        
        let monthRefForGoal = new Date(); 
        if (mesRef !== 'ALL') {
            const parts = mesRef.split('/');
            monthRefForGoal = new Date(parseInt(parts[1]), parseInt(parts[0]) - 1, 1);
        }
        
        const diasNoMes = new Date(monthRefForGoal.getFullYear(), monthRefForGoal.getMonth() + 1, 0).getDate();
        const mesStrRef = String(monthRefForGoal.getMonth() + 1).padStart(2, '0') + '/' + monthRefForGoal.getFullYear();
        
        const viagensDoMes = fullHistoricoDataOp.filter(d => {
            const parsed = parseDateTime(d.dataDaBaseExcel, null);
            if (!parsed) return false;
            
            const transp = String(d.transportadora || "").toUpperCase();
            if (!(transp.includes(transpPropriaConfig) || transp === transpPropriaConfig || transp.includes('SERRANA'))) return false;

            const m = String(parsed.getMonth() + 1).padStart(2, '0');
            const y = parsed.getFullYear();
            return `${m}/${y}` === mesStrRef;
        });

        const totalViagensMesRealizado = viagensDoMes.length;
        const totalVolumeMesRealizado = viagensDoMes.reduce((s, x) => s + (parseFloat(String(x.volumeReal).replace(',', '.')) || 0), 0);

        const frotaRealOuConfigurada = metasGlobais.tamanho_frota || (placasUnicasSerrana === 0 ? 0 : placasUnicasSerrana);
        const vProgConfig = parseFloat(metasGlobais.v_prog) || 2;

        const metaViagensMes = frotaRealOuConfigurada * vProgConfig * diasNoMes;
        const metaVolumeMes = (metasGlobais.vol_prog || 0) * diasNoMes; 
        
        const totalV_Serrana = filteredSerrana.length;
        const metaV = frotaRealOuConfigurada * vProgConfig * diasConsiderados;
        
        if(document.getElementById('disp_v_prog')) document.getElementById('disp_v_prog').innerText = metaV;
        if(document.getElementById('disp_v_real')) document.getElementById('disp_v_real').innerText = totalV_Serrana;
        atualizarBarra('bar_v_perc', 'disp_v_perc', totalV_Serrana, metaV);

        const totalVol_Serrana = filteredSerrana.reduce((s,x)=>s+(parseFloat(String(x.volumeReal).replace(',','.'))||0), 0);
        const metaVol = (metasGlobais.vol_prog || 0) * diasConsiderados;
        
        if(document.getElementById('disp_vol_prog')) document.getElementById('disp_vol_prog').innerText = metaVol.toLocaleString('pt-PT');
        if(document.getElementById('disp_vol_real')) document.getElementById('disp_vol_real').innerText = totalVol_Serrana.toLocaleString('pt-PT', {maximumFractionDigits:1});
        atualizarBarra('bar_vol_perc', 'disp_vol_perc', totalVol_Serrana, metaVol);

        const mediaCx = totalV_Serrana > 0 ? (totalVol_Serrana / totalV_Serrana) : 0;
        const metaCx = metasGlobais.cx_prog || 0;

        if(document.getElementById('disp_cx_prog')) document.getElementById('disp_cx_prog').innerText = metaCx;
        if(document.getElementById('disp_cx_real')) document.getElementById('disp_cx_real').innerText = mediaCx.toLocaleString('pt-PT', {maximumFractionDigits:2});
        atualizarBarra('bar_cx_perc', 'disp_cx_perc', mediaCx, metaCx);

        const totalP_Serrana = filteredSerrana.reduce((s,x)=>s+(parseFloat(String(x.pesoLiquido).replace(',','.'))||0), 0)/1000;
        const mediaPbtc = totalV_Serrana > 0 ? (totalP_Serrana / totalV_Serrana) : 0;
        const metaPbtc = metasGlobais.pbtc_prog || 0;

        if(document.getElementById('disp_pbtc_prog')) document.getElementById('disp_pbtc_prog').innerText = metaPbtc;
        
        let pbtcCor = "text-white";
        let pbtcIcone = "";
        
        if (mediaPbtc > 0) {
            if (mediaPbtc < 74) {
                pbtcCor = "text-yellow-400";
                pbtcIcone = '<i class="fas fa-exclamation-triangle text-yellow-400 text-sm ml-2" title="Abaixo do ideal"></i>';
            } else if (mediaPbtc >= 74 && mediaPbtc <= 77.7) {
                pbtcCor = "text-green-400";
                pbtcIcone = '<i class="fas fa-check-circle text-green-400 text-sm ml-2" title="Ideal"></i>';
            } else if (mediaPbtc > 77.7) {
                pbtcCor = "text-red-500";
                pbtcIcone = '<i class="fas fa-times-circle text-red-500 text-sm ml-2" title="Acima do ideal"></i>';
            }
        }

        if(document.getElementById('disp_pbtc_real')) document.getElementById('disp_pbtc_real').innerHTML = `<span class="${pbtcCor}">${mediaPbtc.toLocaleString('pt-PT', {maximumFractionDigits:2})}</span>${pbtcIcone}`;
        
        atualizarBarra('bar_pbtc_perc', 'disp_pbtc_perc', mediaPbtc, metaPbtc);

        const baseTransporte = filteredSerrana.length > 0 ? filteredSerrana : fullHistoricoDataOp.filter(d => {
            const t = String(d.transportadora||'').toUpperCase();
            return t.includes(transpPropriaConfig) || t.includes('SERRANA');
        });
        
        let baseCarregamento = filteredGlobal.filter(d => String(d.grua || '').trim().toUpperCase().startsWith('GSR'));
        if (baseCarregamento.length === 0) {
            baseCarregamento = fullHistoricoDataOp.filter(d => String(d.grua || '').trim().toUpperCase().startsWith('GSR'));
        }

        renderCarregamentoChart(baseCarregamento);
        renderTransporteChart(baseTransporte);
        renderManutencaoChart(filteredManutencao); 

        renderLeaderboards(filteredSerrana, diasConsiderados);
        renderManutencaoTables(filteredManutencao); 
        renderDashboardsGerenciais(filteredGlobal);
        renderIndicadoresExtras(filteredSerrana);

    } catch (excecaoInterface) {
        console.error("[OPERACIONAL] ERRO CRÍTICO na montagem da tela atualizarPainelOperacional:", excecaoInterface);
        const elStatus = document.getElementById('opStatusFetch');
        if(elStatus) elStatus.innerHTML = "<span class='text-rose-500 font-bold'>Erro ao processar dados da tela (F12)</span>";
    }
}

function atualizarBarra(barId, txtId, real, meta) {
    try {
        const perc = meta > 0 ? Math.min((real/meta)*100, 100) : 0;
        const b = document.getElementById(barId);
        const t = document.getElementById(txtId);
        if(b) b.style.width = `${perc}%`;
        if(t) t.innerText = `${perc.toFixed(1)}%`;
    } catch(e) {}
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

function renderCarregamentoChart(data) {
    try {
        const ctxCarreg = document.getElementById('evolucaoCarregamentoChart');
        if(!ctxCarreg) return;

        const dailyMap = new Map();
        data.forEach(d => {
            const dt = d.dataDaBaseExcel;
            if (!dt || dt === 'Desconhecida') return;
            if (!dailyMap.has(dt)) dailyMap.set(dt, 0);
            const vol = parseFloat(String(d.volumeReal).replace(',', '.')) || 0;
            dailyMap.set(dt, dailyMap.get(dt) + vol);
        });

        const sortedDates = Array.from(dailyMap.keys()).sort((a, b) => {
            const pA = a.split('/'); const pB = b.split('/');
            return new Date(pA[2], pA[1]-1, pA[0]) - new Date(pB[2], pB[1]-1, pB[0]);
        });

        const displayDates = sortedDates.slice(-30);
        const displayVols = displayDates.map(dt => dailyMap.get(dt));

        if (chartCarregamento) chartCarregamento.destroy();
        
        const ctx = ctxCarreg.getContext('2d');
        let gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, '#10b981'); 
        gradient.addColorStop(1, '#047857'); 

        chartCarregamento = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: displayDates.map(d => d.substring(0, 5)), 
                datasets: [{
                    label: 'Carregamento (m³)',
                    data: displayVols,
                    backgroundColor: gradient,
                    borderRadius: 4,
                    barPercentage: 0.6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        color: '#fff',
                        anchor: 'end',
                        align: 'top',
                        font: { size: 11, weight: 'bold' },
                        formatter: (v) => v > 0 ? v.toFixed(0) : ''
                    }
                },
                scales: {
                    y: { display: false, beginAtZero: true, suggestedMax: Math.max(...displayVols) * 1.2 }, 
                    x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11, weight: 'bold' }, color: '#cbd5e1' } }
                },
                layout: { padding: { top: 25 } }
            }
        });
    } catch(e) {}
}

function renderTransporteChart(data) {
    try {
        const ctxTransp = document.getElementById('evolucaoTransporteChart');
        if(!ctxTransp) return;

        const dailyMap = new Map();
        data.forEach(d => {
            const dt = d.dataDaBaseExcel;
            if (!dt || dt === 'Desconhecida') return;
            if (!dailyMap.has(dt)) dailyMap.set(dt, 0);
            const vol = parseFloat(String(d.volumeReal).replace(',', '.')) || 0;
            dailyMap.set(dt, dailyMap.get(dt) + vol);
        });

        const sortedDates = Array.from(dailyMap.keys()).sort((a, b) => {
            const pA = a.split('/'); const pB = b.split('/');
            return new Date(pA[2], pA[1]-1, pA[0]) - new Date(pB[2], pB[1]-1, pB[0]);
        });

        const displayDates = sortedDates.slice(-30);
        const displayVols = displayDates.map(dt => dailyMap.get(dt));

        if (chartTransporte) chartTransporte.destroy();
        
        const ctx = ctxTransp.getContext('2d');
        let gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, '#38bdf8'); 
        gradient.addColorStop(1, '#0369a1'); 

        chartTransporte = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: displayDates.map(d => d.substring(0, 5)), 
                datasets: [{
                    label: 'Transporte (m³)',
                    data: displayVols,
                    backgroundColor: gradient,
                    borderRadius: 4,
                    barPercentage: 0.6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        color: '#fff',
                        anchor: 'end',
                        align: 'top',
                        font: { size: 11, weight: 'bold' },
                        formatter: (v) => v > 0 ? v.toFixed(0) : ''
                    }
                },
                scales: {
                    y: { display: false, beginAtZero: true, suggestedMax: Math.max(...displayVols) * 1.2 }, 
                    x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11, weight: 'bold' }, color: '#cbd5e1' } }
                },
                layout: { padding: { top: 25 } }
            }
        });
    } catch(e) {}
}

function renderManutencaoChart(data) {
    try {
        const ctxMan = document.getElementById('evolucaoManutencaoChart');
        if(!ctxMan) return;

        const dailyMap = new Map();
        
        data.forEach(d => {
            const dateStr = d.data_abertura || d.created_at;
            if (!dateStr) return;
            const dtObj = new Date(dateStr);
            const dtKey = dtObj.toISOString().split('T')[0]; 
            
            dailyMap.set(dtKey, (dailyMap.get(dtKey) || 0) + 1);
        });

        const sortedDates = Array.from(dailyMap.keys()).sort();
        const displayDates = sortedDates.slice(-30);
        const displayCounts = displayDates.map(dt => dailyMap.get(dt));
        
        const displayLabels = displayDates.map(dt => {
            const parts = dt.split('-');
            return `${parts[2]}/${parts[1]}`;
        });

        if (chartManutencao) chartManutencao.destroy();
        
        const ctx = ctxMan.getContext('2d');
        let gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, '#f43f5e'); 
        gradient.addColorStop(1, '#be123c'); 

        chartManutencao = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: displayLabels,
                datasets: [{
                    label: 'OS Abertas',
                    data: displayCounts,
                    backgroundColor: gradient,
                    borderRadius: 4,
                    barPercentage: 0.6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        color: '#fff',
                        anchor: 'end',
                        align: 'top',
                        font: { size: 11, weight: 'bold' },
                        formatter: (v) => v > 0 ? v : ''
                    }
                },
                scales: {
                    y: { display: false, beginAtZero: true, suggestedMax: Math.max(...displayCounts, 1) * 1.3 }, 
                    x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11, weight: 'bold' }, color: '#cbd5e1' } }
                },
                layout: { padding: { top: 25 } }
            }
        });
    } catch(e) {}
}

function renderLeaderboards(data, diasConsiderados = 1) {
    try {
        const pMap = new Map();
        data.forEach(d => {
            const pl = d.placa || 'N/A';
            const volNum = parseFloat(String(d.volumeReal).replace(',', '.')) || 0;
            if(!pMap.has(pl)) pMap.set(pl, {p: pl, t: d.transportadora||'-', vol: 0, v: 0, ciclos: 0, cCount: 0});
            const o = pMap.get(pl);
            o.vol += volNum; o.v++;
            if(d.cicloHoras > 0) { o.ciclos += d.cicloHoras; o.cCount++; }
        });

        const arr = Array.from(pMap.values());
        
        diasConsideradosGlobais = diasConsiderados;
        globalTopVol = [...arr].sort((a,b)=>b.vol - a.vol);
        globalTopCiclo = [...arr].filter(x=>x.cCount > 0).map(x=>({...x, cMedio: x.ciclos/x.cCount})).sort((a,b)=>a.cMedio - b.cMedio);

        const bVol = document.getElementById('leaderboardBody');
        if(bVol) {
            bVol.innerHTML = '';
            globalTopVol.forEach((x,i) => {
                const viagensPorDia = diasConsiderados > 0 ? (x.v / diasConsiderados) : x.v;
                const cumpriuMeta = viagensPorDia >= (parseFloat(metasGlobais.v_prog) || 2);
                
                const badgeHtml = cumpriuMeta 
                    ? `<span class="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-bold" title="${viagensPorDia.toFixed(1)} viagens/dia"><i class="fas fa-check mr-1"></i>SIM</span>`
                    : `<span class="bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] font-bold" title="${viagensPorDia.toFixed(1)} viagens/dia"><i class="fas fa-times mr-1"></i>NÃO</span>`;

                const tr = `<tr>
                    <td class="px-4 py-3 text-center"><div class="w-6 h-6 rounded-full ${i<3?'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)]':'bg-slate-800 text-slate-400'} flex items-center justify-center text-xs font-bold">${i+1}</div></td>
                    <td class="px-4 py-3 font-bold text-white">${x.p}</td>
                    <td class="px-4 py-3 text-slate-400 truncate max-w-[100px]">${x.t}</td>
                    <td class="px-4 py-3 text-center text-slate-300">${x.v}</td>
                    <td class="px-4 py-3 text-right font-mono text-emerald-400">${x.vol.toLocaleString('pt-PT',{maximumFractionDigits:1})}</td>
                    <td class="px-4 py-3 text-center">${badgeHtml}</td>
                </tr>`;
                bVol.insertAdjacentHTML('beforeend', tr);
            });
            
            if (globalTopVol.length === 0) {
                bVol.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-slate-500">Nenhum veículo encontrado.</td></tr>`;
            }
        }

        const bCiclo = document.getElementById('leaderboardCicloBody');
        if(bCiclo) {
            bCiclo.innerHTML = '';
            globalTopCiclo.forEach((x,i) => {
                const tr = `<tr>
                    <td class="px-4 py-3 text-center"><div class="w-6 h-6 rounded-full ${i<3?'bg-sky-500 text-white shadow-[0_0_10px_rgba(14,165,233,0.5)]':'bg-slate-800 text-slate-400'} flex items-center justify-center text-xs font-bold">${i+1}</div></td>
                    <td class="px-4 py-3 font-bold text-white">${x.p}</td>
                    <td class="px-4 py-3 text-slate-400 truncate max-w-[100px]">${x.t}</td>
                    <td class="px-4 py-3 text-center text-slate-300">${x.v}</td>
                    <td class="px-4 py-3 text-right font-mono text-sky-400">${formatarHorasMinutos(x.cMedio)}</td>
                </tr>`;
                bCiclo.insertAdjacentHTML('beforeend', tr);
            });
            
            if (globalTopCiclo.length === 0) {
                bCiclo.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-slate-500">Nenhum ciclo encontrado.</td></tr>`;
            }
        }
    } catch(e) {}
}

function renderManutencaoTables(data) {
    try {
        const placaMap = new Map();
        const tipoMap = new Map();
        let totalOS = data.length;

        data.forEach(d => {
            const pl = d.placa ? d.placa.trim().toUpperCase() : 'N/A';
            const tp = d.tipo ? d.tipo.trim().toUpperCase() : 'NÃO INFORMADO';

            placaMap.set(pl, (placaMap.get(pl) || 0) + 1);
            tipoMap.set(tp, (tipoMap.get(tp) || 0) + 1);
        });

        const topPlacas = Array.from(placaMap.entries())
            .map(([placa, qtd]) => ({ placa, qtd }))
            .sort((a, b) => b.qtd - a.qtd)
            .slice(0, 5);

        const topTipos = Array.from(tipoMap.entries())
            .map(([tipo, qtd]) => ({ tipo, qtd }))
            .sort((a, b) => b.qtd - a.qtd);

        const bCaminhoes = document.getElementById('leaderboardCaminhoesQuebram');
        if (bCaminhoes) {
            bCaminhoes.innerHTML = '';
            topPlacas.forEach((x, i) => {
                const tr = `<tr>
                    <td class="px-4 py-3 text-center"><div class="w-6 h-6 rounded-full ${i<3?'bg-rose-500 text-white shadow-[0_0_10px_rgba(244,63,94,0.5)]':'bg-slate-800 text-slate-400'} flex items-center justify-center text-xs font-bold">${i+1}</div></td>
                    <td class="px-4 py-3 font-bold text-white text-base">${x.placa}</td>
                    <td class="px-4 py-3 text-right font-mono text-white text-lg font-bold">${x.qtd}</td>
                </tr>`;
                bCaminhoes.insertAdjacentHTML('beforeend', tr);
            });

            if (topPlacas.length === 0) {
                bCaminhoes.innerHTML = '<tr><td colspan="3" class="px-4 py-4 text-center text-slate-500">Nenhuma ocorrência</td></tr>';
            }
        }

        const bTipos = document.getElementById('leaderboardTiposServico');
        if (bTipos) {
            bTipos.innerHTML = '';
            topTipos.forEach((x) => {
                const perc = totalOS > 0 ? (x.qtd / totalOS) * 100 : 0;
                const tr = `<tr>
                    <td class="px-4 py-3 font-bold text-white text-base max-w-[150px] truncate" title="${x.tipo}">${x.tipo}</td>
                    <td class="px-4 py-3 text-right font-mono text-white text-lg font-bold">${x.qtd}</td>
                    <td class="px-4 py-3 text-right font-mono text-slate-400 text-sm">${perc.toFixed(1)}%</td>
                </tr>`;
                bTipos.insertAdjacentHTML('beforeend', tr);
            });

            if (topTipos.length === 0) {
                bTipos.innerHTML = '<tr><td colspan="3" class="px-4 py-4 text-center text-slate-500">Nenhuma ocorrência</td></tr>';
            }
        }
    } catch(e) {}
}

function renderDashboardsGerenciais(data) {
    try {
        const tMap = new Map();
        data.forEach(d => {
            const tr = d.transportadora || 'N/A';
            const vol = parseFloat(String(d.volumeReal).replace(',', '.')) || 0;
            if(!tMap.has(tr)) tMap.set(tr, {vol:0, v:0});
            const o = tMap.get(tr);
            o.vol += vol; o.v++;
        });

        const arr = Array.from(tMap.entries()).map(x => ({t: x[0], vol: x[1].vol, v: x[1].v})).sort((a,b)=>b.vol - a.vol);
        const totVol = arr.reduce((s,x)=>s+x.vol, 0);

        const bPerf = document.getElementById('perfTranspBody');
        if(bPerf) {
            bPerf.innerHTML = '';
            arr.forEach(x => {
                const perc = totVol > 0 ? (x.vol/totVol)*100 : 0;
                const tr = `<tr><td class="px-4 py-3 font-bold text-white">${x.t}</td><td class="px-4 py-3 text-center text-slate-300">${x.v}</td><td class="px-4 py-3 text-right font-mono text-emerald-400">${x.vol.toLocaleString('pt-PT',{maximumFractionDigits:1})}</td><td class="px-4 py-3 text-right font-mono text-sky-400">${perc.toFixed(1)}%</td></tr>`;
                bPerf.insertAdjacentHTML('beforeend', tr);
            });
        }

        const tRes = document.getElementById('resumoOperacionalBody');
        if(tRes) {
            const transpPropriaConfig = metasGlobais.transp_propria ? metasGlobais.transp_propria.toUpperCase() : 'SERRANALOG';
            const dSerrana = data.filter(d=>{
                const t = String(d.transportadora||'').toUpperCase();
                return t.includes(transpPropriaConfig) || t.includes('SERRANA');
            });
            const dOutras = data.filter(d=>{
                const t = String(d.transportadora||'').toUpperCase();
                return !(t.includes(transpPropriaConfig) || t.includes('SERRANA'));
            });
            
            const calcResumo = (arrD) => {
                const v = arrD.length;
                const vol = arrD.reduce((s,x)=>s+(parseFloat(String(x.volumeReal).replace(',','.'))||0),0);
                return {v, vol};
            };

            const rS = calcResumo(dSerrana);
            const rO = calcResumo(dOutras);
            const rG = calcResumo(data);

            tRes.innerHTML = `
                <tr class="hover:bg-slate-800/30 transition-colors border-b border-slate-700/50">
                    <td class="px-4 py-3 font-bold text-white">Própria</td>
                    <td class="px-4 py-3 text-center font-mono text-slate-300">${rS.v}</td>
                    <td class="px-4 py-3 text-right font-mono text-emerald-400">${rS.vol.toLocaleString('pt-PT',{maximumFractionDigits:1})}</td>
                    <td class="px-4 py-3 text-right font-mono text-sky-400">${rG.vol>0?((rS.vol/rG.vol)*100).toFixed(1):'0.0'}%</td>
                </tr>
                <tr class="hover:bg-slate-800/30 transition-colors border-b border-slate-700/50">
                    <td class="px-4 py-3 font-bold text-white">Terceiros</td>
                    <td class="px-4 py-3 text-center font-mono text-slate-300">${rO.v}</td>
                    <td class="px-4 py-3 text-right font-mono text-emerald-400">${rO.vol.toLocaleString('pt-PT',{maximumFractionDigits:1})}</td>
                    <td class="px-4 py-3 text-right font-mono text-sky-400">${rG.vol>0?((rO.vol/rG.vol)*100).toFixed(1):'0.0'}%</td>
                </tr>
                <tr class="bg-slate-800/50 border-t border-slate-600">
                    <td class="px-4 py-3 font-bold text-white uppercase tracking-wider text-xs">Total Global</td>
                    <td class="px-4 py-3 text-center font-mono font-bold text-white">${rG.v}</td>
                    <td class="px-4 py-3 text-right font-mono font-bold text-emerald-400">${rG.vol.toLocaleString('pt-PT',{maximumFractionDigits:1})}</td>
                    <td class="px-4 py-3 text-right font-mono font-bold text-sky-400">100.0%</td>
                </tr>
            `;
        }
    } catch(e) {}
}

function renderIndicadoresExtras(data) {
    try {
        const caixaMap = new Map();
        data.forEach(d => {
            const pl = d.placa || 'N/A';
            const vol = parseFloat(String(d.volumeReal).replace(',', '.')) || 0;
            if (!caixaMap.has(pl)) caixaMap.set(pl, { pl: pl, v: 0, vol: 0 });
            const o = caixaMap.get(pl);
            o.v++;
            o.vol += vol;
        });

        const caixaArr = Array.from(caixaMap.values())
            .map(x => ({ ...x, media: x.v > 0 ? x.vol / x.v : 0 }))
            .sort((a, b) => b.media - a.media);

        const tbodyCaixa = document.getElementById('leaderboardCaixaMedia');
        if (tbodyCaixa) {
            tbodyCaixa.innerHTML = '';
            if (caixaArr.length === 0) {
                tbodyCaixa.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-slate-500">Nenhum dado</td></tr>`;
            } else {
                caixaArr.forEach(x => {
                    const tr = `<tr>
                        <td class="px-4 py-3 font-bold text-white">${x.pl}</td>
                        <td class="px-4 py-3 text-center text-slate-300">${x.v}</td>
                        <td class="px-4 py-3 text-right font-mono text-indigo-400 font-bold">${x.media.toLocaleString('pt-PT', {maximumFractionDigits:2})}</td>
                    </tr>`;
                    tbodyCaixa.insertAdjacentHTML('beforeend', tr);
                });
            }
        }

        let sumCiclo = 0, countCiclo = 0;
        let sumFilaCpo = 0, countFilaCpo = 0;
        let sumCarreg = 0, countCarreg = 0;
        let sumFilaFab = 0, countFilaFab = 0;

        data.forEach(d => {
            if (d.cicloHoras > 0) { sumCiclo += d.cicloHoras; countCiclo++; }
            if (d.filaCampoHoras > 0) { sumFilaCpo += d.filaCampoHoras; countFilaCpo++; }
            if (d.tempoCarregamentoHoras > 0) { sumCarreg += d.tempoCarregamentoHoras; countCarreg++; }
            if (d.filaFabricaHoras > 0) { sumFilaFab += d.filaFabricaHoras; countFilaFab++; }
        });

        const gargalosData = [
            { nome: 'Ciclo Completo', sum: sumCiclo, count: countCiclo },
            { nome: 'Fila Campo', sum: sumFilaCpo, count: countFilaCpo },
            { nome: 'Carregamento', sum: sumCarreg, count: countCarreg },
            { nome: 'Fila Fábrica', sum: sumFilaFab, count: countFilaFab }
        ];

        const tbodyGargalos = document.getElementById('leaderboardGargalos');
        if (tbodyGargalos) {
            tbodyGargalos.innerHTML = '';
            gargalosData.forEach(g => {
                const media = g.count > 0 ? g.sum / g.count : 0;
                const tr = `<tr>
                    <td class="px-4 py-3 font-bold text-white">${g.nome}</td>
                    <td class="px-4 py-3 text-center text-slate-300">${g.count}</td>
                    <td class="px-4 py-3 text-right font-mono text-amber-400">${formatarHorasMinutos(media)}</td>
                </tr>`;
                tbodyGargalos.insertAdjacentHTML('beforeend', tr);
            });
        }

        const pioresCiclos = data
            .filter(d => (d.cicloHorasOriginal || d.cicloHoras) > 0)
            .sort((a, b) => (b.cicloHorasOriginal || b.cicloHoras) - (a.cicloHorasOriginal || a.cicloHoras))
            .slice(0, 30); 

        const tbodyPiores = document.getElementById('leaderboardPioresCiclos');
        if (tbodyPiores) {
            tbodyPiores.innerHTML = '';
            if (pioresCiclos.length === 0) {
                tbodyPiores.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-slate-500">Nenhum ciclo</td></tr>`;
            } else {
                pioresCiclos.forEach(x => {
                    const dt = x.dataDaBaseExcel || '-';
                    const mov = x.movimento || '-';
                    
                    const valorExibido = formatarHorasMinutos(x.cicloHorasOriginal || x.cicloHoras);

                    const tr = `<tr>
                        <td class="px-4 py-3 font-bold text-white">${x.placa}</td>
                        <td class="px-4 py-3 text-slate-300 whitespace-nowrap">${dt}</td>
                        <td class="px-4 py-3 text-slate-400 text-[10px] truncate max-w-[100px]" title="${mov}">${mov}</td>
                        <td class="px-4 py-3 text-right font-mono text-rose-400 font-bold" title="Ciclo real do veículo.">${valorExibido}</td>
                    </tr>`;
                    tbodyPiores.insertAdjacentHTML('beforeend', tr);
                });
            }
        }
    } catch(e) {}
}

window.exportarTopVolume = function() {
    if (typeof XLSX === 'undefined') {
        alert("A biblioteca Excel ainda não foi carregada. Tente novamente em alguns segundos.");
        return;
    }
    
    if (!globalTopVol || globalTopVol.length === 0) {
        alert("Não há dados de Volume para exportar no período selecionado.");
        return;
    }
    
    const wsData = [
        ['Posição', 'Placa', 'Transportadora', 'Total Viagens', 'Volume Total (m³)', 'Média Viagens/Dia', 'Cumpriu Meta?']
    ];
    
    globalTopVol.forEach((x, i) => {
        const viagensPorDia = diasConsideradosGlobais > 0 ? (x.v / diasConsideradosGlobais) : x.v;
        const cumpriuMeta = viagensPorDia >= (parseFloat(metasGlobais.v_prog) || 2) ? 'SIM' : 'NÃO';
        wsData.push([i + 1, x.p, x.t, x.v, x.vol, Number(viagensPorDia.toFixed(2)), cumpriuMeta]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Volume_Veiculos");
    XLSX.writeFile(wb, "Relatorio_Volume_Veiculos_Serrana.xlsx");
};

window.exportarTopCiclo = function() {
    if (typeof XLSX === 'undefined') {
        alert("A biblioteca Excel ainda não foi carregada. Tente novamente em alguns segundos.");
        return;
    }

    if (!globalTopCiclo || globalTopCiclo.length === 0) {
        alert("Não há dados de Ciclos para exportar no período selecionado.");
        return;
    }
    
    const wsData = [
        ['Posição', 'Placa', 'Transportadora', 'Viagens Realizadas', 'Ciclo Médio (Horas Decimais)', 'Ciclo Médio (Formatado)']
    ];
    
    globalTopCiclo.forEach((x, i) => {
        wsData.push([i + 1, x.p, x.t, x.v, Number(x.cMedio.toFixed(2)), formatarHorasMinutos(x.cMedio)]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ciclos_Medios");
    XLSX.writeFile(wb, "Relatorio_Ciclos_Veiculos_Serrana.xlsx");
};