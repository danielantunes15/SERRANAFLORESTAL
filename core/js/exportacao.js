// ==================== MÓDULO: EXPORTAÇÃO GLOBAL (GRÁFICOS E PAINÉIS) ====================

window.exportarGraficoPNG = function(containerId, fileName) {
    const targetElement = document.getElementById(containerId);
    if (!targetElement) {
        alert("Erro: Elemento não encontrado na tela.");
        return;
    }

    // Procura o painel completo (a div pai que engloba os KPIs + Gráfico)
    // Se não encontrar o content-panel, ele exporta o próprio gráfico como fallback.
    const panelToExport = targetElement.closest('.content-panel') || targetElement;

    if (typeof html2canvas !== 'undefined') {
        // Esconde temporariamente apenas os botões para a imagem ficar mais limpa
        const botoes = panelToExport.querySelectorAll('button');
        const displaysOriginais = [];
        botoes.forEach((btn, index) => {
            displaysOriginais[index] = btn.style.display;
            btn.style.display = 'none';
        });

        // Tira a "foto" da div completa
        html2canvas(panelToExport, {
            backgroundColor: '#0f172a', // Mantém o fundo escuro bonito
            scale: 2, // Aumenta a qualidade/resolução
            logging: false,
            useCORS: true
        }).then(canvas => {
            // Restaura os botões
            botoes.forEach((btn, index) => {
                btn.style.display = displaysOriginais[index];
            });

            // Faz o download
            const a = document.createElement('a');
            a.href = canvas.toDataURL("image/png");
            a.download = (fileName || 'painel_indicadores') + '.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }).catch(err => {
            // Restaura os botões em caso de erro
            botoes.forEach((btn, index) => {
                btn.style.display = displaysOriginais[index];
            });
            console.error("Erro ao exportar o painel:", err);
            alert("Ocorreu um erro ao gerar a imagem do painel de indicadores.");
        });
    } else {
        alert("Erro: Biblioteca html2canvas não foi carregada. Tente recarregar a página.");
    }
};