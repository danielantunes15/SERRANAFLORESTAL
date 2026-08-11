window.initCadastroIndicadores = async function() {
    await carregarListaControladoresDB();
    await carregarListaTurnosDB();
    await carregarStatusPainel();
    await cadCarregarFrentes();
};

// ======================= CONTROLADORES =======================
async function carregarListaControladoresDB() {
    const select = document.getElementById('cadControladorAtual');
    const listaDiv = document.getElementById('lista-controladores-db');
    
    const controladores = await db.getControladoresTrafego();
    
    let htmlLista = '';
    if(controladores.length === 0) {
        htmlLista = '<div style="color:#94a3b8; font-size: 0.9rem; text-align: center; padding: 20px 0;">Nenhum controlador cadastrado.</div>';
        select.innerHTML = '<option value="">Sem controladores cadastrados</option>';
    } else {
        let options = '<option value="" disabled>Selecione...</option>';
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
}

window.addControladorDB = async function() {
    const nomeInput = document.getElementById('novoControladorNome');
    const nome = nomeInput.value.trim().toUpperCase();
    if(!nome) return;
    
    await db.addControladorTrafego({ nome: nome });
    nomeInput.value = '';
    await carregarListaControladoresDB();
}

window.removerControladorDB = async function(id) {
    if(confirm('Tem certeza que deseja remover este controlador?')) {
        await db.deleteControladorTrafego(id);
        await carregarListaControladoresDB();
    }
}

window.salvarControladorDashAtual = async function() {
    const nome = document.getElementById('cadControladorAtual').value;
    if(!nome) { alert('Selecione um controlador.'); return; }

    let query = supabaseClient.from('dashboard_status').select('id').limit(1);
    if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
    const { data } = await query;
    
    if(data && data.length > 0) {
        await supabaseClient.from('dashboard_status').update({ controlador: nome }).eq('id', data[0].id);
    } else {
        let novoStatus = { controlador: nome };
        if (typeof window.injetarFilial === 'function') novoStatus = window.injetarFilial(novoStatus);
        await supabaseClient.from('dashboard_status').insert([novoStatus]);
    }
    alert('Controlador aplicado com sucesso ao Painel da TV!');
}

async function carregarStatusPainel() {
    let queryCtrl = supabaseClient.from('dashboard_status').select('id, controlador').limit(1);
    if (typeof window.aplicarFiltroFilial === 'function') queryCtrl = window.aplicarFiltroFilial(queryCtrl);
    const { data } = await queryCtrl;
    
    if(data && data.length > 0 && data[0].controlador) {
        document.getElementById('cadControladorAtual').value = data[0].controlador;
    }
}

// ======================= TURNOS OPERACIONAIS =======================
async function carregarListaTurnosDB() {
    const listaDiv = document.getElementById('lista-turnos-db');
    const turnos = await db.getTurnosOperacionais();
    
    let htmlLista = '';
    if(turnos.length === 0) {
        htmlLista = '<div style="color:#94a3b8; font-size: 0.9rem; grid-column: span 2; text-align: center; padding: 20px 0;">Nenhum turno cadastrado para esta filial. O sistema usará o padrão 06:00 as 18:00.</div>';
    } else {
        turnos.forEach(t => {
            let icon = t.tipo === 'DIA' ? '<i class="fas fa-sun text-orange"></i>' : '<i class="fas fa-moon text-blue"></i>';
            const hrIni = t.hora_inicio ? t.hora_inicio.substring(0, 5) : '--:--';
            const hrFim = t.hora_fim ? t.hora_fim.substring(0, 5) : '--:--';

            htmlLista += `
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 12px 15px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="display: flex; flex-direction: column;">
                        <span style="color: #fff; font-weight: bold; font-size: 1.05rem;">${icon} &nbsp; ${t.nome}</span>
                        <span style="color: #94a3b8; font-size: 0.85rem; margin-top: 4px;"><i class="fas fa-clock"></i> ${hrIni} às ${hrFim}</span>
                    </div>
                    <button onclick="removerTurnoDB('${t.id}')" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 8px;"><i class="fas fa-trash fa-lg"></i></button>
                </div>
            `;
        });
    }
    listaDiv.innerHTML = htmlLista;
}

window.addTurnoDB = async function() {
    const nome = document.getElementById('novoTurnoNome').value.trim().toUpperCase();
    const inicio = document.getElementById('novoTurnoInicio').value;
    const fim = document.getElementById('novoTurnoFim').value;
    const tipo = document.getElementById('novoTurnoTipo').value;
    
    if(!nome || !inicio || !fim) {
        alert("Por favor, preencha o nome e os horários do turno.");
        return;
    }
    
    await db.addTurnoOperacional({ 
        nome: nome, 
        hora_inicio: inicio, 
        hora_fim: fim, 
        tipo: tipo 
    });
    
    document.getElementById('novoTurnoNome').value = '';
    document.getElementById('novoTurnoInicio').value = '';
    document.getElementById('novoTurnoFim').value = '';
    
    await carregarListaTurnosDB();
}

window.removerTurnoDB = async function(id) {
    if(confirm('Tem certeza que deseja remover este turno?')) {
        await db.deleteTurnoOperacional(id);
        await carregarListaTurnosDB();
    }
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