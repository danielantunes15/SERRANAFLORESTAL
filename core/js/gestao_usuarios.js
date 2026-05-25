// ==================== MÓDULO: GESTÃO DE USUÁRIOS E FILIAIS ====================

let listaUsuarios = [];
let listaFiliaisAtivas = [];

// Função auxiliar para injetar dinamicamente um seletor de filiais para o Admin na hora de criar usuário
async function injetarSelectFilialSeAdmin() {
    if (!window.currentUser || (window.currentUser.role !== 'SuperAdmin' && window.currentUser.role !== 'Admin' && window.currentUser.role !== 'Gerente')) return;
    
    const inputRole = document.getElementById('novoUserRole');
    if (inputRole && inputRole.parentNode && !document.getElementById('novoUserFilial')) {
        const select = document.createElement('select');
        select.id = 'novoUserFilial';
        select.className = 'dark-select';
        select.style.marginLeft = '10px';
        select.style.padding = '8px';
        select.style.borderRadius = '4px';
        
        const filiais = await db.getTodasFiliaisAdmin();
        let options = '<option value="" disabled selected>-- Selecione a Filial do Usuário --</option>';
        options += '<option value="CENTRAL">ADMINISTRAÇÃO (Acesso Global)</option>';
        filiais.forEach(f => {
            options += `<option value="${f.id}">${f.nome}</option>`;
        });
        
        select.innerHTML = options;
        inputRole.parentNode.insertBefore(select, inputRole.nextSibling);
    }
}

window.renderizarUsuarios = async function() {
    const tbody = document.getElementById('tabelaUsuarios');
    if (!tbody) return;

    await injetarSelectFilialSeAdmin();

    try {
        listaUsuarios = await db.getUsuarios('TODAS'); // Banco já filtra automaticamente se for usuário comum
        
        if (listaUsuarios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Nenhum usuário encontrado.</td></tr>'; return;
        }

        tbody.innerHTML = listaUsuarios.map(u => {
            const isCurrent = u.id === window.currentUser.id;
            const statusBadge = u.primeiro_acesso 
                ? `<span style="background: rgba(251, 146, 60, 0.1); color: var(--ccol-rust-bright); padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; border: 1px solid var(--ccol-rust-bright);">Pendente</span>`
                : `<span style="background: rgba(61, 220, 132, 0.1); color: var(--ccol-green-bright); padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; border: 1px solid var(--ccol-green-bright);">Ativo</span>`;
            
            // Exibe a qual filial o usuário pertence (importante para o Admin)
            const filialNome = u.filial_id === null ? '<span style="color:#fde047; font-weight:bold;">Admin. Central</span>' : (u.filiais ? u.filiais.nome : 'Sem Filial');
                
            return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="font-weight: bold; color: var(--ccol-blue-bright); padding: 12px;">${u.username} ${isCurrent ? '(Você)' : ''}</td>
                <td><span class="badge-role" style="font-size: 0.75rem;">${u.role}</span></td>
                <td style="font-size: 0.8rem; color: #cbd5e1;">${filialNome}</td>
                <td>${statusBadge}</td>
                <td>
                    <button onclick="resetarSenhaUsuario(${u.id})" ${isCurrent ? 'disabled' : ''} style="background: rgba(255,255,255,0.05); border: 1px solid #fde047; color: #fde047; padding: 5px 10px; border-radius: 4px; cursor: ${isCurrent ? 'not-allowed' : 'pointer'}; font-size: 0.75rem;">🔄 Resetar</button>
                    <button onclick="excluirUsuario(${u.id})" ${isCurrent ? 'disabled' : ''} style="background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; color: #ef4444; padding: 5px 10px; border-radius: 4px; cursor: ${isCurrent ? 'not-allowed' : 'pointer'}; font-size: 0.75rem; margin-left: 5px;">🗑️</button>
                </td>
            </tr>
        `}).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="color: #ef4444;">Erro ao carregar dados dos usuários.</td></tr>';
    }
}

window.adicionarUsuario = async function() {
    const nome = document.getElementById('novoUsername').value.trim().toUpperCase();
    const role = document.getElementById('novoUserRole').value;
    if (!nome) return;

    // TRAVA DE SEGURANÇA: Somente SuperAdmin pode criar cargo Gerente
    if (role === 'Gerente' && (!window.currentUser || window.currentUser.role !== 'SuperAdmin')) {
        alert('⚠️ Acesso Negado: Somente o SuperAdmin pode criar usuários com o nível de "Gerente".');
        return;
    }

    let filialSelecionada = undefined;
    const selectFilial = document.getElementById('novoUserFilial');
    
    // Se o select de filial existir (ou seja, quem está criando é Admin/SuperAdmin)
    if (selectFilial) {
        if (selectFilial.value === '') {
            alert('⚠️ Por favor, selecione a qual filial este usuário pertencerá.');
            return;
        }
        filialSelecionada = selectFilial.value === 'CENTRAL' ? null : parseInt(selectFilial.value);
    }

    if (listaUsuarios.some(u => u.username === nome)) { alert('⚠️ Este usuário já existe!'); return; }

    try {
        const novoUsuarioObj = { 
            username: nome, 
            senha_hash: "5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5", // Hash padrão para 12345
            role: role, 
            primeiro_acesso: true 
        };

        // Força a filial correta se foi selecionada pelo Admin, senão o DB injeta a do usuário logado
        if (filialSelecionada !== undefined) {
            novoUsuarioObj.filial_id = filialSelecionada;
        }

        await db.addUsuario(novoUsuarioObj);
        document.getElementById('novoUsername').value = '';
        if(selectFilial) selectFilial.value = '';
        
        alert(`✅ Usuário ${nome} criado com sucesso!\nSenha provisória: 12345`);
        window.renderizarUsuarios();
    } catch(e) { alert('Erro ao criar usuário.'); }
}

window.resetarSenhaUsuario = async function(id) {
    if(confirm(`Deseja resetar a senha deste usuário para "12345"?`)) {
        await db.updateUsuarioSenhaEReset(id, "5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5");
        alert(`Senha resetada com sucesso.`); 
        window.renderizarUsuarios();
    }
}

window.excluirUsuario = async function(id) {
    if(confirm(`🚨 ATENÇÃO: Deseja EXCLUIR permanentemente o acesso deste usuário?`)) {
        await db.deleteUsuario(id);
        alert('Usuário excluído.'); 
        window.renderizarUsuarios();
    }
}

window.renderizarLogs = async function() {
    const tbody = document.getElementById('listaLogs');
    if (!tbody) return;
    try {
        const logs = await db.getLogs();
        if (logs.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Nenhum registro encontrado.</td></tr>'; return; }
        tbody.innerHTML = logs.map(l => `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="color: var(--text-secondary); font-size: 0.8rem;">${new Date(l.data_hora).toLocaleString('pt-BR')}</td>
                <td style="color: var(--ccol-blue-bright); font-weight: bold;">${l.usuario}</td>
                <td><span style="background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 3px 6px; border-radius: 4px; font-size: 0.75rem; border: 1px solid #ef4444;">${l.acao}</span></td>
                <td style="text-align: left; font-size: 0.85rem;">${l.detalhes}</td>
            </tr>
        `).join('');
    } catch(e) { tbody.innerHTML = '<tr><td colspan="4" style="color: #ef4444;">Erro ao carregar logs.</td></tr>'; }
}