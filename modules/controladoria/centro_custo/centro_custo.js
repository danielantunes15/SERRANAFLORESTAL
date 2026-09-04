// ==================== MÓDULO UNIFICADO: GESTÃO CORPORATIVA, ORGANOGRAMA E CUSTOS ====================

// --- FUNÇÕES AUXILIARES DE BANCO DE DADOS ---
function obterFilialDb(fElementId) {
    const val = document.getElementById(fElementId).value;
    return (val === 'CENTRAL' || val === '') ? null : parseInt(val);
}

function obterFilialUsuarioLogado() {
    return (window.currentUser && window.currentUser.filial_id && window.currentUser.filial_id !== 'CENTRAL') 
        ? parseInt(window.currentUser.filial_id) : null;
}

function aplicarFiltroFilial(queryObject) {
    const filialId = obterFilialUsuarioLogado();
    return filialId === null ? queryObject.is('filial_id', null) : queryObject.eq('filial_id', filialId);
}

window.carregarOpcoesFilialGenerico = async function(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    try {
        const filialLogada = obterFilialUsuarioLogado();
        let options = '';

        // Se o usuário tem acesso global (CENTRAL), mostra a opção de Matriz
        if (filialLogada === null) {
            options += '<option value="CENTRAL">Matriz Corporativa (Acesso Global)</option>';
        }

        if (typeof db !== 'undefined' && typeof db.getTodasFiliaisAdmin === 'function') {
            const filiais = await db.getTodasFiliaisAdmin();
            if (filiais && filiais.length > 0) {
                filiais.forEach(f => {
                    // Exibe a filial apenas se for a filial do usuário logado ou se o usuário for nível CENTRAL
                    if (filialLogada === null || f.id === filialLogada) {
                        options += `<option value="${f.id}">${f.nome}</option>`;
                    }
                });
            }
        }
        select.innerHTML = options;
    } catch (e) { console.error(e); }
};

window.initControladoria = async function() {
    window.mapaFiliais = {};
    try {
        if (typeof db !== 'undefined' && typeof db.getTodasFiliaisAdmin === 'function') {
            const list = await db.getTodasFiliaisAdmin();
            if (list && list.length > 0) { list.forEach(f => { window.mapaFiliais[f.id] = f.nome; }); }
        }
    } catch (e) { console.error("Erro ao carregar lista de filiais:", e); }
    
    await carregarCentrosCusto();
    await carregarObjetosCusto();
    await carregarAtividades();
    await carregarSetores();
    await carregarCargos();
    await carregarResponsaveis(); 
};

