// ==========================================
// js/desempenho_grua.js - LÓGICA DE GRUAS (APENAS PRÓPRIAS)
// ==========================================

(function() {
    var dadosHistoricoCompletosGrua = []; 
    var listaQuadroGruasAtual = []; 
    var gruasPropriasPermitidas = []; // Nova variável para armazenar as gruas próprias

    var activeFilter = 'MES'; 
    var customDateStr = ''; 

    function getSupabaseClient() {
        if (window.supabaseClient) return window.supabaseClient;
        if (typeof supabaseClient !== 'undefined') return supabaseClient;
        console.error("[DESEMPENHO GRUA] FATAL: Nenhum cliente Supabase encontrado!");
        return null;
    }

    window.initDesempenhoGrua = function() {
        console.log("[DESEMPENHO GRUA] Módulo iniciado.");
        setupFiltersGrua();
        buscarDadosSupabaseGrua(); 
    };

    function convertDateFromBaseStr(dateStr) {
        if(!dateStr) return '';
        if(dateStr.includes('-')) {
            const parts = dateStr.split('-');
            if(parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
    }

    function calcularMinutosEntreHoras(hrInicio, hrFim) {
        if (!hrInicio || !hrFim) return 0;
        try {
            const [h1, m1] = hrInicio.split(':').map(Number);
            const [h2, m2] = hrFim.split(':').map(Number);
            
            let min1 = h1 * 60 + m1;
            let min2 = h2 * 60 + m2;
            
            if (min2 < min1) min2 += 24 * 60;
            return min2 - min1;
        } catch(e) {
            return 0;
        }
    }

    function formatarMinutosParaHora(minutosTotais) {
        if (isNaN(minutosTotais) || minutosTotais <= 0) return '00:00';
        const h = Math.floor(minutosTotais / 60);
        const m = Math.floor(minutosTotais % 60);
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    }

    function setupFiltersGrua() {
        const btnQFs = document.querySelectorAll('.btn-qf');
        const filterData = document.getElementById('filterDataGrua');
        const filterMes = document.getElementById('filterMesGrua');
        const btnExportar = document.getElementById('btnExportarExcelGrua');

        btnQFs.forEach(btn => {
            btn.addEventListener('click', (e) => {
                activeFilter = e.currentTarget.getAttribute('data-qf');
                if(filterData) filterData.value = ''; 
                if(filterMes) filterMes.value = '';
                customDateStr = '';
                
                atualizarUIBotoesGrua(btnQFs, activeFilter);
                processarEExibirDadosGrua();
            });
        });

        if(filterMes) {
            filterMes.addEventListener('change', (e) => {
                if(e.target.value) {
                    activeFilter = 'MES';
                    customDateStr = '';
                    if(filterData) filterData.value = '';
                    
                    atualizarUIBotoesGrua(btnQFs, null); 
                    processarEExibirDadosGrua();
                }
            });
        }

        if(filterData) {
            filterData.addEventListener('change', (e) => {
                if(e.target.value) {
                    activeFilter = 'CUSTOM';
                    const parts = e.target.value.split('-'); 
                    if(parts.length === 3) {
                        customDateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
                    }
                    if(filterMes) filterMes.value = '';
                    
                    atualizarUIBotoesGrua(btnQFs, null);
                    processarEExibirDadosGrua();
                }
            });
        }

        if(btnExportar) {
            btnExportar.addEventListener('click', exportarParaExcelGrua);
        }
    }

    function atualizarUIBotoesGrua(botoes, filtroAtivo) {
        botoes.forEach(b => {
            if(b.getAttribute('data-qf') === filtroAtivo) {
                b.classList.add('border-emerald-500/50', 'text-emerald-400', 'bg-emerald-900/30', 'active');
                b.classList.remove('border-slate-600', 'text-slate-400', 'hover:bg-slate-700');
            } else {
                b.classList.remove('border-emerald-500/50', 'text-emerald-400', 'bg-emerald-900/30', 'active');
                b.classList.add('border-slate-600', 'text-slate-400', 'hover:bg-slate-700');
            }
        });
    }

    function getPastDateStringGrua(daysAgo) {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${d}/${m}/${y}`;
    }

    function popularDropdownMesesGrua(dados) {
        try {
            const selectMes = document.getElementById('filterMesGrua');
            if(!selectMes) return;

            const mesesNomes = {
                '01':'janeiro', '02':'fevereiro', '03':'março', '04':'abril',
                '05':'maio', '06':'junho', '07':'julho', '08':'agosto',
                '09':'setembro', '10':'outubro', '11':'novembro', '12':'dezembro'
            };

            const mesesUnicos = new Set();
            dados.forEach(d => {
                const dt = convertDateFromBaseStr(d.dtFimCarregCampo);
                if(dt) {
                    const parts = dt.split('/');
                    if(parts.length === 3) {
                        mesesUnicos.add(`${parts[1]}/${parts[2]}`); 
                    }
                }
            });

            const mesesArray = Array.from(mesesUnicos).sort((a, b) => {
                const [mA, yA] = a.split('/');
                const [mB, yB] = b.split('/');
                return new Date(yB, mB - 1) - new Date(yA, mA - 1);
            });

            const valorAtual = selectMes.value;
            selectMes.innerHTML = '<option value="" class="bg-slate-800 text-slate-300">Selecione um Mês</option>';
            
            mesesArray.forEach(mesAno => {
                const [m, y] = mesAno.split('/');
                const nomeMes = mesesNomes[m] || m;
                const anoCurto = y.substring(2); 
                const label = `${nomeMes}/${anoCurto}`;
                
                const option = document.createElement('option');
                option.value = mesAno;
                option.className = "bg-slate-800 text-white font-bold";
                option.textContent = label;
                selectMes.appendChild(option);
            });

            if (valorAtual && mesesArray.includes(valorAtual)) {
                selectMes.value = valorAtual;
            } else if (mesesArray.length > 0) {
                selectMes.value = mesesArray[0];
            }
        } catch(e) {
            console.error("[DESEMPENHO GRUA] Erro em popularDropdownMeses:", e);
        }
    }

    async function buscarDadosSupabaseGrua() {
        const client = getSupabaseClient();
        const tbody = document.getElementById('tbodyQuadroGruas');
        
        if (!client) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-rose-500">Erro: SupabaseClient não encontrado.</td></tr>`;
            return;
        }

        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center p-12 text-slate-500"><i class="fas fa-spinner fa-spin mr-2 text-emerald-500"></i> Buscando configurações de frentes Próprias...</td></tr>`;
        
        try {
            // =========================================================================
            // 1. BUSCAR CONFIGURAÇÃO DE GRUAS PRÓPRIAS PRIMEIRO
            // =========================================================================
            let frentesQuery = client.from('config_gruas').select('*').eq('tipo_frente', 'Propria');
            
            // Aplica filtro de filial se existir globalmente
            if (typeof window.aplicarFiltroFilial === 'function') {
                frentesQuery = window.aplicarFiltroFilial(frentesQuery);
            } else if (typeof window.aplicarFiltroLocal === 'function') {
                frentesQuery = window.aplicarFiltroLocal(frentesQuery);
            }

            const { data: frentes } = await frentesQuery;

            gruasPropriasPermitidas = [];
            if (frentes) {
                frentes.forEach(f => {
                    if (f.codigos) {
                        const cods = f.codigos.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
                        gruasPropriasPermitidas.push(...cods);
                    }
                });
            }
            // Remove duplicatas caso exista
            gruasPropriasPermitidas = [...new Set(gruasPropriasPermitidas)];
            console.log("[DESEMPENHO GRUA] Filtro Ativado - Gruas Próprias Permitidas:", gruasPropriasPermitidas);

            if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center p-12 text-slate-500"><i class="fas fa-spinner fa-spin mr-2 text-emerald-500"></i> Extraindo histórico operacional...</td></tr>`;

            // =========================================================================
            // 2. BUSCAR DADOS DO HISTÓRICO
            // =========================================================================
            dadosHistoricoCompletosGrua = [];
            let from = 0;
            const step = 1000;
            let fetchMore = true;

            while (fetchMore) {
                let query = client
                    .from('historico_viagens')
                    .select('*') 
                    .ilike('transportadora', '%SERRANALOG%')
                    .range(from, from + step - 1);
                    
                if (typeof window.aplicarFiltroFilial === 'function') {
                    query = window.aplicarFiltroFilial(query);
                } else if (typeof window.aplicarFiltroLocal === 'function') {
                    query = window.aplicarFiltroLocal(query);
                }

                const { data, error } = await query;
                
                if (error) {
                    console.error("[DESEMPENHO GRUA] Erro ao buscar historico:", error);
                    break;
                }
                
                if (data && data.length > 0) {
                    dadosHistoricoCompletosGrua = dadosHistoricoCompletosGrua.concat(data);
                    from += step;
                }
                
                if (!data || data.length < step) {
                    fetchMore = false;
                }
            }

            console.log(`[DESEMPENHO GRUA] Concluído! Viagens lidas: ${dadosHistoricoCompletosGrua.length}`);
            popularDropdownMesesGrua(dadosHistoricoCompletosGrua);
            processarEExibirDadosGrua();
            
        } catch (e) {
            console.error("[DESEMPENHO GRUA] Erro global na busca de dados:", e);
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-rose-500 bg-rose-900/20">Erro ao carregar dados. Verifique a conexão ou o console (F12).</td></tr>`;
        }
    }

    function processarEExibirDadosGrua() {
        try {
            let dadosFiltrados = [];

            // Aplica os filtros de Data/Período
            if (activeFilter === 'D-1') {
                const d = getPastDateStringGrua(1);
                dadosFiltrados = dadosHistoricoCompletosGrua.filter(x => convertDateFromBaseStr(x.dtFimCarregCampo) === d);
            } else if (activeFilter === 'D-2') {
                const d = getPastDateStringGrua(2);
                dadosFiltrados = dadosHistoricoCompletosGrua.filter(x => convertDateFromBaseStr(x.dtFimCarregCampo) === d);
            } else if (activeFilter === 'D-7') {
                const dias = [];
                for(let i=1; i<=7; i++) {
                    dias.push(getPastDateStringGrua(i));
                }
                dadosFiltrados = dadosHistoricoCompletosGrua.filter(x => dias.includes(convertDateFromBaseStr(x.dtFimCarregCampo)));
            } else if (activeFilter === 'CUSTOM' && customDateStr) {
                dadosFiltrados = dadosHistoricoCompletosGrua.filter(x => convertDateFromBaseStr(x.dtFimCarregCampo) === customDateStr);
            } else if (activeFilter === 'MES') {
                const filterMes = document.getElementById('filterMesGrua');
                const selectedMesAno = filterMes ? filterMes.value : null;
                dadosFiltrados = dadosHistoricoCompletosGrua.filter(x => {
                    const dt = convertDateFromBaseStr(x.dtFimCarregCampo);
                    if(!dt || !selectedMesAno) return false;
                    const parts = dt.split('/');
                    if (`${parts[1]}/${parts[2]}` === selectedMesAno) return true;
                    return false;
                });
            }

            // =========================================================================
            // APLICA O FILTRO DE GRUAS PRÓPRIAS E EXCLUI AS VAZIAS
            // =========================================================================
            dadosFiltrados = dadosFiltrados.filter(x => {
                if (!x.grua || x.grua.trim() === '') return false;
                const gruaFormatada = x.grua.trim().toUpperCase();
                return gruasPropriasPermitidas.includes(gruaFormatada);
            });

            const statsPorGrua = {};
            let totais = { viagens: 0, volume: 0, gruasUnicas: new Set() };

            dadosFiltrados.forEach(registro => {
                const nomeGrua = registro.grua.trim().toUpperCase();
                const dia = convertDateFromBaseStr(registro.dtFimCarregCampo);
                
                if(!statsPorGrua[nomeGrua]) {
                    statsPorGrua[nomeGrua] = {
                        viagens: 0,
                        volumeTotal: 0,
                        minutosCarregamentoTotais: 0,
                        viagensComTempoValido: 0,
                        diasOperados: new Set()
                    };
                }

                statsPorGrua[nomeGrua].viagens += 1;
                statsPorGrua[nomeGrua].volumeTotal += (registro.volumeReal || 0);
                statsPorGrua[nomeGrua].diasOperados.add(dia);
                
                totais.viagens += 1;
                totais.volume += (registro.volumeReal || 0);
                totais.gruasUnicas.add(nomeGrua);

                const mins = calcularMinutosEntreHoras(registro.hrInicioCarregCampo, registro.hrFimCarregCampo);
                if(mins > 0) {
                    statsPorGrua[nomeGrua].minutosCarregamentoTotais += mins;
                    statsPorGrua[nomeGrua].viagensComTempoValido += 1;
                }
            });

            listaQuadroGruasAtual = [];
            let somaMinutosGeral = 0;
            let qtdViagensTempoGeral = 0;

            for (const grua in statsPorGrua) {
                const st = statsPorGrua[grua];
                
                const minMedios = st.viagensComTempoValido > 0 ? (st.minutosCarregamentoTotais / st.viagensComTempoValido) : 0;
                
                somaMinutosGeral += st.minutosCarregamentoTotais;
                qtdViagensTempoGeral += st.viagensComTempoValido;

                listaQuadroGruasAtual.push({
                    grua: grua,
                    diasOperados: st.diasOperados.size,
                    viagensTotais: st.viagens,
                    tempoMedioMinutos: minMedios,
                    volumeTotal: st.volumeTotal
                });
            }

            // Atualiza Cards Superiores
            const cardTotalGruas = document.getElementById('cardTotalGruas');
            if (cardTotalGruas) cardTotalGruas.innerText = totais.gruasUnicas.size;
            
            const cardTotalViagensGrua = document.getElementById('cardTotalViagensGrua');
            if (cardTotalViagensGrua) cardTotalViagensGrua.innerText = totais.viagens;
            
            const cardVolumeTotalGrua = document.getElementById('cardVolumeTotalGrua');
            if (cardVolumeTotalGrua) cardVolumeTotalGrua.innerText = totais.volume.toLocaleString('pt-BR', {maximumFractionDigits:1});
            
            const cardTempoMedioGrua = document.getElementById('cardTempoMedioGrua');
            if (cardTempoMedioGrua) {
                const tempoGeralMedio = qtdViagensTempoGeral > 0 ? (somaMinutosGeral / qtdViagensTempoGeral) : 0;
                cardTempoMedioGrua.innerText = formatarMinutosParaHora(tempoGeralMedio);
            }

            // Ordena pelo maior número de viagens primeiro
            listaQuadroGruasAtual.sort((a, b) => b.viagensTotais - a.viagensTotais);
            preencherQuadroGruas(listaQuadroGruasAtual);

        } catch (erroInterface) {
            console.error("[DESEMPENHO GRUA] Erro Crítico ao processar:", erroInterface);
        }
    }

    function preencherQuadroGruas(lista) {
        try {
            const tbody = document.getElementById('tbodyQuadroGruas');
            if (!tbody) return; 
            tbody.innerHTML = '';

            if(lista.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center p-12 text-slate-500 bg-slate-900/30">Nenhum dado encontrado ou nenhuma <b>Grua Própria</b> cadastrada no painel de Metas.</td></tr>`;
                return;
            }

            // Encontra o volume máximo para a barra de progresso visual
            const maxVolume = Math.max(...lista.map(r => r.volumeTotal), 0);

            lista.forEach(r => {
                const volFormat = r.volumeTotal.toLocaleString('pt-BR', {maximumFractionDigits:2});
                const tempoFormat = formatarMinutosParaHora(r.tempoMedioMinutos);
                const widthPct = maxVolume > 0 ? (r.volumeTotal / maxVolume) * 100 : 0;

                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-800/40 transition-colors group border-b border-slate-700/50 last:border-0";
                
                // HTML Moderno da Tabela
                tr.innerHTML = `
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-full bg-emerald-900/30 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner group-hover:scale-110 transition-transform">
                                <i class="fas fa-truck-loading text-[11px]"></i>
                            </div>
                            <span class="bg-slate-900 px-3 py-1.5 rounded-md border border-slate-700/80 font-mono tracking-widest text-sky-100 text-xs font-bold shadow-sm">${r.grua}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-center text-sm text-slate-300 font-mono font-medium">${r.diasOperados}</td>
                    <td class="px-6 py-4 text-center text-sm font-black text-sky-400 drop-shadow-sm">${r.viagensTotais}</td>
                    <td class="px-6 py-4 text-center">
                        <div class="bg-purple-900/20 inline-flex items-center px-3 py-1 rounded-md text-purple-300 border border-purple-500/20 shadow-inner text-xs font-mono font-bold">
                            <i class="far fa-clock mr-2 opacity-70"></i> ${tempoFormat}
                        </div>
                    </td>
                    <td class="px-6 py-4 text-right">
                        <div class="flex flex-col items-end gap-1.5">
                            <span class="text-xs font-mono font-bold text-amber-400 drop-shadow-sm">${volFormat}</span>
                            <div class="w-32 h-1.5 bg-slate-900/80 rounded-full overflow-hidden border border-slate-700/50 shadow-inner" title="${widthPct.toFixed(1)}% do volume máximo do período">
                                <div class="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-1000 ease-out" style="width: ${widthPct}%"></div>
                            </div>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch(e) { console.error("[DESEMPENHO GRUA] Erro em preencherQuadroGruas:", e); }
    }

    function exportarParaExcelGrua() {
        if (listaQuadroGruasAtual.length === 0) {
            alert("Não há dados para exportar no período selecionado.");
            return;
        }

        const filterMes = document.getElementById('filterMesGrua');
        const nomeMes = filterMes && filterMes.options[filterMes.selectedIndex] ? filterMes.options[filterMes.selectedIndex].text : 'Periodo';

        const dadosExcel = listaQuadroGruasAtual.map(r => ({
            "Grua Própria": r.grua,
            "Dias Operados": r.diasOperados,
            "Total de Viagens": r.viagensTotais,
            "Tempo Médio Carregamento": formatarMinutosParaHora(r.tempoMedioMinutos),
            "Volume Total (m³)": parseFloat(r.volumeTotal.toFixed(2))
        }));

        if(typeof XLSX !== 'undefined') {
            const ws = XLSX.utils.json_to_sheet(dadosExcel);
            const wb = XLSX.utils.book_new();

            XLSX.utils.book_append_sheet(wb, ws, "Gruas_Proprias");

            const fileName = `Desempenho_Gruas_Proprias_${nomeMes.replace('/', '_')}.xlsx`;
            XLSX.writeFile(wb, fileName);
        } else {
            alert("A biblioteca Excel não carregou. Tente novamente em instantes.");
        }
    }
})();