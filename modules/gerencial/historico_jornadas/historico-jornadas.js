// ==========================================
// js/historico-jornadas.js - TELA DE AUDITORIA DE JORNADAS
// ==========================================

let fullHistoricoJornadas = [];
let paginaAtualJor = 0;
const itensPorPaginaJor = 50;
let termoBuscaJor = '';
let motoristaFiltroJor = 'ALL';
let carregandoJor = false;
let fimDosDadosJor = false;
let debounceTimerJor;

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
    "KLEITON MELGAÇO DA SILVA"
];

document.addEventListener('DOMContentLoaded', () => {
    carregarDropdownMotoristas();
    loadHistoricoJornadasCompleto(true);
    
    const searchInput = document.getElementById('searchHistoricoJornadas');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimerJor);
            debounceTimerJor = setTimeout(() => {
                termoBuscaJor = e.target.value.trim().toLowerCase();
                loadHistoricoJornadasCompleto(true);
            }, 500);
        });
    }

    const dropdown = document.getElementById('filterMotoristaDropdown');
    if (dropdown) {
        dropdown.addEventListener('change', (e) => {
            motoristaFiltroJor = e.target.value;
            loadHistoricoJornadasCompleto(true);
        });
    }
});

async function carregarDropdownMotoristas() {
    try {
        // Sem order('id')
        const { data } = await supabaseClient
            .from('historico_jornadas')
            .select('motorista')
            .limit(5000); 
            
        if (data) {
            const select = document.getElementById('filterMotoristaDropdown');
            if (!select) return;

            // Filtra os que não são motoristas antes de preencher o dropdown
            const motoristasUnicos = [...new Set(data.map(d => d.motorista))]
                .filter(Boolean)
                .filter(m => !MOTORISTAS_EXCLUIDOS.includes(m.toUpperCase()))
                .sort();
                
            select.innerHTML = '<option value="ALL">TODOS OS MOTORISTAS</option>';
            motoristasUnicos.forEach(m => {
                select.insertAdjacentHTML('beforeend', `<option value="${m}">${m}</option>`);
            });
        }
    } catch(e) { console.error("Erro ao carregar dropdown:", e); }
}