window.switchTabControladoria = function(tabId, btnElement) {
    document.querySelectorAll('.ctrl-tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.ctrl-tab-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    btnElement.classList.add('active');

    if (tabId === 'tab-cc') carregarCentrosCusto();
    if (tabId === 'tab-obj') carregarOpcoesCentroCusto();
    if (tabId === 'tab-ativ') carregarOpcoesObjetoCustoAtiv();
    if (tabId === 'tab-cargos') atualizarFiltrosCargo();
    if (tabId === 'tab-responsaveis') carregarResponsaveis();
};

// =====================================================================
// NÍVEL 1: CENTRO DE CUSTO
// =====================================================================
window.carregarCentrosCusto = async function() {
    const tbody = document.getElementById('tbodyCentrosCusto');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Carregando dados...</td></tr>';
    try {
        let query = supabaseClient.from('centro_custo').select('*').order('codigo', { ascending: true });
        
        // Filtro de filial estrito
        const filialLogada = obterFilialUsuarioLogado();
        if (filialLogada !== null) {
            query = query.eq('filial_id', filialLogada);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) return tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #94a3b8;">Nenhum Centro de Custo cadastrado.</td></tr>';

        const filiaisMap = new Map();
        filiaisMap.set('CENTRAL', { nome: 'Matriz Corporativa', items: [] });
        
        const filiaisIds = Object.keys(window.mapaFiliais || {}).map(Number).sort((a, b) => a - b);
        filiaisIds.forEach(id => {
            filiaisMap.set(id, { nome: window.mapaFiliais[id], items: [] });
        });

        data.forEach(cc => {
            const fKey = cc.filial_id === null ? 'CENTRAL' : Number(cc.filial_id);
            if (!filiaisMap.has(fKey)) filiaisMap.set(fKey, { nome: `Filial ID: ${fKey}`, items: [] });
            filiaisMap.get(fKey).items.push(cc);
        });

        let html = '';
        filiaisMap.forEach((group, fKey) => {
            if (group.items.length === 0) return;
            html += `
                <tr style="background: rgba(15, 23, 42, 0.9); border-bottom: 2px solid #3b82f6;">
                    <td colspan="6" style="padding: 15px 12px; font-weight: 700; color: #38bdf8; font-size: 1.1rem; letter-spacing: 0.5px; border-top: 20px solid transparent; background-clip: padding-box;">
                        <i class="fas fa-building" style="margin-right: 8px;"></i> ${group.nome}
                    </td>
                </tr>
            `;
            group.items.forEach(cc => {
                const badgeClass = cc.status === 'Ativo' ? 'background: rgba(34,197,94,0.2); color: #4ade80;' : 'background: rgba(239,68,68,0.2); color: #f87171;';
                const filialNome = fKey === 'CENTRAL' ? '<span style="color:#fde047">Matriz Corporativa</span>' : group.nome;
                const ccJsonSeguro = JSON.stringify(cc).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
                
                html += `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); background: transparent;">
                        <td style="padding: 12px; font-weight: bold; color: #60a5fa; padding-left: 25px;">${cc.codigo}</td>
                        <td style="padding: 12px; color: #cbd5e1;">${filialNome}</td>
                        <td style="padding: 12px; color: #f8fafc;">${cc.nome}</td>
                        <td style="padding: 12px; color: #94a3b8; font-size: 0.85rem;">${cc.descricao || '-'}</td>
                        <td style="padding: 12px;"><span style="padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; ${badgeClass}">${cc.status}</span></td>
                        <td style="padding: 12px; text-align: center;">
                            <button onclick="abrirModalCentroCusto(${ccJsonSeguro})" style="background: none; border: none; color: #fbbf24; cursor: pointer; margin-right: 10px;" title="Editar"><i class="fas fa-edit"></i></button>
                            <button onclick="excluirCentroCusto(${cc.id})" style="background: none; border: none; color: #ef4444; cursor: pointer;" title="Excluir"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>`;
            });
        });
        tbody.innerHTML = html;
    } catch (e) { console.error(e); tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #ef4444;">Erro ao carregar dados.</td></tr>'; }
};

window.abrirModalCentroCusto = function(cc = null) {
    document.getElementById('modalCentroCusto').style.display = 'flex';
    carregarOpcoesFilialGenerico('ccFilialId').then(() => {
        const filialLogada = obterFilialUsuarioLogado();
        if (cc && cc.id) {
            document.getElementById('modalCentroCustoTitle').innerText = '  Editar Centro de Custo';
            document.getElementById('ccId').value = cc.id;
            document.getElementById('ccFilialId').value = cc.filial_id === null ? 'CENTRAL' : cc.filial_id;
            document.getElementById('ccCodigo').value = cc.codigo;
            document.getElementById('ccNome').value = cc.nome;
            document.getElementById('ccDescricao').value = cc.descricao || '';
            document.getElementById('ccStatus').value = cc.status || 'Ativo';
        } else {
            document.getElementById('modalCentroCustoTitle').innerText = '  Novo Centro de Custo';
            document.getElementById('ccId').value = '';
            document.getElementById('ccFilialId').value = filialLogada === null ? 'CENTRAL' : filialLogada;
            document.getElementById('ccCodigo').value = '';
            document.getElementById('ccNome').value = '';
            document.getElementById('ccDescricao').value = '';
            document.getElementById('ccStatus').value = 'Ativo';
        }
    });
};

window.fecharModalCentroCusto = () => document.getElementById('modalCentroCusto').style.display = 'none';

window.salvarCentroCusto = async function() {
    const id = document.getElementById('ccId').value;
    const payload = {
        filial_id: obterFilialDb('ccFilialId'),
        codigo: document.getElementById('ccCodigo').value.trim(),
        nome: document.getElementById('ccNome').value.trim(),
        descricao: document.getElementById('ccDescricao').value.trim(),
        status: document.getElementById('ccStatus').value
    };
    if (!payload.codigo || !payload.nome) return alert("Preencha Código e Nome.");
    
    try {
        let dbError;
        if (id) {
            const { error } = await supabaseClient.from('centro_custo').update(payload).eq('id', id);
            dbError = error;
        } else {
            const { error } = await supabaseClient.from('centro_custo').insert([payload]);
            dbError = error;
        }
        if (dbError) throw dbError;
        
        fecharModalCentroCusto();
        await carregarCentrosCusto();
    } catch (e) {
        console.error("Erro no Supabase:", e);
        if (e.code === '23505' || e.status === 409 || (e.message && e.message.includes('duplicate key'))) {
            alert("Erro 409 (Conflito): O Código de Centro de Custo informado já está cadastrado no sistema.");
        } else {
            alert("Erro ao salvar o Centro de Custo. Verifique o console.");
        }
    }
};

window.excluirCentroCusto = async function(id) {
    if (!confirm("Excluir este Centro de Custo deletará objetos e atividades associados. Deseja continuar?")) return;
    await supabaseClient.from('centro_custo').delete().eq('id', id);
    await carregarCentrosCusto();
};

// =====================================================================
// NÍVEL 2: OBJETOS DE CUSTO
// =====================================================================
window.carregarOpcoesCentroCusto = async function() {
    const select = document.getElementById('objCentroCustoId');
    const filialId = document.getElementById('objFilialId').value;
    if (!select) return;
    
    let query = supabaseClient.from('centro_custo').select('id, codigo, nome, filial_id').eq('status', 'Ativo');
    
    // Filtro estrito por filial no modal
    if (filialId !== 'CENTRAL' && filialId !== '') {
        query = query.eq('filial_id', parseInt(filialId));
    } else {
        query = query.is('filial_id', null);
    }
    
    const { data } = await query;
    if (!data || data.length === 0) return select.innerHTML = '<option value="">Nenhum Centro Ativo nesta Filial</option>';
    select.innerHTML = '<option value="">Selecione...</option>' + data.map(cc => {
        const fPrefix = cc.filial_id === null ? 'Matriz' : (window.mapaFiliais[cc.filial_id] || `Filial`);
        return `<option value="${cc.id}">[${fPrefix}] [${cc.codigo}] - ${cc.nome}</option>`;
    }).join('');
};

window.carregarObjetosCusto = async function() {
    const tbody = document.getElementById('tbodyObjetosCusto');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Carregando dados...</td></tr>';
    
    try {
        let query = supabaseClient.from('objetos_custo').select('*, centro_custo(codigo, nome)').order('codigo');
        
        // Filtro de filial estrito
        const filialLogada = obterFilialUsuarioLogado();
        if (filialLogada !== null) {
            query = query.eq('filial_id', filialLogada);
        }

        const { data } = await query;
        if (!data || data.length === 0) return tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #94a3b8;">Nenhum Objeto de Custo.</td></tr>';
        
        const filiaisMap = new Map();
        filiaisMap.set('CENTRAL', { nome: 'Matriz Corporativa', items: [] });
        
        const filiaisIds = Object.keys(window.mapaFiliais || {}).map(Number).sort((a, b) => a - b);
        filiaisIds.forEach(id => {
            filiaisMap.set(id, { nome: window.mapaFiliais[id], items: [] });
        });

        data.forEach(obj => {
            const fKey = obj.filial_id === null ? 'CENTRAL' : Number(obj.filial_id);
            if (!filiaisMap.has(fKey)) filiaisMap.set(fKey, { nome: `Filial ID: ${fKey}`, items: [] });
            filiaisMap.get(fKey).items.push(obj);
        });

        let html = '';
        filiaisMap.forEach((group, fKey) => {
            if (group.items.length === 0) return;
            html += `
                <tr style="background: rgba(15, 23, 42, 0.9); border-bottom: 2px solid #3b82f6;">
                    <td colspan="7" style="padding: 15px 12px; font-weight: 700; color: #38bdf8; font-size: 1.1rem; letter-spacing: 0.5px; border-top: 20px solid transparent; background-clip: padding-box;">
                        <i class="fas fa-building" style="margin-right: 8px;"></i> ${group.nome}
                    </td>
                </tr>
            `;
            group.items.forEach(obj => {
                let bClass = obj.status === 'Ativo' ? 'color: #4ade80;' : 'color: #fbbf24;';
                const ccDisplay = obj.centro_custo ? `[${obj.centro_custo.codigo}] ${obj.centro_custo.nome}` : 'Desconhecido';
                const filialNome = fKey === 'CENTRAL' ? '<span style="color:#fde047">Matriz Corporativa</span>' : group.nome;
                const objJsonSeguro = JSON.stringify(obj).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
                
                html += `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); background: transparent;">
                        <td style="padding: 12px; font-weight: bold; color: #c084fc; padding-left: 25px;">${obj.codigo}</td>
                        <td style="padding: 12px; color: #cbd5e1;">${filialNome}</td>
                        <td style="padding: 12px; color: #f8fafc;">${obj.nome}</td>
                        <td style="padding: 12px; color: #94a3b8;">${obj.tipo || '-'}</td>
                        <td style="padding: 12px; color: #cbd5e1;">${ccDisplay}</td>
                        <td style="padding: 12px;"><span style="${bClass}">${obj.status}</span></td>
                        <td style="padding: 12px; text-align: center;">
                            <button onclick="abrirModalObjetoCusto(${objJsonSeguro})" style="background: none; border: none; color: #fbbf24; cursor: pointer; margin-right: 10px;" title="Editar"><i class="fas fa-edit"></i></button>
                            <button onclick="excluirObjetoCusto(${obj.id})" style="background: none; border: none; color: #ef4444; cursor: pointer;" title="Excluir"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>`;
            });
        });
        tbody.innerHTML = html;
    } catch (e) { console.error(e); }
};

window.abrirModalObjetoCusto = function(obj = null) {
    document.getElementById('modalObjetoCusto').style.display = 'flex';
    carregarOpcoesFilialGenerico('objFilialId').then(() => {
        const filialLogada = obterFilialUsuarioLogado();
        if (obj && obj.id) {
            document.getElementById('objId').value = obj.id;
            document.getElementById('objFilialId').value = obj.filial_id === null ? 'CENTRAL' : obj.filial_id;
            carregarOpcoesCentroCusto().then(() => {
                document.getElementById('objCentroCustoId').value = obj.centro_custo_id;
            });
            document.getElementById('objCodigo').value = obj.codigo;
            document.getElementById('objNome').value = obj.nome;
            document.getElementById('objTipo').value = obj.tipo || 'Outros';
            document.getElementById('objDescricao').value = obj.descricao || '';
            document.getElementById('objStatus').value = obj.status || 'Ativo';
        } else {
            document.getElementById('objId').value = '';
            document.getElementById('objFilialId').value = filialLogada === null ? 'CENTRAL' : filialLogada;
            carregarOpcoesCentroCusto();
            document.getElementById('objCentroCustoId').value = '';
            document.getElementById('objCodigo').value = '';
            document.getElementById('objNome').value = '';
            document.getElementById('objTipo').value = 'Veículo Pesado';
            document.getElementById('objDescricao').value = '';
            document.getElementById('objStatus').value = 'Ativo';
        }
    });
};

window.fecharModalObjetoCusto = () => document.getElementById('modalObjetoCusto').style.display = 'none';

window.salvarObjetoCusto = async function() {
    const id = document.getElementById('objId').value;
    const payload = {
        filial_id: obterFilialDb('objFilialId'),
        centro_custo_id: parseInt(document.getElementById('objCentroCustoId').value),
        codigo: document.getElementById('objCodigo').value.trim(),
        nome: document.getElementById('objNome').value.trim(),
        tipo: document.getElementById('objTipo').value,
        descricao: document.getElementById('objDescricao').value.trim(),
        status: document.getElementById('objStatus').value
    };
    
    try {
        let dbError;
        if (id) {
            const { error } = await supabaseClient.from('objetos_custo').update(payload).eq('id', id);
            dbError = error;
        } else {
            const { error } = await supabaseClient.from('objetos_custo').insert([payload]);
            dbError = error;
        }
        if (dbError) throw dbError;
        
        fecharModalObjetoCusto();
        await carregarObjetosCusto();
    } catch (e) {
        console.error("Erro no Supabase:", e);
        if (e.code === '23505' || e.status === 409 || (e.message && e.message.includes('duplicate key'))) {
            alert("Erro 409 (Conflito): O Código ou Placa informada já está cadastrada no sistema.");
        } else {
            alert("Erro ao salvar o Objeto de Custo. Verifique o console.");
        }
    }
};

window.excluirObjetoCusto = async function(id) {
    if (!confirm("Excluir este Objeto?")) return;
    await supabaseClient.from('objetos_custo').delete().eq('id', id);
    await carregarObjetosCusto();
};

// =====================================================================
// NÍVEL 3: ATIVIDADES / PROCESSOS
// =====================================================================
window.carregarOpcoesObjetoCustoAtiv = async function() {
    const select = document.getElementById('ativObjetoCustoId');
    const filialId = document.getElementById('ativFilialId').value;
    if (!select) return;
    
    let query = supabaseClient.from('objetos_custo').select('id, nome, filial_id, centro_custo(nome)').eq('status', 'Ativo');
    
    // Filtro estrito por filial
    if (filialId !== 'CENTRAL' && filialId !== '') {
        query = query.eq('filial_id', parseInt(filialId));
    } else {
        query = query.is('filial_id', null);
    }
    const { data } = await query;
    if (!data || data.length === 0) return select.innerHTML = '<option value="">Nenhum Objeto Ativo nesta Filial</option>';
    select.innerHTML = '<option value="">Selecione...</option>' + data.map(obj => {
        const fPrefix = obj.filial_id === null ? 'Matriz' : (window.mapaFiliais[obj.filial_id] || `Filial`);
        return `<option value="${obj.id}">[${fPrefix}] [${obj.centro_custo ? obj.centro_custo.nome : 'Sem CC'}] - ${obj.nome}</option>`;
    }).join('');
};

window.carregarAtividades = async function() {
    const tbody = document.getElementById('tbodyAtividades');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Carregando dados...</td></tr>';
    
    try {
        let query = supabaseClient.from('atividades_processos').select('*, objetos_custo(codigo, nome, centro_custo(nome))').order('codigo');
        
        // Filtro de filial estrito
        const filialLogada = obterFilialUsuarioLogado();
        if (filialLogada !== null) {
            query = query.eq('filial_id', filialLogada);
        }

        const { data } = await query;
        if (!data || data.length === 0) return tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #94a3b8;">Nenhuma Atividade.</td></tr>';
        
        const filiaisMap = new Map();
        filiaisMap.set('CENTRAL', { nome: 'Matriz Corporativa', items: [] });
        
        const filiaisIds = Object.keys(window.mapaFiliais || {}).map(Number).sort((a, b) => a - b);
        filiaisIds.forEach(id => {
            filiaisMap.set(id, { nome: window.mapaFiliais[id], items: [] });
        });

        data.forEach(ativ => {
            const fKey = ativ.filial_id === null ? 'CENTRAL' : Number(ativ.filial_id);
            if (!filiaisMap.has(fKey)) filiaisMap.set(fKey, { nome: `Filial ID: ${fKey}`, items: [] });
            filiaisMap.get(fKey).items.push(ativ);
        });

        let html = '';
        filiaisMap.forEach((group, fKey) => {
            if (group.items.length === 0) return;
            html += `
                <tr style="background: rgba(15, 23, 42, 0.9); border-bottom: 2px solid #3b82f6;">
                    <td colspan="7" style="padding: 15px 12px; font-weight: 700; color: #38bdf8; font-size: 1.1rem; letter-spacing: 0.5px; border-top: 20px solid transparent; background-clip: padding-box;">
                        <i class="fas fa-building" style="margin-right: 8px;"></i> ${group.nome}
                    </td>
                </tr>
            `;
            group.items.forEach(ativ => {
                let bClass = ativ.status === 'Ativo' ? 'color: #4ade80;' : 'color: #f87171;';
                const objDisplay = ativ.objetos_custo ? `[${ativ.objetos_custo.codigo}] ${ativ.objetos_custo.nome}` : 'Desconhecido';
                const ccDisplay = (ativ.objetos_custo && ativ.objetos_custo.centro_custo) ? ativ.objetos_custo.centro_custo.nome : 'Desconhecido';
                const filialNome = fKey === 'CENTRAL' ? '<span style="color:#fde047">Matriz Corporativa</span>' : group.nome;
                const ativJsonSeguro = JSON.stringify(ativ).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
                
                html += `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); background: transparent;">
                        <td style="padding: 12px; font-weight: bold; color: #34d399; padding-left: 25px;">${ativ.codigo}</td>
                        <td style="padding: 12px; color: #cbd5e1;">${filialNome}</td>
                        <td style="padding: 12px; color: #f8fafc;">${ativ.nome}</td>
                        <td style="padding: 12px; color: #c084fc;">${objDisplay}</td>
                        <td style="padding: 12px; color: #60a5fa;">${ccDisplay}</td>
                        <td style="padding: 12px;"><span style="${bClass}">${ativ.status}</span></td>
                        <td style="padding: 12px; text-align: center;">
                            <button onclick="abrirModalAtividade(${ativJsonSeguro})" style="background: none; border: none; color: #fbbf24; cursor: pointer; margin-right: 10px;" title="Editar"><i class="fas fa-edit"></i></button>
                            <button onclick="excluirAtividade(${ativ.id})" style="background: none; border: none; color: #ef4444; cursor: pointer;" title="Excluir"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>`;
            });
        });
        tbody.innerHTML = html;
    } catch (e) { console.error(e); }
};

window.abrirModalAtividade = function(ativ = null) {
    document.getElementById('modalAtividade').style.display = 'flex';
    carregarOpcoesFilialGenerico('ativFilialId').then(() => {
        const filialLogada = obterFilialUsuarioLogado();
        if (ativ && ativ.id) {
            document.getElementById('ativId').value = ativ.id;
            document.getElementById('ativFilialId').value = ativ.filial_id === null ? 'CENTRAL' : ativ.filial_id;
            carregarOpcoesObjetoCustoAtiv().then(() => {
                document.getElementById('ativObjetoCustoId').value = ativ.objeto_custo_id;
            });
            document.getElementById('ativCodigo').value = ativ.codigo;
            document.getElementById('ativNome').value = ativ.nome;
            document.getElementById('ativDescricao').value = ativ.descricao || '';
            document.getElementById('ativStatus').value = ativ.status || 'Ativo';
        } else {
            document.getElementById('ativId').value = '';
            document.getElementById('ativFilialId').value = filialLogada === null ? 'CENTRAL' : filialLogada;
            carregarOpcoesObjetoCustoAtiv();
            document.getElementById('ativObjetoCustoId').value = '';
            document.getElementById('ativCodigo').value = '';
            document.getElementById('ativNome').value = '';
            document.getElementById('ativDescricao').value = '';
            document.getElementById('ativStatus').value = 'Ativo';
        }
    });
};

window.fecharModalAtividade = () => document.getElementById('modalAtividade').style.display = 'none';

window.salvarAtividade = async function() {
    const id = document.getElementById('ativId').value;
    const payload = {
        filial_id: obterFilialDb('ativFilialId'),
        objeto_custo_id: parseInt(document.getElementById('ativObjetoCustoId').value),
        codigo: document.getElementById('ativCodigo').value.trim(),
        nome: document.getElementById('ativNome').value.trim(),
        descricao: document.getElementById('ativDescricao').value.trim(),
        status: document.getElementById('ativStatus').value
    };
    
    try {
        let dbError;
        if (id) {
            const { error } = await supabaseClient.from('atividades_processos').update(payload).eq('id', id);
            dbError = error;
        } else {
            const { error } = await supabaseClient.from('atividades_processos').insert([payload]);
            dbError = error;
        }
        if (dbError) throw dbError;
        
        fecharModalAtividade();
        await carregarAtividades();
    } catch (e) {
        console.error("Erro no Supabase:", e);
        if (e.code === '23505' || e.status === 409 || (e.message && e.message.includes('duplicate key'))) {
            alert("Erro 409 (Conflito): O Código da Atividade informado já está cadastrado.");
        } else {
            alert("Erro ao salvar Atividade. Verifique o console.");
        }
    }
};

window.excluirAtividade = async function(id) {
    if (!confirm("Deseja excluir esta Atividade?")) return;
    await supabaseClient.from('atividades_processos').delete().eq('id', id);
    await carregarAtividades();
};


// =====================================================================
// REGIAO: ORGANOGRAMA CORPORATIVO E CARGOS E SETORES
// =====================================================================
window.carregarSetores = async function() {
    const tbody = document.getElementById('tbodySetores');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Carregando dados...</td></tr>';
    try {
        let query = supabaseClient.from('setores').select('*').order('nome');
        
        // Filtro de filial estrito
        const filialLogada = obterFilialUsuarioLogado();
        if (filialLogada !== null) {
            query = query.eq('filial_id', filialLogada);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) return tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Nenhum Setor cadastrado.</td></tr>';

        const filiaisMap = new Map();
        filiaisMap.set('CENTRAL', { nome: 'Matriz Corporativa', items: [] });
        
        const filiaisIds = Object.keys(window.mapaFiliais || {}).map(Number).sort((a, b) => a - b);
        filiaisIds.forEach(id => {
            filiaisMap.set(id, { nome: window.mapaFiliais[id], items: [] });
        });

        data.forEach(setor => {
            const fKey = setor.filial_id === null ? 'CENTRAL' : Number(setor.filial_id);
            if (!filiaisMap.has(fKey)) filiaisMap.set(fKey, { nome: `Filial ID: ${fKey}`, items: [] });
            filiaisMap.get(fKey).items.push(setor);
        });

        let html = '';
        filiaisMap.forEach((group, fKey) => {
            if (group.items.length === 0) return;
            html += `
                <tr style="background: rgba(15, 23, 42, 0.9); border-bottom: 2px solid #3b82f6;">
                    <td colspan="5" style="padding: 15px 12px; font-weight: 700; color: #38bdf8; font-size: 1.1rem; letter-spacing: 0.5px; border-top: 20px solid transparent; background-clip: padding-box;">
                        <i class="fas fa-building" style="margin-right: 8px;"></i> ${group.nome}
                    </td>
                </tr>
            `;
            group.items.forEach(setor => {
                const bClass = setor.status === 'Ativo' ? 'color: #4ade80;' : 'color: #f87171;';
                const filialNome = fKey === 'CENTRAL' ? '<span style="color:#fde047">Matriz Corporativa</span>' : group.nome;
                const setorJsonSeguro = JSON.stringify(setor).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
                
                html += `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); background: transparent;">
                        <td style="padding: 12px; font-weight: bold; color: #10b981; padding-left: 25px;">${setor.nome}</td>
                        <td style="padding: 12px; color: #f8fafc;">${filialNome}</td>
                        <td style="padding: 12px; color: #94a3b8; font-size: 0.85rem;">${setor.descricao || '-'}</td>
                        <td style="padding: 12px;"><span style="${bClass}">${setor.status}</span></td>
                        <td style="padding: 12px; text-align: center;">
                            <button onclick="abrirModalSetor(${setorJsonSeguro})" style="background: none; border: none; color: #fbbf24; cursor: pointer; margin-right: 10px;" title="Editar"><i class="fas fa-edit"></i></button>
                            <button onclick="excluirSetor(${setor.id})" style="background: none; border: none; color: #ef4444; cursor: pointer;" title="Excluir"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>`;
            });
        });
        tbody.innerHTML = html;
    } catch (e) { console.error(e); tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ef4444;">Erro ao carregar setores.</td></tr>'; }
};

window.abrirModalSetor = function(setor = null) {
    document.getElementById('modalSetor').style.display = 'flex';
    carregarOpcoesFilialGenerico('setorFilialId').then(() => {
        const filialLogada = obterFilialUsuarioLogado();
        if (setor && setor.id) {
            document.getElementById('modalSetorTitle').innerText = '  Editar Setor';
            document.getElementById('setorId').value = setor.id;
            document.getElementById('setorNome').value = setor.nome;
            document.getElementById('setorDescricao').value = setor.descricao || '';
            document.getElementById('setorStatus').value = setor.status || 'Ativo';
            document.getElementById('setorFilialId').value = setor.filial_id === null ? 'CENTRAL' : setor.filial_id;
        } else {
            document.getElementById('modalSetorTitle').innerText = '  Novo Setor Corporativo';
            document.getElementById('setorId').value = '';
            document.getElementById('setorNome').value = '';
            document.getElementById('setorDescricao').value = '';
            document.getElementById('setorStatus').value = 'Ativo';
            document.getElementById('setorFilialId').value = filialLogada === null ? 'CENTRAL' : filialLogada;
        }
    });
};

window.fecharModalSetor = () => document.getElementById('modalSetor').style.display = 'none';

window.salvarSetor = async function() {
    const id = document.getElementById('setorId').value;
    const payload = {
        filial_id: obterFilialDb('setorFilialId'),
        nome: document.getElementById('setorNome').value.trim(),
        descricao: document.getElementById('setorDescricao').value.trim(),
        status: document.getElementById('setorStatus').value
    };
    if (!payload.nome) return alert("Preencha o Nome do Setor.");
    
    try {
        let dbError;
        if (id) {
            const { error } = await supabaseClient.from('setores').update(payload).eq('id', id);
            dbError = error;
        } else {
            const { error } = await supabaseClient.from('setores').insert([payload]);
            dbError = error;
        }
        if (dbError) throw dbError;
        
        fecharModalSetor();
        await carregarSetores();
    } catch (e) {
        console.error("Erro no Supabase:", e);
        if (e.code === '23505' || e.status === 409 || (e.message && e.message.includes('duplicate key'))) {
            alert("Erro 409 (Conflito): O Nome do Setor informado já está cadastrado.");
        } else {
            alert("Erro ao salvar Setor. Verifique o console.");
        }
    }
};

window.excluirSetor = async function(id) {
    if (!confirm("Excluir Setor? Cargos associados poderão perder referência.")) return;
    await supabaseClient.from('setores').delete().eq('id', id);
    await carregarSetores();
};

window.atualizarFiltrosCargo = async function() {
    await carregarOpcoesSetorParaCargo();
    await carregarOpcoesCentroCustoParaCargo();
    await carregarOpcoesCargoSuperior();
};

window.carregarOpcoesCargoSuperior = async function() {
    const select = document.getElementById('cargoSuperiorId');
    const filialId = document.getElementById('cargoFilialId').value;
    const cargoAtualId = document.getElementById('cargoId').value;
    if (!select) return;
    let query = supabaseClient.from('cargos').select('id, nome, filial_id').eq('status', 'Ativo');
    
    // Filtro estrito
    if (filialId !== 'CENTRAL' && filialId !== '') {
        query = query.eq('filial_id', parseInt(filialId));
    } else {
        query = query.is('filial_id', null);
    }
    const { data } = await query;
    if (!data || data.length === 0) {
        select.innerHTML = '<option value="">Nenhum Cargo Ativo</option>';
        return;
    }
    
    select.innerHTML = '<option value="">Nenhum (Topo da Hierarquia)</option>' + data
        .filter(c => c.id != cargoAtualId)
        .map(c => {
            const fPrefix = c.filial_id === null ? 'Matriz' : (window.mapaFiliais[c.filial_id] || `Filial`);
            return `<option value="${c.id}">[${fPrefix}] - ${c.nome}</option>`;
        }).join('');
};

window.carregarOpcoesSetorParaCargo = async function() {
    const select = document.getElementById('cargoSetorId');
    const filialId = document.getElementById('cargoFilialId').value;
    if (!select) return;
    let query = supabaseClient.from('setores').select('id, nome, filial_id').eq('status', 'Ativo');
    
    // Filtro estrito
    if (filialId !== 'CENTRAL' && filialId !== '') { 
        query = query.eq('filial_id', parseInt(filialId)); 
    } else { 
        query = query.is('filial_id', null); 
    }
    
    const { data } = await query;
    if (!data || data.length === 0) return select.innerHTML = '<option value="">Nenhum Setor Ativo nesta Filial</option>';
    
    select.innerHTML = '<option value="">Selecione o Setor...</option>' + data.map(s => {
        const fPrefix = s.filial_id === null ? 'Matriz' : (window.mapaFiliais[s.filial_id] || `Filial`);
        return `<option value="${s.id}">[${fPrefix}] - ${s.nome}</option>`;
    }).join('');
};

window.carregarOpcoesCentroCustoParaCargo = async function() {
    const select = document.getElementById('cargoCentroCustoId');
    const filialId = document.getElementById('cargoFilialId').value;
    if (!select) return;
    
    let query = supabaseClient.from('centro_custo').select('id, codigo, nome, filial_id').eq('status', 'Ativo');
    
    // Filtro estrito
    if (filialId !== 'CENTRAL' && filialId !== '') { 
        query = query.eq('filial_id', parseInt(filialId)); 
    } else { 
        query = query.is('filial_id', null); 
    }
    
    const { data } = await query;
    if (!data || data.length === 0) return select.innerHTML = '<option value="">Nenhum CC Ativo nesta Filial</option>';
    
    select.innerHTML = '<option value="">Selecione o CC Base...</option>' + data.map(cc => {
        const fPrefix = cc.filial_id === null ? 'Matriz' : (window.mapaFiliais[cc.filial_id] || `Filial`);
        return `<option value="${cc.id}">[${fPrefix}] [${cc.codigo}] - ${cc.nome}</option>`;
    }).join('');
};

window.carregarCargos = async function() {
    const tbody = document.getElementById('tbodyCargos');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Carregando dados...</td></tr>';
    try {
        let query = supabaseClient.from('cargos').select('*, setores(nome), centro_custo(nome)').order('nivel_hierarquico');
        
        // Filtro de filial estrito
        const filialLogada = obterFilialUsuarioLogado();
        if (filialLogada !== null) {
            query = query.eq('filial_id', filialLogada);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) return tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #94a3b8;">Nenhum Cargo cadastrado.</td></tr>';

        const filiaisMap = new Map();
        filiaisMap.set('CENTRAL', { nome: 'Matriz Corporativa', cargos: [] });
        
        const filiaisIds = Object.keys(window.mapaFiliais || {}).map(Number).sort((a, b) => a - b);
        filiaisIds.forEach(id => {
            filiaisMap.set(id, { nome: window.mapaFiliais[id], cargos: [] });
        });

        data.forEach(cargo => {
            const fKey = cargo.filial_id === null ? 'CENTRAL' : Number(cargo.filial_id);
            if (!filiaisMap.has(fKey)) {
                filiaisMap.set(fKey, { nome: `Filial ID: ${fKey}`, cargos: [] });
            }
            filiaisMap.get(fKey).cargos.push(cargo);
        });

        function buildHierarchy(cargosGroup) {
            const groupIds = new Set(cargosGroup.map(c => c.id));
            let result = [];
            
            const roots = cargosGroup.filter(c => !c.cargo_superior_id || !groupIds.has(c.cargo_superior_id));
            
            roots.sort((a, b) => a.nome.localeCompare(b.nome));

            function traverse(node, level) {
                node.treeLevel = level;
                result.push(node);
                const children = cargosGroup.filter(c => c.cargo_superior_id === node.id);
                children.sort((a, b) => a.nome.localeCompare(b.nome));
                children.forEach(child => traverse(child, level + 1));
            }
            roots.forEach(root => traverse(root, 0));
            return result;
        }

        let html = '';
        filiaisMap.forEach((group, fKey) => {
            if (group.cargos.length === 0) return;
            html += `
                <tr style="background: rgba(15, 23, 42, 0.9); border-bottom: 2px solid #3b82f6;">
                    <td colspan="7" style="padding: 15px 12px; font-weight: 700; color: #38bdf8; font-size: 1.1rem; letter-spacing: 0.5px; border-top: 20px solid transparent; background-clip: padding-box;">
                        <i class="fas fa-building" style="margin-right: 8px;"></i> ${group.nome}
                    </td>
                </tr>
            `;

            const hierarchicalCargos = buildHierarchy(group.cargos);

            hierarchicalCargos.forEach(cargo => {
                const isRoot = cargo.treeLevel === 0;
                const indent = cargo.treeLevel * 25;
                const prefix = isRoot ? '' : `<span style="color: #64748b; margin-right: 6px; font-size: 0.8rem;"> </span>`;
                
                const bClass = cargo.status === 'Ativo' ? 'color: #4ade80;' : 'color: #f87171;';
                const setorNome = cargo.setores ? cargo.setores.nome : 'N/A';
                const ccNome = cargo.centro_custo ? cargo.centro_custo.nome : 'Global/Nenhum';
                const filialNome = fKey === 'CENTRAL' ? '<span style="color:#fde047">Matriz Corporativa</span>' : group.nome;
                
                const cargoJsonSeguro = JSON.stringify(cargo).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
                
                const nomeWeight = isRoot ? '700' : '500';
                const nomeColor = isRoot ? '#fde047' : '#f59e0b';
                const bgRow = isRoot ? 'rgba(255,255,255,0.02)' : 'transparent';

                html += `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); background: ${bgRow};">
                        <td style="padding: 12px; padding-left: ${12 + indent}px; font-weight: ${nomeWeight}; color: ${nomeColor};">
                            ${prefix} ${cargo.nome}
                        </td>
                        <td style="padding: 12px; color: #cbd5e1; font-size: 0.85rem;">${filialNome}</td>
                        <td style="padding: 12px; color: #f8fafc; font-size: 0.85rem;">${cargo.nivel_hierarquico}</td>
                        <td style="padding: 12px; color: #94a3b8; font-size: 0.85rem;">${setorNome}</td>
                        <td style="padding: 12px; color: #60a5fa; font-size: 0.85rem;">${ccNome}</td>
                        <td style="padding: 12px;"><span style="${bClass} font-size: 0.85rem;">${cargo.status}</span></td>
                        <td style="padding: 12px; text-align: center;">
                            <button onclick="abrirModalCargo(${cargoJsonSeguro})" style="background: none; border: none; color: #fbbf24; cursor: pointer; margin-right: 10px;" title="Editar"><i class="fas fa-edit"></i></button>
                            <button onclick="excluirCargo(${cargo.id})" style="background: none; border: none; color: #ef4444; cursor: pointer;" title="Excluir"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>`;
            });
        });
        tbody.innerHTML = html;
    } catch (e) { 
        console.error(e); 
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #ef4444;">Erro ao carregar cargos e organograma.</td></tr>'; 
    }
};

window.abrirModalCargo = function(cargo = null) {
    document.getElementById('modalCargo').style.display = 'flex';
    carregarOpcoesFilialGenerico('cargoFilialId').then(() => {
        const filialLogada = obterFilialUsuarioLogado();
        if (cargo && cargo.id) {
            document.getElementById('modalCargoTitle').innerText = '  Editar Cargo';
            document.getElementById('cargoId').value = cargo.id; 
            document.getElementById('cargoFilialId').value = cargo.filial_id === null ? 'CENTRAL' : cargo.filial_id;
            
            atualizarFiltrosCargo().then(() => {
                document.getElementById('cargoNome').value = cargo.nome;
                document.getElementById('cargoHierarquia').value = cargo.nivel_hierarquico;
                document.getElementById('cargoStatus').value = cargo.status || 'Ativo';
                document.getElementById('cargoSetorId').value = cargo.setor_id;
                document.getElementById('cargoCentroCustoId').value = cargo.centro_custo_id;
                document.getElementById('cargoSuperiorId').value = cargo.cargo_superior_id || '';
            });
        } else {
            document.getElementById('modalCargoTitle').innerText = '  Novo Cargo / Posição';
            document.getElementById('cargoId').value = '';
            document.getElementById('cargoFilialId').value = filialLogada === null ? 'CENTRAL' : filialLogada;
            
            atualizarFiltrosCargo().then(() => {
                document.getElementById('cargoNome').value = '';
                document.getElementById('cargoHierarquia').value = 'Operacional';
                document.getElementById('cargoStatus').value = 'Ativo';
                document.getElementById('cargoSetorId').value = '';
                document.getElementById('cargoCentroCustoId').value = '';
                document.getElementById('cargoSuperiorId').value = '';
            });
        }
    });
};

window.fecharModalCargo = () => document.getElementById('modalCargo').style.display = 'none';

window.salvarCargo = async function() {
    const id = document.getElementById('cargoId').value;
    const superiorVal = document.getElementById('cargoSuperiorId').value;
    const nomeCargo = document.getElementById('cargoNome').value.trim();
    const payload = {
        filial_id: obterFilialDb('cargoFilialId'),
        nome: nomeCargo,
        nivel_hierarquico: document.getElementById('cargoHierarquia').value,
        nivel_acesso: nomeCargo,
        setor_id: parseInt(document.getElementById('cargoSetorId').value),
        centro_custo_id: parseInt(document.getElementById('cargoCentroCustoId').value),
        cargo_superior_id: superiorVal ? parseInt(superiorVal) : null,
        status: document.getElementById('cargoStatus').value
    };
    if (!payload.nome || isNaN(payload.setor_id) || isNaN(payload.centro_custo_id)) {
        return alert("  Preencha o Nome, Setor e Centro de Custo corretamente.");
    }
    
    try {
        let dbError;
        if (id) {
            const { error } = await supabaseClient.from('cargos').update(payload).eq('id', id);
            dbError = error;
        } else {
            const { error } = await supabaseClient.from('cargos').insert([payload]);
            dbError = error;
        }
        if (dbError) throw dbError;
        
        fecharModalCargo();
        await carregarCargos();
    } catch (e) {
        console.error("Erro no Supabase:", e);
        if (e.code === '23505' || e.status === 409 || (e.message && e.message.includes('duplicate key'))) {
            alert("Erro 409 (Conflito): O Nome do Cargo informado já está cadastrado.");
        } else {
            const msg = e.message || e.details || (e.error && e.error.message) || JSON.stringify(e);
            alert(`Falha no Banco de Dados ao salvar Cargo:\n\n${msg}`);
        }
    }
};

window.excluirCargo = async function(id) {
    if (!confirm("Excluir este Cargo? O acesso dos usuários pode ser comprometido.")) return;
    await supabaseClient.from('cargos').delete().eq('id', id);
    await carregarCargos();
};


// =====================================================================
// RESPONSÁVEIS POR SETOR
// =====================================================================
window.carregarOpcoesSetorParaResponsavel = async function() {
    const select = document.getElementById('respSetorId');
    const filialId = document.getElementById('respFilialId').value;
    if (!select) return;
    let query = supabaseClient.from('setores').select('id, nome, filial_id').eq('status', 'Ativo');
    
    // Filtro estrito
    if (filialId !== 'CENTRAL' && filialId !== '') { 
        query = query.eq('filial_id', parseInt(filialId)); 
    } else { 
        query = query.is('filial_id', null); 
    }
    
    const { data } = await query;
    if (!data || data.length === 0) return select.innerHTML = '<option value="">Nenhum Setor Ativo nesta Filial</option>';
    
    select.innerHTML = '<option value="">Selecione o Setor...</option>' + data.map(s => {
        const fPrefix = s.filial_id === null ? 'Matriz' : (window.mapaFiliais[s.filial_id] || `Filial`);
        return `<option value="${s.id}">[${fPrefix}] - ${s.nome}</option>`;
    }).join('');
};

window.carregarResponsaveis = async function() {
    const tbody = document.getElementById('tbodyResponsaveis');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Carregando dados...</td></tr>';
    try {
        let query = supabaseClient.from('responsaveis_setor').select('*, setores(nome)').order('nome_responsavel');
        
        // Filtro de filial estrito
        const filialLogada = obterFilialUsuarioLogado();
        if (filialLogada !== null) {
            query = query.eq('filial_id', filialLogada);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) return tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #94a3b8;">Nenhum Responsável cadastrado.</td></tr>';
        
        // AGRUPAMENTO POR FILIAL
        const filiaisMap = new Map();
        filiaisMap.set('CENTRAL', { nome: 'Matriz Corporativa', items: [] });
        
        const filiaisIds = Object.keys(window.mapaFiliais || {}).map(Number).sort((a, b) => a - b);
        filiaisIds.forEach(id => {
            filiaisMap.set(id, { nome: window.mapaFiliais[id], items: [] });
        });
        
        data.forEach(resp => {
            const fKey = resp.filial_id === null ? 'CENTRAL' : Number(resp.filial_id);
            if (!filiaisMap.has(fKey)) filiaisMap.set(fKey, { nome: `Filial ID: ${fKey}`, items: [] });
            filiaisMap.get(fKey).items.push(resp);
        });
        
        let html = '';
        filiaisMap.forEach((group, fKey) => {
            if (group.items.length === 0) return;
            html += `
                <tr style="background: rgba(15, 23, 42, 0.9); border-bottom: 2px solid #3b82f6;">
                    <td colspan="6" style="padding: 15px 12px; font-weight: 700; color: #38bdf8; font-size: 1.1rem; letter-spacing: 0.5px; border-top: 20px solid transparent; background-clip: padding-box;">
                        <i class="fas fa-building" style="margin-right: 8px;"></i> ${group.nome}
                    </td>
                </tr>
            `;
            group.items.forEach(resp => {
                const bClass = resp.status === 'Ativo' ? 'color: #4ade80;' : 'color: #f87171;';
                const filialNome = fKey === 'CENTRAL' ? '<span style="color:#fde047">Matriz Corporativa</span>' : group.nome;
                const setorNome = resp.setores ? resp.setores.nome : 'Desconhecido';
                const respJsonSeguro = JSON.stringify(resp).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
                
                html += `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); background: transparent;">
                        <td style="padding: 12px; font-weight: bold; color: #f8fafc; padding-left: 25px;">${resp.nome_responsavel}</td>
                        <td style="padding: 12px; color: #cbd5e1;">${resp.cargo}</td>
                        <td style="padding: 12px; color: #94a3b8;">${setorNome}</td>
                        <td style="padding: 12px; color: #f8fafc;">${filialNome}</td>
                        <td style="padding: 12px;"><span style="${bClass}">${resp.status}</span></td>
                        <td style="padding: 12px; text-align: center;">
                            <button onclick="abrirModalResponsavel(${respJsonSeguro})" style="background: none; border: none; color: #fbbf24; cursor: pointer; margin-right: 10px;" title="Editar"><i class="fas fa-edit"></i></button>
                            <button onclick="excluirResponsavel(${resp.id})" style="background: none; border: none; color: #ef4444; cursor: pointer;" title="Excluir"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>`;
            });
        });
        tbody.innerHTML = html;
    } catch (e) { 
        console.error(e); 
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #ef4444;">Erro ao carregar responsáveis.</td></tr>'; 
    }
};

window.abrirModalResponsavel = function(resp = null) {
    document.getElementById('modalResponsavel').style.display = 'flex';
    carregarOpcoesFilialGenerico('respFilialId').then(() => {
        const filialLogada = obterFilialUsuarioLogado();
        if (resp && resp.id) {
            document.getElementById('modalResponsavelTitle').innerText = '  Editar Responsável';
            document.getElementById('respId').value = resp.id;
            document.getElementById('respFilialId').value = resp.filial_id === null ? 'CENTRAL' : resp.filial_id;
            
            carregarOpcoesSetorParaResponsavel().then(() => {
                document.getElementById('respNome').value = resp.nome_responsavel;
                document.getElementById('respCargo').value = resp.cargo;
                document.getElementById('respSetorId').value = resp.setor_id;
                document.getElementById('respStatus').value = resp.status || 'Ativo';
            });
        } else {
            document.getElementById('modalResponsavelTitle').innerText = '  Novo Responsável por Setor';
            document.getElementById('respId').value = '';
            document.getElementById('respFilialId').value = filialLogada === null ? 'CENTRAL' : filialLogada;
            
            carregarOpcoesSetorParaResponsavel().then(() => {
                document.getElementById('respNome').value = '';
                document.getElementById('respCargo').value = '';
                document.getElementById('respSetorId').value = '';
                document.getElementById('respStatus').value = 'Ativo';
            });
        }
    });
};

window.fecharModalResponsavel = () => document.getElementById('modalResponsavel').style.display = 'none';

window.salvarResponsavel = async function() {
    const id = document.getElementById('respId').value;
    const nome = document.getElementById('respNome').value.trim();
    const cargo = document.getElementById('respCargo').value;
    const setor_id = parseInt(document.getElementById('respSetorId').value);
    
    if (!nome || !cargo || isNaN(setor_id)) {
        return alert("Preencha o Nome, Cargo e Selecione o Setor Corretamente.");
    }
    
    const payload = {
        filial_id: obterFilialDb('respFilialId'),
        nome_responsavel: nome,
        cargo: cargo,
        setor_id: setor_id,
        status: document.getElementById('respStatus').value
    };
    
    try {
        let dbError;
        if (id) {
            const { error } = await supabaseClient.from('responsaveis_setor').update(payload).eq('id', id);
            dbError = error;
        } else {
            const { error } = await supabaseClient.from('responsaveis_setor').insert([payload]);
            dbError = error;
        }
        if (dbError) throw dbError;
        
        fecharModalResponsavel();
        await carregarResponsaveis();
    } catch (e) {
        console.error("Erro no Supabase:", e);
        if (e.code === '23505' || e.status === 409 || (e.message && e.message.includes('duplicate key'))) {
            alert("Erro 409 (Conflito): Este Responsável já está cadastrado.");
        } else {
            alert("Erro ao salvar o Responsável. Verifique o console."); 
        }
    }
};

window.excluirResponsavel = async function(id) {
    if (!confirm("Tem certeza que deseja excluir este Responsável?")) return;
    await supabaseClient.from('responsaveis_setor').delete().eq('id', id);
    await carregarResponsaveis();
};