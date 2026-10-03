// ==================== MÓDULO: TROCA DE TURNO (CORE E KANBAN) ====================
window.motSelectPendente = null; 

window.focarNaTabela = function(domId) {
    window.alternarAbaTroca('registros');
    setTimeout(() => {
        const linha = document.getElementById(`tr_${domId}`);
        if (linha) {
            linha.scrollIntoView({ behavior: 'smooth', block: 'center' });
            linha.style.boxShadow = 'inset 0 0 15px rgba(59, 130, 246, 0.8)';
            setTimeout(() => { linha.style.boxShadow = 'none'; }, 2000);
        }
    }, 300);
}

window.concluirTurnoReserva = async function(nome, turnoStr) {
    if (!confirm(`Deseja concluir o turno do motorista Reserva/Disponível: ${nome}?`)) return;
    
    const dataRef = document.getElementById('dataFiltroTroca').value;
    const agora = new Date();
    const horaStr = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');

    try {
        const p = window.injetarFilial({ 
            data_referencia: dataRef, cavalo: 'RESERVA', turno_referencia: turnoStr, 
            motorista_entregou: nome, motorista_assumiu: nome, local_troca_id: null, 
            horario_entregou: horaStr, horario_assumiu: horaStr, tempo_troca_minutos: 0,
            horario_previsto_largar: null, saldo_minutos: 0, observacao: 'Turno de reserva concluído via Kanban.'
        });
        const { error } = await window.supabaseClient.from('troca_turno_linhares').insert([p]);
        if (error) throw error;
        alert("Turno do motorista reserva concluído com sucesso!");
        window.carregarTrocasDoDia();
    } catch (e) {
        console.error(e);
        alert("Erro ao concluir turno do reserva.");
    }
};

window.excluirTroca = async function(id) {
    if (!confirm("Tem certeza que deseja excluir este registro de troca do banco de dados?")) return;
    try {
        const { error } = await window.supabaseClient.from('troca_turno_linhares').delete().eq('id', id);
        if (error) throw error;
        alert("Registro excluído com sucesso!");
        window.carregarTrocasDoDia();
    } catch (e) {
        console.error("Erro ao excluir", e);
        alert("Erro ao excluir registro.");
    }
}

window.atualizarIndicadoresEscalaHorario = function(dataRef) {
    const mLista = (typeof motoristas !== 'undefined') ? motoristas : (window.motoristas || []);
    let contagemDia = {}; 
    let contagemNoite = {};
    let totalDia = 0; let totalNoite = 0;
    const isLinhares = (typeof currentUser !== 'undefined' && currentUser && String(currentUser.filial_id) === '7');

    mLista.forEach(m => {
        if (isLinhares) {
            const isBlocked = m.masterDrive === 'Não' || m.destra === 'Não' || m.status === 'Férias' || m.status === 'Afastado';
            if (isBlocked || !m.data_ancora) return; 

            const dDate = new Date(dataRef + "T12:00:00");
            const strAncora = m.data_ancora.split('T')[0];
            const dataAncora = new Date(strAncora + 'T12:00:00');
            const utcAncora = Date.UTC(dataAncora.getFullYear(), dataAncora.getMonth(), dataAncora.getDate());
            const utcAtual = Date.UTC(dDate.getFullYear(), dDate.getMonth(), dDate.getDate());
            const diffDays = Math.round((utcAtual - utcAncora) / (1000 * 60 * 60 * 24));
            const ciclo12 = ((diffDays % 12) + 12) % 12;

            let estado = 2; // 2 = Folga
            if (ciclo12 < 4) estado = 0; // 0 = Dia
            else if (ciclo12 >= 6 && ciclo12 < 10) estado = 1; // 1 = Noite

            if (estado !== 2) { 
                let horario = '';
                if (m.turno && m.turno !== '-') {
                    const ciclos = typeof window.getCiclos === 'function' ? window.getCiclos() : [];
                    let cicloMatch = ciclos.find(c => c.dbValue === m.turno);
                    horario = cicloMatch ? (estado === 0 ? cicloMatch.labelDia : cicloMatch.labelNoite) : m.turno;
                } else {
                    horario = estado === 0 ? '06:00' : '18:00';
                }

                if (estado === 0) {
                    if(!contagemDia[horario]) contagemDia[horario] = [];
                    contagemDia[horario].push(m.nome);
                    totalDia++;
                } else {
                    if(!contagemNoite[horario]) contagemNoite[horario] = [];
                    contagemNoite[horario].push(m.nome);
                    totalNoite++;
                }
            }
        } else {
            if (typeof window.getEscalaDiaComputada === 'function') {
                const esc = window.getEscalaDiaComputada(m, dataRef);
                if (esc && esc.caminhao && esc.caminhao !== 'F' && esc.caminhao.toUpperCase() !== 'FOLGA') {
                    let turnoDbValue = esc.turno || m.turno || '';
                    let horarioInicio = esc.inicio || m.inicio_turno || '';
                    
                    let isNoiteEq = false;
                    let eq = typeof window.getEq === 'function' ? window.getEq(m) : (m.equipe || '');
                    if (['D','E','F'].includes(eq)) isNoiteEq = true;

                    let turnoLabel = turnoDbValue;
                    if (typeof window.getCiclos === 'function') {
                        let cMatch = window.getCiclos().find(c => c.dbValue === turnoDbValue);
                        if (cMatch) turnoLabel = isNoiteEq ? cMatch.labelNoite : cMatch.labelDia;
                    }
                    
                    if (!horarioInicio) {
                        const timeMatch = turnoLabel.match(/\b(\d{2}:\d{2})\b/);
                        horarioInicio = timeMatch ? timeMatch[1] : (isNoiteEq ? '18:00' : '06:00');
                    } else {
                        horarioInicio = String(horarioInicio).substring(0, 5); 
                    }

                    let horaInt = parseInt(horarioInicio.split(':')[0], 10);
                    let isNoiteFinal = (horaInt >= 12 && horaInt <= 23);

                    if (isNoiteFinal) {
                        if(!contagemNoite[horarioInicio]) contagemNoite[horarioInicio] = [];
                        contagemNoite[horarioInicio].push(m.nome);
                        totalNoite++;
                    } else {
                        if(!contagemDia[horarioInicio]) contagemDia[horarioInicio] = [];
                        contagemDia[horarioInicio].push(m.nome);
                        totalDia++;
                    }
                }
            }
        }
    });

    const elTotDia = document.getElementById('kpiTotalDia');
    const elTotNoite = document.getElementById('kpiTotalNoite');
    const elListaDia = document.getElementById('listaHorariosDia');
    const elListaNoite = document.getElementById('listaHorariosNoite');

    if (elTotDia) elTotDia.innerText = totalDia;
    if (elTotNoite) elTotNoite.innerText = totalNoite;

    const renderBadges = (contagemDict, colorText, cssClass) => {
        const horarios = Object.keys(contagemDict).sort();
        if (horarios.length === 0) return `<span style="color:#64748b; font-size:0.85rem;">Nenhum motorista escalado</span>`;
        return horarios.map(h => {
            const nomesOrdenados = contagemDict[h].sort().join('&#10;');
            return `
            <div class="badge-escala ${cssClass}" title="MOTORISTAS NESTE HORÁRIO:&#10;${nomesOrdenados}">
                <span style="font-size: 0.85rem; color: #cbd5e1; font-weight: 600; margin-bottom: 5px;"><i class="far fa-clock" style="margin-right: 4px;"></i>${h}</span>
                <span style="font-size: 1.4rem; font-weight: 900; color: ${colorText};">${contagemDict[h].length} <i class="fas fa-users" style="font-size:0.9rem; opacity:0.7;"></i></span>
            </div>
        `}).join('');
    };

    if (elListaDia) elListaDia.innerHTML = renderBadges(contagemDia, '#38bdf8', '');
    if (elListaNoite) elListaNoite.innerHTML = renderBadges(contagemNoite, '#a5b4fc', 'badge-escala-noite');
}

