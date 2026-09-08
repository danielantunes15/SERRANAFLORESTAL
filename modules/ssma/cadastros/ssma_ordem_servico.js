// ==================== modules/ssma/cadastros/ssma_ordem_servico.js ====================

/**
 * Busca as filiais cadastradas no sistema e filtra pelo usuário logado
 */
window.carregarFiliaisSSMA = async function() {
    const selectFilial = document.getElementById('filial_id');
    if (!selectFilial) return;
    
    try {
        const { data, error } = await supabaseClient
            .from('filiais') 
            .select('id, nome')
            .order('nome', { ascending: true });

        if (error) throw error;

        selectFilial.innerHTML = '';
        
        // Descobre a filial do usuário logado usando a variável global do seu sistema
        const filialUsuario = (window.currentUser && window.currentUser.filial_id && window.currentUser.filial_id !== 'CENTRAL') 
                              ? parseInt(window.currentUser.filial_id) : null;

        let qtdFiliais = 0;

        data.forEach(filial => {
            // Só adiciona a filial na lista se o usuário for Admin Global OU se for a filial exata dele
            if (filialUsuario === null || filial.id === filialUsuario) {
                const option = document.createElement('option');
                option.value = filial.id;
                option.textContent = filial.nome;
                selectFilial.appendChild(option);
                qtdFiliais++;
            }
        });

        // Se o usuário pertence a uma filial específica, já deixa ela selecionada e bloqueia
        if (filialUsuario !== null && qtdFiliais > 0) {
            selectFilial.value = filialUsuario;
            selectFilial.style.pointerEvents = 'none';
            selectFilial.style.backgroundColor = 'rgba(0,0,0,0.4)';
            selectFilial.style.color = '#94a3b8';
        } else {
            // Se for Admin, adiciona a opção vazia no topo e deixa livre para clicar
            selectFilial.innerHTML = '<option value="" selected disabled>Selecione uma filial...</option>' + selectFilial.innerHTML;
            selectFilial.style.pointerEvents = 'auto';
            selectFilial.style.backgroundColor = 'rgba(0,0,0,0.2)';
            selectFilial.style.color = 'var(--text-primary)';
        }

        // NOVO: Quando a filial mudar, recarrega os cargos para mostrar apenas os daquela filial
        selectFilial.onchange = async function() {
            await window.carregarCargosSSMA();
            const cargoId = document.getElementById('cargo_id').value;
            if (cargoId) window.carregarDadosOsExistente(cargoId, this.value);
        };

        // Força o carregamento dos cargos na inicialização para garantir o filtro correto
        await window.carregarCargosSSMA();

    } catch (error) {
        console.error('Erro ao carregar filiais:', error);
        selectFilial.innerHTML = '<option value="" selected disabled>Erro ao carregar filiais</option>';
    }
};

/**
 * Busca os cargos cadastrados filtrando pela filial selecionada
 */
window.carregarCargosSSMA = async function() {
    const selectCargo = document.getElementById('cargo_id');
    const selectFilial = document.getElementById('filial_id');
    if (!selectCargo || !selectFilial) return;
    
    let filialId = selectFilial.value;

    // Se não tiver filial preenchida no select, tenta pegar do usuário logado
    if (!filialId) {
        const filialUsuario = (window.currentUser && window.currentUser.filial_id && window.currentUser.filial_id !== 'CENTRAL') 
                              ? parseInt(window.currentUser.filial_id) : null;
        if (filialUsuario !== null) filialId = filialUsuario;
    }

    // Se o Admin ainda não selecionou a filial, avisa no select de cargos
    if (!filialId) {
        selectCargo.innerHTML = '<option value="" selected disabled>Selecione uma filial primeiro...</option>';
        selectCargo.onchange = function() {
            const filialAtual = document.getElementById('filial_id').value;
            window.carregarDadosOsExistente(this.value, filialAtual);
        };
        return;
    }

    try {
        // Busca apenas cargos Ativos e da filial selecionada
        let query = supabaseClient.from('cargos').select('id, nome').eq('status', 'Ativo').order('nome', { ascending: true });

        if (filialId !== 'CENTRAL') {
            query = query.eq('filial_id', parseInt(filialId));
        } else {
            query = query.is('filial_id', null);
        }

        const { data, error } = await query;

        if (error) throw error;

        if (!data || data.length === 0) {
            selectCargo.innerHTML = '<option value="" selected disabled>Nenhum cargo encontrado nesta filial</option>';
        } else {
            selectCargo.innerHTML = '<option value="" selected disabled>Selecione um cargo...</option>';
            data.forEach(cargo => {
                const option = document.createElement('option');
                option.value = cargo.id;
                option.textContent = cargo.nome;
                selectCargo.appendChild(option);
            });
        }

        // Escuta a troca de cargo para buscar dados existentes
        selectCargo.onchange = function() {
            const filialAtual = document.getElementById('filial_id').value;
            window.carregarDadosOsExistente(this.value, filialAtual);
        };

    } catch (error) {
        console.error('Erro ao carregar cargos:', error);
        selectCargo.innerHTML = '<option value="" selected disabled>Erro ao carregar cargos</option>';
    }
};

