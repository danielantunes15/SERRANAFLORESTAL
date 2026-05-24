// ==========================================
// js/configuracoes/metas.js - CONFIGURAÇÕES POR FILIAL
// ==========================================

window.carregarMetasGlobais = async function() {
    try {
        // Recupera a filial logada (se null, é SuperAdmin na visão central)
        const filialId = window.currentUser?.filial_id;

        if (filialId === null) {
            console.warn("Visão Central: Metas não carregadas. Selecione uma filial.");
            limparCamposMetas();
            return;
        }

        // Agora usamos o 'id' equivalente ao ID da filial para separar os registros
        let query = window.supabaseClient.from('metas_globais').select('*').eq('id', filialId).single();
        const { data, error } = await query;
        if (error && error.code !== 'PGRST116') throw error; // Ignora erro se não existir ainda
        
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
            limparCamposMetas(); // Limpa caso a filial ainda não tenha metas definidas
        }
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
                alert('⚠️ Selecione uma filial específica no menu superior para definir suas metas. A visão "ADMINISTRADOR" não permite salvar metas.');
                return;
            }

            const textOriginal = btnSalvar.innerHTML;
            try {
                btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
                
                const payload = {
                    id: filialId, // O ID passa a ser o código da filial para separar no banco
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
                alert('Metas da Filial salvas com sucesso!');
            } catch(e) {
                alert('Erro ao salvar as configurações: ' + e.message);
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