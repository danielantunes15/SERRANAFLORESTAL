// Variáveis globais para os dados e instâncias dos gráficos
window.epiDados = { pecas: [], requisicoes: [], movimentacoes: [] };
window.epiRegistrosFiltrados = []; // Cache para exportação Excel
window.epiCharts = {};

window.initControleEPIs = async function() {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    
    document.getElementById('epiDataInicio').value = inicioMes.toISOString().split('T')[0];
    document.getElementById('epiDataFim').value = hoje.toISOString().split('T')[0];

    await carregarDadosDBEPI();
    atualizarAlertasEstoqueEPI(); // Atualiza painel inferior de estoque detalhado
    aplicarFiltrosEPI();
    
    window.removeEventListener('resize', resizeEpiCharts);
    window.addEventListener('resize', resizeEpiCharts);
};

async function carregarDadosDBEPI() {
    try {
        // 1. Buscar Peças SOMENTE da categoria de EPIs
        let qPecas = window.supabaseClient.from('almoxarifado_pecas')
            .select('id, nome, codigo, preco_medio, quantidade, estoque_minimo, unidade')
            .ilike('categoria', '%E.P.I%'); 
        if (typeof window.aplicarFiltroFilial === 'function') qPecas = window.aplicarFiltroFilial(qPecas);
        const { data: pecas } = await qPecas;
        window.epiDados.pecas = pecas || [];
        const idsEPI = window.epiDados.pecas.map(p => p.id);

        if (idsEPI.length === 0) {
            console.warn("Nenhum EPI encontrado no cadastro de peças.");
            return;
        }

        // 2. Buscar Requisições de EPIs
        let qReq = window.supabaseClient.from('almoxarifado_requisicoes')
            .select('id, peca_id, colaborador_nome, usuario_solicitante, quantidade, status, valor_unitario, created_at')
            .in('peca_id', idsEPI);
        if (typeof window.aplicarFiltroFilial === 'function') qReq = window.aplicarFiltroFilial(qReq);
        const { data: requisicoes } = await qReq;
        window.epiDados.requisicoes = requisicoes || [];

        // 3. Buscar Movimentações (Apenas SAÍDAS - Consumo)
        let qMov = window.supabaseClient.from('almoxarifado_movimentacoes')
            .select('id, peca_id, tipo, quantidade, valor_unitario, usuario, setor_destino, data_movimentacao')
            .eq('tipo', 'saida')
            .in('peca_id', idsEPI);
        if (typeof window.aplicarFiltroFilial === 'function') qMov = window.aplicarFiltroFilial(qMov);
        const { data: movimentacoes } = await qMov;
        window.epiDados.movimentacoes = movimentacoes || [];

        // 4. Popular Select de Colaboradores de forma única
        const setColabs = new Set();
        window.epiDados.requisicoes.forEach(r => {
            if(r.colaborador_nome) setColabs.add(r.colaborador_nome.trim().toUpperCase());
        });
        window.epiDados.movimentacoes.forEach(m => {
            if(m.setor_destino) {
                let nomeLimpo = m.setor_destino.replace(/colaborador:\s*/i, '').trim().toUpperCase();
                setColabs.add(nomeLimpo);
            }
        });
        
        const selColab = document.getElementById('epiColaborador');
        if (selColab) {
            selColab.innerHTML = '<option value="">Todos os Colaboradores</option>' + 
                [...setColabs].filter(Boolean).sort().map(c => `<option value="${c}">${c}</option>`).join('');
        }
    } catch(e) {
        console.error("Erro ao carregar banco de dados de EPIs", e);
    }
}

