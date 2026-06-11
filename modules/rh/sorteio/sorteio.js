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

    // Aplicação dos filtros dinâmicos
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
        alert(`Operação cancelada: O número de ganhadores solicitado (${window.quantidadeSorteios}) é superior ao volume de colaboradores filtrados (${candidatos.length}).`);
        return;
    }

    // Configuração dos estados de execução da rodada
    window.candidatosSorteioAtual = candidatos;
    window.vencedoresSorteio = [];

    // Atualização da UI para transição de tela cheia
    document.getElementById('statusSorteioHeader').innerText = `Aguardando início • 0 de ${window.quantidadeSorteios} definidos`;
    document.getElementById('listaVencedoresSorteio').innerHTML = `
        <p id="placeholderVencedores" style="color: var(--text-secondary); font-size: 0.9rem; font-style: italic; opacity: 0.6; padding-top: 10px;">Nenhum nome sorteado nesta rodada até o momento.</p>
    `;
    
    document.getElementById('areaDestaqueSorteio').innerHTML = `
        <div style="text-align: center; animation: terminalFadeIn 0.6s ease-out;">
            <i class="fas fa-play-circle fa-5x" style="color: rgba(255,255,255,0.1); margin-bottom: 25px;"></i>
            <p style="font-size: 1.4rem; color: #94a3b8; font-weight: 500; letter-spacing: 0.5px;">Sistema configurado. Clique no comando abaixo para girar a roleta.</p>
        </div>
    `;

    const btnSortear = document.getElementById('btnSortearProximo');
    btnSortear.style.display = 'inline-flex';
    btnSortear.innerHTML = '<i class="fas fa-play-circle"></i> INICIAR PRIMEIRO SORTEIO';
    btnSortear.className = 'btn-primary-blue';
    
    // Transiciona visualmente os painéis
    document.getElementById('sorteioLobby').style.display = 'none';
    document.getElementById('sorteioArena').style.display = 'flex';
};

window.fecharArenaSorteio = function() {
    if(window.vencedoresSorteio.length > 0 && window.vencedoresSorteio.length < window.quantidadeSorteios) {
        if(!confirm("Aviso: O ciclo de sorteios está em andamento. Deseja realmente interromper e descartar esta rodada?")) {
            return;
        }
    }
    document.getElementById('sorteioArena').style.display = 'none';
    document.getElementById('sorteioLobby').style.style = 'flex';
    document.getElementById('sorteioLobby').style.display = 'flex';
};

