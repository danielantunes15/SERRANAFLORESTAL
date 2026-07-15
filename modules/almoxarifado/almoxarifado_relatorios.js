// Variáveis globais para armazenar os dados brutos e facilitar o filtro
let relatorioTodasMovimentacoes = [];
let relatorioPecasCache = [];

window.renderizarAlmoxRelatorios = async function() {
    await carregarDadosBasicosRelatorio();
    definirFiltroMesAtual();
    aplicarFiltrosRelatorio();
}

// Define as datas iniciais como o mês atual (do dia 1 até hoje)
function definirFiltroMesAtual() {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    
    document.getElementById('filtroDataInicio').value = primeiroDia.toISOString().split('T')[0];
    document.getElementById('filtroDataFim').value = hoje.toISOString().split('T')[0];
}

async function carregarDadosBasicosRelatorio() {
    try {
        // 1. Buscar todas as peças para cruzar Categoria e Nome
        let queryPecas = window.supabaseClient.from('almoxarifado_pecas').select('id, nome, categoria');
        if (typeof window.aplicarFiltroFilial === 'function') queryPecas = window.aplicarFiltroFilial(queryPecas);
        const { data: pecas } = await queryPecas;
        relatorioPecasCache = pecas || [];

        // 2. Popula o Select de Categorias
        const categoriasUnicas = [...new Set(relatorioPecasCache.map(p => p.categoria).filter(Boolean))].sort();
        const selCategoria = document.getElementById('filtroCategoria');
        selCategoria.innerHTML = '<option value="">Todas as Categorias</option>' + 
            categoriasUnicas.map(c => `<option value="${c}">${c}</option>`).join('');

        // 3. Buscar Movimentações
        relatorioTodasMovimentacoes = await db.getMovimentacoesEstoque();

        // 4. Popula o Select de Setores/Destinos baseado no histórico
        const setoresUnicos = [...new Set(relatorioTodasMovimentacoes.map(m => m.setor_destino || m.cavalo).filter(Boolean))].sort();
        const selSetor = document.getElementById('filtroSetor');
        selSetor.innerHTML = '<option value="">Todos os Setores</option>' + 
            setoresUnicos.map(s => `<option value="${s}">${s}</option>`).join('');

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

    let dadosFiltrados = relatorioTodasMovimentacoes.filter(m => {
        const dataMov = m.data_movimentacao.split('T')[0];
        const destino = m.setor_destino || m.cavalo || '';
        
        // Cruzar com a peça para descobrir a categoria
        const pecaRef = relatorioPecasCache.find(p => p.id == m.peca_id) || {};
        const categoriaPeca = pecaRef.categoria || 'Sem Categoria';

        // Filtro Data
        if (fInicio && dataMov < fInicio) return false;
        if (fFim && dataMov > fFim) return false;
        
        // Filtro Tipo
        if (fTipo && m.tipo !== fTipo) return false;
        
        // Filtro Setor
        if (fSetor && destino !== fSetor) return false;

        // Filtro Categoria
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
        const pecaRef = relatorioPecasCache.find(p => p.id == m.peca_id) || {};
        const nomePeca = pecaRef.nome || `Peça ID: ${m.peca_id}`;
        const categoriaPeca = pecaRef.categoria || 'Outros';
        const destino = m.setor_destino || m.cavalo || 'Estoque Geral';
        const solicitante = m.usuario || m.colaborador_nome || 'Sistema';

        // Atualizar KPIs
        qtdItens += parseFloat(m.quantidade);
        if (m.tipo === 'entrada') {
            valorEntradas += valTotal;
        } else if (m.tipo === 'saida') {
            valorSaidas += valTotal;
            
            // Agrupar Setores (Somente Saídas representam custo real distribuído)
            if(!custosSetor[destino]) custosSetor[destino] = 0;
            custosSetor[destino] += valTotal;

            // Agrupar Categorias
            if(!custosCategoria[categoriaPeca]) custosCategoria[categoriaPeca] = 0;
            custosCategoria[categoriaPeca] += valTotal;
        }

        // Renderizar Linha na Tabela Detalhada
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

    // Atualizar KPIs Visuais
    const formatMoeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    document.getElementById('kpiValorEntradas').innerText = formatMoeda(valorEntradas);
    document.getElementById('kpiValorSaidas').innerText = formatMoeda(valorSaidas);
    document.getElementById('kpiQtdItens').innerText = qtdItens;
    document.getElementById('kpiTotalRegistros').innerText = movimentacoes.length;

    // Função auxiliar para tabelas de top
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