// ==================== js/auditoria_logs.js ====================

window.renderizarAuditoriaLogs = async function() {
    await carregarFiltroFiliais();
    
    // Configura os inputs de data para o dia atual por padrão
    const hoje = new Date();
    const dataFormatada = hoje.toISOString().split('T')[0];
    document.getElementById('filtroLogDataInicio').value = dataFormatada;
    document.getElementById('filtroLogDataFim').value = dataFormatada;

    // Busca automaticamente ao abrir a tela
    await buscarLogsAvancados();
};

async function carregarFiltroFiliais() {
    const selectFilial = document.getElementById('filtroLogFilial');
    if (!selectFilial || !window.supabaseClient) return;

    // Se o usuário não for administrador global, ele não pode filtrar outras filiais
    if (window.currentUser && window.currentUser.role !== 'SuperAdmin' && window.currentUser.role !== 'Admin') {
        selectFilial.parentElement.style.display = 'none';
        return;
    }

    try {
        const { data } = await window.supabaseClient.from('filiais').select('id, nome').order('nome');
        if (data && data.length > 0) {
            selectFilial.innerHTML = '<option value="">Todas as Filiais (Global)</option>' + 
                data.map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
        }
    } catch (e) {
        console.error("Erro ao carregar lista de filiais para os filtros", e);
    }
}

window.buscarLogsAvancados = async function() {
    const tbody = document.getElementById('tabelaLogsBody');
    const btn = document.getElementById('btnBuscarLogs');
    
    if (!tbody || !window.supabaseClient) return;

    // UX de carregamento
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #a855f7;"><i class="fas fa-spinner fa-spin"></i> Pesquisando no banco de dados...</td></tr>';

    try {
        // Faz JOIN com a tabela filiais para puxar o nome (referenciado pela foreign key)
        let query = window.supabaseClient.from('logs_exclusao').select('*, filiais(nome)').order('data_hora', { ascending: false }).limit(1000);
        
        // 1. FILTRO DE FILIAL
        const filialFiltro = document.getElementById('filtroLogFilial').value;
        if (window.currentUser && window.currentUser.role !== 'SuperAdmin' && window.currentUser.role !== 'Admin') {
            // Trava rígida de segurança: o usuário comum só busca logs da sua própria filial
            if (typeof window.aplicarFiltroFilial === 'function') {
                query = window.aplicarFiltroFilial(query);
            }
        } else if (filialFiltro) {
            // Se o admin selecionou uma filial específica no dropdown
            query = query.eq('filial_id', filialFiltro);
        }

        // 2. FILTRO DE DATAS E HORÁRIOS (Considera o dia todo de 00:00 às 23:59)
        const dataInicio = document.getElementById('filtroLogDataInicio').value;
        const dataFim = document.getElementById('filtroLogDataFim').value;
        if (dataInicio) query = query.gte('data_hora', `${dataInicio}T00:00:00`);
        if (dataFim) query = query.lte('data_hora', `${dataFim}T23:59:59`);

        // 3. FILTRO DE USUÁRIO
        const userFiltro = document.getElementById('filtroLogUsuario').value.trim();
        if (userFiltro) query = query.ilike('usuario', `%${userFiltro}%`);

        // 4. FILTRO DE TERMO (Busca na Ação E nos Detalhes Técnicos)
        const termoFiltro = document.getElementById('filtroLogDetalhe').value.trim();
        if (termoFiltro) query = query.or(`acao.ilike.%${termoFiltro}%,detalhes.ilike.%${termoFiltro}%`);

        // Dispara a consulta no Supabase
        const { data, error } = await query;
        if (error) throw error;

        renderizarTabelaLogs(data || []);

    } catch (e) {
        console.error("Erro na busca avançada de logs:", e);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ef4444;">Erro ao consultar registros. Tente novamente.</td></tr>';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-search"></i> Buscar Registros';
    }
};

function renderizarTabelaLogs(lista) {
    const tbody = document.getElementById('tabelaLogsBody');
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhum registro encontrado para os filtros informados.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(log => {
        const dataStr = log.data_hora ? new Date(log.data_hora).toLocaleString('pt-BR') : '-';
        
        // Formatação inteligente de cores para os alertas de auditoria
        let corAcao = '#e2e8f0';
        const acaoUpper = (log.acao || '').toUpperCase();
        
        if (acaoUpper.includes('EXCLUSÃO') || acaoUpper.includes('DELETAR') || acaoUpper.includes('RECUSADO') || acaoUpper.includes('REMOVIDO')) corAcao = '#f87171';
        if (acaoUpper.includes('CRIAÇÃO') || acaoUpper.includes('NOVO') || acaoUpper.includes('APROVADO') || acaoUpper.includes('ENTRADA')) corAcao = '#34d399';
        if (acaoUpper.includes('EDIÇÃO') || acaoUpper.includes('ATUALIZAR') || acaoUpper.includes('SAÍDA') || acaoUpper.includes('TRANSFER')) corAcao = '#60a5fa';

        // Mapeia o nome da Filial ou Matriz (Caso o log não tenha filial, assume Corporativo)
        const filialNome = log.filiais && log.filiais.nome ? log.filiais.nome : (log.filial_id ? `Filial #${log.filial_id}` : 'Global / Corporativo');
        const corFilial = log.filial_id ? '#cbd5e1' : '#fde047';

        return `
            <tr>
                <td style="color: #94a3b8; font-family: monospace;">${dataStr}</td>
                <td><span style="background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; color: ${corFilial}; font-weight: 600;"><i class="fas fa-building"></i> ${filialNome}</span></td>
                <td><strong style="color: #38bdf8;"><i class="fas fa-user-circle"></i> ${log.usuario || 'Sistema'}</strong></td>
                <td><strong style="color: ${corAcao};">${log.acao || '-'}</strong></td>
                <td style="color: #cbd5e1; line-height: 1.4;">${log.detalhes || '-'}</td>
            </tr>
        `;
    }).join('');
}