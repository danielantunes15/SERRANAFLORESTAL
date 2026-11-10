window.renderizarAlocacaoFrota = async function() {
    console.log('[Módulo Logístico Unificado] Inicializado Kanban de Frotas e Recados.');
    // Inicia os dois painéis independentemente
    window.carregarKanbanAlocacao();
    window.carregarMuralTatico();
};

// ============================================================================
// 1. LÓGICA DO PAINEL TÁTICO DE FROTAS
// ============================================================================
window.carregarKanbanAlocacao = async function() {
    const board = document.getElementById('kanbanBoard');
    if (!board) return;

    try {
        const filialId = window.currentUser ? window.currentUser.filial_id : null;

        let queryFrentes = window.supabaseClient.from('config_gruas').select('id, frente, tipo_frente');
        if (filialId) queryFrentes = queryFrentes.eq('filial_id', filialId);
        const { data: frentes, error: errFrentes } = await queryFrentes;
        if (errFrentes) throw errFrentes;

        frentes.sort((a, b) => {
            const tipoA = (a.tipo_frente || '').toUpperCase();
            const tipoB = (b.tipo_frente || '').toUpperCase();
            if (tipoA === 'PROPRIA' && tipoB !== 'PROPRIA') return -1;
            if (tipoA !== 'PROPRIA' && tipoB === 'PROPRIA') return 1;
            return (a.frente || '').localeCompare(b.frente || '');
        });

        let queryFrotas = window.supabaseClient.from('frotas_manutencao').select('id, cavalo, numero_frota, go').eq('status', 'Ativo').ilike('categoria', '%TRITREM%');
        if (filialId) queryFrotas = queryFrotas.eq('filial_id', filialId);
        const { data: frotas, error: errFrotas } = await queryFrotas;
        if (errFrotas) throw errFrotas;

        let queryAlocacoes = window.supabaseClient.from('alocacao_frotas').select('*');
        if (filialId) queryAlocacoes = queryAlocacoes.eq('filial_id', filialId);
        const { data: alocacoes, error: errAlocacoes } = await queryAlocacoes;
        if (errAlocacoes) throw errAlocacoes;

        let queryOS = window.supabaseClient.from('ordens_servico').select('placa, status').neq('status', 'Concluída').eq('inativa', 0);
        if (filialId) queryOS = queryOS.eq('filial_id', filialId);
        const { data: ordensServico, error: errOS } = await queryOS;
        if (errOS) throw errOS;

        const veiculosEmManutencao = {};
        if (ordensServico) {
            ordensServico.forEach(os => { if (os.placa) veiculosEmManutencao[os.placa.toUpperCase()] = true; });
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

                return `
                <div class="kanban-card ${cardClass}" draggable="true" ondragstart="dragStartFrota(event, ${f.id})" id="card_frota_${f.id}">
                    
                    <div class="card-main-info">
                        <div class="status-dot ${dotClass}"></div>
                        <span class="placa-text">${f.cavalo || 'S/ PLACA'}</span>
                        <span class="id-text">${f.numero_frota || f.go || 'N/A'}</span>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 10px;">
                        <div class="obs-truncate">
                            ${iconInfo} ${f.observacao || ''}
                        </div>
                        <div class="flex-shrink-0">
                            <button onclick="gerenciarObsAlocacao(${f.id}, '${f.cavalo}', '${f.observacao || ''}')" class="text-slate-400 hover:text-white transition-colors bg-black/20 p-1.5 rounded flex items-center justify-center shadow-sm" title="Gerenciar Alerta">
                                <i class="fas fa-pen text-[10px]"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `}).join('');
        };

        board.innerHTML = '';

        let patioAtivos = 0; let patioManutencao = 0;
        frotasPorFrente['disponivel'].forEach(f => { if(f.emManutencao) patioManutencao++; else patioAtivos++; });

        board.innerHTML += `
            <div class="kanban-column col-patio" ondragover="allowDropFrota(event)" ondragleave="dragLeaveFrota(event)" ondrop="dropFrota(event, 'disponivel')">
                <div class="kanban-header">
                    <h3 class="font-extrabold text-slate-200 uppercase text-xs tracking-wider flex items-center gap-1.5">
                        <i class="fas fa-parking text-sky-400 text-sm"></i> PÁTIO
                    </h3>
                    <div class="flex gap-1.5">
                        <span class="bg-sky-600/20 text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded text-[10px] font-black shadow" title="Pátio Disponíveis">
                            <i class="fas fa-check-circle mr-1"></i> ${patioAtivos}
                        </span>
                        ${patioManutencao > 0 ? `<span class="bg-rose-900/40 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] font-black shadow" title="Pátio Manutenção"><i class="fas fa-tools mr-1"></i> ${patioManutencao}</span>` : ''}
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
            const tagFrente = isPropria ? `<span style="background: rgba(16,185,129,0.15); color: #34d399; font-size: 0.55rem; padding: 2px 5px; border-radius: 4px; border: 1px solid rgba(16,185,129,0.3); font-weight: 900; letter-spacing: 0.5px;"><i class="fas fa-star mr-1"></i>PRÓPRIA</span>` : '';

            board.innerHTML += `
                <div class="kanban-column" ondragover="allowDropFrota(event)" ondragleave="dragLeaveFrota(event)" ondrop="dropFrota(event, ${f.id})">
                    <div class="kanban-header" style="background: ${bgHeader}; ${borderTop} flex-direction: column; gap: 8px;">
                        <div class="flex justify-between w-full items-start">
                            <div class="flex flex-col gap-1">
                                <h3 class="font-extrabold text-sky-400 uppercase text-[12px] tracking-wide leading-tight"><i class="fas fa-map-marker-alt mr-1"></i> ${f.frente}</h3>
                                ${tagFrente}
                            </div>
                            <div class="flex flex-col gap-1 items-end">
                                <span class="bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-black shadow" title="Alocados Operando"><i class="fas fa-truck-loading mr-1"></i> ${frenteAtivos}</span>
                                ${frenteManutencao > 0 ? `<span class="bg-rose-900/40 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] font-black shadow" title="Alocados em Manutenção"><i class="fas fa-tools mr-1"></i> ${frenteManutencao}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="kanban-cards">
                        ${arrFrente.length > 0 ? gerarCardsHtml(arrFrente, false) : '<div class="text-center text-slate-500/40 text-xs mt-6 italic">Arraste os veículos para cá</div>'}
                    </div>
                </div>
            `;
        });

    } catch (err) {
        board.innerHTML = `<div style="width:100%; text-align:center; color:#ef4444; padding:40px; font-weight: bold;">Erro ao carregar Frotas.<br>${err.message}</div>`;
    }
};

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
                frota_id: frotaId, frente_id: destinoId, filial_id: filialId, updated_at: new Date().toISOString()
            }, { onConflict: 'frota_id' });
        }
        window.carregarKanbanAlocacao();
    } catch (err) {
        Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Falha ao mover!', showConfirmButton: false, timer: 2000, background: '#1e293b', color: '#fff' });
    }
};
document.addEventListener('dragend', (e) => {
    if (e.target.classList && e.target.classList.contains('kanban-card')) {
        e.target.classList.remove('dragging');
        document.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('column-drag-over'));
    }
});

