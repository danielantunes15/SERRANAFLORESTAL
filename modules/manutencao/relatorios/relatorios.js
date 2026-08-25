// ==================== modules/manutencao/relatorios/relatorios.js ====================

let relManutCharts = {};

window.renderizarTelaRelatoriosManutencao = async function() {
    const dataAtual = new Date();
    const dataInicio = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), 1);
    const dataFim = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + 1, 0);
    
    const formatData = (d) => {
        const ano = d.getFullYear();
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const dia = String(d.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    };
    
    document.getElementById('relManutDataInicio').value = formatData(dataInicio);
    document.getElementById('relManutDataFim').value = formatData(dataFim);

    window.addEventListener('resize', resizeChartsManutencao);
    
    // Gatilho automático
    await window.carregarDadosRelatorioManutencao();
};

window.resizeChartsManutencao = function() {
    Object.values(relManutCharts).forEach(chart => {
        if(chart) chart.resize();
    });
};

window.carregarDadosRelatorioManutencao = async function() {
    const dataInicioStr = document.getElementById('relManutDataInicio').value;
    const dataFimStr = document.getElementById('relManutDataFim').value;

    if(!dataInicioStr || !dataFimStr) {
        return alert("Por favor, selecione as datas de início e fim.");
    }

    try {
        let queryOS = window.supabaseClient.from('ordens_servico')
            .select('id, placa, mecanico_responsavel, data_abertura')
            .gte('data_abertura', dataInicioStr + 'T00:00:00')
            .lte('data_abertura', dataFimStr + 'T23:59:59');
            
        if (typeof window.aplicarFiltroFilial === 'function') queryOS = window.aplicarFiltroFilial(queryOS);
        const { data: ordens, error: errOS } = await queryOS;

        if (errOS) throw errOS;

        document.getElementById('kpiTotalOS').innerText = ordens ? ordens.length : '0';

        if (!ordens || ordens.length === 0) {
            limparDashboardManutencao();
            return; 
        }

        const osIds = ordens.map(o => o.id);

        let queryPecas = window.supabaseClient.from('os_pecas_utilizadas').select('*').in('os_id', osIds);
        if (typeof window.aplicarFiltroFilial === 'function') queryPecas = window.aplicarFiltroFilial(queryPecas);
        const { data: pecasUsadas } = await queryPecas;

        let queryServ = window.supabaseClient.from('os_servicos_executados').select('*').in('os_id', osIds);
        if (typeof window.aplicarFiltroFilial === 'function') queryServ = window.aplicarFiltroFilial(queryServ);
        const { data: servicosExec } = await queryServ;

        let queryCat = window.supabaseClient.from('almoxarifado_pecas').select('id, nome, codigo, preco_medio');
        if (typeof window.aplicarFiltroFilial === 'function') queryCat = window.aplicarFiltroFilial(queryCat);
        const { data: catalogo } = await queryCat;

        // Processamento
        let totalCustoGlobal = 0;
        let totalPecasGlobal = 0;
        
        let aggFrota = {};
        let aggCompartimento = {};
        let aggMecanicoPecas = {};
        let aggTopPecas = {};
        let aggMecanicoServicos = {};

        // Variáveis para somar tudo do período no visual do Tritrem
        let totalCavaloMes = 0, totalComp1Mes = 0, totalComp2Mes = 0, totalComp3Mes = 0;

        (pecasUsadas || []).forEach(p => {
            if (p.status !== 'Aprovado') return;

            let osRel = ordens.find(o => o.id === p.os_id);
            let catRel = (catalogo || []).find(c => String(c.id) === String(p.peca_id));
            
            let placa = osRel && osRel.placa ? osRel.placa : 'S/ Placa (Não Ident.)';
            let mecanico = p.mecanico || (osRel ? osRel.mecanico_responsavel : 'Não Informado') || 'Não Informado';
            let comp = p.compartimento || 'Geral';
            
            let custoUnitario = parseFloat(p.valor_unitario) || (catRel ? parseFloat(catRel.preco_medio || 0) : 0);
            let custoLinha = custoUnitario * parseFloat(p.quantidade || 0);

            totalCustoGlobal += custoLinha;
            totalPecasGlobal += parseFloat(p.quantidade || 0);

            aggFrota[placa] = (aggFrota[placa] || 0) + custoLinha;
            aggCompartimento[comp] = (aggCompartimento[comp] || 0) + parseFloat(p.quantidade || 0);
            aggMecanicoPecas[mecanico] = (aggMecanicoPecas[mecanico] || 0) + parseFloat(p.quantidade || 0);

            let nomePeca = catRel ? catRel.nome : `Peça ID ${p.peca_id}`;
            let codigoPeca = (catRel && catRel.codigo) ? `[${catRel.codigo}] ` : '';
            let nomeFinal = codigoPeca + nomePeca;
            
            if(!aggTopPecas[nomeFinal]) aggTopPecas[nomeFinal] = { qtd: 0, custo: 0 };
            aggTopPecas[nomeFinal].qtd += parseFloat(p.quantidade || 0);
            aggTopPecas[nomeFinal].custo += custoLinha;

            // Lógica para acumular no visual do Tritrem durante todo o período
            let compLower = (comp || '').toLowerCase();
            if (compLower.includes('1') || compLower.includes('comp 1') || compLower.includes('comp1')) {
                totalComp1Mes += custoLinha;
            } else if (compLower.includes('2') || compLower.includes('comp 2') || compLower.includes('comp2')) {
                totalComp2Mes += custoLinha;
            } else if (compLower.includes('3') || compLower.includes('comp 3') || compLower.includes('comp3')) {
                totalComp3Mes += custoLinha;
            } else {
                totalCavaloMes += custoLinha;
            }
        });

        (servicosExec || []).forEach(s => {
            let mecanico = s.mecanico || 'Não Informado';
            aggMecanicoServicos[mecanico] = (aggMecanicoServicos[mecanico] || 0) + 1;
        });

        // Atualizar KPIs globais
        document.getElementById('kpiTotalPecas').innerText = totalPecasGlobal.toFixed(0);
        document.getElementById('kpiCustoTotal').innerText = totalCustoGlobal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('kpiTotalServicos').innerText = (servicosExec || []).length;

        // Atualizar painel do Tritrem com os dados do período todo
        atualizarPainelTritrem(totalCavaloMes, totalComp1Mes, totalComp2Mes, totalComp3Mes, totalCustoGlobal);
        document.getElementById('lbl-total-tritrem').innerText = "Custo Total do Período:";

        // ECharts Rendering
        renderChartBarras(
            'chartCustoFrota', 
            aggFrota, 
            'Custo R$', 
            ['#34d399', '#059669'], 
            val => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        );

        renderChartDonut('chartCompartimentos', aggCompartimento, 'Requisições');
        
        renderChartBarras(
            'chartPecasMecanico', 
            aggMecanicoPecas, 
            'Qtd Peças', 
            ['#fbbf24', '#d97706'] 
        );
        
        renderChartBarras(
            'chartServicosMecanico', 
            aggMecanicoServicos, 
            'Serviços', 
            ['#c084fc', '#9333ea'] 
        );

        // Tabela Top Peças
        let topPecasArray = Object.keys(aggTopPecas).map(nome => ({
            nome: nome,
            qtd: aggTopPecas[nome].qtd,
            custo: aggTopPecas[nome].custo
        }));
        
        topPecasArray.sort((a, b) => b.qtd - a.qtd);

        const containerTabela = document.getElementById('tabelaTopPecas');
        if (topPecasArray.length === 0) {
            containerTabela.innerHTML = '<p style="padding: 15px; text-align: center; color: #64748b;">Nenhuma peça liberada pelo almoxarifado no período.</p>';
        } else {
            containerTabela.innerHTML = topPecasArray.map(p => `
                <div class="manut-rel-row">
                    <span class="peca-nome">${p.nome}</span>
                    <span class="peca-qtd">${p.qtd}</span>
                    <span class="peca-custo">${p.custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
            `).join('');
        }

    } catch (e) {
        console.error("Erro ao gerar relatórios:", e);
        alert("Ocorreu um erro ao buscar os dados do relatório.");
    }
};

