// ==================== modules/gerencial/visao_executiva/visao_executiva.js ====================

// 1. CONEXÃO COM O BANCO DE DADOS EXCLUSIVO (DM / OFICINA)
const supabaseUrlDM = 'https://ihgiyxzxdldqmrkziijl.supabase.co';
const supabaseKeyDM = 'sb_publishable_JpMZhW5ZrFKBr7m9KXBkoQ_cpxy1k3x';
const supabaseDM = window.supabase.createClient(supabaseUrlDM, supabaseKeyDM);

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
        // 1. BUSCAR AS FILIAIS CADASTRADAS (Banco Principal)
        const { data: filiaisDB, error: errFiliais } = await window.supabaseClient
            .from('filiais')
            .select('*')
            .order('nome', { ascending: true });

        if (errFiliais) throw errFiliais;

        if (!filiaisDB || filiaisDB.length === 0) {
            if (containerCards) containerCards.innerHTML = '<div class="col-span-full text-center text-yellow-400 py-10"><i class="fas fa-exclamation-triangle fa-2x mb-3"></i><p>Nenhuma filial encontrada.</p></div>';
            
            // Tratamento de erro seguro
            if (document.getElementById('kpiFatGlobal')) document.getElementById('kpiFatGlobal').innerText = 'R$ 0,00';
            if (document.getElementById('kpiProdGlobal')) document.getElementById('kpiProdGlobal').innerText = '0 m³';
            if (document.getElementById('kpiDmGlobal')) document.getElementById('kpiDmGlobal').innerText = '0%';
            if (document.getElementById('kpiFiliaisAtivas')) document.getElementById('kpiFiliaisAtivas').innerText = '0';
            
            renderizarGraficoComparativo([]);
            return;
        }

        // =========================================================
        // 2. BUSCAR TODO O HISTÓRICO DE VIAGENS (Contornando o limite de 1000)
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

        // =========================================================
        // 3. BUSCAR FATURAMENTO DOS ÚLTIMOS 6 MESES (Gráfico Evolução)
        // =========================================================
        const mesesHistorico = [];
        const faturamentoHistorico = [];
        
        if (mesFiltro) {
            let anoAtual = parseInt(mesFiltro.split('-')[0]);
            let mesAtual = parseInt(mesFiltro.split('-')[1]);
            
            let dataFimHist = new Date(anoAtual, mesAtual, 0); 
            let dataInicioHist = new Date(anoAtual, mesAtual - 6, 1); 
            
            let strInicioHist = `${dataInicioHist.getFullYear()}-${String(dataInicioHist.getMonth() + 1).padStart(2, '0')}-01`;
            let strFimHist = `${dataFimHist.getFullYear()}-${String(dataFimHist.getMonth() + 1).padStart(2, '0')}-${String(dataFimHist.getDate()).padStart(2, '0')}`;

            // Puxa tudo dos últimos 6 meses de uma vez
            const { data: fatHistDB } = await window.supabaseClient
                .from('faturamento_diario')
                .select('valor, data_faturamento')
                .gte('data_faturamento', strInicioHist)
                .lte('data_faturamento', strFimHist);

            const nomeMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

            // Consolidar mês a mês dinamicamente
            for (let i = 5; i >= 0; i--) {
                let d = new Date(anoAtual, mesAtual - 1 - i, 1);
                let mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                let mNome = nomeMeses[d.getMonth()];
                
                let totalMes = 0;
                if (fatHistDB) {
                    totalMes = fatHistDB.filter(f => f.data_faturamento && f.data_faturamento.startsWith(mStr))
                                        .reduce((sum, curr) => sum + (Number(curr.valor) || 0), 0);
                }
                mesesHistorico.push(`${mNome}/${String(d.getFullYear()).slice(-2)}`);
                faturamentoHistorico.push(totalMes);
            }
        }

        // =========================================================
        // 4. BUSCAR A MÉDIA DE DM DIÁRIA (DIRETO DA TABELA dm_operacional)
        // =========================================================
        let dmGlobalMediaMes = 0;
        if (mesFiltro) {
            const anoMes = mesFiltro.split('-'); 
            const ultimoDia = new Date(anoMes[0], anoMes[1], 0).getDate(); 
            const dataInicioDM = `${mesFiltro}-01`;
            const dataFimDM = `${mesFiltro}-${String(ultimoDia).padStart(2,'0')}`;

            // ATENÇÃO: Aqui usamos o supabaseDM para aceder aos dados importados
            const { data: dmDB } = await supabaseDM
                .from('dm_operacional')
                .select('carros_rodaram, total_frota')
                .gte('data_registro', dataInicioDM)
                .lte('data_registro', dataFimDM);

            if (dmDB && dmDB.length > 0) {
                let totalPerc = 0;
                let validDays = 0;
                dmDB.forEach(reg => {
                    let rodou = Number(reg.carros_rodaram) || 0;
                    let total = Number(reg.total_frota) || 0;
                    if (total > 0) {
                        totalPerc += (rodou / total) * 100;
                        validDays++;
                    }
                });
                if (validDays > 0) dmGlobalMediaMes = Number((totalPerc / validDays).toFixed(1));
            }
        }

        // =========================================================
        // 5. BUSCAR FROTAS E O.S (Banco DM - para Cards das Filiais)
        // =========================================================
        const { data: frotaDB } = await supabaseDM.from('frotas_manutencao').select('cavalo, filial_id').eq('status', 'Ativo');
        const { data: osDB } = await supabaseDM.from('ordens_servico').select('placa, filial_id, status, tipo').in('status', ['Aguardando Oficina', 'Em Manutenção', 'Sinistrado']);

        let filiaisData = [];
        let totalFatGlobal = 0;
        let totalProdGlobal = 0;

        for (let filial of filiaisDB) {
            let faturamentoReal = 0;
            let producaoReal = 0;
            let dmReal = dmGlobalMediaMes; // Fallback caso a filial não possua veículos isolados configurados

            // A. PRODUÇÃO DA FILIAL
            const viagensFiltradas = todasViagens.filter(v => {
                if (String(v.filial_id) !== String(filial.id)) return false;
                if (!mesFiltro) return true; 
                
                let dataOriginal = v.dataDaBaseExcel || v.created_at;
                if (!dataOriginal) return false;
                
                let dataLimpa = String(dataOriginal).trim().split('T')[0].split(' ')[0]; 
                if (dataLimpa.includes('/')) {
                    let partes = dataLimpa.split('/');
                    if (partes.length >= 3) {
                        let ano = partes[2].length === 2 ? "20" + partes[2] : partes[2];
                        return `${ano}-${partes[1].padStart(2, '0')}` === mesFiltro;
                    }
                } else if (dataLimpa.includes('-')) {
                    let partes = dataLimpa.split('-');
                    return `${partes[0]}-${partes[1].padStart(2, '0')}` === mesFiltro;
                }
                return false;
            });
            
            producaoReal = viagensFiltradas.reduce((acc, curr) => acc + (parseFloat(String(curr.volumeReal).replace(',', '.')) || 0), 0);

            // B. FATURAMENTO DA FILIAL (Mês atual selecionado)
            if (mesFiltro) {
                const anoMes = mesFiltro.split('-'); 
                const ultimoDia = new Date(anoMes[0], anoMes[1], 0).getDate(); 
                const dataInicio = `${mesFiltro}-01`;
                const dataFim = `${mesFiltro}-${String(ultimoDia).padStart(2,'0')}`;

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

            // C. DISPONIBILIDADE MECÂNICA ESPECÍFICA DA FILIAL (Calculado via O.S. ativas)
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

            totalFatGlobal += faturamentoReal;
            totalProdGlobal += producaoReal;

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

        // =========================================================
        // 6. ATUALIZAR KPIs GLOBAIS NO TOPO (Com validação se existem no DOM)
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

        // =========================================================
        // 7. RENDERIZAR OS CARDS DA FILIAIS
        // =========================================================
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

        // =========================================================
        // 8. ATUALIZAR GRÁFICOS DO ECHARTS (DADOS DINÂMICOS)
        // =========================================================
        renderizarGraficoComparativo(filiaisData);
        renderizarGraficoEvolucao(mesesHistorico, faturamentoHistorico);

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