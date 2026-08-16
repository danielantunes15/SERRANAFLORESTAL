// ==================== modules/performance/importar/importar.js ====================

window.tripsModule = window.tripsModule || {};

window.tripsModule.setupUpload = function() {
    const uploadArea = document.getElementById('uploadArea');
    const excelInput = document.getElementById('excel-input');
    if (!uploadArea || !excelInput) return;
    
    // Clonamos para evitar duplicidade de eventos (padrão em SPAs)
    const newUploadArea = uploadArea.cloneNode(true);
    uploadArea.parentNode.replaceChild(newUploadArea, uploadArea);
    const newExcelInput = document.getElementById('excel-input');

    newUploadArea.addEventListener('click', () => newExcelInput.click());
    newUploadArea.addEventListener('dragover', (e) => { e.preventDefault(); newUploadArea.style.borderColor = '#3b82f6'; });
    newUploadArea.addEventListener('dragleave', () => { newUploadArea.style.borderColor = '#475569'; });
    newUploadArea.addEventListener('drop', (e) => {
        e.preventDefault(); newUploadArea.style.borderColor = '#475569';
        const file = e.dataTransfer.files[0];
        if (file) window.tripsModule.handleFile(file);
    });
    newExcelInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) window.tripsModule.handleFile(file);
    });
};

window.tripsModule.parseExcelNumber = function(val) {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        let cleanStr = val.trim().replace(/[R$\s]/g, '');
        if (cleanStr.includes('.') && cleanStr.includes(',')) cleanStr = cleanStr.replace(/\./g, '');
        cleanStr = cleanStr.replace(',', '.');
        const parsed = parseFloat(cleanStr);
        return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
};

window.tripsModule.parseKML = function(val) {
    let parsed = window.tripsModule.parseExcelNumber(val);
    if (parsed > 15) parsed = parsed / 100;
    return parsed;
};

window.tripsModule.parseDateString = function(dateStr) {
    let isoDate = new Date().toISOString();
    if (!dateStr) return isoDate;
    if (typeof dateStr === 'string') {
        if (dateStr.includes('/')) {
            const parts = dateStr.split(' ');
            const dateParts = parts[0].split('/');
            if (dateParts.length === 3) {
                const dia = dateParts[0].padStart(2, '0');
                const mes = dateParts[1].padStart(2, '0');
                let ano = dateParts[2];
                if (ano.length === 2) ano = '20' + ano;
                let time = '12:00:00';
                if (parts.length > 1) {
                    time = parts[1];
                    if (time.split(':').length === 2) time += ':00';
                }
                try { isoDate = new Date(`${ano}-${mes}-${dia}T${time}`).toISOString(); } catch(e) {}
            }
        } else {
            try { isoDate = new Date(dateStr).toISOString(); } catch(err) {}
        }
    } else if (dateStr instanceof Date) {
        isoDate = dateStr.toISOString();
    }
    return isoDate;
};

