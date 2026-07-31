console.log("Módulo de Absenteísmo e Relatórios carregado com sucesso!");

window.listaAbsenteismo = [];
window.listaRelatorioFiltrada = [];
window.listaParaSelectColaboradores = [];
window.graficoEvolucaoAbs = null;
window.graficoCidAbs = null;
window.abaAtualAbsenteismo = 'todos';

// ==============================================================
// DICIONÁRIO INTELIGENTE DOS CIDs OCUPACIONAIS
// ==============================================================
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
        
        // Popula o select do relatório também
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
        window.listaRelatorioFiltrada = window.listaAbsenteismo; // Inicia igual
        
        window.renderizarDashboardAbsenteismo();
        window.renderizarTabelaAbsenteismo();
    } catch (e) {
        console.error(e);
        alert("Erro ao carregar dados de absenteísmo.");
    }
};

// ==============================================================
// GESTÃO DE ABAS E RELATÓRIO
// ==============================================================
window.mudarAbaAbsenteismo = function(aba) {
    window.abaAtualAbsenteismo = aba;
    
    const abas = ['todos', 'ATESTADO', 'FALTA', 'BANCO_HORAS', 'relatorio'];
    abas.forEach(a => {
        const btn = document.getElementById('tabBtn_' + a);
        if(btn) {
            btn.className = (a === aba) ? 'btn-primary-blue' : 'btn-secondary-dark';
            if (a === 'relatorio' && aba !== 'relatorio') {
                btn.style.borderColor = 'var(--ccol-rust-bright)';
                btn.style.color = 'var(--ccol-rust-bright)';
                btn.style.background = 'transparent';
            }
        }
    });

    const painelFiltro = document.getElementById('painelFiltrosRelatorio');
    if (aba === 'relatorio') {
        painelFiltro.style.display = 'flex';
        window.gerarRelatorioAbsenteismo(); // Executa o filtro logo ao entrar
    } else {
        painelFiltro.style.display = 'none';
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
    const doc = new jsPDF('landscape'); // Formato deitado para caber os dados

    doc.setFontSize(16);
    doc.setTextColor(41, 128, 185);
    doc.text("Relatório de Absenteísmo - Histórico Geral", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 28);

    // Identifica o filtro selecionado
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
        else if (item.tipo_registro === 'FALTA') duracao = item.quantidade_horas ? `${item.quantidade_horas}h` : 'Integral';
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

// ==============================================================
// DASHBOARD
// ==============================================================
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

    // Atualiza KPIs
    document.getElementById('kpiTotalAbsenteismo').innerText = window.listaAbsenteismo.length;
    document.getElementById('kpiDiasPerdidos').innerText = totalDiasPerdidos;
    document.getElementById('kpiAbsenteismoMes').innerText = mesAtualCount;
    document.getElementById('kpiTopCid').innerText = top1Cid;
    document.getElementById('kpiTopCid').title = top1Cid;

    // Gráfico de Evolução
    const dataOcorrencias = chavesMeses.map(c => c.countOcorrencias);
    const dataDias = chavesMeses.map(c => c.countDias);

    const domEvolucao = document.getElementById('chartAbsenteismoEvolucao');
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

    // Gráfico de CID/Motivos (Donut)
    const domCid = document.getElementById('chartAbsenteismoCid');
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
};

function formatarData(dataIso) {
    if(!dataIso) return '-';
    const [ano, mes, dia] = dataIso.split('-');
    return `${dia}/${mes}/${ano}`;
}

// ==============================================================
// RENDERIZAÇÃO DA TABELA PRINCIPAL
// ==============================================================
window.renderizarTabelaAbsenteismo = function() {
    const thead = document.getElementById('headerAbsenteismo');
    const tbody = document.getElementById('tbAbsenteismo');
    if (!thead || !tbody) return;

    let htmlHead = '';
    
    // Configura o cabeçalho de acordo com a aba
    if(window.abaAtualAbsenteismo === 'todos' || window.abaAtualAbsenteismo === 'relatorio') {
        htmlHead = `<th>Lançado em</th><th>Colaborador</th><th>Tipo</th><th>Detalhes / Médico / CID</th><th>Período / Horas</th><th>Anexo</th><th>Ações</th>`;
    } else if(window.abaAtualAbsenteismo === 'ATESTADO') {
        htmlHead = `<th>Lançado em</th><th>Colaborador</th><th>Período / Data Retorno</th><th>Médico e CID</th><th>Motivo</th><th>Anexo</th><th>Ações</th>`;
    } else if(window.abaAtualAbsenteismo === 'FALTA') {
        htmlHead = `<th>Lançado em</th><th>Colaborador</th><th>Data da Falta</th><th>Horas Descontadas</th><th>Classificação</th><th>Ações</th>`;
    } else if(window.abaAtualAbsenteismo === 'BANCO_HORAS') {
        htmlHead = `<th>Lançado em</th><th>Colaborador</th><th>Data Referência</th><th>Horas Lançadas</th><th>Motivo Lançamento</th><th>Ações</th>`;
    }
    
    thead.innerHTML = htmlHead;
    tbody.innerHTML = '';

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
        const btnAnexo = item.anexo_url ? `<a href="${item.anexo_url}" target="_blank" class="btn-primary-blue" style="padding:4px 8px; font-size:0.75rem; text-decoration:none; border-radius:4px;"><i class="fas fa-paperclip"></i> Ver</a>` : '<span style="color:#64748b; font-size:0.8rem;">-</span>';

        let tr = document.createElement('tr');

        if(window.abaAtualAbsenteismo === 'todos' || window.abaAtualAbsenteismo === 'relatorio') {
            let badge = '';
            if(item.tipo_registro === 'ATESTADO') badge = '<span style="background:rgba(96,165,250,0.2); color:var(--ccol-blue-bright); padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">Atestado</span>';
            else if(item.tipo_registro === 'FALTA') badge = '<span style="background:rgba(239,68,68,0.2); color:#ef4444; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">Falta/Ausência</span>';
            else badge = '<span style="background:rgba(61,220,132,0.2); color:var(--ccol-green-bright); padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">Banco Horas</span>';

            let detalhesHTML = item.tipo_registro === 'ATESTADO' 
                ? `<strong style="color:var(--ccol-blue-bright);"><i class="fas fa-user-md"></i> ${item.medico_nome || '-'}</strong><br><strong style="color:#f59e0b;">CID: ${item.cid || 'N/A'}</strong> - ${item.motivo || ''}` 
                : `<span>${item.motivo || '-'}</span>`;

            let periodoHTML = item.tipo_registro === 'ATESTADO'
                ? `${formatarData(item.data_inicio)} <i class="fas fa-arrow-right" style="font-size:0.7rem;"></i> <strong>${item.dias_afastamento || 1} dias</strong>`
                : `${formatarData(item.data_inicio)} (<strong style="${item.tipo_registro === 'FALTA' ? 'color:#ef4444;' : 'color:var(--ccol-green-bright);'}">${item.quantidade_horas ? item.quantidade_horas + 'h' : 'Integral'}</strong>)`;

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
            tr.innerHTML = `
                <td style="font-size: 0.8rem; color: #94a3b8;">${dataLancamento}</td>
                <td style="text-align:left;"><b>${mat} ${nomeColaborador}</b></td>
                <td>${formatarData(item.data_inicio)}</td>
                <td><span style="color:#ef4444; font-weight:bold;">${item.quantidade_horas > 0 ? item.quantidade_horas+'h' : 'Dia Integral'}</span></td>
                <td>${item.motivo || '-'}</td>
                <td>${btnExcluir}</td>
            `;
        } else if (window.abaAtualAbsenteismo === 'BANCO_HORAS') {
            tr.innerHTML = `
                <td style="font-size: 0.8rem; color: #94a3b8;">${dataLancamento}</td>
                <td style="text-align:left;"><b>${mat} ${nomeColaborador}</b></td>
                <td>${formatarData(item.data_inicio)}</td>
                <td><span style="color:var(--ccol-green-bright); font-weight:bold;">${item.quantidade_horas} hrs</span></td>
                <td>${item.motivo || '-'}</td>
                <td>${btnExcluir}</td>
            `;
        }
        tbody.appendChild(tr);
    });
};

