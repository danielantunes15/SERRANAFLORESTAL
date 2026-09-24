// ==================== modules/gerencial/tarifador/tarifador.js ====================
window.previewDataBTSD = null;
window.previewDataTTSD = null;
window.tarifadoresAtivosCache = [];

window.initTarifador = async function() {
    await window.carregarFiliaisSelects();
    window.carregarListaTarifadores();
    window.carregarTarifadorAtivoCache();
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('tarifadorFile');
    if (dropZone && fileInput) {
        dropZone.ondragover = (e) => {
             e.preventDefault();
             dropZone.classList.add('dragover');
         };
        dropZone.ondragleave = (e) => {
             dropZone.classList.remove('dragover');
         };
        dropZone.ondrop = (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                window.previewTarifador({ target: fileInput });
            }
        };
    }
};

window.carregarFiliaisSelects = async function() {
    const consulta = document.getElementById('consultaFilial');
    const importa = document.getElementById('importaFilial');
    if (!consulta || !importa) return;
    try {
        let query = window.supabaseClient.from('filiais').select('id, nome').eq('status', 'Ativa').order('nome');
                 
        if (window.currentUser && window.currentUser.role !== 'SuperAdmin' && window.currentUser.role !== 'Admin' && window.currentUser.filial_id) {
            query = query.eq('id', window.currentUser.filial_id);
        }
        const { data, error } = await query;
        if (error) throw error;
        let optionsHtml = '';
        if (window.currentUser && (window.currentUser.role === 'SuperAdmin' || window.currentUser.role === 'Admin')) {
            optionsHtml += '<option value="NULL">Geral / Matriz (Aplicar a todas as filiais s/ tabela própria)</option>';
        }
        if (data && data.length > 0) {
            data.forEach(f => {
                optionsHtml += `<option value="${f.id}">${f.nome}</option>`;
            });
        } else if (optionsHtml === '') {
            optionsHtml = '<option value="NULL">Nenhuma filial encontrada</option>';
        }
        consulta.innerHTML = optionsHtml;
        importa.innerHTML = optionsHtml;
        if (window.currentUser && window.currentUser.filial_id) {
            consulta.value = window.currentUser.filial_id;
            importa.value = window.currentUser.filial_id;
        }
    } catch (err) {
        console.error("Erro ao buscar filiais", err);
        const errOption = '<option value="NULL">Erro ao carregar filiais</option>';
        consulta.innerHTML = errOption;
        importa.innerHTML = errOption;
    }
};

