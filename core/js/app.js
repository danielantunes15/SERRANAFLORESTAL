// ==================== MÓDULO: NAVEGAÇÃO E INICIALIZAÇÃO DO DASHBOARD ====================

window.atualizarStats = function() {
    try {
        const statConjuntos = document.getElementById('statConjuntos');
        const statCaminhoes = document.getElementById('statCaminhoes');
        const statMotoristas = document.getElementById('statMotoristas');
        const statDisponiveis = document.getElementById('statDisponiveis');
        const statCavalos = document.getElementById('statCavalos');
        
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
        console.error("Erro ao atualizar stats:", e); 
    }
}

window.initDashboard = async function() {
    const containerApp = document.getElementById('conteudo-principal');
    if (containerApp) {
        containerApp.innerHTML = `
            <div id="loadingSincronizacao" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 50vh; text-align: center; padding: 20px;">
                <i class="fas fa-circle-notch fa-spin fa-3x" style="color: #3b82f6; margin-bottom: 20px;"></i>
                <h3 style="color: #f8fafc;">Sincronizando Banco de Dados...</h3>
                <p style="color: #94a3b8;">Aguarde um momento.</p>
            </div>
        `;
    }

    try {
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 5000));
        const chamadasBanco = async () => {
            if (typeof carregarDadosIniciais === 'function') await carregarDadosIniciais();
            return 'OK';
        };
        await Promise.race([chamadasBanco(), timeoutPromise]);
    } catch (e) {}

    try {
        if (typeof window.renderizarMenu === 'function') {
            await window.renderizarMenu();
        }
    } catch (e) {}
    
    atualizarStats();

    // =========================================================================
    // FORÇAR A REMOÇÃO DO ÍCONE/BOTÃO DO CHAT DA TELA
    // =========================================================================
    try {
        // Procura o botão pelo evento de clique que abria o painel antigo e deleta ele do HTML
        const btnChamados = document.querySelector('[onclick*="abrirPainelMeusChamados"]');
        if (btnChamados) {
            btnChamados.remove(); 
        }
        
        // Remove qualquer vestígio de container de chat da tela
        const containerModaisChamados = document.getElementById('containerModaisChamados');
        if (containerModaisChamados) {
            containerModaisChamados.remove();
        }
        
        const toastContainer = document.getElementById('toast-container-chamados');
        if (toastContainer) {
            toastContainer.remove();
        }
    } catch (e) {}
}