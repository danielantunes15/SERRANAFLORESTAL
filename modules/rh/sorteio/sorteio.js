window.listaParaSorteio = [];
window.candidatosSorteioAtual = [];
window.vencedoresSorteio = [];
window.quantidadeSorteios = 1;

// Efeitos Sonoros Oficiais (Carregados via URL pública para evitar necessidade de arquivos locais)
window.audioRoletaSorteio = new Audio('https://actions.google.com/sounds/v1/science_fiction/spaceship_engine.ogg');
window.audioRoletaSorteio.loop = true;
window.audioVitoriaSorteio = new Audio('https://actions.google.com/sounds/v1/crowds/crowd_cheer.ogg');

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
    const filtroFuncao = document.getElementById('filtroFuncao').value.toLowerCase().trim();
    const filtroMes = document.getElementById('filtroMesAdmissao').value;
    
    window.quantidadeSorteios = parseInt(qtdInput);
    if (isNaN(window.quantidadeSorteios) || window.quantidadeSorteios <= 0) {
        alert('Por favor, insira uma quantidade válida de ganhadores.');
        return;
    }

    // Isola e clona a listagem para preservar integridade dos dados originais
    let candidatos = [...window.listaParaSorteio];

    // 1. Filtro de Plano de Saúde
    if (filtro === 'Ativos') {
        candidatos = candidatos.filter(c => c.plano_saude === 'Sim');
    } else if (filtro === 'NaoAtivos') {
        candidatos = candidatos.filter(c => c.plano_saude !== 'Sim');
    }

    // 2. Novo Filtro de Função
    if (filtroFuncao !== '') {
        candidatos = candidatos.filter(c => c.funcao && c.funcao.toLowerCase().includes(filtroFuncao));
    }

    // 3. Novo Filtro de Mês de Admissão
    if (filtroMes !== 'Todos') {
        candidatos = candidatos.filter(c => {
            if(!c.data_admissao) return false;
            const mesAdmissao = c.data_admissao.split('-')[1]; // Extrai apenas o mês do formato YYYY-MM-DD
            return mesAdmissao === filtroMes;
        });
    }

    if (candidatos.length === 0) {
        alert('Nenhum colaborador elegível localizado com os parâmetros informados (Função/Mês).');
        return;
    }

    if (window.quantidadeSorteios > candidatos.length) {
        alert(`Operação cancelada: O número de ganhadores solicitado (${window.quantidadeSorteios}) é superior ao volume de colaboradores filtrados disponíveis (${candidatos.length}).`);
        return;
    }

    // Remove botão de PDF antigo se existir da rodada anterior
    const btnPdfExistente = document.getElementById('btnGerarPDFSorteio');
    if (btnPdfExistente) btnPdfExistente.remove();

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
    try { window.audioRoletaSorteio.pause(); window.audioVitoriaSorteio.pause(); } catch(e){}
    document.getElementById('sorteioArena').style.display = 'none';
    document.getElementById('sorteioLobby').style.display = 'block';
};

