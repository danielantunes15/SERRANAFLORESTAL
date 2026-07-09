// =========================================================================
// Módulo: Controladoria -> Ocorrências
// Ficheiro: modules/controladoria/ocorrencias/ocorrencias.js
// =========================================================================

window.listaFrotasOcorrencia = [];

window.initOcorrencias = async function() {
    console.log("Módulo de Ocorrências Inicializado com sucesso.");
    await window.carregarFrotasOcorrencia();
    await window.carregarOSAbertasOcorrencia();
};

window.carregarFrotasOcorrencia = async function() {
    try {
        const selPlaca = document.getElementById('placa');
        const selCategoria = document.getElementById('categoria_frota');
        if (!selPlaca) return;

        const categoriaSelecionada = selCategoria ? selCategoria.value : 'TRITREM';

        // Busca na tabela de frotas_manutencao filtrando pela categoria
        let query = supabaseClient.from('frotas_manutencao')
            .select('cavalo, numero_frota, modelo, categoria')
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
        inputFrota.value = '';
        inputModelo.value = '';
        return;
    }

    // Procura na lista a placa que bate com o cavalo selecionado
    const veiculo = window.listaFrotasOcorrencia.find(f => f.cavalo === placaSelecionada);
    if (veiculo) {
        inputFrota.value = veiculo.numero_frota || '';
        inputModelo.value = veiculo.modelo || '';
    } else {
        inputFrota.value = '';
        inputModelo.value = '';
    }
};

window.carregarOSAbertasOcorrencia = async function() {
    try {
        const selOS = document.getElementById('numero_os');
        if (!selOS) return;

        // Tabela ordens_servico, corrigido o campo para 'problema'
        const { data, error } = await supabaseClient.from('ordens_servico')
            .select('id, numero_os, placa, problema, status')
            .in('status', ['Aguardando Oficina', 'Agendada', 'Em Manutenção', 'Aguardando Peças', 'Sinistrado'])
            .order('id', { ascending: false });
            
        if (error) throw error;
        
        selOS.innerHTML = '<option value="">Sem vínculo (Opcional)</option>';
        (data || []).forEach(os => {
            const numExibicao = os.numero_os || os.id;
            const osIdFormatado = String(numExibicao).padStart(5, '0');
            const osPlaca = os.placa ? `(Placa: ${os.placa})` : '';
            selOS.innerHTML += `<option value="${numExibicao}">OS #${osIdFormatado} - ${os.status} ${osPlaca}</option>`;
        });
    } catch (error) {
        console.error("Erro ao carregar OS abertas para ocorrências:", error);
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
        
        // O .select() garante que o banco devolva a linha que acabou de criar, incluindo o ID
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
        
        // Recarrega as frotas baseado no combo que resetou (volta pro padrão TRITREM)
        window.carregarFrotasOcorrencia(); 
    }
};