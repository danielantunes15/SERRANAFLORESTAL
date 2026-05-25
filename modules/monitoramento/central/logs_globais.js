let currentPageLogs = 1;
const ITEMS_PER_PAGE_LOGS = 30; 
let totalPagesLogs = 1;

window.renderizarLogsGlobais = async function() {
    currentPageLogs = 1;
    await preencherFiltroFiliaisLogs();
    // Ao abrir, já puxa os usuários baseados na filial padrão que estiver selecionada
    await preencherFiltroUsuariosLogs();
    await carregarLogsGlobais();
};

window.preencherFiltroFiliaisLogs = async function() {
    const select = document.getElementById('filtroFilialLogs');
    const container = document.getElementById('containerFiltroFilial');
    if (!select || !container) return;
    
    // Se for SuperAdmin, vê todas as filiais
    if (window.currentUser && window.currentUser.filial_id === null && ['SuperAdmin', 'Admin'].includes(window.currentUser.role)) {
        try {
            const filiais = await db.getTodasFiliaisAdmin();
            let html = '<option value="TODAS">🔎 Todas as Filiais</option>';
            html += '<option value="NULL">🏢 Sede Central (Globais)</option>'; 
            
            filiais.forEach(f => {
                html += `<option value="${f.id}">${f.nome}</option>`;
            });
            
            select.innerHTML = html;
            container.style.display = 'flex'; 
        } catch (e) {
            console.error('Erro ao carregar filiais', e);
        }
    } else {
        // Usuário comum não precisa ver o filtro de filiais
        container.style.display = 'none'; 
    }
};

window.aoMudarFilialLogs = async function() {
    // Quando muda a filial, recarrega a lista de usuários para aquela filial específica
    await preencherFiltroUsuariosLogs();
    mudarFiltroLogs();
};

window.preencherFiltroUsuariosLogs = async function() {
    const select = document.getElementById('filtroUsuarioLogs');
    const selectFilial = document.getElementById('filtroFilialLogs');
    if (!select) return;

    let filialId = selectFilial && selectFilial.parentElement.style.display !== 'none' ? selectFilial.value : 'TODAS';
    if (filialId === 'NULL') filialId = null;

    try {
        select.innerHTML = '<option value="TODOS">Buscando usuários...</option>';
        const usuarios = await db.getUsuarios(filialId);
        
        let html = '<option value="TODOS">👥 Todos os Usuários</option>';
        usuarios.forEach(u => {
            html += `<option value="${u.username}">${u.nome || u.username} (${u.username})</option>`;
        });
        
        select.innerHTML = html;
    } catch (e) {
        console.error("Erro ao carregar usuários para o filtro", e);
        select.innerHTML = '<option value="TODOS">Todos os Usuários</option>';
    }
};

window.limparFiltrosLogs = function() {
    document.getElementById('filtroModuloLogs').value = 'TODOS';
    document.getElementById('filtroUsuarioLogs').value = 'TODOS';
    document.getElementById('filtroDataInicioLogs').value = '';
    document.getElementById('filtroDataFimLogs').value = '';
    
    const selectFilial = document.getElementById('filtroFilialLogs');
    if (selectFilial && selectFilial.parentElement.style.display !== 'none') {
        selectFilial.value = 'TODAS';
        aoMudarFilialLogs(); // Recarrega os usuários e reseta
    } else {
        mudarFiltroLogs();
    }
};

window.mudarFiltroLogs = function() {
    currentPageLogs = 1; 
    carregarLogsGlobais();
};