window.previewTarifador = function(event) {
    const file = event.target.files[0];
    if (!file) return;
         
    document.getElementById('tarifadorFileName').textContent = file.name;
    const reader = new FileReader();
    const veiculoSelecionado = document.getElementById('importaVeiculo').value;
    
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            let tempBTSD = [];
            let tempTTSD = [];

            if (veiculoSelecionado === "AUTO") {
                const nomeAbaBTSD = "BTSD_REAJUSTE2026";
                const nomeAbaTTSD = "TTSD_REAJUSTE2026";
                if (workbook.Sheets[nomeAbaBTSD]) {
                    const json = XLSX.utils.sheet_to_json(workbook.Sheets[nomeAbaBTSD], { header: 1, defval: null, blankrows: false });
                    tempBTSD = window.processarDadosExcel(json, "BITREM");
                }
                if (workbook.Sheets[nomeAbaTTSD]) {
                    const json = XLSX.utils.sheet_to_json(workbook.Sheets[nomeAbaTTSD], { header: 1, defval: null, blankrows: false });
                    tempTTSD = window.processarDadosExcel(json, "TRITREM");
                }
            }

            if (tempBTSD.length === 0 && tempTTSD.length === 0) {
                workbook.SheetNames.forEach(sheetName => {
                    const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, blankrows: false });
                                         
                    let isTritrem = (veiculoSelecionado === 'TTSD');
                    let isBitrem = (veiculoSelecionado === 'BTSD');
                                         
                    if (veiculoSelecionado === 'AUTO') {
                        let combinedStr = "";
                        for(let i = 0; i < Math.min(15, json.length); i++) {
                            combinedStr += (json[i] || []).join(' ').toUpperCase() + " ";
                        }
                        
                        if (combinedStr.includes('TRI-TREM') || combinedStr.includes('TRITREM') || combinedStr.includes('TTSD')) isTritrem = true;
                        if (combinedStr.includes('BI-TREM') || combinedStr.includes('BITREM') || combinedStr.includes('BTSD')) isBitrem = true;
                        
                        if (!isTritrem && !isBitrem) {
                            if (combinedStr.includes('TERRA') || combinedStr.includes('RAIO') || combinedStr.includes('ASFALTO') || combinedStr.includes('INICIAL')) {
                                isTritrem = true;
                                isBitrem = true;
                            }
                        }
                    }

                    if (isTritrem) {
                        const result = window.processarDadosExcel(json, "TRITREM");
                        if (result.length > 0 && tempTTSD.length === 0) tempTTSD = result;
                    } 
                    if (isBitrem) {
                        const result = window.processarDadosExcel(json, "BITREM");
                        if (result.length > 0 && tempBTSD.length === 0) tempBTSD = result;
                    }
                });
            }
            
            window.previewDataBTSD = tempBTSD.length > 0 ? tempBTSD : null;
            window.previewDataTTSD = tempTTSD.length > 0 ? tempTTSD : null;
            
            if (!window.previewDataBTSD && !window.previewDataTTSD) {
                alert('Nenhum dado processado. Verifique se a planilha é válida ou se contém os cabeçalhos esperados.');
                return;
            }
            
            alert(
                `Planilha lida com sucesso!\n\n` +
                (window.previewDataBTSD ? `BITREM: ${window.previewDataBTSD.length} faixas encontradas\n` : '') +
                (window.previewDataTTSD ? `TRITREM: ${window.previewDataTTSD.length} faixas encontradas\n\n` : '\n') +
                `Agora preencha o Nome da Tabela, o Preço de Carregamento e clique em 'Salvar Tabela no Banco'.`
            );
        } catch (error) {
            console.error('Erro ao ler arquivo:', error);
            alert('Erro ao ler o arquivo: ' + error.message);
        }
    };
    reader.readAsArrayBuffer(file);
};

