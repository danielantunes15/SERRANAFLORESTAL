// ==================== modules/campo/escala/escala.js ====================

// Variáveis globais para armazenar dados em memória para a tela
window.equipeCampo = window.equipeCampo || []; 
window.maquinasCampo = window.maquinasCampo || [];
window.escalasCampoExcecoes = window.escalasCampoExcecoes || {}; // { operadorId: { dateKey: { status, frente } } }
window.currentDatasCampo = [];

// =========================================================================
// LÓGICA MATEMÁTICA: 4x2 PARA CAMPO
// =========================================================================
window.calcularEscalaCampoMatematica = function(operador, dateKey) {
    if (!operador.data_ancora || operador.masterDrive === 'Não' || operador.destra === 'Não') {
        return { frente: 'FOLGA', turno: operador.turno, status: 'fallback' };
    }

    const eq = operador.equipe || ''; 
    const dDate = new Date(dateKey + 'T00:00:00');
    const dAncora = new Date(operador.data_ancora.split('T')[0] + 'T00:00:00');
    
    const utcAncora = Date.UTC(dAncora.getFullYear(), dAncora.getMonth(), dAncora.getDate());
    const utcAtual = Date.UTC(dDate.getFullYear(), dDate.getMonth(), dDate.getDate());
    const diffDays = Math.round((utcAtual - utcAncora) / (1000 * 60 * 60 * 24));
    
    // Ciclo de 6 dias (4 trabalha, 2 folga)
    const cycleDay = ((diffDays % 6) + 6) % 6;
    
    // Dia 4 e 5 são Folga
    if (cycleDay === 4 || cycleDay === 5) {
        return { frente: 'FOLGA', turno: operador.turno, status: 'auto' };
    }

    let frenteAtuacao = 'Frente A';
    
    if (eq.includes('Frente A') || eq === 'A') {
        frenteAtuacao = 'Frente A';
    } else if (eq.includes('Frente B') || eq === 'B') {
        frenteAtuacao = 'Frente B';
    } else if (eq.includes('Folguista') || eq === 'C') {
        // Folguista: 2 dias A, 2 dias B
        if (cycleDay === 0 || cycleDay === 1) frenteAtuacao = 'Frente A';
        else if (cycleDay === 2 || cycleDay === 3) frenteAtuacao = 'Frente B';
    } else {
        frenteAtuacao = 'Frente A'; // Fallback
    }

    return { frente: frenteAtuacao, turno: operador.turno, status: 'auto' };
};

// Puxa a escala computada ou a exceção manual
window.getEscalaCampoDiaComputada = function(operador, dateKey) {
    if (window.escalasCampoExcecoes[operador.id] && window.escalasCampoExcecoes[operador.id][dateKey] && window.escalasCampoExcecoes[operador.id][dateKey].status === 'manual') {
        return window.escalasCampoExcecoes[operador.id][dateKey];
    }
    return window.calcularEscalaCampoMatematica(operador, dateKey);
};

// Popular seletor de busca
window.popularSelectOperadores = function() {
    const select = document.getElementById('buscaOperadorEscala');
    if (!select) return;
    const valorAtual = select.value;
    let html = '<option value="">Selecione o operador...</option>';
    
    const opsOrdenados = [...window.equipeCampo].sort((a, b) => a.nome.localeCompare(b.nome));
    opsOrdenados.forEach(op => { html += `<option value="${op.nome}">${op.nome}</option>`; });
    
    select.innerHTML = html;
    if (valorAtual && window.equipeCampo.some(op => op.nome === valorAtual)) {
        select.value = valorAtual;
    }
};

