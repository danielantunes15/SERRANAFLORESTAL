// ==================== modules/manutencao/borracharia/borracharia.js ====================

window.registrosBorracharia = [];

window.initBorracharia = async function() {
    alternarTelaBorracharia('painel');
    
    // Seta a data e hora atual nos inputs por padrão
    const agora = new Date();
    const fusoAjuste = new Date(agora.getTime() - (agora.getTimezoneOffset() * 60000));
    document.getElementById('calibragemData').value = fusoAjuste.toISOString().slice(0, 16);
    document.getElementById('trocaData').value = fusoAjuste.toISOString().slice(0, 16);

    await buscarHistoricoBorracharia();
};

window.alternarTelaBorracharia = function(tela) {
    document.getElementById('telaPainelBorracharia').style.display = 'none';
    document.getElementById('telaHistoricoBorracharia').style.display = 'none';
    document.getElementById('telaCalibragemBorracharia').style.display = 'none';
    document.getElementById('telaTrocaBorracharia').style.display = 'none';

    if (tela === 'painel') {
        document.getElementById('telaPainelBorracharia').style.display = 'block';
        renderizarPainelBorracharia();
    } else if (tela === 'historico') {
        document.getElementById('telaHistoricoBorracharia').style.display = 'block';
        renderizarHistoricoBorracharia();
    } else if (tela === 'calibragem') {
        document.getElementById('telaCalibragemBorracharia').style.display = 'block';
        carregarPlacasBorracharia('calibragem');
    } else if (tela === 'troca') {
        document.getElementById('telaTrocaBorracharia').style.display = 'block';
        carregarPlacasBorracharia('troca');
    }
};

window.carregarPlacasBorracharia = async function(prefixo) {
    const select = document.getElementById(prefixo + 'Placa');
    const categoria = document.getElementById(prefixo + 'Categoria').value;
    
    if (!window.frotasManutencao || window.frotasManutencao.length === 0) {
        if (typeof carregarDadosOS === 'function') await carregarDadosOS();
    }

    let options = '<option value="">Selecione um veículo...</option>';
    if (window.frotasManutencao) {
        window.frotasManutencao.forEach(f => {
            // Filtra pela categoria selecionada, se houver
            if (categoria && f.categoria !== categoria) return;
            
            if (f.cavalo) {
                options += `<option value="${f.cavalo}">${f.cavalo}</option>`;
            }
            if (f.go) {
                options += `<option value="${f.go}">${f.go} (GO)</option>`;
            }
        });
    }

    if (select) select.innerHTML = options;
};

window.buscarHistoricoBorracharia = async function() {
    try {
        let query = window.supabaseClient.from('borracharia_registros').select('*').order('data_registro', { ascending: false });
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
        
        const { data, error } = await query;
        if (error) throw error;
        
        window.registrosBorracharia = data || [];
        renderizarPainelBorracharia();
        renderizarHistoricoBorracharia();
    } catch (error) {
        console.error("Erro ao buscar histórico da borracharia:", error);
    }
};

