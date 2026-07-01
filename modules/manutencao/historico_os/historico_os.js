// ==================== modules/manutencao/historico_os/historico_os.js ====================

let currentPageHistoricoOS = 1;
const itemsPerPageHistoricoOS = 20;

// FUNÇÃO NOVA: Descobre a categoria cruzando a placa da O.S com o cadastro da frota
window.getCategoriaDaOS = function(os) {
    // 1. Se a categoria já vier salva no banco de dados
    if (os.categoria) return os.categoria.trim().toUpperCase();
    
    // 2. Se não vier, procura na lista de frotas através da placa
    if (os.placa && typeof window.frotasManutencao !== 'undefined') {
        const placaBusca = os.placa.trim().toUpperCase();
        const frota = window.frotasManutencao.find(f => 
            (f.cavalo && f.cavalo.trim().toUpperCase() === placaBusca) || 
            (f.go && f.go.trim().toUpperCase() === placaBusca)
        );
        if (frota && frota.categoria) {
            return frota.categoria.trim().toUpperCase();
        }
    }
    
    return 'NÃO DEFINIDA';
};

window.initHistoricoOS = async function() {
    if(typeof window.carregarDadosOS === 'function') {
        await window.carregarDadosOS();
    }
    window.carregarFiltrosSelectHistoricoOS();
    window.renderizarTabelaHistoricoOS(true);
};