// =========================================================================
// RENDERIZAÇÃO DA TABELA (ESTILO LOGÍSTICA)
// =========================================================================
window.renderizarEscalaCampo = function() {
    const container = document.getElementById('campoGridEscala');
    if (!container) return;

    window.popularSelectOperadores();

    if (!window.equipeCampo || window.equipeCampo.length === 0) {
        container.innerHTML = '<p style="padding: 20px; text-align: center;">Nenhum operador registrado na equipe do campo.</p>';
        return;
    }

    let dataInput = document.getElementById('campoDataEscala').value;
    if (!dataInput) {
        const hj = new Date();
        dataInput = hj.toISOString().split('T')[0];
        document.getElementById('campoDataEscala').value = dataInput;
    }

    const filtroFrente = document.getElementById('campoFiltroFrente').value;
    let dataBase = new Date(dataInput + 'T00:00:00');
    
    let diasRender = [];
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    for(let i = 0; i < 7; i++) {
        let d = new Date(dataBase);
        d.setDate(d.getDate() + i);
        diasRender.push({
            dateKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
            diaNum: String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'),
            diaTexto: diasSemana[d.getDay()]
        });
    }
    window.currentDatasCampo = diasRender;

    // Agrupar por máquina
    const alocacaoPorMaquina = {};
    window.maquinasCampo.forEach(maq => { alocacaoPorMaquina[maq.id] = []; });
    alocacaoPorMaquina['S/M'] = []; // Sem máquina

    window.equipeCampo.forEach(op => {
        if (op.maquina_id && alocacaoPorMaquina[op.maquina_id]) {
            alocacaoPorMaquina[op.maquina_id].push(op);
        } else {
            alocacaoPorMaquina['S/M'].push(op);
        }
    });

    let html = '';

    const maquinasRender = [...window.maquinasCampo];
    maquinasRender.push({ id: 'S/M', nome: 'RESERVAS / SEM MÁQUINA' });

    maquinasRender.forEach(maq => {
        let operadoresMaq = alocacaoPorMaquina[maq.id] || [];
        if (operadoresMaq.length === 0) return;

        // Se tiver filtro de frente, verifica se alguém da máquina atua na frente nesta semana
        if (filtroFrente !== 'Todos') {
            const atuaNaFrente = operadoresMaq.some(op => {
                return diasRender.some(d => window.getEscalaCampoDiaComputada(op, d.dateKey).frente === filtroFrente);
            });
            if (!atuaNaFrente) return; 
        }

        // Ordenação: Fixo A, Fixo B, Folguistas, Outros
        operadoresMaq.sort((a, b) => {
            const getPeso = (eq) => {
                if (eq?.includes('A')) return 1;
                if (eq?.includes('B')) return 2;
                if (eq?.includes('Folguista')) return 3;
                return 99;
            };
            return getPeso(a.equipe) - getPeso(b.equipe) || a.nome.localeCompare(b.nome);
        });

        html += `<div style="background: rgba(15, 23, 42, 0.4); border-radius: 8px; margin-bottom: 30px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">`;
        html += `<div style="background: #0f172a; padding: 12px 20px; font-size: 1.1rem; font-weight: 800; color: #fff; border-bottom: 2px solid #10b981; text-align: left;">
                      <i class="fas fa-tractor"></i> ${maq.nome}
                 </div>`;
        html += `<div style="overflow-x: auto; width: 100%;">`;
        html += `<table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 0.85rem; min-width: 950px;">`;
        html += `<thead>
                    <tr style="background-color: rgba(30, 41, 59, 0.9); color: #94a3b8; text-transform: uppercase; font-size: 0.75rem;">
                        <th style="padding: 12px 8px; border: 1px solid rgba(255,255,255,0.05); width: 12%;">Turno</th>
                        <th style="padding: 12px 8px; border: 1px solid rgba(255,255,255,0.05); width: 12%;">Equipe</th>
                        <th style="padding: 12px 15px; border: 1px solid rgba(255,255,255,0.05); text-align: left; width: 25%;">Operador</th>
                        ${diasRender.map(d => `<th style="padding: 10px 5px; border: 1px solid rgba(255,255,255,0.05); width: 6.5%; color: #cbd5e1;">${d.diaTexto}<br><span style="font-size:0.85rem; font-weight:800; color: #fff;">${d.diaNum}</span></th>`).join('')}
                    </tr>
                 </thead><tbody>`;

        operadoresMaq.forEach(op => {
            const isBlocked = op.masterDrive === 'Não' || op.destra === 'Não';
            
            html += `<tr style="background-color: transparent; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;">`;
            html += `<td style="padding: 8px; border: 1px solid rgba(255,255,255,0.05); color: #38bdf8; font-weight: bold;">${op.turno || '-'}</td>`;
            html += `<td style="padding: 8px; border: 1px solid rgba(255,255,255,0.05); font-weight: 800; color: #f8fafc;">${op.equipe || '-'}</td>`;
            html += `<td class="td-name" style="padding: 8px 15px; border: 1px solid rgba(255,255,255,0.05); text-align: left; ${isBlocked ? 'color: #f87171;' : 'color: #fff;'} font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${op.nome}</td>`;
            
            diasRender.forEach(d => {
                const escala = window.getEscalaCampoDiaComputada(op, d.dateKey);
                const isFolga = escala.frente === 'FOLGA';
                const isManual = escala.status === 'manual';
                
                let bgCell = isFolga ? 'rgba(249, 115, 22, 0.15)' : 'rgba(16, 185, 129, 0.15)';
                let colorCell = isFolga ? '#fb923c' : '#34d399';
                let borderSide = isFolga ? '1px solid rgba(249, 115, 22, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)';
                
                if (isManual) {
                    bgCell = 'rgba(168, 85, 247, 0.15)';
                    borderSide = '1px solid rgba(168, 85, 247, 0.5)';
                }
                
                let opcoes = `<option value="FOLGA" ${isFolga ? 'selected' : ''} style="background: #1e293b; color: #fb923c;">FOLGA</option>`;
                opcoes += `<option value="Frente A" ${escala.frente === 'Frente A' ? 'selected' : ''} style="background: #1e293b; color: #34d399;">Fr. A</option>`;
                opcoes += `<option value="Frente B" ${escala.frente === 'Frente B' ? 'selected' : ''} style="background: #1e293b; color: #34d399;">Fr. B</option>`;
                
                if (isManual) {
                    opcoes += `<option value="AUTO" style="background: #0f172a; color: #fbbf24; font-weight: bold;"> Voltar p/ Auto</option>`;
                }

                html += `<td style="padding: 4px; border: 1px solid rgba(255,255,255,0.05); border-left: ${borderSide}; border-right: ${borderSide}; background-color: ${bgCell}; text-align: center;">
                    <select class="select-escala-campo" data-operador="${op.id}" data-data="${d.dateKey}" ${isBlocked ? 'disabled' : ''} style="width: 100%; padding: 6px 0; background: transparent; border: none; color: ${colorCell}; font-weight: 800; font-size: 0.85rem; text-align: center; appearance: none; cursor: pointer; outline: none; text-align-last: center;">
                        ${isBlocked ? '<option value="FOLGA">Bloq</option>' : opcoes}
                    </select>
                </td>`;
            });
            html += `</tr>`;
        });

        html += `</tbody></table></div></div>`;
    });

    if(html === '') {
        container.innerHTML = '<p style="padding: 20px; text-align: center; color: #94a3b8;">Nenhum dado encontrado para os filtros selecionados.</p>';
    } else {
        container.innerHTML = html;
        document.querySelectorAll('.select-escala-campo').forEach(select => select.addEventListener('change', handleEscalaCampoChange));
    }

    if (document.getElementById('buscaOperadorEscala') && document.getElementById('buscaOperadorEscala').value.trim() !== '') {
        window.buscarOperadorEscala();
    }
};

