// ==========================================
// js/configuracoes/gruas.js - GERENCIAMENTO DINÂMICO DE FRENTES E GRUAS
// ==========================================

(function() {
    // Função auxiliar para aplicar o filtro de filial nativo da sessão
    function aplicarFiltroLocal(query) {
        if (!window.currentUser) return query; 
        if (window.currentUser.filial_id === null && (window.currentUser.role === 'SuperAdmin' || window.currentUser.role === 'Admin')) {
            return query; 
        }
        if (window.currentUser.filial_id === undefined || window.currentUser.filial_id === null) {
            return query.is('filial_id', null); 
        }
        return query.eq('filial_id', window.currentUser.filial_id);
    }

    // CARREGAR FRENTES E EXIBIR NA TELA
    window.carregarGruas = async function() {
        const container = document.getElementById('container_frentes_dinamico');
        if (!container) return; // Se a tela não carregou, aguarda o MutationObserver

        container.innerHTML = '<div class="col-span-full text-center py-8"><div class="w-8 h-8 border-4 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div><span class="text-xs text-slate-500">Buscando frentes configuradas...</span></div>';

        try {
            let query = window.supabaseClient.from('config_gruas').select('*').order('frente', { ascending: true });
            query = aplicarFiltroLocal(query);

            const { data, error } = await query;
            if (error) throw error;

            // Busca de novo caso a tela tenha atualizado durante o await
            const containerFreshen = document.getElementById('container_frentes_dinamico');
            if (!containerFreshen) return;

            containerFreshen.innerHTML = '';

            if (data && data.length > 0) {
                data.forEach(item => {
                    const id = item.id;
                    const nomeFrente = String(item.frente || '').toUpperCase();
                    const tipoFrente = item.tipo_frente || 'Outros'; 
                    const codigosArr = (item.codigos || '').split(',').map(c => c.trim().toUpperCase()).filter(Boolean);

                    const isPropria = tipoFrente === 'Propria';
                    const cardBorder = isPropria ? 'border-emerald-700/50' : 'border-indigo-700/50';
                    const headerText = isPropria ? 'text-emerald-400' : 'text-indigo-400';
                    const icon = isPropria ? 'fa-star' : 'fa-leaf';
                    const badgeColor = isPropria ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
                    const btnColor = isPropria ? 'bg-emerald-600 hover:bg-emerald-500 focus:border-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500 focus:border-indigo-500';

                    let chipsHtml = codigosArr.map(c => `
                        <div class="${badgeColor} px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5 mt-1 mb-1">
                            <span>${c}</span>
                            <button onclick="window.removerGruaDaFrente('${id}', '${c}', '${nomeFrente}')" class="hover:text-rose-400 transition-colors ml-1 focus:outline-none" title="Remover Grua">
                                <i class="fas fa-times text-[10px]"></i>
                            </button>
                        </div>
                    `).join('');

                    if (chipsHtml === '') {
                        chipsHtml = `<span class="text-[10px] text-slate-500 italic w-full text-center my-2">Nenhuma grua nesta frente</span>`;
                    }

                    const cardHtml = `
                        <div class="bg-slate-800/60 border ${cardBorder} rounded-xl p-5 flex flex-col h-full shadow-inner relative group animate-fade-in">
                            <button onclick="window.deletarFrente('${id}', '${nomeFrente}')" class="absolute top-3 right-3 text-slate-500 hover:text-rose-400 transition-colors text-xs" title="Excluir Frente Inteira">
                                <i class="fas fa-trash"></i>
                            </button>
                            
                            <h4 class="${headerText} font-extrabold uppercase text-xs mb-1 text-center tracking-widest">
                                <i class="fas ${icon} mr-1"></i> ${nomeFrente}
                            </h4>
                            <div class="text-[9px] text-slate-400 text-center border-b border-slate-700/50 pb-3 mb-4 uppercase tracking-widest">${tipoFrente}</div>

                            <div class="flex flex-wrap gap-2 mb-6 flex-1 content-start">
                                ${chipsHtml}
                            </div>
                            
                            <div class="flex mt-auto shadow-lg rounded-lg">
                                <input type="text" id="input_grua_${id}" placeholder="Nova Grua" class="w-full bg-slate-950 border border-slate-600 rounded-l-lg px-3 py-2 text-white outline-none text-xs font-mono uppercase" onkeypress="if(event.key==='Enter') window.adicionarGruaNaFrente('${id}', 'input_grua_${id}')">
                                <button onclick="window.adicionarGruaNaFrente('${id}', 'input_grua_${id}')" class="${btnColor} text-white px-3 py-2 rounded-r-lg font-bold transition-colors"><i class="fas fa-plus"></i></button>
                            </div>
                        </div>
                    `;
                    containerFreshen.insertAdjacentHTML('beforeend', cardHtml);
                });
            } else {
                containerFreshen.innerHTML = `<div class="col-span-full text-center py-6 text-slate-500 italic text-sm">Nenhuma frente cadastrada ainda. Utilize o formulário acima para criar a primeira.</div>`;
            }

        } catch (err) {
            console.error("Erro ao carregar frentes:", err);
            if(container) container.innerHTML = `<div class="col-span-full text-center py-6 text-rose-400 text-sm">Erro ao carregar frentes do banco de dados.</div>`;
        }
    };

    // CRIAR UMA NOVA FRENTE DO ZERO
    window.criarFrente = async function() {
        const inputNome = document.getElementById('nova_frente_nome');
        const selectTipo = document.getElementById('nova_frente_tipo');
        if (!inputNome || !selectTipo) return;

        const nome = inputNome.value.trim().toUpperCase();
        const tipo = selectTipo.value;

        if (!nome) {
            alert('Por favor, digite um nome para a frente.');
            return;
        }

        try {
            // Verifica se a frente já existe
            let query = window.supabaseClient.from('config_gruas').select('*').eq('frente', nome);
            query = aplicarFiltroLocal(query);
            const { data, error: errBusca } = await query;
            if (errBusca) throw errBusca;

            if (data && data.length > 0) {
                alert(`A frente "${nome}" já existe para esta filial!`);
                return;
            }

            const payload = {
                frente: nome,
                tipo_frente: tipo,
                codigos: '',
                filial_id: window.currentUser ? window.currentUser.filial_id : null
            };

            const { error: insErr } = await window.supabaseClient.from('config_gruas').insert([payload]);
            if (insErr) throw insErr;

            inputNome.value = '';
            window.carregarGruas();

        } catch (err) {
            console.error("Erro ao criar frente:", err);
            alert("Erro ao salvar no banco: " + err.message);
        }
    };

    // DELETAR FRENTE INTEIRA
    window.deletarFrente = async function(idRow, nomeFrente) {
        if (!confirm(`CUIDADO!\nDeseja realmente excluir a frente inteira "${nomeFrente}" e todas as suas gruas?`)) return;

        try {
            const { error } = await window.supabaseClient.from('config_gruas').delete().eq('id', idRow);
            if (error) throw error;
            window.carregarGruas();
        } catch (err) {
            console.error("Erro ao deletar frente:", err);
            alert("Erro ao excluir: " + err.message);
        }
    };

    // ADICIONAR UMA GRUA DENTRO DE UMA FRENTE ESPECÍFICA
    window.adicionarGruaNaFrente = async function(idRow, inputId) {
        const input = document.getElementById(inputId);
        if (!input) return;
        
        const codigo = input.value.trim().toUpperCase();
        if (!codigo) return;

        try {
            input.disabled = true;

            const { data, error } = await window.supabaseClient.from('config_gruas').select('*').eq('id', idRow).single();
            if (error) throw error;

            let listaCodigos = data.codigos ? data.codigos.split(',').map(c => c.trim().toUpperCase()).filter(Boolean) : [];
            
            if (listaCodigos.includes(codigo)) {
                alert("Esta grua já está cadastrada nesta frente!");
                input.disabled = false;
                return;
            }
            
            listaCodigos.push(codigo);
            const { error: updErr } = await window.supabaseClient
                .from('config_gruas')
                .update({ codigos: listaCodigos.join(',') })
                .eq('id', idRow);
                
            if (updErr) throw updErr;

            input.value = '';
            input.disabled = false;
            window.carregarGruas();
            
        } catch (err) {
            input.disabled = false;
            console.error("Erro ao adicionar grua:", err);
            alert("Erro do banco de dados ao salvar grua: " + err.message);
        }
    };

    // REMOVER UMA GRUA DE UMA FRENTE ESPECÍFICA
    window.removerGruaDaFrente = async function(idRow, codigo, nomeFrente) {
        if (!confirm(`Deseja remover a grua ${codigo} da frente ${nomeFrente}?`)) return;

        try {
            const { data, error } = await window.supabaseClient.from('config_gruas').select('*').eq('id', idRow).single();
            if (error) throw error;

            let listaCodigos = data.codigos ? data.codigos.split(',').map(c => c.trim().toUpperCase()).filter(Boolean) : [];
            listaCodigos = listaCodigos.filter(c => c !== codigo.toUpperCase());

            const { error: updErr } = await window.supabaseClient
                .from('config_gruas')
                .update({ codigos: listaCodigos.join(',') })
                .eq('id', idRow);
                
            if (updErr) throw updErr;

            window.carregarGruas();
            
        } catch (err) {
            console.error("Erro ao remover grua:", err);
            alert("Erro ao remover grua: " + err.message);
        }
    };

    // =========================================
    // SPA FRIENDLY: MUTATION OBSERVER 
    // Garante que os elementos carreguem mesmo se a página demorar
    // =========================================
    const observer = new MutationObserver(() => {
        const target = document.getElementById('container_frentes_dinamico');
        if (target && !window.frentesRenderizadasNestaSessao) {
            window.frentesRenderizadasNestaSessao = true; 
            window.carregarGruas();
        } else if (!target) {
            window.frentesRenderizadasNestaSessao = false; 
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Roda direto se a página já carregou instantaneamente
    if (document.getElementById('container_frentes_dinamico')) {
        window.frentesRenderizadasNestaSessao = true;
        window.carregarGruas();
    }
})();