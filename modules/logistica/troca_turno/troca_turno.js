// ==================== MÓDULO: TROCA DE TURNO (CRUZAMENTO SEGURO, HISTÓRICO E INDICADORES) ====================
window.locaisTrocaCache = [];
window.mapaTroca = null;
window.markerTroca = null;
window.mapaIndicadores = null;
window.layerGrupoBolas = null;
window.motSelectPendente = null; 
window.dadosHistoricoTrocasAtual = []; 
window.dadosIndicadoresBrutos = []; 

window.renderizarTrocaTurno = async function() {
    const inputTroca = document.getElementById('dataFiltroTroca');
    if (inputTroca && !inputTroca.value) {
        const agora = new Date();
        const ano = agora.getFullYear();
        const mes = String(agora.getMonth() + 1).padStart(2, '0');
        const dia = String(agora.getDate()).padStart(2, '0');
        inputTroca.value = `${ano}-${mes}-${dia}`;
    }
    
    await window.carregarLocaisTroca();
    await window.carregarTrocasDoDia();
}

window.iniciarMapaTroca = function() {
    if (window.mapaTroca) { window.mapaTroca.invalidateSize(); return; }
    window.mapaTroca = L.map('mapTroca').setView([-17.8876, -39.7342], 12);
    L.tileLayer('https://mt0.google.com/vt/lyrs=y&hl=pt-BR&x={x}&y={y}&z={z}', { maxZoom: 21 }).addTo(window.mapaTroca);
    
    window.mapaTroca.on('click', function(e) {
        if (window.markerTroca) window.mapaTroca.removeLayer(window.markerTroca);
        const { lat, lng } = e.latlng;
        window.markerTroca = L.marker([lat, lng]).addTo(window.mapaTroca).bindPopup("Local selecionado!").openPopup();
        document.getElementById('latLocal').value = lat;
        document.getElementById('lngLocal').value = lng;
    });
}

window.iniciarMapaIndicadores = function() {
    if (window.mapaIndicadores) { window.mapaIndicadores.invalidateSize(); return; }
    window.mapaIndicadores = L.map('mapIndicadoresTroca').setView([-17.8876, -39.7342], 7); 
    L.tileLayer('https://mt0.google.com/vt/lyrs=y&hl=pt-BR&x={x}&y={y}&z={z}', { maxZoom: 21 }).addTo(window.mapaIndicadores);
    window.layerGrupoBolas = L.layerGroup().addTo(window.mapaIndicadores);
}

