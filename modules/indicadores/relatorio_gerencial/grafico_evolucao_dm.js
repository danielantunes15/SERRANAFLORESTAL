// =================================================================
// FUNÇÕES DO FILTRO GLOBAL E KPIS
// =================================================================

window.corrigirDataSupabase = window.corrigirDataSupabase || function(dateStr) {
    if (!dateStr || dateStr === 'null' || dateStr === 'undefined') return null;
    let str = String(dateStr).trim();
    
    if (!str.includes('T')) str = str.replace(' ', 'T');
    
    const partes = str.split('T');
    if (partes.length === 2) {
        const horaStr = partes[1];
        if (!horaStr.includes('Z') && !horaStr.includes('+') && !horaStr.includes('-')) {
            str += 'Z'; 
        }
    }
    
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

window.getDatasFiltroGlobal = function() {
    const selectFiltro = document.getElementById('filtroGlobalPeriodo');
    const filtro = selectFiltro ? selectFiltro.value : 'mes_atual';
    const hoje = new Date();
    let inicio = new Date(hoje);
    inicio.setHours(0,0,0,0);
    
    let fim = new Date();
    fim.setHours(23,59,59,999);

    if (filtro === 'dia_atual') {
    } else if (filtro === 'semana_atual') {
        inicio.setDate(inicio.getDate() - inicio.getDay());
    } else if (filtro === 'mes_atual') {
        inicio.setDate(1);
    } else {
        let d = parseInt(filtro) || 30;
        inicio.setDate(inicio.getDate() - d + 1);
    }

    return { inicio: inicio, fim: fim, valorBruto: filtro };
}

window.atualizarKPIsGlobais = function() {
    try {
        if (!ordensServico || !frotasManutencao) return;

        const cavalosValidos = frotasManutencao
            .filter(f => f.status === 'Ativo' && f.categoria && f.categoria.toUpperCase() === 'TRITREM')
            .map(f => f.cavalo);

        const datas = window.getDatasFiltroGlobal();
        const inicio = datas.inicio;
        const fim = datas.fim;
        
        let totalOS = 0;
        let abertasOS = 0;
        let concluidasOS = 0;
        let msTotalTempo = 0;
        let osComTempo = 0;
        
        ordensServico.forEach(os => {
            if (!os.placa || !cavalosValidos.includes(os.placa)) return;
            if (os.status === 'Agendada') return;

            const dtAbertura = window.corrigirDataSupabase(os.data_abertura);
            if (!dtAbertura) return;
            
            let dtConclusao = os.data_conclusao ? window.corrigirDataSupabase(os.data_conclusao) : new Date();
            
            if (dtAbertura <= fim && dtConclusao >= inicio) {
                totalOS++;
                if (os.status === 'Concluída' || os.status === 'Resolvido') {
                    concluidasOS++;
                    if (os.data_abertura && os.data_conclusao) { 
                        msTotalTempo += (dtConclusao - dtAbertura);
                        osComTempo++;
                    }
                } else {
                    abertasOS++;
                }
            }
        });
        
        let taxaConclusao = totalOS > 0 ? ((concluidasOS / totalOS) * 100).toFixed(1) : 0;
        let tempoMedioStr = '0h 0m';

        if (osComTempo > 0) {
            let mediaMs = msTotalTempo / osComTempo;
            let mediaHoras = Math.floor(mediaMs / (1000 * 60 * 60));
            let mediaMinutos = Math.floor((mediaMs % (1000 * 60 * 60)) / (1000 * 60));
            tempoMedioStr = `${mediaHoras}h ${mediaMinutos}m`;
        }
        
        const elKpiTotal = document.getElementById('kpiTotalOS');
        const elKpiAbertas = document.getElementById('kpiAbertasOS');
        const elKpiConcluidas = document.getElementById('kpiConcluidasOS');
        const elKpiTaxa = document.getElementById('kpiTaxaOS');
        const elKpiTempo = document.getElementById('kpiTempoMedioOS');

        if(elKpiTotal) elKpiTotal.innerText = totalOS;
        if(elKpiAbertas) elKpiAbertas.innerText = abertasOS;
        if(elKpiConcluidas) elKpiConcluidas.innerText = concluidasOS;
        if(elKpiTaxa) elKpiTaxa.innerText = taxaConclusao + '%';
        if(elKpiTempo) elKpiTempo.innerText = tempoMedioStr;
        
        if (!frotasManutencao || frotasManutencao.length === 0) return;
        
        let fimParaCalculo = fim > new Date() ? new Date() : fim;
        let msTotalPeriodo = fimParaCalculo - inicio;
        if (msTotalPeriodo <= 0) msTotalPeriodo = 1;
        
        let msManutencaoComum = 0;
        let msSOS = 0;
        let totalMsDisponivelPeriodo = 0;
        
        frotasManutencao.forEach(frota => {
            if(frota.status !== 'Ativo' || !frota.categoria || frota.categoria.toUpperCase() !== 'TRITREM') return;
            
            let frotaInicioStr = frota.data_inicial ? frota.data_inicial : '2026-04-01';
            let dtEntradaVeiculo = new Date(frotaInicioStr + 'T00:00:00');
            
            let overlapDispInicio = dtEntradaVeiculo > inicio ? dtEntradaVeiculo : inicio;
            if (overlapDispInicio < fimParaCalculo) {
                totalMsDisponivelPeriodo += (fimParaCalculo - overlapDispInicio);
            }
            
            const todasOSCavalo = ordensServico.filter(o => o.placa === frota.cavalo && o.status !== 'Agendada' && o.tipo !== 'Cavalo Disponível S/ Carreta');

            todasOSCavalo.forEach(os => {
                const osInicio = window.corrigirDataSupabase(os.data_abertura);
                if (!osInicio) return;
                
                let osFim = os.data_conclusao ? window.corrigirDataSupabase(os.data_conclusao) : new Date();
                
                let inicioValido = osInicio > dtEntradaVeiculo ? osInicio : dtEntradaVeiculo;
                let overlapInicio = inicioValido > inicio ? inicioValido : inicio;
                const overlapFim = osFim < fimParaCalculo ? osFim : fimParaCalculo;
                
                if (overlapInicio < overlapFim) {
                    const tempoParado = overlapFim - overlapInicio;
                    const tipoOS = (os.tipo || os.tipo_manutencao || '').toUpperCase();
                    const descOS = (os.descricao || '').toUpperCase();
                    const prioridadeOS = (os.prioridade || '').toUpperCase();

                    if (
                        tipoOS.includes('S.O.S') || tipoOS.includes('SOS') || tipoOS.includes('SOCORRO') ||
                        descOS.includes('S.O.S') || descOS.includes('SOS') || descOS.includes('SOCORRO') ||
                        prioridadeOS.includes('EMERGÊNCIA')
                    ) {
                        msSOS += tempoParado;
                    } else {
                        msManutencaoComum += tempoParado;
                    }
                }
            });
        });
        
        let msManutTotal = msManutencaoComum + msSOS;
        let dispNoPeriodoMs = totalMsDisponivelPeriodo - msManutTotal;
        if (dispNoPeriodoMs < 0) dispNoPeriodoMs = 0;
        
        const mediaAtivosReal = Math.round(dispNoPeriodoMs / msTotalPeriodo);
        const mediaManutReal = Math.round(msManutencaoComum / msTotalPeriodo);
        const mediaSOSReal = Math.round(msSOS / msTotalPeriodo);

        const percentDMReal = totalMsDisponivelPeriodo > 0 ? (dispNoPeriodoMs / totalMsDisponivelPeriodo) * 100 : 100;
        
        const elAvgDM = document.getElementById('avgDM');
        const elAvgAtivos = document.getElementById('avgAtivos');
        const elAvgManut = document.getElementById('avgManut');
        const elAvgSOS = document.getElementById('avgSOS');
        
        if(elAvgDM) elAvgDM.innerText = percentDMReal.toFixed(1) + '%';
        if(elAvgAtivos) elAvgAtivos.innerText = mediaAtivosReal;
        if(elAvgManut) elAvgManut.innerText = mediaManutReal;
        if(elAvgSOS) elAvgSOS.innerText = mediaSOSReal;

    } catch(e) {
        console.error("Erro ao atualizar KPIs Globais:", e);
    }
}

window.dispararFiltrosGlobais = function() {
    try { if(typeof atualizarKPIsGlobais === 'function') atualizarKPIsGlobais(); } catch(e){}
    try { if(typeof renderizarRelatorioGerencialOS === 'function') renderizarRelatorioGerencialOS(); } catch(e){}
    try { if(typeof renderizarRankingMotoristas === 'function') renderizarRankingMotoristas(); } catch(e){}
    try { if(typeof renderizarGraficoEvolucaoDM === 'function') renderizarGraficoEvolucaoDM(); } catch(e){}
    try { if(typeof renderizarGraficoStatusFrotaHorario === 'function') renderizarGraficoStatusFrotaHorario(); } catch(e){}
    try { if(typeof renderizarGraficoEvolucaoDMDiaria === 'function') renderizarGraficoEvolucaoDMDiaria(); } catch(e){}
    try { if(typeof renderizarGraficoEvolucaoDMDiariaGrua === 'function') renderizarGraficoEvolucaoDMDiariaGrua(); } catch(e){}
    try { if(typeof renderizarGraficoDMOperacional === 'function') renderizarGraficoDMOperacional(); } catch(e){}
    try { if(typeof renderizarDMIndividual === 'function') renderizarDMIndividual(); } catch(e){}
    try { if(typeof renderizarDMIndividualGrua === 'function') renderizarDMIndividualGrua(); } catch(e){}
    
    const hiddenFiltroTabela = document.getElementById('filtroPeriodoDM');
    if(hiddenFiltroTabela) {
        let val = document.getElementById('filtroGlobalPeriodo').value;
        if(val === 'dia_atual') val = '1';
        else if(val === 'semana_atual') val = '7';
        
        hiddenFiltroTabela.value = val;
        try { if(typeof renderizarRelatorioDM === 'function') renderizarRelatorioDM(); } catch(e){}
    }
}

// =================================================================
// FUNÇÕES DOS PAINÉIS DE RANKING E GRÁFICOS (RELATÓRIO GERENCIAL)
// =================================================================

window.renderizarRelatorioGerencialOS = function() {
    try {
        const containerRanking = document.getElementById('rankingCavalosOS');
        const containerOcorrencias = document.getElementById('graficoTipoOS');
        const containerPrioridade = document.getElementById('graficoPrioridadeOS');

        if (!ordensServico || ordensServico.length === 0) return;

        const datas = window.getDatasFiltroGlobal ? window.getDatasFiltroGlobal() : { inicio: new Date(), fim: new Date() };
        const inicio = datas.inicio;
        const fim = datas.fim;

        if (containerRanking) {
            const contagemPlacas = {};
            ordensServico.forEach(o => {
                if (o.inativa === 1 || o.inativa === '1' || o.inativa === true) return;
                if (!o.placa || o.status === 'Agendada' || o.status === 'Cancelada' || o.tipo === 'Cavalo Disponível S/ Carreta') return;
                
                let dtAbertura = window.corrigirDataSupabase(o.data_abertura);
                if (dtAbertura && dtAbertura >= inicio && dtAbertura <= fim) {
                    const p = String(o.placa).trim().toUpperCase();
                    contagemPlacas[p] = (contagemPlacas[p] || 0) + 1;
                }
            });

            const top5 = Object.entries(contagemPlacas).sort((a,b) => b[1] - a[1]).slice(0, 5);
            
            if (top5.length === 0) {
                containerRanking.innerHTML = '<p style="color:#94a3b8; text-align:center; padding: 20px;">Nenhuma ocorrência no período.</p>';
            } else {
                containerRanking.innerHTML = top5.map((item, index) => {
                    const placa = item[0], qtd = item[1];
                    let cor = index === 0 ? '#ef4444' : index === 1 ? '#f97316' : index === 2 ? '#facc15' : 'var(--ccol-blue-bright)';
                    
                    return `
                    <div onclick="abrirModalHistoricoPlacaGerencial('${placa}')" style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 12px 15px; margin-bottom: 8px; border-radius: 8px; border-left: 4px solid ${cor}; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(0,0,0,0.2)'" title="Clique para ver detalhes das O.S. deste veículo">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 1.2rem; font-weight: bold; color: ${cor};">#${index+1}</span>
                            <span style="font-size: 1.1rem; font-weight: bold; color: white;">${placa}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="font-size: 1.2rem; font-weight: 900; color: white;">${qtd} <span style="font-size: 0.8rem; font-weight: normal; color: #94a3b8;">O.S.</span></div>
                            <i class="fas fa-search-plus" style="color: ${cor}; opacity: 0.7;"></i>
                        </div>
                    </div>`;
                }).join('');
            }
        }

        if (containerOcorrencias && typeof echarts !== 'undefined') {
            const contagemTipos = {};
            ordensServico.forEach(o => {
                if (o.inativa === 1 || o.inativa === '1' || o.inativa === true) return;
                if (!o.placa || o.status === 'Agendada' || o.status === 'Cancelada' || o.tipo === 'Cavalo Disponível S/ Carreta') return;
                
                let dtAbertura = window.corrigirDataSupabase(o.data_abertura);
                if (dtAbertura && dtAbertura >= inicio && dtAbertura <= fim) {
                    const tipo = o.tipo || 'Outros';
                    contagemTipos[tipo] = (contagemTipos[tipo] || 0) + 1;
                }
            });

            const keys = Object.keys(contagemTipos).sort((a,b) => contagemTipos[a] - contagemTipos[b]);
            const values = keys.map(k => contagemTipos[k]);

            let myChartTipos = echarts.getInstanceByDom(containerOcorrencias) || echarts.init(containerOcorrencias);
            myChartTipos.setOption({
                backgroundColor: 'transparent',
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                grid: { top: '5%', left: '3%', right: '10%', bottom: '5%', containLabel: true },
                xAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }, axisLabel: { color: '#94a3b8' } },
                yAxis: { type: 'category', data: keys, axisLabel: { color: '#ffffff', width: 120, overflow: 'truncate' } },
                series: [{ name: 'Quantidade', type: 'bar', data: values, itemStyle: { color: 'var(--ccol-blue-bright)', borderRadius: [0, 4, 4, 0] }, label: { show: true, position: 'right', color: '#fff', fontWeight: 'bold' } }]
            });
            window.addEventListener('resize', () => myChartTipos.resize());
        }

        if (containerPrioridade && typeof echarts !== 'undefined') {
            const contagemPri = { 'Urgente': 0, 'Alta': 0, 'Normal': 0, 'Baixa': 0 };
            ordensServico.forEach(o => {
                if (o.inativa === 1 || o.inativa === '1' || o.inativa === true) return;
                if (!o.placa || o.status === 'Agendada' || o.status === 'Cancelada' || o.tipo === 'Cavalo Disponível S/ Carreta') return;
                
                let dtAbertura = window.corrigirDataSupabase(o.data_abertura);
                if (dtAbertura && dtAbertura >= inicio && dtAbertura <= fim) {
                    const pri = o.prioridade || 'Normal';
                    if (contagemPri[pri] !== undefined) contagemPri[pri]++;
                    else contagemPri['Normal']++;
                }
            });

            const dataPie = [
                { value: contagemPri['Urgente'], name: 'Urgente', itemStyle: { color: '#ef4444' } },
                { value: contagemPri['Alta'], name: 'Alta', itemStyle: { color: '#f97316' } },
                { value: contagemPri['Normal'], name: 'Normal', itemStyle: { color: '#3b82f6' } },
                { value: contagemPri['Baixa'], name: 'Baixa', itemStyle: { color: '#10b981' } }
            ].filter(d => d.value > 0);

            let myChartPri = echarts.getInstanceByDom(containerPrioridade) || echarts.init(containerPrioridade);
            myChartPri.setOption({
                backgroundColor: 'transparent', tooltip: { trigger: 'item' }, legend: { bottom: '0', textStyle: { color: '#ffffff' } },
                series: [{ name: 'Prioridade', type: 'pie', radius: ['40%', '70%'], avoidLabelOverlap: false, label: { show: false, position: 'center' }, emphasis: { label: { show: true, fontSize: '18', fontWeight: 'bold', color: '#fff' } }, labelLine: { show: false }, data: dataPie }]
            });
            window.addEventListener('resize', () => myChartPri.resize());
        }

    } catch(e) {
        console.error("Erro na renderização dos painéis:", e);
    }
};

