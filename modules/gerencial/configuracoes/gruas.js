// ==========================================
// js/configuracoes/gruas.js - GERENCIAMENTO DE GRUAS
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

    // CARREGAR E EXIBIR AS GRUAS NA TELA
    window.carregarGruas = async function() {
        const listaSerrana = document.getElementById('lista_serrana');
        const listaReflorestar = document.getElementById('lista_reflorestar');
        const listaJsl = document.getElementById('lista_jsl');

        if (listaSerrana) listaSerrana.innerHTML = '<span class="text-xs text-slate-500">Carregando...</span>';
        if (listaReflorestar) listaReflorestar.innerHTML = '<span class="text-xs text-slate-500">Carregando...</span>';
        if (listaJsl) listaJsl.innerHTML = '<span class="text-xs text-slate-500">Carregando...</span>';

        try {
            let query = supabaseClient.from('config_gruas').select('*');
            query = aplicarFiltroLocal(query);

            const { data, error } = await query;
            if (error) throw error;

            if (listaSerrana) listaSerrana.innerHTML = '';
            if (listaReflorestar) listaReflorestar.innerHTML = '';
            if (listaJsl) listaJsl.innerHTML = '';

            if (data) {
                data.forEach(item => {
                    const frente = String(item.frente || '').toUpperCase();
                    const codigosStr = item.codigos || '';
                    const codigosArr = codigosStr.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);

                    let targetContainer = null;
                    let badgeClass = '';

                    if (frente === 'SERRANA') {
                        targetContainer = listaSerrana;
                        badgeClass = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5';
                    } else if (frente === 'REFLORESTAR') {
                        targetContainer = listaReflorestar;
                        badgeClass = 'bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5';
                    } else if (frente === 'JSL') {
                        targetContainer = listaJsl;
                        badgeClass = 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5';
                    }

                    if (targetContainer) {
                        codigosArr.forEach(code => {
                            const html = `
                                <div class="${badgeClass}">
                                    <span>${code}</span>
                                    <button onclick="window.removerGrua('${item.frente}', '${code}')" class="hover:text-rose-400 transition-colors ml-1 focus:outline-none" title="Remover Grua">
                                        <i class="fas fa-times text-[10px]"></i>
                                    </button>
                                </div>
                            `;
                            targetContainer.insertAdjacentHTML('beforeend', html);
                        });
                    }
                });
            }

            // Fallback amigável caso não existam códigos salvos
            if (listaSerrana && !listaSerrana.innerHTML) listaSerrana.innerHTML = '<span class="text-xs text-slate-500 italic">Nenhuma grua mapeada</span>';
            if (listaReflorestar && !listaReflorestar.innerHTML) listaReflorestar.innerHTML = '<span class="text-xs text-slate-500 italic">Nenhuma grua mapeada</span>';
            if (listaJsl && !listaJsl.innerHTML) listaJsl.innerHTML = '<span class="text-xs text-slate-500 italic">Nenhuma grua mapeada</span>';

        } catch (err) {
            console.error("Erro ao carregar gruas:", err);
        }
    };

    // ADICIONAR UMA NOVA GRUA MANTENDO O ISOLAMENTO DE FILIAL
    window.adicionarGrua = async function(frente, inputId) {
        const input = document.getElementById(inputId);
        if (!input) return;
        const codigo = input.value.trim().toUpperCase();
        if (!codigo) return;

        try {
            let query = supabaseClient.from('config_gruas').select('*').eq('frente', frente);
            query = aplicarFiltroLocal(query);

            const { data, error } = await query;
            if (error) throw error;

            if (data && data.length > 0) {
                // A frente já existe para esta filial, adiciona o novo código à lista separada por vírgula
                const registro = data[0];
                let listaCodigos = registro.codigos ? registro.codigos.split(',').map(c => c.trim().toUpperCase()).filter(Boolean) : [];
                
                if (listaCodigos.includes(codigo)) {
                    alert("Esta grua já está cadastrada nesta frente!");
                    return;
                }
                
                listaCodigos.push(codigo);
                const { error: updErr } = await supabaseClient
                    .from('config_gruas')
                    .update({ codigos: listaCodigos.join(',') })
                    .eq('id', registro.id);
                    
                if (updErr) throw updErr;
            } else {
                // Registro inédito desta frente para a filial logada
                const payload = {
                    frente: frente,
                    codigos: codigo,
                    filial_id: window.currentUser ? window.currentUser.filial_id : null
                };
                const { error: insErr } = await supabaseClient.from('config_gruas').insert([payload]);
                if (insErr) throw insErr;
            }

            input.value = '';
            window.carregarGruas();
        } catch (err) {
            console.error("Erro ao adicionar grua:", err);
            alert("Erro ao salvar grua: " + err.message);
        }
    };

    // REMOVER UMA GRUA DA LISTA
    window.removerGrua = async function(frente, codigo) {
        if (!confirm(`Deseja realmente remover a grua ${codigo} da frente ${frente}?`)) return;

        try {
            let query = supabaseClient.from('config_gruas').select('*').eq('frente', frente);
            query = aplicarFiltroLocal(query);

            const { data, error } = await query;
            if (error) throw error;

            if (data && data.length > 0) {
                const registro = data[0];
                let listaCodigos = registro.codigos ? registro.codigos.split(',').map(c => c.trim().toUpperCase()).filter(Boolean) : [];
                
                listaCodigos = listaCodigos.filter(c => c !== codigo.toUpperCase());

                if (listaCodigos.length > 0) {
                    const { error: updErr } = await supabaseClient
                        .from('config_gruas')
                        .update({ codigos: listaCodigos.join(',') })
                        .eq('id', registro.id);
                    if (updErr) throw updErr;
                } else {
                    // Se não sobrou nenhuma grua na string, remove a linha para manter a tabela limpa
                    const { error: delErr } = await supabaseClient
                        .from('config_gruas')
                        .delete()
                        .eq('id', registro.id);
                    if (delErr) throw delErr;
                }

                window.carregarGruas();
            }
        } catch (err) {
            console.error("Erro ao remover grua:", err);
            alert("Erro ao remover grua: " + err.message);
        }
    };

    // Execuções automáticas para carregar os chips na inicialização da view (SPA friendly)
    document.addEventListener('DOMContentLoaded', window.carregarGruas);
    if (document.getElementById('lista_serrana')) {
        window.carregarGruas();
    }
})();