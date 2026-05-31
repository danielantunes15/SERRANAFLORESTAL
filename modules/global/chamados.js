// ==================== MÓDULO: GESTÃO CENTRAL DE CHAMADOS (TI) ====================

let chamadoFiltroStatus = 'Todos';
let chamadoFiltroModulo = 'Todos';
let idChamadoEmEdicao = null;
let mapaFiliaisCache = {};
let chamadosDataCache = []; 
let chatIntervalTI = null; // Variável do Auto-Update da TI

let chartModulo = null;
let chartStatus = null;

window.carregarTelaChamados = async function() {
    await window.TI_carregarCacheFiliais();
    
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
    } catch (e) {}
};

window.TI_alterarFiltroStatus = function(val) {
    chamadoFiltroStatus = val;
    window.TI_aplicarFiltrosNaTela();
};

window.TI_alterarFiltroModulo = function(val) {
    chamadoFiltroModulo = val;
    window.TI_aplicarFiltrosNaTela();
};

window.TI_atualizarTabelaChamados = async function() {
    const tbody = document.getElementById('corpoTabelaTIChamados');
    if (!tbody) return;

    try {
        const { data, error } = await supabaseClient
            .from('chamados_suporte')
            .select('*')
            .order('data_criacao', { ascending: false });

        if (error) throw error;
        chamadosDataCache = data || [];
        
        window.TI_atualizarDashboardDashboard(chamadosDataCache);
        window.TI_aplicarFiltrosNaTela();

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="9" style="padding:30px; color:#ef4444; text-align:center;">Erro crítico ao carregar chamados de suporte.</td></tr>`;
    }
};

function formatarMinutos(minutosTotais) {
    if (!minutosTotais || isNaN(minutosTotais)) return '0h 0m';
    const h = Math.floor(minutosTotais / 60);
    const m = Math.floor(minutosTotais % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

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
        if (dadosPorStatus[c.status] !== undefined) dadosPorStatus[c.status]++;
        if (c.status === 'Aberto') abertos++;
        if (c.status === 'Resolvido') totalResolvidos++;

        dadosPorModulo[c.modulo] = (dadosPorModulo[c.modulo] || 0) + 1;

        if (c.sla_resposta_minutos) {
            somaMinutosResposta += c.sla_resposta_minutos;
            countResposta++;
        }
        if (c.sla_resolucao_minutos) {
            somaMinutosResolucao += c.sla_resolucao_minutos;
            countResolucao++;
        }
    });

    const kpiTotal = document.getElementById('kpiTotal');
    if(kpiTotal) kpiTotal.innerText = data.length;

    const kpiAbertos = document.getElementById('kpiAbertos');
    if(kpiAbertos) kpiAbertos.innerText = abertos;
    
    const kpiResolvidos = document.getElementById('kpiResolvidos');
    if(kpiResolvidos) kpiResolvidos.innerText = totalResolvidos;

    let tmResolucao = countResolucao > 0 ? (somaMinutosResolucao / countResolucao) : 0;
    const kpiTMResolucao = document.getElementById('kpiTMResolucao');
    if(kpiTMResolucao) kpiTMResolucao.innerText = formatarMinutos(tmResolucao);
    
    let taxa = data.length > 0 ? ((totalResolvidos / data.length) * 100).toFixed(1) : 0;
    const kpiTaxaResolucao = document.getElementById('kpiTaxaResolucao');
    if(kpiTaxaResolucao) kpiTaxaResolucao.innerText = `${taxa}%`;

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

    if (chamadoFiltroStatus !== 'Todos') dadosFiltrados = dadosFiltrados.filter(c => c.status === chamadoFiltroStatus);
    if (chamadoFiltroModulo !== 'Todos') dadosFiltrados = dadosFiltrados.filter(c => c.modulo === chamadoFiltroModulo);

    if (dadosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="padding: 30px; text-align: center; color: var(--text-secondary);">Nenhum chamado encontrado para os filtros selecionados.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    dadosFiltrados.forEach(chamado => {
        const dataCriacaoObj = new Date(chamado.data_criacao);
        const dataFormatada = dataCriacaoObj.toLocaleString('pt-BR').substring(0, 16); 
        const nomeFilial = mapaFiliaisCache[chamado.filial_id] || 'N/A';

        let badgeStyle = 'background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.2);';
        if (chamado.status === 'Em Andamento') badgeStyle = 'background: rgba(251,146,60,0.1); color: #fb923c; border: 1px solid rgba(251,146,60,0.2);';
        else if (chamado.status === 'Resolvido') badgeStyle = 'background: rgba(61,220,132,0.1); color: var(--ccol-green-bright); border: 1px solid rgba(61,220,132,0.2);';
        else if (chamado.status === 'Cancelado') badgeStyle = 'background: rgba(156,163,175,0.1); color: #9ca3af; border: 1px solid rgba(156,163,175,0.2);';

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
            <td><strong style="color: var(--ccol-blue-bright); font-size: 0.9rem;">#${chamado.id}</strong></td>
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

window.renderizarMensagensChatTI = function(historico) {
    const container = document.getElementById('chatMensagensContainerTI');
    if (!container) return;
    
    container.innerHTML = '';

    if (!historico || historico.length === 0) {
        container.innerHTML = `<p style="color:#9ca3af; text-align:center; margin-top:20px;">Nenhuma interação registrada.</p>`;
        return;
    }

    historico.forEach(msg => {
        const dataFmt = new Date(msg.data).toLocaleString('pt-BR');
        const isTI = msg.autor === 'TI';

        const align = isTI ? 'align-self: flex-end;' : 'align-self: flex-start;';
        const bgColor = isTI ? 'background: #2563eb;' : 'background: #374151;';
        const borderRadius = isTI ? 'border-radius: 12px 12px 0 12px;' : 'border-radius: 12px 12px 12px 0;';
        const iconUser = isTI ? '💻 TI' : '👤';

        const div = document.createElement('div');
        div.style.cssText = `max-width: 85%; padding: 12px 16px; color: #fff; display: flex; flex-direction: column; box-shadow: 0 4px 6px rgba(0,0,0,0.1); ${align} ${bgColor} ${borderRadius}`;
        
        div.innerHTML = `
            <div style="font-size: 0.75rem; color: #cbd5e1; margin-bottom: 8px; font-weight:bold; display: flex; justify-content: space-between; gap: 15px;">
                <span>${iconUser} ${msg.nome}</span> 
                <span style="font-weight:normal; opacity: 0.8;">${dataFmt}</span>
            </div>
            <div style="font-size: 0.95rem; line-height: 1.5; word-wrap: break-word; white-space: pre-wrap;">${msg.mensagem}</div>
        `;
        container.appendChild(div);
    });

    setTimeout(() => { container.scrollTop = container.scrollHeight; }, 100);
};

