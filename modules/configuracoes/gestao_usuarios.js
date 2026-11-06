// ==================== MÓDULO: GESTÃO DE USUÁRIOS ====================

let listaUsuarios = [];

// Reconhece o Administrador Global independente do nome do cargo
window.isUsuarioGlobal = function() {
    if (!window.currentUser) return false;
    return (window.currentUser.role === 'SuperAdmin' || window.currentUser.filial_id === null || window.currentUser.is_global_session === true);
};

// Função global de segurança para checar se a ação é permitida
window.verificarPermissaoAcao = function(targetUser) {
    if (!window.currentUser) return false;
    // Administrador Global pode tudo
    if (window.isUsuarioGlobal()) return true;
    
    // Trava 1: Ninguém mexe no SuperAdmin, exceto ele mesmo
    const isTargetSuperAdmin = (targetUser.role === 'SuperAdmin' || (targetUser.cargos && targetUser.cargos.nivel_acesso === 'SuperAdmin'));
    if (isTargetSuperAdmin) {
        alert('⚠️ Acesso Negado: Apenas um Administrador Global pode modificar outro Administrador.');
        return false;
    }
    
    // Trava 2: Bloqueio de Filial e Matriz
    if (targetUser.filial_id != window.currentUser.filial_id) {
        alert('⚠️ Acesso Negado: Você não tem permissão para alterar usuários de outras filiais ou da Matriz Global.');
        return false;
    }
    
    return true;
};

