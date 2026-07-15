// ==================== js/almoxarifado.js ====================
let pecasEstoque = [];
let movimentacoesEstoque = [];
let pneusEstoque = [];
let requisicoesEstoque = [];

let abaAtualAlmox = 'estoque';
let itensLoteAtual = [];
let grupoAvaliacaoAtual = []; // Guarda os itens do modal de aprovação

window.renderizarAlmoxarifado = async function() {
    injetarModalAprovacao(); // Injeta o modal moderno via JS
    await carregarDadosAlmoxarifado();
}

// INJEÇÃO DINÂMICA DO MODAL DE APROVAÇÃO
function injetarModalAprovacao() {
    if(document.getElementById('modalAprovacaoReq')) return;
    const modalHtml = `
    <div id="modalAprovacaoReq" class="almo-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.8); backdrop-filter:blur(5px); z-index:10000; align-items:center; justify-content:center;">
        <div class="almo-modal-content" style="background:#1e293b; color:#e2e8f0; width:100%; max-width:800px; max-height:90vh; overflow-y:auto; border-radius:16px; padding:30px; border:1px solid #334155; position:relative; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
            <span class="almo-close" onclick="fecharModalAlmox('modalAprovacaoReq')" style="position:absolute; top:20px; right:20px; font-size:1.5rem; cursor:pointer; color:#94a3b8;">&times;</span>
            <h3 style="color:#38bdf8; margin-top:0; font-size:1.5rem; display:flex; align-items:center; gap:10px;"><i class="fas fa-clipboard-check"></i> Avaliar Requisição <span id="modalApOrigem" style="font-size:1rem; color:#94a3b8; font-weight:normal;"></span></h3>
            <p style="color:#94a3b8; font-size:1rem; margin-bottom:20px;">Destino / Solicitante: <strong id="modalApDestino" style="color:#f8fafc; font-size:1.1rem;"></strong></p>
            
            <div class="almo-table-container" style="background:#0f172a; border-radius:8px; border:1px solid #334155; overflow:hidden;">
                <table class="almo-table" style="width:100%; text-align:left; border-collapse:collapse;">
                    <thead style="background:#1e293b;">
                        <tr>
                            <th style="padding:12px; border-bottom:1px solid #334155; color:#94a3b8;">Produto</th>
                            <th style="padding:12px; text-align:center; border-bottom:1px solid #334155; color:#94a3b8;">Qtd. Solicitada</th>
                            <th style="padding:12px; text-align:center; border-bottom:1px solid #334155; color:#94a3b8;">Estoque Atual</th>
                            <th style="padding:12px; text-align:center; border-bottom:1px solid #334155; color:#94a3b8;">Decisão (Individual)</th>
                        </tr>
                    </thead>
                    <tbody id="tbodyAprovacaoGrupo"></tbody>
                </table>
            </div>
            <div style="margin-top:25px; display:flex; gap:15px; justify-content:flex-end;">
                <button class="btn-modern btn-dark" onclick="fecharModalAlmox('modalAprovacaoReq')" style="padding:10px 20px;">Cancelar</button>
                <button class="btn-modern btn-primary" id="btnConfirmarAvaliacao" onclick="confirmarAvaliacaoGrupo()" style="padding:10px 20px;"><i class="fas fa-save"></i> Confirmar Avaliação</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
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
            
            let queryReqsOS = window.supabaseClient.from('os_pecas_utilizadas').select('*').order('id', { ascending: false }).limit(100);
            if (typeof window.aplicarFiltroFilial === 'function') queryReqsOS = window.aplicarFiltroFilial(queryReqsOS);
            const { data: reqsOS } = await queryReqsOS;
            
            let queryReqsColab = window.supabaseClient.from('almoxarifado_requisicoes').select('*').order('id', { ascending: false }).limit(100);
            if (typeof window.aplicarFiltroFilial === 'function') queryReqsColab = window.aplicarFiltroFilial(queryReqsColab);
            const { data: reqsColab } = await queryReqsColab;

            let unificadas = [];
            if(reqsOS) reqsOS.forEach(r => unificadas.push({ ...r, source_table: 'os_pecas_utilizadas' }));
            if(reqsColab) reqsColab.forEach(r => unificadas.push({ ...r, source_table: 'almoxarifado_requisicoes' }));
            
            unificadas.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            requisicoesEstoque = unificadas;
        }

        atualizarTabelaPecas(pecasEstoque);
        atualizarTabelaMovimentacoes(movimentacoesEstoque);
        atualizarTabelaNotas(movimentacoesEstoque);
        atualizarTabelaPneus(pneusEstoque);
        atualizarTabelaRequisicoes(requisicoesEstoque);
        
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
    if(listaPecas.length === 0) { tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhuma peça encontrada.</td></tr>'; return; }

    const grupos = {};
    let valorTotalGlobal = 0;

    listaPecas.forEach(peca => {
        const chave = (peca.codigo && peca.codigo.trim() !== '') ? peca.codigo.trim().toUpperCase() : peca.nome.trim().toUpperCase();
        if (!grupos[chave]) {
            grupos[chave] = {
                chave: chave, nome: peca.nome, codigo: peca.codigo, unidade: peca.unidade,
                categoria: peca.categoria, localizacao: peca.localizacao, estoque_minimo: peca.estoque_minimo,
                quantidade_total: 0, valor_total: 0, itens: [], validades: []
            };
        }
        let qtd = parseFloat(peca.quantidade);
        let val = qtd * parseFloat(peca.preco_medio || 0);
        
        grupos[chave].quantidade_total += qtd;
        grupos[chave].valor_total += val;
        valorTotalGlobal += val;
        grupos[chave].itens.push(peca);
        
        if (peca.data_validade) grupos[chave].validades.push(peca.data_validade);
    });

    const listaGrupos = Object.values(grupos).sort((a,b) => b.valor_total - a.valor_total);
    let somaAcumulada = 0;
    let indexGrupo = 0;

    listaGrupos.forEach(grupo => {
        indexGrupo++;
        somaAcumulada += grupo.valor_total;
        let perc = (somaAcumulada / (valorTotalGlobal || 1)) * 100;
        grupo.curva = perc <= 80 ? 'A' : (perc <= 95 ? 'B' : 'C');

        const estaBaixo = grupo.quantidade_total <= grupo.estoque_minimo;
        const statusHtml = estaBaixo ? `<span class="badge badge-alert"><i class="fas fa-exclamation-circle"></i> Baixo</span>` : `<span class="badge badge-ok"><i class="fas fa-check"></i> Normal</span>`;
        const precoMedio = grupo.quantidade_total > 0 ? (grupo.valor_total / grupo.quantidade_total) : 0;
        
        let validadeDestaque = '-';
        if (grupo.validades.length > 0) {
            const validadesOrdenadas = grupo.validades.sort((a,b) => new Date(a) - new Date(b));
            const [ano, mes, dia] = validadesOrdenadas[0].split('-');
            validadeDestaque = `${dia}/${mes}/${ano}`;
        }

        const trGroup = document.createElement('tr');
        trGroup.style.backgroundColor = 'rgba(255,255,255,0.02)';
        trGroup.innerHTML = `
            <td style="font-family: monospace; color: #60a5fa; font-weight:bold;">${grupo.codigo || '-'}</td>
            <td>
                <strong style="color: #f8fafc;">${grupo.nome}</strong> 
                ${grupo.itens.length > 1 ? `<span style="font-size:0.7rem; color:#94a3b8; background:#334155; padding:2px 6px; border-radius:10px; margin-left:5px; cursor:pointer;" onclick="toggleLotes('lotes_${indexGrupo}')"><i class="fas fa-layer-group"></i> ${grupo.itens.length} Lotes</span>` : ''}
            </td>
            <td><span style="color:#cbd5e1; font-size:0.85rem; background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px; border: 1px solid #334155;">${grupo.categoria || '-'}</span></td>
            <td style="color: #cbd5e1; font-weight: bold;">${grupo.unidade || 'UN'}</td>
            <td><span class="badge badge-abc-${grupo.curva}">${grupo.curva}</span></td>
            <td style="color: #94a3b8;"><i class="fas fa-map-marker-alt" style="font-size:0.8rem;"></i> ${grupo.localizacao || '-'}</td>
            <td style="color: #94a3b8;">${validadeDestaque}</td>
            <td style="font-size: 1.1rem; font-weight: bold; ${estaBaixo ? 'color: #f87171;' : 'color: #34d399;'}">${grupo.quantidade_total.toFixed(2)}</td>
            <td style="color: #94a3b8;">${grupo.estoque_minimo}</td>
            <td style="font-weight: 500; color: #f8fafc;">R$ ${precoMedio.toFixed(2).replace('.', ',')}</td>
            <td>${statusHtml}</td>
            <td style="text-align: right; display: flex; gap: 5px; justify-content: flex-end;">
                ${grupo.itens.length > 1 ? `<button type="button" title="Ver Lotes" class="btn-action-sm btn-info" onclick="toggleLotes('lotes_${indexGrupo}')"><i class="fas fa-list"></i></button>` : ''}
                <button type="button" title="Imprimir Etiqueta" class="btn-action-sm" style="background:#8b5cf6;" onclick='imprimirQRCode(${JSON.stringify(grupo.itens[0])})'><i class="fas fa-qrcode"></i></button>
                ${grupo.itens.length === 1 ? `<button type="button" title="Editar" class="btn-action-sm btn-edit" onclick='editarPeca(${JSON.stringify(grupo.itens[0])})'><i class="fas fa-pen"></i></button> <button type="button" title="Excluir" class="btn-action-sm btn-delete" onclick='deletarPeca(${grupo.itens[0].id})'><i class="fas fa-trash"></i></button>` : ''}
            </td>
        `;
        tbody.appendChild(trGroup);

        if (grupo.itens.length > 1) {
            grupo.itens.forEach((lote, idxLote) => {
                let dataVal = '-';
                if(lote.data_validade) { const [a, m, d] = lote.data_validade.split('-'); dataVal = `${d}/${m}/${a}`; }
                
                const trLote = document.createElement('tr');
                trLote.className = `lotes_${indexGrupo}`;
                trLote.style.display = 'none'; 
                trLote.style.backgroundColor = 'rgba(0,0,0,0.2)';
                trLote.innerHTML = `
                    <td colspan="5" style="text-align: right; color: #64748b; font-size:0.85rem;"><i class="fas fa-level-up-alt" style="transform: rotate(90deg);"></i> Lote ${idxLote + 1}</td>
                    <td style="color: #94a3b8; font-size:0.85rem;">${lote.localizacao || '-'}</td>
                    <td style="color: #cbd5e1; font-size:0.85rem;">${dataVal}</td>
                    <td style="color: #34d399; font-weight:bold; font-size:0.95rem;">${lote.quantidade}</td>
                    <td></td>
                    <td style="color: #cbd5e1; font-size:0.85rem;">R$ ${parseFloat(lote.preco_medio||0).toFixed(2).replace('.',',')}</td>
                    <td></td>
                    <td style="text-align: right; display: flex; gap: 5px; justify-content: flex-end;">
                        <button type="button" title="Editar Lote" class="btn-action-sm btn-edit" onclick='editarPeca(${JSON.stringify(lote)})'><i class="fas fa-pen"></i></button>
                        <button type="button" title="Excluir Lote" class="btn-action-sm btn-delete" onclick='deletarPeca(${lote.id})'><i class="fas fa-trash"></i></button>
                    </td>
                `;
                tbody.appendChild(trLote);
            });
        }
    });
}

window.toggleLotes = function(className) {
    const rows = document.querySelectorAll('.' + className);
    rows.forEach(row => { row.style.display = row.style.display === 'none' ? 'table-row' : 'none'; });
}

function atualizarTabelaRequisicoes(listaReqs) {
    const tbody = document.getElementById('tabelaRequisicoesBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if(listaReqs.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhuma requisição pendente.</td></tr>'; return; }

    const gruposReq = {};
    listaReqs.forEach(req => {
        let chave = '';
        if(req.source_table === 'almoxarifado_requisicoes') {
            chave = `${req.created_at}_${req.colaborador_nome}`;
        } else {
            chave = `${req.created_at}_${req.os_id || req.centro_custo}`;
        }
        
        if(!gruposReq[chave]) {
            gruposReq[chave] = {
                data: req.created_at,
                origem: req.source_table,
                colaborador_nome: req.colaborador_nome,
                usuario_solicitante: req.usuario_solicitante,
                centro_custo: req.centro_custo,
                os_id: req.os_id,
                placa: req.placa,
                mecanico_responsavel: req.mecanico_responsavel,
                status: req.status || 'Pendente',
                itens: [],
                id_grupo: req.id
            };
        }
        if(req.status === 'Pendente' || !req.status) {
            gruposReq[chave].status = 'Pendente';
        }
        gruposReq[chave].itens.push(req);
    });

    Object.values(gruposReq).forEach(grupo => {
        const dataFormatada = grupo.data ? new Date(grupo.data).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
        
        let tituloOrigem = '';
        let usuarioReq = '';

        if(grupo.origem === 'almoxarifado_requisicoes') {
            tituloOrigem = `<strong style="color:#fbbf24; font-size:1.05rem;">Req. Mat #${grupo.id_grupo}</strong><br><span style="color:#cbd5e1; font-size:0.85rem;"><i class="fas fa-id-badge"></i> Para: ${grupo.colaborador_nome}</span>`;
            usuarioReq = `<span style="color:#94a3b8; font-size:0.75rem;">Solicitado por:</span><br><strong style="color:#e2e8f0;">${grupo.usuario_solicitante}</strong>`;
        } else {
            tituloOrigem = grupo.centro_custo 
                ? `<strong style="color:#a855f7; font-size:1.05rem;">RM-Int #${grupo.id_grupo}</strong><br><span style="color:#cbd5e1; font-size:0.85rem;"><i class="fas fa-building"></i> ${grupo.centro_custo}</span>` 
                : `<strong style="color:#60a5fa; font-size:1.05rem;">O.S #${grupo.os_id}</strong><br><span style="color:#cbd5e1; font-size:0.85rem;"><i class="fas fa-truck"></i> ${grupo.placa || 'Frota'}</span>`;
            usuarioReq = `<strong style="color:#e2e8f0;">${grupo.mecanico_responsavel || 'Mecânico'}</strong>`;
        }

        let listaPecasHtml = '';
        let listaQtdHtml = '';
        let todosAprovados = true;
        let todosRecusados = true;

        grupo.itens.forEach(req => {
            const pecaRef = pecasEstoque.find(p => String(p.id) === String(req.peca_id));
            const nomePeca = pecaRef ? pecaRef.nome : '<span style="color:#f87171; font-style:italic;">Peça Excluída</span>';
            const stat = req.status || 'Pendente';
            
            let corItem = stat === 'Aprovado' ? '#34d399' : (stat === 'Recusado' ? '#ef4444' : '#cbd5e1');

            listaPecasHtml += `<div style="padding: 3px 0; color: ${corItem}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;" title="${nomePeca}">• ${nomePeca}</div>`;
            listaQtdHtml += `<div style="padding: 3px 0; color: ${corItem}; font-weight: bold;">${req.quantidade}</div>`;
            
            if(stat !== 'Aprovado') todosAprovados = false;
            if(stat !== 'Recusado') todosRecusados = false;
        });

        let stat = grupo.status;
        if(todosAprovados) stat = 'Aprovado';
        else if(todosRecusados) stat = 'Recusado';

        let statusBadge = '', btnAcao = '';
        if (stat === 'Pendente') {
            statusBadge = '<span class="badge" style="background:#f59e0b; color:#fff;"><i class="fas fa-clock"></i> Aguardando</span>';
            btnAcao = `
                <button class="btn-action-sm btn-info" style="background:#38bdf8; padding:8px 12px; font-weight:bold;" title="Avaliar Pedido" onclick="abrirModalAprovacaoGrupo('${grupo.data}', '${grupo.origem}', '${grupo.colaborador_nome || grupo.os_id || grupo.centro_custo}')"><i class="fas fa-tasks"></i> Avaliar</button>
            `;
        } else if (stat === 'Aprovado') {
            statusBadge = '<span class="badge" style="background:#10b981; color:#fff;"><i class="fas fa-check"></i> Liberada</span>';
            btnAcao = `
                ${grupo.origem === 'almoxarifado_requisicoes' ? `<button class="btn-action-sm" style="background:#8b5cf6;" title="Reimprimir Termo" onclick="reimprimirTermoGrupo('${grupo.data}', '${grupo.origem}', '${grupo.colaborador_nome}')"><i class="fas fa-print"></i></button>` : ''}
                <span style="color:#94a3b8; font-size:0.8rem; display:block; margin-top:5px;">Processada</span>
            `;
        } else {
            statusBadge = '<span class="badge" style="background:#ef4444; color:#fff;"><i class="fas fa-times"></i> Recusada</span>';
            btnAcao = '<span style="color:#94a3b8; font-size:0.8rem;">Recusada</span>';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color: #94a3b8; vertical-align: middle;">${dataFormatada}</td>
            <td style="vertical-align: middle;">${tituloOrigem}</td>
            <td style="vertical-align: middle;">${usuarioReq}</td>
            <td style="vertical-align: middle;">${listaPecasHtml}</td>
            <td style="vertical-align: middle; text-align:center;">${listaQtdHtml}</td>
            <td style="vertical-align: middle;">${statusBadge}</td>
            <td style="text-align: right; display:flex; gap:5px; justify-content: flex-end; align-items:center; height: 100%; min-height: 60px;">${btnAcao}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ======================= NOVO FLUXO DE APROVAÇÃO (MODAL) ======================= //

window.abrirModalAprovacaoGrupo = function(dataReq, sourceTable, identificador) {
    grupoAvaliacaoAtual = requisicoesEstoque.filter(r => 
        r.created_at === dataReq && r.source_table === sourceTable && 
        (r.colaborador_nome === identificador || String(r.os_id) === identificador || r.centro_custo === identificador) &&
        (r.status === 'Pendente' || !r.status)
    );

    if(grupoAvaliacaoAtual.length === 0) { alert("Nenhum item pendente neste pedido."); return; }

    document.getElementById('modalApOrigem').innerText = sourceTable === 'almoxarifado_requisicoes' ? '(Termo de Colaborador)' : '(Uso Interno / Oficina)';
    document.getElementById('modalApDestino').innerText = identificador;

    const tbody = document.getElementById('tbodyAprovacaoGrupo');
    tbody.innerHTML = '';

    grupoAvaliacaoAtual.forEach((req, index) => {
        const peca = pecasEstoque.find(p => String(p.id) === String(req.peca_id));
        const nome = peca ? peca.nome : 'Peça Desconhecida / Excluída';
        const estoque = peca ? peca.quantidade : 0;
        const faltaEstoque = estoque < req.quantidade;
        
        let selectColor = faltaEstoque ? '#ef4444' : '#3b82f6';
        let selectBg = faltaEstoque ? 'rgba(239, 68, 68, 0.2)' : '#0f172a';

        let htmlSelect = `
            <select id="decisao_${index}" class="input-table-sm" style="background:${selectBg}; padding:8px; border-radius:6px; color:#fff; border:1px solid ${selectColor}; width:100%; outline:none; font-weight:bold;">
                ${faltaEstoque ? '' : '<option value="Aprovado" style="background:#0f172a; color:#fff;">✅ Aprovar Item</option>'}
                <option value="Recusado" ${faltaEstoque ? 'selected' : ''} style="background:#0f172a; color:#fff;">❌ Recusar Item</option>
                <option value="Pendente" ${!faltaEstoque ? 'selected' : ''} style="background:#0f172a; color:#fff;">⏳ Deixar Pendente</option>
            </select>
        `;

        tbody.innerHTML += `
            <tr style="border-bottom:1px solid #334155;">
                <td style="padding:12px; color:#f8fafc;">
                    ${nome} <br>
                    <small style="color:#94a3b8; font-family:monospace;">${peca ? peca.codigo || 'S/N' : ''}</small>
                    ${faltaEstoque ? '<br><span style="color:#ef4444; font-size:0.8rem; font-weight:bold;"><i class="fas fa-exclamation-triangle"></i> Estoque Insuficiente</span>' : ''}
                </td>
                <td style="padding:12px; text-align:center; font-weight:bold; color:#60a5fa; font-size:1.1rem;">${req.quantidade}</td>
                <td style="padding:12px; text-align:center; font-weight:bold; color:${faltaEstoque ? '#ef4444' : '#34d399'}; font-size:1.1rem;">${estoque}</td>
                <td style="padding:12px; text-align:center; min-width: 170px;">${htmlSelect}</td>
            </tr>
        `;
    });

    document.getElementById('modalAprovacaoReq').style.display = 'flex';
}

window.confirmarAvaliacaoGrupo = async function() {
    const btn = document.getElementById('btnConfirmarAvaliacao');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
    btn.disabled = true;

    let itensAprovadosParaTermo = [];
    let aprovouAlgo = false;

    try {
        for(let i = 0; i < grupoAvaliacaoAtual.length; i++) {
            const req = grupoAvaliacaoAtual[i];
            const decisao = document.getElementById(`decisao_${i}`).value;

            if (decisao === 'Pendente') continue; 

            const peca = pecasEstoque.find(p => String(p.id) === String(req.peca_id));

            if (decisao === 'Aprovado') {
                const table = req.source_table === 'almoxarifado_requisicoes' ? 'almoxarifado_requisicoes' : 'os_pecas_utilizadas';
                await window.supabaseClient.from(table).update({ status: 'Aprovado' }).eq('id', req.id);
                
                let novaMovimentacao = {
                    peca_id: req.peca_id, 
                    tipo: 'saida', 
                    quantidade: req.quantidade, 
                    valor_unitario: req.valor_unitario || (peca ? peca.preco_medio : 0),
                    usuario: window.currentUser ? window.currentUser.username : 'Sistema', 
                    data_movimentacao: new Date().toISOString()
                };

                if (req.source_table === 'almoxarifado_requisicoes') {
                    novaMovimentacao.setor_destino = 'Colaborador: ' + req.colaborador_nome;
                    novaMovimentacao.nota_fiscal = `RM-RH #${req.id}`;
                } else {
                    if (req.centro_custo) {
                        novaMovimentacao.setor_destino = req.centro_custo;
                        novaMovimentacao.nota_fiscal = `RM-Int #${req.id}`;
                    } else {
                        novaMovimentacao.cavalo = req.placa || 'Oficina';
                        novaMovimentacao.os_id = req.os_id;
                        novaMovimentacao.nota_fiscal = `O.S #${req.os_id}`;
                    }
                }

                await db.addMovimentacao(novaMovimentacao);
                itensAprovadosParaTermo.push(req);
                aprovouAlgo = true;

            } else if (decisao === 'Recusado') {
                const table = req.source_table === 'almoxarifado_requisicoes' ? 'almoxarifado_requisicoes' : 'os_pecas_utilizadas';
                await window.supabaseClient.from(table).update({ status: 'Recusado' }).eq('id', req.id);
            }
        }

        fecharModalAlmox('modalAprovacaoReq');
        
        if (aprovouAlgo && grupoAvaliacaoAtual[0].source_table === 'almoxarifado_requisicoes') {
            if (confirm(`Deseja imprimir o Termo de Entrega para os itens APROVADOS de ${grupoAvaliacaoAtual[0].colaborador_nome}?`)) {
                imprimirTermoEntregaGrupo(itensAprovadosParaTermo);
            } else {
                alert("Avaliação processada com sucesso!");
            }
        } else {
            alert("Avaliação processada com sucesso!");
        }

        await carregarDadosAlmoxarifado();
    } catch (e) {
        console.error(e);
        alert("Erro ao salvar avaliação. Tente novamente.");
    } finally {
        btn.innerHTML = '<i class="fas fa-save"></i> Confirmar Avaliação';
        btn.disabled = false;
    }
}

window.reimprimirTermoGrupo = function(dataReq, sourceTable, identificador) {
    const itensGrupo = requisicoesEstoque.filter(r => 
        r.created_at === dataReq && r.source_table === sourceTable && 
        (r.colaborador_nome === identificador || String(r.os_id) === identificador || r.centro_custo === identificador) &&
        r.status === 'Aprovado'
    );
    if(itensGrupo.length > 0) {
        imprimirTermoEntregaGrupo(itensGrupo);
    } else {
        alert("Nenhum item aprovado encontrado neste grupo para impressão.");
    }
}

window.imprimirTermoEntregaGrupo = function(itensGrupo) {
    if(!itensGrupo || itensGrupo.length === 0) return;
    const reqBase = itensGrupo[0]; 
    
    const win = window.open('', '_blank', 'width=850,height=600');
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    
    let linhasTabela = '';
    itensGrupo.forEach(item => {
        const peca = pecasEstoque.find(p => String(p.id) === String(item.peca_id)) || {unidade:'UN', codigo:'S/N', nome:'Produto Desconhecido'};
        linhasTabela += `
            <tr>
                <td style="text-align:center;">${item.quantidade}</td>
                <td style="text-align:center;">${peca.unidade || 'UN'}</td>
                <td>${peca.codigo || 'S/N'}</td>
                <td>${peca.nome}</td>
                <td style="text-align:center;">${dataAtual}</td>
            </tr>
        `;
    });

    win.document.write(`
        <html>
        <head>
            <title>Termo de Entrega - ${reqBase.colaborador_nome}</title>
            <style>
                body { font-family: 'Arial', sans-serif; margin: 40px; color: #000; }
                .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
                .header h1 { margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px; }
                .header p { margin: 5px 0 0 0; font-size: 14px; color: #555; }
                .content { font-size: 14px; line-height: 1.6; text-align: justify; margin-bottom: 30px; }
                .table-info { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
                .table-info th, .table-info td { border: 1px solid #000; padding: 12px; text-align: left; }
                .table-info th { background-color: #f0f0f0; }
                .signature-container { display: flex; justify-content: space-between; margin-top: 80px; }
                .signature-box { text-align: center; width: 45%; }
                .signature-line { width: 100%; border-top: 1px solid #000; margin-bottom: 10px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>TERMO DE RESPONSABILIDADE E ENTREGA DE EPI / MATERIAIS</h1>
                <p>Serrana Florestal - Gestão de Almoxarifado</p>
            </div>
            
            <div class="content">
                <p>Eu, <strong>${reqBase.colaborador_nome}</strong>, declaro para os devidos fins legais que recebi da empresa Serrana Florestal, o(s) equipamento(s)/material(is) abaixo discriminado(s), de forma gratuita, em perfeito estado de conservação e funcionamento.</p>
                <p>Comprometo-me a utilizá-lo(s) estritamente para a finalidade a que se destina(m) em minhas atividades laborais, responsabilizando-me por sua guarda, correta utilização e conservação. Estou ciente de que, em caso de dano por mau uso ou extravio, deverei comunicar imediatamente a liderança. Em caso de desligamento da empresa, me comprometo a devolver os materiais não descartáveis.</p>
                
                <table class="table-info">
                    <thead>
                        <tr>
                            <th style="width: 10%; text-align:center;">Qtd.</th>
                            <th style="width: 10%; text-align:center;">Unid.</th>
                            <th style="width: 20%;">Código/CA</th>
                            <th style="width: 45%;">Descrição do Produto</th>
                            <th style="width: 15%; text-align:center;">Data Entrega</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${linhasTabela}
                    </tbody>
                </table>
            </div>
            
            <div class="signature-container">
                <div class="signature-box">
                    <div class="signature-line"></div>
                    <strong>${reqBase.colaborador_nome}</strong><br>
                    Assinatura do Colaborador
                </div>
                <div class="signature-box">
                    <div class="signature-line"></div>
                    <strong>${reqBase.usuario_solicitante || 'Almoxarifado'}</strong><br>
                    Responsável pela Entrega
                </div>
            </div>
            
            <script>
                setTimeout(() => { window.print(); window.close(); }, 500);
            </script>
        </body>
        </html>
    `);
    win.document.close();
}

// ============================================================================================== //

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
    
    const grupos = {};
    pecasEstoque.forEach(p => {
        const chave = (p.codigo && p.codigo.trim() !== '') ? p.codigo.trim().toUpperCase() : p.nome.trim().toUpperCase();
        if (!grupos[chave]) grupos[chave] = { valor_total: 0, quantidade: 0, minimo: p.estoque_minimo };
        grupos[chave].valor_total += (p.quantidade * parseFloat(p.preco_medio || 0));
        grupos[chave].quantidade += parseFloat(p.quantidade);
    });

    let abcData = {A: {qtd:0, val:0}, B: {qtd:0, val:0}, C: {qtd:0, val:0}};
    let listaGrupos = Object.values(grupos);
    let valorTotalEstoque = 0;
    
    listaGrupos.forEach(g => valorTotalEstoque += g.valor_total);
    listaGrupos.sort((a, b) => b.valor_total - a.valor_total);

    let somaAcumulada = 0;
    listaGrupos.forEach(g => {
        somaAcumulada += g.valor_total;
        let percentual = (somaAcumulada / (valorTotalEstoque || 1)) * 100;
        let curva = percentual <= 80 ? 'A' : (percentual <= 95 ? 'B' : 'C');
        
        abcData[curva].qtd++;
        abcData[curva].val += g.valor_total;
        
        if (g.quantidade <= g.minimo) itensBaixos++;
        valorTotal += g.valor_total;
    });

    pneusEstoque.forEach(pneu => valorTotal += parseFloat(pneu.custo_atual || 0));

    document.getElementById('kpiTotalItens').innerText = listaGrupos.length; 
    document.getElementById('kpiEstoqueMinimo').innerText = itensBaixos;
    document.getElementById('kpiValorTotal').innerText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal);
    document.getElementById('kpiPneusResumo').innerText = `${pneusEstoque.filter(p => p.status === 'Rodando').length} / ${pneusEstoque.filter(p => p.status === 'Estoque').length}`;

    const pendentes = requisicoesEstoque.filter(r => r.status === 'Pendente' || !r.status).length;
    const badgeReq = document.getElementById('badgeReqPendente');
    if(badgeReq) {
        if(pendentes > 0) { badgeReq.innerText = pendentes; badgeReq.style.display = 'inline-block'; } 
        else { badgeReq.style.display = 'none'; }
    }
}