window.renderizarTabelaHistoricoOS = function(resetPage = true) {
    if (resetPage === true) {
        currentPageHistoricoOS = 1;
    }

    const tbody = document.getElementById('tabelaHistoricoOS');
    if (!tbody) return;

    const num = document.getElementById('filtroHistOSNum')?.value.toLowerCase();
    const categoria = document.getElementById('filtroHistCategoria')?.value;
    const placa = document.getElementById('filtroHistPlaca')?.value;
    const motorista = document.getElementById('filtroHistMotorista')?.value;
    const dataInicio = document.getElementById('filtroHistDataInicio')?.value;
    const dataFim = document.getElementById('filtroHistDataFim')?.value;
    const tipo = document.getElementById('filtroHistTipo')?.value;
    const mesAno = document.getElementById('filtroHistMesAno')?.value;

    let filtradas = window.ordensServico || [];

    if (num) filtradas = filtradas.filter(o => (o.numero_os && o.numero_os.toString() === num) || o.id.toString() === num);
    if (categoria) filtradas = filtradas.filter(o => window.getCategoriaDaOS(o) === categoria.toUpperCase());
    if (placa) filtradas = filtradas.filter(o => o.placa && o.placa.toUpperCase() === placa.toUpperCase());
    if (motorista) filtradas = filtradas.filter(o => o.motorista && o.motorista === motorista);
    
    if (mesAno) {
        filtradas = filtradas.filter(o => {
            if (!o.data_abertura) return false;
            return o.data_abertura.substring(0, 7) === mesAno;
        });
    }
    
    if (dataInicio || dataFim) {
        filtradas = filtradas.filter(o => {
            if (!o.data_abertura) return false;
            const dtAbertura = o.data_abertura.split('T')[0];
            if (dataInicio && dtAbertura < dataInicio) return false;
            if (dataFim && dtAbertura > dataFim) return false;
            return true;
        });
    }
    
    if (tipo) {
        if (tipo === '_SUZANO_') {
            filtradas = filtradas.filter(o => o.tipo && o.tipo.toUpperCase().includes('SUZANO'));
        } else {
            filtradas = filtradas.filter(o => o.tipo && o.tipo === tipo);
        }
    }

    // ========== LÓGICA DE PAGINAÇÃO ==========
    const totalItems = filtradas.length;
    const totalPages = Math.ceil(totalItems / itemsPerPageHistoricoOS) || 1;
    
    if (currentPageHistoricoOS > totalPages) currentPageHistoricoOS = totalPages;
    if (currentPageHistoricoOS < 1) currentPageHistoricoOS = 1;

    const startIndex = (currentPageHistoricoOS - 1) * itemsPerPageHistoricoOS;
    const paginatedItems = filtradas.slice(startIndex, startIndex + itemsPerPageHistoricoOS);

    tbody.innerHTML = paginatedItems.map(os => {
        let corStatus = '#f59e0b';
        if (os.status === 'Concluída') corStatus = 'var(--ccol-green-bright)';
        if (os.status === 'Em Manutenção') corStatus = '#3b82f6';
        if (os.status === 'Sinistrado' || os.tipo === 'Sinistro') corStatus = '#ef4444';

        const dataAbertura = window.formatarDataHoraBrasil ? window.formatarDataHoraBrasil(os.data_abertura) : os.data_abertura;
        const dataConclusao = os.data_conclusao ? (window.formatarDataHoraBrasil ? window.formatarDataHoraBrasil(os.data_conclusao) : os.data_conclusao) : '-';
        
        const numeroExibicao = os.numero_os || os.id;
        const categoriaExibicao = window.getCategoriaDaOS(os);

        return `
            <tr>
                <td><strong>#${numeroExibicao}</strong></td>
                <td><span style="background: rgba(255,255,255,0.1); padding: 3px 8px; border-radius: 4px; font-size: 0.85rem;">${categoriaExibicao}</span></td>
                <td>${dataAbertura}</td>
                <td style="${os.status === 'Concluída' ? 'color: var(--ccol-green-bright);' : ''}">${dataConclusao}</td>
                <td style="color: var(--ccol-blue-bright); font-weight: bold;">${os.placa || '-'}</td>
                <td>${os.motorista || '-'}</td>
                <td>${os.tipo}</td>
                <td><span style="color: ${corStatus}; font-weight: bold;">${os.status}</span></td>
                <td>
                    <div style="display: flex; gap: 5px; justify-content: flex-start;">
                        <button class="btn-primary-blue" onclick="abrirVisualizacaoOS(${os.id})" title="Visualizar Detalhes" style="padding: 4px 8px; font-size: 0.8rem; border-radius: 4px;">👁️</button>
                        <button class="btn-secondary-dark" onclick="imprimirOS(${os.id})" title="Imprimir O.S." style="padding: 4px 8px; font-size: 0.8rem; border-radius: 4px;">🖨️</button>
                        <button class="btn-danger-outline" onclick="excluirOS(${os.id})" title="Excluir" style="padding: 4px 8px; font-size: 0.8rem; border-radius: 4px;">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    renderizarControlesPaginacaoOS(totalPages);
};

window.mudarPaginaHistoricoOS = function(novaPagina) {
    currentPageHistoricoOS = novaPagina;
    window.renderizarTabelaHistoricoOS(false);
};

function renderizarControlesPaginacaoOS(totalPages) {
    const container = document.getElementById('paginacaoHistoricoOS');
    if (!container) return;
    
    let html = '';
    
    html += `<button class="btn-secondary-dark" onclick="mudarPaginaHistoricoOS(${currentPageHistoricoOS - 1})" 
            ${currentPageHistoricoOS === 1 ? 'disabled style="opacity: 0.5; cursor: not-allowed; padding: 6px 15px;"' : 'style="padding: 6px 15px;"'}>
            Anterior
            </button>`;
    
    html += `<span style="color: #94a3b8; font-size: 0.95rem; font-weight: bold; background: rgba(255,255,255,0.05); padding: 5px 15px; border-radius: 6px;">
             Página ${currentPageHistoricoOS} de ${totalPages}
             </span>`;
    
    html += `<button class="btn-secondary-dark" onclick="mudarPaginaHistoricoOS(${currentPageHistoricoOS + 1})" 
            ${currentPageHistoricoOS === totalPages ? 'disabled style="opacity: 0.5; cursor: not-allowed; padding: 6px 15px;"' : 'style="padding: 6px 15px;"'}>
            Próxima
            </button>`;
    
    container.innerHTML = html;
}

window.carregarFiltrosSelectHistoricoOS = function() {
    const selectCategoria = document.getElementById('filtroHistCategoria');
    const selectPlaca = document.getElementById('filtroHistPlaca');
    const selectMotorista = document.getElementById('filtroHistMotorista');
    const selectMesAno = document.getElementById('filtroHistMesAno');

    if (selectCategoria && window.ordensServico) {
        let optionsCat = '<option value="">Todas as Categorias</option>';
        // Extrai as categorias únicas baseando-se na nova função
        const catUnicas = [...new Set(window.ordensServico.map(os => window.getCategoriaDaOS(os)))].filter(c => c && c !== 'NÃO DEFINIDA').sort();
        catUnicas.forEach(c => optionsCat += `<option value="${c}">${c}</option>`);
        selectCategoria.innerHTML = optionsCat;
    }

    if (selectPlaca && window.ordensServico) {
        let optionsPlaca = '<option value="">Todas as Placas</option>';
        const placasUnicas = [...new Set(window.ordensServico.map(os => os.placa))].filter(Boolean).sort();
        placasUnicas.forEach(p => optionsPlaca += `<option value="${p}">${p}</option>`);
        selectPlaca.innerHTML = optionsPlaca;
    }

    if (selectMotorista && window.ordensServico) {
        let optionsMot = '<option value="">Todos os Motoristas</option>';
        const motUnicos = [...new Set(window.ordensServico.map(os => os.motorista))].filter(Boolean).sort();
        motUnicos.forEach(m => optionsMot += `<option value="${m}">${m}</option>`);
        selectMotorista.innerHTML = optionsMot;
    }

    if (selectMesAno && window.ordensServico) {
        let optionsMes = '<option value="">Todos os Meses</option>';
        const mesesUnicos = new Set();
        window.ordensServico.forEach(os => {
            if (os.data_abertura) {
                const d = new Date(os.data_abertura);
                if(!isNaN(d)) {
                    const mesAno = String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
                    mesesUnicos.add(mesAno);
                }
            }
        });
        [...mesesUnicos].sort((a,b) => {
            const [mA, yA] = a.split('/');
            const [mB, yB] = b.split('/');
            return yB - yA || mB - mA;
        }).forEach(ma => optionsMes += `<option value="${ma}">${ma}</option>`);
        selectMesAno.innerHTML = optionsMes;
    }
};

window.setFiltroMesAtualOS = function() {
    const agora = new Date();
    const primeiroDia = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const ultimoDia = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);

    const formatarData = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const inputInicio = document.getElementById('filtroHistDataInicio');
    const inputFim = document.getElementById('filtroHistDataFim');
    
    if (inputInicio) inputInicio.value = formatarData(primeiroDia);
    if (inputFim) inputFim.value = formatarData(ultimoDia);

    if (typeof window.renderizarTabelaHistoricoOS === 'function') {
        window.renderizarTabelaHistoricoOS();
    }
};

window.exportarHistoricoOSExcel = function() {
    const num = document.getElementById('filtroHistOSNum')?.value.toLowerCase();
    const categoria = document.getElementById('filtroHistCategoria')?.value;
    const placa = document.getElementById('filtroHistPlaca')?.value;
    const motorista = document.getElementById('filtroHistMotorista')?.value;
    const dataInicio = document.getElementById('filtroHistDataInicio')?.value;
    const dataFim = document.getElementById('filtroHistDataFim')?.value;
    const tipo = document.getElementById('filtroHistTipo')?.value;
    const mesAno = document.getElementById('filtroHistMesAno')?.value;
    
    let filtradas = window.ordensServico || [];
    
    if (num) filtradas = filtradas.filter(o => o.id.toString() === num);
    if (categoria) filtradas = filtradas.filter(o => window.getCategoriaDaOS(o) === categoria.toUpperCase());
    if (placa) filtradas = filtradas.filter(o => o.placa && o.placa.toUpperCase() === placa.toUpperCase());
    if (motorista) filtradas = filtradas.filter(o => o.motorista && o.motorista === motorista);
    
    if (mesAno) {
        filtradas = filtradas.filter(o => {
            if (!o.data_abertura) return false;
            return String(o.data_abertura).substring(0, 7) === mesAno;
        });
    }
    
    if (dataInicio || dataFim) {
        filtradas = filtradas.filter(o => {
            if (!o.data_abertura) return false;
            const dtAbertura = String(o.data_abertura).split('T')[0];
            if (dataInicio && dtAbertura < dataInicio) return false;
            if (dataFim && dtAbertura > dataFim) return false;
            return true;
        });
    }

    if (tipo) {
        if (tipo === '_SUZANO_') {
            filtradas = filtradas.filter(o => o.tipo && o.tipo.toUpperCase().includes('SUZANO'));
        } else {
            filtradas = filtradas.filter(o => o.tipo && o.tipo === tipo);
        }
    }
    
    if (filtradas.length === 0) {
        alert("Não há dados para exportar com os filtros atuais.");
        return;
    }
    
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Nº O.S.;Categoria;Placa (Cavalo);Motorista;Tipo de Serviço;Status;Prioridade;Data Abertura;Data Conclusão;Tempo Aberta (Horas/Minutos)\n";
    
    filtradas.forEach(os => {
        const inicioStr = window.formatarDataHoraBrasil ? window.formatarDataHoraBrasil(os.data_abertura) : os.data_abertura;
        const conclusaoStr = os.data_conclusao ? (window.formatarDataHoraBrasil ? window.formatarDataHoraBrasil(os.data_conclusao) : os.data_conclusao) : 'Em Aberto';
        
        let tempoAbertaTexto = '-';
        if (os.data_abertura) {
            const inicio = new Date(String(os.data_abertura).replace('Z', '').replace('+00:00', ''));
            let fim = new Date();              
            if (os.data_conclusao) {
                fim = new Date(String(os.data_conclusao).replace('Z', '').replace('+00:00', ''));
            }
            
            if (!isNaN(inicio) && !isNaN(fim) && fim >= inicio) {
                const diffMs = fim - inicio;
                const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                const diffMin = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                tempoAbertaTexto = `${diffHrs}h ${diffMin}m`; 
            }
        }
        
        const categoriaExibicao = window.getCategoriaDaOS(os);
        
        const linha = [
            `"${os.id}"`,
            `"${categoriaExibicao}"`,
            `"${os.placa || '-'}"`,
            `"${os.motorista || '-'}"`,
            `"${os.tipo || '-'}"`,
            `"${os.status || '-'}"`,
            `"${os.prioridade || 'Normal'}"`,
            `"${inicioStr}"`,
            `"${conclusaoStr}"`,
            `"${tempoAbertaTexto}"`
        ].join(';');
        
        csvContent += linha + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Historico_Completo_OS_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

function loadScriptPDF(url) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${url}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

window.exportarHistoricoOSPDF = async function() {
    try {
        await loadScriptPDF('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        await loadScriptPDF('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
    } catch(e) {
        alert("Não foi possível carregar as bibliotecas de exportação PDF. Verifique a conexão com a internet.");
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    
    const num = document.getElementById('filtroHistOSNum')?.value.toLowerCase();
    const categoria = document.getElementById('filtroHistCategoria')?.value;
    const placa = document.getElementById('filtroHistPlaca')?.value;
    const motorista = document.getElementById('filtroHistMotorista')?.value;
    const dataInicio = document.getElementById('filtroHistDataInicio')?.value;
    const dataFim = document.getElementById('filtroHistDataFim')?.value;
    const tipoFiltro = document.getElementById('filtroHistTipo')?.value;
    const mesAno = document.getElementById('filtroHistMesAno')?.value;
    
    let filtradas = window.ordensServico || [];
    
    if (num) filtradas = filtradas.filter(o => o.id.toString() === num);
    if (categoria) filtradas = filtradas.filter(o => window.getCategoriaDaOS(o) === categoria.toUpperCase());
    if (placa) filtradas = filtradas.filter(o => o.placa && o.placa.toUpperCase() === placa.toUpperCase());
    if (motorista) filtradas = filtradas.filter(o => o.motorista && o.motorista === motorista);
    
    if (mesAno) {
        filtradas = filtradas.filter(o => {
            if (!o.data_abertura) return false;
            return String(o.data_abertura).substring(0, 7) === mesAno;
        });
    }
    
    if (dataInicio || dataFim) {
        filtradas = filtradas.filter(o => {
            if (!o.data_abertura) return false;
            const dtAbertura = String(o.data_abertura).split('T')[0];
            if (dataInicio && dtAbertura < dataInicio) return false;
            if (dataFim && dtAbertura > dataFim) return false;
            return true;
        });
    }

    if (tipoFiltro) {
        if (tipoFiltro === '_SUZANO_') {
            filtradas = filtradas.filter(o => o.tipo && o.tipo.toUpperCase().includes('SUZANO'));
        } else {
            filtradas = filtradas.filter(o => o.tipo && o.tipo === tipoFiltro);
        }
    }
    
    if (filtradas.length === 0) {
        alert("Não há dados para exportar com os filtros atuais.");
        return;
    }
    
    let temposPorTipo = {};
    let linhasTabela = [];
    
    filtradas.forEach(os => {
        const inicioStr = window.formatarDataHoraBrasil ? window.formatarDataHoraBrasil(os.data_abertura) : os.data_abertura;
        const conclusaoStr = os.data_conclusao ? (window.formatarDataHoraBrasil ? window.formatarDataHoraBrasil(os.data_conclusao) : os.data_conclusao) : 'Em Aberto';
        
        let tempoAbertaTexto = '-';
        let tempoMs = 0;
        
        if (os.data_abertura) {
            const inicio = new Date(String(os.data_abertura).replace('Z', '').replace('+00:00', ''));
            let fim = new Date();              
            if (os.data_conclusao) {
                fim = new Date(String(os.data_conclusao).replace('Z', '').replace('+00:00', ''));
            }
            
            if (!isNaN(inicio) && !isNaN(fim) && fim >= inicio) {
                tempoMs = fim - inicio;
                const diffHrs = Math.floor(tempoMs / (1000 * 60 * 60));
                const diffMin = Math.floor((tempoMs % (1000 * 60 * 60)) / (1000 * 60));
                tempoAbertaTexto = `${diffHrs}h ${diffMin}m`; 
            }
        }
        
        const tipoDesc = os.tipo || 'Não Informado';
        const categoriaExibicao = window.getCategoriaDaOS(os);
        
        if (!temposPorTipo[tipoDesc]) {
            temposPorTipo[tipoDesc] = { count: 0, totalMs: 0 };
        }
        temposPorTipo[tipoDesc].count++;
        temposPorTipo[tipoDesc].totalMs += tempoMs;
        
        linhasTabela.push([
            `#${os.id}`,
            categoriaExibicao,
            os.placa || '-',
            tipoDesc,
            os.status || '-',
            inicioStr,
            conclusaoStr,
            tempoAbertaTexto
        ]);
    });
    
    let linhasResumo = [];
    for (const [tipo, dados] of Object.entries(temposPorTipo)) {
        if(dados.count > 0) {
            const mediaMs = dados.totalMs / dados.count;
            const mediaHrs = Math.floor(mediaMs / (1000 * 60 * 60));
            const mediaMin = Math.floor((mediaMs % (1000 * 60 * 60)) / (1000 * 60));
            linhasResumo.push([tipo, dados.count.toString(), `${mediaHrs}h ${mediaMin}m`]);
        }
    }
    
    linhasResumo.sort((a, b) => a[0].localeCompare(b[0]));
    linhasTabela.sort((a, b) => a[2].localeCompare(b[2]));
    
    const logoUrl = 'assets/logoverde.png';
    const img = new Image();
    
    img.onload = () => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');
            gerarDocumentoPDF(doc, dataUrl, linhasResumo, linhasTabela);
        } catch(e) {
            console.warn("Aviso de segurança ao ler imagem local. Tentando fallback.");
            gerarDocumentoPDF(doc, img, linhasResumo, linhasTabela);
        }
    };
    img.onerror = () => {
        console.warn("Logomarca não encontrada ou bloqueada:", logoUrl);
        gerarDocumentoPDF(doc, null, linhasResumo, linhasTabela); 
    };
    img.src = logoUrl;
};

