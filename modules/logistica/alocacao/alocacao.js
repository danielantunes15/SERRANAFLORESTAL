// ==================== MÓDULO: ALOCAÇÃO GERAL E HISTÓRICO ====================

window.dadosHistoricoMemoria = []; // Cache para a pesquisa da aba de histórico

// ============================================================================
// CONTROLE DE ABAS
// ============================================================================
window.alternarAbaAlocacao = function(aba) {
    document.getElementById('btnAbaAlocacao').classList.remove('active');
    document.getElementById('btnAbaHistorico').classList.remove('active');
    document.getElementById('abaAlocacaoAtual').style.display = 'none';
    document.getElementById('abaHistoricoAlocacao').style.display = 'none';

    if (aba === 'atual') {
        document.getElementById('btnAbaAlocacao').classList.add('active');
        document.getElementById('abaAlocacaoAtual').style.display = 'block';
        window.renderizarAlocacao();
    } else {
        document.getElementById('btnAbaHistorico').classList.add('active');
        document.getElementById('abaHistoricoAlocacao').style.display = 'block';
        window.renderizarHistoricoEscala();
    }
};

// ============================================================================
// RENDERIZAÇÃO DA ALOCAÇÃO ATUAL
// ============================================================================
window.renderizarIndicadorTrocaTurno = function() {
    const container = document.getElementById('indicadorTrocaTurno');
    if (!container) return;

    let shiftCounts = {};
    let totalCaminhoesAtivos = 0;

    conjuntos.forEach(conj => {
        let numCaminhoes = conj.caminhoes ? conj.caminhoes.length : 0;
        if (numCaminhoes === 0) return;

        let mots = motoristas.filter(m => String(m.conjuntoId) === String(conj.id));
        let turnosConjunto = new Set();
        
        let motDia = mots.find(m => ['A','B','C'].includes(window.getEq(m)));
        if (motDia && motDia.turno && motDia.turno !== '-') {
            let cMatch = window.getCiclos().find(c => c.dbValue === motDia.turno);
            turnosConjunto.add(cMatch ? cMatch.labelDia : motDia.turno);
        }
        
        let motNoite = mots.find(m => ['D','E','F'].includes(window.getEq(m)));
        if (motNoite && motNoite.turno && motNoite.turno !== '-') {
            let cMatch = window.getCiclos().find(c => c.dbValue === motNoite.turno);
            turnosConjunto.add(cMatch ? cMatch.labelNoite : motNoite.turno);
        }

        turnosConjunto.forEach(t => {
            shiftCounts[t] = (shiftCounts[t] || 0) + numCaminhoes;
        });

        if (turnosConjunto.size > 0) {
            totalCaminhoesAtivos += numCaminhoes;
        }
    });

    if (Object.keys(shiftCounts).length === 0) {
        container.innerHTML = '<div style="color:#94a3b8; font-weight:bold; padding: 10px;">Nenhum turno configurado ou conjunto cadastrado.</div>';
        return;
    }

    const sortedTurnos = Object.keys(shiftCounts).sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || 0, 10);
        const numB = parseInt(b.match(/\d+/)?.[0] || 0, 10);
        return numA - numB;
    });

    let turnosDia = [];
    let turnosNoite = [];

    sortedTurnos.forEach(turnoStr => {
        let horaInicioStr = turnoStr.substring(0, 5);
        let hora = parseInt(horaInicioStr.split(':')[0], 10);
        
        let obj = { label: horaInicioStr, count: shiftCounts[turnoStr] };
        
        if (hora >= 0 && hora <= 11) {
            turnosDia.push(obj);
        } else {
            turnosNoite.push(obj);
        }
    });

    const buildCards = (lista) => {
        let html = '<div style="display: flex; gap: 15px; flex-wrap: wrap; width: 100%; margin-bottom: 15px;">';
        lista.forEach(item => {
            html += `
            <div style="background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(59, 130, 246, 0.5); border-radius: 8px; padding: 15px 20px; flex: 1; min-width: 120px; max-width: 180px; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
                <div style="font-size: 0.8rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; margin-bottom: 5px;">
                    <i class="fas fa-play-circle" style="color: #3b82f6; margin-right: 4px;"></i> Início
                </div>
                <div style="font-size: 1.8rem; color: #fff; font-weight: 900; margin-bottom: 12px; letter-spacing: 1px;">${item.label}</div>
                <div style="background: rgba(59, 130, 246, 0.15); border-radius: 6px; padding: 8px;">
                    <span style="font-size: 1.8rem; color: #60a5fa; font-weight: 900; line-height: 1;">${item.count}</span>
                    <span style="font-size: 0.8rem; color: #93c5fd; font-weight: bold; text-transform: uppercase; margin-left: 3px;">Cavalos</span>
                </div>
            </div>
            `;
        });
        html += '</div>';
        return html;
    };

    let finalHtml = '<div style="display: flex; flex-direction: column; width: 100%;">';
    
    if (turnosDia.length > 0) {
        let totalDia = turnosDia.reduce((sum, item) => sum + item.count, 0);
        finalHtml += `<div style="width: 100%; color: #fbbf24; font-weight: 800; font-size: 0.95rem; margin-bottom: 10px; margin-top: 5px; text-transform: uppercase; letter-spacing: 1px; display: flex; justify-content: space-between; align-items: center;">
            <span><i class="fas fa-sun" style="margin-right: 5px;"></i> Início Turno do Dia</span>
            <span style="font-size: 0.75rem; color: #64748b; font-weight: bold; text-transform: none; letter-spacing: normal;">Frotas: ${totalDia} Cavalos</span>
        </div>`;
        finalHtml += buildCards(turnosDia);
    }
    
    if (turnosNoite.length > 0) {
        let totalNoite = turnosNoite.reduce((sum, item) => sum + item.count, 0);
        finalHtml += `<div style="width: 100%; color: #93c5fd; font-weight: 800; font-size: 0.95rem; margin-bottom: 10px; margin-top: 10px; text-transform: uppercase; letter-spacing: 1px; display: flex; justify-content: space-between; align-items: center;">
            <span><i class="fas fa-moon" style="margin-right: 5px;"></i> Início Turno da Noite</span>
            <span style="font-size: 0.75rem; color: #64748b; font-weight: bold; text-transform: none; letter-spacing: normal;">Frotas: ${totalNoite} Cavalos</span>
        </div>`;
        finalHtml += buildCards(turnosNoite);
    }

    if (totalCaminhoesAtivos > 0) {
        finalHtml += `<div style="width: 100%; text-align: right; margin-top: 5px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 10px;">
            <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 700;">Total da Frota Operante no Conjunto: <span style="color: #cbd5e1;">${totalCaminhoesAtivos} Cavalos Únicos</span></span>
        </div>`;
    }

    finalHtml += '</div>';
    container.innerHTML = finalHtml;
};