window.filtrarAlmoxarifado = function() {
    const termo = document.getElementById('almoSearchInput').value.toLowerCase();
    if (abaAtualAlmox === 'estoque') atualizarTabelaPecas(pecasEstoque.filter(p => (p.nome||'').toLowerCase().includes(termo) || (p.codigo||'').toLowerCase().includes(termo) || (p.categoria||'').toLowerCase().includes(termo)));
    else if (abaAtualAlmox === 'notas') atualizarTabelaNotas(movimentacoesEstoque.filter(m => (m.nota_fiscal||'').toLowerCase().includes(termo) || (m.fornecedor||'').toLowerCase().includes(termo) || (m.usuario||'').toLowerCase().includes(termo)));
    else if (abaAtualAlmox === 'movimentacoes') atualizarTabelaMovimentacoes(movimentacoesEstoque.filter(m => (m.nota_fiscal||'').toLowerCase().includes(termo) || (m.fornecedor||'').toLowerCase().includes(termo) || (m.cavalo||'').toLowerCase().includes(termo) || (m.setor_destino||'').toLowerCase().includes(termo) || (m.usuario||'').toLowerCase().includes(termo)));
    else if (abaAtualAlmox === 'pneus') atualizarTabelaPneus(pneusEstoque.filter(p => (p.num_fogo||'').toLowerCase().includes(termo) || (p.cavalo_atual||'').toLowerCase().includes(termo)));
    else if (abaAtualAlmox === 'requisicoes') atualizarTabelaRequisicoes(requisicoesEstoque.filter(r => (r.placa||'').toLowerCase().includes(termo) || (r.mecanico_responsavel||'').toLowerCase().includes(termo) || (r.centro_custo||'').toLowerCase().includes(termo) || (r.colaborador_nome||'').toLowerCase().includes(termo)));
}

