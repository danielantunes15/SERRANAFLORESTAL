// ==================== modules/monitoramento/cadastro_up/cadastro_up.js ====================
// MÓDULO DE GESTÃO DE UP E FAZENDAS COM DISTÂNCIAS LOGÍSTICAS (DMT)

let cacheFazendas = [];
let cacheUPs = [];
let cacheUPsPendentes = new Map(); // Armazena as UPs vindas das viagens e suas distâncias

window.initCadastroUP = async function() {
    try {
        await window.carregarDadosCadastroUP();
    } catch (e) {
        console.error("Erro na inicialização do cadastro de UP:", e);
    }
};

window.carregarDadosCadastroUP = async function() {
    const tbody = document.getElementById('tbodyCadastroUp');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding: 20px; text-align: center; color: var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Atualizando dados...</td></tr>`;
    }

    try {
        // 1. Busca as fazendas cadastradas
        const { data: fazendas, error: errFazendas } = await supabaseClient
            .from('monitoramento_fazendas')
            .select('*')
            .order('nome', { ascending: true });

        if (errFazendas) throw errFazendas;
        cacheFazendas = fazendas || [];
        window.atualizarSelectFazendas();

        // 2. Busca as UPs cadastradas
        const { data: ups, error: errUps } = await supabaseClient
            .from('monitoramento_ups')
            .select(`id, codigo, fazenda_id, distancia_asfalto, distancia_terra, dmt_medio`)
            .order('codigo', { ascending: true });

        if (errUps) throw errUps;
        cacheUPs = ups || [];
        
        // Renderiza a tabela agrupada
        window.renderizarTabelaUPs();

        // 3. Varredura nas viagens para popular o SELECT
        await window.carregarUPsPendentes();

    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" style="padding: 20px; text-align: center; color: #ef4444;"><i class="fas fa-exclamation-triangle"></i> Falha ao sincronizar com o banco.</td></tr>`;
        }
    }
};

window.carregarUPsPendentes = async function() {
    const selectUp = document.getElementById('upCodigo');
    if(selectUp) {
        selectUp.innerHTML = '<option value="">Buscando UPs nas viagens...</option>';
    }

    try {
        let dadosViagens = [];
        let start = 0; 
        const step = 2000; 

        while(true) {
            let query = supabaseClient
                .from('historico_viagens')
                .select('up, distanciaAsfalto, distanciaTerra')
                .not('up', 'is', null)
                .neq('up', '')
                .neq('up', '-')
                .neq('up', 'NULL')
                .range(start, start + step - 1);
                
            if (window.currentUser && window.currentUser.filial_id !== null && window.currentUser.filial_id !== 'CENTRAL') {
                query = query.eq('filial_id', window.currentUser.filial_id);
            }

            const { data, error } = await query;
            if(error) break; 
            if(!data || data.length === 0) break;
            
            dadosViagens.push(...data);
            if(data.length < step) break;
            start += step;
        }

        if (dadosViagens.length === 0) {
            let queryFb = supabaseClient.from('historico_viagens').select('*').not('up', 'is', null).neq('up', '-').limit(5000);
            const { data: fbData } = await queryFb;
            if (fbData && fbData.length > 0) dadosViagens = fbData;
        }

        cacheUPsPendentes.clear();

        dadosViagens.forEach(v => {
            const upName = String(v.up || '').trim().toUpperCase();
            if (upName && upName !== '-' && upName !== 'NULL' && upName !== 'OUTRAS' && upName !== 'OUTROS') {
                const asf = parseFloat(v.distanciaAsfalto || v['distanciaAsfalto']) || 0;
                const ter = parseFloat(v.distanciaTerra || v['distanciaTerra']) || 0;

                if (!cacheUPsPendentes.has(upName)) {
                    cacheUPsPendentes.set(upName, { asfalto: asf, terra: ter });
                } else {
                    const current = cacheUPsPendentes.get(upName);
                    if (current.asfalto === 0 && asf > 0) current.asfalto = asf;
                    if (current.terra === 0 && ter > 0) current.terra = ter;
                }
            }
        });

        // ===================================================================================
        // REGRA DE EXCLUSIVIDADE: Remove as UPs que já estão em *qualquer* fazenda
        // Isso impede que elas apareçam novamente no Select (Dropdown)
        // ===================================================================================
        cacheUPs.forEach(upDb => {
            const codigoDb = (upDb.codigo || '').trim().toUpperCase();
            if(cacheUPsPendentes.has(codigoDb)) {
                cacheUPsPendentes.delete(codigoDb);
            }
        });

        if(selectUp) {
            selectUp.innerHTML = '<option value="">Selecione uma UP Pendente...</option>';
            const upsOrdenadas = Array.from(cacheUPsPendentes.keys()).sort();
            
            upsOrdenadas.forEach(upName => {
                const opt = document.createElement('option');
                opt.value = upName;
                opt.textContent = upName;
                selectUp.appendChild(opt);
            });
            
            if(upsOrdenadas.length === 0) {
                selectUp.innerHTML = '<option value="">Nenhuma UP pendente na base.</option>';
            }
        }

    } catch(e) {
        console.error("Erro geral:", e);
        if(selectUp) selectUp.innerHTML = '<option value="">Erro ao buscar UPs</option>';
    }
};

