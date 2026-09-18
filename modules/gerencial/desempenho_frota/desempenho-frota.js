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
    var dadosOSCompletos = []; // Guarda o histórico de OS para calcular horas paradas
    var frotasTritremAtivas = []; 
    var listaQuadroGeralAtual = []; 
    var chartEvolucaoObj = null;
    var chartPlacasObj = null;
    var chartMelhoresObj = null;

    var activeFilter = 'MES'; 

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
        const filterDataInicio = document.getElementById('filterDataInicio');
        const filterDataFim = document.getElementById('filterDataFim');
        const filterMes = document.getElementById('filterMesFrota');
        const btnExportar = document.getElementById('btnExportarExcel');

        btnQFs.forEach(btn => {
            btn.addEventListener('click', (e) => {
                activeFilter = e.currentTarget.getAttribute('data-qf');
                if(filterDataInicio) filterDataInicio.value = ''; 
                if(filterDataFim) filterDataFim.value = ''; 
                if(filterMes) filterMes.value = '';
                
                atualizarUIBotoes(btnQFs, activeFilter);
                processarEExibirDados();
            });
        });

        if(filterMes) {
            filterMes.addEventListener('change', (e) => {
                if(e.target.value) {
                    activeFilter = 'MES';
                    if(filterDataInicio) filterDataInicio.value = ''; 
                    if(filterDataFim) filterDataFim.value = ''; 
                    
                    atualizarUIBotoes(btnQFs, null); 
                    processarEExibirDados();
                }
            });
        }

        const handleDateChange = () => {
            if(filterDataInicio && filterDataFim && filterDataInicio.value && filterDataFim.value) {
                activeFilter = 'CUSTOM_RANGE';
                if(filterMes) filterMes.value = '';
                
                atualizarUIBotoes(btnQFs, null);
                processarEExibirDados();
            }
        };

        if(filterDataInicio) filterDataInicio.addEventListener('change', handleDateChange);
        if(filterDataFim) filterDataFim.addEventListener('change', handleDateChange);

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
            if (tbody1) tbody1.innerHTML = `<tr><td colspan="11" class="text-center p-8 text-rose-500">Erro: SupabaseClient não encontrado.</td></tr>`;
            return;
        }

        if (tbody1) tbody1.innerHTML = `<tr><td colspan="11" class="text-center p-8 text-slate-500"><i class="fas fa-spinner fa-spin mr-2"></i> Buscando histórico da SERRANALOG...</td></tr>`;
        if (tbody2) tbody2.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-slate-500"><i class="fas fa-spinner fa-spin mr-2"></i> Buscando histórico da SERRANALOG...</td></tr>`;
        
        console.log("[DESEMPENHO] Buscando viagens da SERRANALOG e Cadastro de Frota...");

        try {
            // 1. Buscar a frota TRITREM GERAL (Removido filtro status = Ativo)
            const { data: frotasData, error: frotasError } = await client
                .from('frotas_manutencao')
                .select('*')
                .eq('categoria', 'TRITREM');
                
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

            // 3. Buscar Ordens de Serviço para calcular horas paradas e status "Em Manutenção"
            dadosOSCompletos = [];
            let fromOs = 0;
            const stepOs = 1000;
            let fetchMoreOs = true;

            while (fetchMoreOs) {
                const { data: osData, error: osError } = await client
                    .from('ordens_servico')
                    .select('placa, data_abertura, data_conclusao, inativa, tipo, problema')
                    .range(fromOs, fromOs + stepOs - 1);
                    
                if (osError) {
                    console.error("[DESEMPENHO] Erro ao buscar ordens de serviço:", osError);
                    break;
                }
                if (osData && osData.length > 0) {
                    dadosOSCompletos = dadosOSCompletos.concat(osData);
                    fromOs += stepOs;
                }
                if (!osData || osData.length < stepOs) {
                    fetchMoreOs = false;
                }
            }

            console.log(`[DESEMPENHO] Concluído! Viagens: ${dadosHistoricoCompletos.length} | OS: ${dadosOSCompletos.length} | Tritrems Totais: ${frotasTritremAtivas.length}`);
            popularDropdownMeses(dadosHistoricoCompletos);
            processarEExibirDados();
            
        } catch (e) {
            console.error("[DESEMPENHO] Erro global na busca de dados:", e);
            if (tbody1) tbody1.innerHTML = `<tr><td colspan="11" class="text-center p-8 text-rose-500">Erro ao carregar dados (F12).</td></tr>`;
        }
    }

    function processarEExibirDados() {
        try {
            console.log("[DESEMPENHO] Processando dados para a tela...");
            
            // Cria um dicionário com os Tritrems totais e suas metas e info originais
            const dictTritrem = {};
            let metaDiariaGlobal = 0;
            frotasTritremAtivas.forEach(f => {
                if(f.cavalo) {
                    const placaNorm = normalizarPlaca(f.cavalo);
                    const meta = parseInt(f.meta) || 0;
                    dictTritrem[placaNorm] = { meta: meta, info: f };
                    if (f.status === 'Ativo') { // Incrementa global apenas de ativos
                        metaDiariaGlobal += meta;
                    }
                }
            });

            // Agrega horas paradas de TODO o histórico e guarda qual a Ordem em aberto (Manutenção atual)
            const horasParadasGlobais = {};
            const osAbertaPorPlaca = {};

            dadosOSCompletos.forEach(os => {
                if (os.inativa === 1) return; // ignora OS deletadas logicamente
                
                const placa = normalizarPlaca(os.placa);
                if (!placa) return;
                
                if (!horasParadasGlobais[placa]) horasParadasGlobais[placa] = 0;
                
                if (os.data_abertura) {
                    const start = new Date(os.data_abertura);
                    const isAberta = !os.data_conclusao || os.data_conclusao.trim() === '';
                    const end = isAberta ? new Date() : new Date(os.data_conclusao);
                    
                    const diffMs = end.getTime() - start.getTime();
                    if (diffMs > 0) {
                        const diffHoras = diffMs / (1000 * 60 * 60);
                        horasParadasGlobais[placa] += diffHoras;

                        // Guarda informações da OS aberta caso esteja "Em Manutenção"
                        if (isAberta) {
                            if (!osAbertaPorPlaca[placa] || osAbertaPorPlaca[placa].start > start) {
                                osAbertaPorPlaca[placa] = {
                                    start: start,
                                    horasParadasAtual: diffHoras,
                                    tipo: os.tipo || 'Manutenção',
                                    problema: os.problema || 'Não Informado'
                                };
                            }
                        }
                    }
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
            } else if (activeFilter === 'CUSTOM_RANGE') {
                const sVal = document.getElementById('filterDataInicio').value;
                const eVal = document.getElementById('filterDataFim').value;
                if(sVal && eVal) {
                    const partsS = sVal.split('-');
                    const startD = new Date(partsS[0], partsS[1]-1, partsS[2], 0, 0, 0);
                    const partsE = eVal.split('-');
                    const endD = new Date(partsE[0], partsE[1]-1, partsE[2], 23, 59, 59);
                    
                    dadosFiltrados = dadosHistoricoCompletos.filter(x => {
                        if(!x.dataDaBaseExcel) return false;
                        const p = x.dataDaBaseExcel.split('/');
                        const d = new Date(p[2], p[1]-1, p[0], 12, 0, 0);
                        if(d >= startD && d <= endD) {
                            diasParaGrafico.add(x.dataDaBaseExcel);
                            return true;
                        }
                        return false;
                    });
                }
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

            // Filtra os dados históricos mantendo apenas os Tritrems cadastrados (todos)
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
            let caminhoesAnalisadosDisplay = 0; // Contaremos apenas ativos para o dashboard principal

            // Avaliando todos os Tritrems (mesmo Inativos e os que não rodaram)
            for (const placaNorm in dictTritrem) {
                const configCavalo = dictTritrem[placaNorm];
                const metaDoCavalo = configCavalo.meta;
                const placaOriginal = configCavalo.info.cavalo;
                const statusOriginal = configCavalo.info.status || 'Ativo';
                const isAtivoStatus = statusOriginal.toLowerCase() === 'ativo';

                if (isAtivoStatus) {
                    caminhoesAnalisadosDisplay++;
                }

                const stats = statsPorPlaca[placaNorm] || { viagensTotais: 0, volumeTotal: 0, cicloTotal: 0, diasTrabalhados: new Set() };
                
                const media = stats.viagensTotais / numDiasAnalisados;
                const cicloMedio = stats.viagensTotais > 0 ? (stats.cicloTotal / stats.viagensTotais) : 0;
                
                const horasParadasHist = horasParadasGlobais[placaNorm] || 0;
                const viagensPerdidas = cicloMedio > 0 ? (horasParadasHist / cicloMedio) : 0;
                const caixaMedia = stats.viagensTotais > 0 ? (stats.volumeTotal / stats.viagensTotais) : 115;
                const volumePerdidoHist = viagensPerdidas * caixaMedia;

                // Definir Cenário Atual
                const osAberta = osAbertaPorPlaca[placaNorm];
                let cenarioAtual = 'Em Operação';

                if (osAberta) {
                    cenarioAtual = 'Em Manutenção';
                } else if (statusOriginal.toUpperCase() === 'INATIVO') {
                    cenarioAtual = 'Inativo';
                } else if (statusOriginal.toUpperCase() === 'SINISTRADO') {
                    cenarioAtual = 'Sinistrado';
                } else if (statusOriginal.toUpperCase() !== 'ATIVO') {
                    cenarioAtual = statusOriginal;
                }

                listaQuadroGeralAtual.push({
                    placa: placaOriginal,
                    cenarioAtual: cenarioAtual,
                    osAtual: osAberta || null,
                    diasAnalisados: numDiasAnalisados,
                    viagensTotais: stats.viagensTotais,
                    mediaDiaria: media,
                    meta: metaDoCavalo,
                    cicloMedio: cicloMedio,
                    volumeTotal: stats.volumeTotal,
                    horasParadas: horasParadasHist,
                    volumePerdido: volumePerdidoHist,
                    isAtivo: isAtivoStatus
                });

                // Considerar nas metas do gráfico superior somente ativos
                if (isAtivoStatus) {
                    if (media >= metaDoCavalo) {
                        qtdAcimaOuNaMeta++;
                    } else {
                        qtdAbaixoMetaGeral++;
                    }
                    somaViagensGeral += stats.viagensTotais;
                }
            }

            const cardTotalCaminhoes = document.getElementById('cardTotalCaminhoes');
            if (cardTotalCaminhoes) cardTotalCaminhoes.innerText = caminhoesAnalisadosDisplay; // Mostra qtd de ativos no widget
            
            const cardAcimaMeta = document.getElementById('cardAcimaMeta');
            if (cardAcimaMeta) cardAcimaMeta.innerText = qtdAcimaOuNaMeta;
            
            const cardAbaixoMeta = document.getElementById('cardAbaixoMeta');
            if (cardAbaixoMeta) cardAbaixoMeta.innerText = qtdAbaixoMetaGeral;
            
            const cardMediaViagens = document.getElementById('cardMediaViagens');
            if (cardMediaViagens) {
                const metaTotalPeriodo = metaDiariaGlobal * numDiasAnalisados;
                cardMediaViagens.innerHTML = `<span class="text-3xl">${somaViagensGeral}</span> <span class="text-sm text-slate-400 font-normal">/ ${metaTotalPeriodo}</span>`;
                
                const subtituloMedia = cardMediaViagens.nextElementSibling;
                if(subtituloMedia) subtituloMedia.innerText = "Viagens Feitas / Meta Total no período (Ativos)";
            }

            const registrosAbaixoMeta = [];
            const evolucaoDiariaAbaixoMeta = {}; 
            let volumeTotalPerdido = 0; 

            datasValidas.forEach(dia => evolucaoDiariaAbaixoMeta[dia] = 0);

            for (const dia of datasValidas) {
                let volGlobalDia = 0; let viagGlobalDia = 0;
                if (agrupamentoDiario[dia]) {
                    for (const p in agrupamentoDiario[dia]) {
                        volGlobalDia += agrupamentoDiario[dia][p].volumeTotal;
                        viagGlobalDia += agrupamentoDiario[dia][p].viagens;
                    }
                }
                const mediaGlobalCaixaDia = viagGlobalDia > 0 ? (volGlobalDia / viagGlobalDia) : 115; 

                for (const placaNorm in dictTritrem) {
                    const configCavalo = dictTritrem[placaNorm];
                    const isAtivoStatus = (configCavalo.info.status || 'Ativo').toLowerCase() === 'ativo';
                    
                    if (!isAtivoStatus) continue; // Foca no Volume perdido de ativos para os paineis do topo

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
            desenharGraficoMelhoresPlacas(listaQuadroGeralAtual.filter(l => l.isAtivo));
            desenharGraficoMenoresCiclos(listaQuadroGeralAtual.filter(l => l.isAtivo));

            // Ordena tabela geral: Ativos primeiro por média, depois os inativos/manutenção
            listaQuadroGeralAtual.sort((a, b) => {
                if(a.isAtivo && !b.isAtivo) return -1;
                if(!a.isAtivo && b.isAtivo) return 1;
                return b.mediaDiaria - a.mediaDiaria;
            });
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
                        label: 'Caminhões < Meta (Ativos)',
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
                tbody.innerHTML = `<tr><td colspan="11" class="text-center p-8 text-slate-500">Nenhum dado encontrado para o período.</td></tr>`;
                return;
            }

            lista.forEach(r => {
                const bateuMeta = r.mediaDiaria >= r.meta;
                const statusIcon = bateuMeta ? '<i class="fas fa-check-circle text-emerald-400"></i>' : '<i class="fas fa-exclamation-circle text-rose-400"></i>';
                const statusText = bateuMeta ? '<span class="text-emerald-400 font-bold">Na Meta</span>' : '<span class="text-rose-400 font-bold">Abaixo</span>';
                const mediaColor = bateuMeta ? 'text-emerald-400' : 'text-rose-400';
                const volFormat = r.volumeTotal.toLocaleString('pt-PT', {maximumFractionDigits:2});
                const cicloFormat = formatarHorasDecimais(r.cicloMedio);

                // Badge de Cenário Atual
                let badgeCenario = '';
                if (r.cenarioAtual === 'Em Operação') {
                    badgeCenario = '<span class="bg-emerald-900/50 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded text-[10px] uppercase font-bold whitespace-nowrap"><i class="fas fa-truck-moving mr-1"></i>Operação</span>';
                } else if (r.cenarioAtual === 'Em Manutenção') {
                    badgeCenario = '<span class="bg-amber-900/50 text-amber-400 border border-amber-500/30 px-2 py-1 rounded text-[10px] uppercase font-bold whitespace-nowrap"><i class="fas fa-tools mr-1"></i>Manutenção</span>';
                } else if (r.cenarioAtual === 'Sinistrado') {
                    badgeCenario = '<span class="bg-rose-900/50 text-rose-400 border border-rose-500/30 px-2 py-1 rounded text-[10px] uppercase font-bold whitespace-nowrap"><i class="fas fa-car-crash mr-1"></i>Sinistrado</span>';
                } else if (r.cenarioAtual === 'Inativo') {
                    badgeCenario = '<span class="bg-slate-700/50 text-slate-400 border border-slate-600/30 px-2 py-1 rounded text-[10px] uppercase font-bold whitespace-nowrap"><i class="fas fa-ban mr-1"></i>Inativo</span>';
                } else {
                    badgeCenario = `<span class="bg-slate-700/50 text-slate-300 border border-slate-600/30 px-2 py-1 rounded text-[10px] uppercase font-bold whitespace-nowrap">${r.cenarioAtual}</span>`;
                }

                // Badge de Serviço
                let servicoText = '<span class="text-slate-600">-</span>';
                if (r.osAtual) {
                    const limitStr = (str, n) => (str && str.length > n) ? str.substring(0, n) + '...' : str;
                    const tipoProb = limitStr(`${r.osAtual.tipo} - ${r.osAtual.problema}`, 35);
                    servicoText = `
                        <div class="flex flex-col">
                            <span class="text-[10px] text-amber-300 font-semibold uppercase truncate max-w-[200px]" title="${r.osAtual.tipo} - ${r.osAtual.problema}">${tipoProb}</span>
                            <span class="text-[11px] text-amber-500 font-mono mt-0.5"><i class="far fa-clock mr-1"></i>${formatarHorasDecimais(r.osAtual.horasParadasAtual)} parados(as)</span>
                        </div>
                    `;
                }

                const tr = document.createElement('tr');
                tr.className = `transition-colors group ${!r.isAtivo ? 'opacity-60 hover:opacity-100' : 'hover:bg-slate-700/30'}`;
                tr.innerHTML = `
                    <td class="px-6 py-3 text-sm font-bold text-white"><span class="bg-slate-900 px-2 py-1 rounded border border-slate-700 font-mono tracking-widest">${r.placa}</span></td>
                    <td class="px-6 py-3 text-center">${badgeCenario}</td>
                    <td class="px-6 py-3">${servicoText}</td>
                    <td class="px-6 py-3 text-center text-sm text-slate-300 font-mono">${r.diasAnalisados}</td>
                    <td class="px-6 py-3 text-center text-sm font-black text-sky-400">${r.viagensTotais}</td>
                    <td class="px-6 py-3 text-center text-lg font-black ${mediaColor}">${r.mediaDiaria.toFixed(1)} <span class="text-xs text-slate-500 font-normal">/ ${r.meta}</span></td>
                    <td class="px-6 py-3 text-center text-sm font-mono text-amber-400">${cicloFormat}</td>
                    <td class="px-6 py-3 text-right text-sm font-mono text-slate-400">${volFormat}</td>
                    <td class="px-6 py-3 text-center text-sm font-mono text-amber-500">${formatarHorasDecimais(r.horasParadas)}</td>
                    <td class="px-6 py-3 text-center text-sm bg-slate-900/30">${r.isAtivo ? `${statusIcon}${statusText}` : '-'}</td>
                    <td class="px-6 py-3 text-right text-sm font-black text-rose-500 bg-rose-900/10">${r.volumePerdido.toLocaleString('pt-PT', {maximumFractionDigits:2})} m³</td>
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
                tbody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-emerald-400"><i class="fas fa-check-circle text-xl mb-2 block"></i>Todos os conjuntos TRITREM ATIVOS bateram a meta diária nas datas selecionadas!</td></tr>`;
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
            "Cenário Atual": r.cenarioAtual,
            "Serviço em Andamento": r.osAtual ? `${r.osAtual.tipo} - ${r.osAtual.problema}` : "-",
            "Tempo Parado Atual": r.osAtual ? formatarHorasDecimais(r.osAtual.horasParadasAtual) : "-",
            "Dias Analisados": r.diasAnalisados,
            "Total de Viagens": r.viagensTotais,
            "Média (Viagens/Dia)": parseFloat(r.mediaDiaria.toFixed(2)),
            "Meta Cadastrada (Diária)": r.meta,
            "Ciclo Médio (Horas Formato)": formatarHorasDecimais(r.cicloMedio),
            "Ciclo Médio (Decimal)": parseFloat(r.cicloMedio.toFixed(2)),
            "Volume Total (m³)": parseFloat(r.volumeTotal.toFixed(2)),
            "Horas Paradas Totais (Histórico)": formatarHorasDecimais(r.horasParadas),
            "Status da Meta": !r.isAtivo ? "N/A" : (r.mediaDiaria >= r.meta ? "Na Meta" : "Abaixo da Meta"),
            "Volume Comprometido (m³)": parseFloat(r.volumePerdido.toFixed(2))
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