// ==========================================
// js/producao-frota.js - LÓGICA DE PRODUÇÃO E VIAGENS POR FROTA E RECEITA
// ==========================================

Chart.register(ChartDataLabels);
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';
Chart.defaults.font.family = "'Inter', sans-serif";

let dadosHistoricoGlobal = [];
let faturamentosGlobais = [];
let dadosAgrupadosAtual = [];
let dadosFiltradosAtual = [];
let agrupamentoDiarioGlobal = {}; 

let chartProducaoObj = null;
let chartViagensObj = null;

document.addEventListener('DOMContentLoaded', () => {
    configurarEventos();
    definirDatasPadrao();
    verificarAberturaModal();
    buscarTodosDadosSupabase();
});

function configurarEventos() {
    document.getElementById('btnAplicarFiltros').addEventListener('click', processarFiltrosEExibir);
    document.getElementById('btnExportarExcel').addEventListener('click', exportarParaExcel);
    
    document.getElementById('btnExportarResumoProd').addEventListener('click', exportarResumoDiarioExcel);
    document.getElementById('btnExportarResumoFin').addEventListener('click', exportarResumoDiarioExcel);
    
    document.getElementById('btnSalvarFat').addEventListener('click', salvarFaturamentoEmLote);
    document.getElementById('btnAdicionarLinhaFat').addEventListener('click', () => {
        adicionarLinhaFaturamento('');
    });
}

function definirDatasPadrao() {
    const dataFim = new Date();
    const dataInicio = new Date();
    dataInicio.setDate(dataFim.getDate() - 7);
    document.getElementById('dataFim').value = dataFim.toISOString().split('T')[0];
    document.getElementById('dataInicio').value = dataInicio.toISOString().split('T')[0];
    
    resetarModalFaturamento();
}

function verificarAberturaModal() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('modal') === 'faturamento') {
        document.getElementById('modalFaturamento').classList.remove('hidden');
    }
}

async function buscarTodosDadosSupabase() {
    document.getElementById('tabelaStatus').innerText = "Baixando histórico...";
    dadosHistoricoGlobal = [];
    faturamentosGlobais = [];
    
    let from = 0;
    const step = 1000;
    let fetchMore = true;
    while (fetchMore) {
        const { data, error } = await supabaseClient
            .from('historico_viagens')
            .select('dataDaBaseExcel, placa, transportadora, volumeReal')
            .range(from, from + step - 1);
        
        if (error) { console.error("Erro:", error); break; }
        if (data && data.length > 0) { dadosHistoricoGlobal = dadosHistoricoGlobal.concat(data); from += step; }
        if (!data || data.length < step) { fetchMore = false; }
    }

    const { data: fatData, error: fatError } = await supabaseClient
        .from('faturamento_diario')
        .select('*');
    if (!fatError && fatData) {
        faturamentosGlobais = fatData;
    }

    popularDropdownTransportadoras(dadosHistoricoGlobal);
    processarFiltrosEExibir();
}

// ----------------------------------------------------
// GERENCIAMENTO DA MODAL DE LANÇAMENTO EM LOTE
// ----------------------------------------------------
function adicionarLinhaFaturamento(dataPadrao = '') {
    const container = document.getElementById('linhasFaturamento');
    const div = document.createElement('div');
    div.className = 'flex items-center gap-3 fat-linha animate-fade-in';
    div.innerHTML = `
        <input type="date" class="fat-data w-1/2 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white font-bold outline-none focus:border-emerald-500 shadow-inner" value="${dataPadrao}">
        <input type="number" step="0.01" placeholder="Ex: 5500.00" class="fat-valor w-1/2 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-emerald-400 font-bold outline-none focus:border-emerald-500 shadow-inner">
        <button onclick="this.parentElement.remove()" class="text-rose-400 hover:text-rose-300 w-10 text-center transition-colors" title="Remover linha"><i class="fas fa-trash"></i></button>
    `;
    container.appendChild(div);
}

function resetarModalFaturamento() {
    const container = document.getElementById('linhasFaturamento');
    container.innerHTML = '';
    const dataFim = new Date().toISOString().split('T')[0];
    adicionarLinhaFaturamento(dataFim);
}

