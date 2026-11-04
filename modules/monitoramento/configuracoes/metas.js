// ==========================================
// js/configuracoes/metas.js - CONFIGURAÇÕES POR FILIAL
// ==========================================

window.carregarMetasGlobais = async function() {
    try {
        const filialId = window.currentUser?.filial_id;

        if (filialId === null) {
            console.warn("Visão Central: Metas não carregadas. Selecione uma filial.");
            limparCamposMetas();
            // Limpa também as metas da tabela
            window.carregarDropdownFrentes();
            window.carregarMetasPeriodo();
            return;
        }

        let query = window.supabaseClient.from('metas_globais').select('*').eq('id', filialId).single();
        const { data, error } = await query;
        if (error && error.code !== 'PGRST116') throw error; 
        
        if (data) {
            if(document.getElementById('cfg_tamanho_frota')) document.getElementById('cfg_tamanho_frota').value = data.tamanho_frota || '';
            if(document.getElementById('cfg_v_prog')) document.getElementById('cfg_v_prog').value = data.v_prog || '';
            if(document.getElementById('cfg_vol_prog')) document.getElementById('cfg_vol_prog').value = data.vol_prog || '';
            if(document.getElementById('cfg_cx_prog')) document.getElementById('cfg_cx_prog').value = data.cx_prog || '';
            if(document.getElementById('cfg_pbtc')) document.getElementById('cfg_pbtc').value = data.pbtc || '';
            if(document.getElementById('cfg_meta_ciclo')) document.getElementById('cfg_meta_ciclo').value = decimalParaTempo(data.meta_ciclo);
            if(document.getElementById('cfg_meta_fila_campo')) document.getElementById('cfg_meta_fila_campo').value = decimalParaTempo(data.meta_fila_campo);
            if(document.getElementById('cfg_meta_carga')) document.getElementById('cfg_meta_carga').value = decimalParaTempo(data.meta_carga);
            if(document.getElementById('cfg_meta_fila_fabrica')) document.getElementById('cfg_meta_fila_fabrica').value = decimalParaTempo(data.meta_fila_fabrica);
            if(document.getElementById('cfg_transp_propria')) document.getElementById('cfg_transp_propria').value = data.transp_propria || 'SERRANALOG';
        } else {
            limparCamposMetas();
        }

        // CARREGA AS NOVAS OPÇÕES
        window.carregarDropdownFrentes();
        window.carregarMetasPeriodo();

    } catch(e) {
        console.error("Erro ao carregar metas da filial:", e);
    }
};

function limparCamposMetas() {
    if(document.getElementById('cfg_tamanho_frota')) document.getElementById('cfg_tamanho_frota').value = '';
    if(document.getElementById('cfg_v_prog')) document.getElementById('cfg_v_prog').value = '';
    if(document.getElementById('cfg_vol_prog')) document.getElementById('cfg_vol_prog').value = '';
    if(document.getElementById('cfg_cx_prog')) document.getElementById('cfg_cx_prog').value = '';
    if(document.getElementById('cfg_pbtc')) document.getElementById('cfg_pbtc').value = '';
    if(document.getElementById('cfg_meta_ciclo')) document.getElementById('cfg_meta_ciclo').value = '';
    if(document.getElementById('cfg_meta_fila_campo')) document.getElementById('cfg_meta_fila_campo').value = '';
    if(document.getElementById('cfg_meta_carga')) document.getElementById('cfg_meta_carga').value = '';
    if(document.getElementById('cfg_meta_fila_fabrica')) document.getElementById('cfg_meta_fila_fabrica').value = '';
    if(document.getElementById('cfg_transp_propria')) document.getElementById('cfg_transp_propria').value = '';
}

