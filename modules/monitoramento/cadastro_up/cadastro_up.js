// ==================== modules/monitoramento/cadastro_up/cadastro_up.js ====================
// MÓDULO DE GESTÃO DE UP E FAZENDAS COM DISTÂNCIAS LOGÍSTICAS (DMT)

let cacheFazendas = [];
let cacheUPs = [];
let cacheUPsPendentes = new Map(); // Armazena as UPs vindas das viagens e suas distâncias

// Adiciona evento global para fechar o dropdown se clicar fora dele
document.addEventListener('click', function(event) {
    const trigger = document.getElementById('dropdownTrigger');
    const menu = document.getElementById('dropdownMenu');
    if (trigger && menu) {
        if (!trigger.contains(event.target) && !menu.contains(event.target)) {
            menu.style.display = 'none';
        }
    }
});

// Função para alternar a exibição do Dropdown customizado
window.toggleDropdownUP = function() {
    const menu = document.getElementById('dropdownMenu');
    if (menu) {
        menu.style.display = (menu.style.display === 'none' || menu.style.display === '') ? 'block' : 'none';
    }
};

// Função auxiliar para resgatar a filial do usuário logado
function obterFilialUsuarioLogadoUP() {
    return (window.currentUser && window.currentUser.filial_id && window.currentUser.filial_id !== 'CENTRAL') 
        ? parseInt(window.currentUser.filial_id) : null;
}

// Funções de formatação idênticas às da Evolução para evitar divergências de leitura
function getCampoUP(obj, possiveisNomes) {
    if (!obj) return '';
    const chavesReais = Object.keys(obj);
    for (let nomeProcurado of possiveisNomes) {
        const chaveEncontrada = chavesReais.find(k => k.toLowerCase() === nomeProcurado.toLowerCase());
        if (chaveEncontrada && obj[chaveEncontrada] !== null && obj[chaveEncontrada] !== undefined) {
            return obj[chaveEncontrada];
        }
    }
    return '';
}