// ============================================================================
// 2. LÓGICA DE RECADOS E ALERTAS INTEGRADOS
// ============================================================================
window.gerenciarObsAlocacao = async function(frotaId, placa, obsAtual) {
    const { data: aloc } = await window.supabaseClient.from('alocacao_frotas').select('id').eq('frota_id', frotaId).single();
    if (!aloc) return Swal.fire({ icon: 'warning', title: 'Atenção', text: 'O veículo precisa estar alocado para receber alertas.', background: '#1e293b', color: '#fff' });

    if (!obsAtual || obsAtual === 'undefined' || obsAtual.trim() === '') {
        const { value: novaObs, isConfirmed } = await Swal.fire({
            title: 'Novo Alerta de Frota',
            input: 'text', inputPlaceholder: 'Ex: Aguardando peça, Fila na balança...',
            showCancelButton: true, confirmButtonText: 'Salvar', confirmButtonColor: '#f59e0b', background: '#1e293b', color: '#fff'
        });
        if (isConfirmed && novaObs) {
            await window.supabaseClient.from('alocacao_frotas').update({ observacao: novaObs }).eq('frota_id', frotaId);
            window.carregarKanbanAlocacao();
        }
    } else {
        const result = await Swal.fire({
            title: 'Gerenciar Alerta',
            html: `<div style="background: rgba(0,0,0,0.3); padding: 12px; border-left: 4px solid #f59e0b; border-radius: 6px; color: #f8fafc; font-weight: 500; font-size: 1.1rem; text-align: left; margin-bottom: 20px;">${obsAtual}</div>`,
            showCancelButton: true, showDenyButton: true,
            confirmButtonColor: '#10b981', denyButtonColor: '#3b82f6', cancelButtonColor: '#ef4444',
            confirmButtonText: '✔ Concluir', denyButtonText: '✏️ Editar', cancelButtonText: '🗑️ Apagar',
            background: '#1e293b', color: '#fff'
        });

        if (result.isConfirmed) {
            const nomeUsr = window.currentUser ? (window.currentUser.nome_completo || window.currentUser.username) : 'Sistema';
            const fid = window.currentUser ? window.currentUser.filial_id : 1;
            
            await window.supabaseClient.from('alocacao_frotas').update({ observacao: null }).eq('frota_id', frotaId);
            await window.supabaseClient.from('recados_anotacoes').insert([{
                titulo: `Alerta Resolvido - Placa: ${placa}`,
                descricao: `O alerta tático [ ${obsAtual} ] foi concluído/resolvido por ${nomeUsr}.`,
                data_agendamento: new Date().toISOString(),
                status: 'concluido', prioridade: 'media', filial_id: fid
            }]);
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Resolvido e Arquivado!', showConfirmButton: false, timer: 2000, background: '#1e293b', color: '#fff' });
            window.carregarKanbanAlocacao();
            window.carregarMuralTatico(); 
        } else if (result.isDenied) {
            const { value: nObs } = await Swal.fire({ title: 'Editar Alerta', input: 'text', inputValue: obsAtual, showCancelButton: true, background: '#1e293b', color: '#fff' });
            if (nObs && nObs !== obsAtual) {
                await window.supabaseClient.from('alocacao_frotas').update({ observacao: nObs }).eq('frota_id', frotaId);
                window.carregarKanbanAlocacao();
            }
        } else if (result.dismiss === Swal.DismissReason.cancel) {
            await window.supabaseClient.from('alocacao_frotas').update({ observacao: null }).eq('frota_id', frotaId);
            window.carregarKanbanAlocacao();
        }
    }
};