window.abrirModalHistoricoPlacaGerencial = function(placaBusca) {
    const os = window.ordensServico || [];
    const datas = window.getDatasFiltroGlobal ? window.getDatasFiltroGlobal() : { inicio: new Date(), fim: new Date() };
    const inicio = datas.inicio;
    const fim = datas.fim;
    
    const historicoPlaca = os.filter(o => {
        if (o.inativa === 1 || o.inativa === '1' || o.inativa === true) return false;
        
        const p = String(o.placa || o.placa_cavalo || o.veiculo || o.cavalo || '').trim().toUpperCase();
        if (p !== placaBusca) return false;
        if (o.status === 'Agendada' || o.status === 'Cancelada' || o.tipo === 'Cavalo Disponível S/ Carreta') return false;
        
        let dtAbertura = o.data_abertura ? window.corrigirDataSupabase(o.data_abertura) : null;
        if(!dtAbertura) return false;
        
        return (dtAbertura >= inicio && dtAbertura <= fim);
    }).sort((a, b) => window.corrigirDataSupabase(b.data_abertura) - window.corrigirDataSupabase(a.data_abertura)); 

    let htmlTabela = '';
    
    if (historicoPlaca.length === 0) {
        htmlTabela = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #94a3b8;">Nenhum dado encontrado para esta placa no período selecionado.</td></tr>';
    } else {
        htmlTabela = historicoPlaca.map(o => {
            let dataStr = '--/--/----';
            if (o.data_abertura) {
                const dt = window.corrigirDataSupabase(o.data_abertura);
                dataStr = `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')} - ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
            }
            
            return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.1);">
                    <td style="padding: 12px; color: #fff; font-weight: bold; white-space: nowrap;">#${o.numero_os || o.id}</td>
                    <td style="padding: 12px; color: #94a3b8; white-space: nowrap;">${dataStr}</td>
                    <td style="padding: 12px; color: #3b82f6; font-weight: bold; white-space: nowrap;">${o.tipo || 'Não Definido'}</td>
                    <td style="padding: 12px; color: #10b981; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;" title="${o.motorista || '-'}">${o.motorista || '-'}</td>
                    <td style="padding: 12px; color: #cbd5e1; font-size: 0.85rem;">${o.problema || o.observacoes || 'Sem descrição.'}</td>
                </tr>
            `;
        }).join('');
    }

    const modalHtml = `
        <div id="modalRankingPlacaGerencial" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); z-index: 9999; display: flex; align-items: center; justify-content: center;">
            <div style="background: #1e293b; border: 1px solid #ef4444; border-radius: 12px; width: 95%; max-width: 1400px; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                
                <div style="padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; background: rgba(239,68,68,0.1); border-radius: 12px 12px 0 0;">
                    <h3 style="color: #fff; margin: 0; font-size: 1.2rem; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-truck-monster" style="color: #ef4444;"></i> Histórico de O.S. (Período Global) - <span style="color: #ef4444; font-weight: 900; font-size: 1.4rem;">${placaBusca}</span>
                    </h3>
                    <button onclick="document.getElementById('modalRankingPlacaGerencial').remove()" style="background: transparent; border: none; color: #94a3b8; font-size: 1.5rem; cursor: pointer; transition: 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#94a3b8'">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div style="padding: 20px; overflow-y: auto; flex: 1;" class="custom-scrollbar">
                    <table style="width: 100%; border-collapse: collapse; text-align: left;">
                        <thead style="background: rgba(0,0,0,0.3);">
                            <tr>
                                <th style="padding: 12px; color: #94a3b8; text-transform: uppercase; font-size: 0.8rem; font-weight: bold; white-space: nowrap;">Nº O.S</th>
                                <th style="padding: 12px; color: #94a3b8; text-transform: uppercase; font-size: 0.8rem; font-weight: bold; white-space: nowrap;">Abertura</th>
                                <th style="padding: 12px; color: #94a3b8; text-transform: uppercase; font-size: 0.8rem; font-weight: bold; white-space: nowrap;">Classificação</th>
                                <th style="padding: 12px; color: #94a3b8; text-transform: uppercase; font-size: 0.8rem; font-weight: bold; white-space: nowrap;">Motorista</th>
                                <th style="padding: 12px; color: #94a3b8; text-transform: uppercase; font-size: 0.8rem; font-weight: bold;">Descrição do Problema</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${htmlTabela}
                        </tbody>
                    </table>
                </div>
                
            </div>
        </div>
    `;

    const modalAntigo = document.getElementById('modalRankingPlacaGerencial');
    if (modalAntigo) modalAntigo.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.renderizarRankingMotoristas = function() {
    const container = document.getElementById('rankingMotoristasOS');
    if(!container) return;

    const os = window.ordensServico || [];
    const datas = window.getDatasFiltroGlobal ? window.getDatasFiltroGlobal() : { inicio: new Date(), fim: new Date() };
    const inicio = datas.inicio;
    const fim = datas.fim;
    
    const contagem = {};

    os.forEach(o => {
        if (o.inativa === 1 || o.inativa === '1' || o.inativa === true) return;
        if (!o.motorista || o.motorista.trim() === '-' || o.motorista.trim() === '') return;
        if (o.status === 'Agendada' || o.status === 'Cancelada' || o.tipo === 'Cavalo Disponível S/ Carreta') return;
        
        let dtAbertura = o.data_abertura ? window.corrigirDataSupabase(o.data_abertura) : null;
        if(!dtAbertura) return;
        
        if(dtAbertura >= inicio && dtAbertura <= fim) {
            const motorista = String(o.motorista).trim().toUpperCase();
            
            if (motorista.includes('N/A') || motorista.includes('APENAS GO') || motorista.includes('NAO INFORMADO')) return;
            
            contagem[motorista] = (contagem[motorista] || 0) + 1;
        }
    });

    const top5 = Object.entries(contagem).sort((a,b) => b[1] - a[1]).slice(0, 5);
    
    if(top5.length === 0) {
        container.innerHTML = '<p style="color:#94a3b8; text-align:center; padding: 20px;">Nenhum registro no período.</p>';
        return;
    }

    container.innerHTML = top5.map((item, index) => {
        const nome = item[0], qtd = item[1];
        let cor = index === 0 ? '#ef4444' : index === 1 ? '#f97316' : index === 2 ? '#facc15' : '#10b981';
        
        return `
        <div onclick="abrirModalHistoricoMotoristaGerencial('${nome.replace(/'/g, "\\'")}')" style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 12px 15px; margin-bottom: 8px; border-radius: 8px; border-left: 4px solid ${cor}; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(0,0,0,0.2)'" title="Clique para ver todas as O.S. abertas por este motorista">
            <div style="display: flex; align-items: center; gap: 10px; overflow: hidden;">
                <span style="font-size: 1.2rem; font-weight: bold; color: ${cor}; flex-shrink: 0;">#${index+1}</span>
                <span style="font-size: 0.95rem; font-weight: bold; color: white; white-space: normal; word-break: break-word;">${nome}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
                <div style="font-size: 1.2rem; font-weight: 900; color: white;">${qtd} <span style="font-size: 0.8rem; font-weight: normal; color: #94a3b8;">O.S.</span></div>
                <i class="fas fa-search-plus" style="color: ${cor}; opacity: 0.7;"></i>
            </div>
        </div>`;
    }).join('');
};

window.abrirModalHistoricoMotoristaGerencial = function(motoristaBusca) {
    const os = window.ordensServico || [];
    const datas = window.getDatasFiltroGlobal ? window.getDatasFiltroGlobal() : { inicio: new Date(), fim: new Date() };
    const inicio = datas.inicio;
    const fim = datas.fim;
    
    const historicoMotorista = os.filter(o => {
        if (o.inativa === 1 || o.inativa === '1' || o.inativa === true) return false;
        
        const mot = String(o.motorista || '').trim().toUpperCase();
        if (mot !== motoristaBusca.toUpperCase()) return false;
        if (o.status === 'Agendada' || o.status === 'Cancelada' || o.tipo === 'Cavalo Disponível S/ Carreta') return false;
        
        let dtAbertura = o.data_abertura ? window.corrigirDataSupabase(o.data_abertura) : null;
        if(!dtAbertura) return false;
        
        return (dtAbertura >= inicio && dtAbertura <= fim);
    }).sort((a, b) => window.corrigirDataSupabase(b.data_abertura) - window.corrigirDataSupabase(a.data_abertura)); 

    let htmlTabela = '';
    
    if (historicoMotorista.length === 0) {
        htmlTabela = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #94a3b8;">Nenhum dado encontrado para este motorista no período selecionado.</td></tr>';
    } else {
        htmlTabela = historicoMotorista.map(o => {
            let dataStr = '--/--/----';
            if (o.data_abertura) {
                const dt = window.corrigirDataSupabase(o.data_abertura);
                dataStr = `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')} - ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
            }
            
            return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.1);">
                    <td style="padding: 12px; color: #fff; font-weight: bold; white-space: nowrap;">#${o.numero_os || o.id}</td>
                    <td style="padding: 12px; color: #94a3b8; white-space: nowrap;">${dataStr}</td>
                    <td style="padding: 12px; color: #3b82f6; font-weight: bold; white-space: nowrap;">${o.tipo || 'Não Definido'}</td>
                    <td style="padding: 12px; color: #facc15; font-weight: bold; white-space: nowrap;">${o.placa || o.veiculo || o.cavalo || '-'}</td>
                    <td style="padding: 12px; color: #cbd5e1; font-size: 0.85rem;">${o.problema || o.observacoes || 'Sem descrição.'}</td>
                </tr>
            `;
        }).join('');
    }

    const modalHtml = `
        <div id="modalRankingMotoristaGerencial" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); z-index: 9999; display: flex; align-items: center; justify-content: center;">
            <div style="background: #1e293b; border: 1px solid #10b981; border-radius: 12px; width: 95%; max-width: 1400px; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                
                <div style="padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; background: rgba(16,185,129,0.1); border-radius: 12px 12px 0 0;">
                    <h3 style="color: #fff; margin: 0; font-size: 1.2rem; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-user-hard-hat" style="color: #10b981;"></i> O.S. Abertas pelo Motorista (Período Global) - <span style="color: #10b981; font-weight: 900; font-size: 1.4rem;">${motoristaBusca}</span>
                    </h3>
                    <button onclick="document.getElementById('modalRankingMotoristaGerencial').remove()" style="background: transparent; border: none; color: #94a3b8; font-size: 1.5rem; cursor: pointer; transition: 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#94a3b8'">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div style="padding: 20px; overflow-y: auto; flex: 1;" class="custom-scrollbar">
                    <table style="width: 100%; border-collapse: collapse; text-align: left;">
                        <thead style="background: rgba(0,0,0,0.3);">
                            <tr>
                                <th style="padding: 12px; color: #94a3b8; text-transform: uppercase; font-size: 0.8rem; font-weight: bold; white-space: nowrap;">Nº O.S</th>
                                <th style="padding: 12px; color: #94a3b8; text-transform: uppercase; font-size: 0.8rem; font-weight: bold; white-space: nowrap;">Abertura</th>
                                <th style="padding: 12px; color: #94a3b8; text-transform: uppercase; font-size: 0.8rem; font-weight: bold; white-space: nowrap;">Classificação</th>
                                <th style="padding: 12px; color: #94a3b8; text-transform: uppercase; font-size: 0.8rem; font-weight: bold; white-space: nowrap;">Veículo / Placa</th>
                                <th style="padding: 12px; color: #94a3b8; text-transform: uppercase; font-size: 0.8rem; font-weight: bold;">Descrição do Problema</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${htmlTabela}
                        </tbody>
                    </table>
                </div>
                
            </div>
        </div>
    `;

    const modalAntigo = document.getElementById('modalRankingMotoristaGerencial');
    if (modalAntigo) modalAntigo.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

// =================================================================
// FUNÇÕES DOS OUTROS PAINÉIS 
// =================================================================

window.preencherMesesDMDiaria = function() {
    const select = document.getElementById('filtroMesEvolucaoDMDiaria');
    if (!select || !ordensServico || !frotasManutencao) return;

    const cavalosValidos = frotasManutencao
        .filter(f => f.status === 'Ativo' && f.categoria && f.categoria.toUpperCase() === 'TRITREM')
        .map(f => f.cavalo);

    const mesesDisponiveis = new Set();
    const hoje = new Date();
    const mesAtualKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    ordensServico.forEach(os => {
        if (!os.placa || !cavalosValidos.includes(os.placa)) return; 
        if (os.data_abertura && os.status !== 'Agendada') {
            const data = window.corrigirDataSupabase(os.data_abertura);
            if (data && !isNaN(data.getTime())) {
                const ano = data.getFullYear();
                const mes = String(data.getMonth() + 1).padStart(2, '0');
                mesesDisponiveis.add(`${ano}-${mes}`);
            }
        }
    });

    mesesDisponiveis.add(mesAtualKey); 

    const mesesOrdenados = Array.from(mesesDisponiveis).sort((a, b) => b.localeCompare(a)); 
    const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    const optionsAtuais = Array.from(select.options).map(o => o.value).join(',');
    const novasOptions = mesesOrdenados.join(',');

    if (optionsAtuais !== novasOptions) {
        let html = '';
        mesesOrdenados.forEach(chave => {
            const [ano, mes] = chave.split('-');
            const nomeMes = nomesMeses[parseInt(mes) - 1];
            const label = `${nomeMes}/${ano.slice(2)}`;
            const isAtual = chave === mesAtualKey;
            html += `<option value="${chave}" ${isAtual ? 'selected' : ''}>${label}</option>`;
        });
        
        const valAnterior = select.value;
        select.innerHTML = html;
        if (valAnterior && mesesOrdenados.includes(valAnterior)) {
            select.value = valAnterior;
        }
    }
}

window.preencherMesesDMDiariaGrua = function() {
    const select = document.getElementById('filtroMesEvolucaoDMDiariaGrua');
    if (!select || !ordensServico || !frotasManutencao) return;

    const cavalosValidos = frotasManutencao
        .filter(f => f.status === 'Ativo' && f.categoria && f.categoria.toUpperCase() === 'GRUA')
        .map(f => f.cavalo);

    const mesesDisponiveis = new Set();
    const hoje = new Date();
    const mesAtualKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    ordensServico.forEach(os => {
        if (!os.placa || !cavalosValidos.includes(os.placa)) return; 
        if (os.data_abertura && os.status !== 'Agendada') {
            const data = window.corrigirDataSupabase(os.data_abertura);
            if (data && !isNaN(data.getTime())) {
                const ano = data.getFullYear();
                const mes = String(data.getMonth() + 1).padStart(2, '0');
                mesesDisponiveis.add(`${ano}-${mes}`);
            }
        }
    });

    mesesDisponiveis.add(mesAtualKey); 

    const mesesOrdenados = Array.from(mesesDisponiveis).sort((a, b) => b.localeCompare(a)); 
    const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    const optionsAtuais = Array.from(select.options).map(o => o.value).join(',');
    const novasOptions = mesesOrdenados.join(',');

    if (optionsAtuais !== novasOptions) {
        let html = '';
        mesesOrdenados.forEach(chave => {
            const [ano, mes] = chave.split('-');
            const nomeMes = nomesMeses[parseInt(mes) - 1];
            const label = `${nomeMes}/${ano.slice(2)}`;
            const isAtual = chave === mesAtualKey;
            html += `<option value="${chave}" ${isAtual ? 'selected' : ''}>${label}</option>`;
        });
        
        const valAnterior = select.value;
        select.innerHTML = html;
        if (valAnterior && mesesOrdenados.includes(valAnterior)) {
            select.value = valAnterior;
        }
    }
}

window.renderizarGraficoEvolucaoDM = function() {
    try {
        if (!frotasManutencao || frotasManutencao.length === 0) return;
        
        const agora = new Date();
        let dataBase = new Date(); 
        let ehHoje = true;

        const labelsX = [];
        const dadosLinhaDM = [];

        const msPorHora = 60 * 60 * 1000;
        
        let horaLimite = 23;
        if (ehHoje) {
            horaLimite = agora.getHours();
        }

        for (let i = 0; i <= horaLimite; i++) {
            const inicioHora = new Date(dataBase.getFullYear(), dataBase.getMonth(), dataBase.getDate(), i, 0, 0, 0);
            const fimHora = new Date(dataBase.getFullYear(), dataBase.getMonth(), dataBase.getDate(), i, 59, 59, 999);
            
            let totalMsDisponivelNestaHora = 0;
            let msManutencaoNestaHora = 0;
            
            frotasManutencao.forEach(frota => {
                if(frota.status !== 'Ativo' || !frota.categoria || frota.categoria.toUpperCase() !== 'TRITREM') return;
                
                let frotaInicioStr = frota.data_inicial ? frota.data_inicial : '2026-04-01';
                let dtEntradaVeiculo = new Date(frotaInicioStr + 'T00:00:00');
                
                let overlapDispInicio = dtEntradaVeiculo > inicioHora ? dtEntradaVeiculo : inicioHora;
                if (overlapDispInicio < fimHora) {
                    totalMsDisponivelNestaHora += (fimHora - overlapDispInicio);
                }
                
                let manutencaoCavalo = 0;
                const todasOSCavalo = ordensServico.filter(o => o.placa === frota.cavalo && o.status !== 'Agendada' && o.tipo !== 'Cavalo Disponível S/ Carreta');
                
                todasOSCavalo.forEach(os => {
                    const osInicio = window.corrigirDataSupabase(os.data_abertura);
                    if (!osInicio) return;
                    
                    let osFim = os.data_conclusao ? window.corrigirDataSupabase(os.data_conclusao) : agora;
                    
                    let inicioValido = osInicio > dtEntradaVeiculo ? osInicio : dtEntradaVeiculo;
                    const overlapInicio = inicioValido > inicioHora ? inicioValido : inicioHora;
                    const overlapFim = osFim < fimHora ? osFim : fimHora;

                    if (overlapInicio < overlapFim) {
                        manutencaoCavalo += (overlapFim - overlapInicio);
                    }
                });
                
                if (manutencaoCavalo > msPorHora) manutencaoCavalo = msPorHora;
                msManutencaoNestaHora += manutencaoCavalo;
            });
            
            let dispNestaHora = totalMsDisponivelNestaHora - msManutencaoNestaHora;
            if(dispNestaHora < 0) dispNestaHora = 0;
            
            let percentDM = totalMsDisponivelNestaHora > 0 ? (dispNestaHora / totalMsDisponivelNestaHora) * 100 : 100;

            labelsX.push(`${String(i).padStart(2,'0')}:00`);
            dadosLinhaDM.push(percentDM.toFixed(2));
        }

        if (typeof echarts === 'undefined') return;
        const chartDomLinha = document.getElementById('graficoEvolucaoDM');
        if (chartDomLinha) {
            let myChartLinha = echarts.getInstanceByDom(chartDomLinha);
            if (!myChartLinha) myChartLinha = echarts.init(chartDomLinha);

            const optionLinha = {
                backgroundColor: 'transparent',
                tooltip: { trigger: 'axis', formatter: '{b} <br/> DM Geral: {c}%' },
                grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                xAxis: {
                    type: 'category',
                    boundaryGap: false,
                    data: labelsX,
                    axisLabel: { color: '#ffffff', fontWeight: 'bold' }
                },
                yAxis: {
                    type: 'value',
                    min: 0,
                    max: 100,
                    axisLabel: { formatter: '{value}%', color: '#ffffff', fontWeight: 'bold' },
                    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
                },
                series: [{
                    name: 'DM Horária',
                    type: 'line',
                    data: dadosLinhaDM,
                    smooth: true,
                    label: {
                        show: true, position: 'top', formatter: '{c}%', color: '#e2e8f0', fontSize: 13, fontWeight: 'bold'
                    },
                    itemStyle: { color: '#3b82f6' },
                    lineStyle: { width: 4 },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(59, 130, 246, 0.4)' },
                            { offset: 1, color: 'rgba(59, 130, 246, 0)' }
                        ])
                    }
                }]
            };

            myChartLinha.setOption(optionLinha);
            window.addEventListener('resize', () => myChartLinha.resize());
        }
    } catch(e) {
        console.error("Erro na DM Evolução Diária:", e);
    }
}

window.renderizarGraficoStatusFrotaHorario = function() {
    try {
        if (!frotasManutencao || frotasManutencao.length === 0) return;
        
        const agora = new Date();
        let dataBase = new Date(); 
        let ehHoje = true;

        const inputData = document.getElementById('filtroDataEspecificaHoraria');
        if (inputData && inputData.value) {
            const partesData = inputData.value.split('-');
            if(partesData.length === 3) {
                dataBase = new Date(partesData[0], partesData[1] - 1, partesData[2]);
                ehHoje = (dataBase.getDate() === agora.getDate() && 
                          dataBase.getMonth() === agora.getMonth() && 
                          dataBase.getFullYear() === agora.getFullYear());
            }
        } else if (inputData && !inputData.value) {
            const mesStr = String(agora.getMonth() + 1).padStart(2, '0');
            const diaStr = String(agora.getDate()).padStart(2, '0');
            inputData.value = `${agora.getFullYear()}-${mesStr}-${diaStr}`;
        }

        const labelsX = [];
        const dadosBarraAtivos = [];
        const dadosBarraManut = [];
        const dadosBarraSOS = [];
        const dadosBarraGruaDisp = []; 

        let horaLimite = 23;
        if (ehHoje) {
            horaLimite = agora.getHours();
        }

        for (let i = 0; i <= horaLimite; i++) {
            const inicioHora = new Date(dataBase.getFullYear(), dataBase.getMonth(), dataBase.getDate(), i, 0, 0, 0);
            const fimHora = new Date(dataBase.getFullYear(), dataBase.getMonth(), dataBase.getDate(), i, 59, 59, 999);
            
            let qtdFrotaAtivaHora = 0;
            let qtdEmManutencao = 0;
            let qtdEmSOS = 0;
            
            let qtdGruaDisp = 0;
            
            frotasManutencao.forEach(frota => {
                if(frota.status !== 'Ativo' || !frota.categoria) return;
                const cat = frota.categoria.toUpperCase();
                if(cat !== 'TRITREM' && cat !== 'GRUA') return;
                
                let frotaInicioStr = frota.data_inicial ? frota.data_inicial : '2026-04-01';
                let dtEntradaVeiculo = new Date(frotaInicioStr + 'T00:00:00');
                if (dtEntradaVeiculo > fimHora) return;
                
                let teveManutencaoComum = false;
                let teveSOS = false;

                const todasOSCavalo = ordensServico.filter(o => o.placa === frota.cavalo && o.tipo !== 'Cavalo Disponível S/ Carreta');
                
                todasOSCavalo.forEach(os => {
                    const osInicio = window.corrigirDataSupabase(os.data_abertura);
                    if (!osInicio) return;
                    
                    let osFim = os.data_conclusao ? window.corrigirDataSupabase(os.data_conclusao) : agora;
                    
                    let inicioValido = osInicio > dtEntradaVeiculo ? osInicio : dtEntradaVeiculo;
                    const overlapInicio = inicioValido > inicioHora ? inicioValido : inicioHora;
                    const overlapFim = osFim < fimHora ? osFim : fimHora;

                    if (overlapInicio < overlapFim && os.status !== 'Agendada') {
                        const tipoOS = (os.tipo || os.tipo_manutencao || '').toUpperCase();
                        const descOS = (os.descricao || '').toUpperCase();
                        const prioridadeOS = (os.prioridade || '').toUpperCase();

                        if (
                            tipoOS.includes('S.O.S') || tipoOS.includes('SOS') || tipoOS.includes('SOCORRO') ||
                            descOS.includes('S.O.S') || descOS.includes('SOS') || descOS.includes('SOCORRO') ||
                            prioridadeOS.includes('EMERGÊNCIA')
                        ) {
                            teveSOS = true;
                        } else {
                            teveManutencaoComum = true;
                        }
                    }
                });

                if (cat === 'TRITREM') {
                    qtdFrotaAtivaHora++;
                    if (teveSOS) {
                        qtdEmSOS++;
                    } else if (teveManutencaoComum) {
                        qtdEmManutencao++;
                    }
                } else if (cat === 'GRUA') {
                    if (!teveSOS && !teveManutencaoComum) {
                        qtdGruaDisp++;
                    }
                }
            });

            let qtdAtivos = qtdFrotaAtivaHora - qtdEmManutencao - qtdEmSOS;
            if (qtdAtivos < 0) qtdAtivos = 0;

            labelsX.push(`${String(i).padStart(2,'0')}:00`);
            dadosBarraAtivos.push(qtdAtivos);
            dadosBarraManut.push(qtdEmManutencao);
            dadosBarraSOS.push(qtdEmSOS);
            dadosBarraGruaDisp.push(qtdGruaDisp);
        }
        
        let msTotalDiaCalc = 24 * 60 * 60 * 1000;
        let inicioDiaCalc = new Date(dataBase.getFullYear(), dataBase.getMonth(), dataBase.getDate(), 0, 0, 0, 0);
        let fimParaCalculoTotal = new Date(dataBase.getFullYear(), dataBase.getMonth(), dataBase.getDate(), 23, 59, 59, 999);
        
        if (ehHoje) {
            msTotalDiaCalc = agora - inicioDiaCalc;
            fimParaCalculoTotal = agora;
        }
        
        if (msTotalDiaCalc > 0) {
            let totalMsDisponivelDia = 0;
            let msManutencaoComumDia = 0;
            let msSOSDia = 0;
            
            let totalVeiculosManutencaoDia = 0;
            let totalVeiculosSOSDia = 0;

            let totalMsDisponivelDiaGrua = 0;
            let msManutencaoGruaDia = 0;
            
            frotasManutencao.forEach(frota => {
                if(frota.status !== 'Ativo' || !frota.categoria) return;
                const cat = frota.categoria.toUpperCase();
                if(cat !== 'TRITREM' && cat !== 'GRUA') return;
                
                let frotaInicioStr = frota.data_inicial ? frota.data_inicial : '2026-04-01';
                let dtEntradaVeiculo = new Date(frotaInicioStr + 'T00:00:00');
                
                let overlapDispInicio = dtEntradaVeiculo > inicioDiaCalc ? dtEntradaVeiculo : inicioDiaCalc;
                let tempoDisp = 0;
                if (overlapDispInicio < fimParaCalculoTotal) {
                    tempoDisp = (fimParaCalculoTotal - overlapDispInicio);
                }

                let manutComumCavalo = 0;
                let sosCavalo = 0;
                const todasOSCavalo = ordensServico.filter(o => o.placa === frota.cavalo && o.status !== 'Agendada' && o.tipo !== 'Cavalo Disponível S/ Carreta');
                
                todasOSCavalo.forEach(os => {
                    const osInicio = window.corrigirDataSupabase(os.data_abertura);
                    if (!osInicio) return;
                    
                    let osFim = os.data_conclusao ? window.corrigirDataSupabase(os.data_conclusao) : agora;
                    
                    let inicioValido = osInicio > dtEntradaVeiculo ? osInicio : dtEntradaVeiculo;
                    const overlapInicio = inicioValido > inicioDiaCalc ? inicioValido : inicioDiaCalc;
                    const overlapFim = osFim < fimParaCalculoTotal ? osFim : fimParaCalculoTotal;

                    if (overlapInicio < overlapFim) {
                        const tipoOS = (os.tipo || os.tipo_manutencao || '').toUpperCase();
                        const descOS = (os.descricao || '').toUpperCase();
                        const prioridadeOS = (os.prioridade || '').toUpperCase();

                        if (
                            tipoOS.includes('S.O.S') || tipoOS.includes('SOS') || tipoOS.includes('SOCORRO') ||
                            descOS.includes('S.O.S') || descOS.includes('SOS') || descOS.includes('SOCORRO') ||
                            prioridadeOS.includes('EMERGÊNCIA')
                        ) {
                            sosCavalo += (overlapFim - overlapInicio);
                        } else {
                            manutComumCavalo += (overlapFim - overlapInicio);
                        }
                    }
                });
                
                if (manutComumCavalo + sosCavalo > msTotalDiaCalc) {
                    let proporcao = msTotalDiaCalc / (manutComumCavalo + sosCavalo);
                    manutComumCavalo *= proporcao;
                    sosCavalo *= proporcao;
                }

                if (cat === 'TRITREM') {
                    totalMsDisponivelDia += tempoDisp;
                    msManutencaoComumDia += manutComumCavalo;
                    msSOSDia += sosCavalo;
                    
                    if (manutComumCavalo > 0) totalVeiculosManutencaoDia++;
                    if (sosCavalo > 0) totalVeiculosSOSDia++;
                } else if (cat === 'GRUA') {
                    totalMsDisponivelDiaGrua += tempoDisp;
                    msManutencaoGruaDia += (manutComumCavalo + sosCavalo);
                }
            });
            
            let msManutTotal = msManutencaoComumDia + msSOSDia;
            let dispNoDiaMs = totalMsDisponivelDia - msManutTotal;
            if (dispNoDiaMs < 0) dispNoDiaMs = 0;
            
            let dispNoDiaMsGrua = totalMsDisponivelDiaGrua - msManutencaoGruaDia;
            if (dispNoDiaMsGrua < 0) dispNoDiaMsGrua = 0;
            
            const mediaAtivosReal = Math.round(dispNoDiaMs / msTotalDiaCalc);
            const mediaAtivosGruaReal = Math.round(dispNoDiaMsGrua / msTotalDiaCalc);
            
            const elAvgAtivosInterno = document.getElementById('avgAtivosInterno');
            const elAvgManutInterno = document.getElementById('avgManutInterno');
            const elAvgSOSInterno = document.getElementById('avgSOSInterno');
            
            if(elAvgAtivosInterno) {
                elAvgAtivosInterno.innerText = mediaAtivosReal;
                
                let cardCaminhoes = elAvgAtivosInterno.closest('div[style*="min-width: 200px"]'); 
                if (cardCaminhoes && cardCaminhoes.parentElement) {
                    let mainRowContainer = cardCaminhoes.parentElement;
                    let cardGrua = document.getElementById('cardGruaMediaInterno');
                    
                    if (!cardGrua) {
                        cardGrua = document.createElement('div');
                        cardGrua.id = 'cardGruaMediaInterno';
                        cardGrua.style.cssText = "display: flex; align-items: center; gap: 12px; background: rgba(59, 130, 246, 0.05); padding: 10px 20px; border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.2); flex: 1; min-width: 200px; justify-content: center;";
                        cardGrua.innerHTML = `
                            <div style="background: rgba(59, 130, 246, 0.2); padding: 12px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                <i class="fas fa-truck-loading" style="color: #3b82f6; font-size: 1.4rem;"></i>
                            </div>
                            <div style="display: flex; flex-direction: column;">
                                <span style="color: #94a3b8; font-size: 0.8rem; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Média Gruas Disp.</span>
                                <div style="display: flex; align-items: baseline; gap: 4px;">
                                    <span id="avgGruasInterno" style="color: #3b82f6; font-size: 1.8rem; font-weight: 900; line-height: 1;">0</span>
                                    <span style="color: #64748b; font-size: 0.8rem; font-weight: 600;">gruas</span>
                                </div>
                            </div>
                        `;
                        mainRowContainer.insertBefore(cardGrua, cardCaminhoes.nextSibling); 
                    }
                    
                    const spanGrua = document.getElementById('avgGruasInterno');
                    if (spanGrua) spanGrua.innerText = mediaAtivosGruaReal;
                }
            }
            
            if(elAvgManutInterno) {
                elAvgManutInterno.innerText = totalVeiculosManutencaoDia;
                try {
                    let container = elAvgManutInterno.parentElement;
                    if (container) {
                        let nodes = container.childNodes;
                        for (let i = 0; i < nodes.length; i++) {
                            if (nodes[i].nodeType === Node.TEXT_NODE && nodes[i].nodeValue.includes('Média')) {
                                nodes[i].nodeValue = nodes[i].nodeValue.replace('Média Manutenção', 'Total Manutenção').replace('Média Manut.', 'Total Manut.');
                            }
                        }
                    }
                } catch(e) {}
            }
            
            if(elAvgSOSInterno) {
                elAvgSOSInterno.innerText = totalVeiculosSOSDia;
                try {
                    let container = elAvgSOSInterno.parentElement;
                    if (container) {
                        let nodes = container.childNodes;
                        for (let i = 0; i < nodes.length; i++) {
                            if (nodes[i].nodeType === Node.TEXT_NODE && nodes[i].nodeValue.includes('Média')) {
                                nodes[i].nodeValue = nodes[i].nodeValue.replace('Média S.O.S', 'Total S.O.S').replace('Média SOS', 'Total SOS');
                            }
                        }
                    }
                } catch(e) {}
            }
        }

        if (typeof echarts === 'undefined') return;
        const chartDomBarras = document.getElementById('graficoStatusFrotaHorario');
        if (chartDomBarras) {
            let myChartBarras = echarts.getInstanceByDom(chartDomBarras);
            if (!myChartBarras) myChartBarras = echarts.init(chartDomBarras);

            const optionBarras = {
                backgroundColor: 'transparent',
                tooltip: { 
                    trigger: 'axis', 
                    axisPointer: { type: 'shadow' } 
                },
                legend: { 
                    data: ['Disponível', 'Manutenção', 'SOS', 'GRUA Disp.'], 
                    textStyle: { color: '#ffffff', fontWeight: 'bold' }, 
                    top: 0 
                },
                grid: { 
                    top: '15%', left: '3%', right: '3%', bottom: '5%', containLabel: true 
                },
                xAxis: { 
                    type: 'category', 
                    data: labelsX, 
                    axisLabel: { color: '#ffffff', fontWeight: 'bold' } 
                },
                yAxis: { 
                    type: 'value', 
                    name: 'Quantidade de Veículos',
                    nameTextStyle: { color: '#ffffff', padding: [0, 0, 0, 50], fontWeight: 'bold', fontSize: 13 },
                    axisLabel: { color: '#ffffff', fontWeight: 'bold' }, 
                    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } 
                },
                series: [
                    { 
                        name: 'Disponível', 
                        type: 'bar', 
                        itemStyle: { color: '#10b981' }, 
                        data: dadosBarraAtivos,
                        label: { show: true, position: 'top', color: '#10b981', fontWeight: 'bold', formatter: (p) => p.value > 0 ? p.value : '', fontSize: 12 }
                    },
                    { 
                        name: 'Manutenção', 
                        type: 'bar', 
                        itemStyle: { color: '#f59e0b' }, 
                        data: dadosBarraManut,
                        label: { show: true, position: 'top', color: '#f59e0b', fontWeight: 'bold', formatter: (p) => p.value > 0 ? p.value : '', fontSize: 12 }
                    },
                    { 
                        name: 'SOS', 
                        type: 'bar', 
                        itemStyle: { color: '#ef4444' }, 
                        data: dadosBarraSOS,
                        label: { show: true, position: 'top', color: '#ef4444', fontWeight: 'bold', formatter: (p) => p.value > 0 ? p.value : '', fontSize: 12 }
                    },
                    { 
                        name: 'GRUA Disp.', 
                        type: 'bar', 
                        itemStyle: { color: '#3b82f6' }, 
                        data: dadosBarraGruaDisp,
                        label: { show: true, position: 'top', color: '#3b82f6', fontWeight: 'bold', formatter: (p) => p.value > 0 ? p.value : '', fontSize: 12 }
                    }
                ]
            };

            myChartBarras.setOption(optionBarras);
            window.addEventListener('resize', () => myChartBarras.resize());
        }
    } catch(e) {
        console.error("Erro na DM Status Frota Horário:", e);
    }
}