function converterDataExcelUP(dataStr) { 
    if (!dataStr) return new Date(0);
    const str = String(dataStr).trim();
    if(str.includes('T')) return new Date(str);
    if(str.includes('/')) {
        const p = str.split('/');
        if (p.length === 3) return new Date(p[2], parseInt(p[1]) - 1, p[0]);
    }
    if(str.includes('-')) {
        const p = str.split('-');
        if(p.length >= 3) return new Date(p[0], parseInt(p[1]) - 1, p[2].substring(0,2));
    }
    return new Date(str); 
}

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
        const filialLogada = obterFilialUsuarioLogadoUP();

        // INICIA CAMPOS DE DATA COM PADRÃO DE 4 MESES (IDÊNTICO AO MÓDULO DE EVOLUÇÃO)
        const inputInicio = document.getElementById('filtroDataInicialUp');
        const inputFim = document.getElementById('filtroDataFinalUp');
        if (inputInicio && inputFim && !inputInicio.value) {
            const hoje = new Date();
            const dataPassada = new Date(hoje);
            dataPassada.setMonth(dataPassada.getMonth() - 4);
            
            inputInicio.value = dataPassada.toISOString().split('T')[0];
            inputFim.value = hoje.toISOString().split('T')[0];
        }

        // 1. Busca as fazendas cadastradas
        let queryFazendas = supabaseClient
            .from('monitoramento_fazendas')
            .select('*')
            .order('nome', { ascending: true });
            
        if (filialLogada !== null) {
            queryFazendas = queryFazendas.eq('filial_id', filialLogada);
        }

        const { data: fazendas, error: errFazendas } = await queryFazendas;
        if (errFazendas) throw errFazendas;
        cacheFazendas = fazendas || [];
        window.atualizarSelectFazendas();

        // 2. Busca as UPs cadastradas
        let queryUps = supabaseClient
            .from('monitoramento_ups')
            .select(`id, codigo, fazenda_id, distancia_asfalto, distancia_terra, dmt_medio, filial_id`)
            .order('codigo', { ascending: true });

        if (filialLogada !== null) {
            queryUps = queryUps.eq('filial_id', filialLogada);
        }

        const { data: ups, error: errUps } = await queryUps;
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
    const listaDiv = document.getElementById('listaUpsCheckbox');
    if(listaDiv) {
        listaDiv.innerHTML = '<div style="color: #9ca3af; font-size: 0.85rem; font-style: italic; padding: 5px;">Buscando UPs no período selecionado...</div>';
    }

    try {
        const inputInicio = document.getElementById('filtroDataInicialUp');
        const inputFim = document.getElementById('filtroDataFinalUp');
        
        const strInicio = inputInicio ? inputInicio.value : '';
        const strFim = inputFim ? inputFim.value : '';

        // Formatação de data idêntica à Evolução das Fazendas
        let timeInicio = strInicio ? new Date(strInicio.split('-')[0], parseInt(strInicio.split('-')[1]) - 1, strInicio.split('-')[2]).getTime() : 0;
        let timeFim = strFim ? new Date(strFim.split('-')[0], parseInt(strFim.split('-')[1]) - 1, strFim.split('-')[2], 23, 59, 59).getTime() : Infinity;

        let dadosViagens = [];
        let start = 0; 
        const step = 1000; 

        // Remove a trava de filial rígida e usa a função global de filtro, assim como a Evolução faz
        while(true) {
            let query = supabaseClient
                .from('historico_viagens')
                .select('*')
                .range(start, start + step - 1);
                
            if (typeof window.aplicarFiltroLocal === 'function') {
                query = window.aplicarFiltroLocal(query);
            }

            const { data, error } = await query;
            if(error) {
                console.error("Erro na consulta do banco:", error);
                break; 
            }
            if(!data || data.length === 0) break;
            
            const dataFiltrada = data.filter(r => {
                let dataStr = getCampoUP(r, ['dataDaBaseExcel', 'dataLancamento']);
                if (!dataStr || dataStr === '') dataStr = getCampoUP(r, ['created_at']);
                
                const timeV = converterDataExcelUP(dataStr).getTime();
                
                const upName = String(getCampoUP(r, ['up']) || '').trim().toUpperCase();
                if (!upName || upName === '-' || upName === 'NULL' || upName === 'OUTRAS' || upName === 'OUTROS') return false;

                return timeV >= timeInicio && timeV <= timeFim;
            });

            dadosViagens.push(...dataFiltrada);
            
            if(data.length < step) break;
            start += step;
        }

        cacheUPsPendentes.clear();

        dadosViagens.forEach(v => {
            const upName = String(getCampoUP(v, ['up']) || '').trim().toUpperCase();
            
            const asf = parseFloat(getCampoUP(v, ['distanciaAsfalto', 'distanciaasfalto'])) || 0;
            const ter = parseFloat(getCampoUP(v, ['distanciaTerra', 'distanciaterra'])) || 0;

            if (!cacheUPsPendentes.has(upName)) {
                cacheUPsPendentes.set(upName, { asfalto: asf, terra: ter });
            } else {
                const current = cacheUPsPendentes.get(upName);
                if (current.asfalto === 0 && asf > 0) current.asfalto = asf;
                if (current.terra === 0 && ter > 0) current.terra = ter;
            }
        });

        // ===================================================================================
        // REGRA DE EXCLUSIVIDADE: Remove as UPs que já estão em *qualquer* fazenda
        // ===================================================================================
        cacheUPs.forEach(upDb => {
            const codigoDb = (upDb.codigo || '').trim().toUpperCase();
            if(cacheUPsPendentes.has(codigoDb)) {
                cacheUPsPendentes.delete(codigoDb);
            }
        });

        if(listaDiv) {
            listaDiv.innerHTML = ''; 
            const upsOrdenadas = Array.from(cacheUPsPendentes.keys()).sort();
            
            if(upsOrdenadas.length === 0) {
                listaDiv.innerHTML = '<div style="color: #9ca3af; font-size: 0.85rem; font-style: italic; padding: 5px;">Nenhuma UP pendente encontrada no período.</div>';
            } else {
                upsOrdenadas.forEach(upName => {
                    const label = document.createElement('label');
                    label.style.display = 'flex';
                    label.style.alignItems = 'center';
                    label.style.padding = '8px 10px';
                    label.style.marginBottom = '2px';
                    label.style.cursor = 'pointer';
                    label.style.color = '#e2e8f0';
                    label.style.fontSize = '0.9rem';
                    label.style.borderRadius = '4px';
                    label.style.transition = 'background 0.2s';
                    
                    label.onmouseover = () => label.style.background = 'rgba(255,255,255,0.05)';
                    label.onmouseout = () => label.style.background = 'transparent';
                    
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.className = 'up-checkbox';
                    cb.value = upName;
                    cb.style.marginRight = '12px';
                    cb.style.cursor = 'pointer';
                    cb.style.width = '16px';
                    cb.style.height = '16px';
                    cb.onchange = window.preencherDistanciasUP;
                    
                    label.appendChild(cb);
                    label.appendChild(document.createTextNode(upName));
                    
                    listaDiv.appendChild(label);
                });
            }
        }
        
        // Reseta o label ao recarregar
        const dropdownLabel = document.getElementById('dropdownLabel');
        if (dropdownLabel) dropdownLabel.textContent = 'Selecione as UPs...';

    } catch(e) {
        console.error("Erro geral:", e);
        if(listaDiv) listaDiv.innerHTML = '<div style="color: #ef4444; font-size: 0.85rem; font-style: italic; padding: 5px;">Erro ao buscar UPs</div>';
    }
};

