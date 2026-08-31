// URL da Planilha Google (formato CSV)
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1uQekwV3xaU-EIGikUaaeik_SdhtQLueaBPCVslUB3kY/export?format=csv&gid=1959920910";

let chartAbastecimento = null;
let dadosGlobaisAbastecimento = []; 
let dadosParaTabela = []; 
let paginaAtualAbast = 1;
const itensPorPaginaAbast = 20; 

// Variáveis do Mapa
let mapAbastecimento = null;
let mapMarkersLayer = null;

window.initAbastecimentoGruas = async function() {
    const tbody = document.getElementById('tbodyAbastecimento');
    const infoLabelChart = document.getElementById('loadingChartInfo');
    const infoLabelKpi = document.getElementById('loadingKpiInfo');
    const infoLabelMap = document.getElementById('loadingMapInfo');
    
    if(infoLabelChart) infoLabelChart.innerText = "(Sincronizando...)";
    if(infoLabelKpi) infoLabelKpi.innerText = "- Sincronizando Planilha...";
    if(infoLabelMap) infoLabelMap.innerText = "(Aguardando dados...)";

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
// FUNÇÕES DE TRATAMENTO E FILTRO DE DATA
// ==========================================

function parseDataPlanilha(strData) {
    if (!strData) return null;
    let partes = strData.trim().split(' ');
    let dataParte = partes[0]; 
    let dma = dataParte.split('/');
    
    if (dma.length === 3) {
        let p1 = parseInt(dma[0]); 
        let p2 = parseInt(dma[1]); 
        let p3 = parseInt(dma[2]);
        
        if (p2 > 12) { return new Date(p3, p1 - 1, p2); } 
        else if (p1 > 12) { return new Date(p3, p2 - 1, p1); } 
        else {
            let nativo = new Date(strData);
            if (!isNaN(nativo.getTime())) return nativo;
            return new Date(p3, p1 - 1, p2); 
        }
    }
    
    let fallback = new Date(strData);
    if (!isNaN(fallback.getTime())) return fallback;
    return null;
}

function obterDataDaLinha(row) {
    const colunas = Object.keys(row);
    const colData = colunas.find(c => c.toLowerCase().includes('data/hora') || c.toLowerCase() === 'data');
    if (!colData || !row[colData]) return null;
    
    let dataParsed = parseDataPlanilha(row[colData]);
    
    if (dataParsed && row[colData].includes(':')) {
        let partesTempo = row[colData].split(' ')[1]; 
        if (partesTempo) {
            let [h, m, s] = partesTempo.split(':');
            dataParsed.setHours(parseInt(h)||0, parseInt(m)||0, parseInt(s)||0);
        }
    }
    return dataParsed;
}

function formatarDataHoraBR(strData) {
    if (!strData || strData === '-') return '-';
    let partes = strData.toString().trim().split(' ');
    let dataParte = partes[0];
    let horaParte = partes[1] || '';
    
    if (!dataParte.includes('/')) return strData;

    let dma = dataParte.split('/');
    if (dma.length === 3) {
        let p1 = parseInt(dma[0]); 
        let p2 = parseInt(dma[1]); 
        let p3 = parseInt(dma[2]);
        
        let dia, mes, ano;
        if (p2 > 12) { dia = p2; mes = p1; ano = p3; } 
        else if (p1 > 12) { dia = p1; mes = p2; ano = p3; } 
        else { dia = p2; mes = p1; ano = p3; }
        
        let dataFormatada = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
        return horaParte ? `${dataFormatada} ${horaParte}` : dataFormatada;
    }
    return strData;
}

window.aplicarFiltroData = function(tipo, isInitialLoad = false) {
    const inputInicio = document.getElementById('filtroDataInicio');
    const inputFim = document.getElementById('filtroDataFim');
    
    let inicio = null;
    let fim = null;
    let hoje = new Date();

    if (tipo === 'mes_atual') {
        inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0); 
        
        if(inputInicio) inputInicio.value = inicio.toISOString().split('T')[0];
        if(inputFim) inputFim.value = fim.toISOString().split('T')[0];
    } 
    else if (tipo === 'tudo') {
        if(inputInicio) inputInicio.value = '';
        if(inputFim) inputFim.value = '';
    } 
    else if (tipo === 'custom') {
        if (inputInicio && inputInicio.value) inicio = new Date(inputInicio.value + 'T00:00:00');
        if (inputFim && inputFim.value) fim = new Date(inputFim.value + 'T23:59:59');
    }

    let dadosFiltrados = dadosGlobaisAbastecimento.filter(row => {
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

    dadosFiltrados.sort((a, b) => {
        let dateA = obterDataDaLinha(a);
        let dateB = obterDataDaLinha(b);
        return (dateB ? dateB.getTime() : 0) - (dateA ? dateA.getTime() : 0);
    });

    // Chamadas de atualização visual
    renderizarTabelaPaginada(dadosFiltrados);
    processarIndicadoresDashboard(dadosFiltrados);
    renderizarMapaAbastecimento(dadosFiltrados);

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
// RENDERIZAÇÃO DO MAPA DE CALOR/DISPERSÃO
// ==========================================
function renderizarMapaAbastecimento(dados) {
    const mapContainerId = 'mapaAbastecimento';
    const mapContainer = document.getElementById(mapContainerId);
    if (!mapContainer) return;

    // Inicializa o mapa caso ainda não exista, utilizando o modelo Híbrido Satélite do Google
    if (!mapAbastecimento) {
        mapAbastecimento = L.map(mapContainerId).setView([-18.05, -39.87], 9);
        
        L.tileLayer('https://mt0.google.com/vt/lyrs=y&hl=pt-BR&x={x}&y={y}&z={z}', { 
            maxZoom: 21,
            attribution: 'Map data &copy; Google'
        }).addTo(mapAbastecimento);
        
        mapMarkersLayer = L.layerGroup().addTo(mapAbastecimento);
    }

    // Resolve problema de renderização de telas ocultas
    setTimeout(() => { mapAbastecimento.invalidateSize(); }, 500);

    // Limpa pontos antigos
    mapMarkersLayer.clearLayers();

    if (!dados || dados.length === 0) {
        document.getElementById('loadingMapInfo').innerText = "(Nenhum dado para mapear)";
        return;
    }

    const colunas = Object.keys(dados[0]);
    const colunasNorm = colunas.map(c => c.toLowerCase().replace(/\s/g, ''));
    
    // Identificadores de coluna flexíveis
    const idxLoc = colunasNorm.findIndex(c => c.includes('localiza') || c.includes('gps') || c.includes('coordenada'));
    const idxGrua = colunasNorm.findIndex(c => c.includes('grua') || c.includes('maquina') || c.includes('frota'));
    const idxData = colunasNorm.findIndex(c => c.includes('data'));
    const idxLts = colunasNorm.findIndex(c => c.includes('lts') || c.includes('litro'));

    if (idxLoc === -1) {
        document.getElementById('loadingMapInfo').innerText = "(Coluna 'Localização' não encontrada na planilha)";
        return;
    }

    const colLoc = colunas[idxLoc];
    const colGrua = idxGrua !== -1 ? colunas[idxGrua] : null;
    const colData = idxData !== -1 ? colunas[idxData] : null;
    const colLts = idxLts !== -1 ? colunas[idxLts] : null;

    let latlngs = [];

    dados.forEach(item => {
        let loc = item[colLoc];
        if (loc && loc.includes(',')) {
            let parts = loc.split(',');
            let lat = parseFloat(parts[0].trim());
            let lng = parseFloat(parts[1].trim());
            
            if (!isNaN(lat) && !isNaN(lng)) {
                latlngs.push([lat, lng]);
                
                let gruaNome = colGrua ? (item[colGrua] || 'N/A') : 'N/A';
                let dataAbast = colData ? formatarDataHoraBR(item[colData]) : 'N/A';
                let litrosAbast = colLts ? (item[colLts] || '0') : '0';

                // Desenha o Ponto (Borda branca para destacar bem sobre a foto do satélite)
                L.circleMarker([lat, lng], {
                    radius: 8,
                    fillColor: '#ef4444', // Vermelho "Calor"
                    color: '#ffffff',     // Borda Branca para dar contraste com a floresta
                    weight: 2,
                    fillOpacity: 0.8
                }).addTo(mapMarkersLayer)
                  .bindPopup(`
                    <div style="font-family: 'Inter', sans-serif; color: #1e293b;">
                        <strong style="color: #0f172a; font-size: 1.1rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; display: block; margin-bottom: 5px;">
                            ${gruaNome}
                        </strong>
                        <b>Data:</b> ${dataAbast}<br>
                        <b>Volume:</b> ${litrosAbast} L<br>
                        <span style="font-size: 0.75rem; color: #64748b; margin-top: 5px; display:block;">📍 ${lat}, ${lng}</span>
                    </div>
                  `);
            }
        }
    });

    if (latlngs.length > 0) {
        mapAbastecimento.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
        document.getElementById('loadingMapInfo').innerText = `(${latlngs.length} pontos mapeados)`;
    } else {
        document.getElementById('loadingMapInfo').innerText = "(Nenhuma coordenada válida encontrada)";
    }
}

// ==========================================
// RENDERIZAÇÃO DA TABELA (COM PAGINAÇÃO) E GRÁFICOS
// ==========================================

function renderizarTabelaPaginada(dados) {
    dadosParaTabela = dados;
    paginaAtualAbast = 1; 
    montarCabecalhoETabela();
}

window.mudarPaginaAbast = function(novaPagina) {
    const totalPaginas = Math.ceil(dadosParaTabela.length / itensPorPaginaAbast);
    if (novaPagina >= 1 && novaPagina <= totalPaginas) {
        paginaAtualAbast = novaPagina;
        montarCabecalhoETabela();
    }
};

function montarCabecalhoETabela() {
    const thead = document.getElementById('theadAbastecimento');
    const tbody = document.getElementById('tbodyAbastecimento');
    const paginacao = document.getElementById('paginacaoAbastecimento');

    if (!dadosParaTabela || dadosParaTabela.length === 0) {
        if(thead) thead.innerHTML = '';
        if(tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-secondary);">Nenhum registro encontrado para este período.</td></tr>`;
        if(paginacao) paginacao.innerHTML = '';
        return;
    }

    const colunas = Object.keys(dadosParaTabela[0]);
    if(thead) thead.innerHTML = colunas.map(col => `<th style="padding: 12px; border-bottom: 1px solid var(--border-dim); color: var(--ccol-blue-bright);">${col}</th>`).join('');

    const totalPaginas = Math.ceil(dadosParaTabela.length / itensPorPaginaAbast);
    const inicio = (paginaAtualAbast - 1) * itensPorPaginaAbast;
    const fim = inicio + itensPorPaginaAbast;
    const dadosPagina = dadosParaTabela.slice(inicio, fim);

    let htmlCorpo = '';
    dadosPagina.forEach(linha => {
        htmlCorpo += '<tr>';
        colunas.forEach(col => {
            let valor = linha[col] || '-';
            if (col.toLowerCase().includes('data')) {
                valor = formatarDataHoraBR(valor);
            }
            htmlCorpo += `<td style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #e2e8f0;">${valor}</td>`;
        });
        htmlCorpo += '</tr>';
    });
    
    if(tbody) tbody.innerHTML = htmlCorpo;

    if (paginacao) {
        let btnAnteriorDisabled = paginaAtualAbast === 1 ? 'disabled' : '';
        let btnAnteriorColor = paginaAtualAbast === 1 ? '#475569' : '#fff';
        let btnAnteriorCursor = paginaAtualAbast === 1 ? 'not-allowed' : 'pointer';

        let btnProximaDisabled = paginaAtualAbast === totalPaginas ? 'disabled' : '';
        let btnProximaColor = paginaAtualAbast === totalPaginas ? '#475569' : '#fff';
        let btnProximaCursor = paginaAtualAbast === totalPaginas ? 'not-allowed' : 'pointer';

        paginacao.innerHTML = `
            <div>Mostrando ${inicio + 1} a ${Math.min(fim, dadosParaTabela.length)} de <b>${dadosParaTabela.length}</b> registros</div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <button onclick="mudarPaginaAbast(${paginaAtualAbast - 1})" ${btnAnteriorDisabled} style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: ${btnAnteriorColor}; padding: 6px 12px; border-radius: 6px; cursor: ${btnAnteriorCursor}; font-weight: 600;">
                    <i class="fas fa-chevron-left"></i> Anterior
                </button>
                <div style="padding: 6px 12px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); border-radius: 6px; color: #10b981; font-weight: bold;">
                    Página ${paginaAtualAbast} de ${totalPaginas}
                </div>
                <button onclick="mudarPaginaAbast(${paginaAtualAbast + 1})" ${btnProximaDisabled} style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: ${btnProximaColor}; padding: 6px 12px; border-radius: 6px; cursor: ${btnProximaCursor}; font-weight: 600;">
                    Próxima <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;
    }
}

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
            <div style="background: linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.02)); padding: 20px; border-radius: 10px; border-left: 4px solid ${borderCorGlobal}; border-top: 1px solid rgba(16,185,129,0.2); border-bottom: 1px solid rgba(16,185,129,0.2); border-right: 1px solid rgba(16,185,129,0.2); text-align: center; display: flex; flex-direction: column; justify-content: center;">
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

        kpiContainer.innerHTML = htmlKpi;
    }

    if (chartContainer) {
        if (chartAbastecimento) chartAbastecimento.dispose();
        chartAbastecimento = echarts.init(chartContainer);

        const categorias = Object.keys(maquinas);
        const arrayLts = categorias.map(maq => maquinas[maq].lts);
        const arrayLtsH = categorias.map(maq => maquinas[maq].count > 0 ? (maquinas[maq].somaMedia / maquinas[maq].count).toFixed(2) : 0);

        const option = {
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
            legend: { data: ['Volume Total (LTS)', 'Média (LTS / H)'], textStyle: { color: '#e2e8f0' }, bottom: 0 },
            grid: { left: '3%', right: '3%', bottom: '10%', top: '15%', containLabel: true },
            xAxis: [{ type: 'category', data: categorias, axisLabel: { color: '#94a3b8', interval: 0, rotate: 15 }, axisPointer: { type: 'shadow' } }],
            yAxis: [
                { type: 'value', name: 'Litros (L)', nameTextStyle: { color: '#94a3b8' }, axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
                { type: 'value', name: 'Média LTS/H', nameTextStyle: { color: '#94a3b8' }, axisLabel: { color: '#94a3b8' }, splitLine: { show: false }, min: function(value) { return Math.max(0, Math.floor(value.min - 2)); } }
            ],
            series: [
                {
                    name: 'Volume Total (LTS)', type: 'bar', yAxisIndex: 0, barWidth: '40%',
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: '#3b82f6' }, { offset: 1, color: '#1d4ed8' }
                        ]), borderRadius: [4, 4, 0, 0]
                    },
                    data: arrayLts
                },
                {
                    name: 'Média (LTS / H)', type: 'line', yAxisIndex: 1, symbolSize: 8,
                    itemStyle: { color: '#10b981' },
                    lineStyle: { width: 3, shadowColor: 'rgba(16,185,129,0.4)', shadowBlur: 10 },
                    label: { show: true, position: 'top', color: '#10b981', formatter: '{c}', fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.6)', padding: [4, 6], borderRadius: 4 },
                    data: arrayLtsH
                }
            ]
        };

        chartAbastecimento.setOption(option);
        window.addEventListener('resize', function() { if (chartAbastecimento) chartAbastecimento.resize(); });
    }
}