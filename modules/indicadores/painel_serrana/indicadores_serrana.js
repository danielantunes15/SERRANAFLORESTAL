// ==================== modules/indicadores/painel_serrana/indicadores_serrana.js ====================

window._serranaState = {
    filtroGraficoDM: 'AMBAS',     // 'AMBAS' | 'TRITREM' | 'GRUA'
    filtroParadas: 'TODOS',       // 'TODOS' | 'TRITREM' | 'GRUA'
    cacheParadas: [],
    cacheDM: {
        horas: [],
        tritrem: [],
        grua: [],
        totalTritrem: 0,
        totalGrua: 0
    }
};

// FUNÇÃO UNIVERSAL PARA CORRIGIR FUSO HORÁRIO DO SUPABASE
window.corrigirDataSupabase = function(dateStr) {
    if (!dateStr || dateStr === 'null' || dateStr === 'undefined') return null;
    let str = String(dateStr).trim();

    if (!str.includes('T')) str = str.replace(' ', 'T');
    str = str.replace(/(Z|[+-]\d{2}(:\d{2})?)$/i, '');
    str = str.replace(/\.(\d{3})\d+/, '.$1');
    str += '-03:00';

    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
};

function normalizarPlacaSerrana(placa) {
    return String(placa || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function normalizarCategoriaSerrana(categoria) {
    return String(categoria || '').trim().toUpperCase();
}

// GARANTE QUE A JANELA DE EQUIPAMENTOS EM MANUTENÇÃO SEMPRE EXISTA E FIQUE VISÍVEL
function garantirPainelManutencaoSerrana() {
    let containerLista = document.getElementById('lista-frotas-paradas');
    let painel = document.getElementById('painel-manutencao-serrana');

    if (painel && containerLista) {
        painel.style.display = 'flex';
        painel.style.visibility = 'visible';
        painel.style.opacity = '1';
        return containerLista;
    }

    const gridInferior = document.getElementById('serrana-bottom-grid')
        || document.querySelector('.serrana-bottom-grid')
        || document.querySelector('.dash-bottom-split');

    if (!gridInferior) return containerLista;

    gridInferior.style.display = 'grid';
    gridInferior.style.gridTemplateColumns = '1.3fr 1fr';
    gridInferior.style.gap = '20px';

    if (!painel) {
        painel = document.createElement('div');
        painel.id = 'painel-manutencao-serrana';
        painel.className = 'serrana-card card-paradas serrana-panel-card';
        painel.innerHTML = `
            <div class="panel-header-flex">
                <h3 style="color: #f87171;">
                    <i class="fas fa-tools"></i>
                    Equipamentos em Manutenção
                </h3>
                <div class="filter-pills-group" id="filtros-paradas-serrana">
                    <button type="button" class="filter-pill-btn active" onclick="alterarFiltroParadasSerrana('TODOS', this)">
                        Todos <span id="badge-paradas-todos" style="opacity: 0.85;">(0)</span>
                    </button>
                    <button type="button" class="filter-pill-btn" onclick="alterarFiltroParadasSerrana('TRITREM', this)">
                        Tritrem <span id="badge-paradas-tritrem" style="opacity: 0.85;">(0)</span>
                    </button>
                    <button type="button" class="filter-pill-btn" onclick="alterarFiltroParadasSerrana('GRUA', this)">
                        Grua <span id="badge-paradas-grua" style="opacity: 0.85;">(0)</span>
                    </button>
                </div>
            </div>
            <div id="lista-frotas-paradas" class="lista-scroll" style="flex-grow: 1; padding: 14px; overflow-y: auto; max-height: 360px; display: flex; flex-direction: column; gap: 10px;">
                <div class="empty-state" style="color: #94a3b8; font-size: 0.9rem;">Buscando equipamentos parados...</div>
            </div>
        `;
        gridInferior.appendChild(painel);
    }

    return document.getElementById('lista-frotas-paradas');
}

window.carregarDadosDashboardSerrana = async function() {
    if (window._intervalRelogioSerrana) clearInterval(window._intervalRelogioSerrana);
    if (window._intervalDadosSerrana) clearInterval(window._intervalDadosSerrana);

    garantirPainelManutencaoSerrana();
    atualizarRelogioSerrana();
    window._intervalRelogioSerrana = setInterval(atualizarRelogioSerrana, 1000);

    await atualizarTodosDadosSerrana();

    window._intervalDadosSerrana = setInterval(() => {
        if (!document.getElementById('area-print-dash')) {
            clearInterval(window._intervalRelogioSerrana);
            clearInterval(window._intervalDadosSerrana);
            return;
        }
        atualizarTodosDadosSerrana();
    }, 60000);
};

async function atualizarTodosDadosSerrana() {
    await Promise.all([
        carregarStatusDashSerrana(),
        carregarFrentesTvSerrana(),
        carregarIndicadoresFrotaEDMSerrana()
    ]);
}

window.atualizarRelogioSerrana = function() {
    const agora = new Date();
    const dia = String(agora.getDate()).padStart(2, '0');
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const ano = agora.getFullYear();
    const horas = String(agora.getHours()).padStart(2, '0');
    const minutos = String(agora.getMinutes()).padStart(2, '0');
    const segundos = String(agora.getSeconds()).padStart(2, '0');

    const elHora = document.getElementById('dash-hora');
    const elData = document.getElementById('dash-data');
    if (elHora) elHora.textContent = `${horas}:${minutos}:${segundos}`;
    if (elData) elData.textContent = `${dia}/${mes}/${ano}`;
};

// CARREGA FROTAS (TRITREM + GRUA), O.S. ATIVAS, PARADAS E CÁLCULO DE DM 24H
async function carregarIndicadoresFrotaEDMSerrana() {
    try {
        let queryFrota = supabaseClient
            .from('frotas_manutencao')
            .select('cavalo, categoria, status')
            .eq('status', 'Ativo');

        if (typeof window.aplicarFiltroFilial === 'function') {
            queryFrota = window.aplicarFiltroFilial(queryFrota);
        }

        const { data: frotaData, error: frotaError } = await queryFrota;
        if (frotaError) throw frotaError;

        const mapaPlacaCategoria = new Map();
        const setTritrem = new Set();
        const setGrua = new Set();

        (frotaData || []).forEach(f => {
            if (!f.cavalo) return;
            const cat = normalizarCategoriaSerrana(f.categoria);
            const placaNorm = normalizarPlacaSerrana(f.cavalo);
            if (!placaNorm) return;

            if (cat === 'TRITREM') {
                setTritrem.add(placaNorm);
                mapaPlacaCategoria.set(placaNorm, 'TRITREM');
            } else if (cat === 'GRUA') {
                setGrua.add(placaNorm);
                mapaPlacaCategoria.set(placaNorm, 'GRUA');
            }
        });

        let queryOS = supabaseClient
            .from('ordens_servico')
            .select('placa, problema, status, tipo, data_abertura, data_conclusao')
            .eq('inativa', 0)
            .neq('status', 'Agendada')
            .order('data_abertura', { ascending: false })
            .limit(5000);

        if (typeof window.aplicarFiltroFilial === 'function') {
            queryOS = window.aplicarFiltroFilial(queryOS);
        }

        const { data: osData, error: osError } = await queryOS;
        if (osError) throw osError;

        const osValidas = (osData || []).filter(os => {
            if (!os.placa) return false;
            if (os.tipo && os.tipo.trim().toUpperCase() === 'CAVALO DISPONÍVEL S/ CARRETA') return false;
            const placaNorm = normalizarPlacaSerrana(os.placa);
            return mapaPlacaCategoria.has(placaNorm);
        });

        const statusParada = ['Aguardando Oficina', 'Em Manutenção', 'Sinistrado'];
        const osAbertas = osValidas.filter(os => statusParada.includes(os.status));

        const calcularResumoCategoria = (setPlacasCategoria) => {
            const total = setPlacasCategoria.size;
            const setManut = new Set();
            const setSinistro = new Set();

            osAbertas.forEach(os => {
                const placaNorm = normalizarPlacaSerrana(os.placa);
                if (!setPlacasCategoria.has(placaNorm)) return;

                if (os.status === 'Sinistrado') {
                    setSinistro.add(placaNorm);
                } else {
                    setManut.add(placaNorm);
                }
            });

            setSinistro.forEach(p => setManut.delete(p));

            const emManutencao = setManut.size + setSinistro.size;
            const disponivel = Math.max(0, total - emManutencao);
            const percentual = total > 0 ? Math.round((disponivel / total) * 100) : 0;

            return { total, disponivel, emManutencao, percentual };
        };

        const resumoTritrem = calcularResumoCategoria(setTritrem);
        const resumoGrua = calcularResumoCategoria(setGrua);

        atualizarCardCategoriaSVG('tritrem', resumoTritrem);
        atualizarCardCategoriaSVG('grua', resumoGrua);

        const agora = new Date();
        const listaParadas = osAbertas.map(os => {
            const placaNorm = normalizarPlacaSerrana(os.placa);
            const categoria = mapaPlacaCategoria.get(placaNorm) || 'TRITREM';
            let diffMs = 0;
            let textoTempo = 'N/I';

            const inicio = window.corrigirDataSupabase(os.data_abertura);
            if (inicio) {
                diffMs = agora - inicio;
                if (diffMs > 0) {
                    const diffMinutos = Math.floor(diffMs / (1000 * 60));
                    const dias = Math.floor(diffMinutos / (60 * 24));
                    const horas = Math.floor((diffMinutos % (60 * 24)) / 60);
                    const minutos = diffMinutos % 60;

                    if (dias > 0) textoTempo = `${dias}d ${horas}h ${minutos}m`;
                    else if (horas > 0) textoTempo = `${horas}h ${minutos}m`;
                    else textoTempo = `${minutos}m`;
                } else {
                    textoTempo = 'Agora';
                    diffMs = 0;
                }
            }

            return {
                ...os,
                categoria,
                diffMs,
                textoTempo
            };
        });

        listaParadas.sort((a, b) => b.diffMs - a.diffMs);
        window._serranaState.cacheParadas = listaParadas;
        renderizarListaParadasSerrana();

        const dmTritrem = calcularSerieDM24h(setTritrem, osValidas, agora);
        const dmGrua = calcularSerieDM24h(setGrua, osValidas, agora);

        const elDmDiaTritrem = document.getElementById('dm-dia-tritrem');
        const elDmDiaGrua = document.getElementById('dm-dia-grua');
        if (elDmDiaTritrem) elDmDiaTritrem.textContent = dmTritrem.mediaDia !== null ? `${dmTritrem.mediaDia}%` : '--%';
        if (elDmDiaGrua) elDmDiaGrua.textContent = dmGrua.mediaDia !== null ? `${dmGrua.mediaDia}%` : '--%';

        window._serranaState.cacheDM = {
            horas: dmTritrem.horas,
            tritrem: dmTritrem.valores,
            grua: dmGrua.valores,
            totalTritrem: setTritrem.size,
            totalGrua: setGrua.size
        };

        renderizarGraficoEvolucaoDmSerrana();

    } catch (e) {
        console.error('Erro ao carregar indicadores Serrana:', e);
    }
}

function atualizarCardCategoriaSVG(prefixo, dados) {
    const arc = document.getElementById(`gauge-arc-${prefixo}`);
    const elDisp = document.getElementById(`texto-${prefixo}-disponivel`);
    const elPerc = document.getElementById(`perc-${prefixo}-operacao`);
    const elAtivo = document.getElementById(`stat-${prefixo}-ativo`);
    const elManut = document.getElementById(`texto-${prefixo}-manut`);
    const elTotal = document.getElementById(`texto-${prefixo}-total`);

    const comprimentoArco = 251.33;
    if (arc) {
        const offset = comprimentoArco - (comprimentoArco * (dados.percentual / 100));
        arc.style.strokeDashoffset = offset.toFixed(2);
    }

    if (elDisp) elDisp.textContent = dados.disponivel;
    if (elPerc) elPerc.textContent = `${dados.percentual}%`;
    if (elAtivo) elAtivo.textContent = dados.disponivel;
    if (elManut) elManut.textContent = dados.emManutencao;
    if (elTotal) elTotal.textContent = dados.total;
}

function calcularSerieDM24h(setPlacasCategoria, todasOSValidas, agora) {
    const totalFrotas = setPlacasCategoria.size;
    const horas = [];
    const valores = [];

    if (totalFrotas === 0) {
        for (let h = 0; h < 24; h++) {
            horas.push(`${String(h).padStart(2, '0')}:00`);
            valores.push(null);
        }
        return { horas, valores, mediaDia: null };
    }

    const osCategoria = todasOSValidas.filter(os => setPlacasCategoria.has(normalizarPlacaSerrana(os.placa)));
    const placasEmOS = [...new Set(osCategoria.map(os => normalizarPlacaSerrana(os.placa)))];

    const msPorHora = 60 * 60 * 1000;
    const totalMsDisponivelPorHora = totalFrotas * msPorHora;

    let somaDM = 0;
    let qtdHorasValidas = 0;

    for (let h = 0; h < 24; h++) {
        const inicioHora = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), h, 0, 0, 0);
        const fimHora = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), h, 59, 59, 999);

        horas.push(`${String(h).padStart(2, '0')}:00`);

        if (inicioHora > agora) {
            valores.push(null);
            continue;
        }

        let msManutencaoNestaHora = 0;

        placasEmOS.forEach(placaOS => {
            let tempoParadoEquipamento = 0;
            const osDesteEquipamento = osCategoria.filter(o => normalizarPlacaSerrana(o.placa) === placaOS);

            osDesteEquipamento.forEach(os => {
                let osInicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0);
                if (os.data_abertura && os.data_abertura !== 'null') {
                    const d = window.corrigirDataSupabase(os.data_abertura);
                    if (d) osInicio = d;
                } else if (os.status === 'Concluída' || os.status === 'Resolvido') {
                    return;
                }

                let osFim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999);
                if (os.data_conclusao && os.data_conclusao !== 'null') {
                    const d = window.corrigirDataSupabase(os.data_conclusao);
                    if (d) osFim = d;
                }

                const overlapInicio = osInicio > inicioHora ? osInicio : inicioHora;
                const overlapFim = osFim < fimHora ? osFim : fimHora;

                if (overlapInicio < overlapFim) {
                    tempoParadoEquipamento += (overlapFim - overlapInicio);
                }
            });

            if (tempoParadoEquipamento > msPorHora) tempoParadoEquipamento = msPorHora;
            msManutencaoNestaHora += tempoParadoEquipamento;
        });

        let dispNestaHora = totalMsDisponivelPorHora - msManutencaoNestaHora;
        if (dispNestaHora < 0) dispNestaHora = 0;

        const percentDM = totalMsDisponivelPorHora > 0
            ? (dispNestaHora / totalMsDisponivelPorHora) * 100
            : 100;

        valores.push(Number(percentDM.toFixed(1)));
        somaDM += percentDM;
        qtdHorasValidas++;
    }

    const mediaDia = qtdHorasValidas > 0 ? (somaDM / qtdHorasValidas).toFixed(1) : null;
    return { horas, valores, mediaDia };
}

