// ==================== modules/almoxarifado/gestao_estoque/almoxarifado.js ====================
let pecasEstoque = [];
let movimentacoesEstoque = [];
let pneusEstoque = [];
let kitsEstoque = [];

let abaAtualAlmox = 'estoque';
let itensLoteAtual = [];
let itensKitAtual = [];
let carrinhoSaidaAtual = [];
let modoAjusteAtual = 'individual';
let contextoCameraAtual = 'busca'; // 'busca' | 'saida' | 'os'

// Paginação
let paginaAtualEstoque = 1;
const itensPorPaginaEstoque = 15;
let listaPecasAtual = [];

let paginaAtualNotas = 1;
const itensPorPaginaNotas = 15;
let listaNotasAtual = [];

let paginaAtualMov = 1;
const itensPorPaginaMov = 20;
let listaMovAtual = [];

// ==================== HELPERS DE NOTIFICAÇÃO (SWEETALERT2 COM FALLBACK) ====================
function almoNotify(title, text, icon = 'success') {
    if (typeof Swal !== 'undefined') {
        return Swal.fire({ title, text, icon, background: '#1e293b', color: '#f8fafc', confirmButtonColor: '#3b82f6' });
    }
    alert(`${title}${text ? '\n' + text : ''}`);
    return Promise.resolve();
}

async function almoConfirm(title, text) {
    if (typeof Swal !== 'undefined') {
        const res = await Swal.fire({
            title, text, icon: 'warning', showCancelButton: true,
            confirmButtonColor: '#ef4444', cancelButtonColor: '#64748b',
            confirmButtonText: 'Sim, confirmar', cancelButtonText: 'Cancelar',
            background: '#1e293b', color: '#f8fafc'
        });
        return res.isConfirmed;
    }
    return confirm(`${title}\n${text}`);
}

function calcularStatusValidade(dataStr) {
    if (!dataStr) return { tipo: 'sem', html: '-', dias: null };
    const [ano, mes, dia] = dataStr.split('-').map(Number);
    const dataVal = new Date(ano, mes - 1, dia);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const diffDias = Math.ceil((dataVal - hoje) / (1000 * 60 * 60 * 24));
    const formatada = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;

    if (diffDias < 0) {
        return { tipo: 'vencido', dias: diffDias, html: `<span class="badge badge-alert" title="Vencido há ${Math.abs(diffDias)} dias"><i class="fas fa-times-circle"></i> ${formatada}</span>` };
    } else if (diffDias <= 30) {
        return { tipo: 'vencer30', dias: diffDias, html: `<span class="badge badge-warn" title="Vence em ${diffDias} dias"><i class="fas fa-clock"></i> ${formatada}</span>` };
    }
    return { tipo: 'ok', dias: diffDias, html: `<span style="color:#94a3b8;">${formatada}</span>` };
}

function calcularCurvaABCLista(lista) {
    let valorTotalGlobal = 0;
    const processados = lista.map(p => {
        const qtd = parseFloat(p.quantidade) || 0;
        const preco = parseFloat(p.preco_medio) || 0;
        const valTotal = qtd * preco;
        valorTotalGlobal += valTotal;
        return { ...p, valor_total: valTotal, quantidade_numerica: qtd };
    });

    processados.sort((a, b) => b.valor_total - a.valor_total);

    let somaAcumulada = 0;
    processados.forEach(p => {
        somaAcumulada += p.valor_total;
        const perc = (somaAcumulada / (valorTotalGlobal || 1)) * 100;
        p.curva = perc <= 80 ? 'A' : (perc <= 95 ? 'B' : 'C');
    });

    return processados;
}

// ==================== INICIALIZAÇÃO ====================
window.renderizarAlmoxarifado = async function() {
    await carregarDadosAlmoxarifado();
};

async function carregarDadosAlmoxarifado() {
    try {
        const pecasRaw = await db.getPecas();
        pecasEstoque = calcularCurvaABCLista(pecasRaw || []);
        movimentacoesEstoque = await db.getMovimentacoesEstoque() || [];
        
        if (window.supabaseClient) {
            let queryPneus = window.supabaseClient.from('almoxarifado_pneus').select('*').order('created_at', { ascending: false });
            if (typeof window.aplicarFiltroFilial === 'function') queryPneus = window.aplicarFiltroFilial(queryPneus);
            const { data: pneus } = await queryPneus;
            pneusEstoque = pneus || [];
            
            let queryKits = window.supabaseClient.from('almoxarifado_kits').select('*').order('created_at', { ascending: false });
            if (typeof window.aplicarFiltroFilial === 'function') queryKits = window.aplicarFiltroFilial(queryKits);
            const { data: kits } = await queryKits;
            kitsEstoque = kits || [];
        }

        popularFiltrosEstoque();
        atualizarKPIsAlmoxarifado();
        filtrarAlmoxarifado();
        atualizarTabelaSugestaoCompras();
    } catch (e) {
        console.error("Erro ao carregar almoxarifado", e);
    }
}

function popularFiltrosEstoque() {
    const selCat = document.getElementById('filtroEstCategoria');
    const selLoc = document.getElementById('filtroEstLocalizacao');
    if (selCat) {
        const valAtual = selCat.value;
        const cats = [...new Set(pecasEstoque.map(p => p.categoria).filter(Boolean))].sort();
        selCat.innerHTML = '<option value="">Todas Categorias</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
        selCat.value = valAtual;
    }
    if (selLoc) {
        const valAtual = selLoc.value;
        const locs = [...new Set(pecasEstoque.map(p => p.localizacao).filter(Boolean))].sort();
        selLoc.innerHTML = '<option value="">Todas Localizações</option>' + locs.map(l => `<option value="${l}">${l}</option>`).join('');
        selLoc.value = valAtual;
    }
}

async function preencherSelectsCadastrosBasicos() {
    if (!window.supabaseClient) return;
    try {
        let query = window.supabaseClient.from('almoxarifado_cadastros').select('*');
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
        const { data } = await query;
        
        const unidades = data ? data.filter(d => d.tipo === 'UNIDADE') : [];
        const locais = data ? data.filter(d => d.tipo === 'LOCALIZACAO') : [];
        const categorias = data ? data.filter(d => d.tipo === 'CATEGORIA') : [];
        
        const preencher = (id, lista) => {
            const sel = document.getElementById(id);
            if (!sel) return;
            sel.innerHTML = '<option value="">-- Selecione --</option>';
            lista.forEach(i => sel.innerHTML += `<option value="${i.descricao}">${i.descricao}</option>`);
        };
        
        preencher('pecaUnidade', unidades);
        preencher('pecaLocalizacao', locais);
        preencher('pecaCategoria', categorias);
    } catch (e) {
        console.error("Erro ao buscar cadastros básicos", e);
    }
}

// ==================== PAGINAÇÃO GENÉRICA ====================
function renderizarPaginacao(containerId, paginaAtual, totalPaginas, callback) {
    const div = document.getElementById(containerId);
    if (!div) return;
    div.innerHTML = '';
    if (totalPaginas <= 1) return;

    const criarBtn = (texto, pag, ativo = false, disabled = false) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `btn-modern ${ativo ? 'btn-primary' : 'btn-dark'}`;
        btn.style.padding = '6px 12px';
        btn.innerText = texto;
        btn.disabled = disabled;
        if (!disabled) btn.onclick = () => callback(pag);
        return btn;
    };

    div.appendChild(criarBtn('«', Math.max(1, paginaAtual - 1), false, paginaAtual === 1));

    const maxBtns = 7;
    let inicio = Math.max(1, paginaAtual - 3);
    let fim = Math.min(totalPaginas, inicio + maxBtns - 1);
    if (fim - inicio < maxBtns - 1) inicio = Math.max(1, fim - maxBtns + 1);

    for (let i = inicio; i <= fim; i++) {
        div.appendChild(criarBtn(String(i), i, i === paginaAtual));
    }

    div.appendChild(criarBtn('»', Math.min(totalPaginas, paginaAtual + 1), false, paginaAtual === totalPaginas));
}

