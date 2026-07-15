window.renderizarAlmoxRelatorios = async function() {
    await carregarDadosEGerarRelatorios();
}

async function carregarDadosEGerarRelatorios() {
    try {
        let movimentacoes = await db.getMovimentacoesEstoque();
        
        let custosFrota = {};
        let custosSetor = {};
        let totalEntradasMes = 0;
        let totalSaidasMes = 0;
        
        const mesAtual = new Date().getMonth();
        const anoAtual = new Date().getFullYear();

        movimentacoes.forEach(m => {
            const val = (m.quantidade * m.valor_unitario);
            const dataMov = new Date(m.data_movimentacao);
            const noMesAtual = (dataMov.getMonth() === mesAtual && dataMov.getFullYear() === anoAtual);

            if (m.tipo === 'entrada' && noMesAtual) {
                totalEntradasMes += val;
            }
            if (m.tipo === 'saida') {
                if (noMesAtual) totalSaidasMes += val;

                if (m.setor_destino) { 
                    if(!custosSetor[m.setor_destino]) custosSetor[m.setor_destino] = 0; 
                    custosSetor[m.setor_destino] += val; 
                } 
                else if (m.cavalo) { 
                    if(!custosFrota[m.cavalo]) custosFrota[m.cavalo] = 0; 
                    custosFrota[m.cavalo] += val; 
                } 
                else { 
                    if(!custosSetor["Oficina Geral"]) custosSetor["Oficina Geral"] = 0; 
                    custosSetor["Oficina Geral"] += val; 
                }
            }
        });

        if(document.getElementById('relMesEntrada')) {
            document.getElementById('relMesEntrada').innerText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalEntradasMes);
            document.getElementById('relMesSaida').innerText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalSaidasMes);
        }

        const preencheTabela = (id, objDados) => {
            const tbody = document.getElementById(id);
            if(!tbody) return;
            tbody.innerHTML = '';
            let sortArr = Object.keys(objDados).map(k => ({nome: k, valor: objDados[k]})).sort((a,b) => b.valor - a.valor);
            
            if(sortArr.length === 0) {
                tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:#94a3b8;">Nenhum dado encontrado neste mês.</td></tr>';
            } else {
                sortArr.forEach(c => {
                    tbody.innerHTML += `<tr><td><strong style="color:#e2e8f0;">${c.nome}</strong></td><td style="color:#38bdf8; font-weight:bold;">R$ ${c.valor.toFixed(2).replace('.',',')}</td></tr>`;
                });
            }
        };

        preencheTabela('tabelaCustoFrota', custosFrota);
        preencheTabela('tabelaCustoSetor', custosSetor);
        
        // Renderizar a tabela geral limitada aos últimos 50
        const tbodyGeral = document.getElementById('tabelaGeralMovimentacoesBody');
        if(tbodyGeral) {
            tbodyGeral.innerHTML = '';
            const top50 = movimentacoes.slice(0, 50);
            top50.forEach(m => {
                const dataFormatada = new Date(m.data_movimentacao).toLocaleDateString('pt-BR');
                const tipoHTML = m.tipo === 'entrada' ? '<span style="color:#60a5fa;">Entrada</span>' : (m.tipo === 'saida' ? '<span style="color:#fbbf24;">Saída</span>' : '<span style="color:#94a3b8;">Ajuste</span>');
                
                tbodyGeral.innerHTML += `
                    <tr>
                        <td style="color: #94a3b8;">${dataFormatada}</td>
                        <td style="font-weight: bold;">${tipoHTML}</td>
                        <td style="color: #cbd5e1;">${m.usuario || 'Sistema'}</td>
                        <td style="color: #f8fafc;">Peça ID: ${m.peca_id}</td>
                        <td style="color: #34d399; font-weight:bold;">${m.quantidade}</td>
                        <td style="color: #94a3b8;">R$ ${parseFloat(m.valor_unitario||0).toFixed(2).replace('.',',')}</td>
                    </tr>
                `;
            });
        }

    } catch(e) {
        console.error("Erro ao carregar dados do relatório.", e);
    }
}