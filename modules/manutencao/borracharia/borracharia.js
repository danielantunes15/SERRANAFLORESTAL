// ==================== modules/manutencao/borracharia/borracharia.js ====================

window.registrosBorracharia = [];
window.pneusBorracharia = []; 
window.borracheirosList = []; 
window.pneusParaTrocaTemp = []; // Matriz do Carrinho de Trocas M ltiplas

window.initBorracharia = async function() {
    if (typeof carregarDadosOS === 'function') {
        await carregarDadosOS();
    }
    
    const agora = new Date();
    const fusoAjuste = new Date(agora.getTime() - (agora.getTimezoneOffset() * 60000));
    
    if (document.getElementById('calibragemData')) document.getElementById('calibragemData').value = fusoAjuste.toISOString().slice(0, 16);
    if (document.getElementById('trocaData')) document.getElementById('trocaData').value = fusoAjuste.toISOString().slice(0, 16);

    await buscarHistoricoBorracharia();
    await buscarPneusBorracharia();
    await buscarBorracheiros(); // Busca e preenche os selects dos colaboradores
    
    alternarTelaBorracharia('painel');
}

// ======================== BUSCA DE COLABORADORES DO RH ========================
window.buscarBorracheiros = async function() {
    try {
        let query = window.supabaseClient.from('rh_colaboradores')
            .select('nome, funcao')
            .eq('status', 'Ativo')
            .ilike('funcao', '%Borracheiro%') // FILTRO: Traz apenas quem tem "Borracheiro" na fun
            .order('nome', { ascending: true });
            
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
            
        const { data, error } = await query;
        if (error) throw error;
        
        window.borracheirosList = data || [];
        preencherSelectsBorracheiros();
    } catch (error) {
        console.error("Erro ao buscar colaboradores do RH:", error);
    }
}

window.preencherSelectsBorracheiros = function() {
    const selectCalibragem = document.getElementById('calibragemBorracheiro');
    const selectTroca = document.getElementById('trocaBorracheiro');
    
    let options = '<option value="">Selecione o Executante...</option>';
    window.borracheirosList.forEach(b => {
        const funcaoExtra = b.funcao ? ` (${b.funcao})` : '';
        options += `<option value="${b.nome}">${b.nome}${funcaoExtra}</option>`;
    });

    if (selectCalibragem) selectCalibragem.innerHTML = options;
    if (selectTroca) selectTroca.innerHTML = options;
}

// ======================== MUDAN A DE TELAS E ATALHOS ========================
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
        
        // Zera o container e adiciona o 1  pneu por padr
        const container = document.getElementById('containerPneusTroca');
        if (container) {
            container.innerHTML = '';
            adicionarCamposPneuTroca();
        }
    } else if (tela === 'pneus') {
        if (document.getElementById('telaPneusBorracharia')) document.getElementById('telaPneusBorracharia').style.display = 'block';
        renderizarPneusBorracharia();
    }
}

window.irParaCalibragem = async function(placa, categoria) {
    alternarTelaBorracharia('calibragem');
    const selCat = document.getElementById('calibragemCategoria');
    if (selCat) selCat.value = categoria && categoria !== 'N o definida' ? categoria : '';
    await carregarPlacasBorracharia('calibragem');
    const selPlaca = document.getElementById('calibragemPlaca');
    if (selPlaca) selPlaca.value = placa;
}

window.carregarPlacasBorracharia = async function(prefixo) {
    const select = document.getElementById(prefixo + 'Placa');
    if (!select) return;
    const catElem = document.getElementById(prefixo + 'Categoria');
    const categoria = catElem ? catElem.value : 'TODAS';
    
    if (!window.frotasManutencao || window.frotasManutencao.length === 0) {
        if (typeof carregarDadosOS === 'function') await carregarDadosOS();
    }

    let options = '<option value="">Selecione um veiculo...</option>';
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
}