window.renderizarAlocacao = function() {
    if(typeof window.renderizarIndicadorTrocaTurno === 'function') window.renderizarIndicadorTrocaTurno();
    
    const tbody = document.getElementById('alocacaoList');
    if (!tbody) return;
    
    if (motoristas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Nenhum motorista registrado</td></tr>'; 
        return;
    }

    const getTurnoConjunto = (conjId) => {
        if (!conjId) return "ZZZ";
        const mots = motoristas.filter(m => String(m.conjuntoId) === String(conjId));
        const motDia = mots.find(m => m.turno && m.turno !== '-' && ['A','B','C'].includes(window.getEq(m)));
        if (motDia) return motDia.turno;
        const motComTurno = mots.find(m => m.turno && m.turno !== '-');
        return motComTurno ? motComTurno.turno : "ZZY"; 
    };

    const motoristasOrdenados = [...motoristas].sort((a, b) => {
        const conjA = a.conjuntoId ? Number(a.conjuntoId) : 999999;
        const conjB = b.conjuntoId ? Number(b.conjuntoId) : 999999;
        
        if (conjA !== conjB) return conjA - conjB;
        
        const turnoA = getTurnoConjunto(a.conjuntoId);
        const turnoB = getTurnoConjunto(b.conjuntoId);
        const horaA = turnoA.match(/\d+/) ? parseInt(turnoA.match(/\d+/)[0], 10) : 9999;
        const horaB = turnoB.match(/\d+/) ? parseInt(turnoB.match(/\d+/)[0], 10) : 9999;
        
        if (horaA !== horaB) return horaA - horaB;
        
        const eqA = window.getEq(a);
        const eqB = window.getEq(b);
        if (window.pesoEquipe(eqA) !== window.pesoEquipe(eqB)) return window.pesoEquipe(eqA) - window.pesoEquipe(eqB);
        
        return a.nome.localeCompare(b.nome);
    });

    let html = '';
    let lastConjunto = null;
    
    motoristasOrdenados.forEach(m => {
        const isBlocked = m.masterDrive === 'Não' || m.destra === 'Não' || m.status === 'Férias' || m.status === 'Afastado';
        const currentConjunto = m.conjuntoId ? Number(m.conjuntoId) : 'sem_conjunto';
        let eq = window.getEq(m);

        if (currentConjunto !== lastConjunto) {
            const dbValOriginal = getTurnoConjunto(m.conjuntoId);
            let badgeTexto = "S/ Horário";
            if (dbValOriginal !== 'ZZZ' && dbValOriginal !== 'ZZY') {
                let cl = window.getCiclos().find(c => c.dbValue === dbValOriginal);
                badgeTexto = cl ? `Iniciando às ${cl.base}` : dbValOriginal;
            }

            const tituloConjunto = m.conjuntoId ? `CONJUNTO ${String(m.conjuntoId).padStart(2, '0')}` : `RESERVAS / SEM CONJUNTO`;
            const btnReset = m.conjuntoId ? `<button onclick="window.resetarCicloConjunto(${m.conjuntoId})" style="background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; color: #ef4444; padding: 4px 12px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; font-weight: bold; transition: 0.2s;">ZERAR CICLO</button>` : '';
            
            let selectTurnoGlobal = '';
            if (m.conjuntoId) {
                let opcoesTurno = window.getCiclos().map(c => `<option value="${c.dbValue}">Iniciando às ${c.base}</option>`).join('');
                selectTurnoGlobal = `
                    <select class="select-turno-global" data-conjunto="${m.conjuntoId}" style="margin-left: 15px; background: rgba(15, 23, 42, 0.9); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.5); border-radius: 6px; padding: 4px 8px; font-weight: bold; cursor: pointer; font-size: 0.8rem; outline: none;">
                        <option value="">🔄 Mudar Horário da Equipe...</option>
                        ${opcoesTurno}
                    </select>
                `;
            }

            let badgeHorario = '';
            if (dbValOriginal !== 'ZZZ' && dbValOriginal !== 'ZZY') {
                badgeHorario = `<span style="background: #3b82f6; color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; margin-right: 12px;"><i class="far fa-clock"></i> ${badgeTexto}</span>`;
            }

            html += `
                <tr style="background-color: #0f172a; border-top: 2px solid #3b82f6;">
                    <td colspan="5" style="text-align: left; padding: 12px 15px; font-weight: 800; color: #fff; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 1px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; align-items: center;">
                                ${badgeHorario}
                                ${tituloConjunto}
                                ${selectTurnoGlobal}
                            </div>
                            <div>${btnReset}</div>
                        </div>
                    </td>
                </tr>
            `;
            lastConjunto = currentConjunto;
        }
        
        let posicaoTag = '';
        if (eq === 'A' || eq === 'D') posicaoTag = '<span style="display:inline-block; width: 75px; font-size: 0.65rem; background: #2563eb; color: #fff; padding: 3px; border-radius: 4px; text-align: center; font-weight: bold; margin-right: 8px;">FROTA 1</span>';
        else if (eq === 'B' || eq === 'E') posicaoTag = '<span style="display:inline-block; width: 75px; font-size: 0.65rem; background: #7c3aed; color: #fff; padding: 3px; border-radius: 4px; text-align: center; font-weight: bold; margin-right: 8px;">FROTA 2</span>';
        else if (eq === 'C' || eq === 'F') posicaoTag = '<span style="display:inline-block; width: 75px; font-size: 0.65rem; background: #ea580c; color: #fff; padding: 3px; border-radius: 4px; text-align: center; font-weight: bold; margin-right: 8px;">FOLGUISTA</span>';
        else posicaoTag = '<span style="display:inline-block; width: 75px; font-size: 0.65rem; background: #475569; color: #fff; padding: 3px; border-radius: 4px; text-align: center; font-weight: bold; margin-right: 8px;">RESERVA</span>';

        let turnoDisplay = '';
        if (['A', 'B', 'C'].includes(eq)) turnoDisplay = '<span style="color: #fbbf24; font-size: 0.75rem;">☀️ Turno Dia</span>';
        else if (['D', 'E', 'F'].includes(eq)) turnoDisplay = '<span style="color: #93c5fd; font-size: 0.75rem;">🌙 Turno Noite</span>';

        let equipeSelect = `
            <div style="display: flex; align-items: center; justify-content: flex-start;">
                ${posicaoTag}
                <select class="select-aloc-equipe select-turno" data-id="${m.id}" ${isBlocked ? 'disabled' : ''} style="width: 140px; font-weight: bold; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 6px;">
                    <option value="-" ${eq === '-' ? 'selected' : ''}>Sem EQUIPE</option>
                    <option value="A" ${eq === 'A' ? 'selected' : ''}>A (Dia)</option>
                    <option value="B" ${eq === 'B' ? 'selected' : ''}>B (Dia)</option>
                    <option value="C" ${eq === 'C' ? 'selected' : ''}>C (Dia)</option>
                    <option value="D" ${eq === 'D' ? 'selected' : ''}>D (Noite)</option>
                    <option value="E" ${eq === 'E' ? 'selected' : ''}>E (Noite)</option>
                    <option value="F" ${eq === 'F' ? 'selected' : ''}>F (Noite)</option>
                </select>
            </div>`;
        
        let isNoite = ['D', 'E', 'F'].includes(eq);
        let opcoesIndividual = '<option value="-">-</option>';
        window.getCiclos().forEach(c => {
            let labelVisual = isNoite ? c.labelNoite : c.labelDia;
            if (eq === '-') labelVisual = c.labelDia; 
            let selected = (m.turno === c.dbValue) ? 'selected' : '';
            opcoesIndividual += `<option value="${c.dbValue}" ${selected}>${labelVisual}</option>`;
        });

        let turnoSelect = `<select class="select-aloc-turno select-turno" data-id="${m.id}" ${isBlocked ? 'disabled' : ''} style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 6px;">
            ${isBlocked ? '<option value="-">-</option>' : opcoesIndividual}
        </select>`;
        
        let conjuntoSelect = `<select class="select-aloc-conjunto select-turno" data-id="${m.id}" ${isBlocked ? 'disabled' : ''} style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 6px;">
            <option value="">Não Alocado</option>
            ${isBlocked ? '' : conjuntos.map(c => `<option value="${c.id}" ${String(m.conjuntoId) === String(c.id) ? 'selected' : ''}>Conjunto ${String(c.id).padStart(2, '0')}</option>`).join('')}
        </select>`;
        
        let botaoManual = '';
        if (m.data_ancora) {
            const partesData = m.data_ancora.split('-'); 
            const dataFormatada = partesData.length === 3 ? `${partesData[2]}/${partesData[1]}` : 'Ajustado';
            botaoManual = `<button class="btn-primary-green" style="width: 100%; padding: 7px; font-size: 0.75rem; font-weight: bold; border-radius: 4px;" onclick="window.abrirModalEscalaManual('${m.id}')" ${isBlocked ? 'disabled' : ''}>Ciclo (${dataFormatada})</button>`;
        } else {
            botaoManual = `<button class="btn-primary-blue" style="width: 100%; padding: 7px; font-size: 0.75rem; font-weight: bold; border-radius: 4px;" onclick="window.abrirModalEscalaManual('${m.id}')" ${isBlocked ? 'disabled' : ''}>Ajustar Ciclo</button>`;
        }
        
        let bgRow = 'transparent';
        if (!isBlocked) {
            if (['A', 'B', 'C'].includes(eq)) bgRow = 'rgba(253, 230, 138, 0.05)';
            else if (['D', 'E', 'F'].includes(eq)) bgRow = 'rgba(191, 219, 254, 0.05)';
        }
        
        let flagStatusRH = '';
        if (m.status === 'Férias') flagStatusRH = ' <span style="font-size:0.6rem; background:#f59e0b; color:#fff; padding:2px 4px; border-radius:3px;">FÉRIAS</span>';
        if (m.status === 'Afastado') flagStatusRH = ' <span style="font-size:0.6rem; background:#ef4444; color:#fff; padding:2px 4px; border-radius:3px;">AFASTADO</span>';

        html += `<tr style="${isBlocked ? 'background-color: rgba(239, 68, 68, 0.1);' : `background-color: ${bgRow};`} border-bottom: 1px solid rgba(255,255,255,0.05);">
            <td style="padding: 12px 15px; vertical-align: middle; width: 25%;">
                <div style="${isBlocked ? 'color: #ef4444;' : 'color: #f8fafc;'} font-weight: 800; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m.nome}${flagStatusRH}</div>
                ${turnoDisplay}
            </td>
            <td style="padding: 10px; vertical-align: middle; width: 32%;">${equipeSelect}</td>
            <td style="padding: 10px; vertical-align: middle; width: 15%;">${turnoSelect}</td>
            <td style="padding: 10px; vertical-align: middle; width: 13%;">${conjuntoSelect}</td>
            <td style="padding: 10px; vertical-align: middle; width: 15%;">${botaoManual}</td>
        </tr>`;
    });

    tbody.innerHTML = html;

    document.querySelectorAll('.select-aloc-equipe, .select-aloc-turno, .select-aloc-conjunto').forEach(el => el.addEventListener('change', window.updateAlocacao));
    
    document.querySelectorAll('.select-turno-global').forEach(el => el.addEventListener('change', async (e) => {
        const conjuntoId = e.target.dataset.conjunto;
        const novoTurnoDbValue = e.target.value;
        if (!novoTurnoDbValue) return;

        const cicloInfo = window.getCiclos().find(c => c.dbValue === novoTurnoDbValue);
        if (!confirm(`Confirmar mudança do Conjunto ${conjuntoId} para "${cicloInfo.base}"?\n\n- Equipes Dia (A, B, C) exibirão: ${cicloInfo.labelDia}\n- Equipes Noite (D, E, F) exibirão: ${cicloInfo.labelNoite}`)) {
            e.target.value = ""; 
            return;
        }

        try {
            e.target.disabled = true;
            const hojeStr = new Date().toISOString().split('T')[0];
            const motsToUpdate = motoristas.filter(m => String(m.conjuntoId) === String(conjuntoId));
            
            for (let m of motsToUpdate) {
                let historico = Array.isArray(m.historico_alocacao) ? [...m.historico_alocacao] : [];
                
                if (historico.length === 0) {
                    historico.push({
                        data_inicio: '2020-01-01',
                        equipe: m.equipe || '-',
                        turno: m.turno || '-',
                        conjuntoId: m.conjuntoId || null,
                        data_ancora: m.data_ancora || null
                    });
                }
                
                historico = historico.filter(h => h.data_inicio !== hojeStr);
                historico.push({
                    data_inicio: hojeStr,
                    equipe: m.equipe,
                    turno: novoTurnoDbValue,
                    conjuntoId: m.conjuntoId,
                    data_ancora: hojeStr // Âncora atualiza para o dia da mudança
                });
                
                m.turno = novoTurnoDbValue;
                m.data_ancora = hojeStr; // Atualiza em memória
                m.historico_alocacao = historico;

                await window.supabaseClient.from('rh_colaboradores').update({
                    turno: novoTurnoDbValue,
                    data_ancora: hojeStr, // Atualiza no banco
                    historico_alocacao: historico
                }).eq('id', m.id);
            }
            
            alert("Turno atualizado em lote com sucesso!");
            window.renderizarAlocacao();
            if(typeof window.renderizarEscala === 'function') window.renderizarEscala();
        } catch(err) {
            console.error(err);
            alert("Erro ao alterar turno em lote.");
        }
    }));
};

