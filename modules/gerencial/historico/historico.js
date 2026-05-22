// ==========================================
// js/historico.js - TELA DE AUDITORIA DE PRODUÇÃO (VIAGENS)
// ==========================================

// Trocado "let" por "var" e adicionado verificação de janela para evitar o erro de redeclaração no SPA
var fullHistoricoData = window.fullHistoricoData || [];
var paginaAtual = 0;
var itensPorPagina = 50;

var termoBuscaAtual = window.termoBuscaAtual || '';
var filtroPlacaAtual = window.filtroPlacaAtual || '';
var filtroDataAtual = window.filtroDataAtual || '';

var carregando = false;
var fimDosDados = false;
var debounceTimer;

document.addEventListener('DOMContentLoaded', () => {
    loadHistoricoCompleto(true);
    
    const searchInput = document.getElementById('searchHistorico');
    const filterPlaca = document.getElementById('filterPlacaHist');
    const filterData = document.getElementById('filterDataHist');
    const btnFilter = document.getElementById('btnFilterHist');
    const btnClear = document.getElementById('btnClearHist');

    const aplicarFiltros = () => {
        termoBuscaAtual = searchInput ? searchInput.value.trim().toLowerCase() : '';
        filtroPlacaAtual = filterPlaca ? filterPlaca.value.trim().toUpperCase() : '';
        
        if (filterData && filterData.value) {
            const parts = filterData.value.split('-');
            if(parts.length === 3) {
                // Converte de YYYY-MM-DD para DD/MM/YYYY (formato do excel)
                filtroDataAtual = `${parts[2]}/${parts[1]}/${parts[0]}`; 
            }
        } else {
            filtroDataAtual = '';
        }
        loadHistoricoCompleto(true);
    };

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(aplicarFiltros, 500); 
        });
    }

    if (filterPlaca) {
        filterPlaca.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(aplicarFiltros, 500); 
        });
    }

    if (filterData) {
        filterData.addEventListener('change', aplicarFiltros);
    }

    if (btnFilter) {
        btnFilter.addEventListener('click', aplicarFiltros);
    }

    if (btnClear) {
        btnClear.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (filterPlaca) filterPlaca.value = '';
            if (filterData) filterData.value = '';
            termoBuscaAtual = '';
            filtroPlacaAtual = '';
            filtroDataAtual = '';
            loadHistoricoCompleto(true);
        });
    }
});

// --- NOVA REGRA DO CICLO MÉDIO (VERSÃO BLINDADA) ---
function normalizarCiclos(dataArr) {
    const pMap = new Map();
    
    // Passo 1: Garantir que temos o valor original e somar os ciclos bons
    dataArr.forEach(d => {
        // Se ainda não salvou o original, salva agora
        if (d.cicloHorasOriginal === undefined) {
            d.cicloHorasOriginal = d.cicloHoras;
        }

        // Usamos sempre o original para calcular quem são os melhores
        if (d.cicloHorasOriginal > 0 && d.cicloHorasOriginal <= 12) { 
            const pl = d.placa || 'N/A';
            if (!pMap.has(pl)) pMap.set(pl, { ciclos: 0, count: 0 });
            pMap.get(pl).ciclos += d.cicloHorasOriginal;
            pMap.get(pl).count++;
        }
    });
    
    // Passo 2: Calcula a média das frotas e pega as 20 com o menor tempo
    const frotas = Array.from(pMap.values())
        .map(x => x.ciclos / x.count)
        .sort((a, b) => a - b)
        .slice(0, 20);
        
    if (frotas.length === 0) return;
    
    const mediaMenores = frotas.reduce((a, b) => a + b, 0) / frotas.length;
    
    // Passo 3: Aplica a regra de substituição
    dataArr.forEach(d => {
        if (d.cicloHorasOriginal > 12) {
            d.cicloHoras = mediaMenores; // Estourou, recebe a média
        } else {
            d.cicloHoras = d.cicloHorasOriginal; // Tá dentro da meta, mantém o real
        }
    });
}
// ---------------------------------

