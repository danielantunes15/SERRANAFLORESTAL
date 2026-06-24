// ==================== modules/campo/troca_turno/troca_turno.js ====================

window.historicoTrocaCampo = [];

window.carregarTrocasTurnoCampo = async function() {
    if (typeof window.supabaseClient === 'undefined') return;

    try {
        const { data, error } = await window.supabaseClient
            .from('troca_turno_campo')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        window.historicoTrocaCampo = data || [];
        window.renderizarTrocaTurnoCampo();
    } catch (e) {
        console.error("Erro ao carregar histórico de trocas do campo:", e);
    }
};

window.renderizarTrocaTurnoCampo = function() {
    const container = document.getElementById('trocaTurnoCampoContainer');
    if (!container) return;

    const inputData = document.getElementById('filtroDataTrocaCampo');
    if (inputData && !inputData.value) {
        const hoje = new Date();
        inputData.value = hoje.toISOString().split('T')[0];
    }
    
    const dataFiltro = inputData ? inputData.value : '';
    const frenteFiltro = document.getElementById('filtroFrenteTroca') ? document.getElementById('filtroFrenteTroca').value : 'todos';

    const registrosFiltrados = window.historicoTrocaCampo.filter(r => {
        const bateData = r.data === dataFiltro;
        const bateFrente = frenteFiltro === 'todos' || r.frente === frenteFiltro;
        return bateData && bateFrente;
    });

    if (registrosFiltrados.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px; color:#94a3b8; background:rgba(30,41,59,0.2); border-radius:8px; border:1px dashed rgba(255,255,255,0.1);">
                <i class="fas fa-exchange-alt" style="font-size:2.5rem; margin-bottom:10px; color:#475569;"></i>
                <p>Nenhuma passagem de turno registrada para o Campo nesta data e filtro.</p>
            </div>`;
        return;
    }

    let html = '';
    registrosFiltrados.forEach(r => {
        html += `
        <div style="background: #1e293b; border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.2); overflow: hidden;">
            <div style="background: #0f172a; padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(59,130,246,0.2);">
                <div style="display: flex; gap: 15px; align-items: center;">
                    <span style="color: #38bdf8; font-weight: 800; font-size: 0.95rem;"><i class="fas fa-map-signs"></i> ${r.frente}</span>
                    <span style="color: #f59e0b; font-weight: 800; font-size: 0.85rem;"><i class="fas fa-tractor"></i> ${r.conjunto_maquina || 'Geral'}</span>
                </div>
                <span style="color: #94a3b8; font-size: 0.8rem;"><i class="far fa-clock"></i> ${r.hora_log || '-'}</span>
            </div>
            <div style="padding: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div style="background: rgba(0,0,0,0.15); padding: 10px; border-radius: 6px;">
                    <strong style="color: #f87171; font-size: 0.75rem; text-transform: uppercase; display:block; margin-bottom:2px;">Líder Saindo</strong>
                    <span style="color: #fff; font-weight: 600;">${r.lider_saindo}</span>
                </div>
                <div style="background: rgba(0,0,0,0.15); padding: 10px; border-radius: 6px;">
                    <strong style="color: #4ade80; font-size: 0.75rem; text-transform: uppercase; display:block; margin-bottom:2px;">Líder Entrando</strong>
                    <span style="color: #fff; font-weight: 600;">${r.lider_entrando}</span>
                </div>
                <div style="grid-column: span 2; background: rgba(0,0,0,0.1); padding: 12px; border-radius: 6px; border-left: 3px solid #3b82f6;">
                    <strong style="color: #93c5fd; font-size: 0.8rem; display:block; margin-bottom:5px;"><i class="fas fa-microchip"></i> Status Operacional do Conjunto:</strong>
                    <p style="color: #e2e8f0; margin: 0; white-space: pre-wrap; font-size: 0.85rem; line-height: 1.4;">${r.status_maquinas}</p>
                </div>
                ${r.observacoes ? `
                <div style="grid-column: span 2; background: rgba(245,158,11,0.05); padding: 10px; border-radius: 6px; border-left: 3px solid #f59e0b;">
                    <strong style="color: #fcd34d; font-size: 0.8rem; display:block; margin-bottom:4px;"><i class="fas fa-exclamation-triangle"></i> Observações Técnicas:</strong>
                    <p style="color: #cbd5e1; margin: 0; font-size: 0.85rem;">${r.observacoes}</p>
                </div>` : ''}
            </div>
        </div>`;
    });

    container.innerHTML = html;
};

// Formata 2 Frotas para o Dropdown da Troca de Turno
window.popularSelectConjuntoTroca = function() {
    const select = document.getElementById('novaTrocaConjunto');
    if (!select) return;

    let html = '<option value="Visão Geral (Sem Máquina Específica)">Visão Geral (Sem Máquina Específica)</option>';
    const listaMaquinas = window.maquinasCampo || [];
    listaMaquinas.forEach(m => {
        let frota1 = m.numero_frota_1 || m.numero_frota || m.ficha || '';
        let frota2 = m.numero_frota_2 || '';
        let desc = `Conjunto ${m.id}`;
        
        if (frota1 && frota2) desc += ` [Frotas: ${frota1} e ${frota2}]`;
        else if (frota1) desc += ` [Frota: ${frota1}]`;
        
        html += `<option value="${desc}">${desc}</option>`;
    });
    select.innerHTML = html;
};

window.abrirModalNovaTrocaCampo = function() {
    window.popularSelectConjuntoTroca();
    
    const modal = document.getElementById('modalNovaTrocaCampo');
    if (modal) modal.classList.add('show');
};

window.fecharModalNovaTrocaCampo = function() {
    const modal = document.getElementById('modalNovaTrocaCampo');
    if (modal) modal.classList.remove('show');
    
    document.getElementById('novaTrocaLiderSaindo').value = '';
    document.getElementById('novaTrocaLiderEntrando').value = '';
    document.getElementById('novaTrocaStatusMaquinas').value = '';
    document.getElementById('novaTrocaObservacoes').value = '';
};

window.salvarTrocaTurnoCampo = async function() {
    const frente = document.getElementById('novaTrocaFrente').value;
    const conjunto = document.getElementById('novaTrocaConjunto').value;
    const liderSaindo = document.getElementById('novaTrocaLiderSaindo').value.trim();
    const liderEntrando = document.getElementById('novaTrocaLiderEntrando').value.trim();
    const statusMaquinas = document.getElementById('novaTrocaStatusMaquinas').value.trim();
    const observacoes = document.getElementById('novaTrocaObservacoes').value.trim();
    const dataFiltro = document.getElementById('filtroDataTrocaCampo').value;

    if (!liderSaindo || !liderEntrando || !statusMaquinas) {
        alert("Preencha os líderes e o status operacional do conjunto.");
        return;
    }

    const agora = new Date();
    const horaLog = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const payload = {
        data: dataFiltro,
        hora_log: horaLog,
        frente: frente,
        conjunto_maquina: conjunto,
        lider_saindo: liderSaindo,
        lider_entrando: liderEntrando,
        status_maquinas: statusMaquinas,
        observacoes: observacoes
    };

    try {
        await window.supabaseClient.from('troca_turno_campo').insert([payload]);
        window.fecharModalNovaTrocaCampo();
        await window.carregarTrocasTurnoCampo(); 
    } catch(e) { 
        console.error("Erro ao registrar passagem de turno:", e); 
        alert("Falha de conexão com o banco de dados.");
    }
};

setTimeout(() => {
    if (typeof window.carregarTrocasTurnoCampo === 'function') window.carregarTrocasTurnoCampo();
}, 500);