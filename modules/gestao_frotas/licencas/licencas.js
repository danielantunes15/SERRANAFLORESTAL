/* =========================================================
   MÓDULO: LICENÇAS — AET Federal e Estadual
   - Tabela Única: aet_licencas (JSONB)
   - Layout de Colunas Específicas para U1, U2, U3, U4
   - Parser de Extração Contínua (Resolve quebras do PDF do DNIT)
   ========================================================= */

window.initFrotaLicencas = function() {
    let listaAetFed = [];
    let listaAetEst = [];
    let mapaFiliais = {};

    let pdfBlobAetFed = null;
    let numeroAetFedEmAtualizacao = null;
    let filialAetFedEmAtualizacao = null;

    let numeroAetEstEmAtualizacao = null;
    let filialAetEstEmAtualizacao = null;

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
    // FUNÇÕES DE DATA E STATUS
    // =====================================================
    function getStatusValidade(dataFimStr) {
        if (!dataFimStr) return { texto: "Data Inválida", classe: "badge-gray" };
        
        const partes = dataFimStr.split('/');
        if (partes.length !== 3) return { texto: dataFimStr, classe: "badge-gray" };

        const validade = new Date(`${partes[2]}-${partes[1]}-${partes[0]}T23:59:59`);
        const hoje = new Date();
        const diffTempo = validade - hoje;
        const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24));

        if (diffDias < 0) return { texto: "Vencida", classe: "badge-red" };
        if (diffDias <= 30) return { texto: `Vence em ${diffDias} dias`, classe: "badge-yellow" };
        return { texto: "Válida", classe: "badge-green" };
    }

    window.alternarAbaAet = function(aba) {
        document.getElementById('abaFederal').style.display = aba === 'federal' ? 'block' : 'none';
        document.getElementById('abaEstadual').style.display = aba === 'estadual' ? 'block' : 'none';
        document.getElementById('btnAbaFederal').className = aba === 'federal' ? 'btn-primary-blue' : 'btn-secondary-dark';
        document.getElementById('btnAbaEstadual').className = aba === 'estadual' ? 'btn-primary-blue' : 'btn-secondary-dark';
    };

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
    // AET FEDERAL — IMPORTAÇÃO E REVISÃO
    // =====================================================
    function configurarAetFederal() {
        const inputFed = document.getElementById("pdfInputAetFed");
        if (inputFed) {
            inputFed.addEventListener("change", async e => {
                const file = e.target.files[0];
                if (file) await processarAetFederal(file);
                inputFed.value = ""; 
            });
        }

        const btnAddU = document.getElementById("btnAddUComp");
        if (btnAddU) btnAddU.addEventListener("click", () => adicionarUnidadeComplementarFed({}));

        const btnAddC = document.getElementById("btnAddCComp");
        if (btnAddC) btnAddC.addEventListener("click", () => adicionarCarretaComplementarFed({}));

        const btnCancelar = document.getElementById("btnCancelarAetFed");
        if (btnCancelar) {
            btnCancelar.addEventListener("click", () => {
                document.getElementById('formCardAetFed').style.display = 'none';
                document.getElementById('tabelaContainerAetFed').style.display = 'block';
                pdfBlobAetFed = null;
            });
        }

        const formFed = document.getElementById("aetFedForm");
        if (formFed) {
            formFed.addEventListener("submit", async e => {
                e.preventDefault();
                await salvarAetFederalRevisada();
            });
        }
    }

    async function processarAetFederal(file) {
        const statusEl = document.getElementById("statusAetFed");
        document.getElementById("fileNameAetFed").textContent = file.name;
        statusEl.innerText = "Extraindo dados do PDF...";
        statusEl.style.color = "var(--ccol-blue-bright)";
        pdfBlobAetFed = file;

        try {
            const texto = await window.lerTextoPDF(file);
            const dadosExtraidos = extrairAetFederal(texto);

            if (!dadosExtraidos.numeroAET && !dadosExtraidos.u1_placa) {
                throw new Error("Não foi possível identificar dados básicos na AET.");
            }

            preencherFormularioAetFed(dadosExtraidos);
            
            document.getElementById('modalImportacao').style.display = 'none';
            document.getElementById('tabelaContainerAetFed').style.display = 'none';
            document.getElementById('formCardAetFed').style.display = 'block';
            
            statusEl.innerText = "";
            document.getElementById("fileNameAetFed").textContent = "";
        } catch (err) {
            console.error(err);
            statusEl.innerText = "Erro: " + err.message;
            statusEl.style.color = "#ef4444";
        }
    }

    function preencherFormularioAetFed(dados) {
        const form = document.getElementById("aetFedForm");
        const camposSimples = [
            "numeroAET", "conjuntoTipo", "proprietario", "cnpjCpf", "endereco", "telefone",
            "validadeInicio", "validadeFim", "pbtcInformado", "comprimento",
            "u1_placa", "u1_anoFab", "u1_chassi", "u1_marca", "u1_modelo", "u1_carroceria",
            "u1_tara", "u1_tracao", "u1_potencia", "u1_cmt", "u1_direcao", "u1_renavam",
            "u1_rntrc", "u1_bidirecional"
        ];

        camposSimples.forEach(k => {
            const field = form.elements[k];
            if (field) field.value = dados[k] || "";
        });

        const contU = document.getElementById("uComplementaresContainer");
        contU.innerHTML = "";
        (dados.unidadesComplementares || []).forEach(u => adicionarUnidadeComplementarFed(u));

        const contC = document.getElementById("cComplementaresContainer");
        contC.innerHTML = "";
        (dados.carretasComplementares || []).forEach(c => adicionarCarretaComplementarFed(c));
    }

    function adicionarUnidadeComplementarFed(u) {
        const cont = document.getElementById("uComplementaresContainer");
        const idx = cont.children.length + 2;
        const div = document.createElement("div");
        div.className = "dynamic-card";
        div.innerHTML = `
            <div class="dynamic-card-header">
                <strong>Unidade U${idx}</strong>
                <button type="button" class="btn-remover"><i class="fas fa-times"></i> Remover</button>
            </div>
            <div class="form-grid">
                <div class="form-group"><label>Placa</label><input type="text" data-campo="placa" class="form-control" value="${u.placa || ""}" /></div>
                <div class="form-group"><label>Ano Fab.</label><input type="text" data-campo="anoFab" class="form-control" value="${u.anoFab || ""}" /></div>
                <div class="form-group"><label>Chassi</label><input type="text" data-campo="chassi" class="form-control" value="${u.chassi || ""}" /></div>
                <div class="form-group"><label>Marca</label><input type="text" data-campo="marca" class="form-control" value="${u.marca || ""}" /></div>
                <div class="form-group"><label>Modelo</label><input type="text" data-campo="modelo" class="form-control" value="${u.modelo || ""}" /></div>
                <div class="form-group"><label>Carroceria</label><input type="text" data-campo="carroceria" class="form-control" value="${u.carroceria || ""}" /></div>
                <div class="form-group"><label>Tara</label><input type="text" data-campo="tara" class="form-control" value="${u.tara || ""}" /></div>
                <div class="form-group"><label>RENAVAM</label><input type="text" data-campo="renavam" class="form-control" value="${u.renavam || ""}" /></div>
                <div class="form-group"><label>RNTRC</label><input type="text" data-campo="rntrc" class="form-control" value="${u.rntrc || ""}" /></div>
                <div class="form-group"><label>Eixos</label><input type="text" data-campo="numEixos" class="form-control" value="${u.numEixos || ""}" /></div>
                <div class="form-group"><label>Pneus/Eixo</label><input type="text" data-campo="pneusPorEixo" class="form-control" value="${u.pneusPorEixo || ""}" /></div>
            </div>
        `;
        div.querySelector(".btn-remover").addEventListener("click", () => {
            div.remove();
            Array.from(cont.children).forEach((card, i) => {
                card.querySelector(".dynamic-card-header strong").textContent = `Unidade U${i + 2}`;
            });
        });
        cont.appendChild(div);
    }

    function adicionarCarretaComplementarFed(c) {
        const cont = document.getElementById("cComplementaresContainer");
        const div = document.createElement("div");
        div.className = "dynamic-card";
        div.innerHTML = `
            <div class="dynamic-card-header">
                <strong>Carreta / Reboque</strong>
                <button type="button" class="btn-remover"><i class="fas fa-times"></i> Remover</button>
            </div>
            <div class="form-grid">
                <div class="form-group"><label>Placa</label><input type="text" data-campo="placa" class="form-control" value="${c.placa || ""}" /></div>
                <div class="form-group"><label>Marca</label><input type="text" data-campo="marca" class="form-control" value="${c.marca || ""}" /></div>
                <div class="form-group"><label>Modelo</label><input type="text" data-campo="modelo" class="form-control" value="${c.modelo || ""}" /></div>
                <div class="form-group"><label>Ano Fab.</label><input type="text" data-campo="anoFab" class="form-control" value="${c.anoFab || ""}" /></div>
                <div class="form-group"><label>Chassi</label><input type="text" data-campo="chassi" class="form-control" value="${c.chassi || ""}" /></div>
                <div class="form-group"><label>RENAVAM</label><input type="text" data-campo="renavam" class="form-control" value="${c.renavam || ""}" /></div>
                <div class="form-group"><label>RNTRC</label><input type="text" data-campo="rntrc" class="form-control" value="${c.rntrc || ""}" /></div>
                <div class="form-group"><label>Carroceria</label><input type="text" data-campo="carroceria" class="form-control" value="${c.carroceria || ""}" /></div>
                <div class="form-group"><label>Tara</label><input type="text" data-campo="tara" class="form-control" value="${c.tara || ""}" /></div>
                <div class="form-group"><label>Eixos</label><input type="text" data-campo="numEixos" class="form-control" value="${c.numEixos || ""}" /></div>
                <div class="form-group"><label>Pneus/Eixo</label><input type="text" data-campo="pneusPorEixo" class="form-control" value="${c.pneusPorEixo || ""}" /></div>
            </div>
        `;
        div.querySelector(".btn-remover").addEventListener("click", () => div.remove());
        cont.appendChild(div);
    }

    async function salvarAetFederalRevisada() {
        const form = document.getElementById("aetFedForm");
        const btnSubmit = form.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

        try {
            const dados = {};
            Array.from(form.elements).forEach(el => {
                if (el.name) dados[el.name] = el.value.trim();
            });

            dados.unidadesComplementares = [];
            document.querySelectorAll("#uComplementaresContainer .dynamic-card").forEach(card => {
                const u = {};
                card.querySelectorAll("input").forEach(inp => u[inp.dataset.campo] = inp.value.trim());
                dados.unidadesComplementares.push(u);
            });

            dados.carretasComplementares = [];
            document.querySelectorAll("#cComplementaresContainer .dynamic-card").forEach(card => {
                const c = {};
                card.querySelectorAll("input").forEach(inp => c[inp.dataset.campo] = inp.value.trim());
                dados.carretasComplementares.push(c);
            });

            let pdfInfo = { url: null, path: null };
            if (pdfBlobAetFed) {
                pdfInfo = await db.uploadPdfAet(pdfBlobAetFed, dados.numeroAET, 'FEDERAL');
            }

            const payload = {
                numero_aet: dados.numeroAET,
                tipo: 'FEDERAL',
                validade_inicio: dados.validadeInicio,
                validade_fim: dados.validadeFim,
                pdf_url: pdfInfo.url,
                pdf_path: pdfInfo.path,
                dados: dados
            };

            await db.upsertAet(payload);
            
            alert("AET Federal salva com sucesso!");
            document.getElementById('formCardAetFed').style.display = 'none';
            document.getElementById('tabelaContainerAetFed').style.display = 'block';
            pdfBlobAetFed = null;
            form.reset();
            await carregarListas();

        } catch (err) {
            console.error(err);
            alert("Erro ao salvar: " + err.message);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<i class="fas fa-save"></i> Confirmar e Salvar';
        }
    }

    // =====================================================
    // PARSER AET FEDERAL (Com Estratégia Robusta e Limpa)
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

        const numeroAET = pick([/A\.?E\.?T\.?\s*N[ºO°]?\s*([0-9]+\/[0-9]+[A-Z]?)/]);
        const conjuntoTipo = pick([
            /A\.?E\.?T\.?\s*N[ºO°]?\s*[0-9\/A-Z]+\s+([A-Z0-9\s\+]+?)\s+PROPRIET/i,
            /(TRITREM\s+\d+\s+EIXOS\s+[A-Z0-9\+]+)/
        ]);

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

        let validadeInicio = "", validadeFim = "";
        {
            const m = up.match(/PER[ÍI]ODO\s+DE[:\s]+(\d{2}\/\d{2}\/\d{4})\s+A\s+(\d{2}\/\d{2}\/\d{4})/);
            if (m) { validadeInicio = m[1]; validadeFim = m[2]; }
        }

        const pbtcInformado = pick([/PBTC\s*INFORMADO\s*\(t\)[:\s]*([0-9.,]+)/]);
        const comprimento = pick([/COMPRIMENTO\s*\(m\)[:\s]*([0-9.,]+)/]);

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

        // Extração por Eliminação - Acha e destrói para sobrar apenas a Marca/Modelo
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
            
            let bloco = blocoLinhas.join(" ").toUpperCase().replace(/\s+/g, " ").trim();
            const u = {};

            u.placa = (bloco.match(/\b([A-Z]{3}[0-9][A-Z][0-9]{2})\b/) || [])[1] || "";
            bloco = bloco.replace(u.placa, "");

            u.chassi = (bloco.match(/\b([A-HJ-NPR-Z0-9]{17})\b/) || [])[1] || "";
            bloco = bloco.replace(u.chassi, "");

            u.anoFab = (bloco.match(/\b((?:19|20)\d{2})\b/) || [])[1] || "";
            bloco = bloco.replace(u.anoFab, "");

            u.tara = (bloco.match(/\b(\d{1,2},\d{3})\b/) || [])[1] || "";
            bloco = bloco.replace(u.tara, "");

            const tr = bloco.match(/\b(DUPLA|SIMPLES|TANDEM)\s+(\d+X\d+)\b/);
            if (tr) {
                u.tracao = `${tr[1]} ${tr[2]}`;
                bloco = bloco.replace(tr[0], "");
            }

            const renavam11 = bloco.match(/\b(\d{11})\b/);
            if (renavam11) { u.renavam = renavam11[1]; bloco = bloco.replace(renavam11[0], ""); }
            else {
                const renavam10 = bloco.match(/\b(\d{10})\b/);
                if (renavam10) { u.renavam = renavam10[1]; bloco = bloco.replace(renavam10[0], ""); }
            }

            if (tipo === "u1") {
                const rntrc9 = bloco.match(/\b(\d{9})\b/);
                if (rntrc9) { u.rntrc = rntrc9[1]; bloco = bloco.replace(rntrc9[0], ""); }
            } else {
                const rntrcLetras = bloco.match(/\b(TCP|TAC|ETC|CTC)\b/);
                if (rntrcLetras) { u.rntrc = rntrcLetras[1]; bloco = bloco.replace(rntrcLetras[0], ""); }
                else {
                    const rntrcDig = bloco.match(/\b(\d{6,10})\b/g);
                    if (rntrcDig && rntrcDig.length) { 
                        u.rntrc = rntrcDig[rntrcDig.length - 1]; 
                        bloco = bloco.replace(u.rntrc, ""); 
                    }
                }
            }

            if (tipo === "u1") {
                const dir = bloco.match(/\b(HIDR[ÁA]ULICA|MEC[ÂA]NICA|EL[ÉE]TRICA)\b/);
                if (dir) { u.direcao = dir[1].charAt(0) + dir[1].slice(1).toLowerCase(); bloco = bloco.replace(dir[0], ""); }

                const bidir = bloco.match(/\b(N[ÃA]O|SIM)\s*$/);
                if (bidir) { u.bidirecional = bidir[1].charAt(0) + bidir[1].slice(1).toLowerCase(); bloco = bloco.replace(bidir[0], ""); }

                const potCmt = bloco.match(/\b(\d{2,4})\s+(\d{1,3},\d)\b/);
                if (potCmt) {
                    u.potencia = potCmt[1];
                    u.cmt = potCmt[2];
                    bloco = bloco.replace(potCmt[0], "");
                }
            } else {
                const dip = bloco.match(/\b(\d)\s+(\d)\s*$/);
                if (dip) {
                    u.numEixos = dip[1];
                    u.pneusPorEixo = dip[2];
                    bloco = bloco.replace(dip[0], "");
                }
            }

            bloco = bloco.trim().replace(/\s+/g, " ");

            // Remove a palavra da Carroceria para sobrar só a Marca e o Modelo
            const carrMatch = bloco.match(/(N[ÃA]O\s*TEM|FLORESTAL|BA[ÚU]|SIDER|GRANELEIRO|TANQUE|CA[ÇC]AMBA)/i);
            if (carrMatch) {
                u.carroceria = carrMatch[1].toUpperCase();
                bloco = bloco.replace(carrMatch[0], "").trim();
            }

            const partes = bloco.split(/\s+/);
            if (partes.length >= 2) {
                u.marca = partes[0];
                u.modelo = partes.slice(1).join(" ");
            } else if (partes.length === 1) {
                u.marca = partes[0];
                u.modelo = "";
            }

            return u;
        }

        let u1 = {};
        {
            const idxU1 = acharLinha(/^UNIDADE\s+U1\b/);
            if (idxU1 !== -1) u1 = extrairUnidadePorValor(idxU1, "u1");
        }

        let tempUnidades = [];
        for (let n = 2; n <= 6; n++) {
            const idx = acharLinha(new RegExp(`^UNIDADE\\s+U${n}\\b`));
            if (idx !== -1) {
                const u = extrairUnidadePorValor(idx, "complementar");
                if (u && (u.placa || u.chassi)) tempUnidades.push(u);
            }
        }

        let tempCarretas = [];
        
        // Estratégia GLOBAL: Ignora quebras de linha varrendo o bloco limpo de reboques
        const idxReboques = flat.lastIndexOf("REBOQUES E/OU SEMIRREBOQUES COMPLEMENTARES");
        if (idxReboques !== -1) {
            let blocoReboques = flat.substring(idxReboques).replace(/\|/g, " ").replace(/\s+/g, " ").trim();
            const regexCarretasGlobal = /([A-Z]{3}[0-9][A-Z0-9][0-9]{2})\s+(.*?)\s+((?:19|20)\d{2})\s+([A-HJ-NPR-Z0-9]{17})\s+(\d{9,11})\s+([A-Z0-9]{3,10})\s+([A-ZÀ-Ú]{4,15})\s+(\d{1,2},\d{3})\s+(\d{1,2})\s+(\d{1,2})/g;
            let match;
            
            while ((match = regexCarretasGlobal.exec(blocoReboques)) !== null) {
                let marcaModelo = match[2].trim();
                let marca = "";
                let modelo = marcaModelo;
                const marcasConhecidas = ["FACCHINI", "RANDON", "GUERRA", "LIBRELATO", "NOMA", "KRONE", "VOLVO", "SCANIA", "MERCEDES"];
                
                for (let m of marcasConhecidas) {
                    if (marcaModelo.toUpperCase().includes(m)) {
                        marca = m;
                        modelo = marcaModelo.replace(new RegExp(m, 'i'), "").trim();
                        break;
                    }
                }

                tempCarretas.push({
                    placa: match[1],
                    marca: marca || marcaModelo.split(" ")[0],
                    modelo: modelo || marcaModelo.split(" ").slice(1).join(" "),
                    anoFab: match[3],
                    chassi: match[4],
                    renavam: match[5],
                    rntrc: match[6],
                    carroceria: match[7],
                    tara: match[8],
                    numEixos: match[9],
                    pneusPorEixo: match[10]
                });
            }
        }

        // Consolida e garante as 3 unidades na hierarquia U2, U3 e U4 e joga o resto pras carretas
        let todosReboquesExtraidos = [];
        tempUnidades.forEach(u => { if(u.placa) todosReboquesExtraidos.push(u); });
        tempCarretas.forEach(c => { if(c.placa) todosReboquesExtraidos.push(c); });

        const placasVistas = new Set([u1.placa]);
        todosReboquesExtraidos = todosReboquesExtraidos.filter(r => {
            if(!r.placa || placasVistas.has(r.placa)) return false;
            placasVistas.add(r.placa);
            return true;
        });

        const unidadesComplementares = todosReboquesExtraidos.slice(0, 3);
        const carretasComplementares = todosReboquesExtraidos.slice(3);

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
    // AET ESTADUAL — IMPORTAÇÃO GERAL
    // =====================================================
    function configurarAetEstadual() {
        const inputEst = document.getElementById("pdfInputAetEst");
        if (inputEst) {
            inputEst.addEventListener("change", async e => {
                const file = e.target.files[0];
                if (file) await processarAetEstadual(file);
                inputEst.value = "";
            });
        }
    }

    async function processarAetEstadual(file) {
        const statusEl = document.getElementById("statusAetEst");
        document.getElementById("fileNameAetEst").textContent = file.name;
        statusEl.innerText = "Lendo PDF Estadual...";
        statusEl.style.color = "var(--ccol-blue-bright)";

        try {
            const texto = await window.lerTextoPDF(file);
            const dadosExtraidos = extrairAetEstadual(texto);

            if (!dadosExtraidos.numeroAET) throw new Error("Não foi possível identificar a AET Estadual.");

            let pdfInfo = { url: null, path: null };
            try {
                pdfInfo = await db.uploadPdfAet(file, dadosExtraidos.numeroAET, 'ESTADUAL');
            } catch (err) {
                console.warn("Erro ao subir PDF da AET Estadual:", err);
            }

            const payload = {
                numero_aet: dadosExtraidos.numeroAET,
                tipo: 'ESTADUAL',
                validade_inicio: dadosExtraidos.validadeInicio,
                validade_fim: dadosExtraidos.validadeFim,
                pdf_url: pdfInfo.url,
                pdf_path: pdfInfo.path,
                dados: dadosExtraidos
            };

            await db.upsertAet(payload);
            statusEl.innerText = "AET Estadual importada com sucesso!";
            statusEl.style.color = "#10b981";
            await carregarListas();
            
            setTimeout(() => {
                const modal = document.getElementById('modalImportacao');
                if(modal) modal.style.display = 'none';
                statusEl.innerText = "";
                document.getElementById("fileNameAetEst").textContent = "";
            }, 1500);

        } catch (err) {
            console.error(err);
            statusEl.innerText = "Erro: " + err.message;
            statusEl.style.color = "#ef4444";
        }
    }

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

        const numeroAET = pick([/^(\d{15,})\s+TRANSPORTADOR/i, /\b(\d{15,})\b/]);
        let uf = "";
        {
            const m = up.match(/\b(BA|ES|MG|SP|RJ|PR|SC|RS|GO|MT|MS|DF|TO|MA|PI|CE|RN|PB|PE|AL|SE|AM|PA|AC|RO|RR|AP)\s+\d{3}/);
            if (m) uf = m[1];
        }

        const transportador = pick([/TRANSPORTADOR[:\s]+(.+?)\s+ENDERE[ÇC]O/i, /TRANSPORTADOR[:\s]+(.+?)\s+(?:RUA|AV\.|AVENIDA|ROD\.)/i]);
        const endereco = pick([/ENDERE[ÇC]O[:\s]+(.+?)\s+TELEFONE/i, /ENDERE[ÇC]O[:\s]+(.+?)\s*\/\s*comercial/i]);
        const contato = pick([/TELEFONE\s*\/\s*FAX\s*\/\s*E-?MAIL[:\s]+(.+?)\s+NOME\s+DO\s+REQUERENTE/i, /TELEFONE\s*\/\s*FAX\s*\/\s*E-?MAIL[:\s]+(.+?)\s+NOME/i]);
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

        const velocidadeMax = pick([/VELOCIDADE\s+(?:M[ÁA]XIMA\s+)?DE\s+(\d+(?:[.,]\d+)?)\s*KM\s*\/\s*H/i, /AT[ÉE]\s+A\s+VELOCIDADE\s+DE\s+(\d+(?:[.,]\d+)?)\s*KM\s*\/\s*H/i]);
        const marca = pick([/MARCA\s*[:\s]+([A-ZÀ-Ú][A-ZÀ-Ú0-9\s\-\.]+?)\s+MODELO/i]);
        const modelo = pick([/MODELO\s*[:\s]+(.+?)\s+ANO\s*FAB/i, /MODELO\s*[:\s]+(.+?)\s+ANO\s*FAB\./i]);

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
    // RENDERIZAR TABELAS DA AET (COLUNAS ESPECÍFICAS U1/U2/U3/U4)
    // =====================================================
    function renderizarTabelaFed() {
        const tbody = document.querySelector("#tabelaAetFed tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        if (listaAetFed.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--text-secondary);">Nenhuma AET Federal cadastrada.</td></tr>`;
            return;
        }

        listaAetFed.forEach(a => {
            const nomeFilial = mapaFiliais[a.filial_id] || (a.filiais ? a.filiais.nome : "—");
            
            let todosReboques = [];
            if (a.unidadesComplementares) {
                a.unidadesComplementares.forEach(u => { if (u.placa) todosReboques.push(u); });
            }
            if (a.carretasComplementares) {
                a.carretasComplementares.forEach(c => { if (c.placa) todosReboques.push(c); });
            }

            const placasVistas = new Set([a.u1_placa]);
            todosReboques = todosReboques.filter(r => {
                if(placasVistas.has(r.placa)) return false;
                placasVistas.add(r.placa);
                return true;
            });

            const u1 = a.u1_placa ? `<span class="placa-tag cavalo" title="${a.u1_chassi || ''}">${a.u1_placa}</span>` : "-";
            
            let u2 = todosReboques[0] ? `<span class="placa-tag reboque" title="${todosReboques[0].chassi || ''}">${todosReboques[0].placa}</span>` : "-";
            let u3 = todosReboques[1] ? `<span class="placa-tag reboque" title="${todosReboques[1].chassi || ''}">${todosReboques[1].placa}</span>` : "-";
            let u4 = todosReboques[2] ? `<span class="placa-tag reboque" title="${todosReboques[2].chassi || ''}">${todosReboques[2].placa}</span>` : "-";

            const carretasExtra = todosReboques.length > 3 ? todosReboques.length - 3 : 0;
            const extraInfo = carretasExtra > 0 ? `<div style="font-size:0.75rem; color:#9ca3af; margin-top:5px; text-align:center; font-weight:bold;">+ ${carretasExtra} reboques extras</div>` : "";

            const status = getStatusValidade(a.validade_fim);

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${a.numero_aet || "-"}</strong><br><span style="font-size:0.75rem; color:var(--text-secondary);">${nomeFilial}</span></td>
                <td>${a.conjuntoTipo || "-"}</td>
                <td class="cell-placa">${u1}</td>
                <td class="cell-placa">${u2}</td>
                <td class="cell-placa">${u3}</td>
                <td class="cell-placa">${u4}${extraInfo}</td>
                <td>
                    ${a.validade_inicio || "-"} a <strong>${a.validade_fim || "-"}</strong><br>
                    <span class="badge-status ${status.classe}">${status.texto}</span>
                </td>
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
            
            const cavaloHtml = a.placasCavalo ? `<span class="placa-tag cavalo">${a.placasCavalo}</span>` : "-";

            let reboquesP = (a.placasReboques || "").split('/').map(p => p.trim()).filter(Boolean);
            let reboquesHtml = reboquesP.slice(0, 3).map(p => `<span class="placa-tag reboque">${p}</span>`).join(" ");
            
            const totalAdicional = (a.placasAdicionais ? a.placasAdicionais.length : 0);
            if (reboquesP.length > 3 || totalAdicional > 0) {
                const totalExtras = (reboquesP.length > 3 ? reboquesP.length - 3 : 0) + totalAdicional;
                reboquesHtml += `<div style="font-size:0.75rem; color:#9ca3af; margin-top:5px; font-weight:bold;">+ ${totalExtras} placas em detalhes</div>`;
            }
            if(!reboquesHtml) reboquesHtml = "-";

            const status = getStatusValidade(a.validade_fim);

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${a.numero_aet || "-"}</strong><br><span style="font-size:0.75rem; color:var(--text-secondary);">${nomeFilial}</span></td>
                <td><strong>${a.uf || "-"}</strong><br><span style="font-size:0.75rem; color:var(--text-secondary);">${a.restricaoHorario || "-"}</span></td>
                <td class="cell-placa">${cavaloHtml}</td>
                <td class="cell-placa">${reboquesHtml}</td>
                <td>
                    ${a.validade_inicio || "-"} a <strong>${a.validade_fim || "-"}</strong><br>
                    <span class="badge-status ${status.classe}">${status.texto}</span>
                </td>
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

    // =====================================================
    // ABRIR DETALHES COM MODAL HTML MODERNO (Tabela Blindada)
    // =====================================================
    window.abrirDetalhesAetFed = function(numero, filialId) {
        const a = encontrarAetFed(numero, filialId);
        if (!a) return;

        const titulo = document.getElementById("modalDetalhesTitulo");
        const body = document.getElementById("modalDetalhesBody");

        titulo.innerHTML = `<i class="fas fa-file-alt"></i> AET Federal nº ${a.numero_aet} <span style="color:#60a5fa; margin-left:10px;">(U1: ${a.u1_placa || "-"})</span>`;

        let html = `<h4 class="form-section-title" style="margin-top:0;">Identificação</h4>
                    <div class="detalhes-grid">
                        <div class="detalhe-item"><span class="detalhe-label">Conjunto</span><span class="detalhe-valor">${a.conjuntoTipo || "-"}</span></div>
                        <div class="detalhe-item"><span class="detalhe-label">Proprietário</span><span class="detalhe-valor">${a.proprietario || "-"}</span></div>
                        <div class="detalhe-item"><span class="detalhe-label">CNPJ/CPF</span><span class="detalhe-valor">${a.cnpjCpf || "-"}</span></div>
                        <div class="detalhe-item"><span class="detalhe-label">Endereço</span><span class="detalhe-valor">${a.endereco || "-"}</span></div>
                        <div class="detalhe-item"><span class="detalhe-label">Telefone</span><span class="detalhe-valor">${a.telefone || "-"}</span></div>
                        <div class="detalhe-item"><span class="detalhe-label">Validade</span><span class="detalhe-valor">${a.validade_inicio || "-"} a ${a.validade_fim || "-"}</span></div>
                        <div class="detalhe-item"><span class="detalhe-label">PBTC (t)</span><span class="detalhe-valor">${a.pbtcInformado || "-"}</span></div>
                        <div class="detalhe-item"><span class="detalhe-label">Comprimento (m)</span><span class="detalhe-valor">${a.comprimento || "-"}</span></div>
                    </div>`;

        html += `<h4 class="form-section-title">Cavalo U1</h4>
                 <div class="detalhes-grid">
                    <div class="detalhe-item"><span class="detalhe-label">Placa</span><span class="detalhe-valor"><span class="placa-tag cavalo">${a.u1_placa || "-"}</span></span></div>
                    <div class="detalhe-item"><span class="detalhe-label">Marca / Modelo</span><span class="detalhe-valor">${a.u1_marca || "-"} ${a.u1_modelo || ""}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">Ano Fab.</span><span class="detalhe-valor">${a.u1_anoFab || "-"}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">Chassi</span><span class="detalhe-valor">${a.u1_chassi || "-"}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">RENAVAM</span><span class="detalhe-valor">${a.u1_renavam || "-"}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">RNTRC</span><span class="detalhe-valor">${a.u1_rntrc || "-"}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">Carroceria (Tipo)</span><span class="detalhe-valor">${a.u1_carroceria || "-"}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">Tara (t)</span><span class="detalhe-valor">${a.u1_tara || "-"}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">Tração</span><span class="detalhe-valor">${a.u1_tracao || "-"}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">Potência (CV)</span><span class="detalhe-valor">${a.u1_potencia || "-"}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">CMT (t)</span><span class="detalhe-valor">${a.u1_cmt || "-"}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">Direção</span><span class="detalhe-valor">${a.u1_direcao || "-"}</span></div>
                 </div>`;

        let todosReboques = [];
        if (a.unidadesComplementares) a.unidadesComplementares.forEach(u => { if(u.placa) todosReboques.push(u); });
        if (a.carretasComplementares) a.carretasComplementares.forEach(c => { if(c.placa) todosReboques.push(c); });

        const placasVistas = new Set([a.u1_placa]);
        todosReboques = todosReboques.filter(r => {
            if(!r.placa || placasVistas.has(r.placa)) return false;
            placasVistas.add(r.placa);
            return true;
        });

        if (todosReboques.length > 0) {
            html += `<h4 class="form-section-title" style="color:#fcd34d; margin-top: 25px;">Carretas / Reboques Complementares (${todosReboques.length})</h4>`;
            
            html += `<div class="table-responsive" style="margin-bottom: 20px;">
                        <table class="dark-table" style="min-width: 1100px;">
                        <thead>
                            <tr>
                                <th>Placa</th>
                                <th>Marca/Modelo</th>
                                <th>Ano</th>
                                <th>Chassi</th>
                                <th>RENAVAM</th>
                                <th>RNTRC</th>
                                <th>Carroceria</th>
                                <th>Tara (t)</th>
                                <th>Eixos</th>
                                <th>Pneus/Eixo</th>
                            </tr>
                        </thead>
                        <tbody>`;
            
            todosReboques.forEach((c) => {
                html += `<tr>
                            <td><span class="placa-tag reboque">${c.placa || "-"}</span></td>
                            <td>${c.marca || "-"} ${c.modelo || ""}</td>
                            <td>${c.anoFab || c.ano || "-"}</td>
                            <td>${c.chassi || "-"}</td>
                            <td>${c.renavam || "-"}</td>
                            <td>${c.rntrc || "-"}</td>
                            <td>${c.carroceria || "-"}</td>
                            <td>${c.tara || "-"}</td>
                            <td>${c.numEixos || "-"}</td>
                            <td>${c.pneusPorEixo || "-"}</td>
                         </tr>`;
            });
            html += `</tbody></table></div>`;
        }

        body.innerHTML = html;
        document.getElementById('modalDetalhesAet').style.display = 'flex';
    };

    window.abrirDetalhesAetEst = function(numero, filialId) {
        const a = encontrarAetEst(numero, filialId);
        if (!a) return;

        const titulo = document.getElementById("modalDetalhesTitulo");
        const body = document.getElementById("modalDetalhesBody");

        titulo.innerHTML = `<i class="fas fa-file-alt"></i> AET Estadual nº ${a.numero_aet} <span style="color:#60a5fa; margin-left:10px;">(UF: ${a.uf || "-"})</span>`;

        let html = `<h4 class="form-section-title" style="margin-top:0;">Identificação</h4>
                    <div class="detalhes-grid">
                        <div class="detalhe-item"><span class="detalhe-label">Transportador</span><span class="detalhe-valor">${a.transportador || "-"}</span></div>
                        <div class="detalhe-item"><span class="detalhe-label">Endereço</span><span class="detalhe-valor">${a.endereco || "-"}</span></div>
                        <div class="detalhe-item"><span class="detalhe-label">Requerente</span><span class="detalhe-valor">${a.requerente || "-"}</span></div>
                        <div class="detalhe-item"><span class="detalhe-label">Origem</span><span class="detalhe-valor">${a.origem || "-"}</span></div>
                        <div class="detalhe-item"><span class="detalhe-label">Validade</span><span class="detalhe-valor">${a.validade_inicio || "-"} a ${a.validade_fim || "-"}</span></div>
                        <div class="detalhe-item"><span class="detalhe-label">Restrição</span><span class="detalhe-valor">${a.restricaoHorario || "-"}</span></div>
                        <div class="detalhe-item"><span class="detalhe-label">Velocidade Máx.</span><span class="detalhe-valor">${a.velocidadeMax || "-"}</span></div>
                    </div>`;

        html += `<h4 class="form-section-title">Veículos</h4>
                 <div class="detalhes-grid">
                    <div class="detalhe-item"><span class="detalhe-label">Placa Cavalo</span><span class="detalhe-valor"><span class="placa-tag cavalo">${a.placasCavalo || "-"}</span></span></div>
                    <div class="detalhe-item"><span class="detalhe-label">Placa(s) Reboques</span><span class="detalhe-valor">${(a.placasReboques || "").split('/').map(p => `<span class="placa-tag reboque">${p.trim()}</span>`).join(' ') || "-"}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">Marca/Modelo</span><span class="detalhe-valor">${a.marca || ""} ${a.modelo || ""}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">Ano</span><span class="detalhe-valor">${a.anoFab || "-"}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">Comprimento</span><span class="detalhe-valor">${a.comprimento || "-"}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">Peso Total</span><span class="detalhe-valor">${a.pesoTotal || "-"}</span></div>
                 </div>`;

        if (a.placasAdicionais && a.placasAdicionais.length > 0) {
            html += `<h4 class="form-section-title" style="color:#fcd34d;">Reboques Adicionais (${a.placasAdicionais.length})</h4>
                     <div style="background: rgba(255,255,255,0.02); padding: 15px; border-radius: 8px; border: 1px solid #374151;">
                        ${a.placasAdicionais.map(p => `<span class="placa-tag reboque">${p}</span>`).join(" ")}
                     </div>`;
        }

        if (a.trechos && a.trechos.length > 0) {
            html += `<h4 class="form-section-title" style="color:#9ca3af;">Trechos</h4>
                     <ul style="color:#e5e7eb; font-size:0.9rem; padding-left: 20px;">
                        ${a.trechos.map(t => `<li style="margin-bottom:5px;">${t}</li>`).join("")}
                     </ul>`;
        }

        if (a.restricoes && a.restricoes.length > 0) {
            html += `<h4 class="form-section-title" style="color:#ef4444;">Restrições</h4>
                     <ul style="color:#e5e7eb; font-size:0.9rem; padding-left: 20px;">
                        ${a.restricoes.map(r => `<li style="margin-bottom:5px;">${r}</li>`).join("")}
                     </ul>`;
        }

        body.innerHTML = html;
        document.getElementById('modalDetalhesAet').style.display = 'flex';
    };


    window.visualizarPdfAetFed = function(numero, filialId) {
        const a = encontrarAetFed(numero, filialId);
        if (!a || !a.pdf_url) { alert("PDF não disponível."); return; }
        window.open(a.pdf_url, "_blank");
    };

    window.visualizarPdfAetEst = function(numero, filialId) {
        const a = encontrarAetEst(numero, filialId);
        if (!a || !a.pdf_url) { alert("PDF não disponível."); return; }
        window.open(a.pdf_url, "_blank");
    };

    window.solicitarAtualizacaoAetFed = function(numero, filialId) {
        numeroAetFedEmAtualizacao = numero;
        filialAetFedEmAtualizacao = filialId;
        const input = document.getElementById("inputAtualizarAetFed");
        input.value = "";
        input.click();
    };

    window.solicitarAtualizacaoAetEst = function(numero, filialId) {
        numeroAetEstEmAtualizacao = numero;
        filialAetEstEmAtualizacao = filialId;
        const input = document.getElementById("inputAtualizarAetEst");
        input.value = "";
        input.click();
    };

    window.excluirAetFed = async function(numero, filialId) {
        if (!confirm(`Excluir AET Federal ${numero}?`)) return;
        try {
            await db.deleteAet(numero, 'FEDERAL', filialId);
            await carregarListas();
        } catch (e) {
            alert("Erro ao excluir: " + e.message);
        }
    };

    window.excluirAetEst = async function(numero, filialId) {
        if (!confirm(`Excluir AET Estadual ${numero}?`)) return;
        try {
            await db.deleteAet(numero, 'ESTADUAL', filialId);
            await carregarListas();
        } catch (e) {
            alert("Erro ao excluir: " + e.message);
        }
    };

    // =====================================================
    // ATUALIZAÇÃO REVERSA VIA HIDDEN INPUTS
    // =====================================================
    function configurarAtualizacaoHidden() {
        const inFed = document.getElementById("inputAtualizarAetFed");
        if (inFed) {
            inFed.addEventListener("change", async e => {
                const file = e.target.files[0];
                inFed.value = "";
                if (!file || !numeroAetFedEmAtualizacao) return;
                try {
                    const texto = await window.lerTextoPDF(file);
                    const dados = extrairAetFederal(texto);
                    if (!dados.numeroAET) dados.numeroAET = numeroAetFedEmAtualizacao;
                    
                    const upInfo = await db.uploadPdfAet(file, numeroAetFedEmAtualizacao, 'FEDERAL');
                    const payload = {
                        numero_aet: dados.numeroAET,
                        tipo: 'FEDERAL',
                        filial_id: filialAetFedEmAtualizacao,
                        validade_inicio: dados.validadeInicio,
                        validade_fim: dados.validadeFim,
                        pdf_url: upInfo.url,
                        pdf_path: upInfo.path,
                        dados: dados
                    };
                    await db.upsertAet(payload);
                    alert("AET Federal atualizada com sucesso!");
                    await carregarListas();
                } catch (err) { alert("Erro: " + err.message); }
            });
        }

        const inEst = document.getElementById("inputAtualizarAetEst");
        if (inEst) {
            inEst.addEventListener("change", async e => {
                const file = e.target.files[0];
                inEst.value = "";
                if (!file || !numeroAetEstEmAtualizacao) return;
                try {
                    const texto = await window.lerTextoPDF(file);
                    const dados = extrairAetEstadual(texto);
                    if (!dados.numeroAET) dados.numeroAET = numeroAetEstEmAtualizacao;
                    
                    const upInfo = await db.uploadPdfAet(file, numeroAetEstEmAtualizacao, 'ESTADUAL');
                    const payload = {
                        numero_aet: dados.numeroAET,
                        tipo: 'ESTADUAL',
                        filial_id: filialAetEstEmAtualizacao,
                        validade_inicio: dados.validadeInicio,
                        validade_fim: dados.validadeFim,
                        pdf_url: upInfo.url,
                        pdf_path: upInfo.path,
                        dados: dados
                    };
                    await db.upsertAet(payload);
                    alert("AET Estadual atualizada com sucesso!");
                    await carregarListas();
                } catch (err) { alert("Erro: " + err.message); }
            });
        }
    }

    // =====================================================
    // CARREGAR LISTAS DA TABELA ÚNICA
    // =====================================================
    async function carregarListas() {
        try {
            const todasAsAets = await db.getAets();
            
            listaAetFed = todasAsAets.filter(a => a.tipo === 'FEDERAL').map(a => ({ ...a.dados, ...a }));
            listaAetEst = todasAsAets.filter(a => a.tipo === 'ESTADUAL').map(a => ({ ...a.dados, ...a }));
            
        } catch (e) {
            console.error("Erro getAets:", e);
            listaAetFed = [];
            listaAetEst = [];
        }

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
        configurarAtualizacaoHidden();
        await carregarListas();
    }

    inicializar();
};