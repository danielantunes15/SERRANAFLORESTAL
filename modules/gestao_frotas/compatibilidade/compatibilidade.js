/* =========================================================
   COMPATIBILIDADE — Simulador Cavalo ⇄ Carretas (Refatorado)
   - Templates literals seguros
   - UI baseada em Dashboard Moderno
   ========================================================= */

window.initFrotaCompatibilidade = async function() {
    let dbAetsFed = [];
    let dbAetsEst = [];
    let dbDocumentos = [];

    let compatCavaloSelecionado = null;
    let compatSimulacao = { principal: ["", "", ""] };

    // =========================================================
    // 1. CARREGAMENTO DO BANCO DE DADOS
    // =========================================================
    async function carregarDadosBanco() {
        const sel = document.getElementById("compatCavaloSelect");
        if (sel) sel.innerHTML = '<option value="">— Baixando dados do banco, aguarde... —</option>';
        
        try {
            const [aets, docs] = await Promise.all([
                typeof db.getAets === "function" ? db.getAets() : Promise.resolve([]),
                typeof db.getFrotasDocumentos === "function" ? db.getFrotasDocumentos() : Promise.resolve([])
            ]);

            dbAetsFed = aets.filter(a => a.tipo === 'FEDERAL');
            dbAetsEst = aets.filter(a => a.tipo === 'ESTADUAL');
            dbDocumentos = docs || [];

        } catch (e) {
            console.error("Erro ao carregar dados de compatibilidade:", e);
            alert("Não foi possível carregar os dados para a simulação.");
        }
    }

    function safeParseArray(val) {
        if (!val) return [];
        if (typeof val === 'string') {
            try { return JSON.parse(val); } catch(e) { return []; }
        }
        if (Array.isArray(val)) return val;
        return [];
    }

    // =========================================================
    // 2. CONSTRUÇÃO DO ESTOQUE
    // =========================================================
    function construirEstoqueCavalos() {
        const cavalos = [];

        dbAetsFed.forEach(a => {
            if (a.placa_cavalo) {
                cavalos.push({
                    tipo: "AET Federal",
                    origem: `AET Fed. ${a.numero_aet}`,
                    placa: a.placa_cavalo.toUpperCase(),
                    chassi: a.chassi || "",
                    marca: a.marca || "",
                    modelo: a.modelo || "",
                    anoFab: a.ano_fab || "",
                    cmt: parseFloat((String(a.cmt) || "0").replace(",", ".")) || 0,
                    potencia: a.potencia || "",
                    tracao: a.tracao || "",
                    rntrc: a.rntrc || "",
                    proprietario: a.proprietario || "",
                    validadeInicio: a.validade_inicio || "",
                    validadeFim: a.validade_fim || "",
                });
            }
        });

        dbAetsEst.forEach(a => {
            if (a.placa_cavalo) {
                const placas = a.placa_cavalo.split(/\s*[\/,]\s*/).filter(Boolean);
                placas.forEach(p => {
                    cavalos.push({
                        tipo: "AET Estadual",
                        origem: `AET Est. ${a.numero_aet}`,
                        placa: p.trim().toUpperCase(),
                        chassi: "",
                        marca: a.marca || "",
                        modelo: a.modelo || "",
                        anoFab: a.ano_fab || "",
                        cmt: parseFloat((String(a.peso_total) || "0").replace(",", ".")) || 0,
                        potencia: a.potencia || "",
                        tracao: "",
                        rntrc: "",
                        proprietario: a.transportador || "",
                        validadeInicio: a.validade_inicio || "",
                        validadeFim: a.validade_fim || "",
                    });
                });
            }
        });

        dbDocumentos.forEach(v => {
            const tipo = (v.tipo_veiculo || "").toUpperCase();
            const esp = (v.especie_tipo || "").toUpperCase();
            const ehCavalo = tipo === "CAVALO" || /TRATOR|CAMINHAO TRATOR|TRACAO/.test(esp);
            if (!ehCavalo) return;

            cavalos.push({
                tipo: "CRLV",
                origem: `CRLV ${v.placa}${v.apelido ? " (" + v.apelido + ")" : ""}`,
                placa: (v.placa || "").toUpperCase(),
                chassi: v.chassi || "",
                marca: (v.marca_modelo || "").split("/")[0] || "",
                modelo: (v.marca_modelo || "").split("/")[1] || "",
                anoFab: v.ano_fabricacao || "",
                cmt: parseFloat((String(v.peso_bruto) || "0").replace(",", ".")) || 0,
                potencia: (v.potencia || "").replace(/[^\d]/g, ""),
                tracao: "",
                rntrc: "",
                proprietario: v.proprietario_nome || "",
                validadeInicio: "",
                validadeFim: "",
            });
        });

        const mapa = new Map();
        const prioridade = { "AET Federal": 1, "AET Estadual": 2, "CRLV": 3 };
        cavalos.forEach(c => {
            const atual = mapa.get(c.placa);
            if (!atual || prioridade[c.tipo] < prioridade[atual.tipo]) {
                mapa.set(c.placa, c);
            }
        });

        return Array.from(mapa.values()).sort((a, b) => a.placa.localeCompare(b.placa));
    }

    function construirEstoqueCarretas() {
        const carretas = [];
        const placasVistas = new Set();

        const pushCarreta = (c) => {
            const placa = (c.placa || "").toUpperCase();
            if (!placa || placasVistas.has(placa)) return;
            placasVistas.add(placa);
            carretas.push({ ...c, placa });
        };

        dbAetsFed.forEach(a => {
            const uComps = safeParseArray(a.unidades_complementares);
            uComps.forEach(u => {
                pushCarreta({
                    tipo: "Unidade Principal",
                    origem: `AET Fed. ${a.numero_aet}`,
                    placa: u.placa,
                    marca: u.marca || "",
                    modelo: u.modelo || "",
                    ano: u.anoFab || u.ano || "",
                    carroceria: (u.carroceria || "").toUpperCase(),
                    tara: parseFloat((String(u.tara) || "0").replace(",", ".")) || 0,
                    numEixos: u.numEixos || "",
                    rntrc: u.rntrc || "",
                    cavaloOrigem: a.placa_cavalo || "",
                    proprietario: a.proprietario || "",
                    validadeFim: a.validade_fim || "",
                    numeroGO: "",
                });
            });

            const cComps = safeParseArray(a.carretas_complementares);
            cComps.forEach(c => {
                pushCarreta({
                    tipo: "Reboque Complementar",
                    origem: `AET Fed. ${a.numero_aet}`,
                    placa: c.placa,
                    marca: c.marca || "",
                    modelo: c.modelo || "",
                    ano: c.anoFab || c.ano || "",
                    carroceria: (c.carroceria || "").toUpperCase(),
                    tara: parseFloat((String(c.tara) || "0").replace(",", ".")) || 0,
                    numEixos: c.numEixos || "",
                    rntrc: c.rntrc || "",
                    cavaloOrigem: a.placa_cavalo || "",
                    proprietario: a.proprietario || "",
                    validadeFim: a.validade_fim || "",
                    numeroGO: "",
                });
            });
        });

        dbAetsEst.forEach(a => {
            const placasAdd = safeParseArray(a.placas_adicionais);
            const placasReb = [a.placa_reb1, a.placa_reb2, a.placa_reb3].filter(Boolean);
            const todasPlacas = [...placasAdd, ...placasReb];

            todasPlacas.forEach(p => {
                pushCarreta({
                    tipo: "Reboque Complementar",
                    origem: `AET Est. ${a.numero_aet}`,
                    placa: p,
                    marca: "",
                    modelo: "",
                    ano: "",
                    carroceria: "",
                    tara: 0,
                    numEixos: "",
                    rntrc: "",
                    cavaloOrigem: a.placa_cavalo || "",
                    proprietario: a.transportador || "",
                    validadeFim: a.validade_fim || "",
                    numeroGO: "",
                });
            });
        });

        dbDocumentos.forEach(v => {
            const tipo = (v.tipo_veiculo || "").toUpperCase();
            const esp = (v.especie_tipo || "").toUpperCase();

            const ehCavalo = tipo === "CAVALO" || /TRATOR|CAMINHAO TRATOR|TRACAO/.test(esp);
            if (ehCavalo) return;

            const tiposCarreta = ["CARRETA", "PRANCHA", "GRUA", "BITREM", "TRITREM", "RODOTREM", "REBOQUE", "SEMIRREBOQUE"];
            const tipoBate = tiposCarreta.includes(tipo);
            const espBate = /REBOQUE|SEMIRREBOQUE|CARRETA|PRANCHA/.test(esp);

            if (!tipoBate && !espBate) return;

            pushCarreta({
                tipo: tipo || "CRLV",
                origem: `CRLV ${v.placa}`,
                placa: v.placa,
                marca: (v.marca_modelo || "").split("/")[0] || "",
                modelo: (v.marca_modelo || "").split("/")[1] || "",
                ano: v.ano_fabricacao || "",
                carroceria: (v.especie_tipo || "").toUpperCase(),
                tara: parseFloat((String(v.peso_bruto) || "0").replace(",", ".")) || 0,
                numEixos: "",
                rntrc: "",
                cavaloOrigem: "",
                proprietario: v.proprietario_nome || "",
                validadeFim: "",
                numeroGO: v.numero_go || "",
            });
        });

        return carretas.sort((a, b) => a.placa.localeCompare(b.placa));
    }

    // =========================================================
    // 3. FLUXO DE RENDERIZAÇÃO
    // =========================================================
    function popularSelectCavalos() {
        const sel = document.getElementById("compatCavaloSelect");
        if (!sel) return;

        const cavalos = construirEstoqueCavalos();
        const valorAtual = sel.value;

        sel.innerHTML = '<option value="">— Selecione o Cavalo (U1) —</option>';
        if (cavalos.length === 0) {
            sel.innerHTML += '<option value="" disabled>Nenhum cavalo encontrado no banco de dados.</option>';
            return;
        }

        cavalos.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.placa;
            opt.textContent = `${c.placa} — ${c.marca} ${c.modelo} (${c.tipo})`;
            sel.appendChild(opt);
        });

        if (valorAtual && cavalos.find(c => c.placa === valorAtual)) {
            sel.value = valorAtual;
            compatCavaloSelecionado = valorAtual;
        }
    }

    function renderizarResumo() {
        const el = document.getElementById("compatResumo");
        if (!el) return;

        const cavalos = construirEstoqueCavalos();
        const c = cavalos.find(x => x.placa === compatCavaloSelecionado);
        if (!c) return;

        const formatCMT = c.cmt > 0 ? c.cmt.toFixed(3).replace(".", ",") + " t" : "<span style='color:var(--warn);'>Não Informado</span>";
        const valAET = c.validadeInicio ? `${c.validadeInicio} a ${c.validadeFim}` : "-";

        el.innerHTML = `
            <table class="sim-details-table">
                <tbody>
                    <tr><td>Placa</td><td><span class="sim-tag" style="color:var(--ccol-blue-bright); border-color:var(--ccol-blue-bright);">${c.placa}</span></td></tr>
                    <tr><td>Fonte de Dados</td><td>${c.origem}</td></tr>
                    <tr><td>Marca / Modelo</td><td>${c.marca} ${c.modelo}</td></tr>
                    <tr><td>Potência / Tração</td><td>${c.potencia || "-"} CV / ${c.tracao || "-"}</td></tr>
                    <tr><td>Capacidade (CMT)</td><td>${formatCMT}</td></tr>
                    <tr><td>RNTRC</td><td>${c.rntrc || "-"}</td></tr>
                    <tr><td>Proprietário</td><td>${c.proprietario || "-"}</td></tr>
                    <tr><td>Validade AET</td><td>${valAET}</td></tr>
                </tbody>
            </table>
        `;
    }

    function renderizarVinculosAtuais() {
        const el = document.getElementById("compatAtuais");
        if (!el) return;

        const carretas = construirEstoqueCarretas();
        const atuais = carretas.filter(c =>
            (c.cavaloOrigem || "").toUpperCase().split(/\s*[\/,]\s*/).includes(compatCavaloSelecionado.toUpperCase())
        );

        if (atuais.length === 0) {
            el.innerHTML = '<p style="color: #94a3b8; font-style: italic;">Nenhum reboque vinculado neste cavalo nas AETs cadastradas.</p>';
            return;
        }

        let html = "";
        atuais.forEach(c => {
            let goLabel = c.numeroGO ? ` <span class="sim-tag go-tag">GO ${c.numeroGO}</span>` : "";
            html += `<span class="sim-tag" title="${c.marca} ${c.modelo} | Tara: ${c.tara}t">${c.placa}${goLabel}</span>`;
        });
        el.innerHTML = html;
    }

    function renderizarSlots() {
        const el = document.getElementById("compatSimulacao");
        if (!el) return;

        const todasCarretas = construirEstoqueCarretas();
        const vinculadas = new Set(
            todasCarretas
                .filter(c => (c.cavaloOrigem || "").toUpperCase().split(/\s*[\/,]\s*/).includes(compatCavaloSelecionado.toUpperCase()))
                .map(c => c.placa)
        );

        const opcoesOrdenadas = [...todasCarretas].sort((a, b) => {
            const vA = vinculadas.has(a.placa) ? 0 : 1;
            const vB = vinculadas.has(b.placa) ? 0 : 1;
            if (vA !== vB) return vA - vB;
            return a.placa.localeCompare(b.placa);
        });

        let htmlSlots = "";
        for (let i = 0; i < 3; i++) {
            const valSelect = compatSimulacao.principal[i] || "";
            
            let opcoesHtml = `<option value="">— Selecione uma Carreta —</option>`;
            opcoesOrdenadas.forEach(c => {
                let sufixo = vinculadas.has(c.placa) ? " ★" : "";
                let goInfo = c.numeroGO ? ` [GO ${c.numeroGO}]` : "";
                let selected = c.placa === valSelect ? "selected" : "";
                let label = `${c.placa}${sufixo}${goInfo} - ${c.carroceria || c.tipo} (${c.tara || "?"}t)`;
                opcoesHtml += `<option value="${c.placa}" ${selected}>${label}</option>`;
            });

            htmlSlots += `
                <div class="sim-slot" id="slot-card-${i}">
                    <div class="slot-header">
                        <span><i class="fas fa-trailer"></i> Unidade ${i + 2}</span>
                    </div>
                    <select class="sim-select" data-slot-id="${i}">
                        ${opcoesHtml}
                    </select>
                    <div id="slot-info-${i}"></div>
                </div>
            `;
        }
        
        el.innerHTML = htmlSlots;

        el.querySelectorAll("select[data-slot-id]").forEach(sel => {
            sel.addEventListener("change", () => {
                const idx = parseInt(sel.getAttribute("data-slot-id"), 10);
                compatSimulacao.principal[idx] = sel.value;
                revalidarTudo();
            });
        });

        revalidarTudo();
    }

    // =========================================================
    // 4. LÓGICA DE VALIDAÇÃO
    // =========================================================
    function validarUmSlot(placa, todasEscolhidas) {
        const cavalos = construirEstoqueCavalos();
        const carretas = construirEstoqueCarretas();
        const cavalo = cavalos.find(x => x.placa === compatCavaloSelecionado);
        const carreta = carretas.find(x => x.placa === placa);

        const motivos = [];
        let status = "ok";

        const marcar = (s) => { if (s === "error") status = "error"; else if (s === "warn" && status !== "error") status = "warn"; };

        if (todasEscolhidas.filter(p => p === placa).length > 1) {
            motivos.push("Placa duplicada no simulador.");
            marcar("error");
        }

        if (carreta.validadeFim) {
            const [d, m, a] = carreta.validadeFim.split("/").map(Number);
            const venc = new Date(a, m - 1, d);
            const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
            if (venc < hoje) {
                motivos.push(`AET vencida em ${carreta.validadeFim}.`);
                marcar("error");
            }
        }

        const taraCavalo = cavalo.cmt || 0;
        if (taraCavalo > 0 && carreta.tara > 0) {
            const escolhidasObjs = todasEscolhidas.map(p => carretas.find(c => c.placa === p)).filter(Boolean);
            const taraTotal = escolhidasObjs.reduce((s, c) => s + (c.tara || 0), 0);

            if (taraTotal > taraCavalo) {
                motivos.push(`Tara Total (${taraTotal.toFixed(2)}t) excede CMT (${taraCavalo.toFixed(2)}t).`);
                marcar("error");
            } else if (taraTotal > taraCavalo * 0.9) {
                motivos.push(`Atenção: Tara (${taraTotal.toFixed(2)}t) próxima ao CMT (${taraCavalo.toFixed(2)}t).`);
                marcar("warn");
            }
        } else {
            motivos.push("Falta informação de Tara/CMT para calcular peso.");
            marcar("warn");
        }

        if (carreta.rntrc && cavalo.rntrc && carreta.rntrc !== cavalo.rntrc) {
            motivos.push("RNTRC divergente.");
            marcar("warn");
        }

        let msg = status === "ok" ? "Compatível" : status === "warn" ? "Atenção" : "Incompatível";
        return { status, motivos, msg };
    }

    function revalidarTudo() {
        const escolhidas = compatSimulacao.principal.filter(Boolean);
        const carretas = construirEstoqueCarretas();

        for (let i = 0; i < 3; i++) {
            const placa = compatSimulacao.principal[i] || "";
            const cardEl = document.getElementById(`slot-card-${i}`);
            const infoEl = document.getElementById(`slot-info-${i}`);
            
            if (!placa) {
                cardEl.className = "sim-slot";
                infoEl.innerHTML = "";
                continue;
            }

            const c = carretas.find(x => x.placa === placa);
            const v = validarUmSlot(placa, escolhidas);

            cardEl.className = `sim-slot filled ${v.status}`;

            let icon = v.status === "ok" ? '<i class="fas fa-check-circle"></i>' : v.status === "warn" ? '<i class="fas fa-exclamation-triangle"></i>' : '<i class="fas fa-times-circle"></i>';
            let goHtml = c.numeroGO ? `<span class="sim-tag go-tag">GO ${c.numeroGO}</span>` : "";

            let html = `
                <div class="slot-info-box">
                    <strong>${c.marca} ${c.modelo}</strong> (${c.ano || "?"})<br>
                    Carroceria: ${c.carroceria || "-"}<br>
                    Tara: ${c.tara || "?"} t | Eixos: ${c.numEixos || "?"}<br>
                    RNTRC: ${c.rntrc || "-"}<br>
                    ${goHtml}
                </div>
                <div class="slot-status-msg" style="color: var(--${v.status === 'error' ? 'danger' : v.status === 'warn' ? 'warn' : 'ccol-green-bright'});">
                    ${icon} ${v.msg}
                </div>
            `;

            if (v.motivos.length > 0) {
                html += `<ul style="margin:5px 0 0 0; padding-left:15px; color:#cbd5e1; font-size:0.85rem;">`;
                v.motivos.forEach(m => html += `<li>${m}</li>`);
                html += `</ul>`;
            }

            infoEl.innerHTML = html;
        }

        // Limpar relatório ao mexer nos selects
        document.getElementById("compatResultadoContainer").style.display = "none";
    }

    function gerarRelatorioFinal() {
        const container = document.getElementById("compatResultadoContainer");
        const escolhidas = compatSimulacao.principal.filter(Boolean);

        if (escolhidas.length === 0) {
            container.style.display = "block";
            container.innerHTML = `
                <div class="sim-report warn">
                    <h3><i class="fas fa-exclamation-triangle"></i> Nenhuma carreta selecionada</h3>
                    <p style="color:#cbd5e1; margin:0;">Adicione reboques nos slots acima para validar o engate.</p>
                </div>
            `;
            return;
        }

        let temErro = false;
        let temAviso = false;
        let listaErros = [];
        let listaAvisos = [];
        let listaInfos = [];

        escolhidas.forEach(placa => {
            const r = validarUmSlot(placa, escolhidas);
            if (r.status === "error") { temErro = true; r.motivos.forEach(m => listaErros.push(`[${placa}] ${m}`)); }
            if (r.status === "warn") { temAviso = true; r.motivos.forEach(m => listaAvisos.push(`[${placa}] ${m}`)); }
        });

        let statusClass = "ok";
        let titleHtml = '<i class="fas fa-check-double"></i> Relatório: Combinação Válida';
        if (temErro) { statusClass = "error"; titleHtml = '<i class="fas fa-times-circle"></i> Relatório: Engate Incompatível'; }
        else if (temAviso) { statusClass = "warn"; titleHtml = '<i class="fas fa-exclamation-triangle"></i> Relatório: Válido com Ressalvas'; }

        let html = `<div class="sim-report ${statusClass}"><h3>${titleHtml}</h3>`;
        
        if (listaInfos.length > 0) html += `<h4 style="color:#10b981; margin:15px 0 5px 0;">Operacional</h4><ul>${listaInfos.map(i => `<li>${i}</li>`).join("")}</ul>`;
        if (listaAvisos.length > 0) html += `<h4 style="color:#f59e0b; margin:15px 0 5px 0;">Avisos</h4><ul>${listaAvisos.map(a => `<li>${a}</li>`).join("")}</ul>`;
        if (listaErros.length > 0) html += `<h4 style="color:#ef4444; margin:15px 0 5px 0;">Bloqueios</h4><ul>${listaErros.map(e => `<li>${e}</li>`).join("")}</ul>`;

        html += `</div>`;
        container.style.display = "block";
        container.innerHTML = html;
        container.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    // =========================================================
    // 5. INICIALIZAÇÃO DE EVENTOS
    // =========================================================
    function configurarEventos() {
        const sel = document.getElementById("compatCavaloSelect");
        if (sel) {
            sel.addEventListener("change", () => {
                compatCavaloSelecionado = sel.value || null;
                compatSimulacao.principal = ["", "", ""];
                
                if (compatCavaloSelecionado) {
                    document.getElementById("simWorkspace").style.display = "grid";
                    renderizarResumo();
                    renderizarVinculosAtuais();
                    renderizarSlots();
                } else {
                    document.getElementById("simWorkspace").style.display = "none";
                }
                document.getElementById("compatResultadoContainer").style.display = "none";
            });
        }

        const btnRecarregar = document.getElementById("compatRecarregarEstoque");
        if (btnRecarregar) {
            btnRecarregar.addEventListener("click", async () => {
                const icon = btnRecarregar.querySelector("i");
                if (icon) icon.classList.add("fa-spin");
                await carregarDadosBanco();
                popularSelectCavalos();
                if (compatCavaloSelecionado) {
                    renderizarResumo();
                    renderizarVinculosAtuais();
                    renderizarSlots();
                }
                if (icon) icon.classList.remove("fa-spin");
            });
        }

        const btnLimpar = document.getElementById("compatLimparBtn");
        if (btnLimpar) {
            btnLimpar.addEventListener("click", () => {
                compatSimulacao.principal = ["", "", ""];
                renderizarSlots();
            });
        }

        const btnValidar = document.getElementById("compatValidarBtn");
        if (btnValidar) btnValidar.addEventListener("click", gerarRelatorioFinal);
    }

    // Fluxo inicial
    await carregarDadosBanco();
    configurarEventos();
    popularSelectCavalos();
};