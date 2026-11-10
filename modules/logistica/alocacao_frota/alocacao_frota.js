window.renderizarAlocacaoFrota = async function() {
    console.log('[Módulo Alocação de Frota] Inicializado Kanban Inteligente.');
    await window.carregarKanbanAlocacao();
};

window.carregarKanbanAlocacao = async function() {
    const board = document.getElementById('kanbanBoard');
    if (!board) return;

    try {
        const filialId = window.currentUser ? window.currentUser.filial_id : null;

        // 1. Buscar Frentes de Serviço
        let queryFrentes = window.supabaseClient.from('config_gruas').select('id, frente').order('frente', { ascending: true });
        if (filialId) queryFrentes = queryFrentes.eq('filial_id', filialId);
        const { data: frentes, error: errFrentes } = await queryFrentes;
        if (errFrentes) throw errFrentes;

        // 2. Buscar Frotas TRITREM Ativas
        let queryFrotas = window.supabaseClient.from('frotas_manutencao').select('id, cavalo, numero_frota, go, descricao').eq('status', 'Ativo').ilike('categoria', '%TRITREM%');
        if (filialId) queryFrotas = queryFrotas.eq('filial_id', filialId);
        const { data: frotas, error: errFrotas } = await queryFrotas;
        if (errFrotas) throw errFrotas;

        // 3. Buscar Alocações Atuais
        let queryAlocacoes = window.supabaseClient.from('alocacao_frotas').select('*');
        if (filialId) queryAlocacoes = queryAlocacoes.eq('filial_id', filialId);
        const { data: alocacoes, error: errAlocacoes } = await queryAlocacoes;
        if (errAlocacoes) throw errAlocacoes;

        // 4. Buscar Ordens de Serviço (Manutenção) ABERTAS para as frotas
        // Correção aplicada: utilizando a tabela "ordens_servico" em vez de "ordem_servico"
        let queryOS = window.supabaseClient.from('ordens_servico').select('placa, status').neq('status', 'Concluída').eq('inativa', 0);
        if (filialId) queryOS = queryOS.eq('filial_id', filialId);
        const { data: ordensServico, error: errOS } = await queryOS;
        if (errOS) throw errOS;

        // Mapear Manutenções Ativas (Placa -> true)
        const veiculosEmManutencao = {};
        if (ordensServico) {
            ordensServico.forEach(os => {
                if (os.placa) {
                    veiculosEmManutencao[os.placa.toUpperCase()] = true;
                }
            });
        }

        // Mapear Alocações
        const mapAlocacoes = {}; 
        if (alocacoes) {
            alocacoes.forEach(a => mapAlocacoes[a.frota_id] = a);
        }

        const frotasPorFrente = { 'disponivel': [] };
        frentes.forEach(f => frotasPorFrente[f.id] = []);

        let contPatio = 0, contAlocados = 0, contManutencao = 0;

        frotas.forEach(frota => {
            const placa = (frota.cavalo || '').toUpperCase();
            frota.emManutencao = veiculosEmManutencao[placa] || false;
            
            if (frota.emManutencao) contManutencao++;

            const aloc = mapAlocacoes[frota.id];
            if (aloc && frotasPorFrente[aloc.frente_id] !== undefined) {
                frota.observacao = aloc.observacao;
                frota.alocacao_id = aloc.id;
                frotasPorFrente[aloc.frente_id].push(frota);
                contAlocados++;
            } else {
                frotasPorFrente['disponivel'].push(frota);
                contPatio++;
            }
        });

        // Atualiza os painéis indicadores globais no topo
        if(document.getElementById('ind_patio')) document.getElementById('ind_patio').innerText = contPatio;
        if(document.getElementById('ind_alocados')) document.getElementById('ind_alocados').innerText = contAlocados;
        if(document.getElementById('ind_manutencao')) document.getElementById('ind_manutencao').innerText = contManutencao;

        // Função geradora de Cards Modernos
        const gerarCardsHtml = (frotasArray, isPatio) => {
            return frotasArray.sort((a, b) => (a.cavalo || '').localeCompare(b.cavalo || '')).map(f => {
                
                let badgeClass = isPatio ? 'status-disponivel' : 'status-ok';
                let badgeText = isPatio ? '<i class="fas fa-check-circle"></i> Disponível' : '<i class="fas fa-truck-loading"></i> Operando';
                let cardClass = '';

                // Se o caminhão tem OS aberta, sobrepõe o status visual
                if (f.emManutencao) {
                    badgeClass = 'status-manutencao';
                    badgeText = '<i class="fas fa-wrench pulse-icon"></i> Manutenção Ativa';
                    cardClass = 'em-manutencao';
                }

                return `
                <div class="kanban-card ${cardClass}" draggable="true" ondragstart="dragStartFrota(event, ${f.id})" id="card_frota_${f.id}">
                    <div class="card-title">
                        <div>
                            <div class="placa-text">${f.cavalo || 'S/ PLACA'}</div>
                            <div class="id-text">ID: ${f.numero_frota || f.go || 'N/A'} | ${f.descricao || ''}</div>
                        </div>
                        <div class="flex flex-col items-end gap-2">
                            <span class="badge-status ${badgeClass}">${badgeText}</span>
                            <button onclick="adicionarObsAlocacao(${f.id}, '${f.observacao || ''}')" class="text-slate-500 hover:text-amber-400 transition-colors" title="Adicionar Observação">
                                <i class="fas fa-comment-dots"></i>
                            </button>
                        </div>
                    </div>
                    ${f.observacao ? `<div class="obs-box"><i class="fas fa-info-circle text-amber-500 mr-1"></i> ${f.observacao}</div>` : ''}
                </div>
            `}).join('');
        };

        board.innerHTML = '';

        // Coluna 1: Disponíveis / Pátio
        board.innerHTML += `
            <div class="kanban-column" id="col_disponivel" ondragover="allowDropFrota(event)" ondragleave="dragLeaveFrota(event)" ondrop="dropFrota(event, 'disponivel')">
                <div class="kanban-header" style="background: rgba(100, 116, 139, 0.1);">
                    <h3 class="font-extrabold text-slate-300 tracking-wide uppercase text-sm"><i class="fas fa-parking text-slate-400 mr-2"></i> Pátio / Disponíveis</h3>
                    <div class="flex items-center gap-2">
                        <span class="bg-slate-700 text-white px-2 py-0.5 rounded-md font-black text-sm">${frotasPorFrente['disponivel'].length}</span>
                    </div>
                </div>
                <div class="kanban-cards custom-scrollbar">
                    ${frotasPorFrente['disponivel'].length > 0 ? gerarCardsHtml(frotasPorFrente['disponivel'], true) : '<div class="text-center text-slate-500 text-sm mt-10 italic">Nenhum veículo no pátio</div>'}
                </div>
            </div>
        `;

        // Colunas Frentes
        frentes.forEach(f => {
            const arrFrente = frotasPorFrente[f.id];
            board.innerHTML += `
                <div class="kanban-column" id="col_${f.id}" ondragover="allowDropFrota(event)" ondragleave="dragLeaveFrota(event)" ondrop="dropFrota(event, ${f.id})">
                    <div class="kanban-header" style="background: rgba(56, 189, 248, 0.05);">
                        <h3 class="font-extrabold text-sky-400 tracking-wide uppercase text-sm"><i class="fas fa-map-marker-alt mr-2"></i> ${f.frente}</h3>
                        <div class="flex items-center gap-2" title="Veículos Alocados">
                            <span class="bg-sky-900/80 text-sky-100 px-2 py-0.5 rounded-md font-black text-sm" id="badge_count_${f.id}">${arrFrente.length}</span>
                        </div>
                    </div>
                    <div class="kanban-cards custom-scrollbar">
                        ${arrFrente.length > 0 ? gerarCardsHtml(arrFrente, false) : '<div class="text-center text-slate-500/50 text-sm mt-10 italic border border-dashed border-slate-700 rounded-lg p-6">Arraste veículos para cá</div>'}
                    </div>
                </div>
            `;
        });

    } catch (err) {
        console.error('Erro Kanban Inteligente:', err);
        board.innerHTML = `<div style="width:100%; text-align:center; color:#ef4444; padding:40px; background:rgba(239,68,68,0.1); border-radius:12px;">Erro Crítico ao carregar o painel.<br>${err.message}</div>`;
    }
};

