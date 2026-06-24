// ==================== modules/campo/equipe/equipe.js ====================

window.equipeCampo = [];

window.formatarDescricaoConjunto = function(m) {
    if (!m) return "Sem Vínculo (Reserva)";
    return m.nome || `Frente ${m.id}`;
};

window.carregarEquipeCampo = async function() {
    if (typeof window.supabaseClient === 'undefined') return;

    if (!window.maquinasCampo || window.maquinasCampo.length === 0) {
        try {
            const { data } = await window.supabaseClient.from('maquinas_campo').select('*');
            if (data) window.maquinasCampo = data;
        } catch (e) { console.warn("Erro ao carregar máquinas na equipe"); }
    }

    try {
        const { data, error } = await window.supabaseClient.from('equipe_campo').select('*').order('nome');
        if (error) throw error;
        
        window.equipeCampo = data || [];
        window.renderizarEquipeCampo();
    } catch (e) {
        console.error("Erro ao carregar equipe do campo:", e);
    }
};

window.renderizarEquipeCampo = function() {
    const tbody = document.getElementById('equipeCampoList');
    if (!tbody) return;

    const filtroCargos = document.getElementById('filtroFuncaoEquipe') ? document.getElementById('filtroFuncaoEquipe').value : 'Todos';

    const filtrados = window.equipeCampo.filter(m => {
        return filtroCargos === 'Todos' || m.funcao === filtroCargos;
    });

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="padding: 20px; text-align: center; color: #94a3b8;">Nenhum membro listado ou cadastrado.</td></tr>`;
        return;
    }

    let html = '';
    filtrados.forEach(m => {
        const maq = (window.maquinasCampo || []).find(x => String(x.id) === String(m.maquina_id));
        const descMaquina = window.formatarDescricaoConjunto(maq);

        html += `
        <tr style="background-color: transparent; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;">
            <td style="padding: 10px; text-align: left; font-weight: bold; color: #fff;">${m.nome}</td>
            <td style="padding: 10px; color: #cbd5e1; font-weight: 500;">${m.funcao || 'Operador'}</td>
            <td style="padding: 10px;"><span style="background: rgba(168,85,247,0.15); border: 1px solid #a855f7; color: #c084fc; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 0.75rem;">${m.equipe || '-'}</span></td>
            <td style="padding: 10px; color: #38bdf8; font-weight: bold;">${descMaquina}</td>
            <td style="padding: 10px; color: #10b981; font-weight: bold;">${m.maquina_especifica || '-'}</td>
            <td style="padding: 10px; color: #94a3b8; font-family: monospace;">${m.data_ancora || '-'}</td>
            <td style="padding: 10px;">
                <button class="btn-primary-blue" style="padding: 3px 8px; font-size: 0.75rem; margin-right: 5px;" onclick="window.abrirModalEditarMembroCampo(${m.id})">✏️ Editar</button>
                <button class="btn-secondary-dark" style="padding: 3px 8px; font-size: 0.75rem; background: #ef4444; border-color: #ef4444;" onclick="window.excluirMembroCampo(${m.id})">🗑️ Excluir</button>
            </td>
        </tr>`;
    });

    tbody.innerHTML = html;
};

window.popularSelectMaquinas = function() {
    const select = document.getElementById('formMembroMaquina');
    if (!select) return;

    let html = '<option value="">Deixar em Reserva (Sem Frente)</option>';
    const listaMaquinas = window.maquinasCampo || [];
    listaMaquinas.forEach(m => {
        const desc = window.formatarDescricaoConjunto(m);
        html += `<option value="${m.id}">${desc}</option>`;
    });
    select.innerHTML = html;
};

window.abrirModalNovoMembroCampo = function() {
    window.popularSelectMaquinas();

    document.getElementById('formMembroId').value = '';
    document.getElementById('formMembroNome').value = '';
    document.getElementById('formMembroFuncao').value = 'Operador de Máquina';
    document.getElementById('formMembroEquipe').value = 'Fixo Frente A';
    document.getElementById('formMembroMaquina').value = '';
    document.getElementById('formMembroMaquinaEspecifica').value = '';
    document.getElementById('formMembroTurno').value = '06:00 - 18:00';
    
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('formMembroDataAncora').value = hoje;

    document.getElementById('modalMembroCampo').classList.add('show');
};

window.abrirModalEditarMembroCampo = function(id) {
    window.popularSelectMaquinas();

    const m = window.equipeCampo.find(x => String(x.id) === String(id));
    if (!m) return;

    document.getElementById('formMembroId').value = m.id;
    document.getElementById('formMembroNome').value = m.nome;
    document.getElementById('formMembroFuncao').value = m.funcao || 'Operador de Máquina';
    document.getElementById('formMembroEquipe').value = m.equipe;
    document.getElementById('formMembroMaquina').value = m.maquina_id || '';
    document.getElementById('formMembroMaquinaEspecifica').value = m.maquina_especifica || '';
    document.getElementById('formMembroTurno').value = m.turno || '06:00 - 18:00';
    document.getElementById('formMembroDataAncora').value = m.data_ancora || '';

    document.getElementById('modalMembroCampo').classList.add('show');
};

window.fecharModalMembroCampo = function() {
    document.getElementById('modalMembroCampo').classList.remove('show');
};

window.salvarMembroCampo = async function() {
    const id = document.getElementById('formMembroId').value;
    const nome = document.getElementById('formMembroNome').value.trim();
    const funcao = document.getElementById('formMembroFuncao').value;
    const equipe = document.getElementById('formMembroEquipe').value;
    const maquinaVal = document.getElementById('formMembroMaquina').value;
    const maqEspecifica = document.getElementById('formMembroMaquinaEspecifica').value;
    const turno = document.getElementById('formMembroTurno').value;
    const dataAncora = document.getElementById('formMembroDataAncora').value;

    if (!nome || !dataAncora) {
        alert("Obrigatório informar o nome e a data de ciclo.");
        return;
    }

    const payload = {
        nome: nome,
        funcao: funcao,
        equipe: equipe,
        maquina_id: maquinaVal ? Number(maquinaVal) : null,
        maquina_especifica: maqEspecifica,
        turno: turno,
        data_ancora: dataAncora
    };

    try {
        if (id) {
            await window.supabaseClient.from('equipe_campo').update(payload).eq('id', id);
        } else {
            await window.supabaseClient.from('equipe_campo').insert([payload]);
        }
        
        window.fecharModalMembroCampo();
        await window.carregarEquipeCampo(); 
        
    } catch (e) {
        console.error("Erro ao salvar:", e);
        alert("Erro ao salvar no banco de dados.");
    }
};

window.excluirMembroCampo = async function(id) {
    if (!confirm("Remover permanentemente este membro da equipe de campo?")) return;
    
    try {
        await window.supabaseClient.from('equipe_campo').delete().eq('id', id);
        await window.carregarEquipeCampo();
    } catch (e) {
        console.error("Erro ao excluir:", e);
        alert("Erro ao excluir do banco de dados.");
    }
};

setTimeout(() => {
    if (typeof window.carregarEquipeCampo === 'function') window.carregarEquipeCampo();
}, 500);