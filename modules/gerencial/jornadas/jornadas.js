// ==========================================
// js/jornadas/jornadas.js
// ==========================================

window.calcularSemanaDoMes = function(dataString) {
    if (!dataString || dataString === '-') return '-';
    const match = dataString.match(/(\d{1,2})/);
    if (!match) return '-';
    const dia = parseInt(match[1]);
    const semana = Math.ceil(dia / 7);
    return `${semana}ª Semana`;
};

window.centerTextPluginJornadas = {
    id: 'centerText',
    beforeDraw: function(chart) {
        if (chart.config.type !== 'doughnut') return;
        const ctx = chart.ctx;
        const chartArea = chart.chartArea;
        const centerX = (chartArea.left + chartArea.right) / 2;
        const centerY = (chartArea.top + chartArea.bottom) / 2;
        const total = chart.config.data.datasets[0].data.reduce((a, b) => a + b, 0);

        ctx.restore();
        ctx.font = "bold 28px 'Inter', sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#f8fafc"; 
        ctx.fillText(total, centerX - (ctx.measureText(total).width / 2), centerY - 6);
        ctx.font = "bold 12px 'Inter', sans-serif";
        ctx.fillStyle = "#94a3b8"; 
        ctx.fillText("REGISTROS", centerX - (ctx.measureText("REGISTROS").width / 2), centerY + 18);
        ctx.save();
    }
};

window.configurarFiltros = function() {
    const btnQFs = document.querySelectorAll('.btn-qf-jor');
    btnQFs.forEach(btn => {
        btn.addEventListener('click', (e) => {
            window.activeQuickFilterJor = e.currentTarget.getAttribute('data-qf');
            if(typeof window.atualizarBotoesFiltro === 'function') window.atualizarBotoesFiltro();
            if (window.activeQuickFilterJor !== 'ALL') { 
                const filterSel = document.getElementById('filterDataSelect');
                if (filterSel) filterSel.value = 'ALL'; 
            }
            window.currentStatusFilter = 'ALL'; 
            window.renderizarPainelJornadas();
        });
    });
};