/**
 * Busca no banco de dados se já existe uma O.S. salva para este cargo e filial
 */
window.carregarDadosOsExistente = async function(cargoId, filialId) {
    if (!cargoId) return;

    try {
        let query = supabaseClient.from('ssma_ordem_servico').select('*').eq('cargo_id', parseInt(cargoId));
        if (filialId && filialId !== 'CENTRAL') query = query.eq('filial_id', parseInt(filialId));

        const { data, error } = await query.limit(1);

        if (error) throw error;

        const form = document.getElementById('form-os-ssma');
        const btnSalvar = document.getElementById('btn-salvar-os');

        if (data && data.length > 0) {
            // JÁ EXISTE: Preenche os campos para Edição
            const os = data[0];
            form.dataset.osId = os.id; 

            document.getElementById('atividades_desenvolvidas').value = os.atividades_desenvolvidas || '';
            document.getElementById('riscos_ocupacionais_expostos').value = os.riscos_ocupacionais_expostos || '';
            document.getElementById('equipamentos_protecao_individual').value = os.equipamentos_protecao_individual || '';
            document.getElementById('treinamentos_necessarios').value = os.treinamentos_necessarios || '';
            document.getElementById('normas_internas').value = os.normas_internas || '';
            document.getElementById('procedimentos_acidente_trabalho').value = os.procedimentos_acidente_trabalho || '';
            document.getElementById('termo_responsabilidade').value = os.termo_responsabilidade || '';
            document.getElementById('ano_revisao').value = os.ano_revisao || '2026';

            btnSalvar.innerHTML = '<i class="fas fa-sync-alt me-1"></i> Atualizar Ordem de Serviço';
            btnSalvar.classList.replace('btn-primary-green', 'btn-primary-blue');

            if (typeof Swal !== 'undefined') {
                const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });
                Toast.fire({ icon: 'info', title: 'Dados carregados para edição', background: '#1e293b', color: '#fff' });
            }
        } else {
            // NÃO EXISTE: Limpa os campos para criar uma Nova O.S.
            delete form.dataset.osId; 

            document.getElementById('atividades_desenvolvidas').value = '';
            document.getElementById('riscos_ocupacionais_expostos').value = '';
            document.getElementById('equipamentos_protecao_individual').value = '';
            document.getElementById('treinamentos_necessarios').value = '';
            document.getElementById('normas_internas').value = '';
            document.getElementById('procedimentos_acidente_trabalho').value = '';
            document.getElementById('termo_responsabilidade').value = '';
            document.getElementById('ano_revisao').value = '2026';

            btnSalvar.innerHTML = '<i class="fas fa-save me-1"></i> Salvar Ordem de Serviço';
            btnSalvar.classList.replace('btn-primary-blue', 'btn-primary-green');
        }

    } catch (error) {
        console.error('Erro ao buscar O.S. existente:', error);
    }
};

/**
 * Valida e salva/atualiza os dados da Ordem de Serviço no banco de dados
 */