window.alterarFiltroGraficoDMSerrana = function(filtro, btnEl) {
    window._serranaState.filtroGraficoDM = filtro;

    const grupo = document.getElementById('filtros-grafico-dm');
    if (grupo) {
        grupo.querySelectorAll('.filter-pill-btn').forEach(b => {
            b.classList.remove('active', 'active-tritrem', 'active-grua');
        });
    }

    if (btnEl) {
        if (filtro === 'TRITREM') btnEl.classList.add('active-tritrem');
        else if (filtro === 'GRUA') btnEl.classList.add('active-grua');
        else btnEl.classList.add('active');
    }

    renderizarGraficoEvolucaoDmSerrana();
};

function renderizarGraficoEvolucaoDmSerrana() {
    const chartDom = document.getElementById('graficoEvolucaoDmSerrana');
    if (!chartDom) return;

    const { horas, tritrem, grua, totalTritrem, totalGrua } = window._serranaState.cacheDM;
    const filtro = window._serranaState.filtroGraficoDM;

    if (totalTritrem === 0 && totalGrua === 0) {
        chartDom.innerHTML = '<div class="empty-state">Sem dados de frota Tritrem ou Grua ativa para calcular DM.</div>';
        return;
    }

    if (typeof echarts === 'undefined') return;

    let myChart = echarts.getInstanceByDom(chartDom);
    if (!myChart) {
        chartDom.innerHTML = '';
        myChart = echarts.init(chartDom);
        window.addEventListener('resize', () => {
            if (myChart && !myChart.isDisposed()) myChart.resize();
        });
    }

    const series = [];

    if ((filtro === 'AMBAS' || filtro === 'TRITREM') && totalTritrem > 0) {
        series.push({
            name: 'TRITREM',
            type: 'line',
            data: tritrem,
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            label: {
                show: filtro === 'TRITREM',
                position: 'top',
                formatter: '{c}%',
                color: '#38bdf8',
                fontSize: 10,
                fontWeight: 'bold'
            },
            itemStyle: { color: '#38bdf8' },
            lineStyle: { width: 3, color: '#38bdf8' },
            areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: 'rgba(56, 189, 248, 0.30)' },
                    { offset: 1, color: 'rgba(56, 189, 248, 0.01)' }
                ])
            }
        });
    }

    if ((filtro === 'AMBAS' || filtro === 'GRUA') && totalGrua > 0) {
        series.push({
            name: 'GRUA',
            type: 'line',
            data: grua,
            smooth: true,
            symbol: 'diamond',
            symbolSize: 7,
            label: {
                show: filtro === 'GRUA',
                position: 'top',
                formatter: '{c}%',
                color: '#fbbf24',
                fontSize: 10,
                fontWeight: 'bold'
            },
            itemStyle: { color: '#f59e0b' },
            lineStyle: { width: 3, color: '#f59e0b' },
            areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: 'rgba(245, 158, 11, 0.28)' },
                    { offset: 1, color: 'rgba(245, 158, 11, 0.01)' }
                ])
            }
        });
    }

    const option = {
        animation: false,
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: 'rgba(148, 163, 184, 0.3)',
            textStyle: { color: '#f8fafc', fontSize: 12 },
            formatter: function(params) {
                if (!params || !params.length) return '';
                let html = `<div style="font-weight:800;margin-bottom:4px;color:#cbd5e1;">Hora: ${params[0].axisValue}</div>`;
                params.forEach(p => {
                    const val = (p.value !== null && p.value !== undefined) ? `${p.value}%` : 'Sem dado';
                    html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;">
                        <span>${p.marker} ${p.seriesName}</span>
                        <b style="color:${p.color};">${val}</b>
                    </div>`;
                });
                return html;
            }
        },
        legend: {
            top: 4,
            right: 10,
            textStyle: { color: '#cbd5e1', fontWeight: 'bold', fontSize: 11 }
        },
        grid: {
            left: '2%',
            right: '3%',
            bottom: '4%',
            top: '16%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: horas,
            axisLabel: { color: '#94a3b8', fontWeight: 'bold', fontSize: 11 },
            axisLine: { lineStyle: { color: 'rgba(148,163,184,0.18)' } }
        },
        yAxis: {
            type: 'value',
            min: 0,
            max: 100,
            axisLabel: { formatter: '{value}%', color: '#94a3b8', fontSize: 11 },
            splitLine: { lineStyle: { color: 'rgba(148,163,184,0.08)', type: 'dashed' } }
        },
        series: series
    };

    myChart.setOption(option, true);
}

window.alterarFiltroParadasSerrana = function(filtro, btnEl) {
    window._serranaState.filtroParadas = filtro;

    const grupo = document.getElementById('filtros-paradas-serrana');
    if (grupo) {
        grupo.querySelectorAll('.filter-pill-btn').forEach(b => {
            b.classList.remove('active', 'active-tritrem', 'active-grua');
        });
    }

    if (btnEl) {
        if (filtro === 'TRITREM') btnEl.classList.add('active-tritrem');
        else if (filtro === 'GRUA') btnEl.classList.add('active-grua');
        else btnEl.classList.add('active');
    }

    renderizarListaParadasSerrana();
};

function renderizarListaParadasSerrana() {
    const container = garantirPainelManutencaoSerrana();
    if (!container) return;

    const todas = window._serranaState.cacheParadas || [];
    const filtro = window._serranaState.filtroParadas;

    const qtdTritrem = todas.filter(x => x.categoria === 'TRITREM').length;
    const qtdGrua = todas.filter(x => x.categoria === 'GRUA').length;

    const elBadgeTodos = document.getElementById('badge-paradas-todos');
    const elBadgeTritrem = document.getElementById('badge-paradas-tritrem');
    const elBadgeGrua = document.getElementById('badge-paradas-grua');

    if (elBadgeTodos) elBadgeTodos.textContent = `(${todas.length})`;
    if (elBadgeTritrem) elBadgeTritrem.textContent = `(${qtdTritrem})`;
    if (elBadgeGrua) elBadgeGrua.textContent = `(${qtdGrua})`;

    const filtradas = filtro === 'TODOS'
        ? todas
        : todas.filter(x => x.categoria === filtro);

    if (filtradas.length === 0) {
        const textoVazio = filtro === 'TODOS'
            ? 'Nenhum equipamento em manutenção!'
            : `Nenhum equipamento (${filtro}) em manutenção!`;

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 240px; opacity: 0.8;">
                <i class="fas fa-check-circle" style="font-size: 2.8rem; color: #22c55e; margin-bottom: 10px;"></i>
                <div style="color: #22c55e; font-weight: 800; font-size: 1rem;">${textoVazio}</div>
            </div>`;
        return;
    }

    let html = '';
    filtradas.forEach(os => {
        let corBorder = '#ef4444';
        let iconStatus = 'fas fa-tools';

        if (os.status === 'Em Manutenção') {
            corBorder = '#f59e0b';
            iconStatus = 'fas fa-wrench';
        } else if (os.status === 'Sinistrado') {
            corBorder = '#b91c1c';
            iconStatus = 'fas fa-exclamation-triangle';
        }

        const isGrua = os.categoria === 'GRUA';
        const corCatBg = isGrua ? 'rgba(245, 158, 11, 0.16)' : 'rgba(56, 189, 248, 0.16)';
        const corCatText = isGrua ? '#fbbf24' : '#38bdf8';
        const corCatBorder = isGrua ? 'rgba(245, 158, 11, 0.4)' : 'rgba(56, 189, 248, 0.4)';
        const iconCat = isGrua ? 'fas fa-tractor' : 'fas fa-truck-moving';
        const tipoTexto = os.tipo ? os.tipo : 'Não Informado';
        const descricaoServico = os.problema && os.problema.trim() !== ''
            ? os.problema
            : 'Sem descrição do serviço informada.';

        html += `
        <div class="parada-item-card" style="border-left: 4px solid ${corBorder};">
            <div class="parada-top-row">
                <div class="parada-placa-group">
                    <span class="parada-placa">
                        <i class="${iconStatus}" style="color: ${corBorder}; margin-right: 6px; font-size: 0.95rem;"></i>${os.placa || 'N/I'}
                    </span>
                    <span class="parada-cat-badge" style="font-size: 0.68rem; background: ${corCatBg}; color: ${corCatText}; border: 1px solid ${corCatBorder}; padding: 3px 8px; border-radius: 6px; font-weight: 800; letter-spacing: 0.4px; white-space: nowrap;">
                        <i class="${iconCat}" style="margin-right: 4px;"></i>${os.categoria}
                    </span>
                </div>

                <div class="parada-tempo-badge" title="Tempo total parado">
                    <i class="fas fa-clock"></i>
                    <span>Parado: ${os.textoTempo}</span>
                </div>
            </div>

            <div class="parada-desc-box">
                <span class="parada-desc-label"><i class="fas fa-clipboard-list" style="margin-right: 4px;"></i>Descrição do Serviço</span>
                <div>${descricaoServico}</div>
            </div>

            <div class="parada-meta-row">
                <span class="parada-meta-badge" style="font-size: 0.72rem; background: rgba(148, 163, 184, 0.1); color: #cbd5e1; padding: 3px 8px; border-radius: 6px; font-weight: 700; border: 1px solid rgba(148, 163, 184, 0.2);">
                    <i class="fas fa-tag" style="margin-right: 4px; opacity: 0.75;"></i>${tipoTexto}
                </span>
                <span class="parada-meta-badge" style="font-size: 0.72rem; background: ${corBorder}22; color: ${corBorder}; padding: 3px 8px; border-radius: 6px; font-weight: 800; border: 1px solid ${corBorder}44;">
                    ${os.status}
                </span>
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

async function carregarStatusDashSerrana() {
    try {
        let queryCtrl = supabaseClient.from('dashboard_status').select('id, controlador').limit(1);
        if (typeof window.aplicarFiltroFilial === 'function') queryCtrl = window.aplicarFiltroFilial(queryCtrl);
        const { data: statusData } = await queryCtrl;

        const nomeCtrl = (statusData && statusData.length > 0 && statusData[0].controlador)
            ? statusData[0].controlador
            : 'NÃO DEFINIDO';
        const elDashControladorNome = document.getElementById('dash-controlador-nome');
        if (elDashControladorNome) {
            elDashControladorNome.textContent = nomeCtrl;
        }

        const turnos = await db.getTurnosOperacionais();
        let turnoTexto = '06:00 às 18:00';
        let turnoTipo = 'DIA';

        if (turnos && turnos.length > 0) {
            const agora = new Date();
            const tempoAtualMinutos = agora.getHours() * 60 + agora.getMinutes();

            let turnoAtivo = turnos[0];

            for (let t of turnos) {
                if (!t.hora_inicio || !t.hora_fim) continue;

                const [hIni, mIni] = t.hora_inicio.split(':').map(Number);
                const [hFim, mFim] = t.hora_fim.split(':').map(Number);

                const iniMin = hIni * 60 + mIni;
                const fimMin = hFim * 60 + mFim;

                if (iniMin < fimMin) {
                    if (tempoAtualMinutos >= iniMin && tempoAtualMinutos < fimMin) {
                        turnoAtivo = t;
                        break;
                    }
                } else {
                    if (tempoAtualMinutos >= iniMin || tempoAtualMinutos < fimMin) {
                        turnoAtivo = t;
                        break;
                    }
                }
            }

            const formataHora = (h) => (h ? h.substring(0, 5) : '--:--');
            turnoTexto = `${formataHora(turnoAtivo.hora_inicio)} às ${formataHora(turnoAtivo.hora_fim)}`;
            turnoTipo = turnoAtivo.tipo || 'DIA';
        }

        const elTurnoNome = document.getElementById('dash-turno-nome');
        const elTurnoIcon = document.getElementById('dash-turno-icon');

        if (elTurnoNome) elTurnoNome.textContent = turnoTexto;
        if (elTurnoIcon) {
            if (turnoTipo === 'DIA') {
                elTurnoIcon.className = 'fas fa-sun';
                elTurnoIcon.style.color = '#f59e0b';
            } else {
                elTurnoIcon.className = 'fas fa-moon';
                elTurnoIcon.style.color = '#38bdf8';
            }
        }
    } catch (e) {
        console.error('Erro Status Dash Serrana:', e);
    }
}

async function carregarFrentesTvSerrana() {
    try {
        let queryFrentes = supabaseClient.from('frentes_trabalho').select('*').eq('status', 'Ativa');
        if (typeof window.aplicarFiltroFilial === 'function') queryFrentes = window.aplicarFiltroFilial(queryFrentes);
        const { data } = await queryFrentes;

        const containerNovo = document.getElementById('kpi-lista-frentes-nomes');
        const elKpiFrentes = document.getElementById('kpi-frentes');

        if (data && data.length > 0) {
            if (elKpiFrentes) elKpiFrentes.textContent = data.length;

            let htmlCaixinhas = '';
            data.forEach(f => {
                htmlCaixinhas += `
                <div class="frente-item-pill" style="background: rgba(34, 197, 94, 0.12); padding: 8px 12px; border-radius: 8px; font-size: 0.9rem; font-weight: 800; border: 1px solid rgba(34, 197, 94, 0.35); display: flex; align-items: center; gap: 10px; color: #4ade80; text-align: left; width: 100%; box-sizing: border-box;">
                    <i class="fas fa-truck-loading" style="font-size: 1rem; color: #22c55e;"></i>
                    <span style="flex-grow: 1;">${f.nome}</span>
                </div>`;
            });

            if (containerNovo) containerNovo.innerHTML = htmlCaixinhas;
        } else {
            if (elKpiFrentes) elKpiFrentes.textContent = '0';
            if (containerNovo) {
                containerNovo.innerHTML = '<div class="empty-state" style="font-size: 0.85rem; color: #94a3b8; font-weight: 700;">Nenhuma frente ativa.</div>';
            }
        }
    } catch (e) {
        console.error('Erro Frentes Serrana:', e);
    }
}

// EXPORTAÇÃO PNG EM ALTA DEFINIÇÃO (ALINHAMENTO COMPENSADO PARA HTML2CANVAS)
window.exportarDashboardPNGSerrana = async function() {
    const elemento = document.getElementById('area-print-dash');
    const botaoPrint = document.getElementById('btn-gerar-print');
    if (!elemento) return;

    const textoOriginalBtn = botaoPrint ? botaoPrint.innerHTML : '';
    if (botaoPrint) {
        botaoPrint.disabled = true;
        botaoPrint.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';
    }

    try {
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }

        let chartImgDataUrl = null;
        const chartDom = document.getElementById('graficoEvolucaoDmSerrana');
        if (chartDom && typeof echarts !== 'undefined') {
            const chartInstance = echarts.getInstanceByDom(chartDom);
            if (chartInstance && !chartInstance.isDisposed()) {
                chartImgDataUrl = chartInstance.getDataURL({
                    type: 'png',
                    pixelRatio: 3,
                    backgroundColor: 'transparent'
                });
            }
        }

        const canvas = await html2canvas(elemento, {
            backgroundColor: '#070b14',
            scale: 2.5,
            useCORS: true,
            allowTaint: true,
            logging: false,
            windowWidth: 1680,
            scrollX: 0,
            scrollY: 0,
            onclone: (clonedDoc) => {
                const cloneRoot = clonedDoc.getElementById('area-print-dash');
                if (!cloneRoot) return;

                cloneRoot.style.width = '1600px';
                cloneRoot.style.minWidth = '1600px';
                cloneRoot.style.maxWidth = '1600px';
                cloneRoot.style.padding = '28px 32px';
                cloneRoot.style.borderRadius = '0px';
                cloneRoot.style.boxSizing = 'border-box';

                const cloneBtn = clonedDoc.getElementById('btn-gerar-print');
                if (cloneBtn) cloneBtn.style.display = 'none';

                const kpis = cloneRoot.querySelector('.dash-pro-kpis');
                if (kpis) {
                    kpis.style.display = 'grid';
                    kpis.style.gridTemplateColumns = '1.2fr 1.2fr 0.95fr';
                    kpis.style.gap = '22px';
                }

                const bottomGrid = clonedDoc.getElementById('serrana-bottom-grid') || cloneRoot.querySelector('.serrana-bottom-grid');
                if (bottomGrid) {
                    bottomGrid.style.display = 'grid';
                    bottomGrid.style.gridTemplateColumns = '1.3fr 1fr';
                    bottomGrid.style.gap = '22px';
                }

                const painelManut = clonedDoc.getElementById('painel-manutencao-serrana');
                if (painelManut) {
                    painelManut.style.display = 'flex';
                    painelManut.style.visibility = 'visible';
                    painelManut.style.opacity = '1';
                }

                // Corrige SVGs dos gauges
                cloneRoot.querySelectorAll('.svg-gauge').forEach(svg => {
                    svg.setAttribute('width', '190');
                    svg.setAttribute('height', '114');
                    svg.style.width = '190px';
                    svg.style.height = '114px';
                });

                // COMPENSAÇÃO DE BASELINE DO HTML2CANVAS (EVITA ÍCONES E NÚMEROS DESLOCADOS PARA BAIXO)
                cloneRoot.querySelectorAll('.cat-icon-box').forEach(box => {
                    box.style.display = 'flex';
                    box.style.alignItems = 'center';
                    box.style.justifyContent = 'center';
                    box.style.paddingTop = '0px';
                    box.style.paddingBottom = '8px';
                });

                cloneRoot.querySelectorAll('.frentes-header-count').forEach(el => {
                    el.style.padding = '2px 12px 10px 12px';
                    el.style.lineHeight = '1';
                });

                cloneRoot.querySelectorAll('.mini-stat-box').forEach(el => {
                    el.style.padding = '5px 14px 12px 14px';
                });

                cloneRoot.querySelectorAll('.mini-stat-val').forEach(el => {
                    el.style.lineHeight = '1';
                    el.style.paddingLeft = '10px';
                });

                cloneRoot.querySelectorAll('.mini-stat-label').forEach(el => {
                    el.style.lineHeight = '1';
                });

                cloneRoot.querySelectorAll('.dm-pill, .header-badge-small, .parada-tempo-badge, .filter-pill-btn').forEach(el => {
                    el.style.lineHeight = '1.1';
                    el.style.paddingTop = '3px';
                    el.style.paddingBottom = '8px';
                    el.style.whiteSpace = 'nowrap';
                });

                cloneRoot.querySelectorAll('.parada-cat-badge, .parada-meta-badge').forEach(el => {
                    el.style.lineHeight = '1.1';
                    el.style.paddingTop = '2px';
                    el.style.paddingBottom = '7px';
                    el.style.display = 'inline-flex';
                    el.style.alignItems = 'center';
                });

                cloneRoot.querySelectorAll('.frente-item-pill').forEach(item => {
                    item.style.paddingTop = '5px';
                    item.style.paddingBottom = '11px';
                    item.style.lineHeight = '1.1';
                });

                cloneRoot.querySelectorAll('.gauge-main-num').forEach(el => {
                    el.style.lineHeight = '1.1';
                    el.style.marginBottom = '2px';
                });

                cloneRoot.querySelectorAll('i.fas, i.far, i.fab').forEach(ic => {
                    ic.style.display = 'inline-block';
                    ic.style.lineHeight = '1';
                    ic.style.position = 'relative';
                    ic.style.top = '-2px';
                });

                const listaFrentes = clonedDoc.getElementById('kpi-lista-frentes-nomes');
                if (listaFrentes) {
                    listaFrentes.style.maxHeight = 'none';
                    listaFrentes.style.overflow = 'visible';
                }

                const listaParadas = clonedDoc.getElementById('lista-frotas-paradas');
                if (listaParadas) {
                    listaParadas.style.maxHeight = 'none';
                    listaParadas.style.overflow = 'visible';
                }

                if (chartImgDataUrl) {
                    const cloneChart = clonedDoc.getElementById('graficoEvolucaoDmSerrana');
                    if (cloneChart) {
                        cloneChart.innerHTML = `<img src="${chartImgDataUrl}" style="width: 100%; height: 320px; object-fit: contain; display: block;" />`;
                    }
                }
            }
        });

        const link = document.createElement('a');
        const agora = new Date();
        const stamp = `${agora.getFullYear()}${String(agora.getMonth() + 1).padStart(2, '0')}${String(agora.getDate()).padStart(2, '0')}_${String(agora.getHours()).padStart(2, '0')}${String(agora.getMinutes()).padStart(2, '0')}`;
        link.download = `CCOL_SERRANA_${stamp}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

    } catch (err) {
        console.error('Erro ao exportar PNG Serrana:', err);
    } finally {
        if (botaoPrint) {
            botaoPrint.disabled = false;
            botaoPrint.innerHTML = textoOriginalBtn || '<i class="fas fa-camera"></i> Salvar Imagem';
        }
    }
};