// ==================== modules/performance/ocorrencias/ocorrencias.js ====================

window.ocorrenciasModule = window.ocorrenciasModule || {};

window.ocorrenciasModule.load = async function() {
    const tbody = document.getElementById('perf-ocorrencias-list');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Carregando histórico do banco de dados...</td></tr>';

    try {
        // Busca na tabela de ocorrências exatamente como a Controladoria faz
        let query = window.supabaseClient.from('ocorrencias')
            .select('*')
            .order('data_ocorrido', { ascending: false })
            .order('hora_ocorrido', { ascending: false });
            
        // IMPORTANTE: Aplica o filtro de filial para o Supabase não bloquear a busca
        if (typeof window.aplicarFiltroFilial === 'function') {
            query = window.aplicarFiltroFilial(query);
        }

        const { data, error } = await query;
        if (error) throw error;

        const ocorrencias = data || [];

        if (ocorrencias.length === 0) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #94a3b8;">Nenhuma ocorrência encontrada.</td></tr>';
            return;
        }

        let html = '';
        ocorrencias.forEach(o => {
            const dataFormatada = o.data_ocorrido ? o.data_ocorrido.split('-').reverse().join('/') : '-';
            
            // Lógica de cores das badges igual a do relatório original
            let badgeStatus = '';
            if (o.status === 'Resolvida' || o.status === 'Concluída') {
                badgeStatus = `<span style="background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; font-weight: bold; border: 1px solid rgba(16, 185, 129, 0.3);">${o.status}</span>`;
            } else if (o.status === 'Em Andamento' || o.status === 'Em Análise') {
                badgeStatus = `<span style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; font-weight: bold; border: 1px solid rgba(245, 158, 11, 0.3);">${o.status}</span>`;
            } else {
                badgeStatus = `<span style="background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; font-weight: bold; border: 1px solid rgba(239, 68, 68, 0.3);">${o.status || 'Aberta'}</span>`;
            }

            html += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.3s ease;">
                    <td style="color: #94a3b8; font-weight: bold;">${dataFormatada}</td>
                    <td style="color: #94a3b8;">${o.hora_ocorrido ? o.hora_ocorrido.substring(0, 5) : '-'}</td>
                    <td style="font-weight: 600; color: #f8fafc;">${o.nome_envolvido || '-'}</td>
                    <td style="font-weight: bold; color: var(--ccol-blue-bright);">${o.placa || '-'}</td>
                    <td style="color: #e2e8f0;">${o.tipo_ocorrencia || 'Outros'}</td>
                    <td style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #cbd5e1;" title="${o.descricao_fatos || ''}">${o.descricao_fatos || '-'}</td>
                    <td style="text-align: center;">${badgeStatus}</td>
                </tr>
            `;
        });

        if (tbody) tbody.innerHTML = html;

    } catch (e) {
        console.error("Erro ao carregar espelho de ocorrências:", e);
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #ef4444; padding: 20px;">Ocorreu um erro ao carregar os dados.</td></tr>';
    }
};