window.renderizarPainelJornadas = function() {
    try {
        console.log("[Jornadas] Iniciando renderização visual. Total global recebido:", window.fullJornadasData?.length);

        const filterEl = document.getElementById('filterDataSelect');
        let dataEspec = 'ALL';
        
        // CORREÇÃO: Em vez de travar, avisa e continua com a tela usando filtro padrão
        if (!filterEl) {
            console.warn("[Jornadas] Aviso: Elemento 'filterDataSelect' não encontrado. Exibindo todos.");
        } else {
            dataEspec = filterEl.value;
        }
        
        let dados = window.fullJornadasData || [];

        dados = dados.filter(d => {
            let dataParsedStr = '-';
            const matchDate = d.inicio ? d.inicio.match(window.regexDate) : null;
            if(matchDate) {
                dataParsedStr = matchDate[0];
                if (dataParsedStr.length <= 5) dataParsedStr += '/' + new Date().getFullYear();
            }

            if (dataEspec !== 'ALL' && dataParsedStr !== dataEspec) return false;

            if (window.activeQuickFilterJor !== 'ALL') {
                const dataParsed = window.extrairDataParaFiltro(d.inicio);
                if (dataParsed) {
                    const hj = new Date(); hj.setHours(0, 0, 0, 0); dataParsed.setHours(0, 0, 0, 0);
                    const diffDias = Math.round((hj - dataParsed) / 86400000);
                    
                    if (window.activeQuickFilterJor === 'D-1' && diffDias !== 1) return false;
                    if (window.activeQuickFilterJor === 'D-2' && diffDias !== 2) return false;
                    if (window.activeQuickFilterJor === 'D-7' && (diffDias < 0 || diffDias > 7)) return false;
                    if (window.activeQuickFilterJor === 'D-30' && (diffDias < 0 || diffDias > 30)) return false;
                    
                    if (window.activeQuickFilterJor === 'SEM') {
                        const inicioSemana = new Date(hj);
                        inicioSemana.setDate(hj.getDate() - hj.getDay()); 
                        if (dataParsed < inicioSemana || dataParsed > hj) return false;
                    }
                    if (window.activeQuickFilterJor === 'MES') {
                        if (dataParsed.getMonth() !== hj.getMonth() || dataParsed.getFullYear() !== hj.getFullYear()) return false;
                    }
                } else return false;
            }
            return true;
        });

        window.jornadasGlobalData = dados;

        if (dados.length === 0) {
            if(document.getElementById('jorFilterStatus')) document.getElementById('jorFilterStatus').innerText = '0 Registros';
            if(document.getElementById('jorTotalMotoristas')) document.getElementById('jorTotalMotoristas').innerText = '0';
            if(document.getElementById('jorQtdEstouros')) document.getElementById('jorQtdEstouros').innerText = '0';
            if(document.getElementById('jorQtdExpurgadas')) document.getElementById('jorQtdExpurgadas').innerText = '0';
            if(document.getElementById('jorMediaDirecao')) document.getElementById('jorMediaDirecao').innerText = '0h 00m';
            if(document.getElementById('jorQtdAuditados')) document.getElementById('jorQtdAuditados').innerText = '0';
            if(document.getElementById('jorQtdPendentes')) document.getElementById('jorQtdPendentes').innerText = '0';
            
            if(document.getElementById('jorTabelaAnaliticaBody')) document.getElementById('jorTabelaAnaliticaBody').innerHTML = '<tr><td colspan="12" class="text-center py-4 text-slate-500">Nenhum dado encontrado para o filtro.</td></tr>';
            
            if(window.chartStatusFrota) window.chartStatusFrota.destroy();
            if(window.chartFaixaHoras) window.chartFaixaHoras.destroy();
            if(window.chartEvolucaoOcorrencias) window.chartEvolucaoOcorrencias.destroy();
            return; 
        }

        let qtdOk = 0, qtdEstouros = 0, qtdExpurgadas = 0;
        
        dados.forEach(linha => {
            const horas = parseFloat(linha.total_trabalho_horas) || 0;
            const isEstouro = horas > 12;
            if (isEstouro) {
                if (linha.expurgado) qtdExpurgadas++;
                else qtdEstouros++; 
            } else {
                qtdOk++;
            }
        });

        let dadosFiltrados = dados.filter(d => {
            const horas = parseFloat(d.total_trabalho_horas) || 0;
            const isEstouro = horas > 12;
            const isRealInfraction = isEstouro && !d.expurgado;
            
            if (window.currentStatusFilter === 'OK' && isRealInfraction) return false;
            if (window.currentStatusFilter === 'INFRACAO' && !isRealInfraction) return false;
            return true;
        });

        dadosFiltrados.sort((a, b) => {
            return window.obterDataHoraParaOrdenacao(b.inicio) - window.obterDataHoraParaOrdenacao(a.inicio);
        });

        window.dadosFiltradosGlobal = dadosFiltrados;

        if(document.getElementById('jorFilterStatus')) document.getElementById('jorFilterStatus').innerText = `${dadosFiltrados.length} Registros`;

        let totalMinutosDirecao = 0; let qtdDirecao = 0;
        let fx8_10 = 0, fx10_12 = 0, fx12_14 = 0, fx14mais = 0;
        
        const tbodyEstouro = document.getElementById('jorTopEstourosBody'); 
        if(tbodyEstouro) tbodyEstouro.innerHTML = '';
        
        const agregacaoMotoristas = new Map();
        let infracoesList = [];
        const recorrentesMap = new Map();
        let totalAuditados = 0; let totalPendentes = 0;

        dadosFiltrados.forEach(linha => {
            const horas = parseFloat(linha.total_trabalho_horas) || 0;
            const isEstouro = horas > 12;
            const motNome = linha.motorista || 'Indefinido';

            if (horas >= 8 && horas < 10) fx8_10++;
            else if (horas >= 10 && horas <= 12) fx10_12++;
            else if (horas > 12 && horas <= 14) fx12_14++;
            else if (horas > 14) fx14mais++;

            const horasDir = parseFloat(linha.direcao_horas) || 0;
            if (horasDir > 0) { totalMinutosDirecao += (horasDir * 60); qtdDirecao++; }

            if (!agregacaoMotoristas.has(motNome)) {
                agregacaoMotoristas.set(motNome, { nome: motNome, noturnas: 0, extras: 0, maxTrabalho: 0 });
            }
            const motObj = agregacaoMotoristas.get(motNome);
            motObj.noturnas += (parseFloat(linha.horas_noturnas) || 0);
            motObj.extras += (parseFloat(linha.horas_extras) || 0);
            if (horas > motObj.maxTrabalho) motObj.maxTrabalho = horas;
            
            if(isEstouro) {
                if (linha.auditado) totalAuditados++;
                else totalPendentes++;
                if (!linha.expurgado) {
                    infracoesList.push({ nome: motNome, horas: horas });
                    recorrentesMap.set(motNome, (recorrentesMap.get(motNome) || 0) + 1);
                }
            }
        });

        const infratoresRecorrentes = Array.from(recorrentesMap.entries())
            .map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd);

        const tbodyRecorrentes = document.getElementById('jorInfratoresRecorrentesBody');
        if (tbodyRecorrentes) {
            tbodyRecorrentes.innerHTML = '';
            if (infratoresRecorrentes.length === 0) {
                tbodyRecorrentes.innerHTML = '<tr><td colspan="2" class="p-4 text-center text-slate-500">Sem infratores ativos.</td></tr>';
            } else {
                infratoresRecorrentes.forEach(inf => {
                    const tr = `<tr class="hover:bg-slate-800/30 transition-colors cursor-pointer group" onclick="window.filtrarMotoristaAnalitico('${inf.nome}')">
                        <td class="px-6 py-3 text-sky-400 font-bold group-hover:underline"><i class="fas fa-search text-slate-500 mr-2 text-[10px]"></i>${inf.nome}</td>
                        <td class="px-6 py-3 text-center text-rose-500 font-bold">${inf.qtd} vezes</td>
                    </tr>`;
                    tbodyRecorrentes.insertAdjacentHTML('beforeend', tr);
                });
            }
        }

        if(tbodyEstouro) {
            const topInfracoes = infracoesList.sort((a, b) => b.horas - a.horas).slice(0, 5);
            if(topInfracoes.length === 0) {
                tbodyEstouro.innerHTML = '<tr><td colspan="2" class="p-2 text-center text-slate-500 text-xs">Sem infrações ativas.</td></tr>';
            } else {
                topInfracoes.forEach(m => {
                    tbodyEstouro.insertAdjacentHTML('beforeend', `<tr><td class="px-3 py-2 text-slate-300 truncate max-w-[120px]">${m.nome}</td><td class="px-3 py-2 text-right font-black text-rose-500">${window.formatarHorasMinutos(m.horas)}</td></tr>`);
                });
            }
        }

        const arrMot = Array.from(agregacaoMotoristas.values());

        const tbodyNoturnas = document.getElementById('jorTopNoturnasBody');
        if(tbodyNoturnas) {
            tbodyNoturnas.innerHTML = '';
            const topNoturnas = arrMot.filter(m => m.noturnas > 0).sort((a,b) => b.noturnas - a.noturnas).slice(0,5);
            if(topNoturnas.length === 0) tbodyNoturnas.innerHTML = '<tr><td colspan="2" class="p-2 text-center text-slate-500 text-xs">Sem horas noturnas.</td></tr>';
            topNoturnas.forEach(m => {
                tbodyNoturnas.insertAdjacentHTML('beforeend', `<tr><td class="px-3 py-2 text-slate-300 truncate max-w-[120px]">${m.nome}</td><td class="px-3 py-2 text-right font-black text-indigo-400">${window.formatarHorasMinutos(m.noturnas)}</td></tr>`);
            });
        }

        const tbodyExtras = document.getElementById('jorTopExtrasBody');
        if(tbodyExtras) {
            tbodyExtras.innerHTML = '';
            const topExtras = arrMot.filter(m => m.extras > 0).sort((a,b) => b.extras - a.extras).slice(0,5);
            if(topExtras.length === 0) tbodyExtras.innerHTML = '<tr><td colspan="2" class="p-2 text-center text-slate-500 text-xs">Sem horas extras.</td></tr>';
            topExtras.forEach(m => {
                tbodyExtras.insertAdjacentHTML('beforeend', `<tr><td class="px-3 py-2 text-slate-300 truncate max-w-[120px]">${m.nome}</td><td class="px-3 py-2 text-right font-black text-amber-400">${window.formatarHorasMinutos(m.extras)}</td></tr>`);
            });
        }

        // ================= INJETANDO OS VALORES NOS CARDS =================
        if(document.getElementById('jorTotalMotoristas')) document.getElementById('jorTotalMotoristas').textContent = arrMot.length;
        if(document.getElementById('jorQtdEstouros')) document.getElementById('jorQtdEstouros').textContent = qtdEstouros;
        if(document.getElementById('jorQtdExpurgadas')) document.getElementById('jorQtdExpurgadas').textContent = qtdExpurgadas;
        if(document.getElementById('jorMediaDirecao')) document.getElementById('jorMediaDirecao').textContent = window.formatarHorasMinutos(qtdDirecao > 0 ? (totalMinutosDirecao / qtdDirecao) / 60 : 0);
        if(document.getElementById('jorQtdAuditados')) document.getElementById('jorQtdAuditados').textContent = totalAuditados;
        if(document.getElementById('jorQtdPendentes')) document.getElementById('jorQtdPendentes').textContent = totalPendentes;

        let filterText = dataEspec !== 'ALL' ? dataEspec : window.activeQuickFilterJor;
        if (window.currentStatusFilter !== 'ALL') filterText += ` | Status: ${window.currentStatusFilter}`;
        if(document.getElementById('jorDataReferencia')) document.getElementById('jorDataReferencia').textContent = `Filtro: ${filterText}`;

        const selectMot = document.getElementById('filterAnaliticoMotorista');
        if (selectMot) {
            const motoristasUnicos = [...new Set(window.dadosFiltradosGlobal.map(d => d.motorista))].sort();
            selectMot.innerHTML = '<option value="ALL">Todos os Motoristas</option>';
            motoristasUnicos.forEach(m => {
                selectMot.insertAdjacentHTML('beforeend', `<option value="${m}" ${m === window.currentAnaliticoFilter ? 'selected' : ''}>${m}</option>`);
            });
            
            if (window.currentAnaliticoFilter !== 'ALL' && !motoristasUnicos.includes(window.currentAnaliticoFilter)) {
                window.currentAnaliticoFilter = 'ALL';
                selectMot.value = 'ALL';
            }
            if(typeof window.toggleBtnLimparFiltro === 'function') window.toggleBtnLimparFiltro(); 
        }

        window.atualizarTabelaAnalitica();

        // ================== GRÁFICOS (Isolados com Try/Catch) ==================
        try {
            if (window.chartStatusFrota) window.chartStatusFrota.destroy();
            if (window.chartFaixaHoras) window.chartFaixaHoras.destroy();
            if (window.chartEvolucaoOcorrencias) window.chartEvolucaoOcorrencias.destroy();

            const totalOKParaGrafico = qtdOk + qtdExpurgadas; 
            const totalStatus = totalOKParaGrafico + qtdEstouros;
            const bgColors = ['#10b981', '#f43f5e'];
            if (window.currentStatusFilter === 'OK') bgColors[1] = '#f43f5e33'; 
            if (window.currentStatusFilter === 'INFRACAO') bgColors[0] = '#10b98133';

            const canvasStatus = document.getElementById('statusFrotaChart');
            if(canvasStatus) {
                const ctxStatus = canvasStatus.getContext('2d');
                window.chartStatusFrota = new Chart(ctxStatus, {
                    type: 'doughnut',
                    data: { labels: ['OK / Expurgadas', 'Infração (> 12h)'], datasets: [{ data: [totalOKParaGrafico, qtdEstouros], backgroundColor: bgColors, borderWidth: 2, borderColor: '#1e293b' }] },
                    plugins: [window.centerTextPluginJornadas],
                    options: { 
                        responsive: true, maintainAspectRatio: false, cutout: '60%', layout: { padding: { top: 40, bottom: 40, left: 20, right: 20 } },
                        onClick: (event, elements) => {
                            if (elements.length > 0) {
                                const index = elements[0].index;
                                if (index === 0) window.currentStatusFilter = window.currentStatusFilter === 'OK' ? 'ALL' : 'OK';
                                else window.currentStatusFilter = window.currentStatusFilter === 'INFRACAO' ? 'ALL' : 'INFRACAO';
                            } else { window.currentStatusFilter = 'ALL'; }
                            window.renderizarPainelJornadas();
                        },
                        onHover: (event, elements) => { event.native.target.style.cursor = elements.length ? 'pointer' : 'default'; },
                        plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 12 } } }, datalabels: { display: true, color: '#f8fafc', font: { weight: 'bold', size: 14 }, textAlign: 'center', anchor: 'end', align: 'end', offset: 8, formatter: (value) => { if (value === 0) return null; const perc = totalStatus > 0 ? ((value / totalStatus) * 100).toFixed(1) : 0; return `${value}\n(${perc}%)`; } } } 
                    }
                });
            }

            const canvasFaixas = document.getElementById('faixaHorasChart');
            if(canvasFaixas) {
                const ctxFaixas = canvasFaixas.getContext('2d');
                let gradientBar = ctxFaixas.createLinearGradient(0, 0, 0, 400);
                gradientBar.addColorStop(0, '#10b981'); gradientBar.addColorStop(1, '#059669'); 
                window.chartFaixaHoras = new Chart(ctxFaixas, {
                    type: 'bar',
                    data: { labels: ['8h a 10h', '10h a 12h', '12h a 14h', '> 14h'], datasets: [{ label: 'Qtd de Jornadas', data: [fx8_10, fx10_12, fx12_14, fx14mais], backgroundColor: [gradientBar, gradientBar, '#f43f5e', '#9f1239'], borderRadius: 4, barPercentage: 0.6 }] },
                    options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 25, bottom: 10 } }, plugins: { legend: { display: false }, datalabels: { color: '#fff', anchor: 'end', align: 'top', font: { weight: 'bold', size: 13 } } }, scales: { y: { display: false }, x: { grid: { display: false }, border: { display: false }, ticks: { color: '#cbd5e1', font: { size: 13, weight: '600' } } } } }
                });
            }

            const dailyInfractions = new Map();
            dados.forEach(d => {
                let dataStr = '-';
                const matchDate = d.inicio ? d.inicio.match(window.regexDate) : null;
                if(matchDate) { dataStr = matchDate[0]; if (dataStr.length <= 5) dataStr += '/' + new Date().getFullYear(); }
                if (dataStr !== '-') {
                    if (!dailyInfractions.has(dataStr)) dailyInfractions.set(dataStr, 0);
                    const isEstouroReal = (parseFloat(d.total_trabalho_horas) || 0) > 12 && !d.expurgado;
                    if (isEstouroReal) dailyInfractions.set(dataStr, dailyInfractions.get(dataStr) + 1);
                }
            });

            const sortedDatesInfractions = Array.from(dailyInfractions.keys()).sort((a, b) => window.extrairDataParaFiltro(a) - window.extrairDataParaFiltro(b));
            const displayDatesInf = sortedDatesInfractions.slice(-30);
            const displayCountsInf = displayDatesInf.map(dt => dailyInfractions.get(dt));
            const displayLabelsInf = displayDatesInf.map(dt => { const p = dt.split('/'); return `${p[0]}/${p[1]}`; });

            const ctxEvoOcc = document.getElementById('evolucaoOcorrenciasChart');
            if (ctxEvoOcc) {
                const ctxO = ctxEvoOcc.getContext('2d');
                window.chartEvolucaoOcorrencias = new Chart(ctxO, {
                    type: 'line',
                    data: { labels: displayLabelsInf, datasets: [{ label: 'Infrações (>12h)', data: displayCountsInf, backgroundColor: 'rgba(244, 63, 94, 0.2)', borderColor: '#f43f5e', borderWidth: 2, pointBackgroundColor: '#f43f5e', pointBorderColor: '#fff', pointRadius: 4, fill: true, tension: 0.3 }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { color: '#fff', align: 'top', anchor: 'end', font: { size: 11, weight: 'bold' }, formatter: (v) => v } }, scales: { y: { display: false, beginAtZero: true, suggestedMax: Math.max(...displayCountsInf, 1) * 1.3 }, x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11, weight: 'bold' }, color: '#cbd5e1' } } }, layout: { padding: { top: 25 } } }
                });
            }
        } catch (eChart) {
            console.warn("[Jornadas] Falha ao renderizar os gráficos:", eChart);
        }

    } catch (errorRender) {
        console.error("[Jornadas] Erro CRÍTICO na montagem visual da tela:", errorRender);
    }
};

