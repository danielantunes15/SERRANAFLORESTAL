// =========================================================================
// Módulo: Controladoria -> Ocorrências
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
        
        // O .select() garante que o banco devolva a linha que acabou de criar, incluindo o ID (Protocolo)
        const { data, error } = await supabaseClient.from('ocorrencias').insert([payload]).select();
        if (error) throw error;

        let ocorrenciaSalva = payload;
        if (data && data.length > 0) {
            ocorrenciaSalva = data[0]; // Pega os dados com o ID gerado
        }

        // Pergunta se o utilizador deseja imprimir a folha da ocorrência usando a função do novo arquivo
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Ocorrência Registada!',
                text: 'A ocorrência foi salva. Deseja imprimir o formulário agora?',
                icon: 'success',
                showCancelButton: true,
                confirmButtonColor: '#10b981',
                cancelButtonColor: '#64748b',
                confirmButtonText: '<i class="fas fa-print"></i> Sim, imprimir',
                cancelButtonText: 'Não, fechar'
            }).then((result) => {
                if (result.isConfirmed) {
                    if (typeof window.imprimirFolhaOcorrencia === 'function') {
                        window.imprimirFolhaOcorrencia(ocorrenciaSalva);
                    }
                }
                window.limparFormOcorrencia();
            });
        } else {
            if (confirm("Ocorrência salva com sucesso! Deseja imprimir o formulário agora?")) {
                if (typeof window.imprimirFolhaOcorrencia === 'function') {
                    window.imprimirFolhaOcorrencia(ocorrenciaSalva);
                }
            }
            window.limparFormOcorrencia();
        }

    } catch (error) {
        console.error("Erro ao guardar a ocorrência:", error);
        if (typeof Swal !== 'undefined') {
            Swal.fire('Erro', 'Ocorreu um erro ao guardar a ocorrência.', 'error');
        } else {
            alert("Erro ao guardar a ocorrência. Verifique a consola (F12) para mais detalhes.");
        }
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