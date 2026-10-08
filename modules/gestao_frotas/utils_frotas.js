/* =========================================================
   UTILITÁRIOS BASE - GESTÃO DE FROTAS
   PDF.js + IndexedDB + Calendários DETRAN + Helpers
   ========================================================= */

// ============ CONFIGURAÇÃO DO PDF.js ============
if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ============ CONSTANTES ============
window.UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

// Calendário de vencimento do CRLV por final de placa (DETRAN-BA por padrão)
window.CALENDARIOS = {
    BA: {
        1: { mes: 8,  dia: 31 }, // Agosto
        2: { mes: 9,  dia: 30 }, // Setembro
        3: { mes: 10, dia: 31 }, // Outubro
        4: { mes: 10, dia: 31 },
        5: { mes: 11, dia: 30 }, // Novembro
        6: { mes: 11, dia: 30 },
        7: { mes: 12, dia: 31 }, // Dezembro
        8: { mes: 12, dia: 31 },
        9: { mes: 7,  dia: 31 }, // Julho
        0: { mes: 7,  dia: 31 }
    },
    ES: {
        1: { mes: 4, dia: 30 }, 2: { mes: 5, dia: 31 }, 3: { mes: 6, dia: 30 },
        4: { mes: 7, dia: 31 }, 5: { mes: 8, dia: 31 }, 6: { mes: 9, dia: 30 },
        7: { mes: 10, dia: 31 }, 8: { mes: 11, dia: 30 }, 9: { mes: 12, dia: 31 }, 0: { mes: 12, dia: 31 }
    },
    MG: {
        1: { mes: 3, dia: 31 }, 2: { mes: 4, dia: 30 }, 3: { mes: 5, dia: 31 },
        4: { mes: 6, dia: 30 }, 5: { mes: 7, dia: 31 }, 6: { mes: 8, dia: 31 },
        7: { mes: 9, dia: 30 }, 8: { mes: 10, dia: 31 }, 9: { mes: 11, dia: 30 }, 0: { mes: 12, dia: 31 }
    },
    SP: {
        1: { mes: 1, dia: 31 }, 2: { mes: 2, dia: 28 }, 3: { mes: 3, dia: 31 },
        4: { mes: 4, dia: 30 }, 5: { mes: 5, dia: 31 }, 6: { mes: 6, dia: 30 },
        7: { mes: 7, dia: 31 }, 8: { mes: 8, dia: 31 }, 9: { mes: 9, dia: 30 }, 0: { mes: 12, dia: 31 }
    },
    RJ: {
        1: { mes: 1, dia: 31 }, 2: { mes: 2, dia: 28 }, 3: { mes: 3, dia: 31 },
        4: { mes: 4, dia: 30 }, 5: { mes: 5, dia: 31 }, 6: { mes: 6, dia: 30 },
        7: { mes: 7, dia: 31 }, 8: { mes: 8, dia: 31 }, 9: { mes: 9, dia: 30 }, 0: { mes: 12, dia: 31 }
    }
};

// ============ HELPERS ============
window.chaveCRLV = function (placa) {
    return 'crlv_' + String(placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
};

window.formatarData = function (d) {
    if (!d) return '-';
    try {
        const dt = (d instanceof Date) ? d : new Date(d);
        if (isNaN(dt.getTime())) return '-';
        return dt.toLocaleDateString('pt-BR');
    } catch { return '-'; }
};

// ============ INDEXEDDB - ARMAZENAMENTO DE PDFs ============
const DB_PDF_NOME = 'sisf_frotas_pdfs';
const DB_PDF_VERSAO = 1;
const STORE_PDF = 'pdfs';

function abrirDBPDF() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_PDF_NOME, DB_PDF_VERSAO);
        req.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_PDF)) {
                db.createObjectStore(STORE_PDF, { keyPath: 'chave' });
            }
        };
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = e => reject(e.target.error);
    });
}

window.salvarPDF = async function (chave, blob) {
    const db = await abrirDBPDF();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PDF, 'readwrite');
        tx.objectStore(STORE_PDF).put({
            chave,
            blob,
            nome: blob.name || 'documento.pdf',
            tipo: blob.type || 'application/pdf',
            data: new Date().toISOString()
        });
        tx.oncomplete = () => resolve(true);
        tx.onerror = e => reject(e.target.error);
    });
};

window.obterPDF = async function (chave) {
    const db = await abrirDBPDF();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PDF, 'readonly');
        const req = tx.objectStore(STORE_PDF).get(chave);
        req.onsuccess = e => resolve(e.target.result || null);
        req.onerror = e => reject(e.target.error);
    });
};

window.excluirPDF = async function (chave) {
    const db = await abrirDBPDF();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PDF, 'readwrite');
        tx.objectStore(STORE_PDF).delete(chave);
        tx.oncomplete = () => resolve(true);
        tx.onerror = e => reject(e.target.error);
    });
};

