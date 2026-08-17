console.log("Módulo de Absenteísmo e Relatórios carregado com sucesso!");

window.listaAbsenteismo = [];
window.listaRelatorioFiltrada = [];
window.listaParaSelectColaboradores = [];
window.listaConvocadosExtraBH = []; 
window.graficoEvolucaoAbs = null;
window.graficoCidAbs = null;
window.abaAtualAbsenteismo = 'todos';
window.datasMultiplasFalta = [];

window.dicionarioCid = {
    "A09": "Diarreia e gastroenterite", "A90": "Dengue [dengue clássico]",
    "B30": "Infecção por vírus (Geral)", "B34": "Doença por vírus, não especificada (Virose)",
    "B34.2": "Infecção por coronavírus (COVID-19)", "F32": "Episódios depressivos",
    "F33": "Transtorno depressivo recorrente", "F41": "Outros transtornos ansiosos",
    "F43": "Reação ao stress grave e adaptação", "G43": "Enxaqueca",
    "H10": "Conjuntivite", "H11": "Outros transtornos da conjuntiva",
    "J00": "Nasofaringite aguda (Resfriado)", "J01": "Sinusite aguda",
    "J02": "Faringite aguda", "J03": "Amigdalite aguda",
    "J04": "Laringite e traqueíte agudas", "J06": "Infecções agudas das vias aéreas",
    "J11": "Influenza (Gripe)", "J20": "Bronquite aguda",
    "K04": "Doenças da polpa dentária (Odontológico)", "K29": "Gastrite e duodenite",
    "K52": "Gastroenterite e colite", "M54": "Dorsalgia (Dor nas costas)",
    "M54.4": "Lumbago com ciática", "M54.5": "Dor lombar baixa",
    "M65": "Sinovite e tenossinovite", "M75": "Lesões do ombro",
    "M79": "Mialgia / Transtornos dos tecidos moles", "N39": "Outros transtornos do trato urinário",
    "O20": "Hemorragia do início da gravidez", "R10": "Dor abdominal e pélvica",
    "R11": "Náusea e vômitos", "R50": "Febre de origem desconhecida",
    "R51": "Cefaleia (Dor de cabeça)", "R52": "Dor, não classificada em outra parte",
    "S62": "Fratura ao nível do punho e da mão", "S93": "Luxação, entorse e distensão",
    "Z02": "Exame para fins administrativos (Ocupacional)", "Z30": "Exame geral e investigação",
    "Z76": "Acompanhamento de Familiar"
};

window.buscarDescricaoCidAbs = function() {
    const inputCid = document.getElementById('absCid');
    const labelDesc = document.getElementById('absCidDescricao');
    const inputMotivo = document.getElementById('absMotivo');
    
    let val = inputCid.value.toUpperCase().trim();
    if (val.length < 3) {
        labelDesc.innerText = '';
        return;
    }

    let descricao = window.dicionarioCid[val] || window.dicionarioCid[val.substring(0,3)];
    if (!descricao) {
        const letra = val.charAt(0);
        const categorias = {
            'A': 'Doenças Infecciosas', 'B': 'Doenças Infecciosas/Virais',
            'C': 'Oncologia', 'D': 'Doenças do Sangue', 'E': 'Doenças Endócrinas',
            'F': 'Transtornos Mentais', 'G': 'Doenças do Sistema Nervoso', 'H': 'Doenças do Olho/Ouvido',
            'I': 'Doenças do Aparelho Circulatório', 'J': 'Doenças do Aparelho Respiratório',
            'K': 'Doenças do Aparelho Digestivo', 'M': 'Doenças do Sistema Osteomuscular',
            'N': 'Doenças Geniturinárias', 'R': 'Sintomas e Achados Anormais', 'S': 'Traumatismos'
        };
        if (categorias[letra]) descricao = categorias[letra] + ' (Especifique o motivo)';
    }

    if (descricao) {
        labelDesc.innerHTML = `<i class="fas fa-check-circle"></i> ${descricao}`;
        if (inputMotivo.value.trim() === '' && !descricao.includes('Especifique')) {
            inputMotivo.value = descricao;
        }
    } else {
        labelDesc.innerHTML = `<span style="color:#f59e0b;"><i class="fas fa-info-circle"></i> CID não mapeado.</span>`;
    }
};

window.initRHAbsenteismo = async function() {
    await window.carregarListaBaseColaboradores();
    await window.carregarAbsenteismo();
    
    window.addEventListener('resize', function() {
        if (window.graficoEvolucaoAbs) window.graficoEvolucaoAbs.resize();
        if (window.graficoCidAbs) window.graficoCidAbs.resize();
    });
};

window.carregarListaBaseColaboradores = async function() {
    try {
        const dados = await db.getColaboradores();
        window.colaboradoresAtivos = dados.filter(c => c.status !== 'Inativo' && c.status !== 'Desligado');
        window.listaParaSelectColaboradores = window.colaboradoresAtivos;
        
        const selRel = document.getElementById('relColaborador');
        if(selRel) {
            selRel.innerHTML = '<option value="TODOS">Todos os Colaboradores</option>';
            window.colaboradoresAtivos.forEach(c => {
                selRel.innerHTML += `<option value="${c.id}">[${String(c.cod_funcionario).padStart(4,'0')}] ${c.nome}</option>`;
            });
        }
    } catch(e) {
        console.error("Erro ao puxar colaboradores:", e);
    }
};

