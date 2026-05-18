// ==================== MÓDULO: NAVEGAÇÃO E INICIALIZAÇÃO DO DASHBOARD ====================

window.atualizarStats = function() {
    const statConjuntos = document.getElementById('statConjuntos');
    const statCaminhoes = document.getElementById('statCaminhoes');
    const statMotoristas = document.getElementById('statMotoristas');
    const statDisponiveis = document.getElementById('statDisponiveis');
    const statCavalos = document.getElementById('statCavalos'); // Novo ID adicionado no HTML
    
    // Calcula o total de caminhões de todos os conjuntos
    const totalCaminhoes = conjuntos.reduce((acc, c) => acc + (c.caminhoes?.length || 0), 0);

    if (statConjuntos) statConjuntos.innerText = conjuntos.length;
    if (statCaminhoes) statCaminhoes.innerText = totalCaminhoes;
    if (statCavalos) statCavalos.innerText = totalCaminhoes; // Define a quantidade de cavalos no painel superior
    if (statMotoristas) statMotoristas.innerText = motoristas.length;
    
    if (statDisponiveis) {
        const qtdeDisponiveis = motoristas.filter(m => !m.conjuntoId).length;
        statDisponiveis.innerText = qtdeDisponiveis;
    }
}

window.initDashboard = async function() {
    // 1. CARREGA OS DADOS DO BANCO PRIMEIRO
    await carregarDadosIniciais();
    
    if(typeof carregarDadosTreinamento === 'function') {
        await carregarDadosTreinamento(); 
    }
    
    atualizarStats();

    // 2. RENDERIZA O MENU E INICIA A TELA PADRÃO
    if (typeof window.renderizarMenu === 'function') {
        window.renderizarMenu();
    }
}

/**
 * Exporta o painel completo (Gráfico + Título) para uma imagem PNG de alta qualidade.
 * Utiliza a biblioteca html2canvas que já está no index.html.
 * @param {string} idElemento - O ID do elemento HTML que contém o gráfico.
 * @param {string} nomeArquivo - O nome base para o arquivo de download.
 */
window.exportarGraficoPNG = async function(idElemento, nomeArquivo) {
    const chartDiv = document.getElementById(idElemento);
    if (!chartDiv) {
        console.error("Elemento do gráfico não encontrado:", idElemento);
        return;
    }

    // Busca o container pai (.content-panel) que engloba o título (h3) e o gráfico
    const container = chartDiv.closest('.content-panel');

    if (!container) {
        alert("Container do painel não encontrado.");
        return;
    }

    // Esconde temporariamente os botões dentro do painel para que não apareçam na foto exportada
    const botoes = container.querySelectorAll('button');
    botoes.forEach(btn => btn.style.display = 'none');

    try {
        // Usa o html2canvas para "tirar uma foto" da div inteira (Título + Gráfico)
        const canvas = await html2canvas(container, {
            scale: 2, // Alta resolução para garantir nitidez
            backgroundColor: '#0f172a', // Cor de fundo do painel para combinar com o modo dark
            useCORS: true // Permite renderizar elementos corretamente
        });

        // Gera a URL da imagem PNG
        const url = canvas.toDataURL('image/png');
        const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
        
        // Cria um link temporário para forçar o download
        const link = document.createElement('a');
        link.href = url;
        link.download = `${nomeArquivo}_${dataAtual}.png`;
        
        // Simula o clique para baixar
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (e) {
        console.error("Erro ao exportar imagem completa:", e);
        alert("Não foi possível gerar a imagem. Tente atualizar a página.");
    } finally {
        // Restaura a exibição do botão "Exportar" após a captura da imagem
        botoes.forEach(btn => btn.style.display = '');
    }
};