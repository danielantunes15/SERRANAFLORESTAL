// ==================== modules/campo/escala/escala.js ====================

window.equipeCampo = window.equipeCampo || []; 
window.maquinasCampo = window.maquinasCampo || [];
window.escalasCampoExcecoes = window.escalasCampoExcecoes || {}; 
window.currentDatasCampo = [];
window._dadosEscalaCarregados = false; 

function obterFilialIdAtualEscala() {
    return (window.currentUser && window.currentUser.filial_id && window.currentUser.filial_id !== 'CENTRAL')
        ? parseInt(window.currentUser.filial_id)
        : null;
}

window.buscarFuncoesConfiguradasDB = async function() {
    if (typeof window.supabaseClient === 'undefined') return ['OPERADOR MANTENEDOR', 'Líder de Campo'];
    try {
        const filialId = obterFilialIdAtualEscala();
        let query = window.supabaseClient.from('campo_config_escala').select('funcoes_selecionadas');

        if (filialId !== null) {
            query = query.eq('filial_id', filialId);
        } else {
            query = query.is('filial_id', null);
        }

        const { data, error } = await query.maybeSingle();
        if (!error && data && data.funcoes_selecionadas && Array.isArray(data.funcoes_selecionadas)) {
            return data.funcoes_selecionadas;
        }
    } catch (e) {
        console.warn("Consulta campo_config_escala falhou, usando fallback:", e);
    }
    return window.funcoesSelecionadasEscala || ['OPERADOR MANTENEDOR', 'Líder de Campo'];
};

// =======================================================
// 1. CARREGAR DADOS DO BANCO (SOBREVIVE AO RECARREGAMENTO)
// =======================================================
window.carregarDadosEscalaCampo = async function() {
    if (typeof window.supabaseClient === 'undefined') return;

    const container = document.getElementById('campoGridEscala');
    if (!container) return; 

    try {
        container.innerHTML = '<p class="loading-text" style="padding: 20px; text-align: center; color: #fff;"><i class="fas fa-spinner fa-spin"></i> Carregando dados da escala...</p>';

        let queryMaquinas = window.supabaseClient.from('maquinas_campo').select('*').order('id');
        if (typeof window.aplicarFiltroFilial === 'function') {
            queryMaquinas = window.aplicarFiltroFilial(queryMaquinas);
        } else if (window.currentUser && window.currentUser.filial_id) {
            queryMaquinas = queryMaquinas.eq('filial_id', window.currentUser.filial_id);
        }
        const pMaquinas = queryMaquinas;

        const funcoesAtuais = await window.buscarFuncoesConfiguradasDB();
        window.funcoesSelecionadasEscala = funcoesAtuais; // Sincroniza a memória local da escala

        let queryEquipe = window.supabaseClient.from('rh_colaboradores')
            .select('*')
            .in('funcao', funcoesAtuais)
            .order('nome');

        if (typeof window.aplicarFiltroFilial === 'function') {
            queryEquipe = window.aplicarFiltroFilial(queryEquipe);
        } else if (window.currentUser && window.currentUser.filial_id) {
            queryEquipe = queryEquipe.eq('filial_id', window.currentUser.filial_id);
        }

        const [resMaquinas, resEquipe] = await Promise.all([pMaquinas, queryEquipe]);

        window.maquinasCampo = resMaquinas.data || [];
        window.equipeCampo = resEquipe.data || [];

        await window.carregarExcecoesEscalaCampo();
        
        window._dadosEscalaCarregados = true;
        window.renderizarEscalaCampo();

    } catch (error) {
        console.error("Erro ao carregar dados da escala:", error);
        container.innerHTML = '<p style="color:#ef4444; text-align:center;">Erro ao carregar os dados do banco.</p>';
    }
};