// ==================== TABELA ESTOQUE ATUAL ====================
function atualizarTabelaPecas(listaPecas, pagina = 1) {
    listaPecasAtual = listaPecas;
    paginaAtualEstoque = pagina;
    
    const tbody = document.getElementById('tabelaPecasBody');
    const divPaginacao = document.getElementById('paginacaoEstoque');
    if (!tbody || !divPaginacao) return;
    
    tbody.innerHTML = '';
    divPaginacao.innerHTML = '';
    
    if (listaPecas.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhuma peça encontrada com os filtros atuais.</td></tr>'; 
        return; 
    }

    const totalPaginas = Math.ceil(listaPecas.length / itensPorPaginaEstoque);
    const inicio = (pagina - 1) * itensPorPaginaEstoque;
    const itensPagina = listaPecas.slice(inicio, inicio + itensPorPaginaEstoque);

    itensPagina.forEach(peca => {
        const min = parseFloat(peca.estoque_minimo) || 0;
        const qtdNum = parseFloat(peca.quantidade) || 0;
        const estaBaixo = qtdNum <= min;
        const statusHtml = estaBaixo
            ? `<span class="badge badge-alert"><i class="fas fa-exclamation-circle"></i> Baixo</span>`
            : `<span class="badge badge-ok"><i class="fas fa-check"></i> Normal</span>`;
        
        const valInfo = calcularStatusValidade(peca.data_validade);
        const pecaJson = JSON.stringify(peca).replace(/'/g, "&apos;");

        const tr = document.createElement('tr');
        tr.style.backgroundColor = 'rgba(255,255,255,0.02)';
        tr.innerHTML = `
            <td style="font-family: monospace; color: #60a5fa; font-weight:bold;">${peca.codigo || '-'}</td>
            <td><strong style="color: #f8fafc; cursor:pointer;" onclick='abrirKardexPeca(${peca.id})' title="Clique para abrir Ficha Kardex">${peca.nome}</strong></td>
            <td><span style="color:#cbd5e1; font-size:0.82rem; background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px; border: 1px solid #334155;">${peca.categoria || '-'}</span></td>
            <td style="color: #cbd5e1; font-weight: bold;">${peca.unidade || 'UN'}</td>
            <td><span class="badge badge-abc-${peca.curva || 'C'}">${peca.curva || 'C'}</span></td>
            <td style="color: #94a3b8;"><i class="fas fa-map-marker-alt" style="font-size:0.8rem;"></i> ${peca.localizacao || '-'}</td>
            <td>${valInfo.html}</td>
            <td style="font-size: 1.05rem; font-weight: bold; ${estaBaixo ? 'color: #f87171;' : 'color: #34d399;'}">${qtdNum.toFixed(2)}</td>
            <td style="color: #94a3b8;">${min}</td>
            <td style="font-weight: 500; color: #f8fafc;">R$ ${parseFloat(peca.preco_medio || 0).toFixed(2).replace('.', ',')}</td>
            <td>${statusHtml}</td>
            <td style="text-align: right; display: flex; gap: 5px; justify-content: flex-end;">
                <button type="button" title="Ficha Kardex / Histórico" class="btn-action-sm btn-info" onclick='abrirKardexPeca(${peca.id})'><i class="fas fa-history"></i></button>
                <button type="button" title="Imprimir Etiqueta QR" class="btn-action-sm btn-purple" onclick='imprimirQRCode(${pecaJson})'><i class="fas fa-qrcode"></i></button>
                <button type="button" title="Editar" class="btn-action-sm btn-edit" onclick='editarPeca(${pecaJson})'><i class="fas fa-pen"></i></button> 
                <button type="button" title="Excluir" class="btn-action-sm btn-delete" onclick='deletarPeca(${peca.id})'><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    renderizarPaginacao('paginacaoEstoque', pagina, totalPaginas, (p) => atualizarTabelaPecas(listaPecasAtual, p));
}

// ==================== TABELA SUGESTÃO DE COMPRAS ====================
function atualizarTabelaSugestaoCompras(termo = '') {
    const tbody = document.getElementById('tabelaComprasBody');
    const spanTotal = document.getElementById('totalEstimadoCompras');
    if (!tbody) return;
    tbody.innerHTML = '';

    const baixos = pecasEstoque.filter(p => {
        const qtd = parseFloat(p.quantidade) || 0;
        const min = parseFloat(p.estoque_minimo) || 0;
        const matchTermo = !termo || (p.nome || '').toLowerCase().includes(termo) || (p.codigo || '').toLowerCase().includes(termo) || (p.categoria || '').toLowerCase().includes(termo);
        return qtd <= min && matchTermo;
    });

    if (baixos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #34d399; padding: 25px;"><i class="fas fa-check-circle"></i> Nenhum item com estoque abaixo do mínimo!</td></tr>';
        if (spanTotal) spanTotal.innerText = 'R$ 0,00';
        return;
    }

    let investimentoTotal = 0;
    baixos.forEach(p => {
        const qtd = parseFloat(p.quantidade) || 0;
        const min = parseFloat(p.estoque_minimo) || 0;
        const preco = parseFloat(p.preco_medio) || 0;
        // Sugere repor até o dobro do mínimo (ou pelo menos 1 unidade)
        const qtdSugerida = Math.max(1, (min * 2) - qtd);
        const custoEst = qtdSugerida * preco;
        investimentoTotal += custoEst;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-family: monospace; color: #60a5fa; font-weight:bold;">${p.codigo || '-'}</td>
            <td><strong style="color:#f8fafc;">${p.nome}</strong></td>
            <td style="color:#cbd5e1;">${p.categoria || '-'}</td>
            <td><span class="badge badge-abc-${p.curva || 'C'}">${p.curva || 'C'}</span></td>
            <td style="color:#f87171; font-weight:bold;">${qtd.toFixed(2)} ${p.unidade || 'UN'}</td>
            <td style="color:#94a3b8;">${min.toFixed(2)}</td>
            <td style="color:#fbbf24; font-weight:bold; font-size:1.05rem;">${qtdSugerida.toFixed(2)}</td>
            <td>R$ ${preco.toFixed(2).replace('.', ',')}</td>
            <td style="color:#34d399; font-weight:bold;">R$ ${custoEst.toFixed(2).replace('.', ',')}</td>
        `;
        tbody.appendChild(tr);
    });

    if (spanTotal) {
        spanTotal.innerText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(investimentoTotal);
    }
}

// ==================== TABELA NOTAS FISCAIS (COM PAGINAÇÃO) ====================
function atualizarTabelaNotas(listaMovimentacoes, pagina = 1) {
    const tbody = document.getElementById('tabelaNotasBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const entradas = listaMovimentacoes.filter(m => m.tipo === 'entrada' && m.nota_fiscal && m.nota_fiscal !== '-');
    if (entradas.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhuma nota fiscal registrada.</td></tr>'; 
        renderizarPaginacao('paginacaoNotas', 1, 1, () => {});
        return; 
    }

    const gruposNotas = {};
    entradas.forEach(mov => {
        const dataMinuto = new Date(mov.data_movimentacao).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const dataSegundos = new Date(mov.data_movimentacao).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        const chave = mov.nota_fiscal === 'Entrada Manual Sist.'
            ? `manual_${mov.id || dataSegundos}`
            : `${mov.nota_fiscal}_${mov.fornecedor}_${mov.usuario}_${dataMinuto}`;
        
        if (!gruposNotas[chave]) {
            gruposNotas[chave] = {
                data: mov.data_movimentacao,
                data_formatada: mov.nota_fiscal === 'Entrada Manual Sist.' ? dataSegundos : dataMinuto,
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

    listaNotasAtual = Object.values(gruposNotas).sort((a, b) => new Date(b.data) - new Date(a.data));
    paginaAtualNotas = pagina;
    const totalPaginas = Math.ceil(listaNotasAtual.length / itensPorPaginaNotas);
    const inicio = (pagina - 1) * itensPorPaginaNotas;
    const itensPagina = listaNotasAtual.slice(inicio, inicio + itensPorPaginaNotas);

    itensPagina.forEach(nota => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color: #94a3b8; font-size: 0.85rem;"><i class="fas fa-clock"></i> ${nota.data_formatada}</td>
            <td style="font-family: monospace; color: #38bdf8; font-weight: bold; font-size: 1.05rem;">${nota.nota_fiscal}</td>
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

    renderizarPaginacao('paginacaoNotas', pagina, totalPaginas, (p) => atualizarTabelaNotas(listaMovimentacoes, p));
}

window.abrirDetalhesNota = function(nota) {
    document.getElementById('detalheNotaFornecedor').innerText = nota.fornecedor;
    document.getElementById('detalheNotaNF').innerText = nota.nota_fiscal;
    if (document.getElementById('detalheNotaUsuario')) document.getElementById('detalheNotaUsuario').innerHTML = `<i class="fas fa-user"></i> ${nota.usuario}`;
    if (document.getElementById('detalheNotaData')) document.getElementById('detalheNotaData').innerHTML = `<i class="fas fa-clock"></i> ${nota.data_formatada}`;
    
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
            <td style="color: #cbd5e1;">R$ ${parseFloat(mov.valor_unitario || 0).toFixed(2).replace('.', ',')}</td>
            <td style="font-weight: bold; color: #34d399;">R$ ${subtotal.toFixed(2).replace('.', ',')}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('modalDetalhesNota').style.display = 'flex';
};

// ==================== TABELA MOVIMENTAÇÕES (COM PAGINAÇÃO) ====================
function atualizarTabelaMovimentacoes(listaMovimentacoes, pagina = 1) {
    listaMovAtual = listaMovimentacoes;
    paginaAtualMov = pagina;
    const tbody = document.getElementById('tabelaMovimentacoesBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (listaMovimentacoes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhum registro de movimentação encontrado.</td></tr>';
        renderizarPaginacao('paginacaoMovimentacoes', 1, 1, () => {});
        return;
    }

    const totalPaginas = Math.ceil(listaMovimentacoes.length / itensPorPaginaMov);
    const inicio = (pagina - 1) * itensPorPaginaMov;
    const itensPagina = listaMovimentacoes.slice(inicio, inicio + itensPorPaginaMov);

    itensPagina.forEach(mov => {
        let tipoHtml = '';
        if (mov.tipo === 'entrada') tipoHtml = `<span class="badge badge-in"><i class="fas fa-arrow-down"></i> Entrada</span>`;
        else if (mov.tipo === 'saida') tipoHtml = `<span class="badge badge-out"><i class="fas fa-arrow-up"></i> Saída</span>`;
        else tipoHtml = `<span class="badge" style="background: rgba(100,116,139,0.5); color:#cbd5e1;"><i class="fas fa-balance-scale"></i> Ajuste</span>`;
        
        const dataFormatada = new Date(mov.data_movimentacao).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const pecaRef = pecasEstoque.find(p => String(p.id) === String(mov.peca_id));
        const nomePeca = pecaRef ? pecaRef.nome : '<span style="color:#f87171; font-style:italic;">Peça Excluída</span>';
        const responsavel = mov.usuario || 'Sistema';

        let destinoTxt = '-';
        if (mov.tipo === 'ajuste') destinoTxt = `<span style="color:#cbd5e1;">Motivo: ${mov.observacao || 'S/N'}</span>`;
        else if (mov.tipo === 'entrada') destinoTxt = `Forn: <span style="color:#cbd5e1;">${mov.fornecedor || 'N/A'}</span>`;
        else if (mov.tipo === 'saida') {
            if (mov.setor_destino) destinoTxt = `Destino: <strong style="color:#a855f7;">${mov.setor_destino}</strong>`;
            else if (mov.cavalo) destinoTxt = `Frota: <strong style="color:#f8fafc;">${mov.cavalo}</strong> ${mov.os_id ? `(OS: ${mov.os_id})` : ''}`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color: #94a3b8; font-size: 0.85rem;">${dataFormatada}</td>
            <td style="color: #38bdf8; font-weight: bold; font-size: 0.85rem;"><i class="fas fa-user-circle"></i> ${responsavel}</td>
            <td>${tipoHtml}</td>
            <td style="font-weight: 500; color: #f8fafc;">${nomePeca}</td>
            <td style="font-weight: bold; color: ${mov.tipo === 'entrada' ? '#60a5fa' : (mov.tipo === 'saida' ? '#fbbf24' : '#cbd5e1')};">${mov.quantidade}</td>
            <td style="color: #f8fafc;">R$ ${parseFloat(mov.valor_unitario || 0).toFixed(2).replace('.', ',')}</td>
            <td style="font-family: monospace; color: #94a3b8; font-size: 0.85rem;">${mov.nota_fiscal || '-'}</td>
            <td>${destinoTxt}</td>
        `;
        tbody.appendChild(tr);
    });

    renderizarPaginacao('paginacaoMovimentacoes', pagina, totalPaginas, (p) => atualizarTabelaMovimentacoes(listaMovAtual, p));
}

// ==================== FICHA KARDEX INDIVIDUAL DA PEÇA ====================
window.abrirKardexPeca = function(pecaId) {
    const peca = pecasEstoque.find(p => String(p.id) === String(pecaId));
    if (!peca) return;

    document.getElementById('kardexNomePeca').innerText = peca.nome;
    document.getElementById('kardexCodigoLocal').innerText = `${peca.codigo || 'S/C'} | ${peca.localizacao || 'Sem local'}`;
    document.getElementById('kardexSaldoAtual').innerText = `${parseFloat(peca.quantidade || 0).toFixed(2)} ${peca.unidade || 'UN'}`;
    document.getElementById('kardexPrecoMedio').innerText = `R$ ${parseFloat(peca.preco_medio || 0).toFixed(2).replace('.', ',')}`;

    const movsPeca = movimentacoesEstoque
        .filter(m => String(m.peca_id) === String(pecaId))
        .sort((a, b) => new Date(b.data_movimentacao) - new Date(a.data_movimentacao));

    // Calcular maior consumidor
    const consumoPorDestino = {};
    movsPeca.filter(m => m.tipo === 'saida').forEach(m => {
        const dest = m.cavalo || m.setor_destino || 'Não informado';
        consumoPorDestino[dest] = (consumoPorDestino[dest] || 0) + parseFloat(m.quantidade || 0);
    });
    const topDest = Object.entries(consumoPorDestino).sort((a, b) => b[1] - a[1])[0];
    document.getElementById('kardexMaiorConsumidor').innerText = topDest ? `${topDest[0]} (${topDest[1].toFixed(1)})` : 'Sem saídas';

    const tbody = document.getElementById('tabelaKardexBody');
    tbody.innerHTML = '';

    if (movsPeca.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#94a3b8;">Nenhuma movimentação registrada para esta peça.</td></tr>';
    } else {
        movsPeca.forEach(m => {
            const dt = new Date(m.data_movimentacao).toLocaleString('pt-BR');
            const badge = m.tipo === 'entrada' ? '<span class="badge badge-in">Entrada</span>'
                : (m.tipo === 'saida' ? '<span class="badge badge-out">Saída</span>' : '<span class="badge badge-warn">Ajuste</span>');
            const dest = m.tipo === 'entrada' ? (m.fornecedor || '-') : (m.cavalo ? `${m.cavalo} ${m.os_id ? '(OS ' + m.os_id + ')' : ''}` : (m.setor_destino || m.observacao || '-'));

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="color:#94a3b8;">${dt}</td>
                <td>${badge}</td>
                <td style="font-weight:bold;">${m.quantidade}</td>
                <td>R$ ${parseFloat(m.valor_unitario || 0).toFixed(2).replace('.', ',')}</td>
                <td style="font-family:monospace;">${m.nota_fiscal || m.observacao || '-'}</td>
                <td>${dest}</td>
                <td style="color:#38bdf8;">${m.usuario || 'Sistema'}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    document.getElementById('modalKardexPeca').style.display = 'flex';
};

// ==================== TABELA PNEUS E KITS ====================
function atualizarTabelaPneus(lista) {
    const tbody = document.getElementById('tabelaPneusBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (lista.length === 0) { tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhum pneu cadastrado.</td></tr>'; return; }

    lista.forEach(p => {
        const statusCor = p.status === 'Estoque' ? '#34d399' : (p.status === 'Rodando' ? '#60a5fa' : (p.status === 'Sucata' ? '#f87171' : '#fcd34d'));
        const localTxt = p.status === 'Rodando' ? `Frota: <b style="color:#f8fafc;">${p.cavalo_atual}</b>` : '<span style="color:#94a3b8;">No Almoxarifado</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:bold; color:#fff; font-size:1.1rem;">${p.num_fogo}</td>
            <td><strong style="color:#e2e8f0;">${p.marca}</strong> <br><span style="color:#94a3b8; font-size:0.85rem;">${p.medida}</span></td>
            <td><span class="badge" style="border:1px solid ${statusCor}; color:${statusCor}; background:transparent;">${p.status}</span></td>
            <td style="color:#cbd5e1;">${p.vida === 0 ? 'Novo' : p.vida + 'ª Recap'}</td>
            <td style="color:#f8fafc;">R$ ${parseFloat(p.custo_atual || 0).toFixed(2).replace('.', ',')}</td>
            <td>${localTxt}</td>
            <td style="color:#94a3b8;">${p.eixo || '-'} / ${p.posicao || '-'}</td>
            <td style="text-align: right; display: flex; gap: 5px; justify-content: flex-end;">
                <button type="button" class="btn-action-sm btn-edit" onclick='editarPneu(${JSON.stringify(p)})'><i class="fas fa-pen"></i></button>
                <button type="button" class="btn-action-sm btn-info" onclick='abrirAcaoPneu(${JSON.stringify(p)})'><i class="fas fa-cog"></i> Ação</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function atualizarTabelaKits(lista) {
    const tbody = document.getElementById('tabelaKitsBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (lista.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhum KIT cadastrado.</td></tr>'; return; }

    lista.forEach(kit => {
        let itensParsed = [];
        try {
            if (typeof kit.itens === 'string') itensParsed = JSON.parse(kit.itens);
            else if (Array.isArray(kit.itens)) itensParsed = kit.itens;
        } catch (e) { itensParsed = []; }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:bold; color:#fff;">${kit.nome}</td>
            <td style="color:#cbd5e1;">${kit.descricao || '-'}</td>
            <td style="color:#94a3b8; font-weight:bold;">${itensParsed.length} peças</td>
            <td style="text-align: right; display: flex; gap: 5px; justify-content: flex-end;">
                <button type="button" title="Requisitar KIT" class="btn-action-sm btn-warning" onclick='abrirRequisitarKit(${JSON.stringify(kit).replace(/'/g, "&apos;")})'><i class="fas fa-dolly"></i> Requisitar</button>
                <button type="button" title="Editar KIT" class="btn-action-sm btn-edit" onclick='editarKit(${JSON.stringify(kit).replace(/'/g, "&apos;")})'><i class="fas fa-pen"></i></button>
                <button type="button" title="Excluir" class="btn-action-sm btn-delete" onclick='deletarKit(${kit.id})'><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ==================== KPIS E FILTROS ====================
function atualizarKPIsAlmoxarifado() {
    let valorTotal = 0, itensBaixos = 0, validadeCritica = 0;

    pecasEstoque.forEach(p => {
        const qtd = parseFloat(p.quantidade || 0);
        const preco = parseFloat(p.preco_medio || 0);
        valorTotal += qtd * preco;
        if (qtd <= parseFloat(p.estoque_minimo || 0)) itensBaixos++;
        const stVal = calcularStatusValidade(p.data_validade).tipo;
        if (stVal === 'vencido' || stVal === 'vencer30') validadeCritica++;
    });

    pneusEstoque.forEach(pneu => valorTotal += parseFloat(pneu.custo_atual || 0));

    document.getElementById('kpiTotalItens').innerText = pecasEstoque.length; 
    document.getElementById('kpiEstoqueMinimo').innerText = itensBaixos;
    const elVal = document.getElementById('kpiValidadeCritica');
    if (elVal) elVal.innerText = validadeCritica;
    document.getElementById('kpiValorTotal').innerText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal);
    document.getElementById('kpiPneusResumo').innerText = `${pneusEstoque.filter(p => p.status === 'Rodando').length} / ${pneusEstoque.filter(p => p.status === 'Estoque').length}`;
}

window.aplicarFiltroKpi = function(tipo) {
    mudarAbaPorId('estoque');
    limparFiltrosEstoque(false);
    if (tipo === 'baixo') document.getElementById('filtroEstStatus').value = 'baixo';
    else if (tipo === 'validade') document.getElementById('filtroEstStatus').value = 'vencer30';
    else if (tipo === 'curvaA') document.getElementById('filtroEstCurva').value = 'A';
    filtrarAlmoxarifado();
};

window.limparFiltrosEstoque = function(recarregar = true) {
    ['filtroEstCategoria', 'filtroEstLocalizacao', 'filtroEstCurva', 'filtroEstStatus'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const search = document.getElementById('almoSearchInput');
    if (search) search.value = '';
    if (recarregar) filtrarAlmoxarifado();
};

window.limparFiltrosMov = function() {
    ['filtroMovInicio', 'filtroMovFim', 'filtroMovTipo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    filtrarAlmoxarifado();
};

window.filtrarAlmoxarifado = function() {
    const termo = (document.getElementById('almoSearchInput')?.value || '').toLowerCase().trim();

    if (abaAtualAlmox === 'estoque') {
        const cat = document.getElementById('filtroEstCategoria')?.value || '';
        const loc = document.getElementById('filtroEstLocalizacao')?.value || '';
        const curva = document.getElementById('filtroEstCurva')?.value || '';
        const status = document.getElementById('filtroEstStatus')?.value || '';

        const filtradas = pecasEstoque.filter(p => {
            const matchTermo = !termo || (p.nome || '').toLowerCase().includes(termo) || (p.codigo || '').toLowerCase().includes(termo) || (p.categoria || '').toLowerCase().includes(termo) || (p.localizacao || '').toLowerCase().includes(termo);
            const matchCat = !cat || p.categoria === cat;
            const matchLoc = !loc || p.localizacao === loc;
            const matchCurva = !curva || p.curva === curva;

            let matchStatus = true;
            const estaBaixo = parseFloat(p.quantidade || 0) <= parseFloat(p.estoque_minimo || 0);
            const valTipo = calcularStatusValidade(p.data_validade).tipo;

            if (status === 'baixo') matchStatus = estaBaixo;
            else if (status === 'normal') matchStatus = !estaBaixo;
            else if (status === 'vencido') matchStatus = valTipo === 'vencido';
            else if (status === 'vencer30') matchStatus = (valTipo === 'vencido' || valTipo === 'vencer30');

            return matchTermo && matchCat && matchLoc && matchCurva && matchStatus;
        });
        atualizarTabelaPecas(filtradas, 1);

    } else if (abaAtualAlmox === 'compras') {
        atualizarTabelaSugestaoCompras(termo);

    } else if (abaAtualAlmox === 'notas') {
        const filtradas = movimentacoesEstoque.filter(m =>
            !termo || (m.nota_fiscal || '').toLowerCase().includes(termo) || (m.fornecedor || '').toLowerCase().includes(termo) || (m.usuario || '').toLowerCase().includes(termo)
        );
        atualizarTabelaNotas(filtradas, 1);

    } else if (abaAtualAlmox === 'movimentacoes') {
        const dtIni = document.getElementById('filtroMovInicio')?.value || '';
        const dtFim = document.getElementById('filtroMovFim')?.value || '';
        const tipo = document.getElementById('filtroMovTipo')?.value || '';

        const filtradas = movimentacoesEstoque.filter(m => {
            const pecaRef = pecasEstoque.find(p => String(p.id) === String(m.peca_id));
            const nomePeca = pecaRef ? pecaRef.nome.toLowerCase() : '';
            const matchTermo = !termo || nomePeca.includes(termo) || (m.nota_fiscal || '').toLowerCase().includes(termo) || (m.fornecedor || '').toLowerCase().includes(termo) || (m.cavalo || '').toLowerCase().includes(termo) || (m.setor_destino || '').toLowerCase().includes(termo) || (m.usuario || '').toLowerCase().includes(termo);
            const matchTipo = !tipo || m.tipo === tipo;

            let matchData = true;
            if (dtIni || dtFim) {
                const dataMov = new Date(m.data_movimentacao).toISOString().split('T')[0];
                if (dtIni && dataMov < dtIni) matchData = false;
                if (dtFim && dataMov > dtFim) matchData = false;
            }
            return matchTermo && matchTipo && matchData;
        });
        atualizarTabelaMovimentacoes(filtradas, 1);

    } else if (abaAtualAlmox === 'pneus') {
        const stPneu = document.getElementById('filtroPneuStatus')?.value || '';
        const filtrados = pneusEstoque.filter(p => {
            const matchTermo = !termo || (p.num_fogo || '').toLowerCase().includes(termo) || (p.cavalo_atual || '').toLowerCase().includes(termo) || (p.marca || '').toLowerCase().includes(termo);
            const matchSt = !stPneu || p.status === stPneu;
            return matchTermo && matchSt;
        });
        atualizarTabelaPneus(filtrados);

    } else if (abaAtualAlmox === 'kits') {
        atualizarTabelaKits(kitsEstoque.filter(k => !termo || (k.nome || '').toLowerCase().includes(termo) || (k.descricao || '').toLowerCase().includes(termo)));
    }
};

window.mudarAbaPorId = function(abaId) {
    const btn = document.querySelector(`.almo-tab-btn[data-aba="${abaId}"]`);
    if (btn) mudarAbaAlmoxarifado(abaId, btn);
};

window.mudarAbaAlmoxarifado = function(abaId, btn) {
    abaAtualAlmox = abaId;
    document.querySelectorAll('.almo-tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    ['estoque', 'compras', 'notas', 'movimentacoes', 'pneus', 'kits'].forEach(id => {
        const element = document.getElementById('aba' + id.charAt(0).toUpperCase() + id.slice(1));
        if (element) element.style.display = (id === abaId ? 'block' : 'none');
    });
    filtrarAlmoxarifado();
};

// ==================== INTEGRAÇÃO LEITOR DE CÂMERA QR ====================
window.iniciarLeituraBusca = function() {
    contextoCameraAtual = 'busca';
    if (typeof window.abrirCameraLeitor === 'function') window.abrirCameraLeitor('PECA');
    else almoNotify('Atenção', 'Módulo de câmera não carregado.', 'warning');
};

window.iniciarLeituraOS = function() {
    contextoCameraAtual = 'os';
    if (typeof window.abrirCameraLeitor === 'function') window.abrirCameraLeitor('OS');
    else almoNotify('Atenção', 'Módulo de câmera não carregado.', 'warning');
};

window.iniciarLeituraPecaSaida = function() {
    contextoCameraAtual = 'saida';
    if (typeof window.abrirCameraLeitor === 'function') window.abrirCameraLeitor('PECA');
    else almoNotify('Atenção', 'Módulo de câmera não carregado.', 'warning');
};

window.processarLeituraOS = function(codigoLido) {
    const osInput = document.getElementById('movOS');
    if (osInput) {
        const numero = codigoLido.replace(/\D/g, '') || codigoLido;
        osInput.value = numero;
        osInput.dispatchEvent(new Event('change'));
    }
};

window.processarLeituraPeca = function(codigoLido) {
    const termo = (codigoLido || '').trim().toLowerCase();
    if (contextoCameraAtual === 'busca') {
        if (typeof window.pararLeituraCamera === 'function') window.pararLeituraCamera();
        const searchInput = document.getElementById('almoSearchInput');
        if (searchInput) {
            searchInput.value = codigoLido.trim();
            mudarAbaPorId('estoque');
            filtrarAlmoxarifado();
        }
    } else if (contextoCameraAtual === 'saida') {
        const peca = pecasEstoque.find(p => (p.codigo || '').toLowerCase() === termo || String(p.id) === termo);
        if (!peca) {
            almoNotify('Não encontrada', `Nenhuma peça com código "${codigoLido}" encontrada.`, 'warning');
            return;
        }
        adicionarPecaDiretaCarrinho(peca, 1);
    }
};

// ==================== SAÍDA EM LOTE (CARRINHO + AUTOCOMPLETE) ====================
let timerPecasSaidaDebounce;
window.filtrarPecasSaidaDebounced = function(forcarMostrar = false) {
    clearTimeout(timerPecasSaidaDebounce);
    timerPecasSaidaDebounce = setTimeout(() => filtrarPecasSaidaExec(forcarMostrar), 250);
};

function filtrarPecasSaidaExec(forcarMostrar = false) {
    const input = document.getElementById('pesquisaPecaSaida');
    const container = document.getElementById('listaPecasSaidaCustom');
    const btnLimpar = document.getElementById('btnLimparPesquisaSaida');
    if (!input || !container) return;

    const termo = input.value.trim().toLowerCase();
    if (btnLimpar) btnLimpar.style.display = termo.length > 0 ? 'block' : 'none';
    if (termo.length === 0 && !forcarMostrar) { container.style.display = 'none'; return; }

    let filtradas = pecasEstoque.filter(p => termo === '' || (p.nome || '').toLowerCase().includes(termo) || (p.codigo || '').toLowerCase().includes(termo));
    if (filtradas.length > 50 && termo === '') filtradas = filtradas.slice(0, 50);

    if (filtradas.length === 0) {
        container.innerHTML = '<div style="padding:15px; text-align:center; color:#94a3b8;">Nenhuma peça encontrada.</div>';
    } else {
        container.innerHTML = filtradas.map(x => `
            <div class="peca-item" onclick="selecionarPecaSaidaCustom(${x.id})">
                <div class="peca-item-info">
                    <span class="peca-item-nome">${x.nome}</span>
                    ${x.codigo ? `<span class="peca-item-codigo"><i class="fas fa-barcode"></i> ${x.codigo}</span>` : ''}
                </div>
                <div class="peca-item-estoque" style="color:${parseFloat(x.quantidade) > 0 ? '#10b981' : '#f87171'};">
                    <i class="fas fa-box"></i> ${parseFloat(x.quantidade || 0).toFixed(2)} ${x.unidade || 'UN'}
                </div>
            </div>
        `).join('');
    }
    container.style.display = 'block';
}

window.selecionarPecaSaidaCustom = function(id) {
    const p = pecasEstoque.find(x => x.id == id);
    if (!p) return;
    document.getElementById('movPecaId').value = p.id;
    document.getElementById('pesquisaPecaSaida').value = p.codigo ? `[${p.codigo}] ${p.nome}` : p.nome;
    document.getElementById('movValor').value = parseFloat(p.preco_medio || 0).toFixed(2);
    document.getElementById('listaPecasSaidaCustom').style.display = 'none';
    document.getElementById('movQuantidade').focus();
    document.getElementById('movQuantidade').select();
};

window.limparPesquisaPecaSaida = function() {
    document.getElementById('pesquisaPecaSaida').value = '';
    document.getElementById('movPecaId').value = '';
    document.getElementById('movValor').value = '';
    document.getElementById('listaPecasSaidaCustom').style.display = 'none';
    document.getElementById('btnLimparPesquisaSaida').style.display = 'none';
};

window.toggleListaPecasSaida = function() {
    const container = document.getElementById('listaPecasSaidaCustom');
    if (container.style.display === 'block') container.style.display = 'none';
    else { document.getElementById('pesquisaPecaSaida').focus(); filtrarPecasSaidaDebounced(true); }
};

function adicionarPecaDiretaCarrinho(peca, qtd) {
    const existente = carrinhoSaidaAtual.find(i => String(i.peca_id) === String(peca.id));
    const novaQtd = (existente ? existente.quantidade : 0) + qtd;

    if (novaQtd > parseFloat(peca.quantidade || 0)) {
        almoNotify('Estoque Insuficiente', `Saldo disponível para ${peca.nome}: ${peca.quantidade}.`, 'warning');
        return;
    }

    if (existente) {
        existente.quantidade = novaQtd;
    } else {
        carrinhoSaidaAtual.push({
            peca_id: peca.id,
            codigo: peca.codigo || '-',
            nome: peca.nome,
            saldo: parseFloat(peca.quantidade || 0),
            quantidade: qtd,
            valor_unitario: parseFloat(peca.preco_medio || 0)
        });
    }
    renderizarCarrinhoSaida();
}

window.adicionarItemCarrinhoSaida = function() {
    const pecaId = document.getElementById('movPecaId').value;
    const qtd = parseFloat(document.getElementById('movQuantidade').value);
    if (!pecaId || isNaN(qtd) || qtd <= 0) {
        almoNotify('Atenção', 'Selecione uma peça e informe uma quantidade válida.', 'warning');
        return;
    }
    const peca = pecasEstoque.find(p => String(p.id) === String(pecaId));
    if (!peca) return;

    adicionarPecaDiretaCarrinho(peca, qtd);
    limparPesquisaPecaSaida();
    document.getElementById('movQuantidade').value = '1';
};

window.removerItemCarrinhoSaida = function(index) {
    carrinhoSaidaAtual.splice(index, 1);
    renderizarCarrinhoSaida();
};

function renderizarCarrinhoSaida() {
    const tbody = document.getElementById('tabelaCarrinhoSaidaBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (carrinhoSaidaAtual.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:14px; color:#94a3b8;">Nenhuma peça adicionada ao carrinho de saída.</td></tr>';
        return;
    }
    carrinhoSaidaAtual.forEach((item, idx) => {
        const sub = item.quantidade * item.valor_unitario;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color:#60a5fa; font-family:monospace;">${item.codigo}</td>
            <td style="color:#f8fafc; font-weight:600;">${item.nome}</td>
            <td style="color:#94a3b8;">${item.saldo.toFixed(2)}</td>
            <td style="color:#fbbf24; font-weight:bold;">${item.quantidade.toFixed(2)}</td>
            <td style="color:#34d399;">R$ ${sub.toFixed(2).replace('.', ',')}</td>
            <td style="text-align:center;"><button type="button" class="btn-action-sm btn-delete" onclick="removerItemCarrinhoSaida(${idx})"><i class="fas fa-trash"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
}

// ==================== INVENTÁRIO EM LOTE / AJUSTE ====================
window.mudarModoAjuste = function(modo) {
    modoAjusteAtual = modo;
    document.getElementById('subDivAjusteIndividual').style.display = modo === 'individual' ? 'block' : 'none';
    document.getElementById('subDivAjusteLote').style.display = modo === 'lote' ? 'block' : 'none';
    document.getElementById('btnModoAjusteIndiv').className = `btn-modern ${modo === 'individual' ? 'btn-primary' : 'btn-dark'}`;
    document.getElementById('btnModoAjusteLote').className = `btn-modern ${modo === 'lote' ? 'btn-primary' : 'btn-dark'}`;

    ['ajustePecaId', 'ajusteQtdReal', 'ajusteMotivo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.required = (modo === 'individual');
    });

    if (modo === 'lote') {
        const selLoc = document.getElementById('invLocalizacaoFiltro');
        if (selLoc) {
            const locs = [...new Set(pecasEstoque.map(p => p.localizacao).filter(Boolean))].sort();
            selLoc.innerHTML = '<option value="">Todas as Localizações</option>' + locs.map(l => `<option value="${l}">${l}</option>`).join('');
        }
        renderizarTabelaInventarioLote();
    }
};

window.renderizarTabelaInventarioLote = function() {
    const loc = document.getElementById('invLocalizacaoFiltro')?.value || '';
    const tbody = document.getElementById('tabelaInventarioLoteBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const lista = pecasEstoque.filter(p => !loc || p.localizacao === loc);
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:15px;">Nenhuma peça nesta localização.</td></tr>';
        return;
    }

    lista.forEach(p => {
        const qtdSis = parseFloat(p.quantidade || 0);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-family:monospace; color:#60a5fa;">${p.codigo || '-'}</td>
            <td style="color:#f8fafc;">${p.nome}</td>
            <td style="color:#94a3b8;">${p.localizacao || '-'}</td>
            <td style="font-weight:bold;">${qtdSis.toFixed(2)}</td>
            <td><input type="number" step="0.01" class="input-table-sm inv-input-fisico" data-peca-id="${p.id}" data-sis="${qtdSis}" placeholder="Igual (${qtdSis})" oninput="atualizarDifInventario(this)"></td>
            <td class="inv-dif-cell" style="font-weight:bold; color:#94a3b8;">0.00</td>
        `;
        tbody.appendChild(tr);
    });
};

window.atualizarDifInventario = function(input) {
    const sis = parseFloat(input.dataset.sis) || 0;
    const val = input.value === '' ? sis : parseFloat(input.value);
    const dif = val - sis;
    const cell = input.closest('tr').querySelector('.inv-dif-cell');
    if (cell) {
        cell.innerText = (dif > 0 ? '+' : '') + dif.toFixed(2);
        cell.style.color = dif > 0 ? '#34d399' : (dif < 0 ? '#f87171' : '#94a3b8');
    }
};

// ==================== TRANSFERÊNCIA ENTRE FILIAIS ====================
window.abrirModalTransferencia = async function() {
    document.getElementById('formTransferencia').reset();
    document.getElementById('transfSaldoAtual').value = '';
    preencherSelectPecas('transfPecaId');

    const selFilial = document.getElementById('transfFilialDestino');
    selFilial.innerHTML = '<option value="">Carregando filiais...</option>';
    try {
        if (window.supabaseClient) {
            const { data } = await window.supabaseClient.from('filiais').select('id, nome').order('nome');
            if (data && data.length > 0) {
                selFilial.innerHTML = '<option value="">-- Selecione a Filial de Destino --</option>' +
                    data.map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
            } else {
                selFilial.innerHTML = '<option value="">Nenhuma filial encontrada</option>';
            }
        }
    } catch (e) {
        selFilial.innerHTML = '<option value="">Erro ao carregar filiais</option>';
    }

    document.getElementById('modalTransferencia').style.display = 'flex';
};

window.atualizarSaldoTransferencia = function() {
    const id = document.getElementById('transfPecaId').value;
    const p = pecasEstoque.find(x => String(x.id) === String(id));
    document.getElementById('transfSaldoAtual').value = p ? `${parseFloat(p.quantidade || 0).toFixed(2)} ${p.unidade || 'UN'}` : '';
};

window.executarTransferenciaFilial = async function(e) {
    e.preventDefault();
    const pecaId = document.getElementById('transfPecaId').value;
    const qtd = parseFloat(document.getElementById('transfQuantidade').value);
    const filialDestinoId = document.getElementById('transfFilialDestino').value;
    const filialDestinoNome = document.getElementById('transfFilialDestino').selectedOptions[0]?.text || filialDestinoId;
    const obs = document.getElementById('transfObs').value.trim();

    const peca = pecasEstoque.find(p => String(p.id) === String(pecaId));
    if (!peca || qtd <= 0 || qtd > parseFloat(peca.quantidade || 0)) {
        almoNotify('Saldo Insuficiente', 'Verifique a quantidade disponível na filial atual.', 'warning');
        return;
    }

    const btn = document.getElementById('btnConfirmarTransf');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Transferindo...';

    try {
        const usuario = window.currentUser ? window.currentUser.username : 'Sistema';
        const agora = new Date().toISOString();

        // 1. Baixa na filial de origem
        await db.addMovimentacao({
            peca_id: peca.id,
            tipo: 'saida',
            quantidade: qtd,
            valor_unitario: parseFloat(peca.preco_medio || 0),
            setor_destino: `Transf. p/ ${filialDestinoNome}`,
            nota_fiscal: `TRANSF-${Date.now().toString().slice(-5)}`,
            observacao: obs,
            usuario: usuario,
            data_movimentacao: agora
        });

        // 2. Entrada na filial de destino (verifica se código já existe lá)
        if (window.supabaseClient && filialDestinoId) {
            const { data: existeDest } = await window.supabaseClient
                .from('almoxarifado_pecas')
                .select('*')
                .eq('filial_id', filialDestinoId)
                .eq('codigo', peca.codigo)
                .maybeSingle();

            let destPecaId = null;
            if (existeDest) {
                destPecaId = existeDest.id;
                const novaQtdDest = parseFloat(existeDest.quantidade || 0) + qtd;
                await window.supabaseClient.from('almoxarifado_pecas').update({ quantidade: novaQtdDest }).eq('id', destPecaId);
            } else {
                const novaPecaDest = {
                    codigo: peca.codigo, nome: peca.nome, unidade: peca.unidade,
                    categoria: peca.categoria, localizacao: peca.localizacao,
                    quantidade: qtd, estoque_minimo: peca.estoque_minimo,
                    preco_medio: peca.preco_medio, data_validade: peca.data_validade,
                    filial_id: filialDestinoId
                };
                const { data: inserida } = await window.supabaseClient.from('almoxarifado_pecas').insert([novaPecaDest]).select();
                if (inserida && inserida[0]) destPecaId = inserida[0].id;
            }

            if (destPecaId) {
                await window.supabaseClient.from('almoxarifado_movimentacoes').insert([{
                    peca_id: destPecaId,
                    tipo: 'entrada',
                    quantidade: qtd,
                    valor_unitario: parseFloat(peca.preco_medio || 0),
                    fornecedor: 'Transferência Interna',
                    nota_fiscal: `TRANSF-${Date.now().toString().slice(-5)}`,
                    observacao: obs,
                    usuario: usuario,
                    data_movimentacao: agora,
                    filial_id: filialDestinoId
                }]);
            }
        }

        fecharModalAlmox('modalTransferencia');
        await carregarDadosAlmoxarifado();
        almoNotify('Transferência Concluída', `${qtd} ${peca.unidade || 'UN'} de ${peca.nome} enviada(s) para ${filialDestinoNome}.`, 'success');
    } catch (err) {
        console.error(err);
        almoNotify('Erro', 'Falha ao realizar transferência entre filiais.', 'error');
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-exchange-alt"></i> Confirmar Transferência';
    }
};

// ==================== CENTROS DE CUSTO & MODAL MOVIMENTAÇÃO ====================
window.carregarCentrosCustoAlmox = async function() {
    const selects = [document.getElementById('movCentroCusto'), document.getElementById('reqKitCentroCusto')];
    if (!window.supabaseClient) return;
    selects.forEach(s => { if (s) s.innerHTML = '<option value="">Carregando...</option>'; });

    try {
        let query = window.supabaseClient.from('centro_custo').select('id, nome, codigo').eq('status', 'Ativo');
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
        const { data } = await query;
        const optionsHtml = data && data.length > 0
            ? '<option value="" disabled selected>-- Selecione o Centro de Custo --</option>' + data.map(cc => `<option value="${cc.nome}">[${cc.codigo}] ${cc.nome}</option>`).join('')
            : '<option value="" disabled>Nenhum Centro Cadastrado nesta Filial</option>';
        selects.forEach(s => { if (s) s.innerHTML = optionsHtml; });
    } catch (e) {
        selects.forEach(s => { if (s) s.innerHTML = '<option value="" disabled>Erro ao carregar</option>'; });
    }
};

window.toggleTipoSaida = function() {
    const tipo = document.getElementById('movTipoSaida').value;
    if (tipo === 'frota') {
        document.getElementById('camposFrotaSaida').style.display = 'flex';
        document.getElementById('camposSetorSaida').style.display = 'none';
        document.getElementById('movOS').required = true;
        document.getElementById('movCentroCusto').required = false;
        document.getElementById('movCentroCusto').value = '';
    } else {
        document.getElementById('camposFrotaSaida').style.display = 'none';
        document.getElementById('camposSetorSaida').style.display = 'block';
        document.getElementById('movOS').required = false;
        document.getElementById('movCentroCusto').required = true;
        document.getElementById('movCavalo').value = '';
        document.getElementById('movOS').value = '';
    }
};

window.prepararModalMovimentacao = function(tipo) {
    document.getElementById('formMovimentacao').reset();
    document.getElementById('movTipo').value = tipo;
    
    document.getElementById('divEntradaNF').style.display = 'none';
    document.getElementById('divSaidaOS').style.display = 'none';
    document.getElementById('divAjusteEstoque').style.display = 'none';

    ['movNF', 'movFornecedor', 'movCentroCusto', 'movOS', 'ajustePecaId', 'ajusteQtdReal', 'ajusteMotivo'].forEach(id => {
        if (document.getElementById(id)) document.getElementById(id).required = false;
    });
    
    const titulo = document.getElementById('modalMovTitulo');
    const btnSubmit = document.getElementById('btnConfirmaMov');
    
    if (tipo === 'entrada') {
        titulo.innerHTML = '<i class="fas fa-arrow-down" style="color: #60a5fa;"></i> Lançar Entrada de Peça (NF)';
        btnSubmit.className = 'btn-modern btn-primary';
        document.getElementById('divEntradaNF').style.display = 'block';
        itensLoteAtual = []; renderizarItensLoteNF();
        document.getElementById('movNF').required = true; document.getElementById('movFornecedor').required = true;
    } else if (tipo === 'saida') {
        titulo.innerHTML = '<i class="fas fa-arrow-up" style="color: #fbbf24;"></i> Registrar Saída do Estoque (Lote)';
        btnSubmit.className = 'btn-modern btn-warning';
        document.getElementById('divSaidaOS').style.display = 'block';
        
        carrinhoSaidaAtual = [];
        renderizarCarrinhoSaida();
        limparPesquisaPecaSaida();

        document.getElementById('movTipoSaida').value = 'frota';
        window.carregarCentrosCustoAlmox(); 
        toggleTipoSaida();
        
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
    } else if (tipo === 'ajuste') {
        titulo.innerHTML = '<i class="fas fa-balance-scale" style="color: #94a3b8;"></i> Ajuste de Balanço / Inventário';
        btnSubmit.className = 'btn-modern btn-dark';
        document.getElementById('divAjusteEstoque').style.display = 'block';
        preencherSelectPecas('ajustePecaId');
        document.getElementById('ajusteQtdAtual').value = '';
        mudarModoAjuste('individual');
    }

    document.getElementById('modalMovimentacao').style.display = 'flex';
};

function preencherSelectPecas(idElemento) {
    const select = document.getElementById(idElemento);
    if (!select) return;
    select.innerHTML = '<option value="">-- Selecione um lote/peça --</option>';
    pecasEstoque.forEach(p => {
        const txtValidade = p.data_validade ? ` | Val: ${p.data_validade.split('-').reverse().join('/')}` : '';
        const nomeExib = `${p.codigo ? '[' + p.codigo + '] ' : ''}${p.nome} (Qtd: ${p.quantidade} ${p.unidade || 'UN'}${txtValidade})`;
        select.innerHTML += `<option value="${p.id}">${nomeExib}</option>`;
    });
}

window.carregarEstoqueAtualAjuste = function() {
    const p = pecasEstoque.find(x => x.id == document.getElementById('ajustePecaId').value);
    document.getElementById('ajusteQtdAtual').value = p ? p.quantidade : '';
};

window.salvarMovimentacao = async function(e) {
    e.preventDefault();
    const tipo = document.getElementById('movTipo').value;
    const btnSubmit = document.getElementById('btnConfirmaMov');
    if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...'; }

    try {
        const usuario = window.currentUser ? window.currentUser.username : 'Sistema';

        if (tipo === 'entrada') {
            if (itensLoteAtual.length === 0) { almoNotify('Atenção', 'Adicione produtos na nota.', 'warning'); throw new Error("Sem itens"); }
            const nf = document.getElementById('movNF').value, fornecedor = document.getElementById('movFornecedor').value;
            const itensComAuditoria = itensLoteAtual.map(i => ({ ...i, usuario }));
            await db.processarEntradaLote(itensComAuditoria, nf, fornecedor);
            almoNotify('Sucesso!', 'Entrada de NF registrada com sucesso.', 'success');
            
        } else if (tipo === 'saida') {
            if (carrinhoSaidaAtual.length === 0) {
                almoNotify('Carrinho Vazio', 'Adicione pelo menos uma peça à lista de saída.', 'warning');
                throw new Error("Carrinho vazio");
            }

            const tipoSaidaDestino = document.getElementById('movTipoSaida').value;
            let cavaloVal = null, setorVal = null, osVal = null;

            if (tipoSaidaDestino === 'frota') {
                osVal = document.getElementById('movOS').value;
                cavaloVal = document.getElementById('movCavalo').value.toUpperCase();
                if (!cavaloVal || cavaloVal === "OS NÃO ENCONTRADA" || cavaloVal === "BUSCANDO PLACA...") {
                    almoNotify('OS Inválida', 'Informe uma O.S. válida para puxar a placa.', 'warning');
                    throw new Error("Sem placa");
                }
            } else {
                setorVal = document.getElementById('movCentroCusto').value;
            }

            for (const item of carrinhoSaidaAtual) {
                await db.addMovimentacao({
                    peca_id: item.peca_id, tipo: 'saida', quantidade: item.quantidade,
                    valor_unitario: item.valor_unitario, cavalo: cavaloVal,
                    setor_destino: setorVal, os_id: osVal, usuario,
                    data_movimentacao: new Date().toISOString()
                });
            }
            almoNotify('Sucesso!', `${carrinhoSaidaAtual.length} item(ns) baixado(s) do estoque.`, 'success');
            
        } else if (tipo === 'ajuste') {
            if (modoAjusteAtual === 'individual') {
                const peca_id = document.getElementById('ajustePecaId').value;
                const qtdReal = parseFloat(document.getElementById('ajusteQtdReal').value);
                const peca = pecasEstoque.find(p => p.id == peca_id);
                const diferenca = qtdReal - parseFloat(peca.quantidade || 0);
                if (diferenca === 0) { almoNotify('Sem alterações', 'Quantidade física igual ao sistema.', 'info'); throw new Error("Sem diferenca"); }
                
                await db.addMovimentacao({
                    peca_id, tipo: 'ajuste', quantidade: diferenca, valor_unitario: peca.preco_medio,
                    nota_fiscal: 'Ajuste Físico', observacao: document.getElementById('ajusteMotivo').value,
                    usuario, data_movimentacao: new Date().toISOString()
                });
                peca.quantidade = qtdReal;
                await db.upsertPeca(peca);
                almoNotify('Ajustado!', 'Saldo de estoque atualizado com sucesso.', 'success');
            } else {
                const inputs = document.querySelectorAll('.inv-input-fisico');
                const motivoLote = document.getElementById('invMotivoLote').value.trim() || 'Inventário em Lote';
                let totalAjustados = 0;

                for (const inp of inputs) {
                    if (inp.value === '') continue;
                    const qtdReal = parseFloat(inp.value);
                    const peca = pecasEstoque.find(p => String(p.id) === String(inp.dataset.pecaId));
                    if (!peca) continue;
                    const diferenca = qtdReal - parseFloat(peca.quantidade || 0);
                    if (diferenca !== 0) {
                        await db.addMovimentacao({
                            peca_id: peca.id, tipo: 'ajuste', quantidade: diferenca, valor_unitario: peca.preco_medio,
                            nota_fiscal: 'Inventário Lote', observacao: motivoLote,
                            usuario, data_movimentacao: new Date().toISOString()
                        });
                        peca.quantidade = qtdReal;
                        await db.upsertPeca(peca);
                        totalAjustados++;
                    }
                }
                if (totalAjustados === 0) {
                    almoNotify('Sem alterações', 'Nenhuma divergência preenchida no inventário.', 'info');
                    throw new Error("Sem divergencias");
                }
                almoNotify('Inventário Concluído!', `${totalAjustados} peça(s) ajustada(s) com sucesso.`, 'success');
            }
        }

        fecharModalAlmox('modalMovimentacao');
        await carregarDadosAlmoxarifado();
    } catch (error) {
        console.error(error);
    } finally {
        if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.innerHTML = '<i class="fas fa-check"></i> Salvar Movimentação'; }
    }
};

// ==================== LEITOR NF (XML / PDF) ====================
window.processarArquivoNF = async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById('movNF').value = "Lendo arquivo...";
    itensLoteAtual = [];

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
                    if (!prod) continue;

                    const qtd = parseFloat(prod.getElementsByTagName('qCom')[0]?.textContent || '0');
                    const vUnCom = parseFloat(prod.getElementsByTagName('vUnCom')[0]?.textContent || '0');
                    const vProd = parseFloat(prod.getElementsByTagName('vProd')[0]?.textContent || '0');
                    const vFrete = parseFloat(prod.getElementsByTagName('vFrete')[0]?.textContent || '0');
                    const vDesc = parseFloat(prod.getElementsByTagName('vDesc')[0]?.textContent || '0');
                    const vIPI = parseFloat(imposto?.getElementsByTagName('vIPI')[0]?.textContent || '0');
                    const vST = parseFloat(imposto?.getElementsByTagName('vICMSST')[0]?.textContent || '0');

                    const custoTotalItem = vProd + vIPI + vST + vFrete - vDesc;
                    const custoUnitarioReal = qtd > 0 ? (custoTotalItem / qtd) : vUnCom;

                    itensLoteAtual.push({
                        id_local: Date.now() + i,
                        codigo: prod.getElementsByTagName('cProd')[0]?.textContent || '',
                        nome: prod.getElementsByTagName('xProd')[0]?.textContent || 'Desconhecido',
                        unidade: prod.getElementsByTagName('uCom')[0]?.textContent || 'UN',
                        quantidade: qtd.toFixed(2),
                        valor_unitario: custoUnitarioReal.toFixed(2),
                        data_validade: '',
                        estoque_minimo: 2
                    });
                }
                renderizarItensLoteNF();
                almoNotify('XML Lido!', 'Custo real calculado com sucesso.', 'success');
            } catch (err) { almoNotify('Erro', 'Erro ao processar a estrutura do XML.', 'error'); document.getElementById('movNF').value = ""; }
        };
        reader.readAsText(file);

    } else if (file.name.toLowerCase().endsWith('.pdf')) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = "";
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                fullText += textContent.items.map(item => item.str).join(" ") + " ";
            }
            const cleanText = fullText.replace(/\|/g, ' ').replace(/\s+/g, ' ');
            let fornecedor = "Fornecedor Desconhecido";
            const fMatch1 = cleanText.match(/Recebemos de\s+(.+?)\s+os produtos/i);
            const fMatch2 = cleanText.match(/^(.+?)\s+DANFE/i);
            if (fMatch1) fornecedor = fMatch1[1].trim();
            else if (fMatch2) fornecedor = fMatch2[1].trim();
            document.getElementById('movFornecedor').value = fornecedor;

            const nfMatch = cleanText.match(/N[ºo]?\s*([\d\.\s]{4,20})/i);
            if (nfMatch) {
                let numeroNF = nfMatch[1].replace(/[\.\s]/g, '');
                if (numeroNF.length > 9) numeroNF = numeroNF.substring(0, 9);
                document.getElementById('movNF').value = numeroNF;
            } else { document.getElementById('movNF').value = "PDF Importado"; }

            const regexItens = /(\d{4,12})\s+(.{1,150}?)\s+(\d{8})\s+(\d{3,4})\s+(\d{4})\s+([A-Z]{2,3})\s+([\d,\.]+)\s+([\d,\.]+)/gi;
            let match, index = 0;
            while ((match = regexItens.exec(cleanText)) !== null) {
                itensLoteAtual.push({
                    id_local: Date.now() + index,
                    codigo: match[1], nome: match[2].trim(), unidade: match[6],
                    quantidade: parseFloat(match[7].replace(/\./g, '').replace(',', '.')).toFixed(2),
                    valor_unitario: parseFloat(match[8].replace(/\./g, '').replace(',', '.')).toFixed(2),
                    data_validade: '', estoque_minimo: 2
                });
                index++;
            }
            if (itensLoteAtual.length > 0) { renderizarItensLoteNF(); almoNotify('PDF Lido!', 'Itens importados com sucesso.', 'success'); }
            else { almoNotify('Atenção', 'Não foi possível identificar os produtos neste layout de PDF. Solicite o XML.', 'warning'); }
        } catch (err) { console.error(err); almoNotify('Erro', 'Erro ao processar o PDF.', 'error'); }
    } else {
        almoNotify('Formato Inválido', 'Por favor, envie um arquivo .XML ou .PDF.', 'warning');
    }
};

