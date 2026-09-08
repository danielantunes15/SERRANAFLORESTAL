window.listaColaboradoresSSMA = [];
window.colaboradoresFiltradosSSMA = [];

// Variáveis de Paginação
window.paginaAtualSSMA = 1;
window.itensPorPaginaSSMA = 15;

window.initColaboradoresSSMA = async function() {
    const elNome = document.getElementById('filtroNomeSSMA');
    const elCpf = document.getElementById('filtroCpfSSMA');
    if(elNome) elNome.value = '';
    if(elCpf) elCpf.value = '';
    
    window.paginaAtualSSMA = 1;
    await window.carregarListaSSMA();
};

window.toggleActionMenuSSMA = function(id) {
    document.querySelectorAll('.action-dropdown-menu').forEach(m => {
        if (m.id !== `action-menu-ssma-${id}`) m.style.display = 'none';
    });
    const menu = document.getElementById(`action-menu-ssma-${id}`);
    if (menu) menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
};

// Fecha o dropdown se clicar fora
document.addEventListener('click', function(e) {
    if(!e.target.closest('.action-menu-container')) {
        document.querySelectorAll('.action-dropdown-menu').forEach(m => m.style.display = 'none');
    }
});

window.carregarListaSSMA = async function() {
    try {
        const tbody = document.getElementById('tbListaColaboradoresSSMA');
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Carregando banco de dados...</td></tr>`;
        
        // Puxa a lista unificada do banco
        window.listaColaboradoresSSMA = await window.db.getColaboradores();
        window.filtrarColaboradoresSSMA(); 
    } catch (e) {
        console.error(e);
        alert("Erro ao carregar lista de colaboradores.");
    }
};

window.filtrarColaboradoresSSMA = function() {
    const elNome = document.getElementById('filtroNomeSSMA');
    const elCpf = document.getElementById('filtroCpfSSMA');
    
    if (!elNome || !elCpf) return;

    const termoNome = elNome.value.toLowerCase().trim();
    const termoCpf = elCpf.value.replace(/\D/g, ''); 
    
    window.colaboradoresFiltradosSSMA = window.listaColaboradoresSSMA.filter(c => {
        const nomeMatch = !termoNome || (c.nome && c.nome.toLowerCase().includes(termoNome)) || (c.funcao && c.funcao.toLowerCase().includes(termoNome));
        const cpfLimpo = c.cpf ? c.cpf.replace(/\D/g, '') : '';
        const cpfMatch = !termoCpf || cpfLimpo.includes(termoCpf);
        
        return nomeMatch && cpfMatch;
    });
    
    window.paginaAtualSSMA = 1;
    window.renderizarTabelaPaginadaSSMA();
};

window.mudarPaginaSSMA = function(direcao) {
    const totalPaginas = Math.ceil(window.colaboradoresFiltradosSSMA.length / window.itensPorPaginaSSMA);
    window.paginaAtualSSMA += direcao;
    
    if (window.paginaAtualSSMA < 1) window.paginaAtualSSMA = 1;
    if (window.paginaAtualSSMA > totalPaginas) window.paginaAtualSSMA = totalPaginas;
    
    window.renderizarTabelaPaginadaSSMA();
};

window.renderizarTabelaPaginadaSSMA = function() {
    const tbody = document.getElementById('tbListaColaboradoresSSMA');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const totalItens = window.colaboradoresFiltradosSSMA.length;
    
    if (totalItens === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#9ca3af; padding: 20px;">Nenhum colaborador encontrado com os filtros aplicados.</td></tr>`;
        document.getElementById('infoPaginacaoSSMA').innerText = 'Mostrando 0 a 0 de 0';
        document.getElementById('displayPageSSMA').innerText = '1';
        document.getElementById('btnPagePrevSSMA').disabled = true;
        document.getElementById('btnPageNextSSMA').disabled = true;
        return;
    }
    
    const totalPaginas = Math.ceil(totalItens / window.itensPorPaginaSSMA);
    if (window.paginaAtualSSMA > totalPaginas) window.paginaAtualSSMA = totalPaginas;
    
    const startIndex = (window.paginaAtualSSMA - 1) * window.itensPorPaginaSSMA;
    const endIndex = Math.min(startIndex + window.itensPorPaginaSSMA, totalItens);
    
    const itensPagina = window.colaboradoresFiltradosSSMA.slice(startIndex, endIndex);

    itensPagina.forEach(c => {
        let corStatus = 'var(--ccol-green-bright)';
        if(c.status === 'Inativo' || c.status === 'Desligado') corStatus = '#ef4444';
        else if(c.status === 'Férias' || c.status === 'Afastado') corStatus = '#f59e0b';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="cpf-cell">${c.cpf || 'Sem CPF'}</td>
            <td style="text-align: left; font-weight: bold; font-size: 1rem;">${c.nome}</td>
            <td style="text-align: left; color: var(--text-secondary); font-size: 0.9rem;">${c.funcao || 'Não informada'}</td>
            <td style="text-align: center;"><span style="color: ${corStatus}; font-weight: bold; font-size: 0.9rem;">${c.status || 'Ativo'}</span></td>
            <td style="text-align: right;">
                <div class="action-menu-container" style="position: relative; display: inline-block; text-align: left;">
                    <button class="btn-primary-blue" style="padding: 8px 12px; font-size: 0.85rem;" onclick="window.toggleActionMenuSSMA('${c.id}')">
                        AÇÕES SSMA <i class="fas fa-chevron-down" style="font-size: 0.7rem; margin-left: 5px;"></i>
                    </button>
                    <div id="action-menu-ssma-${c.id}" class="action-dropdown-menu">
                        <button onclick="window.imprimirOS_SSMA('${c.id}')">
                            <i class="fas fa-clipboard-list" style="color: var(--ccol-blue-bright); width: 15px;"></i> Imprimir Ordem de Serviço
                        </button>
                        <button onclick="window.imprimirEPI_SSMA('${c.id}')">
                            <i class="fas fa-hard-hat" style="color: #10b981; width: 15px;"></i> Imprimir Ficha de EPIs
                        </button>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    document.getElementById('infoPaginacaoSSMA').innerText = `Mostrando ${startIndex + 1} a ${endIndex} de ${totalItens}`;
    document.getElementById('displayPageSSMA').innerText = window.paginaAtualSSMA;
    document.getElementById('btnPagePrevSSMA').disabled = window.paginaAtualSSMA === 1;
    document.getElementById('btnPageNextSSMA').disabled = window.paginaAtualSSMA === totalPaginas;
};