// ======================== L GICA DE CAMPOS DIN MICOS DA TROCA ========================
window.adicionarCamposPneuTroca = function() {
    const container = document.getElementById('containerPneusTroca');
    if (!container) return;

    // Remove do <select> os pneus que j  foram escolhidos nos outros blocos da mesma tela
    const selecionadosAtuais = [];
    const selectsAtuais = container.querySelectorAll('.trocaFogoNovo');
    selectsAtuais.forEach(s => {
        if (s.value) selecionadosAtuais.push(s.value.toString());
    });

    const pneusEstoque = window.pneusBorracharia.filter(p => p.status === 'Estoque' && !selecionadosAtuais.includes(p.id.toString()));
    
    let optionsPneus = '<option value="">Selecione no Estoque...</option>';
    pneusEstoque.forEach(p => {
        optionsPneus += `<option value="${p.id}">Fogo: ${p.num_fogo} | ${p.marca || ''} (${p.medida || ''})</option>`;
    });

    const numItens = container.children.length;

    const div = document.createElement('div');
    div.className = 'pneu-troca-item';
    div.style = "background: rgba(0,0,0,0.2); padding: 20px; border-radius: 8px; border: 1px solid var(--border-dim); display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; position: relative;";

    const btnExcluir = numItens > 0 
        ? `<button onclick="removerCamposPneuTroca(this)" style="position:absolute; top: 10px; right: 10px; background: transparent; border: none; color: #ef4444; font-size: 1.2rem; cursor: pointer;" title="Remover este pneu"><i class="fas fa-times"></i></button>`
        : '';

    div.innerHTML = `
        ${btnExcluir}
        <div class="form-group-dark">
            <label>Posi o no Ve culo</label>
            <input type="text" class="trocaPosicao" placeholder="Ex: 3  Eixo Dir Ext">
        </div>
        <div class="form-group-dark" style="background: rgba(59, 130, 246, 0.1); padding: 10px; border-radius: 8px; border: 1px solid #3b82f6;">
            <label style="color: var(--ccol-blue-bright);"><i class="fas fa-arrow-down"></i> Pneu a Instalar</label>
            <select class="trocaFogoNovo dark-select" onchange="carregarPneusParaTroca()">${optionsPneus}</select>
        </div>
        <div class="form-group-dark" style="background: rgba(239, 68, 68, 0.1); padding: 10px; border-radius: 8px; border: 1px solid #ef4444;">
            <label style="color: #fca5a5;"><i class="fas fa-arrow-up"></i> Fogo Retirado (Opcional)</label>
            <input type="text" class="trocaFogoRetirado" placeholder="Ex: 98765">
        </div>
        <div class="form-group-dark">
            <label>Destino do Retirado</label>
            <select class="trocaDestinoRetirado dark-select">
                <option value="Recapagem">Enviar para Recapagem</option>
                <option value="Vulcaniza o">Enviar para Vulcaniza o</option>
                <option value="Sucata">Descartar (Sucata)</option>
                <option value="Estoque">Voltar para Estoque Interno</option>
            </select>
        </div>
        <div class="form-group-dark" style="grid-column: 1 / -1;">
            <label>Observa es / Motivo</label>
            <input type="text" class="trocaObs" placeholder="Ex: Pneu furado, desgaste natural...">
        </div>
    `;

    container.appendChild(div);
}

window.removerCamposPneuTroca = function(btnElement) {
    btnElement.parentElement.remove();
    carregarPneusParaTroca(); // Atualiza os selects para devolver o pneu removido ao estoque
}

window.carregarPneusParaTroca = function() {
    const container = document.getElementById('containerPneusTroca');
    if (!container) return;

    // Coleta o que j  foi selecionado para n o repetir
    const selecionadosAtuais = [];
    const selects = container.querySelectorAll('.trocaFogoNovo');
    
    selects.forEach(s => {
        if (s.value) selecionadosAtuais.push(s.value.toString());
    });

    const pneusEstoque = window.pneusBorracharia.filter(p => p.status === 'Estoque');
    
    selects.forEach(select => {
        const currentValue = select.value;
        let options = '<option value="">Selecione no Estoque...</option>';
        
        pneusEstoque.forEach(p => {
            // Se o pneu n o estiver em uso em OUTRO select, ou se for o valor DESTE select, exibe a option
            if (!selecionadosAtuais.includes(p.id.toString()) || p.id.toString() === currentValue) {
                options += `<option value="${p.id}">Fogo: ${p.num_fogo} | ${p.marca || ''} (${p.medida || ''})</option>`;
            }
        });

        select.innerHTML = options;
        if(currentValue) select.value = currentValue;
    });
}