async function salvarFaturamentoEmLote() {
    const linhas = document.querySelectorAll('.fat-linha');
    const payload = [];
    let temErro = false;

    linhas.forEach(linha => {
        const data = linha.querySelector('.fat-data').value;
        const valor = parseFloat(linha.querySelector('.fat-valor').value);
        
        if (data && !isNaN(valor)) {
            payload.push({ data_faturamento: data, valor: valor });
        } else if (data || !isNaN(valor)) {
            temErro = true;
        }
    });

    const msg = document.getElementById('fatMsgStatus');
    msg.classList.remove('hidden');

    if (payload.length === 0) {
        mostrarMensagem(msg, "Nenhum dado válido preenchido para salvar.", "text-rose-400");
        return;
    }
    if (temErro) {
        mostrarMensagem(msg, "Preencha a data e o valor em todas as linhas utilizadas.", "text-amber-400");
        return;
    }

    const btn = document.getElementById('btnSalvarFat');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando Lote...';
    btn.disabled = true;

    const { error } = await supabaseClient
        .from('faturamento_diario')
        .upsert(payload, { onConflict: 'data_faturamento' });

    if (error) {
        console.error(error);
        mostrarMensagem(msg, "Erro ao salvar faturamentos.", "text-rose-400");
    } else {
        mostrarMensagem(msg, `${payload.length} lançamento(s) salvo(s) com sucesso!`, "text-emerald-400");
        setTimeout(() => { 
            document.getElementById('modalFaturamento').classList.add('hidden'); 
            msg.classList.add('hidden');
            resetarModalFaturamento();
        }, 1500);
        buscarTodosDadosSupabase();
    }
    
    btn.innerHTML = textoOriginal;
    btn.disabled = false;
}

function mostrarMensagem(el, texto, color) {
    el.innerText = texto;
    el.className = `text-center text-xs font-bold mt-2 block ${color}`;
}

// ----------------------------------------------------
// LÓGICA DE FILTRAGEM E EXIBIÇÃO (SÓ SERRANA)
// ----------------------------------------------------
function popularDropdownTransportadoras(dados) {
    const select = document.getElementById('filtroTransportadora');
    const transpSet = new Set();
    
    // Força popular apenas com a empresa Serrana
    dados.forEach(d => { 
        if (d.transportadora && d.transportadora.toUpperCase().includes('SERRANA')) {
            transpSet.add(d.transportadora.trim().toUpperCase()); 
        }
    });
    
    if (transpSet.size === 0) {
        select.innerHTML = '<option value="">Sem dados da Serrana</option>';
    } else {
        const ops = Array.from(transpSet).sort().map(t => `<option value="${t}">${t}</option>`).join('');
        select.innerHTML = ops;
    }
}

function converterDataString(dataStr) { 
    if (!dataStr) return new Date(0);
    const p = dataStr.split('/');
    if (p.length !== 3) return new Date(0);
    return new Date(p[2], parseInt(p[1]) - 1, p[0]);
}

