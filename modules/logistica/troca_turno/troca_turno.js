// ==================== MÓDULO: TROCA DE TURNO (CRUZAMENTO SEGURO, HISTÓRICO E INDICADORES) ====================
window.locaisTrocaCache = [];
window.mapaTroca = null;
window.markerTroca = null;
window.mapaIndicadores = null;
window.layerGrupoBolas = null;
window.motSelectPendente = null; 
window.dadosHistoricoTrocasAtual = []; 
window.dadosIndicadoresBrutos = []; // Cache para detalhamento sem nova consulta

window.renderizarTrocaTurno = async function() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    
    document.getElementById('dataFiltroTroca').value = `${ano}-${mes}-${dia}`;
    
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
    const abas = ['registros', 'locais', 'historico', 'indicadores'];
    const prefixAba = 'aba-';
    const prefixBtn = 'btnAba';

    abas.forEach(nomeAba => {
        document.getElementById(prefixAba + nomeAba).style.display = 'none';
        const btn = document.getElementById(prefixBtn + nomeAba.charAt(0).toUpperCase() + nomeAba.slice(1));
        if (btn) btn.className = 'btn-secondary-dark';
    });

    document.getElementById(prefixAba + aba).style.display = 'block';
    const btnAtivo = document.getElementById(prefixBtn + aba.charAt(0).toUpperCase() + aba.slice(1));
    if (btnAtivo) btnAtivo.className = 'btn-primary-blue';

    if (aba === 'registros') {
        window.carregarTrocasDoDia();
    } else if (aba === 'locais') {
        window.carregarLocaisTroca();
        setTimeout(() => {
            window.iniciarMapaTroca();
            if (window.mapaTroca) window.mapaTroca.invalidateSize();
        }, 250);
    } else if (aba === 'historico') {
        window.popularFiltrosHistoricoTroca();
        window.carregarHistoricoTrocas();
    } else if (aba === 'indicadores') {
        // ALTERAÇÃO AQUI: Garante que toda vez que a aba for aberta, ele reseta para o "Hoje"
        document.getElementById('filtroTempoIndicadores').value = 'hoje';
        setTimeout(() => {
            window.iniciarMapaIndicadores();
            if (window.mapaIndicadores) window.mapaIndicadores.invalidateSize();
            window.carregarIndicadoresTroca();
        }, 250);
    }
}

