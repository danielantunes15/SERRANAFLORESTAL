// =================================================================
// FUNÇÕES DO FILTRO GLOBAL E KPIS
// =================================================================

// Função auxiliar para garantir o fuso horário correto do Supabase (UTC)
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
};

window.getDatasFiltroGlobal = function() {
    const selectFiltro = document.getElementById('filtroGlobalPeriodo');
    const filtro = selectFiltro ? selectFiltro.value : 'mes_atual';
    const hoje = new Date();
    let inicio = new Date(hoje);
    inicio.setHours(0,0,0,0);
    
    let fim = new Date();
    fim.setHours(23,59,59,999);
    if (filtro === 'dia_atual') {
        // inicio já é hoje às 00:00
    } else if (filtro === 'semana_atual') {
        inicio.setDate(inicio.getDate() - inicio.getDay());
    } else if (filtro === 'mes_atual') {
        inicio.setDate(1);
    } else {
        let d = parseInt(filtro) || 30;
        inicio.setDate(inicio.getDate() - d + 1);
    }
    return { inicio: inicio, fim: fim, valorBruto: filtro };
};

window.atualizarKPIsGlobais = function() {
    try {
        if (!ordensServico || !frotasManutencao) return;

        // Cria array apenas com cavalos TRITREM Ativos
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
            if (!os.placa || !cavalosValidos.includes(os.placa)) return; // FILTRO TRITREM ATIVO
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
            // FILTRO TRITREM E ATIVO
            if(frota.status !== 'Ativo' || !frota.categoria || frota.categoria.toUpperCase() !== 'TRITREM') return;
            
            // Lógica da DATA INICIAL do veículo
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
                
                // Limita a OS a partir da data que o caminhão entrou e dentro do filtro
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
};

window.dispararFiltrosGlobais = function() {
    try { if(typeof atualizarKPIsGlobais === 'function') atualizarKPIsGlobais(); } catch(e){}
    try { if(typeof renderizarGraficoEvolucaoDM === 'function') renderizarGraficoEvolucaoDM(); } catch(e){}
    try { if(typeof renderizarGraficoStatusFrotaHorario === 'function') renderizarGraficoStatusFrotaHorario(); } catch(e){}
    try { if(typeof renderizarGraficoEvolucaoDMDiaria === 'function') renderizarGraficoEvolucaoDMDiaria(); } catch(e){}
    try { if(typeof renderizarGraficoEvolucaoDMDiariaGrua === 'function') renderizarGraficoEvolucaoDMDiariaGrua(); } catch(e){}
    try { if(typeof renderizarGraficoDMOperacional === 'function') renderizarGraficoDMOperacional(); } catch(e){}
    try { if(typeof renderizarDMIndividual === 'function') renderizarDMIndividual(); } catch(e){}
    
    const hiddenFiltroTabela = document.getElementById('filtroPeriodoDM');
    if(hiddenFiltroTabela) {
        let val = document.getElementById('filtroGlobalPeriodo').value;
        if(val === 'dia_atual') val = '1';
        else if(val === 'semana_atual') val = '7';
        
        hiddenFiltroTabela.value = val;
        try { if(typeof renderizarRelatorioDM === 'function') renderizarRelatorioDM(); } catch(e){}
    }
};

window.preencherMesesDMDiaria = function() {
    const select = document.getElementById('filtroMesEvolucaoDMDiaria');
    if (!select || !ordensServico || !frotasManutencao) return;

    // Apenas O.S. dos veículos TRITREM Ativos para montar os meses disponíveis
    const cavalosValidos = frotasManutencao
        .filter(f => f.status === 'Ativo' && f.categoria && f.categoria.toUpperCase() === 'TRITREM')
        .map(f => f.cavalo);

    const mesesDisponiveis = new Set();
    const hoje = new Date();
    const mesAtualKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    ordensServico.forEach(os => {
        if (!os.placa || !cavalosValidos.includes(os.placa)) return; // FILTRO TRITREM

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
};

window.preencherMesesDMDiariaGrua = function() {
    const select = document.getElementById('filtroMesEvolucaoDMDiariaGrua');
    if (!select || !ordensServico || !frotasManutencao) return;

    // Apenas O.S. dos veículos GRUA Ativos para montar os meses disponíveis
    const cavalosValidos = frotasManutencao
        .filter(f => f.status === 'Ativo' && f.categoria && f.categoria.toUpperCase() === 'GRUA')
        .map(f => f.cavalo);

    const mesesDisponiveis = new Set();
    const hoje = new Date();
    const mesAtualKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    ordensServico.forEach(os => {
        if (!os.placa || !cavalosValidos.includes(os.placa)) return; // FILTRO GRUA

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
};

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
                // FILTRO TRITREM E ATIVO
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
};

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
            
            frotasManutencao.forEach(frota => {
                // FILTRO TRITREM E ATIVO
                if(frota.status !== 'Ativo' || !frota.categoria || frota.categoria.toUpperCase() !== 'TRITREM') return;
                
                let frotaInicioStr = frota.data_inicial ? frota.data_inicial : '2026-04-01';
                let dtEntradaVeiculo = new Date(frotaInicioStr + 'T00:00:00');
                if (dtEntradaVeiculo > fimHora) return; // Não existia ainda
                
                qtdFrotaAtivaHora++;
                
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
                if (teveSOS) {
                    qtdEmSOS++;
                } else if (teveManutencaoComum) {
                    qtdEmManutencao++;
                }
            });
            let qtdAtivos = qtdFrotaAtivaHora - qtdEmManutencao - qtdEmSOS;
            if (qtdAtivos < 0) qtdAtivos = 0;
            labelsX.push(`${String(i).padStart(2,'0')}:00`);
            dadosBarraAtivos.push(qtdAtivos);
            dadosBarraManut.push(qtdEmManutencao);
            dadosBarraSOS.push(qtdEmSOS);
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
            
            // Variáveis para contar os veículos totais (ao invés de médias)
            let totalVeiculosManutencaoDia = 0;
            let totalVeiculosSOSDia = 0;
            
            frotasManutencao.forEach(frota => {
                // FILTRO TRITREM E ATIVO
                if(frota.status !== 'Ativo' || !frota.categoria || frota.categoria.toUpperCase() !== 'TRITREM') return;
                
                let frotaInicioStr = frota.data_inicial ? frota.data_inicial : '2026-04-01';
                let dtEntradaVeiculo = new Date(frotaInicioStr + 'T00:00:00');
                
                let overlapDispInicio = dtEntradaVeiculo > inicioDiaCalc ? dtEntradaVeiculo : inicioDiaCalc;
                if (overlapDispInicio < fimParaCalculoTotal) {
                    totalMsDisponivelDia += (fimParaCalculoTotal - overlapDispInicio);
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
                msManutencaoComumDia += manutComumCavalo;
                msSOSDia += sosCavalo;
                
                // Soma como +1 equipamento se ele ficou algum milissegundo no dia nas respectivas paradas
                if (manutComumCavalo > 0) totalVeiculosManutencaoDia++;
                if (sosCavalo > 0) totalVeiculosSOSDia++;
            });
            
            let msManutTotal = msManutencaoComumDia + msSOSDia;
            let dispNoDiaMs = totalMsDisponivelDia - msManutTotal;
            if (dispNoDiaMs < 0) dispNoDiaMs = 0;
            
            const mediaAtivosReal = Math.round(dispNoDiaMs / msTotalDiaCalc);
            
            const elAvgAtivosInterno = document.getElementById('avgAtivosInterno');
            const elAvgManutInterno = document.getElementById('avgManutInterno');
            const elAvgSOSInterno = document.getElementById('avgSOSInterno');
            
            if(elAvgAtivosInterno) elAvgAtivosInterno.innerText = mediaAtivosReal;
            
            if(elAvgManutInterno) {
                // Altera o texto para o Total de Equipamentos parados hoje
                elAvgManutInterno.innerText = totalVeiculosManutencaoDia;
                // Altera o rótulo do HTML ativamente
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
                // Altera o texto para o Total de Equipamentos em SOS hoje
                elAvgSOSInterno.innerText = totalVeiculosSOSDia;
                // Altera o rótulo do HTML ativamente
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
                    data: ['Disponível', 'Manutenção', 'SOS'], 
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
                    }
                ]
            };
            myChartBarras.setOption(optionBarras);
            window.addEventListener('resize', () => myChartBarras.resize());
        }
    } catch(e) {
        console.error("Erro na DM Status Frota Horário:", e);
    }
};

