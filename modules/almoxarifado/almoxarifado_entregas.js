// ==================== modules/almoxarifado/almoxarifado_entregas.js ====================

let pecasEstoqueEntregas = [];
let requisicoesEstoqueEntregas = [];
let grupoAvaliacaoAtualEntregas = [];
let canvasAssinaturaEntregas, ctxAssinaturaEntregas, desenhandoEntregas = false;
let itensPendentesParaAssinaturaEntregas = [];

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

function initSignaturePadEntregas() {
    canvasAssinaturaEntregas = document.getElementById('canvasAssinaturaEntregas');
    if(!canvasAssinaturaEntregas) return;
    ctxAssinaturaEntregas = canvasAssinaturaEntregas.getContext('2d');
    ctxAssinaturaEntregas.lineWidth = 3;
    ctxAssinaturaEntregas.lineCap = 'round';
    ctxAssinaturaEntregas.strokeStyle = '#000';

    const getPos = (e) => {
        const rect = canvasAssinaturaEntregas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const scaleX = canvasAssinaturaEntregas.width / rect.width;
        const scaleY = canvasAssinaturaEntregas.height / rect.height;
        return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    };

    const iniciarDesenho = (e) => { e.preventDefault(); desenhandoEntregas = true; const pos = getPos(e); ctxAssinaturaEntregas.beginPath(); ctxAssinaturaEntregas.moveTo(pos.x, pos.y); };
    const desenhar = (e) => { if (!desenhandoEntregas) return; e.preventDefault(); const pos = getPos(e); ctxAssinaturaEntregas.lineTo(pos.x, pos.y); ctxAssinaturaEntregas.stroke(); };
    const pararDesenho = () => { desenhandoEntregas = false; ctxAssinaturaEntregas.closePath(); };

    canvasAssinaturaEntregas.addEventListener("mousedown", iniciarDesenho);
    canvasAssinaturaEntregas.addEventListener("mousemove", desenhar);
    canvasAssinaturaEntregas.addEventListener("mouseup", pararDesenho);
    canvasAssinaturaEntregas.addEventListener("mouseout", pararDesenho);
    canvasAssinaturaEntregas.addEventListener("touchstart", iniciarDesenho, { passive: false });
    canvasAssinaturaEntregas.addEventListener("touchmove", desenhar, { passive: false });
    canvasAssinaturaEntregas.addEventListener("touchend", pararDesenho);
}

window.limparAssinaturaEntregas = function() {
    if(ctxAssinaturaEntregas && canvasAssinaturaEntregas) {
        ctxAssinaturaEntregas.clearRect(0, 0, canvasAssinaturaEntregas.width, canvasAssinaturaEntregas.height);
    }
}

async function carregarDadosEntregas() {
    try {
        pecasEstoqueEntregas = await db.getPecas();
        
        if (window.supabaseClient) {
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
            requisicoesEstoqueEntregas = unificadas;
        }

        atualizarTabelaEntregas(requisicoesEstoqueEntregas);
    } catch (e) { console.error("Erro ao carregar requisições para entregas", e); }
}

