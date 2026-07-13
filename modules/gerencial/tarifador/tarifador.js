window.tarifadorPreviewData = null;
window.tarifadorAtivoCache = null; // Guarda a tabela ativa em memória para consultas super rápidas

window.initTarifador = function() {
    window.carregarListaTarifadores();
    window.carregarTarifadorAtivoCache();
};

// 1. LER E PROCESSAR O EXCEL
window.previewTarifador = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById('tarifadorFileName').textContent = file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const primeiraPlanilha = workbook.Sheets[workbook.SheetNames[0]];
            
            const json = XLSX.utils.sheet_to_json(primeiraPlanilha, { 
                header: 1,
                defval: '',
                blankrows: true
            });
            
            const dadosProcessados = window.processarDadosExcel(json);
            
            if (dadosProcessados.length === 0) {
                alert('Não foi possível processar a planilha. Verifique o formato.\n\n' +
                      '- Linha 1: "Raio" na coluna A, valores de Terra na horizontal (0, 1, 2, 3...)\n' +
                      '- Coluna A: valores de Asfalto (0, 1, 2, 3...)\n' +
                      '- Células: valores da tarifa');
                return;
            }
            
            window.tarifadorPreviewData = dadosProcessados;
            alert(`Planilha lida com sucesso! ${dadosProcessados.length} tarifas encontradas. Clique em 'Salvar Tabela' para enviar ao banco de dados.`);
            
        } catch (error) {
            console.error('Erro ao ler arquivo:', error);
            alert('Erro ao ler o arquivo: ' + error.message);
        }
    };
    reader.readAsArrayBuffer(file);
};

window.processarDadosExcel = function(json) {
    const linhas = json.filter(row => row && row.length > 0 && row.some(cell => cell !== '' && cell !== undefined && cell !== null));
    if (linhas.length < 2) return [];
    
    const headerRow = linhas[0];
    const valoresTerra = [];
    
    for (let j = 1; j < headerRow.length; j++) {
        const cell = String(headerRow[j] || '').trim();
        let valor = parseFloat(cell);
        if (isNaN(valor)) {
            const numeros = cell.match(/\d+/);
            if (numeros) valor = parseInt(numeros[0]);
            else valor = j - 1;
        }
        if (!isNaN(valor) && valor >= 0) {
            valoresTerra.push({ index: j, valor: valor });
        }
    }
    
    const dados = [];
    for (let i = 1; i < linhas.length; i++) {
        const row = linhas[i];
        if (!row || row.length === 0) continue;
        
        const asfalto = parseFloat(row[0]);
        if (isNaN(asfalto)) continue;
        
        valoresTerra.forEach(col => {
            const tarifa = parseFloat(row[col.index]);
            if (!isNaN(tarifa) && tarifa > 0) {
                dados.push({ asfalto: asfalto, terra: col.valor, tarifa: tarifa });
            }
        });
    }
    return dados;
};

// 2. SALVAR NO BANCO DE DADOS SUPABASE
window.importarTarifador = async function() {
    if (!window.tarifadorPreviewData || window.tarifadorPreviewData.length === 0) {
        alert('Nenhum arquivo carregado ou dados inválidos.');
        return;
    }
    
    const nome = document.getElementById('tarifadorNome').value.trim();
    if (!nome) {
        alert('Por favor, informe um nome para o tarifador.');
        document.getElementById('tarifadorNome').focus();
        return;
    }

    const btnSalvar = event.currentTarget || document.querySelector('button[onclick="window.importarTarifador()"]');
    const textoOriginal = btnSalvar.innerHTML;
    btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando no Banco...';
    btnSalvar.disabled = true;

    try {
        // Primeiro: Desativar todos os outros tarifadores para que o novo seja o principal
        let queryDesativar = window.supabaseClient.from('tarifadores').update({ ativo: false }).neq('id', '00000000-0000-0000-0000-000000000000');
        if (typeof window.aplicarFiltroFilial === 'function') queryDesativar = window.aplicarFiltroFilial(queryDesativar);
        await queryDesativar;

        // Segundo: Inserir o novo tarifador (O JSONB é perfeito para arrays gigantes)
        const novoRegistro = {
            nome: nome,
            ativo: true,
            dados: window.tarifadorPreviewData
        };

        const payload = typeof window.injetarFilial === 'function' ? window.injetarFilial(novoRegistro) : novoRegistro;

        const { error } = await window.supabaseClient.from('tarifadores').insert([payload]);
        
        if (error) throw error;

        alert(`✅ Tabela "${nome}" importada e ativada com sucesso no Banco de Dados!`);
        
        // Resetar interface
        window.tarifadorPreviewData = null;
        document.getElementById('tarifadorFile').value = '';
        document.getElementById('tarifadorFileName').textContent = 'Clique para selecionar o arquivo Excel';
        document.getElementById('tarifadorNome').value = '';
        
        window.initTarifador(); // Recarrega a lista e o cache
        
    } catch (err) {
        console.error("Erro ao salvar tarifador no Supabase:", err);
        alert('Erro ao salvar no banco de dados: ' + err.message);
    } finally {
        btnSalvar.innerHTML = textoOriginal;
        btnSalvar.disabled = false;
    }
};