// ==================== Lógica Visual Tritrem ====================
window.buscarDadosTritrem = async function() {
    const osIdStr = document.getElementById('filtroOSTritrem').value.trim();
    if(!osIdStr) {
        alert('Por favor, digite o número/ID da O.S. (Ou clique em "Limpar O.S" para voltar ao período)');
        return;
    }
    
    try {
        const osId = isNaN(osIdStr) ? osIdStr : parseInt(osIdStr);

        let { data: pecas, error } = await window.supabaseClient
            .from('os_pecas_utilizadas')
            .select('valor_unitario, quantidade, compartimento, status, peca_id')
            .eq('os_id', osId)
            .eq('status', 'Aprovado');

        if (error) throw error;
        
        if(!pecas || pecas.length === 0) {
            alert('Nenhuma peça aprovada (com saída de almoxarifado) encontrada para a O.S ' + osId + '.');
            atualizarPainelTritrem(0, 0, 0, 0, 0);
            document.getElementById('lbl-total-tritrem').innerText = `Custo Total da O.S ${osId}:`;
            return;
        }

        let { data: catalogo } = await window.supabaseClient.from('almoxarifado_pecas').select('id, preco_medio');

        let custoCavalo = 0, custoComp1 = 0, custoComp2 = 0, custoComp3 = 0;

        pecas.forEach(p => {
            let catRel = (catalogo || []).find(c => String(c.id) === String(p.peca_id));
            let custoUnitario = parseFloat(p.valor_unitario) || (catRel ? parseFloat(catRel.preco_medio || 0) : 0);
            let custoTotalLinha = custoUnitario * parseFloat(p.quantidade || 0);

            let comp = (p.compartimento || '').toLowerCase();
            
            if (comp.includes('1') || comp.includes('comp 1') || comp.includes('comp1')) {
                custoComp1 += custoTotalLinha;
            } else if (comp.includes('2') || comp.includes('comp 2') || comp.includes('comp2')) {
                custoComp2 += custoTotalLinha;
            } else if (comp.includes('3') || comp.includes('comp 3') || comp.includes('comp3')) {
                custoComp3 += custoTotalLinha;
            } else {
                custoCavalo += custoTotalLinha;
            }
        });

        let total = custoCavalo + custoComp1 + custoComp2 + custoComp3;
        atualizarPainelTritrem(custoCavalo, custoComp1, custoComp2, custoComp3, total);
        document.getElementById('lbl-total-tritrem').innerText = `Custo Total da O.S ${osId}:`;

    } catch (e) {
        console.error('Erro ao buscar dados do tritrem:', e);
        alert('Erro ao buscar a O.S. Verifique se o ID está correto.');
    }
};