window.renderizarGraficoEvolucaoDMDiaria = function() {
    try {
        if (!frotasManutencao || frotasManutencao.length === 0) return;
        
        if (typeof window.preencherMesesDMDiaria === 'function') {
            window.preencherMesesDMDiaria();
        }

        const cavalosValidos = frotasManutencao
            .filter(f => f.status === 'Ativo' && f.categoria && f.categoria.toUpperCase() === 'TRITREM')
            .map(f => f.cavalo);

        const selectMes = document.getElementById('filtroMesEvolucaoDMDiaria');
        let dataInicio, hoje;

        if (selectMes && selectMes.value) {
            const [ano, mes] = selectMes.value.split('-');
            dataInicio = new Date(parseInt(ano), parseInt(mes) - 1, 1, 0, 0, 0);
            hoje = new Date(parseInt(ano), parseInt(mes), 0, 23, 59, 59, 999);

            const agora = new Date();
            if (dataInicio.getFullYear() === agora.getFullYear() && dataInicio.getMonth() === agora.getMonth()) {
                hoje = agora;
            }
        } else {
            const filtroVal = window.getDatasFiltroGlobal ? window.getDatasFiltroGlobal().valorBruto : 'mes_atual';
            hoje = new Date();
            hoje.setHours(23, 59, 59, 999);
            
            dataInicio = new Date(hoje);
            dataInicio.setHours(0, 0, 0, 0);

            if (filtroVal === 'dia_atual') {
            } else if (filtroVal === 'semana_atual') {
                const diaSemana = dataInicio.getDay(); 
                dataInicio.setDate(dataInicio.getDate() - diaSemana);
            } else if (filtroVal === 'mes_atual') {
                dataInicio.setDate(1); 
            } else if (filtroVal === '7') {
                dataInicio.setDate(dataInicio.getDate() - 6); 
            } else {
                let d = parseInt(filtroVal);
                if(isNaN(d)) d = 30;
                dataInicio.setDate(dataInicio.getDate() - d + 1);
            }
        }

        const labelsDias = [];
        const dadosDMDiaria = [];
        let atual = new Date(dataInicio);
        
        while (atual <= hoje) {
            const inicioDia = new Date(atual.getFullYear(), atual.getMonth(), atual.getDate(), 0, 0, 0);
            const fimDia = new Date(atual.getFullYear(), atual.getMonth(), atual.getDate(), 23, 59, 59, 999);
            
            let msTotalDia = 24 * 60 * 60 * 1000;
            let fimParaCalculo = fimDia;
            const ehHoje = (atual.toDateString() === new Date().toDateString());

            if (ehHoje) {
                const agora = new Date();
                msTotalDia = agora - inicioDia;
                fimParaCalculo = agora;
            }

            if (msTotalDia > 0) {
                let qtdFrotaDia = 0;
                let totalMsDisponivelDia = 0;
                let msManutencaoDia = 0;
                
                frotasManutencao.forEach(frota => {
                    if(frota.status !== 'Ativo' || !frota.categoria || frota.categoria.toUpperCase() !== 'TRITREM') return;
                    
                    let frotaInicioStr = frota.data_inicial ? frota.data_inicial : '2026-04-01';
                    let dtEntradaVeiculo = new Date(frotaInicioStr + 'T00:00:00');
                    
                    let overlapDispInicio = dtEntradaVeiculo > inicioDia ? dtEntradaVeiculo : inicioDia;
                    if (overlapDispInicio < fimParaCalculo) {
                        totalMsDisponivelDia += (fimParaCalculo - overlapDispInicio);
                        qtdFrotaDia++;
                    }

                    let manutencaoCavalo = 0;
                    const todasOSCavalo = ordensServico.filter(o => o.placa === frota.cavalo && o.status !== 'Agendada' && o.tipo !== 'Cavalo Disponível S/ Carreta');
                    
                    todasOSCavalo.forEach(os => {
                        const osInicio = window.corrigirDataSupabase(os.data_abertura);
                        if (!osInicio) return;
                        
                        let osFim = os.data_conclusao ? window.corrigirDataSupabase(os.data_conclusao) : new Date();
                        
                        let inicioValido = osInicio > dtEntradaVeiculo ? osInicio : dtEntradaVeiculo;
                        const overlapInicio = inicioValido > inicioDia ? inicioValido : inicioDia;
                        const overlapFim = osFim < fimParaCalculo ? osFim : fimParaCalculo;

                        if (overlapInicio < overlapFim) {
                            manutencaoCavalo += (overlapFim - overlapInicio);
                        }
                    });

                    if (manutencaoCavalo > msTotalDia) manutencaoCavalo = msTotalDia;
                    msManutencaoDia += manutencaoCavalo;
                });

                let dispNoDiaMs = totalMsDisponivelDia - msManutencaoDia;
                if (dispNoDiaMs < 0) dispNoDiaMs = 0;

                let percentDM = totalMsDisponivelDia > 0 ? (dispNoDiaMs / totalMsDisponivelDia) * 100 : 100;
                let mediaCavalosDisp = msTotalDia > 0 ? Math.round(dispNoDiaMs / msTotalDia) : 0;

                const diaStr = String(atual.getDate()).padStart(2, '0') + '/' + String(atual.getMonth() + 1).padStart(2, '0');
                labelsDias.push(diaStr);
                
                dadosDMDiaria.push({
                    value: percentDM.toFixed(2),
                    disp: mediaCavalosDisp,
                    total: qtdFrotaDia 
                });
            }
            
            atual.setDate(atual.getDate() + 1);
        }

        let somaDM = 0;
        dadosDMDiaria.forEach(d => somaDM += parseFloat(d.value));
        let mediaDM = dadosDMDiaria.length > 0 ? (somaDM / dadosDMDiaria.length).toFixed(1) : 0;

        let totalOSMes = 0;
        let concluidasOSMes = 0;
        let tempoTotalMs = 0;
        let osComTempo = 0;

        ordensServico.forEach(os => {
            if (!os.placa || !cavalosValidos.includes(os.placa)) return; 
            if (os.status === 'Agendada') return;
            
            const dtAbertura = window.corrigirDataSupabase(os.data_abertura);
            if (!dtAbertura) return;
            
            let dtConclusao = os.data_conclusao ? window.corrigirDataSupabase(os.data_conclusao) : new Date();

            if (dtAbertura <= hoje && dtConclusao >= dataInicio) {
                totalOSMes++;
                if (os.status === 'Concluída' || os.status === 'Resolvido') {
                    concluidasOSMes++;
                    if (os.data_conclusao) {
                        tempoTotalMs += (dtConclusao - dtAbertura);
                        osComTempo++;
                    }
                }
            }
        });

        let tempoMedioStr = '0h 0m';
        if (osComTempo > 0) {
            let mediaMs = tempoTotalMs / osComTempo;
            let mediaHoras = Math.floor(mediaMs / (1000 * 60 * 60));
            let mediaMinutos = Math.floor((mediaMs % (1000 * 60 * 60)) / (1000 * 60));
            tempoMedioStr = `${mediaHoras}h ${mediaMinutos}m`;
        }

        const elKpiMiniDM = document.getElementById('kpiMiniDM');
        const elKpiMiniTotal = document.getElementById('kpiMiniTotalOS');
        const elKpiMiniConcluidas = document.getElementById('kpiMiniConcluidas');
        const elKpiMiniTempo = document.getElementById('kpiMiniTempo');

        if(elKpiMiniDM) elKpiMiniDM.innerText = mediaDM + '%';
        if(elKpiMiniTotal) elKpiMiniTotal.innerText = totalOSMes;
        if(elKpiMiniConcluidas) elKpiMiniConcluidas.innerText = concluidasOSMes;
        if(elKpiMiniTempo) elKpiMiniTempo.innerText = tempoMedioStr;
        
        if (typeof echarts === 'undefined') return;
        const chartDom = document.getElementById('graficoEvolucaoDMDiaria');
        if (chartDom) {
            let myChart = echarts.getInstanceByDom(chartDom);
            if (!myChart) myChart = echarts.init(chartDom);

            const option = {
                backgroundColor: 'transparent',
                tooltip: { 
                    trigger: 'axis', 
                    formatter: function (params) {
                        const d = params[0].data;
                        return `<b style="font-size:14px; border-bottom:1px solid #444; padding-bottom:4px; display:block; margin-bottom:4px;">${params[0].name}</b>` +
                               `Média Disponíveis: <span style="color:#10b981; font-weight:bold;">${d.disp}</span> / ${d.total} veículos<br/>` +
                               `Índice DM: <span style="color:#10b981; font-weight:bold;">${d.value}%</span>`;
                    }
                },
                grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                xAxis: {
                    type: 'category',
                    boundaryGap: false,
                    data: labelsDias,
                    axisLabel: { color: '#ffffff', fontWeight: 'bold' }
                },
                yAxis: {
                    type: 'value',
                    min: 0,
                    max: 100,
                    axisLabel: { formatter: '{value}%', color: '#ffffff', fontWeight: 'bold' },
                    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
                },
                series: [{
                    name: 'Média DM Diária',
                    type: 'line',
                    data: dadosDMDiaria,
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: 8,
                    label: {
                        show: true,
                        position: 'top',
                        formatter: function (params) {
                            return `${params.data.disp}/${params.data.total}\n(${params.data.value}%)`;
                        },
                        color: '#ffffff',
                        fontSize: 14,
                        fontWeight: '900',
                        align: 'center',
                        lineHeight: 18,
                        textBorderColor: 'rgba(0, 0, 0, 0.8)',
                        textBorderWidth: 3
                    },
                    itemStyle: { color: '#10b981' }, 
                    lineStyle: { width: 4 },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(16, 185, 129, 0.4)' },
                            { offset: 1, color: 'rgba(16, 185, 129, 0)' }
                        ])
                    }
                }]
            };

            myChart.setOption(option);
            window.removeEventListener('resize', myChart.resize);
            window.addEventListener('resize', () => myChart.resize());
        }
    } catch(e) {
        console.error("Erro na DM Evolução Diária Geral:", e);
    }
}

