// =========================================================================
// Módulo: Controladoria -> Relatório de Ocorrências (Dashboard)
// Ficheiro: modules/controladoria/ocorrencias/relatorio_ocorrencias.js
// =========================================================================

window.dadosOcorrenciasRelatorio = [];
window.dadosFiltradosRelatorio = [];

window.initRelatorioOcorrencias = async function() {
    await window.carregarDadosRelatorio();
};

window.carregarDadosRelatorio = async function() {
    const tbody = document.getElementById('tbodyRelatorioOcorrencias');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Carregando dados do servidor...</td></tr>';
    
    try {
        // Agora busca a tabela principal junto com os terceiros cadastrados
        let query = supabaseClient.from('ocorrencias')
                                  .select('*, ocorrencia_outros_envolvidos(*)')
                                  .order('data_ocorrido', { ascending: false });
        
        if (typeof window.aplicarFiltroFilial === 'function') {
            query = window.aplicarFiltroFilial(query);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        window.dadosOcorrenciasRelatorio = data || [];
        
        // Mantém os selects como estão e força o primeiro filtro
        window.filtrarEAtualizarDashboard(); 
    } catch (error) {
        console.error("Erro ao carregar relatório:", error);
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#ef4444;">Erro ao carregar dados.</td></tr>';
    }
};

window.limparFiltrosRelatorio = function() {
    document.getElementById('filtroMesRel').value = '';
    
    // Deixa o ano atual
    const anoAtual = new Date().getFullYear().toString();
    const selectAno = document.getElementById('filtroAnoRel');
    if(selectAno) selectAno.value = anoAtual;
    
    document.getElementById('filtroStatusRel').value = 'Todos';
    document.getElementById('filtroBuscaRel').value = '';
    
    window.filtrarEAtualizarDashboard();
};

window.filtrarEAtualizarDashboard = function() {
    const mesFiltro = document.getElementById('filtroMesRel').value; 
    const anoFiltro = document.getElementById('filtroAnoRel').value;
    const statusFiltro = document.getElementById('filtroStatusRel').value;
    const busca = document.getElementById('filtroBuscaRel').value.toLowerCase();

    window.dadosFiltradosRelatorio = window.dadosOcorrenciasRelatorio.filter(o => {
        
        // Filtro Data (YYYY-MM-DD)
        if (o.data_ocorrido) {
            const partes = o.data_ocorrido.split('-'); // [0] = YYYY, [1] = MM, [2] = DD
            if (anoFiltro && partes[0] !== anoFiltro) return false;
            if (mesFiltro && partes[1] !== mesFiltro) return false;
        } else if (anoFiltro || mesFiltro) {
            return false; // Se tiver filtro e a ocorrencia nao tiver data, esconde
        }

        // Filtro Status
        if (statusFiltro !== 'Todos') {
            const st = o.status || 'Aberta';
            if (st !== statusFiltro) return false;
        }
        
        // Filtro Busca
        if (busca) {
            const idStr = String(o.id).padStart(4, '0');
            const placa = (o.placa || '').toLowerCase();
            const envolvido = (o.nome_envolvido || '').toLowerCase();
            if (!idStr.includes(busca) && !placa.includes(busca) && !envolvido.includes(busca)) return false;
        }

        return true;
    });
    
    window.atualizarKPIsRelatorio();
    window.renderizarTabelaRelatorio();
    window.renderizarGraficosRelatorio();
};

// =========================================================
// LÓGICA DE DETECÇÃO DO CAUSADOR (Principal ou Terceiros)
// =========================================================
window.determinarCausador = function(oco) {
    let causadorReal = oco.nome_envolvido || 'Não Identificado';
    let setorReal = oco.setor || '-';
    let isExterno = false;

    // 1. O envolvido principal na página de registro foi marcado como causador?
    if (oco.is_responsavel === true) {
        return { nome: causadorReal, setor: setorReal, isExterno: false };
    }

    // 2. Se não, verifica a lista da tabela de 'outros_envolvidos'
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
        }
    }

    // Se ninguém foi marcado como causador, assume que o envolvido principal (o relator) é o dono do evento.
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
        if (t.includes('avaria') || t.includes('colisão') || t.includes('tombamento')) avarias++;
        
        const valor = parseFloat(o.valor_prejuizo);
        if (!isNaN(valor) && valor > 0) {
            prejuizoTotal += valor;
            comPrejuizo++;
        }
    });

    document.getElementById('kpiTotalOcorrencias').innerText = total;
    document.getElementById('kpiTotalAvarias').innerText = avarias;
    document.getElementById('kpiComPrejuizo').innerText = comPrejuizo;
    document.getElementById('kpiPrejuizoTotal').innerText = prejuizoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

