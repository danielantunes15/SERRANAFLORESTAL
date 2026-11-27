// ==================== modules/almoxarifado/entregas_requisicoes/almoxarifado_entregas.js ====================

let pecasEstoqueEntregas = [];
let requisicoesEstoqueEntregas = [];
let grupoAvaliacaoAtualEntregas = [];
let itensPendentesParaAssinaturaEntregas = [];
let gruposFiltradosUltimoRender = [];

// Modo Expresso
let itensExpressosAtuais = [];
let osExpressaLida = null;

// Abas, Paginação e Auto-Refresh
let abaAtualEntregas = 'pendentes';
let paginaAtualHistorico = 1;
const itensPorPagina = 12;
let timerAutoRefreshEntregas = null;
let ultimoTotalPendentes = null;

// Assinaturas
let canvasColab = null, ctxColab = null, isDrawingColab = false, hasColabSig = false;
let canvasEntregador = null, ctxEntregador = null, isDrawingEntregador = false, hasEntregadorSig = false;

window.renderizarAlmoxarifadoEntregas = async function() {
    injetarModalAprovacaoEntregas();
    await carregarDadosEntregas();
};

function injetarModalAprovacaoEntregas() {
    const antigo = document.getElementById('modalAprovacaoReqEntregas');
    if (antigo) antigo.remove();

    const modalHtml = `
    <div id="modalAprovacaoReqEntregas" class="almo-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.8); backdrop-filter:blur(5px); z-index:10000; align-items:center; justify-content:center; padding: 10px;">
        <div class="almo-modal-content" style="background:#1e293b; color:#e2e8f0; width:100%; max-width:900px; max-height:90vh; overflow-y:auto; border-radius:16px; padding:22px; border:1px solid #334155; position:relative;">
            <span class="almo-close" onclick="fecharModalEntregas('modalAprovacaoReqEntregas')">&times;</span>
            <h3 style="color:#38bdf8; margin-top:0; font-size:1.4rem; display:flex; align-items:center; gap:10px; flex-wrap: wrap;">
                <i class="fas fa-clipboard-check"></i> Avaliar & Separar Entrega <span id="modalApOrigemEntregas" style="font-size:0.9rem; color:#94a3b8; font-weight:normal;"></span>
            </h3>
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
                <p style="color:#94a3b8; font-size:0.95rem; margin:0;">Destino / Solicitante: <strong id="modalApDestinoEntregas" style="color:#f8fafc; font-size:1rem;"></strong></p>
                <button type="button" class="btn-modern btn-success" style="padding:7px 14px; font-size:0.85rem; width:auto;" onclick="aprovarTodosComSaldo()">
                    <i class="fas fa-check-double"></i> Aprovar Todos com Saldo
                </button>
            </div>
            
            <div class="almo-table-container" style="background:#0f172a; border-radius:8px; border:1px solid #334155; overflow-x:auto;">
                <table class="almo-table" style="width:100%; min-width: 650px;">
                    <thead style="background:#1e293b;">
                        <tr>
                            <th>Produto & Localização</th>
                            <th style="text-align:center;">Solicitado</th>
                            <th style="text-align:center;">Entregar (Edit.)</th>
                            <th style="text-align:center;">Estoque</th>
                            <th style="text-align:center;">Decisão</th>
                        </tr>
                    </thead>
                    <tbody id="tbodyAprovacaoGrupoEntregas"></tbody>
                </table>
            </div>
            <div style="margin-top:18px; display:flex; gap:10px; justify-content:flex-end; flex-wrap: wrap;">
                <button class="btn-modern btn-dark" onclick="fecharModalEntregas('modalAprovacaoReqEntregas')" style="flex: 1; min-width: 120px;">Cancelar</button>
                <button class="btn-modern btn-primary" id="btnConfirmarAvaliacaoEntregas" onclick="confirmarAvaliacaoGrupoEntregas()" style="flex: 2; min-width: 220px;"><i class="fas fa-arrow-right"></i> Confirmar / Ir p/ Assinatura</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// ==================== AUTO-REFRESH ====================
window.toggleAutoRefreshEntregas = function(ativo) {
    if (timerAutoRefreshEntregas) {
        clearInterval(timerAutoRefreshEntregas);
        timerAutoRefreshEntregas = null;
    }
    if (ativo) {
        timerAutoRefreshEntregas = setInterval(() => {
            if (document.getElementById('tabelaEntregasBody')) {
                carregarDadosEntregas(false, true);
            } else {
                clearInterval(timerAutoRefreshEntregas);
                timerAutoRefreshEntregas = null;
            }
        }, 30000);
    }
};

// ==================== MODO EXPRESSO (LEITOR QR / BARRAS) ====================
window.abrirEntregaExpressa = function() {
    const inpOS = document.getElementById('inputExpressOS');
    const inpPeca = document.getElementById('inputExpressPeca');
    inpOS.value = ''; inpOS.disabled = false; inpOS.style.borderColor = '#3b82f6';
    inpPeca.value = ''; inpPeca.disabled = true; inpPeca.style.borderColor = '#64748b'; inpPeca.placeholder = 'Aguardando O.S...';
    document.getElementById('btnCameraPeca').disabled = true;
    document.getElementById('btnConfirmarExpress').disabled = true;
    document.getElementById('expressOsResumo').style.display = 'none';
    document.getElementById('tbodyExpressPecas').innerHTML = '<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 35px; font-style: italic;">Aguardando leitura do QR Code da O.S...</td></tr>';
    
    itensExpressosAtuais = [];
    osExpressaLida = null;
    document.getElementById('modalEntregaExpressa').style.display = 'flex';
    setTimeout(() => { if (inpOS) inpOS.focus(); }, 250);
};

window.processarLeituraOS = async function(valorLido) {
    const val = valorLido.trim().toUpperCase();
    const osIdStr = val.replace('OS-', '').replace(/^0+/, '');
    const inputOS = document.getElementById('inputExpressOS');
    inputOS.value = val;

    if (!osIdStr) {
        Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Código Inválido', showConfirmButton: false, timer: 2000 });
        inputOS.value = '';
        return;
    }

    const numeroLido = parseInt(osIdStr, 10);
    Swal.fire({ title: 'Buscando...', text: 'Sincronizando com a Oficina...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    try {
        const { data: osData, error: errOs } = await window.supabaseClient
            .from('ordens_servico')
            .select('id, numero_os, placa')
            .or(`id.eq.${numeroLido},numero_os.eq.${numeroLido}`);

        if (errOs || !osData || osData.length === 0) {
            Swal.fire('Erro', `A O.S. #${numeroLido} não existe no banco de dados.`, 'error');
            inputOS.value = '';
            return;
        }

        const idsReais = osData.map(o => String(o.id));
        await carregarDadosEntregas();
        Swal.close();

        const pendentes = requisicoesEstoqueEntregas.filter(r =>
            idsReais.includes(String(r.os_id)) && (r.status === 'Pendente' || !r.status)
        );

        if (pendentes.length === 0) {
            Swal.fire('Sem Pedidos Pendentes', `A O.S. #${numeroLido} não possui peças pendentes de entrega.`, 'warning');
            inputOS.value = '';
            return;
        }

        osExpressaLida = pendentes[0].os_id;
        itensExpressosAtuais = pendentes.map(req => {
            const peca = pecasEstoqueEntregas.find(p => String(p.id) === String(req.peca_id));
            return {
                ...req,
                peca_nome: peca ? peca.nome : 'Peça Desconhecida',
                peca_codigo: peca ? (peca.codigo || 'S/N') : 'S/N',
                peca_local: peca ? (peca.localizacao || 'S/N') : 'S/N',
                estoque_atual: peca ? parseFloat(peca.quantidade || 0) : 0,
                falta_estoque: peca ? parseFloat(peca.quantidade || 0) < parseFloat(req.quantidade || 0) : true,
                checked: false
            };
        });

        document.getElementById('expressResumoOsNum').innerText = `#${osData[0].numero_os || osExpressaLida}`;
        document.getElementById('expressResumoPlaca').innerText = pendentes[0].placa || osData[0].placa || 'Oficina';
        document.getElementById('expressResumoMecanico').innerText = pendentes[0].mecanico_responsavel || 'Mecânico';
        document.getElementById('expressOsResumo').style.display = 'flex';

        renderizarTabelaModoExpresso();

        inputOS.disabled = true;
        inputOS.style.borderColor = '#10b981';
        const inputPeca = document.getElementById('inputExpressPeca');
        inputPeca.disabled = false;
        inputPeca.style.borderColor = '#3b82f6';
        inputPeca.placeholder = 'Bipe o Cód. de Barras...';
        document.getElementById('btnCameraPeca').disabled = false;
        inputPeca.focus();
    } catch (e) {
        Swal.fire('Erro', 'Falha na conexão com o banco de dados.', 'error');
        console.error(e);
    }
};

