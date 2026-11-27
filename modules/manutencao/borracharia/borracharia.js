// ==================== modules/manutencao/borracharia/borracharia.js ====================

window.registrosBorracharia = [];
window.pneusBorracharia = [];
window.borracheirosList = [];
window.statusFiltroPneusAtual = 'TODOS';
window.alertasCalibragemAtual = [];

// Helper de feedback (usa SweetAlert2 se disponível, senão alert)
function notificarBorracharia(tipo, titulo, texto) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: tipo,
            title: titulo,
            text: texto,
            background: '#1e293b',
            color: '#f8fafc',
            confirmButtonColor: '#3b82f6',
            timer: tipo === 'success' ? 2400 : undefined,
            showConfirmButton: tipo !== 'success'
        });
    } else {
        alert(`${titulo}\n${texto}`);
    }
}

function getDataHoraLocalISO() {
    const agora = new Date();
    const fusoAjuste = new Date(agora.getTime() - (agora.getTimezoneOffset() * 60000));
    return fusoAjuste.toISOString().slice(0, 16);
}

window.initBorracharia = async function() {
    if (typeof carregarDadosOS === 'function') {
        await carregarDadosOS();
    }

    const agoraISO = getDataHoraLocalISO();
    const elCalibData = document.getElementById('calibragemData');
    const elTrocaData = document.getElementById('trocaData');
    if (elCalibData) elCalibData.value = agoraISO;
    if (elTrocaData) elTrocaData.value = agoraISO;

    await Promise.all([
        buscarHistoricoBorracharia(),
        buscarPneusBorracharia(),
        buscarBorracheiros()
    ]);

    window.statusFiltroPneusAtual = 'TODOS';
    atualizarVisualPillsStatusPneus();
    alternarTelaBorracharia('painel');
};

window.recarregarModuloBorracharia = async function() {
    const btn = document.getElementById('btnAtualizarBorracharia');
    const icon = btn ? btn.querySelector('i') : null;
    if (icon) icon.classList.add('fa-spin');

    try {
        if (typeof carregarDadosOS === 'function') await carregarDadosOS();
        await Promise.all([
            buscarHistoricoBorracharia(),
            buscarPneusBorracharia(),
            buscarBorracheiros()
        ]);
        renderizarPainelBorracharia();
        renderizarPneusBorracharia();
        renderizarHistoricoBorracharia();
    } finally {
        if (icon) icon.classList.remove('fa-spin');
    }
};

// ======================== BUSCA DE COLABORADORES DO RH ========================
window.buscarBorracheiros = async function() {
    try {
        let query = window.supabaseClient.from('rh_colaboradores')
            .select('nome, funcao')
            .eq('status', 'Ativo')
            .ilike('funcao', '%Borracheiro%')
            .order('nome', { ascending: true });

        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);

        const { data, error } = await query;
        if (error) throw error;

        window.borracheirosList = data || [];
        preencherSelectsBorracheiros();
    } catch (error) {
        console.error('Erro ao buscar colaboradores do RH:', error);
    }
};

window.preencherSelectsBorracheiros = function() {
    const selectCalibragem = document.getElementById('calibragemBorracheiro');
    const selectTroca = document.getElementById('trocaBorracheiro');

    let options = '<option value="">Selecione o Executante...</option>';
    window.borracheirosList.forEach(b => {
        const funcaoExtra = b.funcao ? ` (${b.funcao})` : '';
        options += `<option value="${b.nome}">${b.nome}${funcaoExtra}</option>`;
    });

    if (selectCalibragem) selectCalibragem.innerHTML = options;
    if (selectTroca) selectTroca.innerHTML = options;
};

// ======================== NAVEGAÇÃO POR ABAS E ATALHOS ========================
window.alternarTelaBorracharia = function(tela) {
    const telas = {
        painel: 'telaPainelBorracharia',
        pneus: 'telaPneusBorracharia',
        historico: 'telaHistoricoBorracharia',
        calibragem: 'telaCalibragemBorracharia',
        troca: 'telaTrocaBorracharia'
    };

    Object.keys(telas).forEach(chave => {
        const el = document.getElementById(telas[chave]);
        if (el) el.style.display = (chave === tela) ? 'block' : 'none';

        const tabBtn = document.getElementById(`tabBtn-${chave}`);
        if (tabBtn) {
            if (chave === tela) {
                const coresAtivas = {
                    painel: 'bg-sky-600 text-white shadow-md shadow-sky-900/40',
                    pneus: 'bg-purple-600 text-white shadow-md shadow-purple-900/40',
                    historico: 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40',
                    calibragem: 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40',
                    troca: 'bg-rose-600 text-white shadow-md shadow-rose-900/40'
                };
                tabBtn.className = `borracharia-tab-btn flex-1 min-w-[155px] px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${coresAtivas[chave]}`;
            } else {
                tabBtn.className = 'borracharia-tab-btn flex-1 min-w-[155px] px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer text-slate-400 hover:text-white hover:bg-slate-800/80';
            }
        }
    });

    if (tela === 'painel') {
        renderizarPainelBorracharia();
    } else if (tela === 'historico') {
        renderizarHistoricoBorracharia();
    } else if (tela === 'calibragem') {
        const elData = document.getElementById('calibragemData');
        if (elData && !elData.value) elData.value = getDataHoraLocalISO();
        carregarPlacasBorracharia('calibragem');
    } else if (tela === 'troca') {
        const elData = document.getElementById('trocaData');
        if (elData && !elData.value) elData.value = getDataHoraLocalISO();
        carregarPlacasBorracharia('troca');

        const container = document.getElementById('containerPneusTroca');
        if (container) {
            container.innerHTML = '';
            adicionarCamposPneuTroca();
        }
        atualizarSugestaoPneusRodando();
    } else if (tela === 'pneus') {
        renderizarPneusBorracharia();
    }
};

window.preencherAtalhoCalibragem = function(inputId, valor) {
    const el = document.getElementById(inputId);
    if (el) {
        el.value = valor;
        el.focus();
    }
};

window.irParaCalibragem = async function(placa, categoria) {
    alternarTelaBorracharia('calibragem');
    const selCat = document.getElementById('calibragemCategoria');
    if (selCat) selCat.value = categoria && categoria !== 'Não definida' ? categoria : '';
    await carregarPlacasBorracharia('calibragem');
    const selPlaca = document.getElementById('calibragemPlaca');
    if (selPlaca) selPlaca.value = placa;
    const elData = document.getElementById('calibragemData');
    if (elData) elData.value = getDataHoraLocalISO();
};

window.carregarPlacasBorracharia = async function(prefixo) {
    // Suporta tanto prefixo + 'Placa' quanto 'movCavalo' (modal de movimentação)
    const select = document.getElementById(prefixo === 'mov' ? 'movCavalo' : (prefixo + 'Placa'));
    if (!select) return;
    const catElem = document.getElementById(prefixo + 'Categoria');
    const categoria = catElem ? catElem.value : 'TODAS';

    if (!window.frotasManutencao || window.frotasManutencao.length === 0) {
        if (typeof carregarDadosOS === 'function') await carregarDadosOS();
    }

    let options = '<option value="">Selecione um veículo...</option>';
    if (window.frotasManutencao) {
        const frotasOrdenadas = [...window.frotasManutencao].sort((a, b) =>
            String(a.cavalo || '').localeCompare(String(b.cavalo || ''))
        );

        frotasOrdenadas.forEach(f => {
            const catBanco = f.categoria ? f.categoria.trim().toUpperCase() : '';
            const catFiltro = categoria ? categoria.trim().toUpperCase() : '';

            if (catFiltro && catBanco !== catFiltro && catFiltro !== 'TODAS') return;

            const labelCat = f.categoria ? ` [${f.categoria}]` : '';
            if (f.cavalo) options += `<option value="${f.cavalo}">${f.cavalo}${labelCat}</option>`;
            if (f.go) options += `<option value="${f.go}">${f.go} (GO)${labelCat}</option>`;
        });
    }
    select.innerHTML = options;
};