window.preencherDistanciasUP = function() {
    const inputAsfalto = document.getElementById('upDistAsfalto');
    const inputTerra = document.getElementById('upDistTerra');
    const inputDmt = document.getElementById('upDmtMedio');
    const dropdownLabel = document.getElementById('dropdownLabel');
    
    if(!inputAsfalto || !inputTerra) return;
    
    const checkboxes = document.querySelectorAll('.up-checkbox:checked');
    const upsSelecionadas = Array.from(checkboxes).map(cb => cb.value);
    
    // Atualiza o texto do botão do Dropdown
    if (dropdownLabel) {
        if (upsSelecionadas.length === 0) {
            dropdownLabel.textContent = 'Selecione as UPs...';
        } else if (upsSelecionadas.length === 1) {
            dropdownLabel.textContent = upsSelecionadas[0];
        } else {
            dropdownLabel.textContent = `${upsSelecionadas.length} UPs selecionadas`;
        }
    }
    
    if (upsSelecionadas.length === 1) {
        const upName = upsSelecionadas[0];
        if(upName && cacheUPsPendentes.has(upName)) {
            const dados = cacheUPsPendentes.get(upName);
            inputAsfalto.value = dados.asfalto.toFixed(2);
            inputTerra.value = dados.terra.toFixed(2);
            if(inputDmt) inputDmt.value = (dados.asfalto + dados.terra).toFixed(2);
        }
    } else if (upsSelecionadas.length > 1) {
        // Múltiplos selecionados: monta o texto de distâncias para cada UP
        let strAsfalto = [];
        let strTerra = [];
        let strDmt = [];
        
        upsSelecionadas.forEach(upName => {
            if(cacheUPsPendentes.has(upName)) {
                const dados = cacheUPsPendentes.get(upName);
                strAsfalto.push(`${upName}: ${dados.asfalto.toFixed(2)}`);
                strTerra.push(`${upName}: ${dados.terra.toFixed(2)}`);
                strDmt.push(`${upName}: ${(dados.asfalto + dados.terra).toFixed(2)}`);
            }
        });
        
        inputAsfalto.value = strAsfalto.join('\n');
        inputTerra.value = strTerra.join('\n');
        if(inputDmt) inputDmt.value = strDmt.join('\n');
        
    } else {
        inputAsfalto.value = '0.00';
        inputTerra.value = '0.00';
        if(inputDmt) inputDmt.value = '0.00';
    }
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
    // Mantido por compatibilidade
};