window.salvarOrdemServicoSSMA = async function(event) {
    if (event) event.preventDefault();

    const form = document.getElementById('form-os-ssma');
    const btnSalvar = document.getElementById('btn-salvar-os');
    const textoOriginalBtn = btnSalvar.innerHTML;
    
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processando...';

    const filialValor = document.getElementById('filial_id').value;
    const cargoValor = document.getElementById('cargo_id').value;
    const osIdParaAtualizar = form.dataset.osId; 

    const osData = {
        filial_id: filialValor && filialValor !== 'CENTRAL' ? parseInt(filialValor) : null,
        cargo_id: cargoValor ? parseInt(cargoValor) : null,
        ano_revisao: parseInt(document.getElementById('ano_revisao').value),
        atividades_desenvolvidas: document.getElementById('atividades_desenvolvidas').value.trim(),
        riscos_ocupacionais_expostos: document.getElementById('riscos_ocupacionais_expostos').value.trim(),
        equipamentos_protecao_individual: document.getElementById('equipamentos_protecao_individual').value.trim(),
        treinamentos_necessarios: document.getElementById('treinamentos_necessarios').value.trim(),
        normas_internas: document.getElementById('normas_internas').value.trim(),
        procedimentos_acidente_trabalho: document.getElementById('procedimentos_acidente_trabalho').value.trim(),
        termo_responsabilidade: document.getElementById('termo_responsabilidade').value.trim()
    };

    if (!osData.cargo_id) {
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = textoOriginalBtn;
        if (typeof Swal !== 'undefined') {
            return Swal.fire({ title: 'Atenção', text: 'Selecione um Cargo antes de salvar.', icon: 'warning', background: '#1e293b', color: '#fff', confirmButtonColor: '#3b82f6' });
        } else {
            return alert('Selecione um Cargo antes de salvar.');
        }
    }

    try {
        let errorDb;

        if (osIdParaAtualizar) {
            const { error } = await supabaseClient
                .from('ssma_ordem_servico')
                .update(osData)
                .eq('id', osIdParaAtualizar);
            errorDb = error;
        } else {
            const { error } = await supabaseClient
                .from('ssma_ordem_servico')
                .insert([osData]);
            errorDb = error;
        }

        if (errorDb) throw errorDb;

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Sucesso!',
                text: osIdParaAtualizar ? 'Ordem de Serviço ATUALIZADA com sucesso!' : 'Ordem de Serviço CADASTRADA com sucesso!',
                icon: 'success',
                background: '#1e293b',
                color: '#fff',
                confirmButtonColor: '#3b82f6'
            });
        } else {
            alert('Operação realizada com sucesso!');
        }

        window.limparFormularioSSMA();

    } catch (error) {
        console.error('Erro ao salvar/atualizar Ordem de Serviço SSMA:', error);
        
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Erro!',
                text: 'Ocorreu um erro ao salvar a Ordem de Serviço. Verifique o console.',
                icon: 'error',
                background: '#1e293b',
                color: '#fff',
                confirmButtonColor: '#3b82f6'
            });
        } else {
            alert('Ocorreu um erro ao salvar a Ordem de Serviço.');
        }
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = textoOriginalBtn;
    }
};

/**
 * Limpa os campos do formulário e redefine o foco
 */
window.limparFormularioSSMA = function() {
    const form = document.getElementById('form-os-ssma');
    const btnSalvar = document.getElementById('btn-salvar-os');

    if (form) {
        form.reset();
        delete form.dataset.osId; 
    }
    
    if (btnSalvar) {
        btnSalvar.innerHTML = '<i class="fas fa-save me-1"></i> Salvar Ordem de Serviço';
        btnSalvar.classList.replace('btn-primary-blue', 'btn-primary-green');
    }
    
    const inputAno = document.getElementById('ano_revisao');
    if (inputAno) inputAno.value = "2026"; 
    
    const inputFilial = document.getElementById('filial_id');
    if (inputFilial) {
        const filialUsuario = (window.currentUser && window.currentUser.filial_id && window.currentUser.filial_id !== 'CENTRAL') 
                              ? parseInt(window.currentUser.filial_id) : null;
        
        if (filialUsuario !== null) {
            inputFilial.value = filialUsuario;
            // Força o carregamento dos cargos para a filial resetada
            window.carregarCargosSSMA().then(() => {
                document.getElementById('cargo_id').focus(); 
            });
        } else {
            // Se for Admin, recarrega para voltar o Select de Filial vazio
            window.carregarCargosSSMA().then(() => {
                inputFilial.focus(); 
            });
        }
    }
};