window.carregarLocaisTroca = async function() {
    try {
        const { data, error } = await window.supabaseClient.from('locais_troca').select('*').order('nome');
        if (!error && data) {
            window.locaisTrocaCache = data;
            const tbody = document.getElementById('tbodyLocaisTroca');
            if (tbody) {
                const isAdmin = (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'Admin');
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
        await window.supabaseClient.from('locais_troca').insert([{ nome, latitude: parseFloat(lat), longitude: parseFloat(lng) }]);
        document.getElementById('novoLocalTroca').value = '';
        await window.carregarLocaisTroca();
    } catch (e) { alert("Erro ao salvar local."); }
}

window.excluirLocalTroca = async function(id) {
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.role !== 'Admin') {
        alert('Acesso Negado: Apenas Administradores podem excluir locais de troca.');
        return;
    }
    if (!confirm("Excluir este local?")) return;
    await window.supabaseClient.from('locais_troca').delete().eq('id', id);
    await window.carregarLocaisTroca();
}

window.calcularProximaTroca = function(domId, minutosPrevisto) {
    const inputHora = document.getElementById(`hora_${domId}`).value;
    const divProxima = document.getElementById(`prox_${domId}`);
    const trElement = document.getElementById(`tr_${domId}`);

    if(!inputHora) { 
        divProxima.innerText = '--:--'; 
        if(trElement) trElement.style.background = trElement.getAttribute('data-original-bg-color') || 'transparent';
        return; 
    }
    
    let [h, m] = inputHora.split(':').map(Number);
    divProxima.innerText = `${((h + 12) % 24).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

    if(trElement && minutosPrevisto !== undefined && minutosPrevisto !== null && minutosPrevisto !== 9999) {
        let minutosReal = h * 60 + m;
        let diff = Math.abs(minutosReal - parseInt(minutosPrevisto));
        
        if (diff > 12 * 60) diff = 24 * 60 - diff; 

        if (diff >= 60) {
            trElement.style.background = 'rgba(239, 68, 68, 0.2)';
        } else {
            trElement.style.background = trElement.getAttribute('data-original-bg-color') || 'transparent';
        }
    }
}

window.verificarMudancaMotorista = function(domId) {
    const selectMot = document.getElementById(`mot_${domId}`);
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

window.carregarTrocasDoDia = async function() {
    const dataRef = document.getElementById('dataFiltroTroca').value;
    const tbody = document.getElementById('tbodyTrocaTurno');
    if (!tbody || !dataRef) return;
    
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px;">Processando escala e ordenando horários...</td></tr>`;
    
    try {
        let registros = [];
        try {
            const res = await window.supabaseClient.from('registro_troca_turno').select('*').eq('data_referencia', dataRef);
            if (res.data) registros = res.data;
        } catch(e) { console.warn("Supabase indisponível para busca", e); }
        
        const mLista = (typeof motoristas !== 'undefined') ? motoristas : (window.motoristas || []);
        const cLista = (typeof conjuntos !== 'undefined') ? conjuntos : (window.conjuntos || []);
        
        if (cLista.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:20px; color:#f1c40f;">Nenhum Conjunto encontrado na memória do sistema.</td></tr>`;
            return;
        }

        let linhasData = [];
        
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
                            motoristasHoje.push({ nome: m.nome, turno: esc.turno || m.turno || 'Indefinido' });
                        }
                    }
                });
                
                if (motoristasHoje.length === 0) {
                    motoristasHoje.push({ nome: null, turno: 'Sem Escala' });
                }

                motoristasHoje.forEach((esc, idxTurno) => {
                    function extrairMinutosDoTurno(turno) {
                        if (!turno || typeof turno !== 'string') return 9999;
                        const t = turno.toUpperCase();
                        if (t.includes('SEM ESCALA') || t.includes('INDEFINIDO') || t.includes('PARADO')) return 9999;
                        
                        const match = t.match(/(\d{1,2})[:Hh](\d{2})/);
                        if (match) return parseInt(match[1]) * 60 + parseInt(match[2]);
                        
                        const matchHora = t.match(/(\d{1,2})/);
                        if (matchHora) return parseInt(matchHora[1]) * 60;
                        
                        return 9999; 
                    }

                    linhasData.push({
                        conjId: conj.id,
                        go: go,
                        placaNorm: placaNorm,
                        esc: esc,
                        idxTurno: idxTurno,
                        ordemTurno: extrairMinutosDoTurno(esc.turno)
                    });
                });
            });
        });

        linhasData.sort((a, b) => {
            if (a.ordemTurno !== b.ordemTurno) {
                return a.ordemTurno - b.ordemTurno;
            }
            return Number(a.conjId) - Number(b.conjId);
        });

        let html = '';
        linhasData.forEach((linha, indiceGlobal) => {
            const { conjId, go, placaNorm, esc, idxTurno } = linha;
            const domId = `${placaNorm.replace(/[^A-Z0-9]/g, '')}_${idxTurno}_${indiceGlobal}`; 
            
            const reg = registros.find(r => r.placa_cavalo.toUpperCase() === placaNorm && r.turno_previsto === esc.turno) || {};
            const motoristaAtual = reg.motorista_programado || esc.nome || '';
            const horarioReal = reg.horario_real || '';
            const obsReal = reg.observacao || '';
            
            let proximaTroca = '--:--';
            if(horarioReal) {
                let [h, m] = horarioReal.split(':').map(Number);
                proximaTroca = `${((h + 12) % 24).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            }

            let selectMot = `<select id="mot_${domId}" class="input-moderno" data-original="${esc.nome || ''}" onchange="verificarMudancaMotorista('${domId}')">`;
            if (esc.nome) selectMot += `<option value="${esc.nome}" selected>${esc.nome} (Escala)</option>`;
            else selectMot += `<option value="">-- Parado --</option>`;
            
            mLista.forEach(m => { 
                if(m.nome !== esc.nome) selectMot += `<option value="${m.nome}" ${m.nome === motoristaAtual ? 'selected' : ''}>${m.nome}</option>`; 
            });
            selectMot += `</select>`;

            let selectLocal = `<select id="local_${domId}" class="input-moderno"><option value="">Selecione...</option>`;
            window.locaisTrocaCache.forEach(l => {
                selectLocal += `<option value="${l.id}" ${reg.local_troca_id === l.id ? 'selected' : ''}>${l.nome}</option>`;
            });
            selectLocal += `</select>`;

            let isZebrado = (indiceGlobal % 2 === 0);
            let baseBgColor = isZebrado ? 'rgba(0,0,0,0.2)' : 'transparent';
            let baseBorder = isZebrado ? '2px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(255,255,255,0.05)';
            let currentBgColor = baseBgColor;

            if (horarioReal && linha.ordemTurno !== 9999) {
                let [hReal, mReal] = horarioReal.split(':').map(Number);
                let diff = Math.abs((hReal * 60 + mReal) - linha.ordemTurno);
                if (diff > 12 * 60) diff = 24 * 60 - diff;
                if (diff >= 60) {
                    currentBgColor = 'rgba(239, 68, 68, 0.2)';
                }
            }

            let badgeClass = esc.turno !== 'Sem Escala' ? `<span class="badge-turno"><i class="far fa-clock"></i> ${esc.turno}</span>` : `<span style="color:#ef4444; font-size:0.8rem; font-weight:bold;">PARADO</span>`;

            html += `
                <tr id="tr_${domId}" style="background: ${currentBgColor}; border-bottom: ${baseBorder}; transition: background 0.3s ease;" data-original-bg-color="${baseBgColor}">
                    <td style="font-weight: bold; color: var(--ccol-blue-bright);">
                        CONJUNTO ${String(conjId).padStart(2,'0')} 
                        <br><span class="badge-go" style="margin-top:4px;">Frota ${go}</span>
                    </td>
                    <td style="font-weight: bold; color: #fff; font-size:1.1rem;">${placaNorm}</td>
                    <td style="text-align: center;">${badgeClass}</td>
                    <td>${selectMot}</td>
                    <td>${selectLocal}</td>
                    <td><input type="time" id="hora_${domId}" class="input-moderno" value="${horarioReal}" onchange="calcularProximaTroca('${domId}', ${linha.ordemTurno})"></td>
                    <td style="text-align: center;"><span id="prox_${domId}" class="hora-estimada">${proximaTroca}</span></td>
                    <td>
                        <input type="text" id="obs_${domId}" class="input-moderno" placeholder="Requer alteração..." value="${obsReal}" readonly 
                        style="cursor: not-allowed; background-color: rgba(0,0,0,0.5) !important; color: #94a3b8 !important;" 
                        title="Só é possível alterar a observação ao alterar o motorista escalado.">
                    </td>
                    <td><button class="btn-primary-green" onclick="salvarTroca('${domId}', '${placaNorm}', '${esc.turno}')" style="width:100%; padding:8px;"><i class="fas fa-save"></i> Salvar</button></td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        
    } catch (e) {
        console.error("Erro na varredura", e);
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px; color:#ef4444;">Erro ao cruzar os dados. Veja o console.</td></tr>`;
    }
}

window.salvarTroca = async function(domId, placa, turnoPrevisto) {
    const dataRef = document.getElementById('dataFiltroTroca').value;
    const motorista = document.getElementById(`mot_${domId}`).value;
    const localId = document.getElementById(`local_${domId}`).value;
    const hora = document.getElementById(`hora_${domId}`).value;
    const obs = document.getElementById(`obs_${domId}`).value.trim();
    
    if (!localId || !hora) return alert("Preencha o Local e Horário Real antes de salvar.");
    
    try {
        const { data: exist } = await window.supabaseClient.from('registro_troca_turno').select('id')
            .eq('data_referencia', dataRef).eq('placa_cavalo', placa).eq('turno_previsto', turnoPrevisto).single();
            
        const p = { 
            data_referencia: dataRef, 
            placa_cavalo: placa, 
            turno_previsto: turnoPrevisto, 
            motorista_programado: motorista, 
            local_troca_id: localId, 
            horario_real: hora,
            observacao: obs 
        };
        
        if (exist) await window.supabaseClient.from('registro_troca_turno').update(p).eq('id', exist.id);
        else await window.supabaseClient.from('registro_troca_turno').insert([p]);
        
        alert("Registro Salvo!");
        window.carregarTrocasDoDia();
    } catch (e) { alert("Erro de conexão ao salvar."); }
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
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color:#94a3b8;">Por favor, selecione uma placa, um motorista ou escolha a data para exibir os registros.</td></tr>`;
        return;
    }

    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Buscando histórico no banco de dados...</td></tr>`;

    try {
        let query = window.supabaseClient.from('registro_troca_turno').select('*').order('data_referencia', { ascending: false }).limit(200);
        if (dataFiltro) query = query.eq('data_referencia', dataFiltro);
        if (placaFiltro) query = query.eq('placa_cavalo', placaFiltro);
        if (motoristaFiltro) query = query.eq('motorista_programado', motoristaFiltro);

        const { data, error } = await query;
        if (error) throw error;

        if (!data || data.length === 0) {
            window.dadosHistoricoTrocasAtual = []; 
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color:#f59e0b;"><i class="fas fa-exclamation-triangle"></i> Nenhum registro encontrado.</td></tr>`;
            return;
        }

        window.dadosHistoricoTrocasAtual = data;

        if (window.locaisTrocaCache.length === 0) {
            const resLocais = await window.supabaseClient.from('locais_troca').select('*');
            if (resLocais.data) window.locaisTrocaCache = resLocais.data;
        }

        tbody.innerHTML = data.map(reg => {
            const local = window.locaisTrocaCache.find(l => String(l.id) === String(reg.local_troca_id));
            const localNome = local ? local.nome : 'Local Desconhecido';
            const dataFormatada = reg.data_referencia ? reg.data_referencia.split('-').reverse().join('/') : '-';
            const obsFormatada = reg.observacao ? reg.observacao : '-';

            return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.1);">
                    <td style="text-align: center; color: #94a3b8; font-weight: bold;">${dataFormatada}</td>
                    <td style="font-weight: bold; color: var(--ccol-blue-bright); font-size: 1.1rem;">${reg.placa_cavalo}</td>
                    <td style="text-align: center;"><span class="badge-turno">${reg.turno_previsto}</span></td>
                    <td style="font-weight: bold;">${reg.motorista_programado || '-'}</td>
                    <td>${localNome}</td>
                    <td style="text-align: center; color: #4ade80; font-weight: 800; font-size: 1.1rem;">${reg.horario_real || '-'}</td>
                    <td style="color: #fcd34d; font-size: 0.9rem;">${obsFormatada}</td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        console.error("Erro", e);
        window.dadosHistoricoTrocasAtual = []; 
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color:#ef4444;"><i class="fas fa-times-circle"></i> Ocorreu um erro.</td></tr>`;
    }
}