window.atualizarEscalaCampo = function() {
    window.renderizarEscalaCampo();
};

// =========================================================================
// EVENTOS E BUSCA
// =========================================================================
window.limparBuscaOperador = function() {
    const selectBusca = document.getElementById('buscaOperadorEscala');
    if(selectBusca) selectBusca.value = '';
    const linhas = document.querySelectorAll('#campoGridEscala tbody tr');
    linhas.forEach(tr => {
        Array.from(tr.children).forEach(td => {
            td.style.removeProperty('background-color');
            const select = td.querySelector('select');
            if (select) select.style.removeProperty('color');
        });
    });
};

window.buscarOperadorEscala = function() {
    const selectBusca = document.getElementById('buscaOperadorEscala');
    if (!selectBusca) return;
    const termo = selectBusca.value.trim().toLowerCase();

    window.limparBuscaOperador();
    if (termo === '') return;

    let encontrou = false;
    document.querySelectorAll('#campoGridEscala tbody tr').forEach(tr => {
        const tdNome = tr.querySelector('.td-name');
        if (tdNome && tdNome.textContent.toLowerCase().includes(termo)) {
            Array.from(tr.children).forEach(td => {
                td.style.setProperty('background-color', 'rgba(253, 224, 71, 0.8)', 'important');
                const select = td.querySelector('select');
                if (select) select.style.setProperty('color', '#000', 'important');
            });
            if (!encontrou) {
                tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
                encontrou = true;
            }
        }
    });
};