window.renderizarGraficoEvolucaoDMDiaria = function() {
    try {
        if (!frotasManutencao || frotasManutencao.length === 0) return;
        
        if (typeof window.preencherMesesDMDiaria === 'function') {
            window.preencherMesesDMDiaria();
        }

        // Arrays auxiliares para o filtro TRITREM
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
                    // FILTRO TRITREM E ATIVO
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
            if (!os.placa || !cavalosValidos.includes(os.placa)) return; // FILTRO TRITREM
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
};

window.renderizarGraficoEvolucaoDMDiariaGrua = function() {
    try {
        if (!frotasManutencao || frotasManutencao.length === 0) return;
        
        if (typeof window.preencherMesesDMDiariaGrua === 'function') {
            window.preencherMesesDMDiariaGrua();
        }

        // Arrays auxiliares para o filtro GRUA
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
                    // FILTRO GRUA E ATIVO
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
            if (!os.placa || !cavalosValidos.includes(os.placa)) return; // FILTRO GRUA
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
};

window.preencherSelectPlacasDM = function() {
    const select = document.getElementById('filtroPlacaDMInd');
    if (!select || !frotasManutencao || frotasManutencao.length === 0) return;
    
    if (select.options.length > 1) return;
    // FILTRO TRITREM E ATIVO APLICADO AO COMBOBOX
    const placas = [...new Set(frotasManutencao.filter(f => f.status === 'Ativo' && f.categoria && f.categoria.toUpperCase() === 'TRITREM').map(f => f.cavalo))].sort();
    
    placas.forEach(placa => {
        const opt = document.createElement('option');
        opt.value = placa;
        opt.textContent = placa;
        select.appendChild(opt);
    });
};

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
        
        // Pega a data de entrada do veículo selecionado
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
            
            // Só calcula se o caminhão já existia neste dia
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
                // Caminhão não existia nesse dia
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
};

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
};