function atualizarTabelaEntregas(listaReqs) {
    const tbody = document.getElementById('tabelaEntregasBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if(listaReqs.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhuma requisição pendente.</td></tr>'; return; }

    const gruposReq = {};
    listaReqs.forEach(req => {
        let chave = '';
        if(req.source_table === 'almoxarifado_requisicoes') { chave = `${req.created_at}_${req.colaborador_nome}`; } 
        else { chave = `${req.created_at}_${req.os_id || req.centro_custo}`; }
        
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
        if(req.status === 'Pendente' || !req.status) { gruposReq[chave].status = 'Pendente'; }
        gruposReq[chave].itens.push(req);
    });

    Object.values(gruposReq).forEach(grupo => {
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

window.filtrarTabelaEntregas = function() {
    const termo = document.getElementById('entregasSearchInput').value.toLowerCase();
    atualizarTabelaEntregas(requisicoesEstoqueEntregas.filter(r => (r.placa||'').toLowerCase().includes(termo) || (r.mecanico_responsavel||'').toLowerCase().includes(termo) || (r.centro_custo||'').toLowerCase().includes(termo) || (r.colaborador_nome||'').toLowerCase().includes(termo)));
}

window.abrirModalAprovacaoGrupoEntregas = function(dataReq, sourceTable, identificador) {
    grupoAvaliacaoAtualEntregas = requisicoesEstoqueEntregas.filter(r => 
        r.created_at === dataReq && r.source_table === sourceTable && 
        (r.colaborador_nome === identificador || String(r.os_id) === identificador || r.centro_custo === identificador) &&
        (r.status === 'Pendente' || !r.status)
    );

    if(grupoAvaliacaoAtualEntregas.length === 0) { alert("Nenhum item pendente neste pedido."); return; }

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
            document.getElementById('modalAssinaturaEntregas').style.display = 'flex';
            setTimeout(() => { if(!canvasAssinaturaEntregas) initSignaturePadEntregas(); limparAssinaturaEntregas(); }, 200);
        } else {
            alert("Avaliação processada e materiais liberados com sucesso!");
            await carregarDadosEntregas();
        }

    } catch (e) { console.error(e); alert("Erro ao salvar avaliação."); } 
    finally { btn.innerHTML = '<i class="fas fa-arrow-right"></i> Prosseguir para Assinatura'; btn.disabled = false; }
}

// Função auxiliar: Converte Base64 para Blob para salvar no Supabase Storage
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
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando no Storage...'; 
    btn.disabled = true;

    try {
        const assinaturaBase64 = canvasAssinaturaEntregas.toDataURL('image/png');
        const idsParaAtualizar = itensPendentesParaAssinaturaEntregas.map(item => item.id);
        
        if (idsParaAtualizar.length > 0) {
            // 1. Converter Base64 para Blob (Arquivo PNG)
            const blobAssinatura = base64ParaBlob(assinaturaBase64, 'image/png');
            
            // 2. Criar um nome único para o arquivo
            const nomeArquivo = `assinatura_req_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;

            // 3. Fazer o Upload para o Supabase Storage
            const { data: uploadData, error: uploadError } = await window.supabaseClient.storage
                .from('assinaturas')
                .upload(nomeArquivo, blobAssinatura, {
                    contentType: 'image/png',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            // 4. Pegar a URL pública da imagem que acabou de ser salva
            const { data: urlData } = window.supabaseClient.storage
                .from('assinaturas')
                .getPublicUrl(nomeArquivo);
                
            const assinaturaUrl = urlData.publicUrl;

            // 5. Salvar APENAS a URL no banco de dados
            const { error: dbError } = await window.supabaseClient.from('almoxarifado_requisicoes')
                .update({ assinatura_url: assinaturaUrl, data_assinatura: new Date().toISOString() })
                .in('id', idsParaAtualizar);

            if (dbError) throw dbError;
            
            fecharModalEntregas('modalAssinaturaEntregas');
            if (confirm("Assinatura salva com sucesso! Deseja imprimir o Termo de Entrega agora?")) { 
                imprimirTermoEntregaGrupoEntregas(itensPendentesParaAssinaturaEntregas, assinaturaUrl); 
            }
        } else {
            fecharModalEntregas('modalAssinaturaEntregas');
        }
        
        await carregarDadosEntregas();
        
    } catch(e) { 
        console.error(e); 
        alert("Erro ao salvar assinatura. Verifique o console."); 
    } finally { 
        btn.innerHTML = '<i class="fas fa-check"></i> Confirmar Entrega'; 
        btn.disabled = false; 
    }
}

window.estornarRequisicaoGrupoEntregas = async function(dataReq, sourceTable, identificador) {
    const itensGrupo = requisicoesEstoqueEntregas.filter(r => 
        r.created_at === dataReq && r.source_table === sourceTable && 
        (r.colaborador_nome === identificador || String(r.os_id) === identificador || r.centro_custo === identificador) &&
        r.status === 'Aprovado'
    );
    if(itensGrupo.length === 0) { alert("Nenhum item aprovado neste pedido."); return; }
    if(!confirm(`Deseja CANCELAR este pedido e DEVOLVER todos os itens ao estoque?`)) return;

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
        alert("Pedido estornado!"); await carregarDadosEntregas();
    } catch (e) { console.error(e); alert("Erro ao estornar."); }
}

window.reimprimirTermoGrupoEntregas = function(dataReq, sourceTable, identificador) {
    const itensGrupo = requisicoesEstoqueEntregas.filter(r => 
        r.created_at === dataReq && r.source_table === sourceTable && 
        (r.colaborador_nome === identificador || String(r.os_id) === identificador || r.centro_custo === identificador) &&
        r.status === 'Aprovado'
    );
    // Recupera a assinaturaUrl dos itens se ela existir (normalmente todos do grupo têm a mesma)
    const assinaturaRecuperada = itensGrupo.length > 0 ? itensGrupo[0].assinatura_url : null;
    
    if(itensGrupo.length > 0) imprimirTermoEntregaGrupoEntregas(itensGrupo, assinaturaRecuperada);
    else alert("Nenhum item aprovado encontrado para impressão.");
}

window.imprimirTermoEntregaGrupoEntregas = function(itensGrupo, assinaturaUrl = null) {
    if(!itensGrupo || itensGrupo.length === 0) return;
    const reqBase = itensGrupo[0]; 
    const win = window.open('', '_blank', 'width=850,height=600');
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    
    let linhasTabela = '';
    itensGrupo.forEach(item => {
        const peca = pecasEstoqueEntregas.find(p => String(p.id) === String(item.peca_id)) || {unidade:'UN', codigo:'S/N', nome:'Produto Desconhecido'};
        linhasTabela += `<tr><td style="text-align:center;">${item.quantidade}</td><td style="text-align:center;">${peca.unidade || 'UN'}</td><td>${peca.codigo || 'S/N'}</td><td>${peca.nome}</td><td style="text-align:center;">${dataAtual}</td></tr>`;
    });

    let assinaturaHtml = assinaturaUrl ? `<img src="${assinaturaUrl}" style="max-height: 80px; max-width: 100%; border-bottom: 1px solid #000; margin-bottom: 5px;">` : `<div class="signature-line"></div>`;

    win.document.write(`<html><head><title>Termo de Entrega - ${reqBase.colaborador_nome}</title><style>body { font-family: 'Arial', sans-serif; margin: 40px; color: #000; } .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; } .header h1 { margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px; } .content { font-size: 14px; line-height: 1.6; text-align: justify; margin-bottom: 30px; } .table-info { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; } .table-info th, .table-info td { border: 1px solid #000; padding: 12px; text-align: left; } .table-info th { background-color: #f0f0f0; } .signature-container { display: flex; justify-content: space-between; margin-top: 80px; } .signature-box { text-align: center; width: 45%; } .signature-line { width: 100%; border-top: 1px solid #000; margin-bottom: 10px; }</style></head><body><div class="header"><h1>TERMO DE RESPONSABILIDADE E ENTREGA DE EPI / MATERIAIS</h1><p>Serrana Florestal - Gestão de Almoxarifado</p></div><div class="content"><p>Eu, <strong>${reqBase.colaborador_nome}</strong>, declaro para os devidos fins legais que recebi da empresa Serrana Florestal, o(s) equipamento(s)/material(is) abaixo discriminado(s), de forma gratuita, em perfeito estado de conservação e funcionamento.</p><p>Comprometo-me a utilizá-lo(s) estritamente para a finalidade a que se destina(m) em minhas atividades laborais, responsabilizando-me por sua guarda, correta utilização e conservação. Estou ciente de que, em caso de dano por mau uso ou extravio, deverei comunicar imediatamente a liderança. Em caso de desligamento da empresa, me comprometo a devolver os materiais não descartáveis.</p><table class="table-info"><thead><tr><th style="width: 10%; text-align:center;">Qtd.</th><th style="width: 10%; text-align:center;">Unid.</th><th style="width: 20%;">Código/CA</th><th style="width: 45%;">Descrição do Produto</th><th style="width: 15%; text-align:center;">Data Entrega</th></tr></thead><tbody>${linhasTabela}</tbody></table></div><div class="signature-container"><div class="signature-box">${assinaturaHtml}<strong>${reqBase.colaborador_nome}</strong><br>Assinatura do Colaborador</div><div class="signature-box"><div class="signature-line"></div><strong>${reqBase.usuario_solicitante || 'Almoxarifado'}</strong><br>Responsável pela Entrega</div></div><script>setTimeout(() => { window.print(); window.close(); }, 500);</script></body></html>`);
    win.document.close();
}

window.fecharModalEntregas = function(id) { document.getElementById(id).style.display = 'none'; }