function atualizarAlertasEstoqueEPI() {
    const formatMoeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    let totalEstoqueQtd = 0;
    let valorImobilizado = 0;
    let itensCriticos = 0;
    let itensAtencao = 0;
    let htmlTabela = '';

    // Ordenar peças pela urgência (quantidade em relação ao mínimo)
    const pecasOrdenadas = [...window.epiDados.pecas].sort((a,b) => {
        const saldoA = parseFloat(a.quantidade || 0) - parseFloat(a.estoque_minimo || 0);
        const saldoB = parseFloat(b.quantidade || 0) - parseFloat(b.estoque_minimo || 0);
        return saldoA - saldoB;
    });

    pecasOrdenadas.forEach(p => {
        const qtd = parseFloat(p.quantidade || 0);
        const min = parseFloat(p.estoque_minimo || 0);
        const preco = parseFloat(p.preco_medio || 0);
        
        totalEstoqueQtd += qtd;
        valorImobilizado += (qtd * preco);

        const critico = qtd <= min;
        const atencao = !critico && (qtd <= min * 1.3); // Margem de 30% acima do mínimo é atenção

        if (critico) itensCriticos++;
        if (atencao) itensAtencao++;

        // Cálculo da barra de progresso (Mínimo = 50% da barra para dar noção visual de folga)
        let pct = min > 0 ? (qtd / (min * 2)) * 100 : 100;
        if(pct > 100) pct = 100;
        
        let colorClass = 'green';
        let badge = `<span class="badge ok">Saudável</span>`;
        if (critico) { 
            colorClass = 'red'; 
            badge = `<span class="badge critico">Repor Imediato</span>`; 
        } else if (atencao) { 
            colorClass = 'orange'; 
            badge = `<span class="badge pendente">Atenção</span>`; 
        }

        // Renderiza todos os itens, mas o gestor vê os piores primeiro pelo sort
        htmlTabela += `<tr>
            <td style="color: #94a3b8;">${p.codigo || '-'}</td>
            <td style="font-weight: 600; color: #f8fafc;">${p.nome}</td>
            <td style="text-align:right; color: #a855f7; font-weight:600;">${formatMoeda(preco)}</td>
            <td>
                <div class="progress-wrapper">
                    <div class="progress-fill ${colorClass}" style="width: ${pct}%;"></div>
                </div>
                <div class="stock-meta">
                    <span>Atual: <strong>${qtd} ${p.unidade||'UN'}</strong></span>
                    <span>Mín: ${min}</span>
                </div>
            </td>
            <td style="text-align:center;">${badge}</td>
        </tr>`;
    });

    if(htmlTabela === '') htmlTabela = `<tr><td colspan="5" style="text-align:center; color:#10b981; padding: 20px;"><i class="fas fa-check-circle"></i> Nenhum EPI cadastrado no sistema.</td></tr>`;

    // Calcular giro (Consumo últimos 30 dias globais, independente do filtro de data)
    const hoje = new Date();
    const data30d = new Date(hoje.setDate(hoje.getDate() - 30)).toISOString().split('T')[0];
    
    let consumoQtd30d = 0;
    let consumoValor30d = 0;
    
    window.epiDados.movimentacoes.forEach(m => {
        if(m.data_movimentacao.split('T')[0] >= data30d) {
            let q = parseFloat(m.quantidade || 0);
            consumoQtd30d += q;
            consumoValor30d += (q * parseFloat(m.valor_unitario || 0));
        }
    });

    document.getElementById('kpiEstoqueFinanceiro').innerText = formatMoeda(valorImobilizado);
    document.getElementById('kpiEstoqueTotalQtd').innerText = `${totalEstoqueQtd} unidades em estoque`;
    document.getElementById('kpiEstoqueCritico').innerText = itensCriticos.toString();
    document.getElementById('kpiEstoqueAtencao').innerText = itensAtencao.toString();
    document.getElementById('kpiTendenciaGiro').innerText = formatMoeda(consumoValor30d);
    document.getElementById('kpiTendenciaGiroQtd').innerText = `Consumo de ${consumoQtd30d} unidades`;
    
    document.getElementById('tbodyAlertasEstoque').innerHTML = htmlTabela;
}

window.limparFiltrosEPI = function() {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    document.getElementById('epiDataInicio').value = inicioMes.toISOString().split('T')[0];
    document.getElementById('epiDataFim').value = hoje.toISOString().split('T')[0];
    document.getElementById('epiColaborador').value = '';
    aplicarFiltrosEPI();
}

window.aplicarFiltrosEPI = function() {
    const dataIni = document.getElementById('epiDataInicio').value;
    const dataFim = document.getElementById('epiDataFim').value;
    const colabFiltro = document.getElementById('epiColaborador').value.toUpperCase();

    const reqFiltradas = window.epiDados.requisicoes.filter(r => {
        const dataStr = r.created_at.split('T')[0];
        const nome = (r.colaborador_nome || '').trim().toUpperCase();
        if (dataIni && dataStr < dataIni) return false;
        if (dataFim && dataStr > dataFim) return false;
        if (colabFiltro && nome !== colabFiltro) return false;
        return true;
    });

    const movFiltradas = window.epiDados.movimentacoes.filter(m => {
        const dataStr = m.data_movimentacao.split('T')[0];
        const nome = (m.setor_destino || '').replace(/colaborador:\s*/i, '').trim().toUpperCase();
        if (dataIni && dataStr < dataIni) return false;
        if (dataFim && dataStr > dataFim) return false;
        if (colabFiltro && nome !== colabFiltro) return false;
        return true;
    });

    atualizarKpisEPI(reqFiltradas, movFiltradas);
    renderizarGraficosEPI(movFiltradas);
    renderizarTabelasEPI(reqFiltradas, movFiltradas);
};

