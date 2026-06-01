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

window.alternarAbaFrota = function(aba) {
    document.getElementById('btnAbaLista').classList.remove('active');
    document.getElementById('btnAbaCadastro').classList.remove('active');
    document.getElementById('abaListaFrotas').classList.add('hidden-field');
    document.getElementById('abaCadastroFrota').classList.add('hidden-field');

    if(aba === 'lista') {
        document.getElementById('btnAbaLista').classList.add('active');
        document.getElementById('abaListaFrotas').classList.remove('hidden-field');
        renderizarTabelaCadastroFrota();
    } else {
        document.getElementById('btnAbaCadastro').classList.add('active');
        document.getElementById('abaCadastroFrota').classList.remove('hidden-field');
        document.getElementById('osFrotaCategoria').value = '';
        window.mudouCategoria('', 'osFrota');
    }
};

window.mudouCategoria = function(categoria, prefix) {
    const divCavalo = document.getElementById(prefix + 'DivCavalo');
    const divNumFrota = document.getElementById(prefix + 'DivNumeroFrota');
    const divMeta   = document.getElementById(prefix + 'DivMeta');
    const divGo     = document.getElementById(prefix + 'DivGo');
    const divC1     = document.getElementById(prefix + 'DivC1');
    const divC2     = document.getElementById(prefix + 'DivC2');
    const divC3     = document.getElementById(prefix + 'DivC3');

    // Lógica para controle do campo Status dinâmico
    const statusSelect = document.getElementById(prefix + 'Status');
    if (statusSelect) {
        const currentVal = statusSelect.value;
        let optionsHTML = '<option value="Ativo">Ativo</option><option value="Inativo">Inativo</option>';
        if (categoria === 'TRITREM') {
            optionsHTML += '<option value="Reserva">Reserva</option>';
        }
        statusSelect.innerHTML = optionsHTML;
        
        if (currentVal === 'Reserva' && categoria !== 'TRITREM') {
            statusSelect.value = 'Ativo';
        } else if (currentVal) {
            statusSelect.value = currentVal;
        }
    }

    if(!divMeta) return;

    if (divCavalo) divCavalo.classList.remove('hidden-field');
    if (divNumFrota) divNumFrota.classList.remove('hidden-field');

    divMeta.classList.add('hidden-field');
    divGo.classList.add('hidden-field');
    divC1.classList.add('hidden-field');
    divC2.classList.add('hidden-field');
    divC3.classList.add('hidden-field');

    if (categoria === 'TRITREM') {
        divMeta.classList.remove('hidden-field');
        divGo.classList.remove('hidden-field');
        divC1.classList.remove('hidden-field');
        divC2.classList.remove('hidden-field');
        divC3.classList.remove('hidden-field');
    } else if (categoria === 'PRANCHA') {
        divGo.classList.remove('hidden-field');
        divC1.classList.remove('hidden-field');
    } else if (categoria === 'GRUA') {
        if (divCavalo) divCavalo.classList.add('hidden-field');
        if (divNumFrota) divNumFrota.classList.add('hidden-field');
        divGo.classList.remove('hidden-field');
    } else if (categoria === 'CARRETA') {
        if (divCavalo) divCavalo.classList.add('hidden-field');
        if (divNumFrota) divNumFrota.classList.add('hidden-field');
        divGo.classList.remove('hidden-field');
        divC1.classList.remove('hidden-field');
        divC2.classList.remove('hidden-field');
        divC3.classList.remove('hidden-field');
    }
};

