// ==================== MÓDULO: AUTENTICAÇÃO E USUÁRIOS ====================

window.currentUser = null;
window.permissoesGlobais = null; 

// Auxiliar para ler as filiais extras do usuário de qualquer formato salvo no banco
window.extrairFiliaisExtrasPermissoes = function(permissoesObj, userId, username) {
    if (!permissoesObj) return [];
    const keyId = `filiais_user_${userId}`;
    const keyName = username ? `filiais_username_${String(username).trim().toUpperCase()}` : '';

    let raw = permissoesObj[keyId] || (keyName ? permissoesObj[keyName] : null) || [];
    if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch (e) { raw = raw.split(','); }
    }
    if (!Array.isArray(raw)) return [];

    return raw
        .map(v => parseInt(String(v).trim(), 10))
        .filter(n => !isNaN(n) && n > 0);
};

window.fazerLogout = async function() {
    if(confirm('Deseja realmente sair do sistema?')) {
        try {
            await window.supabaseClient.auth.signOut();
        } catch (e) {
            console.error("Erro ao deslogar do servidor de autenticação:", e);
        }

        try {
            if (typeof window.registrarLogAuditoria === 'function') {
                await window.registrarLogAuditoria('Autenticação', 'Logout', 'O usuário encerrou a sessão no sistema manualmente.', 'Info');
            }
        } catch (e) { console.error(e); }
        
        localStorage.removeItem('ccol_user_session');
        window.currentUser = null;
        window.location.href = 'login.html'; 
    }
}

window.trocarFilialSuperAdmin = async function(novoFilialIdRaw) {
    const filial_id = novoFilialIdRaw === 'CENTRAL' ? null : parseInt(novoFilialIdRaw, 10);
    let nomeFilial = "ADMINISTRADOR";

    if (filial_id !== null) {
        const filiais = await db.getFiliais();
        const f = filiais.find(x => Number(x.id) === Number(filial_id));
        if (f) nomeFilial = f.nome;
    }

    const eraGlobalReal = (
        window.currentUser.role === 'SuperAdmin' ||
        window.currentUser.role === 'Admin' ||
        window.currentUser.filial_base_id === null ||
        window.currentUser.is_global_session === true
    );

    if (typeof window.registrarLogAuditoria === 'function') {
        await window.registrarLogAuditoria('Sistema', 'Troca de Contexto', `O usuário ${window.currentUser.username} trocou a visualização para a filial: ${nomeFilial}`, 'Alerta');
    }

    window.currentUser.filial_id = filial_id;
    window.currentUser.filiais = { nome: nomeFilial };

    if (eraGlobalReal) {
        window.currentUser.is_global_session = true;
    }

    localStorage.setItem('ccol_user_session', JSON.stringify(window.currentUser));
    window.location.reload();
}

