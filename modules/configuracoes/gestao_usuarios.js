// ==================== MÓDULO: GESTÃO DE USUÁRIOS (INTEGRADO AO RH + WHATSAPP + MULTI-FILIAL SUPERADMIN) ====================

let listaUsuarios = [];
let cacheFiliaisSistema = [];
let cachePermissoesFiliais = {};
let cacheColaboradoresRH = [];
let filiaisExtrasSelecionadasEdicao = [];

// ==================== UTILITÁRIOS DE NORMALIZAÇÃO E USERNAME ====================
window.normalizarNomeComparacao = function(texto) {
    if (!texto) return '';
    return String(texto)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .replace(/\s+/g, ' ')
        .toUpperCase();
};

window.gerarUsernamePrimeiroUltimo = function(nomeCompleto) {
    const limpo = window.normalizarNomeComparacao(nomeCompleto).replace(/[^A-Z\s]/g, '');
    if (!limpo) return '';
    const partes = limpo.split(' ').filter(Boolean);
    if (partes.length === 1) return partes[0];
    return `${partes[0]}.${partes[partes.length - 1]}`;
};

window.obterSaudacaoHorario = function() {
    const hora = new Date().getHours();
    if (hora < 12) return 'Bom dia';
    if (hora < 18) return 'Boa tarde';
    return 'Boa noite';
};

// Reconhece o Administrador Global
window.isUsuarioGlobal = function() {
    if (!window.currentUser) return false;
    return (window.currentUser.role === 'SuperAdmin' || window.currentUser.filial_id === null || window.currentUser.is_global_session === true);
};

// Trava estrita: Verifica se o usuário logado é EXCLUSIVAMENTE SuperAdmin
window.isEstritamenteSuperAdmin = function() {
    if (!window.currentUser) return false;
    return (
        window.currentUser.role === 'SuperAdmin' ||
        window.currentUser.filial_base_id === null ||
        (window.currentUser.filial_id === null && window.currentUser.is_global_session === true)
    );
};

// ==================== INTEGRAÇÃO COM COLABORADORES DO RH ====================
window.carregarColaboradoresRHParaUsuarios = async function() {
    try {
        if (!window.supabaseClient) return [];
        const { data, error } = await supabaseClient
            .from('rh_colaboradores')
            .select('id, nome, status, filial_id, funcao, telefone, data_desligamento')
            .order('nome', { ascending: true });

        if (error) throw error;
        cacheColaboradoresRH = data || [];
        return cacheColaboradoresRH;
    } catch (e) {
        console.error("Erro ao carregar colaboradores do RH:", e);
        cacheColaboradoresRH = [];
        return [];
    }
};

window.encontrarColaboradorRHDoUsuario = function(userObj) {
    if (!userObj || !cacheColaboradoresRH || cacheColaboradoresRH.length === 0) return null;
    const nomeNorm = window.normalizarNomeComparacao(userObj.nome_completo);
    if (!nomeNorm) return null;

    // Prioriza o colaborador da mesma filial; se não achar, busca pelo nome normalizado geral
    let colab = cacheColaboradoresRH.find(c =>
        window.normalizarNomeComparacao(c.nome) === nomeNorm &&
        (userObj.filial_id === null || String(c.filial_id) === String(userObj.filial_id))
    );
    if (!colab) {
        colab = cacheColaboradoresRH.find(c => window.normalizarNomeComparacao(c.nome) === nomeNorm);
    }
    return colab || null;
};

window.sincronizarInativosComRH = async function(todosUsuarios) {
    if (!todosUsuarios || todosUsuarios.length === 0 || !cacheColaboradoresRH || cacheColaboradoresRH.length === 0) return 0;

    let totalInativadosAgora = 0;

    for (const u of todosUsuarios) {
        // Nunca inativa SuperAdmin ou o próprio usuário logado
        const isTargetSuperAdmin = (u.role === 'SuperAdmin' || (u.cargos && u.cargos.nivel_acesso === 'SuperAdmin'));
        if (isTargetSuperAdmin || (window.currentUser && u.id === window.currentUser.id)) continue;

        const colabRH = window.encontrarColaboradorRHDoUsuario(u);
        if (!colabRH) continue;

        const colabInativoNoRH = (colabRH.status === 'Inativo' || colabRH.status === 'Desligado');
        if (colabInativoNoRH && u.status !== 'Inativo') {
            try {
                await db.updateUsuarioStatus(u.id, 'Inativo');
                u.status = 'Inativo';
                totalInativadosAgora++;

                if (typeof window.registrarLogAuditoria === 'function') {
                    window.registrarLogAuditoria(
                        'Gestão de Usuários',
                        'Inativação Automática (RH)',
                        `Usuário ${u.username} (${u.nome_completo}) inativado automaticamente porque o colaborador consta como ${colabRH.status} no RH.`
                    );
                }
            } catch (errSync) {
                console.error(`Erro ao inativar automaticamente ${u.username}:`, errSync);
            }
        }
    }

    const avisoSync = document.getElementById('avisoSincronizacaoRH');
    if (avisoSync) {
        avisoSync.style.display = 'inline-flex';
        if (totalInativadosAgora > 0) {
            avisoSync.style.color = '#f59e0b';
            avisoSync.innerHTML = `<i class="fas fa-sync-alt"></i> ${totalInativadosAgora} acesso(s) inativado(s) automaticamente pelo RH`;
        } else {
            avisoSync.style.color = '#10b981';
            avisoSync.innerHTML = `<i class="fas fa-check-circle"></i> Sincronizado com o RH`;
        }
    }

    return totalInativadosAgora;
};

