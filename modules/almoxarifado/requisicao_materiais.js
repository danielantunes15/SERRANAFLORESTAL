// ==================== js/requisicao_materiais.js ====================

let pecasDisponiveis = [];

window.renderizarRequisicoes = async function() {
    await carregarCentrosCustoRM();
    await carregarPecasParaSelect();
    await carregarMinhasRequisicoes();
};

async function carregarCentrosCustoRM() {
    const select = document.getElementById('reqCentroCusto');
    if (!select || !window.supabaseClient) return;

    try {
        let query = window.supabaseClient.from('centro_custo').select('nome, codigo').eq('status', 'Ativo');
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
        
        const { data } = await query;
        if (data && data.length > 0) {
            select.innerHTML = '<option value="" disabled selected>-- Selecione o Centro de Custo --</option>' + 
                data.map(c => `<option value="${c.nome}">[${c.codigo}] ${c.nome}</option>`).join('');
        } else {
            select.innerHTML = '<option value="" disabled>Nenhum Setor Cadastrado na Filial</option>';
        }
    } catch (e) {
        select.innerHTML = '<option value="" disabled>Erro ao carregar setores</option>';
    }
}

async function carregarPecasParaSelect() {
    const select = document.getElementById('reqPecaSelect');
    if (!select || !window.supabaseClient) return;

    try {
        let query = window.supabaseClient.from('almoxarifado_pecas').select('*').order('nome');
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
        
        const { data } = await query;
        pecasDisponiveis = data || [];

        if (pecasDisponiveis.length === 0) {
            select.innerHTML = '<option value="" disabled>O estoque está vazio.</option>';
        } else {
            select.innerHTML = '<option value="" disabled selected>-- Selecione um material --</option>' + 
                pecasDisponiveis.map(p => `<option value="${p.id}">${p.codigo ? '['+p.codigo+'] ' : ''}${p.nome} (Estoque: ${p.quantidade})</option>`).join('');
        }
    } catch (e) {
        select.innerHTML = '<option value="" disabled>Erro ao carregar peças</option>';
    }
}

window.enviarRequisicaoPeca = async function(e) {
    e.preventDefault();
    
    const centroCusto = document.getElementById('reqCentroCusto').value;
    const pecaId = document.getElementById('reqPecaSelect').value;
    const qtd = parseFloat(document.getElementById('reqQuantidade').value);
    const usuarioNome = window.currentUser ? window.currentUser.username : 'Usuário Sistema';

    const btnSubmit = document.getElementById('btnReqSalvar');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';

    const pecaSelecionada = pecasDisponiveis.find(p => p.id == pecaId);
    
    let novaRequisicao = {
        centro_custo: centroCusto,
        os_id: null, // Deixamos null pois não é O.S
        placa: null, // Deixamos null pois não é Frota
        peca_id: pecaId,
        quantidade: qtd,
        valor_unitario: pecaSelecionada ? pecaSelecionada.preco_medio : 0,
        mecanico_responsavel: usuarioNome,
        status: 'Pendente'
    };

    if (typeof window.injetarFilial === 'function') {
        novaRequisicao = window.injetarFilial(novaRequisicao);
    }

    try {
        const { data, error } = await window.supabaseClient.from('os_pecas_utilizadas').insert([novaRequisicao]).select();
        if (error) throw error;
        
        const idGerado = data && data.length > 0 ? data[0].id : '';
        alert(`✅ Material solicitado com sucesso! \nFoi gerada a Requisição RM #${idGerado}`);
        
        document.getElementById('formRequisicaoInterna').reset();
        await carregarMinhasRequisicoes();
    } catch (err) {
        console.error(err);
        alert("❌ Erro ao solicitar peça no banco de dados.");
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Solicitação';
    }
};

async function carregarMinhasRequisicoes() {
    const tbody = document.getElementById('listaMinhasRequisicoes');
    if (!tbody || !window.supabaseClient) return;

    const usuarioLogado = window.currentUser ? window.currentUser.username : null;
    if (!usuarioLogado) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Faça login para ver suas requisições.</td></tr>';
        return;
    }

    try {
        const limiteDias = new Date();
        limiteDias.setDate(limiteDias.getDate() - 15);

        let query = window.supabaseClient.from('os_pecas_utilizadas')
            .select('*')
            .eq('mecanico_responsavel', usuarioLogado)
            .gte('created_at', limiteDias.toISOString())
            .order('id', { ascending: false });

        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
        
        const { data } = await query;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 20px;">Você não possui RMs recentes.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(req => {
            const dataStr = new Date(req.created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const pecaObj = pecasDisponiveis.find(p => p.id == req.peca_id);
            const nomePeca = pecaObj ? pecaObj.nome : '<i style="color:#ef4444">Peça Excluída</i>';
            
            let statusBadge = '';
            if (req.status === 'Pendente') statusBadge = '<span style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;"><i class="fas fa-clock"></i> Pendente</span>';
            else if (req.status === 'Aprovado') statusBadge = '<span style="background: rgba(16, 185, 129, 0.2); color: #34d399; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;"><i class="fas fa-check"></i> Liberada / Entregue</span>';
            else statusBadge = '<span style="background: rgba(239, 68, 68, 0.2); color: #f87171; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;"><i class="fas fa-times"></i> Recusada</span>';

            const txtOrigem = req.centro_custo ? `<strong style="color:#a855f7;">RM #${req.id}</strong><br><span style="font-size:0.85rem; color:#94a3b8;">${req.centro_custo}</span>` : `<strong style="color:#60a5fa;">O.S #${req.os_id}</strong><br><span style="font-size:0.85rem; color:#94a3b8;">${req.placa}</span>`;

            return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="color: #94a3b8; font-size: 0.85rem; padding: 12px;">${dataStr}</td>
                    <td style="padding: 12px;">${txtOrigem}</td>
                    <td style="padding: 12px; font-weight: 500;">${nomePeca}</td>
                    <td style="padding: 12px; font-size: 1.1rem; font-weight: bold;">${req.quantidade}</td>
                    <td style="padding: 12px;">${statusBadge}</td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ef4444; padding: 20px;">Erro ao carregar seu histórico.</td></tr>';
    }
}