async function iniciarSistemaAutorizado() {
    document.getElementById('appLayout').style.display = 'flex';
    
    const filialNome = window.currentUser.filiais ? window.currentUser.filiais.nome : 'Matriz';
    const cargoExibicao = window.currentUser.cargo_nome || window.currentUser.role || 'Operacional';

    document.getElementById('loggedUserName').innerHTML = `<i class="fas fa-user-circle"></i> ${window.currentUser.username} <span style="font-size:0.7rem; color:#94a3b8;">(${cargoExibicao})</span>`;
    
    const roleSpan = document.getElementById('loggedUserRole');

    const permissoesDoBanco = await db.getPermissoesDB();
    window.permissoesGlobais = { ...permissoesPadrao, ...permissoesDoBanco };

    // Verifica se é usuário Global (SuperAdmin / Admin / Corporativo)
    const isGlobalUser = (
        window.currentUser.role === 'SuperAdmin' || 
        window.currentUser.role === 'Admin' || 
        window.currentUser.filial_base_id === null ||
        window.currentUser.filial_id === null || 
        window.currentUser.is_global_session === true
    );

    // Extrai todas as filiais adicionais liberadas para este usuário
    const extrasBanco = window.extrairFiliaisExtrasPermissoes(
        window.permissoesGlobais,
        window.currentUser.id,
        window.currentUser.username
    );
    const extrasSessao = Array.isArray(window.currentUser.filiais_permitidas)
        ? window.currentUser.filiais_permitidas.map(v => parseInt(v, 10)).filter(n => !isNaN(n))
        : [];

    const filialBaseUsuario = (window.currentUser.filial_base_id !== undefined && window.currentUser.filial_base_id !== null)
        ? parseInt(window.currentUser.filial_base_id, 10)
        : (window.currentUser.filial_id !== null ? parseInt(window.currentUser.filial_id, 10) : null);

    const todasFiliaisPermitidasUsuario = [...new Set([
        ...(filialBaseUsuario !== null && !isNaN(filialBaseUsuario) ? [filialBaseUsuario] : []),
        ...extrasBanco,
        ...extrasSessao
    ])];

    // Atualiza na sessão para manter sincronizado
    window.currentUser.filiais_permitidas = todasFiliaisPermitidasUsuario;
    localStorage.setItem('ccol_user_session', JSON.stringify(window.currentUser));

    if (isGlobalUser) {
        db.getFiliais().then(filiais => {
            let options = `<option value="CENTRAL" ${window.currentUser.filial_id === null ? 'selected' : ''}>ADMINISTRADOR</option>`;
            filiais.forEach(f => {
                options += `<option value="${f.id}" ${Number(window.currentUser.filial_id) === Number(f.id) ? 'selected' : ''}>Navegar p/ ${f.nome}</option>`;
            });

            roleSpan.innerHTML = `
                <select class="dark-select" style="font-size: 0.75rem; padding: 4px 6px; height: auto; background: #0f172a; border: 1px solid rgba(59, 130, 246, 0.5); border-radius: 4px; color: #38bdf8; font-weight: bold; margin-top: 4px; cursor: pointer; outline: none; width: 100%; max-width: 250px;" onchange="trocarFilialSuperAdmin(this.value)">
                    ${options}
                </select>
            `;
        });
    } else if (todasFiliaisPermitidasUsuario.length > 1) {
        // Usuário com acesso Multi-Filial (Ex.: Eunápolis + Mucuri) -> Mostra o dropdown igual ao SuperAdmin com as filiais dele!
        const buscarListaFiliais = (typeof db.getTodasFiliaisAdmin === 'function') ? db.getTodasFiliaisAdmin() : db.getFiliais();
        buscarListaFiliais.then(filiais => {
            const filiaisLiberadas = (filiais || []).filter(f => todasFiliaisPermitidasUsuario.includes(Number(f.id)));
            let options = '';
            filiaisLiberadas.forEach(f => {
                const isSelected = Number(window.currentUser.filial_id) === Number(f.id) ? 'selected' : '';
                options += `<option value="${f.id}" ${isSelected}>Navegar p/ ${f.nome}</option>`;
            });

            roleSpan.innerHTML = `
                <select class="dark-select" style="font-size: 0.75rem; padding: 4px 6px; height: auto; background: #0f172a; border: 1px solid rgba(56, 189, 248, 0.5); border-radius: 4px; color: #38bdf8; font-weight: bold; margin-top: 4px; cursor: pointer; outline: none; width: 100%; max-width: 260px;" onchange="trocarFilialSuperAdmin(this.value)" title="Alternar entre suas filiais liberadas">
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

    try {
        const resp = await fetch('https://api.ipify.org?format=json');
        const data = await resp.json();
        if (typeof window.registrarLogAuditoria === 'function') {
            window.registrarLogAuditoria('Autenticação', 'Login de Acesso', 'Usuário iniciou uma nova sessão no sistema.', 'Info', null, null, null, null, data.ip);
        }
    } catch (e) {
        if (typeof window.registrarLogAuditoria === 'function') {
            window.registrarLogAuditoria('Autenticação', 'Login de Acesso', 'Usuário iniciou uma nova sessão no sistema (IP bloqueado pelo firewall).', 'Info');
        }
    }

    if (typeof initDashboard === 'function') { await initDashboard(); }
    if (typeof window.iniciarSistema === 'function') { window.iniciarSistema(); }
}

document.addEventListener('DOMContentLoaded', async () => {
    const sessaoSalva = localStorage.getItem('ccol_user_session');
    
    if (!sessaoSalva) {
        window.location.href = 'login.html';
        return;
    }

    window.currentUser = JSON.parse(sessaoSalva);
    
    try {
        const dbUser = await db.getUsuarioByUsername(window.currentUser.username);
        
        if (!dbUser) {
            alert("🔒 Acesso revogado: Sua conta foi excluída ou desativada pelo administrador.");
            if (typeof window.registrarLogAuditoria === 'function') {
                await window.registrarLogAuditoria('Autenticação', 'Acesso Negado', `Tentativa de login reprovada (Conta Inexistente): ${window.currentUser.username}`, 'Crítico');
            }
            await window.supabaseClient.auth.signOut();
            localStorage.removeItem('ccol_user_session');
            window.location.href = 'login.html';
            return; 
        }

        if (dbUser.status === 'Inativo') {
            alert("🔒 Acesso revogado: Este usuário encontra-se inativo no sistema.");
            if (typeof window.registrarLogAuditoria === 'function') {
                await window.registrarLogAuditoria('Autenticação', 'Acesso Negado', `Tentativa de login reprovada (Conta Inativa): ${window.currentUser.username}`, 'Crítico');
            }
            await window.supabaseClient.auth.signOut();
            localStorage.removeItem('ccol_user_session');
            window.location.href = 'login.html';
            return;
        }

        window.currentUser.id = dbUser.id;
        window.currentUser.role = dbUser.role;
        window.currentUser.filial_base_id = dbUser.filial_id;
        if (dbUser.cargo_id) window.currentUser.cargo_id = dbUser.cargo_id;

        // Busca o nome do cargo para exibir no topo
        if (dbUser.cargo_id && window.supabaseClient) {
            const { data: cargoRow } = await window.supabaseClient
                .from('cargos')
                .select('nome')
                .eq('id', dbUser.cargo_id)
                .maybeSingle();
            if (cargoRow && cargoRow.nome) {
                window.currentUser.cargo_nome = cargoRow.nome;
            }
        }
        
        localStorage.setItem('ccol_user_session', JSON.stringify(window.currentUser));

    } catch (error) {
        console.error("Erro ao validar credenciais no banco de dados:", error);
    }

    iniciarSistemaAutorizado(); 
});

const permissoesPadrao = {
    "Admin": ["escala", "alocacao", "motoristas", "caminhoes", "os", "troca", "jornada", "indicadores", "indicadores_serrana", "servicos", "cadastro_frota", "almoxarifado"],
    "Gerente": [
        "escala", "troca_turno", "alocacao", "recados", "motoristas", "caminhoes", "documentos_frota",
        "os", "servicos", "cadastro_frota", "os_apoio", "almoxarifado", 
        "relatorio_gerencial", "indicadores", "indicadores_serrana", "cadastro_indicadores",
        "visao_geral", "operacional", "desempenho_frota", "jornadas", "historico_producao", "historico_jornadas", "configuracoes_gerencial"
    ],
    "Controlador de Tráfego": ["escala", "alocacao", "troca", "jornada"],
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
        alvo = selectEl.value; 
        
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
    
    if (typeof window.registrarLogAuditoria === 'function') {
        window.registrarLogAuditoria('Segurança', 'Edição de Acessos', `O administrador alterou a carga de permissões para ${nomeAlerta}.`, 'Alerta');
    }

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
        
        if (typeof window.registrarLogAuditoria === 'function') {
            window.registrarLogAuditoria('Segurança', 'Remoção de Acesso', `Exceção de permissões removida para o usuário: ${nome}.`, 'Alerta');
        }

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