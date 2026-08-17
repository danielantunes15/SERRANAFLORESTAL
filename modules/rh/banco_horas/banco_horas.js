window.listaBancoHorasRH = [];
window.listaBancoHorasRHFiltrada = [];
window.colaboradoresAtivosBH = [];
window.chartEvolucaoBH = null;
window.chartTopColabBH = null;

window.initRHBancoHoras = async function() {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    
    document.getElementById('bhRhDataInicio').value = primeiroDia.toISOString().split('T')[0];
    document.getElementById('bhRhDataFim').value = ultimoDia.toISOString().split('T')[0];

    window.addEventListener('resize', function() {
        if (window.chartEvolucaoBH) window.chartEvolucaoBH.resize();
        if (window.chartTopColabBH) window.chartTopColabBH.resize();
    });

    await window.carregarColaboradoresBH();
    await window.carregarBancoHorasRH();
};

window.carregarColaboradoresBH = async function() {
    try {
        const dados = await db.getColaboradores();
        window.colaboradoresAtivosBH = dados.filter(c => c.status !== 'Inativo' && c.status !== 'Desligado').sort((a,b) => a.nome.localeCompare(b.nome));
    } catch(e) {
        console.error("Erro ao puxar colaboradores BH:", e);
    }
};

window.carregarBancoHorasRH = async function() {
    const tbody = document.getElementById('tbBancoHorasRH');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Carregando registros da base de dados...</td></tr>`;

    try {
        let query = window.supabaseClient
            .from('rh_banco_horas')
            .select('id, data_extra, caminhao_placa, turno, motorista_id, created_at, rh_colaboradores(nome, cod_funcionario)')
            .order('data_extra', { ascending: false });

        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);

        const { data, error } = await query;

        if (error) throw error;
        window.listaBancoHorasRH = data || [];
        
        window.filtrarBancoHorasRH(); 
        window.renderizarGraficosBH();
    } catch (e) {
        console.error("Erro ao carregar banco de horas:", e);
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ef4444;">Erro ao carregar dados.</td></tr>`;
    }
};

window.filtrarBancoHorasRH = function() {
    const termo = document.getElementById('buscaBancoHorasRH').value.toLowerCase();
    const dataIni = document.getElementById('bhRhDataInicio').value;
    const dataFim = document.getElementById('bhRhDataFim').value;

    window.listaBancoHorasRHFiltrada = window.listaBancoHorasRH.filter(item => {
        const nome = item.rh_colaboradores ? item.rh_colaboradores.nome.toLowerCase() : '';
        const placa = item.caminhao_placa ? item.caminhao_placa.toLowerCase() : '';
        const dataExtra = item.data_extra;

        let passaTermo = nome.includes(termo) || placa.includes(termo);
        let passaDataIni = dataIni ? dataExtra >= dataIni : true;
        let passaDataFim = dataFim ? dataExtra <= dataFim : true;

        return passaTermo && passaDataIni && passaDataFim;
    });

    window.atualizarKPIsBancoHorasRH();
    window.renderizarTabelaBancoHorasRH();
};

