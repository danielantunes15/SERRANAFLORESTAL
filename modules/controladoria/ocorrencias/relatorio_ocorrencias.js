// =========================================================================
// Módulo: Controladoria -> Relatório de Ocorrências (Dashboard Moderno)
// Ficheiro: modules/controladoria/ocorrencias/relatorio_ocorrencias.js
// =========================================================================

window.dadosOcorrenciasRelatorio = [];
window.dadosFiltradosRelatorio = [];

// Variáveis de Paginação
window.paginaAtualRel = 1;
window.itensPorPaginaRel = 10;

window.initRelatorioOcorrencias = async function() {
    await window.carregarDadosRelatorio();
};

window.carregarDadosRelatorio = async function() {
    const tbody = document.getElementById('tbodyRelatorioOcorrencias');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 30px;"><i class="fas fa-spinner fa-spin"></i> Sincronizando dados com o servidor...</td></tr>';
    
    try {
        let query = supabaseClient.from('ocorrencias')
                                  .select('*, ocorrencia_outros_envolvidos(*)')
                                  .order('data_ocorrido', { ascending: false });
        
        if (typeof window.aplicarFiltroFilial === 'function') {
            query = window.aplicarFiltroFilial(query);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        window.dadosOcorrenciasRelatorio = data || [];
        window.filtrarEAtualizarDashboard(); 
    } catch (error) {
        console.error("Erro ao carregar relatório:", error);
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#ef4444;">Erro ao carregar dados. Verifique sua conexão.</td></tr>';
    }
};

window.limparFiltrosRelatorio = function() {
    document.getElementById('filtroMesRel').value = '';
    const anoAtual = new Date().getFullYear().toString();
    const selectAno = document.getElementById('filtroAnoRel');
    if(selectAno) selectAno.value = anoAtual;
    
    document.getElementById('filtroDataEspecificaRel').value = '';
    document.getElementById('filtroStatusRel').value = 'Todos';
    document.getElementById('filtroBuscaRel').value = '';
    
    window.filtrarEAtualizarDashboard();
};

window.filtrarEAtualizarDashboard = function() {
    const mesFiltro = document.getElementById('filtroMesRel').value; 
    const anoFiltro = document.getElementById('filtroAnoRel').value;
    const dataEspecifica = document.getElementById('filtroDataEspecificaRel').value;
    const statusFiltro = document.getElementById('filtroStatusRel').value;
    const busca = document.getElementById('filtroBuscaRel').value.toLowerCase();

    window.dadosFiltradosRelatorio = window.dadosOcorrenciasRelatorio.filter(o => {
        
        // Filtro de Data (Prioriza data específica se preenchida)
        if (dataEspecifica) {
            if (o.data_ocorrido !== dataEspecifica) return false;
        } else {
            // Filtro normal por Mês/Ano
            if (o.data_ocorrido) {
                const partes = o.data_ocorrido.split('-'); 
                if (anoFiltro && partes[0] !== anoFiltro) return false;
                if (mesFiltro && partes[1] !== mesFiltro) return false;
            } else if (anoFiltro || mesFiltro) {
                return false; 
            }
        }

        // Filtro de Status
        if (statusFiltro !== 'Todos') {
            const st = o.status || 'Aberta';
            if (st !== statusFiltro) return false;
        }
        
        // Filtro de Busca Específica
        if (busca) {
            const idStr = String(o.id).padStart(4, '0');
            const placa = (o.placa || '').toLowerCase();
            const envolvido = (o.nome_envolvido || '').toLowerCase();
            const causador = window.determinarCausador(o).nome.toLowerCase();
            
            if (!idStr.includes(busca) && !placa.includes(busca) && !envolvido.includes(busca) && !causador.includes(busca)) return false;
        }

        return true;
    });
    
    // Sempre que filtrar, volta para a página 1
    window.paginaAtualRel = 1;
    
    window.atualizarKPIsRelatorio();
    window.renderizarTabelaRelatorio();
    window.renderizarGraficosRelatorio();
};

window.determinarCausador = function(oco) {
    let causadorReal = oco.nome_envolvido || 'Não Identificado';
    let setorReal = oco.setor || '-';
    let isExterno = false;

    if (oco.is_responsavel === true) {
        return { nome: causadorReal, setor: setorReal, isExterno: false };
    }

    if (oco.ocorrencia_outros_envolvidos && Array.isArray(oco.ocorrencia_outros_envolvidos)) {
        const causadorOutro = oco.ocorrencia_outros_envolvidos.find(e => e.is_responsavel === true);
        if (causadorOutro) {
            setorReal = causadorOutro.setor || '-';
            if (causadorOutro.tipo_envolvido === 'TERCEIRO') {
                isExterno = true;
                causadorReal = causadorOutro.nome || 'Outros (Terceiros)';
                setorReal = 'Outras empresas';
            } else {
                causadorReal = causadorOutro.nome;
            }
            return { nome: causadorReal, setor: setorReal, isExterno: isExterno };
        }
    }

    return { nome: causadorReal, setor: setorReal, isExterno: isExterno };
};

window.atualizarKPIsRelatorio = function() {
    const dados = window.dadosFiltradosRelatorio;
    
    const total = dados.length;
    let avarias = 0;
    let comPrejuizo = 0; 
    let prejuizoTotal = 0;

    dados.forEach(o => {
        const t = (o.tipo_ocorrencia || '').toLowerCase();
        if (t.includes('avaria') || t.includes('colisão') || t.includes('tombamento') || t.includes('acidente')) avarias++;
        
        const valor = parseFloat(o.valor_prejuizo);
        if (!isNaN(valor) && valor > 0) {
            prejuizoTotal += valor;
            comPrejuizo++;
        }
    });

    document.getElementById('kpiTotalOcorrencias').innerText = total;
    
    document.getElementById('kpiTotalAvarias').innerText = avarias;
    const taxaAvarias = total > 0 ? ((avarias / total) * 100).toFixed(1) : 0;
    document.getElementById('kpiTaxaAvarias').innerText = `${taxaAvarias}% do total`;

    document.getElementById('kpiComPrejuizo').innerText = comPrejuizo;
    const mediaPrejuizo = comPrejuizo > 0 ? (prejuizoTotal / comPrejuizo) : 0;
    document.getElementById('kpiMediaPrejuizo').innerText = `Média: ${mediaPrejuizo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/ocorrência`;

    document.getElementById('kpiPrejuizoTotal').innerText = prejuizoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Mudar a página na tabela
window.mudarPaginaRel = function(novaPagina) {
    window.paginaAtualRel = novaPagina;
    window.renderizarTabelaRelatorio();
};

window.renderizarPaginacaoRelatorio = function() {
    const totalItens = window.dadosFiltradosRelatorio.length;
    const totalPaginas = Math.ceil(totalItens / window.itensPorPaginaRel);
    const container = document.getElementById('paginacaoRelatorioOcorrencias');
    
    if (!container) return;
    
    if (totalPaginas <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '<div class="rel-pagination">';
    
    // Botão Anterior
    html += `<button class="rel-page-btn" ${window.paginaAtualRel === 1 ? 'disabled' : ''} onclick="window.mudarPaginaRel(${window.paginaAtualRel - 1})"><i class="fas fa-chevron-left"></i></button>`;
    
    // Calcula as páginas para mostrar
    let startPage = Math.max(1, window.paginaAtualRel - 2);
    let endPage = Math.min(totalPaginas, startPage + 4);
    
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    for (let i = startPage; i <= endPage; i++) {
        const active = i === window.paginaAtualRel ? 'active' : '';
        html += `<button class="rel-page-btn ${active}" onclick="window.mudarPaginaRel(${i})">${i}</button>`;
    }
    
    // Botão Próximo
    html += `<button class="rel-page-btn" ${window.paginaAtualRel === totalPaginas ? 'disabled' : ''} onclick="window.mudarPaginaRel(${window.paginaAtualRel + 1})"><i class="fas fa-chevron-right"></i></button>`;
    
    html += '</div>';
    container.innerHTML = html;
};

window.renderizarTabelaRelatorio = function() {
    const tbody = document.getElementById('tbodyRelatorioOcorrencias');
    const labelTotal = document.getElementById('labelTotalRegistrosTabela');
    if (!tbody) return;

    if (window.dadosFiltradosRelatorio.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 30px; color:#94a3b8;">Nenhum registo encontrado para os filtros selecionados.</td></tr>';
        if (labelTotal) labelTotal.innerText = '0 registos';
        document.getElementById('paginacaoRelatorioOcorrencias').innerHTML = '';
        return;
    }

    if (labelTotal) labelTotal.innerText = `${window.dadosFiltradosRelatorio.length} registos encontrados`;

    // Aplica a Paginação no array
    const inicio = (window.paginaAtualRel - 1) * window.itensPorPaginaRel;
    const fim = inicio + window.itensPorPaginaRel;
    const itensPagina = window.dadosFiltradosRelatorio.slice(inicio, fim);

    let html = '';
    itensPagina.forEach(o => {
        let dataFmt = '-';
        if (o.data_ocorrido) {
            const [ano, mes, dia] = o.data_ocorrido.split('-');
            dataFmt = `${dia}/${mes}/${ano}`;
        }
        
        const causador = window.determinarCausador(o);
        const valorNum = parseFloat(o.valor_prejuizo) || 0;
        const valorFmt = valorNum > 0 ? `<span style="color:#ef4444; font-weight:700;">${valorNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>` : '<span style="color:#64748b;">-</span>';
        
        const st = o.status || 'Aberta';
        let badgeStatus = '';
        if(st === 'Aberta') badgeStatus = `<span class="rel-badge rel-badge-danger">${st}</span>`;
        else if(st === 'Em Análise') badgeStatus = `<span class="rel-badge rel-badge-warning">${st}</span>`;
        else badgeStatus = `<span class="rel-badge rel-badge-success">${st}</span>`;

        let badgeOrigem = causador.isExterno 
            ? `<span class="rel-badge rel-badge-purple" style="font-size:0.65rem; margin-left:5px;">Terceiro</span>`
            : `<span class="rel-badge rel-badge-info" style="font-size:0.65rem; margin-left:5px;">Interno</span>`;

        html += `
            <tr>
                <td style="font-weight:bold; color:#f8fafc;">#${String(o.id).padStart(4,'0')}</td>
                <td style="color:#94a3b8;">${dataFmt}</td>
                <td>
                    <div style="font-weight:600; color:#e2e8f0; margin-bottom:4px;">${o.tipo_ocorrencia || 'Outros'}</div>
                    ${badgeStatus}
                </td>
                <td>
                    <div style="font-weight:700; color:#60a5fa;">${o.placa || '-'}</div>
                    <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">${o.numero_frota || ''}</div>
                </td>
                <td>
                    <div style="display:flex; align-items:center;">
                        <span style="font-weight:600; color: #f8fafc;">${causador.nome}</span>
                        ${badgeOrigem}
                    </div>
                </td>
                <td><span style="color:#cbd5e1;">${causador.setor}</span></td>
                <td style="text-align: right;">${valorFmt}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    window.renderizarPaginacaoRelatorio();
};

window.renderizarGraficosRelatorio = function() {
    if (typeof echarts === 'undefined') return;
    
    const dados = window.dadosFiltradosRelatorio;
    
    const causadoresMap = {};
    let internosCount = 0;
    let externosCount = 0;

    dados.forEach(o => {
        const c = window.determinarCausador(o);
        const valor = parseFloat(o.valor_prejuizo) || 0;
        
        if (!causadoresMap[c.nome]) {
            causadoresMap[c.nome] = { qtd: 0, valor: 0, isExterno: c.isExterno };
        }
        causadoresMap[c.nome].qtd += 1;
        causadoresMap[c.nome].valor += valor;
        
        if (c.isExterno || c.nome.includes('Outros')) externosCount++;
        else internosCount++;
    });

    const causadoresSorted = Object.keys(causadoresMap)
        .map(k => ({ name: k, ...causadoresMap[k] }))
        .sort((a,b) => {
            if (b.valor !== a.valor) return b.valor - a.valor;
            return b.qtd - a.qtd;
        })
        .slice(0, 10); 

    const nomesCausadores = causadoresSorted.map(c => c.name);
    const qtdCausadores = causadoresSorted.map(c => c.qtd);
    const valorCausadores = causadoresSorted.map(c => c.valor);

    const chartCausadores = echarts.init(document.getElementById('chartCausadores'));
    chartCausadores.setOption({
        tooltip: { 
            trigger: 'axis',
            axisPointer: { type: 'cross' },
            formatter: function(params) {
                let name = params[0].name;
                let qtd = params[0].value;
                let val = params[1] ? params[1].value : 0;
                return `<b>${name}</b><br/>Ocorrências: ${qtd}<br/>Prejuízo: ${val.toLocaleString('pt-BR', {style: 'currency', currency:'BRL'})}`;
            }
        },
        legend: { data: ['Qtd Ocorrências', 'Prejuízo (R$)'], textStyle: { color: '#94a3b8' }, bottom: 0 },
        grid: { left: '3%', right: '3%', bottom: '15%', containLabel: true },
        xAxis: [
            { type: 'category', data: nomesCausadores, axisLabel: { color: '#cbd5e1', interval: 0, rotate: 15, width: 90, overflow: 'truncate' } }
        ],
        yAxis: [
            { type: 'value', name: 'Qtd', minInterval: 1, splitLine: { show: false }, axisLabel: { color: '#94a3b8' } },
            { type: 'value', name: 'R$', splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)', type: 'dashed' } }, axisLabel: { color: '#ef4444', formatter: 'R$ {value}' } }
        ],
        series: [
            { 
                name: 'Qtd Ocorrências', 
                type: 'bar', 
                data: qtdCausadores,
                itemStyle: { 
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#3b82f6' },
                        { offset: 1, color: '#1e3a8a' }
                    ]),
                    borderRadius: [4, 4, 0, 0] 
                },
                label: { // Valor da quantidade acima da barra
                    show: true, 
                    position: 'top', 
                    color: '#f8fafc', 
                    fontWeight: 'bold',
                    fontSize: 12
                }
            },
            {
                name: 'Prejuízo (R$)',
                type: 'line',
                yAxisIndex: 1,
                data: valorCausadores,
                smooth: true,
                symbolSize: 8,
                itemStyle: { color: '#ef4444' },
                lineStyle: { width: 3, shadowColor: 'rgba(239, 68, 68, 0.5)', shadowBlur: 10 }
            }
        ]
    });

    const chartOrigem = echarts.init(document.getElementById('chartOrigem'));
    chartOrigem.setOption({
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { bottom: '5%', left: 'center', textStyle: { color: '#94a3b8' } },
        series: [{ 
            type: 'pie', 
            radius: ['40%', '70%'], 
            center: ['50%', '45%'],
            avoidLabelOverlap: false,
            itemStyle: { borderRadius: 10, borderColor: '#0f172a', borderWidth: 2 },
            label: { show: false, position: 'center' },
            emphasis: { label: { show: true, fontSize: '16', fontWeight: 'bold', color: '#fff' } },
            labelLine: { show: false },
            data: [
                { name: 'Colaborador Interno', value: internosCount, itemStyle: { color: '#3b82f6' } },
                { name: 'Empresa Terceira', value: externosCount, itemStyle: { color: '#a855f7' } }
            ]
        }]
    });

    const mesesMap = {};
    dados.forEach(o => {
        if (!o.data_ocorrido) return;
        const mesKey = o.data_ocorrido.substring(0, 7);
        if (!mesesMap[mesKey]) mesesMap[mesKey] = { qtd: 0, valor: 0 };
        mesesMap[mesKey].qtd += 1;
        mesesMap[mesKey].valor += (parseFloat(o.valor_prejuizo) || 0);
    });
    const mesesLabels = Object.keys(mesesMap).sort();
    const mesesQtd = mesesLabels.map(k => mesesMap[k].qtd);
    const mesesValor = mesesLabels.map(k => mesesMap[k].valor);
    
    const chartMeses = echarts.init(document.getElementById('chartMeses'));
    chartMeses.setOption({
        tooltip: { 
            trigger: 'axis',
            formatter: function(params) {
                let name = params[0].name;
                let qtd = params[0] ? params[0].value : 0;
                let val = params[1] ? params[1].value : 0;
                return `<b>${name}</b><br/>Qtd: ${qtd}<br/>Custo: ${val.toLocaleString('pt-BR', {style: 'currency', currency:'BRL'})}`;
            }
        },
        grid: { top: '15%', bottom: '15%', left: '10%', right: '10%' },
        xAxis: { type: 'category', data: mesesLabels.map(m => m.split('-').reverse().join('/')), axisLabel: { color: '#94a3b8' } },
        yAxis: [
            { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }, axisLabel: { color: '#94a3b8' } },
            { type: 'value', splitLine: { show: false }, axisLabel: { show: false } }
        ],
        series: [
            { 
                name: 'Volume',
                data: mesesQtd, 
                type: 'bar', 
                barMaxWidth: 40,
                itemStyle: { 
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#10b981' },
                        { offset: 1, color: '#047857' }
                    ]), 
                    borderRadius: [4,4,0,0] 
                },
                label: { show: true, position: 'top', color: '#f8fafc', fontWeight: 'bold' }
            },
            {
                name: 'Custo',
                type: 'line',
                yAxisIndex: 1,
                data: mesesValor,
                smooth: true,
                symbol: 'none',
                lineStyle: { width: 0 },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(239, 68, 68, 0.4)' },
                        { offset: 1, color: 'rgba(239, 68, 68, 0.0)' }
                    ])
                }
            }
        ]
    });

    const tiposCount = {};
    dados.forEach(o => {
        const t = o.tipo_ocorrencia || 'Não Informado';
        tiposCount[t] = (tiposCount[t] || 0) + 1;
    });
    const pieTipos = Object.keys(tiposCount).map(k => ({ name: k, value: tiposCount[k] }));

    const chartTipos = echarts.init(document.getElementById('chartTipos'));
    chartTipos.setOption({
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        series: [{ 
            type: 'pie', 
            radius: '60%', 
            center: ['50%', '50%'],
            itemStyle: { borderRadius: 5, borderColor: '#0f172a', borderWidth: 2 }, 
            label: { color: '#cbd5e1', formatter: '{b}\n{c}' },
            data: pieTipos.sort((a,b) => b.value - a.value)
        }]
    });

    window.addEventListener('resize', () => {
        chartMeses.resize(); chartTipos.resize(); chartCausadores.resize(); chartOrigem.resize();
    });
};