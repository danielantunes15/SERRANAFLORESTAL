// ==================== js/os_core.js ====================
// Módulo Principal: Variáveis globais, carregamento de dados e navegação

var ordensServico = [];
var ordensServicoTodas = []; // Guarda a lista completa para o sequenciador de números não se perder
var frotasManutencao = [];
var tvInterval = null;
var osSelecionadaParaConclusao = null; 
var osSelecionadaParaServicoExtra = null; 
window.dmDataAtualExport = [];

// Variáveis Globais de Almoxarifado para O.S.
var pecasAlmoxarifadoCache = [];

// Torna as variáveis acessíveis globalmente de forma segura
window.ordensServico = ordensServico;
window.ordensServicoTodas = ordensServicoTodas;
window.frotasManutencao = frotasManutencao;
window.pecasAlmoxarifadoCache = pecasAlmoxarifadoCache;

async function carregarDadosOS() {
    try {
        let todosOsDados = [];
        let inicio = 0;
        const tamanhoLote = 1000;
        let buscarMais = true;

        // Loop para buscar em lotes e ultrapassar a limitação de 1000 registros do Supabase
        while (buscarMais) {
            let queryOS = supabaseClient
                .from('ordens_servico')
                .select('*')
                .order('id', { ascending: false })
                .range(inicio, inicio + tamanhoLote - 1);

            if (typeof window.aplicarFiltroFilial === 'function') {
                queryOS = window.aplicarFiltroFilial(queryOS);
            }

            const { data: lote, error: osError } = await queryOS;

            if (osError) {
                console.error("Erro ao carregar lote de O.S. do Supabase:", osError);
                break;
            }

            if (lote && lote.length > 0) {
                todosOsDados.push(...lote);
                if (lote.length < tamanhoLote) {
                    buscarMais = false;
                } else {
                    inicio += tamanhoLote;
                }
            } else {
                buscarMais = false;
            }
        }

        ordensServicoTodas = todosOsDados;
        // Filtra as inativadas (excluídas logicamente) para sumirem das tabelas e gráficos
        ordensServico = todosOsDados.filter(os => os.inativa !== 1 && os.inativa !== true);

        window.ordensServicoTodas = ordensServicoTodas;
        window.ordensServico = ordensServico;

        // Carrega frotas cadastradas
        let queryFrota = supabaseClient.from('frotas_manutencao').select('*').order('cavalo', { ascending: true });
        if (typeof window.aplicarFiltroFilial === 'function') queryFrota = window.aplicarFiltroFilial(queryFrota);
        const { data: frotaData, error: frotaError } = await queryFrota;
            
        if (!frotaError && frotaData) {
            frotasManutencao = frotaData;
            window.frotasManutencao = frotasManutencao;
        }

        // Pré-carrega peças para facilitar vínculo na O.S.
        let queryPecas = supabaseClient.from('almoxarifado_pecas').select('*');
        if (typeof window.aplicarFiltroFilial === 'function') queryPecas = window.aplicarFiltroFilial(queryPecas);
        const { data: pecasData } = await queryPecas;
        if (pecasData) {
            pecasAlmoxarifadoCache = pecasData;
            window.pecasAlmoxarifadoCache = pecasAlmoxarifadoCache;
        }

    } catch (error) {
        console.error("Erro ao carregar dados do Supabase:", error);
    }
}
window.carregarDadosOS = carregarDadosOS;

async function alternarTelaOS(tela) {
    const telaLista = document.getElementById('telaListaOS');
    const telaListaSinistro = document.getElementById('telaListaSinistro');
    const telaListaSOS = document.getElementById('telaListaSOS'); 
    const telaNova = document.getElementById('telaNovaOS');
    const telaFrota = document.getElementById('telaFrotaOS');
    const telaDisponibilidade = document.getElementById('telaDisponibilidadeOS');
    
    if(telaLista) telaLista.style.display = 'none';
    if(telaListaSinistro) telaListaSinistro.style.display = 'none';
    if(telaListaSOS) telaListaSOS.style.display = 'none';
    if(telaNova) telaNova.style.display = 'none';
    if(telaFrota) telaFrota.style.display = 'none';
    if(telaDisponibilidade) telaDisponibilidade.style.display = 'none';
    
    if (typeof sairModoTV === 'function') sairModoTV();

    await carregarDadosOS();

    if (tela === 'lista') {
        telaLista.style.display = 'block';
        if (typeof renderizarTabelaOS === 'function') renderizarTabelaOS();
    } else if (tela === 'sinistro') {
        if(telaListaSinistro) telaListaSinistro.style.display = 'block';
        if (typeof renderizarTabelaSinistro === 'function') renderizarTabelaSinistro();
    } else if (tela === 'sos') { 
        if(telaListaSOS) telaListaSOS.style.display = 'block';
        if (typeof renderizarTabelaSOS === 'function') renderizarTabelaSOS();
    } else if (tela === 'nova') {
        telaNova.style.display = 'block';
        if (typeof carregarMotoristasSelectOS === 'function') carregarMotoristasSelectOS();
        if (typeof carregarSelectCavalosOS === 'function') carregarSelectCavalosOS();
        
        document.getElementById('osModoEntrada').value = 'imediata';
        if (typeof mudarModoEntrada === 'function') mudarModoEntrada();
        
        if (typeof tratarCamposDinamicos === 'function') tratarCamposDinamicos(); 
        
    } else if (tela === 'frota') {
        telaFrota.style.display = 'block';
        if (typeof renderizarTabelaFrotaManutencao === 'function') renderizarTabelaFrotaManutencao();
    } else if (tela === 'disponibilidade') {
        if(telaDisponibilidade) telaDisponibilidade.style.display = 'block';
        if (typeof renderizarDisponibilidadeMecanica === 'function') renderizarDisponibilidadeMecanica();
    } else if (tela === 'painel_tv') {
        if (typeof entrarModoTV === 'function') entrarModoTV();
    }
}
window.alternarTelaOS = alternarTelaOS;

function formatarDataHoraBrasil(dataString) {
    if (!dataString) return '-';
    const partes = dataString.split('T');
    const data = partes[0].split('-').reverse().join('/');
    return partes[1] ? `${data} ${partes[1].substring(0, 5)}` : data;
}
window.formatarDataHoraBrasil = formatarDataHoraBrasil;