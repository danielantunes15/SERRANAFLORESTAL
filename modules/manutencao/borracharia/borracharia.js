// ==================== modules/manutencao/borracharia/borracharia.js ====================

window.registrosBorracharia = [];
window.pneusBorracharia = []; 

window.initBorracharia = async function() {
    if (typeof carregarDadosOS === 'function') {
        await carregarDadosOS();
    }
    
    const agora = new Date();
    const fusoAjuste = new Date(agora.getTime() - (agora.getTimezoneOffset() * 60000));
    
    // Trava de segurança: Garante que os campos existem antes de preencher
    if (document.getElementById('calibragemData')) document.getElementById('calibragemData').value = fusoAjuste.toISOString().slice(0, 16);
    if (document.getElementById('trocaData')) document.getElementById('trocaData').value = fusoAjuste.toISOString().slice(0, 16);

    await buscarHistoricoBorracharia();
    await buscarPneusBorracharia();
    
    alternarTelaBorracharia('painel');
};

window.alternarTelaBorracharia = function(tela) {
    if (document.getElementById('telaPainelBorracharia')) document.getElementById('telaPainelBorracharia').style.display = 'none';
    if (document.getElementById('telaHistoricoBorracharia')) document.getElementById('telaHistoricoBorracharia').style.display = 'none';
    if (document.getElementById('telaCalibragemBorracharia')) document.getElementById('telaCalibragemBorracharia').style.display = 'none';
    if (document.getElementById('telaTrocaBorracharia')) document.getElementById('telaTrocaBorracharia').style.display = 'none';
    if (document.getElementById('telaPneusBorracharia')) document.getElementById('telaPneusBorracharia').style.display = 'none';

    if (tela === 'painel') {
        if (document.getElementById('telaPainelBorracharia')) document.getElementById('telaPainelBorracharia').style.display = 'block';
        renderizarPainelBorracharia();
    } else if (tela === 'historico') {
        if (document.getElementById('telaHistoricoBorracharia')) document.getElementById('telaHistoricoBorracharia').style.display = 'block';
        renderizarHistoricoBorracharia();
    } else if (tela === 'calibragem') {
        if (document.getElementById('telaCalibragemBorracharia')) document.getElementById('telaCalibragemBorracharia').style.display = 'block';
        carregarPlacasBorracharia('calibragem');
    } else if (tela === 'troca') {
        if (document.getElementById('telaTrocaBorracharia')) document.getElementById('telaTrocaBorracharia').style.display = 'block';
        carregarPlacasBorracharia('troca');
        carregarPneusParaTroca();
    } else if (tela === 'pneus') {
        if (document.getElementById('telaPneusBorracharia')) document.getElementById('telaPneusBorracharia').style.display = 'block';
        renderizarPneusBorracharia();
    }
};

window.carregarPlacasBorracharia = async function(prefixo) {
    const select = document.getElementById(prefixo + 'Placa');
    if (!select) return; // Segurança

    const catElem = document.getElementById(prefixo + 'Categoria');
    const categoria = catElem ? catElem.value : 'TODAS';
    
    if (!window.frotasManutencao || window.frotasManutencao.length === 0) {
        if (typeof carregarDadosOS === 'function') await carregarDadosOS();
    }

    let options = '<option value="">Selecione um veículo...</option>';
    if (window.frotasManutencao) {
        window.frotasManutencao.forEach(f => {
            const catBanco = f.categoria ? f.categoria.trim().toUpperCase() : '';
            const catFiltro = categoria ? categoria.trim().toUpperCase() : '';
            if (catFiltro && catBanco !== catFiltro && catFiltro !== 'TODAS') return;
            
            if (f.cavalo) options += `<option value="${f.cavalo}">${f.cavalo}</option>`;
            if (f.go) options += `<option value="${f.go}">${f.go} (GO)</option>`;
        });
    }
    select.innerHTML = options;
};

window.carregarPneusParaTroca = function() {
    const selectPneu = document.getElementById('trocaFogoNovo');
    if (!selectPneu) return;
    
    let options = '<option value="">Selecione o Pneu no Estoque...</option>';
    const pneusEstoque = window.pneusBorracharia.filter(p => p.status === 'Estoque');
    
    pneusEstoque.forEach(p => {
        options += `<option value="${p.id}">Fogo: ${p.num_fogo} | ${p.marca || ''} (${p.medida || ''})</option>`;
    });
    selectPneu.innerHTML = options;
};

