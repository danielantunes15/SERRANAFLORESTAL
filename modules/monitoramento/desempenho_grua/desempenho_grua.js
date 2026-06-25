// ==========================================
// js/desempenho_grua.js - LÓGICA DE GRUAS
// ==========================================

(function() {
    var dadosHistoricoCompletosGrua = []; 
    var listaQuadroGruasAtual = []; 

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
        // Assume que a string vem no formato '2026-06-25' ou parecida do banco, ou '25/06/2026'
        if(!dateStr) return '';
        if(dateStr.includes('-')) {
            const parts = dateStr.split('-');
            if(parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
    }

    // Calcula diferença entre hora inicio e fim (hh:mm) e retorna em minutos
    function calcularMinutosEntreHoras(hrInicio, hrFim) {
        if (!hrInicio || !hrFim) return 0;
        try {
            const [h1, m1] = hrInicio.split(':').map(Number);
            const [h2, m2] = hrFim.split(':').map(Number);
            
            let min1 = h1 * 60 + m1;
            let min2 = h2 * 60 + m2;
            
            // Se cruzou o dia
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
                b.classList.add('border-sky-500/50', 'text-sky-400', 'bg-sky-900/30', 'active');
                b.classList.remove('border-transparent', 'text-slate-400', 'hover:bg-slate-700/50');
            } else {
                b.classList.remove('border-sky-500/50', 'text-sky-400', 'bg-sky-900/30', 'active');
                b.classList.add('border-transparent', 'text-slate-400', 'hover:bg-slate-700/50');
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

        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-slate-500"><i class="fas fa-spinner fa-spin mr-2"></i> Buscando histórico da Serrana...</td></tr>`;
        
        try {
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
                    
                if (typeof window.aplicarFiltroLocal === 'function') {
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
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-rose-500">Erro ao carregar dados (F12).</td></tr>`;
        }
    }

    function processarEExibirDadosGrua() {
        try {
            let dadosFiltrados = [];

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

            // Exige que o campo grua esteja preenchido
            dadosFiltrados = dadosFiltrados.filter(x => x.grua && x.grua.trim() !== '');

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
            if (cardVolumeTotalGrua) cardVolumeTotalGrua.innerText = totais.volume.toLocaleString('pt-PT', {maximumFractionDigits:1});
            
            const cardTempoMedioGrua = document.getElementById('cardTempoMedioGrua');
            if (cardTempoMedioGrua) {
                const tempoGeralMedio = qtdViagensTempoGeral > 0 ? (somaMinutosGeral / qtdViagensTempoGeral) : 0;
                cardTempoMedioGrua.innerText = formatarMinutosParaHora(tempoGeralMedio);
            }

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
                tbody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-slate-500">Nenhum dado encontrado para o período e critérios.</td></tr>`;
                return;
            }

            lista.forEach(r => {
                const volFormat = r.volumeTotal.toLocaleString('pt-PT', {maximumFractionDigits:2});
                const tempoFormat = formatarMinutosParaHora(r.tempoMedioMinutos);

                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-700/30 transition-colors group";
                tr.innerHTML = `
                    <td class="px-6 py-3 text-sm font-bold text-white"><span class="bg-slate-900 px-2 py-1 rounded border border-slate-700 font-mono tracking-widest">${r.grua}</span></td>
                    <td class="px-6 py-3 text-center text-sm text-slate-300 font-mono">${r.diasOperados}</td>
                    <td class="px-6 py-3 text-center text-sm font-black text-emerald-400">${r.viagensTotais}</td>
                    <td class="px-6 py-3 text-center text-sm font-mono text-purple-400">${tempoFormat}</td>
                    <td class="px-6 py-3 text-right text-sm font-mono text-slate-400">${volFormat}</td>
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
            "Grua": r.grua,
            "Dias Operados": r.diasOperados,
            "Total de Viagens": r.viagensTotais,
            "Tempo Médio Carregamento": formatarMinutosParaHora(r.tempoMedioMinutos),
            "Volume Total (m³)": parseFloat(r.volumeTotal.toFixed(2))
        }));

        if(typeof XLSX !== 'undefined') {
            const ws = XLSX.utils.json_to_sheet(dadosExcel);
            const wb = XLSX.utils.book_new();

            XLSX.utils.book_append_sheet(wb, ws, "Desempenho Gruas");

            const fileName = `Desempenho_Gruas_SerranaLog_${nomeMes.replace('/', '_')}.xlsx`;
            XLSX.writeFile(wb, fileName);
        } else {
            alert("A biblioteca Excel não carregou. Tente novamente em instantes.");
        }
    }
})();