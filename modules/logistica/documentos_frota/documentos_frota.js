// ==================== js/documentos_frota.js ====================

if (typeof window.PDFLib === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js';
    document.head.appendChild(script);
}

const ESTRUTURA_DOCUMENTOS = [
    { id: 'crlv_cavalo', nome: 'CRLV-e - CAVALO', ref_key: 'cavalo' },
    { id: 'crlv_c1', nome: 'CRLV - 1º C', ref_key: 'carreta1' },
    { id: 'crlv_c2', nome: 'CRLV - 2º C', ref_key: 'carreta2' },
    { id: 'crlv_c3', nome: 'CRLV - 3º C', ref_key: 'carreta3' },
    { id: 'cronotacografo', nome: 'Certificado Cronotacógrafo', ref_key: 'cavalo' },
    { id: 'antt', nome: 'Registro de ANTT', is_global: true },
    { id: 'aet_fed_dia', nome: 'AET Federal Diurna', ref_key: 'cavalo' },
    { id: 'aet_fed_noite', nome: 'AET Federal Noturna', ref_key: 'cavalo' },
    { id: 'aet_est_dia', nome: 'AET Estadual Diurna', ref_key: 'cavalo' },
    { id: 'aet_est_noite', nome: 'AET Estadual Noturna', ref_key: 'cavalo' },
    // Documentos Globais
    { id: 'apr', nome: 'APR', is_global: true },
    { id: 'floresta_segura', nome: 'Floresta Segura', is_global: true },
    { id: 'estrada_segura', nome: 'Estrada Segura', is_global: true },
    { id: 'mapeamento_hospitalar', nome: 'Mapeamento Hospitalar', is_global: true },
    // Inspeções
    { id: 'inspecao_cavalo', nome: 'Inspeção Eletromecânica - CAVALO', ref_key: 'cavalo' },
    { id: 'inspecao_c1', nome: 'Inspeção Eletromecânica - 1º C', ref_key: 'carreta1' },
    { id: 'inspecao_c2', nome: 'Inspeção Eletromecânica - 2º C', ref_key: 'carreta2' },
    { id: 'inspecao_c3', nome: 'Inspeção Eletromecânica - 3º C', ref_key: 'carreta3' }
];

let frotaSelecionadaDocs = null;
let documentosAtuaisDB = []; 
let documentosGlobaisAtuaisDB = [];
let listaDeFrotasIndependente = []; 

window.renderizarTelaDocumentosFrota = async function() {
    const tbody = document.getElementById('tabelaDocumentosFrota');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;"><i class="fas fa-spinner fa-spin"></i> Carregando frota da base de dados...</td></tr>';
    
    try {
        const { data, error } = await supabaseClient.from('frotas_manutencao').select('*').order('cavalo');
        if (error) throw error;
        
        listaDeFrotasIndependente = data || [];
        renderizarTabelaFrotasDocs();
    } catch (e) {
        console.error("Erro ao buscar frotas:", e);
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ef4444;">Erro ao carregar frotas.</td></tr>';
    }
};

function renderizarTabelaFrotasDocs() {
    const tbody = document.getElementById('tabelaDocumentosFrota');
    const badgeNumeroTotal = document.getElementById('totalFrotasNum');
    
    // Atualiza o contador de frotas
    if (badgeNumeroTotal) {
        badgeNumeroTotal.innerText = listaDeFrotasIndependente.length;
    }

    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (listaDeFrotasIndependente.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhuma frota cadastrada.</td></tr>';
        return;
    }

    listaDeFrotasIndependente.forEach(frota => {
        const statusTexto = frota.status || 'Ativo';
        const statusCor = statusTexto === 'Ativo' ? '#22c55e' : '#ef4444';
        const badgeStatus = `<span style="background-color: ${statusCor}20; color: ${statusCor}; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; border: 1px solid ${statusCor}40;">${statusTexto}</span>`;

        const comp = [frota.carreta1, frota.carreta2, frota.carreta3].filter(c => c).join(' / ') || 'Sem Carretas';
        
        tbody.innerHTML += `
            <tr>
                <td>${badgeStatus}</td>
                <td style="color: var(--ccol-blue-bright); font-weight: bold; font-size: 1.1rem;">${frota.cavalo || '-'}</td>
                <td style="font-weight: bold;">${frota.go || '-'}</td>
                <td style="color: var(--text-secondary);">${comp}</td>
                <td style="text-align: right; display: flex; justify-content: flex-end; gap: 8px;">
                    <button class="btn-primary-blue" onclick="abrirModalGerenciarDocs(${frota.id})" style="padding: 5px 10px; font-size: 0.85rem;">
                        <i class="fas fa-folder-open"></i> Arquivos
                    </button>
                    <button class="btn-primary-green" onclick="gerarRelatorioPdfUnico(${frota.id})" style="padding: 5px 10px; font-size: 0.85rem;">
                        <i class="fas fa-file-pdf"></i> Gerar PDF
                    </button>
                </td>
            </tr>
        `;
    });
}