window.sortearProximo = function() {
    if (window.vencedoresSorteio.length >= window.quantidadeSorteios) {
        alert("A cota estipulada de ganhadores para esta rodada já foi preenchida.");
        return;
    }

    const btnSortear = document.getElementById('btnSortearProximo');
    const areaDestaque = document.getElementById('areaDestaqueSorteio');
    const statusHeader = document.getElementById('statusSorteioHeader');

    // Desativa temporariamente a interação do botão durante o suspense
    btnSortear.style.display = 'none';

    // Parâmetros do loop do suspense (Embaralhador Visual Rápido)
    let tempoExecucao = 2200; // Tempo total da animação de roleta rápida (2.2 segundos)
    let intervaloFrame = 50;  // Atualização a cada 50ms para efeito fluido de Marquee
    let tempoDecorrido = 0;

    let loopSuspense = setInterval(() => {
        tempoDecorrido += intervaloFrame;
        
        // Escolhe um candidato aleatório temporário apenas para exibição rápida na tela
        const idxFake = Math.floor(Math.random() * window.candidatosSorteioAtual.length);
        const candidatoVisual = window.candidatosSorteioAtual[idxFake];

        areaDestaque.innerHTML = `
            <div style="text-align: center; animation: pulseSuspenseMarquee 0.1s infinite alternate;">
                <i class="fas fa-sync-alt fa-spin fa-4x" style="color: var(--ccol-blue-bright); margin-bottom: 25px; filter: drop-shadow(0 0 15px rgba(96,165,250,0.4));"></i>
                <h2 style="color: #fff; font-size: 3.5rem; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; white-space: nowrap; max-width: 90vw; overflow: hidden; text-overflow: ellipsis;">${candidatoVisual.nome}</h2>
                <p style="color: var(--text-secondary); font-size: 1.6rem; margin-top: 8px; font-weight: 500;">Função: ${candidatoVisual.funcao || 'Operacional'}</p>
            </div>
        `;

        // Condição de parada: Fim do suspense, revela o verdadeiro ganhador
        if (tempoDecorrido >= tempoExecucao) {
            clearInterval(loopSuspense);

            // Sorteio Real Definitivo
            const indexReal = Math.floor(Math.random() * window.candidatosSorteioAtual.length);
            const vencedorDefinitivo = window.candidatosSorteioAtual[indexReal];

            // Remove o colaborador sorteado da lista ativa para não ser duplicado
            window.candidatosSorteioAtual.splice(indexReal, 1);
            window.vencedoresSorteio.push(vencedorDefinitivo);

            const numGanhadorAtual = window.vencedoresSorteio.length;
            statusHeader.innerText = `Rodada em andamento • Sorteado ${numGanhadorAtual} de ${window.quantidadeSorteios}`;

            // Apresentação de Alta Fidelidade do Vencedor na Tela Cheia
            areaDestaque.innerHTML = `
                <div style="text-align: center; animation: revealWinnerCard 0.6s cubic-bezier(0.19, 1, 0.22, 1) forwards; background: rgba(61, 220, 132, 0.08); padding: 50px 70px; border-radius: 24px; border: 2px solid var(--ccol-green-bright); box-shadow: 0 0 60px rgba(61, 220, 132, 0.25); backdrop-filter: blur(12px); max-width: 850px; width: 100%;">
                    <div style="display: inline-flex; align-items: center; justify-content: center; width: 70px; height: 70px; background: rgba(245, 158, 11, 0.15); border-radius: 50%; margin-bottom: 20px; box-shadow: 0 0 20px rgba(245,158,11,0.2);">
                        <i class="fas fa-trophy" style="color: #f59e0b; font-size: 2.2rem;"></i>
                    </div>
                    <h2 style="color: #fb923c; font-size: 1.8rem; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 15px;">COLABORADOR PREMIADO #${numGanhadorAtual}</h2>
                    <h1 style="color: #fff; font-size: 4rem; font-weight: 900; text-transform: uppercase; margin-bottom: 15px; letter-spacing: -0.5px; text-shadow: 0 4px 12px rgba(0,0,0,0.6);">${vencedorDefinitivo.nome}</h1>
                    <div style="display: flex; justify-content: center; gap: 30px; margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px;">
                        <p style="color: var(--ccol-blue-bright); font-size: 1.5rem; font-weight: 600;"><span style="color:#94a3b8; font-size: 1.1rem; font-weight:normal; display:block; margin-bottom:3px; text-transform:uppercase; letter-spacing:1px;">Cargo / Função</span>${vencedorDefinitivo.funcao || 'Não informada'}</p>
                        <p style="color: #fff; font-size: 1.5rem; font-weight: 600;"><span style="color:#94a3b8; font-size: 1.1rem; font-weight:normal; display:block; margin-bottom:3px; text-transform:uppercase; letter-spacing:1px;">Matrícula</span>${vencedorDefinitivo.cod_funcionario ? String(vencedorDefinitivo.cod_funcionario).padStart(4, '0') : 'N/A'}</p>
                    </div>
                </div>
            `;

            // Atualiza a galeria inferior de cards acumulados
            const placeholder = document.getElementById('placeholderVencedores');
            if (placeholder) placeholder.remove();

            const galeriaDiv = document.getElementById('listaVencedoresSorteio');
            const cardMini = document.createElement('div');
            
            // Tratamento simplificado de string para o mini card inferior
            const splitNome = vencedorDefinitivo.nome.split(' ');
            const nomeExibicao = splitNome.length > 1 ? `${splitNome[0]} ${splitNome[splitNome.length - 1]}` : splitNome[0];

            cardMini.style.cssText = 'background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(61, 220, 132, 0.4); border-radius: 10px; padding: 12px 20px; min-width: 200px; text-align: center; animation: terminalFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 4px 10px rgba(0,0,0,0.2);';
            cardMini.innerHTML = `
                <div style="color: var(--ccol-green-bright); font-weight: 800; font-size: 0.8rem; letter-spacing: 0.5px; margin-bottom: 4px;"><i class="fas fa-check-circle"></i> GANHADOR #${numGanhadorAtual}</div>
                <div style="color: #fff; font-weight: 700; font-size: 1.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${vencedorDefinitivo.nome}">${nomeExibicao}</div>
                <div style="color: #94a3b8; font-size: 0.8rem; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${vencedorDefinitivo.funcao || 'Colaborador'}</div>
            `;
            galeriaDiv.appendChild(cardMini);

            // Reconfiguração do fluxo de botões para os próximos passos
            if (window.vencedoresSorteio.length < window.quantidadeSorteios) {
                btnSortear.style.display = 'inline-flex';
                btnSortear.innerHTML = `<i class="fas fa-forward"></i> SORTEAR GANHADOR #${numGanhadorAtual + 1}`;
            } else {
                statusHeader.innerHTML = `Sorteio Finalizado com Sucesso • <span style="color: var(--ccol-green-bright); font-weight: bold;">${window.quantidadeSorteios} Ganhadores Definidos</span>`;
                btnSortear.style.display = 'inline-flex';
                btnSortear.className = 'btn-secondary-dark';
                btnSortear.style.borderColor = 'var(--ccol-green-bright)';
                btnSortear.innerHTML = '<i class="fas fa-check-double" style="color:var(--ccol-green-bright);"></i> CONCLUIR E FECHAR ARENA';
                btnSortear.onclick = window.fecharArenaSorteio;
            }
        }
    }, intervaloFrame);
};