window.preencherDistanciasUP = function() {
    const selectUp = document.getElementById('upCodigo');
    const inputAsfalto = document.getElementById('upDistAsfalto');
    const inputTerra = document.getElementById('upDistTerra');
    
    if(!selectUp || !inputAsfalto || !inputTerra) return;
    
    const upName = selectUp.value;
    
    if(upName && cacheUPsPendentes.has(upName)) {
        const dados = cacheUPsPendentes.get(upName);
        inputAsfalto.value = dados.asfalto.toFixed(2);
        inputTerra.value = dados.terra.toFixed(2);
    } else {
        inputAsfalto.value = '0.00';
        inputTerra.value = '0.00';
    }
    
    window.calcularDmtAutomatico();
};

window.atualizarSelectFazendas = function() {
    const select = document.getElementById('selectUpFazenda');
    if (!select) return;

    select.innerHTML = '<option value="">Selecione uma fazenda...</option>';
    cacheFazendas.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.nome;
        select.appendChild(opt);
    });
};

window.calcularDmtAutomatico = function() {
    const asfaltoInput = document.getElementById('upDistAsfalto');
    const terraInput = document.getElementById('upDistTerra');
    const dmtInput = document.getElementById('upDmtMedio');

    if (!asfaltoInput || !terraInput || !dmtInput) return;

    const asfalto = parseFloat(asfaltoInput.value) || 0;
    const terra = parseFloat(terraInput.value) || 0;
    
    const dmtTotal = asfalto + terra;
    dmtInput.value = dmtTotal.toFixed(2);
};

window.salvarFazenda = async function() {
    const inputNome = document.getElementById('upFazendaNome');
    if (!inputNome) return;

    const nome = inputNome.value.trim();
    if (!nome) { alert("Digite o nome da fazenda."); return; }

    try {
        const { error } = await supabaseClient.from('monitoramento_fazendas').insert([{ nome: nome }]);
        if (error) {
            if (error.code === '23505') alert("Fazenda já cadastrada.");
            else throw error;
            return;
        }

        inputNome.value = '';
        await window.carregarDadosCadastroUP();
    } catch (e) {
        console.error(e); alert("Erro ao salvar a fazenda.");
    }
};

window.salvarUP = async function() {
    const selectFazenda = document.getElementById('selectUpFazenda');
    const selectCodigo = document.getElementById('upCodigo'); 
    const inputAsfalto = document.getElementById('upDistAsfalto');
    const inputTerra = document.getElementById('upDistTerra');
    const inputDmt = document.getElementById('upDmtMedio');

    if (!selectFazenda || !selectCodigo || !inputAsfalto || !inputTerra || !inputDmt) return;

    const fazendaId = selectFazenda.value;
    const codigo = selectCodigo.value.trim().toUpperCase(); 
    const distAsfalto = parseFloat(inputAsfalto.value) || 0;
    const distTerra = parseFloat(inputTerra.value) || 0;
    const dmtMedio = parseFloat(inputDmt.value) || 0;

    if (!fazendaId) { alert("Selecione a fazenda correspondente."); return; }
    if (!codigo) { alert("Selecione a UP na lista."); return; }

    try {
        const { error } = await supabaseClient.from('monitoramento_ups').insert([{
            codigo: codigo, fazenda_id: parseInt(fazendaId), distancia_asfalto: distAsfalto,
            distancia_terra: distTerra, dmt_medio: dmtMedio
        }]);

        if (error) {
            if (error.code === '23505') alert("UP já cadastrada no sistema.");
            else throw error;
            return;
        }

        selectCodigo.value = '';
        inputAsfalto.value = '0.00';
        inputTerra.value = '0.00';
        inputDmt.value = '0.00';
        selectFazenda.value = '';

        await window.carregarDadosCadastroUP();
        
    } catch (e) {
        console.error(e); alert("Erro ao registrar a UP.");
    }
};

window.filtrarTabelaUPs = function() {
    window.renderizarTabelaUPs(); // A renderização já coleta o termo da busca
};