window.exportarHistoricoTrocasExcel = function() {
    if (!window.dadosHistoricoTrocasAtual || window.dadosHistoricoTrocasAtual.length === 0) {
        alert("Nenhum dado para exportar no momento. Faça uma busca no histórico primeiro.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Data Referencia;Placa (Cavalo);Turno Previsto;Motorista Confirmado;Local da Troca;Horario Real;Observacao (Motivo)\n";

    window.dadosHistoricoTrocasAtual.forEach(reg => {
        const local = window.locaisTrocaCache.find(l => String(l.id) === String(reg.local_troca_id));
        const localNome = local ? local.nome : 'Local Desconhecido';
        const dataFormatada = reg.data_referencia ? reg.data_referencia.split('-').reverse().join('/') : '-';
        const obsFormatada = reg.observacao ? reg.observacao.replace(/;/g, ',').replace(/\n/g, ' ') : '-';

        const linha = [
            dataFormatada,
            reg.placa_cavalo,
            reg.turno_previsto,
            reg.motorista_programado || '-',
            localNome,
            reg.horario_real || '-',
            obsFormatada
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
        const resLocais = await window.supabaseClient.from('locais_troca').select('*');
        if (resLocais.data) window.locaisTrocaCache = resLocais.data;
    }

    try {
        let query = window.supabaseClient.from('registro_troca_turno').select('local_troca_id, data_referencia, motorista_programado');

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

        window.dadosIndicadoresBrutos = data || [];

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
                    radius: radius,
                    fillColor: color,
                    color: color,
                    weight: 2,
                    opacity: 0.8,
                    fillOpacity: 0.5
                });

                circle.bindTooltip(loc.count.toString(), {
                    permanent: true,
                    direction: 'center',
                    className: 'bubble-tooltip'
                });

                circle.bindPopup(`<strong style="font-size:1.1rem;">${loc.nome}</strong><br>Total de Trocas: <b>${loc.count}</b><br><br><button onclick="window.mostrarDetalhesMotoristasPorLocal('${loc.id}', '${loc.nome}')" style="background:#3b82f6; color:#white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-weight:bold;">Ver Motoristas</button>`);

                window.layerGrupoBolas.addLayer(circle);
            });

            if (ranking.length > 0) {
                const groupBounds = L.featureGroup(window.layerGrupoBolas.getLayers()).getBounds();
                window.mapaIndicadores.fitBounds(groupBounds, { padding: [50, 50] });
            }
        }

    } catch(e) {
        console.error("Erro nos Indicadores:", e);
    }
}

window.mostrarDetalhesMotoristasPorLocal = function(localId, localNome) {
    const container = document.getElementById('containerDetalhesMotoristas');
    const tbody = document.getElementById('tbodyDetalhesMotoristasLocal');
    const titulo = document.getElementById('tituloDetalhesMotoristas');

    if (!container || !tbody || !window.dadosIndicadoresBrutos) return;

    const trocasLocal = window.dadosIndicadoresBrutos.filter(r => String(r.local_troca_id) === String(localId));

    let contagemMot = {};
    trocasLocal.forEach(r => {
        const nome = r.motorista_programado || "Não Informado";
        contagemMot[nome] = (contagemMot[nome] || 0) + 1;
    });

    const rankingMot = Object.entries(contagemMot)
        .map(([nome, qtd]) => ({ nome, qtd }))
        .sort((a, b) => b.qtd - a.qtd);

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