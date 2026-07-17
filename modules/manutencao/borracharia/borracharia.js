// ==================== modules/manutencao/borracharia/borracharia.js ====================

window.registrosBorracharia = [];

window.initBorracharia = async function() {
    if (typeof carregarDadosOS === 'function') {
        await carregarDadosOS();
    }
    
    const agora = new Date();
    const fusoAjuste = new Date(agora.getTime() - (agora.getTimezoneOffset() * 60000));
    document.getElementById('calibragemData').value = fusoAjuste.toISOString().slice(0, 16);
    document.getElementById('trocaData').value = fusoAjuste.toISOString().slice(0, 16);

    await buscarHistoricoBorracharia();
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
    
    if (!window.frotasManutencao || window.frotasManutencao.length === 0) {
        if (typeof carregarDadosOS === 'function') await carregarDadosOS();
    }

    let options = '<option value="">Selecione um veículo...</option>';
    if (window.frotasManutencao) {
        window.frotasManutencao.forEach(f => {
            const catBanco = f.categoria ? f.categoria.trim().toUpperCase() : '';
            const catFiltro = categoria ? categoria.trim().toUpperCase() : '';
            
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

    const frotaGeral = window.frotasManutencao || [];
    const alertas = [];

    frotaGeral.forEach(f => {
        if (!f.cavalo) return;
        
        const catBanco = f.categoria ? f.categoria.trim().toUpperCase() : '';
        if (catBanco === 'GRUA') return; 

        const calibsCavalo = window.registrosBorracharia.filter(r => r.placa === f.cavalo && r.tipo_servico === 'Calibragem');
        
        let diasEmAtraso = 'Nunca Calibrado';
        let dataUltima = '-';
        let isAtrasado = false;

        if (calibsCavalo.length > 0) {
            calibsCavalo.sort((a, b) => new Date(b.data_registro) - new Date(a.data_registro));
            
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
        renderizarPainelBorracharia(); 
        alternarTelaBorracharia('historico');
        
    } catch (error) {
        console.error("Erro ao salvar na borracharia:", error);
        alert(`Erro ao salvar. Verifique a conexão.`);
    }
};

// Funções para gerenciar o Modal do Livro Mensal
window.abrirModalLivroBorracharia = function() {
    const inputMes = document.getElementById('livroMesAno');
    if (inputMes) {
        const agora = new Date();
        const ano = agora.getFullYear();
        const mes = String(agora.getMonth() + 1).padStart(2, '0');
        inputMes.value = `${ano}-${mes}`;
    }
    document.getElementById('modalLivroBorracharia').style.display = 'flex';
};

window.fecharModalLivroBorracharia = function() {
    document.getElementById('modalLivroBorracharia').style.display = 'none';
};