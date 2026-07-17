// ==================== modules/manutencao/borracharia/borracharia.js ====================

window.registrosBorracharia = [];

window.initBorracharia = async function() {
    alternarTelaBorracharia('historico');
    await carregarPlacasBorracharia();
    await buscarHistoricoBorracharia();
};

window.alternarTelaBorracharia = function(tela) {
    document.getElementById('telaHistoricoBorracharia').style.display = 'none';
    document.getElementById('telaCalibragemBorracharia').style.display = 'none';
    document.getElementById('telaTrocaBorracharia').style.display = 'none';

    if (tela === 'historico') {
        document.getElementById('telaHistoricoBorracharia').style.display = 'block';
        buscarHistoricoBorracharia();
    } else if (tela === 'calibragem') {
        document.getElementById('telaCalibragemBorracharia').style.display = 'block';
    } else if (tela === 'troca') {
        document.getElementById('telaTrocaBorracharia').style.display = 'block';
    }
};

window.carregarPlacasBorracharia = async function() {
    const selects = [document.getElementById('calibragemPlaca'), document.getElementById('trocaPlaca')];
    
    // Garante que a frota global está carregada
    if (!window.frotasManutencao || window.frotasManutencao.length === 0) {
        if (typeof carregarDadosOS === 'function') {
            await carregarDadosOS();
        }
    }

    let options = '<option value="">Selecione um veículo...</option>';
    if (window.frotasManutencao) {
        window.frotasManutencao.forEach(f => {
            if (f.cavalo) {
                options += `<option value="${f.cavalo}">${f.cavalo}</option>`;
            }
            if (f.go) {
                options += `<option value="${f.go}">${f.go} (GO)</option>`;
            }
        });
    }

    selects.forEach(select => {
        if (select) select.innerHTML = options;
    });
};

window.buscarHistoricoBorracharia = async function() {
    try {
        let query = window.supabaseClient.from('borracharia_registros').select('*').order('data_registro', { ascending: false });
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
        
        const { data, error } = await query;
        if (error) throw error;
        
        window.registrosBorracharia = data || [];
        renderizarHistoricoBorracharia();
    } catch (error) {
        console.error("Erro ao buscar histórico da borracharia:", error);
        document.getElementById('tabelaHistoricoBorracharia').innerHTML = '<tr><td colspan="7" style="color:red;">Aviso: Tabela "borracharia_registros" não encontrada ou vazia. Crie-a no Supabase.</td></tr>';
    }
};

window.renderizarHistoricoBorracharia = function() {
    const tbody = document.getElementById('tabelaHistoricoBorracharia');
    if (!tbody) return;

    const termo = (document.getElementById('searchBorracharia')?.value || '').toLowerCase();
    
    let filtrados = window.registrosBorracharia;
    if (termo) {
        filtrados = filtrados.filter(r => (r.placa && r.placa.toLowerCase().includes(termo)));
    }

    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#94a3b8;">Nenhum registro encontrado.</td></tr>';
        return;
    }

    tbody.innerHTML = filtrados.map(r => {
        const dataFormatada = new Date(r.data_registro).toLocaleString('pt-BR');
        const corServico = r.tipo_servico === 'Troca' ? '#ef4444' : '#10b981';
        
        return `
            <tr>
                <td>${dataFormatada}</td>
                <td style="color: var(--ccol-blue-bright); font-weight: bold;">${r.placa}</td>
                <td style="color: ${corServico}; font-weight: bold;">${r.tipo_servico}</td>
                <td>${r.posicao || '-'}</td>
                <td>${r.detalhe || '-'}</td>
                <td>${r.mecanico || '-'}</td>
                <td>${r.motivo || '-'}</td>
            </tr>
        `;
    }).join('');
};

window.salvarServicoBorracharia = async function(tipo) {
    let placa, posicao, detalhe, motivo;
    
    const usuarioLogado = (window.currentUser && window.currentUser.username) ? window.currentUser.username : 'Mecânico';

    if (tipo === 'Calibragem') {
        placa = document.getElementById('calibragemPlaca').value;
        posicao = document.getElementById('calibragemPosicao').value.trim();
        const pressao = document.getElementById('calibragemPressao').value;
        detalhe = pressao ? pressao + ' lbs' : '';
        motivo = document.getElementById('calibragemObs').value.trim();
        
        if (!placa || !posicao || !pressao) {
            alert('Preencha a Placa, Posição e a Pressão.');
            return;
        }
    } else {
        placa = document.getElementById('trocaPlaca').value;
        posicao = document.getElementById('trocaPosicao').value.trim();
        detalhe = document.getElementById('trocaMarca').value.trim();
        const motivoSelect = document.getElementById('trocaMotivo').value;
        const obs = document.getElementById('trocaObs').value.trim();
        motivo = obs ? `${motivoSelect} - ${obs}` : motivoSelect;

        if (!placa || !posicao || !detalhe) {
            alert('Preencha a Placa, Posição e a Marca do Pneu Novo.');
            return;
        }
    }

    let insertData = {
        data_registro: new Date().toISOString(),
        placa: placa,
        tipo_servico: tipo,
        posicao: posicao,
        detalhe: detalhe,
        motivo: motivo,
        mecanico: usuarioLogado
    };

    if (typeof window.injetarFilial === 'function') {
        insertData = window.injetarFilial(insertData);
    }

    try {
        const { error } = await window.supabaseClient.from('borracharia_registros').insert([insertData]);
        if (error) throw error;
        
        alert(`${tipo} registrada com sucesso!`);
        
        // Limpa campos
        if (tipo === 'Calibragem') {
            document.getElementById('calibragemPosicao').value = '';
            document.getElementById('calibragemPressao').value = '';
            document.getElementById('calibragemObs').value = '';
        } else {
            document.getElementById('trocaPosicao').value = '';
            document.getElementById('trocaMarca').value = '';
            document.getElementById('trocaObs').value = '';
        }

        alternarTelaBorracharia('historico');
        
    } catch (error) {
        console.error("Erro ao salvar na borracharia:", error);
        alert(`Erro ao salvar: O banco de dados pode não estar configurado corretamente. Crie a tabela "borracharia_registros". Detalhes: ${error.message}`);
    }
};