// Manipulação de mudança manual
async function handleEscalaCampoChange(e) {
    const select = e.target;
    const operadorIdStr = String(select.dataset.operador); 
    const data = select.dataset.data;
    const novaFrente = select.value;
    
    const op = window.equipeCampo.find(o => String(o.id) === operadorIdStr);
    if(op) {
        const idExcecao = String(`${op.id}_${data}`);
        
        if (novaFrente === 'AUTO') {
            try {
                if (typeof db !== 'undefined' && db.deleteEscalaCampo) await db.deleteEscalaCampo(idExcecao);
                if (window.escalasCampoExcecoes[op.id]) delete window.escalasCampoExcecoes[op.id][data];
                window.renderizarEscalaCampo(); 
            } catch (err) { console.error(err); }
            return;
        }

        try {
            if (typeof db !== 'undefined' && db.upsertEscalaCampo) {
                await db.upsertEscalaCampo({ 
                    id: idExcecao, 
                    operador_id: Number(op.id),  
                    data: data, 
                    turno: op.turno, 
                    frente: novaFrente, 
                    status: 'manual' 
                });
            }

            if (!window.escalasCampoExcecoes[op.id]) window.escalasCampoExcecoes[op.id] = {};
            window.escalasCampoExcecoes[op.id][data] = { turno: op.turno, frente: novaFrente, status: 'manual' };
            
            window.renderizarEscalaCampo(); 
        } catch (error) {
            console.error("Erro ao salvar exceção manual:", error);
            window.renderizarEscalaCampo(); 
        }
    }
}

// =========================================================================
// IMPRESSÃO E EXPORTAÇÃO
// =========================================================================

window.abrirModalImpressaoCampo = function() {
    const hoje = new Date();
    document.getElementById('printDataCampo').value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    document.getElementById('modalImpressaoCampo').style.display = 'flex';
};

window.fecharModalImpressaoCampo = function() { 
    document.getElementById('modalImpressaoCampo').style.display = 'none'; 
};