window.processarDadosExcel = function(json, tipo) {
    const parseBrNumber = (raw) => {
        if (typeof raw === 'number') return raw;
        if (raw === null || raw === undefined || String(raw).trim() === '') return null;
        let str = String(raw).replace(/R\$\s?/gi, '').trim();
        if (str.includes(',')) {
            str = str.replace(/\./g, '').replace(',', '.');
        }
        let parsed = parseFloat(str);
        return isNaN(parsed) ? null : parsed;
    };

    const linhas = json.filter(row => row && row.length > 0 && row.some(cell => cell !== '' && cell !== undefined && cell !== null));
    if (linhas.length < 2) return [];

    // =========================================================
    // 1. TENTAR DETECTAR FORMATO "RAIO" EM MÚLTIPLOS BLOCOS LATERAIS
    // =========================================================
    let isRaioFormat = false;
    let headerRowIndex = -1;
    let blocosRaio = [];

    for (let i = 0; i < Math.min(15, linhas.length); i++) {
        const rowStr = linhas[i].map(c => String(c || '').toUpperCase().trim()).join(' ');
        
        if (rowStr.includes('RAIO') && (rowStr.includes('INICIAL') || rowStr.includes('FINAL'))) {
            isRaioFormat = true;
            headerRowIndex = i;
            
            let blocoAtual = { ini: -1, fim: -1, tarifa: -1 };
            
            linhas[i].forEach((cell, idx) => {
                const cStr = String(cell || '').toUpperCase().trim();
                
                if (cStr.includes('INICIAL')) {
                    if (blocoAtual.ini !== -1) {
                        blocosRaio.push({...blocoAtual});
                        blocoAtual = { ini: -1, fim: -1, tarifa: -1 };
                    }
                    blocoAtual.ini = idx;
                }
                
                if (cStr.includes('FINAL')) {
                    blocoAtual.fim = idx;
                }
                
                if (cStr.includes('R$') || cStr.includes('PIS') || cStr.includes('COFINS') || cStr.includes('TARIFA') || cStr.includes('VALOR')) {
                    if (blocoAtual.tarifa === -1) {
                        blocoAtual.tarifa = idx;
                    }
                }
            });
            
            if (blocoAtual.ini !== -1) {
                blocosRaio.push(blocoAtual);
            }
            break;
        }
    }

    if (isRaioFormat && blocosRaio.length > 0) {
        const dadosRaio = [];
        for (let i = headerRowIndex + 1; i < linhas.length; i++) {
            const row = linhas[i];
            if (!row || row.length === 0) continue;
            
            blocosRaio.forEach(bloco => {
                if (bloco.ini !== -1 && bloco.fim !== -1 && bloco.tarifa !== -1) {
                    let rIni = parseBrNumber(row[bloco.ini]);
                    let rFim = parseBrNumber(row[bloco.fim]);
                    let tarifa = parseBrNumber(row[bloco.tarifa]);

                    if (rIni !== null && rFim !== null && tarifa !== null && tarifa > 0) {
                        dadosRaio.push({
                            raio_inicial: rIni,
                            raio_final: rFim,
                            tarifa: tarifa,
                            is_raio: true
                        });
                    }
                }
            });
        }
        dadosRaio.sort((a,b) => a.raio_inicial - b.raio_inicial);
        return dadosRaio;
    }

    // =========================================================
    // 2. LÓGICA PADRÃO EXISTENTE (Matriz Asfalto x Terra)
    // =========================================================
    let asfaltoColIndex = -1;
    let firstTerraCol = -1;
    let isAteFormat = false;
    for (let i = 0; i < Math.min(10, linhas.length); i++) {
        const row = linhas[i];
        let hasAte = false;
        for (let c = 0; c < row.length; c++) {
            if (typeof row[c] === 'string') {
                const text = row[c].trim().toUpperCase().replace(' ', 'E');
                if (text === 'ATE') {
                    hasAte = true;
                    break;
                }
            }
        }
                 
        if (hasAte) {
            for (let c = 0; c < row.length; c++) {
                if (typeof row[c] === 'number') {
                    headerRowIndex = i;
                    firstTerraCol = c;
                    isAteFormat = true;
                    break;
                }
            }
        }
        if (isAteFormat) break;
    }
    
    if (!isAteFormat) {
        for (let i = 0; i < Math.min(10, linhas.length); i++) {
            const row = linhas[i];
            if (row && typeof row[2] === 'number' && typeof row[3] === 'number') {
                headerRowIndex = i;
                firstTerraCol = 2; 
                asfaltoColIndex = 1; 
                break;
            }
        }
    }
    
    if (headerRowIndex === -1) {
        console.warn(`[${tipo}] Cabeçalho não encontrado.`);
        return [];
    }
    
    const headerRow = linhas[headerRowIndex];
    const colunasTerra = [];
    for (let c = firstTerraCol; c < headerRow.length; c++) {
        const val = headerRow[c];
        if (val !== null && val !== undefined && val !== "") {
            const num = parseFloat(val);
            if (!isNaN(num)) {
                colunasTerra.push({ colIndex: c, valor: num });
            }
        }
    }
    
    if (isAteFormat) {
        let dataRow = null;
        for (let i = headerRowIndex + 1; i < linhas.length; i++) {
            if (typeof linhas[i][firstTerraCol] === 'number' || typeof linhas[i][firstTerraCol] === 'string') {
                dataRow = linhas[i];
                break;
            }
        }
                 
        if (dataRow) {
            for (let c = firstTerraCol - 1; c >= 0; c--) {
                if (typeof dataRow[c] === 'number') {
                    asfaltoColIndex = c;
                    break;
                }
            }
        }
    }
    
    if (asfaltoColIndex === -1) asfaltoColIndex = isAteFormat ? 1 : 1; 
    
    const dados = [];
    for (let i = headerRowIndex + 1; i < linhas.length; i++) {
        const row = linhas[i];
        if (!row || row.length === 0) continue;
        const asfalto = parseFloat(row[asfaltoColIndex]);
        if (isNaN(asfalto)) continue;
        
        colunasTerra.forEach(col => {
            let tarifa = parseBrNumber(row[col.colIndex]);
            if (tarifa > 0) {
                dados.push({
                    asfalto: asfalto,
                    terra: col.valor,
                    tarifa: tarifa
                });
            }
        });
    }
         
    return dados;
};