window.updateAlocacao = async function(e) {
    const select = e.target;
    const motoristaId = select.dataset.id;
    const m = motoristas.find(x => String(x.id) === String(motoristaId));
    if (!m) return;

    const tr = select.closest('tr');
    const novaEquipe = tr.querySelector('.select-aloc-equipe').value;
    const novoTurno = tr.querySelector('.select-aloc-turno').value;
    const novoConjuntoId = tr.querySelector('.select-aloc-conjunto').value || null;

    const hojeStr = new Date().toISOString().split('T')[0];
    let historico = Array.isArray(m.historico_alocacao) ? [...m.historico_alocacao] : [];

    if (historico.length === 0) {
        historico.push({
            data_inicio: '2020-01-01',
            equipe: m.equipe || '-',
            turno: m.turno || '-',
            conjuntoId: m.conjuntoId || null,
            data_ancora: m.data_ancora || null
        });
    }

    historico = historico.filter(h => h.data_inicio !== hojeStr);

    // Atualiza a âncora para o dia atual da alteração
    historico.push({
        data_inicio: hojeStr,
        equipe: novaEquipe,
        turno: novoTurno,
        conjuntoId: novoConjuntoId,
        data_ancora: hojeStr 
    });

    m.equipe = novaEquipe;
    m.turno = novoTurno;
    m.conjuntoId = novoConjuntoId;
    m.data_ancora = hojeStr; // Atualiza a âncora principal em memória
    m.historico_alocacao = historico;

    select.disabled = true;

    try {
        await window.supabaseClient.from('rh_colaboradores').update({
            equipe: novaEquipe,
            turno: novoTurno,
            conjunto_id: novoConjuntoId ? parseInt(novoConjuntoId) : null,
            data_ancora: hojeStr, // Atualiza a âncora principal no banco de dados
            historico_alocacao: historico
        }).eq('id', motoristaId);

        if (typeof window.registrarLogAuditoria === 'function') {
            window.registrarLogAuditoria('Logística', 'Alocação', `Alocação atualizada: ${m.nome} (Eq:${novaEquipe} / T:${novoTurno} / Cj:${novoConjuntoId || 'S/F'})`, 'Info');
        }

        select.disabled = false;
        window.renderizarAlocacao();
        if(typeof window.renderizarEscala === 'function') window.renderizarEscala();
    } catch(error) {
        console.error(error);
        alert("Erro ao atualizar alocação.");
        select.disabled = false;
    }
};

