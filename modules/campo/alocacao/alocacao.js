// ==================== modules/campo/alocacao/alocacao.js ====================

window.carregarAlocacaoCampo = async function() {
    if (typeof window.supabaseClient === 'undefined') return;

    try {
        document.getElementById('alocacaoCampoCards').innerHTML = '<div style="color:#fff; text-align:center;">Carregando painel de máquinas...</div>';
        
        const pMaquinas = window.supabaseClient.from('maquinas_campo').select('*').order('id');
        const pEquipe = window.supabaseClient.from('equipe_campo').select('*').order('nome');
        
        const [resMaquinas, resEquipe] = await Promise.all([pMaquinas, pEquipe]);
        
        window.maquinasCampo = resMaquinas.data || [];
        window.equipeCampo = resEquipe.data || [];
        
        window.renderizarPainelMaquinasCampo();
    } catch (error) {
        console.error("Erro ao carregar dados de alocação:", error);
    }
};

window.gerarLinhaTabelaAlocacao = function(op, selectFrentes) {
    let frontSel = selectFrentes.replace(`value="${op.maquina_id||''}"`, `value="${op.maquina_id||''}" selected`);
    let dataAncoraValor = op.data_ancora ? op.data_ancora.split('T')[0] : '';
    
    return `
    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);" id="row_aloc_${op.id}">
        <td style="padding: 10px; text-align: left; font-weight: 800; color: #fff; width: 20%;">
            ${op.funcao === 'Líder de Campo' ? '<i class="fas fa-crown" style="color:#fbbf24;"></i> ' : ''}${op.nome}
        </td>
        <td style="padding: 5px;">
            <select class="dark-select" id="aloc_funcao_${op.id}" style="padding: 4px 8px; width: 100%; font-size: 0.8rem;">
                <option value="Operador de Máquina" ${op.funcao==='Operador de Máquina'?'selected':''}>Operador</option>
                <option value="Líder de Campo" ${op.funcao==='Líder de Campo'?'selected':''}>Líder</option>
            </select>
        </td>
        <td style="padding: 5px;">
            <select class="dark-select" id="aloc_equipe_${op.id}" style="padding: 4px 8px; width: 100%; font-size: 0.8rem; border-color: #c084fc;">
                <option value="Fixo" ${op.equipe==='Fixo'?'selected':''}>Fixo</option>
                <option value="Folguista" ${op.equipe==='Folguista'?'selected':''}>Folguista</option>
            </select>
        </td>
        <td style="padding: 5px;">
            <select class="dark-select" id="aloc_turno_${op.id}" style="padding: 4px 8px; width: 100%; font-size: 0.8rem; border-color: #38bdf8;">
                <option value="06:00 - 18:00" ${op.turno==='06:00 - 18:00'?'selected':''}>06:00 - 18:00</option>
                <option value="18:00 - 06:00" ${op.turno==='18:00 - 06:00'?'selected':''}>18:00 - 06:00</option>
            </select>
        </td>
        <td style="padding: 5px;">
            <select class="dark-select" id="aloc_frente_${op.id}" style="padding: 4px 8px; width: 100%; font-size: 0.8rem;">
                ${frontSel}
            </select>
        </td>
        <td style="padding: 5px;">
            <select class="dark-select" id="aloc_maqesp_${op.id}" style="padding: 4px 8px; width: 100%; font-size: 0.8rem;">
                <option value="" ${!op.maquina_especifica?'selected':''}>Nenhuma</option>
                <option value="Máquina 1" ${op.maquina_especifica==='Máquina 1'?'selected':''}>Máquina 1</option>
                <option value="Máquina 2" ${op.maquina_especifica==='Máquina 2'?'selected':''}>Máquina 2</option>
                <option value="Máquina 3" ${op.maquina_especifica==='Máquina 3'?'selected':''}>Máquina 3</option>
            </select>
        </td>
        <td style="padding: 5px;">
            <input type="date" class="dark-select" id="aloc_data_${op.id}" value="${dataAncoraValor}" style="padding: 4px 8px; width: 120px; font-size: 0.8rem; border-color: #f59e0b; background: transparent; color: #fff; color-scheme: dark;" title="Data Inicial do Ciclo">
        </td>
        <td style="padding: 5px; text-align: center;">
            <button class="btn-primary-green" style="padding: 5px 12px; font-size: 0.8rem; font-weight: bold;" onclick="window.salvarAlocacaoLinha(${op.id})">💾 Salvar</button>
        </td>
    </tr>`;
};

