// ==================== modules/campo/escala/escala.js ====================

window.equipeCampo = window.equipeCampo || []; 
window.maquinasCampo = window.maquinasCampo || [];
window.escalasCampoExcecoes = window.escalasCampoExcecoes || {}; 
window.currentDatasCampo = [];

window.calcularEscalaCampoMatematica = function(operador, dateKey) {
    if (!operador.data_ancora) {
        return { statusEscala: 'FOLGA', turno: operador.turno, status: 'fallback' };
    }
    
    const dDate = new Date(dateKey + 'T00:00:00');
    const dAncora = new Date(operador.data_ancora.split('T')[0] + 'T00:00:00');
    
    const utcAncora = Date.UTC(dAncora.getFullYear(), dAncora.getMonth(), dAncora.getDate());
    const utcAtual = Date.UTC(dDate.getFullYear(), dDate.getMonth(), dDate.getDate());
    const diffDays = Math.round((utcAtual - utcAncora) / (1000 * 60 * 60 * 24));
    
    // Ciclo Matemático 6 dias (4x2): 0, 1, 2, 3 = Trabalho | 4, 5 = Folga
    const cycleDay = ((diffDays % 6) + 6) % 6;
    
    let statusTrabalho = 'TRAB';
    
    // Todos descansam no dia 4 e 5 do SEU PRÓPRIO ciclo (definido pela Data Âncora)
    if (cycleDay === 4 || cycleDay === 5) {
        statusTrabalho = 'FOLGA';
    }

    let valorExibicao = 'F';

    if (statusTrabalho === 'TRAB') {
        let maq = window.maquinasCampo.find(m => String(m.id) === String(operador.maquina_id));
        let isFolguistasFrente = maq && maq.nome && maq.nome.toUpperCase().includes('FOLGUISTA');

        if (isFolguistasFrente) {
            // Regra estrita para FOLGUISTAS: 2 dias cobrindo Frente 6, 2 dias cobrindo Frente 5
            let f6 = window.maquinasCampo.find(m => m.nome && m.nome.includes('6'));
            let f5 = window.maquinasCampo.find(m => m.nome && m.nome.includes('5'));
            
            let prefix = '';
            let targetFront = null;
            
            if (cycleDay === 0 || cycleDay === 1) {
                let fnome6 = f6 ? (f6.nome || `F${f6.id}`) : 'F6';
                fnome6 = fnome6.replace(/Frente\s*/i, 'F');
                prefix = `[${fnome6}]`;
                targetFront = f6;
            } else {
                let fnome5 = f5 ? (f5.nome || `F${f5.id}`) : 'F5';
                fnome5 = fnome5.replace(/Frente\s*/i, 'F');
                prefix = `[${fnome5}]`;
                targetFront = f5;
            }

            if (operador.funcao === 'Líder de Campo') {
                valorExibicao = `${prefix}LÍDER`;
            } else {
                let frotaValue = 'RESERVA'; 
                if (targetFront) {
                    if (operador.maquina_especifica === 'Máquina 1' && targetFront.numero_frota_1) frotaValue = targetFront.numero_frota_1;
                    else if (operador.maquina_especifica === 'Máquina 2' && targetFront.numero_frota_2) frotaValue = targetFront.numero_frota_2;
                    else if (operador.maquina_especifica === 'Máquina 3' && targetFront.numero_frota_3) frotaValue = targetFront.numero_frota_3;
                }
                
                if (frotaValue === 'RESERVA') {
                    valorExibicao = `${prefix} RESERVA`;
                } else {
                    valorExibicao = `${prefix}${frotaValue}`;
                }
            }
        } else {
            // Operadores Fixos nas frentes normais
            if (operador.funcao === 'Líder de Campo') {
                valorExibicao = 'LÍDER';
            } else {
                if (maq) {
                    if (operador.maquina_especifica === 'Máquina 1' && maq.numero_frota_1) valorExibicao = maq.numero_frota_1;
                    else if (operador.maquina_especifica === 'Máquina 2' && maq.numero_frota_2) valorExibicao = maq.numero_frota_2;
                    else if (operador.maquina_especifica === 'Máquina 3' && maq.numero_frota_3) valorExibicao = maq.numero_frota_3;
                    else valorExibicao = 'RESERVA';
                } else {
                    valorExibicao = 'RESERVA';
                }
            }
        }
    }

    return { statusEscala: valorExibicao, turno: operador.turno, status: 'auto' };
};

