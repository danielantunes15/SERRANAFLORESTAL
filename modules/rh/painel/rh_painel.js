window.listaParaPainelRH = [];
window.listaAtestadosPainel = [];
window.chartCid = null;
window.chartEvolucaoAtestados = null;

window.initRHPainel = async function() {
    try {
        const tbody = document.getElementById('tbPainelRH');
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Carregando dashboard e dados do RH...</td></tr>`;
        
        // Busca os colaboradores e os atestados simultaneamente para alta performance
        const [dadosColab, dadosAtestados] = await Promise.all([
            db.getColaboradores(),
            db.getAtestados()
        ]);
        
        // Filtra garantindo que ignora maiúsculas/minúsculas no status
        window.listaParaPainelRH = dadosColab.filter(c => {
            const status = c.status ? c.status.toLowerCase() : '';
            return status !== 'inativo' && status !== 'desligado';
        });

        window.listaAtestadosPainel = dadosAtestados || [];
        
        window.atualizarKPIsPainelRH();
        window.renderizarGraficosRH();
        window.renderizarTabelaPainelRH(window.listaParaPainelRH);

        // Garante que os gráficos se ajustem se o usuário redimensionar a janela
        window.addEventListener('resize', function() {
            if (window.chartCid) window.chartCid.resize();
            if (window.chartEvolucaoAtestados) window.chartEvolucaoAtestados.resize();
        });

    } catch(e) {
        console.error("Erro ao carregar Painel RH:", e);
        const tbody = document.getElementById('tbPainelRH');
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="color: #ef4444; text-align: center;">Erro ao carregar os dados.</td></tr>`;
    }
};

window.atualizarKPIsPainelRH = function() {
    const total = window.listaParaPainelRH.length;
    const plano = window.listaParaPainelRH.filter(c => c.plano_saude && c.plano_saude.toLowerCase() === 'sim').length;
    const sindicato = window.listaParaPainelRH.filter(c => c.ativo_sindicato && c.ativo_sindicato.toLowerCase() === 'sim').length;
    
    let asoAlertas = 0;
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    
    window.listaParaPainelRH.forEach(c => {
        if(c.aso_vencimento) {
            const venc = new Date(c.aso_vencimento + 'T00:00:00');
            const dif = (venc.getTime() - hoje.getTime()) / (1000 * 3600 * 24);
            if(dif <= 30) asoAlertas++;
        } else {
            asoAlertas++; 
        }
    });

    // Calcular atestados dos últimos 30 dias
    let atestados30Dias = 0;
    const data30DiasAtras = new Date();
    data30DiasAtras.setDate(hoje.getDate() - 30);
    
    window.listaAtestadosPainel.forEach(a => {
        if (a.data_inicio) {
            const [ano, mes, dia] = a.data_inicio.split('-');
            const dataAt = new Date(ano, mes - 1, dia);
            if (dataAt >= data30DiasAtras && dataAt <= hoje) {
                atestados30Dias++;
            }
        }
    });

    document.getElementById('kpiTotalAtivos').innerText = total;
    document.getElementById('kpiPlanoSaude').innerText = plano;
    document.getElementById('kpiSindicato').innerText = sindicato;
    document.getElementById('kpiAsoVencido').innerText = asoAlertas;
    document.getElementById('kpiAtestados').innerText = atestados30Dias;
};