window.renderizarPainelBorracharia = function() {
    const agora = new Date();
    const trintaDiasAtras = new Date(agora.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    // Calcula KPIs
    let calibsMes = 0;
    let trocasMes = 0;
    
    window.registrosBorracharia.forEach(r => {
        const dataReg = new Date(r.data_registro);
        if (dataReg >= trintaDiasAtras) {
            if (r.tipo_servico === 'Calibragem') calibsMes++;
            if (r.tipo_servico === 'Troca') trocasMes++;
        }
    });

    document.getElementById('kpiCalibragensMes').innerText = calibsMes;
    document.getElementById('kpiTrocasMes').innerText = trocasMes;

    // Alertas de Vencimento
    const frotasAtivas = (window.frotasManutencao || []).filter(f => f.status === 'Ativo');
    const alertas = [];

    frotasAtivas.forEach(f => {
        if (!f.cavalo) return;
        
        // Pega as calibragens deste cavalo
        const calibsCavalo = window.registrosBorracharia.filter(r => r.placa === f.cavalo && r.tipo_servico === 'Calibragem');
        let diasEmAtraso = 'Nunca Calibrado';
        let dataUltima = '-';
        let isAtrasado = false;

        if (calibsCavalo.length > 0) {
            // Como já vem ordenado desc do banco, o índice 0 é o mais recente
            const lastCalib = calibsCavalo[0];
            const dataLast = new Date(lastCalib.data_registro);
            const diffMs = agora - dataLast;
            const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            
            dataUltima = dataLast.toLocaleDateString('pt-BR');
            diasEmAtraso = diffDias + ' dias';
            
            if (diffDias > 15) isAtrasado = true;
        } else {
            isAtrasado = true;
        }

        if (isAtrasado) {
            alertas.push({
                placa: f.cavalo,
                frota: f.numero_frota || '-',
                categoria: f.categoria || 'Não definida',
                dataUltima: dataUltima,
                dias: diasEmAtraso
            });
        }
    });

    document.getElementById('kpiVencidos').innerText = alertas.length;

    const tbodyAlertas = document.getElementById('tabelaAlertasBorracharia');
    if (alertas.length === 0) {
        tbodyAlertas.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#10b981; font-weight:bold;">Toda a frota está com a calibração em dia!</td></tr>';
    } else {
        tbodyAlertas.innerHTML = alertas.map(a => `
            <tr style="background: rgba(239, 68, 68, 0.05);">
                <td style="color: #ef4444; font-weight: bold;">${a.placa}</td>
                <td>${a.frota}</td>
                <td>${a.categoria}</td>
                <td>${a.dataUltima}</td>
                <td style="color: #f59e0b; font-weight: bold;"><i class="fas fa-clock"></i> ${a.dias}</td>
                <td>
                    <button class="btn-primary-green" onclick="alternarTelaBorracharia('calibragem')" style="padding: 4px 8px; font-size: 0.8rem;">Calibrar</button>
                </td>
            </tr>
        `).join('');
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
        // Formatar para Data e Hora Brasil
        let dataFormatada = '-';
        if(r.data_registro) {
            const dataObj = new Date(r.data_registro);
            dataFormatada = dataObj.toLocaleDateString('pt-BR') + ' ' + dataObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        }
        
        const corServico = r.tipo_servico === 'Troca' ? '#ef4444' : '#10b981';
        
        return `
            <tr>
                <td>${dataFormatada}</td>
                <td style="color: var(--ccol-blue-bright); font-weight: bold;">${r.placa}</td>
                <td style="color: ${corServico}; font-weight: bold; text-transform: uppercase;">${r.tipo_servico}</td>
                <td>${r.posicao || '-'}</td>
                <td>${r.detalhe || '-'}</td>
                <td>${r.mecanico || '-'}</td>
                <td>${r.motivo || '-'}</td>
            </tr>
        `;
    }).join('');
};

