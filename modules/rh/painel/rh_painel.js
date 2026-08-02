window.listaParaPainelRH = [];
window.listaAbsenteismoPainel = [];
window.setoresRH = [];
window.listaAniversariantesCache = [];
window.chartCid = null;
window.chartEvolucaoAtestados = null;
window.chartContratos = null;
window.chartSetores = null;

window.initRHPainel = async function() {
    try {
        const tbody = document.getElementById('tbPainelRH');
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Carregando dashboard e dados do RH...</td></tr>`;
        
        // Busca paralela de todos os dados necessários
        const pColab = db.getColaboradores();
        const pAbs = db.getAbsenteismo();
        const pSetores = window.supabaseClient.from('setores').select('id, nome');
        
        const [dadosColab, dadosAbsenteismo, resSetores] = await Promise.all([pColab, pAbs, pSetores]);
        
        window.setoresRH = resSetores.data || [];
        window.listaAbsenteismoPainel = dadosAbsenteismo || [];
        
        // Filtra garantindo que ignora inativos
        window.listaParaPainelRH = dadosColab.filter(c => {
            const status = c.status ? c.status.toLowerCase() : '';
            return status !== 'inativo' && status !== 'desligado';
        });
        
        window.renderizarPaineisSecundarios(); 
        window.atualizarKPIsPainelRH();
        window.renderizarGraficosRH();
        window.renderizarTabelaPainelRH(window.listaParaPainelRH);

        // Responsividade dos gráficos
        window.addEventListener('resize', function() {
            if (window.chartCid) window.chartCid.resize();
            if (window.chartEvolucaoAtestados) window.chartEvolucaoAtestados.resize();
            if (window.chartContratos) window.chartContratos.resize();
            if (window.chartSetores) window.chartSetores.resize();
        });
    } catch(e) {
        console.error("Erro ao carregar Painel RH:", e);
        const tbody = document.getElementById('tbPainelRH');
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="color: #ef4444; text-align: center;">Erro ao carregar os dados.</td></tr>`;
    }
};

window.renderizarPaineisSecundarios = function() {
    window.renderizarPainelFerias();
    window.renderizarPainelAniversariantes();
};

