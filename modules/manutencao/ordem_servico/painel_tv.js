// ==================== modules/manutencao/ordem_servico/painel_tv.js ====================
// Gerenciador exclusivo do Modo TV (Imersivo), Relógio, Cards e Anúncios por Voz

// Conjuntos para evitar que a TV fale duas vezes o mesmo aviso
if (typeof window.isFirstRenderTV === 'undefined') {
    window.osNovasAnunciadas = new Set();
    window.osLiberadasAnunciadas = new Set();
    window.isFirstRenderTV = true; 
    window.isGongoTocando = false; 
    window.tvPaginaAtual = 0; // Controle do Carrossel de Páginas
    window.tvPausarCarrossel = false; // Trava a paginação se houver OS finalizada na tela
}

// ================== LÓGICA DE ÁUDIO E VOZ (COM GONGO) ==================

function tocarGongoSintetizado(callback) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) throw new Error("Áudio não suportado");
        
        const ctx = new AudioContext();
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';

        osc1.frequency.setValueAtTime(659.25, ctx.currentTime);
        osc2.frequency.setValueAtTime(523.25, ctx.currentTime + 0.5);

        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        
        gainNode.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        
        gainNode.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 0.55);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.5);
        
        osc2.start(ctx.currentTime + 0.5);
        osc2.stop(ctx.currentTime + 1.5);

        setTimeout(() => {
            if (callback) callback();
        }, 1500);

    } catch (e) {
        if (callback) callback();
    }
}

function anunciarComGongo(texto) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.resume(); 

    const executarVoz = () => {
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        utterance.rate = 0.85; 
        utterance.pitch = 1;
        utterance.volume = 1;
        window.speechSynthesis.speak(utterance);
    };

    if (window.isGongoTocando || window.speechSynthesis.speaking) {
        executarVoz();
        return;
    }

    window.isGongoTocando = true;
    
    tocarGongoSintetizado(() => {
        window.isGongoTocando = false;
        executarVoz();
    });
}

window.falarVeiculoLiberado = function(placa, frota) {
    let placaFalada = String(placa).split('').join(' ');
    let texto = `Atenção Pátio! Veículo placa ${placaFalada} , liberado da oficina.`;
    if (frota && frota !== '') {
        texto += ` Número da Frota: ${frota}.`;
    }
    anunciarComGongo(texto);
};

window.falarNovaOS = function(numero, tipo, placa) {
    let placaFalada = String(placa).split('').join(' ');
    
    let tipoLimpo = String(tipo).replace('Manutenção', '').replace('- P.A Serrana', '').trim();
    if (tipoLimpo === '') tipoLimpo = 'Manutenção';

    let texto = `Atenção Oficina! Nova Ordem de Serviço número ${numero}. Serviço de ${tipoLimpo}, para o veículo placa ${placaFalada}.`;
    anunciarComGongo(texto);
};

// =======================================================================

if (!window.tvEventListenersConfigured) {
    window.addEventListener('resize', () => {
        if (typeof renderizarCardsTV === 'function') renderizarCardsTV();
    });
    document.addEventListener('fullscreenchange', () => {
        if (typeof renderizarCardsTV === 'function') renderizarCardsTV();
    });
    window.tvEventListenersConfigured = true;
}

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

    const painel = document.getElementById('painelTvFundo');
    if (painel) {
        painel.style.zoom = '1';
        painel.style.overflowY = 'auto';
        painel.style.height = 'auto';
    }
    document.body.style.overflow = '';
    
    const btnSair = document.getElementById('btnSairTV');
    if (btnSair) btnSair.style.display = 'none';
};

