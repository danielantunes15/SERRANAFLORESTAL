// ==================== js/indicadores_serrana.js ====================

// FUNÇÃO UNIVERSAL PARA CORRIGIR FUSO HORÁRIO DO SUPABASE
window.corrigirDataSupabase = function(dateStr) {
    if (!dateStr || dateStr === 'null' || dateStr === 'undefined') return null;
    let str = String(dateStr).trim();
    
    // Troca espaço por T (Padrão ISO)
    if (!str.includes('T')) str = str.replace(' ', 'T');
    
    // 1. Remove a letra Z (UTC), caso o Supabase a tenha inserido
    str = str.replace(/Z/gi, '');
    
    // 2. Remove qualquer fuso de horas extra (+00:00, -00:00, etc.) do final da string
    // Isso garante que peguemos a hora crua e literal, ignorando fusos indesejados.
    str = str.replace(/[+-]\d{2}:\d{2}$/, '');
    
    // 3. Corrige o excesso de casas decimais (Supabase manda 6 casas decimais, o JS processa melhor com 3)
    str = str.replace(/\.(\d{3})\d+/, '.$1');

    // 4. Força o fuso horário de Brasília (-03:00) na hora exata que ocorreu o evento
    str += '-03:00';
    
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

window.carregarDadosDashboardSerrana = async function() {
    atualizarRelogioSerrana();
    setInterval(atualizarRelogioSerrana, 1000);

    await atualizarPonteirosSerrana();
    carregarStatusDashSerrana();
    carregarFrentesTvSerrana();
    carregarFrotasParadasSerrana();
      
    setTimeout(() => {
        renderizarGraficoEvolucaoDmSerrana();
    }, 300);
    
    setInterval(() => {
        carregarFrotasParadasSerrana();
        atualizarPonteirosSerrana();
        carregarStatusDashSerrana();
        renderizarGraficoEvolucaoDmSerrana();
    }, 60000); 
}

window.atualizarRelogioSerrana = function() {
    const agora = new Date();
    const dia = String(agora.getDate()).padStart(2, '0');
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const ano = agora.getFullYear();
    const horas = String(agora.getHours()).padStart(2, '0');
    const minutos = String(agora.getMinutes()).padStart(2, '0');
    const segundos = String(agora.getSeconds()).padStart(2, '0');
    
    const elHora = document.getElementById('dash-hora');
    const elData = document.getElementById('dash-data');
    if(elHora) elHora.textContent = `${horas}:${minutos}:${segundos}`;
    if(elData) elData.textContent = `${dia}/${mes}/${ano}`;
}

async function atualizarPonteirosSerrana() {
    let totalCavalos = 0;
    let listaDeCavalos = [];
    
    try {
        let queryFrota = supabaseClient.from('frotas_manutencao').select('cavalo').eq('status', 'Ativo').eq('categoria', 'TRITREM');
        if (typeof window.aplicarFiltroFilial === 'function') queryFrota = window.aplicarFiltroFilial(queryFrota);
        const { data: frotaData, error } = await queryFrota;
        
        if (!error && frotaData) {
            listaDeCavalos = frotaData.map(f => f.cavalo.trim().toUpperCase());
            totalCavalos = listaDeCavalos.length;
        }
    } catch (e) { console.error("Erro Placas Serrana:", e); }

    let contadorEmManutencaoGlobal = 0;
    let cavalosEmManutencao = 0;
    let cavalosSinistrados = 0;

    try {
        let queryOS = supabaseClient.from('ordens_servico').select('placa, status, tipo').in('status', ['Aguardando Oficina', 'Em Manutenção', 'Sinistrado']);
        if (typeof window.aplicarFiltroFilial === 'function') queryOS = window.aplicarFiltroFilial(queryOS);
        const { data: osData, error: osError } = await queryOS;
            
        if (!osError && osData) {
            const placasUnicasGeral = new Set();
            const setCavalosManut = new Set();
            const setCavalosSinistro = new Set();

            osData.forEach(os => {
                if (!os.placa) return; 
                if (os.tipo && os.tipo.toUpperCase() === 'CAVALO DISPONÍVEL S/ CARRETA') return;

                const placaLimpa = os.placa.trim().toUpperCase();
                
                if (listaDeCavalos.includes(placaLimpa)) {
                    if (os.status === 'Sinistrado') {
                        placasUnicasGeral.add(placaLimpa);
                        setCavalosSinistro.add(placaLimpa);
                    } else if (os.status === 'Aguardando Oficina' || os.status === 'Em Manutenção') {
                        placasUnicasGeral.add(placaLimpa);
                        setCavalosManut.add(placaLimpa);
                    }
                }
            });

            setCavalosSinistro.forEach(placa => { setCavalosManut.delete(placa); });
            
            contadorEmManutencaoGlobal = placasUnicasGeral.size;
            cavalosEmManutencao = setCavalosManut.size;
            cavalosSinistrados = setCavalosSinistro.size;
        }
    } catch (e) { console.error("Erro O.S. Serrana:", e); }

    let frotaDisponivel = totalCavalos - cavalosEmManutencao - cavalosSinistrados;
    if(frotaDisponivel < 0) frotaDisponivel = 0;

    const elGaugeFill = document.getElementById('gauge-fill-frota');
    const elPonteiro = document.getElementById('gauge-ponteiro-frota');

    if (elGaugeFill && totalCavalos > 0) {
        const perc = (frotaDisponivel / totalCavalos) * 100;
        const fillRotation = -225 + (1.8 * perc);
        elGaugeFill.style.transform = `rotate(${fillRotation}deg)`;
        if (elPonteiro) {
            const ponteiroRotation = -90 + (1.8 * perc);
            elPonteiro.style.transform = `translateX(-50%) rotate(${ponteiroRotation}deg)`;
        }
    } else {
        if (elGaugeFill) elGaugeFill.style.transform = `rotate(-225deg)`;
        if (elPonteiro) elPonteiro.style.transform = `translateX(-50%) rotate(-90deg)`;
    }

    const elFrotaDisp = document.getElementById('texto-frota-disponivel');
    const elFrotaTotal = document.getElementById('texto-frota-total');
    const elManut = document.getElementById('texto-manut-total');

    if(elFrotaDisp) elFrotaDisp.textContent = frotaDisponivel;
    if(elFrotaTotal) elFrotaTotal.textContent = totalCavalos;
    if(elManut) elManut.textContent = contadorEmManutencaoGlobal;
}

async function carregarFrotasParadasSerrana() {
    const container = document.getElementById('lista-frotas-paradas');
    if(!container) return;
    try {
        let queryFrota = supabaseClient.from('frotas_manutencao').select('cavalo').eq('status', 'Ativo').eq('categoria', 'TRITREM');
        if (typeof window.aplicarFiltroFilial === 'function') queryFrota = window.aplicarFiltroFilial(queryFrota);
        const { data: frotaData } = await queryFrota;
        
        const listaCavalos = frotaData ? frotaData.map(f => f.cavalo.trim().toUpperCase()) : [];

        let queryOS = supabaseClient.from('ordens_servico').select('placa, problema, status, tipo, data_abertura').in('status', ['Aguardando Oficina', 'Em Manutenção', 'Sinistrado']);
        if (typeof window.aplicarFiltroFilial === 'function') queryOS = window.aplicarFiltroFilial(queryOS);
        const { data: osData } = await queryOS;
            
        let html = '';
        const agora = new Date();
        
        const osFiltradas = osData ? osData.filter(os => 
            os.placa && 
            listaCavalos.includes(os.placa.trim().toUpperCase()) && 
            !(os.tipo && os.tipo.toUpperCase() === 'CAVALO DISPONÍVEL S/ CARRETA')
        ) : [];
        
        if (osFiltradas && osFiltradas.length > 0) {
            let frotasProcessadas = osFiltradas.map(os => {
                let diffMs = 0;
                let textoTempo = 'N/I';
                
                let inicio = window.corrigirDataSupabase(os.data_abertura);
                
                if (inicio) {
                    diffMs = agora - inicio;
                    if (diffMs > 0) {
                        const diffMinutos = Math.floor(diffMs / (1000 * 60));
                        const dias = Math.floor(diffMinutos / (60 * 24));
                        const horas = Math.floor((diffMinutos % (60 * 24)) / 60);
                        const minutos = diffMinutos % 60;
                        
                        if (dias > 0) textoTempo = `${dias}d ${horas}h ${minutos}m`;
                        else if (horas > 0) textoTempo = `${horas}h ${minutos}m`;
                        else textoTempo = `${minutos}m`;
                    } else {
                        textoTempo = 'Agora';
                        diffMs = 0; 
                    }
                }
                
                return { ...os, diffMs, textoTempo };
            });

            frotasProcessadas.sort((a, b) => b.diffMs - a.diffMs);

            frotasProcessadas.forEach(os => {
                let corBorder = '#ef4444'; 
                let icon = 'fas fa-tools';
                
                if (os.status === 'Em Manutenção') {
                    corBorder = '#f59e0b'; 
                    icon = 'fas fa-wrench';
                } else if (os.status === 'Sinistrado') {
                    corBorder = '#b91c1c'; 
                    icon = 'fas fa-exclamation-triangle';
                }

                const tipoTexto = os.tipo ? os.tipo : 'Não Informado';

                html += `
                <div style="background: rgba(15, 23, 42, 0.6); border-left: 4px solid ${corBorder}; padding: 12px; border-radius: 6px; display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
                        
                        <span style="font-weight: 900; color: #fff; font-size: 1.1rem; white-space: nowrap;">
                            <i class="${icon}" style="color: ${corBorder}; margin-right: 5px; font-size: 0.9rem;"></i> ${os.placa || 'N/I'}
                        </span>
                        
                        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end;">
                            <span style="font-size: 0.7rem; background: rgba(56, 189, 248, 0.1); color: #38bdf8; padding: 3px 6px; border-radius: 4px; font-weight: bold; border: 1px solid rgba(56, 189, 248, 0.3);">
                                <i class="fas fa-tag" style="margin-right: 3px;"></i> ${tipoTexto}
                            </span>
                            
                            <span style="font-size: 0.7rem; background: rgba(255,255,255,0.08); color: #cbd5e1; padding: 3px 6px; border-radius: 4px; font-weight: bold; border: 1px solid rgba(255,255,255,0.1);">
                                <i class="fas fa-clock" style="color: #94a3b8; margin-right: 3px;"></i> Parado: ${os.textoTempo}
                            </span>
                            
                            <span style="font-size: 0.7rem; background: ${corBorder}20; color: ${corBorder}; padding: 3px 6px; border-radius: 4px; font-weight: bold; border: 1px solid ${corBorder}40;">
                                ${os.status}
                            </span>
                        </div>
                    </div>
                    <span style="font-size: 0.85rem; color: #94a3b8; line-height: 1.3;">${os.problema ? os.problema : 'Sem detalhes relatados.'}</span>
                </div>
                `;
            });

        } else {
            html = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; opacity: 0.5;">
                <i class="fas fa-check-circle" style="font-size: 3rem; color: #22c55e; margin-bottom: 10px;"></i>
                <div style="color: #22c55e; font-weight: bold; font-size: 1.1rem;">Nenhuma frota parada!</div>
            </div>`;
        }
        
        container.innerHTML = html;

    } catch(e) {
        console.error("Erro Frotas Paradas:", e);
    }
}

async function carregarStatusDashSerrana() {
    let queryCtrl = supabaseClient.from('dashboard_status').select('id, controlador').limit(1);
    if (typeof window.aplicarFiltroFilial === 'function') queryCtrl = window.aplicarFiltroFilial(queryCtrl);
    const { data: statusData } = await queryCtrl;
    
    const nomeCtrl = (statusData && statusData.length > 0 && statusData[0].controlador) ? statusData[0].controlador : 'NÃO DEFINIDO';
    const elDashControladorNome = document.getElementById('dash-controlador-nome');
    if (elDashControladorNome) {
        elDashControladorNome.textContent = nomeCtrl;
    }

    const turnos = await db.getTurnosOperacionais();
    let turnoTexto = "06:00 às 18:00";
    let turnoTipo = "DIA";
    
    if (turnos && turnos.length > 0) {
        const agora = new Date();
        const tempoAtualMinutos = agora.getHours() * 60 + agora.getMinutes();
        
        let turnoAtivo = turnos[0]; 
        
        for (let t of turnos) {
            if(!t.hora_inicio || !t.hora_fim) continue;
            
            const [hIni, mIni] = t.hora_inicio.split(':').map(Number);
            const [hFim, mFim] = t.hora_fim.split(':').map(Number);
            
            const iniMin = hIni * 60 + mIni;
            const fimMin = hFim * 60 + mFim;
            
            if (iniMin < fimMin) {
                if (tempoAtualMinutos >= iniMin && tempoAtualMinutos < fimMin) { turnoAtivo = t; break; }
            } else {
                if (tempoAtualMinutos >= iniMin || tempoAtualMinutos < fimMin) { turnoAtivo = t; break; }
            }
        }
        
        const formataHora = (h) => h ? h.substring(0, 5) : '--:--';
        turnoTexto = `${formataHora(turnoAtivo.hora_inicio)} às ${formataHora(turnoAtivo.hora_fim)}`;
        turnoTipo = turnoAtivo.tipo || 'DIA';
    }

    const elTurnoNome = document.getElementById('dash-turno-nome');
    const elTurnoIcon = document.getElementById('dash-turno-icon');

    if(elTurnoNome) elTurnoNome.textContent = turnoTexto;
    if(elTurnoIcon) {
        if(turnoTipo === 'DIA') {
            elTurnoIcon.className = "fas fa-sun";
            elTurnoIcon.style.color = "#f59e0b";
        } else {
            elTurnoIcon.className = "fas fa-moon";
            elTurnoIcon.style.color = "#38bdf8";
        }
    }
}

async function carregarFrentesTvSerrana() {
    try {
        let queryFrentes = supabaseClient.from('frentes_trabalho').select('*').eq('status', 'Ativa');
        if (typeof window.aplicarFiltroFilial === 'function') queryFrentes = window.aplicarFiltroFilial(queryFrentes);
        const { data } = await queryFrentes;
        
        const containerNovo = document.getElementById('kpi-lista-frentes-nomes');
        const elKpiFrentes = document.getElementById('kpi-frentes');
        
        if (data && data.length > 0) {
            if(elKpiFrentes) elKpiFrentes.textContent = data.length;
            
            let htmlCaixinhas = '';
            
            data.forEach(f => {
                htmlCaixinhas += `
                <div style="background: rgba(34, 197, 94, 0.15); padding: 8px 12px; border-radius: 6px; font-size: 0.95rem; font-weight: bold; border: 1px solid rgba(34, 197, 94, 0.4); display: flex; align-items: center; gap: 10px; color: #22c55e; text-align: left; width: 100%; box-shadow: 0 2px 4px rgba(0,0,0,0.2); margin-bottom: 6px;">
                    <i class="fas fa-truck-loading" style="font-size: 1.1rem;"></i> 
                    <span style="flex-grow: 1;">${f.nome}</span>
                </div>`;
            });
            
            if(containerNovo) containerNovo.innerHTML = htmlCaixinhas;
            
        } else {
            if(elKpiFrentes) elKpiFrentes.textContent = '0';
            const msgVazia = '<div class="empty-state" style="font-size: 0.85rem; color: #94a3b8; font-weight: bold;">Nenhuma frente ativa.</div>';
            if(containerNovo) containerNovo.innerHTML = msgVazia;
        }
    } catch(e) { console.error("Erro Frentes:", e); }
}

async function renderizarGraficoEvolucaoDmSerrana() {
    const chartDom = document.getElementById('graficoEvolucaoDmSerrana');
    if (!chartDom) return;

    try {
        let queryFrota = supabaseClient.from('frotas_manutencao').select('cavalo').eq('status', 'Ativo').eq('categoria', 'TRITREM');
        if (typeof window.aplicarFiltroFilial === 'function') queryFrota = window.aplicarFiltroFilial(queryFrota);
        const { data: frotaData } = await queryFrota;
        
        let frotas = [];
        if (frotaData) {
            frotas = frotaData.map(f => f.cavalo).filter(Boolean);
        }
        
        const totalFrotas = [...new Set(frotas)].length; 

        if(totalFrotas === 0) {
            chartDom.innerHTML = '<div class="empty-state">Sem dados de frota Tritrem ativa para calcular DM.</div>';
            return;
        }

        let queryOS = supabaseClient.from('ordens_servico')
            .select('placa, data_abertura, data_conclusao, status, tipo')
            .neq('status', 'Agendada')
            .order('data_abertura', { ascending: false })
            .limit(5000);
            
        if (typeof window.aplicarFiltroFilial === 'function') queryOS = window.aplicarFiltroFilial(queryOS);
        const { data: osData } = await queryOS;
        
        const limpaPlaca = p => String(p || 'DESCONHECIDO').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const frotasCavalosArray = frotas.map(c => limpaPlaca(c));
        
        let ordensServico = (osData || []).filter(os => 
            os.placa &&
            frotasCavalosArray.includes(limpaPlaca(os.placa)) && 
            !(os.tipo && os.tipo.toUpperCase() === 'CAVALO DISPONÍVEL S/ CARRETA')
        );

        let totalFrotasValidas = totalFrotas;
        if(totalFrotasValidas < 0) totalFrotasValidas = 0;

        const agora = new Date();
        const categoriasHoras = [];
        const dadosDM = [];

        const msPorHora = 60 * 60 * 1000;          
        const totalMsDisponivelPorHora = totalFrotasValidas * msPorHora;          

        const placasEmOS = [...new Set(ordensServico.map(os => limpaPlaca(os.placa)))];

        for (let h = 0; h < 24; h++) {
            const inicioHora = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), h, 0, 0, 0);
            const fimHora = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), h, 59, 59, 999);
            
            let msManutencaoNestaHora = 0;

            placasEmOS.forEach(placaOS => {
                let tempoParadoDoCavalo = 0;
                const osDesteCavalo = ordensServico.filter(o => limpaPlaca(o.placa) === placaOS);
                
                osDesteCavalo.forEach(os => {
                    let osInicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0); 
                    if (os.data_abertura && os.data_abertura !== 'null') {
                        let d = window.corrigirDataSupabase(os.data_abertura);
                        if (d) osInicio = d;
                    } else if (os.status === 'Concluída' || os.status === 'Resolvido') {
                        return;
                    }
                    
                    let osFim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999);
                    if (os.data_conclusao && os.data_conclusao !== 'null') {
                        let d = window.corrigirDataSupabase(os.data_conclusao);
                        if (d) osFim = d;
                    }

                    const overlapInicio = osInicio > inicioHora ? osInicio : inicioHora;
                    const overlapFim = osFim < fimHora ? osFim : fimHora;

                    if (overlapInicio < overlapFim) {
                        tempoParadoDoCavalo += (overlapFim - overlapInicio);
                    }
                });
                
                if (tempoParadoDoCavalo > msPorHora) tempoParadoDoCavalo = msPorHora;
                msManutencaoNestaHora += tempoParadoDoCavalo;
            });

            let dispNestaHora = totalMsDisponivelPorHora - msManutencaoNestaHora;
            if(dispNestaHora < 0) dispNestaHora = 0;
            
            let percentDM = 100;
            if (totalMsDisponivelPorHora > 0) {
                percentDM = (dispNestaHora / totalMsDisponivelPorHora) * 100;
            }
            
            categoriasHoras.push(`${String(h).padStart(2,'0')}:00`);
            
            if (inicioHora > agora) {
                dadosDM.push(null); 
            } else {
                dadosDM.push(percentDM.toFixed(1));
            }
        }

        if (typeof echarts === 'undefined') return;

        let myChart = echarts.getInstanceByDom(chartDom);
        if (!myChart) {
            myChart = echarts.init(chartDom);
            window.addEventListener('resize', () => {
                if(myChart) myChart.resize();
            });
        }

        const option = {
            tooltip: { 
                trigger: 'axis', 
                formatter: '{b} <br/> DM da Hora: <b>{c}%</b>', 
                backgroundColor: 'rgba(0,0,0,0.85)', 
                borderColor: '#38bdf8',
                textStyle: { color: '#fff' } 
            },
            grid: { left: '3%', right: '4%', bottom: '5%', top: '25%', containLabel: true },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: categoriasHoras,
                axisLabel: { color: '#94a3b8', fontWeight: 'bold' },
                axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
            },
            yAxis: {
                type: 'value',
                min: 0,
                max: 100,
                axisLabel: { formatter: '{value}%', color: '#94a3b8' },
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)', type: 'dashed' } }
            },
            series: [{
                name: 'DM Hora',
                type: 'line',
                data: dadosDM,
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                label: {
                    show: true,
                    position: 'top',
                    formatter: '{c}%',
                    color: '#e2e8f0', 
                    fontSize: 11, 
                    fontWeight: 'bold',
                    distance: 6
                },
                itemStyle: { color: '#38bdf8' },
                lineStyle: { width: 3, color: '#38bdf8' },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(56, 189, 248, 0.4)' },
                        { offset: 1, color: 'rgba(56, 189, 248, 0)' }
                    ])
                }
            }]
        };

        myChart.setOption(option);

    } catch(e) {
        console.error("Erro Crítico DM Serrana:", e);
    }
}

window.exportarDashboardPNGSerrana = function() {
    const elemento = document.getElementById('area-print-dash');
    const botaoPrint = document.getElementById('btn-gerar-print');
    
    botaoPrint.style.display = 'none';
    
    html2canvas(elemento, { 
        backgroundColor: '#070b14', 
        scale: 4, 
        useCORS: true,
        logging: false 
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `CCOL_SERRANA_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png'); 
        link.click();
        
        botaoPrint.style.display = 'flex';
    });
}