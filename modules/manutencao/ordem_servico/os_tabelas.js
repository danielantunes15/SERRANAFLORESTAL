// ==================== js/os_tabelas.js ====================
// Módulo responsável pela renderização das tabelas e listas da OS

function renderizarTabelaOS() {
    const tbody = document.getElementById('tabelaAcompanhamentoOS');
    if (!tbody) return;

    const termo = (document.getElementById('searchOS')?.value || '').toLowerCase();
    
    let filtradas = ordensServico.filter(o => o.status !== 'Concluída' && o.tipo !== 'Sinistro');

    if (termo) {
        filtradas = filtradas.filter(o => 
            (o.placa && o.placa.toLowerCase().includes(termo)) ||
            (o.motorista && o.motorista.toLowerCase().includes(termo)) ||
            (o.mecanico_responsavel && o.mecanico_responsavel.toLowerCase().includes(termo))
        );
    }

    tbody.innerHTML = filtradas.map(os => {
        let corStatus = '#f59e0b'; 
        if (os.status === 'Em Manutenção') corStatus = '#3b82f6';
        if (os.status === 'Agendada') corStatus = '#8b5cf6';
        
        const modoIcon = os.status === 'Agendada' ? '📅' : '🔧';
        
        const inicioStr = formatarDataHoraBrasil(os.data_abertura);
        const previsaoStr = os.previsao_entrega ? formatarDataHoraBrasil(os.previsao_entrega) : 'Não definida';

        let isVencida = false;
        if (os.previsao_entrega && os.status !== 'Agendada') {
            const previsao = new Date(os.previsao_entrega.replace('Z', '').replace('+00:00', ''));
            if (new Date() > previsao) isVencida = true;
        }

        const linhaStyle = isVencida ? 'background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444;' : '';
        
        let iconeAtraso = isVencida ? `<span title="⚠️ SERVIÇO EM ATRASO!&#10;A previsão era para ${previsaoStr} e já foi ultrapassada." style="cursor: help; margin-left: 5px; font-size: 1.1rem;">⚠️</span>` : '';
        
        const numeroExibicao = os.numero_os || os.id;
        const mecanicoExibicao = os.mecanico_responsavel ? `<span style="color: #34d399; font-weight: bold;">${os.mecanico_responsavel}</span>` : `<span style="color: #64748b; font-size: 0.8rem; font-weight: normal;">Não atribuído</span>`;

        // Adicionado white-space: nowrap nas colunas que não devem quebrar e os textos dos botões foram reduzidos
        return `
            <tr style="${linhaStyle}">
                <td style="white-space: nowrap;"><strong>#${numeroExibicao}</strong></td>
                <td style="white-space: nowrap;">${modoIcon} ${inicioStr}</td>
                <td style="white-space: nowrap;"><div style="display: flex; align-items: center;">${previsaoStr} ${iconeAtraso}</div></td>
                <td style="color: var(--ccol-blue-bright); font-weight: bold; white-space: nowrap;">${os.placa || '-'}</td>
                <td>${os.motorista || '-'}</td>
                <td>${mecanicoExibicao}</td>
                <td>${os.tipo}</td>
                <td style="white-space: nowrap;"><span style="color: ${corStatus}; font-weight: bold;">${os.status}</span></td>
                <td style="white-space: nowrap;">
                    <div style="display: flex; gap: 6px; flex-wrap: nowrap; justify-content: flex-start; align-items: center;">
                        <button class="btn-primary-blue" onclick="abrirModalServicoExtra(${os.id})" title="Adicionar Serviço e Prorrogar Prazo" style="padding: 6px 10px; font-size: 0.75rem; white-space: nowrap; border-radius: 4px;">➕ Extra</button>
                        <button class="btn-primary-green" onclick="abrirModalConclusaoOS(${os.id})" style="padding: 6px 10px; font-size: 0.75rem; white-space: nowrap; border-radius: 4px;">✅ Concluir</button>
                        <button class="btn-secondary-dark" onclick="abrirVisualizacaoOS(${os.id})" title="Visualizar Detalhes" style="padding: 6px 8px; font-size: 0.8rem; border-radius: 4px;">👁️</button>
                        <button class="btn-secondary-dark" onclick="imprimirOS(${os.id})" title="Imprimir" style="padding: 6px 8px; font-size: 0.8rem; border-radius: 4px;">🖨️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

window.renderizarTabelaSOS = function() {
    const tbody = document.getElementById('tabelaAcompanhamentoSOS');
    if (!tbody) return;

    const termo = (document.getElementById('searchSOS')?.value || '').toLowerCase();
    
    let filtradas = ordensServico.filter(o => o.status !== 'Concluída' && o.tipo && o.tipo.startsWith('S.O.S'));

    if (termo) {
        filtradas = filtradas.filter(o => 
            (o.placa && o.placa.toLowerCase().includes(termo)) ||
            (o.motorista && o.motorista.toLowerCase().includes(termo)) ||
            (o.mecanico_responsavel && o.mecanico_responsavel.toLowerCase().includes(termo))
        );
    }

    tbody.innerHTML = filtradas.map(os => {
        let corStatus = '#f97316'; 
        if (os.status === 'Em Manutenção') corStatus = '#3b82f6';
        
        const inicioStr = formatarDataHoraBrasil(os.data_abertura);
        
        let local = os.localizacao_sos || '';
        let linkMapa = '';
        let ref = '';

        if (local.includes('http')) {
            let partes = local.split(' | Ref: ');
            linkMapa = partes[0].trim();
            ref = partes.length > 1 ? partes[1].trim() : '';
        } else {
            ref = local; 
        }

        let problemaLimpo = os.problema || 'Não detalhado';
        if (problemaLimpo !== 'Não detalhado') {
            problemaLimpo = problemaLimpo.replace(/\[?LINK S\.O\.S MAPS:.*?\]?\n?/gi, '');
            problemaLimpo = problemaLimpo.replace(/https?:\/\/[^\s]+/g, '');
            problemaLimpo = problemaLimpo.replace(/📍\s*Localização GPS:?/gi, '');
            problemaLimpo = problemaLimpo.replace(/📍\s*Abrir Rota no GPS \(Maps\):?/gi, '');
            problemaLimpo = problemaLimpo.replace(/Localização:/gi, '');
            problemaLimpo = problemaLimpo.trim();
        }

        const numeroExibicao = os.numero_os || os.id;
        const mecanicoExibicao = os.mecanico_responsavel ? `<span style="color: #34d399; font-weight: bold;">${os.mecanico_responsavel}</span>` : `<span style="color: #64748b; font-size: 0.8rem; font-weight: normal;">Não atribuído</span>`;

        let mensagemZap = `🚨 *NOVO CHAMADO DE S.O.S* 🚨\n`;
        mensagemZap += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
        mensagemZap += `📄 *O.S. Número:* #${numeroExibicao}\n`;
        mensagemZap += `🚚 *Placa (Conjunto):* ${os.placa || 'Não informada'}\n`;
        mensagemZap += `👤 *Motorista:* ${os.motorista || 'Não informado'}\n`;
        mensagemZap += `⏱️ *Horário Abertura:* ${inicioStr}\n`;
        mensagemZap += `⚠️ *Tipo:* ${os.tipo || 'S.O.S'}\n`;
        mensagemZap += `🚥 *Status Inicial:* ${os.status || 'Aberto'}\n`;
        
        if (os.prioridade) mensagemZap += `🔥 *Prioridade:* ${os.prioridade}\n`;
        if (os.hodometro) mensagemZap += `🛣️ *Hodômetro/Horímetro:* ${os.hodometro}\n`;
        
        mensagemZap += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
        mensagemZap += `🔧 *Problema Relatado / Descrição do Sinistro:*\n${problemaLimpo || 'Não detalhado'}\n`;
        
        if (os.observacoes && os.observacoes.trim() !== '') {
            mensagemZap += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
            mensagemZap += `📝 *Observações da O.S:*\n${os.observacoes}\n`;
        }

        mensagemZap += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
        if (ref) {
            mensagemZap += `📌 *Ponto de Referência / Local:*\n${ref}\n\n`;
        } else {
            mensagemZap += `📌 *Ponto de Referência:*\nNão informado\n\n`;
        }
        
        if (linkMapa) {
            mensagemZap += `📍 *Abrir Rota no GPS (Maps):*\n${linkMapa}`;
        } else {
            mensagemZap += `📍 *Localização GPS:*\nSem link cadastrado`;
        }

        const urlZap = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(mensagemZap);

        let btnMapa = linkMapa ? `<a href="${linkMapa}" target="_blank" class="btn-primary-blue" style="padding: 6px 12px; font-size: 0.8rem; text-decoration: none; border-radius: 4px; display: inline-flex; align-items: center; gap: 5px; margin-top: 5px;"><i class="fas fa-map-marked-alt"></i> Ver Mapa</a>` : `<span style="font-size: 0.8rem; color: #9ca3af;"><br>📍 Sem Mapa</span>`;

        return `
            <tr style="background: rgba(249, 115, 22, 0.05); border-left: 4px solid #f97316;">
                <td style="white-space: nowrap;"><strong>#${numeroExibicao}</strong></td>
                <td style="white-space: nowrap;">🚨 ${inicioStr}</td>
                <td style="color: #f97316; font-weight: bold; font-size: 1.1rem; white-space: nowrap;">${os.placa || '-'}</td>
                <td>${os.motorista || '-'}</td>
                <td>${mecanicoExibicao}</td>
                <td style="font-weight: bold;">${os.tipo}</td>
                <td style="font-size: 0.85rem;">
                    <div style="margin-bottom: 5px; color: #d1d5db;">${ref ? '<strong>Ref:</strong> ' + ref : (linkMapa ? 'Localização informada' : 'Sem local')}</div>
                    ${btnMapa}
                </td>
                <td style="white-space: nowrap;"><span style="color: ${corStatus}; font-weight: bold;">${os.status}</span></td>
                <td style="white-space: nowrap;">
                    <div style="display: flex; gap: 6px; flex-wrap: nowrap; justify-content: flex-start; align-items: center;">
                        <a href="${urlZap}" target="_blank" class="btn-primary-green" style="padding: 6px 10px; font-size: 0.75rem; text-decoration: none; border-radius: 4px; display: inline-flex; align-items: center; gap: 5px; background-color: #22c55e; white-space: nowrap;"><i class="fab fa-whatsapp"></i> Enviar</a>
                        <button class="btn-primary-blue" onclick="abrirModalConclusaoOS(${os.id})" style="padding: 6px 10px; font-size: 0.75rem; border-radius: 4px; white-space: nowrap;">✅ Finalizar</button>
                        <button class="btn-secondary-dark" onclick="abrirVisualizacaoOS(${os.id})" title="Visualizar Detalhes" style="padding: 6px 8px; font-size: 0.8rem; border-radius: 4px;">👁️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

function renderizarTabelaSinistro() {
    const tbody = document.getElementById('tabelaAcompanhamentoSinistro');
    if (!tbody) return;

    const termo = (document.getElementById('searchSinistro')?.value || '').toLowerCase();
    let filtradas = ordensServico.filter(o => o.status !== 'Concluída' && (o.tipo === 'Sinistro' || o.status === 'Sinistrado'));

    if (termo) {
        filtradas = filtradas.filter(o => 
            (o.placa && o.placa.toLowerCase().includes(termo)) ||
            (o.motorista && o.motorista.toLowerCase().includes(termo)) ||
            (o.mecanico_responsavel && o.mecanico_responsavel.toLowerCase().includes(termo))
        );
    }

    tbody.innerHTML = filtradas.map(os => {
        let corStatus = '#ef4444'; 
        const inicioStr = formatarDataHoraBrasil(os.data_abertura);
        const previsaoStr = os.previsao_entrega ? formatarDataHoraBrasil(os.previsao_entrega) : 'Indeterminada';
        
        const numeroExibicao = os.numero_os || os.id;
        const mecanicoExibicao = os.mecanico_responsavel ? `<span style="color: #34d399; font-weight: bold;">${os.mecanico_responsavel}</span>` : `<span style="color: #64748b; font-size: 0.8rem; font-weight: normal;">Não atribuído</span>`;
        
        let isVencida = false;
        if (os.previsao_entrega) {
            const previsao = new Date(os.previsao_entrega.replace('Z', '').replace('+00:00', ''));
            if (new Date() > previsao) isVencida = true;
        }
        
        let iconeAtraso = isVencida ? `<span title="⚠️ PREVISÃO ATRASADA!&#10;A data esperada de retorno era ${previsaoStr} e já passou." style="cursor: help; margin-left: 5px; font-size: 1.1rem;">⚠️</span>` : '';

        return `
            <tr style="background: rgba(239, 68, 68, 0.05); border-left: 4px solid #ef4444;">
                <td style="white-space: nowrap;"><strong>#${numeroExibicao}</strong></td>
                <td style="white-space: nowrap;">💥 ${inicioStr}</td>
                <td style="white-space: nowrap;"><div style="display: flex; align-items: center;">${previsaoStr} ${iconeAtraso}</div></td>
                <td style="color: #ef4444; font-weight: bold; font-size: 1.1rem; white-space: nowrap;">${os.placa || '-'}</td>
                <td>${os.motorista || '-'}</td>
                <td>${mecanicoExibicao}</td>
                <td style="font-size: 0.85rem; color: #fca5a5;">${os.problema || 'Sinistro Reportado'}</td>
                <td style="white-space: nowrap;"><span style="color: ${corStatus}; font-weight: bold; text-transform: uppercase;">Inativo (Sinistro)</span></td>
                <td style="white-space: nowrap;">
                    <div style="display: flex; gap: 6px; flex-wrap: nowrap; justify-content: flex-start; align-items: center;">
                        <button class="btn-primary-blue" onclick="abrirModalServicoExtra(${os.id})" title="Atualizar Previsão" style="padding: 6px 10px; font-size: 0.75rem; white-space: nowrap; border-radius: 4px;">📅 Previsão</button>
                        <button class="btn-primary-green" onclick="abrirModalConclusaoOS(${os.id})" style="padding: 6px 10px; font-size: 0.75rem; white-space: nowrap; border-radius: 4px;">✅ Retorno</button>
                        <button class="btn-secondary-dark" onclick="abrirVisualizacaoOS(${os.id})" title="Visualizar Detalhes" style="padding: 6px 8px; font-size: 0.8rem; border-radius: 4px;">👁️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ====== FUNÇÃO DE VISUALIZAÇÃO COM O ERRO 400 CORRIGIDO ======
window.abrirVisualizacaoOS = async function(id) {
    const os = ordensServico.find(o => o.id === id);
    if (!os) return;

    const inputVisOsId = document.getElementById('visOSId');
    if (!inputVisOsId) {
        alert("⚠️ ATUALIZAÇÃO DETECTADA!\n\nSeu navegador está utilizando uma versão antiga desta tela.\nPor favor, aperte as teclas [ CTRL + F5 ] simultaneamente para carregar a versão mais recente do sistema.");
        return; 
    }

    inputVisOsId.value = os.id;
    document.getElementById('visOSNum').innerText = '#' + (os.numero_os || os.id);
    
    let corStatus = '#f59e0b';
    if (os.status === 'Concluída') corStatus = 'var(--ccol-green-bright)';
    if (os.status === 'Em Manutenção') corStatus = '#3b82f6';
    if (os.status === 'Sinistrado' || os.tipo === 'Sinistro') corStatus = '#ef4444';
    
    const statusEl = document.getElementById('visOSStatus');
    statusEl.innerText = os.status;
    statusEl.style.color = corStatus;

    document.getElementById('visOSPlaca').innerText = os.placa || '-';
    document.getElementById('visOSAbertura').innerText = formatarDataHoraBrasil(os.data_abertura);
    document.getElementById('visOSConclusao').innerText = os.data_conclusao ? formatarDataHoraBrasil(os.data_conclusao) : 'Em Andamento';
    
    document.getElementById('visOSMotorista').innerText = os.motorista || '-';
    // Mostra o Mecânico no modal de detalhes também
    document.getElementById('visOSMecanico').innerText = os.mecanico_responsavel || 'Não atribuído';
    document.getElementById('visOSTipo').innerText = os.tipo || '-';
    
    let prioridadeBadge = `<span style="background: rgba(255,255,255,0.1); padding: 3px 8px; border-radius: 4px; font-size: 0.85rem;">${os.prioridade || 'Normal'}</span>`;
    if(os.prioridade === 'Urgente') prioridadeBadge = `<span style="background: #ef4444; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: bold;">Urgente</span>`;
    if(os.prioridade === 'Alta') prioridadeBadge = `<span style="background: #f97316; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: bold;">Alta</span>`;
    document.getElementById('visOSPrioridade').innerHTML = prioridadeBadge;
    
    document.getElementById('visOSHodometro').innerText = os.hodometro || '-';
    
    let problemaFormatado = os.problema || 'Nenhum problema relatado.';
    problemaFormatado = problemaFormatado.replace(/\n/g, '<br>');
    document.getElementById('visOSProblema').innerHTML = problemaFormatado;

    let obsFormatada = os.observacoes || 'Nenhuma observação extra informada.';
    obsFormatada = obsFormatada.replace(/\n/g, '<br>');
    document.getElementById('visOSObservacoes').innerHTML = obsFormatada;

    document.getElementById('modalVisualizarOS').style.display = 'flex';

    const servicosContainer = document.getElementById('visOSServicosList');
    const pecasContainer = document.getElementById('visOSPecasList');
    
    servicosContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Buscando serviços...</div>';
    pecasContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Buscando peças...</div>';

    try {
        const resServ = await window.supabaseClient.from('os_servicos_executados').select('*').eq('os_id', os.id).order('id');
        if (resServ.data && resServ.data.length > 0) {
            servicosContainer.innerHTML = resServ.data.map(s => `
                <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); font-size: 0.9rem;">
                    <i class="fas fa-check" style="color: var(--ccol-blue-bright); margin-right: 5px;"></i> ${s.descricao}
                </div>
            `).join('');
        } else {
            servicosContainer.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.9rem; text-align: center; padding: 10px;">Nenhum serviço apontado nesta O.S.</div>';
        }

        // BUSCA SEM O JOIN NO SUPABASE (PREVINE O ERRO 400)
        const resPecas = await window.supabaseClient.from('os_pecas_utilizadas').select('*').eq('os_id', os.id).order('id');
        if (resPecas.data && resPecas.data.length > 0) {
            pecasContainer.innerHTML = resPecas.data.map(p => {
                const pecaDb = (window.pecasAlmoxarifadoCache || []).find(x => x.id == p.peca_id);
                const nomePeca = pecaDb ? pecaDb.nome : 'Peça Indisponível';
                const unidadePeca = pecaDb ? pecaDb.unidade : 'UN';
                const compartimento = p.compartimento || 'GERAL';
                
                let corStatusPeca = '#f59e0b';
                if(p.status === 'Aprovado') corStatusPeca = '#10b981';
                else if (p.status === 'Recusado') corStatusPeca = '#ef4444';

                return `
                    <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); font-size: 0.9rem; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                        <div style="flex: 1;">
                            <span style="color: var(--ccol-green-bright); font-weight: bold; font-size: 0.8rem;">[${compartimento}]</span><br>
                            ${nomePeca}
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end;">
                            <div style="font-weight: bold; font-size: 1.1rem; color: #fff; background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px;">
                                ${p.quantidade} ${unidadePeca}
                            </div>
                            <span style="font-size: 0.7rem; color: ${corStatusPeca}; font-weight: bold; margin-top: 3px; text-transform: uppercase;">${p.status || 'Pendente'}</span>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            pecasContainer.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.9rem; text-align: center; padding: 10px;">Nenhuma requisição de peça vinculada.</div>';
        }
    } catch (e) {
        console.error('Erro ao buscar detalhes adicionais da OS:', e);
        servicosContainer.innerHTML = '<div style="color: #ef4444; font-size: 0.9rem;">Erro ao carregar serviços executados.</div>';
        pecasContainer.innerHTML = '<div style="color: #ef4444; font-size: 0.9rem;">Erro ao carregar peças requisitadas.</div>';
    }
};

window.fecharVisualizacaoOS = function() {
    document.getElementById('modalVisualizarOS').style.display = 'none';
};

function renderizarTabelaFrotaManutencao() {
    const tbody = document.getElementById('tabelaFrotaManutencao');
    if (!tbody) return;
    tbody.innerHTML = frotasManutencao.map(f => `
        <tr>
            <td style="font-weight: bold; color: var(--ccol-blue-bright);">${f.cavalo}</td>
            <td style="text-transform: capitalize;">${f.cor || '-'}</td>
            <td>${f.go || '-'}</td>
            <td>${f.carreta1 || '-'}</td>
            <td>${f.carreta2 || '-'}</td>
            <td>${f.carreta3 || '-'}</td>
            <td>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button onclick="abrirModalTransferenciaFrota(${f.id})" style="background:transparent; border:none; color:var(--ccol-green-bright); cursor:pointer; font-size: 1.2rem;" title="Transferir Carretas/GO">🔄</button>
                    <button onclick="editarFrotaManutencao(${f.id})" style="background:transparent; border:none; color:var(--ccol-blue-bright); cursor:pointer; font-size: 1.2rem;" title="Editar">✏️</button>
                    <button onclick="excluirFrotaManutencao(${f.id})" style="background:transparent; border:none; color:#ef4444; cursor:pointer; font-size: 1.2rem;" title="Excluir">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
}