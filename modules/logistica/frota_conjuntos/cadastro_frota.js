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

// Nova Função: Alternar Abas (Lista x Cadastro)
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
        // Reseta o form para garantir que inicie limpo
        document.getElementById('osFrotaCategoria').value = '';
        window.mudouCategoria('', 'osFrota');
    }
};

// Nova Função: Exibir/Ocultar Campos baseado na Categoria
window.mudouCategoria = function(categoria, prefix) {
    const divCavalo = document.getElementById(prefix + 'DivCavalo');
    const divMeta   = document.getElementById(prefix + 'DivMeta');
    const divGo     = document.getElementById(prefix + 'DivGo');
    const divC1     = document.getElementById(prefix + 'DivC1');
    const divC2     = document.getElementById(prefix + 'DivC2');
    const divC3     = document.getElementById(prefix + 'DivC3');

    if(!divMeta) return; // Proteção

    // Mostra o cavalo por padrão
    if (divCavalo) divCavalo.classList.remove('hidden-field');

    // Esconde os adicionais primeiro
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
        // Se for Grua, ESCONDE a placa do cavalo e mostra apenas a frota
        if (divCavalo) divCavalo.classList.add('hidden-field');
        divGo.classList.remove('hidden-field');
    }
    // Para Comboio e Leve, tudo continua escondido
};

function renderizarTabelaCadastroFrota() {
    const container = document.getElementById('containerCategorias');
    if (!container || typeof frotasManutencao === 'undefined') return;
    
    container.innerHTML = '';
    
    if (frotasManutencao.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 20px;">Nenhum conjunto cadastrado.</p>';
        return;
    }

    // Organizando as frotas em grupos (Sessões)
    const categoriasAgrupadas = {
        'TRITREM': [],
        'PRANCHA': [],
        'COMBOIO': [],
        'GRUA': [],
        'Frota Leve': [],
        'Sem Categoria': []
    };

    frotasManutencao.forEach(f => {
        const cat = f.categoria || 'Sem Categoria';
        if (categoriasAgrupadas[cat]) {
            categoriasAgrupadas[cat].push(f);
        } else {
            categoriasAgrupadas['Sem Categoria'].push(f);
        }
    });

    const ordemExibicao = ['TRITREM', 'PRANCHA', 'COMBOIO', 'GRUA', 'Frota Leve', 'Sem Categoria'];

    ordemExibicao.forEach(cat => {
        const lista = categoriasAgrupadas[cat];
        if (lista.length === 0) return; // Não renderiza sessões vazias

        // Cabeçalhos dinâmicos
        let cabecalhoDinamico = '';
        if (cat === 'TRITREM') {
            cabecalhoDinamico = '<th>Nº Frota</th><th>Meta</th><th>Carreta 1</th><th>Carreta 2</th><th>Carreta 3</th>';
        } else if (cat === 'PRANCHA') {
            cabecalhoDinamico = '<th>Nº Frota</th><th>Carreta 1</th>'; 
        } else if (cat === 'GRUA') {
            cabecalhoDinamico = '<th>Nº Frota</th>'; 
        }

        // Se for GRUA, a coluna de Placa Cavalo muda de contexto (pode ficar vazia ou '-' )
        let cabecalhoPlacaCavalo = (cat === 'GRUA') ? '<th>Veículo</th>' : '<th>Placa (Cavalo)</th>';

        let htmlSecao = `
        <div class="cat-section">
            <h3 class="cat-title"><i class="fas fa-list-ul"></i> Categoria: ${cat} <span style="font-size: 0.9rem; margin-left: 10px; color: var(--text-secondary);">(${lista.length} veículos)</span></h3>
            <div class="table-modern-wrapper">
                <table class="data-table-modern">
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th>Data Entrada</th>
                            ${cabecalhoPlacaCavalo}
                            <th>Cor</th>
                            ${cabecalhoDinamico}
                            <th style="text-align: right;">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        lista.forEach(frota => {
            const statusTexto = frota.status || 'Ativo';
            const statusCor = statusTexto === 'Ativo' ? '#22c55e' : '#ef4444';
            const badgeStatus = `<span style="background-color: ${statusCor}20; color: ${statusCor}; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; border: 1px solid ${statusCor}40;">${statusTexto}</span>`;

            let dataFormatada = '01/04/2026';
            if (frota.data_inicial) {
                const partes = frota.data_inicial.split('-');
                if (partes.length === 3) dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
            }

            // Colunas dinâmicas (TDs)
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
                colunasDinamicas = `
                    <td style="font-weight: bold;">${frota.go || '-'}</td>
                `;
            }

            // Exibir a Placa do Cavalo ou "Sem Placa" no caso de GRUA
            let exibirCavalo = frota.cavalo ? frota.cavalo : '<span style="color: #64748b; font-size: 0.8rem;">(Sem Placa)</span>';

            htmlSecao += `
                <tr>
                    <td>${badgeStatus}</td>
                    <td style="color: #94a3b8; font-size: 0.9rem;">${dataFormatada}</td>
                    <td style="color: var(--ccol-blue-bright); font-weight: bold; font-size: 1.1rem;">${exibirCavalo}</td>
                    <td>${frota.cor || '-'}</td>
                    ${colunasDinamicas}
                    <td style="text-align: right; display: flex; gap: 5px; justify-content: flex-end;">
                        ${(cat === 'TRITREM' || cat === 'PRANCHA') ? `<button title="Trocar Composição" class="btn-action-sm" style="background-color: #8b5cf6;" onclick="abrirModalTransferenciaFrota(${frota.id})"><i class="fas fa-exchange-alt"></i></button>` : ''}
                        <button title="Editar" class="btn-action-sm btn-edit" onclick="editarFrotaManutencao(${frota.id})"><i class="fas fa-pen"></i></button>
                        <button title="Excluir" class="btn-action-sm btn-delete" onclick="excluirFrotaManutencao(${frota.id})"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });

        htmlSecao += `</tbody></table></div></div>`;
        container.innerHTML += htmlSecao;
    });
}

