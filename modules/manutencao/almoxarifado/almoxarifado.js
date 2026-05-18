// ==================== js/almoxarifado.js ====================

let pecasEstoque = [];
let movimentacoesEstoque = [];
let pneusEstoque = [];
let requisicoesEstoque = []; // Novo cache de requisições da oficina
let abaAtualAlmox = 'estoque'; 

// Controle do Lote de Entrada NF
let itensLoteAtual = [];

window.renderizarAlmoxarifado = async function() {
    await carregarDadosAlmoxarifado();
};

async function carregarDadosAlmoxarifado() {
    try {
        pecasEstoque = await db.getPecas();
        movimentacoesEstoque = await db.getMovimentacoesEstoque();
        
        if (window.supabaseClient) {
            // Pneus
            const { data: pneus } = await window.supabaseClient.from('almoxarifado_pneus').select('*').order('created_at', { ascending: false });
            pneusEstoque = pneus || [];
            
            // Requisições
            const { data: reqs } = await window.supabaseClient
                .from('os_pecas_utilizadas')
                .select('*, almoxarifado_pecas(nome, codigo), ordens_servico(placa, mecanico_responsavel)')
                .order('id', { ascending: false })
                .limit(100);
            requisicoesEstoque = reqs || [];
        }

        classificarCurvaABC(pecasEstoque);

        atualizarTabelaPecas(pecasEstoque);
        atualizarTabelaMovimentacoes(movimentacoesEstoque);
        atualizarTabelaPneus(pneusEstoque);
        atualizarTabelaRequisicoes(requisicoesEstoque);
        
        atualizarKPIsAlmoxarifado();
        gerarRelatorioCustoFrota();
    } catch (e) {
        console.error("Erro ao carregar almoxarifado", e);
    }
}

