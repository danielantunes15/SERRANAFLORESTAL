window.listaColaboradores = [];
window.listaCursosAtivos = [];

window.initRHColaboradores = async function() {
    await window.carregarCursosGlobais();
    await window.carregarColaboradores();
};

// ==================== OPERAÇÕES DA TABELA DINÂMICA DE CURSOS ====================
window.carregarCursosGlobais = async function() {
    try {
        let query = window.supabaseClient.from('rh_cursos').select('*').order('nome', { ascending: true });
        if (typeof window.aplicarFiltroFilial === 'function') {
            query = window.aplicarFiltroFilial(query);
        }
        const { data, error } = await query;
        if (error) throw error;
        window.listaCursosAtivos = data || [];
    } catch(e) {
        console.error("Erro ao buscar cursos:", e);
    }
};

window.abrirModalGerenciarCursos = async function() {
    await window.carregarCursosGlobais();
    document.getElementById('novoCursoNome').value = '';
    window.renderizarListaCursosGlobais();
    document.getElementById('modalGerenciarCursos').classList.add('show');
};

window.fecharModalGerenciarCursos = function() {
    document.getElementById('modalGerenciarCursos').classList.remove('show');
};

window.renderizarListaCursosGlobais = function() {
    const container = document.getElementById('listaCursosGlobais');
    if (!container) return;
    container.innerHTML = '';

    if (window.listaCursosAtivos.length === 0) {
        container.innerHTML = `<p style="color: var(--text-secondary); text-align:center; padding:15px; font-size:0.85rem;">Nenhum curso cadastrado ainda.</p>`;
        return;
    }

    window.listaCursosAtivos.forEach(curso => {
        const div = document.createElement('div');
        div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:6px; border:1px solid var(--border-dim);';
        div.innerHTML = `
            <span style="color:#fff; font-weight:600; font-size:0.9rem;"><i class="fas fa-graduation-cap" style="color:#8b5cf6; margin-right:8px;"></i> ${curso.nome}</span>
            <button class="btn-icon-only" onclick="window.excluirCursoGlobal('${curso.id}')" title="Remover Curso"><i class="fas fa-times" style="color:#ef4444;"></i></button>
        `;
        container.appendChild(div);
    });
};

window.salvarNovoCursoGlobal = async function() {
    const nome = document.getElementById('novoCursoNome').value.trim();
    if (!nome) { alert('Digite o nome do curso.'); return; }

    try {
        let dados = { nome: nome };
        if (typeof window.injetarFilial === 'function') dados = window.injetarFilial(dados);

        const { error } = await window.supabaseClient.from('rh_cursos').insert([dados]);
        if (error) throw error;

        document.getElementById('novoCursoNome').value = '';
        await window.carregarCursosGlobais();
        window.renderizarListaCursosGlobais();
    } catch(e) {
        alert('Erro ao inserir novo curso.');
    }
};

window.excluirCursoGlobal = async function(id) {
    if (confirm('Deseja realmente remover este curso da lista? Ele deixará de aparecer nas fichas de cadastro.')) {
        try {
            const { error } = await window.supabaseClient.from('rh_cursos').delete().eq('id', id);
            if (error) throw error;
            await window.carregarCursosGlobais();
            window.renderizarListaCursosGlobais();
        } catch(e) {
            alert('Erro ao excluir curso.');
        }
    }
};

