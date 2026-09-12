// ==========================================
// js/configuracoes/main.js
// ==========================================

window.inicializarConfiguracoesGerencial = function() {
    // 1. Carrega os dados iniciais do banco
    if (typeof carregarMetasGlobais === 'function') carregarMetasGlobais();
    if (typeof carregarGruas === 'function') carregarGruas(); 
    if (typeof window.carregarHistoricoImportacoes === 'function') window.carregarHistoricoImportacoes(); 

    // 2. Inicializa os botões e áreas de arrastar planilhas
    if (typeof initMetas === 'function') initMetas();
    if (typeof window.initBancoHistorico === 'function') window.initBancoHistorico();
    if (typeof initImportacao === 'function') initImportacao();

    // 3. Aplica o filtro de visualização de importação por filial
    setTimeout(() => {
        const user = window.currentUser || {};
        const role = user.role || '';
        const filialId = user.filial_id ? parseInt(user.filial_id) : null;
        
        const secaoSuzano = document.getElementById('secao-importacao-suzano');
        const secaoBracell = document.getElementById('secao-importacao-bracell');
        const secaoVeracel = document.getElementById('secao-importacao-veracel');
        
        // Libera tudo para Admin e SuperAdmin
        if (role === 'SuperAdmin' || role === 'Admin') {
            if(secaoSuzano) secaoSuzano.classList.remove('hidden');
            if(secaoBracell) secaoBracell.classList.remove('hidden');
            if(secaoVeracel) secaoVeracel.classList.remove('hidden');
        } else {
            // Filtro por Filial ID (1, 5, 6, 7)
            if (filialId === 1 || filialId === 7) {
                if(secaoSuzano) secaoSuzano.classList.remove('hidden');
            } else if (filialId === 5) {
                if(secaoBracell) secaoBracell.classList.remove('hidden');
            } else if (filialId === 6) {
                if(secaoVeracel) secaoVeracel.classList.remove('hidden');
            }
        }
    }, 150);
};