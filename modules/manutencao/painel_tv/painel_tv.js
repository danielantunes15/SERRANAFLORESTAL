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
    window.tvAudioMudo = false; // Controle de áudio (Mudo/Ativo)
}

// ================== PREPARAÇÃO DA API DE VOZ ==================
if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = function() {
        window.speechSynthesis.getVoices();
    };
}

// ================== CONTROLE DE ÁUDIO ==================
window.toggleAudioTV = function() {
    window.tvAudioMudo = !window.tvAudioMudo;
    const btn = document.getElementById('btnTvAudio');
    if (btn) {
        if (window.tvAudioMudo) {
            btn.classList.add('muted');
            btn.innerHTML = '<i class="fas fa-volume-mute"></i> Som Mudo';
            if ('speechSynthesis' in window) window.speechSynthesis.cancel();
            window.isGongoTocando = false;
        } else {
            btn.classList.remove('muted');
            btn.innerHTML = '<i class="fas fa-volume-up"></i> Som Ativo';
            if ('speechSynthesis' in window) {
                let u = new SpeechSynthesisUtterance('');
                u.volume = 0;
                window.speechSynthesis.speak(u);
            }
        }
    }
};

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

        setTimeout(() => {
            if (callback) callback();
        }, 1600);
    } catch (e) {
        console.warn("Aviso: Falha ao tocar o gongo inicial.", e);
        if (callback) callback();
    }
}

