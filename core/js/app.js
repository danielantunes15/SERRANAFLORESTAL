// ==================== MÓDULO: NAVEGAÇÃO E INICIALIZAÇÃO DO DASHBOARD ====================

window.atualizarStats = function() {
    const statConjuntos = document.getElementById('statConjuntos');
    const statCaminhoes = document.getElementById('statCaminhoes');
    const statMotoristas = document.getElementById('statMotoristas');
    const statDisponiveis = document.getElementById('statDisponiveis');
    const statCavalos = document.getElementById('statCavalos');
    
    const totalCaminhoes = conjuntos.reduce((acc, c) => acc + (c.caminhoes?.length || 0), 0);

    if (statConjuntos) statConjuntos.innerText = conjuntos.length;
    if (statCaminhoes) statCaminhoes.innerText = totalCaminhoes;
    if (statCavalos) statCavalos.innerText = totalCaminhoes; 
    if (statMotoristas) statMotoristas.innerText = motoristas.length;
    
    if (statDisponiveis) {
        const qtdeDisponiveis = motoristas.filter(m => !m.conjuntoId).length;
        statDisponiveis.innerText = qtdeDisponiveis;
    }
}

window.initDashboard = async function() {
    const containerApp = document.getElementById('conteudo-principal');
    
    // Mostra um Loading Visual Bonito enquanto baixa os dados do banco
    if (containerApp) {
        containerApp.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 50vh;">
                <i class="fas fa-circle-notch fa-spin fa-3x" style="color: #10b981; margin-bottom: 20px;"></i>
                <h2 style="color: #fff; font-weight: 500; font-family: 'Inter', sans-serif;">Sincronizando Sistema</h2>
                <p style="color: #94a3b8; font-size: 0.95rem; margin-top: 5px;">Baixando dados da filial selecionada...</p>
            </div>
        `;
    }
    
    // 1. CARREGA OS DADOS DO BANCO PRIMEIRO
    await carregarDadosIniciais();
    
    if(typeof carregarDadosTreinamento === 'function') {
        await carregarDadosTreinamento(); 
    }
    
    atualizarStats();

    // 2. RENDERIZA O MENU E ABRE A TELA PADRÃO
    if (typeof window.renderizarMenu === 'function') {
        window.renderizarMenu();
    }
}

/**
 * Exporta o painel completo (Gráfico + Título) para uma imagem PNG de alta qualidade.
 */
window.exportarGraficoPNG = async function(idElemento, nomeArquivo) {
    const chartDiv = document.getElementById(idElemento);
    if (!chartDiv) {
        console.error("Elemento do gráfico não encontrado:", idElemento);
        return;
    }

    const container = chartDiv.closest('.content-panel');
    if (!container) {
        alert("Container do painel não encontrado.");
        return;
    }

    const botoes = container.querySelectorAll('button');
    botoes.forEach(btn => btn.style.display = 'none');

    try {
        const canvas = await html2canvas(container, {
            scale: 2, 
            backgroundColor: '#0f172a',
            useCORS: true 
        });

        const url = canvas.toDataURL('image/png');
        const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${nomeArquivo}_${dataAtual}.png`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (e) {
        console.error("Erro ao exportar imagem completa:", e);
        alert("Não foi possível gerar a imagem. Tente atualizar a página.");
    } finally {
        botoes.forEach(btn => btn.style.display = '');
    }
};