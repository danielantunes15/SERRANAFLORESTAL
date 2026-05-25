// ==================== MÓDULO: AUTENTICAÇÃO E USUÁRIOS ====================

window.currentUser = null;
window.permissoesGlobais = null; 

window.fazerLogout = function() {
    if(confirm('Deseja realmente sair do sistema?')) {
        localStorage.removeItem('ccol_user_session');
        window.currentUser = null;
        window.location.href = 'login.html'; 
    }
}

// Função para o SuperAdmin navegar entre filiais em tempo real
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

document.addEventListener('DOMContentLoaded', async () => {
    const sessaoSalva = localStorage.getItem('ccol_user_session');
    
    if (sessaoSalva) {
        window.currentUser = JSON.parse(sessaoSalva);
        
        // =========================================================================
        // VALIDAÇÃO DE SEGURANÇA CONTRA USUÁRIOS EXCLUÍDOS
        // Verifica se o usuário logado na sessão ainda existe no banco de dados.
        // =========================================================================
        try {
            const dbUser = await db.getUsuarioByUsername(window.currentUser.username);
            
            // Se dbUser for nulo, significa que a conta foi apagada do banco.
            if (!dbUser) {
                alert("🔒 Acesso revogado: Sua conta foi excluída ou desativada pelo administrador.");
                localStorage.removeItem('ccol_user_session');
                window.location.href = 'login.html';
                return; // Bloqueia a execução do resto do código
            }

            // Opcional: Atualiza o cargo da pessoa caso o admin tenha mudado e ela recarregue a página
            window.currentUser.role = dbUser.role;
            localStorage.setItem('ccol_user_session', JSON.stringify(window.currentUser));

        } catch (error) {
            console.error("Erro ao validar credenciais no banco de dados:", error);
        }
        // =========================================================================

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
        if(typeof renderizarUsuarios === 'function') renderizarUsuarios();
    } else {
        tabUsuarios.style.display = 'none'; tabLogs.style.display = 'block';
        btnUsuarios.className = 'btn-secondary-dark'; btnLogs.className = 'btn-primary-blue';
        if(typeof renderizarLogs === 'function') renderizarLogs();
    }
};