window.popularSelectColaboradoresRH = function(filialId) {
    const selColab = document.getElementById('selectColaboradorRH');
    if (!selColab) return;

    if (!filialId) {
        selColab.innerHTML = '<option value="">-- Selecione a Filial primeiro --</option>';
        return;
    }

    // Filtra apenas colaboradores Ativos da filial selecionada (ou todos ativos se CENTRAL)
    let ativos = (cacheColaboradoresRH || []).filter(c => c.status === 'Ativo' || !c.status);

    if (filialId !== 'CENTRAL') {
        ativos = ativos.filter(c => String(c.filial_id) === String(filialId));
    }

    // Remove da lista quem já tem usuário cadastrado (comparando nome normalizado)
    const nomesJaComUsuario = new Set(
        (listaUsuarios || []).map(u => window.normalizarNomeComparacao(u.nome_completo))
    );

    const disponiveis = ativos.filter(c => !nomesJaComUsuario.has(window.normalizarNomeComparacao(c.nome)));

    if (disponiveis.length === 0) {
        selColab.innerHTML = '<option value="">Nenhum colaborador ativo sem usuário nesta filial</option>';
        return;
    }

    let options = `<option value="">-- Clique para escolher um colaborador ativo (${disponiveis.length} disponíveis) --</option>`;
    disponiveis.forEach(c => {
        const cargoTxt = c.funcao ? ` — ${c.funcao}` : '';
        options += `<option value="${c.id}">${c.nome}${cargoTxt}</option>`;
    });

    selColab.innerHTML = options;
};

window.aoMudarFilialNovoUsuario = function(filialValue) {
    window.carregarCargosParaFilial(filialValue);
    window.atualizarCheckboxesFiliaisExtrasNovo();
    window.popularSelectColaboradoresRH(filialValue);
};

window.selecionarColaboradorRHParaUsuario = function(colabId) {
    if (!colabId) return;
    const colab = (cacheColaboradoresRH || []).find(c => String(c.id) === String(colabId));
    if (!colab) return;

    const inputNome = document.getElementById('novoNomeCompleto');
    const inputUser = document.getElementById('novoUsername');
    const selectCargo = document.getElementById('novoUserCargo');

    if (inputNome) inputNome.value = (colab.nome || '').toUpperCase();
    if (inputUser) inputUser.value = window.gerarUsernamePrimeiroUltimo(colab.nome);

    // Preenche automaticamente o Cargo / Função Corporativa se existir na lista da filial
    if (selectCargo && colab.funcao) {
        const funcaoNorm = window.normalizarNomeComparacao(colab.funcao);
        const opcoes = Array.from(selectCargo.options);
        const match = opcoes.find(opt => {
            if (!opt.value) return false;
            const nomeCargoOpt = opt.getAttribute('data-nome') || opt.textContent.split('(')[0];
            return window.normalizarNomeComparacao(nomeCargoOpt) === funcaoNorm;
        });

        if (match) {
            selectCargo.value = match.value;
        }
    }
};

window.limparSelecaoColaboradorRH = function() {
    const sel = document.getElementById('selectColaboradorRH');
    const inputNome = document.getElementById('novoNomeCompleto');
    const inputUser = document.getElementById('novoUsername');
    const selectCargo = document.getElementById('novoUserCargo');
    if (sel) sel.value = '';
    if (inputNome) inputNome.value = '';
    if (inputUser) inputUser.value = '';
    if (selectCargo) selectCargo.value = '';
};

