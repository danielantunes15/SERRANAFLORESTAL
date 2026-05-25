window.initCadastroIndicadores = async function() {
    await carregarSelectControladores();
    await cadCarregarFrentes();
    await cadCarregarOcorrencias();
};

async function carregarSelectControladores() {
    const select = document.getElementById('cadControladorAtual');
    const listaDiv = document.getElementById('lista-controladores-db');
    
    // Carrega do DB os cadastrados
    const controladores = await db.getControladoresTrafego();
    
    // Popula a lista visual (CRUD)
    let htmlLista = '';
    if(controladores.length === 0) {
        htmlLista = '<div style="color:#94a3b8; font-size: 0.9rem; text-align: center; padding: 20px 0;">Nenhum controlador cadastrado.</div>';
        select.innerHTML = '<option value="">Sem controladores cadastrados</option>';
    } else {
        let options = '<option value="" disabled selected>Selecione...</option>';
        controladores.forEach(c => {
            options += `<option value="${c.nome}">${c.nome}</option>`;
            htmlLista += `
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 12px 15px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
                    <span style="color: #fff; font-weight: bold;"><i class="fas fa-user" style="color: #94a3b8; margin-right: 8px;"></i> ${c.nome}</span>
                    <button onclick="removerControladorDB('${c.id}')" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 5px;"><i class="fas fa-trash"></i></button>
                </div>
            `;
        });
        select.innerHTML = options;
    }
    listaDiv.innerHTML = htmlLista;

    // Pega o atual do dashboard_status
    let queryCtrl = supabaseClient.from('dashboard_status').select('id, controlador').limit(1);
    if (typeof window.aplicarFiltroFilial === 'function') queryCtrl = window.aplicarFiltroFilial(queryCtrl);
    const { data } = await queryCtrl;
    if(data && data.length > 0 && data[0].controlador) {
        select.value = data[0].controlador;
    }
}

window.addControladorDB = async function() {
    const nomeInput = document.getElementById('novoControladorNome');
    const nome = nomeInput.value.trim().toUpperCase();
    if(!nome) return;
    
    await db.addControladorTrafego({ nome: nome });
    nomeInput.value = '';
    await carregarSelectControladores();
}

window.removerControladorDB = async function(id) {
    if(confirm('Tem certeza que deseja remover este controlador?')) {
        await db.deleteControladorTrafego(id);
        await carregarSelectControladores();
    }
}

window.salvarControladorDashAtual = async function() {
    const nome = document.getElementById('cadControladorAtual').value;
    if(!nome) { alert('Selecione um controlador.'); return; }

    let queryCtrl = supabaseClient.from('dashboard_status').select('id').limit(1);
    if (typeof window.aplicarFiltroFilial === 'function') queryCtrl = window.aplicarFiltroFilial(queryCtrl);
    const { data } = await queryCtrl;
    
    if(data && data.length > 0) {
        await supabaseClient.from('dashboard_status').update({ controlador: nome }).eq('id', data[0].id);
    } else {
        let novoStatus = { controlador: nome };
        if (typeof window.injetarFilial === 'function') novoStatus = window.injetarFilial(novoStatus);
        await supabaseClient.from('dashboard_status').insert([novoStatus]);
    }
    alert('Controlador aplicado com sucesso ao Painel da TV!');
}

// ======================= FRENTES DE TRABALHO =======================
window.cadCarregarFrentes = async function() {
    let queryFrentes = supabaseClient.from('frentes_trabalho').select('*').eq('status', 'Ativa');
    if (typeof window.aplicarFiltroFilial === 'function') queryFrentes = window.aplicarFiltroFilial(queryFrentes);
    const { data } = await queryFrentes;
    
    const div = document.getElementById('cad-lista-frentes');
    if(data && data.length > 0) {
        let html = '';
        data.forEach(f => {
            html += `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34,197,94,0.3); padding: 12px 15px; border-radius: 6px;">
                <span style="color: #22c55e; font-weight: bold;"><i class="fas fa-tractor" style="margin-right: 8px;"></i> ${f.nome}</span>
                <button onclick="cadRemoverFrente('${f.id}')" title="Encerrar Frente" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 5px;"><i class="fas fa-trash"></i></button>
            </div>`;
        });
        div.innerHTML = html;
    } else {
        div.innerHTML = '<div style="color:#94a3b8; text-align: center; padding: 20px 0;">Nenhuma frente de trabalho ativa.</div>';
    }
}

window.cadAddFrente = async function() {
    const inputFrente = document.getElementById('cadNovaFrente');
    const nome = inputFrente.value.trim();
    if(!nome) return;
    
    let nova = { nome: nome };
    if (typeof window.injetarFilial === 'function') nova = window.injetarFilial(nova);
    
    await supabaseClient.from('frentes_trabalho').insert([nova]);
    inputFrente.value = '';
    cadCarregarFrentes();
}

window.cadRemoverFrente = async function(id) {
    if(confirm('Tem certeza que deseja encerrar esta Frente de Trabalho?')) {
        await supabaseClient.from('frentes_trabalho').update({ status: 'Inativa' }).eq('id', id);
        cadCarregarFrentes();
    }
}

// ======================= OCORRÊNCIAS =======================
window.cadCarregarOcorrencias = async function() {
    let query = supabaseClient.from('dashboard_ocorrencias').select('*').eq('status', 'Pendente');
    if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
    const { data } = await query;
    
    const div = document.getElementById('cad-lista-ocorrencias');
    if(data && data.length > 0) {
        let html = '';
        data.forEach(o => {
            html += `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239,68,68,0.3); padding: 12px 15px; border-radius: 6px;">
                <span style="color: #fca5a5;"><strong>${o.tipo}:</strong> ${o.descricao}</span>
                <button onclick="cadResolverOcorrencia('${o.id}')" title="Marcar como Resolvido" style="background: none; border: none; color: #22c55e; cursor: pointer; padding: 5px;"><i class="fas fa-check-circle fa-lg"></i></button>
            </div>`;
        });
        div.innerHTML = html;
    } else {
        div.innerHTML = '<div style="color:#94a3b8; grid-column: span 2; text-align: center; padding: 20px 0;">Nenhuma ocorrência pendente no painel.</div>';
    }
}

window.cadAddOcorrencia = async function() {
    const tipo = document.getElementById('cadNovaOcTipo').value;
    const descInput = document.getElementById('cadNovaOcDesc');
    const desc = descInput.value.trim();
    if(!desc) return;
    
    let nova = { tipo: tipo, descricao: desc };
    if (typeof window.injetarFilial === 'function') nova = window.injetarFilial(nova);
    
    await supabaseClient.from('dashboard_ocorrencias').insert([nova]);
    descInput.value = '';
    cadCarregarOcorrencias();
}

window.cadResolverOcorrencia = async function(id) {
    if(confirm('Marcar esta ocorrência como resolvida?')) {
        await supabaseClient.from('dashboard_ocorrencias').update({ status: 'Resolvido' }).eq('id', id);
        cadCarregarOcorrencias();
    }
}