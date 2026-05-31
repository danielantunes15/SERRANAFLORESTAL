// ==================== MÓDULO: GESTÃO CENTRAL DE CHAMADOS (TI) ====================

let chamadoFiltroStatus = 'Todos';
let chamadoFiltroModulo = 'Todos';
let idChamadoEmEdicao = null;
let mapaFiliaisCache = {};
let chamadosDataCache = []; // Guarda os dados em memória para os gráficos

// Instâncias do ECharts
let chartModulo = null;
let chartStatus = null;

window.carregarTelaChamados = async function() {
    await window.TI_carregarCacheFiliais();
    
    // Inicializa instâncias dos gráficos
    const domModulo = document.getElementById('chartChamadosModulo');
    const domStatus = document.getElementById('chartChamadosStatus');
    if (domModulo) chartModulo = echarts.init(domModulo);
    if (domStatus) chartStatus = echarts.init(domStatus);
    
    window.addEventListener('resize', function() {
        if (chartModulo) chartModulo.resize();
        if (chartStatus) chartStatus.resize();
    });

    await window.TI_atualizarTabelaChamados();
};

window.TI_carregarCacheFiliais = async function() {
    try {
        const { data, error } = await supabaseClient.from('filiais').select('id, nome');
        if (!error && data) {
            data.forEach(f => {
                mapaFiliaisCache[f.id] = f.nome;
            });
        }
    } catch (e) { 
        console.warn("Aviso: Falha cache filiais.", e); 
    }
};

window.TI_alterarFiltroStatus = function(val) {
    chamadoFiltroStatus = val;
    window.TI_aplicarFiltrosNaTela();
};

window.TI_alterarFiltroModulo = function(val) {
    chamadoFiltroModulo = val;
    window.TI_aplicarFiltrosNaTela();
};

/**
 * Busca TODOS os chamados do banco para calcular o Dashboard Global, 
 * depois aplica os filtros visuais na tabela.
 */
window.TI_atualizarTabelaChamados = async function() {
    const tbody = document.getElementById('corpoTabelaTIChamados');
    if (!tbody) return;

    try {
        // Trazemos tudo (sem limite) para ter estatísticas corretas do mês
        const { data, error } = await supabaseClient
            .from('chamados_suporte')
            .select('*')
            .order('data_criacao', { ascending: false });

        if (error) throw error;
        chamadosDataCache = data || [];
        
        // Atualiza os Gráficos e KPIs com a visão GLOBAL
        window.TI_atualizarDashboardDashboard(chamadosDataCache);
        
        // Renderiza a Tabela com os filtros selecionados
        window.TI_aplicarFiltrosNaTela();

    } catch (e) {
        console.error("Erro ao listar chamados:", e);
        tbody.innerHTML = `<tr><td colspan="8" style="padding:30px; color:#ef4444;">Erro crítico ao carregar chamados de suporte.</td></tr>`;
    }
};

/**
 * Função utilitária para converter minutos em formato legível (Ex: 2h 30m)
 */
