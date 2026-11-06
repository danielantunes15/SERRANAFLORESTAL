// ==================== MÓDULO: GESTÃO DE ACESSOS E MENUS (AVANÇADO) ====================

// Reconhece o Administrador Global independente do nome do cargo
window.isUsuarioGlobalAcessos = function() {
    if (!window.currentUser) return false;
    return (window.currentUser.role === 'SuperAdmin' || window.currentUser.filial_id === null || window.currentUser.is_global_session === true);
};

// -------------------------------------------------------------
// FUNÇÕES DE FEEDBACK E INTERATIVIDADE VISUAL (Auto-save visual)
// -------------------------------------------------------------
window.mudancasNaoSalvas = false;

window.registrarMudancaAcesso = function() {
    window.mudancasNaoSalvas = true;
    document.getElementById('salvar-feedback').style.opacity = '1';
    
    const btnSalvar = document.getElementById('btnSalvarPermissoes');
    btnSalvar.style.backgroundColor = '#10b981'; // Verde indicando ação necessária
    btnSalvar.style.borderColor = '#10b981';
    btnSalvar.style.boxShadow = '0 0 15px rgba(16, 185, 129, 0.4)';
    btnSalvar.innerHTML = '<i class="fas fa-save"></i> Salvar Modificações';
};

window.resetarFeedbackSalvar = function() {
    window.mudancasNaoSalvas = false;
    const fb = document.getElementById('salvar-feedback');
    if(fb) fb.style.opacity = '0';
    
    const btnSalvar = document.getElementById('btnSalvarPermissoes');
    if(btnSalvar) {
        btnSalvar.style.backgroundColor = ''; // Volta ao padrão do CSS (btn-primary-blue)
        btnSalvar.style.borderColor = '';
        btnSalvar.style.boxShadow = 'none';
        btnSalvar.innerHTML = '<i class="fas fa-save"></i> Salvar Matriz de Permissões';
    }
};