window.verificarLeituraOS = function(event) {
    if (event.key === 'Enter') window.processarLeituraOS(event.target.value);
};

window.processarLeituraPeca = function(valorLido) {
    const val = valorLido.trim().toUpperCase();
    if (!val) return;
    const inputPeca = document.getElementById('inputExpressPeca');
    const indexItem = itensExpressosAtuais.findIndex(i => !i.checked && i.peca_codigo.toUpperCase() === val);

    if (indexItem === -1) {
        const jaChecado = itensExpressosAtuais.findIndex(i => i.checked && i.peca_codigo.toUpperCase() === val);
        if (jaChecado !== -1) {
            Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'Peça já conferida!', text: val, showConfirmButton: false, timer: 2000 });
        } else {
            Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Código Inválido', text: 'Esta peça não está no pedido.', showConfirmButton: false, timer: 2500 });
        }
    } else if (itensExpressosAtuais[indexItem].falta_estoque) {
        Swal.fire('Estoque Insuficiente', `O item ${itensExpressosAtuais[indexItem].peca_nome} não tem saldo suficiente.`, 'error');
    } else {
        itensExpressosAtuais[indexItem].checked = true;
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Peça Confirmada!', text: itensExpressosAtuais[indexItem].peca_nome, showConfirmButton: false, timer: 1500 });
        renderizarTabelaModoExpresso();
        if (itensExpressosAtuais.every(i => i.checked || i.falta_estoque)) {
            if (typeof window.pararLeituraCamera === 'function') window.pararLeituraCamera();
            Swal.fire({ toast: true, position: 'center', icon: 'success', title: 'Todas as peças separadas!', text: 'Clique em Confirmar Baixa para finalizar.', showConfirmButton: false, timer: 3000 });
        }
    }
    inputPeca.value = '';
    inputPeca.focus();
};

window.verificarLeituraPeca = function(event) {
    if (event.key === 'Enter') window.processarLeituraPeca(event.target.value);
};

window.toggleCheckManualExpresso = function(index) {
    if (!itensExpressosAtuais[index].checked && itensExpressosAtuais[index].falta_estoque) {
        Swal.fire('Estoque Insuficiente', 'Item sem saldo suficiente no estoque.', 'error');
        return;
    }
    itensExpressosAtuais[index].checked = !itensExpressosAtuais[index].checked;
    renderizarTabelaModoExpresso();
    if (itensExpressosAtuais.every(i => i.checked || i.falta_estoque) && typeof window.pararLeituraCamera === 'function') {
        window.pararLeituraCamera();
    }
    const inputPeca = document.getElementById('inputExpressPeca');
    if (inputPeca && !inputPeca.disabled) inputPeca.focus();
};

window.renderizarTabelaModoExpresso = function() {
    const tbody = document.getElementById('tbodyExpressPecas');
    tbody.innerHTML = '';

    itensExpressosAtuais.forEach((item, index) => {
        const iconeCheck = item.checked
            ? '<i class="fas fa-check-circle" style="color: #10b981; font-size: 1.6rem;"></i>'
            : '<i class="far fa-circle" style="color: #475569; font-size: 1.6rem;"></i>';
        const linhaEstilo = item.checked ? 'background: rgba(16, 185, 129, 0.1); border-left: 4px solid #10b981;' : 'border-left: 4px solid transparent;';
        const btnManual = item.checked
            ? `<button class="btn-action-sm btn-dark" onclick="toggleCheckManualExpresso(${index})" title="Desmarcar"><i class="fas fa-undo"></i></button>`
            : `<button class="btn-action-sm btn-success" onclick="toggleCheckManualExpresso(${index})" title="Marcar Manualmente"><i class="fas fa-check"></i> Manual</button>`;
        const infoEstoque = item.falta_estoque ? `<span style="color:#ef4444; font-size:0.78rem; font-weight:bold; margin-left:6px;"><i class="fas fa-exclamation-triangle"></i> Sem saldo (${item.estoque_atual})</span>` : '';

        tbody.innerHTML += `
            <tr style="border-bottom:1px solid #334155; ${linhaEstilo}">
                <td style="text-align: center;">${iconeCheck}</td>
                <td style="color: #60a5fa; font-family: monospace; font-weight:bold;">${item.peca_codigo}</td>
                <td style="color: #f8fafc; font-weight: 500;">
                    ${item.peca_nome} ${infoEstoque}<br>
                    <span class="badge-loc"><i class="fas fa-map-marker-alt"></i> ${item.peca_local}</span>
                </td>
                <td style="text-align: center; font-weight: 900; font-size: 1.15rem; color: #fff;">${item.quantidade}</td>
                <td style="text-align: center;">${btnManual}</td>
            </tr>
        `;
    });

    document.getElementById('btnConfirmarExpress').disabled = !itensExpressosAtuais.some(i => i.checked);
};

