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
        containerCards.innerHTML = '<div class="col-span-full text-center text-gray-400 py-10"><i class="fas fa-spinner fa-spin fa-2x mb-3"></i><p>Extraindo e calculando o volume de todas as filiais...</p></div>';
    }

    try {
        // 1. BUSCAR AS FILIAIS CADASTRADAS
        const { data: filiaisDB, error: errFiliais } = await window.supabaseClient
            .from('filiais')
            .select('*')
            .order('nome', { ascending: true });

        if (errFiliais) throw errFiliais;

        if (!filiaisDB || filiaisDB.length === 0) {
            if (containerCards) containerCards.innerHTML = '<div class="col-span-full text-center text-yellow-400 py-10"><i class="fas fa-exclamation-triangle fa-2x mb-3"></i><p>Nenhuma filial encontrada.</p></div>';
            
            document.getElementById('kpiFatGlobal').innerText = 'R$ 0,00';
            document.getElementById('kpiProdGlobal').innerText = '0 m³';
            document.getElementById('kpiDmGlobal').innerText = '0%';
            document.getElementById('kpiFiliaisAtivas').innerText = '0';
            renderizarGraficoComparativo([]);
            return;
        }

        // =========================================================
        // 2. BUSCAR TODO O HISTÓRICO DE VIAGENS (Contornando o limite de 1000 do Supabase)
        // =========================================================
        let todasViagens = [];
        let fromViagens = 0;
        let fetchViagens = true;
        
        while (fetchViagens) {
            const { data: vData, error: vErr } = await window.supabaseClient
                .from('historico_viagens')
                .select('filial_id, volumeReal, dataDaBaseExcel, created_at')
                .range(fromViagens, fromViagens + 999);
            
            if (vErr || !vData || vData.length === 0) {
                fetchViagens = false;
            } else {
                todasViagens = todasViagens.concat(vData);
                fromViagens += 1000;
                if (vData.length < 1000) fetchViagens = false;
            }
        }

        let filiaisData = [];
        let totalFatGlobal = 0;
        let totalProdGlobal = 0;
        let totalDmGlobal = 0;
        let filiaisValidasParaDM = 0;

        // 3. PROCESSAR OS DADOS DE CADA FILIAL ISOLADAMENTE
        for (let filial of filiaisDB) {
            
            let faturamentoReal = 0;
            let producaoReal = 0;
            let dmReal = 0;

            // A. PRODUÇÃO (Filtra da lista gigante apenas as da filial atual)
            const viagensDB = todasViagens.filter(v => String(v.filial_id) === String(filial.id));

            if (viagensDB.length > 0) {
                const viagensFiltradas = viagensDB.filter(v => {
                    if (!mesFiltro) return true; // Mostra tudo se não tiver mês filtrado
                    
                    let dataOriginal = v.dataDaBaseExcel;
                    if (!dataOriginal || dataOriginal === 'Desconhecida') {
                        dataOriginal = v.created_at;
                    }
                    if (!dataOriginal) return false;
                    
                    let dataLimpa = String(dataOriginal).trim().split('T')[0].split(' ')[0]; 
                    
                    if (dataLimpa.includes('/')) {
                        let partesData = dataLimpa.split('/');
                        if (partesData.length >= 3) {
                            let ano = partesData[2].length === 2 ? "20" + partesData[2] : partesData[2];
                            let mesAnoViagem = `${ano}-${partesData[1].padStart(2, '0')}`;
                            return mesAnoViagem === mesFiltro;
                        }
                    } else if (dataLimpa.includes('-')) {
                        let partesData = dataLimpa.split('-');
                        if (partesData.length >= 3) {
                            let ano = partesData[0];
                            let mes = partesData[1].padStart(2, '0');
                            return `${ano}-${mes}` === mesFiltro;
                        }
                    }
                    return false;
                });
                
                producaoReal = viagensFiltradas.reduce((acc, curr) => {
                    let vol = curr.volumeReal;
                    if (vol === undefined || vol === null) return acc;
                    return acc + (parseFloat(String(vol).replace(',', '.')) || 0);
                }, 0);
            }

            // B. FATURAMENTO
            if (mesFiltro) {
                const anoMes = mesFiltro.split('-'); 
                const ultimoDia = new Date(anoMes[0], anoMes[1], 0).getDate(); 
                
                const dataInicio = `${mesFiltro}-01`;
                const dataFim = `${mesFiltro}-${ultimoDia}`;

                const { data: fatDB } = await window.supabaseClient
                    .from('faturamento_diario')
                    .select('valor')
                    .eq('filial_id', filial.id) 
                    .gte('data_faturamento', dataInicio) 
                    .lte('data_faturamento', dataFim);   

                if (fatDB && fatDB.length > 0) {
                    faturamentoReal = fatDB.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
                }
            }

            // C. DISPONIBILIDADE MECÂNICA
            const { data: frotaDB } = await window.supabaseClient
                .from('frotas_manutencao')
                .select('cavalo')
                .eq('filial_id', filial.id)
                .eq('status', 'Ativo');

            const { data: osDB } = await window.supabaseClient
                .from('ordens_servico')
                .select('placa, status, tipo')
                .eq('filial_id', filial.id)
                .in('status', ['Aguardando Oficina', 'Em Manutenção', 'Sinistrado']);

            if (frotaDB && frotaDB.length > 0) {
                const listaCavalos = frotaDB.map(f => f.cavalo.trim().toUpperCase());
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

            totalFatGlobal += faturamentoReal;
            totalProdGlobal += producaoReal;
            if (frotaDB && frotaDB.length > 0) {
                totalDmGlobal += dmReal;
                filiaisValidasParaDM++;
            }

            filiaisData.push({
                id: filial.id,
                nome: filial.nome || `Filial ${filial.id}`,
                cidade: filial.cidade || filial.nome || 'Não Informada', 
                faturamento: faturamentoReal,
                producao: producaoReal,
                dm: dmReal,
                status: dmReal >= 85 ? 'Operacional' : 'Atenção'
            });
        }

        // 4. ATUALIZAR KPIs GLOBAIS NO TOPO
        const mediaDmGlobal = filiaisValidasParaDM > 0 ? (totalDmGlobal / filiaisValidasParaDM).toFixed(1) : 0;

        document.getElementById('kpiFatGlobal').innerText = totalFatGlobal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        // Alterado para Metros Cúbicos
        document.getElementById('kpiProdGlobal').innerText = totalProdGlobal.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' m³';
        document.getElementById('kpiDmGlobal').innerText = mediaDmGlobal + '%';
        document.getElementById('kpiFiliaisAtivas').innerText = filiaisData.length.toString();

        // 5. RENDERIZAR OS CARDS (Com m³)
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
                            <span class="font-semibold text-white">${filial.producao.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m³</span>
                        </div>
                        <div class="flex justify-between items-center pb-1">
                            <span class="text-gray-400 text-sm"><i class="fas fa-tools w-5 text-orange-400"></i> Disponib. Mecânica</span>
                            <span class="font-semibold ${filial.dm < 85 ? 'text-yellow-400' : 'text-green-400'}">${filial.dm}%</span>
                        </div>
                    </div>
                </div>
            `;
        });
        if (containerCards) containerCards.innerHTML = cardsHtml;

        // 6. ATUALIZAR GRÁFICOS DO ECHARTS
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

    const nomesEixoX = dados.map(d => d.cidade);
    
    const faturamentos = dados.map(d => d.faturamento);
    const producoes = dados.map(d => d.producao);

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' }
        },
        legend: {
            data: ['Faturamento (R$)', 'Produção (m³)'],
            textStyle: { color: '#cbd5e1' },
            top: 0
        },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: [
            {
                type: 'category',
                data: nomesEixoX, 
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
                axisLabel: { color: '#94a3b8', formatter: '{value} m³' },
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
                name: 'Produção (m³)',
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