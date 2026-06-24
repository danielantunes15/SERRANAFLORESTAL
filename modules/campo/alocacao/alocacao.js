// ==================== modules/campo/alocacao/alocacao.js ====================

window.carregarAlocacaoCampo = async function() {
    if (typeof window.supabaseClient === 'undefined') return;

    try {
        document.getElementById('alocacaoCampoList').innerHTML = '<tr><td colspan="7" style="padding: 20px; color: #fff;">Carregando dados da operação...</td></tr>';
        
        const pMaquinas = window.supabaseClient.from('maquinas_campo').select('*').order('id');
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
        tbody.innerHTML = `<tr><td colspan="7" style="padding: 20px; color: #94a3b8;">Nenhum membro na equipe. Cadastre no menu "Cadastro de Equipe".</td></tr>`;
        return;
    }

    let html = '';

    // Gerando opções de frentes
    let optionsFrentes = '<option value="">Reserva / Sem Frente</option>';
    window.maquinasCampo.forEach(m => {
        optionsFrentes += `<option value="${m.id}">${m.nome || `Frente ${m.id}`}</option>`;
    });

    // Ordenação: Líderes primeiro, depois alfabético
    const equipeOrdenada = [...window.equipeCampo].sort((a,b) => {
        const isLiderA = a.funcao === 'Líder de Campo' ? -1 : 1;
        const isLiderB = b.funcao === 'Líder de Campo' ? -1 : 1;
        return (isLiderA - isLiderB) || a.nome.localeCompare(b.nome);
    });

    equipeOrdenada.forEach(op => {
        const isLider = op.funcao === 'Líder de Campo';
        
        // Replace para pre-selecionar a frente atual do operador
        let frenteSelect = optionsFrentes;
        if (op.maquina_id) {
            frenteSelect = frenteSelect.replace(`value="${op.maquina_id}"`, `value="${op.maquina_id}" selected`);
        } else {
            frenteSelect = frenteSelect.replace(`value=""`, `value="" selected`);
        }

        html += `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.3s;" id="row_aloc_${op.id}">
            <td style="padding: 10px; text-align: left; font-weight: bold; color: ${isLider ? '#fbbf24' : '#fff'};">
                ${isLider ? '<i class="fas fa-crown" title="Líder"></i> ' : ''}${op.nome}
            </td>
            <td style="padding: 5px;">
                <select class="dark-select" id="aloc_funcao_${op.id}" style="padding: 4px 8px; width: 140px; font-size: 0.8rem;">
                    <option value="Operador de Máquina" ${op.funcao==='Operador de Máquina'?'selected':''}>Operador</option>
                    <option value="Líder de Campo" ${op.funcao==='Líder de Campo'?'selected':''}>Líder</option>
                </select>
            </td>
            <td style="padding: 5px;">
                <select class="dark-select" id="aloc_equipe_${op.id}" style="padding: 4px 8px; width: 110px; font-size: 0.8rem;">
                    <option value="Equipe A" ${op.equipe==='Equipe A'?'selected':''}>Equipe A</option>
                    <option value="Equipe B" ${op.equipe==='Equipe B'?'selected':''}>Equipe B</option>
                    <option value="Equipe C" ${op.equipe==='Equipe C'?'selected':''}>Equipe C</option>
                </select>
            </td>
            <td style="padding: 5px;">
                <select class="dark-select" id="aloc_turno_${op.id}" style="padding: 4px 8px; width: 130px; font-size: 0.8rem;">
                    <option value="06:00 - 18:00" ${op.turno==='06:00 - 18:00'?'selected':''}>06:00 - 18:00</option>
                    <option value="18:00 - 06:00" ${op.turno==='18:00 - 06:00'?'selected':''}>18:00 - 06:00</option>
                </select>
            </td>
            <td style="padding: 5px;">
                <select class="dark-select" id="aloc_frente_${op.id}" style="padding: 4px 8px; width: 180px; font-size: 0.8rem;">
                    ${frenteSelect}
                </select>
            </td>
            <td style="padding: 5px;">
                <select class="dark-select" id="aloc_maqesp_${op.id}" style="padding: 4px 8px; width: 120px; font-size: 0.8rem;">
                    <option value="" ${!op.maquina_especifica?'selected':''}>Nenhuma</option>
                    <option value="Máquina 1" ${op.maquina_especifica==='Máquina 1'?'selected':''}>Máquina 1</option>
                    <option value="Máquina 2" ${op.maquina_especifica==='Máquina 2'?'selected':''}>Máquina 2</option>
                    <option value="Máquina 3" ${op.maquina_especifica==='Máquina 3'?'selected':''}>Máquina 3</option>
                </select>
            </td>
            <td style="padding: 5px;">
                <button class="btn-primary-green" style="padding: 5px 12px; font-size: 0.8rem; font-weight: bold;" onclick="window.salvarAlocacaoLinha(${op.id})">💾 Salvar</button>
            </td>
        </tr>`;
    });

    tbody.innerHTML = html;
};

window.salvarAlocacaoLinha = async function(id) {
    const funcao = document.getElementById(`aloc_funcao_${id}`).value;
    const equipe = document.getElementById(`aloc_equipe_${id}`).value;
    const turno = document.getElementById(`aloc_turno_${id}`).value;
    const frente = document.getElementById(`aloc_frente_${id}`).value;
    const maqEspec = document.getElementById(`aloc_maqesp_${id}`).value;

    const payload = {
        funcao: funcao,
        equipe: equipe,
        turno: turno,
        maquina_id: frente ? Number(frente) : null,
        maquina_especifica: maqEspec
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
        
    } catch (e) {
        console.error("Erro ao salvar:", e);
        alert("Erro ao salvar a alocação.");
    }
};

setTimeout(() => {
    if (typeof window.carregarAlocacaoCampo === 'function') window.carregarAlocacaoCampo();
}, 500);