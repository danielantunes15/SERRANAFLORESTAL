// ==================== MÓDULO: TROCA DE TURNO (HISTÓRICO, KPIs, MAPAS E PERFORMANCE) ====================

window.carregarPerformanceTroca = async function() {
    const inputFiltro = document.getElementById('filtroDataPerformance');
    let dataFiltro = inputFiltro ? inputFiltro.value : null;

    if (!dataFiltro) {
        const agora = new Date();
        dataFiltro = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
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

        query = window.aplicarFiltroFilial(query);
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

        let totalMinutos = 0; let acimaDe30 = 0; let melhorTempo = 9999; let melhorPlaca = '';
        let totalSaldoPositivo = 0; let estourouCount = 0; let tableHtml = '';

        data.forEach(d => {
            if (d.cavalo === 'RESERVA') return; 

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
                    saldoHtml = `<span style="color:#60a5fa; font-weight:bold;">+${Math.floor(d.saldo_minutos / 60)}h ${d.saldo_minutos % 60}m</span>`;
                } else if (d.saldo_minutos < 0) {
                    estourouCount++;
                    let excesso = Math.abs(d.saldo_minutos);
                    saldoHtml = `<span style="color:#f87171; font-weight:bold;">-${Math.floor(excesso / 60)}h ${excesso % 60}m</span>`;
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

        let dataValida = data.filter(d => d.cavalo !== 'RESERVA');
        let media = dataValida.length > 0 ? Math.round(totalMinutos / dataValida.length) : 0;
        document.getElementById('kpiMediaTroca').innerText = media + ' min';
        document.getElementById('kpiSlaTroca').innerText = acimaDe30;
        
        if (melhorTempo !== 9999) {
            let mH = Math.floor(melhorTempo / 60);
            let mM = melhorTempo % 60;
            let strMelhor = mH > 0 ? `${mH}h ${mM}m` : `${mM} min`;
            document.getElementById('kpiMelhorTroca').innerHTML = `${strMelhor} <br><span style="font-size:0.9rem; color:#cbd5e1; font-weight:normal;">${melhorPlaca}</span>`;
        }

        document.getElementById('kpiSaldoDisp').innerText = `${Math.floor(totalSaldoPositivo / 60)}h ${totalSaldoPositivo % 60}m`;
        document.getElementById('kpiEstourou').innerText = estourouCount;
        document.getElementById('tbodyPerformance').innerHTML = tableHtml || `<tr><td colspan="7" style="text-align:center; padding:20px; color:#94a3b8;">Nenhum registro validado.</td></tr>`;

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
    
    selectMot.innerHTML = htmlMot;

    const cLista = (typeof conjuntos !== 'undefined') ? conjuntos : (window.conjuntos || []);
    let placas = [];
    cLista.forEach(c => {
        if (c.caminhoes) c.caminhoes.forEach(cam => {
            const p = typeof cam === 'string' ? cam : cam.placa;
            if (p && !placas.includes(p.toUpperCase())) placas.push(p.toUpperCase());
        });
    });
    
    placas.sort();
    let htmlPlaca = '<option value="">Todas as Placas</option>';
    placas.forEach(p => { htmlPlaca += `<option value="${p}">${p}</option>`; });
    htmlPlaca += `<option value="RESERVA">RESERVA (Motoristas Disponíveis)</option>`;
    
    selectPlaca.innerHTML = htmlPlaca;
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
        let query = window.supabaseClient.from('troca_turno_linhares').select('*').order('data_referencia', { ascending: false }).limit(200);
        query = window.aplicarFiltroFilial(query);
        
        if (dataFiltro) query = query.eq('data_referencia', dataFiltro);
        if (placaFiltro) query = query.eq('cavalo', placaFiltro);
        if (motoristaFiltro) query = query.eq('motorista_assumiu', motoristaFiltro);

        const { data, error } = await query;
        if (error) throw error;

        if (!data || data.length === 0) {
            window.dadosHistoricoTrocasAtual = []; 
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px; color:#f59e0b;"><i class="fas fa-exclamation-triangle"></i> Nenhum registro encontrado.</td></tr>`;
            return;
        }

        window.dadosHistoricoTrocasAtual = data.map(r => ({
            id: r.id, data_referencia: r.data_referencia, placa_cavalo: r.cavalo,
            turno_previsto: r.turno_referencia, motorista_atual: r.motorista_entregou,
            motorista_programado: r.motorista_assumiu, local_troca_id: r.local_troca_id,
            horario_real: r.horario_assumiu, horario_entregou: r.horario_entregou, 
            tempo_troca_minutos: r.tempo_troca_minutos, observacao: r.observacao
        }));

        if (window.locaisTrocaCache.length === 0) {
            let resLocaisQuery = window.supabaseClient.from('locais_troca').select('*');
            resLocaisQuery = window.aplicarFiltroFilial(resLocaisQuery);
            const resLocais = await resLocaisQuery;
            if (resLocais.data) window.locaisTrocaCache = resLocais.data;
        }

        tbody.innerHTML = window.dadosHistoricoTrocasAtual.map(reg => {
            const local = window.locaisTrocaCache.find(l => String(l.id) === String(reg.local_troca_id));
            const localNome = local ? local.nome : (reg.placa_cavalo === 'RESERVA' ? 'Baixa via Kanban' : 'Local Desconhecido');
            const dataFormatada = reg.data_referencia ? reg.data_referencia.split('-').reverse().join('/') : '-';
            const obsFormatada = reg.observacao ? reg.observacao : '-';
            let htmlTempos = `Entregou: <b>${reg.horario_entregou ? reg.horario_entregou.substring(0,5) : '--'}</b><br>Assumiu: <b>${reg.horario_real ? reg.horario_real.substring(0,5) : '--'}</b>`;
            
            let diffRender = '--';
            if (reg.tempo_troca_minutos !== undefined && reg.tempo_troca_minutos !== null && reg.placa_cavalo !== 'RESERVA') {
                let diffH = Math.floor(reg.tempo_troca_minutos / 60);
                let diffM = reg.tempo_troca_minutos % 60;
                let color = reg.tempo_troca_minutos > 30 ? '#ef4444' : '#4ade80';
                diffRender = `<span style="color:${color}; font-weight:bold;">${diffH}h ${diffM}m</span>`;
            } else if (reg.placa_cavalo === 'RESERVA') {
                diffRender = `<span style="color:#a855f7; font-weight:bold;">N/A (Reserva)</span>`;
            }

            let isNoite = false;
            if (reg.turno_previsto) {
                let tUp = String(reg.turno_previsto).toUpperCase();
                const timeM = tUp.match(/\b(\d{2}):\d{2}\b/);
                if (timeM) {
                    let h = parseInt(timeM[1], 10);
                    isNoite = (h >= 12 && h <= 23);
                } else if (tUp.includes('NOITE') || tUp === 'TURNO 2' || (tUp === '2' && !tUp.includes(':'))) {
                    isNoite = true;
                }
            }

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
        const localNome = local ? local.nome : (reg.placa_cavalo === 'RESERVA' ? 'Baixa via Kanban' : 'Local Desconhecido');
        const dataFormatada = reg.data_referencia ? reg.data_referencia.split('-').reverse().join('/') : '-';
        const obsFormatada = reg.observacao ? reg.observacao.replace(/;/g, ',').replace(/\n/g, ' ') : '-';

        const linha = [
            dataFormatada, reg.placa_cavalo, reg.turno_previsto,
            reg.motorista_atual || '-', reg.motorista_programado || '-',
            localNome, reg.horario_entregou || '-', reg.horario_real || '-',
            reg.tempo_troca_minutos !== null ? reg.tempo_troca_minutos : '-', obsFormatada
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
        let query = window.supabaseClient.from('troca_turno_linhares').select('local_troca_id, data_referencia, motorista_assumiu').not('local_troca_id', 'is', null);
        query = window.aplicarFiltroFilial(query); 

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
                query = query.eq('data_referencia', `${dataD1.getFullYear()}-${String(dataD1.getMonth() + 1).padStart(2, '0')}-${String(dataD1.getDate()).padStart(2, '0')}`);
            } else if (tempoFiltro === 'semana') {
                const inicioSemana = new Date(dataHoje);
                inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
                query = query.gte('data_referencia', `${inicioSemana.getFullYear()}-${String(inicioSemana.getMonth() + 1).padStart(2, '0')}-${String(inicioSemana.getDate()).padStart(2, '0')}`).lte('data_referencia', dataFormatadaHoje);
            } else if (tempoFiltro === 'mes') {
                query = query.gte('data_referencia', `${ano}-${mes}-01`).lte('data_referencia', dataFormatadaHoje);
            }
        }

        const { data, error } = await query;
        if (error) throw error;

        window.dadosIndicadoresBrutos = data.map(r => ({ ...r, motorista_padrao: r.motorista_assumiu }));

        let locaisMap = {};
        window.locaisTrocaCache.forEach(l => { locaisMap[l.id] = { ...l, count: 0 }; });

        let totalGeral = 0; let totalPA = 0;
        if (data && data.length > 0) {
            data.forEach(r => {
                if (locaisMap[r.local_troca_id]) {
                    locaisMap[r.local_troca_id].count++;
                    totalGeral++;
                    const nomeStr = locaisMap[r.local_troca_id].nome.toUpperCase();
                    if (nomeStr.includes('PA ') || nomeStr.includes('P.A') || nomeStr.includes('APOIO')) totalPA++;
                }
            });
        }

        document.getElementById('kpiTotalTrocas').innerText = totalGeral;
        document.getElementById('kpiTotalPA').innerText = totalPA;

        const ranking = Object.values(locaisMap).filter(l => l.count > 0).sort((a, b) => b.count - a.count);
        if (ranking.length > 0) document.getElementById('kpiTopLocal').innerHTML = `${ranking[0].nome}<br><span style="font-size:1rem; font-weight:normal; color:#fde68a;">(${ranking[0].count} trocas)</span>`;
        else document.getElementById('kpiTopLocal').innerText = '-';

        const tbodyRanking = document.getElementById('tbodyRankingLocais');
        if (ranking.length === 0) {
            tbodyRanking.innerHTML = `<tr><td colspan="2" style="text-align: center; padding: 20px; color: #94a3b8;">Nenhum dado encontrado no período.</td></tr>`;
        } else {
            let rankHtml = '';
            ranking.forEach((loc, idx) => {
                let color = idx === 0 ? '#fbbf24' : (idx === 1 ? '#e2e8f0' : (idx === 2 ? '#b45309' : '#fff')); 
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
                const radius = Math.min(60, 15 + (loc.count * 1.5));
                const color = isPA ? '#f59e0b' : '#3b82f6';
                
                const circle = L.circleMarker([loc.latitude, loc.longitude], { radius: radius, fillColor: color, color: color, weight: 2, opacity: 0.8, fillOpacity: 0.5 });
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

    const rankingMot = Object.entries(contagemMot).map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd);
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
    if (!document.fullscreenElement) wrapper.requestFullscreen().catch(err => { alert(`Erro: ${err.message}`); });
    else document.exitFullscreen();
}

document.addEventListener('fullscreenchange', () => {
    if (window.mapaIndicadores) setTimeout(() => { window.mapaIndicadores.invalidateSize(); }, 250);
});