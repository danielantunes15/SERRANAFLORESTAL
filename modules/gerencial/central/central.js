window.renderizarCentral = async function() {
    const tbody = document.getElementById('tabelaFiliaisAdmin');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Sincronizando com o banco...</td></tr>';
    
    try {
        const filiais = await db.getTodasFiliaisAdmin();
        
        if (filiais.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 20px;">Nenhuma filial cadastrada no sistema.</td></tr>';
            return;
        }
        
        tbody.innerHTML = filiais.map(f => `
            <tr>
                <td style="font-weight: 600; color: #fff;">${f.nome}</td>
                <td style="color: var(--text-muted);">${f.cnpj || 'Não informado'}</td>
                <td style="color: var(--text-muted);">${f.cidade || 'Não informada'}</td>
                <td>
                    <span style="background: ${f.status === 'Ativa' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; 
                                 color: ${f.status === 'Ativa' ? '#10b981' : '#ef4444'}; 
                                 padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; border: 1px solid ${f.status === 'Ativa' ? '#10b981' : '#ef4444'};">
                        ${f.status}
                    </span>
                </td>
                <td>
                    <button onclick="mudarStatusFilial(${f.id}, '${f.status === 'Ativa' ? 'Inativa' : 'Ativa'}')" class="btn-secondary-dark" style="font-size: 0.8rem; padding: 6px 12px; border-radius: 4px;">
                        <i class="fas fa-power-off" style="color: ${f.status === 'Ativa' ? '#ef4444' : '#10b981'};"></i> ${f.status === 'Ativa' ? 'Desativar' : 'Reativar'}
                    </button>
                </td>
            </tr>
        `).join('');
    } catch(e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#ef4444;">Erro ao carregar dados do banco de dados.</td></tr>';
    }
};

window.abrirModalNovaFilial = function() {
    document.getElementById('modalNovaFilial').style.display = 'flex';
};

window.fecharModalNovaFilial = function() {
    document.getElementById('modalNovaFilial').style.display = 'none';
    document.getElementById('novaFilialNome').value = '';
    document.getElementById('novaFilialCnpj').value = '';
    document.getElementById('novaFilialCidade').value = '';
    document.getElementById('novaFilialStatus').value = 'Ativa';
};

window.salvarNovaFilial = async function() {
    const nome = document.getElementById('novaFilialNome').value.trim();
    const cnpj = document.getElementById('novaFilialCnpj').value.trim();
    const cidade = document.getElementById('novaFilialCidade').value.trim();
    const status = document.getElementById('novaFilialStatus').value;

    if (!nome) { 
        alert('O nome da filial é obrigatório.'); 
        return; 
    }

    try {
        await db.addFilial({ nome, cnpj, cidade, status });
        alert('✅ Nova filial implantada com sucesso no sistema!');
        fecharModalNovaFilial();
        renderizarCentral(); // Recarrega a tabela na hora
    } catch(e) {
        console.error(e);
        alert('⚠️ Erro ao salvar a filial no banco de dados.');
    }
};

window.mudarStatusFilial = async function(id, novoStatus) {
    if(confirm(`⚠️ Atenção: Deseja realmente mudar o status desta filial para ${novoStatus.toUpperCase()}?`)) {
        try {
            await db.updateFilialStatus(id, novoStatus);
            renderizarCentral();
        } catch(e) {
            console.error(e);
            alert('Erro ao alterar o status da operação.');
        }
    }
};