window.carregarAbsenteismo = async function() {
    try {
        const tbody = document.getElementById('tbAbsenteismo');
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Carregando registros...</td></tr>`;
        
        window.listaAbsenteismo = await db.getAbsenteismo();
        window.listaRelatorioFiltrada = window.listaAbsenteismo;
        
        try {
            const { data } = await window.supabaseClient.from('rh_banco_horas')
                .select('id, data_extra, caminhao_placa, turno, created_at, rh_colaboradores(nome, cod_funcionario)')
                .order('created_at', { ascending: false });
            window.listaConvocadosExtraBH = data || [];
        } catch(errBH) {
            window.listaConvocadosExtraBH = [];
        }
        
        window.renderizarDashboardAbsenteismo();
        window.renderizarTabelaAbsenteismo();
    } catch (e) {
        console.error(e);
        alert("Erro ao carregar dados de absenteísmo.");
    }
};

window.mudarAbaAbsenteismo = function(aba) {
    window.abaAtualAbsenteismo = aba;
    
    const abas = ['todos', 'ATESTADO', 'FALTA', 'BANCO_HORAS', 'CONVOCADOS_EXTRA', 'relatorio'];
    abas.forEach(a => {
        const btn = document.getElementById('tabBtn_' + a);
        if(btn) {
            btn.className = (a === aba) ? 'btn-primary-blue' : 'btn-secondary-dark';
            if (a === 'relatorio' && aba !== 'relatorio') {
                btn.style.borderColor = 'var(--ccol-rust-bright)';
                btn.style.color = 'var(--ccol-rust-bright)';
                btn.style.background = 'transparent';
            }
            if (a === 'CONVOCADOS_EXTRA' && aba !== 'CONVOCADOS_EXTRA') {
                btn.style.borderColor = '#10b981';
                btn.style.color = '#10b981';
                btn.style.background = 'transparent';
            }
        }
    });

    const painelFiltro = document.getElementById('painelFiltrosRelatorio');
    if (aba === 'relatorio') {
        if(painelFiltro) painelFiltro.style.display = 'flex';
        window.gerarRelatorioAbsenteismo(); 
    } else {
        if(painelFiltro) painelFiltro.style.display = 'none';
        window.renderizarTabelaAbsenteismo();
    }
};

window.gerarRelatorioAbsenteismo = function() {
    const filtroColab = document.getElementById('relColaborador').value;
    const filtroInicio = document.getElementById('relDataInicio').value;
    const filtroFim = document.getElementById('relDataFim').value;
    const filtroTipo = document.getElementById('relTipo').value;

    let filtrados = window.listaAbsenteismo;

    if (filtroColab !== 'TODOS') {
        filtrados = filtrados.filter(x => x.colaborador_id === filtroColab);
    }
    if (filtroTipo !== 'TODOS') {
        filtrados = filtrados.filter(x => x.tipo_registro === filtroTipo);
    }
    if (filtroInicio) {
        const dtIni = new Date(filtroInicio + 'T00:00:00');
        filtrados = filtrados.filter(x => new Date(x.data_inicio + 'T00:00:00') >= dtIni);
    }
    if (filtroFim) {
        const dtFim = new Date(filtroFim + 'T23:59:59');
        filtrados = filtrados.filter(x => new Date(x.data_inicio + 'T00:00:00') <= dtFim);
    }

    window.listaRelatorioFiltrada = filtrados;
    window.renderizarTabelaAbsenteismo();
};

window.imprimirRelatorioAbsenteismo = function() {
    if (typeof window.jspdf === 'undefined') {
        alert("Biblioteca PDF (jsPDF) não carregada. Atualize a página.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');

    doc.setFontSize(16);
    doc.setTextColor(41, 128, 185);
    doc.text("Relatório de Absenteísmo - Histórico Geral", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 28);

    const colabSelect = document.getElementById('relColaborador');
    const nomeFiltro = colabSelect.options[colabSelect.selectedIndex].text;
    doc.text(`Filtro Aplicado: ${nomeFiltro}`, 14, 34);

    const bodyData = [];
    const lista = window.listaRelatorioFiltrada;

    lista.forEach(item => {
        const nome = item.rh_colaboradores ? item.rh_colaboradores.nome : 'Removido';
        const mat = item.rh_colaboradores && item.rh_colaboradores.cod_funcionario ? String(item.rh_colaboradores.cod_funcionario).padStart(4, '0') : '-';
        
        let tipoStr = item.tipo_registro;
        if(tipoStr === 'BANCO_HORAS') tipoStr = 'Banco Horas';

        let dataOcorrencia = formatarData(item.data_inicio);
        if (item.data_fim && item.tipo_registro === 'ATESTADO') {
            dataOcorrencia += ' até ' + formatarData(item.data_fim);
        }

        let duracao = '';
        if (item.tipo_registro === 'ATESTADO') duracao = `${item.dias_afastamento || 1} dia(s)`;
        else if (item.tipo_registro === 'FALTA') duracao = 'Falta/Ausência';
        else duracao = `${item.quantidade_horas}h`;

        let motivoCid = item.motivo || '-';
        if (item.tipo_registro === 'ATESTADO' && item.cid) {
            motivoCid = `[CID: ${item.cid}] ${motivoCid}`;
        }

        bodyData.push([mat, nome, tipoStr, dataOcorrencia, duracao, motivoCid]);
    });

    doc.autoTable({
        startY: 40,
        head: [['Matrícula', 'Colaborador', 'Tipo', 'Período / Data', 'Duração', 'Motivo / Detalhes']],
        body: bodyData,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 9 }
    });

    doc.save(`Relatorio_Absenteismo_Serrana_${Date.now()}.pdf`);
};

window.renderizarDashboardAbsenteismo = function() {
    if (typeof echarts === 'undefined') return;

    let totalDiasPerdidos = 0;
    let mesAtualCount = 0;
    
    const hoje = new Date();
    const mesAtualStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    
    const freqCid = {};
    const chavesMeses = [];
    const mesesLabels = [];

    for (let i = 5; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        mesesLabels.push(label);
        chavesMeses.push({ key: key, countOcorrencias: 0, countDias: 0 });
    }

    window.listaAbsenteismo.forEach(item => {
        const dias = parseInt(item.quantidade_horas > 0 ? (item.quantidade_horas / 8) : (item.dias_afastamento || 1)) || 1;
        totalDiasPerdidos += dias;

        if (item.data_inicio) {
            const [ano, mes] = item.data_inicio.split('-');
            const key = `${ano}-${mes}`;
            
            if (key === mesAtualStr) {
                mesAtualCount++;
            }

            const targetMes = chavesMeses.find(m => m.key === key);
            if (targetMes) {
                targetMes.countOcorrencias++;
                targetMes.countDias += dias;
            }
        }

        let chaveCid = item.cid ? item.cid.trim().toUpperCase() : (item.motivo ? item.motivo.trim() : 'Outros');
        if (chaveCid === '') chaveCid = 'Outros';
        
        let nomeParaGrafico = window.dicionarioCid[chaveCid] || window.dicionarioCid[chaveCid.substring(0,3)];
        if(nomeParaGrafico) {
            chaveCid = `${chaveCid} - ${nomeParaGrafico.split(' (')[0].substring(0, 20)}...`;
        }
        freqCid[chaveCid] = (freqCid[chaveCid] || 0) + 1;
    });

    const cidArray = Object.keys(freqCid).map(k => ({ name: k, value: freqCid[k] }));
    cidArray.sort((a,b) => b.value - a.value);
    
    const top1Cid = cidArray.length > 0 ? cidArray[0].name : 'Nenhum';
    const top5Cid = cidArray.slice(0, 5);

    if (document.getElementById('kpiTotalAbsenteismo')) document.getElementById('kpiTotalAbsenteismo').innerText = window.listaAbsenteismo.length;
    if (document.getElementById('kpiDiasPerdidos')) document.getElementById('kpiDiasPerdidos').innerText = totalDiasPerdidos;
    if (document.getElementById('kpiAbsenteismoMes')) document.getElementById('kpiAbsenteismoMes').innerText = mesAtualCount;
    if (document.getElementById('kpiTopCid')) {
        document.getElementById('kpiTopCid').innerText = top1Cid;
        document.getElementById('kpiTopCid').title = top1Cid;
    }

    const dataOcorrencias = chavesMeses.map(c => c.countOcorrencias);
    const dataDias = chavesMeses.map(c => c.countDias);

    const domEvolucao = document.getElementById('chartAbsenteismoEvolucao');
    if (domEvolucao) {
        if (window.graficoEvolucaoAbs) window.graficoEvolucaoAbs.dispose();
        window.graficoEvolucaoAbs = echarts.init(domEvolucao);

        window.graficoEvolucaoAbs.setOption({
            tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
            legend: { data: ['Dias Perdidos', 'Ocorrências'], textStyle: { color: '#9ca3af' } },
            grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
            xAxis: { type: 'category', data: mesesLabels, axisLabel: { color: '#9ca3af' }, axisLine: { lineStyle: { color: '#374151' } } },
            yAxis: [{ type: 'value', name: 'Dias', axisLabel: { color: '#9ca3af' }, splitLine: { lineStyle: { color: '#374151', type: 'dashed' } } }, { type: 'value', name: 'Qtd', axisLabel: { color: '#9ca3af' }, splitLine: { show: false } }],
            series: [
                { name: 'Dias Perdidos', type: 'bar', barWidth: '40%', data: dataDias, itemStyle: { color: '#ef4444', borderRadius: [4, 4, 0, 0] } },
                { name: 'Ocorrências', type: 'line', yAxisIndex: 1, data: dataOcorrencias, itemStyle: { color: '#60a5fa' }, lineStyle: { width: 3 }, symbolSize: 8 }
            ]
        });
    }

    const domCid = document.getElementById('chartAbsenteismoCid');
    if (domCid) {
        if (window.graficoCidAbs) window.graficoCidAbs.dispose();
        window.graficoCidAbs = echarts.init(domCid);

        window.graficoCidAbs.setOption({
            tooltip: { trigger: 'item', formatter: '{b}: {c} ocorrência(s) ({d}%)' },
            legend: { top: 'bottom', textStyle: { color: '#9ca3af' } },
            color: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'],
            series: [{
                type: 'pie', radius: ['45%', '75%'], avoidLabelOverlap: false,
                itemStyle: { borderRadius: 8, borderColor: '#1f2937', borderWidth: 3 },
                label: { show: false, position: 'center' },
                emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold', color: '#fff' } },
                data: top5Cid.length > 0 ? top5Cid : [{ name: 'Sem dados', value: 0 }]
            }]
        });
    }
};

function formatarData(dataIso) {
    if(!dataIso) return '-';
    const [ano, mes, dia] = dataIso.split('-');
    return `${dia}/${mes}/${ano}`;
}

window.alterarStatusRH = async function(id, novoStatus) {
    try {
        await window.supabaseClient.from('rh_absenteismo').update({ status_rh: novoStatus }).eq('id', id);
        
        const idx = window.listaAbsenteismo.findIndex(x => x.id === id);
        if(idx > -1) window.listaAbsenteismo[idx].status_rh = novoStatus;
        
        const idxRel = window.listaRelatorioFiltrada.findIndex(x => x.id === id);
        if(idxRel > -1) window.listaRelatorioFiltrada[idxRel].status_rh = novoStatus;
        
        window.renderizarTabelaAbsenteismo();
        
        if (typeof window.registrarLogAuditoria === 'function') {
            window.registrarLogAuditoria('RH', 'Absenteísmo', `Status da falta/ausência alterado para ${novoStatus}`, 'Info');
        }
    } catch(e) {
        console.error(e);
        alert('Erro ao atualizar o status da ausência.');
    }
};

window.renderizarTabelaAbsenteismo = function() {
    const thead = document.getElementById('headerAbsenteismo');
    const tbody = document.getElementById('tbAbsenteismo');
    if (!thead || !tbody) return; 

    let htmlHead = '';
    
    if(window.abaAtualAbsenteismo === 'todos' || window.abaAtualAbsenteismo === 'relatorio') {
        htmlHead = `<th>Lançado em</th><th>Colaborador</th><th>Tipo</th><th>Detalhes / Médico / CID</th><th>Período / Horas</th><th>Anexo</th><th>Ações</th>`;
    } else if(window.abaAtualAbsenteismo === 'ATESTADO') {
        htmlHead = `<th>Lançado em</th><th>Colaborador</th><th>Período / Data Retorno</th><th>Médico e CID</th><th>Motivo</th><th>Anexo</th><th>Ações</th>`;
    } else if(window.abaAtualAbsenteismo === 'FALTA') {
        htmlHead = `<th>Lançado em</th><th>Colaborador</th><th>Data da Falta</th><th>Classificação</th><th>Status RH</th><th>Anexo</th><th>Ações</th>`;
    } else if(window.abaAtualAbsenteismo === 'BANCO_HORAS') {
        htmlHead = `<th>Lançado em</th><th>Colaborador</th><th>Data Referência</th><th>Horas Lançadas</th><th>Motivo Lançamento</th><th>Anexo</th><th>Ações</th>`;
    } else if(window.abaAtualAbsenteismo === 'CONVOCADOS_EXTRA') {
        htmlHead = `<th>Criado em</th><th>Colaborador</th><th>Data da Extra</th><th>Veículo Assumido</th><th>Turno Realizado</th><th style="text-align: right;">Ações</th>`;
    }
    
    thead.innerHTML = htmlHead;
    tbody.innerHTML = '';

    if (window.abaAtualAbsenteismo === 'CONVOCADOS_EXTRA') {
        if (window.listaConvocadosExtraBH.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#9ca3af; padding: 20px;">Nenhum motorista convocado em dia de folga localizado.</td></tr>`;
            return;
        }
        
        window.listaConvocadosExtraBH.forEach(item => {
            let dataCriacao = '-';
            if (item.created_at) {
                const dateObj = new Date(item.created_at);
                dataCriacao = dateObj.toLocaleDateString('pt-BR') + ' às ' + dateObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
            }
            
            const colabNome = item.rh_colaboradores ? item.rh_colaboradores.nome : '<span style="color:#ef4444;">Removido</span>';
            const mat = item.rh_colaboradores && item.rh_colaboradores.cod_funcionario ? `[${String(item.rh_colaboradores.cod_funcionario).padStart(4, '0')}]` : '';
            const dataExtraFmt = item.data_extra ? item.data_extra.split('-').reverse().join('/') : '-';
            
            tbody.innerHTML += `
                <tr>
                    <td style="font-size: 0.8rem; color: #94a3b8;">${dataCriacao}</td>
                    <td style="text-align:left;"><b><span style="color:var(--text-secondary); font-size:0.8rem;">${mat}</span> ${colabNome}</b></td>
                    <td><span style="background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 3px 8px; border-radius: 12px; font-weight: bold; font-size: 0.85rem;"><i class="fas fa-calendar-day"></i> ${dataExtraFmt}</span></td>
                    <td><strong style="color: var(--ccol-blue-bright); font-size: 1.05rem;">${item.caminhao_placa || '-'}</strong></td>
                    <td><span class="search-input-dark" style="padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; border: 1px solid var(--border-dim);">${item.turno || '-'}</span></td>
                    <td style="text-align: right;">
                        <button class="btn-icon-only" onclick="window.excluirConvocadoExtra('${item.id}', '${item.data_extra}', '${colabNome}')" title="Excluir Convocação"><i class="fas fa-trash" style="color:#ef4444;"></i></button>
                    </td>
                </tr>
            `;
        });
        return;
    }

    let lista = window.listaAbsenteismo;
    if (window.abaAtualAbsenteismo === 'relatorio') {
        lista = window.listaRelatorioFiltrada;
    } else if (window.abaAtualAbsenteismo !== 'todos') {
        lista = lista.filter(item => item.tipo_registro === window.abaAtualAbsenteismo);
    }

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#9ca3af; padding: 20px;">Nenhum registro encontrado nesta visualização.</td></tr>`;
        return;
    }

    lista.forEach(item => {
        let dataLancamento = '-';
        if(item.created_at) {
            const dateObj = new Date(item.created_at);
            dataLancamento = dateObj.toLocaleDateString('pt-BR') + ' às ' + dateObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        }

        const nomeColaborador = item.rh_colaboradores ? item.rh_colaboradores.nome : '<span style="color:#ef4444;">Removido</span>';
        const mat = item.rh_colaboradores ? `[${String(item.rh_colaboradores.cod_funcionario).padStart(4, '0')}]` : '';
        const btnExcluir = `<button class="btn-icon-only" onclick="window.excluirAbsenteismo('${item.id}', '${item.anexo_url}')" title="Excluir"><i class="fas fa-trash" style="color:#ef4444;"></i></button>`;
        const btnAnexo = item.anexo_url 
            ? `<a href="${item.anexo_url}" target="_blank" class="btn-primary-blue" style="padding:4px 8px; font-size:0.75rem; text-decoration:none; border-radius:4px;"><i class="fas fa-paperclip"></i> Ver</a>` 
            : `<button class="btn-secondary-dark" onclick="window.abrirModalAnexoAbs('${item.id}')" style="padding:4px 8px; font-size:0.75rem; border-radius:4px;"><i class="fas fa-paperclip"></i> Anexar</button>`;

        let tr = document.createElement('tr');
        if(window.abaAtualAbsenteismo === 'todos' || window.abaAtualAbsenteismo === 'relatorio') {
            let badge = '';
            if(item.tipo_registro === 'ATESTADO') {
                badge = '<span style="background:rgba(96,165,250,0.2); color:var(--ccol-blue-bright); padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">Atestado</span>';
            } else if(item.tipo_registro === 'FALTA') {
                let statusRh = item.status_rh || 'Pendente';
                let corStatus = statusRh === 'Tratado' ? 'var(--ccol-green-bright)' : (statusRh === 'Pendente' ? '#f59e0b' : '#3b82f6');
                badge = `<span style="background:rgba(239,68,68,0.2); color:#ef4444; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">Falta/Ausência</span>
                         <span style="border: 1px solid ${corStatus}; color:${corStatus}; padding:2px 6px; border-radius:12px; font-size:0.7rem; font-weight:bold; margin-left: 5px;">${statusRh}</span>`;
            } else {
                badge = '<span style="background:rgba(61,220,132,0.2); color:var(--ccol-green-bright); padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">Banco Horas</span>';
            }

            let detalhesHTML = item.tipo_registro === 'ATESTADO' 
                 ? `<strong style="color:var(--ccol-blue-bright);"><i class="fas fa-user-md"></i> ${item.medico_nome || '-'}</strong><br><strong style="color:#f59e0b;">CID: ${item.cid || 'N/A'}</strong> - ${item.motivo || ''}`
                 : `<span>${item.motivo || '-'}</span>`;
            
            let periodoHTML = item.tipo_registro === 'ATESTADO'
                ? `${formatarData(item.data_inicio)} <i class="fas fa-arrow-right" style="font-size:0.7rem;"></i> <strong>${item.dias_afastamento || 1} dias</strong>`
                : (item.tipo_registro === 'FALTA' ? `${formatarData(item.data_inicio)}` : `${formatarData(item.data_inicio)} (<strong style="color:var(--ccol-green-bright);">${item.quantidade_horas}h</strong>)`);

            tr.innerHTML = `
                <td style="font-size: 0.8rem; color: #94a3b8;">${dataLancamento}</td>
                <td style="text-align:left;"><b><span style="color:var(--text-secondary); font-size:0.8rem;">${mat}</span> ${nomeColaborador}</b></td>
                <td>${badge}</td>
                <td style="text-align:left;">${detalhesHTML}</td>
                <td>${periodoHTML}</td>
                <td>${btnAnexo}</td>
                <td>${btnExcluir}</td>
            `;
        } else if (window.abaAtualAbsenteismo === 'ATESTADO') {
            tr.innerHTML = `
                <td style="font-size: 0.8rem; color: #94a3b8;">${dataLancamento}</td>
                <td style="text-align:left;"><b>${mat} ${nomeColaborador}</b></td>
                <td>${formatarData(item.data_inicio)} <i class="fas fa-arrow-right" style="font-size:0.7rem;"></i> ${item.data_fim ? formatarData(item.data_fim) : '-'}</td>
                <td style="text-align:left;"><strong style="color:#f59e0b;">CID: ${item.cid || 'N/A'}</strong><br>${item.medico_nome || '-'}</td>
                <td>${item.motivo || '-'}</td>
                <td>${btnAnexo}</td>
                <td>${btnExcluir}</td>
            `;
        } else if (window.abaAtualAbsenteismo === 'FALTA') {
            let statusRh = item.status_rh || 'Pendente';
            let corStatus = statusRh === 'Tratado' ? 'var(--ccol-green-bright)' : (statusRh === 'Pendente' ? '#f59e0b' : '#3b82f6');
            let selectStatus = `<select class="dark-select" onchange="window.alterarStatusRH('${item.id}', this.value)" style="background: rgba(0,0,0,0.3); color: ${corStatus}; border: 1px solid ${corStatus}; padding: 4px; border-radius: 4px; font-weight: bold; outline: none;">
                <option value="Pendente" style="background-color: #1e293b; color: #ffffff;" ${statusRh === 'Pendente' ? 'selected' : ''}>Pendente</option>
                <option value="Aprovado" style="background-color: #1e293b; color: #ffffff;" ${statusRh === 'Aprovado' ? 'selected' : ''}>Aprovado</option>
                <option value="Tratado" style="background-color: #1e293b; color: #ffffff;" ${statusRh === 'Tratado' ? 'selected' : ''}>Tratado</option>
            </select>`;

            tr.innerHTML = `
                <td style="font-size: 0.8rem; color: #94a3b8;">${dataLancamento}</td>
                <td style="text-align:left;"><b>${mat} ${nomeColaborador}</b></td>
                <td>${formatarData(item.data_inicio)}</td>
                <td>${item.motivo || '-'}</td>
                <td>${selectStatus}</td>
                <td>${btnAnexo}</td>
                <td>${btnExcluir}</td>
            `;
        } else if (window.abaAtualAbsenteismo === 'BANCO_HORAS') {
            tr.innerHTML = `
                <td style="font-size: 0.8rem; color: #94a3b8;">${dataLancamento}</td>
                <td style="text-align:left;"><b>${mat} ${nomeColaborador}</b></td>
                <td>${formatarData(item.data_inicio)}</td>
                <td><span style="color:var(--ccol-green-bright); font-weight:bold;">${item.quantidade_horas} hrs</span></td>
                <td>${item.motivo || '-'}</td>
                <td>${btnAnexo}</td>
                <td>${btnExcluir}</td>
            `;
        }

        tbody.appendChild(tr);
    });
};