window.tripsModule.handleFile = function(file) {
    if(window.utils && window.utils.showAlert) window.utils.showAlert('Analisando arquivo Excel, agrupando viagens por dia...', 'info');
    
    setTimeout(() => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: false });
            
            let rawTrips = jsonData.map(row => {
                const kmlValue = row['Km/L'] || row['Km/l'] || row['KM/L'] || row['km/l'] || 0;
                const distanciaValue = row['Distância (Km)'] || row['Distancia (Km)'] || row['distância (km)'] || 0;
                const litrosValue = row['Total Litros Consumido'] || row['total litros consumido'] || 0;
                const dataInicioRaw = row.Início || row.inicio || row['Data Inicial'] || row['Dt Início'];
                const dataFimRaw = row.Fim || row.fim || row['Data Fim'] || row['Dt Fim Descar Fáb'];
                const placaValue = row.Placa || row.placa || row['Veículo'] || row['Equipamento'] || row.Cavalo || row.cavalo || row.Frota || null;
                return {
                    motorista: row.Motorista || row.motorista,
                    placa: placaValue,
                    'Distância (Km)': window.tripsModule.parseExcelNumber(distanciaValue),
                    'Km/l': window.tripsModule.parseKML(kmlValue),
                    'Total Litros Consumido': window.tripsModule.parseExcelNumber(litrosValue),
                    inicio: window.tripsModule.parseDateString(dataInicioRaw),
                    fim: window.tripsModule.parseDateString(dataFimRaw),
                    Transportador: row['Transportador'] || row['Transportadora'],
                    Carregador: row['Carregador'] || row['Carregador Florestal']
                };
            });
            
            const processedTrips = rawTrips.filter(trip => {
                const motoristaNome = String(trip.motorista || '').trim().toUpperCase();
                if (!motoristaNome || motoristaNome === '-') return false;
                
                // Removemos o filtro de distância < 10 AQUI, pois as viagens picotadas 
                // podem ter 2km, 5km, etc., e juntas baterem a meta do dia.
                // Filtraremos após a soma diária.
                
                const transp = String(trip['Transportador'] || '').toUpperCase();
                const carreg = String(trip['Carregador'] || '').toUpperCase();
                if (trip.Transportador !== undefined || trip.Carregador !== undefined) {
                    if (!transp.includes('SERRANALOG') && !carreg.includes('SERRANALOG')) return false;
                }
                return true;
            });
            
            // =========================================================================
            // LÓGICA DE AGRUPAMENTO (SOMA DIÁRIA POR MOTORISTA)
            // =========================================================================
            const agrupadoPorDia = {};

            processedTrips.forEach(trip => {
                // Pega apenas a data (YYYY-MM-DD)
                const dataApenas = trip.inicio.split('T')[0];
                const chave = `${trip.motorista}_${dataApenas}`;

                if (!agrupadoPorDia[chave]) {
                    agrupadoPorDia[chave] = {
                        motorista: trip.motorista,
                        placa: trip.placa,
                        distancia_km: 0,
                        total_litros: 0,
                        inicio: `${dataApenas}T12:00:00.000Z`, // Crava sempre no meio dia
                        fim: trip.fim
                    };
                }

                // Soma as distâncias e litros das viagens "picotadas" do mesmo dia
                agrupadoPorDia[chave].distancia_km += trip['Distância (Km)'];
                agrupadoPorDia[chave].total_litros += trip['Total Litros Consumido'];
                
                // Se a placa tava vazia numa micro-viagem, preenche com a primeira válida
                if (!agrupadoPorDia[chave].placa && trip.placa) {
                    agrupadoPorDia[chave].placa = trip.placa;
                }
            });

            // Converte o objeto de volta para um Array recalculando a média geral do dia
            const viagensDiariasAgrupadas = Object.values(agrupadoPorDia)
                .map(trip => {
                    // Recalcula o KM/L do dia exato baseado na soma total da distância e litros
                    const mediaKmlDia = trip.total_litros > 0 ? (trip.distancia_km / trip.total_litros) : 0;
                    
                    return {
                        motorista: trip.motorista,
                        placa: trip.placa,
                        'Distância (Km)': trip.distancia_km,
                        'Km/l': mediaKmlDia,
                        'Total Litros Consumido': trip.total_litros,
                        inicio: trip.inicio,
                        fim: trip.fim
                    };
                })
                .filter(trip => trip['Distância (Km)'] >= 10); // Agora sim, descartamos dias inteiros < 10km
            
            if (rawTrips.length > 0 && viagensDiariasAgrupadas.length === 0) {
                alert('Nenhuma viagem válida encontrada. Verifique se as regras batem (Motoristas, Transportadora SERRANALOG e Distância Diária > 10).');
            } else if (viagensDiariasAgrupadas.length > 0) {
                window.tripsModule.importFromExcel(viagensDiariasAgrupadas);
            }
        };
        reader.readAsArrayBuffer(file);
    }, 300);
};

window.tripsModule.importFromExcel = async function(data) {
    const supabaseData = data.map(t => {
        let obj = {
            motorista: t.motorista,
            placa: t.placa,
            distancia_km: t['Distância (Km)'],
            kml: t['Km/l'],
            total_litros: t['Total Litros Consumido'],
            inicio: t.inicio,
            fim: t.fim
        };
        if(window.injetarFilial) obj = window.injetarFilial(obj);
        return obj;
    });
    
    alert(`Enviando dados agrupados (${supabaseData.length} dias de viagem) para o servidor. Aguarde a confirmação...`);
    
    const batchSize = 500;
    let hasError = false;
    
    for (let i = 0; i < supabaseData.length; i += batchSize) {
        const batch = supabaseData.slice(i, i + batchSize);
        const { error } = await window.supabaseClient
            .from('performance')
            .upsert(batch, { onConflict: 'motorista,inicio', ignoreDuplicates: true });
            
        if (error) {
            console.error(error);
            hasError = true;
        }
    }
    
    if (hasError) {
        alert('Ocorreu um erro ao importar alguns lotes. Verifique o console.');
    } else {
        alert(`Planilha importada e consolidada por dia com sucesso!`);
        window.tripsModule.renderRecentTripsTable(supabaseData);
    }
};

window.tripsModule.renderRecentTripsTable = function(trips) {
    const tbody = document.getElementById('trips-list');
    if (!tbody) return;
    const recentTrips = trips.slice(0, 10); 
    
    tbody.innerHTML = recentTrips.map(trip => `
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #334155; font-weight: 500;">${trip.motorista || '-'}</td>
            <td style="padding: 10px; border-bottom: 1px solid #334155;">${window.utils ? window.utils.formatNumber(trip.distancia_km) : trip.distancia_km}</td>
            <td style="padding: 10px; border-bottom: 1px solid #334155; color: #10b981; font-weight: 600;">${window.utils ? window.utils.formatNumber(trip.kml) : trip.kml}</td>
            <td style="padding: 10px; border-bottom: 1px solid #334155;">${window.utils ? window.utils.formatNumber(trip.total_litros) : trip.total_litros}</td>
            <td style="padding: 10px; border-bottom: 1px solid #334155;">${window.utils ? window.utils.formatDate(trip.inicio) : trip.inicio}</td>
        </tr>
    `).join('');
    
    const tripCount = document.getElementById('trip-count');
    if (tripCount) tripCount.textContent = `${trips.length} dias processados (Agrupamento Ativo)`;
};