function atualizarKpisEPI(reqs, movs) {
    let custoTotal = 0;
    let qtdEntregue = 0;
    const pessoasUnicas = new Set();
    let pendentes = 0;

    movs.forEach(m => {
        custoTotal += (parseFloat(m.quantidade || 0) * parseFloat(m.valor_unitario || 0));
        qtdEntregue += parseFloat(m.quantidade || 0);
        const nome = (m.setor_destino || '').replace(/colaborador:\s*/i, '').trim().toUpperCase();
        if (nome) pessoasUnicas.add(nome);
    });

    reqs.forEach(r => {
        if (r.status.toLowerCase() === 'pendente') pendentes++;
        const nome = (r.colaborador_nome || '').trim().toUpperCase();
        if(nome) pessoasUnicas.add(nome);
    });

    const formatMoeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    
    document.getElementById('kpiEpiCusto').innerText = formatMoeda(custoTotal);
    document.getElementById('kpiEpiQtd').innerText = qtdEntregue.toString();
    document.getElementById('kpiEpiPessoas').innerText = pessoasUnicas.size.toString();
    document.getElementById('kpiEpiPendentes').innerText = pendentes.toString();
}

function getNomePecaEPI(id) {
    const p = window.epiDados.pecas.find(x => x.id === id);
    return p ? p.nome : `Item ${id}`;
}

