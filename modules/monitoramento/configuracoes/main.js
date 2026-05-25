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
};