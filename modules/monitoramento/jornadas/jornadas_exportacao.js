// ==========================================
// js/jornadas/jornadas_exportacao.js
// ==========================================

// Usando delegação de eventos para garantir que funcione perfeitamente em um sistema SPA
// onde os botões podem ser carregados na tela depois que o script já rodou.

document.addEventListener('click', (e) => {
    // 1. ABRIR MODAL DE EXPORTAÇÃO (EXCEL)
    const btnExportarJor = e.target.closest('#btnExportarJornada');
    if (btnExportarJor) {
        e.preventDefault();
        const modal = document.getElementById('modalExportacao');
        if (modal) {
            const exportStatusFilter = document.getElementById('exportStatusFilter');
            const filtroStatus = exportStatusFilter ? exportStatusFilter.value : 'ALL';
            
            const colunasOcultar = ["H. Noturnas", "H. Extras (Soma)", "T. Trabalho (h)", "T. Direção (h)", "Refeição (h)", "Repouso (h)"];
            
            document.querySelectorAll('.chk-coluna').forEach(chk => {
                const label = chk.closest('label');
                if (filtroStatus === 'INFRACAO' && colunasOcultar.includes(chk.value)) {
                    label.style.display = 'none'; 
                    chk.checked = false;          
                } else {
                    label.style.display = 'flex'; 
                    chk.checked = true;           
                }
            });
            
            const chkSelecionarTodas = document.getElementById('chkSelecionarTodasColunas');
            if(chkSelecionarTodas) chkSelecionarTodas.checked = true;

            modal.classList.remove('hidden');
        } else {
            alert("Aviso: Interface (Modal) de opções de exportação não encontrada no HTML!");
        }
        return;
    }

    // 2. FECHAR MODAL DE EXPORTAÇÃO
    if (e.target.closest('#btnFecharModalExportacao') || e.target.closest('#btnCancelarExportacao')) {
        e.preventDefault();
        document.getElementById('modalExportacao')?.classList.add('hidden');
        return;
    }

    // 3. CONFIRMAR EXPORTAÇÃO (EXCEL)
    const btnConfirmarExportacao = e.target.closest('#btnConfirmarExportacao');
    if (btnConfirmarExportacao) {
        e.preventDefault();
        gerarExcelJornadas();
        return;
    }

    // 4. EXPORTAR PDF (DIRETO)
    const btnExportarPDFJornada = e.target.closest('#btnExportarPDFJornada');
    if (btnExportarPDFJornada) {
        e.preventDefault();
        gerarPDFJornadas(btnExportarPDFJornada);
        return;
    }
});

// Eventos de mudança (Change) para os Checkboxes do Modal
document.addEventListener('change', (e) => {
    // Marcar/Desmarcar Todas as Colunas
    if (e.target.id === 'chkSelecionarTodasColunas') {
        const chkColunas = document.querySelectorAll('.chk-coluna');
        chkColunas.forEach(chk => {
            if (chk.closest('label').style.display !== 'none') {
                chk.checked = e.target.checked;
            }
        });
        return;
    }

    // Checkbox individual de coluna (verifica se todas foram marcadas para atualizar o principal)
    if (e.target.classList.contains('chk-coluna')) {
        const chkSelecionarTodas = document.getElementById('chkSelecionarTodasColunas');
        const chkColunas = document.querySelectorAll('.chk-coluna');
        const visiveis = Array.from(chkColunas).filter(c => c.closest('label').style.display !== 'none');
        const todasMarcadas = visiveis.every(c => c.checked);
        if (chkSelecionarTodas) chkSelecionarTodas.checked = todasMarcadas;
        return;
    }
});

// ==========================================
// FUNÇÕES DE GERAÇÃO E PROCESSAMENTO
// ==========================================