window.TI_abrirChat = function(id) {
    idChamadoEmEdicao = parseInt(id);
    
    objChamadoRawData = chamadosDataCache.find(c => c.id === idChamadoEmEdicao);
    if (!objChamadoRawData) return;

    document.getElementById('modalTINomeUser').innerText = objChamadoRawData.nome_usuario;
    document.getElementById('modalTIDataAbertura').innerText = new Date(objChamadoRawData.data_criacao).toLocaleString('pt-BR');
    document.getElementById('modalTITitulo').innerText = `Chamado #${objChamadoRawData.id} - ${objChamadoRawData.titulo}`;
    document.getElementById('modalTIDescricao').innerText = objChamadoRawData.descricao;
    document.getElementById('modalTIStatusDefinir').value = objChamadoRawData.status === 'Aberto' ? 'Em Andamento' : objChamadoRawData.status;

    document.getElementById('modalTIResponderChamado').classList.add('show');
    
    window.renderizarMensagensChatTI(objChamadoRawData.historico_conversa || []);

    // ===== SMART POLLING TI (Verifica o banco a cada 4 segundos sem pesar) =====
    if (chatIntervalTI) clearInterval(chatIntervalTI);
    chatIntervalTI = setInterval(async () => {
        try {
            const { data } = await supabaseClient
                .from('chamados_suporte')
                .select('historico_conversa, status')
                .eq('id', idChamadoEmEdicao)
                .single();
                
            if (data && data.historico_conversa) {
                const historicoLocal = objChamadoRawData.historico_conversa || [];
                
                // Se a quantidade de mensagens no banco for maior que a tela da TI, a gente desenha de novo
                if (data.historico_conversa.length > historicoLocal.length) {
                    objChamadoRawData.historico_conversa = data.historico_conversa;
                    window.renderizarMensagensChatTI(data.historico_conversa);
                    
                    // Se o usuário cancelou o chamado do lado dele, reflete na tela da TI
                    if(data.status !== objChamadoRawData.status) {
                        objChamadoRawData.status = data.status;
                        document.getElementById('modalTIStatusDefinir').value = data.status === 'Aberto' ? 'Em Andamento' : data.status;
                        window.TI_aplicarFiltrosNaTela();
                    }
                }
            }
        } catch(e) {}
    }, 4000);
};