window.limparBuscaOSTritrem = function() {
    document.getElementById('filtroOSTritrem').value = '';
    window.carregarDadosRelatorioManutencao(); 
};

function atualizarPainelTritrem(cavalo, comp1, comp2, comp3, total) {
    const format = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('ui-cavalo').innerText = format(cavalo);
    document.getElementById('ui-comp1').innerText = format(comp1);
    document.getElementById('ui-comp2').innerText = format(comp2);
    document.getElementById('ui-comp3').innerText = format(comp3);
    document.getElementById('total-os-tritrem').innerText = format(total);
}

function renderChartBarras(elementId, dicionarioDados, nomeSerie, coresGradiente, formatador = null) {
    let el = document.getElementById(elementId);
    if (!el) return;

    if (relManutCharts[elementId]) relManutCharts[elementId].dispose();
    relManutCharts[elementId] = echarts.init(el);

    let arrayDados = Object.keys(dicionarioDados).map(k => ({ name: k, value: dicionarioDados[k] }));
    arrayDados.sort((a, b) => a.value - b.value); 

    let chaves = arrayDados.map(d => d.name);
    let valores = arrayDados.map(d => d.value);

    let option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            backgroundColor: '#1e293b',
            borderColor: '#334155',
            textStyle: { color: '#f8fafc' },
            formatter: function (params) {
                let val = params[0].value;
                if(formatador) val = formatador(val);
                return `<strong style="color:#818cf8;">${params[0].name}</strong><br/>${params[0].marker} ${nomeSerie}: <b>${val}</b>`;
            }
        },
        grid: { left: '2%', right: '8%', bottom: '2%', top: '5%', containLabel: true },
        xAxis: { 
            type: 'value', 
            splitLine: { show: true, lineStyle: { color: '#334155', type: 'dashed' } },
            axisLabel: { color: '#94a3b8' }
        },
        yAxis: { 
            type: 'category', 
            data: chaves,
            axisLine: { lineStyle: { color: '#475569' } },
            axisLabel: { color: '#cbd5e1', width: 120, overflow: 'truncate', fontWeight: 'bold' }
        },
        series: [{
            name: nomeSerie,
            type: 'bar',
            data: valores,
            barWidth: '60%',
            itemStyle: { 
                color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
                    { offset: 0, color: coresGradiente[0] },
                    { offset: 1, color: coresGradiente[1] }
                ]),
                borderRadius: [0, 8, 8, 0] 
            },
            label: {
                show: true,
                position: 'right',
                color: '#f8fafc',
                fontWeight: 'bold',
                formatter: (p) => formatador ? formatador(p.value) : p.value
            }
        }]
    };

    relManutCharts[elementId].setOption(option);
}

