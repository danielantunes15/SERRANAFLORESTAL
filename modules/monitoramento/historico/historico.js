// ==========================================
// js/historico.js - TELA DE AUDITORIA DE PRODUÇÃO (VIAGENS)
// ==========================================

// Envelopado em uma função anônima para isolar as variáveis e evitar o erro "already been declared"
(function() {
    let fullHistoricoData = [];
    let paginaAtual = 0;
    let itensPorPagina = 50;

    let termoBuscaAtual = '';
    let filtroPlacaAtual = '';
    let filtroDataAtual = '';

    let carregando = false;
    let fimDosDados = false;
    let debounceTimer;

    // =========================================================
    // INICIALIZAÇÃO INSTANTÂNEA SPA
    // =========================================================
    window.initHistorico = function() {
        console.log("[Histórico de Produção] Módulo iniciado instantaneamente via SPA.");
        
        // Resetando variáveis de estado
        fullHistoricoData = [];
        paginaAtual = 0;
        termoBuscaAtual = '';
        filtroPlacaAtual = '';
        filtroDataAtual = '';
        carregando = false;
        fimDosDados = false;

        window.loadHistoricoCompleto(true);
        
        const searchInput = document.getElementById('searchHistorico');
        const filterPlaca = document.getElementById('filterPlacaHist');
        const filterData = document.getElementById('filterDataHist');
        const btnFilter = document.getElementById('btnFilterHist');
        const btnClear = document.getElementById('btnClearHist');

        window._aplicarFiltrosHist = () => {
            termoBuscaAtual = searchInput ? searchInput.value.trim().toLowerCase() : '';
            filtroPlacaAtual = filterPlaca ? filterPlaca.value.trim().toUpperCase() : '';
            
            if (filterData && filterData.value) {
                const parts = filterData.value.split('-');
                if(parts.length === 3) {
                    filtroDataAtual = `${parts[2]}/${parts[1]}/${parts[0]}`; 
                }
            } else {
                filtroDataAtual = '';
            }
            window.loadHistoricoCompleto(true);
        };

        if (searchInput) {
            searchInput.removeEventListener('input', window._onInputSearchHist);
            window._onInputSearchHist = () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(window._aplicarFiltrosHist, 500); 
            };
            searchInput.addEventListener('input', window._onInputSearchHist);
        }

        if (filterPlaca) {
            filterPlaca.removeEventListener('input', window._onInputPlacaHist);
            window._onInputPlacaHist = () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(window._aplicarFiltrosHist, 500); 
            };
            filterPlaca.addEventListener('input', window._onInputPlacaHist);
        }

        if (filterData) {
            filterData.removeEventListener('change', window._aplicarFiltrosHist);
            filterData.addEventListener('change', window._aplicarFiltrosHist);
        }

        if (btnFilter) {
            btnFilter.removeEventListener('click', window._aplicarFiltrosHist);
            btnFilter.addEventListener('click', window._aplicarFiltrosHist);
        }

        if (btnClear) {
            btnClear.removeEventListener('click', window._onClearHist);
            window._onClearHist = () => {
                if (searchInput) searchInput.value = '';
                if (filterPlaca) filterPlaca.value = '';
                if (filterData) filterData.value = '';
                termoBuscaAtual = '';
                filtroPlacaAtual = '';
                filtroDataAtual = '';
                window.loadHistoricoCompleto(true);
            };
            btnClear.addEventListener('click', window._onClearHist);
        }
    };

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

    // Carregamento de dados com paginação (Exposto no window para o botão "Carregar Mais" funcionar)
    window.loadHistoricoCompleto = async function(reset = false) {
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

            if (typeof window.aplicarFiltroLocal === 'function') {
                query = window.aplicarFiltroLocal(query);
            }

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
                
                let dadosTratados = data.reverse();
                fullHistoricoData = [...fullHistoricoData, ...dadosTratados];
                
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
    };

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
                        <button onclick="window.loadHistoricoCompleto()" class="bg-sky-600/20 hover:bg-sky-600/40 text-sky-400 border border-sky-500/50 font-bold py-2.5 px-8 rounded-full transition-all text-sm shadow-lg">
                            <i class="fas fa-chevron-down mr-2"></i> Carregar Mais Registros
                        </button>
                    </td>
                </tr>
            `);
        }
    }
})();