window.renderizarGraficosRH = function() {
    if (typeof echarts === 'undefined') return;

    // ==========================================
    // GRÁFICO 1: TOP 5 MOTIVOS / CID (PIE CHART)
    // ==========================================
    const freqCid = {};
    window.listaAtestadosPainel.forEach(a => {
        let chave = a.cid ? a.cid.trim().toUpperCase() : (a.motivo ? a.motivo.trim() : 'Não Informado');
        if (chave === '') chave = 'Não Informado';
        freqCid[chave] = (freqCid[chave] || 0) + 1;
    });
    
    const cidArray = Object.keys(freqCid).map(k => ({ name: k, value: freqCid[k] }));
    cidArray.sort((a,b) => b.value - a.value);
    
    const top5Cid = cidArray.slice(0, 5);
    const hasCidData = top5Cid.length > 0;

    const domCid = document.getElementById('graficoCid');
    if (window.chartCid) window.chartCid.dispose();
    window.chartCid = echarts.init(domCid);

    const optionCid = {
        tooltip: { trigger: 'item', formatter: '{b}: {c} ocorrência(s) ({d}%)' },
        legend: { top: 'bottom', textStyle: { color: '#9ca3af' } },
        color: ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444'],
        series: [{
            type: 'pie',
            radius: ['40%', '70%'],
            avoidLabelOverlap: false,
            itemStyle: { borderRadius: 8, borderColor: '#1f2937', borderWidth: 3 },
            label: { show: false, position: 'center' },
            emphasis: {
                label: { show: true, fontSize: 16, fontWeight: 'bold', color: '#fff' }
            },
            labelLine: { show: false },
            data: hasCidData ? top5Cid : [{ name: 'Sem dados', value: 0 }]
        }]
    };
    window.chartCid.setOption(optionCid);

    // ==========================================
    // GRÁFICO 2: EVOLUÇÃO 6 MESES (BAR CHART)
    // ==========================================
    const hoje = new Date();
    const mesesLabels = [];
    const chavesAnoMes = [];
    
    // Cria as labels retroativas (ex: 02/2026, 03/2026...)
    for (let i = 5; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        mesesLabels.push(label);
        chavesAnoMes.push({ key: key, count: 0 });
    }

    // Contabiliza os atestados na chave do mês correspondente
    window.listaAtestadosPainel.forEach(a => {
        if (a.data_inicio) {
            const [ano, mes] = a.data_inicio.split('-');
            const key = `${ano}-${mes}`;
            const target = chavesAnoMes.find(m => m.key === key);
            if (target) target.count++;
        }
    });

    const dataBarras = chavesAnoMes.map(c => c.count);

    const domEvolucao = document.getElementById('graficoEvolucaoAtestados');
    if (window.chartEvolucaoAtestados) window.chartEvolucaoAtestados.dispose();
    window.chartEvolucaoAtestados = echarts.init(domEvolucao);

    const optionEvolucao = {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
        xAxis: { 
            type: 'category', 
            data: mesesLabels, 
            axisLabel: { color: '#9ca3af' },
            axisLine: { lineStyle: { color: '#374151' } }
        },
        yAxis: { 
            type: 'value', 
            axisLabel: { color: '#9ca3af' }, 
            splitLine: { lineStyle: { color: '#374151', type: 'dashed' } }
        },
        series: [{
            name: 'Atestados Entregues',
            type: 'bar',
            barWidth: '40%',
            data: dataBarras,
            itemStyle: { 
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: '#60a5fa' },
                    { offset: 1, color: '#2563eb' }
                ]),
                borderRadius: [4, 4, 0, 0] 
            },
            label: { show: true, position: 'top', color: '#fff', fontWeight: 'bold' }
        }]
    };
    window.chartEvolucaoAtestados.setOption(optionEvolucao);
};

window.calcularBadgeAsoPainel = function(dataStr) {
    if (!dataStr) return '<span style="color:#ef4444; font-weight:bold;">Não Cadastrado</span>';
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const venc = new Date(dataStr + 'T00:00:00');
    
    const dias = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 3600 * 24));
    
    if (dias < 0) return '<span style="color:#ef4444; font-weight:bold;">Vencido</span>';
    if (dias <= 30) return `<span style="color:#fb923c; font-weight:bold;">Vence em ${dias}d</span>`;
    return '<span style="color: var(--ccol-green-bright);">Regular</span>';
};

window.renderizarTabelaPainelRH = function(lista) {
    const tbody = document.getElementById('tbPainelRH');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#9ca3af; padding: 20px;">Nenhum colaborador ativo encontrado.</td></tr>`;
        return;
    }

    lista.forEach(c => {
        const mat = c.cod_funcionario ? String(c.cod_funcionario).padStart(4, '0') : '-';
        
        const isPlano = c.plano_saude && c.plano_saude.toLowerCase() === 'sim';
        const planoStr = isPlano ? '<span style="color:var(--ccol-green-bright);">Sim</span>' : '<span style="color:#ef4444;">Não</span>';
        
        const isSind = c.ativo_sindicato && c.ativo_sindicato.toLowerCase() === 'sim';
        const sindStr = isSind ? '<span style="color:#8b5cf6;">Sim</span>' : '<span style="color:#ef4444;">Não</span>';
        
        const asoBadge = window.calcularBadgeAsoPainel(c.aso_vencimento);
        
        tbody.innerHTML += `
            <tr>
                <td><strong style="color:var(--ccol-blue-bright);">${mat}</strong></td>
                <td style="text-align: left; font-weight: bold;">${c.nome}</td>
                <td>${c.funcao || '-'}</td>
                <td>${c.telefone || '-'}</td>
                <td>${planoStr}</td>
                <td>${sindStr}</td>
                <td>${asoBadge}</td>
            </tr>
        `;
    });
};

window.filtrarTabelaPainelRH = function() {
    const termo = document.getElementById('buscaPainelRH').value.toLowerCase();
    const filtrados = window.listaParaPainelRH.filter(c => 
        (c.nome && c.nome.toLowerCase().includes(termo)) || 
        (c.cod_funcionario && String(c.cod_funcionario).includes(termo)) ||
        (c.funcao && c.funcao.toLowerCase().includes(termo))
    );
    window.renderizarTabelaPainelRH(filtrados);
};