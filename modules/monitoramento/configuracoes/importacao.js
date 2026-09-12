// ==========================================
// js/configuracoes/importacao.js (MAESTRO CENTRAL)
// ==========================================

// Funções utilitárias compartilhadas globalmente entre as filiais
window.obterDataHoraLocal = function() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

window.timeParaDecimal = function(timeStr) {
    if (!timeStr) return 0;
    const str = String(timeStr).trim();
    const parts = str.split(':');
    if (parts.length >= 2) {
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        return h + (m / 60);
    }
    const num = parseFloat(str.replace(',', '.'));
    return isNaN(num) ? 0 : num;
};

window.parseTime = function(timeStr) {
    if (!timeStr) return null;
    const val = parseFloat(timeStr);
    if (!isNaN(val) && val < 1) {
        const totalMinutes = Math.round(val * 24 * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    const match = String(timeStr).match(/(\d{1,2}):(\d{2})/);
    return match ? `${String(match[1]).padStart(2, '0')}:${match[2]}` : null;
};

// Gerenciador central de arrastar e soltar (Drag and Drop)
window.initImportacao = function() {
    const dropZonesMap = [
        { id: 'dropZone', func: window.processAndSaveFile, bgHover: 'bg-emerald-900/20' },
        { id: 'dropZoneJornadas', func: window.processAndSaveJornadasFile, bgHover: 'bg-amber-900/20' },
        { id: 'dropZoneEventos', func: window.processAndSaveEventosFile, bgHover: 'bg-rose-900/20' },
        
        { id: 'dropZoneBracell', func: window.processarImportacaoBracell, bgHover: 'bg-sky-900/20' },
        { id: 'dropZoneJornadasBracell', func: window.processAndSaveJornadasFileBracell, bgHover: 'bg-amber-900/20' },
        { id: 'dropZoneEventosBracell', func: window.processAndSaveEventosFileBracell, bgHover: 'bg-rose-900/20' },
        
        { id: 'dropZoneVeracel', func: window.processarImportacaoVeracel, bgHover: 'bg-teal-900/20' },
        { id: 'dropZoneJornadasVeracel', func: window.processAndSaveJornadasFileVeracel, bgHover: 'bg-amber-900/20' },
        { id: 'dropZoneEventosVeracel', func: window.processAndSaveEventosFileVeracel, bgHover: 'bg-rose-900/20' }
    ];

    dropZonesMap.forEach(zone => {
        const dz = document.getElementById(zone.id);
        if (dz) {
            dz.ondragover = e => { e.preventDefault(); dz.classList.add(zone.bgHover); };
            dz.ondragleave = () => dz.classList.remove(zone.bgHover);
            dz.ondrop = e => { 
                e.preventDefault(); 
                dz.classList.remove(zone.bgHover); 
                if (e.dataTransfer.files.length > 0 && typeof zone.func === 'function') {
                    zone.func(e.dataTransfer.files[0]);
                } else if (!zone.func) {
                    alert('Módulo de importação em desenvolvimento.');
                }
            };
        }
    });
};

document.addEventListener('DOMContentLoaded', window.initImportacao);