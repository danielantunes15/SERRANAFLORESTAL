window.listaBancoHorasRH = [];
window.listaBancoHorasRHFiltrada = [];

window.initRHBancoHoras = async function() {
    // Ao iniciar, define o filtro de datas para o mês atual
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    
    document.getElementById('bhRhDataInicio').value = primeiroDia.toISOString().split('T')[0];
    document.getElementById('bhRhDataFim').value = ultimoDia.toISOString().split('T')[0];

    await window.carregarBancoHorasRH();
};

window.carregarBancoHorasRH = async function() {
    const tbody = document.getElementById('tbBancoHorasRH');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Carregando registros da base de dados...</td></tr>`;

    try {
        const { data, error } = await window.supabaseClient
            .from('rh_banco_horas')
            .select('id, data_extra, caminhao_placa, turno, created_at, rh_colaboradores(nome, cod_funcionario)')
            .order('data_extra', { ascending: false });

        if (error) throw error;
        window.listaBancoHorasRH = data || [];
        window.filtrarBancoHorasRH(); // Vai filtrar pela data e renderizar
    } catch (e) {
        console.error("Erro ao carregar banco de horas:", e);
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ef4444;">Erro ao carregar dados.</td></tr>`;
    }
};

window.filtrarBancoHorasRH = function() {
    const termo = document.getElementById('buscaBancoHorasRH').value.toLowerCase();
    const dataIni = document.getElementById('bhRhDataInicio').value;
    const dataFim = document.getElementById('bhRhDataFim').value;

    window.listaBancoHorasRHFiltrada = window.listaBancoHorasRH.filter(item => {
        const nome = item.rh_colaboradores ? item.rh_colaboradores.nome.toLowerCase() : '';
        const placa = item.caminhao_placa ? item.caminhao_placa.toLowerCase() : '';
        const dataExtra = item.data_extra;

        let passaTermo = nome.includes(termo) || placa.includes(termo);
        let passaDataIni = dataIni ? dataExtra >= dataIni : true;
        let passaDataFim = dataFim ? dataExtra <= dataFim : true;

        return passaTermo && passaDataIni && passaDataFim;
    });

    window.atualizarKPIsBancoHorasRH();
    window.renderizarTabelaBancoHorasRH();
};

window.atualizarKPIsBancoHorasRH = function() {
    const kpiTotal = document.getElementById('kpiTotalExtrasRH');
    const kpiTop = document.getElementById('kpiTopColabExtraRH');
    
    if (kpiTotal) kpiTotal.innerText = window.listaBancoHorasRHFiltrada.length;

    if (window.listaBancoHorasRHFiltrada.length === 0) {
        if (kpiTop) kpiTop.innerText = '-';
        return;
    }

    const contagem = {};
    window.listaBancoHorasRHFiltrada.forEach(item => {
        const nome = item.rh_colaboradores ? item.rh_colaboradores.nome : 'Desconhecido';
        contagem[nome] = (contagem[nome] || 0) + 1;
    });

    const topColab = Object.keys(contagem).reduce((a, b) => contagem[a] > contagem[b] ? a : b);
    if (kpiTop) kpiTop.innerHTML = `${topColab}<br><span style="font-size:0.8rem; color:#94a3b8;">(${contagem[topColab]} extras no período)</span>`;
};

