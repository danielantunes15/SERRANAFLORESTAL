// ==================== js/almoxarifado.js ====================
let pecasEstoque = [];
let movimentacoesEstoque = [];
let pneusEstoque = [];
let requisicoesEstoque = [];

let abaAtualAlmox = 'estoque';
let itensLoteAtual = [];

window.renderizarAlmoxarifado = async function() {
    await carregarDadosAlmoxarifado();
}

async function carregarDadosAlmoxarifado() {
    try {
        pecasEstoque = await db.getPecas();
        movimentacoesEstoque = await db.getMovimentacoesEstoque();
        
        if (window.supabaseClient) {
            let queryPneus = window.supabaseClient.from('almoxarifado_pneus').select('*').order('created_at', { ascending: false });
            if (typeof window.aplicarFiltroFilial === 'function') queryPneus = window.aplicarFiltroFilial(queryPneus);
            const { data: pneus } = await queryPneus;
            pneusEstoque = pneus || [];
            
            let queryReqs = window.supabaseClient.from('os_pecas_utilizadas').select('*').order('id', { ascending: false }).limit(100);
            if (typeof window.aplicarFiltroFilial === 'function') queryReqs = window.aplicarFiltroFilial(queryReqs);
            const { data: reqs } = await queryReqs;
            requisicoesEstoque = reqs || [];
        }

        classificarCurvaABC(pecasEstoque);
        atualizarTabelaPecas(pecasEstoque);
        atualizarTabelaMovimentacoes(movimentacoesEstoque);
        atualizarTabelaNotas(movimentacoesEstoque);
        atualizarTabelaPneus(pneusEstoque);
        atualizarTabelaRequisicoes(requisicoesEstoque);
        
        atualizarKPIsAlmoxarifado();
        gerarRelatoriosAvancados();
    } catch (e) { console.error("Erro ao carregar almoxarifado", e); }
}

function classificarCurvaABC(lista) {
    let valorTotalEstoque = 0;
    lista.forEach(p => { p.valor_total = p.quantidade * p.preco_medio; valorTotalEstoque += p.valor_total; });
    lista.sort((a, b) => b.valor_total - a.valor_total);

    let somaAcumulada = 0;
    lista.forEach(p => {
        somaAcumulada += p.valor_total;
        let percentual = (somaAcumulada / (valorTotalEstoque || 1)) * 100;
        if (percentual <= 80) p.curva = 'A';
        else if (percentual <= 95) p.curva = 'B';
        else p.curva = 'C';
    });
}

