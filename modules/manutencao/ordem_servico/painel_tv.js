// ==================== modules/manutencao/ordem_servico/painel_tv.js ====================
// Gerenciador exclusivo do Modo TV (Imersivo), Relógio e Cards

window.entrarModoTV = function() {
    const mainHeader = document.querySelector('.main-header');
    const menuContainer = document.getElementById('menu-container');
    const mainFooter = document.querySelector('.main-footer');
    const mainContent = document.getElementById('conteudo-principal');

    if (mainHeader) mainHeader.style.display = 'none';
    if (menuContainer) menuContainer.style.display = 'none';
    if (mainFooter) mainFooter.style.display = 'none';
    if (mainContent) {
        mainContent.style.padding = '0';
        mainContent.style.margin = '0';
        mainContent.style.width = '100vw';
        mainContent.style.maxWidth = '100%';
    }

    let btnSair = document.getElementById('btnSairTV');
    if (!btnSair) {
        btnSair = document.createElement('button');
        btnSair.id = 'btnSairTV';
        btnSair.innerHTML = '<i class="fas fa-arrow-left"></i> Voltar ao Sistema';
        btnSair.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999; background: #ef4444; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 1.1rem; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.5); transition: background 0.2s;';
        btnSair.onmouseover = () => btnSair.style.background = '#dc2626';
        btnSair.onmouseout = () => btnSair.style.background = '#ef4444';
        btnSair.onclick = function() {
            if (document.fullscreenElement) document.exitFullscreen();
            window.navegarPara('os'); 
        };
        document.body.appendChild(btnSair);
    } else {
        btnSair.style.display = 'block';
    }
};

window.sairModoTV = function() {
    if (window.tvInterval) { clearInterval(window.tvInterval); window.tvInterval = null; }
    if (window.tvClockInterval) { clearInterval(window.tvClockInterval); window.tvClockInterval = null; }
    
    const mainHeader = document.querySelector('.main-header');
    const menuContainer = document.getElementById('menu-container');
    const mainFooter = document.querySelector('.main-footer');
    const mainContent = document.getElementById('conteudo-principal');

    if (mainHeader) mainHeader.style.display = '';
    if (menuContainer) menuContainer.style.display = '';
    if (mainFooter) mainFooter.style.display = '';
    if (mainContent) {
        mainContent.style.padding = '';
        mainContent.style.margin = '';
        mainContent.style.width = '';
        mainContent.style.maxWidth = '';
    }
    
    const btnSair = document.getElementById('btnSairTV');
    if (btnSair) btnSair.style.display = 'none';
};

window.iniciarRelogioTV = function() {
    atualizarRelogioTV();
    if (!window.tvClockInterval) {
        window.tvClockInterval = setInterval(atualizarRelogioTV, 1000);
    }
    
    if (window.tvInterval) clearInterval(window.tvInterval);
    window.tvInterval = setInterval(() => {
        if(typeof carregarDadosOS === 'function') {
            carregarDadosOS().then(() => {
                if (typeof renderizarCardsTV === 'function') renderizarCardsTV();
            });
        } else {
            if (typeof renderizarCardsTV === 'function') renderizarCardsTV();
        }
    }, 15000);
};

window.toggleFullScreenTV = function() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.warn("Tela cheia falhou:", err);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
};

function atualizarRelogioTV() {
    const elRelogio = document.getElementById('tvRelogio');
    const elData = document.getElementById('tvData');
    if (!elRelogio || !elData) return;
    
    const agora = new Date();
    elRelogio.innerText = agora.toLocaleTimeString('pt-BR');
    const opcoesData = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    elData.innerText = agora.toLocaleDateString('pt-BR', opcoesData).toUpperCase();
}

