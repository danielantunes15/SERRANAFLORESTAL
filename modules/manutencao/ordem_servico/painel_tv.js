// ==================== modules/manutencao/ordem_servico/painel_tv.js ====================
// Gerenciador exclusivo do Modo TV (Imersivo), Relógio, Cards e Anúncios por Voz

// Conjuntos para evitar que a TV fale duas vezes o mesmo aviso
if (!window.osLiberadasAnunciadas) {
    window.osLiberadasAnunciadas = new Set();
}
if (!window.osNovasAnunciadas) {
    window.osNovasAnunciadas = new Set();
    window.isFirstRenderTV = true; // Previne que a TV anuncie todas as OS antigas ao ligar
}

// Funções de Síntese de Voz (Falar no Auto-falante da TV)
window.falarVeiculoLiberado = function(placa, frota) {
    if ('speechSynthesis' in window) {
        let placaFalada = String(placa).split('').join(' ');
        let texto = `Atenção Pátio! Veículo placa ${placaFalada} , liberado da oficina.`;
        if (frota && frota !== '') {
            texto += ` Número da Frota: ${frota}.`;
        }

        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        utterance.rate = 0.85; 
        utterance.pitch = 1;
        utterance.volume = 1;
        
        window.speechSynthesis.speak(utterance);
    }
};

window.falarNovaOS = function(numero, tipo, placa) {
    if ('speechSynthesis' in window) {
        let placaFalada = String(placa).split('').join(' ');
        
        let tipoLimpo = String(tipo).replace('Manutenção', '').replace('- P.A Serrana', '').trim();
        if (tipoLimpo === '') tipoLimpo = 'Manutenção';

        let texto = `Atenção Oficina! Nova Ordem de Serviço número ${numero}. Serviço de ${tipoLimpo}, para o veículo placa ${placaFalada}.`;

        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        utterance.rate = 0.85; 
        utterance.pitch = 1;
        utterance.volume = 1;
        
        window.speechSynthesis.speak(utterance);
    }
};

