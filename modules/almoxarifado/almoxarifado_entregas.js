// ==================== modules/almoxarifado/almoxarifado_entregas.js ====================

let pecasEstoqueEntregas = [];
let requisicoesEstoqueEntregas = [];
let grupoAvaliacaoAtualEntregas = [];
let itensPendentesParaAssinaturaEntregas = [];

// Controle de Abas e Paginação
let abaAtualEntregas = 'hoje';
let paginaAtualHistorico = 1;
const itensPorPagina = 10; // Você pode aumentar ou diminuir a quantidade de requisições por página

// Variáveis para as duas assinaturas
let canvasColab, ctxColab, isDrawingColab = false, hasColabSig = false;
let canvasEntregador, ctxEntregador, isDrawingEntregador = false, hasEntregadorSig = false;

window.renderizarAlmoxarifadoEntregas = async function() {
    injetarModalAprovacaoEntregas();
    await carregarDadosEntregas();
}

function injetarModalAprovacaoEntregas() {
    if(document.getElementById('modalAprovacaoReqEntregas')) return;
    const modalHtml = `
    <div id="modalAprovacaoReqEntregas" class="almo-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.8); backdrop-filter:blur(5px); z-index:10000; align-items:center; justify-content:center;">
        <div class="almo-modal-content" style="background:#1e293b; color:#e2e8f0; width:100%; max-width:800px; max-height:90vh; overflow-y:auto; border-radius:16px; padding:30px; border:1px solid #334155; position:relative; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
            <span class="almo-close" onclick="fecharModalEntregas('modalAprovacaoReqEntregas')" style="position:absolute; top:20px; right:20px; font-size:1.5rem; cursor:pointer; color:#94a3b8;">&times;</span>
            <h3 style="color:#38bdf8; margin-top:0; font-size:1.5rem; display:flex; align-items:center; gap:10px;"><i class="fas fa-clipboard-check"></i> Avaliar e Registrar Entrega <span id="modalApOrigemEntregas" style="font-size:1rem; color:#94a3b8; font-weight:normal;"></span></h3>
            <p style="color:#94a3b8; font-size:1rem; margin-bottom:20px;">Destino / Solicitante: <strong id="modalApDestinoEntregas" style="color:#f8fafc; font-size:1.1rem;"></strong></p>
            
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
                    <tbody id="tbodyAprovacaoGrupoEntregas"></tbody>
                </table>
            </div>
            <div style="margin-top:25px; display:flex; gap:15px; justify-content:flex-end;">
                <button class="btn-modern btn-dark" onclick="fecharModalEntregas('modalAprovacaoReqEntregas')" style="padding:10px 20px;">Cancelar</button>
                <button class="btn-modern btn-primary" id="btnConfirmarAvaliacaoEntregas" onclick="confirmarAvaliacaoGrupoEntregas()" style="padding:10px 20px;"><i class="fas fa-arrow-right"></i> Prosseguir para Assinatura</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// ==================== LÓGICA DAS ABAS, FILTROS E PAGINAÇÃO ====================

window.trocarAbaEntregas = function(aba) {
    abaAtualEntregas = aba;
    paginaAtualHistorico = 1; // Reseta a paginação ao trocar de aba
    
    document.getElementById('tab-hoje').classList.toggle('active', aba === 'hoje');
    document.getElementById('tab-historico').classList.toggle('active', aba === 'historico');
    
    document.getElementById('filtrosHistorico').style.display = aba === 'historico' ? 'flex' : 'none';
    document.getElementById('controleBuscaSimples').style.display = aba === 'hoje' ? 'flex' : 'none';
    document.getElementById('paginacaoEntregas').style.display = aba === 'historico' ? 'flex' : 'none';
    
    renderizarTabelaPorAba();
}

window.filtrarHistoricoEntregas = function() {
    paginaAtualHistorico = 1; // Reseta a paginação ao filtrar
    renderizarTabelaPorAba();
}

window.limparFiltrosEntregas = function() {
    document.getElementById('filtroSol').value = '';
    document.getElementById('filtroPed').value = '';
    document.getElementById('filtroData').value = '';
    document.getElementById('filtroStatus').value = '';
    paginaAtualHistorico = 1;
    renderizarTabelaPorAba();
}

window.filtrarTabelaEntregas = function() {
    renderizarTabelaPorAba();
}

window.mudarPaginaEntregas = function(direcao) {
    paginaAtualHistorico += direcao;
    renderizarTabelaPorAba();
}

window.renderizarTabelaPorAba = function() {
    let dados = [...requisicoesEstoqueEntregas];

    // Aplicar Filtros Iniciais Baseados na Aba
    if(abaAtualEntregas === 'hoje') {
        const hojeStr = new Date().toLocaleDateString('pt-BR');
        dados = dados.filter(req => {
            const reqDate = req.created_at ? new Date(req.created_at).toLocaleDateString('pt-BR') : '';
            return reqDate === hojeStr;
        });
        
        const termo = document.getElementById('entregasSearchInput').value.toLowerCase();
        if(termo) {
            dados = dados.filter(r => (r.placa||'').toLowerCase().includes(termo) || (r.mecanico_responsavel||'').toLowerCase().includes(termo) || (r.centro_custo||'').toLowerCase().includes(termo) || (r.colaborador_nome||'').toLowerCase().includes(termo));
        }
    } else {
        const fSol = document.getElementById('filtroSol').value.toLowerCase();
        const fPed = document.getElementById('filtroPed').value.toLowerCase();
        const fData = document.getElementById('filtroData').value;
        
        if(fSol) dados = dados.filter(r => (r.usuario_solicitante||'').toLowerCase().includes(fSol));
        if(fPed) dados = dados.filter(r => (r.colaborador_nome||r.os_id||r.centro_custo||r.placa||'').toString().toLowerCase().includes(fPed));
        if(fData) {
            dados = dados.filter(r => {
                if(!r.created_at) return false;
                const d = new Date(r.created_at);
                const tzOffset = d.getTimezoneOffset() * 60000;
                const dataReq = new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
                return dataReq === fData;
            });
        }
    }

    // 1. Agrupar os Itens (Para não quebrar um pedido no meio da paginação)
    const gruposReq = {};
    dados.forEach(req => {
        let chave = req.source_table === 'almoxarifado_requisicoes' ? `${req.created_at}_${req.colaborador_nome}` : `${req.created_at}_${req.os_id || req.centro_custo}`;
        if(!gruposReq[chave]) {
            gruposReq[chave] = {
                data: req.created_at,
                origem: req.source_table,
                colaborador_nome: req.colaborador_nome,
                usuario_solicitante: req.usuario_solicitante,
                usuario_entregador: req.usuario_entregador,
                centro_custo: req.centro_custo,
                os_id: req.os_id,
                placa: req.placa,
                mecanico_responsavel: req.mecanico_responsavel,
                status: req.status || 'Pendente',
                itens: [],
                id_grupo: req.id
            };
        }
        if(req.status === 'Pendente' || !req.status) { gruposReq[chave].status = 'Pendente'; }
        gruposReq[chave].itens.push(req);
    });

    // Filtra Status do Grupo (só aplicável no Histórico)
    let gruposArray = Object.values(gruposReq);
    if (abaAtualEntregas === 'historico') {
        const fStatus = document.getElementById('filtroStatus').value;
        if (fStatus) {
            gruposArray = gruposArray.filter(grupo => {
                let todosAprovados = true, todosRecusados = true, todosDevolvidos = true;
                grupo.itens.forEach(req => {
                    const stat = req.status || 'Pendente';
                    if(stat !== 'Aprovado') todosAprovados = false;
                    if(stat !== 'Recusado') todosRecusados = false;
                    if(stat !== 'Devolvido') todosDevolvidos = false;
                });
                let statusFinal = grupo.status;
                if(todosAprovados) statusFinal = 'Aprovado';
                else if(todosRecusados) statusFinal = 'Recusado';
                else if(todosDevolvidos) statusFinal = 'Devolvido';

                return statusFinal === fStatus;
            });
        }
    }

    // 2. Aplicar Paginação APENAS se for Aba Histórico
    if (abaAtualEntregas === 'historico') {
        const totalPaginas = Math.ceil(gruposArray.length / itensPorPagina) || 1;
        
        if (paginaAtualHistorico < 1) paginaAtualHistorico = 1;
        if (paginaAtualHistorico > totalPaginas) paginaAtualHistorico = totalPaginas;

        document.getElementById('textoPaginacao').innerText = `Página ${paginaAtualHistorico} de ${totalPaginas}`;
        document.getElementById('btnPaginaAnt').disabled = (paginaAtualHistorico === 1);
        document.getElementById('btnPaginaProx').disabled = (paginaAtualHistorico === totalPaginas);

        const inicio = (paginaAtualHistorico - 1) * itensPorPagina;
        const fim = inicio + itensPorPagina;
        gruposArray = gruposArray.slice(inicio, fim);
    }

    // 3. Renderizar o HTML da Tabela
    const tbody = document.getElementById('tabelaEntregasBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if(gruposArray.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhuma requisição encontrada.</td></tr>'; 
        return; 
    }

    gruposArray.forEach(grupo => {
        const dataFormatada = grupo.data ? new Date(grupo.data).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
        
        let tituloOrigem = '', usuarioReq = '';
        if(grupo.origem === 'almoxarifado_requisicoes') {
            tituloOrigem = `<strong style="color:#fbbf24; font-size:1.05rem;">Req. Mat #${grupo.id_grupo}</strong><br><span style="color:#cbd5e1; font-size:0.85rem;"><i class="fas fa-id-badge"></i> Para: ${grupo.colaborador_nome}</span>`;
            usuarioReq = `<span style="color:#94a3b8; font-size:0.75rem;">Solicitado por:</span><br><strong style="color:#e2e8f0;">${grupo.usuario_solicitante}</strong>`;
        } else {
            tituloOrigem = grupo.centro_custo 
                ? `<strong style="color:#a855f7; font-size:1.05rem;">RM-Int #${grupo.id_grupo}</strong><br><span style="color:#cbd5e1; font-size:0.85rem;"><i class="fas fa-building"></i> ${grupo.centro_custo}</span>` 
                : `<strong style="color:#60a5fa; font-size:1.05rem;">O.S #${grupo.os_id}</strong><br><span style="color:#cbd5e1; font-size:0.85rem;"><i class="fas fa-truck"></i> ${grupo.placa || 'Frota'}</span>`;
            usuarioReq = `<strong style="color:#e2e8f0;">${grupo.mecanico_responsavel || 'Mecânico'}</strong>`;
        }

        let listaPecasHtml = '', listaQtdHtml = '';
        let todosAprovados = true, todosRecusados = true, todosDevolvidos = true;

        grupo.itens.forEach(req => {
            const pecaRef = pecasEstoqueEntregas.find(p => String(p.id) === String(req.peca_id));
            const nomePeca = pecaRef ? pecaRef.nome : '<span style="color:#f87171; font-style:italic;">Peça Excluída</span>';
            const stat = req.status || 'Pendente';
            
            let corItem = stat === 'Aprovado' ? '#34d399' : (stat === 'Recusado' ? '#ef4444' : (stat === 'Devolvido' ? '#94a3b8' : '#cbd5e1'));

            listaPecasHtml += `<div style="padding: 3px 0; color: ${corItem}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;" title="${nomePeca}">• ${nomePeca}</div>`;
            listaQtdHtml += `<div style="padding: 3px 0; color: ${corItem}; font-weight: bold;">${req.quantidade}</div>`;
            
            if(stat !== 'Aprovado') todosAprovados = false;
            if(stat !== 'Recusado') todosRecusados = false;
            if(stat !== 'Devolvido') todosDevolvidos = false;
        });

        let stat = grupo.status;
        if(todosAprovados) stat = 'Aprovado';
        else if(todosRecusados) stat = 'Recusado';
        else if(todosDevolvidos) stat = 'Devolvido';

        let statusBadge = '', btnAcao = '';
        if (stat === 'Pendente') {
            statusBadge = '<span class="badge" style="background:#f59e0b; color:#fff;"><i class="fas fa-clock"></i> Aguardando</span>';
            btnAcao = `<button class="btn-action-sm btn-info" style="background:#38bdf8; padding:8px 12px; font-weight:bold;" title="Avaliar e Entregar" onclick="abrirModalAprovacaoGrupoEntregas('${grupo.data}', '${grupo.origem}', '${grupo.colaborador_nome || grupo.os_id || grupo.centro_custo}')"><i class="fas fa-boxes"></i> Separar & Entregar</button>`;
        } else if (stat === 'Aprovado') {
            statusBadge = '<span class="badge" style="background:#10b981; color:#fff;"><i class="fas fa-check"></i> Entregue</span>';
            btnAcao = `
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:flex-end;">
                    ${grupo.origem === 'almoxarifado_requisicoes' ? `<button class="btn-action-sm" style="background:#8b5cf6;" title="Reimprimir Termo" onclick="reimprimirTermoGrupoEntregas('${grupo.data}', '${grupo.origem}', '${grupo.colaborador_nome}')"><i class="fas fa-print"></i></button>` : ''}
                    <button class="btn-action-sm" style="background:#f59e0b; color:#fff;" title="Cancelar Pedido e Devolver ao Estoque" onclick="estornarRequisicaoGrupoEntregas('${grupo.data}', '${grupo.origem}', '${grupo.colaborador_nome || grupo.os_id || grupo.centro_custo}')"><i class="fas fa-undo"></i> Estornar</button>
                </div>`;
        } else if (stat === 'Devolvido') {
            statusBadge = '<span class="badge" style="background:#64748b; color:#fff;"><i class="fas fa-undo"></i> Estornada</span>';
            btnAcao = '<span style="color:#94a3b8; font-size:0.8rem;">Itens Devolvidos</span>';
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


// ==================== LÓGICA DAS ASSINATURAS (PASSOS E CANVAS) ====================

function initSignaturePadEntregas() {
    canvasColab = document.getElementById('canvasAssinaturaColab');
    canvasEntregador = document.getElementById('canvasAssinaturaEntregador');
    
    if(!canvasColab || !canvasEntregador) return;
    
    ctxColab = canvasColab.getContext('2d');
    ctxEntregador = canvasEntregador.getContext('2d');
    
    configurarEventosCanvas(canvasColab, ctxColab, 'colab');
    configurarEventosCanvas(canvasEntregador, ctxEntregador, 'entregador');
}

function configurarEventosCanvas(canvas, ctx, tipo) {
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';

    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    };

    const iniciarDesenho = (e) => { 
        e.preventDefault(); 
        if(tipo === 'colab') { isDrawingColab = true; hasColabSig = true; }
        if(tipo === 'entregador') { isDrawingEntregador = true; hasEntregadorSig = true; }
        const pos = getPos(e); 
        ctx.beginPath(); 
        ctx.moveTo(pos.x, pos.y); 
    };
    
    const desenhar = (e) => { 
        e.preventDefault(); 
        const isDrawing = tipo === 'colab' ? isDrawingColab : isDrawingEntregador;
        if (!isDrawing) return;
        const pos = getPos(e); 
        ctx.lineTo(pos.x, pos.y); 
        ctx.stroke(); 
    };
    
    const pararDesenho = () => { 
        if(tipo === 'colab') isDrawingColab = false;
        if(tipo === 'entregador') isDrawingEntregador = false;
        ctx.closePath(); 
    };

    canvas.addEventListener("mousedown", iniciarDesenho);
    canvas.addEventListener("mousemove", desenhar);
    canvas.addEventListener("mouseup", pararDesenho);
    canvas.addEventListener("mouseout", pararDesenho);
    canvas.addEventListener("touchstart", iniciarDesenho, { passive: false });
    canvas.addEventListener("touchmove", desenhar, { passive: false });
    canvas.addEventListener("touchend", pararDesenho);
}

