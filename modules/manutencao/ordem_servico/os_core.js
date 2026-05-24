// ==================== js/os_core.js ====================
// Módulo Principal: Variáveis globais, carregamento de dados e navegação

var ordensServico = [];
var frotasManutencao = [];
var tvInterval = null;
var osSelecionadaParaConclusao = null; 
var osSelecionadaParaServicoExtra = null; 
window.dmDataAtualExport = [];

// Variáveis Globais de Almoxarifado para O.S.
var pecasAlmoxarifadoCache = [];

async function carregarDadosOS() {
    try {
        let queryOS = supabaseClient.from('ordens_servico').select('*').order('created_at', { ascending: false });
        if (typeof window.aplicarFiltroFilial === 'function') queryOS = window.aplicarFiltroFilial(queryOS);
        const { data: osData, error: osError } = await queryOS;
        
        if (!osError && osData) ordensServico = osData;

        let queryFrota = supabaseClient.from('frotas_manutencao').select('*').order('cavalo', { ascending: true });
        if (typeof window.aplicarFiltroFilial === 'function') queryFrota = window.aplicarFiltroFilial(queryFrota);
        const { data: frotaData, error: frotaError } = await queryFrota;
            
        if (!frotaError && frotaData) frotasManutencao = frotaData;

        // Pré-carrega peças para facilitar vínculo na O.S.
        let queryPecas = supabaseClient.from('almoxarifado_pecas').select('*');
        if (typeof window.aplicarFiltroFilial === 'function') queryPecas = window.aplicarFiltroFilial(queryPecas);
        const { data: pecasData } = await queryPecas;
        if (pecasData) pecasAlmoxarifadoCache = pecasData;

    } catch (error) {
        console.error("Erro ao carregar dados do Supabase:", error);
    }
}

async function alternarTelaOS(tela) {
    const telaLista = document.getElementById('telaListaOS');
    const telaListaSinistro = document.getElementById('telaListaSinistro');
    const telaHistorico = document.getElementById('telaHistoricoOS');
    const telaNova = document.getElementById('telaNovaOS');
    const telaFrota = document.getElementById('telaFrotaOS');
    const telaDisponibilidade = document.getElementById('telaDisponibilidadeOS');
    
    if(telaLista) telaLista.style.display = 'none';
    if(telaListaSinistro) telaListaSinistro.style.display = 'none';
    if(telaHistorico) telaHistorico.style.display = 'none';
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
    } else if (tela === 'historico') {
        telaHistorico.style.display = 'block';
        if (typeof carregarFiltrosSelectHistoricoOS === 'function') carregarFiltrosSelectHistoricoOS();
        if (typeof renderizarTabelaHistoricoOS === 'function') renderizarTabelaHistoricoOS();
    } else if (tela === 'nova') {
        telaNova.style.display = 'block';
        if (typeof carregarMotoristasSelectOS === 'function') carregarMotoristasSelectOS();
        if (typeof carregarSelectCavalosOS === 'function') carregarSelectCavalosOS();
        
        document.getElementById('osModoEntrada').value = 'imediata';
        if (typeof mudarModoEntrada === 'function') mudarModoEntrada();
        if (typeof togglePneuFields === 'function') togglePneuFields(); 
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

function formatarDataHoraBrasil(dataString) {
    if (!dataString) return '-';
    const partes = dataString.split('T');
    const data = partes[0].split('-').reverse().join('/');
    return partes[1] ? `${data} ${partes[1].substring(0, 5)}` : data;
}