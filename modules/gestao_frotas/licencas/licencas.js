/* =========================================================
   MÓDULO: LICENÇAS — AET Federal e Estadual
   - Persistência 100% no Supabase (tabela + storage)
   - PDF salvo no bucket 'frotas-aet'
   - Respeita hierarquia de filial
   - Parser AET Federal: baseado em padrão de valores
   - Parser AET Estadual: baseado em rótulos + valores
   ========================================================= */

window.initFrotaLicencas = function() {
    let listaAetFed = [];
    let listaAetEst = [];
    let mapaFiliais = {};

    let pdfBlobAetFed = null;
    let ultimoTextoBrutoAetFed = "";
    let numeroAetFedEmAtualizacao = null;
    let filialAetFedEmAtualizacao = null;
    let novoPdfAetFedEmAtualizacao = null;
    let novosDadosAetFedEmAtualizacao = null;

    let pdfBlobAetEst = null;
    let ultimoTextoBrutoAetEst = "";
    let numeroAetEstEmAtualizacao = null;
    let filialAetEstEmAtualizacao = null;
    let novoPdfAetEstEmAtualizacao = null;
    let novosDadosAetEstEmAtualizacao = null;

    function isUsuarioGlobal() {
        return !!(window.currentUser && (
            window.currentUser.role === 'SuperAdmin' ||
            window.currentUser.filial_id === null ||
            window.currentUser.is_global_session === true
        ));
    }

    function encontrarAetFed(numero, filialId) {
        return listaAetFed.find(a =>
            String(a.numero_aet) === String(numero) &&
            (filialId === null || filialId === undefined || String(a.filial_id) === String(filialId))
        );
    }

    function encontrarAetEst(numero, filialId) {
        return listaAetEst.find(a =>
            String(a.numero_aet) === String(numero) &&
            (filialId === null || filialId === undefined || String(a.filial_id) === String(filialId))
        );
    }

    // =====================================================
    // ABAS
    // =====================================================
    window.alternarAbaAet = function(aba) {
        document.getElementById('abaFederal').style.display = aba === 'federal' ? 'block' : 'none';
        document.getElementById('abaEstadual').style.display = aba === 'estadual' ? 'block' : 'none';

        document.getElementById('btnAbaFederal').className = aba === 'federal' ? 'btn-primary-blue' : 'btn-secondary-dark';
        document.getElementById('btnAbaEstadual').className = aba === 'estadual' ? 'btn-primary-blue' : 'btn-secondary-dark';
    };

    // =====================================================
    // CARREGAR FILIAIS
    // =====================================================
    async function carregarMapaFiliais() {
        let filiais = [];
        try {
            if (isUsuarioGlobal() && typeof db.getTodasFiliaisAdmin === "function") {
                filiais = await db.getTodasFiliaisAdmin();
            } else if (typeof db.getFiliais === "function") {
                filiais = await db.getFiliais();
            }
        } catch (e) { console.error("Erro filiais:", e); }
        mapaFiliais = {};
        (filiais || []).forEach(f => { mapaFiliais[f.id] = f.nome; });
    }

    // =====================================================
    // AET FEDERAL — EVENTOS
    // =====================================================
    function configurarAetFederal() {
        const inputFed = document.getElementById("pdfInputAetFed");
        if (inputFed) {
            inputFed.addEventListener("change", async e => {
                const file = e.target.files[0];
                if (file) await processarAetFederal(file);
            });
        }
    }

    async function processarAetFederal(file) {
        const statusEl = document.getElementById("statusAetFed");
        document.getElementById("fileNameAetFed").textContent = file.name;
        statusEl.innerText = "Lendo PDF Federal...";
        statusEl.style.color = "var(--ccol-blue-bright)";
        pdfBlobAetFed = file;

        try {
            const texto = await window.lerTextoPDF(file);
            ultimoTextoBrutoAetFed = texto;
            const dados = extrairAetFederal(texto);

            if (!dados.numeroAET) throw new Error("Não foi possível identificar a AET.");

            // Upload do PDF para o Storage
            try {
                const up = await db.uploadPdfAetFederal(file, dados.numeroAET);
                dados.pdf_url = up.url;
                dados.pdf_path = up.path;
            } catch (err) {
                console.warn("Erro ao subir PDF da AET Federal:", err);
            }

            // Upsert no banco
            await db.upsertAetFederal(dados);
            statusEl.innerText = "AET Federal importada com sucesso!";
            statusEl.style.color = "var(--ccol-green-bright)";
            await carregarListas();
        } catch (err) {
            console.error(err);
            statusEl.innerText = "Erro: " + err.message;
            statusEl.style.color = "#ef4444";
        }
    }

    // =====================================================
    // AET FEDERAL — PARSER (baseado em padrão de valores)
    // =====================================================
    function extrairAetFederal(textoBruto) {
        const flat = textoBruto.replace(/\s+/g, " ").trim();
        const up = flat.toUpperCase();
        const linhas = textoBruto.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

        const pick = (regexes, fonte = up) => {
            for (const rx of regexes) {
                const m = fonte.match(rx);
                if (m && m[1]) return m[1].replace(/\s+/g, " ").trim();
            }
            return "";
        };

        // Identificação
        const numeroAET = pick([/A\.?E\.?T\.?\s*N[ºO°]?\s*([0-9]+\/[0-9]+[A-Z]?)/]);
        const conjuntoTipo = pick([
            /A\.?E\.?T\.?\s*N[ºO°]?\s*[0-9\/A-Z]+\s+([A-Z0-9\s\+]+?)\s+PROPRIET/i,
            /(TRITREM\s+\d+\s+EIXOS\s+[A-Z0-9\+]+)/
        ]);

        // Proprietário
        let proprietario = "", cnpjCpf = "";
        {
            const m1 = up.match(/PROPRIET[ÁA]RIO\s*DO\s*VE[ÍI]CULO\s+(?:CNPJ\s*\/\s*CPF\s+)?(.+?)\s+(\d{2,3}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
            if (m1) { proprietario = m1[1].trim(); cnpjCpf = m1[2]; }
            else {
                for (let i = 0; i < linhas.length; i++) {
                    if (/PROPRIET[ÁA]RIO\s*DO\s*VE[ÍI]CULO/.test(linhas[i].toUpperCase())) {
                        const prox = linhas[i + 1] || "";
                        const mc = prox.match(/^(.+?)\s+(\d{2,3}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
                        if (mc) { proprietario = mc[1].trim(); cnpjCpf = mc[2]; }
                        break;
                    }
                }
            }
        }

        // Endereço / Telefone
        let endereco = "", telefone = "";
        {
            const m1 = up.match(/ENDERE[ÇC]O\s*\([^)]*\)\s+TELEFONE\s+(.+?)\s+(\(\d{2}\)\s*[\d\s\-]+)/);
            if (m1) { endereco = m1[1].trim(); telefone = m1[2].trim(); }
            else {
                for (let i = 0; i < linhas.length; i++) {
                    if (/ENDERE[ÇC]O\s*\(/.test(linhas[i].toUpperCase())) {
                        const prox = linhas[i + 1] || "";
                        const mfone = prox.match(/(\(\d{2}\)\s*[\d\s\-]+)\s*$/);
                        if (mfone) {
                            telefone = mfone[1].trim();
                            endereco = prox.substring(0, prox.indexOf(telefone)).trim();
                        } else { endereco = prox.trim(); }
                        break;
                    }
                }
            }
        }

        // Validade
        let validadeInicio = "", validadeFim = "";
        {
            const m = up.match(/PER[ÍI]ODO\s+DE[:\s]+(\d{2}\/\d{2}\/\d{4})\s+A\s+(\d{2}\/\d{2}\/\d{4})/);
            if (m) { validadeInicio = m[1]; validadeFim = m[2]; }
        }

        const pbtcInformado = pick([/PBTC\s*INFORMADO\s*\(t\)[:\s]*([0-9.,]+)/]);
        const comprimento = pick([/COMPRIMENTO\s*\(m\)[:\s]*([0-9.,]+)/]);

        // Filtra linhas úteis
        const linhasUteis = linhas.filter(l => {
            const u = l.toUpperCase();
            if (/^DEPARTAMENTO NACIONAL/.test(u)) return false;
            if (/^DIRETORIA DE INFRA/.test(u)) return false;
            if (/^COORDENAÇÃO GERAL/.test(u)) return false;
            if (/^RESOLUÇÃO/.test(u)) return false;
            if (/^AUTORIZAÇÃO ESPECIAL/.test(u)) return false;
            if (/^\s*$/.test(l)) return false;
            if (/^A\.E\.T\./.test(u)) return false;
            return true;
        });

        const acharLinha = (regex, inicio = 0) => {
            for (let i = inicio; i < linhasUteis.length; i++) {
                if (regex.test(linhasUteis[i].toUpperCase())) return i;
            }
            return -1;
        };

        // Extrai unidade por PADRÃO DE VALOR
        function extrairUnidadePorValor(idxCab, tipo) {
            const blocoLinhas = [];
            for (let i = idxCab + 1; i < Math.min(idxCab + 6, linhasUteis.length); i++) {
                const u = linhasUteis[i].toUpperCase();
                if (/^UNIDADE\s+U\d+/.test(u)) break;
                if (/^PERCURSO\b/.test(u)) break;
                if (/^PLACA\s+ANO\s*FAB/i.test(u)) continue;
                if (/^TARA\s*\(t\)\s*TRA[ÇC][ÃA]O/i.test(u)) continue;
                if (/^TARA\s*\(t\)\s*RENAVAM/i.test(u)) continue;
                blocoLinhas.push(linhasUteis[i]);
            }
            const bloco = blocoLinhas.join(" ").toUpperCase().replace(/\s+/g, " ").trim();
            const u = {};

            u.placa = (bloco.match(/\b([A-Z]{3}[0-9][A-Z][0-9]{2})\b/) || [])[1] || "";
            u.chassi = (bloco.match(/\b([A-HJ-NPR-Z0-9]{17})\b/) || [])[1] || "";

            let blocoSemPlaca = bloco.replace(u.placa, " ").replace(u.chassi, " ");
            u.anoFab = (blocoSemPlaca.match(/\b((?:19|20)\d{2})\b/) || [])[1] || "";

            if (u.chassi) {
                const idxChassi = bloco.indexOf(u.chassi);
                if (idxChassi !== -1) {
                    const resto = bloco.substring(idxChassi + 17).trim();
                    let carroceria = "";
                    const carrMatch = resto.match(/(N[ÃA]O\s*TEM|FLORESTAL|BA[ÚU]|SIDER|GRANELEIRO|TANQUE|CA[ÇC]AMBA)\s*$/i);
                    let trecho = resto;
                    if (carrMatch) {
                        carroceria = carrMatch[1].toUpperCase();
                        const pos = trecho.toUpperCase().lastIndexOf(carroceria);
                        if (pos !== -1) trecho = trecho.substring(0, pos).trim();
                    }
                    u.carroceria = carroceria;
                    const partes = trecho.split(/\s+/);
                    if (partes.length >= 2) { u.marca = partes[0]; u.modelo = partes.slice(1).join(" "); }
                    else if (partes.length === 1) { u.marca = partes[0]; u.modelo = ""; }
                }
            }

            u.tara = (bloco.match(/\b(\d{1,2},\d{3})\b/) || [])[1] || "";
            const tr = bloco.match(/\b(DUPLA|SIMPLES|TANDEM)\s+(\d+X\d+)\b/);
            if (tr) u.tracao = `${tr[1]} ${tr[2]}`;

            const renavam11 = bloco.match(/\b(\d{11})\b/);
            if (renavam11) u.renavam = renavam11[1];
            else {
                const renavam10 = bloco.match(/\b(\d{10})\b/);
                if (renavam10) u.renavam = renavam10[1];
            }

            if (tipo === "u1") {
                const rntrc9 = bloco.match(/\b(\d{9})\b/);
                if (rntrc9) u.rntrc = rntrc9[1];
            } else {
                const rntrcLetras = bloco.match(/\b(TCP|TAC|ETC|CTC)\b/);
                if (rntrcLetras) u.rntrc = rntrcLetras[1];
                else {
                    const rntrcDig = bloco.match(/\b(\d{6,10})\b/g);
                    if (rntrcDig && rntrcDig.length) u.rntrc = rntrcDig[rntrcDig.length - 1];
                }
            }

            const dir = bloco.match(/\b(HIDR[ÁA]ULICA|MEC[ÂA]NICA|EL[ÉE]TRICA)\b/);
            if (dir) u.direcao = dir[1].charAt(0) + dir[1].slice(1).toLowerCase();

            const bidir = bloco.match(/\b(N[ÃA]O|SIM)\s*$/);
            if (bidir) u.bidirecional = bidir[1].charAt(0) + bidir[1].slice(1).toLowerCase();

            if (tipo === "u1") {
                const potCmt = bloco.match(/(?:DUPLA|SIMPLES|TANDEM)\s+\d+X\d+\s+(\d{2,4})\s+(\d{1,3},\d)/);
                if (potCmt) { u.potencia = potCmt[1]; u.cmt = potCmt[2]; }
                else {
                    const antesDir = bloco.match(/(\d{2,4})\s+(\d{1,3},\d)\s+HIDR[ÁA]ULICA/);
                    if (antesDir) { u.potencia = antesDir[1]; u.cmt = antesDir[2]; }
                }
            } else {
                const eixosPneus = bloco.match(/\b(TCP|TAC)\s+(\d)\s+(\d)\b/);
                if (eixosPneus) { u.numEixos = eixosPneus[2]; u.pneusPorEixo = eixosPneus[3]; }
                else {
                    const dip = bloco.match(/\b(\d)\s+(\d)\s*$/);
                    if (dip) { u.numEixos = dip[1]; u.pneusPorEixo = dip[2]; }
                }
            }

            return u;
        }

        // U1        let u1 = {};
        {
            const idxU1 = acharLinha(/^UNIDADE\s+U1\b/);
            if (idxU1 !== -1) u1 = extrairUnidadePorValor(idxU1, "u1");
        }

        // U2..U6
        const unidadesComplementares = [];
        for (let n = 2; n <= 6; n++) {
            const idx = acharLinha(new RegExp(`^UNIDADE\\s+U${n}\\b`));
            if (idx !== -1) {
                const u = extrairUnidadePorValor(idx, "complementar");
                if (u && (u.placa || u.chassi)) unidadesComplementares.push(u);
            }
        }

        // Carretas complementares
        const carretasComplementares = [];
        const reCarreta = /^([A-Z]{3}[0-9][A-Z0-9][0-9]{2})\s+(FACCHINI|RANDON|GUERRA|LIBRELATO|NOMA|KRONE)\s+(.+?)\s+((?:19|20)\d{2})\s+([A-HJ-NPR-Z0-9]{17})\s+(\d{9,11})\s+([A-Z0-9]{2,4})\s+([A-ZÀ-Ú]{4,15})\s+(\d,\d{3})\s+(\d{1,2})\s+(\d{1,2})\s*$/i;
        for (const linha of linhasUteis) {
            const m = linha.match(reCarreta);
            if (m) {
                carretasComplementares.push({
                    placa: m[1], marca: m[2].toUpperCase(), modelo: m[3].trim(), ano: m[4],
                    chassi: m[5], renavam: m[6], rntrc: m[7], carroceria: m[8].toUpperCase(),
                    tara: m[9], numEixos: m[10], pneusPorEixo: m[11]
                });
            }
        }
        if (carretasComplementares.length === 0) {
            for (const linha of linhasUteis) {
                const m = linha.match(/^([A-Z]{3}[0-9][A-Z0-9][0-9]{2})\s+.+?\s+((?:19|20)\d{2})\s+([A-HJ-NPR-Z0-9]{17})\s+(\d{9,11})\s+([A-Z0-9]{2,4})\s+([A-ZÀ-Ú]{4,15})\s+(\d,\d{3})\s+(\d{1,2})\s+(\d{1,2})\s*$/);
                if (m) {
                    carretasComplementares.push({
                        placa: m[1], marca: "", modelo: "", ano: m[2], chassi: m[3],
                        renavam: m[4], rntrc: m[5], carroceria: m[6].toUpperCase(),
                        tara: m[7], numEixos: m[8], pneusPorEixo: m[9]
                    });
                }
            }
        }

        return {
            numeroAET, conjuntoTipo, proprietario, cnpjCpf, endereco, telefone,
            validadeInicio, validadeFim, pbtcInformado, comprimento,
            u1_placa: u1.placa || "", u1_anoFab: u1.anoFab || "", u1_chassi: u1.chassi || "",
            u1_marca: u1.marca || "", u1_modelo: u1.modelo || "", u1_carroceria: u1.carroceria || "",
            u1_tara: u1.tara || "", u1_tracao: u1.tracao || "", u1_potencia: u1.potencia || "",
            u1_cmt: u1.cmt || "", u1_direcao: u1.direcao || "", u1_renavam: u1.renavam || "",
            u1_rntrc: u1.rntrc || "", u1_bidirecional: u1.bidirecional || "",
            unidadesComplementares, carretasComplementares
        };
    }

    // =====================================================
    // AET FEDERAL — TABELA
    // =====================================================
    function renderizarTabelaFed() {
        const tbody = document.querySelector("#tabelaAetFed tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        if (listaAetFed.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-secondary);">Nenhuma AET Federal cadastrada.</td></tr>`;
            return;
        }

        listaAetFed.forEach(a => {
            const nomeFilial = mapaFiliais[a.filial_id] || (a.filiais ? a.filiais.nome : "—");
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${a.numero_aet || "-"}</strong><br><span style="font-size:0.75rem; color:var(--text-secondary);">${nomeFilial}</span></td>
                <td>${a.u1_placa || "-"}</td>
                <td>${a.conjunto_tipo || "-"}</td>
                <td>${a.validade_inicio || "-"} a ${a.validade_fim || "-"}</td>
                <td>
                    <button class="tabela-acoes-btn" title="Detalhes" onclick="window.abrirDetalhesAetFed('${a.numero_aet}', ${a.filial_id})"><i class="fas fa-eye"></i></button>
                    <button class="tabela-acoes-btn btn-pdf" title="PDF" onclick="window.visualizarPdfAetFed('${a.numero_aet}', ${a.filial_id})"><i class="fas fa-file-pdf"></i></button>
                    <button class="tabela-acoes-btn" title="Atualizar" onclick="window.solicitarAtualizacaoAetFed('${a.numero_aet}', ${a.filial_id})"><i class="fas fa-sync-alt"></i></button>
                    <button class="tabela-acoes-btn btn-trash" title="Excluir" onclick="window.excluirAetFed('${a.numero_aet}', ${a.filial_id})"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.visualizarPdfAetFed = function(numero, filialId) {
        const a = encontrarAetFed(numero, filialId);
        if (!a || !a.pdf_url) { alert("PDF não disponível para esta AET."); return; }
        window.open(a.pdf_url, "_blank");
    };

    window.abrirDetalhesAetFed = function(numero, filialId) {
        const a = encontrarAetFed(numero, filialId);
        if (!a) return;
        const linhas = [
            ["Nº AET", a.numero_aet],
            ["Conjunto", a.conjunto_tipo],
            ["Proprietário", a.proprietario],
            ["CNPJ / CPF", a.cnpj_cpf],
            ["Endereço", a.endereco],
            ["Telefone", a.telefone],
            ["Validade", `${a.validade_inicio || "-"} a ${a.validade_fim || "-"}`],
            ["PBTC", a.pbtc_informado],
            ["Comprimento", a.comprimento],
            ["U1 Placa", a.u1_placa],
            ["U1 Chassi", a.u1_chassi],
            ["U1 Marca/Modelo", `${a.u1_marca || ""} ${a.u1_modelo || ""}`.trim()],
            ["U1 Ano", a.u1_ano_fab],
            ["U1 Tara", a.u1_tara],
            ["U1 Tração", a.u1_tracao],
            ["U1 Potência", a.u1_potencia],
            ["U1 CMT", a.u1_cmt],
            ["U1 RENAVAM", a.u1_renavam],
            ["U1 RNTRC", a.u1_rntrc],
            ["Unidades Complementares", String((a.unidades_complementares || []).length)],
            ["Carretas Complementares", String((a.carretas_complementares || []).length)]
        ];
        alert("Detalhes da AET Federal:\n\n" + linhas.map(([k, v]) => `${k}: ${v || "-"}`).join("\n"));
    };

    window.solicitarAtualizacaoAetFed = function(numero, filialId) {
        numeroAetFedEmAtualizacao = numero;
        filialAetFedEmAtualizacao = filialId;
        novoPdfAetFedEmAtualizacao = null;
        novosDadosAetFedEmAtualizacao = null;
        const input = document.getElementById("inputAtualizarAetFed");
        if (!input) {
            alert("Input de atualização não encontrado no HTML.");
            return;
        }
        input.value = "";
        input.click();
    };

    window.excluirAetFed = async function(numero, filialId) {
        if (!confirm(`Excluir AET Federal ${numero}?`)) return;
        try {
            await db.deleteAetFederal(numero, filialId);
            await carregarListas();
        } catch (e) {
            console.error(e);
            alert("Erro ao excluir: " + e.message);
        }
    };

    function configurarAtualizacaoAetFed() {
        const input = document.getElementById("inputAtualizarAetFed");
        if (!input) return;
        input.addEventListener("change", async e => {
            const file = e.target.files[0];
            input.value = "";
            if (!file || !numeroAetFedEmAtualizacao) return;
            try {
                novoPdfAetFedEmAtualizacao = file;
                const texto = await window.lerTextoPDF(file);
                const dados = extrairAetFederal(texto);
                if (!dados.numeroAET) dados.numeroAET = numeroAetFedEmAtualizacao;
                dados.filial_id = filialAetFedEmAtualizacao;

                const up = await db.uploadPdfAetFederal(file, numeroAetFedEmAtualizacao);
                dados.pdf_url = up.url;
                dados.pdf_path = up.path;

                await db.upsertAetFederal(dados);
                alert("AET Federal atualizada com sucesso!");
                await carregarListas();
            } catch (err) {
                console.error(err);
                alert("Erro ao atualizar AET Federal: " + err.message);
            } finally {
                numeroAetFedEmAtualizacao = null;
                filialAetFedEmAtualizacao = null;
            }
        });
    }

    // =====================================================
    // AET ESTADUAL — EVENTOS
    // =====================================================
    function configurarAetEstadual() {
        const inputEst = document.getElementById("pdfInputAetEst");
        if (inputEst) {
            inputEst.addEventListener("change", async e => {
                const file = e.target.files[0];
                if (file) await processarAetEstadual(file);
            });
        }
    }

    async function processarAetEstadual(file) {
        const statusEl = document.getElementById("statusAetEst");
        document.getElementById("fileNameAetEst").textContent = file.name;
        statusEl.innerText = "Lendo PDF Estadual...";
        statusEl.style.color = "var(--ccol-blue-bright)";
        pdfBlobAetEst = file;

        try {
            const texto = await window.lerTextoPDF(file);
            ultimoTextoBrutoAetEst = texto;
            const dados = extrairAetEstadual(texto);

            if (!dados.numeroAET) throw new Error("Não foi possível identificar a AET Estadual.");

            try {
                const up = await db.uploadPdfAetEstadual(file, dados.numeroAET);
                dados.pdf_url = up.url;
                dados.pdf_path = up.path;
            } catch (err) {
                console.warn("Erro ao subir PDF da AET Estadual:", err);
            }

            await db.upsertAetEstadual(dados);
            statusEl.innerText = "AET Estadual importada com sucesso!";
            statusEl.style.color = "var(--ccol-green-bright)";
            await carregarListas();
        } catch (err) {
            console.error(err);
            statusEl.innerText = "Erro: " + err.message;
            statusEl.style.color = "#ef4444";
        }
    }

    // =========================================================
    // PARSER AET ESTADUAL (preservado do seu aet_estadual.js)
    // =========================================================
    function extrairAetEstadual(textoBruto) {
        const flat = textoBruto.replace(/\s+/g, " ").trim();
        const up = flat.toUpperCase();
        const linhas = textoBruto.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

        const pick = (regexes, fonte = up) => {
            for (const rx of regexes) {
                const m = fonte.match(rx);
                if (m && m[1]) return m[1].replace(/\s+/g, " ").trim();
            }
            return "";
        };

        const numeroAET = pick([
            /^(\d{15,})\s+TRANSPORTADOR/i,
            /\b(\d{15,})\b/
        ]);

        let uf = "";
        {
            const m = up.match(/\b(BA|ES|MG|SP|RJ|PR|SC|RS|GO|MT|MS|DF|TO|MA|PI|CE|RN|PB|PE|AL|SE|AM|PA|AC|RO|RR|AP)\s+\d{3}/);
            if (m) uf = m[1];
        }

        const transportador = pick([
            /TRANSPORTADOR[:\s]+(.+?)\s+ENDERE[ÇC]O/i,
            /TRANSPORTADOR[:\s]+(.+?)\s+(?:RUA|AV\.|AVENIDA|ROD\.)/i
        ]);

        const endereco = pick([
            /ENDERE[ÇC]O[:\s]+(.+?)\s+TELEFONE/i,
            /ENDERE[ÇC]O[:\s]+(.+?)\s*\/\s*comercial/i
        ]);

        const contato = pick([
            /TELEFONE\s*\/\s*FAX\s*\/\s*E-?MAIL[:\s]+(.+?)\s+NOME\s+DO\s+REQUERENTE/i,
            /TELEFONE\s*\/\s*FAX\s*\/\s*E-?MAIL[:\s]+(.+?)\s+NOME/i
        ]);

        const requerente = pick([/NOME\s+DO\s+REQUERENTE[:\s]+(.+?)\s+TRANSPORTANDO/i]);
        const transportando = pick([/TRANSPORTANDO[:\s]+(.+?)\s+ORIGEM/i]);
        const origem = pick([/ORIGEM[:\s]+(.+?)\s+VALIDADE/i]);

        let validadeInicio = "", validadeFim = "";
        {
            const m = up.match(/VALIDADE[:\s]+(\d{2}\/\d{2}\/\d{4})\s+AT[ÉE]\s+(\d{2}\/\d{2}\/\d{4})/);
            if (m) { validadeInicio = m[1]; validadeFim = m[2]; }
        }

        let restricaoHorario = "";
        {
            if (/SEM\s+RESTRI[ÇC][ÃA]O\s+DE\s+HOR[ÁA]RIO/i.test(up)) restricaoHorario = "Sem Restrição";
            if (/RESTRI[ÇC][ÃA]O\s+DE\s+0?8\s+HORAS/i.test(up) || /VESP[ÉE]RAS\s+DE\s+FERIADO/i.test(up)) {
                if (restricaoHorario === "Sem Restrição") restricaoHorario = "Diurna e Noturna";
                else restricaoHorario = "Diurna";
            }
            if (/AMANHECER\s+AO\s+(?:POR\s+DO\s+SOL|ANOITECER)/i.test(up)) {
                if (!restricaoHorario) restricaoHorario = "Diurna";
            }
            if (/TR[ÂA]NSITO\s+DIUTURNO/i.test(up) || /24\s*HORAS/i.test(up)) {
                restricaoHorario = "Diurna e Noturna";
            }
            if (/TR[ÂA]NSITO\s+NOTURNO/i.test(up) || /PER[ÍI]ODO\s+NOTURNO/i.test(up)) {
                if (restricaoHorario === "Diurna") restricaoHorario = "Diurna e Noturna";
                else restricaoHorario = "Noturna";
            }
        }

        const velocidadeMax = pick([
            /VELOCIDADE\s+(?:M[ÁA]XIMA\s+)?DE\s+(\d+(?:[.,]\d+)?)\s*KM\s*\/\s*H/i,
            /AT[ÉE]\s+A\s+VELOCIDADE\s+DE\s+(\d+(?:[.,]\d+)?)\s*KM\s*\/\s*H/i
        ]);

        const marca = pick([/MARCA\s*[:\s]+([A-ZÀ-Ú][A-ZÀ-Ú0-9\s\-\.]+?)\s+MODELO/i]);
        const modelo = pick([
            /MODELO\s*[:\s]+(.+?)\s+ANO\s*FAB/i,
            /MODELO\s*[:\s]+(.+?)\s+ANO\s*FAB\./i
        ]);

        let anoFab = "", placasCavalo = "", potencia = "", placasReboques = "";
        {
            const mReb = up.match(/PLACA\s*\(S\)\s*REBOQUES\s+((?:[A-Z0-9]{6,7}\s*\/?\s*)+?)(?=\s+[A-ZÀ-Ú]{4,}|\s+\d)/);
            if (mReb) placasReboques = mReb[1].replace(/\s+/g, " ").trim();

            const m3 = up.match(/(\d{4})\s+([A-Z]{3}[0-9][A-Z0-9][0-9]{2})\s+(\d{1,4}[.,]?\d{0,2})\s+PLACA\s*\(S\)\s*REBOQUES\s+(.+?)(?=\s+COMPRIMENTO|\s+PESO|\s+LARGURA|\s+ALTURA)/);
            if (m3) {
                anoFab = m3[1]; placasCavalo = m3[2]; potencia = m3[3];
                if (!placasReboques) placasReboques = m3[4].trim();
            } else {
                const mAno = up.match(/ANO\s*FAB\.?\s+(\d{4})/);
                if (mAno) anoFab = mAno[1];
                const mPlaca = up.match(/\b([A-Z]{3}[0-9][A-Z0-9][0-9]{2})\b/);
                if (mPlaca) placasCavalo = mPlaca[1];
            }
        }

        const comprimento = pick([/COMPRIMENTO\s+DO\s+VE[ÍI]CULO\s+(\d+[.,]?\d*)/]);
        const pesoTotal = pick([/PESO\s+TOTAL\s+\([^)]*\)\s+(\d+[.,]?\d*)/, /PESO\s+TOTAL\s+(\d+[.,]?\d*)/]);
        const largura = pick([/LARGURA\s+DO\s+VE[ÍI]CULO\s+(\d+[.,]?\d*)/]);
        const peso1Unid = pick([/PESO\s+DA\s+1[ºO°]?\s*UNIDADE\s+DE\s+TRA[ÇC][ÃA]O\s+(\d+[.,]?\d*)/]);
        const altura = pick([/ALTURA\s+TOTAL\s+(\d+[.,]?\d*)/]);
        const peso2Unid = pick([/PESO\s+DA\s+2[ªA]?\s*UNIDADE\s+DE\s+TRA[ÇC][ÃA]O\s+(\d+[.,]?\d*)/]);
        const larguraTotal = pick([/LARGURA\s+TOTAL\s+(\d+[.,]?\d*)/]);
        const pesoCarreta = pick([/PESO\s+DA\s+CARRETA\s+(\d+[.,]?\d*)/]);
        const pesoCarga = pick([/PESO\s+DA\s+CARGA\s+(\d+[.,]?\d*)/]);
        const pesoAcessorios = pick([/PESO\s+DOS\s+ACES\.?\s+E\s+CONTRAPESO\s+(\d+[.,]?\d*)/]);
        const excessoLimite = pick([/EXCESSO\s+S\/\s*LIMITE\s+[\d.,]+t\s+(\d+[.,]?\d*)/]);

        const trechos = [];
        {
            const idxSem = up.indexOf("SEM RESTRI");
            const idxRest = up.indexOf("RESTRI");
            if (idxSem !== -1) {
                const fim = idxRest > idxSem ? idxRest : up.length;
                const bloco = flat.substring(idxSem, fim);
                const partes = bloco.split(/\s+(?=(?:BA|BR|ES|MG|SP|RJ)\s*\d)/);
                partes.forEach(p => {
                    const t = p.trim();
                    if (t && t.length > 5 && !/^SEM RESTRI/i.test(t)) trechos.push(t);
                });
            }
        }

        const restricoes = [];
        {
            const idxRest = up.indexOf("RESTRI");
            if (idxRest !== -1) {
                const bloco = flat.substring(idxRest);
                const frases = bloco.split(/(?<=[.;])\s+/);
                frases.forEach(f => {
                    const t = f.trim();
                    if (t && t.length > 10 && !/^RESTRI[ÇC][ÕO]ES/i.test(t)) restricoes.push(t);
                });
            }
        }

        const placasAdicionais = [];
        {
            const idxRel = up.indexOf("RELA");
            if (idxRel !== -1) {
                const bloco = flat.substring(idxRel);
                const rePlaca = /\b([A-Z]{3}[0-9][A-Z0-9][0-9]{2}|[A-Z]{3}[0-9]{4})\b/g;
                let m;
                while ((m = rePlaca.exec(bloco)) !== null) {
                    const p = m[1];
                    if (!placasAdicionais.includes(p)) placasAdicionais.push(p);
                }
            }
        }

        return {
            numeroAET, uf, transportador, cnpjCpf: "", endereco, contato, requerente,
            transportando, origem, validadeInicio, validadeFim, restricaoHorario,
            velocidadeMax, marca, modelo, anoFab, placasCavalo, placasReboques,
            potencia, comprimento, pesoTotal, largura, peso1Unid, altura, peso2Unid,
            larguraTotal, pesoCarreta, pesoCarga, pesoAcessorios, excessoLimite,
            trechos, restricoes, placasAdicionais
        };
    }

    // =====================================================
    // AET ESTADUAL — TABELA
    // =====================================================
    function renderizarTabelaEst() {
        const tbody = document.querySelector("#tabelaAetEst tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        if (listaAetEst.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-secondary);">Nenhuma AET Estadual cadastrada.</td></tr>`;
            return;
        }

        listaAetEst.forEach(a => {
            const nomeFilial = mapaFiliais[a.filial_id] || (a.filiais ? a.filiais.nome : "—");
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${a.numero_aet || "-"}</strong><br><span style="font-size:0.75rem; color:var(--text-secondary);">${nomeFilial}</span></td>
                <td>${a.uf || "-"}</td>
                <td>${a.placas_cavalo || "-"}</td>
                <td>${a.validade_inicio || "-"} a ${a.validade_fim || "-"}</td>
                <td>${a.restricao_horario || "-"}</td>
                <td>
                    <button class="tabela-acoes-btn" title="Detalhes" onclick="window.abrirDetalhesAetEst('${a.numero_aet}', ${a.filial_id})"><i class="fas fa-eye"></i></button>
                    <button class="tabela-acoes-btn btn-pdf" title="PDF" onclick="window.visualizarPdfAetEst('${a.numero_aet}', ${a.filial_id})"><i class="fas fa-file-pdf"></i></button>
                    <button class="tabela-acoes-btn" title="Atualizar" onclick="window.solicitarAtualizacaoAetEst('${a.numero_aet}', ${a.filial_id})"><i class="fas fa-sync-alt"></i></button>
                    <button class="tabela-acoes-btn btn-trash" title="Excluir" onclick="window.excluirAetEst('${a.numero_aet}', ${a.filial_id})"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.visualizarPdfAetEst = function(numero, filialId) {
        const a = encontrarAetEst(numero, filialId);
        if (!a || !a.pdf_url) { alert("PDF não disponível."); return; }
        window.open(a.pdf_url, "_blank");
    };

    window.abrirDetalhesAetEst = function(numero, filialId) {
        const a = encontrarAetEst(numero, filialId);
        if (!a) return;
        const linhas = [
            ["Nº AET", a.numero_aet],
            ["UF", a.uf],
            ["Transportador", a.transportador],
            ["Endereço", a.endereco],
            ["Contato", a.contato],
            ["Requerente", a.requerente],
            ["Transportando", a.transportando],
            ["Origem", a.origem],
            ["Validade", `${a.validade_inicio || "-"} a ${a.validade_fim || "-"}`],
            ["Restrição", a.restricao_horario],
            ["Velocidade Máx", a.velocidade_max],
            ["Marca", a.marca],
            ["Modelo", a.modelo],
            ["Ano Fab.", a.ano_fab],
            ["Placas Cavalo", a.placas_cavalo],
            ["Placas Reboques", a.placas_reboques],
            ["Potência", a.potencia],
            ["Comprimento", a.comprimento],
            ["Peso Total", a.peso_total],
            ["Trechos", String((a.trechos || []).length)],
            ["Restrições", String((a.restricoes || []).length)],
            ["Placas Adicionais", String((a.placas_adicionais || []).length)]
        ];
        alert("Detalhes da AET Estadual:\n\n" + linhas.map(([k, v]) => `${k}: ${v || "-"}`).join("\n"));
    };

    window.solicitarAtualizacaoAetEst = function(numero, filialId) {
        numeroAetEstEmAtualizacao = numero;
        filialAetEstEmAtualizacao = filialId;
        novoPdfAetEstEmAtualizacao = null;
        novosDadosAetEstEmAtualizacao = null;
        const input = document.getElementById("inputAtualizarAetEst");
        if (!input) { alert("Input de atualização não encontrado."); return; }
        input.value = "";
        input.click();
    };

    window.excluirAetEst = async function(numero, filialId) {
        if (!confirm(`Excluir AET Estadual ${numero}?`)) return;
        try {
            await db.deleteAetEstadual(numero, filialId);
            await carregarListas();
        } catch (e) {
            console.error(e);
            alert("Erro ao excluir: " + e.message);
        }
    };

    function configurarAtualizacaoAetEst() {
        const input = document.getElementById("inputAtualizarAetEst");
        if (!input) return;
        input.addEventListener("change", async e => {
            const file = e.target.files[0];
            input.value = "";
            if (!file || !numeroAetEstEmAtualizacao) return;
            try {
                novoPdfAetEstEmAtualizacao = file;
                const texto = await window.lerTextoPDF(file);
                const dados = extrairAetEstadual(texto);
                if (!dados.numeroAET) dados.numeroAET = numeroAetEstEmAtualizacao;
                dados.filial_id = filialAetEstEmAtualizacao;

                const up = await db.uploadPdfAetEstadual(file, numeroAetEstEmAtualizacao);
                dados.pdf_url = up.url;
                dados.pdf_path = up.path;

                await db.upsertAetEstadual(dados);
                alert("AET Estadual atualizada com sucesso!");
                await carregarListas();
            } catch (err) {
                console.error(err);
                alert("Erro ao atualizar: " + err.message);
            } finally {
                numeroAetEstEmAtualizacao = null;
                filialAetEstEmAtualizacao = null;
            }
        });
    }

    // =====================================================
    // CARREGAR LISTAS DO BANCO
    // =====================================================
    async function carregarListas() {
        try {
            listaAetFed = await db.getAetFederal();
            console.log("📥 AET Federal:", listaAetFed.length, "registros");
        } catch (e) { console.error("Erro getAetFederal:", e); listaAetFed = []; }

        try {
            listaAetEst = await db.getAetEstadual();
            console.log("📥 AET Estadual:", listaAetEst.length, "registros");
        } catch (e) { console.error("Erro getAetEstadual:", e); listaAetEst = []; }

        renderizarTabelaFed();
        renderizarTabelaEst();
    }

    // =====================================================
    // INICIALIZAÇÃO
    // =====================================================
    async function inicializar() {
        await carregarMapaFiliais();
        configurarAetFederal();
        configurarAetEstadual();
        configurarAtualizacaoAetFed();
        configurarAtualizacaoAetEst();
        await carregarListas();
    }

    inicializar();
};