window.sugerirUsernameAoDigitar = function(valor) {
    const inputUser = document.getElementById('novoUsername');
    if (!inputUser) return;
    inputUser.value = window.gerarUsernamePrimeiroUltimo(valor);
};

// ==================== WHATSAPP: MENSAGEM PRONTA ====================
window.abrirModalWhatsAppUsuario = function(username, nomeCompleto = '', telefone = '', isReset = false) {
    const saudacao = window.obterSaudacaoHorario();
    const primeiroNome = nomeCompleto ? String(nomeCompleto).trim().split(' ')[0] : '';
    const saudacaoCompleta = primeiroNome
        ? `${saudacao} ${primeiroNome.charAt(0).toUpperCase() + primeiroNome.slice(1).toLowerCase()}, tudo bem?`
        : `${saudacao}, tudo bem?`;

    const intro = isReset
        ? 'Estou enviando os seus novos dados de acesso (senha resetada) para o SGC - Sistema de Gestão Corporativo:'
        : 'Estou enviando os seus dados para acessar o SGC - Sistema de Gestão Corporativo:';

    const mensagem =
`${saudacaoCompleta}

${intro}

Link de acesso: https://serranaflorestal.com

Usuário: ${username}
Senha provisória: 12345

Assim que você fizer o primeiro login, o sistema pedirá para você alterar essa senha padrão para uma nova da sua escolha.

Me avise se tiver algum problema para acessar!`;

    const elTel = document.getElementById('wppTelefoneDestino');
    const elTxt = document.getElementById('wppTextoMensagem');
    if (elTel) elTel.value = telefone || '';
    if (elTxt) elTxt.value = mensagem;

    const modal = document.getElementById('modalMensagemWhatsApp');
    if (modal) modal.style.display = 'flex';
};

window.abrirWhatsAppPorIdUsuario = function(userId) {
    const u = listaUsuarios.find(item => item.id === userId);
    if (!u) return;
    const colabRH = window.encontrarColaboradorRHDoUsuario(u);
    const telefone = colabRH && colabRH.telefone ? colabRH.telefone : '';
    window.abrirModalWhatsAppUsuario(u.username, u.nome_completo || '', telefone, false);
};

window.fecharModalWhatsAppUsuario = function() {
    const modal = document.getElementById('modalMensagemWhatsApp');
    if (modal) modal.style.display = 'none';
};

window.copiarMensagemWhatsApp = async function() {
    const elTxt = document.getElementById('wppTextoMensagem');
    if (!elTxt) return;

    try {
        await navigator.clipboard.writeText(elTxt.value);
        const btn = document.getElementById('btnCopiarTextoWpp');
        if (btn) {
            const original = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> Copiado!';
            setTimeout(() => { btn.innerHTML = original; }, 2000);
        }
    } catch (e) {
        elTxt.select();
        document.execCommand('copy');
        alert('✅ Mensagem copiada para a área de transferência!');
    }
};

window.abrirNoWhatsAppWeb = function() {
    const elTxt = document.getElementById('wppTextoMensagem');
    const elTel = document.getElementById('wppTelefoneDestino');
    const texto = elTxt ? elTxt.value : '';
    let telLimpo = elTel ? elTel.value.replace(/\D/g, '') : '';

    if (telLimpo && telLimpo.length <= 11 && !telLimpo.startsWith('55')) {
        telLimpo = '55' + telLimpo;
    }

    const url = telLimpo
        ? `https://wa.me/${telLimpo}?text=${encodeURIComponent(texto)}`
        : `https://wa.me/?text=${encodeURIComponent(texto)}`;

    window.open(url, '_blank');
};

// ==================== MULTI-FILIAL (SUPERADMIN) ====================
window.salvarFiliaisExtrasNoBanco = async function(userId, username, arrayIdsExtras) {
    const listaStrings = (arrayIdsExtras || []).map(x => String(x).trim()).filter(Boolean);
    const keyId = `filiais_user_${userId}`;
    const keyUser = username ? `filiais_username_${String(username).trim().toUpperCase()}` : null;

    const chaves = [keyId];
    if (keyUser) chaves.push(keyUser);

    for (const chave of chaves) {
        try {
            await supabaseClient.from('permissoes_perfis').delete().eq('perfil', chave);
            if (listaStrings.length > 0) {
                const { error: insErr } = await supabaseClient
                    .from('permissoes_perfis')
                    .insert([{ perfil: chave, menus: listaStrings }]);
                if (insErr) {
                    await db.updatePermissoesDB(chave, listaStrings);
                }
            }
            cachePermissoesFiliais[chave] = listaStrings;
            if (window.permissoesGlobais) {
                window.permissoesGlobais[chave] = listaStrings;
            }
        } catch (err) {
            console.error("Erro ao gravar filiais extras na chave " + chave, err);
        }
    }
};

