// ==========================================
// js/jornadas/jornadas_exportacao.js
// ==========================================

// ==========================================
// EXPORTAÇÃO PARA EXCEL/CSV (COM MODAL E NOVAS COLUNAS)
// ==========================================

// 1. Abre o Modal quando clica no botão principal de exportar
document.getElementById('btnExportarJornada').addEventListener('click', () => {
    const modal = document.getElementById('modalExportacao');
    if (modal) {
        const filtroStatus = document.getElementById('exportStatusFilter').value;
        
        // Lista exata das colunas que NÃO devem aparecer se for infração
        const colunasOcultar = ["H. Noturnas", "H. Extras (Soma)", "T. Trabalho (h)", "T. Direção (h)", "Refeição (h)", "Repouso (h)"];
        
        // Oculta/Mostra as colunas no modal com base no filtro
        document.querySelectorAll('.chk-coluna').forEach(chk => {
            const label = chk.closest('label');
            if (filtroStatus === 'INFRACAO' && colunasOcultar.includes(chk.value)) {
                label.style.display = 'none'; // Esconde a opção
                chk.checked = false;          // Desmarca a opção
            } else {
                label.style.display = 'flex'; // Mostra a opção
                chk.checked = true;           // Por padrão, deixa marcada
            }
        });
        
        // Reseta o checkbox 'Selecionar Todas' para checked
        const chkSelecionarTodas = document.getElementById('chkSelecionarTodasColunas');
        if(chkSelecionarTodas) chkSelecionarTodas.checked = true;

        modal.classList.remove('hidden');
    } else {
        alert("Interface de opções de exportação não encontrada!");
    }
});

// 2. Lógica dos Checkboxes do Modal
const chkSelecionarTodas = document.getElementById('chkSelecionarTodasColunas');
const chkColunas = document.querySelectorAll('.chk-coluna');

if (chkSelecionarTodas) {
    chkSelecionarTodas.addEventListener('change', (e) => {
        chkColunas.forEach(chk => {
            // Apenas altera o estado das colunas que estão visíveis na tela
            if (chk.closest('label').style.display !== 'none') {
                chk.checked = e.target.checked;
            }
        });
    });
}

chkColunas.forEach(chk => {
    chk.addEventListener('change', () => {
        // Verifica apenas as colunas que estão visíveis na tela
        const visiveis = Array.from(chkColunas).filter(c => c.closest('label').style.display !== 'none');
        const todasMarcadas = visiveis.every(c => c.checked);
        if (chkSelecionarTodas) chkSelecionarTodas.checked = todasMarcadas;
    });
});

// 3. Funções de Fechar o Modal
const fecharModalExportacao = () => {
    document.getElementById('modalExportacao')?.classList.add('hidden');
};

document.getElementById('btnFecharModalExportacao')?.addEventListener('click', fecharModalExportacao);
document.getElementById('btnCancelarExportacao')?.addEventListener('click', fecharModalExportacao);