window.renderizarGraficoEvolucaoDMDiariaGrua = function() {
    try {
        if (!frotasManutencao || frotasManutencao.length === 0) return;
        
        if (typeof window.preencherMesesDMDiariaGrua === 'function') {
            window.preencherMesesDMDiariaGrua();
        }

        const cavalosValidos = frotasManutencao
            .filter(f => f.status === 'Ativo' && f.categoria && f.categoria.toUpperCase() === 'GRUA')
            .map(f => f.cavalo);

        const selectMes = document.getElementById('filtroMesEvolucaoDMDiariaGrua');
        let dataInicio, hoje;

        if (selectMes && selectMes.value) {
            const [ano, mes] = selectMes.value.split('-');
            dataInicio = new Date(parseInt(ano), parseInt(mes) - 1, 1, 0, 0, 0);
            hoje = new Date(parseInt(ano), parseInt(mes), 0, 23, 59, 59, 999);

            const agora = new Date();
            if (dataInicio.getFullYear() === agora.getFullYear() && dataInicio.getMonth() === agora.getMonth()) {
                hoje = agora;
            }
        } else {
            const filtroVal = window.getDatasFiltroGlobal ? window.getDatasFiltroGlobal().valorBruto : 'mes_atual';
            hoje = new Date();
            hoje.setHours(23, 59, 59, 999);
            
            dataInicio = new Date(hoje);
            dataInicio.setHours(0, 0, 0, 0);

            if (filtroVal === 'dia_atual') {
            } else if (filtroVal === 'semana_atual') {
                const diaSemana = dataInicio.getDay(); 
                dataInicio.setDate(dataInicio.getDate() - diaSemana);
            } else if (filtroVal === 'mes_atual') {
                dataInicio.setDate(1); 
            } else if (filtroVal === '7') {
                dataInicio.setDate(dataInicio.getDate() - 6); 
            } else {
                let d = parseInt(filtroVal);
                if(isNaN(d)) d = 30;
                dataInicio.setDate(dataInicio.getDate() - d + 1);
            }
        }

        const labelsDias = [];
        const dadosDMDiaria = [];
        let atual = new Date(dataInicio);
        
        while (atual <= hoje) {
            const inicioDia = new Date(atual.getFullYear(), atual.getMonth(), atual.getDate(), 0, 0, 0);
            const fimDia = new Date(atual.getFullYear(), atual.getMonth(), atual.getDate(), 23, 59, 59, 999);
            
            let msTotalDia = 24 * 60 * 60 * 1000;
            let fimParaCalculo = fimDia;
            const ehHoje = (atual.toDateString() === new Date().toDateString());

            if (ehHoje) {
                const agora = new Date();
                msTotalDia = agora - inicioDia;
                fimParaCalculo = agora;
            }

            if (msTotalDia > 0) {
                let qtdFrotaDia = 0;
                let totalMsDisponivelDia = 0;
                let msManutencaoDia = 0;
                
                frotasManutencao.forEach(frota => {
                    if(frota.status !== 'Ativo' || !frota.categoria || frota.categoria.toUpperCase() !== 'GRUA') return;
                    
                    let frotaInicioStr = frota.data_inicial ? frota.data_inicial : '2026-04-01';
                    let dtEntradaVeiculo = new Date(frotaInicioStr + 'T00:00:00');
                    
                    let overlapDispInicio = dtEntradaVeiculo > inicioDia ? dtEntradaVeiculo : inicioDia;
                    if (overlapDispInicio < fimParaCalculo) {
                        totalMsDisponivelDia += (fimParaCalculo - overlapDispInicio);
                        qtdFrotaDia++;
                    }

                    let manutencaoCavalo = 0;
                    const todasOSCavalo = ordensServico.filter(o => o.placa === frota.cavalo && o.status !== 'Agendada' && o.tipo !== 'Cavalo Disponível S/ Carreta');
                    
                    todasOSCavalo.forEach(os => {
                        const osInicio = window.corrigirDataSupabase(os.data_abertura);
                        if (!osInicio) return;
                        
                        let osFim = os.data_conclusao ? window.corrigirDataSupabase(os.data_conclusao) : new Date();
                        
                        let inicioValido = osInicio > dtEntradaVeiculo ? osInicio : dtEntradaVeiculo;
                        const overlapInicio = inicioValido > inicioDia ? inicioValido : inicioDia;
                        const overlapFim = osFim < fimParaCalculo ? osFim : fimParaCalculo;

                        if (overlapInicio < overlapFim) {
                            manutencaoCavalo += (overlapFim - overlapInicio);
                        }
                    });

                    if (manutencaoCavalo > msTotalDia) manutencaoCavalo = msTotalDia;
                    msManutencaoDia += manutencaoCavalo;
                });

                let dispNoDiaMs = totalMsDisponivelDia - msManutencaoDia;
                if (dispNoDiaMs < 0) dispNoDiaMs = 0;

                let percentDM = totalMsDisponivelDia > 0 ? (dispNoDiaMs / totalMsDisponivelDia) * 100 : 100;
                let mediaCavalosDisp = msTotalDia > 0 ? Math.round(dispNoDiaMs / msTotalDia) : 0;

                const diaStr = String(atual.getDate()).padStart(2, '0') + '/' + String(atual.getMonth() + 1).padStart(2, '0');
                labelsDias.push(diaStr);
                
                dadosDMDiaria.push({
                    value: percentDM.toFixed(2),
                    disp: mediaCavalosDisp,
                    total: qtdFrotaDia 
                });
            }
            
            atual.setDate(atual.getDate() + 1);
        }

        let somaDM = 0;
        dadosDMDiaria.forEach(d => somaDM += parseFloat(d.value));
        let mediaDM = dadosDMDiaria.length > 0 ? (somaDM / dadosDMDiaria.length).toFixed(1) : 0;

        let totalOSMes = 0;
        let concluidasOSMes = 0;
        let tempoTotalMs = 0;
        let osComTempo = 0;

        ordensServico.forEach(os => {
            if (!os.placa || !cavalosValidos.includes(os.placa)) return; 
            if (os.status === 'Agendada') return;
            
            const dtAbertura = window.corrigirDataSupabase(os.data_abertura);
            if (!dtAbertura) return;
            
            let dtConclusao = os.data_conclusao ? window.corrigirDataSupabase(os.data_conclusao) : new Date();

            if (dtAbertura <= hoje && dtConclusao >= dataInicio) {
                totalOSMes++;
                if (os.status === 'Concluída' || os.status === 'Resolvido') {
                    concluidasOSMes++;
                    if (os.data_conclusao) {
                        tempoTotalMs += (dtConclusao - dtAbertura);
                        osComTempo++;
                    }
                }
            }
        });

        let tempoMedioStr = '0h 0m';
        if (osComTempo > 0) {
            let mediaMs = tempoTotalMs / osComTempo;
            let mediaHoras = Math.floor(mediaMs / (1000 * 60 * 60));
            let mediaMinutos = Math.floor((mediaMs % (1000 * 60 * 60)) / (1000 * 60));
            tempoMedioStr = `${mediaHoras}h ${mediaMinutos}m`;
        }

        const elKpiMiniDM = document.getElementById('kpiMiniDMGrua');
        const elKpiMiniTotal = document.getElementById('kpiMiniTotalOSGrua');
        const elKpiMiniConcluidas = document.getElementById('kpiMiniConcluidasGrua');
        const elKpiMiniTempo = document.getElementById('kpiMiniTempoGrua');

        if(elKpiMiniDM) elKpiMiniDM.innerText = mediaDM + '%';
        if(elKpiMiniTotal) elKpiMiniTotal.innerText = totalOSMes;
        if(elKpiMiniConcluidas) elKpiMiniConcluidas.innerText = concluidasOSMes;
        if(elKpiMiniTempo) elKpiMiniTempo.innerText = tempoMedioStr;
        
        if (typeof echarts === 'undefined') return;
        const chartDom = document.getElementById('graficoEvolucaoDMDiariaGrua');
        if (chartDom) {
            let myChart = echarts.getInstanceByDom(chartDom);
            if (!myChart) myChart = echarts.init(chartDom);

            const option = {
                backgroundColor: 'transparent',
                tooltip: { 
                    trigger: 'axis', 
                    formatter: function (params) {
                        const d = params[0].data;
                        return `<b style="font-size:14px; border-bottom:1px solid #444; padding-bottom:4px; display:block; margin-bottom:4px;">${params[0].name}</b>` +
                               `Média Disponíveis: <span style="color:#eab308; font-weight:bold;">${d.disp}</span> / ${d.total} veículos<br/>` +
                               `Índice DM: <span style="color:#eab308; font-weight:bold;">${d.value}%</span>`;
                    }
                },
                grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                xAxis: {
                    type: 'category',
                    boundaryGap: false,
                    data: labelsDias,
                    axisLabel: { color: '#ffffff', fontWeight: 'bold' }
                },
                yAxis: {
                    type: 'value',
                    min: 0,
                    max: 100,
                    axisLabel: { formatter: '{value}%', color: '#ffffff', fontWeight: 'bold' },
                    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
                },
                series: [{
                    name: 'Média DM Diária GRUA',
                    type: 'line',
                    data: dadosDMDiaria,
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: 8,
                    label: {
                        show: true,
                        position: 'top',
                        formatter: function (params) {
                            return `${params.data.disp}/${params.data.total}\n(${params.data.value}%)`;
                        },
                        color: '#ffffff',
                        fontSize: 14,
                        fontWeight: '900',
                        align: 'center',
                        lineHeight: 18,
                        textBorderColor: 'rgba(0, 0, 0, 0.8)',
                        textBorderWidth: 3
                    },
                    itemStyle: { color: '#eab308' }, 
                    lineStyle: { width: 4 },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(234, 179, 8, 0.4)' },
                            { offset: 1, color: 'rgba(234, 179, 8, 0)' }
                        ])
                    }
                }]
            };

            myChart.setOption(option);
            window.removeEventListener('resize', myChart.resize);
            window.addEventListener('resize', () => myChart.resize());
        }
    } catch(e) {
        console.error("Erro na DM Evolução Diária Grua:", e);
    }
}

