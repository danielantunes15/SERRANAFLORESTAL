/* =========================================================
   MÓDULO: LICENÇAS — AET Federal e Estadual (CORE & UI)
   - Tabelas Planificadas, Parse Seguro de JSON e Modal Detalhado
   ========================================================= */

// =====================================================
// FUNÇÕES GLOBAIS DE INTERFACE
// =====================================================
window.alternarAbaAet = function(aba) {
    document.getElementById('abaFederal').style.display = aba === 'federal' ? 'block' : 'none';
    document.getElementById('abaEstadual').style.display = aba === 'estadual' ? 'block' : 'none';
    document.getElementById('btnAbaFederal').className = aba === 'federal' ? 'btn-primary-blue' : 'btn-secondary-dark';
    document.getElementById('btnAbaEstadual').className = aba === 'estadual' ? 'btn-primary-blue' : 'btn-secondary-dark';
};

window.abrirModalImportacaoDaAbaAtiva = function() {
    const abaEstadualVisivel = document.getElementById('abaEstadual').style.display === 'block';
    const tituloModal = document.getElementById('modalImportacaoTitulo');
    const boxFed = document.getElementById('boxUploadFed');
    const boxEst = document.getElementById('boxUploadEst');

    if (abaEstadualVisivel) {
        tituloModal.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Importar AET Estadual';
        boxFed.style.display = 'none';
        boxEst.style.display = 'flex';
    } else {
        tituloModal.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Importar AET Federal';
        boxFed.style.display = 'flex';
        boxEst.style.display = 'none';
    }
    
    document.getElementById('modalImportacao').style.display = 'flex';
};

