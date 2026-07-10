window.listaColaboradoresDb = [];
window.listaCursosAtivos = [];

// Definição dos campos básicos obrigatórios para considerar um cadastro "Completo"
window.camposBaseObrigatorios = [
    { key: 'cpf', id: 'colCpf' },
    { key: 'rg', id: 'colRg' },
    { key: 'data_nascimento', id: 'colDataNascimento' },
    { key: 'data_admissao', id: 'colDataAdmissao' },
    { key: 'funcao', id: 'colFuncao' },
    { key: 'telefone', id: 'colTelefone' },
    { key: 'endereco', id: 'colEndereco' }
];

window.initRHColaboradores = async function() {
    // Mostra a listagem e esconde a ficha no início
    document.getElementById('viewListagemColaboradores').style.display = 'block';
    document.getElementById('viewFichaColaborador').style.display = 'none';
    
    await window.carregarCursosGlobais();
    await window.carregarColaboradoresLista();
};

// ==================== VERIFICAÇÃO DE PENDÊNCIAS ====================
window.verificarPendenciasCadastro = function(colaborador) {
    let camposFaltando = [];
    window.camposBaseObrigatorios.forEach(campo => {
        if (!colaborador[campo.key] || String(colaborador[campo.key]).trim() === '') {
            camposFaltando.push(campo);
        }
    });
    return camposFaltando;
};

window.limparValidacaoVisualFicha = function() {
    document.getElementById('alertaCamposPendentes').style.display = 'none';
    window.camposBaseObrigatorios.forEach(campo => {
        const el = document.getElementById(campo.id);
        if (el) {
            el.classList.remove('campo-pendente');
            if (el.previousElementSibling && el.previousElementSibling.tagName === 'LABEL') {
                el.previousElementSibling.classList.remove('label-pendente');
            }
        }
    });
};