window.carregarFiliaisFormulario = async function() {
    const selectFilial = document.getElementById('novoUserFilial');
    if (!selectFilial) return;

    let filiaisBanco = [];
    try {
        if (typeof db !== 'undefined' && typeof db.getTodasFiliaisAdmin === 'function') {
            filiaisBanco = await db.getTodasFiliaisAdmin();
        }
    } catch (e) {
        console.error("Erro ao listar filiais:", e);
    }

    if (window.isUsuarioGlobal()) {
        let options = '<option value="" disabled selected>-- Selecione a Filial --</option>';
        options += '<option value="CENTRAL">ADMINISTRAÇÃO (Corporativo / Global)</option>';
        if (filiaisBanco && filiaisBanco.length > 0) {
            filiaisBanco.forEach(f => { options += `<option value="${f.id}">${f.nome}</option>`; });
        }
        selectFilial.innerHTML = options;
        selectFilial.disabled = false;
    } else if (window.currentUser) {
        const fValue = window.currentUser.filial_id === null ? 'CENTRAL' : window.currentUser.filial_id;
        
        let nomeFilial = 'Minha Filial Base';
        if (filiaisBanco && filiaisBanco.length > 0) {
            const filialEncontrada = filiaisBanco.find(f => f.id == fValue);
            if (filialEncontrada) nomeFilial = filialEncontrada.nome;
        } else if (window.currentUser.filiais && window.currentUser.filiais.nome) {
            nomeFilial = window.currentUser.filiais.nome;
        } else {
            nomeFilial = `Filial ${fValue}`;
        }

        selectFilial.innerHTML = `<option value="${fValue}" selected>${nomeFilial}</option>`;
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

// Busca Inteligente na Tabela
window.filtrarUsuariosTabela = function(termo) {
    termo = termo.toLowerCase().trim();
    const tbody = document.getElementById('tabelaUsuarios');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr.user-row');
    let hasVisibleUser = false;

    rows.forEach(row => {
        const textContent = row.innerText.toLowerCase();
        if (textContent.includes(termo)) {
            row.style.display = '';
            hasVisibleUser = true;
        } else {
            row.style.display = 'none';
        }
    });

    // Trata os cabeçalhos de grupos (Filiais)
    const groupHeaders = tbody.querySelectorAll('tr.group-header');
    groupHeaders.forEach(header => {
        let nextSibling = header.nextElementSibling;
        let showHeader = false;

        while (nextSibling && !nextSibling.classList.contains('group-header')) {
            if (nextSibling.classList.contains('user-row') && nextSibling.style.display !== 'none') {
                showHeader = true;
                break;
            }
            nextSibling = nextSibling.nextElementSibling;
        }
        header.style.display = showHeader ? '' : 'none';
    });
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
        
        let filiaisBanco = [];
        try {
            if (typeof db !== 'undefined' && typeof db.getTodasFiliaisAdmin === 'function') {
                filiaisBanco = await db.getTodasFiliaisAdmin();
            }
        } catch (e) { console.error("Erro ao carregar filiais banco", e); }

        const filtroContainer = document.getElementById('filtroFilialContainer');
        const filtroSelect = document.getElementById('filtroUsuariosFilial');
        
        if (window.isUsuarioGlobal() && filtroContainer && filtroSelect) {
            filtroContainer.style.display = 'flex';
            if (filtroSelect.options.length <= 2 && filiaisBanco.length > 0) {
                filiaisBanco.forEach(f => {
                    filtroSelect.innerHTML += `<option value="${f.id}">${f.nome}</option>`;
                });
            }
        }
        
        if (!window.isUsuarioGlobal()) {
            const filialAtiva = window.currentUser.filial_id;
            
            if (filialAtiva !== null && filialAtiva !== 'CENTRAL') {
                listaUsuarios = todosUsuarios.filter(u => u.filial_id == filialAtiva);
            } else {
                listaUsuarios = todosUsuarios.filter(u => u.filial_id === null);
            }

            listaUsuarios = listaUsuarios.filter(u => {
                const isTargetSuperAdmin = (u.role === 'SuperAdmin' || (u.cargos && u.cargos.nivel_acesso === 'SuperAdmin'));
                return !isTargetSuperAdmin;
            });

        } else {
            listaUsuarios = todosUsuarios; 
            
            if (filtroSelect && filtroSelect.value !== 'TODAS') {
                const fVal = filtroSelect.value === 'CENTRAL' ? null : parseInt(filtroSelect.value);
                listaUsuarios = listaUsuarios.filter(u => u.filial_id === fVal);
            }
        }

        if (listaUsuarios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 30px; color: var(--text-secondary);">Nenhum usuário encontrado para o filtro atual.</td></tr>'; return;
        }

        // ORDENAÇÃO ALFABÉTICA
        listaUsuarios.sort((a, b) => {
            const nomeA = (a.nome_completo || a.username || '').toLowerCase();
            const nomeB = (b.nome_completo || b.username || '').toLowerCase();
            return nomeA.localeCompare(nomeB);
        });

        const filiaisMap = new Map();
        filiaisMap.set('CENTRAL', { nome: 'Matriz Corporativa', items: [] });
        
        if (filiaisBanco && filiaisBanco.length > 0) {
            filiaisBanco.forEach(f => {
                filiaisMap.set(Number(f.id), { nome: f.nome, items: [] });
            });
        }

        listaUsuarios.forEach(u => {
            const fKey = u.filial_id === null ? 'CENTRAL' : Number(u.filial_id);
            if (!filiaisMap.has(fKey)) {
                const fallbackNome = (u.filiais && u.filiais.nome) ? u.filiais.nome : `Filial ID: ${fKey}`;
                filiaisMap.set(fKey, { nome: fallbackNome, items: [] });
            }
            filiaisMap.get(fKey).items.push(u);
        });

        let htmlFinal = '';

        filiaisMap.forEach((group, fKey) => {
            if (group.items.length === 0) return;
            
            htmlFinal += `
                <tr class="group-header" style="background: rgba(15, 23, 42, 0.9); border-bottom: 2px solid #3b82f6;">
                    <td colspan="5" style="padding: 12px 20px; text-align: left; font-weight: 700; color: #38bdf8; font-size: 1rem; letter-spacing: 0.5px; border-top: 15px solid transparent; background-clip: padding-box;">
                        <i class="fas fa-building" style="margin-right: 8px;"></i> ${group.nome}
                    </td>
                </tr>
            `;

            group.items.forEach(u => {
                const isCurrent = u.id === window.currentUser.id;
                const amISuperAdmin = window.isUsuarioGlobal();
                
                const lockedByBranch = !amISuperAdmin && (u.filial_id != window.currentUser.filial_id);
                const isLocked = isCurrent || lockedByBranch;

                const isAtivo = u.status !== 'Inativo';
                
                let statusBadge = '';
                if (!isAtivo) {
                    statusBadge = `<span style="background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 5px 8px; border-radius: 6px; font-size: 0.75rem; border: 1px solid rgba(239, 68, 68, 0.3); font-weight: 500;">Inativo</span>`;
                } else if (u.primeiro_acesso) {
                    statusBadge = `<span style="background: rgba(245, 158, 11, 0.1); color: #f59e0b; padding: 5px 8px; border-radius: 6px; font-size: 0.75rem; border: 1px solid rgba(245, 158, 11, 0.3); font-weight: 500;">1º Acesso</span>`;
                } else {
                    statusBadge = `<span style="background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 5px 8px; border-radius: 6px; font-size: 0.75rem; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 500;">Ativo</span>`;
                }
                
                const filialNome = u.filial_id === null ? '<span style="color:#fde047; font-weight:500;">Corporativo</span>' : group.nome;
                
                const nomeDoCargo = (u.cargo_id && mapaCargos[u.cargo_id]) 
                    ? mapaCargos[u.cargo_id] 
                    : (u.cargos ? u.cargos.nome : (u.role || 'Sem Cargo'));
                
                let botoesAcao = '';
                if (isLocked) {
                    botoesAcao = `
                        <button disabled style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); color: rgba(255,255,255,0.2); width: 32px; height: 32px; border-radius: 6px; cursor: not-allowed; font-size: 0.85rem;" title="Acesso bloqueado"><i class="fas fa-lock"></i></button>
                    `;
                } else {
                    const btnStatus = isAtivo 
                        ? `<button onclick="window.alternarStatusUsuario(${u.id}, 'Inativo')" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; transition: all 0.2s;" title="Inativar Usuário" onmouseover="this.style.background='rgba(239, 68, 68, 0.2)'" onmouseout="this.style.background='rgba(239, 68, 68, 0.1)'"><i class="fas fa-ban"></i></button>`
                        : `<button onclick="window.alternarStatusUsuario(${u.id}, 'Ativo')" style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: #10b981; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; transition: all 0.2s;" title="Reativar Usuário" onmouseover="this.style.background='rgba(16, 185, 129, 0.2)'" onmouseout="this.style.background='rgba(16, 185, 129, 0.1)'"><i class="fas fa-check"></i></button>`;

                    botoesAcao = `
                        <div style="display: flex; gap: 6px; justify-content: flex-end; padding-right: 20px;">
                            <button onclick="window.abrirModalEdicaoUsuario(${u.id})" style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); color: #3b82f6; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; transition: all 0.2s;" title="Editar informações do colaborador" onmouseover="this.style.background='rgba(59, 130, 246, 0.2)'" onmouseout="this.style.background='rgba(59, 130, 246, 0.1)'"><i class="fas fa-edit"></i></button>
                            
                            <button onclick="window.resetarSenhaUsuario(${u.id})" style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); color: #f59e0b; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; transition: all 0.2s;" title="Resetar senha para 12345" onmouseover="this.style.background='rgba(245, 158, 11, 0.2)'" onmouseout="this.style.background='rgba(245, 158, 11, 0.1)'"><i class="fas fa-key"></i></button>
                            
                            ${btnStatus}
                            
                            <button onclick="window.excluirUsuario(${u.id})" style="background: rgba(239, 68, 68, 0.05); border: 1px solid transparent; color: #ef4444; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; transition: all 0.2s; margin-left: 5px;" title="Excluir Permanentemente" onmouseover="this.style.background='rgba(239, 68, 68, 0.2)'; this.style.borderColor='rgba(239, 68, 68, 0.3)';" onmouseout="this.style.background='rgba(239, 68, 68, 0.05)'; this.style.borderColor='transparent';"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    `;
                }

                // A MÁGICA DO ALINHAMENTO ESTÁ NESTA PRIMEIRA <td>
                htmlFinal += `
                <tr class="user-row" style="border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.2s;">
                    <td style="padding: 12px 20px; text-align: left;">
                        <div style="font-weight: 600; color: #f8fafc; font-size: 0.95rem; margin-bottom: 4px;">
                            ${u.nome_completo || '<span style="color:#94a3b8;font-style:italic;">Sem Nome Cadastrado</span>'} 
                            ${isCurrent ? '<span style="color:var(--ccol-blue-bright); font-size:0.75rem; margin-left:5px;">(Você)</span>' : ''}
                        </div>
                        <div style="font-size: 0.75rem; color: var(--ccol-blue-bright); display: flex; align-items: center; justify-content: flex-start; gap: 5px;">
                            <i class="fas fa-user-circle"></i> ${u.username}
                        </div>
                    </td>
                    <td style="text-align: center;"><span style="font-size: 0.8rem; background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 20px; color: #cbd5e1; border: 1px solid rgba(255,255,255,0.1);">${nomeDoCargo}</span></td>
                    <td style="font-size: 0.8rem; color: #94a3b8; text-align: center;">${filialNome}</td>
                    <td style="text-align: center;">${statusBadge}</td>
                    <td style="text-align: right;">${botoesAcao}</td>
                </tr>`;
            });
        });

        tbody.innerHTML = htmlFinal;

        // Limpa a busca ao re-renderizar para evitar bugs visuais
        const inputBusca = document.getElementById('buscaUsuario');
        if (inputBusca) inputBusca.value = '';

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #ef4444;">Erro ao carregar dados dos usuários.</td></tr>';
    }
};

window.adicionarUsuario = async function() {
    const nomeCompleto = document.getElementById('novoNomeCompleto').value.trim().toUpperCase();
    const nome = document.getElementById('novoUsername').value.trim().toUpperCase();

    if (!nomeCompleto) { alert('⚠️ Preencha o nome completo do colaborador.'); return; }
    if (!nome) { alert('⚠️ Preencha o nome de usuário (username).'); return; }

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

    if ((systemRole === 'Gerente' || systemRole === 'SuperAdmin') && !window.isUsuarioGlobal()) {
        alert('⚠️ Acesso Negado: Somente o Administrador Global pode criar acessos neste nível hierárquico.');
        return;
    }

    if (listaUsuarios.some(u => u.username === nome)) { alert('⚠️ Este usuário já existe!'); return; }

    try {
        const novoUsuarioObj = { 
            nome_completo: nomeCompleto,
            username: nome, 
            senha_hash: "5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5", 
            role: systemRole, 
            primeiro_acesso: true,
            filial_id: filialSelecionada,
            cargo_id: cargoId,          
            centro_custo_id: centroCustoId ? parseInt(centroCustoId) : null,
            status: 'Ativo'
        };

        await db.addUsuario(novoUsuarioObj);
        
        if (typeof window.registrarLogAuditoria === 'function') {
            window.registrarLogAuditoria('Gestão de Usuários', 'Criação de Usuário', `Novo usuário de sistema cadastrado: ${nomeCompleto} (${nome}) (Permissão Base: ${systemRole})`);
        }

        document.getElementById('novoNomeCompleto').value = '';
        document.getElementById('novoUsername').value = '';
        selectCargo.value = '';
        
        alert(`✅ Usuário ${nomeCompleto} criado e integrado ao Organograma com sucesso!\nSenha provisória: 12345`);
        window.renderizarUsuarios();
    } catch(e) { 
        console.error(e);
        alert('❌ Erro ao registrar o usuário na estrutura corporativa. Verifique o console.'); 
    }
};

window.resetarSenhaUsuario = async function(id) {
    const u = listaUsuarios.find(user => user.id === id);
    if (!u || !window.verificarPermissaoAcao(u)) return;

    if(confirm(`Deseja resetar a senha deste usuário para "12345"? Ele precisará criar uma nova senha ao logar.`)) {
        await db.updateUsuarioSenhaEReset(id, "5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5");
        
        if (typeof window.registrarLogAuditoria === 'function') {
            window.registrarLogAuditoria('Gestão de Usuários', 'Edição de Segurança', `Senha do usuário ${u.username} foi resetada para a senha padrão.`);
        }

        alert(`Senha resetada com sucesso.`); 
        window.renderizarUsuarios();
    }
};

window.excluirUsuario = async function(id) {
    const u = listaUsuarios.find(user => user.id === id);
    if (!u || !window.verificarPermissaoAcao(u)) return;

    if(confirm(`🚨 ATENÇÃO: Deseja EXCLUIR permanentemente o acesso deste usuário e o desvincular do organograma?`)) {
        await db.deleteUsuario(id);
        
        if (typeof window.registrarLogAuditoria === 'function') {
            window.registrarLogAuditoria('Gestão de Usuários', 'Exclusão de Usuário', `O usuário ${u.username} foi excluído permanentemente do sistema.`);
        }

        alert('Usuário desvinculado e excluído com sucesso.'); 
        window.renderizarUsuarios();
    }
};

window.abrirModalEdicaoUsuario = async function(id) {
    const u = listaUsuarios.find(user => user.id === id);
    if (!u || !window.verificarPermissaoAcao(u)) return;

    document.getElementById('editUserId').value = u.id;
    document.getElementById('editNomeCompleto').value = u.nome_completo || '';
    document.getElementById('editUsername').value = u.username;

    const selectFilial = document.getElementById('editUserFilial');
    if (!selectFilial) return;

    if (window.isUsuarioGlobal()) {
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
        
        let nomeFilial = 'Minha Filial Base';
        if (u.filiais && u.filiais.nome) {
            nomeFilial = u.filiais.nome;
        } else if (window.currentUser.filiais && window.currentUser.filiais.nome) {
            nomeFilial = window.currentUser.filiais.nome;
        } else {
            nomeFilial = `Filial ${fValue}`;
        }

        selectFilial.innerHTML = `<option value="${fValue}">${nomeFilial}</option>`;
        selectFilial.disabled = true;
    }

    const userFilialValue = u.filial_id === null ? 'CENTRAL' : u.filial_id.toString();
    selectFilial.value = userFilialValue;

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
    const nomeCompleto = document.getElementById('editNomeCompleto').value.trim().toUpperCase();
    const nome = document.getElementById('editUsername').value.trim().toUpperCase();
    const selectFilial = document.getElementById('editUserFilial');
    const selectCargo = document.getElementById('editUserCargo');

    if (!nomeCompleto) { alert('⚠️ Preencha o nome completo.'); return; }
    if (!nome) { alert('⚠️ Preencha o nome do usuário (username).'); return; }
    if (!selectFilial || selectFilial.value === '') { alert('⚠️ Selecione a Filial de Atuação.'); return; }
    if (!selectCargo || selectCargo.value === '') { alert('⚠️ Selecione a nova Função/Cargo.'); return; }

    const filialSelecionada = selectFilial.value === 'CENTRAL' ? null : parseInt(selectFilial.value);
    const cargoOption = selectCargo.options[selectCargo.selectedIndex];
    const systemRole = cargoOption.getAttribute('data-role'); 
    const centroCustoId = cargoOption.getAttribute('data-cc');
    const cargoId = parseInt(selectCargo.value);
    const cargoNome = cargoOption.text;

    if ((systemRole === 'Gerente' || systemRole === 'SuperAdmin') && !window.isUsuarioGlobal()) {
        alert('⚠️ Acesso Negado: Apenas Administradores Globais podem promover ou conceder acessos para cargos deste nível.');
        return;
    }

    try {
        const { error } = await supabaseClient.from('usuarios').update({
            nome_completo: nomeCompleto,
            username: nome,
            filial_id: filialSelecionada,
            cargo_id: cargoId,
            role: systemRole,
            centro_custo_id: centroCustoId ? parseInt(centroCustoId) : null
        }).eq('id', id);

        if (error) throw error;

        if (typeof window.registrarLogAuditoria === 'function') {
            window.registrarLogAuditoria('Gestão de Usuários', 'Edição de Usuário', `Dados e permissões atualizadas para o usuário: ${nomeCompleto} (${nome}) (Novo cargo: ${cargoNome})`);
        }

        alert('✅ Cadastro do funcionário atualizado e readequado no organograma com sucesso!');
        window.fecharModalEdicaoUsuario();
        window.renderizarUsuarios();
        
    } catch (e) {
        console.error("Erro ao salvar edição do usuário no Supabase:", e);
        alert('❌ Ocorreu um erro ao tentar salvar as modificações no banco de dados.');
    }
};

window.alternarStatusUsuario = async function(id, novoStatus) {
    const u = listaUsuarios.find(user => user.id === id);
    if (!u || !window.verificarPermissaoAcao(u)) return;

    const acaoTexto = novoStatus === 'Inativo' ? 'INATIVAR' : 'ATIVAR';
    if(confirm(`Deseja realmente ${acaoTexto} o acesso do usuário ${u.username}?`)) {
        try {
            await db.updateUsuarioStatus(id, novoStatus);
            
            if (typeof window.registrarLogAuditoria === 'function') {
                window.registrarLogAuditoria('Gestão de Usuários', 'Edição de Segurança', `O status do usuário ${u.username} foi alterado para ${novoStatus}.`);
            }

            alert(`✅ Status do usuário alterado para ${novoStatus} com sucesso.`); 
            window.renderizarUsuarios();
        } catch(e) {
            console.error("Erro ao alterar status do usuário:", e);
            alert("❌ Ocorreu um erro ao tentar alterar o status no banco de dados.");
        }
    }
};