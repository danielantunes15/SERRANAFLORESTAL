// ==================== modules/gerencial/visao_executiva/visao_executiva.js ====================

// Cache do cliente Supabase exclusivo para evitar instâncias duplicadas (resolve o aviso no console)
let clientDMCache = null;

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

// ====================================================================================
// FUNÇÃO EXCLUSIVA DE CÁLCULO DE DM IGUAL AO PAINEL RELATÓRIO GERENCIAL
// Faz o cálculo da média dia a dia (limitando a max 24h de manutenção/dia por caminhão)
// ====================================================================================
function calcularDMMediaDiaria(frotas, ordens, ano, mes) {
    if (!frotas || frotas.length === 0) return 100.0;
    
    const agora = new Date();
    let diasARenderizar = 0;
    let diasPassados = 0;
    
    // Se for o mês atual, renderiza do dia 1 até hoje
    if (ano === agora.getFullYear() && mes === agora.getMonth() + 1) {
        diasARenderizar = agora.getDate(); 
        diasPassados = diasARenderizar - 1; 
    } else {
        // Se for mês fechado, renderiza todos os dias do mês
        const ultimoDia = new Date(ano, mes, 0).getDate();
        diasARenderizar = ultimoDia;
        diasPassados = ultimoDia - 1;
    }

    let somaDM = 0;
    const msPorDia = 24 * 60 * 60 * 1000;

    for (let i = diasPassados; i >= 0; i--) {
        let dataDia;
        if (ano === agora.getFullYear() && mes === agora.getMonth() + 1) {
            dataDia = new Date(agora);
            dataDia.setDate(agora.getDate() - i);
        } else {
            dataDia = new Date(ano, mes - 1, diasARenderizar - i); 
        }

        const inicioDia = new Date(dataDia.getFullYear(), dataDia.getMonth(), dataDia.getDate(), 0, 0, 0);
        const fimDia = new Date(dataDia.getFullYear(), dataDia.getMonth(), dataDia.getDate(), 23, 59, 59, 999);
        
        let msManutencaoNesteDia = 0;

        frotas.forEach(frota => {
            let manutencaoCavalo = 0;
            const cavaloPlaca = (frota.cavalo || '').trim().toUpperCase();
            const osDoCavalo = ordens.filter(o => (o.placa || '').trim().toUpperCase() === cavaloPlaca);
            
            osDoCavalo.forEach(os => {
                if (os.status === 'Agendada') return;

                let osInicioStr = os.data_abertura;
                if (!osInicioStr) return;
                if (!osInicioStr.includes('T')) osInicioStr += 'T00:00:00';
                const osInicio = new Date(osInicioStr.replace('Z', '').replace('+00:00', ''));
                
                let osFim = agora;
                if (os.data_conclusao) {
                    let osFimStr = os.data_conclusao;
                    if (!osFimStr.includes('T')) osFimStr += 'T00:00:00';
                    osFim = new Date(osFimStr.replace('Z', '').replace('+00:00', ''));
                }

                const overlapInicio = osInicio > inicioDia ? osInicio : inicioDia;
                const overlapFim = osFim < fimDia ? osFim : fimDia;

                if (overlapInicio < overlapFim) {
                    manutencaoCavalo += (overlapFim.getTime() - overlapInicio.getTime());
                }
            });
            
            // Limitador idêntico ao dm_operacional.js: Não pode ter mais que 24h de oficina num dia por caminhão
            if (manutencaoCavalo > msPorDia) manutencaoCavalo = msPorDia;
            msManutencaoNesteDia += manutencaoCavalo;
        });

        const totalMsDisponivelPorDia = frotas.length * msPorDia;
        let dispNesteDia = totalMsDisponivelPorDia - msManutencaoNesteDia;
        if (dispNesteDia < 0) dispNesteDia = 0;
        
        let percentDM = totalMsDisponivelPorDia > 0 ? (dispNesteDia / totalMsDisponivelPorDia) * 100 : 100;
        somaDM += percentDM;
    }

    return diasARenderizar > 0 ? Number((somaDM / diasARenderizar).toFixed(1)) : 100.0;
}
// ====================================================================================