function gerarExcelJornadas() {
    const filtroStatus = document.getElementById('exportStatusFilter')?.value || 'ALL';
    
    let dadosExportar = (window.jornadasGlobalData || []).filter(d => {
        const isEstouro = (d.total_trabalho_horas || 0) > 12;
        if (filtroStatus === 'OK' && isEstouro) return false;
        if (filtroStatus === 'INFRACAO' && !isEstouro) return false;
        return true;
    });

    if (dadosExportar.length === 0) {
        alert("Nenhum dado disponível para exportar com o filtro selecionado.");
        document.getElementById('modalExportacao')?.classList.add('hidden');
        return;
    }

    let colunasSelecionadas = Array.from(document.querySelectorAll('.chk-coluna:checked')).map(chk => chk.value);

    if (filtroStatus === 'INFRACAO') {
        const colunasOcultar = ["H. Noturnas", "H. Extras (Soma)", "T. Trabalho (h)", "T. Direção (h)", "Refeição (h)", "Repouso (h)"];
        colunasSelecionadas = colunasSelecionadas.filter(col => !colunasOcultar.includes(col));
    }

    if (colunasSelecionadas.length === 0) {
        alert("Por favor, selecione pelo menos uma coluna para exportar.");
        return;
    }

    const fnObterOrdenacao = window.obterDataHoraParaOrdenacao || (val => new Date(val).getTime());
    dadosExportar.sort((a, b) => fnObterOrdenacao(a.inicio) - fnObterOrdenacao(b.inicio));

    const wsDados = dadosExportar.map(d => {
        let dI = '-', hI = '-', dF = '-', hF = '-';
        
        const rxDate = window.regexDate || /\d{2}\/\d{2}(\/\d{2,4})?/;
        const rxTime = window.regexTime || /\d{2}:\d{2}/;

        if (d.inicio) {
            const mD = d.inicio.match(rxDate); const mT = d.inicio.match(rxTime);
            if (mD) { dI = mD[0]; if (dI.length <= 5) dI += '/' + new Date().getFullYear(); }
            if (mT) hI = mT[0]; if (!mD && !mT) hI = d.inicio;
        }
        if (d.fim) {
            const mDF = d.fim.match(rxDate); const mTF = d.fim.match(rxTime);
            if (mDF) { dF = mDF[0]; if (dF.length <= 5) dF += '/' + new Date().getFullYear(); } else dF = dI;
            if (mTF) hF = mTF[0]; else hF = d.fim.replace(rxDate, '').replace('-', '').trim() || d.fim;
        }
        
        const fnSemana = window.calcularSemanaDoMes || (() => '-');
        const fnFormat = window.formatarHorasMinutos || (v => v);
        const valSemana = d.semana || fnSemana(dI);
        
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
            "H. Noturnas": fnFormat(d.horas_noturnas), 
            "H. Extras (Soma)": fnFormat(d.horas_extras),
            "T. Trabalho (h)": d.total_trabalho_horas, 
            "T. Direção (h)": d.direcao_horas, 
            "Refeição (h)": d.refeicao_horas, 
            "Repouso (h)": d.repouso_horas,
            "Tempo Excedido": fnFormat(Math.max(0, (d.total_trabalho_horas || 0) - 12)),
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
        if (typeof XLSX === 'undefined') {
            alert("Erro do Sistema: Biblioteca SheetJS (XLSX) não encontrada. Verifique se ela está incluída no index.html.");
            return;
        }

        const ws = XLSX.utils.json_to_sheet(wsDados);
        
        const colWidths = Object.keys(wsDados[0] || {}).map(key => ({ 
            wch: Math.max(16, key.length + 4)
        }));
        ws['!cols'] = colWidths;

        for (let key in ws) {
            if (key.startsWith('!')) continue;
            const isHeader = key.replace(/[A-Z]/g, '') === '1';
            ws[key].s = { alignment: { horizontal: "center", vertical: "center" } };
            if (isHeader) {
                ws[key].s.fill = { patternType: "solid", fgColor: { rgb: "ADD8E6" } };
                ws[key].s.font = { bold: true, color: { rgb: "000000" } };
            }
        }

        const wb = XLSX.utils.book_new(); 
        XLSX.utils.book_append_sheet(wb, ws, "Jornadas");
        XLSX.writeFile(wb, `SerranaLog_Jornadas_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (err) {
        console.error("Erro ao gerar Excel:", err);
        alert("Ocorreu um erro ao gerar o arquivo Excel. Verifique o console de desenvolvedor.");
    }
    
    document.getElementById('modalExportacao')?.classList.add('hidden');
}

function gerarPDFJornadas(btnElement) {
    const filtroStatus = document.getElementById('exportStatusFilter')?.value || 'ALL';
    
    let dadosExportar = (window.jornadasGlobalData || []).filter(d => {
        const isEstouro = (d.total_trabalho_horas || 0) > 12;
        if (filtroStatus === 'OK' && isEstouro) return false;
        if (filtroStatus === 'INFRACAO' && !isEstouro) return false;
        return true;
    });

    if (dadosExportar.length === 0) {
        alert("Nenhum dado disponível para exportar com o filtro selecionado.");
        return;
    }

    const fnObterOrdenacao = window.obterDataHoraParaOrdenacao || (val => new Date(val).getTime());
    dadosExportar.sort((a, b) => fnObterOrdenacao(a.inicio) - fnObterOrdenacao(b.inicio));

    if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
        alert("Erro do Sistema: Biblioteca jsPDF não encontrada. Verifique se ela está incluída no index.html.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');

    const colunas = [
        "Motorista", "Placa", "Data/Hora Início", "Data/Hora Fim", 
        "H. Noturnas", "H. Extras", "T. Trabalho", "T. Excedido", "Status"
    ];
    
    const linhas = [];
    const rxDate = window.regexDate || /\d{2}\/\d{2}(\/\d{2,4})?/;
    const rxTime = window.regexTime || /\d{2}:\d{2}/;
    const fnFormat = window.formatarHorasMinutos || (v => v);

    dadosExportar.forEach(d => {
        let dI = '-', hI = '-', dF = '-', hF = '-';
        
        if (d.inicio) {
            const mD = d.inicio.match(rxDate); const mT = d.inicio.match(rxTime);
            if (mD) { dI = mD[0]; if (dI.length <= 5) dI += '/' + new Date().getFullYear(); }
            if (mT) hI = mT[0]; if (!mD && !mT) hI = d.inicio;
        }
        if (d.fim) {
            const mDF = d.fim.match(rxDate); const mTF = d.fim.match(rxTime);
            if (mDF) { dF = mDF[0]; if (dF.length <= 5) dF += '/' + new Date().getFullYear(); } else dF = dI;
            if (mTF) hF = mTF[0]; else hF = d.fim.replace(rxDate, '').replace('-', '').trim() || d.fim;
        }

        const totalHoras = d.total_trabalho_horas || 0;
        const excedido = Math.max(0, totalHoras - 12);
        const isEstouro = totalHoras > 12;
        const statusTexto = isEstouro ? 'INFRAÇÃO' : 'OK';

        linhas.push([
            d.motorista || '-',
            d.placa || '-',
            `${dI} às ${hI}`,
            `${dF} às ${hF}`,
            fnFormat(d.horas_noturnas || 0),
            fnFormat(d.horas_extras || 0),
            fnFormat(totalHoras),
            fnFormat(excedido),
            statusTexto
        ]);
    });

    const elDataRef = document.getElementById('jorDataReferencia');
    let dataReferencia = elDataRef ? elDataRef.textContent : new Date().toLocaleDateString();
    let textoFiltro = "Todos os Status";
    if (filtroStatus === 'OK') textoFiltro = "Apenas registros OK (<= 12h)";
    if (filtroStatus === 'INFRACAO') textoFiltro = "Apenas Infrações (> 12h)";

    doc.setFontSize(16);
    doc.text("Relatório Analítico de Jornadas", 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`${dataReferencia} | Exibindo: ${textoFiltro}`, 14, 22);

    if (typeof doc.autoTable !== 'function') {
        alert("Aviso: O plugin 'autoTable' do jsPDF não foi encontrado (necessário para montar a tabela no PDF).");
    } else {
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
    }

    const textOriginalBtn = btnElement.innerHTML;
    btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Baixando...';
    btnElement.disabled = true;

    const img = new Image();
    img.src = 'assets/logoverde.png';
    
    img.onload = () => {
        const pageWidth = doc.internal.pageSize.getWidth();
        doc.addImage(img, 'PNG', pageWidth - 45, 10, 32, 12);
        doc.save(`SerranaLog_Jornadas_${filtroStatus}_${new Date().toISOString().slice(0,10)}.pdf`);
        btnElement.innerHTML = textOriginalBtn;
        btnElement.disabled = false;
    };
    
    img.onerror = () => {
        doc.save(`SerranaLog_Jornadas_${filtroStatus}_${new Date().toISOString().slice(0,10)}.pdf`);
        btnElement.innerHTML = textOriginalBtn;
        btnElement.disabled = false;
    };
}