window.confirmarEntregaExpressa = async function() {
    const itensParaBaixar = itensExpressosAtuais.filter(i => i.checked);
    if (itensParaBaixar.length === 0) return;

    if (itensParaBaixar.length < itensExpressosAtuais.length) {
        const conf = await Swal.fire({
            title: 'Entrega Parcial',
            text: 'Nem todas as peças foram separadas. Deseja entregar apenas os itens confirmados?',
            icon: 'warning', showCancelButton: true,
            confirmButtonColor: '#10b981', cancelButtonColor: '#64748b',
            confirmButtonText: 'Sim, finalizar assim'
        });
        if (!conf.isConfirmed) return;
    }

    const btn = document.getElementById('btnConfirmarExpress');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
    btn.disabled = true;

    try {
        const username = window.currentUser ? window.currentUser.username : 'Almoxarifado';
        const dataBaixa = new Date().toISOString();

        for (const req of itensParaBaixar) {
            const tabelaBase = req.source_table === 'almoxarifado_requisicoes' ? 'almoxarifado_requisicoes' : 'os_pecas_utilizadas';
            await window.supabaseClient.from(tabelaBase).update({ status: 'Aprovado', usuario_entregador: username, data_assinatura: dataBaixa }).eq('id', req.id);
            
            const pecaObj = pecasEstoqueEntregas.find(p => String(p.id) === String(req.peca_id));
            await db.addMovimentacao({
                peca_id: req.peca_id, tipo: 'saida', quantidade: req.quantidade,
                valor_unitario: req.valor_unitario || (pecaObj ? pecaObj.preco_medio : 0),
                usuario: username, data_movimentacao: dataBaixa,
                cavalo: req.placa || 'Oficina', os_id: req.os_id,
                nota_fiscal: `O.S #${req.os_id} (Expresso)`
            });
        }

        fecharModalEntregas('modalEntregaExpressa');
        Swal.fire('Baixa Concluída!', 'Os produtos separados foram baixados do estoque com sucesso.', 'success');
        await carregarDadosEntregas();
    } catch (e) {
        console.error("Erro na entrega expressa:", e);
        Swal.fire('Erro', 'Ocorreu um erro ao tentar baixar os itens.', 'error');
    } finally {
        btn.innerHTML = '<i class="fas fa-check-double"></i> Confirmar Baixa e Entrega';
        btn.disabled = false;
    }
};

// ==================== ABAS, KPIS, FILTROS E PAGINAÇÃO ====================
function agruparRequisicoes(lista) {
    const gruposReq = {};
    lista.forEach(req => {
        const chave = req.source_table === 'almoxarifado_requisicoes'
            ? `${req.created_at}_${req.colaborador_nome}`
            : `${req.created_at}_${req.os_id || req.centro_custo}`;
        if (!gruposReq[chave]) {
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
        if (req.status === 'Pendente' || !req.status) gruposReq[chave].status = 'Pendente';
        gruposReq[chave].itens.push(req);
    });

    return Object.values(gruposReq).map(g => {
        let todosAprov = true, todosRec = true, todosDev = true, temPendente = false;
        g.itens.forEach(r => {
            const st = r.status || 'Pendente';
            if (st === 'Pendente') temPendente = true;
            if (st !== 'Aprovado') todosAprov = false;
            if (st !== 'Recusado') todosRec = false;
            if (st !== 'Devolvido') todosDev = false;
        });
        if (temPendente) g.statusFinal = 'Pendente';
        else if (todosAprov) g.statusFinal = 'Aprovado';
        else if (todosRec) g.statusFinal = 'Recusado';
        else if (todosDev) g.statusFinal = 'Devolvido';
        else g.statusFinal = 'Aprovado';
        return g;
    });
}

function atualizarKPIsEntregas(silencioso = false) {
    const todosGrupos = agruparRequisicoes(requisicoesEstoqueEntregas);
    const hojeStr = new Date().toLocaleDateString('pt-BR');

    const gruposPendentes = todosGrupos.filter(g => g.statusFinal === 'Pendente');
    const entreguesHoje = todosGrupos.filter(g => g.statusFinal === 'Aprovado' && g.data && new Date(g.data).toLocaleDateString('pt-BR') === hojeStr);
    const estornos = todosGrupos.filter(g => g.statusFinal === 'Devolvido');

    const pendentesSemSaldo = gruposPendentes.filter(g =>
        g.itens.some(item => {
            if (item.status && item.status !== 'Pendente') return false;
            const peca = pecasEstoqueEntregas.find(p => String(p.id) === String(item.peca_id));
            return !peca || parseFloat(peca.quantidade || 0) < parseFloat(item.quantidade || 0);
        })
    );

    const elPend = document.getElementById('kpiEntregasPendentes');
    const elBadge = document.getElementById('badgeContadorPendentes');
    if (elPend) elPend.innerText = gruposPendentes.length;
    if (elBadge) elBadge.innerText = gruposPendentes.length;
    if (document.getElementById('kpiEntregasHoje')) document.getElementById('kpiEntregasHoje').innerText = entreguesHoje.length;
    if (document.getElementById('kpiEntregasSemSaldo')) document.getElementById('kpiEntregasSemSaldo').innerText = pendentesSemSaldo.length;
    if (document.getElementById('kpiEntregasEstornos')) document.getElementById('kpiEntregasEstornos').innerText = estornos.length;

    if (silencioso && ultimoTotalPendentes !== null && gruposPendentes.length > ultimoTotalPendentes) {
        if (typeof window.tocarBipeSucesso === 'function') window.tocarBipeSucesso();
        Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'Nova requisição recebida!', showConfirmButton: false, timer: 3000 });
    }
    ultimoTotalPendentes = gruposPendentes.length;
}

window.filtrarEstornosRapido = function() {
    trocarAbaEntregas('historico');
    document.getElementById('filtroStatus').value = 'Devolvido';
    filtrarHistoricoEntregas();
};

window.trocarAbaEntregas = function(aba) {
    abaAtualEntregas = aba;
    paginaAtualHistorico = 1;
    
    ['pendentes', 'hoje', 'historico'].forEach(t => {
        const el = document.getElementById('tab-' + t);
        if (el) el.classList.toggle('active', aba === t);
    });
    
    document.getElementById('filtrosHistorico').style.display = aba === 'historico' ? 'flex' : 'none';
    document.getElementById('controleBuscaSimples').style.display = aba !== 'historico' ? 'flex' : 'none';
    document.getElementById('paginacaoEntregas').style.display = aba === 'historico' ? 'flex' : 'none';

    const resumo = document.getElementById('textoResumoAba');
    if (resumo) {
        resumo.innerHTML = aba === 'pendentes'
            ? '<i class="fas fa-info-circle" style="color: #38bdf8;"></i> Exibindo todas as requisições aguardando separação (de qualquer data).'
            : '<i class="fas fa-calendar-day" style="color: #34d399;"></i> Exibindo todas as requisições registradas na data de hoje.';
    }
    renderizarTabelaPorAba();
};

window.filtrarHistoricoEntregas = function() { paginaAtualHistorico = 1; renderizarTabelaPorAba(); };

