// ==================== js/os_painel.js ====================
// Módulo de Painéis, Indicadores Gerenciais, Gráficos DM, Modo TV e Exportação

function renderizarRelatorioGerencialOS() {
    // 1. Busca a data do Filtro Global do Painel
    let filtroData = { inicio: new Date(0), fim: new Date(2100, 1, 1) };
    if (typeof window.getDatasFiltroGlobal === 'function') {
        filtroData = window.getDatasFiltroGlobal();
    }

    // 2. Filtra TODAS as Ordens de Serviço Baseado no Filtro Global
    const osNoPeriodo = ordensServico.filter(o => {
        if (!o.data_abertura) return false;
        let osInicioStr = o.data_abertura;
        if (!osInicioStr.includes('T')) osInicioStr += 'T00:00:00';
        const d = new Date(osInicioStr.replace('Z', '').replace('+00:00', ''));
        return d >= filtroData.inicio && d <= filtroData.fim;
    });

    const osManutencao = osNoPeriodo.filter(o => o.tipo !== 'Sinistro');
    
    // Se não tiver dado nenhum no período filtrado, zera tudo.
    if (osManutencao.length === 0) {
        if(document.getElementById('kpiTotalOS')) document.getElementById('kpiTotalOS').innerText = '0';
        if(document.getElementById('kpiAbertasOS')) document.getElementById('kpiAbertasOS').innerText = '0';
        if(document.getElementById('kpiConcluidasOS')) document.getElementById('kpiConcluidasOS').innerText = '0';
        if(document.getElementById('kpiTaxaOS')) document.getElementById('kpiTaxaOS').innerText = '0%';
        if(document.getElementById('kpiTempoMedioOS')) document.getElementById('kpiTempoMedioOS').innerText = '0h 0m';
        if(document.getElementById('rankingCavalosOS')) document.getElementById('rankingCavalosOS').innerHTML = '<p style="color:#94a3b8; text-align:center;">Nenhum dado no período.</p>';
        if(document.getElementById('graficoTipoOS')) document.getElementById('graficoTipoOS').innerHTML = '<p style="color:#94a3b8; text-align:center;">Nenhum dado no período.</p>';
        if(document.getElementById('graficoPrioridadeOS')) document.getElementById('graficoPrioridadeOS').innerHTML = '<p style="color:#94a3b8; text-align:center;">Nenhum dado no período.</p>';
        
        renderizarRelatorioDM();
        if(typeof window.renderizarGraficoOcorrenciasPorTipo === 'function') window.renderizarGraficoOcorrenciasPorTipo();
        return;
    }
    
    const total = osManutencao.length;
    const abertas = osManutencao.filter(o => o.status === 'Aguardando Oficina' || o.status === 'Em Manutenção').length;
    const concluidas = osManutencao.filter(o => o.status === 'Concluída');
    const taxa = ((concluidas.length / total) * 100).toFixed(1);
    
    if(document.getElementById('kpiTotalOS')) document.getElementById('kpiTotalOS').innerText = total;
    if(document.getElementById('kpiAbertasOS')) document.getElementById('kpiAbertasOS').innerText = abertas;
    if(document.getElementById('kpiConcluidasOS')) document.getElementById('kpiConcluidasOS').innerText = concluidas.length;
    if(document.getElementById('kpiTaxaOS')) document.getElementById('kpiTaxaOS').innerText = taxa + '%';
    
    let tempoTotalMs = 0;
    let qtdValidas = 0;
    concluidas.forEach(o => {
        if (o.data_abertura && o.data_conclusao) {
            const inicio = new Date(o.data_abertura.replace('Z', '').replace('+00:00', ''));
            const fim = new Date(o.data_conclusao.replace('Z', '').replace('+00:00', ''));
            
            if (!isNaN(inicio) && !isNaN(fim) && fim > inicio) {
                tempoTotalMs += (fim - inicio);
                qtdValidas++;
            }
        }
    });
    
    let textoTempoMedio = '0h 0m';
    if (qtdValidas > 0) {
        const mediaMs = tempoTotalMs / qtdValidas;
        const mediaHoras = Math.floor(mediaMs / (1000 * 60 * 60));
        const mediaMinutos = Math.floor((mediaMs % (1000 * 60 * 60)) / (1000 * 60));
        textoTempoMedio = `${mediaHoras}h ${mediaMinutos}m`;
    }
    
    const elTempoMedio = document.getElementById('kpiTempoMedioOS');
    if (elTempoMedio) elTempoMedio.innerText = textoTempoMedio;
    
    const porCavalo = {};
    osManutencao.forEach(o => { porCavalo[o.placa] = (porCavalo[o.placa] || 0) + 1; });
    const topCavalos = Object.entries(porCavalo).sort((a, b) => b[1] - a[1]).slice(0, 5);
    
    const maxCavaloCount = topCavalos.length > 0 ? topCavalos[0][1] : 1;
    let htmlCavalos = '';
    topCavalos.forEach(([placa, qtd], index) => {
        const percent = (qtd / maxCavaloCount) * 100;
        let color = '#ef4444';
        if (index > 1) color = '#f59e0b';
        if (index > 3) color = 'var(--ccol-blue-bright)';
        
        htmlCavalos += `
            <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.85rem; color: #e2e8f0;">
                    <strong>${index + 1}º ${placa}</strong>
                    <span>${qtd} O.S.</span>
                </div>
                <div style="background: rgba(255,255,255,0.1); border-radius: 4px; height: 12px; overflow: hidden;">
                    <div style="background: ${color}; width: ${percent}%; height: 100%; border-radius: 4px;"></div>
                </div>
            </div>`;
    });
    const rankingEl = document.getElementById('rankingCavalosOS');
    if(rankingEl) rankingEl.innerHTML = htmlCavalos || '<p>Sem dados.</p>';
    
    const porTipo = {};
    osManutencao.forEach(o => { porTipo[o.tipo] = (porTipo[o.tipo] || 0) + 1; });
    const listaTipos = Object.entries(porTipo).sort((a, b) => b[1] - a[1]);
    
    let htmlTipos = '<ul style="list-style: none; padding: 0; margin: 0;">';
    listaTipos.forEach(([tipo, qtd]) => {
        const percGlobal = ((qtd / total) * 100).toFixed(1);
        htmlTipos += `
            <li style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); color: #cbd5e1; font-size: 0.9rem;">
                <span>${tipo}</span>
                <strong style="color: var(--ccol-blue-bright);">${qtd} <span style="font-size:0.75rem; color:var(--text-secondary);">(${percGlobal}%)</span></strong>
            </li>`;
    });
    htmlTipos += '</ul>';
    const tipoEl = document.getElementById('graficoTipoOS');
    if(tipoEl) tipoEl.innerHTML = htmlTipos;
    
    const porPrioridade = { 'Urgente': 0, 'Alta': 0, 'Normal': 0, 'Baixa': 0 };
    osManutencao.forEach(o => { if(porPrioridade[o.prioridade] !== undefined) porPrioridade[o.prioridade]++; });
    
    const colors = { 'Urgente': '#ef4444', 'Alta': '#f97316', 'Normal': '#eab308', 'Baixa': 'var(--ccol-green-bright)' };
    
    let htmlPrio = '';
    Object.keys(porPrioridade).forEach(p => {
        const qtd = porPrioridade[p];
        const percent = total > 0 ? (qtd / total) * 100 : 0;
        htmlPrio += `
            <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.85rem; color: #e2e8f0;">
                    <span>Prioridade <strong>${p}</strong></span>
                    <span>${qtd} ocorrências</span>
                </div>
                <div style="background: rgba(255,255,255,0.1); border-radius: 4px; height: 10px; overflow: hidden;">
                    <div style="background: ${colors[p]}; width: ${percent}%; height: 100%; border-radius: 4px;"></div>
                </div>
            </div>`;
    });
    const prioEl = document.getElementById('graficoPrioridadeOS');
    if(prioEl) prioEl.innerHTML = htmlPrio;
    
    renderizarRelatorioDM();

    // CHAMA A RENDERIZAÇÃO DO NOVO GRÁFICO RESPEITANDO O FILTRO
    if(typeof window.renderizarGraficoOcorrenciasPorTipo === 'function') {
        window.renderizarGraficoOcorrenciasPorTipo();
    }
}

