// ==================== modules/gerencial/visao_executiva/visao_executiva.js ====================

var execChartComparativo = null;
var execChartEvolucao = null;
const tarifaCache = new Map(); // OTIMIZAÇÃO: Cache em memória para cálculos pesados

window.initVisaoExecutiva = function() {
    const inputMes = document.getElementById('execFiltroMes');
    if (inputMes) {
        const hoje = new Date();
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        inputMes.value = `${hoje.getFullYear()}-${mes}`;
    }
    window.atualizarDadosExecutivos();
};

function converterDataExcel(dataStr) {
    if (!dataStr) return new Date(NaN);
    const str = String(dataStr).trim();
    if(str.includes('T')) return new Date(str);
    if(str.includes('/')) {
        const p = str.split('/');
        if (p.length === 3) return new Date(p[2], parseInt(p[1]) - 1, p[0]);
    }
    if(str.includes('-')) {
        const p = str.split('-');
        if(p.length >= 3) return new Date(p[0], parseInt(p[1]) - 1, p[2].substring(0,2));
    }
    return new Date(str);
}

// Função Original de Cálculo
function calcularTarifaExata(tarifador, asfalto, terra) {
    if (!tarifador || !tarifador.dados) return 0;
    
    let asf = parseFloat(String(asfalto).replace(',','.')) || 0;
    let ter = parseFloat(String(terra).replace(',','.')) || 0;
    
    const exato = tarifador.dados.find(t => Math.abs(t.asfalto - asf) < 0.001 && Math.abs(t.terra - ter) < 0.001);
    if (exato) return exato.tarifa;
    
    let maisProximo = null;
    let menorDistancia = Infinity;
    
    // Matemática pesada (Evitaremos rodar isso milhares de vezes usando o Cache)
    tarifador.dados.forEach(t => {
        const dist = Math.sqrt(Math.pow(t.asfalto - asf, 2) + Math.pow(t.terra - ter, 2));
        if (dist < menorDistancia) {
            menorDistancia = dist;
            maisProximo = t;
        }
    });

    return maisProximo ? maisProximo.tarifa : 0;
}

// OTIMIZAÇÃO 1: Função Inteligente que usa o Cache para evitar congelamento de tela
function getTarifaRapida(tarifador, asfalto, terra) {
    if (!tarifador || !tarifador.dados) return 0;
    
    // Cria uma chave única baseada nos valores exatos
    const key = `${tarifador.id}_${asfalto}_${terra}`;
    
    if (tarifaCache.has(key)) {
        return tarifaCache.get(key); // Retorna instantaneamente se já calculou antes
    }
    
    // Se for a primeira vez, calcula e salva na memória
    const tarifa = calcularTarifaExata(tarifador, asfalto, terra);
    tarifaCache.set(key, tarifa);
    return tarifa;
}

