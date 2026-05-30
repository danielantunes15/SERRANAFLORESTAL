// ==================== MÓDULO: GESTÃO DE USUÁRIOS E FILIAIS ====================

let listaUsuarios = [];
let listaFiliaisAtivas = [];

// Função auxiliar que injeta as amarrações do Organograma Corporativo
async function injetarSelectsOrganizacionais() {
    const inputRole = document.getElementById('novoUserRole');
    if (!inputRole || !inputRole.parentNode) return;
    
    inputRole.style.display = 'none';

    if (!document.getElementById('novoUserFilial')) {
        const selectFilial = document.createElement('select');
        selectFilial.id = 'novoUserFilial';
        selectFilial.className = 'dark-select';
        selectFilial.style.marginLeft = '10px';
        selectFilial.style.padding = '8px';
        selectFilial.style.borderRadius = '4px';
        
        const selectCargo = document.createElement('select');
        selectCargo.id = 'novoUserCargo';
        selectCargo.className = 'dark-select';
        selectCargo.style.marginLeft = '10px';
        selectCargo.style.padding = '8px';
        selectCargo.style.borderRadius = '4px';
        selectCargo.innerHTML = '<option value="" disabled selected>-- Selecione a Filial Primeiro --</option>';

        inputRole.parentNode.insertBefore(selectFilial, inputRole.nextSibling);
        inputRole.parentNode.insertBefore(selectCargo, selectFilial.nextSibling);

        const carregarCargosParaFilial = async (filialId) => {
            if (!filialId) return;
            selectCargo.innerHTML = '<option value="">Carregando Cargos Corporativos...</option>';
            
            try {
                let query = supabaseClient.from('cargos')
                    .select('id, nome, nivel_hierarquico, nivel_acesso, centro_custo_id')
                    .eq('status', 'Ativo');
                
                if (filialId === 'CENTRAL') {
                    query = query.is('filial_id', null);
                } else {
                    query = query.eq('filial_id', parseInt(filialId));
                }

                const { data, error } = await query;
                if (error) throw error;
                
                let options = '<option value="" disabled selected>-- Selecione o Cargo no Organograma --</option>';
                if (data && data.length > 0) {
                    data.forEach(c => {
                        const ccAttr = c.centro_custo_id ? c.centro_custo_id : '';
                        options += `<option value="${c.id}" data-role="${c.nivel_acesso}" data-cc="${ccAttr}">${c.nome} (${c.nivel_hierarquico})</option>`;
                    });
                } else {
                    options = '<option value="" disabled selected>Nenhum Cargo Configurado Nesta Filial</option>';
                }
                selectCargo.innerHTML = options;
            } catch(e) {
                console.error("Erro ao puxar cargos da filial:", e);
                selectCargo.innerHTML = '<option value="" disabled selected>Erro ao carregar Organograma</option>';
            }
        };

        selectFilial.addEventListener('change', (e) => carregarCargosParaFilial(e.target.value));

        if (window.currentUser && window.currentUser.role === 'SuperAdmin') {
            try {
                const filiais = await db.getTodasFiliaisAdmin();
                let options = '<option value="" disabled selected>-- Selecione a Filial de Atuação --</option>';
                options += '<option value="CENTRAL">ADMINISTRAÇÃO (Corporativo / Global)</option>';
                if (filiais && filiais.length > 0) {
                    filiais.forEach(f => { options += `<option value="${f.id}">${f.nome}</option>`; });
                }
                selectFilial.innerHTML = options;
                selectFilial.disabled = false;
            } catch (e) {
                console.error("Erro ao listar filiais:", e);
            }
        } else if (window.currentUser) {
            const fValue = window.currentUser.filial_id === null ? 'CENTRAL' : window.currentUser.filial_id;
            selectFilial.innerHTML = `<option value="${fValue}" selected>Minha Filial Base</option>`;
            selectFilial.disabled = true;
            carregarCargosParaFilial(fValue);
        }
    }
}

