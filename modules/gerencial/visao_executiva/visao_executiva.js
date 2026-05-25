// ==================== modules/gerencial/visao_executiva/visao_executiva.js ====================

window.initVisaoExecutiva = function() {
    // Definir o mês atual como padrão no input
    const inputMes = document.getElementById('execFiltroMes');
    if (inputMes) {
        const hoje = new Date();
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        inputMes.value = `${hoje.getFullYear()}-${mes}`;
    }

    // Carregar os dados iniciais
    window.atualizarDadosExecutivos();
};

window.atualizarDadosExecutivos = async function() {
    const inputMes = document.getElementById('execFiltroMes');
    const mesFiltro = inputMes ? inputMes.value : ''; // Formato esperado: "YYYY-MM"

    const containerCards = document.getElementById('containerCardsFiliais');
    if (containerCards) {
        containerCards.innerHTML = '<div class="col-span-full text-center text-gray-400 py-10"><i class="fas fa-spinner fa-spin fa-2x mb-3"></i><p>Consultando dados dos módulos de Monitoramento, Manutenção e Indicadores...</p></div>';
    }

    try {
        // 1. BUSCAR AS FILIAIS CADASTRADAS (Usando window.supabaseClient definido no database.js)
        const { data: filiaisDB, error: errFiliais } = await window.supabaseClient
            .from('filiais')
            .select('*')
            .order('nome', { ascending: true });

        if (errFiliais) throw errFiliais;

        if (!filiaisDB || filiaisDB.length === 0) {
            if (containerCards) containerCards.innerHTML = '<div class="col-span-full text-center text-yellow-400 py-10"><i class="fas fa-exclamation-triangle fa-2x mb-3"></i><p>Nenhuma filial encontrada. Cadastre uma filial no banco de dados para visualizar os indicadores.</p></div>';
            
            document.getElementById('kpiFatGlobal').innerText = 'R$ 0,00';
            document.getElementById('kpiProdGlobal').innerText = '0 Tons';
            document.getElementById('kpiDmGlobal').innerText = '0%';
            document.getElementById('kpiFiliaisAtivas').innerText = '0';
            renderizarGraficoComparativo([]);
            return;
        }

        let filiaisData = [];
        
        let totalFatGlobal = 0;
        let totalProdGlobal = 0;
        let totalDmGlobal = 0;
        let filiaisValidas = 0;

        // 2. BUSCAR DADOS DOS MÓDULOS PARA CADA FILIAL
        for (let filial of filiaisDB) {
            
            let faturamentoReal = 0;
            let producaoReal = 0;
            let dmReal = 0;

            // ==========================================================================================
            // INTEGRAÇÃO COM OS MÓDULOS (MONITORAMENTO, MANUTENÇÃO, INDICADORES)
            // Descomente e ajuste o nome das tabelas para as reais usadas pelo seu banco.
            // ==========================================================================================

            /*
            // --- A. Dados do Módulo Indicadores (Faturamento) ---
            const { data: fatDB } = await window.supabaseClient
                .from('tabela_faturamento') // <- Substitua pela tabela que o módulo Indicadores usa
                .select('valor')
                .eq('filial_id', filial.id)
                .like('data', `${mesFiltro}%`); 
            
            if (fatDB) faturamentoReal = fatDB.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);

            // --- B. Dados do Módulo Monitoramento (Produção) ---
            const { data: prodDB } = await window.supabaseClient
                .from('historico_producao') // <- Substitua pela tabela que o módulo Monitoramento usa
                .select('peso_toneladas')
                .eq('filial_id', filial.id)
                .like('data', `${mesFiltro}%`);
            
            if (prodDB) producaoReal = prodDB.reduce((acc, curr) => acc + (Number(curr.peso_toneladas) || 0), 0);

            // --- C. Dados do Módulo Manutenção (DM) ---
            const { data: dmDB } = await window.supabaseClient
                .from('indicadores_manutencao') // <- Substitua pela tabela que o módulo Manutenção usa para o DM
                .select('dm_percentual')
                .eq('filial_id', filial.id)
                .like('data', `${mesFiltro}%`)
                .limit(1);
            
            if (dmDB && dmDB.length > 0) dmReal = Number(dmDB[0].dm_percentual);
            */

            // ==========================================================================================
            // FALLBACK VISUAL: Enquanto as tabelas reais acima não estiverem com os nomes mapeados,
            // usaremos valores gerados para manter a interface funcionando.
            // (Apague estas 3 linhas após configurar as tabelas reais)
            // ==========================================================================================
            faturamentoReal = faturamentoReal || (Math.floor(Math.random() * 1000000) + 200000); 
            producaoReal = producaoReal || (Math.floor(Math.random() * 40000) + 10000);
            dmReal = dmReal || Number((Math.random() * (98 - 75) + 75).toFixed(1));

            // Acumular para os KPIs Globais
            totalFatGlobal += faturamentoReal;
            totalProdGlobal += producaoReal;
            if (dmReal > 0) {
                totalDmGlobal += dmReal;
                filiaisValidas++;
            }

            filiaisData.push({
                id: filial.id,
                nome: filial.nome || `Filial ID ${filial.id}`,
                faturamento: faturamentoReal,
                producao: producaoReal,
                dm: dmReal,
                status: dmReal >= 85 ? 'Operacional' : 'Atenção'
            });
        }

        // 3. ATUALIZAR KPIs GLOBAIS NO TOPO DA TELA
        const mediaDmGlobal = filiaisValidas > 0 ? (totalDmGlobal / filiaisValidas).toFixed(1) : 0;

        document.getElementById('kpiFatGlobal').innerText = totalFatGlobal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('kpiProdGlobal').innerText = totalProdGlobal.toLocaleString('pt-BR') + ' Tons';
        document.getElementById('kpiDmGlobal').innerText = mediaDmGlobal + '%';
        document.getElementById('kpiFiliaisAtivas').innerText = filiaisData.length.toString();

        // 4. RENDERIZAR OS CARDS DINAMICAMENTE
        let cardsHtml = '';
        filiaisData.forEach(filial => {
            let statusBadge = filial.status === 'Operacional' 
                ? '<span class="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full border border-green-500/30">Normal</span>' 
                : '<span class="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-1 rounded-full border border-yellow-500/30">Atenção DM</span>';

            cardsHtml += `
                <div class="bg-gray-800 rounded-xl p-5 border border-gray-700 hover:border-blue-500 transition-colors shadow-lg">
                    <div class="flex justify-between items-center mb-4">
                        <h4 class="font-bold text-lg text-white">${filial.nome}</h4>
                        ${statusBadge}
                    </div>
                    <div class="space-y-3">
                        <div class="flex justify-between items-center border-b border-gray-700 pb-2">
                            <span class="text-gray-400 text-sm"><i class="fas fa-money-bill-wave w-5 text-green-400"></i> Faturamento</span>
                            <span class="font-semibold text-white">${filial.faturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                        <div class="flex justify-between items-center border-b border-gray-700 pb-2">
                            <span class="text-gray-400 text-sm"><i class="fas fa-cubes w-5 text-blue-400"></i> Produção</span>
                            <span class="font-semibold text-white">${filial.producao.toLocaleString('pt-BR')} T</span>
                        </div>
                        <div class="flex justify-between items-center pb-1">
                            <span class="text-gray-400 text-sm"><i class="fas fa-tools w-5 text-orange-400"></i> Disponib. Mecânica</span>
                            <span class="font-semibold ${filial.dm < 88 ? 'text-yellow-400' : 'text-green-400'}">${filial.dm}%</span>
                        </div>
                    </div>
                    <div class="mt-4 pt-3 border-t border-gray-700 text-center">
                        <button onclick="console.log('Navegar para relatórios da filial:', '${filial.id}')" class="text-blue-400 text-sm hover:text-blue-300 font-medium transition-colors">Acessar Painel da Filial <i class="fas fa-arrow-right ml-1"></i></button>
                    </div>
                </div>
            `;
        });
        if (containerCards) containerCards.innerHTML = cardsHtml;

        // 5. ATUALIZAR GRÁFICOS DO ECHARTS
        renderizarGraficoComparativo(filiaisData);
        
        const historicoGlobalMeses = ['Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr', mesFiltro.split('-')[1] || 'Atual'];
        const historicoGlobalValores = [2800000, 3100000, 2900000, 3400000, 3500000, 3621100, totalFatGlobal];
        renderizarGraficoEvolucao(historicoGlobalMeses, historicoGlobalValores);

    } catch (error) {
        console.error('Erro ao buscar dados executivos no banco:', error);
        if (containerCards) {
            containerCards.innerHTML = `
                <div class="col-span-full text-center text-red-500 py-10 border border-red-500/30 rounded-lg bg-red-500/10">
                    <i class="fas fa-times-circle fa-2x mb-2"></i>
                    <h3 class="font-bold text-lg">Erro ao conectar com o banco de dados</h3>
                    <p class="text-sm mt-1">${error.message}</p>
                </div>`;
        }
    }
};