function formatarMinutos(minutosTotais) {
    if (!minutosTotais || isNaN(minutosTotais)) return '0h 0m';
    const h = Math.floor(minutosTotais / 60);
    const m = Math.floor(minutosTotais % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

/**
 * Calcula os indicadores de SLA e popula os cards e gráficos
 */
window.TI_atualizarDashboardDashboard = function(data) {
    let abertos = 0;
    let totalResolvidos = 0;
    let somaMinutosResposta = 0;
    let countResposta = 0;
    let somaMinutosResolucao = 0;
    let countResolucao = 0;

    let dadosPorModulo = {};
    let dadosPorStatus = { 'Aberto': 0, 'Em Andamento': 0, 'Resolvido': 0, 'Cancelado': 0 };

    data.forEach(c => {
        // Contagem Status
        if (dadosPorStatus[c.status] !== undefined) dadosPorStatus[c.status]++;
        if (c.status === 'Aberto') abertos++;
        if (c.status === 'Resolvido') totalResolvidos++;

        // Contagem Módulos
        dadosPorModulo[c.modulo] = (dadosPorModulo[c.modulo] || 0) + 1;

        // SLA Cálculos
        if (c.sla_resposta_minutos) {
            somaMinutosResposta += c.sla_resposta_minutos;
            countResposta++;
        }
        if (c.sla_resolucao_minutos) {
            somaMinutosResolucao += c.sla_resolucao_minutos;
            countResolucao++;
        }
    });

    // Atualiza KPIs HTML
    const kpiAbertos = document.getElementById('kpiAbertos');
    if(kpiAbertos) kpiAbertos.innerText = abertos;
    
    let tmResposta = countResposta > 0 ? (somaMinutosResposta / countResposta) : 0;
    const kpiTMResposta = document.getElementById('kpiTMResposta');
    if(kpiTMResposta) kpiTMResposta.innerText = formatarMinutos(tmResposta);
    
    let tmResolucao = countResolucao > 0 ? (somaMinutosResolucao / countResolucao) : 0;
    const kpiTMResolucao = document.getElementById('kpiTMResolucao');
    if(kpiTMResolucao) kpiTMResolucao.innerText = formatarMinutos(tmResolucao);
    
    let taxa = data.length > 0 ? ((totalResolvidos / data.length) * 100).toFixed(1) : 0;
    const kpiTaxaResolucao = document.getElementById('kpiTaxaResolucao');
    if(kpiTaxaResolucao) kpiTaxaResolucao.innerText = `${taxa}%`;

    // Atualiza Gráfico Módulos (Barras)
    if (chartModulo) {
        let sortedModulos = Object.entries(dadosPorModulo).sort((a,b) => b[1] - a[1]);
        chartModulo.setOption({
            tooltip: { trigger: 'axis' },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: { type: 'value', splitLine: { lineStyle: { color: '#374151' } } },
            yAxis: { 
                type: 'category', 
                data: sortedModulos.map(m => m[0]),
                axisLabel: { color: '#9ca3af', width: 100, overflow: 'truncate' }
            },
            series: [{
                type: 'bar',
                data: sortedModulos.map(m => m[1]),
                itemStyle: { color: '#60a5fa', borderRadius: [0, 4, 4, 0] }
            }]
        });
    }

    // Atualiza Gráfico Status (Donut)
    if (chartStatus) {
        chartStatus.setOption({
            tooltip: { trigger: 'item' },
            legend: { top: 'bottom', textStyle: { color: '#9ca3af' } },
            series: [{
                name: 'Chamados',
                type: 'pie',
                radius: ['40%', '70%'],
                avoidLabelOverlap: false,
                itemStyle: { borderRadius: 10, borderColor: '#1f2937', borderWidth: 2 },
                label: { show: false, position: 'center' },
                emphasis: { label: { show: true, fontSize: 18, fontWeight: 'bold', color: '#fff' } },
                data: [
                    { value: dadosPorStatus['Aberto'], name: 'Aberto', itemStyle: { color: '#ef4444' } },
                    { value: dadosPorStatus['Em Andamento'], name: 'Andamento', itemStyle: { color: '#fb923c' } },
                    { value: dadosPorStatus['Resolvido'], name: 'Resolvido', itemStyle: { color: '#3ddc84' } },
                    { value: dadosPorStatus['Cancelado'], name: 'Cancelado', itemStyle: { color: '#6b7280' } }
                ]
            }]
        });
    }
};

window.TI_aplicarFiltrosNaTela = function() {
    const tbody = document.getElementById('corpoTabelaTIChamados');
    if (!tbody) return;

    let dadosFiltrados = chamadosDataCache;

    if (chamadoFiltroStatus !== 'Todos') {
        dadosFiltrados = dadosFiltrados.filter(c => c.status === chamadoFiltroStatus);
    }
    if (chamadoFiltroModulo !== 'Todos') {
        dadosFiltrados = dadosFiltrados.filter(c => c.modulo === chamadoFiltroModulo);
    }

    if (dadosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="padding: 30px; text-align: center; color: var(--text-secondary);">Nenhum chamado encontrado para os filtros selecionados.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    dadosFiltrados.forEach(chamado => {
        const dataCriacaoObj = new Date(chamado.data_criacao);
        const dataFormatada = dataCriacaoObj.toLocaleString('pt-BR').substring(0, 16); 
        const nomeFilial = mapaFiliaisCache[chamado.filial_id] || 'N/A';

        // Badges Status
        let badgeStyle = 'background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.2);';
        if (chamado.status === 'Em Andamento') badgeStyle = 'background: rgba(251,146,60,0.1); color: #fb923c; border: 1px solid rgba(251,146,60,0.2);';
        else if (chamado.status === 'Resolvido') badgeStyle = 'background: rgba(61,220,132,0.1); color: var(--ccol-green-bright); border: 1px solid rgba(61,220,132,0.2);';
        else if (chamado.status === 'Cancelado') badgeStyle = 'background: rgba(156,163,175,0.1); color: #9ca3af; border: 1px solid rgba(156,163,175,0.2);';

        // Calculando tempo corrido se estiver aberto
        let infoSLA = '';
        if (chamado.status === 'Aberto') {
            const minAberto = Math.floor((new Date() - dataCriacaoObj) / 60000);
            let corSLA = minAberto > 120 ? '#ef4444' : '#fb923c'; 
            infoSLA = `<span style="color: ${corSLA}; font-size: 0.75rem;"><i class="fas fa-clock"></i> ${formatarMinutos(minAberto)}</span>`;
        } else if (chamado.status === 'Resolvido') {
            infoSLA = `<span style="color: var(--ccol-green-bright); font-size: 0.75rem;"><i class="fas fa-check-double"></i> Concluído em ${formatarMinutos(chamado.sla_resolucao_minutos)}</span>`;
        } else if (chamado.status === 'Em Andamento') {
            infoSLA = `<span style="color: var(--ccol-blue-bright); font-size: 0.75rem;"><i class="fas fa-spinner fa-spin"></i> Em análise</span>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 500; font-size: 0.8rem; color: var(--text-secondary);">${dataFormatada}</td>
            <td style="font-weight: 600; color: #fff;">${nomeFilial}</td>
            <td><strong style="font-size: 0.85rem;">${chamado.nome_usuario}</strong></td>
            <td>
                <span style="font-size: 0.75rem; color: var(--text-secondary); display:block;">${chamado.tipo}</span>
                <strong style="font-size: 0.8rem; color: var(--ccol-blue-bright);">${chamado.modulo}</strong>
            </td>
            <td style="text-align: left; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${chamado.titulo}">
                <strong>${chamado.titulo}</strong>
            </td>
            <td><span style="padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 700; display: inline-block; ${badgeStyle}">${chamado.status}</span></td>
            <td>${infoSLA}</td>
            <td>
                <button class="btn-primary-blue" onclick="window.TI_abrirChat('${chamado.id}')" style="padding: 5px 10px; text-transform: none; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 4px;">
                    <i class="fas fa-headset"></i> Atender
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// ================= LÓGICA DO CHAT DA TI =================
let objChamadoRawData = null;

window.TI_abrirChat = function(id) {
    idChamadoEmEdicao = id;
    
    // Guardamos a data original para calcular os SLAs na hora de salvar
    objChamadoRawData = chamadosDataCache.find(c => c.id === id);
    if (!objChamadoRawData) return;

    document.getElementById('modalTINomeUser').innerText = objChamadoRawData.nome_usuario;
    document.getElementById('modalTIDataAbertura').innerText = new Date(objChamadoRawData.data_criacao).toLocaleString('pt-BR');
    document.getElementById('modalTITitulo').innerText = objChamadoRawData.titulo;
    document.getElementById('modalTIDescricao').innerText = objChamadoRawData.descricao;
    
    document.getElementById('modalTIStatusDefinir').value = objChamadoRawData.status === 'Aberto' ? 'Em Andamento' : objChamadoRawData.status;

    document.getElementById('modalTIResponderChamado').classList.add('show');
    
    // Aproveita a mesma função de renderização do app.js para desenhar os balões do chat
    if (typeof window.renderizarMensagensChat === 'function') {
        window.renderizarMensagensChat(objChamadoRawData.historico_conversa || []);
    }
};

window.TI_fecharModalResponder = function() {
    document.getElementById('modalTIResponderChamado').classList.remove('show');
    idChamadoEmEdicao = null;
    objChamadoRawData = null;
    document.getElementById('modalTIRespostaTexto').value = '';
};

// TI envia mensagem e altera status do chamado
window.TI_salvarSolucaoChamado = async function() {
    if (!idChamadoEmEdicao || !objChamadoRawData) return;

    const novoStatus = document.getElementById('modalTIStatusDefinir').value;
    const textoMsg = document.getElementById('modalTIRespostaTexto').value.trim();

    const btn = document.getElementById('btnTISalvarChamado');
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = '⏳ Calculando SLA e Salvando...'; 
    btn.disabled = true;

    try {
        // CORRIGIDO: Pega o ID de atendente diretamente da variável de sessão global
        let atendenteId = window.currentUser ? window.currentUser.id : null;

        const agora = new Date();
        const dataCriacaoObj = new Date(objChamadoRawData.data_criacao);
        
        let historico = objChamadoRawData.historico_conversa || [];

        // Só adiciona no chat se a TI digitou alguma coisa
        if (textoMsg) {
            historico.push({
                autor: 'TI',
                nome: window.currentUser.username, // Nome do técnico que respondeu
                data: agora.toISOString(),
                mensagem: textoMsg
            });
        }

        let updatePayload = {
            status: novoStatus,
            historico_conversa: historico,
            atendente_id: atendenteId,
            data_atualizacao: agora.toISOString()
        };

        // Regras de cálculo de SLA baseadas na mudança de status
        // 1. SLA de Primeira Resposta (Dispara na primeira vez que sai de Aberto)
        if (objChamadoRawData.status === 'Aberto' && (novoStatus === 'Em Andamento' || novoStatus === 'Resolvido')) {
            updatePayload.data_primeira_resposta = agora.toISOString();
            updatePayload.sla_resposta_minutos = Math.floor((agora - dataCriacaoObj) / 60000);
        }

        // 2. SLA de Resolução (Dispara quando o status muda para Resolvido)
        if (objChamadoRawData.status !== 'Resolvido' && novoStatus === 'Resolvido') {
            updatePayload.data_resolucao = agora.toISOString();
            updatePayload.sla_resolucao_minutos = Math.floor((agora - dataCriacaoObj) / 60000);
        }

        const { error } = await supabaseClient
            .from('chamados_suporte')
            .update(updatePayload)
            .eq('id', idChamadoEmEdicao);

        if (error) throw error;

        // Atualiza as variáveis em memória para refletir imediatamente na tela
        objChamadoRawData.historico_conversa = historico;
        objChamadoRawData.status = novoStatus;
        
        // Limpa campo e atualiza a caixinha do chat sem fechar o modal
        document.getElementById('modalTIRespostaTexto').value = '';
        if (typeof window.renderizarMensagensChat === 'function') {
            window.renderizarMensagensChat(historico);
        }
        
        // Atualiza a tabela de fundo com os novos status
        window.TI_aplicarFiltrosNaTela();
        
        // Pequeno alerta de confirmação no console para não incomodar o técnico a cada mensagem enviada
        console.log("Incidente atualizado e SLA registrado!");

    } catch (e) {
        console.error("Erro ao salvar atualização de chamado:", e);
        alert("Erro técnico ao salvar modificações no banco de dados.");
    } finally {
        btn.innerHTML = txtOriginal; 
        btn.disabled = false;
    }
};