window.renderizarTrocaTurno = async function() {
    const inputTroca = document.getElementById('dataFiltroTroca');
    if (inputTroca && !inputTroca.value) {
        const agora = new Date();
        const ano = agora.getFullYear();
        const mes = String(agora.getMonth() + 1).padStart(2, '0');
        const dia = String(agora.getDate()).padStart(2, '0');
        inputTroca.value = `${ano}-${mes}-${dia}`;
    }
    
    if(window.carregarLocaisTroca) await window.carregarLocaisTroca();
    await window.carregarTrocasDoDia();
}

window.alternarAbaTroca = function(aba) {
    const abas = ['registros', 'kanban', 'performance', 'locais', 'historico', 'indicadores'];
    const prefixAba = 'aba-';
    const prefixBtn = 'btnAba';

    abas.forEach(nomeAba => {
        const el = document.getElementById(prefixAba + nomeAba);
        if (el) el.style.display = 'none';
        const btn = document.getElementById(prefixBtn + nomeAba.charAt(0).toUpperCase() + nomeAba.slice(1));
        if (btn) btn.className = 'btn-secondary-dark';
    });

    const elAtivo = document.getElementById(prefixAba + aba);
    if (elAtivo) elAtivo.style.display = 'block';
    const btnAtivo = document.getElementById(prefixBtn + aba.charAt(0).toUpperCase() + aba.slice(1));
    if (btnAtivo) btnAtivo.className = 'btn-primary-blue';

    if (aba === 'registros' || aba === 'kanban') {
        window.carregarTrocasDoDia();
    } else if (aba === 'performance' && window.carregarPerformanceTroca) {
        const inputDataPerf = document.getElementById('filtroDataPerformance');
        if (inputDataPerf && !inputDataPerf.value) {
            const agora = new Date();
            inputDataPerf.value = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
        }
        window.carregarPerformanceTroca();
    } else if (aba === 'locais' && window.carregarLocaisTroca) {
        window.carregarLocaisTroca();
        setTimeout(() => {
            if (window.iniciarMapaTroca) window.iniciarMapaTroca();
            if (window.mapaTroca) window.mapaTroca.invalidateSize();
        }, 250);
    } else if (aba === 'historico' && window.carregarHistoricoTrocas) {
        const inputDataHist = document.getElementById('filtroDataHistoricoTroca');
        if (inputDataHist && !inputDataHist.value) {
            const agora = new Date();
            inputDataHist.value = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
        }
        if (window.popularFiltrosHistoricoTroca) window.popularFiltrosHistoricoTroca();
        window.carregarHistoricoTrocas();
    } else if (aba === 'indicadores' && window.carregarIndicadoresTroca) {
        const inputInd = document.getElementById('filtroTempoIndicadores');
        if (inputInd && !inputInd.value) inputInd.value = 'hoje';
        setTimeout(() => {
            if (window.iniciarMapaIndicadores) window.iniciarMapaIndicadores();
            if (window.mapaIndicadores) window.mapaIndicadores.invalidateSize();
            window.carregarIndicadoresTroca();
        }, 250);
    }
}

window.calcularTempoTroca = function(domId) {
    const heInput = document.getElementById(`hora_entregou_${domId}`);
    const haInput = document.getElementById(`hora_assumiu_${domId}`);
    const he = heInput ? heInput.value : '';
    const ha = haInput ? haInput.value : '';
    const divTempo = document.getElementById(`tempo_troca_${domId}`);
    const divProx = document.getElementById(`prox_${domId}`);
    const alertaDisp = document.getElementById(`alerta_disp_${domId}`);

    if(ha) {
        let [h, m] = ha.split(':').map(Number);
        divProx.innerText = `${((h + 12) % 24).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    } else {
        divProx.innerText = '--:--';
    }

    if(he && ha) {
        let [he_h, he_m] = he.split(':').map(Number);
        let [ha_h, ha_m] = ha.split(':').map(Number);
        let minE = he_h * 60 + he_m;
        let minA = ha_h * 60 + ha_m;
        let diff = minA - minE;
        if (diff < 0) diff += 24 * 60; 

        let diffH = Math.floor(diff / 60);
        let diffM = diff % 60;
        let color = diff > 30 ? '#ef4444' : '#4ade80'; 
        divTempo.innerHTML = `<span style="color:${color}; font-weight:bold; font-size:1rem;">${diffH}h ${diffM}m</span>`;
    } else {
        divTempo.innerText = '--';
    }

    if (heInput && alertaDisp) {
        const previsto = heInput.getAttribute('data-previsto');
        if (previsto && he) {
            let [prev_h, prev_m] = previsto.split(':').map(Number);
            let [he_h, he_m] = he.split(':').map(Number);
            
            let diffDisp = (prev_h * 60 + prev_m) - (he_h * 60 + he_m);
            if (diffDisp < -12 * 60) diffDisp += 24 * 60;
            if (diffDisp > 12 * 60) diffDisp -= 24 * 60; 

            if (diffDisp > 0) {
                let dispH = Math.floor(diffDisp / 60);
                let dispM = diffDisp % 60;
                alertaDisp.innerHTML = `<div style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; padding: 2px 4px; border-radius: 4px; border: 1px solid rgba(59, 130, 246, 0.4); font-size: 0.7rem;">+${dispH}h ${dispM}m</div>`;
            } else if (diffDisp < 0) {
                let excesso = Math.abs(diffDisp);
                let excH = Math.floor(excesso / 60);
                let excM = excesso % 60;
                alertaDisp.innerHTML = `<div style="background: rgba(239, 68, 68, 0.2); color: #f87171; padding: 2px 4px; border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.4); font-size: 0.7rem;">-${excH}h ${excM}m</div>`;
            } else {
                alertaDisp.innerHTML = `<div style="background: rgba(16, 185, 129, 0.2); color: #4ade80; padding: 2px 4px; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.4); font-size: 0.7rem;">Exato</div>`;
            }
        } else {
            alertaDisp.innerHTML = '';
        }
    }
}