window.imprimirRelatorioEscalaSemanalCampo = function() {
    if (!window.currentDatasCampo || window.currentDatasCampo.length === 0) {
        alert("Nenhuma semana renderizada no painel."); return;
    }

    let html = `
    <html>
    <head>
        <title>Escala Semanal do Campo</title>
        <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: Arial, sans-serif; margin: 0; color: #000; font-size: 11px; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 15px; }
            h1 { margin: 0; font-size: 18px; text-transform: uppercase; }
            .maq-box { margin-bottom: 15px; border: 2px solid #000; display: flex; break-inside: avoid; flex-direction: column; }
            .maq-num { background: #eee; border-bottom: 2px solid #000; font-weight: bold; font-size: 14px; padding: 5px 10px; }
            table { width: 100%; border-collapse: collapse; text-align: center; }
            th, td { border: 1px solid #000; padding: 4px; font-size: 10px; }
            th { background-color: #d1d5db; }
            .folga { background-color: #f8d7da; color: #721c24; font-weight: bold; }
            .trab { background-color: #d4edda; font-weight: bold; color: #000; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Serrana Florestal - Escala Automática (Campo)</h1>
            <p><strong>Semana Iniciada em: ${window.currentDatasCampo[0].diaNum}</strong></p>
        </div>
    `;

    const alocacaoPorMaquina = {};
    window.maquinasCampo.forEach(maq => alocacaoPorMaquina[maq.id] = []);
    window.equipeCampo.forEach(op => {
        if (op.maquina_id && alocacaoPorMaquina[op.maquina_id]) alocacaoPorMaquina[op.maquina_id].push(op);
    });

    window.maquinasCampo.forEach(maq => {
        let operadoresMaq = alocacaoPorMaquina[maq.id] || [];
        if (operadoresMaq.length === 0) return;

        html += `<div class="maq-box"><div class="maq-num">${maq.nome}</div>`;
        html += `<table><thead><tr><th style="width:12%;">TURNO</th><th style="width:15%;">EQUIPE</th><th style="text-align:left;">OPERADOR</th>${window.currentDatasCampo.map(d => `<th style="width:8%;">${d.diaTexto}<br>${d.diaNum}</th>`).join('')}</tr></thead><tbody>`;
        
        operadoresMaq.forEach(op => {
            html += `<tr><td>${op.turno||'-'}</td><td>${op.equipe||'-'}</td><td style="text-align:left;"><b>${op.nome}</b></td>`;
            window.currentDatasCampo.forEach(d => {
                const esc = window.getEscalaCampoDiaComputada(op, d.dateKey);
                const isF = esc.frente === 'FOLGA';
                const valorExibicao = isF ? 'F' : (esc.frente === 'Frente A' ? 'Fr. A' : 'Fr. B');
                html += `<td class="${isF ? 'folga' : 'trab'}">${valorExibicao}</td>`;
            });
            html += `</tr>`;
        });
        html += `</tbody></table></div>`;
    });

    html += `<script>window.print();</script></body></html>`;
    const w = window.open('', '', 'width=1200,height=800');
    w.document.write(html);
    w.document.close();
};

