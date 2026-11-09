window.initSLA = async function() {
    console.log("[SLA] Módulo iniciado (Modo Alta Performance).");
    const client = window.getSupabaseClient ? window.getSupabaseClient() : (window.db && window.db.supabase ? window.db.supabase : supabaseClient);
    if (!client) return;

    let chartSlaObj = null;
    const nomeMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    let tarifadorAtivoGlobal = null;
    let gruasPropriasCache = new Map();
    let tarifaCache = new Map();

    const btnProcessar = document.getElementById('btnProcessarSLA');
    if (btnProcessar) {
        btnProcessar.addEventListener('click', carregarDadosSLA);
    }
    
    window.addEventListener('resize', () => {
        if (chartSlaObj) chartSlaObj.resize();
    });

    // 1. Busca do Tarifador Ativo
    async function buscarTarifadorAtivoSLA() {
        try {
            let query = client.from('tarifadores').select('*').eq('ativo', true).limit(1);
            if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
            const { data } = await query;
            if (data && data.length > 0) {
                tarifadorAtivoGlobal = data[0];
            } else {
                tarifadorAtivoGlobal = null;
            }
        } catch(e) { console.error("[SLA] Erro tarifador:", e); }
    }

    // 2. Busca das Configurações de Gruas
    async function buscarGruasConfigSLA() {
        try {
            const { data: gruasData } = await client.from('config_gruas').select('codigos, tipo_frente, ordem, frente');
            gruasPropriasCache.clear();
            if (gruasData) {
                gruasData.forEach(g => {
                    const tipo = String(g.tipo_frente || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    if (tipo.includes('PROPRIA') && g.codigos) {
                        g.codigos.split(',').forEach(c => {
                            const cod = c.trim().toUpperCase().replace(/[-\s]/g, '');
                            if (cod && cod !== 'OUTRAS' && cod !== 'OUTROS' && cod !== '0') {
                                gruasPropriasCache.set(cod, {
                                    ordem: g.ordem || 'CX',
                                    frente: g.frente || 'FRENTE DESCONHECIDA',
                                    tipo_frente: g.tipo_frente
                                });
                            }
                        });
                    }
                });
            }
        } catch(e) { console.error("[SLA] Erro gruas:", e); }
    }

    function getInfoGruaSerranaSLA(gruaString) {
        let g = String(gruaString || '').trim().toUpperCase().replace(/[-\s]/g, '');
        if (!g || g === 'NULL' || g === '-') return null;
        if (gruasPropriasCache.has(g)) return gruasPropriasCache.get(g);
        if (g.startsWith('GSR')) return { ordem: 'CX', frente: 'FRENTE SERRANA (GSR)', tipo_frente: 'PROPRIA' };
        return null;
    }

    // 3. Motor de Cálculo de Tarifa (Cacheado)
    function calcularTarifaTransporteSLA(asfalto, terra) {
        if (!tarifadorAtivoGlobal || !tarifadorAtivoGlobal.dados) return 0;
        const chaveCache = `${asfalto}_${terra}`;
        if (tarifaCache.has(chaveCache)) return tarifaCache.get(chaveCache);

        let asfaltoVal = typeof asfalto === 'number' ? asfalto : (parseFloat(String(asfalto).replace(',','.')) || 0);
        let terraVal = typeof terra === 'number' ? terra : (parseFloat(String(terra).replace(',','.')) || 0);
        const dadosMatriz = tarifadorAtivoGlobal.dados;
        
        if (dadosMatriz.length === 0) return 0;

        let resultado = 0;
        if (dadosMatriz[0].is_raio || dadosMatriz[0].raio_inicial !== undefined) {
            let distanciaTotal = asfaltoVal + terraVal;
            let distArredondada = Math.round(distanciaTotal * 100) / 100;
            let faixa = dadosMatriz.find(t => distArredondada >= t.raio_inicial && distArredondada <= t.raio_final);
            
            if (!faixa) {
                let ordenados = [...dadosMatriz].sort((a,b) => a.raio_final - b.raio_final);
                faixa = ordenados.find(t => t.raio_final >= distArredondada);
                if(!faixa) faixa = ordenados[ordenados.length - 1]; 
            }
            resultado = faixa ? parseFloat(faixa.tarifa) : 0;
        } else {
            const exato = dadosMatriz.find(t => Math.abs(t.asfalto - asfaltoVal) < 0.001 && Math.abs(t.terra - terraVal) < 0.001);
            if (exato) {
                resultado = exato.tarifa;
            } else {
                let maisProximo = null;
                let menorDistancia = Infinity;
                for (let i = 0; i < dadosMatriz.length; i++) {
                    const da = dadosMatriz[i].asfalto - asfaltoVal;
                    const dt = dadosMatriz[i].terra - terraVal;
                    const distSq = (da * da) + (dt * dt);
                    if (distSq < menorDistancia) {
                        menorDistancia = distSq;
                        maisProximo = dadosMatriz[i];
                    }
                }
                resultado = maisProximo ? maisProximo.tarifa : 0;
            }
        }
        tarifaCache.set(chaveCache, resultado);
        return resultado;
    }

    // 4. Tratamento robusto de datas
    function extrairMesData(dataStr, anoDesejado) {
        if (!dataStr) return null;
        const str = String(dataStr).trim();
        let dtObj = null;

        if (str.includes('/')) {
            const p = str.split(' ')[0].split('/');
            if (p.length === 3) {
                let y = parseInt(p[2], 10); if (y < 100) y += 2000;
                dtObj = new Date(y, parseInt(p[1], 10) - 1, parseInt(p[0], 10));
            }
        } else if (str.includes('-')) {
            const p2 = str.split('T')[0].split(' ')[0].split('-');
            if (p2.length >= 3) {
                let y = parseInt(p2[0], 10) > 1000 ? parseInt(p2[0], 10) : parseInt(p2[2], 10);
                if (y < 100) y += 2000;
                let m = parseInt(p2[1], 10);
                let d = parseInt(p2[0], 10) > 1000 ? parseInt(p2[2].substring(0, 2), 10) : parseInt(p2[0], 10);
                dtObj = new Date(y, m - 1, d);
            }
        } else {
            dtObj = new Date(str);
        }

        if (dtObj && !isNaN(dtObj.getTime()) && dtObj.getFullYear() == anoDesejado) {
            return {
                mes: dtObj.getMonth(),
                diaKey: `${dtObj.getFullYear()}-${dtObj.getMonth()}-${dtObj.getDate()}`
            };
        }
        return null;
    }

    // 5. Motor Principal de Busca (RPC + Paginação)
    async function carregarDadosSLA() {
        const btn = document.getElementById('btnProcessarSLA');
        const icon = btn ? btn.querySelector('i') : null;
        const containerGruas = document.getElementById('containerGruasMensal');

        if (icon) icon.classList.add('fa-spin');
        if (containerGruas) {
            // Remove o grid momentaneamente para a mensagem de carregamento ficar centralizada
            containerGruas.className = 'flex flex-col gap-6 pb-8';
            containerGruas.innerHTML = `
                <div class="bg-slate-800/60 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-700/50 p-8 text-center text-slate-400">
                    <i class="fas fa-circle-notch fa-spin text-3xl mb-3 text-sky-500"></i>
                    <p>Extraindo dados anuais, aguarde...</p>
                </div>
            `;
        }
        
        const ano = document.getElementById('slaAnoSelect').value;
        const filialId = (window.currentUser && window.currentUser.filial_id) ? parseInt(window.currentUser.filial_id, 10) : null;
        
        const strMinISO = `${ano}-01-01T00:00:00`;
        const strMaxISO = `${ano}-12-31T23:59:59`;

        tarifaCache.clear();
        await buscarTarifadorAtivoSLA();
        await buscarGruasConfigSLA();

        try {
            let dadosFinais = [];

            // A) Tenta usar a RPC (Super Rápida)
            const { data: rpcJson, error: rpcErr } = await client.rpc('get_producao_agrupada_json', {
                p_filial_id: filialId,
                p_data_inicio: strMinISO,
                p_data_fim: strMaxISO
            });

            if (!rpcErr && Array.isArray(rpcJson)) {
                dadosFinais = rpcJson.map(r => ({
                    dataReferencia: r.d,
                    transportadora: r.tr,
                    grua: r.g,
                    distanciaAsfalto: parseFloat(r.a) || 0,
                    distanciaTerra: parseFloat(r.te) || 0,
                    qtdViagens: parseInt(r.q, 10) || 1,
                    volumeReal: parseFloat(r.v) || 0,
                    valor_cte: parseFloat(r.c) || 0
                }));
            } else {
                // B) Fallback de Paginação
                console.warn("[SLA] RPC falhou, usando paginação robusta.");
                let queryCount = client.from('historico_viagens').select('*', { count: 'exact', head: true })
                    .gte('created_at', strMinISO).lte('created_at', strMaxISO);
                if (filialId) queryCount = queryCount.eq('filial_id', filialId);

                const { count } = await queryCount;
                if (count > 0) {
                    const step = 1000;
                    const promises = [];
                    for (let from = 0; from < count; from += step) {
                        let q = client.from('historico_viagens')
                            .select('transportadora, pesoLiquido, volumeReal, distanciaAsfalto, distanciaTerra, grua, created_at, dtFimDescarFabrica, dataDaBaseExcel, valor_cte')
                            .gte('created_at', strMinISO)
                            .lte('created_at', strMaxISO)
                            .range(from, from + step - 1);
                        if (filialId) q = q.eq('filial_id', filialId);
                        promises.push(q);
                    }
                    const responses = await Promise.all(promises);
                    let dadosBrutos = [];
                    responses.forEach(res => { if (res.data) dadosBrutos = dadosBrutos.concat(res.data); });

                    dadosFinais = dadosBrutos.map(r => {
                        const dtFim = r.dtFimDescarFabrica && r.dtFimDescarFabrica !== '-' ? r.dtFimDescarFabrica : null;
                        const dtBase = r.dataDaBaseExcel && r.dataDaBaseExcel !== '-' ? r.dataDaBaseExcel : null;
                        const dStr = dtFim || dtBase || r.created_at;
                        return {
                            dataReferencia: dStr,
                            transportadora: r.transportadora,
                            grua: r.grua,
                            distanciaAsfalto: parseFloat(r.distanciaAsfalto) || 0,
                            distanciaTerra: parseFloat(r.distanciaTerra) || 0,
                            qtdViagens: 1,
                            volumeReal: parseFloat(r.volumeReal) > 0 ? parseFloat(r.volumeReal) : (parseFloat(r.pesoLiquido) || 0),
                            valor_cte: parseFloat(r.valor_cte) || 0
                        };
                    });
                }
            }

            processarSLA(dadosFinais, ano);

        } catch (e) {
            console.error("[SLA] Erro ao buscar dados:", e);
            if (containerGruas) {
                containerGruas.innerHTML = `
                    <div class="bg-slate-800/60 backdrop-blur-sm rounded-xl shadow-2xl border border-red-500/30 p-8 text-center text-red-400">
                        <i class="fas fa-exclamation-triangle text-3xl mb-3 text-red-500"></i>
                        <p>Erro ao processar dados do ano.</p>
                    </div>
                `;
            }
        } finally {
            if (icon) icon.classList.remove('fa-spin');
        }
    }

    function processarSLA(dados, ano) {
        const mesesDados = Array.from({length: 12}, () => ({
            faturamento: 0,
            volume: 0,
            viagensTransp: 0,
            viagensCarreg: 0
        }));

        const gruasDict = {}; 
        let precoCarregamento = parseFloat(tarifadorAtivoGlobal?.preco_carregamento) || 0;

        dados.forEach(r => {
            const tr = (r.transportadora || '').toUpperCase().trim();
            const isSerrana = tr.includes('SERRANALOG') || tr.includes('SERRANA LOG') || tr.includes('SERRANA');
            const gruaRaw = (r.grua || '').toUpperCase().trim();
            const infoGrua = getInfoGruaSerranaSLA(gruaRaw);
            const isNossaGrua = !!infoGrua;
            
            if (!isSerrana && !isNossaGrua) return;

            const dtInfo = extrairMesData(r.dataReferencia, ano);
            if (!dtInfo) return; 
            
            const mes = dtInfo.mes; 
            const diaKey = dtInfo.diaKey;
            
            const vol = r.volumeReal;
            const qtdViagens = r.qtdViagens;

            // Processamento Transporte
            if (isSerrana) {
                let recTransporte = 0;
                if (tarifadorAtivoGlobal) {
                    let tarifa = calcularTarifaTransporteSLA(r.distanciaAsfalto, r.distanciaTerra);
                    recTransporte = tarifa * vol;
                } else {
                    recTransporte = r.valor_cte;
                }
                mesesDados[mes].faturamento += recTransporte;
                mesesDados[mes].volume += vol;
                mesesDados[mes].viagensTransp += qtdViagens;
            }

            // Processamento Carregamento
            if (isNossaGrua) {
                let recCarregamento = vol * precoCarregamento;
                mesesDados[mes].faturamento += recCarregamento; 
                mesesDados[mes].viagensCarreg += qtdViagens;
                
                if (!gruasDict[gruaRaw]) gruasDict[gruaRaw] = {};
                if (!gruasDict[gruaRaw][mes]) gruasDict[gruaRaw][mes] = { viagens: 0, volume: 0, diasOperados: new Set() };
                
                gruasDict[gruaRaw][mes].viagens += qtdViagens;
                gruasDict[gruaRaw][mes].volume += vol;
                gruasDict[gruaRaw][mes].diasOperados.add(diaKey);
            }
        });

        renderizarKpis(mesesDados);
        renderizarGraficoEvolucao(mesesDados, ano);
        renderizarTabelaGruas(gruasDict, ano);
    }

    function renderizarKpis(meses) {
        let totalFat = 0, totalVol = 0, totalVT = 0, totalVC = 0;
        meses.forEach(m => {
            totalFat += m.faturamento;
            totalVol += m.volume;
            totalVT += m.viagensTransp;
            totalVC += m.viagensCarreg;
        });

        document.getElementById('slaTotalFaturamento').innerText = totalFat.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('slaTotalVolume').innerText = totalVol.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' m³';
        document.getElementById('slaTotalViagensTransp').innerText = totalVT.toLocaleString('pt-BR');
        document.getElementById('slaTotalViagensCarreg').innerText = totalVC.toLocaleString('pt-BR');
    }

    function renderizarGraficoEvolucao(meses, ano) {
        const dom = document.getElementById('chartSlaEvolucao');
        if (!dom) return;
        
        const dataFaturamento = meses.map(m => m.faturamento);
        const dataVolume = meses.map(m => m.volume);

        if (chartSlaObj && !chartSlaObj.isDisposed()) {
            chartSlaObj.dispose();
        }
        chartSlaObj = echarts.init(dom);
        
        chartSlaObj.setOption({
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' },
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                borderColor: 'rgba(51, 65, 85, 0.8)',
                textStyle: { color: '#f8fafc' },
                formatter: function (params) {
                    let html = `<div style="font-weight:bold; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; margin-bottom: 4px;">${params[0].axisValue}</div>`;
                    params.forEach(p => {
                        let isFaturamento = p.seriesName.includes('Faturamento');
                        let valFormatado = isFaturamento 
                            ? p.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            : p.value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' m³';
                        
                        html += `${p.marker} ${p.seriesName}: <b style="color: #fff">${valFormatado}</b><br/>`;
                    });
                    return html;
                }
            },
            legend: {
                data: ['Faturamento Transporte (R$)', 'Volume Transportado (m³)'],
                textStyle: { color: '#94a3b8' },
                top: 0
            },
            grid: { top: 40, right: '5%', bottom: '5%', left: '5%', containLabel: true },
            xAxis: {
                type: 'category',
                data: nomeMeses.map(m => `${m}/${String(ano).slice(2)}`),
                axisLabel: { color: '#94a3b8' },
                axisLine: { lineStyle: { color: '#334155' } }
            },
            yAxis: [
                {
                    type: 'value',
                    name: 'Faturamento',
                    nameTextStyle: { color: '#38bdf8' },
                    axisLabel: { color: '#38bdf8', formatter: (v) => v >= 1000 ? (v/1000)+'k' : v },
                    splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } }
                },
                {
                    type: 'value',
                    name: 'Volume (m³)',
                    nameTextStyle: { color: '#a855f7' },
                    axisLabel: { color: '#a855f7', formatter: (v) => v >= 1000 ? (v/1000)+'k' : v },
                    splitLine: { show: false }
                }
            ],
            series: [
                {
                    name: 'Faturamento Transporte (R$)',
                    type: 'bar',
                    data: dataFaturamento,
                    itemStyle: { color: '#38bdf8', borderRadius: [4, 4, 0, 0] }
                },
                {
                    name: 'Volume Transportado (m³)',
                    type: 'line',
                    yAxisIndex: 1,
                    data: dataVolume,
                    symbol: 'circle',
                    symbolSize: 8,
                    lineStyle: { width: 3, color: '#a855f7' },
                    itemStyle: { color: '#a855f7' }
                }
            ]
        });
    }

    // Tabela Responsiva em Grid com Média de Viagens e Totais
    function renderizarTabelaGruas(gruasDict, ano) {
        const container = document.getElementById('containerGruasMensal');
        if (!container) return;
        
        // Altera o layout dinamicamente para Quadros (Cards) na Horizontal
        container.className = 'grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6 pb-8';
        
        let html = '';
        const gruasNomes = Object.keys(gruasDict).sort();
        let possuiAlgumDado = false;

        for (let mes = 0; mes < 12; mes++) {
            let temGruaNoMes = false;
            let linhasHtml = '';
            
            let totalViagens = 0;
            let totalVolume = 0;
            let somaMediaViagens = 0;
            let somaMediaVolume = 0;
            let maxDias = 0;

            gruasNomes.forEach(grua => {
                const stats = gruasDict[grua][mes];
                if (stats && stats.viagens > 0) {
                    temGruaNoMes = true;
                    possuiAlgumDado = true;
                    
                    const dias = stats.diasOperados.size;
                    const mediaVol = dias > 0 ? (stats.volume / dias) : 0;
                    const mediaViagens = dias > 0 ? (stats.viagens / dias) : 0;
                    
                    totalViagens += stats.viagens;
                    totalVolume += stats.volume;
                    somaMediaVolume += mediaVol;
                    somaMediaViagens += mediaViagens;
                    if (dias > maxDias) maxDias = dias;

                    linhasHtml += `
                    <tr class="hover:bg-slate-700/30 transition-colors border-b border-slate-700/50">
                        <td class="px-4 py-2.5 font-mono text-sky-400 font-bold tracking-widest bg-slate-900/30 whitespace-nowrap">${grua}</td>
                        <td class="px-4 py-2.5 text-center text-slate-300 font-mono">${dias}</td>
                        <td class="px-4 py-2.5 text-center text-slate-300 font-black">${stats.viagens}</td>
                        <td class="px-4 py-2.5 text-center text-amber-400 font-mono font-bold">${mediaViagens.toFixed(1)}</td>
                        <td class="px-4 py-2.5 text-right text-slate-300 font-mono whitespace-nowrap">${stats.volume.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                        <td class="px-4 py-2.5 text-right text-emerald-400 font-mono font-black bg-emerald-500/5 whitespace-nowrap">${mediaVol.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                    </tr>`;
                }
            });

            if (temGruaNoMes) {
                // Adicionando a Linha de Totais no Fim do Mês
                linhasHtml += `
                <tr class="bg-slate-900/90 font-bold text-white border-t-2 border-slate-500">
                    <td class="px-4 py-3 text-left uppercase text-[11px] text-slate-400 tracking-wider">Total</td>
                    <td class="px-4 py-3 text-center text-slate-400 font-mono text-xs" title="Máximo de dias operados">${maxDias}</td>
                    <td class="px-4 py-3 text-center text-white font-black">${totalViagens}</td>
                    <td class="px-4 py-3 text-center text-amber-400 font-mono font-bold">${somaMediaViagens.toFixed(1)}</td>
                    <td class="px-4 py-3 text-right text-white font-mono whitespace-nowrap">${totalVolume.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                    <td class="px-4 py-3 text-right text-emerald-400 font-mono font-black bg-emerald-500/10 whitespace-nowrap">${somaMediaVolume.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                </tr>`;

                // Wrapper do Card
                html += `
                <div class="bg-slate-800/60 backdrop-blur-sm rounded-xl shadow-2xl overflow-hidden border border-slate-700/50 flex flex-col h-full">
                    <div class="bg-slate-700/40 px-5 py-3 border-b border-slate-600 flex justify-between items-center">
                        <h3 class="font-bold text-white tracking-wide flex items-center text-sm uppercase">
                            <i class="fas fa-calendar-alt text-amber-400 mr-2"></i> ${nomeMeses[mes]}/${ano}
                        </h3>
                    </div>
                    <div class="overflow-x-auto custom-scrollbar flex-1">
                        <table class="min-w-full text-xs text-left">
                            <thead class="bg-slate-900/80 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-700 whitespace-nowrap">
                                <tr>
                                    <th class="px-4 py-3">Grua</th>
                                    <th class="px-4 py-3 text-center">Dias</th>
                                    <th class="px-4 py-3 text-center">Viagens</th>
                                    <th class="px-4 py-3 text-center" title="Média de Viagens por Dia">V/Dia</th>
                                    <th class="px-4 py-3 text-right">Vol (m³)</th>
                                    <th class="px-4 py-3 text-right text-emerald-400 font-bold" title="Média de Volume por Dia">m³/Dia</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-800/80 text-slate-300">
                                ${linhasHtml}
                            </tbody>
                        </table>
                    </div>
                </div>`;
            }
        }

        if (!possuiAlgumDado) {
            container.className = 'flex flex-col gap-6 pb-8';
            html = `
            <div class="bg-slate-800/60 backdrop-blur-sm rounded-xl shadow-2xl overflow-hidden border border-slate-700/50 flex flex-col p-8 text-center text-slate-500">
                <i class="fas fa-box-open text-4xl mb-3 text-slate-600"></i>
                <p>Nenhum dado de grua encontrado para este ano na sua filial.</p>
            </div>`;
        }

        container.innerHTML = html;
    }

    // Inicialização automática ao carregar
    carregarDadosSLA();
};