// ==========================================
// js/configuracoes/main.js
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Carrega os dados iniciais do banco
    carregarMetasGlobais();
    carregarGruas(); 
    carregarHistoricoImportacoes(); 

    // 2. Inicializa os botões e áreas de arrastar planilhas
    initMetas();
    initBancoHistorico();
    initImportacao();
});