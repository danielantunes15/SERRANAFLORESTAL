// ==================== js/colaboradores.js ====================
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
    
    await window.carregarSetoresGlobal(); // CARREGA OS SETORES INICIALMENTE PARA O FILTRO
    await window.carregarCursosGlobais();
    await window.carregarColaboradoresLista();
};

// ==================== CARREGAR SETORES GLOBAIS ====================
window.carregarSetoresGlobal = async function() {
    try {
        const { data, error } = await window.supabaseClient.from('setores').select('id, nome').eq('status', 'Ativo');
        if (error) throw error;
        
        // Preenche o campo de seleção dentro da ficha do colaborador
        const selSetor = document.getElementById('colSetorId');
        if (selSetor) {
            selSetor.innerHTML = '<option value="">Selecione um setor...</option>' + 
                data.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
        }
        
        // Preenche o NOVO campo de filtro de setor na listagem
        const selFiltroSetor = document.getElementById('filtroSetorLista');
        if (selFiltroSetor) {
            selFiltroSetor.innerHTML = '<option value="">Todos os Setores</option>' + 
                data.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
        }
    } catch(e) { console.error("Erro ao carregar setores:", e); }
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
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Carregando banco de dados...</td></tr>`;
        
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
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#9ca3af; padding: 20px;">Nenhum colaborador encontrado com os filtros aplicados.</td></tr>`;
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
            badgeAlerta = `<span title="Cadastro Desatualizado (${pendencias.length} informações pendentes)" style="color: #ef4444; margin-right: 5px; font-size: 1.1rem; cursor: help;"><i class="fas fa-exclamation-triangle"></i></span>`;
        }
        
        // Busca o nome do setor baseado no ID do colaborador para exibição na tabela
        let nomeSetor = 'Não informado';
        if (c.setor_id) {
            const selectSetor = document.getElementById('filtroSetorLista');
            if (selectSetor) {
                const option = Array.from(selectSetor.options).find(opt => opt.value == c.setor_id);
                if (option) nomeSetor = option.text;
            }
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong style="color: var(--ccol-blue-bright); font-size: 1.1rem;">${matriculaFormatada}</strong></td>
            <td style="text-align: left; font-weight: bold; font-size: 1.05rem;">${c.nome}</td>
            <td><span style="background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 4px; border: 1px solid var(--border-dim); font-size: 0.85rem;">${c.funcao || 'Não informada'}</span></td>
            <td><span style="background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 4px; border: 1px solid var(--border-dim); font-size: 0.85rem;">${nomeSetor}</span></td>
            <td><span style="color: ${corStatus}; font-weight: bold; font-size: 0.9rem;">${c.status || 'Ativo'}</span></td>
            <td style="text-align: right;">
                <div style="display: flex; align-items: center; justify-content: flex-end; gap: 10px;">
                    ${badgeAlerta}
                    <button class="btn-icon-only" title="Imprimir Ficha Cadastral" style="color: #60a5fa; border:none; background:transparent; cursor:pointer; font-size:1.1rem;" onclick="window.imprimirFichaColaborador('${c.id}')"><i class="fas fa-id-card"></i></button>
                    <button class="btn-icon-only" title="Imprimir Ficha de EPI / Equipamentos" style="color: #f59e0b; border:none; background:transparent; cursor:pointer; font-size:1.1rem;" onclick="window.imprimirFichaEPI('${c.id}')"><i class="fas fa-hard-hat"></i></button>
                    <button class="btn-primary-blue" style="padding: 6px 12px; font-size: 0.8rem;" onclick="window.abrirFichaCompleta('${c.id}')"><i class="fas fa-edit"></i> Editar</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// ==================== MELHORIA: LÓGICA DE FILTRO ATUALIZADA ====================
window.filtrarColaboradoresLista = function() {
    const termoNome = document.getElementById('filtroNome').value.toLowerCase();
    const termoMatricula = document.getElementById('filtroMatricula').value.toLowerCase();
    const termoSetor = document.getElementById('filtroSetorLista').value; // Novo filtro de setor
    
    const filtrados = window.listaColaboradoresDb.filter(c => {
        // Validações isoladas
        const nomeMatch = !termoNome || (c.nome && c.nome.toLowerCase().includes(termoNome));
        const matMatch = !termoMatricula || (c.cod_funcionario && String(c.cod_funcionario).includes(termoMatricula));
        const setorMatch = !termoSetor || (String(c.setor_id) === String(termoSetor));
        
        // O colaborador só aparece se passar em todos os filtros que estiverem preenchidos
        return nomeMatch && matMatch && setorMatch;
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

window.abrirFichaCompleta = async function(id = null) {
    document.getElementById('viewListagemColaboradores').style.display = 'none';
    document.getElementById('viewFichaColaborador').style.display = 'block';
    
    window.limparValidacaoVisualFicha();
    await window.carregarSetoresGlobal();
    
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
        document.getElementById('colSetorId').value = c.setor_id || '';
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
        document.getElementById('colSetorId').value = '';
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
        setor_id: getValue('colSetorId') ? parseInt(getValue('colSetorId')) : null,
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

// ==================== IMPRESSÃO DE FICHAS E EPIS ====================

window.gerarHtmlFichaColaborador = function(colaboradores) {
    let html = `<html><head><title>Ficha Cadastral</title><style>
        body { font-family: Arial, sans-serif; font-size: 13px; color: #000; }
        .page-break { page-break-after: always; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .header h2 { margin: 0; font-size: 18px; }
        .header h3 { margin: 5px 0 0 0; font-size: 14px; font-weight: normal; color: #444; }
        .section-title { background: #f0f0f0; padding: 6px; font-weight: bold; border: 1px solid #000; margin-top: 15px; text-transform: uppercase; font-size: 11px; }
        .row { display: flex; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px solid #000; }
        .row:first-of-type { border-top: 1px solid #000; }
        .col { padding: 8px; border-right: 1px solid #000; flex: 1; }
        .col:last-child { border-right: none; }
        .label { font-size: 10px; color: #555; display: block; text-transform: uppercase; margin-bottom: 2px; }
        .val { font-weight: bold; font-size: 12px; }
    </style></head><body>`;

    const fmtDt = (d) => d ? d.split('-').reverse().join('/') : '-';

    colaboradores.forEach(c => {
        let cursosHtml = '';
        if(c.cursos_vencimentos && Object.keys(c.cursos_vencimentos).length > 0) {
            cursosHtml = `<div class="section-title">Cursos e Treinamentos</div>`;
            for(let [curso, data] of Object.entries(c.cursos_vencimentos)) {
                cursosHtml += `<div class="row"><div class="col"><span class="label">${curso} (Vencimento)</span><span class="val">${fmtDt(data)}</span></div></div>`;
            }
        }

        html += `
        <div class="page-break">
            <div class="header">
                <h2>SERRANA FLORESTAL</h2>
                <h3>FICHA CADASTRAL DE COLABORADOR</h3>
            </div>
            
            <div class="section-title">Dados Pessoais e Contratuais</div>
            <div class="row">
                <div class="col" style="flex:2"><span class="label">Nome Completo</span><span class="val">${c.nome}</span></div>
                <div class="col"><span class="label">Matrícula</span><span class="val">${c.cod_funcionario ? String(c.cod_funcionario).padStart(4, '0') : '-'}</span></div>
            </div>
            <div class="row">
                <div class="col"><span class="label">CPF</span><span class="val">${c.cpf || '-'}</span></div>
                <div class="col"><span class="label">RG</span><span class="val">${c.rg || '-'}</span></div>
                <div class="col"><span class="label">Data de Nascimento</span><span class="val">${fmtDt(c.data_nascimento)}</span></div>
            </div>
            <div class="row">
                <div class="col"><span class="label">Função / Cargo</span><span class="val">${c.funcao || '-'}</span></div>
                <div class="col"><span class="label">Data de Admissão</span><span class="val">${fmtDt(c.data_admissao)}</span></div>
                <div class="col"><span class="label">Status</span><span class="val">${c.status || 'Ativo'}</span></div>
            </div>
            <div class="row">
                <div class="col" style="flex:2"><span class="label">Endereço</span><span class="val">${c.endereco || '-'}</span></div>
                <div class="col"><span class="label">Telefone</span><span class="val">${c.telefone || '-'}</span></div>
            </div>
            <div class="row">
                <div class="col"><span class="label">Sindicato</span><span class="val">${c.ativo_sindicato || '-'}</span></div>
                <div class="col"><span class="label">Plano de Saúde</span><span class="val">${c.plano_saude || '-'}</span></div>
                <div class="col"><span class="label">Salário Base</span><span class="val">R$ ${c.salario_base || '-'}</span></div>
            </div>

            <div class="section-title">Habilitação e Saúde</div>
            <div class="row">
                <div class="col"><span class="label">Nº CNH</span><span class="val">${c.cnh_numero || '-'}</span></div>
                <div class="col"><span class="label">Categoria CNH</span><span class="val">${c.cnh_categoria || '-'}</span></div>
                <div class="col"><span class="label">Vencimento CNH</span><span class="val">${fmtDt(c.cnh_vencimento)}</span></div>
            </div>
            <div class="row">
                <div class="col"><span class="label">Vencimento ASO</span><span class="val">${fmtDt(c.aso_vencimento)}</span></div>
                <div class="col"><span class="label">Vencimento Toxicológico</span><span class="val">${fmtDt(c.toxicologico_vencimento)}</span></div>
            </div>

            ${cursosHtml}

            <div class="section-title">Observações</div>
            <div class="row" style="min-height: 80px;">
                <div class="col"><span class="val">${c.observacoes || '-'}</span></div>
            </div>
        </div>`;
    });

    html += `</body></html>`;
    return html;
};

window.gerarHtmlFichaEPI = async function(colaboradores) {
    let pecas = [];
    let reqs = [];
    
    // Busca informações cruzadas do módulo Almoxarifado para cruzar com RH
    if (window.supabaseClient) {
        const resPecas = await window.supabaseClient.from('almoxarifado_pecas').select('id, codigo, nome, categoria, unidade');
        if (resPecas.data) pecas = resPecas.data;

        const resReqs = await window.supabaseClient.from('almoxarifado_requisicoes').select('*').eq('status', 'Aprovado');
        if (resReqs.data) reqs = resReqs.data;
    }

    let html = `<html><head><title>Ficha de EPI / Equipamentos</title><style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #000; }
        .page-break { page-break-after: always; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #000; padding: 8px; text-align: left; }
        th { background-color: #f0f0f0; text-transform: uppercase; font-size: 11px; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .header h2 { margin: 0; font-size: 18px; }
        .header h3 { margin: 5px 0 0 0; font-size: 14px; font-weight: normal; color: #444; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; border: 1px solid #000; padding: 10px; }
        .assinaturas { margin-top: 50px; display: flex; justify-content: space-around; text-align: center; }
        .sig-line { border-top: 1px solid #000; width: 250px; margin: 0 auto 5px auto; }
    </style></head><body>`;

    colaboradores.forEach(c => {
        let itensColab = reqs.filter(r => r.colaborador_nome === c.nome);

        html += `
        <div class="page-break">
            <div class="header">
                <h2>SERRANA FLORESTAL</h2>
                <h3>FICHA DE CONTROLE E ENTREGA DE E.P.I / EQUIPAMENTOS</h3>
            </div>
            <div class="info-grid">
                <div><strong style="text-transform:uppercase; font-size:10px; color:#555; display:block;">Nome do Colaborador</strong> ${c.nome}</div>
                <div><strong style="text-transform:uppercase; font-size:10px; color:#555; display:block;">Matrícula</strong> ${c.cod_funcionario ? String(c.cod_funcionario).padStart(4, '0') : '-'}</div>
                <div><strong style="text-transform:uppercase; font-size:10px; color:#555; display:block;">Função</strong> ${c.funcao || '-'}</div>
                <div><strong style="text-transform:uppercase; font-size:10px; color:#555; display:block;">Data Admissão</strong> ${c.data_admissao ? c.data_admissao.split('-').reverse().join('/') : '-'}</div>
            </div>
            
            <p style="text-align: justify; font-size: 11px; line-height: 1.5;">
                Declaro ter recebido os Equipamentos de Proteção Individual (E.P.I) e demais materiais/ferramentas abaixo listadas, 
                comprometendo-me a utilizá-los e conservá-los adequadamente durante o exercício de minhas funções, 
                bem como devolvê-los em caso de desligamento da empresa ou para efetuar a troca do equipamento.
            </p>

            <table>
                <thead>
                    <tr>
                        <th style="width: 15%">Data Entrega</th>
                        <th style="width: 15%">C.A. / Cód.</th>
                        <th style="width: 35%">Descrição do Produto</th>
                        <th style="width: 10%; text-align:center;">Qtd</th>
                        <th style="width: 25%; text-align:center;">Assinatura do Colaborador</th>
                    </tr>
                </thead>
                <tbody>`;
        
        if (itensColab.length === 0) {
            html += `<tr><td colspan="5" style="text-align:center; padding: 20px;">Nenhum equipamento registrado para este colaborador.</td></tr>`;
        } else {
            itensColab.forEach(req => {
                let peca = pecas.find(p => p.id == req.peca_id);
                let dataFormatada = new Date(req.created_at).toLocaleDateString('pt-BR');
                html += `
                    <tr>
                        <td>${dataFormatada}</td>
                        <td>${peca ? (peca.codigo || '-') : '-'}</td>
                        <td>${peca ? peca.nome : 'Item Excluído'}</td>
                        <td style="text-align:center;">${req.quantidade} ${peca ? (peca.unidade||'UN') : ''}</td>
                        <td></td>
                    </tr>
                `;
            });
        }

        html += `
                </tbody>
            </table>
            <div class="assinaturas">
                <div>
                    <div class="sig-line"></div>
                    <strong>Setor SSMA / Segurança do Trabalho</strong>
                </div>
                <div>
                    <div class="sig-line"></div>
                    <strong>${c.nome}</strong><br>
                    <span style="font-size: 11px;">Colaborador</span>
                </div>
            </div>
        </div>`;
    });

    html += `</body></html>`;
    return html;
};

window.imprimirFichaColaborador = function(id) {
    const colab = window.listaColaboradoresDb.find(c => c.id === id);
    if (!colab) return;
    const html = window.gerarHtmlFichaColaborador([colab]);
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
};

window.exportarTodasFichas = function() {
    if (window.listaColaboradoresDb.length === 0) return alert("Nenhum colaborador encontrado.");
    const html = window.gerarHtmlFichaColaborador(window.listaColaboradoresDb);
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
};

window.imprimirFichaEPI = async function(id) {
    const colab = window.listaColaboradoresDb.find(c => c.id === id);
    if (!colab) return;
    
    const iconBtn = document.activeElement;
    if(iconBtn) iconBtn.style.opacity = '0.5';

    const html = await window.gerarHtmlFichaEPI([colab]);
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    
    if(iconBtn) iconBtn.style.opacity = '1';
    setTimeout(() => { win.print(); win.close(); }, 800);
};

window.exportarTodasFichasEPI = async function() {
    if (window.listaColaboradoresDb.length === 0) return alert("Nenhum colaborador encontrado.");
    
    const html = await window.gerarHtmlFichaEPI(window.listaColaboradoresDb);
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    
    setTimeout(() => { win.print(); win.close(); }, 1500); // Dá um tempo maior para carregar os dados todos
};