window.verificarMudancaMotorista = function(domId) {
    const selectMot = document.getElementById(`mot_prox_${domId}`);
    const original = selectMot.getAttribute('data-original');
    const atual = selectMot.value;
    
    // Nao emitir alerta caso mude para "Sem Motorista"
    if (original && atual !== original && atual !== "" && atual !== "Sem Motorista") {
        window.motSelectPendente = selectMot;
        document.getElementById('obsDomId').value = domId;
        document.getElementById('textoObservacaoTroca').value = document.getElementById(`obs_${domId}`).value;
        document.getElementById('modalObservacaoTroca').style.display = 'flex';
    }
}

window.cancelarObservacaoTroca = function() {
    if (window.motSelectPendente) {
        window.motSelectPendente.value = window.motSelectPendente.getAttribute('data-original');
        window.motSelectPendente = null;
    }
    document.getElementById('modalObservacaoTroca').style.display = 'none';
}

window.confirmarObservacaoTroca = function() {
    const texto = document.getElementById('textoObservacaoTroca').value.trim();
    if (!texto) {
        alert('Por favor, descreva obrigatoriamente o motivo da troca!');
        return;
    }
    const domId = document.getElementById('obsDomId').value;
    document.getElementById(`obs_${domId}`).value = texto; 
    window.motSelectPendente = null;
    document.getElementById('modalObservacaoTroca').style.display = 'none';
}

