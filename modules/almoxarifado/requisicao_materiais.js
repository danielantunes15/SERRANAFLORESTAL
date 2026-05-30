// ==================== MÓDULO: REQUISIÇÃO DE MATERIAIS ====================

// Variável para armazenar os dados carregados temporariamente
let requisicoesAtuais = [];
let mapaNomesUsuarios = {};
let mapaNomesCCs = {};

window.renderizarRequisicoes = async function() {
    const tbody = document.getElementById('tbodyRequisicoes');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Carregando requisições...</td></tr>';

    try {
        // 1. Busca rápida de mapeamento (Nomes e Centros de Custo)
        const { data: usersData } = await supabaseClient.from('usuarios').select('id, username');
        if (usersData) usersData.forEach(u => mapaNomesUsuarios[u.id] = u.username);
        
        const { data: ccData } = await supabaseClient.from('centro_custo').select('id, nome');
        if (ccData) ccData.forEach(c => mapaNomesCCs[c.id] = c.nome);

        // 2. Monta a Query principal
        let query = supabaseClient.from('almoxarifado_requisicoes').select('*').order('data_solicitacao', { ascending: false });

        // TRAVAS DE SEGURANÇA VISUAL E DE FILIAL
        const userFilial = window.currentUser.filial_id;
        const userRole = window.currentUser.role;
        
        // Verifica se é administrador ou gerente (Tem poderes para ver tudo da filial e atender)
        const podeAtender = (userRole === 'SuperAdmin' || userRole === 'Gerente');

        if (!podeAtender) {
            // Se for usuário operacional comum, só vê as DELE mesmo
            query = query.eq('usuario_id', window.currentUser.id);
        } else {
            // Se for gestor, vê todas DA FILIAL DELE
            if (userFilial !== null && userFilial !== 'CENTRAL') {
                query = query.eq('filial_id', userFilial);
            }
        }

        const { data, error } = await query;
        if (error) throw error;
        
        requisicoesAtuais = data || [];

        if (requisicoesAtuais.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #94a3b8;">Nenhuma requisição encontrada no seu setor.</td></tr>';
            return;
        }

        let html = '';
        requisicoesAtuais.forEach(req => {
            
            // Formatadores visuais
            const solicitante = mapaNomesUsuarios[req.usuario_id] || `User ${req.usuario_id}`;
            const cc = req.centro_custo_id ? (mapaNomesCCs[req.centro_custo_id] || `CC ${req.centro_custo_id}`) : 'Não Informado';
            const dataReq = new Date(req.data_solicitacao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            
            // Controle de Status e Cores
            let statusBadge = '';
            if (req.status === 'Pendente') statusBadge = `<span style="background: rgba(251, 191, 36, 0.1); color: #fde047; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; border: 1px solid #fde047;">🟡 Pendente</span>`;
            else if (req.status === 'Aprovado') statusBadge = `<span style="background: rgba(59, 130, 246, 0.1); color: #60a5fa; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; border: 1px solid #60a5fa;">🔵 Aprovado</span>`;
            else if (req.status === 'Entregue') statusBadge = `<span style="background: rgba(34, 197, 94, 0.1); color: #4ade80; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; border: 1px solid #4ade80;">🟢 Entregue</span>`;
            else if (req.status === 'Rejeitado') statusBadge = `<span style="background: rgba(239, 68, 68, 0.1); color: #f87171; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; border: 1px solid #f87171;">🔴 Rejeitado</span>`;

            // Botões de Ação
            let botoes = '';
            
            // Se o usuário logado for quem criou, e o pedido ainda estiver pendente, ele pode cancelar/excluir
            if (req.usuario_id === window.currentUser.id && req.status === 'Pendente') {
                botoes += `<button onclick="excluirRequisicao(${req.id})" style="background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; color: #ef4444; padding: 5px 8px; border-radius: 4px; cursor: pointer; font-size: 0.75rem;" title="Cancelar Pedido"><i class="fas fa-trash"></i> Cancelar</button>`;
            }

            // Se for gestor e o status não for Entregue nem Rejeitado, mostra o botão de Atender
            if (podeAtender) {
                botoes += `<button onclick="abrirModalAtender(${req.id})" style="background: rgba(59, 130, 246, 0.1); border: 1px solid #3b82f6; color: #3b82f6; padding: 5px 8px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; margin-left: 5px;" title="Atualizar Status do Pedido"><i class="fas fa-clipboard-check"></i> Atender</button>`;
            }

            if (!botoes) botoes = '<span style="color: #64748b; font-size: 0.8rem;">Bloqueado</span>';

            html += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 12px; font-weight: bold; color: var(--ccol-blue-bright);">#${req.id}</td>
                <td style="padding: 12px; color: var(--text-secondary); font-size: 0.85rem;">${dataReq}</td>
                <td style="padding: 12px; color: #f8fafc;">${solicitante}</td>
                <td style="padding: 12px; color: #cbd5e1; font-size: 0.85rem;">${cc}</td>
                <td style="padding: 12px; color: #f8fafc; font-size: 0.85rem; white-space: pre-wrap;">${req.itens}</td>
                <td style="padding: 12px; text-align: center;">${statusBadge}</td>
                <td style="padding: 12px; text-align: center;">${botoes}</td>
            </tr>`;
        });

        tbody.innerHTML = html;

    } catch (error) {
        console.error("Erro ao carregar requisições:", error);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #ef4444;">Erro ao processar as requisições.</td></tr>';
    }
};

window.carregarCCRequisicao = async function() {
    const select = document.getElementById('reqCentroCusto');
    if (!select) return;
    
    let query = supabaseClient.from('centro_custo').select('id, nome, codigo').eq('status', 'Ativo');
    
    const filialId = window.currentUser.filial_id;
    if (filialId !== null && filialId !== 'CENTRAL') {
        query = query.or(`filial_id.eq.${parseInt(filialId)},filial_id.is.null`);
    } else {
        query = query.is('filial_id', null);
    }

    const { data } = await query;
    if (!data || data.length === 0) {
        select.innerHTML = '<option value="">Nenhum Centro Ativo</option>';
        return;
    }
    
    select.innerHTML = '<option value="" disabled selected>-- Selecione o CC da sua Área --</option>' + data.map(cc => {
        return `<option value="${cc.id}">[${cc.codigo}] - ${cc.nome}</option>`;
    }).join('');
};

window.abrirModalNovaRequisicao = function() {
    document.getElementById('modalNovaRequisicao').style.display = 'flex';
    document.getElementById('reqItens').value = '';
    document.getElementById('reqJustificativa').value = '';
    window.carregarCCRequisicao();
};

window.fecharModalNovaRequisicao = function() {
    document.getElementById('modalNovaRequisicao').style.display = 'none';
};

window.salvarNovaRequisicao = async function() {
    const ccId = document.getElementById('reqCentroCusto').value;
    const itensText = document.getElementById('reqItens').value.trim();
    const justificativaText = document.getElementById('reqJustificativa').value.trim();

    if (!ccId) { alert("⚠️ Selecione o Centro de Custo."); return; }
    if (!itensText) { alert("⚠️ Escreva os itens que você precisa."); return; }

    const payload = {
        filial_id: window.currentUser.filial_id === 'CENTRAL' ? null : window.currentUser.filial_id,
        usuario_id: window.currentUser.id,
        centro_custo_id: parseInt(ccId),
        itens: itensText,
        justificativa: justificativaText,
        status: 'Pendente'
    };

    try {
        const { error } = await supabaseClient.from('almoxarifado_requisicoes').insert([payload]);
        if (error) throw error;
        
        alert("✅ Sua requisição foi enviada com sucesso! Aguarde a aprovação do Almoxarifado.");
        window.fecharModalNovaRequisicao();
        window.renderizarRequisicoes();
    } catch (e) {
        console.error(e);
        alert("❌ Ocorreu um erro ao enviar sua requisição.");
    }
};

window.excluirRequisicao = async function(id) {
    if(!confirm("⚠️ Deseja cancelar e excluir este pedido?")) return;
    try {
        await supabaseClient.from('almoxarifado_requisicoes').delete().eq('id', id);
        window.renderizarRequisicoes();
    } catch(e) {
        console.error(e);
    }
};

// ==================== LÓGICAS DO ALMOXARIFE / ATENDENTE ====================

window.abrirModalAtender = function(id) {
    const req = requisicoesAtuais.find(r => r.id === id);
    if (!req) return;

    document.getElementById('atenderReqId').value = req.id;
    document.getElementById('atenderItensDetalhes').innerText = req.itens + (req.justificativa ? `\n\n📌 Motivo: ${req.justificativa}` : '');
    document.getElementById('atenderStatus').value = req.status;
    document.getElementById('atenderObs').value = req.observacao_almoxarifado || '';

    document.getElementById('modalAtenderRequisicao').style.display = 'flex';
};

window.fecharModalAtender = function() {
    document.getElementById('modalAtenderRequisicao').style.display = 'none';
};

window.salvarAtendimentoRequisicao = async function() {
    const id = document.getElementById('atenderReqId').value;
    const novoStatus = document.getElementById('atenderStatus').value;
    const obs = document.getElementById('atenderObs').value.trim();

    const payload = {
        status: novoStatus,
        observacao_almoxarifado: obs,
        data_atendimento: new Date().toISOString(),
        atendido_por: window.currentUser.id
    };

    try {
        const { error } = await supabaseClient.from('almoxarifado_requisicoes').update(payload).eq('id', id);
        if (error) throw error;
        
        alert("✅ Status do pedido atualizado com sucesso!");
        window.fecharModalAtender();
        window.renderizarRequisicoes();
    } catch (e) {
        console.error(e);
        alert("❌ Ocorreu um erro ao gravar o atendimento.");
    }
};