window.TI_fecharModalResponder = function() {
    document.getElementById('modalTIResponderChamado').classList.remove('show');
    idChamadoEmEdicao = null;
    objChamadoRawData = null;
    document.getElementById('modalTIRespostaTexto').value = '';
    
    // IMPORTANTE: Desliga o Polling de atualização automática
    if (chatIntervalTI) {
        clearInterval(chatIntervalTI);
        chatIntervalTI = null;
    }
};

window.TI_salvarSolucaoChamado = async function() {
    if (!idChamadoEmEdicao || !objChamadoRawData) return;

    const novoStatus = document.getElementById('modalTIStatusDefinir').value;
    const textoMsg = document.getElementById('modalTIRespostaTexto').value.trim();

    const btn = document.getElementById('btnTISalvarChamado');
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = '⏳ Salvando...'; 
    btn.disabled = true;

    try {
        let atendenteId = window.currentUser ? window.currentUser.id : null;
        const agora = new Date();
        const dataCriacaoObj = new Date(objChamadoRawData.data_criacao);
        
        let historico = objChamadoRawData.historico_conversa || [];

        if (textoMsg) {
            historico.push({
                autor: 'TI',
                nome: window.currentUser.username, 
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

        if (objChamadoRawData.status === 'Aberto' && (novoStatus === 'Em Andamento' || novoStatus === 'Resolvido')) {
            updatePayload.data_primeira_resposta = agora.toISOString();
            updatePayload.sla_resposta_minutos = Math.floor((agora - dataCriacaoObj) / 60000);
        }

        if (objChamadoRawData.status !== 'Resolvido' && novoStatus === 'Resolvido') {
            updatePayload.data_resolucao = agora.toISOString();
            updatePayload.sla_resolucao_minutos = Math.floor((agora - dataCriacaoObj) / 60000);
        }

        const { error } = await supabaseClient
            .from('chamados_suporte')
            .update(updatePayload)
            .eq('id', idChamadoEmEdicao);

        if (error) throw error;

        objChamadoRawData.historico_conversa = historico;
        objChamadoRawData.status = novoStatus;
        
        document.getElementById('modalTIRespostaTexto').value = '';
        window.renderizarMensagensChatTI(historico);
        window.TI_aplicarFiltrosNaTela();

    } catch (e) {
        alert("Erro técnico ao salvar modificações no banco de dados.");
    } finally {
        btn.innerHTML = txtOriginal; 
        btn.disabled = false;
    }
};