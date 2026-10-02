// ==================== modules/gerencial/visao_executiva/visao_executiva.js ====================
var execChartComparativo = null;
var execChartEvolucao = null;
var execChart7Dias = null;
const tarifaCache = new Map();

function getCampo(obj, possiveisNomes) {
    if (!obj) return '';
    const chavesReais = Object.keys(obj);
    for (let nomeProcurado of possiveisNomes) {
        const chaveEncontrada = chavesReais.find(k => k.toLowerCase() === nomeProcurado.toLowerCase());
        if (chaveEncontrada && obj[chaveEncontrada] !== null && obj[chaveEncontrada] !== undefined) {
            return obj[chaveEncontrada];
        }
    }
    return '';
}

function toNumber(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    let strLimpa = String(val).replace('R$', '').trim().replace(',', '.');
    let num = parseFloat(strLimpa);
    return isNaN(num) ? 0 : num;
}

function isGruaSerrana(gruaString, cacheProprias) {
    let g = String(gruaString || '').trim().toUpperCase().replace(/[-\s]/g, '');
    if (!g || g === 'NULL') return false;
    if (cacheProprias.has(g)) return true;
    if (g.startsWith('GSR')) return true;
    return false;
}

function converterDataExcel(dataStr) {
    if (!dataStr) return new Date(NaN);
    const str = String(dataStr).trim();
    if(str.includes('T')) return new Date(str);
    if(str.includes('/')) {
        const p = str.split('/');
        if (p.length === 3) return new Date(p[2], parseInt(p[1]) - 1, p[0]);
    }
    if(str.includes('-')) {
        const p = str.split('-');
        if(p.length >= 3) return new Date(p[0], parseInt(p[1]) - 1, p[2].substring(0,2));
    }
    return new Date(str);
}

const formatarDataChave = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Retorna Data Inicio de Acordo com o Corte da Filial (Transporte)
function getStartDateTransp(ano, mesNum, diaFechamento) {
    if (diaFechamento >= 28) return new Date(ano, mesNum - 1, 1);
    return new Date(ano, mesNum - 2, diaFechamento + 1);
}

// Retorna Data Fim de Acordo com o Corte da Filial (Transporte)
function getEndDateTransp(ano, mesNum, diaFechamento) {
    if (diaFechamento >= 28) return new Date(ano, mesNum, 0, 23, 59, 59);
    return new Date(ano, mesNum - 1, diaFechamento, 23, 59, 59);
}

// Retorna Data Inicio de Acordo com o Mês (Carregamento sempre do dia 1 ao fim do mes)
function getStartDateCarreg(ano, mesNum) {
    return new Date(ano, mesNum - 1, 1);
}

function getEndDateCarreg(ano, mesNum) {
    return new Date(ano, mesNum, 0, 23, 59, 59);
}

// ==========================================
// CÁLCULO INTELIGENTE DE TARIFA (RAIO + MATRIZ)
// ==========================================
function calcularTarifaExata(tarifador, asfalto, terra) {
    if (!tarifador || !tarifador.dados || !Array.isArray(tarifador.dados)) return 0;
    let asf = parseFloat(String(asfalto).replace(',','.')) || 0;
    let ter = parseFloat(String(terra).replace(',','.')) || 0;
    const dadosMatriz = tarifador.dados;
    
    if (dadosMatriz.length === 0) return 0;

    if (dadosMatriz[0].is_raio || dadosMatriz[0].raio_inicial !== undefined) {
        let distanciaTotal = asf + ter;
        let distArredondada = Math.round(distanciaTotal * 100) / 100;
        
        let faixa = dadosMatriz.find(t => distArredondada >= t.raio_inicial && distArredondada <= t.raio_final);
        
        if (!faixa) {
            let ordenados = [...dadosMatriz].sort((a,b) => a.raio_final - b.raio_final);
            faixa = ordenados.find(t => t.raio_final >= distArredondada);
            if(!faixa) faixa = ordenados[ordenados.length - 1];
        }
        return faixa ? parseFloat(faixa.tarifa) : 0;
    }

    const exato = dadosMatriz.find(t => Math.abs(t.asfalto - asf) < 0.001 && Math.abs(t.terra - ter) < 0.001);
    if (exato) return parseFloat(exato.tarifa) || 0;
    let maisProximo = null;
    let menorDistancia = Infinity;
    dadosMatriz.forEach(t => {
        const dist = Math.sqrt(Math.pow(t.asfalto - asf, 2) + Math.pow(t.terra - ter, 2));
        if (dist < menorDistancia) { menorDistancia = dist; maisProximo = t; }
    });
    return maisProximo ? (parseFloat(maisProximo.tarifa) || 0) : 0;
}

function getTarifaRapida(tarifador, asfalto, terra) {
    if (!tarifador || !tarifador.dados) return 0;
    const key = `${tarifador.id}_${asfalto}_${terra}`;
    if (tarifaCache.has(key)) return tarifaCache.get(key);
     
    const tarifa = calcularTarifaExata(tarifador, asfalto, terra);
    tarifaCache.set(key, tarifa);
    return tarifa;
}

// Carregar Filtros Iniciais
window.initVisaoExecutiva = async function() {
    const inputMes = document.getElementById('execFiltroMes');
    if (inputMes) {
        const hoje = new Date();
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        inputMes.value = `${hoje.getFullYear()}-${mes}`;
    }
    
    await carregarFiliaisExecutiva();
    window.atualizarDadosExecutivos();
}

async function carregarFiliaisExecutiva() {
    const currentUser = window.currentUser || {};
    const isGlobalAdmin = (currentUser.role === 'SuperAdmin' || currentUser.filial_id == 4 || currentUser.filial_id === null);
    
    let q = window.supabaseClient.from('filiais').select('id, nome').neq('id', 4).order('nome');
    if (!isGlobalAdmin && currentUser.filial_id) q = q.eq('id', currentUser.filial_id);
    
    const { data } = await q;
    const select = document.getElementById('execFiltroFilial');
    if (select && data) {
        select.innerHTML = isGlobalAdmin ? '<option value="T">Todas as Filiais</option>' : '';
        data.forEach(f => {
            select.innerHTML += `<option value="${f.id}">${f.nome}</option>`;
        });
    }
}

