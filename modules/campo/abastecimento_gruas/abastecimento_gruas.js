// URL da Planilha Google (formato CSV)
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1uQekwV3xaU-EIGikUaaeik_SdhtQLueaBPCVslUB3kY/export?format=csv&gid=1959920910";

let chartAbastecimento = null;
let dadosGlobaisAbastecimento = []; // Armazena os dados originais da planilha para filtrar localmente

window.initAbastecimentoGruas = async function() {
    const tbody = document.getElementById('tbodyAbastecimento');
    const infoLabelChart = document.getElementById('loadingChartInfo');
    const infoLabelKpi = document.getElementById('loadingKpiInfo');
    
    if(infoLabelChart) infoLabelChart.innerText = "(Sincronizando...)";
    if(infoLabelKpi) infoLabelKpi.innerText = "- Sincronizando Planilha...";

    try {
        const response = await fetch(SHEET_CSV_URL);
        
        if (!response.ok) {
            throw new Error(`Erro na resposta da rede: ${response.status}`);
        }
        
        const csvText = await response.text();

        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                dadosGlobaisAbastecimento = results.data;
                
                // Por padrão, aplica o filtro do mês atual assim que carrega
                aplicarFiltroData('mes_atual', true);
                
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Planilha sincronizada com sucesso!',
                    showConfirmButton: false,
                    timer: 3000,
                    background: '#1e293b',
                    color: '#fff'
                });
            },
            error: function(err) {
                console.error("Erro no PapaParse:", err);
                Swal.fire('Erro', 'Não foi possível processar a planilha.', 'error');
            }
        });
    } catch (error) {
        console.error("Erro ao buscar dados da planilha:", error);
        if(tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:#ef4444;">Erro ao conectar com a planilha. Verifique se o link possui permissão pública de visualização.</td></tr>`;
        if(infoLabelChart) infoLabelChart.innerText = "(Erro na sincronização)";
    }
};

// ==========================================
// FUNÇÕES DE FILTRO DE DATA
// ==========================================

// Função inteligente para ler a data independentemente se vem MM/DD/YYYY ou DD/MM/YYYY
function parseDataPlanilha(strData) {
    if (!strData) return null;
    let partes = strData.trim().split(' ');
    let dataParte = partes[0]; 
    let dma = dataParte.split('/');
    
    if (dma.length === 3) {
        let p1 = parseInt(dma[0]); 
        let p2 = parseInt(dma[1]); 
        let p3 = parseInt(dma[2]);
        
        // Verifica se é formato Americano (MM/DD/YYYY) ex: 8/28/2026
        if (p2 > 12) {
            return new Date(p3, p1 - 1, p2); // Mês(p1), Dia(p2), Ano(p3)
        } 
        // Verifica se é formato Brasileiro (DD/MM/YYYY) ex: 28/08/2026
        else if (p1 > 12) {
            return new Date(p3, p2 - 1, p1); // Dia(p1), Mês(p2), Ano(p3)
        } 
        // Se ambos forem <= 12, a conversão nativa resolve pelo padrão do navegador
        else {
            let nativo = new Date(strData);
            if (!isNaN(nativo.getTime())) return nativo;
            return new Date(p3, p1 - 1, p2); // Assume M/D/Y como fallback
        }
    }
    
    let fallback = new Date(strData);
    if (!isNaN(fallback.getTime())) return fallback;
    return null;
}

