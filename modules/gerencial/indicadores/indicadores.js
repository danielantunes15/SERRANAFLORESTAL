// ==================== js/indicadores.js ====================

window.carregarDadosDashboard = async function() {
    // ----------------------------------------------------
    // CORREÇÃO: INICIAR RELÓGIO E TEMPORIZADOR
    atualizarRelogio();
    setInterval(atualizarRelogio, 1000);
    // ----------------------------------------------------

    await atualizarPonteiros();
    carregarControladorAtual();
    carregarFrentesTv();
    carregarOcorrenciasTv();
    carregarFrotasParadas();
    
    setInterval(() => {
        carregarOcorrenciasTv();
        carregarFrotasParadas();
    }, 10000);

    if(typeof atualizarFrentesDeTrabalho === 'function') {
        atualizarFrentesDeTrabalho();
        setInterval(atualizarFrentesDeTrabalho, 60000);
    }
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

window.atualizarFrentesDeTrabalho = function() {
    const agora = new Date();
    const dia = String(agora.getDate()).padStart(2, '0');
    const mes = String(agora.getMonth() + 1).padStart(2, '0'); 
    const ano = agora.getFullYear();
    const dataFormatada = `${dia}/${mes}/${ano}`;

    const hora = agora.getHours();
    let textoTurnoFrente = "";
    let classeTurnoFrente = "";
    
    const elTurnoBarText = document.getElementById('dash-turno');
    const elTurnoBarIcon = document.getElementById('dash-turno-icon');
    const elTurnoBarContainer = document.getElementById('container-barra-turno');

    if (hora >= 6 && hora < 18) {
        textoTurnoFrente = "  06:00 às 18:00";
        classeTurnoFrente = "turno-dia-style";
        if(elTurnoBarText) { elTurnoBarText.textContent = "TURNO: 06:00 às 18:00"; elTurnoBarText.style.color = "#ffffff"; }
        if(elTurnoBarIcon) elTurnoBarIcon.className = "fas fa-sun";
        if(elTurnoBarContainer) elTurnoBarContainer.style.borderLeftColor = "#f59e0b";
    } else {
        textoTurnoFrente = "  18:00 às 06:00";
        classeTurnoFrente = "turno-noite-style";
        if(elTurnoBarText) { elTurnoBarText.textContent = "TURNO: 18:00 às 06:00"; elTurnoBarText.style.color = "#ffffff"; }
        if(elTurnoBarIcon) elTurnoBarIcon.className = "fas fa-moon";
        if(elTurnoBarContainer) elTurnoBarContainer.style.borderLeftColor = "#38bdf8";
    }

    document.querySelectorAll('.dash-data-frente').forEach(el => el.textContent = dataFormatada);
    document.querySelectorAll('.dash-turno-frente').forEach(el => {
        el.textContent = textoTurnoFrente;
        el.className = `frente-turno dash-turno-frente ${classeTurnoFrente}`;
    });
}

async function atualizarPonteiros() {
    let totalCavalos = 0;
    let listaDeCavalos = [];
    
    // Busca todos os Cavalos válidos e ATIVOS
    try {
        let queryFrota = supabaseClient.from('frotas_manutencao').select('cavalo').eq('status', 'Ativo');
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

    // Verifica as Ordens de Serviço
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
                
                // IGNORA COMPLETAMENTE SE FOR FROTA OU SE FOR TIPO "Cavalo Disponível S/ Carreta" E SOMENTE ATIVOS
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

async function carregarControladorAtual() {
    let queryCtrl = supabaseClient.from('dashboard_status').select('id, controlador').limit(1);
    if (typeof window.aplicarFiltroFilial === 'function') queryCtrl = window.aplicarFiltroFilial(queryCtrl);
    const { data } = await queryCtrl;
    
    const nome = (data && data.length > 0 && data[0].controlador) ? data[0].controlador : 'NÃO DEFINIDO';
    document.getElementById('dash-controlador-nome').textContent = nome;
    document.getElementById('configControlador').value = nome === 'NÃO DEFINIDO' ? '' : nome;
}

window.salvarControladorDash = async function() {
    const nome = document.getElementById('configControlador').value;
    
    let queryCtrl = supabaseClient.from('dashboard_status').select('id').limit(1);
    if (typeof window.aplicarFiltroFilial === 'function') queryCtrl = window.aplicarFiltroFilial(queryCtrl);
    const { data } = await queryCtrl;
    
    if(data && data.length > 0) {
        await supabaseClient.from('dashboard_status').update({ controlador: nome }).eq('id', data[0].id);
        carregarControladorAtual();
    } else {
        // Se a filial ainda não tem um registro de status do dashboard, ele cria
        let novoStatus = { controlador: nome };
        if (typeof window.injetarFilial === 'function') novoStatus = window.injetarFilial(novoStatus);
        await supabaseClient.from('dashboard_status').insert([novoStatus]);
        carregarControladorAtual();
    }
}

async function carregarFrentesTv() {
    let queryFrentes = supabaseClient.from('frentes_trabalho').select('*').eq('status', 'Ativa');
    if (typeof window.aplicarFiltroFilial === 'function') queryFrentes = window.aplicarFiltroFilial(queryFrentes);
    const { data } = await queryFrentes;
    
    const container = document.getElementById('lista-frentes-tv');
    const containerConfig = document.getElementById('config-lista-frentes');
    const elKpiFrentes = document.getElementById('kpi-frentes');
    
    if (data && data.length > 0) {
        if(elKpiFrentes) elKpiFrentes.textContent = data.length;
        if(container) container.innerHTML = ''; 
        if(containerConfig) containerConfig.innerHTML = '';
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
            if(containerConfig) containerConfig.innerHTML += `<div class="mini-item"><span>${f.nome}</span> <button class="btn-remover-mini" onclick="removerFrenteDash('${f.id}')"><i class="fas fa-trash"></i></button></div>`;
        });
        atualizarFrentesDeTrabalho();
    } else {
        if(elKpiFrentes) elKpiFrentes.textContent = '0';
        if(container) container.innerHTML = '<div class="empty-state">Nenhuma frente ativa.</div>';
    }
}

async function carregarFrotasParadas() {
    try {
        let queryFrota = supabaseClient.from('frotas_manutencao').select('cavalo').eq('status', 'Ativo');
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
        
        // Filtra para exibir APENAS cavalos ativos e ignora Cavalo Disponível S/ Carreta
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

async function carregarOcorrenciasTv() {
    let queryOc = supabaseClient.from('dashboard_ocorrencias').select('*').eq('status', 'Pendente');
    if (typeof window.aplicarFiltroFilial === 'function') queryOc = window.aplicarFiltroFilial(queryOc);
    const { data } = await queryOc;
    
    const containerConfig = document.getElementById('config-lista-ocorrencias');
    if (data && data.length > 0) {
        containerConfig.innerHTML = '';
        data.forEach(o => {
            containerConfig.innerHTML += `<div class="mini-item"><span><strong>${o.tipo}:</strong> ${o.descricao}</span> <button class="btn-remover-mini text-green" onclick="removerOcorrenciaDash('${o.id}')"><i class="fas fa-check"></i></button></div>`;
        });
    } else {
        if(containerConfig) containerConfig.innerHTML = '';
    }
    atualizarPonteiros();
}

window.abrirConfigDash = () => document.getElementById('modalConfigDash').style.display = 'flex';
window.fecharConfigDash = () => document.getElementById('modalConfigDash').style.display = 'none';

window.addFrenteDash = async function() {
    const nome = document.getElementById('novaFrenteInput').value;
    if(!nome) return;
    
    let novaFrente = { nome: nome };
    if (typeof window.injetarFilial === 'function') novaFrente = window.injetarFilial(novaFrente);
    
    await supabaseClient.from('frentes_trabalho').insert([novaFrente]);
    document.getElementById('novaFrenteInput').value = '';
    carregarFrentesTv();
}

window.removerFrenteDash = async function(id) {
    await supabaseClient.from('frentes_trabalho').update({ status: 'Inativa' }).eq('id', id);
    carregarFrentesTv();
}

window.addOcorrenciaDash = async function() {
    const tipo = document.getElementById('novaOcorrenciaTipo').value;
    const desc = document.getElementById('novaOcorrenciaDesc').value;
    if(!desc) return;
    
    let novaOcorrencia = { tipo: tipo, descricao: desc };
    if (typeof window.injetarFilial === 'function') novaOcorrencia = window.injetarFilial(novaOcorrencia);
    
    await supabaseClient.from('dashboard_ocorrencias').insert([novaOcorrencia]);
    document.getElementById('novaOcorrenciaDesc').value = '';
    carregarOcorrenciasTv();
}

window.removerOcorrenciaDash = async function(id) {
    await supabaseClient.from('dashboard_ocorrencias').update({ status: 'Resolvido' }).eq('id', id);
    carregarOcorrenciasTv();
}

window.exportarDashboardPNG = function() {
    const elemento = document.getElementById('area-print-dash');
    const botaoPrint = document.getElementById('btn-gerar-print');
    const botaoFlutuante = document.getElementById('btn-floating-config');
    
    botaoPrint.style.display = 'none';
    if(botaoFlutuante) botaoFlutuante.style.display = 'none';
    
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
        if(botaoFlutuante) botaoFlutuante.style.display = 'block';
    });
}