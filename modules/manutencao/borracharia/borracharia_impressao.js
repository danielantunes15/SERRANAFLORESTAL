// ==================== modules/manutencao/borracharia/borracharia_impressao.js ====================

window.abrirModalFichaBorracharia = function() {
    document.getElementById('modalFichaBorracharia').style.display = 'flex';
}
window.fecharModalFichaBorracharia = function() {
    document.getElementById('modalFichaBorracharia').style.display = 'none';
}

// ==============================================================================
// FUNÇÃO AUXILIAR: CARREGAR A LOGO PARA O PDF
// ==============================================================================
function carregarLogoBorracharia(callback) {
    const logoUrl = 'assets/logoverde.png';
    const img = new Image();
    img.onload = () => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            callback(canvas.toDataURL('image/png'));
        } catch(e) {
            console.warn("Segurança do navegador bloqueou a imagem local. PDF sairá sem logo.");
            callback(null);
        }
    };
    img.onerror = () => callback(null);
    img.src = logoUrl;
}

// ==============================================================================
// GERAÇÃO DA FICHA SIMPLES (AVULSA)
// ==============================================================================
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

    carregarLogoBorracharia((logoDataUrl) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF(); // Padrão A4 Retrato (Vertical)

        const tableCols = ["Cavalo", "GO / Carretas (Marque com X)", "Data", "KM", "Lbs", "Troca", "Assinatura", "Obs."];
        const tableRows = [];

        frotasCategoria.forEach(f => {
            const implementos = [];
            if (f.go && f.go.trim() !== '') implementos.push(`[  ] ${f.go.trim()}`);
            if (f.carreta1 && f.carreta1.trim() !== '') implementos.push(`[  ] ${f.carreta1.trim()}`);
            if (f.carreta2 && f.carreta2.trim() !== '') implementos.push(`[  ] ${f.carreta2.trim()}`);
            if (f.carreta3 && f.carreta3.trim() !== '') implementos.push(`[  ] ${f.carreta3.trim()}`);
            
            let implTexto = '-';
            if (implementos.length > 0) {
                if (implementos.length > 2) {
                    // Quebra em duas linhas para ficar organizado e caber na coluna
                    implTexto = implementos.slice(0, 2).join('   ') + '\n' + implementos.slice(2).join('   ');
                } else {
                    implTexto = implementos.join('   ');
                }
            }
            
            tableRows.push([
                f.cavalo || '-',
                implTexto,
                "", "", "", "", "", ""
            ]);
        });

        // Tabela Auto-ajustável com repetição de cabeçalho em cada página
        doc.autoTable({
            startY: 40,
            head: [tableCols],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [4, 120, 87], halign: 'center' }, 
            styles: { fontSize: 8, cellPadding: 3, minCellHeight: 11, valign: 'middle' },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 16, halign: 'center' }, // Cavalo
                1: { cellWidth: 48, halign: 'center', fontSize: 7.5 }, // GO / Carretas
                2: { cellWidth: 16, halign: 'center' }, // Data
                3: { cellWidth: 15, halign: 'center' }, // KM
                4: { cellWidth: 10, halign: 'center' }, // Lbs
                5: { cellWidth: 28 }, // Troca
                6: { cellWidth: 25 }  // Assinatura
                // Coluna 7 (Obs) pega o resto do papel
            },
            margin: { left: 10, right: 10, top: 40, bottom: 15 },
            didDrawPage: function(data) {
                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                doc.text(`FICHA AVULSA DE BORRACHARIA - ${categoria === 'TODAS' ? 'GERAL' : categoria}`, 105, 15, { align: "center" });
                
                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");
                doc.text(`Data de Impressão: ${new Date().toLocaleDateString('pt-BR')}`, 10, 25);
                doc.text(`Data do Controle a Campo: ____/____/202___`, 120, 25);
                
                doc.setFontSize(9);
                doc.text(`Instruções: Marque o [ X ] na carreta atendida. Preencha a data, KM, pressão (Lbs) e trocas.`, 10, 32);

                if (logoDataUrl) {
                    const pageWidth = doc.internal.pageSize.getWidth();
                    doc.addImage(logoDataUrl, 'PNG', pageWidth - 40, 10, 30, 10);
                }
            }
        });

        doc.save(`Ficha_Avulsa_Borracharia_${categoria}_${new Date().getTime()}.pdf`);
        fecharModalFichaBorracharia();
    });
}

