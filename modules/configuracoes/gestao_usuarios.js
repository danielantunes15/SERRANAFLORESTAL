// ==================== MÓDULO: GESTÃO DE USUÁRIOS ====================

let listaUsuarios = [];

window.carregarFiliaisFormulario = async function() {
    const selectFilial = document.getElementById('novoUserFilial');
    if (!selectFilial) return;

    if (window.currentUser && window.currentUser.role === 'SuperAdmin') {
        try {
            const filiais = await db.getTodasFiliaisAdmin();
            let options = '<option value="" disabled selected>-- Selecione a Filial --</option>';
            options += '<option value="CENTRAL">ADMINISTRAÇÃO (Corporativo / Global)</option>';
            if (filiais && filiais.length > 0) {
                filiais.forEach(f => { options += `<option value="${f.id}">${f.nome}</option>`; });
            }
            selectFilial.innerHTML = options;
            selectFilial.disabled = false;
        } catch (e) {
            console.error("Erro ao listar filiais:", e);
            selectFilial.innerHTML = '<option value="" disabled selected>Erro ao carregar</option>';
        }
    } else if (window.currentUser) {
        const fValue = window.currentUser.filial_id === null ? 'CENTRAL' : window.currentUser.filial_id;
        selectFilial.innerHTML = `<option value="${fValue}" selected>Minha Filial Base</option>`;
        selectFilial.disabled = true;
        window.carregarCargosParaFilial(fValue);
    }
};

window.carregarCargosParaFilial = async function(filialId) {
    const selectCargo = document.getElementById('novoUserCargo');
    if (!selectCargo || !filialId) return;

    selectCargo.innerHTML = '<option value="">Carregando Cargos...</option>';
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
        
        let options = '<option value="" disabled selected>-- Selecione o Cargo --</option>';
        if (data && data.length > 0) {
            data.forEach(c => {
                const ccAttr = c.centro_custo_id ? c.centro_custo_id : '';
                options += `<option value="${c.id}" data-role="${c.nivel_acesso}" data-cc="${ccAttr}">${c.nome} (${c.nivel_hierarquico})</option>`;
            });
        } else {
            options = '<option value="" disabled selected>Nenhum Cargo Cadastrado</option>';
        }
        selectCargo.innerHTML = options;
    } catch(e) {
        console.error("Erro ao puxar cargos da filial:", e);
        selectCargo.innerHTML = '<option value="" disabled selected>Erro ao carregar Organograma</option>';
    }
};