window.preencherSelectPlacasDM = function() {
    const select = document.getElementById('filtroPlacaDMInd');
    if (!select || !frotasManutencao || frotasManutencao.length === 0) return;
    
    if (select.options.length > 1) return;

    const placas = [...new Set(frotasManutencao.filter(f => f.status === 'Ativo' && f.categoria && f.categoria.toUpperCase() === 'TRITREM').map(f => f.cavalo))].sort();
    
    placas.forEach(placa => {
        const opt = document.createElement('option');
        opt.value = placa;
        opt.textContent = placa;
        select.appendChild(opt);
    });
}

window.preencherSelectPlacasDMGrua = function() {
    const select = document.getElementById('filtroPlacaDMIndGrua');
    if (!select || !frotasManutencao || frotasManutencao.length === 0) return;
    
    if (select.options.length > 1) return;

    const placas = [...new Set(frotasManutencao.filter(f => f.status === 'Ativo' && f.categoria && f.categoria.toUpperCase() === 'GRUA').map(f => f.cavalo))].sort();
    
    placas.forEach(placa => {
        const opt = document.createElement('option');
        opt.value = placa;
        opt.textContent = placa;
        select.appendChild(opt);
    });
}

window.renderizarDMIndividual = function() {
    try {
        const placa = document.getElementById('filtroPlacaDMInd').value;
        const chartDom = document.getElementById('graficoDmIndividual');
        if(!chartDom) return;

        if (!placa) {
            chartDom.innerHTML = '<div style="color:#94a3b8; display:flex; justify-content:center; align-items:center; height:100%; border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px; text-align:center;">Selecione um veículo para visualizar a DM no período global.</div>';
            if(chartDom.getAttribute('_echarts_instance_')) {
                echarts.dispose(chartDom);
            }
            return;
        }

        let dataInicio, dataFim;
        const inpInicio = document.getElementById('dataInicioDMInd').value;
        const inpFim = document.getElementById('dataFimDMInd').value;
        
        const hoje = new Date();
        hoje.setHours(23, 59, 59, 999);

        if (inpInicio && inpFim) {
            dataInicio = new Date(inpInicio + 'T00:00:00');
            dataFim = new Date(inpFim + 'T23:59:59');
        } else {
            const globalFilter = window.getDatasFiltroGlobal ? window.getDatasFiltroGlobal() : { inicio: new Date(hoje.getFullYear(), hoje.getMonth(), 1), fim: hoje };
            dataInicio = globalFilter.inicio;
            dataFim = globalFilter.fim;
        }

        const labelsDias = [];
        const dadosDM = [];
        let atual = new Date(dataInicio);

        const todasOSCavalo = ordensServico.filter(o => o.placa === placa && o.status !== 'Agendada' && o.tipo !== 'Cavalo Disponível S/ Carreta');
        
        const infoFrota = frotasManutencao.find(f => f.cavalo === placa);
        let frotaInicioStr = (infoFrota && infoFrota.data_inicial) ? infoFrota.data_inicial : '2026-04-01';
        let dtEntradaVeiculo = new Date(frotaInicioStr + 'T00:00:00');

        while (atual <= dataFim) {
            const inicioDia = new Date(atual.getFullYear(), atual.getMonth(), atual.getDate(), 0, 0, 0);
            const fimDia = new Date(atual.getFullYear(), atual.getMonth(), atual.getDate(), 23, 59, 59, 999);
            
            let msTotalDia = 24 * 60 * 60 * 1000;
            let fimParaCalculo = fimDia;
            const ehHoje = (atual.toDateString() === new Date().toDateString());

            if (ehHoje) {
                const agora = new Date();
                msTotalDia = agora - inicioDia;
                fimParaCalculo = agora;
            }
            
            if (dtEntradaVeiculo <= fimParaCalculo && msTotalDia > 0) {
                let overlapDispInicio = dtEntradaVeiculo > inicioDia ? dtEntradaVeiculo : inicioDia;
                let msValidoDia = fimParaCalculo - overlapDispInicio;

                let msManutencaoDia = 0;

                todasOSCavalo.forEach(os => {
                    const osInicio = window.corrigirDataSupabase(os.data_abertura);
                    if (!osInicio) return;
                    
                    let osFim = os.data_conclusao ? window.corrigirDataSupabase(os.data_conclusao) : new Date();
                    
                    let inicioValido = osInicio > dtEntradaVeiculo ? osInicio : dtEntradaVeiculo;
                    const overlapInicio = inicioValido > inicioDia ? inicioValido : inicioDia;
                    const overlapFim = osFim < fimParaCalculo ? osFim : fimParaCalculo;

                    if (overlapInicio < overlapFim) {
                        msManutencaoDia += (overlapFim - overlapInicio);
                    }
                });

                if (msManutencaoDia > msValidoDia) msManutencaoDia = msValidoDia;
                
                let dispNoDiaMs = msValidoDia - msManutencaoDia;
                if (dispNoDiaMs < 0) dispNoDiaMs = 0;

                let percentDM = msValidoDia > 0 ? (dispNoDiaMs / msValidoDia) * 100 : 100;
                
                const diaStr = String(atual.getDate()).padStart(2, '0') + '/' + String(atual.getMonth() + 1).padStart(2, '0');
                labelsDias.push(diaStr);
                dadosDM.push(percentDM.toFixed(2));
            } else {
                const diaStr = String(atual.getDate()).padStart(2, '0') + '/' + String(atual.getMonth() + 1).padStart(2, '0');
                labelsDias.push(diaStr);
                dadosDM.push(0); 
            }

            atual.setDate(atual.getDate() + 1);
        }

        if (typeof echarts === 'undefined') return;
        let myChart = echarts.getInstanceByDom(chartDom);
        if (!myChart) {
            chartDom.innerHTML = ''; 
            myChart = echarts.init(chartDom);
        }

        const option = {
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis', formatter: '{b} <br/> DM: <b>{c}%</b>' },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: labelsDias,
                axisLabel: { color: '#ffffff', fontWeight: 'bold' }
            },
            yAxis: {
                type: 'value',
                min: 0,
                max: 100,
                axisLabel: { formatter: '{value}%', color: '#ffffff', fontWeight: 'bold' },
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
            },
            series: [{
                name: 'DM ' + placa,
                type: 'line',
                data: dadosDM,
                smooth: true,
                symbol: 'circle',
                symbolSize: 8,
                label: { show: true, position: 'top', formatter: '{c}%', color: '#a855f7', fontSize: 13, fontWeight: 'bold' },
                itemStyle: { color: '#a855f7' }, 
                lineStyle: { width: 4 },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(168, 85, 247, 0.4)' },
                        { offset: 1, color: 'rgba(168, 85, 247, 0)' }
                    ])
                }
            }]
        };

        myChart.setOption(option);
        window.removeEventListener('resize', myChart.resize);
        window.addEventListener('resize', () => myChart.resize());

    } catch(e) {
        console.error("Erro ao renderizar DM Individual:", e);
    }
}