window.filtrarAbsenteismo = function() {
    const termo = document.getElementById('buscaAbsenteismo').value.toLowerCase();
    
    if (window.abaAtualAbsenteismo === 'relatorio') {
        alert("Na aba de Relatórios, utilize os filtros de Colaborador e Datas acima da tabela.");
        return;
    }

    if (window.abaAtualAbsenteismo === 'CONVOCADOS_EXTRA') {
        const filtradosBH = window.listaConvocadosExtraBH.filter(b => {
            const nome = b.rh_colaboradores ? b.rh_colaboradores.nome.toLowerCase() : '';
            const placa = b.caminhao_placa ? b.caminhao_placa.toLowerCase() : '';
            return nome.includes(termo) || placa.includes(termo);
        });
        const backupBH = window.listaConvocadosExtraBH;
        window.listaConvocadosExtraBH = filtradosBH;
        window.renderizarTabelaAbsenteismo();
        window.listaConvocadosExtraBH = backupBH;
        return;
    }

    const filtrados = window.listaAbsenteismo.filter(a => {
        const nome = a.rh_colaboradores ? a.rh_colaboradores.nome.toLowerCase() : '';
        const cid = a.cid ? a.cid.toLowerCase() : '';
        const motivo = a.motivo ? a.motivo.toLowerCase() : '';
        const medico = a.medico_nome ? a.medico_nome.toLowerCase() : '';
        return nome.includes(termo) || cid.includes(termo) || motivo.includes(termo) || medico.includes(termo);
    });
    
    const backupLista = window.listaAbsenteismo;
    window.listaAbsenteismo = filtrados;
    window.renderizarTabelaAbsenteismo();
    window.listaAbsenteismo = backupLista;
};

