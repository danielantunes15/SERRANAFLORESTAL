// ==========================================
// js/jornadas/jornadas_exportacao.js
// ==========================================

const btnExportarJor = document.getElementById('btnExportarJornada');
if (btnExportarJor) {
    btnExportarJor.addEventListener('click', () => {
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
            alert("Interface de opções de exportação não encontrada!");
        }
    });
}

const chkSelecionarTodas = document.getElementById('chkSelecionarTodasColunas');
const chkColunas = document.querySelectorAll('.chk-coluna');

if (chkSelecionarTodas) {
    chkSelecionarTodas.addEventListener('change', (e) => {
        chkColunas.forEach(chk => {
            if (chk.closest('label').style.display !== 'none') {
                chk.checked = e.target.checked;
            }
        });
    });
}

chkColunas.forEach(chk => {
    chk.addEventListener('change', () => {
        const visiveis = Array.from(chkColunas).filter(c => c.closest('label').style.display !== 'none');
        const todasMarcadas = visiveis.every(c => c.checked);
        if (chkSelecionarTodas) chkSelecionarTodas.checked = todasMarcadas;
    });
});

const fecharModalExportacao = () => {
    document.getElementById('modalExportacao')?.classList.add('hidden');
};

document.getElementById('btnFecharModalExportacao')?.addEventListener('click', fecharModalExportacao);
document.getElementById('btnCancelarExportacao')?.addEventListener('click', fecharModalExportacao);


document.getElementById('btnConfirmarExportacao')?.addEventListener('click', () => {
    const filtroStatus = document.getElementById('exportStatusFilter')?.value || 'ALL';
    
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

    let colunasSelecionadas = Array.from(document.querySelectorAll('.chk-coluna:checked')).map(chk => chk.value);

    if (filtroStatus === 'INFRACAO') {
        const colunasOcultar = ["H. Noturnas", "H. Extras (Soma)", "T. Trabalho (h)", "T. Direção (h)", "Refeição (h)", "Repouso (h)"];
        colunasSelecionadas = colunasSelecionadas.filter(col => !colunasOcultar.includes(col));
    }

    if (colunasSelecionadas.length === 0) {
        alert("Selecione pelo menos uma coluna para exportar.");
        return;
    }

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
            "H. Noturnas": typeof formatarHorasMinutos === 'function' ? formatarHorasMinutos(d.horas_noturnas) : d.horas_noturnas, 
            "H. Extras (Soma)": typeof formatarHorasMinutos === 'function' ? formatarHorasMinutos(d.horas_extras) : d.horas_extras,
            "T. Trabalho (h)": d.total_trabalho_horas, 
            "T. Direção (h)": d.direcao_horas, 
            "Refeição (h)": d.refeicao_horas, 
            "Repouso (h)": d.repouso_horas,
            "Tempo Excedido": typeof formatarHorasMinutos === 'function' ? formatarHorasMinutos(Math.max(0, (d.total_trabalho_horas || 0) - 12)) : Math.max(0, (d.total_trabalho_horas || 0) - 12),
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
        
        const colWidths = Object.keys(wsDados[0] || {}).map(key => ({ 
            wch: Math.max(16, key.length + 4)
        }));
        ws['!cols'] = colWidths;

        for (let key in ws) {
            if (key.startsWith('!')) continue;
            
            const isHeader = key.replace(/[A-Z]/g, '') === '1';
            
            ws[key].s = {
                alignment: { horizontal: "center", vertical: "center" }
            };

            if (isHeader) {
                ws[key].s.fill = {
                    patternType: "solid",
                    fgColor: { rgb: "ADD8E6" } 
                };
                ws[key].s.font = {
                    bold: true,
                    color: { rgb: "000000" }
                };
            }
        }

        const wb = XLSX.utils.book_new(); 
        XLSX.utils.book_append_sheet(wb, ws, "Jornadas");
        XLSX.writeFile(wb, `SerranaLog_Jornadas_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (err) {
        console.error("Erro ao gerar Excel:", err);
        alert("Ocorreu um erro ao gerar o arquivo Excel. Verifique o console.");
    }
    
    fecharModalExportacao();
});


document.getElementById('btnExportarPDFJornada')?.addEventListener('click', () => {
    const filtroStatus = document.getElementById('exportStatusFilter')?.value || 'ALL';
    
    let dadosExportar = jornadasGlobalData.filter(d => {
        const isEstouro = (d.total_trabalho_horas || 0) > 12;
        if (filtroStatus === 'OK' && isEstouro) return false;
        if (filtroStatus === 'INFRACAO' && !isEstouro) return false;
        return true;
    });

    if (dadosExportar.length === 0) return alert("Nenhum dado para exportar com este filtro de status.");

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
            typeof formatarHorasMinutos === 'function' ? formatarHorasMinutos(d.horas_noturnas || 0) : d.horas_noturnas,
            typeof formatarHorasMinutos === 'function' ? formatarHorasMinutos(d.horas_extras || 0) : d.horas_extras,
            typeof formatarHorasMinutos === 'function' ? formatarHorasMinutos(totalHoras) : totalHoras,
            typeof formatarHorasMinutos === 'function' ? formatarHorasMinutos(excedido) : excedido,
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