window.mudarAbaAlmoxarifado = function(abaId, btn) {
    abaAtualAlmox = abaId;
    document.querySelectorAll('.almo-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['estoque','requisicoes','notas','movimentacoes','pneus'].forEach(id => {
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
            const pecaExistenteIgual = pecasEstoque.find(p => 
                p.codigo && pecaInput.codigo &&
                p.codigo.toUpperCase() === pecaInput.codigo.toUpperCase() && 
                parseFloat(p.preco_medio || 0).toFixed(2) === pecaInput.preco_medio.toFixed(2)
            );

            if (pecaExistenteIgual) {
                pecaExistenteIgual.quantidade = parseFloat(pecaExistenteIgual.quantidade) + pecaInput.quantidade;
                if (pecaInput.data_validade) pecaExistenteIgual.data_validade = pecaInput.data_validade; 
                await db.upsertPeca(pecaExistenteIgual);
                
                if (pecaInput.quantidade > 0) {
                    const mov = typeof window.injetarFilial === 'function' ? window.injetarFilial({
                        peca_id: pecaExistenteIgual.id, 
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

                alert(`Peça lançada! O item já existia com o MESMO código e valor, portanto a quantidade foi somada ao Lote existente.`);
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

window.imprimirQRCode = function(peca) {
    if (!peca.codigo) { alert("Sem código!"); return; }
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(peca.codigo)}`;
    const win = window.open('', '_blank', 'width=400,height=500');
    win.document.write(`<html><head><title>Etiqueta QR Code - ${peca.codigo}</title><style>body { font-family: sans-serif; text-align: center; } .etiqueta { border: 2px dashed #000; padding: 20px; display: inline-block; width: 250px; border-radius: 8px; } .titulo { font-size: 16px; font-weight: bold; margin-bottom: 15px; } .codigo { font-size: 22px; margin: 10px 0; font-family: monospace; font-weight: bold; } </style></head><body><div class="etiqueta"><div class="titulo">${peca.nome}</div><img src="${qrUrl}" alt="QR Code" style="border: 1px solid #ccc; padding: 5px; border-radius: 5px;"><div class="codigo">${peca.codigo}</div><div class="local">📍 Local: ${peca.localizacao || 'S/N'}</div></div><script>setTimeout(() => { window.print(); window.close(); }, 500);</script></body></html>`);
    win.document.close();
}