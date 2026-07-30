console.log("Módulo de Atestados e Dashboard carregado com sucesso na memória!");

window.listaAtestados = [];
window.listaParaSelectColaboradores = [];
window.graficoEvolucaoAtest = null;
window.graficoCidAtest = null;

window.initRHAtestados = async function() {
    await window.carregarListaBaseColaboradores();
    await window.carregarAtestados();
    
    // Garante que os gráficos se ajustem ao redimensionar a tela
    window.addEventListener('resize', function() {
        if (window.graficoEvolucaoAtest) window.graficoEvolucaoAtest.resize();
        if (window.graficoCidAtest) window.graficoCidAtest.resize();
    });
};

window.carregarListaBaseColaboradores = async function() {
    try {
        const dados = await db.getColaboradores();
        window.listaParaSelectColaboradores = dados.filter(c => c.status !== 'Inativo');
    } catch(e) {
        console.error("Erro ao puxar base de colaboradores para atestados:", e);
    }
};

window.carregarAtestados = async function() {
    try {
        const tbody = document.getElementById('tbAtestados');
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Carregando atestados e montando dashboard...</td></tr>`;
        
        window.listaAtestados = await db.getAtestados();
        
        window.renderizarDashboardAtestados();
        window.renderizarTabelaAtestados(window.listaAtestados);
    } catch (e) {
        console.error(e);
        alert("Erro ao carregar lista de atestados.");
    }
};

window.renderizarDashboardAtestados = function() {
    if (typeof echarts === 'undefined') return;

    let totalDiasPerdidos = 0;
    let atestadosMesAtual = 0;
    
    const hoje = new Date();
    const mesAtualStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    
    const freqCid = {};
    const chavesMeses = [];
    const mesesLabels = [];

    // Prepara os últimos 6 meses para o gráfico
    for (let i = 5; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        mesesLabels.push(label);
        chavesMeses.push({ key: key, countAtestados: 0, countDias: 0 });
    }

    // Processamento dos Dados
    window.listaAtestados.forEach(a => {
        const dias = parseInt(a.dias_afastamento) || 0;
        totalDiasPerdidos += dias;

        // KPI Mês Atual e Gráfico Evolução
        if (a.data_inicio) {
            const [ano, mes] = a.data_inicio.split('-');
            const key = `${ano}-${mes}`;
            
            if (key === mesAtualStr) {
                atestadosMesAtual++;
            }

            const targetMes = chavesMeses.find(m => m.key === key);
            if (targetMes) {
                targetMes.countAtestados++;
                targetMes.countDias += dias;
            }
        }

        // Frequência de CID/Motivo
        let chaveCid = a.cid ? a.cid.trim().toUpperCase() : (a.motivo ? a.motivo.trim() : 'Não Informado');
        if (chaveCid === '') chaveCid = 'Não Informado';
        freqCid[chaveCid] = (freqCid[chaveCid] || 0) + 1;
    });

    // Ordenação do CID para achar o Top 1 (Para o KPI) e Top 5 (Para o Gráfico)
    const cidArray = Object.keys(freqCid).map(k => ({ name: k, value: freqCid[k] }));
    cidArray.sort((a,b) => b.value - a.value);
    
    const top1Cid = cidArray.length > 0 ? cidArray[0].name : 'Nenhum';
    const top5Cid = cidArray.slice(0, 5);

    // ==========================================
    // ATUALIZAÇÃO DOS KPIS (CARDS)
    // ==========================================
    document.getElementById('kpiTotalAtestados').innerText = window.listaAtestados.length;
    document.getElementById('kpiDiasPerdidos').innerText = totalDiasPerdidos;
    document.getElementById('kpiAtestadosMes').innerText = atestadosMesAtual;
    document.getElementById('kpiTopCid').innerText = top1Cid;
    document.getElementById('kpiTopCid').title = top1Cid;

    // ==========================================
    // GRÁFICO 1: EVOLUÇÃO (LINHA E BARRA)
    // ==========================================
    const dataAtestados = chavesMeses.map(c => c.countAtestados);
    const dataDias = chavesMeses.map(c => c.countDias);

    const domEvolucao = document.getElementById('chartAtestadosEvolucao');
    if (window.graficoEvolucaoAtest) window.graficoEvolucaoAtest.dispose();
    window.graficoEvolucaoAtest = echarts.init(domEvolucao);

    const optionEvolucao = {
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        legend: { data: ['Dias Perdidos', 'Qtd de Atestados'], textStyle: { color: '#9ca3af' } },
        grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
        xAxis: { 
            type: 'category', 
            data: mesesLabels, 
            axisLabel: { color: '#9ca3af' },
            axisLine: { lineStyle: { color: '#374151' } }
        },
        yAxis: [
            { 
                type: 'value', name: 'Dias', 
                axisLabel: { color: '#9ca3af' }, 
                splitLine: { lineStyle: { color: '#374151', type: 'dashed' } }
            },
            { 
                type: 'value', name: 'Qtd', 
                axisLabel: { color: '#9ca3af' }, 
                splitLine: { show: false }
            }
        ],
        series: [
            {
                name: 'Dias Perdidos',
                type: 'bar',
                barWidth: '40%',
                data: dataDias,
                itemStyle: { color: '#ef4444', borderRadius: [4, 4, 0, 0] }
            },
            {
                name: 'Qtd de Atestados',
                type: 'line',
                yAxisIndex: 1,
                data: dataAtestados,
                itemStyle: { color: '#60a5fa' },
                lineStyle: { width: 3 },
                symbolSize: 8
            }
        ]
    };
    window.graficoEvolucaoAtest.setOption(optionEvolucao);

    // ==========================================
    // GRÁFICO 2: INCIDÊNCIA CID (DONUT)
    // ==========================================
    const domCid = document.getElementById('chartAtestadosCid');
    if (window.graficoCidAtest) window.graficoCidAtest.dispose();
    window.graficoCidAtest = echarts.init(domCid);

    const optionCid = {
        tooltip: { trigger: 'item', formatter: '{b}: {c} ocorrência(s) ({d}%)' },
        legend: { top: 'bottom', textStyle: { color: '#9ca3af' } },
        color: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'],
        series: [{
            type: 'pie',
            radius: ['45%', '75%'],
            avoidLabelOverlap: false,
            itemStyle: { borderRadius: 8, borderColor: '#1f2937', borderWidth: 3 },
            label: { show: false, position: 'center' },
            emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold', color: '#fff' } },
            labelLine: { show: false },
            data: top5Cid.length > 0 ? top5Cid : [{ name: 'Sem dados', value: 0 }]
        }]
    };
    window.graficoCidAtest.setOption(optionCid);
};

// Formatar Data (YYYY-MM-DD para DD/MM/YYYY)
function formatarData(dataIso) {
    if(!dataIso) return '-';
    const [ano, mes, dia] = dataIso.split('-');
    return `${dia}/${mes}/${ano}`;
}

window.renderizarTabelaAtestados = function(lista) {
    const tbody = document.getElementById('tbAtestados');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#9ca3af; padding: 20px;">Nenhum atestado registrado.</td></tr>`;
        return;
    }

    lista.forEach(a => {
        let dataLancamento = '-';
        if(a.created_at) {
            const dateObj = new Date(a.created_at);
            dataLancamento = dateObj.toLocaleDateString('pt-BR') + ' às ' + dateObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        }

        const nomeColaborador = a.rh_colaboradores ? a.rh_colaboradores.nome : '<span style="color:#ef4444;">Colaborador Removido</span>';
        const matricula = (a.rh_colaboradores && a.rh_colaboradores.cod_funcionario) ? String(a.rh_colaboradores.cod_funcionario).padStart(4, '0') : '';
        
        let badgeRetorno = `<span style="color: var(--text-secondary); font-weight:bold;">${formatarData(a.data_retorno)}</span>`;
        
        if (a.data_retorno) {
            const hoje = new Date();
            hoje.setHours(0,0,0,0);
            
            const [ano, mes, dia] = a.data_retorno.split('-');
            const retorno = new Date(ano, mes - 1, dia);
            
            if (hoje.getTime() > retorno.getTime()) {
                badgeRetorno += ` <span style="background: rgba(16, 185, 129, 0.2); color: #10b981; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left:5px;">Já Retornou</span>`;
            } else if (hoje.getTime() === retorno.getTime()) {
                badgeRetorno += ` <span style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left:5px;">Retorna Hoje</span>`;
            } else {
                badgeRetorno += ` <span style="background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left:5px;">Afastado</span>`;
            }
        }

        const medicoHTML = a.medico_nome ? `<strong style="color:var(--ccol-blue-bright); display:block; margin-bottom: 2px;"><i class="fas fa-user-md"></i> ${a.medico_nome}</strong> <span style="font-size:0.75rem; color:#94a3b8;">CRM: ${a.medico_crm || 'Não informado'}</span><br>` : '';
        const btnAnexo = a.anexo_url ? `<a href="${a.anexo_url}" target="_blank" class="btn-primary-blue" style="padding: 6px 12px; font-size: 0.75rem; text-decoration: none; display: inline-flex; align-items: center; gap: 5px; border-radius: 6px;"><i class="fas fa-paperclip"></i> Ver Arquivo</a>` : '<span style="color:#64748b; font-size:0.8rem; font-style: italic;">Sem anexo</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-size: 0.8rem; color: #94a3b8;">${dataLancamento}</td>
            <td style="text-align: left; font-weight: bold;">
                <span style="color:var(--ccol-blue-bright); font-size:0.8rem; margin-right:5px;">[${matricula}]</span> 
                ${nomeColaborador}
            </td>
            <td style="text-align: left;">
                ${medicoHTML}
                <strong style="color:#f59e0b;">CID: ${a.cid || 'N/A'}</strong><br>
                <span style="font-size: 0.8rem; color: #cbd5e1;">${a.motivo || 'Sem motivo detalhado'}</span>
            </td>
            <td>${formatarData(a.data_inicio)} <i class="fas fa-arrow-right" style="color:#475569; margin: 0 5px; font-size:0.7rem;"></i> <strong>${a.dias_afastamento} dias</strong></td>
            <td>${badgeRetorno}</td>
            <td>${btnAnexo}</td>
            <td>
                <button class="btn-icon-only" onclick="window.excluirAtestado('${a.id}')" title="Excluir Lançamento"><i class="fas fa-trash" style="color: #ef4444;"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.filtrarAtestados = function() {
    const termo = document.getElementById('buscaAtestado').value.toLowerCase();
    const filtrados = window.listaAtestados.filter(a => {
        const nome = a.rh_colaboradores ? a.rh_colaboradores.nome.toLowerCase() : '';
        const cid = a.cid ? a.cid.toLowerCase() : '';
        const motivo = a.motivo ? a.motivo.toLowerCase() : '';
        const medico = a.medico_nome ? a.medico_nome.toLowerCase() : '';
        return nome.includes(termo) || cid.includes(termo) || motivo.includes(termo) || medico.includes(termo);
    });
    window.renderizarTabelaAtestados(filtrados);
};

window.abrirModalAtestado = function() {
    const selectColaborador = document.getElementById('atColaborador');
    selectColaborador.innerHTML = '<option value="">Selecione um colaborador da lista...</option>';
    
    window.listaParaSelectColaboradores.forEach(c => {
        const matricula = c.cod_funcionario ? String(c.cod_funcionario).padStart(4, '0') : '-';
        selectColaborador.innerHTML += `<option value="${c.id}">[${matricula}] ${c.nome}</option>`;
    });

    document.getElementById('atDataInicio').value = '';
    document.getElementById('atDias').value = '';
    document.getElementById('atDataRetorno').value = '';
    document.getElementById('atCid').value = '';
    document.getElementById('atMotivo').value = '';
    document.getElementById('atMedicoNome').value = '';
    document.getElementById('atMedicoCrm').value = '';
    document.getElementById('atAnexo').value = '';
    document.getElementById('atObservacoes').value = '';

    document.getElementById('modalAtestado').classList.add('show');
};

window.fecharModalAtestado = function() {
    document.getElementById('modalAtestado').classList.remove('show');
};

window.calcularDataRetornoAtestado = function() {
    const dataStr = document.getElementById('atDataInicio').value;
    const dias = parseInt(document.getElementById('atDias').value);

    if (dataStr && !isNaN(dias) && dias > 0) {
        const [anoStr, mesStr, diaStr] = dataStr.split('-');
        const dataIncial = new Date(anoStr, mesStr - 1, diaStr);
        
        dataIncial.setDate(dataIncial.getDate() + dias);
        
        const ano = dataIncial.getFullYear();
        const mes = String(dataIncial.getMonth() + 1).padStart(2, '0');
        const dia = String(dataIncial.getDate()).padStart(2, '0');
        
        document.getElementById('atDataRetorno').value = `${ano}-${mes}-${dia}`;
    } else {
        document.getElementById('atDataRetorno').value = '';
    }
};

window.salvarAtestado = async function() {
    const colaboradorId = document.getElementById('atColaborador').value;
    const dataInicio = document.getElementById('atDataInicio').value;
    const dias = parseInt(document.getElementById('atDias').value);
    const dataRetorno = document.getElementById('atDataRetorno').value;

    if (!colaboradorId || !dataInicio || isNaN(dias) || dias <= 0) {
        alert('Por favor, preencha o Colaborador, a Data de Início e a Quantidade de Dias.');
        return;
    }

    const btnSalvar = document.getElementById('btnSalvarAtestado');
    const txtOriginal = btnSalvar.innerHTML;
    btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
    btnSalvar.disabled = true;

    let anexoUrlFinal = null;
    const fileInput = document.getElementById('atAnexo');

    try {
        // Lógica de Upload do Arquivo (se houver arquivo selecionado)
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_colab${colaboradorId}.${fileExt}`;
            
            const { data, error } = await window.supabaseClient.storage.from('atestados').upload(fileName, file, { upsert: true });
            if (error) throw error;
            
            const { data: publicUrlData } = window.supabaseClient.storage.from('atestados').getPublicUrl(fileName);
            anexoUrlFinal = publicUrlData.publicUrl;
        }

        const dados = {
            colaborador_id: colaboradorId,
            data_inicio: dataInicio,
            dias_afastamento: dias,
            data_retorno: dataRetorno || null,
            cid: document.getElementById('atCid').value,
            motivo: document.getElementById('atMotivo').value,
            observacoes: document.getElementById('atObservacoes').value,
            medico_nome: document.getElementById('atMedicoNome').value,
            medico_crm: document.getElementById('atMedicoCrm').value,
            anexo_url: anexoUrlFinal
        };

        await db.addAtestado(dados);
        
        const select = document.getElementById('atColaborador');
        const nomeColaborador = select.options[select.selectedIndex].text;
        
        if (typeof window.registrarLogAuditoria === 'function') {
            window.registrarLogAuditoria('RH', 'Atestado', `Atestado de ${dias} dias lançado para: ${nomeColaborador}`, 'Alerta');
        }
        
        window.fecharModalAtestado();
        await window.carregarAtestados();

    } catch (e) {
        console.error(e);
        alert('Erro ao salvar o atestado. Verifique sua conexão e o tamanho do arquivo.');
    } finally {
        btnSalvar.innerHTML = txtOriginal;
        btnSalvar.disabled = false;
    }
};

window.excluirAtestado = async function(id) {
    if (confirm('Atenção: Deseja realmente excluir este lançamento? O arquivo em anexo também será deletado permanentemente.')) {
        try {
            const atestado = window.listaAtestados.find(x => x.id === id);
            
            // Excluir o arquivo físico da nuvem
            if (atestado && atestado.anexo_url) {
                try {
                    const urlParts = atestado.anexo_url.split('/');
                    const fileName = urlParts[urlParts.length - 1];
                    await window.supabaseClient.storage.from('atestados').remove([fileName]);
                } catch (errStorage) {
                    console.warn("Arquivo não encontrado ou erro ao deletar no storage:", errStorage);
                }
            }

            // Excluir o registro do banco de dados
            await db.deleteAtestado(id);
            if (typeof window.registrarLogAuditoria === 'function') window.registrarLogAuditoria('RH', 'Exclusão', `Lançamento de atestado removido do sistema`, 'Info');
            await window.carregarAtestados();
        } catch (e) {
            console.error(e);
            alert('Erro ao excluir o atestado.');
        }
    }
};