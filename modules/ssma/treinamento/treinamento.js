// ==================== MÓDULO: TREINAMENTO (VIAGEM ASSISTIDA) ====================

let instrutores = [];
let treinamentos = [];

window.renderizarPaginaTreinamento = async function() {
    await carregarDadosTreinamento();
    popularSelectMasterDrive();
    popularSelectMotoristasTreinamento();
    renderizarListaTreinamentos();
    await atualizarIndicadoresTreinamento();
    renderizarTabelaPendentes(); 
};

async function carregarDadosTreinamento() {
    instrutores = await db.getInstrutores();
    treinamentos = await db.getTreinamentos();
    
    if (typeof db !== 'undefined' && typeof db.getMotoristas === 'function') {
        window.motoristas = await db.getMotoristas();
    }
}

function popularSelectMasterDrive() {
    const selectPrincipal = document.getElementById('treinoMasterDrive');
    const selectManual = document.getElementById('treinoMasterManual');
    const selectDe = document.getElementById('realocarDe');
    const selectPara = document.getElementById('realocarPara');
    
    let html = '<option value="">Selecione o Master...</option>';
    instrutores.forEach(ins => {
        html += `<option value="${ins.nome}">${ins.nome}</option>`;
    });
    if (selectPrincipal) selectPrincipal.innerHTML = html;
    if (selectManual) selectManual.innerHTML = html;
    
    let htmlDe = '<option value="">De (Master Atual)...</option>';
    let htmlPara = '<option value="">Para (Novo Master)...</option>';
    instrutores.forEach(ins => {
        htmlDe += `<option value="${ins.nome}">${ins.nome}</option>`;
        htmlPara += `<option value="${ins.nome}">${ins.nome}</option>`;
    });
    
    if (selectDe) selectDe.innerHTML = htmlDe;
    if (selectPara) selectPara.innerHTML = htmlPara;
}

window.gerarCronogramaAutomatico = async function() {
    const dataInicioStr = document.getElementById('treinoDataInicio').value;
    const masterNome = document.getElementById('treinoMasterDrive').value;
    const turnoOpcao = document.getElementById('treinoTurnoOpcao').value;
    const metaPorMotorista = parseInt(document.getElementById('treinoQtdViagens').value);

    if (!dataInicioStr || !masterNome) {
        alert("Preencha a data inicial e selecione o Master Drive!");
        return;
    }

    if (!confirm("O sistema gerará a escala para TODOS os motoristas selecionados, pulando os finais de semana. Continuar?")) return;

    let dataAtual = new Date(dataInicioStr + 'T00:00:00');
    let listaNovosTreinos = [];
    
    let equipesPossiveis = [];
    if (turnoOpcao === "Dia") equipesPossiveis = ['A', 'B', 'C'];
    else if (turnoOpcao === "Noite") equipesPossiveis = ['D', 'E', 'F'];
    else equipesPossiveis = ['A', 'B', 'C', 'D', 'E', 'F'];

    let motoristasParaTreinar = (window.motoristas || []).filter(m => equipesPossiveis.includes((m.equipe || '').toUpperCase()));

    if (motoristasParaTreinar.length === 0) {
        alert("Nenhum motorista encontrado para os turnos selecionados!");
        return;
    }

    let placarViagens = {};
    motoristasParaTreinar.forEach(m => placarViagens[m.id] = 0);

    let d = 0; 
    let diasLimite = 365; 

    while (true) {
        let todosProntos = motoristasParaTreinar.every(m => placarViagens[m.id] >= metaPorMotorista);
        
        if (todosProntos || d >= diasLimite) {
            break; 
        }

        let dataLoop = new Date(dataAtual);
        dataLoop.setDate(dataLoop.getDate() + d);
        let diaSemana = dataLoop.getDay();
        let dataKey = dataLoop.toISOString().split('T')[0];

        if (diaSemana === 0 || diaSemana === 6) {
            d++;
            continue; 
        }

        let turnoMasterAtual = "Dia";
        if (turnoOpcao === "Noite") {
            turnoMasterAtual = "Noite";
        } else if (turnoOpcao === "Ambos") {
            let semanasPassadas = Math.floor(d / 7);
            turnoMasterAtual = (semanasPassadas % 2 === 0) ? "Dia" : "Noite";
        }

        const motoristasDisponiveis = motoristasParaTreinar.filter(m => {
            const escala = window.getEscalaDiaComputada(m, dataKey);
            const estaTrabalhando = escala.caminhao !== 'F'; 
            
            const eq = (m.equipe || '').toUpperCase();
            let noTurnoCerto = false;
            if (turnoMasterAtual === "Dia") noTurnoCerto = ['A', 'B', 'C'].includes(eq);
            else noTurnoCerto = ['D', 'E', 'F'].includes(eq);
            
            const aindaPrecisaTreinar = placarViagens[m.id] < metaPorMotorista;

            return estaTrabalhando && noTurnoCerto && aindaPrecisaTreinar;
        });

        if (motoristasDisponiveis.length > 0) {
            motoristasDisponiveis.sort((a, b) => placarViagens[a.id] - placarViagens[b.id]);
            let mot = motoristasDisponiveis[0]; 

            listaNovosTreinos.push({
                id: `${mot.id}_${dataKey}`, 
                motorista_id: mot.id,
                motorista_nome: mot.nome,
                equipe: mot.equipe,
                master_drive: masterNome,
                data: dataKey,
                horario: mot.turno || '06:00',
                status: 'Agendado',
                turno_treino: turnoMasterAtual
            });
            placarViagens[mot.id]++;
        }
        d++; 
    }

    if (listaNovosTreinos.length === 0) {
        alert("Nenhum treinamento gerado. Talvez todos já tenham batido a meta!");
        return;
    }

    for (const t of listaNovosTreinos) {
        await db.upsertTreinamento(t);
    }

    alert(`Cronograma Concluído! Foram geradas ${listaNovosTreinos.length} viagens. Todos os motoristas selecionados foram escalados!`);
    window.renderizarPaginaTreinamento();
};