function aplicarBadgeMeta(id, percent) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerText = percent.toFixed(1) + '%';
    el.className = 'px-2 py-1 text-[11px] font-bold rounded shadow-sm border ';
    if (percent >= 100) el.classList.add('bg-emerald-500/20', 'text-emerald-400', 'border-emerald-500/50');
    else if (percent >= 80) el.classList.add('bg-yellow-500/20', 'text-yellow-400', 'border-yellow-500/50');
    else el.classList.add('bg-red-500/20', 'text-red-400', 'border-red-500/50');
}

window.atualizarDadosExecutivos = async function() {
    const inputMes = document.getElementById('execFiltroMes');
    const mesFiltro = inputMes ? inputMes.value : '';
    
    const selectFilial = document.getElementById('execFiltroFilial');
    const filialSelecionada = selectFilial ? selectFilial.value : 'T';
     
    const containerCards = document.getElementById('containerCardsFiliais');
    const btnRefresh = document.getElementById('btnAtualizarExec');
    const currentUser = window.currentUser || {};
    const isGlobalAdmin = (currentUser.role === 'SuperAdmin' || currentUser.filial_id == 4 || currentUser.filial_id === null);
    const userFilialId = currentUser.filial_id;

    if (document.getElementById('tituloVisao')) {
        document.getElementById('tituloVisao').innerText = (isGlobalAdmin && filialSelecionada === 'T') ? 'Visão Executiva Global' : 'Visão Executiva Local';
    }
    if (document.getElementById('iconVisao')) {
        document.getElementById('iconVisao').className = (isGlobalAdmin && filialSelecionada === 'T') ? 'fas fa-globe-americas text-3xl' : 'fas fa-map-marked-alt text-3xl';
    }
    if (document.getElementById('tituloGraficoEvolucao')) {
        document.getElementById('tituloGraficoEvolucao').innerHTML = (isGlobalAdmin && filialSelecionada === 'T')
            ? '<i class="fas fa-chart-area text-purple-400"></i> Evolução Faturamento Global (Últimos 6 Meses)'
            : '<i class="fas fa-chart-area text-purple-400"></i> Evolução Faturamento da Filial (Últimos 6 Meses)';
    }
         
    if (btnRefresh) {
        btnRefresh.disabled = true;
        btnRefresh.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
    }
    if (containerCards) {
        containerCards.innerHTML = `
            <div class="col-span-full text-center text-slate-400 py-10 flex flex-col items-center justify-center">
                <i class="fas fa-circle-notch fa-spin fa-3x mb-4 text-purple-500"></i>
                <p class="font-bold tracking-wide text-lg" id="execLoadingText">Acessando base de dados...</p>
            </div>`;
    }

    try {
        const loadingText = document.getElementById('execLoadingText');
        
        let qFiliais = window.supabaseClient.from('filiais').select('id, nome, cidade').neq('id', 4).order('nome', { ascending: true });
        if (filialSelecionada && filialSelecionada !== 'T') qFiliais = qFiliais.eq('id', filialSelecionada);
        else if (!isGlobalAdmin && userFilialId) qFiliais = qFiliais.eq('id', userFilialId);

        let qFrota = window.supabaseClient.from('frotas_manutencao').select('cavalo, filial_id').eq('status', 'Ativo');
        if (filialSelecionada && filialSelecionada !== 'T') qFrota = qFrota.eq('filial_id', filialSelecionada);
        else if (!isGlobalAdmin && userFilialId) qFrota = qFrota.eq('filial_id', userFilialId);

        let qOS = window.supabaseClient.from('ordens_servico').select('placa, filial_id, status, tipo').in('status', ['Aguardando Oficina', 'Em Manutenção', 'Sinistrado']);
        if (filialSelecionada && filialSelecionada !== 'T') qOS = qOS.eq('filial_id', filialSelecionada);
        else if (!isGlobalAdmin && userFilialId) qOS = qOS.eq('filial_id', userFilialId);

        let qMetas = window.supabaseClient.from('metas_gerenciais').select('*');
        if (filialSelecionada && filialSelecionada !== 'T') qMetas = qMetas.eq('filial_id', filialSelecionada);
        else if (!isGlobalAdmin && userFilialId) qMetas = qMetas.eq('filial_id', userFilialId);

        if(loadingText) loadingText.innerText = "Sincronizando Metadados...";
        const [
            { data: filiaisDB },
            { data: gruasData },
            { data: tarifadoresAtivos },
            { data: frotaDB },
            { data: osDB },
            { data: metasDB }
        ] = await Promise.all([
            qFiliais,
            window.supabaseClient.from('config_gruas').select('codigos, tipo_frente'),
            window.supabaseClient.from('tarifadores').select('*').eq('ativo', true),
            qFrota,
            qOS,
            qMetas
        ]);

        if (!filiaisDB || filiaisDB.length === 0) throw new Error("Nenhuma filial encontrada para os filtros aplicados.");

        let metaGlobalTranspDiaria = 0;
        let metaGlobalCarregDiaria = 0;
        let metasPorFilial = {};

        // Recuperar configuracoes e dias de corte das filiais
        filiaisDB.forEach(f => {
            let mTransp = 0;
            let mCarreg = 0;
            let dFechamento = 25; // Padrão SERRANA

            if (metasDB) {
                let found = metasDB.find(x => String(x.filial_id) === String(f.id));
                if (found) {
                    mTransp = parseFloat(found.meta_diaria_transporte || 0);
                    mCarreg = parseFloat(found.meta_diaria_carregamento || 0);
                    dFechamento = parseInt(found.dia_fechamento || 25);
                }
            }

            metaGlobalTranspDiaria += mTransp;
            metaGlobalCarregDiaria += mCarreg;
            metasPorFilial[f.id] = { 
                transp: mTransp, 
                carreg: mCarreg, 
                total: mTransp + mCarreg,
                dia_corte: dFechamento
            };
        });

        // FIX: Tratamento robusto para considerar acentos e espaços nas configurações de gruas (corrige o problema de Linhares não exibir carregamento)
        let gruasPropriasCache = new Set();
        if (gruasData) {
            gruasData.forEach(g => {
                const tipo = String(g.tipo_frente || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                if (tipo.includes('PROPRIA') && g.codigos) {
                    g.codigos.split(',').forEach(c => {
                        const cod = c.trim().toUpperCase().replace(/[-\s]/g, '');
                        if (cod && cod !== 'OUTRAS' && cod !== 'OUTROS' && cod !== '0') {
                            gruasPropriasCache.add(cod);
                        }
                    });
                }
            });
        }

        let anoAtual = parseInt(mesFiltro.split('-')[0]);
        let mesAtual = parseInt(mesFiltro.split('-')[1]);
                 
        const nomeMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        let arrayMeses = [];
        for (let i = 5; i >= 0; i--) {
            let d = new Date(anoAtual, mesAtual - 1 - i, 1);
            let key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            let label = `${nomeMeses[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
            arrayMeses.push({ key: key, label: label, totalFat: 0 });
        }

        // Ampliamos a margem de busca temporal por 'created_at' (8 meses)
        let dataInicioHist = new Date(anoAtual, mesAtual - 8, 1);
        let strInicioHist = `${dataInicioHist.getFullYear()}-${String(dataInicioHist.getMonth() + 1).padStart(2, '0')}-01T00:00:00`;
        let dataFimHist = new Date(anoAtual, mesAtual + 1, 0); 
        let strFimHist = `${dataFimHist.getFullYear()}-${String(dataFimHist.getMonth() + 1).padStart(2, '0')}-${String(dataFimHist.getDate()).padStart(2, '0')}T23:59:59`;

        if(loadingText) loadingText.innerText = "Baixando Viagens dos Últimos 6 Meses...";
        let from = 0;
        let step = 1000;
        let fetchMore = true;
        let todasViagens = [];
        
        while (fetchMore) {
            let query = window.supabaseClient.from('historico_viagens').select('*')
                .gte('created_at', strInicioHist)
                .lte('created_at', strFimHist)
                .order('created_at', { ascending: false })
                .range(from, from + step - 1);
                             
            if (filialSelecionada && filialSelecionada !== 'T') {
                query = query.eq('filial_id', filialSelecionada);
            } else if (!isGlobalAdmin && userFilialId) {
                query = query.eq('filial_id', userFilialId);
            }

            const { data, error } = await query;
            if (error) throw error;
            if (data && data.length > 0) {
                todasViagens = todasViagens.concat(data);
                from += step;
                if(loadingText) loadingText.innerText = `Baixando... (${todasViagens.length} registros)`;
            }
            if (!data || data.length < step) { fetchMore = false; }
        }

        // Configuração de datas do Período Atual para metas
        let timeInicioTransp = new Date(anoAtual, mesAtual - 2, 26).getTime();
        let timeFimTransp = new Date(anoAtual, mesAtual - 1, 25, 23, 59, 59).getTime();
        let timeInicioCarreg = new Date(anoAtual, mesAtual - 1, 1).getTime();
        let timeFimCarreg = new Date(anoAtual, mesAtual, 0, 23, 59, 59).getTime();

        let diasNoPeriodoTransp = Math.max(1, Math.ceil(Math.abs(timeFimTransp - timeInicioTransp) / (1000 * 60 * 60 * 24)));
        let diasNoPeriodoCarreg = Math.max(1, Math.ceil(Math.abs(timeFimCarreg - timeInicioCarreg) / (1000 * 60 * 60 * 24)));

        let dmGlobalMediaMes = 0;
        let dmsFiliaisAtivas = [];

        if (mesFiltro) {
            const ultimoDia = new Date(anoAtual, mesAtual, 0).getDate(); 
            const dataInicioDM = `${mesFiltro}-01`;
            const dataFimDM = `${mesFiltro}-${String(ultimoDia).padStart(2,'0')}`;
                         
            let qDM = window.supabaseClient.from('dm_operacional').select('carros_rodaram, total_frota, filial_id').gte('data_registro', dataInicioDM).lte('data_registro', dataFimDM);
            if (filialSelecionada && filialSelecionada !== 'T') qDM = qDM.eq('filial_id', filialSelecionada);
            else if (!isGlobalAdmin && userFilialId) qDM = qDM.eq('filial_id', userFilialId);
            
            const { data: dmDB } = await qDM;
            if (dmDB && dmDB.length > 0) {
                filiaisDB.forEach(f => {
                    const dmFilial = dmDB.filter(d => String(d.filial_id) === String(f.id));
                    let tPerc = 0, vDays = 0;
                    dmFilial.forEach(reg => {
                        let rodou = Number(reg.carros_rodaram) || 0;
                        let total = Number(reg.total_frota) || 0;
                        if (total > 0) { tPerc += (rodou / total) * 100; vDays++; }
                    });
                    if (vDays > 0) dmsFiliaisAtivas.push({ filial_id: f.id, dm: tPerc / vDays });
                });
            }
        }

        let filiaisDataMap = {};          
        let agrupamento7Dias = {};
        
        const hojeObj = new Date();
        const dias7 = [];
        for (let i = 7; i >= 1; i--) {
            const d = new Date(hojeObj.getFullYear(), hojeObj.getMonth(), hojeObj.getDate() - i);
            let k = formatarDataChave(d);
            dias7.push(k);
            agrupamento7Dias[k] = { recTransp: 0, recCarreg: 0, filiais: {} };
            filiaisDB.forEach(f => { agrupamento7Dias[k].filiais[f.id] = { total: 0 }; });
        }

        const dataOntem = new Date();
        dataOntem.setDate(dataOntem.getDate() - 1);
        const keyD1 = formatarDataChave(dataOntem);

        let kpiTranspPeriodo = 0, kpiCarregPeriodo = 0;
        let kpiTranspHoje = 0, kpiCarregHoje = 0;
        let kpiVolTransp = 0, kpiVolCarreg = 0;
        let kpiViagensTransp = 0, kpiViagensCarreg = 0;

        let totalDiasPeriodoTranspGlobal = 0;
        let totalDiasPeriodoCarregGlobal = 0;

        function getTarifador(filialId) {
            if (!tarifadoresAtivos || tarifadoresAtivos.length === 0) return null;
            let t = tarifadoresAtivos.find(x => String(x.filial_id) === String(filialId));
            if (t) return t;
            t = tarifadoresAtivos.find(x => !x.filial_id);
            if (t) return t;
            return tarifadoresAtivos[0]; 
        }

        tarifaCache.clear(); 

        for (let i = 0; i < todasViagens.length; i++) {
            let v = todasViagens[i];
            if (v.filial_id === 4) continue;
                         
            if (i % 5000 === 0 && i > 0) await new Promise(resolve => setTimeout(resolve, 5));
            
            let dataViagemStr = v.dtFimDescarFabrica || v.dataDaBaseExcel || (v.created_at ? v.created_at.split('T')[0] : null);
            if (!dataViagemStr) continue;
                         
            let dateObj = converterDataExcel(dataViagemStr);
            if (isNaN(dateObj.getTime())) continue;
            
            let keyViagemNormal = formatarDataChave(dateObj);
            let trTime = dateObj.getTime();

            // Puxar data de corte específica da Filial (metas_gerenciais)
            let cfgFilial = metasPorFilial[v.filial_id] || { dia_corte: 25 };
            let dCorte = cfgFilial.dia_corte;

            // Datas do ciclo desta viagem/filial para o mês do filtro
            let startTransp = getStartDateTransp(anoAtual, mesAtual, dCorte);
            let endTransp = getEndDateTransp(anoAtual, mesAtual, dCorte);
            let startCarreg = getStartDateCarreg(anoAtual, mesAtual);
            let endCarreg = getEndDateCarreg(anoAtual, mesAtual);

            let isMesFiltroTransp = (trTime >= startTransp.getTime() && trTime <= endTransp.getTime());
            let isMesFiltroCarreg = (trTime >= startCarreg.getTime() && trTime <= endCarreg.getTime());
                          
            let tr = getCampo(v, ['transportadora', 'transportador', 'empresa_transporte']).trim().toUpperCase();
            let isSerrana = tr.includes('SERRANALOG') || tr.includes('SERRANA LOG') || tr.includes('SERRANA');
                         
            let gruaRaw = getCampo(v, ['grua', 'equipamento', 'maquina', 'cod_grua', 'codigo_grua']);
            let isNossaGrua = isGruaSerrana(gruaRaw, gruasPropriasCache);
                         
            let vol = toNumber(getCampo(v, ['volumeReal', 'pesoLiquido']));
            let asfalto = toNumber(getCampo(v, ['distanciaAsfalto']));
            let terra = toNumber(getCampo(v, ['distanciaTerra']));
                         
            let tarifador = getTarifador(v.filial_id);
            let precoCarregamento = tarifador ? parseFloat(tarifador.preco_carregamento) || 0 : 0;
                         
            let recTransp = 0;
            if (isSerrana) {
                let tarifa = getTarifaRapida(tarifador, asfalto, terra);
                recTransp = vol * tarifa;
                if (recTransp === 0) {
                    let tarifaAlternativa = toNumber(getCampo(v, ['tarifa', 'valorTarifa', 'valortarifa', 'preco', 'valor_tarifa', 'tarifaAplicada']));
                    let receitaAlternativa = toNumber(getCampo(v, ['valorFaturado', 'valorfaturado', 'faturamento', 'receita', 'valorTotal', 'valortotal', 'valor_faturado']));
                    if (receitaAlternativa > 0) recTransp = receitaAlternativa;
                    else if (tarifaAlternativa > 0 && vol > 0) recTransp = tarifaAlternativa * vol;
                }
                
                // Mapeia mes historico (6 meses do grafico) de forma simplificada
                let mesLabelHis = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
                let mesChartT = arrayMeses.find(m => m.key === mesLabelHis);
                if (mesChartT) mesChartT.totalFat += recTransp;

                // Consolidação no card DRE (Respeitando a Data de Corte)
                if (isMesFiltroTransp) {
                    if (!filiaisDataMap[v.filial_id]) filiaisDataMap[v.filial_id] = { producao: 0, faturamento: 0, recTransp: 0, recCarreg: 0, volTransp: 0, volCarreg: 0, vTransp: 0, vCarreg: 0 };
                    filiaisDataMap[v.filial_id].producao += vol;
                    filiaisDataMap[v.filial_id].faturamento += recTransp;
                    filiaisDataMap[v.filial_id].recTransp += recTransp;
                    filiaisDataMap[v.filial_id].volTransp += vol;
                    filiaisDataMap[v.filial_id].vTransp += 1;
                    kpiTranspPeriodo += recTransp;
                    kpiVolTransp += vol;
                    kpiViagensTransp += 1;
                }

                if (keyViagemNormal === keyD1) kpiTranspHoje += recTransp;
                if (agrupamento7Dias[keyViagemNormal]) {
                    agrupamento7Dias[keyViagemNormal].recTransp += recTransp;
                    if (agrupamento7Dias[keyViagemNormal].filiais[v.filial_id]) agrupamento7Dias[keyViagemNormal].filiais[v.filial_id].total += recTransp;
                }
            }
                         
            let recCarreg = isNossaGrua ? (vol * precoCarregamento) : 0;
            if (isNossaGrua) {
                let mesLabelHisC = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
                let mesChartC = arrayMeses.find(m => m.key === mesLabelHisC);
                if (mesChartC) mesChartC.totalFat += recCarreg;

                // Consolidação no card DRE
                if (isMesFiltroCarreg) {
                    if (!filiaisDataMap[v.filial_id]) filiaisDataMap[v.filial_id] = { producao: 0, faturamento: 0, recTransp: 0, recCarreg: 0, volTransp: 0, volCarreg: 0, vTransp: 0, vCarreg: 0 };
                    filiaisDataMap[v.filial_id].faturamento += recCarreg;
                    filiaisDataMap[v.filial_id].recCarreg += recCarreg;
                    filiaisDataMap[v.filial_id].volCarreg += vol;
                    filiaisDataMap[v.filial_id].vCarreg += 1;
                    kpiCarregPeriodo += recCarreg;
                    kpiVolCarreg += vol;
                    kpiViagensCarreg += 1;
                }

                if (keyViagemNormal === keyD1) kpiCarregHoje += recCarreg;
                if (agrupamento7Dias[keyViagemNormal]) {
                    agrupamento7Dias[keyViagemNormal].recCarreg += recCarreg;
                    if (agrupamento7Dias[keyViagemNormal].filiais[v.filial_id]) agrupamento7Dias[keyViagemNormal].filiais[v.filial_id].total += recCarreg;
                }
            }
        }

        let filiaisData = [];
        let totalFatGlobal = 0;
        let totalProdGlobal = 0;
        let countDm = 0;

        for (let filial of filiaisDB) {
            let metricas = filiaisDataMap[filial.id] || { producao: 0, faturamento: 0, recTransp: 0, recCarreg: 0, volTransp: 0, volCarreg: 0, vTransp: 0, vCarreg: 0 };
            
            // Calculo da Meta Diária Global para exibir no Front
            let cfgF = metasPorFilial[filial.id] || { dia_corte: 25 };
            let tStartT = getStartDateTransp(anoAtual, mesAtual, cfgF.dia_corte).getTime();
            let tEndT = getEndDateTransp(anoAtual, mesAtual, cfgF.dia_corte).getTime();
            let dTs = Math.max(1, Math.ceil(Math.abs(tEndT - tStartT) / (1000 * 60 * 60 * 24)));
            
            let tStartC = getStartDateCarreg(anoAtual, mesAtual).getTime();
            let tEndC = getEndDateCarreg(anoAtual, mesAtual).getTime();
            let dCs = Math.max(1, Math.ceil(Math.abs(tEndC - tStartC) / (1000 * 60 * 60 * 24)));
            
            if (metricas.faturamento > 0 || metricas.producao > 0) {
                totalDiasPeriodoTranspGlobal = dTs; // Usa do ultimo como média, ou podemos fazer media
                totalDiasPeriodoCarregGlobal = dCs;
            }

            let dmReal = 0;
            let findDm = dmsFiliaisAtivas.find(d => String(d.filial_id) === String(filial.id));
            if (findDm) {
                dmReal = findDm.dm;
            } else if (frotaDB && frotaDB.length > 0) {
                const frotaFilial = frotaDB.filter(f => String(f.filial_id) === String(filial.id));
                if (frotaFilial.length > 0) {
                    const listaCavalos = frotaFilial.map(f => f.cavalo.trim().toUpperCase());
                    const totalFrota = listaCavalos.length;
                    let cavalosParados = 0;
                    if (osDB && osDB.length > 0) {
                        const placasParadas = new Set();
                        osDB.forEach(os => {
                            const placaOS = os.placa ? os.placa.trim().toUpperCase() : '';
                            if (listaCavalos.includes(placaOS) && os.tipo !== 'Cavalo Disponível S/ Carreta') placasParadas.add(placaOS);
                        });
                        cavalosParados = placasParadas.size;
                    }
                    dmReal = ((totalFrota - cavalosParados) / totalFrota) * 100;
                }
            }
            
            // Só conta para média de DM se tiver faturamento ou produção
            if (metricas.faturamento > 0 || metricas.producao > 0) {
                dmGlobalMediaMes += dmReal;
                countDm++;
            }

            totalFatGlobal += metricas.faturamento;
            totalProdGlobal += metricas.producao;
            filiaisData.push({
                id: filial.id,
                nome: filial.nome,
                cidade: filial.cidade || filial.nome,
                dia_corte: cfgF.dia_corte,
                faturamento: metricas.faturamento,
                producao: metricas.producao,
                recTransp: metricas.recTransp,
                recCarreg: metricas.recCarreg,
                volTransp: metricas.volTransp,
                volCarreg: metricas.volCarreg,
                vTransp: metricas.vTransp,
                vCarreg: metricas.vCarreg,
                dm: Number(dmReal.toFixed(1)),
                status: dmReal >= 85 ? 'Operacional' : 'Atenção'
            });
        }

        filiaisData.sort((a,b) => b.faturamento - a.faturamento);
        const activeBranches = filiaisData.filter(f => f.faturamento > 0 || f.producao > 0).length;
        let mediaDMGlobal = countDm > 0 ? Number((dmGlobalMediaMes / countDm).toFixed(1)) : 0;

        // Atualizar KPIs Tops Globais
        const formatMoney = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        if (document.getElementById('kpiFatGlobal')) document.getElementById('kpiFatGlobal').innerText = formatMoney(totalFatGlobal);
        if (document.getElementById('kpiProdGlobal')) document.getElementById('kpiProdGlobal').innerText = totalProdGlobal.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' m³';
        if (document.getElementById('kpiDmGlobal')) document.getElementById('kpiDmGlobal').innerText = mediaDMGlobal + '%'; 
        if (document.getElementById('kpiFiliaisAtivas')) document.getElementById('kpiFiliaisAtivas').innerText = activeBranches.toString();

        const metaPeriodoTransporte = metaGlobalTranspDiaria * Math.max(1, totalDiasPeriodoTranspGlobal);
        const metaPeriodoCarregamento = metaGlobalCarregDiaria * Math.max(1, totalDiasPeriodoCarregGlobal);
        
        document.getElementById('valTranspReceita').innerText = formatMoney(kpiTranspPeriodo);
        document.getElementById('valCarregReceita').innerText = formatMoney(kpiCarregPeriodo);
        document.getElementById('kpi-transporte-hoje').innerText = formatMoney(kpiTranspHoje);
        document.getElementById('kpi-carregamento-hoje').innerText = formatMoney(kpiCarregHoje);
        document.getElementById('desc-transporte-periodo').innerText = `Meta Período: ${formatMoney(metaPeriodoTransporte)}`;
        document.getElementById('desc-carregamento-periodo').innerText = `Meta Período: ${formatMoney(metaPeriodoCarregamento)}`;
        document.getElementById('desc-transporte-hoje').innerText = `Meta Diária: ${formatMoney(metaGlobalTranspDiaria)}`;
        document.getElementById('desc-carregamento-hoje').innerText = `Meta Diária: ${formatMoney(metaGlobalCarregDiaria)}`;

        document.getElementById('valTranspVolume').innerText = kpiVolTransp.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' m³';
        document.getElementById('valCarregVolume').innerText = kpiVolCarreg.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' m³';
        document.getElementById('valTranspViagens').innerText = kpiViagensTransp.toLocaleString('pt-BR');
        document.getElementById('valCarregViagens').innerText = kpiViagensCarreg.toLocaleString('pt-BR');

        aplicarBadgeMeta('badge-transporte-periodo', metaPeriodoTransporte > 0 ? (kpiTranspPeriodo / metaPeriodoTransporte)*100 : 0);
        aplicarBadgeMeta('badge-carregamento-periodo', metaPeriodoCarregamento > 0 ? (kpiCarregPeriodo / metaPeriodoCarregamento)*100 : 0);
        aplicarBadgeMeta('badge-transporte-hoje', metaGlobalTranspDiaria > 0 ? (kpiTranspHoje / metaGlobalTranspDiaria)*100 : 0);
        aplicarBadgeMeta('badge-carregamento-hoje', metaGlobalCarregDiaria > 0 ? (kpiCarregHoje / metaGlobalCarregDiaria)*100 : 0);

        // Cards DRE Expandidos
        let cardsHtml = '';
        filiaisData.forEach(filial => {
            if (filial.faturamento === 0 && filial.producao === 0 && filialSelecionada === 'T') return; // Esconde filiais sem dados
            
            let statusBadge = filial.status === 'Operacional' 
                 ? '<span class="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-1 rounded-full border border-emerald-500/20"><i class="fas fa-check"></i> NORMAL</span>' 
                 : '<span class="bg-amber-500/10 text-amber-400 text-[10px] font-bold px-2 py-1 rounded-full border border-amber-500/20"><i class="fas fa-exclamation-triangle"></i> ATENÇÃO DM</span>';
                         
            // Textos de Corte
            let sTranspD = getStartDateTransp(anoAtual, mesAtual, filial.dia_corte);
            let eTranspD = getEndDateTransp(anoAtual, mesAtual, filial.dia_corte);
            let sStr = `${String(sTranspD.getDate()).padStart(2,'0')}/${String(sTranspD.getMonth()+1).padStart(2,'0')}`;
            let eStr = `${String(eTranspD.getDate()).padStart(2,'0')}/${String(eTranspD.getMonth()+1).padStart(2,'0')}`;

            // Comparativo de DM da filial vs Media
            let difDm = (filial.dm - mediaDMGlobal).toFixed(1);
            let dmCompareHtml = difDm >= 0 
                ? `<span class="text-emerald-400 text-[10px] ml-2"><i class="fas fa-arrow-up"></i> +${difDm}% da Méd</span>` 
                : `<span class="text-rose-400 text-[10px] ml-2"><i class="fas fa-arrow-down"></i> ${difDm}% da Méd</span>`;

            cardsHtml += `
                <div class="bg-slate-800/80 rounded-2xl p-5 border border-slate-700 hover:border-emerald-500/50 transition-all shadow-lg relative overflow-hidden group">
                    <div class="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-colors"></div>
                                         
                    <div class="flex justify-between items-start mb-4 border-b border-slate-700/50 pb-3">
                        <div>
                            <h4 class="font-black text-[15px] text-white uppercase tracking-wider truncate" title="${filial.nome}">${filial.nome}</h4>
                            <p class="text-[10px] text-slate-400 font-bold uppercase"><i class="fas fa-map-marker-alt"></i> ${filial.cidade}</p>
                        </div>
                        ${statusBadge}
                    </div>
                                         
                    <div class="space-y-3">
                        <div class="flex justify-between items-end border-b border-slate-700/50 pb-2">
                            <span class="text-slate-400 text-xs font-bold uppercase"><i class="fas fa-sack-dollar text-emerald-400"></i> Faturamento Mensal</span>
                            <span class="font-black text-emerald-400 text-[19px] font-mono">${formatMoney(filial.faturamento)}</span>
                        </div>
                        <div class="grid grid-cols-2 gap-3 border-b border-slate-700/50 pb-3">
                            <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-700">
                                <span class="text-sky-400 text-[10px] font-black tracking-widest uppercase block mb-1">TRANSPORTE</span>
                                <span class="text-white text-base font-mono block font-bold">${formatMoney(filial.recTransp)}</span>
                                <span class="text-slate-400 text-[11px] font-mono block mt-1"><i class="fas fa-cube text-slate-500"></i> ${filial.volTransp.toLocaleString('pt-BR',{maximumFractionDigits:1})} m³</span>
                                <span class="text-slate-400 text-[11px] font-mono block"><i class="fas fa-truck text-slate-500"></i> ${filial.vTransp} viag</span>
                                <div class="mt-2 pt-2 border-t border-slate-700/50">
                                    <span class="text-slate-500 text-[9px] uppercase font-bold block"><i class="fas fa-calendar-check"></i> Corte: ${sStr} a ${eStr}</span>
                                </div>
                            </div>
                            <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-700">
                                <span class="text-emerald-400 text-[10px] font-black tracking-widest uppercase block mb-1">CARREGAM.</span>
                                <span class="text-white text-base font-mono block font-bold">${formatMoney(filial.recCarreg)}</span>
                                <span class="text-slate-400 text-[11px] font-mono block mt-1"><i class="fas fa-cube text-slate-500"></i> ${filial.volCarreg.toLocaleString('pt-BR',{maximumFractionDigits:1})} m³</span>
                                <span class="text-slate-400 text-[11px] font-mono block"><i class="fas fa-tractor text-slate-500"></i> ${filial.vCarreg} viag</span>
                                <div class="mt-2 pt-2 border-t border-slate-700/50">
                                    <span class="text-slate-500 text-[9px] uppercase font-bold block"><i class="fas fa-calendar-check"></i> Mês Calendário</span>
                                </div>
                            </div>
                        </div>
                        <div class="flex justify-between items-center pt-1">
                            <span class="text-slate-400 text-xs font-bold uppercase"><i class="fas fa-tools text-amber-400"></i> DM % Oficina</span>
                            <div class="text-right">
                                <span class="font-black ${filial.dm < 85 ? 'text-amber-400' : 'text-emerald-400'} font-mono text-lg">${filial.dm}%</span>
                                <div class="block">${dmCompareHtml}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        if (containerCards) containerCards.innerHTML = cardsHtml || `<div class="col-span-full text-center text-slate-500 py-10 font-bold">Nenhum dado encontrado no período para as filiais selecionadas.</div>`;

        let mesesParaGrafico = arrayMeses.map(m => m.label);
        let valoresFaturamentoHist = arrayMeses.map(m => parseFloat(m.totalFat.toFixed(2)));
                 
        renderizarGraficoComparativo(filiaisData);
        renderizarGraficoEvolucao(mesesParaGrafico, valoresFaturamentoHist);
        renderizarGrafico7DiasFixo(dias7, agrupamento7Dias, metaGlobalTranspDiaria + metaGlobalCarregDiaria, metasPorFilial, filiaisDB);

    } catch (error) {
        console.error('Erro ao buscar dados executivos no banco:', error);
        if (containerCards) {
            containerCards.innerHTML = `
                <div class="col-span-full text-center text-rose-400 py-10 border border-rose-500/30 rounded-lg bg-rose-500/10 shadow-inner">
                    <i class="fas fa-times-circle fa-3x mb-3"></i>
                    <h3 class="font-black text-lg uppercase tracking-wider">Falha na Sincronização</h3>
                    <p class="text-sm mt-1 font-bold">${error.message}</p>
                </div>`;
        }
    } finally {
        if (btnRefresh) {
            btnRefresh.disabled = false;
            btnRefresh.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar';
        }
    }
}

function renderizarGrafico7DiasFixo(dias7, agrupamento7Dias, metaTotalVal, metasPorFilial, filiaisDB) {
    const dom7Dias = document.getElementById('chart7DiasFixoExecutivo');
    if (!dom7Dias) return;

    if (execChart7Dias) execChart7Dias.dispose();
    execChart7Dias = echarts.init(dom7Dias);

    const labels = dias7.map(k => {
        const p = k.split('-');
        return `${p[2]}/${p[1]}`;
    });

    const dataTotalDiario = dias7.map(k => agrupamento7Dias[k].recTransp + agrupamento7Dias[k].recCarreg);
    const dataMetaCombinada = dias7.map(() => metaTotalVal);

    // Identificar a pior filial no acumulado de 7 dias
    let pioresFiliaisSet = new Set();
    dias7.forEach(k => {
        let piorPerc = 100;
        let idF = null;
        for (const [fId, metricas] of Object.entries(agrupamento7Dias[k].filiais)) {
            let metaFilial = metasPorFilial[fId] ? metasPorFilial[fId].total : 0;
            if (metaFilial > 0) {
                let perc = (metricas.total / metaFilial) * 100;
                if (perc < piorPerc) { piorPerc = perc; idF = fId; }
            }
        }
        if (piorPerc < 100 && idF) pioresFiliaisSet.add(idF);
    });

    const alertBox = document.getElementById('alertaFilialBaixa');
    const alertText = document.getElementById('textoAlertaFilial');
    
    if (pioresFiliaisSet.size > 0 && alertBox) {
        let nomes = [];
        pioresFiliaisSet.forEach(id => {
            let f = filiaisDB.find(x => String(x.id) === String(id));
            if (f) nomes.push(f.cidade || f.nome);
        });
        alertText.innerText = `Atenção: ${nomes.join(', ')} abaixaram o desempenho nos últimos 7 dias.`;
        alertBox.classList.remove('hidden');
    } else if (alertBox) {
        alertBox.classList.add('hidden');
    }

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: 'rgba(51, 65, 85, 0.8)',
            textStyle: { color: '#f8fafc' },
            padding: 12,
            formatter: function(params) {
                let html = `<div style="font-weight:900; color:#94a3b8; font-size: 11px; text-transform:uppercase; letter-spacing:1px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px; margin-bottom: 12px;">  Data: ${params[0].axisValue}</div>`;
                let totalVal = 0;
                params.forEach(p => { if(p.seriesName.includes('Faturamento')) totalVal = p.value; });
                                             
                let valFormatado = totalVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                let metaFormatada = metaTotalVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                                             
                html += `<div style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; gap: 20px; font-size: 13px;">
                            <span style="color: #cbd5e1;"><span style="display:inline-block;margin-right:6px;border-radius:50%;width:8px;height:8px;background-color:#38bdf8;box-shadow:0 0 5px #38bdf8;"></span>Faturamento Total:</span>
                            <b style="color: #fff; font-size: 14px;">${valFormatado}</b>
                         </div>`;
                                                      
                html += `<div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; gap: 20px; font-size: 13px;">
                            <span style="color: #94a3b8;"><span style="display:inline-block;margin-right:6px;width:10px;height:3px;background-color:#fbbf24;"></span>Meta Combinada:</span>
                            <b style="color: #94a3b8;">${metaFormatada}</b>
                         </div>`;
                                             
                let perc = metaTotalVal > 0 ? ((totalVal / metaTotalVal) * 100).toFixed(1) : 0;
                let corPerc = totalVal >= metaTotalVal ? '#10b981' : '#ef4444'; 
                let icone = totalVal >= metaTotalVal ? '  Acima da Meta' : '  Abaixo da Meta';
                let bgAlert = totalVal >= metaTotalVal ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
                                             
                html += `<div style="background: ${bgAlert}; padding: 10px; border-radius: 8px; font-size: 13px; color: ${corPerc}; border: 1px solid ${corPerc}40; text-align: center;">
                    <span style="font-size: 22px; font-weight: 900; display: block; margin-bottom: 2px; text-shadow: 0 0 10px ${corPerc}40;">${perc}%</span>
                    <span style="font-size:11px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">${icone}</span>
                </div>`;
                return html;
            }
        },
        grid: { top: 20, right: '4%', bottom: '5%', left: '5%', containLabel: true },
        xAxis: { type: 'category', boundaryGap: false, data: labels, axisLabel: { color: '#94a3b8', fontSize: 11, margin: 12 }, axisLine: { lineStyle: { color: '#334155' } } },
        yAxis: { type: 'value', axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v) => v >= 1000 ? (v / 1000) + 'k' : v }, splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } } },
        series: [
            {
                name: 'Faturamento Total (Transp + Carreg)', type: 'line', data: dataTotalDiario, smooth: true, symbol: 'circle', symbolSize: 8, showSymbol: true,
                label: { show: true, position: 'top', distance: 10, formatter: (p) => p.value === 0 ? '' : p.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }), color: '#f8fafc', fontSize: 10, fontWeight: 'bold', backgroundColor: 'rgba(15, 23, 42, 0.8)', borderColor: 'rgba(56, 189, 248, 0.4)', borderWidth: 1, borderRadius: 6, padding: [4, 8], shadowColor: 'rgba(0, 0, 0, 0.5)', shadowBlur: 4, shadowOffsetY: 2 },
                itemStyle: { color: '#0ea5e9' },
                lineStyle: { width: 4, color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#38bdf8' }, { offset: 1, color: '#818cf8' }]), shadowColor: 'rgba(56,189,248,0.4)', shadowBlur: 15, shadowOffsetY: 5 },
                areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(56,189,248,0.4)' }, { offset: 0.8, color: 'rgba(129,140,248,0.05)' }, { offset: 1, color: 'rgba(129,140,248,0)' }]) },
                z: 5
            },
            { name: 'Meta Combinada', type: 'line', data: dataMetaCombinada, symbol: 'none', lineStyle: { color: '#fbbf24', width: 2, type: 'dashed' }, z: 10 }
        ]
    };

    execChart7Dias.setOption(option);
    window.addEventListener('resize', () => execChart7Dias.resize());
}