// ==========================================
// 2. MATEMÁTICA DE CICLOS DINÂMICOS
// ==========================================
window.calcularEscalaCampoMatematica = function(operador, dateKey) {
    if (!operador.data_ancora) {
        return { statusEscala: 'FOLGA', turno: operador.turno, status: 'fallback' };
    }
    
    const dDate = new Date(dateKey + 'T00:00:00');
    const dAncora = new Date(operador.data_ancora.split('T')[0] + 'T00:00:00');
    
    const utcAncora = Date.UTC(dAncora.getFullYear(), dAncora.getMonth(), dAncora.getDate());
    const utcAtual = Date.UTC(dDate.getFullYear(), dDate.getMonth(), dDate.getDate());
    const diffDays = Math.round((utcAtual - utcAncora) / (1000 * 60 * 60 * 24));
    
    let cicloTotal = 6;     
    let diasTrabalho = 4;
    
    if (operador.tipo_escala === '4x4') { cicloTotal = 8; diasTrabalho = 4; }
    else if (operador.tipo_escala === '5x2') { cicloTotal = 7; diasTrabalho = 5; }
    else if (operador.tipo_escala === '6x1') { cicloTotal = 7; diasTrabalho = 6; }
    
    const cycleDay = ((diffDays % cicloTotal) + cicloTotal) % cicloTotal;
    
    let statusTrabalho = 'TRAB';
    if (cycleDay >= diasTrabalho) {
        statusTrabalho = 'FOLGA';
    }

    let valorExibicao = 'F';

    if (statusTrabalho === 'TRAB') {
        let maq = window.maquinasCampo.find(m => String(m.id) === String(operador.maquina_id));
        let isFolguistasFrente = maq && maq.nome && maq.nome.toUpperCase().includes('FOLGUISTA');

        if (isFolguistasFrente) {
            let f6 = window.maquinasCampo.find(m => m.nome && m.nome.includes('6'));
            let f5 = window.maquinasCampo.find(m => m.nome && m.nome.includes('5'));
            
            let prefix = '';
            let targetFront = null;
            let meioCiclo = Math.floor(diasTrabalho / 2);

            if (cycleDay < meioCiclo) {
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

// =========================================================================
// NOVO: MATRIZ DE ESCALA (APLICA LÓGICA DO FOLGUISTA ASSUMINDO A FROTA)
// =========================================================================
window.calcularMatrizEscala = function(equipeArr, maquinasArr, dateStrs) {
    let matriz = {};
    
    // Passo 1: Calcula a escala base individual 
    equipeArr.forEach(op => {
        matriz[op.id] = {};
        dateStrs.forEach(dStr => {
            matriz[op.id][dStr] = { ...window.getEscalaCampoDiaComputada(op, dStr) };
        });
    });

    // Passo 2: Mapeamento de Folguistas assumindo a frota dos Fixos de folga
    maquinasArr.forEach(maq => {
        let membrosFrente = equipeArr.filter(op => String(op.maquina_id) === String(maq.id));
        let funcoesUnicas = [...new Set(membrosFrente.map(op => op.funcao))];
        
        funcoesUnicas.forEach(funcao => {
            let ops = membrosFrente.filter(op => op.funcao === funcao);
            
            dateStrs.forEach(dStr => {
                let fixosOff = ops.filter(op => op.equipe === 'Fixo' && (matriz[op.id][dStr].statusEscala === 'FOLGA' || matriz[op.id][dStr].statusEscala === 'F'));
                let folguistasOn = ops.filter(op => op.equipe === 'Folguista' && matriz[op.id][dStr].statusEscala !== 'FOLGA' && matriz[op.id][dStr].statusEscala !== 'F' && matriz[op.id][dStr].status === 'auto');

                if (fixosOff.length > 0 && folguistasOn.length > 0) {
                    let placasDisponiveis = fixosOff.map(fOp => {
                        let placa = 'RESERVA';
                        if (fOp.maquina_especifica === 'Máquina 1' && maq.numero_frota_1) placa = maq.numero_frota_1;
                        else if (fOp.maquina_especifica === 'Máquina 2' && maq.numero_frota_2) placa = maq.numero_frota_2;
                        else if (fOp.maquina_especifica === 'Máquina 3' && maq.numero_frota_3) placa = maq.numero_frota_3;
                        return placa;
                    }).filter(p => p !== 'RESERVA');

                    // Atribui a placa do Fixo para o Folguista
                    folguistasOn.forEach((folguista, idx) => {
                        if (placasDisponiveis[idx]) {
                            matriz[folguista.id][dStr].statusEscala = placasDisponiveis[idx];
                        }
                    });
                }
            });
        });
    });
    
    return matriz;
};

// ==========================================
// 3. RENDERIZAÇÃO DA TABELA 
// ==========================================
window.renderizarEscalaCampo = function() {
    const container = document.getElementById('campoGridEscala');
    if (!container) return;

    if (!window._dadosEscalaCarregados) {
        window.carregarDadosEscalaCampo();
        return;
    }

    if (!window.equipeCampo || window.equipeCampo.length === 0) {
        container.innerHTML = '<p style="padding: 20px; text-align: center; color:#94a3b8;">Nenhum operador do campo localizado nesta filial.</p>';
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
    const dateStrs = diasRender.map(d => d.dateKey);
    const matrizEscala = window.calcularMatrizEscala(window.equipeCampo, window.maquinasCampo, dateStrs);

    let html = '';

    window.maquinasCampo.forEach(frente => {
        if (filtroFrente !== 'Todos' && String(frente.id) !== String(filtroFrente)) return;
        
        let membrosFrente = window.equipeCampo.filter(op => String(op.maquina_id) === String(frente.id));
        if (membrosFrente.length === 0) return;

        let isFolguistasFrente = frente.nome && frente.nome.toUpperCase().includes('FOLGUISTA');

        html += `<div style="background: rgba(15, 23, 42, 0.6); border: 1px solid #3b82f6; border-radius: 8px; margin-bottom: 30px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">`;
        html += `<div style="background: #1e293b; padding: 12px 20px; font-size: 1.1rem; font-weight: 800; color: #3b82f6; border-bottom: 2px solid #3b82f6; text-transform: uppercase;">
                      <i class="fas fa-network-wired"></i> ${frente.nome || `Frente ${frente.id}`}
                 </div>`;

        window.funcoesSelecionadasEscala.forEach(funcaoNome => {
            const ops = membrosFrente.filter(op => op.funcao === funcaoNome);
            if(ops.length === 0) return;

            let colorBase = '#34d399'; let iconBase = 'fa-user-cog';
            if(funcaoNome === 'Líder de Campo') { colorBase = '#fbbf24'; iconBase = 'fa-crown'; } 
            else if (funcaoNome === 'Motorista') { colorBase = '#60a5fa'; iconBase = 'fa-truck'; } 
            else if (funcaoNome === 'Mecânico' || funcaoNome === 'Borracheiro') { colorBase = '#a855f7'; iconBase = 'fa-tools'; }

            html += `<div style="background: rgba(0,0,0,0.3); padding: 8px 20px; font-size: 0.95rem; font-weight: 700; color: ${colorBase}; border-bottom: 1px solid rgba(255,255,255,0.05); border-top: 1px solid rgba(255,255,255,0.05);">
                        <i class="fas ${iconBase}"></i> Função: ${funcaoNome}
                     </div>`;
                     
            html += `<div style="overflow-x: auto; width: 100%;">`;
            html += `<table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 0.85rem; min-width: 1050px;">`;
            html += `<thead>
                        <tr style="background-color: rgba(0, 0, 0, 0.4); color: #94a3b8; text-transform: uppercase; font-size: 0.75rem;">
                            <th style="padding: 12px 8px; border: 1px solid rgba(255,255,255,0.05); width: 10%;">Máquina / Cargo</th>
                            <th style="padding: 12px 8px; border: 1px solid rgba(255,255,255,0.05); width: 6%;">Ciclo</th>
                            <th style="padding: 12px 8px; border: 1px solid rgba(255,255,255,0.05); width: 6%;">Papel</th>
                            <th style="padding: 12px 8px; border: 1px solid rgba(255,255,255,0.05); width: 8%;">Turno</th>
                            <th style="padding: 12px 15px; border: 1px solid rgba(255,255,255,0.05); text-align: left; width: 22%;">Operador</th>
                            ${diasRender.map(d => `<th style="padding: 10px 5px; border: 1px solid rgba(255,255,255,0.05); width: 6.8%; color: #cbd5e1;">${d.diaTexto}<br><span style="font-size:0.85rem; font-weight:800; color: #fff;">${d.diaNum}</span></th>`).join('')}
                        </tr>
                     </thead><tbody>`;

            ops.sort((a,b) => {
                let maqA = a.maquina_especifica || 'Z'; let maqB = b.maquina_especifica || 'Z';
                if(maqA !== maqB) return maqA.localeCompare(maqB);
                let turnoA = a.turno || ''; let turnoB = b.turno || '';
                if(turnoA !== turnoB) return turnoA.localeCompare(turnoB);
                let eqA = a.equipe === 'Fixo' ? 1 : 2; let eqB = b.equipe === 'Fixo' ? 1 : 2;
                return eqA - eqB;
            });

            ops.forEach(op => {
                let nomeMaqVisual = op.funcao === 'Líder de Campo' ? 'Liderança' : (op.maquina_especifica || 'Sem Máquina');
                if (isFolguistasFrente && op.funcao !== 'Líder de Campo') { nomeMaqVisual = op.maquina_especifica ? `Cobrir ${op.maquina_especifica} (F6 e F5)` : 'Cobrir F6 e F5'; } 
                else if (op.equipe === 'Folguista' && op.funcao !== 'Líder de Campo') { nomeMaqVisual = 'Cobrir M1 e M2'; }

                let colorMaq = op.funcao === 'Líder de Campo' ? '#fbbf24' : '#34d399';

                html += `<tr style="background-color: transparent; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;">`;
                html += `<td style="padding: 8px; border: 1px solid rgba(255,255,255,0.05); font-weight: 800; color: ${colorMaq};">${nomeMaqVisual}</td>`;
                html += `<td style="padding: 8px; border: 1px solid rgba(255,255,255,0.05); color: #f59e0b; font-weight: bold;">${op.tipo_escala || '4x2'}</td>`;
                html += `<td style="padding: 8px; border: 1px solid rgba(255,255,255,0.05); color: #c084fc; font-weight: bold;">${op.equipe || '-'}</td>`;
                html += `<td style="padding: 8px; border: 1px solid rgba(255,255,255,0.05); color: #38bdf8; font-weight: bold;">${op.turno || '-'}</td>`;
                html += `<td class="td-name" style="padding: 8px 15px; border: 1px solid rgba(255,255,255,0.05); text-align: left; color: #fff; font-weight: 600;">${op.nome}</td>`;
                
                diasRender.forEach(d => {
                    const escala = matrizEscala[op.id][d.dateKey];
                    const isFolga = escala.statusEscala === 'FOLGA' || escala.statusEscala === 'F';
                    const isManual = escala.status === 'manual';
                    
                    let bgCell = isFolga ? 'rgba(249, 115, 22, 0.15)' : 'rgba(16, 185, 129, 0.15)';
                    let colorCell = isFolga ? '#fb923c' : '#34d399';
                    let borderSide = isFolga ? '1px solid rgba(249, 115, 22, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)';
                    if (isManual) { bgCell = 'rgba(168, 85, 247, 0.15)'; borderSide = '1px solid rgba(168, 85, 247, 0.5)'; }
                    
                    let opcoes = `<option value="F" ${isFolga ? 'selected' : ''} style="background: #1e293b; color: #fb923c;">F</option>`;
                    
                    if (op.funcao === 'Líder de Campo' && !isFolguistasFrente) {
                        opcoes += `<option value="LÍDER" ${escala.statusEscala === 'LÍDER' ? 'selected' : ''} style="background: #1e293b; color: #34d399;">LÍDER</option>`;
                    } else {
                        if (isFolguistasFrente) {
                            window.maquinasCampo.forEach(mAll => {
                                if (mAll.nome && mAll.nome.toUpperCase().includes('FOLGUISTA')) return;
                                let fnome = mAll.nome || `F${mAll.id}`; fnome = fnome.replace(/Frente\s*/i, 'F');
                                
                                if (op.funcao === 'Líder de Campo') {
                                    let v = `[${fnome}]LÍDER`;
                                    opcoes += `<option value="${v}" ${escala.statusEscala === v ? 'selected' : ''} style="background: #1e293b; color: #34d399;">${v}</option>`;
                                } else {
                                    if (mAll.numero_frota_1) { let v = `[${fnome}]${mAll.numero_frota_1}`; if(!opcoes.includes(`value="${v}"`)) opcoes += `<option value="${v}" ${escala.statusEscala === v ? 'selected' : ''} style="background: #1e293b; color: #34d399;">${v}</option>`; }
                                    if (mAll.numero_frota_2) { let v = `[${fnome}]${mAll.numero_frota_2}`; if(!opcoes.includes(`value="${v}"`)) opcoes += `<option value="${v}" ${escala.statusEscala === v ? 'selected' : ''} style="background: #1e293b; color: #34d399;">${v}</option>`; }
                                    if (mAll.numero_frota_3) { let v = `[${fnome}]${mAll.numero_frota_3}`; if(!opcoes.includes(`value="${v}"`)) opcoes += `<option value="${v}" ${escala.statusEscala === v ? 'selected' : ''} style="background: #1e293b; color: #34d399;">${v}</option>`; }
                                    let vRes = `[${fnome}] RESERVA`;
                                    if(!opcoes.includes(`value="${vRes}"`)) opcoes += `<option value="${vRes}" ${escala.statusEscala === vRes ? 'selected' : ''} style="background: #1e293b; color: #34d399;">${vRes}</option>`;
                                }
                            });
                            opcoes += `<option value="COBERTURA" ${escala.statusEscala === 'COBERTURA' ? 'selected' : ''} style="background: #1e293b; color: #34d399;">COBERTURA</option>`;
                            opcoes += `<option value="TRAB" ${escala.statusEscala === 'TRAB' ? 'selected' : ''} style="background: #1e293b; color: #34d399;">TRAB</option>`;
                        } else {
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
            html += `</tbody></table></div>`;
        });
        html += `</div>`;
    });

    if(html === '') {
        container.innerHTML = '<p style="padding: 20px; text-align: center; color: #94a3b8;">Nenhum dado encontrado para os filtros selecionados.</p>';
    } else {
        container.innerHTML = html;
        document.querySelectorAll('.select-escala-campo').forEach(select => select.addEventListener('change', handleEscalaCampoChange));
    }
};

window.atualizarEscalaCampo = async function() { 
    window._dadosEscalaCarregados = false;
    await window.carregarDadosEscalaCampo();
};

// ==========================================
// 4. TABELA ESCALA_CAMPO (EXCEÇÕES MANUAIS)
// ==========================================
window.carregarExcecoesEscalaCampo = async function() {
    if (typeof window.supabaseClient === 'undefined') return;
    try {
        let query = window.supabaseClient.from('escala_campo').select('*');
        
        if (typeof window.aplicarFiltroFilial === 'function') {
            query = window.aplicarFiltroFilial(query);
        } else if (window.currentUser && window.currentUser.filial_id) {
            query = query.eq('filial_id', window.currentUser.filial_id);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        window.escalasCampoExcecoes = {};
        (data || []).forEach(e => {
            if (!window.escalasCampoExcecoes[e.operador_id]) {
                window.escalasCampoExcecoes[e.operador_id] = {};
            }
            window.escalasCampoExcecoes[e.operador_id][e.data] = { 
                turno: e.turno, 
                statusEscala: e.frente, 
                status: e.status 
            };
        });
    } catch (e) {
        console.error("Erro ao carregar exceções da escala:", e);
    }
};

async function handleEscalaCampoChange(e) {
    const select = e.target;
    const operadorIdStr = String(select.dataset.operador); 
    const data = select.dataset.data;
    const novoStatusEscala = select.value;
    
    const op = window.equipeCampo.find(o => String(o.id) === operadorIdStr);
    
    if(op) {
        const idExcecao = `${op.id}_${data}`; 
        
        if (novoStatusEscala === 'AUTO') {
            try {
                await window.supabaseClient.from('escala_campo').delete().eq('id', idExcecao);
                if (window.escalasCampoExcecoes[op.id]) delete window.escalasCampoExcecoes[op.id][data];
                
                window.renderizarEscalaCampo(); 
            } catch (err) { 
                console.error(err); 
                alert("Erro ao remover alteração manual.");
            }
            return;
        }

        try {
            let payload = { 
                id: idExcecao, 
                operador_id: op.id, 
                data: data, 
                turno: op.turno, 
                frente: novoStatusEscala, 
                status: 'manual' 
            };
            
            if (typeof window.injetarFilial === 'function') {
                payload = window.injetarFilial(payload);
            } else if (window.currentUser && window.currentUser.filial_id) {
                payload.filial_id = window.currentUser.filial_id;
            }
            
            const { error } = await window.supabaseClient.from('escala_campo').upsert([payload]);
            if (error) throw error;
            
            if (!window.escalasCampoExcecoes[op.id]) window.escalasCampoExcecoes[op.id] = {};
            window.escalasCampoExcecoes[op.id][data] = { 
                turno: op.turno, 
                statusEscala: novoStatusEscala, 
                status: 'manual' 
            };
            
            window.renderizarEscalaCampo(); 
        } catch (error) { 
            console.error(error); 
            alert('Falha ao salvar a alteração no banco de dados.');
        }
    }
}

// ==========================================
// 5. EXPORTAÇÃO E IMPRESSÃO
// ==========================================
window.abrirModalImpressaoCampo = function() {
    const hoje = new Date();
    document.getElementById('printDataCampo').value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    document.getElementById('modalImpressaoCampo').style.display = 'flex';
};

window.fecharModalImpressaoCampo = function() { document.getElementById('modalImpressaoCampo').style.display = 'none'; };

window.imprimirRelatorioEscalaSemanalCampo = function() {
    if (!window.currentDatasCampo || window.currentDatasCampo.length === 0) return alert("Nenhuma escala visível.");
    let html = `<html><head><title>Escala Semanal Dinâmica</title><style>@page { size: A4 landscape; margin: 10mm; } body { font-family: Arial; font-size: 11px; } .header { text-align: center; border-bottom: 2px solid #000; margin-bottom: 15px; } h1 { margin: 0; font-size: 18px; } table { width: 100%; border-collapse: collapse; text-align: center; } th, td { border: 1px solid #000; padding: 4px; font-size: 10px; } th { background-color: #d1d5db; } .f { background-color: #f8d7da; font-weight: bold; } .t { background-color: #d4edda; font-weight: bold; }</style></head><body>`;
    html += `<div class="header"><h1>Escala Semanal de Frentes e Colaboradores</h1></div>`;
    
    const dateStrs = window.currentDatasCampo.map(d => d.dateKey);
    const matrizEscala = window.calcularMatrizEscala(window.equipeCampo, window.maquinasCampo, dateStrs);

    window.maquinasCampo.forEach(maq => {
        let membrosFrente = window.equipeCampo.filter(op => String(op.maquina_id) === String(maq.id));
        if (membrosFrente.length === 0) return;
        let isFolguistasFrente = maq.nome && maq.nome.toUpperCase().includes('FOLGUISTA');
        
        let hasAny = false;
        window.funcoesSelecionadasEscala.forEach(funcaoNome => {
            if (membrosFrente.some(op => op.funcao === funcaoNome)) hasAny = true;
        });
        if (!hasAny) return;

        html += `<h3>${maq.nome || `Frente ${maq.id}`}</h3>`;
        
        window.funcoesSelecionadasEscala.forEach(funcaoNome => {
            let ops = membrosFrente.filter(op => op.funcao === funcaoNome);
            if (ops.length === 0) return;
            
            html += `<h4 style="margin:5px 0;">Função: ${funcaoNome}</h4><table><thead><tr><th style="width:12%;">Máquina/Liderança</th><th style="width:8%;">Ciclo</th><th style="width:8%;">Regime</th><th style="width:8%;">Turno</th><th style="text-align:left;">Nome</th>${window.currentDatasCampo.map(d => `<th style="width:7%;">${d.diaTexto}<br>${d.diaNum}</th>`).join('')}</tr></thead><tbody>`;
            ops.sort((a,b) => {
                let maqA = a.maquina_especifica || 'Z'; let maqB = b.maquina_especifica || 'Z';
                if(maqA !== maqB) return maqA.localeCompare(maqB);
                let turnoA = a.turno || ''; let turnoB = b.turno || '';
                if(turnoA !== turnoB) return turnoA.localeCompare(turnoB);
                let eqA = a.equipe === 'Fixo' ? 1 : 2; let eqB = b.equipe === 'Fixo' ? 1 : 2;
                return eqA - eqB;
            });
            ops.forEach(op => {
                let nomeMaqVisual = op.funcao === 'Líder de Campo' ? 'Líder' : (op.maquina_especifica || 'Sem Máquina');
                if (isFolguistasFrente && op.funcao !== 'Líder de Campo') { nomeMaqVisual = op.maquina_especifica ? `Cobrir ${op.maquina_especifica} (F6 e F5)` : 'Cobrir F6 e F5'; } 
                else if (op.equipe === 'Folguista' && op.funcao !== 'Líder de Campo' && !isFolguistasFrente) { nomeMaqVisual = 'Cobrir M1/M2'; }
                html += `<tr><td>${nomeMaqVisual}</td><td>${op.tipo_escala || '4x2'}</td><td>${op.equipe||'-'}</td><td>${op.turno||'-'}</td><td style="text-align:left;"><b>${op.nome}</b></td>`;
                window.currentDatasCampo.forEach(d => {
                    const esc = matrizEscala[op.id][d.dateKey];
                    const isF = esc.statusEscala === 'FOLGA' || esc.statusEscala === 'F';
                    html += `<td class="${isF ? 'f' : 't'}">${isF ? 'F' : esc.statusEscala}</td>`;
                });
                html += `</tr>`;
            });
            html += `</tbody></table><br>`;
        });
    });
    html += `<script>window.print();</script></body></html>`;
    const w = window.open('', '', 'width=1200,height=800'); w.document.write(html); w.document.close();
};

window.exportarEscalaCampoExcel = function() {
    const inputData = document.getElementById('campoDataEscala');
    let dataBase = inputData && inputData.value ? new Date(inputData.value + 'T00:00:00') : new Date();
    const ano = dataBase.getFullYear(), mes = dataBase.getMonth(), diasNoMes = new Date(ano, mes + 1, 0).getDate();
    let csvContent = "\uFEFFFrente;Função;Máquina;Ciclo;Turno;Regime;Operador";
    
    let dateStrs = [];
    for (let dia = 1; dia <= diasNoMes; dia++) {
        dateStrs.push(`${ano}-${(mes + 1).toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`);
        csvContent += `;${dia.toString().padStart(2, '0')}/${(mes + 1).toString().padStart(2, '0')}`;
    }
    csvContent += "\n";
    
    const matrizEscala = window.calcularMatrizEscala(window.equipeCampo, window.maquinasCampo, dateStrs);

    let excelOps = [...window.equipeCampo];
    excelOps.sort((a,b) => {
        if(a.maquina_id !== b.maquina_id) return (a.maquina_id || 0) - (b.maquina_id || 0);
        let fA = a.funcao || 'Z'; let fB = b.funcao || 'Z';
        if(fA !== fB) return fA.localeCompare(fB);
        let maqA = a.maquina_especifica || 'Z'; let maqB = b.maquina_especifica || 'Z';
        if(maqA !== maqB) return maqA.localeCompare(maqB);
        let eqA = a.equipe === 'Fixo' ? 1 : 2; let eqB = b.equipe === 'Fixo' ? 1 : 2;
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
        if (isFolguistasFrente && op.funcao !== 'Líder de Campo') { nomeMaqVisual = op.maquina_especifica ? `Cobrir ${op.maquina_especifica} (F6 e F5)` : 'Cobrir F6 e F5'; } 
        else if (op.equipe === 'Folguista' && op.funcao !== 'Líder de Campo' && !isFolguistasFrente) { nomeMaqVisual = 'Cobrir M1/M2'; }
        let linha = `${nomeFrente};${op.funcao || '-'};${nomeMaqVisual};${op.tipo_escala||'4x2'};${op.turno||'-'};${op.equipe||'-'};${op.nome}`;
        for (let dia = 1; dia <= diasNoMes; dia++) {
            const dStr = dateStrs[dia - 1];
            const esc = matrizEscala[op.id][dStr];
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
    
    const matrizEscala = window.calcularMatrizEscala(window.equipeCampo, window.maquinasCampo, [dStr]);

    let html = `<html><head><title>Escala Diária Campo</title><style>@page { size: A4 portrait; margin: 15mm; } body { font-family: Arial; font-size: 12px; } .header { text-align: center; border-bottom: 2px solid #000; margin-bottom: 20px; } table { width: 100%; border-collapse: collapse; text-align: center; } th, td { border: 1px solid #000; padding: 6px; } th { background-color: #d1d5db; } .t { background-color: #d4edda; font-weight: bold; }</style></head><body>`;
    html += `<div class="header"><h1>Diária Campo - ${dForm}</h1></div>`;
    const trabs = [];
    window.equipeCampo.forEach(op => {
        const esc = matrizEscala[op.id][dStr];
        if (esc.statusEscala !== 'FOLGA' && esc.statusEscala !== 'F') {
            let m = window.maquinasCampo.find(x => String(x.id) === String(op.maquina_id));
            let isFolguistasFrente = false; let nFront = "Reserva";
            if (m) { nFront = m.nome; if (m.nome && m.nome.toUpperCase().includes('FOLGUISTA')) isFolguistasFrente = true; }
            let nomeMaqVisual = op.funcao === 'Líder de Campo' ? 'Líder' : (op.maquina_especifica || 'Sem Máquina');
            if (isFolguistasFrente && op.funcao !== 'Líder de Campo') { nomeMaqVisual = op.maquina_especifica ? `Cobrir ${op.maquina_especifica} (F6 e F5)` : 'Cobrir F6 e F5'; } 
            else if (op.equipe === 'Folguista' && op.funcao !== 'Líder de Campo' && !isFolguistasFrente) { nomeMaqVisual = 'Cobrir M1/M2'; }
            trabs.push({ n: op.nome, f: nFront, func: op.funcao || '-', m: nomeMaqVisual, c: op.tipo_escala||'4x2', t: op.turno||'-', v: esc.statusEscala });
        }
    });
    if (trabs.length === 0) html += '<p>Ninguém escalado.</p>';
    else {
        html += `<table><thead><tr><th>Frente</th><th>Função</th><th>Máquina/Líder</th><th>Ciclo</th><th>Turno</th><th style="text-align:left;">Operador</th><th>Alocação</th></tr></thead><tbody>`;
        trabs.sort((a,b) => a.f.localeCompare(b.f) || a.func.localeCompare(b.func) || a.m.localeCompare(b.m)).forEach(l => { 
            html += `<tr><td>${l.f}</td><td>${l.func}</td><td>${l.m}</td><td>${l.c}</td><td>${l.t}</td><td style="text-align:left;"><b>${l.n}</b></td><td class="t">${l.v}</td></tr>`; 
        });
        html += `</tbody></table>`;
    }
    html += `<script>window.onload = function() { window.print(); }</script></body></html>`;
    const w = window.open('', '', 'width=900,height=700'); w.document.write(html); w.document.close();
    window.fecharModalImpressaoCampo();
};

setTimeout(() => {
    if (typeof window.carregarDadosEscalaCampo === 'function') {
        window.carregarDadosEscalaCampo();
    }
}, 500);