window.resetarCicloConjunto = async function(conjuntoId) {
    if(!confirm(`Deseja resetar o ciclo 4x2 do Conjunto ${conjuntoId} para a data de HOJE?\nIsso afetará as equipes A, B e C (Dia) e D, E e F (Noite).`)) return;

    const mots = motoristas.filter(m => String(m.conjuntoId) === String(conjuntoId));
    const hojeStr = new Date().toISOString().split('T')[0];

    for (let m of mots) {
        let eq = window.getEq(m);
        let diasParaSubtrair = 0;
        
        if (eq === 'A' || eq === 'D') diasParaSubtrair = 0;
        else if (eq === 'B' || eq === 'E') diasParaSubtrair = 2;
        else if (eq === 'C' || eq === 'F') diasParaSubtrair = 4;

        let dataAncoraObj = new Date(hojeStr + 'T00:00:00');
        dataAncoraObj.setDate(dataAncoraObj.getDate() - diasParaSubtrair);
        
        const ano = dataAncoraObj.getFullYear();
        const mes = String(dataAncoraObj.getMonth() + 1).padStart(2, '0');
        const dia = String(dataAncoraObj.getDate()).padStart(2, '0');
        const novaAncora = `${ano}-${mes}-${dia}`;

        m.data_ancora = novaAncora;
        
        let historico = Array.isArray(m.historico_alocacao) ? [...m.historico_alocacao] : [];
        historico = historico.filter(h => h.data_inicio !== hojeStr);
        historico.push({
            data_inicio: hojeStr,
            equipe: m.equipe,
            turno: m.turno,
            conjuntoId: m.conjuntoId,
            data_ancora: novaAncora
        });
        m.historico_alocacao = historico;

        await window.supabaseClient.from('rh_colaboradores').update({
            data_ancora: novaAncora,
            historico_alocacao: historico
        }).eq('id', m.id);
    }
    
    alert('Ciclos resetados com sucesso!');
    window.renderizarAlocacao();
    if(typeof window.renderizarEscala === 'function') window.renderizarEscala();
};

