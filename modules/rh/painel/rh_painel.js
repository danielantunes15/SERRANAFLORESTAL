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
        
        // Filtra garantindo que ignora inativos
        window.listaParaPainelRH = dadosColab.filter(c => {
            const status = c.status ? c.status.toLowerCase() : '';
            return status !== 'inativo' && status !== 'desligado';
        });

        window.listaAtestadosPainel = dadosAtestados || [];
        
        window.renderizarPainelFerias(); // Renderiza e já calcula os alertas
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

window.renderizarPainelFerias = function() {
    const listaVencer = [];
    const listaVencidas = [];
    
    const hoje = new Date();
    hoje.setHours(0,0,0,0);

    window.listaParaPainelRH.forEach(c => {
        const status = c.status ? c.status.toLowerCase() : '';
        if (status === 'férias' || status === 'ferias') return; // Ignora quem já está de férias
        if (!c.data_admissao) return; // Ignora se não tem data de admissão
        
        const [anoAdm, mesAdm, diaAdm] = c.data_admissao.split('-');
        const dataAdmObj = new Date(anoAdm, mesAdm - 1, diaAdm);
        
        // Cálculo exato de meses completos
        let mesesTotal = (hoje.getFullYear() - dataAdmObj.getFullYear()) * 12;
        mesesTotal -= dataAdmObj.getMonth();
        mesesTotal += hoje.getMonth();
        
        // Se o dia de hoje for menor que o dia de admissão, ainda não fechou o mês
        if (hoje.getDate() < dataAdmObj.getDate()) {
            mesesTotal--;
        }
        
        if (mesesTotal >= 11) {
            const anosEmpresa = Math.floor(mesesTotal / 12);
            const mesesRestantes = mesesTotal % 12;
            
            let tempoStr = anosEmpresa > 0 ? `${anosEmpresa} ano(s)` : '';
            if (mesesRestantes > 0) {
                tempoStr += tempoStr ? ` e ${mesesRestantes} mês(es)` : `${mesesRestantes} mês(es)`;
            }

            // Se tem 23 meses ou mais, já estourou ou está no mês limite
            if (mesesTotal >= 23) {
                listaVencidas.push({ ...c, tempoStr, mesesTotal });
            } 
            // Se fechou 11 meses do ciclo ou virou o ano exato
            else if (mesesRestantes >= 11 || mesesRestantes === 0 || mesesRestantes === 1) {
                listaVencer.push({ ...c, tempoStr, mesesTotal });
            }
        }
    });

    // Ordena para que os piores casos apareçam primeiro no topo
    listaVencidas.sort((a, b) => b.mesesTotal - a.mesesTotal);
    listaVencer.sort((a, b) => b.mesesTotal - a.mesesTotal);

    // Salva globalmente para usar a contagem no KPI
    window.totalFeriasAlertas = listaVencer.length + listaVencidas.length;

    // Atualiza as Badges dos cabeçalhos dos painéis
    document.getElementById('badgeCountVencer').innerText = listaVencer.length;
    document.getElementById('badgeCountVencidas').innerText = listaVencidas.length;

    // Constrói os cards HTML
    const formatarData = (dataIso) => {
        const [a, m, d] = dataIso.split('-');
        return `${d}/${m}/${a}`;
    };

    const divVencer = document.getElementById('listaFeriasVencer');
    if (listaVencer.length === 0) {
        divVencer.innerHTML = `<div style="text-align:center; color:#10b981; padding:20px; font-weight:bold;"><i class="fas fa-check-circle" style="font-size:2rem; display:block; margin-bottom:10px;"></i>Ninguém com férias a programar no momento.</div>`;
    } else {
        divVencer.innerHTML = listaVencer.map(c => {
            const matricula = c.cod_funcionario ? String(c.cod_funcionario).padStart(4, '0') : '-';
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); border-left: 4px solid #f59e0b; padding: 12px 15px; border-radius: 6px;">
                    <div>
                        <strong style="color: #fff; font-size: 0.95rem; display: block; margin-bottom: 3px;">${c.nome}</strong>
                        <span style="color: var(--text-secondary); font-size: 0.8rem;"><i class="fas fa-id-badge"></i> Mat: ${matricula} | ${c.funcao || 'Sem função'}</span>
                    </div>
                    <div style="text-align: right;">
                        <span style="display: block; font-size: 0.8rem; color: #94a3b8; margin-bottom: 3px;">Admissão: <strong style="color:#fff;">${formatarData(c.data_admissao)}</strong></span>
                        <span style="display: inline-block; background: rgba(245, 158, 11, 0.1); padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; color: #f59e0b; font-weight: bold;"><i class="fas fa-clock"></i> ${c.tempoStr}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    const divVencidas = document.getElementById('listaFeriasVencidas');
    if (listaVencidas.length === 0) {
        divVencidas.innerHTML = `<div style="text-align:center; color:#10b981; padding:20px; font-weight:bold;"><i class="fas fa-check-double" style="font-size:2rem; display:block; margin-bottom:10px;"></i>Nenhuma férias vencida! Excelente gestão.</div>`;
    } else {
        divVencidas.innerHTML = listaVencidas.map(c => {
            const matricula = c.cod_funcionario ? String(c.cod_funcionario).padStart(4, '0') : '-';
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 12px 15px; border-radius: 6px;">
                    <div>
                        <strong style="color: #fff; font-size: 0.95rem; display: block; margin-bottom: 3px;">${c.nome}</strong>
                        <span style="color: var(--text-secondary); font-size: 0.8rem;"><i class="fas fa-id-badge"></i> Mat: ${matricula} | ${c.funcao || 'Sem função'}</span>
                    </div>
                    <div style="text-align: right;">
                        <span style="display: block; font-size: 0.8rem; color: #94a3b8; margin-bottom: 3px;">Admissão: <strong style="color:#fff;">${formatarData(c.data_admissao)}</strong></span>
                        <span style="display: inline-block; background: #ef4444; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; color: #fff; font-weight: bold;"><i class="fas fa-exclamation-circle"></i> ${c.tempoStr}</span>
                    </div>
                </div>
            `;
        }).join('');
    }
};

window.atualizarKPIsPainelRH = function() {
    const total = window.listaParaPainelRH.length;
    const plano = window.listaParaPainelRH.filter(c => c.plano_saude && c.plano_saude.toLowerCase() === 'sim').length;
    const sindicato = window.listaParaPainelRH.filter(c => c.ativo_sindicato && c.ativo_sindicato.toLowerCase() === 'sim').length;
    
    let asoAlertas = 0;
    let emFerias = 0;

    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    
    window.listaParaPainelRH.forEach(c => {
        // --- 1. Verificação de Status Férias ---
        const status = c.status ? c.status.toLowerCase() : '';
        if (status === 'férias' || status === 'ferias') {
            emFerias++;
        }

        // --- 2. Verificação de ASO Vencido ---
        if(c.aso_vencimento) {
            const venc = new Date(c.aso_vencimento + 'T00:00:00');
            const dif = (venc.getTime() - hoje.getTime()) / (1000 * 3600 * 24);
            if(dif <= 30) asoAlertas++;
        } else {
            asoAlertas++; 
        }
    });

    // --- 3. Calcular atestados dos últimos 30 dias ---
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

    // Atualizando o HTML
    document.getElementById('kpiTotalAtivos').innerText = total;
    document.getElementById('kpiPlanoSaude').innerText = plano;
    document.getElementById('kpiSindicato').innerText = sindicato;
    document.getElementById('kpiAsoVencido').innerText = asoAlertas;
    document.getElementById('kpiAtestados').innerText = atestados30Dias;
    document.getElementById('kpiEmFerias').innerText = emFerias;
    
    // Total de alertas calculados na função renderizarPainelFerias()
    document.getElementById('kpiFeriasVencer').innerText = window.totalFeriasAlertas || 0;
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
    
    for (let i = 5; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        mesesLabels.push(label);
        chavesAnoMes.push({ key: key, count: 0 });
    }

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