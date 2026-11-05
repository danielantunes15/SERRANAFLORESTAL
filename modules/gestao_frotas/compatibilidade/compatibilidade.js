/* =========================================================
   COMPATIBILIDADE E CADASTRO DE ENGATES (GO)
   - Exclusivo para Cadastros e Documentos (frotas_documentos)
   - Tabela Frotas Engates (frotas_engates)
   ========================================================= */

window.initFrotaCompatibilidade = async function() {
    let dbDocumentos = [];
    let dbEngatesSalvos = []; 
    let compatCavaloSelecionado = null;
    let compatSimulacao = { principal: ["", "", ""] };

    const safeUpper = (str) => (str || "").toString().toUpperCase().trim();

    // =========================================================
    // CONTROLE DE ABAS E LAYOUT
    // =========================================================
    window.alternarAbaCompatibilidade = function(aba) {
        document.getElementById('btnAbaListaEngates').classList.remove('active');
        document.getElementById('btnAbaSimulador').classList.remove('active');
        document.getElementById('abaListaEngates').classList.add('hidden-field');
        document.getElementById('abaSimulador').classList.add('hidden-field');

        if(aba === 'lista') {
            document.getElementById('btnAbaListaEngates').classList.add('active');
            document.getElementById('abaListaEngates').classList.remove('hidden-field');
            carregarCategoriasSalvas(); 
        } else {
            document.getElementById('btnAbaSimulador').classList.add('active');
            document.getElementById('abaSimulador').classList.remove('hidden-field');
            window.ajustarCamposSimulador(document.getElementById('engateCategoria').value);
        }
    };

    window.ajustarCamposSimulador = function(categoria) {
        const groupCav = document.getElementById('groupCavalo');
        const groupGO = document.getElementById('groupGO');
        const painelSimulador = document.getElementById('painelSimuladorCarretas');
        
        compatSimulacao.principal = ["", "", ""];
        
        const selCav = document.getElementById("compatCavaloSelect");
        const selGo = document.getElementById("inputNumeroGoEngate");
        if(selCav) selCav.value = "";
        if(selGo) selGo.value = "";
        
        document.getElementById("simWorkspace").style.display = "none";
        document.getElementById("compatResultadoContainer").style.display = "none";
        document.getElementById("painelSalvarEngate").style.display = "none";

        if (categoria === 'CAVALO') {
            groupCav.classList.remove('hidden-field');
            groupGO.classList.add('hidden-field');
            painelSimulador.style.display = 'none';
        } else if (categoria === 'CARRETA') {
            groupCav.classList.add('hidden-field');
            groupGO.classList.remove('hidden-field');
            painelSimulador.style.display = 'flex';
            renderizarSlots();
        } else { // TRITREM
            groupCav.classList.remove('hidden-field');
            groupGO.classList.remove('hidden-field');
            painelSimulador.style.display = 'flex';
            renderizarSlots();
        }
    };

    // =========================================================
    // ENGATE RÁPIDO (Acionado pelos botões da tabela Livres)
    // =========================================================
    window.irParaEngateRapido = function(tipo, valor) {
        window.alternarAbaCompatibilidade('simulador');
        document.getElementById('engateCategoria').value = 'TRITREM';
        window.ajustarCamposSimulador('TRITREM');
        
        if (tipo === 'CAVALO') {
            const selCav = document.getElementById('compatCavaloSelect');
            selCav.value = valor;
            selCav.dispatchEvent(new Event('change'));
        } else if (tipo === 'GO') {
            const selGo = document.getElementById('inputNumeroGoEngate');
            selGo.value = valor;
            selGo.dispatchEvent(new Event('change'));
        }
    };

    // =========================================================
    // CARREGAMENTO DO BANCO DE DADOS
    // =========================================================
    async function carregarDadosBanco() {
        try {
            const queryDocs = typeof db.getFrotasDocumentos === "function" ? db.getFrotasDocumentos() : Promise.resolve([]);
            dbDocumentos = await queryDocs || [];
            
            let queryEngates = window.supabaseClient.from('frotas_engates').select('*');
            if (typeof window.aplicarFiltroFilial === 'function') queryEngates = window.aplicarFiltroFilial(queryEngates);
            const resEngates = await queryEngates;
            dbEngatesSalvos = resEngates.data || [];
        } catch (e) {
            console.error("Erro ao carregar dados do banco:", e);
        }
    }

    // =========================================================
    // ABA 1: RENDERIZAR TABELAS (ENGATADOS E LIVRES VIRTUAIS)
    // =========================================================
    async function carregarCategoriasSalvas() {
        const container = document.getElementById('containerCategoriasCompat');
        try {
            await carregarDadosBanco(); 
            
            const categoriasAgrupadas = {
                'TRITREM': [], 'BITREM': [], 'RODOTREM': [], 'PRANCHA': [],
                'CAVALO': [], 'CARRETA': [], 'Sem Categoria': []
            };

            // 1. Processa Engates Reais
            dbEngatesSalvos.forEach(f => {
                const cat = f.categoria ? f.categoria.toUpperCase() : 'Sem Categoria';
                if (categoriasAgrupadas[cat]) {
                    categoriasAgrupadas[cat].push({...f, is_virtual: false});
                }
            });

            // 2. Cria Cavalos "Livres"
            const cavalosDocumentos = dbDocumentos.filter(d => {
                const tipo = safeUpper(d.tipo_veiculo);
                const esp = safeUpper(d.especie_tipo);
                return tipo === "CAVALO MECÂNICO" || tipo === "CAVALO" || /TRATOR|CAMINHAO TRATOR|TRACAO/.test(esp);
            });

            cavalosDocumentos.forEach(c => {
                const jaEngatado = dbEngatesSalvos.find(e => safeUpper(e.placa_cavalo) === safeUpper(c.placa));
                if (!jaEngatado) {
                    categoriasAgrupadas['CAVALO'].push({
                        id: 'virtual_cavalo_' + c.placa,
                        is_virtual: true,
                        categoria: 'CAVALO',
                        placa_cavalo: c.placa,
                        numero_frota: c.apelido || '-',
                        status: 'Livre' 
                    });
                }
            });

            // 3. Cria Carretas (GOs) "Livres"
            const carretasDocumentos = dbDocumentos.filter(d => {
                const tipo = safeUpper(d.tipo_veiculo);
                const esp = safeUpper(d.especie_tipo);
                const isCavalo = tipo === "CAVALO MECÂNICO" || tipo === "CAVALO" || /TRATOR|CAMINHAO TRATOR|TRACAO/.test(esp);
                return !isCavalo && d.numero_go && safeUpper(d.numero_go) !== '';
            });

            const goMap = new Map();
            carretasDocumentos.forEach(c => {
                const goStr = safeUpper(c.numero_go);
                if (!goMap.has(goStr)) goMap.set(goStr, { go: goStr, placas: [] });
                goMap.get(goStr).placas.push(c.placa);
            });

            goMap.forEach((obj, goStr) => {
                const jaEngatado = dbEngatesSalvos.find(e => safeUpper(e.numero_go) === goStr);
                if (!jaEngatado) {
                    const placasUnicas = [...new Set(obj.placas)];
                    categoriasAgrupadas['CARRETA'].push({
                        id: 'virtual_go_' + goStr,
                        is_virtual: true,
                        categoria: 'CARRETA',
                        numero_go: goStr,
                        placa_carreta1: placasUnicas[0] || null,
                        placa_carreta2: placasUnicas[1] || null,
                        placa_carreta3: placasUnicas[2] || null,
                        status: 'Livre'
                    });
                }
            });

            const ordemExibicao = ['TRITREM', 'BITREM', 'RODOTREM', 'PRANCHA', 'CAVALO', 'CARRETA', 'Sem Categoria'];
            container.innerHTML = '';

            ordemExibicao.forEach(cat => {
                const listaOriginal = categoriasAgrupadas[cat];
                if (listaOriginal.length === 0) return;

                listaOriginal.sort((a, b) => {
                    const numA = (a.numero_go || a.numero_frota || a.placa_cavalo || '').toString();
                    const numB = (b.numero_go || b.numero_frota || b.placa_cavalo || '').toString();
                    return numA.localeCompare(numB, undefined, { numeric: true, sensitivity: 'base' });
                });

                let theadHTML = '';
                let tituloComplemento = '';

                if (cat === 'CARRETA') {
                    tituloComplemento = ' <span style="font-size:0.8rem; color:#10b981; font-weight:normal;">(Agrupadas por GO)</span>';
                    theadHTML = `<tr><th>Status</th><th>Nº GO (ID)</th><th>Carreta 1</th><th>Carreta 2</th><th>Carreta 3</th><th style="text-align: right;">Ações</th></tr>`;
                } else if (cat === 'CAVALO') {
                    tituloComplemento = ' <span style="font-size:0.8rem; color:#10b981; font-weight:normal;">(Cavalos Disponíveis)</span>';
                    theadHTML = `<tr><th>Status</th><th>Nº Frota</th><th>Placa (Cavalo)</th><th style="text-align: right;">Ações</th></tr>`;
                } else {
                    tituloComplemento = ' <span style="font-size:0.8rem; color:#facc15; font-weight:normal;">(Conjuntos Formados)</span>';
                    theadHTML = `<tr><th>Status</th><th>Nº Frota</th><th>Placa (Cavalo)</th><th>Nº GO</th><th>Carreta 1</th><th>Carreta 2</th><th>Carreta 3</th><th style="text-align: right;">Ações</th></tr>`;
                }

                let htmlSecao = `
                <div class="cat-section">
                    <h3 class="cat-title">
                        <i class="fas fa-list-ul"></i> Categoria: ${cat} 
                        <span style="font-size: 0.9rem; margin-left: 10px; color: var(--text-secondary);">(${listaOriginal.length} registros)</span>
                        ${tituloComplemento}
                    </h3>
                    <div class="table-modern-wrapper">
                        <table class="data-table-modern">
                            <thead>${theadHTML}</thead>
                            <tbody>
                `;

                const renderizarLinhaTabela = (frota) => {
                    let statusBadge = '';
                    if (frota.status === 'Livre') {
                        statusBadge = `<span style="background-color: rgba(16, 185, 129, 0.1); color: #10b981; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; border: 1px solid rgba(16,185,129,0.3);">LIVRE</span>`;
                    } else {
                        const statusCor = frota.status === 'Inativo' ? '#ef4444' : frota.status === 'Reserva' ? '#f59e0b' : '#3b82f6'; 
                        statusBadge = `<span style="background-color: ${statusCor}20; color: ${statusCor}; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; border: 1px solid ${statusCor}40;">${frota.status || 'Engatado'}</span>`;
                    }
                    
                    let trHtml = '';

                    if (cat === 'CARRETA') {
                        trHtml += `
                            <tr>
                                <td>${statusBadge}</td>
                                <td style="font-weight: bold; color: var(--ccol-blue-bright); font-size: 1.1rem;">${frota.numero_go || '-'}</td>
                                <td><span class="sim-tag ${frota.is_virtual ? 'livre' : ''}">${frota.placa_carreta1 || '-'}</span></td>
                                <td><span class="sim-tag ${frota.is_virtual ? 'livre' : ''}">${frota.placa_carreta2 || '-'}</span></td>
                                <td><span class="sim-tag ${frota.is_virtual ? 'livre' : ''}">${frota.placa_carreta3 || '-'}</span></td>
                                <td style="text-align: right; display: flex; gap: 5px; justify-content: flex-end;">
                                    ${frota.is_virtual ? 
                                        `<button title="Engatar em Cavalo" class="btn-action-sm" style="background-color: #8b5cf6;" onclick="window.irParaEngateRapido('GO', '${frota.numero_go}')"><i class="fas fa-link"></i> Engatar no Cavalo</button>` : 
                                        `<button title="Excluir Registro Isolado" class="btn-action-sm btn-trash" onclick="window.excluirEngateSalvo(${frota.id})"><i class="fas fa-trash"></i></button>`
                                    }
                                </td>
                            </tr>
                        `;
                    } else if (cat === 'CAVALO') {
                        trHtml += `
                            <tr>
                                <td>${statusBadge}</td>
                                <td style="font-weight: bold; color: #e2e8f0;">${frota.numero_frota || '-'}</td>
                                <td style="font-weight: bold; font-size: 1.1rem; color:#fff;">${frota.placa_cavalo || '-'}</td>
                                <td style="text-align: right; display: flex; gap: 5px; justify-content: flex-end;">
                                    ${frota.is_virtual ? 
                                        `<button title="Engatar Carretas (GO)" class="btn-action-sm" style="background-color: #8b5cf6;" onclick="window.irParaEngateRapido('CAVALO', '${frota.placa_cavalo}')"><i class="fas fa-link"></i> Engatar GO</button>` : 
                                        `<button title="Excluir Registro Isolado" class="btn-action-sm btn-trash" onclick="window.excluirEngateSalvo(${frota.id})"><i class="fas fa-trash"></i></button>`
                                    }
                                </td>
                            </tr>
                        `;
                    } else { // TRITREM, BITREM
                        trHtml += `
                            <tr>
                                <td>${statusBadge}</td>
                                <td style="font-weight: bold; color: #e2e8f0;">${frota.numero_frota || '-'}</td>
                                <td style="font-weight: bold; font-size: 1.1rem; color:#fff;">${frota.placa_cavalo || '-'}</td>
                                <td style="font-weight: bold; color: var(--ccol-blue-bright);">${frota.numero_go || '-'}</td>
                                <td><span class="sim-tag">${frota.placa_carreta1 || '-'}</span></td>
                                <td><span class="sim-tag">${frota.placa_carreta2 || '-'}</span></td>
                                <td><span class="sim-tag">${frota.placa_carreta3 || '-'}</span></td>
                                <td style="text-align: right; display: flex; gap: 5px; justify-content: flex-end;">
                                    <button title="Desengatar" class="btn-action-sm btn-trash" onclick="window.desengatarConjunto(${frota.id})"><i class="fas fa-unlink"></i> Desengatar</button>
                                    <button title="Trocar Cavalo" class="btn-action-sm" style="background-color: #3b82f6;" onclick="window.abrirModalTransferenciaFrotaCompat(${frota.id})"><i class="fas fa-exchange-alt"></i> Trocar Cavalo</button>
                                </td>
                            </tr>
                        `;
                    }
                    return trHtml;
                };

                listaOriginal.forEach(frota => htmlSecao += renderizarLinhaTabela(frota));
                htmlSecao += `</tbody></table></div></div>`;
                container.innerHTML += htmlSecao;
            });

        } catch (error) {
            console.error("Erro ao carregar categorias:", error);
            container.innerHTML = '<p style="color: #ef4444; text-align: center;">Erro ao carregar painel.</p>';
        }
    }

    window.excluirEngateSalvo = async function(id) {
        if (!confirm("Deseja excluir este registro manual? Os veículos não serão apagados, apenas ficarão livres.")) return;
        try {
            await window.supabaseClient.from('frotas_engates').delete().eq('id', id);
            carregarCategoriasSalvas();
            popularSelectCavalos();
            popularSelectGO();
        } catch (error) {}
    };

    // =========================================================
    // DESENGATAR O CONJUNTO ATUAL
    // =========================================================
    window.desengatarConjunto = async function(id) {
        if (!confirm("Deseja desengatar este conjunto? O Cavalo e o GO voltarão a aparecer como 'Livres' em suas tabelas originais.")) return;
        try {
            const { error } = await window.supabaseClient.from('frotas_engates').delete().eq('id', id);
            if (error) throw error;
            
            alert("Desengate realizado com sucesso!");
            carregarCategoriasSalvas();
            popularSelectCavalos();
            popularSelectGO();
        } catch (error) {
            alert("Erro ao desengatar.");
            console.error(error);
        }
    };

    // =========================================================
    // MODAL DE TROCAR CAVALO
    // =========================================================
    window.abrirModalTransferenciaFrotaCompat = function(idOriginal) {
        const engate = dbEngatesSalvos.find(f => f.id === idOriginal);
        if (!engate) return;
        
        document.getElementById('transfFrotaOrigemIdCompat').value = engate.id;
        document.getElementById('transfFrotaOrigemTextCompat').innerText = `${engate.placa_cavalo} atrelado ao GO: ${engate.numero_go}`;

        const selectDestino = document.getElementById('selectFrotaDestinoCompat');
        selectDestino.innerHTML = '<option value="">Selecione um Cavalo Livre...</option>';
        
        const cavalosLivres = dbDocumentos.filter(d => {
            const tipo = safeUpper(d.tipo_veiculo);
            const esp = safeUpper(d.especie_tipo);
            const isCavalo = tipo === "CAVALO MECÂNICO" || tipo === "CAVALO" || /TRATOR|CAMINHAO TRATOR|TRACAO/.test(esp);
            if (!isCavalo) return false;
            const jaUsado = dbEngatesSalvos.find(e => e.placa_cavalo === d.placa);
            return !jaUsado;
        });

        if (cavalosLivres.length > 0) {
            cavalosLivres.forEach(c => {
                selectDestino.innerHTML += `<option value="${c.placa}">Assumir no Cavalo: ${c.placa} (${c.apelido || 'S/ Frota'})</option>`;
            });
        } else {
            selectDestino.innerHTML += `<option value="" disabled>Nenhum Cavalo Livre no momento.</option>`;
        }
        
        document.getElementById('modalTransferenciaFrotaCompat').style.display = 'flex';
    };

    window.fecharModalTransferenciaFrotaCompat = function() {
        document.getElementById('modalTransferenciaFrotaCompat').style.display = 'none';
    };

    window.confirmarTransferenciaFrotaCompat = async function() {
        const idOrigem = document.getElementById('transfFrotaOrigemIdCompat').value;
        const novaPlacaCavalo = document.getElementById('selectFrotaDestinoCompat').value;

        if (!novaPlacaCavalo) return alert("Selecione um cavalo destino válido.");

        const engateOrigem = dbEngatesSalvos.find(f => String(f.id) === String(idOrigem));
        if (!engateOrigem) return;

        try {
            await window.supabaseClient.from('frotas_engates')
                .update({ placa_cavalo: novaPlacaCavalo })
                .eq('id', engateOrigem.id);

            alert("Cavalo substituído no engate com sucesso!");
            fecharModalTransferenciaFrotaCompat();
            carregarCategoriasSalvas();
            popularSelectCavalos();
        } catch (e) { alert("Erro ao transferir cavalo."); }
    };

    // =========================================================
    // ABA 2: POPULAR SELECTS DA TELA NOVO ENGATE (SIMULADOR)
    // =========================================================
    function popularSelectCavalos() {
        const sel = document.getElementById("compatCavaloSelect");
        if (!sel) return;
        
        sel.innerHTML = '<option value="">-- Selecione a Placa do Cavalo --</option>';
        
        const cavalosTodos = dbDocumentos.filter(d => {
            const tipo = safeUpper(d.tipo_veiculo);
            const esp = safeUpper(d.especie_tipo);
            return tipo === "CAVALO MECÂNICO" || tipo === "CAVALO" || /TRATOR|CAMINHAO TRATOR|TRACAO/.test(esp);
        });

        const cavalosLivres = cavalosTodos.filter(c => !dbEngatesSalvos.find(e => safeUpper(e.placa_cavalo) === safeUpper(c.placa)));

        if (cavalosLivres.length > 0) {
            cavalosLivres.forEach(c => {
                const opt = document.createElement("option");
                opt.value = c.placa; 
                opt.textContent = `${c.placa} - Frota: ${c.apelido || 'S/N'}`;
                sel.appendChild(opt);
            });
        }
    }

    function popularSelectGO() {
        const selGO = document.getElementById("inputNumeroGoEngate");
        if (!selGO) return;

        selGO.innerHTML = '<option value="">-- Selecione o Nº GO --</option>';
        
        const carretas = dbDocumentos.filter(d => {
            const tipo = safeUpper(d.tipo_veiculo);
            const esp = safeUpper(d.especie_tipo);
            const isCavalo = tipo === "CAVALO MECÂNICO" || tipo === "CAVALO" || /TRATOR|CAMINHAO TRATOR|TRACAO/.test(esp);
            return !isCavalo && d.numero_go && safeUpper(d.numero_go) !== '';
        });
        
        const goMap = new Map();
        carretas.forEach(f => {
            const goStr = safeUpper(f.numero_go);
            if (!goMap.has(goStr)) goMap.set(goStr, { go: goStr, placas: [] });
            goMap.get(goStr).placas.push(f.placa);
        });

        if (goMap.size > 0) {
            const group = document.createElement("optgroup");
            group.label = ` CARRETAS CADASTRADAS POR GO (${goMap.size})`;
            
            // TRANSFORMA O MAPA EM ARRAY E ORDENA A-Z NUMERICAMENTE
            const gosOrdenados = Array.from(goMap.keys()).sort((a, b) => {
                return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
            });

            gosOrdenados.forEach(goStr => {
                const obj = goMap.get(goStr);
                const jaEngatado = dbEngatesSalvos.find(e => safeUpper(e.numero_go) === goStr);
                if (!jaEngatado) {
                    const opt = document.createElement("option");
                    opt.value = goStr; 
                    const placasUnicas = [...new Set(obj.placas)]; 
                    opt.textContent = `${goStr} (Placas: ${placasUnicas.join(', ') || 'Sem Placa'})`;
                    group.appendChild(opt);
                }
            });
            selGO.appendChild(group);
        }
    }

    function obterDadosDocumento(placa) {
        if(!placa) return null;
        let v = dbDocumentos.find(d => safeUpper(d.placa) === safeUpper(placa));
        if(!v) return { marca: 'S/ Cadastro', modelo: '', peso: 0, apelido: '' };
        return {
            marca: (v.marca_modelo || "").split("/")[0] || "",
            modelo: (v.marca_modelo || "").split("/")[1] || "",
            peso: parseFloat((String(v.peso_bruto) || "0").replace(",", ".")) || 0,
            apelido: v.apelido || ""
        };
    }

    function renderizarResumo() {
        const el = document.getElementById("compatResumo");
        const cavaloPlaca = document.getElementById("compatCavaloSelect").value;
        const categoria = document.getElementById("engateCategoria").value;
        
        if (!cavaloPlaca && categoria !== 'CARRETA') return;

        let docCavalo = null;
        if (cavaloPlaca) {
            docCavalo = obterDadosDocumento(cavaloPlaca);
            compatCavaloSelecionado = cavaloPlaca;

            document.getElementById("engateDescricao").value = `${docCavalo.marca} ${docCavalo.modelo}`.trim();
            document.getElementById("engateNumeroFrota").value = docCavalo.apelido || "";
        }

        if (docCavalo) {
            const formatCMT = docCavalo.peso > 0 ? docCavalo.peso.toFixed(3).replace(".", ",") + " t" : "<span style='color:var(--warn);'>Não Informado</span>";
            el.innerHTML = `
                <table class="sim-details-table">
                    <tbody>
                        <tr><td>Placa do Cavalo</td><td><span class="sim-tag" style="color:var(--ccol-blue-bright); border-color:var(--ccol-blue-bright);">${cavaloPlaca}</span></td></tr>
                        <tr><td>Marca / Modelo</td><td>${docCavalo.marca} ${docCavalo.modelo}</td></tr>
                        <tr><td>Capacidade (CMT)</td><td>${formatCMT}</td></tr>
                        <tr><td>Nº Frota (Apelido)</td><td>${docCavalo.apelido || "-"}</td></tr>
                    </tbody>
                </table>
            `;
        } else {
            el.innerHTML = `<p style="color:#94a3b8; font-style:italic;">Veículo não selecionado.</p>`;
        }
    }

    function puxarCarretasPorGO() {
        const goSelecionado = document.getElementById("inputNumeroGoEngate").value;
        
        if (!goSelecionado) {
            compatSimulacao.principal = ["", "", ""];
            renderizarSlots();
            return;
        }

        const todasAsCarretasDesteGO = dbDocumentos.filter(d => safeUpper(d.numero_go) === safeUpper(goSelecionado));
        
        let placasColetadas = todasAsCarretasDesteGO.map(c => c.placa).filter(Boolean);
        placasColetadas = [...new Set(placasColetadas)];
        
        compatSimulacao.principal = ["", "", ""]; 
        
        if (placasColetadas[0]) compatSimulacao.principal[0] = placasColetadas[0];
        if (placasColetadas[1]) compatSimulacao.principal[1] = placasColetadas[1];
        if (placasColetadas[2]) compatSimulacao.principal[2] = placasColetadas[2];
        
        renderizarSlots();
    }

    function renderizarSlots() {
        const el = document.getElementById("compatSimulacao");
        const goSelecionado = document.getElementById("inputNumeroGoEngate") ? document.getElementById("inputNumeroGoEngate").value : "";
        
        let htmlSlots = "";
        for (let i = 0; i < 3; i++) {
            const placa = compatSimulacao.principal[i] || "";
            htmlSlots += `
                <div class="sim-slot ${placa ? 'filled ok' : ''}" id="slot-card-${i}">
                    <div class="slot-header"><span><i class="fas fa-trailer"></i> Unidade ${i + 2} (Carreta ${i + 1})</span></div>
                    <div id="slot-info-${i}" style="min-height: 80px;"></div>
                </div>
            `;
        }
        
        el.innerHTML = htmlSlots;
        revalidarTudo(goSelecionado);
    }

    function revalidarTudo(goSelecionado) {
        for (let i = 0; i < 3; i++) {
            const placa = compatSimulacao.principal[i] || "";
            const infoEl = document.getElementById(`slot-info-${i}`);
            
            if (!placa) {
                if(infoEl) infoEl.innerHTML = `<span style="color: #64748b; font-style: italic;">Aguardando Placa...</span>`;
                continue;
            }

            const doc = obterDadosDocumento(placa);
            let goHtml = goSelecionado ? `<span class="sim-tag go-tag">GO ${goSelecionado}</span>` : "";

            infoEl.innerHTML = `
                <div class="slot-info-box">
                    <strong><span class="sim-tag" style="border-color:#34d399;">${placa}</span></strong><br>
                    <strong>${doc.marca} ${doc.modelo}</strong><br>
                    Tara: ${doc.peso > 0 ? doc.peso + ' t' : '?'} <br>
                    ${goHtml}
                </div>
                <div class="slot-status-msg" style="color: var(--ccol-green-bright); margin-top: 10px;">
                    <i class="fas fa-check-circle"></i> Placa Puxada do GO
                </div>
            `;
        }
        document.getElementById("compatResultadoContainer").style.display = "none";
        document.getElementById("painelSalvarEngate").style.display = "none";
    }

    function gerarRelatorioFinal() {
        const container = document.getElementById("compatResultadoContainer");
        const painelSalvar = document.getElementById("painelSalvarEngate");
        const categoria = document.getElementById("engateCategoria").value;
        const escolhidas = compatSimulacao.principal.filter(Boolean);
        const cavalo = document.getElementById("compatCavaloSelect").value;

        if ((categoria === 'TRITREM' || categoria === 'CARRETA') && escolhidas.length === 0) {
            alert("O Nº GO selecionado não possui carretas válidas ou nenhum GO foi selecionado.");
            return;
        }

        if ((categoria === 'TRITREM' || categoria === 'CAVALO') && !cavalo) {
            alert("Selecione um Cavalo.");
            return;
        }

        container.style.display = "block";
        container.innerHTML = `
            <div class="sim-report ok">
                <h3><i class="fas fa-check-double"></i> Relatório: Registro Válido</h3>
                <p style="color:#cbd5e1; margin:0;">Clique no botão abaixo para gravar a composição na tabela de engates ativos.</p>
            </div>
        `;
        painelSalvar.style.display = "flex";
        container.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    // =========================================================
    // SALVAR ENGATE NO BANCO
    // =========================================================
    window.salvarEngateNoBanco = async function() {
        const categoria = document.getElementById("engateCategoria").value;
        const status = document.getElementById("engateStatus").value;
        const cavaloPlaca = document.getElementById("compatCavaloSelect").value;
        const numeroFrota = document.getElementById("engateNumeroFrota").value;
        const goSelecionado = document.getElementById("inputNumeroGoEngate").value;

        let payload = {
            categoria: categoria,
            status: status,
            numero_frota: numeroFrota || null
        };

        if (categoria === 'CAVALO') {
            if (!cavaloPlaca) return alert("Selecione o Cavalo.");
            payload.placa_cavalo = cavaloPlaca;
        } else if (categoria === 'CARRETA') {
            if (!goSelecionado) return alert("Selecione o Nº GO.");
            payload.numero_go = goSelecionado;
            payload.placa_carreta1 = compatSimulacao.principal[0] || null;
            payload.placa_carreta2 = compatSimulacao.principal[1] || null;
            payload.placa_carreta3 = compatSimulacao.principal[2] || null;
        } else { // TRITREM, etc
            if (!cavaloPlaca || !goSelecionado) return alert("Selecione o Cavalo e o Nº GO.");
            payload.placa_cavalo = cavaloPlaca;
            payload.numero_go = goSelecionado;
            payload.placa_carreta1 = compatSimulacao.principal[0] || null;
            payload.placa_carreta2 = compatSimulacao.principal[1] || null;
            payload.placa_carreta3 = compatSimulacao.principal[2] || null;
        }

        const btnSalvar = document.getElementById("btnSalvarEngateDefinitivo");
        btnSalvar.disabled = true;
        btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gravando...';

        if (typeof window.injetarFilial === 'function') payload = window.injetarFilial(payload);

        try {
            if (cavaloPlaca) await window.supabaseClient.from('frotas_engates').delete().eq('placa_cavalo', cavaloPlaca);
            if (goSelecionado) await window.supabaseClient.from('frotas_engates').delete().eq('numero_go', goSelecionado);

            const { error } = await window.supabaseClient.from('frotas_engates').insert([payload]);
            if (error) throw error;

            alert("Cadastro gravado com sucesso!");
            
            document.getElementById("engateNumeroFrota").value = "";
            document.getElementById("engateDescricao").value = "";
            document.getElementById("compatCavaloSelect").value = "";
            document.getElementById("inputNumeroGoEngate").value = "";
            compatSimulacao.principal = ["", "", ""];
            
            await carregarDadosBanco();
            popularSelectCavalos();
            popularSelectGO();
            window.alternarAbaCompatibilidade('lista');

        } catch (error) {
            alert("Erro ao gravar no banco de dados.");
            console.error(error);
        } finally {
            btnSalvar.disabled = false;
            btnSalvar.innerHTML = '<i class="fas fa-save"></i> GRAVAR CONJUNTO DE FROTA';
        }
    };

    // =========================================================
    // INICIALIZAÇÃO DE EVENTOS
    // =========================================================
    function configurarEventos() {
        const selCavalo = document.getElementById("compatCavaloSelect");
        if (selCavalo) {
            selCavalo.addEventListener("change", () => {
                compatCavaloSelecionado = selCavalo.value || null;
                if (compatCavaloSelecionado) {
                    document.getElementById("simWorkspace").style.display = "grid";
                    renderizarResumo();
                } else {
                    document.getElementById("simWorkspace").style.display = "none";
                }
                document.getElementById("compatResultadoContainer").style.display = "none";
                document.getElementById("painelSalvarEngate").style.display = "none";
            });
        }

        const selGo = document.getElementById("inputNumeroGoEngate");
        if (selGo) selGo.addEventListener("change", puxarCarretasPorGO);

        const btnValidar = document.getElementById("compatValidarBtn");
        if (btnValidar) btnValidar.addEventListener("click", gerarRelatorioFinal);

        const btnLimpar = document.getElementById("compatLimparBtn");
        if (btnLimpar) btnLimpar.addEventListener("click", () => {
            document.getElementById("inputNumeroGoEngate").value = "";
            compatSimulacao.principal = ["", "", ""];
            renderizarSlots();
        });

        const btnSalvarDef = document.getElementById("btnSalvarEngateDefinitivo");
        if (btnSalvarDef) btnSalvarDef.addEventListener("click", salvarEngateNoBanco);
    }

    // Inicialização da Tela
    await carregarDadosBanco();
    popularSelectCavalos();
    popularSelectGO(); 
    carregarCategoriasSalvas();
    configurarEventos();
};