window.getEscalaCampoDiaComputada = function(operador, dateKey) {
    if (window.escalasCampoExcecoes[operador.id] && window.escalasCampoExcecoes[operador.id][dateKey] && window.escalasCampoExcecoes[operador.id][dateKey].status === 'manual') {
        return window.escalasCampoExcecoes[operador.id][dateKey];
    }
    return window.calcularEscalaCampoMatematica(operador, dateKey);
};

window.renderizarEscalaCampo = function() {
    const container = document.getElementById('campoGridEscala');
    if (!container) return;

    if (!window.equipeCampo || window.equipeCampo.length === 0) {
        container.innerHTML = '<p style="padding: 20px; text-align: center;">Nenhum operador registrado na equipe do campo.</p>';
        return;
    }

    const filtroSelect = document.getElementById('campoFiltroFrente');
    if (filtroSelect && filtroSelect.options.length <= 1 && window.maquinasCampo.length > 0) {
        let htmlOpts = '<option value="Todos">Todas as Frentes</option>';
        window.maquinasCampo.forEach(m => { htmlOpts += `<option value="${m.id}">${m.nome || `Frente ${m.id}`}</option>`; });
        filtroSelect.innerHTML = htmlOpts;
    }

    let dataInput = document.getElementById('campoDataEscala').value;
    if (!dataInput) {
        const hj = new Date();
        dataInput = hj.toISOString().split('T')[0];
        document.getElementById('campoDataEscala').value = dataInput;
    }

    const filtroFrente = document.getElementById('campoFiltroFrente').value;
    let dataBase = new Date(dataInput + 'T00:00:00');
    
    let diasRender = [];
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    for(let i = 0; i < 7; i++) {
        let d = new Date(dataBase);
        d.setDate(d.getDate() + i);
        diasRender.push({
            dateKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
            diaNum: String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'),
            diaTexto: diasSemana[d.getDay()]
        });
    }
    window.currentDatasCampo = diasRender;

    let html = '';

    window.maquinasCampo.forEach(frente => {
        if (filtroFrente !== 'Todos' && String(frente.id) !== String(filtroFrente)) return;

        let ops = window.equipeCampo.filter(op => String(op.maquina_id) === String(frente.id));
        if (ops.length === 0) return;

        let isFolguistasFrente = frente.nome && frente.nome.toUpperCase().includes('FOLGUISTA');

        html += `<div style="background: rgba(15, 23, 42, 0.6); border: 1px solid #3b82f6; border-radius: 8px; margin-bottom: 30px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">`;
        html += `<div style="background: #1e293b; padding: 12px 20px; font-size: 1.1rem; font-weight: 800; color: #3b82f6; border-bottom: 2px solid #3b82f6; text-transform: uppercase;">
                      <i class="fas fa-network-wired"></i> ${frente.nome || `Frente ${frente.id}`}
                 </div>`;

        html += `<div style="overflow-x: auto; width: 100%;">`;
        html += `<table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 0.85rem; min-width: 1050px;">`;
        html += `<thead>
                    <tr style="background-color: rgba(0, 0, 0, 0.4); color: #94a3b8; text-transform: uppercase; font-size: 0.75rem;">
                        <th style="padding: 12px 8px; border: 1px solid rgba(255,255,255,0.05); width: 12%;">Máquina / Cargo</th>
                        <th style="padding: 12px 8px; border: 1px solid rgba(255,255,255,0.05); width: 8%;">Regime</th>
                        <th style="padding: 12px 8px; border: 1px solid rgba(255,255,255,0.05); width: 10%;">Turno</th>
                        <th style="padding: 12px 15px; border: 1px solid rgba(255,255,255,0.05); text-align: left; width: 22%;">Operador</th>
                        ${diasRender.map(d => `<th style="padding: 10px 5px; border: 1px solid rgba(255,255,255,0.05); width: 6.8%; color: #cbd5e1;">${d.diaTexto}<br><span style="font-size:0.85rem; font-weight:800; color: #fff;">${d.diaNum}</span></th>`).join('')}
                    </tr>
                 </thead><tbody>`;

        ops.sort((a,b) => {
            if(a.funcao === 'Líder de Campo' && b.funcao !== 'Líder de Campo') return -1;
            if(a.funcao !== 'Líder de Campo' && b.funcao === 'Líder de Campo') return 1;
            
            let maqA = a.maquina_especifica || 'Z';
            let maqB = b.maquina_especifica || 'Z';
            if(maqA !== maqB) return maqA.localeCompare(maqB);
            
            let turnoA = a.turno || '';
            let turnoB = b.turno || '';
            if(turnoA !== turnoB) return turnoA.localeCompare(turnoB);

            let eqA = a.equipe === 'Fixo' ? 1 : 2;
            let eqB = b.equipe === 'Fixo' ? 1 : 2;
            return eqA - eqB;
        });

        ops.forEach(op => {
            let nomeMaqVisual = op.funcao === 'Líder de Campo' ? 'Liderança' : (op.maquina_especifica || 'Sem Máquina');
            
            if (isFolguistasFrente && op.funcao !== 'Líder de Campo') {
                nomeMaqVisual = op.maquina_especifica ? `Cobrir ${op.maquina_especifica} (F6 e F5)` : 'Cobrir F6 e F5';
            } else if (op.equipe === 'Folguista' && op.funcao !== 'Líder de Campo') {
                nomeMaqVisual = 'Cobrir M1 e M2';
            }

            let colorMaq = op.funcao === 'Líder de Campo' ? '#fbbf24' : '#34d399';

            html += `<tr style="background-color: transparent; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;">`;
            html += `<td style="padding: 8px; border: 1px solid rgba(255,255,255,0.05); font-weight: 800; color: ${colorMaq};">${nomeMaqVisual}</td>`;
            html += `<td style="padding: 8px; border: 1px solid rgba(255,255,255,0.05); color: #c084fc; font-weight: bold;">${op.equipe || '-'}</td>`;
            html += `<td style="padding: 8px; border: 1px solid rgba(255,255,255,0.05); color: #38bdf8; font-weight: bold;">${op.turno || '-'}</td>`;
            html += `<td class="td-name" style="padding: 8px 15px; border: 1px solid rgba(255,255,255,0.05); text-align: left; color: #fff; font-weight: 600;">${op.nome}</td>`;
            
            diasRender.forEach(d => {
                const escala = window.getEscalaCampoDiaComputada(op, d.dateKey);
                const isFolga = escala.statusEscala === 'FOLGA' || escala.statusEscala === 'F';
                const isManual = escala.status === 'manual';
                
                let bgCell = isFolga ? 'rgba(249, 115, 22, 0.15)' : 'rgba(16, 185, 129, 0.15)';
                let colorCell = isFolga ? '#fb923c' : '#34d399';
                let borderSide = isFolga ? '1px solid rgba(249, 115, 22, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)';
                
                if (isManual) {
                    bgCell = 'rgba(168, 85, 247, 0.15)';
                    borderSide = '1px solid rgba(168, 85, 247, 0.5)';
                }
                
                let opcoes = `<option value="F" ${isFolga ? 'selected' : ''} style="background: #1e293b; color: #fb923c;">F</option>`;
                
                if (op.funcao === 'Líder de Campo' && !isFolguistasFrente) {
                    opcoes += `<option value="LÍDER" ${escala.statusEscala === 'LÍDER' ? 'selected' : ''} style="background: #1e293b; color: #34d399;">LÍDER</option>`;
                } else {
                    if (isFolguistasFrente) {
                        // Injeta máquinas formatadas com [Frente] para escolha clara do folguista
                        window.maquinasCampo.forEach(mAll => {
                            if (mAll.nome && mAll.nome.toUpperCase().includes('FOLGUISTA')) return; 
                            
                            let fnome = mAll.nome || `F${mAll.id}`;
                            fnome = fnome.replace(/Frente\s*/i, 'F');
                            
                            if (op.funcao === 'Líder de Campo') {
                                let v = `[${fnome}]LÍDER`;
                                opcoes += `<option value="${v}" ${escala.statusEscala === v ? 'selected' : ''} style="background: #1e293b; color: #34d399;">${v}</option>`;
                            } else {
                                if (mAll.numero_frota_1) {
                                    let v = `[${fnome}]${mAll.numero_frota_1}`;
                                    if(!opcoes.includes(`value="${v}"`)) opcoes += `<option value="${v}" ${escala.statusEscala === v ? 'selected' : ''} style="background: #1e293b; color: #34d399;">${v}</option>`;
                                }
                                if (mAll.numero_frota_2) {
                                    let v = `[${fnome}]${mAll.numero_frota_2}`;
                                    if(!opcoes.includes(`value="${v}"`)) opcoes += `<option value="${v}" ${escala.statusEscala === v ? 'selected' : ''} style="background: #1e293b; color: #34d399;">${v}</option>`;
                                }
                                if (mAll.numero_frota_3) {
                                    let v = `[${fnome}]${mAll.numero_frota_3}`;
                                    if(!opcoes.includes(`value="${v}"`)) opcoes += `<option value="${v}" ${escala.statusEscala === v ? 'selected' : ''} style="background: #1e293b; color: #34d399;">${v}</option>`;
                                }
                                let vRes = `[${fnome}] RESERVA`;
                                if(!opcoes.includes(`value="${vRes}"`)) opcoes += `<option value="${vRes}" ${escala.statusEscala === vRes ? 'selected' : ''} style="background: #1e293b; color: #34d399;">${vRes}</option>`;
                            }
                        });
                        
                        opcoes += `<option value="COBERTURA" ${escala.statusEscala === 'COBERTURA' ? 'selected' : ''} style="background: #1e293b; color: #34d399;">COBERTURA</option>`;
                        opcoes += `<option value="TRAB" ${escala.statusEscala === 'TRAB' ? 'selected' : ''} style="background: #1e293b; color: #34d399;">TRAB</option>`;
                    } else {
                        // Opções normais da frente atual
                        if(frente.numero_frota_1) opcoes += `<option value="${frente.numero_frota_1}" ${escala.statusEscala === frente.numero_frota_1 ? 'selected' : ''} style="background: #1e293b; color: #34d399;">${frente.numero_frota_1}</option>`;
                        if(frente.numero_frota_2) opcoes += `<option value="${frente.numero_frota_2}" ${escala.statusEscala === frente.numero_frota_2 ? 'selected' : ''} style="background: #1e293b; color: #34d399;">${frente.numero_frota_2}</option>`;
                        if(frente.numero_frota_3) opcoes += `<option value="${frente.numero_frota_3}" ${escala.statusEscala === frente.numero_frota_3 ? 'selected' : ''} style="background: #1e293b; color: #34d399;">${frente.numero_frota_3}</option>`;
                        opcoes += `<option value="RESERVA" ${escala.statusEscala === 'RESERVA' ? 'selected' : ''} style="background: #1e293b; color: #34d399;">RESERVA</option>`;
                        opcoes += `<option value="TRAB" ${escala.statusEscala === 'TRAB' ? 'selected' : ''} style="background: #1e293b; color: #34d399;">TRAB</option>`;
                    }
                }
                if (isManual) opcoes += `<option value="AUTO" style="background: #0f172a; color: #fbbf24; font-weight: bold;"> Voltar p/ Auto</option>`;

                html += `<td style="padding: 4px; border: 1px solid rgba(255,255,255,0.05); border-left: ${borderSide}; border-right: ${borderSide}; background-color: ${bgCell}; text-align: center;">
                    <select class="select-escala-campo" data-operador="${op.id}" data-data="${d.dateKey}" style="width: 100%; padding: 6px 0; background: transparent; border: none; color: ${colorCell}; font-weight: 800; font-size: 0.85rem; text-align: center; appearance: none; cursor: pointer; outline: none; text-align-last: center;">
                        ${opcoes}
                    </select>
                </td>`;
            });
            html += `</tr>`;
        });
        html += `</tbody></table></div></div>`;
    });

    if(html === '') {
        container.innerHTML = '<p style="padding: 20px; text-align: center; color: #94a3b8;">Nenhum dado encontrado para os filtros selecionados.</p>';
    } else {
        container.innerHTML = html;
        document.querySelectorAll('.select-escala-campo').forEach(select => select.addEventListener('change', handleEscalaCampoChange));
    }
};