window.atualizarKPIsBancoHorasRH = function() {
    const kpiTotal = document.getElementById('kpiTotalExtrasRH');
    const kpiMes = document.getElementById('kpiExtrasMesRH');
    const kpiSemana = document.getElementById('kpiExtrasSemanaRH');
    const kpiTop = document.getElementById('kpiTopColabExtraRH');
    
    if (kpiTotal) kpiTotal.innerText = window.listaBancoHorasRHFiltrada.length;

    let countMes = 0;
    let countSemana = 0;

    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;
    
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());
    inicioSemana.setHours(0,0,0,0);
    
    const contagem = {};

    window.listaBancoHorasRHFiltrada.forEach(item => {
        if (!item.data_extra) return;
        const [a, m, d] = item.data_extra.split('-');
        
        if (parseInt(a) === anoAtual && parseInt(m) === mesAtual) {
            countMes++;
        }

        const dataItem = new Date(item.data_extra + 'T00:00:00');
        if (dataItem >= inicioSemana && dataItem <= hoje) {
            countSemana++;
        }

        const nome = item.rh_colaboradores ? item.rh_colaboradores.nome : 'Desconhecido';
        contagem[nome] = (contagem[nome] || 0) + 1;
    });

    if (kpiMes) kpiMes.innerText = countMes;
    if (kpiSemana) kpiSemana.innerText = countSemana;

    if (window.listaBancoHorasRHFiltrada.length === 0) {
        if (kpiTop) kpiTop.innerText = '-';
        return;
    }

    const topColab = Object.keys(contagem).reduce((a, b) => contagem[a] > contagem[b] ? a : b);
    if (kpiTop) kpiTop.innerHTML = `${topColab}<br><span style="font-size:0.8rem; color:#94a3b8;">(${contagem[topColab]} extras no período)</span>`;
};

window.renderizarGraficosBH = function() {
    if (typeof echarts === 'undefined') return;

    const hoje = new Date();
    const chavesMeses = [];
    const mesesLabels = [];

    for (let i = 5; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        mesesLabels.push(label);
        chavesMeses.push({ key: key, count: 0 });
    }

    const contagemTopGlobal = {};

    window.listaBancoHorasRH.forEach(item => {
        if (item.data_extra) {
            const [ano, mes] = item.data_extra.split('-');
            const key = `${ano}-${mes}`;
            const targetMes = chavesMeses.find(m => m.key === key);
            if (targetMes) targetMes.count++;
        }

        const nome = item.rh_colaboradores ? item.rh_colaboradores.nome : 'Desconhecido';
        contagemTopGlobal[nome] = (contagemTopGlobal[nome] || 0) + 1;
    });

    const dataBarrasEvolucao = chavesMeses.map(c => c.count);

    const domEvolucao = document.getElementById('chartBHEvolucao');
    if (domEvolucao) {
        if (window.chartEvolucaoBH) window.chartEvolucaoBH.dispose();
        window.chartEvolucaoBH = echarts.init(domEvolucao);

        window.chartEvolucaoBH.setOption({
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
            xAxis: { type: 'category', data: mesesLabels, axisLabel: { color: '#9ca3af' }, axisLine: { lineStyle: { color: '#374151' } } },
            yAxis: { type: 'value', axisLabel: { color: '#9ca3af' }, splitLine: { lineStyle: { color: '#374151', type: 'dashed' } } },
            series: [{
                name: 'Convocações Extras',
                type: 'bar',
                barWidth: '40%',
                data: dataBarrasEvolucao,
                itemStyle: { 
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#60a5fa' },
                        { offset: 1, color: '#2563eb' }
                    ]),
                    borderRadius: [4, 4, 0, 0] 
                },
                label: { show: true, position: 'top', color: '#fff', fontWeight: 'bold' }
            }]
        });
    }

    const arrTop = Object.keys(contagemTopGlobal).map(k => ({ name: k, value: contagemTopGlobal[k] }));
    arrTop.sort((a,b) => b.value - a.value);
    const top5 = arrTop.slice(0, 5);

    const domTop = document.getElementById('chartBHTopColab');
    if (domTop) {
        if (window.chartTopColabBH) window.chartTopColabBH.dispose();
        window.chartTopColabBH = echarts.init(domTop);

        window.chartTopColabBH.setOption({
            tooltip: { trigger: 'item', formatter: '{b}: {c} extra(s) ({d}%)' },
            legend: { top: 'bottom', textStyle: { color: '#9ca3af' } },
            color: ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444'],
            series: [{
                type: 'pie',
                radius: ['45%', '75%'],
                avoidLabelOverlap: false,
                itemStyle: { borderRadius: 8, borderColor: '#1f2937', borderWidth: 3 },
                label: { show: false, position: 'center' },
                emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold', color: '#fff' } },
                data: top5.length > 0 ? top5 : [{ name: 'Sem dados', value: 0 }]
            }]
        });
    }
};

