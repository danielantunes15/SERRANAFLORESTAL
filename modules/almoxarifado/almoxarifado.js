// ==================== js/almoxarifado.js ====================
let pecasEstoque = [];
let movimentacoesEstoque = [];
let pneusEstoque = [];

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
        }

        atualizarTabelaPecas(pecasEstoque);
        atualizarTabelaMovimentacoes(movimentacoesEstoque);
        atualizarTabelaNotas(movimentacoesEstoque);
        atualizarTabelaPneus(pneusEstoque);
        
        atualizarKPIsAlmoxarifado();
    } catch (e) { console.error("Erro ao carregar almoxarifado", e); }
}

async function preencherSelectsCadastrosBasicos() {
    if(!window.supabaseClient) return;
    try {
        let query = window.supabaseClient.from('almoxarifado_cadastros').select('*');
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
        const {data} = await query;
        
        const unidades = data ? data.filter(d => d.tipo === 'UNIDADE') : [];
        const locais = data ? data.filter(d => d.tipo === 'LOCALIZACAO') : [];
        const categorias = data ? data.filter(d => d.tipo === 'CATEGORIA') : [];
        
        const preencher = (id, lista) => {
            const sel = document.getElementById(id);
            if(!sel) return;
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

function atualizarTabelaPecas(listaPecas) {
    const tbody = document.getElementById('tabelaPecasBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if(listaPecas.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhuma peça encontrada.</td></tr>'; 
        return; 
    }

    let valorTotalGlobal = 0;

    const itensProcessados = listaPecas.map(peca => {
        let qtd = parseFloat(peca.quantidade) || 0;
        let preco = parseFloat(peca.preco_medio || 0);
        let valTotal = qtd * preco;
        valorTotalGlobal += valTotal;
        return { ...peca, valor_total: valTotal, quantidade_numerica: qtd };
    });

    itensProcessados.sort((a,b) => b.valor_total - a.valor_total);

    let somaAcumulada = 0;

    itensProcessados.forEach(peca => {
        somaAcumulada += peca.valor_total;
        let perc = (somaAcumulada / (valorTotalGlobal || 1)) * 100;
        peca.curva = perc <= 80 ? 'A' : (perc <= 95 ? 'B' : 'C');

        const min = parseFloat(peca.estoque_minimo) || 0;
        const estaBaixo = peca.quantidade_numerica <= min;
        const statusHtml = estaBaixo ? `<span class="badge badge-alert"><i class="fas fa-exclamation-circle"></i> Baixo</span>` : `<span class="badge badge-ok"><i class="fas fa-check"></i> Normal</span>`;
        
        let validadeDestaque = '-';
        if (peca.data_validade) {
            const [ano, mes, dia] = peca.data_validade.split('-');
            validadeDestaque = `${dia}/${mes}/${ano}`;
        }

        const tr = document.createElement('tr');
        tr.style.backgroundColor = 'rgba(255,255,255,0.02)';
        tr.innerHTML = `
            <td style="font-family: monospace; color: #60a5fa; font-weight:bold;">${peca.codigo || '-'}</td>
            <td><strong style="color: #f8fafc;">${peca.nome}</strong></td>
            <td><span style="color:#cbd5e1; font-size:0.85rem; background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px; border: 1px solid #334155;">${peca.categoria || '-'}</span></td>
            <td style="color: #cbd5e1; font-weight: bold;">${peca.unidade || 'UN'}</td>
            <td><span class="badge badge-abc-${peca.curva}">${peca.curva}</span></td>
            <td style="color: #94a3b8;"><i class="fas fa-map-marker-alt" style="font-size:0.8rem;"></i> ${peca.localizacao || '-'}</td>
            <td style="color: #94a3b8;">${validadeDestaque}</td>
            <td style="font-size: 1.1rem; font-weight: bold; ${estaBaixo ? 'color: #f87171;' : 'color: #34d399;'}">${peca.quantidade_numerica.toFixed(2)}</td>
            <td style="color: #94a3b8;">${min}</td>
            <td style="font-weight: 500; color: #f8fafc;">R$ ${parseFloat(peca.preco_medio||0).toFixed(2).replace('.', ',')}</td>
            <td>${statusHtml}</td>
            <td style="text-align: right; display: flex; gap: 5px; justify-content: flex-end;">
                <button type="button" title="Imprimir Etiqueta" class="btn-action-sm" style="background:#8b5cf6;" onclick='imprimirQRCode(${JSON.stringify(peca).replace(/'/g, "&apos;")})'><i class="fas fa-qrcode"></i></button>
                <button type="button" title="Editar" class="btn-action-sm btn-edit" onclick='editarPeca(${JSON.stringify(peca).replace(/'/g, "&apos;")})'><i class="fas fa-pen"></i></button> 
                <button type="button" title="Excluir" class="btn-action-sm btn-delete" onclick='deletarPeca(${peca.id})'><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function atualizarTabelaNotas(listaMovimentacoes) {
    const tbody = document.getElementById('tabelaNotasBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const entradas = listaMovimentacoes.filter(m => m.tipo === 'entrada' && m.nota_fiscal && m.nota_fiscal !== '-');
    if(entradas.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhuma nota fiscal registrada.</td></tr>'; 
        return; 
    }

    const gruposNotas = {};
    entradas.forEach(mov => {
        const dataMinuto = new Date(mov.data_movimentacao).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const dataSegundos = new Date(mov.data_movimentacao).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        let chave = '';
        if (mov.nota_fiscal === 'Entrada Manual Sist.') {
            chave = `manual_${mov.id || dataSegundos}`;
        } else {
            chave = `${mov.nota_fiscal}_${mov.fornecedor}_${mov.usuario}_${dataMinuto}`;
        }
        
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

    const listaAgrupada = Object.values(gruposNotas).sort((a, b) => new Date(b.data) - new Date(a.data));

    listaAgrupada.forEach(nota => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color: #94a3b8; font-size: 0.85rem;"><i class="fas fa-clock"></i> ${nota.data_formatada}</td>
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
    let valorTotalEstoque = 0;

    const itens = pecasEstoque.map(p => {
        let valTotal = parseFloat(p.quantidade || 0) * parseFloat(p.preco_medio || 0);
        valorTotalEstoque += valTotal;
        if (parseFloat(p.quantidade || 0) <= parseFloat(p.estoque_minimo || 0)) itensBaixos++;
        return { ...p, valor_total: valTotal };
    });
    
    itens.sort((a, b) => b.valor_total - a.valor_total);

    let somaAcumulada = 0;
    itens.forEach(p => {
        somaAcumulada += p.valor_total;
        let percentual = (somaAcumulada / (valorTotalEstoque || 1)) * 100;
        let curva = percentual <= 80 ? 'A' : (percentual <= 95 ? 'B' : 'C');
        
        abcData[curva].qtd++;
        abcData[curva].val += p.valor_total;
        valorTotal += p.valor_total;
    });

    pneusEstoque.forEach(pneu => valorTotal += parseFloat(pneu.custo_atual || 0));

    document.getElementById('kpiTotalItens').innerText = pecasEstoque.length; 
    document.getElementById('kpiEstoqueMinimo').innerText = itensBaixos;
    document.getElementById('kpiValorTotal').innerText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal);
    document.getElementById('kpiPneusResumo').innerText = `${pneusEstoque.filter(p => p.status === 'Rodando').length} / ${pneusEstoque.filter(p => p.status === 'Estoque').length}`;
}

window.filtrarAlmoxarifado = function() {
    const termo = document.getElementById('almoSearchInput').value.toLowerCase();
    if (abaAtualAlmox === 'estoque') atualizarTabelaPecas(pecasEstoque.filter(p => (p.nome||'').toLowerCase().includes(termo) || (p.codigo||'').toLowerCase().includes(termo) || (p.categoria||'').toLowerCase().includes(termo)));
    else if (abaAtualAlmox === 'notas') atualizarTabelaNotas(movimentacoesEstoque.filter(m => (m.nota_fiscal||'').toLowerCase().includes(termo) || (m.fornecedor||'').toLowerCase().includes(termo) || (m.usuario||'').toLowerCase().includes(termo)));
    else if (abaAtualAlmox === 'movimentacoes') atualizarTabelaMovimentacoes(movimentacoesEstoque.filter(m => (m.nota_fiscal||'').toLowerCase().includes(termo) || (m.fornecedor||'').toLowerCase().includes(termo) || (m.cavalo||'').toLowerCase().includes(termo) || (m.setor_destino||'').toLowerCase().includes(termo) || (m.usuario||'').toLowerCase().includes(termo)));
    else if (abaAtualAlmox === 'pneus') atualizarTabelaPneus(pneusEstoque.filter(p => (p.num_fogo||'').toLowerCase().includes(termo) || (p.cavalo_atual||'').toLowerCase().includes(termo)));
}

window.mudarAbaAlmoxarifado = function(abaId, btn) {
    abaAtualAlmox = abaId;
    document.querySelectorAll('.almo-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['estoque','notas','movimentacoes','pneus'].forEach(id => {
        const element = document.getElementById('aba'+id.charAt(0).toUpperCase() + id.slice(1));
        if(element) element.style.display = (id === abaId ? 'block' : 'none');
    });
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
    select.innerHTML = '<option value="">-- Selecione um lote/peça --</option>';
    pecasEstoque.forEach(p => {
        let txtValidade = p.data_validade ? ` | Val: ${p.data_validade.split('-').reverse().join('/')}` : '';
        let nomeExib = `${p.codigo ? '['+p.codigo+'] ' : ''}${p.nome} (Qtd: ${p.quantidade} ${p.unidade||'UN'}${txtValidade})`;
        select.innerHTML += `<option value="${p.id}">${nomeExib}</option>`;
    });
    if(idElemento === 'movPecaId') select.onchange = function() { 
        const p = pecasEstoque.find(x => x.id == this.value); 
        if(p) document.getElementById('movValor').value = p.preco_medio; 
    };
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
            alert("Entrada registrada com sucesso!");
            
        } else if (tipo === 'saida') {
            const peca_id = document.getElementById('movPecaId').value;
            const qtd = parseFloat(document.getElementById('movQuantidade').value);
            const peca = pecasEstoque.find(p => p.id == peca_id);
            if (!peca || qtd > peca.quantidade) { alert(`Estoque insuficiente! Lote escolhido tem: ${peca ? peca.quantidade : 0}.`); throw new Error("Estoque baixo"); }

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
                alert(`Leitura Concluída! Custo real calculado com sucesso.`);
            } catch (err) { alert("Erro ao processar a estrutura do XML."); document.getElementById('movNF').value = ""; }
        };
        reader.readAsText(file);

    } else if (file.name.toLowerCase().endsWith('.pdf')) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await window.pdfjsLib.getDocument({data: arrayBuffer}).promise;
            
            let fullText = "";
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(" ");
                fullText += pageText + " ";
            }

            const cleanText = fullText.replace(/\|/g, ' ').replace(/\s+/g, ' ');

            let fornecedor = "Fornecedor Desconhecido";
            const fornecedorMatch1 = cleanText.match(/Recebemos de\s+(.+?)\s+os produtos/i);
            const fornecedorMatch2 = cleanText.match(/^(.+?)\s+DANFE/i);
            
            if (fornecedorMatch1) fornecedor = fornecedorMatch1[1].trim();
            else if (fornecedorMatch2) fornecedor = fornecedorMatch2[1].trim();
            document.getElementById('movFornecedor').value = fornecedor;

            const nfMatch = cleanText.match(/N[ºo]?\s*([\d\.\s]{4,20})/i);
            if (nfMatch) {
                let numeroNF = nfMatch[1].replace(/[\.\s]/g, '');
                if (numeroNF.length > 9) numeroNF = numeroNF.substring(0, 9);
                document.getElementById('movNF').value = numeroNF;
            } else { document.getElementById('movNF').value = "PDF Importado"; }

            const regexItens = /(\d{4,12})\s+(.{1,150}?)\s+(\d{8})\s+(\d{3,4})\s+(\d{4})\s+([A-Z]{2,3})\s+([\d,\.]+)\s+([\d,\.]+)/gi;
            
            let match; let index = 0;
            while ((match = regexItens.exec(cleanText)) !== null) {
                const codigo = match[1]; const nome = match[2].trim(); const unidade = match[6];
                
                const qtdStr = match[7].replace(/\./g, '').replace(',', '.');
                const valorUnitStr = match[8].replace(/\./g, '').replace(',', '.');

                itensLoteAtual.push({
                    id_local: Date.now() + index,
                    codigo: codigo, nome: nome, unidade: unidade,
                    quantidade: parseFloat(qtdStr).toFixed(2),
                    valor_unitario: parseFloat(valorUnitStr).toFixed(2),
                    data_validade: '', estoque_minimo: 2
                });
                index++;
            }

            if (itensLoteAtual.length > 0) { renderizarItensLoteNF(); alert(`PDF lido com sucesso!`); } 
            else { alert("Não foi possível identificar os produtos neste layout de PDF. Solicite o XML."); }

        } catch (err) { console.error("Erro na leitura do PDF:", err); alert("Erro ao processar o PDF."); }
    } else { alert("Formato não suportado. Por favor, envie um arquivo .XML ou .PDF."); }
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

window.abrirModalPeca = async function() {
    document.getElementById('formPeca').reset();
    document.getElementById('pecaId').value = '';
    document.getElementById('pecaValidade').value = '';
    document.getElementById('modalPecaTitulo').innerText = 'Nova Peça';
    
    await preencherSelectsCadastrosBasicos();
    
    document.getElementById('modalPeca').style.display = 'flex';
}

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
}

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
    if(btnSubmit) { btnSubmit.disabled = true; btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...'; }

    try {
        if (id) {
            pecaInput.id = id;
            await db.upsertPeca(pecaInput);
        } else {
            const pInjetada = typeof window.injetarFilial === 'function' ? window.injetarFilial(pecaInput) : pecaInput;
            const { data, error } = await window.supabaseClient.from('almoxarifado_pecas').insert([pInjetada]).select();
            if(error) throw error;
            
            if (data && data.length > 0 && pecaInput.quantidade > 0) {
                const mov = typeof window.injetarFilial === 'function' ? window.injetarFilial({
                    peca_id: data[0].id, 
                    tipo: 'entrada', 
                    quantidade: pecaInput.quantidade, 
                    valor_unitario: pecaInput.preco_medio,
                    nota_fiscal: 'Entrada Manual Sist.', 
                    fornecedor: 'Desconhecido',
                    usuario: window.currentUser ? window.currentUser.username : 'Sistema', 
                    data_movimentacao: new Date().toISOString()
                }) : {};
                await window.supabaseClient.from('almoxarifado_movimentacoes').insert([mov]);
            }
        }
        fecharModalAlmox('modalPeca'); await carregarDadosAlmoxarifado();
    } catch (err) { console.error(err); alert("Erro ao gravar peça."); } 
    finally { if(btnSubmit) { btnSubmit.disabled = false; btnSubmit.innerHTML = '<i class="fas fa-save"></i> Gravar Peça'; } }
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

    try { await window.supabaseClient.from('almoxarifado_pneus').upsert(pneu); fecharModalAlmox('modalPneu'); await carregarDadosAlmoxarifado(); alert("Sucesso!"); } catch(err) { alert("Erro"); }
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
    ['acaoCavalo','acaoKm','acaoEixo','acaoPosicao'].forEach(id => { const el = document.getElementById(id); if(el) el.required = (acao === 'instalar'); });
}
window.executarAcaoPneu = async function(e) {
    e.preventDefault();
    const pneuId = document.getElementById('acaoPneuId').value, acao = document.getElementById('acaoPneuTipo').value;
    let updPneu = {}, hist = { pneu_id: pneuId, tipo: acao, observacao: document.getElementById('acaoObs').value };
    
    if(acao === 'instalar') { updPneu = { status: 'Rodando', cavalo_atual: document.getElementById('acaoCavalo').value.toUpperCase(), eixo: document.getElementById('acaoEixo').value, posicao: document.getElementById('acaoPosicao').value, km_instalacao: parseInt(document.getElementById('acaoKm').value) }; hist.cavalo = updPneu.cavalo_atual; hist.km_frota = updPneu.km_instalacao; }
    else if(acao === 'retirar') { updPneu = { status: 'Estoque', cavalo_atual: null, eixo: null, posicao: null }; }
    else if(acao === 'recapagem') { updPneu = { status: 'Recapagem', cavalo_atual: null, eixo: null, posicao: null }; const pneuVelho = pneusEstoque.find(p => p.id == pneuId); if(parseFloat(document.getElementById('acaoCustoExtra').value) > 0) updPneu.custo_atual = parseFloat(pneuVelho.custo_atual || 0) + parseFloat(document.getElementById('acaoCustoExtra').value); }
    else if(acao === 'sucata') { updPneu = { status: 'Sucata', cavalo_atual: null, eixo: null, posicao: null }; }

    if (typeof window.injetarFilial === 'function') hist = window.injetarFilial(hist);
    try { await window.supabaseClient.from('almoxarifado_pneus').update(updPneu).eq('id', pneuId); await window.supabaseClient.from('almoxarifado_pneus_mov').insert(hist); fecharModalAlmox('modalAcaoPneu'); await carregarDadosAlmoxarifado(); alert("Sucesso!"); } catch(err) { alert("Erro"); }
}

window.fecharModalAlmox = function(id) { document.getElementById(id).style.display = 'none'; }

// ================= LÓGICA DO QR CODE (ATUALIZADA E REDIMENSIONADA) =================
window.qrModoAtual = null;
window.qrPecaAtual = null;

window.imprimirQRCode = function(peca) {
    if (!peca.codigo) { alert("Esta peça não possui um código/SKU cadastrado para gerar o QR Code!"); return; }
    window.qrModoAtual = 'unico';
    window.qrPecaAtual = peca;
    document.getElementById('modalQrTitulo').innerHTML = '<i class="fas fa-qrcode" style="color:#8b5cf6;"></i> Imprimir QR Code (Único)';
    document.getElementById('qrItemUnicoContainer').style.display = 'block';
    document.getElementById('qrItemNome').innerText = peca.nome;
    document.getElementById('qrItemCodigo').innerText = peca.codigo;
    
    // Esconde o filtro de categoria por que vai imprimir só um
    if (document.getElementById('qrFiltroCategoriaContainer')) {
        document.getElementById('qrFiltroCategoriaContainer').style.display = 'none';
    }

    document.getElementById('modalQr').style.display = 'flex';
}

window.abrirModalQrLote = function() {
    if (!pecasEstoque || pecasEstoque.length === 0) { alert("Não há peças cadastradas para gerar em lote."); return; }
    window.qrModoAtual = 'lote';
    window.qrPecaAtual = null;
    document.getElementById('modalQrTitulo').innerHTML = '<i class="fas fa-qrcode" style="color:#8b5cf6;"></i> Imprimir QR Codes (Em Lote)';
    document.getElementById('qrItemUnicoContainer').style.display = 'none';

    // Popula o select com as categorias dinamicamente
    const selectCat = document.getElementById('qrCategoriaFiltro');
    if (selectCat) {
        const categorias = [...new Set(pecasEstoque.map(p => p.categoria).filter(Boolean))].sort();
        selectCat.innerHTML = '<option value="">Todas as Categorias</option>' + 
            categorias.map(c => `<option value="${c}">${c}</option>`).join('');
        selectCat.value = '';
    }
    
    // Mostra o container do filtro
    if (document.getElementById('qrFiltroCategoriaContainer')) {
        document.getElementById('qrFiltroCategoriaContainer').style.display = 'block';
    }

    document.getElementById('modalQr').style.display = 'flex';
}

window.executarGeracaoQr = function() {
    const tamanho = document.getElementById('qrTamanho').value;
    const win = window.open('', '_blank', 'width=800,height=600');
    
    if (!win) {
        alert("O navegador bloqueou a janela de impressão. Por favor, permita os pop-ups para este site.");
        return;
    }
    
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
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(peca.codigo)}`;
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
        
        // Aplica o filtro de categoria
        if (catFiltro !== '') {
            pecasComCodigo = pecasComCodigo.filter(p => p.categoria === catFiltro);
        }

        if(pecasComCodigo.length === 0) {
            win.close();
            alert("Nenhuma peça com código/SKU foi encontrada na categoria selecionada.");
            return;
        }
        pecasComCodigo.forEach(peca => {
            html += gerarHtmlEtiqueta(peca, tamanho);
        });
    }

    html += `<script>setTimeout(() => { window.print(); window.close(); }, 1500);</script></body></html>`;
    
    win.document.write(html);
    win.document.close();
    fecharModalAlmox('modalQr');
}