function gerarDocumentoPDF(doc, logoDataUrl, linhasResumo, linhasTabela) {
    const pageWidth = doc.internal.pageSize.getWidth ? doc.internal.pageSize.getWidth() : doc.internal.pageSize.width;
    
    if (logoDataUrl) {
        try {
            doc.addImage(logoDataUrl, 'PNG', pageWidth - 59, 10, 45, 15);
        } catch(e) {
            console.warn("Aviso: Falha ao desenhar a logomarca no PDF.", e);
        }
    }
    
    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text("Relatório Histórico de Ordens de Serviço", 14, 35);
    
    doc.setFontSize(10);
    doc.text(`Data de Emissão: ${new Date().toLocaleString('pt-BR')}`, 14, 42);
    
    doc.autoTable({
        startY: 48,
        head: [['Tipo de Serviço', 'Qtd. de O.S.', 'Média de Tempo Parada']],
        body: linhasResumo,
        theme: 'grid',
        headStyles: { fillColor: [4, 120, 87] },
        margin: { top: 10 },
        styles: { fontSize: 10 }
    });
    
    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 15,
        head: [['Nº O.S.', 'Categoria', 'Cavalo', 'Tipo de Serviço', 'Status', 'Data Abertura', 'Data Conclusão', 'Tempo Total']],
        body: linhasTabela,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] },
        styles: { fontSize: 9 }
    });
    
    doc.save(`Relatorio_Historico_OS_${new Date().toISOString().split('T')[0]}.pdf`);
}

