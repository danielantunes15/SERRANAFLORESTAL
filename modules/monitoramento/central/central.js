// Variáveis Globais de Cache para a Central
let cacheFiliaisGlobais = [];
let cacheUsuariosGlobais = [];

window.renderizarCentral = async function() {
    await carregarDadosCentrais();
};

async function carregarDadosCentrais() {
    try {
        cacheFiliaisGlobais = await db.getTodasFiliaisAdmin();
        cacheUsuariosGlobais = await db.getUsuarios(); 
        
        atualizarKpisCentrais();
        renderizarTabelaFiliaisAdmin();
        preencherSelectsFiliais();
        preencherSelectUsuariosPermissoes(); // Injeta os usuários no dropdown de acesso
        renderizarTabelaUsuariosGlobais();
        
    } catch(e) {
        console.error("Erro ao carregar dados da Central:", e);
        alert("Falha ao sincronizar dados com o servidor.");
    }
}

function atualizarKpisCentrais() {
    document.getElementById('kpiTotalFiliais').innerText = cacheFiliaisGlobais.length;
    document.getElementById('kpiFiliaisAtivas').innerText = cacheFiliaisGlobais.filter(f => f.status === 'Ativa').length;
    document.getElementById('kpiTotalUsuarios').innerText = cacheUsuariosGlobais.length;
}

// ==================== CONTROLE DE ABAS ====================
window.alternarAbaCentral = function(aba) {
    const abaFiliais = document.getElementById('aba-filiais');
    const abaUsuarios = document.getElementById('aba-usuarios');
    const abaAcessos = document.getElementById('aba-acessos');
    
    const btnFiliais = document.getElementById('btnAbaFiliais');
    const btnUsuarios = document.getElementById('btnAbaUsuarios');
    const btnAcessos = document.getElementById('btnAbaAcessos');

    // Resetar visibilidade e classes
    abaFiliais.style.display = 'none';
    abaUsuarios.style.display = 'none';
    abaAcessos.style.display = 'none';
    
    btnFiliais.className = 'saas-tab-btn saas-tab-inactive';
    btnUsuarios.className = 'saas-tab-btn saas-tab-inactive';
    btnAcessos.className = 'saas-tab-btn saas-tab-inactive';

    if (aba === 'filiais') {
        abaFiliais.style.display = 'block';
        btnFiliais.className = 'saas-tab-btn saas-tab-active';
    } else if (aba === 'usuarios') {
        abaUsuarios.style.display = 'block';
        btnUsuarios.className = 'saas-tab-btn saas-tab-active';
    } else if (aba === 'acessos') {
        abaAcessos.style.display = 'block';
        btnAcessos.className = 'saas-tab-btn saas-tab-active';
        
        // Gatilho para carregar os checkboxes reaproveitando a função do menu.js
        if (typeof window.carregarCheckboxesPermissoes === 'function') {
            window.carregarCheckboxesPermissoes();
        }
    }
}

window.alternarTipoPermissao = function() {
    const tipo = document.querySelector('input[name="tipoPermissao"]:checked').value;
    const selPerfil = document.getElementById('selectPerfilPermissao');
    const selUser = document.getElementById('selectUsuarioPermissao');
    const btnRemover = document.getElementById('btnRemoverPermissaoUser');
    const aviso = document.getElementById('avisoPermissaoUsuario');

    if (tipo === 'perfil') {
        selPerfil.style.display = 'block';
        selUser.style.display = 'none';
        btnRemover.style.display = 'none';
        aviso.style.display = 'none';
    } else {
        selPerfil.style.display = 'none';
        selUser.style.display = 'block';
        btnRemover.style.display = 'inline-block';
        aviso.style.display = 'block';
    }
    if (typeof window.carregarCheckboxesPermissoes === 'function') {
        window.carregarCheckboxesPermissoes();
    }
}

function preencherSelectUsuariosPermissoes() {
    const selUser = document.getElementById('selectUsuarioPermissao');
    if(!selUser) return;
    selUser.innerHTML = cacheUsuariosGlobais.map(u => `<option value="user_${u.id}">${u.username} (${u.role})</option>`).join('');
}