window.atualizarEscalaCampo = function() { window.renderizarEscalaCampo(); };

async function handleEscalaCampoChange(e) {
    const select = e.target;
    const operadorIdStr = String(select.dataset.operador); 
    const data = select.dataset.data;
    const novoStatusEscala = select.value;
    
    const op = window.equipeCampo.find(o => String(o.id) === operadorIdStr);
    if(op) {
        const idExcecao = String(`${op.id}_${data}`);
        
        if (novoStatusEscala === 'AUTO') {
            try {
                if (typeof db !== 'undefined' && db.deleteEscalaCampo) await db.deleteEscalaCampo(idExcecao);
                if (window.escalasCampoExcecoes[op.id]) delete window.escalasCampoExcecoes[op.id][data];
                window.renderizarEscalaCampo(); 
            } catch (err) { console.error(err); }
            return;
        }

        try {
            if (typeof db !== 'undefined' && db.upsertEscalaCampo) {
                await db.upsertEscalaCampo({ id: idExcecao, operador_id: Number(op.id), data: data, turno: op.turno, frente: novoStatusEscala, status: 'manual' });
            }
            if (!window.escalasCampoExcecoes[op.id]) window.escalasCampoExcecoes[op.id] = {};
            window.escalasCampoExcecoes[op.id][data] = { turno: op.turno, statusEscala: novoStatusEscala, status: 'manual' };
            window.renderizarEscalaCampo(); 
        } catch (error) { console.error(error); }
    }
}