window.salvarFazenda = async function() {
    const inputNome = document.getElementById('upFazendaNome');
    if (!inputNome) return;

    const nome = inputNome.value.trim();
    if (!nome) { alert("Digite o nome da fazenda."); return; }

    try {
        const filialLogada = obterFilialUsuarioLogadoUP();
        const payload = { nome: nome };
        
        if (filialLogada !== null) {
            payload.filial_id = filialLogada;
        }

        const { error } = await supabaseClient.from('monitoramento_fazendas').insert([payload]);
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
    if (!selectFazenda) return;

    const fazendaId = selectFazenda.value;
    
    const checkboxes = document.querySelectorAll('.up-checkbox:checked');
    const upsSelecionadas = Array.from(checkboxes).map(cb => cb.value.trim().toUpperCase());

    if (!fazendaId) { alert("Selecione a fazenda correspondente."); return; }
    if (upsSelecionadas.length === 0) { alert("Marque pelo menos uma UP na lista."); return; }

    try {
        const filialLogada = obterFilialUsuarioLogadoUP();
        const payloads = [];
        
        for (const codigo of upsSelecionadas) {
            let distAsfalto = 0;
            let distTerra = 0;
            
            if(cacheUPsPendentes.has(codigo)){
                const dados = cacheUPsPendentes.get(codigo);
                distAsfalto = dados.asfalto;
                distTerra = dados.terra;
            }
            
            const dmtMedio = distAsfalto + distTerra;
            
            const payload = {
                codigo: codigo, 
                fazenda_id: parseInt(fazendaId), 
                distancia_asfalto: distAsfalto,
                distancia_terra: distTerra, 
                dmt_medio: dmtMedio
            };
            
            if (filialLogada !== null) {
                payload.filial_id = filialLogada;
            }
            
            payloads.push(payload);
        }

        const { error } = await supabaseClient.from('monitoramento_ups').insert(payloads);

        if (error) {
            if (error.code === '23505') alert("Uma ou mais UPs já estão cadastradas no sistema.");
            else throw error;
            return;
        }

        selectFazenda.value = '';
        
        const dropdownLabel = document.getElementById('dropdownLabel');
        if (dropdownLabel) dropdownLabel.textContent = 'Selecione as UPs...';
        
        const inputAsfalto = document.getElementById('upDistAsfalto');
        const inputTerra = document.getElementById('upDistTerra');
        const inputDmt = document.getElementById('upDmtMedio');
        
        if (inputAsfalto) inputAsfalto.value = '0.00';
        if (inputTerra) inputTerra.value = '0.00';
        if (inputDmt) inputDmt.value = '0.00';

        await window.carregarDadosCadastroUP();
        
    } catch (e) {
        console.error(e); alert("Erro ao registrar a(s) UP(s).");
    }
};

window.filtrarTabelaUPs = function() {
    window.renderizarTabelaUPs();
};

window.renderizarTabelaUPs = function() {
    const tbody = document.getElementById('tbodyCadastroUp');
    if (!tbody) return;

    const termoBusca = document.getElementById('buscaTabelaUp') ? document.getElementById('buscaTabelaUp').value.toLowerCase().trim() : '';
    tbody.innerHTML = '';

    const mapUpsFazenda = {};
    cacheUPs.forEach(up => {
        if (!mapUpsFazenda[up.fazenda_id]) mapUpsFazenda[up.fazenda_id] = [];
        mapUpsFazenda[up.fazenda_id].push(up);
    });

    let fazendasRenderizadas = 0;

    cacheFazendas.forEach(faz => {
        const upsDaFazenda = mapUpsFazenda[faz.id] || [];
        
        const matchFazenda = faz.nome.toLowerCase().includes(termoBusca);
        let upsFiltradas = upsDaFazenda;

        if (termoBusca && !matchFazenda) {
            upsFiltradas = upsDaFazenda.filter(up => (up.codigo || '').toLowerCase().includes(termoBusca));
            if (upsFiltradas.length === 0) return; 
        }

        fazendasRenderizadas++;

        const trFazenda = document.createElement('tr');
        trFazenda.style.backgroundColor = 'rgba(59, 130, 246, 0.15)'; 
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
        await supabaseClient.from('monitoramento_ups').delete().eq('fazenda_id', id);
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
        const { error } = await supabaseClient.from('monitoramento_ups').delete().eq('id', id);
        if (error) throw error;
        
        await window.carregarDadosCadastroUP();
    } catch (e) {
        console.error(e);
        alert("Erro ao desvincular UP.");
    }
};