// ==================== GESTÃO DE COLABORADORES ====================
window.carregarColaboradores = async function() {
    try {
        const tbody = document.getElementById('tbColaboradores');
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Carregando banco de dados de RH...</td></tr>`;
        
        window.listaColaboradores = await db.getColaboradores();
        window.renderizarTabelaColaboradores(window.listaColaboradores);
    } catch (e) {
        console.error(e);
        alert("Erro ao carregar lista de colaboradores.");
    }
};

window.calcularBadgeVencimento = function(dataStr) {
    if (!dataStr) return '<span style="color:#64748b; font-size:0.75rem;">Não inserido</span>';
    
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    const vencimento = new Date(dataStr + 'T00:00:00'); 
    
    const difTempo = vencimento.getTime() - hoje.getTime();
    const diasRestantes = Math.ceil(difTempo / (1000 * 3600 * 24));

    if (diasRestantes < 0) {
        return '<span style="background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size:0.75rem;"><i class="fas fa-exclamation-triangle"></i> Vencido</span>';
    }
    if (diasRestantes <= 30) {
        return `<span style="background: rgba(251, 146, 60, 0.2); color: #fb923c; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size:0.75rem;"><i class="fas fa-clock"></i> Vence em ${diasRestantes}d</span>`;
    }
    return '<span style="color: var(--ccol-green-bright); font-size:0.75rem;"><i class="fas fa-check-circle"></i> OK</span>';
};

window.renderizarTabelaColaboradores = function(lista) {
    const tbody = document.getElementById('tbColaboradores');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#9ca3af; padding: 20px;">Nenhum colaborador encontrado.</td></tr>`;
        return;
    }

    lista.forEach(c => {
        let corStatus = '#fff';
        if(c.status === 'Inativo') corStatus = '#ef4444';
        else if(c.status === 'Férias' || c.status === 'Afastado') corStatus = '#f59e0b';
        else corStatus = 'var(--ccol-green-bright)';

        const matriculaFormatada = c.cod_funcionario ? String(c.cod_funcionario).padStart(4, '0') : 'Novo';

        // Badge do Plano de Saúde
        const isPlanoAtivo = c.plano_saude === 'Sim';
        const badgePlanoSaude = `<span style="background: ${isPlanoAtivo ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color: ${isPlanoAtivo ? '#10b981' : '#ef4444'}; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; border: 1px solid var(--border-dim); font-weight: bold;">${isPlanoAtivo ? '🟢 Ativo' : '🔴 Inativo'}</span>`;

        // Varre os cursos dinâmicos para verificar se há algum alerta crítico
        let htmlAlertasCursos = '';
        const vencimentosObj = c.cursos_vencimentos || {};
        
        window.listaCursosAtivos.forEach(curso => {
            if (vencimentosObj[curso.nome]) {
                const badge = window.calcularBadgeVencimento(vencimentosObj[curso.nome]);
                if (badge.includes('Vencido') || badge.includes('Vence em')) {
                    htmlAlertasCursos += `<div style="font-size:0.75rem; margin-top:2px;">⚠️ <strong>${curso.nome}:</strong> ${badge}</div>`;
                }
            }
        });

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong style="display:block; font-size: 1.1rem; color: var(--ccol-blue-bright);">${matriculaFormatada}</strong>
                <span style="font-size: 0.75rem; font-weight: bold; color: ${corStatus};">${c.status || 'Ativo'}</span>
            </td>
            <td style="text-align: left; font-weight: bold;">
                ${c.nome}
                <div style="font-size: 0.75rem; color: #94a3b8; font-weight: normal; margin-top: 3px;">CPF: ${c.cpf || 'Não informado'}</div>
            </td>
            <td><span style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; border: 1px solid var(--border-dim);">${c.funcao || 'Não definida'}</span></td>
            <td>${c.telefone || '-'}</td>
            <td>${badgePlanoSaude}</td>
            <td style="text-align: left;">
                <div style="font-size: 0.8rem; margin-bottom: 2px;"><strong>CNH:</strong> ${window.calcularBadgeVencimento(c.cnh_vencimento)}</div>
                <div style="font-size: 0.8rem; margin-bottom: 2px;"><strong>ASO:</strong> ${window.calcularBadgeVencimento(c.aso_vencimento)}</div>
                ${htmlAlertasCursos}
            </td>
            <td>
                <button class="btn-icon-only" onclick="window.editarColaborador('${c.id}')" title="Ver Ficha / Editar"><i class="fas fa-edit" style="color: var(--ccol-blue-bright);"></i></button>
                <button class="btn-icon-only" onclick="window.excluirColaborador('${c.id}')" title="Excluir Colaborador"><i class="fas fa-trash" style="color: #ef4444;"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.filtrarColaboradores = function() {
    const termo = document.getElementById('buscaColaborador').value.toLowerCase();
    const filtrados = window.listaColaboradores.filter(c => 
        (c.nome && c.nome.toLowerCase().includes(termo)) || 
        (c.cpf && c.cpf.includes(termo)) ||
        (c.cod_funcionario && String(c.cod_funcionario).includes(termo)) ||
        (c.funcao && c.funcao.toLowerCase().includes(termo))
    );
    window.renderizarTabelaColaboradores(filtrados);
};

// RENDERIZAÇÃO DINÂMICA DOS CAMPOS DE CURSOS PERMITIDOS
window.montarCamposCursosDinamicos = function(vencimentosSalvos = {}) {
    const container = document.getElementById('containerCursosDinamicos');
    if (!container) return;
    container.innerHTML = '';

    if (window.listaCursosAtivos.length === 0) {
        container.innerHTML = `<p style="color:var(--text-secondary); font-size:0.8rem; grid-column:1/-1;">Nenhum curso cadastrado no painel de gerenciamento.</p>`;
        return;
    }

    window.listaCursosAtivos.forEach(curso => {
        const valorData = vencimentosSalvos[curso.nome] || '';
        
        const div = document.createElement('div');
        div.className = 'form-group-dark';
        div.innerHTML = `
            <label>${curso.nome}</label>
            <input type="date" class="input-curso-dinamico" data-cursonome="${curso.nome}" value="${valorData}">
        `;
        container.appendChild(div);
    });
};

// ==================== LÓGICA: TAPAR BURACOS DA SEQUÊNCIA ====================
window.calcularProximaMatricula = function() {
    let novoCod = 1;
    if (window.listaColaboradores && window.listaColaboradores.length > 0) {
        // Pega todos os códigos, converte para número e ordena do menor para o maior
        const codigos = window.listaColaboradores
            .map(c => parseInt(c.cod_funcionario))
            .filter(n => !isNaN(n) && n > 0)
            .sort((a, b) => a - b);
        
        // Varre do número 1 em diante procurando o primeiro buraco (sequência que não tem)
        for (let i = 1; i <= codigos.length + 1; i++) {
            if (!codigos.includes(i)) {
                novoCod = i;
                break;
            }
        }
    }
    return novoCod;
};

window.abrirModalColaborador = async function() {
    await window.carregarCursosGlobais();
    document.getElementById('colaboradorId').value = '';
    
    // AGORA ELE MOSTRA A MATRÍCULA TAPANDO O BURACO (EX: 0001, 0002)
    const proximoCod = window.calcularProximaMatricula();
    document.getElementById('colCodFuncionario').value = String(proximoCod).padStart(4, '0');
    
    const campos = ['colCpf', 'colRg', 'colNome', 'colDataNascimento', 'colDataAdmissao', 
                    'colFuncao', 'colTelefone', 'colEndereco', 'colCnhNumero', 'colCnhCategoria', 
                    'colCnhVencimento', 'colExperiencia', 'colAsoVencimento', 'colToxicologico', 'colObservacoes'];
                    
    campos.forEach(id => document.getElementById(id).value = '');
    document.getElementById('colStatus').value = 'Ativo';
    document.getElementById('colPlanoSaude').value = 'Não';
    
    window.montarCamposCursosDinamicos({});
    
    document.getElementById('modalColaboradorTitle').innerHTML = '<i class="fas fa-user-plus"></i> Novo Colaborador';
    document.getElementById('modalColaborador').classList.add('show');
};

window.fecharModalColaborador = function() {
    document.getElementById('modalColaborador').classList.remove('show');
};

window.editarColaborador = async function(id) {
    await window.carregarCursosGlobais();
    const c = window.listaColaboradores.find(x => x.id === id);
    if (!c) return;

    document.getElementById('colaboradorId').value = c.id;
    document.getElementById('colCodFuncionario').value = c.cod_funcionario ? String(c.cod_funcionario).padStart(4, '0') : 'N/A';
    
    document.getElementById('colStatus').value = c.status || 'Ativo';
    document.getElementById('colPlanoSaude').value = c.plano_saude || 'Não';
    document.getElementById('colCpf').value = c.cpf || '';
    document.getElementById('colRg').value = c.rg || '';
    document.getElementById('colNome').value = c.nome || '';
    document.getElementById('colDataNascimento').value = c.data_nascimento || '';
    document.getElementById('colDataAdmissao').value = c.data_admissao || '';
    document.getElementById('colFuncao').value = c.funcao || '';
    document.getElementById('colTelefone').value = c.telefone || '';
    document.getElementById('colEndereco').value = c.endereco || '';
    
    document.getElementById('colCnhNumero').value = c.cnh_numero || '';
    document.getElementById('colCnhCategoria').value = c.cnh_categoria || '';
    document.getElementById('colCnhVencimento').value = c.cnh_vencimento || '';
    document.getElementById('colExperiencia').value = c.experiencia_texto || '';
    
    document.getElementById('colAsoVencimento').value = c.aso_vencimento || '';
    document.getElementById('colToxicologico').value = c.toxicologico_vencimento || '';
    document.getElementById('colObservacoes').value = c.observacoes || '';

    // Passa o objeto contendo os vencimentos salvos para preencher os inputs dinâmicos
    window.montarCamposCursosDinamicos(c.cursos_vencimentos || {});

    document.getElementById('modalColaboradorTitle').innerHTML = '<i class="fas fa-user-edit"></i> Editar Colaborador';
    document.getElementById('modalColaborador').classList.add('show');
};

window.salvarColaborador = async function() {
    const id = document.getElementById('colaboradorId').value;
    
    const getValue = (elId) => document.getElementById(elId).value;
    const getDateValue = (elId) => { const val = document.getElementById(elId).value; return val ? val : null; };

    // Capturar os vencimentos dos cursos de forma dinâmica mapeando os inputs gerados
    const cursosVencimentosObj = {};
    const inputsDinamicos = document.querySelectorAll('.input-curso-dinamico');
    inputsDinamicos.forEach(input => {
        const nomeCurso = input.getAttribute('data-cursonome');
        const valorData = input.value;
        if(valorData) {
            cursosVencimentosObj[nomeCurso] = valorData;
        }
    });

    const dados = {
        status: getValue('colStatus'),
        plano_saude: getValue('colPlanoSaude'),
        nome: getValue('colNome'),
        cpf: getValue('colCpf'),
        rg: getValue('colRg'),
        data_nascimento: getDateValue('colDataNascimento'),
        data_admissao: getDateValue('colDataAdmissao'),
        funcao: getValue('colFuncao'),
        telefone: getValue('colTelefone'),
        endereco: getValue('colEndereco'),
        
        cnh_numero: getValue('colCnhNumero'),
        cnh_categoria: getValue('colCnhCategoria'),
        cnh_vencimento: getDateValue('colCnhVencimento'),
        experiencia_texto: getValue('colExperiencia'),
        
        aso_vencimento: getDateValue('colAsoVencimento'),
        toxicologico_vencimento: getDateValue('colToxicologico'),
        
        cursos_vencimentos: cursosVencimentosObj, // Objeto JSONB mapeado dinamicamente
        observacoes: getValue('colObservacoes')
    };

    if (!id) {
        // SE FOR UM NOVO CADASTRO, INJETA A MATRÍCULA CALCULADA (TAPA BURACO)
        dados.cod_funcionario = window.calcularProximaMatricula();
    }

    if (!dados.nome) {
        alert('O Nome Completo do colaborador é obrigatório.');
        return;
    }

    try {
        if (id) {
            await db.updateColaborador(id, dados);
            if (typeof window.registrarLogAuditoria === 'function') window.registrarLogAuditoria('RH', 'Edição', `Ficha editada: ${dados.nome}`, 'Info');
        } else {
            // Ao enviar manualmente a propriedade 'cod_funcionario', o Supabase aceita ignorando o 'auto-incremento'
            await db.addColaborador(dados);
            if (typeof window.registrarLogAuditoria === 'function') window.registrarLogAuditoria('RH', 'Criação', `Novo colaborador cadastrado: ${dados.nome}`, 'Info');
        }
        window.fecharModalColaborador();
        await window.carregarColaboradores();
    } catch (e) {
        console.error(e);
        alert('Erro ao salvar as informações do colaborador.');
    }
};

window.excluirColaborador = async function(id) {
    if (confirm('Atenção: Tem certeza que deseja excluir permanentemente o cadastro deste colaborador?')) {
        try {
            const c = window.listaColaboradores.find(x => x.id === id);
            await db.deleteColaborador(id);
            if (typeof window.registrarLogAuditoria === 'function') window.registrarLogAuditoria('RH', 'Exclusão', `Colaborador removido: ${c.nome}`, 'Alerta');
            await window.carregarColaboradores();
        } catch (e) {
            console.error(e);
            alert('Erro ao excluir o colaborador.');
        }
    }
};