function renderChartDonut(elementId, dicionarioDados, nomeSerie) {
    let el = document.getElementById(elementId);
    if (!el) return;

    if (relManutCharts[elementId]) relManutCharts[elementId].dispose();
    relManutCharts[elementId] = echarts.init(el);

    let arrayDados = Object.keys(dicionarioDados).map(k => ({ name: k, value: dicionarioDados[k] }));
    
    const colorPalette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

    let option = {
        backgroundColor: 'transparent',
        color: colorPalette,
        tooltip: { 
            trigger: 'item',
            backgroundColor: '#1e293b',
            borderColor: '#334155',
            textStyle: { color: '#f8fafc' }
        },
        legend: {
            type: 'scroll',
            bottom: '0%',
            left: 'center',
            textStyle: { color: '#cbd5e1' },
            pageTextStyle: { color: '#cbd5e1' }
        },
        series: [
            {
                name: nomeSerie,
                type: 'pie',
                radius: ['45%', '75%'],
                center: ['50%', '45%'],
                avoidLabelOverlap: true,
                itemStyle: {
                    borderRadius: 8,
                    borderColor: '#1e293b',
                    borderWidth: 4
                },
                label: {
                    show: true,
                    color: '#cbd5e1',
                    formatter: '{b}\n{c} ({d}%)'
                },
                labelLine: {
                    lineStyle: { color: '#475569' },
                    smooth: 0.2,
                    length: 10,
                    length2: 20
                },
                data: arrayDados
            }
        ]
    };

    relManutCharts[elementId].setOption(option);
}

function limparDashboardManutencao() {
    document.getElementById('kpiTotalOS').innerText = '0';
    document.getElementById('kpiTotalPecas').innerText = '0';
    document.getElementById('kpiCustoTotal').innerText = 'R$ 0,00';
    document.getElementById('kpiTotalServicos').innerText = '0';
    
    document.getElementById('tabelaTopPecas').innerHTML = '<p style="padding: 15px; text-align: center; color: #64748b;">Nenhum dado encontrado para as datas.</p>';

    atualizarPainelTritrem(0,0,0,0,0);
    document.getElementById('lbl-total-tritrem').innerText = "Custo Total do Período:";

    Object.values(relManutCharts).forEach(chart => {
        if(chart) chart.clear();
    });
}