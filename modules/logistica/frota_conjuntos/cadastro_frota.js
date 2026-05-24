// ==================== js/cadastro_frota.js ====================

window.renderizarTelaCadastroFrota = async function() {
    if(typeof carregarDadosOS === 'function') {
        await carregarDadosOS();
    }
    const campoData = document.getElementById('osFrotaDataInicial');
    if(campoData && !campoData.value) {
        const hoje = new Date();
        campoData.value = hoje.toISOString().split('T')[0];
    }
    renderizarTabelaCadastroFrota();
};

function renderizarTabelaCadastroFrota() {
    const tbody = document.getElementById('tabelaFrotaManutencaoCad');
    if (!tbody || typeof frotasManutencao === 'undefined') return;
    
    tbody.innerHTML = '';
    
    if (frotasManutencao.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Nenhum conjunto cadastrado.</td></tr>';
        return;
    }

    frotasManutencao.forEach(frota => {
        const statusTexto = frota.status || 'Ativo';
        const statusCor = statusTexto === 'Ativo' ? '#22c55e' : '#ef4444';
        const badgeStatus = `<span style="background-color: ${statusCor}20; color: ${statusCor}; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; border: 1px solid ${statusCor}40;">${statusTexto}</span>`;

        let dataFormatada = '01/04/2026';
        if (frota.data_inicial) {
            const partes = frota.data_inicial.split('-');
            if (partes.length === 3) dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
        }

        tbody.innerHTML += `
            <tr>
                <td>${badgeStatus}</td>
                <td style="color: #94a3b8; font-size: 0.9rem;">${dataFormatada}</td>
                <td style="color: var(--ccol-blue-bright); font-weight: bold; font-size: 1.1rem;">${frota.cavalo || '-'}</td>
                <td>${frota.cor || '-'}</td>
                <td style="font-weight: bold;">${frota.go || '-'}</td>
                <td>${frota.carreta1 || '-'}</td>
                <td>${frota.carreta2 || '-'}</td>
                <td>${frota.carreta3 || '-'}</td>
                <td style="text-align: right; display: flex; gap: 5px; justify-content: flex-end;">
                    <button title="Trocar Composição" class="btn-action-sm" style="background-color: #8b5cf6;" onclick="abrirModalTransferenciaFrota(${frota.id})"><i class="fas fa-exchange-alt"></i></button>
                    <button title="Editar" class="btn-action-sm btn-edit" onclick="editarFrotaManutencao(${frota.id})"><i class="fas fa-pen"></i></button>
                    <button title="Excluir" class="btn-action-sm btn-delete" onclick="excluirFrotaManutencao(${frota.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

window.salvarFrotaManutencao = async function() {
    const cavalo = document.getElementById('osFrotaCavalo').value.trim().toUpperCase();
    const status = document.getElementById('osFrotaStatus').value;
    const data_inicial = document.getElementById('osFrotaDataInicial').value || '2026-04-01';
    const cor = document.getElementById('osFrotaCor').value.trim();
    const go = document.getElementById('osFrotaGo').value.trim().toUpperCase();
    const carreta1 = document.getElementById('osFrotaCarreta1').value.trim().toUpperCase();
    const carreta2 = document.getElementById('osFrotaCarreta2').value.trim().toUpperCase();
    const carreta3 = document.getElementById('osFrotaCarreta3').value.trim().toUpperCase();

    if (!cavalo) {
        alert("A placa do cavalo é obrigatória.");
        return;
    }

    const existente = frotasManutencao.find(f => f.cavalo === cavalo);
    if (existente) {
        alert("Já existe um conjunto cadastrado para este cavalo. Use a opção de editar.");
        return;
    }

    try {
        // INJEÇÃO DO FILTRO DE FILIAL NA CRIAÇÃO DA FROTA
        const payload = window.injetarFilial({ cavalo, status, data_inicial, cor, go, carreta1, carreta2, carreta3 });
        const { error } = await supabaseClient.from('frotas_manutencao').insert([payload]);
        if (error) throw error;

        alert("Conjunto cadastrado com sucesso!");
        document.getElementById('osFrotaCavalo').value = '';
        document.getElementById('osFrotaStatus').value = 'Ativo';
        document.getElementById('osFrotaDataInicial').value = new Date().toISOString().split('T')[0];
        document.getElementById('osFrotaCor').value = '';
        document.getElementById('osFrotaGo').value = '';
        document.getElementById('osFrotaCarreta1').value = '';
        document.getElementById('osFrotaCarreta2').value = '';
        document.getElementById('osFrotaCarreta3').value = '';

        await carregarDadosOS();
        renderizarTabelaCadastroFrota();
    } catch(err) { alert("Erro ao inserir o novo conjunto."); console.error(err); }
};

window.editarFrotaManutencao = function(id) {
    const frota = frotasManutencao.find(f => f.id === id);
    if (!frota) return;

    document.getElementById('editFrotaId').value = frota.id;
    document.getElementById('editFrotaCavalo').value = frota.cavalo || '';
    document.getElementById('editFrotaStatus').value = frota.status || 'Ativo';
    document.getElementById('editFrotaDataInicial').value = frota.data_inicial || '2026-04-01';
    document.getElementById('editFrotaCor').value = frota.cor || '';
    document.getElementById('editFrotaGo').value = frota.go || '';
    document.getElementById('editFrotaCarreta1').value = frota.carreta1 || '';
    document.getElementById('editFrotaCarreta2').value = frota.carreta2 || '';
    document.getElementById('editFrotaCarreta3').value = frota.carreta3 || '';
    
    document.getElementById('modalEditarFrota').style.display = 'flex';
};

window.fecharModalEditarFrota = function() {
    document.getElementById('modalEditarFrota').style.display = 'none';
};

window.salvarEdicaoFrota = async function() {
    const id = document.getElementById('editFrotaId').value;
    const cavalo = document.getElementById('editFrotaCavalo').value.trim().toUpperCase();
    const status = document.getElementById('editFrotaStatus').value;
    const data_inicial = document.getElementById('editFrotaDataInicial').value || '2026-04-01';
    const cor = document.getElementById('editFrotaCor').value.trim();
    const go = document.getElementById('editFrotaGo').value.trim().toUpperCase();
    const carreta1 = document.getElementById('editFrotaCarreta1').value.trim().toUpperCase();
    const carreta2 = document.getElementById('editFrotaCarreta2').value.trim().toUpperCase();
    const carreta3 = document.getElementById('editFrotaCarreta3').value.trim().toUpperCase();

    if (!cavalo) return alert("A placa do cavalo é obrigatória.");

    try {
        const { error } = await supabaseClient.from('frotas_manutencao').update({ cavalo, status, data_inicial, cor, go, carreta1, carreta2, carreta3 }).eq('id', id);
        if (error) throw error;
        
        alert("Conjunto atualizado com sucesso!");
        fecharModalEditarFrota();
        await carregarDadosOS();
        renderizarTabelaCadastroFrota();
    } catch(error) { alert("Ocorreu um erro ao tentar salvar as alterações."); }
};

window.excluirFrotaManutencao = async function(id) {
    if (confirm("Excluir definitivamente este conjunto da frota?")) {
        await supabaseClient.from('frotas_manutencao').delete().eq('id', id);
        await carregarDadosOS();
        renderizarTabelaCadastroFrota();
    }
};

window.abrirModalTransferenciaFrota = function(idOriginal) {
    const frotaOrigem = frotasManutencao.find(f => f.id === idOriginal);
    if (!frotaOrigem) return;
    document.getElementById('transfFrotaOrigemId').value = frotaOrigem.id;
    document.getElementById('transfFrotaOrigemText').innerText = frotaOrigem.cavalo;

    const selectDestino = document.getElementById('selectFrotaDestino');
    selectDestino.innerHTML = '<option value="">Selecione o Cavalo de Destino...</option>';
    frotasManutencao.forEach(f => {
        if (f.id !== frotaOrigem.id) {
            selectDestino.innerHTML += `<option value="${f.id}">${f.cavalo}</option>`;
        }
    });
    document.getElementById('modalTransferenciaFrota').style.display = 'flex';
};

window.fecharModalTransferenciaFrota = function() {
    document.getElementById('modalTransferenciaFrota').style.display = 'none';
};

window.confirmarTransferenciaFrota = async function() {
    const idOrigem = document.getElementById('transfFrotaOrigemId').value;
    const idDestino = document.getElementById('selectFrotaDestino').value;

    if (!idDestino) return alert("Selecione um Cavalo de destino.");

    const frotaOrigem = frotasManutencao.find(f => String(f.id) === String(idOrigem));
    const frotaDestino = frotasManutencao.find(f => String(f.id) === String(idDestino));

    if (!frotaOrigem || !frotaDestino) return;

    try {
        const origGo = frotaOrigem.go;
        const origC1 = frotaOrigem.carreta1;
        const origC2 = frotaOrigem.carreta2;
        const origC3 = frotaOrigem.carreta3;

        const destGo = frotaDestino.go;
        const destC1 = frotaDestino.carreta1;
        const destC2 = frotaDestino.carreta2;
        const destC3 = frotaDestino.carreta3;

        await supabaseClient.from('frotas_manutencao').update({
            go: destGo, carreta1: destC1, carreta2: destC2, carreta3: destC3
        }).eq('id', frotaOrigem.id);

        await supabaseClient.from('frotas_manutencao').update({
            go: origGo, carreta1: origC1, carreta2: origC2, carreta3: origC3
        }).eq('id', frotaDestino.id);

        alert("Transferência de composição realizada com sucesso!");
        fecharModalTransferenciaFrota();
        await carregarDadosOS();
        renderizarTabelaCadastroFrota();
    } catch (e) { alert("Erro ao transferir frota."); }
};

window.exportarFrotaManutencaoExcel = function() {
    if (frotasManutencao.length === 0) return alert("Não há dados de frota para exportar.");
    
    let csvContent = "\uFEFF"; 
    csvContent += "Status;Data Inicial;Cavalo;Cor;Frota;Carreta 1;Carreta 2;Carreta 3\n";
    frotasManutencao.forEach(f => {
        let d = f.data_inicial || '2026-04-01';
        let linha = [f.status||'Ativo', d, f.cavalo||'', f.cor||'', f.go||'', f.carreta1||'', f.carreta2||'', f.carreta3||''].join(";");
        csvContent += linha + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Cadastro_Frotas_OS.csv";
    link.click();
    URL.revokeObjectURL(url);
};