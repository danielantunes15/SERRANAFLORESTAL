// ==========================================
// js/desempenho_grua.js - LÓGICA DE GRUAS (PRODUÇÃO + METAS INTEGRADAS)
// ==========================================

(function() {
    var dadosHistoricoCompletosGrua = []; 
    var dadosGlobaisAbastecimento = []; // Dados em memória da Planilha do Google
    var listaQuadroGruasAtual = []; 
    var gruasPropriasPermitidas = []; 
    var graficoGruasInstancia = null; 

    var activeFilter = 'MES'; 
    var customDateStr = ''; 
    
    // Planilha Google de Abastecimentos
    const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1uQekwV3xaU-EIGikUaaeik_SdhtQLueaBPCVslUB3kY/export?format=csv&gid=1959920910";

    function getSupabaseClient() {
        if (window.supabaseClient) return window.supabaseClient;
        if (typeof supabaseClient !== 'undefined') return supabaseClient;
        console.error("[DESEMPENHO GRUA] FATAL: Nenhum cliente Supabase encontrado!");
        return null;
    }

    window.initDesempenhoGrua = function() {
        setupFiltersGrua();
        buscarDadosSupabaseGrua(); 
        buscarDadosPlanilhaAbastecimento(); // Busca simultânea
    };

    // =====================================
    // FUNÇÕES DE TRATAMENTO DE DATAS (SUPABASE & SHEETS)
    // =====================================
    function convertDateFromBaseStr(dateStr) {
        if(!dateStr) return '';
        if(dateStr.includes('-')) {
            const parts = dateStr.split('-');
            if(parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
    }

    function parseDataPlanilha(strData) {
        if (!strData) return null;
        let partes = strData.trim().split(' ');
        let dataParte = partes[0]; 
        let dma = dataParte.split('/');
        
        if (dma.length === 3) {
            let p1 = parseInt(dma[0]); 
            let p2 = parseInt(dma[1]); 
            let p3 = parseInt(dma[2]);
            
            if (p2 > 12) { return new Date(p3, p1 - 1, p2); } 
            else if (p1 > 12) { return new Date(p3, p2 - 1, p1); } 
            else {
                let nativo = new Date(strData);
                if (!isNaN(nativo.getTime())) return nativo;
                return new Date(p3, p1 - 1, p2); 
            }
        }
        let fallback = new Date(strData);
        if (!isNaN(fallback.getTime())) return fallback;
        return null;
    }

    function formatDateToDDMMYYYY(dateObj) {
        if (!dateObj) return null;
        const d = String(dateObj.getDate()).padStart(2, '0');
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const y = dateObj.getFullYear();
        return `${d}/${m}/${y}`;
    }

    function getPastDateStringGrua(daysAgo) {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${d}/${m}/${y}`;
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
        } catch(e) { return 0; }
    }

    function formatarMinutosParaHora(minutosTotais) {
        if (isNaN(minutosTotais) || minutosTotais <= 0) return '00:00';
        const h = Math.floor(minutosTotais / 60);
        const m = Math.floor(minutosTotais % 60);
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    }

    function parseBR(str) {
        if (!str) return 0;
        let s = str.toString().trim();
        if (s.includes(',')) {
            return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
        }
        return parseFloat(s) || 0;
    }

    // =====================================
    // CONTROLES DE FILTRO DA INTERFACE
    // =====================================
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
                b.classList.add('bg-emerald-500/20', 'text-emerald-400', 'active', 'border-emerald-500/50');
                b.classList.remove('bg-transparent', 'text-slate-400');
            } else {
                b.classList.remove('bg-emerald-500/20', 'text-emerald-400', 'active', 'border-emerald-500/50');
                b.classList.add('bg-transparent', 'text-slate-400');
            }
        });
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
        } catch(e) {}
    }

    // =====================================
    // COMUNICAÇÃO DE DADOS (SUPABASE + SHEETS)
    // =====================================
    async function buscarDadosPlanilhaAbastecimento() {
        const infoLabelKpi = document.getElementById('loadingKpiInfoAbast');
        try {
            const response = await fetch(SHEET_CSV_URL);
            if (!response.ok) throw new Error("Falha ao buscar CSV");
            const csvText = await response.text();

            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    dadosGlobaisAbastecimento = results.data;
                    if(infoLabelKpi) infoLabelKpi.innerText = "";
                    processarIntegracaoCards();
                }
            });
        } catch(e) {
            console.error("[DESEMPENHO GRUA] Erro ao buscar Google Sheets:", e);
            if(infoLabelKpi) infoLabelKpi.innerText = "(Erro na Planilha de Abastecimento)";
        }
    }

    async function buscarDadosSupabaseGrua() {
        const client = getSupabaseClient();
        const tbody = document.getElementById('tbodyQuadroGruas');
        const loadingChart = document.getElementById('chartLoading');
        
        if (!client) return;
        if (loadingChart) loadingChart.style.display = 'flex';
        
        try {
            let frentesQuery = client.from('config_gruas').select('*').eq('tipo_frente', 'Propria');
            if (typeof window.aplicarFiltroFilial === 'function') frentesQuery = window.aplicarFiltroFilial(frentesQuery);

            const { data: frentes } = await frentesQuery;
            gruasPropriasPermitidas = [];
            if (frentes) {
                frentes.forEach(f => {
                    if (f.codigos) gruasPropriasPermitidas.push(...f.codigos.split(',').map(c => c.trim().toUpperCase()).filter(Boolean));
                });
            }
            gruasPropriasPermitidas = [...new Set(gruasPropriasPermitidas)];

            dadosHistoricoCompletosGrua = [];
            let from = 0;
            const step = 1000;
            let fetchMore = true;

            while (fetchMore) {
                let query = client.from('historico_viagens').select('*').ilike('transportadora', '%SERRANALOG%').range(from, from + step - 1);
                if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);

                const { data, error } = await query;
                if (error) break;
                if (data && data.length > 0) {
                    dadosHistoricoCompletosGrua = dadosHistoricoCompletosGrua.concat(data);
                    from += step;
                }
                if (!data || data.length < step) fetchMore = false;
            }

            popularDropdownMesesGrua(dadosHistoricoCompletosGrua);
            processarEExibirDadosGrua();
            
        } catch (e) {
            console.error("[DESEMPENHO GRUA] Erro global:", e);
            if (loadingChart) loadingChart.style.display = 'none';
        }
    }

    // =====================================
    // PROCESSAMENTO CENTRAL (DISPARADO PELO FILTRO)
    // =====================================
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
                for(let i=1; i<=7; i++) dias.push(getPastDateStringGrua(i));
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

            dadosFiltrados = dadosFiltrados.filter(x => {
                if (!x.grua || x.grua.trim() === '') return false;
                return gruasPropriasPermitidas.includes(x.grua.trim().toUpperCase());
            });

            const statsPorGrua = {};
            let totais = { viagens: 0, volume: 0, gruasUnicas: new Set() };

            dadosFiltrados.forEach(registro => {
                const nomeGrua = registro.grua.trim().toUpperCase();
                const dia = convertDateFromBaseStr(registro.dtFimCarregCampo);
                
                if(!statsPorGrua[nomeGrua]) {
                    statsPorGrua[nomeGrua] = { viagens: 0, volumeTotal: 0, minutosCarregamentoTotais: 0, viagensComTempoValido: 0, diasOperados: new Set() };
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

            listaQuadroGruasAtual.sort((a, b) => b.viagensTotais - a.viagensTotais);
            preencherQuadroGruas(listaQuadroGruasAtual);
            atualizarGraficoGruas(listaQuadroGruasAtual);

            processarIntegracaoCards();

        } catch (erroInterface) {
            console.error("[DESEMPENHO GRUA] Erro Crítico ao processar:", erroInterface);
        }
    }

    function processarIntegracaoCards() {
        const kpiContainer = document.getElementById('kpiContainerIntegrado');
        if (!kpiContainer) return;

        // Filtra a Planilha Baseada na mesma Regra de Data do Supabase
        let maquinasAbastecimento = {};
        
        if (dadosGlobaisAbastecimento && dadosGlobaisAbastecimento.length > 0) {
            let dadosFiltradosAbast = dadosGlobaisAbastecimento.filter(row => {
                const colunas = Object.keys(row);
                const colData = colunas.find(c => c.toLowerCase().includes('data/hora') || c.toLowerCase() === 'data');
                
                if (!colData || !row[colData]) return false;

                let dataRowObj = parseDataPlanilha(row[colData]);
                if (!dataRowObj) return false;

                const dataStr = formatDateToDDMMYYYY(dataRowObj);

                if (activeFilter === 'D-1') return dataStr === getPastDateStringGrua(1);
                if (activeFilter === 'D-2') return dataStr === getPastDateStringGrua(2);
                if (activeFilter === 'D-7') {
                    const dias = [];
                    for(let i=1; i<=7; i++) dias.push(getPastDateStringGrua(i));
                    return dias.includes(dataStr);
                }
                if (activeFilter === 'CUSTOM' && customDateStr) {
                    return dataStr === customDateStr;
                }
                if (activeFilter === 'MES') {
                    const filterMes = document.getElementById('filterMesGrua');
                    const selectedMesAno = filterMes ? filterMes.value : null;
                    if(!selectedMesAno) return false;
                    
                    const m = String(dataRowObj.getMonth() + 1).padStart(2, '0');
                    const y = dataRowObj.getFullYear();
                    return `${m}/${y}` === selectedMesAno;
                }
                return false;
            });

            const colunasBase = Object.keys(dadosFiltradosAbast[0] || dadosGlobaisAbastecimento[0] || {});
            const colunasNorm = colunasBase.map(c => c.toLowerCase().replace(/\s/g, ''));
            
            const idxGrua = colunasNorm.findIndex(c => c.includes('grua') || c.includes('maquina') || c.includes('frota'));
            const idxMedia = colunasNorm.findIndex(c => c.includes('lts/hmaq') || c.includes('media'));

            const colGrua = colunasBase[idxGrua];
            const colMediaLtsH = colunasBase[idxMedia];

            if (colGrua && colMediaLtsH) {
                dadosFiltradosAbast.forEach(item => {
                    let nomeGrua = item[colGrua] ? item[colGrua].trim().toUpperCase() : 'N/A';
                    
                    if (gruasPropriasPermitidas.length > 0 && !gruasPropriasPermitidas.includes(nomeGrua)) {
                        return; 
                    }

                    let valMedia = parseBR(item[colMediaLtsH]);
                    if (valMedia > 0) {
                        if (!maquinasAbastecimento[nomeGrua]) {
                            maquinasAbastecimento[nomeGrua] = { somaMedia: 0, count: 0 };
                        }
                        maquinasAbastecimento[nomeGrua].somaMedia += valMedia;
                        maquinasAbastecimento[nomeGrua].count += 1;
                    }
                });
            }
        }

        // ==============================================================
        // MONTAGEM DOS CARDS INTEGRADOS (PRODUÇÃO + METAS ESTABELECIDAS)
        // ==============================================================
        let htmlKpi = '';
        
        let todasAsGruasSet = new Set([...listaQuadroGruasAtual.map(g => g.grua), ...Object.keys(maquinasAbastecimento)]);
        let todasAsGruas = Array.from(todasAsGruasSet).sort();

        if (todasAsGruas.length === 0) {
            kpiContainer.innerHTML = '<div class="col-span-full text-slate-400 text-sm font-medium bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">Nenhum dado encontrado para o período.</div>';
            return;
        }

        todasAsGruas.forEach(maq => {
            let prod = listaQuadroGruasAtual.find(g => g.grua === maq);
            let abast = maquinasAbastecimento[maq];

            let volume = prod ? prod.volumeTotal : 0;
            let viagens = prod ? prod.viagensTotais : 0;
            let tempoMedio = prod ? prod.tempoMedioMinutos : 0;
            let caixaMedia = viagens > 0 ? (volume / viagens) : 0;
            let consumoLH = abast && abast.count > 0 ? (abast.somaMedia / abast.count) : 0;

            // Metas Definidas
            // 1. Tempo Médio <= 30 min
            let tempoCor = (tempoMedio > 0 && tempoMedio <= 30) ? 'text-emerald-400' : (tempoMedio === 0 ? 'text-slate-500' : 'text-rose-500');
            let tempoIcone = (tempoMedio > 0 && tempoMedio <= 30) ? 'fa-check-circle text-emerald-500' : (tempoMedio === 0 ? 'fa-minus-circle text-slate-600' : 'fa-times-circle text-rose-500');
            
            // 2. Caixa de Carga >= 62 m³
            let caixaCor = (caixaMedia >= 62) ? 'text-emerald-400' : (caixaMedia === 0 ? 'text-slate-500' : 'text-rose-500');
            let caixaIcone = (caixaMedia >= 62) ? 'fa-check-circle text-emerald-500' : (caixaMedia === 0 ? 'fa-minus-circle text-slate-600' : 'fa-times-circle text-rose-500');

            // 3. Consumo < 13 L/H
            let consumoCor = (consumoLH > 0 && consumoLH < 13) ? 'text-emerald-400' : (consumoLH === 0 ? 'text-slate-500' : 'text-rose-500');
            let consumoIcone = (consumoLH > 0 && consumoLH < 13) ? 'fa-check-circle text-emerald-500' : (consumoLH === 0 ? 'fa-minus-circle text-slate-600' : 'fa-times-circle text-rose-500');

            // Status da Borda do Card (Verde se bateu tudo, Vermelho se falhou algo, Neutro se não operou)
            let hasBad = (tempoMedio > 30) || (caixaMedia > 0 && caixaMedia < 62) || (consumoLH >= 13);
            let hasGood = (tempoMedio > 0 && tempoMedio <= 30) || (caixaMedia >= 62) || (consumoLH > 0 && consumoLH < 13);
            let cardBorder = (hasGood && !hasBad) ? 'border-emerald-500/50' : (hasBad ? 'border-rose-500/30' : 'border-slate-700/60');

            htmlKpi += `
                <div class="bg-slate-800/80 p-5 rounded-2xl border ${cardBorder} shadow-xl relative overflow-hidden group hover:border-slate-500/40 transition-all backdrop-blur-sm flex flex-col gap-3">
                    <div class="flex justify-between items-center border-b border-slate-700/50 pb-2">
                        <h4 class="text-sky-400 text-lg font-black uppercase tracking-widest">${maq}</h4>
                        <span class="text-[10px] font-bold text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-700">${viagens} Viagens</span>
                    </div>
                    
                    <div class="flex flex-col gap-2.5 mt-1">
                        <!-- Produção Total -->
                        <div class="flex justify-between items-center bg-slate-900/40 p-2 rounded-lg border border-slate-800">
                            <span class="text-xs text-slate-400 font-semibold"><i class="fas fa-cube w-4 text-amber-500/70"></i> Prod. Total</span>
                            <span class="text-sm font-bold text-white">${volume.toLocaleString('pt-BR', {minimumFractionDigits:1})} m³</span>
                        </div>
                        
                        <!-- Tempo Médio -->
                        <div class="flex justify-between items-center">
                            <span class="text-xs text-slate-400 font-semibold"><i class="fas fa-stopwatch w-4 text-purple-400/70"></i> T. Médio <span class="text-[9px] opacity-60">(≤30m)</span></span>
                            <div class="flex items-center gap-1.5">
                                <span class="text-sm font-bold ${tempoCor}">${formatarMinutosParaHora(tempoMedio)}</span>
                                <i class="fas ${tempoIcone}"></i>
                            </div>
                        </div>

                        <!-- Caixa de Carga -->
                        <div class="flex justify-between items-center">
                            <span class="text-xs text-slate-400 font-semibold"><i class="fas fa-box-open w-4 text-amber-600/70"></i> Cx. Carga <span class="text-[9px] opacity-60">(≥62m³)</span></span>
                            <div class="flex items-center gap-1.5">
                                <span class="text-sm font-bold ${caixaCor}">${caixaMedia.toLocaleString('pt-BR', {minimumFractionDigits:1})} m³</span>
                                <i class="fas ${caixaIcone}"></i>
                            </div>
                        </div>

                        <!-- Consumo LTS/H -->
                        <div class="flex justify-between items-center pt-1 border-t border-slate-700/50">
                            <span class="text-xs text-slate-400 font-semibold"><i class="fas fa-gas-pump w-4 text-sky-400/70"></i> Consumo <span class="text-[9px] opacity-60">(<13 L/h)</span></span>
                            <div class="flex items-center gap-1.5">
                                <span class="text-sm font-bold ${consumoCor}">${consumoLH > 0 ? consumoLH.toFixed(2) + ' L/H' : '-'}</span>
                                <i class="fas ${consumoIcone}"></i>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        kpiContainer.innerHTML = htmlKpi;
    }

    // ==========================================
    // PREENCHIMENTO DA TABELA DETALHADA E GRÁFICO
    // ==========================================
    function preencherQuadroGruas(lista) {
        try {
            const tbody = document.getElementById('tbodyQuadroGruas');
            if (!tbody) return; 
            tbody.innerHTML = '';

            if(lista.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center p-12 text-slate-500 bg-slate-900/30">Nenhum dado encontrado para as <b>Gruas Próprias</b> no período selecionado.</td></tr>`;
                return;
            }

            const maxVolume = Math.max(...lista.map(r => r.volumeTotal), 0);

            lista.forEach(r => {
                const volFormat = r.volumeTotal.toLocaleString('pt-BR', {maximumFractionDigits:2});
                const tempoFormat = formatarMinutosParaHora(r.tempoMedioMinutos);
                const widthPct = maxVolume > 0 ? (r.volumeTotal / maxVolume) * 100 : 0;

                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-700/50 transition-colors group border-b border-slate-700/50 last:border-0";
                
                tr.innerHTML = `
                    <td class="px-5 py-4">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-emerald-900/30 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner group-hover:scale-110 transition-transform">
                                <i class="fas fa-truck-loading text-[10px]"></i>
                            </div>
                            <span class="bg-slate-950 px-2 py-1 rounded-md border border-slate-700/80 font-mono tracking-widest text-sky-100 text-xs font-bold shadow-sm">${r.grua}</span>
                        </div>
                    </td>
                    <td class="px-5 py-4 text-center text-sm text-slate-300 font-mono font-medium">${r.diasOperados}</td>
                    <td class="px-5 py-4 text-center text-sm font-black text-sky-400 drop-shadow-sm">${r.viagensTotais}</td>
                    <td class="px-5 py-4 text-center">
                        <div class="bg-purple-900/20 inline-flex items-center px-2.5 py-1 rounded text-purple-300 border border-purple-500/20 shadow-inner text-xs font-mono font-bold">
                            <i class="far fa-clock mr-1.5 opacity-70"></i> ${tempoFormat}
                        </div>
                    </td>
                    <td class="px-5 py-4 text-right">
                        <div class="flex flex-col items-end gap-1.5 w-full">
                            <span class="text-xs font-mono font-bold text-amber-400 drop-shadow-sm">${volFormat}</span>
                            <div class="w-24 lg:w-32 h-1.5 bg-slate-900/80 rounded-full overflow-hidden border border-slate-700/50 shadow-inner" title="${widthPct.toFixed(1)}% do max">
                                <div class="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-1000 ease-out" style="width: ${widthPct}%"></div>
                            </div>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch(e) { }
    }

    function atualizarGraficoGruas(lista) {
        const loadingDiv = document.getElementById('chartLoading');
        if (loadingDiv) loadingDiv.style.display = 'none';

        const ctx = document.getElementById('graficoGruasProprias');
        if (!ctx) return;

        if (graficoGruasInstancia) graficoGruasInstancia.destroy();

        const topGruas = lista.slice(0, 10);
        const labels = topGruas.map(g => g.grua);
        const dataVolume = topGruas.map(g => g.volumeTotal.toFixed(2));
        const dataViagens = topGruas.map(g => g.viagensTotais);

        const desenharValoresNasBarras = {
            id: 'desenharValoresNasBarras',
            afterDatasetsDraw(chart, args, options) {
                const { ctx } = chart;
                chart.data.datasets.forEach((dataset, i) => {
                    if (i !== 0) return; 
                    const meta = chart.getDatasetMeta(i);
                    if (!meta.hidden) {
                        meta.data.forEach((element, index) => {
                            const valor = dataset.data[index];
                            if (!valor || valor == 0) return;

                            ctx.fillStyle = '#000000'; 
                            ctx.font = 'bold 13px Arial'; 
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            
                            const position = element.tooltipPosition();
                            let yPos = position.y + 14; 
                            
                            if (element.base - position.y < 25) {
                                yPos = position.y - 12; 
                                ctx.fillStyle = '#fbbf24'; 
                            }
                            ctx.fillText(valor, position.x, yPos);
                        });
                    }
                });
            }
        };

        graficoGruasInstancia = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Volume (m³)',
                        data: dataVolume,
                        backgroundColor: 'rgba(245, 158, 11, 0.9)', 
                        borderColor: 'rgba(245, 158, 11, 1)',
                        borderWidth: 1,
                        borderRadius: 4,
                        yAxisID: 'y',
                        order: 2
                    },
                    {
                        label: 'Nº Viagens',
                        data: dataViagens,
                        type: 'line',
                        backgroundColor: 'rgba(56, 189, 248, 1)', 
                        borderColor: 'rgba(56, 189, 248, 1)',
                        borderWidth: 3,
                        pointBackgroundColor: '#0f172a',
                        pointBorderColor: 'rgba(56, 189, 248, 1)',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        tension: 0.3,
                        yAxisID: 'y1',
                        order: 1
                    }
                ]
            },
            plugins: [desenharValoresNasBarras], 
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { labels: { color: '#cbd5e1', font: { family: 'monospace', size: 12 } }, position: 'top' },
                    tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.9)', titleColor: '#38bdf8', bodyColor: '#e2e8f0', borderColor: 'rgba(51, 65, 85, 0.8)', borderWidth: 1 }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(51, 65, 85, 0.3)', drawBorder: false },
                        ticks: { color: '#ffffff', font: { family: 'monospace', size: 13, weight: 'bold' } }
                    },
                    y: {
                        type: 'linear', display: true, position: 'left',
                        grid: { color: 'rgba(51, 65, 85, 0.3)', drawBorder: false },
                        ticks: { color: '#fbbf24', font: { size: 11, weight: 'bold' } }, 
                        title: { display: true, text: 'Volume (m³)', color: '#94a3b8', font: {size: 11} }
                    },
                    y1: {
                        type: 'linear', display: true, position: 'right',
                        grid: { drawOnChartArea: false }, 
                        ticks: { color: '#38bdf8', font: { size: 11, weight: 'bold' }, stepSize: 1 }, 
                        title: { display: true, text: 'Qtd. Viagens', color: '#94a3b8', font: {size: 11} }
                    }
                }
            }
        });
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