window.renderizarPainelMaquinasCampo = function() {
    const container = document.getElementById('alocacaoCampoCards');
    if (!container) return;

    let optionsFrentes = '<option value="">Reserva / Sem Frente</option>';
    window.maquinasCampo.forEach(m => { optionsFrentes += `<option value="${m.id}">${m.nome || `Frente ${m.id}`}</option>`; });

    let html = '';

    window.maquinasCampo.forEach(frente => {
        const membrosFrente = window.equipeCampo.filter(op => String(op.maquina_id) === String(frente.id));
        if (membrosFrente.length === 0) return;

        html += `<div style="background: rgba(15, 23, 42, 0.8); border: 2px solid #3b82f6; border-radius: 10px; padding: 15px;">`;
        html += `<h2 style="color: #3b82f6; margin-top: 0; font-size: 1.3rem; border-bottom: 2px solid rgba(59, 130, 246, 0.3); padding-bottom: 10px; margin-bottom: 20px;"><i class="fas fa-network-wired"></i> ${frente.nome || `Frente ${frente.id}`}</h2>`;
        
        // ---- 1. LÍDERES ----
        const lideres = membrosFrente.filter(op => op.funcao === 'Líder de Campo');
        if (lideres.length > 0) {
            html += `<div style="margin-bottom: 20px; background: rgba(251, 191, 36, 0.1); border: 1px solid #fbbf24; border-radius: 8px; padding: 10px;">
                <h4 style="color: #fbbf24; margin: 0 0 10px 0;"><i class="fas fa-crown"></i> Líderes da Frente</h4>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead><tr style="background: rgba(0,0,0,0.3); color: #cbd5e1; font-size: 0.75rem;"><th style="padding: 8px; text-align:left;">Membro</th><th>Função</th><th>Regime</th><th>Turno</th><th>Frente</th><th>Máquina</th><th>Data Inicial</th><th>Ação</th></tr></thead>
                <tbody>`;
            lideres.forEach(op => html += window.gerarLinhaTabelaAlocacao(op, optionsFrentes));
            html += `</tbody></table></div>`;
        }

        // ---- 2. MÁQUINAS (1 a 3) ----
        ['Máquina 1', 'Máquina 2', 'Máquina 3'].forEach(nomeMaq => {
            const numFrota = frente[nomeMaq === 'Máquina 1' ? 'numero_frota_1' : (nomeMaq === 'Máquina 2' ? 'numero_frota_2' : 'numero_frota_3')];
            if (!numFrota && membrosFrente.filter(o => o.maquina_especifica === nomeMaq).length === 0) return; // Se a máquina não existe e não tem ngm, pula.

            const operadores = membrosFrente.filter(op => op.maquina_especifica === nomeMaq && op.funcao !== 'Líder de Campo');
            
            // Ordenar logicamente os 4 operadores: Fixo Dia, Folguista Dia, Fixo Noite, Folguista Noite
            operadores.sort((a,b) => {
                const peso = o => (o.turno.includes('06:00') ? 0 : 10) + (o.equipe==='Fixo' ? 1 : 2);
                return peso(a) - peso(b);
            });

            html += `<div style="margin-bottom: 15px; background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 10px;">
                <h4 style="color: #34d399; margin: 0 0 10px 0;"><i class="fas fa-tractor"></i> ${nomeMaq} (Frota: ${numFrota || 'S/N'}) - <span style="font-size: 0.8rem; color:#94a3b8;">4 Operadores Ideais</span></h4>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead><tr style="background: rgba(0,0,0,0.3); color: #cbd5e1; font-size: 0.75rem;"><th style="padding: 8px; text-align:left;">Membro</th><th>Função</th><th>Regime</th><th>Turno</th><th>Frente</th><th>Máquina</th><th>Data Inicial</th><th>Ação</th></tr></thead>
                    <tbody>`;
            
            if (operadores.length === 0) {
                html += `<tr><td colspan="8" style="padding: 10px; color:#9ca3af; text-align:center;">Nenhum operador alocado nesta máquina.</td></tr>`;
            } else {
                operadores.forEach(op => html += window.gerarLinhaTabelaAlocacao(op, optionsFrentes));
            }
            html += `</tbody></table></div>`;
        });

        html += `</div>`;
    });

    // ---- 3. RESERVAS ----
    const reservas = window.equipeCampo.filter(op => !op.maquina_id);
    if (reservas.length > 0) {
        html += `<div style="background: rgba(239, 68, 68, 0.1); border: 2px solid #ef4444; border-radius: 10px; padding: 15px;">
            <h2 style="color: #ef4444; margin-top: 0; font-size: 1.3rem; border-bottom: 2px solid rgba(239, 68, 68, 0.3); padding-bottom: 10px; margin-bottom: 20px;"><i class="fas fa-exclamation-triangle"></i> Sem Frente Definida (Reservas)</h2>
            <table style="width: 100%; border-collapse: collapse;">
                <thead><tr style="background: rgba(0,0,0,0.3); color: #cbd5e1; font-size: 0.75rem;"><th style="padding: 8px; text-align:left;">Membro</th><th>Função</th><th>Regime</th><th>Turno</th><th>Frente</th><th>Máquina</th><th>Data Inicial</th><th>Ação</th></tr></thead>
            <tbody>`;
        reservas.forEach(op => html += window.gerarLinhaTabelaAlocacao(op, optionsFrentes));
        html += `</tbody></table></div>`;
    }

    container.innerHTML = html;
};