window.renderizarTabelaBancoHorasRH = function() {
    const tbody = document.getElementById('tbBancoHorasRH');
    if (!tbody) return;

    if (window.listaBancoHorasRHFiltrada.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#9ca3af; padding: 20px;">Nenhum registro encontrado para os filtros informados.</td></tr>`;
        return;
    }

    let html = '';
    window.listaBancoHorasRHFiltrada.forEach(item => {
        let dataCriacao = '-';
        if (item.created_at) {
            const dateObj = new Date(item.created_at);
            dataCriacao = dateObj.toLocaleDateString('pt-BR') + ' às ' + dateObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        }
        
        const colabNome = item.rh_colaboradores ? item.rh_colaboradores.nome : '<span style="color:#ef4444;">Removido</span>';
        const mat = item.rh_colaboradores && item.rh_colaboradores.cod_funcionario ? `[${String(item.rh_colaboradores.cod_funcionario).padStart(4, '0')}]` : '';
        const dataExtraFmt = item.data_extra ? item.data_extra.split('-').reverse().join('/') : '-';

        html += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td><span style="background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 0.85rem;"><i class="fas fa-calendar-day"></i> ${dataExtraFmt}</span></td>
                <td style="text-align:left;"><b><span style="color:var(--text-secondary); font-size:0.8rem;">${mat}</span> ${colabNome}</b></td>
                <td><strong style="color: var(--ccol-blue-bright); font-size: 1.05rem;">${item.caminhao_placa || '-'}</strong></td>
                <td><span style="padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; border: 1px solid var(--border-dim); background: rgba(0,0,0,0.2);">${item.turno || '-'}</span></td>
                <td style="font-size: 0.8rem; color: #94a3b8;">${dataCriacao}</td>
                <td style="text-align: right; display:flex; justify-content: flex-end; gap:5px;">
                    <button class="btn-icon-only" onclick="window.editarBancoHorasRHTela('${item.id}')" title="Editar Convocação"><i class="fas fa-edit" style="color:#3b82f6;"></i></button>
                    <button class="btn-icon-only" onclick="window.excluirBancoHorasRHTela('${item.id}', '${item.data_extra}', '${colabNome}')" title="Excluir Convocação"><i class="fas fa-trash" style="color:#ef4444;"></i></button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
};

window.abrirModalLancamentoExtraRH = function() {
    const select = document.getElementById('modalExtraColaborador');
    select.innerHTML = '<option value="">Selecione o Colaborador...</option>';
    window.colaboradoresAtivosBH.forEach(c => {
        const mat = c.cod_funcionario ? String(c.cod_funcionario).padStart(4, '0') : '-';
        select.innerHTML += `<option value="${c.id}">${c.nome} [${mat}]</option>`;
    });

    document.getElementById('modalLancarExtraRHTitulo').innerHTML = '<i class="fas fa-plus-circle" style="color: var(--ccol-blue-bright);"></i> Lançar Extra / Banco de Horas';
    document.getElementById('modalExtraEditId').value = '';
    document.getElementById('modalExtraData').value = '';
    document.getElementById('modalExtraAtividade').value = '';
    document.getElementById('modalExtraTurno').value = '';

    document.getElementById('modalLancarExtraRH').classList.add('show');
    document.getElementById('modalLancarExtraRH').style.display = 'flex';
};

window.editarBancoHorasRHTela = function(id) {
    const userRole = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.role : '';
    const isRH = userRole && typeof userRole === 'string' && userRole.toUpperCase().includes('RH');
    const allowedRoles = ['Supervisor', 'Admin', 'SuperAdmin'];
    
    if (!isRH && !allowedRoles.includes(userRole)) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'error', title: 'Acesso Negado', text: 'Apenas usuários do RH, Supervisor ou Admin podem editar registros.', background: '#1e293b', color: '#fff' });
        } else alert('Acesso Negado: Apenas a função ligada ao RH ou Supervisor pode editar registros.');
        return;
    }

    const item = window.listaBancoHorasRH.find(x => String(x.id) === String(id));
    if(!item) return;

    const select = document.getElementById('modalExtraColaborador');
    select.innerHTML = '<option value="">Selecione o Colaborador...</option>';
    window.colaboradoresAtivosBH.forEach(c => {
        const mat = c.cod_funcionario ? String(c.cod_funcionario).padStart(4, '0') : '-';
        const isSelected = (item.motorista_id === c.id) ? 'selected' : '';
        select.innerHTML += `<option value="${c.id}" ${isSelected}>${c.nome} [${mat}]</option>`;
    });

    document.getElementById('modalLancarExtraRHTitulo').innerHTML = '<i class="fas fa-edit" style="color: var(--ccol-blue-bright);"></i> Editar Registro de Extra';
    document.getElementById('modalExtraEditId').value = item.id;
    document.getElementById('modalExtraData').value = item.data_extra || '';
    document.getElementById('modalExtraAtividade').value = item.caminhao_placa || '';
    document.getElementById('modalExtraTurno').value = item.turno || '';

    document.getElementById('modalLancarExtraRH').classList.add('show');
    document.getElementById('modalLancarExtraRH').style.display = 'flex';
};