// ============ LEITURA DE PDF ============
window.lerTextoPDF = async function (file) {
    if (!window.pdfjsLib) throw new Error("PDF.js não carregado.");
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let textoTotal = '';
    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        let ultimoY = null;
        let linhaAtual = '';
        const linhas = [];
        content.items.forEach(item => {
            const y = item.transform[5];
            if (ultimoY !== null && Math.abs(y - ultimoY) > 2) {
                if (linhaAtual.trim()) linhas.push(linhaAtual.trim());
                linhaAtual = '';
            }
            linhaAtual += (linhaAtual ? ' ' : '') + item.str;
            ultimoY = y;
        });
        if (linhaAtual.trim()) linhas.push(linhaAtual.trim());
        textoTotal += linhas.join('\n') + '\n';
    }
    return textoTotal;
};

// ============ MODAIS BASE ============
window.configurarModaisBaseFrotas = function () {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', e => {
            if (e.target === overlay) overlay.style.display = 'none';
        });
        overlay.querySelectorAll('[data-close]').forEach(btn => {
            btn.addEventListener('click', () => { overlay.style.display = 'none'; });
        });
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
        }
    });
};

window.fecharModaisFrotas = function () {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
};

// ============ VISUALIZADOR DE PDF ============
window.abrirModalPdf = async function (chave, titulo) {
    const modal = document.getElementById('modalPdf');
    const container = document.getElementById('pdfContainer');
    const tituloEl = document.getElementById('modalPdfTitulo');
    const linkDownload = document.getElementById('pdfDownload');
    if (!modal || !container) return;

    if (tituloEl) tituloEl.innerHTML = `<i class="fas fa-file-pdf"></i> ${titulo || 'Visualizador de Documento'}`;
    container.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">Carregando PDF...</p>';
    if (linkDownload) linkDownload.style.display = 'none';
    modal.style.display = 'flex';

    try {
        const registro = await window.obterPDF(chave);
        if (!registro || !registro.blob) {
            container.innerHTML = '<p style="color: #f87171; font-style: italic;">Nenhum PDF armazenado para este veículo.</p>';
            return;
        }
        const url = URL.createObjectURL(registro.blob);
        container.innerHTML = `<iframe src="${url}" style="width:100%; height:100%; border:0;"></iframe>`;
        if (linkDownload) {
            linkDownload.href = url;
            linkDownload.download = registro.nome || 'documento.pdf';
            linkDownload.style.display = 'inline-block';
        }
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="color: #f87171; font-style: italic;">Erro ao carregar PDF.</p>';
    }
};

// ============ MODAL DE ATUALIZAÇÃO (DIFF) ============
window.abrirModalAtualizacao = function (titulo, antigo, novo, tipo) {
    const modal = document.getElementById('modalAtualizar');
    const tituloEl = document.getElementById('modalAtualizarTitulo');
    const tbody = document.getElementById('modalAtualizarTbody');
    if (!modal || !tbody) return;

    if (tituloEl) tituloEl.innerHTML = `<i class="fas fa-sync-alt"></i> ${titulo}`;

    const mapaCamel = {
        placa: 'Placa', renavam: 'Renavam', exercicio: 'Exercício',
        anoFabricacao: 'Ano Fabricação', anoModelo: 'Ano Modelo',
        numeroCRV: 'Nº CRV', marcaModelo: 'Marca/Modelo', especieTipo: 'Espécie/Tipo',
        chassi: 'Chassi', cor: 'Cor', combustivel: 'Combustível',
        potencia: 'Potência', pesoBruto: 'Peso Bruto', nome: 'Proprietário',
        cpfCnpj: 'CPF/CNPJ', local: 'Município', uf: 'UF', data: 'Emissão',
        tipoVeiculo: 'Tipo Veículo', apelido: 'Apelido', numeroGO: 'Nº GO'
    };

    let html = '';
    Object.keys(mapaCamel).forEach(k => {
        const vAntigo = antigo ? (antigo[k] || '-') : '-';
        const vNovo = novo ? (novo[k] || '-') : '-';
        const mudou = String(vAntigo) !== String(vNovo) && vNovo !== '-' && vNovo !== '';
        if (mudou) {
            html += `<tr>
                <td style="color: var(--text-secondary); font-weight: 600;">${mapaCamel[k]}</td>
                <td style="color: #f87171; text-decoration: line-through;">${vAntigo}</td>
                <td style="color: #4ade80; font-weight: 700;">${vNovo}</td>
            </tr>`;
        }
    });

    if (!html) {
        html = `<tr><td colspan="3" style="text-align:center; color: var(--text-secondary); padding: 20px;">Nenhuma alteração detectada.</td></tr>`;
    }

    tbody.innerHTML = html;
    modal.style.display = 'flex';
};