window.renderizarPainelAniversariantes = function() {
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    let listaAniv = [];
    
    window.listaParaPainelRH.forEach(c => {
        if (c.data_nascimento) {
            const [a, m, d] = c.data_nascimento.split('-');
            if (parseInt(m) === mesAtual) {
                listaAniv.push({ ...c, dia: parseInt(d), mes: parseInt(m) });
            }
        }
    });
    
    listaAniv.sort((a, b) => a.dia - b.dia);
    window.listaAniversariantesCache = listaAniv;
    
    const divAniv = document.getElementById('listaAniversariantes');
    if(divAniv) {
        if (listaAniv.length === 0) {
            divAniv.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:20px; font-weight:bold;"><i class="fas fa-calendar-times" style="font-size:2rem; display:block; margin-bottom:10px;"></i>Nenhum aniversariante neste mês.</div>`;
        } else {
            divAniv.innerHTML = listaAniv.map(c => {
                const matricula = c.cod_funcionario ? String(c.cod_funcionario).padStart(4, '0') : '-';
                const isHoje = c.dia === hoje.getDate();
                const borda = isHoje ? 'border-left: 4px solid #ec4899; background: rgba(236, 72, 153, 0.1);' : 'border-left: 4px solid #475569; background: rgba(0,0,0,0.2);';
                const icone = isHoje ? '<i class="fas fa-gift" style="color: #ec4899; margin-left: 5px;" title="Aniversário Hoje!"></i>' : '';
                
                return `
                    <div style="display: flex; justify-content: space-between; align-items: center; ${borda} padding: 12px 15px; border-radius: 6px;">
                        <div>
                            <strong style="color: #fff; font-size: 0.95rem; display: block; margin-bottom: 3px;">${c.nome} ${icone}</strong>
                            <span style="color: var(--text-secondary); font-size: 0.8rem;"><i class="fas fa-id-badge"></i> Mat: ${matricula} | ${c.funcao || 'Sem função'}</span>
                        </div>
                        <div style="text-align: right;">
                            <span style="display: inline-block; background: rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 4px; font-size: 0.85rem; color: #fff; font-weight: bold;"><i class="fas fa-calendar-day"></i> Dia ${String(c.dia).padStart(2, '0')}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
};

window.imprimirAniversariantes = function() {
    if (!window.listaAniversariantesCache || window.listaAniversariantesCache.length === 0) {
        alert("Nenhum aniversariante para imprimir.");
        return;
    }
    const nomeMes = new Date().toLocaleString('pt-BR', { month: 'long' });
    let html = `<html><head><title>Aniversariantes do Mês</title><style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h2 { text-align: center; color: #333; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
        th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }
        th { background: #f4f4f4; text-transform: uppercase; font-size: 12px; }
    </style></head><body>
    <h2>Aniversariantes do Mês de ${nomeMes}</h2>
    <table>
        <thead><tr><th>Dia</th><th>Matrícula</th><th>Nome Completo</th><th>Setor/Função</th></tr></thead>
        <tbody>
    `;
    window.listaAniversariantesCache.forEach(c => {
        html += `<tr>
            <td style="text-align:center;"><strong>${String(c.dia).padStart(2, '0')}</strong></td>
            <td style="text-align:center;">${c.cod_funcionario ? String(c.cod_funcionario).padStart(4, '0') : '-'}</td>
            <td>${c.nome}</td>
            <td>${c.funcao || '-'}</td>
        </tr>`;
    });
    html += `</tbody></table></body></html>`;
    
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
};

window.renderizarPainelFerias = function() {
    const listaVencer = [];
    const listaVencidas = [];
    
    const hoje = new Date();
    hoje.setHours(0,0,0,0);

    window.listaParaPainelRH.forEach(c => {
        const status = c.status ? c.status.toLowerCase() : '';
        if (status === 'férias' || status === 'ferias') return;
        if (!c.data_admissao) return;
        
        const [anoAdm, mesAdm, diaAdm] = c.data_admissao.split('-');
        const dataAdmObj = new Date(anoAdm, mesAdm - 1, diaAdm);
        
        let mesesTotal = (hoje.getFullYear() - dataAdmObj.getFullYear()) * 12;
        mesesTotal -= dataAdmObj.getMonth();
        mesesTotal += hoje.getMonth();
        
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

            if (mesesTotal >= 23) {
                listaVencidas.push({ ...c, tempoStr, mesesTotal });
            } 
            else if (mesesRestantes >= 11 || mesesRestantes === 0 || mesesRestantes === 1) {
                listaVencer.push({ ...c, tempoStr, mesesTotal });
            }
        }
    });

    listaVencidas.sort((a, b) => b.mesesTotal - a.mesesTotal);
    listaVencer.sort((a, b) => b.mesesTotal - a.mesesTotal);

    window.totalFeriasAlertas = listaVencer.length + listaVencidas.length;

    const bVencer = document.getElementById('badgeCountVencer');
    const bVencidas = document.getElementById('badgeCountVencidas');
    if(bVencer) bVencer.innerText = listaVencer.length;
    if(bVencidas) bVencidas.innerText = listaVencidas.length;

    const formatarData = (dataIso) => {
        const [a, m, d] = dataIso.split('-');
        return `${d}/${m}/${a}`;
    };

    const divVencer = document.getElementById('listaFeriasVencer');
    if(divVencer) {
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
    }

    const divVencidas = document.getElementById('listaFeriasVencidas');
    if(divVencidas) {
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
    const mesAtual = hoje.getMonth() + 1;
    let aniversariantes = 0;

    window.listaParaPainelRH.forEach(c => {
        const status = c.status ? c.status.toLowerCase() : '';
        if (status === 'férias' || status === 'ferias') {
            emFerias++;
        }
        
        if (c.data_nascimento) {
            const [, m, ] = c.data_nascimento.split('-');
            if (parseInt(m) === mesAtual) aniversariantes++;
        }

        if(c.aso_vencimento) {
            const venc = new Date(c.aso_vencimento + 'T00:00:00');
            const dif = (venc.getTime() - hoje.getTime()) / (1000 * 3600 * 24);
            if(dif <= 30) asoAlertas++;
        } else {
            asoAlertas++; 
        }
    });

    let atestados30Dias = 0;
    const data30DiasAtras = new Date();
    data30DiasAtras.setDate(hoje.getDate() - 30);
    
    window.listaAbsenteismoPainel.forEach(a => {
        if (a.tipo_registro === 'ATESTADO' && a.data_inicio) {
            const [ano, mes, dia] = a.data_inicio.split('-');
            const dataAt = new Date(ano, mes - 1, dia);
            if (dataAt >= data30DiasAtras && dataAt <= hoje) {
                atestados30Dias++;
            }
        }
    });

    if(document.getElementById('kpiTotalAtivos')) document.getElementById('kpiTotalAtivos').innerText = total;
    if(document.getElementById('kpiAniversariantes')) document.getElementById('kpiAniversariantes').innerText = aniversariantes;
    if(document.getElementById('kpiPlanoSaude')) document.getElementById('kpiPlanoSaude').innerText = plano;
    if(document.getElementById('kpiSindicato')) document.getElementById('kpiSindicato').innerText = sindicato;
    if(document.getElementById('kpiAsoVencido')) document.getElementById('kpiAsoVencido').innerText = asoAlertas;
    if(document.getElementById('kpiAtestados')) document.getElementById('kpiAtestados').innerText = atestados30Dias;
    if(document.getElementById('kpiEmFerias')) document.getElementById('kpiEmFerias').innerText = emFerias;
    if(document.getElementById('kpiFeriasVencer')) document.getElementById('kpiFeriasVencer').innerText = window.totalFeriasAlertas || 0;
};

window.renderizarGraficosRH = function() {
    if (typeof echarts === 'undefined') return;

    // ==========================================
    // GRÁFICO 1: CONTRATOS
    // ==========================================
    const freqContrato = {};
    window.listaParaPainelRH.forEach(c => {
        let tipo = c.tipo_contrato || 'CLT';
        freqContrato[tipo] = (freqContrato[tipo] || 0) + 1;
    });
    const dataContratos = Object.keys(freqContrato).map(k => ({ name: k, value: freqContrato[k] }));
    
    const domContratos = document.getElementById('graficoContratos');
    if(domContratos) {
        if (window.chartContratos) window.chartContratos.dispose();
        window.chartContratos = echarts.init(domContratos);
        window.chartContratos.setOption({
            tooltip: { trigger: 'item', formatter: '{b}: {c} colab. ({d}%)' },
            legend: { top: 'bottom', textStyle: { color: '#9ca3af' } },
            color: ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'],
            series: [{
                type: 'pie', radius: ['40%', '70%'], avoidLabelOverlap: false,
                itemStyle: { borderRadius: 8, borderColor: '#1f2937', borderWidth: 3 },
                label: { show: false },
                data: dataContratos
            }]
        });
    }

    // ==========================================
    // GRÁFICO 2: SETORES / CENTROS DE CUSTO
    // ==========================================
    const freqSetor = {};
    window.listaParaPainelRH.forEach(c => {
        let nomeSetor = 'Sem Setor';
        if(c.setor_id && window.setoresRH) {
            let s = window.setoresRH.find(x => x.id == c.setor_id);
            if(s) nomeSetor = s.nome;
        }
        freqSetor[nomeSetor] = (freqSetor[nomeSetor] || 0) + 1;
    });
    const dataSetores = Object.keys(freqSetor).map(k => ({ name: k, value: freqSetor[k] }));
    dataSetores.sort((a,b) => b.value - a.value);
    
    const domSetores = document.getElementById('graficoSetores');
    if(domSetores) {
        if (window.chartSetores) window.chartSetores.dispose();
        window.chartSetores = echarts.init(domSetores);
        window.chartSetores.setOption({
            tooltip: { trigger: 'item', formatter: '{b}: {c} colab. ({d}%)' },
            legend: { type: 'scroll', top: 'bottom', textStyle: { color: '#9ca3af' } },
            color: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#06b6d4'],
            series: [{
                type: 'pie', radius: '65%', center: ['50%', '45%'],
                itemStyle: { borderRadius: 4, borderColor: '#1f2937', borderWidth: 2 },
                label: { show: false },
                data: dataSetores
            }]
        });
    }

    // ==========================================
    // GRÁFICO 3: TOP 5 MOTIVOS / CID
    // ==========================================
    const freqCid = {};
    window.listaAbsenteismoPainel.forEach(a => {
        if (a.tipo_registro !== 'ATESTADO') return;
        let chave = a.cid ? a.cid.trim().toUpperCase() : (a.motivo ? a.motivo.trim() : 'Não Informado');
        if (chave === '') chave = 'Não Informado';
        freqCid[chave] = (freqCid[chave] || 0) + 1;
    });
    
    const cidArray = Object.keys(freqCid).map(k => ({ name: k, value: freqCid[k] }));
    cidArray.sort((a,b) => b.value - a.value);
    const top5Cid = cidArray.slice(0, 5);
    const hasCidData = top5Cid.length > 0;
    
    const domCid = document.getElementById('graficoCid');
    if(domCid) {
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
                emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold', color: '#fff' } },
                data: hasCidData ? top5Cid : [{ name: 'Sem dados', value: 0 }]
            }]
        };
        window.chartCid.setOption(optionCid);
    }

    // ==========================================
    // GRÁFICO 4: EVOLUÇÃO 6 MESES ATESTADOS
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
    window.listaAbsenteismoPainel.forEach(a => {
        if (a.tipo_registro !== 'ATESTADO') return;
        if (a.data_inicio) {
            const [ano, mes] = a.data_inicio.split('-');
            const key = `${ano}-${mes}`;
            const target = chavesAnoMes.find(m => m.key === key);
            if (target) target.count++;
        }
    });
    const dataBarras = chavesAnoMes.map(c => c.count);
    const domEvolucao = document.getElementById('graficoEvolucaoAtestados');
    if(domEvolucao) {
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
    }
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
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#9ca3af; padding: 20px;">Nenhum colaborador ativo encontrado.</td></tr>`;
        return;
    }
    lista.forEach(c => {
        const mat = c.cod_funcionario ? String(c.cod_funcionario).padStart(4, '0') : '-';
        
        let contratoLabel = c.tipo_contrato || 'CLT';
        let badgeContrato = `<span style="background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; border: 1px solid var(--border-dim);">${contratoLabel}</span>`;
        if (contratoLabel === 'Temporário') {
            badgeContrato = `<span style="background: rgba(245,158,11,0.1); color: #f59e0b; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; border: 1px solid rgba(245,158,11,0.3); font-weight:bold;">Experiência</span>`;
        }

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
                <td>${badgeContrato}</td>
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