window.salvarServicoBorracharia = async function(tipo) {
    let dataServico, placa, posicao, detalhe, motivo;
    
    const usuarioLogado = (window.currentUser && window.currentUser.username) ? window.currentUser.username : 'Mecânico';

    if (tipo === 'Calibragem') {
        dataServico = document.getElementById('calibragemData').value;
        placa = document.getElementById('calibragemPlaca').value;
        posicao = document.getElementById('calibragemPosicao').value.trim();
        const pressao = document.getElementById('calibragemPressao').value;
        detalhe = pressao ? pressao + ' lbs' : '';
        motivo = document.getElementById('calibragemObs').value.trim();
        
        if (!dataServico || !placa || !posicao || !pressao) {
            alert('Preencha a Data, Placa, Posição e a Pressão.');
            return;
        }
    } else {
        dataServico = document.getElementById('trocaData').value;
        placa = document.getElementById('trocaPlaca').value;
        posicao = document.getElementById('trocaPosicao').value.trim();
        detalhe = document.getElementById('trocaMarca').value.trim();
        const motivoSelect = document.getElementById('trocaMotivo').value;
        const obs = document.getElementById('trocaObs').value.trim();
        motivo = obs ? `${motivoSelect} - ${obs}` : motivoSelect;

        if (!dataServico || !placa || !posicao || !detalhe) {
            alert('Preencha a Data, Placa, Posição e a Marca do Pneu Novo.');
            return;
        }
    }

    // Ajuste fuso horário para salvar no banco corretamente
    const dataISO = new Date(dataServico).toISOString();

    let insertData = {
        data_registro: dataISO,
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
        
        // Limpa campos mas mantém a data atualizada
        if (tipo === 'Calibragem') {
            document.getElementById('calibragemPosicao').value = '';
            document.getElementById('calibragemPressao').value = '';
            document.getElementById('calibragemObs').value = '';
        } else {
            document.getElementById('trocaPosicao').value = '';
            document.getElementById('trocaMarca').value = '';
            document.getElementById('trocaObs').value = '';
        }

        await buscarHistoricoBorracharia();
        alternarTelaBorracharia('historico');
        
    } catch (error) {
        console.error("Erro ao salvar na borracharia:", error);
        alert(`Erro ao salvar. Verifique a conexão.`);
    }
};

// ================= LÓGICA DE PDF - IMPRESSÃO MANUAL =================

window.abrirModalFichaBorracharia = function() {
    document.getElementById('modalFichaBorracharia').style.display = 'flex';
};

window.fecharModalFichaBorracharia = function() {
    document.getElementById('modalFichaBorracharia').style.display = 'none';
};

window.gerarPDFBorracharia = function() {
    const categoria = document.getElementById('printFichaCategoria').value;
    if (!categoria) return alert('Selecione uma categoria.');

    const frotasCategoria = (window.frotasManutencao || []).filter(f => f.categoria === categoria && f.status === 'Ativo');
    
    if (frotasCategoria.length === 0) {
        alert('Nenhum veículo ativo encontrado para esta categoria.');
        return;
    }

    // Ordenar por número de frota ou placa
    frotasCategoria.sort((a, b) => (a.numero_frota || a.cavalo).localeCompare(b.numero_frota || b.cavalo));

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape'); // Formato paisagem para caber mais colunas

    doc.setFontSize(16);
    doc.text(`Ficha de Controle de Borracharia - ${categoria}`, 14, 15);
    
    doc.setFontSize(10);
    doc.text(`Data de Impressão: ${new Date().toLocaleDateString('pt-BR')}`, 14, 22);
    doc.text(`Instruções: Preencha a data do serviço, a pressão medida, os pneus trocados (se houver) e assine.`, 14, 28);

    const tableCols = [
        "Placa (Cavalo)", 
        "Nº Frota", 
        "Data Serviço", 
        "Pressão Medida (Lbs)", 
        "Pneus Trocados (Posição)", 
        "Assinatura Mecânico", 
        "Observações"
    ];

    const tableRows = [];

    frotasCategoria.forEach(f => {
        tableRows.push([
            f.cavalo || '-',
            f.numero_frota || '-',
            "", // Espaço em branco para preenchimento a caneta
            "", 
            "", 
            "", 
            ""
        ]);
    });

    doc.autoTable({
        startY: 35,
        head: [tableCols],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [4, 120, 87] }, // Cor verde CCOL
        styles: { 
            fontSize: 9, 
            cellPadding: 6, // Células maiores para caber a escrita a caneta
            minCellHeight: 15
        },
        columnStyles: {
            0: { fontStyle: 'bold' },
            2: { cellWidth: 25 },
            3: { cellWidth: 35 },
            4: { cellWidth: 40 },
            5: { cellWidth: 40 }
        }
    });

    doc.save(`Ficha_Borracharia_${categoria}_${new Date().getTime()}.pdf`);
    fecharModalFichaBorracharia();
};