// ==================== modules/gerencial/visao_executiva/visao_executiva.js ====================

var execChartComparativo = null;
var execChartEvolucao = null;

window.initVisaoExecutiva = function() {
    const inputMes = document.getElementById('execFiltroMes');
    if (inputMes) {
        const hoje = new Date();
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        inputMes.value = `${hoje.getFullYear()}-${mes}`;
    }
    window.atualizarDadosExecutivos();
};

window.atualizarDadosExecutivos = async function() {
    const inputMes = document.getElementById('execFiltroMes');
    const mesFiltro = inputMes ? inputMes.value : ''; 
    const containerCards = document.getElementById('containerCardsFiliais');
    const btnRefresh = document.getElementById('btnAtualizarExec');

    const currentUser = window.currentUser || {};
    const isGlobalAdmin = (currentUser.role === 'SuperAdmin' || currentUser.filial_id == 4 || currentUser.filial_id === null);
    const userFilialId = currentUser.filial_id;

    // Atualiza Textos da UI
    if (document.getElementById('tituloVisao')) {
        document.getElementById('tituloVisao').innerText = isGlobalAdmin ? 'Visão Executiva Global' : 'Visão Executiva Local';
    }
    if (document.getElementById('iconVisao')) {
        document.getElementById('iconVisao').className = isGlobalAdmin ? 'fas fa-globe-americas text-3xl' : 'fas fa-map-marked-alt text-3xl';
    }
    if (document.getElementById('tituloGraficoEvolucao')) {
        document.getElementById('tituloGraficoEvolucao').innerHTML = isGlobalAdmin 
            ? '<i class="fas fa-chart-area text-purple-400"></i> Evolução Faturamento Global (Últimos 6 Meses)'
            : '<i class="fas fa-chart-area text-purple-400"></i> Evolução Faturamento da Filial (Últimos 6 Meses)';
    }
    if (document.getElementById('kpiSubProd')) {
        document.getElementById('kpiSubProd').innerHTML = isGlobalAdmin 
            ? '<i class="fas fa-truck-loading"></i> Todas as Operações'
            : '<i class="fas fa-truck-loading"></i> Operação Local';
    }
    
    if (btnRefresh) {
        btnRefresh.disabled = true;
        btnRefresh.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
    }

    if (containerCards) {
        containerCards.innerHTML = `
            <div class="col-span-full text-center text-slate-400 py-10 flex flex-col items-center justify-center">
                <i class="fas fa-circle-notch fa-spin fa-3x mb-4 text-purple-500"></i>
                <p class="font-bold tracking-wide text-lg" id="execLoadingText">Buscando totais no servidor...</p>
            </div>`;
    }

    try {
        // 1. Buscas Paralelas: Filiais, Frota, OS e a nova RPC do Banco
        let qFiliais = window.supabaseClient.from('filiais').select('id, nome, cidade').neq('id', 4).order('nome', { ascending: true });
        if (!isGlobalAdmin && userFilialId) qFiliais = qFiliais.eq('id', userFilialId);

        let qFrota = window.supabaseClient.from('frotas_manutencao').select('cavalo, filial_id').eq('status', 'Ativo');
        if (!isGlobalAdmin && userFilialId) qFrota = qFrota.eq('filial_id', userFilialId);

        let qOS = window.supabaseClient.from('ordens_servico').select('placa, filial_id, status, tipo').in('status', ['Aguardando Oficina', 'Em Manutenção', 'Sinistrado']);
        if (!isGlobalAdmin && userFilialId) qOS = qOS.eq('filial_id', userFilialId);

        const [
            { data: filiaisDB },
            { data: frotaDB },
            { data: osDB },
            { data: rpcData, error: rpcError } 
        ] = await Promise.all([
            qFiliais,
            qFrota,
            qOS,
            window.supabaseClient.rpc('obter_visao_executiva', {
                p_mes_filtro: mesFiltro,
                p_filial_id: userFilialId || null
            })
        ]);

        if (rpcError) throw rpcError;
        if (!filiaisDB || filiaisDB.length === 0) throw new Error("Nenhuma filial encontrada para a sua permissão.");

        // 2. DM Operacional (Mantemos a lógica leve em JS)
        let dmGlobalMediaMes = 0;
        if (mesFiltro) {
            const anoMes = mesFiltro.split('-'); 
            const ultimoDia = new Date(anoMes[0], anoMes[1], 0).getDate(); 
            const dataInicioDM = `${mesFiltro}-01`;
            const dataFimDM = `${mesFiltro}-${String(ultimoDia).padStart(2,'0')}`;
            
            let qDM = window.supabaseClient.from('dm_operacional').select('carros_rodaram, total_frota').gte('data_registro', dataInicioDM).lte('data_registro', dataFimDM);
            if (!isGlobalAdmin && userFilialId) qDM = qDM.eq('filial_id', userFilialId);

            const { data: dmDB } = await qDM;
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

        // 3. Organiza os dados retornados pela RPC
        let filiaisData = [];
        let totalFatGlobal = 0;
        let totalProdGlobal = 0;

        const mapFiliaisRPC = {};
        if (rpcData && rpcData.filiais) {
            rpcData.filiais.forEach(f => {
                mapFiliaisRPC[f.filial_id] = { producao: f.producao || 0, faturamento: f.faturamento || 0 };
            });
        }

        for (let filial of filiaisDB) {
            let metricas = mapFiliaisRPC[filial.id] || { producao: 0, faturamento: 0 };
            
            // Cálculo DM da Oficina
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

        // 4. Configuração dos KPI Totais
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

        // 5. Gera os Cards na Tela
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

        // 6. Prepara Dados da Evolução (6 Meses) para o Gráfico
        let anoAtual = parseInt(mesFiltro.split('-')[0]);
        let mesAtual = parseInt(mesFiltro.split('-')[1]);
        const nomeMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        
        let mesesParaGrafico = [];
        let valoresFaturamentoHist = [];

        const mapEvolucaoRPC = {};
        if (rpcData && rpcData.evolucao) {
            rpcData.evolucao.forEach(e => {
                mapEvolucaoRPC[e.mes] = e.total_faturamento || 0;
            });
        }

        for (let i = 5; i >= 0; i--) {
            let d = new Date(anoAtual, mesAtual - 1 - i, 1);
            let mesKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            let label = `${nomeMeses[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
            
            mesesParaGrafico.push(label);
            valoresFaturamentoHist.push(parseFloat(mapEvolucaoRPC[mesKey] || 0));
        }
        
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
                name: 'Faturamento', type: 'line', data: valores, smooth: true, symbol: 'circle', symbolSize: 8,
                itemStyle: { color: '#a855f7' },
                areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(168, 85, 247, 0.4)' }, { offset: 1, color: 'rgba(168, 85, 247, 0.0)' }]) },
                lineStyle: { width: 3, shadowColor: 'rgba(168,85,247, 0.5)', shadowBlur: 10 }
            }
        ]
    };
    execChartEvolucao.setOption(option);
    window.addEventListener('resize', () => execChartEvolucao.resize());
}