window.renderizarDMIndividualGrua = function() {
    try {
        const placa = document.getElementById('filtroPlacaDMIndGrua').value;
        const chartDom = document.getElementById('graficoDmIndividualGrua');
        if(!chartDom) return;

        if (!placa) {
            chartDom.innerHTML = '<div style="color:#94a3b8; display:flex; justify-content:center; align-items:center; height:100%; border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px; text-align:center;">Selecione uma GRUA para visualizar a DM no período global.</div>';
            if(chartDom.getAttribute('_echarts_instance_')) {
                echarts.dispose(chartDom);
            }
            return;
        }

        let dataInicio, dataFim;
        const inpInicio = document.getElementById('dataInicioDMIndGrua').value;
        const inpFim = document.getElementById('dataFimDMIndGrua').value;
        
        const hoje = new Date();
        hoje.setHours(23, 59, 59, 999);

        if (inpInicio && inpFim) {
            dataInicio = new Date(inpInicio + 'T00:00:00');
            dataFim = new Date(inpFim + 'T23:59:59');
        } else {
            const globalFilter = window.getDatasFiltroGlobal ? window.getDatasFiltroGlobal() : { inicio: new Date(hoje.getFullYear(), hoje.getMonth(), 1), fim: hoje };
            dataInicio = globalFilter.inicio;
            dataFim = globalFilter.fim;
        }

        const labelsDias = [];
        const dadosDM = [];
        let atual = new Date(dataInicio);

        const todasOSCavalo = ordensServico.filter(o => o.placa === placa && o.status !== 'Agendada' && o.tipo !== 'Cavalo Disponível S/ Carreta');
        
        const infoFrota = frotasManutencao.find(f => f.cavalo === placa);
        let frotaInicioStr = (infoFrota && infoFrota.data_inicial) ? infoFrota.data_inicial : '2026-04-01';
        let dtEntradaVeiculo = new Date(frotaInicioStr + 'T00:00:00');

        while (atual <= dataFim) {
            const inicioDia = new Date(atual.getFullYear(), atual.getMonth(), atual.getDate(), 0, 0, 0);
            const fimDia = new Date(atual.getFullYear(), atual.getMonth(), atual.getDate(), 23, 59, 59, 999);
            
            let msTotalDia = 24 * 60 * 60 * 1000;
            let fimParaCalculo = fimDia;
            const ehHoje = (atual.toDateString() === new Date().toDateString());

            if (ehHoje) {
                const agora = new Date();
                msTotalDia = agora - inicioDia;
                fimParaCalculo = agora;
            }
            
            if (dtEntradaVeiculo <= fimParaCalculo && msTotalDia > 0) {
                let overlapDispInicio = dtEntradaVeiculo > inicioDia ? dtEntradaVeiculo : inicioDia;
                let msValidoDia = fimParaCalculo - overlapDispInicio;

                let msManutencaoDia = 0;

                todasOSCavalo.forEach(os => {
                    const osInicio = window.corrigirDataSupabase(os.data_abertura);
                    if (!osInicio) return;
                    
                    let osFim = os.data_conclusao ? window.corrigirDataSupabase(os.data_conclusao) : new Date();
                    
                    let inicioValido = osInicio > dtEntradaVeiculo ? osInicio : dtEntradaVeiculo;
                    const overlapInicio = inicioValido > inicioDia ? inicioValido : inicioDia;
                    const overlapFim = osFim < fimParaCalculo ? osFim : fimParaCalculo;

                    if (overlapInicio < overlapFim) {
                        msManutencaoDia += (overlapFim - overlapInicio);
                    }
                });

                if (msManutencaoDia > msValidoDia) msManutencaoDia = msValidoDia;
                
                let dispNoDiaMs = msValidoDia - msManutencaoDia;
                if (dispNoDiaMs < 0) dispNoDiaMs = 0;

                let percentDM = msValidoDia > 0 ? (dispNoDiaMs / msValidoDia) * 100 : 100;
                
                const diaStr = String(atual.getDate()).padStart(2, '0') + '/' + String(atual.getMonth() + 1).padStart(2, '0');
                labelsDias.push(diaStr);
                dadosDM.push(percentDM.toFixed(2));
            } else {
                const diaStr = String(atual.getDate()).padStart(2, '0') + '/' + String(atual.getMonth() + 1).padStart(2, '0');
                labelsDias.push(diaStr);
                dadosDM.push(0); 
            }

            atual.setDate(atual.getDate() + 1);
        }

        if (typeof echarts === 'undefined') return;
        let myChart = echarts.getInstanceByDom(chartDom);
        if (!myChart) {
            chartDom.innerHTML = ''; 
            myChart = echarts.init(chartDom);
        }

        const option = {
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis', formatter: '{b} <br/> DM: <b>{c}%</b>' },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: labelsDias,
                axisLabel: { color: '#ffffff', fontWeight: 'bold' }
            },
            yAxis: {
                type: 'value',
                min: 0,
                max: 100,
                axisLabel: { formatter: '{value}%', color: '#ffffff', fontWeight: 'bold' },
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
            },
            series: [{
                name: 'DM GRUA ' + placa,
                type: 'line',
                data: dadosDM,
                smooth: true,
                symbol: 'circle',
                symbolSize: 8,
                label: { show: true, position: 'top', formatter: '{c}%', color: '#eab308', fontSize: 13, fontWeight: 'bold' },
                itemStyle: { color: '#eab308' }, 
                lineStyle: { width: 4 },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(234, 179, 8, 0.4)' },
                        { offset: 1, color: 'rgba(234, 179, 8, 0)' }
                    ])
                }
            }]
        };

        myChart.setOption(option);
        window.removeEventListener('resize', myChart.resize);
        window.addEventListener('resize', () => myChart.resize());

    } catch(e) {
        console.error("Erro ao renderizar DM Individual Grua:", e);
    }
}

