// ==================== MÓDULO: AUTENTICAÇÃO E USUÁRIOS ====================

window.currentUser = null;
let listaUsuarios = [];
window.permissoesGlobais = null; // Variável global para segurar as permissões puxadas do banco

window.fazerLogout = function() {
    if(confirm('Deseja realmente sair do sistema?')) {
        // APAGA A SESSÃO QUANDO CLICA EM SAIR
        localStorage.removeItem('ccol_user_session');
        window.currentUser = null;
        window.location.href = 'login.html'; // Redireciona para a nova tela de login
    }
}

async function iniciarSistemaAutorizado() {
    document.getElementById('appLayout').style.display = 'flex';
    
    const filialNome = window.currentUser.filiais ? window.currentUser.filiais.nome : 'Matriz';

    document.getElementById('loggedUserName').innerHTML = `<i class="fas fa-user-circle"></i> ${window.currentUser.username}`;
    document.getElementById('loggedUserRole').innerHTML = `<i class="fas fa-building"></i> ${filialNome} | Nível: ${window.currentUser.role}`;

    // Busca as permissões do banco no momento que o usuário loga
    const permissoesDoBanco = await db.getPermissoesDB();
    window.permissoesGlobais = { ...permissoesPadrao, ...permissoesDoBanco };

    if (typeof initDashboard === 'function') initDashboard();
    if (typeof window.iniciarSistema === 'function') window.iniciarSistema();
}

document.addEventListener('DOMContentLoaded', () => {
    // VERIFICA SE EXISTE UMA SESSÃO SALVA AO ABRIR O SITE
    const sessaoSalva = localStorage.getItem('ccol_user_session');
    if (sessaoSalva) {
        window.currentUser = JSON.parse(sessaoSalva);
        iniciarSistemaAutorizado(); // Entra no sistema
    } else {
        // Se não existir sessão, manda para a tela de login correta
        window.location.href = 'login.html';
    }
});

// ---------------- GESTÃO DE USUÁRIOS E PERMISSÕES ----------------

// Permissões padrão caso o banco esteja vazio
const permissoesPadrao = {
    "Admin": ["escala", "alocacao", "motoristas", "caminhoes", "os", "troca", "jornada", "treinamento", "indicadores", "indicadores_serrana", "servicos", "cadastro_frota", "almoxarifado"],
    "Controlador de Trefego": ["escala", "alocacao", "troca", "jornada"],
    "SSMA": ["motoristas", "treinamento", "jornada"],
    "Controle de Manutencao": ["caminhoes", "os", "cadastro_frota", "almoxarifado"],
    "Almoxarifado": ["os", "almoxarifado"],
    "Mecanico": ["servicos"]
};

window.getPermissoes = function() {
    // Agora lê da variável global puxada do banco
    return window.permissoesGlobais || permissoesPadrao;
};

window.carregarCheckboxesPermissoes = function() {
    const perfil = document.getElementById('selectPerfilPermissao')?.value;
    if(!perfil) return;
    
    const permissoesAtuais = window.getPermissoes();
    const permitidos = permissoesAtuais[perfil] || [];

    document.querySelectorAll('.chk-permissao').forEach(chk => {
        chk.checked = permitidos.includes(chk.value);
    });
};

window.salvarPermissoesPerfil = async function() {
    const perfil = document.getElementById('selectPerfilPermissao').value;
    const checkboxesMarcados = document.querySelectorAll('.chk-permissao:checked');
    const novasPermissoes = Array.from(checkboxesMarcados).map(chk => chk.value);
    
    // Salva no Banco de Dados (Supabase)
    await db.updatePermissoesDB(perfil, novasPermissoes);
    
    // Atualiza a memória local para não precisar deslogar quem está salvando
    if(!window.permissoesGlobais) window.permissoesGlobais = { ...permissoesPadrao };
    window.permissoesGlobais[perfil] = novasPermissoes;
    
    alert(`✅ Permissões para o perfil "${perfil}" salvas com sucesso no Banco de Dados!\nTodos os usuários deste perfil terão os acessos atualizados.`);
    
    if (typeof window.renderizarMenu === 'function') window.renderizarMenu();
};