// 3. BUSCAR LISTA DE TARIFADORES DO SUPABASE
window.carregarListaTarifadores = async function() {
    const tbody = document.getElementById('tbodyTarifadores');
    if(!tbody) return;
    
    tbody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-slate-500"><i class="fas fa-spinner fa-spin mr-2"></i>Buscando dados no servidor...</td></tr>`;
    
    try {
        let query = window.supabaseClient
            .from('tarifadores')
            .select('id, nome, data_importacao, ativo, dados')
            .order('data_importacao', { ascending: false });
            
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);

        const { data: tabelas, error } = await query;
        if (error) throw error;

        tbody.innerHTML = '';
        
        if (!tabelas || tabelas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-slate-500">Nenhuma tabela cadastrada no sistema.</td></tr>`;
            return;
        }

        tabelas.forEach(t => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-700/30 transition-colors";
            
            const dataFormatada = new Date(t.data_importacao).toLocaleDateString('pt-BR');
            const numRegistros = Array.isArray(t.dados) ? t.dados.length : 0;
            
            const statusHtml = t.ativo 
                ? `<span class="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-1 rounded-full border border-emerald-500/30 font-bold"><i class="fas fa-check-circle"></i> ATIVA</span>`
                : `<span class="bg-slate-500/20 text-slate-400 text-[10px] px-2 py-1 rounded-full border border-slate-500/30 font-bold">INATIVA</span>`;
                
            const btnAtivar = !t.ativo 
                ? `<button onclick="window.ativarTarifador('${t.id}')" class="text-sky-400 hover:text-sky-300 text-xs font-bold mr-3"><i class="fas fa-check"></i> Ativar</button>` 
                : '';

            tr.innerHTML = `
                <td class="px-6 py-4 font-bold text-white">${t.nome}</td>
                <td class="px-6 py-4 text-slate-400 text-xs">${dataFormatada}</td>
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
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-rose-500 font-bold">Erro ao buscar tabelas do banco de dados.</td></tr>`;
    }
};

// 4. ATIVAR TARIFADOR
window.ativarTarifador = async function(id) {
    try {
        let queryDesativar = window.supabaseClient.from('tarifadores').update({ ativo: false }).neq('id', '00000000-0000-0000-0000-000000000000');
        if (typeof window.aplicarFiltroFilial === 'function') queryDesativar = window.aplicarFiltroFilial(queryDesativar);
        await queryDesativar;

        await window.supabaseClient.from('tarifadores').update({ ativo: true }).eq('id', id);
        
        window.initTarifador(); // Recarrega lista e cache
    } catch (err) {
        console.error("Erro ao ativar tarifador:", err);
        alert('Erro ao ativar a tabela no banco.');
    }
};

// 5. EXCLUIR TARIFADOR
window.excluirTarifador = async function(id) {
    if(!confirm("Tem certeza que deseja excluir esta tabela do banco de dados?")) return;
    try {
        await window.supabaseClient.from('tarifadores').delete().eq('id', id);
        window.initTarifador(); // Recarrega lista e cache
    } catch (err) {
        console.error("Erro ao excluir tarifador:", err);
        alert('Erro ao excluir a tabela.');
    }
};

// 6. CACHE E CONSULTA IMEDIATA
window.carregarTarifadorAtivoCache = async function() {
    try {
        let query = window.supabaseClient.from('tarifadores').select('nome, dados').eq('ativo', true).limit(1);
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
        
        const { data, error } = await query;
        if (error) throw error;
        
        if (data && data.length > 0) {
            window.tarifadorAtivoCache = data[0];
        } else {
            window.tarifadorAtivoCache = null;
        }
    } catch (err) {
        console.error("Erro ao colocar tarifador ativo em cache:", err);
    }
};

window.consultarTarifa = function() {
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

    if (!window.tarifadorAtivoCache || !window.tarifadorAtivoCache.dados) {
        valorEl.textContent = "R$ 0,00";
        msgEl.textContent = "Nenhuma tabela ativa foi encontrada no sistema.";
        msgEl.className = "text-xs text-rose-400 mt-2";
        return;
    }

    const dados = window.tarifadorAtivoCache.dados;
    const nomeTabela = window.tarifadorAtivoCache.nome;

    // Busca exata
    const exato = dados.find(t => Math.abs(t.asfalto - asfalto) < 0.001 && Math.abs(t.terra - terra) < 0.001);
    
    if (exato) {
        valorEl.textContent = exato.tarifa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        msgEl.textContent = `Encontrado valor exato na tabela "${nomeTabela}"`;
        msgEl.className = "text-xs text-emerald-400 mt-2";
        return;
    }

    // Busca valor mais próximo se não achar o exato
    let maisProximo = null;
    let menorDistancia = Infinity;
    
    dados.forEach(t => {
        const distancia = Math.sqrt(Math.pow(t.asfalto - asfalto, 2) + Math.pow(t.terra - terra, 2));
        if (distancia < menorDistancia) {
            menorDistancia = distancia;
            maisProximo = t;
        }
    });

    if (maisProximo) {
        valorEl.textContent = maisProximo.tarifa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        msgEl.textContent = `Aproximado! Referência mais próxima: Asfalto ${maisProximo.asfalto}km, Terra ${maisProximo.terra}km`;
        msgEl.className = "text-xs text-amber-400 mt-2";
    }
};