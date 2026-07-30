// ==========================================
// js/configuracoes/banco_historico.js 
// ==========================================

window.toggleMesExclusao = function() {
    const elTipo = document.getElementById('tipoExclusao');
    const elMes = document.getElementById('mesExclusao');
    const elDia = document.getElementById('diaExclusao');
    
    if (elTipo) {
        // Exibe ou oculta a caixinha do mês
        if (elMes) {
            if (elTipo.value === 'viagens_mes') {
                elMes.style.display = 'block';
            } else {
                elMes.style.display = 'none';
                elMes.value = ''; 
            }
        }
        // Exibe ou oculta a caixinha do Dia Específico
        if (elDia) {
            if (elTipo.value === 'viagens_dia') {
                elDia.style.display = 'block';
            } else {
                elDia.style.display = 'none';
                elDia.value = ''; 
            }
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
    const elDiaExclusao = document.getElementById('diaExclusao');

    if (btnLimparBanco) {
        btnLimparBanco.addEventListener('click', async () => {
            if (!elTipoExclusao) return;
            
            const tipo = elTipoExclusao.value;
            let mensagemConfirmacao = "";
            let mesTexto = "";
            let anoStr = "", mesStr = "";
            let diaStrISO = "", diaStrBR = "";

            if (tipo === 'viagens_mes') {
                if (!elMesExclusao || !elMesExclusao.value) {
                    Swal.fire({icon: 'warning', title: 'Atenção', text: 'Selecione o mês na caixinha.', background: '#1e293b', color: '#f8fafc'});
                    return;
                }
                const [yyyy, mm] = elMesExclusao.value.split('-');
                anoStr = yyyy;
                mesStr = mm;
                mesTexto = `${mm}/${yyyy}`;
            } else if (tipo === 'viagens_dia') {
                if (!elDiaExclusao || !elDiaExclusao.value) {
                    Swal.fire({icon: 'warning', title: 'Atenção', text: 'Selecione o dia na caixinha.', background: '#1e293b', color: '#f8fafc'});
                    return;
                }
                diaStrISO = elDiaExclusao.value;
                const [y, m, d] = diaStrISO.split('-');
                diaStrBR = `${d}/${m}/${y}`;
            }

            if (tipo === 'tudo') mensagemConfirmacao = "ALERTA MÁXIMO: Apagar TODOS os dados de Viagens e Eventos? (As Jornadas serão mantidas)";
            else if (tipo === 'viagens') mensagemConfirmacao = "ATENÇÃO: Apagar TODO o banco de Produção (Viagens)?";
            else if (tipo === 'viagens_mes') mensagemConfirmacao = `ATENÇÃO: Apagar banco de Produção (Viagens) APENAS do mês ${mesTexto}?`;
            else if (tipo === 'viagens_dia') mensagemConfirmacao = `ATENÇÃO: Apagar banco de Produção (Viagens) APENAS do dia ${diaStrBR}?`;
            else if (tipo === 'eventos') mensagemConfirmacao = "ATENÇÃO: Apagar TODO o banco de Eventos?";

            const { isConfirmed } = await Swal.fire({
                title: '<span style="color: #ef4444;">Zona de Risco</span>',
                html: `
                    <div style="text-align: left;">
                        <p style="color: #cbd5e1; font-size: 0.95rem; margin-bottom: 10px; font-weight: 500;">
                            ${mensagemConfirmacao}
                        </p>
                    </div>
                `,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#334155',
                confirmButtonText: '<i class="fas fa-trash-alt"></i> Confirmar Exclusão',
                cancelButtonText: 'Cancelar',
                background: '#1e293b',
                color: '#f8fafc'
            });

            if (isConfirmed) {
                const conteudoOriginal = btnLimparBanco.innerHTML;
                try {
                    btnLimparBanco.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Apagando...';
                    btnLimparBanco.disabled = true;
                    btnLimparBanco.classList.add('opacity-50', 'cursor-not-allowed');

                    Swal.fire({
                        title: 'Apagando dados...',
                        text: 'Aguarde a exclusão ser finalizada na nuvem.',
                        background: '#1e293b',
                        color: '#f8fafc',
                        allowOutsideClick: false,
                        didOpen: () => {
                            Swal.showLoading();
                        }
                    });

                    async function apagarMassa(tabela, colunaObrigatoria) {
                        let query = window.supabaseClient.from(tabela).delete().neq(colunaObrigatoria, 'VALOR_IMPOSSIVEL_DE_EXISTIR_123');
                        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
                        const { error } = await query;
                        if (error) throw new Error(`Falha no banco (${tabela}): ${error.message}`);
                    }

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

                    async function apagarPorDia(tabela, colunaData, dataBR, dataISO) {
                        let query1 = window.supabaseClient.from(tabela).delete().eq(colunaData, dataBR);
                        let query2 = window.supabaseClient.from(tabela).delete().eq(colunaData, dataISO);
                        if (typeof window.aplicarFiltroFilial === 'function') {
                            query1 = window.aplicarFiltroFilial(query1);
                            query2 = window.aplicarFiltroFilial(query2);
                        }
                        const { error: err1 } = await query1;
                        const { error: err2 } = await query2;
                        if (err1 && err2) throw new Error(`Falha ao apagar dados do dia ${dataBR}.`);
                    }

                    let logMsg = `[DADOS APAGADOS] - Módulo: ${tipo.toUpperCase()}`;

                    if (tipo === 'viagens_dia') {
                        await apagarPorDia('historico_viagens', 'dataDaBaseExcel', diaStrBR, diaStrISO);
                        logMsg += ` (${diaStrBR})`;
                    } else if (tipo === 'viagens_mes') {
                        await apagarPorMes('historico_viagens', 'dataDaBaseExcel', mesStr, anoStr);
                        logMsg += ` (${mesTexto})`;
                    } else if (tipo === 'tudo' || tipo === 'viagens') {
                        await apagarMassa('historico_viagens', 'movimento');
                        if (tipo === 'tudo') await apagarMassa('historico_eventos', 'motorista');
                    } else if (tipo === 'eventos') {
                        await apagarMassa('historico_eventos', 'motorista');
                    }

                    await window.supabaseClient.from('historico_importacoes').insert([window.injetarFilial({
                        "dataBase": logMsg,
                        "qtdViagens": 0,
                        "dataLancamento": new Date().toLocaleString('pt-PT')
                    })]);

                    Swal.fire({
                        icon: 'success',
                        title: 'Sucesso!',
                        text: 'Os dados selecionados foram apagados da nuvem.',
                        background: '#1e293b',
                        color: '#f8fafc',
                        confirmButtonColor: '#10b981'
                    });

                    window.carregarHistoricoImportacoes(); 
                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Erro de Exclusão',
                        text: error.message,
                        background: '#1e293b',
                        color: '#f8fafc'
                    });
                } finally {
                    btnLimparBanco.innerHTML = conteudoOriginal;
                    btnLimparBanco.disabled = false;
                    btnLimparBanco.classList.remove('opacity-50', 'cursor-not-allowed');
                }
            }
        });
    }
};