window.renderizarUsuarios = async function() {
    const tbody = document.getElementById('tabelaUsuarios');
    if (!tbody) return;

    await injetarSelectsOrganizacionais();
    await window.carregarPerfisPermissao();

    try {
        let mapaCargos = {};
        try {
            const { data: cargosData, error: errCargos } = await supabaseClient.from('cargos').select('id, nome');
            if (!errCargos && cargosData) {
                cargosData.forEach(c => mapaCargos[c.id] = c.nome);
            }
        } catch (e) {
            console.error("Erro ao buscar cargos para o mapeamento:", e);
        }

        const todosUsuarios = await db.getUsuarios('TODAS'); 
        
        if (window.currentUser && window.currentUser.role !== 'SuperAdmin') {
            const filialAtiva = window.currentUser.filial_id;
            if (filialAtiva !== null && filialAtiva !== 'CENTRAL') {
                listaUsuarios = todosUsuarios.filter(u => u.filial_id == filialAtiva);
            } else {
                listaUsuarios = todosUsuarios.filter(u => u.filial_id === null);
            }
        } else {
            listaUsuarios = todosUsuarios; 
        }

        if (listaUsuarios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Nenhum usuário encontrado para esta filial.</td></tr>'; return;
        }

        tbody.innerHTML = listaUsuarios.map(u => {
            const isCurrent = u.id === window.currentUser.id;
            const statusBadge = u.primeiro_acesso 
                ? `<span style="background: rgba(251, 146, 60, 0.1); color: var(--ccol-rust-bright); padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; border: 1px solid var(--ccol-rust-bright);">Pendente</span>`
                : `<span style="background: rgba(61, 220, 132, 0.1); color: var(--ccol-green-bright); padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; border: 1px solid var(--ccol-green-bright);">Ativo</span>`;
            
            const filialNome = u.filial_id === null ? '<span style="color:#fde047; font-weight:bold;">Corporativo Global</span>' : (u.filiais ? u.filiais.nome : `Filial ID: ${u.filial_id}`);
            
            const nomeDoCargo = (u.cargo_id && mapaCargos[u.cargo_id]) 
                ? mapaCargos[u.cargo_id] 
                : (u.cargos ? u.cargos.nome : (u.role || 'Sem Cargo Definido'));
                
            return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="font-weight: bold; color: var(--ccol-blue-bright); padding: 12px;">${u.username} ${isCurrent ? '(Você)' : ''}</td>
                <td><span class="badge-role" style="font-size: 0.75rem; background: #3b82f6;">${nomeDoCargo}</span></td>
                <td style="font-size: 0.8rem; color: #cbd5e1;">${filialNome}</td>
                <td>${statusBadge}</td>
                <td>
                    <button onclick="resetarSenhaUsuario(${u.id})" ${isCurrent ? 'disabled' : ''} style="background: rgba(255,255,255,0.05); border: 1px solid #fde047; color: #fde047; padding: 5px 10px; border-radius: 4px; cursor: ${isCurrent ? 'not-allowed' : 'pointer'}; font-size: 0.75rem;">🔄 Resetar</button>
                    <button onclick="excluirUsuario(${u.id})" ${isCurrent ? 'disabled' : ''} style="background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; color: #ef4444; padding: 5px 10px; border-radius: 4px; cursor: ${isCurrent ? 'not-allowed' : 'pointer'}; font-size: 0.75rem; margin-left: 5px;">🗑️</button>
                </td>
            </tr>
        `}).join('');
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="5" style="color: #ef4444;">Erro ao carregar dados dos usuários.</td></tr>';
    }
}

window.adicionarUsuario = async function() {
    const nome = document.getElementById('novoUsername').value.trim().toUpperCase();
    if (!nome) return;

    const selectFilial = document.getElementById('novoUserFilial');
    const selectCargo = document.getElementById('novoUserCargo');

    if (!selectFilial || selectFilial.value === '') {
        alert('⚠️ Por favor, selecione a Filial a qual o usuário pertence.'); return;
    }
    
    if (!selectCargo || selectCargo.value === '') {
        alert('⚠️ Selecione a posição do usuário no Organograma (Cargo).'); return;
    }

    const filialSelecionada = selectFilial.value === 'CENTRAL' ? null : parseInt(selectFilial.value);
    
    const cargoOption = selectCargo.options[selectCargo.selectedIndex];
    const systemRole = cargoOption.getAttribute('data-role'); 
    const centroCustoId = cargoOption.getAttribute('data-cc');
    const cargoId = parseInt(selectCargo.value);

    if ((systemRole === 'Gerente' || systemRole === 'SuperAdmin') && (!window.currentUser || window.currentUser.role !== 'SuperAdmin')) {
        alert('⚠️ Acesso Negado: Somente o Administrador Global pode criar acessos neste nível hierárquico.');
        return;
    }

    if (listaUsuarios.some(u => u.username === nome)) { alert('⚠️ Este usuário já existe!'); return; }

    try {
        const novoUsuarioObj = { 
            username: nome, 
            senha_hash: "5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5",
            role: systemRole, 
            primeiro_acesso: true,
            filial_id: filialSelecionada,
            cargo_id: cargoId,          
            centro_custo_id: centroCustoId ? parseInt(centroCustoId) : null 
        };

        await db.addUsuario(novoUsuarioObj);
        document.getElementById('novoUsername').value = '';
        selectCargo.value = '';
        
        alert(`✅ Usuário ${nome} criado e integrado ao Organograma com sucesso!\nSenha provisória: 12345`);
        window.renderizarUsuarios();
    } catch(e) { 
        console.error(e);
        alert('❌ Erro ao registrar o usuário na estrutura corporativa. Verifique o console.'); 
    }
}

window.resetarSenhaUsuario = async function(id) {
    if(confirm(`Deseja resetar a senha deste usuário para "12345"?`)) {
        await db.updateUsuarioSenhaEReset(id, "5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5");
        alert(`Senha resetada com sucesso.`); 
        window.renderizarUsuarios();
    }
}

window.excluirUsuario = async function(id) {
    if(confirm(`🚨 ATENÇÃO: Deseja EXCLUIR permanentemente o acesso deste usuário e o desvincular do organograma?`)) {
        await db.deleteUsuario(id);
        alert('Usuário desvinculado e excluído.'); 
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

window.carregarPerfisPermissao = async function() {
    const selectPerfil = document.getElementById('selectPerfilPermissao');
    if (!selectPerfil) return; 

    try {
        let query = supabaseClient.from('cargos')
            .select('id, nome, filial_id, nivel_acesso')
            .eq('status', 'Ativo')
            .order('nome');

        if (window.currentUser && window.currentUser.role !== 'SuperAdmin') {
            const filialId = window.currentUser.filial_id;
            if (filialId !== null && filialId !== 'CENTRAL') {
                query = query.eq('filial_id', parseInt(filialId));
            } else {
                query = query.is('filial_id', null);
            }
        }

        const { data, error } = await query;
        if (error) throw error;

        let options = '<option value="" disabled selected>-- Selecione o Cargo --</option>';
        if (data && data.length > 0) {
            data.forEach(cargo => {
                options += `<option value="${cargo.id}" data-id="${cargo.id}" data-role="${cargo.nivel_acesso}">${cargo.nome}</option>`;
            });
        } else {
            options = '<option value="" disabled selected>Nenhum Cargo Cadastrado na sua Filial</option>';
        }
        selectPerfil.innerHTML = options;
        
    } catch (error) {
        console.error("Erro ao puxar cargos da Controladoria:", error);
        selectPerfil.innerHTML = '<option value="" disabled selected>Erro ao carregar Organograma</option>';
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    if (document.getElementById('selectPerfilPermissao')) {
        await window.carregarPerfisPermissao();
    }
});

// ==================== NOVAS FUNÇÕES: CONTROLE VISUAL E DE ACESSOS ====================

window.alternarAbaConfig = function(abaId, elementoClicado) {
    document.querySelectorAll('.config-menu-item').forEach(el => el.classList.remove('active'));
    if (elementoClicado) elementoClicado.classList.add('active');

    document.querySelectorAll('.config-tab-content').forEach(el => el.style.display = 'none');
    const tab = document.getElementById(abaId);
    if (tab) tab.style.display = 'block';
};

window.mudarTipoPermissao = function(tipo) {
    const selectCargo = document.getElementById('selectPerfilPermissao');
    const selectUser = document.getElementById('selectUsuarioPermissao');
    
    if (tipo === 'perfil') {
        if(selectCargo) selectCargo.style.display = 'block';
        if(selectUser) selectUser.style.display = 'none';
    } else {
        if(selectCargo) selectCargo.style.display = 'none';
        if(selectUser) selectUser.style.display = 'block';
        if(typeof window.carregarSelectUsuariosPermissoes === 'function') window.carregarSelectUsuariosPermissoes();
    }
    
    if(typeof window.carregarCheckboxesPermissoes === 'function') {
        window.carregarCheckboxesPermissoes();
    }
};

window.carregarSelectUsuariosPermissoes = async function() {
    const selectUser = document.getElementById('selectUsuarioPermissao');
    if (!selectUser) return;
    
    try {
        const todosUsuarios = await db.getUsuarios('TODAS');
        let options = '<option value="" disabled selected>-- Selecione o Usuário --</option>';
        
        if (todosUsuarios && todosUsuarios.length > 0) {
            todosUsuarios.forEach(u => {
                const userName = u.username || 'Desconhecido';
                const role = u.cargos ? u.cargos.nome : (u.role || 'Usuario');
                options += `<option value="user_${u.id}">${userName} (${role})</option>`;
            });
        } else {
            options = '<option value="" disabled selected>Nenhum usuário encontrado</option>';
        }
        selectUser.innerHTML = options;
    } catch (e) {
        console.error("Erro ao carregar usuários para permissões:", e);
        selectUser.innerHTML = '<option value="" disabled selected>Erro ao carregar</option>';
    }
};

window.salvarPermissoes = async function() {
    try {
        const tipo = document.querySelector('input[name="tipoPermissao"]:checked')?.value || 'perfil';
        let alvo = '';
        
        if (tipo === 'perfil') {
            alvo = document.getElementById('selectPerfilPermissao')?.value;
            if (!alvo) { alert('Selecione um cargo na lista primeiro.'); return; }
        } else {
            alvo = document.getElementById('selectUsuarioPermissao')?.value;
            if (!alvo) { alert('Selecione um usuário na lista primeiro.'); return; }
        }

        const checkboxes = document.querySelectorAll('.chk-permissao');
        const novasPermissoes = [];
        
        checkboxes.forEach(chk => {
            if (chk.checked) novasPermissoes.push(chk.value);
        });

        if (tipo === 'usuario' && novasPermissoes.length === 0) {
            if(confirm("Você deixou todas as caixas vazias.\nDeseja remover as regras específicas deste usuário para que ele volte a seguir o padrão do Cargo dele?")) {
                novasPermissoes.push('__RESET__');
            } else {
                return;
            }
        }

        if (typeof db.salvarPermissoesDB === 'function') {
            await db.salvarPermissoesDB(alvo, novasPermissoes);
        } else {
            alert("A função db.salvarPermissoesDB não foi encontrada no database.js.");
            return;
        }

        alert('✅ Permissões de menus salvas com sucesso!');
        
        if (typeof window.renderizarMenu === 'function') {
            window.renderizarMenu();
        }

    } catch (error) {
        console.error("Erro ao salvar permissões:", error);
        alert("❌ Ocorreu um erro ao tentar salvar as permissões.");
    }
};