window.listaParaSorteio = [];
window.candidatosSorteioAtual = [];
window.vencedoresSorteio = [];
window.quantidadeSorteios = 1;

window.initRHSorteio = async function() {
    try {
        window.listaParaSorteio = await db.getColaboradores();
        // Filtra para manter em memória apenas colaboradores ativos no sistema
        window.listaParaSorteio = window.listaParaSorteio.filter(c => c.status !== 'Inativo');
    } catch(e) {
        console.error("Erro ao carregar colaboradores para sorteio:", e);
    }
};

window.prepararSorteio = function() {
    const qtdInput = document.getElementById('qtdSorteios').value;
    const filtro = document.getElementById('filtroPlanoSaude').value;
    
    window.quantidadeSorteios = parseInt(qtdInput);
    if (isNaN(window.quantidadeSorteios) || window.quantidadeSorteios <= 0) {
        alert('Por favor, insira uma quantidade válida de ganhadores.');
        return;
    }

    // Isola e clona a listagem para preservar integridade dos dados originais
    let candidatos = [...window.listaParaSorteio];

    // Aplicação dos filtros de plano de saúde
    if (filtro === 'Ativos') {
        candidatos = candidatos.filter(c => c.plano_saude === 'Sim');
    } else if (filtro === 'NaoAtivos') {
        candidatos = candidatos.filter(c => c.plano_saude !== 'Sim');
    }

    if (candidatos.length === 0) {
        alert('Nenhum colaborador elegível localizado com os parâmetros informados.');
        return;
    }

    if (window.quantidadeSorteios > candidatos.length) {
        alert(`Operação cancelada: O número de ganhadores solicitado (${window.quantidadeSorteios}) é superior ao volume de colaboradores filtrados disponíveis (${candidatos.length}).`);
        return;
    }

    // Configuração inicial dos estados da rodada atual
    window.candidatosSorteioAtual = candidatos;
    window.vencedoresSorteio = [];

    // Reset estrutural e preparação visual dos cabeçalhos da Arena
    document.getElementById('statusSorteioHeader').innerText = `Arena pronta • 0 de ${window.quantidadeSorteios} ganhadores definidos`;
    document.getElementById('listaVencedoresSorteio').innerHTML = `
        <p id="placeholderVencedores" style="color: var(--text-secondary); font-size: 0.9rem; font-style: italic; opacity: 0.5; padding-top: 8px; margin: 0;">Nenhum nome sorteado nesta rodada até o momento.</p>
    `;
    
    document.getElementById('areaDestaqueSorteio').innerHTML = `
        <div style="text-align: center; animation: terminalFadeIn 0.5s ease-out;">
            <i class="fas fa-play-circle fa-5x" style="color: rgba(255,255,255,0.07); margin-bottom: 20px;"></i>
            <p style="font-size: 1.5rem; color: #94a3b8; font-weight: 500; letter-spacing: 0.5px; margin: 0;">Painel de exibição carregado. Dispare o comando abaixo para iniciar.</p>
        </div>
    `;

    const btnSortear = document.getElementById('btnSortearProximo');
    btnSortear.style.display = 'inline-flex';
    btnSortear.onclick = window.sortearProximo;
    btnSortear.innerHTML = '<i class="fas fa-play-circle"></i> INICIAR PRIMEIRO SORTEIO';
    btnSortear.className = 'btn-primary-blue';
    
    // Ativa a exibição da tela cheia absoluta por cima de todo o app
    document.getElementById('sorteioLobby').style.display = 'none';
    document.getElementById('sorteioArena').style.display = 'flex';
};

window.fecharArenaSorteio = function() {
    if(window.vencedoresSorteio.length > 0 && window.vencedoresSorteio.length < window.quantidadeSorteios) {
        if(!confirm("Aviso: O ciclo de sorteios está em andamento. Deseja realmente sair e descartar o progresso atual?")) {
            return;
        }
    }
    document.getElementById('sorteioArena').style.display = 'none';
    document.getElementById('sorteioLobby').style.display = 'block';
};

