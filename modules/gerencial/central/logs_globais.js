let currentPageLogs = 1;
const ITEMS_PER_PAGE_LOGS = 30; // Controla quantos itens por sessão de página
let totalPagesLogs = 1;

window.renderizarLogsGlobais = async function() {
    currentPageLogs = 1;
    await preencherFiltroFiliaisLogs();
    await carregarLogsGlobais();
};

window.preencherFiltroFiliaisLogs = async function() {
    const select = document.getElementById('filtroFilialLogs');
    if (!select) return;
    
    // Mostra o filtro de filial exclusivamente se for um Administrador Global (Central)
    if (window.currentUser && window.currentUser.filial_id === null && ['SuperAdmin', 'Admin'].includes(window.currentUser.role)) {
        try {
            const filiais = await db.getTodasFiliaisAdmin();
            let html = '<option value="TODAS">🔎 Todas as Filiais</option>';
            html += '<option value="NULL">🏢 Sede Central (Ações Globais)</option>'; 
            
            filiais.forEach(f => {
                html += `<option value="${f.id}">${f.nome}</option>`;
            });
            
            select.innerHTML = html;
            select.style.display = 'inline-block';
        } catch (e) {
            console.error('Erro ao carregar filiais no filtro de logs', e);
        }
    } else {
        select.style.display = 'none'; 
    }
};

window.carregarLogsGlobais = async function() {
    const tbody = document.getElementById('tbodyLogsGlobais');
    const selectFiltro = document.getElementById('filtroFilialLogs');
    const btnPrev = document.getElementById('btnPrevLogs');
    const btnNext = document.getElementById('btnNextLogs');
    const lblPagina = document.getElementById('lblPaginaAtualLogs');
    const lblTotalPaginas = document.getElementById('lblTotalPaginasLogs');
    const lblTotalRegistros = document.getElementById('lblTotalRegistrosLogs');
    
    if (!tbody) return;
    
    // Efeito de carregamento para UX
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 25px; color: var(--ccol-blue-bright);"><i class="fas fa-circle-notch fa-spin fa-2x"></i><br><br>Buscando registros no banco de dados...</td></tr>';
    
    let filialId = selectFiltro ? selectFiltro.value : 'TODAS';
    if(filialId === 'NULL') filialId = null;

    try {
        const result = await db.getLogsPaginados(currentPageLogs, ITEMS_PER_PAGE_LOGS, filialId);
        const logs = result.data;
        const total = result.total;
        
        totalPagesLogs = Math.ceil(total / ITEMS_PER_PAGE_LOGS) || 1;
        
        lblPagina.innerText = currentPageLogs;
        lblTotalPaginas.innerText = totalPagesLogs;
        lblTotalRegistros.innerText = total;
        
        btnPrev.disabled = currentPageLogs <= 1;
        btnNext.disabled = currentPageLogs >= totalPagesLogs;
        
        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 20px;">Nenhum evento registrado nesta filial ou página.</td></tr>';
            return;
        }
        
        let html = '';
        logs.forEach(log => {
            const dataFormatada = new Date(log.data_hora).toLocaleString('pt-BR');
            const nomeFilial = log.filiais ? log.filiais.nome : (log.filial_id === null ? 'Sede Central' : 'Desconhecida');
            
            // Sistema Inteligente de Cores para ações (Excluiu=Vermelho, Editou=Amarelo, Criou=Verde)
            let corAcao = '#3b82f6'; // Azul padrão
            let acaoLower = log.acao.toLowerCase();
            
            if(acaoLower.includes('exclu') || acaoLower.includes('delet') || acaoLower.includes('remov')) corAcao = '#ef4444'; 
            else if(acaoLower.includes('edit') || acaoLower.includes('atualiz') || acaoLower.includes('alter')) corAcao = '#f59e0b';
            else if(acaoLower.includes('cri') || acaoLower.includes('adicion') || acaoLower.includes('inser')) corAcao = '#10b981'; 
            
            html += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.3s;">
                    <td style="white-space: nowrap; font-size: 0.85rem; color: var(--text-secondary);"><i class="far fa-clock" style="margin-right:5px;"></i>${dataFormatada}</td>
                    <td><strong style="color: #fff;"><i class="fas fa-user-circle" style="margin-right:5px; color: var(--ccol-blue-bright);"></i>${log.usuario}</strong></td>
                    <td><span style="background: rgba(255,255,255,0.1); padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; border: 1px solid rgba(255,255,255,0.15);"><i class="fas fa-building" style="margin-right:4px;"></i>${nomeFilial}</span></td>
                    <td><span style="color: ${corAcao}; font-weight: bold; font-size: 0.80rem; text-transform: uppercase; letter-spacing: 0.5px;">${log.acao}</span></td>
                    <td style="font-size: 0.85rem; color: #cbd5e1; max-width: 350px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${log.detalhes}">${log.detalhes}</td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        
    } catch (error) {
        console.error("Erro ao renderizar logs globais:", error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ef4444; padding: 20px;"><i class="fas fa-exclamation-triangle"></i> Erro ao estabelecer conexão com os logs.</td></tr>';
    }
};

window.mudarPaginaLogs = function(direcao) {
    const novaPagina = currentPageLogs + direcao;
    if (novaPagina >= 1 && novaPagina <= totalPagesLogs) {
        currentPageLogs = novaPagina;
        carregarLogsGlobais();
    }
};

window.mudarFiltroFilialLogs = function() {
    // Ao trocar a filial no select, reseta para a página 1 e busca novamente
    currentPageLogs = 1; 
    carregarLogsGlobais();
};