// ================= FUNÇÃO DO GRÁFICO VERTICAL USANDO ECHARTS =================
window.renderizarGraficoOcorrenciasPorTipo = function() {
    const el = document.getElementById('graficoOcorrenciasTipoBarra');
    if (!el) return;

    let osList = [];
    if (typeof ordensServico !== 'undefined') osList = ordensServico;

    // Respeitar o filtro global
    let filtroData = { inicio: new Date(0), fim: new Date(2100, 1, 1) };
    if (typeof window.getDatasFiltroGlobal === 'function') {
        filtroData = window.getDatasFiltroGlobal();
    }

    const filtradas = osList.filter(o => {
        if (o.tipo === 'Sinistro') return false; 
        if (!o.data_abertura) return false;
        let osInicioStr = o.data_abertura;
        if (!osInicioStr.includes('T')) osInicioStr += 'T00:00:00';
        const d = new Date(osInicioStr.replace('Z', '').replace('+00:00', ''));
        return d >= filtroData.inicio && d <= filtroData.fim;
    });

    const contagem = {};
    filtradas.forEach(o => {
        const t = o.tipo || 'Não Informado';
        contagem[t] = (contagem[t] || 0) + 1;
    });

    // Ordenar do maior para o menor
    const sorted = Object.entries(contagem).sort((a,b) => b[1] - a[1]);
    const categories = sorted.map(i => i[0]);
    const data = sorted.map(i => i[1]);

    if (categories.length === 0) {
        el.innerHTML = '<div style="color:#94a3b8; display:flex; justify-content:center; align-items:center; height:100%;">Nenhuma O.S registrada no período selecionado.</div>';
        return;
    }

    // Utilizando a ECharts em vez do ApexCharts
    if (typeof echarts !== 'undefined') {
        el.innerHTML = ''; // Limpa o "Carregando gráfico..."
        
        if (window.chartOcorrenciasTipo) {
            window.chartOcorrenciasTipo.dispose();
        }
        
        window.chartOcorrenciasTipo = echarts.init(el);
        
        const option = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' }
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '25%', // Espaço extra para o texto inclinado
                top: '15%',    // Espaço extra para os números no topo
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: categories,
                axisLabel: {
                    color: '#94a3b8',
                    rotate: 35, // Inclinação dos nomes
                    interval: 0,
                    fontSize: 10,
                    fontWeight: 'bold'
                },
                axisLine: {
                    lineStyle: { color: 'rgba(255,255,255,0.1)' }
                }
            },
            yAxis: {
                type: 'value',
                axisLabel: { color: '#94a3b8' },
                splitLine: {
                    lineStyle: { color: 'rgba(255,255,255,0.05)', type: 'dashed' }
                }
            },
            series: [{
                name: 'Ocorrências',
                type: 'bar',
                data: data,
                barWidth: '40%',
                label: {
                    show: true,
                    position: 'top', // Número acima da barra
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: 14,
                    distance: 5
                },
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#0ea5e9' },
                        { offset: 1, color: '#3b82f6' }
                    ]),
                    borderRadius: [6, 6, 0, 0] // Borda superior arredondada
                }
            }]
        };
        
        window.chartOcorrenciasTipo.setOption(option);
        
        window.addEventListener('resize', () => {
            if (window.chartOcorrenciasTipo) {
                window.chartOcorrenciasTipo.resize();
            }
        });
        
    } else {
        el.innerHTML = '<div style="color:#ef4444; text-align:center;">Erro: Biblioteca de gráficos ECharts não carregada.</div>';
    }
};