window.salvarEscalaManual = async function() {
    const motId = document.getElementById('manualMotId').value;
    const dataAncora = document.getElementById('manualDataInicio').value;
    if (!dataAncora) { alert("Informe a data."); return; }

    const m = motoristas.find(x => String(x.id) === String(motId));
    if (!m) return;

    m.data_ancora = dataAncora;
    
    const hojeStr = new Date().toISOString().split('T')[0];
    let historico = Array.isArray(m.historico_alocacao) ? [...m.historico_alocacao] : [];
    
    if (historico.length === 0) {
        historico.push({ data_inicio: '2020-01-01', equipe: m.equipe || '-', turno: m.turno || '-', conjuntoId: m.conjuntoId || null, data_ancora: m.data_ancora || null });
    }
    
    historico = historico.filter(h => h.data_inicio !== hojeStr);
    historico.push({ data_inicio: hojeStr, equipe: m.equipe, turno: m.turno, conjuntoId: m.conjuntoId, data_ancora: dataAncora });
    m.historico_alocacao = historico;

    await window.supabaseClient.from('rh_colaboradores').update({
        data_ancora: dataAncora,
        historico_alocacao: historico
    }).eq('id', motId);

    alert("Ciclo salvo com sucesso!");
    window.fecharModalManual();
    window.renderizarAlocacao();
    if(typeof window.renderizarEscala === 'function') window.renderizarEscala();
};

