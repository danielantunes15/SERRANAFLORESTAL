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

window.trocarFilialSuperAdmin = async function(novoFilialIdRaw) {
    const filial_id = novoFilialIdRaw === 'CENTRAL' ? null : parseInt(novoFilialIdRaw);
    let nomeFilial = "ADMINISTRADOR";

    if (filial_id !== null) {
        const filiais = await db.getFiliais();
        const f = filiais.find(x => x.id == filial_id);
        if (f) nomeFilial = f.nome;
    }

    window.currentUser.filial_id = filial_id;
    window.currentUser.filiais = { nome: nomeFilial };
    localStorage.setItem('ccol_user_session', JSON.stringify(window.currentUser));
    window.location.reload();
}

async function iniciarSistemaAutorizado() {
    document.getElementById('appLayout').style.display = 'flex';
    
    const filialNome = window.currentUser.filiais ? window.currentUser.filiais.nome : 'Matriz';

    document.getElementById('loggedUserName').innerHTML = `<i class="fas fa-user-circle"></i> ${window.currentUser.username} <span style="font-size:0.7rem; color:#94a3b8;">(${window.currentUser.role})</span>`;
    
    const roleSpan = document.getElementById('loggedUserRole');

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
        roleSpan.innerHTML = `<i class="fas fa-building"></i> ${filialNome}`;
    }

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
        
        try {
            const dbUser = await db.getUsuarioByUsername(window.currentUser.username);
            
            if (!dbUser) {
                alert("🔒 Acesso revogado: Sua conta foi excluída ou desativada pelo administrador.");
                localStorage.removeItem('ccol_user_session');
                window.location.href = 'login.html';
                return; 
            }

            window.currentUser.role = dbUser.role;
            // CORREÇÃO: Recuperar o ID do Cargo no banco para alinhar as permissões
            if (dbUser.cargo_id) window.currentUser.cargo_id = dbUser.cargo_id;
            
            localStorage.setItem('ccol_user_session', JSON.stringify(window.currentUser));

        } catch (error) {
            console.error("Erro ao validar credenciais no banco de dados:", error);
        }

        iniciarSistemaAutorizado(); 
    } else {
        window.location.href = 'login.html';
    }
});

const permissoesPadrao = {
    "Admin": ["escala", "alocacao", "motoristas", "caminhoes", "os", "troca", "jornada", "treinamento", "indicadores", "indicadores_serrana", "servicos", "cadastro_frota", "almoxarifado"],
    "Gerente": [
        "escala", "troca_turno", "alocacao", "recados", "motoristas", "caminhoes", "documentos_frota",
        "os", "servicos", "cadastro_frota", "os_apoio", "almoxarifado", "treinamento",
        "relatorio_gerencial", "indicadores", "indicadores_serrana", "cadastro_indicadores",
        "visao_geral", "operacional", "desempenho_frota", "jornadas", "historico_producao", "historico_jornadas", "configuracoes_gerencial"
    ],
    "Controlador de Tráfego": ["escala", "alocacao", "troca", "jornada"],
    "SSMA": ["motoristas", "treinamento", "jornada"],
    "Controle de Manutencao": ["caminhoes", "os", "cadastro_frota", "almoxarifado"],
    "Almoxarifado": ["os", "almoxarifado"],
    "Mecanico": ["servicos"]
};

window.getPermissoes = function() { return window.permissoesGlobais || permissoesPadrao; };

window.salvarPermissoesPerfil = async function() {
    const tipo = document.querySelector('input[name="tipoPermissao"]:checked')?.value || 'perfil';
    let alvo = '';
    let nomeAlerta = '';

    if (tipo === 'perfil') {
        const selectEl = document.getElementById('selectPerfilPermissao');
        alvo = selectEl.value; // Recebe o ID do cargo
        
        if (!alvo) { alert("⚠️ Selecione um cargo primeiro."); return; }
        nomeAlerta = `o perfil "${selectEl.options[selectEl.selectedIndex].text}"`;
    } else {
        const selUser = document.getElementById('selectUsuarioPermissao');
        alvo = selUser.value;
        if (!alvo) { alert("⚠️ Selecione um usuário primeiro."); return; }
        nomeAlerta = `a Exceção do usuário ${selUser.options[selUser.selectedIndex].text}`;
    }

    const checkboxesMarcados = document.querySelectorAll('.chk-permissao:checked');
    let novasPermissoes = Array.from(checkboxesMarcados).map(chk => chk.value);
    
    const isSuperAdmin = (window.currentUser && window.currentUser.role === 'SuperAdmin');

    if (!isSuperAdmin) {
        const menusRestritos = ['producao_frota']; 
        
        novasPermissoes = novasPermissoes.filter(p => !menusRestritos.includes(p));
        const permissoesAtuais = (window.permissoesGlobais && window.permissoesGlobais[alvo]) ? window.permissoesGlobais[alvo] : ((window.getPermissoes())[alvo] || []);
        const restritasExistentes = permissoesAtuais.filter(p => menusRestritos.includes(p));
        
        novasPermissoes = novasPermissoes.concat(restritasExistentes);
    }
    
    await db.updatePermissoesDB(alvo, novasPermissoes);
    
    if(!window.permissoesGlobais) window.permissoesGlobais = { ...permissoesPadrao };
    window.permissoesGlobais[alvo] = novasPermissoes;
    
    alert(`✅ Permissões para ${nomeAlerta} salvas com sucesso!`);
    if (typeof window.renderizarMenu === 'function') window.renderizarMenu();
};

window.removerPermissaoEspecifica = async function() {
    const selUser = document.getElementById('selectUsuarioPermissao');
    const alvo = selUser.value;
    const nome = selUser.options[selUser.selectedIndex].text;

    if(confirm(`Tem certeza que deseja remover a exceção de ${nome}?\nEle voltará a ter apenas os acessos padrão do seu Perfil.`)) {
        await db.updatePermissoesDB(alvo, ["__RESET__"]);
        
        if(!window.permissoesGlobais) window.permissoesGlobais = { ...permissoesPadrao };
        window.permissoesGlobais[alvo] = ["__RESET__"];
        
        alert('Exceção removida com sucesso!');
        if (typeof window.carregarCheckboxesPermissoes === 'function') window.carregarCheckboxesPermissoes();
        if (typeof window.renderizarMenu === 'function') window.renderizarMenu();
    }
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