// =========================================================================
// Módulo: Controladoria -> Histórico de Ocorrências
// Ficheiro: modules/controladoria/ocorrencias/historico_ocorrencias.js
// =========================================================================

window.listaOcorrenciasGlobais = [];

window.initHistoricoOcorrencias = async function() {
    await window.carregarHistoricoOcorrencias();
};

window.carregarHistoricoOcorrencias = async function() {
    const tbody = document.getElementById('tbodyHistoricoOcorrencias');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">Carregando dados...</td></tr>';
    
    try {
        let query = supabaseClient.from('ocorrencias').select('*').order('id', { ascending: false });
        if (typeof window.aplicarFiltroFilial === 'function') {
            query = window.aplicarFiltroFilial(query);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        window.listaOcorrenciasGlobais = data || [];
        window.renderizarTabelaOcorrencias();

    } catch (error) {
        console.error("Erro ao carregar histórico:", error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #ef4444;">Erro ao carregar dados de ocorrências.</td></tr>';
    }
};

window.renderizarTabelaOcorrencias = function() {
    const tbody = document.getElementById('tbodyHistoricoOcorrencias');
    if (!tbody) return;

    if (window.listaOcorrenciasGlobais.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #94a3b8; padding: 20px;">Nenhuma ocorrência encontrada.</td></tr>';
        return;
    }

    let html = '';
    window.listaOcorrenciasGlobais.forEach(oco => {
        let dataFmt = oco.data_ocorrido;
        if (dataFmt) {
            const [ano, mes, dia] = dataFmt.split('-');
            dataFmt = `${dia}/${mes}/${ano}`;
        } else {
            dataFmt = '-';
        }

        const idFormatado = `#${String(oco.id).padStart(4, '0')}`;
        const osBadge = oco.numero_os ? `<span style="background: #3b82f6; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 8px;">OS #${oco.numero_os}</span>` : '';

        html += `
            <tr>
                <td style="font-weight: bold; color: var(--ccol-blue-bright);">${idFormatado} ${osBadge}</td>
                <td>${dataFmt}</td>
                <td>${oco.placa || '-'}</td>
                <td>${oco.nome_envolvido || '-'}</td>
                <td>${oco.gestor_imediato || '-'}</td>
                <td>
                    <button onclick="abrirModalHistoricoOcorrencia(${oco.id}, 'visualizar')" class="btn-icon-only" style="color: #60a5fa;" title="Visualizar"><i class="fas fa-eye"></i></button>
                    <button onclick="abrirModalHistoricoOcorrencia(${oco.id}, 'editar')" class="btn-icon-only" style="color: #f59e0b;" title="Editar"><i class="fas fa-edit"></i></button>
                    <button onclick="imprimirOcorrenciaDireto(${oco.id})" class="btn-icon-only" style="color: #10b981;" title="Imprimir Formulário"><i class="fas fa-print"></i></button>
                    <button onclick="excluirOcorrencia(${oco.id})" class="btn-icon-only" style="color: #ef4444;" title="Excluir"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
};

// Dispara a impressão direto da tabela
window.imprimirOcorrenciaDireto = function(id) {
    const oco = window.listaOcorrenciasGlobais.find(o => o.id === id);
    if (oco && typeof window.imprimirFolhaOcorrencia === 'function') {
        window.imprimirFolhaOcorrencia(oco);
    }
};

// Dispara a impressão de dentro do Modal, pegando os dados carregados nele
window.imprimirOcorrenciaDoModal = function() {
    const id = parseInt(document.getElementById('hist_id').value);
    const oco = window.listaOcorrenciasGlobais.find(o => o.id === id);
    if (oco && typeof window.imprimirFolhaOcorrencia === 'function') {
        window.imprimirFolhaOcorrencia(oco);
    }
};

window.abrirModalHistoricoOcorrencia = function(id, modo) {
    const oco = window.listaOcorrenciasGlobais.find(o => o.id === id);
    if (!oco) return;

    document.getElementById('hist_id').value = oco.id;
    document.getElementById('hist_numero_frota').value = oco.numero_frota || '';
    document.getElementById('hist_placa').value = oco.placa || '';
    document.getElementById('hist_modelo').value = oco.modelo || '';
    document.getElementById('hist_empresa').value = oco.empresa || '';
    document.getElementById('hist_numero_os').value = oco.numero_os || '';
    document.getElementById('hist_data_ocorrido').value = oco.data_ocorrido || '';
    document.getElementById('hist_hora_ocorrido').value = oco.hora_ocorrido || '';
    document.getElementById('hist_local_projeto').value = oco.local_projeto || '';
    document.getElementById('hist_nome_envolvido').value = oco.nome_envolvido || '';
    document.getElementById('hist_funcao').value = oco.funcao || '';
    document.getElementById('hist_tempo_empresa').value = oco.tempo_empresa || '';
    document.getElementById('hist_escala').value = oco.escala || '';
    document.getElementById('hist_descricao_fatos').value = oco.descricao_fatos || '';
    document.getElementById('hist_prevencao_falha').value = oco.prevencao_falha || '';
    document.getElementById('hist_parecer_gestor').value = oco.parecer_gestor || '';
    document.getElementById('hist_gestor_imediato').value = oco.gestor_imediato || '';
    document.getElementById('hist_gerente').value = oco.gerente || '';

    // Controlo de exibição do botão de visualizar O.S.
    const btnVerOS = document.getElementById('btnVerOSHist');
    if (oco.numero_os && btnVerOS) {
        btnVerOS.style.display = 'block';
    } else if (btnVerOS) {
        btnVerOS.style.display = 'none';
    }

    const inputs = document.querySelectorAll('#modalHistoricoOcorrencia input, #modalHistoricoOcorrencia textarea');
    const btnSalvar = document.getElementById('btnSalvarEdicaoOcorrencia');

    if (modo === 'visualizar') {
        document.getElementById('modalHistoricoOcorrenciaTitle').innerText = `Detalhes da Ocorrência #${String(oco.id).padStart(4, '0')}`;
        inputs.forEach(i => i.disabled = true);
        btnSalvar.style.display = 'none';
    } else {
        document.getElementById('modalHistoricoOcorrenciaTitle').innerText = `Editar Ocorrência #${String(oco.id).padStart(4, '0')}`;
        inputs.forEach(i => i.disabled = false);
        btnSalvar.style.display = 'block';
    }

    document.getElementById('modalHistoricoOcorrencia').style.display = 'flex';
};

window.fecharModalHistoricoOcorrencia = function() {
    document.getElementById('modalHistoricoOcorrencia').style.display = 'none';
};

window.salvarEdicaoOcorrencia = async function() {
    const id = document.getElementById('hist_id').value;
    
    const payload = {
        numero_frota: document.getElementById('hist_numero_frota').value,
        placa: document.getElementById('hist_placa').value,
        modelo: document.getElementById('hist_modelo').value,
        empresa: document.getElementById('hist_empresa').value,
        numero_os: document.getElementById('hist_numero_os').value,
        data_ocorrido: document.getElementById('hist_data_ocorrido').value,
        hora_ocorrido: document.getElementById('hist_hora_ocorrido').value,
        local_projeto: document.getElementById('hist_local_projeto').value,
        nome_envolvido: document.getElementById('hist_nome_envolvido').value,
        funcao: document.getElementById('hist_funcao').value,
        tempo_empresa: document.getElementById('hist_tempo_empresa').value,
        escala: document.getElementById('hist_escala').value,
        descricao_fatos: document.getElementById('hist_descricao_fatos').value,
        prevencao_falha: document.getElementById('hist_prevencao_falha').value,
        parecer_gestor: document.getElementById('hist_parecer_gestor').value,
        gestor_imediato: document.getElementById('hist_gestor_imediato').value,
        gerente: document.getElementById('hist_gerente').value
    };

    try {
        const { error } = await supabaseClient.from('ocorrencias').update(payload).eq('id', id);
        if (error) throw error;

        alert("Ocorrência atualizada com sucesso!");
        fecharModalHistoricoOcorrencia();
        await carregarHistoricoOcorrencias();
    } catch (error) {
        console.error("Erro ao atualizar ocorrência:", error);
        alert("Erro ao atualizar os dados.");
    }
};

window.excluirOcorrencia = async function(id) {
    if (!confirm("Atenção! Deseja realmente excluir esta ocorrência de forma permanente?")) return;

    try {
        const { error } = await supabaseClient.from('ocorrencias').delete().eq('id', id);
        if (error) throw error;

        alert("Ocorrência excluída com sucesso.");
        await carregarHistoricoOcorrencias();
    } catch (error) {
        console.error("Erro ao excluir:", error);
        alert("Falha ao tentar excluir a ocorrência.");
    }
};

window.visualizarOSVinculada = function() {
    const numero_os = document.getElementById('hist_numero_os').value;
    if (numero_os) {
        // Tenta acionar a função global de abrir modal da OS (se existir no seu OS painel)
        if (typeof window.abrirModalOsCompleta === 'function') {
            fecharModalHistoricoOcorrencia();
            window.abrirModalOsCompleta(numero_os);
        } else {
            alert(`Ocorrência vinculada à O.S. #${numero_os}.\nPara ver mais detalhes, acesse o painel de Gestão de Ordens de Serviço.`);
        }
    }
};