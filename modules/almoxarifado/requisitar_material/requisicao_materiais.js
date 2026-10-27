let listaColaboradoresReq = [];
let listaPecasReq = [];
let carrinhoRequisicao = [];
let historicoAgrupado = []; // Guarda os pedidos agrupados

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
    await carregarHistoricoRequisicoes();
}

// ====================== ALTERNAR ABAS ======================
window.alternarAbaReq = function(aba) {
    document.getElementById('tabNovaReq').classList.remove('active');
    document.getElementById('tabHistorico').classList.remove('active');
    document.getElementById('abaNovaReq').style.display = 'none';
    document.getElementById('abaHistorico').style.display = 'none';

    if (aba === 'nova') {
        document.getElementById('tabNovaReq').classList.add('active');
        document.getElementById('abaNovaReq').style.display = 'grid'; // Usa grid no layout
    } else {
        document.getElementById('tabHistorico').classList.add('active');
        document.getElementById('abaHistorico').style.display = 'block';
        carregarHistoricoRequisicoes(); // Atualiza ao clicar
    }
}

async function carregarDadosIniciaisRequisicao() {
    if (!window.supabaseClient) return;
    
    try {
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

        listaPecasReq = await db.getPecas();
        
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

// ====================== AUTOCOMPLETE E PESQUISA ======================
window.filtrarPecasRequisicao = function() {
    const selCat = document.getElementById('reqCategoria').value;
    const inputBusca = document.getElementById('reqBuscaPeca').value.toLowerCase().trim();
    const listaResultados = document.getElementById('reqListaResultados');
    
    if (inputBusca === '') {
        document.getElementById('reqPecaId').value = '';
        document.getElementById('reqEstoqueDisponivel').value = '';
    }

    let pecasFiltradas = listaPecasReq;
    
    if (selCat !== 'TODOS') pecasFiltradas = pecasFiltradas.filter(p => p.categoria === selCat);

    if (inputBusca !== '') {
        pecasFiltradas = pecasFiltradas.filter(p => 
            (p.nome && p.nome.toLowerCase().includes(inputBusca)) || 
            (p.codigo && p.codigo.toLowerCase().includes(inputBusca))
        );
    }

    listaResultados.innerHTML = '';
    
    if (pecasFiltradas.length === 0) {
        listaResultados.innerHTML = '<div style="padding: 15px; color:#ef4444; text-align:center;">Nenhum produto encontrado.</div>';
    } else {
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
            
            if (!isSemEstoque) {
                div.onclick = function() { selecionarPecaNaBusca(p); };
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

// ====================== LÓGICA DO CARRINHO ======================
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

    const indexExistente = carrinhoRequisicao.findIndex(item => item.peca_id == pecaId);
    if (indexExistente >= 0) {
        carrinhoRequisicao[indexExistente].quantidade += qtd;
        if(carrinhoRequisicao[indexExistente].quantidade > peca.quantidade) {
            alert("A soma desse item no seu carrinho ultrapassa o limite de estoque disponível.");
            carrinhoRequisicao[indexExistente].quantidade -= qtd;
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
    document.getElementById('reqPecaId').value = '';
    document.getElementById('reqBuscaPeca').value = '';
    document.getElementById('reqEstoqueDisponivel').value = '';
    
    filtrarPecasRequisicao();
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
        tbody.innerHTML = `<tr><td colspan="3"><div class="empty-cart"><i class="fas fa-box-open"></i><br>Nenhum item adicionado à lista.</div></td></tr>`;
        btnSubmit.disabled = true;
        btnSubmit.style.opacity = '0.5';
        return;
    }

    carrinhoRequisicao.forEach((item, idx) => {
        tbody.innerHTML += `
            <tr>
                <td><strong style="color: #60a5fa;">${item.codigo_peca || '-'}</strong><br>${item.nome_peca}</td>
                <td style="text-align: center; font-weight: bold; color: #34d399;">${item.quantidade} ${item.unidade}</td>
                <td style="text-align: center;"><button class="btn-remove" onclick="removerDoCarrinho(${idx})"><i class="fas fa-times-circle"></i></button></td>
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
        // Geramos uma string de data exata para agrupar o "Pedido"
        const horaAtual = new Date().toISOString();

        const requisicoesParaInserir = carrinhoRequisicao.map(item => {
            let req = {
                peca_id: item.peca_id,
                colaborador_nome: colabName,
                usuario_solicitante: usernameLogado,
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

        document.getElementById('modalConfirmacaoReq').style.display = 'flex';
        
        carrinhoRequisicao = [];
        atualizarTabelaCarrinho();
        document.getElementById('reqColaborador').value = '';
        
        await carregarHistoricoRequisicoes(); // Atualiza a aba do histórico por baixo dos panos
        
    } catch (e) {
        console.error(e);
        alert("Erro ao enviar a requisição. Tente novamente.");
    } finally {
        btnSubmit.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Solicitação ao Almoxarifado';
        if(carrinhoRequisicao.length > 0) btnSubmit.disabled = false;
    }
}

// ====================== HISTÓRICO DE REQUISIÇÕES ======================
async function carregarHistoricoRequisicoes() {
    if (!window.supabaseClient) return;
    try {
        let query = window.supabaseClient.from('almoxarifado_requisicoes').select('*').order('created_at', { ascending: false }).limit(300);
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
        
        // --- INÍCIO DA MELHORIA: FILTRO POR PERFIL/ACESSO ---
        const usernameAtual = window.currentUser ? window.currentUser.username : 'Sistema';
        const menusUsuario = window.currentUser && window.currentUser.menus ? window.currentUser.menus : [];
        const perfilUsuario = window.currentUser ? window.currentUser.perfil : '';
        
        // Valida se o usuário logado tem acesso à gestão de estoque (ou é admin/almoxarifado)
        const temAcessoEstoque = menusUsuario.includes('Gestão de Estoque') || 
                                 menusUsuario.includes('Almoxarifado') || 
                                 perfilUsuario === 'Administrador' ||
                                 perfilUsuario === 'Almoxarifado';

        // Se NÃO tem acesso ao almoxarifado, filtra para ver APENAS as próprias requisições
        if (!temAcessoEstoque && window.currentUser) {
            query = query.eq('usuario_solicitante', usernameAtual);
        }
        // --- FIM DA MELHORIA ---

        const { data, error } = await query;
        if (error) throw error;
        
        // Agrupar os itens que foram enviados juntos (mesma data exata e mesmo colaborador)
        const grupos = {};
        data.forEach(req => {
            const chave = req.created_at + '_' + req.colaborador_nome;
            if(!grupos[chave]) {
                grupos[chave] = {
                    data_iso: req.created_at,
                    colaborador: req.colaborador_nome,
                    solicitante: req.usuario_solicitante,
                    itens: [],
                    id_pedido: req.id // O ID do primeiro item do banco serve como "Número do Pedido"
                };
            }
            grupos[chave].itens.push(req);
        });
        
        historicoAgrupado = Object.values(grupos);
        renderizarTabelaHistorico();
        
    } catch(e) {
        console.error("Erro ao buscar histórico", e);
    }
}

function renderizarTabelaHistorico() {
    const tbody = document.getElementById('tbodyHistoricoReq');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (historicoAgrupado.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-cart">Nenhum histórico encontrado na sua filial.</td></tr>';
        return;
    }

    historicoAgrupado.forEach((pedido, index) => {
        const dataFormatada = new Date(pedido.data_iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        // Descobrir o status geral do pedido
        let qtdAprovado = 0, qtdPendente = 0, qtdRecusado = 0;
        pedido.itens.forEach(i => {
            if (i.status === 'Aprovado') qtdAprovado++;
            else if (i.status === 'Recusado') qtdRecusado++;
            else qtdPendente++;
        });

        let statusGeral = '';
        if (qtdPendente > 0 && qtdAprovado === 0 && qtdRecusado === 0) {
            statusGeral = '<span class="badge-status" style="background: rgba(245,158,11,0.2); color:#fbbf24;"><i class="fas fa-clock"></i> Pendente</span>';
        } else if (qtdPendente === 0 && qtdRecusado === 0) {
            statusGeral = '<span class="badge-status" style="background: rgba(16,185,129,0.2); color:#34d399;"><i class="fas fa-check-double"></i> Aprovado</span>';
        } else if (qtdPendente === 0 && qtdAprovado === 0) {
            statusGeral = '<span class="badge-status" style="background: rgba(239,68,68,0.2); color:#f87171;"><i class="fas fa-times"></i> Recusado</span>';
        } else {
            statusGeral = '<span class="badge-status" style="background: rgba(99,102,241,0.2); color:#818cf8;"><i class="fas fa-exclamation-circle"></i> Parcial</span>';
        }

        tbody.innerHTML += `
            <tr>
                <td style="font-weight: bold; color: #38bdf8;">#${pedido.id_pedido}</td>
                <td style="color: #94a3b8;">${dataFormatada}</td>
                <td><strong style="color: #f8fafc;">${pedido.colaborador}</strong><br><span style="font-size: 0.8rem; color: #64748b;">Por: ${pedido.solicitante}</span></td>
                <td style="text-align: center; font-weight: bold; color: #e2e8f0;">${pedido.itens.length}</td>
                <td>${statusGeral}</td>
                <td style="text-align: right;">
                    <button class="btn-view" onclick="abrirDetalhesReqHistorico(${index})"><i class="fas fa-eye"></i> Ver Peças</button>
                </td>
            </tr>
        `;
    });
}

window.abrirDetalhesReqHistorico = function(index) {
    const pedido = historicoAgrupado[index];
    document.getElementById('detalhePedNumero').innerText = `#${pedido.id_pedido}`;
    document.getElementById('detalhePedColab').innerText = pedido.colaborador;

    const tbody = document.getElementById('tbodyDetalhesPedidoReq');
    tbody.innerHTML = '';

    pedido.itens.forEach(reqItem => {
        // Tenta achar o nome da peça no cache atual
        const pecaReal = listaPecasReq.find(p => p.id == reqItem.peca_id);
        const nomeExibicao = pecaReal ? pecaReal.nome : `Peça Excluída ou Não Encontrada (ID: ${reqItem.peca_id})`;
        const codigoExibicao = pecaReal && pecaReal.codigo ? `[${pecaReal.codigo}] ` : '';

        let statusCor = '#fbbf24'; // Pendente
        if(reqItem.status === 'Aprovado') statusCor = '#34d399';
        if(reqItem.status === 'Recusado') statusCor = '#f87171';

        tbody.innerHTML += `
            <tr>
                <td style="color: #e2e8f0;"><strong style="color: #60a5fa;">${codigoExibicao}</strong>${nomeExibicao}</td>
                <td style="text-align: center; font-weight: bold;">${reqItem.quantidade}</td>
                <td style="color: ${statusCor}; font-weight: bold;">${reqItem.status}</td>
            </tr>
        `;
    });

    document.getElementById('modalDetalhesPedidoReq').style.display = 'flex';
}