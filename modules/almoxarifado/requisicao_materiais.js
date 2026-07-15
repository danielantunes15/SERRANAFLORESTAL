let listaColaboradoresReq = [];
let listaPecasReq = [];
let carrinhoRequisicao = [];

// Esconde o Autocomplete Inteligente se clicar fora dele
document.addEventListener('click', function(e) {
    const wrapper = document.querySelector('.autocomplete-wrapper');
    const lista = document.getElementById('reqListaResultados');
    if (wrapper && lista && !wrapper.contains(e.target)) {
        lista.style.display = 'none';
    }
});

window.renderizarRequisicaoMateriais = async function() {
    await carregarDadosIniciaisRequisicao();
}

async function carregarDadosIniciaisRequisicao() {
    if (!window.supabaseClient) return;
    
    try {
        // 1. Carregar Colaboradores Ativos da tabela de RH
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
        
        // 3. Extrair as categorias para o filtro
        const categoriasUnicas = [...new Set(listaPecasReq.map(p => p.categoria).filter(c => c))];
        const selCat = document.getElementById('reqCategoria');
        if (selCat) {
            selCat.innerHTML = '<option value="TODOS">Todas as Categorias</option>';
            categoriasUnicas.sort().forEach(cat => {
                selCat.innerHTML += `<option value="${cat}">${cat}</option>`;
            });
        }

        atualizarTabelaCarrinho();
        
    } catch (e) {
        console.error("Erro ao carregar dados da requisição.", e);
    }
}

// ====================== MÁGICA DO AUTOCOMPLETE E PESQUISA ======================
window.filtrarPecasRequisicao = function() {
    const selCat = document.getElementById('reqCategoria').value;
    const inputBusca = document.getElementById('reqBuscaPeca').value.toLowerCase().trim();
    const listaResultados = document.getElementById('reqListaResultados');
    
    // Se o usuário limpar o campo, deselecionamos o ID oculto e limpamos o "Estoque Disponível"
    if (inputBusca === '') {
        document.getElementById('reqPecaId').value = '';
        document.getElementById('reqEstoqueDisponivel').value = '';
    }

    let pecasFiltradas = listaPecasReq;
    
    if (selCat !== 'TODOS') {
        pecasFiltradas = pecasFiltradas.filter(p => p.categoria === selCat);
    }

    if (inputBusca !== '') {
        pecasFiltradas = pecasFiltradas.filter(p => 
            (p.nome && p.nome.toLowerCase().includes(inputBusca)) || 
            (p.codigo && p.codigo.toLowerCase().includes(inputBusca))
        );
    }

    // Renderiza a lista flutuante
    listaResultados.innerHTML = '';
    
    if (pecasFiltradas.length === 0) {
        listaResultados.innerHTML = '<div style="padding: 15px; color:#ef4444; text-align:center;">Nenhum produto encontrado.</div>';
    } else {
        // Ordena os itens para que os COM ESTOQUE apareçam primeiro
        pecasFiltradas.sort((a, b) => b.quantidade - a.quantidade);

        pecasFiltradas.forEach(p => {
            const isSemEstoque = p.quantidade <= 0;
            const className = isSemEstoque ? 'autocomplete-item disabled' : 'autocomplete-item';
            
            const div = document.createElement('div');
            div.className = className;
            div.innerHTML = `
                <div>
                    <strong style="color: #60a5fa;">[${p.codigo || 'S/C'}]</strong> ${p.nome}
                </div>
                <div style="font-size: 0.85rem; font-weight: bold; padding-left: 15px; text-align: right;">
                    ${p.quantidade} ${p.unidade || 'UN'}<br>
                    ${isSemEstoque ? '<span style="color:#ef4444;">Esgotado</span>' : '<span style="color:#34d399;">Em Estoque</span>'}
                </div>
            `;
            
            // Só permite clicar se tiver estoque
            if (!isSemEstoque) {
                div.onclick = function() {
                    selecionarPecaNaBusca(p);
                };
            }
            
            listaResultados.appendChild(div);
        });
    }
    
    listaResultados.style.display = 'block';
}

window.selecionarPecaNaBusca = function(peca) {
    document.getElementById('reqPecaId').value = peca.id;
    document.getElementById('reqBuscaPeca').value = `[${peca.codigo || 'S/C'}] ${peca.nome}`;
    document.getElementById('reqEstoqueDisponivel').value = `${peca.quantidade} ${peca.unidade || 'UN'}`;
    document.getElementById('reqListaResultados').style.display = 'none';
}

window.adicionarPecaCarrinho = function() {
    const colabName = document.getElementById('reqColaborador').value;
    const pecaId = document.getElementById('reqPecaId').value;
    const qtdStr = document.getElementById('reqQuantidade').value;
    const qtd = parseFloat(qtdStr);

    if (!colabName) { alert("Selecione um Colaborador primeiro."); return; }
    if (!pecaId) { alert("Por favor, busque e clique em uma Peça/Produto da lista."); return; }
    if (isNaN(qtd) || qtd <= 0) { alert("Informe uma quantidade válida."); return; }

    const peca = listaPecasReq.find(p => p.id == pecaId);
    
    if (qtd > peca.quantidade) {
        alert(`Atenção: A quantidade solicitada (${qtd}) é maior que o estoque atual (${peca.quantidade}).`);
        return;
    }

    // Verifica se já tem no carrinho
    const indexExistente = carrinhoRequisicao.findIndex(item => item.peca_id == pecaId);
    if (indexExistente >= 0) {
        carrinhoRequisicao[indexExistente].quantidade += qtd;
        if(carrinhoRequisicao[indexExistente].quantidade > peca.quantidade) {
            alert("A soma desse item no seu carrinho ultrapassa o limite de estoque disponível físico.");
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

    // Reseta inputs após adicionar
    document.getElementById('reqQuantidade').value = 1;
    document.getElementById('reqPecaId').value = '';
    document.getElementById('reqBuscaPeca').value = '';
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

        // Insere na NOVA tabela almoxarifado_requisicoes
        const requisicoesParaInserir = carrinhoRequisicao.map(item => {
            let req = {
                peca_id: item.peca_id,
                colaborador_nome: colabName,            // Quem recebe
                usuario_solicitante: usernameLogado,    // Quem pediu no sistema
                quantidade: item.quantidade,
                valor_unitario: item.valor_unitario,
                status: 'Pendente',
                created_at: horaAtual
            };
            if (typeof window.injetarFilial === 'function') req = window.injetarFilial(req);
            return req;
        });

        const { error } = await window.supabaseClient.from('almoxarifado_requisicoes').insert(requisicoesParaInserir);
        if (error) throw error;

        // Exibe o modal de confirmação
        document.getElementById('modalConfirmacaoReq').style.display = 'flex';
        
        // Limpa o carrinho
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