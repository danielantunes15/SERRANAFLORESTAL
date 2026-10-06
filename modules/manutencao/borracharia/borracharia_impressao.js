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
// GERAÇÃO DA FICHA SIMPLES (AVULSA) - ATUALIZADA PARA LUBRIFICAÇÃO
// ==============================================================================
window.gerarPDFBorracharia = function() {
    const categoria = document.getElementById('printFichaCategoria').value;
    if (!categoria) return alert('Selecione uma categoria.');

    const frotasCategoria = (window.frotasManutencao || []).filter(f => {
        const catBanco = f.categoria ? f.categoria.trim().toUpperCase() : '';
        const catFiltro = categoria.trim().toUpperCase();
        if (catFiltro === 'TODAS') return true;
        if (catFiltro === 'TRITREM E CARRETA') {
            return catBanco === 'TRITREM' || catBanco === 'CARRETA';
        }
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

        const tableCols = ["Frota (Cavalo)", "Placas / Implementos", "Data", "Status", "Lubrificação"];
        const tableRows = [];

        frotasCategoria.forEach(f => {
            // Formatação Padrão: 4 Partes (Apenas Placas: Cavalo + 3 Carretas, Ocultando o GO)
            let p1 = f.cavalo || '-------';
            let p2 = f.carreta1 || '-------';
            let p3 = f.carreta2 || '-------';
            let p4 = f.carreta3 || '-------';
            
            let implTexto = `[  ] ${p1}\n\n[  ] ${p2}\n\n[  ] ${p3}\n\n[  ] ${p4}`;
            let espacosData = `___/___/___ \n\n___/___/___ \n\n___/___/___ \n\n___/___/___ `;
            
            tableRows.push([
                f.cavalo || '-',
                implTexto,
                espacosData, 
                " \n \n \n ", // Status
                " \n \n \n "  // Lubrificação
            ]);
        });

        // Tabela Auto-ajustável com repetição de cabeçalho em cada página
        doc.setLineWidth(0.2); // Previne bordas grossas herdadas
        doc.autoTable({
            startY: 40,
            head: [tableCols],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [4, 120, 87], halign: 'center' }, 
            styles: { fontSize: 8, cellPadding: 3, minCellHeight: 15, valign: 'middle' },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 25, halign: 'center' }, 
                1: { cellWidth: 60, halign: 'left', fontSize: 7.5 },     
                2: { cellWidth: 25, halign: 'center' },                    
                3: { cellWidth: 30, halign: 'center' }                     
                // Coluna 4 (Lubrificação) pega o resto do papel para anotações livres
            },
            margin: { left: 10, right: 10, top: 40, bottom: 15 },
            didDrawPage: function(data) {
                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                doc.text(`FICHA DE LUBRIFICAÇÃO E CONTROLE - ${categoria === 'TODAS' ? 'GERAL' : categoria}`, 105, 15, { align: "center" });
                
                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");
                doc.text(`Data de Impressão: ${new Date().toLocaleDateString('pt-BR')}`, 10, 25);
                doc.text(`Data do Controle a Campo: ____/____/202___`, 120, 25);
                
                doc.setFontSize(9);
                doc.text(`Instruções: Marque o [ X ] na carreta atendida. Preencha a data, status e os detalhes da lubrificação.`, 10, 32);

                if (logoDataUrl) {
                    const pageWidth = doc.internal.pageSize.getWidth();
                    doc.addImage(logoDataUrl, 'PNG', pageWidth - 40, 10, 30, 10);
                }
            }
        });

        doc.save(`Ficha_Lubrificacao_${categoria}_${new Date().getTime()}.pdf`);
        fecharModalFichaBorracharia();
    });
}

// ==============================================================================
// GERAÇÃO DO LIVRO MENSAL DE LUBRIFICAÇÃO (HORIZONTAL, 10 CICLOS POR MÊS)
// ==============================================================================
window.abrirModalLivroLubrificacao = function() {
    const inputMes = document.getElementById('livroLubrificacaoMesAno');
    if (inputMes) {
        const agora = new Date();
        inputMes.value = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
    }
    document.getElementById('modalLivroLubrificacao').style.display = 'flex';
}

window.fecharModalLivroLubrificacao = function() { 
    document.getElementById('modalLivroLubrificacao').style.display = 'none'; 
};