window.adicionarDataFalta = function() {
    const inputData = document.getElementById('absDataInicio');
    const dataVal = inputData.value;
    
    if (!dataVal) {
        alert('Selecione uma data no calendário antes de clicar no "+".');
        return;
    }

    if (window.datasMultiplasFalta.includes(dataVal)) {
        alert('Esta data já foi adicionada na lista.');
        return;
    }

    window.datasMultiplasFalta.push(dataVal);
    window.renderizarMultiDatas();
    inputData.value = '';
};

window.removerDataFalta = function(dataStr) {
    window.datasMultiplasFalta = window.datasMultiplasFalta.filter(d => d !== dataStr);
    window.renderizarMultiDatas();
};

window.renderizarMultiDatas = function() {
    const container = document.getElementById('containerMultiDatas');
    if (!container) return;
    
    container.innerHTML = '';
    window.datasMultiplasFalta.sort().forEach(dataStr => {
        const [ano, mes, dia] = dataStr.split('-');
        const dataFormatada = `${dia}/${mes}/${ano}`;
        
        container.innerHTML += `
            <div style="background: rgba(59, 130, 246, 0.2); border: 1px solid var(--ccol-blue-bright); color: #fff; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-calendar-day" style="color: var(--ccol-blue-bright);"></i> ${dataFormatada}
                <i class="fas fa-times" style="color: #ef4444; cursor: pointer;" onclick="window.removerDataFalta('${dataStr}')" title="Remover"></i>
            </div>
        `;
    });
};

