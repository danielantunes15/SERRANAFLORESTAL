window.configRhAtual = null;

window.initRHConfiguracoes = async function() {
    try {
        const inputSindicato = document.getElementById('cfgRhPercSindicato');
        inputSindicato.value = '';
        
        const { data } = await db.getRHConfiguracoes();
        
        if (data && data.length > 0) {
            window.configRhAtual = data[0];
            inputSindicato.value = window.configRhAtual.perc_sindicato || '';
        } else {
            window.configRhAtual = null;
        }
    } catch (error) {
        console.error("Erro ao carregar configurações do RH:", error);
        alert("Erro ao buscar as métricas do banco de dados.");
    }
};

window.salvarRHConfiguracoes = async function() {
    const perc = parseFloat(document.getElementById('cfgRhPercSindicato').value);
    
    if (isNaN(perc) || perc < 0) {
        alert("Por favor, insira um valor percentual válido para o sindicato.");
        return;
    }

    const dados = {
        perc_sindicato: perc
    };
    
    try {
        if (window.configRhAtual && window.configRhAtual.id) {
            dados.id = window.configRhAtual.id; // Se já existia, atualiza
        }

        await db.upsertRHConfiguracoes(dados);
        
        if (typeof window.registrarLogAuditoria === 'function') {
            window.registrarLogAuditoria('RH', 'Configuração', `Métricas do RH atualizadas. Sindicato: ${perc}%`, 'Info');
        }
        
        alert("Configurações do RH salvas com sucesso!");
        await window.initRHConfiguracoes(); // Recarrega os dados na tela
    } catch (error) {
        console.error("Erro ao salvar config RH:", error);
        alert("Erro ao salvar as configurações. Verifique a conexão.");
    }
};