function renderizarListaTreinamentos() {
    const tbody = document.getElementById('listaTreinamentos');
    if (!tbody) return;

    if (treinamentos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">Nenhum treinamento agendado.</td></tr>';
        return;
    }

    const ordenados = [...treinamentos].sort((a, b) => new Date(a.data) - new Date(b.data));

    tbody.innerHTML = ordenados.map(t => {
        let corStatus = "#3b82f6";
        if (t.status === 'Concluído') corStatus = "#10b981";
        if (t.status === 'Pendente') corStatus = "#f59e0b";

        return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding:12px;">${t.data.split('-').reverse().join('/')}</td>
                <td style="padding:12px;">${t.horario}</td>
                <td style="padding:12px; font-weight:bold;">${t.motorista_nome}</td>
                <td style="padding:12px;">${t.equipe || '-'}</td>
                <td style="padding:12px;">${t.master_drive}</td>
                <td style="padding:12px;"><span style="color:${corStatus}; font-weight:bold;">● ${t.status}</span></td>
                <td style="padding:12px;">
                    <button onclick="alterarStatusTreino('${t.id}', 'Concluído')" style="background:none; border:none; color:#10b981; cursor:pointer;" title="Concluir">✅</button>
                    <button onclick="deletarTreinamento('${t.id}')" style="background:none; border:none; color:#ef4444; cursor:pointer; margin-left:10px;" title="Excluir">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

window.alterarStatusTreino = async function(id, novoStatus) {
    const treino = treinamentos.find(t => t.id === id);
    if (treino) {
        treino.status = novoStatus;
        await db.upsertTreinamento(treino);
        window.renderizarPaginaTreinamento();
    }
};

window.deletarTreinamento = async function(id) {
    if (!confirm("Excluir este agendamento?")) return;
    await db.deleteTreinamento(id);
    window.renderizarPaginaTreinamento();
};

window.limparTodosTreinamentos = async function() {
    if (!confirm("ATENÇÃO: Isso apagará TODOS os treinamentos da base de dados. Confirma?")) return;
    for (const t of treinamentos) {
        await db.deleteTreinamento(t.id);
    }
    window.renderizarPaginaTreinamento();
};

window.atualizarIndicadoresTreinamento = async function() {
    const concluidos = treinamentos.filter(t => t.status === 'Concluído').length;
    const agendados = treinamentos.filter(t => t.status === 'Agendado').length;

    let totalMotoristas = 0;
    if (typeof window.motoristas !== 'undefined' && Array.isArray(window.motoristas)) {
        totalMotoristas = window.motoristas.length;
    }

    let pendentesCount = totalMotoristas - concluidos;
    if (pendentesCount < 0) {
        pendentesCount = 0;
    }

    if (document.getElementById('treinoStatConcluido')) document.getElementById('treinoStatConcluido').innerText = concluidos;
    if (document.getElementById('treinoStatAgendado')) document.getElementById('treinoStatAgendado').innerText = agendados;
    if (document.getElementById('treinoStatPendente')) document.getElementById('treinoStatPendente').innerText = pendentesCount;
};

// ==================== GESTÃO E REALOCAÇÃO DE MASTER DRIVES ====================

window.abrirModalMasterDrive = function() {
    document.getElementById('modalMasterDrive').classList.add('show');
    renderizarListaMasterDrives();
};

window.fecharModalMasterDrive = function() {
    document.getElementById('modalMasterDrive').classList.remove('show');
};

async function renderizarListaMasterDrives() {
    const lista = document.getElementById('listaMasterDrivesCadastrados');
    if (!lista) return;
    
    lista.innerHTML = instrutores.map(ins => `
        <div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid rgba(255,255,255,0.1);">
            <span>${ins.nome}</span>
            <button onclick="removerMasterDrive('${ins.nome}')" style="color:#ef4444; background:none; border:none; cursor:pointer;">Remover</button>
        </div>
    `).join('');
}

window.salvarMasterDrive = async function() {
    const nome = document.getElementById('novoMasterNome').value;
    if (!nome) return;
    await db.addInstrutor({ nome: nome });
    document.getElementById('novoMasterNome').value = '';
    await carregarDadosTreinamento();
    renderizarListaMasterDrives();
    popularSelectMasterDrive(); 
};

window.removerMasterDrive = async function(nome) {
    if(!confirm(`Tem certeza que deseja apagar o instrutor ${nome}?`)) return;
    await db.deleteInstrutor(nome);
    await carregarDadosTreinamento();
    renderizarListaMasterDrives();
    popularSelectMasterDrive(); 
};

window.realocarTreinamentosMaster = async function() {
    const deMaster = document.getElementById('realocarDe').value;
    const paraMaster = document.getElementById('realocarPara').value;

    if (!deMaster || !paraMaster) {
        alert("Selecione os dois Master Drives para realizar a transferência.");
        return;
    }
    
    if (deMaster === paraMaster) {
        alert("O Master de origem e destino não podem ser a mesma pessoa.");
        return;
    }

    if (!confirm(`Confirma a transferência de TODOS os treinamentos agendados de "${deMaster}" para "${paraMaster}"?`)) return;

    let alterados = 0;
    
    for (let t of treinamentos) {
        if (t.master_drive === deMaster) {
            t.master_drive = paraMaster;
            await db.upsertTreinamento(t); 
            alterados++;
        }
    }

    alert(`Transferência concluída! ${alterados} viagens foram transferidas para ${paraMaster}.`);
    
    await carregarDadosTreinamento();
    window.renderizarPaginaTreinamento();
};

window.exportarTreinamentosExcel = function() {
    let csv = "\uFEFFData;Horario;Motorista;Equipe;Master Drive;Status\n";
    treinamentos.forEach(t => {
        csv += `${t.data};${t.horario};${t.motorista_nome};${t.equipe};${t.master_drive};${t.status}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Cronograma_Viagem_Assistida.csv";
    link.click();
};

window.exportarTreinamentosPDF = function() {
    if (treinamentos.length === 0) {
        alert("Não há treinamentos agendados para gerar relatório.");
        return;
    }

    const ordenados = [...treinamentos].sort((a, b) => new Date(a.data) - new Date(b.data));

    let html = `
        <html>
        <head>
            <title>Cronograma de Viagem Assistida</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
                h2 { margin: 0; color: #1e293b; }
                p { margin: 5px 0; color: #64748b; font-size: 14px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                th { background-color: #f1f5f9; color: #334155; font-weight: bold; }
                .status-concluido { color: #10b981; font-weight: bold; }
                .status-pendente { color: #f59e0b; font-weight: bold; }
                .status-agendado { color: #3b82f6; font-weight: bold; }
                @media print {
                    @page { margin: 1cm; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>Cronograma de Viagem Assistida - Master Drive</h2>
                <p>Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Horário</th>
                        <th>Motorista</th>
                        <th>Equipe</th>
                        <th>Master Drive</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
    `;

    ordenados.forEach(t => {
        let classStatus = "";
        if (t.status === 'Concluído') classStatus = "status-concluido";
        else if (t.status === 'Pendente') classStatus = "status-pendente";
        else classStatus = "status-agendado";

        html += `
            <tr>
                <td>${t.data.split('-').reverse().join('/')}</td>
                <td>${t.horario}</td>
                <td style="font-weight: bold;">${t.motorista_nome}</td>
                <td>${t.equipe || '-'}</td>
                <td>${t.master_drive}</td>
                <td class="${classStatus}">${t.status}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
            
            <script>
                window.onload = function() { 
                    window.print(); 
                    setTimeout(() => window.close(), 500);
                }
            </script>
        </body>
        </html>
    `;

    let printWindow = window.open('', '_blank', 'width=1000,height=800');
    printWindow.document.write(html);
    printWindow.document.close();
};

// ==================== REGISTRO MANUAL DE TREINAMENTOS ====================

window.popularSelectMotoristasTreinamento = function() {
    const selectMot = document.getElementById('treinoMotoristaManual');
    if (!selectMot) return;

    let html = '<option value="">Selecione o Motorista...</option>';
    
    if (typeof window.motoristas !== 'undefined' && Array.isArray(window.motoristas)) {
        const motoristasOrdenados = [...window.motoristas].sort((a, b) => a.nome.localeCompare(b.nome));
        
        motoristasOrdenados.forEach(m => {
            html += `<option value="${m.id}">${m.nome} (Equipe: ${m.equipe || '-'})</option>`;
        });
    }
    
    selectMot.innerHTML = html;
};

window.adicionarTreinamentoManual = async function() {
    const motoristaId = document.getElementById('treinoMotoristaManual').value;
    const masterNome = document.getElementById('treinoMasterManual').value;
    const dataStr = document.getElementById('treinoDataManual').value;
    const status = document.getElementById('treinoStatusManual').value;

    if (!motoristaId || !masterNome || !dataStr) {
        alert("⚠️ Por favor, preencha o Motorista, o Instrutor (Master) e a Data.");
        return;
    }

    const mot = (window.motoristas || []).find(m => String(m.id) === String(motoristaId));
    if (!mot) return;

    const novoTreino = {
        id: `${mot.id}_manual_${Date.now()}`, 
        motorista_id: mot.id,
        motorista_nome: mot.nome,
        equipe: mot.equipe || '-',
        master_drive: masterNome,
        data: dataStr,
        horario: mot.turno || '06:00',
        status: status,
        turno_treino: '-'
    };

    await db.upsertTreinamento(novoTreino);
    
    if (status === 'Concluído') {
        mot.masterDrive = 'Sim';
        if (typeof db.updateMotorista === 'function') {
            await db.updateMotorista(mot.id, { masterDrive: 'Sim' });
        }
    }

    alert(`✅ Viagem de ${mot.nome} registrada com sucesso!`);
    
    document.getElementById('treinoMotoristaManual').value = '';
    document.getElementById('treinoDataManual').value = '';
    
    window.renderizarPaginaTreinamento();
};

// ==================== TABELA DE MOTORISTAS PENDENTES (BAIXA RÁPIDA) E FILTRO ====================

window.renderizarTabelaPendentes = function() {
    const tbody = document.getElementById('listaMotoristasPendentes');
    if (!tbody) return;

    const idsConcluidos = treinamentos.filter(t => t.status === 'Concluído').map(t => String(t.motorista_id));
    
    let pendentes = [];
    if (typeof window.motoristas !== 'undefined' && Array.isArray(window.motoristas)) {
        pendentes = window.motoristas.filter(m => !idsConcluidos.includes(String(m.id)))
            .sort((a, b) => a.nome.localeCompare(b.nome));
    }

    if (pendentes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#10b981; font-weight:bold;">🎉 Todos os motoristas já realizaram a viagem assistida!</td></tr>';
        return;
    }

    let optionsMaster = '<option value="">Selecione o Instrutor...</option>';
    instrutores.forEach(ins => {
        optionsMaster += `<option value="${ins.nome}">${ins.nome}</option>`;
    });

    const hoje = new Date().toISOString().split('T')[0];

    tbody.innerHTML = pendentes.map(m => {
        return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding:12px; font-weight:bold; font-size: 0.95rem;">${m.nome}</td>
                <td style="padding:12px;"><span style="background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 4px 8px; border-radius: 4px; border: 1px solid #10b981; font-size: 0.75rem;">Equipe ${m.equipe || '-'}</span></td>
                <td style="padding:12px;">
                    <select id="master_pendente_${m.id}" class="dark-select" style="padding: 6px; width: 100%; font-size: 0.85rem;">
                        ${optionsMaster}
                    </select>
                </td>
                <td style="padding:12px;">
                    <input type="date" id="data_pendente_${m.id}" class="dark-select" value="${hoje}" style="padding: 6px; width: 100%; font-size: 0.85rem;">
                </td>
                <td style="padding:12px;">
                    <button onclick="salvarPendenteConcluido('${m.id}')" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid #10b981; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.8rem; width: 100%; transition: 0.2s;" onmouseover="this.style.background='#10b981'; this.style.color='#fff'" onmouseout="this.style.background='rgba(16, 185, 129, 0.15)'; this.style.color='#10b981'">✅ Concluir</button>
                </td>
            </tr>
        `;
    }).join('');

    // Re-aplica o filtro de pesquisa caso o usuário já tenha digitado algo na barra
    if (document.getElementById('filtroMotoristaPendente')) {
        window.filtrarTabelaPendentes();
    }
};

window.salvarPendenteConcluido = async function(motoristaId) {
    const masterNome = document.getElementById(`master_pendente_${motoristaId}`).value;
    const dataStr = document.getElementById(`data_pendente_${motoristaId}`).value;

    if (!masterNome || !dataStr) {
        alert("⚠️ Por favor, selecione o Instrutor (Master Drive) e a Data da Viagem para prosseguir!");
        return;
    }

    const mot = (window.motoristas || []).find(m => String(m.id) === String(motoristaId));
    if (!mot) return;

    if (!confirm(`Confirmar a Viagem Assistida para ${mot.nome} no dia ${dataStr.split('-').reverse().join('/')}?`)) return;

    const novoTreino = {
        id: `${mot.id}_manual_${Date.now()}`, 
        motorista_id: mot.id,
        motorista_nome: mot.nome,
        equipe: mot.equipe || '-',
        master_drive: masterNome,
        data: dataStr,
        horario: mot.turno || '06:00',
        status: 'Concluído',
        turno_treino: '-'
    };

    await db.upsertTreinamento(novoTreino);
    
    mot.masterDrive = 'Sim';
    if (typeof db.updateMotorista === 'function') {
        await db.updateMotorista(mot.id, { masterDrive: 'Sim' });
    }
    
    await carregarDadosTreinamento();
    window.renderizarPaginaTreinamento();
};

window.filtrarTabelaPendentes = function() {
    const input = document.getElementById('filtroMotoristaPendente');
    if (!input) return;
    
    const filtro = input.value.toLowerCase();
    const trs = document.querySelectorAll('#listaMotoristasPendentes tr');
    
    trs.forEach(tr => {
        // Ignora a linha de mensagem de "Todos os motoristas já realizaram"
        if (tr.innerText.includes('🎉 Todos os motoristas')) return;
        
        // Pega apenas a coluna do Nome do Motorista para comparar
        const tdNome = tr.querySelector('td:nth-child(1)'); 
        if (tdNome) {
            const nome = tdNome.innerText.toLowerCase();
            if (nome.includes(filtro)) {
                tr.style.display = '';
            } else {
                tr.style.display = 'none';
            }
        }
    });
};