window.abrirModalAbsenteismo = function(tipo) {
    const selectColaborador = document.getElementById('absColaborador');
    selectColaborador.innerHTML = '<option value="">Selecione um colaborador...</option>';
    window.listaParaSelectColaboradores.forEach(c => {
        const matricula = c.cod_funcionario ? String(c.cod_funcionario).padStart(4, '0') : '-';
        selectColaborador.innerHTML += `<option value="${c.id}">[${matricula}] ${c.nome}</option>`;
    });

    document.getElementById('absTipoRegistro').value = tipo;
    document.getElementById('absDataInicio').value = '';
    document.getElementById('absDias').value = '';
    document.getElementById('absHoras').value = '';
    document.getElementById('absDataRetorno').value = '';
    document.getElementById('absCid').value = '';
    document.getElementById('absMotivo').value = '';
    document.getElementById('absMedicoNome').value = '';
    document.getElementById('absMedicoCrm').value = '';
    document.getElementById('absAnexo').value = '';
    document.getElementById('absObservacoes').value = '';
    document.getElementById('absCidDescricao').innerText = '';

    window.datasMultiplasFalta = [];
    const containerMultiDatas = document.getElementById('containerMultiDatas');
    const btnAddMulti = document.getElementById('btnAdicionarMultiData');
    const labelDataInicio = document.getElementById('labelDataInicio');
    if (containerMultiDatas) {
        containerMultiDatas.innerHTML = '';
        containerMultiDatas.style.display = tipo === 'FALTA' ? 'flex' : 'none';
    }
    if (btnAddMulti) btnAddMulti.style.display = tipo === 'FALTA' ? 'block' : 'none';

    const gDias = document.getElementById('grupoDiasAtestado');
    const gHoras = document.getElementById('grupoHorasAusencia');
    const gRetorno = document.getElementById('grupoDataRetorno');
    const gMedico = document.getElementById('grupoMedicoNome');
    const gCrm = document.getElementById('grupoMedicoCrm');
    const gCid = document.getElementById('grupoCid');
    const gAnexo = document.getElementById('grupoAnexo');
    const gClassificacao = document.getElementById('grupoClassificacao');
    const gMotivo = document.getElementById('grupoMotivo');
    const lblMotivo = document.getElementById('labelMotivoDinamico');
    const tituloModal = document.getElementById('absModalTitulo');
    
    if (gClassificacao) gClassificacao.style.display = 'none';

    if (tipo === 'ATESTADO') {
        tituloModal.innerHTML = '<i class="fas fa-notes-medical" style="color:var(--ccol-blue-bright);"></i> Lançar Atestado';
        labelDataInicio.innerText = 'Data de Início *';
        gDias.style.display = 'block';
        gHoras.style.display = 'none';
        gRetorno.style.display = 'block';
        gMedico.style.display = 'block';
        gCrm.style.display = 'block';
        gCid.style.display = 'block';
        gAnexo.style.display = 'block';
        gMotivo.style.display = 'block';
        lblMotivo.innerText = 'Motivo / Resumo *';
    } else if (tipo === 'FALTA') {
        tituloModal.innerHTML = '<i class="fas fa-user-times" style="color:#ef4444;"></i> Lançar Falta / Ausência';
        labelDataInicio.innerText = 'Selecione a(s) Data(s) da Falta *';
        gDias.style.display = 'none';
        gHoras.style.display = 'none';
        gRetorno.style.display = 'none';
        gMedico.style.display = 'none';
        gCrm.style.display = 'none';
        gCid.style.display = 'none';
        gAnexo.style.display = 'none';
        
        if (gClassificacao) gClassificacao.style.display = 'block';
        document.getElementById('absClassificacaoSelect').value = 'Falta Injustificada';
        window.verificarClassificacaoOutros();

        lblMotivo.innerText = 'Descreva o Motivo *';
    } else if (tipo === 'BANCO_HORAS') {
        tituloModal.innerHTML = '<i class="fas fa-business-time" style="color:var(--ccol-green-bright);"></i> Lançar Banco de Horas';
        labelDataInicio.innerText = 'Data de Ocorrência *';
        gDias.style.display = 'none';
        gHoras.style.display = 'block';
        gRetorno.style.display = 'none';
        gMedico.style.display = 'none';
        gCrm.style.display = 'none';
        gCid.style.display = 'none';
        gAnexo.style.display = 'none';
        gMotivo.style.display = 'block';
        lblMotivo.innerText = 'Motivo (Crédito ou Débito) *';
    }

    document.getElementById('modalAbsenteismo').classList.add('show');
};