function renderizarTabelaCadastroFrota() {
    const container = document.getElementById('containerCategorias');
    if (!container || typeof frotasManutencao === 'undefined') return;
    
    container.innerHTML = '';
    
    if (frotasManutencao.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 20px;">Nenhum conjunto cadastrado.</p>';
        return;
    }

    let countTritrem = 0, countPrancha = 0, countComboio = 0, countGrua = 0, countCarreta = 0, countLeve = 0, countTotal = 0;

    const categoriasAgrupadas = {
        'TRITREM': [],
        'PRANCHA': [],
        'COMBOIO': [],
        'GRUA': [],
        'CARRETA': [],
        'Frota Leve': [],
        'Sem Categoria': []
    };

    frotasManutencao.forEach(f => {
        const cat = f.categoria || 'Sem Categoria';
        if (categoriasAgrupadas[cat]) categoriasAgrupadas[cat].push(f);
        else categoriasAgrupadas['Sem Categoria'].push(f);

        if (f.status === 'Ativo') {
            countTotal++;
            if (cat === 'TRITREM') countTritrem++;
            else if (cat === 'PRANCHA') countPrancha++;
            else if (cat === 'COMBOIO') countComboio++;
            else if (cat === 'GRUA') countGrua++;
            else if (cat === 'CARRETA') countCarreta++;
            else if (cat === 'Frota Leve') countLeve++;
        }
    });

    if (document.getElementById('resumoTritrem')) {
        document.getElementById('resumoTritrem').innerText = countTritrem;
        document.getElementById('resumoPrancha').innerText = countPrancha;
        document.getElementById('resumoComboio').innerText = countComboio;
        document.getElementById('resumoGrua').innerText = countGrua;
        document.getElementById('resumoCarreta').innerText = countCarreta;
        document.getElementById('resumoLeve').innerText = countLeve;
        document.getElementById('resumoTotal').innerText = countTotal;
    }

    const ordemExibicao = ['TRITREM', 'PRANCHA', 'COMBOIO', 'GRUA', 'CARRETA', 'Frota Leve', 'Sem Categoria'];

    ordemExibicao.forEach(cat => {
        const listaOriginal = categoriasAgrupadas[cat];
        if (listaOriginal.length === 0) return;

        // LÓGICA DE ORDENAÇÃO POR Nº FROTA
        listaOriginal.sort((a, b) => {
            const numA = (a.numero_frota || a.go || a.cavalo || '').toString();
            const numB = (b.numero_frota || b.go || b.cavalo || '').toString();
            return numA.localeCompare(numB, undefined, { numeric: true, sensitivity: 'base' });
        });

        // Separar reservas se for TRITREM
        let listaPrincipal = listaOriginal;
        let listaReserva = [];

        if (cat === 'TRITREM') {
            listaPrincipal = listaOriginal.filter(f => f.status !== 'Reserva');
            listaReserva = listaOriginal.filter(f => f.status === 'Reserva');
        }

        let theadHTML = '';
        if (cat === 'CARRETA') {
            theadHTML = `
                <tr>
                    <th>Status</th>
                    <th>Nº GO (ID)</th>
                    <th>Carreta 1</th>
                    <th>Carreta 2</th>
                    <th>Carreta 3</th>
                    <th style="text-align: right;">Ações</th>
                </tr>
            `;
        } else {
            let cabecalhoDinamico = '';
            if (cat === 'TRITREM') cabecalhoDinamico = '<th>Nº GO</th><th>Meta</th><th>Carreta 1</th><th>Carreta 2</th><th>Carreta 3</th>';
            else if (cat === 'PRANCHA') cabecalhoDinamico = '<th>Nº GO</th><th>Carreta 1</th>'; 
            else if (cat === 'GRUA') cabecalhoDinamico = '<th>Nº GO</th>'; 

            let cabecalhoPlacaCavalo = (cat === 'GRUA') ? '<th>Veículo / ID</th>' : '<th>Placa (Cavalo)</th>';

            theadHTML = `
                <tr>
                    <th>Status</th>
                    <th>Data Entrada</th>
                    <th>Nº Frota</th>
                    ${cabecalhoPlacaCavalo}
                    <th>Descrição</th>
                    <th>Cor</th>
                    ${cabecalhoDinamico}
                    <th style="text-align: right;">Ações</th>
                </tr>
            `;
        }

        let htmlSecao = `
        <div class="cat-section">
            <h3 class="cat-title"><i class="fas fa-list-ul"></i> Categoria: ${cat} <span style="font-size: 0.9rem; margin-left: 10px; color: var(--text-secondary);">(${listaOriginal.length} registros)</span></h3>
            <div class="table-modern-wrapper">
                <table class="data-table-modern">
                    <thead>
                        ${theadHTML}
                    </thead>
                    <tbody>
        `;

        const renderizarLinhaTabela = (frota) => {
            const statusTexto = frota.status || 'Ativo';
            let statusCor = '#22c55e'; // Default Ativo
            if (statusTexto === 'Inativo') statusCor = '#ef4444';
            else if (statusTexto === 'Reserva') statusCor = '#f59e0b';
            
            const badgeStatus = `<span style="background-color: ${statusCor}20; color: ${statusCor}; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; border: 1px solid ${statusCor}40;">${statusTexto}</span>`;

            let dataFormatada = '01/04/2026';
            if (frota.data_inicial) {
                const partes = frota.data_inicial.split('-');
                if (partes.length === 3) dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
            }

            let trHtml = '';

            if (cat === 'CARRETA') {
                trHtml += `
                    <tr>
                        <td>${badgeStatus}</td>
                        <td style="font-weight: bold; color: var(--ccol-blue-bright); font-size: 1.1rem;">${frota.go || '-'}</td>
                        <td>${frota.carreta1 || '-'}</td>
                        <td>${frota.carreta2 || '-'}</td>
                        <td>${frota.carreta3 || '-'}</td>
                        <td style="text-align: right; display: flex; gap: 5px; justify-content: flex-end;">
                            <button title="Engatar em Cavalo" class="btn-action-sm" style="background-color: #8b5cf6;" onclick="abrirModalTransferenciaFrota(${frota.id})"><i class="fas fa-link"></i></button>
                            <button title="Editar" class="btn-action-sm btn-edit" onclick="editarFrotaManutencao(${frota.id})"><i class="fas fa-pen"></i></button>
                            <button title="Excluir" class="btn-action-sm btn-delete" onclick="excluirFrotaManutencao(${frota.id})"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                `;
            } else {
                let colunasDinamicas = '';
                if (cat === 'TRITREM') {
                    colunasDinamicas = `
                        <td style="font-weight: bold;">${frota.go || '-'}</td>
                        <td style="font-weight: bold; color: #fbbf24;">${frota.meta || '-'}</td>
                        <td>${frota.carreta1 || '-'}</td>
                        <td>${frota.carreta2 || '-'}</td>
                        <td>${frota.carreta3 || '-'}</td>
                    `;
                } else if (cat === 'PRANCHA') {
                    colunasDinamicas = `
                        <td style="font-weight: bold;">${frota.go || '-'}</td>
                        <td>${frota.carreta1 || '-'}</td>
                    `;
                } else if (cat === 'GRUA') {
                    colunasDinamicas = `<td style="font-weight: bold;">${frota.go || '-'}</td>`;
                }

                let numeroFrotaExibir = frota.numero_frota ? frota.numero_frota : '-';
                let exibirCavalo = frota.cavalo ? frota.cavalo : '<span style="color: #64748b; font-size: 0.8rem;">(Sem Placa)</span>';
                let descricaoStr = frota.descricao ? frota.descricao : '-';

                trHtml += `
                    <tr>
                        <td>${badgeStatus}</td>
                        <td style="color: #94a3b8; font-size: 0.9rem;">${dataFormatada}</td>
                        <td style="font-weight: bold; color: #e2e8f0;">${numeroFrotaExibir}</td>
                        <td style="color: var(--ccol-blue-bright); font-weight: bold; font-size: 1.1rem;">${exibirCavalo}</td>
                        <td style="font-weight: 500; color: #e2e8f0;">${descricaoStr}</td>
                        <td>${frota.cor || '-'}</td>
                        ${colunasDinamicas}
                        <td style="text-align: right; display: flex; gap: 5px; justify-content: flex-end;">
                            ${(cat === 'TRITREM' || cat === 'PRANCHA') ? `<button title="Gerenciar Composição (Trocar/Desengatar)" class="btn-action-sm" style="background-color: #8b5cf6;" onclick="abrirModalTransferenciaFrota(${frota.id})"><i class="fas fa-exchange-alt"></i></button>` : ''}
                            ${(frota.status === 'Reserva') ? `<button title="Substituir por Ativo" class="btn-action-sm" style="background-color: #f59e0b;" onclick="abrirModalSubstituicaoFrota(${frota.id})"><i class="fas fa-sync-alt"></i></button>` : ''}
                            <button title="Editar" class="btn-action-sm btn-edit" onclick="editarFrotaManutencao(${frota.id})"><i class="fas fa-pen"></i></button>
                            <button title="Excluir" class="btn-action-sm btn-delete" onclick="excluirFrotaManutencao(${frota.id})"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                `;
            }
            return trHtml;
        };

        // Renderiza os principais (Ativos/Inativos)
        listaPrincipal.forEach(frota => {
            htmlSecao += renderizarLinhaTabela(frota);
        });

        // Adiciona o divisor e renderiza os Reservas apenas na categoria TRITREM
        if (cat === 'TRITREM' && listaReserva.length > 0) {
            htmlSecao += `
                <tr>
                    <td colspan="12" style="text-align: center; background: rgba(245, 158, 11, 0.1); color: #f59e0b; font-weight: bold; padding: 15px; border-top: 2px solid rgba(245, 158, 11, 0.3); border-bottom: 2px solid rgba(245, 158, 11, 0.3); font-size: 1.1rem; letter-spacing: 1px;">
                        <i class="fas fa-pause-circle"></i> CONJUNTOS EM RESERVA
                    </td>
                </tr>
            `;
            listaReserva.forEach(frota => {
                htmlSecao += renderizarLinhaTabela(frota);
            });
        }

        htmlSecao += `</tbody></table></div></div>`;
        container.innerHTML += htmlSecao;
    });
}