// ==================== MÓDULO FILIAIS ====================
function renderizarTabelaFiliaisAdmin() {
    const tbody = document.getElementById('tabelaFiliaisAdmin');
    if (!tbody) return;
    
    if (cacheFiliaisGlobais.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 30px;">Nenhuma filial cadastrada no sistema.</td></tr>';
        return;
    }
    
    tbody.innerHTML = cacheFiliaisGlobais.map(f => {
        const isAtiva = f.status === 'Ativa';
        const corStatus = isAtiva ? '#10b981' : '#ef4444';
        const bgStatus = isAtiva ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
        const iconStatus = isAtiva ? 'fa-check-circle' : 'fa-times-circle';
        
        return `
        <tr>
            <td>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="width: 42px; height: 42px; border-radius: 8px; background: rgba(59, 130, 246, 0.1); display: flex; align-items: center; justify-content: center; color: #3b82f6; font-size: 1.1rem;">
                        <i class="fas fa-building"></i>
                    </div>
                    <div>
                        <div style="font-weight: 600; color: #f8fafc; font-size: 0.95rem;">${f.nome}</div>
                        <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">ID do Banco: #${f.id}</div>
                    </div>
                </div>
            </td>
            <td style="color: #cbd5e1;">${f.cnpj || '-'}</td>
            <td style="color: #cbd5e1;">${f.cidade || '-'}</td>
            <td>
                <span class="saas-badge" style="background: ${bgStatus}; color: ${corStatus}; border: 1px solid ${corStatus};">
                    <i class="fas ${iconStatus}"></i> ${f.status}
                </span>
            </td>
            <td style="text-align: right;">
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button onclick="abrirModalEditarFilial(${f.id}, '${f.nome}', '${f.cnpj || ''}', '${f.cidade || ''}')" class="saas-btn-action" style="border-color: #3b82f6; color: #3b82f6;" title="Editar Dados">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button onclick="mudarStatusFilial(${f.id}, '${isAtiva ? 'Inativa' : 'Ativa'}')" class="saas-btn-action" style="border-color: ${isAtiva ? '#ef4444' : '#10b981'}; color: ${isAtiva ? '#ef4444' : '#10b981'};" title="Gerenciar Licença">
                        <i class="fas fa-power-off"></i> ${isAtiva ? 'Suspender' : 'Reativar'}
                    </button>
                </div>
            </td>
        </tr>
    `}).join('');
}

window.abrirModalNovaFilial = function() { document.getElementById('modalNovaFilial').style.display = 'flex'; };
window.fecharModalNovaFilial = function() {
    document.getElementById('modalNovaFilial').style.display = 'none';
    document.getElementById('novaFilialNome').value = '';
    document.getElementById('novaFilialCnpj').value = '';
    document.getElementById('novaFilialCidade').value = '';
};
window.salvarNovaFilial = async function() {
    const nome = document.getElementById('novaFilialNome').value.trim();
    const cnpj = document.getElementById('novaFilialCnpj').value.trim();
    const cidade = document.getElementById('novaFilialCidade').value.trim();
    const status = document.getElementById('novaFilialStatus').value;
    if (!nome) { alert('O nome da filial é obrigatório.'); return; }
    try {
        await db.addFilial({ nome, cnpj, cidade, status });
        alert('✅ Nova filial implantada com sucesso no sistema!');
        fecharModalNovaFilial(); carregarDadosCentrais(); 
    } catch(e) { alert('⚠️ Erro ao salvar a filial no banco de dados.'); }
};