// ================= MODAL E UPLOADS ESPECÍFICOS =================

window.abrirModalGerenciarDocs = async function(id) {
    frotaSelecionadaDocs = listaDeFrotasIndependente.find(f => f.id === id);
    if (!frotaSelecionadaDocs) return;

    document.getElementById('modalDocCavaloPlaca').innerText = frotaSelecionadaDocs.cavalo;
    document.getElementById('modalGerenciarDocs').style.display = 'flex';
    document.getElementById('listaUploadDocs').innerHTML = '<div style="text-align:center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Processando arquivos...</div>';

    const identificadoresConjunto = [
        frotaSelecionadaDocs.cavalo, frotaSelecionadaDocs.carreta1, frotaSelecionadaDocs.carreta2, frotaSelecionadaDocs.carreta3, 'GLOBAL_DOCS'
    ].filter(Boolean);

    documentosAtuaisDB = await db.getDocumentosFrota(identificadoresConjunto);
    renderizarItensUpload();
};

window.fecharModalGerenciarDocs = function() {
    document.getElementById('modalGerenciarDocs').style.display = 'none';
    frotaSelecionadaDocs = null;
};

function renderizarItensUpload() {
    const container = document.getElementById('listaUploadDocs');
    container.innerHTML = '';

    ESTRUTURA_DOCUMENTOS.forEach(tipoDoc => {
        const placaAlvo = tipoDoc.is_global ? 'GLOBAL_DOCS' : frotaSelecionadaDocs[tipoDoc.ref_key];
        if (!tipoDoc.is_global && !placaAlvo) return; 

        const docEncontrado = documentosAtuaisDB.find(d => d.identificador === placaAlvo && d.tipo_documento === tipoDoc.id);

        let acoesHtml = '';
        if (tipoDoc.is_global) {
            if (docEncontrado) {
                acoesHtml = `<a href="${docEncontrado.arquivo_url}" target="_blank" class="btn-primary-blue" style="padding: 5px 10px; text-decoration: none; font-size: 0.8rem; background-color: var(--ccol-blue-dark);"><i class="fas fa-eye"></i> Visualizar Global</a>`;
            } else {
                acoesHtml = `<span style="font-size: 0.8rem; color: #f59e0b; padding: 5px;"><i class="fas fa-exclamation-triangle"></i> Pendente no Menu Global</span>`;
            }
        } else {
            if (docEncontrado) {
                acoesHtml = `
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <a href="${docEncontrado.arquivo_url}" target="_blank" class="btn-primary-blue" style="padding: 5px 10px; text-decoration: none; font-size: 0.8rem;"><i class="fas fa-eye"></i> Ver</a>
                        
                        <label style="cursor: pointer; background-color: #f59e0b; color: #fff; padding: 5px 10px; border-radius: 4px; font-size: 0.8rem; margin: 0; display: inline-flex; align-items: center; gap: 5px;">
                            <i class="fas fa-sync-alt"></i> Alterar
                            <input type="file" accept="application/pdf" style="display: none;" onchange="fazerUploadDocFrota(event, '${placaAlvo}', '${tipoDoc.id}')">
                        </label>

                        <button class="btn-delete" style="padding: 5px 10px; font-size: 0.8rem;" onclick="excluirDocFrota('${placaAlvo}', '${tipoDoc.id}', '${docEncontrado.arquivo_path}')"><i class="fas fa-trash"></i> Excluir</button>
                    </div>
                `;
            } else {
                acoesHtml = `
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <label style="cursor: pointer; background-color: var(--ccol-blue-bright); color: #fff; padding: 5px 15px; border-radius: 4px; font-size: 0.8rem; margin: 0; display: inline-flex; align-items: center; gap: 5px;">
                            <i class="fas fa-upload"></i> Enviar PDF
                            <input type="file" accept="application/pdf" style="display: none;" onchange="fazerUploadDocFrota(event, '${placaAlvo}', '${tipoDoc.id}')">
                        </label>
                    </div>
                `;
            }
        }

        const refText = tipoDoc.is_global ? 'Todos os Conjuntos (Global)' : placaAlvo;
        const refColor = tipoDoc.is_global ? '#10b981' : 'var(--ccol-blue-bright)';
        const tagGlobal = tipoDoc.is_global ? '<span style="font-size: 0.7rem; background: #10b981; color: #fff; padding: 2px 6px; border-radius: 4px; margin-left: 5px;">GLOBAL</span>' : '';

        container.innerHTML += `
            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-dim); padding: 10px 15px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 5px;">
                <div>
                    <strong style="color: #fff; display: block; font-size: 0.95rem;">${tipoDoc.nome} ${tagGlobal}</strong>
                    <span style="color: #94a3b8; font-size: 0.8rem;">Ref: <span style="color: ${refColor};">${refText}</span></span>
                </div>
                ${acoesHtml}
            </div>
        `;
    });
}

