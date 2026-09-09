// ==================== modules/campo/alocacao/alocacao.js ====================

window.funcoesSelecionadasEscala = ['OPERADOR MANTENEDOR', 'Líder de Campo'];
window.cargosFilial = [];

function obterFilialIdAtual() {
    return (window.currentUser && window.currentUser.filial_id && window.currentUser.filial_id !== 'CENTRAL')
        ? parseInt(window.currentUser.filial_id)
        : null;
}

window.carregarConfiguracaoFuncoesDB = async function() {
    if (typeof window.supabaseClient === 'undefined') return;
    try {
        const filialId = obterFilialIdAtual();
        let query = window.supabaseClient.from('campo_config_escala').select('funcoes_selecionadas');

        if (filialId !== null) {
            query = query.eq('filial_id', filialId);
        } else {
            query = query.is('filial_id', null);
        }

        const { data, error } = await query.maybeSingle();
        if (error) throw error;

        if (data && data.funcoes_selecionadas && Array.isArray(data.funcoes_selecionadas)) {
            window.funcoesSelecionadasEscala = data.funcoes_selecionadas;
        } else {
            window.funcoesSelecionadasEscala = ['OPERADOR MANTENEDOR', 'Líder de Campo'];
        }
    } catch (error) {
        console.error("Erro ao carregar configuração de funções do banco:", error);
    }
};