async function loadHistoricoJornadasCompleto(reset = false) {
    if (carregandoJor) return;
    carregandoJor = true;

    if (reset) {
        paginaAtualJor = 0;
        fullHistoricoJornadas = [];
        fimDosDadosJor = false;
        const tbody = document.getElementById('historicoJornadasBody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-400"><i class="fas fa-spinner fa-spin mr-2"></i>Buscando jornadas no servidor...</td></tr>`;
    }

    if (fimDosDadosJor) { carregandoJor = false; return; }

    try {
        const de = paginaAtualJor * itensPorPaginaJor;
        const ate = de + itensPorPaginaJor - 1;

        // Sem order('id')
        let query = supabaseClient
            .from('historico_jornadas')
            .select('*')
            .range(de, ate);

        if (motoristaFiltroJor !== 'ALL') {
            query = query.eq('motorista', motoristaFiltroJor);
        }

        if (termoBuscaJor) {
            query = query.or(`motorista.ilike.%${termoBuscaJor}%,placa.ilike.%${termoBuscaJor}%`);
        }

        const { data, error } = await query;

        if (error) throw error;
        
        if (data) { 
            if (data.length < itensPorPaginaJor) fimDosDadosJor = true;
            
            // REMOVE DUPLICATAS E NOMES IGNORADOS AO CARREGAR
            const dadosLimpos = [];
            data.reverse().forEach(item => {
                const nome = (item.motorista || "").toUpperCase();
                
                // Ignora se for nome da lista de exclusão
                if (MOTORISTAS_EXCLUIDOS.includes(nome)) return;
                
                // Checa se já existe para não exibir linha duplicada
                const chave = `${item.motorista || ''}-${item.inicio || ''}-${item.fim || ''}`;
                
                const isDuplicate = fullHistoricoJornadas.some(d => `${d.motorista || ''}-${d.inicio || ''}-${d.fim || ''}` === chave) || 
                                    dadosLimpos.some(d => `${d.motorista || ''}-${d.inicio || ''}-${d.fim || ''}` === chave);
                
                if (!isDuplicate) {
                    dadosLimpos.push(item);
                }
            });

            fullHistoricoJornadas = [...fullHistoricoJornadas, ...dadosLimpos];
            paginaAtualJor++;
            renderHistoricoJornadasTable(); 
        }
    } catch(e) {
        console.error("Erro ao carregar histórico de jornadas:", e);
        const tbody = document.getElementById('historicoJornadasBody');
        if (tbody && reset) tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-rose-500">Erro ao carregar dados. Verifique a conexão.</td></tr>`;
    } finally {
        carregandoJor = false;
    }
}

function renderHistoricoJornadasTable() {
    const t = document.getElementById('historicoJornadasBody');
    if(!t) return;
    
    t.innerHTML = '';
    
    if(fullHistoricoJornadas.length === 0) {
        t.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-500">Nenhuma jornada encontrada para este filtro.</td></tr>`;
        return;
    }

    fullHistoricoJornadas.forEach(r => {
        const horas = r.total_trabalho_horas || 0;
        const isEstouro = horas > 12;

        let dtInicio = '-', hrInicio = '-', dtFim = '-', hrFim = '-';
        if (r.inicio) {
            const mD = r.inicio.match(regexDate); const mT = r.inicio.match(regexTime);
            if (mD) { dtInicio = mD[0]; if(dtInicio.length <= 5) dtInicio += '/' + new Date().getFullYear(); }
            if (mT) hrInicio = mT[0]; if (!mD && !mT) hrInicio = r.inicio;
        }
        if (r.fim) {
            const mDF = r.fim.match(regexDate); const mTF = r.fim.match(regexTime);
            if (mDF) { dtFim = mDF[0]; if(dtFim.length <= 5) dtFim += '/' + new Date().getFullYear(); } else dtFim = dtInicio;
            if (mTF) hrFim = mTF[0]; else hrFim = r.fim.replace(regexDate, '').replace('-', '').trim() || r.fim;
        }

        let corLinha = 'text-emerald-400';
        let badge = `<span class="border border-emerald-500 text-emerald-500 bg-emerald-900/20 px-2 py-1 rounded text-[10px] uppercase font-bold">OK</span>`;
        if(isEstouro) {
            corLinha = 'text-rose-500 font-bold';
            badge = `<span class="border border-rose-500 text-rose-500 bg-rose-900/20 px-2 py-1 rounded text-[10px] uppercase font-bold">INFRAÇÃO</span>`;
        }

        t.insertAdjacentHTML('beforeend', `<tr class="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
            <td class="px-6 py-3 text-sm font-semibold text-sky-400 truncate max-w-[180px]">${r.motorista || '-'}</td>
            <td class="px-6 py-3 text-sm font-bold text-slate-300">${r.placa || '-'}</td>
            <td class="px-6 py-3 text-xs text-slate-400"><span class="text-[10px] text-slate-500 block">${dtInicio}</span><span class="font-mono text-slate-200">${hrInicio}</span></td>
            <td class="px-6 py-3 text-xs text-slate-400"><span class="text-[10px] text-slate-500 block">${dtFim}</span><span class="font-mono text-slate-200">${hrFim}</span></td>
            <td class="px-6 py-3 text-center text-sm font-bold text-indigo-400">${formatarHorasMinutos(r.horas_noturnas)}</td>
            <td class="px-6 py-3 text-center text-sm font-bold text-amber-400">${formatarHorasMinutos(r.horas_extras)}</td>
            <td class="px-6 py-3 text-center text-sm ${corLinha}">${formatarHorasMinutos(horas)}</td>
            <td class="px-6 py-3 text-center text-sm text-slate-400">${formatarHorasMinutos(r.direcao_horas)}</td>
            <td class="px-6 py-3 text-center">${badge}</td>
        </tr>`);
    });

    if (!fimDosDadosJor) {
        t.insertAdjacentHTML('beforeend', `
            <tr id="rowCarregarMaisJor">
                <td colspan="9" class="text-center py-6">
                    <button onclick="loadHistoricoJornadasCompleto()" class="bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 border border-amber-500/50 font-bold py-2.5 px-8 rounded-full transition-all text-sm shadow-lg">
                        <i class="fas fa-chevron-down mr-2"></i> Carregar Mais Registros
                    </button>
                </td>
            </tr>
        `);
    }
}