window.renderizarTabelaBancoHorasRH = function() {
    const tbody = document.getElementById('tbBancoHorasRH');
    if (!tbody) return;

    if (window.listaBancoHorasRHFiltrada.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#9ca3af; padding: 20px;">Nenhum registro encontrado para os filtros informados.</td></tr>`;
        return;
    }

    let html = '';
    window.listaBancoHorasRHFiltrada.forEach(item => {
        let dataCriacao = '-';
        if (item.created_at) {
            const dateObj = new Date(item.created_at);
            dataCriacao = dateObj.toLocaleDateString('pt-BR') + ' às ' + dateObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        }
        
        const colabNome = item.rh_colaboradores ? item.rh_colaboradores.nome : '<span style="color:#ef4444;">Removido</span>';
        const mat = item.rh_colaboradores && item.rh_colaboradores.cod_funcionario ? `[${String(item.rh_colaboradores.cod_funcionario).padStart(4, '0')}]` : '';
        const dataExtraFmt = item.data_extra ? item.data_extra.split('-').reverse().join('/') : '-';

        html += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td><span style="background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 0.85rem;"><i class="fas fa-calendar-day"></i> ${dataExtraFmt}</span></td>
                <td style="text-align:left;"><b><span style="color:var(--text-secondary); font-size:0.8rem;">${mat}</span> ${colabNome}</b></td>
                <td><strong style="color: var(--ccol-blue-bright); font-size: 1.05rem;">${item.caminhao_placa || '-'}</strong></td>
                <td><span style="padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; border: 1px solid var(--border-dim); background: rgba(0,0,0,0.2);">${item.turno || '-'}</span></td>
                <td style="font-size: 0.8rem; color: #94a3b8;">${dataCriacao}</td>
                <td style="text-align: right;">
                    <button class="btn-icon-only" onclick="window.excluirBancoHorasRHTela('${item.id}', '${item.data_extra}', '${colabNome}')" title="Excluir Convocação"><i class="fas fa-trash" style="color:#ef4444;"></i></button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
};

window.excluirBancoHorasRHTela = async function(id, dataExtra, colabNome) {
    if (!confirm(`Deseja realmente remover a convocação extra do motorista ${colabNome} no dia ${dataExtra.split('-').reverse().join('/')}?`)) return;
    
    try {
        await window.supabaseClient.from('rh_banco_horas').delete().eq('id', id);
        alert('Convocação extra removida com sucesso!');
        await window.carregarBancoHorasRH();
    } catch(e) {
        console.error(e);
        alert('Erro ao excluir registro de banco de horas.');
    }
};

window.exportarBancoHorasPdf = function() {
    if (typeof window.jspdf === 'undefined') {
        alert("Biblioteca PDF não carregada.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');

    doc.setFontSize(16);
    doc.setTextColor(41, 128, 185);
    doc.text("Relatório de Banco de Horas (Extras)", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 28);

    const bodyData = window.listaBancoHorasRHFiltrada.map(item => {
        const nome = item.rh_colaboradores ? item.rh_colaboradores.nome : 'Removido';
        const mat = item.rh_colaboradores && item.rh_colaboradores.cod_funcionario ? String(item.rh_colaboradores.cod_funcionario).padStart(4, '0') : '-';
        const dataOcorrencia = item.data_extra ? item.data_extra.split('-').reverse().join('/') : '-';
        
        return [mat, nome, dataOcorrencia, item.caminhao_placa || '-', item.turno || '-'];
    });

    doc.autoTable({
        startY: 35,
        head: [['Matrícula', 'Colaborador', 'Data da Extra', 'Veículo Assumido', 'Turno Realizado']],
        body: bodyData,
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] },
        styles: { fontSize: 9 }
    });

    doc.save(`Relatorio_BancoHoras_${Date.now()}.pdf`);
};

window.exportarBancoHorasExcel = function() {
    if (window.listaBancoHorasRHFiltrada.length === 0) {
        alert("Nenhum dado para exportar.");
        return;
    }

    let csvContent = "\uFEFF"; 
    csvContent += "Matrícula;Colaborador;Data da Extra;Veículo Assumido;Turno Realizado;Lançado Em\n";

    window.listaBancoHorasRHFiltrada.forEach(item => {
        const mat = item.rh_colaboradores && item.rh_colaboradores.cod_funcionario ? String(item.rh_colaboradores.cod_funcionario).padStart(4, '0') : '-';
        const nome = item.rh_colaboradores ? item.rh_colaboradores.nome : 'Removido';
        const dataOcorrencia = item.data_extra ? item.data_extra.split('-').reverse().join('/') : '-';
        let dataCriacao = '-';
        if (item.created_at) {
            const dateObj = new Date(item.created_at);
            dataCriacao = dateObj.toLocaleDateString('pt-BR') + ' ' + dateObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        }
        
        const linha = [mat, nome, dataOcorrencia, item.caminhao_placa || '-', item.turno || '-', dataCriacao].join(";");
        csvContent += linha + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Banco_Horas_Extras_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
};