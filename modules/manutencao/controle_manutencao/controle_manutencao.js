// ==================== modules/manutencao/controle_manutencao/controle_manutencao.js ====================

window.veiculosRevisaoDb = [];
window.veiculosRevisaoFiltrados = [];
window.abaAtivaManutencao = 'lista';
window.paradasProgramadas = []; 

window.obterFilialUsuarioLogadoRev = function() {
    return (window.currentUser && window.currentUser.filial_id && window.currentUser.filial_id !== 'CENTRAL') 
        ? parseInt(window.currentUser.filial_id) : null;
};

// Função global de formatação para evitar o erro de minutos cortados (ex: 11:1)
window.formatarDataHoraCerta = function(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

window.initControleManutencao = async function() {
    console.log("Módulo Central de Manutenção Inicializado.");
    const elPlaca = document.getElementById('filtroPlacaRevisao');
    const elStatus = document.getElementById('filtroStatusRevisao');
    if (elPlaca) elPlaca.value = '';
    if (elStatus) elStatus.value = '';

    await window.carregarVeiculosManutencao(true);
};

window.carregarVeiculosManutencao = async function(forcarSincronizacao = false) {
    const filialId = window.obterFilialUsuarioLogadoRev();
    
    try {
        const tbody = document.getElementById('tbControleRevisoes');
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Sincronizando dados e montando inteligência...</td></tr>`;

        if (forcarSincronizacao) {
            await window.sincronizarComPlanilhaGoogle();
        }

        // CARREGA AS PARADAS PROGRAMADAS PENDENTES
        let queryParadas = window.supabaseClient.from('manutencao_paradas_programadas').select('*').eq('status', 'Pendente');
        if (filialId !== null) queryParadas = queryParadas.eq('filial_id', filialId);
        const { data: paradas } = await queryParadas;
        window.paradasProgramadas = paradas || [];

        let queryFrotas = window.supabaseClient.from('frotas_manutencao').select('*');
        if (filialId !== null) queryFrotas = queryFrotas.eq('filial_id', filialId);
        const { data: frotas, error: errFrota } = await queryFrotas;
        if (errFrota) throw errFrota;

        const veiculosFiltrados = (frotas || []).filter(v => {
            const cat = String(v.categoria || '').toUpperCase();
            const status = String(v.status || '').toUpperCase();
            return (cat.includes('TRITREM') || cat.includes('GRUA')) && status !== 'INATIVO';
        });

        let queryRevisoes = window.supabaseClient.from('manutencao_revisoes').select('*');
        if (filialId !== null) queryRevisoes = queryRevisoes.eq('filial_id', filialId);
        const { data: revisoes, error: errRev } = await queryRevisoes;
        if (errRev) throw errRev;

        window.veiculosRevisaoDb = veiculosFiltrados.map(frota => {
            const placaPrincipal = frota.cavalo || frota.go || 'N/A';
            const frotaNum = frota.numero_frota || frota.go || 'N/A';
            const tipoVeiculo = frota.categoria || 'N/A';
            const rev = revisoes.find(r => r.placa === placaPrincipal || r.numero_frota === frotaNum) || {};
            
            let compartimentos = [];
            if(frota.carreta1) compartimentos.push(frota.carreta1);
            if(frota.carreta2) compartimentos.push(frota.carreta2);
            if(frota.carreta3) compartimentos.push(frota.carreta3);

            let kmAtual = parseInt(rev.km_atual) || 0;
            let kmUltima = parseInt(rev.km_ultima_revisao) || 0;
            let kmProxima = parseInt(rev.km_proxima_revisao) || 0;
            
            let scoreRisco = 0;
            let distTotal = kmProxima - kmUltima;
            let distPercorrida = kmAtual - kmUltima;
            if (distTotal > 0) {
                scoreRisco = Math.round((distPercorrida / distTotal) * 100);
            }
            if (kmProxima === 0) scoreRisco = -1;

            let prevDias = null;
            let isGrua = tipoVeiculo.toUpperCase().includes('GRUA');
            if (kmProxima > kmAtual) {
                let rest = kmProxima - kmAtual;
                prevDias = Math.round(rest / (isGrua ? 15 : 300));
            } else if (kmProxima > 0) {
                prevDias = 0; 
            }

            return {
                id: frota.id,
                placa: placaPrincipal,
                numero_frota: frotaNum,
                tipo: tipoVeiculo,
                compartimentos: compartimentos.length > 0 ? compartimentos.join(' / ') : 'Sem compartimentos atrelados',
                data_ultima_revisao: rev.data_ultima_revisao || null,
                km_atual: kmAtual,
                km_ultima_revisao: kmUltima,
                km_proxima_revisao: kmProxima,
                score_risco: scoreRisco,
                previsao_dias: prevDias,
                detalhes_ultima_revisao: rev.detalhes_ultima_revisao || '',
                data_inspecao: rev.data_inspecao || null,
                data_proxima_inspecao: rev.data_proxima_inspecao || null,
                data_revisao_eletromecanica: rev.data_revisao_eletromecanica || null,
                data_inspecao_eletromecanica: rev.data_inspecao_eletromecanica || null,
                quantidade_revisoes: parseInt(rev.quantidade_revisoes) || 0
            };
        });

        window.filtrarRevisoesManutencao();
    } catch (e) {
        console.error("Erro ao carregar:", e);
        const tbody = document.getElementById('tbControleRevisoes');
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: #ef4444;"><i class="fas fa-exclamation-triangle"></i> Erro ao buscar dados. Tente novamente.</td></tr>`;
    }
};

window.determinarStatusRevisao = function(v) {
    if (v.score_risco === -1) return { status: 'Não Configurado', cor: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)', icon: 'fas fa-question-circle', classStatus: '' };
    if (v.score_risco >= 100) return { status: 'Atrasada', cor: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', icon: 'fas fa-times-circle', classStatus: 'critical' };
    if (v.score_risco >= 85) return { status: 'Atenção', cor: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', icon: 'fas fa-exclamation-triangle', classStatus: 'warning' };
    return { status: 'Em Dia', cor: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', icon: 'fas fa-check-circle', classStatus: 'good' };
};

window.filtrarRevisoesManutencao = function() {
    const termo = (document.getElementById('filtroPlacaRevisao')?.value || '').toLowerCase().trim();
    const statusDesejado = document.getElementById('filtroStatusRevisao')?.value || '';
    const categoriaDesejada = document.getElementById('filtroCategoriaRevisao')?.value || 'TODAS';

    window.veiculosRevisaoFiltrados = window.veiculosRevisaoDb.filter(v => {
        const matchBusca = (v.placa && v.placa.toLowerCase().includes(termo)) || 
                           (v.numero_frota && v.numero_frota.toLowerCase().includes(termo)) ||
                           (v.compartimentos && v.compartimentos.toLowerCase().includes(termo));
        
        const infoStatus = window.determinarStatusRevisao(v);
        const matchStatus = statusDesejado === '' || infoStatus.status === statusDesejado;
        const matchCategoria = categoriaDesejada === 'TODAS' || (v.tipo && v.tipo.toUpperCase().includes(categoriaDesejada));

        return matchBusca && matchStatus && matchCategoria;
    });

    window.renderizarControleManutencao();
};

window.gerarBadgeStatusVeiculo = function(placa) {
    const parada = (window.paradasProgramadas || []).find(p => p.placa === placa && p.status === 'Pendente');
    
    let btnAcao = '';
    if (parada) {
        const dataFmt = window.formatarDataHoraCerta(parada.data_programada);
        btnAcao = `<button class="btn-primary-blue input-compacto" style="margin-top: 6px; width: 100%; border-radius: 6px;" onclick="window.abrirModalParadasProgramadas()"><i class="fas fa-clock"></i> Parada: ${dataFmt}</button>`;
    } else {
        btnAcao = `<button class="btn-secondary-dark input-compacto" style="margin-top: 6px; width: 100%; border-color: #f59e0b; color: #f59e0b; border-radius: 6px;" onclick="window.abrirModalAgendarParada('${placa}')"><i class="fas fa-hand-paper"></i> Solicitar Parada</button>`;
    }

    if (typeof window.ordensServico === 'undefined' || !window.ordensServico) {
        return `
            <div class="veiculo-info-status" style="margin-top: 8px;">
                <span class="badge-status-rev" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); text-transform: none; font-size: 0.8rem; width: 100%; justify-content: center;">
                    <i class="fas fa-truck-moving"></i> Em Operação
                </span>
                ${btnAcao}
            </div>`;
    }

    const osAberta = window.ordensServico.find(o => 
        (o.placa === placa || o.go === placa) && 
        o.status !== 'Concluída' && 
        o.status !== 'Agendada'
    );

    if (!osAberta) {
        return `
            <div class="veiculo-info-status" style="margin-top: 8px;">
                <span class="badge-status-rev" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); text-transform: none; font-size: 0.8rem; width: 100%; justify-content: center;">
                    <i class="fas fa-truck-moving"></i> Em Operação
                </span>
                ${btnAcao}
            </div>`;
    }

    let tempoStr = '';
    if (osAberta.data_abertura) {
        let inicioStr = String(osAberta.data_abertura);
        if (!inicioStr.includes('T')) inicioStr += 'T00:00:00';
        const inicio = new Date(inicioStr.replace('Z', '').replace('+00:00', ''));
        const agora = new Date();
        
        const diffMs = agora - inicio;
        if (diffMs > 0) {
            const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMin = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            
            if (diffHrs > 24) {
                const dias = Math.floor(diffHrs / 24);
                tempoStr = `${dias}d ${diffHrs % 24}h`;
            } else {
                tempoStr = `${diffHrs}h ${diffMin}m`;
            }
        }
    }

    const tipoServico = osAberta.tipo || 'Manutenção';
    const statusOS = osAberta.status || 'Oficina';
    
    let corBg = 'rgba(245, 158, 11, 0.15)'; 
    let corBorda = 'rgba(245, 158, 11, 0.4)';
    let corTexto = '#fbbf24'; 
    let icone = 'fa-tools';

    if (osAberta.tipo === 'Sinistro' || osAberta.status === 'Sinistrado') {
        corBg = 'rgba(239, 68, 68, 0.15)'; 
        corBorda = 'rgba(239, 68, 68, 0.4)';
        corTexto = '#f87171';
        icone = 'fa-car-crash';
    } else if (osAberta.status === 'Em Manutenção') {
        corBg = 'rgba(59, 130, 246, 0.15)'; 
        corBorda = 'rgba(59, 130, 246, 0.4)';
        corTexto = '#60a5fa';
        icone = 'fa-wrench';
    }

    return `
        <div class="veiculo-info-status" style="margin-top: 8px;">
            <span class="badge-status-rev" style="background: ${corBg}; color: ${corTexto}; border: 1px solid ${corBorda}; font-size: 0.8rem; text-transform: none; width: 100%; justify-content: center;">
                <i class="fas ${icone}"></i> ${statusOS}: ${tipoServico} (Há ${tempoStr})
            </span>
        </div>`;
};

window.renderizarControleManutencao = function() {
    const tbody = document.getElementById('tbControleRevisoes');
    if (!tbody) return;

    let totMonitorados = window.veiculosRevisaoDb.length;
    let totDia = 0, totAtencao = 0, totAtrasada = 0;

    window.veiculosRevisaoDb.forEach(v => {
        const info = window.determinarStatusRevisao(v);
        if (info.status === 'Em Dia') totDia++;
        else if (info.status === 'Atenção') totAtencao++;
        else if (info.status === 'Atrasada') totAtrasada++;
    });

    if(document.getElementById('totRevMonitorados')) document.getElementById('totRevMonitorados').innerText = totMonitorados;
    if(document.getElementById('totRevEmDia')) document.getElementById('totRevEmDia').innerText = totDia;
    if(document.getElementById('totRevAtencao')) document.getElementById('totRevAtencao').innerText = totAtencao;
    if(document.getElementById('totRevAtrasadas')) document.getElementById('totRevAtrasadas').innerText = totAtrasada;

    tbody.innerHTML = '';

    if (window.veiculosRevisaoFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-secondary);">Nenhum veículo corresponde aos filtros aplicados.</td></tr>`;
        return;
    }

    const gruposCategoria = {};
    window.veiculosRevisaoFiltrados.forEach(v => {
        const cat = String(v.tipo || 'OUTROS').toUpperCase();
        if (!gruposCategoria[cat]) gruposCategoria[cat] = [];
        gruposCategoria[cat].push(v);
    });

    const formatData = (d) => {
        if (!d) return '--/--/----';
        const p = d.split('-');
        if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
        return d;
    };

    Object.keys(gruposCategoria).sort((a, b) => a.localeCompare(b)).forEach(categoria => {
        const veiculosDoGrupo = gruposCategoria[categoria];
        const isGrua = categoria.includes('GRUA');
        const s_und = isGrua ? 'h' : 'km';

        veiculosDoGrupo.sort((a, b) => {
            if (b.score_risco !== a.score_risco) return b.score_risco - a.score_risco;
            return (a.placa || '').localeCompare((b.placa || ''), undefined, { numeric: true });
        });

        const trHeader = document.createElement('tr');
        trHeader.innerHTML = `
            <td colspan="7" style="text-align: left; background: rgba(59, 130, 246, 0.1); color: var(--ccol-blue-bright); font-weight: bold; padding: 12px 20px; border-top: 2px solid rgba(59, 130, 246, 0.3); border-bottom: 2px solid rgba(59, 130, 246, 0.3); font-size: 1.1rem; letter-spacing: 1px;">
                <i class="fas fa-layer-group"></i> CATEGORIA: ${categoria} <span style="font-size: 0.85rem; color: var(--text-secondary); margin-left: 10px;">(${veiculosDoGrupo.length} equipamentos)</span>
            </td>
        `;
        tbody.appendChild(trHeader);

        veiculosDoGrupo.forEach(v => {
            const info = window.determinarStatusRevisao(v);
            const isTritrem = String(v.tipo).toUpperCase().includes('TRITREM');
            
            let idVeiculoHtml = `
                <div style="font-weight: 800; color: #fff; font-size: 1.2rem; letter-spacing: 1px; cursor: pointer; text-decoration: underline; text-decoration-color: var(--text-secondary);" onclick="window.abrirPainelHistorico('${v.placa}')" title="Ver Histórico">${v.placa}</div>
                <div style="color: var(--ccol-blue-bright); font-size: 0.85rem; font-weight: bold;">Frota: ${v.numero_frota}</div>
                ${!isGrua ? `<div style="color: var(--text-secondary); font-size: 0.75rem; margin-top: 3px;"><i class="fas fa-link"></i> ${v.compartimentos}</div>` : ''}
            `;

            let pct = v.score_risco > 100 ? 100 : (v.score_risco < 0 ? 0 : v.score_risco);
            let prevText = v.previsao_dias !== null 
                ? (v.previsao_dias <= 0 ? '<span style="color:#ef4444;">Venceu</span>' : `Vence em ~${v.previsao_dias} dias`)
                : '';

            let progressHtml = `
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 2px;">
                    <span style="color: var(--text-secondary);">Última: <strong style="color:#fff;">${v.km_ultima_revisao.toLocaleString('pt-BR')}</strong></span>
                    <span style="color: var(--ccol-blue-bright);">Atual: <strong>${v.km_atual.toLocaleString('pt-BR')}</strong></span>
                    <span style="color: var(--text-secondary);">Próxima: <strong style="color:#fff;">${v.km_proxima_revisao.toLocaleString('pt-BR')}</strong></span>
                </div>
                <div class="km-progress-bg">
                    <div class="km-progress-fill" style="width: ${pct}%; background-color: ${info.cor};"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-top: 3px; font-weight: bold;">
                    <span style="color: ${info.cor};">${v.score_risco < 0 ? 'Meta não definida' : (v.km_proxima_revisao - v.km_atual) + ` ${s_und} restantes`}</span>
                    <span style="color: var(--text-secondary);">${prevText}</span>
                </div>
            `;

            let datasHtml = '<span style="color: var(--text-secondary); font-size: 0.8rem;">Não aplicável</span>';
            let qtdRevisoesHtml = '<span style="color: var(--text-secondary); font-size: 0.8rem;">-</span>';

            if (isTritrem) {
                let alertaDiasHtml = '';
                if (v.data_proxima_inspecao) {
                    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
                    const [ano, mes, dia] = v.data_proxima_inspecao.split('-');
                    const dataProx = new Date(ano, mes - 1, dia); dataProx.setHours(0, 0, 0, 0);
                    const diffDays = Math.round((dataProx.getTime() - hoje.getTime()) / (1000 * 3600 * 24));

                    if (diffDays < 0) alertaDiasHtml = `<span style="color: #ef4444; font-weight: bold;"><i class="fas fa-exclamation-circle"></i> Atrasado ${Math.abs(diffDays)} dia(s)</span>`;
                    else if (diffDays === 0) alertaDiasHtml = `<span style="color: #ef4444; font-weight: bold;"><i class="fas fa-exclamation-triangle"></i> Vence HOJE</span>`;
                    else if (diffDays <= 5) alertaDiasHtml = `<span style="color: #f59e0b; font-weight: bold;"><i class="fas fa-clock"></i> Vence em ${diffDays} dia(s)</span>`;
                    else alertaDiasHtml = `<span style="color: #10b981;"><i class="fas fa-check"></i> Faltam ${diffDays} dia(s)</span>`;
                } else {
                    alertaDiasHtml = `<span style="color: var(--text-secondary);"><i class="fas fa-question-circle"></i> Sem previsão</span>`;
                }

                datasHtml = `
                    <div style="font-size: 0.85rem; line-height: 1.6;">
                        <div><span style="color: var(--text-secondary);">Revisão:</span> <strong style="color: #3b82f6;">${formatData(v.data_ultima_revisao)}</strong></div>
                        <div style="margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px;"></div>
                        <div><span style="color: var(--text-secondary);">Insp. Mecânica:</span> <strong style="color: #10b981;">${formatData(v.data_inspecao)}</strong></div>
                        <div><span style="color: var(--text-secondary);">Insp. Elétrica:</span> <strong style="color: #8b5cf6;">${formatData(v.data_inspecao_eletromecanica)}</strong></div>
                        <div style="margin-top: 2px;"><span style="color: var(--text-secondary);">Próx. Insp. Eletromec.:</span> <strong style="color: #f59e0b;">${formatData(v.data_proxima_inspecao)}</strong></div>
                        <div style="margin-top: 4px; font-size: 0.75rem;">${alertaDiasHtml}</div>
                    </div>
                `;

                qtdRevisoesHtml = `
                    <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 10px; text-align: center;">
                        <span style="display: block; font-size: 1.5rem; font-weight: 800; color: #10b981;">${v.quantidade_revisoes}</span>
                        <span style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase;">Revisões</span>
                    </div>
                `;
            }

            let badgeHtml = `
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <div class="badge-status-rev" style="background: ${info.bg}; color: ${info.cor}; border: 1px solid ${info.cor}; justify-content:center;">
                        <i class="${info.icon}"></i> ${info.status}
                    </div>
                </div>
            `;

            let btnLabelKm = isGrua ? 'Horímetro' : 'KM';
            let acoesHtml = `
                <div style="display: flex; flex-direction:column; gap: 8px; align-items: flex-end;">
                    <button class="btn-primary-green" onclick="window.abrirModalRevisao('${v.id}')" title="Registrar Manutenção / Inspeção" style="width: 100%; justify-content:center;">
                        <i class="fas fa-tools"></i> Revisão
                    </button>
                    <button class="btn-secondary-dark" onclick="window.abrirModalKm('${v.id}')" title="Atualizar ${btnLabelKm}" style="width: 100%; justify-content:center;">
                        <i class="fas fa-tachometer-alt" style="color: var(--ccol-blue-bright);"></i> ${isGrua ? 'HORAS' : 'KM'}
                    </button>
                    <button class="btn-secondary-dark" onclick="window.abrirPainelHistorico('${v.placa}')" style="width: 100%; justify-content:center;">
                        <i class="fas fa-history"></i> Histórico
                    </button>
                </div>
            `;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${idVeiculoHtml}</td>
                <td style="color: var(--text-secondary); font-weight: 600; font-size: 0.85rem;">${v.tipo.toUpperCase()}</td>
                <td>${progressHtml}</td>
                <td>${datasHtml}</td>
                <td style="text-align: center; vertical-align: middle;">${qtdRevisoesHtml}</td>
                <td style="text-align: center; vertical-align: middle;">${window.gerarBadgeStatusVeiculo(v.placa)}</td>
                <td>${acoesHtml}</td>
            `;
            tbody.appendChild(tr);
        });
    });
};

// ======================= LÓGICA DE PARADAS PROGRAMADAS =======================

window.abrirModalAgendarParada = function(placa) {
    document.getElementById('inputParadaPlaca').value = placa;
    document.getElementById('paradaVeiculoPlaca').innerText = placa;
    
    const dataAtual = new Date();
    dataAtual.setHours(dataAtual.getHours() + 1);
    const fusoAjuste = new Date(dataAtual.getTime() - (dataAtual.getTimezoneOffset() * 60000));
    
    document.getElementById('inputParadaData').value = fusoAjuste.toISOString().slice(0, 16);
    document.getElementById('inputParadaMotivo').value = '';
    
    document.getElementById('modalAgendarParada').classList.add('show');
};

window.fecharModalAgendarParada = function() {
    document.getElementById('modalAgendarParada').classList.remove('show');
};

window.salvarAgendamentoParada = async function() {
    const placa = document.getElementById('inputParadaPlaca').value;
    const dataProg = document.getElementById('inputParadaData').value;
    const motivo = document.getElementById('inputParadaMotivo').value.trim();
    const filialId = window.obterFilialUsuarioLogadoRev();

    if(!dataProg || !motivo) return alert("Por favor, preencha a data e o motivo da parada.");

    try {
        const { error } = await window.supabaseClient.from('manutencao_paradas_programadas').insert([{
            placa: placa, 
            data_programada: dataProg, 
            motivo: motivo, 
            filial_id: filialId
        }]);
        if(error) throw error;

        alert("Veículo agendado para manutenção com sucesso!");
        window.fecharModalAgendarParada();
        await window.carregarVeiculosManutencao(false); 
    } catch(e) {
        console.error(e);
        alert("Erro ao tentar agendar a parada.");
    }
};

window.abrirModalParadasProgramadas = async function() {
    document.getElementById('modalListaParadas').classList.add('show');
    await window.carregarListaParadasProgramadas();
};

window.fecharModalParadasProgramadas = function() {
    document.getElementById('modalListaParadas').classList.remove('show');
};

window.carregarListaParadasProgramadas = async function() {
    const tbody = document.getElementById('tbListaParadas');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Buscando agendamentos...</td></tr>';
    
    const filialId = window.obterFilialUsuarioLogadoRev();

    try {
        let query = window.supabaseClient.from('manutencao_paradas_programadas').select('*').eq('status', 'Pendente').order('data_programada', { ascending: true });
        if (filialId !== null) query = query.eq('filial_id', filialId);

        const { data, error } = await query;
        if(error) throw error;

        if(!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-secondary); padding: 20px;">Nenhuma parada programada no momento.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(p => {
            const dataFmt = window.formatarDataHoraCerta(p.data_programada);
            
            let vistoStr = p.visualizado_em 
                ? `<span style="color:#10b981; font-size:0.8rem;"><i class="fas fa-check-double"></i> ${p.visualizado_por} <br><small>${window.formatarDataHoraCerta(p.visualizado_em)}</small></span>`
                : '<span style="color:#94a3b8; font-size:0.8rem;"><i class="fas fa-eye-slash"></i> Não Visto</span>';

            let statusLogHtml = '';
            const statLog = p.status_logistica || 'Pendente';
            if (statLog === 'Pendente') {
                statusLogHtml = `<span style="color: #f59e0b; font-weight:bold;">Aguardando...</span>`;
            } else if (statLog === 'Parou') {
                statusLogHtml = `<span style="color: #10b981; font-weight:bold;"><i class="fas fa-check"></i> Parou</span><br><small style="color:var(--text-secondary); font-size:0.7rem;">Por: ${p.confirmado_por}</small>`;
            } else {
                statusLogHtml = `<span style="color: #ef4444; font-weight:bold;"><i class="fas fa-times"></i> Não Parou</span><br><small style="color:var(--text-secondary); font-size:0.7rem;">Por: ${p.confirmado_por}</small>`;
            }

            return `
            <tr style="background: rgba(0,0,0,0.2);">
                <td style="font-weight: 900; color: #fff; font-size: 1.1rem; letter-spacing: 1px;">${p.placa}</td>
                <td style="color: var(--ccol-blue-bright); font-weight: bold;"><i class="fas fa-clock"></i> ${dataFmt}</td>
                <td style="color: var(--text-secondary);">${p.motivo}</td>
                <td>${vistoStr}</td>
                <td>${statusLogHtml}</td>
                <td style="text-align: right;">
                    <div style="display: flex; gap: 8px; justify-content: flex-end;">
                        <button class="btn-primary-green input-compacto" onclick="window.concluirParadaProgramada(${p.id})" title="Marcar como Concluída"><i class="fas fa-check"></i> Concluir</button>
                        <button class="btn-secondary-dark input-compacto" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.4);" onclick="window.cancelarParadaProgramada(${p.id})" title="Cancelar Agendamento"><i class="fas fa-times"></i></button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    } catch(e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #ef4444; padding: 20px;">Erro ao carregar lista de paradas.</td></tr>';
    }
};

window.concluirParadaProgramada = async function(id) {
    if(!confirm("Atenção: A parada deste veículo já foi efetuada e o caminhão já deu entrada na oficina?")) return;
    try {
        await window.supabaseClient.from('manutencao_paradas_programadas').update({ status: 'Concluída' }).eq('id', id);
        await window.carregarListaParadasProgramadas();
        await window.carregarVeiculosManutencao(false);
    } catch(e) { 
        alert("Erro ao concluir parada."); 
    }
};

window.cancelarParadaProgramada = async function(id) {
    if(!confirm("Deseja cancelar o agendamento desta parada? Ela sumirá da lista e do painel.")) return;
    try {
        await window.supabaseClient.from('manutencao_paradas_programadas').update({ status: 'Cancelada' }).eq('id', id);
        await window.carregarListaParadasProgramadas();
        await window.carregarVeiculosManutencao(false);
    } catch(e) { 
        alert("Erro ao cancelar."); 
    }
};


// ======================= HISTÓRICO E OFFCANVAS =======================
window.registrarHistorico = async function(placa, frota, km, tipo, detalhes) {
    try {
        const filialId = window.obterFilialUsuarioLogadoRev();
        
        let userNameLocal = 'Sistema';
        const sessao = localStorage.getItem('ccol_user_session');
        if (sessao) {
            const u = JSON.parse(sessao);
            userNameLocal = u.nome_completo || u.nome || u.username || 'Sistema';
        } else if (window.currentUser) {
            userNameLocal = window.currentUser.nome_completo || window.currentUser.nome || window.currentUser.username || 'Sistema';
        }

        await window.supabaseClient.from('manutencao_historico').insert([{
            placa: placa,
            numero_frota: frota,
            km_registrado: km,
            tipo_registro: tipo,
            detalhes: detalhes,
            usuario: userNameLocal,
            filial_id: filialId
        }]);
    } catch(e) {
        console.error("Erro ao salvar log no histórico:", e);
    }
};

window.abrirPainelHistorico = async function(placa) {
    document.getElementById('painelHistorico').classList.add('open');
    document.getElementById('txtPlacaHistorico').innerText = `Placa: ${placa}`;
    const body = document.getElementById('bodyHistoricoTimeline');
    body.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Carregando linha do tempo...</div>';

    try {
        const filialId = window.obterFilialUsuarioLogadoRev();
        let q = window.supabaseClient.from('manutencao_historico').select('*').eq('placa', placa).order('data_registro', { ascending: false }).limit(20);
        if (filialId !== null) q = q.eq('filial_id', filialId);

        const { data, error } = await q;
        if (error) throw error;

        if (!data || data.length === 0) {
            body.innerHTML = '<div style="color: var(--text-secondary); text-align:center; padding: 20px;">Nenhum histórico registrado para este equipamento ainda.</div>';
            return;
        }

        let html = '';
        data.forEach(log => {
            const dataFmt = window.formatarDataHoraCerta(log.data_registro);
            let icon = 'fas fa-info-circle';
            let color = 'var(--text-secondary)';
            if(log.tipo_registro === 'REVISAO') { icon = 'fas fa-tools'; color = '#10b981'; }
            if(log.tipo_registro === 'ATUALIZACAO_KM') { icon = 'fas fa-tachometer-alt'; color = '#3b82f6'; }
            if(log.tipo_registro === 'MUDANCA_STATUS') { icon = 'fas fa-exchange-alt'; color = '#f59e0b'; }

            html += `
                <div class="timeline-item">
                    <div class="timeline-date">${dataFmt} | Usuário: <strong>${log.usuario || 'N/A'}</strong></div>
                    <div class="timeline-content">
                        <div style="color: ${color}; font-weight: bold; margin-bottom: 5px; font-size: 0.9rem;">
                            <i class="${icon}"></i> ${log.tipo_registro.replace('_', ' ')}
                        </div>
                        <div style="color: #fff; font-size: 0.85rem; margin-bottom: 5px;">KM/Horímetro: <strong>${log.km_registrado || 0}</strong></div>
                        <div style="color: var(--text-secondary); font-size: 0.8rem; line-height: 1.4;">${log.detalhes || 'Sem observações.'}</div>
                    </div>
                </div>
            `;
        });
        body.innerHTML = html;
    } catch(e) {
        console.error(e);
        body.innerHTML = '<div style="color: #ef4444; text-align:center; padding: 20px;">Erro ao carregar histórico.</div>';
    }
};

window.fecharPainelHistorico = function() {
    document.getElementById('painelHistorico').classList.remove('open');
};

// ======================= MODAL: KM / HORÍMETRO =======================
window.abrirModalKm = function(id) {
    const v = window.veiculosRevisaoDb.find(x => String(x.id) === String(id));
    if(!v) return;

    const isGrua = String(v.tipo).toUpperCase().includes('GRUA');
    const lblTexto = isGrua ? 'Horímetro' : 'KM';

    document.getElementById('lblTituloKmHorimetro').innerText = lblTexto;
    document.getElementById('lblAtualSistemaTexto').innerText = lblTexto;

    document.getElementById('kmVeiculoId').value = v.id;
    document.getElementById('kmVeiculoPlacaValor').value = v.placa;
    document.getElementById('kmVeiculoFrotaValor').value = v.numero_frota;
    document.getElementById('kmVeiculoTipoValor').value = v.tipo;
    
    document.getElementById('kmVeiculoPlaca').innerText = `${v.placa} (Frota ${v.numero_frota})`;
    document.getElementById('kmAtualSistema').innerText = v.km_atual.toLocaleString('pt-BR');
    document.getElementById('inputNovoKm').value = v.km_atual;

    document.getElementById('modalAtualizarKm').classList.add('show');
};

window.fecharModalKm = function() {
    document.getElementById('modalAtualizarKm').classList.remove('show');
};

window.salvarNovoKm = async function() {
    const placa = document.getElementById('kmVeiculoPlacaValor').value;
    const frota = document.getElementById('kmVeiculoFrotaValor').value;
    const tipo = document.getElementById('kmVeiculoTipoValor').value;
    const novoKm = parseInt(document.getElementById('inputNovoKm').value);
    const filialId = window.obterFilialUsuarioLogadoRev();

    if (isNaN(novoKm) || novoKm < 0) return alert("Digite um valor válido.");

    try {
        let queryCheck = window.supabaseClient.from('manutencao_revisoes').select('id, km_atual').eq('placa', placa);
        if (filialId !== null) queryCheck = queryCheck.eq('filial_id', filialId);
        
        const { data: checkExist } = await queryCheck.maybeSingle();
        let kmAntigo = checkExist ? checkExist.km_atual : 0;

        if (checkExist && checkExist.id) {
            await window.supabaseClient.from('manutencao_revisoes').update({ km_atual: novoKm }).eq('id', checkExist.id);
        } else {
            await window.supabaseClient.from('manutencao_revisoes').insert([{
                placa: placa, numero_frota: frota, tipo: tipo,
                km_atual: novoKm, km_ultima_revisao: novoKm, km_proxima_revisao: 0,
                quantidade_revisoes: 0,
                filial_id: filialId
            }]);
        }

        window.registrarHistorico(placa, frota, novoKm, 'ATUALIZACAO_KM', `Ajuste manual de KM/Horímetro. Anterior: ${kmAntigo}, Novo: ${novoKm}`);

        window.fecharModalKm();
        await window.carregarVeiculosManutencao(false);
    } catch (e) {
        console.error("Erro ao atualizar:", e);
        alert("Erro ao salvar. Tente novamente.");
    }
};

// ======================= MODAL: REGISTRAR REVISÃO =======================
window.abrirModalRevisao = function(id) {
    const v = window.veiculosRevisaoDb.find(x => String(x.id) === String(id));
    if(!v) return;

    const isGrua = String(v.tipo).toUpperCase().includes('GRUA');
    const isTritrem = String(v.tipo).toUpperCase().includes('TRITREM');
    const lblTexto = isGrua ? 'Horímetro' : 'KM';

    document.getElementById('lblRevRealizadaTexto').innerText = lblTexto;
    document.getElementById('lblRevProximaTexto').innerText = lblTexto;

    document.getElementById('revVeiculoId').value = v.id;
    document.getElementById('revVeiculoPlacaValor').value = v.placa;
    document.getElementById('revVeiculoFrotaValor').value = v.numero_frota;
    document.getElementById('revVeiculoTipoValor').value = v.tipo;

    document.getElementById('revVeiculoPlaca').innerText = `${v.placa} (Frota ${v.numero_frota})`;
    
    const inputDataUltima = document.getElementById('inputDataUltimaRevisao');
    const inputRealizada = document.getElementById('inputKmRevisaoRealizada');
    const inputProxima = document.getElementById('inputKmProximaRevisao');
    const inputDetalhes = document.getElementById('inputDetalhesRevisao');

    document.querySelectorAll('.checklist-grid input[type="checkbox"]').forEach(chk => chk.checked = false);

    inputDataUltima.value = v.data_ultima_revisao || new Date().toISOString().split('T')[0]; 
    inputRealizada.value = v.km_atual;
    inputDetalhes.value = '';

    const divDatas = document.getElementById('divDatasInspecaoTritrem');
    if (isTritrem) {
        divDatas.style.display = 'block';
        document.getElementById('inputDataInspecao').value = v.data_inspecao || '';
        document.getElementById('inputDataInspEletro').value = v.data_inspecao_eletromecanica || '';
        document.getElementById('inputDataProximaInspecao').value = v.data_proxima_inspecao || '';
        document.getElementById('inputQtdRevisoes').value = v.quantidade_revisoes || 0;
    } else {
        divDatas.style.display = 'none';
        document.getElementById('inputDataInspecao').value = '';
        document.getElementById('inputDataInspEletro').value = '';
        document.getElementById('inputDataProximaInspecao').value = '';
        document.getElementById('inputQtdRevisoes').value = 0;
    }

    if (isGrua) {
        inputProxima.readOnly = true;
        inputProxima.style.backgroundColor = 'rgba(0,0,0,0.2)'; 
        inputProxima.style.cursor = 'not-allowed';

        inputRealizada.oninput = function() {
            const ultima = parseInt(inputRealizada.value) || 0;
            const proximaRevisao500 = ultima + 500;
            inputProxima.value = proximaRevisao500;
        };
        inputRealizada.dispatchEvent(new Event('input'));
    } else {
        inputProxima.readOnly = false;
        inputProxima.style.backgroundColor = '';
        inputProxima.style.cursor = '';
        inputRealizada.oninput = null;
        inputProxima.value = (v.km_proxima_revisao && v.km_proxima_revisao > 0) ? v.km_proxima_revisao : v.km_atual + 10000;
    }

    document.getElementById('modalRegistrarRevisao').classList.add('show');
};

window.fecharModalRevisao = function() {
    document.getElementById('modalRegistrarRevisao').classList.remove('show');
};

window.salvarNovaRevisao = async function() {
    const placa = document.getElementById('revVeiculoPlacaValor').value;
    const frota = document.getElementById('revVeiculoFrotaValor').value;
    const tipo = document.getElementById('revVeiculoTipoValor').value;
    const dataUltima = document.getElementById('inputDataUltimaRevisao').value || null;
    const kmRevisao = parseInt(document.getElementById('inputKmRevisaoRealizada').value);
    const kmProxima = parseInt(document.getElementById('inputKmProximaRevisao').value);

    const filialId = window.obterFilialUsuarioLogadoRev();
    const isTritrem = String(tipo).toUpperCase().includes('TRITREM');

    let detalhes = document.getElementById('inputDetalhesRevisao').value.trim();

    if (!dataUltima) return alert("A Data da Revisão é obrigatória.");
    if (isNaN(kmRevisao) || isNaN(kmProxima)) return alert("Preencha corretamente os campos obrigatórios de KM/Hora.");
    if (kmProxima <= kmRevisao) return alert("A próxima revisão deve ser MAIOR que a revisão realizada.");

    let checks = [];
    if(document.getElementById('chkOleo').checked) checks.push("Óleo/Filtros");
    if(document.getElementById('chkEngraxamento').checked) checks.push("Engraxamento");
    if(document.getElementById('chkFreios').checked) checks.push("Freios");
    if(document.getElementById('chkPneus').checked) checks.push("Pneus");
    if(document.getElementById('chkEletrica').checked) checks.push("Elétrica");
    if(document.getElementById('chkEstrutura').checked) checks.push("Estrutura");
    
    let stringChecks = checks.length > 0 ? `[Checklist: ${checks.join(', ')}] ` : '';
    let descricaoCompleta = stringChecks + detalhes;

    let payload = {
        placa: placa,
        numero_frota: frota,
        tipo: tipo,
        data_ultima_revisao: dataUltima,
        km_atual: kmRevisao,
        km_ultima_revisao: kmRevisao,
        km_proxima_revisao: kmProxima,
        detalhes_ultima_revisao: detalhes,
        filial_id: filialId
    };

    if (isTritrem) {
        payload.data_inspecao = document.getElementById('inputDataInspecao').value || null;
        payload.data_inspecao_eletromecanica = document.getElementById('inputDataInspEletro').value || null;
        payload.data_proxima_inspecao = document.getElementById('inputDataProximaInspecao').value || null;
        payload.quantidade_revisoes = parseInt(document.getElementById('inputQtdRevisoes').value) || 0;
    }

    try {
        let queryCheck = window.supabaseClient.from('manutencao_revisoes').select('id').eq('placa', placa);
        if (filialId !== null) queryCheck = queryCheck.eq('filial_id', filialId);
        
        const { data: checkExist } = await queryCheck.maybeSingle();

        if (checkExist && checkExist.id) {
            await window.supabaseClient.from('manutencao_revisoes').update(payload).eq('id', checkExist.id);
        } else {
            await window.supabaseClient.from('manutencao_revisoes').insert([payload]);
        }

        window.registrarHistorico(placa, frota, kmRevisao, 'REVISAO', descricaoCompleta || 'Revisão registrada via sistema.');

        window.fecharModalRevisao();
        await window.carregarVeiculosManutencao(false);

    } catch (e) {
        console.error("Erro ao registrar revisão:", e);
        alert("Erro ao registrar a manutenção. Tente novamente.");
    }
};

// ======================= IMPORTAÇÃO DE PLANILHA =======================
window.importarPlanilhaKm = function() {
    if (typeof XLSX === 'undefined') {
        alert("A biblioteca XLSX (SheetJS) não está carregada no sistema.\nCertifique-se de adicioná-la no seu index.html.");
        return;
    }

    let fileInput = document.getElementById('inputImportarKmExcel');
    if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'inputImportarKmExcel';
        fileInput.accept = '.xlsx, .xls';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);

        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet, {header: 1});

                    let headerRowIndex = -1;
                    let colPlaca = -1;
                    let colOdo = -1;

                    for (let i = 0; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        if (row && row.length > 0) {
                            for(let j = 0; j < row.length; j++) {
                                const val = String(row[j] || '').trim().toUpperCase();
                                if (val === 'PLACA') colPlaca = j;
                                if (val === 'ODÔMETRO FINAL (CAN)' || val === 'ODOMETRO FINAL (CAN)') colOdo = j;
                            }
                            if (colPlaca !== -1 && colOdo !== -1) {
                                headerRowIndex = i;
                                break;
                            }
                        }
                    }

                    if (headerRowIndex === -1) {
                        alert("Não foi possível encontrar as colunas 'Placa' e 'Odômetro Final (CAN)' na planilha importada.");
                        fileInput.value = ''; 
                        return;
                    }

                    let veiculosAtualizados = 0;
                    const filialId = window.obterFilialUsuarioLogadoRev();

                    const tbody = document.getElementById('tbControleRevisoes');
                    if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--ccol-blue-bright); padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Lendo planilha e atualizando TRITREMs...</td></tr>`;

                    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        if (!row || !row[colPlaca]) continue;

                        const placaSheet = String(row[colPlaca]).trim().toUpperCase();
                        let odoSheetRaw = String(row[colOdo] || '0').replace(/,/g, '.').replace(/[^\d.-]/g, '');
                        const odoFinal = Math.round(parseFloat(odoSheetRaw));

                        if (isNaN(odoFinal) || odoFinal <= 0) continue;

                        let queryFrota = window.supabaseClient.from('frotas_manutencao')
                            .select('*')
                            .or(`cavalo.eq."${placaSheet}",go.eq."${placaSheet}",numero_frota.eq."${placaSheet}"`);
                        
                        if (filialId !== null) queryFrota = queryFrota.eq('filial_id', filialId);
                        
                        const { data: f } = await queryFrota.maybeSingle();

                        if (f && String(f.categoria || '').toUpperCase().includes('TRITREM')) {
                            const placaReal = f.cavalo || f.go || placaSheet;
                            const numFrotaReal = f.numero_frota || f.go || placaSheet;

                            let queryRev = window.supabaseClient.from('manutencao_revisoes')
                                .select('id, km_atual')
                                .or(`placa.eq."${placaReal}",numero_frota.eq."${numFrotaReal}"`);
                                
                            if (filialId !== null) queryRev = queryRev.eq('filial_id', filialId);
                            
                            const { data: rev } = await queryRev.maybeSingle();

                            if (rev && rev.id) {
                                if (odoFinal > (rev.km_atual || 0)) {
                                    await window.supabaseClient.from('manutencao_revisoes').update({ km_atual: odoFinal }).eq('id', rev.id);
                                    window.registrarHistorico(placaReal, numFrotaReal, odoFinal, 'ATUALIZACAO_KM', 'KM Atualizado em lote via Planilha (TRITREM).');
                                    veiculosAtualizados++;
                                }
                            } else {
                                await window.supabaseClient.from('manutencao_revisoes').insert([{
                                    placa: placaReal,
                                    numero_frota: numFrotaReal,
                                    tipo: f.categoria,
                                    km_atual: odoFinal,
                                    km_ultima_revisao: odoFinal,
                                    km_proxima_revisao: 0,
                                    quantidade_revisoes: 0,
                                    filial_id: filialId
                                }]);
                                window.registrarHistorico(placaReal, numFrotaReal, odoFinal, 'ATUALIZACAO_KM', 'Criação e KM Atualizado via Planilha (TRITREM).');
                                veiculosAtualizados++;
                            }
                        }
                    }

                    alert(`Planilha processada com sucesso! ${veiculosAtualizados} TRITREM(s) atualizado(s).`);
                    fileInput.value = '';
                    await window.carregarVeiculosManutencao(false);

                } catch (err) {
                    console.error("Erro ao ler excel:", err);
                    alert("Ocorreu um erro ao processar a planilha. Verifique o console.");
                    await window.carregarVeiculosManutencao(false);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    fileInput.click();
};

// ======================= CONFIGURAÇÕES & GOOGLE SHEETS =======================
window.abrirModalConfigManutencao = async function() {
    document.getElementById('inputGoogleSheetsLink').value = 'Carregando...';
    document.getElementById('modalConfigManutencao').classList.add('show');
    
    const filialId = window.obterFilialUsuarioLogadoRev() || 0;

    try {
        const { data, error } = await window.supabaseClient.from('manutencao_configuracoes').select('google_sheets_link').eq('filial_id', filialId).maybeSingle();
        if (!error && data) {
            document.getElementById('inputGoogleSheetsLink').value = data.google_sheets_link || '';
        } else {
            document.getElementById('inputGoogleSheetsLink').value = '';
        }
    } catch(e) {
        document.getElementById('inputGoogleSheetsLink').value = '';
    }
};

window.fecharModalConfigManutencao = function() {
    document.getElementById('modalConfigManutencao').classList.remove('show');
};

window.salvarConfigManutencao = async function() {
    const link = document.getElementById('inputGoogleSheetsLink').value.trim();
    const filialId = window.obterFilialUsuarioLogadoRev() || 0;

    try {
        const { data: check } = await window.supabaseClient.from('manutencao_configuracoes').select('id').eq('filial_id', filialId).maybeSingle();
        
        if (check && check.id) {
            await window.supabaseClient.from('manutencao_configuracoes').update({ google_sheets_link: link }).eq('id', check.id);
        } else {
            await window.supabaseClient.from('manutencao_configuracoes').insert([{ google_sheets_link: link, filial_id: filialId }]);
        }

        alert("Link da planilha salvo com sucesso!");
        window.fecharModalConfigManutencao();
    } catch(e) {
        console.error(e);
        alert("Erro ao salvar configuração.");
    }
};

window.forcarSincronizacaoPlanilha = async function() {
    await window.salvarConfigManutencao();
    const btn = document.querySelector('#modalConfigManutencao .btn-primary-blue');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
    
    await window.carregarVeiculosManutencao(true);
    
    btn.innerHTML = '<i class="fas fa-sync-alt"></i> Sincronizar Agora';
};

window.sincronizarComPlanilhaGoogle = async function() {
    const filialId = window.obterFilialUsuarioLogadoRev();
    
    try {
        const { data } = await window.supabaseClient.from('manutencao_configuracoes').select('google_sheets_link').eq('filial_id', filialId || 0).maybeSingle();
        if(!data || !data.google_sheets_link) return;
        
        const matchId = data.google_sheets_link.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if(!matchId) return;
        
        const sheetId = matchId[1];
        let csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

        const matchGid = data.google_sheets_link.match(/[#&?]gid=([0-9]+)/);
        if (matchGid) {
            csvUrl += `&gid=${matchGid[1]}`;
        }

        const response = await fetch(csvUrl);
        const csvText = await response.text();
        
        await new Promise((resolve, reject) => {
            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: async function(results) {
                    try {
                        const rows = results.data;
                        let veiculosAtualizados = 0;
                        let ultimosRegistros = {};
                        let rowIndex = 0;
                        
                        for (let row of rows) {
                            rowIndex++;
                            let frotaSheet = null;
                            let valorSheet = null;
                            
                            for (let key in row) {
                                let k = key.trim().toUpperCase();
                                if (k === 'GRUA' || k === 'FROTA' || k === 'PLACA' || k === 'EQUIPAMENTO') frotaSheet = row[key];
                                if (k === 'HORIMETRO FINAL' || k === 'HORIMETRO' || k === 'KM' || k === 'ATUAL') valorSheet = row[key];
                            }
                            
                            if (frotaSheet && valorSheet) {
                                frotaSheet = frotaSheet.trim().toUpperCase();
                                
                                let limpo = String(valorSheet).replace(/,/g, '.').replace(/[^\d.-]/g, '');
                                let valorNum = parseFloat(limpo);
                                
                                if (!isNaN(valorNum) && valorNum > 0) {
                                    if (!ultimosRegistros[frotaSheet] || rowIndex >= ultimosRegistros[frotaSheet].index) {
                                        ultimosRegistros[frotaSheet] = { value: valorNum, index: rowIndex };
                                    }
                                }
                            }
                        }
                        
                        for (const [frotaId, record] of Object.entries(ultimosRegistros)) {
                            let valorFinal = Math.round(record.value); 
                            
                            let queryRev = window.supabaseClient.from('manutencao_revisoes').select('*').or(`placa.eq."${frotaId}",numero_frota.eq."${frotaId}"`);
                            if (filialId !== null) queryRev = queryRev.eq('filial_id', filialId);
                            const { data: rev } = await queryRev.maybeSingle();
                            
                            if (rev && rev.id) {
                                if (valorFinal > (rev.km_atual || 0)) {
                                    await window.supabaseClient.from('manutencao_revisoes').update({ km_atual: valorFinal }).eq('id', rev.id);
                                    veiculosAtualizados++;
                                }
                            } else {
                                let queryFrota = window.supabaseClient.from('frotas_manutencao').select('*').or(`cavalo.eq."${frotaId}",go.eq."${frotaId}",numero_frota.eq."${frotaId}"`);
                                if (filialId !== null) queryFrota = queryFrota.eq('filial_id', filialId);
                                const { data: f } = await queryFrota.maybeSingle();
                                if (f) {
                                    const placaReal = f.cavalo || f.go || frotaId;
                                    const numFrotaReal = f.numero_frota || f.go || frotaId;

                                    let checkDeNovo = window.supabaseClient.from('manutencao_revisoes').select('id, km_atual').or(`placa.eq."${placaReal}",numero_frota.eq."${numFrotaReal}"`);
                                    if (filialId !== null) checkDeNovo = checkDeNovo.eq('filial_id', filialId);
                                    const { data: rev2 } = await checkDeNovo.maybeSingle();

                                    if (rev2 && rev2.id) {
                                        if (valorFinal > (rev2.km_atual || 0)) {
                                            await window.supabaseClient.from('manutencao_revisoes').update({ km_atual: valorFinal }).eq('id', rev2.id);
                                            veiculosAtualizados++;
                                        }
                                    } else {
                                        await window.supabaseClient.from('manutencao_revisoes').insert([{
                                            placa: placaReal, numero_frota: numFrotaReal, tipo: f.categoria || 'GRUA',
                                            km_atual: valorFinal, km_ultima_revisao: valorFinal, km_proxima_revisao: 0, quantidade_revisoes: 0, filial_id: filialId
                                        }]);
                                        veiculosAtualizados++;
                                    }
                                }
                            }
                        }
                        
                        if(veiculosAtualizados > 0) {
                            console.log(`Planilha sincronizada. ${veiculosAtualizados} equipamentos atualizados.`);
                        }
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                },
                error: function(error) {
                    reject(error);
                }
            });
        });
    } catch(e) {
        console.error("Erro na integração com Google Sheets:", e);
    }
};