window.fazerUploadDocFrota = async function(event, identificador, tipo_documento) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
        alert("Apenas arquivos PDF são permitidos.");
        event.target.value = ''; 
        return;
    }

    const labelContainer = event.target.parentElement;
    const cacheHtmlOriginal = labelContainer.innerHTML;
    
    labelContainer.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    labelContainer.style.pointerEvents = 'none';
    labelContainer.style.opacity = '0.7';

    try {
        const timeStamp = new Date().getTime();
        const path = `${identificador}/${tipo_documento}_${timeStamp}.pdf`;
        const url = await db.uploadArquivoFrota(file, path);

        const novoMetadado = {
            identificador: identificador,
            tipo_documento: tipo_documento,
            arquivo_path: path,
            arquivo_url: url
        };

        await db.addDocumentoFrota(novoMetadado);
        
        const identificadoresConjunto = [frotaSelecionadaDocs.cavalo, frotaSelecionadaDocs.carreta1, frotaSelecionadaDocs.carreta2, frotaSelecionadaDocs.carreta3, 'GLOBAL_DOCS'].filter(Boolean);
        documentosAtuaisDB = await db.getDocumentosFrota(identificadoresConjunto);
        renderizarItensUpload();
        
    } catch (e) {
        alert("Erro no upload do arquivo.");
        console.error(e);
        labelContainer.innerHTML = cacheHtmlOriginal;
        labelContainer.style.pointerEvents = 'auto';
        labelContainer.style.opacity = '1';
    }
};

window.excluirDocFrota = async function(identificador, tipo_documento, path) {
    if(!confirm("Tem certeza que deseja excluir este documento?")) return;
    try {
        await db.deleteDocumentoFrota(identificador, tipo_documento, path);
        const identificadoresConjunto = [frotaSelecionadaDocs.cavalo, frotaSelecionadaDocs.carreta1, frotaSelecionadaDocs.carreta2, frotaSelecionadaDocs.carreta3, 'GLOBAL_DOCS'].filter(Boolean);
        documentosAtuaisDB = await db.getDocumentosFrota(identificadoresConjunto);
        renderizarItensUpload();
    } catch (e) {
        alert("Erro ao excluir arquivo.");
    }
};

// ================= MODAL E UPLOADS GLOBAIS =================

window.abrirModalGerenciarGlobais = async function() {
    document.getElementById('modalGerenciarGlobais').style.display = 'flex';
    document.getElementById('listaUploadGlobais').innerHTML = '<div style="text-align:center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Processando arquivos globais...</div>';
    
    documentosGlobaisAtuaisDB = await db.getDocumentosFrota(['GLOBAL_DOCS']);
    renderizarItensUploadGlobais();
};