// ===================================================================================
// RENDERIZAÇÃO AGRUPADA: Tabela exibe a Fazenda no Header e as UPs dela em seguida
// ===================================================================================
window.renderizarTabelaUPs = function() {
    const tbody = document.getElementById('tbodyCadastroUp');
    if (!tbody) return;

    const termoBusca = document.getElementById('buscaTabelaUp') ? document.getElementById('buscaTabelaUp').value.toLowerCase().trim() : '';
    tbody.innerHTML = '';

    // Agrupa as UPs pelo ID da fazenda
    const mapUpsFazenda = {};
    cacheUPs.forEach(up => {
        if (!mapUpsFazenda[up.fazenda_id]) mapUpsFazenda[up.fazenda_id] = [];
        mapUpsFazenda[up.fazenda_id].push(up);
    });

    let fazendasRenderizadas = 0;

    cacheFazendas.forEach(faz => {
        const upsDaFazenda = mapUpsFazenda[faz.id] || [];
        
        // Verifica filtro: Se a fazenda bate com a busca ou se alguma UP bate com a busca
        const matchFazenda = faz.nome.toLowerCase().includes(termoBusca);
        let upsFiltradas = upsDaFazenda;

        if (termoBusca && !matchFazenda) {
            upsFiltradas = upsDaFazenda.filter(up => (up.codigo || '').toLowerCase().includes(termoBusca));
            if (upsFiltradas.length === 0) return; // Oculta a fazenda se a busca não bateu em nada nela
        }

        fazendasRenderizadas++;

        // 1. Linha do Cabeçalho da Fazenda
        const trFazenda = document.createElement('tr');
        trFazenda.style.backgroundColor = 'rgba(59, 130, 246, 0.15)'; // Fundo azul translúcido
        trFazenda.style.borderTop = '2px solid rgba(59, 130, 246, 0.3)';
        trFazenda.innerHTML = `
            <td colspan="4" style="padding: 12px; font-weight: bold; color: #fff; font-size: 1.05rem;">
                <i class="fas fa-tractor" style="color: var(--ccol-blue-bright); margin-right: 8px;"></i> ${faz.nome}
            </td>
            <td style="padding: 12px; text-align: center;">
                <button onclick="window.excluirFazenda(${faz.id}, '${faz.nome}')" title="Excluir Fazenda inteira" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px 8px; font-size: 1rem;">
                    <i class="fas fa-trash-alt"></i> Excluir Fazenda
                </button>
            </td>
        `;
        tbody.appendChild(trFazenda);

        // 2. Linhas das UPs daquela Fazenda
        if (upsFiltradas.length === 0) {
            const trVazia = document.createElement('tr');
            trVazia.innerHTML = `<td colspan="5" style="padding: 10px 20px 10px 35px; color: #9ca3af; font-size: 0.85rem; font-style: italic;">Nenhuma UP vinculada.</td>`;
            tbody.appendChild(trVazia);
        } else {
            upsFiltradas.forEach(up => {
                const trUp = document.createElement('tr');
                trUp.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                trUp.innerHTML = `
                    <td style="padding: 10px 10px 10px 35px; font-weight: bold; color: var(--ccol-blue-bright);">↳ ${up.codigo}</td>
                    <td style="padding: 10px; text-align: center; color: #e2e8f0;">${parseFloat(up.distancia_asfalto || 0).toFixed(2)} km</td>
                    <td style="padding: 10px; text-align: center; color: #e2e8f0;">${parseFloat(up.distancia_terra || 0).toFixed(2)} km</td>
                    <td style="padding: 10px; text-align: center; font-weight: bold; color: #fb923c;">${parseFloat(up.dmt_medio || 0).toFixed(2)} km</td>
                    <td style="padding: 10px; text-align: center;">
                        <button onclick="window.excluirUP(${up.id}, '${up.codigo}')" title="Desvincular UP" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px 8px; font-size: 0.9rem;">
                            <i class="fas fa-times"></i> Desvincular
                        </button>
                    </td>
                `;
                tbody.appendChild(trUp);
            });
        }
    });

    if (fazendasRenderizadas === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding: 20px; text-align: center; color: var(--text-secondary);">Nenhum resultado encontrado.</td></tr>`;
    }
};

window.excluirFazenda = async function(id, nome) {
    if (!confirm(`🚨 ATENÇÃO: Deseja realmente EXCLUIR a fazenda "${nome}"?\n\nIsso removerá a fazenda do sistema e soltará todas as UPs que estavam presas a ela (As viagens reais continuarão intactas).`)) return;

    try {
        // Primeiro deleta as UPs vinculadas da tabela de cadastro para não dar erro de chave estrangeira
        await supabaseClient.from('monitoramento_ups').delete().eq('fazenda_id', id);
        // Depois deleta a própria fazenda
        const { error } = await supabaseClient.from('monitoramento_fazendas').delete().eq('id', id);
        
        if (error) throw error;
        await window.carregarDadosCadastroUP();
    } catch (e) {
        console.error(e);
        alert("Erro ao excluir Fazenda.");
    }
};

window.excluirUP = async function(id, codigo) {
    if (!confirm(`Deseja desvincular e remover a UP "${codigo}" desta fazenda?\nEla voltará a ficar disponível para seleção.`)) return;

    try {
        // Deleta a UP apenas do cadastro. Na viagem ela continuará existindo.
        const { error } = await supabaseClient.from('monitoramento_ups').delete().eq('id', id);
        if (error) throw error;
        
        await window.carregarDadosCadastroUP();
    } catch (e) {
        console.error(e);
        alert("Erro ao desvincular UP.");
    }
};