// ==============================================================================
// GERAÇÃO DO LIVRO MENSAL OFICIAL (CAPA COM ASSINATURAS DINÂMICAS, FOLHAS DIÁRIAS)
// ==============================================================================
window.gerarLivroBorrachariaPDF = function() {
    const categoria = document.getElementById('livroCategoria').value;
    const mesAno = document.getElementById('livroMesAno').value; 

    if (!categoria || !mesAno) return alert('Selecione a categoria e o mês de referência.');

    const [ano, mesNum] = mesAno.split('-');
    const diasNoMes = new Date(ano, parseInt(mesNum), 0).getDate(); // Retorna o último dia do mês
    
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

    carregarLogoBorracharia((logoDataUrl) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF(); // A4 Vertical
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // ================= PÁGINA 1: CAPA =================
        if (logoDataUrl) {
            doc.addImage(logoDataUrl, 'PNG', pageWidth - 55, 15, 40, 13);
        }
        
        doc.setLineWidth(1.5);
        doc.rect(10, 10, pageWidth - 20, pageHeight - 20);
        doc.setLineWidth(0.5);
        doc.rect(12, 12, pageWidth - 24, pageHeight - 24);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(30);
        doc.text("LIVRO DE CONTROLE", pageWidth / 2, 100, { align: "center" });
        doc.text("DIÁRIO DE BORRACHARIA", pageWidth / 2, 115, { align: "center" });

        doc.setFontSize(16);
        doc.setFont("helvetica", "normal");
        doc.text(`MÊS REFERÊNCIA: ${nomeMes} / ${ano}`, pageWidth / 2, 140, { align: "center" });
        doc.text(`CATEGORIA: ${categoria === 'TODAS' ? 'FROTA GERAL' : categoria}`, pageWidth / 2, 150, { align: "center" });

        const borracheiros = window.borracheirosList || [];
        
        if (borracheiros.length > 0) {
            const maxBorracheiros = Math.min(borracheiros.length, 5); 
            const espacamento = 20; 
            let startY = 265 - (maxBorracheiros * espacamento);

            for (let i = 0; i < maxBorracheiros; i++) {
                const func = borracheiros[i];
                doc.line(50, startY, pageWidth - 50, startY);
                doc.setFontSize(11);
                doc.text(`${func.nome} (${func.funcao || 'Borracheiro'})`, pageWidth / 2, startY + 6, { align: "center" });
                startY += espacamento;
            }
        } else {
            doc.line(50, 240, pageWidth - 50, 240);
            doc.setFontSize(12);
            doc.text("Assinatura do Borracheiro / Responsável Tático", pageWidth / 2, 248, { align: "center" });
        }

        // ================= PÁGINAS INTERNAS: UM DIA POR VEZ =================
        const tableCols = ["Cavalo", "GO / Carretas (Marque com X)", "KM Atual", "Lbs", "Troca (Posição)", "Assinatura", "Obs."];
        const tableRows = [];

        frotasCategoria.forEach(f => {
            const implementos = [];
            if (f.go && f.go.trim() !== '') implementos.push(`[  ] ${f.go.trim()}`);
            if (f.carreta1 && f.carreta1.trim() !== '') implementos.push(`[  ] ${f.carreta1.trim()}`);
            if (f.carreta2 && f.carreta2.trim() !== '') implementos.push(`[  ] ${f.carreta2.trim()}`);
            if (f.carreta3 && f.carreta3.trim() !== '') implementos.push(`[  ] ${f.carreta3.trim()}`);
            
            let implTexto = '-';
            if (implementos.length > 0) {
                if (implementos.length > 2) {
                    implTexto = implementos.slice(0, 2).join('   ') + '\n' + implementos.slice(2).join('   ');
                } else {
                    implTexto = implementos.join('   ');
                }
            }
            
            tableRows.push([f.cavalo || '-', implTexto, "", "", "", "", ""]);
        });

        for (let dia = 1; dia <= diasNoMes; dia++) {
            doc.addPage();
            
            const dataFormatada = `${String(dia).padStart(2, '0')}/${mesNum}/${ano}`;

            doc.autoTable({
                startY: 35,
                head: [tableCols],
                body: tableRows,
                theme: 'grid',
                headStyles: { fillColor: [4, 120, 87], halign: 'center' },
                styles: { fontSize: 8, cellPadding: 2, minCellHeight: 11, valign: 'middle' },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 16, halign: 'center' }, // Cavalo
                    1: { cellWidth: 50, halign: 'center', fontSize: 7.5 }, // GO/Carretas com Checkbox
                    2: { cellWidth: 16, halign: 'center' }, // KM Atual
                    3: { cellWidth: 12, halign: 'center' }, // Lbs
                    4: { cellWidth: 35 }, // Trocas
                    5: { cellWidth: 30 }  // Assinatura
                    // Coluna 6 (Obs) pega o resto
                },
                margin: { left: 10, right: 10, top: 35, bottom: 15 },
                didDrawPage: function(data) {
                    doc.setFontSize(14);
                    doc.setFont("helvetica", "bold");
                    doc.text(`CONTROLE DIÁRIO - ${categoria === 'TODAS' ? 'GERAL' : categoria}`, 10, 15);
                    
                    doc.setFontSize(11);
                    doc.setFont("helvetica", "normal");
                    doc.text(`Data da Medição: ${dataFormatada}`, 10, 23);
                    doc.text(`Visto do Supervisor: _______________________`, 95, 23);

                    if (logoDataUrl) {
                        doc.addImage(logoDataUrl, 'PNG', pageWidth - 40, 10, 30, 10);
                    }
                }
            });
        }

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
        
        if (typeof window.fecharModalLivroBorracharia === 'function') {
            window.fecharModalLivroBorracharia();
        }
    });
}