// =================================================================
// INICIALIZAÇÃO E ATUALIZAÇÃO AUTOMÁTICA DOS GRÁFICOS
// =================================================================
setInterval(() => {
    if (typeof frotasManutencao === 'undefined' || frotasManutencao.length === 0) return;
    if (typeof window.preencherSelectPlacasDM === 'function') {
        window.preencherSelectPlacasDM();
    }
    if (typeof window.preencherMesesDMDiaria === 'function') {
        window.preencherMesesDMDiaria();
    }
    if (typeof window.preencherMesesDMDiariaGrua === 'function') {
        window.preencherMesesDMDiariaGrua();
    }
    
    const chartDomDiaria = document.getElementById('graficoEvolucaoDMDiaria');
    if (chartDomDiaria && chartDomDiaria.offsetWidth > 0 && !chartDomDiaria.getAttribute('data-rendered')) {
        chartDomDiaria.setAttribute('data-rendered', 'true');
        if (typeof window.renderizarGraficoEvolucaoDMDiaria === 'function') {
            window.renderizarGraficoEvolucaoDMDiaria();
        }
    }

    const chartDomDiariaGrua = document.getElementById('graficoEvolucaoDMDiariaGrua');
    if (chartDomDiariaGrua && chartDomDiariaGrua.offsetWidth > 0 && !chartDomDiariaGrua.getAttribute('data-rendered')) {
        chartDomDiariaGrua.setAttribute('data-rendered', 'true');
        if (typeof window.renderizarGraficoEvolucaoDMDiariaGrua === 'function') {
            window.renderizarGraficoEvolucaoDMDiariaGrua();
        }
    }
    
    const chartDomBarras = document.getElementById('graficoStatusFrotaHorario');
    if (chartDomBarras && chartDomBarras.offsetWidth > 0 && !chartDomBarras.getAttribute('data-rendered')) {
        chartDomBarras.setAttribute('data-rendered', 'true');
        if (typeof window.renderizarGraficoStatusFrotaHorario === 'function') {
            window.renderizarGraficoStatusFrotaHorario();
        }
    }
    const chartDomLinha = document.getElementById('graficoEvolucaoDM');
    if (chartDomLinha && chartDomLinha.offsetWidth > 0 && !chartDomLinha.getAttribute('data-rendered')) {
        chartDomLinha.setAttribute('data-rendered', 'true');
        if (typeof window.renderizarGraficoEvolucaoDM === 'function') {
            window.renderizarGraficoEvolucaoDM();
        }
    }
    
    const elKpi = document.getElementById('kpiTotalOS');
    if (elKpi && !elKpi.getAttribute('data-rendered')) {
        elKpi.setAttribute('data-rendered', 'true');
        if (typeof window.atualizarKPIsGlobais === 'function') {
            window.atualizarKPIsGlobais();
        }
    }
}, 1000);

setInterval(() => {
    if (typeof window.atualizarKPIsGlobais === 'function') {
        window.atualizarKPIsGlobais();
    }
    const chartDomBarras = document.getElementById('graficoStatusFrotaHorario');
    if (chartDomBarras && chartDomBarras.offsetWidth > 0 && typeof window.renderizarGraficoStatusFrotaHorario === 'function') {
        window.renderizarGraficoStatusFrotaHorario();
    }
    const chartDomLinha = document.getElementById('graficoEvolucaoDM');
    if (chartDomLinha && chartDomLinha.offsetWidth > 0 && typeof window.renderizarGraficoEvolucaoDM === 'function') {
        window.renderizarGraficoEvolucaoDM();
    }
}, 60000);