function atualizarTabelaPecas(listaPecas) {
    const tbody = document.getElementById('tabelaPecasBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if(listaPecas.length === 0) { tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhuma peça encontrada.</td></tr>'; return; }

    listaPecas.forEach(peca => {
        const estaBaixo = peca.quantidade <= peca.estoque_minimo;
        const statusHtml = estaBaixo ? `<span class="badge badge-alert"><i class="fas fa-exclamation-circle"></i> Baixo</span>` : `<span class="badge badge-ok"><i class="fas fa-check"></i> Normal</span>`;
        
        let dataValidadeFormatada = '-';
        if(peca.data_validade) {
            const [ano, mes, dia] = peca.data_validade.split('-');
            dataValidadeFormatada = `${dia}/${mes}/${ano}`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-family: monospace; color: #94a3b8;">${peca.codigo || '-'}</td>
            <td><strong style="color: #f8fafc;">${peca.nome}</strong></td>
            <td style="color: #cbd5e1; font-weight: bold;">${peca.unidade || 'UN'}</td>
            <td><span class="badge badge-abc-${peca.curva}">${peca.curva}</span></td>
            <td style="color: #94a3b8;"><i class="fas fa-map-marker-alt" style="font-size:0.8rem;"></i> ${peca.localizacao || '-'}</td>
            <td style="color: #94a3b8;">${dataValidadeFormatada}</td>
            <td style="font-size: 1.1rem; font-weight: bold; ${estaBaixo ? 'color: #f87171;' : 'color: #34d399;'}">${peca.quantidade}</td>
            <td style="color: #94a3b8;">${peca.estoque_minimo}</td>
            <td style="font-weight: 500; color: #f8fafc;">R$ ${parseFloat(peca.preco_medio).toFixed(2).replace('.', ',')}</td>
            <td>${statusHtml}</td>
            <td style="text-align: right; display: flex; gap: 5px; justify-content: flex-end;">
                <button type="button" title="Imprimir Etiqueta" class="btn-action-sm" style="background:#8b5cf6;" onclick='imprimirQRCode(${JSON.stringify(peca)})'><i class="fas fa-qrcode"></i></button>
                <button type="button" title="Editar" class="btn-action-sm btn-edit" onclick='editarPeca(${JSON.stringify(peca)})'><i class="fas fa-pen"></i></button>
                <button type="button" title="Excluir" class="btn-action-sm btn-delete" onclick='deletarPeca(${peca.id})'><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function atualizarTabelaRequisicoes(listaReqs) {
    const tbody = document.getElementById('tabelaRequisicoesBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if(listaReqs.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhuma requisição pendente.</td></tr>'; return; }

    listaReqs.forEach(req => {
        const dataFormatada = req.created_at ? new Date(req.created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-';
        const pecaRef = pecasEstoque.find(p => String(p.id) === String(req.peca_id));
        const nomePeca = pecaRef ? pecaRef.nome : '<span style="color:#f87171; font-style:italic;">Peça Excluída</span>';
        const usuarioReq = req.mecanico_responsavel || 'Usuário';
        const stat = req.status || 'Pendente';
        
        let tituloOrigem = req.centro_custo 
            ? `<strong style="color:#a855f7; font-size:1.05rem;">RM #${req.id}</strong><br><span style="color:#cbd5e1; font-size:0.85rem;"><i class="fas fa-building"></i> ${req.centro_custo}</span>` 
            : `<strong style="color:#60a5fa; font-size:1.05rem;">O.S #${req.os_id}</strong><br><span style="color:#cbd5e1; font-size:0.85rem;"><i class="fas fa-truck"></i> ${req.placa || 'Frota'}</span>`;

        let statusBadge = '', btnAcao = '';
        if (stat === 'Pendente') {
            statusBadge = '<span class="badge" style="background:#f59e0b; color:#fff;"><i class="fas fa-clock"></i> Aguardando</span>';
            btnAcao = `
                <button class="btn-action-sm btn-success" title="Aprovar e Baixar Estoque" onclick="aprovarRequisicao(${req.id})"><i class="fas fa-check"></i></button>
                <button class="btn-action-sm btn-delete" title="Recusar" onclick="recusarRequisicao(${req.id})"><i class="fas fa-times"></i></button>
            `;
        } else if (stat === 'Aprovado') {
            statusBadge = '<span class="badge" style="background:#10b981; color:#fff;"><i class="fas fa-check"></i> Liberada</span>';
            btnAcao = '<span style="color:#94a3b8; font-size:0.8rem;">Processada</span>';
        } else {
            statusBadge = '<span class="badge" style="background:#ef4444; color:#fff;"><i class="fas fa-times"></i> Recusada</span>';
            btnAcao = '<span style="color:#94a3b8; font-size:0.8rem;">Recusada</span>';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color: #94a3b8;">${dataFormatada}</td>
            <td>${tituloOrigem}</td>
            <td><strong style="color:#e2e8f0;">${usuarioReq}</strong></td>
            <td>${nomePeca}</td>
            <td style="font-weight: bold; font-size: 1.1rem; color:#f8fafc;">${req.quantidade}</td>
            <td>${statusBadge}</td>
            <td style="text-align: right; display:flex; gap:5px; justify-content: flex-end;">${btnAcao}</td>
        `;
        tbody.appendChild(tr);
    });
}

function atualizarTabelaNotas(listaMovimentacoes) {
    const tbody = document.getElementById('tabelaNotasBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    // Filtrar apenas entradas e agrupar por NF + Fornecedor
    const entradas = listaMovimentacoes.filter(m => m.tipo === 'entrada' && m.nota_fiscal && m.nota_fiscal !== '-');
    if(entradas.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhuma nota fiscal registrada.</td></tr>'; 
        return; 
    }

    const gruposNotas = {};
    entradas.forEach(mov => {
        const chave = `${mov.nota_fiscal}_${mov.fornecedor}`;
        if (!gruposNotas[chave]) {
            gruposNotas[chave] = {
                data: mov.data_movimentacao,
                nota_fiscal: mov.nota_fiscal,
                fornecedor: mov.fornecedor || 'Desconhecido',
                usuario: mov.usuario || 'Sistema',
                qtd_itens: 0,
                valor_total: 0,
                itens: []
            };
        }
        gruposNotas[chave].qtd_itens += 1;
        gruposNotas[chave].valor_total += (parseFloat(mov.quantidade) * parseFloat(mov.valor_unitario || 0));
        gruposNotas[chave].itens.push(mov);
    });

    const listaAgrupada = Object.values(gruposNotas).sort((a, b) => new Date(b.data) - new Date(a.data));

    listaAgrupada.forEach(nota => {
        const dataFormatada = new Date(nota.data).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color: #94a3b8; font-size: 0.85rem;">${dataFormatada}</td>
            <td style="font-family: monospace; color: #38bdf8; font-weight: bold; font-size: 1.1rem;">${nota.nota_fiscal}</td>
            <td><strong style="color: #f8fafc;">${nota.fornecedor}</strong></td>
            <td style="text-align: center; font-weight: bold; color: #cbd5e1;">${nota.qtd_itens}</td>
            <td style="font-weight: 500; color: #34d399;">R$ ${nota.valor_total.toFixed(2).replace('.', ',')}</td>
            <td style="color: #94a3b8; font-size: 0.85rem;"><i class="fas fa-user"></i> ${nota.usuario}</td>
            <td style="text-align: right;">
                <button type="button" class="btn-action-sm btn-info" onclick='abrirDetalhesNota(${JSON.stringify(nota).replace(/'/g, "&apos;")})'>
                    <i class="fas fa-eye"></i> Ver Peças
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.abrirDetalhesNota = function(nota) {
    document.getElementById('detalheNotaFornecedor').innerText = nota.fornecedor;
    document.getElementById('detalheNotaNF').innerText = nota.nota_fiscal;
    
    const tbody = document.getElementById('tabelaDetalhesNotaBody');
    tbody.innerHTML = '';
    
    nota.itens.forEach(mov => {
        const pecaRef = pecasEstoque.find(p => String(p.id) === String(mov.peca_id));
        const nomePeca = pecaRef ? pecaRef.nome : '<span style="color:#f87171; font-style:italic;">Peça Excluída</span>';
        const subtotal = parseFloat(mov.quantidade) * parseFloat(mov.valor_unitario || 0);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 500; color: #f8fafc;">${nomePeca}</td>
            <td style="font-weight: bold; color: #60a5fa;">${mov.quantidade}</td>
            <td style="color: #cbd5e1;">R$ ${parseFloat(mov.valor_unitario||0).toFixed(2).replace('.', ',')}</td>
            <td style="font-weight: bold; color: #34d399;">R$ ${subtotal.toFixed(2).replace('.', ',')}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('modalDetalhesNota').style.display = 'flex';
}

function atualizarTabelaMovimentacoes(listaMovimentacoes) {
    const tbody = document.getElementById('tabelaMovimentacoesBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if(listaMovimentacoes.length === 0) { tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhum registro de movimentação encontrado.</td></tr>'; return; }

    listaMovimentacoes.forEach(mov => {
        let tipoHtml = '';
        if (mov.tipo === 'entrada') tipoHtml = `<span class="badge badge-in"><i class="fas fa-arrow-down"></i> Entrada</span>`;
        else if (mov.tipo === 'saida') tipoHtml = `<span class="badge badge-out"><i class="fas fa-arrow-up"></i> Saída</span>`;
        else tipoHtml = `<span class="badge" style="background: rgba(100,116,139,0.5); color:#cbd5e1;"><i class="fas fa-balance-scale"></i> Ajuste</span>`;
        
        const dataFormatada = new Date(mov.data_movimentacao).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const pecaRef = pecasEstoque.find(p => String(p.id) === String(mov.peca_id));
        const nomePeca = pecaRef ? pecaRef.nome : '<span style="color:#f87171; font-style:italic;">Peça Excluída</span>';
        const responsavel = mov.usuario || 'Sistema';

        let destinoTxt = '-';
        if (mov.tipo === 'ajuste') destinoTxt = `<span style="color:#cbd5e1;">Motivo: ${mov.observacao || 'S/N'}</span>`;
        else if (mov.tipo === 'entrada') destinoTxt = `Forn: <span style="color:#cbd5e1;">${mov.fornecedor || 'N/A'}</span>`;
        else if (mov.tipo === 'saida') {
            if (mov.setor_destino) destinoTxt = `Setor: <strong style="color:#a855f7;">${mov.setor_destino}</strong>`;
            else if (mov.cavalo) destinoTxt = `Frota: <strong style="color:#f8fafc;">${mov.cavalo}</strong> ${mov.os_id ? `(OS: ${mov.os_id})` : ''}`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color: #94a3b8; font-size: 0.85rem;">${dataFormatada}</td>
            <td style="color: #38bdf8; font-weight: bold; font-size: 0.85rem;"><i class="fas fa-user-circle"></i> ${responsavel}</td>
            <td>${tipoHtml}</td>
            <td style="font-weight: 500; color: #f8fafc;">${nomePeca}</td>
            <td style="font-weight: bold; color: ${mov.tipo === 'entrada' ? '#60a5fa' : (mov.tipo === 'saida' ? '#fbbf24' : '#cbd5e1')};">${mov.quantidade}</td>
            <td style="color: #f8fafc;">R$ ${parseFloat(mov.valor_unitario||0).toFixed(2).replace('.', ',')}</td>
            <td style="font-family: monospace; color: #94a3b8; font-size: 0.85rem;">${mov.nota_fiscal || '-'}</td>
            <td>${destinoTxt}</td>
        `;
        tbody.appendChild(tr);
    });
}

function atualizarTabelaPneus(lista) {
    const tbody = document.getElementById('tabelaPneusBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if(lista.length === 0) { tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhum pneu cadastrado.</td></tr>'; return; }

    lista.forEach(p => {
        let statusCor = p.status === 'Estoque' ? '#34d399' : (p.status === 'Rodando' ? '#60a5fa' : (p.status === 'Sucata' ? '#f87171' : '#fcd34d'));
        let localTxt = p.status === 'Rodando' ? `Frota: <b style="color:#f8fafc;">${p.cavalo_atual}</b>` : '<span style="color:#94a3b8;">No Almoxarifado</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:bold; color:#fff; font-size:1.1rem;">${p.num_fogo}</td>
            <td><strong style="color:#e2e8f0;">${p.marca}</strong> <br><span style="color:#94a3b8; font-size:0.85rem;">${p.medida}</span></td>
            <td><span class="badge" style="border:1px solid ${statusCor}; color:${statusCor}; background:transparent;">${p.status}</span></td>
            <td style="color:#cbd5e1;">${p.vida === 0 ? 'Novo' : p.vida + 'ª Recap'}</td>
            <td style="color:#f8fafc;">R$ ${parseFloat(p.custo_atual||0).toFixed(2).replace('.', ',')}</td>
            <td>${localTxt}</td>
            <td style="color:#94a3b8;">${p.eixo||'-'} / ${p.posicao||'-'}</td>
            <td style="text-align: right; display: flex; gap: 5px; justify-content: flex-end;">
                <button type="button" class="btn-action-sm btn-edit" onclick='editarPneu(${JSON.stringify(p)})'><i class="fas fa-pen"></i></button>
                <button type="button" class="btn-action-sm btn-info" onclick='abrirAcaoPneu(${JSON.stringify(p)})'><i class="fas fa-cog"></i> Ação</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function atualizarKPIsAlmoxarifado() {
    let valorTotal = 0, itensBaixos = 0;
    let abcData = {A: {qtd:0, val:0}, B: {qtd:0, val:0}, C: {qtd:0, val:0}};

    pecasEstoque.forEach(p => {
        valorTotal += p.valor_total;
        if (p.quantidade <= p.estoque_minimo) itensBaixos++;
        if(p.curva) { abcData[p.curva].qtd++; abcData[p.curva].val += p.valor_total; }
    });

    pneusEstoque.forEach(pneu => valorTotal += parseFloat(pneu.custo_atual || 0));

    document.getElementById('kpiTotalItens').innerText = pecasEstoque.length;
    document.getElementById('kpiEstoqueMinimo').innerText = itensBaixos;
    document.getElementById('kpiValorTotal').innerText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal);
    document.getElementById('kpiPneusResumo').innerText = `${pneusEstoque.filter(p => p.status === 'Rodando').length} / ${pneusEstoque.filter(p => p.status === 'Estoque').length}`;

    const pendentes = requisicoesEstoque.filter(r => r.status === 'Pendente' || !r.status).length;
    const badgeReq = document.getElementById('badgeReqPendente');
    if(badgeReq) {
        if(pendentes > 0) { badgeReq.innerText = pendentes; badgeReq.style.display = 'inline-block'; } 
        else { badgeReq.style.display = 'none'; }
    }

    const listaABC = document.getElementById('listaCurvaABC');
    if(listaABC) {
        listaABC.innerHTML = `
            <li style="margin-bottom:12px; display:flex; align-items:center; gap:10px;"><span class="badge badge-abc-A" style="width:35px;justify-content:center;">A</span> <span><b>${abcData.A.qtd} itens</b> = <strong style="color:#fca5a5;">R$ ${abcData.A.val.toFixed(2).replace('.',',')}</strong></span></li>
            <li style="margin-bottom:12px; display:flex; align-items:center; gap:10px;"><span class="badge badge-abc-B" style="width:35px;justify-content:center;">B</span> <span><b>${abcData.B.qtd} itens</b> = <strong style="color:#fcd34d;">R$ ${abcData.B.val.toFixed(2).replace('.',',')}</strong></span></li>
            <li style="display:flex; align-items:center; gap:10px;"><span class="badge badge-abc-C" style="width:35px;justify-content:center;">C</span> <span><b>${abcData.C.qtd} itens</b> = <strong style="color:#6ee7b7;">R$ ${abcData.C.val.toFixed(2).replace('.',',')}</strong></span></li>
        `;
    }
}

function gerarRelatoriosAvancados() {
    let custosFrota = {}, custosSetor = {}, totalEntradasMes = 0, totalSaidasMes = 0;
    const mesAtual = new Date().getMonth(), anoAtual = new Date().getFullYear();

    movimentacoesEstoque.forEach(m => {
        const val = (m.quantidade * m.valor_unitario);
        const dataMov = new Date(m.data_movimentacao);
        const noMesAtual = (dataMov.getMonth() === mesAtual && dataMov.getFullYear() === anoAtual);

        if (m.tipo === 'entrada' && noMesAtual) totalEntradasMes += val;
        if (m.tipo === 'saida') {
            if (noMesAtual) totalSaidasMes += val;

            if (m.setor_destino) { if(!custosSetor[m.setor_destino]) custosSetor[m.setor_destino] = 0; custosSetor[m.setor_destino] += val; } 
            else if (m.cavalo) { if(!custosFrota[m.cavalo]) custosFrota[m.cavalo] = 0; custosFrota[m.cavalo] += val; } 
            else { if(!custosSetor["Oficina Geral"]) custosSetor["Oficina Geral"] = 0; custosSetor["Oficina Geral"] += val; }
        }
    });

    if(document.getElementById('relMesEntrada')) {
        document.getElementById('relMesEntrada').innerText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalEntradasMes);
        document.getElementById('relMesSaida').innerText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalSaidasMes);
    }

    const preencheTabela = (id, objDados) => {
        const tbody = document.getElementById(id);
        if(!tbody) return;
        tbody.innerHTML = '';
        let sortArr = Object.keys(objDados).map(k => ({nome: k, valor: objDados[k]})).sort((a,b) => b.valor - a.valor);
        if(sortArr.length === 0) tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:#94a3b8;">Sem dados.</td></tr>';
        else sortArr.forEach(c => tbody.innerHTML += `<tr><td><strong style="color:#60a5fa;">${c.nome}</strong></td><td style="color:#f8fafc; font-weight:bold;">R$ ${c.valor.toFixed(2).replace('.',',')}</td></tr>`);
    };

    preencheTabela('tabelaCustoFrota', custosFrota);
    preencheTabela('tabelaCustoSetor', custosSetor);
}

window.filtrarAlmoxarifado = function() {
    const termo = document.getElementById('almoSearchInput').value.toLowerCase();
    if (abaAtualAlmox === 'estoque') atualizarTabelaPecas(pecasEstoque.filter(p => (p.nome||'').toLowerCase().includes(termo) || (p.codigo||'').toLowerCase().includes(termo)));
    else if (abaAtualAlmox === 'notas') atualizarTabelaNotas(movimentacoesEstoque.filter(m => (m.nota_fiscal||'').toLowerCase().includes(termo) || (m.fornecedor||'').toLowerCase().includes(termo)));
    else if (abaAtualAlmox === 'movimentacoes') atualizarTabelaMovimentacoes(movimentacoesEstoque.filter(m => (m.nota_fiscal||'').toLowerCase().includes(termo) || (m.fornecedor||'').toLowerCase().includes(termo) || (m.cavalo||'').toLowerCase().includes(termo) || (m.setor_destino||'').toLowerCase().includes(termo)));
    else if (abaAtualAlmox === 'pneus') atualizarTabelaPneus(pneusEstoque.filter(p => (p.num_fogo||'').toLowerCase().includes(termo) || (p.cavalo_atual||'').toLowerCase().includes(termo)));
    else if (abaAtualAlmox === 'requisicoes') atualizarTabelaRequisicoes(requisicoesEstoque.filter(r => (r.placa||'').toLowerCase().includes(termo) || (r.mecanico_responsavel||'').toLowerCase().includes(termo) || (r.centro_custo||'').toLowerCase().includes(termo)));
}

window.mudarAbaAlmoxarifado = function(abaId, btn) {
    abaAtualAlmox = abaId;
    document.querySelectorAll('.almo-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['estoque','requisicoes','notas','movimentacoes','pneus','relatorios'].forEach(id => document.getElementById('aba'+id.charAt(0).toUpperCase() + id.slice(1)).style.display = (id === abaId ? 'block' : 'none'));
    filtrarAlmoxarifado();
}

window.carregarCentrosCustoAlmox = async function() {
    const selectCC = document.getElementById('movCentroCusto');
    if (!selectCC || !window.supabaseClient) return;
    selectCC.innerHTML = '<option value="">Carregando...</option>';
    try {
        let query = window.supabaseClient.from('centro_custo').select('id, nome, codigo').eq('status', 'Ativo');
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
        const { data } = await query;
        if (data && data.length > 0) { selectCC.innerHTML = '<option value="" disabled selected>-- Selecione o Centro de Custo --</option>' + data.map(cc => `<option value="${cc.nome}">[${cc.codigo}] ${cc.nome}</option>`).join(''); } 
        else { selectCC.innerHTML = '<option value="" disabled>Nenhum Centro Cadastrado nesta Filial</option>'; }
    } catch (e) { selectCC.innerHTML = '<option value="" disabled>Erro ao carregar</option>'; }
}

window.toggleTipoSaida = function() {
    const tipo = document.getElementById('movTipoSaida').value;
    if (tipo === 'frota') {
        document.getElementById('camposFrotaSaida').style.display = 'flex'; document.getElementById('camposSetorSaida').style.display = 'none';
        document.getElementById('movOS').required = true; document.getElementById('movCentroCusto').required = false; document.getElementById('movCentroCusto').value = '';
    } else {
        document.getElementById('camposFrotaSaida').style.display = 'none'; document.getElementById('camposSetorSaida').style.display = 'block';
        document.getElementById('movOS').required = false; document.getElementById('movCentroCusto').required = true; document.getElementById('movCavalo').value = ''; document.getElementById('movOS').value = '';
    }
}

// ================= LÓGICA DE APROVAÇÃO INTELIGENTE =================
window.aprovarRequisicao = async function(reqId) {
    const req = requisicoesEstoque.find(r => r.id == reqId);
    if(!req) { alert("Requisição não encontrada no sistema."); return; }
    const peca = pecasEstoque.find(p => p.id == req.peca_id);
    if (!peca || peca.quantidade < req.quantidade) { alert(`Estoque insuficiente! Você possui apenas ${peca ? peca.quantidade : 0} unidade(s).`); return; }
    
    if(!confirm(`Confirma a liberação de ${req.quantidade} unidades de "${peca.nome}"?`)) return;

    try {
        await window.supabaseClient.from('os_pecas_utilizadas').update({ status: 'Aprovado' }).eq('id', reqId);
        
        // Define para onde o custo vai (Frota ou Centro de Custo) dependendo de onde a solicitação veio
        let novaMovimentacao = {
            peca_id: req.peca_id, 
            tipo: 'saida', 
            quantidade: req.quantidade, 
            valor_unitario: req.valor_unitario || peca.preco_medio,
            usuario: window.currentUser ? window.currentUser.username : 'Sistema', 
            data_movimentacao: new Date().toISOString()
        };

        if (req.centro_custo) {
            novaMovimentacao.setor_destino = req.centro_custo;
            novaMovimentacao.nota_fiscal = `RM #${req.id}`;
        } else {
            novaMovimentacao.cavalo = req.placa || 'Oficina';
            novaMovimentacao.os_id = req.os_id;
            novaMovimentacao.nota_fiscal = `Requisição Oficina`;
        }

        await db.addMovimentacao(novaMovimentacao);
        alert("Requisição Aprovada com sucesso! Custo direcionado.");
        await carregarDadosAlmoxarifado();
    } catch (e) { alert("Erro ao aprovar requisição. Tente novamente."); console.error(e); }
}

window.recusarRequisicao = async function(reqId) {
    if(!confirm("Deseja RECUSAR esta peça? O solicitante será notificado.")) return;
    try { await window.supabaseClient.from('os_pecas_utilizadas').update({ status: 'Recusado' }).eq('id', reqId); await carregarDadosAlmoxarifado(); } 
    catch(e) { alert("Erro ao recusar."); }
}
// ===================================================================

window.prepararModalMovimentacao = function(tipo) {
    document.getElementById('formMovimentacao').reset();
    document.getElementById('movTipo').value = tipo;
    
    document.getElementById('divEntradaNF').style.display = 'none';
    document.getElementById('divSaidaOS').style.display = 'none';
    document.getElementById('divAjusteEstoque').style.display = 'none';

    ['movNF','movFornecedor','movPecaId','movQuantidade','movCentroCusto','movOS','ajustePecaId','ajusteQtdReal','ajusteMotivo'].forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).required = false;
    });
    
    const titulo = document.getElementById('modalMovTitulo');
    const btnSubmit = document.getElementById('btnConfirmaMov');
    
    if(tipo === 'entrada') {
        titulo.innerHTML = '<i class="fas fa-arrow-down" style="color: #60a5fa;"></i> Lançar Entrada de Peça (NF)';
        btnSubmit.className = 'btn-modern btn-primary';
        document.getElementById('divEntradaNF').style.display = 'block';
        itensLoteAtual = []; renderizarItensLoteNF();
        document.getElementById('movNF').required = true; document.getElementById('movFornecedor').required = true;
    } else if(tipo === 'saida') {
        titulo.innerHTML = '<i class="fas fa-arrow-up" style="color: #fbbf24;"></i> Registrar Saída do Estoque';
        btnSubmit.className = 'btn-modern btn-warning';
        document.getElementById('divSaidaOS').style.display = 'block';
        
        document.getElementById('movTipoSaida').value = 'frota';
        window.carregarCentrosCustoAlmox(); 
        toggleTipoSaida();

        document.getElementById('movPecaId').required = true; document.getElementById('movQuantidade').required = true;
        preencherSelectPecas('movPecaId');
        
        const inputOS = document.getElementById('movOS');
        if (inputOS) {
            inputOS.onchange = async function() {
                const osId = inputOS.value.trim();
                const cavaloInput = document.getElementById('movCavalo');
                if (!osId) { cavaloInput.value = ''; return; }
                
                cavaloInput.value = "Buscando Placa...";
                try {
                    const { data } = await window.supabaseClient.from('ordens_servico').select('placa').eq('id', osId).maybeSingle();
                    if (data && data.placa) {
                        cavaloInput.value = data.placa;
                        cavaloInput.style.color = '#10b981'; setTimeout(() => { cavaloInput.style.color = '#fff'; }, 2000);
                    } else { cavaloInput.value = "OS NÃO ENCONTRADA"; }
                } catch (e) { cavaloInput.value = "ERRO AO BUSCAR"; }
            };
        }
    } else if(tipo === 'ajuste') {
        titulo.innerHTML = '<i class="fas fa-balance-scale" style="color: #94a3b8;"></i> Ajuste de Balanço Físico';
        btnSubmit.className = 'btn-modern btn-dark';
        document.getElementById('divAjusteEstoque').style.display = 'block';
        
        document.getElementById('ajustePecaId').required = true; document.getElementById('ajusteQtdReal').required = true; document.getElementById('ajusteMotivo').required = true;
        preencherSelectPecas('ajustePecaId'); document.getElementById('ajusteQtdAtual').value = '';
    }

    document.getElementById('modalMovimentacao').style.display = 'flex';
}

function preencherSelectPecas(idElemento) {
    const select = document.getElementById(idElemento);
    select.innerHTML = '<option value="">-- Selecione uma peça --</option>';
    pecasEstoque.forEach(p => select.innerHTML += `<option value="${p.id}">${p.codigo ? p.codigo+' - ' : ''}${p.nome} (Qtd: ${p.quantidade} ${p.unidade||'UN'})</option>`);
    if(idElemento === 'movPecaId') select.onchange = function() { const p = pecasEstoque.find(x => x.id == this.value); if(p) document.getElementById('movValor').value = p.preco_medio; };
}

window.carregarEstoqueAtualAjuste = function() {
    const p = pecasEstoque.find(x => x.id == document.getElementById('ajustePecaId').value);
    document.getElementById('ajusteQtdAtual').value = p ? p.quantidade : '';
}

window.salvarMovimentacao = async function(e) {
    e.preventDefault();
    const tipo = document.getElementById('movTipo').value;
    const btnSubmit = document.getElementById('btnConfirmaMov');
    if(btnSubmit) { btnSubmit.disabled = true; btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...'; }

    try {
        if (tipo === 'entrada') {
            if(itensLoteAtual.length === 0) { alert("Adicione produtos na nota."); throw new Error("Sem itens"); }
            const nf = document.getElementById('movNF').value, fornecedor = document.getElementById('movFornecedor').value;
            const itensComAuditoria = itensLoteAtual.map(i => ({...i, usuario: window.currentUser ? window.currentUser.username : 'Sistema'}));
            await db.processarEntradaLote(itensComAuditoria, nf, fornecedor);
            alert("Entrada registrada!");
            
        } else if (tipo === 'saida') {
            const peca_id = document.getElementById('movPecaId').value;
            const qtd = parseFloat(document.getElementById('movQuantidade').value);
            const peca = pecasEstoque.find(p => p.id == peca_id);
            if (!peca || qtd > peca.quantidade) { alert(`Estoque insuficiente! Você tem: ${peca ? peca.quantidade : 0}.`); throw new Error("Estoque baixo"); }

            const tipoSaidaDestino = document.getElementById('movTipoSaida').value;
            let cavaloVal = null, setorVal = null, osVal = null;

            if (tipoSaidaDestino === 'frota') {
                osVal = document.getElementById('movOS').value;
                cavaloVal = document.getElementById('movCavalo').value.toUpperCase();
                if(!cavaloVal || cavaloVal === "OS NÃO ENCONTRADA") { alert("Atenção: Você precisa informar uma OS válida para puxar a placa."); throw new Error("Sem placa"); }
            } else {
                setorVal = document.getElementById('movCentroCusto').value;
            }

            await db.addMovimentacao({
                peca_id: peca_id, tipo: 'saida', quantidade: qtd, valor_unitario: parseFloat(document.getElementById('movValor').value) || 0,
                cavalo: cavaloVal, setor_destino: setorVal, os_id: osVal, usuario: window.currentUser ? window.currentUser.username : 'Sistema',
                data_movimentacao: new Date().toISOString()
            });
            alert("Saída registrada!");
            
        } else if (tipo === 'ajuste') {
            const peca_id = document.getElementById('ajustePecaId').value, qtdReal = parseFloat(document.getElementById('ajusteQtdReal').value);
            const peca = pecasEstoque.find(p => p.id == peca_id);
            const diferenca = qtdReal - peca.quantidade;
            if(diferenca === 0) { alert("Quantidade física igual ao sistema."); throw new Error("Sem diferenca"); }
            
            await db.addMovimentacao({
                peca_id: peca_id, tipo: 'ajuste', quantidade: diferenca, valor_unitario: peca.preco_medio,
                nota_fiscal: 'Ajuste Físico', observacao: document.getElementById('ajusteMotivo').value,
                usuario: window.currentUser ? window.currentUser.username : 'Sistema', data_movimentacao: new Date().toISOString()
            });
            peca.quantidade = qtdReal; await db.upsertPeca(peca);
            alert("Estoque ajustado!");
        }

        fecharModalAlmox('modalMovimentacao'); await carregarDadosAlmoxarifado();
    } catch (error) { console.error(error); } 
    finally { if(btnSubmit) { btnSubmit.disabled = false; btnSubmit.innerHTML = '<i class="fas fa-check"></i> Salvar Lançamento'; } }
}

window.processarArquivoNF = async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById('movNF').value = "Lendo arquivo...";
    itensLoteAtual = [];

    // ==========================================
    // 1. LEITURA PERFEITA VIA XML (RECOMENDADO)
    // ==========================================
    if (file.name.toLowerCase().endsWith('.xml')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const xmlDoc = new DOMParser().parseFromString(e.target.result, "text/xml");
                
                document.getElementById('movNF').value = xmlDoc.getElementsByTagName('nNF')[0]?.textContent || '';
                document.getElementById('movFornecedor').value = xmlDoc.getElementsByTagName('emit')[0]?.getElementsByTagName('xNome')[0]?.textContent || '';
                
                const itensXML = xmlDoc.getElementsByTagName('det');
                for (let i = 0; i < itensXML.length; i++) {
                    const prod = itensXML[i].getElementsByTagName('prod')[0];
                    const imposto = itensXML[i].getElementsByTagName('imposto')[0];
                    if(!prod) continue;

                    // Dados Básicos
                    const qtd = parseFloat(prod.getElementsByTagName('qCom')[0]?.textContent || '0');
                    const vUnCom = parseFloat(prod.getElementsByTagName('vUnCom')[0]?.textContent || '0');
                    const vProd = parseFloat(prod.getElementsByTagName('vProd')[0]?.textContent || '0');

                    // Captura de Impostos e Custos (Se existirem na nota)
                    const vFrete = parseFloat(prod.getElementsByTagName('vFrete')[0]?.textContent || '0');
                    const vDesc = parseFloat(prod.getElementsByTagName('vDesc')[0]?.textContent || '0');
                    const vIPI = parseFloat(imposto?.getElementsByTagName('vIPI')[0]?.textContent || '0');
                    const vST = parseFloat(imposto?.getElementsByTagName('vICMSST')[0]?.textContent || '0');

                    // Cálculo do Custo Real (Rateio direto no item)
                    const custoTotalItem = vProd + vIPI + vST + vFrete - vDesc;
                    const custoUnitarioReal = qtd > 0 ? (custoTotalItem / qtd) : vUnCom;

                    itensLoteAtual.push({
                        id_local: Date.now() + i,
                        codigo: prod.getElementsByTagName('cProd')[0]?.textContent || '',
                        nome: prod.getElementsByTagName('xProd')[0]?.textContent || 'Desconhecido',
                        unidade: prod.getElementsByTagName('uCom')[0]?.textContent || 'UN',
                        quantidade: qtd.toFixed(2),
                        valor_unitario: custoUnitarioReal.toFixed(2), // Preço com impostos
                        data_validade: '',
                        estoque_minimo: 2
                    });
                }
                
                renderizarItensLoteNF();
                alert(`Leitura Concluída! Custo real calculado com sucesso.`);
            } catch (err) { 
                alert("Erro ao processar a estrutura do XML."); 
                document.getElementById('movNF').value = ""; 
            }
        };
        reader.readAsText(file);

    // ==========================================
    // 2. LEITURA DE CONTINGÊNCIA VIA PDF
    // ==========================================
    } else if (file.name.toLowerCase().endsWith('.pdf')) {
        try {
            // Utiliza o pdf.js já linkado no seu index.html
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await window.pdfjsLib.getDocument({data: arrayBuffer}).promise;
            
            let fullText = "";
            // Extrai o texto de todas as páginas
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(" ");
                fullText += pageText + " ";
            }

            // Remove caracteres especiais como " | " que sujam a leitura
            const cleanText = fullText.replace(/\|/g, ' ').replace(/\s+/g, ' ');

            // 1. Extrair Fornecedor (Múltiplas tentativas de captura)
            let fornecedor = "Fornecedor Desconhecido";
            const fornecedorMatch1 = cleanText.match(/Recebemos de\s+(.+?)\s+os produtos/i);
            const fornecedorMatch2 = cleanText.match(/^(.+?)\s+DANFE/i);
            
            if (fornecedorMatch1) {
                fornecedor = fornecedorMatch1[1].trim();
            } else if (fornecedorMatch2) {
                fornecedor = fornecedorMatch2[1].trim();
            }
            document.getElementById('movFornecedor').value = fornecedor;

            // 2. Extrair Número da NF
            const nfMatch = cleanText.match(/N[ºo]?\s*([\d\.\s]{4,20})/i);
            if (nfMatch) {
                // Remove os pontos e espaços em branco (ex: 000.006.033 -> 000006033)
                let numeroNF = nfMatch[1].replace(/[\.\s]/g, '');
                // Se puxar coisas a mais, pega só os primeiros 9 digitos
                if (numeroNF.length > 9) numeroNF = numeroNF.substring(0, 9);
                document.getElementById('movNF').value = numeroNF;
            } else {
                document.getElementById('movNF').value = "PDF Importado";
            }

            // 3. Extrair Itens da Nota
            // ATENÇÃO: Adicionado limitador {1,150}? para a descrição não engolir a nota toda!
            const regexItens = /(\d{4,12})\s+(.{1,150}?)\s+(\d{8})\s+(\d{3,4})\s+(\d{4})\s+([A-Z]{2,3})\s+([\d,\.]+)\s+([\d,\.]+)/gi;
            
            let match;
            let index = 0;
            while ((match = regexItens.exec(cleanText)) !== null) {
                const codigo = match[1];
                const nome = match[2].trim();
                const unidade = match[6];
                
                // Converte padrão brasileiro (1.099,00) para numérico (1099.00)
                const qtdStr = match[7].replace(/\./g, '').replace(',', '.');
                const valorUnitStr = match[8].replace(/\./g, '').replace(',', '.');

                itensLoteAtual.push({
                    id_local: Date.now() + index,
                    codigo: codigo,
                    nome: nome,
                    unidade: unidade,
                    quantidade: parseFloat(qtdStr).toFixed(2),
                    valor_unitario: parseFloat(valorUnitStr).toFixed(2), // No PDF é difícil atrelar o IPI exato da linha
                    data_validade: '',
                    estoque_minimo: 2
                });
                index++;
            }

            if (itensLoteAtual.length > 0) {
                renderizarItensLoteNF();
                alert(`PDF lido com sucesso! Fornecedor, NF e itens extraídos. \nAtenção: A leitura de PDF não calcula impostos com a precisão do XML.`);
            } else {
                alert("Não foi possível identificar os produtos neste layout de PDF. Solicite o XML ao fornecedor.");
            }

        } catch (err) {
            console.error("Erro na leitura do PDF:", err);
            alert("Erro ao processar o PDF. O arquivo pode estar corrompido ou ser uma imagem escaneada.");
        }

    } else { 
        alert("Formato não suportado. Por favor, envie um arquivo .XML (Recomendado) ou .PDF."); 
    }
}

window.renderizarItensLoteNF = function() {
    const tbody = document.getElementById('tabelaLoteNFBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if(itensLoteAtual.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 15px; color: #94a3b8;">Nenhum item na nota.</td></tr>'; return; }
    
    itensLoteAtual.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" class="input-table-sm" value="${item.codigo}" onchange="itensLoteAtual[${index}].codigo=this.value"></td>
            <td><input type="text" class="input-table-sm" value="${item.nome}" onchange="itensLoteAtual[${index}].nome=this.value" required></td>
            <td><input type="text" class="input-table-sm" style="text-align: center;" value="${item.unidade || 'UN'}" onchange="itensLoteAtual[${index}].unidade=this.value"></td>
            <td><input type="number" step="0.01" class="input-table-sm" value="${item.quantidade}" onchange="itensLoteAtual[${index}].quantidade=this.value" required></td>
            <td><input type="number" step="0.01" class="input-table-sm" value="${item.valor_unitario}" onchange="itensLoteAtual[${index}].valor_unitario=this.value" required></td>
            <td><input type="date" class="input-table-sm" value="${item.data_validade || ''}" onchange="itensLoteAtual[${index}].data_validade=this.value"></td>
            <td style="text-align: center;"><button type="button" class="btn-action-sm btn-delete" onclick="itensLoteAtual.splice(${index},1); renderizarItensLoteNF()"><i class="fas fa-trash"></i></button></td>
        `; tbody.appendChild(tr);
    });
}

window.adicionarLinhaLoteNF = function() { itensLoteAtual.push({ id_local: Date.now(), codigo: '', nome: '', unidade: 'UN', quantidade: 1, valor_unitario: 0, data_validade: '', estoque_minimo: 2 }); renderizarItensLoteNF(); }

window.abrirModalPeca = function() {
    document.getElementById('formPeca').reset();
    document.getElementById('pecaId').value = '';
    document.getElementById('pecaValidade').value = '';
    document.getElementById('modalPecaTitulo').innerText = 'Nova Peça';
    document.getElementById('modalPeca').style.display = 'flex';
}

window.editarPeca = function(peca) {
    document.getElementById('pecaId').value = peca.id;
    document.getElementById('pecaCodigo').value = peca.codigo;
    document.getElementById('pecaNome').value = peca.nome;
    document.getElementById('pecaUnidade').value = peca.unidade || 'UN';
    document.getElementById('pecaLocalizacao').value = peca.localizacao || '';
    document.getElementById('pecaQtd').value = peca.quantidade;
    document.getElementById('pecaEstoqueMin').value = peca.estoque_minimo;
    document.getElementById('pecaPreco').value = peca.preco_medio;
    document.getElementById('pecaValidade').value = peca.data_validade || '';
    document.getElementById('modalPecaTitulo').innerText = 'Editar Peça';
    document.getElementById('modalPeca').style.display = 'flex';
}

window.salvarPeca = async function(e) {
    e.preventDefault();
    
    const pecaInput = {
        codigo: document.getElementById('pecaCodigo').value.trim(),
        nome: document.getElementById('pecaNome').value.trim(),
        unidade: document.getElementById('pecaUnidade').value.trim().toUpperCase(),
        localizacao: document.getElementById('pecaLocalizacao').value.trim(),
        quantidade: parseFloat(document.getElementById('pecaQtd').value),
        estoque_minimo: parseFloat(document.getElementById('pecaEstoqueMin').value),
        preco_medio: parseFloat(document.getElementById('pecaPreco').value),
        data_validade: document.getElementById('pecaValidade').value || null
    };
    
    const id = document.getElementById('pecaId').value;
    const btnSubmit = e.target.querySelector('button[type="submit"]');
    if(btnSubmit) { btnSubmit.disabled = true; btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...'; }

    try {
        if (id) {
            // Se tem ID, é edição, apenas salva
            pecaInput.id = id;
            await db.upsertPeca(pecaInput);
        } else {
            // Nova peça, busca no banco se já existe CÓDIGO igual E PREÇO igual
            const pecaExistente = pecasEstoque.find(p => 
                p.codigo && 
                p.codigo.toUpperCase() === pecaInput.codigo.toUpperCase() && 
                parseFloat(p.preco_medio || 0).toFixed(2) === pecaInput.preco_medio.toFixed(2)
            );

            if (pecaExistente && pecaInput.codigo !== "") {
                // Se existe com mesmo preço, apenas SOMA as quantidades
                pecaExistente.quantidade = parseFloat(pecaExistente.quantidade) + pecaInput.quantidade;
                if (pecaInput.data_validade) pecaExistente.data_validade = pecaInput.data_validade; // Sobrescreve validade se fornecida
                
                await db.upsertPeca(pecaExistente);
                alert(`O Código/SKU/CA já existia com o mesmo valor! A quantidade (${pecaInput.quantidade}) foi somada ao estoque existente.`);
            } else {
                // Se for preço diferente ou código novo, cria item separado
                await db.upsertPeca(pecaInput);
            }
        }

        fecharModalAlmox('modalPeca');
        await carregarDadosAlmoxarifado();
    } catch (err) { 
        console.error(err);
        alert("Erro ao gravar peça."); 
    } finally {
        if(btnSubmit) { btnSubmit.disabled = false; btnSubmit.innerHTML = '<i class="fas fa-save"></i> Gravar Peça'; }
    }
}

window.deletarPeca = async function(id) {
    if (confirm("Excluir esta peça pode afetar o histórico. Continuar?")) {
        await db.deletePeca(id);
        await carregarDadosAlmoxarifado();
    }
}

window.abrirModalPneu = function() { document.getElementById('formPneu').reset(); document.getElementById('pneuId').value = ''; document.getElementById('modalPneu').style.display = 'flex'; }
window.editarPneu = function(pneu) {
    document.getElementById('pneuId').value = pneu.id;
    document.getElementById('pnFogo').value = pneu.num_fogo;
    document.getElementById('pnMarca').value = pneu.marca;
    document.getElementById('pnMedida').value = pneu.medida;
    document.getElementById('pnVida').value = pneu.vida;
    document.getElementById('pnCusto').value = pneu.custo_atual;
    document.getElementById('modalPneu').style.display = 'flex';
}
window.salvarPneu = async function(e) {
    e.preventDefault();
    let pneu = {
        num_fogo: document.getElementById('pnFogo').value.trim(),
        marca: document.getElementById('pnMarca').value.trim(),
        medida: document.getElementById('pnMedida').value.trim(),
        vida: parseInt(document.getElementById('pnVida').value),
        custo_atual: parseFloat(document.getElementById('pnCusto').value) || 0,
        status: 'Estoque'
    };
    const id = document.getElementById('pneuId').value;
    if(id) pneu.id = id;
    if (typeof window.injetarFilial === 'function') pneu = window.injetarFilial(pneu);

    try {
        await window.supabaseClient.from('almoxarifado_pneus').upsert(pneu);
        fecharModalAlmox('modalPneu');
        await carregarDadosAlmoxarifado();
        alert("Sucesso!");
    } catch(err) { alert("Erro"); }
}

window.abrirAcaoPneu = function(pneu) {
    document.getElementById('formAcaoPneu').reset();
    document.getElementById('acaoPneuId').value = pneu.id;
    document.getElementById('acaoPneuFogo').innerText = pneu.num_fogo;
    mudarFormAcaoPneu();
    document.getElementById('modalAcaoPneu').style.display = 'flex';
}
window.mudarFormAcaoPneu = function() {
    const acao = document.getElementById('acaoPneuTipo').value;
    document.getElementById('divAcaoInstalar').style.display = acao === 'instalar' ? 'block' : 'none';
    document.getElementById('divAcaoCusto').style.display = acao === 'recapagem' ? 'block' : 'none';
    ['acaoCavalo','acaoKm','acaoEixo','acaoPosicao'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.required = (acao === 'instalar');
    });
}
window.executarAcaoPneu = async function(e) {
    e.preventDefault();
    const pneuId = document.getElementById('acaoPneuId').value, acao = document.getElementById('acaoPneuTipo').value;
    let updPneu = {}, hist = { pneu_id: pneuId, tipo: acao, observacao: document.getElementById('acaoObs').value };
    
    if(acao === 'instalar') {
        updPneu = { status: 'Rodando', cavalo_atual: document.getElementById('acaoCavalo').value.toUpperCase(), eixo: document.getElementById('acaoEixo').value, posicao: document.getElementById('acaoPosicao').value, km_instalacao: parseInt(document.getElementById('acaoKm').value) };
        hist.cavalo = updPneu.cavalo_atual; hist.km_frota = updPneu.km_instalacao;
    } else if(acao === 'retirar') {
        updPneu = { status: 'Estoque', cavalo_atual: null, eixo: null, posicao: null };
    } else if(acao === 'recapagem') {
        updPneu = { status: 'Recapagem', cavalo_atual: null, eixo: null, posicao: null };
        const pneuVelho = pneusEstoque.find(p => p.id == pneuId);
        if(parseFloat(document.getElementById('acaoCustoExtra').value) > 0) updPneu.custo_atual = parseFloat(pneuVelho.custo_atual || 0) + parseFloat(document.getElementById('acaoCustoExtra').value);
    } else if(acao === 'sucata') {
        updPneu = { status: 'Sucata', cavalo_atual: null, eixo: null, posicao: null };
    }

    if (typeof window.injetarFilial === 'function') hist = window.injetarFilial(hist);

    try {
        await window.supabaseClient.from('almoxarifado_pneus').update(updPneu).eq('id', pneuId);
        await window.supabaseClient.from('almoxarifado_pneus_mov').insert(hist);
        fecharModalAlmox('modalAcaoPneu'); await carregarDadosAlmoxarifado(); alert("Sucesso!");
    } catch(err) { alert("Erro"); }
}

window.fecharModalAlmox = function(id) { document.getElementById(id).style.display = 'none'; }

window.imprimirQRCode = function(peca) {
    if (!peca.codigo) { alert("Sem código!"); return; }
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(peca.codigo)}`;
    const win = window.open('', '_blank', 'width=400,height=500');
    win.document.write(`<html><head><title>Etiqueta QR Code - ${peca.codigo}</title><style>body { font-family: sans-serif; text-align: center; } .etiqueta { border: 2px dashed #000; padding: 20px; display: inline-block; width: 250px; border-radius: 8px; } .titulo { font-size: 16px; font-weight: bold; margin-bottom: 15px; } .codigo { font-size: 22px; margin: 10px 0; font-family: monospace; font-weight: bold; } </style></head><body><div class="etiqueta"><div class="titulo">${peca.nome}</div><img src="${qrUrl}" alt="QR Code" style="border: 1px solid #ccc; padding: 5px; border-radius: 5px;"><div class="codigo">${peca.codigo}</div><div class="local">📍 Local: ${peca.localizacao || 'S/N'}</div></div><script>setTimeout(() => { window.print(); window.close(); }, 500);</script></body></html>`);
    win.document.close();
}