// ======================== L GICA DO PAINEL E HIST RICO ========================
window.buscarHistoricoBorracharia = async function() {
    try {
        let query = window.supabaseClient.from('borracharia_registros').select('*').order('data_registro', { ascending: false });
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
        const { data, error } = await query;
        if (error) throw error;
        window.registrosBorracharia = data || [];
    } catch (error) {
        console.error("Erro ao buscar hist rico da borracharia:", error);
    }
}

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
                categoria: f.categoria || 'N o definida', dataUltima: dataUltima, dias: diasEmAtraso
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
                    <td>
                        <button class="btn-primary-green" onclick="irParaCalibragem('${a.placa}', '${a.categoria}')" style="padding: 4px 8px; font-size: 0.8rem;">Calibrar</button>
                    </td>
                </tr>
            `).join('');
        }
    }
}

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
        
        // Adicionado a exibi o do KM da frota no hist rico, caso exista.
        const kmTexto = r.km_frota ? ` (KM: ${r.km_frota})` : '';

        return `
            <tr>
                <td>${dataFormatada}</td>
                <td style="color: var(--ccol-blue-bright); font-weight: bold;">${r.placa}${kmTexto}</td>
                <td style="color: ${corServico}; font-weight: bold; text-transform: uppercase;">${r.tipo_servico}</td>
                <td>${r.posicao || '-'}</td>
                <td>${r.detalhe || '-'}</td>
                <td>${r.borracheiro || r.mecanico || '-'}</td>
                <td>${r.motivo || '-'}</td>
            </tr>`;
    }).join('');
}

// ======================== L GICA DE SALVAMENTO ========================
window.salvarServicoBorracharia = async function(tipo) {
    const usuarioLogado = (window.currentUser && window.currentUser.username) ? window.currentUser.username : 'Sistema';

    // === SALVAR CALIBRAGEM ===
    if (tipo === 'Calibragem') {
        const dataServico = document.getElementById('calibragemData').value;
        const placa = document.getElementById('calibragemPlaca').value;
        const borracheiro = document.getElementById('calibragemBorracheiro').value;
        const posicao = document.getElementById('calibragemPosicao').value.trim();
        const pressao = document.getElementById('calibragemPressao').value;
        const detalhe = pressao ? pressao + ' lbs' : '';
        const motivo = document.getElementById('calibragemObs').value.trim();
        
        if (!dataServico || !placa || !posicao || !pressao || !borracheiro) {
            return alert('Preencha a Data, Placa, Borracheiro, Posi o e Press o.');
        }

        let insertData = { 
            data_registro: new Date(dataServico).toISOString(), 
            placa, tipo_servico: tipo, posicao, detalhe, motivo, 
            mecanico: usuarioLogado, borracheiro 
        };
        
        if (typeof window.injetarFilial === 'function') insertData = window.injetarFilial(insertData);

        try {
            await window.supabaseClient.from('borracharia_registros').insert([insertData]);
            alert('Calibragem registrada com sucesso!');
            
            document.getElementById('calibragemPosicao').value = '';
            document.getElementById('calibragemPressao').value = '';
            document.getElementById('calibragemObs').value = '';
            document.getElementById('calibragemPlaca').value = '';
            
            await buscarHistoricoBorracharia();
            renderizarPainelBorracharia(); 
            alternarTelaBorracharia('historico');
        } catch (error) { alert('Erro ao salvar a calibragem.'); }
        
    }  
    // === SALVAR TROCAS M LTIPLAS ===
    else if (tipo === 'Troca') {
        const dataServico = document.getElementById('trocaData').value;
        const placa = document.getElementById('trocaPlaca').value;
        const borracheiro = document.getElementById('trocaBorracheiro').value;
        const km = parseInt(document.getElementById('trocaKm').value) || 0;
        
        if (!dataServico || !placa || !borracheiro) {
            return alert('Preencha Data, Placa do Ve culo e o Borracheiro/Executor no topo da p gina.');
        }

        const paineisPneus = document.querySelectorAll('.pneu-troca-item');
        if (paineisPneus.length === 0) {
            return alert('Nenhum pneu para trocar. Adicione uma sess o de pneu.');
        }

        const dataISO = new Date(dataServico).toISOString();
        const trocasParaProcessar = [];

        // Valida o e Extra o dos Dados de Cada Bloco
        for (let item of paineisPneus) {
            const posicao = item.querySelector('.trocaPosicao').value.trim();
            const pneuNovoId = item.querySelector('.trocaFogoNovo').value;
            const fogoRetirado = item.querySelector('.trocaFogoRetirado').value.trim();
            const destinoRetirado = item.querySelector('.trocaDestinoRetirado').value;
            const obs = item.querySelector('.trocaObs').value.trim();

            if (!posicao || !pneuNovoId) {
                return alert("Em todos os blocos, a Posi o e o Pneu a Instalar s o obrigat rios.");
            }
            trocasParaProcessar.push({ posicao, pneuNovoId, fogoRetirado, destinoRetirado, obs });
        }

        const selectedIds = trocasParaProcessar.map(t => t.pneuNovoId);
        if (new Set(selectedIds).size !== selectedIds.length) {
            return alert("Voc  selecionou o MESMO pneu no estoque para colocar em posi es diferentes! Verifique os pneus escolhidos.");
        }

        try {
            for (let troca of trocasParaProcessar) {
                const pneuNovoObj = window.pneusBorracharia.find(p => p.id == troca.pneuNovoId);
                const detalheStr = pneuNovoObj ? `Instalou: Fogo ${pneuNovoObj.num_fogo}` : `Troca registrada`;
                
                let insertHistorico = { 
                    data_registro: dataISO, 
                    placa: placa, 
                    tipo_servico: 'Troca', 
                    posicao: troca.posicao, 
                    detalhe: detalheStr, 
                    motivo: troca.obs, 
                    mecanico: usuarioLogado, 
                    borracheiro: borracheiro,
                    km_frota: km
                };
                if (typeof window.injetarFilial === 'function') insertHistorico = window.injetarFilial(insertHistorico);
                
                await window.supabaseClient.from('borracharia_registros').insert([insertHistorico]);

                await window.supabaseClient.from('almoxarifado_pneus').update({
                    status: 'Rodando', cavalo_atual: placa, posicao: troca.posicao, km_instalacao: km
                }).eq('id', troca.pneuNovoId);

                let movNovo = { pneu_id: troca.pneuNovoId, tipo: 'Instala o', cavalo: placa, km_frota: km, observacao: 'Instalado via tela de Troca' };
                if (typeof window.injetarFilial === 'function') movNovo = window.injetarFilial(movNovo);
                await window.supabaseClient.from('almoxarifado_pneus_mov').insert([movNovo]);

                if (troca.fogoRetirado) {
                    const pRetirado = window.pneusBorracharia.find(p => p.num_fogo.toUpperCase() === troca.fogoRetirado.toUpperCase());
                    if (pRetirado) {
                        await window.supabaseClient.from('almoxarifado_pneus').update({
                            status: troca.destinoRetirado, cavalo_atual: null, posicao: null
                        }).eq('id', pRetirado.id);
                        
                        let movRetirado = { pneu_id: pRetirado.id, tipo: 'Retirada', cavalo: placa, observacao: `Retirado na troca. Destino: ${troca.destinoRetirado}` };
                        if (typeof window.injetarFilial === 'function') movRetirado = window.injetarFilial(movRetirado);
                        
                        await window.supabaseClient.from('almoxarifado_pneus_mov').insert([movRetirado]);
                    }
                }
            }
            alert('Troca(s) registrada(s) com sucesso no sistema e no estoque de pneus!');
            
            document.getElementById('trocaPlaca').value = '';
            document.getElementById('trocaBorracheiro').value = '';
            document.getElementById('trocaKm').value = '';
            
            await buscarPneusBorracharia(); 
            await buscarHistoricoBorracharia(); 
            renderizarPainelBorracharia();
            alternarTelaBorracharia('historico');
        } catch (error) {
            console.error(error);
            alert('Erro ao registrar trocas. Verifique a conex o.');
        }
    }
}

// ======================== M DULO: CADASTRO E CONTROLE DE PNEUS ========================
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
}

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
        if (p.status === 'Vulcaniza o') corStatus = '#8b5cf6'; // Cor para Vulcaniza
        
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
                        <button class="btn-secondary-dark" onclick="verHistoricoPneuBorracharia(${p.id})" title="Hist rico" style="padding: 5px 10px; font-size: 0.8rem;"><i class="fas fa-list"></i></button>
                        <button class="btn-primary-green" onclick="abrirModalPneuBorracharia(${p.id})" title="Editar" style="padding: 5px 10px; font-size: 0.8rem;"><i class="fas fa-edit"></i></button>
                    </div>
                </td>
            </tr>`;
    }).join('');
}

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
}

