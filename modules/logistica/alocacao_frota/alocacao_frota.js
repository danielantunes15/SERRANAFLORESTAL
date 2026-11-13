// Variáveis Globais de Estado para o Modal do Pátio e Exportação
window.frotasPatio = [];
window.frentesDisponiveis = [];

window.renderizarAlocacaoFrota = async function() {
    console.log('[Módulo Logístico Unificado] Inicializado Kanban de Frotas e Recados.');
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
        window.frentesDisponiveis = frentes; 

        // Agora buscando as colunas de GO e Carretas
        let queryFrotas = window.supabaseClient.from('frotas_manutencao').select('id, cavalo, numero_frota, go, carreta1, carreta2, carreta3').eq('status', 'Ativo').ilike('categoria', '%TRITREM%');
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

        window.frotasPatio = frotasPorFrente['disponivel'];

        if(document.getElementById('badge-patio')) document.getElementById('badge-patio').innerText = contPatio;
        if(document.getElementById('ind_alocados')) document.getElementById('ind_alocados').innerText = contAlocados;
        if(document.getElementById('ind_manutencao')) document.getElementById('ind_manutencao').innerText = contManutencao;

        const gerarCardsHtml = (frotasArray) => {
            frotasArray.sort((a, b) => {
                const pesoA = (a.emManutencao ? 3 : (a.observacao ? 2 : 1));
                const pesoB = (b.emManutencao ? 3 : (b.observacao ? 2 : 1));
                if (pesoA !== pesoB) return pesoB - pesoA; 
                return (a.cavalo || '').localeCompare(b.cavalo || '');
            });

            return frotasArray.map(f => {
                let dotClass = 'dot-ok';
                let cardClass = '';
                let iconInfo = '';

                if (f.emManutencao) {
                    dotClass = 'dot-manutencao';
                    cardClass = 'card-manutencao';
                    iconInfo = `<i class="fas fa-tools text-rose-400 mr-2" title="Em Manutenção"></i>`;
                } else if (f.observacao) {
                    cardClass = 'card-alerta';
                    iconInfo = `<i class="fas fa-exclamation-triangle text-amber-500 mr-2" title="Contém Observação"></i>`;
                }
                
                const safeObs = (f.observacao || '').replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, "\\n");

                // Observação visivelmente destacada, alinhada à esquerda e com quebra de texto
                let divObservacao = '';
                if (f.observacao && f.observacao.trim() !== '') {
                    divObservacao = `
                    <div class="obs-text mt-1" onclick="gerenciarObsAlocacao(${f.id}, '${f.cavalo}', '${safeObs}')" title="Clique para gerenciar o alerta">
                        ${iconInfo} ${f.observacao}
                    </div>`;
                }

                // Criação das badges de GO e Carretas (Aparecem logo abaixo da placa)
                const badges = [];
                if (f.go) badges.push(`<span class="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded text-[11px] font-bold tracking-wide shadow-sm" title="Código GO"><i class="fas fa-barcode mr-1 opacity-70"></i>${f.go}</span>`);
                if (f.carreta1) badges.push(`<span class="bg-slate-700/60 text-slate-200 border border-slate-600 px-2.5 py-0.5 rounded text-[11px] font-bold shadow-sm"><i class="fas fa-trailer opacity-50 mr-1"></i>${f.carreta1}</span>`);
                if (f.carreta2) badges.push(`<span class="bg-slate-700/60 text-slate-200 border border-slate-600 px-2.5 py-0.5 rounded text-[11px] font-bold shadow-sm"><i class="fas fa-trailer opacity-50 mr-1"></i>${f.carreta2}</span>`);
                if (f.carreta3) badges.push(`<span class="bg-slate-700/60 text-slate-200 border border-slate-600 px-2.5 py-0.5 rounded text-[11px] font-bold shadow-sm"><i class="fas fa-trailer opacity-50 mr-1"></i>${f.carreta3}</span>`);
                
                let implementosHtml = badges.length > 0 ? `<div class="flex items-center gap-2 mt-2 flex-wrap bg-black/20 p-2.5 rounded-lg border border-white/5">${badges.join('')}</div>` : '';

                return `
                <div class="kanban-card ${cardClass}" draggable="true" ondragstart="dragStartFrota(event, ${f.id})" id="card_frota_${f.id}">
                    <div class="card-main-info">
                        <div class="flex items-center justify-between w-full">
                            <div class="flex items-center gap-3">
                                <div class="status-dot ${dotClass}"></div>
                                <!-- Ícone de + adicionado ao lado da placa -->
                                <span class="placa-text" onclick="gerenciarObsAlocacao(${f.id}, '${f.cavalo}', '${safeObs}')" title="Clique para ver ou adicionar um alerta">
                                    ${f.cavalo || 'S/ PLACA'}
                                </span>
                            </div>
                            <div class="flex items-center gap-3">
                                <span class="id-text">${f.numero_frota || 'N/A'}</span>
                                <button onclick="moverParaPatio(${f.id})" class="text-slate-400 hover:text-rose-400 transition-colors bg-black/40 px-3 py-2 rounded-lg shadow-sm" title="Mover veículo de volta ao Pátio"><i class="fas fa-reply"></i></button>
                            </div>
                        </div>
                        ${implementosHtml}
                    </div>

                    ${divObservacao}
                </div>
            `}).join('');
        };

        board.innerHTML = '';

        frentes.forEach(f => {
            const arrFrente = frotasPorFrente[f.id];
            let frenteAtivos = 0; let frenteManutencao = 0;
            arrFrente.forEach(frota => { if(frota.emManutencao) frenteManutencao++; else frenteAtivos++; });
            
            const isPropria = (f.tipo_frente || '').toUpperCase() === 'PROPRIA';
            const bgHeader = isPropria ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)';
            const borderTop = isPropria ? 'border-top: 5px solid #10b981;' : 'border-top: 5px solid rgba(255,255,255,0.1);';
            const tagFrente = isPropria ? `<span style="background: rgba(16,185,129,0.15); color: #34d399; font-size: 0.75rem; padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(16,185,129,0.4); font-weight: 900; letter-spacing: 0.5px;"><i class="fas fa-star mr-1"></i>PRÓPRIA</span>` : '';

            board.innerHTML += `
                <div class="kanban-column" ondragover="allowDropFrota(event)" ondragleave="dragLeaveFrota(event)" ondrop="dropFrota(event, ${f.id})">
                    <div class="kanban-header" style="background: ${bgHeader}; ${borderTop} flex-direction: column; gap: 14px;">
                        <div class="flex justify-between w-full items-start">
                            <div class="flex flex-col gap-2">
                                <h3 class="font-extrabold text-sky-400 uppercase text-lg tracking-wide leading-tight"><i class="fas fa-map-marker-alt mr-2"></i> ${f.frente}</h3>
                                ${tagFrente}
                            </div>
                            <div class="flex flex-col gap-2 items-end">
                                <span class="bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 px-4 py-1.5 rounded-lg text-sm font-black shadow" title="Alocados Operando"><i class="fas fa-truck-loading mr-1"></i> ${frenteAtivos}</span>
                                ${frenteManutencao > 0 ? `<span class="bg-rose-900/40 text-rose-400 border border-rose-500/30 px-4 py-1.5 rounded-lg text-sm font-black shadow" title="Alocados em Manutenção"><i class="fas fa-tools mr-1"></i> ${frenteManutencao}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="kanban-cards">
                        ${arrFrente.length > 0 ? gerarCardsHtml(arrFrente) : '<div class="text-center text-slate-500/50 text-base mt-10 italic font-medium">Arraste os veículos para cá</div>'}
                    </div>
                </div>
            `;
        });

    } catch (err) {
        board.innerHTML = `<div style="width:100%; text-align:center; color:#ef4444; padding:40px; font-size: 1.2rem; font-weight: bold;">Erro ao carregar Frotas.<br>${err.message}</div>`;
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
    if (!frotaId || !destinoId) return;

    try {
        const filialId = window.currentUser ? window.currentUser.filial_id : null;
        if (destinoId === 'disponivel') { 
            await window.supabaseClient.from('alocacao_frotas').delete().eq('frota_id', frotaId);
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Movido para o Pátio!', showConfirmButton: false, timer: 1500, background: '#1e293b', color: '#fff' });
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

window.moverParaPatio = async function(frotaId) {
    try {
        await window.supabaseClient.from('alocacao_frotas').delete().eq('frota_id', frotaId);
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Veículo retornado ao Pátio', showConfirmButton: false, timer: 1500, background: '#1e293b', color: '#fff' });
        window.carregarKanbanAlocacao();
    } catch (e) {
        console.error(e);
    }
};

document.addEventListener('dragend', (e) => {
    if (e.target.classList && e.target.classList.contains('kanban-card')) {
        e.target.classList.remove('dragging');
        document.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('column-drag-over'));
    }
});

// ============================================================================
// 1.1. GERENCIAMENTO DE PÁTIO (MODAL) COM INFORMAÇÕES EXTRAS
// ============================================================================
window.abrirModalPatio = function() {
    const modal = document.getElementById('modal-patio');
    const container = document.getElementById('lista-frotas-patio');
    
    if(!window.frotasPatio || window.frotasPatio.length === 0) {
        container.innerHTML = '<div class="text-slate-400 text-center py-20 text-2xl font-bold">Nenhum veículo disponível no pátio no momento.</div>';
    } else {
        let html = '<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">';
        
        let frentesOptions = '<option value="" disabled selected>Selecione a Frente...</option>';
        window.frentesDisponiveis.forEach(f => {
            frentesOptions += `<option value="${f.id}">${f.frente}</option>`;
        });

        window.frotasPatio.forEach(f => {
            let statusBadge = f.emManutencao 
                ? '<span class="bg-rose-500/20 text-rose-400 px-3 py-1 rounded text-xs uppercase font-bold tracking-wider border border-rose-500/30"><i class="fas fa-tools"></i> Manutenção</span>' 
                : '<span class="bg-sky-500/20 text-sky-400 px-3 py-1 rounded text-xs uppercase font-bold tracking-wider border border-sky-500/30"><i class="fas fa-check"></i> Disponível</span>';

            const mBadges = [];
            if (f.go) mBadges.push(`<span class="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded text-[11px] font-bold"><i class="fas fa-barcode mr-1"></i>${f.go}</span>`);
            if (f.carreta1) mBadges.push(`<span class="bg-slate-700/60 text-slate-200 border border-slate-600 px-2 py-0.5 rounded text-[11px] font-bold">${f.carreta1}</span>`);
            if (f.carreta2) mBadges.push(`<span class="bg-slate-700/60 text-slate-200 border border-slate-600 px-2 py-0.5 rounded text-[11px] font-bold">${f.carreta2}</span>`);
            if (f.carreta3) mBadges.push(`<span class="bg-slate-700/60 text-slate-200 border border-slate-600 px-2 py-0.5 rounded text-[11px] font-bold">${f.carreta3}</span>`);
            let impHTML = mBadges.length > 0 ? `<div class="flex gap-2 mt-3 flex-wrap">${mBadges.join('')}</div>` : '';

            html += `
            <div class="bg-slate-800 p-6 rounded-xl border border-slate-600 flex flex-col gap-5 shadow-lg hover:border-sky-500/50 transition-colors">
                <div class="flex justify-between items-start">
                    <div>
                        <div class="text-2xl font-black text-white tracking-widest">${f.cavalo || 'S/ PLACA'}</div>
                        <div class="text-sm text-slate-400 font-mono mt-1">${f.numero_frota || ''}</div>
                        ${impHTML}
                    </div>
                    ${statusBadge}
                </div>
                <div class="flex gap-3">
                    <select id="select_frente_${f.id}" class="bg-slate-900 text-white border border-slate-600 rounded-lg px-4 py-2 text-base flex-grow outline-none focus:border-sky-500">
                        ${frentesOptions}
                    </select>
                    <button onclick="alocarPeloModal(${f.id})" class="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg text-base font-bold transition-colors shadow">
                        <i class="fas fa-arrow-right"></i> Mover
                    </button>
                </div>
            </div>`;
        });
        html += '</div>';
        container.innerHTML = html;
    }
    
    modal.classList.remove('hidden');
};

window.fecharModalPatio = function() {
    document.getElementById('modal-patio').classList.add('hidden');
};

window.alocarPeloModal = async function(frotaId) {
    const frenteId = document.getElementById(`select_frente_${frotaId}`).value;
    if(!frenteId) {
        Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'Selecione uma frente!', showConfirmButton: false, timer: 2000, background: '#1e293b', color: '#fff' });
        return;
    }
    
    try {
        const filialId = window.currentUser ? window.currentUser.filial_id : null;
        await window.supabaseClient.from('alocacao_frotas').upsert({
            frota_id: frotaId, frente_id: frenteId, filial_id: filialId, updated_at: new Date().toISOString()
        }, { onConflict: 'frota_id' });
        
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Frota alocada com sucesso!', showConfirmButton: false, timer: 1500, background: '#1e293b', color: '#fff' });
        
        window.frotasPatio = window.frotasPatio.filter(f => f.id !== frotaId);
        window.abrirModalPatio(); 
        
        window.carregarKanbanAlocacao();
    } catch (e) {
        Swal.fire('Erro', e.message, 'error');
    }
};

// ============================================================================
// 1.2. EXPORTAÇÃO EXCEL (HTML TABLE METHOD COM BORDAS)
// ============================================================================
window.exportarAlocacaoExcel = async function() {
    try {
        Swal.fire({ title: 'Gerando arquivo...', allowOutsideClick: false, background: '#1e293b', color: '#fff', didOpen: () => { Swal.showLoading(); }});

        const filialId = window.currentUser ? window.currentUser.filial_id : null;
        
        let queryFrentes = window.supabaseClient.from('config_gruas').select('id, frente');
        if (filialId) queryFrentes = queryFrentes.eq('filial_id', filialId);
        const { data: frentes } = await queryFrentes;

        // Trazendo as colunas GO e Carretas
        let queryFrotas = window.supabaseClient.from('frotas_manutencao').select('id, cavalo, numero_frota, go, carreta1, carreta2, carreta3').eq('status', 'Ativo').ilike('categoria', '%TRITREM%');
        if (filialId) queryFrotas = queryFrotas.eq('filial_id', filialId);
        const { data: frotas } = await queryFrotas;

        let queryAlocacoes = window.supabaseClient.from('alocacao_frotas').select('*');
        if (filialId) queryAlocacoes = queryAlocacoes.eq('filial_id', filialId);
        const { data: alocacoes } = await queryAlocacoes;

        let queryOS = window.supabaseClient.from('ordens_servico').select('placa, status').neq('status', 'Concluída').eq('inativa', 0);
        if (filialId) queryOS = queryOS.eq('filial_id', filialId);
        const { data: ordensServico } = await queryOS;

        const mapFrentes = {};
        if (frentes) frentes.forEach(f => mapFrentes[f.id] = f.frente);

        const mapAlocacoes = {};
        if (alocacoes) alocacoes.forEach(a => mapAlocacoes[a.frota_id] = a);

        const emManut = {};
        if (ordensServico) ordensServico.forEach(os => { if (os.placa) emManut[os.placa.toUpperCase()] = true; });

        // Geração da Tabela em formato HTML para exportar como Excel nativo (suporta bordas)
        let tableRows = "";

        frotas.forEach(f => {
            const placa = (f.cavalo || '').toUpperCase();
            const id = f.numero_frota || '';
            const go = f.go || '';
            const c1 = f.carreta1 || '';
            const c2 = f.carreta2 || '';
            const c3 = f.carreta3 || '';

            const aloc = mapAlocacoes[f.id];
            const local = aloc && mapFrentes[aloc.frente_id] ? mapFrentes[aloc.frente_id] : 'PÁTIO (Sem Alocação)';
            const status = emManut[placa] ? 'EM MANUTENÇÃO' : 'OPERANDO';
            
            // Mantém a quebra de linha nativa no excel utilizando CSS
            const obs = aloc && aloc.observacao ? aloc.observacao : '';

            tableRows += `
                <tr>
                    <td>${placa}</td>
                    <td>${id}</td>
                    <td>${go}</td>
                    <td>${c1}</td>
                    <td>${c2}</td>
                    <td>${c3}</td>
                    <td>${local}</td>
                    <td>${status}</td>
                    <td>${obs}</td>
                </tr>
            `;
        });

        // Estrutura HTML/XML que o MS Excel entende perfeitamente e aplica as bordas
        const tableHTML = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8" />
            <style>
                table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
                th { background-color: #1e293b; color: #ffffff; border: 1px solid #000000; padding: 10px; font-weight: bold; text-align: center; }
                td { border: 1px solid #000000; padding: 8px; text-align: left; vertical-align: middle; white-space: normal; }
            </style>
        </head>
        <body>
            <table>
                <thead>
                    <tr>
                        <th style="width: 100px;">Placa</th>
                        <th style="width: 80px;">ID Frota</th>
                        <th style="width: 100px;">GO</th>
                        <th style="width: 120px;">Carreta 1</th>
                        <th style="width: 120px;">Carreta 2</th>
                        <th style="width: 120px;">Carreta 3</th>
                        <th style="width: 200px;">Local Operacional</th>
                        <th style="width: 150px;">Status</th>
                        <th style="width: 450px;">Observação Tática</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </body>
        </html>`;

        const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Relatorio_Alocacao_Frotas_${new Date().toISOString().slice(0,10)}.xls`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        Swal.close();
    } catch (e) {
        Swal.fire('Erro', 'Não foi possível exportar os dados: ' + e.message, 'error');
    }
};

// ============================================================================
// 2. LÓGICA DE RECADOS E ALERTAS INTEGRADOS
// ============================================================================
window.gerenciarObsAlocacao = async function(frotaId, placa, obsAtual) {
    const { data: aloc } = await window.supabaseClient.from('alocacao_frotas').select('id').eq('frota_id', frotaId).single();
    if (!aloc) return Swal.fire({ icon: 'warning', title: 'Atenção', text: 'O veículo precisa estar alocado em uma frente para receber alertas.', background: '#1e293b', color: '#fff' });

    if (!obsAtual || obsAtual === 'undefined' || obsAtual.trim() === '') {
        const { value: novaObs, isConfirmed } = await Swal.fire({
            title: `Novo Alerta para ${placa}`,
            input: 'textarea', 
            inputPlaceholder: 'Ex: Aguardando peça, Fila na balança, Pneu furado...',
            showCancelButton: true, confirmButtonText: '<i class="fas fa-save"></i> Salvar Alerta', confirmButtonColor: '#f59e0b', background: '#1e293b', color: '#fff'
        });
        if (isConfirmed && novaObs) {
            await window.supabaseClient.from('alocacao_frotas').update({ observacao: novaObs }).eq('frota_id', frotaId);
            window.carregarKanbanAlocacao();
        }
    } else {
        const result = await Swal.fire({
            title: `Detalhes do Alerta: ${placa}`,
            html: `<div style="background: rgba(0,0,0,0.3); padding: 25px; border-left: 5px solid #f59e0b; border-radius: 8px; color: #f8fafc; font-weight: 500; font-size: 1.15rem; text-align: left; margin-bottom: 10px; white-space: pre-wrap; word-wrap: break-word; line-height: 1.6; box-shadow: inset 0 2px 4px rgba(0,0,0,0.15);">${obsAtual}</div>`,
            showCloseButton: true,
            width: '800px', 
            showCancelButton: true, showDenyButton: true,
            confirmButtonColor: '#10b981', denyButtonColor: '#3b82f6', cancelButtonColor: '#ef4444',
            confirmButtonText: '<i class="fas fa-check"></i> Concluir', 
            denyButtonText: '<i class="fas fa-pen"></i> Editar', 
            cancelButtonText: '<i class="fas fa-trash"></i> Apagar',
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
            const { value: nObs } = await Swal.fire({ title: 'Editar Alerta', input: 'textarea', inputValue: obsAtual, showCancelButton: true, background: '#1e293b', color: '#fff' });
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
                            <h4 style="font-weight: bold; color: #f8fafc; margin-bottom: 5px; font-size: 1.15rem;">${r.titulo}</h4>
                            <p style="color: #94a3b8; font-size: 1rem; line-height: 1.5; margin-bottom: 12px;">${r.descricao}</p>
                            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px;">
                                <span style="font-size: 0.85rem; color: #64748b; background: rgba(0,0,0,0.2); padding: 4px 10px; border-radius: 6px;"><i class="far fa-clock"></i> ${df}</span>
                                <button onclick="concluirMuralTatico(${r.id})" class="text-emerald-400 hover:bg-emerald-400 hover:text-slate-900 px-4 py-2 rounded font-bold border border-emerald-400 transition-colors text-sm" title="Concluir Tarefa"><i class="fas fa-check mr-1"></i> Concluir</button>
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
                    <div style="background: rgba(30, 41, 59, 0.7); padding: 20px; border-radius: 12px; border-left: 4px solid #10b981; box-shadow: 0 4px 8px rgba(0,0,0,0.15);">
                        <h4 style="text-decoration: line-through; color: #10b981; font-weight: bold; margin-bottom: 12px; font-size: 1.25rem;">${r.titulo}</h4>
                        <p style="color: #cbd5e1; font-size: 1rem; margin-bottom: 18px; line-height: 1.5;">${r.descricao}</p>
                        <div style="font-size: 0.9rem; color: #94a3b8; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 12px;"><i class="fas fa-check-double text-emerald-500 mr-2"></i> Finalizado em: <strong style="color: #fff;">${df}</strong></div>
                    </div>
                `);
            });
        } else {
            cont.innerHTML = '<div style="color:#64748b; font-style:italic; font-size: 1.2rem;">Nenhum histórico recente.</div>';
        }
    } catch(e) {}
};

window.limparHistoricoMuralTatico = async function() {
    const { isConfirmed } = await Swal.fire({
        title: 'Tem certeza?', text: 'Isso apagará permanentemente o histórico de recados e alertas concluídos.',
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