// ==================== MÓDULO: ESCALA SEMANAL (NÚCLEO) ====================

// Funções globais utilitárias para que o módulo de Alocação também possa usá-las
window.getEq = function(m) { return m && m.equipe ? m.equipe.trim().toUpperCase() : '-'; };
window.pesoEquipe = function(eq) { return {'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6}[eq] || 99; };

window.SISTEMA_CICLOS = [];

window.getCiclos = function() {
    if (window.SISTEMA_CICLOS.length > 0) return window.SISTEMA_CICLOS;
    
    let baseList = ["02:00-14:00", "03:00-15:00", "04:00-16:00", "05:00-17:00", "06:00-18:00", "07:00-19:00", "08:00-20:00", "09:00-21:00", "10:00-22:00"];
    if (typeof TURNOS !== 'undefined' && TURNOS.length > 0) {
        baseList = TURNOS.map(t => t.periodo);
    }

    window.SISTEMA_CICLOS = baseList.map(val => {
        let nums = val.match(/\d+/g);
        let h1 = 0, h2 = 0;
        
        if (val.includes(':')) {
            h1 = parseInt(nums[0]);
            if (nums.length >= 3) h2 = parseInt(nums[2]);
            else h2 = (h1 + 12) % 24;
        } else {
            if (nums && nums.length >= 2) {
                h1 = parseInt(nums[0]);
                h2 = parseInt(nums[1]);
            } else if (nums && nums.length === 1) {
                h1 = parseInt(nums[0]);
                h2 = (h1 + 12) % 24;
            }
        }
        
        let hdStr = String(h1).padStart(2, '0') + ":00";
        let hnStr = String(h2).padStart(2, '0') + ":00";

        return {
            dbValue: val,
            base: hdStr,
            labelDia: `${hdStr} às ${hnStr}`,
            labelNoite: `${hnStr} às ${hdStr}`
        };
    });
    return window.SISTEMA_CICLOS;
}

window.popularSelectMotoristas = function() {
    const select = document.getElementById('buscaMotoristaEscala');
    if (!select) return;
    
    const valorAtual = select.value;
    let html = '<option value="">Selecione o motorista...</option>';
    
    const motoristasOrdenados = [...motoristas].sort((a, b) => a.nome.localeCompare(b.nome));
    motoristasOrdenados.forEach(m => { html += `<option value="${m.nome}">${m.nome}</option>`; });
    
    select.innerHTML = html;
    if (valorAtual && motoristas.some(m => m.nome === valorAtual)) {
        select.value = valorAtual;
    }
}

window.getStatusMotorista = function(m, dDate) {
    if (!m || !m.data_ancora) return 'F';
    const strAncora = m.data_ancora.split('T')[0];
    const dataAncora = new Date(strAncora + 'T00:00:00');
    
    const utcAncora = Date.UTC(dataAncora.getFullYear(), dataAncora.getMonth(), dataAncora.getDate());
    const utcAtual = Date.UTC(dDate.getFullYear(), dDate.getMonth(), dDate.getDate());
    const diffDays = Math.round((utcAtual - utcAncora) / (1000 * 60 * 60 * 24));
    
    const cicloDia = ((diffDays % 6) + 6) % 6;
    return cicloDia < 4 ? 'TRAB' : 'F';
}

window.calcularEscalaMatematica = function(motorista, dateKey) {
    if (!motorista.data_ancora || motorista.masterDrive === 'Não' || motorista.destra === 'Não' || motorista.status === 'Férias' || motorista.status === 'Afastado') {
        return { caminhao: 'F', turno: motorista.turno, status: 'fallback' };
    }
    const eq = window.getEq(motorista);
    if (motorista.conjuntoId && eq === '-') {
        return { caminhao: 'F', turno: motorista.turno, status: 'fallback' };
    }

    const dDate = new Date(dateKey + 'T00:00:00');
    const statusMot = window.getStatusMotorista(motorista, dDate);

    if (statusMot === 'F') return { caminhao: 'F', turno: motorista.turno, status: 'fallback' };

    const conjunto = conjuntos.find(c => String(c.id) === String(motorista.conjuntoId));
    if (!conjunto || !conjunto.caminhoes) return { caminhao: 'T', turno: motorista.turno, status: 'fallback' };

    let placa1 = conjunto.caminhoes.length > 0 ? (typeof conjunto.caminhoes[0] === 'string' ? conjunto.caminhoes[0] : conjunto.caminhoes[0].placa) : 'F';
    let placa2 = conjunto.caminhoes.length > 1 ? (typeof conjunto.caminhoes[1] === 'string' ? conjunto.caminhoes[1] : conjunto.caminhoes[1].placa) : placa1;

    let statusCaminhao = 'F';
    if (eq === 'A' || eq === 'D') statusCaminhao = placa1;
    else if (eq === 'B' || eq === 'E') statusCaminhao = placa2;
    else if (eq === 'C') { 
        const fixoA = motoristas.find(mot => String(mot.conjuntoId) === String(motorista.conjuntoId) && window.getEq(mot) === 'A');
        const fixoB = motoristas.find(mot => String(mot.conjuntoId) === String(motorista.conjuntoId) && window.getEq(mot) === 'B');
        const statusA = fixoA ? window.getStatusMotorista(fixoA, dDate) : 'F';
        const statusB = fixoB ? window.getStatusMotorista(fixoB, dDate) : 'F';

        if (statusA === 'F') statusCaminhao = placa1;
        else if (statusB === 'F') statusCaminhao = placa2;
        else statusCaminhao = placa1; 
    } 
    else if (eq === 'F') {
        const fixoD = motoristas.find(mot => String(mot.conjuntoId) === String(motorista.conjuntoId) && window.getEq(mot) === 'D');
        const fixoE = motoristas.find(mot => String(mot.conjuntoId) === String(motorista.conjuntoId) && window.getEq(mot) === 'E');
        const statusD = fixoD ? window.getStatusMotorista(fixoD, dDate) : 'F';
        const statusE = fixoE ? window.getStatusMotorista(fixoE, dDate) : 'F';

        if (statusD === 'F') statusCaminhao = placa1;
        else if (statusE === 'F') statusCaminhao = placa2;
        else statusCaminhao = placa1;
    }
    
    if (statusCaminhao === 'TRAB') statusCaminhao = 'T';

    return { caminhao: statusCaminhao, turno: motorista.turno, status: 'auto' };
}

window.getEscalaDiaComputada = function(motorista, dateKey) {
    if (escalas[motorista.id] && escalas[motorista.id][dateKey] && escalas[motorista.id][dateKey].status === 'manual') {
        return escalas[motorista.id][dateKey];
    }
    return window.calcularEscalaMatematica(motorista, dateKey);
}

window.renderizarEscala = function() {
    const container = document.getElementById('escalaContainer');
    const filtroSelectEl = document.getElementById('filtroConjuntoEscala');
    
    window.popularSelectMotoristas();

    if (filtroSelectEl) {
        const valAtual = filtroSelectEl.value;
        let optHtml = '<option value="todos">Todos</option>';
        conjuntos.forEach(c => optHtml += `<option value="${c.id}">Conjunto ${String(c.id).padStart(2, '0')}</option>`);
        if (filtroSelectEl.innerHTML !== optHtml) {
            filtroSelectEl.innerHTML = optHtml;
            if (conjuntos.some(c => String(c.id) === String(valAtual))) filtroSelectEl.value = valAtual;
            else filtroSelectEl.value = 'todos';
        }
    }

    if (!container) return;

    if (motoristas.length === 0) {
        container.innerHTML = '<p style="padding: 20px; text-align: center;">Nenhum motorista registrado.</p>';
        return;
    }

    const inputData = document.getElementById('dataInicioEscala');
    const agora = new Date();
    const dataLocalAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;

    let dataBaseStr = inputData && inputData.value ? inputData.value : dataLocalAtual;
    let dataBase = new Date(dataBaseStr + 'T00:00:00');
    
    let diasRender = [];
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    for(let i = 0; i < 7; i++) {
        let d = new Date(dataBase);
        d.setDate(d.getDate() + i);
        let ano = d.getFullYear();
        let mes = String(d.getMonth() + 1).padStart(2, '0');
        let dia = String(d.getDate()).padStart(2, '0');

        diasRender.push({
            dateKey: `${ano}-${mes}-${dia}`,
            diaNum: dia + '/' + mes,
            diaTexto: diasSemana[d.getDay()]
        });
    }
    window.currentDatas = diasRender;

    const filtroSelec = filtroSelectEl ? filtroSelectEl.value : 'todos';
    let conjuntosRender = filtroSelec !== 'todos' ? conjuntos.filter(c => String(c.id) === String(filtroSelec)) : [...conjuntos];
    
    if (filtroSelec === 'todos') {
        if (motoristas.some(m => !m.conjuntoId)) {
            conjuntosRender.push({ id: 'S/F', isSemFrota: true, caminhoes: [] });
        }
    }

    conjuntosRender.sort((a, b) => {
        if (a.isSemFrota) return 1; 
        if (b.isSemFrota) return -1;
        return Number(a.id) - Number(b.id);
    });

    let html = '';

    conjuntosRender.forEach(conj => {
        let motoristasDoConjunto = conj.isSemFrota 
            ? motoristas.filter(m => !m.conjuntoId) 
            : motoristas.filter(m => String(m.conjuntoId) === String(conj.id));

        if (motoristasDoConjunto.length === 0) return;

        let numeroDisplay = conj.isSemFrota ? 'SEM FROTA / RESERVAS' : `CONJUNTO ${String(conj.id).padStart(2, '0')}`;

        const grupoDia = motoristasDoConjunto.filter(m => ['A', 'B', 'C'].includes(window.getEq(m)))
            .sort((a, b) => window.pesoEquipe(window.getEq(a)) - window.pesoEquipe(window.getEq(b)) || a.nome.localeCompare(b.nome));
            
        const grupoNoite = motoristasDoConjunto.filter(m => ['D', 'E', 'F'].includes(window.getEq(m)))
            .sort((a, b) => window.pesoEquipe(window.getEq(a)) - window.pesoEquipe(window.getEq(b)) || a.nome.localeCompare(b.nome));
            
        const outros = motoristasDoConjunto.filter(m => !['A', 'B', 'C', 'D', 'E', 'F'].includes(window.getEq(m)))
            .sort((a, b) => a.nome.localeCompare(b.nome));

        html += `<div style="background: rgba(15, 23, 42, 0.4); border-radius: 8px; margin-bottom: 30px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">`;
        html += `<div style="background: #0f172a; padding: 12px 20px; font-size: 1.1rem; font-weight: 800; color: #fff; border-bottom: 2px solid #3b82f6; text-align: left; letter-spacing: 1px;">
                      ${numeroDisplay}
                 </div>`;
        html += `<div style="overflow-x: auto; width: 100%;">`;
        html += `<table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 0.85rem; min-width: 950px;">`;
        html += `<thead>
                    <tr style="background-color: rgba(30, 41, 59, 0.9); color: #94a3b8; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.5px;">
                        <th style="padding: 12px 8px; border: 1px solid rgba(255,255,255,0.05); width: 12%;">Horário</th>
                        <th style="padding: 12px 8px; border: 1px solid rgba(255,255,255,0.05); width: 10%;">FROTA/Placa</th>
                        <th style="padding: 12px 8px; border: 1px solid rgba(255,255,255,0.05); width: 6%;">EQUIPE</th>
                        <th style="padding: 12px 8px; border: 1px solid rgba(255,255,255,0.05); width: 10%;">Posição</th>
                        <th style="padding: 12px 15px; border: 1px solid rgba(255,255,255,0.05); text-align: left; width: 22%;">Colaborador</th>
                        ${diasRender.map(d => `<th style="padding: 10px 5px; border: 1px solid rgba(255,255,255,0.05); width: 5.7%; color: #cbd5e1;">${d.diaTexto}<br><span style="font-size:0.85rem; font-weight:800; color: #fff;">${d.diaNum}</span></th>`).join('')}
                    </tr>
                 </thead><tbody>`;

        const renderRows = (grupo, tituloGrupo) => {
            if (grupo.length === 0) return '';
            let rowsHtml = `<tr style="background-color: rgba(0,0,0,0.6);">
                            <td colspan="${5 + diasRender.length}" style="padding: 8px 15px; font-weight: 800; font-size: 0.8rem; color: #e2e8f0; text-align: left; border: 1px solid rgba(255,255,255,0.05);">
                                ${tituloGrupo}
                            </td>
                         </tr>`;

            grupo.forEach(m => {
                const isBlocked = m.masterDrive === 'Não' || m.destra === 'Não' || m.status === 'Férias' || m.status === 'Afastado';
                let eq = window.getEq(m);
                
                let displayTurno = m.turno || '-';
                if (m.turno && m.turno !== '-') {
                    let cicloMatch = window.getCiclos().find(c => c.dbValue === m.turno);
                    if (cicloMatch) {
                        if (['A', 'B', 'C'].includes(eq)) displayTurno = cicloMatch.labelDia;
                        else if (['D', 'E', 'F'].includes(eq)) displayTurno = cicloMatch.labelNoite;
                    }
                }
                
                let goStr = '-';
                if (conj.caminhoes && conj.caminhoes.length > 0) {
                    let cam1 = conj.caminhoes[0];
                    let cam2 = conj.caminhoes.length > 1 ? conj.caminhoes[1] : cam1;
                    let go1 = (typeof cam1 === 'string' || (!cam1.go && !cam1.frota)) ? '-' : (cam1.frota || cam1.go);
                    let go2 = (typeof cam2 === 'string' || (!cam2.go && !cam2.frota)) ? '-' : (cam2.frota || cam2.go);

                    if (eq === 'A' || eq === 'D') goStr = go1;
                    else if (eq === 'B' || eq === 'E') goStr = go2;
                    else if (eq === 'C' || eq === 'F') goStr = (go1 !== '-' && go2 !== '-' && go1 !== go2) ? `${go1} / ${go2}` : (go1 !== '-' ? go1 : go2);
                    else goStr = go1 !== '-' ? go1 : '-';
                }
                
                let posicaoStr = '-';
                if (eq === 'A' || eq === 'D') posicaoStr = 'FROTA 1';
                else if (eq === 'B' || eq === 'E') posicaoStr = 'FROTA 2';
                else if (eq === 'C' || eq === 'F') posicaoStr = 'FOLGUISTA';
                
                let flagStatusRH = '';
                if (m.status === 'Férias') flagStatusRH = ' <span style="font-size:0.6rem; background:#f59e0b; color:#fff; padding:2px 4px; border-radius:3px;">FÉRIAS</span>';
                if (m.status === 'Afastado') flagStatusRH = ' <span style="font-size:0.6rem; background:#ef4444; color:#fff; padding:2px 4px; border-radius:3px;">AFASTADO</span>';

                rowsHtml += `<tr style="background-color: transparent; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;">`;
                rowsHtml += `<td style="padding: 8px; border: 1px solid rgba(255,255,255,0.05); color: #38bdf8; font-weight: bold;">${displayTurno}</td>`;
                rowsHtml += `<td style="padding: 8px; border: 1px solid rgba(255,255,255,0.05); font-weight: bold; color: #93c5fd;">${goStr}</td>`;
                rowsHtml += `<td style="padding: 8px; border: 1px solid rgba(255,255,255,0.05); font-weight: 800; color: #f8fafc;">${eq !== '-' ? eq : ''}</td>`;
                rowsHtml += `<td style="padding: 8px; border: 1px solid rgba(255,255,255,0.05); font-weight: 600; color: #cbd5e1;">${posicaoStr}</td>`;
                rowsHtml += `<td class="td-name" style="padding: 8px 15px; border: 1px solid rgba(255,255,255,0.05); text-align: left; ${isBlocked ? 'color: #f87171;' : 'color: #fff;'} font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m.nome}${flagStatusRH}</td>`;
                
                diasRender.forEach(d => {
                    const escala = window.getEscalaDiaComputada(m, d.dateKey);
                    const isFolga = escala.caminhao === 'F';
                    const isManual = escala.status === 'manual';
                    
                    let bgCell = isFolga ? 'rgba(249, 115, 22, 0.15)' : 'rgba(59, 130, 246, 0.15)';
                    let colorCell = isFolga ? '#fb923c' : '#93c5fd';
                    let borderSide = isFolga ? '1px solid rgba(249, 115, 22, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)';
                    
                    if (isManual) {
                        bgCell = 'rgba(168, 85, 247, 0.15)';
                        borderSide = '1px solid rgba(168, 85, 247, 0.5)';
                    }
                    
                    let opcoes = `<option value="F" ${isFolga ? 'selected' : ''} style="background: #1e293b; color: #fff;">F</option>`;
                    
                    opcoes += `<option value="T" ${escala.caminhao === 'T' || escala.caminhao === 'TRAB' ? 'selected' : ''} style="background: #1e293b; color: #fff;">T</option>`;
                    
                    if (!conj.isSemFrota) {
                        conj.caminhoes?.forEach(cam => {
                            const placa = typeof cam === 'string' ? cam : cam.placa;
                            opcoes += `<option value="${placa}" ${escala.caminhao === placa ? 'selected' : ''} style="background: #1e293b; color: #fff;">${placa}</option>`;
                        });
                    }
                    
                    if (isManual) {
                        opcoes += `<option value="AUTO" style="background: #0f172a; color: #fbbf24; font-weight: bold;"> Voltar para Auto</option>`;
                    }

                    rowsHtml += `<td style="padding: 4px; border: 1px solid rgba(255,255,255,0.05); border-left: ${borderSide}; border-right: ${borderSide}; background-color: ${bgCell}; text-align: center; vertical-align: middle;">
                        <select class="select-escala-excel" data-motorista="${m.id}" data-data="${d.dateKey}" ${isBlocked ? 'disabled' : ''} style="width: 100%; padding: 6px 0; background: transparent; border: none; color: ${colorCell}; font-weight: 800; font-size: 0.9rem; text-align: center; appearance: none; cursor: pointer; outline: none; text-align-last: center;">
                            ${isBlocked ? '<option value="F">Bloq</option>' : opcoes}
                        </select>
                    </td>`;
                });
                rowsHtml += `</tr>`;
            });
            return rowsHtml;
        };

        html += renderRows(grupoDia, '☀️ TURNO DO DIA (EQUIPES A, B, C)');
        html += renderRows(grupoNoite, '🌙 TURNO DA NOITE (EQUIPES D, E, F)');
        html += renderRows(outros, '📋 OUTROS / SEM TURNO FIXO');
        
        html += `</tbody></table></div></div>`;
    });

    container.innerHTML = html;
    document.querySelectorAll('.select-escala-excel').forEach(select => select.addEventListener('change', window.handleEscalaChange));
    if(typeof atualizarStats === 'function') atualizarStats();
    
    if (document.getElementById('buscaMotoristaEscala') && document.getElementById('buscaMotoristaEscala').value.trim() !== '') {
        window.buscarMotoristaEscala();
    }
}

window.limparDestaqueMotorista = function() {
    const linhas = document.querySelectorAll('#escalaContainer tbody tr');
    linhas.forEach(tr => {
        Array.from(tr.children).forEach(td => {
            td.style.removeProperty('background-color');
            const select = td.querySelector('select');
            if (select) select.style.removeProperty('color');
        });
    });
}

window.limparBuscaMotorista = function() {
    const selectBusca = document.getElementById('buscaMotoristaEscala');
    if(selectBusca) selectBusca.value = '';
    window.limparDestaqueMotorista();
}

window.buscarMotoristaEscala = function() {
    const selectBusca = document.getElementById('buscaMotoristaEscala');
    if (!selectBusca) return;
    
    const termo = selectBusca.value.trim().toLowerCase();
    window.limparDestaqueMotorista();

    if (termo === '') return;

    let encontrou = false;
    document.querySelectorAll('#escalaContainer tbody tr').forEach(tr => {
        const tdNome = tr.querySelector('.td-name');
        if (tdNome && tdNome.textContent.toLowerCase().includes(termo)) {
            Array.from(tr.children).forEach(td => {
                td.style.setProperty('background-color', 'rgba(253, 224, 71, 0.8)', 'important');
                const select = td.querySelector('select');
                if (select) select.style.setProperty('color', '#000', 'important');
            });
            if (!encontrou) {
                tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
                encontrou = true;
            }
        }
    });
}

window.handleEscalaChange = async function(e) {
    const select = e.target;
    const motoristaIdStr = String(select.dataset.motorista); 
    const data = select.dataset.data;
    const novoCaminhao = select.value;
    
    const m = motoristas.find(mot => String(mot.id) === motoristaIdStr);
    if(m) {
        const idExcecao = String(`${m.id}_${data}`);
        
        if (novoCaminhao === 'AUTO') {
            try {
                await db.deleteEscalaDia(idExcecao);
                if (escalas[m.id]) delete escalas[m.id][data];
                window.renderizarEscala(); 
            } catch (err) { console.error(err); }
            return;
        }

        try {
            await db.upsertEscala({ 
                id: idExcecao, 
                motorista_id: String(m.id), 
                data: data, 
                turno: m.turno, 
                caminhao: novoCaminhao, 
                status: 'manual' 
            });

            if (!escalas[m.id]) escalas[m.id] = {};
            escalas[m.id][data] = { turno: m.turno, caminhao: novoCaminhao, status: 'manual' };
            
            window.renderizarEscala(); 
            if(typeof atualizarStats === 'function') atualizarStats();
        } catch (error) {
            window.renderizarEscala(); 
        }
    }
}

window.abrirModalImpressao = function() {
    const hojeData = new Date();
    document.getElementById('printData').value = `${hojeData.getFullYear()}-${String(hojeData.getMonth() + 1).padStart(2, '0')}-${String(hojeData.getDate()).padStart(2, '0')}`;
    document.getElementById('modalImpressaoDiaria').classList.add('show');
}

window.fecharModalImpressao = function() { document.getElementById('modalImpressaoDiaria').classList.remove('show'); }

window.imprimirRelatorioEscalaSemanal = function() {
    if (!window.currentDatas || window.currentDatas.length === 0) {
        alert("Nenhuma semana renderizada. Selecione a data no painel primeiro."); return;
    }

    const filtroSelectEl = document.getElementById('filtroConjuntoEscala');
    const filtroSelec = filtroSelectEl ? filtroSelectEl.value : 'todos';
    let conjuntosRender = filtroSelec !== 'todos' ? conjuntos.filter(c => String(c.id) === String(filtroSelec)) : [...conjuntos];

    if (conjuntosRender.length === 0) { alert("Nenhum dado para imprimir."); return; }

    let html = `
    <html>
    <head>
        <title>Escala Semanal 4x2</title>
        <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: Arial, sans-serif; margin: 0; color: #000; font-size: 11px; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 15px; }
            h1 { margin: 0; font-size: 18px; text-transform: uppercase; }
            .trinca-box { margin-bottom: 15px; border: 2px solid #000; display: flex; break-inside: avoid; flex-direction: column; }
            .trinca-num { background: #eee; border-bottom: 2px solid #000; font-weight: bold; font-size: 14px; padding: 5px 10px; }
            table { width: 100%; border-collapse: collapse; text-align: center; }
            th, td { border: 1px solid #000; padding: 4px; font-size: 10px; }
            th { background-color: #d1d5db; }
            .dia-bg { background-color: #fef9c3; }
            .noite-bg { background-color: #dbeafe; }
            .trab { background-color: #d4edda; font-weight: bold; color: #000; }
            .folga { background-color: #f8d7da; color: #721c24; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Serrana Florestal - Escala Automática 4x2</h1>
            <p><strong>Semana Iniciada em: ${window.currentDatas[0].diaNum}</strong></p>
        </div>
    `;

    conjuntosRender.forEach(conj => {
        let motoristasDoConjunto = motoristas.filter(m => String(m.conjuntoId) === String(conj.id));
        if (motoristasDoConjunto.length === 0) return;

        const gDia = motoristasDoConjunto.filter(m => ['A', 'B', 'C'].includes(window.getEq(m))).sort((a,b) => window.pesoEquipe(window.getEq(a)) - window.pesoEquipe(window.getEq(b)));
        const gNoite = motoristasDoConjunto.filter(m => ['D', 'E', 'F'].includes(window.getEq(m))).sort((a,b) => window.pesoEquipe(window.getEq(a)) - window.pesoEquipe(window.getEq(b)));

        const renderTable = (grupo, titulo, classeTr) => {
            if (grupo.length === 0) return '';
            let tHtml = `<tr><td colspan="12" style="background: #e5e7eb; font-weight: bold; text-align: left; padding-left: 10px; font-size: 12px;">${titulo}</td></tr>`;
            
            grupo.forEach(m => {
                let eq = window.getEq(m);
                let goStr = '-', posStr = '-';
                
                if (conj.caminhoes && conj.caminhoes.length > 0) {
                    let cam1 = conj.caminhoes[0];
                    let cam2 = conj.caminhoes.length > 1 ? conj.caminhoes[1] : cam1;
                    let go1 = cam1.frota || cam1.go || '-', go2 = cam2.frota || cam2.go || '-';
                    if (eq === 'A' || eq === 'D') { goStr = go1; posStr = 'FROTA 1'; }
                    else if (eq === 'B' || eq === 'E') { goStr = go2; posStr = 'FROTA 2'; }
                    else { goStr = (go1!=='-' && go2!=='-' && go1!==go2)?`${go1}/${go2}`:go1; posStr = 'FOLGUISTA'; }
                }

                let printTurno = m.turno || '-';
                if (m.turno && m.turno !== '-') {
                    let cMatch = window.getCiclos().find(c => c.dbValue === m.turno);
                    if (cMatch) printTurno = (['A','B','C'].includes(eq)) ? cMatch.labelDia : cMatch.labelNoite;
                }
                
                tHtml += `<tr class="${classeTr}"><td>${printTurno}</td><td>${goStr}</td><td>${eq}</td><td>${posStr}</td><td style="text-align:left;"><b>${m.nome}</b></td>`;
                
                window.currentDatas.forEach(d => {
                    const esc = window.getEscalaDiaComputada(m, d.dateKey);
                    const isF = esc.caminhao === 'F';
                    const valorExibicao = isF ? 'F' : esc.caminhao;
                    tHtml += `<td class="${isF ? 'folga' : 'trab'}">${valorExibicao}</td>`;
                });
                tHtml += `</tr>`;
            });
            return tHtml;
        };

        html += `<div class="trinca-box"><div class="trinca-num">CONJUNTO ${String(conj.id).padStart(2, '0')}</div>`;
        html += `<table><thead><tr><th style="width:11%;">HORÁRIO</th><th style="width:11%;">FROTA/PLACA</th><th style="width:5%;">EQ</th><th style="width:11%;">POSIÇÃO</th><th style="text-align:left;">COLABORADOR</th>${window.currentDatas.map(d => `<th style="width:8%;">${d.diaTexto}<br>${d.diaNum}</th>`).join('')}</tr></thead><tbody>`;
        html += renderTable(gDia, 'TURNO DO DIA (EQUIPES A, B, C)', 'dia-bg');
        html += renderTable(gNoite, 'TURNO DA NOITE (EQUIPES D, E, F)', 'noite-bg');
        html += `</tbody></table></div>`;
    });

    html += `<script>window.print();</script></body></html>`;
    const w = window.open('', '', 'width=1200,height=800');
    w.document.write(html);
    w.document.close();
}

window.exportarEscalaMensalExcel = function() {
    const inputData = document.getElementById('dataInicioEscala');
    let dataBase = inputData && inputData.value ? new Date(inputData.value + 'T00:00:00') : new Date();
    
    const ano = dataBase.getFullYear();
    const mes = dataBase.getMonth(); 
    const diasNoMes = new Date(ano, mes + 1, 0).getDate(); 

    let csvContent = "\uFEFFHorário;FROTA/Placa;EQUIPE;Posição;Colaborador";
    for (let dia = 1; dia <= diasNoMes; dia++) csvContent += `;${dia.toString().padStart(2, '0')}/${(mes + 1).toString().padStart(2, '0')}`;
    csvContent += "\n";

    let mOrdenados = [...motoristas].sort((a, b) => {
        const conjA = a.conjuntoId ? Number(a.conjuntoId) : 999999;
        const conjB = b.conjuntoId ? Number(b.conjuntoId) : 999999;
        return conjA - conjB || window.pesoEquipe(window.getEq(a)) - window.pesoEquipe(window.getEq(b));
    });

    mOrdenados.forEach(m => {
        let eq = window.getEq(m);
        let posStr = '-';
        if (eq === 'A' || eq === 'D') posStr = 'FROTA 1';
        else if (eq === 'B' || eq === 'E') posStr = 'FROTA 2';
        else if (eq === 'C' || eq === 'F') posStr = 'FOLGUISTA';
        
        let excelTurno = m.turno || '-';
        if (m.turno && m.turno !== '-') {
            let cMatch = window.getCiclos().find(c => c.dbValue === m.turno);
            if (cMatch) excelTurno = (['A','B','C'].includes(eq)) ? cMatch.labelDia : cMatch.labelNoite;
        }

        let linha = `${excelTurno};-;${eq !== '-' ? eq : '-'};${posStr};${m.nome}`;
        for (let dia = 1; dia <= diasNoMes; dia++) {
            const dataAtualStr = `${ano}-${(mes + 1).toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`;
            const escalaDia = window.getEscalaDiaComputada(m, dataAtualStr);
            const valorExibicao = escalaDia.caminhao === 'F' ? 'F' : escalaDia.caminhao;
            linha += `;${valorExibicao}`;
        }
        csvContent += linha + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `Escala_Mensal_${(mes + 1).toString().padStart(2, '0')}_${ano}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

window.gerarRelatorioImpressao = function() {
    const dataStr = document.getElementById('printData').value;
    const turnoFiltro = document.getElementById('printTurno').value;
    
    if (!dataStr) { alert('Selecione uma data para impressão.'); return; }

    const partesData = dataStr.split('-');
    const dataFormatada = `${partesData[2]}/${partesData[1]}/${partesData[0]}`;

    let html = `
    <html>
    <head>
        <title>Escala Diária - ${dataFormatada}</title>
        <style>
            @page { size: A4 portrait; margin: 15mm; }
            body { font-family: Arial, sans-serif; margin: 0; color: #000; font-size: 12px; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            h1 { margin: 0; font-size: 20px; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; text-align: center; margin-bottom: 20px; }
            th, td { border: 1px solid #000; padding: 6px; font-size: 11px; }
            th { background-color: #d1d5db; text-transform: uppercase; }
            .trab { background-color: #d4edda; font-weight: bold; }
            .vazio-row { background-color: #fee2e2; color: #ef4444; }
            .vazio-cell { background-color: #fca5a5; font-weight: bold; color: #7f1d1d;}
            .section-title { font-size: 14px; font-weight: bold; margin-bottom: 10px; background: #eee; padding: 5px; border: 1px solid #000; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Serrana Florestal - Escala Diária</h1>
            <p><strong>Data: ${dataFormatada} | Turno: ${turnoFiltro}</strong></p>
        </div>
    `;

    const motoristasOrd = [...motoristas];
    let motoristasFiltrados = motoristasOrd;
    if (turnoFiltro === 'Dia') {
        motoristasFiltrados = motoristasOrd.filter(m => ['A', 'B', 'C'].includes(window.getEq(m)));
    } else if (turnoFiltro === 'Noite') {
        motoristasFiltrados = motoristasOrd.filter(m => ['D', 'E', 'F'].includes(window.getEq(m)));
    }

    const trabs = [];
    const caminhoesOcupados = [];

    motoristasFiltrados.forEach(m => {
        const eq = window.getEq(m);
        const escala = window.getEscalaDiaComputada(m, dataStr);
        const trinca = m.conjuntoId ? String(m.conjuntoId).padStart(2, '0') : 'S/F';

        if (escala.caminhao !== 'F') {
            let relTurno = m.turno || '-';
            if (m.turno && m.turno !== '-') {
                let cMatch = window.getCiclos().find(c => c.dbValue === m.turno);
                if (cMatch) relTurno = (['A','B','C'].includes(eq)) ? cMatch.labelDia : cMatch.labelNoite;
            }
            trabs.push({ nome: m.nome, trinca: trinca, eq: eq, turno: relTurno, caminhao: escala.caminhao });
            if (escala.caminhao !== 'T' && escala.caminhao !== 'TRAB') caminhoesOcupados.push(escala.caminhao);
        }
    });

    conjuntos.forEach(conj => {
        if (conj.caminhoes) {
            conj.caminhoes.forEach(cam => {
                const placa = typeof cam === 'string' ? cam : cam.placa;
                if (!caminhoesOcupados.includes(placa)) {
                    trabs.push({ nome: '', trinca: String(conj.id).padStart(2, '0'), eq: '-', turno: '-', caminhao: placa });
                }
            });
        }
    });

    trabs.sort((a, b) => {
        const turnoA = a.turno !== '-' && a.turno ? a.turno : '99:99';
        const turnoB = b.turno !== '-' && b.turno ? b.turno : '99:99';
        if (turnoA !== turnoB) return turnoA.localeCompare(turnoB);
        const trincaA = a.trinca === 'S/F' ? 9999 : Number(a.trinca);
        const trincaB = b.trinca === 'S/F' ? 9999 : Number(b.trinca);
        if (trincaA !== trincaB) return trincaA - trincaB;
        if (a.caminhao !== b.caminhao) return a.caminhao.localeCompare(b.caminhao);
        return 0;
    });

    const renderTabela = (lista, titulo) => {
        if (lista.length === 0) return '<p style="text-align:center;">Nenhum registro para exibir.</p>';
        let tHtml = `<div class="section-title">${titulo} (${lista.length} registros)</div>`;
        tHtml += `<table><thead><tr><th style="width: 14%">HORÁRIO</th><th style="width: 10%">CONJUNTO</th><th style="width: 38%">MOTORISTA</th><th style="width: 10%">EQUIPE</th><th style="width: 28%">STATUS / CAMINHÃO</th></tr></thead><tbody>`;
        lista.forEach(l => {
            const isVazio = l.nome === ''; 
            const statusStr = (l.caminhao === 'T' || l.caminhao === 'TRAB') ? 'TRABALHO (SEM CAMINHÃO)' : l.caminhao;
            tHtml += `<tr class="${isVazio ? 'vazio-row' : ''}">
                <td style="font-weight:bold;">${l.turno === '99:99' ? '-' : l.turno}</td>
                <td>${l.trinca}</td>
                <td style="text-align:left; font-weight:bold;">${isVazio ? 'SEM MOTORISTA' : l.nome}</td>
                <td>${l.eq}</td>
                <td class="${isVazio ? 'vazio-cell' : 'trab'}">${statusStr}</td>
            </tr>`;
        });
        tHtml += `</tbody></table>`;
        return tHtml;
    };

    html += renderTabela(trabs, 'RELATÓRIO GERAL (ESCALADOS E CAMINHÕES DISPONÍVEIS)');
    
    html += `<div style="margin-top: 30px; text-align: center; font-size: 10px; color: #555;">Relatório gerado pelo sistema CCOL em ${new Date().toLocaleString('pt-BR')}</div>
        <script>window.onload = function() { window.print(); }</script></body></html>`;
        
    const w = window.open('', '', 'width=900,height=700');
    w.document.write(html);
    w.document.close();
    window.fecharModalImpressao();
};

// ==============================================================
// INTEGRAÇÃO COM RH (LANÇAMENTO DE FALTAS PELA CCOL)
// ==============================================================
window.abrirModalFaltaLogistica = async function() {
    // Garante que a lista de colaboradores está carregada para o select
    if (!window.listaParaSelectColaboradores || window.listaParaSelectColaboradores.length === 0) {
        if (typeof window.carregarListaBaseColaboradores === 'function') {
            const btn = document.getElementById('btnLancarFaltaLogistica');
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Aguarde...';
            await window.carregarListaBaseColaboradores();
            btn.innerHTML = originalHtml;
        }
    }
    
    // Abre o modal na aba "FALTA" usando a função global do absenteismo.js
    if (typeof window.abrirModalAbsenteismo === 'function') {
        window.abrirModalAbsenteismo('FALTA');
    } else {
        alert("Erro: O módulo de Absenteísmo (RH) não está carregado no sistema.");
    }
};