window.fecharModalPneuBorracharia = function() {
    document.getElementById('modalPneuBorracharia').style.display = 'none';
}

window.salvarPneuBorracharia = async function() {
    const id = document.getElementById('pneuId').value;
    const fogo = document.getElementById('pneuFogo').value.trim();
    const marca = document.getElementById('pneuMarca').value.trim();
    const medida = document.getElementById('pneuMedida').value.trim();
    const custo = parseFloat(document.getElementById('pneuCusto').value) || 0;
    const vida = parseInt(document.getElementById('pneuVida').value) || 0;
    
    if (!fogo) return alert('O N  de Fogo   obrigat rio.');

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
        alert('Erro ao salvar. Verifique se o N  de Fogo j  existe.');
    }
}

window.abrirModalMovPneuBorracharia = function(id) {
    const pneu = window.pneusBorracharia.find(p => p.id === id);
    if (!pneu) return;

    document.getElementById('movPneuId').value = pneu.id;
    document.getElementById('movPneuFogoText').innerText = pneu.num_fogo;
    
    const selectTipo = document.getElementById('movTipo');
    if (pneu.status === 'Estoque') selectTipo.value = 'Instala o';
    else if (pneu.status === 'Rodando') selectTipo.value = 'Retirada';
    else if (pneu.status === 'Recapagem') selectTipo.value = 'Retorno Recapagem';
    
    document.getElementById('movPosicao').value = '';
    document.getElementById('movKm').value = '';
    document.getElementById('movObs').value = '';

    carregarPlacasBorracharia('mov');
    tratarCamposMovPneuBorracharia();

    document.getElementById('modalMovPneuBorracharia').style.display = 'flex';
}