window.mudarFilialContexto = async function() {
    const selectFilialContexto = document.getElementById('selectFilialContextoPermissao');
    if (!selectFilialContexto || !selectFilialContexto.value) return;
    window.filialContextoPermissao = selectFilialContexto.value;
    
    document.getElementById('selectPerfilPermissao').disabled = false;
    document.getElementById('selectUsuarioPermissao').disabled = false;
    document.getElementById('container-permissoes-menus').innerHTML = '';
    
    await window.carregarPerfisPermissao();
    await window.carregarSelectUsuariosPermissoes();
    
    window.resetarFeedbackSalvar();
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

// -------------------------------------------------------------
// ALTERAÇÃO DO SEGMENTED CONTROL E TIPOS DE PERMISSÃO
// -------------------------------------------------------------
window.mudarTipoPermissao = function(tipo) {
    const selectCargo = document.getElementById('selectPerfilPermissao');
    const selectUser = document.getElementById('selectUsuarioPermissao');
    
    // UI Feedback no Segmented Control
    document.querySelectorAll('.segment-label').forEach(lbl => {
        const r = lbl.querySelector('input');
        if(r.checked) {
            lbl.style.color = '#fff';
        } else {
            lbl.style.color = '#94a3b8';
        }
    });

    if (tipo === 'perfil') {
        if(selectCargo) selectCargo.style.display = 'block';
        if(selectUser) selectUser.style.display = 'none';
    } else {
        if(selectCargo) selectCargo.style.display = 'none';
        if(selectUser) selectUser.style.display = 'block';
        if(typeof window.carregarSelectUsuariosPermissoes === 'function') window.carregarSelectUsuariosPermissoes();
    }
    
    window.resetarFeedbackSalvar();
    
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

        if (!window.isUsuarioGlobalAcessos()) {
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

// -------------------------------------------------------------
// RENDERIZAÇÃO DA MATRIZ, INDICADORES E CHECKBOX MASTER
// -------------------------------------------------------------
window.carregarCheckboxesPermissoes = async function() {
    const selectFilialContexto = document.getElementById('selectFilialContextoPermissao');
    const containerFilial = document.getElementById('container-filial-permissao');
    const selectPerfil = document.getElementById('selectPerfilPermissao');
    const selectUsuario = document.getElementById('selectUsuarioPermissao');
    const inputBusca = document.getElementById('buscaPermissoes');
    if(inputBusca) inputBusca.value = ''; // Reseta a busca ao mudar context

    const isSuperOuMatriz4 = (window.currentUser && (window.isUsuarioGlobalAcessos() || window.currentUser.filial_id == 4));

    if (containerFilial && selectFilialContexto && !selectFilialContexto.dataset.inicializado) {
        selectFilialContexto.dataset.inicializado = "true"; 

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
            
            document.getElementById('container-permissoes-menus').innerHTML = `
                <div style="grid-column: 1 / -1; background: rgba(59, 130, 246, 0.1); color: var(--ccol-blue-bright); padding: 15px 20px; border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3);">
                    <i class="fas fa-info-circle"></i> <strong>Selecione uma filial no topo da tela para configurar os acessos.</strong>
                </div>`;
            return; 
        } else {
            containerFilial.style.display = 'none';
            window.filialContextoPermissao = window.currentUser.filial_id === null ? 'CENTRAL' : window.currentUser.filial_id;
            if(selectPerfil) selectPerfil.disabled = false;
            if(selectUsuario) selectUsuario.disabled = false;
            
            await window.carregarPerfisPermissao();
            await window.carregarSelectUsuariosPermissoes();
        }
    }

    if (isSuperOuMatriz4 && (!selectFilialContexto || !selectFilialContexto.value)) {
        return;
    }

    const container = document.getElementById('container-permissoes-menus');
    if (!container || !window.MAPA_MENUS) return;

    if (!document.getElementById('css-permissoes-cards')) {
        const style = document.createElement('style');
        style.id = 'css-permissoes-cards';
        style.innerHTML = `
            .permissao-card { background: #1e293b; border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); display: flex; flex-direction: column; }
            .permissao-header { display:flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 15px; color: #f8fafc; font-size: 1rem; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px; }
            .permissao-icon-box { width: 32px; height: 32px; border-radius: 8px; background: rgba(59, 130, 246, 0.1); display: flex; align-items: center; justify-content: center; color: #3b82f6; margin-right: 10px; }
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

    // Lógica para o Botão "Restaurar Herança"
    const btnRestaurar = document.getElementById('btnRestaurarHeranca');
    if(btnRestaurar) {
        btnRestaurar.style.display = (tipo === 'usuario' && alvo) ? 'flex' : 'none';
    }

    let permissoesAtuais = {};
    if (typeof db !== 'undefined' && typeof db.getPermissoesDB === 'function') {
        permissoesAtuais = await db.getPermissoesDB();
    } else if (typeof window.getPermissoes === 'function') {
        permissoesAtuais = window.getPermissoes();
    }
    
    let meusAcessos = [];
    let baseRoleAcessos = [];
    let isUserMode = (tipo === 'usuario');

    if (alvo) {
        if (!isUserMode) {
            const idRepresentante = alvo.split(',')[0];
            meusAcessos = permissoesAtuais[idRepresentante] || [];
        } else {
            // Se for usuário, puxa as permissões do cargo dele (Herança)
            const userOption = selectUsuario.options[selectUsuario.selectedIndex];
            const cargoIdUser = userOption.getAttribute('data-cargoid');
            const matchRole = userOption.text.match(/\((.*?)\)/);
            const roleNome = matchRole ? matchRole[1] : null;

            if (cargoIdUser && permissoesAtuais[cargoIdUser]) {
                baseRoleAcessos = permissoesAtuais[cargoIdUser];
            } else {
                baseRoleAcessos = permissoesAtuais[roleNome] || [];
            }
            
            // Se as permissões do usuário estiverem vazias ou com reset, ele herda tudo visualmente
            if (!permissoesAtuais[alvo] || permissoesAtuais[alvo].includes('__RESET__')) {
                meusAcessos = [...baseRoleAcessos]; 
            } else {
                meusAcessos = permissoesAtuais[alvo]; // Regras específicas
            }
        }
    }

    const isSuperAdmin = window.isUsuarioGlobalAcessos();

    let html = '';
    if (!alvo) {
        html += `
        <div style="grid-column: 1 / -1; background: rgba(59, 130, 246, 0.1); color: var(--ccol-blue-bright); padding: 15px 20px; border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3); margin-bottom: 10px; display: flex; align-items: center; gap: 15px;">
            <i class="fas fa-info-circle" style="font-size: 1.5rem;"></i>
            <div>
                <strong style="display: block; font-size: 1.05rem; margin-bottom: 3px;">Selecione um Cargo ou Usuário Acima</strong>
                <span style="font-size: 0.9rem; color: #cbd5e1;">Para liberar ou bloquear acessos, você precisa primeiro selecionar quem receberá as permissões.</span>
            </div>
        </div>`;
    }

    const setores = [...new Set(window.MAPA_MENUS.map(m => m.setor))];

    setores.forEach((setor, index) => {
        if (setor === 'Global') return; 

        // Adiciona um checkbox master no header
        const masterDisabled = (!alvo) ? 'disabled' : '';
        
        html += `
        <div class="permissao-card" id="card-setor-${index}">
            <div class="permissao-header">
                <div style="display: flex; align-items: center;">
                    <div class="permissao-icon-box"><i class="${window.getIconSetor(setor)}"></i></div>
                    ${setor}
                </div>
                <input type="checkbox" class="chk-master" title="Marcar/Desmarcar tudo deste setor" ${masterDisabled} onclick="window.toggleTodosCard(${index}, this)">
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px; flex: 1;">`;
        
        window.MAPA_MENUS.filter(m => m.setor === setor).forEach(menu => {
            const isChecked = meusAcessos.includes(menu.id);
            const checkedAttr = isChecked ? 'checked' : '';
            
            const disabledLogic = (!alvo || (menu.setor === 'Gerencial' && !isSuperAdmin));
            const disabled = disabledLogic ? 'disabled' : '';
            const disabledClass = disabled ? 'disabled-item' : '';
            
            let extraInfo = '';
            let badgeHtml = '';

            // Lógica de Indicação de Herança (Visual)
            if (isUserMode && alvo) {
                const isOnBaseRole = baseRoleAcessos.includes(menu.id);
                const temRegraEspecifica = permissoesAtuais[alvo] && !permissoesAtuais[alvo].includes('__RESET__');
                
                if (temRegraEspecifica) {
                    if (isChecked && !isOnBaseRole) {
                        badgeHtml = `<span class="badge-excecao" title="Permissão concedida como exceção a este usuário"><i class="fas fa-plus"></i> Exceção</span>`;
                    } else if (!isChecked && isOnBaseRole) {
                        // Foi removido (Não colocamos badge pq ele está desmarcado, fica óbvio)
                    }
                } else {
                    if (isChecked) {
                        badgeHtml = `<span class="badge-herdado" title="Permissão herdada automaticamente do cargo"><i class="fas fa-link"></i> Herdado</span>`;
                    }
                }
            }

            if (!alvo) {
                extraInfo = ' title="Selecione um Cargo/Usuário primeiro"';
            } else if (menu.setor === 'Gerencial' && !isSuperAdmin) {
                extraInfo = ' title="Apenas o Administrador Global pode alterar este acesso"';
            }

            html += `
                <label class="permissao-item ${disabledClass}" ${extraInfo}>
                    <input type="checkbox" class="chk-permissao" value="${menu.id}" ${checkedAttr} ${disabled} onchange="window.registrarMudancaAcesso(); window.atualizarHighlightCards();">
                    <div class="permissao-item-icon">
                        <i class="${menu.icon}"></i>
                    </div>
                    <span style="flex: 1; font-weight: 500;">${menu.label}</span>
                    ${badgeHtml}
                </label>`;
        });

        html += `</div></div>`;
    });

    container.innerHTML = html;
    
    // Chama para acender/apagar os cards baseados no load inicial
    window.atualizarHighlightCards();
};

// -------------------------------------------------------------
// FILTRO DE BUSCA (REAL-TIME)
// -------------------------------------------------------------
window.filtrarPermissoes = function(termo) {
    termo = termo.toLowerCase().trim();
    const cards = document.querySelectorAll('.permissao-card');
    
    cards.forEach(card => {
        let hasVisibleItem = false;
        
        // Verifica também se o nome do setor bate com a busca
        const tituloSetor = card.querySelector('.permissao-header').innerText.toLowerCase();
        
        card.querySelectorAll('.permissao-item').forEach(item => {
            const text = item.innerText.toLowerCase();
            if (text.includes(termo) || tituloSetor.includes(termo)) {
                item.style.display = 'flex';
                hasVisibleItem = true;
            } else {
                item.style.display = 'none';
            }
        });
        
        card.style.display = hasVisibleItem ? 'flex' : 'none';
    });
};

// -------------------------------------------------------------
// SELEÇÃO EM MASSA E DESTAQUE DOS CARDS
// -------------------------------------------------------------
window.toggleTodosCard = function(setorIndex, btnMaster) {
    const card = document.getElementById(`card-setor-${setorIndex}`);
    if(!card) return;
    
    const checks = card.querySelectorAll('.chk-permissao:not([disabled])');
    const isChecked = btnMaster.checked;
    
    checks.forEach(chk => {
        if(chk.style.display !== 'none' && chk.parentElement.style.display !== 'none') {
            chk.checked = isChecked;
        }
    });
    
    window.registrarMudancaAcesso();
    window.atualizarHighlightCards();
};

window.atualizarHighlightCards = function() {
    document.querySelectorAll('.permissao-card').forEach(card => {
        const checks = Array.from(card.querySelectorAll('.chk-permissao'));
        const hasChecked = checks.some(c => c.checked);
        
        if(hasChecked) {
            card.classList.add('card-active');
        } else {
            card.classList.remove('card-active');
        }
        
        // Sincroniza visualmente o Checkbox Master
        const masterCheck = card.querySelector('.chk-master');
        if(masterCheck) {
            const allEnabled = checks.filter(c => !c.disabled);
            if(allEnabled.length > 0) {
                masterCheck.checked = allEnabled.every(c => c.checked);
            } else {
                masterCheck.checked = false;
            }
        }
    });
};

// -------------------------------------------------------------
// SALVAMENTO E RESTAURAÇÃO NO BANCO DE DADOS
// -------------------------------------------------------------
window.restaurarHeranca = async function() {
    const alvo = document.getElementById('selectUsuarioPermissao')?.value;
    if(!alvo) return;
    
    if(confirm("Deseja apagar as permissões customizadas e fazer este usuário voltar a herdar os acessos originais do cargo?")) {
        try {
            await db.updatePermissoesDB(alvo, ['__RESET__']);
            if (window.permissoesGlobais) window.permissoesGlobais[alvo] = ['__RESET__'];
            
            alert("✅ Herança restaurada com sucesso. O usuário voltou a seguir o padrão do cargo.");
            window.resetarFeedbackSalvar();
            window.carregarCheckboxesPermissoes();
        } catch(e) {
            console.error("Erro ao resetar herança:", e);
            alert("❌ Ocorreu um erro.");
        }
    }
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
            if(confirm("Você deixou todas as caixas vazias.\nDeseja remover as regras específicas deste usuário para que ele volte a herdar o padrão do Cargo dele?")) {
                novasPermissoes.push('__RESET__');
            } else {
                return;
            }
        }

        if (typeof db.updatePermissoesDB === 'function') {
            if (tipo === 'perfil') {
                const selectPerfil = document.getElementById('selectPerfilPermissao');
                const cargoOption = selectPerfil.options[selectPerfil.selectedIndex];
                const roleString = cargoOption.getAttribute('data-role');
                
                const idsParaAtualizar = alvo.split(',');
                for (const id of idsParaAtualizar) {
                    await db.updatePermissoesDB(id, novasPermissoes);
                    if (window.permissoesGlobais) window.permissoesGlobais[id] = novasPermissoes;
                }
                
                // Fallback Corretivo: Para usuários antigos criados antes dos IDs
                if (roleString) {
                    await db.updatePermissoesDB(roleString, novasPermissoes);
                    if (window.permissoesGlobais) window.permissoesGlobais[roleString] = novasPermissoes;
                }

            } else {
                await db.updatePermissoesDB(alvo, novasPermissoes);
                if (window.permissoesGlobais) window.permissoesGlobais[alvo] = novasPermissoes;
            }
        } else {
            alert("A função db.updatePermissoesDB não foi encontrada no database.js.");
            return;
        }

        alert('✅ Permissões salvas e sincronizadas com sucesso!');
        window.resetarFeedbackSalvar();
        window.carregarCheckboxesPermissoes(); // recarrega pra ajustar as badges visuais
        
        if (typeof window.renderizarMenu === 'function') {
            window.renderizarMenu();
        }
    } catch (error) {
        console.error("Erro ao salvar permissões:", error);
        alert("❌ Ocorreu um erro ao tentar salvar as permissões.");
    }
};