window.limparAssinaturaColab = function() {
    if(ctxColab && canvasColab) {
        ctxColab.clearRect(0, 0, canvasColab.width, canvasColab.height);
        hasColabSig = false;
    }
}

window.limparAssinaturaEntregador = function() {
    if(ctxEntregador && canvasEntregador) {
        ctxEntregador.clearRect(0, 0, canvasEntregador.width, canvasEntregador.height);
        hasEntregadorSig = false;
    }
}

window.irParaPassoEntregador = function() {
    if (!hasColabSig) {
        Swal.fire({
            title: 'Assinatura Ausente',
            text: "O colaborador ainda não assinou. Tem certeza que deseja pular esta assinatura?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sim, pular',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                document.getElementById('passoAssinaturaColab').style.display = 'none';
                document.getElementById('passoAssinaturaEntregador').style.display = 'block';
            }
        });
        return;
    }
    document.getElementById('passoAssinaturaColab').style.display = 'none';
    document.getElementById('passoAssinaturaEntregador').style.display = 'block';
}

window.voltarParaPassoColab = function() {
    document.getElementById('passoAssinaturaEntregador').style.display = 'none';
    document.getElementById('passoAssinaturaColab').style.display = 'block';
}

// ==================== FIM LÓGICA ASSINATURAS ====================

