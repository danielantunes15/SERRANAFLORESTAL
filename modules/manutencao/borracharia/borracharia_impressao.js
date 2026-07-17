// ==================== modules/manutencao/borracharia/borracharia_impressao.js ====================

window.abrirModalFichaBorracharia = function() {
    document.getElementById('modalFichaBorracharia').style.display = 'flex';
};

window.fecharModalFichaBorracharia = function() {
    document.getElementById('modalFichaBorracharia').style.display = 'none';
};

window.gerarPDFBorracharia = function() {
    const categoria = document.getElementById('printFichaCategoria').value;
    if (!categoria) return alert('Selecione uma categoria.');

    // Busca as frotas e garante o filtro contra espaços e caixa baixa
    const frotasCategoria = (window.frotasManutencao || []).filter(f => {
        const catBanco = f.categoria ? f.categoria.trim().toUpperCase() : '';
        const catFiltro = categoria.trim().toUpperCase();
        
        if (catFiltro === 'TODAS') return true;
        return catBanco === catFiltro;
    });
    
    if (frotasCategoria.length === 0) {
        alert('Nenhum veículo encontrado para a seleção.');
        return;
    }

    // Ordenar primeiro por Frota, depois pela Placa
    frotasCategoria.sort((a, b) => (a.numero_frota || a.cavalo).localeCompare(b.numero_frota || b.cavalo));

    const { jsPDF } = window.jspdf;
    
    // jsPDF sem a tag 'landscape' gera o documento no formato Retrato (Vertical) A4 por padrão
    const doc = new jsPDF(); 

    // Título Centralizado
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`FICHA DE CONTROLE DE BORRACHARIA - ${categoria === 'TODAS' ? 'GERAL' : categoria}`, 105, 15, { align: "center" });
    
    // Cabeçalho e Instruções
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Data de Impressão: ${new Date().toLocaleDateString('pt-BR')}`, 10, 25);
    doc.text(`Data do Controle a Campo: ____/____/202___`, 130, 25);
    
    doc.setFontSize(9);
    doc.text(`Instruções: Preencha a data do serviço, pressão medida (Lbs), trocas e assine na frente.`, 10, 31);

    // Nomes mais curtos nas colunas para caber bem na vertical
    const tableCols = [
        "Placa", 
        "Frota/Status", 
        "Categ.",
        "Data", 
        "Lbs", 
        "Troca (Posição)", 
        "Assinatura", 
        "Obs."
    ];

    const tableRows = [];

    frotasCategoria.forEach(f => {
        const frotaTexto = f.numero_frota || '-';
        // Abrevia o status para economizar espaço (Ex: Ativo -> Ativ., Inativo -> Inat.)
        const statusTexto = f.status ? `(${f.status.substring(0, 4)}.)` : ''; 
        
        tableRows.push([
            f.cavalo || '-',
            `${frotaTexto} ${statusTexto}`,
            (f.categoria || '-').substring(0, 8), // Limita caracteres da categoria
            "", 
            "", 
            "", 
            "", 
            ""
        ]);
    });

    doc.autoTable({
        startY: 35,
        head: [tableCols],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [4, 120, 87], halign: 'center' }, // Centraliza título da coluna
        styles: { 
            fontSize: 8, // Fonte menor para caber tudo formatado
            cellPadding: 3, 
            minCellHeight: 12, // Altura exata (12mm) para caberem várias linhas por folha e dar espaço para caneta
            valign: 'middle'
        },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 18, halign: 'center' }, // Placa
            1: { cellWidth: 26, halign: 'center' }, // Frota
            2: { cellWidth: 16, halign: 'center' }, // Categoria
            3: { cellWidth: 18 }, // Data
            4: { cellWidth: 12 }, // Pressão (Lbs)
            5: { cellWidth: 32 }, // Troca (Posição)
            6: { cellWidth: 25 }, // Assinatura
            // A coluna 7 (Obs) pega automaticamente o resto do espaço disponível
        },
        margin: { left: 10, right: 10 } // Margens laterais curtas para maximizar espaço útil da folha A4
    });

    doc.save(`Ficha_Borracharia_${categoria}_${new Date().getTime()}.pdf`);
    fecharModalFichaBorracharia();
};