window.atualizarDadosExecutivos = async function() {
    const inputMes = document.getElementById('execFiltroMes');
    const mesFiltro = inputMes ? inputMes.value : ''; // Formato esperado: "YYYY-MM"

    const containerCards = document.getElementById('containerCardsFiliais');
    if (containerCards) {
        containerCards.innerHTML = '<div class="col-span-full text-center text-gray-400 py-10"><i class="fas fa-spinner fa-spin fa-2x mb-3"></i><p>Extraindo e calculando o volume de todas as filiais...</p></div>';
    }

    try {
        // Inicializar o cliente de banco de dados da manutenção (DM) APENAS UMA VEZ
        if (!clientDMCache) {
            const supabaseUrlDM = 'https://ihgiyxzxdldqmrkziijl.supabase.co';
            const supabaseKeyDM = 'sb_publishable_JpMZhW5ZrFKBr7m9KXBkoQ_cpxy1k3x';
            clientDMCache = window.supabase ? window.supabase.createClient(supabaseUrlDM, supabaseKeyDM) : window.supabaseClient;
        }
        const clientDM = clientDMCache;

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

        const hoje = new Date();
        let anoFiltro = hoje.getFullYear();
        let mesFiltroInt = hoje.getMonth() + 1;
        if (mesFiltro) {
            const p = mesFiltro.split('-');
            anoFiltro = parseInt(p[0]);
            mesFiltroInt = parseInt(p[1]);
        }

        // =========================================================
        // 2. BUSCAR TODO O HISTÓRICO DE PRODUÇÃO, FROTAS E O.S. GLOBAL
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

        // Buscar todas frotas e O.S para DM Real Unificada
        const { data: todasFrotasDM } = await clientDM
            .from('frotas_manutencao')
            .select('cavalo, filial_id')
            .eq('status', 'Ativo');

        const { data: todasOrdensDM } = await clientDM
            .from('ordens_servico')
            .select('placa, status, tipo, data_abertura, data_conclusao, filial_id')
            .neq('status', 'Agendada');

        // Calcula a DM GLOBAL real exata do sistema inteiro (igual ao Relatório Gerencial)
        const dmMediaGlobalCalculada = calcularDMMediaDiaria(todasFrotasDM || [], todasOrdensDM || [], anoFiltro, mesFiltroInt);

        let filiaisData = [];
        let totalFatGlobal = 0;
        let totalProdGlobal = 0;

        // 3. PROCESSAR OS DADOS DE CADA FILIAL ISOLADAMENTE
        for (let filial of filiaisDB) {
            
            let faturamentoReal = 0;
            let producaoReal = 0;

            // A. PRODUÇÃO
            const viagensDB = todasViagens.filter(v => String(v.filial_id) === String(filial.id));

            if (viagensDB.length > 0) {
                const viagensFiltradas = viagensDB.filter(v => {
                    if (!mesFiltro) return true;
                    
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

            // C. DM ESPECÍFICA DA FILIAL
            const frotasFilial = (todasFrotasDM || []).filter(f => String(f.filial_id) === String(filial.id));
            const ordensFilial = (todasOrdensDM || []).filter(o => String(o.filial_id) === String(filial.id));
            
            const dmRealFilial = calcularDMMediaDiaria(frotasFilial, ordensFilial, anoFiltro, mesFiltroInt);

            totalFatGlobal += faturamentoReal;
            totalProdGlobal += producaoReal;

            filiaisData.push({
                id: filial.id,
                nome: filial.nome || `Filial ${filial.id}`,
                cidade: filial.cidade || filial.nome || 'Não Informada', 
                faturamento: faturamentoReal,
                producao: producaoReal,
                dm: dmRealFilial,
                status: dmRealFilial >= 85 ? 'Operacional' : 'Atenção'
            });
        }

        // 4. ATUALIZAR KPIs GLOBAIS NO TOPO
        document.getElementById('kpiFatGlobal').innerText = totalFatGlobal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('kpiProdGlobal').innerText = totalProdGlobal.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' m³';
        document.getElementById('kpiDmGlobal').innerText = dmMediaGlobalCalculada + '%';
        document.getElementById('kpiFiliaisAtivas').innerText = filiaisData.length.toString();

        // 5. RENDERIZAR OS CARDS
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
        
        // =========================================================
        // EXTRAÇÃO REAL DOS ÚLTIMOS 6 MESES DE FATURAMENTO GLOBAL
        // =========================================================
        let mesesArray = [];
        const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        
        let anoReferencia = hoje.getFullYear();
        let mesReferencia = hoje.getMonth() + 1;
        
        if (mesFiltro) {
            const partes = mesFiltro.split('-');
            anoReferencia = parseInt(partes[0]);
            mesReferencia = parseInt(partes[1]);
        }
        
        // Gerar os limites de data retroativos para os 6 meses
        for (let i = 5; i >= 0; i--) {
            let d = new Date(anoReferencia, mesReferencia - 1 - i, 1);
            let ano = d.getFullYear();
            let mes = d.getMonth();
            let ultimoDia = new Date(ano, mes + 1, 0).getDate();
            
            let mesString = String(mes + 1).padStart(2, '0');
            mesesArray.push({
                label: nomesMeses[mes],
                anoMes: `${ano}-${mesString}`,
                start: `${ano}-${mesString}-01`,
                end: `${ano}-${mesString}-${ultimoDia}`,
                total: 0
            });
        }
        
        const dataInicio6Meses = mesesArray[0].start;
        const dataFim6Meses = mesesArray[5].end;
        
        // Consultar todo o período histórico de 6 meses
        const { data: fat6MesesDB } = await window.supabaseClient
            .from('faturamento_diario')
            .select('valor, data_faturamento')
            .gte('data_faturamento', dataInicio6Meses)
            .lte('data_faturamento', dataFim6Meses);
            
        if (fat6MesesDB && fat6MesesDB.length > 0) {
            fat6MesesDB.forEach(item => {
                const dataFat = item.data_faturamento;
                if (dataFat) {
                    const anoMesItem = dataFat.substring(0, 7);
                    const mesObj = mesesArray.find(m => m.anoMes === anoMesItem);
                    if (mesObj) {
                        mesObj.total += (Number(item.valor) || 0);
                    }
                }
            });
        }
        
        const historicoGlobalMeses = mesesArray.map(m => m.label);
        const historicoGlobalValores = mesesArray.map(m => m.total);
        
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