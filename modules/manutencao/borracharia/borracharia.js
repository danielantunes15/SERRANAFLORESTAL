// ==================== modules/manutencao/borracharia/borracharia.js ====================

window.registrosBorracharia = [];

window.initBorracharia = async function() {
    // CORREÇÃO: Força o sistema a baixar a lista de caminhões do banco de dados antes de carregar a tela
    if (typeof carregarDadosOS === 'function') {
        await carregarDadosOS();
    }
    
    // Seta a data e hora atual nos inputs por padrão
    const agora = new Date();
    const fusoAjuste = new Date(agora.getTime() - (agora.getTimezoneOffset() * 60000));
    document.getElementById('calibragemData').value = fusoAjuste.toISOString().slice(0, 16);
    document.getElementById('trocaData').value = fusoAjuste.toISOString().slice(0, 16);

    await buscarHistoricoBorracharia();
    
    // Só renderiza o painel depois que tudo já foi carregado
    alternarTelaBorracharia('painel');
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
    
    // Garantia dupla de que a frota está carregada
    if (!window.frotasManutencao || window.frotasManutencao.length === 0) {
        if (typeof carregarDadosOS === 'function') await carregarDadosOS();
    }

    let options = '<option value="">Selecione um veículo...</option>';
    if (window.frotasManutencao) {
        window.frotasManutencao.forEach(f => {
            // Tratamento contra espaços em branco e letras minúsculas
            const catBanco = f.categoria ? f.categoria.trim().toUpperCase() : '';
            const catFiltro = categoria ? categoria.trim().toUpperCase() : '';
            
            // Filtra pela categoria selecionada, se houver
            if (catFiltro && catBanco !== catFiltro && catFiltro !== 'TODAS') return;
            
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
    } catch (error) {
        console.error("Erro ao buscar histórico da borracharia:", error);
    }
};

window.renderizarPainelBorracharia = function() {
    const agora = new Date();
    const trintaDiasAtras = new Date(agora.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    // Calcula KPIs do mês atual
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

    // ALERTA DE VENCIMENTO: Puxa TODOS os veículos da frota geral para garantir que "os sem calibração" apareçam.
    const frotaGeral = window.frotasManutencao || [];
    const alertas = [];

    frotaGeral.forEach(f => {
        if (!f.cavalo) return;
        
        // Exclui a categoria GRUA do alerta
        const catBanco = f.categoria ? f.categoria.trim().toUpperCase() : '';
        if (catBanco === 'GRUA') return; 

        // Pega as calibragens apenas deste cavalo
        const calibsCavalo = window.registrosBorracharia.filter(r => r.placa === f.cavalo && r.tipo_servico === 'Calibragem');
        
        let diasEmAtraso = 'Nunca Calibrado';
        let dataUltima = '-';
        let isAtrasado = false;

        // Se encontrou alguma calibração, checa os dias. Se não encontrou nenhuma (0), já cai no isAtrasado = true
        if (calibsCavalo.length > 0) {
            // Ordenamos a lista para ter certeza que o item [0] é o mais recente
            calibsCavalo.sort((a, b) => new Date(b.data_registro) - new Date(a.data_registro));
            
            const lastCalib = calibsCavalo[0];
            const dataLast = new Date(lastCalib.data_registro);
            const diffMs = agora - dataLast;
            const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            
            dataUltima = dataLast.toLocaleDateString('pt-BR');
            diasEmAtraso = diffDias + ' dias';
            
            if (diffDias > 15) isAtrasado = true;
        } else {
            // Nunca calibrado
            isAtrasado = true;
        }

        if (isAtrasado) {
            const statusTexto = f.status ? `(${f.status})` : '';
            alertas.push({
                placa: f.cavalo,
                frota: `${f.numero_frota || '-'} ${statusTexto}`,
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
        // Renderiza as linhas dos veículos vencidos/nunca calibrados
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
        renderizarPainelBorracharia(); // Atualiza o alerta automaticamente
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

    // Removemos todas as amarras de "status === Ativo" e garantimos o trim() para não ter erro
    const frotasCategoria = (window.frotasManutencao || []).filter(f => {
        const catBanco = f.categoria ? f.categoria.trim().toUpperCase() : '';
        const catFiltro = categoria.trim().toUpperCase();
        
        if (catFiltro === 'TODAS') return true;
        return catBanco === catFiltro;
    });
    
    if (frotasCategoria.length === 0) {
        alert('Nenhum veículo encontrado para a seleção.');
        return;
    }

    // Ordenar primeiro por Frota, depois pela Placa
    frotasCategoria.sort((a, b) => (a.numero_frota || a.cavalo).localeCompare(b.numero_frota || b.cavalo));

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');

    // Cabeçalho Principal
    doc.setFontSize(16);
    doc.text(`Ficha de Controle de Borracharia - ${categoria === 'TODAS' ? 'GERAL' : categoria}`, 14, 15);
    
    // Campo fixo para o mecânico colocar a data do dia em que ele foi fazer a checagem
    doc.setFontSize(12);
    doc.text(`Data do Controle a Campo: ____/____/202___`, 210, 15);
    
    doc.setFontSize(10);
    doc.text(`Data de Impressão: ${new Date().toLocaleDateString('pt-BR')}`, 14, 22);
    doc.text(`Instruções: Preencha a data de serviço para os calibrados, anote a pressão, trocas e assine na frente.`, 14, 28);

    const tableCols = [
        "Placa (Cavalo)", 
        "Nº Frota / Status", 
        "Categoria",
        "Data Serviço", 
        "Pressão (Lbs)", 
        "Pneus Trocados", 
        "Assinatura (Mecânico)", 
        "Observações"
    ];

    const tableRows = [];

    frotasCategoria.forEach(f => {
        const frotaTexto = f.numero_frota || '-';
        const statusTexto = f.status ? `(${f.status})` : '';
        
        tableRows.push([
            f.cavalo || '-',
            `${frotaTexto} ${statusTexto}`,
            f.categoria || '-',
            "", 
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
        headStyles: { fillColor: [4, 120, 87] },
        styles: { 
            fontSize: 9, 
            cellPadding: 6, // Mais espaçoso para facilitar escrever à caneta
            minCellHeight: 15
        },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 25 },
            1: { cellWidth: 35 },
            2: { cellWidth: 25 }, // Categoria
            3: { cellWidth: 25 }, // Data serviço
            4: { cellWidth: 25 }, // Pressao
            5: { cellWidth: 40 }, // Pneus Trocados
            6: { cellWidth: 35 }  // Assinatura
            // Coluna Observações pega o restante do espaço da folha
        }
    });

    doc.save(`Ficha_Borracharia_${categoria}_${new Date().getTime()}.pdf`);
    fecharModalFichaBorracharia();
};