// ====== FUNÇÃO DE VISUALIZAÇÃO COM O ERRO 400 CORRIGIDO ======
window.abrirVisualizacaoOS = async function(id) {
    const os = window.ordensServico.find(o => o.id === id);
    if (!os) return;

    const inputVisOsId = document.getElementById('visOSId');
    if (!inputVisOsId) {
        alert("⚠️ ATUALIZAÇÃO DETECTADA!\n\nSeu navegador está utilizando uma versão antiga desta tela.\nPor favor, aperte as teclas [ CTRL + F5 ] simultaneamente para carregar a versão mais recente do sistema.");
        return; 
    }

    inputVisOsId.value = os.id;
    document.getElementById('visOSNum').innerText = '#' + (os.numero_os || os.id);
    
    let corStatus = '#f59e0b';
    if (os.status === 'Concluída') corStatus = 'var(--ccol-green-bright)';
    if (os.status === 'Em Manutenção') corStatus = '#3b82f6';
    if (os.status === 'Sinistrado' || os.tipo === 'Sinistro') corStatus = '#ef4444';
    
    const statusEl = document.getElementById('visOSStatus');
    statusEl.innerText = os.status;
    statusEl.style.color = corStatus;

    document.getElementById('visOSPlaca').innerText = os.placa || '-';
    document.getElementById('visOSAbertura').innerText = window.formatarDataHoraBrasil ? window.formatarDataHoraBrasil(os.data_abertura) : os.data_abertura;
    document.getElementById('visOSConclusao').innerText = os.data_conclusao ? (window.formatarDataHoraBrasil ? window.formatarDataHoraBrasil(os.data_conclusao) : os.data_conclusao) : 'Em Andamento';
    
    document.getElementById('visOSMotorista').innerText = os.motorista || '-';
    document.getElementById('visOSTipo').innerText = os.tipo || '-';
    
    let prioridadeBadge = `<span style="background: rgba(255,255,255,0.1); padding: 3px 8px; border-radius: 4px; font-size: 0.85rem;">${os.prioridade || 'Normal'}</span>`;
    if(os.prioridade === 'Urgente') prioridadeBadge = `<span style="background: #ef4444; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: bold;">Urgente</span>`;
    if(os.prioridade === 'Alta') prioridadeBadge = `<span style="background: #f97316; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: bold;">Alta</span>`;
    document.getElementById('visOSPrioridade').innerHTML = prioridadeBadge;
    
    document.getElementById('visOSHodometro').innerText = os.hodometro || '-';
    
    let problemaFormatado = os.problema || 'Nenhum problema relatado.';
    problemaFormatado = problemaFormatado.replace(/\n/g, '<br>');
    document.getElementById('visOSProblema').innerHTML = problemaFormatado;

    let obsFormatada = os.observacoes || 'Nenhuma observação extra informada.';
    obsFormatada = obsFormatada.replace(/\n/g, '<br>');
    document.getElementById('visOSObservacoes').innerHTML = obsFormatada;

    document.getElementById('modalVisualizarOS').style.display = 'flex';

    const servicosContainer = document.getElementById('visOSServicosList');
    const pecasContainer = document.getElementById('visOSPecasList');
    
    servicosContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Buscando serviços...</div>';
    pecasContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Buscando peças...</div>';

    try {
        const resServ = await window.supabaseClient.from('os_servicos_executados').select('*').eq('os_id', os.id).order('id');
        if (resServ.data && resServ.data.length > 0) {
            servicosContainer.innerHTML = resServ.data.map(s => `
                <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); font-size: 0.9rem;">
                    <i class="fas fa-check" style="color: var(--ccol-blue-bright); margin-right: 5px;"></i> ${s.descricao}
                </div>
            `).join('');
        } else {
            servicosContainer.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.9rem; text-align: center; padding: 10px;">Nenhum serviço apontado nesta O.S.</div>';
        }

        // BUSCA SEM O JOIN NO SUPABASE (PREVINE O ERRO 400 DE FOREIGN KEY)
        const resPecas = await window.supabaseClient.from('os_pecas_utilizadas').select('*').eq('os_id', os.id).order('id');
        if (resPecas.data && resPecas.data.length > 0) {
            pecasContainer.innerHTML = resPecas.data.map(p => {
                const pecaDb = (window.pecasAlmoxarifadoCache || []).find(x => x.id == p.peca_id);
                const nomePeca = pecaDb ? pecaDb.nome : 'Peça Indisponível';
                const unidadePeca = pecaDb ? pecaDb.unidade : 'UN';
                const compartimento = p.compartimento || 'GERAL';
                
                let corStatusPeca = '#f59e0b';
                if(p.status === 'Aprovado') corStatusPeca = '#10b981';
                else if (p.status === 'Recusado') corStatusPeca = '#ef4444';

                return `
                    <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); font-size: 0.9rem; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                        <div style="flex: 1;">
                            <span style="color: var(--ccol-green-bright); font-weight: bold; font-size: 0.8rem;">[${compartimento}]</span><br>
                            ${nomePeca}
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end;">
                            <div style="font-weight: bold; font-size: 1.1rem; color: #fff; background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px;">
                                ${p.quantidade} ${unidadePeca}
                            </div>
                            <span style="font-size: 0.7rem; color: ${corStatusPeca}; font-weight: bold; margin-top: 3px; text-transform: uppercase;">${p.status || 'Pendente'}</span>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            pecasContainer.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.9rem; text-align: center; padding: 10px;">Nenhuma requisição de peça vinculada.</div>';
        }
    } catch (e) {
        console.error('Erro ao buscar detalhes adicionais da OS:', e);
        servicosContainer.innerHTML = '<div style="color: #ef4444; font-size: 0.9rem;">Erro ao carregar serviços executados.</div>';
        pecasContainer.innerHTML = '<div style="color: #ef4444; font-size: 0.9rem;">Erro ao carregar peças requisitadas.</div>';
    }
};

window.fecharVisualizacaoOS = function() {
    document.getElementById('modalVisualizarOS').style.display = 'none';
};