window.renderizarCardsTV = function() {
    const container = document.getElementById('tvCardsContainer');
    if (!container) return;
    if (typeof ordensServico === 'undefined' || !ordensServico) return;

    // --- 1. Frotas para o KPI (Mantém apenas TRITREM Ativos para Taxa DM) ---
    let frotasValidas = [];
    if (typeof frotasManutencao !== 'undefined' && Array.isArray(frotasManutencao)) {
        frotasValidas = frotasManutencao.filter(f => f.status === 'Ativo' && f.categoria && f.categoria.toUpperCase() === 'TRITREM');
    }

    // --- 2. Placas permitidas para os Cards (Cavalos TRITREM Ativos + TODOS os GOs) ---
    const placasExibicao = [];
    if (typeof frotasManutencao !== 'undefined' && Array.isArray(frotasManutencao)) {
        frotasManutencao.forEach(f => {
            if (f.status === 'Ativo' && f.categoria && f.categoria.toUpperCase() === 'TRITREM') {
                if (f.cavalo) placasExibicao.push(String(f.cavalo).trim().toUpperCase());
            }
            // Inclui todas as identificações de GOs disponíveis
            if (f.go && String(f.go).trim() !== '') {
                placasExibicao.push(String(f.go).trim().toUpperCase());
            }
        });
    }

    const agora = new Date();
    const hojeInicio = new Date(agora); hojeInicio.setHours(0,0,0,0);
    const hojeFim = new Date(agora); hojeFim.setHours(23,59,59,999);
    
    const osHoje = ordensServico.filter(o => {
        const placaOS = o.placa ? String(o.placa).trim().toUpperCase() : '';
        const ehApenasGO = (o.motorista && String(o.motorista).trim().toUpperCase() === 'N/A (APENAS GO)');

        // O filtro agora aceita se estiver nas frotas ou se tiver a assinatura do GO
        if (!placaOS || (!placasExibicao.includes(placaOS) && !ehApenasGO)) return false;
        if(o.tipo === 'Sinistro') return false;
        
        let dIni = o.data_abertura ? new Date(String(o.data_abertura).replace('Z', '').replace('+00:00', '')) : null;
        let dFim = o.data_conclusao ? new Date(String(o.data_conclusao).replace('Z', '').replace('+00:00', '')) : null;
        if(!dIni) return false;
        
        if(dIni >= hojeInicio && dIni <= hojeFim) return true;
        if(dFim && dFim >= hojeInicio && dFim <= hojeFim) return true;
        if(!dFim && dIni < hojeInicio) return true;
        return false;
    });

    const abertasHoje = osHoje.filter(o => o.status !== 'Concluída').length;
    const fechadasHoje = osHoje.filter(o => o.status === 'Concluída' && o.data_conclusao && new Date(String(o.data_conclusao).replace('Z', '').replace('+00:00', '')) >= hojeInicio).length;
    
    const totalOsHoje = ordensServico.filter(o => {
        const placaOS = o.placa ? String(o.placa).trim().toUpperCase() : '';
        const ehApenasGO = (o.motorista && String(o.motorista).trim().toUpperCase() === 'N/A (APENAS GO)');

        if (!placaOS || (!placasExibicao.includes(placaOS) && !ehApenasGO)) return false;
        if(!o.data_abertura || o.tipo === 'Sinistro') return false;
        
        let dIni = new Date(String(o.data_abertura).replace('Z', '').replace('+00:00', ''));
        return dIni >= hojeInicio && dIni <= hojeFim;
    }).length; 
    
    let tempoTotalDispMs = frotasValidas.length * 24 * 60 * 60 * 1000;
    let tempoManutencaoMs = 0;
    
    // --- CÁLCULO DE VEÍCULOS DISPONÍVEIS E EM MANUTENÇÃO (APENAS CAVALOS) ---
    let veiculosManutencao = 0;
    let veiculosDisponiveis = 0;

    frotasValidas.forEach(frota => {
        const osAberta = ordensServico.find(o => o.placa === frota.cavalo && o.status !== 'Concluída' && o.status !== 'Agendada');
        if (osAberta) {
            veiculosManutencao++;
        } else {
            veiculosDisponiveis++;
        }

        const osCavalo = ordensServico.filter(o => o.placa === frota.cavalo && o.tipo !== 'Sinistro');
        osCavalo.forEach(os => {
            let osIni = os.data_abertura ? new Date(String(os.data_abertura).replace('Z', '').replace('+00:00', '')) : null;
            let osFim = os.data_conclusao ? new Date(String(os.data_conclusao).replace('Z', '').replace('+00:00', '')) : hojeFim;
            if(!osIni) return;

            let overlapInicio = osIni > hojeInicio ? osIni : hojeInicio;
            let overlapFim = osFim < hojeFim ? osFim : hojeFim;

            if(overlapInicio < overlapFim && os.status !== 'Agendada') {
                tempoManutencaoMs += (overlapFim - overlapInicio);
            }
        });
    });

    if(tempoManutencaoMs > tempoTotalDispMs) tempoManutencaoMs = tempoTotalDispMs;
    const dmDia = tempoTotalDispMs > 0 ? (((tempoTotalDispMs - tempoManutencaoMs) / tempoTotalDispMs) * 100).toFixed(1) : 100;

    if(document.getElementById('tvKpiTotal')) document.getElementById('tvKpiTotal').innerText = totalOsHoje;
    if(document.getElementById('tvKpiAbertas')) document.getElementById('tvKpiAbertas').innerText = abertasHoje;
    if(document.getElementById('tvKpiFechadas')) document.getElementById('tvKpiFechadas').innerText = fechadasHoje;
    if(document.getElementById('tvKpiDM')) document.getElementById('tvKpiDM').innerText = dmDia + '%';
    if(document.getElementById('tvKpiDisponiveis')) document.getElementById('tvKpiDisponiveis').innerText = veiculosDisponiveis;
    if(document.getElementById('tvKpiEmManutencao')) document.getElementById('tvKpiEmManutencao').innerText = veiculosManutencao;
    
    // --- RENDERIZAÇÃO DOS CARDS (O.S. ABERTAS) ---
    const osAtivas = ordensServico.filter(o => {
        if (o.status !== 'Aguardando Oficina' && o.status !== 'Em Manutenção') return false;
        if (o.tipo === 'Sinistro') return false;

        const placaOS = o.placa ? String(o.placa).trim().toUpperCase() : '';
        const ehApenasGO = (o.motorista && String(o.motorista).trim().toUpperCase() === 'N/A (APENAS GO)');

        // EXIBE SE A PLACA FOR UM CAVALO, UM GO, OU SE FOR UMA O.S MARCADA COMO APENAS GO
        return (placasExibicao.includes(placaOS) || ehApenasGO);
    });
    
    if (osAtivas.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh;">
                <h1 style="color: var(--ccol-green-bright); font-size: 4rem; margin: 0;">PÁTIO VAZIO  </h1>
                <p style="color: #94a3b8; font-size: 2rem;">Nenhum veículo aguardando manutenção.</p>
            </div>
        `;
        return;
    }
    
    osAtivas.sort((a, b) => {
        const pesoPri = { 'Urgente': 4, 'Alta': 3, 'Normal': 2, 'Baixa': 1 };
        const pA = pesoPri[a.prioridade] || 0;
        const pB = pesoPri[b.prioridade] || 0;
        if (pA !== pB) return pB - pA;
        return new Date(a.data_abertura) - new Date(b.data_abertura);
    });
    
    container.innerHTML = osAtivas.map(os => {
        let corPrioridade = '#3b82f6'; 
        if (os.prioridade === 'Urgente') corPrioridade = '#ef4444';
        else if (os.prioridade === 'Alta') corPrioridade = '#f97316';
        else if (os.prioridade === 'Baixa') corPrioridade = '#10b981';
        
        let diffHrs = 0; let diffMin = 0; let entradaHoraStr = '--:--';
        if (os.data_abertura) {
            const inicio = new Date(String(os.data_abertura).replace('Z', '').replace('+00:00', ''));
            const diffMs = agora - inicio;
            if(diffMs > 0) {
                diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                diffMin = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            }
            entradaHoraStr = inicio.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        }
        
        let colorCronometro = '#fff'; let alertaClass = '';
        if (diffHrs >= 24) { colorCronometro = '#ef4444'; alertaClass = 'piscar-alerta'; } 
        else if (diffHrs >= 12) { colorCronometro = '#f59e0b'; }
        
        // Pega a frota usando TODA a base de frota para encontrar as placas das carretas do GO e do Cavalo
        let frotaVinculada = {};
        if (typeof frotasManutencao !== 'undefined' && Array.isArray(frotasManutencao)) {
            frotaVinculada = frotasManutencao.find(f => 
                (f.cavalo && String(f.cavalo).trim().toUpperCase() === String(os.placa).trim().toUpperCase()) || 
                (f.go && String(f.go).trim().toUpperCase() === String(os.placa).trim().toUpperCase())
            ) || {};
        }

        // MONTAGEM DAS TAGS COM O NÚMERO DA FROTA, GO E CARRETAS
        let conjuntosBadge = '';

        // Se a frota tem um número de frota associado, exibe a tag primeiro (abreviado e forçando mesma linha)
        if (frotaVinculada.numero_frota && String(frotaVinculada.numero_frota).trim() !== '') {
            conjuntosBadge += `<span style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; padding: 2px 6px; border-radius: 4px; font-size: 0.85rem; border: 1px solid rgba(245, 158, 11, 0.5); font-weight: bold; white-space: nowrap;">FR: ${String(frotaVinculada.numero_frota).toUpperCase()}</span>`;
        }
        
        // Se a frota tem um GO associado, cria o distintivo do GO
        if (frotaVinculada.go && String(frotaVinculada.go).trim() !== '') {
            conjuntosBadge += `<span style="background: rgba(59, 130, 246, 0.2); color: #93c5fd; padding: 2px 6px; border-radius: 4px; font-size: 0.85rem; border: 1px solid rgba(59, 130, 246, 0.5); font-weight: bold; white-space: nowrap;">GO: ${String(frotaVinculada.go).toUpperCase()}</span>`;
        }
        
        // Em seguida, adiciona as placas das carretas
        conjuntosBadge += [frotaVinculada.carreta1, frotaVinculada.carreta2, frotaVinculada.carreta3]
            .filter(Boolean)
            .map(c => `<span style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-size: 0.85rem; border: 1px solid rgba(255,255,255,0.2); white-space: nowrap;">${c}</span>`).join('');
            
        let avisoPrevisao = ''; let campoPrevisao = os.previsao_entrega || os.previsao;
        if (campoPrevisao) {
            const dataPrevisao = new Date(String(campoPrevisao).replace('Z', '').replace('+00:00', ''));
            if (agora > dataPrevisao) {
                avisoPrevisao = `<div style="background: #ef4444; color: #fff; padding: 5px; text-align: center; font-weight: bold; border-radius: 4px; margin-top: 10px; font-size: 1rem; border: 2px solid #fff;">⚠️ PREVISÃO VENCIDA: ${formatarDataHoraBrasil(campoPrevisao)}</div>`;
            } else {
                avisoPrevisao = `<div style="background: #10b981; color: #ffffff; padding: 5px; text-align: center; border-radius: 4px; margin-top: 10px; font-size: 1rem; font-weight: bold;">PREVISÃO: ${formatarDataHoraBrasil(campoPrevisao)}</div>`;
                colorCronometro = '#10b981'; alertaClass = '';
            }
        } else {
             avisoPrevisao = `<div style="background: rgba(255,255,255,0.05); color: #94a3b8; padding: 5px; text-align: center; border-radius: 4px; margin-top: 10px; font-size: 0.9rem;">AGUARDANDO PREVISÃO</div>`;
        }
        
        const textoStatus = os.status === 'Em Manutenção' ? '  EM OFICINA' : '  AGUARDANDO ATENDIMENTO';
        const bgStatus = os.status === 'Em Manutenção' ? '#1e3a8a' : '#1e293b'; 
        const borderStatus = os.status === 'Em Manutenção' ? '#3b82f6' : '#475569'; 
        const nomeDoMecanico = os.mecanico_responsavel || os.mecanico || 'NÃO ATRIBUÍDO';

        return `
            <div class="${alertaClass}" style="background: ${bgStatus}; border: 3px solid ${borderStatus}; border-radius: 12px; padding: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                    <div>
                        <div style="font-size: 1rem; color: #94a3b8; margin-bottom: 5px;">O.S. #${os.id} | ${textoStatus}</div>
                        <div style="font-size: 3rem; font-weight: 900; color: #fff; line-height: 1;">${os.placa}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="background: ${corPrioridade}; color: #fff; font-weight: bold; padding: 5px 15px; border-radius: 20px; font-size: 1.1rem; text-transform: uppercase;">${os.prioridade}</div>
                    </div>
                </div>
                <div style="margin-bottom: 15px; display: flex; gap: 6px; flex-wrap: nowrap; overflow: hidden; align-items: center; width: 100%;">${conjuntosBadge}</div>
                <div style="background: rgba(0,0,0,0.4); border-radius: 8px; padding: 15px; margin-bottom: 15px; flex: 1;">
                    <div style="color: #60a5fa; font-weight: bold; font-size: 1.2rem; margin-bottom: 5px;">${os.tipo}</div>
                    <div style="color: #cbd5e1; font-size: 1.1rem;">Motorista: <strong style="color: #fff;">${os.motorista}</strong></div>
                    <div style="color: #cbd5e1; font-size: 1.1rem; margin-top: 5px;">Mecânico: <strong style="color: var(--ccol-green-bright); text-transform: uppercase;">${nomeDoMecanico}</strong></div>
                    <div style="color: #94a3b8; font-size: 0.9rem; margin-top: 8px; max-height: 60px; overflow: hidden; text-overflow: ellipsis;">Detalhe: ${os.problema || 'Nenhum detalhe reportado'}</div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
                    <div style="color: #94a3b8; font-size: 1rem;">Entrada: <br><strong style="color: #fff;">${entradaHoraStr}</strong></div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.9rem; color: #94a3b8;">TEMPO NO PÁTIO</div>
                        <div style="font-size: 2.2rem; font-weight: 900; color: ${colorCronometro}; font-family: monospace;">${String(diffHrs).padStart(2,'0')}:${String(diffMin).padStart(2,'0')}</div>
                    </div>
                </div>
                ${avisoPrevisao}
            </div>
        `;
    }).join('');
};