window.resetarSorteio = function() {
    if(confirm("Deseja realmente resetar o sorteio atual? Isso limpará todos os ganhadores desta rodada e permitirá reconfigurar os filtros.")) {
        window.candidatosSorteioAtual = [];
        window.vencedoresSorteio = [];
        window.quantidadeSorteios = 1;
        
        // Retorna a interface ao estado inicial do lobby de parametrização
        document.getElementById('sorteioArena').style.display = 'none';
        document.getElementById('sorteioLobby').style.display = 'block';
        
        // Reseta valores de inputs para padrão de segurança
        document.getElementById('qtdSorteios').value = 1;
        document.getElementById('filtroPlanoSaude').value = 'Todos';
    }
};

window.sortearProximo = function() {
    if (window.vencedoresSorteio.length >= window.quantidadeSorteios) {
        alert("A cota estipulada de ganhadores para esta rodada já foi preenchida.");
        return;
    }

    const btnSortear = document.getElementById('btnSortearProximo');
    const areaDestaque = document.getElementById('areaDestaqueSorteio');
    const statusHeader = document.getElementById('statusSorteioHeader');

    // Remove temporariamente o botão da tela para focar o suspense visual
    btnSortear.style.display = 'none';

    // Parâmetros do Embaralhador Rápido de Nomes (Efeito Roleta)
    let tempoTotalAnimação = 2200; 
    let intervaloAtualizacao = 50;  
    let tempoDecorrido = 0;

    let loopRoletaMarquee = setInterval(() => {
        tempoDecorrido += intervaloAtualizacao;
        
        // Seleção aleatória rápida apenas para efeito de animação em tela cheia
        const idxFake = Math.floor(Math.random() * window.candidatosSorteioAtual.length);
        const candidatoVisual = window.candidatosSorteioAtual[idxFake];

        areaDestaque.innerHTML = `
            <div style="text-align: center; animation: pulseMarqueeFast 0.1s infinite alternate; box-sizing: border-box; max-width: 100%;">
                <i class="fas fa-sync-alt fa-spin fa-4x" style="color: var(--ccol-blue-bright); margin-bottom: 25px; filter: drop-shadow(0 0 20px rgba(96,165,250,0.5));"></i>
                <h2 style="color: #fff; font-size: 3.8rem; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; white-space: nowrap; max-width: 90vw; overflow: hidden; text-overflow: ellipsis; margin: 0;">${candidatoVisual.nome}</h2>
                <p style="color: var(--text-secondary); font-size: 1.6rem; margin-top: 10px; margin-bottom: 0; font-weight: 500;">Função: ${candidatoVisual.funcao || 'Operacional'}</p>
            </div>
        `;

        // Condição de parada do suspense: Seleciona e exibe o vencedor real
        if (tempoDecorrido >= tempoTotalAnimação) {
            clearInterval(loopRoletaMarquee);

            // Sorteio Real Oficial
            const indexReal = Math.floor(Math.random() * window.candidatosSorteioAtual.length);
            const vencedorDefinitivo = window.candidatosSorteioAtual[indexReal];

            // Remove o colaborador sorteado para evitar duplicidade na mesma rodada
            window.candidatosSorteioAtual.splice(indexReal, 1);
            window.vencedoresSorteio.push(vencedorDefinitivo);

            const numGanhadorAtual = window.vencedoresSorteio.length;
            statusHeader.innerText = `Rodada em andamento • Sorteado ${numGanhadorAtual} de ${window.quantidadeSorteios}`;

            // Apresentação Premium em Tela Cheia do Ganhador da Rodada
            areaDestaque.innerHTML = `
                <div style="text-align: center; animation: revealEpicCard 0.55s cubic-bezier(0.19, 1, 0.22, 1) forwards; background: rgba(61, 220, 132, 0.08); padding: 50px 70px; border-radius: 24px; border: 2px solid var(--ccol-green-bright); box-shadow: 0 0 60px rgba(61, 220, 132, 0.25); backdrop-filter: blur(12px); max-width: 850px; width: 100%; box-sizing: border-box;">
                    <div style="display: inline-flex; align-items: center; justify-content: center; width: 75px; height: 75px; background: rgba(245, 158, 11, 0.15); border-radius: 50%; margin-bottom: 20px; box-shadow: 0 0 20px rgba(245,158,11,0.25);">
                        <i class="fas fa-trophy" style="color: #f59e0b; font-size: 2.4rem;"></i>
                    </div>
                    <h2 style="color: #fb923c; font-size: 1.8rem; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin-top: 0; margin-bottom: 15px;">COLABORADOR PREMIADO #${numGanhadorAtual}</h2>
                    <h1 style="color: #fff; font-size: 4rem; font-weight: 900; text-transform: uppercase; margin-top: 0; margin-bottom: 20px; letter-spacing: -0.5px; text-shadow: 0 4px 15px rgba(0,0,0,0.7); line-height: 1.1; word-wrap: break-word;">${vencedorDefinitivo.nome}</h1>
                    
                    <div style="display: flex; justify-content: center; gap: 40px; margin-top: 25px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 25px; box-sizing: border-box;">
                        <div style="text-align: center;">
                            <span style="color:#94a3b8; font-size: 1rem; font-weight:normal; display:block; margin-bottom:5px; text-transform:uppercase; letter-spacing:1px;">Cargo / Função</span>
                            <strong style="color: var(--ccol-blue-bright); font-size: 1.6rem; font-weight: 700;">${vencedorDefinitivo.funcao || 'Não informada'}</strong>
                        </div>
                        <div style="text-align: center;">
                            <span style="color:#94a3b8; font-size: 1rem; font-weight:normal; display:block; margin-bottom:5px; text-transform:uppercase; letter-spacing:1px;">Matrícula</span>
                            <strong style="color: #fff; font-size: 1.6rem; font-weight: 700;">${vencedorDefinitivo.cod_funcionario ? String(vencedorDefinitivo.cod_funcionario).padStart(4, '0') : 'N/A'}</strong>
                        </div>
                    </div>
                </div>
            `;

            // Adiciona o mini card reativo na listagem inferior acumulada
            const placeholder = document.getElementById('placeholderVencedores');
            if (placeholder) placeholder.remove();

            const galeriaDiv = document.getElementById('listaVencedoresSorteio');
            const cardMini = document.createElement('div');
            
            // Simplificação nominal inteligente para exibição compacta nos cards inferiores
            const splitNome = vencedorDefinitivo.nome.split(' ');
            const nomeExibicao = splitNome.length > 1 ? `${splitNome[0]} ${splitNome[splitNome.length - 1]}` : splitNome[0];

            cardMini.style.cssText = 'background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(61, 220, 132, 0.35); border-radius: 10px; padding: 12px 20px; min-width: 190px; text-align: center; animation: terminalFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 4px 10px rgba(0,0,0,0.25); box-sizing: border-box;';
            cardMini.innerHTML = `
                <div style="color: var(--ccol-green-bright); font-weight: 800; font-size: 0.8rem; letter-spacing: 0.5px; margin-bottom: 4px;"><i class="fas fa-check-circle"></i> GANHADOR #${numGanhadorAtual}</div>
                <div style="color: #fff; font-weight: 700; font-size: 1.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${vencedorDefinitivo.nome}">${nomeExibicao}</div>
                <div style="color: #94a3b8; font-size: 0.8rem; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${vencedorDefinitivo.funcao || 'Colaborador'}</div>
            `;
            galeriaDiv.appendChild(cardMini);

            // Fluxo de decisão do botão operacional
            if (window.vencedoresSorteio.length < window.quantidadeSorteios) {
                btnSortear.style.display = 'inline-flex';
                btnSortear.innerHTML = `<i class="fas fa-forward"></i> SORTEAR GANHADOR #${numGanhadorAtual + 1}`;
            } else {
                statusHeader.innerHTML = `Sorteio Finalizado com Sucesso • <span style="color: var(--ccol-green-bright); font-weight: bold;">${window.quantidadeSorteios} Ganhadores Definidos</span>`;
                btnSortear.style.display = 'inline-flex';
                btnSortear.className = 'btn-secondary-dark';
                btnSortear.style.borderColor = 'var(--ccol-green-bright)';
                btnSortear.style.color = '#fff';
                btnSortear.innerHTML = '<i class="fas fa-check-double" style="color:var(--ccol-green-bright);"></i> CONCLUIR E FECHAR ARENA';
                btnSortear.onclick = window.fecharArenaSorteio;
            }
        }
    }, intervaloFrame);
};