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
        alert("Filial salva com sucesso!");
    } catch (err) {
        console.error(err);
        alert("Erro ao salvar filial.");
    }
};

// Adaptação da auditoria para salvar na sua tabela 'logs_exclusao' existente
window.registrarLogAuditoria = async function(modulo, acao, detalhes) {
    if (!window.supabaseClient) return;
    const usuarioLogado = window.currentUser ? window.currentUser.username : 'Sistema';
    
    // Mesclando o Módulo na Ação, já que sua tabela não tem o campo "modulo" separado
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