window.renderizarItensLoteNF = function() {
    const tbody = document.getElementById('tabelaLoteNFBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (itensLoteAtual.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 15px; color: #94a3b8;">Nenhum item na nota.</td></tr>'; return; }
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
        `;
        tbody.appendChild(tr);
    });
};

window.adicionarLinhaLoteNF = function() {
    itensLoteAtual.push({ id_local: Date.now(), codigo: '', nome: '', unidade: 'UN', quantidade: 1, valor_unitario: 0, data_validade: '', estoque_minimo: 2 });
    renderizarItensLoteNF();
};

// ==================== CRUD PEÇAS ====================
window.abrirModalPeca = async function() {
    document.getElementById('formPeca').reset();
    document.getElementById('pecaId').value = '';
    document.getElementById('pecaValidade').value = '';
    document.getElementById('modalPecaTitulo').innerText = 'Nova Peça';
    await preencherSelectsCadastrosBasicos();
    document.getElementById('modalPeca').style.display = 'flex';
};

window.editarPeca = async function(peca) {
    await preencherSelectsCadastrosBasicos();
    document.getElementById('pecaId').value = peca.id;
    document.getElementById('pecaCodigo').value = peca.codigo;
    document.getElementById('pecaNome').value = peca.nome;
    document.getElementById('pecaUnidade').value = peca.unidade || 'UN';
    document.getElementById('pecaCategoria').value = peca.categoria || '';
    document.getElementById('pecaLocalizacao').value = peca.localizacao || '';
    document.getElementById('pecaQtd').value = peca.quantidade;
    document.getElementById('pecaEstoqueMin').value = peca.estoque_minimo;
    document.getElementById('pecaPreco').value = peca.preco_medio;
    document.getElementById('pecaValidade').value = peca.data_validade || '';
    document.getElementById('modalPecaTitulo').innerText = 'Editar Peça / Lote';
    document.getElementById('modalPeca').style.display = 'flex';
};

window.salvarPeca = async function(e) {
    e.preventDefault();
    const pecaInput = {
        codigo: document.getElementById('pecaCodigo').value.trim(),
        nome: document.getElementById('pecaNome').value.trim(),
        unidade: document.getElementById('pecaUnidade').value.trim().toUpperCase(),
        categoria: document.getElementById('pecaCategoria').value.trim().toUpperCase(),
        localizacao: document.getElementById('pecaLocalizacao').value.trim(),
        quantidade: parseFloat(document.getElementById('pecaQtd').value),
        estoque_minimo: parseFloat(document.getElementById('pecaEstoqueMin').value),
        preco_medio: parseFloat(document.getElementById('pecaPreco').value),
        data_validade: document.getElementById('pecaValidade').value || null
    };
    const id = document.getElementById('pecaId').value;
    const btnSubmit = e.target.querySelector('button[type="submit"]');
    if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...'; }

    try {
        if (id) {
            pecaInput.id = id;
            await db.upsertPeca(pecaInput);
        } else {
            const pInjetada = typeof window.injetarFilial === 'function' ? window.injetarFilial(pecaInput) : pecaInput;
            const { data, error } = await window.supabaseClient.from('almoxarifado_pecas').insert([pInjetada]).select();
            if (error) throw error;
            if (data && data.length > 0 && pecaInput.quantidade > 0) {
                const mov = typeof window.injetarFilial === 'function' ? window.injetarFilial({
                    peca_id: data[0].id, tipo: 'entrada', quantidade: pecaInput.quantidade,
                    valor_unitario: pecaInput.preco_medio, nota_fiscal: 'Entrada Manual Sist.',
                    fornecedor: 'Desconhecido', usuario: window.currentUser ? window.currentUser.username : 'Sistema',
                    data_movimentacao: new Date().toISOString()
                }) : {};
                await window.supabaseClient.from('almoxarifado_movimentacoes').insert([mov]);
            }
        }
        fecharModalAlmox('modalPeca');
        await carregarDadosAlmoxarifado();
        almoNotify('Salvo!', 'Peça gravada com sucesso.', 'success');
    } catch (err) { console.error(err); almoNotify('Erro', 'Erro ao gravar peça.', 'error'); }
    finally { if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.innerHTML = '<i class="fas fa-save"></i> Gravar Peça'; } }
};

window.deletarPeca = async function(id) {
    if (await almoConfirm('Excluir Peça?', 'Excluir esta peça pode afetar o histórico. Deseja continuar?')) {
        await db.deletePeca(id);
        await carregarDadosAlmoxarifado();
        almoNotify('Excluída', 'Peça removida do estoque.', 'success');
    }
};

// ==================== GESTÃO DE PNEUS ====================
window.abrirModalPneu = function() { document.getElementById('formPneu').reset(); document.getElementById('pneuId').value = ''; document.getElementById('modalPneu').style.display = 'flex'; };
window.editarPneu = function(pneu) {
    document.getElementById('pneuId').value = pneu.id;
    document.getElementById('pnFogo').value = pneu.num_fogo;
    document.getElementById('pnMarca').value = pneu.marca;
    document.getElementById('pnMedida').value = pneu.medida;
    document.getElementById('pnVida').value = pneu.vida;
    document.getElementById('pnCusto').value = pneu.custo_atual;
    document.getElementById('modalPneu').style.display = 'flex';
};
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
    if (id) pneu.id = id;
    if (typeof window.injetarFilial === 'function') pneu = window.injetarFilial(pneu);
    try {
        await window.supabaseClient.from('almoxarifado_pneus').upsert(pneu);
        fecharModalAlmox('modalPneu');
        await carregarDadosAlmoxarifado();
        almoNotify('Sucesso!', 'Pneu salvo com sucesso.', 'success');
    } catch (err) { almoNotify('Erro', 'Erro ao salvar pneu.', 'error'); }
};

window.abrirAcaoPneu = function(pneu) {
    document.getElementById('formAcaoPneu').reset();
    document.getElementById('acaoPneuId').value = pneu.id;
    document.getElementById('acaoPneuFogo').innerText = pneu.num_fogo;
    mudarFormAcaoPneu();
    document.getElementById('modalAcaoPneu').style.display = 'flex';
};
window.mudarFormAcaoPneu = function() {
    const acao = document.getElementById('acaoPneuTipo').value;
    document.getElementById('divAcaoInstalar').style.display = acao === 'instalar' ? 'block' : 'none';
    document.getElementById('divAcaoCusto').style.display = acao === 'recapagem' ? 'block' : 'none';
    ['acaoCavalo', 'acaoKm', 'acaoEixo', 'acaoPosicao'].forEach(id => { const el = document.getElementById(id); if (el) el.required = (acao === 'instalar'); });
};
window.executarAcaoPneu = async function(e) {
    e.preventDefault();
    const pneuId = document.getElementById('acaoPneuId').value, acao = document.getElementById('acaoPneuTipo').value;
    let updPneu = {}, hist = { pneu_id: pneuId, tipo: acao, observacao: document.getElementById('acaoObs').value };
    if (acao === 'instalar') { updPneu = { status: 'Rodando', cavalo_atual: document.getElementById('acaoCavalo').value.toUpperCase(), eixo: document.getElementById('acaoEixo').value, posicao: document.getElementById('acaoPosicao').value, km_instalacao: parseInt(document.getElementById('acaoKm').value) }; hist.cavalo = updPneu.cavalo_atual; hist.km_frota = updPneu.km_instalacao; }
    else if (acao === 'retirar') { updPneu = { status: 'Estoque', cavalo_atual: null, eixo: null, posicao: null }; }
    else if (acao === 'recapagem') { updPneu = { status: 'Recapagem', cavalo_atual: null, eixo: null, posicao: null }; const pneuVelho = pneusEstoque.find(p => p.id == pneuId); if (parseFloat(document.getElementById('acaoCustoExtra').value) > 0) updPneu.custo_atual = parseFloat(pneuVelho.custo_atual || 0) + parseFloat(document.getElementById('acaoCustoExtra').value); }
    else if (acao === 'sucata') { updPneu = { status: 'Sucata', cavalo_atual: null, eixo: null, posicao: null }; }

    if (typeof window.injetarFilial === 'function') hist = window.injetarFilial(hist);
    try {
        await window.supabaseClient.from('almoxarifado_pneus').update(updPneu).eq('id', pneuId);
        await window.supabaseClient.from('almoxarifado_pneus_mov').insert(hist);
        fecharModalAlmox('modalAcaoPneu');
        await carregarDadosAlmoxarifado();
        almoNotify('Sucesso!', 'Ação registrada no pneu.', 'success');
    } catch (err) { almoNotify('Erro', 'Erro ao executar ação no pneu.', 'error'); }
};

// ==================== GESTÃO DE KITS E AUTOCOMPLETE ====================
let timerPecasKitDebounce;
window.filtrarPecasKitDebounced = function(forcarMostrar = false) {
    clearTimeout(timerPecasKitDebounce);
    timerPecasKitDebounce = setTimeout(() => filtrarPecasKitExec(forcarMostrar), 250);
};

function filtrarPecasKitExec(forcarMostrar = false) {
    const input = document.getElementById('pesquisaPecaKit');
    const container = document.getElementById('listaPecasKitCustom');
    const btnLimpar = document.getElementById('btnLimparPesquisaKit');
    if (!input || !container) return;

    const termo = input.value.trim().toLowerCase();
    if (btnLimpar) btnLimpar.style.display = termo.length > 0 ? 'block' : 'none';
    if (termo.length === 0 && !forcarMostrar) { container.style.display = 'none'; return; }

    let filtradas = pecasEstoque.filter(p => termo === "" || (p.nome && p.nome.toLowerCase().includes(termo)) || (p.codigo && p.codigo.toLowerCase().includes(termo)));
    let msgLimite = '';
    if (filtradas.length > 50 && termo === "") {
        filtradas = filtradas.slice(0, 50);
        msgLimite = `<div style="padding:10px; text-align:center; color:#fbbf24; font-size:0.85rem; background:rgba(245, 158, 11, 0.1); border-bottom:1px solid #334155;">Mostrando as 50 primeiras peças. Digite para buscar.</div>`;
    }

    if (filtradas.length === 0) {
        container.innerHTML = '<div style="padding:15px; text-align:center; color:#94a3b8;">Nenhuma peça encontrada.</div>';
    } else {
        container.innerHTML = msgLimite + filtradas.map(x => `
            <div class="peca-item" onclick="selecionarPecaKitCustom(${x.id}, '${(x.nome || '').replace(/'/g, "\\'")}', '${x.codigo || ''}')">
                <div class="peca-item-info">
                    <span class="peca-item-nome">${x.nome}</span>
                    ${x.codigo ? `<span class="peca-item-codigo"><i class="fas fa-barcode"></i> ${x.codigo}</span>` : ''}
                </div>
                <div class="peca-item-estoque"><i class="fas fa-box"></i> ${x.quantidade} ${x.unidade || 'UN'}</div>
            </div>`).join('');
    }
    container.style.display = 'block';
}

window.selecionarPecaKitCustom = function(id, nome, codigo) {
    document.getElementById('kitPecaSelecionadaId').value = id;
    document.getElementById('pesquisaPecaKit').value = codigo ? `[${codigo}] ${nome}` : nome;
    document.getElementById('listaPecasKitCustom').style.display = 'none';
    document.getElementById('kitPecaQtd').focus();
    document.getElementById('kitPecaQtd').select();
};

window.limparPesquisaPecaKit = function() {
    document.getElementById('pesquisaPecaKit').value = '';
    document.getElementById('kitPecaSelecionadaId').value = '';
    document.getElementById('listaPecasKitCustom').style.display = 'none';
    document.getElementById('btnLimparPesquisaKit').style.display = 'none';
};

window.toggleListaPecasKit = function() {
    const container = document.getElementById('listaPecasKitCustom');
    if (container.style.display === 'block') container.style.display = 'none';
    else { document.getElementById('pesquisaPecaKit').focus(); filtrarPecasKitDebounced(true); }
};

document.addEventListener('click', function(e) {
    const fecharSeFora = (idInput, idList, idBtn) => {
        const inp = document.getElementById(idInput), list = document.getElementById(idList), btn = document.getElementById(idBtn);
        if (inp && list && e.target !== inp && !list.contains(e.target) && e.target !== btn && !(btn && btn.contains(e.target))) {
            list.style.display = 'none';
        }
    };
    fecharSeFora('pesquisaPecaKit', 'listaPecasKitCustom', 'btnMostrarListaKit');
    fecharSeFora('pesquisaPecaSaida', 'listaPecasSaidaCustom', 'btnMostrarListaSaida');
});

window.abrirModalKit = function() {
    document.getElementById('formKit').reset();
    document.getElementById('kitId').value = '';
    document.getElementById('modalKitTitulo').innerText = 'Montar Novo KIT';
    itensKitAtual = [];
    limparPesquisaPecaKit();
    renderizarItensKit();
    document.getElementById('modalKit').style.display = 'flex';
};

window.editarKit = function(kit) {
    document.getElementById('formKit').reset();
    document.getElementById('kitId').value = kit.id;
    document.getElementById('kitNome').value = kit.nome;
    document.getElementById('kitDescricao').value = kit.descricao || '';
    document.getElementById('modalKitTitulo').innerText = 'Editar KIT';
    try { itensKitAtual = typeof kit.itens === 'string' ? JSON.parse(kit.itens) : kit.itens; } catch (e) { itensKitAtual = []; }
    if (!Array.isArray(itensKitAtual)) itensKitAtual = [];
    limparPesquisaPecaKit();
    renderizarItensKit();
    document.getElementById('modalKit').style.display = 'flex';
};

window.adicionarPecaKit = function() {
    const pecaId = document.getElementById('kitPecaSelecionadaId').value;
    const qtd = parseFloat(document.getElementById('kitPecaQtd').value);
    if (!pecaId || isNaN(qtd) || qtd <= 0) { almoNotify('Atenção', 'Selecione uma peça e informe uma quantidade válida.', 'warning'); return; }
    const peca = pecasEstoque.find(p => p.id == pecaId);
    if (!peca) return;
    const existente = itensKitAtual.find(i => i.peca_id == pecaId);
    if (existente) existente.quantidade += qtd;
    else itensKitAtual.push({ peca_id: peca.id, codigo: peca.codigo, nome: peca.nome, quantidade: qtd });
    renderizarItensKit();
    limparPesquisaPecaKit();
    document.getElementById('kitPecaQtd').value = '1';
};

window.removerPecaKit = function(pecaId) {
    itensKitAtual = itensKitAtual.filter(i => i.peca_id != pecaId);
    renderizarItensKit();
};

window.renderizarItensKit = function() {
    const tbody = document.getElementById('tabelaKitItensBody');
    tbody.innerHTML = '';
    if (itensKitAtual.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 15px; color: #94a3b8;">Nenhuma peça adicionada ao KIT.</td></tr>'; return; }
    itensKitAtual.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color:#60a5fa;">${item.codigo || '-'}</td>
            <td style="color:#f8fafc;">${item.nome}</td>
            <td style="color:#cbd5e1; font-weight:bold;">${item.quantidade}</td>
            <td style="text-align: center;"><button type="button" class="btn-action-sm btn-delete" onclick="removerPecaKit(${item.peca_id})"><i class="fas fa-trash"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
};

window.salvarKit = async function(e) {
    e.preventDefault();
    if (itensKitAtual.length === 0) { almoNotify('Atenção', 'O KIT precisa ter pelo menos uma peça.', 'warning'); return; }
    const id = document.getElementById('kitId').value;
    let kitInput = { nome: document.getElementById('kitNome').value.trim(), descricao: document.getElementById('kitDescricao').value.trim(), itens: JSON.stringify(itensKitAtual) };
    if (id) kitInput.id = id;
    if (typeof window.injetarFilial === 'function') kitInput = window.injetarFilial(kitInput);
    try {
        await window.supabaseClient.from('almoxarifado_kits').upsert(kitInput);
        fecharModalAlmox('modalKit');
        await carregarDadosAlmoxarifado();
        almoNotify('Sucesso!', 'KIT salvo com sucesso.', 'success');
    } catch (err) { console.error(err); almoNotify('Erro', 'Erro ao salvar KIT.', 'error'); }
};

window.deletarKit = async function(id) {
    if (await almoConfirm('Excluir KIT?', 'Isso não afetará as movimentações passadas.')) {
        try {
            await window.supabaseClient.from('almoxarifado_kits').delete().eq('id', id);
            await carregarDadosAlmoxarifado();
            almoNotify('Excluído', 'KIT removido com sucesso.', 'success');
        } catch (e) { almoNotify('Erro', 'Erro ao excluir KIT.', 'error'); }
    }
};

window.abrirRequisitarKit = function(kit) {
    document.getElementById('formRequisitarKit').reset();
    document.getElementById('reqKitId').value = kit.id;
    document.getElementById('reqKitNome').innerText = kit.nome;
    document.getElementById('reqKitTipoSaida').value = 'frota';
    window.carregarCentrosCustoAlmox();
    toggleReqKitSaida();
    const inputOS = document.getElementById('reqKitOS');
    if (inputOS) {
        inputOS.onchange = async function() {
            const osId = inputOS.value.trim();
            const cavaloInput = document.getElementById('reqKitCavalo');
            if (!osId) { cavaloInput.value = ''; return; }
            cavaloInput.value = "Buscando Placa...";
            try {
                const { data } = await window.supabaseClient.from('ordens_servico').select('placa').eq('id', osId).maybeSingle();
                if (data && data.placa) { cavaloInput.value = data.placa; cavaloInput.style.color = '#10b981'; setTimeout(() => { cavaloInput.style.color = '#fff'; }, 2000); }
                else { cavaloInput.value = "OS NÃO ENCONTRADA"; }
            } catch (e) { cavaloInput.value = "ERRO AO BUSCAR"; }
        };
    }
    document.getElementById('modalRequisitarKit').style.display = 'flex';
};

window.toggleReqKitSaida = function() {
    const tipo = document.getElementById('reqKitTipoSaida').value;
    if (tipo === 'frota') {
        document.getElementById('reqKitFrotaDiv').style.display = 'flex'; document.getElementById('reqKitSetorDiv').style.display = 'none';
        document.getElementById('reqKitOS').required = true; document.getElementById('reqKitCentroCusto').required = false; document.getElementById('reqKitCentroCusto').value = '';
    } else {
        document.getElementById('reqKitFrotaDiv').style.display = 'none'; document.getElementById('reqKitSetorDiv').style.display = 'block';
        document.getElementById('reqKitOS').required = false; document.getElementById('reqKitCentroCusto').required = true; document.getElementById('reqKitCavalo').value = ''; document.getElementById('reqKitOS').value = '';
    }
};

window.confirmarRequisicaoKit = async function(e) {
    e.preventDefault();
    const kitId = document.getElementById('reqKitId').value;
    const kit = kitsEstoque.find(k => k.id == kitId);
    if (!kit) return;
    let itensParsed = [];
    try { itensParsed = typeof kit.itens === 'string' ? JSON.parse(kit.itens) : kit.itens; } catch (e) {}

    let errosEstoque = [];
    itensParsed.forEach(itemKit => {
        const pecaReal = pecasEstoque.find(p => p.id == itemKit.peca_id);
        if (!pecaReal || pecaReal.quantidade < itemKit.quantidade) {
            errosEstoque.push(`${itemKit.nome} (Falta: ${(itemKit.quantidade - (pecaReal ? pecaReal.quantidade : 0)).toFixed(2)})`);
        }
    });
    if (errosEstoque.length > 0) {
        almoNotify('Estoque Insuficiente', errosEstoque.join('\n'), 'warning');
        return;
    }

    const btnSubmit = document.getElementById('btnConfirmarReqKit');
    btnSubmit.disabled = true; btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';

    const tipoSaidaDestino = document.getElementById('reqKitTipoSaida').value;
    let cavaloVal = null, setorVal = null, osVal = null;
    if (tipoSaidaDestino === 'frota') {
        osVal = document.getElementById('reqKitOS').value;
        cavaloVal = document.getElementById('reqKitCavalo').value.toUpperCase();
        if (!cavaloVal || cavaloVal === "OS NÃO ENCONTRADA") {
            almoNotify('Atenção', 'OS inválida.', 'warning');
            btnSubmit.disabled = false; btnSubmit.innerHTML = '<i class="fas fa-check-double"></i> Confirmar Saída do KIT';
            return;
        }
    } else {
        setorVal = document.getElementById('reqKitCentroCusto').value;
    }

    try {
        for (const itemKit of itensParsed) {
            const pecaReal = pecasEstoque.find(p => p.id == itemKit.peca_id);
            await db.addMovimentacao({
                peca_id: itemKit.peca_id, tipo: 'saida', quantidade: itemKit.quantidade,
                valor_unitario: pecaReal.preco_medio, cavalo: cavaloVal, setor_destino: setorVal,
                os_id: osVal, usuario: window.currentUser ? window.currentUser.username : 'Sistema',
                data_movimentacao: new Date().toISOString()
            });
        }
        fecharModalAlmox('modalRequisitarKit');
        await carregarDadosAlmoxarifado();
        almoNotify('Sucesso!', 'Requisição de KIT concluída.', 'success');
    } catch (err) { console.error(err); almoNotify('Erro', 'Erro ao requisitar o KIT.', 'error'); }
    finally { btnSubmit.disabled = false; btnSubmit.innerHTML = '<i class="fas fa-check-double"></i> Confirmar Saída do KIT'; }
};

window.fecharModalAlmox = function(id) { document.getElementById(id).style.display = 'none'; };

// ==================== EXPORTAÇÕES EXCEL / CSV ====================
function baixarCSV(nomeArquivo, cabecalhos, linhas) {
    const bom = '\uFEFF';
    const csv = [cabecalhos.join(';'), ...linhas.map(l => l.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'))].join('\n');
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nomeArquivo;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
}

window.exportarEstoqueExcel = function() {
    const linhas = listaPecasAtual.map(p => [
        p.codigo || '-', p.nome, p.categoria || '-', p.unidade || 'UN', p.curva || 'C',
        p.localizacao || '-', p.data_validade || '-', parseFloat(p.quantidade || 0).toFixed(2).replace('.', ','),
        parseFloat(p.estoque_minimo || 0).toFixed(2).replace('.', ','),
        parseFloat(p.preco_medio || 0).toFixed(2).replace('.', ','),
        (parseFloat(p.quantidade || 0) * parseFloat(p.preco_medio || 0)).toFixed(2).replace('.', ',')
    ]);
    baixarCSV(`Estoque_Almoxarifado_${new Date().toISOString().slice(0, 10)}.csv`,
        ['Codigo', 'Descricao', 'Categoria', 'Unidade', 'Curva ABC', 'Localizacao', 'Validade', 'Qtd Atual', 'Minimo', 'Preco Medio', 'Valor Total'], linhas);
};

window.exportarSugestaoComprasExcel = function() {
    const baixos = pecasEstoque.filter(p => parseFloat(p.quantidade || 0) <= parseFloat(p.estoque_minimo || 0));
    const linhas = baixos.map(p => {
        const qtd = parseFloat(p.quantidade || 0), min = parseFloat(p.estoque_minimo || 0), preco = parseFloat(p.preco_medio || 0);
        const sug = Math.max(1, (min * 2) - qtd);
        return [p.codigo || '-', p.nome, p.categoria || '-', p.curva || 'C', qtd.toFixed(2).replace('.', ','), min.toFixed(2).replace('.', ','), sug.toFixed(2).replace('.', ','), preco.toFixed(2).replace('.', ','), (sug * preco).toFixed(2).replace('.', ',')];
    });
    baixarCSV(`Sugestao_Compras_${new Date().toISOString().slice(0, 10)}.csv`,
        ['Codigo', 'Descricao', 'Categoria', 'Curva', 'Qtd Atual', 'Estoque Minimo', 'Qtd Sugerida', 'Preco Medio', 'Custo Estimado'], linhas);
};

window.exportarMovimentacoesExcel = function() {
    const linhas = listaMovAtual.map(m => {
        const peca = pecasEstoque.find(p => String(p.id) === String(m.peca_id));
        return [
            new Date(m.data_movimentacao).toLocaleString('pt-BR'), m.usuario || 'Sistema', m.tipo.toUpperCase(),
            peca ? peca.nome : 'Excluida', m.quantidade, parseFloat(m.valor_unitario || 0).toFixed(2).replace('.', ','),
            m.nota_fiscal || '-', m.cavalo || m.setor_destino || m.fornecedor || m.observacao || '-'
        ];
    });
    baixarCSV(`Historico_Almoxarifado_${new Date().toISOString().slice(0, 10)}.csv`,
        ['Data Hora', 'Usuario', 'Tipo', 'Peca', 'Quantidade', 'Valor Unit', 'NF / Motivo', 'Destino / Fornecedor'], linhas);
};

window.exportarPneusExcel = function() {
    const linhas = pneusEstoque.map(p => [
        p.num_fogo, p.marca, p.medida, p.status, p.vida === 0 ? 'Novo' : p.vida + 'a Recap',
        parseFloat(p.custo_atual || 0).toFixed(2).replace('.', ','), p.cavalo_atual || 'Almoxarifado', p.eixo || '-', p.posicao || '-'
    ]);
    baixarCSV(`Gestao_Pneus_${new Date().toISOString().slice(0, 10)}.csv`,
        ['N Fogo', 'Marca', 'Medida', 'Status', 'Vida', 'Custo Total', 'Frota / Local', 'Eixo', 'Posicao'], linhas);
};

// ==================== LÓGICA DO QR CODE ====================
window.qrModoAtual = null;
window.qrPecaAtual = null;

window.imprimirQRCode = function(peca) {
    if (!peca.codigo) { almoNotify('Sem Código', 'Esta peça não possui um código/SKU cadastrado para gerar o QR Code!', 'warning'); return; }
    window.qrModoAtual = 'unico';
    window.qrPecaAtual = peca;
    document.getElementById('modalQrTitulo').innerHTML = '<i class="fas fa-qrcode" style="color:#8b5cf6;"></i> Imprimir QR Code (Único)';
    document.getElementById('qrItemUnicoContainer').style.display = 'block';
    document.getElementById('qrItemNome').innerText = peca.nome;
    document.getElementById('qrItemCodigo').innerText = peca.codigo;
    if (document.getElementById('qrFiltroCategoriaContainer')) document.getElementById('qrFiltroCategoriaContainer').style.display = 'none';
    document.getElementById('modalQr').style.display = 'flex';
};

window.abrirModalQrLote = function() {
    if (!pecasEstoque || pecasEstoque.length === 0) { almoNotify('Atenção', 'Não há peças cadastradas para gerar em lote.', 'warning'); return; }
    window.qrModoAtual = 'lote';
    window.qrPecaAtual = null;
    document.getElementById('modalQrTitulo').innerHTML = '<i class="fas fa-qrcode" style="color:#8b5cf6;"></i> Imprimir QR Codes (Em Lote)';
    document.getElementById('qrItemUnicoContainer').style.display = 'none';
    const selectCat = document.getElementById('qrCategoriaFiltro');
    if (selectCat) {
        const categorias = [...new Set(pecasEstoque.map(p => p.categoria).filter(Boolean))].sort();
        selectCat.innerHTML = '<option value="">Todas as Categorias</option>' + categorias.map(c => `<option value="${c}">${c}</option>`).join('');
        selectCat.value = '';
    }
    if (document.getElementById('qrFiltroCategoriaContainer')) document.getElementById('qrFiltroCategoriaContainer').style.display = 'block';
    document.getElementById('modalQr').style.display = 'flex';
};

window.executarGeracaoQr = function() {
    const tamanho = document.getElementById('qrTamanho').value;
    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) { almoNotify('Pop-up Bloqueado', 'Permita os pop-ups no navegador para imprimir as etiquetas.', 'warning'); return; }
    
    let html = `<html><head><title>Etiquetas QR Code</title>
    <style>
        body { font-family: sans-serif; text-align: center; display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; padding: 20px; background: #fff; color: #000; } 
        .etiqueta { border: 2px dashed #000; padding: 20px; display: inline-block; border-radius: 8px; page-break-inside: avoid; background: #fff; min-width: 250px; } 
        .titulo { font-size: 16px; font-weight: bold; margin-bottom: 15px; max-width: 100%; word-wrap: break-word; margin-left: auto; margin-right: auto; } 
        .codigo { font-size: 22px; margin: 10px 0; font-family: monospace; font-weight: bold; }
        .local { font-size: 14px; }
        @media print { body { padding: 0; } }
    </style></head><body>`;

    const gerarHtmlEtiqueta = (peca, size) => {
        if (!peca.codigo) return '';
        const qrUrl = `[https://api.qrserver.com/v1/create-qr-code/?size=$](https://api.qrserver.com/v1/create-qr-code/?size=$){size}x${size}&data=${encodeURIComponent(peca.codigo)}`;
        return `<div class="etiqueta">
            <div class="titulo">${peca.nome}</div>
            <img src="${qrUrl}" alt="QR Code" width="${size}" height="${size}" style="border: 1px solid #ccc; padding: 5px; border-radius: 5px;">
            <div class="codigo">${peca.codigo}</div>
            <div class="local">📍 Local: ${peca.localizacao || 'S/N'}</div>
        </div>`;
    };

    if (window.qrModoAtual === 'unico') {
        html += gerarHtmlEtiqueta(window.qrPecaAtual, tamanho);
    } else if (window.qrModoAtual === 'lote') {
        const catFiltro = document.getElementById('qrCategoriaFiltro') ? document.getElementById('qrCategoriaFiltro').value : '';
        let pecasComCodigo = pecasEstoque.filter(p => p.codigo && p.codigo.trim() !== '');
        if (catFiltro !== '') pecasComCodigo = pecasComCodigo.filter(p => p.categoria === catFiltro);
        if (pecasComCodigo.length === 0) {
            win.close();
            almoNotify('Atenção', 'Nenhuma peça com código/SKU foi encontrada na categoria selecionada.', 'warning');
            return;
        }
        pecasComCodigo.forEach(peca => { html += gerarHtmlEtiqueta(peca, tamanho); });
    }

    html += `<script>setTimeout(() => { window.print(); window.close(); }, 1500);<\/script></body></html>`;
    win.document.write(html);
    win.document.close();
    fecharModalAlmox('modalQr');
};