window.iniciarRelogioTV = function() {
    atualizarRelogioTV();
    if (!window.tvClockInterval) {
        window.tvClockInterval = setInterval(atualizarRelogioTV, 1000);
    }
    
    if (window.tvInterval) clearInterval(window.tvInterval);
    
    // Roda a cada 15 segundos para avançar a página
    window.tvInterval = setInterval(() => {
        // Só avança a página se o carrossel NÃO estiver pausado (por causa de OS Concluída na tela)
        if (document.fullscreenElement && !window.tvPausarCarrossel) {
            window.tvPaginaAtual++; 
        }

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
        
        if ('speechSynthesis' in window) {
            window.speechSynthesis.resume();
            let u = new SpeechSynthesisUtterance('');
            u.volume = 0; 
            window.speechSynthesis.speak(u);
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
};

// ================== LÓGICA DE ESCALA MATEMÁTICA PURA ==================

window.ajustarEscalaTV = function() {
    const container = document.getElementById('tvCardsContainer');
    const painel = document.getElementById('painelTvFundo');
    if (!container || !painel) return;

    painel.style.zoom = "1";
    
    if (document.fullscreenElement) {
        painel.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        
        container.style.gridTemplateColumns = 'repeat(4, 1fr)';

        setTimeout(() => {
            const alturaTela = window.innerHeight;
            const alturaConteudo = painel.scrollHeight;

            if (alturaConteudo > 0) {
                let proporcao = (alturaTela / alturaConteudo) * 0.97;
                
                if (proporcao > 1.3) proporcao = 1.3;

                painel.style.zoom = proporcao.toFixed(4);
            }
        }, 50);

    } else {
        painel.style.overflowY = 'auto';
        document.body.style.overflow = '';
        container.style.gridTemplateColumns = 'repeat(auto-fit, minmax(420px, 1fr))';
    }
};

// ==============================================================================

function atualizarRelogioTV() {
    const elRelogio = document.getElementById('tvRelogio');
    const elData = document.getElementById('tvData');
    if (!elRelogio || !elData) return;
    
    const agora = new Date();
    elRelogio.innerText = agora.toLocaleTimeString('pt-BR');
    const opcoesData = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    elData.innerText = agora.toLocaleDateString('pt-BR', opcoesData).toUpperCase();

    const containerTV = document.getElementById('painelTvFundo');
    if (containerTV) {
        const hora = agora.getHours();
        if (hora >= 18 || hora < 6) {
            containerTV.classList.add('modo-noturno');
        } else {
            containerTV.classList.remove('modo-noturno');
        }
    }
}

window.renderizarCardsTV = function() {
    const container = document.getElementById('tvCardsContainer');
    if (!container) return;
    if (typeof ordensServico === 'undefined' || !ordensServico) return;

    let frotasValidas = [];
    if (typeof frotasManutencao !== 'undefined' && Array.isArray(frotasManutencao)) {
        frotasValidas = frotasManutencao.filter(f => f.status === 'Ativo' && f.categoria && f.categoria.toUpperCase() === 'TRITREM');
    }

    const agora = new Date();
    const hojeInicio = new Date(agora); hojeInicio.setHours(0,0,0,0);
    const hojeFim = new Date(agora); hojeFim.setHours(23,59,59,999);
    
    const osHoje = ordensServico.filter(o => {
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
    
    const totalOsHoje = osHoje.length;
    
    let tempoTotalDispMs = frotasValidas.length * 24 * 60 * 60 * 1000;
    let tempoManutencaoMs = 0;
    
    let veiculosManutencao = 0;
    let veiculosDisponiveis = 0;

    frotasValidas.forEach(frota => {
        const osAberta = ordensServico.find(o => o.placa === frota.cavalo && o.status !== 'Concluída' && o.status !== 'Agendada');
        if (osAberta) { veiculosManutencao++; } else { veiculosDisponiveis++; }

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
    
    // Filtro de O.S abertas ou recentemente concluídas
    const osAtivas = ordensServico.filter(o => {
        if (o.tipo === 'Sinistro') return false;

        if (o.status === 'Aguardando Oficina' || o.status === 'Em Manutenção') return true;

        if (o.status === 'Concluída' && o.data_conclusao) {
            const dataConclusao = new Date(String(o.data_conclusao).replace('Z', '').replace('+00:00', ''));
            const diffMinutos = (agora - dataConclusao) / (1000 * 60); 
            
            if (diffMinutos <= 3) {
                if (!window.osLiberadasAnunciadas.has(o.id)) {
                    window.osLiberadasAnunciadas.add(o.id);
                    let frotaVinculada = frotasValidas.find(f => 
                        (f.cavalo && String(f.cavalo).trim().toUpperCase() === String(o.placa).trim().toUpperCase()) || 
                        (f.go && String(f.go).trim().toUpperCase() === String(o.placa).trim().toUpperCase())
                    );
                    falarVeiculoLiberado(o.placa || '', frotaVinculada ? frotaVinculada.numero_frota : '');
                    
                    // FORÇA PULAR PARA A PRIMEIRA PÁGINA PARA MOSTRAR O VEÍCULO LIBERADO
                    window.tvPaginaAtual = 0; 
                }
                return true; 
            }
        }
        return false;
    });

    osAtivas.forEach(o => {
        if (o.status !== 'Concluída') {
            if (window.isFirstRenderTV) {
                window.osNovasAnunciadas.add(o.id);
            } else if (!window.osNovasAnunciadas.has(o.id)) {
                window.osNovasAnunciadas.add(o.id);
                falarNovaOS(o.numero_os || o.id, o.tipo || 'Manutenção', o.placa || 'Não informada');
                
                // FORÇA PULAR PARA A PRIMEIRA PÁGINA PARA MOSTRAR A NOVA O.S
                window.tvPaginaAtual = 0;
            }
        }
    });
    
    window.isFirstRenderTV = false;
    
    if (osAtivas.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh;">
                <h1 style="color: var(--ccol-green-bright); font-size: 4rem; margin: 0;">PÁTIO VAZIO</h1>
                <p style="color: #94a3b8; font-size: 2rem;">Nenhum veículo aguardando manutenção.</p>
            </div>
        `;
        window.tvPausarCarrossel = false;
        window.ajustarEscalaTV();
        return;
    }
    
    // Ordenação (Concluídas sempre ficam no topo/início da fila)
    osAtivas.sort((a, b) => {
        if (a.status === 'Concluída' && b.status !== 'Concluída') return -1;
        if (a.status !== 'Concluída' && b.status === 'Concluída') return 1;

        const pesoPri = { 'Urgente': 4, 'Alta': 3, 'Normal': 2, 'Baixa': 1 };
        const pA = pesoPri[a.prioridade] || 0;
        const pB = pesoPri[b.prioridade] || 0;
        if (pA !== pB) return pB - pA;
        return new Date(a.data_abertura) - new Date(b.data_abertura);
    });

    // ==============================================================
    // LÓGICA DE PAGINAÇÃO: MÁXIMO 8 CARDS POR TELA PARA TV CHEIA (4x2)
    // ==============================================================
    const MAX_CARDS_PAGINA = 8;
    const totalPaginas = Math.ceil(osAtivas.length / MAX_CARDS_PAGINA);

    if (window.tvPaginaAtual >= totalPaginas) {
        window.tvPaginaAtual = 0;
    }

    const osParaExibir = document.fullscreenElement 
        ? osAtivas.slice(window.tvPaginaAtual * MAX_CARDS_PAGINA, (window.tvPaginaAtual + 1) * MAX_CARDS_PAGINA)
        : osAtivas;

    // Trava o carrossel se tiver alguma O.S Concluída sendo exibida nesta página
    window.tvPausarCarrossel = osParaExibir.some(os => os.status === 'Concluída');

    let htmlCards = osParaExibir.map(os => {
        let corPrioridade = '#3b82f6'; 
        if (os.prioridade === 'Urgente') corPrioridade = '#ef4444';
        else if (os.prioridade === 'Alta') corPrioridade = '#f97316';
        else if (os.prioridade === 'Baixa') corPrioridade = '#10b981';
        
        let diffHrs = 0; let diffMin = 0; let entradaHoraStr = '--:--';
        if (os.data_abertura) {
            const inicio = new Date(String(os.data_abertura).replace('Z', '').replace('+00:00', ''));
            const tempoFim = (os.status === 'Concluída' && os.data_conclusao) ? new Date(String(os.data_conclusao).replace('Z', '').replace('+00:00', '')) : agora;
            
            const diffMs = tempoFim - inicio;
            if(diffMs > 0) {
                diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                diffMin = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            }
            entradaHoraStr = inicio.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        }
        
        let colorCronometro = '#fff'; let alertaClass = '';
        if (diffHrs >= 24) { colorCronometro = '#ef4444'; alertaClass = 'piscar-alerta'; } 
        else if (diffHrs >= 12) { colorCronometro = '#f59e0b'; }
        
        let frotaVinculada = {};
        if (typeof frotasManutencao !== 'undefined' && Array.isArray(frotasManutencao)) {
            frotaVinculada = frotasManutencao.find(f => 
                (f.cavalo && String(f.cavalo).trim().toUpperCase() === String(os.placa).trim().toUpperCase()) || 
                (f.go && String(f.go).trim().toUpperCase() === String(os.placa).trim().toUpperCase())
            ) || {};
        }

        let conjuntosBadge = '';

        if (frotaVinculada.numero_frota && String(frotaVinculada.numero_frota).trim() !== '') {
            conjuntosBadge += `<span style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; padding: 2px 6px; border-radius: 4px; font-size: 0.85rem; border: 1px solid rgba(245, 158, 11, 0.5); font-weight: bold; white-space: nowrap;">FR: ${String(frotaVinculada.numero_frota).toUpperCase()}</span>`;
        }
        
        if (frotaVinculada.go && String(frotaVinculada.go).trim() !== '') {
            conjuntosBadge += `<span style="background: rgba(59, 130, 246, 0.2); color: #93c5fd; padding: 2px 6px; border-radius: 4px; font-size: 0.85rem; border: 1px solid rgba(59, 130, 246, 0.5); font-weight: bold; white-space: nowrap;">GO: ${String(frotaVinculada.go).toUpperCase()}</span>`;
        }
        
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
                if(os.status !== 'Concluída') colorCronometro = '#10b981'; alertaClass = '';
            }
        } else {
             avisoPrevisao = `<div style="background: rgba(255,255,255,0.05); color: #94a3b8; padding: 5px; text-align: center; border-radius: 4px; margin-top: 10px; font-size: 0.9rem;">AGUARDANDO PREVISÃO</div>`;
        }
        
        let textoStatus = os.status === 'Em Manutenção' ? '🔧 EM OFICINA' : '🕑 AGUARDANDO ATENDIMENTO';
        let bgStatus = os.status === 'Em Manutenção' ? '#1e3a8a' : '#1e293b'; 
        let borderStatus = os.status === 'Em Manutenção' ? '#3b82f6' : '#475569'; 
        let nomeDoMecanico = os.mecanico_responsavel || os.mecanico || 'NÃO ATRIBUÍDO';

        if (os.status === 'Concluída') {
            textoStatus = '✅ VEÍCULO LIBERADO';
            bgStatus = 'rgba(16, 185, 129, 0.15)'; 
            borderStatus = '#10b981'; 
            alertaClass = 'card-liberado'; 
            avisoPrevisao = `<div style="background: #10b981; color: #ffffff; padding: 5px; text-align: center; border-radius: 4px; margin-top: 10px; font-size: 1.1rem; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; box-shadow: 0 0 10px rgba(16,185,129,0.5);">PRONTO PARA RODAR</div>`;
            colorCronometro = '#10b981'; 
        }
        
        if(alertaClass === 'piscar-alerta') alertaClass += ' piscar-alerta';

        return `
            <div class="${alertaClass}" style="background: ${bgStatus}; border: 3px solid ${borderStatus}; border-radius: 12px; padding: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); display: flex; flex-direction: column; transition: all 0.3s ease;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                    <div>
                        <div style="font-size: 1.05rem; color: #e2e8f0; font-weight: 600; margin-bottom: 5px;">O.S. #${os.numero_os || os.id} | ${textoStatus}</div>
                        <div style="font-size: 3rem; font-weight: 900; color: #fff; line-height: 1;">${os.placa || 'S/ PLACA'}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="background: ${corPrioridade}; color: #fff; font-weight: bold; padding: 5px 15px; border-radius: 20px; font-size: 1.1rem; text-transform: uppercase;">${os.prioridade || 'Normal'}</div>
                    </div>
                </div>
                
                <div style="margin-bottom: 15px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; width: 100%;">${conjuntosBadge}</div>
                
                <div style="background: rgba(0,0,0,0.4); border-radius: 8px; padding: 15px; margin-bottom: 15px; flex: 1;">
                    <div style="color: #60a5fa; font-weight: bold; font-size: 1.2rem; margin-bottom: 5px;">${os.tipo || '-'}</div>
                    <div style="color: #cbd5e1; font-size: 1.1rem;">Motorista: <strong style="color: #fff;">${os.motorista || '-'}</strong></div>
                    <div style="color: #cbd5e1; font-size: 1.1rem; margin-top: 5px;">Mecânico: <strong style="color: var(--ccol-green-bright); text-transform: uppercase;">${nomeDoMecanico}</strong></div>
                    <div style="color: #ffffff; font-size: 0.95rem; font-weight: 500; margin-top: 8px;">Detalhe: ${os.problema || 'Nenhum detalhe reportado'}</div>
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

    // Adiciona o indicador de página no rodapé apenas se houver mais de uma página na TV
    if (document.fullscreenElement && totalPaginas > 1) {
        let msgAviso = window.tvPausarCarrossel 
            ? `<span style="color: #10b981;">(Aguardando liberação de veículo...)</span>`
            : `<span style="font-size: 0.9rem; margin-left: 10px; font-weight: normal;">(Aguarde para ver a próxima...)</span>`;
            
        htmlCards += `
            <div style="grid-column: 1 / -1; text-align: center; color: #64748b; font-size: 1.3rem; margin-top: 15px; font-weight: bold; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                EXIBINDO PÁGINA ${window.tvPaginaAtual + 1} DE ${totalPaginas} ${msgAviso}
            </div>
        `;
    }

    container.innerHTML = htmlCards;

    window.ajustarEscalaTV();
};