window.obterFiliaisExtrasDoUsuario = function(userObj) {
    if (!userObj) return [];
    const keyId = `filiais_user_${userObj.id}`;
    const keyUser = userObj.username ? `filiais_username_${String(userObj.username).trim().toUpperCase()}` : '';
    let raw = [];

    if (cachePermissoesFiliais && Array.isArray(cachePermissoesFiliais[keyId])) {
        raw = cachePermissoesFiliais[keyId];
    } else if (keyUser && cachePermissoesFiliais && Array.isArray(cachePermissoesFiliais[keyUser])) {
        raw = cachePermissoesFiliais[keyUser];
    } else if (Array.isArray(userObj.filiais_extras)) {
        raw = userObj.filiais_extras;
    } else if (typeof userObj.filiais_extras === 'string' && userObj.filiais_extras.trim() !== '') {
        try { raw = JSON.parse(userObj.filiais_extras); } catch (e) { raw = userObj.filiais_extras.split(','); }
    }

    return raw
        .map(v => (v === 'CENTRAL' || v === null) ? 'CENTRAL' : parseInt(String(v).trim(), 10))
        .filter(v => v === 'CENTRAL' || (!isNaN(v) && v > 0));
};

window.verificarPermissaoAcao = function(targetUser) {
    if (!window.currentUser) return false;
    if (window.isUsuarioGlobal()) return true;
    
    const isTargetSuperAdmin = (targetUser.role === 'SuperAdmin' || (targetUser.cargos && targetUser.cargos.nivel_acesso === 'SuperAdmin'));
    if (isTargetSuperAdmin) {
        alert('⚠️ Acesso Negado: Apenas um SuperAdmin pode modificar outro SuperAdmin.');
        return false;
    }
    
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
    cacheFiliaisSistema = filiaisBanco || [];

    const containerNovoExtras = document.getElementById('containerNovoFiliaisExtras');

    if (window.isUsuarioGlobal()) {
        const valorAtual = selectFilial.value;
        let options = '<option value="" disabled selected>-- Selecione a Filial --</option>';
        options += '<option value="CENTRAL">ADMINISTRAÇÃO (Corporativo / Global)</option>';
        if (filiaisBanco && filiaisBanco.length > 0) {
            filiaisBanco.forEach(f => { options += `<option value="${f.id}">${f.nome}</option>`; });
        }
        selectFilial.innerHTML = options;
        selectFilial.disabled = false;

        if (valorAtual) {
            selectFilial.value = valorAtual;
            window.popularSelectColaboradoresRH(valorAtual);
        }

        if (containerNovoExtras) {
            if (window.isEstritamenteSuperAdmin()) {
                containerNovoExtras.style.display = 'block';
                window.atualizarCheckboxesFiliaisExtrasNovo();
            } else {
                containerNovoExtras.style.display = 'none';
            }
        }
    } else if (window.currentUser) {
        if (containerNovoExtras) containerNovoExtras.style.display = 'none';

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
        window.popularSelectColaboradoresRH(fValue);
    }
};

window.atualizarCheckboxesFiliaisExtrasNovo = function() {
    if (!window.isEstritamenteSuperAdmin()) return;

    const containerLista = document.getElementById('listaCheckboxesNovoFiliaisExtras');
    const selectPrincipal = document.getElementById('novoUserFilial');
    if (!containerLista) return;

    const filialPrincipal = selectPrincipal ? selectPrincipal.value : '';

    if (filialPrincipal === 'CENTRAL') {
        containerLista.innerHTML = `<span style="font-size: 0.78rem; color: #fde047;"><i class="fas fa-crown"></i> Usuários lotados na Administração Corporativa já possuem acesso a todas as filiais automaticamente.</span>`;
        return;
    }

    let html = '';
    cacheFiliaisSistema.forEach(f => {
        const isMesmaPrincipal = String(f.id) === String(filialPrincipal);
        const disabledAttr = isMesmaPrincipal ? 'disabled' : '';
        const opacityStyle = isMesmaPrincipal ? 'opacity: 0.4; cursor: not-allowed;' : 'cursor: pointer;';

        html += `
            <label style="display: inline-flex; align-items: center; gap: 8px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.1); padding: 7px 12px; border-radius: 6px; font-size: 0.8rem; color: #f8fafc; ${opacityStyle}">
                <input type="checkbox" class="chk-novo-filial-extra" value="${f.id}" ${disabledAttr} style="accent-color: #38bdf8; width: 16px; height: 16px;">
                <span>${f.nome} ${isMesmaPrincipal ? '(Principal)' : ''}</span>
            </label>
        `;
    });

    containerLista.innerHTML = html || '<span style="font-size:0.8rem; color:#94a3b8;">Nenhuma filial adicional disponível.</span>';
};