window.carregarMuralTatico = function() {
    const form = document.getElementById('form-recado-tatico');
    if (form && !form.hasAttribute('data-listener')) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await window.salvarAlocacaoRecado();
        });
        form.setAttribute('data-listener', 'true');
    }
    window.atualizarListaMuralTatico();
};

window.alternarAbaMuralTatico = function(aba) {
    const q = document.getElementById('view-quadro-mural-tatico');
    const h = document.getElementById('view-historico-mural-tatico');
    if (aba === 'quadro') {
        q.style.display = 'flex'; h.style.display = 'none';
        document.getElementById('btn-tab-quadro').classList.add('active');
        document.getElementById('btn-tab-historico').classList.remove('active');
        window.atualizarListaMuralTatico();
    } else {
        q.style.display = 'none'; h.style.display = 'block';
        document.getElementById('btn-tab-historico').classList.add('active');
        document.getElementById('btn-tab-quadro').classList.remove('active');
        window.carregarHistoricoMuralTatico();
    }
};

window.salvarAlocacaoRecado = async function() {
    try {
        let payload = { 
            titulo: document.getElementById('titulo-recado-tatico').value, 
            descricao: document.getElementById('desc-recado-tatico').value, 
            prioridade: document.getElementById('prioridade-recado-tatico').value,
            data_agendamento: document.getElementById('data-recado-tatico').value,
            status: 'pendente' 
        };
        if (typeof window.injetarFilial === 'function') payload = window.injetarFilial(payload);

        const { error } = await window.supabaseClient.from('recados_anotacoes').insert([payload]);
        if (error) throw error;
        
        document.getElementById('form-recado-tatico').reset();
        document.getElementById('prioridade-recado-tatico').value = 'media';
        window.atualizarListaMuralTatico(); 
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Adicionado!', showConfirmButton: false, timer: 1500, background: '#1e293b', color: '#fff' });
    } catch (e) { Swal.fire('Erro', e.message, 'error'); }
};

