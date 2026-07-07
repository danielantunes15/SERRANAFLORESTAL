// ==================== js/auditoria_logs.js ====================

let todosLogsCarregados = [];

window.renderizarAuditoriaLogs = async function() {
    await carregarFiltroFiliais();
    
    const hoje = new Date();
    const dataFormatada = hoje.toISOString().split('T')[0];
    document.getElementById('filtroLogDataInicio').value = dataFormatada;
    document.getElementById('filtroLogDataFim').value = dataFormatada;

    await buscarLogsAvancados();
};

async function carregarFiltroFiliais() {
    const selectFilial = document.getElementById('filtroLogFilial');
    if (!selectFilial || !window.supabaseClient) return;

    if (window.currentUser && window.currentUser.role !== 'SuperAdmin' && window.currentUser.role !== 'Admin') {
        selectFilial.parentElement.style.display = 'none'; return;
    }

    try {
        const { data } = await window.supabaseClient.from('filiais').select('id, nome').order('nome');
        if (data && data.length > 0) {
            selectFilial.innerHTML = '<option value="">Todas as Filiais</option>' + data.map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
        }
    } catch (e) { console.error("Erro ao carregar filiais", e); }
}

// ----------------- NOVA FUNÇÃO GLOBAL DE REGISTRO DE AUDITORIA -----------------
window.registrarLogAuditoria = async function(modulo, acao, detalhes, severidade = 'Info', dados_anteriores = null, dados_novos = null, tabela_afetada = null, registro_id = null, ip_address = null) {
    if (!window.supabaseClient) return;
    const usuarioLogado = window.currentUser ? window.currentUser.username : 'Sistema';
    
    const logData = { 
        usuario: usuarioLogado, 
        acao: `[${modulo}] ${acao}`, 
        detalhes: detalhes,
        severidade: severidade,
        dados_anteriores: dados_anteriores,
        dados_novos: dados_novos,
        tabela_afetada: tabela_afetada,
        registro_id: registro_id ? registro_id.toString() : null,
        ip_address: ip_address,
        data_hora: new Date().toISOString()
    };
    
    if (typeof window.injetarFilial === 'function') {
        const d = window.injetarFilial({});
        if(d.filial_id) logData.filial_id = d.filial_id;
    }
    
    try { await window.supabaseClient.from('logs_exclusao').insert([logData]); } catch (e) { console.error("Erro Audit", e); }
};

window.buscarLogsAvancados = async function() {
    const tbody = document.getElementById('tabelaLogsBody');
    const btn = document.getElementById('btnBuscarLogs');
    
    if (!tbody || !window.supabaseClient) return;

    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #a855f7;"><i class="fas fa-spinner fa-spin"></i> Pesquisando no banco de dados...</td></tr>';

    try {
        // MELHORIA DE BANDA: Removido o '*' que puxava os JSONs gigantes. Limitado a 200 registros.
        let query = window.supabaseClient.from('logs_exclusao')
            .select('id, data_hora, usuario, acao, detalhes, severidade, ip_address, filial_id, tabela_afetada, registro_id, filiais(nome)')
            .order('data_hora', { ascending: false })
            .limit(200);
        
        const filialFiltro = document.getElementById('filtroLogFilial').value;
        if (window.currentUser && window.currentUser.role !== 'SuperAdmin' && window.currentUser.role !== 'Admin') {
            if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
        } else if (filialFiltro) { query = query.eq('filial_id', filialFiltro); }

        const dataInicio = document.getElementById('filtroLogDataInicio').value;
        const dataFim = document.getElementById('filtroLogDataFim').value;
        if (dataInicio) query = query.gte('data_hora', `${dataInicio}T00:00:00`);
        if (dataFim) query = query.lte('data_hora', `${dataFim}T23:59:59`);

        const userFiltro = document.getElementById('filtroLogUsuario').value.trim();
        if (userFiltro) query = query.ilike('usuario', `%${userFiltro}%`);

        const sevFiltro = document.getElementById('filtroLogSeveridade').value;
        if (sevFiltro) query = query.eq('severidade', sevFiltro);

        const termoFiltro = document.getElementById('filtroLogDetalhe').value.trim();
        if (termoFiltro) query = query.or(`acao.ilike.%${termoFiltro}%,detalhes.ilike.%${termoFiltro}%`);

        const { data, error } = await query;
        if (error) throw error;

        todosLogsCarregados = data || [];
        renderizarTabelaLogs(todosLogsCarregados);

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #ef4444;">Erro ao consultar registros.</td></tr>';
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-search"></i> Buscar';
    }
};