async function loadHistoricoCompleto(reset = false) {
    if (carregando) return;
    carregando = true;

    if (reset) {
        paginaAtual = 0;
        fullHistoricoData = [];
        fimDosDados = false;
        const tbody = document.getElementById('historicoGeralBody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-slate-400"><i class="fas fa-spinner fa-spin mr-2"></i>Buscando dados no servidor...</td></tr>`;
    }

    if (fimDosDados) {
        carregando = false;
        return;
    }

    try {
        const de = paginaAtual * itensPorPagina;
        const ate = de + itensPorPagina - 1;

        let query = supabaseClient
            .from('historico_viagens')
            .select('*')
            .range(de, ate);

        if (termoBuscaAtual) {
            query = query.or(`placa.ilike.%${termoBuscaAtual}%,transportadora.ilike.%${termoBuscaAtual}%,movimento.ilike.%${termoBuscaAtual}%`);
        }
        
        if (filtroPlacaAtual) {
            query = query.ilike('placa', `%${filtroPlacaAtual}%`);
        }

        if (filtroDataAtual) {
            query = query.eq('dataDaBaseExcel', filtroDataAtual);
        }

        const { data, error } = await query;

        if (error) throw error;
        
        if (data) { 
            if (data.length < itensPorPagina) {
                fimDosDados = true;
            }
            // Inverte os dados novos que chegarem para os mais recentes ficarem no topo
            let dadosTratados = data.reverse();
            
            // Junta os dados novos com os antigos PRIMEIRO
            fullHistoricoData = [...fullHistoricoData, ...dadosTratados];
            
            // APLICA REGRA PARA TODOS OS DADOS JUNTOS (Garante a média perfeita)
            normalizarCiclos(fullHistoricoData);

            paginaAtual++;
            renderHistoricoTable(); 
        }
    } catch(e) {
        console.error("Erro ao carregar histórico:", e);
        const tbody = document.getElementById('historicoGeralBody');
        if (tbody && reset) tbody.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-rose-500">Erro ao carregar dados. Verifique a conexão.</td></tr>`;
    } finally {
        carregando = false;
    }
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

function renderHistoricoTable() {
    const t = document.getElementById('historicoGeralBody');
    if(!t) return;
    
    t.innerHTML = '';
    
    if(fullHistoricoData.length === 0) {
        t.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-slate-500">Nenhuma viagem encontrada com os filtros atuais.</td></tr>`;
        return;
    }

    fullHistoricoData.forEach(r => {
        // Se o valor original existia e for maior que 12, avisa na tela que foi normalizado
        const cicloHtml = (r.cicloHorasOriginal && r.cicloHorasOriginal > 12)
            ? `<span class="text-amber-400 cursor-help border-b border-dashed border-amber-400/50" title="Ciclo original era de ${formatarHorasMinutos(r.cicloHorasOriginal)}. Foi normalizado para ${formatarHorasMinutos(r.cicloHoras)} pois passou de 12h.">${formatarHorasMinutos(r.cicloHoras)}*</span>`
            : formatarHorasMinutos(r.cicloHoras);

        t.insertAdjacentHTML('beforeend', `<tr class="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
            <td class="px-6 py-3 text-sm font-semibold text-sky-400 whitespace-nowrap">${r.dataDaBaseExcel || '-'}</td>
            <td class="px-6 py-3 text-xs font-mono text-slate-400 truncate max-w-[150px]" title="${r.movimento}">${r.movimento || '-'}</td>
            <td class="px-6 py-3 text-sm text-slate-300 truncate max-w-[150px]">${r.transportadora || '-'}</td>
            <td class="px-6 py-3 text-sm font-bold text-white">${r.placa || '-'}</td>
            <td class="px-6 py-3 text-right text-sm font-mono text-emerald-400">${r.pesoLiquido ? (r.pesoLiquido/1000).toLocaleString('pt-PT', {maximumFractionDigits:2}) : '0'}</td>
            <td class="px-6 py-3 text-right text-sm font-mono text-amber-400">${r.volumeReal ? r.volumeReal.toLocaleString('pt-PT', {maximumFractionDigits:2}) : '0'}</td>
            <td class="px-6 py-3 text-right text-sm text-slate-400">${cicloHtml}</td>
            <td class="px-6 py-3 text-right text-sm text-slate-400">${formatarHorasMinutos(r.filaCampoHoras)}</td>
            <td class="px-6 py-3 text-right text-sm text-slate-400">${formatarHorasMinutos(r.tempoCarregamentoHoras)}</td>
            <td class="px-6 py-3 text-right text-sm text-slate-400">${formatarHorasMinutos(r.filaFabricaHoras)}</td>
        </tr>`);
    });

    if (!fimDosDados) {
        t.insertAdjacentHTML('beforeend', `
            <tr id="rowCarregarMais">
                <td colspan="10" class="text-center py-6">
                    <button onclick="loadHistoricoCompleto()" class="bg-sky-600/20 hover:bg-sky-600/40 text-sky-400 border border-sky-500/50 font-bold py-2.5 px-8 rounded-full transition-all text-sm shadow-lg">
                        <i class="fas fa-chevron-down mr-2"></i> Carregar Mais Registros
                    </button>
                </td>
            </tr>
        `);
    }
}