window.salvarFrotaManutencao = async function() {
    const categoria = document.getElementById('osFrotaCategoria').value;
    const status = document.getElementById('osFrotaStatus').value;
    const data_inicial = document.getElementById('osFrotaDataInicial').value || '2026-04-01';
    const cor = document.getElementById('osFrotaCor').value.trim();
    
    // Pega o cavalo apenas se não for GRUA
    let cavalo = '';
    if (categoria !== 'GRUA') {
        cavalo = document.getElementById('osFrotaCavalo').value.trim().toUpperCase();
    }
    
    if (!categoria) return alert("Por favor, selecione uma Categoria.");
    if (categoria !== 'GRUA' && !cavalo) return alert("A placa do cavalo/veículo é obrigatória.");

    // Verifica duplicação de cavalo apenas se existir cavalo
    if (cavalo) {
        const existente = frotasManutencao.find(f => f.cavalo === cavalo);
        if (existente) return alert("Já existe um cadastro para esta placa. Use a opção de editar.");
    }

    const metaStr = (categoria === 'TRITREM') ? document.getElementById('osFrotaMeta').value.trim() : null;
    const go = (categoria === 'TRITREM' || categoria === 'PRANCHA' || categoria === 'GRUA') ? document.getElementById('osFrotaGo').value.trim().toUpperCase() : null;
    const carreta1 = (categoria === 'TRITREM' || categoria === 'PRANCHA') ? document.getElementById('osFrotaCarreta1').value.trim().toUpperCase() : null;
    const carreta2 = (categoria === 'TRITREM') ? document.getElementById('osFrotaCarreta2').value.trim().toUpperCase() : null;
    const carreta3 = (categoria === 'TRITREM') ? document.getElementById('osFrotaCarreta3').value.trim().toUpperCase() : null;

    try {
        const payload = window.injetarFilial({ 
            cavalo: cavalo || null, 
            status, data_inicial, cor, categoria, 
            go, carreta1, carreta2, carreta3,
            meta: metaStr ? parseInt(metaStr) : null 
        });
        
        const { error } = await supabaseClient.from('frotas_manutencao').insert([payload]);
        if (error) throw error;

        alert("Veículo/Conjunto cadastrado com sucesso!");
        
        document.querySelectorAll('#abaCadastroFrota input').forEach(inp => inp.value = '');
        document.getElementById('osFrotaStatus').value = 'Ativo';
        document.getElementById('osFrotaCategoria').value = '';
        document.getElementById('osFrotaDataInicial').value = new Date().toISOString().split('T')[0];
        document.getElementById('osFrotaCor').value = '';
        window.mudouCategoria('', 'osFrota');

        await carregarDadosOS();
        window.alternarAbaFrota('lista');
    } catch(err) { alert("Erro ao inserir o novo conjunto."); console.error(err); }
};