window.renderizarUsuarios = async function() {
    const tbody = document.getElementById('tabelaUsuarios');
    if (!tbody) return;

    await window.carregarFiliaisFormulario();
    if (typeof window.carregarPerfisPermissao === 'function') await window.carregarPerfisPermissao();

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
                ? `<span style="background: rgba(251, 146, 60, 0.1); color: var(--ccol-rust-bright); padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; border: 1px solid var(--ccol-rust-bright);">Pendente (1º Acesso)</span>`
                : `<span style="background: rgba(61, 220, 132, 0.1); color: var(--ccol-green-bright); padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; border: 1px solid var(--ccol-green-bright);">Ativo</span>`;
            
            const filialNome = u.filial_id === null ? '<span style="color:#fde047; font-weight:bold;">Corporativo / Global</span>' : (u.filiais ? u.filiais.nome : `Filial ID: ${u.filial_id}`);
            
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
                    <button onclick="window.abrirModalEdicaoUsuario(${u.id})" style="background: rgba(59, 130, 246, 0.1); border: 1px solid #3b82f6; color: #3b82f6; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; margin-right: 5px;" title="Editar informações ou aplicar promoção">✏️ Editar</button>
                    <button onclick="window.resetarSenhaUsuario(${u.id})" ${isCurrent ? 'disabled' : ''} style="background: rgba(255,255,255,0.05); border: 1px solid #fde047; color: #fde047; padding: 5px 10px; border-radius: 4px; cursor: ${isCurrent ? 'not-allowed' : 'pointer'}; font-size: 0.75rem;" title="Voltar a senha para 12345">🔄 Resetar</button>
                    <button onclick="window.excluirUsuario(${u.id})" ${isCurrent ? 'disabled' : ''} style="background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; color: #ef4444; padding: 5px 10px; border-radius: 4px; cursor: ${isCurrent ? 'not-allowed' : 'pointer'}; font-size: 0.75rem; margin-left: 5px;" title="Excluir Permanentemente">🗑️</button>
                </td>
            </tr>
        `}).join('');
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="5" style="color: #ef4444;">Erro ao carregar dados dos usuários.</td></tr>';
    }
};

window.adicionarUsuario = async function() {
    const nome = document.getElementById('novoUsername').value.trim().toUpperCase();
    if (!nome) { alert('⚠️ Preencha o nome do usuário.'); return; }

    const selectFilial = document.getElementById('novoUserFilial');
    const selectCargo = document.getElementById('novoUserCargo');

    if (!selectFilial || selectFilial.value === '') {
        alert('⚠️ Por favor, selecione a Filial a qual o usuário belongs.'); return;
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
};

window.resetarSenhaUsuario = async function(id) {
    if(confirm(`Deseja resetar a senha deste usuário para "12345"? Ele precisará criar uma nova senha ao logar.`)) {
        await db.updateUsuarioSenhaEReset(id, "5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5");
        alert(`Senha resetada com sucesso.`); 
        window.renderizarUsuarios();
    }
};

window.excluirUsuario = async function(id) {
    if(confirm(`🚨 ATENÇÃO: Deseja EXCLUIR permanentemente o acesso deste usuário e o desvincular do organograma?`)) {
        await db.deleteUsuario(id);
        alert('Usuário desvinculado e excluído com sucesso.'); 
        window.renderizarUsuarios();
    }
};

// ==================== LÓGICAS DO MODAL DE EDIÇÃO E PROMOÇÕES ====================

window.abrirModalEdicaoUsuario = async function(id) {
    const u = listaUsuarios.find(user => user.id === id);
    if (!u) return;

    document.getElementById('editUserId').value = u.id;
    document.getElementById('editUsername').value = u.username;

    const selectFilial = document.getElementById('editUserFilial');
    if (!selectFilial) return;

    // Popula as filiais permitidas no modal baseado em quem está editando
    if (window.currentUser && window.currentUser.role === 'SuperAdmin') {
        try {
            const filiais = await db.getTodasFiliaisAdmin();
            let options = '<option value="" disabled>-- Selecione a Filial --</option>';
            options += '<option value="CENTRAL">ADMINISTRAÇÃO (Corporativo / Global)</option>';
            if (filiais && filiais.length > 0) {
                filiais.forEach(f => { options += `<option value="${f.id}">${f.nome}</option>`; });
            }
            selectFilial.innerHTML = options;
            selectFilial.disabled = false;
        } catch (e) {
            console.error("Erro ao listar filiais no modal de edição:", e);
        }
    } else {
        const fValue = window.currentUser.filial_id === null ? 'CENTRAL' : window.currentUser.filial_id;
        selectFilial.innerHTML = `<option value="${fValue}">Minha Filial Base</option>`;
        selectFilial.disabled = true;
    }

    const userFilialValue = u.filial_id === null ? 'CENTRAL' : u.filial_id.toString();
    selectFilial.value = userFilialValue;

    // Carrega os cargos e marca o cargo atual dele selecionado
    await window.carregarCargosParaFilialEdicao(userFilialValue, u.cargo_id);

    document.getElementById('modalEdicaoUsuario').style.display = 'flex';
};

window.fecharModalEdicaoUsuario = function() {
    document.getElementById('modalEdicaoUsuario').style.display = 'none';
};

window.carregarCargosParaFilialEdicao = async function(filialId, cargoIdSelecionado = null) {
    const selectCargo = document.getElementById('editUserCargo');
    if (!selectCargo || !filialId) return;

    selectCargo.innerHTML = '<option value="">Carregando Cargos...</option>';
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
        
        let options = '<option value="" disabled selected>-- Selecione o Cargo --</option>';
        if (data && data.length > 0) {
            data.forEach(c => {
                const ccAttr = c.centro_custo_id ? c.centro_custo_id : '';
                options += `<option value="${c.id}" data-role="${c.nivel_acesso}" data-cc="${ccAttr}">${c.nome} (${c.nivel_hierarquico})</option>`;
            });
        } else {
            options = '<option value="" disabled selected>Nenhum Cargo Configurado</option>';
        }
        selectCargo.innerHTML = options;

        if (cargoIdSelecionado) {
            selectCargo.value = cargoIdSelecionado;
        }
    } catch(e) {
        console.error("Erro ao puxar cargos da filial no modal de edição:", e);
        selectCargo.innerHTML = '<option value="" disabled selected>Erro ao carregar Organograma</option>';
    }
};

window.salvarEdicaoUsuario = async function() {
    const id = parseInt(document.getElementById('editUserId').value);
    const nome = document.getElementById('editUsername').value.trim().toUpperCase();
    const selectFilial = document.getElementById('editUserFilial');
    const selectCargo = document.getElementById('editUserCargo');

    if (!nome) { alert('⚠️ Preencha o nome do usuário.'); return; }
    if (!selectFilial || selectFilial.value === '') { alert('⚠️ Selecione a Filial de Atuação.'); return; }
    if (!selectCargo || selectCargo.value === '') { alert('⚠️ Selecione a nova Função/Cargo.'); return; }

    const filialSelecionada = selectFilial.value === 'CENTRAL' ? null : parseInt(selectFilial.value);
    const cargoOption = selectCargo.options[selectCargo.selectedIndex];
    const systemRole = cargoOption.getAttribute('data-role'); 
    const centroCustoId = cargoOption.getAttribute('data-cc');
    const cargoId = parseInt(selectCargo.value);

    // Validação de segurança de hierarquia
    if ((systemRole === 'Gerente' || systemRole === 'SuperAdmin') && (!window.currentUser || window.currentUser.role !== 'SuperAdmin')) {
        alert('⚠️ Acesso Negado: Apenas Administradores Globais podem promover ou conceder acessos para cargos deste nível.');
        return;
    }

    try {
        const { error } = await supabaseClient.from('usuarios').update({
            username: nome,
            filial_id: filialSelecionada,
            cargo_id: cargoId,
            role: systemRole,
            centro_custo_id: centroCustoId ? parseInt(centroCustoId) : null
        }).eq('id', id);

        if (error) throw error;

        alert('✅ Cadastro do funcionário atualizado e readequado no organograma com sucesso!');
        window.fecharModalEdicaoUsuario();
        window.renderizarUsuarios();
        
        // Alerta caso o usuário alterado seja ele mesmo
        if (window.currentUser && window.currentUser.id === id) {
            alert('ℹ️ Você editou seu próprio registro. Recomendamos fazer logout e login novamente para aplicar a nova árvore de permissões.');
        }
    } catch (e) {
        console.error("Erro ao salvar edição do usuário no Supabase:", e);
        alert('❌ Ocorreu um erro ao tentar salvar as modificações no banco de dados.');
    }
};