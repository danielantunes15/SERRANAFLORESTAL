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
                if (!frota.emManutencao) contAlocados++;
            } else {
                frotasPorFrente['disponivel'].push(frota);
                contPatio++;
            }
        });

        if(document.getElementById('ind_patio')) document.getElementById('ind_patio').innerText = contPatio;
        if(document.getElementById('ind_alocados')) document.getElementById('ind_alocados').innerText = contAlocados;
        if(document.getElementById('ind_manutencao')) document.getElementById('ind_manutencao').innerText = contManutencao;

        const gerarCardsHtml = (frotasArray, isPatio) => {
            frotasArray.sort((a, b) => {
                const pesoA = (a.emManutencao ? 3 : (a.observacao ? 2 : 1));
                const pesoB = (b.emManutencao ? 3 : (b.observacao ? 2 : 1));
                if (pesoA !== pesoB) return pesoB - pesoA; 
                return (a.cavalo || '').localeCompare(b.cavalo || '');
            });

            return frotasArray.map(f => {
                let dotClass = isPatio ? 'dot-patio' : 'dot-ok';
                let cardClass = '';
                let iconInfo = '';

                if (f.emManutencao) {
                    dotClass = 'dot-manutencao';
                    cardClass = 'card-manutencao';
                    iconInfo = `<i class="fas fa-tools text-rose-400 mr-1" title="Em Manutenção"></i>`;
                } else if (f.observacao) {
                    cardClass = 'card-alerta';
                    iconInfo = `<i class="fas fa-exclamation-triangle text-amber-500 mr-1" title="Contém Observação"></i>`;
                }

                const tooltipText = f.observacao ? f.observacao.replace(/"/g, '&quot;') : (f.emManutencao ? 'Veículo em Manutenção' : 'Operação Normal');
                const btnIcon = f.observacao ? 'fa-cog' : 'fa-pen';
                const btnColor = f.observacao ? 'text-sky-400 bg-sky-900/40 border border-sky-500/50' : 'text-slate-400 bg-black/20 border border-transparent';

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
                    
                    <div class="flex-shrink-0 ml-1">
                        <button onclick="gerenciarObsAlocacao(${f.id}, '${f.cavalo || 'S/Placa'}', '${f.observacao || ''}')" class="hover:text-white transition-colors ${btnColor} p-2 rounded-lg flex items-center justify-center shadow-sm" title="Gerenciar Alerta">
                            <i class="fas ${btnIcon} text-[11px]"></i>
                        </button>
                    </div>
                </div>
            `}).join('');
        };

        board.innerHTML = '';

        // Contadores do Pátio
        let patioAtivos = 0; let patioManutencao = 0;
        frotasPorFrente['disponivel'].forEach(f => { if(f.emManutencao) patioManutencao++; else patioAtivos++; });

        board.innerHTML += `
            <div class="kanban-column col-patio" id="col_disponivel" ondragover="allowDropFrota(event)" ondragleave="dragLeaveFrota(event)" ondrop="dropFrota(event, 'disponivel')">
                <div class="kanban-header">
                    <h3 class="font-extrabold text-slate-200 uppercase text-xs tracking-wider flex items-center gap-2">
                        <i class="fas fa-parking text-sky-400 text-lg"></i> PÁTIO
                    </h3>
                    <div class="flex gap-2">
                        <span class="bg-sky-600/20 text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded text-[10px] font-black shadow" title="Disponíveis Operando">
                            <i class="fas fa-check-circle mr-1"></i> ${patioAtivos}
                        </span>
                        ${patioManutencao > 0 ? `
                        <span class="bg-rose-900/40 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] font-black shadow" title="Disponíveis em Manutenção">
                            <i class="fas fa-tools mr-1"></i> ${patioManutencao}
                        </span>` : ''}
                    </div>
                </div>
                <div class="kanban-cards">
                    ${frotasPorFrente['disponivel'].length > 0 ? gerarCardsHtml(frotasPorFrente['disponivel'], true) : '<div class="text-center text-slate-500 text-sm mt-6 italic">Pátio vazio</div>'}
                </div>
            </div>
        `;

        frentes.forEach(f => {
            const arrFrente = frotasPorFrente[f.id];
            let frenteAtivos = 0; let frenteManutencao = 0;
            arrFrente.forEach(frota => { if(frota.emManutencao) frenteManutencao++; else frenteAtivos++; });
            
            const isPropria = (f.tipo_frente || '').toUpperCase() === 'PROPRIA';
            const bgHeader = isPropria ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.02)';
            const borderTop = isPropria ? 'border-top: 3px solid #10b981;' : 'border-top: 3px solid rgba(255,255,255,0.1);';
            const tagFrente = isPropria 
                ? `<span style="background: rgba(16,185,129,0.15); color: #34d399; font-size: 0.6rem; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(16,185,129,0.3); font-weight: 900; letter-spacing: 0.5px;"><i class="fas fa-star mr-1"></i>PRÓPRIA</span>`
                : '';

            board.innerHTML += `
                <div class="kanban-column" id="col_${f.id}" ondragover="allowDropFrota(event)" ondragleave="dragLeaveFrota(event)" ondrop="dropFrota(event, ${f.id})">
                    <div class="kanban-header" style="background: ${bgHeader}; ${borderTop} flex-direction: column; gap: 10px;">
                        
                        <div class="flex justify-between w-full items-start">
                            <div class="flex flex-col gap-1.5">
                                <h3 class="font-extrabold text-sky-400 uppercase text-[13px] tracking-wide leading-tight">
                                    <i class="fas fa-map-marker-alt mr-1"></i> ${f.frente}
                                </h3>
                                ${tagFrente}
                            </div>
                            
                            <div class="flex flex-col gap-1 items-end">
                                <span class="bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-black shadow" title="Alocados Operando">
                                    <i class="fas fa-truck-loading mr-1"></i> ${frenteAtivos}
                                </span>
                                ${frenteManutencao > 0 ? `
                                <span class="bg-rose-900/40 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] font-black shadow" title="Alocados em Manutenção">
                                    <i class="fas fa-tools mr-1"></i> ${frenteManutencao}
                                </span>` : ''}
                            </div>
                        </div>

                    </div>
                    <div class="kanban-cards">
                        ${arrFrente.length > 0 ? gerarCardsHtml(arrFrente, false) : '<div class="text-center text-slate-500/40 text-sm mt-8 italic border-2 border-dashed border-slate-700/50 rounded-xl p-6 font-semibold">Arraste os veículos<br>para esta frente</div>'}
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
            await window.supabaseClient.from('alocacao_frotas').delete().eq('frota_id', frotaId);
        } else {
            await window.supabaseClient.from('alocacao_frotas').upsert({
                frota_id: frotaId,
                frente_id: destinoId,
                filial_id: filialId,
                updated_at: new Date().toISOString()
            }, { onConflict: 'frota_id' });
        }
        window.carregarKanbanAlocacao();
    } catch (err) {
        Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Falha ao mover!', showConfirmButton: false, timer: 3000, background: '#1e293b', color: '#fff' });
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
// Lógica de Alertas Integrada ao Banco de Recados
// ==========================================
window.gerenciarObsAlocacao = async function(frotaId, placa, obsAtual) {
    // Verifica se a frota está alocada primeiro
    const { data: aloc } = await window.supabaseClient.from('alocacao_frotas').select('id').eq('frota_id', frotaId).single();
    if (!aloc) {
        return Swal.fire({ icon: 'warning', title: 'Veículo no Pátio', text: 'O veículo precisa estar em operação (alocado) para receber alertas.', background: '#1e293b', color: '#fff' });
    }

    if (!obsAtual || obsAtual === 'undefined' || obsAtual.trim() === '') {
        // Criar Novo Alerta
        const { value: novaObs, isConfirmed } = await Swal.fire({
            title: 'Novo Alerta / Observação',
            input: 'text',
            inputLabel: 'Informe o detalhe operacional:',
            inputPlaceholder: 'Ex: Fila na balança, Pneu furado...',
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-save"></i> Salvar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#f59e0b',
            cancelButtonColor: '#475569',
            background: '#1e293b',
            color: '#fff'
        });

        if (isConfirmed && novaObs) {
            await window.supabaseClient.from('alocacao_frotas').update({ observacao: novaObs }).eq('frota_id', frotaId);
            window.carregarKanbanAlocacao();
        }
    } else {
        // Gerenciar Alerta Existente
        const result = await Swal.fire({
            title: 'Gerenciar Alerta',
            html: `
                <p style="color: #cbd5e1; font-size: 0.9rem; margin-bottom: 10px; text-align: left;">Alerta registrado no momento:</p>
                <div style="background: rgba(0,0,0,0.3); padding: 12px; border-left: 4px solid #f59e0b; border-radius: 6px; color: #f8fafc; font-weight: 500; font-size: 1.1rem; text-align: left; margin-bottom: 20px;">
                    ${obsAtual}
                </div>
                <p style="color: #94a3b8; font-size: 0.8rem; text-align: left;">Se o problema foi resolvido, você pode conclui-lo para gerar um histórico.</p>
            `,
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonColor: '#10b981',
            denyButtonColor: '#3b82f6',
            cancelButtonColor: '#ef4444',
            confirmButtonText: '<i class="fas fa-check-circle"></i> Concluir',
            denyButtonText: '<i class="fas fa-pen"></i> Editar',
            cancelButtonText: '<i class="fas fa-trash"></i> Excluir',
            background: '#1e293b',
            color: '#fff'
        });

        if (result.isConfirmed) {
            // AÇÃO: CONCLUIR E REGISTRAR NO BANCO DE RECADOS
            const nomeUsuario = window.currentUser ? (window.currentUser.nome_completo || window.currentUser.username) : 'Usuário Desconhecido';
            const filialId = window.currentUser ? window.currentUser.filial_id : 1;

            const confirmFinal = await Swal.fire({
                title: 'Concluir Alerta?',
                text: `Isso registrará a solução do alerta no nome de ${nomeUsuario}.`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#10b981',
                cancelButtonColor: '#475569',
                confirmButtonText: 'Sim, Concluir!',
                cancelButtonText: 'Cancelar',
                background: '#1e293b',
                color: '#fff'
            });

            if (confirmFinal.isConfirmed) {
                Swal.fire({ title: 'Salvando histórico...', background: '#1e293b', color: '#fff', didOpen: () => { Swal.showLoading(); }});
                
                // 1. Apaga do Kanban
                await window.supabaseClient.from('alocacao_frotas').update({ observacao: null }).eq('frota_id', frotaId);
                
                // 2. Registra na tabela de Anotações
                await window.supabaseClient.from('recados_anotacoes').insert([{
                    titulo: `Alerta Resolvido - Placa: ${placa}`,
                    descricao: `O alerta tático [ ${obsAtual} ] foi concluído/resolvido por ${nomeUsuario}.`,
                    data_agendamento: new Date().toISOString(),
                    status: 'concluido',
                    prioridade: 'media',
                    filial_id: filialId
                }]);

                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Alerta concluído e registrado!', showConfirmButton: false, timer: 2500, background: '#1e293b', color: '#fff' });
                window.carregarKanbanAlocacao();
            }

        } else if (result.isDenied) {
            // AÇÃO: EDITAR
            const { value: novaObsEdit } = await Swal.fire({
                title: 'Editar Alerta',
                input: 'text',
                inputValue: obsAtual,
                showCancelButton: true,
                confirmButtonText: 'Salvar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#3b82f6',
                cancelButtonColor: '#475569',
                background: '#1e293b',
                color: '#fff'
            });

            if (novaObsEdit && novaObsEdit !== obsAtual) {
                await window.supabaseClient.from('alocacao_frotas').update({ observacao: novaObsEdit }).eq('frota_id', frotaId);
                window.carregarKanbanAlocacao();
            }

        } else if (result.dismiss === Swal.DismissReason.cancel) {
            // AÇÃO: EXCLUIR SEM REGISTRAR (Descartar)
            const confirmDel = await Swal.fire({
                title: 'Excluir Alerta?',
                text: 'Tem certeza? Isso apagará a anotação sem deixar histórico de resolução.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#475569',
                confirmButtonText: 'Sim, Apagar',
                cancelButtonText: 'Cancelar',
                background: '#1e293b',
                color: '#fff'
            });

            if (confirmDel.isConfirmed) {
                await window.supabaseClient.from('alocacao_frotas').update({ observacao: null }).eq('frota_id', frotaId);
                window.carregarKanbanAlocacao();
            }
        }
    }
};