window.abrirModalEscalaManual = function(id) {
    const m = motoristas.find(x => String(x.id) === String(id));
    if (!m) return;
    
    document.getElementById('manualMotId').value = m.id;
    document.getElementById('manualMotNome').innerText = m.nome;
    document.getElementById('manualMotEquipe').innerText = m.equipe || '-';
    document.getElementById('manualDataInicio').value = m.data_ancora ? m.data_ancora.split('T')[0] : '';
    
    const modal = document.getElementById('modalEscalaManual');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('show');
    }
    
    if (typeof window.atualizarPreviewManual === 'function') window.atualizarPreviewManual();
};

window.fecharModalManual = function() {
    const modal = document.getElementById('modalEscalaManual');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
    }
};

window.atualizarPreviewManual = function() {
    const dataStr = document.getElementById('manualDataInicio').value;
    const container = document.getElementById('previewManualContainer');
    if (!dataStr || !container) return;

    const dDate = new Date(dataStr + 'T00:00:00');
    let html = '';
    
    for (let i = 0; i < 6; i++) {
        let current = new Date(dDate);
        current.setDate(current.getDate() + i);
        
        let isTrabalho = i < 4;
        let bg = isTrabalho ? 'rgba(59, 130, 246, 0.2)' : 'rgba(249, 115, 22, 0.2)';
        let color = isTrabalho ? '#93c5fd' : '#fb923c';
        let label = isTrabalho ? 'T' : 'F';
        
        html += `
            <div style="background: ${bg}; color: ${color}; padding: 8px 12px; border-radius: 6px; border: 1px solid ${color}; text-align: center; min-width: 45px;">
                <div style="font-size: 0.7rem; margin-bottom: 5px;">Dia ${i+1}</div>
                <div style="font-size: 1.2rem; font-weight: bold;">${label}</div>
            </div>
        `;
    }
    container.innerHTML = html;
};

