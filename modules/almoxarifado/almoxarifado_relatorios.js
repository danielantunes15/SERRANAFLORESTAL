// ==================== almoxarifado_relatorios.js ====================

// Variáveis exportadas globalmente para garantir a comunicação entre arquivos divididos
window.relatorioTodasMovimentacoes = [];
window.relatorioPecasCache = [];
window.mapaColabSetorGlobal = {}; 

window.renderizarAlmoxRelatorios = async function() {
    await carregarDadosBasicosRelatorio();
    definirFiltroMesAtual();
    aplicarFiltrosRelatorio();
}

function definirFiltroMesAtual() {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    
    document.getElementById('filtroDataInicio').value = primeiroDia.toISOString().split('T')[0];
    document.getElementById('filtroDataFim').value = hoje.toISOString().split('T')[0];
}

function determinarSetorDestino(m) {
    let solicitante = (m.colaborador_nome || m.usuario || '').trim().toUpperCase();
    
    if (solicitante && window.mapaColabSetorGlobal[solicitante]) {
        return window.mapaColabSetorGlobal[solicitante];
    }
    
    if (m.setor_destino && m.setor_destino.toLowerCase().includes('colaborador:')) {
        let nomeExtraido = m.setor_destino.replace(/colaborador:\s*/i, '').trim().toUpperCase();
        if (window.mapaColabSetorGlobal[nomeExtraido]) {
            return window.mapaColabSetorGlobal[nomeExtraido]; 
        }
        return "Sem Setor Correspondente";
    }

    if (m.cavalo) {
        return m.cavalo;
    }
    
    if (m.setor_destino) {
        if (m.setor_destino.toLowerCase().trim() === "colaborador") return "Sem Setor Correspondente";
        return m.setor_destino;
    }
    
    return "Sem Setor Correspondente";
}

async function carregarDadosBasicosRelatorio() {
    try {
        let queryPecas = window.supabaseClient.from('almoxarifado_pecas').select('id, codigo, nome, categoria, quantidade, estoque_minimo, unidade');
        if (typeof window.aplicarFiltroFilial === 'function') queryPecas = window.aplicarFiltroFilial(queryPecas);
        const { data: pecas } = await queryPecas;
        window.relatorioPecasCache = pecas || [];

        const categoriasUnicas = [...new Set(window.relatorioPecasCache.map(p => p.categoria).filter(Boolean))].sort();
        
        const selCategoria = document.getElementById('filtroCategoria');
        if(selCategoria) {
            selCategoria.innerHTML = '<option value="">Todas as Categorias</option>' + 
                categoriasUnicas.map(c => `<option value="${c}">${c}</option>`).join('');
        }

        const selCategoriaExport = document.getElementById('filtroCategoriaExport');
        if(selCategoriaExport) {
            selCategoriaExport.innerHTML = '<option value="">Todas as Categorias</option>' + 
                categoriasUnicas.map(c => `<option value="${c}">${c}</option>`).join('');
        }

        const { data: setores } = await window.supabaseClient.from('setores').select('id, nome');
        const mapaSetores = {};
        if (setores) {
            setores.forEach(s => mapaSetores[String(s.id)] = s.nome);
        }

        let queryColab = window.supabaseClient.from('rh_colaboradores').select('nome, setor_id');
        if (typeof window.aplicarFiltroFilial === 'function') queryColab = window.aplicarFiltroFilial(queryColab);
        const { data: colabs } = await queryColab;
        
        window.mapaColabSetorGlobal = {};
        if (colabs) {
            colabs.forEach(c => {
                if (c.setor_id && c.nome) {
                    const nomeDoSetor = mapaSetores[String(c.setor_id)];
                    if (nomeDoSetor) {
                        window.mapaColabSetorGlobal[c.nome.trim().toUpperCase()] = nomeDoSetor;
                    }
                }
            });
        }

        window.relatorioTodasMovimentacoes = await db.getMovimentacoesEstoque();

        const setoresUnicos = new Set();
        window.relatorioTodasMovimentacoes.forEach(m => {
            const destinoReal = determinarSetorDestino(m);
            if (destinoReal) setoresUnicos.add(destinoReal);
        });

        const selSetor = document.getElementById('filtroSetor');
        if(selSetor) {
            selSetor.innerHTML = '<option value="">Todos os Setores</option>' + 
                [...setoresUnicos].sort().map(s => `<option value="${s}">${s}</option>`).join('');
        }

    } catch(e) {
        console.error("Erro ao carregar dados base do relatório.", e);
    }
}

window.limparFiltrosRelatorio = function() {
    document.getElementById('filtroTipo').value = '';
    document.getElementById('filtroCategoria').value = '';
    document.getElementById('filtroSetor').value = '';
    definirFiltroMesAtual();
    aplicarFiltrosRelatorio();
}