// 4. Lógica de Confirmação e Geração do Excel
document.getElementById('btnConfirmarExportacao')?.addEventListener('click', () => {
    const filtroStatus = document.getElementById('exportStatusFilter').value;
    
    let dadosExportar = jornadasGlobalData.filter(d => {
        const isEstouro = (d.total_trabalho_horas || 0) > 12;
        if (filtroStatus === 'OK' && isEstouro) return false;
        if (filtroStatus === 'INFRACAO' && !isEstouro) return false;
        return true;
    });

    if (dadosExportar.length === 0) {
        alert("Nenhum dado para exportar com este filtro de status.");
        fecharModalExportacao();
        return;
    }

    // Identificar quais colunas foram marcadas no Modal
    let colunasSelecionadas = Array.from(document.querySelectorAll('.chk-coluna:checked')).map(chk => chk.value);

    // GARANTIA EXTRA: Remove definitivamente do Excel se for infração (mesmo que estivessem marcadas)
    if (filtroStatus === 'INFRACAO') {
        const colunasOcultar = ["H. Noturnas", "H. Extras (Soma)", "T. Trabalho (h)", "T. Direção (h)", "Refeição (h)", "Repouso (h)"];
        colunasSelecionadas = colunasSelecionadas.filter(col => !colunasOcultar.includes(col));
    }

    if (colunasSelecionadas.length === 0) {
        alert("Selecione pelo menos uma coluna para exportar.");
        return;
    }

    // Ordenação Crescente (Mais antigo para o mais recente)
    dadosExportar.sort((a, b) => obterDataHoraParaOrdenacao(a.inicio) - obterDataHoraParaOrdenacao(b.inicio));

    const wsDados = dadosExportar.map(d => {
        let dI = '-', hI = '-', dF = '-', hF = '-';
        if (d.inicio) {
            const mD = d.inicio.match(regexDate); const mT = d.inicio.match(regexTime);
            if (mD) { dI = mD[0]; if (dI.length <= 5) dI += '/' + new Date().getFullYear(); }
            if (mT) hI = mT[0]; if (!mD && !mT) hI = d.inicio;
        }
        if (d.fim) {
            const mDF = d.fim.match(regexDate); const mTF = d.fim.match(regexTime);
            if (mDF) { dF = mDF[0]; if (dF.length <= 5) dF += '/' + new Date().getFullYear(); } else dF = dI;
            if (mTF) hF = mTF[0]; else hF = d.fim.replace(regexDate, '').replace('-', '').trim() || d.fim;
        }
        
        const valSemana = d.semana || (typeof calcularSemanaDoMes === 'function' ? calcularSemanaDoMes(dI) : '-');
        
        const linhaCompleta = {
            "Motorista": d.motorista, 
            "EPS": d.eps || 'SERRANALOG - BA',
            "Placa": d.placa || '-',
            "Unidade": d.unidade || 'BA',
            "Semana": valSemana,
            "Data Início": dI, 
            "Hora Início": hI, 
            "Data Fim": dF, 
            "Hora Fim": hF,
            "H. Noturnas": formatarHorasMinutos(d.horas_noturnas), 
            "H. Extras (Soma)": formatarHorasMinutos(d.horas_extras),
            "T. Trabalho (h)": d.total_trabalho_horas, 
            "T. Direção (h)": d.direcao_horas, 
            "Refeição (h)": d.refeicao_horas, 
            "Repouso (h)": d.repouso_horas,
            "Tempo Excedido": formatarHorasMinutos(Math.max(0, (d.total_trabalho_horas || 0) - 12)),
            "Status": d.total_trabalho_horas > 12 ? 'INFRAÇÃO' : 'OK',
            "Auditado": d.auditado ? 'Sim' : (d.total_trabalho_horas > 12 ? 'Pendente' : '-'),
            "Motivo Auditoria": d.observacao_auditoria || '-',
            "EXPURGAR": (d.expurgar === true || d.expurgado === true) ? 'Sim' : 'Não', 
            "RESPONSÁVEL - SUZANO": "" 
        };

        const linhaFiltrada = {};
        colunasSelecionadas.forEach(col => {
            if (linhaCompleta[col] !== undefined) {
                linhaFiltrada[col] = linhaCompleta[col];
            }
        });
        return linhaFiltrada;
    });

    try {
        const ws = XLSX.utils.json_to_sheet(wsDados);

        // ==== INÍCIO DA FORMATAÇÃO (ESTILOS E LARGURA) ====
        
        // 1. Ajustar a largura das colunas dinamicamente para não ficar bagunçado
        const colWidths = Object.keys(wsDados[0] || {}).map(key => ({ 
            wch: Math.max(16, key.length + 4) // No mínimo 16 de largura para ficar bem espaçado
        }));
        ws['!cols'] = colWidths;

        // 2. Aplicar alinhamento centralizado e cor no cabeçalho
        for (let key in ws) {
            // Ignorar as propriedades ocultas do SheetJS (como !cols, !ref, etc)
            if (key.startsWith('!')) continue;
            
            // Verifica se a célula atual pertence à linha 1 (Cabeçalho)
            const isHeader = key.replace(/[A-Z]/g, '') === '1';
            
            // Centralizar o conteúdo de todas as células
            ws[key].s = {
                alignment: { horizontal: "center", vertical: "center" }
            };

            // Se for cabeçalho, coloca fundo azul claro e texto em negrito
            if (isHeader) {
                ws[key].s.fill = {
                    patternType: "solid",
                    fgColor: { rgb: "ADD8E6" } // Azul Claro
                };
                ws[key].s.font = {
                    bold: true,
                    color: { rgb: "000000" }
                };
            }
        }
        // ==== FIM DA FORMATAÇÃO ====

        const wb = XLSX.utils.book_new(); 
        XLSX.utils.book_append_sheet(wb, ws, "Jornadas");
        XLSX.writeFile(wb, `SerranaLog_Jornadas_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (err) {
        console.error("Erro ao gerar Excel:", err);
        alert("Ocorreu um erro ao gerar o arquivo Excel. Verifique o console.");
    }
    
    fecharModalExportacao();
});


// ==========================================
// EXPORTAÇÃO PARA PDF
// ==========================================
document.getElementById('btnExportarPDFJornada')?.addEventListener('click', () => {
    const filtroStatus = document.getElementById('exportStatusFilter').value;
    
    let dadosExportar = jornadasGlobalData.filter(d => {
        const isEstouro = (d.total_trabalho_horas || 0) > 12;
        if (filtroStatus === 'OK' && isEstouro) return false;
        if (filtroStatus === 'INFRACAO' && !isEstouro) return false;
        return true;
    });

    if (dadosExportar.length === 0) return alert("Nenhum dado para exportar com este filtro de status.");

    // Ordenação Crescente (Mais antigo para o mais recente)
    dadosExportar.sort((a, b) => obterDataHoraParaOrdenacao(a.inicio) - obterDataHoraParaOrdenacao(b.inicio));

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');

    const colunas = [
        "Motorista", "Placa", "Data/Hora Início", "Data/Hora Fim", 
        "H. Noturnas", "H. Extras", "T. Trabalho", "T. Excedido", "Status"
    ];
    
    const linhas = [];
    dadosExportar.forEach(d => {
        let dI = '-', hI = '-', dF = '-', hF = '-';
        
        if (d.inicio) {
            const mD = d.inicio.match(regexDate); const mT = d.inicio.match(regexTime);
            if (mD) { dI = mD[0]; if (dI.length <= 5) dI += '/' + new Date().getFullYear(); }
            if (mT) hI = mT[0]; if (!mD && !mT) hI = d.inicio;
        }
        if (d.fim) {
            const mDF = d.fim.match(regexDate); const mTF = d.fim.match(regexTime);
            if (mDF) { dF = mDF[0]; if (dF.length <= 5) dF += '/' + new Date().getFullYear(); } else dF = dI;
            if (mTF) hF = mTF[0]; else hF = d.fim.replace(regexDate, '').replace('-', '').trim() || d.fim;
        }

        const isEstouro = (d.total_trabalho_horas || 0) > 12;
        const statusTexto = isEstouro ? 'INFRAÇÃO' : 'OK';
        
        const totalHoras = d.total_trabalho_horas || 0;
        const excedido = Math.max(0, totalHoras - 12);

        linhas.push([
            d.motorista || '-',
            d.placa || '-',
            `${dI} às ${hI}`,
            `${dF} às ${hF}`,
            formatarHorasMinutos(d.horas_noturnas || 0),
            formatarHorasMinutos(d.horas_extras || 0),
            formatarHorasMinutos(totalHoras),
            formatarHorasMinutos(excedido),
            statusTexto
        ]);
    });

    let dataReferencia = document.getElementById('jorDataReferencia').textContent;
    let textoFiltro = "Todos os Status";
    if (filtroStatus === 'OK') textoFiltro = "Apenas registros OK (<= 12h)";
    if (filtroStatus === 'INFRACAO') textoFiltro = "Apenas Infrações (> 12h)";

    doc.setFontSize(16);
    doc.text("Relatório Analítico de Jornadas", 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`${dataReferencia} | Exibindo: ${textoFiltro}`, 14, 22);

    doc.autoTable({
        head: [colunas],
        body: linhas,
        startY: 28, 
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] }, 
        styles: { fontSize: 8, cellPadding: 2 },
        didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 8) {
                if (data.cell.raw === 'INFRAÇÃO') {
                    data.cell.styles.textColor = [220, 38, 38]; 
                    data.cell.styles.fontStyle = 'bold';
                } else {
                    data.cell.styles.textColor = [16, 185, 129]; 
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        }
    });

    const btnGerarGeral = document.getElementById('btnExportarPDFJornada');
    const textOriginalBtn = btnGerarGeral.innerHTML;
    btnGerarGeral.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Baixando...';
    btnGerarGeral.disabled = true;

    const img = new Image();
    img.src = 'assets/logoverde.png';
    
    img.onload = () => {
        const pageWidth = doc.internal.pageSize.getWidth();
        doc.addImage(img, 'PNG', pageWidth - 45, 10, 32, 12);

        doc.save(`SerranaLog_Jornadas_${filtroStatus}_${new Date().toISOString().slice(0,10)}.pdf`);
        btnGerarGeral.innerHTML = textOriginalBtn;
        btnGerarGeral.disabled = false;
    };
    
    img.onerror = () => {
        doc.save(`SerranaLog_Jornadas_${filtroStatus}_${new Date().toISOString().slice(0,10)}.pdf`);
        btnGerarGeral.innerHTML = textOriginalBtn;
        btnGerarGeral.disabled = false;
    };
});