window.salvarAlocacaoLinha = async function(id) {
    const funcao = document.getElementById(`aloc_funcao_${id}`).value;
    const equipe = document.getElementById(`aloc_equipe_${id}`).value;
    const turno = document.getElementById(`aloc_turno_${id}`).value;
    const frente = document.getElementById(`aloc_frente_${id}`).value;
    const maqEspec = document.getElementById(`aloc_maqesp_${id}`).value;
    const dataAncora = document.getElementById(`aloc_data_${id}`).value;

    const payload = {
        funcao: funcao,
        equipe: equipe,
        turno: turno,
        maquina_id: frente ? Number(frente) : null,
        maquina_especifica: maqEspec,
        data_ancora: dataAncora || null
    };

    try {
        await window.supabaseClient.from('equipe_campo').update(payload).eq('id', id);
        
        // Efeito visual de sucesso na linha
        const row = document.getElementById(`row_aloc_${id}`);
        if(row) {
            row.style.backgroundColor = 'rgba(16, 185, 129, 0.4)';
            setTimeout(() => { row.style.backgroundColor = 'transparent'; }, 1200);
        }

        // Atualiza a memória local silenciosamente
        const opIndex = window.equipeCampo.findIndex(x => String(x.id) === String(id));
        if (opIndex > -1) {
            window.equipeCampo[opIndex] = { ...window.equipeCampo[opIndex], ...payload };
        }
        
        // Recarrega dinamicamente para agrupar na máquina certa
        setTimeout(() => { window.renderizarPainelMaquinasCampo(); }, 1200);
        
    } catch (e) {
        console.error("Erro ao salvar:", e);
        alert("Erro ao salvar a alocação.");
    }
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
    document.getElementById('alocFormEquipe').value = op.equipe || 'Fixo';
    document.getElementById('alocFormTurno').value = op.turno || '06:00 - 18:00';
    document.getElementById('alocFormDataAncora').value = op.data_ancora ? op.data_ancora.split('T')[0] : '';

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
    const dataAncora = document.getElementById('alocFormDataAncora').value;

    const payload = {
        funcao: funcao,
        maquina_id: maqId ? Number(maqId) : null,
        maquina_especifica: maqEspec,
        equipe: equipe,
        turno: turno,
        data_ancora: dataAncora || null
    };

    try {
        await window.supabaseClient.from('equipe_campo').update(payload).eq('id', id);
        window.fecharModalAlocacaoRapida();
        
        // Recarrega Alocação e a Escala Semanal dinamicamente 
        await window.carregarAlocacaoCampo();
        if(typeof window.renderizarEscalaCampo === 'function') window.renderizarEscalaCampo();
        
    } catch (error) {
        console.error("Erro ao salvar alocação rápida", error);
        alert("Erro ao salvar configuração.");
    }
};

setTimeout(() => {
    if (typeof window.carregarAlocacaoCampo === 'function') window.carregarAlocacaoCampo();
}, 500);