window.exportarDMIndividualExcel = function() {
    const placa = document.getElementById('filtroPlacaDMInd').value;
    if (!placa) {
        alert('Selecione um veículo primeiro no filtro para exportar.');
        return;
    }
    
    const chartDom = document.getElementById('graficoDmIndividual');
    const myChart = echarts.getInstanceByDom(chartDom);
    
    if (!myChart) {
        alert('Nenhum dado disponível no gráfico para exportar.');
        return;
    }

    const option = myChart.getOption();
    const dias = option.xAxis[0].data;
    const valores = option.series[0].data;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Veiculo,Data,DM (%)\n";

    for (let i = 0; i < dias.length; i++) {
        csvContent += `${placa},${dias[i]},${valores[i]}\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `DM_${placa}_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

window.exportarDMIndividualExcelGrua = function() {
    const placa = document.getElementById('filtroPlacaDMIndGrua').value;
    if (!placa) {
        alert('Selecione uma Grua primeiro no filtro para exportar.');
        return;
    }
    
    const chartDom = document.getElementById('graficoDmIndividualGrua');
    const myChart = echarts.getInstanceByDom(chartDom);
    
    if (!myChart) {
        alert('Nenhum dado disponível no gráfico para exportar.');
        return;
    }

    const option = myChart.getOption();
    const dias = option.xAxis[0].data;
    const valores = option.series[0].data;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Veiculo,Data,DM (%)\n";

    for (let i = 0; i < dias.length; i++) {
        csvContent += `${placa},${dias[i]},${valores[i]}\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `DM_GRUA_${placa}_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

window.renderizarRelatorioDM = function() {
    const tbody = document.getElementById('tabelaRelatorioDM');
    if(!tbody) return;

    if (!ordensServico || !frotasManutencao || frotasManutencao.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 20px;">Sem dados para gerar o relatório...</td></tr>`;
        return;
    }

    const filtro = document.getElementById('filtroPeriodoDM');
    let diasFiltro = 30;
    let diaInicio = new Date();
    diaInicio.setHours(0,0,0,0);
    let hoje = new Date();
    hoje.setHours(23,59,59,999);

    if (filtro && filtro.value) {
        if(filtro.value === 'mes_atual') {
            diaInicio.setDate(1);
        } else {
            diasFiltro = parseInt(filtro.value);
            diaInicio.setDate(diaInicio.getDate() - diasFiltro + 1);
        }
    } else {
        diaInicio.setDate(diaInicio.getDate() - 29);
    }
    
    let msTotalPeriodo = hoje - diaInicio;
    if (msTotalPeriodo <= 0) msTotalPeriodo = 1;
    let horasPeriodo = msTotalPeriodo / (1000 * 60 * 60);

    const frotasValidas = frotasManutencao.filter(f => f.status === 'Ativo' && f.categoria && (f.categoria.toUpperCase() === 'TRITREM' || f.categoria.toUpperCase() === 'GRUA'));
    
    let html = '';
    const dadosExcel = [];

    frotasValidas.forEach(frota => {
        const placa = frota.cavalo;
        let frotaInicioStr = frota.data_inicial ? frota.data_inicial : '2026-04-01';
        let dtEntradaVeiculo = new Date(frotaInicioStr + 'T00:00:00');
        
        let msValidoVeiculo = 0;
        let overlapDispInicio = dtEntradaVeiculo > diaInicio ? dtEntradaVeiculo : diaInicio;
        if (overlapDispInicio < hoje) {
            msValidoVeiculo = (hoje - overlapDispInicio);
        }
        let horasValidoVeiculo = msValidoVeiculo / (1000 * 60 * 60);
        
        let tempoManutencaoTotalHoras = 0;
        let hsComum = 0;
        let hsSOS = 0;

        const todasOSCavalo = ordensServico.filter(o => o.placa === placa && o.status !== 'Agendada' && o.tipo !== 'Cavalo Disponível S/ Carreta');
        let intervalos = [];

        todasOSCavalo.forEach(os => {
            const osInicio = window.corrigirDataSupabase(os.data_abertura);
            if (!osInicio) return;
            
            let osFim = os.data_conclusao ? window.corrigirDataSupabase(os.data_conclusao) : hoje;
            
            let inicioValido = osInicio > dtEntradaVeiculo ? osInicio : dtEntradaVeiculo;
            const overlapInicio = inicioValido > diaInicio ? inicioValido : diaInicio;
            const overlapFim = osFim < hoje ? osFim : hoje;

            if (overlapInicio < overlapFim) {
                intervalos.push([overlapInicio.getTime(), overlapFim.getTime(), os.tipo, os.prioridade, os.descricao]);
            }
        });
        
        if (intervalos.length > 0) {
            intervalos.sort((a,b) => a[0] - b[0]);
            let merged = [ [intervalos[0][0], intervalos[0][1]] ];
            for (let i = 1; i < intervalos.length; i++) {
                let last = merged[merged.length - 1];
                let current = intervalos[i];
                if (current[0] <= last[1]) {
                    last[1] = Math.max(last[1], current[1]);
                } else {
                    merged.push([current[0], current[1]]);
                }
            }
            
            merged.forEach(iv => {
                tempoManutencaoTotalHoras += (iv[1] - iv[0]) / (1000 * 60 * 60);
            });
            
            intervalos.forEach(iv => {
                const tipoOS = (iv[2] || '').toUpperCase();
                const prioridadeOS = (iv[3] || '').toUpperCase();
                const descOS = (iv[4] || '').toUpperCase();
                if (tipoOS.includes('S.O.S') || tipoOS.includes('SOS') || tipoOS.includes('SOCORRO') || prioridadeOS.includes('EMERGÊNCIA') || descOS.includes('SOS') || descOS.includes('S.O.S')) {
                    hsSOS += (iv[1] - iv[0]) / (1000 * 60 * 60);
                } else {
                    hsComum += (iv[1] - iv[0]) / (1000 * 60 * 60);
                }
            });
            
            let totalBruto = hsSOS + hsComum;
            if (totalBruto > 0 && tempoManutencaoTotalHoras < totalBruto) {
                let fator = tempoManutencaoTotalHoras / totalBruto;
                hsSOS *= fator;
                hsComum *= fator;
            }
        }

        if (tempoManutencaoTotalHoras > horasValidoVeiculo) tempoManutencaoTotalHoras = horasValidoVeiculo;

        let horasDisponivel = horasValidoVeiculo - tempoManutencaoTotalHoras;
        if (horasDisponivel < 0) horasDisponivel = 0;

        let percentDM = horasValidoVeiculo > 0 ? (horasDisponivel / horasValidoVeiculo) * 100 : 100;
        
        let corDm = percentDM >= 90 ? 'text-emerald-400' : (percentDM >= 80 ? 'text-amber-400' : 'text-rose-400');
        let iconDm = percentDM >= 90 ? 'fa-check-circle' : (percentDM >= 80 ? 'fa-exclamation-triangle' : 'fa-times-circle');
        
        let badgeStatus = '<span style="background: rgba(16, 185, 129, 0.2); color: #10b981; padding: 4px 10px; border-radius: 4px; font-weight: bold; border: 1px solid rgba(16,185,129,0.3); font-size: 0.8rem;">Disponível</span>';
        
        let dtAberturaOSAberta = null;
        const temAberta = todasOSCavalo.find(o => o.status !== 'Concluída' && o.status !== 'Resolvido');
        if (temAberta) {
            badgeStatus = `<span style="background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 4px 10px; border-radius: 4px; font-weight: bold; border: 1px solid rgba(239,68,68,0.3); font-size: 0.8rem;">OS #${temAberta.id || temAberta.numero_os}</span>`;
            dtAberturaOSAberta = window.corrigirDataSupabase(temAberta.data_abertura);
        }

        const hTrabalho = Math.floor(horasValidoVeiculo);
        const mTrabalho = Math.round((horasValidoVeiculo - hTrabalho) * 60);
        
        const hManut = Math.floor(tempoManutencaoTotalHoras);
        const mManut = Math.round((tempoManutencaoTotalHoras - hManut) * 60);

        const hDisp = Math.floor(horasDisponivel);
        const mDisp = Math.round((horasDisponivel - hDisp) * 60);

        dadosExcel.push({
            "Categoria": frota.categoria || "N/A",
            "Placa": placa,
            "Tempo Base (h)": horasValidoVeiculo.toFixed(2),
            "Tempo Manutenção (h)": tempoManutencaoTotalHoras.toFixed(2),
            "Manut. Corretiva/Prev (h)": hsComum.toFixed(2),
            "Manut. S.O.S (h)": hsSOS.toFixed(2),
            "Tempo Disponível (h)": horasDisponivel.toFixed(2),
            "DM (%)": percentDM.toFixed(2),
            "Status": temAberta ? "Em Manutenção" : "Disponível",
            "Entrada O.S (Se em manut.)": dtAberturaOSAberta ? dtAberturaOSAberta.toLocaleString('pt-BR') : '-'
        });

        html += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.1); transition: 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='rgba(0,0,0,0.1)'">
                <td style="padding: 15px; color: #fff; font-weight: bold; font-size: 1.1rem; border-left: 3px solid ${percentDM >= 90 ? '#10b981' : (percentDM >= 80 ? '#f59e0b' : '#ef4444')}">${placa} <span style="font-size:0.75rem; color:#94a3b8; display:block;">${frota.categoria || ''}</span></td>
                <td style="padding: 15px; color: #cbd5e1; font-weight: 500;">${hTrabalho}h ${mTrabalho}m</td>
                <td style="padding: 15px; color: #f87171; font-weight: bold;">${hManut}h ${mManut}m</td>
                <td style="padding: 15px; color: #3b82f6; font-weight: bold;">${hDisp}h ${mDisp}m</td>
                <td style="padding: 15px; font-weight: 900; font-size: 1.2rem;" class="${corDm}">
                    ${percentDM.toFixed(2)}% <i class="fas ${iconDm}" style="font-size: 1rem; margin-left: 5px;"></i>
                </td>
                <td style="padding: 15px; text-align: right;">${badgeStatus}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    window.dadosRelatorioDMExport = dadosExcel;
}

window.exportarRelatorioDMExcel = function() {
    if (!window.dadosRelatorioDMExport || window.dadosRelatorioDMExport.length === 0) {
        alert("Sem dados para exportar.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    const headers = Object.keys(window.dadosRelatorioDMExport[0]).join(",");
    csvContent += headers + "\n";

    window.dadosRelatorioDMExport.forEach(row => {
        const values = Object.values(row).map(val => `"${val}"`).join(",");
        csvContent += values + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Relatorio_DM_Por_Cavalo_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Inicia as renderizações
setInterval(() => {
    if (typeof ordensServico === 'undefined' || !ordensServico || ordensServico.length === 0) return;
    if (typeof frotasManutencao === 'undefined' || !frotasManutencao || frotasManutencao.length === 0) return;

    const tableEl = document.getElementById('tabelaRelatorioDM');
    if (tableEl && typeof window.renderizarRelatorioDM === 'function' && !tableEl.getAttribute('data-rendered')) {
        tableEl.setAttribute('data-rendered', 'true');
        window.renderizarRelatorioDM();
    }
    const rankEl = document.getElementById('rankingCavalosOS');
    if (rankEl && typeof window.renderizarRelatorioGerencialOS === 'function' && !rankEl.getAttribute('data-rendered')) {
        rankEl.setAttribute('data-rendered', 'true');
        window.renderizarRelatorioGerencialOS();
    }
    const rankMot = document.getElementById('rankingMotoristasOS');
    if (rankMot && typeof window.renderizarRankingMotoristas === 'function' && !rankMot.getAttribute('data-rendered')) {
        rankMot.setAttribute('data-rendered', 'true');
        window.renderizarRankingMotoristas();
    }
}, 1000);

setInterval(() => {
    if (typeof ordensServico === 'undefined' || !ordensServico || ordensServico.length === 0) return;
    if(typeof window.renderizarRelatorioDM === 'function') window.renderizarRelatorioDM();
    if(typeof window.renderizarRelatorioGerencialOS === 'function') window.renderizarRelatorioGerencialOS();
    if(typeof window.renderizarRankingMotoristas === 'function') window.renderizarRankingMotoristas();
}, 60000);