window.renderizarTabelaRelatorio = function() {
    const tbody = document.getElementById('tbodyRelatorioOcorrencias');
    if (!tbody) return;

    if (window.dadosFiltradosRelatorio.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px; color:#94a3b8;">Nenhum registo encontrado para os filtros selecionados.</td></tr>';
        return;
    }

    let html = '';
    window.dadosFiltradosRelatorio.forEach(o => {
        let dataFmt = '-';
        if (o.data_ocorrido) {
            const [ano, mes, dia] = o.data_ocorrido.split('-');
            dataFmt = `${dia}/${mes}/${ano}`;
        }
        
        const causador = window.determinarCausador(o);
        const valorFmt = parseFloat(o.valor_prejuizo) ? parseFloat(o.valor_prejuizo).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-';
        const st = o.status || 'Aberta';
        
        let stColor = '#94a3b8';
        if(st === 'Aberta') stColor = '#ef4444';
        else if(st === 'Em Análise') stColor = '#f59e0b';
        else if(st === 'Concluída') stColor = '#10b981';

        html += `
            <tr>
                <td style="font-weight:bold; color:var(--ccol-blue-bright);">#${String(o.id).padStart(4,'0')}</td>
                <td>${dataFmt}</td>
                <td>${o.tipo_ocorrencia || 'Outros'}</td>
                <td>${o.placa || '-'} <br><span style="font-size:0.7rem; color:#94a3b8;">${o.numero_frota || ''}</span></td>
                <td style="font-weight:bold; color: ${causador.isExterno ? '#a855f7' : '#e2e8f0'};">${causador.nome}</td>
                <td><span style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-dim); padding: 4px 8px; border-radius: 4px;">${causador.setor}</span></td>
                <td style="color:#ef4444;">${valorFmt}</td>
                <td><span style="background: rgba(255,255,255,0.05); padding: 3px 8px; border-radius: 4px; color:${stColor}; font-size:0.8rem; font-weight:bold; border: 1px solid ${stColor};">${st}</span></td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
};

window.renderizarGraficosRelatorio = function() {
    if (typeof echarts === 'undefined') return;
    
    const dados = window.dadosFiltradosRelatorio;
    
    // --- Gráfico de Meses ---
    const mesesCount = {};
    dados.forEach(o => {
        if (!o.data_ocorrido) return;
        const mesKey = o.data_ocorrido.substring(0, 7); // YYYY-MM
        mesesCount[mesKey] = (mesesCount[mesKey] || 0) + 1;
    });
    const mesesLabels = Object.keys(mesesCount).sort();
    const mesesData = mesesLabels.map(k => mesesCount[k]);
    
    const chartMeses = echarts.init(document.getElementById('chartMeses'));
    chartMeses.setOption({
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: mesesLabels.map(m => m.split('-').reverse().join('/')), axisLabel: { color: '#94a3b8' } },
        yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }, axisLabel: { color: '#94a3b8' } },
        series: [{ data: mesesData, type: 'bar', itemStyle: { color: '#3b82f6', borderRadius: [4,4,0,0] } }]
    });

    // --- Gráfico de Tipos ---
    const tiposCount = {};
    dados.forEach(o => {
        const t = o.tipo_ocorrencia || 'Não Informado';
        tiposCount[t] = (tiposCount[t] || 0) + 1;
    });
    const pieTipos = Object.keys(tiposCount).map(k => ({ name: k, value: tiposCount[k] }));

    const chartTipos = echarts.init(document.getElementById('chartTipos'));
    chartTipos.setOption({
        tooltip: { trigger: 'item' },
        series: [{ type: 'pie', radius: ['40%', '70%'], itemStyle: { borderRadius: 5, borderColor: '#1f2937', borderWidth: 2 }, label: { color: '#fff' }, data: pieTipos }]
    });

    // --- Gráfico Top 10 Causadores ---
    const causadoresCount = {};
    let internosCount = 0;
    let externosCount = 0;

    dados.forEach(o => {
        const c = window.determinarCausador(o);
        causadoresCount[c.nome] = (causadoresCount[c.nome] || 0) + 1;
        
        if (c.isExterno || c.nome.includes('Outros')) externosCount++;
        else internosCount++;
    });

    const causadoresSorted = Object.keys(causadoresCount).map(k => ({ name: k, value: causadoresCount[k] })).sort((a,b) => b.value - a.value).slice(0, 10);

    const chartCausadores = echarts.init(document.getElementById('chartCausadores'));
    chartCausadores.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'value', splitLine: { show: false }, axisLabel: { color: '#94a3b8' } },
        yAxis: { type: 'category', data: causadoresSorted.map(c => c.name).reverse(), axisLabel: { color: '#f8fafc', width: 120, overflow: 'truncate' } },
        series: [{ type: 'bar', data: causadoresSorted.map(c => {
            return { value: c.value, itemStyle: { color: c.name.includes('Outros') ? '#a855f7' : '#10b981' } };
        }).reverse() }]
    });

    // --- Gráfico Origem (Interno vs Externo) ---
    const chartOrigem = echarts.init(document.getElementById('chartOrigem'));
    chartOrigem.setOption({
        tooltip: { trigger: 'item' },
        series: [{ type: 'pie', radius: '80%', label: { show: false }, data: [
            { name: 'Internos (Nossos Colab.)', value: internosCount, itemStyle: { color: '#10b981' } },
            { name: 'Terceiros / Outros', value: externosCount, itemStyle: { color: '#a855f7' } }
        ]}]
    });

    // --- Gráfico Status ---
    const statusCount = {};
    dados.forEach(o => {
        const s = o.status || 'Aberta';
        statusCount[s] = (statusCount[s] || 0) + 1;
    });
    const pieStatus = Object.keys(statusCount).map(k => ({ name: k, value: statusCount[k], itemStyle: { color: k === 'Aberta' ? '#ef4444' : (k === 'Em Análise' ? '#f59e0b' : '#10b981') } }));

    const chartStatus = echarts.init(document.getElementById('chartStatus'));
    chartStatus.setOption({
        tooltip: { trigger: 'item' },
        series: [{ type: 'pie', radius: '80%', label: { show: false }, data: pieStatus }]
    });

    window.addEventListener('resize', () => {
        chartMeses.resize(); chartTipos.resize(); chartCausadores.resize(); chartOrigem.resize(); chartStatus.resize();
    });
};