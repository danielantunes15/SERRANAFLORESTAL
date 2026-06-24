// ==================== modules/campo/alocacao/alocacao.js ====================

window.carregarAlocacaoCampo = async function() {
    if (typeof window.supabaseClient === 'undefined') return;

    try {
        const pMaquinas = window.supabaseClient.from('maquinas_campo').select('*');
        const pEquipe = window.supabaseClient.from('equipe_campo').select('*').order('nome');
        
        const [resMaquinas, resEquipe] = await Promise.all([pMaquinas, pEquipe]);
        
        window.maquinasCampo = resMaquinas.data || [];
        window.equipeCampo = resEquipe.data || [];
        
        window.renderizarTabelaAlocacaoCampo();
    } catch (error) {
        console.error("Erro ao carregar dados de alocação:", error);
    }
};

window.renderizarTabelaAlocacaoCampo = function() {
    const tbody = document.getElementById('alocacaoCampoList');
    if (!tbody) return;

    if (window.equipeCampo.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="padding: 20px; color: #94a3b8;">Nenhum operador na equipe.</td></tr>`;
        return;
    }

    let html = '';
    
    // Organizar por Líderes Primeiro e depois alfabético
    const equipeSort = [...window.equipeCampo].sort((a, b) => {
        const isLiderA = a.funcao === 'Líder de Campo' ? -1 : 1;
        const isLiderB = b.funcao === 'Líder de Campo' ? -1 : 1;
        return (isLiderA - isLiderB) || a.nome.localeCompare(b.nome);
    });

    equipeSort.forEach(op => {
        let nomeFrente = "Reserva/Nenhuma";
        if (op.maquina_id) {
            const m = window.maquinasCampo.find(x => String(x.id) === String(op.maquina_id));
            if (m) nomeFrente = m.nome || `Frente ${m.id}`;
        }

        const iconLider = op.funcao === 'Líder de Campo' ? '<i class="fas fa-crown" style="color: #fbbf24; margin-right: 5px;" title="Líder"></i>' : '';
        const colorName = op.funcao === 'Líder de Campo' ? 'color: #fbbf24;' : 'color: #fff;';

        html += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
            <td style="padding: 10px; text-align: left; font-weight: bold; ${colorName}">${iconLider}${op.nome}</td>
            <td style="padding: 10px; color: #cbd5e1;">${op.funcao || 'Operador'}</td>
            <td style="padding: 10px; color: #38bdf8; font-weight: bold;">${op.turno || '-'}</td>
            <td style="padding: 10px;"><span style="background: rgba(168,85,247,0.15); border: 1px solid #a855f7; color: #c084fc; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">${op.equipe || '-'}</span></td>
            <td style="padding: 10px; font-weight: bold;">${nomeFrente}</td>
            <td style="padding: 10px; color: #10b981; font-weight: bold;">${op.maquina_especifica || '-'}</td>
            <td style="padding: 10px;">
                <button class="btn-primary-blue" style="padding: 4px 10px; font-size: 0.75rem;" onclick="window.abrirModalAlocacaoRapida(${op.id})">⚙️ Configurar</button>
            </td>
        </tr>`;
    });

    tbody.innerHTML = html;
};

window.popularFrentesAlocacao = function() {
    const select = document.getElementById('alocFormMaquina');
    if (!select) return;
    let html = '<option value="">Deixar em Reserva</option>';
    window.maquinasCampo.forEach(m => {
        html += `<option value="${m.id}">${m.nome || `Frente ${m.id}`}</option>`;
    });
    select.innerHTML = html;
};

window.abrirModalAlocacaoRapida = function(id) {
    const op = window.equipeCampo.find(x => String(x.id) === String(id));
    if (!op) return;

    window.popularFrentesAlocacao();

    document.getElementById('alocFormId').value = op.id;
    document.getElementById('alocNomeExibicao').innerText = op.nome;
    document.getElementById('alocFormFuncao').value = op.funcao || 'Operador de Máquina';
    document.getElementById('alocFormMaquina').value = op.maquina_id || '';
    document.getElementById('alocFormMaquinaEspecifica').value = op.maquina_especifica || '';
    document.getElementById('alocFormEquipe').value = op.equipe || 'Fixo Frente A';
    document.getElementById('alocFormTurno').value = op.turno || '06:00 - 18:00';

    document.getElementById('modalAlocacaoRapida').classList.add('show');
};

window.fecharModalAlocacaoRapida = function() {
    document.getElementById('modalAlocacaoRapida').classList.remove('show');
};

window.salvarAlocacaoRapida = async function() {
    const id = document.getElementById('alocFormId').value;
    const funcao = document.getElementById('alocFormFuncao').value;
    const maqId = document.getElementById('alocFormMaquina').value;
    const maqEspec = document.getElementById('alocFormMaquinaEspecifica').value;
    const equipe = document.getElementById('alocFormEquipe').value;
    const turno = document.getElementById('alocFormTurno').value;

    const payload = {
        funcao: funcao,
        maquina_id: maqId ? Number(maqId) : null,
        maquina_especifica: maqEspec,
        equipe: equipe,
        turno: turno
    };

    try {
        await window.supabaseClient.from('equipe_campo').update(payload).eq('id', id);
        window.fecharModalAlocacaoRapida();
        await window.carregarAlocacaoCampo();
    } catch (error) {
        console.error("Erro ao salvar alocação rápida", error);
        alert("Erro ao salvar configuração.");
    }
};

setTimeout(() => {
    if (typeof window.carregarAlocacaoCampo === 'function') window.carregarAlocacaoCampo();
}, 500);