window.fecharModalGerenciarGlobais = function() {
    document.getElementById('modalGerenciarGlobais').style.display = 'none';
};

function renderizarItensUploadGlobais() {
    const container = document.getElementById('listaUploadGlobais');
    container.innerHTML = '';

    const globais = ESTRUTURA_DOCUMENTOS.filter(d => d.is_global);

    globais.forEach(tipoDoc => {
        const placaAlvo = 'GLOBAL_DOCS';
        const docEncontrado = documentosGlobaisAtuaisDB.find(d => d.identificador === placaAlvo && d.tipo_documento === tipoDoc.id);

        let acoesHtml = '';
        if (docEncontrado) {
            acoesHtml = `
                <div style="display: flex; gap: 5px; align-items: center;">
                    <a href="${docEncontrado.arquivo_url}" target="_blank" class="btn-primary-blue" style="padding: 5px 10px; text-decoration: none; font-size: 0.8rem;"><i class="fas fa-eye"></i> Ver</a>
                    <label style="cursor: pointer; background-color: #f59e0b; color: #fff; padding: 5px 10px; border-radius: 4px; font-size: 0.8rem; margin: 0; display: inline-flex; align-items: center; gap: 5px;">
                        <i class="fas fa-sync-alt"></i> Atualizar
                        <input type="file" accept="application/pdf" style="display: none;" onchange="fazerUploadDocGlobal(event, '${tipoDoc.id}')">
                    </label>
                    <button class="btn-delete" style="padding: 5px 10px; font-size: 0.8rem;" onclick="excluirDocGlobal('${tipoDoc.id}', '${docEncontrado.arquivo_path}')"><i class="fas fa-trash"></i> Excluir</button>
                </div>
            `;
        } else {
            acoesHtml = `
                <div style="display: flex; gap: 5px; align-items: center;">
                    <label style="cursor: pointer; background-color: var(--ccol-blue-bright); color: #fff; padding: 5px 15px; border-radius: 4px; font-size: 0.8rem; margin: 0; display: inline-flex; align-items: center; gap: 5px;">
                        <i class="fas fa-upload"></i> Enviar PDF
                        <input type="file" accept="application/pdf" style="display: none;" onchange="fazerUploadDocGlobal(event, '${tipoDoc.id}')">
                    </label>
                </div>
            `;
        }

        container.innerHTML += `
            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-dim); padding: 10px 15px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 5px;">
                <div>
                    <strong style="color: #fff; display: block; font-size: 0.95rem;">${tipoDoc.nome}</strong>
                    <span style="color: #94a3b8; font-size: 0.8rem;">Aplica-se a: <span style="color: #10b981;">Todos os Conjuntos (Frota Inteira)</span></span>
                </div>
                ${acoesHtml}
            </div>
        `;
    });
}

window.fazerUploadDocGlobal = async function(event, tipo_documento) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
        alert("Apenas arquivos PDF são permitidos.");
        event.target.value = ''; 
        return;
    }

    const labelContainer = event.target.parentElement;
    const cacheHtmlOriginal = labelContainer.innerHTML;
    
    labelContainer.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    labelContainer.style.pointerEvents = 'none';
    labelContainer.style.opacity = '0.7';

    try {
        const timeStamp = new Date().getTime();
        const path = `GLOBAL_DOCS/${tipo_documento}_${timeStamp}.pdf`;
        const url = await db.uploadArquivoFrota(file, path);

        const novoMetadado = {
            identificador: 'GLOBAL_DOCS',
            tipo_documento: tipo_documento,
            arquivo_path: path,
            arquivo_url: url
        };

        await db.addDocumentoFrota(novoMetadado);
        
        documentosGlobaisAtuaisDB = await db.getDocumentosFrota(['GLOBAL_DOCS']);
        renderizarItensUploadGlobais();
        
    } catch (e) {
        alert("Erro no upload do arquivo.");
        console.error(e);
        labelContainer.innerHTML = cacheHtmlOriginal;
        labelContainer.style.pointerEvents = 'auto';
        labelContainer.style.opacity = '1';
    }
};

