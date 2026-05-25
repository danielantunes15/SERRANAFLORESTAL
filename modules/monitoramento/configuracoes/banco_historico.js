// ==========================================
// js/configuracoes/banco_historico.js 
// ==========================================

window.toggleMesExclusao = function() {
    const elTipo = document.getElementById('tipoExclusao');
    const elMes = document.getElementById('mesExclusao');
    if (elTipo && elMes) {
        if (elTipo.value.includes('_mes')) {
            elMes.style.display = 'block';
        } else {
            elMes.style.display = 'none';
            elMes.value = ''; 
        }
    }
};

window.carregarHistoricoImportacoes = async function() {
    const tb = document.getElementById('importHistoryBody');
    if (!tb) return;
    tb.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-slate-500"><i class="fas fa-spinner fa-spin mr-2"></i> Atualizando...</td></tr>';
    try {
        let query = window.supabaseClient.from('historico_importacoes').select('*').order('id', { ascending: false }).limit(10);
        if (typeof window.aplicarFiltroFilial === 'function') {
            query = window.aplicarFiltroFilial(query);
        }
        const { data, error } = await query; 
        if (error) throw error;
        tb.innerHTML = '';
        if (!data || data.length === 0) {
            tb.innerHTML = '<tr><td colspan="3" class="text-center py-6 text-slate-500">Nenhum histórico de importação encontrado.</td></tr>';
            return;
        }
        data.forEach(d => {
            let icone = '<i class="fas fa-database text-slate-500"></i>';
            if (String(d.dataBase).toUpperCase().includes('JORNADA')) icone = '<i class="fas fa-user-clock text-amber-500"></i>';
            if (String(d.dataBase).toUpperCase().includes('VIAGEN')) icone = '<i class="fas fa-truck text-sky-500"></i>';

            tb.insertAdjacentHTML('beforeend', `
                <tr class="hover:bg-slate-800/30 transition-colors">
                    <td class="px-6 py-3 font-mono text-slate-400">${d.dataLancamento}</td>
                    <td class="px-6 py-3 font-semibold text-slate-200">${icone} <span class="ml-2">${d.dataBase}</span></td>
                    <td class="px-6 py-3 text-center font-bold text-emerald-400">+ ${d.qtdViagens}</td>
                </tr>
            `);
        });
    } catch (e) {
        tb.innerHTML = '<tr><td colspan="3" class="text-center py-6 text-rose-500">Erro ao carregar histórico.</td></tr>';
    }
};

window.initBancoHistorico = function() {
    const btnAtualizarHistorico = document.getElementById('btnAtualizarHistorico');
    if(btnAtualizarHistorico) btnAtualizarHistorico.addEventListener('click', window.carregarHistoricoImportacoes);

    const btnLimparBanco = document.getElementById('btnLimparBanco');
    const elTipoExclusao = document.getElementById('tipoExclusao');
    const elMesExclusao = document.getElementById('mesExclusao');

    if (btnLimparBanco) {
        btnLimparBanco.addEventListener('click', async () => {
            if (!elTipoExclusao) return;
            
            const tipo = elTipoExclusao.value;
            let mensagemConfirmacao = "";
            let mesTexto = "";
            let anoStr = "", mesStr = "";

            if (tipo.includes('_mes')) {
                if (!elMesExclusao || !elMesExclusao.value) {
                    alert("Por favor, selecione o mês e o ano que deseja excluir na caixinha que apareceu.");
                    return;
                }
                const [yyyy, mm] = elMesExclusao.value.split('-');
                anoStr = yyyy;
                mesStr = mm;
                mesTexto = `${mm}/${yyyy}`;
            }

            if (tipo === 'tudo') mensagemConfirmacao = "ALERTA MÁXIMO: Apagar TODOS os dados de Viagens e Eventos? (As Jornadas serão mantidas)";
            else if (tipo === 'viagens') mensagemConfirmacao = "ATENÇÃO: Apagar TODO o banco de Produção (Viagens)?";
            else if (tipo === 'viagens_mes') mensagemConfirmacao = `ATENÇÃO: Apagar banco de Produção (Viagens) APENAS do mês ${mesTexto}?`;
            else if (tipo === 'eventos') mensagemConfirmacao = "ATENÇÃO: Apagar TODO o banco de Eventos?";

            if(confirm(mensagemConfirmacao)) {
                const conteudoOriginal = btnLimparBanco.innerHTML;
                try {
                    btnLimparBanco.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Apagando...';
                    btnLimparBanco.disabled = true;
                    btnLimparBanco.classList.add('opacity-50', 'cursor-not-allowed');

                    // EXCLUSÃO IMEDIATA E À PROVA DE FALHAS (Sem usar loops)
                    async function apagarMassa(tabela, colunaObrigatoria) {
                        let query = window.supabaseClient.from(tabela).delete().neq(colunaObrigatoria, 'VALOR_IMPOSSIVEL_DE_EXISTIR_123');
                        if (typeof window.aplicarFiltroFilial === 'function') {
                            query = window.aplicarFiltroFilial(query);
                        }
                        const { error } = await query;
                        if (error) throw new Error(`Falha no banco (${tabela}): ${error.message}`);
                    }

                    // EXCLUSÃO RESTRITA POR MÊS
                    async function apagarPorMes(tabela, colunaData, mes, ano) {
                        const likeStringBR = `%/${mes}/${ano}%`; 
                        const likeStringISO = `${ano}-${mes}-%`; 
                        
                        let query1 = window.supabaseClient.from(tabela).delete().like(colunaData, likeStringBR);
                        let query2 = window.supabaseClient.from(tabela).delete().like(colunaData, likeStringISO);
                        
                        if (typeof window.aplicarFiltroFilial === 'function') {
                            query1 = window.aplicarFiltroFilial(query1);
                            query2 = window.aplicarFiltroFilial(query2);
                        }

                        const { error: err1 } = await query1;
                        const { error: err2 } = await query2;
                        
                        if (err1 && err2) throw new Error("Falha ao apagar dados do mês no Supabase.");
                    }

                    // Viagens
                    if (tipo === 'tudo' || tipo === 'viagens') await apagarMassa('historico_viagens', 'movimento');
                    if (tipo === 'viagens_mes') await apagarPorMes('historico_viagens', 'dataDaBaseExcel', mesStr, anoStr);
                    
                    // Eventos
                    if (tipo === 'tudo' || tipo === 'eventos') await apagarMassa('historico_eventos', 'motorista');
                    
                    // Registra a limpeza no Histórico de Importações
                    let logMsg = `[DADOS APAGADOS] - Módulo: ${tipo.toUpperCase()}`;
                    if (tipo.includes('_mes')) logMsg += ` (${mesTexto})`;

                    await window.supabaseClient.from('historico_importacoes').insert([window.injetarFilial({
                        "dataBase": logMsg,
                        "qtdViagens": 0,
                        "dataLancamento": new Date().toLocaleString('pt-PT')
                    })]);

                    alert("Operação concluída com sucesso. Os dados foram apagados da nuvem.");
                    window.carregarHistoricoImportacoes(); 
                } catch (error) {
                    alert("Erro ao apagar os dados: " + error.message);
                } finally {
                    btnLimparBanco.innerHTML = conteudoOriginal;
                    btnLimparBanco.disabled = false;
                    btnLimparBanco.classList.remove('opacity-50', 'cursor-not-allowed');
                }
            }
        });
    }
};