function renderizarTabelaLogs(lista) {
    const tbody = document.getElementById('tabelaLogsBody');
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhum registro encontrado para os filtros informados.</td></tr>'; return;
    }

    tbody.innerHTML = lista.map(log => {
        const dataStr = log.data_hora ? new Date(log.data_hora).toLocaleString('pt-BR') : '-';
        const ipStr = log.ip_address ? `<br><span style="font-size:0.7rem; color:#64748b;">IP: ${log.ip_address}</span>` : '';
        
        let sevClass = 'sev-info';
        const sev = (log.severidade || 'Info');
        if (sev === 'Alerta') sevClass = 'sev-alerta';
        if (sev === 'Crítico' || sev === 'Critico') sevClass = 'sev-critico';

        const badgeSev = `<span style="padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold;" class="${sevClass}">${sev}</span>`;

        const filialNome = log.filiais && log.filiais.nome ? log.filiais.nome : (log.filial_id ? `Filial #${log.filial_id}` : 'Global');

        // Botões de Ferramentas: Snapshot e Desfazer
        let ferramentas = `<button class="btn-snapshot" title="Ver Snapshot Antes/Depois" onclick="verSnapshots(${log.id})"><i class="fas fa-eye"></i> Dados</button> `;
        
        if (sev === 'Crítico' && log.tabela_afetada) {
            ferramentas += `<button class="btn-undo" title="Restaurar Informação (Lixeira)" onclick="desfazerAcao(${log.id})"><i class="fas fa-undo"></i> Restaurar</button>`;
        }

        return `
            <tr>
                <td style="color: #94a3b8; font-family: monospace;">${dataStr} ${ipStr}</td>
                <td style="font-size: 0.8rem; color: #cbd5e1;">${filialNome}</td>
                <td><strong style="color: #38bdf8;"><i class="fas fa-user-circle"></i> ${log.usuario || 'Sistema'}</strong></td>
                <td>${badgeSev}</td>
                <td><strong style="color: #fff;">${log.acao || '-'}</strong><br><span style="color: #94a3b8; font-size: 0.8rem;">${log.detalhes || '-'}</span></td>
                <td style="text-align: right;">${ferramentas}</td>
            </tr>
        `;
    }).join('');
}

window.verSnapshots = async function(logId) {
    const log = todosLogsCarregados.find(l => l.id == logId);
    if (!log) return;
    
    // Mostra o modal carregando
    document.getElementById('snapAntes').innerText = 'Baixando dados do servidor...';
    document.getElementById('snapDepois').innerText = 'Baixando dados do servidor...';
    document.getElementById('modalSnapshot').style.display = 'flex';

    try {
        // MELHORIA DE BANDA: Baixa os JSONs pesados APENAS quando o usuário clica neste botão.
        const { data, error } = await window.supabaseClient.from('logs_exclusao')
            .select('dados_anteriores, dados_novos')
            .eq('id', logId)
            .single();
        
        if (error) throw error;

        document.getElementById('snapAntes').innerText = data.dados_anteriores ? JSON.stringify(data.dados_anteriores, null, 2) : 'Nenhum dado anterior (Foi uma criação nova).';
        document.getElementById('snapDepois').innerText = data.dados_novos ? JSON.stringify(data.dados_novos, null, 2) : 'Nenhum dado novo (Foi uma exclusão/deleção).';
    } catch (e) {
        console.error(e);
        document.getElementById('snapAntes').innerText = 'Erro ao consultar os dados.';
        document.getElementById('snapDepois').innerText = 'Erro ao consultar os dados.';
    }
};

window.desfazerAcao = async function(logId) {
    const log = todosLogsCarregados.find(l => l.id == logId);
    if (!log || !log.tabela_afetada) return;

    if (!confirm(`⚠️ ATENÇÃO: Você está prestes a restaurar dados apagados na tabela [${log.tabela_afetada}].\nDeseja confirmar a restauração?`)) return;

    try {
        // Busca o payload original diretamente do banco só na hora de restaurar
        const { data: logCompleto, error: errBusca } = await window.supabaseClient.from('logs_exclusao')
            .select('dados_anteriores')
            .eq('id', logId)
            .single();

        if (errBusca) throw errBusca;
        if (!logCompleto || !logCompleto.dados_anteriores) {
            alert("❌ Não há dados anteriores registrados para restauração.");
            return;
        }

        const payload = { ...logCompleto.dados_anteriores };
        
        const { error } = await window.supabaseClient.from(log.tabela_afetada).insert([payload]);
        if (error) throw error;

        await window.registrarLogAuditoria('Sistema', 'Restauração de Dados', `O administrador restaurou um registro deletado da tabela ${log.tabela_afetada}.`, 'Info');
        
        alert("✅ Registro restaurado da lixeira com sucesso!");
        await buscarLogsAvancados();
    } catch (e) {
        console.error(e);
        alert("❌ Erro ao restaurar: Pode ser que um registro com o mesmo ID já exista ou a tabela possua restrições.");
    }
};

// ==================== EXPORTAÇÕES (EXCEL / PDF) ====================

window.exportarAuditoriaExcel = function() {
    if (todosLogsCarregados.length === 0) { alert("Não há dados para exportar."); return; }
    
    const dadosExcel = todosLogsCarregados.map(l => ({
        "Data/Hora": new Date(l.data_hora).toLocaleString('pt-BR'),
        "IP": l.ip_address || 'N/A',
        "Filial": l.filiais ? l.filiais.nome : (l.filial_id || 'Global'),
        "Usuário": l.usuario,
        "Severidade": l.severidade || 'Info',
        "Módulo/Ação": l.acao,
        "Detalhes": l.detalhes
    }));

    const ws = XLSX.utils.json_to_sheet(dadosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoria");
    XLSX.writeFile(wb, `Relatorio_Auditoria_${new Date().getTime()}.xlsx`);
};

window.exportarAuditoriaPDF = function() {
    if (typeof window.jspdf === 'undefined') { alert("Biblioteca PDF não carregada."); return; }
    if (todosLogsCarregados.length === 0) { alert("Não há dados para exportar."); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');

    doc.setFontSize(16);
    doc.text("Relatório de Auditoria e Segurança - Serrana Florestal", 14, 15);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 22);

    const tableCol = ["Data", "Usuário", "Severidade", "Ação", "Detalhes"];
    const tableRows = todosLogsCarregados.map(l => [
        new Date(l.data_hora).toLocaleString('pt-BR'),
        l.usuario,
        l.severidade || 'Info',
        l.acao,
        l.detalhes
    ]);

    doc.autoTable({
        head: [tableCol],
        body: tableRows,
        startY: 28,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] }
    });

    doc.save(`Relatorio_Auditoria_${new Date().getTime()}.pdf`);
};