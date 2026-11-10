window.renderizarAlocacaoFrota = async function() {
    console.log('[Módulo Alocação de Frota] Inicializado Kanban Inteligente Compacto.');
    await window.carregarKanbanAlocacao();
};

window.carregarKanbanAlocacao = async function() {
    const board = document.getElementById('kanbanBoard');
    if (!board) return;

    try {
        const filialId = window.currentUser ? window.currentUser.filial_id : null;

        // 1. Buscar Frentes de Serviço
        let queryFrentes = window.supabaseClient.from('config_gruas').select('id, frente, tipo_frente');
        if (filialId) queryFrentes = queryFrentes.eq('filial_id', filialId);
        const { data: frentes, error: errFrentes } = await queryFrentes;
        if (errFrentes) throw errFrentes;

        // Ordenação Frentes: Próprias primeiro, depois por ordem alfabética
        frentes.sort((a, b) => {
            const tipoA = (a.tipo_frente || '').toUpperCase();
            const tipoB = (b.tipo_frente || '').toUpperCase();
            if (tipoA === 'PROPRIA' && tipoB !== 'PROPRIA') return -1;
            if (tipoA !== 'PROPRIA' && tipoB === 'PROPRIA') return 1;
            return (a.frente || '').localeCompare(b.frente || '');
        });

        // 2. Buscar Frotas TRITREM Ativas
        let queryFrotas = window.supabaseClient.from('frotas_manutencao').select('id, cavalo, numero_frota, go').eq('status', 'Ativo').ilike('categoria', '%TRITREM%');
        if (filialId) queryFrotas = queryFrotas.eq('filial_id', filialId);
        const { data: frotas, error: errFrotas } = await queryFrotas;
        if (errFrotas) throw errFrotas;

        // 3. Buscar Alocações Atuais
        let queryAlocacoes = window.supabaseClient.from('alocacao_frotas').select('*');
        if (filialId) queryAlocacoes = queryAlocacoes.eq('filial_id', filialId);
        const { data: alocacoes, error: errAlocacoes } = await queryAlocacoes;
        if (errAlocacoes) throw errAlocacoes;

        // 4. Buscar Ordens de Serviço (Manutenção) ABERTAS
        let queryOS = window.supabaseClient.from('ordens_servico').select('placa, status').neq('status', 'Concluída').eq('inativa', 0);
        if (filialId) queryOS = queryOS.eq('filial_id', filialId);
        const { data: ordensServico, error: errOS } = await queryOS;
        if (errOS) throw errOS;

        // Mapear Manutenções Ativas
        const veiculosEmManutencao = {};
        if (ordensServico) {
            ordensServico.forEach(os => {
                if (os.placa) veiculosEmManutencao[os.placa.toUpperCase()] = true;
            });
        }

        // Mapear Alocações
        const mapAlocacoes = {}; 
        if (alocacoes) alocacoes.forEach(a => mapAlocacoes[a.frota_id] = a);

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

        if(document.getElementById('ind_patio')) document.getElementById('ind_patio').innerText = contPatio;
        if(document.getElementById('ind_alocados')) document.getElementById('ind_alocados').innerText = contAlocados;
        if(document.getElementById('ind_manutencao')) document.getElementById('ind_manutencao').innerText = contManutencao;

        // Função geradora de Cards Modernos Compactos (Com ordenação Inteligente)
        const gerarCardsHtml = (frotasArray, isPatio) => {
            // ORDENAÇÃO: 1º Manutenção, 2º Com Observação (Alerta), 3º Alfabética
            frotasArray.sort((a, b) => {
                const pesoA = (a.emManutencao ? 3 : (a.observacao ? 2 : 1));
                const pesoB = (b.emManutencao ? 3 : (b.observacao ? 2 : 1));
                if (pesoA !== pesoB) return pesoB - pesoA; // Maior peso sobe
                return (a.cavalo || '').localeCompare(b.cavalo || '');
            });

            return frotasArray.map(f => {
                let dotClass = isPatio ? 'dot-patio' : 'dot-ok';
                let cardClass = '';
                let iconInfo = '';

                // Regras Visuais de Alerta
                if (f.emManutencao) {
                    dotClass = 'dot-manutencao';
                    cardClass = 'card-manutencao';
                    iconInfo = `<i class="fas fa-tools text-rose-400 mr-1" title="Em Manutenção"></i>`;
                } else if (f.observacao) {
                    cardClass = 'card-alerta';
                    iconInfo = `<i class="fas fa-exclamation-triangle text-amber-500 mr-1" title="Contém Observação"></i>`;
                }

                // O tooltip (title) mostrará a observação completa caso o usuário passe o mouse
                const tooltipText = f.observacao ? f.observacao.replace(/"/g, '&quot;') : (f.emManutencao ? 'Veículo em Manutenção' : 'Operação Normal');

                return `
                <div class="kanban-card ${cardClass}" draggable="true" ondragstart="dragStartFrota(event, ${f.id})" id="card_frota_${f.id}" title="${tooltipText}">
                    <div class="status-dot ${dotClass}"></div>
                    
                    <div class="card-main-info">
                        <span class="placa-text">${f.cavalo || 'S/ PLACA'}</span>
                        <span class="id-text">${f.numero_frota || f.go || 'N/A'}</span>
                    </div>

                    <div class="obs-truncate">
                        ${iconInfo} ${f.observacao || ''}
                    </div>
                    
                    <div class="flex-shrink-0 ml-2">
                        <button onclick="adicionarObsAlocacao(${f.id}, '${f.observacao || ''}')" class="text-slate-400 hover:text-white transition-colors bg-black/20 p-1.5 rounded flex items-center justify-center" title="Editar Observação">
                            <i class="fas fa-pen text-[10px]"></i>
                        </button>
                    </div>
                </div>
            `}).join('');
        };

        board.innerHTML = '';

        // Coluna 1: Disponíveis / Pátio (COLUNA FIXA)
        board.innerHTML += `
            <div class="kanban-column col-patio" id="col_disponivel" ondragover="allowDropFrota(event)" ondragleave="dragLeaveFrota(event)" ondrop="dropFrota(event, 'disponivel')">
                <div class="kanban-header">
                    <h3 class="font-extrabold text-slate-200 uppercase text-xs tracking-wider"><i class="fas fa-parking text-sky-400 mr-1.5"></i> Pátio</h3>
                    <span class="bg-sky-600 text-white px-2 py-0.5 rounded text-xs font-black shadow">${frotasPorFrente['disponivel'].length}</span>
                </div>
                <div class="kanban-cards">
                    ${frotasPorFrente['disponivel'].length > 0 ? gerarCardsHtml(frotasPorFrente['disponivel'], true) : '<div class="text-center text-slate-500 text-xs mt-4 italic">Pátio vazio</div>'}
                </div>
            </div>
        `;

        // Colunas Frentes
        frentes.forEach(f => {
            const arrFrente = frotasPorFrente[f.id];
            
            const isPropria = (f.tipo_frente || '').toUpperCase() === 'PROPRIA';
            const bgHeader = isPropria ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.02)';
            const borderTop = isPropria ? 'border-top: 2px solid #10b981;' : '';
            const tagFrente = isPropria 
                ? `<span style="background: rgba(16,185,129,0.15); color: #34d399; font-size: 0.6rem; padding: 2px 5px; border-radius: 4px; font-weight: 800;"><i class="fas fa-star mr-1"></i>PRÓPRIA</span>`
                : '';

            board.innerHTML += `
                <div class="kanban-column" id="col_${f.id}" ondragover="allowDropFrota(event)" ondragleave="dragLeaveFrota(event)" ondrop="dropFrota(event, ${f.id})">
                    <div class="kanban-header" style="background: ${bgHeader}; ${borderTop}">
                        <div class="flex flex-col gap-1">
                            <h3 class="font-extrabold text-sky-400 uppercase text-xs tracking-wider">
                                <i class="fas fa-map-marker-alt mr-1"></i> ${f.frente}
                            </h3>
                            ${tagFrente}
                        </div>
                        <span class="bg-slate-700 text-slate-200 px-2 py-0.5 rounded text-xs font-black shadow">${arrFrente.length}</span>
                    </div>
                    <div class="kanban-cards">
                        ${arrFrente.length > 0 ? gerarCardsHtml(arrFrente, false) : '<div class="text-center text-slate-500/40 text-xs mt-6 italic">Arraste os veículos para cá</div>'}
                    </div>
                </div>
            `;
        });

    } catch (err) {
        console.error('Erro Kanban Inteligente Compacto:', err);
        board.innerHTML = `<div style="width:100%; text-align:center; color:#ef4444; padding:40px; font-weight: bold;">Erro ao carregar o painel.<br>${err.message}</div>`;
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

        window.carregarKanbanAlocacao();
    } catch (err) {
        console.error("Erro ao mover frota no banco:", err);
        Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Falha ao salvar!', showConfirmButton: false, timer: 3000, background: '#1e293b', color: '#fff' });
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
        input: 'text',
        inputLabel: 'Breve alerta (ficará em destaque):',
        inputValue: obsAtual && obsAtual !== 'undefined' ? obsAtual : '',
        inputPlaceholder: 'Ex: Fila na balança, Pneu furado...',
        showCancelButton: true,
        confirmButtonText: 'Salvar Alerta',
        cancelButtonText: 'Limpar / Cancelar',
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#475569',
        background: '#1e293b',
        color: '#fff'
    });

    if (isConfirmed) {
        try {
            const { data: aloc } = await window.supabaseClient.from('alocacao_frotas').select('id').eq('frota_id', frotaId).single();
            if (aloc) {
                await window.supabaseClient.from('alocacao_frotas').update({ observacao: novaObs }).eq('frota_id', frotaId);
                window.carregarKanbanAlocacao();
            } else {
                Swal.fire({ icon: 'warning', title: 'Veículo no Pátio', text: 'Veículo precisa estar alocado para receber alerta.', background: '#1e293b', color: '#fff' });
            }
        } catch (err) {
            Swal.fire('Erro', 'Falha ao salvar o alerta.', 'error');
        }
    }
};