window.importarTarifador = async function(event) {
    if (!window.previewDataBTSD && !window.previewDataTTSD) {
        alert('Nenhum arquivo carregado ou dados inválidos.');
        return;
    }
         
    const filialValue = document.getElementById('importaFilial').value;
    const finalFilialId = (filialValue === 'NULL') ? null : filialValue;
    const nome = document.getElementById('tarifadorNome').value.trim();
    if (!nome) {
        alert('Por favor, informe um nome base para a tabela.');
        document.getElementById('tarifadorNome').focus();
        return;
    }
    
    const precoInput = parseFloat(document.getElementById('tarifadorPrecoCarregamento').value.replace(',', '.'));
    const precoFinal = isNaN(precoInput) ? 0 : precoInput;
    const btnSalvar = event ? event.currentTarget : document.getElementById('btnSalvar');
    const textoOriginal = btnSalvar.innerHTML;
    
    btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Salvando no Banco...';
    btnSalvar.disabled = true;
    
    try {
        let queryDesativar = window.supabaseClient.from('tarifadores').update({ ativo: false });
        if (finalFilialId === null) {
            queryDesativar = queryDesativar.is('filial_id', null);
        } else {
            queryDesativar = queryDesativar.eq('filial_id', finalFilialId);
        }
        await queryDesativar;
        
        const inserts = [];
        if (window.previewDataBTSD && window.previewDataBTSD.length > 0) {
            inserts.push({
                nome: `${nome} - BITREM`,
                preco_carregamento: precoFinal,
                ativo: true,
                dados: window.previewDataBTSD,
                filial_id: finalFilialId
            });
        }
        if (window.previewDataTTSD && window.previewDataTTSD.length > 0) {
            inserts.push({
                nome: `${nome} - TRITREM`,
                preco_carregamento: precoFinal,
                ativo: true,
                dados: window.previewDataTTSD,
                filial_id: finalFilialId
            });
        }
        
        const { error } = await window.supabaseClient.from('tarifadores').insert(inserts);
        if (error) throw error;
        alert(`  Tabela(s) importada(s) e ativada(s) com sucesso no Banco de Dados!`);
                 
        window.previewDataBTSD = null;
        window.previewDataTTSD = null;
        document.getElementById('tarifadorFile').value = '';
        document.getElementById('tarifadorFileName').textContent = 'Clique ou arraste o arquivo Excel aqui';
        document.getElementById('tarifadorNome').value = '';
        document.getElementById('tarifadorPrecoCarregamento').value = '';
        document.getElementById('importaVeiculo').value = 'AUTO';
                 
        window.initTarifador();      
    } catch (err) {
        console.error("Erro ao salvar tarifador no Supabase:", err);
        alert('Erro ao salvar no banco de dados: ' + err.message);
    } finally {
        btnSalvar.innerHTML = textoOriginal;
        btnSalvar.disabled = false;
    }
};

