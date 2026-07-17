// ==================== modules/manutencao/borracharia/borracharia_impressao.js ====================

window.abrirModalFichaBorracharia = function() {
    document.getElementById('modalFichaBorracharia').style.display = 'flex';
};

window.fecharModalFichaBorracharia = function() {
    document.getElementById('modalFichaBorracharia').style.display = 'none';
};

// GERAÇÃO DA FICHA SIMPLES (AVULSA)
window.gerarPDFBorracharia = function() {
    const categoria = document.getElementById('printFichaCategoria').value;
    if (!categoria) return alert('Selecione uma categoria.');

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

    frotasCategoria.sort((a, b) => (a.numero_frota || a.cavalo).localeCompare(b.numero_frota || b.cavalo));

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF(); 

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`FICHA AVULSA DE BORRACHARIA - ${categoria === 'TODAS' ? 'GERAL' : categoria}`, 105, 15, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Data de Impressão: ${new Date().toLocaleDateString('pt-BR')}`, 10, 25);
    doc.text(`Data do Controle a Campo: ____/____/202___`, 130, 25);
    
    doc.setFontSize(9);
    doc.text(`Instruções: Preencha a data do serviço, pressão medida (Lbs), trocas e assine na frente.`, 10, 31);

    const tableCols = ["Placa", "Frota/Status", "Categ.", "Data", "Lbs", "Troca (Posição)", "Assinatura", "Obs."];
    const tableRows = [];

    frotasCategoria.forEach(f => {
        const frotaTexto = f.numero_frota || '-';
        const statusTexto = f.status ? `(${f.status.substring(0, 4)}.)` : ''; 
        
        tableRows.push([
            f.cavalo || '-',
            `${frotaTexto} ${statusTexto}`,
            (f.categoria || '-').substring(0, 8),
            "", "", "", "", ""
        ]);
    });

    doc.autoTable({
        startY: 35,
        head: [tableCols],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [4, 120, 87], halign: 'center' }, 
        styles: { fontSize: 8, cellPadding: 3, minCellHeight: 12, valign: 'middle' },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 18, halign: 'center' },
            1: { cellWidth: 26, halign: 'center' },
            2: { cellWidth: 16, halign: 'center' },
            3: { cellWidth: 18 },
            4: { cellWidth: 12 },
            5: { cellWidth: 32 },
            6: { cellWidth: 25 }
        },
        margin: { left: 10, right: 10 } 
    });

    doc.save(`Ficha_Avulsa_Borracharia_${categoria}_${new Date().getTime()}.pdf`);
    fecharModalFichaBorracharia();
};


// ==============================================================================
// GERAÇÃO DO LIVRO MENSAL OFICIAL (CAPA, 2 LINHAS/VEÍCULO, CONTRA-CAPA)
// ==============================================================================
window.gerarLivroBorrachariaPDF = function() {
    const categoria = document.getElementById('livroCategoria').value;
    const mesAno = document.getElementById('livroMesAno').value; 

    if (!categoria || !mesAno) return alert('Selecione a categoria e o mês de referência.');

    const [ano, mesNum] = mesAno.split('-');
    const mesesExtenso = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const nomeMes = mesesExtenso[parseInt(mesNum) - 1].toUpperCase();

    const frotasCategoria = (window.frotasManutencao || []).filter(f => {
        const catBanco = f.categoria ? f.categoria.trim().toUpperCase() : '';
        const catFiltro = categoria.trim().toUpperCase();
        if (catFiltro === 'TODAS') return true;
        return catBanco === catFiltro;
    });

    if (frotasCategoria.length === 0) {
        alert('Nenhum veículo encontrado para a seleção no mês especificado.');
        return;
    }

    frotasCategoria.sort((a, b) => (a.numero_frota || a.cavalo).localeCompare(b.numero_frota || b.cavalo));

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF(); // A4 Vertical

    const logoUrl = 'assets/logoverde.png';
    const img = new Image();

    // Carrega a imagem do logo em base64 (Canvas) para injetar no PDF
    img.onload = () => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const logoDataUrl = canvas.toDataURL('image/png');
            montarEstruturaLivro(doc, logoDataUrl, frotasCategoria, categoria, nomeMes, ano);
        } catch(e) {
            console.warn("Segurança do navegador bloqueou a imagem local. Gerando livro sem logo.");
            montarEstruturaLivro(doc, null, frotasCategoria, categoria, nomeMes, ano);
        }
    };
    img.onerror = () => {
        montarEstruturaLivro(doc, null, frotasCategoria, categoria, nomeMes, ano);
    };
    img.src = logoUrl;
};

// Função Interna que desenha o Livro no PDF
function montarEstruturaLivro(doc, logoDataUrl, frotas, categoria, nomeMes, ano) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // ================= PÁGINA 1: CAPA =================
    if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', pageWidth - 55, 15, 40, 13);
    }

    // Borda elegante da Capa
    doc.setLineWidth(1.5);
    doc.rect(10, 10, pageWidth - 20, pageHeight - 20);
    doc.setLineWidth(0.5);
    doc.rect(12, 12, pageWidth - 24, pageHeight - 24);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(30);
    doc.text("LIVRO DE CONTROLE", pageWidth / 2, 110, { align: "center" });
    doc.text("MENSAL DE BORRACHARIA", pageWidth / 2, 125, { align: "center" });

    doc.setFontSize(16);
    doc.setFont("helvetica", "normal");
    doc.text(`MÊS REFERÊNCIA: ${nomeMes} / ${ano}`, pageWidth / 2, 150, { align: "center" });
    doc.text(`CATEGORIA: ${categoria === 'TODAS' ? 'FROTA GERAL' : categoria}`, pageWidth / 2, 160, { align: "center" });

    doc.line(50, 240, pageWidth - 50, 240);
    doc.setFontSize(12);
    doc.text("Assinatura do Borracheiro / Responsável Tático", pageWidth / 2, 248, { align: "center" });

    // ================= PÁGINAS INTERNAS: TABELAS =================
    doc.addPage();

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`LIVRO DE REGISTROS - MÊS: ${nomeMes}/${ano}`, 10, 15);
    
    if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', pageWidth - 40, 10, 30, 10);
    }

    const tableCols = ["Placa", "Frota/Status", "Categ.", "Data", "Lbs", "Troca (Posição)", "Assinatura", "Obs."];
    const tableRows = [];

    // O Livro gera 2 linhas em branco para o mesmo caminhão para permitir registros quinzenais no mesmo mês
    frotas.forEach(f => {
        const frotaTexto = f.numero_frota || '-';
        const statusTexto = f.status ? `(${f.status.substring(0, 4)}.)` : '';
        const cat = (f.categoria || '-').substring(0, 8);

        tableRows.push([f.cavalo || '-', `${frotaTexto} ${statusTexto}`, cat, "", "", "", "", ""]);
        tableRows.push([{ content: "", colSpan: 3 }, "", "", "", "", ""]); // Linha vazia de extensão
    });

    doc.autoTable({
        startY: 25,
        head: [tableCols],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [4, 120, 87], halign: 'center' },
        styles: { fontSize: 8, cellPadding: 3, minCellHeight: 12, valign: 'middle' },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 18, halign: 'center' },
            1: { cellWidth: 26, halign: 'center' },
            2: { cellWidth: 16, halign: 'center' },
            3: { cellWidth: 18 },
            4: { cellWidth: 12 },
            5: { cellWidth: 32 },
            6: { cellWidth: 25 }
        },
        margin: { left: 10, right: 10, bottom: 20 },
        didParseCell: function(data) {
            // Suaviza a linha divisória entre o caminhão e sua linha extra no livro
            if (data.row.index % 2 !== 0 && data.section === 'body') {
                data.cell.styles.fillColor = [250, 250, 250];
            }
        }
    });

    // ================= ÚLTIMA PÁGINA: CONTRA-CAPA =================
    doc.addPage();
    doc.setLineWidth(1.5);
    doc.rect(10, 10, pageWidth - 20, pageHeight - 20);
    doc.setLineWidth(0.5);
    doc.rect(12, 12, pageWidth - 24, pageHeight - 24);

    if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', pageWidth - 55, 15, 40, 13);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.text("FECHAMENTO DO MÊS", pageWidth / 2, 110, { align: "center" });

    doc.setFontSize(16);
    doc.setFont("helvetica", "normal");
    doc.text(`Referência: ${nomeMes} / ${ano}`, pageWidth / 2, 130, { align: "center" });
    doc.text("Atesto que as informações registradas nestas folhas", pageWidth / 2, 145, { align: "center" });
    doc.text("foram conferidas e transferidas para o sistema digital.", pageWidth / 2, 153, { align: "center" });

    doc.line(50, 230, pageWidth - 50, 230);
    doc.setFontSize(12);
    doc.text("Assinatura do Gestor de Manutenção / CCOL", pageWidth / 2, 238, { align: "center" });

    doc.save(`Livro_Mensal_Borracharia_${categoria}_${nomeMes}_${ano}.pdf`);
    
    // Fecha o Modal via escopo window
    if (typeof window.fecharModalLivroBorracharia === 'function') {
        window.fecharModalLivroBorracharia();
    }
}