// ==========================================
// Lógica de Drag and Drop HTML5
// ==========================================
window.dragStartFrota = function(event, frotaId) {
    event.dataTransfer.setData("frotaId", frotaId);
    event.target.classList.add('dragging');
};

window.allowDropFrota = function(event) {
    event.preventDefault();
    const column = event.target.closest('.kanban-column');
    if (column) column.classList.add('column-drag-over');
};

window.dragLeaveFrota = function(event) {
    const column = event.target.closest('.kanban-column');
    if (column) column.classList.remove('column-drag-over');
};

window.dropFrota = async function(event, destinoId) {
    event.preventDefault();
    
    const frotaId = event.dataTransfer.getData("frotaId");
    const card = document.getElementById(`card_frota_${frotaId}`);
    const column = event.target.closest('.kanban-column');
    
    if (column) column.classList.remove('column-drag-over');
    if (card) card.classList.remove('dragging');
    if (!frotaId || !column) return;

    try {
        const filialId = window.currentUser ? window.currentUser.filial_id : null;

        Swal.fire({
            toast: true, position: 'top-end', icon: 'info',
            title: 'Registrando movimentação...', showConfirmButton: false, background: '#1e293b', color: '#fff'
        });

        if (destinoId === 'disponivel') {
            const { error } = await window.supabaseClient.from('alocacao_frotas').delete().eq('frota_id', frotaId);
            if (error) throw error;
        } else {
            const { error } = await window.supabaseClient.from('alocacao_frotas').upsert({
                frota_id: frotaId,
                frente_id: destinoId,
                filial_id: filialId,
                updated_at: new Date().toISOString()
            }, { onConflict: 'frota_id' });
            if (error) throw error;
        }

        // Recarrega o painel inteiro para reprocessar os status, contadores e badges corretamente
        window.carregarKanbanAlocacao();

        Swal.fire({
            toast: true, position: 'top-end', icon: 'success',
            title: 'Frota realocada!', showConfirmButton: false, timer: 1500, background: '#1e293b', color: '#fff'
        });

    } catch (err) {
        console.error("Erro ao mover frota no banco:", err);
        Swal.fire({
            toast: true, position: 'top-end', icon: 'error',
            title: 'Falha ao salvar!', showConfirmButton: false, timer: 3000, background: '#1e293b', color: '#fff'
        });
        window.carregarKanbanAlocacao();
    }
};