window.gerarLivroLubrificacaoPDF = function() {
    const categoria = document.getElementById('livroLubrificacaoCategoria').value;
    const mesAno = document.getElementById('livroLubrificacaoMesAno').value; 

    if (!categoria || !mesAno) return alert('Selecione a categoria e o mês de referência.');

    const [ano, mesNum] = mesAno.split('-');
    const mesesExtenso = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const nomeMes = mesesExtenso[parseInt(mesNum) - 1].toUpperCase();

    const frotasCategoria = (window.frotasManutencao || []).filter(f => {
        const catBanco = f.categoria ? f.categoria.trim().toUpperCase() : '';
        const catFiltro = categoria.trim().toUpperCase();
        if (catFiltro === 'TODAS') return true;
        if (catFiltro === 'TRITREM E CARRETA') {
            return catBanco === 'TRITREM' || catBanco === 'CARRETA';
        }
        return catBanco === catFiltro;
    });

    if (frotasCategoria.length === 0) {
        alert('Nenhum veículo encontrado para a seleção no mês especificado.');
        return;
    }

    frotasCategoria.sort((a, b) => (a.numero_frota || a.cavalo).localeCompare(b.numero_frota || b.cavalo));

    carregarLogoBorracharia((logoDataUrl) => {
        const { jsPDF } = window.jspdf;
        // Definindo o PDF em formato 'landscape' (Paisagem) para caber os 10 ciclos
        const doc = new jsPDF({ orientation: 'landscape' }); 
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
        doc.text("LIVRO DE CONTROLE DE LUBRIFICAÇÃO", pageWidth / 2, 80, { align: "center" });

        doc.setFontSize(16);
        doc.setFont("helvetica", "normal");
        doc.text(`MÊS REFERÊNCIA: ${nomeMes} / ${ano}`, pageWidth / 2, 110, { align: "center" });
        doc.text(`CATEGORIA: ${categoria === 'TODAS' ? 'FROTA GERAL' : categoria}`, pageWidth / 2, 120, { align: "center" });
        
        doc.setFontSize(14);
        doc.text("Frequência de Lubrificação: A cada 3 dias (10 ciclos no mês)", pageWidth / 2, 135, { align: "center" });

        // ================= PÁGINA 2: PLANILHA DE CICLOS (PAISAGEM) =================
        doc.addPage();
        
        const tableCols = ["Frota (Cavalo)", "Placas / Implementos", "1º", "2º", "3º", "4º", "5º", "6º", "7º", "8º", "9º", "10º"];
        const tableRows = [];

        frotasCategoria.forEach(f => {
            // Formatação Padrão: 4 Partes (Apenas Placas: Cavalo + 3 Carretas, Ocultando o GO)
            let p1 = f.cavalo || '-------';
            let p2 = f.carreta1 || '-------';
            let p3 = f.carreta2 || '-------';
            let p4 = f.carreta3 || '-------';
            
            let implTexto = `[  ] ${p1}\n\n[  ] ${p2}\n\n[  ] ${p3}\n\n[  ] ${p4}`;
            // 4 espaços de linhas de datas por coluna com espaçamento para evitar colisão vertical
            let espacosData = `___/___ \n\n___/___ \n\n___/___ \n\n___/___ `;
            
            tableRows.push([
                f.cavalo || '-',
                implTexto,
                espacosData, espacosData, espacosData, espacosData, espacosData, 
                espacosData, espacosData, espacosData, espacosData, espacosData
            ]);
        });

        doc.setLineWidth(0.2); // Previne bordas grossas herdadas da capa
        doc.autoTable({
            startY: 35,
            head: [tableCols],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [14, 165, 233], halign: 'center' }, // Azul claro
            styles: { fontSize: 7, cellPadding: 2, minCellHeight: 18, valign: 'middle' },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 20, halign: 'center' },
                1: { cellWidth: 35, fontSize: 6.5, halign: 'left' },
                2: { halign: 'center', fontSize: 6.5 },
                3: { halign: 'center', fontSize: 6.5 },
                4: { halign: 'center', fontSize: 6.5 },
                5: { halign: 'center', fontSize: 6.5 },
                6: { halign: 'center', fontSize: 6.5 },
                7: { halign: 'center', fontSize: 6.5 },
                8: { halign: 'center', fontSize: 6.5 },
                9: { halign: 'center', fontSize: 6.5 },
                10: { halign: 'center', fontSize: 6.5 },
                11: { halign: 'center', fontSize: 6.5 }
            },
            margin: { left: 10, right: 10, top: 35, bottom: 15 },
            didDrawPage: function(data) {
                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                doc.text(`CONTROLE MENSAL DE LUBRIFICAÇÃO (A CADA 3 DIAS) - ${categoria === 'TODAS' ? 'GERAL' : categoria}`, 10, 15);
                
                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");
                doc.text(`Mês: ${nomeMes} / ${ano}`, 10, 23);
                doc.text(`Instruções: Anote o DIA do atendimento e ASSINE em cada quadrado executado.`, 10, 28);

                if (logoDataUrl) doc.addImage(logoDataUrl, 'PNG', pageWidth - 40, 10, 30, 10);
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
        doc.text("FECHAMENTO DO MÊS - LUBRIFICAÇÃO", pageWidth / 2, 80, { align: "center" });

        doc.setFontSize(16);
        doc.setFont("helvetica", "normal");
        doc.text(`Referência: ${nomeMes} / ${ano}`, pageWidth / 2, 100, { align: "center" });
        
        doc.text("Atesto que as informações de lubrificação registradas nestas", pageWidth / 2, 120, { align: "center" });
        doc.text("folhas foram conferidas e transferidas para o sistema digital.", pageWidth / 2, 128, { align: "center" });

        doc.line(pageWidth / 2 - 50, 180, pageWidth / 2 + 50, 180);
        doc.setFontSize(12);
        doc.text("Assinatura do Gestor / Encarregado de Lubrificação", pageWidth / 2, 188, { align: "center" });

        doc.save(`Livro_Mensal_Lubrificacao_${categoria}_${nomeMes}_${ano}.pdf`);
        
        if (typeof window.fecharModalLivroLubrificacao === 'function') {
            window.fecharModalLivroLubrificacao();
        }
    });
}


