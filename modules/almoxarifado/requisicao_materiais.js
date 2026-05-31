// ==================== js/requisicao_materiais.js ====================

let pecasDisponiveis = [];

window.renderizarRequisicoes = async function() {
    await carregarPecasParaSelect();
    await carregarMinhasRequisicoes();
    configurarBuscaPlacaOS();
};

async function carregarPecasParaSelect() {
    const select = document.getElementById('reqPecaSelect');
    if (!select || !window.supabaseClient) return;

    try {
        let query = window.supabaseClient.from('almoxarifado_pecas').select('*').order('nome');
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
        
        const { data } = await query;
        pecasDisponiveis = data || [];

        if (pecasDisponiveis.length === 0) {
            select.innerHTML = '<option value="">O estoque está vazio.</option>';
        } else {
            select.innerHTML = '<option value="">-- Selecione uma peça --</option>' + 
                pecasDisponiveis.map(p => `<option value="${p.id}">${p.codigo ? '['+p.codigo+'] ' : ''}${p.nome} (Estoque: ${p.quantidade})</option>`).join('');
        }
    } catch (e) {
        console.error("Erro ao puxar estoque:", e);
        select.innerHTML = '<option value="">Erro ao carregar peças</option>';
    }
}

function configurarBuscaPlacaOS() {
    const inputOS = document.getElementById('reqOsId');
    const inputPlaca = document.getElementById('reqPlaca');

    if (!inputOS || !inputPlaca) return;

    inputOS.onchange = async function() {
        const osId = inputOS.value.trim();
        if (!osId) { inputPlaca.value = ''; return; }
        
        inputPlaca.value = "Buscando Placa...";
        try {
            const { data } = await window.supabaseClient.from('ordens_servico').select('placa').eq('id', osId).maybeSingle();
            if (data && data.placa) {
                inputPlaca.value = data.placa;
                inputPlaca.style.color = '#10b981'; setTimeout(() => { inputPlaca.style.color = '#fff'; }, 2000);
            } else {
                inputPlaca.value = "OS NÃO ENCONTRADA";
                inputPlaca.style.color = '#ef4444'; setTimeout(() => { inputPlaca.style.color = '#fff'; }, 2000);
            }
        } catch (e) {
            inputPlaca.value = "ERRO AO BUSCAR";
        }
    };
}

window.enviarRequisicaoPeca = async function(e) {
    e.preventDefault();
    
    const osId = document.getElementById('reqOsId').value.trim();
    const placa = document.getElementById('reqPlaca').value.trim();
    const pecaId = document.getElementById('reqPecaSelect').value;
    const qtd = parseFloat(document.getElementById('reqQuantidade').value);
    const mecanicoNome = window.currentUser ? window.currentUser.username : 'Mecânico Sistema';

    if (placa === "OS NÃO ENCONTRADA" || !placa) {
        alert("Você precisa informar uma O.S válida para gerar a requisição da peça.");
        return;
    }

    const btnSubmit = document.getElementById('btnReqSalvar');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

    const pecaSelecionada = pecasDisponiveis.find(p => p.id == pecaId);
    
    let novaRequisicao = {
        os_id: osId,
        placa: placa,
        peca_id: pecaId,
        quantidade: qtd,
        valor_unitario: pecaSelecionada ? pecaSelecionada.preco_medio : 0,
        mecanico_responsavel: mecanicoNome,
        status: 'Pendente'
    };

    if (typeof window.injetarFilial === 'function') {
        novaRequisicao = window.injetarFilial(novaRequisicao);
    }

    try {
        const { error } = await window.supabaseClient.from('os_pecas_utilizadas').insert([novaRequisicao]);
        if (error) throw error;
        
        alert(`✅ Peça solicitada com sucesso! \nAguarde a liberação do Almoxarifado.`);
        
        document.getElementById('reqOsId').value = '';
        document.getElementById('reqPlaca').value = '';
        document.getElementById('reqPecaSelect').value = '';
        document.getElementById('reqQuantidade').value = '';
        
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

    const mecanicoAtual = window.currentUser ? window.currentUser.username : null;
    if (!mecanicoAtual) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Faça login para ver suas requisições.</td></tr>';
        return;
    }

    try {
        const limiteDias = new Date();
        limiteDias.setDate(limiteDias.getDate() - 15);

        let query = window.supabaseClient.from('os_pecas_utilizadas')
            .select('*')
            .eq('mecanico_responsavel', mecanicoAtual)
            .gte('created_at', limiteDias.toISOString())
            .order('id', { ascending: false });

        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
        
        const { data } = await query;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 20px;">Você não fez nenhuma solicitação recentemente.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(req => {
            const dataStr = new Date(req.created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const pecaObj = pecasDisponiveis.find(p => p.id == req.peca_id);
            const nomePeca = pecaObj ? pecaObj.nome : '<i style="color:#ef4444">Desconhecida/Excluída</i>';
            
            let statusBadge = '';
            if (req.status === 'Pendente') statusBadge = '<span style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;"><i class="fas fa-clock"></i> Em Análise</span>';
            else if (req.status === 'Aprovado') statusBadge = '<span style="background: rgba(16, 185, 129, 0.2); color: #34d399; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;"><i class="fas fa-check"></i> Liberada (Entregue)</span>';
            else statusBadge = '<span style="background: rgba(239, 68, 68, 0.2); color: #f87171; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;"><i class="fas fa-times"></i> Recusada</span>';

            return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="color: #94a3b8; font-size: 0.85rem; padding: 12px;">${dataStr}</td>
                    <td style="padding: 12px;"><strong>O.S #${req.os_id}</strong><br><span style="color:#60a5fa; font-size:0.85rem;">Placa: ${req.placa}</span></td>
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