window.atualizarTabelaAnalitica = function() {
    try {
        const tbodyAnalitica = document.getElementById('jorTabelaAnaliticaBody');
        if (!tbodyAnalitica) return;
        
        tbodyAnalitica.innerHTML = '';
        let linhasInseridas = 0;

        if(!window.dadosFiltradosGlobal) return;

        window.dadosFiltradosGlobal.forEach(linha => {
            const motNome = linha.motorista || 'Indefinido';
            if (window.currentAnaliticoFilter !== 'ALL' && motNome !== window.currentAnaliticoFilter) return;
            
            linhasInseridas++;
            const horas = parseFloat(linha.total_trabalho_horas) || 0;
            const isEstouro = horas > 12;

            let dI = '-', hI = '-', dF = '-', hF = '-';
            if (linha.inicio) {
                const mD = linha.inicio.match(window.regexDate); const mT = linha.inicio.match(window.regexTime);
                if (mD) { dI = mD[0]; if (dI.length <= 5) dI += '/' + new Date().getFullYear(); }
                if (mT) hI = mT[0]; if (!mD && !mT) hI = linha.inicio;
            }
            if (linha.fim) {
                const mDF = linha.fim.match(window.regexDate); const mTF = linha.fim.match(window.regexTime);
                if (mDF) { dF = mDF[0]; if (dF.length <= 5) dF += '/' + new Date().getFullYear(); } else dF = dI; 
                if (mTF) hF = mTF[0]; else hF = linha.fim.replace(window.regexDate, '').replace('-', '').trim() || linha.fim;
            }

            const valEPS = linha.eps || 'SERRANALOG - BA';
            const valUnidade = linha.unidade || 'BA';
            const valSemana = linha.semana || window.calcularSemanaDoMes(dI);

            let corLinha = 'text-emerald-400';
            let badge = `<span class="border border-emerald-500 text-emerald-500 bg-emerald-900/20 px-2 py-1 rounded text-[10px] uppercase font-bold">OK</span>`;
            let auditHtml = `<span class="text-slate-600" title="Não aplicável"><i class="fas fa-minus"></i></span>`;
            
            if(isEstouro) {
                corLinha = 'text-rose-500 font-bold';
                if (linha.expurgado) {
                    corLinha = 'text-sky-400 font-bold';
                    badge = `<span class="border border-sky-500 text-sky-400 bg-sky-900/20 px-2 py-1 rounded text-[10px] uppercase font-bold" title="Infração Descartada/Expurgada">EXPURGADA</span>`;
                } else {
                    badge = `<span class="border border-rose-500 text-rose-500 bg-rose-900/20 px-2 py-1 rounded text-[10px] uppercase font-bold">INFRAÇÃO</span>`;
                }

                const dataHoraDetalhe = `${dI} ${hI} até ${dF} ${hF} (Total: ${window.formatarHorasMinutos(horas)})`;
                
                if (linha.auditado || linha.expurgado) {
                    const obsSegura = linha.observacao_auditoria ? linha.observacao_auditoria.replace(/'/g, "\\'").replace(/"/g, '&quot;') : '';
                    const isExpurgado = linha.expurgado ? true : false;
                    
                    let iconAudit = isExpurgado ? 'fas fa-eraser text-sky-400' : 'fas fa-check-double text-emerald-400';
                    let classAuditBtn = isExpurgado ? 'bg-sky-900/40 border border-sky-500 text-sky-400 hover:bg-sky-800' : 'bg-emerald-900/40 border border-emerald-500 text-emerald-400 hover:bg-emerald-800';
                    auditHtml = `<button onclick="abrirModalVisAuditoria('${obsSegura}', '${motNome}', '${dataHoraDetalhe}', ${isExpurgado})" class="${classAuditBtn} px-3 py-1 rounded text-[10px] uppercase font-bold flex items-center gap-1 transition-colors shadow-sm" title="Ver detalhes"><i class="${iconAudit} text-xs"></i> Auditado</button>`;
                } else {
                    auditHtml = `<button onclick="abrirModalAuditoria(${linha.id}, '${motNome}', '${dataHoraDetalhe}')" class="bg-amber-600/20 border border-amber-500 text-amber-500 px-3 py-1 rounded text-[10px] uppercase font-bold flex items-center gap-1 hover:bg-amber-600/40 transition-colors animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.4)]" title="Tratar Pendência!"><i class="fas fa-exclamation-triangle text-xs"></i> Auditar</button>`;
                }
            }

            tbodyAnalitica.insertAdjacentHTML('beforeend', `
                <tr class="hover:bg-slate-800/30 transition-colors border-b border-slate-800/50">
                    <td class="px-4 py-3 text-sky-400 font-semibold truncate max-w-[150px]">${motNome}</td>
                    <td class="px-4 py-3 text-slate-400">${valEPS}</td>
                    <td class="px-4 py-3 text-slate-400 text-center">${valUnidade}</td>
                    <td class="px-4 py-3 text-sky-300 font-bold text-center">${valSemana}</td>
                    <td class="px-4 py-3"><span class="text-[10px] text-slate-500 mr-2"><i class="far fa-calendar-alt"></i> ${dI}</span></td>
                    <td class="px-4 py-3 text-center text-slate-200 font-mono">${hI}</td>
                    <td class="px-4 py-3 text-center text-slate-200 font-mono">${hF}</td>
                    <td class="px-4 py-3 text-center text-indigo-400 font-bold">${window.formatarHorasMinutos(linha.horas_noturnas)}</td>
                    <td class="px-4 py-3 text-center text-amber-400 font-bold">${window.formatarHorasMinutos(linha.horas_extras)}</td>
                    <td class="px-4 py-3 text-center ${corLinha}">${window.formatarHorasMinutos(horas)}</td>
                    <td class="px-4 py-3 text-center text-slate-400">${window.formatarHorasMinutos(linha.direcao_horas || 0)}</td>
                    <td class="px-4 py-3"><div class="flex items-center justify-center gap-3 flex-wrap">${badge}${auditHtml}</div></td>
                </tr>
            `);
        });

        if (linhasInseridas === 0) {
            tbodyAnalitica.innerHTML = '<tr><td colspan="12" class="text-center py-6 text-slate-500">Nenhum registro encontrado para este motorista.</td></tr>';
        }
    } catch (eTable) {
        console.error("[Jornadas] Erro ao montar a tabela analítica:", eTable);
    }
};

