// ==================== modules/performance/dashboard/dashboard.js ====================

window.app = window.app || {};

window.app.updateDashboard = async function() {
    try {
        const top5Tbody = document.getElementById('top5-list');
        if (top5Tbody) top5Tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;"><i class="fas fa-spinner fa-spin"></i> Carregando dados do servidor...</td></tr>';

        const drivers = await db.getMotoristas(); 
        const cavalos = await db.getConjuntos();  
        
        let allTrips = [];
        let ocorrencias = [];
        
        try {
            const viagensRes = await window.supabaseClient.from('performance').select('*');
            if (viagensRes.data) allTrips = viagensRes.data;
            const ocorrenciasRes = await window.supabaseClient.from('ocorrencias').select('*');
            if (ocorrenciasRes.data) ocorrencias = ocorrenciasRes.data;
        } catch(e) {
            console.warn("Tabelas podem não existir ainda no banco de dados.");
        }
        
        let configuracoes = { globalGoal: 1.8 }; 
        try {
            // ATUALIZADO PARA A TABELA performance_configuracoes
            const configRes = await window.supabaseClient.from('performance_configuracoes').select('*').limit(1);
            if (configRes.data && configRes.data.length > 0) {
                configuracoes.globalGoal = parseFloat(configRes.data[0].global_goal || 1.8);
            }
        } catch (e) {}

        const filterSelect = document.getElementById('dashboard-cavalo-filter');
        const selectedPlaca = filterSelect ? filterSelect.value : '';
        
        const goal = configuracoes.globalGoal;
        const getColor = (kml) => {
            const numKml = parseFloat(String(kml).replace(',', '.')) || 0;
            if (numKml <= 0) return '#94a3b8';
            return numKml >= goal ? '#10b981' : '#f87171';
        };

        if (filterSelect && filterSelect.options.length <= 1) {
            const uniquePlacas = [...new Set(allTrips.map(t => t.placa).filter(Boolean))].sort();
            uniquePlacas.forEach(p => {
                filterSelect.innerHTML += `<option value="${p}">${p}</option>`;
            });
        }

        let filteredTrips = allTrips;
        if (selectedPlaca) {
            filteredTrips = allTrips.filter(t => t.placa === selectedPlaca);
        }

        const sumDistance = filteredTrips.reduce((sum, t) => sum + (parseFloat(t.distancia_km) || 0), 0);
        const sumLiters = filteredTrips.reduce((sum, t) => sum + (parseFloat(t.total_litros) || 0), 0);
        
        const totalDriversEl = document.getElementById('total-drivers');
        const totalDistanceEl = document.getElementById('total-distance');
        const totalLitersEl = document.getElementById('total-liters');
        const avgEconomyEl = document.getElementById('avg-economy');

        if (totalDriversEl) totalDriversEl.textContent = drivers.length;
        if (totalDistanceEl) totalDistanceEl.textContent = window.utils.formatNumber(sumDistance, 0) + ' km';
        if (totalLitersEl) totalLitersEl.textContent = window.utils.formatNumber(sumLiters, 0) + ' L';
        
        if (avgEconomyEl) {
            const globalAvg = sumLiters > 0 ? (sumDistance / sumLiters) : 0;
            avgEconomyEl.textContent = window.utils.formatNumber(globalAvg, 2);
            avgEconomyEl.style.color = getColor(globalAvg);
        }

        const driverStats = {};
        filteredTrips.forEach(t => {
            const driverName = t.motorista || 'Não Identificado';
            if (!driverStats[driverName]) driverStats[driverName] = { distance: 0, liters: 0 };
            driverStats[driverName].distance += parseFloat(t.distancia_km) || 0;
            driverStats[driverName].liters += parseFloat(t.total_litros) || 0;
        });

        const driverArray = Object.keys(driverStats).map(name => {
            const stat = driverStats[name];
            const kml = stat.liters > 0 ? (stat.distance / stat.liters) : 0;
            return { name, distance: stat.distance, liters: stat.liters, kml };
        }).filter(d => d.distance > 0);
        
        driverArray.sort((a, b) => b.kml - a.kml);

        const topDriverEl = document.getElementById('top-driver');
        if (topDriverEl) {
            const now = new Date();
            const eligibleForHighlight = driverArray.filter(d => {
                const hasOcorrenciaMes = ocorrencias.some(oc => {
                    if (!oc.data_ocorrido) return false;
                    const ocDate = new Date(oc.data_ocorrido + 'T00:00:00');
                    return oc.nome_envolvido === d.name && ocDate.getMonth() === now.getMonth() && ocDate.getFullYear() === now.getFullYear();
                });
                return !hasOcorrenciaMes;
            });
            topDriverEl.textContent = eligibleForHighlight.length > 0 ? eligibleForHighlight[0].name : '-';
        }

        if (top5Tbody) {
            const top5 = driverArray.filter(d => d.distance >= 1000).slice(0, 5);
            top5Tbody.innerHTML = top5.map(d => `<tr><td style="font-weight:500;">${d.name}</td><td style="color: ${getColor(d.kml)}; font-weight: bold;">${window.utils.formatNumber(d.kml, 2)}</td><td>${window.utils.formatNumber(d.distance, 0)} km</td></tr>`).join('') || '<tr><td colspan="3" class="text-center" style="color: #94a3b8;">Sem dados de viagens suficientes</td></tr>';
        }

        const bottom5Tbody = document.getElementById('bottom5-list');
        if (bottom5Tbody) {
            const bottom5 = [...driverArray].filter(d => d.kml > 0).sort((a, b) => a.kml - b.kml).slice(0, 5);
            bottom5Tbody.innerHTML = bottom5.map(d => `<tr><td style="font-weight:500;">${d.name}</td><td style="color: ${getColor(d.kml)}; font-weight: bold;">${window.utils.formatNumber(d.kml, 2)}</td><td>${window.utils.formatNumber(d.distance, 0)} km</td></tr>`).join('') || '<tr><td colspan="3" class="text-center" style="color: #94a3b8;">Sem dados de viagens suficientes</td></tr>';
        }

        const dashDriversTbody = document.getElementById('dash-drivers-list');
        if (dashDriversTbody) {
            const dashDrivers = driverArray.filter(d => d.distance >= 1000);
            dashDriversTbody.innerHTML = dashDrivers.map(d => `<tr><td style="font-weight:500; color: #f8fafc;">${d.name}</td><td>${window.utils.formatNumber(d.distance, 0)}</td><td style="color: ${getColor(d.kml)}; font-weight: bold;">${window.utils.formatNumber(d.kml, 2)}</td></tr>`).join('') || '<tr><td colspan="3" class="text-center" style="color: #94a3b8;">Nenhuma viagem registrada > 1000km</td></tr>';
        }

        const cavaloStats = {};
        filteredTrips.forEach(t => {
            const p = t.placa || 'Sem Placa';
            if (!cavaloStats[p]) cavaloStats[p] = { distance: 0, liters: 0 };
            cavaloStats[p].distance += parseFloat(t.distancia_km) || 0;
            cavaloStats[p].liters += parseFloat(t.total_litros) || 0;
        });

        const cavaloArray = Object.keys(cavaloStats).map(placa => {
            const stat = cavaloStats[placa];
            const kml = stat.liters > 0 ? (stat.distance / stat.liters) : 0;
            return { placa, carretas: 'Ver no Cadastro', distance: stat.distance, liters: stat.liters, kml };
        }).filter(c => c.distance > 0).sort((a, b) => b.kml - a.kml);

        const dashCavalosTbody = document.getElementById('dash-cavalos-list');
        if (dashCavalosTbody) {
            dashCavalosTbody.innerHTML = cavaloArray.map(c => `
                <tr>
                    <td><strong style="color:#f8fafc;">${c.placa}</strong></td>
                    <td>${window.utils.formatNumber(c.distance, 0)}</td>
                    <td style="color: ${getColor(c.kml)}; font-weight: bold;">${window.utils.formatNumber(c.kml, 2)}</td>
                </tr>
            `).join('') || '<tr><td colspan="3" class="text-center" style="color: #94a3b8;">Nenhuma viagem registrada</td></tr>';
        }
    } catch (error) {
        console.error("Erro ao carregar Dashboard de Performance:", error);
    }
};