window.abrirModalImpressaoCampo = function() {
    const hoje = new Date();
    document.getElementById('printDataCampo').value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    document.getElementById('modalImpressaoCampo').style.display = 'flex';
};

window.fecharModalImpressaoCampo = function() { document.getElementById('modalImpressaoCampo').style.display = 'none'; };

window.imprimirRelatorioEscalaSemanalCampo = function() {
    if (!window.currentDatasCampo || window.currentDatasCampo.length === 0) return alert("Nenhuma escala visível.");
    let html = `<html><head><title>Escala Semanal (4x2)</title><style>@page { size: A4 landscape; margin: 10mm; } body { font-family: Arial; font-size: 11px; } .header { text-align: center; border-bottom: 2px solid #000; margin-bottom: 15px; } h1 { margin: 0; font-size: 18px; } table { width: 100%; border-collapse: collapse; text-align: center; } th, td { border: 1px solid #000; padding: 4px; font-size: 10px; } th { background-color: #d1d5db; } .f { background-color: #f8d7da; font-weight: bold; } .t { background-color: #d4edda; font-weight: bold; }</style></head><body>`;
    html += `<div class="header"><h1>Escala Semanal - 4 Operadores por Máquina</h1></div>`;
    
    window.maquinasCampo.forEach(maq => {
        let ops = window.equipeCampo.filter(op => String(op.maquina_id) === String(maq.id));
        if (ops.length === 0) return;
        
        let isFolguistasFrente = maq.nome && maq.nome.toUpperCase().includes('FOLGUISTA');

        html += `<h3>${maq.nome || `Frente ${maq.id}`}</h3><table><thead><tr><th style="width:12%;">Máquina/Liderança</th><th style="width:10%;">Regime</th><th style="width:10%;">Turno</th><th style="text-align:left;">Nome</th>${window.currentDatasCampo.map(d => `<th style="width:7%;">${d.diaTexto}<br>${d.diaNum}</th>`).join('')}</tr></thead><tbody>`;
        
        ops.sort((a,b) => {
            if(a.funcao === 'Líder de Campo' && b.funcao !== 'Líder de Campo') return -1;
            if(a.funcao !== 'Líder de Campo' && b.funcao === 'Líder de Campo') return 1;
            
            let maqA = a.maquina_especifica || 'Z';
            let maqB = b.maquina_especifica || 'Z';
            if(maqA !== maqB) return maqA.localeCompare(maqB);
            
            let eqA = a.equipe === 'Fixo' ? 1 : 2;
            let eqB = b.equipe === 'Fixo' ? 1 : 2;
            return eqA - eqB;
        });
        
        ops.forEach(op => {
            let nomeMaqVisual = op.funcao === 'Líder de Campo' ? 'Líder' : (op.maquina_especifica || 'Sem Máquina');
            if (isFolguistasFrente && op.funcao !== 'Líder de Campo') {
                nomeMaqVisual = op.maquina_especifica ? `Cobrir ${op.maquina_especifica} (F6 e F5)` : 'Cobrir F6 e F5';
            } else if (op.equipe === 'Folguista' && op.funcao !== 'Líder de Campo' && !isFolguistasFrente) {
                nomeMaqVisual = 'Cobrir M1/M2';
            }

            html += `<tr><td>${nomeMaqVisual}</td><td>${op.equipe||'-'}</td><td>${op.turno||'-'}</td><td style="text-align:left;"><b>${op.nome}</b></td>`;
            window.currentDatasCampo.forEach(d => {
                const esc = window.getEscalaCampoDiaComputada(op, d.dateKey);
                const isF = esc.statusEscala === 'FOLGA' || esc.statusEscala === 'F';
                html += `<td class="${isF ? 'f' : 't'}">${isF ? 'F' : esc.statusEscala}</td>`;
            });
            html += `</tr>`;
        });
        html += `</tbody></table>`;
    });
    html += `<script>window.print();</script></body></html>`;
    const w = window.open('', '', 'width=1200,height=800'); w.document.write(html); w.document.close();
};