// ======================== LÓGICA DE CAMPOS DINÂMICOS DA TROCA ========================
window.atualizarSugestaoPneusRodando = function() {
    const placa = document.getElementById('trocaPlaca')?.value || '';
    const box = document.getElementById('boxPneusMontadosTroca');
    const texto = document.getElementById('textoPneusMontadosTroca');
    const datalist = document.getElementById('datalistPneusMontadosPlaca');

    if (!datalist || !box || !texto) return;

    if (!placa) {
        box.style.display = 'none';
        datalist.innerHTML = '';
        return;
    }

    const montados = window.pneusBorracharia.filter(
        p => p.status === 'Rodando' && p.cavalo_atual && p.cavalo_atual.toUpperCase() === placa.toUpperCase()
    );

    if (montados.length === 0) {
        box.style.display = 'none';
        datalist.innerHTML = '';
        return;
    }

    datalist.innerHTML = montados.map(p =>
        `<option value="${p.num_fogo}">${p.num_fogo} — ${p.posicao || 'S/ Pos.'} (${p.marca || ''})</option>`
    ).join('');

    const listaResumo = montados.map(p =>
        `<span class="inline-block bg-slate-900 border border-sky-500/40 rounded px-2 py-0.5 font-mono text-sky-300 mr-1.5 mb-1">Fogo ${p.num_fogo} (${p.posicao || 'S/ Pos.'})</span>`
    ).join('');

    texto.innerHTML = `<strong class="text-white mr-1">Pneus atualmente rodando em ${placa}:</strong> ${listaResumo}`;
    box.style.display = 'flex';
};

window.adicionarCamposPneuTroca = function() {
    const container = document.getElementById('containerPneusTroca');
    if (!container) return;

    const selecionadosAtuais = [];
    container.querySelectorAll('.trocaFogoNovo').forEach(s => {
        if (s.value) selecionadosAtuais.push(s.value.toString());
    });

    const pneusEstoque = window.pneusBorracharia.filter(
        p => p.status === 'Estoque' && !selecionadosAtuais.includes(p.id.toString())
    );

    let optionsPneus = '<option value="">Selecione no Estoque...</option>';
    pneusEstoque.forEach(p => {
        const vidaTxt = `V${p.vida || 0}`;
        optionsPneus += `<option value="${p.id}">Fogo: ${p.num_fogo} | ${p.marca || '-'} (${p.medida || '-'}) [${vidaTxt}]</option>`;
    });

    const indice = container.children.length + 1;

    const div = document.createElement('div');
    div.className = 'pneu-troca-item bg-slate-900/70 border border-slate-700/80 rounded-2xl p-5 relative space-y-4';

    const btnExcluir = indice > 1
        ? `<button type="button" onclick="removerCamposPneuTroca(this)" class="text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1" title="Remover este pneu"><i class="fas fa-trash-alt"></i> Remover</button>`
        : '';

    div.innerHTML = `
        <div class="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <span class="badge-ordem-pneu text-xs font-extrabold uppercase tracking-wider text-sky-400 flex items-center gap-2">
                <i class="fas fa-circle-dot"></i> Pneu #${indice}
            </span>
            ${btnExcluir}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="form-group-dark">
                <label class="text-xs font-bold uppercase text-slate-400 mb-1.5 block">Posição no Veículo *</label>
                <input type="text" class="trocaPosicao w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500" placeholder="Ex: 3º Eixo Dir Ext">
            </div>

            <div class="form-group-dark bg-sky-500/10 border border-sky-500/30 rounded-xl p-2.5">
                <label class="text-xs font-bold uppercase text-sky-300 mb-1 block"><i class="fas fa-arrow-down mr-1"></i> Pneu a Instalar *</label>
                <select class="trocaFogoNovo w-full bg-slate-900 border border-sky-500/40 rounded-lg px-2.5 py-2 text-xs text-white outline-none cursor-pointer" onchange="carregarPneusParaTroca()">${optionsPneus}</select>
            </div>

            <div class="form-group-dark bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5">
                <label class="text-xs font-bold uppercase text-rose-300 mb-1 block"><i class="fas fa-arrow-up mr-1"></i> Fogo Retirado (Opcional)</label>
                <input type="text" list="datalistPneusMontadosPlaca" class="trocaFogoRetirado w-full bg-slate-900 border border-rose-500/40 rounded-lg px-2.5 py-2 text-xs text-white font-mono uppercase outline-none" placeholder="Digite ou escolha...">
            </div>

            <div class="form-group-dark">
                <label class="text-xs font-bold uppercase text-slate-400 mb-1.5 block">Destino do Retirado</label>
                <select class="trocaDestinoRetirado w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none cursor-pointer">
                    <option value="Recapagem">Enviar para Recapagem</option>
                    <option value="Vulcanização">Enviar para Vulcanização</option>
                    <option value="Sucata">Descartar (Sucata)</option>
                    <option value="Estoque">Voltar para Estoque Interno</option>
                </select>
            </div>
        </div>

        <div class="form-group-dark">
            <label class="text-xs font-bold uppercase text-slate-400 mb-1 block">Motivo / Observações</label>
            <input type="text" class="trocaObs w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-sky-500" placeholder="Ex: Corte lateral, estouro em operação, desgaste no TWI...">
        </div>
    `;

    container.appendChild(div);
};

window.removerCamposPneuTroca = function(btnElement) {
    const card = btnElement.closest('.pneu-troca-item');
    if (card) card.remove();

    // Renumera os badges dos blocos restantes
    const container = document.getElementById('containerPneusTroca');
    if (container) {
        Array.from(container.children).forEach((item, idx) => {
            const badge = item.querySelector('.badge-ordem-pneu');
            if (badge) badge.innerHTML = `<i class="fas fa-circle-dot"></i> Pneu #${idx + 1}`;
        });
    }
    carregarPneusParaTroca();
};

window.carregarPneusParaTroca = function() {
    const container = document.getElementById('containerPneusTroca');
    if (!container) return;

    const selecionadosAtuais = [];
    const selects = container.querySelectorAll('.trocaFogoNovo');
    selects.forEach(s => {
        if (s.value) selecionadosAtuais.push(s.value.toString());
    });

    const pneusEstoque = window.pneusBorracharia.filter(p => p.status === 'Estoque');

    selects.forEach(select => {
        const currentValue = select.value;
        let options = '<option value="">Selecione no Estoque...</option>';

        pneusEstoque.forEach(p => {
            if (!selecionadosAtuais.includes(p.id.toString()) || p.id.toString() === currentValue) {
                const vidaTxt = `V${p.vida || 0}`;
                options += `<option value="${p.id}">Fogo: ${p.num_fogo} | ${p.marca || '-'} (${p.medida || '-'}) [${vidaTxt}]</option>`;
            }
        });

        select.innerHTML = options;
        if (currentValue) select.value = currentValue;
    });
};