window.fecharModalAbsenteismo = function() {
    document.getElementById('modalAbsenteismo').classList.remove('show');
};

window.verificarClassificacaoOutros = function() {
    const select = document.getElementById('absClassificacaoSelect');
    const grupoMotivo = document.getElementById('grupoMotivo');
    const inputMotivo = document.getElementById('absMotivo');
    
    if (select.value === 'Outros') {
        grupoMotivo.style.display = 'block';
        inputMotivo.value = '';
    } else {
        grupoMotivo.style.display = 'none';
        inputMotivo.value = select.value;
    }
};

window.calcularDataRetornoAbs = function() {
    const dataStr = document.getElementById('absDataInicio').value;
    const dias = parseInt(document.getElementById('absDias').value);

    if (dataStr && !isNaN(dias) && dias > 0) {
        const [anoStr, mesStr, diaStr] = dataStr.split('-');
        const dataIncial = new Date(anoStr, mesStr - 1, diaStr);
        dataIncial.setDate(dataIncial.getDate() + dias);
        
        const ano = dataIncial.getFullYear();
        const mes = String(dataIncial.getMonth() + 1).padStart(2, '0');
        const dia = String(dataIncial.getDate()).padStart(2, '0');
        
        document.getElementById('absDataRetorno').value = `${ano}-${mes}-${dia}`;
    } else {
        document.getElementById('absDataRetorno').value = '';
    }
};