// --- LOGICA DE EDIÇÃO ---
window.abrirModalEditarFilial = function(id, nome, cnpj, cidade) {
    document.getElementById('editFilialId').value = id;
    document.getElementById('editFilialNome').value = nome !== 'null' ? nome : '';
    document.getElementById('editFilialCnpj').value = cnpj !== 'null' ? cnpj : '';
    document.getElementById('editFilialCidade').value = cidade !== 'null' ? cidade : '';
    document.getElementById('modalEditarFilial').style.display = 'flex';
};
window.fecharModalEditarFilial = function() {
    document.getElementById('modalEditarFilial').style.display = 'none';
};
window.salvarEdicaoFilial = async function() {
    const id = document.getElementById('editFilialId').value;
    const nome = document.getElementById('editFilialNome').value.trim();
    const cnpj = document.getElementById('editFilialCnpj').value.trim();
    const cidade = document.getElementById('editFilialCidade').value.trim();

    if (!nome) { alert('O nome da filial é obrigatório.'); return; }
    
    try {
        await db.updateFilialDados(id, { nome, cnpj, cidade });
        alert('✅ Dados da filial atualizados com sucesso!');
        fecharModalEditarFilial();
        carregarDadosCentrais();
    } catch(e) { alert('Erro ao atualizar a filial no banco de dados.'); }
};

window.mudarStatusFilial = async function(id, novoStatus) {
    if(confirm(`⚠️ Atenção: Deseja alterar o licenciamento desta filial para ${novoStatus.toUpperCase()}?\n\nSe suspensa, nenhum usuário da filial conseguirá logar no sistema.`)) {
        try {
            await db.updateFilialStatus(id, novoStatus); carregarDadosCentrais();
        } catch(e) { alert('Erro ao alterar o status da operação.'); }
    }
};

// ==================== MÓDULO USUÁRIOS GLOBAIS ====================
function preencherSelectsFiliais() {
    const selectFiltro = document.getElementById('filtroFilialUsuarios');
    const selectNovo = document.getElementById('novoUsuarioGlobalFilial');
    if(!selectFiltro || !selectNovo) return;

    let optionsHTML = cacheFiliaisGlobais.map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
    
    selectFiltro.innerHTML = '<option value="TODAS">Filtro: Todas as Filiais</option>' + optionsHTML;
    selectNovo.innerHTML = '<option value="" disabled selected>Selecione a Filial de Destino...</option>' + optionsHTML + '<option value="NULL_GLOBAL">ADMINISTRADOR</option>';
}

window.renderizarTabelaUsuariosGlobais = function() {
    const tbody = document.getElementById('tabelaUsuariosGlobais');
    const filtro = document.getElementById('filtroFilialUsuarios').value;
    if (!tbody) return;

    let usuariosFiltrados = cacheUsuariosGlobais;
    if (filtro !== 'TODAS') { usuariosFiltrados = cacheUsuariosGlobais.filter(u => u.filial_id == filtro); }

    if (usuariosFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 30px;">Nenhum usuário encontrado para este filtro.</td></tr>'; return;
    }

    tbody.innerHTML = usuariosFiltrados.map(u => {
        const isCurrent = u.id === window.currentUser.id;
        const isPendente = u.primeiro_acesso;
        const colorBadgeSec = isPendente ? '#f59e0b' : '#10b981';
        const bgBadgeSec = isPendente ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)';
        const textBadgeSec = isPendente ? 'Troca de Senha Pendente' : 'Conta Segura';
        const isGlobal = (u.filial_id === null);
        const filialVisual = isGlobal 
            ? '<span style="color:#a855f7; font-weight: 600;">ADMINISTRADOR</span>' 
            : `<span style="color:#cbd5e1;"><i class="fas fa-building" style="color:#64748b; margin-right:5px;"></i> ${u.filiais ? u.filiais.nome : 'Erro'}</span>`;
        const letra = u.username.charAt(0).toUpperCase();

        return `
        <tr>
            <td>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="width: 38px; height: 38px; border-radius: 50%; background: ${isGlobal ? 'rgba(168, 85, 247, 0.1)' : 'rgba(56, 189, 248, 0.1)'}; display: flex; align-items: center; justify-content: center; color: ${isGlobal ? '#a855f7' : '#38bdf8'}; font-weight: bold; font-size: 1rem;">
                        ${letra}
                    </div>
                    <div>
                        <div style="font-weight: 600; color: #f8fafc; font-size: 0.95rem;">
                            ${u.username} ${isCurrent ? '<span style="color:#10b981; font-size:0.75rem; font-weight:normal; margin-left:5px;">(Você)</span>' : ''}
                        </div>
                    </div>
                </div>
            </td>
            <td>
                <span style="background: rgba(255,255,255,0.05); color: #cbd5e1; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; border: 1px solid rgba(255,255,255,0.1);">
                    ${u.role}
                </span>
            </td>
            <td>${filialVisual}</td>
            <td>
                <span class="saas-badge" style="background: ${bgBadgeSec}; color: ${colorBadgeSec}; border: 1px solid ${colorBadgeSec};">
                    ${isPendente ? '<i class="fas fa-exclamation-circle"></i>' : '<i class="fas fa-shield-alt"></i>'} ${textBadgeSec}
                </span>
            </td>
            <td style="text-align: right;">
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button onclick="resetarSenhaGlobal(${u.id}, '${u.username}')" ${isCurrent ? 'disabled' : ''} class="saas-btn-action" style="border-color: #facc15; color: #facc15; ${isCurrent ? 'opacity: 0.5; cursor: not-allowed;' : ''}" title="Resetar para 12345">
                        <i class="fas fa-key"></i> Resetar
                    </button>
                    <button onclick="excluirUsuarioGlobal(${u.id}, '${u.username}')" ${isCurrent ? 'disabled' : ''} class="saas-btn-action" style="border-color: #ef4444; color: #ef4444; ${isCurrent ? 'opacity: 0.5; cursor: not-allowed;' : ''}" title="Revogar Acesso">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </td>
        </tr>
    `}).join('');
};

