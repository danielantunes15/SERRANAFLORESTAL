// =========================================================================
// Módulo: Controladoria -> Ocorrências
// Ficheiro: modules/controladoria/ocorrencias/ocorrencias.js
// =========================================================================

window.listaFrotasOcorrencia = [];
window.todasFrotasCache = [];
window.listaColaboradoresRH = [];
window.outrosEnvolvidosCount = 0;

window.initOcorrencias = async function() {
    console.log("Módulo de Ocorrências Inicializado com sucesso.");
    await window.carregarColaboradoresRH();
    await window.carregarTodasFrotas();
    window.carregarFrotasOcorrencia();
};

window.carregarColaboradoresRH = async function() {
    try {
        if (window.db && window.db.getColaboradores) {
            window.listaColaboradoresRH = await window.db.getColaboradores();
        } else {
            const { data, error } = await supabaseClient.from('rh_colaboradores').select('*').order('nome');
            if(error) throw error;
            window.listaColaboradoresRH = data || [];
        }
        
        const select = document.getElementById('nome_envolvido_select');
        if (select) {
            select.innerHTML = '<option value="">Selecione o Responsável Principal...</option>';
            window.listaColaboradoresRH.forEach(c => {
                select.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
            });
        }
    } catch (error) {
        console.error("Erro ao carregar colaboradores RH:", error);
    }
};

window.preencherDadosColaborador = function(idColaborador, idCampoFuncao, idCampoNomeHidden) {
    const campoFuncao = document.getElementById(idCampoFuncao);
    const campoNome = document.getElementById(idCampoNomeHidden);
    
    if(!idColaborador) {
        if(campoFuncao) campoFuncao.value = '';
        if(campoNome) campoNome.value = '';
        return;
    }

    const colab = window.listaColaboradoresRH.find(c => c.id == idColaborador);
    if(colab) {
        if(campoFuncao) campoFuncao.value = colab.cargo || colab.funcao || 'Colaborador'; 
        if(campoNome) campoNome.value = colab.nome;
    }
};

window.carregarTodasFrotas = async function() {
    try {
        let query = supabaseClient.from('frotas_manutencao')
            .select('cavalo, numero_frota, descricao, categoria')
            .order('cavalo');
            
        if (typeof window.aplicarFiltroFilial === 'function') {
            query = window.aplicarFiltroFilial(query);
        }
        
        const { data, error } = await query;
        if(error) throw error;
        window.todasFrotasCache = data || [];
    } catch (error) {
        console.error("Erro ao carregar todas as frotas:", error);
    }
};

window.carregarFrotasOcorrencia = function() {
    const selPlaca = document.getElementById('placa');
    const selCategoria = document.getElementById('categoria_frota');
    if (!selPlaca) return;

    const categoriaSelecionada = selCategoria ? selCategoria.value : 'TRITREM';
    window.listaFrotasOcorrencia = window.todasFrotasCache.filter(f => f.categoria === categoriaSelecionada);
    
    selPlaca.innerHTML = '<option value="">Selecione a Placa...</option>';
    window.listaFrotasOcorrencia.forEach(f => {
        if (f.cavalo && f.cavalo.trim() !== '') {
            selPlaca.innerHTML += `<option value="${f.cavalo}">${f.cavalo}</option>`;
        }
    });
    
    window.preencherDadosVeiculo('');
};

window.carregarFrotasOutro = function(id) {
    const selCat = document.getElementById(`outro_cat_${id}`);
    const selPlaca = document.getElementById(`outro_placa_${id}`);
    if(!selCat || !selPlaca) return;
    
    const cat = selCat.value;
    if(!cat) {
        selPlaca.innerHTML = '<option value="">Aguardando...</option>';
        return;
    }

    const filtradas = window.todasFrotasCache.filter(f => f.categoria === cat);
    selPlaca.innerHTML = '<option value="">Selecione a Placa...</option>';
    filtradas.forEach(f => {
        if (f.cavalo && f.cavalo.trim() !== '') {
            selPlaca.innerHTML += `<option value="${f.cavalo}">${f.cavalo}</option>`;
        }
    });
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
        if(inputModelo) inputModelo.value = veiculo.descricao || ''; 
    } else {
        if(inputFrota) inputFrota.value = '';
        if(inputModelo) inputModelo.value = '';
    }
};