window.filtrarAbsenteismo = function() {
    const termo = document.getElementById('buscaAbsenteismo').value.toLowerCase();
    
    // Se estiver no relatório, ignora a busca global e força o usuário a usar os filtros de relatório
    if (window.abaAtualAbsenteismo === 'relatorio') {
        alert("Na aba de Relatórios, utilize os filtros de Colaborador e Datas acima da tabela.");
        return;
    }

    const filtrados = window.listaAbsenteismo.filter(a => {
        const nome = a.rh_colaboradores ? a.rh_colaboradores.nome.toLowerCase() : '';
        const cid = a.cid ? a.cid.toLowerCase() : '';
        const motivo = a.motivo ? a.motivo.toLowerCase() : '';
        const medico = a.medico_nome ? a.medico_nome.toLowerCase() : '';
        return nome.includes(termo) || cid.includes(termo) || motivo.includes(termo) || medico.includes(termo);
    });
    
    // Hack rápido pra reutilizar a renderização:
    const backupLista = window.listaAbsenteismo;
    window.listaAbsenteismo = filtrados;
    window.renderizarTabelaAbsenteismo();
    window.listaAbsenteismo = backupLista; // devolve original
};

// ==============================================================
// MODAL DE LANÇAMENTO E SALVAMENTO
// ==============================================================
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

    const gDias = document.getElementById('grupoDiasAtestado');
    const gHoras = document.getElementById('grupoHorasAusencia');
    const gRetorno = document.getElementById('grupoDataRetorno');
    const gMedico = document.getElementById('grupoMedicoNome');
    const gCrm = document.getElementById('grupoMedicoCrm');
    const gCid = document.getElementById('grupoCid');
    const gAnexo = document.getElementById('grupoAnexo');
    const lblMotivo = document.getElementById('labelMotivoDinamico');
    const tituloModal = document.getElementById('absModalTitulo');

    if (tipo === 'ATESTADO') {
        tituloModal.innerHTML = '<i class="fas fa-notes-medical" style="color:var(--ccol-blue-bright);"></i> Lançar Atestado';
        gDias.style.display = 'block';
        gHoras.style.display = 'none';
        gRetorno.style.display = 'block';
        gMedico.style.display = 'block';
        gCrm.style.display = 'block';
        gCid.style.display = 'block';
        gAnexo.style.display = 'block';
        lblMotivo.innerText = 'Motivo / Resumo *';
    } else if (tipo === 'FALTA') {
        tituloModal.innerHTML = '<i class="fas fa-user-times" style="color:#ef4444;"></i> Lançar Falta / Ausência';
        gDias.style.display = 'none';
        gHoras.style.display = 'block';
        gRetorno.style.display = 'none';
        gMedico.style.display = 'none';
        gCrm.style.display = 'none';
        gCid.style.display = 'none';
        gAnexo.style.display = 'none';
        lblMotivo.innerText = 'Classificação da Ausência *';
    } else if (tipo === 'BANCO_HORAS') {
        tituloModal.innerHTML = '<i class="fas fa-business-time" style="color:var(--ccol-green-bright);"></i> Lançar Banco de Horas';
        gDias.style.display = 'none';
        gHoras.style.display = 'block';
        gRetorno.style.display = 'none';
        gMedico.style.display = 'none';
        gCrm.style.display = 'none';
        gCid.style.display = 'none';
        gAnexo.style.display = 'none';
        lblMotivo.innerText = 'Motivo (Crédito ou Débito) *';
    }

    document.getElementById('modalAbsenteismo').classList.add('show');
};