// ============== LÓGICA DE CURVA ABC ==============
function classificarCurvaABC(lista) {
    let valorTotalEstoque = 0;
    lista.forEach(p => { 
        p.valor_total = p.quantidade * p.preco_medio; 
        valorTotalEstoque += p.valor_total; 
    });
    
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

// ============== ATUALIZAÇÃO DE TABELAS ==============
function atualizarTabelaPecas(listaPecas) {
    const tbody = document.getElementById('tabelaPecasBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if(listaPecas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhuma peça encontrada.</td></tr>';
        return;
    }

    listaPecas.forEach(peca => {
        const estaBaixo = peca.quantidade <= peca.estoque_minimo;
        const statusHtml = estaBaixo 
            ? `<span class="badge badge-alert"><i class="fas fa-exclamation-circle"></i> Baixo</span>` 
            : `<span class="badge badge-ok"><i class="fas fa-check"></i> Normal</span>`;
            
        const badgeABC = `<span class="badge badge-abc-${peca.curva}">${peca.curva}</span>`;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-family: monospace; color: #94a3b8;">${peca.codigo || '-'}</td>
            <td><strong style="color: #f8fafc;">${peca.nome}</strong></td>
            <td style="color: #cbd5e1; font-weight: bold;">${peca.unidade || 'UN'}</td>
            <td>${badgeABC}</td>
            <td style="color: #94a3b8;"><i class="fas fa-map-marker-alt" style="font-size:0.8rem;"></i> ${peca.localizacao || '-'}</td>
            <td style="font-size: 1.1rem; font-weight: bold; ${estaBaixo ? 'color: #f87171;' : 'color: #34d399;'}">${peca.quantidade}</td>
            <td style="color: #94a3b8;">${peca.estoque_minimo}</td>
            <td style="font-weight: 500; color: #f8fafc;">R$ ${parseFloat(peca.preco_medio).toFixed(2).replace('.', ',')}</td>
            <td>${statusHtml}</td>
            <td style="text-align: right; display: flex; gap: 5px; justify-content: flex-end;">
                <button type="button" title="Imprimir Etiqueta QR Code" class="btn-action-sm" style="background:#8b5cf6;" onclick='imprimirQRCode(${JSON.stringify(peca)})'><i class="fas fa-qrcode"></i></button>
                <button type="button" title="Editar Peça" class="btn-action-sm btn-edit" onclick='editarPeca(${JSON.stringify(peca)})'><i class="fas fa-pen"></i></button>
                <button type="button" title="Excluir Peça" class="btn-action-sm btn-delete" onclick='deletarPeca(${peca.id})'><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function atualizarTabelaRequisicoes(listaReqs) {
    const tbody = document.getElementById('tabelaRequisicoesBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if(listaReqs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhuma requisição da oficina encontrada.</td></tr>';
        return;
    }

    listaReqs.forEach(req => {
        const dataFormatada = req.created_at ? new Date(req.created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-';
        const frota = req.ordens_servico?.placa || 'Desconhecida';
        const mecanico = req.ordens_servico?.mecanico_responsavel || 'Mecânico';
        const nomePeca = req.almoxarifado_pecas?.nome || 'Peça Excluída';
        const stat = req.status || 'Pendente'; // Default é pendente se não existir na base
        
        let statusBadge = '';
        let btnAcao = '';

        if (stat === 'Pendente') {
            statusBadge = '<span class="badge" style="background:#f59e0b; color:#fff;"><i class="fas fa-clock"></i> Aguardando Separação</span>';
            // Botões de aprovar e recusar
            btnAcao = `
                <button class="btn-action-sm btn-success" title="Aprovar e Baixar Estoque" onclick="aprovarRequisicao(${req.id}, ${req.peca_id}, ${req.quantidade}, '${req.os_id}', '${frota}', ${req.valor_unitario})"><i class="fas fa-check"></i></button>
                <button class="btn-action-sm btn-delete" title="Recusar" onclick="recusarRequisicao(${req.id})"><i class="fas fa-times"></i></button>
            `;
        } else if (stat === 'Aprovado') {
            statusBadge = '<span class="badge" style="background:#10b981; color:#fff;"><i class="fas fa-check"></i> Entregue</span>';
            btnAcao = '<span style="color:#94a3b8; font-size:0.8rem;">Já processada</span>';
        } else {
            statusBadge = '<span class="badge" style="background:#ef4444; color:#fff;"><i class="fas fa-times"></i> Recusado</span>';
            btnAcao = '<span style="color:#94a3b8; font-size:0.8rem;">Recusada</span>';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color: #94a3b8;">${dataFormatada}</td>
            <td>O.S. #${req.os_id} <br><strong style="color:#60a5fa;">${frota}</strong></td>
            <td><strong style="color:#e2e8f0;">${mecanico}</strong></td>
            <td>${nomePeca}</td>
            <td style="font-weight: bold; font-size: 1.1rem;">${req.quantidade}</td>
            <td>${statusBadge}</td>
            <td style="text-align: right; display:flex; gap:5px; justify-content: flex-end;">${btnAcao}</td>
        `;
        tbody.appendChild(tr);
    });
}

function atualizarTabelaMovimentacoes(listaMovimentacoes) {
    const tbody = document.getElementById('tabelaMovimentacoesBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if(listaMovimentacoes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhum registro de movimentação encontrado.</td></tr>';
        return;
    }

    listaMovimentacoes.forEach(mov => {
        let tipoHtml = '';
        if (mov.tipo === 'entrada') tipoHtml = `<span class="badge badge-in"><i class="fas fa-arrow-down"></i> Entrada</span>`;
        else if (mov.tipo === 'saida') tipoHtml = `<span class="badge badge-out"><i class="fas fa-arrow-up"></i> Saída</span>`;
        else tipoHtml = `<span class="badge" style="background: rgba(100,116,139,0.5); color:#cbd5e1;"><i class="fas fa-balance-scale"></i> Ajuste</span>`;
        
        const dataFormatada = new Date(mov.data_movimentacao).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const nomePeca = mov.almoxarifado_pecas ? mov.almoxarifado_pecas.nome : '<span style="color:#f87171; font-style:italic;">Peça Excluída</span>';
        
        let destinoTxt = '-';
        if (mov.tipo === 'ajuste') destinoTxt = `<span style="color:#cbd5e1;">Motivo: ${mov.observacao}</span>`;
        else if (mov.tipo === 'entrada' && mov.fornecedor) destinoTxt = `Forn: <span style="color:#cbd5e1;">${mov.fornecedor}</span>`;
        else if (mov.tipo === 'saida' && mov.cavalo) destinoTxt = `Frota: <strong style="color:#f8fafc;">${mov.cavalo}</strong> ${mov.os_id ? `(OS: ${mov.os_id})` : ''}`;

        const tr = document.createElement('tr');
        const qtdExibir = (mov.tipo === 'ajuste' && mov.quantidade > 0) ? `+${mov.quantidade}` : mov.quantidade;

        tr.innerHTML = `
            <td style="color: #94a3b8;">${dataFormatada}</td>
            <td>${tipoHtml}</td>
            <td style="font-weight: 500; color: #f8fafc;">${nomePeca}</td>
            <td style="font-weight: bold; color: ${mov.tipo === 'entrada' ? '#60a5fa' : (mov.tipo === 'saida' ? '#fbbf24' : '#cbd5e1')};">${qtdExibir}</td>
            <td style="color: #f8fafc;">R$ ${parseFloat(mov.valor_unitario||0).toFixed(2).replace('.', ',')}</td>
            <td style="font-family: monospace; color: #94a3b8;">${mov.nota_fiscal || '-'}</td>
            <td>${destinoTxt}</td>
        `;
        tbody.appendChild(tr);
    });
}

function atualizarTabelaPneus(lista) {
    const tbody = document.getElementById('tabelaPneusBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if(lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhum pneu cadastrado.</td></tr>';
        return;
    }

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
                <button type="button" title="Editar Pneu" class="btn-action-sm btn-edit" onclick='editarPneu(${JSON.stringify(p)})'><i class="fas fa-pen"></i></button>
                <button type="button" title="Gerenciar Pneu" class="btn-action-sm btn-info" onclick='abrirAcaoPneu(${JSON.stringify(p)})'><i class="fas fa-cog"></i> Ação</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function atualizarKPIsAlmoxarifado() {
    let valorTotal = 0;
    let itensBaixos = 0;
    let abcData = {A: {qtd:0, val:0}, B: {qtd:0, val:0}, C: {qtd:0, val:0}};

    // Soma o valor total das peças
    pecasEstoque.forEach(p => {
        valorTotal += p.valor_total;
        if (p.quantidade <= p.estoque_minimo) itensBaixos++;
        if(p.curva) { 
            abcData[p.curva].qtd++; 
            abcData[p.curva].val += p.valor_total; 
        }
    });

    // Soma o valor total dos pneus cadastrados
    pneusEstoque.forEach(pneu => {
        valorTotal += parseFloat(pneu.custo_atual || 0);
    });

    document.getElementById('kpiTotalItens').innerText = pecasEstoque.length;
    document.getElementById('kpiEstoqueMinimo').innerText = itensBaixos;
    document.getElementById('kpiValorTotal').innerText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal);
    
    let pneusRodando = pneusEstoque.filter(p => p.status === 'Rodando').length;
    let pneusGuardados = pneusEstoque.filter(p => p.status === 'Estoque').length;
    document.getElementById('kpiPneusResumo').innerText = `${pneusRodando} / ${pneusGuardados}`;

    // Contador de requisições pendentes na aba
    const pendentes = requisicoesEstoque.filter(r => r.status === 'Pendente' || !r.status).length;
    const badgeReq = document.getElementById('badgeReqPendente');
    if(badgeReq) {
        if(pendentes > 0) {
            badgeReq.innerText = pendentes;
            badgeReq.style.display = 'inline-block';
        } else {
            badgeReq.style.display = 'none';
        }
    }

    const listaABC = document.getElementById('listaCurvaABC');
    if(listaABC) {
        listaABC.innerHTML = `
            <li style="margin-bottom:12px; display:flex; align-items:center; gap:10px;">
                <span class="badge badge-abc-A" style="width:35px;justify-content:center;font-size:1rem;">A</span> 
                <span><b>${abcData.A.qtd} itens</b> representam <strong style="color:#fca5a5;">R$ ${abcData.A.val.toFixed(2).replace('.',',')}</strong> do seu capital.</span>
            </li>
            <li style="margin-bottom:12px; display:flex; align-items:center; gap:10px;">
                <span class="badge badge-abc-B" style="width:35px;justify-content:center;font-size:1rem;">B</span> 
                <span><b>${abcData.B.qtd} itens</b> representam <strong style="color:#fcd34d;">R$ ${abcData.B.val.toFixed(2).replace('.',',')}</strong> do seu capital.</span>
            </li>
            <li style="display:flex; align-items:center; gap:10px;">
                <span class="badge badge-abc-C" style="width:35px;justify-content:center;font-size:1rem;">C</span> 
                <span><b>${abcData.C.qtd} itens</b> representam <strong style="color:#6ee7b7;">R$ ${abcData.C.val.toFixed(2).replace('.',',')}</strong> do seu capital.</span>
            </li>
        `;
    }
}

function gerarRelatorioCustoFrota() {
    let custos = {};
    movimentacoesEstoque.forEach(m => {
        if (m.tipo === 'saida' && m.cavalo) {
            if(!custos[m.cavalo]) custos[m.cavalo] = 0;
            custos[m.cavalo] += (m.quantidade * m.valor_unitario);
        }
    });

    let sortCustos = Object.keys(custos).map(k => ({frota: k, valor: custos[k]})).sort((a,b) => b.valor - a.valor);
    const tbody = document.getElementById('tabelaCustoFrota');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if(sortCustos.length === 0) {
         tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:#94a3b8;">Sem saídas registradas.</td></tr>';
         return;
    }
    
    sortCustos.forEach(c => {
        tbody.innerHTML += `<tr>
            <td><strong style="color:#60a5fa; font-size:1.1rem;">${c.frota}</strong></td>
            <td style="color:#f8fafc; font-weight:bold;">R$ ${c.valor.toFixed(2).replace('.',',')}</td>
        </tr>`;
    });
}

window.filtrarAlmoxarifado = function() {
    const termo = document.getElementById('almoSearchInput').value.toLowerCase();
    
    if (abaAtualAlmox === 'estoque') {
        const filtradas = pecasEstoque.filter(p => 
            (p.nome && p.nome.toLowerCase().includes(termo)) || 
            (p.codigo && p.codigo.toLowerCase().includes(termo)) ||
            (p.localizacao && p.localizacao.toLowerCase().includes(termo))
        );
        atualizarTabelaPecas(filtradas);
    } else if (abaAtualAlmox === 'movimentacoes') {
        const filtradas = movimentacoesEstoque.filter(m => {
            const nomePeca = m.almoxarifado_pecas ? m.almoxarifado_pecas.nome.toLowerCase() : '';
            return nomePeca.includes(termo) || 
                   (m.nota_fiscal && m.nota_fiscal.toLowerCase().includes(termo)) || 
                   (m.cavalo && m.cavalo.toLowerCase().includes(termo)) ||
                   (m.observacao && m.observacao.toLowerCase().includes(termo));
        });
        atualizarTabelaMovimentacoes(filtradas);
    } else if (abaAtualAlmox === 'pneus') {
        const filtradas = pneusEstoque.filter(p => 
            (p.num_fogo && p.num_fogo.toLowerCase().includes(termo)) ||
            (p.marca && p.marca.toLowerCase().includes(termo)) ||
            (p.cavalo_atual && p.cavalo_atual.toLowerCase().includes(termo))
        );
        atualizarTabelaPneus(filtradas);
    } else if (abaAtualAlmox === 'requisicoes') {
        const filtradas = requisicoesEstoque.filter(r => {
            const frota = r.ordens_servico?.placa ? r.ordens_servico.placa.toLowerCase() : '';
            const mec = r.ordens_servico?.mecanico_responsavel ? r.ordens_servico.mecanico_responsavel.toLowerCase() : '';
            const peca = r.almoxarifado_pecas?.nome ? r.almoxarifado_pecas.nome.toLowerCase() : '';
            return frota.includes(termo) || mec.includes(termo) || peca.includes(termo) || (r.status && r.status.toLowerCase().includes(termo));
        });
        atualizarTabelaRequisicoes(filtradas);
    }
}

window.mudarAbaAlmoxarifado = function(abaId, btn) {
    abaAtualAlmox = abaId;
    document.querySelectorAll('.almo-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    document.getElementById('abaEstoque').style.display = abaId === 'estoque' ? 'block' : 'none';
    document.getElementById('abaRequisicoes').style.display = abaId === 'requisicoes' ? 'block' : 'none';
    document.getElementById('abaMovimentacoes').style.display = abaId === 'movimentacoes' ? 'block' : 'none';
    document.getElementById('abaPneus').style.display = abaId === 'pneus' ? 'block' : 'none';
    document.getElementById('abaRelatorios').style.display = abaId === 'relatorios' ? 'block' : 'none';
    
    filtrarAlmoxarifado();
}

// ================= APROVAR OU RECUSAR REQUISIÇÕES (NOVO) =================
window.aprovarRequisicao = async function(reqId, pecaId, qtd, osId, cavalo, valorUnitario) {
    const peca = pecasEstoque.find(p => p.id == pecaId);
    if (!peca || peca.quantidade < qtd) {
        alert(`Estoque insuficiente! Você possui apenas ${peca ? peca.quantidade : 0} unidade(s).`);
        return;
    }

    if(!confirm(`Confirma a liberação de ${qtd} unidades de "${peca.nome}" para a OS #${osId}? \nIsso descontará o estoque automaticamente.`)) return;

    try {
        // 1. Atualiza status da requisição
        await window.supabaseClient.from('os_pecas_utilizadas').update({ status: 'Aprovado' }).eq('id', reqId);

        // 2. Registra Saída (Isso diminui o estoque automaticamente via database.js)
        const movimentacao = {
            peca_id: pecaId,
            tipo: 'saida',
            quantidade: qtd,
            valor_unitario: valorUnitario || peca.preco_medio,
            cavalo: cavalo || 'Oficina',
            os_id: osId,
            nota_fiscal: 'Requisição Oficina',
            data_movimentacao: new Date().toISOString()
        };
        await db.addMovimentacao(movimentacao);

        alert("Requisição Aprovada e peça baixada do estoque!");
        await carregarDadosAlmoxarifado();
    } catch (e) {
        console.error(e);
        alert("Erro ao aprovar requisição.");
    }
}

window.recusarRequisicao = async function(reqId) {
    if(!confirm("Tem certeza que deseja RECUSAR esta peça? O mecânico será notificado.")) return;
    try {
        await window.supabaseClient.from('os_pecas_utilizadas').update({ status: 'Recusado' }).eq('id', reqId);
        await carregarDadosAlmoxarifado();
    } catch(e) {
        alert("Erro ao recusar.");
    }
}


// ================= LÓGICA DE PDF E XML (CAÇADOR DE PRODUTOS) =================
window.processarArquivoNF = async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const nomeArquivo = file.name.toLowerCase();
    document.getElementById('movNF').value = "Lendo arquivo...";
    itensLoteAtual = []; 

    if (nomeArquivo.endsWith('.xml')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const xmlDoc = new DOMParser().parseFromString(e.target.result, "text/xml");
                document.getElementById('movNF').value = xmlDoc.getElementsByTagName('nNF')[0]?.textContent || '';
                document.getElementById('movFornecedor').value = xmlDoc.getElementsByTagName('emit')[0]?.getElementsByTagName('xNome')[0]?.textContent || '';

                const itensXML = xmlDoc.getElementsByTagName('det');
                for (let i = 0; i < itensXML.length; i++) {
                    const prod = itensXML[i].getElementsByTagName('prod')[0];
                    if(!prod) continue;
                    
                    itensLoteAtual.push({
                        id_local: Date.now() + i,
                        codigo: prod.getElementsByTagName('cProd')[0]?.textContent || '',
                        nome: prod.getElementsByTagName('xProd')[0]?.textContent || 'Produto Desconhecido',
                        unidade: prod.getElementsByTagName('uCom')[0]?.textContent || 'UN',
                        quantidade: parseFloat(prod.getElementsByTagName('qCom')[0]?.textContent || '0').toFixed(2),
                        valor_unitario: parseFloat(prod.getElementsByTagName('vUnCom')[0]?.textContent || '0').toFixed(2),
                        estoque_minimo: 2
                    });
                }
                
                renderizarItensLoteNF();
                alert(`✅ Leitura Concluída! Foram encontrados ${itensLoteAtual.length} itens na nota.`);
            } catch (err) {
                alert("Erro ao extrair dados do XML.");
                document.getElementById('movNF').value = "";
            }
        };
        reader.readAsText(file);
    } 
    else if (nomeArquivo.endsWith('.pdf')) {
        if (typeof window['pdfjs-dist/build/pdf'] !== 'undefined' || window.pdfjsLib) {
            const pdfjs = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
            pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

            const fileReader = new FileReader();
            fileReader.onload = async function() {
                try {
                    const typedarray = new Uint8Array(this.result);
                    const pdf = await pdfjs.getDocument(typedarray).promise;
                    
                    let fullText = '';
                    let textArray = [];

                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        const items = textContent.items.map(item => item.str.trim()).filter(str => str !== '');
                        textArray = textArray.concat(items);
                        fullText += items.join(' ') + ' ';
                    }
                    
                    const matchNF = fullText.match(/N[º°]?\s*0*(\d{1,9})/i);
                    document.getElementById('movNF').value = matchNF ? matchNF[1] : '';
                    
                    let fornecedorStr = '';
                    const matchForn1 = fullText.match(/RECEBEMOS DE\s+(.+?)\s+OS PRODUTOS/i);
                    if (matchForn1) {
                        fornecedorStr = matchForn1[1];
                    } else {
                        const cnpjIndex = textArray.findIndex(s => /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(s));
                        if (cnpjIndex > 0) fornecedorStr = textArray[cnpjIndex - 1]; 
                    }
                    document.getElementById('movFornecedor').value = fornecedorStr || "Preencha o fornecedor";

                    itensLoteAtual = [];
                    const ncmRegex = /^\d{8}$|^\d{4}\.\d{2}\.\d{2}$/; 
                    const cfopRegex = /^\d{4}$/; 

                    for (let i = 2; i < textArray.length - 6; i++) {
                        if (ncmRegex.test(textArray[i]) && (cfopRegex.test(textArray[i+1]) || cfopRegex.test(textArray[i+2]))) {
                            
                            let offset = cfopRegex.test(textArray[i+1]) ? 1 : 2;
                            
                            let codigoStr = textArray[i-2];
                            let descStr = textArray[i-1];
                            let unStr = textArray[i + offset + 1];
                            let qtdStr = textArray[i + offset + 2];
                            let vUnitStr = textArray[i + offset + 3];

                            const parseBRNum = (str) => {
                                if(!str) return 0;
                                let clean = str.replace(/\./g, '').replace(',', '.');
                                return parseFloat(clean) || 0;
                            };

                            if (qtdStr && /^\d+[.,]?\d*/.test(qtdStr)) {
                                itensLoteAtual.push({
                                    id_local: Date.now() + i,
                                    codigo: codigoStr || '',
                                    nome: descStr || 'Produto Identificado',
                                    unidade: unStr || 'UN',
                                    quantidade: parseBRNum(qtdStr).toFixed(2),
                                    valor_unitario: parseBRNum(vUnitStr).toFixed(2),
                                    estoque_minimo: 2
                                });
                            }
                        }
                    }
                    
                    if (itensLoteAtual.length > 0) {
                        renderizarItensLoteNF();
                        alert(`✅ Sucesso! Foram lidos ${itensLoteAtual.length} produtos da nota.`);
                    } else {
                        adicionarLinhaLoteNF();
                        alert("⚠️ A formatação do PDF não permitiu extrair as tabelas. Preencha manualmente.");
                    }
                } catch (err) {
                    console.error("Erro PDF", err);
                    alert("Erro ao ler as propriedades do PDF.");
                }
            };
            fileReader.readAsArrayBuffer(file);
        } else {
            alert("A biblioteca de PDF do sistema não carregou. Verifique a internet.");
        }
    } else {
        alert("Formato não suportado. Utilize PDF ou XML.");
    }
}

window.renderizarItensLoteNF = function() {
    const tbody = document.getElementById('tabelaLoteNFBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if(itensLoteAtual.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 15px; color: #94a3b8;">Nenhum item na nota. Faça upload do XML/PDF ou adicione manualmente.</td></tr>';
        return;
    }

    itensLoteAtual.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" class="input-table-sm" value="${item.codigo}" onchange="atualizarItemLote(${index}, 'codigo', this.value)"></td>
            <td><input type="text" class="input-table-sm" value="${item.nome}" onchange="atualizarItemLote(${index}, 'nome', this.value)" required></td>
            <td><input type="text" class="input-table-sm" style="text-align: center;" value="${item.unidade || 'UN'}" onchange="atualizarItemLote(${index}, 'unidade', this.value)"></td>
            <td><input type="number" step="0.01" class="input-table-sm" value="${item.quantidade}" onchange="atualizarItemLote(${index}, 'quantidade', this.value)" required></td>
            <td><input type="number" step="0.01" class="input-table-sm" value="${item.valor_unitario}" onchange="atualizarItemLote(${index}, 'valor_unitario', this.value)" required></td>
            <td style="text-align: center;"><button type="button" class="btn-action-sm btn-delete" onclick="removerLinhaLoteNF(${index})"><i class="fas fa-trash"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
}

window.atualizarItemLote = function(index, campo, valor) {
    itensLoteAtual[index][campo] = valor;
}

window.adicionarLinhaLoteNF = function() {
    itensLoteAtual.push({ id_local: Date.now(), codigo: '', nome: '', unidade: 'UN', quantidade: 1, valor_unitario: 0, estoque_minimo: 2 });
    renderizarItensLoteNF();
}

window.removerLinhaLoteNF = function(index) {
    itensLoteAtual.splice(index, 1);
    renderizarItensLoteNF();
}

// ================= CRUD DE PEÇAS =================
window.abrirModalPeca = function() {
    document.getElementById('formPeca').reset();
    document.getElementById('pecaId').value = '';
    document.getElementById('modalPecaTitulo').innerText = 'Cadastrar Nova Peça';
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
    document.getElementById('modalPecaTitulo').innerText = 'Editar Peça';
    document.getElementById('modalPeca').style.display = 'flex';
}

window.salvarPeca = async function(e) {
    e.preventDefault();
    const peca = {
        codigo: document.getElementById('pecaCodigo').value.trim(),
        nome: document.getElementById('pecaNome').value.trim(),
        unidade: document.getElementById('pecaUnidade').value.trim().toUpperCase(),
        localizacao: document.getElementById('pecaLocalizacao').value.trim(),
        quantidade: parseFloat(document.getElementById('pecaQtd').value),
        estoque_minimo: parseFloat(document.getElementById('pecaEstoqueMin').value),
        preco_medio: parseFloat(document.getElementById('pecaPreco').value)
    };

    const id = document.getElementById('pecaId').value;
    if (id) peca.id = id;

    try {
        await db.upsertPeca(peca);
        fecharModalAlmox('modalPeca');
        await carregarDadosAlmoxarifado();
    } catch (error) {
        alert("Erro ao salvar peça!");
    }
}

window.deletarPeca = async function(id) {
    if (confirm("Excluir esta peça pode afetar o histórico. Continuar?")) {
        await db.deletePeca(id);
        await carregarDadosAlmoxarifado();
    }
}

// ================= PREPARAÇÃO E SALVAMENTO DE MOVIMENTAÇÕES =================
window.prepararModalMovimentacao = function(tipo) {
    document.getElementById('formMovimentacao').reset();
    document.getElementById('movTipo').value = tipo;
    
    document.getElementById('divEntradaNF').style.display = 'none';
    document.getElementById('divSaidaOS').style.display = 'none';
    document.getElementById('divAjusteEstoque').style.display = 'none';

    const fileInput = document.getElementById('nfArquivo');
    if(fileInput) fileInput.value = ''; 

    ['movNF','movFornecedor','movPecaId','movQuantidade','movCavalo','ajustePecaId','ajusteQtdReal','ajusteMotivo'].forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).required = false;
    });
    
    const titulo = document.getElementById('modalMovTitulo');
    const btnSubmit = document.getElementById('btnConfirmaMov');
    
    if(tipo === 'entrada') {
        titulo.innerHTML = '<i class="fas fa-arrow-down" style="color: #60a5fa;"></i> Lançar Entrada de Peça (NF)';
        btnSubmit.className = 'btn-modern btn-primary';
        document.getElementById('divEntradaNF').style.display = 'block';
        
        itensLoteAtual = [];
        renderizarItensLoteNF();
        
        if(document.getElementById('movNF')) document.getElementById('movNF').required = true;
        if(document.getElementById('movFornecedor')) document.getElementById('movFornecedor').required = true;

    } else if(tipo === 'saida') {
        titulo.innerHTML = '<i class="fas fa-arrow-up" style="color: #fbbf24;"></i> Registrar Saída Direta de Peça (Frota)';
        btnSubmit.className = 'btn-modern btn-warning';
        document.getElementById('divSaidaOS').style.display = 'block';
        
        if(document.getElementById('movPecaId')) document.getElementById('movPecaId').required = true;
        if(document.getElementById('movQuantidade')) document.getElementById('movQuantidade').required = true;
        if(document.getElementById('movCavalo')) document.getElementById('movCavalo').required = true;
        
        preencherSelectPecas('movPecaId');
        
        const inputOS = document.getElementById('movOS');
        if (inputOS) {
            const buscarPlaca = async function() {
                const osId = inputOS.value.trim();
                if (!osId) return;

                const cavaloInput = document.getElementById('movCavalo');
                const oldVal = cavaloInput.value;
                cavaloInput.value = "Buscando...";

                try {
                    let placaEncontrada = null;
                    if (typeof ordensServico !== 'undefined' && ordensServico.length > 0) {
                        const os = ordensServico.find(o => String(o.id) === osId || String(o.numero_os) === osId);
                        if (os && os.placa) placaEncontrada = os.placa;
                    }
                    if (!placaEncontrada && window.supabaseClient) {
                         const { data } = await window.supabaseClient.from('ordens_servico').select('placa').eq('id', osId).maybeSingle();
                         if (data && data.placa) placaEncontrada = data.placa;
                    }

                    if (placaEncontrada) {
                        cavaloInput.value = placaEncontrada;
                        cavaloInput.style.borderColor = '#10b981';
                        cavaloInput.style.color = '#10b981';
                        setTimeout(() => { cavaloInput.style.borderColor = '#334155'; cavaloInput.style.color = '#fff'; }, 2000);
                    } else {
                        cavaloInput.value = oldVal; 
                    }
                } catch (e) {
                    cavaloInput.value = oldVal;
                }
            };
            inputOS.onchange = buscarPlaca;
            inputOS.onkeydown = function(e) { if(e.key === 'Enter') e.preventDefault(); };
            inputOS.onkeyup = function(e) { if(e.key === 'Enter') { e.preventDefault(); buscarPlaca(); } };
        }

    } else if(tipo === 'ajuste') {
        titulo.innerHTML = '<i class="fas fa-balance-scale" style="color: #94a3b8;"></i> Ajuste de Balanço Físico';
        btnSubmit.className = 'btn-modern btn-dark';
        document.getElementById('divAjusteEstoque').style.display = 'block';
        
        if(document.getElementById('ajustePecaId')) document.getElementById('ajustePecaId').required = true;
        if(document.getElementById('ajusteQtdReal')) document.getElementById('ajusteQtdReal').required = true;
        if(document.getElementById('ajusteMotivo')) document.getElementById('ajusteMotivo').required = true;
        
        preencherSelectPecas('ajustePecaId');
        document.getElementById('ajusteQtdAtual').value = '';
    }
    
    document.getElementById('modalMovimentacao').style.display = 'flex';
}

function preencherSelectPecas(idElemento) {
    const select = document.getElementById(idElemento);
    select.innerHTML = '<option value="">-- Selecione uma peça --</option>';
    pecasEstoque.forEach(p => {
        select.innerHTML += `<option value="${p.id}">${p.codigo ? p.codigo+' - ' : ''}${p.nome} (Qtd: ${p.quantidade} ${p.unidade||'UN'})</option>`;
    });

    if(idElemento === 'movPecaId') {
        select.onchange = function() {
            const p = pecasEstoque.find(x => x.id == this.value);
            if(p) document.getElementById('movValor').value = p.preco_medio;
        };
    }
}

window.carregarEstoqueAtualAjuste = function() {
    const id = document.getElementById('ajustePecaId').value;
    const peca = pecasEstoque.find(x => x.id == id);
    document.getElementById('ajusteQtdAtual').value = peca ? peca.quantidade : '';
}

window.salvarMovimentacao = async function(e) {
    e.preventDefault();
    const tipo = document.getElementById('movTipo').value;
    
    const btnSubmit = document.getElementById('btnConfirmaMov');
    if(btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
    }

    try {
        if (tipo === 'entrada') {
            const nf = document.getElementById('movNF').value;
            const fornecedor = document.getElementById('movFornecedor').value;
            
            if(itensLoteAtual.length === 0) {
                alert("A nota não tem nenhum produto listado!"); 
                if(btnSubmit) { btnSubmit.disabled = false; btnSubmit.innerHTML = '<i class="fas fa-check"></i> Salvar Lançamento no Sistema'; }
                return;
            }
            await db.processarEntradaLote(itensLoteAtual, nf, fornecedor);
            alert("Entrada registrada com sucesso!");
            
        } else if (tipo === 'saida') {
            const peca_id = document.getElementById('movPecaId').value;
            const qtd = parseFloat(document.getElementById('movQuantidade').value);
            const valor = parseFloat(document.getElementById('movValor').value) || 0;

            const peca = pecasEstoque.find(p => p.id == peca_id);
            if (!peca || qtd > peca.quantidade) {
                alert(`Estoque insuficiente! Você possui apenas ${peca ? peca.quantidade : 0} unidade(s).`); 
                if(btnSubmit) { btnSubmit.disabled = false; btnSubmit.innerHTML = '<i class="fas fa-check"></i> Salvar Lançamento no Sistema'; }
                return;
            }

            const movimentacao = {
                peca_id: peca_id,
                tipo: 'saida',
                quantidade: qtd,
                valor_unitario: valor,
                cavalo: document.getElementById('movCavalo').value.toUpperCase(),
                os_id: document.getElementById('movOS').value,
                data_movimentacao: new Date().toISOString()
            };
            await db.addMovimentacao(movimentacao);
            alert("Saída registrada com sucesso!");
            
        } else if (tipo === 'ajuste') {
            const peca_id = document.getElementById('ajustePecaId').value;
            const qtdReal = parseFloat(document.getElementById('ajusteQtdReal').value);
            const motivo = document.getElementById('ajusteMotivo').value;
            const peca = pecasEstoque.find(p => p.id == peca_id);
            
            if(!peca) {
                if(btnSubmit) { btnSubmit.disabled = false; btnSubmit.innerHTML = '<i class="fas fa-check"></i> Salvar Lançamento no Sistema'; }
                return;
            }
            
            const diferenca = qtdReal - peca.quantidade;
            
            if(diferenca === 0) {
                alert("A quantidade física informada é igual à quantidade atual no sistema. Nenhum ajuste necessário.");
                if(btnSubmit) { btnSubmit.disabled = false; btnSubmit.innerHTML = '<i class="fas fa-check"></i> Salvar Lançamento no Sistema'; }
                return;
            }

            // Grava histórico de Ajuste
            await db.addMovimentacao({
                peca_id: peca_id,
                tipo: 'ajuste',
                quantidade: diferenca,
                valor_unitario: peca.preco_medio,
                nota_fiscal: 'Ajuste Sistêmico',
                observacao: motivo,
                data_movimentacao: new Date().toISOString()
            });

            // Força a atualização do saldo da peça no banco
            peca.quantidade = qtdReal; 
            await db.upsertPeca(peca);
            
            alert("Estoque ajustado com sucesso!");
        }

        fecharModalAlmox('modalMovimentacao');
        await carregarDadosAlmoxarifado(); 
        document.getElementById('almoSearchInput').value = ''; 
        
    } catch (error) {
        alert("Ocorreu um erro crítico ao registrar. Pressione F12 e veja o Console para detalhes.");
        console.error("ERRO DETALHADO:", error);
    } finally {
        if(btnSubmit) { 
            btnSubmit.disabled = false; 
            btnSubmit.innerHTML = '<i class="fas fa-check"></i> Salvar Lançamento no Sistema'; 
        }
    }
}

// ================= GESTÃO DE PNEUS =================
window.abrirModalPneu = function() {
    document.getElementById('formPneu').reset();
    document.getElementById('pneuId').value = '';
    document.getElementById('modalPneuTitulo').innerText = 'Cadastrar Novo Pneu';
    document.getElementById('modalPneu').style.display = 'flex';
}

window.editarPneu = function(pneu) {
    document.getElementById('pneuId').value = pneu.id;
    document.getElementById('pnFogo').value = pneu.num_fogo;
    document.getElementById('pnMarca').value = pneu.marca || '';
    document.getElementById('pnMedida').value = pneu.medida || '';
    document.getElementById('pnVida').value = pneu.vida || 0;
    document.getElementById('pnCusto').value = pneu.custo_atual || 0;

    document.getElementById('modalPneuTitulo').innerText = 'Editar Pneu';
    document.getElementById('modalPneu').style.display = 'flex';
}

window.salvarPneu = async function(e) {
    e.preventDefault();
    const pneu = {
        num_fogo: document.getElementById('pnFogo').value.trim(),
        marca: document.getElementById('pnMarca').value.trim(),
        medida: document.getElementById('pnMedida').value.trim(),
        vida: parseInt(document.getElementById('pnVida').value),
        custo_atual: parseFloat(document.getElementById('pnCusto').value) || 0,
        status: 'Estoque'
    };
    
    const id = document.getElementById('pneuId').value;
    if(id) pneu.id = id;

    try {
        if(!window.supabaseClient) throw new Error("Supabase não inicializado");
        
        const { error } = await window.supabaseClient.from('almoxarifado_pneus').upsert(pneu);
        if(error) throw error;
        
        fecharModalAlmox('modalPneu');
        await carregarDadosAlmoxarifado();
        alert("Pneu cadastrado com sucesso!");
    } catch(err) { 
        alert("Erro ao salvar pneu! Verifique se o Nº de Fogo já existe."); 
        console.error(err); 
    }
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
    const pneuId = document.getElementById('acaoPneuId').value;
    const acao = document.getElementById('acaoPneuTipo').value;
    const obs = document.getElementById('acaoObs').value;
    
    let updPneu = {};
    let hist = { pneu_id: pneuId, tipo: acao, observacao: obs };

    if(acao === 'instalar') {
        updPneu = { 
            status: 'Rodando', 
            cavalo_atual: document.getElementById('acaoCavalo').value.toUpperCase(), 
            eixo: document.getElementById('acaoEixo').value, 
            posicao: document.getElementById('acaoPosicao').value, 
            km_instalacao: parseInt(document.getElementById('acaoKm').value) 
        };
        hist.cavalo = updPneu.cavalo_atual;
        hist.km_frota = updPneu.km_instalacao;
        
    } else if(acao === 'retirar') {
        updPneu = { status: 'Estoque', cavalo_atual: null, eixo: null, posicao: null };
        
    } else if(acao === 'recapagem') {
        const custoExtra = parseFloat(document.getElementById('acaoCustoExtra').value || 0);
        updPneu = { status: 'Recapagem', cavalo_atual: null, eixo: null, posicao: null }; 
        const pneuVelho = pneusEstoque.find(p => p.id == pneuId);
        if(custoExtra > 0) updPneu.custo_atual = parseFloat(pneuVelho.custo_atual || 0) + custoExtra;
        
    } else if(acao === 'sucata') {
        updPneu = { status: 'Sucata', cavalo_atual: null, eixo: null, posicao: null };
    }

    try {
        await window.supabaseClient.from('almoxarifado_pneus').update(updPneu).eq('id', pneuId);
        await window.supabaseClient.from('almoxarifado_pneus_mov').insert(hist);
        fecharModalAlmox('modalAcaoPneu');
        await carregarDadosAlmoxarifado();
        alert("Ação no pneu registrada com sucesso!");
    } catch(err) { 
        alert("Erro ao processar pneu."); 
        console.error(err); 
    }
}

// ================= UTILITÁRIOS GERAIS =================
window.fecharModalAlmox = function(id) {
    document.getElementById(id).style.display = 'none';
}

window.onclick = function(event) {
    const modais = ['modalPeca', 'modalMovimentacao', 'modalPneu', 'modalAcaoPneu'];
    modais.forEach(id => {
        const modal = document.getElementById(id);
        if (event.target == modal) {
            modal.style.display = "none";
        }
    });
}

// ================= GERADOR DE ETIQUETA QR CODE =================
window.imprimirQRCode = function(peca) {
    if (!peca.codigo) {
        alert("⚠️ Atenção: Esta peça não possui um 'Código / SKU' cadastrado. Edite a peça, insira um código e tente novamente.");
        return;
    }

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(peca.codigo)}`;
    const janelaImpressao = window.open('', '_blank', 'width=400,height=500');
    
    janelaImpressao.document.write(`
        <html>
            <head>
                <title>Etiqueta QR Code - ${peca.codigo}</title>
                <style>
                    body { 
                        font-family: 'Arial', sans-serif; 
                        text-align: center; 
                        margin: 0; 
                        padding: 20px; 
                        background: #f8fafc;
                    }
                    .etiqueta { 
                        border: 2px dashed #000; 
                        padding: 20px; 
                        display: inline-block; 
                        width: 250px; 
                        background: #fff;
                        border-radius: 8px;
                    }
                    .titulo { 
                        font-size: 16px; 
                        font-weight: bold; 
                        margin-bottom: 15px;
                        text-transform: uppercase;
                    }
                    .codigo { 
                        font-size: 22px; 
                        margin: 10px 0; 
                        font-family: monospace; 
                        font-weight: bold; 
                        letter-spacing: 1px;
                    }
                    .local { 
                        font-size: 14px; 
                        color: #333; 
                        margin-top: 10px;
                        font-weight: bold;
                    }
                    @media print {
                        body { padding: 0; background: #fff; }
                        .etiqueta { border: none; width: 100%; border-radius: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="etiqueta">
                    <div class="titulo">${peca.nome}</div>
                    <img src="${qrUrl}" alt="QR Code" style="border: 1px solid #ccc; padding: 5px; border-radius: 5px;">
                    <div class="codigo">${peca.codigo}</div>
                    <div class="local">📍 Local: ${peca.localizacao || 'Sem prateleira definida'}</div>
                </div>
                <script>
                    setTimeout(() => {
                        window.print();
                        window.close();
                    }, 500);
                </script>
            </body>
        </html>
    `);
    janelaImpressao.document.close();
}