// --- CONTROLE DE SUB-ABAS DAS CONFIGURAÇÕES ---
window.alternarAbaConfig = function(aba) {
    const tabUsuarios = document.getElementById('config-tab-usuarios');
    const tabLogs = document.getElementById('config-tab-logs');
    const btnUsuarios = document.getElementById('btnTabUsuarios');
    const btnLogs = document.getElementById('btnTabLogs');
    
    if(!tabUsuarios || !tabLogs) return;

    if (aba === 'usuarios') {
        tabUsuarios.style.display = 'block';
        tabLogs.style.display = 'none';
        btnUsuarios.className = 'btn-primary-blue';
        btnLogs.className = 'btn-secondary-dark';
    } else {
        tabUsuarios.style.display = 'none';
        tabLogs.style.display = 'block';
        btnUsuarios.className = 'btn-secondary-dark';
        btnLogs.className = 'btn-primary-blue';
    }
};

window.renderizarUsuarios = async function() {
    const tbody = document.getElementById('tabelaUsuarios');
    if (!tbody) return;

    try {
        listaUsuarios = await db.getUsuarios();
        
        if (listaUsuarios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Nenhum usuário encontrado.</td></tr>';
            return;
        }

        tbody.innerHTML = listaUsuarios.map(u => {
            const isCurrent = u.id === window.currentUser.id;
            const statusBadge = u.primeiro_acesso 
                ? `<span style="background: rgba(251, 146, 60, 0.1); color: var(--ccol-rust-bright); padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; border: 1px solid var(--ccol-rust-bright);">Pendente (1º Acesso)</span>`
                : `<span style="background: rgba(61, 220, 132, 0.1); color: var(--ccol-green-bright); padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; border: 1px solid var(--ccol-green-bright);">Ativo</span>`;
                
            return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="font-weight: bold; color: var(--ccol-blue-bright); text-align: left; padding: 12px;">${u.username} ${isCurrent ? '(Você)' : ''}</td>
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
    const nomeInput = document.getElementById('novoUsername');
    const roleInput = document.getElementById('novoUserRole');
    
    if(!nomeInput || !roleInput) return;

    const nome = nomeInput.value.trim().toUpperCase();
    const role = roleInput.value;

    if (!nome) { alert('Digite o nome de usuário'); return; }
    if (listaUsuarios.some(u => u.username === nome)) { alert('⚠️ Este usuário já existe!'); return; }

    const hashPadrao = "5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5";

    try {
        await db.addUsuario({ username: nome, senha_hash: hashPadrao, role: role, primeiro_acesso: true });
        nomeInput.value = '';
        alert(`✅ Usuário ${nome} criado com sucesso!\nSenha provisória: 12345`);
        window.renderizarUsuarios();
    } catch(e) { alert('Erro ao criar usuário.'); }
}

window.resetarSenhaUsuario = async function(id) {
    const u = listaUsuarios.find(x => x.id === id);
    if (!u) return;
    if(confirm(`Resetar a senha de ${u.username} para "12345"?`)) {
        const hashPadrao = "5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5";
        await db.updateUsuarioSenhaEReset(id, hashPadrao);
        alert(`A senha de ${u.username} foi resetada para 12345.`);
        window.renderizarUsuarios();
    }
}

window.excluirUsuario = async function(id) {
    const u = listaUsuarios.find(x => x.id === id);
    if (!u) return;
    if(confirm(`🚨 ATENÇÃO: Deseja EXCLUIR o acesso do usuário ${u.username}?`)) {
        await db.deleteUsuario(id);
        alert('Usuário excluído.');
        
        if (typeof db.addLog === 'function') {
            await db.addLog('Exclusão de Usuário', `Acesso revogado: ${u.username}`);
            window.renderizarLogs();
        }
        window.renderizarUsuarios();
    }
}

window.renderizarLogs = async function() {
    const tbody = document.getElementById('listaLogs');
    if (!tbody) return;

    try {
        const logs = await db.getLogs();
        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Nenhum registro de log encontrado.</td></tr>';
            return;
        }

        tbody.innerHTML = logs.map(l => `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="color: var(--text-secondary); font-size: 0.8rem;">${new Date(l.data_hora).toLocaleString('pt-BR')}</td>
                <td style="color: var(--ccol-blue-bright); font-weight: bold;">${l.usuario}</td>
                <td><span style="background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 3px 6px; border-radius: 4px; font-size: 0.75rem; border: 1px solid #ef4444;">${l.acao}</span></td>
                <td style="text-align: left; font-size: 0.85rem;">${l.detalhes}</td>
            </tr>
        `).join('');
    } catch(e) {
        tbody.innerHTML = '<tr><td colspan="4" style="color: #ef4444;">Erro ao carregar logs.</td></tr>';
    }
}