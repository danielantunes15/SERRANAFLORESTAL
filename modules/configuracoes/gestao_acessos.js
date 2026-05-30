// ==================== MÓDULO: GESTÃO DE ACESSOS E MENUS ====================

window.carregarPerfisPermissao = async function() {
    const selectPerfil = document.getElementById('selectPerfilPermissao');
    if (!selectPerfil) return; 

    try {
        let query = supabaseClient.from('cargos')
            .select('id, nome, filial_id, nivel_acesso')
            .eq('status', 'Ativo')
            .order('nome');

        // Aplica os filtros hierárquicos por filial
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
        console.error("Erro ao puxar cargos da matriz:", error);
        selectPerfil.innerHTML = '<option value="" disabled selected>Erro ao carregar Organograma</option>';
    }
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

window.carregarCheckboxesPermissoes = async function() {
    // CORREÇÃO 1: Se a lista de cargos ainda estiver vazia quando a tela abrir, força o carregamento
    const selectPerfil = document.getElementById('selectPerfilPermissao');
    if (selectPerfil && selectPerfil.options.length <= 1) {
        await window.carregarPerfisPermissao();
    }

    const container = document.getElementById('container-permissoes-menus');
    if (!container || !window.MAPA_MENUS) return;

    if (!document.getElementById('css-permissoes-cards')) {
        const style = document.createElement('style');
        style.id = 'css-permissoes-cards';
        style.innerHTML = `
            .permissao-card { background: #1e293b; border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); display: flex; flex-direction: column; }
            .permissao-header { display:flex; align-items: center; gap: 10px; margin-bottom: 15px; color: #f8fafc; font-size: 1rem; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px; }
            .permissao-icon-box { width: 32px; height: 32px; border-radius: 8px; background: rgba(59, 130, 246, 0.1); display: flex; align-items: center; justify-content: center; color: #3b82f6; }
            .permissao-item { color: #cbd5e1; font-size: 0.85rem; display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 8px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.03); transition: all 0.2s; cursor: pointer; }
            .permissao-item:hover:not(.disabled-item) { background: rgba(255,255,255,0.06); border-color: rgba(59, 130, 246, 0.3); }
            .permissao-item.disabled-item { opacity: 0.4; cursor: not-allowed; }
            .permissao-item input[type="checkbox"] { width: 18px; height: 18px; accent-color: #3b82f6; cursor: inherit; }
            .permissao-item-icon { background: rgba(15, 23, 42, 0.5); width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 0.8rem; }
        `;
        document.head.appendChild(style);
    }

    const tipo = document.querySelector('input[name="tipoPermissao"]:checked')?.value || 'perfil';
    let alvo = '';
    
    if (tipo === 'perfil') {
        alvo = selectPerfil?.value;
    } else {
        alvo = document.getElementById('selectUsuarioPermissao')?.value;
    }

    let permissoesAtuais = {};
    if (typeof db !== 'undefined' && typeof db.getPermissoesDB === 'function') {
        permissoesAtuais = await db.getPermissoesDB();
    } else if (typeof window.getPermissoes === 'function') {
        permissoesAtuais = window.getPermissoes();
    }
    
    let meusAcessos = alvo ? (permissoesAtuais[alvo] || []) : [];
    const isSuperAdmin = (currentUser && currentUser.role === 'SuperAdmin');

    if (alvo && tipo === 'usuario' && (!permissoesAtuais[alvo] || meusAcessos.includes('__RESET__'))) {
        const selectUser = document.getElementById('selectUsuarioPermissao');
        const textoOpcao = selectUser.options[selectUser.selectedIndex].text;
        const matchRole = textoOpcao.match(/\((.*?)\)/);
        const roleDesteUser = matchRole ? matchRole[1] : null;
        
        if (roleDesteUser && permissoesAtuais[roleDesteUser]) {
            meusAcessos = permissoesAtuais[roleDesteUser];
        } else {
            meusAcessos = [];
        }
    }

    let html = '';

    // Aviso quando nada foi selecionado
    if (!alvo) {
        html += `
        <div style="grid-column: 1 / -1; background: rgba(59, 130, 246, 0.1); color: var(--ccol-blue-bright); padding: 15px 20px; border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3); margin-bottom: 10px; display: flex; align-items: center; gap: 15px;">
            <i class="fas fa-info-circle" style="font-size: 1.5rem;"></i>
            <div>
                <strong style="display: block; font-size: 1.05rem; margin-bottom: 3px;">Selecione um Cargo ou Usuário Acima</strong>
                <span style="font-size: 0.9rem; color: #cbd5e1;">Abaixo estão todos os módulos disponíveis no sistema. Para liberar ou bloquear acessos, você precisa primeiro selecionar quem receberá as permissões.</span>
            </div>
        </div>`;
    }

    const setores = [...new Set(window.MAPA_MENUS.map(m => m.setor))];

    setores.forEach(setor => {
        // CORREÇÃO 2: Removida a trava "|| setor === 'Configurações'". Agora ele renderiza os módulos de configuração também.
        if (setor === 'Global') return; 

        html += `
        <div class="permissao-card">
            <div class="permissao-header">
                <div class="permissao-icon-box"><i class="${window.getIconSetor(setor)}"></i></div>
                ${setor}
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px; flex: 1;">`;
        
        window.MAPA_MENUS.filter(m => m.setor === setor).forEach(menu => {
            const checked = meusAcessos.includes(menu.id) ? 'checked' : '';
            
            // Regras de Bloqueio (Desabilita a caixinha)
            const disabledLogic = (!alvo || (menu.setor === 'Gerencial' && !isSuperAdmin));
            const disabled = disabledLogic ? 'disabled' : '';
            const disabledClass = disabled ? 'disabled-item' : '';
            
            let extraInfo = '';
            if (!alvo) {
                extraInfo = ' title="Selecione um Cargo/Usuário primeiro para editar os acessos"';
            } else if (menu.setor === 'Gerencial' && !isSuperAdmin) {
                extraInfo = ' title="Apenas o Administrador Global pode alterar este acesso"';
            }

            html += `
                <label class="permissao-item ${disabledClass}" ${extraInfo}>
                    <input type="checkbox" class="chk-permissao" value="${menu.id}" ${checked} ${disabled}>
                    <div class="permissao-item-icon">
                        <i class="${menu.icon}"></i>
                    </div>
                    <span style="flex: 1; font-weight: 500;">${menu.label}</span>
                </label>`;
        });

        html += `</div></div>`;
    });

    container.innerHTML = html;
};

window.salvarPermissoes = async function() {
    try {
        const tipo = document.querySelector('input[name="tipoPermissao"]:checked')?.value || 'perfil';
        let alvo = '';
        
        if (tipo === 'perfil') {
            alvo = document.getElementById('selectPerfilPermissao')?.value;
            if (!alvo) { alert('⚠️ Selecione um cargo na lista primeiro.'); return; }
        } else {
            alvo = document.getElementById('selectUsuarioPermissao')?.value;
            if (!alvo) { alert('⚠️ Selecione um usuário na lista primeiro.'); return; }
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

        if (typeof db.updatePermissoesDB === 'function') {
            await db.updatePermissoesDB(alvo, novasPermissoes);
        } else {
            alert("A função db.updatePermissoesDB não foi encontrada no database.js.");
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