async function carregarDadosEntregas() {
    try {
        pecasEstoqueEntregas = await db.getPecas();
        
        if (window.supabaseClient) {
            // OBS: Removi o .limit(100) para permitir que o histórico completo seja buscado
            // e paginado. Caso comece a travar no futuro, limite a 500, 1000 ou aplique paginação direto na API
            let queryReqsOS = window.supabaseClient.from('os_pecas_utilizadas').select('*').order('id', { ascending: false });
            if (typeof window.aplicarFiltroFilial === 'function') queryReqsOS = window.aplicarFiltroFilial(queryReqsOS);
            const { data: reqsOS } = await queryReqsOS;
            
            let queryReqsColab = window.supabaseClient.from('almoxarifado_requisicoes').select('*').order('id', { ascending: false });
            if (typeof window.aplicarFiltroFilial === 'function') queryReqsColab = window.aplicarFiltroFilial(queryReqsColab);
            const { data: reqsColab } = await queryReqsColab;

            let unificadas = [];
            if(reqsOS) reqsOS.forEach(r => unificadas.push({ ...r, source_table: 'os_pecas_utilizadas' }));
            if(reqsColab) reqsColab.forEach(r => unificadas.push({ ...r, source_table: 'almoxarifado_requisicoes' }));
            
            unificadas.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            requisicoesEstoqueEntregas = unificadas;
        }

        renderizarTabelaPorAba();
    } catch (e) { console.error("Erro ao carregar requisições para entregas", e); }
}


