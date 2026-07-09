// =========================================================================
// Módulo: Controladoria -> Ocorrências
// Ficheiro: modules/controladoria/ocorrencias/ocorrencias.js
// =========================================================================

window.listaFrotasOcorrencia = [];

window.initOcorrencias = async function() {
    console.log("Módulo de Ocorrências Inicializado com sucesso.");
    await window.carregarFrotasOcorrencia();
};

window.carregarFrotasOcorrencia = async function() {
    try {
        const selPlaca = document.getElementById('placa');
        const selCategoria = document.getElementById('categoria_frota');
        if (!selPlaca) return;

        const categoriaSelecionada = selCategoria ? selCategoria.value : 'TRITREM';

        // Atualizado para buscar a coluna 'descricao' em vez de 'modelo'
        let query = supabaseClient.from('frotas_manutencao')
            .select('cavalo, numero_frota, descricao, categoria')
            .eq('categoria', categoriaSelecionada)
            .order('cavalo');
            
        if (typeof window.aplicarFiltroFilial === 'function') {
            query = window.aplicarFiltroFilial(query);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        window.listaFrotasOcorrencia = data || [];
        
        selPlaca.innerHTML = '<option value="">Selecione a Placa...</option>';
        window.listaFrotasOcorrencia.forEach(f => {
            if (f.cavalo && f.cavalo.trim() !== '') {
                selPlaca.innerHTML += `<option value="${f.cavalo}">${f.cavalo}</option>`;
            }
        });
        
        // Limpa os campos atrelados caso tenha trocado a categoria
        window.preencherDadosVeiculo('');
        
    } catch (error) {
        console.error("Erro ao carregar frotas para ocorrências:", error);
    }
};

window.preencherDadosVeiculo = function(placaSelecionada) {
    const inputFrota = document.getElementById('numero_frota');
    const inputModelo = document.getElementById('modelo');
    
    if (!placaSelecionada) {
        if(inputFrota) inputFrota.value = '';
        if(inputModelo) inputModelo.value = '';
        return;
    }

    const veiculo = window.listaFrotasOcorrencia.find(f => f.cavalo === placaSelecionada);
    if (veiculo) {
        if(inputFrota) inputFrota.value = veiculo.numero_frota || '';
        // Preenche o campo modelo (na tela) com a 'descricao' vinda do banco
        if(inputModelo) inputModelo.value = veiculo.descricao || ''; 
    } else {
        if(inputFrota) inputFrota.value = '';
        if(inputModelo) inputModelo.value = '';
    }
};

// --- NOVA FUNÇÃO PARA BUSCAR A DATA DA O.S AUTOMATICAMENTE ---
window.buscarDataOS = async function(numeroOsDigitado, idCampoDestino) {
    const campoDestino = document.getElementById(idCampoDestino);
    if (!campoDestino) return;

    if (!numeroOsDigitado || numeroOsDigitado.trim() === '') {
        campoDestino.value = '';
        return;
    }

    try {
        // Tenta buscar no banco ordens_servico onde numero_os bate com o que foi digitado
        const { data, error } = await supabaseClient.from('ordens_servico')
            .select('data_abertura, numero_os')
            .or(`numero_os.eq.${numeroOsDigitado},id.eq.${numeroOsDigitado}`)
            .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
            let dataCompleta = data[0].data_abertura;
            if (dataCompleta) {
                // Separa a data da hora se houver (formato ISO 'YYYY-MM-DDTHH:MM')
                campoDestino.value = dataCompleta.split('T')[0];
            } else {
                campoDestino.value = '';
            }
        } else {
            // Se a OS não existir no banco
            campoDestino.value = '';
        }
    } catch (err) {
        console.error("Erro ao tentar buscar a data da OS:", err);
        campoDestino.value = '';
    }
};

window.salvarOcorrencia = async function(event) {
    event.preventDefault();

    const dadosOcorrencia = {
        numero_frota: document.getElementById('numero_frota').value,
        placa: document.getElementById('placa').value,
        modelo: document.getElementById('modelo').value,
        empresa: document.getElementById('empresa').value,
        numero_os: document.getElementById('numero_os').value,
        data_abertura_os: document.getElementById('data_abertura_os').value || null,
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
        
        const { data, error } = await supabaseClient.from('ocorrencias').insert([payload]).select();
        if (error) throw error;

        let ocorrenciaSalva = payload;
        if (data && data.length > 0) {
            ocorrenciaSalva = data[0]; 
        }

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
        
        window.carregarFrotasOcorrencia(); 
    }
};