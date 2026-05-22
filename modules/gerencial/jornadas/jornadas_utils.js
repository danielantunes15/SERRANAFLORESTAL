// ==========================================
// js/jornadas/jornadas_utils.js
// ==========================================

Chart.register(ChartDataLabels);
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';
Chart.defaults.font.family = "'Inter', sans-serif";

let fullJornadasData = []; 
let jornadasGlobalData = [];
let dadosFiltradosGlobal = [];
let activeQuickFilterJor = 'ALL';
let currentStatusFilter = 'ALL'; 
let currentAnaliticoFilter = 'ALL'; 

let chartStatusFrota = null;
let chartFaixaHoras = null;
let chartEvolucaoOcorrencias = null; 

const regexDate = /(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{4}-\d{1,2}-\d{1,2})/;
const regexTime = /(\d{1,2}:\d{2}(:\d{2})?)/;

// LISTA DE NOMES A SEREM IGNORADOS (NÃO SÃO MOTORISTAS)
const MOTORISTAS_EXCLUIDOS = [
    "KEVEN MELGACO DE JESUS",
    "GIVANILDO DA CONCEIÇÃO URSULINO",
    "DANILO TEIXEIRA SILVA",
    "LEANDRO LAFAIETE ALMEIDA",
    "LUIS CARLOS MENDES MUNIZ",
    "VALDIR ALVES",
    "JOSEMILDO SOARES DE SOUZA",
    "JULIO CESAR ALMEIDA NUNES",
    "DEYVISON DOS SANTOS CRUZ",
    "KLEITON MELGAÇO DA SILVA",
    "WALAS RAMOS DA CRUZ"
];

// Função para auxiliar na ordenação por Data/Hora decrescente
function obterDataHoraParaOrdenacao(inicioStr) {
    if (!inicioStr) return 0;
    const matchDate = inicioStr.match(regexDate);
    const matchTime = inicioStr.match(regexTime);
    
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

function toggleBtnLimparFiltro() {
    const btn = document.getElementById('btnLimparFiltroMotorista');
    if (btn) {
        if (currentAnaliticoFilter !== 'ALL') {
            btn.classList.remove('hidden');
        } else {
            btn.classList.add('hidden');
        }
    }
}

function atualizarBotoesFiltro() {
    const btnQFs = document.querySelectorAll('.btn-qf-jor');
    btnQFs.forEach(b => {
        if (b.getAttribute('data-qf') === activeQuickFilterJor) {
            b.classList.add('active', 'bg-sky-900/50', 'text-sky-400');
            b.classList.remove('text-slate-400');
        } else {
            b.classList.remove('active', 'bg-sky-900/50', 'text-sky-400');
            b.classList.add('text-slate-400');
        }
    });
}

function extrairDataParaFiltro(dataStr) {
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
    if (matchCurto) {
         return new Date(new Date().getFullYear(), matchCurto[2] - 1, matchCurto[1]);
    }
    return null;
}

function verificarStatusAtualizacao(datasArray) {
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
        const dt = extrairDataParaFiltro(dStr);
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

function popularFiltroDatas() {
    const selectData = document.getElementById('filterDataSelect');
    const datasSet = new Set();
    fullJornadasData.forEach(d => {
        if (d.inicio) {
            const match = d.inicio.match(regexDate);
            if (match) {
                let dtStr = match[0];
                if (dtStr.length <= 5) dtStr += '/' + new Date().getFullYear();
                datasSet.add(dtStr);
            }
        }
    });
    
    verificarStatusAtualizacao(Array.from(datasSet));

    const datasUnicas = Array.from(datasSet).sort((a, b) => {
        return extrairDataParaFiltro(b) - extrairDataParaFiltro(a); 
    });
    
    selectData.innerHTML = '<option value="ALL">TODAS AS DATAS</option>';
    datasUnicas.forEach(dataStr => selectData.insertAdjacentHTML('beforeend', `<option value="${dataStr}">${dataStr}</option>`));
    
    selectData.addEventListener('change', (e) => {
        if(e.target.value !== 'ALL') { activeQuickFilterJor = 'ALL'; atualizarBotoesFiltro(); }
        currentStatusFilter = 'ALL'; 
        renderizarPainelJornadas();
    });
}