window.exportarEscalaCampoExcel = function() {
    const inputData = document.getElementById('campoDataEscala');
    let dataBase = inputData && inputData.value ? new Date(inputData.value + 'T00:00:00') : new Date();
    const ano = dataBase.getFullYear(), mes = dataBase.getMonth(), diasNoMes = new Date(ano, mes + 1, 0).getDate(); 
    let csvContent = "\uFEFFFrente;Máquina;Turno;Regime;Operador";
    for (let dia = 1; dia <= diasNoMes; dia++) csvContent += `;${dia.toString().padStart(2, '0')}/${(mes + 1).toString().padStart(2, '0')}`;
    csvContent += "\n";
    
    // Organiza por Frente e depois Lider no topo
    let excelOps = [...window.equipeCampo];
    excelOps.sort((a,b) => {
        if(a.maquina_id !== b.maquina_id) return (a.maquina_id || 0) - (b.maquina_id || 0);
        if(a.funcao === 'Líder de Campo' && b.funcao !== 'Líder de Campo') return -1;
        if(a.funcao !== 'Líder de Campo' && b.funcao === 'Líder de Campo') return 1;
        
        let maqA = a.maquina_especifica || 'Z';
        let maqB = b.maquina_especifica || 'Z';
        if(maqA !== maqB) return maqA.localeCompare(maqB);
        
        let eqA = a.equipe === 'Fixo' ? 1 : 2;
        let eqB = b.equipe === 'Fixo' ? 1 : 2;
        return eqA - eqB;
    });

    excelOps.forEach(op => {
        let nomeFrente = "Reserva", mq = window.maquinasCampo.find(m => String(m.id) === String(op.maquina_id));
        let isFolguistasFrente = false;
        if(mq) {
            nomeFrente = mq.nome || `Frente ${mq.id}`;
            if (mq.nome && mq.nome.toUpperCase().includes('FOLGUISTA')) isFolguistasFrente = true;
        }
        
        let nomeMaqVisual = op.funcao === 'Líder de Campo' ? 'Líder' : (op.maquina_especifica || 'Sem Máquina');
        if (isFolguistasFrente && op.funcao !== 'Líder de Campo') {
            nomeMaqVisual = op.maquina_especifica ? `Cobrir ${op.maquina_especifica} (F6 e F5)` : 'Cobrir F6 e F5';
        } else if (op.equipe === 'Folguista' && op.funcao !== 'Líder de Campo' && !isFolguistasFrente) {
            nomeMaqVisual = 'Cobrir M1/M2';
        }

        let linha = `${nomeFrente};${nomeMaqVisual};${op.turno||'-'};${op.equipe||'-'};${op.nome}`;
        for (let dia = 1; dia <= diasNoMes; dia++) {
            const dStr = `${ano}-${(mes + 1).toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`;
            const esc = window.getEscalaCampoDiaComputada(op, dStr);
            linha += `;${(esc.statusEscala === 'FOLGA' || esc.statusEscala === 'F') ? 'F' : esc.statusEscala}`;
        }
        csvContent += linha + "\n";
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `Escala_Campo_${ano}_${mes+1}.csv`; document.body.appendChild(link); link.click(); document.body.removeChild(link);
};

window.gerarRelatorioImpressaoCampo = function() {
    const dStr = document.getElementById('printDataCampo').value;
    if (!dStr) return alert('Selecione uma data.');
    const dForm = `${dStr.split('-')[2]}/${dStr.split('-')[1]}/${dStr.split('-')[0]}`;
    let html = `<html><head><title>Escala Diária Campo</title><style>@page { size: A4 portrait; margin: 15mm; } body { font-family: Arial; font-size: 12px; } .header { text-align: center; border-bottom: 2px solid #000; margin-bottom: 20px; } table { width: 100%; border-collapse: collapse; text-align: center; } th, td { border: 1px solid #000; padding: 6px; } th { background-color: #d1d5db; } .t { background-color: #d4edda; font-weight: bold; }</style></head><body>`;
    html += `<div class="header"><h1>Diária Campo - ${dForm}</h1></div>`;
    const trabs = [];
    window.equipeCampo.forEach(op => {
        const esc = window.getEscalaCampoDiaComputada(op, dStr);
        if (esc.statusEscala !== 'FOLGA' && esc.statusEscala !== 'F') {
            let m = window.maquinasCampo.find(x => String(x.id) === String(op.maquina_id));
            let isFolguistasFrente = false;
            let nFront = "Reserva";
            if (m) {
                nFront = m.nome;
                if (m.nome && m.nome.toUpperCase().includes('FOLGUISTA')) isFolguistasFrente = true;
            }

            let nomeMaqVisual = op.funcao === 'Líder de Campo' ? 'Líder' : (op.maquina_especifica || 'Sem Máquina');
            if (isFolguistasFrente && op.funcao !== 'Líder de Campo') {
                nomeMaqVisual = op.maquina_especifica ? `Cobrir ${op.maquina_especifica} (F6 e F5)` : 'Cobrir F6 e F5';
            } else if (op.equipe === 'Folguista' && op.funcao !== 'Líder de Campo' && !isFolguistasFrente) {
                nomeMaqVisual = 'Cobrir M1/M2';
            }

            trabs.push({ n: op.nome, f: nFront, m: nomeMaqVisual, t: op.turno||'-', v: esc.statusEscala });
        }
    });
    if (trabs.length === 0) html += '<p>Ninguém escalado.</p>';
    else {
        html += `<table><thead><tr><th>Frente</th><th>Máquina/Líder</th><th>Turno</th><th style="text-align:left;">Operador</th><th>Alocação</th></tr></thead><tbody>`;
        trabs.sort((a,b) => a.f.localeCompare(b.f) || a.m.localeCompare(b.m)).forEach(l => {
            html += `<tr><td>${l.f}</td><td>${l.m}</td><td>${l.t}</td><td style="text-align:left;"><b>${l.n}</b></td><td class="t">${l.v}</td></tr>`;
        });
        html += `</tbody></table>`;
    }
    html += `<script>window.onload = function() { window.print(); }</script></body></html>`;
    const w = window.open('', '', 'width=900,height=700'); w.document.write(html); w.document.close();
    window.fecharModalImpressaoCampo();
};