window.salvarFrotaManutencao = async function() {
    const categoria = document.getElementById('osFrotaCategoria').value;
    const status = document.getElementById('osFrotaStatus').value;
    const data_inicial = document.getElementById('osFrotaDataInicial').value || '2026-04-01';
    const cor = document.getElementById('osFrotaCor').value.trim();
    const descricao = document.getElementById('osFrotaDescricao').value.trim().toUpperCase();
    
    if (!categoria) return alert("Por favor, selecione uma Categoria.");

    const go = (categoria === 'TRITREM' || categoria === 'PRANCHA' || categoria === 'GRUA' || categoria === 'CARRETA') ? document.getElementById('osFrotaGo').value.trim().toUpperCase() : null;

    let cavalo = '';
    let numero_frota = null;
    
    if (categoria !== 'GRUA' && categoria !== 'CARRETA') {
        cavalo = document.getElementById('osFrotaCavalo').value.trim().toUpperCase();
        if (document.getElementById('osFrotaNumeroFrota')) {
            numero_frota = document.getElementById('osFrotaNumeroFrota').value.trim().toUpperCase();
        }
        if (!cavalo) return alert("A placa do cavalo/veículo é obrigatória.");
    } else {
        cavalo = go;
        if (!cavalo) return alert("O Número GO (Nº GO) é obrigatório para cadastrar uma Grua ou Carreta (avulsa).");
    }
    
    if (cavalo) {
        const existente = frotasManutencao.find(f => f.cavalo === cavalo);
        if (existente) return alert("Já existe um cadastro para esta placa/frota. Use a opção de editar.");
    }

    const metaStr = (categoria === 'TRITREM') ? document.getElementById('osFrotaMeta').value.trim() : null;
    const carreta1 = (categoria === 'TRITREM' || categoria === 'PRANCHA' || categoria === 'CARRETA') ? document.getElementById('osFrotaCarreta1').value.trim().toUpperCase() : null;
    const carreta2 = (categoria === 'TRITREM' || categoria === 'CARRETA') ? document.getElementById('osFrotaCarreta2').value.trim().toUpperCase() : null;
    const carreta3 = (categoria === 'TRITREM' || categoria === 'CARRETA') ? document.getElementById('osFrotaCarreta3').value.trim().toUpperCase() : null;

    try {
        let payload = { 
            cavalo: cavalo,
            numero_frota: numero_frota,
            descricao,
            status, data_inicial, cor, categoria, 
            go, carreta1, carreta2, carreta3,
            meta: metaStr ? parseInt(metaStr) : null 
        };
        if (typeof window.injetarFilial === 'function') payload = window.injetarFilial(payload);
        
        const { error } = await supabaseClient.from('frotas_manutencao').insert([payload]);
        if (error) throw error;

        // Mensagem de sucesso atualizada para orientar o usuário
        alert("Registro cadastrado com sucesso! A tela continuará limpa para o próximo cadastro.");
        
        // Limpa o formulário mantendo-o na mesma aba
        document.querySelectorAll('#abaCadastroFrota input').forEach(inp => inp.value = '');
        document.getElementById('osFrotaStatus').value = 'Ativo';
        document.getElementById('osFrotaCategoria').value = '';
        document.getElementById('osFrotaDataInicial').value = new Date().toISOString().split('T')[0];
        document.getElementById('osFrotaCor').value = '';
        window.mudouCategoria('', 'osFrota');

        // Atualiza a tabela silenciosamente para caso ele troque de aba depois
        await carregarDadosOS();
        
    } catch(err) { alert("Erro ao inserir o novo conjunto."); console.error(err); }
};

