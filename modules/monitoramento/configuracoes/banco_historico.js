// ==========================================
// js/configuracoes/banco_historico.js 
// ==========================================

window.toggleMesExclusao = function() {
    const elTipo = document.getElementById('tipoExclusao');
    const elMes = document.getElementById('mesExclusao');
    const elDia = document.getElementById('diaExclusao');
    
    if (elTipo) {
        if (elMes) elMes.style.display = (elTipo.value === 'viagens_mes') ? 'block' : 'none';
        if (elDia) elDia.style.display = (elTipo.value === 'viagens_dia') ? 'block' : 'none';
    }
};

window.initBancoHistorico = function() {
    const btnLimparBanco = document.getElementById('btnLimparBanco');
    const elTipoExclusao = document.getElementById('tipoExclusao');
    const elMesExclusao = document.getElementById('mesExclusao');
    const elDiaExclusao = document.getElementById('diaExclusao');

    if (btnLimparBanco) {
        const novoBtn = btnLimparBanco.cloneNode(true);
        btnLimparBanco.parentNode.replaceChild(novoBtn, btnLimparBanco);
        
        novoBtn.addEventListener('click', async () => {
            if (!elTipoExclusao) return;

            const user = window.currentUser || {};
            const filial_id = user.filial_id ? String(user.filial_id) : null;
            const isGlobalAdmin = (user.role === 'SuperAdmin' || user.role === 'Admin');

            let nomeFilial = "DESCONHECIDA";
            if (filial_id === '1' || filial_id === '7') nomeFilial = "SUZANO - MUCURI";
            else if (filial_id === '5') nomeFilial = "BRACELL - LENÇÓIS PAULISTA";
            else if (filial_id === '6') nomeFilial = "VERACEL - EUNÁPOLIS";
            else if (filial_id === null && isGlobalAdmin) nomeFilial = "TODAS AS FILIAIS (MODO GLOBAL)";

            let infoFilialHTML = `
                <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); padding: 12px; border-radius: 8px; margin-bottom: 15px; text-align: center;">
                    <span style="color: #fca5a5; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px;">Alvo da Exclusão:</span>
                    <strong style="color: #fff; font-size: 1.1rem; letter-spacing: 0.5px;">${nomeFilial}</strong>
                </div>
            `;
            
            const tipo = elTipoExclusao.value;
            let mensagemConfirmacao = "";
            let termoBusca = "";

            if (tipo === 'viagens_mes') {
                if (!elMesExclusao || !elMesExclusao.value) {
                    Swal.fire({icon: 'warning', title: 'Atenção', text: 'Selecione o mês na caixinha.', background: '#1e293b', color: '#f8fafc'});
                    return;
                }
                const [yyyy, mm] = elMesExclusao.value.split('-');
                termoBusca = `${mm}/${yyyy}`; // Ex: 09/2026
                mensagemConfirmacao = `ATENÇÃO: Apagar banco de Produção desta operação referente APENAS ao mês <b>${termoBusca}</b>?`;
            } else if (tipo === 'viagens_dia') {
                if (!elDiaExclusao || !elDiaExclusao.value) {
                    Swal.fire({icon: 'warning', title: 'Atenção', text: 'Selecione o dia na caixinha.', background: '#1e293b', color: '#f8fafc'});
                    return;
                }
                const [y, m, d] = elDiaExclusao.value.split('-');
                termoBusca = `${d}/${m}/${y}`; // Ex: 12/09/2026
                mensagemConfirmacao = `ATENÇÃO: Apagar banco de Produção desta operação referente APENAS ao dia <b>${termoBusca}</b>?`;
            } else if (tipo === 'tudo') {
                mensagemConfirmacao = "ALERTA MÁXIMO: Você tem certeza que deseja apagar TODOS os dados de Viagens desta operação?";
            } else if (tipo === 'viagens') {
                mensagemConfirmacao = "ATENÇÃO: Apagar TODO o banco de Produção (Viagens) desta operação?";
            }

            const { isConfirmed } = await Swal.fire({
                title: '<span style="color: #ef4444;">Zona de Risco</span>',
                html: `<div style="text-align: left;">${infoFilialHTML}<p style="color: #cbd5e1; font-size: 0.95rem; font-weight: 500; text-align: center;">${mensagemConfirmacao}</p></div>`,
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
                const txtOriginal = novoBtn.innerHTML;
                let idsParaApagar = [];
                
                try {
                    novoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Apagando...';
                    novoBtn.disabled = true;
                    novoBtn.classList.add('opacity-50', 'cursor-not-allowed');

                    Swal.fire({
                        title: 'Apagando dados...',
                        text: 'Localizando registros e processando a exclusão...',
                        background: '#1e293b',
                        color: '#f8fafc',
                        allowOutsideClick: false,
                        didOpen: () => { Swal.showLoading(); }
                    });

                    let tabelaViagens = 'historico_viagens'; 
                    let colunaDataRef = 'dataDaBaseExcel'; 

                    const numericFilialId = filial_id ? parseInt(filial_id) : null;
                    if (numericFilialId === 5) {
                        tabelaViagens = 'historico_viagens_sp'; 
                        colunaDataRef = 'data_saida_patio'; 
                    }

                    const aplicarTravaFilial = (queryObj) => {
                        if (numericFilialId !== null && !isGlobalAdmin) {
                            return queryObj.eq('filial_id', numericFilialId);
                        }
                        return queryObj;
                    };

                    // =========================================================
                    // NOVO SISTEMA DE BUSCA PAGINADA E NORMALIZADOR DE DATA
                    // =========================================================
                    let fetchMore = true;
                    let from = 0;
                    const step = 1000;

                    const normalizeDateKey = (dStr) => {
                        if (!dStr) return '';
                        let str = String(dStr).trim();
                        
                        // Converte DD/MM/YY para DD/MM/YYYY
                        const parts = str.split('/');
                        if (parts.length === 3) {
                            let y = parts[2];
                            if (y.length === 2) y = '20' + y;
                            return `${parts[0].padStart(2,'0')}/${parts[1].padStart(2,'0')}/${y}`;
                        }
                        
                        // Converte YYYY-MM-DD para DD/MM/YYYY
                        const isoParts = str.split('-');
                        if(isoParts.length === 3 && isoParts[0].length === 4) {
                            return `${isoParts[2].padStart(2,'0')}/${isoParts[1].padStart(2,'0')}/${isoParts[0]}`;
                        }
                        
                        return str;
                    };

                    while (fetchMore) {
                        let query = window.supabaseClient.from(tabelaViagens).select(`id, ${colunaDataRef}`).range(from, from + step - 1);
                        query = aplicarTravaFilial(query);
                        
                        const { data, error } = await query;
                        if (error) throw new Error(error.message);

                        if (data && data.length > 0) {
                            data.forEach(row => {
                                if (tipo === 'tudo' || tipo === 'viagens') {
                                    // Se for apagar tudo, pega todos os IDs da filial
                                    idsParaApagar.push(row.id);
                                } else {
                                    // Se for dia/mês, checa a data (normalizando formato /26 para /2026)
                                    const dataNormalizada = normalizeDateKey(row[colunaDataRef]);
                                    if (dataNormalizada.includes(termoBusca)) {
                                        idsParaApagar.push(row.id);
                                    }
                                }
                            });
                            from += step;
                            if (data.length < step) fetchMore = false;
                        } else {
                            fetchMore = false;
                        }
                    }

                    if (idsParaApagar.length === 0) {
                        if (tipo === 'tudo' || tipo === 'viagens') throw new Error("A base já está vazia para esta filial.");
                        else throw new Error(`Nenhum dado encontrado para a data/mês: ${termoBusca}`);
                    }

                    // =========================================================
                    // EXCLUSÃO EM LOTE (Evita limites da API)
                    // =========================================================
                    const batchSize = 500;
                    for (let i = 0; i < idsParaApagar.length; i += batchSize) {
                        const lote = idsParaApagar.slice(i, i + batchSize);
                        const { error: errDel } = await window.supabaseClient.from(tabelaViagens).delete().in('id', lote);
                        if (errDel) throw new Error(errDel.message);
                    }

                    // =========================================================
                    // INSERE O LOG NO BANCO APÓS O SUCESSO DA EXCLUSÃO
                    // =========================================================
                    const now = new Date();
                    const pad = (n) => String(n).padStart(2, '0');
                    const dataLocalExata = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

                    let logAcao = "Exclusão";
                    if (tipo === 'viagens_mes') logAcao = `Exclusão Viagens (${termoBusca})`;
                    else if (tipo === 'viagens_dia') logAcao = `Exclusão Viagens (${termoBusca})`;
                    else if (tipo === 'tudo') logAcao = "Exclusão Geral (TUDO)";
                    else if (tipo === 'viagens') logAcao = "Exclusão Viagens (TUDO)";

                    const payloadLog = {
                        dataLancamento: dataLocalExata,
                        dataBase: logAcao,
                        qtdViagens: idsParaApagar.length,
                        usuario: user.nome_completo || user.username || 'Sistema',
                        filial_id: filial_id
                    };
                    await window.supabaseClient.from('historico_importacoes').insert([payloadLog]);

                    // Atualiza a tabela de histórico na tela
                    if(typeof window.carregarHistoricoImportacoes === 'function') window.carregarHistoricoImportacoes();

                    Swal.fire({
                        title: 'Sucesso!',
                        text: `${idsParaApagar.length} registros foram apagados com sucesso!`,
                        icon: 'success',
                        background: '#1e293b',
                        color: '#f8fafc'
                    });

                } catch (err) {
                    console.error("Erro na exclusão:", err);
                    Swal.fire({
                        title: 'Erro!',
                        text: err.message,
                        icon: 'error',
                        background: '#1e293b',
                        color: '#f8fafc'
                    });
                } finally {
                    novoBtn.innerHTML = txtOriginal;
                    novoBtn.disabled = false;
                    novoBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                }
            }
        });
    }
};

window.carregarHistoricoImportacoes = async function() {
    const tb = document.getElementById('importHistoryBody');
    if (!tb) return;
    tb.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-slate-500"><i class="fas fa-spinner fa-spin mr-2"></i> Atualizando...</td></tr>';
    
    try {
        let query = window.supabaseClient.from('historico_importacoes').select('*');
        
        const user = window.currentUser || {};
        const filialIdAtual = (user.filial_id !== null && user.filial_id !== undefined) ? String(user.filial_id) : null;
        const isGlobalAdmin = (user.role === 'SuperAdmin' || user.role === 'Admin');

        if (filialIdAtual !== null && !isGlobalAdmin) {
            query = query.eq('filial_id', filialIdAtual);
        }

        query = query.order('id', { ascending: false }).limit(10);
        
        const { data, error } = await query; 
        if (error) throw error;
        
        tb.innerHTML = '';
        
        if (!data || data.length === 0) {
            tb.innerHTML = '<tr><td colspan="4" class="text-center py-6 text-slate-500">Nenhum log recente encontrado para sua filial.</td></tr>';
            return;
        }

        data.forEach(r => {
            const dtLancamento = r.dataLancamento || r.data_importacao || 'Registro Recente';
            const qtdViagens = r.qtdViagens || r.registros_adicionados || 0;
            const baseInfo = r.dataBase || r.periodo || 'Importação Geral';
            
            let nomeFilialStr = 'Filial Desconhecida';
            const fId = r.filial_id ? String(r.filial_id) : '1';
            if (fId === '1' || fId === '7') nomeFilialStr = 'Suzano - Mucuri';
            else if (fId === '5') nomeFilialStr = 'Bracell - Lençóis Paulista';
            else if (fId === '6') nomeFilialStr = 'Veracel - Eunápolis';

            const usuarioNome = r.usuario || user.nome_completo || user.username || 'Operador Torre';
            
            const isExclusao = baseInfo.toUpperCase().includes('EXCLUSÃO');
            const corQtd = isExclusao ? 'text-rose-400' : 'text-emerald-400';
            const sinalQtd = isExclusao ? '-' : '+';
            const moduloIcon = isExclusao ? '<i class="fas fa-trash-alt text-rose-500"></i>' : '<i class="fas fa-truck text-sky-400"></i>';
            const textoQuantidade = (isExclusao && qtdViagens === 0) ? 'Limpeza Total' : `${sinalQtd} ${qtdViagens} registros`;

            const tr = `
                <tr class="hover:bg-slate-800/50 transition-colors border-b border-slate-800/50 text-xs">
                    <td class="px-6 py-3 font-mono text-slate-300">${dtLancamento}</td>
                    <td class="px-6 py-3 font-bold text-white flex items-center gap-2">${moduloIcon} ${usuarioNome}</td>
                    <td class="px-6 py-3 text-slate-300 font-medium">${nomeFilialStr} <br><span class="text-[10px] text-slate-500">${baseInfo}</span></td>
                    <td class="px-6 py-3 text-center font-mono font-bold ${corQtd}">${textoQuantidade}</td>
                </tr>
            `;
            tb.insertAdjacentHTML('beforeend', tr);
        });
    } catch(e) {
        console.error("Erro ao carregar histórico:", e);
        tb.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-rose-500">Erro ao carregar histórico de logs.</td></tr>';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const btnRefresh = document.getElementById('btnAtualizarHistorico');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', window.carregarHistoricoImportacoes);
    }
});