function renderizarGraficosEPI(movs) {
    const mapEpis = {};
    const mapColabs = {};
    const mapEvolucao = {};

    movs.forEach(m => {
        const nomeEpi = getNomePecaEPI(m.peca_id);
        const valor = parseFloat(m.quantidade || 0) * parseFloat(m.valor_unitario || 0);
        const qtd = parseFloat(m.quantidade || 0);
        const colab = (m.setor_destino || 'NÃO INFORMADO').replace(/colaborador:\s*/i, '').trim().toUpperCase();
        const data = m.data_movimentacao.split('T')[0];

        if (!mapEpis[nomeEpi]) mapEpis[nomeEpi] = { qtd: 0, val: 0 };
        mapEpis[nomeEpi].qtd += qtd;
        mapEpis[nomeEpi].val += valor;

        mapColabs[colab] = (mapColabs[colab] || 0) + valor;
        mapEvolucao[data] = (mapEvolucao[data] || 0) + valor;
    });

    // 1. Gráfico de Barras: Top 5 EPIs (Volume e R$)
    const topEpis = Object.keys(mapEpis)
        .map(k => ({name: k, qtd: mapEpis[k].qtd, val: mapEpis[k].val}))
        .sort((a,b) => b.qtd - a.qtd) 
        .slice(0, 5)
        .reverse(); 

    initEChart('chartTopEPIs', {
        tooltip: { 
            trigger: 'axis', 
            axisPointer: { type: 'shadow' },
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            borderColor: '#334155',
            textStyle: { color: '#f8fafc' },
            formatter: function(params) {
                const data = params[0].data;
                const formatMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.custo);
                return `<strong style="color:#3b82f6;">${params[0].name}</strong><br/>
                        <span style="color:#94a3b8;">Volume (Qtd):</span> ${data.value}<br/>
                        <span style="color:#94a3b8;">Custo Total:</span> <span style="color:#10b981; font-weight:bold;">${formatMoeda}</span>`;
            }
        },
        grid: { left: '2%', right: '8%', bottom: '2%', top: '2%', containLabel: true },
        xAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }, axisLabel: { color: '#94a3b8' } },
        yAxis: { type: 'category', data: topEpis.map(i => i.name), axisLabel: { color: '#cbd5e1', width: 140, overflow: 'truncate' } },
        series: [{
            type: 'bar',
            data: topEpis.map(i => ({ value: i.qtd, custo: i.val })),
            itemStyle: { 
                color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [{offset: 0, color: '#3b82f6'}, {offset: 1, color: '#1e3a8a'}]),
                borderRadius: [0, 4, 4, 0] 
            },
            label: { show: true, position: 'right', color: '#fff', fontWeight: 'bold', formatter: '{c}' }
        }]
    });

    // 2. Gráfico de Rosca: Top Solicitantes (R$)
    const topColabs = Object.keys(mapColabs)
        .map(k => ({name: k, value: mapColabs[k]}))
        .sort((a,b) => b.value - a.value)
        .slice(0, 5);

    initEChart('chartTopColab', {
        tooltip: { 
            trigger: 'item', 
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            borderColor: '#334155',
            textStyle: { color: '#f8fafc' },
            formatter: function(params) {
                const formatMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(params.value);
                return `<strong>${params.name}</strong><br/>Custo: <span style="color:#10b981; font-weight:bold;">${formatMoeda}</span> (${params.percent}%)`;
            }
        },
        legend: { orient: 'vertical', right: '0%', top: 'center', textStyle: { color: '#94a3b8', fontSize: 10 } },
        color: ['#10b981', '#3b82f6', '#f59e0b', '#a855f7', '#ef4444'],
        series: [{
            type: 'pie',
            radius: ['45%', '75%'],
            center: ['35%', '50%'],
            avoidLabelOverlap: false,
            itemStyle: { borderRadius: 8, borderColor: '#1e293b', borderWidth: 3 },
            label: { show: false },
            data: topColabs
        }]
    });

    // 3. Gráfico de Área: Evolução Diária
    const datasOrdenadas = Object.keys(mapEvolucao).sort();
    const valoresEvolucao = datasOrdenadas.map(d => mapEvolucao[d]);
    const datasFormatadas = datasOrdenadas.map(d => {
        const p = d.split('-'); return `${p[2]}/${p[1]}`;
    });

    initEChart('chartEvolucao', {
        tooltip: { 
            trigger: 'axis',
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            borderColor: '#334155',
            textStyle: { color: '#f8fafc' },
            formatter: function(params) {
                const formatMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(params[0].value);
                return `${params[0].name}<br/>Custo: <span style="color:#10b981; font-weight:bold;">${formatMoeda}</span>`;
            }
        },
        grid: { left: '2%', right: '3%', bottom: '5%', top: '10%', containLabel: true },
        xAxis: { type: 'category', boundaryGap: false, data: datasFormatadas, axisLabel: { color: '#94a3b8' } },
        yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }, axisLabel: { color: '#94a3b8' } },
        series: [{
            type: 'line',
            data: valoresEvolucao,
            smooth: true,
            symbol: 'circle',
            symbolSize: 8,
            itemStyle: { color: '#10b981' },
            areaStyle: { 
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    {offset: 0, color: 'rgba(16,185,129,0.4)'}, 
                    {offset: 1, color: 'rgba(16,185,129,0.0)'}
                ]) 
            },
            lineStyle: { width: 3 }
        }]
    });
}

function initEChart(id, option) {
    const el = document.getElementById(id);
    if (!el) return;
    if (window.epiCharts[id]) window.epiCharts[id].dispose();
    const chart = echarts.init(el);
    chart.setOption(option);
    window.epiCharts[id] = chart;
}

function resizeEpiCharts() {
    Object.values(window.epiCharts).forEach(chart => {
        if(chart && typeof chart.resize === 'function') chart.resize();
    });
}