document.addEventListener('dragend', (e) => {
    if (e.target.classList && e.target.classList.contains('kanban-card')) {
        e.target.classList.remove('dragging');
        document.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('column-drag-over'));
    }
});

// ==========================================
// Lógica de Observação Dinâmica
// ==========================================
window.adicionarObsAlocacao = async function(frotaId, obsAtual) {
    const { value: novaObs, isConfirmed } = await Swal.fire({
        title: 'Observação da Operação',
        input: 'textarea',
        inputLabel: 'Informe detalhes táticos para este veículo (Ex: Quebrado na estrada, Aguardando peça, Fila na balança):',
        inputValue: obsAtual && obsAtual !== 'undefined' ? obsAtual : '',
        inputPlaceholder: 'Digite aqui...',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-save"></i> Salvar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#0284c7',
        cancelButtonColor: '#475569',
        background: '#1e293b',
        color: '#fff'
    });

    if (isConfirmed) {
        try {
            const { data: aloc } = await window.supabaseClient.from('alocacao_frotas').select('id').eq('frota_id', frotaId).single();
            
            if (aloc) {
                await window.supabaseClient.from('alocacao_frotas').update({ observacao: novaObs }).eq('frota_id', frotaId);
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Observação atualizada!', showConfirmButton: false, timer: 2000, background: '#1e293b', color: '#fff' });
                window.carregarKanbanAlocacao();
            } else {
                Swal.fire({
                    icon: 'warning',
                    title: 'Veículo no Pátio',
                    text: 'O veículo precisa estar alocado em uma frente de serviço para receber uma observação operacional.',
                    background: '#1e293b', color: '#fff'
                });
            }
        } catch (err) {
            Swal.fire('Erro', 'Falha ao salvar a observação.', 'error');
        }
    }
};