window.filtrarMotoristaAnalitico = function(nome) {
    const select = document.getElementById('filterAnaliticoMotorista');
    if (select) {
        const exists = Array.from(select.options).some(opt => opt.value === nome);
        if(!exists) { select.insertAdjacentHTML('beforeend', `<option value="${nome}">${nome}</option>`); }
        select.value = nome; window.currentAnaliticoFilter = nome;
        window.atualizarTabelaAnalitica(); 
        if(typeof window.toggleBtnLimparFiltro === 'function') window.toggleBtnLimparFiltro();
        const tBody = document.getElementById('jorTabelaAnaliticaBody');
        if (tBody) tBody.scrollIntoView({behavior: 'smooth', block: 'center'});
    }
};

window.iniciarDashboardJornadas = function() {
    if(typeof criarModaisAuditoria === 'function') criarModaisAuditoria(); 
    window.configurarFiltros();
    if(typeof window.carregarPainelJornadas === 'function') window.carregarPainelJornadas();

    const filterAnaliticoSelect = document.getElementById('filterAnaliticoMotorista');
    const btnLimparFiltroMotorista = document.getElementById('btnLimparFiltroMotorista');
    
    if (filterAnaliticoSelect) {
        filterAnaliticoSelect.removeEventListener('change', window._onChangeJorFiltro);
        window._onChangeJorFiltro = (e) => {
            window.currentAnaliticoFilter = e.target.value;
            window.atualizarTabelaAnalitica();
            if(typeof window.toggleBtnLimparFiltro === 'function') window.toggleBtnLimparFiltro();
        };
        filterAnaliticoSelect.addEventListener('change', window._onChangeJorFiltro);
    }

    if (btnLimparFiltroMotorista) {
        btnLimparFiltroMotorista.removeEventListener('click', window._onClickJorFiltroLimpar);
        window._onClickJorFiltroLimpar = () => {
            window.currentAnaliticoFilter = 'ALL';
            if (filterAnaliticoSelect) filterAnaliticoSelect.value = 'ALL';
            window.atualizarTabelaAnalitica();
            if(typeof window.toggleBtnLimparFiltro === 'function') window.toggleBtnLimparFiltro();
        };
        btnLimparFiltroMotorista.addEventListener('click', window._onClickJorFiltroLimpar);
    }

    const btnRelAuditoria = document.getElementById('btnAbrirModalRelatorioAuditoria');
    if (btnRelAuditoria) {
        btnRelAuditoria.removeEventListener('click', window._onAbrirRelatorio);
        window._onAbrirRelatorio = () => {
            const inputIni = document.getElementById('relAuditDataInicio');
            const inputFim = document.getElementById('relAuditDataFim');
            const modalRel = document.getElementById('modalRelatorioAuditoria');
            if(inputIni) inputIni.value = '';
            if(inputFim) inputFim.value = '';
            if(modalRel) modalRel.classList.remove('hidden');
        };
        btnRelAuditoria.addEventListener('click', window._onAbrirRelatorio);
    }
};

// =========================================================================
// CORREÇÃO PARA SISTEMAS SPA: Aguarda a tela "existir" para disparar a busca
// =========================================================================
let tentativasJornadas = 0;
function aguardarTelaEIniciar() {
    // Verifica se os cards ou o filtro já nasceram na tela
    if (document.getElementById('jornadasFilters') || document.getElementById('jorTotalMotoristas')) {
        console.log("[Jornadas] Tela detectada fisicamente. Inicializando scripts...");
        window.iniciarDashboardJornadas();
    } else {
        tentativasJornadas++;
        if (tentativasJornadas < 50) { // Tenta por 10 segundos
            setTimeout(aguardarTelaEIniciar, 200);
        } else {
            console.warn("[Jornadas] Desistindo da inicialização. O HTML demorou mais de 10s para carregar.");
        }
    }
}
// Começa a verificação
aguardarTelaEIniciar();