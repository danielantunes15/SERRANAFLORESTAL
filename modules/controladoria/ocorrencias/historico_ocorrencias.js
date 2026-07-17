// ==================== MÓDULO: HISTÓRICO DE OCORRÊNCIAS ====================
window.ocorrenciasCache = [];

window.initHistoricoOcorrencias = async function() {
    await window.carregarHistoricoOcorrencias();
};

window.carregarHistoricoOcorrencias = async function() {
    const tbody = document.getElementById('tbodyHistoricoOcorrencias');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Buscando ocorrências no banco de dados...</td></tr>';
    
    try {
        // Busca na tabela real de ocorrências ordenando pela data, hora e ID (mais recentes primeiro)
        let query = window.supabaseClient.from('ocorrencias')
            .select('*')
            .order('data_ocorrido', { ascending: false })
            .order('hora_ocorrido', { ascending: false })
            .order('id', { ascending: false });
            
        query = window.aplicarFiltroFilial(query);

        const { data, error } = await query;
        if (error) throw error;
        window.ocorrenciasCache = data || [];
        window.popularFiltrosOcorrencias();
        window.renderizarHistoricoOcorrencias();
    } catch (e) {
        console.error("Erro ao carregar ocorrências", e);
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #ef4444;">Ocorreu um erro ao carregar os dados.</td></tr>';
    }
};

window.popularFiltrosOcorrencias = function() {
    const selectSetor = document.getElementById('filtroSetor');
    const selectEnvolvido = document.getElementById('filtroEnvolvido');
    const selectPlaca = document.getElementById('filtroPlaca');
    if (!selectSetor || !selectEnvolvido || !selectPlaca) return;
    
    let setores = new Set();
    let envolvidos = new Set();
    let placas = new Set();
    
    window.ocorrenciasCache.forEach(o => {
        if (o.setor) setores.add(o.setor);
        if (o.nome_envolvido) envolvidos.add(o.nome_envolvido);
        if (o.placa) placas.add(o.placa.toUpperCase());
    });
    
    const valSetor = selectSetor.value;
    const valEnv = selectEnvolvido.value;
    const valPlaca = selectPlaca.value;
    
    let htmlSetor = '<option value="">Todos os Setores</option>';
    Array.from(setores).sort().forEach(s => htmlSetor += `<option value="${s}">${s}</option>`);
    selectSetor.innerHTML = htmlSetor;
    selectSetor.value = valSetor;
    
    let htmlEnv = '<option value="">Todos os Envolvidos</option>';
    Array.from(envolvidos).sort().forEach(r => htmlEnv += `<option value="${r}">${r}</option>`);
    selectEnvolvido.innerHTML = htmlEnv;
    selectEnvolvido.value = valEnv;
    
    let htmlPlaca = '<option value="">Todas as Placas</option>';
    Array.from(placas).sort().forEach(p => htmlPlaca += `<option value="${p}">${p}</option>`);
    selectPlaca.innerHTML = htmlPlaca;
    selectPlaca.value = valPlaca;
};