function renderizarGraficoComparativo(dados) {
    const chartDom = document.getElementById('graficoComparativoFiliais');
    if (!chartDom) return;
         
    if (execChartComparativo) execChartComparativo.dispose();
    execChartComparativo = echarts.init(chartDom);
         
    const dadosTop = dados.filter(f => f.faturamento > 0 || f.producao > 0).slice(0, 8);
    const nomesEixoX = dadosTop.map(d => d.cidade);
    const faturamentos = dadosTop.map(d => d.faturamento);
    const producoes = dadosTop.map(d => d.producao);

    const option = {
        backgroundColor: 'transparent',
        tooltip: { 
             trigger: 'axis', 
             axisPointer: { type: 'shadow' },
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: 'rgba(51, 65, 85, 0.8)',
            textStyle: { color: '#f8fafc' },
            formatter: function(params) {
                let html = `<div style="font-weight:bold; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; margin-bottom: 4px;">${params[0].axisValue}</div>`;
                params.forEach(p => {
                    let valFormatado = '';
                    if (p.seriesName.includes('Faturamento')) {
                        valFormatado = p.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    } else if (p.seriesName.includes('Produção')) {
                        valFormatado = p.value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' m³';
                    } else {
                        valFormatado = p.value;
                    }
                    html += `<div style="display: flex; justify-content: space-between; gap: 15px;">
                                <span>${p.marker} ${p.seriesName}:</span>
                                <b>${valFormatado}</b>
                             </div>`;
                });
                return html;
            }
        },
        legend: { data: ['Faturamento (R$)', 'Produção (m³)'], textStyle: { color: '#cbd5e1', fontWeight: 'bold' }, top: 0 },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: [
            { type: 'category', data: nomesEixoX, axisLabel: { color: '#94a3b8', fontWeight: 'bold', fontSize: 10, interval: 0, rotate: 15 } }
        ],
        yAxis: [
            { type: 'value', name: 'R$', nameTextStyle: { color: '#10b981', fontWeight: 'bold' }, axisLabel: { color: '#94a3b8', formatter: (val) => (val/1000) + 'k' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
            { type: 'value', name: 'm³', nameTextStyle: { color: '#38bdf8', fontWeight: 'bold' }, axisLabel: { color: '#94a3b8' }, splitLine: { show: false } }
        ],
        series: [
            {
                name: 'Faturamento (R$)', type: 'bar', data: faturamentos,
                itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#10b981' }, { offset: 1, color: '#047857' }]), borderRadius: [4, 4, 0, 0] }
            },
            {
                name: 'Produção (m³)', type: 'line', yAxisIndex: 1, data: producoes, smooth: true, symbolSize: 8,
                itemStyle: { color: '#38bdf8' }, lineStyle: { width: 3, shadowColor: 'rgba(56, 189, 248, 0.5)', shadowBlur: 10 }
            }
        ]
    };

    execChartComparativo.setOption(option);
    window.addEventListener('resize', () => execChartComparativo.resize());
}

function renderizarGraficoEvolucao(meses, valores) {
    const chartDom = document.getElementById('graficoEvolucaoGlobal');
    if (!chartDom) return;
         
    if (execChartEvolucao) execChartEvolucao.dispose();
    execChartEvolucao = echarts.init(chartDom);

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: 'rgba(51, 65, 85, 0.8)',
            textStyle: { color: '#f8fafc' },
            formatter: function(params) {
                let val = params[0].value.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
                return `<div style="font-weight:bold; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; margin-bottom: 4px;">${params[0].name}</div>
                        <div style="display: flex; justify-content: space-between; gap: 15px;">
                            <span>${params[0].marker} Receita:</span>
                            <b>${val}</b>
                        </div>`;
            }
        },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', boundaryGap: false, data: meses, axisLabel: { color: '#94a3b8', fontWeight: 'bold' } },
        yAxis: {
            type: 'value',
            axisLabel: { color: '#94a3b8', formatter: (val) => (val/1000000).toFixed(2) + 'M' },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
        },
        series: [
            {
                name: 'Faturamento', type: 'line', data: valores, smooth: true, symbol: 'circle', symbolSize: 8,
                itemStyle: { color: '#a855f7' },
                areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(168, 85, 247, 0.4)' }, { offset: 1, color: 'rgba(168, 85, 247, 0.0)' }]) },
                lineStyle: { width: 3, shadowColor: 'rgba(168,85,247, 0.5)', shadowBlur: 10 }
            }
        ]
    };

    execChartEvolucao.setOption(option);
    window.addEventListener('resize', () => execChartEvolucao.resize());
}