function renderizarTabelasEPI(reqs, movs) {
    const formatData = (d) => {
        const dataObj = new Date(d);
        return dataObj.toLocaleDateString('pt-BR', {timeZone: 'UTC'}) + ' ' + dataObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    };
    const formatVal = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    let registros = [];
    
    reqs.forEach(r => {
        registros.push({
            data: r.created_at, 
            colab: (r.colaborador_nome||'').trim().toUpperCase(), 
            peca: getNomePecaEPI(r.peca_id),
            qtd: parseFloat(r.quantidade), 
            val: parseFloat(r.quantidade)*parseFloat(r.valor_unitario||0),
            status: r.status, 
            resp: r.usuario_solicitante
        });
    });

    movs.forEach(m => {
        registros.push({
            data: m.data_movimentacao, 
            colab: (m.setor_destino||'').replace(/colaborador:\s*/i, '').trim().toUpperCase(), 
            peca: getNomePecaEPI(m.peca_id),
            qtd: parseFloat(m.quantidade), 
            val: parseFloat(m.quantidade)*parseFloat(m.valor_unitario||0),
            status: 'Entregue', 
            resp: m.usuario
        });
    });

    // Ordenar do mais recente para o mais antigo e guardar para exportação Excel
    registros.sort((a,b) => new Date(b.data) - new Date(a.data));
    window.epiRegistrosFiltrados = registros;

    // 1. Tabela Resumida (Dashboard) - Últimos 5
    const tbodyRecentes = document.getElementById('tbodyRecentesEPI');
    if(tbodyRecentes) {
        let htmlRecentes = '';
        const top5 = registros.slice(0, 5);
        top5.forEach(r => {
            let badgeClass = r.status.toLowerCase().includes('entregue') ? 'entregue' : 'pendente';
            let dataCurta = new Date(r.data).toLocaleDateString('pt-BR', {timeZone: 'UTC'});
            htmlRecentes += `<tr>
                <td style="color:#94a3b8;">${dataCurta}</td>
                <td style="font-weight:600; color:#e2e8f0;">${r.colab}</td>
                <td style="color:#cbd5e1;">${r.peca}</td>
                <td style="font-weight:bold; color:#10b981;">${formatVal(r.val)}</td>
                <td><span class="badge ${badgeClass}">${r.status}</span></td>
            </tr>`;
        });
        if(top5.length === 0) htmlRecentes = '<tr><td colspan="5" style="text-align:center; padding: 20px;">Nenhum registro encontrado.</td></tr>';
        tbodyRecentes.innerHTML = htmlRecentes;
    }

    // 2. Tabela Modal Histórico
    const tbodyHistorico = document.getElementById('tbodyHistoricoCompletoEPI');
    if(tbodyHistorico) {
        let htmlHist = '';
        registros.forEach(r => {
            let badgeClass = r.status.toLowerCase().includes('entregue') ? 'entregue' : 'pendente';
            htmlHist += `<tr>
                <td style="color:#94a3b8; font-size:0.85rem;">${formatData(r.data)}</td>
                <td style="font-weight:700; color:#38bdf8;">${r.colab}</td>
                <td style="color:#f8fafc;">${r.peca}</td>
                <td style="text-align:center; font-weight:bold; color:#e2e8f0;">${r.qtd}</td>
                <td style="font-weight:bold; color:#10b981;">${formatVal(r.val)}</td>
                <td><span class="badge ${badgeClass}">${r.status}</span></td>
                <td style="color:#94a3b8;">${r.resp || 'Sistema'}</td>
            </tr>`;
        });
        if(registros.length === 0) htmlHist = '<tr><td colspan="7" style="text-align:center; padding: 20px;">Nenhum histórico encontrado para os filtros aplicados.</td></tr>';
        tbodyHistorico.innerHTML = htmlHist;
    }
}

// Controle do Modal
window.abrirHistoricoEPI = function() {
    const modal = document.getElementById('modalHistoricoEPI');
    if(modal) modal.style.display = 'flex';
}
window.fecharHistoricoEPI = function() {
    const modal = document.getElementById('modalHistoricoEPI');
    if(modal) modal.style.display = 'none';
}

// Exportação Excel - Histórico Completo
window.exportarExcelEPI = function() {
    if (!window.epiRegistrosFiltrados || window.epiRegistrosFiltrados.length === 0) {
        Swal.fire({ icon: 'info', title: 'Atenção', text: 'Não há dados para exportar com os filtros atuais.', background: '#1e293b', color: '#fff' });
        return;
    }

    const dataExcel = window.epiRegistrosFiltrados.map(r => {
        return {
            "Data e Hora": new Date(r.data).toLocaleString('pt-BR', {timeZone: 'UTC'}),
            "Colaborador": r.colab,
            "Equipamento (EPI)": r.peca,
            "Quantidade": r.qtd,
            "Custo Total (R$)": r.val.toFixed(2).replace('.', ','),
            "Status": r.status,
            "Registrado por": r.resp
        };
    });

    try {
        const ws = XLSX.utils.json_to_sheet(dataExcel);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Controle de EPIs");
        XLSX.writeFile(wb, "Relatorio_Controle_EPIs.xlsx");
        
        Swal.fire({
            icon: 'success',
            title: 'Exportação Concluída',
            text: 'O arquivo Excel foi baixado com sucesso.',
            background: '#1e293b',
            color: '#fff',
            timer: 2000,
            showConfirmButton: false
        });
    } catch (error) {
        console.error("Erro ao gerar Excel:", error);
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Falha ao exportar para Excel.', background: '#1e293b', color: '#fff' });
    }
}