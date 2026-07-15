// ==================== almoxarifado_relatorios_impressao.js ====================
// Arquivo exclusivo para gerenciar a exportação em PDF A4 do Almoxarifado

window.exportarEstoquePDF = function() {
    const catSelecionada = document.getElementById('filtroCategoriaExport').value;
    // Puxa o cache global criado no outro arquivo
    let pecasExport = window.relatorioPecasCache || [];
    
    // Tenta resgatar informações da Filial e do Usuário para o cabeçalho
    let filialNome = 'Serrana Florestal';
    let usuarioLogado = 'Sistema';
    try {
        const sessionStr = localStorage.getItem('ccol_user_session');
        if (sessionStr) {
            const session = JSON.parse(sessionStr);
            if (session.filial_nome) filialNome += ' - Filial: ' + session.filial_nome;
            if (session.nome) usuarioLogado = session.nome;
        }
    } catch(e) {}
    
    // Se o usuário selecionou uma categoria específica, nós filtramos
    if (catSelecionada) {
        pecasExport = pecasExport.filter(p => p.categoria === catSelecionada);
    }

    if (pecasExport.length === 0) {
        alert('Nenhum item encontrado para esta categoria.');
        return;
    }

    // Organizar em ordem alfabética
    pecasExport.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    const dataEmissao = new Date().toLocaleString('pt-BR');
    
    // LÓGICA INTELIGENTE: Se filtrou por categoria, oculta a coluna de categoria para economizar espaço
    const mostrarColunaCategoria = !catSelecionada;

    let html = `<html>
    <head>
        <title>Relatório de Estoque - ${catSelecionada || 'Geral'}</title>
        <style>
            @page {
                size: A4 portrait;
                margin: 10mm;
            }
            body {
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                color: #1e293b;
                margin: 0;
                padding: 0;
                font-size: 10px; /* Fonte base menor e mais compacta */
                background-color: #fff;
            }
            .header-container {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 2px solid #10b981;
                padding-bottom: 8px;
                margin-bottom: 12px;
            }
            .company-info h1 {
                margin: 0;
                font-size: 16px;
                color: #0f172a;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .company-info h2 {
                margin: 3px 0 0 0;
                font-size: 11px;
                color: #475569;
                font-weight: 500;
            }
            .doc-info {
                text-align: right;
            }
            .doc-info h3 {
                margin: 0;
                font-size: 13px;
                color: #10b981;
                text-transform: uppercase;
            }
            .doc-info p {
                margin: 2px 0 0 0;
                font-size: 9px;
                color: #64748b;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
            }
            th, td {
                border: 1px solid #cbd5e1;
                padding: 4px 6px; /* Padding radicalmente reduzido para caber mais itens */
                text-align: left;
                vertical-align: middle;
            }
            th {
                background-color: #f1f5f9;
                color: #334155;
                font-weight: bold;
                text-transform: uppercase;
                font-size: 9px;
            }
            tbody tr:nth-child(even) {
                background-color: #f8fafc;
            }
            .row-alert {
                background-color: #fef2f2 !important;
            }
            .text-center { text-align: center; }
            .badge-ok {
                color: #166534;
                font-weight: bold;
                font-size: 9px;
            }
            .badge-alert {
                color: #dc2626;
                font-weight: bold;
                font-size: 9px;
            }
            .footer {
                margin-top: 20px;
                text-align: center;
                font-size: 9px;
                color: #94a3b8;
                border-top: 1px solid #e2e8f0;
                padding-top: 10px;
            }
        </style>
    </head>
    <body>
        <div class="header-container">
            <div class="company-info">
                <h1>${filialNome}</h1>
                <h2>Relatório de Posição de Estoque</h2>
            </div>
            <div class="doc-info">
                <h3>Inventário Almoxarifado</h3>
                <p><strong>Categoria:</strong> ${catSelecionada || 'Geral (Todas as Categorias)'}</p>
                <p><strong>Emissão:</strong> ${dataEmissao}</p>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width: 10%;">Código</th>
                    <th style="width: ${mostrarColunaCategoria ? '40%' : '55%'};">Descrição do Produto</th>
                    ${mostrarColunaCategoria ? '<th style="width: 15%;">Categoria</th>' : ''}
                    <th style="width: 10%; text-align: center;">Estoque Atual</th>
                    <th style="width: 10%; text-align: center;">Qtd. Mínima</th>
                    <th style="width: 15%; text-align: center;">Status</th>
                </tr>
            </thead>
            <tbody>
    `;

    pecasExport.forEach(p => {
        const qtd = parseFloat(p.quantidade || 0);
        const min = parseFloat(p.estoque_minimo || 0);
        
        // Verifica se o estoque está abaixo ou igual ao mínimo
        const isAbaixoDoMinimo = (qtd <= min);
        const classeLinha = isAbaixoDoMinimo ? 'class="row-alert"' : '';
        
        const badgeStatus = isAbaixoDoMinimo 
            ? '<span class="badge-alert">⚠️ REPOR</span>' 
            : '<span class="badge-ok">✓ OK</span>';

        // Linha da tabela super compacta
        html += `
            <tr ${classeLinha}>
                <td style="color: #64748b; font-size: 9px;">${p.codigo || '-'}</td>
                <td style="font-weight: bold; color: #1e293b; font-size: 10px;">${p.nome}</td>
                ${mostrarColunaCategoria ? `<td style="color: #475569; font-size: 9px;">${p.categoria || '-'}</td>` : ''}
                <td class="text-center" style="font-weight: bold; color: #0f172a; font-size: 10px;">${qtd} <span style="font-size:8px; color:#64748b;">${p.unidade || 'UN'}</span></td>
                <td class="text-center" style="color: #64748b; font-size: 10px;">${min} <span style="font-size:8px;">${p.unidade || 'UN'}</span></td>
                <td class="text-center">${badgeStatus}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>

        <div class="footer">
            Documento gerado eletronicamente pelo Sistema CCOL. <br>
            Solicitado por: <strong>${usuarioLogado}</strong>
        </div>
    </body>
    </html>`;

    // Abre uma nova aba, renderiza o HTML e chama a impressão do navegador (PDF A4)
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    
    // Tempo rápido para garantir o carregamento do CSS e exibir a janela de impressão
    setTimeout(() => { 
        win.print(); 
        win.close(); 
    }, 500);
};