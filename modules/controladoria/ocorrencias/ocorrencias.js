// =========================================================================
// Módulo: Controladoria -> Ocorrências
// Ficheiro: modules/controladoria/ocorrencias/ocorrencias.js
// =========================================================================

window.listaFrotasOcorrencia = [];
window.todasFrotasCache = [];
window.listaColaboradoresRH = [];
window.listaSetoresOcorrencia = [];
window.outrosEnvolvidosCount = 0;

window.initOcorrencias = async function() {
    console.log("Módulo de Ocorrências Inicializado com sucesso.");
    await window.carregarColaboradoresRH();
    await window.carregarSetoresOcorrencia();
    await window.carregarTodasFrotas();
    window.carregarFrotasOcorrencia();
};

window.carregarSetoresOcorrencia = async function() {
    try {
        let query = supabaseClient.from('setores').select('*').eq('status', 'Ativo').order('nome');
        if (typeof window.aplicarFiltroFilial === 'function') {
            query = window.aplicarFiltroFilial(query);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        window.listaSetoresOcorrencia = data || [];
        
        const select = document.getElementById('setor');
        if (select) {
            select.innerHTML = '<option value="">Selecione o Setor...</option>';
            
            // Fallback: se não houver setores cadastrados, fornece opções básicas
            if (window.listaSetoresOcorrencia.length === 0) {
                 select.innerHTML += `
                    <option value="Logística">Logística</option>
                    <option value="Manutenção">Manutenção</option>
                    <option value="Campo / Operação">Campo / Operação</option>
                    <option value="Administrativo">Administrativo</option>
                    <option value="SSMA">SSMA</option>
                 `;
            } else {
                window.listaSetoresOcorrencia.forEach(s => {
                    select.innerHTML += `<option value="${s.nome}">${s.nome}</option>`;
                });
            }
            // Adicionando a opção 'Outras empresas' no select principal por segurança
            select.innerHTML += '<option value="Outras empresas">Outras empresas</option>';
        }
    } catch (error) {
        console.error("Erro ao carregar setores:", error);
        const select = document.getElementById('setor');
        if(select) select.innerHTML = '<option value="">Erro ao carregar. Digite no relato.</option>';
    }
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

window.calcularTempoEmpresa = function(dataAdmissaoStr) {
    if (!dataAdmissaoStr) return "Sem informação";
    
    // Suporta o formato YYYY-MM-DD vindo do Supabase
    const dataApenas = dataAdmissaoStr.split('T')[0];
    const partes = dataApenas.split('-');
    
    if (partes.length !== 3) return "Formato inválido";
    
    // Cria a data no fuso local para evitar perda de dias
    const admissao = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]));
    const hoje = new Date();
    
    // Reseta as horas para calcular corretamente os dias
    admissao.setHours(0, 0, 0, 0);
    hoje.setHours(0, 0, 0, 0);
    
    if (admissao > hoje) return "Sem informação";
    
    let anos = hoje.getFullYear() - admissao.getFullYear();
    let meses = hoje.getMonth() - admissao.getMonth();
    let dias = hoje.getDate() - admissao.getDate();

    if (dias < 0) {
        meses--;
        // Pegar quantos dias tem o mês anterior
        const ultimoDiaMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0).getDate();
        dias += ultimoDiaMesAnterior;
    }

    if (meses < 0) {
        anos--;
        meses += 12;
    }

    let resultado = [];
    if (anos > 0) resultado.push(anos + (anos === 1 ? " ano" : " anos"));
    if (meses > 0) resultado.push(meses + (meses === 1 ? " mês" : " meses"));
    if (dias > 0) resultado.push(dias + (dias === 1 ? " dia" : " dias"));

    return resultado.length > 0 ? resultado.join(', ') : "Menos de 1 dia";
};