// ======================== PAINEL & ALERTAS ========================
window.buscarHistoricoBorracharia = async function() {
    try {
        let query = window.supabaseClient.from('borracharia_registros').select('*').order('data_registro', { ascending: false });
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
        const { data, error } = await query;
        if (error) throw error;
        window.registrosBorracharia = data || [];
    } catch (error) {
        console.error('Erro ao buscar histórico da borracharia:', error);
    }
};

window.renderizarPainelBorracharia = function() {
    const agora = new Date();
    const trintaDiasAtras = new Date(agora.getTime() - (30 * 24 * 60 * 60 * 1000));

    let calibsMes = 0;
    let trocasMes = 0;

    window.registrosBorracharia.forEach(r => {
        const dataReg = new Date(r.data_registro);
        if (dataReg >= trintaDiasAtras) {
            if (r.tipo_servico === 'Calibragem') calibsMes++;
            if (r.tipo_servico === 'Troca') trocasMes++;
        }
    });

    const pneusEstoqueList = window.pneusBorracharia.filter(p => p.status === 'Estoque');
    const emEstoque = pneusEstoqueList.length;
    const valorEstoque = pneusEstoqueList.reduce((acc, p) => acc + (parseFloat(p.custo_atual) || 0), 0);
    const emRecapagem = window.pneusBorracharia.filter(p => p.status === 'Recapagem').length;
    const rodando = window.pneusBorracharia.filter(p => p.status === 'Rodando').length;

    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    setTxt('kpiCalibragensMes', calibsMes);
    setTxt('kpiTrocasMes', trocasMes);
    setTxt('kpiEstoquePneus', emEstoque);
    setTxt('kpiValorEstoquePneus', `Valor: ${valorEstoque.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
    setTxt('kpiRecapagemPneus', emRecapagem);
    setTxt('kpiRodandoPneus', `Rodando na frota: ${rodando}`);
    setTxt('badgeTabPneus', window.pneusBorracharia.length);

    const frotaGeral = window.frotasManutencao || [];
    const alertas = [];

    frotaGeral.forEach(f => {
        if (!f.cavalo) return;

        const catBanco = f.categoria ? f.categoria.trim().toUpperCase() : '';
        if (catBanco === 'GRUA') return;

        const calibsCavalo = window.registrosBorracharia.filter(r => r.placa === f.cavalo && r.tipo_servico === 'Calibragem');
        let diasEmAtraso = 'Nunca Calibrado';
        let diasNum = 9999;
        let dataUltima = '-';
        let isAtrasado = false;

        if (calibsCavalo.length > 0) {
            calibsCavalo.sort((a, b) => new Date(b.data_registro) - new Date(a.data_registro));
            const diffDias = Math.floor((agora - new Date(calibsCavalo[0].data_registro)) / (1000 * 60 * 60 * 24));

            dataUltima = new Date(calibsCavalo[0].data_registro).toLocaleDateString('pt-BR');
            diasEmAtraso = `${diffDias} dias`;
            diasNum = diffDias;

            if (diffDias > 15) isAtrasado = true;
        } else {
            isAtrasado = true;
        }

        if (isAtrasado) {
            const statusTexto = f.status ? `(${f.status})` : '';
            alertas.push({
                placa: f.cavalo,
                frota: `${f.numero_frota || '-'} ${statusTexto}`.trim(),
                categoria: f.categoria || 'Não definida',
                dataUltima: dataUltima,
                dias: diasEmAtraso,
                diasNum: diasNum
            });
        }
    });

    // Ordena do mais atrasado para o menos atrasado
    alertas.sort((a, b) => b.diasNum - a.diasNum);
    window.alertasCalibragemAtual = alertas;

    setTxt('kpiVencidos', alertas.length);

    const badgeAlertas = document.getElementById('badgeTabAlertas');
    if (badgeAlertas) {
        if (alertas.length > 0) {
            badgeAlertas.innerText = alertas.length;
            badgeAlertas.classList.remove('hidden');
        } else {
            badgeAlertas.classList.add('hidden');
        }
    }

    const termoAlerta = (document.getElementById('searchAlertasBorracharia')?.value || '').trim().toLowerCase();
    const alertasFiltrados = termoAlerta
        ? alertas.filter(a => a.placa.toLowerCase().includes(termoAlerta) || a.categoria.toLowerCase().includes(termoAlerta) || a.frota.toLowerCase().includes(termoAlerta))
        : alertas;

    const tbodyAlertas = document.getElementById('tabelaAlertasBorracharia');
    if (tbodyAlertas) {
        if (alertasFiltrados.length === 0) {
            tbodyAlertas.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-10">
                        <i class="fas fa-check-circle text-emerald-400 text-3xl mb-2"></i>
                        <p class="text-emerald-400 font-bold text-sm">${alertas.length === 0 ? 'Toda a frota está em dia com a calibragem!' : 'Nenhum alerta encontrado para o filtro aplicado.'}</p>
                    </td>
                </tr>`;
        } else {
            tbodyAlertas.innerHTML = alertasFiltrados.map(a => {
                const critico = a.diasNum > 30;
                const badgeCls = critico
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/40';
                return `
                    <tr class="hover:bg-slate-700/30 transition-colors">
                        <td class="px-5 py-3.5 font-mono font-black text-rose-400 text-sm">${a.placa}</td>
                        <td class="px-5 py-3.5 text-slate-300">${a.frota}</td>
                        <td class="px-5 py-3.5 text-center">
                            <span class="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700 text-[11px] font-bold uppercase text-slate-300">${a.categoria}</span>
                        </td>
                        <td class="px-5 py-3.5 text-center font-mono text-slate-400">${a.dataUltima}</td>
                        <td class="px-5 py-3.5 text-center">
                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${badgeCls}">
                                <i class="fas fa-clock"></i> ${a.dias}
                            </span>
                        </td>
                        <td class="px-5 py-3.5 text-center">
                            <button onclick="irParaCalibragem('${a.placa}', '${a.categoria}')" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-all inline-flex items-center gap-1.5 shadow cursor-pointer">
                                <i class="fas fa-compress-arrows-alt"></i> Calibrar
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }
};

// ======================== HISTÓRICO DIÁRIO ========================
window.limparFiltrosHistoricoBorracharia = function() {
    const ids = ['searchBorracharia', 'filtroDataIniHistorico', 'filtroDataFimHistorico'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const sel = document.getElementById('filtroTipoHistorico');
    if (sel) sel.value = 'TODOS';
    renderizarHistoricoBorracharia();
};

window.renderizarHistoricoBorracharia = function() {
    const tbody = document.getElementById('tabelaHistoricoBorracharia');
    if (!tbody) return;

    const termo = (document.getElementById('searchBorracharia')?.value || '').trim().toLowerCase();
    const tipoFiltro = document.getElementById('filtroTipoHistorico')?.value || 'TODOS';
    const dataIni = document.getElementById('filtroDataIniHistorico')?.value || '';
    const dataFim = document.getElementById('filtroDataFimHistorico')?.value || '';

    let filtrados = window.registrosBorracharia;

    if (termo) {
        filtrados = filtrados.filter(r =>
            (r.placa && r.placa.toLowerCase().includes(termo)) ||
            (r.borracheiro && r.borracheiro.toLowerCase().includes(termo)) ||
            (r.detalhe && r.detalhe.toLowerCase().includes(termo)) ||
            (r.motivo && r.motivo.toLowerCase().includes(termo))
        );
    }

    if (tipoFiltro !== 'TODOS') {
        filtrados = filtrados.filter(r => r.tipo_servico === tipoFiltro);
    }

    if (dataIni) {
        const dtMin = new Date(dataIni + 'T00:00:00');
        filtrados = filtrados.filter(r => r.data_registro && new Date(r.data_registro) >= dtMin);
    }

    if (dataFim) {
        const dtMax = new Date(dataFim + 'T23:59:59');
        filtrados = filtrados.filter(r => r.data_registro && new Date(r.data_registro) <= dtMax);
    }

    const resumoEl = document.getElementById('resumoHistoricoBorracharia');
    if (resumoEl) {
        resumoEl.innerText = `Exibindo ${filtrados.length} de ${window.registrosBorracharia.length} registros`;
    }

    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-500 italic">Nenhum registro encontrado para os filtros aplicados.</td></tr>';
        return;
    }

    tbody.innerHTML = filtrados.map(r => {
        const dtObj = r.data_registro ? new Date(r.data_registro) : null;
        const dataFormatada = dtObj
            ? `${dtObj.toLocaleDateString('pt-BR')} <span class="text-slate-500">${dtObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>`
            : '-';

        const isTroca = r.tipo_servico === 'Troca';
        const badgeTipo = isTroca
            ? '<span class="px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[11px] font-bold uppercase"><i class="fas fa-sync-alt mr-1"></i>Troca</span>'
            : '<span class="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold uppercase"><i class="fas fa-compress-arrows-alt mr-1"></i>Calibragem</span>';

        const kmHtml = r.km_frota ? `<div class="text-[11px] text-slate-500 font-mono">KM: ${parseInt(r.km_frota, 10).toLocaleString('pt-BR')}</div>` : '';

        return `
            <tr class="hover:bg-slate-700/30 transition-colors">
                <td class="px-5 py-3 font-mono text-xs whitespace-nowrap">${dataFormatada}</td>
                <td class="px-5 py-3">
                    <div class="font-mono font-bold text-sky-400">${r.placa || '-'}</div>
                    ${kmHtml}
                </td>
                <td class="px-5 py-3 text-center whitespace-nowrap">${badgeTipo}</td>
                <td class="px-5 py-3 text-slate-200">${r.posicao || '-'}</td>
                <td class="px-5 py-3 font-mono font-semibold text-white">${r.detalhe || '-'}</td>
                <td class="px-5 py-3 text-slate-300">${r.borracheiro || r.mecanico || '-'}</td>
                <td class="px-5 py-3 text-slate-400 text-xs">${r.motivo || '-'}</td>
            </tr>`;
    }).join('');
};

// ======================== SALVAMENTO DE SERVIÇOS ========================
window.salvarServicoBorracharia = async function(tipo) {
    const usuarioLogado = (window.currentUser && window.currentUser.username) ? window.currentUser.username : 'Sistema';

    // === SALVAR CALIBRAGEM ===
    if (tipo === 'Calibragem') {
        const dataServico = document.getElementById('calibragemData').value;
        const placa = document.getElementById('calibragemPlaca').value;
        const borracheiro = document.getElementById('calibragemBorracheiro').value;
        const posicao = document.getElementById('calibragemPosicao').value.trim();
        const pressao = document.getElementById('calibragemPressao').value;
        const detalhe = pressao ? `${pressao} lbs` : '';
        const motivo = document.getElementById('calibragemObs').value.trim();

        if (!dataServico || !placa || !posicao || !pressao || !borracheiro) {
            return notificarBorracharia('warning', 'Campos Obrigatórios', 'Preencha Data, Placa, Borracheiro, Posição e Pressão.');
        }

        let insertData = {
            data_registro: new Date(dataServico).toISOString(),
            placa,
            tipo_servico: tipo,
            posicao,
            detalhe,
            motivo,
            mecanico: usuarioLogado,
            borracheiro
        };

        if (typeof window.injetarFilial === 'function') insertData = window.injetarFilial(insertData);

        try {
            const { error } = await window.supabaseClient.from('borracharia_registros').insert([insertData]);
            if (error) throw error;

            notificarBorracharia('success', 'Calibragem Registrada!', `Veículo ${placa} calibrado com ${pressao} lbs.`);

            document.getElementById('calibragemPosicao').value = '';
            document.getElementById('calibragemPressao').value = '';
            document.getElementById('calibragemObs').value = '';
            document.getElementById('calibragemPlaca').value = '';
            document.getElementById('calibragemData').value = getDataHoraLocalISO();

            await buscarHistoricoBorracharia();
            renderizarPainelBorracharia();
            alternarTelaBorracharia('historico');
        } catch (error) {
            console.error(error);
            notificarBorracharia('error', 'Erro ao Salvar', 'Não foi possível registrar a calibragem no banco de dados.');
        }
    }
    // === SALVAR TROCAS MÚLTIPLAS ===
    else if (tipo === 'Troca') {
        const dataServico = document.getElementById('trocaData').value;
        const placa = document.getElementById('trocaPlaca').value;
        const borracheiro = document.getElementById('trocaBorracheiro').value;
        const km = parseInt(document.getElementById('trocaKm').value, 10) || 0;

        if (!dataServico || !placa || !borracheiro) {
            return notificarBorracharia('warning', 'Dados Incompletos', 'Preencha Data, Placa do Veículo e o Borracheiro no topo da tela.');
        }

        const paineisPneus = document.querySelectorAll('.pneu-troca-item');
        if (paineisPneus.length === 0) {
            return notificarBorracharia('warning', 'Sem Pneus', 'Adicione ao menos um bloco de pneu para registrar a troca.');
        }

        const dataISO = new Date(dataServico).toISOString();
        const trocasParaProcessar = [];

        for (let item of paineisPneus) {
            const posicao = item.querySelector('.trocaPosicao').value.trim();
            const pneuNovoId = item.querySelector('.trocaFogoNovo').value;
            const fogoRetirado = item.querySelector('.trocaFogoRetirado').value.trim();
            const destinoRetirado = item.querySelector('.trocaDestinoRetirado').value;
            const obs = item.querySelector('.trocaObs').value.trim();

            if (!posicao || !pneuNovoId) {
                return notificarBorracharia('warning', 'Campos Obrigatórios', 'Em todos os blocos de troca, informe a Posição e selecione o Pneu a Instalar.');
            }
            trocasParaProcessar.push({ posicao, pneuNovoId, fogoRetirado, destinoRetirado, obs });
        }

        const selectedIds = trocasParaProcessar.map(t => t.pneuNovoId);
        if (new Set(selectedIds).size !== selectedIds.length) {
            return notificarBorracharia('warning', 'Pneu Duplicado', 'Você selecionou o mesmo pneu do estoque em posições diferentes. Verifique os blocos.');
        }

        try {
            for (let troca of trocasParaProcessar) {
                const pneuNovoObj = window.pneusBorracharia.find(p => p.id == troca.pneuNovoId);
                const detalheStr = pneuNovoObj
                    ? `Instalou: Fogo ${pneuNovoObj.num_fogo}${troca.fogoRetirado ? ' | Retirou: ' + troca.fogoRetirado.toUpperCase() : ''}`
                    : 'Troca registrada';

                let insertHistorico = {
                    data_registro: dataISO,
                    placa: placa,
                    tipo_servico: 'Troca',
                    posicao: troca.posicao,
                    detalhe: detalheStr,
                    motivo: troca.obs,
                    mecanico: usuarioLogado,
                    borracheiro: borracheiro,
                    km_frota: km
                };
                if (typeof window.injetarFilial === 'function') insertHistorico = window.injetarFilial(insertHistorico);

                const resHist = await window.supabaseClient.from('borracharia_registros').insert([insertHistorico]);
                if (resHist.error) throw resHist.error;

                const resUpd = await window.supabaseClient.from('almoxarifado_pneus').update({
                    status: 'Rodando',
                    cavalo_atual: placa,
                    posicao: troca.posicao,
                    km_instalacao: km
                }).eq('id', troca.pneuNovoId);
                if (resUpd.error) throw resUpd.error;

                let movNovo = {
                    pneu_id: troca.pneuNovoId,
                    tipo: 'Instalação',
                    cavalo: placa,
                    km_frota: km,
                    observacao: `Instalado via tela de Troca (${troca.posicao})`
                };
                if (typeof window.injetarFilial === 'function') movNovo = window.injetarFilial(movNovo);
                await window.supabaseClient.from('almoxarifado_pneus_mov').insert([movNovo]);

                if (troca.fogoRetirado) {
                    const pRetirado = window.pneusBorracharia.find(p => p.num_fogo && p.num_fogo.toUpperCase() === troca.fogoRetirado.toUpperCase());
                    if (pRetirado) {
                        await window.supabaseClient.from('almoxarifado_pneus').update({
                            status: troca.destinoRetirado,
                            cavalo_atual: null,
                            posicao: null
                        }).eq('id', pRetirado.id);

                        let movRetirado = {
                            pneu_id: pRetirado.id,
                            tipo: 'Retirada',
                            cavalo: placa,
                            km_frota: km,
                            observacao: `Retirado na troca. Destino: ${troca.destinoRetirado}`
                        };
                        if (typeof window.injetarFilial === 'function') movRetirado = window.injetarFilial(movRetirado);
                        await window.supabaseClient.from('almoxarifado_pneus_mov').insert([movRetirado]);
                    }
                }
            }

            notificarBorracharia('success', 'Troca(s) Registrada(s)!', `${trocasParaProcessar.length} pneu(s) atualizado(s) na frota ${placa} e no estoque.`);

            document.getElementById('trocaPlaca').value = '';
            document.getElementById('trocaBorracheiro').value = '';
            document.getElementById('trocaKm').value = '';
            document.getElementById('trocaData').value = getDataHoraLocalISO();

            await buscarPneusBorracharia();
            await buscarHistoricoBorracharia();
            renderizarPainelBorracharia();
            alternarTelaBorracharia('historico');
        } catch (error) {
            console.error(error);
            notificarBorracharia('error', 'Erro ao Registrar Trocas', 'Verifique a conexão e tente novamente.');
        }
    }
};

// ======================== INVENTÁRIO E CONTROLE DE PNEUS ========================
window.buscarPneusBorracharia = async function() {
    try {
        let query = window.supabaseClient.from('almoxarifado_pneus').select('*').order('created_at', { ascending: false });
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
        const { data, error } = await query;
        if (error) throw error;
        window.pneusBorracharia = data || [];
    } catch (e) {
        console.error('Erro ao buscar tabela de pneus:', e);
    }
};

window.filtrarStatusPneus = function(status) {
    window.statusFiltroPneusAtual = status;
    atualizarVisualPillsStatusPneus();
    renderizarPneusBorracharia();
};

function atualizarVisualPillsStatusPneus() {
    document.querySelectorAll('.pneu-status-pill').forEach(btn => {
        const st = btn.getAttribute('data-status');
        if (st === window.statusFiltroPneusAtual) {
            btn.className = 'pneu-status-pill px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer bg-purple-600 text-white border-purple-400 shadow';
        } else {
            btn.className = 'pneu-status-pill px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer bg-slate-900 text-slate-400 border-slate-700 hover:text-white hover:border-slate-500';
        }
    });
}

window.renderizarPneusBorracharia = function() {
    const tbody = document.getElementById('tabelaPneusBorracharia');
    if (!tbody) return;

    const termo = (document.getElementById('searchPneus')?.value || '').trim().toLowerCase();
    const statusFiltro = window.statusFiltroPneusAtual || 'TODOS';

    let filtrados = window.pneusBorracharia;

    if (statusFiltro !== 'TODOS') {
        filtrados = filtrados.filter(p => {
            const st = (p.status || 'Estoque').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            const alvo = statusFiltro.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            return st === alvo;
        });
    }

    if (termo) {
        filtrados = filtrados.filter(p =>
            (p.num_fogo && p.num_fogo.toLowerCase().includes(termo)) ||
            (p.marca && p.marca.toLowerCase().includes(termo)) ||
            (p.medida && p.medida.toLowerCase().includes(termo)) ||
            (p.cavalo_atual && p.cavalo_atual.toLowerCase().includes(termo))
        );
    }

    const valorFiltrado = filtrados.reduce((acc, p) => acc + (parseFloat(p.custo_atual) || 0), 0);
    const resumoEl = document.getElementById('resumoFiltroPneus');
    if (resumoEl) {
        resumoEl.innerText = `${filtrados.length} pneu(s) listado(s) | Valor acumulado: ${valorFiltrado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
    }

    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-500 italic">Nenhum pneu encontrado para os filtros aplicados.</td></tr>';
        return;
    }

    tbody.innerHTML = filtrados.map(p => {
        const statusAtual = p.status || 'Estoque';
        let badgeStyle = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
        if (statusAtual === 'Rodando') badgeStyle = 'bg-sky-500/15 text-sky-300 border-sky-500/30';
        else if (statusAtual === 'Recapagem') badgeStyle = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
        else if (statusAtual === 'Sucata') badgeStyle = 'bg-rose-500/15 text-rose-300 border-rose-500/30';
        else if (statusAtual.toLowerCase().includes('vulcaniza')) badgeStyle = 'bg-purple-500/15 text-purple-300 border-purple-500/30';

        const localTexto = p.cavalo_atual
            ? `<span class="font-mono font-bold text-sky-400">${p.cavalo_atual}</span> <span class="text-slate-400 text-xs">(${p.posicao || 'S/ Pos.'})</span>`
            : '<span class="text-slate-400 text-xs">No Estoque Borracharia</span>';

        const custoTexto = p.custo_atual
            ? parseFloat(p.custo_atual).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            : '-';

        return `
            <tr class="hover:bg-slate-700/30 transition-colors">
                <td class="px-5 py-3.5 font-mono font-black text-purple-300 text-base">${p.num_fogo}</td>
                <td class="px-5 py-3.5">
                    <div class="font-bold text-white">${p.marca || '-'}</div>
                    <div class="text-[11px] text-slate-400 font-mono">${p.medida || '-'}</div>
                </td>
                <td class="px-5 py-3.5 text-center">
                    <span class="px-2.5 py-1 rounded-full border text-xs font-bold ${badgeStyle}">${statusAtual}</span>
                </td>
                <td class="px-5 py-3.5 text-center">
                    <span class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-900 border border-slate-700 font-mono font-black text-white">${p.vida || 0}</span>
                </td>
                <td class="px-5 py-3.5">${localTexto}</td>
                <td class="px-5 py-3.5 text-right font-mono text-slate-200">${custoTexto}</td>
                <td class="px-5 py-3.5 text-center">
                    <div class="inline-flex items-center gap-1.5">
                        <button onclick="abrirModalMovPneuBorracharia(${p.id})" title="Movimentar Pneu" class="bg-sky-600/80 hover:bg-sky-500 text-white px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer"><i class="fas fa-exchange-alt"></i></button>
                        <button onclick="verHistoricoPneuBorracharia(${p.id})" title="Histórico de Vida" class="bg-slate-700 hover:bg-slate-600 text-slate-200 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer"><i class="fas fa-list"></i></button>
                        <button onclick="abrirModalPneuBorracharia(${p.id})" title="Editar Cadastro" class="bg-emerald-600/80 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer"><i class="fas fa-edit"></i></button>
                        <button onclick="excluirPneuBorracharia(${p.id}, '${p.num_fogo}')" title="Excluir Pneu" class="bg-rose-600/70 hover:bg-rose-500 text-white px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </td>
            </tr>`;
    }).join('');
};

window.abrirModalPneuBorracharia = function(id = null) {
    document.getElementById('pneuId').value = id || '';
    if (id) {
        const pneu = window.pneusBorracharia.find(p => p.id === id);
        if (!pneu) return;
        document.getElementById('tituloModalPneu').innerHTML = `<i class="fas fa-edit text-emerald-400"></i> Editar Pneu: ${pneu.num_fogo}`;
        document.getElementById('pneuFogo').value = pneu.num_fogo || '';
        document.getElementById('pneuMarca').value = pneu.marca || '';
        document.getElementById('pneuMedida').value = pneu.medida || '';
        document.getElementById('pneuCusto').value = pneu.custo_atual || '';
        document.getElementById('pneuVida').value = pneu.vida || 0;
        document.getElementById('pneuFogo').disabled = true;
    } else {
        document.getElementById('tituloModalPneu').innerHTML = `<i class="fas fa-plus-circle text-emerald-400"></i> Cadastrar Novo Pneu`;
        document.getElementById('pneuFogo').value = '';
        document.getElementById('pneuMarca').value = '';
        document.getElementById('pneuMedida').value = '';
        document.getElementById('pneuCusto').value = '';
        document.getElementById('pneuVida').value = 0;
        document.getElementById('pneuFogo').disabled = false;
    }
    document.getElementById('modalPneuBorracharia').style.display = 'flex';
};

window.fecharModalPneuBorracharia = function() {
    document.getElementById('modalPneuBorracharia').style.display = 'none';
};

window.salvarPneuBorracharia = async function() {
    const id = document.getElementById('pneuId').value;
    const fogo = document.getElementById('pneuFogo').value.trim().toUpperCase();
    const marca = document.getElementById('pneuMarca').value.trim();
    const medida = document.getElementById('pneuMedida').value.trim();
    const custo = parseFloat(document.getElementById('pneuCusto').value) || 0;
    const vida = parseInt(document.getElementById('pneuVida').value, 10) || 0;

    if (!fogo) return notificarBorracharia('warning', 'Campo Obrigatório', 'O Nº de Fogo é obrigatório.');

    let pneuData = { num_fogo: fogo, marca, medida, custo_atual: custo, vida };

    try {
        if (id) {
            const { error } = await window.supabaseClient.from('almoxarifado_pneus').update(pneuData).eq('id', id);
            if (error) throw error;
            notificarBorracharia('success', 'Atualizado!', `Pneu Fogo ${fogo} atualizado com sucesso.`);
        } else {
            pneuData.status = 'Estoque';
            if (typeof window.injetarFilial === 'function') pneuData = window.injetarFilial(pneuData);

            const { error } = await window.supabaseClient.from('almoxarifado_pneus').insert([pneuData]);
            if (error) throw error;
            notificarBorracharia('success', 'Cadastrado!', `Pneu Fogo ${fogo} adicionado ao estoque.`);
        }
        fecharModalPneuBorracharia();
        await buscarPneusBorracharia();
        renderizarPneusBorracharia();
        renderizarPainelBorracharia();
    } catch (e) {
        console.error('Erro ao salvar pneu:', e);
        notificarBorracharia('error', 'Erro ao Salvar', 'Verifique se o Nº de Fogo já está cadastrado.');
    }
};

window.excluirPneuBorracharia = async function(id, numFogo) {
    let confirmado = false;
    if (typeof Swal !== 'undefined') {
        const res = await Swal.fire({
            title: `Excluir Pneu Fogo ${numFogo}?`,
            text: 'Essa ação removerá o cadastro do pneu do inventário.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#475569',
            confirmButtonText: 'Sim, excluir',
            cancelButtonText: 'Cancelar',
            background: '#1e293b',
            color: '#f8fafc'
        });
        confirmado = res.isConfirmed;
    } else {
        confirmado = confirm(`Deseja excluir o pneu Fogo ${numFogo}?`);
    }

    if (!confirmado) return;

    try {
        const { error } = await window.supabaseClient.from('almoxarifado_pneus').delete().eq('id', id);
        if (error) throw error;
        notificarBorracharia('success', 'Excluído!', `Pneu Fogo ${numFogo} removido do sistema.`);
        await buscarPneusBorracharia();
        renderizarPneusBorracharia();
        renderizarPainelBorracharia();
    } catch (e) {
        console.error('Erro ao excluir pneu:', e);
        notificarBorracharia('error', 'Erro ao Excluir', 'Este pneu pode possuir movimentações vinculadas no histórico.');
    }
};

window.abrirModalMovPneuBorracharia = async function(id) {
    const pneu = window.pneusBorracharia.find(p => p.id === id);
    if (!pneu) return;

    document.getElementById('movPneuId').value = pneu.id;
    document.getElementById('movPneuFogoText').innerText = pneu.num_fogo;

    const selectTipo = document.getElementById('movTipo');
    if (pneu.status === 'Estoque') selectTipo.value = 'Instalação';
    else if (pneu.status === 'Rodando') selectTipo.value = 'Retirada';
    else if (pneu.status === 'Recapagem') selectTipo.value = 'Retorno Recapagem';
    else selectTipo.value = 'Retirada';

    document.getElementById('movPosicao').value = '';
    document.getElementById('movKm').value = '';
    document.getElementById('movObs').value = '';

    await carregarPlacasBorracharia('mov');
    tratarCamposMovPneuBorracharia();

    document.getElementById('modalMovPneuBorracharia').style.display = 'flex';
};

window.fecharModalMovPneuBorracharia = function() {
    document.getElementById('modalMovPneuBorracharia').style.display = 'none';
};

window.tratarCamposMovPneuBorracharia = function() {
    const tipo = document.getElementById('movTipo').value;
    const boxVeiculo = document.getElementById('movCamposVeiculo');
    if (boxVeiculo) {
        boxVeiculo.style.display = (tipo === 'Instalação') ? 'grid' : 'none';
    }
};

window.salvarMovPneuBorracharia = async function() {
    const pneuId = document.getElementById('movPneuId').value;
    const tipo = document.getElementById('movTipo').value;
    const cavalo = document.getElementById('movCavalo').value;
    const posicao = document.getElementById('movPosicao').value.trim();
    const km = parseInt(document.getElementById('movKm').value, 10) || 0;
    const obs = document.getElementById('movObs').value.trim();

    if (tipo === 'Instalação' && (!cavalo || !posicao)) {
        return notificarBorracharia('warning', 'Campos Obrigatórios', 'Para instalação, informe o veículo e a posição.');
    }

    const pneuAtual = window.pneusBorracharia.find(p => p.id == pneuId);
    if (!pneuAtual) return;

    let novoStatus = pneuAtual.status;
    let novaVida = pneuAtual.vida || 0;
    let novoCavalo = pneuAtual.cavalo_atual;
    let novaPosicao = pneuAtual.posicao;
    let novoKmInstalacao = pneuAtual.km_instalacao;

    if (tipo === 'Instalação') {
        novoStatus = 'Rodando';
        novoCavalo = cavalo;
        novaPosicao = posicao;
        novoKmInstalacao = km;
    } else if (tipo === 'Retirada') {
        novoStatus = 'Estoque';
        novoCavalo = null;
        novaPosicao = null;
    } else if (tipo === 'Envio Recapagem') {
        novoStatus = 'Recapagem';
        novoCavalo = null;
        novaPosicao = null;
    } else if (tipo === 'Retorno Recapagem') {
        novoStatus = 'Estoque';
        novaVida = novaVida + 1;
        novoCavalo = null;
        novaPosicao = null;
    } else if (tipo === 'Envio Vulcanização') {
        novoStatus = 'Vulcanização';
        novoCavalo = null;
        novaPosicao = null;
    } else if (tipo === 'Descarte') {
        novoStatus = 'Sucata';
        novoCavalo = null;
        novaPosicao = null;
    }

    let movData = {
        pneu_id: pneuId,
        tipo: tipo,
        cavalo: tipo === 'Instalação' ? cavalo : pneuAtual.cavalo_atual,
        km_frota: km,
        observacao: obs
    };

    const updatePneuData = {
        status: novoStatus,
        vida: novaVida,
        cavalo_atual: novoCavalo,
        posicao: novaPosicao,
        km_instalacao: novoKmInstalacao
    };

    if (typeof window.injetarFilial === 'function') movData = window.injetarFilial(movData);

    try {
        const resMov = await window.supabaseClient.from('almoxarifado_pneus_mov').insert([movData]);
        if (resMov.error) throw resMov.error;

        const resPneu = await window.supabaseClient.from('almoxarifado_pneus').update(updatePneuData).eq('id', pneuId);
        if (resPneu.error) throw resPneu.error;

        notificarBorracharia('success', 'Movimentação Salva!', `Pneu Fogo ${pneuAtual.num_fogo} atualizado para: ${novoStatus}.`);
        fecharModalMovPneuBorracharia();
        await buscarPneusBorracharia();
        renderizarPneusBorracharia();
        renderizarPainelBorracharia();
    } catch (e) {
        console.error('Erro ao registrar movimentação:', e);
        notificarBorracharia('error', 'Erro de Conexão', 'Não foi possível salvar a movimentação.');
    }
};

window.verHistoricoPneuBorracharia = async function(pneuId) {
    const pneu = window.pneusBorracharia.find(p => p.id === pneuId);
    document.getElementById('histPneuFogoText').innerText = pneu ? pneu.num_fogo : '';

    const tbody = document.getElementById('tabelaHistoricoMovPneu');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-slate-400"><i class="fas fa-spinner fa-spin mr-2"></i>Buscando histórico na nuvem...</td></tr>';

    document.getElementById('modalHistoricoMovPneuBorracharia').style.display = 'flex';

    try {
        const { data, error } = await window.supabaseClient
            .from('almoxarifado_pneus_mov')
            .select('*')
            .eq('pneu_id', pneuId)
            .order('data_mov', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-slate-500 italic">Nenhuma movimentação registrada para este pneu.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(m => {
            const dt = new Date(m.data_mov);
            const dataF = `${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
            return `
                <tr class="hover:bg-slate-700/30">
                    <td class="px-4 py-3 font-mono text-xs">${dataF}</td>
                    <td class="px-4 py-3 font-bold text-sky-400">${m.tipo}</td>
                    <td class="px-4 py-3 text-center font-mono">${m.cavalo || '-'}</td>
                    <td class="px-4 py-3 text-center font-mono">${m.km_frota ? parseInt(m.km_frota, 10).toLocaleString('pt-BR') : '-'}</td>
                    <td class="px-4 py-3 text-slate-300 text-xs">${m.observacao || '-'}</td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-rose-400">Erro ao buscar dados do histórico.</td></tr>';
    }
};

window.fecharModalHistoricoMovBorracharia = function() {
    document.getElementById('modalHistoricoMovPneuBorracharia').style.display = 'none';
};

// ======================== MODAIS DE IMPRESSÃO ========================
window.abrirModalLivroBorracharia = function() {
    const inputMes = document.getElementById('livroMesAno');
    if (inputMes) {
        const agora = new Date();
        inputMes.value = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
    }
    document.getElementById('modalLivroBorracharia').style.display = 'flex';
};

window.fecharModalLivroBorracharia = function() {
    document.getElementById('modalLivroBorracharia').style.display = 'none';
};

// ======================== EXPORTAÇÃO EXCEL EXECUTIVA ========================
function carregarExcelJSBorracharia() {
    return new Promise((resolve, reject) => {
        if (window.ExcelJS) return resolve(window.ExcelJS);
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
        script.onload = () => (window.ExcelJS ? resolve(window.ExcelJS) : reject(new Error('ExcelJS indisponível')));
        script.onerror = () => reject(new Error('Erro ao carregar ExcelJS'));
        document.head.appendChild(script);
    });
}

window.exportarExcelBorracharia = async function() {
    const btn = document.getElementById('btnExportarExcelBorracharia');
    const originalHtml = btn ? btn.innerHTML : '';

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';
        }

        const ExcelJS = await carregarExcelJSBorracharia();
        const wb = new ExcelJS.Workbook();
        wb.creator = 'Serrana Florestal - Gestão de Borracharia';
        wb.created = new Date();

        const dataEmissao = new Date().toLocaleString('pt-BR');
        const borda = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
        const centro = { vertical: 'middle', horizontal: 'center', wrapText: true };

        const aplicarBanner = (ws, cols, titulo, sub) => {
            ws.mergeCells(1, 1, 1, cols);
            ws.getCell(1, 1).value = titulo;
            ws.getCell(1, 1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
            ws.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
            ws.getCell(1, 1).alignment = centro;
            ws.getRow(1).height = 30;

            ws.mergeCells(2, 1, 2, cols);
            ws.getCell(2, 1).value = sub;
            ws.getCell(2, 1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FFCBD5E1' } };
            ws.getCell(2, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
            ws.getCell(2, 1).alignment = centro;
            ws.getRow(2).height = 20;
            ws.getRow(3).height = 8;
        };

        const aplicarHeader = (row, cols) => {
            row.height = 26;
            for (let c = 1; c <= cols; c++) {
                const cell = row.getCell(c);
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
                cell.alignment = centro;
                cell.border = borda;
            }
        };

        // ABA 1: INVENTÁRIO DE PNEUS
        const ws1 = wb.addWorksheet('Inventário de Pneus', { views: [{ state: 'frozen', ySplit: 4 }] });
        aplicarBanner(ws1, 7, 'SERRANA FLORESTAL — INVENTÁRIO DE PNEUS (FOGO)', `Emitido em: ${dataEmissao}`);
        const h1 = ['Nº Fogo', 'Marca', 'Medida', 'Status', 'Vidas (Ciclos)', 'Localização Atual', 'Custo Unit. (R$)'];
        h1.forEach((t, i) => ws1.getRow(4).getCell(i + 1).value = t);
        aplicarHeader(ws1.getRow(4), 7);

        let totalCusto = 0;
        window.pneusBorracharia.forEach((p, idx) => {
            const custo = parseFloat(p.custo_atual) || 0;
            totalCusto += custo;
            const r = ws1.getRow(5 + idx);
            r.height = 21;
            r.getCell(1).value = p.num_fogo || '-';
            r.getCell(2).value = p.marca || '-';
            r.getCell(3).value = p.medida || '-';
            r.getCell(4).value = p.status || 'Estoque';
            r.getCell(5).value = p.vida || 0;
            r.getCell(6).value = p.cavalo_atual ? `${p.cavalo_atual} (${p.posicao || 'S/ Pos.'})` : 'Estoque Borracharia';
            r.getCell(7).value = custo;

            const zebra = idx % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';
            for (let c = 1; c <= 7; c++) {
                const cell = r.getCell(c);
                cell.font = { name: 'Calibri', size: 10, bold: c === 1, color: { argb: 'FF0F172A' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebra } };
                cell.alignment = centro;
                cell.border = borda;
            }
            r.getCell(7).numFmt = '"R$ "#,##0.00';
        });

        const rTot1 = ws1.getRow(5 + window.pneusBorracharia.length);
        rTot1.height = 24;
        ws1.mergeCells(rTot1.number, 1, rTot1.number, 6);
        rTot1.getCell(1).value = `TOTAL DE PNEUS CADASTRADOS: ${window.pneusBorracharia.length}`;
        rTot1.getCell(7).value = totalCusto;
        for (let c = 1; c <= 7; c++) {
            const cell = rTot1.getCell(c);
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
            cell.alignment = centro;
            cell.border = borda;
        }
        rTot1.getCell(7).numFmt = '"R$ "#,##0.00';
        ws1.autoFilter = { from: 'A4', to: 'G4' };
        ws1.columns = [{ width: 16 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 14 }, { width: 28 }, { width: 18 }];

        // ABA 2: HISTÓRICO DE SERVIÇOS
        const ws2 = wb.addWorksheet('Histórico de Serviços', { views: [{ state: 'frozen', ySplit: 4 }] });
        aplicarBanner(ws2, 8, 'HISTÓRICO DE CALIBRAGENS E TROCAS DE PNEUS', `Emitido em: ${dataEmissao}`);
        const h2 = ['Data / Hora', 'Placa', 'KM Frota', 'Tipo Serviço', 'Posição', 'Detalhe (Lbs / Fogo)', 'Borracheiro', 'Motivo / Observação'];
        h2.forEach((t, i) => ws2.getRow(4).getCell(i + 1).value = t);
        aplicarHeader(ws2.getRow(4), 8);

        window.registrosBorracharia.forEach((reg, idx) => {
            const dt = reg.data_registro ? new Date(reg.data_registro).toLocaleString('pt-BR') : '-';
            const r = ws2.getRow(5 + idx);
            r.height = 21;
            r.getCell(1).value = dt;
            r.getCell(2).value = reg.placa || '-';
            r.getCell(3).value = reg.km_frota ? parseInt(reg.km_frota, 10) : '-';
            r.getCell(4).value = reg.tipo_servico || '-';
            r.getCell(5).value = reg.posicao || '-';
            r.getCell(6).value = reg.detalhe || '-';
            r.getCell(7).value = reg.borracheiro || reg.mecanico || '-';
            r.getCell(8).value = reg.motivo || '-';

            const zebra = idx % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';
            for (let c = 1; c <= 8; c++) {
                const cell = r.getCell(c);
                cell.font = { name: 'Calibri', size: 10, bold: c === 2, color: { argb: 'FF0F172A' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebra } };
                cell.alignment = c === 8 ? { vertical: 'middle', horizontal: 'left', wrapText: true } : centro;
                cell.border = borda;
            }
            if (typeof r.getCell(3).value === 'number') r.getCell(3).numFmt = '#,##0';
        });
        ws2.autoFilter = { from: 'A4', to: 'H4' };
        ws2.columns = [{ width: 20 }, { width: 14 }, { width: 14 }, { width: 15 }, { width: 22 }, { width: 28 }, { width: 24 }, { width: 40 }];

        // ABA 3: ALERTAS DE CALIBRAGEM VENCIDA
        const ws3 = wb.addWorksheet('Alertas Calibragem', { views: [{ state: 'frozen', ySplit: 4 }] });
        aplicarBanner(ws3, 5, 'ALERTAS — VEÍCULOS COM CALIBRAGEM VENCIDA (+15 DIAS)', `Emitido em: ${dataEmissao}`);
        const h3 = ['Placa (Cavalo)', 'Frota / Status', 'Categoria', 'Última Calibragem', 'Dias em Atraso'];
        h3.forEach((t, i) => ws3.getRow(4).getCell(i + 1).value = t);
        aplicarHeader(ws3.getRow(4), 5);

        (window.alertasCalibragemAtual || []).forEach((a, idx) => {
            const r = ws3.getRow(5 + idx);
            r.height = 21;
            r.getCell(1).value = a.placa;
            r.getCell(2).value = a.frota;
            r.getCell(3).value = a.categoria;
            r.getCell(4).value = a.dataUltima;
            r.getCell(5).value = a.dias;

            const zebra = idx % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';
            for (let c = 1; c <= 5; c++) {
                const cell = r.getCell(c);
                cell.font = { name: 'Calibri', size: 10, bold: c === 1 || c === 5, color: { argb: c === 5 ? 'FF991B1B' : 'FF0F172A' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c === 5 ? 'FFFEE2E2' : zebra } };
                cell.alignment = centro;
                cell.border = borda;
            }
        });
        ws3.autoFilter = { from: 'A4', to: 'E4' };
        ws3.columns = [{ width: 18 }, { width: 24 }, { width: 18 }, { width: 20 }, { width: 20 }];

        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const hoje = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `Relatorio_Borracharia_${hoje}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        notificarBorracharia('success', 'Excel Gerado!', `Relatorio_Borracharia_${hoje}.xlsx baixado com sucesso.`);
    } catch (err) {
        console.error('Erro ao exportar Excel da borracharia:', err);
        notificarBorracharia('error', 'Erro na Exportação', 'Não foi possível gerar a planilha Excel.');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }
};