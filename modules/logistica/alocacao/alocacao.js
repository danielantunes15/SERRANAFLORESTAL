// ==================== MÓDULO: ALOCAÇÃO GERAL ====================

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
        
        // Pega o turno traduzido de alguém da equipe de DIA
        let motDia = mots.find(m => ['A','B','C'].includes(window.getEq(m)));
        if (motDia && motDia.turno && motDia.turno !== '-') {
            let cMatch = window.getCiclos().find(c => c.dbValue === motDia.turno);
            turnosConjunto.add(cMatch ? cMatch.labelDia : motDia.turno);
        }
        
        // Pega o turno traduzido de alguém da equipe de NOITE
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
            <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 700;">Total da Frota Operante no Conjunto: <span style="color: #cbd5e1;">${totalCaminhoesAtivos} Cavalos únicos</span></span>
        </div>`;
    }

    finalHtml += '</div>';
    container.innerHTML = finalHtml;
}

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
        if (['A', 'B', 'C'].includes(eq)) turnoDisplay = '<span style="color: #fbbf24; font-size: 0.75rem;"> Turno Dia</span>';
        else if (['D', 'E', 'F'].includes(eq)) turnoDisplay = '<span style="color: #93c5fd; font-size: 0.75rem;"> Turno Noite</span>';

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
            const motsToUpdate = motoristas.filter(m => String(m.conjuntoId) === String(conjuntoId));

            for (let mot of motsToUpdate) {
                if (typeof db !== 'undefined' && db.updateMotorista) {
                    await db.updateMotorista(String(mot.id), { turno: novoTurnoDbValue });
                }
                mot.turno = novoTurnoDbValue;
            }

            if (typeof salvarBackupLocal === 'function') salvarBackupLocal();
            if (typeof window.renderizarEscala === 'function') window.renderizarEscala(); 
            if (typeof atualizarStats === 'function') atualizarStats();
            window.renderizarAlocacao(); 

        } catch (error) {
            console.error("Erro na alteração em massa:", error);
            alert("Erro ao alterar horários. Verifique a conexão com o banco de dados.");
            e.target.disabled = false;
        }
    }));
}

window.updateAlocacao = async function(e) {
    const idStr = String(e.target.dataset.id);
    const motorista = motoristas.find(m => String(m.id) === idStr);
    const tr = e.target.closest('tr');
    
    if (!motorista) return;

    const oldEquipe = motorista.equipe;
    const oldTurno = motorista.turno;
    const oldConjuntoId = motorista.conjuntoId;

    let novaEquipe = tr.querySelector('.select-aloc-equipe').value;
    let novoTurno = tr.querySelector('.select-aloc-turno').value;
    let conjVal = tr.querySelector('.select-aloc-conjunto').value;
    
    novaEquipe = (novaEquipe && novaEquipe !== '-') ? novaEquipe : '-';
    novoTurno = (novoTurno && novoTurno !== '-') ? novoTurno : null;

    let novoConjuntoId = null;
    if (conjVal && conjVal !== "") {
        const conjuntoOriginal = conjuntos.find(c => String(c.id) === String(conjVal));
        novoConjuntoId = conjuntoOriginal ? conjuntoOriginal.id : Number(conjVal);
    }
    
    try {
        await db.updateMotorista(String(motorista.id), { 
            equipe: novaEquipe, 
            turno: novoTurno,
            conjuntoId: novoConjuntoId 
        });
        
        motorista.equipe = novaEquipe;
        motorista.turno = novoTurno;
        motorista.conjuntoId = novoConjuntoId;
        
        if(typeof salvarBackupLocal === 'function') salvarBackupLocal();
        if(typeof window.renderizarEscala === 'function') window.renderizarEscala(); 
        if(typeof atualizarStats === 'function') atualizarStats();
        
        window.renderizarAlocacao();
        
    } catch (error) {
        tr.querySelector('.select-aloc-equipe').value = oldEquipe || '-';
        tr.querySelector('.select-aloc-turno').value = oldTurno || '-';
        tr.querySelector('.select-aloc-conjunto').value = (oldConjuntoId !== null && oldConjuntoId !== undefined) ? String(oldConjuntoId) : '';
    }
}

window.resetarCicloConjunto = async function(conjuntoId) {
    if(currentUser.role !== 'Admin') { alert('Acesso Negado: Apenas Administradores podem zerar o ciclo.'); return; }
    if (!confirm(`Deseja ZERAR as datas e as edições manuais da escala do Conjunto ${conjuntoId}?`)) return;

    let promisesExclusao = [];

    motoristas.forEach(m => {
        if (String(m.conjuntoId) === String(conjuntoId)) {
            if (m.data_ancora) { m.data_ancora = null; db.updateMotorista(String(m.id), { data_ancora: null }); }
            if (escalas[m.id]) escalas[m.id] = {};
            if (typeof db.deleteEscalasPorMotorista === 'function') promisesExclusao.push(db.deleteEscalasPorMotorista(String(m.id)));
        }
    });

    await Promise.all(promisesExclusao);
    await db.addLog('Reset de Ciclo', `Datas âncora e escalas manuais removidas para o Conjunto ${conjuntoId}.`);

    if(typeof salvarBackupLocal === 'function') salvarBackupLocal();
    window.renderizarAlocacao();
    if(typeof window.renderizarEscala === 'function') window.renderizarEscala();
    alert(`O ciclo e a escala do Conjunto ${conjuntoId} foram completamente zerados!`);
}

window.abrirModalEscalaManual = function(id) {
    const idStr = String(id);
    const m = motoristas.find(mot => String(mot.id) === idStr);
    if (!m) return;

    let eq = window.getEq(m);
    if (m.conjuntoId && eq === '-') { 
        alert("O motorista precisa ter uma EQUIPE (A-F) antes de configurar a data do ciclo!"); 
        return; 
    }

    document.getElementById('manualMotId').value = m.id;
    document.getElementById('manualMotNome').innerText = m.nome;
    document.getElementById('manualMotEquipe').innerText = eq;
    
    let dia1 = new Date();
    if (m.data_ancora) {
        const strAncora = m.data_ancora.split('T')[0];
        dia1 = new Date(strAncora + 'T00:00:00');
    }
    
    const dLocal = `${dia1.getFullYear()}-${String(dia1.getMonth() + 1).padStart(2, '0')}-${String(dia1.getDate()).padStart(2, '0')}`;
    document.getElementById('manualDataInicio').value = dLocal;
    
    window.atualizarPreviewManual();
    document.getElementById('modalEscalaManual').classList.add('show');
}

window.fecharModalManual = function() { document.getElementById('modalEscalaManual').classList.remove('show'); }

window.atualizarPreviewManual = function() {
    const dataStr = document.getElementById('manualDataInicio').value;
    const container = document.getElementById('previewManualContainer');
    if(!dataStr) return;

    const dBase = new Date(dataStr + 'T00:00:00');
    let html = '';
    
    for(let i = 0; i < 6; i++) {
        let d = new Date(dBase);
        d.setDate(d.getDate() + i);
        let isTrab = i < 4; 
        let txt = isTrab ? 'TRAB' : 'FOLGA';
        let icon = isTrab ? ' ' : ' ';
        let colorBorder = isTrab ? '#3b82f6' : '#f97316';
        let colorBg = isTrab ? 'rgba(59, 130, 246, 0.15)' : 'rgba(249, 115, 22, 0.15)';
        
        html += `<div style="background: ${colorBg}; border: 1px solid ${colorBorder}; padding: 12px 10px; border-radius: 8px; flex: 1; text-align: center;">
            <div style="font-size: 0.8rem; margin-bottom: 5px;">${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}</div>
            <div style="font-size: 1.8rem; margin-bottom: 5px;">${icon}</div>
            <div style="font-size: 0.85rem; font-weight: 800; color: ${colorBorder};">${txt}</div>
        </div>`;
    }
    container.innerHTML = html;
}

window.salvarEscalaManual = async function() {
    const idStr = String(document.getElementById('manualMotId').value);
    const dataEscolhida = document.getElementById('manualDataInicio').value; 
    const m = motoristas.find(mot => String(mot.id) === idStr);
    
    if (m && dataEscolhida) {
        try {
            await db.updateMotorista(String(m.id), { data_ancora: dataEscolhida });
            m.data_ancora = dataEscolhida; 
        } catch(e) {
            return; 
        }
        
        if (escalas[m.id]) escalas[m.id] = {};
        if (typeof db.deleteEscalasPorMotorista === 'function') await db.deleteEscalasPorMotorista(String(m.id));

        if(typeof salvarBackupLocal === 'function') salvarBackupLocal();
        window.fecharModalManual();
        if(typeof window.renderizarEscala === 'function') window.renderizarEscala(); 
        window.renderizarAlocacao();
    }
}