window.exportarEscalaCampoExcel = function() {
    const inputData = document.getElementById('campoDataEscala');
    let dataBase = inputData && inputData.value ? new Date(inputData.value + 'T00:00:00') : new Date();
    
    const ano = dataBase.getFullYear();
    const mes = dataBase.getMonth(); 
    const diasNoMes = new Date(ano, mes + 1, 0).getDate(); 

    let csvContent = "\uFEFFMáquina;Turno;Equipe;Operador";
    for (let dia = 1; dia <= diasNoMes; dia++) csvContent += `;${dia.toString().padStart(2, '0')}/${(mes + 1).toString().padStart(2, '0')}`;
    csvContent += "\n";

    let opsOrdenados = [...window.equipeCampo].sort((a, b) => {
        const maqA = a.maquina_id ? Number(a.maquina_id) : 999999;
        const maqB = b.maquina_id ? Number(b.maquina_id) : 999999;
        return maqA - maqB || a.nome.localeCompare(b.nome);
    });

    opsOrdenados.forEach(op => {
        let nomeMaq = "Sem Máquina";
        if(op.maquina_id) {
            let mq = window.maquinasCampo.find(m => String(m.id) === String(op.maquina_id));
            if(mq) nomeMaq = mq.nome;
        }

        let linha = `${nomeMaq};${op.turno||'-'};${op.equipe||'-'};${op.nome}`;

        for (let dia = 1; dia <= diasNoMes; dia++) {
            const dataAtualStr = `${ano}-${(mes + 1).toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`;
            const escalaDia = window.getEscalaCampoDiaComputada(op, dataAtualStr);
            const valorExibicao = escalaDia.frente === 'FOLGA' ? 'F' : (escalaDia.frente === 'Frente A' ? 'Fr. A' : 'Fr. B');
            linha += `;${valorExibicao}`;
        }
        csvContent += linha + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `Escala_Campo_Mensal_${(mes + 1).toString().padStart(2, '0')}_${ano}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
};

window.gerarRelatorioImpressaoCampo = function() {
    const dataStr = document.getElementById('printDataCampo').value;
    const frenteFiltro = document.getElementById('printFrenteCampo').value;
    
    if (!dataStr) { alert('Selecione uma data.'); return; }

    const partesData = dataStr.split('-');
    const dataFormatada = `${partesData[2]}/${partesData[1]}/${partesData[0]}`;

    let html = `
    <html>
    <head>
        <title>Escala Diária Campo - ${dataFormatada}</title>
        <style>
            @page { size: A4 portrait; margin: 15mm; }
            body { font-family: Arial, sans-serif; margin: 0; color: #000; font-size: 12px; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            h1 { margin: 0; font-size: 20px; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; text-align: center; margin-bottom: 20px; }
            th, td { border: 1px solid #000; padding: 6px; font-size: 11px; }
            th { background-color: #d1d5db; text-transform: uppercase; }
            .trab { background-color: #d4edda; font-weight: bold; }
            .section-title { font-size: 14px; font-weight: bold; margin-bottom: 10px; background: #eee; padding: 5px; border: 1px solid #000; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Serrana Florestal - Diária Campo</h1>
            <p><strong>Data: ${dataFormatada} | Filtro: ${frenteFiltro}</strong></p>
        </div>
    `;

    const trabs = [];
    window.equipeCampo.forEach(op => {
        const escala = window.getEscalaCampoDiaComputada(op, dataStr);
        if (escala.frente !== 'FOLGA') {
            if (frenteFiltro !== 'Todas' && escala.frente !== frenteFiltro) return;
            
            let maqNome = "Reserva/Sem Máquina";
            if(op.maquina_id) {
                let m = window.maquinasCampo.find(x => String(x.id) === String(op.maquina_id));
                if(m) maqNome = m.nome;
            }

            trabs.push({ 
                nome: op.nome, 
                maquina: maqNome, 
                eq: op.equipe || '-', 
                turno: op.turno || '-', 
                frente: escala.frente 
            });
        }
    });

    trabs.sort((a, b) => a.maquina.localeCompare(b.maquina) || a.nome.localeCompare(b.nome));

    if (trabs.length === 0) {
        html += '<p style="text-align:center;">Nenhum operador alocado nesta frente para o dia selecionado.</p>';
    } else {
        html += `<div class="section-title">OPERAÇÃO (${trabs.length} operadores)</div>`;
        html += `<table><thead><tr><th style="width: 15%">TURNO</th><th style="width: 25%">MÁQUINA</th><th style="width: 35%">OPERADOR</th><th style="width: 10%">EQUIPE</th><th style="width: 15%">FRENTE</th></tr></thead><tbody>`;
        trabs.forEach(l => {
            html += `<tr>
                <td style="font-weight:bold;">${l.turno}</td>
                <td>${l.maquina}</td>
                <td style="text-align:left; font-weight:bold;">${l.nome}</td>
                <td>${l.eq}</td>
                <td class="trab">${l.frente}</td>
            </tr>`;
        });
        html += `</tbody></table>`;
    }

    html += `
        <div style="margin-top: 30px; text-align: center; font-size: 10px; color: #555;">Relatório gerado em ${new Date().toLocaleString('pt-BR')}</div>
        <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>
    `;
    
    const w = window.open('', '', 'width=900,height=700');
    w.document.write(html);
    w.document.close();
    window.fecharModalImpressaoCampo();
};