// ==================== MÓDULO: AUTENTICAÇÃO E USUÁRIOS ====================

window.currentUser = null;
let listaUsuarios = [];
window.permissoesGlobais = null; 

window.fazerLogout = function() {
    if(confirm('Deseja realmente sair do sistema?')) {
        localStorage.removeItem('ccol_user_session');
        window.currentUser = null;
        window.location.href = 'login.html'; 
    }
}

// NOVO: Função para o SuperAdmin navegar entre filiais em tempo real
window.trocarFilialSuperAdmin = async function(novoFilialIdRaw) {
    const filial_id = novoFilialIdRaw === 'CENTRAL' ? null : parseInt(novoFilialIdRaw);
    let nomeFilial = "ADMINISTRADOR";

    if (filial_id !== null) {
        const filiais = await db.getFiliais();
        const f = filiais.find(x => x.id == filial_id);
        if (f) nomeFilial = f.nome;
    }

    // Atualiza a sessão silenciosamente
    window.currentUser.filial_id = filial_id;
    window.currentUser.filiais = { nome: nomeFilial };
    localStorage.setItem('ccol_user_session', JSON.stringify(window.currentUser));

    // Recarrega a página para puxar dados EXCLUSIVOS da filial selecionada
    window.location.reload();
}

async function iniciarSistemaAutorizado() {
    document.getElementById('appLayout').style.display = 'flex';
    
    const filialNome = window.currentUser.filiais ? window.currentUser.filiais.nome : 'Matriz';

    document.getElementById('loggedUserName').innerHTML = `<i class="fas fa-user-circle"></i> ${window.currentUser.username} <span style="font-size:0.7rem; color:#94a3b8;">(${window.currentUser.role})</span>`;
    
    const roleSpan = document.getElementById('loggedUserRole');

    // ============= MAGIA DO SUPER ADMIN (CONTEXT SWITCHER) =============
    if (window.currentUser.role === 'SuperAdmin') {
        db.getFiliais().then(filiais => {
            let options = `<option value="CENTRAL" ${window.currentUser.filial_id === null ? 'selected' : ''}>ADMINISTRADOR</option>`;
            filiais.forEach(f => {
                options += `<option value="${f.id}" ${window.currentUser.filial_id == f.id ? 'selected' : ''}>Navegar p/ ${f.nome}</option>`;
            });

            roleSpan.innerHTML = `
                <select class="dark-select" style="font-size: 0.75rem; padding: 4px 6px; height: auto; background: #0f172a; border: 1px solid rgba(59, 130, 246, 0.5); border-radius: 4px; color: #38bdf8; font-weight: bold; margin-top: 4px; cursor: pointer; outline: none; width: 100%; max-width: 250px;" onchange="trocarFilialSuperAdmin(this.value)">
                    ${options}
                </select>
            `;
        });
    } else {
        // Usuário normal vê apenas seu vínculo fixo
        roleSpan.innerHTML = `<i class="fas fa-building"></i> ${filialNome}`;
    }
    // ================================================================

    const statsHeader = document.querySelector('.quick-stats-header');
    if (statsHeader) {
        if (window.currentUser.filial_id === null || window.currentUser.filial_id === 'CENTRAL') {
            statsHeader.style.display = 'none'; 
        } else {
            statsHeader.style.display = 'flex'; 
        }
    }

    const permissoesDoBanco = await db.getPermissoesDB();
    window.permissoesGlobais = { ...permissoesPadrao, ...permissoesDoBanco };

    if (typeof initDashboard === 'function') { await initDashboard(); }
    if (typeof window.iniciarSistema === 'function') { window.iniciarSistema(); }
}

document.addEventListener('DOMContentLoaded', () => {
    const sessaoSalva = localStorage.getItem('ccol_user_session');
    if (sessaoSalva) {
        window.currentUser = JSON.parse(sessaoSalva);
        iniciarSistemaAutorizado(); 
    } else {
        window.location.href = 'login.html';
    }
});

const permissoesPadrao = {
    "Admin": ["escala", "alocacao", "motoristas", "caminhoes", "os", "troca", "jornada", "treinamento", "indicadores", "indicadores_serrana", "servicos", "cadastro_frota", "almoxarifado"],
    "Controlador de Trefego": ["escala", "alocacao", "troca", "jornada"],
    "SSMA": ["motoristas", "treinamento", "jornada"],
    "Controle de Manutencao": ["caminhoes", "os", "cadastro_frota", "almoxarifado"],
    "Almoxarifado": ["os", "almoxarifado"],
    "Mecanico": ["servicos"]
};

window.getPermissoes = function() { return window.permissoesGlobais || permissoesPadrao; };

window.carregarCheckboxesPermissoes = function() {
    const perfil = document.getElementById('selectPerfilPermissao')?.value;
    if(!perfil) return;
    const permitidos = (window.getPermissoes())[perfil] || [];
    document.querySelectorAll('.chk-permissao').forEach(chk => { chk.checked = permitidos.includes(chk.value); });
};

