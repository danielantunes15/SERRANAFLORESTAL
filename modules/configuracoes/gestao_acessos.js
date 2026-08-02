// ==================== MÓDULO: GESTÃO DE ACESSOS E MENUS ====================

window.mudarFilialContexto = async function() {
    const selectFilialContexto = document.getElementById('selectFilialContextoPermissao');
    if (!selectFilialContexto || !selectFilialContexto.value) return;

    window.filialContextoPermissao = selectFilialContexto.value;

    // Habilita os selects de cargo e usuário após a escolha
    document.getElementById('selectPerfilPermissao').disabled = false;
    document.getElementById('selectUsuarioPermissao').disabled = false;

    // Limpa a matriz visual para não exibir permissões antigas
    document.getElementById('container-permissoes-menus').innerHTML = '';

    // Recarrega as listas baseado na nova filial selecionada
    await window.carregarPerfisPermissao();
    await window.carregarSelectUsuariosPermissoes();
    window.carregarCheckboxesPermissoes();
};

window.carregarPerfisPermissao = async function() {
    const selectPerfil = document.getElementById('selectPerfilPermissao');
    if (!selectPerfil) return; 

    let filialId = window.filialContextoPermissao;
    if (filialId === undefined) {
         selectPerfil.innerHTML = '<option value="" disabled selected>-- Aguardando Filial --</option>';
         return;
    }

    try {
        let query = supabaseClient.from('cargos')
            .select('id, nome, filial_id, nivel_acesso')
            .eq('status', 'Ativo')
            .order('nome');

        if (filialId !== null && filialId !== 'CENTRAL') {
            query = query.eq('filial_id', parseInt(filialId));
        } else {
            query = query.is('filial_id', null);
        }

        const { data, error } = await query;
        if (error) throw error;

        let options = '<option value="" disabled selected>-- Selecione o Cargo --</option>';
        if (data && data.length > 0) {
            const cargosAgrupados = {};
            data.forEach(cargo => {
                if (!cargosAgrupados[cargo.nome]) {
                    cargosAgrupados[cargo.nome] = { ids: [], role: cargo.nivel_acesso };
                }
                cargosAgrupados[cargo.nome].ids.push(cargo.id);
            });

            for (const [nome, info] of Object.entries(cargosAgrupados)) {
                const idsAgrupados = info.ids.join(',');
                options += `<option value="${idsAgrupados}" data-role="${info.role}">${nome}</option>`;
            }
        } else {
            options = '<option value="" disabled selected>Nenhum Cargo Encontrado nesta Filial</option>';
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
    
    if(typeof window.carregarCheckboxesPermissoes === 'function') window.carregarCheckboxesPermissoes();
};

window.carregarSelectUsuariosPermissoes = async function() {
    const selectUser = document.getElementById('selectUsuarioPermissao');
    if (!selectUser) return;
    
    let filialId = window.filialContextoPermissao;
    if (filialId === undefined) {
         selectUser.innerHTML = '<option value="" disabled selected>-- Aguardando Filial --</option>';
         return;
    }

    try {
        const todosUsuarios = await db.getUsuarios('TODAS');
        let usuariosFiltrados = [];
        
        if (filialId !== null && filialId !== 'CENTRAL') {
            usuariosFiltrados = todosUsuarios.filter(u => u.filial_id == filialId);
        } else {
            usuariosFiltrados = todosUsuarios.filter(u => u.filial_id === null);
        }

        if (window.currentUser && window.currentUser.role !== 'SuperAdmin') {
            usuariosFiltrados = usuariosFiltrados.filter(u => {
                const isTargetSuperAdmin = (u.role === 'SuperAdmin' || (u.cargos && u.cargos.nivel_acesso === 'SuperAdmin'));
                return !isTargetSuperAdmin;
            });
        }

        let options = '<option value="" disabled selected>-- Selecione o Usuário --</option>';
        
        if (usuariosFiltrados && usuariosFiltrados.length > 0) {
            usuariosFiltrados.forEach(u => {
                const userName = u.username || 'Desconhecido';
                const roleNome = u.cargos ? u.cargos.nome : (u.role || 'Usuario');
                const cargoIdAttr = u.cargo_id ? `data-cargoid="${u.cargo_id}"` : '';
                options += `<option value="user_${u.id}" ${cargoIdAttr}>${userName} (${roleNome})</option>`;
            });
        } else {
            options = '<option value="" disabled selected>Nenhum usuário encontrado</option>';
        }
        selectUser.innerHTML = options;
    } catch (e) {
        console.error("Erro ao carregar usuários:", e);
        selectUser.innerHTML = '<option value="" disabled selected>Erro ao carregar</option>';
    }
};

window.carregarCheckboxesPermissoes = async function() {
    const selectFilialContexto = document.getElementById('selectFilialContextoPermissao');
    const containerFilial = document.getElementById('container-filial-permissao');
    const selectPerfil = document.getElementById('selectPerfilPermissao');
    const selectUsuario = document.getElementById('selectUsuarioPermissao');

    const isSuperOuMatriz4 = (window.currentUser && (window.currentUser.role === 'SuperAdmin' || window.currentUser.filial_id == 4));

    // 1. INICIALIZAÇÃO DINÂMICA: Intercepta o primeiro carregamento feito pelo menu.js
    if (containerFilial && selectFilialContexto && selectFilialContexto.options.length <= 1) {
        if (isSuperOuMatriz4) {
            containerFilial.style.display = 'block';
            try {
                const filiais = await db.getTodasFiliaisAdmin();
                let options = '<option value="" disabled selected>-- Selecione a Filial --</option>';
                options += '<option value="CENTRAL">ADMINISTRAÇÃO (Corporativo / Global)</option>';
                if (filiais && filiais.length > 0) {
                    filiais.forEach(f => { options += `<option value="${f.id}">${f.nome}</option>`; });
                }
                selectFilialContexto.innerHTML = options;
            } catch (e) { console.error("Erro ao carregar filiais:", e); }
            
            // Exibe aviso para forçar a escolha da filial
            document.getElementById('container-permissoes-menus').innerHTML = `
                <div style="grid-column: 1 / -1; background: rgba(59, 130, 246, 0.1); color: var(--ccol-blue-bright); padding: 15px 20px; border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3);">
                    <i class="fas fa-info-circle"></i> <strong>Selecione uma filial no topo da tela para configurar os acessos.</strong>
                </div>`;
            return; // Pausa a renderização até a filial ser selecionada
        } else {
            // Usuário comum (ID normal não 4): define o contexto e carrega direto
            containerFilial.style.display = 'none';
            window.filialContextoPermissao = window.currentUser.filial_id === null ? 'CENTRAL' : window.currentUser.filial_id;
            if(selectPerfil) selectPerfil.disabled = false;
            if(selectUsuario) selectUsuario.disabled = false;
            
            await window.carregarPerfisPermissao();
            await window.carregarSelectUsuariosPermissoes();
        }
    }

    // 2. Impede continuar se for Admin ou Filial 4 e ainda não tiver selecionado
    if (isSuperOuMatriz4 && (!selectFilialContexto || !selectFilialContexto.value)) {
        return;
    }

    // 3. Renderização normal das caixinhas
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
    
    if (tipo === 'perfil') alvo = selectPerfil?.value;
    else alvo = selectUsuario?.value;

    let permissoesAtuais = {};
    if (typeof db !== 'undefined' && typeof db.getPermissoesDB === 'function') {
        permissoesAtuais = await db.getPermissoesDB();
    } else if (typeof window.getPermissoes === 'function') {
        permissoesAtuais = window.getPermissoes();
    }
    
    let meusAcessos = [];
    if (alvo) {
        if (tipo === 'perfil') {
            const idRepresentante = alvo.split(',')[0];
            meusAcessos = permissoesAtuais[idRepresentante] || [];
        } else {
            meusAcessos = permissoesAtuais[alvo] || [];
            if (!permissoesAtuais[alvo] || meusAcessos.includes('__RESET__')) {
                const userOption = selectUsuario.options[selectUsuario.selectedIndex];
                const cargoIdUser = userOption.getAttribute('data-cargoid');
                
                if (cargoIdUser && permissoesAtuais[cargoIdUser]) {
                    meusAcessos = permissoesAtuais[cargoIdUser];
                } else {
                    const matchRole = userOption.text.match(/\((.*?)\)/);
                    const roleNome = matchRole ? matchRole[1] : null;
                    meusAcessos = permissoesAtuais[roleNome] || [];
                }
            }
        }
    }

    const isSuperAdmin = (window.currentUser && window.currentUser.role === 'SuperAdmin');
    let html = '';

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
            if (tipo === 'perfil') {
                const idsParaAtualizar = alvo.split(',');
                for (const id of idsParaAtualizar) {
                    await db.updatePermissoesDB(id, novasPermissoes);
                }
            } else {
                await db.updatePermissoesDB(alvo, novasPermissoes);
            }
        } else {
            alert("A função db.updatePermissoesDB não foi encontrada no database.js.");
            return;
        }

        alert('✅ Permissões salvas e sincronizadas com sucesso!');
        
        if (typeof window.renderizarMenu === 'function') {
            window.renderizarMenu();
        }

    } catch (error) {
        console.error("Erro ao salvar permissões:", error);
        alert("❌ Ocorreu um erro ao tentar salvar as permissões.");
    }
};