function processarFiltrosEExibir() {
    document.getElementById('tabelaStatus').innerText = "Processando dados...";
    
    const filtroTransp = document.getElementById('filtroTransportadora').value;
    const strInicio = document.getElementById('dataInicio').value; 
    const strFim = document.getElementById('dataFim').value; 

    let timeInicio = strInicio ? new Date(strInicio.split('-')[0], parseInt(strInicio.split('-')[1]) - 1, strInicio.split('-')[2]).getTime() : 0;
    let timeFim = strFim ? new Date(strFim.split('-')[0], parseInt(strFim.split('-')[1]) - 1, strFim.split('-')[2]).getTime() : Infinity;

    // 1. Mapa de Receitas
    let receitaTotalGeral = 0;
    const fatDiarioMap = {}; 
    faturamentosGlobais.forEach(f => {
        const [y, m, d] = f.data_faturamento.split('-');
        const timeFat = new Date(y, m - 1, d).getTime();
        if (timeFat >= timeInicio && timeFat <= timeFim) {
            const dataDDMMYYYY = `${d}/${m}/${y}`;
            fatDiarioMap[dataDDMMYYYY] = parseFloat(f.valor);
            receitaTotalGeral += parseFloat(f.valor);
        }
    });

    // 2. Filtrar Histórico (FORÇA A SER APENAS SERRANA)
    dadosFiltradosAtual = dadosHistoricoGlobal.filter(registro => {
        const tr = registro.transportadora ? registro.transportadora.trim().toUpperCase() : '';
        
        // Bloqueia qualquer coisa que não seja Serrana
        if (!tr.includes('SERRANA')) return false;
        
        if (filtroTransp && tr !== filtroTransp) return false;

        if (registro.dataDaBaseExcel) {
            const trTime = converterDataString(registro.dataDaBaseExcel).getTime();
            if (trTime < timeInicio || trTime > timeFim) return false;
        } else { 
            return false; 
        }
        return true;
    });

    // 3. Agrupamentos
    const agrupamentoTabela = {};
    const agrupamentoDiario = {}; 
    let viagensGerais = 0;
    let volumeGeral = 0;

    dadosFiltradosAtual.forEach(registro => {
        const d = registro.dataDaBaseExcel;
        const pl = registro.placa ? registro.placa.trim().toUpperCase() : 'N/A';
        const tr = registro.transportadora ? registro.transportadora.toUpperCase() : 'N/A';
        const v = registro.volumeReal || 0;

        // Tabela
        if (!agrupamentoTabela[pl]) agrupamentoTabela[pl] = { placa: pl, transp: tr, viagens: 0, volume: 0 };
        agrupamentoTabela[pl].viagens += 1;
        agrupamentoTabela[pl].volume += v;
        
        viagensGerais += 1;
        volumeGeral += v;

        // Diário
        if (d) {
            if (!agrupamentoDiario[d]) agrupamentoDiario[d] = { ativos: new Set(), vol: 0, via: 0, rec: 0 };
            agrupamentoDiario[d].ativos.add(pl);
            agrupamentoDiario[d].vol += v;
            agrupamentoDiario[d].via += 1;
        }
    });

    Object.keys(fatDiarioMap).forEach(d => {
        if (!agrupamentoDiario[d]) agrupamentoDiario[d] = { ativos: new Set(), vol: 0, via: 0, rec: 0 };
        agrupamentoDiario[d].rec = fatDiarioMap[d];
    });
    
    Object.keys(agrupamentoDiario).forEach(d => { 
        if(agrupamentoDiario[d].rec === undefined) agrupamentoDiario[d].rec = fatDiarioMap[d] || 0; 
    });

    dadosAgrupadosAtual = Object.values(agrupamentoTabela).sort((a, b) => b.viagens - a.viagens);
    agrupamentoDiarioGlobal = agrupamentoDiario; 

    // 4. Preencher Cards (Agora calculando a média de veículos ativos/dia)
    const diasOperacao = Object.keys(agrupamentoDiarioGlobal).length;
    let somaVeiculosAtivosDiario = 0;
    Object.values(agrupamentoDiarioGlobal).forEach(dia => {
        somaVeiculosAtivosDiario += dia.ativos.size;
    });
    const mediaVeiculosAtivosDia = diasOperacao > 0 ? (somaVeiculosAtivosDiario / diasOperacao) : 0;

    document.getElementById('cardVeiculosAtivos').innerText = mediaVeiculosAtivosDia.toLocaleString('pt-PT', { maximumFractionDigits: 1 });
    
    document.getElementById('cardVolumeTotal').innerText = volumeGeral.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const caixaMediaGlobal = viagensGerais > 0 ? (volumeGeral / viagensGerais) : 0;
    document.getElementById('cardCaixaMedia').innerText = caixaMediaGlobal.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    document.getElementById('cardReceitaTotal').innerText = receitaTotalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // 5. Desenhar Gráficos e Tabela
    desenharGraficos(agrupamentoDiarioGlobal);
    renderizarTabela(dadosAgrupadosAtual);
    document.getElementById('tabelaStatus').innerText = `${dadosAgrupadosAtual.length} placas listadas`;
}

// ----------------------------------------------------
// DESENHAR GRÁFICOS COMBINADOS
// ----------------------------------------------------
function desenharGraficos(agrupamento) {
    const datasOrdenadas = Object.keys(agrupamento).sort((a, b) => converterDataString(a).getTime() - converterDataString(b).getTime());

    const labels = [];
    const volArr = []; 
    const veiArr = []; 
    const viaArr = []; 
    const recArr = [];

    datasOrdenadas.forEach(d => {
        labels.push(d.substring(0, 5)); 
        volArr.push(parseFloat(agrupamento[d].vol.toFixed(2)));
        veiArr.push(agrupamento[d].ativos.size);
        viaArr.push(agrupamento[d].via);
        recArr.push(parseFloat(agrupamento[d].rec.toFixed(2)));
    });

    if (chartProducaoObj) chartProducaoObj.destroy();
    const ctx1 = document.getElementById('chartProducaoDiaria');
    chartProducaoObj = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { type: 'bar', label: 'Volume (m³)', data: volArr, backgroundColor: '#10b981', borderRadius: 4, yAxisID: 'y', order: 2 },
                { type: 'line', label: 'Veículos Ativos', data: veiArr, borderColor: '#38bdf8', backgroundColor: '#38bdf8', borderWidth: 3, pointBackgroundColor: '#0f172a', pointBorderColor: '#38bdf8', tension: 0.3, yAxisID: 'y1', order: 1 }
            ]
        },
        options: getDefaultChartOptions('Volume (m³)', '#10b981', 'Veículos Ativos', '#38bdf8')
    });

    if (chartViagensObj) chartViagensObj.destroy();
    const ctx2 = document.getElementById('chartViagensReceita');
    chartViagensObj = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { type: 'bar', label: 'Total Viagens', data: viaArr, backgroundColor: '#818cf8', borderRadius: 4, yAxisID: 'y', order: 2 },
                { type: 'line', label: 'Receita (R$)', data: recArr, borderColor: '#34d399', backgroundColor: '#34d399', borderWidth: 3, pointBackgroundColor: '#0f172a', pointBorderColor: '#34d399', tension: 0.3, yAxisID: 'y1', order: 1 }
            ]
        },
        options: getDefaultChartOptions('Viagens (Qtd)', '#818cf8', 'Receita (R$)', '#34d399', true)
    });
}