window.editarFrotaManutencao = function(id) {
    const frota = frotasManutencao.find(f => f.id === id);
    if (!frota) return;

    // É preciso chamar mudouCategoria primeiro para preparar as opções de Status, caso seja TRITREM e tenha Reserva
    document.getElementById('editFrotaCategoria').value = frota.categoria || '';
    window.mudouCategoria(frota.categoria || '', 'editFrota');

    document.getElementById('editFrotaId').value = frota.id;
    document.getElementById('editFrotaStatus').value = frota.status || 'Ativo';
    document.getElementById('editFrotaDataInicial').value = frota.data_inicial || '2026-04-01';
    document.getElementById('editFrotaCor').value = frota.cor || '';
    document.getElementById('editFrotaDescricao').value = frota.descricao || ''; 

    if (frota.categoria !== 'GRUA' && frota.categoria !== 'CARRETA') {
        document.getElementById('editFrotaCavalo').value = frota.cavalo || '';
        document.getElementById('editFrotaNumeroFrota').value = frota.numero_frota || '';
    } else {
        document.getElementById('editFrotaCavalo').value = '';
        if (document.getElementById('editFrotaNumeroFrota')) document.getElementById('editFrotaNumeroFrota').value = '';
    }

    document.getElementById('editFrotaGo').value = frota.go || '';
    document.getElementById('editFrotaMeta').value = frota.meta || '';
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
    const categoria = document.getElementById('editFrotaCategoria').value;
    const status = document.getElementById('editFrotaStatus').value;
    const data_inicial = document.getElementById('editFrotaDataInicial').value || '2026-04-01';
    const cor = document.getElementById('editFrotaCor').value.trim();
    const descricao = document.getElementById('editFrotaDescricao').value.trim().toUpperCase(); 

    const go = (categoria === 'TRITREM' || categoria === 'PRANCHA' || categoria === 'GRUA' || categoria === 'CARRETA') ? document.getElementById('editFrotaGo').value.trim().toUpperCase() : null;

    let cavalo = '';
    let numero_frota = null;
    
    if (categoria !== 'GRUA' && categoria !== 'CARRETA') {
        cavalo = document.getElementById('editFrotaCavalo').value.trim().toUpperCase();
        if (document.getElementById('editFrotaNumeroFrota')) {
            numero_frota = document.getElementById('editFrotaNumeroFrota').value.trim().toUpperCase();
        }
        if (!cavalo) return alert("A placa do cavalo/veículo é obrigatória.");
    } else {
        cavalo = go;
        if (!cavalo) return alert("O Número GO (Nº GO) é obrigatório.");
    }

    const metaStr = (categoria === 'TRITREM') ? document.getElementById('editFrotaMeta').value.trim() : null;
    const carreta1 = (categoria === 'TRITREM' || categoria === 'PRANCHA' || categoria === 'CARRETA') ? document.getElementById('editFrotaCarreta1').value.trim().toUpperCase() : null;
    const carreta2 = (categoria === 'TRITREM' || categoria === 'CARRETA') ? document.getElementById('editFrotaCarreta2').value.trim().toUpperCase() : null;
    const carreta3 = (categoria === 'TRITREM' || categoria === 'CARRETA') ? document.getElementById('editFrotaCarreta3').value.trim().toUpperCase() : null;

    try {
        const payload = { 
            cavalo: cavalo,
            numero_frota: numero_frota,
            descricao, 
            status, data_inicial, cor, categoria, 
            go, carreta1, carreta2, carreta3,
            meta: metaStr ? parseInt(metaStr) : null 
        };

        const { error } = await supabaseClient.from('frotas_manutencao').update(payload).eq('id', id);
        if (error) throw error;
        
        alert("Conjunto atualizado com sucesso!");
        fecharModalEditarFrota();
        await carregarDadosOS();
        renderizarTabelaCadastroFrota();
    } catch(error) { alert("Ocorreu um erro ao tentar salvar as alterações."); }
};

