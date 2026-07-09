// =========================================================================
// Módulo: Controladoria -> Ocorrências (Inclusão)
// Ficheiro: modules/controladoria/ocorrencias/ocorrencias.js
// =========================================================================

window.initOcorrencias = function() {
    console.log("Módulo de Ocorrências Inicializado com sucesso.");
};

window.salvarOcorrencia = async function(event) {
    event.preventDefault();

    const dadosOcorrencia = {
        numero_frota: document.getElementById('numero_frota').value,
        placa: document.getElementById('placa').value,
        modelo: document.getElementById('modelo').value,
        empresa: document.getElementById('empresa').value,
        numero_os: document.getElementById('numero_os').value,
        data_ocorrido: document.getElementById('data_ocorrido').value,
        hora_ocorrido: document.getElementById('hora_ocorrido').value,
        local_projeto: document.getElementById('local_projeto').value,
        nome_envolvido: document.getElementById('nome_envolvido').value,
        funcao: document.getElementById('funcao').value,
        tempo_empresa: document.getElementById('tempo_empresa').value,
        escala: document.getElementById('escala').value,
        descricao_fatos: document.getElementById('descricao_fatos').value,
        prevencao_falha: document.getElementById('prevencao_falha').value,
        parecer_gestor: document.getElementById('parecer_gestor').value,
        gestor_imediato: document.getElementById('gestor_imediato').value,
        gerente: document.getElementById('gerente').value
    };

    try {
        const payload = window.injetarFilial ? window.injetarFilial(dadosOcorrencia) : dadosOcorrencia;
        
        const { error } = await supabaseClient.from('ocorrencias').insert([payload]);
        if (error) throw error;

        alert("Ocorrência salva com sucesso no banco de dados!");
        window.limparFormOcorrencia();

    } catch (error) {
        console.error("Erro ao guardar a ocorrência:", error);
        alert("Erro ao guardar a ocorrência. Verifique a consola (F12) para mais detalhes.");
    }
};

window.limparFormOcorrencia = function() {
    const form = document.getElementById('formOcorrencia');
    if (form) {
        form.reset();
        const campoEmpresa = document.getElementById('empresa');
        if (campoEmpresa) {
            campoEmpresa.value = "SERRANALOG FLORESTAL";
        }
    }
};