window.abrirModalAprovacaoGrupoEntregas = function(dataReq, sourceTable, identificador) {
    grupoAvaliacaoAtualEntregas = requisicoesEstoqueEntregas.filter(r => 
        r.created_at === dataReq && r.source_table === sourceTable && 
        (r.colaborador_nome === identificador || String(r.os_id) === identificador || r.centro_custo === identificador) &&
        (r.status === 'Pendente' || !r.status)
    );

    if(grupoAvaliacaoAtualEntregas.length === 0) { 
        Swal.fire({icon: 'info', title: 'Aviso', text: 'Nenhum item pendente neste pedido.'});
        return; 
    }

    document.getElementById('modalApOrigemEntregas').innerText = sourceTable === 'almoxarifado_requisicoes' ? '(Termo de Colaborador)' : '(Uso Interno / Oficina)';
    document.getElementById('modalApDestinoEntregas').innerText = identificador;

    const tbody = document.getElementById('tbodyAprovacaoGrupoEntregas');
    tbody.innerHTML = '';

    grupoAvaliacaoAtualEntregas.forEach((req, index) => {
        const peca = pecasEstoqueEntregas.find(p => String(p.id) === String(req.peca_id));
        const nome = peca ? peca.nome : 'Peça Desconhecida / Excluída';
        const estoque = peca ? peca.quantidade : 0;
        const faltaEstoque = estoque < req.quantidade;
        
        let selectColor = faltaEstoque ? '#ef4444' : '#3b82f6';
        let selectBg = faltaEstoque ? 'rgba(239, 68, 68, 0.2)' : '#0f172a';

        let htmlSelect = `
            <select id="decisaoEntregas_${index}" class="input-table-sm" style="background:${selectBg}; padding:8px; border-radius:6px; color:#fff; border:1px solid ${selectColor}; width:100%; outline:none; font-weight:bold;">
                ${faltaEstoque ? '' : '<option value="Aprovado" style="background:#0f172a; color:#fff;">✅ Aprovar e Entregar</option>'}
                <option value="Recusado" ${faltaEstoque ? 'selected' : ''} style="background:#0f172a; color:#fff;">❌ Recusar Item</option>
                <option value="Pendente" ${!faltaEstoque ? 'selected' : ''} style="background:#0f172a; color:#fff;">⏳ Deixar Pendente</option>
            </select>
        `;

        tbody.innerHTML += `
            <tr style="border-bottom:1px solid #334155;">
                <td style="padding:12px; color:#f8fafc;">${nome} <br><small style="color:#94a3b8; font-family:monospace;">${peca ? peca.codigo || 'S/N' : ''}</small>${faltaEstoque ? '<br><span style="color:#ef4444; font-size:0.8rem; font-weight:bold;"><i class="fas fa-exclamation-triangle"></i> Estoque Insuficiente</span>' : ''}</td>
                <td style="padding:12px; text-align:center; font-weight:bold; color:#60a5fa; font-size:1.1rem;">${req.quantidade}</td>
                <td style="padding:12px; text-align:center; font-weight:bold; color:${faltaEstoque ? '#ef4444' : '#34d399'}; font-size:1.1rem;">${estoque}</td>
                <td style="padding:12px; text-align:center; min-width: 170px;">${htmlSelect}</td>
            </tr>
        `;
    });

    document.getElementById('modalAprovacaoReqEntregas').style.display = 'flex';
}