window.toggleFullscreenMap = function() {
    const wrapper = document.getElementById('mapaIndicadoresWrapper');
    if (!document.fullscreenElement) {
        wrapper.requestFullscreen().catch(err => {
            alert(`Erro ao tentar modo tela cheia: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
}

document.addEventListener('fullscreenchange', () => {
    if (window.mapaIndicadores) {
        setTimeout(() => {
            window.mapaIndicadores.invalidateSize();
        }, 250);
    }
});

window.alternarAbaTroca = function(aba) {
    const abas = ['registros', 'performance', 'locais', 'historico', 'indicadores'];
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

    if (aba === 'registros') {
        window.carregarTrocasDoDia();
    } else if (aba === 'performance') {
        const inputDataPerf = document.getElementById('filtroDataPerformance');
        if (inputDataPerf && !inputDataPerf.value) {
            const agora = new Date();
            const ano = agora.getFullYear();
            const mes = String(agora.getMonth() + 1).padStart(2, '0');
            const dia = String(agora.getDate()).padStart(2, '0');
            inputDataPerf.value = `${ano}-${mes}-${dia}`;
        }
        window.carregarPerformanceTroca();
    } else if (aba === 'locais') {
        window.carregarLocaisTroca();
        setTimeout(() => {
            window.iniciarMapaTroca();
            if (window.mapaTroca) window.mapaTroca.invalidateSize();
        }, 250);
    } else if (aba === 'historico') {
        const inputDataHist = document.getElementById('filtroDataHistoricoTroca');
        if (inputDataHist && !inputDataHist.value) {
            const agora = new Date();
            const ano = agora.getFullYear();
            const mes = String(agora.getMonth() + 1).padStart(2, '0');
            const dia = String(agora.getDate()).padStart(2, '0');
            inputDataHist.value = `${ano}-${mes}-${dia}`;
        }
        window.popularFiltrosHistoricoTroca();
        window.carregarHistoricoTrocas();
    } else if (aba === 'indicadores') {
        const inputInd = document.getElementById('filtroTempoIndicadores');
        if (inputInd && !inputInd.value) inputInd.value = 'hoje';
        setTimeout(() => {
            window.iniciarMapaIndicadores();
            if (window.mapaIndicadores) window.mapaIndicadores.invalidateSize();
            window.carregarIndicadoresTroca();
        }, 250);
    }
}

window.carregarLocaisTroca = async function() {
    try {
        let query = window.supabaseClient.from('locais_troca').select('*').order('nome');
        query = window.aplicarFiltroFilial(query);

        const { data, error } = await query;
        if (!error && data) {
            window.locaisTrocaCache = data;
            const tbody = document.getElementById('tbodyLocaisTroca');
            if (tbody) {
                const isAdmin = (typeof currentUser !== 'undefined' && currentUser && (currentUser.role === 'Admin' || currentUser.role === 'SuperAdmin'));
                tbody.innerHTML = data.map(l => {
                    const btnExcluir = isAdmin 
                        ? `<button class="btn-danger" onclick="excluirLocalTroca('${l.id}')"><i class="fas fa-trash"></i></button>`
                        : `<span style="color: #64748b; font-size: 0.8rem;">Sem permissão</span>`;

                    return `
                    <tr>
                        <td style="font-weight:bold;">${l.nome}</td>
                        <td style="text-align:center;">
                            <a href="https://maps.google.com/?q=${l.latitude},${l.longitude}" target="_blank" class="badge-go">
                                <i class="fas fa-map-marker-alt"></i> Maps
                            </a>
                        </td>
                        <td style="text-align:center;">${btnExcluir}</td>
                    </tr>
                    `;
                }).join('');
            }
        }
    } catch (e) { console.error("Sem locais", e); }
}

window.salvarNovoLocalTroca = async function() {
    const nome = document.getElementById('novoLocalTroca').value.trim();
    const lat = document.getElementById('latLocal').value;
    const lng = document.getElementById('lngLocal').value;
    if (!nome || !lat) return alert("Dê um nome e marque no mapa antes de salvar!");
    try {
        const payload = window.injetarFilial({ nome, latitude: parseFloat(lat), longitude: parseFloat(lng) });
        await window.supabaseClient.from('locais_troca').insert([payload]);
        
        document.getElementById('novoLocalTroca').value = '';
        await window.carregarLocaisTroca();
    } catch (e) { alert("Erro ao salvar local."); }
}

window.excluirLocalTroca = async function(id) {
    if (typeof currentUser !== 'undefined' && currentUser && (currentUser.role !== 'Admin' && currentUser.role !== 'SuperAdmin')) {
        alert('Acesso Negado: Apenas Administradores podem excluir locais de troca.');
        return;
    }
    if (!confirm("Excluir este local?")) return;
    await window.supabaseClient.from('locais_troca').delete().eq('id', id);
    await window.carregarLocaisTroca();
}

window.calcularTempoTroca = function(domId) {
    const heInput = document.getElementById(`hora_entregou_${domId}`);
    const haInput = document.getElementById(`hora_assumiu_${domId}`);
    const he = heInput ? heInput.value : '';
    const ha = haInput ? haInput.value : '';
    const divTempo = document.getElementById(`tempo_troca_${domId}`);
    const divProx = document.getElementById(`prox_${domId}`);
    const alertaDisp = document.getElementById(`alerta_disp_${domId}`);

    // Projeção do Largar (Assumiu + 12h)
    if(ha) {
        let [h, m] = ha.split(':').map(Number);
        divProx.innerText = `${((h + 12) % 24).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    } else {
        divProx.innerText = '--:--';
    }

    // Cálculo do Tempo Gasto na troca
    if(he && ha) {
        let [he_h, he_m] = he.split(':').map(Number);
        let [ha_h, ha_m] = ha.split(':').map(Number);
        let minE = he_h * 60 + he_m;
        let minA = ha_h * 60 + ha_m;
        
        let diff = minA - minE;
        if (diff < 0) diff += 24 * 60; // Passou da meia noite

        let diffH = Math.floor(diff / 60);
        let diffM = diff % 60;
        
        let color = diff > 30 ? '#ef4444' : '#4ade80'; 
        divTempo.innerHTML = `<span style="color:${color}; font-weight:bold; font-size:1.1rem;">${diffH}h ${diffM}m</span>`;
    } else {
        divTempo.innerText = '--';
    }

    // Cálculo dinâmico do Tempo Disponível / Atraso (Entregou x Previsto Largar)
    if (heInput && alertaDisp) {
        const previsto = heInput.getAttribute('data-previsto');
        if (previsto && he) {
            let [prev_h, prev_m] = previsto.split(':').map(Number);
            let [he_h, he_m] = he.split(':').map(Number);
            
            let minPrev = prev_h * 60 + prev_m;
            let minE = he_h * 60 + he_m;
            
            let diffDisp = minPrev - minE;
            
            if (diffDisp < -12 * 60) diffDisp += 24 * 60;
            if (diffDisp > 12 * 60) diffDisp -= 24 * 60; 

            if (diffDisp > 0) {
                let dispH = Math.floor(diffDisp / 60);
                let dispM = diffDisp % 60;
                alertaDisp.innerHTML = `<span style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; padding: 2px 6px; border-radius: 4px; font-weight: bold; border: 1px solid #3b82f6; font-size: 0.75rem;">+${dispH}h ${dispM}m Disp</span>`;
            } else if (diffDisp < 0) {
                let excesso = Math.abs(diffDisp);
                let excH = Math.floor(excesso / 60);
                let excM = excesso % 60;
                alertaDisp.innerHTML = `<span style="background: rgba(239, 68, 68, 0.2); color: #f87171; padding: 2px 6px; border-radius: 4px; font-weight: bold; border: 1px solid #ef4444; font-size: 0.75rem;">-${excH}h ${excM}m Atraso</span>`;
            } else {
                alertaDisp.innerHTML = `<span style="background: rgba(16, 185, 129, 0.2); color: #4ade80; padding: 2px 6px; border-radius: 4px; font-weight: bold; border: 1px solid #10b981; font-size: 0.75rem;">Exato</span>`;
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
    
    if (original && atual !== original && atual !== "") {
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

function getShiftValue(dateStr, turnoName) {
    if(!dateStr) return 0;
    let d = new Date(dateStr + "T00:00:00");
    let val = d.getTime();
    if (turnoName && (turnoName.includes("2") || turnoName.toUpperCase().includes("NOITE"))) {
        val += 12 * 60 * 60 * 1000;
    }
    return val;
}

window.carregarTrocasDoDia = async function() {
    const dataRef = document.getElementById('dataFiltroTroca').value;
    const tbody = document.getElementById('tbodyTrocaTurno');
    if (!tbody || !dataRef) return;
    
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px;">Processando frotas, turnos e continuidade...</td></tr>`;
    
    try {
        const isLinhares = (typeof currentUser !== 'undefined' && currentUser && String(currentUser.filial_id) === '7');
        let registros = [];
        let linhasData = [];
        const mLista = (typeof motoristas !== 'undefined') ? motoristas : (window.motoristas || []);

        if (isLinhares) {
            const dFiltro = new Date(dataRef + "T12:00:00");
            dFiltro.setDate(dFiltro.getDate() - 5);
            const dataLimiteStr = dFiltro.toISOString().split('T')[0];
            
            let historicoGeralLinhares = [];
            try {
                const { data } = await window.supabaseClient.from('troca_turno_linhares')
                    .select('*')
                    .gte('data_referencia', dataLimiteStr)
                    .lte('data_referencia', dataRef)
                    .order('data_referencia', { ascending: false })
                    .order('id', { ascending: false });
                if (data) historicoGeralLinhares = data;
            } catch(e) { console.warn("Erro supabase troca_turno_linhares", e); }

            registros = historicoGeralLinhares;

            const { data: frotaLinhares } = await window.supabaseClient.from('frotas_manutencao')
                .select('*').eq('filial_id', 7).eq('status', 'Ativo').eq('categoria', 'TRITREM');

            if (!frotaLinhares || frotaLinhares.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:#f1c40f;">Nenhuma frota TRITREM ativa encontrada para Linhares.</td></tr>`;
                return;
            }

            frotaLinhares.forEach((f) => {
                const placaNorm = f.cavalo ? String(f.cavalo).trim().toUpperCase() : '-';
                const go = f.frota || '-';
                const conjId = f.numero_frota || '-';
                
                linhasData.push({ conjId: conjId, go: go, placaNorm: placaNorm, esc: { nome: null, turno: 'Turno 1', originalTurno: 'Turno 1' }, idxTurno: 0, ordemTurno: 1 });
                linhasData.push({ conjId: conjId, go: go, placaNorm: placaNorm, esc: { nome: null, turno: 'Turno 2', originalTurno: 'Turno 2' }, idxTurno: 1, ordemTurno: 2 });
            });

        } else {
            try {
                let query = window.supabaseClient.from('registro_troca_turno').select('*').eq('data_referencia', dataRef);
                query = window.aplicarFiltroFilial(query);
                const res = await query;
                if (res.data) registros = res.data;
            } catch(e) { console.warn("Erro supabase registro_troca_turno", e); }
            
            const cLista = (typeof conjuntos !== 'undefined') ? conjuntos : (window.conjuntos || []);
            if (cLista.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:#f1c40f;">Nenhum Conjunto encontrado na memória do sistema.</td></tr>`;
                return;
            }

            cLista.forEach(conj => {
                if (!conj.caminhoes || conj.caminhoes.length === 0) return;
                conj.caminhoes.forEach((cam, idxCam) => {
                    const placa = typeof cam === 'string' ? cam : cam.placa;
                    const go = typeof cam === 'string' ? '-' : (cam.go || '-');
                    const placaNorm = String(placa).trim().toUpperCase();
                    
                    let motoristasHoje = [];
                    mLista.forEach(m => {
                        if (typeof window.getEscalaDiaComputada === 'function') {
                            const esc = window.getEscalaDiaComputada(m, dataRef);
                            if (String(esc.caminhao).trim().toUpperCase() === placaNorm && esc.caminhao !== 'F') {
                                let turnoFormatado = esc.turno || m.turno || 'Indefinido';
                                motoristasHoje.push({ nome: m.nome, turno: turnoFormatado, originalTurno: esc.turno || m.turno });
                            }
                        }
                    });
                    
                    if (motoristasHoje.length === 0) motoristasHoje.push({ nome: null, turno: 'Sem Escala', originalTurno: 'Sem Escala' });

                    motoristasHoje.forEach((esc, idxTurno) => {
                        linhasData.push({ conjId: conj.id || conj.codigo || '-', go: go, placaNorm: placaNorm, esc: esc, idxTurno: idxTurno, ordemTurno: idxTurno });
                    });
                });
            });
        }

        linhasData.sort((a, b) => {
            if (a.ordemTurno !== b.ordemTurno) return a.ordemTurno - b.ordemTurno;
            return Number(a.conjId) - Number(b.conjId);
        });

        const mListaOrdenada = [...mLista].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

        let lastPlacaSeparador = null;
        let html = '';

        linhasData.forEach((linha, indiceGlobal) => {
            const { conjId, go, placaNorm, esc, idxTurno } = linha;
            const domId = `${placaNorm.replace(/[^A-Z0-9]/g, '')}_${idxTurno}_${indiceGlobal}`; 
            
            // ESPAÇAMENTO ENTRE CAMINHÕES DIFERENTES
            if (lastPlacaSeparador && lastPlacaSeparador !== placaNorm) {
                html += `<tr style="height: 12px; background: transparent;"><td colspan="8" style="border: none; padding: 0; box-shadow: none;"></td></tr>`;
            }
            lastPlacaSeparador = placaNorm;

            let reg = null;
            let ultimoReg = null;
            let motoristaAtualSalvo = '';
            let motoristaProxSalvo = '';
            let horarioEntregou = '';
            let horarioAssumiu = '';
            let obsReal = '';
            let diffRender = '--';
            let labelPrevisto = '';
            let horarioPrevistoLargarVal = ''; 

            if (isLinhares) {
                let currentShiftVal = getShiftValue(dataRef, esc.originalTurno);
                let historicoPlaca = registros.filter(r => r.cavalo.toUpperCase() === placaNorm);
                
                let maxVal = -1;
                for (let r of historicoPlaca) {
                    let val = getShiftValue(r.data_referencia, r.turno_referencia);
                    if (val === currentShiftVal) {
                        reg = r;
                    } else if (val < currentShiftVal && val > maxVal) {
                        maxVal = val;
                        ultimoReg = r;
                    }
                }

                if (reg) {
                    horarioEntregou = reg.horario_entregou ? reg.horario_entregou.substring(0,5) : '';
                    horarioAssumiu = reg.horario_assumiu ? reg.horario_assumiu.substring(0,5) : '';
                    obsReal = reg.observacao || '';
                    motoristaProxSalvo = reg.motorista_assumiu || '';
                    
                    if (reg.tempo_troca_minutos !== null && reg.tempo_troca_minutos !== undefined) {
                        let diffH = Math.floor(reg.tempo_troca_minutos / 60);
                        let diffM = reg.tempo_troca_minutos % 60;
                        let color = reg.tempo_troca_minutos > 30 ? '#ef4444' : '#4ade80';
                        diffRender = `<span style="color:${color}; font-weight:bold; font-size:1.1rem;">${diffH}h ${diffM}m</span>`;
                    }
                }

                motoristaAtualSalvo = (reg && reg.motorista_entregou) ? reg.motorista_entregou : (ultimoReg ? ultimoReg.motorista_assumiu : '');

                let dataInicioFmt = '--/--';
                let horaInicioFmt = '--:--';
                
                if (ultimoReg) {
                    if (ultimoReg.horario_previsto_largar) horarioPrevistoLargarVal = ultimoReg.horario_previsto_largar.substring(0, 5);
                    if (ultimoReg.data_referencia) dataInicioFmt = ultimoReg.data_referencia.split('-').reverse().slice(0,2).join('/');
                    if (ultimoReg.horario_assumiu) horaInicioFmt = ultimoReg.horario_assumiu.substring(0, 5);
                }

                let diffDispHTML = '';
                if (horarioEntregou && horarioPrevistoLargarVal) {
                    let [prev_h, prev_m] = horarioPrevistoLargarVal.split(':').map(Number);
                    let [he_h, he_m] = horarioEntregou.split(':').map(Number);
                    let minPrev = prev_h * 60 + prev_m;
                    let minE = he_h * 60 + he_m;
                    let diffDisp = minPrev - minE;
                    
                    if (diffDisp < -12 * 60) diffDisp += 24 * 60;
                    if (diffDisp > 12 * 60) diffDisp -= 24 * 60; 

                    if (diffDisp > 0) {
                        let dispH = Math.floor(diffDisp / 60);
                        let dispM = diffDisp % 60;
                        diffDispHTML = `<span style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; padding: 2px 6px; border-radius: 4px; font-weight: bold; border: 1px solid #3b82f6; font-size: 0.75rem;">+${dispH}h ${dispM}m Disp</span>`;
                    } else if (diffDisp < 0) {
                        let excesso = Math.abs(diffDisp);
                        let excH = Math.floor(excesso / 60);
                        let excM = excesso % 60;
                        diffDispHTML = `<span style="background: rgba(239, 68, 68, 0.2); color: #f87171; padding: 2px 6px; border-radius: 4px; font-weight: bold; border: 1px solid #ef4444; font-size: 0.75rem;">-${excH}h ${excM}m Atraso</span>`;
                    } else {
                        diffDispHTML = `<span style="background: rgba(16, 185, 129, 0.2); color: #4ade80; padding: 2px 6px; border-radius: 4px; font-weight: bold; border: 1px solid #10b981; font-size: 0.75rem;">Exato</span>`;
                    }
                }

                if (horarioPrevistoLargarVal) {
                    labelPrevisto = `
                        <div style="font-size:0.75rem; color:#94a3b8; margin-top:6px; display:flex; align-items:center;">
                            Previsto: <b style="color:#fbbf24; margin:0 4px;">${horarioPrevistoLargarVal}</b> 
                            <span style="font-size:0.65rem; color:#64748b; margin-right:5px;">(Assumiu ${dataInicioFmt} às ${horaInicioFmt})</span>
                            <span id="alerta_disp_${domId}">${diffDispHTML}</span>
                        </div>
                    `;
                } else {
                    labelPrevisto = `<div style="font-size:0.75rem; color:#64748b; margin-top:6px;">Sem histórico de entrega</div>`;
                }

            } else {
                reg = registros.find(r => r.placa_cavalo.toUpperCase() === placaNorm && (r.turno_previsto === esc.turno || r.turno_previsto === esc.originalTurno)) || {};
                motoristaAtualSalvo = reg.motorista_atual || '';
                motoristaProxSalvo = reg.motorista_programado || esc.nome || '';
                horarioAssumiu = reg.horario_real ? reg.horario_real.substring(0,5) : '';
                obsReal = reg.observacao || '';
            }
            
            let proximaTroca = '--:--';
            if(horarioAssumiu) {
                let [h, m] = horarioAssumiu.split(':').map(Number);
                proximaTroca = `${((h + 12) % 24).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            }

            let selectMotAtual = `<select id="mot_atual_${domId}" class="input-moderno" style="margin:0;"><option value="">-- Entregando --</option>`;
            mListaOrdenada.forEach(m => { selectMotAtual += `<option value="${m.nome}" ${m.nome === motoristaAtualSalvo ? 'selected' : ''}>${m.nome}</option>`; });
            selectMotAtual += `</select>`;

            let selectMotProx = `<select id="mot_prox_${domId}" class="input-moderno" data-original="${esc.nome || ''}" onchange="verificarMudancaMotorista('${domId}')" style="margin:0;"><option value="">-- Assumindo --</option>`;
            mListaOrdenada.forEach(m => { selectMotProx += `<option value="${m.nome}" ${m.nome === motoristaProxSalvo ? 'selected' : ''}>${m.nome}</option>`; });
            selectMotProx += `</select>`;

            let selectLocal = `<select id="local_${domId}" class="input-moderno" style="margin:0;"><option value="">Selecione...</option>`;
            window.locaisTrocaCache.forEach(l => {
                const isSelected = (reg && reg.local_troca_id === l.id) ? 'selected' : '';
                selectLocal += `<option value="${l.id}" ${isSelected}>${l.nome}</option>`;
            });
            selectLocal += `</select>`;

            // LÓGICA DE CORES E ÍCONES BASEADA NO TURNO (DIA vs NOITE)
            const isNoite = esc.originalTurno && (esc.originalTurno.includes("2") || esc.originalTurno.toUpperCase().includes("NOITE"));
            let baseBgColor = isNoite ? 'rgba(99, 102, 241, 0.12)' : 'rgba(56, 189, 248, 0.12)'; 
            let baseBorder = isNoite ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(56, 189, 248, 0.3)';
            let baseHover = isNoite ? 'rgba(99, 102, 241, 0.2)' : 'rgba(56, 189, 248, 0.2)';
            let iconeTurno = isNoite ? '<i class="fas fa-moon" style="color: #a5b4fc;"></i>' : '<i class="fas fa-sun" style="color: #fde047;"></i>';
            let corBadge = isNoite ? 'background: rgba(99, 102, 241, 0.25); color: #c7d2fe; border: 1px solid rgba(99, 102, 241, 0.5);' : 'background: rgba(56, 189, 248, 0.25); color: #bae6fd; border: 1px solid rgba(56, 189, 248, 0.5);';

            let inputHoraEntregou = isLinhares ? `<input type="time" id="hora_entregou_${domId}" data-previsto="${horarioPrevistoLargarVal}" class="input-moderno" value="${horarioEntregou}" onchange="calcularTempoTroca('${domId}')" title="Horário que entregou o caminhão" style="margin:0;">` : '<span style="font-size:0.8rem;color:#64748b;">N/A Filial</span>';

            html += `
                <tr id="tr_${domId}" style="background: ${baseBgColor}; border-bottom: ${baseBorder}; transition: all 0.3s ease;" onmouseover="this.style.background='${baseHover}'" onmouseout="this.style.background='${baseBgColor}'">
                    <td style="vertical-align: middle;">
                        <div style="display: flex; flex-direction: column; gap: 6px; align-items: flex-start;">
                            <span style="font-weight: 900; color: #fff; font-size: 1.15rem; letter-spacing: 1px;">${placaNorm}</span>
                            ${isLinhares ? `<span class="badge-turno" style="font-size:0.75rem; padding: 3px 8px; ${corBadge}">${iconeTurno}${esc.turno || 'Indefinido'}</span>` : ''}
                        </div>
                    </td>
                    <td style="vertical-align: middle;">
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <div style="flex: 1; min-width: 150px;">${selectMotAtual}</div>
                            <div style="width: 110px;">${inputHoraEntregou}</div>
                        </div>
                        ${isLinhares ? `${labelPrevisto}` : ''}
                    </td>
                    <td style="vertical-align: middle;">
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <div style="flex: 1; min-width: 150px;">${selectMotProx}</div>
                            <div style="width: 110px;"><input type="time" id="hora_assumiu_${domId}" class="input-moderno" value="${horarioAssumiu}" onchange="calcularTempoTroca('${domId}')" title="Horário que assumiu o caminhão" style="margin:0;"></div>
                        </div>
                    </td>
                    <td style="vertical-align: middle;">${selectLocal}</td>
                    <td style="text-align: center; vertical-align: middle;"><span id="tempo_troca_${domId}">${diffRender}</span></td>
                    <td style="text-align: center; vertical-align: middle;"><span id="prox_${domId}" class="hora-estimada">${proximaTroca}</span></td>
                    <td style="vertical-align: middle;">
                        <input type="text" id="obs_${domId}" class="input-moderno" placeholder="Observações..." value="${obsReal}" style="margin:0;">
                    </td>
                    <td style="vertical-align: middle;"><button class="btn-primary-green" onclick="salvarTroca('${domId}', '${placaNorm}', '${esc.originalTurno}')" style="width:100%; padding:8px;"><i class="fas fa-save"></i> Salvar</button></td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        
    } catch (e) {
        console.error("Erro na varredura", e);
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px; color:#ef4444;">Erro ao cruzar os dados. Veja o console.</td></tr>`;
    }
}

window.salvarTroca = async function(domId, placa, turnoPrevisto) {
    const dataRef = document.getElementById('dataFiltroTroca').value;
    const motoristaAtual = document.getElementById(`mot_atual_${domId}`).value;
    const motoristaProx = document.getElementById(`mot_prox_${domId}`).value;
    const localId = document.getElementById(`local_${domId}`).value;
    const horaAssumiu = document.getElementById(`hora_assumiu_${domId}`).value;
    const obs = document.getElementById(`obs_${domId}`).value.trim();
    
    const isLinhares = (typeof currentUser !== 'undefined' && currentUser && String(currentUser.filial_id) === '7');
    let horaEntregou = null;
    let tempoTrocaMin = null;
    let horaPrevistaLargar = null;
    let saldoMinutos = null;

    if (isLinhares) {
        horaEntregou = document.getElementById(`hora_entregou_${domId}`).value;
        if (!localId || !horaAssumiu || !motoristaAtual || !motoristaProx || !horaEntregou) {
            return alert("Preencha Motorista Atual, Próximo Motorista, Local e todos os Horários antes de salvar.");
        }
        
        let [he_h, he_m] = horaEntregou.split(':').map(Number);
        let [ha_h, ha_m] = horaAssumiu.split(':').map(Number);
        let diff = (ha_h * 60 + ha_m) - (he_h * 60 + he_m);
        if (diff < 0) diff += 24 * 60;
        tempoTrocaMin = diff;
        
        horaPrevistaLargar = `${((ha_h + 12) % 24).toString().padStart(2, '0')}:${ha_m.toString().padStart(2, '0')}`;

        // Cálculo do Saldo para salvar no banco
        const heInput = document.getElementById(`hora_entregou_${domId}`);
        const horaPrevistaLargarVal = heInput ? heInput.getAttribute('data-previsto') : null;
        
        if (horaEntregou && horaPrevistaLargarVal) {
            let [prev_h, prev_m] = horaPrevistaLargarVal.split(':').map(Number);
            let minPrev = prev_h * 60 + prev_m;
            let minE = he_h * 60 + he_m;
            
            let diffDisp = minPrev - minE;
            if (diffDisp < -12 * 60) diffDisp += 24 * 60;
            if (diffDisp > 12 * 60) diffDisp -= 24 * 60; 
            
            saldoMinutos = diffDisp;
        }

    } else {
        if (!localId || !horaAssumiu) return alert("Preencha Local e Horário antes de salvar.");
    }

    const formatTime = (t) => {
        if (!t) return null;
        return t.length === 5 ? t + ':00' : t;
    };

    try {
        if (isLinhares) {
            const { data: exist } = await window.supabaseClient.from('troca_turno_linhares').select('id')
                .eq('data_referencia', dataRef).eq('cavalo', placa).eq('turno_referencia', turnoPrevisto).maybeSingle();
                
            const p = { 
                data_referencia: dataRef, 
                cavalo: placa, 
                turno_referencia: turnoPrevisto, 
                motorista_entregou: motoristaAtual || null, 
                motorista_assumiu: motoristaProx || null, 
                local_troca_id: localId ? parseInt(localId, 10) : null, 
                horario_entregou: formatTime(horaEntregou),
                horario_assumiu: formatTime(horaAssumiu),
                tempo_troca_minutos: tempoTrocaMin !== null && !isNaN(tempoTrocaMin) ? parseInt(tempoTrocaMin, 10) : null,
                horario_previsto_largar: formatTime(horaPrevistaLargar), 
                saldo_minutos: saldoMinutos !== null && !isNaN(saldoMinutos) ? parseInt(saldoMinutos, 10) : null,
                observacao: obs || null, 
                filial_id: 7
            };
            
            let res;
            if (exist) {
                res = await window.supabaseClient.from('troca_turno_linhares').update(p).eq('id', exist.id);
            } else {
                res = await window.supabaseClient.from('troca_turno_linhares').insert([p]);
            }
            if (res.error) throw res.error;
            
        } else {
            let queryValida = window.supabaseClient.from('registro_troca_turno').select('id')
                .eq('data_referencia', dataRef).eq('placa_cavalo', placa).eq('turno_previsto', turnoPrevisto);
            queryValida = window.aplicarFiltroFilial(queryValida);
            const { data: exist } = await queryValida.maybeSingle();
                
            const p = window.injetarFilial({ 
                data_referencia: dataRef, 
                placa_cavalo: placa, 
                turno_previsto: turnoPrevisto, 
                motorista_atual: motoristaAtual || null, 
                motorista_programado: motoristaProx || null, 
                local_troca_id: localId ? parseInt(localId, 10) : null, 
                horario_real: formatTime(horaAssumiu), 
                observacao: obs || null 
            });
            
            let res;
            if (exist) {
                res = await window.supabaseClient.from('registro_troca_turno').update(p).eq('id', exist.id);
            } else {
                res = await window.supabaseClient.from('registro_troca_turno').insert([p]);
            }
            if (res.error) throw res.error;
        }
        
        alert("Registro Salvo com Sucesso!");
        window.carregarTrocasDoDia();
    } catch (e) { 
        console.error("Erro Supabase:", e);
        alert("Erro ao salvar: " + (e.message || "Verifique o console para mais detalhes.")); 
    }
}

window.carregarPerformanceTroca = async function() {
    const isLinhares = (typeof currentUser !== 'undefined' && currentUser && String(currentUser.filial_id) === '7');
    if (!isLinhares) {
        document.getElementById('tbodyPerformance').innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#f59e0b;">Este painel de performance é exclusivo da filial Linhares (Tritrens).</td></tr>`;
        return;
    }

    const inputFiltro = document.getElementById('filtroDataPerformance');
    let dataFiltro = inputFiltro ? inputFiltro.value : null;

    if (!dataFiltro) {
        const agora = new Date();
        const ano = agora.getFullYear();
        const mes = String(agora.getMonth() + 1).padStart(2, '0');
        const dia = String(agora.getDate()).padStart(2, '0');
        dataFiltro = `${ano}-${mes}-${dia}`;
        if (inputFiltro) inputFiltro.value = dataFiltro;
    }

    document.getElementById('tbodyPerformance').innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px;"><i class="fas fa-spinner fa-spin"></i> Carregando métricas...</td></tr>`;

    if (window.locaisTrocaCache.length === 0) {
        let resLocaisQuery = window.supabaseClient.from('locais_troca').select('*');
        resLocaisQuery = window.aplicarFiltroFilial(resLocaisQuery);
        const resLocais = await resLocaisQuery;
        if (resLocais.data) window.locaisTrocaCache = resLocais.data;
    }

    try {
        let query = window.supabaseClient.from('troca_turno_linhares')
            .select('*')
            .not('tempo_troca_minutos', 'is', null)
            .eq('data_referencia', dataFiltro)
            .order('data_referencia', { ascending: false });

        const { data, error } = await query.limit(500);

        if (error) throw error;

        if (!data || data.length === 0) {
            document.getElementById('tbodyPerformance').innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#94a3b8;">Nenhum registro com tempo validado nesta data.</td></tr>`;
            document.getElementById('kpiMediaTroca').innerText = '0 min';
            document.getElementById('kpiSlaTroca').innerText = '0';
            document.getElementById('kpiMelhorTroca').innerHTML = '-';
            document.getElementById('kpiSaldoDisp').innerText = '0h 0m';
            document.getElementById('kpiEstourou').innerText = '0';
            return;
        }

        let totalMinutos = 0;
        let acimaDe30 = 0;
        let melhorTempo = 9999;
        let melhorPlaca = '';
        let totalSaldoPositivo = 0;
        let estourouCount = 0;
        let tableHtml = '';

        data.forEach(d => {
            totalMinutos += d.tempo_troca_minutos;
            if (d.tempo_troca_minutos > 30) acimaDe30++;
            
            if (d.tempo_troca_minutos > 0 && d.tempo_troca_minutos < melhorTempo) {
                melhorTempo = d.tempo_troca_minutos;
                melhorPlaca = d.cavalo;
            }

            let diffH = Math.floor(d.tempo_troca_minutos / 60);
            let diffM = d.tempo_troca_minutos % 60;
            let color = d.tempo_troca_minutos > 30 ? '#ef4444' : '#4ade80';
            let dataFormatada = d.data_referencia ? d.data_referencia.split('-').reverse().join('/') : '-';
            
            const local = window.locaisTrocaCache.find(l => String(l.id) === String(d.local_troca_id));
            let localNome = local ? local.nome : 'N/A';

            let saldoHtml = '--';
            if (d.saldo_minutos !== null && d.saldo_minutos !== undefined) {
                if (d.saldo_minutos > 0) {
                    totalSaldoPositivo += d.saldo_minutos;
                    let dispH = Math.floor(d.saldo_minutos / 60);
                    let dispM = d.saldo_minutos % 60;
                    saldoHtml = `<span style="color:#60a5fa; font-weight:bold;">+${dispH}h ${dispM}m</span>`;
                } else if (d.saldo_minutos < 0) {
                    estourouCount++;
                    let excesso = Math.abs(d.saldo_minutos);
                    let excH = Math.floor(excesso / 60);
                    let excM = excesso % 60;
                    saldoHtml = `<span style="color:#f87171; font-weight:bold;">-${excH}h ${excM}m</span>`;
                } else {
                    saldoHtml = `<span style="color:#4ade80; font-weight:bold;">Exato</span>`;
                }
            }

            tableHtml += `
                <tr>
                    <td style="text-align: center; color: #94a3b8; font-weight: bold;">${dataFormatada}</td>
                    <td style="font-weight: bold; color: var(--ccol-blue-bright);">${d.cavalo}</td>
                    <td style="color: #cbd5e1;">${d.motorista_entregou || '-'}</td>
                    <td style="color: #cbd5e1;">${d.motorista_assumiu || '-'}</td>
                    <td style="text-align: center; font-weight: bold; color: ${color}; font-size: 1.05rem;">${diffH}h ${diffM}m</td>
                    <td style="text-align: center; font-size: 1.05rem;">${saldoHtml}</td>
                    <td>${localNome}</td>
                </tr>
            `;
        });

        let media = Math.round(totalMinutos / data.length);
        document.getElementById('kpiMediaTroca').innerText = media + ' min';
        document.getElementById('kpiSlaTroca').innerText = acimaDe30;
        
        if (melhorTempo !== 9999) {
            let mH = Math.floor(melhorTempo / 60);
            let mM = melhorTempo % 60;
            let strMelhor = mH > 0 ? `${mH}h ${mM}m` : `${mM} min`;
            document.getElementById('kpiMelhorTroca').innerHTML = `${strMelhor} <br><span style="font-size:0.9rem; color:#cbd5e1; font-weight:normal;">${melhorPlaca}</span>`;
        }

        let totalHorasPos = Math.floor(totalSaldoPositivo / 60);
        let totalMinPos = totalSaldoPositivo % 60;
        document.getElementById('kpiSaldoDisp').innerText = `${totalHorasPos}h ${totalMinPos}m`;
        document.getElementById('kpiEstourou').innerText = estourouCount;

        document.getElementById('tbodyPerformance').innerHTML = tableHtml;

    } catch (e) {
        console.error("Erro na performance", e);
        document.getElementById('tbodyPerformance').innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#ef4444;">Erro ao carregar métricas.</td></tr>`;
    }
}

window.popularFiltrosHistoricoTroca = function() {
    const selectPlaca = document.getElementById('filtroPlacaHistoricoTroca');
    const selectMot = document.getElementById('filtroMotoristaHistoricoTroca');
    if (!selectPlaca || !selectMot) return;

    const mLista = (typeof motoristas !== 'undefined') ? motoristas : (window.motoristas || []);
    let htmlMot = '<option value="">Todos os Motoristas</option>';
    const mOrdenados = [...mLista].sort((a,b) => a.nome.localeCompare(b.nome));
    mOrdenados.forEach(m => { htmlMot += `<option value="${m.nome}">${m.nome}</option>`; });
    
    const valMotAtual = selectMot.value;
    selectMot.innerHTML = htmlMot;
    selectMot.value = valMotAtual;

    const cLista = (typeof conjuntos !== 'undefined') ? conjuntos : (window.conjuntos || []);
    let placas = [];
    cLista.forEach(c => {
        if (c.caminhoes) {
            c.caminhoes.forEach(cam => {
                const p = typeof cam === 'string' ? cam : cam.placa;
                if (p && !placas.includes(p.toUpperCase())) placas.push(p.toUpperCase());
            });
        }
    });
    
    placas.sort();
    let htmlPlaca = '<option value="">Todas as Placas</option>';
    placas.forEach(p => { htmlPlaca += `<option value="${p}">${p}</option>`; });
    
    const valPlacaAtual = selectPlaca.value;
    selectPlaca.innerHTML = htmlPlaca;
    selectPlaca.value = valPlacaAtual;
}

window.carregarHistoricoTrocas = async function() {
    const dataFiltro = document.getElementById('filtroDataHistoricoTroca').value;
    const placaFiltro = document.getElementById('filtroPlacaHistoricoTroca').value;
    const motoristaFiltro = document.getElementById('filtroMotoristaHistoricoTroca').value;
    const tbody = document.getElementById('tbodyHistoricoTroca');
    if (!tbody) return;

    if (!dataFiltro && !placaFiltro && !motoristaFiltro) {
        window.dadosHistoricoTrocasAtual = []; 
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px; color:#94a3b8;">Por favor, selecione uma placa, um motorista ou escolha a data para exibir os registros.</td></tr>`;
        return;
    }

    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Buscando histórico no banco de dados...</td></tr>`;

    try {
        const isLinhares = (typeof currentUser !== 'undefined' && currentUser && String(currentUser.filial_id) === '7');
        
        let query;
        if (isLinhares) {
            query = window.supabaseClient.from('troca_turno_linhares').select('*').order('data_referencia', { ascending: false }).limit(200);
            if (dataFiltro) query = query.eq('data_referencia', dataFiltro);
            if (placaFiltro) query = query.eq('cavalo', placaFiltro);
            if (motoristaFiltro) query = query.eq('motorista_assumiu', motoristaFiltro);
        } else {
            query = window.supabaseClient.from('registro_troca_turno').select('*').order('data_referencia', { ascending: false }).limit(200);
            query = window.aplicarFiltroFilial(query);
            if (dataFiltro) query = query.eq('data_referencia', dataFiltro);
            if (placaFiltro) query = query.eq('placa_cavalo', placaFiltro);
            if (motoristaFiltro) query = query.eq('motorista_programado', motoristaFiltro);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (!data || data.length === 0) {
            window.dadosHistoricoTrocasAtual = []; 
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px; color:#f59e0b;"><i class="fas fa-exclamation-triangle"></i> Nenhum registro encontrado.</td></tr>`;
            return;
        }

        window.dadosHistoricoTrocasAtual = data.map(r => {
            if (isLinhares) {
                return {
                    id: r.id, data_referencia: r.data_referencia, placa_cavalo: r.cavalo,
                    turno_previsto: r.turno_referencia, motorista_atual: r.motorista_entregou,
                    motorista_programado: r.motorista_assumiu, local_troca_id: r.local_troca_id,
                    horario_real: r.horario_assumiu, horario_entregou: r.horario_entregou, 
                    tempo_troca_minutos: r.tempo_troca_minutos, observacao: r.observacao
                };
            }
            return r;
        });

        if (window.locaisTrocaCache.length === 0) {
            let resLocaisQuery = window.supabaseClient.from('locais_troca').select('*');
            resLocaisQuery = window.aplicarFiltroFilial(resLocaisQuery);
            const resLocais = await resLocaisQuery;
            if (resLocais.data) window.locaisTrocaCache = resLocais.data;
        }

        tbody.innerHTML = window.dadosHistoricoTrocasAtual.map(reg => {
            const local = window.locaisTrocaCache.find(l => String(l.id) === String(reg.local_troca_id));
            const localNome = local ? local.nome : 'Local Desconhecido';
            const dataFormatada = reg.data_referencia ? reg.data_referencia.split('-').reverse().join('/') : '-';
            const obsFormatada = reg.observacao ? reg.observacao : '-';
            
            let htmlTempos = '';
            if (isLinhares) {
                htmlTempos = `Entregou: <b>${reg.horario_entregou ? reg.horario_entregou.substring(0,5) : '--'}</b><br>Assumiu: <b>${reg.horario_real ? reg.horario_real.substring(0,5) : '--'}</b>`;
            } else {
                htmlTempos = `Real: <b>${reg.horario_real || '--'}</b>`;
            }
            
            let diffRender = '--';
            if (reg.tempo_troca_minutos !== undefined && reg.tempo_troca_minutos !== null) {
                let diffH = Math.floor(reg.tempo_troca_minutos / 60);
                let diffM = reg.tempo_troca_minutos % 60;
                let color = reg.tempo_troca_minutos > 30 ? '#ef4444' : '#4ade80';
                diffRender = `<span style="color:${color}; font-weight:bold;">${diffH}h ${diffM}m</span>`;
            }

            // LÓGICA DE CORES E ÍCONES BASEADA NO TURNO PARA O HISTÓRICO
            const isNoite = reg.turno_previsto && (reg.turno_previsto.includes("2") || reg.turno_previsto.toUpperCase().includes("NOITE"));
            let baseBgColor = isNoite ? 'rgba(99, 102, 241, 0.12)' : 'rgba(56, 189, 248, 0.12)'; 
            let baseHover = isNoite ? 'rgba(99, 102, 241, 0.2)' : 'rgba(56, 189, 248, 0.2)';
            let baseBorder = isNoite ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid rgba(56, 189, 248, 0.2)';
            let iconeTurno = isNoite ? '<i class="fas fa-moon" style="color: #a5b4fc;"></i>' : '<i class="fas fa-sun" style="color: #fde047;"></i>';
            let corBadge = isNoite ? 'background: rgba(99, 102, 241, 0.25); color: #c7d2fe; border: 1px solid rgba(99, 102, 241, 0.5);' : 'background: rgba(56, 189, 248, 0.25); color: #bae6fd; border: 1px solid rgba(56, 189, 248, 0.5);';

            return `
                <tr style="border-bottom: ${baseBorder}; background: ${baseBgColor}; transition: all 0.3s ease;" onmouseover="this.style.background='${baseHover}'" onmouseout="this.style.background='${baseBgColor}'">
                    <td style="text-align: center; color: #94a3b8; font-weight: bold;">${dataFormatada}</td>
                    <td style="font-weight: bold; color: var(--ccol-blue-bright); font-size: 1.1rem;">${reg.placa_cavalo}</td>
                    <td style="text-align: center;"><span class="badge-turno" style="${corBadge}">${iconeTurno} ${reg.turno_previsto}</span></td>
                    <td style="font-weight: bold; color: #f87171;">${reg.motorista_atual || '-'}</td>
                    <td style="font-weight: bold; color: #4ade80;">${reg.motorista_programado || '-'}</td>
                    <td>${localNome}</td>
                    <td style="text-align: center; font-size: 0.9rem; color:#cbd5e1;">${htmlTempos}</td>
                    <td style="text-align: center;">${diffRender}</td>
                    <td style="color: #fcd34d; font-size: 0.9rem;">${obsFormatada}</td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        console.error("Erro", e);
        window.dadosHistoricoTrocasAtual = []; 
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px; color:#ef4444;"><i class="fas fa-times-circle"></i> Ocorreu um erro.</td></tr>`;
    }
}

window.exportarHistoricoTrocasExcel = function() {
    if (!window.dadosHistoricoTrocasAtual || window.dadosHistoricoTrocasAtual.length === 0) {
        alert("Nenhum dado para exportar no momento. Faça uma busca no histórico primeiro.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Data Referencia;Placa (Cavalo);Turno Referencia;Motorista Entregou;Motorista Assumiu;Local da Troca;Horario Entregou;Horario Assumiu;Minutos de Troca;Observacao (Motivo)\n";

    window.dadosHistoricoTrocasAtual.forEach(reg => {
        const local = window.locaisTrocaCache.find(l => String(l.id) === String(reg.local_troca_id));
        const localNome = local ? local.nome : 'Local Desconhecido';
        const dataFormatada = reg.data_referencia ? reg.data_referencia.split('-').reverse().join('/') : '-';
        const obsFormatada = reg.observacao ? reg.observacao.replace(/;/g, ',').replace(/\n/g, ' ') : '-';

        const linha = [
            dataFormatada, reg.placa_cavalo, reg.turno_previsto,
            reg.motorista_atual || '-', reg.motorista_programado || '-',
            localNome, reg.horario_entregou || '-', reg.horario_real || '-',
            reg.tempo_troca_minutos || '-', obsFormatada
        ].join(';');

        csvContent += linha + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const agora = new Date();
    const dataDoc = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
    link.setAttribute("download", `Historico_Trocas_${dataDoc}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.carregarIndicadoresTroca = async function() {
    const tempoFiltro = document.getElementById('filtroTempoIndicadores').value;
    document.getElementById('containerDetalhesMotoristas').style.display = 'none';

    if (window.locaisTrocaCache.length === 0) {
        let resLocaisQuery = window.supabaseClient.from('locais_troca').select('*');
        resLocaisQuery = window.aplicarFiltroFilial(resLocaisQuery);
        const resLocais = await resLocaisQuery;
        if (resLocais.data) window.locaisTrocaCache = resLocais.data;
    }

    try {
        const isLinhares = (typeof currentUser !== 'undefined' && currentUser && String(currentUser.filial_id) === '7');
        let query = isLinhares 
            ? window.supabaseClient.from('troca_turno_linhares').select('local_troca_id, data_referencia, motorista_assumiu')
            : window.supabaseClient.from('registro_troca_turno').select('local_troca_id, data_referencia, motorista_programado');

        if (!isLinhares) query = window.aplicarFiltroFilial(query); 

        if (tempoFiltro !== 'all') {
            const dataHoje = new Date();
            const ano = dataHoje.getFullYear();
            const mes = String(dataHoje.getMonth() + 1).padStart(2, '0');
            const dia = String(dataHoje.getDate()).padStart(2, '0');
            const dataFormatadaHoje = `${ano}-${mes}-${dia}`;

            if (tempoFiltro === 'hoje') {
                query = query.eq('data_referencia', dataFormatadaHoje);
            } else if (tempoFiltro === 'd1') {
                const dataD1 = new Date(dataHoje);
                dataD1.setDate(dataD1.getDate() - 1);
                const d1Ano = dataD1.getFullYear();
                const d1Mes = String(dataD1.getMonth() + 1).padStart(2, '0');
                const d1Dia = String(dataD1.getDate()).padStart(2, '0');
                query = query.eq('data_referencia', `${d1Ano}-${d1Mes}-${d1Dia}`);
            } else if (tempoFiltro === 'semana') {
                const inicioSemana = new Date(dataHoje);
                const diaSemana = inicioSemana.getDay(); 
                inicioSemana.setDate(inicioSemana.getDate() - diaSemana);
                const isAno = inicioSemana.getFullYear();
                const isMes = String(inicioSemana.getMonth() + 1).padStart(2, '0');
                const isDia = String(inicioSemana.getDate()).padStart(2, '0');
                query = query.gte('data_referencia', `${isAno}-${isMes}-${isDia}`).lte('data_referencia', dataFormatadaHoje);
            } else if (tempoFiltro === 'mes') {
                const dataInicioMes = `${ano}-${mes}-01`;
                query = query.gte('data_referencia', dataInicioMes).lte('data_referencia', dataFormatadaHoje);
            }
        }

        const { data, error } = await query;
        if (error) throw error;

        window.dadosIndicadoresBrutos = data.map(r => ({
            ...r,
            motorista_padrao: isLinhares ? r.motorista_assumiu : r.motorista_programado
        }));

        let locaisMap = {};
        window.locaisTrocaCache.forEach(l => {
            locaisMap[l.id] = { ...l, count: 0 };
        });

        let totalGeral = 0;
        let totalPA = 0;

        if (data && data.length > 0) {
            data.forEach(r => {
                if (locaisMap[r.local_troca_id]) {
                    locaisMap[r.local_troca_id].count++;
                    totalGeral++;
                    const nomeStr = locaisMap[r.local_troca_id].nome.toUpperCase();
                    if (nomeStr.includes('PA ') || nomeStr.includes('P.A') || nomeStr.includes('APOIO')) {
                        totalPA++;
                    }
                }
            });
        }

        document.getElementById('kpiTotalTrocas').innerText = totalGeral;
        document.getElementById('kpiTotalPA').innerText = totalPA;

        const ranking = Object.values(locaisMap).filter(l => l.count > 0).sort((a, b) => b.count - a.count);

        if (ranking.length > 0) {
            document.getElementById('kpiTopLocal').innerHTML = `${ranking[0].nome}<br><span style="font-size:1rem; font-weight:normal; color:#fde68a;">(${ranking[0].count} trocas)</span>`;
        } else {
            document.getElementById('kpiTopLocal').innerText = '-';
        }

        const tbodyRanking = document.getElementById('tbodyRankingLocais');
        if (ranking.length === 0) {
            tbodyRanking.innerHTML = `<tr><td colspan="2" style="text-align: center; padding: 20px; color: #94a3b8;">Nenhum dado encontrado no período.</td></tr>`;
        } else {
            let rankHtml = '';
            ranking.forEach((loc, idx) => {
                let color = '#fff';
                if(idx === 0) color = '#fbbf24'; 
                else if (idx === 1) color = '#e2e8f0'; 
                else if (idx === 2) color = '#b45309'; 
                
                rankHtml += `
                    <tr onclick="window.mostrarDetalhesMotoristasPorLocal('${loc.id}', '${loc.nome}')" style="cursor: pointer;">
                        <td style="font-weight: bold; color: ${color}; font-size: 1.05rem;">${idx + 1}º ${loc.nome}</td>
                        <td style="text-align: center; color: var(--ccol-blue-bright); font-weight: 800; font-size: 1.2rem;">${loc.count}</td>
                    </tr>
                `;
            });
            tbodyRanking.innerHTML = rankHtml;
        }

        if (window.layerGrupoBolas) {
            window.layerGrupoBolas.clearLayers();
            ranking.forEach(loc => {
                const isPA = loc.nome.toUpperCase().includes('PA ') || loc.nome.toUpperCase().includes('P.A') || loc.nome.toUpperCase().includes('APOIO');
                const minRadius = 15;
                const radius = Math.min(60, minRadius + (loc.count * 1.5));
                const color = isPA ? '#f59e0b' : '#3b82f6';
                
                const circle = L.circleMarker([loc.latitude, loc.longitude], {
                    radius: radius, fillColor: color, color: color, weight: 2, opacity: 0.8, fillOpacity: 0.5
                });
                circle.bindTooltip(loc.count.toString(), { permanent: true, direction: 'center', className: 'bubble-tooltip' });
                circle.bindPopup(`<strong style="font-size:1.1rem;">${loc.nome}</strong><br>Total de Trocas: <b>${loc.count}</b><br><br><button onclick="window.mostrarDetalhesMotoristasPorLocal('${loc.id}', '${loc.nome}')" style="background:#3b82f6; color:#white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-weight:bold;">Ver Motoristas</button>`);
                window.layerGrupoBolas.addLayer(circle);
            });
            if (ranking.length > 0) {
                const groupBounds = L.featureGroup(window.layerGrupoBolas.getLayers()).getBounds();
                window.mapaIndicadores.fitBounds(groupBounds, { padding: [50, 50] });
            }
        }
    } catch(e) { console.error("Error in Indicators:", e); }
}

window.mostrarDetalhesMotoristasPorLocal = function(localId, localNome) {
    const container = document.getElementById('containerDetalhesMotoristas');
    const tbody = document.getElementById('tbodyDetalhesMotoristasLocal');
    const titulo = document.getElementById('tituloDetalhesMotoristas');
    if (!container || !tbody || !window.dadosIndicadoresBrutos) return;

    const trocasLocal = window.dadosIndicadoresBrutos.filter(r => String(r.local_troca_id) === String(localId));
    let contagemMot = {};
    trocasLocal.forEach(r => {
        const nome = r.motorista_padrao || "Não Informado";
        contagemMot[nome] = (contagemMot[nome] || 0) + 1;
    });

    const rankingMot = Object.entries(contagemMot)
        .map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd);

    titulo.innerHTML = `Motoristas que realizaram trocas em: <span style="color:#fbbf24">${localNome}</span>`;
    
    if (rankingMot.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding:15px;">Nenhum motorista registrado neste local.</td></tr>`;
    } else {
        tbody.innerHTML = rankingMot.map(m => `
            <tr>
                <td style="font-weight: bold; color: #fff;">${m.nome}</td>
                <td style="text-align: center; color: #4ade80; font-weight: 800; font-size: 1.1rem;">${m.qtd}</td>
            </tr>
        `).join('');
    }
    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}