window.resetarSorteio = function() {
    if(confirm("Deseja realmente resetar o sorteio atual? Isso limpará todos os ganhadores desta rodada e permitirá reconfigurar os filtros.")) {
        try { window.audioRoletaSorteio.pause(); window.audioVitoriaSorteio.pause(); } catch(e){}
        window.candidatosSorteioAtual = [];
        window.vencedoresSorteio = [];
        window.quantidadeSorteios = 1;
        
        document.getElementById('sorteioArena').style.display = 'none';
        document.getElementById('sorteioLobby').style.display = 'block';
        
        // Reseta valores de inputs para padrão
        document.getElementById('qtdSorteios').value = 1;
        document.getElementById('filtroPlanoSaude').value = 'Todos';
        document.getElementById('filtroFuncao').value = '';
        document.getElementById('filtroMesAdmissao').value = 'Todos';
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

    btnSortear.style.display = 'none';

    // Inicia Efeito Sonoro da Roleta (Garante que o som de vitória anterior pare)
    try { 
        window.audioVitoriaSorteio.pause();
        window.audioVitoriaSorteio.currentTime = 0;
        window.audioRoletaSorteio.play().catch(e => console.log("Áudio bloqueado pelo navegador")); 
    } catch(e){}

    // Parâmetros do Embaralhador
    let tempoTotalAnimacao = 3500; // Tempo aumentado para dar mais emoção com o áudio
    let intervaloFrame = 50;  
    let tempoDecorrido = 0;

    let loopRoletaMarquee = setInterval(() => {
        tempoDecorrido += intervaloFrame; 
        
        const idxFake = Math.floor(Math.random() * window.candidatosSorteioAtual.length);
        const candidatoVisual = window.candidatosSorteioAtual[idxFake];

        areaDestaque.innerHTML = `
            <div style="text-align: center; animation: pulseMarqueeFast 0.1s infinite alternate; box-sizing: border-box; max-width: 100%;">
                <i class="fas fa-sync-alt fa-spin fa-4x" style="color: var(--ccol-blue-bright); margin-bottom: 25px; filter: drop-shadow(0 0 20px rgba(96,165,250,0.5));"></i>
                <h2 style="color: #fff; font-size: 3.8rem; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; white-space: nowrap; max-width: 90vw; overflow: hidden; text-overflow: ellipsis; margin: 0;">${candidatoVisual.nome}</h2>
                <p style="color: var(--text-secondary); font-size: 1.6rem; margin-top: 10px; margin-bottom: 0; font-weight: 500;">Função: ${candidatoVisual.funcao || 'Operacional'}</p>
            </div>
        `;

        if (tempoDecorrido >= tempoTotalAnimacao) {
            clearInterval(loopRoletaMarquee);

            // Para o som de roleta e toca o de vitória
            try { 
                window.audioRoletaSorteio.pause(); 
                window.audioRoletaSorteio.currentTime = 0;
                window.audioVitoriaSorteio.play().catch(e => console.log("Áudio bloqueado"));
            } catch(e){}

            // Sorteio Real Oficial
            const indexReal = Math.floor(Math.random() * window.candidatosSorteioAtual.length);
            const vencedorDefinitivo = window.candidatosSorteioAtual[indexReal];

            // Remove o colaborador sorteado para evitar que ele ganhe 2x na mesma rodada
            window.candidatosSorteioAtual.splice(indexReal, 1);
            window.vencedoresSorteio.push(vencedorDefinitivo);

            const numGanhadorAtual = window.vencedoresSorteio.length;
            statusHeader.innerText = `Rodada em andamento • Sorteado ${numGanhadorAtual} de ${window.quantidadeSorteios}`;

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

            const placeholder = document.getElementById('placeholderVencedores');
            if (placeholder) placeholder.remove();

            const galeriaDiv = document.getElementById('listaVencedoresSorteio');
            const cardMini = document.createElement('div');
            
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

                // INJEÇÃO DA MELHORIA: Cria o botão de Baixar PDF ao lado do botão de concluir
                if (!document.getElementById('btnGerarPDFSorteio')) {
                    const btnPdf = document.createElement('button');
                    btnPdf.id = 'btnGerarPDFSorteio';
                    btnPdf.className = 'btn-primary-green';
                    btnPdf.style.cssText = 'font-size: 1.6rem; font-weight: 900; padding: 22px 40px; border-radius: 50px; box-shadow: 0 15px 35px rgba(61,220,132,0.35); cursor: pointer; border: none; display: inline-flex; align-items: center; gap: 15px; margin-left: 15px; transition: transform 0.2s;';
                    btnPdf.innerHTML = '<i class="fas fa-file-pdf"></i> GERAR PDF DO SORTEIO';
                    btnPdf.onmouseover = function() { this.style.transform = 'scale(1.05)'; };
                    btnPdf.onmouseout = function() { this.style.transform = 'scale(1)'; };
                    btnPdf.onclick = window.gerarRelatorioSorteioPDF;
                    
                    document.getElementById('containerBotoesSorteio').appendChild(btnPdf);
                }
            }
        }
    }, intervaloFrame);
};

// ================= LÓGICA DE EXPORTAÇÃO DO PDF =================
window.gerarRelatorioSorteioPDF = function() {
    if (window.vencedoresSorteio.length === 0) {
        alert("Nenhum ganhador para gerar o relatório.");
        return;
    }

    try {
        // Instancia a biblioteca jsPDF que já está importada no seu index.html
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Cabeçalho e Título do Documento
        doc.setFontSize(18);
        doc.setTextColor(41, 128, 185); // Cor azul da identidade visual
        doc.text("Relatório Oficial de Sorteio - Serrana Florestal", 14, 20);

        // Captura o texto exato dos filtros usados na rodada
        const selectFiltroPlano = document.getElementById('filtroPlanoSaude');
        const selectFiltroMes = document.getElementById('filtroMesAdmissao');
        const filtroPlano = selectFiltroPlano.options[selectFiltroPlano.selectedIndex].text;
        const filtroMes = selectFiltroMes.options[selectFiltroMes.selectedIndex].text;
        const filtroFuncao = document.getElementById('filtroFuncao').value || 'Todas as Funções';
        
        const dataAtual = new Date().toLocaleDateString('pt-BR');
        const horaAtual = new Date().toLocaleTimeString('pt-BR');

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Data da Realização: ${dataAtual} às ${horaAtual}`, 14, 30);
        doc.text(`Filtros Aplicados: Saúde (${filtroPlano}) | Mês (${filtroMes}) | Função (${filtroFuncao})`, 14, 36);
        doc.text(`Total de Vencedores na Rodada: ${window.vencedoresSorteio.length}`, 14, 42);

        // Preparar as linhas da tabela pegando o array de vencedores
        const linhas = window.vencedoresSorteio.map((v, index) => {
            const matricula = v.cod_funcionario ? String(v.cod_funcionario).padStart(4, '0') : 'N/A';
            return [
                index + 1, // Exibe o número da rodada (1º a sair, 2º a sair...)
                matricula,
                v.nome,
                v.funcao || 'Não informada'
            ];
        });

        // Desenhar a Tabela usando o plugin AutoTable
        doc.autoTable({
            startY: 48,
            head: [['Ordem Sorteio', 'Matrícula', 'Nome do Colaborador', 'Função / Cargo']],
            body: linhas,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] }, // Azul
            styles: { fontSize: 10 }
        });

        // Linha para assinatura do gestor no final da página
        const finalY = doc.lastAutoTable.finalY || 45;
        doc.text("________________________________________________", 105, finalY + 30, { align: 'center' });
        doc.text("Assinatura do Responsável (Recursos Humanos)", 105, finalY + 35, { align: 'center' });

        // Aciona o Download para o dispositivo do usuário
        doc.save(`Relatorio_Sorteio_Serrana_${new Date().getTime()}.pdf`);
        
    } catch (e) {
        console.error(e);
        alert('Erro ao gerar PDF. Verifique se a biblioteca jspdf foi carregada no index.html.');
    }
};