window.carregarCargosFilial = async function() {
    if (typeof window.supabaseClient === 'undefined') return;
    try {
        let query = window.supabaseClient.from('cargos').select('nome').eq('status', 'Ativo').order('nome');
        
        if (typeof window.aplicarFiltroFilial === 'function') {
            query = window.aplicarFiltroFilial(query);
        } else if (window.currentUser && window.currentUser.filial_id) {
            query = query.eq('filial_id', window.currentUser.filial_id);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        if (data && data.length > 0) {
            const nomesUnicos = [...new Set(data.map(c => c.nome))];
            window.cargosFilial = nomesUnicos;
        } else {
            window.cargosFilial = ['OPERADOR MANTENEDOR', 'Líder de Campo', 'Motorista', 'Mecânico', 'Borracheiro'];
        }
    } catch (error) {
        console.error("Erro ao carregar cargos da filial:", error);
        window.cargosFilial = ['OPERADOR MANTENEDOR', 'Líder de Campo', 'Motorista', 'Mecânico', 'Borracheiro'];
    }
};

window.abrirModalFiltroFuncoes = async function() {
    document.getElementById('modalFiltroFuncoes').classList.add('show');
    const container = document.getElementById('listaFiltroFuncoes');
    container.innerHTML = '<div style="color:#fff; text-align:center;"><i class="fas fa-spinner fa-spin"></i> Carregando cargos da filial...</div>';
    
    await Promise.all([window.carregarConfiguracaoFuncoesDB(), window.carregarCargosFilial()]);
    
    let html = '';
    window.cargosFilial.forEach(cargo => {
        const isChecked = window.funcoesSelecionadasEscala.includes(cargo) ? 'checked' : '';
        html += `
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; color: #fff; font-weight: 500;">
            <input type="checkbox" class="filtro-funcao-checkbox" value="${cargo}" ${isChecked} style="transform: scale(1.2); accent-color: #3b82f6;"> ${cargo}
        </label>`;
    });
    
    container.innerHTML = html;
};

window.fecharModalFiltroFuncoes = function() {
    document.getElementById('modalFiltroFuncoes').classList.remove('show');
};

window.aplicarFiltroFuncoes = async function() {
    const checkboxes = document.querySelectorAll('.filtro-funcao-checkbox:checked');
    window.funcoesSelecionadasEscala = Array.from(checkboxes).map(cb => cb.value);
    
    const filialId = obterFilialIdAtual();
    try {
        const payload = {
            filial_id: filialId,
            funcoes_selecionadas: window.funcoesSelecionadasEscala,
            updated_at: new Date().toISOString()
        };

        const { error } = await window.supabaseClient
            .from('campo_config_escala')
            .upsert([payload], { onConflict: 'filial_id' });

        if (error) throw error;
    } catch (err) {
        console.error("Erro ao salvar configuração no banco:", err);
    }
    
    window.fecharModalFiltroFuncoes();
    
    if (typeof window.carregarAlocacaoCampo === 'function') {
        window.carregarAlocacaoCampo(); 
    }
    
    if (typeof window.carregarDadosEscalaCampo === 'function') {
        window._dadosEscalaCarregados = false;
        window.carregarDadosEscalaCampo();
    }
};

window.carregarAlocacaoCampo = async function() {
    if (typeof window.supabaseClient === 'undefined') return;
    
    const container = document.getElementById('alocacaoCampoCards');
    if (!container) return; 

    try {
        container.innerHTML = '<div style="color:#fff; text-align:center;"><i class="fas fa-spinner fa-spin"></i> Carregando painel de máquinas...</div>';
        
        await Promise.all([window.carregarConfiguracaoFuncoesDB(), window.carregarCargosFilial()]);
        
        let queryMaquinas = window.supabaseClient.from('maquinas_campo').select('*').order('id');
        if (typeof window.aplicarFiltroFilial === 'function') {
            queryMaquinas = window.aplicarFiltroFilial(queryMaquinas);
        } else if (window.currentUser && window.currentUser.filial_id) {
            queryMaquinas = queryMaquinas.eq('filial_id', window.currentUser.filial_id);
        }
        const pMaquinas = queryMaquinas;
        
        let queryEquipe = window.supabaseClient.from('rh_colaboradores')
            .select('*')
            .in('funcao', window.funcoesSelecionadasEscala)
            .order('nome');

        if (typeof window.aplicarFiltroFilial === 'function') {
            queryEquipe = window.aplicarFiltroFilial(queryEquipe);
        } else if (window.currentUser && window.currentUser.filial_id) {
            queryEquipe = queryEquipe.eq('filial_id', window.currentUser.filial_id);
        }
        
        const [resMaquinas, resEquipe] = await Promise.all([pMaquinas, queryEquipe]);
        
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
    let tipoEscalaAtual = op.tipo_escala || '4x2';
    
    let opcoesFuncao = '';
    let funcaoEncontrada = false;
    window.cargosFilial.forEach(c => {
        const selected = op.funcao === c ? 'selected' : '';
        if (selected) funcaoEncontrada = true;
        opcoesFuncao += `<option value="${c}" ${selected}>${c}</option>`;
    });
    if (op.funcao && !funcaoEncontrada) {
        opcoesFuncao += `<option value="${op.funcao}" selected>${op.funcao}</option>`;
    }
    
    return `
    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);" id="row_aloc_${op.id}">
        <td style="padding: 10px; text-align: left; font-weight: 800; color: #fff; width: 18%;">
            ${op.funcao === 'Líder de Campo' ? '<i class="fas fa-crown" style="color:#fbbf24;"></i> ' : ''}${op.nome}
        </td>
        <td style="padding: 5px;">
            <select class="dark-select" id="aloc_funcao_${op.id}" style="padding: 4px 8px; width: 100%; font-size: 0.8rem;">
                ${opcoesFuncao}
            </select>
        </td>
        <td style="padding: 5px;">
            <select class="dark-select" id="aloc_tipoescala_${op.id}" style="padding: 4px 8px; width: 100%; font-size: 0.8rem; border-color: #10b981; color: #10b981;">
                <option value="4x2" ${tipoEscalaAtual==='4x2'?'selected':''}>4x2</option>
                <option value="4x4" ${tipoEscalaAtual==='4x4'?'selected':''}>4x4</option>
                <option value="5x2" ${tipoEscalaAtual==='5x2'?'selected':''}>5x2</option>
                <option value="6x1" ${tipoEscalaAtual==='6x1'?'selected':''}>6x1</option>
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
        <td style="padding: 5px; text-align: center; white-space: nowrap;">
            <button class="btn-primary-green" style="padding: 5px 12px; font-size: 0.8rem; font-weight: bold;" onclick="window.salvarAlocacaoLinha('${op.id}')"><i class="fas fa-save"></i> Salvar</button>
            <button class="btn-primary-blue" style="padding: 5px 12px; font-size: 0.8rem; font-weight: bold; margin-left: 5px;" onclick="window.abrirModalAlocacaoRapida('${op.id}')"><i class="fas fa-bolt"></i> Rápida</button>
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
        
        const theadGeral = `<thead><tr style="background: rgba(0,0,0,0.3); color: #cbd5e1; font-size: 0.75rem;"><th style="padding: 8px; text-align:left;">Membro</th><th>Função</th><th>Ciclo</th><th>Papel</th><th>Turno</th><th>Frente</th><th>Máquina</th><th>Data Início</th><th>Ação</th></tr></thead>`;

        window.funcoesSelecionadasEscala.forEach(funcaoNome => {
            const operadores = membrosFrente.filter(op => op.funcao === funcaoNome);
            if (operadores.length === 0) return;

            operadores.sort((a,b) => {
                const peso = o => ((o.turno || '').includes('06:00') ? 0 : 10) + (o.equipe === 'Fixo' ? 1 : 2);
                return peso(a) - peso(b);
            });

            let colorBase = '#34d399'; let bgBase = 'rgba(16, 185, 129, 0.05)'; let borderBase = 'rgba(16, 185, 129, 0.3)'; let iconBase = 'fa-user-cog';
            if(funcaoNome === 'Líder de Campo') { colorBase = '#fbbf24'; bgBase = 'rgba(251, 191, 36, 0.1)'; borderBase = '#fbbf24'; iconBase = 'fa-crown'; } 
            else if (funcaoNome === 'Motorista') { colorBase = '#60a5fa'; bgBase = 'rgba(96, 165, 250, 0.05)'; borderBase = 'rgba(96, 165, 250, 0.3)'; iconBase = 'fa-truck'; } 
            else if (funcaoNome === 'Mecânico' || funcaoNome === 'Borracheiro') { colorBase = '#a855f7'; bgBase = 'rgba(168, 85, 247, 0.05)'; borderBase = 'rgba(168, 85, 247, 0.3)'; iconBase = 'fa-tools'; }

            html += `<div style="margin-bottom: 15px; background: ${bgBase}; border: 1px solid ${borderBase}; border-radius: 8px; padding: 10px;">
                <h4 style="color: ${colorBase}; margin: 0 0 10px 0;"><i class="fas ${iconBase}"></i> Função: ${funcaoNome}</h4>
                <table style="width: 100%; border-collapse: collapse;">
                    ${theadGeral}
                    <tbody>`;
            operadores.forEach(op => html += window.gerarLinhaTabelaAlocacao(op, optionsFrentes));
            html += `</tbody></table></div>`;
        });
        html += `</div>`;
    });
    
    // Reservas Totais (Sem nenhuma frente)
    const reservas = window.equipeCampo.filter(op => !op.maquina_id);
    if (reservas.length > 0) {
        const theadGeral = `<thead><tr style="background: rgba(0,0,0,0.3); color: #cbd5e1; font-size: 0.75rem;"><th style="padding: 8px; text-align:left;">Membro</th><th>Função</th><th>Ciclo</th><th>Papel</th><th>Turno</th><th>Frente</th><th>Máquina</th><th>Data Início</th><th>Ação</th></tr></thead>`;
        html += `<div style="background: rgba(239, 68, 68, 0.1); border: 2px solid #ef4444; border-radius: 10px; padding: 15px; margin-top: 20px;">
            <h2 style="color: #ef4444; margin-top: 0; font-size: 1.3rem; border-bottom: 2px solid rgba(239, 68, 68, 0.3); padding-bottom: 10px; margin-bottom: 20px;"><i class="fas fa-users-slash"></i> Sem Frente Definida (Reservas Globais)</h2>`;
        
        window.funcoesSelecionadasEscala.forEach(funcaoNome => {
            const ops = reservas.filter(op => op.funcao === funcaoNome);
            if (ops.length === 0) return;

            html += `<div style="margin-bottom: 15px; background: rgba(0,0,0,0.2); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 10px;">
                <h4 style="color: #f87171; margin: 0 0 10px 0;"><i class="fas fa-layer-group"></i> ${funcaoNome}</h4>
                <table style="width: 100%; border-collapse: collapse;">
                    ${theadGeral}
                <tbody>`;
            ops.forEach(op => html += window.gerarLinhaTabelaAlocacao(op, optionsFrentes));
            html += `</tbody></table></div>`;
        });
        html += `</div>`;
    }
    
    container.innerHTML = html;
};

window.salvarAlocacaoLinha = async function(id) {
    const funcao = document.getElementById(`aloc_funcao_${id}`).value;
    const tipoEscala = document.getElementById(`aloc_tipoescala_${id}`).value;
    const equipe = document.getElementById(`aloc_equipe_${id}`).value;
    const turno = document.getElementById(`aloc_turno_${id}`).value;
    const frente = document.getElementById(`aloc_frente_${id}`).value;
    const maqEspec = document.getElementById(`aloc_maqesp_${id}`).value;
    const dataAncora = document.getElementById(`aloc_data_${id}`).value;
    
    if (!dataAncora) {
        alert("Atenção: A 'Data Início' é obrigatória para calcular a Escala corretamente.\nPor favor, preencha o campo de Data antes de salvar.");
        return; 
    }
    
    if (!frente) {
        const confirmar = confirm("Aviso: Nenhuma 'Frente' foi selecionada.\n\nEste colaborador será movido para o quadro de 'Reservas / Sem Frente Definida' no final da página.\nDeseja continuar?");
        if (!confirmar) return; 
    }

    const payload = {
        funcao: funcao,
        tipo_escala: tipoEscala,
        equipe: equipe,
        turno: turno,
        maquina_id: frente ? Number(frente) : null,
        maquina_especifica: maqEspec,
        data_ancora: dataAncora || null
    };
    
    try {
        const { error } = await window.supabaseClient.from('rh_colaboradores').update(payload).eq('id', id);
        if (error) {
            console.error("Erro no Banco de Dados:", error);
            alert(`Falha ao salvar! Detalhe: ${error.message}\nVocê rodou o script SQL no Supabase?`);
            return;
        }
        
        const row = document.getElementById(`row_aloc_${id}`);
        if(row) {
            row.style.backgroundColor = 'rgba(16, 185, 129, 0.4)';
            setTimeout(() => { row.style.backgroundColor = 'transparent'; }, 1200);
        }
        
        const opIndex = window.equipeCampo.findIndex(x => String(x.id) === String(id));
        if (opIndex > -1) {
            window.equipeCampo[opIndex] = { ...window.equipeCampo[opIndex], ...payload };
        }
        
        setTimeout(() => { window.renderizarPainelMaquinasCampo(); }, 1200);
    } catch (e) {
        console.error("Erro ao salvar:", e);
        alert("Erro ao tentar salvar a alocação.");
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
    
    const selectFuncao = document.getElementById('alocFormFuncao');
    let opcoesFuncao = '';
    let funcaoEncontrada = false;
    window.cargosFilial.forEach(c => {
        const selected = op.funcao === c ? 'selected' : '';
        if (selected) funcaoEncontrada = true;
        opcoesFuncao += `<option value="${c}" ${selected}>${c}</option>`;
    });
    if (op.funcao && !funcaoEncontrada) {
        opcoesFuncao += `<option value="${op.funcao}" selected>${op.funcao}</option>`;
    }
    selectFuncao.innerHTML = opcoesFuncao;
    
    document.getElementById('alocFormId').value = op.id;
    document.getElementById('alocNomeExibicao').innerText = op.nome;
    document.getElementById('alocFormTipoEscala').value = op.tipo_escala || '4x2';
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
    const tipoEscala = document.getElementById('alocFormTipoEscala').value;
    const maqId = document.getElementById('alocFormMaquina').value;
    const maqEspec = document.getElementById('alocFormMaquinaEspecifica').value;
    const equipe = document.getElementById('alocFormEquipe').value;
    const turno = document.getElementById('alocFormTurno').value;
    const dataAncora = document.getElementById('alocFormDataAncora').value;
    
    if (!dataAncora) {
        alert("Atenção: A 'Data Inicial' (Data Âncora) é obrigatória para calcular a Escala corretamente.\nPor favor, informe a data.");
        return; 
    }

    if (!maqId) {
        const confirmar = confirm("Aviso: Nenhuma 'Frente Vinculada' foi selecionada.\n\nEste colaborador será salvo como 'Reserva' (Sem Frente).\nDeseja continuar?");
        if (!confirmar) return; 
    }

    const payload = {
        funcao: funcao,
        tipo_escala: tipoEscala,
        maquina_id: maqId ? Number(maqId) : null,
        maquina_especifica: maqEspec,
        equipe: equipe,
        turno: turno,
        data_ancora: dataAncora || null
    };
    
    try {
        const { error } = await window.supabaseClient.from('rh_colaboradores').update(payload).eq('id', id);
        if (error) {
            console.error("Erro no Banco de Dados:", error);
            alert(`Falha ao salvar! Detalhe: ${error.message}`);
            return;
        }

        window.fecharModalAlocacaoRapida();
        
        await window.carregarAlocacaoCampo();
        if(typeof window.iniciarEscalaCampo === 'function') {
            window._dadosEscalaCarregados = false;
        }
        
    } catch (error) {
        console.error("Erro ao salvar alocação rápida", error);
        alert("Erro ao salvar configuração.");
    }
};

setTimeout(() => {
    if (typeof window.carregarAlocacaoCampo === 'function') window.carregarAlocacaoCampo();
}, 500);