window.excluirDocGlobal = async function(tipo_documento, path) {
    if(!confirm("Tem certeza que deseja excluir este documento global? Ele deixará de aparecer no PDF de toda a frota.")) return;
    try {
        await db.deleteDocumentoFrota('GLOBAL_DOCS', tipo_documento, path);
        documentosGlobaisAtuaisDB = await db.getDocumentosFrota(['GLOBAL_DOCS']);
        renderizarItensUploadGlobais();
    } catch (e) {
        alert("Erro ao excluir arquivo.");
    }
};

// ================= GERAÇÃO DE RELATÓRIOS EM PDF =================

function setLoadingState(active, text = "Gerando Relatório de Documentos...") {
    const overlay = document.getElementById('loadingPdfOverlay');
    const textEl = document.getElementById('loadingPdfText');
    if (active) {
        textEl.innerText = text;
        overlay.style.display = 'flex';
    } else {
        overlay.style.display = 'none';
    }
}

async function buildPdfBufferParaFrota(frotaObj, PDFDocument) {
    const pdfDoc = await PDFDocument.create();
    
    const { StandardFonts, rgb } = window.PDFLib;
    const helveticaBold = await pdfDoc.embedStandardFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedStandardFont(StandardFonts.Helvetica);

    const coverPage = pdfDoc.addPage([595.28, 841.89]); // Cria página A4 padrão
    const { width, height } = coverPage.getSize();

    // 1. Logotipo posicionado mais acima na página
    try {
        const logoBytes = await fetch('assets/logoverde.png').then(res => res.arrayBuffer());
        const logoImage = await pdfDoc.embedPng(logoBytes);
        const logoDims = logoImage.scale(0.85); 
        coverPage.drawImage(logoImage, {
            x: (width / 2) - (logoDims.width / 2),
            y: height - 160,
            width: logoDims.width,
            height: logoDims.height,
        });
    } catch(e) { console.warn("Logotipo não encontrado para o PDF."); }

    // 2. Placa maior e em NEGRITO
    const placaText = frotaObj.cavalo || 'S/ PLACA';
    const placaSize = 44;
    const placaWidth = helveticaBold.widthOfTextAtSize(placaText, placaSize);
    coverPage.drawText(placaText, { 
        x: (width / 2) - (placaWidth / 2), 
        y: height - 240, 
        size: placaSize,
        font: helveticaBold,
        color: rgb(0, 0, 0) // PRETO ABSOLUTO
    });

    // 3. Texto do GO 
    const goText = `GO ${frotaObj.go || 'S/ GO'}`;
    const goSize = 26;
    const goWidth = helveticaBold.widthOfTextAtSize(goText, goSize);
    coverPage.drawText(goText, { 
        x: (width / 2) - (goWidth / 2), 
        y: height - 285, 
        size: goSize,
        font: helveticaBold,
        color: rgb(0, 0, 0) // PRETO ABSOLUTO
    });

    // 4. Buscar os arquivos (Específicos + Globais) para listar o índice
    const identificadores = [frotaObj.cavalo, frotaObj.carreta1, frotaObj.carreta2, frotaObj.carreta3, 'GLOBAL_DOCS'].filter(Boolean);
    const docs = await db.getDocumentosFrota(identificadores);

    // Título do índice/relação de documentos
    const indexTitle = "RELAÇÃO DE DOCUMENTOS DO CONJUNTO";
    const indexTitleSize = 12;
    const indexTitleWidth = helveticaBold.widthOfTextAtSize(indexTitle, indexTitleSize);
    coverPage.drawText(indexTitle, {
        x: (width / 2) - (indexTitleWidth / 2),
        y: height - 340,
        size: indexTitleSize,
        font: helveticaBold,
        color: rgb(0, 0, 0) 
    });

    // Linha fina divisória abaixo do título
    coverPage.drawLine({
        start: { x: 70, y: height - 350 },
        end: { x: width - 70, y: height - 350 },
        thickness: 1,
        color: rgb(0, 0, 0)
    });

    // Lista dinâmica com caixas de status na folha de rosto
    let currentY = height - 370;
    const spacing = 18; 

    for (let tipo of ESTRUTURA_DOCUMENTOS) {
        const placaRef = tipo.is_global ? 'GLOBAL_DOCS' : frotaObj[tipo.ref_key];
        if (!tipo.is_global && !placaRef) continue; 

        const docEncontrado = docs.find(d => d.identificador === placaRef && d.tipo_documento === tipo.id);
        
        const statusBox = docEncontrado ? "[ X ]" : "[   ]";
        const itemColor = docEncontrado ? rgb(0.1, 0.55, 0.1) : rgb(0, 0, 0); 
        const fontItem = docEncontrado ? helveticaBold : helvetica;

        coverPage.drawText(statusBox, { x: 80, y: currentY, size: 10, font: helveticaBold, color: itemColor });
        coverPage.drawText(tipo.nome, { x: 120, y: currentY, size: 10, font: fontItem, color: rgb(0, 0, 0) });

        const textoDireita = tipo.is_global ? `(GLOBAL)` : `(${placaRef})`;
        coverPage.drawText(textoDireita, {
            x: width - 170,
            y: currentY,
            size: 9,
            font: helveticaBold, 
            color: rgb(0, 0, 0)
        });

        currentY -= spacing;
    }

    // --- ANEXAÇÃO SEQUENCIAL DOS ARQUIVOS COMPILADOS NAS PÁGINAS SEGUINTES ---
    let separadorCrlvCarretasAdicionado = false;
    let separadorInspecaoCarretasAdicionado = false;

    for (let tipo of ESTRUTURA_DOCUMENTOS) {
        const placaRef = tipo.is_global ? 'GLOBAL_DOCS' : frotaObj[tipo.ref_key];
        if (!tipo.is_global && !placaRef) continue;

        const docEncontrado = docs.find(d => d.identificador === placaRef && d.tipo_documento === tipo.id);
        if (docEncontrado) {
            try {
                const pdfArquivoBytes = await fetch(docEncontrado.arquivo_url).then(res => res.arrayBuffer());
                const attachedPdf = await PDFDocument.load(pdfArquivoBytes);

                const isCarretaCrlv = ['crlv_c1', 'crlv_c2', 'crlv_c3'].includes(tipo.id);
                const isCarretaInspecao = ['inspecao_c1', 'inspecao_c2', 'inspecao_c3'].includes(tipo.id);
                let deveAdicionarSeparador = true;

                // Evita criar páginas duplicadas para os agrupamentos de carretas
                if (isCarretaCrlv && separadorCrlvCarretasAdicionado) {
                    deveAdicionarSeparador = false;
                }
                if (isCarretaInspecao && separadorInspecaoCarretasAdicionado) {
                    deveAdicionarSeparador = false;
                }

                if (deveAdicionarSeparador) {
                    const separatorPage = pdfDoc.addPage([595.28, 841.89]);
                    const sWidth = separatorPage.getWidth();
                    const sHeight = separatorPage.getHeight();

                    // Inserir o Logotipo na página separadora
                    try {
                        const logoBytesSep = await fetch('assets/logoverde.png').then(res => res.arrayBuffer());
                        const logoImageSep = await pdfDoc.embedPng(logoBytesSep);
                        const logoDimsSep = logoImageSep.scale(0.7);
                        separatorPage.drawImage(logoImageSep, {
                            x: (sWidth / 2) - (logoDimsSep.width / 2),
                            y: (sHeight / 2) + 40,
                            width: logoDimsSep.width,
                            height: logoDimsSep.height,
                        });
                    } catch(e) { console.warn("Logotipo não disponível para separadores."); }

                    let mainTitle = tipo.nome;
                    let subTitle = tipo.is_global ? "DOCUMENTO COMPARTILHADO GLOBAL" : `CONJUNTO VINCULADO: ${placaRef}`;

                    // Configura Título e Subtítulo exclusivos das capas unificadas das carretas
                    if (isCarretaCrlv) {
                        mainTitle = `GO ${frotaObj.go || 'S/ GO'}`; 
                        const carretasPlacas = [frotaObj.carreta1, frotaObj.carreta2, frotaObj.carreta3].filter(Boolean).join(' / ');
                        subTitle = `CRLV - PLACAS: ${carretasPlacas}`;
                        separadorCrlvCarretasAdicionado = true;
                    } else if (isCarretaInspecao) {
                        mainTitle = `GO ${frotaObj.go || 'S/ GO'}`; 
                        const carretasPlacas = [frotaObj.carreta1, frotaObj.carreta2, frotaObj.carreta3].filter(Boolean).join(' / ');
                        subTitle = `ELETROMECÂNICA - PLACAS: ${carretasPlacas}`;
                        separadorInspecaoCarretasAdicionado = true;
                    }

                    // Desenhar Título Principal
                    const docNameSize = 24;
                    const docNameWidth = helveticaBold.widthOfTextAtSize(mainTitle, docNameSize);
                    separatorPage.drawText(mainTitle, {
                        x: (sWidth / 2) - (docNameWidth / 2),
                        y: (sHeight / 2) - 40,
                        size: docNameSize,
                        font: helveticaBold,
                        color: rgb(0, 0, 0)
                    });

                    // Desenhar Subtítulo (Referência / Placas / Tipo)
                    const refSubtitleSize = 14;
                    const refSubtitleWidth = helveticaBold.widthOfTextAtSize(subTitle, refSubtitleSize);
                    separatorPage.drawText(subTitle, {
                        x: (sWidth / 2) - (refSubtitleWidth / 2),
                        y: (sHeight / 2) - 75,
                        size: refSubtitleSize,
                        font: helveticaBold,
                        color: rgb(0.3, 0.3, 0.3)
                    });
                }

                // Copiar as páginas originais do arquivo PDF correspondente
                const copiedPages = await pdfDoc.copyPages(attachedPdf, attachedPdf.getPageIndices());
                copiedPages.forEach((page) => pdfDoc.addPage(page));
                
            } catch(err) {
                console.error(`Erro ao anexar documento:`, err);
            }
        }
    }
    return await pdfDoc.save();
}