if (!window.tvEventListenersConfigured) {
    window.addEventListener('resize', () => {
        if (document.fullscreenElement && typeof renderizarCardsTV === 'function') renderizarCardsTV();
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
        
        if ('speechSynthesis' in window) {
            let u = new SpeechSynthesisUtterance('');
            u.volume = 0; window.speechSynthesis.speak(u);
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
};

window.ajustarEscalaTV = function() {
    const container = document.getElementById('tvCardsContainer');
    const painel = document.getElementById('painelTvFundo');
    if (!container || !painel) return;

    const isFullscreen = !!document.fullscreenElement;

    // Reset antes do cálculo para medir o tamanho real ocupado pelos cartões
    painel.style.zoom = "1";
    painel.style.height = 'auto';
    painel.style.overflowY = 'auto';
    document.body.style.overflow = '';
    
    // Volta o CSS Original para garantir que não distorça
    container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(450px, 1fr))';
    container.style.alignContent = 'start';
    container.style.alignItems = 'start';

    if (!isFullscreen) return;

    // Oculta a barra de rolagem
    document.body.style.overflow = 'hidden';
    painel.style.overflowY = 'hidden';

    setTimeout(() => {
        const wH = window.innerHeight;
        // Pega a altura total do painel
        const h = painel.scrollHeight + 20; 

        if (h > wH && wH > 0) {
            const z = wH / h;
            painel.style.zoom = z.toFixed(4);
            // Corrige o bug de corte: O height do painel precisa aumentar na mesma proporção do zoom
            painel.style.height = (100 / z).toFixed(2) + 'vh';
        } else {
            painel.style.height = '100vh';
        }
    }, 50);
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
    if (!container) return;
    if (typeof ordensServico === 'undefined' || !ordensServico) return;

    let frotasValidas = [];
    if (typeof frotasManutencao !== 'undefined' && Array.isArray(frotasManutencao)) {
        frotasValidas = frotasManutencao.filter(f => f.status === 'Ativo' && f.categoria && f.categoria.toUpperCase() === 'TRITREM');
    }

    const placasExibicao = [];
    if (typeof frotasManutencao !== 'undefined' && Array.isArray(frotasManutencao)) {
        frotasManutencao.forEach(f => {
            if (f.status === 'Ativo' && f.categoria && f.categoria.toUpperCase() === 'TRITREM') {
                if (f.cavalo) placasExibicao.push(String(f.cavalo).trim().toUpperCase());
            }
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
    
    // Filtro Melhorado: Agora inclui OS concluídas nos últimos 3 MINUTOS para fazer o efeito de Saída
    const osAtivas = ordensServico.filter(o => {
        if (o.tipo === 'Sinistro') return false;

        const placaOS = o.placa ? String(o.placa).trim().toUpperCase() : '';
        const ehApenasGO = (o.motorista && String(o.motorista).trim().toUpperCase() === 'N/A (APENAS GO)');

        if (!placasExibicao.includes(placaOS) && !ehApenasGO) return false;
        if (o.status === 'Aguardando Oficina' || o.status === 'Em Manutenção') return true;

        if (o.status === 'Concluída' && o.data_conclusao) {
            const dataConclusao = new Date(String(o.data_conclusao).replace('Z', '').replace('+00:00', ''));
            const diffMinutos = (agora - dataConclusao) / (1000 * 60); 
            
            if (diffMinutos <= 3) {
                if (!window.osLiberadasAnunciadas.has(o.id)) {
                    window.osLiberadasAnunciadas.add(o.id);
                    let frotaVinculada = frotasValidas.find(f => 
                        (f.cavalo && String(f.cavalo).trim().toUpperCase() === placaOS) || 
                        (f.go && String(f.go).trim().toUpperCase() === placaOS)
                    );
                    falarVeiculoLiberado(placaOS, frotaVinculada ? frotaVinculada.numero_frota : '');
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
            }
        }
    });
    window.isFirstRenderTV = false;
    
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
        if (a.status === 'Concluída' && b.status !== 'Concluída') return -1;
        if (a.status !== 'Concluída' && b.status === 'Concluída') return 1;

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
        
        let textoStatus = os.status === 'Em Manutenção' ? '  EM OFICINA' : '  AGUARDANDO ATENDIMENTO';
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

        // O HTML DE VOLTA AO SEU ESTADO ORIGINAL! Flexível, sem quebrar.
        return `
            <div class="${alertaClass}" style="background: ${bgStatus}; border: 3px solid ${borderStatus}; border-radius: 12px; padding: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); display: flex; flex-direction: column; transition: all 0.3s ease;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                    <div>
                        <div style="font-size: 1rem; color: #94a3b8; margin-bottom: 5px;">O.S. #${os.numero_os || os.id} | ${textoStatus}</div>
                        <div style="font-size: 3rem; font-weight: 900; color: #fff; line-height: 1;">${os.placa}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="background: ${corPrioridade}; color: #fff; font-weight: bold; padding: 5px 15px; border-radius: 20px; font-size: 1.1rem; text-transform: uppercase;">${os.prioridade}</div>
                    </div>
                </div>
                
                <div style="margin-bottom: 15px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; width: 100%;">${conjuntosBadge}</div>
                
                <div style="background: rgba(0,0,0,0.4); border-radius: 8px; padding: 15px; margin-bottom: 15px; flex: 1;">
                    <div style="color: #60a5fa; font-weight: bold; font-size: 1.2rem; margin-bottom: 5px;">${os.tipo}</div>
                    <div style="color: #cbd5e1; font-size: 1.1rem;">Motorista: <strong style="color: #fff;">${os.motorista}</strong></div>
                    <div style="color: #cbd5e1; font-size: 1.1rem; margin-top: 5px;">Mecânico: <strong style="color: var(--ccol-green-bright); text-transform: uppercase;">${nomeDoMecanico}</strong></div>
                    <div style="color: #94a3b8; font-size: 0.9rem; margin-top: 8px;">Detalhe: ${os.problema || 'Nenhum detalhe reportado'}</div>
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

    setTimeout(window.ajustarEscalaTV, 50);
};