window.confirmarAvaliacaoGrupoEntregas = async function() {
    const btn = document.getElementById('btnConfirmarAvaliacaoEntregas');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...'; btn.disabled = true;

    let itensAprovadosParaTermo = [];
    let aprovouAlgo = false;

    try {
        for(let i = 0; i < grupoAvaliacaoAtualEntregas.length; i++) {
            const req = grupoAvaliacaoAtualEntregas[i];
            const decisao = document.getElementById(`decisaoEntregas_${i}`).value;
            if (decisao === 'Pendente') continue; 

            const peca = pecasEstoqueEntregas.find(p => String(p.id) === String(req.peca_id));

            if (decisao === 'Aprovado') {
                const table = req.source_table === 'almoxarifado_requisicoes' ? 'almoxarifado_requisicoes' : 'os_pecas_utilizadas';
                await window.supabaseClient.from(table).update({ status: 'Aprovado' }).eq('id', req.id);
                
                let novaMovimentacao = {
                    peca_id: req.peca_id, tipo: 'saida', quantidade: req.quantidade, 
                    valor_unitario: req.valor_unitario || (peca ? peca.preco_medio : 0),
                    usuario: window.currentUser ? window.currentUser.username : 'Sistema', 
                    data_movimentacao: new Date().toISOString()
                };

                if (req.source_table === 'almoxarifado_requisicoes') { novaMovimentacao.setor_destino = 'Colaborador: ' + req.colaborador_nome; novaMovimentacao.nota_fiscal = `RM-RH #${req.id}`; } 
                else {
                    if (req.centro_custo) { novaMovimentacao.setor_destino = req.centro_custo; novaMovimentacao.nota_fiscal = `RM-Int #${req.id}`; } 
                    else { novaMovimentacao.cavalo = req.placa || 'Oficina'; novaMovimentacao.os_id = req.os_id; novaMovimentacao.nota_fiscal = `O.S #${req.os_id}`; }
                }

                await db.addMovimentacao(novaMovimentacao);
                itensAprovadosParaTermo.push(req);
                aprovouAlgo = true;

            } else if (decisao === 'Recusado') {
                const table = req.source_table === 'almoxarifado_requisicoes' ? 'almoxarifado_requisicoes' : 'os_pecas_utilizadas';
                await window.supabaseClient.from(table).update({ status: 'Recusado' }).eq('id', req.id);
            }
        }

        fecharModalEntregas('modalAprovacaoReqEntregas');
        
        if (aprovouAlgo && grupoAvaliacaoAtualEntregas[0].source_table === 'almoxarifado_requisicoes') {
            itensPendentesParaAssinaturaEntregas = itensAprovadosParaTermo;
            
            document.getElementById('passoAssinaturaColab').style.display = 'block';
            document.getElementById('passoAssinaturaEntregador').style.display = 'none';
            document.getElementById('modalAssinaturaEntregas').style.display = 'flex';
            
            setTimeout(() => { 
                if(!canvasColab || !canvasEntregador) initSignaturePadEntregas(); 
                limparAssinaturaColab();
                limparAssinaturaEntregador();
            }, 200);
            
        } else {
            Swal.fire('Sucesso!', 'Avaliação processada e materiais liberados com sucesso!', 'success').then(() => {
                carregarDadosEntregas();
            });
        }

    } catch (e) { 
        console.error(e); 
        Swal.fire('Erro', 'Erro ao salvar avaliação.', 'error');
    } 
    finally { btn.innerHTML = '<i class="fas fa-arrow-right"></i> Prosseguir para Assinatura'; btn.disabled = false; }
}