window.aplicarFiltrosRelatorio = function() {
    const fInicio = document.getElementById('filtroDataInicio').value;
    const fFim = document.getElementById('filtroDataFim').value;
    const fTipo = document.getElementById('filtroTipo').value;
    const fCategoria = document.getElementById('filtroCategoria').value;
    const fSetor = document.getElementById('filtroSetor').value;

    let dadosFiltrados = window.relatorioTodasMovimentacoes.filter(m => {
        const dataMov = m.data_movimentacao.split('T')[0];
        const destino = determinarSetorDestino(m);
        
        const pecaRef = window.relatorioPecasCache.find(p => p.id == m.peca_id) || {};
        const categoriaPeca = pecaRef.categoria || 'Sem Categoria';

        if (fInicio && dataMov < fInicio) return false;
        if (fFim && dataMov > fFim) return false;
        if (fTipo && m.tipo !== fTipo) return false;
        if (fSetor && destino !== fSetor) return false;
        if (fCategoria && categoriaPeca !== fCategoria) return false;

        return true;
    });

    atualizarDashboardVisual(dadosFiltrados);
}

function atualizarDashboardVisual(movimentacoes) {
    let valorEntradas = 0;
    let valorSaidas = 0;
    let qtdItens = 0;
    let custosSetor = {};
    let custosCategoria = {};

    const tbodyGeral = document.getElementById('tabelaGeralMovimentacoesBody');
    tbodyGeral.innerHTML = '';

    movimentacoes.forEach(m => {
        const valTotal = (parseFloat(m.quantidade) * parseFloat(m.valor_unitario || 0));
        const pecaRef = window.relatorioPecasCache.find(p => p.id == m.peca_id) || {};
        const nomePeca = pecaRef.nome || `Peça ID: ${m.peca_id}`;
        const categoriaPeca = pecaRef.categoria || 'Outros';
        const solicitante = m.usuario || m.colaborador_nome || 'Sistema';
        
        const destino = determinarSetorDestino(m);

        qtdItens += parseFloat(m.quantidade);
        if (m.tipo === 'entrada') {
            valorEntradas += valTotal;
        } else if (m.tipo === 'saida') {
            valorSaidas += valTotal;
            if(!custosSetor[destino]) custosSetor[destino] = 0;
            custosSetor[destino] += valTotal;

            if(!custosCategoria[categoriaPeca]) custosCategoria[categoriaPeca] = 0;
            custosCategoria[categoriaPeca] += valTotal;
        }

        const dataFormatada = new Date(m.data_movimentacao).toLocaleDateString('pt-BR', {timeZone: 'UTC'});
        const tipoHTML = m.tipo === 'entrada' 
            ? '<span style="background:rgba(96,165,250,0.2); color:#60a5fa; padding:4px 8px; border-radius:4px; font-weight:bold;">Entrada</span>' 
            : (m.tipo === 'saida' ? '<span style="background:rgba(251,191,36,0.2); color:#fbbf24; padding:4px 8px; border-radius:4px; font-weight:bold;">Saída</span>' : '<span style="color:#94a3b8;">Ajuste</span>');

        tbodyGeral.innerHTML += `
            <tr>
                <td style="color: #94a3b8; white-space: nowrap;">${dataFormatada}</td>
                <td>${tipoHTML}</td>
                <td style="color: #f8fafc; font-weight: bold;">${nomePeca}</td>
                <td style="color: #cbd5e1;">${categoriaPeca}</td>
                <td style="color: #a855f7;">${destino}</td>
                <td style="color: #94a3b8;">${solicitante}</td>
                <td style="color: #34d399; font-weight:bold;">${m.quantidade}</td>
                <td style="color: #e2e8f0; font-weight:bold;">R$ ${valTotal.toFixed(2).replace('.',',')}</td>
            </tr>
        `;
    });

    if(movimentacoes.length === 0) {
        tbodyGeral.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:#94a3b8;">Nenhum registro encontrado para os filtros aplicados.</td></tr>';
    }

    const formatMoeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    document.getElementById('kpiValorEntradas').innerText = formatMoeda(valorEntradas);
    document.getElementById('kpiValorSaidas').innerText = formatMoeda(valorSaidas);
    document.getElementById('kpiQtdItens').innerText = qtdItens;
    document.getElementById('kpiTotalRegistros').innerText = movimentacoes.length;

    const preencheTopTabela = (id, objDados) => {
        const tbody = document.getElementById(id);
        if(!tbody) return;
        tbody.innerHTML = '';
        let sortArr = Object.keys(objDados).map(k => ({nome: k, valor: objDados[k]})).sort((a,b) => b.valor - a.valor);
        
        if(sortArr.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:#94a3b8;">Sem saídas nestes filtros.</td></tr>';
        } else {
            sortArr.forEach(c => {
                tbody.innerHTML += `<tr><td><strong style="color:#e2e8f0;">${c.nome}</strong></td><td style="color:#38bdf8; font-weight:bold;">R$ ${c.valor.toFixed(2).replace('.',',')}</td></tr>`;
            });
        }
    };

    preencheTopTabela('tabelaCustoCategoria', custosCategoria);
    preencheTopTabela('tabelaCustoSetor', custosSetor);
}