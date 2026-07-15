let listaColaboradoresReq = [];
let listaPecasReq = [];
let carrinhoRequisicao = [];

window.renderizarRequisicaoMateriais = async function() {
    await carregarDadosIniciaisRequisicao();
}

async function carregarDadosIniciaisRequisicao() {
    if (!window.supabaseClient) return;
    
    try {
        // 1. Carregar Colaboradores Ativos do RH
        let queryColab = window.supabaseClient.from('rh_colaboradores').select('id, nome').eq('status', 'Ativo').order('nome', { ascending: true });
        if (typeof window.aplicarFiltroFilial === 'function') queryColab = window.aplicarFiltroFilial(queryColab);
        const { data: cols } = await queryColab;
        listaColaboradoresReq = cols || [];

        const selColab = document.getElementById('reqColaborador');
        if (selColab) {
            selColab.innerHTML = '<option value="">-- Selecione o Colaborador --</option>';
            listaColaboradoresReq.forEach(c => {
                selColab.innerHTML += `<option value="${c.nome}">${c.nome}</option>`;
            });
        }

        // 2. Carregar Peças do Almoxarifado
        listaPecasReq = await db.getPecas();
        
        // 3. Extrair as categorias que existem atualmente nas peças para preencher o filtro
        const categoriasUnicas = [...new Set(listaPecasReq.map(p => p.categoria).filter(c => c))];
        const selCat = document.getElementById('reqCategoria');
        if (selCat) {
            selCat.innerHTML = '<option value="TODOS">Todas as Categorias</option>';
            categoriasUnicas.sort().forEach(cat => {
                selCat.innerHTML += `<option value="${cat}">${cat}</option>`;
            });
        }

        filtrarPecasRequisicao();
        atualizarTabelaCarrinho();
        
    } catch (e) {
        console.error("Erro ao carregar dados da requisição.", e);
    }
}

window.filtrarPecasRequisicao = function() {
    const selCat = document.getElementById('reqCategoria').value;
    const selPeca = document.getElementById('reqPeca');
    
    let pecasFiltradas = listaPecasReq;
    if (selCat !== 'TODOS') {
        pecasFiltradas = listaPecasReq.filter(p => p.categoria === selCat);
    }

    selPeca.innerHTML = '<option value="">-- Selecione um Produto --</option>';
    pecasFiltradas.forEach(p => {
        selPeca.innerHTML += `<option value="${p.id}">[${p.codigo || 'S/C'}] ${p.nome}</option>`;
    });
    
    document.getElementById('reqEstoqueDisponivel').value = '';
    document.getElementById('reqQuantidade').value = 1;
}

window.atualizarEstoqueDisponivelRequisicao = function() {
    const pecaId = document.getElementById('reqPeca').value;
    if (!pecaId) {
        document.getElementById('reqEstoqueDisponivel').value = '';
        return;
    }
    const peca = listaPecasReq.find(p => p.id == pecaId);
    if (peca) {
        document.getElementById('reqEstoqueDisponivel').value = `${peca.quantidade} ${peca.unidade || 'UN'}`;
    }
}