window.salvarAbsenteismo = async function() {
    const colaboradorId = document.getElementById('absColaborador').value;
    const tipo = document.getElementById('absTipoRegistro').value;
    const motivo = document.getElementById('absMotivo').value;

    let datasParaSalvar = [];
    const dataInputVal = document.getElementById('absDataInicio').value;

    if (tipo === 'FALTA') {
        if (dataInputVal && !window.datasMultiplasFalta.includes(dataInputVal)) {
            datasParaSalvar.push(dataInputVal);
        }
        datasParaSalvar.push(...window.datasMultiplasFalta);
        
        if (datasParaSalvar.length === 0) {
            alert('Por favor, informe ao menos uma data de falta ou ausência.');
            return;
        }
    } else {
        if (!dataInputVal) {
            alert('Por favor, informe a Data da Ocorrência.');
            return;
        }
        datasParaSalvar.push(dataInputVal);
    }

    if (!colaboradorId || !motivo) {
        alert('Por favor, preencha o Colaborador e o Motivo.');
        return;
    }

    const btnSalvar = document.getElementById('btnSalvarAbsenteismo');
    const txtOriginal = btnSalvar.innerHTML;
    btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
    btnSalvar.disabled = true;

    let anexoUrlFinal = null;
    const fileInput = document.getElementById('absAnexo');

    try {
        if (tipo === 'ATESTADO' && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_colab${colaboradorId}.${fileExt}`;
            
            const { error } = await window.supabaseClient.storage.from('atestados').upload(fileName, file, { upsert: true });
            if (error) throw error;
            
            const { data: publicUrlData } = window.supabaseClient.storage.from('atestados').getPublicUrl(fileName);
            anexoUrlFinal = publicUrlData.publicUrl;
        }

        for (const dataOcorrencia of datasParaSalvar) {
            const dados = {
                colaborador_id: colaboradorId,
                tipo_registro: tipo,
                data_inicio: dataOcorrencia,
                dias_afastamento: tipo === 'ATESTADO' ? (parseInt(document.getElementById('absDias').value) || 1) : null,
                data_retorno: tipo === 'ATESTADO' ? document.getElementById('absDataRetorno').value : null,
                quantidade_horas: tipo !== 'ATESTADO' ? (parseFloat(document.getElementById('absHoras').value) || 0) : 0,
                cid: tipo === 'ATESTADO' ? document.getElementById('absCid').value.toUpperCase() : null,
                motivo: motivo,
                status_rh: tipo === 'FALTA' ? 'Pendente' : null,
                observacoes: document.getElementById('absObservacoes').value,
                medico_nome: tipo === 'ATESTADO' ? document.getElementById('absMedicoNome').value : null,
                medico_crm: tipo === 'ATESTADO' ? document.getElementById('absMedicoCrm').value : null,
                anexo_url: anexoUrlFinal
            };

            await db.addAbsenteismo(dados);
        }
        
        if (typeof window.registrarLogAuditoria === 'function') {
            window.registrarLogAuditoria('RH', 'Absenteísmo', `Lançamento de ${tipo} efetuado para ${datasParaSalvar.length} dia(s)`, 'Alerta');
        }
        
        window.fecharModalAbsenteismo();
        
        if (document.getElementById('tbAbsenteismo')) {
            await window.carregarAbsenteismo();
        } else {
            alert('Registro salvo com sucesso!');
        }

    } catch (e) {
        console.error(e);
        alert('Erro ao salvar registro. Verifique os campos e conexão.');
    } finally {
        btnSalvar.innerHTML = txtOriginal;
        btnSalvar.disabled = false;
    }
};

window.abrirModalAnexoAbs = function(id) {
    document.getElementById('absAnexoId').value = id;
    document.getElementById('fileAnexoAbs').value = '';
    document.getElementById('modalAnexoAbs').classList.add('show');
    document.getElementById('modalAnexoAbs').style.display = 'flex';
};

window.fecharModalAnexoAbs = function() {
    document.getElementById('modalAnexoAbs').classList.remove('show');
    document.getElementById('modalAnexoAbs').style.display = 'none';
};

window.salvarAnexoAbs = async function() {
    const id = document.getElementById('absAnexoId').value;
    const fileInput = document.getElementById('fileAnexoAbs');
    
    if (fileInput.files.length === 0) {
        alert('Selecione um arquivo (PDF ou Imagem) para anexar.');
        return;
    }
    
    const btnSalvar = document.getElementById('btnSalvarAnexoAbs');
    const txtOriginal = btnSalvar.innerHTML;
    btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    btnSalvar.disabled = true;

    try {
        const file = fileInput.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_abs_${id}.${fileExt}`;
        
        const { error: uploadError } = await window.supabaseClient.storage.from('atestados').upload(fileName, file, { upsert: true });
        if (uploadError) throw uploadError;
        
        const { data: publicUrlData } = window.supabaseClient.storage.from('atestados').getPublicUrl(fileName);
        const anexoUrlFinal = publicUrlData.publicUrl;

        const { error: updateError } = await window.supabaseClient.from('rh_absenteismo').update({ anexo_url: anexoUrlFinal }).eq('id', id);
        if (updateError) throw updateError;

        alert('Anexo salvo com sucesso!');
        window.fecharModalAnexoAbs();
        await window.carregarAbsenteismo();
    } catch (e) {
        console.error("Erro ao enviar anexo:", e);
        alert('Erro ao enviar o anexo. Tente novamente.');
    } finally {
        btnSalvar.innerHTML = txtOriginal;
        btnSalvar.disabled = false;
    }
};

window.excluirAbsenteismo = async function(id, anexoUrl) {
    const userRole = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.role : '';
    const isRH = userRole && typeof userRole === 'string' && userRole.toUpperCase().includes('RH');
    const allowedRoles = ['Supervisor', 'Admin', 'SuperAdmin'];
    
    if (!isRH && !allowedRoles.includes(userRole)) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'Acesso Negado',
                text: 'Apenas usuários com a função relacionada ao RH, Supervisor ou Admin podem excluir registros de absenteísmo.',
                confirmButtonColor: '#ef4444',
                background: '#1e293b',
                color: '#fff'
            });
        } else {
            alert('Acesso Negado: Apenas a função ligada ao RH ou Supervisor pode excluir registros.');
        }
        return;
    }

    if (confirm('Atenção: Deseja realmente excluir este lançamento?')) {
        try {
            if (anexoUrl && anexoUrl !== 'null') {
                try {
                    const urlParts = anexoUrl.split('/');
                    const fileName = urlParts[urlParts.length - 1];
                    await window.supabaseClient.storage.from('atestados').remove([fileName]);
                } catch (errStorage) {
                    console.warn("Erro ao remover anexo do storage:", errStorage);
                }
            }

            await window.supabaseClient.from('rh_absenteismo').delete().eq('id', id);
            
            if (typeof window.registrarLogAuditoria === 'function') window.registrarLogAuditoria('RH', 'Absenteísmo', `Registro de ausência/falta excluído do sistema (ID ${id})`, 'Crítico');
            
            if (typeof window.carregarAbsenteismo === 'function') await window.carregarAbsenteismo();
            if (document.getElementById('escalaContainer')) window.renderizarEscala();
            
        } catch (e) {
            console.error(e);
            alert('Erro ao excluir o registro do banco de dados.');
        }
    }
};