// ==============================================================================
// GERAÇÃO DO LIVRO MENSAL DE BORRACHARIA (DIÁRIO OFICIAL)
// ==============================================================================
window.abrirModalLivroBorracharia = function() {
    const inputMes = document.getElementById('livroMesAno');
    if (inputMes) {
        const agora = new Date();
        inputMes.value = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
    }
    document.getElementById('modalLivroBorracharia').style.display = 'flex';
}
window.fecharModalLivroBorracharia = function() { document.getElementById('modalLivroBorracharia').style.display = 'none'; };

window.gerarLivroBorrachariaPDF = function() {
    const categoria = document.getElementById('livroCategoria').value;
    const mesAno = document.getElementById('livroMesAno').value; 

    if (!categoria || !mesAno) return alert('Selecione a categoria e o mês de referência.');

    const [ano, mesNum] = mesAno.split('-');
    const diasNoMes = new Date(ano, parseInt(mesNum), 0).getDate(); 
    
    const mesesExtenso = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const nomeMes = mesesExtenso[parseInt(mesNum) - 1].toUpperCase();

    const frotasCategoria = (window.frotasManutencao || []).filter(f => {
        const catBanco = f.categoria ? f.categoria.trim().toUpperCase() : '';
        const catFiltro = categoria.trim().toUpperCase();
        if (catFiltro === 'TODAS') return true;
        if (catFiltro === 'TRITREM E CARRETA') {
            return catBanco === 'TRITREM' || catBanco === 'CARRETA';
        }
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
        const tableCols = ["Cavalo", "Placas / Implementos", "KM Atual", "Lbs", "Troca (Posição)", "Assinatura", "Obs."];
        const tableRows = [];

        frotasCategoria.forEach(f => {
            // Formatação Padrão: 4 Partes (Apenas Placas: Cavalo + 3 Carretas, Ocultando o GO)
            let p1 = f.cavalo || '-------';
            let p2 = f.carreta1 || '-------';
            let p3 = f.carreta2 || '-------';
            let p4 = f.carreta3 || '-------';
            
            let implTexto = `[  ] ${p1}\n\n[  ] ${p2}\n\n[  ] ${p3}\n\n[  ] ${p4}`;
            
            tableRows.push([
                f.cavalo || '-', 
                implTexto, 
                " \n \n \n ", // KM
                " \n \n \n ", // Lbs
                " \n \n \n ", // Troca
                " \n \n \n ", // Assinatura
                " \n \n \n "  // Obs
            ]);
        });

        doc.setLineWidth(0.2); // Previne bordas grossas herdadas da capa
        for (let dia = 1; dia <= diasNoMes; dia++) {
            if(dia > 1) doc.addPage();
            
            const dataFormatada = `${String(dia).padStart(2, '0')}/${mesNum}/${ano}`;

            doc.autoTable({
                startY: 35,
                head: [tableCols],
                body: tableRows,
                theme: 'grid',
                headStyles: { fillColor: [4, 120, 87], halign: 'center' },
                styles: { fontSize: 8, cellPadding: 2, minCellHeight: 15, valign: 'middle' },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 16, halign: 'center' }, 
                    1: { cellWidth: 50, halign: 'left', fontSize: 7.5 }, 
                    2: { cellWidth: 16, halign: 'center' }, 
                    3: { cellWidth: 12, halign: 'center' }, 
                    4: { cellWidth: 35 }, 
                    5: { cellWidth: 30 }  
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