window.fecharModalMovPneuBorracharia = function() {
    document.getElementById('modalMovPneuBorracharia').style.display = 'none';
}

window.tratarCamposMovPneuBorracharia = function() {
    const tipo = document.getElementById('movTipo').value;
    const boxVeiculo = document.getElementById('movCamposVeiculo');

    if (tipo === 'Instala o') {
        boxVeiculo.style.display = 'grid';
    } else {
        boxVeiculo.style.display = 'none';
    }
}

window.salvarMovPneuBorracharia = async function() {
    const pneuId = document.getElementById('movPneuId').value;
    const tipo = document.getElementById('movTipo').value;
    const cavalo = document.getElementById('movCavalo').value;
    const posicao = document.getElementById('movPosicao').value.trim();
    const km = parseInt(document.getElementById('movKm').value) || 0;
    const obs = document.getElementById('movObs').value.trim();

    if (tipo === 'Instala o' && (!cavalo || !posicao)) {
        return alert("Para instala o, informe o ve culo e a posi o.");
    }

    const pneuAtual = window.pneusBorracharia.find(p => p.id == pneuId);
    
    let novoStatus = pneuAtual.status;
    let novaVida = pneuAtual.vida;
    let novoCavalo = pneuAtual.cavalo_atual;
    let novaPosicao = pneuAtual.posicao;
    let novoKmInstalacao = pneuAtual.km_instalacao;

    if (tipo === 'Instala o') {
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
        pneu_id: pneuId, tipo: tipo, cavalo: (tipo === 'Instala o' ? cavalo : pneuAtual.cavalo_atual), 
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

        alert('Movimenta o registrada com sucesso!');
        fecharModalMovPneuBorracharia();
        await buscarPneusBorracharia();
        renderizarPneusBorracharia();
        renderizarPainelBorracharia();
    } catch (e) {
        console.error("Erro ao registrar movimenta o", e);
        alert("Erro de conex o ao salvar.");
    }
}

window.verHistoricoPneuBorracharia = async function(pneuId) {
    const pneu = window.pneusBorracharia.find(p => p.id === pneuId);
    document.getElementById('histPneuFogoText').innerText = pneu ? pneu.num_fogo : '';
    
    const tbody = document.getElementById('tabelaHistoricoMovPneu');
    tbody.innerHTML = '<tr><td colspan="5">Buscando hist rico na nuvem...</td></tr>';
    
    document.getElementById('modalHistoricoMovPneuBorracharia').style.display = 'flex';

    try {
        const { data, error } = await window.supabaseClient.from('almoxarifado_pneus_mov').select('*').eq('pneu_id', pneuId).order('data_mov', { ascending: false });
        if (error) throw error;
        
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhuma movimenta o registrada.</td></tr>';
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
}

window.fecharModalHistoricoMovBorracharia = function() {
    document.getElementById('modalHistoricoMovPneuBorracharia').style.display = 'none';
}

// ================= L GICA DE MODAIS DE IMPRESS O =================
window.abrirModalLivroBorracharia = function() {
    const inputMes = document.getElementById('livroMesAno');
    if (inputMes) {
        const agora = new Date();
        inputMes.value = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
    }
    document.getElementById('modalLivroBorracharia').style.display = 'flex';
}
window.fecharModalLivroBorracharia = function() { document.getElementById('modalLivroBorracharia').style.display = 'none'; };