window.fecharModalLancamentoExtraRH = function() {
    document.getElementById('modalLancarExtraRH').classList.remove('show');
    document.getElementById('modalLancarExtraRH').style.display = 'none';
};

window.salvarLancamentoExtraRH = async function() {
    const motId = document.getElementById('modalExtraColaborador').value;
    const dataExtra = document.getElementById('modalExtraData').value;
    const atividade = document.getElementById('modalExtraAtividade').value;
    const turno = document.getElementById('modalExtraTurno').value;
    const editId = document.getElementById('modalExtraEditId').value;

    if (!motId || !dataExtra || !atividade || !turno) {
        alert("Por favor, preencha todos os campos obrigatórios.");
        return;
    }

    const btn = document.getElementById('btnSalvarExtraRH');
    const oriTxt = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    btn.disabled = true;

    try {
        let payloadExtra = {
            motorista_id: motId,
            data_extra: dataExtra,
            caminhao_placa: atividade,
            turno: turno
        };
        if (typeof window.injetarFilial === 'function' && !editId) payloadExtra = window.injetarFilial(payloadExtra);

        if (editId) {
            await window.supabaseClient.from('rh_banco_horas').update(payloadExtra).eq('id', editId);
            if (typeof window.registrarLogAuditoria === 'function') {
                window.registrarLogAuditoria('RH', 'Banco de Horas', `Edição de extra (ID: ${editId})`, 'Info');
            }
            alert("Registro atualizado com sucesso!");
        } else {
            await window.supabaseClient.from('rh_banco_horas').insert([payloadExtra]);
            if (typeof window.registrarLogAuditoria === 'function') {
                window.registrarLogAuditoria('RH', 'Banco de Horas', `Lançamento avulso de extra em ${dataExtra.split('-').reverse().join('/')}`, 'Info');
            }
            alert("Registro de horas adicionado com sucesso!");
        }

        window.fecharModalLancamentoExtraRH();
        await window.carregarBancoHorasRH(); 

    } catch (e) {
        console.error("Erro ao salvar extra RH:", e);
        alert("Falha de conexão. Tente novamente.");
    } finally {
        btn.innerHTML = oriTxt;
        btn.disabled = false;
    }
};