// =====================================================
// INICIALIZAÇÃO DO MÓDULO E LÓGICA DE DADOS
// =====================================================
window.initFrotaLicencas = function() {
    let listaAetFed = [];
    let listaAetEst = [];
    let mapaFiliais = {};

    let pdfBlobAetFed = null;
    let numeroAetFedEmAtualizacao = null;
    let filialAetFedEmAtualizacao = null;

    let pdfBlobAetEst = null;
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

    // Helper robusto para converter JSON do Supabase com segurança
    function safeParseArray(val) {
        if (!val) return [];
        if (typeof val === 'string') {
            try { 
                const parsed = JSON.parse(val); 
                return Array.isArray(parsed) ? parsed : [];
            } catch(e) { return []; }
        }
        if (Array.isArray(val)) return val;
        return [];
    }

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
    // HELPERS PARA MAPEAR PAYLOADS DB (ESTRUTURA RELACIONAL)
    // =====================================================
    function gerarPayloadFed(dados, pdfInfo, filialId) {
        const payload = {
            numero_aet: dados.numeroAET,
            tipo: 'FEDERAL',
            validade_inicio: dados.validadeInicio,
            validade_fim: dados.validadeFim,
            pdf_url: pdfInfo.url,
            pdf_path: pdfInfo.path,
            
            proprietario: dados.proprietario,
            cnpj_cpf: dados.cnpjCpf,
            endereco: dados.endereco,
            telefone: dados.telefone,
            pbtc_informado: dados.pbtcInformado,
            comprimento: dados.comprimento,
            conjunto_tipo: dados.conjuntoTipo,
            
            placa_cavalo: dados.u1_placa,
            ano_fab: dados.u1_anoFab,
            chassi: dados.u1_chassi,
            marca: dados.u1_marca,
            modelo: dados.u1_modelo,
            carroceria: dados.u1_carroceria,
            tara: dados.u1_tara,
            tracao: dados.u1_tracao,
            potencia: dados.u1_potencia,
            cmt: dados.u1_cmt,
            direcao: dados.u1_direcao,
            renavam: dados.u1_renavam,
            rntrc: dados.u1_rntrc,
            bidirecional: dados.u1_bidirecional,
            
            unidades_complementares: dados.unidadesComplementares,
            carretas_complementares: dados.carretasComplementares
        };
        
        if (filialId !== undefined) {
            payload.filial_id = filialId;
        }
        return payload;
    }

    function gerarPayloadEst(dados, pdfInfo, filialId) {
        const payload = {
            numero_aet: dados.numeroAET,
            tipo: 'ESTADUAL',
            validade_inicio: dados.validadeInicio,
            validade_fim: dados.validadeFim,
            pdf_url: pdfInfo.url,
            pdf_path: pdfInfo.path,
            
            uf: dados.uf,
            transportador: dados.transportador,
            endereco: dados.endereco,
            telefone: dados.contato,
            requerente: dados.requerente,
            origem: dados.origem,
            transportando: dados.transportando,
            restricao_horario: dados.restricaoHorario,
            velocidade_max: dados.velocidadeMax,
            
            placa_cavalo: dados.placasCavalo,
            placa_reb1: dados.placaReb1,
            placa_reb2: dados.placaReb2,
            placa_reb3: dados.placaReb3,
            marca: dados.marca,
            modelo: dados.modelo,
            ano_fab: dados.anoFab,
            comprimento: dados.comprimento,
            peso_total: dados.pesoTotal,
            largura: dados.largura,
            peso_1_unid: dados.peso1Unid,
            altura: dados.altura,
            peso_2_unid: dados.peso2Unid,
            largura_total: dados.larguraTotal,
            peso_carreta: dados.pesoCarreta,
            peso_carga: dados.pesoCarga,
            peso_acessorios: dados.pesoAcessorios,
            excesso_limite: dados.excessoLimite,
            
            placas_adicionais: dados.placasAdicionais,
            trechos: dados.trechos,
            restricoes: dados.restricoes
        };
        
        if (filialId !== undefined) {
            payload.filial_id = filialId;
        }
        return payload;
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
            console.log("=== TEXTO BRUTO FEDERAL ===", texto);

            const dadosExtraidos = window.AetParser.extrairAetFederal(texto);
            console.table(dadosExtraidos);

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
        div.className = "dynamic-card full-width";
        div.innerHTML = `
            <div class="dynamic-card-header">
                <strong>Unidade U${idx}</strong>
                <button type="button" class="btn-remover"><i class="fas fa-times"></i> Remover</button>
            </div>
            <div class="form-grid">
                <div class="form-group"><label>Placa</label><input type="text" data-campo="placa" class="form-control" value="${u.placa || ""}" /></div>
                <div class="form-group"><label>Ano Fab.</label><input type="text" data-campo="anoFab" class="form-control" value="${u.anoFab || u.ano || ""}" /></div>
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
        div.className = "dynamic-card full-width";
        div.innerHTML = `
            <div class="dynamic-card-header">
                <strong>Carreta / Reboque</strong>
                <button type="button" class="btn-remover"><i class="fas fa-times"></i> Remover</button>
            </div>
            <div class="form-grid">
                <div class="form-group"><label>Placa</label><input type="text" data-campo="placa" class="form-control" value="${c.placa || ""}" /></div>
                <div class="form-group"><label>Marca</label><input type="text" data-campo="marca" class="form-control" value="${c.marca || ""}" /></div>
                <div class="form-group"><label>Modelo</label><input type="text" data-campo="modelo" class="form-control" value="${c.modelo || ""}" /></div>
                <div class="form-group"><label>Ano</label><input type="text" data-campo="ano" class="form-control" value="${c.anoFab || c.ano || ""}" /></div>
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

            const payload = gerarPayloadFed(dados, pdfInfo, undefined);
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
    // AET ESTADUAL — IMPORTAÇÃO E REVISÃO
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

        const btnAddPlaca = document.getElementById("btnAddPlacaEst");
        if (btnAddPlaca) btnAddPlaca.addEventListener("click", () => adicionarPlacaAdicionalEst({}));

        const btnCancelar = document.getElementById("btnCancelarAetEst");
        if (btnCancelar) {
            btnCancelar.addEventListener("click", () => {
                document.getElementById('formCardAetEst').style.display = 'none';
                document.getElementById('tabelaContainerAetEst').style.display = 'block';
                pdfBlobAetEst = null;
            });
        }

        const formEst = document.getElementById("aetEstForm");
        if (formEst) {
            formEst.addEventListener("submit", async e => {
                e.preventDefault();
                await salvarAetEstadualRevisada();
            });
        }
    }

    async function processarAetEstadual(file) {
        const statusEl = document.getElementById("statusAetEst");
        document.getElementById("fileNameAetEst").textContent = file.name;
        statusEl.innerText = "Extraindo dados do PDF Estadual...";
        statusEl.style.color = "var(--ccol-blue-bright)";
        pdfBlobAetEst = file;

        try {
            const texto = await window.lerTextoPDF(file);
            console.log("=== TEXTO BRUTO ESTADUAL ===", texto);

            const dadosExtraidos = window.AetParser.extrairAetEstadual(texto);
            console.table(dadosExtraidos);

            if (!dadosExtraidos.numeroAET && !dadosExtraidos.placasCavalo) {
                throw new Error("Não foi possível identificar a AET Estadual.");
            }

            preencherFormularioAetEst(dadosExtraidos);
            
            document.getElementById('modalImportacao').style.display = 'none';
            document.getElementById('tabelaContainerAetEst').style.display = 'none';
            document.getElementById('formCardAetEst').style.display = 'block';
            
            statusEl.innerText = "";
            document.getElementById("fileNameAetEst").textContent = "";
        } catch (err) {
            console.error(err);
            statusEl.innerText = "Erro: " + err.message;
            statusEl.style.color = "#ef4444";
        }
    }

    function preencherFormularioAetEst(dados) {
        const form = document.getElementById("aetEstForm");
        
        const campos = [
            "numeroAET", "uf", "transportador", "endereco", "contato",
            "requerente", "origem", "transportando", "validadeInicio", "validadeFim",
            "restricaoHorario", "velocidadeMax", "placasCavalo", 
            "placaReb1", "placaReb2", "placaReb3",
            "marca", "modelo", "anoFab", "comprimento", "pesoTotal"
        ];
        campos.forEach(k => {
            if (form.elements[k]) form.elements[k].value = dados[k] || "";
        });

        if (form.elements["trechos"]) form.elements["trechos"].value = (dados.trechos || []).join("\n");
        if (form.elements["restricoes"]) form.elements["restricoes"].value = (dados.restricoes || []).join("\n");

        const cont = document.getElementById("placasAdicionaisContainer");
        cont.innerHTML = "";
        (dados.placasAdicionais || []).forEach(p => adicionarPlacaAdicionalEst({ placa: p }));
    }

    function adicionarPlacaAdicionalEst(p) {
        const cont = document.getElementById("placasAdicionaisContainer");
        const div = document.createElement("div");
        div.className = "dynamic-card";
        div.innerHTML = `
            <div class="dynamic-card-header" style="margin-bottom:5px;">
                <strong>Placa Extra</strong>
                <button type="button" class="btn-remover"><i class="fas fa-times"></i></button>
            </div>
            <input type="text" data-campo="placa" class="form-control" value="${p.placa || ""}" style="width: 200px;" />
        `;
        div.querySelector(".btn-remover").addEventListener("click", () => div.remove());
        cont.appendChild(div);
    }

    async function salvarAetEstadualRevisada() {
        const form = document.getElementById("aetEstForm");
        const btnSubmit = form.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

        try {
            const dados = {};
            Array.from(form.elements).forEach(el => {
                if (el.name) dados[el.name] = el.value.trim();
            });

            dados.trechos = dados.trechos ? dados.trechos.split('\n').map(x => x.trim()).filter(Boolean) : [];
            dados.restricoes = dados.restricoes ? dados.restricoes.split('\n').map(x => x.trim()).filter(Boolean) : [];

            dados.placasAdicionais = [];
            document.querySelectorAll("#placasAdicionaisContainer .dynamic-card").forEach(card => {
                const inp = card.querySelector("input");
                if (inp && inp.value.trim()) dados.placasAdicionais.push(inp.value.trim().toUpperCase());
            });

            let pdfInfo = { url: null, path: null };
            if (pdfBlobAetEst) {
                pdfInfo = await db.uploadPdfAet(pdfBlobAetEst, dados.numeroAET, 'ESTADUAL');
            }

            const payload = gerarPayloadEst(dados, pdfInfo, undefined);
            await db.upsertAet(payload);
            
            alert("AET Estadual salva com sucesso!");
            document.getElementById('formCardAetEst').style.display = 'none';
            document.getElementById('tabelaContainerAetEst').style.display = 'block';
            pdfBlobAetEst = null;
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
    // RENDERIZAR TABELAS
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

            const placasVistas = new Set();
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

            let reboquesHtml = "";
            if (a.placaReb1) reboquesHtml += `<span class="placa-tag reboque">${a.placaReb1}</span> `;
            if (a.placaReb2) reboquesHtml += `<span class="placa-tag reboque">${a.placaReb2}</span> `;
            if (a.placaReb3) reboquesHtml += `<span class="placa-tag reboque">${a.placaReb3}</span> `;
            
            const totalAdicional = (a.placasAdicionais ? a.placasAdicionais.length : 0);
            if (totalAdicional > 0) {
                reboquesHtml += `<div style="font-size:0.75rem; color:#9ca3af; margin-top:5px; font-weight:bold;">+ ${totalAdicional} placas extras</div>`;
            }
            if(!reboquesHtml.trim()) reboquesHtml = "-";

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
    // ABRIR DETALHES GERAIS NA TABELA
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
                        <div class="detalhe-item"><span class="detalhe-label">Validade</span><span class="detalhe-valor">${a.validadeInicio || "-"} a ${a.validadeFim || "-"}</span></div>
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

        const uComps = a.unidadesComplementares || [];
        uComps.forEach((u, idx) => {
            if (!u.placa) return;
            html += `<h4 class="form-section-title">Unidade U${idx + 2}</h4>
                 <div class="detalhes-grid">
                    <div class="detalhe-item"><span class="detalhe-label">Placa</span><span class="detalhe-valor"><span class="placa-tag reboque">${u.placa || "-"}</span></span></div>
                    <div class="detalhe-item"><span class="detalhe-label">Marca / Modelo</span><span class="detalhe-valor">${u.marca || "-"} ${u.modelo || ""}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">Ano Fab.</span><span class="detalhe-valor">${u.anoFab || "-"}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">Chassi</span><span class="detalhe-valor">${u.chassi || "-"}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">RENAVAM</span><span class="detalhe-valor">${u.renavam || "-"}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">RNTRC</span><span class="detalhe-valor">${u.rntrc || "-"}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">Carroceria (Tipo)</span><span class="detalhe-valor">${u.carroceria || "-"}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">Tara (t)</span><span class="detalhe-valor">${u.tara || "-"}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">Eixos</span><span class="detalhe-valor">${u.numEixos || "-"}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">Pneus/Eixo</span><span class="detalhe-valor">${u.pneusPorEixo || "-"}</span></div>
                 </div>`;
        });

        // Renderiza Carretas Complementares extras apenas com as placas
        const cComps = a.carretasComplementares || [];
        if (cComps.length > 0) {
            const placasValidas = cComps.filter(c => c.placa);
            if (placasValidas.length > 0) {
                html += `<h4 class="form-section-title" style="color:#fcd34d; margin-top: 25px;">Carretas / Reboques Complementares (${placasValidas.length})</h4>
                         <div style="background: rgba(255,255,255,0.02); padding: 15px; border-radius: 8px; border: 1px solid #374151; display: flex; flex-wrap: wrap; gap: 5px;">
                            ${placasValidas.map(c => `<span class="placa-tag reboque">${c.placa}</span>`).join("")}
                         </div>`;
            }
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
                        <div class="detalhe-item"><span class="detalhe-label">Validade</span><span class="detalhe-valor">${a.validadeInicio || "-"} a ${a.validadeFim || "-"}</span></div>
                        <div class="detalhe-item"><span class="detalhe-label">Restrição</span><span class="detalhe-valor">${a.restricaoHorario || "-"}</span></div>
                        <div class="detalhe-item"><span class="detalhe-label">Velocidade Máx.</span><span class="detalhe-valor">${a.velocidadeMax || "-"}</span></div>
                    </div>`;

        html += `<h4 class="form-section-title">Veículos</h4>
                 <div class="detalhes-grid">
                    <div class="detalhe-item"><span class="detalhe-label">Placa Cavalo</span><span class="detalhe-valor"><span class="placa-tag cavalo">${a.placasCavalo || "-"}</span></span></div>
                    <div class="detalhe-item"><span class="detalhe-label">Reboque 1</span><span class="detalhe-valor">${a.placaReb1 ? `<span class="placa-tag reboque">${a.placaReb1}</span>` : "-"}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">Reboque 2</span><span class="detalhe-valor">${a.placaReb2 ? `<span class="placa-tag reboque">${a.placaReb2}</span>` : "-"}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">Reboque 3</span><span class="detalhe-valor">${a.placaReb3 ? `<span class="placa-tag reboque">${a.placaReb3}</span>` : "-"}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">Marca/Modelo</span><span class="detalhe-valor">${a.marca || ""} ${a.modelo || ""}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">Ano</span><span class="detalhe-valor">${a.anoFab || "-"}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">Comprimento</span><span class="detalhe-valor">${a.comprimento || "-"}</span></div>
                    <div class="detalhe-item"><span class="detalhe-label">Peso Total</span><span class="detalhe-valor">${a.pesoTotal || "-"}</span></div>
                 </div>`;

        if (a.placasAdicionais && a.placasAdicionais.length > 0) {
            html += `<h4 class="form-section-title" style="color:#fcd34d;">Reboques Adicionais (${a.placasAdicionais.length})</h4>
                     <div style="background: rgba(255,255,255,0.02); padding: 15px; border-radius: 8px; border: 1px solid #374151; display: flex; flex-wrap: wrap; gap: 5px;">
                        ${a.placasAdicionais.map(p => `<span class="placa-tag reboque">${p}</span>`).join("")}
                     </div>`;
        }

        if (a.trechos && a.trechos.length > 0) {
            html += `<h4 class="form-section-title" style="color:#9ca3af;">Trechos Autorizados</h4>
                     <ul style="color:#e5e7eb; font-size:0.9rem; padding-left: 20px;">
                        ${a.trechos.map(t => `<li style="margin-bottom:5px;">${t}</li>`).join("")}
                     </ul>`;
        }

        if (a.restricoes && a.restricoes.length > 0) {
            html += `<h4 class="form-section-title" style="color:#ef4444;">Restrições Específicas</h4>
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
                    const dados = window.AetParser.extrairAetFederal(texto);
                    if (!dados.numeroAET) dados.numeroAET = numeroAetFedEmAtualizacao;
                    
                    const upInfo = await db.uploadPdfAet(file, numeroAetFedEmAtualizacao, 'FEDERAL');
                    const payload = gerarPayloadFed(dados, upInfo, filialAetFedEmAtualizacao);
                    
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
                    const dados = window.AetParser.extrairAetEstadual(texto);
                    if (!dados.numeroAET) dados.numeroAET = numeroAetEstEmAtualizacao;
                    
                    const upInfo = await db.uploadPdfAet(file, numeroAetEstEmAtualizacao, 'ESTADUAL');
                    const payload = gerarPayloadEst(dados, upInfo, filialAetEstEmAtualizacao);

                    await db.upsertAet(payload);
                    alert("AET Estadual atualizada com sucesso!");
                    await carregarListas();
                } catch (err) { alert("Erro: " + err.message); }
            });
        }
    }

    // =====================================================
    // CARREGAR LISTAS E REFAZER O MAP PARA O JAVASCRIPT
    // =====================================================
    async function carregarListas() {
        try {
            const todasAsAets = await db.getAets();
            
            listaAetFed = todasAsAets.filter(a => a.tipo === 'FEDERAL').map(a => ({
                ...a,
                numeroAET: a.numero_aet,
                validadeInicio: a.validade_inicio,
                validadeFim: a.validade_fim,
                proprietario: a.proprietario,
                cnpjCpf: a.cnpj_cpf,
                endereco: a.endereco,
                telefone: a.telefone,
                pbtcInformado: a.pbtc_informado,
                comprimento: a.comprimento,
                conjuntoTipo: a.conjunto_tipo,
                u1_placa: a.placa_cavalo,
                u1_anoFab: a.ano_fab,
                u1_chassi: a.chassi,
                u1_marca: a.marca,
                u1_modelo: a.modelo,
                u1_carroceria: a.carroceria,
                u1_tara: a.tara,
                u1_tracao: a.tracao,
                u1_potencia: a.potencia,
                u1_cmt: a.cmt,
                u1_direcao: a.direcao,
                u1_renavam: a.renavam,
                u1_rntrc: a.rntrc,
                u1_bidirecional: a.bidirecional,
                unidadesComplementares: safeParseArray(a.unidades_complementares),
                carretasComplementares: safeParseArray(a.carretas_complementares)
            }));

            listaAetEst = todasAsAets.filter(a => a.tipo === 'ESTADUAL').map(a => ({
                ...a,
                numeroAET: a.numero_aet,
                validadeInicio: a.validade_inicio,
                validadeFim: a.validade_fim,
                uf: a.uf,
                transportador: a.transportador,
                endereco: a.endereco,
                contato: a.telefone,
                requerente: a.requerente,
                origem: a.origem,
                transportando: a.transportando,
                restricaoHorario: a.restricao_horario,
                velocidadeMax: a.velocidade_max,
                placasCavalo: a.placa_cavalo,
                placaReb1: a.placa_reb1,
                placaReb2: a.placa_reb2,
                placaReb3: a.placa_reb3,
                marca: a.marca,
                modelo: a.modelo,
                anoFab: a.ano_fab,
                comprimento: a.comprimento,
                pesoTotal: a.peso_total,
                largura: a.largura,
                peso1Unid: a.peso_1_unid,
                altura: a.altura,
                peso2Unid: a.peso_2_unid,
                larguraTotal: a.largura_total,
                pesoCarreta: a.peso_carreta,
                pesoCarga: a.peso_carga,
                pesoAcessorios: a.peso_acessorios,
                excessoLimite: a.excesso_limite,
                placasAdicionais: safeParseArray(a.placas_adicionais),
                trechos: safeParseArray(a.trechos),
                restricoes: safeParseArray(a.restricoes)
            }));
            
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
        
        // Garante que os modais fechem ao clicar fora
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', function(e) {
                if (e.target === this) this.style.display = 'none';
            });
        });
    }

    inicializar();
};