function anunciarComGongo(texto) {
    if (window.tvAudioMudo) return;
    if (!('speechSynthesis' in window)) return;

    const executarVoz = () => {
        if (window.tvAudioMudo) {
            window.isGongoTocando = false;
            return;
        }
        window.speechSynthesis.cancel();

        setTimeout(() => {
            const utterance = new SpeechSynthesisUtterance(texto);
            utterance.lang = 'pt-BR';
            utterance.rate = 0.85;
            utterance.pitch = 1;
            utterance.volume = 1;

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

            window.speechSynthesis.resume();

            utterance.onerror = function(e) {
                console.warn("Erro na síntese de voz:", e);
                window.isGongoTocando = false;
            };

            utterance.onend = function() {
                window.isGongoTocando = false;
            };

            window.speechSynthesis.speak(utterance);

            if (window.speechSynthesis.isPaused) {
                window.speechSynthesis.resume();
            }
        }, 100);
    };

    if (window.isGongoTocando || window.speechSynthesis.speaking) {
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
        const btnFull = document.getElementById('btnTvFullScreen');
        if (btnFull) {
            btnFull.innerHTML = document.fullscreenElement
                ? '<i class="fas fa-compress"></i> Sair da Tela Cheia'
                : '<i class="fas fa-expand"></i> Tela Cheia';
        }
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
        btnSair.style.cssText = 'position: fixed; bottom: 18px; right: 18px; z-index: 9999; background: rgba(239, 68, 68, 0.9); backdrop-filter: blur(6px); color: white; border: 1px solid rgba(255,255,255,0.2); padding: 10px 20px; border-radius: 10px; font-weight: 700; font-size: 0.95rem; cursor: pointer; box-shadow: 0 6px 18px rgba(0,0,0,0.45); transition: all 0.2s;';
        btnSair.onmouseover = () => btnSair.style.background = '#dc2626';
        btnSair.onmouseout = () => btnSair.style.background = 'rgba(239, 68, 68, 0.9)';
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

    // INTERVALO 1: Avança a página do carrossel (a cada 15 segundos)
    window.tvInterval = setInterval(() => {
        if (document.fullscreenElement && !window.tvPausarCarrossel) {
            window.tvPaginaAtual++;
            if (typeof renderizarCardsTV === 'function') renderizarCardsTV();
        }
    }, 15000);

    // INTERVALO 2: Busca otimizada no Supabase (a cada 30 segundos)
    window.tvFetchInterval = setInterval(async () => {
        if (document.hidden) return;

        if (window.supabaseClient) {
            try {
                const hoje = new Date();
                hoje.setHours(0, 0, 0, 0);
                const dataHojeStr = hoje.toISOString();

                let query = window.supabaseClient.from('ordens_servico')
                    .select('id, numero_os, placa, tipo, status, prioridade, data_abertura, data_conclusao, previsao_entrega, previsao, mecanico_responsavel, mecanico, problema, motorista')
                    .eq('inativa', 0)
                    .or(`status.neq.Concluída,data_conclusao.gte.${dataHojeStr}`);

                if (typeof window.aplicarFiltroFilial === 'function') {
                    query = window.aplicarFiltroFilial(query);
                }

                const { data, error } = await query;

                if (!error && data) {
                    window.ordensServico = data;
                    if (typeof renderizarCardsTV === 'function') renderizarCardsTV();
                } else {
                    throw error;
                }
            } catch (e) {
                console.error("Erro na busca inteligente da TV:", e);
                if (typeof carregarDadosOS === 'function') {
                    await carregarDadosOS();
                    if (typeof renderizarCardsTV === 'function') renderizarCardsTV();
                }
            }
        } else {
            if (typeof carregarDadosOS === 'function') {
                await carregarDadosOS();
                if (typeof renderizarCardsTV === 'function') renderizarCardsTV();
            }
        }
    }, 30000);
};

window.toggleFullScreenTV = function() {
    if ('speechSynthesis' in window && !window.tvAudioMudo) {
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
        painel.style.height = '100vh';
        document.body.style.overflow = 'hidden';

        container.style.alignContent = 'stretch';
        container.style.gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
        container.style.gridTemplateRows = 'repeat(2, minmax(0, 1fr))';
    } else {
        painel.style.overflowY = 'auto';
        painel.style.height = 'auto';
        document.body.style.overflow = '';
        container.style.gridTemplateColumns = 'repeat(auto-fit, minmax(360px, 1fr))';
        container.style.gridTemplateRows = 'auto';
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

    let frotasAtivas = [];
    if (typeof frotasManutencao !== 'undefined' && Array.isArray(frotasManutencao)) {
        frotasAtivas = frotasManutencao.filter(f => f.status === 'Ativo');
    }

    const frotasValidas = frotasAtivas.filter(f => f.categoria && f.categoria.toUpperCase() === 'TRITREM');
    const frotasGruas = frotasAtivas.filter(f => f.categoria && f.categoria.toUpperCase() === 'GRUA');

    const agora = new Date();
    const hojeInicio = new Date(agora); hojeInicio.setHours(0, 0, 0, 0);
    const hojeFim = new Date(agora); hojeFim.setHours(23, 59, 59, 999);

    const osHoje = ordensServico.filter(o => {
        if (o.tipo === 'Sinistro') return false;

        let dIni = o.data_abertura ? new Date(String(o.data_abertura).replace('Z', '').replace('+00:00', '')) : null;
        let dFim = o.data_conclusao ? new Date(String(o.data_conclusao).replace('Z', '').replace('+00:00', '')) : null;
        if (!dIni) return false;

        if (dIni >= hojeInicio && dIni <= hojeFim) return true;
        if (dFim && dFim >= hojeInicio && dFim <= hojeFim) return true;
        if (!dFim && dIni < hojeInicio) return true;
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
            if (!osIni) return;

            let overlapInicio = osIni > hojeInicio ? osIni : hojeInicio;
            let overlapFim = osFim < hojeFim ? osFim : hojeFim;

            if (overlapInicio < overlapFim && os.status !== 'Agendada') {
                tempoManutencaoMs += (overlapFim - overlapInicio);
            }
        });
    });

    if (tempoManutencaoMs > tempoTotalDispMs) tempoManutencaoMs = tempoTotalDispMs;
    const dmDiaNum = tempoTotalDispMs > 0 ? (((tempoTotalDispMs - tempoManutencaoMs) / tempoTotalDispMs) * 100) : 100;
    const dmDia = dmDiaNum.toFixed(1);

    let gruasManutencao = 0;
    let gruasDisponiveis = 0;
    frotasGruas.forEach(frota => {
        const osAberta = ordensServico.find(o => o.placa === frota.cavalo && o.status !== 'Concluída' && o.status !== 'Agendada');
        if (osAberta) { gruasManutencao++; } else { gruasDisponiveis++; }
    });

    // Atualização dos KPIs
    if (document.getElementById('tvKpiTotal')) document.getElementById('tvKpiTotal').innerText = totalOsHoje;
    if (document.getElementById('tvKpiAbertas')) document.getElementById('tvKpiAbertas').innerText = abertasHoje;
    if (document.getElementById('tvKpiFechadas')) document.getElementById('tvKpiFechadas').innerText = fechadasHoje;

    const elDM = document.getElementById('tvKpiDM');
    if (elDM) {
        elDM.innerText = dmDia + '%';
        elDM.classList.remove('kpi-text-green', 'kpi-text-amber', 'kpi-text-red');
        if (dmDiaNum >= 90) elDM.classList.add('kpi-text-green');
        else if (dmDiaNum >= 80) elDM.classList.add('kpi-text-amber');
        else elDM.classList.add('kpi-text-red');
    }

    if (document.getElementById('tvKpiDisponiveis')) document.getElementById('tvKpiDisponiveis').innerText = veiculosDisponiveis;
    if (document.getElementById('tvKpiEmManutencao')) document.getElementById('tvKpiEmManutencao').innerText = veiculosManutencao;
    if (document.getElementById('tvKpiGruasDisponiveis')) document.getElementById('tvKpiGruasDisponiveis').innerText = gruasDisponiveis;
    if (document.getElementById('tvKpiGruasManutencao')) document.getElementById('tvKpiGruasManutencao').innerText = gruasManutencao;

    const osAtivas = ordensServico.filter(o => {
        if (o.tipo === 'Sinistro') return false;
        if (o.status === 'Aguardando Oficina' || o.status === 'Em Manutenção') return true;

        if (o.status === 'Concluída' && o.data_conclusao) {
            const dataConclusao = new Date(String(o.data_conclusao).replace('Z', '').replace('+00:00', ''));
            const diffMinutos = (agora - dataConclusao) / (1000 * 60);

            if (diffMinutos <= 3) {
                if (!window.osLiberadasAnunciadas.has(o.id)) {
                    window.osLiberadasAnunciadas.add(o.id);
                    let frotaVinculada = frotasAtivas.find(f =>
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
            <div class="tv-empty-state">
                <i class="fas fa-check-circle"></i>
                <h1>PÁTIO VAZIO</h1>
                <p>Nenhum veículo aguardando manutenção no momento.</p>
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

        let diffHrs = 0;
        let diffMin = 0;
        let entradaHoraStr = '--:--';

        if (os.data_abertura) {
            const inicio = new Date(String(os.data_abertura).replace('Z', '').replace('+00:00', ''));
            const tempoFim = (os.status === 'Concluída' && os.data_conclusao)
                ? new Date(String(os.data_conclusao).replace('Z', '').replace('+00:00', ''))
                : agora;

            const diffMs = tempoFim - inicio;
            if (diffMs > 0) {
                diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                diffMin = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            }
            entradaHoraStr = inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }

        let colorCronometro = '#ffffff';
        let alertaClass = '';
        if (diffHrs >= 24) {
            colorCronometro = '#f87171';
            alertaClass = 'piscar-alerta';
        } else if (diffHrs >= 12) {
            colorCronometro = '#fbbf24';
        }

        let frotaVinculada = {};
        if (typeof frotasManutencao !== 'undefined' && Array.isArray(frotasManutencao)) {
            frotaVinculada = frotasManutencao.find(f =>
                (f.cavalo && String(f.cavalo).trim().toUpperCase() === String(os.placa).trim().toUpperCase()) ||
                (f.go && String(f.go).trim().toUpperCase() === String(os.placa).trim().toUpperCase())
            ) || {};
        }

        const isCategoriaDiferente = frotaVinculada.categoria && String(frotaVinculada.categoria).toUpperCase() !== 'TRITREM';

        let conjuntosBadge = '';
        if (frotaVinculada.numero_frota && String(frotaVinculada.numero_frota).trim() !== '') {
            conjuntosBadge += `<span class="tv-badge tv-badge-fr">FR: ${String(frotaVinculada.numero_frota).toUpperCase()}</span>`;
        }
        if (frotaVinculada.go && String(frotaVinculada.go).trim() !== '') {
            conjuntosBadge += `<span class="tv-badge tv-badge-go">GO: ${String(frotaVinculada.go).toUpperCase()}</span>`;
        }
        conjuntosBadge += [frotaVinculada.carreta1, frotaVinculada.carreta2, frotaVinculada.carreta3]
            .filter(Boolean)
            .map(c => `<span class="tv-badge tv-badge-carreta">${c}</span>`)
            .join('');

        let avisoPrevisao = '';
        let campoPrevisao = os.previsao_entrega || os.previsao;
        if (campoPrevisao) {
            const dataPrevisao = new Date(String(campoPrevisao).replace('Z', '').replace('+00:00', ''));
            if (agora > dataPrevisao) {
                avisoPrevisao = `<div class="tv-previsao-bar tv-previsao-vencida">⚠️ PREVISÃO VENCIDA: ${formatarDataHoraBrasil(campoPrevisao)}</div>`;
            } else {
                avisoPrevisao = `<div class="tv-previsao-bar tv-previsao-ok">⏱️ PREVISÃO: ${formatarDataHoraBrasil(campoPrevisao)}</div>`;
                if (os.status !== 'Concluída') colorCronometro = '#34d399';
                alertaClass = '';
            }
        } else {
            avisoPrevisao = `<div class="tv-previsao-bar tv-previsao-aguardando">AGUARDANDO PREVISÃO</div>`;
        }

        let textoStatus = os.status === 'Em Manutenção' ? '🔧 EM MANUTENÇÃO' : '🕑 AGUARDANDO ATENDIMENTO';
        let statusClass = os.status === 'Em Manutenção' ? 'status-manutencao' : 'status-aguardando';
        let categoriaClass = isCategoriaDiferente ? 'categoria-especial' : '';
        let nomeDoMecanico = os.mecanico_responsavel || os.mecanico || 'NÃO ATRIBUÍDO';

        if (os.status === 'Concluída') {
            textoStatus = '✅ VEÍCULO LIBERADO';
            statusClass = 'status-liberado';
            categoriaClass = '';
            alertaClass = 'card-liberado';
            avisoPrevisao = `<div class="tv-previsao-bar tv-previsao-liberado">PRONTO PARA RODAR</div>`;
            colorCronometro = '#34d399';
        }

        return `
            <article class="tv-card ${statusClass} ${categoriaClass} ${alertaClass}">
                <div class="tv-card-top">
                    <div class="tv-card-id-block">
                        <div class="tv-card-meta">O.S. #${os.numero_os || os.id} • ${textoStatus}</div>
                        <div class="tv-card-placa">${os.placa || 'S/ PLACA'}</div>
                    </div>
                    <span class="tv-priority-pill" style="background: ${corPrioridade};">${os.prioridade || 'Normal'}</span>
                </div>

                <div class="tv-badges-row">${conjuntosBadge}</div>

                <div class="tv-card-body">
                    <div class="tv-card-tipo">${os.tipo || '-'}</div>
                    <div class="tv-card-info">Motorista: <strong>${os.motorista || '-'}</strong></div>
                    <div class="tv-card-info tv-card-mecanico">Mecânico: <strong>${nomeDoMecanico}</strong></div>
                    <div class="tv-card-detalhe">Detalhe: ${os.problema || 'Nenhum detalhe reportado'}</div>
                </div>

                <div class="tv-card-footer">
                    <div class="tv-entrada-box">
                        ENTRADA
                        <strong>${entradaHoraStr}</strong>
                    </div>
                    <div class="tv-tempo-box">
                        <div class="tv-tempo-label">TEMPO NO PÁTIO</div>
                        <div class="tv-tempo-valor" style="color: ${colorCronometro};">${String(diffHrs).padStart(2, '0')}:${String(diffMin).padStart(2, '0')}</div>
                    </div>
                </div>

                <div class="tv-previsao-wrap">${avisoPrevisao}</div>
            </article>
        `;
    }).join('');

    container.innerHTML = htmlCards;

    // Paginação com dots e barra de progresso
    if (document.fullscreenElement && totalPaginas > 1) {
        let dotsHtml = '';
        for (let i = 0; i < totalPaginas; i++) {
            dotsHtml += `<span class="tv-pag-dot ${i === window.tvPaginaAtual ? 'active' : ''}"></span>`;
        }

        let msgAviso = window.tvPausarCarrossel
            ? `<span style="color: #34d399; font-weight: 600;">(Pausado — Veículo liberado na tela)</span>`
            : `<span style="color: #64748b; font-weight: 500;">(Alternância automática a cada 15s)</span>`;

        if (pagContainer) {
            pagContainer.innerHTML = `
                <div class="tv-pagination-bar">
                    <div class="tv-pag-info">
                        <span>PÁGINA ${window.tvPaginaAtual + 1} DE ${totalPaginas}</span>
                        ${msgAviso}
                    </div>
                    <div class="tv-pag-dots">${dotsHtml}</div>
                    <div class="tv-pag-progress ${window.tvPausarCarrossel ? 'paused' : ''}"></div>
                </div>
            `;
            pagContainer.style.display = 'block';
        }
    } else {
        if (pagContainer) {
            pagContainer.innerHTML = '';
            pagContainer.style.display = 'none';
        }
    }

    window.ajustarEscalaTV();
};