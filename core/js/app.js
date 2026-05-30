// ==================== MÓDULO: NAVEGAÇÃO E INICIALIZAÇÃO DO DASHBOARD ====================

window.atualizarStats = function() {
    try {
        const statConjuntos = document.getElementById('statConjuntos');
        const statCaminhoes = document.getElementById('statCaminhoes');
        const statMotoristas = document.getElementById('statMotoristas');
        const statDisponiveis = document.getElementById('statDisponiveis');
        const statCavalos = document.getElementById('statCavalos');
        
        // Proteção caso os dados ainda não existam
        const listaConjuntos = typeof conjuntos !== 'undefined' ? conjuntos : [];
        const listaMotoristas = typeof motoristas !== 'undefined' ? motoristas : [];

        const totalCaminhoes = listaConjuntos.reduce((acc, c) => acc + (c.caminhoes?.length || 0), 0);

        if (statConjuntos) statConjuntos.innerText = listaConjuntos.length;
        if (statCaminhoes) statCaminhoes.innerText = totalCaminhoes;
        if (statCavalos) statCavalos.innerText = totalCaminhoes; 
        if (statMotoristas) statMotoristas.innerText = listaMotoristas.length;
        
        if (statDisponiveis) {
            const qtdeDisponiveis = listaMotoristas.filter(m => !m.conjuntoId).length;
            statDisponiveis.innerText = qtdeDisponiveis;
        }
    } catch (e) {
        console.error("Aviso: Erro rápido ao atualizar contadores (ignorado).", e);
    }
}

window.initDashboard = async function() {
    const containerApp = document.getElementById('conteudo-principal');
    
    // 1. RENDERIZA O MENU IMEDIATAMENTE PARA NÃO BLOQUEAR A TELA
    try {
        if (typeof window.renderizarMenu === 'function') {
            await window.renderizarMenu();
            
            // Verifica se destravou a tela ou se o usuário não tem menus
            setTimeout(() => {
                const loadingAindaNaTela = document.getElementById('loadingSincronizacao');
                if (loadingAindaNaTela && containerApp) {
                    console.warn("Travamento evitado: Nenhum menu foi clicado automaticamente.");
                    
                    containerApp.innerHTML = `
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 50vh; text-align: center; padding: 20px;">
                            <i class="fas fa-lock fa-4x" style="color: #64748b; margin-bottom: 20px;"></i>
                            <h2 style="color: #f8fafc; margin-bottom: 10px;">Sistema Iniciado</h2>
                            <p style="color: #94a3b8; font-size: 1.1rem; max-width: 600px; line-height: 1.5;">
                                Se você está vendo esta tela, é porque o seu perfil de usuário <strong>ainda não possui menus liberados</strong>.<br><br>
                                Solicite ao Administrador do sistema que acesse <br><span style="color: var(--ccol-blue-bright);">Configurações > Permissões de Acesso</span><br> e marque as caixinhas de liberação para a sua função.
                            </p>
                        </div>
                    `;
                }
            }, 1000);
        } else {
            console.error("Função renderizarMenu não encontrada.");
        }
    } catch (errMenu) {
        console.error("Erro ao desenhar os menus:", errMenu);
        if (containerApp) containerApp.innerHTML = `<h3 style="color:red; text-align:center; margin-top: 50px;">Erro de interface. Recarregue a página.</h3>`;
    }

    // 2. BUSCA OS DADOS EM PARALELO (EM SEGUNDO PLANO)
    try {
        // SISTEMA ANTI-TRAVAMENTO (Timeout máximo de 5 segundos para consultas)
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 5000));
        
        const chamadasBanco = async () => {
            if (typeof carregarDadosIniciais === 'function') await carregarDadosIniciais();
            if (typeof carregarDadosTreinamento === 'function') await carregarDadosTreinamento();
            return 'OK';
        };

        const resultado = await Promise.race([chamadasBanco(), timeoutPromise]);
        
        if (resultado === 'TIMEOUT') {
            console.warn("Aviso: Lentidão na rede. Iniciando a interface em modo de segurança...");
        }
    } catch (erroCritico) {
        console.error("Erro na busca de dados (Ignorado para liberar a tela):", erroCritico);
    }
    
    atualizarStats();
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