window.initMetas = function() {
    const btnSalvar = document.getElementById('btnSalvarMetasGlobais');
    if (btnSalvar) {
        btnSalvar.addEventListener('click', async () => {
            const filialId = window.currentUser?.filial_id;
            
            if (filialId === null) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Atenção',
                    text: 'Selecione uma filial específica no menu superior para definir suas metas. A visão "ADMINISTRADOR" não permite salvar metas.',
                    background: '#1e293b', color: '#f8fafc'
                });
                return;
            }

            const textOriginal = btnSalvar.innerHTML;
            try {
                btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
                
                const payload = {
                    id: filialId,
                    tamanho_frota: document.getElementById('cfg_tamanho_frota').value || null,
                    v_prog: document.getElementById('cfg_v_prog').value || null,
                    vol_prog: document.getElementById('cfg_vol_prog').value || null,
                    cx_prog: document.getElementById('cfg_cx_prog').value || null,
                    pbtc: document.getElementById('cfg_pbtc').value || null,
                    meta_ciclo: tempoParaDecimal(document.getElementById('cfg_meta_ciclo').value),
                    meta_fila_campo: tempoParaDecimal(document.getElementById('cfg_meta_fila_campo').value),
                    meta_carga: tempoParaDecimal(document.getElementById('cfg_meta_carga').value),
                    meta_fila_fabrica: tempoParaDecimal(document.getElementById('cfg_meta_fila_fabrica').value),
                    transp_propria: document.getElementById('cfg_transp_propria') ? document.getElementById('cfg_transp_propria').value.toUpperCase() : 'SERRANALOG'
                };

                const { error } = await window.supabaseClient.from('metas_globais').upsert(payload);
                if (error) throw error;
                
                Swal.fire({
                    icon: 'success',
                    title: 'Sucesso',
                    text: 'Metas da Filial salvas com sucesso!',
                    background: '#1e293b', color: '#f8fafc'
                });
            } catch(e) {
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: 'Erro ao salvar as configurações: ' + e.message,
                    background: '#1e293b', color: '#f8fafc'
                });
            } finally {
                btnSalvar.innerHTML = textOriginal;
            }
        });
    }
};

function tempoParaDecimal(tempo) {
    if (!tempo) return 0;
    const partes = tempo.split(':');
    if (partes.length !== 2) return 0;
    return parseInt(partes[0]) + (parseInt(partes[1]) / 60);
}

function decimalParaTempo(decimal) {
    if (!decimal) return '';
    const horas = Math.floor(decimal);
    const minutos = Math.round((decimal - horas) * 60);
    return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
}

// ==========================================
// MÓDULO: METAS DE VIAGEM POR FRENTE E PERÍODO
// ==========================================

window.toggleFiltroMetas = function() {
    const painel = document.getElementById('painel_filtro_metas');
    if (painel) {
        painel.classList.toggle('hidden');
    }
};

window.carregarDropdownFrentes = async function() {
    const select = document.getElementById('nova_meta_frente');
    if (!select) return;
    
    const filialId = window.currentUser?.filial_id;
    if (filialId === null) {
        select.innerHTML = '<option value="">Selecione uma Filial no topo</option>';
        return;
    }
    
    try {
        const { data, error } = await window.supabaseClient
            .from('config_gruas')
            .select('id, frente')
            .eq('filial_id', filialId)
            .order('frente', { ascending: true });
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            select.innerHTML = '<option value="" disabled selected>-- Selecione a Frente --</option>';
            data.forEach(f => {
                select.innerHTML += `<option value="${f.id}">${f.frente}</option>`;
            });
        } else {
            select.innerHTML = '<option value="">Nenhuma frente cadastrada</option>';
        }
    } catch(e) {
        console.error('Erro ao carregar frentes para o select de metas:', e);
        select.innerHTML = '<option value="">Erro ao carregar frentes</option>';
    }
};

window.limparFiltroMetas = function() {
    const elIni = document.getElementById('filtro_meta_ini');
    const elFim = document.getElementById('filtro_meta_fim');
    if (elIni) elIni.value = '';
    if (elFim) elFim.value = '';
    window.carregarMetasPeriodo(false);
};