window.aplicarFiltroData = function(tipo, isInitialLoad = false) {
    const inputInicio = document.getElementById('filtroDataInicio');
    const inputFim = document.getElementById('filtroDataFim');
    const thead = document.getElementById('theadAbastecimento');
    const tbody = document.getElementById('tbodyAbastecimento');
    
    let inicio = null;
    let fim = null;
    let hoje = new Date();

    if (tipo === 'mes_atual') {
        inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0); // Último dia do mês
        
        // Atualiza os inputs para mostrar visualmente o período do mês atual
        if(inputInicio) inputInicio.value = inicio.toISOString().split('T')[0];
        if(inputFim) inputFim.value = fim.toISOString().split('T')[0];
    } 
    else if (tipo === 'tudo') {
        if(inputInicio) inputInicio.value = '';
        if(inputFim) inputFim.value = '';
    } 
    else if (tipo === 'custom') {
        if (inputInicio && inputInicio.value) {
            inicio = new Date(inputInicio.value + 'T00:00:00');
        }
        if (inputFim && inputFim.value) {
            fim = new Date(inputFim.value + 'T23:59:59');
        }
    }

    // Filtrando o array original
    let dadosFiltrados = dadosGlobaisAbastecimento.filter(row => {
        // Se for pra mostrar tudo, passa direto
        if (!inicio && !fim) return true;

        const colunas = Object.keys(row);
        const colData = colunas.find(c => c.toLowerCase().includes('data/hora') || c.toLowerCase() === 'data');
        
        if (!colData || !row[colData]) return false;

        let dataRow = parseDataPlanilha(row[colData]);
        if (!dataRow) return false;

        let passaInicio = true;
        let passaFim = true;

        if (inicio) passaInicio = dataRow >= inicio;
        if (fim) {
            let fimAjustado = new Date(fim);
            fimAjustado.setHours(23, 59, 59, 999);
            passaFim = dataRow <= fimAjustado;
        }

        return passaInicio && passaFim;
    });

    // Atualiza a tela com os dados filtrados
    renderizarTabelaGenerica(dadosFiltrados, thead, tbody);
    processarIndicadoresDashboard(dadosFiltrados);

    const infoLabelChart = document.getElementById('loadingChartInfo');
    const infoLabelKpi = document.getElementById('loadingKpiInfo');
    let msgFiltro = tipo === 'tudo' ? '(Todo o Período)' : `(${dadosFiltrados.length} Registros Filtrados)`;
    if(infoLabelChart) infoLabelChart.innerText = msgFiltro;
    if(infoLabelKpi) infoLabelKpi.innerText = msgFiltro;

    if (!isInitialLoad) {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'info',
            title: 'Filtro Aplicado!',
            showConfirmButton: false,
            timer: 1500,
            background: '#1e293b',
            color: '#fff'
        });
    }
};

// ==========================================
// RENDERIZAÇÃO DA TABELA E GRÁFICOS
// ==========================================

function renderizarTabelaGenerica(dados, thead, tbody) {
    if (!dados || dados.length === 0) {
        thead.innerHTML = '';
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-secondary);">Nenhum registro encontrado para este período.</td></tr>`;
        return;
    }

    const colunas = Object.keys(dados[0]);
    
    thead.innerHTML = colunas.map(col => `<th style="padding: 12px; border-bottom: 1px solid var(--border-dim); color: var(--ccol-blue-bright);">${col}</th>`).join('');

    let htmlCorpo = '';
    dados.forEach(linha => {
        htmlCorpo += '<tr>';
        colunas.forEach(col => {
            htmlCorpo += `<td style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #e2e8f0;">${linha[col] || '-'}</td>`;
        });
        htmlCorpo += '</tr>';
    });
    
    tbody.innerHTML = htmlCorpo;
}

// Função para garantir a leitura correta de números com padrão Brasileiro
function parseBR(str) {
    if (!str) return 0;
    let s = str.toString().trim();
    if (s.includes(',')) {
        return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
    }
    return parseFloat(s) || 0;
}