window.salvarPermissoesPerfil = async function() {
    const perfil = document.getElementById('selectPerfilPermissao').value;
    const checkboxesMarcados = document.querySelectorAll('.chk-permissao:checked');
    const novasPermissoes = Array.from(checkboxesMarcados).map(chk => chk.value);
    
    await db.updatePermissoesDB(perfil, novasPermissoes);
    
    if(!window.permissoesGlobais) window.permissoesGlobais = { ...permissoesPadrao };
    window.permissoesGlobais[perfil] = novasPermissoes;
    
    alert(`✅ Permissões para o perfil "${perfil}" salvas com sucesso!`);
    if (typeof window.renderizarMenu === 'function') window.renderizarMenu();
};

window.alternarAbaConfig = function(aba) {
    const tabUsuarios = document.getElementById('config-tab-usuarios');
    const tabLogs = document.getElementById('config-tab-logs');
    const btnUsuarios = document.getElementById('btnTabUsuarios');
    const btnLogs = document.getElementById('btnTabLogs');
    
    if(!tabUsuarios || !tabLogs) return;

    if (aba === 'usuarios') {
        tabUsuarios.style.display = 'block'; tabLogs.style.display = 'none';
        btnUsuarios.className = 'btn-primary-blue'; btnLogs.className = 'btn-secondary-dark';
    } else {
        tabUsuarios.style.display = 'none'; tabLogs.style.display = 'block';
        btnUsuarios.className = 'btn-secondary-dark'; btnLogs.className = 'btn-primary-blue';
    }
};

window.renderizarUsuarios = async function() {
    const tbody = document.getElementById('tabelaUsuarios');
    if (!tbody) return;

    try {
        listaUsuarios = await db.getUsuarios();
        
        if (listaUsuarios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Nenhum usuário encontrado.</td></tr>'; return;
        }

        tbody.innerHTML = listaUsuarios.map(u => {
            const isCurrent = u.id === window.currentUser.id;
            const statusBadge = u.primeiro_acesso 
                ? `<span style="background: rgba(251, 146, 60, 0.1); color: var(--ccol-rust-bright); padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; border: 1px solid var(--ccol-rust-bright);">Pendente</span>`
                : `<span style="background: rgba(61, 220, 132, 0.1); color: var(--ccol-green-bright); padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; border: 1px solid var(--ccol-green-bright);">Ativo</span>`;
                
            return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="font-weight: bold; color: var(--ccol-blue-bright); padding: 12px;">${u.username} ${isCurrent ? '(Você)' : ''}</td>
                <td><span class="badge-role" style="font-size: 0.75rem;">${u.role}</span></td>
                <td>${statusBadge}</td>
                <td>
                    <button onclick="resetarSenhaUsuario(${u.id})" ${isCurrent ? 'disabled' : ''} style="background: rgba(255,255,255,0.05); border: 1px solid #fde047; color: #fde047; padding: 5px 10px; border-radius: 4px; cursor: ${isCurrent ? 'not-allowed' : 'pointer'}; font-size: 0.75rem;">🔄 Resetar</button>
                    <button onclick="excluirUsuario(${u.id})" ${isCurrent ? 'disabled' : ''} style="background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; color: #ef4444; padding: 5px 10px; border-radius: 4px; cursor: ${isCurrent ? 'not-allowed' : 'pointer'}; font-size: 0.75rem; margin-left: 5px;">🗑️</button>
                </td>
            </tr>
        `}).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4" style="color: #ef4444;">Erro ao carregar dados.</td></tr>';
    }
}

window.adicionarUsuario = async function() {
    const nome = document.getElementById('novoUsername').value.trim().toUpperCase();
    const role = document.getElementById('novoUserRole').value;
    if (!nome) return;
    if (listaUsuarios.some(u => u.username === nome)) { alert('⚠️ Este usuário já existe!'); return; }

    try {
        await db.addUsuario({ username: nome, senha_hash: "5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5", role: role, primeiro_acesso: true });
        document.getElementById('novoUsername').value = '';
        alert(`✅ Usuário ${nome} criado com sucesso!\nSenha provisória: 12345`);
        window.renderizarUsuarios();
    } catch(e) { alert('Erro ao criar usuário.'); }
}

window.resetarSenhaUsuario = async function(id) {
    if(confirm(`Resetar a senha para "12345"?`)) {
        await db.updateUsuarioSenhaEReset(id, "5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5");
        alert(`Senha resetada.`); window.renderizarUsuarios();
    }
}

window.excluirUsuario = async function(id) {
    if(confirm(`🚨 ATENÇÃO: Deseja EXCLUIR o acesso?`)) {
        await db.deleteUsuario(id);
        alert('Usuário excluído.'); window.renderizarUsuarios();
    }
}

window.renderizarLogs = async function() {
    const tbody = document.getElementById('listaLogs');
    if (!tbody) return;
    try {
        const logs = await db.getLogs();
        if (logs.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Nenhum registro.</td></tr>'; return; }
        tbody.innerHTML = logs.map(l => `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="color: var(--text-secondary); font-size: 0.8rem;">${new Date(l.data_hora).toLocaleString('pt-BR')}</td>
                <td style="color: var(--ccol-blue-bright); font-weight: bold;">${l.usuario}</td>
                <td><span style="background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 3px 6px; border-radius: 4px; font-size: 0.75rem; border: 1px solid #ef4444;">${l.acao}</span></td>
                <td style="text-align: left; font-size: 0.85rem;">${l.detalhes}</td>
            </tr>
        `).join('');
    } catch(e) { tbody.innerHTML = '<tr><td colspan="4">Erro</td></tr>'; }
}