// ==================== LISTAGEM E PESQUISA ====================
window.carregarColaboradoresLista = async function() {
    try {
        const tbody = document.getElementById('tbListaColaboradores');
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Carregando banco de dados...</td></tr>`;
        
        window.listaColaboradoresDb = await db.getColaboradores();
        window.renderizarTabelaColaboradores(window.listaColaboradoresDb);
    } catch (e) {
        console.error(e);
        alert("Erro ao carregar lista de colaboradores.");
    }
};

window.renderizarTabelaColaboradores = function(lista) {
    const tbody = document.getElementById('tbListaColaboradores');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#9ca3af; padding: 20px;">Nenhum colaborador encontrado com os filtros aplicados.</td></tr>`;
        return;
    }

    lista.forEach(c => {
        let corStatus = 'var(--ccol-green-bright)';
        if(c.status === 'Inativo' || c.status === 'Desligado') corStatus = '#ef4444';
        else if(c.status === 'Férias' || c.status === 'Afastado') corStatus = '#f59e0b';

        const matriculaFormatada = c.cod_funcionario ? String(c.cod_funcionario).padStart(4, '0') : 'S/ Matrícula';
        
        // Verifica se há informações faltando no cadastro
        const pendencias = window.verificarPendenciasCadastro(c);
        let badgeAlerta = '';
        if (pendencias.length > 0 && c.status !== 'Inativo' && c.status !== 'Desligado') {
            badgeAlerta = `<span title="Cadastro Desatualizado (${pendencias.length} informações pendentes)" style="color: #ef4444; margin-right: 12px; font-size: 1.1rem; cursor: help;"><i class="fas fa-exclamation-triangle"></i></span>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong style="color: var(--ccol-blue-bright); font-size: 1.1rem;">${matriculaFormatada}</strong></td>
            <td style="text-align: left; font-weight: bold; font-size: 1.05rem;">${c.nome}</td>
            <td><span style="background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 4px; border: 1px solid var(--border-dim); font-size: 0.85rem;">${c.funcao || 'Não informada'}</span></td>
            <td><span style="color: ${corStatus}; font-weight: bold; font-size: 0.9rem;">${c.status || 'Ativo'}</span></td>
            <td>
                <div style="display: flex; align-items: center; justify-content: center;">
                    ${badgeAlerta}
                    <button class="btn-primary-blue" style="padding: 6px 12px; font-size: 0.8rem;" onclick="window.abrirFichaCompleta('${c.id}')"><i class="fas fa-edit"></i> Editar Ficha</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.filtrarColaboradoresLista = function() {
    const termoNome = document.getElementById('filtroNome').value.toLowerCase();
    const termoMatricula = document.getElementById('filtroMatricula').value.toLowerCase();
    
    const filtrados = window.listaColaboradoresDb.filter(c => {
        const nomeMatch = c.nome && c.nome.toLowerCase().includes(termoNome);
        const matMatch = c.cod_funcionario && String(c.cod_funcionario).includes(termoMatricula);
        
        // Se ambos os campos foram digitados, tem que bater com os dois. Se só um, bate com aquele.
        if (termoNome && termoMatricula) return nomeMatch && matMatch;
        if (termoNome) return nomeMatch;
        if (termoMatricula) return matMatch;
        return true; // Se ambos vazios, retorna todos
    });
    
    window.renderizarTabelaColaboradores(filtrados);
};

// ==================== TRANSIÇÃO E LÓGICA DA FICHA COMPLETA ====================
window.voltarParaListagem = function() {
    document.getElementById('viewFichaColaborador').style.display = 'none';
    document.getElementById('viewListagemColaboradores').style.display = 'block';
};

window.calcularProximaMatriculaFull = function() {
    let novoCod = 1;
    if (window.listaColaboradoresDb.length > 0) {
        const codigos = window.listaColaboradoresDb.map(c => parseInt(c.cod_funcionario)).filter(n => !isNaN(n) && n > 0).sort((a, b) => a - b);
        for (let i = 1; i <= codigos.length + 1; i++) {
            if (!codigos.includes(i)) { novoCod = i; break; }
        }
    }
    return novoCod;
};

window.abrirFichaCompleta = function(id = null) {
    document.getElementById('viewListagemColaboradores').style.display = 'none';
    document.getElementById('viewFichaColaborador').style.display = 'block';
    
    window.limparValidacaoVisualFicha();
    
    if (id) {
        // MODO EDIÇÃO
        const c = window.listaColaboradoresDb.find(x => x.id === id);
        if (!c) return;

        document.getElementById('tituloFicha').innerText = c.nome;
        document.getElementById('subtituloFicha').innerText = 'Edição de Ficha Cadastral';
        document.getElementById('btnExcluirFicha').style.display = 'flex';
        document.getElementById('colaboradorId').value = c.id;
        document.getElementById('colCodFuncionarioDisplay').innerText = c.cod_funcionario ? String(c.cod_funcionario).padStart(4, '0') : 'N/A';
        
        document.getElementById('colStatus').value = c.status || 'Ativo';
        document.getElementById('colPlanoSaude').value = c.plano_saude || 'Não';
        document.getElementById('colSindicato').value = c.ativo_sindicato || 'Não';
        
        document.getElementById('colCpf').value = c.cpf || '';
        document.getElementById('colRg').value = c.rg || '';
        document.getElementById('colNome').value = c.nome || '';
        document.getElementById('colDataNascimento').value = c.data_nascimento || '';
        document.getElementById('colDataAdmissao').value = c.data_admissao || '';
        document.getElementById('colFuncao').value = c.funcao || '';
        document.getElementById('colTelefone').value = c.telefone || '';
        document.getElementById('colSalario').value = c.salario_base || '';
        document.getElementById('colEndereco').value = c.endereco || '';
        
        document.getElementById('colCnhNumero').value = c.cnh_numero || '';
        document.getElementById('colCnhCategoria').value = c.cnh_categoria || '';
        document.getElementById('colCnhVencimento').value = c.cnh_vencimento || '';
        document.getElementById('colExperiencia').value = c.experiencia_texto || '';
        
        document.getElementById('colAsoVencimento').value = c.aso_vencimento || '';
        document.getElementById('colToxicologico').value = c.toxicologico_vencimento || '';
        document.getElementById('colObservacoes').value = c.observacoes || '';

        window.montarCamposCursosDinamicosFull(c.cursos_vencimentos || {});
        
        // Destacar campos pendentes se houver
        const pendencias = window.verificarPendenciasCadastro(c);
        if (pendencias.length > 0) {
            document.getElementById('alertaCamposPendentes').style.display = 'flex';
            pendencias.forEach(p => {
                const el = document.getElementById(p.id);
                if (el) {
                    el.classList.add('campo-pendente');
                    if (el.previousElementSibling && el.previousElementSibling.tagName === 'LABEL') {
                        el.previousElementSibling.classList.add('label-pendente');
                    }
                }
            });
        }

    } else {
        // MODO NOVO CADASTRO
        document.getElementById('tituloFicha').innerText = 'Novo Cadastro';
        document.getElementById('subtituloFicha').innerText = 'Preencha as informações do novo integrante';
        document.getElementById('btnExcluirFicha').style.display = 'none';
        
        document.getElementById('colaboradorId').value = '';
        const proximoCod = window.calcularProximaMatriculaFull();
        document.getElementById('colCodFuncionarioDisplay').innerText = String(proximoCod).padStart(4, '0');
        
        const campos = ['colCpf', 'colRg', 'colNome', 'colDataNascimento', 'colDataAdmissao', 
                        'colFuncao', 'colTelefone', 'colSalario', 'colEndereco', 'colCnhNumero', 'colCnhCategoria', 
                        'colCnhVencimento', 'colExperiencia', 'colAsoVencimento', 'colToxicologico', 'colObservacoes'];
                        
        campos.forEach(el => document.getElementById(el).value = '');
        document.getElementById('colStatus').value = 'Ativo';
        document.getElementById('colPlanoSaude').value = 'Não';
        document.getElementById('colSindicato').value = 'Não';
        
        window.montarCamposCursosDinamicosFull({});
    }
};

window.salvarColaboradorFicha = async function() {
    const id = document.getElementById('colaboradorId').value;
    
    const getValue = (elId) => document.getElementById(elId).value;
    const getDateValue = (elId) => { const val = document.getElementById(elId).value; return val ? val : null; };

    const cursosVencimentosObj = {};
    document.querySelectorAll('.input-curso-dinamico').forEach(input => {
        const nomeCurso = input.getAttribute('data-cursonome');
        const valorData = input.value;
        if(valorData) cursosVencimentosObj[nomeCurso] = valorData;
    });

    const dados = {
        status: getValue('colStatus'),
        plano_saude: getValue('colPlanoSaude'),
        ativo_sindicato: getValue('colSindicato'),
        nome: getValue('colNome'),
        cpf: getValue('colCpf'),
        rg: getValue('colRg'),
        data_nascimento: getDateValue('colDataNascimento'),
        data_admissao: getDateValue('colDataAdmissao'),
        funcao: getValue('colFuncao'),
        telefone: getValue('colTelefone'),
        salario_base: parseFloat(getValue('colSalario')) || 0,
        endereco: getValue('colEndereco'),
        
        cnh_numero: getValue('colCnhNumero'),
        cnh_categoria: getValue('colCnhCategoria'),
        cnh_vencimento: getDateValue('colCnhVencimento'),
        experiencia_texto: getValue('colExperiencia'),
        
        aso_vencimento: getDateValue('colAsoVencimento'),
        toxicologico_vencimento: getDateValue('colToxicologico'),
        
        cursos_vencimentos: cursosVencimentosObj,
        observacoes: getValue('colObservacoes')
    };

    if (!id) dados.cod_funcionario = window.calcularProximaMatriculaFull();
    if (!dados.nome) return alert('O Nome Completo é obrigatório para salvar a ficha.');

    try {
        if (id) {
            await db.updateColaborador(id, dados);
            if (typeof window.registrarLogAuditoria === 'function') window.registrarLogAuditoria('RH', 'Edição', `Ficha atualizada: ${dados.nome}`, 'Info');
            alert('Ficha atualizada com sucesso!');
        } else {
            await db.addColaborador(dados);
            if (typeof window.registrarLogAuditoria === 'function') window.registrarLogAuditoria('RH', 'Criação', `Novo colaborador: ${dados.nome}`, 'Info');
            alert('Novo colaborador cadastrado com sucesso!');
        }
        
        await window.carregarColaboradoresLista();
        window.voltarParaListagem(); // Retorna à lista automaticamente
    } catch (e) {
        console.error(e);
        alert('Erro ao salvar no banco de dados. Tente novamente.');
    }
};

window.excluirColaboradorAtual = async function() {
    const id = document.getElementById('colaboradorId').value;
    if (!id) return;
    
    if (confirm('AÇÃO IRREVERSÍVEL!\nTem certeza que deseja EXCLUIR PERMANENTEMENTE o cadastro deste colaborador?')) {
        try {
            const nome = document.getElementById('colNome').value;
            await db.deleteColaborador(id);
            if (typeof window.registrarLogAuditoria === 'function') window.registrarLogAuditoria('RH', 'Exclusão', `Colaborador removido: ${nome}`, 'Crítico');
            
            alert('Cadastro excluído com sucesso.');
            await window.carregarColaboradoresLista();
            window.voltarParaListagem();
        } catch (e) {
            console.error(e);
            alert('Erro ao processar a exclusão.');
        }
    }
};

// ==================== GESTÃO DOS CURSOS GLOBAIS DINÂMICOS ====================
window.montarCamposCursosDinamicosFull = function(vencimentosSalvos = {}) {
    const container = document.getElementById('containerCursosDinamicos');
    if (!container) return;
    container.innerHTML = '';

    if (window.listaCursosAtivos.length === 0) {
        container.innerHTML = `<p style="color:var(--text-secondary); font-size:0.8rem; grid-column:1/-1;">Nenhum curso cadastrado globalmente.</p>`;
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

window.carregarCursosGlobais = async function() {
    try {
        let query = window.supabaseClient.from('rh_cursos').select('*').order('nome', { ascending: true });
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
        
        const { data, error } = await query;
        if (error) throw error;
        window.listaCursosAtivos = data || [];
    } catch(e) { console.error("Erro ao buscar cursos globais:", e); }
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
        container.innerHTML = `<p style="color: var(--text-secondary); text-align:center; padding:15px; font-size:0.85rem;">Lista de cursos vazia.</p>`;
        return;
    }

    window.listaCursosAtivos.forEach(curso => {
        container.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:6px; border:1px solid var(--border-dim);">
                <span style="color:#fff; font-weight:600; font-size:0.9rem;"><i class="fas fa-graduation-cap" style="color:#8b5cf6; margin-right:8px;"></i> ${curso.nome}</span>
                <button class="btn-icon-only" onclick="window.excluirCursoGlobal('${curso.id}')" title="Excluir Curso"><i class="fas fa-times" style="color:#ef4444;"></i></button>
            </div>
        `;
    });
};

window.salvarNovoCursoGlobal = async function() {
    const nome = document.getElementById('novoCursoNome').value.trim();
    if (!nome) return alert('Digite o nome do curso.');
    
    try {
        let dados = { nome: nome };
        if (typeof window.injetarFilial === 'function') dados = window.injetarFilial(dados);
        
        await window.supabaseClient.from('rh_cursos').insert([dados]);
        document.getElementById('novoCursoNome').value = '';
        await window.carregarCursosGlobais();
        window.renderizarListaCursosGlobais();
        
        // Se a ficha estiver aberta, atualiza ela silenciosamente pra mostrar o novo campo
        if(document.getElementById('viewFichaColaborador').style.display === 'block') {
            const vencimentos = {};
            document.querySelectorAll('.input-curso-dinamico').forEach(inp => vencimentos[inp.getAttribute('data-cursonome')] = inp.value);
            window.montarCamposCursosDinamicosFull(vencimentos);
        }
    } catch(e) { alert('Erro ao inserir curso.'); }
};

window.excluirCursoGlobal = async function(id) {
    if (confirm('Remover este curso da lista global?')) {
        try {
            await window.supabaseClient.from('rh_cursos').delete().eq('id', id);
            await window.carregarCursosGlobais();
            window.renderizarListaCursosGlobais();
            
            if(document.getElementById('viewFichaColaborador').style.display === 'block') {
                const vencimentos = {};
                document.querySelectorAll('.input-curso-dinamico').forEach(inp => vencimentos[inp.getAttribute('data-cursonome')] = inp.value);
                window.montarCamposCursosDinamicosFull(vencimentos);
            }
        } catch(e) { alert('Erro ao excluir o curso.'); }
    }
};