// ======================== LÓGICA DO PAINEL ========================

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
    
    let calibsMes = 0; let trocasMes = 0;
    window.registrosBorracharia.forEach(r => {
        const dataReg = new Date(r.data_registro);
        if (dataReg >= trintaDiasAtras) {
            if (r.tipo_servico === 'Calibragem') calibsMes++;
            if (r.tipo_servico === 'Troca') trocasMes++;
        }
    });

    if (document.getElementById('kpiCalibragensMes')) document.getElementById('kpiCalibragensMes').innerText = calibsMes;
    if (document.getElementById('kpiTrocasMes')) document.getElementById('kpiTrocasMes').innerText = trocasMes;

    // Novos KPIs de Estoque de Pneus
    const emEstoque = window.pneusBorracharia.filter(p => p.status === 'Estoque').length;
    const emRecapagem = window.pneusBorracharia.filter(p => p.status === 'Recapagem').length;
    if (document.getElementById('kpiEstoquePneus')) document.getElementById('kpiEstoquePneus').innerText = emEstoque;
    if (document.getElementById('kpiRecapagemPneus')) document.getElementById('kpiRecapagemPneus').innerText = emRecapagem;

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
            const diffDias = Math.floor((agora - new Date(calibsCavalo[0].data_registro)) / (1000 * 60 * 60 * 24));
            dataUltima = new Date(calibsCavalo[0].data_registro).toLocaleDateString('pt-BR');
            diasEmAtraso = diffDias + ' dias';
            if (diffDias > 15) isAtrasado = true;
        } else {
            isAtrasado = true;
        }

        if (isAtrasado) {
            const statusTexto = f.status ? `(${f.status})` : '';
            alertas.push({
                placa: f.cavalo, frota: `${f.numero_frota || '-'} ${statusTexto}`,
                categoria: f.categoria || 'Não definida', dataUltima: dataUltima, dias: diasEmAtraso
            });
        }
    });

    if (document.getElementById('kpiVencidos')) document.getElementById('kpiVencidos').innerText = alertas.length;
    
    const tbodyAlertas = document.getElementById('tabelaAlertasBorracharia');
    if (tbodyAlertas) {
        if (alertas.length === 0) {
            tbodyAlertas.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#10b981; font-weight:bold;">Frota em dia com a calibragem!</td></tr>';
        } else {
            tbodyAlertas.innerHTML = alertas.map(a => `
                <tr style="background: rgba(239, 68, 68, 0.05);">
                    <td style="color: #ef4444; font-weight: bold;">${a.placa}</td>
                    <td>${a.frota}</td>
                    <td>${a.categoria}</td>
                    <td>${a.dataUltima}</td>
                    <td style="color: #f59e0b; font-weight: bold;"><i class="fas fa-clock"></i> ${a.dias}</td>
                    <td><button class="btn-primary-green" onclick="alternarTelaBorracharia('calibragem')" style="padding: 4px 8px; font-size: 0.8rem;">Calibrar</button></td>
                </tr>
            `).join('');
        }
    }
};