window.abrirModalNovoUsuarioGlobal = function() { document.getElementById('modalNovoUsuarioGlobal').style.display = 'flex'; };
window.fecharModalNovoUsuarioGlobal = function() { document.getElementById('modalNovoUsuarioGlobal').style.display = 'none'; document.getElementById('novoUsuarioGlobalNome').value = ''; };

window.salvarNovoUsuarioGlobal = async function() {
    const nome = document.getElementById('novoUsuarioGlobalNome').value.trim().toUpperCase();
    const filialIdRaw = document.getElementById('novoUsuarioGlobalFilial').value;
    const role = document.getElementById('novoUsuarioGlobalRole').value;

    if (!nome) { alert('Digite o login do usuário.'); return; }
    if (!filialIdRaw) { alert('Selecione a filial de destino.'); return; }
    if (cacheUsuariosGlobais.some(u => u.username === nome)) { alert('⚠️ Este login já existe no sistema!'); return; }

    const filial_id = filialIdRaw === 'NULL_GLOBAL' ? null : parseInt(filialIdRaw);
    const hashPadrao = "5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5";

    try {
        await db.addUsuario({ username: nome, senha_hash: hashPadrao, role: role, primeiro_acesso: true, filial_id: filial_id });
        alert(`✅ Usuário ${nome} criado com sucesso!\nSenha provisória: 12345`);
        fecharModalNovoUsuarioGlobal(); carregarDadosCentrais(); 
    } catch(e) { alert('Erro ao criar usuário.'); }
};

window.resetarSenhaGlobal = async function(id, nome) {
    if(confirm(`⚠️ Resetar a senha do usuário ${nome} para "12345"?`)) {
        try {
            await db.updateUsuarioSenhaEReset(id, "5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5");
            alert(`Senha resetada com sucesso.`); carregarDadosCentrais();
        } catch (e) { alert("Erro ao resetar senha."); }
    }
}
window.excluirUsuarioGlobal = async function(id, nome) {
    if(confirm(`🚨 PERIGO: Deseja realmente EXCLUIR o acesso do usuário ${nome}?`)) {
        try {
            await db.deleteUsuario(id); alert('Acesso revogado.'); carregarDadosCentrais();
        } catch (e) { alert("Erro ao excluir usuário."); }
    }
}