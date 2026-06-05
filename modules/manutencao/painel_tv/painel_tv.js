// ==================== modules/manutencao/painel_tv/painel_tv.js ====================
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

// ================== PREPARAÇÃO DA API DE VOZ ==================
// Força o navegador a pré-carregar as vozes assim que o script é lido
if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = function() {
        window.speechSynthesis.getVoices();
    };
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

        // Notas do Gongo
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

        // Aguarda o término exato do gongo antes de chamar a voz
        setTimeout(() => {
            if (callback) callback();
        }, 1600);

    } catch (e) {
        console.warn("Aviso: Falha ao tocar o gongo inicial.", e);
        if (callback) callback(); // Se falhar o gongo, tenta falar mesmo assim
    }
}

function anunciarComGongo(texto) {
    if (!('speechSynthesis' in window)) return;

    const executarVoz = () => {
        // Limpa a fila presa (muito comum no Chrome)
        window.speechSynthesis.cancel(); 
        
        // Timeout de 100ms vital para dar tempo ao navegador de limpar a fila antes de adicionar uma nova
        setTimeout(() => {
            const utterance = new SpeechSynthesisUtterance(texto);
            utterance.lang = 'pt-BR';
            utterance.rate = 0.85; 
            utterance.pitch = 1;
            utterance.volume = 1;

            // Busca agressiva por qualquer voz em português disponível na máquina
            const vozes = window.speechSynthesis.getVoices();
            const vozBR = vozes.find(v => 
                v.lang.toLowerCase() === 'pt-br' || 
                v.lang.toLowerCase() === 'pt_br' || 
                v.name.toLowerCase().includes('brasil') ||
                v.name.toLowerCase().includes('portuguese')
            );
            
            if (vozBR) {
                utterance.voice = vozBR;
            }

            // Força a engine a acordar logo antes e depois de falar
            window.speechSynthesis.resume();
            
            utterance.onerror = function(e) {
                console.warn("Erro na síntese de voz:", e);
                window.isGongoTocando = false;
            };

            utterance.onend = function() {
                window.isGongoTocando = false;
            };

            window.speechSynthesis.speak(utterance);
            
            // Hack para navegadores que dormem durante a fala
            if (window.speechSynthesis.isPaused) {
                window.speechSynthesis.resume();
            }
        }, 100);
    };

    if (window.isGongoTocando || window.speechSynthesis.speaking) {
        // Se já estiver tocando algo, agenda a fala para o próximo ciclo
        setTimeout(() => anunciarComGongo(texto), 2000);
        return;
    }

    window.isGongoTocando = true;
    
    tocarGongoSintetizado(() => {
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
    if (window.tvFetchInterval) { clearInterval(window.tvFetchInterval); window.tvFetchInterval = null; }
    if (window.tvClockInterval) { clearInterval(window.tvClockInterval); window.tvClockInterval = null; }
    
    // Libera a voz e interrompe caso algo esteja tocando
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    window.isGongoTocando = false;

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
    if (window.tvFetchInterval) clearInterval(window.tvFetchInterval);
    
    // INTERVALO 1: Apenas para avançar a página (Roda a cada 15 segundos)
    window.tvInterval = setInterval(() => {
        if (document.fullscreenElement && !window.tvPausarCarrossel) {
            window.tvPaginaAtual++; 
            if (typeof renderizarCardsTV === 'function') renderizarCardsTV();
        }
    }, 15000); 

    // INTERVALO 2: Busca novidades no banco quase instantaneamente (Roda a cada 4 segundos)
    window.tvFetchInterval = setInterval(() => {
        if(typeof carregarDadosOS === 'function') {
            carregarDadosOS().then(() => {
                if (typeof renderizarCardsTV === 'function') renderizarCardsTV();
            });
        }
    }, 4000);
};

window.toggleFullScreenTV = function() {
    // DESPERTADOR DA API DE VOZ: Toca uma fala vazia para desbloquear o áudio do navegador por interação humana
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        let u = new SpeechSynthesisUtterance('');
        u.volume = 0; 
        window.speechSynthesis.speak(u);
        window.speechSynthesis.resume();
    }

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

// ================== LÓGICA DE ESCALA INTELIGENTE (FLEX GRID) ==================

window.ajustarEscalaTV = function() {
    const container = document.getElementById('tvCardsContainer');
    const painel = document.getElementById('painelTvFundo');
    if (!container || !painel) return;

    painel.style.zoom = "1";
    
    if (document.fullscreenElement) {
        painel.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        
        container.style.alignContent = 'stretch';
        container.style.gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
        
        // Força sempre 2 linhas no layout de tela cheia, 
        // independentemente da quantidade de cards. Assim eles não esticam!
        container.style.gridTemplateRows = 'repeat(2, minmax(0, 1fr))';

    } else {
        painel.style.overflowY = 'auto';
        document.body.style.overflow = '';
        container.style.gridTemplateColumns = 'repeat(auto-fit, minmax(380px, 1fr))';
        container.style.gridTemplateRows = 'auto';
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
    const pagContainer = document.getElementById('tvPaginationContainer');
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
                window.tvPaginaAtual = 0;
            }
        }
    });
    
    window.isFirstRenderTV = false;
    
    if (osAtivas.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                <h1 style="color: var(--ccol-green-bright); font-size: clamp(2rem, 5vw, 4rem); margin: 0;">PÁTIO VAZIO</h1>
                <p style="color: #94a3b8; font-size: clamp(1rem, 2.5vw, 2rem);">Nenhum veículo aguardando manutenção.</p>
            </div>
        `;
        if (pagContainer) pagContainer.style.display = 'none';
        window.tvPausarCarrossel = false;
        window.ajustarEscalaTV();
        return;
    }
    
    osAtivas.sort((a, b) => {
        if (a.status === 'Concluída' && b.status !== 'Concluída') return -1;
        if (a.status !== 'Concluída' && b.status === 'Concluída') return 1;

        const pesoPri = { 'Urgente': 4, 'Alta': 3, 'Normal': 2, 'Baixa': 1 };
        const pA = pesoPri[a.prioridade] || 0;
        const pB = pesoPri[b.prioridade] || 0;
        if (pA !== pB) return pB - pA;
        return new Date(a.data_abertura) - new Date(b.data_abertura);
    });

    const MAX_CARDS_PAGINA = 8;
    const totalPaginas = Math.ceil(osAtivas.length / MAX_CARDS_PAGINA);

    if (window.tvPaginaAtual >= totalPaginas) {
        window.tvPaginaAtual = 0;
    }

    const osParaExibir = document.fullscreenElement 
        ? osAtivas.slice(window.tvPaginaAtual * MAX_CARDS_PAGINA, (window.tvPaginaAtual + 1) * MAX_CARDS_PAGINA)
        : osAtivas;

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
            conjuntosBadge += `<span style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; padding: 2px 6px; border-radius: 4px; font-size: clamp(0.7rem, 1.2vh, 0.85rem); border: 1px solid rgba(245, 158, 11, 0.5); font-weight: bold; white-space: nowrap;">FR: ${String(frotaVinculada.numero_frota).toUpperCase()}</span>`;
        }
        
        if (frotaVinculada.go && String(frotaVinculada.go).trim() !== '') {
            conjuntosBadge += `<span style="background: rgba(59, 130, 246, 0.2); color: #93c5fd; padding: 2px 6px; border-radius: 4px; font-size: clamp(0.7rem, 1.2vh, 0.85rem); border: 1px solid rgba(59, 130, 246, 0.5); font-weight: bold; white-space: nowrap;">GO: ${String(frotaVinculada.go).toUpperCase()}</span>`;
        }
        
        conjuntosBadge += [frotaVinculada.carreta1, frotaVinculada.carreta2, frotaVinculada.carreta3]
            .filter(Boolean)
            .map(c => `<span style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-size: clamp(0.7rem, 1.2vh, 0.85rem); border: 1px solid rgba(255,255,255,0.2); white-space: nowrap;">${c}</span>`).join('');
            
        let avisoPrevisao = ''; let campoPrevisao = os.previsao_entrega || os.previsao;
        if (campoPrevisao) {
            const dataPrevisao = new Date(String(campoPrevisao).replace('Z', '').replace('+00:00', ''));
            if (agora > dataPrevisao) {
                avisoPrevisao = `<div style="background: #ef4444; color: #fff; padding: 4px; text-align: center; font-weight: bold; border-radius: 4px; font-size: clamp(0.85rem, 1.5vh, 1.05rem); border: 2px solid #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">⚠️ PREVISÃO VENCIDA: ${formatarDataHoraBrasil(campoPrevisao)}</div>`;
            } else {
                avisoPrevisao = `<div style="background: #10b981; color: #ffffff; padding: 4px; text-align: center; border-radius: 4px; font-size: clamp(0.85rem, 1.5vh, 1.05rem); font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">PREVISÃO: ${formatarDataHoraBrasil(campoPrevisao)}</div>`;
                if(os.status !== 'Concluída') colorCronometro = '#10b981'; alertaClass = '';
            }
        } else {
             avisoPrevisao = `<div style="background: rgba(255,255,255,0.05); color: #94a3b8; padding: 4px; text-align: center; border-radius: 4px; font-size: clamp(0.8rem, 1.4vh, 0.95rem); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">AGUARDANDO PREVISÃO</div>`;
        }
        
        let textoStatus = os.status === 'Em Manutenção' ? '🔧 EM OFICINA' : '🕑 AGUARDANDO ATENDIMENTO';
        let bgStatus = os.status === 'Em Manutenção' ? '#1e3a8a' : '#1e293b'; 
        let borderStatus = os.status === 'Em Manutenção' ? '#3b82f6' : '#475569'; 
        let nomeDoMecanico = os.mecanico_responsavel || os.mecanico || 'NÃO ATRIBUÍDO';

        if (os.status === 'Concluída') {
            textoStatus = '✅ VEÍCULO LIBERADO';
            bgStatus = 'rgba(16, 185, 129, 0.15)'; borderStatus = '#10b981'; alertaClass = 'card-liberado'; 
            avisoPrevisao = `<div style="background: #10b981; color: #ffffff; padding: 4px; text-align: center; border-radius: 4px; font-size: clamp(1rem, 1.8vh, 1.2rem); font-weight: bold; text-transform: uppercase; letter-spacing: 2px; box-shadow: 0 0 10px rgba(16,185,129,0.5); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">PRONTO PARA RODAR</div>`;
            colorCronometro = '#10b981'; 
        }
        
        if(alertaClass === 'piscar-alerta') alertaClass += ' piscar-alerta';

        return `
            <div class="${alertaClass}" style="background: ${bgStatus}; border: 3px solid ${borderStatus}; border-radius: 12px; padding: clamp(10px, 1.5vh, 20px); box-shadow: 0 10px 25px rgba(0,0,0,0.5); display: flex; flex-direction: column; height: 100%; box-sizing: border-box; transition: all 0.3s ease; overflow: hidden;">
                
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.8vh;">
                    <div style="flex: 1; min-width: 0; padding-right: 10px;">
                        <div style="font-size: clamp(0.85rem, 1.5vh, 1.05rem); color: #e2e8f0; font-weight: 600; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">O.S. #${os.numero_os || os.id} | ${textoStatus}</div>
                        <div style="font-size: clamp(2rem, 3.8vh, 3.2rem); font-weight: 900; color: #fff; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${os.placa || 'S/ PLACA'}</div>
                    </div>
                    <div style="text-align: right; flex-shrink: 0;">
                        <div style="background: ${corPrioridade}; color: #fff; font-weight: bold; padding: 4px 12px; border-radius: 20px; font-size: clamp(0.8rem, 1.5vh, 1.1rem); text-transform: uppercase;">${os.prioridade || 'Normal'}</div>
                    </div>
                </div>
                
                <div style="margin-bottom: 1vh; display: flex; gap: 4px; flex-wrap: wrap; align-items: center; width: 100%; overflow: hidden; flex-shrink: 0;">${conjuntosBadge}</div>
                
                <div style="background: rgba(0,0,0,0.4); border-radius: 8px; padding: clamp(8px, 1.2vh, 15px); margin-bottom: 1vh; flex: 1; display: flex; flex-direction: column; justify-content: center; min-height: 0; overflow: hidden;">
                    <div style="color: #60a5fa; font-weight: bold; font-size: clamp(1rem, 1.8vh, 1.3rem); margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${os.tipo || '-'}</div>
                    <div style="color: #cbd5e1; font-size: clamp(0.85rem, 1.5vh, 1.15rem); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Motorista: <strong style="color: #fff;">${os.motorista || '-'}</strong></div>
                    <div style="color: #cbd5e1; font-size: clamp(0.85rem, 1.5vh, 1.15rem); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Mecânico: <strong style="color: var(--ccol-green-bright); text-transform: uppercase;">${nomeDoMecanico}</strong></div>
                    <div style="color: #ffffff; font-size: clamp(0.8rem, 1.4vh, 1.05rem); font-weight: 500; margin-top: 6px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;">Detalhe: ${os.problema || 'Nenhum detalhe reportado'}</div>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1vh; flex-shrink: 0;">
                    <div style="color: #94a3b8; font-size: clamp(0.85rem, 1.4vh, 1.05rem);">Entrada: <br><strong style="color: #fff; font-size: clamp(1rem, 1.8vh, 1.2rem);">${entradaHoraStr}</strong></div>
                    <div style="text-align: right;">
                        <div style="font-size: clamp(0.75rem, 1.2vh, 0.95rem); color: #94a3b8; margin-bottom: 2px;">TEMPO NO PÁTIO</div>
                        <div style="font-size: clamp(1.8rem, 3.5vh, 2.6rem); font-weight: 900; color: ${colorCronometro}; font-family: monospace; line-height: 1;">${String(diffHrs).padStart(2,'0')}:${String(diffMin).padStart(2,'0')}</div>
                    </div>
                </div>
                <div style="margin-top: 1vh; flex-shrink: 0;">${avisoPrevisao}</div>
            </div>
        `;
    }).join('');

    container.innerHTML = htmlCards;

    // Lógica da Paginação renderizada no div isolado na base da tela
    if (document.fullscreenElement && totalPaginas > 1) {
        let msgAviso = window.tvPausarCarrossel 
            ? `<span style="color: #10b981; margin-left: 10px; font-weight: normal;">(Aguardando liberação...)</span>`
            : `<span style="font-size: clamp(0.7rem, 1.2vh, 0.9rem); margin-left: 10px; font-weight: normal;">(Aguarde para ver a próxima...)</span>`;
            
        if(pagContainer) {
            pagContainer.innerHTML = `
                <div style="text-align: center; color: #64748b; font-size: clamp(0.9rem, 1.6vh, 1.3rem); font-weight: bold; padding: 0.8vh; background: rgba(0,0,0,0.3); border-radius: 8px; display: flex; align-items: center; justify-content: center; width: 100%;">
                    EXIBINDO PÁGINA ${window.tvPaginaAtual + 1} DE ${totalPaginas} ${msgAviso}
                </div>
            `;
            pagContainer.style.display = 'block';
        }
    } else {
        if(pagContainer) {
            pagContainer.innerHTML = '';
            pagContainer.style.display = 'none';
        }
    }

    window.ajustarEscalaTV();
};