window.excluirBancoHorasRHTela = async function(id, dataExtra, colabNome) {
    const userRole = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.role : '';
    const isRH = userRole && typeof userRole === 'string' && userRole.toUpperCase().includes('RH');
    const allowedRoles = ['Supervisor', 'Admin', 'SuperAdmin'];
    
    if (!isRH && !allowedRoles.includes(userRole)) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'Acesso Negado',
                text: 'Apenas usuários com a função relacionada ao RH, Supervisor ou Admin podem excluir registros no banco de horas.',
                confirmButtonColor: '#ef4444',
                background: '#1e293b',
                color: '#fff',
                didOpen: () => {
                    const swalContainer = document.querySelector('.swal2-container');
                    if (swalContainer) swalContainer.style.zIndex = '99999';
                }
            });
        } else {
            alert('Acesso Negado: Apenas a função ligada ao RH ou Supervisor pode excluir registros.');
        }
        return;
    }

    if (!confirm(`Deseja realmente remover a convocação extra do motorista ${colabNome} no dia ${dataExtra.split('-').reverse().join('/')}?`)) return;
    
    try {
        await window.supabaseClient.from('rh_banco_horas').delete().eq('id', id);
        
        if (typeof window.registrarLogAuditoria === 'function') window.registrarLogAuditoria('RH', 'Banco de Horas', `Convocação Extra excluída do sistema para ${colabNome} (ID ${id})`, 'Crítico');
        
        alert('Convocação extra removida com sucesso!');
        await window.carregarBancoHorasRH();
    } catch(e) {
        console.error(e);
        alert('Erro ao excluir registro de banco de horas.');
    }
};

window.exportarBancoHorasPdf = function() {
    if (typeof window.jspdf === 'undefined') {
        alert("Biblioteca PDF não carregada.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');

    doc.setFontSize(16);
    doc.setTextColor(41, 128, 185);
    doc.text("Relatório de Banco de Horas (Extras)", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 28);

    const bodyData = window.listaBancoHorasRHFiltrada.map(item => {
        const nome = item.rh_colaboradores ? item.rh_colaboradores.nome : 'Removido';
        const mat = item.rh_colaboradores && item.rh_colaboradores.cod_funcionario ? String(item.rh_colaboradores.cod_funcionario).padStart(4, '0') : '-';
        const dataOcorrencia = item.data_extra ? item.data_extra.split('-').reverse().join('/') : '-';
        
        return [mat, nome, dataOcorrencia, item.caminhao_placa || '-', item.turno || '-'];
    });

    doc.autoTable({
        startY: 35,
        head: [['Matrícula', 'Colaborador', 'Data da Extra', 'Veículo / Atividade', 'Turno Realizado']],
        body: bodyData,
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] },
        styles: { fontSize: 9 }
    });

    doc.save(`Relatorio_BancoHoras_${Date.now()}.pdf`);
};

window.exportarBancoHorasExcel = function() {
    if (window.listaBancoHorasRHFiltrada.length === 0) {
        alert("Nenhum dado para exportar.");
        return;
    }

    let csvContent = "\uFEFF"; 
    csvContent += "Matrícula;Colaborador;Data da Extra;Veículo / Atividade;Turno Realizado;Lançado Em\n";

    window.listaBancoHorasRHFiltrada.forEach(item => {
        const mat = item.rh_colaboradores && item.rh_colaboradores.cod_funcionario ? String(item.rh_colaboradores.cod_funcionario).padStart(4, '0') : '-';
        const nome = item.rh_colaboradores ? item.rh_colaboradores.nome : 'Removido';
        const dataOcorrencia = item.data_extra ? item.data_extra.split('-').reverse().join('/') : '-';
        let dataCriacao = '-';
        if (item.created_at) {
            const dateObj = new Date(item.created_at);
            dataCriacao = dateObj.toLocaleDateString('pt-BR') + ' ' + dateObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        }
        
        const linha = [mat, nome, dataOcorrencia, item.caminhao_placa || '-', item.turno || '-', dataCriacao].join(";");
        csvContent += linha + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Banco_Horas_Extras_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
};