window.editarFrotaManutencao = function(id) {
    const frota = frotasManutencao.find(f => f.id === id);
    if (!frota) return;

    document.getElementById('editFrotaId').value = frota.id;
    document.getElementById('editFrotaStatus').value = frota.status || 'Ativo';
    document.getElementById('editFrotaDataInicial').value = frota.data_inicial || '2026-04-01';
    document.getElementById('editFrotaCor').value = frota.cor || '';
    document.getElementById('editFrotaCategoria').value = frota.categoria || '';
    
    // Dispara a lógica de UI
    window.mudouCategoria(frota.categoria || '', 'editFrota');

    // Se não for GRUA, exibe e preenche a placa do cavalo
    if (frota.categoria !== 'GRUA') {
        document.getElementById('editFrotaCavalo').value = frota.cavalo || '';
    } else {
        document.getElementById('editFrotaCavalo').value = '';
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

    let cavalo = '';
    if (categoria !== 'GRUA') {
        cavalo = document.getElementById('editFrotaCavalo').value.trim().toUpperCase();
        if (!cavalo) return alert("A placa do cavalo/veículo é obrigatória.");
    }

    const metaStr = (categoria === 'TRITREM') ? document.getElementById('editFrotaMeta').value.trim() : null;
    const go = (categoria === 'TRITREM' || categoria === 'PRANCHA' || categoria === 'GRUA') ? document.getElementById('editFrotaGo').value.trim().toUpperCase() : null;
    const carreta1 = (categoria === 'TRITREM' || categoria === 'PRANCHA') ? document.getElementById('editFrotaCarreta1').value.trim().toUpperCase() : null;
    const carreta2 = (categoria === 'TRITREM') ? document.getElementById('editFrotaCarreta2').value.trim().toUpperCase() : null;
    const carreta3 = (categoria === 'TRITREM') ? document.getElementById('editFrotaCarreta3').value.trim().toUpperCase() : null;

    try {
        const payload = { 
            cavalo: cavalo || null, 
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
    
    // Lista apenas cavalos que possuem Frota (Tritrem ou Prancha) para transferência
    frotasManutencao.forEach(f => {
        if (f.id !== frotaOrigem.id && (f.categoria === 'TRITREM' || f.categoria === 'PRANCHA')) {
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
    csvContent += "Status;Data Inicial;Categoria;Cavalo;Cor;Meta;Frota;Carreta 1;Carreta 2;Carreta 3\n";
    frotasManutencao.forEach(f => {
        let d = f.data_inicial || '2026-04-01';
        let linha = [f.status||'Ativo', d, f.categoria||'', f.cavalo||'', f.cor||'', f.meta||'', f.go||'', f.carreta1||'', f.carreta2||'', f.carreta3||''].join(";");
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