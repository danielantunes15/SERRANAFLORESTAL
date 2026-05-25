// ==========================================
// js/jornadas/jornadas_utils.js
// ==========================================

// PROTEÇÃO ANTI-CRASH: Se o Chart demorar a carregar, não quebra a tela toda
try {
    if(typeof Chart !== 'undefined') {
        if (typeof ChartDataLabels !== 'undefined') {
            Chart.register(ChartDataLabels);
        }
        Chart.defaults.color = '#94a3b8';
        Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';
        Chart.defaults.font.family = "'Inter', sans-serif";
    }
} catch(e) { console.warn("[Jornadas] Aviso: ChartJS carregou com atraso.", e); }

window.formatarHorasMinutos = window.formatarHorasMinutos || function(decimalHours) {
    if (!decimalHours || isNaN(decimalHours)) return "0h 00m";
    const h = Math.floor(parseFloat(decimalHours));
    const m = Math.round((parseFloat(decimalHours) - h) * 60);
    return `${h}h ${m.toString().padStart(2, '0')}m`;
};

window.regexDate = /(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{4}-\d{1,2}-\d{1,2})/;
window.regexTime = /(\d{1,2}:\d{2}(:\d{2})?)/;

window.fullJornadasData = window.fullJornadasData || []; 
window.jornadasGlobalData = window.jornadasGlobalData || [];
window.dadosFiltradosGlobal = window.dadosFiltradosGlobal || [];
window.activeQuickFilterJor = window.activeQuickFilterJor || 'ALL';
window.currentStatusFilter = window.currentStatusFilter || 'ALL'; 
window.currentAnaliticoFilter = window.currentAnaliticoFilter || 'ALL'; 

window.chartStatusFrota = window.chartStatusFrota || null;
window.chartFaixaHoras = window.chartFaixaHoras || null;
window.chartEvolucaoOcorrencias = window.chartEvolucaoOcorrencias || null; 

window.MOTORISTAS_EXCLUIDOS = window.MOTORISTAS_EXCLUIDOS || [
    "KEVEN MELGACO DE JESUS", "GIVANILDO DA CONCEIÇÃO URSULINO",
    "DANILO TEIXEIRA SILVA", "LEANDRO LAFAIETE ALMEIDA",
    "LUIS CARLOS MENDES MUNIZ", "VALDIR ALVES", "JOSEMILDO SOARES DE SOUZA",
    "JULIO CESAR ALMEIDA NUNES", "DEYVISON DOS SANTOS CRUZ",
    "KLEITON MELGAÇO DA SILVA", "WALAS RAMOS DA CRUZ"
];

window.obterDataHoraParaOrdenacao = window.obterDataHoraParaOrdenacao || function(inicioStr) {
    if (!inicioStr) return 0;
    const matchDate = inicioStr.match(window.regexDate);
    const matchTime = inicioStr.match(window.regexTime);
    
    let dataObj = new Date(0);
    if (matchDate) {
        let match = matchDate[0].match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
        if (match) {
            let year = parseInt(match[3], 10);
            if (year < 100) year += 2000;
            dataObj = new Date(year, match[2] - 1, match[1]); 
        } else {
            let matchISO = matchDate[0].match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
            if (matchISO) dataObj = new Date(matchISO[1], matchISO[2] - 1, matchISO[3]);
            else {
                let matchCurto = matchDate[0].match(/(\d{1,2})\/(\d{1,2})/);
                if (matchCurto) dataObj = new Date(new Date().getFullYear(), matchCurto[2] - 1, matchCurto[1]);
            }
        }
    }
    if (matchTime) {
        const parts = matchTime[0].split(':');
        dataObj.setHours(parseInt(parts[0] || 0, 10));
        dataObj.setMinutes(parseInt(parts[1] || 0, 10));
        if(parts.length > 2) dataObj.setSeconds(parseInt(parts[2] || 0, 10));
    }
    return dataObj.getTime();
}

window.toggleBtnLimparFiltro = window.toggleBtnLimparFiltro || function() {
    const btn = document.getElementById('btnLimparFiltroMotorista');
    if (btn) {
        if (window.currentAnaliticoFilter !== 'ALL') btn.classList.remove('hidden');
        else btn.classList.add('hidden');
    }
}

window.atualizarBotoesFiltro = window.atualizarBotoesFiltro || function() {
    const btnQFs = document.querySelectorAll('.btn-qf-jor');
    btnQFs.forEach(b => {
        if (b.getAttribute('data-qf') === window.activeQuickFilterJor) {
            b.classList.add('active', 'bg-sky-900/50', 'text-sky-400');
            b.classList.remove('text-slate-400');
        } else {
            b.classList.remove('active', 'bg-sky-900/50', 'text-sky-400');
            b.classList.add('text-slate-400');
        }
    });
}

