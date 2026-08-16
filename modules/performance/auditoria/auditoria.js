// ==================== modules/performance/auditoria/auditoria.js ====================
window.auditoriaModule = window.auditoriaModule || {};

window.filterGerencial = function() {
    const term = document.getElementById('gerencial-search').value.toLowerCase();
    const rows = document.querySelectorAll('.gerencial-row');
    rows.forEach(row => {
        const name = row.getAttribute('data-name').toLowerCase();
        row.style.display = name.includes(term) ? '' : 'none';
    });
};

window.showDisqReason = function(type, driver, payload) {
    let msg = `MOTORISTA: ${driver}\n\n`;
    if (type === 'ocorrencia') {
        const data = JSON.parse(decodeURIComponent(payload));
        msg += `❌ DESCLASSIFICADO POR OCORRÊNCIA\n\nData: ${data.data}\nLocal: ${data.local}\nDescrição: ${data.desc}`;
    } else {
        const data = JSON.parse(decodeURIComponent(payload));
        msg += `❌ DESCLASSIFICADO POR KM INSUFICIENTE\n\nRodou Apenas: ${data.dist} km\nMínimo Exigido: ${data.minDist} km`;
    }
    alert(msg);
};

window.auditoriaModule.render = async function() {
    try {
        const detailsContainer = document.getElementById('auditoria-details-section');
        if (!detailsContainer) return;
        detailsContainer.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Carregando auditoria...</div>';

        const drivers = await db.getMotoristas(); 
        let allTrips = [];
        let ocorrencias = [];
        
        try {
            const resViagens = await window.supabaseClient.from('performance').select('*');
            if (resViagens.data) allTrips = resViagens.data;
            const resOc = await window.supabaseClient.from('ocorrencias').select('*');
            if (resOc.data) ocorrencias = resOc.data;
        } catch(e) {}

        let configuracoes = { globalGoal: 1.8 };
        try {
            // ATUALIZADO PARA A TABELA performance_configuracoes
            const configRes = await window.supabaseClient.from('performance_configuracoes').select('*').limit(1);
            if (configRes.data && configRes.data.length > 0) configuracoes.globalGoal = parseFloat(configRes.data[0].global_goal || 1.8);
        } catch(e) {}

        const parseNumber = (val) => parseFloat(String(val).replace(',', '.')) || 0;
        const goal = configuracoes.globalGoal;
        const getColor = (kml) => {
            const numKml = parseNumber(kml);
            if (numKml <= 0) return '#94a3b8';
            return numKml >= goal ? '#10b981' : '#f87171';
        };

        const getAvailableMonths = (trips) => {
            const monthsSet = new Set();
            trips.forEach(t => {
                if(t.inicio) {
                    const d = new Date(t.inicio);
                    if(!isNaN(d.getTime())) {
                        monthsSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                    }
                }
            });
            let available = Array.from(monthsSet).sort().reverse();
            if (available.length === 0) {
                const d = new Date();
                available.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
            }
            return available;
        };

        const formatMonthStr = (yyyy_mm) => {
            const [y, m] = yyyy_mm.split('-');
            const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
            return `${monthNames[parseInt(m)-1]}/${y.substring(2)}`;
        };

        const availableMonths = getAvailableMonths(allTrips);
        let selectedMonth = availableMonths[0]; 

        const filterSelect = document.getElementById('auditoria-month-filter');
        if (filterSelect && filterSelect.value) selectedMonth = filterSelect.value;

        const [selYear, selMonth] = selectedMonth.split('-');
        const DISTANCIA_MINIMA_QUALIFICACAO = 1000;

        const currentMonthTrips = allTrips.filter(t => {
            if(!t.inicio) return false;
            const d = new Date(t.inicio);
            return d.getFullYear() == selYear && (d.getMonth() + 1) == selMonth;
        });

        const currentMonthOcorrencias = ocorrencias.filter(oc => {
            if(!oc.data_ocorrido) return false;
            const d = new Date(oc.data_ocorrido + 'T00:00:00');
            return d.getFullYear() == selYear && (d.getMonth() + 1) == selMonth;
        });

        const driversStats = drivers.map(driver => {
            const driverName = driver.nome || driver.name;
            const dTrips = currentMonthTrips.filter(t => t.motorista === driverName);
            let dist = 0; let fuel = 0;
            dTrips.forEach(t => {
                dist += parseFloat(t.distancia_km) || 0;
                fuel += parseFloat(t.total_litros) || 0;
            });
            const kml = fuel > 0 ? dist / fuel : 0;
            const ocorrencia = currentMonthOcorrencias.find(oc => oc.nome_envolvido === driverName);
            
            return { ...driver, name: driverName, calc_distance: dist, calc_kml: kml, ocorrencia_detalhes: ocorrencia };
        });

        const eligibleDrivers = driversStats.filter(d => d.calc_distance >= DISTANCIA_MINIMA_QUALIFICACAO && !d.ocorrencia_detalhes);
        const baselineDrivers = eligibleDrivers.length > 0 ? eligibleDrivers : driversStats;
        const maxDistance = Math.max(...baselineDrivers.map(d => d.calc_distance), 1);
        const maxKML = Math.max(...baselineDrivers.map(d => d.calc_kml), 1);
        const PESO_KML = 0.70;
        const PESO_DIST = 0.30;

        driversStats.forEach(d => {
            const kmlRatio = d.calc_kml / maxKML;
            const distRatio = d.calc_distance / maxDistance;
            d.ptsKml = Math.round(kmlRatio * PESO_KML * 1000);
            d.ptsDist = Math.round(distRatio * PESO_DIST * 1000);
            d.indiceDesempenho = d.ptsKml + d.ptsDist;
        });
        
        const sortedDrivers = [...driversStats].sort((a, b) => (b.indiceDesempenho || 0) - (a.indiceDesempenho || 0));

        let detailsHtml = `
            <div class="table-card full-width" style="border-top: 4px solid #3b82f6; background: #1e293b; padding: 24px; border-radius: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 15px;">
                    <div>
                        <h3 style="color: #38bdf8; margin-bottom: 8px;"><i class="fas fa-calculator"></i> Prestação de Contas</h3>
                        <p style="color: #94a3b8; font-size: 0.85rem; line-height: 1.6;">
                            <strong>Regra:</strong> Desempenho KML (Peso 70%) + Desempenho Distância (Peso 30%) = Máx 1000 Pontos<br>
                            <strong>Melhores Marcas do Mês:</strong> KM/L = ${window.utils.formatNumber(maxKML)} | Distância = ${window.utils.formatNumber(maxDistance, 0)} km<br>
                            <strong>Trava de Qualificação:</strong> Mínimo de ${DISTANCIA_MINIMA_QUALIFICACAO} km rodados.
                        </p>
                    </div>
                    <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <label style="color: #94a3b8; font-weight: 600; font-size: 0.9rem;">Mês:</label>
                            <select id="auditoria-month-filter" class="dark-select" style="width: 130px;" onchange="window.auditoriaModule.render()">
                                ${availableMonths.map(m => `<option value="${m}" ${m === selectedMonth ? 'selected' : ''}>${formatMonthStr(m)}</option>`).join('')}
                            </select>
                        </div>
                        <div style="min-width: 250px;">
                            <input type="text" id="gerencial-search" onkeyup="window.filterGerencial()" placeholder="Buscar motorista..." class="search-input-dark">
                        </div>
                    </div>
                </div>
                <div class="table-wrapper">
                    <table class="data-table-modern">
                        <thead>
                            <tr>
                                <th>Posição</th>
                                <th>Motorista</th>
                                <th>KM/L Real</th>
                                <th>Pts Consumo</th>
                                <th>KM Real</th>
                                <th>Pts Distância</th>
                                <th>Índice Final</th>
                                <th style="text-align: center;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        sortedDrivers.forEach((d, idx) => {
            const kmlPerc = ((d.calc_kml / maxKML) * 100).toFixed(1);
            const distPerc = ((d.calc_distance / maxDistance) * 100).toFixed(1);
            const isDisqualified = d.ocorrencia_detalhes || d.calc_distance < DISTANCIA_MINIMA_QUALIFICACAO;
            
            let textStyle = "";
            let bgStyle = "";
            let nameStyle = "font-weight: 500; color: #f8fafc;";
            let kmlColor = getColor(d.calc_kml);
            let statusIcon = '<i class="fas fa-check" style="color: #10b981;" title="Qualificado"></i>';
            
            if (isDisqualified) {
                textStyle = "text-decoration: line-through; opacity: 0.6;";
                bgStyle = "background: rgba(239, 68, 68, 0.05);";
                nameStyle = "font-weight: 500; color: #f87171; text-decoration: line-through;";
                kmlColor = "#f87171";
                
                let clickHandler = "";
                if (d.ocorrencia_detalhes) {
                    const payload = encodeURIComponent(JSON.stringify({
                        data: window.utils.formatDate(d.ocorrencia_detalhes.data_ocorrido),
                        local: d.ocorrencia_detalhes.local_projeto || 'Não informado',
                        desc: d.ocorrencia_detalhes.descricao_fatos || 'Sem descrição'
                    }));
                    clickHandler = `onclick="window.showDisqReason('ocorrencia', '${d.name}', '${payload}')"`;
                } else {
                    const payload = encodeURIComponent(JSON.stringify({
                        dist: window.utils.formatNumber(d.calc_distance, 0),
                        minDist: DISTANCIA_MINIMA_QUALIFICACAO
                    }));
                    clickHandler = `onclick="window.showDisqReason('km', '${d.name}', '${payload}')"`;
                }
                statusIcon = `<button ${clickHandler} style="background:none; border:none; color:#f87171; cursor:pointer; font-size:1.2rem; transition: transform 0.2s;" title="Ver Motivo da Desclassificação"><i class="fas fa-exclamation-triangle"></i></button>`;
            }

            detailsHtml += `
                <tr class="gerencial-row" data-name="${d.name}" style="${bgStyle}">
                    <td style="font-weight: bold; color: #94a3b8; ${textStyle}">${idx + 1}º</td>
                    <td style="${nameStyle}">${d.name}</td>
                    <td style="color: ${kmlColor}; font-weight: bold; ${textStyle}">${window.utils.formatNumber(d.calc_kml)}</td>
                    <td style="${textStyle}"><div style="display: flex; flex-direction: column; align-items: center;"><span style="color: #38bdf8; font-weight: bold;">${d.ptsKml} pts</span><span style="font-size: 0.7rem; color: #64748b;">${kmlPerc}% da melhor média</span></div></td>
                    <td style="${textStyle}">${window.utils.formatNumber(d.calc_distance, 0)}</td>
                    <td style="${textStyle}"><div style="display: flex; flex-direction: column; align-items: center;"><span style="color: #fbbf24; font-weight: bold;">${d.ptsDist} pts</span><span style="font-size: 0.7rem; color: #64748b;">${distPerc}% da maior dist.</span></div></td>
                    <td style="font-size: 1.1rem; font-weight: bold; color: #10b981; ${textStyle}">${d.indiceDesempenho}</td>
                    <td style="text-align: center;">${statusIcon}</td>
                </tr>
            `;
        });
        
        detailsHtml += `</tbody></table></div></div>`;
        detailsContainer.innerHTML = detailsHtml;

    } catch (e) {
        console.error("Erro na auditoria:", e);
    }
};