window.fecharModalAbsenteismo = function() {
    document.getElementById('modalAbsenteismo').classList.remove('show');
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
    const dataInicio = document.getElementById('absDataInicio').value;
    const motivo = document.getElementById('absMotivo').value;

    if (!colaboradorId || !dataInicio || !motivo) {
        alert('Por favor, preencha o Colaborador, a Data e o Motivo/Classificação.');
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

        const dados = {
            colaborador_id: colaboradorId,
            tipo_registro: tipo,
            data_inicio: dataInicio,
            dias_afastamento: tipo === 'ATESTADO' ? (parseInt(document.getElementById('absDias').value) || 1) : null,
            data_retorno: tipo === 'ATESTADO' ? document.getElementById('absDataRetorno').value : null,
            quantidade_horas: tipo !== 'ATESTADO' ? (parseFloat(document.getElementById('absHoras').value) || 0) : 0,
            cid: tipo === 'ATESTADO' ? document.getElementById('absCid').value.toUpperCase() : null,
            motivo: motivo,
            observacoes: document.getElementById('absObservacoes').value,
            medico_nome: tipo === 'ATESTADO' ? document.getElementById('absMedicoNome').value : null,
            medico_crm: tipo === 'ATESTADO' ? document.getElementById('absMedicoCrm').value : null,
            anexo_url: anexoUrlFinal
        };

        await db.addAbsenteismo(dados);
        
        if (typeof window.registrarLogAuditoria === 'function') {
            window.registrarLogAuditoria('RH', 'Absenteísmo', `Lançamento de ${tipo} efetuado com sucesso`, 'Alerta');
        }
        
        window.fecharModalAbsenteismo();
        await window.carregarAbsenteismo();

    } catch (e) {
        console.error(e);
        alert('Erro ao salvar registro. Verifique os campos e conexão.');
    } finally {
        btnSalvar.innerHTML = txtOriginal;
        btnSalvar.disabled = false;
    }
};

window.excluirAbsenteismo = async function(id, anexoUrl) {
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

            await db.deleteAbsenteismo(id);
            await window.carregarAbsenteismo();
        } catch (e) {
            console.error(e);
            alert('Erro ao excluir o registro.');
        }
    }
};