window.adicionarOutroEnvolvido = function() {
    window.outrosEnvolvidosCount++;
    const id = window.outrosEnvolvidosCount;
    const container = document.getElementById('lista_outros_envolvidos');
    
    const div = document.createElement('div');
    div.id = `envolvido_${id}`;
    div.style.cssText = "display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 15px; padding: 15px; border: 1px dashed var(--border-dim); border-radius: 8px; background: rgba(255,255,255,0.02);";
    
    let colabOptions = '<option value="">Selecione...</option>';
    window.listaColaboradoresRH.forEach(c => {
        colabOptions += `<option value="${c.id}">${c.nome}</option>`;
    });

    div.innerHTML = `
        <div class="form-group-dark">
            <label>Colaborador Envolvido</label>
            <select id="outro_colab_${id}" class="dark-select" onchange="window.preencherDadosColaborador(this.value, 'outro_funcao_${id}', 'outro_nome_${id}')" required>
                ${colabOptions}
            </select>
            <input type="hidden" id="outro_nome_${id}">
        </div>
        <div class="form-group-dark">
            <label>Função</label>
            <input type="text" id="outro_funcao_${id}" class="dark-select" readonly>
        </div>
        <div class="form-group-dark">
            <label>Equipamento (Categoria)</label>
            <select id="outro_cat_${id}" class="dark-select" onchange="window.carregarFrotasOutro(${id})">
                <option value="">Sem Equipamento</option>
                <option value="TRITREM">TRITREM</option>
                <option value="PRANCHA">PRANCHA</option>
                <option value="GRUA">GRUA</option>
                <option value="COMBOIO">COMBOIO</option>
                <option value="CARRETA">CARRETA</option>
                <option value="FROTA LEVE">FROTA LEVE</option>
            </select>
        </div>
        <div class="form-group-dark">
            <label>Equipamento (Placa)</label>
            <select id="outro_placa_${id}" class="dark-select">
                <option value="">Aguardando...</option>
            </select>
        </div>
        <div style="display: flex; align-items: flex-end; justify-content: flex-end;">
            <button type="button" class="btn-secondary-dark" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.1);" onclick="document.getElementById('envolvido_${id}').remove()">
                <i class="fas fa-trash"></i> Remover
            </button>
        </div>
    `;
    container.appendChild(div);
};

window.buscarDataOS = async function(numeroOsDigitado, idCampoDestino) {
    const campoDestino = document.getElementById(idCampoDestino);
    if (!campoDestino) return;

    if (!numeroOsDigitado || numeroOsDigitado.trim() === '') {
        campoDestino.value = '';
        return;
    }

    try {
        const { data, error } = await supabaseClient.from('ordens_servico')
            .select('data_abertura, numero_os')
            .or(`numero_os.eq.${numeroOsDigitado},id.eq.${numeroOsDigitado}`)
            .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
            let dataCompleta = data[0].data_abertura;
            if (dataCompleta) {
                campoDestino.value = dataCompleta.split('T')[0];
            } else {
                campoDestino.value = '';
            }
        } else {
            campoDestino.value = '';
        }
    } catch (err) {
        console.error("Erro ao tentar buscar a data da OS:", err);
        campoDestino.value = '';
    }
};

window.salvarOcorrencia = async function(event) {
    event.preventDefault();

    // Capturar a lista de outros envolvidos
    const outrosEnvolvidos = [];
    const container = document.getElementById('lista_outros_envolvidos');
    if(container) {
        const divs = container.querySelectorAll('[id^="envolvido_"]');
        divs.forEach(div => {
            const id = div.id.replace('envolvido_', '');
            const idColab = document.getElementById(`outro_colab_${id}`).value;
            const nome = document.getElementById(`outro_nome_${id}`).value;
            const funcao = document.getElementById(`outro_funcao_${id}`).value;
            const categoria = document.getElementById(`outro_cat_${id}`).value;
            const placa = document.getElementById(`outro_placa_${id}`).value;

            if(nome) {
                outrosEnvolvidos.push({
                    colaborador_id: idColab,
                    nome: nome,
                    funcao: funcao,
                    equipamento_categoria: categoria,
                    equipamento_placa: placa
                });
            }
        });
    }

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
        gerente: document.getElementById('gerente').value,
        outros_envolvidos: outrosEnvolvidos // A nova coluna JSON para buscas precisas no futuro
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
            Swal.fire('Erro', 'Ocorreu um erro ao guardar a ocorrência. Lembre-se de verificar se a coluna "outros_envolvidos" existe no banco.', 'error');
        } else {
            alert("Erro ao guardar a ocorrência. Verifique o console (F12) para mais detalhes.");
        }
    }
};

window.limparFormOcorrencia = function() {
    const form = document.getElementById('formOcorrencia');
    if (form) {
        form.reset();
        
        const campoEmpresa = document.getElementById('empresa');
        if (campoEmpresa) campoEmpresa.value = "SERRANALOG FLORESTAL";
        
        const container = document.getElementById('lista_outros_envolvidos');
        if (container) container.innerHTML = '';
        window.outrosEnvolvidosCount = 0;
        
        const selectRH = document.getElementById('nome_envolvido_select');
        if (selectRH) selectRH.value = '';
        
        window.carregarFrotasOcorrencia(); 
    }
};