window.limparFiltrosEntregas = function() {
    ['filtroSol', 'filtroPed', 'filtroDataInicio', 'filtroDataFim', 'filtroOrigem', 'filtroStatus'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    paginaAtualHistorico = 1;
    renderizarTabelaPorAba();
};

window.filtrarTabelaEntregas = function() { renderizarTabelaPorAba(); };
window.mudarPaginaEntregas = function(direcao) { paginaAtualHistorico += direcao; renderizarTabelaPorAba(); };

window.renderizarTabelaPorAba = function() {
    let dados = [...requisicoesEstoqueEntregas];

    if (abaAtualEntregas === 'hoje') {
        const hojeStr = new Date().toLocaleDateString('pt-BR');
        dados = dados.filter(req => req.created_at && new Date(req.created_at).toLocaleDateString('pt-BR') === hojeStr);
    }

    if (abaAtualEntregas !== 'historico') {
        const termo = (document.getElementById('entregasSearchInput')?.value || '').toLowerCase().trim();
        if (termo) {
            dados = dados.filter(r => {
                const peca = pecasEstoqueEntregas.find(p => String(p.id) === String(r.peca_id));
                const nomePeca = peca ? (peca.nome + ' ' + (peca.codigo || '')).toLowerCase() : '';
                return (r.placa || '').toLowerCase().includes(termo) ||
                    String(r.os_id || '').includes(termo) ||
                    (r.mecanico_responsavel || '').toLowerCase().includes(termo) ||
                    (r.centro_custo || '').toLowerCase().includes(termo) ||
                    (r.colaborador_nome || '').toLowerCase().includes(termo) ||
                    nomePeca.includes(termo);
            });
        }
    } else {
        const fSol = (document.getElementById('filtroSol')?.value || '').toLowerCase().trim();
        const fPed = (document.getElementById('filtroPed')?.value || '').toLowerCase().trim();
        const fDtIni = document.getElementById('filtroDataInicio')?.value || '';
        const fDtFim = document.getElementById('filtroDataFim')?.value || '';
        const fOrigem = document.getElementById('filtroOrigem')?.value || '';
        
        if (fSol) dados = dados.filter(r => (r.usuario_solicitante || r.mecanico_responsavel || '').toLowerCase().includes(fSol));
        if (fPed) dados = dados.filter(r => (r.colaborador_nome || r.os_id || r.centro_custo || r.placa || '').toString().toLowerCase().includes(fPed));
        if (fOrigem) dados = dados.filter(r => r.source_table === fOrigem);
        if (fDtIni || fDtFim) {
            dados = dados.filter(r => {
                if (!r.created_at) return false;
                const d = new Date(r.created_at);
                const dataReq = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
                if (fDtIni && dataReq < fDtIni) return false;
                if (fDtFim && dataReq > fDtFim) return false;
                return true;
            });
        }
    }

    let gruposArray = agruparRequisicoes(dados);

    if (abaAtualEntregas === 'pendentes') {
        gruposArray = gruposArray.filter(g => g.statusFinal === 'Pendente');
    } else if (abaAtualEntregas === 'historico') {
        const fStatus = document.getElementById('filtroStatus')?.value || '';
        if (fStatus) gruposArray = gruposArray.filter(g => g.statusFinal === fStatus);
    }

    gruposFiltradosUltimoRender = gruposArray;

    if (abaAtualEntregas === 'historico') {
        const totalPaginas = Math.ceil(gruposArray.length / itensPorPagina) || 1;
        if (paginaAtualHistorico < 1) paginaAtualHistorico = 1;
        if (paginaAtualHistorico > totalPaginas) paginaAtualHistorico = totalPaginas;

        document.getElementById('textoPaginacao').innerText = `Página ${paginaAtualHistorico} de ${totalPaginas}`;
        document.getElementById('btnPaginaAnt').disabled = (paginaAtualHistorico === 1);
        document.getElementById('btnPaginaProx').disabled = (paginaAtualHistorico === totalPaginas);

        const inicio = (paginaAtualHistorico - 1) * itensPorPagina;
        gruposArray = gruposArray.slice(inicio, inicio + itensPorPagina);
    }

    const tbody = document.getElementById('tabelaEntregasBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (gruposArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 25px;">Nenhuma requisição encontrada nesta visualização.</td></tr>';
        return;
    }

    gruposArray.forEach(grupo => {
        const dataFormatada = grupo.data ? new Date(grupo.data).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
        const idEscapado = String(grupo.colaborador_nome || grupo.os_id || grupo.centro_custo || '').replace(/'/g, "\\'");

        let tituloOrigem = '', usuarioReq = '';
        if (grupo.origem === 'almoxarifado_requisicoes') {
            tituloOrigem = `<strong style="color:#fbbf24; font-size:1rem;">Req. Mat #${grupo.id_grupo}</strong><br><span style="color:#cbd5e1; font-size:0.83rem;"><i class="fas fa-id-badge"></i> Para: ${grupo.colaborador_nome}</span>`;
            usuarioReq = `<span style="color:#94a3b8; font-size:0.75rem;">Solicitado por:</span><br><strong style="color:#e2e8f0;">${grupo.usuario_solicitante || '-'}</strong>`;
        } else {
            tituloOrigem = grupo.centro_custo
                ? `<strong style="color:#a855f7; font-size:1rem;">RM-Int #${grupo.id_grupo}</strong><br><span style="color:#cbd5e1; font-size:0.83rem;"><i class="fas fa-building"></i> ${grupo.centro_custo}</span>`
                : `<strong style="color:#60a5fa; font-size:1rem;">O.S #${grupo.os_id}</strong><br><span style="color:#cbd5e1; font-size:0.83rem;"><i class="fas fa-truck"></i> ${grupo.placa || 'Frota'}</span>`;
            usuarioReq = `<strong style="color:#e2e8f0;">${grupo.mecanico_responsavel || 'Mecânico'}</strong>`;
        }

        let listaPecasHtml = '', listaQtdHtml = '';
        grupo.itens.forEach(req => {
            const pecaRef = pecasEstoqueEntregas.find(p => String(p.id) === String(req.peca_id));
            const nomePeca = pecaRef ? pecaRef.nome : '<span style="color:#f87171; font-style:italic;">Peça Excluída</span>';
            const localTxt = pecaRef && pecaRef.localizacao ? `<span class="badge-loc" style="margin-left:6px;"><i class="fas fa-map-marker-alt"></i> ${pecaRef.localizacao}</span>` : '';
            const stat = req.status || 'Pendente';
            const corItem = stat === 'Aprovado' ? '#34d399' : (stat === 'Recusado' ? '#ef4444' : (stat === 'Devolvido' ? '#94a3b8' : '#e2e8f0'));

            listaPecasHtml += `<div style="padding: 3px 0; color: ${corItem};">• ${nomePeca} ${localTxt}</div>`;
            listaQtdHtml += `<div style="padding: 3px 0; color: ${corItem}; font-weight: bold;">${req.quantidade}</div>`;
        });

        let statusBadge = '', btnAcao = '';
        if (grupo.statusFinal === 'Pendente') {
            statusBadge = '<span class="badge" style="background:#f59e0b; color:#fff;"><i class="fas fa-clock"></i> Aguardando</span>';
            btnAcao = `<button class="btn-action-sm" style="background:#38bdf8; padding:8px 12px; font-weight:bold;" onclick="abrirModalAprovacaoGrupoEntregas('${grupo.data}', '${grupo.origem}', '${idEscapado}')"><i class="fas fa-boxes"></i> Separar & Entregar</button>`;
        } else if (grupo.statusFinal === 'Aprovado') {
            statusBadge = '<span class="badge" style="background:#10b981; color:#fff;"><i class="fas fa-check"></i> Entregue</span>';
            btnAcao = `
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:flex-end;">
                    <button class="btn-action-sm" style="background:#8b5cf6;" title="Reimprimir Termo" onclick="reimprimirTermoGrupoEntregas('${grupo.data}', '${grupo.origem}', '${idEscapado}')"><i class="fas fa-print"></i></button>
                    <button class="btn-action-sm" style="background:#f59e0b;" title="Estornar / Devolver ao Estoque" onclick="estornarRequisicaoGrupoEntregas('${grupo.data}', '${grupo.origem}', '${idEscapado}')"><i class="fas fa-undo"></i> Estornar</button>
                </div>`;
        } else if (grupo.statusFinal === 'Devolvido') {
            statusBadge = '<span class="badge" style="background:#64748b; color:#fff;"><i class="fas fa-undo"></i> Estornada</span>';
            btnAcao = '<span style="color:#94a3b8; font-size:0.8rem;">Itens Devolvidos</span>';
        } else {
            statusBadge = '<span class="badge" style="background:#ef4444; color:#fff;"><i class="fas fa-times"></i> Recusada</span>';
            btnAcao = '<span style="color:#94a3b8; font-size:0.8rem;">Recusada</span>';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color: #94a3b8; font-size:0.85rem;">${dataFormatada}</td>
            <td>${tituloOrigem}</td>
            <td>${usuarioReq}</td>
            <td>${listaPecasHtml}</td>
            <td style="text-align:center;">${listaQtdHtml}</td>
            <td>${statusBadge}</td>
            <td style="text-align: right;">${btnAcao}</td>
        `;
        tbody.appendChild(tr);
    });
};

// ==================== EXPORTAR HISTÓRICO CSV ====================
window.exportarHistoricoEntregasCSV = function() {
    if (!gruposFiltradosUltimoRender || gruposFiltradosUltimoRender.length === 0) {
        Swal.fire('Aviso', 'Nenhum dado filtrado para exportar.', 'info');
        return;
    }
    const linhas = [];
    gruposFiltradosUltimoRender.forEach(g => {
        const dt = g.data ? new Date(g.data).toLocaleString('pt-BR') : '-';
        const origem = g.origem === 'almoxarifado_requisicoes' ? `Req. Mat (${g.colaborador_nome})` : (g.centro_custo ? `RM-Int (${g.centro_custo})` : `O.S #${g.os_id} (${g.placa || 'Frota'})`);
        const solicitante = g.usuario_solicitante || g.mecanico_responsavel || '-';
        g.itens.forEach(item => {
            const peca = pecasEstoqueEntregas.find(p => String(p.id) === String(item.peca_id));
            linhas.push([dt, origem, solicitante, peca ? peca.codigo || '-' : '-', peca ? peca.nome : 'Excluida', item.quantidade, item.status || 'Pendente', g.usuario_entregador || '-']);
        });
    });

    const bom = '\uFEFF';
    const cab = ['Data Hora', 'Origem / Destino', 'Solicitante', 'Codigo', 'Peca', 'Quantidade', 'Status', 'Entregador'];
    const csv = [cab.join(';'), ...linhas.map(l => l.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'))].join('\n');
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Entregas_Requisicoes_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
};

// ==================== CARREGAR DADOS ====================
async function carregarDadosEntregas(mostrarToast = false, silencioso = false) {
    try {
        pecasEstoqueEntregas = await db.getPecas() || [];
        
        if (window.supabaseClient) {
            let queryReqsOS = window.supabaseClient.from('os_pecas_utilizadas').select('*').order('id', { ascending: false });
            if (typeof window.aplicarFiltroFilial === 'function') queryReqsOS = window.aplicarFiltroFilial(queryReqsOS);
            const { data: reqsOS } = await queryReqsOS;
            
            let queryReqsColab = window.supabaseClient.from('almoxarifado_requisicoes').select('*').order('id', { ascending: false });
            if (typeof window.aplicarFiltroFilial === 'function') queryReqsColab = window.aplicarFiltroFilial(queryReqsColab);
            const { data: reqsColab } = await queryReqsColab;

            const unificadas = [];
            if (reqsOS) reqsOS.forEach(r => unificadas.push({ ...r, source_table: 'os_pecas_utilizadas' }));
            if (reqsColab) reqsColab.forEach(r => unificadas.push({ ...r, source_table: 'almoxarifado_requisicoes' }));
            unificadas.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            requisicoesEstoqueEntregas = unificadas;
        }

        atualizarKPIsEntregas(silencioso);
        renderizarTabelaPorAba();
        if (mostrarToast) {
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Fila atualizada!', showConfirmButton: false, timer: 1500 });
        }
    } catch (e) {
        console.error("Erro ao carregar requisições para entregas", e);
    }
}

// ==================== AVALIAÇÃO, ENTREGA PARCIAL E APROVAR TODOS ====================
window.aprovarTodosComSaldo = function() {
    grupoAvaliacaoAtualEntregas.forEach((req, idx) => {
        const sel = document.getElementById(`decisaoEntregas_${idx}`);
        const inpQtd = document.getElementById(`qtdEntregar_${idx}`);
        const peca = pecasEstoqueEntregas.find(p => String(p.id) === String(req.peca_id));
        const estoque = peca ? parseFloat(peca.quantidade || 0) : 0;
        if (sel && estoque > 0) {
            sel.value = 'Aprovado';
            if (inpQtd && parseFloat(inpQtd.value) > estoque) {
                inpQtd.value = estoque;
            }
        }
    });
};

window.abrirModalAprovacaoGrupoEntregas = function(dataReq, sourceTable, identificador) {
    grupoAvaliacaoAtualEntregas = requisicoesEstoqueEntregas.filter(r =>
        r.created_at === dataReq && r.source_table === sourceTable &&
        (r.colaborador_nome === identificador || String(r.os_id) === identificador || r.centro_custo === identificador) &&
        (r.status === 'Pendente' || !r.status)
    );

    if (grupoAvaliacaoAtualEntregas.length === 0) {
        Swal.fire({ icon: 'info', title: 'Aviso', text: 'Nenhum item pendente neste pedido.' });
        return;
    }

    document.getElementById('modalApOrigemEntregas').innerText = sourceTable === 'almoxarifado_requisicoes' ? '(Termo de Colaborador / EPI)' : '(Uso Interno / Oficina)';
    document.getElementById('modalApDestinoEntregas').innerText = identificador;

    const tbody = document.getElementById('tbodyAprovacaoGrupoEntregas');
    tbody.innerHTML = '';

    grupoAvaliacaoAtualEntregas.forEach((req, index) => {
        const peca = pecasEstoqueEntregas.find(p => String(p.id) === String(req.peca_id));
        const nome = peca ? peca.nome : 'Peça Desconhecida';
        const local = peca ? (peca.localizacao || 'S/N') : 'S/N';
        const estoque = peca ? parseFloat(peca.quantidade || 0) : 0;
        const qtdPedida = parseFloat(req.quantidade || 0);
        const semNenhumSaldo = estoque <= 0;
        const qtdSugerida = Math.min(qtdPedida, estoque);

        tbody.innerHTML += `
            <tr style="border-bottom:1px solid #334155;">
                <td>
                    <strong style="color:#f8fafc;">${nome}</strong><br>
                    <small style="color:#94a3b8; font-family:monospace;">${peca ? peca.codigo || 'S/N' : ''}</small>
                    <span class="badge-loc" style="margin-left:6px;"><i class="fas fa-map-marker-alt"></i> ${local}</span>
                    ${estoque < qtdPedida ? `<br><span style="color:#f87171; font-size:0.78rem; font-weight:bold;"><i class="fas fa-exclamation-triangle"></i> ${semNenhumSaldo ? 'Sem saldo em estoque' : 'Saldo parcial disponível'}</span>` : ''}
                </td>
                <td style="text-align:center; font-weight:bold; color:#60a5fa; font-size:1.05rem;">${qtdPedida}</td>
                <td style="text-align:center;">
                    <input type="number" step="0.01" min="0.01" max="${estoque}" id="qtdEntregar_${index}" value="${qtdSugerida > 0 ? qtdSugerida : qtdPedida}" ${semNenhumSaldo ? 'disabled' : ''} style="width:80px; padding:6px; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:6px; text-align:center; font-weight:bold;">
                </td>
                <td style="text-align:center; font-weight:bold; color:${estoque < qtdPedida ? '#f87171' : '#34d399'}; font-size:1.05rem;">${estoque}</td>
                <td style="text-align:center;">
                    <select id="decisaoEntregas_${index}" style="background:#0f172a; padding:7px; border-radius:6px; color:#fff; border:1px solid ${semNenhumSaldo ? '#ef4444' : '#3b82f6'}; width:100%; min-width:155px; font-weight:bold;">
                        ${semNenhumSaldo ? '' : '<option value="Aprovado">✅ Aprovar e Entregar</option>'}
                        <option value="Recusado" ${semNenhumSaldo ? 'selected' : ''}>❌ Recusar Item</option>
                        <option value="Pendente" ${!semNenhumSaldo ? 'selected' : ''}>⏳ Deixar Pendente</option>
                    </select>
                </td>
            </tr>
        `;
    });

    document.getElementById('modalAprovacaoReqEntregas').style.display = 'flex';
};

window.confirmarAvaliacaoGrupoEntregas = async function() {
    const btn = document.getElementById('btnConfirmarAvaliacaoEntregas');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
    btn.disabled = true;

    const itensAprovadosParaTermo = [];
    let aprovouAlgo = false;

    try {
        for (let i = 0; i < grupoAvaliacaoAtualEntregas.length; i++) {
            const req = grupoAvaliacaoAtualEntregas[i];
            const decisao = document.getElementById(`decisaoEntregas_${i}`).value;
            if (decisao === 'Pendente') continue;

            const peca = pecasEstoqueEntregas.find(p => String(p.id) === String(req.peca_id));
            const table = req.source_table === 'almoxarifado_requisicoes' ? 'almoxarifado_requisicoes' : 'os_pecas_utilizadas';

            if (decisao === 'Aprovado') {
                const qtdEntregue = parseFloat(document.getElementById(`qtdEntregar_${i}`).value) || parseFloat(req.quantidade);
                const estoqueDisp = peca ? parseFloat(peca.quantidade || 0) : 0;
                if (qtdEntregue <= 0 || qtdEntregue > estoqueDisp) {
                    Swal.fire('Saldo Insuficiente', `A quantidade informada para ${peca ? peca.nome : 'item'} excede o estoque (${estoqueDisp}).`, 'warning');
                    continue;
                }

                await window.supabaseClient.from(table).update({ status: 'Aprovado', quantidade: qtdEntregue }).eq('id', req.id);
                
                const novaMovimentacao = {
                    peca_id: req.peca_id, tipo: 'saida', quantidade: qtdEntregue,
                    valor_unitario: req.valor_unitario || (peca ? peca.preco_medio : 0),
                    usuario: window.currentUser ? window.currentUser.username : 'Sistema',
                    data_movimentacao: new Date().toISOString()
                };

                if (req.source_table === 'almoxarifado_requisicoes') {
                    novaMovimentacao.setor_destino = 'Colaborador: ' + req.colaborador_nome;
                    novaMovimentacao.nota_fiscal = `RM-RH #${req.id}`;
                } else if (req.centro_custo) {
                    novaMovimentacao.setor_destino = req.centro_custo;
                    novaMovimentacao.nota_fiscal = `RM-Int #${req.id}`;
                } else {
                    novaMovimentacao.cavalo = req.placa || 'Oficina';
                    novaMovimentacao.os_id = req.os_id;
                    novaMovimentacao.nota_fiscal = `O.S #${req.os_id}`;
                }

                await db.addMovimentacao(novaMovimentacao);
                itensAprovadosParaTermo.push({ ...req, quantidade: qtdEntregue });
                aprovouAlgo = true;

            } else if (decisao === 'Recusado') {
                await window.supabaseClient.from(table).update({ status: 'Recusado' }).eq('id', req.id);
            }
        }

        fecharModalEntregas('modalAprovacaoReqEntregas');
        
        if (aprovouAlgo) {
            const precisaAssinatura = itensAprovadosParaTermo.some(item => item.source_table === 'almoxarifado_requisicoes');
            if (precisaAssinatura) {
                itensPendentesParaAssinaturaEntregas = itensAprovadosParaTermo;
                document.getElementById('passoAssinaturaColab').style.display = 'block';
                document.getElementById('passoAssinaturaEntregador').style.display = 'none';
                document.getElementById('modalAssinaturaEntregas').style.display = 'flex';
                setTimeout(() => {
                    initSignaturePadEntregas();
                    limparAssinaturaColab();
                    limparAssinaturaEntregador();
                }, 200);
            } else {
                const updatePayload = {
                    data_assinatura: new Date().toISOString(),
                    usuario_entregador: window.currentUser ? window.currentUser.username : 'Almoxarifado'
                };
                for (const item of itensAprovadosParaTermo) {
                    await window.supabaseClient.from('os_pecas_utilizadas').update(updatePayload).eq('id', item.id);
                }
                Swal.fire({
                    title: 'Sucesso!',
                    text: 'Materiais da oficina liberados com sucesso. Deseja imprimir o Termo de Entrega?',
                    icon: 'success', showCancelButton: true,
                    confirmButtonColor: '#3085d6', cancelButtonColor: '#6c757d',
                    confirmButtonText: '<i class="fas fa-print"></i> Sim, Imprimir', cancelButtonText: 'Fechar'
                }).then(result => {
                    if (result.isConfirmed) {
                        imprimirTermoEntregaGrupoEntregas(itensAprovadosParaTermo.map(i => ({ ...i, usuario_entregador: updatePayload.usuario_entregador })), null, null);
                    }
                    carregarDadosEntregas();
                });
            }
        } else {
            Swal.fire('Processado!', 'Avaliação registrada com sucesso.', 'success').then(() => carregarDadosEntregas());
        }
    } catch (e) {
        console.error(e);
        Swal.fire('Erro', 'Erro ao salvar avaliação.', 'error');
    } finally {
        btn.innerHTML = '<i class="fas fa-arrow-right"></i> Confirmar / Ir p/ Assinatura';
        btn.disabled = false;
    }
};

// ==================== ASSINATURA DUPLA (CORRIGIDA PARA SPA / MOBILE) ====================
function initSignaturePadEntregas() {
    const elColab = document.getElementById('canvasAssinaturaColab');
    const elEntregador = document.getElementById('canvasAssinaturaEntregador');
    if (!elColab || !elEntregador) return;

    if (canvasColab !== elColab) {
        canvasColab = elColab;
        ctxColab = canvasColab.getContext('2d');
        configurarEventosCanvas(canvasColab, ctxColab, 'colab');
    }
    if (canvasEntregador !== elEntregador) {
        canvasEntregador = elEntregador;
        ctxEntregador = canvasEntregador.getContext('2d');
        configurarEventosCanvas(canvasEntregador, ctxEntregador, 'entregador');
    }
}

function configurarEventosCanvas(canvas, ctx, tipo) {
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#000';
    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) };
    };
    const iniciar = (e) => {
        e.preventDefault();
        if (tipo === 'colab') { isDrawingColab = true; hasColabSig = true; }
        else { isDrawingEntregador = true; hasEntregadorSig = true; }
        const pos = getPos(e); ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
    };
    const desenhar = (e) => {
        e.preventDefault();
        if (tipo === 'colab' ? !isDrawingColab : !isDrawingEntregador) return;
        const pos = getPos(e); ctx.lineTo(pos.x, pos.y); ctx.stroke();
    };
    const parar = () => {
        if (tipo === 'colab') isDrawingColab = false; else isDrawingEntregador = false;
        ctx.closePath();
    };
    canvas.addEventListener("mousedown", iniciar);
    canvas.addEventListener("mousemove", desenhar);
    canvas.addEventListener("mouseup", parar);
    canvas.addEventListener("mouseout", parar);
    canvas.addEventListener("touchstart", iniciar, { passive: false });
    canvas.addEventListener("touchmove", desenhar, { passive: false });
    canvas.addEventListener("touchend", parar);
}

window.limparAssinaturaColab = function() {
    if (ctxColab && canvasColab) { ctxColab.clearRect(0, 0, canvasColab.width, canvasColab.height); hasColabSig = false; }
};
window.limparAssinaturaEntregador = function() {
    if (ctxEntregador && canvasEntregador) { ctxEntregador.clearRect(0, 0, canvasEntregador.width, canvasEntregador.height); hasEntregadorSig = false; }
};
window.irParaPassoEntregador = function() {
    if (!hasColabSig) {
        Swal.fire({
            title: 'Assinatura Ausente', text: 'O colaborador ainda não assinou. Deseja pular?',
            icon: 'warning', showCancelButton: true, confirmButtonText: 'Sim, pular', cancelButtonText: 'Cancelar'
        }).then(r => {
            if (r.isConfirmed) {
                document.getElementById('passoAssinaturaColab').style.display = 'none';
                document.getElementById('passoAssinaturaEntregador').style.display = 'block';
            }
        });
        return;
    }
    document.getElementById('passoAssinaturaColab').style.display = 'none';
    document.getElementById('passoAssinaturaEntregador').style.display = 'block';
};
window.voltarParaPassoColab = function() {
    document.getElementById('passoAssinaturaEntregador').style.display = 'none';
    document.getElementById('passoAssinaturaColab').style.display = 'block';
};

function base64ParaBlob(base64, mimeType) {
    const byteCharacters = atob(base64.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
    return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

window.finalizarEntregaAssinadaEntregas = async function() {
    const btn = document.getElementById('btnSalvarAssinaturaEntregas');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    btn.disabled = true;

    try {
        if (itensPendentesParaAssinaturaEntregas.length > 0) {
            let colabUrl = null, entregadorUrl = null;
            let colabBase64 = null, entregadorBase64 = null;

            const reqBase = itensPendentesParaAssinaturaEntregas[0];
            const nomeOriginal = reqBase.colaborador_nome || reqBase.mecanico_responsavel || `OFICINA_OS_${reqBase.os_id}` || 'DESCONHECIDO';
            const pastaColab = nomeOriginal.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_').toUpperCase();

            if (hasColabSig && canvasColab) {
                colabBase64 = canvasColab.toDataURL('image/png');
                const arq = `${pastaColab}/sig_colab_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
                const { error } = await window.supabaseClient.storage.from('assinaturas').upload(arq, base64ParaBlob(colabBase64, 'image/png'), { contentType: 'image/png' });
                colabUrl = !error ? window.supabaseClient.storage.from('assinaturas').getPublicUrl(arq).data.publicUrl : colabBase64;
            }
            if (hasEntregadorSig && canvasEntregador) {
                entregadorBase64 = canvasEntregador.toDataURL('image/png');
                const arq = `${pastaColab}/sig_ent_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
                const { error } = await window.supabaseClient.storage.from('assinaturas').upload(arq, base64ParaBlob(entregadorBase64, 'image/png'), { contentType: 'image/png' });
                entregadorUrl = !error ? window.supabaseClient.storage.from('assinaturas').getPublicUrl(arq).data.publicUrl : entregadorBase64;
            }

            const updatePayload = {
                data_assinatura: new Date().toISOString(),
                usuario_entregador: window.currentUser ? window.currentUser.username : 'Almoxarifado'
            };
            if (colabUrl) updatePayload.assinatura_url = colabUrl;
            if (entregadorUrl) updatePayload.assinatura_entregador_url = entregadorUrl;

            for (const item of itensPendentesParaAssinaturaEntregas) {
                const table = item.source_table === 'almoxarifado_requisicoes' ? 'almoxarifado_requisicoes' : 'os_pecas_utilizadas';
                const { error: errUpd } = await window.supabaseClient.from(table).update(updatePayload).eq('id', item.id);
                if (errUpd) console.error('Erro ao salvar assinatura no banco:', errUpd);
            }
            
            fecharModalEntregas('modalAssinaturaEntregas');
            Swal.fire({
                title: 'Sucesso!', text: 'Assinaturas salvas! Deseja imprimir o Termo de Entrega agora?',
                icon: 'success', showCancelButton: true,
                confirmButtonText: '<i class="fas fa-print"></i> Sim, Imprimir', cancelButtonText: 'Fechar'
            }).then(result => {
                if (result.isConfirmed) {
                    imprimirTermoEntregaGrupoEntregas(
                        itensPendentesParaAssinaturaEntregas.map(i => ({ ...i, usuario_entregador: updatePayload.usuario_entregador })),
                        colabBase64 || colabUrl,
                        entregadorBase64 || entregadorUrl
                    );
                }
            });
        } else {
            fecharModalEntregas('modalAssinaturaEntregas');
        }
        await carregarDadosEntregas();
    } catch (e) {
        console.error(e);
        Swal.fire('Erro', 'Erro ao salvar assinaturas.', 'error');
    } finally {
        btn.innerHTML = '<i class="fas fa-check"></i> Finalizar Entrega';
        btn.disabled = false;
    }
};

// ==================== ESTORNO COM MOTIVO OBRIGATÓRIO ====================
window.estornarRequisicaoGrupoEntregas = async function(dataReq, sourceTable, identificador) {
    const itensGrupo = requisicoesEstoqueEntregas.filter(r =>
        r.created_at === dataReq && r.source_table === sourceTable &&
        (r.colaborador_nome === identificador || String(r.os_id) === identificador || r.centro_custo === identificador) &&
        r.status === 'Aprovado'
    );
    if (itensGrupo.length === 0) {
        Swal.fire('Atenção', 'Nenhum item aprovado neste pedido.', 'warning');
        return;
    }

    const { value: motivo, isConfirmed } = await Swal.fire({
        title: 'Confirmar Estorno / Devolução',
        text: 'Informe o motivo para cancelar esta entrega e devolver os itens ao estoque:',
        input: 'text',
        inputPlaceholder: 'Ex: Peça não utilizada na O.S., pedido duplicado...',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Confirmar Estorno',
        cancelButtonText: 'Cancelar',
        inputValidator: (v) => { if (!v || v.trim().length < 3) return 'Informe um motivo válido!'; }
    });

    if (!isConfirmed) return;

    try {
        for (const req of itensGrupo) {
            const peca = pecasEstoqueEntregas.find(p => String(p.id) === String(req.peca_id));
            const table = sourceTable === 'almoxarifado_requisicoes' ? 'almoxarifado_requisicoes' : 'os_pecas_utilizadas';
            await window.supabaseClient.from(table).update({ status: 'Devolvido' }).eq('id', req.id);

            await db.addMovimentacao({
                peca_id: req.peca_id, tipo: 'entrada', quantidade: req.quantidade,
                valor_unitario: req.valor_unitario || (peca ? peca.preco_medio : 0),
                nota_fiscal: 'Estorno/Devolução', fornecedor: 'Devolução Interna',
                observacao: `Estorno: ${motivo.trim()}`,
                usuario: window.currentUser ? window.currentUser.username : 'Sistema',
                data_movimentacao: new Date().toISOString()
            });
        }
        Swal.fire('Estornado!', 'Itens devolvidos ao estoque com motivo registrado.', 'success');
        await carregarDadosEntregas();
    } catch (e) {
        console.error(e);
        Swal.fire('Erro', 'Ocorreu um erro ao estornar.', 'error');
    }
};

// ==================== IMPRESSÃO DO TERMO ====================
window.reimprimirTermoGrupoEntregas = function(dataReq, sourceTable, identificador) {
    const itensGrupo = requisicoesEstoqueEntregas.filter(r =>
        r.created_at === dataReq && r.source_table === sourceTable &&
        (r.colaborador_nome === identificador || String(r.os_id) === identificador || r.centro_custo === identificador) &&
        r.status === 'Aprovado'
    );
    if (itensGrupo.length > 0) {
        imprimirTermoEntregaGrupoEntregas(itensGrupo, itensGrupo[0].assinatura_url, itensGrupo[0].assinatura_entregador_url);
    } else {
        Swal.fire('Aviso', 'Nenhum item aprovado encontrado para impressão.', 'info');
    }
};

window.imprimirTermoEntregaGrupoEntregas = function(itensGrupo, assinaturaColabUrl = null, assinaturaEntregadorUrl = null) {
    if (!itensGrupo || itensGrupo.length === 0) return;
    const reqBase = itensGrupo[0];
    const win = window.open('', '_blank', 'width=850,height=600');
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const nomeRecebedor = reqBase.colaborador_nome || reqBase.mecanico_responsavel || reqBase.usuario_solicitante || 'Mecânico / Solicitante';

    let linhasTabela = '';
    itensGrupo.forEach(item => {
        const peca = pecasEstoqueEntregas.find(p => String(p.id) === String(item.peca_id)) || { unidade: 'UN', codigo: 'S/N', nome: 'Produto Desconhecido' };
        linhasTabela += `<tr><td class="text-center">${item.quantidade}</td><td class="text-center">${peca.unidade || 'UN'}</td><td>${peca.codigo || 'S/N'}</td><td>${peca.nome}</td><td class="text-center">${dataAtual}</td></tr>`;
    });

    const imgColab = assinaturaColabUrl ? `<img src="${assinaturaColabUrl}" style="max-height: 85px; max-width: 100%; object-fit: contain;">` : '';
    const imgEnt = assinaturaEntregadorUrl ? `<img src="${assinaturaEntregadorUrl}" style="max-height: 85px; max-width: 100%; object-fit: contain;">` : '';

    win.document.write(`
    <html>
    <head>
        <title>Termo de Entrega - ${nomeRecebedor}</title>
        <style>
            body { font-family: 'Arial', sans-serif; margin: 40px; color: #000; display: flex; flex-direction: column; min-height: 90vh; } 
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; } 
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
            .img-wrapper { height: 90px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px; }
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
            <p>Eu, <strong>${nomeRecebedor}</strong>, declaro para os devidos fins legais que recebi da empresa Serrana Florestal, o(s) equipamento(s)/material(is) abaixo discriminado(s), de forma gratuita, em perfeito estado de conservação e funcionamento.</p>
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
                <div class="signature-name">${nomeRecebedor}</div>
                <div class="signature-role">Assinatura do Recebedor</div>
            </div>
            <div class="signature-box">
                <div class="img-wrapper">${imgEnt}</div>
                <div class="signature-line"></div>
                <div class="signature-name">${reqBase.usuario_entregador || 'Almoxarifado'}</div>
                <div class="signature-role">Responsável pela Entrega</div>
            </div>
        </div>
        <script>
            window.onload = function() {
                setTimeout(() => { window.print(); window.close(); }, 300);
            };
        <\/script>
    </body>
    </html>`);
    win.document.close();
};

window.fecharModalEntregas = function(id) {
    if (id === 'modalEntregaExpressa' && typeof window.pararLeituraCamera === 'function') {
        window.pararLeituraCamera();
    }
    document.getElementById(id).style.display = 'none';
};