// ---------------- RESTANTE DO CÓDIGO ----------------
function renderizarDisponibilidadeMecanica() {
    const tbody = document.getElementById('tabelaDisponibilidade');
    if (!tbody) return;
    
    let totalCavalos = frotasManutencao.length;
    let manutencao = 0;
    let sinistrados = 0;
    let disponiveis = 0;
    
    const filtroDataInput = document.getElementById('filtroDataDisponibilidade')?.value;
    const isTempoReal = !filtroDataInput; 
    let tituloH4 = document.getElementById('tituloTabelaDisponibilidade');
    
    if (tituloH4) {
        if (isTempoReal) {
            tituloH4.innerHTML = `Situação da Frota (Tempo Real - ${new Date().toLocaleDateString('pt-BR')})`;
        } else {
            const d = new Date(filtroDataInput + 'T12:00:00');
            tituloH4.innerHTML = `Histórico (Retrato do dia ${d.toLocaleDateString('pt-BR')})`;
        }
    }
    
    let linhasHtml = [];
    
    frotasManutencao.forEach(frota => {
        let status = 'Disponível';
        let osVinculada = null;
        let dataInicioParadaStr = '-';
        let descricaoMotivo = 'Operacional / Disponível';
        let tempoParadoTexto = '-';
        
        let dataAlvoInicio, dataAlvoFim;
        
        if (isTempoReal) {
            osVinculada = ordensServico.find(o => o.placa === frota.cavalo && o.status !== 'Concluída' && o.status !== 'Agendada');
            dataAlvoFim = new Date();
        } else {
            const dataFiltroStr = filtroDataInput;
            const fimDoDiaFiltro = new Date(dataFiltroStr + 'T23:59:59');
            dataAlvoFim = fimDoDiaFiltro;
            
            osVinculada = ordensServico.find(o => {
                if (o.placa !== frota.cavalo) return false;
                if (!o.data_abertura) return false;
                
                let osInicioStr = o.data_abertura;
                if (!osInicioStr.includes('T')) osInicioStr += 'T00:00:00';
                const osInicio = new Date(osInicioStr.replace('Z', '').replace('+00:00', ''));
                
                if (osInicio > fimDoDiaFiltro) return false;
                if (o.status === 'Agendada' && o.data_conclusao === null) return false; 
                if (o.status === 'Concluída' && o.data_conclusao) {
                    let osFimStr = o.data_conclusao;
                    if (!osFimStr.includes('T')) osFimStr += 'T00:00:00';
                    const osFim = new Date(osFimStr.replace('Z', '').replace('+00:00', ''));
                    if (osFim < fimDoDiaFiltro) return false;
                }
                return true; 
            });
        }
        
        if (osVinculada) {
            let osInicioStr = osVinculada.data_abertura;
            if (osInicioStr) {
                if (!osInicioStr.includes('T')) osInicioStr += 'T00:00:00';
                dataAlvoInicio = new Date(osInicioStr.replace('Z', '').replace('+00:00', ''));
                dataInicioParadaStr = dataAlvoInicio.toLocaleString('pt-BR');
                
                const diffMs = dataAlvoFim - dataAlvoInicio;
                if (diffMs > 0) {
                    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                    const diffMin = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    tempoParadoTexto = `${diffHrs}h ${diffMin}m`;
                }
            }
            
            if (osVinculada.tipo === 'Sinistro' || osVinculada.status === 'Sinistrado') {
                status = 'Sinistrado';
                sinistrados++;
                descricaoMotivo = `[Sinistro] ${osVinculada.problema || 'Acidente/Avaria grave reportada'}`;
            } else {
                status = 'Oficina';
                manutencao++;
                descricaoMotivo = `[${osVinculada.tipo}] ${osVinculada.problema || 'Manutenção em andamento'}`;
            }
        } else {
            disponiveis++;
        }
        
        let bgRow = '';
        let statusBadge = `<span style="color: var(--ccol-green-bright); font-weight: bold;">  Disponível</span>`;
        
        if (status === 'Oficina') {
            bgRow = 'background: rgba(245, 158, 11, 0.05);';
            statusBadge = `<span style="color: #f59e0b; font-weight: bold;">  Em Oficina</span>`;
        } else if (status === 'Sinistrado') {
            bgRow = 'background: rgba(239, 68, 68, 0.05);';
            statusBadge = `<span style="color: #ef4444; font-weight: bold;">  Sinistrado</span>`;
        }
        
        linhasHtml.push({
            statusObj: status,
            html: `
            <tr style="${bgRow}">
                <td style="color: var(--ccol-blue-bright); font-weight: bold; font-size: 1.1rem;">${frota.cavalo}</td>
                <td>${frota.go || '-'}</td>
                <td>${statusBadge}</td>
                <td>${osVinculada ? `#${osVinculada.id}` : '-'}</td>
                <td>${dataInicioParadaStr}</td>
                <td style="max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${descricaoMotivo}">
                    ${descricaoMotivo}
                </td>
                <td style="color: #ef4444; font-weight: bold;">${tempoParadoTexto}</td>
            </tr>
            `
        });
    });
    
    linhasHtml.sort((a, b) => {
        const order = { 'Sinistrado': 1, 'Oficina': 2, 'Disponível': 3 };
        return order[a.statusObj] - order[b.statusObj];
    });
    
    tbody.innerHTML = linhasHtml.map(l => l.html).join('');
    
    const dmCalc = totalCavalos > 0 ? ((disponiveis / totalCavalos) * 100).toFixed(1) : 0;
    
    if (document.getElementById('kpiDispTotal')) document.getElementById('kpiDispTotal').innerText = totalCavalos;
    if (document.getElementById('kpiDispDisponiveis')) document.getElementById('kpiDispDisponiveis').innerText = disponiveis;
    if (document.getElementById('kpiDispManutencao')) document.getElementById('kpiDispManutencao').innerText = manutencao;
    if (document.getElementById('kpiDispSinistro')) document.getElementById('kpiDispSinistro').innerText = sinistrados;
    
    if (document.getElementById('kpiDispTaxa')) {
        const pTaxa = document.getElementById('kpiDispTaxa');
        pTaxa.innerText = dmCalc + '%';
        pTaxa.style.color = dmCalc >= 90 ? 'var(--ccol-green-bright)' : (dmCalc >= 80 ? '#f59e0b' : '#ef4444');
    }
}

function renderizarRelatorioDM() {
    const tbody = document.getElementById('tabelaRelatorioDM');
    if (!tbody) return;
    
    const filtroValue = document.getElementById('filtroPeriodoDM')?.value || '30';
    const agora = new Date();
    let inicioPeriodo;
    let totalMsPeriodo;
    let diasParaGrafico;
    
    if (filtroValue === 'mes_atual') {
        inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0);
        totalMsPeriodo = agora.getTime() - inicioPeriodo.getTime();
        diasParaGrafico = Math.ceil(totalMsPeriodo / (1000 * 60 * 60 * 24)); 
    } else {
        const dias = parseInt(filtroValue);
        totalMsPeriodo = dias * 24 * 60 * 60 * 1000;
        inicioPeriodo = new Date(agora.getTime() - totalMsPeriodo);
        diasParaGrafico = dias;
    }
    
    const totalHorasPeriodo = (totalMsPeriodo / (1000 * 60 * 60)).toFixed(1);
    
    let dmData = [];
    
    frotasManutencao.forEach(frota => {
        let manutencaoMs = 0;
        let statusAtual = `<span style="color: var(--ccol-green-bright); font-weight: bold;">  Disponível</span>`;
        
        const osAberta = ordensServico.find(o => o.placa === frota.cavalo && o.status !== 'Concluída');
        if (osAberta) { 
            if (osAberta.tipo === 'Sinistro' || osAberta.status === 'Sinistrado') statusAtual = `<span style="color: #ef4444; font-weight: bold;">  Sinistrado</span>`; 
            else if (osAberta.status === 'Agendada') statusAtual = `<span style="color: #8b5cf6; font-weight: bold;">  Agendado</span>`; 
            else statusAtual = `<span style="color: #f59e0b; font-weight: bold;">  Em Oficina</span>`;
        }
        
        const todasOSCavalo = ordensServico.filter(o => o.placa === frota.cavalo);
        todasOSCavalo.forEach(os => {
            let osInicioStr = os.data_abertura;
            if (!osInicioStr) return; 
            if (!osInicioStr.includes('T')) osInicioStr += 'T00:00:00';
            const osInicio = new Date(osInicioStr.replace('Z', '').replace('+00:00', ''));
            
            let osFim = agora;              
            if (os.data_conclusao) {
                let osFimStr = os.data_conclusao;
                if (!osFimStr.includes('T')) osFimStr += 'T00:00:00';
                osFim = new Date(osFimStr.replace('Z', '').replace('+00:00', ''));
            }
            
            const overlapInicio = osInicio > inicioPeriodo ? osInicio : inicioPeriodo;
            const overlapFim = osFim < agora ? osFim : agora;
            
            if (overlapInicio < overlapFim && os.status !== 'Agendada') { 
                manutencaoMs += (overlapFim - overlapInicio);
            }
        });
        
        if (manutencaoMs > totalMsPeriodo) manutencaoMs = totalMsPeriodo;
        
        const disponivelMs = totalMsPeriodo - manutencaoMs;
        const dmPercent = totalMsPeriodo > 0 ? ((disponivelMs / totalMsPeriodo) * 100).toFixed(2) : 100;
        
        const horasManutencao = Math.floor(manutencaoMs / (1000 * 60 * 60));
        const minManutencao = Math.floor((manutencaoMs % (1000 * 60 * 60)) / (1000 * 60));
        
        const horasDisp = Math.floor(disponivelMs / (1000 * 60 * 60));
        const minDisp = Math.floor((disponivelMs % (1000 * 60 * 60)) / (1000 * 60));
        
        dmData.push({
            cavalo: frota.cavalo,
            totalHoras: `${totalHorasPeriodo}h`,
            manutencaoStr: `${horasManutencao}h ${minManutencao}m`,
            disponivelStr: `${horasDisp}h ${minDisp}m`,
            dm: parseFloat(dmPercent),
            statusAtual
        });
    });
    
    dmData.sort((a, b) => a.dm - b.dm);
    
    tbody.innerHTML = dmData.map(item => {
        let colorDM = 'var(--ccol-green-bright)'; 
        if (item.dm < 90) colorDM = '#f59e0b'; 
        if (item.dm < 80) colorDM = '#ef4444'; 
        
        return `
            <tr style="background: rgba(0,0,0,0.1);">
                <td style="color: var(--ccol-blue-bright); font-weight: bold; font-size: 1.1rem;">${item.cavalo}</td>
                <td style="color: var(--text-secondary);">${item.totalHoras}</td>
                <td style="color: #ef4444; font-weight: bold;">${item.manutencaoStr}</td>
                <td style="color: var(--ccol-green-bright);">${item.disponivelStr}</td>
                <td style="color: ${colorDM}; font-weight: 900; font-size: 1.2rem;">${item.dm}%</td>
                <td>${item.statusAtual}</td>
            </tr>
        `;
    }).join('');
    
    window.dmDataAtualExport = dmData;
    
    setTimeout(() => {
        if(typeof window.renderizarGraficoEvolucaoDM === 'function') {
            window.renderizarGraficoEvolucaoDM(filtroValue);
        }
        
        if(typeof window.renderizarGraficoDMOperacional === 'function') {
            const divGrafico = document.getElementById('graficoDmOperacional');
            if (divGrafico) divGrafico.removeAttribute('data-rendered');
            window.renderizarGraficoDMOperacional(filtroValue); 
        }
    }, 250);
}

function exportarDisponibilidadeExcel() {
    const tbody = document.getElementById('tabelaDisponibilidade');
    if (!tbody || tbody.rows.length === 0) {
        alert("Não há dados de disponibilidade para exportar.");
        return;
    }
    
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Placa (Cavalo);GO;Status;OS Vinculada;Inicio Parada;Motivo / Diagnostico;Tempo Indisponivel\n";
    
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length >= 7) {
            const linha = [
                `"${cols[0].innerText}"`,
                `"${cols[1].innerText}"`,
                `"${cols[2].innerText.replace('  ', '').replace('  ', '').replace('  ', '')}"`,
                `"${cols[3].innerText}"`,
                `"${cols[4].innerText}"`,
                `"${cols[5].innerText}"`,
                `"${cols[6].innerText}"`
            ].join(';');
            csvContent += linha + "\n";
        }
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    
    const inputFiltro = document.getElementById('filtroDataDisponibilidade');
    const dataExcel = (inputFiltro && inputFiltro.value) ? inputFiltro.value : new Date().toISOString().split('T')[0];
    
    link.setAttribute("download", `Relatorio_Disponibilidade_${dataExcel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportarRelatorioDMExcel() {
    if (!window.dmDataAtualExport || window.dmDataAtualExport.length === 0) {
        alert("Não há dados de DM para exportar.");
        return;
    }
    
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Placa Cavalo;Tempo Total Período;Tempo Manutenção;Tempo Disponível;Índice DM (%)\n";
    
    window.dmDataAtualExport.forEach(item => {
        const linha = [
            item.cavalo,
            item.totalHoras,
            item.manutencaoStr,
            item.disponivelStr,
            item.dm
        ].join(';');
        csvContent += linha + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    
    const select = document.getElementById('filtroPeriodoDM');
    const periodo = select ? select.options[select.selectedIndex].text : 'Relatorio';
    const nomeArquivo = `Relatorio_DM_${periodo.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    
    link.setAttribute("download", nomeArquivo);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function entrarModoTV() {
    const telaTV = document.getElementById('telaPainelTV');
    if (!telaTV) return;
    
    telaTV.style.display = 'block';
    telaTV.style.position = 'fixed';
    telaTV.style.top = '0';
    telaTV.style.left = '0';
    telaTV.style.width = '100vw';
    telaTV.style.height = '100vh';
    telaTV.style.zIndex = '99999';
    telaTV.style.overflowY = 'auto'; 
    
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(err => console.warn("Fullscreen falhou:", err));
    }
    
    atualizarRelogioTV();
    if (!window.tvClockInterval) {
        window.tvClockInterval = setInterval(atualizarRelogioTV, 1000);
    }
    
    setTimeout(renderizarCardsTV, 100);
    
    if (window.tvInterval) clearInterval(window.tvInterval);
    window.tvInterval = setInterval(() => {
        if(typeof carregarDadosOS === 'function') {
            carregarDadosOS().then(renderizarCardsTV);
        } else {
            renderizarCardsTV();
        }
    }, 15000);
}

function sairModoTV() {
    const telaTV = document.getElementById('telaPainelTV');
    if (telaTV) {
        telaTV.style.display = 'none';
        telaTV.style.position = ''; 
        telaTV.style.zIndex = '';
    }
    
    if (window.tvInterval) clearInterval(window.tvInterval);
    if (window.tvClockInterval) {
        clearInterval(window.tvClockInterval);
        window.tvClockInterval = null;
    }
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.warn(err));
    }
}

function renderizarCardsTV() {
    const container = document.getElementById('tvCardsContainer');
    if (!container) return;
    
    const osAtivas = ordensServico.filter(o => 
        (o.status === 'Aguardando Oficina' || o.status === 'Em Manutenção') && 
        o.tipo !== 'Sinistro'
    );
    
    if (osAtivas.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh;">
                <h1 style="color: var(--ccol-green-bright); font-size: 4rem; margin: 0;">PÁTIO VAZIO  </h1>
                <p style="color: #94a3b8; font-size: 2rem;">Nenhum veículo aguardando manutenção.</p>
            </div>
        `;
        return;
    }
    
    osAtivas.sort((a, b) => {
        const pesoPri = { 'Urgente': 4, 'Alta': 3, 'Normal': 2, 'Baixa': 1 };
        const pA = pesoPri[a.prioridade] || 0;
        const pB = pesoPri[b.prioridade] || 0;
        if (pA !== pB) return pB - pA;
        return new Date(a.data_abertura) - new Date(b.data_abertura);
    });
    
    const agora = new Date();
    
    container.innerHTML = osAtivas.map(os => {
        let corPrioridade = '#3b82f6'; 
        if (os.prioridade === 'Urgente') corPrioridade = '#ef4444';
        else if (os.prioridade === 'Alta') corPrioridade = '#f97316';
        else if (os.prioridade === 'Baixa') corPrioridade = '#10b981';
        
        let diffHrs = 0;
        let diffMin = 0;
        let entradaHoraStr = '--:--';
        
        if (os.data_abertura) {
            const inicio = new Date(os.data_abertura.replace('Z', '').replace('+00:00', ''));
            const diffMs = agora - inicio;
            if(diffMs > 0) {
                diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                diffMin = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            }
            entradaHoraStr = inicio.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        }
        
        let colorCronometro = '#fff';
        let alertaClass = '';
        if (diffHrs >= 24) { colorCronometro = '#ef4444'; alertaClass = 'piscar-alerta'; } 
        else if (diffHrs >= 12) { colorCronometro = '#f59e0b'; }
        
        const frotaVinculada = frotasManutencao.find(f => f.cavalo === os.placa) || {};
        const conjuntosBadge = [frotaVinculada.carreta1, frotaVinculada.carreta2, frotaVinculada.carreta3]
            .filter(Boolean)
            .map(c => `<span style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-size: 0.85rem; border: 1px solid rgba(255,255,255,0.2); margin-right: 5px;">${c}</span>`)
            .join('');
            
        let avisoPrevisao = '';
        let campoPrevisao = os.previsao_entrega || os.previsao;
        
        if (campoPrevisao) {
            const dataPrevisao = new Date(campoPrevisao.replace('Z', '').replace('+00:00', ''));
            if (agora > dataPrevisao) {
                avisoPrevisao = `<div style="background: #ef4444; color: #fff; padding: 5px; text-align: center; font-weight: bold; border-radius: 4px; margin-top: 10px; font-size: 1rem; border: 2px solid #fff;">  PREVISÃO VENCIDA: ${formatarDataHoraBrasil(campoPrevisao)}</div>`;
            } else {
                avisoPrevisao = `<div style="background: rgba(139, 92, 246, 0.2); color: #c4b5fd; padding: 5px; text-align: center; border: 1px solid #8b5cf6; border-radius: 4px; margin-top: 10px; font-size: 0.9rem;">PREVISÃO: ${formatarDataHoraBrasil(campoPrevisao)}</div>`;
            }
        } else {
             avisoPrevisao = `<div style="background: rgba(255,255,255,0.05); color: #94a3b8; padding: 5px; text-align: center; border-radius: 4px; margin-top: 10px; font-size: 0.9rem;">AGUARDANDO PREVISÃO</div>`;
        }
        
        const textoStatus = os.status === 'Em Manutenção' ? '  EM OFICINA' : '  AGUARDANDO ATENDIMENTO';
        const bgStatus = os.status === 'Em Manutenção' ? '#1e3a8a' : '#1e293b'; 
        const borderStatus = os.status === 'Em Manutenção' ? '#3b82f6' : '#475569'; 
        
        // CORREÇÃO AQUI: Lendo a coluna correta (mecanico_responsavel)
        const nomeDoMecanico = os.mecanico_responsavel || os.mecanico || 'NÃO ATRIBUÍDO';

        return `
            <div class="${alertaClass}" style="background: ${bgStatus}; border: 3px solid ${borderStatus}; border-radius: 12px; padding: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                    <div>
                        <div style="font-size: 1rem; color: #94a3b8; margin-bottom: 5px;">O.S. #${os.id} | ${textoStatus}</div>
                        <div style="font-size: 3rem; font-weight: 900; color: #fff; line-height: 1;">${os.placa}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="background: ${corPrioridade}; color: #fff; font-weight: bold; padding: 5px 15px; border-radius: 20px; font-size: 1.1rem; text-transform: uppercase;">
                            ${os.prioridade}
                        </div>
                    </div>
                </div>
                
                <div style="margin-bottom: 15px;">${conjuntosBadge}</div>
                
                <div style="background: rgba(0,0,0,0.4); border-radius: 8px; padding: 15px; margin-bottom: 15px; flex: 1;">
                    <div style="color: #60a5fa; font-weight: bold; font-size: 1.2rem; margin-bottom: 5px;">${os.tipo}</div>
                    <div style="color: #cbd5e1; font-size: 1.1rem;">Motorista: <strong style="color: #fff;">${os.motorista}</strong></div>
                    <div style="color: #cbd5e1; font-size: 1.1rem; margin-top: 5px;">Mecânico: <strong style="color: var(--ccol-green-bright); text-transform: uppercase;">${nomeDoMecanico}</strong></div>
                    <div style="color: #94a3b8; font-size: 0.9rem; margin-top: 8px; max-height: 60px; overflow: hidden; text-overflow: ellipsis;">
                        Detalhe: ${os.problema || 'Nenhum detalhe reportado'}
                    </div>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
                    <div style="color: #94a3b8; font-size: 1rem;">
                        Entrada: <br><strong style="color: #fff;">${entradaHoraStr}</strong>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.9rem; color: #94a3b8;">TEMPO NO PÁTIO</div>
                        <div style="font-size: 2.2rem; font-weight: 900; color: ${colorCronometro}; font-family: monospace;">
                            ${String(diffHrs).padStart(2,'0')}:${String(diffMin).padStart(2,'0')}
                        </div>
                    </div>
                </div>
                ${avisoPrevisao}
            </div>
        `;
    }).join('');
}

function atualizarRelogioTV() {
    const elRelogio = document.getElementById('tvRelogio');
    const elData = document.getElementById('tvData');
    if (!elRelogio || !elData) return;
    
    const agora = new Date();
    elRelogio.innerText = agora.toLocaleTimeString('pt-BR');
    const opcoesData = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    elData.innerText = agora.toLocaleDateString('pt-BR', opcoesData).toUpperCase();
}

function exportarHistoricoOSExcel() {
    const num = document.getElementById('filtroHistOSNum')?.value.toLowerCase();
    const placa = document.getElementById('filtroHistPlaca')?.value;
    const motorista = document.getElementById('filtroHistMotorista')?.value;
    const dataInicio = document.getElementById('filtroHistDataInicio')?.value;
    const dataFim = document.getElementById('filtroHistDataFim')?.value;
    const tipo = document.getElementById('filtroHistTipo')?.value;
    const mesAno = document.getElementById('filtroHistMesAno')?.value;
    
    let filtradas = ordensServico;
    
    if (num) filtradas = filtradas.filter(o => o.id.toString() === num);
    if (placa) filtradas = filtradas.filter(o => o.placa && o.placa.toUpperCase() === placa.toUpperCase());
    if (motorista) filtradas = filtradas.filter(o => o.motorista && o.motorista === motorista);
    
    if (mesAno) {
        filtradas = filtradas.filter(o => {
            if (!o.data_abertura) return false;
            return o.data_abertura.substring(0, 7) === mesAno;
        });
    }
    
    if (dataInicio || dataFim) {
        filtradas = filtradas.filter(o => {
            if (!o.data_abertura) return false;
            const dtAbertura = o.data_abertura.split('T')[0];
            if (dataInicio && dtAbertura < dataInicio) return false;
            if (dataFim && dtAbertura > dataFim) return false;
            return true;
        });
    }

    if (tipo) {
        filtradas = filtradas.filter(o => o.tipo && o.tipo === tipo);
    }
    
    if (filtradas.length === 0) {
        alert("Não há dados para exportar com os filtros atuais.");
        return;
    }
    
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Nº O.S.;Placa (Cavalo);Motorista;Tipo de Serviço;Status;Prioridade;Data Abertura;Data Conclusão;Tempo Aberta (Horas/Minutos)\n";
    
    filtradas.forEach(os => {
        const inicioStr = formatarDataHoraBrasil(os.data_abertura);
        const conclusaoStr = os.data_conclusao ? formatarDataHoraBrasil(os.data_conclusao) : 'Em Aberto';
        
        let tempoAbertaTexto = '-';
        if (os.data_abertura) {
            const inicio = new Date(os.data_abertura.replace('Z', '').replace('+00:00', ''));
            let fim = new Date();              
            if (os.data_conclusao) {
                fim = new Date(os.data_conclusao.replace('Z', '').replace('+00:00', ''));
            }
            
            if (!isNaN(inicio) && !isNaN(fim) && fim >= inicio) {
                const diffMs = fim - inicio;
                const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                const diffMin = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                tempoAbertaTexto = `${diffHrs}h ${diffMin}m`; 
            }
        }
        
        const linha = [
            `"${os.id}"`,
            `"${os.placa || '-'}"`,
            `"${os.motorista || '-'}"`,
            `"${os.tipo || '-'}"`,
            `"${os.status || '-'}"`,
            `"${os.prioridade || 'Normal'}"`,
            `"${inicioStr}"`,
            `"${conclusaoStr}"`,
            `"${tempoAbertaTexto}"`
        ].join(';');
        
        csvContent += linha + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Historico_Completo_OS_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function loadScriptPDF(url) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${url}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function exportarHistoricoOSPDF() {
    try {
        await loadScriptPDF('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        await loadScriptPDF('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
    } catch(e) {
        alert("Não foi possível carregar as bibliotecas de exportação PDF. Verifique a conexão com a internet.");
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    
    const num = document.getElementById('filtroHistOSNum')?.value.toLowerCase();
    const placa = document.getElementById('filtroHistPlaca')?.value;
    const motorista = document.getElementById('filtroHistMotorista')?.value;
    const dataInicio = document.getElementById('filtroHistDataInicio')?.value;
    const dataFim = document.getElementById('filtroHistDataFim')?.value;
    const tipoFiltro = document.getElementById('filtroHistTipo')?.value;
    const mesAno = document.getElementById('filtroHistMesAno')?.value;
    
    let filtradas = ordensServico;
    
    if (num) filtradas = filtradas.filter(o => o.id.toString() === num);
    if (placa) filtradas = filtradas.filter(o => o.placa && o.placa.toUpperCase() === placa.toUpperCase());
    if (motorista) filtradas = filtradas.filter(o => o.motorista && o.motorista === motorista);
    
    if (mesAno) {
        filtradas = filtradas.filter(o => {
            if (!o.data_abertura) return false;
            return o.data_abertura.substring(0, 7) === mesAno;
        });
    }
    
    if (dataInicio || dataFim) {
        filtradas = filtradas.filter(o => {
            if (!o.data_abertura) return false;
            const dtAbertura = o.data_abertura.split('T')[0];
            if (dataInicio && dtAbertura < dataInicio) return false;
            if (dataFim && dtAbertura > dataFim) return false;
            return true;
        });
    }

    if (tipoFiltro) {
        filtradas = filtradas.filter(o => o.tipo && o.tipo === tipoFiltro);
    }
    
    if (filtradas.length === 0) {
        alert("Não há dados para exportar com os filtros atuais.");
        return;
    }
    
    let temposPorTipo = {};
    let linhasTabela = [];
    
    filtradas.forEach(os => {
        const inicioStr = formatarDataHoraBrasil(os.data_abertura);
        const conclusaoStr = os.data_conclusao ? formatarDataHoraBrasil(os.data_conclusao) : 'Em Aberto';
        
        let tempoAbertaTexto = '-';
        let tempoMs = 0;
        
        if (os.data_abertura) {
            const inicio = new Date(os.data_abertura.replace('Z', '').replace('+00:00', ''));
            let fim = new Date();              
            if (os.data_conclusao) {
                fim = new Date(os.data_conclusao.replace('Z', '').replace('+00:00', ''));
            }
            
            if (!isNaN(inicio) && !isNaN(fim) && fim >= inicio) {
                tempoMs = fim - inicio;
                const diffHrs = Math.floor(tempoMs / (1000 * 60 * 60));
                const diffMin = Math.floor((tempoMs % (1000 * 60 * 60)) / (1000 * 60));
                tempoAbertaTexto = `${diffHrs}h ${diffMin}m`; 
            }
        }
        
        const tipoDesc = os.tipo || 'Não Informado';
        
        if (!temposPorTipo[tipoDesc]) {
            temposPorTipo[tipoDesc] = { count: 0, totalMs: 0 };
        }
        temposPorTipo[tipoDesc].count++;
        temposPorTipo[tipoDesc].totalMs += tempoMs;
        
        linhasTabela.push([
            `#${os.id}`,
            os.placa || '-',
            tipoDesc,
            os.status || '-',
            inicioStr,
            conclusaoStr,
            tempoAbertaTexto
        ]);
    });
    
    let linhasResumo = [];
    for (const [tipo, dados] of Object.entries(temposPorTipo)) {
        if(dados.count > 0) {
            const mediaMs = dados.totalMs / dados.count;
            const mediaHrs = Math.floor(mediaMs / (1000 * 60 * 60));
            const mediaMin = Math.floor((mediaMs % (1000 * 60 * 60)) / (1000 * 60));
            linhasResumo.push([tipo, dados.count.toString(), `${mediaHrs}h ${mediaMin}m`]);
        }
    }
    
    linhasResumo.sort((a, b) => a[0].localeCompare(b[0]));
    linhasTabela.sort((a, b) => a[2].localeCompare(b[2]));
    
    const logoUrl = 'assets/logoverde.png';
    const img = new Image();
    
    img.onload = () => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');
            gerarDocumentoPDF(doc, dataUrl, linhasResumo, linhasTabela);
        } catch(e) {
            console.warn("Aviso de segurança ao ler imagem local. Tentando fallback.");
            gerarDocumentoPDF(doc, img, linhasResumo, linhasTabela);
        }
    };
    img.onerror = () => {
        console.warn("Logomarca não encontrada ou bloqueada:", logoUrl);
        gerarDocumentoPDF(doc, null, linhasResumo, linhasTabela); 
    };
    img.src = logoUrl;
}

function gerarDocumentoPDF(doc, logoDataUrl, linhasResumo, linhasTabela) {
    const pageWidth = doc.internal.pageSize.getWidth ? doc.internal.pageSize.getWidth() : doc.internal.pageSize.width;
    
    if (logoDataUrl) {
        try {
            doc.addImage(logoDataUrl, 'PNG', pageWidth - 59, 10, 45, 15);
        } catch(e) {
            console.warn("Aviso: Falha ao desenhar a logomarca no PDF.", e);
        }
    }
    
    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text("Relatório Histórico de Ordens de Serviço", 14, 35);
    
    doc.setFontSize(10);
    doc.text(`Data de Emissão: ${new Date().toLocaleString('pt-BR')}`, 14, 42);
    
    doc.autoTable({
        startY: 48,
        head: [['Tipo de Serviço', 'Qtd. de O.S.', 'Média de Tempo Parada']],
        body: linhasResumo,
        theme: 'grid',
        headStyles: { fillColor: [4, 120, 87] },
        margin: { top: 10 },
        styles: { fontSize: 10 }
    });
    
    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 15,
        head: [['Nº O.S.', 'Cavalo', 'Tipo de Serviço', 'Status', 'Data Abertura', 'Data Conclusão', 'Tempo Total']],
        body: linhasTabela,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] },
        styles: { fontSize: 9 }
    });
    
    doc.save(`Relatorio_Historico_OS_${new Date().toISOString().split('T')[0]}.pdf`);
}