window.renderizarHistoricoOcorrencias = function() {
    const tbody = document.getElementById('tbodyHistoricoOcorrencias');
    if (!tbody) return;
    
    const fSetor = document.getElementById('filtroSetor').value;
    const fEnv = document.getElementById('filtroEnvolvido').value;
    const fPlaca = document.getElementById('filtroPlaca').value;
    const fData = document.getElementById('filtroData').value;
    
    let filtrados = window.ocorrenciasCache.filter(o => {
        let match = true;
        if (fSetor && o.setor !== fSetor) match = false;
        if (fEnv && o.nome_envolvido !== fEnv) match = false;
        if (fPlaca && (o.placa || '').toUpperCase() !== fPlaca) match = false;
        if (fData && o.data_ocorrido !== fData) match = false;
        return match;
    });

    // ORDENAÇÃO EXPLICITA: Mais recentes para os mais antigos (Data e Hora)
    filtrados.sort((a, b) => {
        const dataA = a.data_ocorrido || '1970-01-01';
        const horaA = a.hora_ocorrido ? a.hora_ocorrido.substring(0, 5) : '00:00';
        const dataB = b.data_ocorrido || '1970-01-01';
        const horaB = b.hora_ocorrido ? b.hora_ocorrido.substring(0, 5) : '00:00';
        
        const datetimeA = new Date(`${dataA}T${horaA}:00`);
        const datetimeB = new Date(`${dataB}T${horaB}:00`);
        
        return datetimeB - datetimeA;
    });

    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #94a3b8;">Nenhuma ocorrência encontrada.</td></tr>';
        return;
    }
    
    let html = '';
    filtrados.forEach(o => {
        const dataFormatada = o.data_ocorrido ? o.data_ocorrido.split('-').reverse().join('/') : '-';
        
        let badgeStatus = '';
        if (o.status === 'Resolvida') {
            badgeStatus = '<span style="background: rgba(16, 185, 129, 0.2); color: #10b981; padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; font-weight: bold; border: 1px solid rgba(16, 185, 129, 0.3);">Resolvida</span>';
        } else if (o.status === 'Em Andamento') {
            badgeStatus = '<span style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; font-weight: bold; border: 1px solid rgba(245, 158, 11, 0.3);">Andamento</span>';
        } else {
            badgeStatus = `<span style="background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; font-weight: bold; border: 1px solid rgba(239, 68, 68, 0.3);">${o.status || 'Aberta'}</span>`;
        }
        
        // Botões de ação na Horizontal (lado a lado) - Adicionado o Botão de Imprimir
        const acoesHtml = `
            <div style="display: flex; gap: 8px; justify-content: center;">
                <button class="btn-action-sm btn-print" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid #10b981; padding: 6px 12px; border-radius: 6px; cursor: pointer; transition: 0.2s;" onclick="imprimirOcorrencia(${o.id})" title="Imprimir"><i class="fas fa-print"></i></button>
                <button class="btn-action-sm btn-edit" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid #3b82f6; padding: 6px 12px; border-radius: 6px; cursor: pointer; transition: 0.2s;" onclick="abrirModalEdicaoOcorrencia(${o.id})" title="Editar"><i class="fas fa-pen"></i></button>
                <button class="btn-action-sm btn-delete" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid #ef4444; padding: 6px 12px; border-radius: 6px; cursor: pointer; transition: 0.2s;" onclick="excluirOcorrencia(${o.id})" title="Excluir"><i class="fas fa-trash"></i></button>
            </div>
        `;
        html += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.3s ease;">
                <td style="color: #94a3b8; font-weight: bold;">${dataFormatada}</td>
                <td style="color: #94a3b8;">${o.hora_ocorrido || '-'}</td>
                <td style="font-weight: 600; color: #e2e8f0;">${o.setor || '-'}</td>
                <td style="font-weight: 600;">${o.nome_envolvido || '-'}</td>
                <td style="font-weight: bold; color: var(--ccol-blue-bright); font-size: 1.05rem;">${o.placa || '-'}</td>
                <td style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #cbd5e1;" title="${o.descricao_fatos || ''}">${o.descricao_fatos || '-'}</td>
                <td style="text-align: center;">${badgeStatus}</td>
                <td>${acoesHtml}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
};

window.imprimirOcorrencia = function(id) {
    const o = window.ocorrenciasCache.find(x => x.id === id);
    if (!o) {
        alert("Ocorrência não encontrada.");
        return;
    }
    
    // Chama a função global que está em ocorrencias_impressao.js
    if (typeof window.imprimirFolhaOcorrencia === 'function') {
        window.imprimirFolhaOcorrencia(o);
    } else {
        alert("O módulo de impressão não foi carregado corretamente.");
    }
};

window.abrirModalEdicaoOcorrencia = function(id) {
    const o = window.ocorrenciasCache.find(x => x.id === id);
    if (!o) return;
    
    // Popula todos os campos mapeados do banco
    document.getElementById('edit_id').value = o.id;
    document.getElementById('edit_numero_frota').value = o.numero_frota || '';
    document.getElementById('edit_placa').value = o.placa || '';
    document.getElementById('edit_modelo').value = o.modelo || '';
    document.getElementById('edit_empresa').value = o.empresa || '';
    document.getElementById('edit_numero_os').value = o.numero_os || '';
    document.getElementById('edit_data_ocorrido').value = o.data_ocorrido || '';
    document.getElementById('edit_hora_ocorrido').value = o.hora_ocorrido || '';
    document.getElementById('edit_local_projeto').value = o.local_projeto || '';
    document.getElementById('edit_nome_envolvido').value = o.nome_envolvido || '';
    document.getElementById('edit_funcao').value = o.funcao || '';
    document.getElementById('edit_tempo_empresa').value = o.tempo_empresa || '';
    document.getElementById('edit_escala').value = o.escala || '';
    document.getElementById('edit_descricao_fatos').value = o.descricao_fatos || '';
    document.getElementById('edit_prevencao_falha').value = o.prevencao_falha || '';
    document.getElementById('edit_parecer_gestor').value = o.parecer_gestor || '';
    document.getElementById('edit_gestor_imediato').value = o.gestor_imediato || '';
    document.getElementById('edit_gerente').value = o.gerente || '';
    document.getElementById('edit_data_abertura_os').value = o.data_abertura_os || '';
    document.getElementById('edit_setor').value = o.setor || '';
    document.getElementById('edit_tipo_ocorrencia').value = o.tipo_ocorrencia || '';
    
    // Assegura o Status
    const statusSelect = document.getElementById('edit_status');
    if(!Array.from(statusSelect.options).some(opt => opt.value === o.status)) {
        if(o.status) statusSelect.innerHTML += `<option value="${o.status}">${o.status}</option>`;
    }
    statusSelect.value = o.status || 'Aberta';
    
    document.getElementById('edit_valor_prejuizo').value = o.valor_prejuizo || '';
    document.getElementById('edit_is_responsavel').value = o.is_responsavel ? "true" : "false";
    
    // Abre o Modal centralizado
    document.getElementById('modalEditarOcorrencia').style.display = 'flex';
};

window.fecharModalEdicaoOcorrencia = function() {
    document.getElementById('modalEditarOcorrencia').style.display = 'none';
};

window.salvarEdicaoOcorrencia = async function() {
    const id = document.getElementById('edit_id').value;
    
    // Captura os dados exatos como a tabela do banco requer
    const payload = {
        numero_frota: document.getElementById('edit_numero_frota').value,
        placa: document.getElementById('edit_placa').value.toUpperCase(),
        modelo: document.getElementById('edit_modelo').value,
        empresa: document.getElementById('edit_empresa').value,
        numero_os: document.getElementById('edit_numero_os').value,
        data_ocorrido: document.getElementById('edit_data_ocorrido').value,
        hora_ocorrido: document.getElementById('edit_hora_ocorrido').value,
        local_projeto: document.getElementById('edit_local_projeto').value,
        nome_envolvido: document.getElementById('edit_nome_envolvido').value,
        funcao: document.getElementById('edit_funcao').value,
        tempo_empresa: document.getElementById('edit_tempo_empresa').value,
        escala: document.getElementById('edit_escala').value,
        descricao_fatos: document.getElementById('edit_descricao_fatos').value,
        prevencao_falha: document.getElementById('edit_prevencao_falha').value,
        parecer_gestor: document.getElementById('edit_parecer_gestor').value,
        gestor_imediato: document.getElementById('edit_gestor_imediato').value,
        gerente: document.getElementById('edit_gerente').value,
        data_abertura_os: document.getElementById('edit_data_abertura_os').value || null, // data pode ser null se vazia
        setor: document.getElementById('edit_setor').value,
        tipo_ocorrencia: document.getElementById('edit_tipo_ocorrencia').value,
        status: document.getElementById('edit_status').value,
        valor_prejuizo: document.getElementById('edit_valor_prejuizo').value ? parseFloat(document.getElementById('edit_valor_prejuizo').value) : null,
        is_responsavel: document.getElementById('edit_is_responsavel').value === "true"
    };
    
    if(!payload.data_ocorrido || !payload.placa || !payload.nome_envolvido || !payload.descricao_fatos) {
        alert("Preencha os campos obrigatórios (Data, Placa, Nome e Descrição).");
        return;
    }
    
    try {
        const { error } = await window.supabaseClient.from('ocorrencias').update(payload).eq('id', id);
        if (error) throw error;
        
        alert('Ocorrência atualizada com sucesso!');
        window.fecharModalEdicaoOcorrencia();
        await window.carregarHistoricoOcorrencias();
    } catch (e) {
        alert('Erro ao atualizar ocorrência. Verifique a conexão com o banco.');
        console.error(e);
    }
};

window.excluirOcorrencia = async function(id) {
    if (!confirm("Tem certeza que deseja excluir permanentemente esta ocorrência?")) return;
    try {
        const { error } = await window.supabaseClient.from('ocorrencias').delete().eq('id', id);
        if (error) throw error;
        
        alert('Ocorrência excluída com sucesso!');
        await window.carregarHistoricoOcorrencias();
    } catch (e) {
        alert('Erro ao excluir ocorrência.');
        console.error(e);
    }
};