function processarIndicadoresDashboard(dados) {
    const kpiContainer = document.getElementById('kpiContainerMaquinas');
    const chartContainer = document.getElementById('graficoConsumoGruas');
    
    if (!dados || dados.length === 0) {
        if(kpiContainer) kpiContainer.innerHTML = '<div style="color:#94a3b8;">Sem dados para gerar KPIs.</div>';
        if(chartAbastecimento) chartAbastecimento.clear();
        return;
    }

    const colunas = Object.keys(dados[0]);
    
    // Normaliza os nomes das colunas
    const colunasNorm = colunas.map(c => c.toLowerCase().replace(/\s/g, ''));
    
    const idxGrua = colunasNorm.findIndex(c => c.includes('grua') || c.includes('maquina') || c.includes('frota'));
    const idxMedia = colunasNorm.findIndex(c => c.includes('lts/hmaq') || c.includes('media'));
    const idxLts = colunasNorm.findIndex(c => (c.includes('lts') || c.includes('litro')) && c !== colunasNorm[idxMedia]);
    const idxHoras = colunasNorm.findIndex(c => (c.includes('hmaq') || c.includes('hora')) && c !== colunasNorm[idxMedia]);

    const colGrua = colunas[idxGrua];
    const colMediaLtsH = colunas[idxMedia];
    const colLts = colunas[idxLts];
    const colHoras = colunas[idxHoras];

    let maquinas = {};
    let somaMediaGlobal = 0;
    let countGlobal = 0;
    let totalLtsGlobal = 0;
    let totalHorasGlobal = 0;

    if (colGrua && colMediaLtsH) {
        dados.forEach(item => {
            let nomeGrua = item[colGrua] ? item[colGrua].trim() : 'Não Identificada';
            
            let valMedia = parseBR(item[colMediaLtsH]);
            let valLts = colLts ? parseBR(item[colLts]) : 0;
            let valHoras = colHoras ? parseBR(item[colHoras]) : 0;
            
            if (valMedia > 0) {
                if (!maquinas[nomeGrua]) {
                    maquinas[nomeGrua] = { somaMedia: 0, count: 0, lts: 0, horas: 0 };
                }
                
                maquinas[nomeGrua].somaMedia += valMedia;
                maquinas[nomeGrua].count += 1;
                maquinas[nomeGrua].lts += valLts;
                maquinas[nomeGrua].horas += valHoras;
                
                somaMediaGlobal += valMedia;
                countGlobal += 1;
                totalLtsGlobal += valLts;
                totalHorasGlobal += valHoras;
            }
        });
    }

    // ==========================================
    // 1. RENDERIZAR CARDS (KPIs) COM STATUS DA META
    // ==========================================
    if (kpiContainer) {
        let htmlKpi = '';
        
        let mediaGlobalNum = countGlobal > 0 ? (somaMediaGlobal / countGlobal) : 0;
        let mediaGlobal = mediaGlobalNum.toFixed(2);
        
        let corGlobal = '#fff';
        let iconeGlobal = '';
        let borderCorGlobal = 'rgba(255,255,255,0.2)';
        
        if (mediaGlobalNum > 0) {
            if (mediaGlobalNum < 13) {
                corGlobal = '#10b981'; 
                borderCorGlobal = '#10b981';
                iconeGlobal = '<i class="fas fa-check-circle" style="color: #10b981; font-size: 1.6rem; margin-left: 10px;" title="Dentro da Meta (< 13 LTS/H)"></i>';
            } else {
                corGlobal = '#ef4444'; 
                borderCorGlobal = '#ef4444';
                iconeGlobal = '<i class="fas fa-times-circle" style="color: #ef4444; font-size: 1.6rem; margin-left: 10px;" title="Fora da Meta (>= 13 LTS/H)"></i>';
            }
        }

        htmlKpi += `
            <div style="background: rgba(255,255,255,0.03); padding: 20px; border-radius: 10px; border-left: 4px solid ${borderCorGlobal}; border-top: 1px solid rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.05); border-right: 1px solid rgba(255,255,255,0.05); text-align: center; display: flex; flex-direction: column; justify-content: center;">
                <div style="color: #94a3b8; font-size: 0.9rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Média Global (Todas)</div>
                <div style="color: ${corGlobal}; font-size: 2.2rem; font-weight: 800; margin: 10px 0; display: flex; justify-content: center; align-items: center;">
                    ${mediaGlobal} <span style="font-size:1rem; color:#94a3b8; font-weight:600; margin-left: 5px;">LTS/H</span> ${iconeGlobal}
                </div>
                <div style="font-size: 0.85rem; color: #ffffff; font-weight: 600; background: rgba(0,0,0,0.3); padding: 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); width: fit-content; margin: 0 auto;">
                    ${totalLtsGlobal.toLocaleString('pt-BR', {minimumFractionDigits: 1})} L totais / ${totalHorasGlobal.toLocaleString('pt-BR', {minimumFractionDigits: 1})} H totais
                </div>
            </div>
        `;

        for (let maq in maquinas) {
            let dadosMaq = maquinas[maq];
            let mediaMaqNum = dadosMaq.count > 0 ? (dadosMaq.somaMedia / dadosMaq.count) : 0;
            let mediaMaq = mediaMaqNum.toFixed(2);
            
            let corValor = '#fff';
            let iconeStatus = '';
            
            if (mediaMaqNum > 0) {
                if (mediaMaqNum < 13) {
                    corValor = '#10b981'; 
                    iconeStatus = '<i class="fas fa-check-circle" style="color: #10b981; font-size: 1.2rem; margin-left: 8px;" title="Dentro da Meta (< 13 LTS/H)"></i>';
                } else {
                    corValor = '#ef4444'; 
                    iconeStatus = '<i class="fas fa-times-circle" style="color: #ef4444; font-size: 1.2rem; margin-left: 8px;" title="Fora da Meta (>= 13 LTS/H)"></i>';
                }
            }
            
            htmlKpi += `
                <div style="background: rgba(255,255,255,0.02); padding: 15px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); text-align: center;">
                    <div style="color: var(--ccol-blue-bright); font-size: 1rem; font-weight: 700; margin-bottom: 10px;">${maq}</div>
                    <div style="color: ${corValor}; font-size: 1.6rem; font-weight: 700; margin-bottom: 10px; display: flex; justify-content: center; align-items: center;">
                        ${mediaMaq} <span style="font-size:0.8rem; color:#94a3b8; margin-left:4px;">LTS/H</span> ${iconeStatus}
                    </div>
                    <div style="font-size: 0.85rem; color: #ffffff; background: rgba(0,0,0,0.4); padding: 6px; border-radius: 4px; font-weight: 600; border: 1px solid rgba(255,255,255,0.1);">
                        ${dadosMaq.lts.toLocaleString('pt-BR', {minimumFractionDigits: 1})} L / ${dadosMaq.horas.toLocaleString('pt-BR', {minimumFractionDigits: 1})} H
                    </div>
                </div>
            `;
        }

        if (!colMediaLtsH && colGrua) {
            htmlKpi += `<div style="grid-column: 1 / -1; color: #f59e0b; font-size: 0.9rem; padding: 10px; text-align:center; background: rgba(245, 158, 11, 0.1); border-radius: 8px;">Aviso: A coluna 'LTS / H MAQ' não foi identificada na planilha. Certifique-se de que o nome no cabeçalho está correto.</div>`;
        }

        kpiContainer.innerHTML = htmlKpi;
    }

    // ==========================================
    // 2. RENDERIZAR GRÁFICO COMBINADO (ECHARTS)
    // ==========================================
    if (chartContainer) {
        if (chartAbastecimento) {
            chartAbastecimento.dispose();
        }
        
        chartAbastecimento = echarts.init(chartContainer);

        const categorias = Object.keys(maquinas);
        const arrayLts = categorias.map(maq => maquinas[maq].lts);
        const arrayLtsH = categorias.map(maq => maquinas[maq].count > 0 ? (maquinas[maq].somaMedia / maquinas[maq].count).toFixed(2) : 0);

        const option = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' }
            },
            legend: {
                data: ['Volume Total (LTS)', 'Média (LTS / H)'],
                textStyle: { color: '#e2e8f0' },
                bottom: 0
            },
            grid: {
                left: '3%',
                right: '3%',
                bottom: '10%',
                top: '15%',
                containLabel: true
            },
            xAxis: [
                {
                    type: 'category',
                    data: categorias,
                    axisLabel: { color: '#94a3b8', interval: 0, rotate: 15 },
                    axisPointer: { type: 'shadow' }
                }
            ],
            yAxis: [
                {
                    type: 'value',
                    name: 'Litros (L)',
                    nameTextStyle: { color: '#94a3b8' },
                    axisLabel: { color: '#94a3b8' },
                    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
                },
                {
                    type: 'value',
                    name: 'Média LTS/H',
                    nameTextStyle: { color: '#94a3b8' },
                    axisLabel: { color: '#94a3b8' },
                    splitLine: { show: false },
                    min: function(value) { return Math.max(0, Math.floor(value.min - 2)); }
                }
            ],
            series: [
                {
                    name: 'Volume Total (LTS)',
                    type: 'bar',
                    yAxisIndex: 0,
                    barWidth: '40%',
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: '#3b82f6' }, 
                            { offset: 1, color: '#1d4ed8' }
                        ]),
                        borderRadius: [4, 4, 0, 0]
                    },
                    data: arrayLts
                },
                {
                    name: 'Média (LTS / H)',
                    type: 'line',
                    yAxisIndex: 1,
                    symbolSize: 8,
                    itemStyle: { color: '#10b981' },
                    lineStyle: { width: 3, shadowColor: 'rgba(16,185,129,0.4)', shadowBlur: 10 },
                    label: {
                        show: true,
                        position: 'top',
                        color: '#10b981',
                        formatter: '{c}',
                        fontWeight: 'bold',
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        padding: [4, 6],
                        borderRadius: 4
                    },
                    data: arrayLtsH
                }
            ]
        };

        chartAbastecimento.setOption(option);

        window.addEventListener('resize', function() {
            if (chartAbastecimento) chartAbastecimento.resize();
        });
    }
}