window.gerarRelatorioPdfUnico = async function(idFrota) {
    if (typeof window.PDFLib === 'undefined') return alert("Aguarde o carregamento inicial.");
    
    const frota = listaDeFrotasIndependente.find(f => f.id === idFrota);
    if (!frota) return alert("Conjunto não encontrado.");

    setLoadingState(true, `Compilando dossiê do Cavalo ${frota.cavalo}...`);
    try {
        const { PDFDocument } = window.PDFLib;
        const pdfBytes = await buildPdfBufferParaFrota(frota, PDFDocument);

        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Dossie_Frota_${frota.cavalo}.pdf`;
        link.click();
    } catch(e) {
        console.error(e);
        alert("Ocorreu um erro ao gerar o PDF.");
    } finally {
        setLoadingState(false);
    }
};

window.gerarRelatorioPdfTodos = async function() {
    if (typeof window.PDFLib === 'undefined' || listaDeFrotasIndependente.length === 0) return alert("Nenhum dado encontrado.");
    
    if(!confirm("Deseja gerar o relatório unificado de TODOS os cavalos cadastrados?")) return;

    setLoadingState(true, "Processando todas as viaturas da frota. Por favor, aguarde...");
    try {
        const { PDFDocument } = window.PDFLib;
        const masterPdf = await PDFDocument.create();

        for (let i = 0; i < listaDeFrotasIndependente.length; i++) {
            const frota = listaDeFrotasIndependente[i];
            const subPdfBytes = await buildPdfBufferParaFrota(frota, PDFDocument);
            const subPdf = await PDFDocument.load(subPdfBytes);

            const copiedPages = await masterPdf.copyPages(subPdf, subPdf.getPageIndices());
            copiedPages.forEach((page) => masterPdf.addPage(page));
        }

        const finalBytes = await masterPdf.save();
        const blob = new Blob([finalBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Relatorio_Completo_Frotas_Geral.pdf`;
        link.click();

    } catch (e) {
        console.error(e);
        alert("Ocorreu um erro ao compilar o relatório unificado.");
    } finally {
        setLoadingState(false);
    }
};