window.renderizarHistoricoBorracharia = function() {
    const tbody = document.getElementById('tabelaHistoricoBorracharia');
    if (!tbody) return;
    const termo = (document.getElementById('searchBorracharia')?.value || '').toLowerCase();
    
    let filtrados = window.registrosBorracharia;
    if (termo) filtrados = filtrados.filter(r => (r.placa && r.placa.toLowerCase().includes(termo)));

    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#94a3b8;">Nenhum registro encontrado.</td></tr>';
        return;
    }

    tbody.innerHTML = filtrados.map(r => {
        let dataFormatada = r.data_registro ? new Date(r.data_registro).toLocaleDateString('pt-BR') + ' ' + new Date(r.data_registro).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}) : '-';
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
            </tr>`;
    }).join('');
};

window.salvarServicoBorracharia = async function(tipo) {
    const usuarioLogado = (window.currentUser && window.currentUser.username) ? window.currentUser.username : 'Mecânico';

    if (tipo === 'Calibragem') {
        const dataServico = document.getElementById('calibragemData').value;
        const placa = document.getElementById('calibragemPlaca').value;
        const posicao = document.getElementById('calibragemPosicao').value.trim();
        const pressao = document.getElementById('calibragemPressao').value;
        const detalhe = pressao ? pressao + ' lbs' : '';
        const motivo = document.getElementById('calibragemObs').value.trim();
        
        if (!dataServico || !placa || !posicao || !pressao) return alert('Preencha a Data, Placa, Posição e a Pressão.');

        let insertData = { data_registro: new Date(dataServico).toISOString(), placa, tipo_servico: tipo, posicao, detalhe, motivo, mecanico: usuarioLogado };
        if (typeof window.injetarFilial === 'function') insertData = window.injetarFilial(insertData);

        try {
            await window.supabaseClient.from('borracharia_registros').insert([insertData]);
            alert('Calibragem registrada!');
            document.getElementById('calibragemPosicao').value = '';
            document.getElementById('calibragemPressao').value = '';
            document.getElementById('calibragemObs').value = '';
            await buscarHistoricoBorracharia();
            renderizarPainelBorracharia(); 
            alternarTelaBorracharia('historico');
        } catch (error) { alert('Erro ao salvar a calibragem.'); }
        
    } else if (tipo === 'Troca') {
        const dataServico = document.getElementById('trocaData').value;
        const placa = document.getElementById('trocaPlaca').value;
        const posicao = document.getElementById('trocaPosicao').value.trim();
        
        const pneuNovoId = document.getElementById('trocaFogoNovo').value; 
        const fogoRetirado = document.getElementById('trocaFogoRetirado').value.trim(); 
        const destinoRetirado = document.getElementById('trocaDestinoRetirado').value;
        const obs = document.getElementById('trocaObs').value.trim();

        if (!dataServico || !placa || !posicao || !pneuNovoId) return alert('Preencha a Data, Placa, Posição e selecione o Pneu a Instalar.');

        const pneuNovoObj = window.pneusBorracharia.find(p => p.id == pneuNovoId);
        const detalheStr = pneuNovoObj ? `Instalou: Fogo ${pneuNovoObj.num_fogo}` : 'Troca registrada';
        
        let insertHistoricoFrota = { data_registro: new Date(dataServico).toISOString(), placa, tipo_servico: tipo, posicao, detalhe: detalheStr, motivo: obs, mecanico: usuarioLogado };
        if (typeof window.injetarFilial === 'function') insertHistoricoFrota = window.injetarFilial(insertHistoricoFrota);

        try {
            await window.supabaseClient.from('borracharia_registros').insert([insertHistoricoFrota]);
            await window.supabaseClient.from('almoxarifado_pneus').update({
                status: 'Rodando', cavalo_atual: placa, posicao: posicao
            }).eq('id', pneuNovoId);

            let movNovo = { pneu_id: pneuNovoId, tipo: 'Instalação', cavalo: placa, observacao: 'Instalado via tela de Troca Integrada' };
            if (typeof window.injetarFilial === 'function') movNovo = window.injetarFilial(movNovo);
            await window.supabaseClient.from('almoxarifado_pneus_mov').insert([movNovo]);

            if (fogoRetirado) {
                const pRetirado = window.pneusBorracharia.find(p => p.num_fogo.toUpperCase() === fogoRetirado.toUpperCase());
                if (pRetirado) {
                    await window.supabaseClient.from('almoxarifado_pneus').update({
                        status: destinoRetirado, cavalo_atual: null, posicao: null
                    }).eq('id', pRetirado.id);

                    let movRetirado = { pneu_id: pRetirado.id, tipo: 'Retirada', cavalo: placa, observacao: `Retirado na troca. Destino: ${destinoRetirado}` };
                    if (typeof window.injetarFilial === 'function') movRetirado = window.injetarFilial(movRetirado);
                    await window.supabaseClient.from('almoxarifado_pneus_mov').insert([movRetirado]);
                }
            }

            alert('Troca de pneu integrada e registrada com sucesso!');
            document.getElementById('trocaPosicao').value = '';
            document.getElementById('trocaFogoRetirado').value = '';
            document.getElementById('trocaObs').value = '';
            
            await buscarPneusBorracharia(); 
            await buscarHistoricoBorracharia(); 
            renderizarPainelBorracharia();
            alternarTelaBorracharia('historico');

        } catch (error) {
            console.error(error);
            alert('Erro ao realizar a troca integrada. Verifique a conexão.');
        }
    }
};

// ======================== MÓDULO: CADASTRO E CONTROLE DE PNEUS ========================

window.buscarPneusBorracharia = async function() {
    try {
        let query = window.supabaseClient.from('almoxarifado_pneus').select('*').order('created_at', { ascending: false });
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
        const { data, error } = await query;
        if (error) throw error;
        window.pneusBorracharia = data || [];
    } catch (e) {
        console.error("Erro ao buscar tabela de pneus:", e);
    }
};

window.renderizarPneusBorracharia = function() {
    const tbody = document.getElementById('tabelaPneusBorracharia');
    if (!tbody) return;
    const termo = (document.getElementById('searchPneus')?.value || '').toLowerCase();
    
    let filtrados = window.pneusBorracharia;
    if (termo) {
        filtrados = filtrados.filter(p => 
            (p.num_fogo && p.num_fogo.toLowerCase().includes(termo)) ||
            (p.marca && p.marca.toLowerCase().includes(termo)) ||
            (p.cavalo_atual && p.cavalo_atual.toLowerCase().includes(termo))
        );
    }

    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#94a3b8;">Nenhum pneu encontrado na base.</td></tr>';
        return;
    }

    tbody.innerHTML = filtrados.map(p => {
        let corStatus = '#10b981'; // Estoque
        if (p.status === 'Rodando') corStatus = '#3b82f6';
        if (p.status === 'Recapagem') corStatus = '#f59e0b';
        if (p.status === 'Sucata') corStatus = '#ef4444';

        const localTexto = p.cavalo_atual ? `${p.cavalo_atual} (${p.posicao || 'S/ Pos.'})` : 'No Estoque CCOL';
        const custoTexto = p.custo_atual ? `R$ ${parseFloat(p.custo_atual).toFixed(2).replace('.',',')}` : '-';

        return `
            <tr>
                <td style="color: #d8b4fe; font-weight: bold; font-size: 1.1rem;">${p.num_fogo}</td>
                <td>${p.marca || '-'} <br><span style="font-size: 0.8rem; color:#94a3b8;">${p.medida || '-'}</span></td>
                <td><span style="background: rgba(255,255,255,0.1); color: ${corStatus}; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${p.status || 'Estoque'}</span></td>
                <td><span style="font-size: 1.1rem; font-weight: 800; color: #fff;">${p.vida || 0}</span></td>
                <td>${localTexto}</td>
                <td>${custoTexto}</td>
                <td>
                    <div style="display: flex; gap: 5px; justify-content: center;">
                        <button class="btn-primary-blue" onclick="abrirModalMovPneuBorracharia(${p.id})" title="Movimentar" style="padding: 5px 10px; font-size: 0.8rem;"><i class="fas fa-exchange-alt"></i></button>
                        <button class="btn-secondary-dark" onclick="verHistoricoPneuBorracharia(${p.id})" title="Histórico" style="padding: 5px 10px; font-size: 0.8rem;"><i class="fas fa-list"></i></button>
                        <button class="btn-primary-green" onclick="abrirModalPneuBorracharia(${p.id})" title="Editar" style="padding: 5px 10px; font-size: 0.8rem;"><i class="fas fa-edit"></i></button>
                    </div>
                </td>
            </tr>`;
    }).join('');
};

window.abrirModalPneuBorracharia = function(id = null) {
    document.getElementById('pneuId').value = id || '';
    if (id) {
        const pneu = window.pneusBorracharia.find(p => p.id === id);
        document.getElementById('tituloModalPneu').innerHTML = `<i class="fas fa-edit"></i> Editar Pneu: ${pneu.num_fogo}`;
        document.getElementById('pneuFogo').value = pneu.num_fogo || '';
        document.getElementById('pneuMarca').value = pneu.marca || '';
        document.getElementById('pneuMedida').value = pneu.medida || '';
        document.getElementById('pneuCusto').value = pneu.custo_atual || '';
        document.getElementById('pneuVida').value = pneu.vida || 0;
        document.getElementById('pneuFogo').disabled = true; 
    } else {
        document.getElementById('tituloModalPneu').innerHTML = `<i class="fas fa-plus-circle"></i> Cadastrar Novo Pneu`;
        document.getElementById('pneuFogo').value = '';
        document.getElementById('pneuMarca').value = '';
        document.getElementById('pneuMedida').value = '';
        document.getElementById('pneuCusto').value = '';
        document.getElementById('pneuVida').value = 0;
        document.getElementById('pneuFogo').disabled = false;
    }
    document.getElementById('modalPneuBorracharia').style.display = 'flex';
};

window.fecharModalPneuBorracharia = function() {
    document.getElementById('modalPneuBorracharia').style.display = 'none';
};

window.salvarPneuBorracharia = async function() {
    const id = document.getElementById('pneuId').value;
    const fogo = document.getElementById('pneuFogo').value.trim();
    const marca = document.getElementById('pneuMarca').value.trim();
    const medida = document.getElementById('pneuMedida').value.trim();
    const custo = parseFloat(document.getElementById('pneuCusto').value) || 0;
    const vida = parseInt(document.getElementById('pneuVida').value) || 0;

    if (!fogo) return alert('O Nº de Fogo é obrigatório.');

    let pneuData = { num_fogo: fogo, marca: marca, medida: medida, custo_atual: custo, vida: vida };

    try {
        if (id) {
            const { error } = await window.supabaseClient.from('almoxarifado_pneus').update(pneuData).eq('id', id);
            if (error) throw error;
            alert('Pneu atualizado com sucesso!');
        } else {
            pneuData.status = 'Estoque';
            if (typeof window.injetarFilial === 'function') pneuData = window.injetarFilial(pneuData);
            const { error } = await window.supabaseClient.from('almoxarifado_pneus').insert([pneuData]);
            if (error) throw error;
            alert('Pneu cadastrado com sucesso!');
        }
        fecharModalPneuBorracharia();
        await buscarPneusBorracharia();
        renderizarPneusBorracharia();
        renderizarPainelBorracharia(); 
    } catch (e) {
        console.error("Erro ao salvar pneu", e);
        alert('Erro ao salvar. Verifique se o Nº de Fogo já existe.');
    }
};

window.abrirModalMovPneuBorracharia = function(id) {
    const pneu = window.pneusBorracharia.find(p => p.id === id);
    if (!pneu) return;

    document.getElementById('movPneuId').value = pneu.id;
    document.getElementById('movPneuFogoText').innerText = pneu.num_fogo;
    
    const selectTipo = document.getElementById('movTipo');
    if (pneu.status === 'Estoque') selectTipo.value = 'Instalação';
    else if (pneu.status === 'Rodando') selectTipo.value = 'Retirada';
    else if (pneu.status === 'Recapagem') selectTipo.value = 'Retorno Recapagem';
    
    document.getElementById('movPosicao').value = '';
    document.getElementById('movKm').value = '';
    document.getElementById('movObs').value = '';

    carregarPlacasBorracharia('mov');
    tratarCamposMovPneuBorracharia();

    document.getElementById('modalMovPneuBorracharia').style.display = 'flex';
};

window.fecharModalMovPneuBorracharia = function() {
    document.getElementById('modalMovPneuBorracharia').style.display = 'none';
};

window.tratarCamposMovPneuBorracharia = function() {
    const tipo = document.getElementById('movTipo').value;
    const boxVeiculo = document.getElementById('movCamposVeiculo');
    if (tipo === 'Instalação') {
        boxVeiculo.style.display = 'grid';
    } else {
        boxVeiculo.style.display = 'none';
    }
};

window.salvarMovPneuBorracharia = async function() {
    const pneuId = document.getElementById('movPneuId').value;
    const tipo = document.getElementById('movTipo').value;
    const cavalo = document.getElementById('movCavalo').value;
    const posicao = document.getElementById('movPosicao').value.trim();
    const km = parseInt(document.getElementById('movKm').value) || 0;
    const obs = document.getElementById('movObs').value.trim();

    if (tipo === 'Instalação' && (!cavalo || !posicao)) {
        return alert("Para instalação, informe o veículo e a posição.");
    }

    const pneuAtual = window.pneusBorracharia.find(p => p.id == pneuId);
    let novoStatus = pneuAtual.status;
    let novaVida = pneuAtual.vida;
    let novoCavalo = pneuAtual.cavalo_atual;
    let novaPosicao = pneuAtual.posicao;
    let novoKmInstalacao = pneuAtual.km_instalacao;

    if (tipo === 'Instalação') {
        novoStatus = 'Rodando'; novoCavalo = cavalo; novaPosicao = posicao; novoKmInstalacao = km;
    } else if (tipo === 'Retirada') {
        novoStatus = 'Estoque'; novoCavalo = null; novaPosicao = null;
    } else if (tipo === 'Envio Recapagem') {
        novoStatus = 'Recapagem'; novoCavalo = null; novaPosicao = null;
    } else if (tipo === 'Retorno Recapagem') {
        novoStatus = 'Estoque'; novaVida = novaVida + 1; novoCavalo = null; novaPosicao = null;
    } else if (tipo === 'Descarte') {
        novoStatus = 'Sucata'; novoCavalo = null; novaPosicao = null;
    }

    let movData = {
        pneu_id: pneuId, tipo: tipo, cavalo: (tipo === 'Instalação' ? cavalo : pneuAtual.cavalo_atual),
        km_frota: km, observacao: obs
    };

    let updatePneuData = {
        status: novoStatus, vida: novaVida, cavalo_atual: novoCavalo, posicao: novaPosicao, km_instalacao: novoKmInstalacao
    };

    if (typeof window.injetarFilial === 'function') movData = window.injetarFilial(movData);

    try {
        const resMov = await window.supabaseClient.from('almoxarifado_pneus_mov').insert([movData]);
        if (resMov.error) throw resMov.error;

        const resPneu = await window.supabaseClient.from('almoxarifado_pneus').update(updatePneuData).eq('id', pneuId);
        if (resPneu.error) throw resPneu.error;

        alert('Movimentação registrada com sucesso!');
        fecharModalMovPneuBorracharia();
        await buscarPneusBorracharia();
        renderizarPneusBorracharia();
        renderizarPainelBorracharia();
    } catch (e) {
        console.error("Erro ao registrar movimentação", e);
        alert("Erro de conexão ao salvar.");
    }
};

window.verHistoricoPneuBorracharia = async function(pneuId) {
    const pneu = window.pneusBorracharia.find(p => p.id === pneuId);
    document.getElementById('histPneuFogoText').innerText = pneu ? pneu.num_fogo : '';
    
    const tbody = document.getElementById('tabelaHistoricoMovPneu');
    tbody.innerHTML = '<tr><td colspan="5">Buscando histórico na nuvem...</td></tr>';
    document.getElementById('modalHistoricoMovPneuBorracharia').style.display = 'flex';

    try {
        const { data, error } = await window.supabaseClient.from('almoxarifado_pneus_mov').select('*').eq('pneu_id', pneuId).order('data_mov', { ascending: false });
        if (error) throw error;
        
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhuma movimentação registrada.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(m => {
            const dataF = new Date(m.data_mov).toLocaleDateString('pt-BR') + ' ' + new Date(m.data_mov).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
            return `
                <tr>
                    <td>${dataF}</td>
                    <td style="color: var(--ccol-blue-bright); font-weight: bold;">${m.tipo}</td>
                    <td>${m.cavalo || '-'}</td>
                    <td>${m.km_frota || '-'}</td>
                    <td>${m.observacao || '-'}</td>
                </tr>
            `;
        }).join('');
    } catch(e) {
        tbody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center;">Erro ao buscar dados.</td></tr>';
    }
};

window.fecharModalHistoricoMovBorracharia = function() {
    document.getElementById('modalHistoricoMovPneuBorracharia').style.display = 'none';
};

// ================= LÓGICA DE MODAIS DE IMPRESSÃO (Mantida) =================
window.abrirModalLivroBorracharia = function() {
    const inputMes = document.getElementById('livroMesAno');
    if (inputMes) {
        const agora = new Date();
        inputMes.value = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
    }
    document.getElementById('modalLivroBorracharia').style.display = 'flex';
};
window.fecharModalLivroBorracharia = function() { document.getElementById('modalLivroBorracharia').style.display = 'none'; };