window.excluirConvocadoExtra = async function(id, dataBH, colabNome) {
    const userRole = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.role : '';
    const isRH = userRole && typeof userRole === 'string' && userRole.toUpperCase().includes('RH');
    const allowedRoles = ['Supervisor', 'Admin', 'SuperAdmin'];
    
    if (!isRH && !allowedRoles.includes(userRole)) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'Acesso Negado',
                text: 'Apenas usuários com a função relacionada ao RH, Supervisor ou Admin podem excluir registros do banco de horas/extras.',
                confirmButtonColor: '#ef4444',
                background: '#1e293b',
                color: '#fff'
            });
        } else {
            alert('Acesso Negado: Apenas a função ligada ao RH ou Supervisor pode excluir registros.');
        }
        return;
    }

    if (!confirm(`Deseja remover a convocação extra do motorista ${colabNome} no dia ${dataBH.split('-').reverse().join('/')}?`)) return;
    
    try {
        await window.supabaseClient.from('rh_banco_horas').delete().eq('id', id);
        
        if (typeof window.registrarLogAuditoria === 'function') window.registrarLogAuditoria('RH', 'Banco de Horas', `Convocação Extra excluída do sistema para ${colabNome} (ID ${id})`, 'Crítico');
        
        alert('Convocação extra removida com sucesso. Observação: A exclusão na tabela não altera escalas manuais já consolidadas na folha operacional da logística.');
        await window.carregarAbsenteismo();
    } catch(e) {
        console.error(e);
        alert('Erro ao excluir registro de banco de horas.');
    }
};