window.excluirFrotaManutencao = async function(id) {
    if (confirm("Excluir definitivamente este registro da frota?")) {
        await supabaseClient.from('frotas_manutencao').delete().eq('id', id);
        await carregarDadosOS();
        renderizarTabelaCadastroFrota();
    }
};

window.abrirModalTransferenciaFrota = function(idOriginal) {
    const frotaOrigem = frotasManutencao.find(f => f.id === idOriginal);
    if (!frotaOrigem) return;
    document.getElementById('transfFrotaOrigemId').value = frotaOrigem.id;
    document.getElementById('transfFrotaOrigemText').innerText = frotaOrigem.cavalo + (frotaOrigem.categoria === 'CARRETA' ? ' (CARRETA AVULSA)' : '');

    const selectDestino = document.getElementById('selectFrotaDestino');
    selectDestino.innerHTML = '<option value="">Selecione o Destino...</option>';
    
    // Opção de Desengatar apenas se tiver cavalo (Tritrem ou Prancha)
    if (frotaOrigem.categoria === 'TRITREM' || frotaOrigem.categoria === 'PRANCHA') {
        selectDestino.innerHTML += `<option value="DESENGATAR" style="color: #ef4444; font-weight: bold;">-- DESENGATAR (Mover p/ Categoria Carreta Avulsa) --</option>`;
    }

    frotasManutencao.forEach(f => {
        if (f.id !== frotaOrigem.id && (f.categoria === 'TRITREM' || f.categoria === 'PRANCHA' || f.categoria === 'CARRETA')) {
            selectDestino.innerHTML += `<option value="${f.id}">${f.cavalo} (${f.categoria})</option>`;
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

    if (!idDestino) return alert("Selecione um destino ou ação.");

    const frotaOrigem = frotasManutencao.find(f => String(f.id) === String(idOrigem));
    if (!frotaOrigem) return;

    // Ação: Desengatar e mandar para a Categoria CARRETA (Avulsa)
    if (idDestino === 'DESENGATAR') {
        if (!frotaOrigem.carreta1 && !frotaOrigem.carreta2 && !frotaOrigem.carreta3) {
            return alert("Este cavalo já não possui carretas para desengatar.");
        }

        const numFrotaOriginal = frotaOrigem.go ? frotaOrigem.go : frotaOrigem.cavalo;
        
        let payloadCarreta = {
            categoria: 'CARRETA',
            cavalo: numFrotaOriginal,
            go: numFrotaOriginal, 
            status: 'Ativo',
            carreta1: frotaOrigem.carreta1,
            carreta2: frotaOrigem.carreta2,
            carreta3: frotaOrigem.carreta3,
            data_inicial: new Date().toISOString().split('T')[0]
        };
        
        if (typeof window.injetarFilial === 'function') payloadCarreta = window.injetarFilial(payloadCarreta);

        try {
            await supabaseClient.from('frotas_manutencao').insert([payloadCarreta]);
            
            // O cavalo original perde as carretas e o Nº GO, já que o conjunto foi desengatado
            await supabaseClient.from('frotas_manutencao').update({
                go: null, carreta1: null, carreta2: null, carreta3: null
            }).eq('id', frotaOrigem.id);

            alert("Carretas desengatadas e enviadas para a aba CARRETAS!");
            fecharModalTransferenciaFrota();
            await carregarDadosOS();
            renderizarTabelaCadastroFrota();
        } catch (e) { alert("Erro ao desengatar frota."); }
        return;
    }

    // Ação: Trocar com outro conjunto/cavalo
    const frotaDestino = frotasManutencao.find(f => String(f.id) === String(idDestino));
    if (!frotaDestino) return;

    try {
        const origGo = frotaOrigem.go;
        const origC1 = frotaOrigem.carreta1;
        const origC2 = frotaOrigem.carreta2;
        const origC3 = frotaOrigem.carreta3;

        const destGo = frotaDestino.go;
        const destC1 = frotaDestino.carreta1;
        const destC2 = frotaDestino.carreta2;
        const destC3 = frotaDestino.carreta3;

        // O Cavalo origem recebe as carretas E o Nº GO do destino
        await supabaseClient.from('frotas_manutencao').update({
            go: destGo, carreta1: destC1, carreta2: destC2, carreta3: destC3
        }).eq('id', frotaOrigem.id);

        // O destino recebe as carretas E o Nº GO da origem
        await supabaseClient.from('frotas_manutencao').update({
            go: origGo, carreta1: origC1, carreta2: origC2, carreta3: origC3
        }).eq('id', frotaDestino.id);

        // Limpeza automática se uma CARRETA avulsa ficou totalmente vazia após a troca
        if (frotaOrigem.categoria === 'CARRETA' && !destC1 && !destC2 && !destC3) {
            await supabaseClient.from('frotas_manutencao').delete().eq('id', frotaOrigem.id);
        } else if (frotaDestino.categoria === 'CARRETA' && !origC1 && !origC2 && !origC3) {
            await supabaseClient.from('frotas_manutencao').delete().eq('id', frotaDestino.id);
        }

        alert("Gerenciamento de composição realizado com sucesso!");
        fecharModalTransferenciaFrota();
        await carregarDadosOS();
        renderizarTabelaCadastroFrota();
    } catch (e) { alert("Erro ao transferir frota."); }
};


// ================== LÓGICA DE SUBSTITUIÇÃO (RESERVA <-> ATIVO) ==================

window.abrirModalSubstituicaoFrota = function(idReserva) {
    const frotaReserva = frotasManutencao.find(f => f.id === idReserva);
    if (!frotaReserva) return;
    
    document.getElementById('substFrotaReservaId').value = frotaReserva.id;
    document.getElementById('substFrotaReservaText').innerText = frotaReserva.cavalo + (frotaReserva.numero_frota ? ` (${frotaReserva.numero_frota})` : '');

    const selectAtivos = document.getElementById('selectFrotaAtivaSubst');
    selectAtivos.innerHTML = '<option value="">Selecione o Veículo Ativo...</option>';
    
    // Popula o select com frotas Ativas da mesma categoria para permitir a troca do cavalo
    frotasManutencao.forEach(f => {
        if (f.id !== frotaReserva.id && f.status === 'Ativo' && f.categoria === frotaReserva.categoria) {
            selectAtivos.innerHTML += `<option value="${f.id}">${f.cavalo} - GO: ${f.go || 'S/GO'}</option>`;
        }
    });

    document.getElementById('modalSubstituicaoFrota').style.display = 'flex';
};

window.fecharModalSubstituicaoFrota = function() {
    document.getElementById('modalSubstituicaoFrota').style.display = 'none';
};

window.confirmarSubstituicaoFrota = async function() {
    const idReserva = document.getElementById('substFrotaReservaId').value;
    const idAtivo = document.getElementById('selectFrotaAtivaSubst').value;

    if (!idAtivo) return alert("Selecione um veículo ativo para substituir.");

    const frotaReserva = frotasManutencao.find(f => String(f.id) === String(idReserva));
    const frotaAtiva = frotasManutencao.find(f => String(f.id) === String(idAtivo));

    if (!frotaReserva || !frotaAtiva) return;

    try {
        // O veículo Reserva apenas assume o status de Ativo (mantém suas próprias carretas e GO intactos)
        await supabaseClient.from('frotas_manutencao').update({
            status: 'Ativo'
        }).eq('id', frotaReserva.id);

        // O veículo Ativo apenas assume o status de Reserva (mantém suas próprias carretas e GO intactos)
        await supabaseClient.from('frotas_manutencao').update({
            status: 'Reserva'
        }).eq('id', frotaAtiva.id);

        alert("Substituição realizada com sucesso! Os veículos inverteram o status e mantiveram suas composições.");
        fecharModalSubstituicaoFrota();
        await carregarDadosOS();
        renderizarTabelaCadastroFrota();
    } catch (e) {
        alert("Erro ao realizar a substituição no banco de dados.");
        console.error(e);
    }
};

window.exportarFrotaManutencaoExcel = function() {
    if (frotasManutencao.length === 0) return alert("Não há dados para exportar.");
    
    let csvContent = "\uFEFF"; 
    csvContent += "Status;Data Inicial;Categoria;Nº Frota;Cavalo;Descrição;Cor;Meta;Nº GO;Carreta 1;Carreta 2;Carreta 3\n";
    frotasManutencao.forEach(f => {
        let d = f.data_inicial || '2026-04-01';
        let linha = [f.status||'Ativo', d, f.categoria||'', f.numero_frota||'', f.cavalo||'', f.descricao||'', f.cor||'', f.meta||'', f.go||'', f.carreta1||'', f.carreta2||'', f.carreta3||''].join(";");
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