window.adicionarPecaCarrinho = function() {
    const colabName = document.getElementById('reqColaborador').value;
    const pecaId = document.getElementById('reqPeca').value;
    const qtdStr = document.getElementById('reqQuantidade').value;
    const qtd = parseFloat(qtdStr);

    if (!colabName) { alert("Selecione um Colaborador primeiro."); return; }
    if (!pecaId) { alert("Selecione uma Peça/Produto."); return; }
    if (isNaN(qtd) || qtd <= 0) { alert("Informe uma quantidade válida."); return; }

    const peca = listaPecasReq.find(p => p.id == pecaId);
    
    if (qtd > peca.quantidade) {
        alert(`Atenção: A quantidade solicitada (${qtd}) é maior que o estoque atual (${peca.quantidade}).`);
        return;
    }

    // Verifica se já tem no carrinho, se sim, soma a quantidade
    const indexExistente = carrinhoRequisicao.findIndex(item => item.peca_id == pecaId);
    if (indexExistente >= 0) {
        carrinhoRequisicao[indexExistente].quantidade += qtd;
        if(carrinhoRequisicao[indexExistente].quantidade > peca.quantidade) {
            alert("A soma desse item no seu carrinho ultrapassa o limite de estoque.");
            carrinhoRequisicao[indexExistente].quantidade -= qtd; // reverte
            return;
        }
    } else {
        carrinhoRequisicao.push({
            peca_id: peca.id,
            nome_peca: peca.nome,
            codigo_peca: peca.codigo,
            unidade: peca.unidade || 'UN',
            quantidade: qtd,
            valor_unitario: peca.preco_medio || 0
        });
    }

    document.getElementById('reqQuantidade').value = 1;
    document.getElementById('reqPeca').value = '';
    document.getElementById('reqEstoqueDisponivel').value = '';
    
    atualizarTabelaCarrinho();
}

window.removerDoCarrinho = function(index) {
    carrinhoRequisicao.splice(index, 1);
    atualizarTabelaCarrinho();
}

function atualizarTabelaCarrinho() {
    const tbody = document.getElementById('tbodyCarrinho');
    const btnSubmit = document.getElementById('btnEnviarRequisicao');
    
    tbody.innerHTML = '';
    
    if (carrinhoRequisicao.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3">
                    <div class="empty-cart">
                        <i class="fas fa-box-open"></i><br>
                        Nenhum item adicionado à lista.
                    </div>
                </td>
            </tr>
        `;
        btnSubmit.disabled = true;
        btnSubmit.style.opacity = '0.5';
        return;
    }

    carrinhoRequisicao.forEach((item, idx) => {
        tbody.innerHTML += `
            <tr>
                <td>
                    <strong style="color: #60a5fa;">${item.codigo_peca || '-'}</strong><br>
                    ${item.nome_peca}
                </td>
                <td style="text-align: center; font-weight: bold; color: #34d399;">
                    ${item.quantidade} ${item.unidade}
                </td>
                <td style="text-align: center;">
                    <button class="btn-remove" onclick="removerDoCarrinho(${idx})"><i class="fas fa-times-circle"></i></button>
                </td>
            </tr>
        `;
    });

    btnSubmit.disabled = false;
    btnSubmit.style.opacity = '1';
}

window.enviarRequisicaoFinal = async function() {
    const colabName = document.getElementById('reqColaborador').value;
    if (!colabName) { alert("É obrigatório selecionar um Colaborador."); return; }
    if (carrinhoRequisicao.length === 0) { alert("Carrinho vazio."); return; }

    const btnSubmit = document.getElementById('btnEnviarRequisicao');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

    try {
        const usernameLogado = window.currentUser ? window.currentUser.username : 'Sistema';
        const horaAtual = new Date().toISOString();

        // Monta o array de inserções para a tabela `os_pecas_utilizadas`
        const requisicoesParaInserir = carrinhoRequisicao.map(item => {
            let req = {
                peca_id: item.peca_id,
                quantidade: item.quantidade,
                status: 'Pendente',
                mecanico_responsavel: colabName, 
                centro_custo: 'Requisição Direta - RH', 
                valor_unitario: item.valor_unitario,
                created_at: horaAtual
            };
            if (typeof window.injetarFilial === 'function') req = window.injetarFilial(req);
            return req;
        });

        const { error } = await window.supabaseClient.from('os_pecas_utilizadas').insert(requisicoesParaInserir);
        if (error) throw error;

        alert("Requisição enviada com sucesso ao Almoxarifado!");
        
        carrinhoRequisicao = [];
        atualizarTabelaCarrinho();
        document.getElementById('reqColaborador').value = '';
        
    } catch (e) {
        console.error(e);
        alert("Erro ao enviar a requisição. Tente novamente.");
    } finally {
        btnSubmit.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Solicitação ao Almoxarifado';
        if(carrinhoRequisicao.length > 0) btnSubmit.disabled = false;
    }
}