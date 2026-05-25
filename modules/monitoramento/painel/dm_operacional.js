// ==================== js/dm_operacional.js ====================

// CONEXÃO COM O BANCO DE DADOS EXCLUSIVO (DM / OFICINA)
const supabaseUrlDM = 'https://ihgiyxzxdldqmrkziijl.supabase.co';
const supabaseKeyDM = 'sb_publishable_JpMZhW5ZrFKBr7m9KXBkoQ_cpxy1k3x';
const supabaseDM = window.supabase.createClient(supabaseUrlDM, supabaseKeyDM);


// ------------------------------------------------------------------
// 1. LÓGICA DO GRÁFICO: DM OPERACIONAL (VERDE - IMPORTADO VIA EXCEL)
// ------------------------------------------------------------------
async function processarImportacaoDM(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (typeof XLSX === 'undefined') {
        alert("A biblioteca de Excel ainda está carregando. Aguarde alguns segundos e tente novamente.");
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const registrosParaSalvar = [];
        
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (row.length === 0 || !row[0]) continue;

            let dataStr = row[0];
            let rodou = parseInt(row[1]) || 0;
            let total = parseInt(row[2]) || 0;
            let dataFormatada = null;

            if (typeof dataStr === 'number') {
                const dateObj = new Date((dataStr - 25569) * 86400 * 1000);
                const d = dateObj.getUTCDate();
                const m = dateObj.getUTCMonth() + 1;
                const y = dateObj.getUTCFullYear();
                dataFormatada = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            } else if (typeof dataStr === 'string') {
                const strTratada = dataStr.trim().replace(/-/g, '/');
                const partes = strTratada.split('/');
                if (partes.length >= 3) {
                    let ano = partes[2].substring(0, 4);
                    if (ano.length === 2) ano = '20' + ano;
                    dataFormatada = `${ano}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
                }
            }

            if (dataFormatada && dataFormatada.length === 10 && dataFormatada.startsWith('20')) {
                registrosParaSalvar.push({
                    data_registro: dataFormatada,
                    carros_rodaram: rodou,
                    total_frota: total
                });
            }
        }

        if (registrosParaSalvar.length === 0) {
            alert("Nenhum dado válido encontrado. O padrão é: Data (DD/MM/AAAA) | Rodaram | Total.");
            document.getElementById('uploadDMExcel').value = "";
            return;
        }

        try {
            const { error } = await supabaseDM
                .from('dm_operacional')
                .upsert(registrosParaSalvar, { onConflict: 'data_registro' });

            if (error) throw error;
            
            alert(`✅ Sucesso! ${registrosParaSalvar.length} dias atualizados/importados.`);
            
            const chartDiv = document.getElementById('graficoDmOperacional');
            if (chartDiv) chartDiv.removeAttribute('data-rendered');
            
            const selectFiltro = document.getElementById('filtroPeriodoDM');
            const filtroVal = selectFiltro ? selectFiltro.value : '30';
            window.renderizarGraficoDMOperacional(filtroVal);
            
        } catch (error) {
            console.error("Erro na importação:", error);
            alert("Erro ao salvar no banco secundário. Motivo: " + error.message);
        }
        
        document.getElementById('uploadDMExcel').value = "";
    };
    reader.readAsArrayBuffer(file);
}

window.renderizarGraficoDMOperacional = async function(filtroPeriodo = '30') {
    const divGrafico = document.getElementById('graficoDmOperacional');
    if (!divGrafico || divGrafico.offsetWidth === 0) return;

    // Detecta o filtro ativo na interface
    let activeQF = document.querySelector('#quickFiltersGroup .btn-qf.active')?.getAttribute('data-qf') || 'ALL';
    if (filtroPeriodo === 'mes_atual' || filtroPeriodo === 'MES') activeQF = 'MES';
    if (filtroPeriodo === 'SEM') activeQF = 'SEM';

    const hoje = new Date();
    let dataStrCorte = '';

    if (activeQF === 'MES') {
        const y = hoje.getFullYear();
        const m = String(hoje.getMonth() + 1).padStart(2, '0');
        dataStrCorte = `${y}-${m}-01`;
    } else if (activeQF === 'SEM') {
        const dataDomingo = new Date(hoje);
        dataDomingo.setDate(hoje.getDate() - hoje.getDay()); // Volta para o domingo da semana atual
        const y = dataDomingo.getFullYear();
        const m = String(dataDomingo.getMonth() + 1).padStart(2, '0');
        const d = String(dataDomingo.getDate()).padStart(2, '0');
        dataStrCorte = `${y}-${m}-${d}`;
    } else {
        let dias = 30;
        if (activeQF === 'D-7') dias = 7;
        else if (activeQF === 'D-2') dias = 2;
        else if (activeQF === 'D-1') dias = 1;
        
        const dataPassada = new Date(hoje);
        dataPassada.setDate(hoje.getDate() - dias);
        const y = dataPassada.getFullYear();
        const m = String(dataPassada.getMonth() + 1).padStart(2, '0');
        const d = String(dataPassada.getDate()).padStart(2, '0');
        dataStrCorte = `${y}-${m}-${d}`;
    }

    try {
        const { data, error } = await supabaseDM
            .from('dm_operacional')
            .select('*')
            .gte('data_registro', dataStrCorte)
            .order('data_registro', { ascending: false });

        if (error) throw error;

        if (typeof echarts !== 'undefined') {
            let chartExistente = echarts.getInstanceByDom(divGrafico);
            if (chartExistente) chartExistente.dispose();
        }

        if (!data || data.length === 0) {
            divGrafico.innerHTML = `<div style="color:#94a3b8; display:flex; justify-content:center; align-items:center; height:100%; border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px; text-align:center; padding: 20px;">📂 Nenhum dado operacional encontrado neste período.</div>`;
            return;
        }

        divGrafico.innerHTML = '';
        const dadosOrdenados = data.reverse();

        const eixoXDias = [];
        const seriesData = [];

        dadosOrdenados.forEach(reg => {
            const partes = reg.data_registro.split('-');
            eixoXDias.push(`${partes[2]}/${partes[1]}`);
            
            let pct = reg.total_frota > 0 ? (reg.carros_rodaram / reg.total_frota) * 100 : 0;
            seriesData.push({ value: pct.toFixed(1), rodaram: reg.carros_rodaram, total: reg.total_frota });
        });

        if (typeof echarts === 'undefined') return;

        const chart = echarts.init(divGrafico);
        const option = {
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(15,23,42,0.9)',
                borderColor: '#10b981',
                textStyle: { color: '#f8fafc' },
                formatter: function (params) {
                    const d = params[0].data;
                    return `<div style="font-weight:bold; margin-bottom:5px; border-bottom:1px solid #334155; padding-bottom: 5px;">Data: ${params[0].name}</div>` +
                           `<span style="color:#10b981;">●</span> DM Operacional: <b>${d.value}%</b><br/>` +
                           `<span style="color:#38bdf8;">●</span> Rodando: <b>${d.rodaram}</b> cam.<br/>` +
                           `<span style="color:#94a3b8;">●</span> Frota Total: <b>${d.total}</b> cam.`;
                }
            },
            grid: { left: '3%', right: '4%', bottom: '5%', containLabel: true },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: eixoXDias,
                axisLabel: { color: '#94a3b8', fontFamily: 'Inter' },
                axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
            },
            yAxis: {
                type: 'value',
                min: 0,
                max: 100,
                axisLabel: { color: '#94a3b8', formatter: '{value}%', fontFamily: 'Inter' },
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)', type: 'dashed' } }
            },
            series: [{
                name: 'DM Operacional',
                type: 'line',
                data: seriesData,
                smooth: true,
                symbol: 'circle',
                symbolSize: 8,
                label: { 
                    show: true, 
                    position: 'top', 
                    color: '#ffffff', 
                    fontFamily: "'Inter', sans-serif", 
                    fontSize: 11, 
                    fontWeight: 'bold',
                    textBorderColor: 'rgba(0, 0, 0, 0.8)',
                    textBorderWidth: 2,
                    lineHeight: 14,
                    align: 'center',
                    formatter: function (params) {
                        return params.data.value + '%\n(' + params.data.rodaram + ' / ' + params.data.total + ')';
                    } 
                },
                itemStyle: { color: '#10b981' },
                lineStyle: { color: '#10b981', width: 3 },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(16, 185, 129, 0.4)' },
                        { offset: 1, color: 'rgba(16, 185, 129, 0.0)' }
                    ])
                }
            }]
        };

        chart.setOption(option);
        window.removeEventListener('resize', chart.resize); 
        window.addEventListener('resize', () => chart.resize());

    } catch (err) {
        console.error("Erro no gráfico DM Operacional", err);
    }
}


// ------------------------------------------------------------------
// 2. LÓGICA DO GRÁFICO: DM GERAL - OFICINA (AZUL - LÓGICA DE O.S.)
// ------------------------------------------------------------------
window.renderizarGraficoEvolucaoDM = async function(filtroValue = '30') {
    const chartDom = document.getElementById('graficoEvolucaoDM');
    if (!chartDom || chartDom.offsetWidth === 0) return;

    try {
        const { data: frotasData, error: errFrotas } = await supabaseDM
            .from('frotas_manutencao')
            .select('*')
            .order('cavalo', { ascending: true });

        const { data: osData, error: errOs } = await supabaseDM
            .from('ordens_servico')
            .select('*')
            .order('created_at', { ascending: false });

        if (errFrotas || errOs) {
            console.error("Erro ao buscar dados da Oficina:", errFrotas || errOs);
            chartDom.innerHTML = `<div style="color:#ef4444; display:flex; justify-content:center; align-items:center; height:100%; border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px;">🚨 Erro ao carregar DM Oficina. Verifique a conexão com o banco.</div>`;
            return;
        }

        const frotasManutencao = frotasData || [];
        const ordensServico = osData || [];

        if (frotasManutencao.length === 0) {
            chartDom.innerHTML = `<div style="color:#94a3b8; display:flex; justify-content:center; align-items:center; height:100%; border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px;">📂 Nenhuma frota cadastrada na base da Oficina.</div>`;
            return;
        }

        const agora = new Date();
        const categoriasDias = [];
        const dadosDM = [];

        const msPorDia = 24 * 60 * 60 * 1000;
        const totalMsDisponivelPorDia = frotasManutencao.length * msPorDia;
        
        // Detecta o filtro ativo na interface
        let activeQF = document.querySelector('#quickFiltersGroup .btn-qf.active')?.getAttribute('data-qf') || 'ALL';
        if (filtroValue === 'mes_atual' || filtroValue === 'MES') activeQF = 'MES';
        if (filtroValue === 'SEM') activeQF = 'SEM';

        let diasARenderizar = 30;

        if (activeQF === 'MES') {
            diasARenderizar = agora.getDate(); // Dia 1 até o dia atual
        } else if (activeQF === 'SEM') {
            diasARenderizar = agora.getDay() + 1; // Domingo até o dia atual
        } else {
            if (activeQF === 'D-7') diasARenderizar = 7;
            else if (activeQF === 'D-2') diasARenderizar = 2;
            else if (activeQF === 'D-1') diasARenderizar = 1;
            else diasARenderizar = 30;
        }

        // Monta o gráfico dia a dia, subtraindo os dias reais
        for (let i = diasARenderizar - 1; i >= 0; i--) {
            const dataDia = new Date(agora);
            dataDia.setDate(agora.getDate() - i);
            
            const inicioDia = new Date(dataDia.getFullYear(), dataDia.getMonth(), dataDia.getDate(), 0, 0, 0);
            const fimDia = new Date(dataDia.getFullYear(), dataDia.getMonth(), dataDia.getDate(), 23, 59, 59, 999);
            
            let msManutencaoNesteDia = 0;

            frotasManutencao.forEach(frota => {
                let manutencaoCavalo = 0;
                const todasOSCavalo = ordensServico.filter(o => o.placa === frota.cavalo);
                
                todasOSCavalo.forEach(os => {
                    let osInicioStr = os.data_abertura;
                    if (!osInicioStr) return;
                    if (!osInicioStr.includes('T')) osInicioStr += 'T00:00:00';
                    const osInicio = new Date(osInicioStr.replace('Z', '').replace('+00:00', ''));
                    
                    let osFim = agora;
                    if (os.data_conclusao) {
                        let osFimStr = os.data_conclusao;
                        if (!osFimStr.includes('T')) osFimStr += 'T00:00:00';
                        osFim = new Date(osFimStr.replace('Z', '').replace('+00:00', ''));
                    }

                    const overlapInicio = osInicio > inicioDia ? osInicio : inicioDia;
                    const overlapFim = osFim < fimDia ? osFim : fimDia;

                    if (overlapInicio < overlapFim && os.status !== 'Agendada') {
                        manutencaoCavalo += (overlapFim - overlapInicio);
                    }
                });
                
                if (manutencaoCavalo > msPorDia) manutencaoCavalo = msPorDia;
                msManutencaoNesteDia += manutencaoCavalo;
            });

            let dispNesteDia = totalMsDisponivelPorDia - msManutencaoNesteDia;
            if(dispNesteDia < 0) dispNesteDia = 0;
            
            let percentDM = (dispNesteDia / totalMsDisponivelPorDia) * 100;
            
            categoriasDias.push(`${String(dataDia.getDate()).padStart(2,'0')}/${String(dataDia.getMonth()+1).padStart(2,'0')}`);
            dadosDM.push(percentDM.toFixed(2));
        }

        if (typeof echarts === 'undefined') return;
        
        let myChart = echarts.getInstanceByDom(chartDom);
        if (!myChart) myChart = echarts.init(chartDom);

        const option = {
            tooltip: { trigger: 'axis', backgroundColor: 'rgba(15,23,42,0.9)', borderColor: '#3b82f6', textStyle: { color: '#f8fafc' }, formatter: '{b} <br/> DM Geral: {c}%' },
            grid: { left: '3%', right: '4%', bottom: '5%', containLabel: true },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: categoriasDias,
                axisLabel: { color: '#94a3b8', fontFamily: 'Inter' },
                axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
            },
            yAxis: {
                type: 'value',
                min: 0,
                max: 100,
                axisLabel: { formatter: '{value}%', color: '#94a3b8', fontFamily: 'Inter' },
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)', type: 'dashed' } }
            },
            series: [{
                name: 'DM Diário',
                type: 'line',
                data: dadosDM,
                smooth: true,
                symbol: 'circle',
                symbolSize: 8,
                label: {
                    show: true,
                    position: 'top',
                    formatter: '{c}%',
                    color: '#e2e8f0',
                    fontSize: 11,
                    fontWeight: 'bold'
                },
                itemStyle: { color: '#3b82f6' },
                lineStyle: { width: 4 },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(59, 130, 246, 0.4)' },
                        { offset: 1, color: 'rgba(59, 130, 246, 0)' }
                    ])
                }
            }]
        };

        myChart.setOption(option);
        window.removeEventListener('resize', myChart.resize); 
        window.addEventListener('resize', () => myChart.resize());

    } catch (err) {
        console.error("Erro crítico ao renderizar gráfico da Oficina:", err);
    }
};


// ------------------------------------------------------------------
// 3. GATILHO INICIAL / SINCRONIZADOR DE RENDERIZAÇÃO
// ------------------------------------------------------------------
setInterval(() => {
    const divGrafico = document.getElementById('graficoDmOperacional');
    
    if (divGrafico && divGrafico.offsetWidth > 0 && !divGrafico.getAttribute('data-rendered')) {
        divGrafico.setAttribute('data-rendered', 'true');
        const selectFiltro = document.getElementById('filtroPeriodoDM');
        const filtroVal = selectFiltro ? selectFiltro.value : '30';
        window.renderizarGraficoDMOperacional(filtroVal);
        window.renderizarGraficoEvolucaoDM(filtroVal);
    }
}, 1000);