// ============================================================================
// LÓGICA DO HISTÓRICO DE ESCALA (NOVA ABA)
// ============================================================================
window.renderizarHistoricoEscala = function() {
    let totalAlteracoes = 0;
    let motoristasAfetados = 0;
    
    let historicoMap = [];

    motoristas.forEach(m => {
        if (m.historico_alocacao && Array.isArray(m.historico_alocacao)) {
            const qtdAlteracoes = Math.max(0, m.historico_alocacao.length - 1);
            if (qtdAlteracoes > 0) {
                motoristasAfetados++;
                totalAlteracoes += qtdAlteracoes;
                
                const ultimaAcao = m.historico_alocacao[m.historico_alocacao.length - 1];
                
                historicoMap.push({
                    id: m.id,
                    nome: m.nome,
                    qtd: qtdAlteracoes,
                    ultimaData: ultimaAcao.data_inicio,
                    equipeAtual: m.equipe || '-',
                    conjuntoAtual: m.conjuntoId || 'Sem Conjunto'
                });
            }
        }
    });

    document.getElementById('kpiTotalAlteracoes').innerText = totalAlteracoes;
    document.getElementById('kpiMotoristasAlterados').innerText = motoristasAfetados;

    if (historicoMap.length > 0) {
        const topMotorista = [...historicoMap].sort((a, b) => b.qtd - a.qtd)[0];
        document.getElementById('kpiTopTrocado').innerHTML = `${topMotorista.nome}<br><span style="font-size:0.85rem; color:#64748b;">${topMotorista.qtd} trocas registradas</span>`;
    } else {
        document.getElementById('kpiTopTrocado').innerText = '-';
    }

    historicoMap.sort((a, b) => new Date(b.ultimaData) - new Date(a.ultimaData));
    window.dadosHistoricoMemoria = historicoMap;

    window.montarTabelaHistorico(historicoMap);
};