window.carregarMetasPeriodo = async function(isFilter = false) {
    const tbody = document.getElementById('lista_metas_periodo');
    if (!tbody) return;
    
    const filialId = window.currentUser?.filial_id;
    if (filialId === null) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-slate-500">Selecione uma filial específica no topo para visualizar/editar metas</td></tr>';
        return;
    }

    try {
        let query = window.supabaseClient
            .from('metas_viagens_periodo')
            .select('*, config_gruas(frente)')
            .eq('filial_id', filialId)
            .order('data_inicial', { ascending: false });
            
        if (isFilter) {
            const dtIni = document.getElementById('filtro_meta_ini')?.value;
            const dtFim = document.getElementById('filtro_meta_fim')?.value;
            if (dtIni) query = query.gte('data_inicial', dtIni);
            if (dtFim) query = query.lte('data_inicial', dtFim);
        } else {
            // Por padrão, traz apenas metas ativas (data_final vazia)
            query = query.is('data_final', null);
        }

        const { data, error } = await query;
        if (error) throw error;

        tbody.innerHTML = '';
        if (data && data.length > 0) {
            data.forEach(item => {
                const dataFimFormatada = item.data_final ? item.data_final.split('-').reverse().join('/') : '<span class="text-emerald-400 font-bold text-[10px]">ATUAL (EM ABERTO)</span>';
                const dataIniFormatada = item.data_inicial.split('-').reverse().join('/');
                const nomeFrente = item.config_gruas ? item.config_gruas.frente : '<span class="text-slate-500 italic">Deletada / Geral</span>';
                
                let botoesAcao = '';
                
                // O botão de Editar e Encerrar SÓ aparecem nas metas abertas
                if (!item.data_final) {
                    botoesAcao = `
                        <button onclick="window.editarMetaPeriodo(${item.id}, ${item.meta_viagens})" class="text-sky-400 hover:text-sky-300 mr-3" title="Editar Valor da Meta">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        <button onclick="window.fecharMetaPeriodo(${item.id})" class="text-amber-400 hover:text-amber-300 mr-3" title="Encerrar Período da Meta">
                            <i class="fas fa-calendar-check"></i> Encerrar
                        </button>
                    `;
                }

                tbody.insertAdjacentHTML('beforeend', `
                    <tr class="hover:bg-slate-800/50 border-b border-slate-800/50">
                        <td class="px-4 py-2 font-semibold text-white">${nomeFrente}</td>
                        <td class="px-4 py-2">${dataIniFormatada}</td>
                        <td class="px-4 py-2">${dataFimFormatada}</td>
                        <td class="px-4 py-2 font-bold text-sky-400">${item.meta_viagens}</td>
                        <td class="px-4 py-2 text-right whitespace-nowrap">
                            ${botoesAcao}
                            <button onclick="window.deletarMetaPeriodo(${item.id})" class="text-rose-500 hover:text-rose-400" title="Excluir Definitivamente">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-slate-500">Nenhuma meta de viagens correspondente encontrada.</td></tr>';
        }
    } catch (err) {
        console.error('Erro ao carregar metas por período:', err);
    }
};

window.salvarMetaPeriodo = async function() {
    const filialId = window.currentUser?.filial_id;
    if (filialId === null) {
        Swal.fire({
            icon: 'warning',
            title: 'Atenção',
            text: 'Você precisa selecionar uma filial específica no menu do topo antes de adicionar metas.',
            background: '#1e293b', color: '#f8fafc'
        });
        return;
    }

    const frenteId = document.getElementById('nova_meta_frente').value;
    const dtIni = document.getElementById('nova_meta_dt_ini').value;
    const dtFim = document.getElementById('nova_meta_dt_fim').value;
    const meta = document.getElementById('nova_meta_viagens').value;

    if (!frenteId) {
        Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Por favor, selecione qual Frente receberá essa meta.', background: '#1e293b', color: '#f8fafc' });
        return;
    }

    if (!dtIni || !meta) {
        Swal.fire({ icon: 'warning', title: 'Atenção', text: 'A Data Inicial e a Meta de Viagens são obrigatórias!', background: '#1e293b', color: '#f8fafc' });
        return;
    }

    try {
        Swal.fire({ title: 'Salvando...', background: '#1e293b', color: '#f8fafc', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

        // Se nenhuma data final for informada, fechar automaticamente a meta "Em aberto" DESTA FRENTE
        if (!dtFim) {
            const { data: abertas } = await window.supabaseClient
                .from('metas_viagens_periodo')
                .select('id')
                .eq('filial_id', filialId)
                .eq('frente_id', frenteId)
                .is('data_final', null);
                
            if (abertas && abertas.length > 0) {
                let dataAnterior = new Date(dtIni);
                dataAnterior.setDate(dataAnterior.getDate() - 1);
                const dataFimAnterior = dataAnterior.toISOString().split('T')[0];
                
                for (let ab of abertas) {
                    await window.supabaseClient
                        .from('metas_viagens_periodo')
                        .update({ data_final: dataFimAnterior })
                        .eq('id', ab.id);
                }
            }
        }

        const payload = {
            filial_id: filialId,
            frente_id: frenteId,
            data_inicial: dtIni,
            data_final: dtFim ? dtFim : null,
            meta_viagens: parseFloat(meta)
        };

        const { error } = await window.supabaseClient.from('metas_viagens_periodo').insert([payload]);
        if (error) throw error;
        
        document.getElementById('nova_meta_dt_ini').value = '';
        document.getElementById('nova_meta_dt_fim').value = '';
        document.getElementById('nova_meta_viagens').value = '';
        
        window.limparFiltroMetas();
        
        Swal.fire({ icon: 'success', title: 'Sucesso!', text: 'Meta de viagens por período salva com sucesso.', background: '#1e293b', color: '#f8fafc', timer: 2000, showConfirmButton: false });
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro ao salvar meta: ' + err.message, background: '#1e293b', color: '#f8fafc' });
    }
};

window.editarMetaPeriodo = async function(id, valorAtual) {
    const { value: novaMeta, isConfirmed } = await Swal.fire({
        title: '<span style="color: #38bdf8;">Editar Meta Ativa</span>',
        html: `
            <div style="text-align: left; color: #cbd5e1; font-size: 0.95rem; margin-bottom: 15px;">
                Atualize o valor de viagens projetadas/dia para esta frente:
            </div>
            <input type="number" step="0.01" id="swal-input-nova-meta" class="w-full bg-slate-900 border border-slate-600 rounded px-4 py-2 text-white outline-none focus:border-sky-500" value="${valorAtual}">
        `,
        icon: 'info',
        showCancelButton: true,
        confirmButtonColor: '#0284c7',
        cancelButtonColor: '#334155',
        confirmButtonText: '<i class="fas fa-save mr-1"></i> Salvar Alteração',
        cancelButtonText: 'Cancelar',
        background: '#1e293b',
        color: '#f8fafc',
        preConfirm: () => {
            const val = document.getElementById('swal-input-nova-meta').value;
            if (!val) {
                Swal.showValidationMessage('A meta não pode ficar em branco!');
                return false;
            }
            return val;
        }
    });

    if (isConfirmed && novaMeta) {
        try {
            Swal.fire({ title: 'Salvando...', background: '#1e293b', color: '#f8fafc', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

            const { error } = await window.supabaseClient
                .from('metas_viagens_periodo')
                .update({ meta_viagens: parseFloat(novaMeta) })
                .eq('id', id);
                
            if (error) throw error;
            
            const isFiltrado = document.getElementById('filtro_meta_ini')?.value || document.getElementById('filtro_meta_fim')?.value;
            window.carregarMetasPeriodo(isFiltrado);
            
            Swal.fire({ icon: 'success', title: 'Atualizada!', text: 'O valor da meta foi atualizado com sucesso.', background: '#1e293b', color: '#f8fafc', timer: 2000, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Erro', text: err.message, background: '#1e293b', color: '#f8fafc' });
        }
    }
};

window.fecharMetaPeriodo = async function(id) {
    const hoje = new Date().toISOString().split('T')[0];
    
    const { value: dtFim, isConfirmed } = await Swal.fire({
        title: '<span style="color: #fbbf24;">Encerrar Meta</span>',
        html: `
            <div style="text-align: left; color: #cbd5e1; font-size: 0.95rem; margin-bottom: 15px;">
                Informe a data final para encerrar a validade desta meta:
            </div>
            <input type="date" id="swal-input-data-fim" class="w-full bg-slate-900 border border-slate-600 rounded px-4 py-2 text-white outline-none focus:border-amber-500" value="${hoje}">
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d97706',
        cancelButtonColor: '#334155',
        confirmButtonText: '<i class="fas fa-calendar-check mr-1"></i> Encerrar',
        cancelButtonText: 'Cancelar',
        background: '#1e293b',
        color: '#f8fafc',
        preConfirm: () => {
            const dataInput = document.getElementById('swal-input-data-fim').value;
            if (!dataInput) {
                Swal.showValidationMessage('A data final é obrigatória!');
                return false;
            }
            return dataInput;
        }
    });

    if (isConfirmed && dtFim) {
        try {
            Swal.fire({ title: 'Encerrando...', background: '#1e293b', color: '#f8fafc', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

            const { error } = await window.supabaseClient
                .from('metas_viagens_periodo')
                .update({ data_final: dtFim })
                .eq('id', id);
                
            if (error) throw error;
            
            const isFiltrado = document.getElementById('filtro_meta_ini').value || document.getElementById('filtro_meta_fim').value;
            window.carregarMetasPeriodo(isFiltrado);
            
            Swal.fire({ icon: 'success', title: 'Encerrada!', text: 'O período da meta foi fechado.', background: '#1e293b', color: '#f8fafc', timer: 2000, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Erro', text: err.message, background: '#1e293b', color: '#f8fafc' });
        }
    }
};

window.deletarMetaPeriodo = async function(id) {
    const { isConfirmed } = await Swal.fire({
        title: 'Excluir Meta?',
        text: 'Tem certeza que deseja excluir o histórico desta meta permanentemente?',
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#334155',
        confirmButtonText: '<i class="fas fa-trash-alt mr-1"></i> Sim, Excluir',
        cancelButtonText: 'Cancelar',
        background: '#1e293b',
        color: '#f8fafc'
    });

    if(isConfirmed) {
        try {
            Swal.fire({ title: 'Excluindo...', background: '#1e293b', color: '#f8fafc', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
            
            const { error } = await window.supabaseClient.from('metas_viagens_periodo').delete().eq('id', id);
            if (error) throw error;
            
            const isFiltrado = document.getElementById('filtro_meta_ini').value || document.getElementById('filtro_meta_fim').value;
            window.carregarMetasPeriodo(isFiltrado);
            
            Swal.fire({ icon: 'success', title: 'Excluído!', text: 'Meta removida com sucesso.', background: '#1e293b', color: '#f8fafc', timer: 2000, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro ao deletar: ' + err.message, background: '#1e293b', color: '#f8fafc' });
        }
    }
};