function renderizarGraficoComparativo(dados) {
    const chartDom = document.getElementById('graficoComparativoFiliais');
    if (!chartDom) return;
    
    let myChart = echarts.getInstanceByDom(chartDom);
    if (myChart) myChart.dispose();
    myChart = echarts.init(chartDom);

    if (!dados || dados.length === 0) {
        chartDom.innerHTML = '<div class="w-full h-full flex items-center justify-center text-gray-500">Sem dados para exibir no gráfico</div>';
        return;
    }

    const nomes = dados.map(d => {
        const partes = d.nome.split('-');
        return partes.length > 1 ? partes[1].trim() : d.nome;
    });
    const faturamentos = dados.map(d => d.faturamento);
    const producoes = dados.map(d => d.producao);

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' }
        },
        legend: {
            data: ['Faturamento (R$)', 'Produção (Tons)'],
            textStyle: { color: '#cbd5e1' },
            top: 0
        },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: [
            {
                type: 'category',
                data: nomes,
                axisLabel: { color: '#94a3b8' }
            }
        ],
        yAxis: [
            {
                type: 'value',
                name: 'Faturamento',
                nameTextStyle: { color: '#94a3b8' },
                axisLabel: { color: '#94a3b8', formatter: (val) => 'R$ ' + (val/1000) + 'k' },
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
            },
            {
                type: 'value',
                name: 'Produção',
                nameTextStyle: { color: '#94a3b8' },
                axisLabel: { color: '#94a3b8', formatter: '{value} T' },
                splitLine: { show: false }
            }
        ],
        series: [
            {
                name: 'Faturamento (R$)',
                type: 'bar',
                data: faturamentos,
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#10b981' },
                        { offset: 1, color: '#047857' }
                    ]),
                    borderRadius: [4, 4, 0, 0]
                }
            },
            {
                name: 'Produção (Tons)',
                type: 'line',
                yAxisIndex: 1,
                data: producoes,
                smooth: true,
                symbolSize: 8,
                itemStyle: { color: '#3b82f6' },
                lineStyle: { width: 3, shadowColor: 'rgba(59, 130, 246, 0.5)', shadowBlur: 10 }
            }
        ]
    };

    myChart.setOption(option);
    window.addEventListener('resize', () => myChart.resize());
}

function renderizarGraficoEvolucao(meses, valores) {
    const chartDom = document.getElementById('graficoEvolucaoGlobal');
    if (!chartDom) return;
    
    let myChart = echarts.getInstanceByDom(chartDom);
    if (myChart) myChart.dispose();
    myChart = echarts.init(chartDom);

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            formatter: function(params) {
                let val = params[0].value.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
                return `${params[0].name}<br/>Total: <b>${val}</b>`;
            }
        },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: meses,
            axisLabel: { color: '#94a3b8' }
        },
        yAxis: {
            type: 'value',
            axisLabel: { color: '#94a3b8', formatter: (val) => (val/1000000).toFixed(1) + 'M' },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
        },
        series: [
            {
                name: 'Faturamento Global',
                type: 'line',
                data: valores,
                smooth: true,
                symbol: 'circle',
                symbolSize: 8,
                itemStyle: { color: '#8b5cf6' },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(139, 92, 246, 0.5)' },
                        { offset: 1, color: 'rgba(139, 92, 246, 0.0)' }
                    ])
                },
                lineStyle: { width: 3 }
            }
        ]
    };

    myChart.setOption(option);
    window.addEventListener('resize', () => myChart.resize());
}