window.atualizarCheckboxesFiliaisExtrasEdicao = function(filiaisMarcadas = null) {
    const boxContainer = document.getElementById('containerEditFiliaisExtras');
    if (!window.isEstritamenteSuperAdmin()) {
        if (boxContainer) boxContainer.style.display = 'none';
        return;
    }
    if (boxContainer) boxContainer.style.display = 'block';

    if (Array.isArray(filiaisMarcadas)) {
        filiaisExtrasSelecionadasEdicao = filiaisMarcadas.map(v => String(v));
    }

    const containerLista = document.getElementById('listaCheckboxesEditFiliaisExtras');
    const selectPrincipal = document.getElementById('editUserFilial');
    if (!containerLista) return;

    const filialPrincipal = selectPrincipal ? selectPrincipal.value : '';

    if (filialPrincipal === 'CENTRAL') {
        containerLista.innerHTML = `<div style="grid-column: 1 / -1; font-size: 0.8rem; color: #fde047; padding: 6px;"><i class="fas fa-crown"></i> Usuários da Administração Corporativa já navegam em todas as filiais.</div>`;
        return;
    }

    let html = '';
    cacheFiliaisSistema.forEach(f => {
        const strId = String(f.id);
        const isMesmaPrincipal = strId === String(filialPrincipal);
        const isChecked = !isMesmaPrincipal && filiaisExtrasSelecionadasEdicao.includes(strId);

        const disabledAttr = isMesmaPrincipal ? 'disabled' : '';
        const checkedAttr = isChecked ? 'checked' : '';
        const borderStyle = isChecked ? 'border-color: #38bdf8; background: rgba(56, 189, 248, 0.12);' : 'border-color: rgba(255,255,255,0.08); background: rgba(255,255,255,0.03);';
        const opacityStyle = isMesmaPrincipal ? 'opacity: 0.4; cursor: not-allowed;' : 'cursor: pointer;';

        html += `
            <label style="display: flex; align-items: center; gap: 8px; border: 1px solid; ${borderStyle} padding: 8px 10px; border-radius: 6px; font-size: 0.8rem; color: #f8fafc; transition: all 0.2s; ${opacityStyle}">
                <input type="checkbox" class="chk-edit-filial-extra" value="${f.id}" ${checkedAttr} ${disabledAttr} onchange="window.sincronizarSelecaoEdicaoFiliaisExtras()" style="accent-color: #38bdf8; width: 16px; height: 16px;">
                <span style="font-weight: 500;">${f.nome} ${isMesmaPrincipal ? '<small style="color:#94a3b8;">(Base)</small>' : ''}</span>
            </label>
        `;
    });

    containerLista.innerHTML = html || '<span style="font-size:0.8rem; color:#94a3b8;">Nenhuma filial cadastrada.</span>';
};

