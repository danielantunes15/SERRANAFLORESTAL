// ==========================================
// js/configuracoes/metas.js
// ==========================================

// Função auxiliar: Converte decimal do banco (ex: 10.5) para o input HTML (ex: "10:30")
function decimalParaHoraStr(decimal) {
    if (decimal === null || decimal === undefined || isNaN(decimal)) return "";
    const h = Math.floor(decimal);
    const m = Math.round((decimal - h) * 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// Função auxiliar: Converte o input HTML (ex: "10:30") para decimal do banco (ex: 10.5)
function horaStrParaDecimal(horaStr) {
    if (!horaStr || typeof horaStr !== 'string') return 0;
    const partes = horaStr.split(':');
    if (partes.length !== 2) return 0;
    return parseInt(partes[0], 10) + (parseInt(partes[1], 10) / 60);
}

async function carregarMetasGlobais() {
    try {
        const { data, error } = await supabaseClient.from('metas_globais').select('*').eq('id', 1).single();
        if (data) {
            document.getElementById('cfg_tamanho_frota').value = data.tamanho_frota || '';
            document.getElementById('cfg_v_prog').value = data.v_prog || '';
            document.getElementById('cfg_vol_prog').value = data.vol_prog || '';
            document.getElementById('cfg_cx_prog').value = data.cx_prog || '';
            document.getElementById('cfg_pbtc').value = data.pbtc_prog || '';
            
            // Converte os decimais do banco de dados para o formato HH:mm exigido pelo HTML
            if(data.meta_ciclo !== undefined) document.getElementById('cfg_meta_ciclo').value = decimalParaHoraStr(data.meta_ciclo);
            if(data.meta_fila_campo !== undefined) document.getElementById('cfg_meta_fila_campo').value = decimalParaHoraStr(data.meta_fila_campo);
            if(data.meta_carga !== undefined) document.getElementById('cfg_meta_carga').value = decimalParaHoraStr(data.meta_carga);
            if(data.meta_fila_fabrica !== undefined) document.getElementById('cfg_meta_fila_fabrica').value = decimalParaHoraStr(data.meta_fila_fabrica);
            
            localStorage.setItem('cfg_metas', JSON.stringify(data));
        }
    } catch(e) { 
        console.log("Lendo metas locais ou erro de conexão...", e); 
    }
}

document.getElementById('btnSalvarMetasGlobais').addEventListener('click', async () => {
    const btn = document.getElementById('btnSalvarMetasGlobais');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

    const payload = {
        id: 1,
        tamanho_frota: parseInt(document.getElementById('cfg_tamanho_frota').value) || 0,
        v_prog: parseFloat(document.getElementById('cfg_v_prog').value) || 0,
        vol_prog: parseFloat(document.getElementById('cfg_vol_prog').value) || 0,
        cx_prog: parseFloat(document.getElementById('cfg_cx_prog').value) || 0,
        pbtc_prog: parseFloat(document.getElementById('cfg_pbtc').value) || 0,
        
        // Converte o texto HH:mm do HTML de volta para número decimal para o banco de dados aceitar
        meta_ciclo: horaStrParaDecimal(document.getElementById('cfg_meta_ciclo').value),
        meta_fila_campo: horaStrParaDecimal(document.getElementById('cfg_meta_fila_campo').value),
        meta_carga: horaStrParaDecimal(document.getElementById('cfg_meta_carga').value),
        meta_fila_fabrica: horaStrParaDecimal(document.getElementById('cfg_meta_fila_fabrica').value)
    };

    try {
        const { error } = await supabaseClient.from('metas_globais').upsert(payload);
        if (error) throw error; // Lança erro caso o Supabase recuse novamente

        localStorage.setItem('cfg_metas', JSON.stringify(payload));
        btn.innerHTML = '<i class="fas fa-check"></i> Salvo!';
    } catch(e) {
        console.error("Erro ao salvar metas:", e);
        btn.innerHTML = 'Erro!';
        alert("Ocorreu um erro ao salvar as metas no banco de dados.");
    }
    
    setTimeout(() => btn.innerHTML = '<i class="fas fa-save"></i> Salvar Metas Base', 2000);
});

// Isso resolve o erro "initMetas is not defined" lá no seu arquivo main.js
window.initMetas = function() {
    carregarMetasGlobais();
};