window.extrairDataParaFiltro = window.extrairDataParaFiltro || function(dataStr) {
    if (!dataStr) return null;
    let match = dataStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (match) {
        let year = parseInt(match[3], 10);
        if (year < 100) year += 2000;
        return new Date(year, match[2] - 1, match[1]); 
    }
    let matchISO = dataStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (matchISO) return new Date(matchISO[1], matchISO[2] - 1, matchISO[3]);

    let matchCurto = dataStr.match(/(\d{1,2})\/(\d{1,2})/);
    if (matchCurto) return new Date(new Date().getFullYear(), matchCurto[2] - 1, matchCurto[1]);
    return null;
}

window.verificarStatusAtualizacao = window.verificarStatusAtualizacao || function(datasArray) {
    const indicador = document.getElementById('indicadorAtualizacao');
    const icone = document.getElementById('iconeAtualizacao');
    const texto = document.getElementById('textoAtualizacao');
    if(!indicador) return;

    indicador.classList.remove('hidden');

    if (!datasArray || datasArray.length === 0) {
        indicador.className = "flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] sm:text-xs font-bold uppercase tracking-widest shadow-inner bg-slate-900/50 text-slate-400 border-slate-600";
        icone.className = "fas fa-times-circle";
        texto.innerText = "Sem Dados";
        return;
    }

    let maxDate = new Date(0);
    let maxDateStr = "";

    datasArray.forEach(dStr => {
        const dt = window.extrairDataParaFiltro(dStr);
        if (dt && dt > maxDate) {
            maxDate = dt;
            const dia = String(dt.getDate()).padStart(2, '0');
            const mes = String(dt.getMonth() + 1).padStart(2, '0');
            const ano = dt.getFullYear();
            maxDateStr = `${dia}/${mes}/${ano}`;
        }
    });

    const hoje = new Date();
    const diaH = String(hoje.getDate()).padStart(2, '0');
    const mesH = String(hoje.getMonth() + 1).padStart(2, '0');
    const anoH = hoje.getFullYear();
    const hojeStr = `${diaH}/${mesH}/${anoH}`;

    if (maxDateStr === hojeStr) {
        indicador.className = "flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] sm:text-xs font-bold uppercase tracking-widest shadow-inner bg-emerald-900/30 text-emerald-400 border-emerald-500/50 transition-colors";
        icone.className = "fas fa-check-circle";
        texto.innerText = "Atualizado Hoje";
    } else {
        indicador.className = "flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] sm:text-xs font-bold uppercase tracking-widest shadow-inner bg-amber-900/30 text-amber-400 border-amber-500/50 transition-colors";
        icone.className = "fas fa-exclamation-triangle";
        texto.innerText = `Base: ${maxDateStr}`;
    }
}

window.popularFiltroDatas = window.popularFiltroDatas || function() {
    const selectData = document.getElementById('filterDataSelect');
    if (!selectData) return;
    const datasSet = new Set();
    
    const dadosGerais = window.fullJornadasData || [];
    
    dadosGerais.forEach(d => {
        if (d.inicio) {
            const match = d.inicio.match(window.regexDate);
            if (match) {
                let dtStr = match[0];
                if (dtStr.length <= 5) dtStr += '/' + new Date().getFullYear();
                datasSet.add(dtStr);
            }
        }
    });
    
    window.verificarStatusAtualizacao(Array.from(datasSet));

    const datasUnicas = Array.from(datasSet).sort((a, b) => {
        return window.extrairDataParaFiltro(b) - window.extrairDataParaFiltro(a); 
    });
    
    selectData.innerHTML = '<option value="ALL">TODAS AS DATAS</option>';
    datasUnicas.forEach(dataStr => selectData.insertAdjacentHTML('beforeend', `<option value="${dataStr}">${dataStr}</option>`));
    
    selectData.removeEventListener('change', window._onChangeDataFilterJornadas);
    window._onChangeDataFilterJornadas = (e) => {
        if(e.target.value !== 'ALL') { 
            window.activeQuickFilterJor = 'ALL'; 
            if(typeof window.atualizarBotoesFiltro === 'function') window.atualizarBotoesFiltro(); 
        }
        window.currentStatusFilter = 'ALL'; 
        if(typeof window.renderizarPainelJornadas === 'function') window.renderizarPainelJornadas();
    };
    selectData.addEventListener('change', window._onChangeDataFilterJornadas);
}