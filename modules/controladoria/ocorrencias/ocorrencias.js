// =========================================================================
// Módulo: Controladoria -> Ocorrências
// Ficheiro: modules/controladoria/ocorrencias/ocorrencias.js
// =========================================================================

window.initOcorrencias = function() {
    console.log("Módulo de Ocorrências Inicializado com sucesso.");
    
    // Se futuramente quiser carregar uma tabela com as ocorrências já registadas,
    // a função para buscar os dados no banco de dados seria chamada aqui.
    // ex: carregarListaOcorrencias();
};

window.salvarOcorrencia = async function(event) {
    // Evita o recarregamento da página ao submeter o formulário
    event.preventDefault();

    // 1. Recolha de todos os dados dos campos do formulário
    const dadosOcorrencia = {
        numero_frota: document.getElementById('numero_frota').value,
        placa: document.getElementById('placa').value,
        modelo: document.getElementById('modelo').value,
        empresa: document.getElementById('empresa').value,
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
        console.log("A preparar o envio dos seguintes dados para o Banco de Dados:", dadosOcorrencia);

        // ====================================================================
        // AQUI ENTRA A SUA LÓGICA DE SALVAR NO BANCO DE DADOS (SUPABASE, ETC)
        // Exemplo genérico se estiver a usar fetch para uma API/PHP:
        //
        // const response = await fetch('/api/salvar_ocorrencia.php', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(dadosOcorrencia)
        // });
        // if (!response.ok) throw new Error('Falha ao comunicar com o servidor.');
        // ====================================================================

        // Alerta visual de sucesso (Usa SweetAlert se estiver no projeto, senão usa alert normal)
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Ocorrência Registada!',
                text: 'O registo da ocorrência foi guardado com sucesso.',
                confirmButtonColor: '#28a745'
            });
        } else {
            alert("Ocorrência registada com sucesso!");
        }

        // Limpar os campos do formulário após submeter
        limparFormOcorrencia();

    } catch (error) {
        console.error("Erro ao guardar a ocorrência:", error);
        
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Ocorreu um erro ao guardar a ocorrência. Tente novamente.',
                confirmButtonColor: '#dc3545'
            });
        } else {
            alert("Erro ao guardar a ocorrência. Verifique a consola (F12) para mais detalhes.");
        }
    }
};

window.limparFormOcorrencia = function() {
    const form = document.getElementById('formOcorrencia');
    if (form) {
        form.reset(); // Limpa todos os campos
        
        // Como o campo 'Empresa' é fixo, voltamos a colocar o valor por defeito após o reset
        const campoEmpresa = document.getElementById('empresa');
        if (campoEmpresa) {
            campoEmpresa.value = "SERRANALOG FLORESTAL";
        }
    }
};