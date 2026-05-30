// ==================== MÓDULO UNIFICADO: GESTÃO DE CUSTOS (ABC) ====================

// --- Inicialização e Navegação de Abas ---
window.initControladoria = async function() {
    await carregarCentrosCusto();
    await carregarObjetosCusto();
    await carregarAtividades();
};

window.switchTabControladoria = function(tabId, btnElement) {
    document.querySelectorAll('.ctrl-tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.ctrl-tab-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    btnElement.classList.add('active');

    // Recarrega os selects se o usuário mudar de aba (para pegar dados novos)
    if (tabId === 'tab-obj') carregarOpcoesCentroCusto();
    if (tabId === 'tab-ativ') carregarOpcoesObjetoCustoAtiv();
};

// =====================================================================
// NÍVEL 1: CENTRO DE CUSTO
// =====================================================================
window.carregarCentrosCusto = async function() {
    const filialAtual = (currentUser && currentUser.filial_id) ? currentUser.filial_id : 'CENTRAL';
    const tbody = document.getElementById('tbodyCentrosCusto');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Carregando dados...</td></tr>';

    try {
        const { data, error } = await supabaseClient.from('centro_custo').select('*').eq('filial_id', filialAtual).order('codigo', { ascending: true });
        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Nenhum Centro de Custo cadastrado.</td></tr>';
            return;
        }

        let html = '';
        data.forEach(cc => {
            const badgeClass = cc.status === 'Ativo' ? 'background: rgba(34,197,94,0.2); color: #4ade80;' : 'background: rgba(239,68,68,0.2); color: #f87171;';
            html += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 12px; font-weight: bold; color: #60a5fa;">${cc.codigo}</td>
                    <td style="padding: 12px; color: #f8fafc;">${cc.nome}</td>
                    <td style="padding: 12px; color: #94a3b8; font-size: 0.85rem;">${cc.descricao || '-'}</td>
                    <td style="padding: 12px;"><span style="padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; ${badgeClass}">${cc.status}</span></td>
                    <td style="padding: 12px; text-align: center;">
                        <button onclick='abrirModalCentroCusto(${JSON.stringify(cc)})' style="background: none; border: none; color: #fbbf24; cursor: pointer; margin-right: 10px;" title="Editar"><i class="fas fa-edit"></i></button>
                        <button onclick="excluirCentroCusto(${cc.id})" style="background: none; border: none; color: #ef4444; cursor: pointer;" title="Excluir"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
        });
        tbody.innerHTML = html;
    } catch (e) { console.error(e); tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ef4444;">Erro ao carregar dados.</td></tr>'; }
};

window.abrirModalCentroCusto = function(cc = null) {
    document.getElementById('modalCentroCusto').style.display = 'flex';
    if (cc && cc.id) {
        document.getElementById('modalCentroCustoTitle').innerText = '✏️ Editar Centro de Custo';
        document.getElementById('ccId').value = cc.id;
        document.getElementById('ccCodigo').value = cc.codigo;
        document.getElementById('ccNome').value = cc.nome;
        document.getElementById('ccDescricao').value = cc.descricao || '';
        document.getElementById('ccStatus').value = cc.status || 'Ativo';
    } else {
        document.getElementById('modalCentroCustoTitle').innerText = '🏢 Novo Centro de Custo';
        document.getElementById('ccId').value = '';
        document.getElementById('ccCodigo').value = '';
        document.getElementById('ccNome').value = '';
        document.getElementById('ccDescricao').value = '';
        document.getElementById('ccStatus').value = 'Ativo';
    }
};

window.fecharModalCentroCusto = () => document.getElementById('modalCentroCusto').style.display = 'none';

window.salvarCentroCusto = async function() {
    const id = document.getElementById('ccId').value;
    const payload = {
        filial_id: (currentUser && currentUser.filial_id) ? currentUser.filial_id : 'CENTRAL',
        codigo: document.getElementById('ccCodigo').value.trim(),
        nome: document.getElementById('ccNome').value.trim(),
        descricao: document.getElementById('ccDescricao').value.trim(),
        status: document.getElementById('ccStatus').value
    };
    if (!payload.codigo || !payload.nome) return alert("Preencha Código e Nome.");

    try {
        if (id) await supabaseClient.from('centro_custo').update(payload).eq('id', id);
        else await supabaseClient.from('centro_custo').insert([payload]);
        fecharModalCentroCusto();
        await carregarCentrosCusto();
    } catch (e) { alert(e.code === '23505' ? "Já existe este CÓDIGO." : "Erro ao salvar."); }
};

window.excluirCentroCusto = async function(id) {
    if (!confirm("Excluir este Centro de Custo deletará também os Objetos de Custo e Atividades vinculados. Deseja continuar?")) return;
    await supabaseClient.from('centro_custo').delete().eq('id', id);
    await carregarCentrosCusto();
};

// =====================================================================
// NÍVEL 2: OBJETOS DE CUSTO
// =====================================================================
window.carregarOpcoesCentroCusto = async function() {
    const filialAtual = (currentUser && currentUser.filial_id) ? currentUser.filial_id : 'CENTRAL';
    const select = document.getElementById('objCentroCustoId');
    if (!select) return;
    const { data } = await supabaseClient.from('centro_custo').select('id, codigo, nome').eq('filial_id', filialAtual).eq('status', 'Ativo');
    if (!data || data.length === 0) return select.innerHTML = '<option value="">Nenhum Centro Ativo</option>';
    select.innerHTML = '<option value="">Selecione...</option>' + data.map(cc => `<option value="${cc.id}">[${cc.codigo}] - ${cc.nome}</option>`).join('');
};

window.carregarObjetosCusto = async function() {
    const filialAtual = (currentUser && currentUser.filial_id) ? currentUser.filial_id : 'CENTRAL';
    const tbody = document.getElementById('tbodyObjetosCusto');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Carregando dados...</td></tr>';

    try {
        const { data, error } = await supabaseClient.from('objetos_custo').select('*, centro_custo(codigo, nome)').eq('filial_id', filialAtual).order('codigo');
        if (error) throw error;
        if (!data || data.length === 0) return tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #94a3b8;">Nenhum Objeto de Custo.</td></tr>';

        let html = '';
        data.forEach(obj => {
            let bClass = obj.status === 'Ativo' ? 'color: #4ade80;' : (obj.status === 'Inativo' ? 'color: #f87171;' : 'color: #fbbf24;');
            const ccDisplay = obj.centro_custo ? `[${obj.centro_custo.codigo}] ${obj.centro_custo.nome}` : 'Desconhecido';
            html += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 12px; font-weight: bold; color: #c084fc;">${obj.codigo}</td>
                    <td style="padding: 12px; color: #f8fafc;">${obj.nome}</td>
                    <td style="padding: 12px; color: #94a3b8; font-size: 0.85rem;">${obj.tipo || '-'}</td>
                    <td style="padding: 12px; color: #cbd5e1; font-size: 0.85rem;">${ccDisplay}</td>
                    <td style="padding: 12px;"><span style="${bClass}">${obj.status}</span></td>
                    <td style="padding: 12px; text-align: center;">
                        <button onclick='abrirModalObjetoCusto(${JSON.stringify(obj)})' style="background: none; border: none; color: #fbbf24; cursor: pointer; margin-right: 10px;"><i class="fas fa-edit"></i></button>
                        <button onclick="excluirObjetoCusto(${obj.id})" style="background: none; border: none; color: #ef4444; cursor: pointer;"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
        });
        tbody.innerHTML = html;
    } catch (e) { console.error(e); }
};

window.abrirModalObjetoCusto = function(obj = null) {
    document.getElementById('modalObjetoCusto').style.display = 'flex';
    if (obj && obj.id) {
        document.getElementById('modalObjetoCustoTitle').innerText = '✏️ Editar Objeto de Custo';
        document.getElementById('objId').value = obj.id;
        document.getElementById('objCentroCustoId').value = obj.centro_custo_id;
        document.getElementById('objCodigo').value = obj.codigo;
        document.getElementById('objNome').value = obj.nome;
        document.getElementById('objTipo').value = obj.tipo || 'Outros';
        document.getElementById('objDescricao').value = obj.descricao || '';
        document.getElementById('objStatus').value = obj.status || 'Ativo';
    } else {
        document.getElementById('modalObjetoCustoTitle').innerText = '🏷️ Novo Objeto de Custo';
        document.getElementById('objId').value = '';
        document.getElementById('objCentroCustoId').value = '';
        document.getElementById('objCodigo').value = '';
        document.getElementById('objNome').value = '';
        document.getElementById('objTipo').value = 'Veículo Pesado';
        document.getElementById('objDescricao').value = '';
        document.getElementById('objStatus').value = 'Ativo';
    }
};

window.fecharModalObjetoCusto = () => document.getElementById('modalObjetoCusto').style.display = 'none';

window.salvarObjetoCusto = async function() {
    const id = document.getElementById('objId').value;
    const cc_id = document.getElementById('objCentroCustoId').value;
    const payload = {
        filial_id: (currentUser && currentUser.filial_id) ? currentUser.filial_id : 'CENTRAL',
        centro_custo_id: parseInt(cc_id),
        codigo: document.getElementById('objCodigo').value.trim(),
        nome: document.getElementById('objNome').value.trim(),
        tipo: document.getElementById('objTipo').value,
        descricao: document.getElementById('objDescricao').value.trim(),
        status: document.getElementById('objStatus').value
    };
    if (!cc_id || !payload.codigo || !payload.nome) return alert("Preencha CC, Código e Nome.");

    try {
        if (id) await supabaseClient.from('objetos_custo').update(payload).eq('id', id);
        else await supabaseClient.from('objetos_custo').insert([payload]);
        fecharModalObjetoCusto();
        await carregarObjetosCusto();
    } catch (e) { alert(e.code === '23505' ? "Já existe este CÓDIGO." : "Erro ao salvar."); }
};

window.excluirObjetoCusto = async function(id) {
    if (!confirm("Excluir este Objeto deletará também suas Atividades vinculadas. Continuar?")) return;
    await supabaseClient.from('objetos_custo').delete().eq('id', id);
    await carregarObjetosCusto();
};

// =====================================================================
// NÍVEL 3: ATIVIDADES / PROCESSOS
// =====================================================================
window.carregarOpcoesObjetoCustoAtiv = async function() {
    const filialAtual = (currentUser && currentUser.filial_id) ? currentUser.filial_id : 'CENTRAL';
    const select = document.getElementById('ativObjetoCustoId');
    if (!select) return;
    const { data } = await supabaseClient.from('objetos_custo').select('id, nome, centro_custo(nome)').eq('filial_id', filialAtual).eq('status', 'Ativo');
    if (!data || data.length === 0) return select.innerHTML = '<option value="">Nenhum Objeto Ativo</option>';
    select.innerHTML = '<option value="">Selecione...</option>' + data.map(obj => `<option value="${obj.id}">[${obj.centro_custo ? obj.centro_custo.nome : 'Sem CC'}] ➔ ${obj.nome}</option>`).join('');
};

window.carregarAtividades = async function() {
    const filialAtual = (currentUser && currentUser.filial_id) ? currentUser.filial_id : 'CENTRAL';
    const tbody = document.getElementById('tbodyAtividades');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Carregando dados...</td></tr>';

    try {
        const { data, error } = await supabaseClient.from('atividades_processos').select('*, objetos_custo(codigo, nome, centro_custo(nome))').eq('filial_id', filialAtual).order('codigo');
        if (error) throw error;
        if (!data || data.length === 0) return tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #94a3b8;">Nenhuma Atividade.</td></tr>';

        let html = '';
        data.forEach(ativ => {
            let bClass = ativ.status === 'Ativo' ? 'color: #4ade80;' : 'color: #f87171;';
            const objDisplay = ativ.objetos_custo ? `[${ativ.objetos_custo.codigo}] ${ativ.objetos_custo.nome}` : 'Desconhecido';
            const ccDisplay = (ativ.objetos_custo && ativ.objetos_custo.centro_custo) ? ativ.objetos_custo.centro_custo.nome : 'Desconhecido';

            html += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 12px; font-weight: bold; color: #34d399;">${ativ.codigo}</td>
                    <td style="padding: 12px; color: #f8fafc;">${ativ.nome}</td>
                    <td style="padding: 12px; color: #c084fc; font-size: 0.85rem;">${objDisplay}</td>
                    <td style="padding: 12px; color: #60a5fa; font-size: 0.85rem;">${ccDisplay}</td>
                    <td style="padding: 12px;"><span style="${bClass}">${ativ.status}</span></td>
                    <td style="padding: 12px; text-align: center;">
                        <button onclick='abrirModalAtividade(${JSON.stringify(ativ)})' style="background: none; border: none; color: #fbbf24; cursor: pointer; margin-right: 10px;"><i class="fas fa-edit"></i></button>
                        <button onclick="excluirAtividade(${ativ.id})" style="background: none; border: none; color: #ef4444; cursor: pointer;"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
        });
        tbody.innerHTML = html;
    } catch (e) { console.error(e); }
};

window.abrirModalAtividade = function(ativ = null) {
    document.getElementById('modalAtividade').style.display = 'flex';
    if (ativ && ativ.id) {
        document.getElementById('modalAtividadeTitle').innerText = '✏️ Editar Atividade';
        document.getElementById('ativId').value = ativ.id;
        document.getElementById('ativObjetoCustoId').value = ativ.objeto_custo_id;
        document.getElementById('ativCodigo').value = ativ.codigo;
        document.getElementById('ativNome').value = ativ.nome;
        document.getElementById('ativDescricao').value = ativ.descricao || '';
        document.getElementById('ativStatus').value = ativ.status || 'Ativo';
    } else {
        document.getElementById('modalAtividadeTitle').innerText = '⚙️ Nova Atividade';
        document.getElementById('ativId').value = '';
        document.getElementById('ativObjetoCustoId').value = '';
        document.getElementById('ativCodigo').value = '';
        document.getElementById('ativNome').value = '';
        document.getElementById('ativDescricao').value = '';
        document.getElementById('ativStatus').value = 'Ativo';
    }
};

window.fecharModalAtividade = () => document.getElementById('modalAtividade').style.display = 'none';

window.salvarAtividade = async function() {
    const id = document.getElementById('ativId').value;
    const obj_id = document.getElementById('ativObjetoCustoId').value;
    const payload = {
        filial_id: (currentUser && currentUser.filial_id) ? currentUser.filial_id : 'CENTRAL',
        objeto_custo_id: parseInt(obj_id),
        codigo: document.getElementById('ativCodigo').value.trim(),
        nome: document.getElementById('ativNome').value.trim(),
        descricao: document.getElementById('ativDescricao').value.trim(),
        status: document.getElementById('ativStatus').value
    };
    if (!obj_id || !payload.codigo || !payload.nome) return alert("Preencha Objeto, Código e Nome.");

    try {
        if (id) await supabaseClient.from('atividades_processos').update(payload).eq('id', id);
        else await supabaseClient.from('atividades_processos').insert([payload]);
        fecharModalAtividade();
        await carregarAtividades();
    } catch (e) { alert(e.code === '23505' ? "Já existe este CÓDIGO." : "Erro ao salvar."); }
};

window.excluirAtividade = async function(id) {
    if (!confirm("Deseja excluir esta Atividade?")) return;
    await supabaseClient.from('atividades_processos').delete().eq('id', id);
    await carregarAtividades();
};