function base64ParaBlob(base64, mimeType) {
    const byteCharacters = atob(base64.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

window.finalizarEntregaAssinadaEntregas = async function() {
    const btn = document.getElementById('btnSalvarAssinaturaEntregas');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; 
    btn.disabled = true;

    try {
        const idsParaAtualizar = itensPendentesParaAssinaturaEntregas.map(item => item.id);
        
        if (idsParaAtualizar.length > 0) {
            let colabUrl = null;
            let entregadorUrl = null;

            if (hasColabSig) {
                const blobColab = base64ParaBlob(canvasColab.toDataURL('image/png'), 'image/png');
                const nomeArqColab = `sig_colab_${Date.now()}_${Math.floor(Math.random()*1000)}.png`;
                const { error: err1 } = await window.supabaseClient.storage.from('assinaturas').upload(nomeArqColab, blobColab, { contentType: 'image/png' });
                if (!err1) {
                    colabUrl = window.supabaseClient.storage.from('assinaturas').getPublicUrl(nomeArqColab).data.publicUrl;
                }
            }

            if (hasEntregadorSig) {
                const blobEnt = base64ParaBlob(canvasEntregador.toDataURL('image/png'), 'image/png');
                const nomeArqEnt = `sig_ent_${Date.now()}_${Math.floor(Math.random()*1000)}.png`;
                const { error: err2 } = await window.supabaseClient.storage.from('assinaturas').upload(nomeArqEnt, blobEnt, { contentType: 'image/png' });
                if (!err2) {
                    entregadorUrl = window.supabaseClient.storage.from('assinaturas').getPublicUrl(nomeArqEnt).data.publicUrl;
                }
            }

            let updatePayload = { 
                data_assinatura: new Date().toISOString(),
                usuario_entregador: window.currentUser ? window.currentUser.username : 'Almoxarifado'
            };
            
            if (colabUrl) updatePayload.assinatura_url = colabUrl;
            if (entregadorUrl) updatePayload.assinatura_entregador_url = entregadorUrl;

            for (let idReq of idsParaAtualizar) {
                const { error: dbError } = await window.supabaseClient.from('almoxarifado_requisicoes')
                    .update(updatePayload)
                    .eq('id', idReq);
                    
                if (dbError) throw dbError;
            }
            
            fecharModalEntregas('modalAssinaturaEntregas');
            
            Swal.fire({
                title: 'Sucesso!',
                text: "Assinaturas salvas com sucesso! Deseja imprimir o Termo de Entrega agora?",
                icon: 'success',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#6c757d',
                confirmButtonText: '<i class="fas fa-print"></i> Sim, Imprimir',
                cancelButtonText: 'Não, apenas fechar'
            }).then((result) => {
                if (result.isConfirmed) {
                    const itensAtualizadosTemporariamente = itensPendentesParaAssinaturaEntregas.map(i => {
                        return { ...i, usuario_entregador: updatePayload.usuario_entregador };
                    });
                    imprimirTermoEntregaGrupoEntregas(itensAtualizadosTemporariamente, colabUrl, entregadorUrl); 
                }
            });

        } else {
            fecharModalEntregas('modalAssinaturaEntregas');
        }
        
        await carregarDadosEntregas();
        
    } catch(e) { 
        console.error(e); 
        Swal.fire('Erro', 'Erro ao salvar assinaturas. Verifique o console.', 'error');
    } finally { 
        btn.innerHTML = '<i class="fas fa-check"></i> Finalizar Entrega'; 
        btn.disabled = false; 
    }
}

window.estornarRequisicaoGrupoEntregas = function(dataReq, sourceTable, identificador) {
    const itensGrupo = requisicoesEstoqueEntregas.filter(r => 
        r.created_at === dataReq && r.source_table === sourceTable && 
        (r.colaborador_nome === identificador || String(r.os_id) === identificador || r.centro_custo === identificador) &&
        r.status === 'Aprovado'
    );
    
    if(itensGrupo.length === 0) { 
        Swal.fire('Atenção', 'Nenhum item aprovado neste pedido.', 'warning');
        return; 
    }
    
    Swal.fire({
        title: 'Confirmar Estorno',
        text: "Deseja CANCELAR este pedido e DEVOLVER todos os itens ao estoque?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sim, Estornar!',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if(result.isConfirmed) {
            try {
                for(let req of itensGrupo) {
                    const peca = pecasEstoqueEntregas.find(p => String(p.id) === String(req.peca_id));
                    const table = sourceTable === 'almoxarifado_requisicoes' ? 'almoxarifado_requisicoes' : 'os_pecas_utilizadas';
                    await window.supabaseClient.from(table).update({ status: 'Devolvido' }).eq('id', req.id);
                    
                    let novaMovimentacao = {
                        peca_id: req.peca_id, tipo: 'entrada', quantidade: req.quantidade, 
                        valor_unitario: req.valor_unitario || (peca ? peca.preco_medio : 0),
                        nota_fiscal: 'Estorno/Devolução', fornecedor: 'Devolução Interna',
                        usuario: window.currentUser ? window.currentUser.username : 'Sistema', 
                        data_movimentacao: new Date().toISOString()
                    };
                    await db.addMovimentacao(novaMovimentacao);
                }
                Swal.fire('Estornado!', 'O pedido foi devolvido ao estoque com sucesso.', 'success');
                await carregarDadosEntregas();
            } catch (e) { 
                console.error(e); 
                Swal.fire('Erro', 'Ocorreu um erro ao estornar.', 'error');
            }
        }
    });
}

window.reimprimirTermoGrupoEntregas = function(dataReq, sourceTable, identificador) {
    const itensGrupo = requisicoesEstoqueEntregas.filter(r => 
        r.created_at === dataReq && r.source_table === sourceTable && 
        (r.colaborador_nome === identificador || String(r.os_id) === identificador || r.centro_custo === identificador) &&
        r.status === 'Aprovado'
    );
    
    const urlColab = itensGrupo.length > 0 ? itensGrupo[0].assinatura_url : null;
    const urlEntregador = itensGrupo.length > 0 ? itensGrupo[0].assinatura_entregador_url : null;
    
    if(itensGrupo.length > 0) {
        imprimirTermoEntregaGrupoEntregas(itensGrupo, urlColab, urlEntregador);
    } else {
        Swal.fire('Aviso', 'Nenhum item aprovado encontrado para impressão.', 'info');
    }
}

window.imprimirTermoEntregaGrupoEntregas = function(itensGrupo, assinaturaColabUrl = null, assinaturaEntregadorUrl = null) {
    if(!itensGrupo || itensGrupo.length === 0) return;
    const reqBase = itensGrupo[0]; 
    const win = window.open('', '_blank', 'width=850,height=600');
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    
    let linhasTabela = '';
    itensGrupo.forEach(item => {
        const peca = pecasEstoqueEntregas.find(p => String(p.id) === String(item.peca_id)) || {unidade:'UN', codigo:'S/N', nome:'Produto Desconhecido'};
        linhasTabela += `<tr><td class="text-center">${item.quantidade}</td><td class="text-center">${peca.unidade || 'UN'}</td><td>${peca.codigo || 'S/N'}</td><td>${peca.nome}</td><td class="text-center">${dataAtual}</td></tr>`;
    });

    let imgColab = assinaturaColabUrl ? `<img src="${assinaturaColabUrl}" style="max-height: 85px; max-width: 100%; object-fit: contain;">` : '';
    let imgEnt = assinaturaEntregadorUrl ? `<img src="${assinaturaEntregadorUrl}" style="max-height: 85px; max-width: 100%; object-fit: contain;">` : '';

    win.document.write(`
    <html>
    <head>
        <title>Termo de Entrega - ${reqBase.colaborador_nome}</title>
        <style>
            body { font-family: 'Arial', sans-serif; margin: 40px; color: #000; display: flex; flex-direction: column; min-height: 90vh; } 
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; } 
            .header-text { text-align: left; }
            .header-text h1 { margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; } 
            .header-text p { margin: 5px 0 0 0; font-size: 14px; color: #333; }
            .logo { max-height: 50px; width: auto; }
            .content { font-size: 14px; line-height: 1.6; text-align: justify; flex-grow: 1; } 
            .table-info { width: 100%; border-collapse: collapse; margin-top: 25px; font-size: 13px; } 
            .table-info th, .table-info td { border: 1px solid #555; padding: 12px 10px; text-align: left; } 
            .table-info th { background-color: #f1f5f9; text-transform: uppercase; font-size: 12px; } 
            .text-center { text-align: center !important; }
            
            .signature-container { display: flex; justify-content: space-between; margin-top: 120px; padding: 0 20px; page-break-inside: avoid; } 
            .signature-box { text-align: center; width: 40%; } 
            .img-wrapper { height: 90px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;}
            .signature-line { width: 100%; border-top: 1px solid #000; margin-bottom: 8px; }
            .signature-name { font-size: 14px; font-weight: bold; text-transform: uppercase; }
            .signature-role { font-size: 12px; color: #444; }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="header-text">
                <h1>TERMO DE RESPONSABILIDADE E ENTREGA</h1>
                <p>Serrana Florestal - Gestão de Almoxarifado</p>
            </div>
            <img src="assets/logoverde.png" class="logo" alt="Serrana Florestal">
        </div>
        <div class="content">
            <p>Eu, <strong>${reqBase.colaborador_nome}</strong>, declaro para os devidos fins legais que recebi da empresa Serrana Florestal, o(s) equipamento(s)/material(is) abaixo discriminado(s), de forma gratuita, em perfeito estado de conservação e funcionamento.</p>
            <p>Comprometo-me a utilizá-lo(s) estritamente para a finalidade a que se destina(m) em minhas atividades laborais, responsabilizando-me por sua guarda, correta utilização e conservação. Estou ciente de que, em caso de dano por mau uso ou extravio, deverei comunicar imediatamente a liderança. Em caso de desligamento da empresa, me comprometo a devolver os materiais não descartáveis.</p>
            <table class="table-info">
                <thead>
                    <tr>
                        <th class="text-center" style="width: 8%;">Qtd.</th>
                        <th class="text-center" style="width: 8%;">Unid.</th>
                        <th style="width: 15%;">Código/CA</th>
                        <th style="width: 50%;">Descrição do Produto</th>
                        <th class="text-center" style="width: 19%;">Data Entrega</th>
                    </tr>
                </thead>
                <tbody>${linhasTabela}</tbody>
            </table>
        </div>
        <div class="signature-container">
            <div class="signature-box">
                <div class="img-wrapper">${imgColab}</div>
                <div class="signature-line"></div>
                <div class="signature-name">${reqBase.colaborador_nome}</div>
                <div class="signature-role">Assinatura do Colaborador</div>
            </div>
            
            <div class="signature-box">
                <div class="img-wrapper">${imgEnt}</div>
                <div class="signature-line"></div>
                <div class="signature-name">${reqBase.usuario_entregador || 'Almoxarifado'}</div>
                <div class="signature-role">Responsável pela Entrega</div>
            </div>
        </div>
        <script>setTimeout(() => { window.print(); window.close(); }, 500);</script>
    </body>
    </html>`);
    win.document.close();
}

window.fecharModalEntregas = function(id) { 
    document.getElementById(id).style.display = 'none'; 
}