// ==================== ESTRUTURA DE DADOS GLOBAL ====================
let conjuntos = [];
let motoristas = [];
let escalas = {};

const HORARIOS_PROIBIDOS = ['23:00', '00:00', '01:00'];
const TURNOS = [];
for (let i = 0; i < 24; i++) {
    const horaInicio = `${String(i).padStart(2, '0')}:00`;
    if (!HORARIOS_PROIBIDOS.includes(horaInicio)) {
        const horaFimNum = (i + 12) % 24;
        const horaFim = `${String(horaFimNum).padStart(2, '0')}:00`;
        TURNOS.push({ nome: `12h`, inicio: horaInicio, fim: horaFim, periodo: `${horaInicio}-${horaFim}` });
    }
}

function getDatasSemana(dataInicialStr = null) {
    // Se não passar data, tenta pegar do input, senão usa a data atual
    let dataBase = new Date();
    
    if (dataInicialStr) {
        dataBase = new Date(dataInicialStr + 'T00:00:00'); // Evita erro de fuso horário
    } else {
        const inputData = document.getElementById('dataInicioEscala');
        if (inputData && inputData.value) {
            dataBase = new Date(inputData.value + 'T00:00:00');
        }
    }

    const datas = [];
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    // Mostra 7 dias a partir da data SELECIONADA
    for (let i = 0; i < 7; i++) {
        const data = new Date(dataBase);
        data.setDate(dataBase.getDate() + i);
        
        // CORREÇÃO DO FUSO: Forçando a data local exata
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const dia = String(data.getDate()).padStart(2, '0');
        const dataStr = `${ano}-${mes}-${dia}`;

        datas.push({
            dateKey: dataStr,
            diaTexto: diasSemana[data.getDay()],
            diaNum: `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth()+1).padStart(2, '0')}`
        });
    }
    return datas;
}

let currentDatas = getDatasSemana();

// SISTEMA DE BACKUP LOCAL (Evita perda de dados se o BD falhar)
function salvarBackupLocal() {
    localStorage.setItem('ccol_motoristas', JSON.stringify(motoristas));
    localStorage.setItem('ccol_conjuntos', JSON.stringify(conjuntos));
    localStorage.setItem('ccol_escalas', JSON.stringify(escalas));
}

async function carregarDadosIniciais() {
    try {
        const dbConjuntos = await db.getConjuntos();
        const dbMotoristas = await db.getMotoristas();
        const dbEscalas = await db.getEscalas();

        // Alteração: Removido o bloco que puxava dados fantasmas do localStorage.
        // Agora, o sistema sempre confia 100% no Supabase. Se o Supabase estiver vazio, a tela ficará vazia.
        
        conjuntos = dbConjuntos;
        motoristas = dbMotoristas;
        escalas = {};

        motoristas.forEach(m => { escalas[m.id] = {}; });

        dbEscalas.forEach(e => {
            if (!escalas[e.motorista_id]) escalas[e.motorista_id] = {};
            escalas[e.motorista_id][e.data] = { turno: e.turno, caminhao: e.caminhao, status: e.status };
        });

        // Garante que todos os dias existam na escala
        const datas = getDatasSemana();
        motoristas.forEach(m => {
            if (!escalas[m.id]) escalas[m.id] = {};
            datas.forEach(d => {
                if (!escalas[m.id][d.dateKey]) {
                    escalas[m.id][d.dateKey] = { turno: m.turno || TURNOS[0].periodo, caminhao: 'F', status: 'normal' };
                }
            });
        });

        salvarBackupLocal();
    } catch (e) {
        console.error("Erro no DB. Carregando offline...", e);
        gerarDadosExemploLocais();
    }
}

function atualizarStats() {
    const statConjuntos = document.getElementById('statConjuntos');
    const statCaminhoes = document.getElementById('statCaminhoes');
    const statMotoristas = document.getElementById('statMotoristas');
    const statEscalasHoje = document.getElementById('statEscalasHoje');
    
    if (statConjuntos) statConjuntos.innerText = conjuntos.length;
    if (statCaminhoes) statCaminhoes.innerText = conjuntos.reduce((acc, c) => acc + (c.caminhoes?.length || 0), 0);
    if (statMotoristas) statMotoristas.innerText = motoristas.length;

    if (statEscalasHoje) {
        // CORREÇÃO DO FUSO: Forçando a data local exata
        const agora = new Date();
        const ano = agora.getFullYear();
        const mes = String(agora.getMonth() + 1).padStart(2, '0');
        const dia = String(agora.getDate()).padStart(2, '0');
        const hoje = `${ano}-${mes}-${dia}`;
        
        statEscalasHoje.innerText = motoristas.filter(m => escalas[m.id]?.[hoje]?.caminhao !== 'F').length;
    }
}

function gerarDadosExemploLocais() {
    conjuntos = []; motoristas = []; escalas = {};
    salvarBackupLocal();
}