function getDefaultChartOptions(titleY1, colorY1, titleY2, colorY2, isMoney = false) {
    return {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: '#e2e8f0', font: { weight: 'bold' } } },
            datalabels: {
                display: true,
                anchor: (ctx) => ctx.dataset.type === 'line' ? 'end' : 'start',
                align: (ctx) => ctx.dataset.type === 'line' ? 'top' : 'top',
                offset: (ctx) => ctx.dataset.type === 'line' ? 4 : 4,
                color: (ctx) => ctx.dataset.type === 'line' ? colorY2 : '#fff',
                font: { weight: 'bold', size: 9 },
                formatter: (val, ctx) => {
                    if (val === 0) return '';
                    if (isMoney && ctx.dataset.type === 'line') return (val/1000).toFixed(1) + 'k'; 
                    return val;
                }
            }
        },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { weight: 'bold' } } },
            y: { display: true, position: 'left', title: { display: true, text: titleY1, color: colorY1 }, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: colorY1 } },
            y1: { display: true, position: 'right', title: { display: true, text: titleY2, color: colorY2 }, grid: { drawOnChartArea: false }, ticks: { color: colorY2 } }
        }
    };
}

// ----------------------------------------------------
// TABELA E EXPORTAÇÃO EXCEL
// ----------------------------------------------------
function renderizarTabela(dados) {
    const tbody = document.getElementById('tbodyProducaoFrota');
    tbody.innerHTML = '';
    if (dados.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-slate-500">Sem dados.</td></tr>`; return; }

    dados.forEach(l => {
        const cx = l.viagens > 0 ? (l.volume / l.viagens) : 0;
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-700/30 transition-colors";
        tr.innerHTML = `
            <td class="px-6 py-3 font-bold text-white"><span class="bg-slate-900 px-2 py-1 rounded border border-slate-700 font-mono tracking-widest">${l.placa}</span></td>
            <td class="px-6 py-3 text-slate-300 font-medium text-xs uppercase">${l.transp}</td>
            <td class="px-6 py-3 text-center text-sky-400 font-black">${l.viagens}</td>
            <td class="px-6 py-3 text-right text-emerald-400 font-mono font-bold">${l.volume.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="px-6 py-3 text-right text-amber-400 font-mono">${cx.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        `;
        tbody.appendChild(tr);
    });
}

function exportarParaExcel() {
    if (!dadosFiltradosAtual || dadosFiltradosAtual.length === 0) { alert("Sem dados."); return; }
    const fileBase = `Placas_Serrana_${document.getElementById('dataInicio').value}_a_${document.getElementById('dataFim').value}`;
    
    const obj = {};
    dadosFiltradosAtual.forEach(r => {
        const ch = `${r.dataDaBaseExcel}_${r.placa}`;
        if(!obj[ch]) obj[ch] = { Data: r.dataDaBaseExcel, Placa: r.placa, Transp: r.transportadora, Viagens: 0, Vol: 0 };
        obj[ch].Viagens += 1;
        obj[ch].Vol += (r.volumeReal || 0);
    });
    
    const excelArr = Object.values(obj).sort((a,b) => converterDataString(a.Data).getTime() - converterDataString(b.Data).getTime()).map(i => ({
        "Data": i.Data, "Placa": i.Placa, "Transportadora": i.Transp, "Viagens": i.Viagens, 
        "Volume (m³)": parseFloat(i.Vol.toFixed(2)), "Cx Média (m³)": parseFloat((i.Viagens > 0 ? i.Vol/i.Viagens : 0).toFixed(2))
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(excelArr), "Detalhamento");
    XLSX.writeFile(wb, `${fileBase}.xlsx`);
}

function exportarResumoDiarioExcel() {
    const chaves = Object.keys(agrupamentoDiarioGlobal).sort((a, b) => converterDataString(a).getTime() - converterDataString(b).getTime());
    if (chaves.length === 0) { alert("Sem dados para resumo."); return; }

    const excelArr = chaves.map(d => {
        const item = agrupamentoDiarioGlobal[d];
        return {
            "Data": d,
            "Transportadora": "SERRANALOG TRANSPORTES LTDA",
            "Veículos Ativos": item.ativos.size,
            "Viagens": item.via,
            "Volume (m³)": parseFloat(item.vol.toFixed(2)),
            "Caixa Média Diária (m³)": item.via > 0 ? parseFloat((item.vol / item.via).toFixed(2)) : 0,
            "Receita Lançada (R$)": parseFloat(item.rec.toFixed(2))
        };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(excelArr), "Resumo");
    XLSX.writeFile(wb, `Resumo_Diario_Serrana.xlsx`);
}