window.carregarLogsGlobais = async function() {
    const tbody = document.getElementById('tbodyLogsGlobais');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 30px; color: var(--ccol-blue-bright);"><i class="fas fa-circle-notch fa-spin fa-3x" style="margin-bottom:15px;"></i><br>Aplicando inteligência de filtros e buscando registros...</td></tr>';
    
    // Captura dos Filtros
    const selectFiltroFilial = document.getElementById('filtroFilialLogs');
    let filialId = selectFiltroFilial && selectFiltroFilial.parentElement.style.display !== 'none' ? selectFiltroFilial.value : 'TODAS';
    if(filialId === 'NULL') filialId = null;

    const filtros = {
        filialId: filialId,
        modulo: document.getElementById('filtroModuloLogs').value,
        usuario: document.getElementById('filtroUsuarioLogs').value,
        dataInicio: document.getElementById('filtroDataInicioLogs').value,
        dataFim: document.getElementById('filtroDataFimLogs').value
    };

    try {
        const result = await db.getLogsPaginados(currentPageLogs, ITEMS_PER_PAGE_LOGS, filtros);
        const logs = result.data;
        const total = result.total;
        
        totalPagesLogs = Math.ceil(total / ITEMS_PER_PAGE_LOGS) || 1;
        
        document.getElementById('lblPaginaAtualLogs').innerText = currentPageLogs;
        document.getElementById('lblTotalPaginasLogs').innerText = totalPagesLogs;
        document.getElementById('lblTotalRegistrosLogs').innerText = total;
        
        document.getElementById('btnPrevLogs').disabled = currentPageLogs <= 1;
        document.getElementById('btnNextLogs').disabled = currentPageLogs >= totalPagesLogs;
        
        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 40px;"><i class="fas fa-search-minus fa-3x" style="opacity: 0.2; margin-bottom: 15px;"></i><br><span style="font-size: 1.1rem;">Nenhum evento registrado encontrado.</span><br>Tente alterar os filtros selecionados acima.</td></tr>';
            return;
        }
        
        let html = '';
        logs.forEach(log => {
            const dataFormatada = new Date(log.data_hora).toLocaleString('pt-BR');
            const nomeFilial = log.filiais ? log.filiais.nome : (log.filial_id === null ? 'Sede Central' : 'Desconhecida');
            
            let corAcao = '#3b82f6'; 
            let acaoLower = (log.acao || '').toLowerCase();
            
            if(acaoLower.includes('exclu') || acaoLower.includes('delet') || acaoLower.includes('remov')) corAcao = '#ef4444'; 
            else if(acaoLower.includes('edit') || acaoLower.includes('atualiz') || acaoLower.includes('alter')) corAcao = '#f59e0b';
            else if(acaoLower.includes('cri') || acaoLower.includes('adicion') || acaoLower.includes('inser')) corAcao = '#10b981'; 
            
            html += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.2s;">
                    <td style="white-space: nowrap; font-size: 0.85rem; color: var(--text-secondary);"><i class="far fa-clock" style="margin-right:5px; color: #64748b;"></i>${dataFormatada}</td>
                    <td><strong style="color: #f8fafc;"><i class="fas fa-user-circle" style="margin-right:5px; color: var(--ccol-blue-bright);"></i>${log.usuario}</strong></td>
                    <td><span style="background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; border: 1px solid rgba(255,255,255,0.1);"><i class="fas fa-building" style="margin-right:4px;"></i>${nomeFilial}</span></td>
                    <td><span style="color: ${corAcao}; font-weight: bold; font-size: 0.80rem; text-transform: uppercase; letter-spacing: 0.5px;">${log.acao}</span></td>
                    <td style="font-size: 0.85rem; color: #cbd5e1; max-width: 350px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${log.detalhes}">${log.detalhes}</td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        
    } catch (error) {
        console.error("Erro ao renderizar logs globais:", error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ef4444; padding: 30px;"><i class="fas fa-exclamation-triangle fa-2x" style="margin-bottom:10px;"></i><br>Erro de conexão com a base de Logs. Recarregue a página e tente novamente.</td></tr>';
    }
};

window.mudarPaginaLogs = function(direcao) {
    const novaPagina = currentPageLogs + direcao;
    if (novaPagina >= 1 && novaPagina <= totalPagesLogs) {
        currentPageLogs = novaPagina;
        carregarLogsGlobais();
    }
};