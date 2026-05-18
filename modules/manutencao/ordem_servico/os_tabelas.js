// ==================== js/os_tabelas.js ====================
// Módulo responsável pela renderização das tabelas e listas da OS

function renderizarTabelaOS() {
    const tbody = document.getElementById('tabelaAcompanhamentoOS');
    if (!tbody) return;

    const termo = (document.getElementById('searchOS')?.value || '').toLowerCase();
    let filtradas = ordensServico.filter(o => o.status !== 'Concluída' && o.tipo !== 'Sinistro');

    if (termo) {
        filtradas = filtradas.filter(o => 
            (o.placa && o.placa.toLowerCase().includes(termo)) ||
            (o.motorista && o.motorista.toLowerCase().includes(termo))
        );
    }

    tbody.innerHTML = filtradas.map(os => {
        let corStatus = '#f59e0b'; 
        if (os.status === 'Em Manutenção') corStatus = '#3b82f6';
        if (os.status === 'Agendada') corStatus = '#8b5cf6';
        
        const modoIcon = os.status === 'Agendada' ? '📅' : '🚨';
        
        const inicioStr = formatarDataHoraBrasil(os.data_abertura);
        const previsaoStr = os.previsao_entrega ? formatarDataHoraBrasil(os.previsao_entrega) : 'Não definida';

        let isVencida = false;
        if (os.previsao_entrega && os.status !== 'Agendada') {
            const previsao = new Date(os.previsao_entrega.replace('Z', '').replace('+00:00', ''));
            if (new Date() > previsao) isVencida = true;
        }

        const linhaStyle = isVencida ? 'background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444;' : '';

        return `
            <tr style="${linhaStyle}">
                <td><strong>#${os.id}</strong></td>
                <td>${modoIcon} ${inicioStr}</td>
                <td>${previsaoStr} ${isVencida ? '⚠️' : ''}</td>
                <td style="color: var(--ccol-blue-bright); font-weight: bold;">${os.placa || '-'}</td>
                <td>${os.motorista || '-'}</td>
                <td>${os.tipo}</td>
                <td><span style="color: ${corStatus}; font-weight: bold;">${os.status}</span></td>
                <td>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-start; align-items: center;">
                        <button class="btn-primary-blue" onclick="abrirModalServicoExtra(${os.id})" title="Adicionar Serviço e Prorrogar Prazo" style="padding: 6px 12px; font-size: 0.8rem; white-space: nowrap; border-radius: 4px;">➕ Serviço Extra</button>
                        <button class="btn-primary-green" onclick="abrirModalConclusaoOS(${os.id})" style="padding: 6px 12px; font-size: 0.8rem; white-space: nowrap; border-radius: 4px;">✅ Concluir OS</button>
                        <button class="btn-secondary-dark" onclick="imprimirOS(${os.id})" title="Imprimir" style="padding: 6px 10px; font-size: 0.8rem; border-radius: 4px;">🖨️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderizarTabelaSinistro() {
    const tbody = document.getElementById('tabelaAcompanhamentoSinistro');
    if (!tbody) return;

    const termo = (document.getElementById('searchSinistro')?.value || '').toLowerCase();
    let filtradas = ordensServico.filter(o => o.status !== 'Concluída' && (o.tipo === 'Sinistro' || o.status === 'Sinistrado'));

    if (termo) {
        filtradas = filtradas.filter(o => 
            (o.placa && o.placa.toLowerCase().includes(termo)) ||
            (o.motorista && o.motorista.toLowerCase().includes(termo))
        );
    }

    tbody.innerHTML = filtradas.map(os => {
        let corStatus = '#ef4444'; 
        const inicioStr = formatarDataHoraBrasil(os.data_abertura);
        const previsaoStr = os.previsao_entrega ? formatarDataHoraBrasil(os.previsao_entrega) : 'Indeterminada';

        return `
            <tr style="background: rgba(239, 68, 68, 0.05); border-left: 4px solid #ef4444;">
                <td><strong>#${os.id}</strong></td>
                <td>💥 ${inicioStr}</td>
                <td>${previsaoStr}</td>
                <td style="color: #ef4444; font-weight: bold; font-size: 1.1rem;">${os.placa || '-'}</td>
                <td>${os.motorista || '-'}</td>
                <td style="font-size: 0.85rem; color: #fca5a5;">${os.problema || 'Sinistro Reportado'}</td>
                <td><span style="color: ${corStatus}; font-weight: bold; text-transform: uppercase;">Inativo (Sinistro)</span></td>
                <td>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-start; align-items: center;">
                        <button class="btn-primary-blue" onclick="abrirModalServicoExtra(${os.id})" title="Atualizar Previsão" style="padding: 6px 12px; font-size: 0.8rem; white-space: nowrap; border-radius: 4px;">📅 Nova Previsão</button>
                        <button class="btn-primary-green" onclick="abrirModalConclusaoOS(${os.id})" style="padding: 6px 12px; font-size: 0.8rem; white-space: nowrap; border-radius: 4px;">✅ Retorno</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderizarTabelaHistoricoOS() {
    const tbody = document.getElementById('tabelaHistoricoOS');
    if (!tbody) return;

    const num = document.getElementById('filtroHistOSNum')?.value.toLowerCase();
    const placa = document.getElementById('filtroHistPlaca')?.value;
    const motorista = document.getElementById('filtroHistMotorista')?.value;
    const dataInicio = document.getElementById('filtroHistDataInicio')?.value;
    const dataFim = document.getElementById('filtroHistDataFim')?.value;
    const tipo = document.getElementById('filtroHistTipo')?.value;
    
    // Filtro Mês/Ano (Novo)
    const mesAno = document.getElementById('filtroHistMesAno')?.value;

    let filtradas = ordensServico;

    if (num) filtradas = filtradas.filter(o => o.id.toString() === num);
    if (placa) filtradas = filtradas.filter(o => o.placa && o.placa.toUpperCase() === placa.toUpperCase());
    if (motorista) filtradas = filtradas.filter(o => o.motorista && o.motorista === motorista);
    
    // Lógica do Filtro Mês/Ano Ex: '2026-04'
    if (mesAno) {
        filtradas = filtradas.filter(o => {
            if (!o.data_abertura) return false;
            return o.data_abertura.substring(0, 7) === mesAno;
        });
    }
    
    if (dataInicio || dataFim) {
        filtradas = filtradas.filter(o => {
            if (!o.data_abertura) return false;
            const dtAbertura = o.data_abertura.split('T')[0];
            if (dataInicio && dtAbertura < dataInicio) return false;
            if (dataFim && dtAbertura > dataFim) return false;
            return true;
        });
    }
    
    if (tipo) {
        filtradas = filtradas.filter(o => o.tipo && o.tipo === tipo);
    }

    tbody.innerHTML = filtradas.map(os => {
        let corStatus = '#f59e0b';
        if (os.status === 'Concluída') corStatus = 'var(--ccol-green-bright)';
        if (os.status === 'Em Manutenção') corStatus = '#3b82f6';
        if (os.status === 'Sinistrado' || os.tipo === 'Sinistro') corStatus = '#ef4444';

        const dataAbertura = formatarDataHoraBrasil(os.data_abertura);
        const dataConclusao = os.data_conclusao ? formatarDataHoraBrasil(os.data_conclusao) : '-';

        return `
            <tr>
                <td><strong>#${os.id}</strong></td>
                <td>${dataAbertura}</td>
                <td style="${os.status === 'Concluída' ? 'color: var(--ccol-green-bright);' : ''}">${dataConclusao}</td>
                <td style="color: var(--ccol-blue-bright); font-weight: bold;">${os.placa || '-'}</td>
                <td>${os.motorista || '-'}</td>
                <td>${os.tipo}</td>
                <td><span style="color: ${corStatus}; font-weight: bold;">${os.status}</span></td>
                <td>
                    <div style="display: flex; gap: 5px; justify-content: flex-start;">
                        <button class="btn-secondary-dark" onclick="imprimirOS(${os.id})" title="Imprimir O.S." style="padding: 4px 8px; font-size: 0.8rem; border-radius: 4px;">🖨️</button>
                        <button class="btn-danger-outline" onclick="excluirOS(${os.id})" title="Excluir" style="padding: 4px 8px; font-size: 0.8rem; border-radius: 4px;">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderizarTabelaFrotaManutencao() {
    const tbody = document.getElementById('tabelaFrotaManutencao');
    if (!tbody) return;
    tbody.innerHTML = frotasManutencao.map(f => `
        <tr>
            <td style="font-weight: bold; color: var(--ccol-blue-bright);">${f.cavalo}</td>
            <td style="text-transform: capitalize;">${f.cor || '-'}</td>
            <td>${f.go || '-'}</td>
            <td>${f.carreta1 || '-'}</td>
            <td>${f.carreta2 || '-'}</td>
            <td>${f.carreta3 || '-'}</td>
            <td>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button onclick="abrirModalTransferenciaFrota(${f.id})" style="background:transparent; border:none; color:var(--ccol-green-bright); cursor:pointer; font-size: 1.2rem;" title="Transferir Carretas/GO">🔄</button>
                    <button onclick="editarFrotaManutencao(${f.id})" style="background:transparent; border:none; color:var(--ccol-blue-bright); cursor:pointer; font-size: 1.2rem;" title="Editar">✏️</button>
                    <button onclick="excluirFrotaManutencao(${f.id})" style="background:transparent; border:none; color:#ef4444; cursor:pointer; font-size: 1.2rem;" title="Excluir">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function setFiltroMesAtualOS() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ultimoDia = new Date(ano, hoje.getMonth() + 1, 0).getDate();

    const dataInicio = `${ano}-${mes}-01`;
    const dataFim = `${ano}-${mes}-${String(ultimoDia).padStart(2, '0')}`;

    const inputInicio = document.getElementById('filtroHistDataInicio');
    const inputFim = document.getElementById('filtroHistDataFim');

    if (inputInicio) inputInicio.value = dataInicio;
    if (inputFim) inputFim.value = dataFim;

    if (typeof renderizarTabelaHistoricoOS === 'function') renderizarTabelaHistoricoOS();
}