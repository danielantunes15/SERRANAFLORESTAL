// ==================== js/auditoria_logs.js ====================

let todosLogs = [];

window.renderizarAuditoriaLogs = async function() {
    await carregarLogsAuditoria();
};

async function carregarLogsAuditoria() {
    const tbody = document.getElementById('tabelaLogsBody');
    if (!tbody || !window.supabaseClient) return;

    try {
        // Puxando da tabela logs_exclusao e ordenando pelo campo correto
        let query = window.supabaseClient.from('logs_exclusao').select('*').order('data_hora', { ascending: false }).limit(500);
        
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);

        const { data, error } = await query;
        if (error) throw error;

        todosLogs = data || [];
        renderizarTabelaLogs(todosLogs);
    } catch (e) {
        console.error("Erro ao carregar logs", e);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #ef4444;">Erro ao puxar dados da auditoria.</td></tr>';
    }
}

function renderizarTabelaLogs(lista) {
    const tbody = document.getElementById('tabelaLogsBody');
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhum registro encontrado.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(log => {
        // Usa o campo 'data_hora' da sua tabela original
        const dataStr = log.data_hora ? new Date(log.data_hora).toLocaleString('pt-BR') : '-';
        
        let corAcao = '#e2e8f0';
        const acaoUpper = (log.acao || '').toUpperCase();
        if (acaoUpper.includes('EXCLUSÃO') || acaoUpper.includes('DELETAR') || acaoUpper.includes('RECUSADO')) corAcao = '#f87171';
        if (acaoUpper.includes('CRIAÇÃO') || acaoUpper.includes('NOVO') || acaoUpper.includes('APROVADO')) corAcao = '#34d399';
        if (acaoUpper.includes('EDIÇÃO') || acaoUpper.includes('ATUALIZAR')) corAcao = '#60a5fa';

        return `
            <tr>
                <td style="color: #94a3b8; font-family: monospace;">${dataStr}</td>
                <td><strong style="color: #38bdf8;"><i class="fas fa-user-circle"></i> ${log.usuario || 'Desconhecido'}</strong></td>
                <td><strong style="color: ${corAcao};">${log.acao || '-'}</strong></td>
                <td style="color: #cbd5e1;">${log.detalhes || '-'}</td>
            </tr>
        `;
    }).join('');
}

window.filtrarLogs = function() {
    const txtUser = document.getElementById('filtroLogUsuario').value.toLowerCase();
    const txtDetalhe = document.getElementById('filtroLogDetalhe').value.toLowerCase();

    const filtrados = todosLogs.filter(log => {
        const matchUser = (log.usuario || '').toLowerCase().includes(txtUser);
        const matchDetalhe = (log.detalhes || '').toLowerCase().includes(txtDetalhe) || (log.acao || '').toLowerCase().includes(txtDetalhe);
        return matchUser && matchDetalhe;
    });

    renderizarTabelaLogs(filtrados);
};