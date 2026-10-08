/* =========================================================
   MÓDULO: CADASTROS E DOCUMENTOS (CRLV DIGITAL)
   - Extração robusta de CRLV-e (DETRAN-BA e DETRAN-ES)
   - Persistência 100% no Supabase (tabela + storage)
   - PDF salvo no bucket 'frotas-crlv' e URL guardada no banco
   - Respeita hierarquia de filial
   - Permite a MESMA PLACA em filiais diferentes (chave composta placa+filial)
   ========================================================= */

window.initFrotaCadastros = function() {
    let listaVeiculosMemoria = [];
    let mapaFiliais = {};
    let pdfBlobPendente = null;
    let ultimoTextoBruto = "";
    let placaEmAtualizacao = null;
    let filialEmAtualizacao = null;
    let novoPDFEmAtualizacao = null;
    let novosDadosEmAtualizacao = null;

    const TIPOS_COM_GO = ["Carreta", "Prancha", "Bitrem", "Tritrem", "Rodotrem", "Reboque", "Semirreboque"];

    function tipoUsaGO(tipo) {
        return TIPOS_COM_GO.includes(tipo);
    }

    function classeTipo(tipo) {
        if (!tipo) return "outro";
        return tipo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
    }

    function isUsuarioGlobal() {
        return !!(window.currentUser && (
            window.currentUser.role === 'SuperAdmin' ||
            window.currentUser.filial_id === null ||
            window.currentUser.is_global_session === true
        ));
    }

    // Helper para achar um veículo pela chave composta
    function encontrarVeiculo(placa, filialId) {
        return listaVeiculosMemoria.find(x =>
            x.placa === placa &&
            (filialId === null || filialId === undefined || String(x.filial_id) === String(filialId))
        );
    }

    // =====================================================
    // INICIALIZAÇÃO
    // =====================================================
    async function inicializarModulo() {
        if (typeof window.configurarModaisBaseFrotas === "function") {
            window.configurarModaisBaseFrotas();
        }
        await carregarFiliaisSelect();
        popularSelectUFs();
        configurarEventosGerais();
        await carregarListaVeiculos();
    }

    async function carregarFiliaisSelect() {
        const selectForm = document.getElementById("filialSelectForm");
        const selectFiltro = document.getElementById("filtroFilialTabela");
        if (!selectForm) return;

        const isGlobal = isUsuarioGlobal();

        let filiais = [];
        try {
            if (isGlobal && typeof db.getTodasFiliaisAdmin === "function") {
                filiais = await db.getTodasFiliaisAdmin();
            } else if (typeof db.getFiliais === "function") {
                filiais = await db.getFiliais();
            }
        } catch (e) {
            console.error("Erro ao carregar filiais:", e);
            filiais = [];
        }

        mapaFiliais = {};

        if (isGlobal) {
            selectForm.innerHTML = '<option value="">-- Selecione a Filial --</option>';
            selectForm.disabled = false;
            filiais.forEach(f => {
                mapaFiliais[f.id] = f.nome;
                selectForm.innerHTML += `<option value="${f.id}">${f.nome}</option>`;
            });
            if (window.currentUser && window.currentUser.filial_id) {
                selectForm.value = window.currentUser.filial_id;
            }
        } else if (window.currentUser && window.currentUser.filial_id) {
            const minhaFilialId = window.currentUser.filial_id;
            let nomeMinhaFilial = `Filial ${minhaFilialId}`;
            if (filiais.length > 0) {
                const encontrada = filiais.find(f => f.id == minhaFilialId);
                if (encontrada) nomeMinhaFilial = encontrada.nome;
            } else if (window.currentUser.filiais && window.currentUser.filiais.nome) {
                nomeMinhaFilial = window.currentUser.filiais.nome;
            }
            mapaFiliais[minhaFilialId] = nomeMinhaFilial;
            selectForm.innerHTML = `<option value="${minhaFilialId}" selected>${nomeMinhaFilial}</option>`;
            selectForm.disabled = true;
        } else {
            selectForm.innerHTML = '<option value="">-- Sem Filial --</option>';
            selectForm.disabled = true;
        }

        if (selectFiltro) {
            if (isGlobal) {
                selectFiltro.style.display = "inline-block";
                selectFiltro.disabled = false;
                selectFiltro.innerHTML = '<option value="TODAS">Todas as Filiais</option>';
                filiais.forEach(f => {
                    mapaFiliais[f.id] = f.nome;
                    selectFiltro.innerHTML += `<option value="${f.id}">${f.nome}</option>`;
                });
            } else {
                selectFiltro.style.display = "none";
                selectFiltro.innerHTML = '<option value="TODAS">Todas as Filiais</option>';
            }
        }
    }

    function popularSelectUFs() {
        const sel = document.getElementById("ufSelectForm");
        if (!sel) return;
        sel.innerHTML = "";
        const ufs = window.UFS || ["BA", "ES", "MG", "SP", "RJ"];
        ufs.forEach(uf => {
            const opt = document.createElement("option");
            opt.value = uf;
            opt.textContent = uf;
            sel.appendChild(opt);
        });
    }

    // =====================================================
    // EVENTOS
    // =====================================================
    function configurarEventosGerais() {
        const dropZone = document.getElementById("dropZoneCRLV");
        const inputPdf = document.getElementById("pdfInputCRLV");
        const form = document.getElementById("formCRLVVeiculo");
        const selTipo = document.getElementById("tipoVeiculoSelect");
        const btnDebug = document.getElementById("btnVerDebugTexto");
        const inputAtualizar = document.getElementById("inputAtualizarArquivoCRLV");
        const btnConfirmarAtualizacao = document.getElementById("btnConfirmarAtualizacaoCRLV");

        if (selTipo) {
            selTipo.addEventListener("change", atualizarRotuloIdentificacao);
        }

        if (inputPdf) {
            inputPdf.addEventListener("change", e => {
                const file = e.target.files[0];
                if (file) processarArquivoPDF(file);
            });
        }

        if (dropZone) {
            ["dragenter", "dragover"].forEach(ev => {
                dropZone.addEventListener(ev, e => {
                    e.preventDefault();
                    dropZone.classList.add("dragover");
                });
            });
            ["dragleave", "drop"].forEach(ev => {
                dropZone.addEventListener(ev, e => {
                    e.preventDefault();
                    dropZone.classList.remove("dragover");
                });
            });
            dropZone.addEventListener("drop", e => {
                const file = e.dataTransfer.files[0];
                if (file && file.type === "application/pdf") {
                    processarArquivoPDF(file);
                } else {
                    mostrarStatus("Por favor, selecione um arquivo em formato PDF.", "err");
                }
            });
        }

        if (btnDebug) {
            btnDebug.addEventListener("click", () => {
                const pre = document.getElementById("preDebugTexto");
                if (pre.style.display === "block") {
                    pre.style.display = "none";
                    btnDebug.innerHTML = '<i class="fas fa-code"></i> Inspecionar texto extraído';
                } else {
                    pre.textContent = ultimoTextoBruto || "(Nenhum PDF lido ainda)";
                    pre.style.display = "block";
                    btnDebug.innerHTML = '<i class="fas fa-eye-slash"></i> Ocultar texto extraído';
                }
            });
        }

        if (form) {
            form.removeEventListener("submit", submeterFormularioCRLV);
            form.addEventListener("submit", submeterFormularioCRLV);
        }

        if (inputAtualizar) {
            inputAtualizar.addEventListener("change", async e => {
                const file = e.target.files[0];
                inputAtualizar.value = "";
                if (!file || !placaEmAtualizacao) return;
                try {
                    novoPDFEmAtualizacao = file;
                    const texto = await window.lerTextoPDF(file);
                    const dados = extrairCamposCRLV(texto);
                    const antigo = encontrarVeiculo(placaEmAtualizacao, filialEmAtualizacao);
                    if (antigo) {
                        dados.tipoVeiculo = antigo.tipo_veiculo || antigo.tipoVeiculo || "";
                        dados.apelido = antigo.apelido || "";
                        dados.numeroGO = antigo.numero_go || antigo.numeroGO || "";
                        dados.filial_id = antigo.filial_id;
                    }
                    if (!dados.placa) dados.placa = placaEmAtualizacao;
                    dados.placa = dados.placa.toUpperCase();
                    novosDadosEmAtualizacao = dados;
                    window.abrirModalAtualizacao(`Documento da Placa ${placaEmAtualizacao}`, antigo, dados, "crlv");
                } catch (err) {
                    console.error(err);
                    alert("Erro ao ler novo PDF: " + err.message);
                    placaEmAtualizacao = null;
                    filialEmAtualizacao = null;
                }
            });
        }

        if (btnConfirmarAtualizacao) {
            btnConfirmarAtualizacao.removeEventListener("click", confirmarAtualizacaoCRLV);
            btnConfirmarAtualizacao.addEventListener("click", confirmarAtualizacaoCRLV);
        }
    }

    function atualizarRotuloIdentificacao() {
        const sel = document.getElementById("tipoVeiculoSelect");
        const label = document.getElementById("labelApelidoForm");
        const input = document.getElementById("apelidoInputForm");
        if (!sel || !label || !input) return;

        if (tipoUsaGO(sel.value)) {
            label.innerHTML = 'Número do GO <span style="color:#ef4444;">*</span>';
            input.placeholder = "Ex: GO-2026-0084";
        } else {
            label.innerHTML = "Apelido / Identificação Interna";
            input.placeholder = "Ex: Cavalo 105, Frota Apoio";
        }
    }

    window.alternarAbaCadastro = function(aba) {
        const btnPdf = document.getElementById("btnTabImportarPDF");
        const btnManual = document.getElementById("btnTabManual");
        const painelPdf = document.getElementById("painelImportacaoPDF");
        const painelForm = document.getElementById("painelFormulario");

        if (aba === "pdf") {
            btnPdf.classList.add("active");
            btnManual.classList.remove("active");
            painelPdf.style.display = "block";
            painelForm.style.display = "none";
        } else {
            btnManual.classList.add("active");
            btnPdf.classList.remove("active");
            painelPdf.style.display = "none";
            painelForm.style.display = "block";
            document.getElementById("formCRLVVeiculo").reset();
            atualizarRotuloIdentificacao();
            popularSelectUFs();
            if (window.currentUser && window.currentUser.filial_id) {
                document.getElementById("filialSelectForm").value = window.currentUser.filial_id;
            }
            pdfBlobPendente = null;
        }
    };

    window.limparFormularioCRLV = function() {
        document.getElementById("formCRLVVeiculo").reset();
        document.getElementById("pdfUploadNome").textContent = "";
        document.getElementById("statusLeituraPDF").textContent = "";
        document.getElementById("painelFormulario").style.display = "none";
        document.getElementById("painelImportacaoPDF").style.display = "block";
        document.getElementById("btnTabImportarPDF").classList.add("active");
        document.getElementById("btnTabManual").classList.remove("active");
        pdfBlobPendente = null;
    };

    function mostrarStatus(msg, tipo = "") {
        const el = document.getElementById("statusLeituraPDF");
        if (!el) return;
        el.textContent = msg;
        if (tipo === "err") el.style.color = "#ef4444";
        else if (tipo === "ok") el.style.color = "var(--ccol-green-bright)";
        else el.style.color = "var(--ccol-blue-bright)";
    }

    // =====================================================
    // PROCESSAMENTO DO PDF
    // =====================================================
    async function processarArquivoPDF(file) {
        document.getElementById("pdfUploadNome").textContent = `Arquivo: ${file.name}`;
        mostrarStatus("Lendo e decodificando documento digital...", "info");
        pdfBlobPendente = file;

        try {
            if (typeof window.lerTextoPDF !== "function") {
                throw new Error("Módulo leitor de PDF não encontrado.");
            }
            const textoCompleto = await window.lerTextoPDF(file);
            ultimoTextoBruto = textoCompleto;
            const dados = extrairCamposCRLV(textoCompleto);

            if (!dados.placa && !dados.renavam && !dados.chassi) {
                throw new Error("Não foi possível identificar placa ou renavam. O PDF pode ser uma imagem escaneada.");
            }

            preencherFormularioCRLV(dados);
            document.getElementById("painelFormulario").style.display = "block";
            mostrarStatus("CRLV reconhecido com sucesso! Revise os dados abaixo.", "ok");
            document.getElementById("painelFormulario").scrollIntoView({ behavior: "smooth" });
        } catch (err) {
            console.error(err);
            mostrarStatus(`Falha na leitura automática: ${err.message}. Você pode usar o "Lançamento Manual".`, "err");
            document.getElementById("painelFormulario").style.display = "block";
        }
    }

    // =====================================================
    // PARSER CRLV — HÍBRIDO (DETRAN-BA e DETRAN-ES)
    // =====================================================
    function extrairCamposCRLV(textoBruto) {
        const flat = textoBruto.replace(/\s+/g, " ").trim().toUpperCase();
        const linhas = textoBruto.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

        const linhasLimpa = linhas.filter(l => {
            const u = l.toUpperCase();
            if (/^REPÚBLICA FEDERATIVA/.test(u)) return false;
            if (/^MINISTÉRIO DOS TRANSPORTES/.test(u)) return false;
            if (/^SECRETARIA NACIONAL DE TRÂNSITO/.test(u)) return false;
            if (/^DETRAN[-\s]*[A-Z]{2}\s*$/.test(u)) return false;
            if (/^CERTIFICADO DE REGISTRO/.test(u)) return false;
            if (/^Valide este QRCode/i.test(l)) return false;
            if (/^QRCode$/i.test(l)) return false;
            if (/^DADOS DO SEGURO DPVAT$/i.test(u)) return false;
            if (/^INFORMAÇÕES DO SEGURO DPVAT/i.test(u)) return false;
            if (/^CAT\.\s*TARIF/.test(u)) return false;
            if (/^COTA ÚNICA/.test(u)) return false;
            if (/^REPASSE OBRIGATÓRIO/.test(u)) return false;
            if (/^FUNDO NACIONAL DE SAÚDE/.test(u)) return false;
            if (/^DEPARTAMENTO NACIONAL DE/.test(u)) return false;
            if (/^TRÂNSITO \(R\$\)/.test(u)) return false;
            if (/^BILHETE \(R\$\)/.test(u)) return false;
            if (/^DO SEGURO \(R\$\)/.test(u)) return false;
            if (/^CUSTO DO/.test(u)) return false;
            if (/^CUSTO EFETIVO/.test(u)) return false;
            if (/^PELO SEGURADO/.test(u)) return false;
            if (/^VALOR DO IOF/.test(u)) return false;
            if (/^VALOR TOTAL A SER PAGO/.test(u)) return false;
            if (/^Documento emitido por/.test(l)) return false;
            if (/^OBSERVAÇÕES DO VEÍCULO/.test(u)) return false;
            if (/^ALIENA[ÇC][ÃA]O FIDUCI[ÁA]RIA/.test(u)) return false;
            if (/^MENSAGENS SENATRAN/.test(u)) return false;
            if (/^Você Sabia/.test(l)) return false;
            if (/^Na Carteira Digital/.test(l)) return false;
            if (/^ainda ganha desconto/.test(l)) return false;
            if (/^serviços de trânsito/.test(l)) return false;
            if (/^Leia o QR Code/.test(l)) return false;
            if (/^ASSINADO DIGITALMENTE/.test(u)) return false;
            if (/^\*+$/.test(l)) return false;
            if (/^[★*.\s]+$/.test(l)) return false;
            if (/^(CÓDIGO RENAVAM|PLACA|EXERCÍCIO|ANO FABRICAÇÃO|ANO MODELO|NÚMERO DO CRV|MARCA \/ MODELO \/ VERSÃO|PLACA ANTERIOR \/ UF|CHASSI|COR PREDOMINANTE|ESPÉCIE \/ TIPO|COMBUSTÍVEL|CÓDIGO DE SEGURANÇA DO CLA|CAT|NOME|CPF \/ CNPJ|LOCAL|DATA|CATEGORIA|CAPACIDADE|POTÊNCIA\/CILINDRADA|PESO BRUTO TOTAL|CMT|EIXOS|LOTAÇÃO|MOTOR|CARROCERIA|INFORMAÇÕES DO SEGURO DPVAT|OBSERVAÇÕES DO VEÍCULO|MENSAGENS SENATRAN)$/i.test(u)) return false;
            return true;
        });

        const L = (i) => (linhasLimpa[i] !== undefined ? linhasLimpa[i] : "");
        const U = (i) => L(i).toUpperCase();

        const acharLinha = (regex, inicio = 0) => {
            for (let i = inicio; i < linhasLimpa.length; i++) {
                if (regex.test(U(i))) return i;
            }
            return -1;
        };

        const pegarGrupo = (regex, grupo = 1) => {
            for (let i = 0; i < linhasLimpa.length; i++) {
                const m = U(i).match(regex);
                if (m && m[grupo]) return m[grupo].trim();
            }
            return "";
        };

        // 1. RENAVAM
        let renavam = "";
        {
            let m = flat.match(/C[ÓO]DIGO\s*RENAVAM\s*(\d{9,11})/);
            if (m) renavam = m[1];
            if (!renavam) {
                m = flat.match(/\b(\d{11})\b/);
                if (m) renavam = m[1];
            }
        }

        // 2. PLACA + EXERCÍCIO
        let placa = "";
        let exercicio = "";
        {
            let m = flat.match(/PLACA\s*EXERC[ÍI]CIO\s*([A-Z]{3}\d[A-Z]\d{2})\s*(\d{4})/);
            if (m) { placa = m[1]; exercicio = m[2]; }
            if (!placa) {
                m = flat.match(/PLACA\s+EXERC[ÍI]CIO\s+([A-Z]{3}\d[A-Z]\d{2})\s+(\d{4})/);
                if (m) { placa = m[1]; exercicio = m[2]; }
            }
            if (!placa) {
                m = flat.match(/\b([A-Z]{3}\d[A-Z]\d{2})\s+(20\d{2})\b/);
                if (m) { placa = m[1]; exercicio = m[2]; }
            }
            if (!placa) {
                m = flat.match(/\b([A-Z]{3}\d[A-Z]\d{2})\b/);
                if (m) placa = m[1];
            }
            if (!exercicio) {
                m = flat.match(/EXERC[ÍI]CIO\s*(\d{4})/) || flat.match(/\b(20\d{2})\b/);
                if (m) exercicio = m[1];
            }
        }

        // 3. ANO FABRICAÇÃO / MODELO
        let anoFabricacao = "";
        let anoModelo = "";
        {
            let m = flat.match(/ANO\s*FABRICA[CÇ][ÃA]O\s*ANO\s*MODELO\s*((?:19|20)\d{2})\s*((?:19|20)\d{2})/);
            if (m) { anoFabricacao = m[1]; anoModelo = m[2]; }
            if (!anoFabricacao) {
                m = flat.match(/\b((?:19|20)\d{2})\s+((?:19|20)\d{2})\b/);
                if (m) { anoFabricacao = m[1]; anoModelo = m[2]; }
            }
        }

        // 4. NÚMERO DO CRV
        let numeroCRV = "";
        {
            let m = flat.match(/N[ÚU]MERO\s*DO\s*CRV\s*(\d{8,14})/);
            if (m) numeroCRV = m[1];
            if (!numeroCRV) {
                m = flat.match(/\b(\d{12})\b/);
                if (m) numeroCRV = m[1];
            }
        }

        // 5. CHASSI
        let chassi = "";
        {
            let m = flat.match(/CHASSI\s*([A-HJ-NPR-Z0-9]{17})/);
            if (m) chassi = m[1];
            if (!chassi) {
                m = flat.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
                if (m) chassi = m[1];
            }
        }

        // 6. MARCA / MODELO
        let marcaModelo = "";
        {
            for (let i = 0; i < linhasLimpa.length; i++) {
                const u = U(i);
                if (/^[A-Z]{3}\d[A-Z]\d{2}/.test(u)) continue;
                if (/^[A-HJ-NPR-Z0-9]{17}$/.test(u)) continue;
                if (/\d{2}\.\d{3}\.\d{3}/.test(u)) continue;
                const m = u.match(/^([A-Z][A-Z0-9\-\/\. ]*\/[A-Z0-9][A-Z0-9\-\/\. ]{2,40})$/);
                if (m && /(VOLVO|SCANIA|MERCEDES|VOLKSWAGEN|VW|FORD|IVECO|DAF|MAN|RANDON|FACCHINI|GUERRA|LIBRELATO|NOMA|CHEVROLET|TOYOTA|FIAT|RENAULT|AGRALE|MARCOPOLO|COMIL|NEOBUS|MASCARELLO)/.test(u)) {
                    marcaModelo = m[1].trim();
                    break;
                }
            }
            if (!marcaModelo) {
                const m = flat.match(/\b([A-Z]{3,}\/[A-Z0-9][A-Z0-9\-\/\. ]{2,30})\b/);
                if (m) marcaModelo = m[1].trim();
            }
        }

        // 7. ESPÉCIE / TIPO
        let especieTipo = "";
        {
            for (let i = 0; i < linhasLimpa.length; i++) {
                const u = U(i);
                if (/^[A-ZÀ-Ú\s]{6,60}$/.test(u) &&
                    /(TRACAO|TRAÇÃO|CAMINHAO|CAMINHÃO|TRATOR|AUTOMOVEL|AUTOMÓVEL|MOTOCICLETA|CAMINHONETE|UTILITARIO|UTILITÁRIO|ONIBUS|ÔNIBUS|REBOQUE|ESPECIAL|SEMIRREBOQUE|CARGA)/.test(u)) {
                    especieTipo = u.trim();
                    break;
                }
            }
        }

        // 8. COR + COMBUSTÍVEL
        let cor = "";
        let combustivel = "";
        {
            const CORES = ["AMARELA","AZUL","BEGE","BRANCA","CINZA","DOURADA","GRENÁ","GRENA",
                "LARANJA","MARROM","PRATA","PRETA","ROSA","ROXA","VERDE","VERMELHA","VINHO","FANTASIA","INDEFINIDA"];
            const COMBS = ["DIESEL","GASOLINA","ETANOL","FLEX","GNV","ÁLCOOL","ALCOOL",
                "ELÉTRICO","ELETRICO","HÍBRIDO","HIBRIDO","GÁS NATURAL","GAS NATURAL"];

            for (let i = 0; i < linhasLimpa.length; i++) {
                const u = U(i);
                for (const c of CORES) {
                    for (const cb of COMBS) {
                        const rx = new RegExp(`^\\s*${c}\\s+${cb}\\s*$`);
                        if (rx.test(u)) { cor = c; combustivel = cb; break; }
                    }
                    if (cor) break;
                }
                if (cor) break;
            }
            if (!cor) {
                for (let i = 0; i < linhasLimpa.length; i++) {
                    const u = U(i).trim();
                    if (CORES.includes(u)) { cor = u; break; }
                }
            }
            if (!combustivel) {
                for (let i = 0; i < linhasLimpa.length; i++) {
                    const u = U(i).trim();
                    if (COMBS.includes(u)) { combustivel = u; break; }
                }
            }
        }

        // 9. POTÊNCIA
        let potencia = "";
        {
            let m = flat.match(/POT[ÊE]NCIA\s*\/\s*CILINDRADA\s*(\d{2,5}\s*CV[A-Z0-9\/*]*)/);
            if (!m) m = flat.match(/\b(\d{2,5}\s*CV[A-Z0-9\/*]*)/);
            if (m) potencia = m[1].replace(/\*+$/, "").trim();
        }

        // 10. PESO BRUTO
        let pesoBruto = "";
        {
            let m = flat.match(/PESO\s*BRUTO\s*TOTAL\s*(\d{1,3}[.,]\d{1,3})/);
            if (!m) m = flat.match(/\bPBT\b[^\d]*(\d{1,3}[.,]\d{1,3})/);
            if (!m) m = flat.match(/\b(\d{2}\.\d)\b/);
            if (m) pesoBruto = m[1];
        }

        // 11. NOME / PROPRIETÁRIO
        let nome = "";
        {
            const idxNome = linhasLimpa.findIndex(l => /^NOME$/i.test(l.trim()));
            if (idxNome !== -1) {
                for (let j = idxNome + 1; j < Math.min(idxNome + 4, linhasLimpa.length); j++) {
                    const cand = U(j);
                    if (/^[A-ZÀ-Ú0-9\.\-&\s]{5,80}$/.test(cand) &&
                        !/CPF|CNPJ|LOCAL|DATA|CABINE|ESTENDIDA|CHASSI|PLACA|ASSINADO|MENSAGENS/.test(cand) &&
                        /\s/.test(cand)) {
                        nome = cand.trim();
                        break;
                    }
                }
            }
            if (!nome) {
                for (let i = 0; i < linhasLimpa.length; i++) {
                    const u = U(i);
                    if (/\b(LTDA|S\.?A\.?|EIRELI|ME|EPP)\b/.test(u) && u.length > 8 && u.length < 80) {
                        nome = u.trim();
                        break;
                    }
                }
            }
            if (!nome) {
                const m = flat.match(/NOME\s+([A-ZÀ-Ú0-9\.\-&\s]{5,80}?)\s+(?:CPF|CNPJ|LOCAL|DATA)/);
                if (m) nome = m[1].trim();
            }
        }

        // 12. CPF / CNPJ
        let cpfCnpj = "";
        {
            let m = flat.match(/(\d{2,3}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
            if (!m) m = flat.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
            if (m) cpfCnpj = m[1];
            if (!cpfCnpj) {
                m = flat.match(/\b(\d{14}|\d{11})\b/);
                if (m) cpfCnpj = m[1];
            }
        }

        // 13. LOCAL + UF + DATA
        let local = "";
        let ufDetectada = "";
        let data = "";
        {
            for (let i = 0; i < linhasLimpa.length; i++) {
                const u = U(i);
                const m = u.match(/([A-ZÀ-Ú][A-ZÀ-Ú\s]{3,60}?)\s+([A-Z]{2})\s+(\d{2}\/\d{2}\/\d{4})/);
                if (m) {
                    local = m[1].trim() + " - " + m[2];
                    ufDetectada = m[2];
                    data = m[3];
                    break;
                }
            }
            if (!local) {
                for (let i = 0; i < linhasLimpa.length; i++) {
                    const u = U(i);
                    const m = u.match(/^([A-ZÀ-Ú][A-ZÀ-Ú\s]{3,60}?)\s+(AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO)\s*$/);
                    if (m) {
                        local = m[1].trim() + " - " + m[2];
                        ufDetectada = m[2];
                        break;
                    }
                }
            }
            if (!data) {
                const m = flat.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
                if (m) data = m[1];
            }
            if (!ufDetectada) {
                const m = flat.match(/\b(AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO)\b/);
                if (m) ufDetectada = m[1];
            }
        }

        const uf = (ufDetectada && window.CALENDARIOS && window.CALENDARIOS[ufDetectada]) ? ufDetectada : "BA";

        return {
            renavam, placa, exercicio, anoFabricacao, anoModelo, numeroCRV,
            marcaModelo, especieTipo, chassi, cor, combustivel, potencia,
            pesoBruto, nome, cpfCnpj, local, data, uf,
            tipoVeiculo: "",
            apelido: "",
            numeroGO: "",
        };
    }

    function preencherFormularioCRLV(dados) {
        const form = document.getElementById("formCRLVVeiculo");
        if (!form) return;

        Object.entries(dados).forEach(([k, v]) => {
            const el = form.elements[k];
            if (el && v) el.value = v;
        });

        const tipoSel = form.elements["tipoVeiculo"];
        if (tipoSel && !tipoSel.value) {
            const textoAnalise = `${dados.especieTipo || ""} ${dados.marcaModelo || ""}`.toUpperCase();
            if (/TRATOR|CAVALO|TRACAO|TRAÇÃO/i.test(textoAnalise)) tipoSel.value = "Cavalo";
            else if (/TRITREM/i.test(textoAnalise)) tipoSel.value = "Tritrem";
            else if (/BITREM/i.test(textoAnalise)) tipoSel.value = "Bitrem";
            else if (/RODOTREM/i.test(textoAnalise)) tipoSel.value = "Rodotrem";
            else if (/PRANCHA/i.test(textoAnalise)) tipoSel.value = "Prancha";
            else if (/GRUA/i.test(textoAnalise)) tipoSel.value = "Grua";
            else if (/SEMIRREBOQUE|CARRETA/i.test(textoAnalise)) tipoSel.value = "Carreta";
            else if (/REBOQUE/i.test(textoAnalise)) tipoSel.value = "Reboque";
            else if (/ONIBUS|ÔNIBUS/i.test(textoAnalise)) tipoSel.value = "Ônibus";
            else if (/CAMINHONETE|AUTOMOVEL|UTILITARIO/i.test(textoAnalise)) tipoSel.value = "Frota Leve";
        }
        atualizarRotuloIdentificacao();
    }

    // =====================================================
    // VENCIMENTO
    // =====================================================
    function calcularVencimento(veiculo) {
        const uf = (veiculo.uf && window.CALENDARIOS && window.CALENDARIOS[veiculo.uf]) ? veiculo.uf : "BA";
        const cal = window.CALENDARIOS ? window.CALENDARIOS[uf] : null;
        if (!cal) return null;

        const placaLimpa = (veiculo.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (placaLimpa.length < 7) return null;
        const ultimoDigito = parseInt(placaLimpa[placaLimpa.length - 1], 10);
        if (isNaN(ultimoDigito) || !cal[ultimoDigito]) return null;

        const exercicio = parseInt(veiculo.exercicio, 10);
        if (!exercicio) return null;

        const regra = cal[ultimoDigito];
        return new Date(exercicio, regra.mes - 1, regra.dia);
    }

    function calcularStatus(veiculo) {
        const venc = calcularVencimento(veiculo);
        if (!venc) return { tipo: "warn", texto: "Sem Exercício" };
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const diffDias = Math.ceil((venc - hoje) / (1000 * 60 * 60 * 24));
        if (diffDias < 0) return { tipo: "danger", texto: `Vencido (${Math.abs(diffDias)}d)` };
        if (diffDias <= 60) return { tipo: "warn", texto: `Vence em ${diffDias}d` };
        return { tipo: "ok", texto: `Em dia (${diffDias}d)` };
    }

    // =====================================================
    // SUBMISSÃO DO FORMULÁRIO
    // =====================================================
    async function submeterFormularioCRLV(e) {
        e.preventDefault();
        const form = document.getElementById("formCRLVVeiculo");
        const dados = {};
        Array.from(form.elements).forEach(el => {
            if (el.name) dados[el.name] = el.value.trim();
        });

        if (!dados.filial_id) { alert("Atenção: Selecione a Filial de lotação do veículo."); return; }
        if (!dados.placa) { alert("Atenção: A placa é obrigatória."); return; }
        if (!dados.tipoVeiculo) { alert("Atenção: Selecione o tipo de veículo."); return; }

        if (tipoUsaGO(dados.tipoVeiculo)) {
            dados.numeroGO = dados.apelido || "";
            dados.apelido = "";
            if (!dados.numeroGO) {
                alert(`Informe o Número do GO para o tipo "${dados.tipoVeiculo}".`);
                return;
            }
        } else {
            dados.numeroGO = "";
        }

        dados.placa = dados.placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
        dados.filial_id = parseInt(dados.filial_id, 10);
        dados.atualizado_em = new Date().toISOString();

        // ============ 1. UPLOAD DO PDF PARA O STORAGE ============
        if (pdfBlobPendente) {
            try {
                if (typeof db.uploadPdfCRLV !== "function") {
                    throw new Error("db.uploadPdfCRLV não existe.");
                }
                const resultado = await db.uploadPdfCRLV(pdfBlobPendente, dados.placa);
                dados.pdf_url = resultado.url;
                dados.pdf_path = resultado.path;
                console.log("📎 PDF enviado ao Storage:", resultado.url);
            } catch (err) {
                console.error("❌ Falha ao subir PDF:", err);
                alert("Atenção: não foi possível salvar o PDF no Storage. O cadastro continuará, mas sem PDF anexo.\n\nMotivo: " + err.message);
            }
        }

        // ============ 2. UPSERT NO BANCO ============
        let salvoComSucesso = false;
        let mensagemErro = "";

        if (typeof db === "undefined") {
            mensagemErro = "Objeto 'db' não carregado.";
        } else if (typeof db.upsertFrotaDocumento !== "function") {
            mensagemErro = "Função db.upsertFrotaDocumento NÃO EXISTE.";
        } else {
            try {
                console.log("📤 Enviando para o Supabase:", dados);
                const retorno = await db.upsertFrotaDocumento(dados);
                console.log("✅ Salvo no Supabase com sucesso:", retorno);
                salvoComSucesso = true;
            } catch (errDb) {
                console.error("❌ Falha ao salvar no Supabase:", errDb);
                mensagemErro = errDb.message || JSON.stringify(errDb);
            }
        }

        window.limparFormularioCRLV();
        await carregarListaVeiculos();

        if (salvoComSucesso) {
            if (typeof Swal !== "undefined") {
                Swal.fire({
                    icon: "success",
                    title: "Veículo Cadastrado!",
                    text: `O documento da placa ${dados.placa} foi registrado com sucesso.`,
                    timer: 2000,
                    showConfirmButton: false,
                    background: "#1e293b",
                    color: "#f8fafc"
                });
            } else {
                alert(`Veículo ${dados.placa} salvo com sucesso!`);
            }
        } else {
            if (typeof Swal !== "undefined") {
                Swal.fire({
                    icon: "error",
                    title: "Erro ao salvar",
                    html: `<code style="color:#f87171;">${mensagemErro}</code>`,
                    background: "#1e293b",
                    color: "#f8fafc"
                });
            } else {
                alert(`Erro ao salvar no banco:\n${mensagemErro}`);
            }
        }
    }

    // =====================================================
    // CARREGAMENTO DA LISTA (sempre do banco)
    // =====================================================
    async function carregarListaVeiculos() {
        let lista = [];

        if (typeof db !== "undefined" && typeof db.getFrotasDocumentos === "function") {
            try {
                lista = await db.getFrotasDocumentos();
                console.log("📥 getFrotasDocumentos retornou", lista ? lista.length : 0, "registros");
            } catch (e) {
                console.error("Erro ao ler do Supabase:", e);
                lista = [];
            }
        }

        listaVeiculosMemoria = lista || [];
        atualizarKPIs(listaVeiculosMemoria);
        renderizarTabela(listaVeiculosMemoria);
    }

    function atualizarKPIs(lista) {
        let total = lista.length;
        let emDia = 0;
        let vencendo = 0;
        let vencidos = 0;

        lista.forEach(v => {
            const st = calcularStatus(v);
            if (st.tipo === "ok") emDia++;
            else if (st.tipo === "warn") vencendo++;
            else if (st.tipo === "danger") vencidos++;
        });

        const elTot = document.getElementById("kpiTotalFrotas");
        const elOk = document.getElementById("kpiEmDia");
        const elWarn = document.getElementById("kpiVencendo");
        const elDan = document.getElementById("kpiVencidos");

        if (elTot) elTot.textContent = total;
        if (elOk) elOk.textContent = emDia;
        if (elWarn) elWarn.textContent = vencendo;
        if (elDan) elDan.textContent = vencidos;
    }

    window.aplicarFiltrosTabelaCRLV = function() {
        const isGlobal = isUsuarioGlobal();

        const filtroFilialEl = document.getElementById("filtroFilialTabela");
        let filtroFilial = "TODAS";
        if (isGlobal && filtroFilialEl) {
            filtroFilial = filtroFilialEl.value || "TODAS";
        } else if (window.currentUser && window.currentUser.filial_id) {
            filtroFilial = String(window.currentUser.filial_id);
        }

        const filtroStatus = document.getElementById("filtroStatusTabela")?.value || "TODOS";
        const termoBusca = (document.getElementById("buscaTabelaCRLV")?.value || "").toLowerCase().trim();

        let filtrados = listaVeiculosMemoria.filter(v => {
            if (filtroFilial !== "TODAS" && String(v.filial_id) !== String(filtroFilial)) return false;
            const st = calcularStatus(v);
            if (filtroStatus !== "TODOS" && st.tipo !== filtroStatus) return false;
            if (termoBusca) {
                const buscaTexto = `${v.placa || ""} ${v.marca_modelo || ""} ${v.apelido || ""} ${v.numero_go || ""} ${v.chassi || ""}`.toLowerCase();
                if (!buscaTexto.includes(termoBusca)) return false;
            }
            return true;
        });

        renderizarTabela(filtrados);
    };

    function renderizarTabela(lista) {
        const tbody = document.getElementById("corpoTabelaVeiculos");
        const emptyMsg = document.getElementById("listaVaziaFrotas");
        const tabela = document.getElementById("tabelaVeiculosFrotas");
        if (!tbody) return;

        tbody.innerHTML = "";

        if (lista.length === 0) {
            if (emptyMsg) emptyMsg.style.display = "block";
            if (tabela) tabela.style.display = "none";
            return;
        }

        if (emptyMsg) emptyMsg.style.display = "none";
        if (tabela) tabela.style.display = "table";

        lista.sort((a, b) => {
            const da = calcularVencimento(a);
            const db = calcularVencimento(b);
            if (!da) return 1;
            if (!db) return -1;
            return da - db;
        });

        lista.forEach(v => {
            const venc = calcularVencimento(v);
            const status = calcularStatus(v);
            const tipo = v.tipo_veiculo || "";
            const classeT = classeTipo(tipo);
            const nomeFilial = mapaFiliais[v.filial_id] || (v.filiais ? v.filiais.nome : "Filial Padrão");
            
            let ident = "-";
            if (tipoUsaGO(tipo) && v.numero_go) {
                ident = `<strong style="color:var(--ccol-blue-bright);">GO:</strong> ${v.numero_go}`;
            } else if (v.apelido) {
                ident = `<span style="font-style: italic; color: #cbd5e1;">${v.apelido}</span>`;
            }

            // Passa placa + filial_id nas chamadas (chave composta)
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><span class="badge-filial">${nomeFilial}</span></td>
                <td><strong style="color:#fff; font-size: 0.95rem;">${v.placa}</strong></td>
                <td><span class="badge-tipo ${classeT}">${tipo || "N/A"}</span></td>
                <td>${ident}</td>
                <td>${v.marca_modelo || "-"}</td>
                <td>${v.exercicio || "-"}</td>
                <td>${window.formatarData(venc)}</td>
                <td><span class="badge-status ${status.tipo}">${status.texto}</span></td>
                <td>
                    <button class="tabela-acoes-btn" title="Ver Detalhes" onclick="window.abrirModalDadosCRLV('${v.placa}', ${v.filial_id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="tabela-acoes-btn btn-pdf" title="Visualizar PDF" onclick="window.visualizarPdfDocumento('${v.placa}', ${v.filial_id})">
                        <i class="fas fa-file-pdf"></i>
                    </button>
                    <button class="tabela-acoes-btn" title="Atualizar Documento" onclick="window.solicitarAtualizacaoCRLV('${v.placa}', ${v.filial_id})">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                    <button class="tabela-acoes-btn btn-trash" title="Excluir Veículo" onclick="window.excluirVeiculoCRLV('${v.placa}', ${v.filial_id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // =====================================================
    // AÇÕES DA TABELA (com chave composta placa + filial)
    // =====================================================
    window.abrirModalDadosCRLV = function(placa, filialId) {
        const v = encontrarVeiculo(placa, filialId);
        if (!v) return;

        const modal = document.getElementById("modalDados");
        const titulo = document.getElementById("modalDadosTitulo");
        const tbody = document.getElementById("modalDadosTbody");
        if (!modal || !tbody) return;

        const nomeFilial = mapaFiliais[v.filial_id] || (v.filiais ? v.filiais.nome : "Matriz");
        titulo.innerHTML = `<i class="fas fa-truck"></i> Veículo ${v.placa} — ${v.marca_modelo || ""}`;
        
        const tipoV = v.tipo_veiculo;
        const campos = [
            ["Filial / Unidade", nomeFilial],
            ["Tipo de Veículo", tipoV],
            [tipoUsaGO(tipoV) ? "Número do GO" : "Apelido Interno", v.numero_go || v.apelido],
            ["Placa", v.placa],
            ["Renavam", v.renavam],
            ["Exercício", v.exercicio],
            ["Ano Fab. / Modelo", `${v.ano_fabricacao || "-"} / ${v.ano_modelo || "-"}`],
            ["Nº CRV", v.numero_crv],
            ["Marca / Modelo", v.marca_modelo],
            ["Espécie / Tipo", v.especie_tipo],
            ["Chassi", v.chassi],
            ["Cor Predominante", v.cor],
            ["Combustível", v.combustivel],
            ["Potência / Cilindrada", v.potencia],
            ["Peso Bruto Total (PBT)", v.peso_bruto],
            ["Proprietário", v.proprietario_nome],
            ["CPF / CNPJ", v.cpf_cnpj],
            ["Município de Registro", v.local_registro || v.municipio_registro],
            ["UF de Registro", v.uf],
            ["Data de Emissão", v.data_emissao],
            ["Data de Vencimento", window.formatarData(calcularVencimento(v))],
            ["Status do Documento", calcularStatus(v).texto]
        ];

        tbody.innerHTML = campos.map(([label, val]) => `
            <tr>
                <td style="color: var(--text-secondary); font-weight: 600; width: 40%;">${label}</td>
                <td style="color: #fff; font-weight: 500;">${val || "-"}</td>
            </tr>
        `).join("");

        modal.style.display = "flex";
    };

    window.visualizarPdfDocumento = function(placa, filialId) {
        const v = encontrarVeiculo(placa, filialId);
        if (!v) { alert("Veículo não encontrado."); return; }

        if (!v.pdf_url) {
            alert("Este veículo ainda não possui PDF anexado.");
            return;
        }

        window.open(v.pdf_url, "_blank");
    };

    window.solicitarAtualizacaoCRLV = function(placa, filialId) {
        placaEmAtualizacao = placa;
        filialEmAtualizacao = filialId;
        novoPDFEmAtualizacao = null;
        novosDadosEmAtualizacao = null;
        document.getElementById("inputAtualizarArquivoCRLV").click();
    };

    async function confirmarAtualizacaoCRLV() {
        if (!placaEmAtualizacao || !novosDadosEmAtualizacao) return;

        const antigo = encontrarVeiculo(placaEmAtualizacao, filialEmAtualizacao);
        if (!antigo) {
            alert("Documento não encontrado.");
            window.fecharModaisFrotas();
            return;
        }

        const dadosFinal = {
            ...novosDadosEmAtualizacao,
            placa: placaEmAtualizacao,
            tipoVeiculo: antigo.tipo_veiculo || novosDadosEmAtualizacao.tipoVeiculo || "",
            apelido: antigo.apelido || novosDadosEmAtualizacao.apelido || "",
            numeroGO: antigo.numero_go || novosDadosEmAtualizacao.numeroGO || "",
            filial_id: antigo.filial_id,
            atualizado_em: new Date().toISOString(),
            pdf_url: antigo.pdf_url || null,
            pdf_path: antigo.pdf_path || null
        };

        if (novoPDFEmAtualizacao) {
            try {
                if (antigo.pdf_path && typeof db.deletePdfCRLV === "function") {
                    await db.deletePdfCRLV(antigo.pdf_path);
                }
                const resultado = await db.uploadPdfCRLV(novoPDFEmAtualizacao, placaEmAtualizacao);
                dadosFinal.pdf_url = resultado.url;
                dadosFinal.pdf_path = resultado.path;
            } catch (err) {
                console.error("Erro ao subir novo PDF:", err);
                alert("Dados atualizados, mas houve erro ao salvar o novo PDF: " + err.message);
            }
        }

        let salvou = false;
        let erroMsg = "";
        if (typeof db !== "undefined" && typeof db.upsertFrotaDocumento === "function") {
            try {
                await db.upsertFrotaDocumento(dadosFinal);
                salvou = true;
            } catch (e) {
                console.error(e);
                erroMsg = e.message;
            }
        } else {
            erroMsg = "db.upsertFrotaDocumento não existe.";
        }

        placaEmAtualizacao = null;
        filialEmAtualizacao = null;
        novoPDFEmAtualizacao = null;
        novosDadosEmAtualizacao = null;
        window.fecharModaisFrotas();
        await carregarListaVeiculos();

        if (typeof Swal !== "undefined") {
            Swal.fire({
                icon: salvou ? "success" : "error",
                title: salvou ? "Atualizado!" : "Erro ao atualizar",
                text: salvou ? "Documento atualizado com sucesso." : `Erro: ${erroMsg}`,
                timer: 2200,
                showConfirmButton: false,
                background: "#1e293b",
                color: "#f8fafc"
            });
        }
    }

    window.excluirVeiculoCRLV = async function(placa, filialId) {
        const v = encontrarVeiculo(placa, filialId);
        if (!v) {
            alert("Veículo não encontrado na lista atual.");
            return;
        }

        const nomeFilial = mapaFiliais[v.filial_id] || `Filial ID ${v.filial_id}`;
        if (!confirm(`Confirma a exclusão do veículo placa ${placa} da filial "${nomeFilial}"?\n\nO PDF também será removido do Storage.`)) return;

        if (typeof db !== "undefined" && typeof db.deleteFrotaDocumento === "function") {
            try {
                await db.deleteFrotaDocumento(placa, v.filial_id);
            } catch (e) {
                console.error("Erro ao excluir:", e);
                alert("Erro ao excluir: " + e.message);
                return;
            }
        }

        await carregarListaVeiculos();
    };

    inicializarModulo();
};