window.montarTabelaHistorico = function(lista) {
    const tbody = document.getElementById('tbHistoricoAlocacao');
    if (!tbody) return;

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhum histórico de alteração encontrado na base.</td></tr>';
        return;
    }

    let html = '';
    lista.forEach(h => {
        const dataFormatada = h.ultimaData.split('-').reverse().join('/');
        let eqStr = h.equipeAtual !== '-' ? `Eq: ${h.equipeAtual}` : 'Sem Eq';
        let cjStr = h.conjuntoAtual !== 'Sem Conjunto' ? `Cj: ${String(h.conjuntoAtual).padStart(2, '0')}` : 'S/ Conjunto';

        html += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="font-weight: bold; color: #f8fafc; font-size: 1rem;">${h.nome}</td>
                <td style="text-align: center; color: #f59e0b; font-weight: 800; font-size: 1.1rem;">${h.qtd}</td>
                <td style="color: #94a3b8;"><i class="fas fa-calendar-alt"></i> ${dataFormatada}</td>
                <td>
                    <span style="background: rgba(59, 130, 246, 0.2); color: #93c5fd; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; margin-right: 5px;">${eqStr}</span>
                    <span style="background: rgba(16, 185, 129, 0.2); color: #6ee7b7; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">${cjStr}</span>
                </td>
                <td style="text-align: right;">
                    <button class="btn-primary-blue" style="padding: 6px 12px; font-size: 0.8rem;" onclick="window.verLinhaTempoAlocacao('${h.id}')">
                        <i class="fas fa-stream"></i> Ver Timeline
                    </button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
};

window.filtrarTabelaHistorico = function() {
    const termo = document.getElementById('buscaHistoricoAlocacao').value.toLowerCase();
    const filtrados = window.dadosHistoricoMemoria.filter(h => h.nome.toLowerCase().includes(termo));
    window.montarTabelaHistorico(filtrados);
};

// ============================================================================
// VISUALIZADOR DA LINHA DO TEMPO (MODAL)
// ============================================================================
window.verLinhaTempoAlocacao = function(idMotorista) {
    const m = motoristas.find(x => String(x.id) === String(idMotorista));
    if (!m || !m.historico_alocacao) return;

    document.getElementById('ltNomeMotorista').innerText = m.nome;
    const container = document.getElementById('ltContainer');
    container.innerHTML = '';

    const historicoInvertido = [...m.historico_alocacao].sort((a, b) => new Date(b.data_inicio) - new Date(a.data_inicio));

    let html = '';
    historicoInvertido.forEach((reg, index) => {
        let isBase = (reg.data_inicio === '2020-01-01');
        let dataExibicao = isBase ? 'Registro Inicial (Base)' : reg.data_inicio.split('-').reverse().join('/');
        let iconeTime = isBase ? '<i class="fas fa-flag-checkered"></i>' : '<i class="fas fa-random"></i>';
        
        let eqStr = reg.equipe && reg.equipe !== '-' ? `Equipe ${reg.equipe}` : 'Sem Equipe';
        let cjStr = reg.conjuntoId ? `Conjunto ${String(reg.conjuntoId).padStart(2, '0')}` : 'Sem Conjunto';
        
        let turnoFormatado = reg.turno || '-';
        if (turnoFormatado !== '-') {
            let cl = window.getCiclos().find(c => c.dbValue === turnoFormatado);
            if (cl) {
                turnoFormatado = (['A','B','C'].includes(reg.equipe)) ? cl.labelDia : cl.labelNoite;
            }
        }

        let corAviso = isBase ? '#64748b' : 'var(--ccol-blue-bright)';

        html += `
            <div class="timeline-item">
                <div class="timeline-date" style="color: ${corAviso};">${iconeTime} ${dataExibicao}</div>
                <div class="timeline-content">
                    <div style="margin-bottom: 5px;">
                        <span class="timeline-badge" style="background: rgba(168, 85, 247, 0.2); color: #d8b4fe; border: 1px solid rgba(168, 85, 247, 0.4);">${cjStr}</span>
                        <span class="timeline-badge" style="background: rgba(59, 130, 246, 0.2); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.4);">${eqStr}</span>
                    </div>
                    <div><strong style="color: #94a3b8; font-size: 0.8rem;">Horário do Turno:</strong> <span style="color: #fff; font-weight: bold;">${turnoFormatado}</span></div>
                    ${reg.data_ancora ? `<div style="margin-top: 5px;"><strong style="color: #94a3b8; font-size: 0.8rem;">Âncora do Ciclo:</strong> <span style="color: #4ade80;">${reg.data_ancora.split('-').reverse().join('/')}</span></div>` : ''}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    document.getElementById('modalLinhaTempoAlocacao').style.display = 'flex';
};

window.fecharModalLinhaTempo = function() {
    document.getElementById('modalLinhaTempoAlocacao').style.display = 'none';
};