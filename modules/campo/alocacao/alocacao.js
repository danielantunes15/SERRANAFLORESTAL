// ==================== modules/campo/alocacao/alocacao.js ====================

window.carregarAlocacaoCampo = async function() {
    if (typeof window.supabaseClient === 'undefined') return;

    try {
        const pMaquinas = window.supabaseClient.from('maquinas_campo').select('*').order('id');
        const pEquipe = window.supabaseClient.from('equipe_campo').select('*').order('nome');
        
        const [resMaquinas, resEquipe] = await Promise.all([pMaquinas, pEquipe]);
        
        window.maquinasCampo = resMaquinas.data || [];
        window.equipeCampo = resEquipe.data || [];
        
        window.renderizarTabelaAlocacaoCampo();
    } catch (error) {
        console.error("Erro ao carregar dados de alocação:", error);
    }
};

window.renderizarTabelaAlocacaoCampo = function() {
    const container = document.getElementById('alocacaoCampoList');
    if (!container) return;

    if (window.equipeCampo.length === 0) {
        container.innerHTML = `<div style="padding: 20px; color: #94a3b8; text-align: center;">Nenhum operador na equipe.</div>`;
        return;
    }

    let html = '';

    window.maquinasCampo.forEach(maq => {
        const equipeDaFrente = window.equipeCampo.filter(op => String(op.maquina_id) === String(maq.id));
        if (equipeDaFrente.length === 0) return;

        const lideres = equipeDaFrente.filter(op => op.funcao === 'Líder de Campo').sort((a,b) => (a.turno||'').localeCompare(b.turno||''));
        const operadores = equipeDaFrente.filter(op => op.funcao !== 'Líder de Campo').sort((a,b) => (a.maquina_especifica||'').localeCompare(b.maquina_especifica||'') || a.nome.localeCompare(b.nome));
        
        html += `<div style="background: rgba(15, 23, 42, 0.6); border: 1px solid #3b82f6; border-radius: 8px; margin-bottom: 25px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">`;
        html += `<div style="background: #1e293b; padding: 12px 15px; border-bottom: 1px solid #3b82f6; font-weight: 800; color: #38bdf8; font-size: 1.1rem; text-transform: uppercase;">
                    <i class="fas fa-tractor" style="margin-right: 8px;"></i> ${maq.nome || `Frente ${maq.id}`}
                 </div>`;
        
        html += `<table class="data-table-modern" style="width: 100%; text-align: center; border-collapse: collapse; font-size: 0.85rem;">`;
        html += `<thead>
                    <tr style="background: rgba(0,0,0,0.4); color: #94a3b8; font-size: 0.8rem; text-transform: uppercase;">
                        <th style="padding: 12px 10px;">Função</th>
                        <th style="padding: 12px 10px; text-align:left;">Membro</th>
                        <th style="padding: 12px 10px;">Equipe</th>
                        <th style="padding: 12px 10px;">Turno (Horário)</th>
                        <th style="padding: 12px 10px;">Máquina Atribuída (Frota)</th>
                        <th style="padding: 12px 10px;">Ação</th>
                    </tr>
                 </thead><tbody>`;
        
        // Renderizando Líderes
        lideres.forEach(op => {
            html += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 10px; color: #fbbf24; font-weight: bold;"><i class="fas fa-crown"></i> Líder</td>
                <td style="padding: 10px; text-align:left; font-weight: 800; color: #fff;">${op.nome}</td>
                <td style="padding: 10px;"><span style="background: rgba(168,85,247,0.15); border: 1px solid #a855f7; color: #c084fc; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${op.equipe || '-'}</span></td>
                <td style="padding: 10px; color: #34d399; font-weight: bold;">${op.turno || '-'}</td>
                <td style="padding: 10px; color: #94a3b8; font-style: italic;">Supervisão Geral da Frente</td>
                <td style="padding: 10px;"><button class="btn-primary-blue" style="padding: 4px 10px; font-size: 0.75rem;" onclick="window.abrirModalAlocacaoRapida(${op.id})">⚙️ Configurar</button></td>
            </tr>`;
        });

        // Renderizando Operadores
        operadores.forEach(op => {
            let frotaStr = 'S/N';
            if (op.maquina_especifica === 'Máquina 1') frotaStr = maq.numero_frota_1 || 'S/N';
            if (op.maquina_especifica === 'Máquina 2') frotaStr = maq.numero_frota_2 || 'S/N';
            if (op.maquina_especifica === 'Máquina 3') frotaStr = maq.numero_frota_3 || 'S/N';
            
            const exibicaoMaq = op.maquina_especifica ? `${op.maquina_especifica} (Frota ${frotaStr})` : 'Indefinida';

            html += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 10px; color: #cbd5e1; font-weight: bold;">Operador</td>
                <td style="padding: 10px; text-align:left; font-weight: bold; color: #e2e8f0;">${op.nome}</td>
                <td style="padding: 10px;"><span style="background: rgba(168,85,247,0.15); border: 1px solid #a855f7; color: #c084fc; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${op.equipe || '-'}</span></td>
                <td style="padding: 10px; color: #34d399; font-weight: bold;">${op.turno || '-'}</td>
                <td style="padding: 10px; color: #38bdf8; font-weight: bold;">${exibicaoMaq}</td>
                <td style="padding: 10px;"><button class="btn-primary-blue" style="padding: 4px 10px; font-size: 0.75rem;" onclick="window.abrirModalAlocacaoRapida(${op.id})">⚙️ Configurar</button></td>
            </tr>`;
        });
        
        html += `</tbody></table></div>`;
    });

    // Renderiza também o pessoal de RESERVA (sem frente vinculada)
    const reservas = window.equipeCampo.filter(op => !op.maquina_id);
    if (reservas.length > 0) {
        html += `<div style="background: rgba(15, 23, 42, 0.6); border: 1px solid #ef4444; border-radius: 8px; margin-bottom: 25px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">`;
        html += `<div style="background: #1e293b; padding: 12px 15px; border-bottom: 1px solid #ef4444; font-weight: 800; color: #ef4444; font-size: 1.1rem; text-transform: uppercase;">
                    <i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i> Reservas (Sem Frente Definida)
                 </div>`;
        html += `<table class="data-table-modern" style="width: 100%; text-align: center; border-collapse: collapse; font-size: 0.85rem;">`;
        html += `<tbody>`;
        reservas.forEach(op => {
            html += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 10px; color: #cbd5e1; font-weight: bold;">${op.funcao}</td>
                <td style="padding: 10px; text-align:left; font-weight: bold; color: #fff;">${op.nome}</td>
                <td style="padding: 10px; color: #c084fc; font-weight: bold;">${op.equipe || '-'}</td>
                <td style="padding: 10px; color: #34d399; font-weight: bold;">${op.turno || '-'}</td>
                <td style="padding: 10px; color: #ef4444; font-weight: bold;">Reserva</td>
                <td style="padding: 10px;"><button class="btn-primary-blue" style="padding: 4px 10px; font-size: 0.75rem;" onclick="window.abrirModalAlocacaoRapida(${op.id})">⚙️ Configurar</button></td>
            </tr>`;
        });
        html += `</tbody></table></div>`;
    }

    container.innerHTML = html;
};

window.popularFrentesAlocacao = function() {
    const select = document.getElementById('alocFormMaquina');
    if (!select) return;
    let html = '<option value="">Deixar em Reserva</option>';
    window.maquinasCampo.forEach(m => {
        html += `<option value="${m.id}">${m.nome || `Frente ${m.id}`}</option>`;
    });
    select.innerHTML = html;
};

window.abrirModalAlocacaoRapida = function(id) {
    const op = window.equipeCampo.find(x => String(x.id) === String(id));
    if (!op) return;

    window.popularFrentesAlocacao();

    document.getElementById('alocFormId').value = op.id;
    document.getElementById('alocNomeExibicao').innerText = op.nome;
    document.getElementById('alocFormFuncao').value = op.funcao || 'Operador de Máquina';
    document.getElementById('alocFormMaquina').value = op.maquina_id || '';
    document.getElementById('alocFormMaquinaEspecifica').value = op.maquina_especifica || '';
    document.getElementById('alocFormEquipe').value = op.equipe || 'Equipe A';
    document.getElementById('alocFormTurno').value = op.turno || '06:00 - 18:00';

    document.getElementById('modalAlocacaoRapida').classList.add('show');
};

window.fecharModalAlocacaoRapida = function() {
    document.getElementById('modalAlocacaoRapida').classList.remove('show');
};

window.salvarAlocacaoRapida = async function() {
    const id = document.getElementById('alocFormId').value;
    const funcao = document.getElementById('alocFormFuncao').value;
    const maqId = document.getElementById('alocFormMaquina').value;
    const maqEspec = document.getElementById('alocFormMaquinaEspecifica').value;
    const equipe = document.getElementById('alocFormEquipe').value;
    const turno = document.getElementById('alocFormTurno').value;

    const payload = {
        funcao: funcao,
        maquina_id: maqId ? Number(maqId) : null,
        maquina_especifica: maqEspec,
        equipe: equipe,
        turno: turno
    };

    try {
        await window.supabaseClient.from('equipe_campo').update(payload).eq('id', id);
        window.fecharModalAlocacaoRapida();
        
        // Recarrega Alocação e a Escala Semanal dinamicamente 
        await window.carregarAlocacaoCampo();
        if(typeof window.renderizarEscalaCampo === 'function') window.renderizarEscalaCampo();
        
    } catch (error) {
        console.error("Erro ao salvar alocação rápida", error);
        alert("Erro ao salvar configuração.");
    }
};

setTimeout(() => {
    if (typeof window.carregarAlocacaoCampo === 'function') window.carregarAlocacaoCampo();
}, 500);