window.carregarTrocasDoDia = async function() {
    const dataRef = document.getElementById('dataFiltroTroca').value;
    const tbody = document.getElementById('tbodyTrocaTurno');
    if (!tbody || !dataRef) return;
    
    const isLinhares = (typeof currentUser !== 'undefined' && currentUser && String(currentUser.filial_id) === '7');
    window.atualizarIndicadoresEscalaHorario(dataRef);
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px;">Processando frotas, turnos e ordens de serviço...</td></tr>`;
    
    try {
        if (!window.locaisTrocaCache || window.locaisTrocaCache.length === 0) {
            let resLocaisQuery = window.supabaseClient.from('locais_troca').select('*').order('nome');
            resLocaisQuery = window.aplicarFiltroFilial(resLocaisQuery);
            const resLocais = await resLocaisQuery;
            if (resLocais.data) window.locaisTrocaCache = resLocais.data;
        }

        // 1. BUSCA AS ORDENS DE SERVIÇO ABERTAS PARA SEPARAR VEÍCULOS EM MANUTENÇÃO
        let ordensAbertas = [];
        try {
            let qOS = window.supabaseClient.from('ordens_servico').select('placa, status').eq('inativa', 0).neq('status', 'Concluída');
            qOS = window.aplicarFiltroFilial(qOS);
            const resOS = await qOS;
            if (resOS.data) ordensAbertas = resOS.data;
        } catch(e) { console.warn('Aviso: Não foi possível checar OS.', e); }

        let registros = [];
        let linhasData = [];
        const mLista = (typeof motoristas !== 'undefined') ? motoristas : (window.motoristas || []);

        const dFiltro = new Date(dataRef + "T12:00:00");
        dFiltro.setDate(dFiltro.getDate() - 5);
        const dataLimiteStr = dFiltro.toISOString().split('T')[0];

        try {
            let queryHistorico = window.supabaseClient.from('troca_turno_linhares')
                .select('*')
                .gte('data_referencia', dataLimiteStr)
                .lte('data_referencia', dataRef)
                .order('data_referencia', { ascending: false })
                .order('id', { ascending: false });
                
            queryHistorico = window.aplicarFiltroFilial(queryHistorico); 
            const { data } = await queryHistorico;
            if (data) registros = data;
        } catch(e) {}

        if (isLinhares) {
            const { data: frotaLinhares } = await window.supabaseClient.from('frotas_manutencao')
                .select('*').eq('filial_id', 7).eq('categoria', 'TRITREM');

            if (!frotaLinhares || frotaLinhares.length === 0) {
                tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:20px; color:#f1c40f;">Nenhuma frota TRITREM encontrada.</td></tr>`;
                return;
            }

            frotaLinhares.forEach((f) => {
                const placaNorm = f.cavalo ? String(f.cavalo).trim().toUpperCase() : '-';
                const go = f.frota || '-';
                const conjId = f.numero_frota || '-';
                
                // Lógica de OS / Manutenção
                let osAberta = ordensAbertas.find(o => String(o.placa).trim().toUpperCase() === placaNorm);
                let isManutencao = !!osAberta || (f.status && (f.status.toUpperCase().includes('MANUT') || f.status.toUpperCase().includes('OFICINA')));
                
                linhasData.push({ conjId: conjId, go: go, placaNorm: placaNorm, esc: { nome: null, turno: 'Turno 1', originalTurno: 'Turno 1', eq: '' }, idxTurno: 0, isManutencao });
                linhasData.push({ conjId: conjId, go: go, placaNorm: placaNorm, esc: { nome: null, turno: 'Turno 2', originalTurno: 'Turno 2', eq: '' }, idxTurno: 1, isManutencao });
            });
        } else {
            const cLista = (typeof conjuntos !== 'undefined') ? conjuntos : (window.conjuntos || []);
            if (cLista.length === 0) {
                tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:20px; color:#f1c40f;">Nenhum Conjunto encontrado.</td></tr>`;
                return;
            }

            cLista.forEach(conj => {
                if (!conj.caminhoes || conj.caminhoes.length === 0) return;
                conj.caminhoes.forEach((cam, idxCam) => {
                    const placa = typeof cam === 'string' ? cam : cam.placa;
                    const go = typeof cam === 'string' ? '-' : (cam.go || '-');
                    const placaNorm = String(placa).trim().toUpperCase();
                    
                    let osAberta = ordensAbertas.find(o => String(o.placa).trim().toUpperCase() === placaNorm);
                    let isManutencao = !!osAberta || (typeof cam !== 'string' && cam.status && (cam.status.toUpperCase().includes('MANUT') || cam.status.toUpperCase().includes('OFICINA')));
                    
                    let motoristasHoje = [];
                    mLista.forEach(m => {
                        if (typeof window.getEscalaDiaComputada === 'function') {
                            const escDia = window.getEscalaDiaComputada(m, dataRef);
                            if (String(escDia.caminhao).trim().toUpperCase() === placaNorm && escDia.caminhao !== 'F') {
                                let originalTurno = escDia.turno || m.turno || 'Indefinido';
                                let turnoFormatado = originalTurno;
                                let eq = typeof window.getEq === 'function' ? window.getEq(m) : (m.equipe || '');
                                if (typeof window.getCiclos === 'function') {
                                    let cMatch = window.getCiclos().find(c => c.dbValue === originalTurno);
                                    if (cMatch) turnoFormatado = ['D','E','F'].includes(eq) ? cMatch.labelNoite : cMatch.labelDia;
                                }
                                motoristasHoje.push({ nome: m.nome, turno: turnoFormatado, originalTurno: originalTurno, eq: eq });
                            }
                        }
                    });
                    
                    if (motoristasHoje.length === 0) motoristasHoje.push({ nome: null, turno: 'Sem Escala', originalTurno: 'Sem Escala', eq: '' });
                    motoristasHoje.forEach((esc, idxTurno) => {
                        linhasData.push({ conjId: conj.id || conj.codigo || '-', go: go, placaNorm: placaNorm, esc: esc, idxTurno: idxTurno, isManutencao });
                    });
                });
            });
        }

        // Determinação de Ordem e Dia/Noite
        linhasData.forEach((linha) => {
            let horaMinutos = 0; let isNoite = false;
            let tFmt = String(linha.esc.turno || '');
            let tOrig = String(linha.esc.originalTurno || '').toUpperCase();
            
            let match = tFmt.match(/\b(\d{2}):(\d{2})\b/);
            if (match) {
                let h = parseInt(match[1], 10);
                horaMinutos = h * 60 + parseInt(match[2], 10);
                isNoite = (h >= 12 && h <= 23);
            } else {
                if (tOrig.includes('NOITE') || tOrig === 'TURNO 2' || (tOrig === '2' && !tOrig.includes(':'))) {
                    horaMinutos = 18 * 60; isNoite = true;
                } else {
                    horaMinutos = 6 * 60; isNoite = false;
                }
            }
            linha.sortTime = horaMinutos;
            linha.isNoite = isNoite ? 1 : 0;
        });

        // 2. AGRUPAR POR PLACA PARA CRIAR A LINHA ÚNICA (ROWSPAN)
        let groupedByPlaca = {};
        linhasData.forEach((linha) => {
            if (!groupedByPlaca[linha.placaNorm]) {
                groupedByPlaca[linha.placaNorm] = {
                    placaNorm: linha.placaNorm,
                    conjId: linha.conjId,
                    go: linha.go,
                    isManutencao: linha.isManutencao,
                    turnos: []
                };
            }
            groupedByPlaca[linha.placaNorm].turnos.push(linha);
        });

        let groupedArray = Object.values(groupedByPlaca);
        groupedArray.sort((a, b) => {
            if (a.isManutencao !== b.isManutencao) return a.isManutencao ? 1 : -1;
            let conjA = parseInt(a.conjId) || 9999;
            let conjB = parseInt(b.conjId) || 9999;
            if (conjA !== conjB) return conjA - conjB;
            return a.placaNorm.localeCompare(b.placaNorm);
        });

        groupedArray.forEach(truck => {
            truck.turnos.sort((a, b) => {
                if (a.isNoite !== b.isNoite) return a.isNoite - b.isNoite;
                return a.sortTime - b.sortTime;
            });
        });

        const mListaOrdenada = [...mLista].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

        let htmlTabelaAtivas = '';
        let htmlTabelaManut = '';
        
        let listDisponivel = []; let listPendente = []; let listAndamento = []; let listConcluido = [];
        let countDisponivel = 0; let countPendente = 0; let countAndamento = 0; let countConcluido = 0;
        let kanbanPorPlaca = {};

        // LOOP SOBRE OS CAMINHÕES AGRUPADOS
        groupedArray.forEach((truck, truckIdx) => {
            let isManutencao = truck.isManutencao;
            let rowCount = truck.turnos.length;

            let placaDisplay = truck.placaNorm;
            let fontColor = isManutencao ? '#fca5a5' : '#fff';
            if (isManutencao) {
                placaDisplay += `<br><span style="color: #ef4444; font-size: 0.75rem; margin-top: 5px; display:inline-block;"><i class="fas fa-tools"></i> Em Oficina</span>`;
            }

            let truckBgColor = isManutencao ? 'rgba(239, 68, 68, 0.05)' : 'rgba(0,0,0,0.15)';
            let truckHoverColor = isManutencao ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.03)';
            let truckBorderColor = isManutencao ? '2px solid #ef4444' : '2px solid rgba(59, 130, 246, 0.4)';

            truck.turnos.forEach((linha, idxLocal) => {
                const { esc, idxTurno, isNoite } = linha;
                const domId = `${truck.placaNorm.replace(/[^A-Z0-9]/g, '')}_${idxTurno}`; 

                let reg = null; let ultimoReg = null;
                let motoristaAtualSalvo = ''; let motoristaProxSalvo = ''; let horarioEntregou = ''; let horarioAssumiu = '';
                let obsReal = ''; let localTrocaIdStr = ''; let diffRender = '--'; let labelPrevisto = ''; let horarioPrevistoLargarVal = ''; 

                let historicoPlaca = registros.filter(r => r.cavalo.toUpperCase() === truck.placaNorm);
                reg = historicoPlaca.find(r => r.data_referencia === dataRef && (r.turno_referencia === esc.originalTurno || r.turno_referencia === esc.turno));

                let idxAtual = historicoPlaca.findIndex(r => r.id === (reg ? reg.id : -1));
                if (reg && idxAtual < historicoPlaca.length - 1) ultimoReg = historicoPlaca[idxAtual + 1];
                else if (!reg && historicoPlaca.length > 0) ultimoReg = historicoPlaca[0];

                if (reg) {
                    horarioEntregou = reg.horario_entregou ? reg.horario_entregou.substring(0,5) : '';
                    horarioAssumiu = reg.horario_assumiu ? reg.horario_assumiu.substring(0,5) : '';
                    obsReal = reg.observacao || '';
                    motoristaProxSalvo = reg.motorista_assumiu || '';
                    motoristaAtualSalvo = reg.motorista_entregou || '';
                    localTrocaIdStr = String(reg.local_troca_id || '');
                    
                    if (reg.tempo_troca_minutos !== null && reg.tempo_troca_minutos !== undefined) {
                        let diffH = Math.floor(reg.tempo_troca_minutos / 60);
                        let diffM = reg.tempo_troca_minutos % 60;
                        let color = reg.tempo_troca_minutos > 30 ? '#ef4444' : '#4ade80';
                        diffRender = `<span style="color:${color}; font-weight:bold; font-size:1rem;">${diffH}h ${diffM}m</span>`;
                    }
                } else {
                    motoristaProxSalvo = esc.nome || '';
                    if (ultimoReg) {
                        motoristaAtualSalvo = ultimoReg.motorista_assumiu || '';
                    } else if (!isLinhares) {
                        let parceiro = truck.turnos.find(l => l.esc.nome && l.esc.nome !== esc.nome);
                        if (parceiro) motoristaAtualSalvo = parceiro.esc.nome;
                    }
                }

                let dataInicioFmt = '--/--'; let horaInicioFmt = '--:--';
                if (ultimoReg) {
                    if (ultimoReg.horario_previsto_largar) horarioPrevistoLargarVal = ultimoReg.horario_previsto_largar.substring(0, 5);
                    if (ultimoReg.data_referencia) dataInicioFmt = ultimoReg.data_referencia.split('-').reverse().slice(0,2).join('/');
                    if (ultimoReg.horario_assumiu) horaInicioFmt = ultimoReg.horario_assumiu.substring(0, 5);
                }

                let diffDispHTML = '';
                if (horarioEntregou && horarioPrevistoLargarVal) {
                    let [prev_h, prev_m] = horarioPrevistoLargarVal.split(':').map(Number);
                    let [he_h, he_m] = horarioEntregou.split(':').map(Number);
                    let diffDisp = (prev_h * 60 + prev_m) - (he_h * 60 + he_m);
                    if (diffDisp < -12 * 60) diffDisp += 24 * 60;
                    if (diffDisp > 12 * 60) diffDisp -= 24 * 60; 

                    if (diffDisp > 0) {
                        diffDispHTML = `<div style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; padding: 2px 4px; border-radius: 4px; border: 1px solid rgba(59, 130, 246, 0.4); font-size: 0.7rem;">+${Math.floor(diffDisp / 60)}h ${diffDisp % 60}m</div>`;
                    } else if (diffDisp < 0) {
                        diffDispHTML = `<div style="background: rgba(239, 68, 68, 0.2); color: #f87171; padding: 2px 4px; border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.4); font-size: 0.7rem;">-${Math.floor(Math.abs(diffDisp) / 60)}h ${Math.abs(diffDisp) % 60}m</div>`;
                    } else {
                        diffDispHTML = `<div style="background: rgba(16, 185, 129, 0.2); color: #4ade80; padding: 2px 4px; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.4); font-size: 0.7rem;">Exato</div>`;
                    }
                }

                if (horarioPrevistoLargarVal) {
                    labelPrevisto = `
                        <div style="font-size:0.7rem; color:#94a3b8; margin-top:4px; display:flex; gap: 4px; align-items: center;">
                            <div style="background: rgba(0,0,0,0.25); padding: 2px 4px; border-radius: 4px; display: flex; align-items: center; gap: 4px;" title="Iniciou Jornada">
                                <i class="fas fa-flag-checkered" style="color:#4ade80;"></i> <b style="color:#e2e8f0;">${dataInicioFmt} ${horaInicioFmt}</b>
                            </div>
                            <div style="background: rgba(0,0,0,0.25); padding: 2px 4px; border-radius: 4px; display: flex; align-items: center; gap: 4px;" title="Previsão para Largar">
                                <i class="fas fa-stopwatch" style="color:#fbbf24;"></i> <b style="color:#fbbf24;">${horarioPrevistoLargarVal}</b>
                            </div>
                            <div id="alerta_disp_${domId}">${diffDispHTML}</div>
                        </div>`;
                } else {
                    labelPrevisto = `<div style="font-size:0.7rem; color:#64748b; margin-top:4px;">Sem histórico de entrega anterior</div>`;
                }
                
                let proximaTroca = '--:--';
                if(horarioAssumiu) {
                    let [h, m] = horarioAssumiu.split(':').map(Number);
                    proximaTroca = `${((h + 12) % 24).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                }

                let selectMotAtual = `<select id="mot_atual_${domId}" class="input-moderno input-compacto" style="margin:0;">
                    <option value="">-- Entregando --</option>
                    <option value="Sem Motorista" ${motoristaAtualSalvo === 'Sem Motorista' ? 'selected' : ''}>Sem Motorista</option>`;
                mListaOrdenada.forEach(m => { selectMotAtual += `<option value="${m.nome}" ${m.nome === motoristaAtualSalvo ? 'selected' : ''}>${m.nome}</option>`; });
                selectMotAtual += `</select>`;

                let selectMotProx = `<select id="mot_prox_${domId}" class="input-moderno input-compacto" data-original="${esc.nome || ''}" onchange="verificarMudancaMotorista('${domId}')" style="margin:0;">
                    <option value="">-- Assumindo --</option>
                    <option value="Sem Motorista" ${motoristaProxSalvo === 'Sem Motorista' ? 'selected' : ''}>Sem Motorista</option>`;
                mListaOrdenada.forEach(m => { selectMotProx += `<option value="${m.nome}" ${m.nome === motoristaProxSalvo ? 'selected' : ''}>${m.nome}</option>`; });
                selectMotProx += `</select>`;

                let selectLocal = `<select id="local_${domId}" class="input-moderno input-compacto" style="margin:0;"><option value="">Selecione...</option>`;
                window.locaisTrocaCache.forEach(l => {
                    const isSelected = (localTrocaIdStr === String(l.id)) ? 'selected' : '';
                    selectLocal += `<option value="${l.id}" ${isSelected}>${l.nome}</option>`;
                });
                selectLocal += `</select>`;

                let iconeTurno = isNoite ? '<i class="fas fa-moon" style="color: #a5b4fc;"></i>' : '<i class="fas fa-sun" style="color: #fde047;"></i>';
                let corBadge = isNoite ? 'background: rgba(99, 102, 241, 0.25); color: #c7d2fe; border: 1px solid rgba(99, 102, 241, 0.5);' : 'background: rgba(56, 189, 248, 0.25); color: #bae6fd; border: 1px solid rgba(56, 189, 248, 0.5);';

                let inputHoraEntregou = `<input type="time" id="hora_entregou_${domId}" data-previsto="${horarioPrevistoLargarVal}" class="input-moderno input-compacto" value="${horarioEntregou}" onchange="calcularTempoTroca('${domId}')" title="Entregou" style="margin:0; text-align:center; padding: 6px 2px !important; width: 100%;">`;
                let inputHoraAssumiu = `<input type="time" id="hora_assumiu_${domId}" class="input-moderno input-compacto" value="${horarioAssumiu}" onchange="calcularTempoTroca('${domId}')" title="Assumiu" style="margin:0; text-align:center; padding: 6px 2px !important; width: 100%;">`;

                let acoesHtml = `<button class="btn-primary-green btn-compacto" onclick="salvarTroca('${domId}', '${truck.placaNorm}', '${esc.originalTurno}')" title="Salvar" style="flex:1;"><i class="fas fa-save"></i></button>`;
                if (reg && reg.id) {
                    acoesHtml += `<button class="btn-danger btn-compacto" onclick="excluirTroca('${reg.id}')" title="Excluir" style="flex:1;"><i class="fas fa-trash"></i></button>`;
                }

                // Linha Única Combinada e Agrupada (Rowspan na Placa)
                let isLastShift = idxLocal === rowCount - 1;
                let borderStyle = isLastShift ? truckBorderColor : '1px dashed rgba(255,255,255,0.05)';

                let htmlTr = `<tr id="tr_${domId}" style="background: ${truckBgColor}; border-bottom: ${borderStyle}; transition: background 0.2s;" onmouseover="this.style.background='${truckHoverColor}'" onmouseout="this.style.background='${truckBgColor}'">`;

                if (idxLocal === 0) {
                    htmlTr += `
                        <td rowspan="${rowCount}" style="vertical-align: middle; text-align: center; border-right: 1px solid rgba(255,255,255,0.05);">
                            <span style="font-weight: 900; color: ${fontColor}; font-size: 1.15rem; letter-spacing: 1px; display: block;">${placaDisplay}</span>
                        </td>
                    `;
                }

                htmlTr += `
                    <td style="vertical-align: middle; text-align: center;">
                        <span class="badge-turno" style="${corBadge}">${iconeTurno} ${esc.turno || 'Indef.'}</span>
                    </td>
                    <td style="vertical-align: middle;">
                        <div style="display: flex; gap: 4px; align-items: center;">
                            <div style="flex: 1; min-width: 140px;">${selectMotAtual}</div>
                            <div style="width: 105px;">${inputHoraEntregou}</div>
                        </div>
                        ${labelPrevisto}
                    </td>
                    <td style="vertical-align: middle;">
                        <div style="display: flex; gap: 4px; align-items: center;">
                            <div style="flex: 1; min-width: 140px;">${selectMotProx}</div>
                            <div style="width: 105px;">${inputHoraAssumiu}</div>
                        </div>
                    </td>
                    <td style="vertical-align: middle;">${selectLocal}</td>
                    <td style="text-align: center; vertical-align: middle;"><span id="tempo_troca_${domId}">${diffRender}</span></td>
                    <td style="text-align: center; vertical-align: middle;"><span id="prox_${domId}" class="hora-estimada" style="font-size: 0.9rem;">${proximaTroca}</span></td>
                    <td style="vertical-align: middle;">
                        <input type="text" id="obs_${domId}" class="input-moderno input-compacto" placeholder="Observações..." value="${obsReal}" style="margin:0;">
                    </td>
                    <td style="vertical-align: middle;">
                        <div style="display: flex; gap: 4px; justify-content: center; width: 100%;">
                            ${acoesHtml}
                        </div>
                    </td>
                </tr>`;

                if (isManutencao) htmlTabelaManut += htmlTr;
                else htmlTabelaAtivas += htmlTr;

                // Kanban Setup
                let statusKb = 0; 
                if (horarioEntregou && !horarioAssumiu) statusKb = 1;
                else if (horarioEntregou && horarioAssumiu) statusKb = 2;

                if (!kanbanPorPlaca[truck.placaNorm]) kanbanPorPlaca[truck.placaNorm] = [];
                kanbanPorPlaca[truck.placaNorm].push({
                    domId, placaNorm: truck.placaNorm, esc, nomeEntregou: motoristaAtualSalvo || 'Aguardando CCO', 
                    nomeAssumiu: motoristaProxSalvo || esc.nome || 'Escala Vazia',
                    horarioEntregou, horarioAssumiu, statusKb, corBadge, iconeTurno,
                    isManutencao: isManutencao
                });
            });
        });

        let htmlFinal = htmlTabelaAtivas;
        if (htmlTabelaManut !== '') {
            htmlFinal += `
                <tr class="separator-manutencao">
                    <td colspan="9">
                        <i class="fas fa-tools"></i> VEÍCULOS EM MANUTENÇÃO OFICINA (ALOCAÇÃO NÃO NECESSÁRIA)
                    </td>
                </tr>
            ` + htmlTabelaManut;
        }
        tbody.innerHTML = htmlFinal;

        Object.keys(kanbanPorPlaca).forEach(placa => {
            let turnos = kanbanPorPlaca[placa];
            let activeShift = turnos[0]; 
            
            if (turnos.length > 1) {
                if (turnos[0].statusKb === 2 && turnos[1].statusKb > 0) activeShift = turnos[1];
                else if (turnos[0].statusKb === 0 && turnos[1].statusKb > 0) activeShift = turnos[1];
                else if (turnos[0].statusKb === 2 && turnos[1].statusKb === 0) activeShift = turnos[0];
            }

            let idleHtml = '';
            if (activeShift.statusKb === 1 && activeShift.horarioEntregou) {
                let [he_h, he_m] = activeShift.horarioEntregou.split(':').map(Number);
                let now = new Date();
                let diff = (now.getHours() * 60 + now.getMinutes()) - (he_h * 60 + he_m);
                if (diff < 0) diff += 24 * 60; 
                
                let diffH = Math.floor(diff / 60); let diffM = diff % 60;
                let colorBorder = diff > 30 ? '#ef4444' : '#f59e0b';
                let colorBg = diff > 30 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)';
                let pulseClass = diff > 30 ? 'box-shadow: 0 0 12px rgba(239, 68, 68, 0.6);' : '';
                
                idleHtml = `<div style="margin-top: 10px; background: ${colorBg}; padding: 6px; border-radius: 6px; color: ${colorBorder}; font-weight: 900; font-size: 0.85rem; text-align: center; border: 1px solid ${colorBorder}; ${pulseClass}"><i class="fas fa-exclamation-triangle"></i> CAMINHÃO PARADO HÁ ${diffH}h ${diffM}m</div>`;
            }

            let cardBorderColor = activeShift.statusKb === 0 ? '#94a3b8' : (activeShift.statusKb === 1 ? '#ef4444' : '#10b981');
            let kbPlacaText = activeShift.placaNorm;
            
            if (activeShift.isManutencao) {
                cardBorderColor = '#ef4444';
                kbPlacaText += ` <span style="color: #ef4444; font-size: 0.7rem;"><i class="fas fa-tools"></i> Manut.</span>`;
            }

            let htmlCard = `
                <div class="kanban-card" onclick="focarNaTabela('${activeShift.domId}')" style="border-left-color: ${cardBorderColor};">
                    <div class="kb-placa">${kbPlacaText} <span style="font-size:0.7rem; font-weight:normal; ${activeShift.corBadge}; padding: 2px 6px; border-radius: 4px;">${activeShift.iconeTurno} ${activeShift.esc.turno || ''}</span></div>
                    <div class="kb-info"><i class="fas fa-sign-out-alt" style="color:#f87171; width:15px;"></i> Sai: <span style="color:#fff;">${activeShift.nomeEntregou}</span></div>
                    <div class="kb-info"><i class="fas fa-sign-in-alt" style="color:#4ade80; width:15px;"></i> Entra: <span style="color:#fff;">${activeShift.nomeAssumiu}</span></div>
                    <div class="kb-status-time">
                        <span><i class="far fa-clock"></i> E: ${activeShift.horarioEntregou || '--:--'}</span>
                        <span><i class="far fa-clock"></i> A: ${activeShift.horarioAssumiu || '--:--'}</span>
                    </div>
                    ${idleHtml}
                </div>
            `;

            if (activeShift.statusKb === 0) { countPendente++; listPendente.push(htmlCard); }
            else if (activeShift.statusKb === 1) { countAndamento++; listAndamento.push({ html: htmlCard, sortValue: 0 }); }
            else if (activeShift.statusKb === 2) { countConcluido++; listConcluido.push(htmlCard); }
        });

        if (isLinhares) {
            let motoristasEscaladosHoje = new Set();
            Object.keys(kanbanPorPlaca).forEach(placa => {
                kanbanPorPlaca[placa].forEach(shift => {
                    if (shift.nomeAssumiu && shift.nomeAssumiu !== 'Escala Vazia' && shift.statusKb < 2) motoristasEscaladosHoje.add(shift.nomeAssumiu);
                });
            });

            const parseDateTime = (dateStr, timeStr, turno) => {
                if (!dateStr || !timeStr) return null;
                let dt = new Date(`${dateStr}T${timeStr.substring(0,5)}:00`);
                let hour = parseInt(timeStr.substring(0,2));
                if ((turno === 'Turno 2' || turno === 'Noite' || String(turno).toUpperCase().includes('NOITE')) && hour < 12) dt.setDate(dt.getDate() + 1);
                return dt;
            };

            const getDriverLatestEvent = (nomeMotorista) => {
                let latestTime = 0; let event = null;
                registros.forEach(r => {
                    if (r.motorista_assumiu === nomeMotorista && r.horario_assumiu) {
                        let dtA = parseDateTime(r.data_referencia, r.horario_assumiu, r.turno_referencia || r.turno_previsto);
                        if (dtA && dtA.getTime() > latestTime) { latestTime = dtA.getTime(); event = { type: 'A', dt: dtA, record: r }; }
                    }
                    if (r.motorista_entregou === nomeMotorista && r.horario_entregou) {
                        let dtE = parseDateTime(r.data_referencia, r.horario_entregou, r.turno_referencia || r.turno_previsto);
                        if (dtE && dtE.getTime() > latestTime) { latestTime = dtE.getTime(); event = { type: 'E', dt: dtE, record: r }; }
                    }
                });
                return event;
            };

            mListaOrdenada.forEach(m => {
                const isBlocked = m.masterDrive === 'Não' || m.destra === 'Não' || m.status === 'Férias' || m.status === 'Afastado';
                if (isBlocked || !m.data_ancora) return;

                const dDate = new Date(dataRef + "T12:00:00");
                const strAncora = m.data_ancora.split('T')[0];
                const dataAncora = new Date(strAncora + 'T12:00:00');
                const utcAncora = Date.UTC(dataAncora.getFullYear(), dataAncora.getMonth(), dataAncora.getDate());
                const utcAtual = Date.UTC(dDate.getFullYear(), dDate.getMonth(), dDate.getDate());
                const diffDays = Math.round((utcAtual - utcAncora) / (1000 * 60 * 60 * 24));
                const ciclo12 = ((diffDays % 12) + 12) % 12;

                let estado = 2; // folga
                if (ciclo12 < 4) estado = 0; // Dia
                else if (ciclo12 >= 6 && ciclo12 < 10) estado = 1; // Noite

                if (estado === 2) return; 
                if (motoristasEscaladosHoje.has(m.nome)) return; 

                let lastEvent = getDriverLatestEvent(m.nome);
                if (lastEvent && lastEvent.type === 'A') return; 

                let regDisp = registros.find(r => r.data_referencia === dataRef && r.cavalo === 'RESERVA' && r.motorista_entregou === m.nome);
                let turnoStr = estado === 0 ? 'Dia' : 'Noite';
                let cidadeStr = m.cidade || 'N/I';

                if (regDisp) {
                    countConcluido++;
                    listConcluido.push(`
                        <div class="kanban-card">
                            <div class="kb-placa">RESERVA <span style="font-size:0.7rem; font-weight:normal; background: rgba(16, 185, 129, 0.25); color: #4ade80; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(16,185,129,0.5);"><i class="fas fa-check"></i> ${turnoStr}</span></div>
                            <div class="kb-info"><i class="fas fa-user" style="color:#a855f7; width:15px;"></i> Motorista: <span style="color:#fff;">${m.nome}</span></div>
                            <div class="kb-info"><i class="fas fa-city" style="color:#94a3b8; width:15px;"></i> Cidade: <span style="color:#cbd5e1;">${cidadeStr}</span></div>
                            <div class="kb-status-time"><span><i class="far fa-clock"></i> Concluído às: ${regDisp.horario_entregou ? regDisp.horario_entregou.substring(0,5) : '--:--'}</span></div>
                        </div>
                    `);
                    return;
                }

                let isResting = false; let missingHours = 0; let missingMins = 0;
                let readyTimeStr = '--:--'; let readyTime = null; 
                let idleTimeMs = Infinity; let idleTimeText = 'Livre (Sem registro recente)';

                if (lastEvent && lastEvent.type === 'E') {
                    let now = new Date();
                    let diffMs = now.getTime() - lastEvent.dt.getTime();
                    
                    if (diffMs >= 0 && diffMs < (11 * 3600000)) { 
                        isResting = true;
                        let timeNeededMs = (11 * 3600000) - diffMs;
                        missingHours = Math.floor(timeNeededMs / 3600000);
                        missingMins = Math.floor((timeNeededMs % 3600000) / 60000);
                        readyTime = new Date(now.getTime() + timeNeededMs);
                        readyTimeStr = String(readyTime.getHours()).padStart(2, '0') + ':' + String(readyTime.getMinutes()).padStart(2, '0');
                    } else if (diffMs >= (11 * 3600000)) {
                        idleTimeMs = diffMs - (11 * 3600000);
                        let idleH = Math.floor(idleTimeMs / 3600000);
                        let idleM = Math.floor((idleTimeMs % 3600000) / 60000);
                        idleTimeText = `Ocioso há <b>${idleH}h ${idleM}m</b>`;
                    }
                }

                if (isResting) {
                    countAndamento++;
                    listAndamento.push({
                        html: `
                            <div class="kanban-card" style="border-left-color: #f59e0b;">
                                <div class="kb-placa">EM DESCANSO <span style="font-size:0.7rem; font-weight:normal; background: rgba(245, 158, 11, 0.25); color: #fbbf24; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(245,158,11,0.5);"><i class="fas fa-bed"></i> 11h</span></div>
                                <div class="kb-info"><i class="fas fa-user" style="color:#fbbf24; width:15px;"></i> Motorista: <span style="color:#fff;">${m.nome}</span></div>
                                <div class="kb-info"><i class="fas fa-city" style="color:#94a3b8; width:15px;"></i> Cidade: <span style="color:#cbd5e1;">${cidadeStr}</span></div>
                                <div class="kb-status-time" style="margin-top:8px; border-top:none; display:block;">
                                    <div style="background: rgba(245, 158, 11, 0.15); padding: 6px; border-radius: 6px; border: 1px solid rgba(245,158,11,0.3); text-align: center; color: #fcd34d;">
                                        <div style="font-size:0.75rem; margin-bottom:3px;">Faltam <b>${missingHours}h ${missingMins}m</b></div>
                                        <div style="font-size:0.85rem; font-weight:bold;">Pronto às ${readyTimeStr}</div>
                                    </div>
                                </div>
                            </div>
                        `,
                        sortValue: readyTime.getTime()
                    });
                } else {
                    countDisponivel++;
                    listDisponivel.push({
                        html: `
                            <div class="kanban-card" style="border-left-color: #a855f7;">
                                <div class="kb-placa">DISPONÍVEL <span style="font-size:0.7rem; font-weight:normal; background: rgba(168, 85, 247, 0.25); color: #d8b4fe; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(168,85,247,0.5);"><i class="fas fa-user-clock"></i> ${turnoStr}</span></div>
                                <div class="kb-info"><i class="fas fa-user" style="color:#a855f7; width:15px;"></i> Motorista: <span style="color:#fff;">${m.nome}</span></div>
                                <div class="kb-info"><i class="fas fa-city" style="color:#94a3b8; width:15px;"></i> Cidade: <span style="color:#cbd5e1;">${cidadeStr}</span></div>
                                <div class="kb-info"><i class="fas fa-hourglass-half" style="color:#fcd34d; width:15px;"></i> <span style="color:#cbd5e1;">${idleTimeText}</span></div>
                                <button class="btn-primary-green" style="width: 100%; margin-top: 10px; padding: 8px; font-size: 0.8rem;" onclick="concluirTurnoReserva('${m.nome}', '${turnoStr}')"><i class="fas fa-check"></i> Concluir Turno</button>
                            </div>
                        `,
                        idleTimeMs: idleTimeMs
                    });
                }
            });
        }
        
        document.getElementById('kb-col-disponivel').innerHTML = listDisponivel.sort((a, b) => b.idleTimeMs - a.idleTimeMs).map(i => i.html).join('');
        document.getElementById('kb-count-disponivel').innerText = countDisponivel;
        document.getElementById('kb-col-pendente').innerHTML = listPendente.join('');
        document.getElementById('kb-count-pendente').innerText = countPendente;
        document.getElementById('kb-col-andamento').innerHTML = listAndamento.sort((a, b) => a.sortValue - b.sortValue).map(i => i.html).join('');
        document.getElementById('kb-count-andamento').innerText = countAndamento;
        document.getElementById('kb-col-concluido').innerHTML = listConcluido.join('');
        document.getElementById('kb-count-concluido').innerText = countConcluido;
        
    } catch (e) {
        console.error("Erro na varredura", e);
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px; color:#ef4444;">Erro ao cruzar os dados. Veja o console.</td></tr>`;
    }
}

window.salvarTroca = async function(domId, placa, turnoPrevisto) {
    const dataRef = document.getElementById('dataFiltroTroca').value;
    const motoristaAtual = document.getElementById(`mot_atual_${domId}`).value;
    const motoristaProx = document.getElementById(`mot_prox_${domId}`).value;
    const localId = document.getElementById(`local_${domId}`).value;
    const horaAssumiu = document.getElementById(`hora_assumiu_${domId}`).value;
    const obs = document.getElementById(`obs_${domId}`).value.trim();
    
    let horaEntregou = document.getElementById(`hora_entregou_${domId}`).value;
    let tempoTrocaMin = null; let horaPrevistaLargar = null; let saldoMinutos = null;

    if (!localId) return alert("Preencha o Local da Troca antes de salvar.");
    if (!horaEntregou && !horaAssumiu) return alert("Preencha pelo menos um horário (Entregou ou Assumiu) antes de salvar.");
    if (horaEntregou && !motoristaAtual) return alert("Selecione o Motorista que Entregou o caminhão.");
    if (horaAssumiu && !motoristaProx) return alert("Selecione o Motorista que Assumiu o caminhão.");
    
    if (horaEntregou && horaAssumiu) {
        let [he_h, he_m] = horaEntregou.split(':').map(Number);
        let [ha_h, ha_m] = horaAssumiu.split(':').map(Number);
        let diff = (ha_h * 60 + ha_m) - (he_h * 60 + he_m);
        if (diff < 0) diff += 24 * 60;
        tempoTrocaMin = diff;
    }

    if (horaAssumiu) {
        let [ha_h, ha_m] = horaAssumiu.split(':').map(Number);
        horaPrevistaLargar = `${((ha_h + 12) % 24).toString().padStart(2, '0')}:${ha_m.toString().padStart(2, '0')}`;
    }

    const heInput = document.getElementById(`hora_entregou_${domId}`);
    const horaPrevistaLargarVal = heInput ? heInput.getAttribute('data-previsto') : null;
    
    if (horaEntregou && horaPrevistaLargarVal) {
        let [prev_h, prev_m] = horaPrevistaLargarVal.split(':').map(Number);
        let [he_h, he_m] = horaEntregou.split(':').map(Number);
        let diffDisp = (prev_h * 60 + prev_m) - (he_h * 60 + he_m);
        if (diffDisp < -12 * 60) diffDisp += 24 * 60;
        if (diffDisp > 12 * 60) diffDisp -= 24 * 60; 
        saldoMinutos = diffDisp;
    }

    const formatTime = (t) => t ? (t.length === 5 ? t + ':00' : t) : null;

    try {
        const queryExist = window.supabaseClient.from('troca_turno_linhares').select('id')
            .eq('data_referencia', dataRef).eq('cavalo', placa).eq('turno_referencia', turnoPrevisto);
            
        const { data: exist } = await window.aplicarFiltroFilial(queryExist).maybeSingle();
            
        const p = window.injetarFilial({ 
            data_referencia: dataRef, cavalo: placa, turno_referencia: turnoPrevisto, 
            motorista_entregou: motoristaAtual || null, motorista_assumiu: motoristaProx || null, 
            local_troca_id: localId || null, horario_entregou: formatTime(horaEntregou),
            horario_assumiu: formatTime(horaAssumiu), tempo_troca_minutos: tempoTrocaMin !== null && !isNaN(tempoTrocaMin) ? parseInt(tempoTrocaMin, 10) : null,
            horario_previsto_largar: formatTime(horaPrevistaLargar), saldo_minutos: saldoMinutos !== null && !isNaN(saldoMinutos) ? parseInt(saldoMinutos, 10) : null,
            observacao: obs || null
        });
        
        let res;
        if (exist) res = await window.supabaseClient.from('troca_turno_linhares').update(p).eq('id', exist.id);
        else res = await window.supabaseClient.from('troca_turno_linhares').insert([p]);
        
        if (res.error) throw res.error;
        alert("Registro Salvo com Sucesso!");
        window.carregarTrocasDoDia();
    } catch (e) { 
        console.error("Erro Supabase:", e);
        alert("Erro ao salvar: " + (e.message || "Verifique o console para mais detalhes.")); 
    }
}