window.sincronizarSelecaoEdicaoFiliaisExtras = function() {
    if (!window.isEstritamenteSuperAdmin()) return;
    const chks = document.querySelectorAll('.chk-edit-filial-extra:checked');
    filiaisExtrasSelecionadasEdicao = Array.from(chks).map(c => String(c.value));
    window.atualizarCheckboxesFiliaisExtrasEdicao();
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
                const nomeEscapado = String(c.nome || '').replace(/"/g, '&quot;');
                options += `<option value="${c.id}" data-nome="${nomeEscapado}" data-role="${c.nivel_acesso}" data-cc="${ccAttr}">${c.nome} (${c.nivel_hierarquico})</option>`;
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

window.filtrarUsuariosTabela = function(termo) {
    termo = termo.toLowerCase().trim();
    const tbody = document.getElementById('tabelaUsuarios');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr.user-row');

    rows.forEach(row => {
        const textContent = row.innerText.toLowerCase();
        if (textContent.includes(termo)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });

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

    await window.carregarColaboradoresRHParaUsuarios();

    try {
        if (typeof db !== 'undefined' && typeof db.getPermissoesDB === 'function') {
            cachePermissoesFiliais = await db.getPermissoesDB();
        }

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

        // Sincronização automática: inativa usuários cujo colaborador foi desligado/inativado no RH
        await window.sincronizarInativosComRH(todosUsuarios);

        let filiaisBanco = cacheFiliaisSistema;
        if (!filiaisBanco || filiaisBanco.length === 0) {
            try {
                if (typeof db !== 'undefined' && typeof db.getTodasFiliaisAdmin === 'function') {
                    filiaisBanco = await db.getTodasFiliaisAdmin();
                    cacheFiliaisSistema = filiaisBanco || [];
                }
            } catch (e) { console.error("Erro ao carregar filiais banco", e); }
        }

        const mapaNomesFiliais = {};
        (filiaisBanco || []).forEach(f => { mapaNomesFiliais[Number(f.id)] = f.nome; });

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
                listaUsuarios = listaUsuarios.filter(u => {
                    const extras = window.obterFiliaisExtrasDoUsuario(u);
                    return u.filial_id === fVal || (fVal !== null && extras.includes(Number(fVal)));
                });
            }
        }

        // Atualiza o formulário de filiais e o dropdown de colaboradores do RH (já filtrando quem tem usuário)
        await window.carregarFiliaisFormulario();
        if (typeof window.carregarPerfisPermissao === 'function') await window.carregarPerfisPermissao();

        if (listaUsuarios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 30px; color: var(--text-secondary);">Nenhum usuário encontrado para o filtro atual.</td></tr>'; return;
        }

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

                const colabRH = window.encontrarColaboradorRHDoUsuario(u);
                const colabInativoNoRH = colabRH && (colabRH.status === 'Inativo' || colabRH.status === 'Desligado');
                const isAtivo = u.status !== 'Inativo';
                
                let statusBadge = '';
                if (!isAtivo) {
                    let motivoInativoHtml = '';
                    if (colabInativoNoRH) {
                        const dtDesl = colabRH.data_desligamento ? ` em ${colabRH.data_desligamento.split('-').reverse().join('/')}` : '';
                        motivoInativoHtml = `<div style="font-size: 0.68rem; color: #f87171; margin-top: 4px; font-weight: 600;"><i class="fas fa-user-slash"></i> ${colabRH.status} no RH${dtDesl}</div>`;
                    } else {
                        motivoInativoHtml = `<div style="font-size: 0.68rem; color: #94a3b8; margin-top: 4px;">Inativado manualmente</div>`;
                    }
                    statusBadge = `<span style="background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 5px 8px; border-radius: 6px; font-size: 0.75rem; border: 1px solid rgba(239, 68, 68, 0.3); font-weight: 600;">Inativo</span>${motivoInativoHtml}`;
                } else if (u.primeiro_acesso) {
                    statusBadge = `<span style="background: rgba(245, 158, 11, 0.1); color: #f59e0b; padding: 5px 8px; border-radius: 6px; font-size: 0.75rem; border: 1px solid rgba(245, 158, 11, 0.3); font-weight: 500;">1º Acesso</span>`;
                } else {
                    statusBadge = `<span style="background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 5px 8px; border-radius: 6px; font-size: 0.75rem; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 500;">Ativo</span>`;
                }
                
                const filialBaseHtml = u.filial_id === null
                    ? '<span style="color:#fde047; font-weight:600;"><i class="fas fa-globe"></i> Corporativo (Todas)</span>'
                    : `<span style="color:#f8fafc; font-weight:600;">${group.nome}</span>`;

                const idsExtras = window.obterFiliaisExtrasDoUsuario(u).filter(idEx => Number(idEx) !== Number(u.filial_id));
                let badgesExtrasHtml = '';
                if (u.filial_id !== null && idsExtras.length > 0) {
                    const nomesExtras = idsExtras.map(idEx => mapaNomesFiliais[Number(idEx)] || `Filial ${idEx}`);
                    badgesExtrasHtml = `
                        <div style="margin-top: 5px; display: flex; flex-wrap: wrap; justify-content: center; gap: 4px;">
                            ${nomesExtras.map(n => `<span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); padding: 2px 7px; border-radius: 12px; font-size: 0.68rem; font-weight: 600;"><i class="fas fa-plus" style="font-size:0.6rem;"></i> ${n}</span>`).join('')}
                        </div>
                    `;
                }
                
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
                            <button onclick="window.abrirWhatsAppPorIdUsuario(${u.id})" style="background: rgba(37, 211, 102, 0.12); border: 1px solid rgba(37, 211, 102, 0.35); color: #25d366; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; font-size: 0.95rem; transition: all 0.2s;" title="Gerar mensagem de acesso p/ WhatsApp" onmouseover="this.style.background='rgba(37, 211, 102, 0.25)'" onmouseout="this.style.background='rgba(37, 211, 102, 0.12)'"><i class="fab fa-whatsapp"></i></button>

                            <button onclick="window.abrirModalEdicaoUsuario(${u.id})" style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); color: #3b82f6; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; transition: all 0.2s;" title="Editar informações do colaborador" onmouseover="this.style.background='rgba(59, 130, 246, 0.2)'" onmouseout="this.style.background='rgba(59, 130, 246, 0.1)'"><i class="fas fa-edit"></i></button>
                            
                            <button onclick="window.resetarSenhaUsuario(${u.id})" style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); color: #f59e0b; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; transition: all 0.2s;" title="Resetar senha para 12345" onmouseover="this.style.background='rgba(245, 158, 11, 0.2)'" onmouseout="this.style.background='rgba(245, 158, 11, 0.1)'"><i class="fas fa-key"></i></button>
                            
                            ${btnStatus}
                            
                            <button onclick="window.excluirUsuario(${u.id})" style="background: rgba(239, 68, 68, 0.05); border: 1px solid transparent; color: #ef4444; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; transition: all 0.2s; margin-left: 5px;" title="Excluir Permanentemente" onmouseover="this.style.background='rgba(239, 68, 68, 0.2)'; this.style.borderColor='rgba(239, 68, 68, 0.3)';" onmouseout="this.style.background='rgba(239, 68, 68, 0.05)'; this.style.borderColor='transparent';"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    `;
                }

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
                    <td style="font-size: 0.8rem; color: #94a3b8; text-align: center;">
                        ${filialBaseHtml}
                        ${badgesExtrasHtml}
                    </td>
                    <td style="text-align: center;">${statusBadge}</td>
                    <td style="text-align: right;">${botoesAcao}</td>
                </tr>`;
            });
        });

        tbody.innerHTML = htmlFinal;

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

    if (!nomeCompleto) { alert('⚠️ Preencha ou selecione o nome completo do colaborador.'); return; }
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

    if (listaUsuarios.some(u => u.username === nome)) { alert('⚠️ Este usuário (username) já existe! Altere o nome de acesso.'); return; }

    let filiaisExtrasIds = [];
    if (window.isEstritamenteSuperAdmin()) {
        const chksExtras = document.querySelectorAll('.chk-novo-filial-extra:checked');
        filiaisExtrasIds = Array.from(chksExtras)
            .map(chk => parseInt(chk.value, 10))
            .filter(id => !isNaN(id) && id !== filialSelecionada);
    }

    // Resgata telefone do colaborador selecionado no RH (se houver)
    const selColabId = document.getElementById('selectColaboradorRH')?.value;
    let telefoneColab = '';
    if (selColabId) {
        const colabObj = cacheColaboradoresRH.find(c => String(c.id) === String(selColabId));
        if (colabObj && colabObj.telefone) telefoneColab = colabObj.telefone;
    }

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

        if (window.isEstritamenteSuperAdmin() && filiaisExtrasIds.length > 0) {
            const usuarioCriado = await db.getUsuarioByUsername(nome);
            if (usuarioCriado && usuarioCriado.id) {
                await window.salvarFiliaisExtrasNoBanco(usuarioCriado.id, nome, filiaisExtrasIds);
            }
        }
        
        if (typeof window.registrarLogAuditoria === 'function') {
            window.registrarLogAuditoria('Gestão de Usuários', 'Criação de Usuário', `Novo usuário cadastrado: ${nomeCompleto} (${nome}) (Permissão Base: ${systemRole} | Filiais Extras: ${filiaisExtrasIds.join(',') || 'Nenhuma'})`);
        }

        document.getElementById('novoNomeCompleto').value = '';
        document.getElementById('novoUsername').value = '';
        if (document.getElementById('selectColaboradorRH')) document.getElementById('selectColaboradorRH').value = '';
        selectCargo.value = '';
        document.querySelectorAll('.chk-novo-filial-extra').forEach(c => c.checked = false);
        
        await window.renderizarUsuarios();

        // Abre automaticamente o modal com o texto pronto para enviar no WhatsApp
        window.abrirModalWhatsAppUsuario(nome, nomeCompleto, telefoneColab, false);
    } catch(e) { 
        console.error(e);
        alert('❌ Erro ao registrar o usuário na estrutura corporativa. Verifique o console.'); 
    }
};

window.resetarSenhaUsuario = async function(id) {
    const u = listaUsuarios.find(user => user.id === id);
    if (!u || !window.verificarPermissaoAcao(u)) return;

    if(confirm(`Deseja resetar a senha de ${u.username} para "12345"? Ele precisará criar uma nova senha ao logar.`)) {
        await db.updateUsuarioSenhaEReset(id, "5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5");
        
        if (typeof window.registrarLogAuditoria === 'function') {
            window.registrarLogAuditoria('Gestão de Usuários', 'Edição de Segurança', `Senha do usuário ${u.username} foi resetada para a senha padrão.`);
        }

        const colabRH = window.encontrarColaboradorRHDoUsuario(u);
        const telefone = colabRH && colabRH.telefone ? colabRH.telefone : '';

        await window.renderizarUsuarios();
        window.abrirModalWhatsAppUsuario(u.username, u.nome_completo || '', telefone, true);
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
            cacheFiliaisSistema = filiais || [];
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

    const boxExtras = document.getElementById('containerEditFiliaisExtras');
    if (window.isEstritamenteSuperAdmin()) {
        const extrasAtuais = window.obterFiliaisExtrasDoUsuario(u);
        window.atualizarCheckboxesFiliaisExtrasEdicao(extrasAtuais);
    } else if (boxExtras) {
        boxExtras.style.display = 'none';
    }

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
    const id = parseInt(document.getElementById('editUserId').value, 10);
    const nomeCompleto = document.getElementById('editNomeCompleto').value.trim().toUpperCase();
    const nome = document.getElementById('editUsername').value.trim().toUpperCase();
    const selectFilial = document.getElementById('editUserFilial');
    const selectCargo = document.getElementById('editUserCargo');

    if (!nomeCompleto) { alert('⚠️ Preencha o nome completo.'); return; }
    if (!nome) { alert('⚠️ Preencha o nome do usuário (username).'); return; }
    if (!selectFilial || selectFilial.value === '') { alert('⚠️ Selecione a Filial de Atuação.'); return; }
    if (!selectCargo || selectCargo.value === '') { alert('⚠️ Selecione a nova Função/Cargo.'); return; }

    const filialSelecionada = selectFilial.value === 'CENTRAL' ? null : parseInt(selectFilial.value, 10);
    const cargoOption = selectCargo.options[selectCargo.selectedIndex];
    const systemRole = cargoOption.getAttribute('data-role'); 
    const centroCustoId = cargoOption.getAttribute('data-cc');
    const cargoId = parseInt(selectCargo.value, 10);
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
            centro_custo_id: centroCustoId ? parseInt(centroCustoId, 10) : null
        }).eq('id', id);

        if (error) throw error;

        let logFiliaisExtras = '';
        if (window.isEstritamenteSuperAdmin()) {
            const chksExtras = document.querySelectorAll('.chk-edit-filial-extra:checked');
            const filiaisExtrasIds = Array.from(chksExtras)
                .map(chk => parseInt(chk.value, 10))
                .filter(fId => !isNaN(fId) && fId !== filialSelecionada);

            await window.salvarFiliaisExtrasNoBanco(id, nome, filiaisExtrasIds);
            logFiliaisExtras = ` | Filiais Extras: ${filiaisExtrasIds.join(',') || 'Nenhuma'}`;
        }

        if (typeof window.registrarLogAuditoria === 'function') {
            window.registrarLogAuditoria('Gestão de Usuários', 'Edição de Usuário', `Dados atualizados para: ${nomeCompleto} (${nome}) (Cargo: ${cargoNome}${logFiliaisExtras})`);
        }

        alert('✅ Cadastro e filiais adicionais do colaborador salvos com sucesso!');
        window.fecharModalEdicaoUsuario();
        await window.renderizarUsuarios();
        
    } catch (e) {
        console.error("Erro ao salvar edição do usuário no Supabase:", e);
        alert('❌ Ocorreu um erro ao tentar salvar as modificações no banco de dados.');
    }
};

window.alternarStatusUsuario = async function(id, novoStatus) {
    const u = listaUsuarios.find(user => user.id === id);
    if (!u || !window.verificarPermissaoAcao(u)) return;

    // Trava de segurança: impede reativar usuário que está Inativo/Desligado no RH
    if (novoStatus === 'Ativo') {
        const colabRH = window.encontrarColaboradorRHDoUsuario(u);
        if (colabRH && (colabRH.status === 'Inativo' || colabRH.status === 'Desligado')) {
            alert(`⚠️ Bloqueado pelo RH!\n\nO colaborador "${colabRH.nome}" consta como ${colabRH.status} no módulo de RH.\nPara reativar o acesso ao sistema, primeiro reative o cadastro dele no RH.`);
            return;
        }
    }

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