window.atualizarListaMuralTatico = async function() {
    const ids = ['baixa', 'media', 'alta', 'troca'];
    ids.forEach(id => { const el = document.getElementById(`lista-${id}-tatico`); if(el) el.innerHTML = ''; });
    
    try {
        let query = window.supabaseClient.from('recados_anotacoes').select('*').eq('status', 'pendente').order('data_agendamento', { ascending: true });
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
        const { data: recados, error } = await query;
        if (error) throw error;

        const cnt = { baixa: 0, media: 0, alta: 0, troca: 0 };

        if (recados) {
            recados.forEach(r => {
                const prio = r.prioridade || 'media'; 
                if(cnt[prio] !== undefined) cnt[prio]++;
                const container = document.getElementById(`lista-${prio}-tatico`);
                if (container) {
                    const df = r.data_agendamento ? new Date(r.data_agendamento).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
                    
                    let borderColor = '#3b82f6';
                    if(prio === 'media') borderColor = '#f59e0b';
                    if(prio === 'alta') borderColor = '#ef4444';
                    if(prio === 'troca') borderColor = '#a855f7';

                    container.insertAdjacentHTML('beforeend', `
                        <div class="kanban-card" style="border-left: 4px solid ${borderColor}; cursor: grab;" draggable="true" ondragstart="arrastarMuralTatico(event, ${r.id})">
                            <h4 style="font-weight: bold; color: #f8fafc; margin-bottom: 5px; font-size: 1rem;">${r.titulo}</h4>
                            <p style="color: #94a3b8; font-size: 0.85rem; line-height: 1.4; margin-bottom: 10px;">${r.descricao}</p>
                            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">
                                <span style="font-size: 0.75rem; color: #64748b; background: rgba(0,0,0,0.2); padding: 4px 6px; border-radius: 4px;"><i class="far fa-clock"></i> ${df}</span>
                                <button onclick="concluirMuralTatico(${r.id})" class="text-emerald-400 hover:bg-emerald-400 hover:text-slate-900 px-3 py-1.5 rounded font-bold border border-emerald-400 transition-colors text-xs" title="Concluir Tarefa"><i class="fas fa-check mr-1"></i> Concluir</button>
                            </div>
                        </div>
                    `);
                }
            });
        }
        ids.forEach(id => { const el = document.getElementById(`count-${id}-tatico`); if(el) el.innerText = cnt[id]; });
    } catch (e) { console.error('Erro recados taticos:', e); }
};

window.arrastarMuralTatico = function(e, id) { e.dataTransfer.setData('recadoId', id); e.target.classList.add('dragging'); };
window.permitirSoltarMuralTatico = function(e) { e.preventDefault(); const c = e.target.closest('.kanban-column'); if(c) c.classList.add('column-drag-over'); };
window.dragLeaveMuralTatico = function(e) { const c = e.target.closest('.kanban-column'); if(c) c.classList.remove('column-drag-over'); };

window.soltarMuralTatico = async function(e, novaPrioridade) {
    e.preventDefault();
    const id = e.dataTransfer.getData('recadoId');
    const c = e.target.closest('.kanban-column'); 
    if(c) c.classList.remove('column-drag-over');
    if(!id) return;
    try {
        await window.supabaseClient.from('recados_anotacoes').update({ prioridade: novaPrioridade }).eq('id', id);
        window.atualizarListaMuralTatico();
    } catch (err) {}
};

window.concluirMuralTatico = async function(id) {
    try {
        await window.supabaseClient.from('recados_anotacoes').update({ status: 'concluido' }).eq('id', id);
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Anotação Concluída!', showConfirmButton: false, timer: 1500, background: '#1e293b', color: '#fff' });
        window.atualizarListaMuralTatico();
    } catch (err) {}
};

window.carregarHistoricoMuralTatico = async function() {
    const cont = document.getElementById('lista-historico-tatico');
    if(!cont) return;
    try {
        let query = window.supabaseClient.from('recados_anotacoes').select('*').eq('status', 'concluido').order('data_agendamento', { ascending: false }).limit(50);
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
        const { data, error } = await query;
        if (error) throw error;
        cont.innerHTML = '';
        if(data && data.length > 0) {
            data.forEach(r => {
                const df = r.data_agendamento ? new Date(r.data_agendamento).toLocaleString('pt-BR') : '';
                cont.insertAdjacentHTML('beforeend', `
                    <div style="background: rgba(30, 41, 59, 0.6); padding: 18px; border-radius: 10px; border-left: 4px solid #10b981; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <h4 style="text-decoration: line-through; color: #10b981; font-weight: bold; margin-bottom: 8px; font-size: 1.1rem;">${r.titulo}</h4>
                        <p style="color: #cbd5e1; font-size: 0.9rem; margin-bottom: 12px; line-height: 1.4;">${r.descricao}</p>
                        <div style="font-size: 0.8rem; color: #94a3b8; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px;"><i class="fas fa-check-double text-emerald-500 mr-1"></i> Finalizado em: <strong style="color: #fff;">${df}</strong></div>
                    </div>
                `);
            });
        } else {
            cont.innerHTML = '<div style="color:#64748b; font-style:italic;">Nenhum histórico recente.</div>';
        }
    } catch(e) {}
};

window.limparHistoricoMuralTatico = async function() {
    const { isConfirmed } = await Swal.fire({
        title: 'Tem certeza?', text: 'Isso apagará permanentemente o histórico de recados e alertas concluídos desta filial.',
        icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#475569',
        confirmButtonText: 'Sim, Limpar', background: '#1e293b', color: '#fff'
    });
    if(isConfirmed) {
        let query = window.supabaseClient.from('recados_anotacoes').delete().eq('status', 'concluido');
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
        await query;
        window.carregarHistoricoMuralTatico();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Histórico Limpo', showConfirmButton: false, timer: 2000, background: '#1e293b', color: '#fff' });
    }
};