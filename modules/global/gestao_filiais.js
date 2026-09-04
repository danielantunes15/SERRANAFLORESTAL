// ==================== js/gestao_filiais.js ====================

let listaFiliais = [];

window.renderizarGestaoFiliais = async function() {
    await carregarFiliais();
};

async function carregarFiliais() {
    const tbody = document.getElementById('tabelaFiliaisBody');
    if (!tbody || !window.supabaseClient) return;

    try {
        const { data, error } = await window.supabaseClient.from('filiais').select('*').order('id', { ascending: true });
        if (error) throw error;
        
        listaFiliais = data || [];
        
        document.getElementById('kpiTotalFiliais').innerText = listaFiliais.length;
        document.getElementById('kpiFiliaisAtivas').innerText = listaFiliais.filter(f => f.status === 'Ativa').length;

        if (listaFiliais.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #94a3b8;">Nenhuma filial cadastrada.</td></tr>';
            return;
        }

        tbody.innerHTML = listaFiliais.map(f => {
            let statusBadge = f.status === 'Ativa' 
                ? '<span style="background: rgba(16, 185, 129, 0.2); color: #34d399; padding: 4px 8px; border-radius: 10px; font-size: 0.8rem; font-weight: bold;">Ativa</span>'
                : '<span style="background: rgba(239, 68, 68, 0.2); color: #f87171; padding: 4px 8px; border-radius: 10px; font-size: 0.8rem; font-weight: bold;">Inativa</span>';

            return `
                <tr>
                    <td style="color: #94a3b8; font-weight: bold;">#${f.id}</td>
                    <td><strong style="color: #f8fafc; font-size: 1.05rem;">${f.nome}</strong></td>
                    <td style="color: #cbd5e1;">${f.cnpj || '-'}</td>
                    <td style="color: #cbd5e1;">${f.cidade || '-'}</td>
                    <td>${statusBadge}</td>
                    <td style="text-align: right;">
                        <button class="btn-action-sm btn-edit" title="Editar Filial" onclick='editarFilial(${JSON.stringify(f)})'><i class="fas fa-pen"></i></button>
                        <button class="btn-action-sm btn-delete" title="Excluir Filial" onclick="excluirFilial(${f.id})"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error("Erro ao carregar filiais", e);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #ef4444;">Erro ao carregar dados.</td></tr>';
    }
}

window.abrirModalFilial = function() {
    document.getElementById('formFilial').reset();
    document.getElementById('filialId').value = '';
    document.getElementById('modalFilialTitulo').innerText = 'Cadastrar Nova Filial';
    document.getElementById('modalFilial').style.display = 'flex';
};

window.editarFilial = function(filial) {
    document.getElementById('filialId').value = filial.id;
    document.getElementById('filialNome').value = filial.nome;
    document.getElementById('filialCnpj').value = filial.cnpj || '';
    document.getElementById('filialCidade').value = filial.cidade || '';
    document.getElementById('filialStatus').value = filial.status || 'Ativa';
    
    document.getElementById('modalFilialTitulo').innerText = `Editar Filial #${filial.id}`;
    document.getElementById('modalFilial').style.display = 'flex';
};

window.salvarFilial = async function(e) {
    e.preventDefault();
    
    const id = document.getElementById('filialId').value;
    const filialData = {
        nome: document.getElementById('filialNome').value.trim(),
        cnpj: document.getElementById('filialCnpj').value.trim(),
        cidade: document.getElementById('filialCidade').value.trim(),
        status: document.getElementById('filialStatus').value
    };

    try {
        if (id) {
            await window.supabaseClient.from('filiais').update(filialData).eq('id', id);
            registrarLogAuditoria('Global', 'Edição de Filial', `Filial atualizada: ${filialData.nome}`);
        } else {
            await window.supabaseClient.from('filiais').insert([filialData]);
            registrarLogAuditoria('Global', 'Criação de Filial', `Nova filial cadastrada: ${filialData.nome}`);
        }
        
        document.getElementById('modalFilial').style.display = 'none';
        await carregarFiliais();
        
        Swal.fire({
            title: 'Sucesso!',
            text: 'Filial salva com sucesso!',
            icon: 'success',
            background: '#1e293b',
            color: '#fff',
            confirmButtonColor: '#3b82f6'
        });
    } catch (err) {
        console.error(err);
        Swal.fire({
            title: 'Erro!',
            text: 'Erro ao salvar os dados da filial.',
            icon: 'error',
            background: '#1e293b',
            color: '#fff',
            confirmButtonColor: '#3b82f6'
        });
    }
};

window.excluirFilial = async function(id) {
    const filial = listaFiliais.find(f => f.id === id);
    if (!filial) return;

    Swal.fire({
        title: 'Você tem certeza?',
        text: `Deseja realmente excluir a filial "${filial.nome}"? Esta ação não poderá ser desfeita!`,
        icon: 'warning',
        showCancelButton: true,
        background: '#1e293b',
        color: '#fff',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sim, excluir!',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const { error } = await window.supabaseClient.from('filiais').delete().eq('id', id);
                
                if (error) throw error;
                
                registrarLogAuditoria('Global', 'Exclusão de Filial', `Filial excluída: ${filial.nome}`);
                
                Swal.fire({
                    title: 'Excluída!',
                    text: 'A filial foi removida com sucesso.',
                    icon: 'success',
                    background: '#1e293b',
                    color: '#fff',
                    confirmButtonColor: '#3b82f6'
                });
                
                await carregarFiliais();
                
            } catch (err) {
                console.error("Erro ao excluir filial", err);
                
                let mensagemErro = 'Ocorreu um erro ao tentar excluir a filial.';
                
                // Tratamento específico para o erro 409 (Foreign Key Constraint)
                if (err.code === '23503' || err.message?.includes('Foreign key violation')) {
                    mensagemErro = 'Não é possível excluir esta filial porque existem registros (usuários, cadastros, etc.) vinculados a ela no banco de dados.';
                }
                
                Swal.fire({
                    title: 'Operação Bloqueada',
                    text: mensagemErro,
                    icon: 'error',
                    background: '#1e293b',
                    color: '#fff',
                    confirmButtonColor: '#3b82f6'
                });
            }
        }
    });
};

// Adaptação da auditoria para salvar na sua tabela 'logs_exclusao' existente
window.registrarLogAuditoria = async function(modulo, acao, detalhes) {
    if (!window.supabaseClient) return;
    const usuarioLogado = window.currentUser ? window.currentUser.username : 'Sistema';
    
    // Mesclando o Módulo na Ação
    const logData = { 
        usuario: usuarioLogado, 
        acao: `[${modulo}] ${acao}`, 
        detalhes: detalhes,
        data_hora: new Date().toISOString()
    };
    
    if (typeof window.injetarFilial === 'function') {
        const d = window.injetarFilial({});
        if(d.filial_id) logData.filial_id = d.filial_id;
    }
    
    try { await window.supabaseClient.from('logs_exclusao').insert([logData]); } catch (e) {}
};