// ==================== js/indicadores.js ====================

window.carregarDadosDashboard = async function() {
    atualizarRelogio();
    setInterval(atualizarRelogio, 1000);

    await atualizarPonteiros();
    carregarStatusDash();
    carregarFrentesTv();
    carregarFrotasParadas();
    
    setInterval(() => {
        carregarFrotasParadas();
        atualizarPonteiros();
        carregarStatusDash();
    }, 10000);
}

window.atualizarRelogio = function() {
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

async function atualizarPonteiros() {
    let totalCavalos = 0;
    let listaDeCavalos = [];
    
    try {
        // FILTRO ADICIONADO: Pega apenas status Ativo E categoria TRITREM
        let queryFrota = supabaseClient.from('frotas_manutencao').select('cavalo').eq('status', 'Ativo').eq('categoria', 'TRITREM');
        if (typeof window.aplicarFiltroFilial === 'function') queryFrota = window.aplicarFiltroFilial(queryFrota);
        const { data: frotaData, error } = await queryFrota;
        
        if (!error && frotaData) {
            listaDeCavalos = frotaData.map(f => f.cavalo.trim().toUpperCase());
            totalCavalos = listaDeCavalos.length;
        }
    } catch (e) { console.error("Erro Placas:", e); }

    let contadorEmManutencaoGlobal = 0; 
    let cavalosEmManutencao = 0; 
    let cavalosSinistrados = 0; 

    try {
        let queryOS = supabaseClient.from('ordens_servico').select('placa, status, tipo');
        if (typeof window.aplicarFiltroFilial === 'function') queryOS = window.aplicarFiltroFilial(queryOS);
        const { data: osData, error: osError } = await queryOS;
            
        if (!osError && osData) {
            const placasUnicasGeral = new Set();
            const setCavalosManut = new Set();
            const setCavalosSinistro = new Set();

            osData.forEach(os => {
                const placaLimpa = os.placa.trim().toUpperCase();
                
                if (listaDeCavalos.includes(placaLimpa) && os.tipo !== 'Cavalo Disponível S/ Carreta') {
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
    } catch (e) { console.error("Erro O.S.:", e); }

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

// === CÁLCULO DE TURNO AUTOMÁTICO ===
async function carregarStatusDash() {
    let queryCtrl = supabaseClient.from('dashboard_status').select('id, controlador').limit(1);
    if (typeof window.aplicarFiltroFilial === 'function') queryCtrl = window.aplicarFiltroFilial(queryCtrl);
    const { data: statusData } = await queryCtrl;
    
    const nomeCtrl = (statusData && statusData.length > 0 && statusData[0].controlador) ? statusData[0].controlador : 'NÃO DEFINIDO';
    document.getElementById('dash-controlador-nome').textContent = nomeCtrl;
    
    const turnos = await db.getTurnosOperacionais();
    let turnoTexto = "06:00 às 18:00"; // Padrão
    let turnoTipo = "DIA"; // Padrão
    
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
                if (tempoAtualMinutos >= iniMin && tempoAtualMinutos < fimMin) { 
                    turnoAtivo = t; 
                    break; 
                }
            } else {
                if (tempoAtualMinutos >= iniMin || tempoAtualMinutos < fimMin) { 
                    turnoAtivo = t; 
                    break; 
                }
            }
        }
        
        const formataHora = (h) => h ? h.substring(0, 5) : '--:--';
        turnoTexto = `${formataHora(turnoAtivo.hora_inicio)} às ${formataHora(turnoAtivo.hora_fim)}`;
        turnoTipo = turnoAtivo.tipo || 'DIA';
    }
    
    const elTurnoBarText = document.getElementById('dash-turno');
    const elTurnoBarIcon = document.getElementById('dash-turno-icon');
    const elTurnoBarContainer = document.getElementById('container-barra-turno');
    
    if(elTurnoBarText) elTurnoBarText.textContent = `TURNO: ${turnoTexto}`;

    if (turnoTipo === 'DIA') {
        if(elTurnoBarIcon) elTurnoBarIcon.className = "fas fa-sun";
        if(elTurnoBarContainer) elTurnoBarContainer.style.borderLeftColor = "#f59e0b";
    } else {
        if(elTurnoBarIcon) elTurnoBarIcon.className = "fas fa-moon";
        if(elTurnoBarContainer) elTurnoBarContainer.style.borderLeftColor = "#38bdf8";
    }

    aplicarLayoutFrentes(turnoTexto, turnoTipo);
}

function aplicarLayoutFrentes(turnoTexto, turnoTipo) {
    const agora = new Date();
    const dia = String(agora.getDate()).padStart(2, '0');
    const mes = String(agora.getMonth() + 1).padStart(2, '0'); 
    const ano = agora.getFullYear();
    const dataFormatada = `${dia}/${mes}/${ano}`;

    let classeTurnoFrente = turnoTipo === 'DIA' ? "turno-dia-style" : "turno-noite-style";
    
    document.querySelectorAll('.dash-data-frente').forEach(el => el.textContent = dataFormatada);
    document.querySelectorAll('.dash-turno-frente').forEach(el => {
        el.textContent = `  ${turnoTexto}`;
        el.className = `frente-turno dash-turno-frente ${classeTurnoFrente}`;
    });
}

async function carregarFrentesTv() {
    let queryFrentes = supabaseClient.from('frentes_trabalho').select('*').eq('status', 'Ativa');
    if (typeof window.aplicarFiltroFilial === 'function') queryFrentes = window.aplicarFiltroFilial(queryFrentes);
    const { data } = await queryFrentes;
    
    const container = document.getElementById('lista-frentes-tv');
    const elKpiFrentes = document.getElementById('kpi-frentes');
    
    if (data && data.length > 0) {
        if(elKpiFrentes) elKpiFrentes.textContent = data.length;
        if(container) container.innerHTML = ''; 
        data.forEach(f => {
            if(container) {
                container.innerHTML += `
                <div class="frente-item-card">
                    <div class="frente-time-box">
                        <span class="frente-data dash-data-frente">--/--/----</span>
                        <span class="frente-turno dash-turno-frente">Carregando...</span>
                    </div>
                    <div class="frente-content-box">
                        <h4 class="frente-nome-titulo"><i class="fas fa-tractor text-green"></i> ${f.nome}</h4>
                    </div>
                </div>`;
            }
        });
        carregarStatusDash();
    } else {
        if(elKpiFrentes) elKpiFrentes.textContent = '0';
        if(container) container.innerHTML = '<div class="empty-state">Nenhuma frente ativa.</div>';
    }
}

async function carregarFrotasParadas() {
    try {
        // FILTRO ADICIONADO: Pega apenas status Ativo E categoria TRITREM
        let queryFrota = supabaseClient.from('frotas_manutencao').select('cavalo').eq('status', 'Ativo').eq('categoria', 'TRITREM');
        if (typeof window.aplicarFiltroFilial === 'function') queryFrota = window.aplicarFiltroFilial(queryFrota);
        const { data: frotaData } = await queryFrota;
        
        const listaCavalos = frotaData ? frotaData.map(f => f.cavalo.trim().toUpperCase()) : [];

        let queryOS = supabaseClient.from('ordens_servico').select('placa, tipo, status').in('status', ['Aguardando Oficina', 'Em Manutenção']); 
        if (typeof window.aplicarFiltroFilial === 'function') queryOS = window.aplicarFiltroFilial(queryOS);
        const { data, error } = await queryOS;

        if (error) throw error;
        const container = document.getElementById('frotas-paradas-list');
        if(!container) return;
        container.innerHTML = ''; 
        
        const osFiltradas = data ? data.filter(os => listaCavalos.includes(os.placa.trim().toUpperCase()) && os.tipo !== 'Cavalo Disponível S/ Carreta') : [];

        if (!osFiltradas || osFiltradas.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; margin-top: 20px;">
                      Nenhuma frota parada no momento.
                </div>
            `;
            return;
        }
        
        osFiltradas.forEach(os => {
            let tipoString = os.tipo ? os.tipo.toLowerCase() : 'corretiva';
            let classeCss = 'corretiva'; 
            let icone = 'fas fa-wrench';
            let textColor = 'text-red';
            
            if (tipoString.includes('preventiva')) {
                classeCss = 'preventiva';
                icone = 'fas fa-clipboard-check';
                textColor = 'text-orange';
            }
            if (tipoString.includes('borracharia') || tipoString.includes('pneu')) {
                classeCss = 'borracharia';
                icone = 'fas fa-life-ring';
                textColor = 'text-blue';
            }
            container.innerHTML += `
                <div class="item-frota-parada ${classeCss}">
                    <div class="cavalo-info">
                        <i class="${icone} ${textColor}" style="font-size: 1.3rem;"></i>
                        <span class="identificacao-cavalo">${os.placa || 'N/I'}</span>
                    </div>
                    <div class="badge-tipo ${classeCss}">
                        ${os.tipo ? os.tipo.toUpperCase() : 'CORRETIVA'}
                    </div>
                </div>
            `;
        });
    } catch (error) {
        console.error("Erro ao buscar frotas paradas:", error);
        const container = document.getElementById('frotas-paradas-list');
        if(container) {
            container.innerHTML = `<div class="empty-state" style="color: #ef4444; text-align: center;">Erro ao carregar dados da oficina.</div>`;
        }
    }
}

window.exportarDashboardPNG = function() {
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
        link.download = `CCOL_DASHBOARD_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png'); 
        link.click();
        
        botaoPrint.style.display = 'flex';
    });
}