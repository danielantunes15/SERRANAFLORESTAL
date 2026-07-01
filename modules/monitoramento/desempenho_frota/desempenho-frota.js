// ==========================================
// js/desempenho-frota.js - LÓGICA DE FROTA (VOLUME EM M³)
// ==========================================

(function() {
    if(typeof Chart !== 'undefined') {
        Chart.register(ChartDataLabels);
        Chart.defaults.color = '#94a3b8';
        Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';
        Chart.defaults.font.family = "'Inter', sans-serif";
    }

    var dadosHistoricoCompletos = []; 
    var frotasTritremAtivas = []; // Nova variável para armazenar os cavalos ativos
    var listaQuadroGeralAtual = []; 
    var chartEvolucaoObj = null;
    var chartPlacasObj = null;
    var chartMelhoresObj = null;

    var activeFilter = 'MES'; 
    var customDateStr = ''; 

    // Retorna o cliente do Supabase de forma segura
    function getSupabaseClient() {
        if (window.supabaseClient) return window.supabaseClient;
        if (typeof supabaseClient !== 'undefined') return supabaseClient;
        console.error("[DESEMPENHO] FATAL: Nenhum cliente Supabase encontrado!");
        return null;
    }

    // =========================================================
    // INICIALIZAÇÃO INSTANTÂNEA SPA
    // =========================================================
    window.initDesempenhoFrota = function() {
        console.log("[DESEMPENHO] Módulo iniciado instantaneamente via SPA.");
        
        // Esconde o campo de meta global da tela, pois usaremos a meta de cada cavalo
        const metaInput = document.getElementById('metaViagens');
        if (metaInput && metaInput.parentElement) {
            metaInput.parentElement.style.display = 'none';
        }

        setupFilters();
        buscarDadosSupabase(); 
    };

    function formatarHorasDecimais(hDec) {
        if (!hDec || isNaN(hDec)) return '00h00m';
        const horas = Math.floor(hDec);
        const minutos = Math.round((hDec - horas) * 60);
        return `${String(horas).padStart(2,'0')}h${String(minutos).padStart(2,'0')}m`;
    }

    function normalizarPlaca(placa) {
        return placa ? placa.replace(/[^A-Z0-9]/ig, '').toUpperCase() : '';
    }

    function setupFilters() {
        const btnQFs = document.querySelectorAll('.btn-qf');
        const filterData = document.getElementById('filterDataFrota');
        const filterMes = document.getElementById('filterMesFrota');
        const btnExportar = document.getElementById('btnExportarExcel');

        btnQFs.forEach(btn => {
            btn.addEventListener('click', (e) => {
                activeFilter = e.currentTarget.getAttribute('data-qf');
                if(filterData) filterData.value = ''; 
                if(filterMes) filterMes.value = '';
                customDateStr = '';
                
                atualizarUIBotoes(btnQFs, activeFilter);
                processarEExibirDados();
            });
        });

        if(filterMes) {
            filterMes.addEventListener('change', (e) => {
                if(e.target.value) {
                    activeFilter = 'MES';
                    customDateStr = '';
                    if(filterData) filterData.value = '';
                    
                    atualizarUIBotoes(btnQFs, null); 
                    processarEExibirDados();
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
                    
                    atualizarUIBotoes(btnQFs, null);
                    processarEExibirDados();
                }
            });
        }

        if(btnExportar) {
            btnExportar.addEventListener('click', window.exportarParaExcelFrota);
        }
    }

    function atualizarUIBotoes(botoes, filtroAtivo) {
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

    function getPastDateString(daysAgo) {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${d}/${m}/${y}`;
    }

    function popularDropdownMeses(dados) {
        try {
            const selectMes = document.getElementById('filterMesFrota');
            if(!selectMes) return;

            const mesesNomes = {
                '01':'janeiro', '02':'fevereiro', '03':'março', '04':'abril',
                '05':'maio', '06':'junho', '07':'julho', '08':'agosto',
                '09':'setembro', '10':'outubro', '11':'novembro', '12':'dezembro'
            };

            const mesesUnicos = new Set();
            dados.forEach(d => {
                if(d.dataDaBaseExcel) {
                    const parts = d.dataDaBaseExcel.split('/');
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
            console.error("[DESEMPENHO] Erro em popularDropdownMeses:", e);
        }
    }

    async function buscarDadosSupabase() {
        const client = getSupabaseClient();
        const tbody1 = document.getElementById('tbodyQuadroGeral');
        const tbody2 = document.getElementById('tbodyFrota');
        
        if (!client) {
            if (tbody1) tbody1.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-rose-500">Erro: SupabaseClient não encontrado.</td></tr>`;
            return;
        }

        if (tbody1) tbody1.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-slate-500"><i class="fas fa-spinner fa-spin mr-2"></i> Buscando histórico da SERRANALOG...</td></tr>`;
        if (tbody2) tbody2.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-slate-500"><i class="fas fa-spinner fa-spin mr-2"></i> Buscando histórico da SERRANALOG...</td></tr>`;
        
        console.log("[DESEMPENHO] Buscando viagens da SERRANALOG e Cadastro de Frota...");

        try {
            // 1. Buscar a frota TRITREM ativa primeiro
            const { data: frotasData, error: frotasError } = await client
                .from('frotas_manutencao')
                .select('*')
                .eq('categoria', 'TRITREM')
                .eq('status', 'Ativo');
                
            if (!frotasError && frotasData) {
                frotasTritremAtivas = frotasData;
            }

            // 2. Buscar o histórico de viagens
            dadosHistoricoCompletos = [];
            let from = 0;
            const step = 1000;
            let fetchMore = true;

            while (fetchMore) {
                let query = client
                    .from('historico_viagens')
                    .select('*') 
                    .ilike('transportadora', '%SERRANALOG TRANSPORTES LTDA%')
                    .range(from, from + step - 1);
                    
                if (typeof window.aplicarFiltroLocal === 'function') {
                    query = window.aplicarFiltroLocal(query);
                }

                const { data, error } = await query;
                
                if (error) {
                    console.error("[DESEMPENHO] Erro ao buscar historico:", error);
                    break;
                }
                if (data && data.length > 0) {
                    dadosHistoricoCompletos = dadosHistoricoCompletos.concat(data);
                    from += step;
                }
                if (!data || data.length < step) {
                    fetchMore = false;
                }
            }

            console.log(`[DESEMPENHO] Concluído! Viagens: ${dadosHistoricoCompletos.length} | Tritrems Ativos: ${frotasTritremAtivas.length}`);
            popularDropdownMeses(dadosHistoricoCompletos);
            processarEExibirDados();
            
        } catch (e) {
            console.error("[DESEMPENHO] Erro global na busca de dados:", e);
            if (tbody1) tbody1.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-rose-500">Erro ao carregar dados (F12).</td></tr>`;
        }
    }

    function processarEExibirDados() {
        try {
            console.log("[DESEMPENHO] Processando dados para a tela...");
            
            // Cria um dicionário com os Tritrems ativos e suas respectivas metas
            const dictTritrem = {};
            let metaDiariaGlobal = 0;
            frotasTritremAtivas.forEach(f => {
                if(f.cavalo) {
                    const placaNorm = normalizarPlaca(f.cavalo);
                    const meta = parseInt(f.meta) || 0;
                    dictTritrem[placaNorm] = { meta: meta, info: f };
                    metaDiariaGlobal += meta;
                }
            });

            let dadosFiltrados = [];
            let diasParaGrafico = new Set(); 

            if (activeFilter === 'D-1') {
                const d = getPastDateString(1);
                dadosFiltrados = dadosHistoricoCompletos.filter(x => x.dataDaBaseExcel === d);
                diasParaGrafico.add(d);
            } else if (activeFilter === 'D-2') {
                const d = getPastDateString(2);
                dadosFiltrados = dadosHistoricoCompletos.filter(x => x.dataDaBaseExcel === d);
                diasParaGrafico.add(d);
            } else if (activeFilter === 'D-7') {
                const dias = [];
                for(let i=1; i<=7; i++) {
                    const d = getPastDateString(i);
                    dias.push(d);
                    diasParaGrafico.add(d);
                }
                dadosFiltrados = dadosHistoricoCompletos.filter(x => dias.includes(x.dataDaBaseExcel));
            } else if (activeFilter === 'CUSTOM' && customDateStr) {
                dadosFiltrados = dadosHistoricoCompletos.filter(x => x.dataDaBaseExcel === customDateStr);
                diasParaGrafico.add(customDateStr);
            } else if (activeFilter === 'MES') {
                const filterMesFrota = document.getElementById('filterMesFrota');
                const selectedMesAno = filterMesFrota ? filterMesFrota.value : null;
                dadosFiltrados = dadosHistoricoCompletos.filter(x => {
                    if(!x.dataDaBaseExcel || !selectedMesAno) return false;
                    const parts = x.dataDaBaseExcel.split('/');
                    if (`${parts[1]}/${parts[2]}` === selectedMesAno) {
                        diasParaGrafico.add(x.dataDaBaseExcel);
                        return true;
                    }
                    return false;
                });
            }

            // Filtra os dados históricos mantendo apenas os Tritrems Ativos cadastrados
            dadosFiltrados = dadosFiltrados.filter(x => {
                const placaNorm = normalizarPlaca(x.placa);
                return dictTritrem.hasOwnProperty(placaNorm);
            });

            const datasValidas = Array.from(diasParaGrafico).sort((a, b) => {
                const pA = a.split('/'); const pB = b.split('/');
                return new Date(pA[2], pA[1]-1, pA[0]) - new Date(pB[2], pB[1]-1, pB[0]);
            });

            const numDiasAnalisados = datasValidas.length > 0 ? datasValidas.length : 1;
            const agrupamentoDiario = {};
            const statsPorPlaca = {};

            dadosFiltrados.forEach(registro => {
                const dataStr = registro.dataDaBaseExcel;
                const placa = normalizarPlaca(registro.placa);
                
                if(!dataStr || !placa) return;

                if(!agrupamentoDiario[dataStr]) agrupamentoDiario[dataStr] = {};
                if(!agrupamentoDiario[dataStr][placa]) {
                    agrupamentoDiario[dataStr][placa] = { viagens: 0, volumeTotal: 0, tempoFilaTotal: 0 };
                }
                agrupamentoDiario[dataStr][placa].viagens += 1;
                agrupamentoDiario[dataStr][placa].volumeTotal += (registro.volumeReal || 0);
                agrupamentoDiario[dataStr][placa].tempoFilaTotal += (registro.filaCampoHoras || 0);

                if(!statsPorPlaca[placa]) {
                    statsPorPlaca[placa] = { 
                        viagensTotais: 0, 
                        volumeTotal: 0, 
                        cicloTotal: 0,
                        diasTrabalhados: new Set() 
                    };
                }
                statsPorPlaca[placa].viagensTotais += 1;
                statsPorPlaca[placa].volumeTotal += (registro.volumeReal || 0);
                statsPorPlaca[placa].cicloTotal += (registro.cicloHoras || 0);
                statsPorPlaca[placa].diasTrabalhados.add(dataStr);
            });

            listaQuadroGeralAtual = [];
            let qtdAcimaOuNaMeta = 0;
            let qtdAbaixoMetaGeral = 0;
            let somaViagensGeral = 0;

            // Avaliando todos os Tritrems ATIVOS (mesmo os que não rodaram)
            for (const placaNorm in dictTritrem) {
                const configCavalo = dictTritrem[placaNorm];
                const metaDoCavalo = configCavalo.meta;
                const placaOriginal = configCavalo.info.cavalo;

                const stats = statsPorPlaca[placaNorm] || { viagensTotais: 0, volumeTotal: 0, cicloTotal: 0, diasTrabalhados: new Set() };
                
                const media = stats.viagensTotais / numDiasAnalisados;
                const cicloMedio = stats.viagensTotais > 0 ? (stats.cicloTotal / stats.viagensTotais) : 0;

                listaQuadroGeralAtual.push({
                    placa: placaOriginal,
                    diasAnalisados: numDiasAnalisados,
                    viagensTotais: stats.viagensTotais,
                    mediaDiaria: media,
                    meta: metaDoCavalo,
                    cicloMedio: cicloMedio,
                    volumeTotal: stats.volumeTotal
                });

                if (media >= metaDoCavalo) {
                    qtdAcimaOuNaMeta++;
                } else {
                    qtdAbaixoMetaGeral++;
                }

                somaViagensGeral += stats.viagensTotais;
            }

            const totalCaminhoesUnicos = Object.keys(dictTritrem).length; // TRITREMs ativos
            
            const cardTotalCaminhoes = document.getElementById('cardTotalCaminhoes');
            if (cardTotalCaminhoes) cardTotalCaminhoes.innerText = totalCaminhoesUnicos;
            
            const cardAcimaMeta = document.getElementById('cardAcimaMeta');
            if (cardAcimaMeta) cardAcimaMeta.innerText = qtdAcimaOuNaMeta;
            
            const cardAbaixoMeta = document.getElementById('cardAbaixoMeta');
            if (cardAbaixoMeta) cardAbaixoMeta.innerText = qtdAbaixoMetaGeral;
            
            const cardMediaViagens = document.getElementById('cardMediaViagens');
            if (cardMediaViagens) {
                const metaTotalPeriodo = metaDiariaGlobal * numDiasAnalisados;
                cardMediaViagens.innerHTML = `<span class="text-3xl">${somaViagensGeral}</span> <span class="text-sm text-slate-400 font-normal">/ ${metaTotalPeriodo}</span>`;
                
                const subtituloMedia = cardMediaViagens.nextElementSibling;
                if(subtituloMedia) subtituloMedia.innerText = "Viagens Feitas / Meta Total no período";
            }

            const registrosAbaixoMeta = [];
            const evolucaoDiariaAbaixoMeta = {}; 
            let volumeTotalPerdido = 0; 

            datasValidas.forEach(dia => evolucaoDiariaAbaixoMeta[dia] = 0);

            for (const dia of datasValidas) {
                // Média global do dia para usar caso um cavalo tenha feito 0 viagens e não tenha caixa média real
                let volGlobalDia = 0; let viagGlobalDia = 0;
                if (agrupamentoDiario[dia]) {
                    for (const p in agrupamentoDiario[dia]) {
                        volGlobalDia += agrupamentoDiario[dia][p].volumeTotal;
                        viagGlobalDia += agrupamentoDiario[dia][p].viagens;
                    }
                }
                const mediaGlobalCaixaDia = viagGlobalDia > 0 ? (volGlobalDia / viagGlobalDia) : 115; // 115m³ é fallback de segurança para tritrem

                for (const placaNorm in dictTritrem) {
                    const configCavalo = dictTritrem[placaNorm];
                    const metaDoCavalo = configCavalo.meta;
                    const placaOriginal = configCavalo.info.cavalo;

                    const statsDia = (agrupamentoDiario[dia] && agrupamentoDiario[dia][placaNorm]) ? agrupamentoDiario[dia][placaNorm] : {viagens: 0, volumeTotal: 0, tempoFilaTotal: 0};

                    if(statsDia.viagens < metaDoCavalo) {
                        evolucaoDiariaAbaixoMeta[dia]++;
                        
                        const mediaDaCaixaNoDia = statsDia.viagens > 0 ? (statsDia.volumeTotal / statsDia.viagens) : mediaGlobalCaixaDia;
                        const viagensFaltantes = metaDoCavalo - statsDia.viagens;
                        const m3DeixouDeGanhar = viagensFaltantes * mediaDaCaixaNoDia;

                        volumeTotalPerdido += m3DeixouDeGanhar;

                        registrosAbaixoMeta.push({
                            data: dia,
                            placa: placaOriginal,
                            viagens: statsDia.viagens,
                            meta: metaDoCavalo,
                            viagensFaltantes: viagensFaltantes,
                            caixaMedia: mediaDaCaixaNoDia,
                            volumeDeixouDeGanhar: m3DeixouDeGanhar,
                            fila: statsDia.tempoFilaTotal
                        });
                    }
                }
            }

            const cardVolumePerdido = document.getElementById('cardVolumePerdido');
            if (cardVolumePerdido) cardVolumePerdido.innerText = volumeTotalPerdido.toLocaleString('pt-PT', {maximumFractionDigits:1}) + ' m³';

            desenharGraficoEvolucao(datasValidas, evolucaoDiariaAbaixoMeta);
            desenharGraficoMelhoresPlacas(listaQuadroGeralAtual);
            desenharGraficoMenoresCiclos(listaQuadroGeralAtual);

            listaQuadroGeralAtual.sort((a, b) => b.mediaDiaria - a.mediaDiaria);
            preencherQuadroGeral(listaQuadroGeralAtual);

            registrosAbaixoMeta.sort((a, b) => {
                const pA = a.data.split('/'); const pB = b.data.split('/');
                const dateA = new Date(pA[2], pA[1]-1, pA[0]);
                const dateB = new Date(pB[2], pB[1]-1, pB[0]);
                if(dateA.getTime() !== dateB.getTime()) return dateB - dateA;
                return b.volumeDeixouDeGanhar - a.volumeDeixouDeGanhar; 
            });
            preencherTabelaDetalhes(registrosAbaixoMeta);
            
            console.log("[DESEMPENHO] Tela atualizada com sucesso!");
        } catch (erroInterface) {
            console.error("[DESEMPENHO] Erro Crítico ao renderizar os dados na tela:", erroInterface);
        }
    }

    function desenharGraficoEvolucao(labels, dados) {
        try {
            const ctx = document.getElementById('chartEvolucao');
            if(!ctx) return;
            if(chartEvolucaoObj) chartEvolucaoObj.destroy();

            const dataPoints = labels.map(l => dados[l] || 0);

            chartEvolucaoObj = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels.map(l => l.substring(0, 5)), 
                    datasets: [{
                        label: 'Caminhões < Meta',
                        data: dataPoints,
                        borderColor: '#fb7185',
                        backgroundColor: 'rgba(251, 113, 133, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#e11d48',
                        pointBorderColor: '#fff',
                        pointRadius: 4,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        datalabels: {
                            display: true,
                            align: 'top',
                            color: '#f87171',
                            font: { weight: 'bold' }
                        }
                    },
                    scales: {
                        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { stepSize: 1 } },
                        x: { grid: { display: false } }
                    }
                }
            });
        } catch(e) { console.error("[DESEMPENHO] Erro grafico Evolução:", e); }
    }

    function desenharGraficoMenoresCiclos(lista) {
        try {
            const ctx = document.getElementById('chartMenoresCiclos');
            if (!ctx) return;
            if(chartPlacasObj) chartPlacasObj.destroy();

            const top5 = [...lista].filter(i => i.cicloMedio > 0).sort((a, b) => a.cicloMedio - b.cicloMedio).slice(0, 5);
            const labels = top5.map(i => i.placa);
            const values = top5.map(i => parseFloat(i.cicloMedio.toFixed(2)));

            chartPlacasObj = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Ciclo Médio',
                        data: values,
                        backgroundColor: '#38bdf8', 
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        datalabels: {
                            display: true,
                            color: '#fff',
                            anchor: 'end',
                            align: 'bottom',
                            formatter: (value) => formatarHorasDecimais(value),
                            font: { weight: 'bold' }
                        }
                    },
                    scales: {
                        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                        x: { grid: { display: false } }
                    }
                }
            });
        } catch(e) { console.error("[DESEMPENHO] Erro grafico Menores Ciclos:", e); }
    }

    function desenharGraficoMelhoresPlacas(lista) {
        try {
            const ctx = document.getElementById('chartMelhoresPlacas');
            if(!ctx) return;
            if(chartMelhoresObj) chartMelhoresObj.destroy();

            const top5 = [...lista].sort((a, b) => b.mediaDiaria - a.mediaDiaria).slice(0, 5);
            const labels = top5.map(i => i.placa);
            const values = top5.map(i => parseFloat(i.mediaDiaria.toFixed(1)));

            chartMelhoresObj = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Média de Viagens',
                        data: values,
                        backgroundColor: '#10b981', 
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        datalabels: {
                            display: true,
                            color: '#fff',
                            anchor: 'end',
                            align: 'bottom',
                            font: { weight: 'bold' }
                        }
                    },
                    scales: {
                        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                        x: { grid: { display: false } }
                    }
                }
            });
        } catch(e) { console.error("[DESEMPENHO] Erro grafico Melhores Placas:", e); }
    }

    function preencherQuadroGeral(lista) {
        try {
            const tbody = document.getElementById('tbodyQuadroGeral');
            if (!tbody) return; 
            tbody.innerHTML = '';

            if(lista.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-slate-500">Nenhum dado encontrado para o período.</td></tr>`;
                return;
            }

            lista.forEach(r => {
                const bateuMeta = r.mediaDiaria >= r.meta;
                const statusIcon = bateuMeta ? '<i class="fas fa-check-circle text-emerald-400"></i>' : '<i class="fas fa-exclamation-circle text-rose-400"></i>';
                const statusText = bateuMeta ? '<span class="text-emerald-400 font-bold">Na Meta</span>' : '<span class="text-rose-400 font-bold">Abaixo</span>';
                const mediaColor = bateuMeta ? 'text-emerald-400' : 'text-rose-400';
                const volFormat = r.volumeTotal.toLocaleString('pt-PT', {maximumFractionDigits:2});
                const cicloFormat = formatarHorasDecimais(r.cicloMedio);

                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-700/30 transition-colors group";
                tr.innerHTML = `
                    <td class="px-6 py-3 text-sm font-bold text-white"><span class="bg-slate-900 px-2 py-1 rounded border border-slate-700 font-mono tracking-widest">${r.placa}</span></td>
                    <td class="px-6 py-3 text-center text-sm text-slate-300 font-mono">${r.diasAnalisados}</td>
                    <td class="px-6 py-3 text-center text-sm font-black text-sky-400">${r.viagensTotais}</td>
                    <td class="px-6 py-3 text-center text-lg font-black ${mediaColor}">${r.mediaDiaria.toFixed(1)} <span class="text-xs text-slate-500 font-normal">/ ${r.meta}</span></td>
                    <td class="px-6 py-3 text-center text-sm font-mono text-amber-400">${cicloFormat}</td>
                    <td class="px-6 py-3 text-right text-sm font-mono text-slate-400">${volFormat}</td>
                    <td class="px-6 py-3 text-center text-sm bg-slate-900/30">${statusIcon} ${statusText}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch(e) { console.error("[DESEMPENHO] Erro em preencherQuadroGeral:", e); }
    }

    function preencherTabelaDetalhes(registros) {
        try {
            const tbody = document.getElementById('tbodyFrota');
            if (!tbody) return; 
            tbody.innerHTML = '';

            if(registros.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-emerald-400"><i class="fas fa-check-circle text-xl mb-2 block"></i>Todos os conjuntos TRITREM bateram a meta diária nas datas selecionadas!</td></tr>`;
                return;
            }

            registros.forEach(r => {
                const perdeuM3 = r.volumeDeixouDeGanhar.toLocaleString('pt-PT', {maximumFractionDigits:1});
                const tempoFilaStr = formatarHorasDecimais(r.fila);

                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-700/30 transition-colors group";
                tr.innerHTML = `
                    <td class="px-6 py-3 text-sm font-semibold text-slate-300 whitespace-nowrap group-hover:text-white">${r.data}</td>
                    <td class="px-6 py-3 text-sm font-bold text-white"><span class="bg-slate-900 px-2 py-1 rounded border border-slate-700 font-mono tracking-widest">${r.placa}</span></td>
                    <td class="px-6 py-3 text-center text-sm font-black text-rose-400">${r.viagens} <span class="text-xs text-slate-500 font-normal">/ ${r.meta}</span></td>
                    <td class="px-6 py-3 text-center text-sm font-black text-amber-400">${r.viagensFaltantes}</td>
                    <td class="px-6 py-3 text-right text-sm font-mono text-emerald-400">${perdeuM3}</td>
                    <td class="px-6 py-3 text-right text-sm font-mono text-slate-400">${tempoFilaStr}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch(e) { console.error("[DESEMPENHO] Erro em preencherTabelaDetalhes:", e); }
    }

    window.exportarParaExcelFrota = function() {
        if (listaQuadroGeralAtual.length === 0) {
            alert("Não há dados para exportar no período selecionado.");
            return;
        }

        const filterMes = document.getElementById('filterMesFrota');
        const nomeMes = filterMes && filterMes.options[filterMes.selectedIndex] ? filterMes.options[filterMes.selectedIndex].text : 'Periodo';

        const dadosExcel = listaQuadroGeralAtual.map(r => ({
            "Placa (Conjunto)": r.placa,
            "Dias Analisados": r.diasAnalisados,
            "Total de Viagens": r.viagensTotais,
            "Média (Viagens/Dia)": parseFloat(r.mediaDiaria.toFixed(2)),
            "Meta Cadastrada (Diária)": r.meta,
            "Ciclo Médio (Horas Formato)": formatarHorasDecimais(r.cicloMedio),
            "Ciclo Médio (Decimal)": parseFloat(r.cicloMedio.toFixed(2)),
            "Volume Total Produzido (m³)": parseFloat(r.volumeTotal.toFixed(2)),
            "Status da Meta": r.mediaDiaria >= r.meta ? "Na Meta" : "Abaixo da Meta"
        }));

        if(typeof XLSX !== 'undefined') {
            const ws = XLSX.utils.json_to_sheet(dadosExcel);
            const wb = XLSX.utils.book_new();

            XLSX.utils.book_append_sheet(wb, ws, "Quadro Geral de Desempenho");

            const fileName = `Desempenho_TRITREM_SerranaLog_${nomeMes.replace('/', '_')}.xlsx`;
            XLSX.writeFile(wb, fileName);
        } else {
            alert("A biblioteca Excel não carregou. Tente novamente em instantes.");
        }
    };
})();