window.atualizarDadosExecutivos = async function() {
    const inputMes = document.getElementById('execFiltroMes');
    const mesFiltro = inputMes ? inputMes.value : ''; // Formato: "YYYY-MM"
    const containerCards = document.getElementById('containerCardsFiliais');
    const btnRefresh = document.getElementById('btnAtualizarExec');
    
    if (btnRefresh) {
        btnRefresh.disabled = true;
        btnRefresh.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
    }

    if (containerCards) {
        containerCards.innerHTML = `
            <div class="col-span-full text-center text-slate-400 py-10 flex flex-col items-center justify-center">
                <i class="fas fa-circle-notch fa-spin fa-3x mb-4 text-purple-500"></i>
                <p class="font-bold tracking-wide text-lg" id="execLoadingText">Mapeando base de dados corporativa...</p>
                <p class="text-sm mt-2 text-slate-500">Isso pode levar alguns segundos dependendo do volume de dados.</p>
            </div>`;
    }

    try {
        const loadingText = document.getElementById('execLoadingText');

        // =========================================================
        // 1. DADOS BASE (PROMISE.ALL PARA ALTA VELOCIDADE)
        // Ignorando a Filial ID = 4 (Matriz) para não renderizar os cards e cálculos
        // =========================================================
        const [
            { data: filiaisDB },
            { data: gruasData },
            { data: tarifadoresAtivos },
            { data: frotaDB },
            { data: osDB }
        ] = await Promise.all([
            window.supabaseClient.from('filiais').select('id, nome, cidade').neq('id', 4).order('nome', { ascending: true }),
            window.supabaseClient.from('config_gruas').select('codigos, tipo_frente'),
            window.supabaseClient.from('tarifadores').select('*').eq('ativo', true),
            window.supabaseClient.from('frotas_manutencao').select('cavalo, filial_id').eq('status', 'Ativo'),
            window.supabaseClient.from('ordens_servico').select('placa, filial_id, status, tipo').in('status', ['Aguardando Oficina', 'Em Manutenção', 'Sinistrado'])
        ]);

        if (!filiaisDB || filiaisDB.length === 0) throw new Error("Nenhuma filial encontrada no sistema.");

        // MAPEAMENTO DAS GRUAS (PROPRIAS = Receita de Carregamento)
        let gruasPropriasCache = new Set();
        if (gruasData) {
            gruasData.forEach(g => {
                if (g.tipo_frente && g.tipo_frente.trim().toUpperCase() === 'PROPRIA' && g.codigos) {
                    g.codigos.split(',').forEach(c => gruasPropriasCache.add(c.trim().toUpperCase()));
                }
            });
        }

        // =========================================================
        // 2. BUSCAR DM OPERACIONAL DAQUELE MÊS ESPECÍFICO
        // =========================================================
        if (loadingText) loadingText.innerText = "Processando indicadores de oficina...";
        
        let dmGlobalMediaMes = 0;
        if (mesFiltro) {
            const anoMes = mesFiltro.split('-'); 
            const ultimoDia = new Date(anoMes[0], anoMes[1], 0).getDate(); 
            const dataInicioDM = `${mesFiltro}-01`;
            const dataFimDM = `${mesFiltro}-${String(ultimoDia).padStart(2,'0')}`;
            
            const { data: dmDB } = await window.supabaseClient.from('dm_operacional').select('carros_rodaram, total_frota').gte('data_registro', dataInicioDM).lte('data_registro', dataFimDM);
            
            if (dmDB && dmDB.length > 0) {
                let totalPerc = 0; let validDays = 0;
                dmDB.forEach(reg => {
                    let rodou = Number(reg.carros_rodaram) || 0;
                    let total = Number(reg.total_frota) || 0;
                    if (total > 0) { totalPerc += (rodou / total) * 100; validDays++; }
                });
                if (validDays > 0) dmGlobalMediaMes = Number((totalPerc / validDays).toFixed(1));
            }
        }

        // =========================================================
        // 3. PREPARAR LINHA DO TEMPO DOS ÚLTIMOS 6 MESES
        // =========================================================
        let anoAtual = parseInt(mesFiltro.split('-')[0]);
        let mesAtual = parseInt(mesFiltro.split('-')[1]);
        
        const nomeMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        let arrayMeses = [];
        
        for (let i = 5; i >= 0; i--) {
            let d = new Date(anoAtual, mesAtual - 1 - i, 1);
            let key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            let label = `${nomeMeses[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
            arrayMeses.push({ key: key, label: label, totalFat: 0 });
        }

        // =========================================================
        // 4. OTIMIZAÇÃO EXTREMA: BUSCA PARALELA DE VIAGENS (MULTITHREADING)
        // =========================================================
        if (loadingText) loadingText.innerText = "Preparando extração em massa do histórico...";
        
        let dataInicioHist = new Date(anoAtual, mesAtual - 6, 1);
        let strInicioHist = `${dataInicioHist.getFullYear()}-${String(dataInicioHist.getMonth() + 1).padStart(2, '0')}-01T00:00:00`;

        let todasViagens = [];
        
        // 4.1 Primeiro, descobre exatamente quantas viagens existem para não fazer requests cegos
        const { count, error: countError } = await window.supabaseClient.from('historico_viagens')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', strInicioHist);
            
        if (countError) throw countError;

        if (count && count > 0) {
            if (loadingText) loadingText.innerText = `Baixando pacote de ${count.toLocaleString('pt-BR')} viagens em paralelo...`;
            
            const step = 1000;
            const promessasFetch = [];
            
            // 4.2 Lança todas as requisições ao mesmo tempo em direção ao servidor
            for (let from = 0; from <= count; from += step) {
                promessasFetch.push(
                    window.supabaseClient.from('historico_viagens')
                    .select('filial_id, volumeReal, dtFimDescarFabrica, dataDaBaseExcel, transportadora, grua, distanciaAsfalto, distanciaTerra, created_at')
                    .gte('created_at', strInicioHist)
                    .range(from, from + step - 1)
                );
            }
            
            // 4.3 Espera todas as páginas terminarem juntas
            const resultados = await Promise.all(promessasFetch);
            resultados.forEach(res => {
                if (res.data) todasViagens = todasViagens.concat(res.data);
            });
        }

        // =========================================================
        // 5. CÁLCULO GIGANTE DE DADOS EM MEMÓRIA (Com Anti-Travamento)
        // =========================================================
        if (loadingText) loadingText.innerText = "Cruzando Tarifador com Distâncias. Por favor, aguarde...";
        
        let filiaisDataMap = {}; 
        
        function getTarifador(filialId) {
            if (!tarifadoresAtivos || tarifadoresAtivos.length === 0) return null;
            let t = tarifadoresAtivos.find(x => String(x.filial_id) === String(filialId));
            if (t) return t;
            t = tarifadoresAtivos.find(x => !x.filial_id);
            if (t) return t;
            return tarifadoresAtivos[0]; 
        }

        tarifaCache.clear(); // Limpa a memória RAM velha antes do loop pesado

        for (let i = 0; i < todasViagens.length; i++) {
            let v = todasViagens[i];
            
            // Ignora processamento da filial 4 (Matriz) nos valores globais do DRE/Gráficos
            if (v.filial_id === 4) continue;
            
            // OTIMIZAÇÃO 2: A cada 5.000 viagens, libera a CPU por 5ms para o Google Chrome não travar a tela
            if (i % 5000 === 0 && i > 0) {
                if (loadingText) loadingText.innerText = `Processando cálculos financeiros... (${i} de ${todasViagens.length})`;
                await new Promise(resolve => setTimeout(resolve, 5));
            }

            let dataViagemStr = v.dtFimDescarFabrica || v.dataDaBaseExcel || (v.created_at ? v.created_at.split('T')[0] : null);
            if (!dataViagemStr) continue;
            
            let dateObj = converterDataExcel(dataViagemStr);
            if (isNaN(dateObj.getTime())) continue;
            
            let mesKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
            let mesChart = arrayMeses.find(m => m.key === mesKey);
            let isMesAtual = (mesKey === mesFiltro);
            
            if (!mesChart && !isMesAtual) continue; 
            
            let tr = v.transportadora ? v.transportadora.toUpperCase() : '';
            let isSerrana = tr.includes('SERRANALOG') || tr.includes('SERRANA LOG');
            
            let gruaReg = v.grua ? v.grua.trim().toUpperCase() : '';
            let isNossaGrua = gruasPropriasCache.has(gruaReg);
            
            let vol = parseFloat(String(v.volumeReal).replace(',','.')) || 0;
            let asfalto = parseFloat(String(v.distanciaAsfalto).replace(',','.')) || 0;
            let terra = parseFloat(String(v.distanciaTerra).replace(',','.')) || 0;
            
            let tarifador = getTarifador(v.filial_id);
            let precoCarregamento = tarifador ? parseFloat(tarifador.preco_carregamento) || 0 : 0;
            
            let recTransp = 0;
            if (isSerrana) {
                // Utiliza a função inteligente com memória Cache
                let tarifa = getTarifaRapida(tarifador, asfalto, terra);
                recTransp = vol * tarifa;
            }
            
            let recCarreg = isNossaGrua ? (vol * precoCarregamento) : 0;
            let receitaTotalViagem = recTransp + recCarreg;
            
            if (mesChart) {
                mesChart.totalFat += receitaTotalViagem;
            }
            
            if (isMesAtual) {
                if (!filiaisDataMap[v.filial_id]) {
                    filiaisDataMap[v.filial_id] = { producao: 0, faturamento: 0 };
                }
                filiaisDataMap[v.filial_id].producao += vol;
                filiaisDataMap[v.filial_id].faturamento += receitaTotalViagem;
            }
        }

        // =========================================================
        // 6. MONTAR DADOS DAS FILIAIS E KPIs
        // =========================================================
        if (loadingText) loadingText.innerText = "Finalizando e renderizando painéis...";
        await new Promise(resolve => setTimeout(resolve, 5)); // Último fôlego para a UI

        let filiaisData = [];
        let totalFatGlobal = 0;
        let totalProdGlobal = 0;

        for (let filial of filiaisDB) {
            let metricas = filiaisDataMap[filial.id] || { producao: 0, faturamento: 0 };
            
            // Calculo DM
            let dmReal = dmGlobalMediaMes; 
            if (frotaDB && frotaDB.length > 0) {
                const frotaFilial = frotaDB.filter(f => String(f.filial_id) === String(filial.id));
                if (frotaFilial.length > 0) {
                    const listaCavalos = frotaFilial.map(f => f.cavalo.trim().toUpperCase());
                    const totalFrota = listaCavalos.length;
                    let cavalosParados = 0;
                    if (osDB && osDB.length > 0) {
                        const placasParadas = new Set();
                        osDB.forEach(os => {
                            const placaOS = os.placa ? os.placa.trim().toUpperCase() : '';
                            if (listaCavalos.includes(placaOS) && os.tipo !== 'Cavalo Disponível S/ Carreta') {
                                placasParadas.add(placaOS);
                            }
                        });
                        cavalosParados = placasParadas.size;
                    }
                    const frotaDisponivel = totalFrota - cavalosParados;
                    dmReal = Number(((frotaDisponivel / totalFrota) * 100).toFixed(1));
                }
            }

            totalFatGlobal += metricas.faturamento;
            totalProdGlobal += metricas.producao;

            filiaisData.push({
                id: filial.id,
                nome: filial.nome,
                cidade: filial.cidade || filial.nome,
                faturamento: metricas.faturamento,
                producao: metricas.producao,
                dm: dmReal,
                status: dmReal >= 85 ? 'Operacional' : 'Atenção'
            });
        }

        filiaisData.sort((a,b) => b.faturamento - a.faturamento);

        // =========================================================
        // 7. ATUALIZAR INTERFACE
        // =========================================================
        
        if (document.getElementById('kpiFatGlobal')) {
            document.getElementById('kpiFatGlobal').innerText = totalFatGlobal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
        if (document.getElementById('kpiProdGlobal')) {
            document.getElementById('kpiProdGlobal').innerText = totalProdGlobal.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' m³';
        }
        if (document.getElementById('kpiDmGlobal')) {
            document.getElementById('kpiDmGlobal').innerText = dmGlobalMediaMes + '%'; 
        }
        if (document.getElementById('kpiFiliaisAtivas')) {
            document.getElementById('kpiFiliaisAtivas').innerText = filiaisData.length.toString();
        }

        // HTML dos Cards das Filiais
        let cardsHtml = '';
        filiaisData.forEach(filial => {
            let statusBadge = filial.status === 'Operacional' 
                ? '<span class="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-1 rounded-full border border-emerald-500/20"><i class="fas fa-check"></i> NORMAL</span>' 
                : '<span class="bg-amber-500/10 text-amber-400 text-[10px] font-bold px-2 py-1 rounded-full border border-amber-500/20"><i class="fas fa-exclamation-triangle"></i> ATENÇÃO DM</span>';
            
            cardsHtml += `
                <div class="bg-slate-800/80 rounded-2xl p-5 border border-slate-700 hover:border-emerald-500/50 transition-all shadow-lg relative overflow-hidden group">
                    <div class="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-colors"></div>
                    
                    <div class="flex justify-between items-start mb-4 border-b border-slate-700/50 pb-3">
                        <div>
                            <h4 class="font-black text-sm text-white uppercase tracking-wider truncate" title="${filial.nome}">${filial.nome}</h4>
                            <p class="text-[10px] text-slate-400 font-bold uppercase"><i class="fas fa-map-marker-alt"></i> ${filial.cidade}</p>
                        </div>
                        ${statusBadge}
                    </div>
                    
                    <div class="space-y-3">
                        <div class="flex justify-between items-end border-b border-slate-700/50 pb-2">
                            <span class="text-slate-400 text-xs font-bold uppercase"><i class="fas fa-sack-dollar text-emerald-400"></i> Faturamento</span>
                            <span class="font-black text-emerald-400 text-lg font-mono">${filial.faturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                        <div class="flex justify-between items-end border-b border-slate-700/50 pb-2">
                            <span class="text-slate-400 text-xs font-bold uppercase"><i class="fas fa-cube text-sky-400"></i> Produção (m³)</span>
                            <span class="font-black text-white text-md font-mono">${filial.producao.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                        </div>
                        <div class="flex justify-between items-end pt-1">
                            <span class="text-slate-400 text-xs font-bold uppercase"><i class="fas fa-tools text-amber-400"></i> DM % Oficina</span>
                            <span class="font-black ${filial.dm < 85 ? 'text-amber-400' : 'text-emerald-400'} font-mono text-md">${filial.dm}%</span>
                        </div>
                    </div>
                </div>
            `;
        });
        if (containerCards) containerCards.innerHTML = cardsHtml;

        // Renderizar Gráficos
        let mesesParaGrafico = arrayMeses.map(m => m.label);
        let valoresFaturamentoHist = arrayMeses.map(m => parseFloat(m.totalFat.toFixed(2)));
        
        renderizarGraficoComparativo(filiaisData);
        renderizarGraficoEvolucao(mesesParaGrafico, valoresFaturamentoHist);

    } catch (error) {
        console.error('Erro ao buscar dados executivos no banco:', error);
        if (containerCards) {
            containerCards.innerHTML = `
                <div class="col-span-full text-center text-rose-400 py-10 border border-rose-500/30 rounded-lg bg-rose-500/10 shadow-inner">
                    <i class="fas fa-times-circle fa-3x mb-3"></i>
                    <h3 class="font-black text-lg uppercase tracking-wider">Falha na Sincronização</h3>
                    <p class="text-sm mt-1 font-bold">${error.message}</p>
                </div>`;
        }
    } finally {
        // Restaura o botão de Atualizar
        if (btnRefresh) {
            btnRefresh.disabled = false;
            btnRefresh.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar';
        }
    }
};

function renderizarGraficoComparativo(dados) {
    const chartDom = document.getElementById('graficoComparativoFiliais');
    if (!chartDom) return;
    
    if (execChartComparativo) execChartComparativo.dispose();
    execChartComparativo = echarts.init(chartDom);
    
    // Mostraremos até 8 filiais para o gráfico não espremer
    const dadosTop = dados.slice(0, 8);
    const nomesEixoX = dadosTop.map(d => d.cidade);
    const faturamentos = dadosTop.map(d => d.faturamento);
    const producoes = dadosTop.map(d => d.producao);

    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { data: ['Faturamento (R$)', 'Produção (m³)'], textStyle: { color: '#cbd5e1', fontWeight: 'bold' }, top: 0 },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: [
            { type: 'category', data: nomesEixoX, axisLabel: { color: '#94a3b8', fontWeight: 'bold', fontSize: 10, interval: 0, rotate: 15 } }
        ],
        yAxis: [
            { type: 'value', name: 'R$', nameTextStyle: { color: '#10b981', fontWeight: 'bold' }, axisLabel: { color: '#94a3b8', formatter: (val) => (val/1000) + 'k' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
            { type: 'value', name: 'm³', nameTextStyle: { color: '#38bdf8', fontWeight: 'bold' }, axisLabel: { color: '#94a3b8' }, splitLine: { show: false } }
        ],
        series: [
            {
                name: 'Faturamento (R$)', type: 'bar', data: faturamentos,
                itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#10b981' }, { offset: 1, color: '#047857' }]), borderRadius: [4, 4, 0, 0] }
            },
            {
                name: 'Produção (m³)', type: 'line', yAxisIndex: 1, data: producoes, smooth: true, symbolSize: 8,
                itemStyle: { color: '#38bdf8' }, lineStyle: { width: 3, shadowColor: 'rgba(56, 189, 248, 0.5)', shadowBlur: 10 }
            }
        ]
    };
    execChartComparativo.setOption(option);
    window.addEventListener('resize', () => execChartComparativo.resize());
}

function renderizarGraficoEvolucao(meses, valores) {
    const chartDom = document.getElementById('graficoEvolucaoGlobal');
    if (!chartDom) return;
    
    if (execChartEvolucao) execChartEvolucao.dispose();
    execChartEvolucao = echarts.init(chartDom);

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            formatter: function(params) {
                let val = params[0].value.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
                return `<span style="font-weight:bold">${params[0].name}</span><br/>Receita: <b>${val}</b>`;
            }
        },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', boundaryGap: false, data: meses, axisLabel: { color: '#94a3b8', fontWeight: 'bold' } },
        yAxis: {
            type: 'value',
            axisLabel: { color: '#94a3b8', formatter: (val) => (val/1000000).toFixed(2) + 'M' },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
        },
        series: [
            {
                name: 'Faturamento Global', type: 'line', data: valores, smooth: true, symbol: 'circle', symbolSize: 8,
                itemStyle: { color: '#a855f7' },
                areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(168, 85, 247, 0.4)' }, { offset: 1, color: 'rgba(168, 85, 247, 0.0)' }]) },
                lineStyle: { width: 3, shadowColor: 'rgba(168,85,247, 0.5)', shadowBlur: 10 }
            }
        ]
    };
    execChartEvolucao.setOption(option);
    window.addEventListener('resize', () => execChartEvolucao.resize());
}