window.carregarListaTarifadores = async function() {
    const tbody = document.getElementById('tbodyTarifadores');
    if(!tbody) return;
         
    tbody.innerHTML = `<tr><td colspan="7" class="text-center p-6 text-slate-500"><i class="fas fa-spinner fa-spin mr-2"></i>Buscando dados no servidor...</td></tr>`;
         
    try {
        let query = window.supabaseClient
            .from('tarifadores')
            .select('id, nome, preco_carregamento, data_importacao, ativo, dados, filial_id, filiais(nome)')
            .order('data_importacao', { ascending: false });
                     
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
        const { data: tabelas, error } = await query;
        if (error) throw error;
        tbody.innerHTML = '';
                 
        if (!tabelas || tabelas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center p-6 text-slate-500">Nenhuma tabela cadastrada no sistema.</td></tr>`;
            return;
        }
        
        tabelas.forEach(t => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-700/30 transition-colors";
                         
            const filialNome = t.filiais && t.filiais.nome ? t.filiais.nome : 'MATRIZ / GLOBAL';
            const dataFormatada = new Date(t.data_importacao).toLocaleDateString('pt-BR');
            const numRegistros = Array.isArray(t.dados) ? t.dados.length : 0;
            const precoFormatado = t.preco_carregamento ? parseFloat(t.preco_carregamento).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
                         
            const statusHtml = t.ativo 
                 ? `<span class="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-1 rounded-full border border-emerald-500/30 font-bold"><i class="fas fa-check-circle"></i> ATIVA</span>`
                : `<span class="bg-slate-500/20 text-slate-400 text-[10px] px-2 py-1 rounded-full border border-slate-500/30 font-bold">INATIVA</span>`;
                             
            const btnAtivar = !t.ativo 
                 ? `<button onclick="window.ativarTarifador('${t.id}', '${t.filial_id}')" class="text-sky-400 hover:text-sky-300 text-xs font-bold mr-3"><i class="fas fa-check"></i> Ativar</button>` 
                 : '';
                 
            tr.innerHTML = `
                <td class="px-6 py-4 font-bold text-sky-400 text-xs uppercase">${filialNome}</td>
                <td class="px-6 py-4 font-bold text-white"><i class="fas fa-truck text-slate-400 mr-2"></i>${t.nome}</td>
                <td class="px-6 py-4 text-slate-400 text-xs">${dataFormatada}</td>
                <td class="px-6 py-4 text-right text-emerald-400 font-mono font-bold">${precoFormatado}</td>
                <td class="px-6 py-4 text-center text-slate-300 font-mono">${numRegistros}</td>
                <td class="px-6 py-4 text-center">${statusHtml}</td>
                <td class="px-6 py-4 text-right">
                    ${btnAtivar}
                    <button onclick="window.excluirTarifador('${t.id}')" class="text-rose-400 hover:text-rose-300 text-xs font-bold"><i class="fas fa-trash"></i> Excluir</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Erro ao carregar lista de tarifadores:", err);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center p-6 text-rose-500 font-bold">Erro ao buscar tabelas do banco de dados.</td></tr>`;
    }
};

window.ativarTarifador = async function(id, filialId) {
    try {
        let finalFilialId = (!filialId || filialId === 'null') ? null : filialId;
                 
        let queryDesativar = window.supabaseClient.from('tarifadores').update({ ativo: false });
        if (finalFilialId === null) {
            queryDesativar = queryDesativar.is('filial_id', null);
        } else {
            queryDesativar = queryDesativar.eq('filial_id', finalFilialId);
        }
        await queryDesativar;
        await window.supabaseClient.from('tarifadores').update({ ativo: true }).eq('id', id);
                 
        window.initTarifador(); 
    } catch (err) {
        console.error("Erro ao ativar tarifador:", err);
        alert('Erro ao ativar a tabela no banco.');
    }
};

window.excluirTarifador = async function(id) {
    if(!confirm("Tem certeza que deseja excluir esta tabela do banco de dados?")) return;
    try {
        await window.supabaseClient.from('tarifadores').delete().eq('id', id);
        window.initTarifador(); 
    } catch (err) {
        console.error("Erro ao excluir tarifador:", err);
        alert('Erro ao excluir a tabela.');
    }
};

window.carregarTarifadorAtivoCache = async function() {
    try {
        let query = window.supabaseClient.from('tarifadores').select('nome, preco_carregamento, dados, filial_id').eq('ativo', true);
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
                 
        const { data, error } = await query;
        if (error) throw error;
                 
        window.tarifadoresAtivosCache = data || [];
    } catch (err) {
        console.error("Erro ao colocar tarifadores ativos em cache:", err);
        window.tarifadoresAtivosCache = [];
    }
};

window.consultarTarifa = function() {
    const filialSelect = document.getElementById('consultaFilial');
    const filialValue = filialSelect.value;
    const finalFilialId = (filialValue === 'NULL') ? null : filialValue;
    const nomeFilialSelecionada = filialSelect.options[filialSelect.selectedIndex].text.toUpperCase();
         
    const tipoVeiculo = document.getElementById('consultaTipo').value; 
    const asfalto = parseFloat(document.getElementById('consultaAsfalto').value);
    const terra = parseFloat(document.getElementById('consultaTerra').value);
         
    if (isNaN(asfalto) || isNaN(terra)) {
        alert("Por favor, preencha as distâncias de asfalto e terra.");
        return;
    }
    const divRes = document.getElementById('resultadoTarifa');
    const valorEl = document.getElementById('valorTarifa');
    const msgEl = document.getElementById('msgTarifa');
         
    divRes.classList.remove('hidden');
    if (window.tarifadoresAtivosCache.length === 0) {
        valorEl.textContent = "R$ 0,00";
        msgEl.textContent = "Nenhuma tabela ativa foi encontrada no sistema.";
        msgEl.className = "text-xs text-rose-400 mt-2";
        return;
    }
    const termoBusca = tipoVeiculo === 'BTSD' ? 'BITREM' : 'TRITREM';
         
    let tabelaAlvo = window.tarifadoresAtivosCache.find(t => 
         t.nome.toUpperCase().includes(termoBusca) && 
         String(t.filial_id) === String(finalFilialId)
    );
         
    if (!tabelaAlvo) {
        tabelaAlvo = window.tarifadoresAtivosCache.find(t => 
             t.nome.toUpperCase().includes(termoBusca) && 
             t.filial_id === null
        );
    }
    
    if (!tabelaAlvo) {
        valorEl.textContent = "R$ 0,00";
        msgEl.textContent = "Nenhuma tabela compatível encontrada para esta Filial e Veículo.";
        msgEl.className = "text-xs text-rose-400 mt-2";
        return;
    }

    const dados = tabelaAlvo.dados;
    const nomeTabela = tabelaAlvo.nome;

    // LÓGICA INTELIGENTE POR RAIO (SOMA ASFALTO + TERRA)
    const isTabelaRaio = dados.length > 0 && (dados[0].is_raio || dados[0].raio_inicial !== undefined);

    if (isTabelaRaio) {
        let distanciaTotal = asfalto + terra;
        let distArredondada = Math.round(distanciaTotal * 100) / 100;
        
        let tarifaEncontrada = dados.find(t => distArredondada >= t.raio_inicial && distArredondada <= t.raio_final);
        
        // Trava de segurança para não cair em gaps
        if (!tarifaEncontrada) {
            let ordenados = [...dados].sort((a,b) => a.raio_final - b.raio_final);
            tarifaEncontrada = ordenados.find(t => t.raio_final >= distArredondada);
            if(!tarifaEncontrada) tarifaEncontrada = ordenados[ordenados.length - 1]; // Pega a última faixa se ultrapassar o teto
        }
        
        if (tarifaEncontrada) {
            valorEl.textContent = tarifaEncontrada.tarifa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            msgEl.textContent = `Faixa aplicada (${nomeTabela}): Raio de ${tarifaEncontrada.raio_inicial} a ${tarifaEncontrada.raio_final}km (Percorrido: ${distanciaTotal}km)`;
            msgEl.className = "text-xs text-emerald-400 mt-2";
        } else {
            valorEl.textContent = "R$ 0,00";
            msgEl.textContent = `Nenhuma tarifa definida para o raio de ${distanciaTotal}km.`;
            msgEl.className = "text-xs text-rose-400 mt-2";
        }
        return;
    }

    // LÓGICA PADRÃO (MATRIZ ASFALTO X TERRA)
    const asfaltoLimites = [...new Set(dados.map(d => d.asfalto))].sort((a, b) => a - b);
    const terraLimites = [...new Set(dados.map(d => d.terra))].sort((a, b) => a - b);
    
    const isLencois = nomeFilialSelecionada.includes('LENÇÓIS') || nomeFilialSelecionada.includes('LENCOIS') || nomeTabela.toUpperCase().includes('LENCOIS');
    let asfaltoFaixa;
    
    if (isLencois) {
        asfaltoFaixa = [...asfaltoLimites].reverse().find(limite => asfalto >= limite);
    } else {
        asfaltoFaixa = asfaltoLimites.find(limite => asfalto <= limite);
    }
    
    let terraFaixa = terraLimites.find(limite => terra <= limite);
    
    if (asfaltoFaixa === undefined) {
        asfaltoFaixa = isLencois ? asfaltoLimites[0] : asfaltoLimites[asfaltoLimites.length - 1];
    }
    if (terraFaixa === undefined) terraFaixa = terraLimites[terraLimites.length - 1];
    
    const tarifaEncontrada = dados.find(t => t.asfalto === asfaltoFaixa && t.terra === terraFaixa);
    if (tarifaEncontrada) {
        valorEl.textContent = tarifaEncontrada.tarifa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        msgEl.textContent = `Faixa aplicada (${nomeTabela}): Asfalto na linha ${asfaltoFaixa}km / Terra até ${terraFaixa}km`;
        msgEl.className = "text-xs text-emerald-400 mt-2";
    } else {
        valorEl.textContent = "R$ 0,00";
        msgEl.textContent = "Nenhum valor encontrado para estas faixas.";
        msgEl.className = "text-xs text-rose-400 mt-2";
    }
};