window.preencherDadosColaborador = function(idColaborador, idCampoFuncao, idCampoNomeHidden, idCampoTempoEmpresa) {
    const campoFuncao = document.getElementById(idCampoFuncao);
    const campoNome = document.getElementById(idCampoNomeHidden);
    const campoTempo = idCampoTempoEmpresa ? document.getElementById(idCampoTempoEmpresa) : null;
    
    if(!idColaborador) {
        if(campoFuncao && campoFuncao.readOnly) campoFuncao.value = '';
        if(campoNome) campoNome.value = '';
        if(campoTempo) campoTempo.value = '';
        return;
    }

    const colab = window.listaColaboradoresRH.find(c => c.id == idColaborador);
    if(colab) {
        if(campoFuncao && campoFuncao.readOnly) campoFuncao.value = colab.cargo || colab.funcao || 'Colaborador'; 
        if(campoNome) campoNome.value = colab.nome;
        
        if(campoTempo) {
            campoTempo.value = window.calcularTempoEmpresa(colab.data_admissao);
        }
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

window.mudarTipoEnvolvido = function(id) {
    const tipo = document.getElementById(`outro_tipo_${id}`).value;
    const divColab = document.getElementById(`div_outro_colab_${id}`);
    const divTerceiro = document.getElementById(`div_outro_terceiro_${id}`);
    const divTempo = document.getElementById(`div_outro_tempo_${id}`);
    const inputFuncao = document.getElementById(`outro_funcao_${id}`);
    const selectSetor = document.getElementById(`outro_setor_${id}`); // Novo campo de Setor
    
    if (tipo === 'TERCEIRO') {
        divColab.style.display = 'none';
        divTerceiro.style.display = 'block';
        if (divTempo) divTempo.style.display = 'none';
        inputFuncao.readOnly = false;
        inputFuncao.value = '';
        inputFuncao.placeholder = 'Ex: Motorista Terceirizado, Transportadora...';
        
        if (selectSetor) {
            selectSetor.value = 'Outras empresas';
            selectSetor.style.pointerEvents = 'none'; // Trava a seleção para o usuário não mudar sem querer
            selectSetor.style.opacity = '0.7';
        }
    } else {
        divColab.style.display = 'block';
        divTerceiro.style.display = 'none';
        if (divTempo) divTempo.style.display = 'block';
        inputFuncao.readOnly = true;
        inputFuncao.placeholder = '';
        
        if (selectSetor) {
            selectSetor.value = '';
            selectSetor.style.pointerEvents = 'auto'; // Destrava a seleção normal
            selectSetor.style.opacity = '1';
        }
        
        window.preencherDadosColaborador(document.getElementById(`outro_colab_${id}`).value, `outro_funcao_${id}`, `outro_nome_${id}`, `outro_tempo_${id}`);
    }
};

window.carregarFrotasOutro = function(id) {
    const selCat = document.getElementById(`outro_cat_${id}`);
    const divPlacaInterna = document.getElementById(`div_outro_placa_interna_${id}`);
    const divPlacaTerceiro = document.getElementById(`div_outro_placa_terceiro_${id}`);
    const selPlaca = document.getElementById(`outro_placa_${id}`);
    
    const cat = selCat.value;
    
    if (cat === 'TERCEIRO') {
        divPlacaInterna.style.display = 'none';
        divPlacaTerceiro.style.display = 'block';
        return;
    } else {
        divPlacaInterna.style.display = 'block';
        divPlacaTerceiro.style.display = 'none';
    }

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
    div.style.cssText = "display: flex; flex-direction: column; gap: 15px; margin-bottom: 15px; padding: 15px; border: 1px dashed var(--border-dim); border-radius: 8px; background: rgba(255,255,255,0.02);";
    
    let colabOptions = '<option value="">Selecione...</option>';
    window.listaColaboradoresRH.forEach(c => {
        colabOptions += `<option value="${c.id}">${c.nome}</option>`;
    });

    // Gerar as opções do Setor da mesma forma que o select principal
    let setorOptions = '<option value="">Selecione o Setor...</option>';
    if (window.listaSetoresOcorrencia.length === 0) {
         setorOptions += `
            <option value="Logística">Logística</option>
            <option value="Manutenção">Manutenção</option>
            <option value="Campo / Operação">Campo / Operação</option>
            <option value="Administrativo">Administrativo</option>
            <option value="SSMA">SSMA</option>
         `;
    } else {
        window.listaSetoresOcorrencia.forEach(s => {
            setorOptions += `<option value="${s.nome}">${s.nome}</option>`;
        });
    }
    setorOptions += '<option value="Outras empresas">Outras empresas</option>';

    div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; background: rgba(239, 68, 68, 0.1); padding: 5px 12px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.3);">
                <input type="checkbox" id="outro_responsavel_${id}" style="transform: scale(1.3); accent-color: #ef4444;">
                <strong style="color: #ef4444;">Este é o causador / principal responsável da ocorrência</strong>
            </label>
            <button type="button" class="btn-secondary-dark" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.1); padding: 5px 10px;" onclick="document.getElementById('envolvido_${id}').remove()">
                <i class="fas fa-trash"></i> Remover
            </button>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px;">
            <div class="form-group-dark">
                <label>Tipo de Envolvido</label>
                <select id="outro_tipo_${id}" class="dark-select" onchange="window.mudarTipoEnvolvido(${id})">
                    <option value="COLABORADOR">Colaborador Interno (RH)</option>
                    <option value="TERCEIRO">Empresa Terceira / Externo</option>
                </select>
            </div>
            <div class="form-group-dark" id="div_outro_colab_${id}">
                <label>Colaborador Envolvido</label>
                <select id="outro_colab_${id}" class="dark-select" onchange="window.preencherDadosColaborador(this.value, 'outro_funcao_${id}', 'outro_nome_${id}', 'outro_tempo_${id}')">
                    ${colabOptions}
                </select>
                <input type="hidden" id="outro_nome_${id}">
            </div>
            <div class="form-group-dark" id="div_outro_terceiro_${id}" style="display: none;">
                <label>Nome / Empresa Terceira</label>
                <input type="text" id="outro_terceiro_nome_${id}" class="dark-select" placeholder="Ex: Transportadora XYZ">
            </div>
            <div class="form-group-dark">
                <label>Função / Cargo</label>
                <input type="text" id="outro_funcao_${id}" class="dark-select" readonly>
            </div>
            <div class="form-group-dark">
                <label>Setor / Departamento</label>
                <select id="outro_setor_${id}" class="dark-select">
                    ${setorOptions}
                </select>
            </div>
            <div class="form-group-dark" id="div_outro_tempo_${id}">
                <label>Tempo de Empresa</label>
                <input type="text" id="outro_tempo_${id}" class="dark-select" readonly style="opacity: 0.7; cursor: not-allowed;" placeholder="Preenchimento automático">
            </div>
            <div class="form-group-dark">
                <label>Equipamento (Categoria)</label>
                <select id="outro_cat_${id}" class="dark-select" onchange="window.carregarFrotasOutro(${id})">
                    <option value="">Sem Equipamento / Não se aplica</option>
                    <option value="TRITREM">TRITREM</option>
                    <option value="PRANCHA">PRANCHA</option>
                    <option value="GRUA">GRUA</option>
                    <option value="COMBOIO">COMBOIO</option>
                    <option value="CARRETA">CARRETA</option>
                    <option value="FROTA LEVE">FROTA LEVE</option>
                    <option value="TERCEIRO">VEÍCULO DE TERCEIRO</option>
                </select>
            </div>
            <div class="form-group-dark" id="div_outro_placa_interna_${id}">
                <label>Equipamento (Placa)</label>
                <select id="outro_placa_${id}" class="dark-select">
                    <option value="">Aguardando...</option>
                </select>
            </div>
            <div class="form-group-dark" id="div_outro_placa_terceiro_${id}" style="display: none;">
                <label>Placa do Terceiro</label>
                <input type="text" id="outro_placa_terceiro_input_${id}" class="dark-select" placeholder="Ex: ABC-1234">
            </div>
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

    // Capturar a lista dinâmica de envolvidos e suas marcações
    const outrosEnvolvidos = [];
    const container = document.getElementById('lista_outros_envolvidos');
    
    if(container) {
        const divs = container.querySelectorAll('[id^="envolvido_"]');
        divs.forEach(div => {
            const id = div.id.replace('envolvido_', '');
            const isResponsavel = document.getElementById(`outro_responsavel_${id}`).checked;
            const tipo = document.getElementById(`outro_tipo_${id}`).value;
            
            let nome = '';
            let idColab = null;

            if (tipo === 'TERCEIRO') {
                nome = document.getElementById(`outro_terceiro_nome_${id}`).value;
            } else {
                idColab = document.getElementById(`outro_colab_${id}`).value;
                nome = document.getElementById(`outro_nome_${id}`).value;
            }
            
            const funcao = document.getElementById(`outro_funcao_${id}`).value;
            const setor = document.getElementById(`outro_setor_${id}`) ? document.getElementById(`outro_setor_${id}`).value : '';
            const tempoEmpresa = tipo === 'COLABORADOR' ? (document.getElementById(`outro_tempo_${id}`) ? document.getElementById(`outro_tempo_${id}`).value : '') : '';
            
            const categoria = document.getElementById(`outro_cat_${id}`).value;
            let placa = '';
            
            if (categoria === 'TERCEIRO') {
                placa = document.getElementById(`outro_placa_terceiro_input_${id}`).value;
            } else {
                placa = document.getElementById(`outro_placa_${id}`).value;
            }

            if(nome) {
                outrosEnvolvidos.push({
                    is_responsavel: isResponsavel,
                    tipo_envolvido: tipo,
                    colaborador_id: idColab,
                    nome: nome,
                    funcao: funcao,
                    setor: setor,
                    tempo_empresa: tempoEmpresa,
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
        setor: document.getElementById('setor') ? document.getElementById('setor').value : null,
        tempo_empresa: document.getElementById('tempo_empresa').value,
        escala: document.getElementById('escala').value,
        descricao_fatos: document.getElementById('descricao_fatos').value,
        prevencao_falha: document.getElementById('prevencao_falha').value,
        parecer_gestor: document.getElementById('parecer_gestor').value,
        gestor_imediato: document.getElementById('gestor_imediato').value,
        gerente: document.getElementById('gerente').value,
        
        // Novos campos integrados para o Relatório de Avarias
        tipo_ocorrencia: document.getElementById('tipo_ocorrencia') ? document.getElementById('tipo_ocorrencia').value : 'Outros',
        status: document.getElementById('status') ? document.getElementById('status').value : 'Aberta',
        valor_prejuizo: document.getElementById('valor_prejuizo') ? (parseFloat(document.getElementById('valor_prejuizo').value) || 0) : 0,

        outros_envolvidos: outrosEnvolvidos // JSONB resolve a escalabilidade e rankings de terceiros
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
                text: 'A ocorrência foi salva com sucesso. Deseja imprimir o formulário agora?',
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
            Swal.fire('Erro', 'Ocorreu um erro ao guardar a ocorrência. Lembre-se de verificar a estrutura do banco (coluna outros_envolvidos JSONB).', 'error');
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
        
        if (document.getElementById('setor')) document.getElementById('setor').value = '';
        
        window.carregarFrotasOcorrencia(); 
    }
};

window.imprimirFolhaEmBranco = function() {
    if (typeof window.imprimirFolhaOcorrencia === 'function') {
        window.imprimirFolhaOcorrencia({ isBlank: true });
    } else {
        alert("Função de impressão não encontrada.");
    }
};