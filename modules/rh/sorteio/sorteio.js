window.listaParaSorteio = [];
window.candidatosSorteioAtual = [];
window.vencedoresSorteio = [];
window.quantidadeSorteios = 1;

// Gerenciamento Local de Prêmios
window.listaPremiosLocal = [];

// Efeitos Sonoros Oficiais
window.audioRoletaSorteio = new Audio('https://actions.google.com/sounds/v1/science_fiction/spaceship_engine.ogg');
window.audioRoletaSorteio.loop = true;
window.audioVitoriaSorteio = new Audio('https://actions.google.com/sounds/v1/crowds/crowd_cheer.ogg');

window.initRHSorteio = async function() {
    try {
        window.listaParaSorteio = await db.getColaboradores();
        window.listaParaSorteio = window.listaParaSorteio.filter(c => c.status !== 'Inativo');
        window.renderizarPremiosLobby();
    } catch(e) {
        console.error("Erro ao carregar colaboradores:", e);
    }
};

// ================= GESTÃO DOS PRÊMIOS (LOBBY) =================
window.adicionarPremioLocal = function() {
    const nome = document.getElementById('inputPremioNome').value.trim();
    const qtd = parseInt(document.getElementById('inputPremioQtd').value);

    if(!nome || isNaN(qtd) || qtd <= 0) {
        alert("⚠️ Por favor, informe o nome do prêmio e uma quantidade válida maior que zero.");
        return;
    }

    window.listaPremiosLocal.push({
        id: 'premio_' + new Date().getTime(),
        nome: nome,
        qtdOriginal: qtd,
        qtdAtual: qtd // Este valor vai diminuindo durante o sorteio
    });

    document.getElementById('inputPremioNome').value = '';
    document.getElementById('inputPremioQtd').value = '1';
    window.renderizarPremiosLobby();
};

window.removerPremioLocal = function(id) {
    window.listaPremiosLocal = window.listaPremiosLocal.filter(p => p.id !== id);
    window.renderizarPremiosLobby();
};

window.renderizarPremiosLobby = function() {
    const div = document.getElementById('listaPremiosLobby');
    
    if(window.listaPremiosLocal.length === 0) {
        div.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.8rem; margin: 0; font-style: italic; text-align: center;">Nenhum prêmio adicionado. (Será um sorteio simples de nomes)</p>';
        return;
    }

    div.innerHTML = '';
    window.listaPremiosLocal.forEach(p => {
        div.innerHTML += `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3); padding: 8px 15px; border-radius: 8px; border: 1px solid rgba(251, 146, 60, 0.2);">
                <span style="color: #fff; font-size: 0.95rem; font-weight: bold;"><i class="fas fa-gift" style="color: var(--ccol-rust-bright); margin-right: 8px;"></i> ${p.nome}</span>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span style="background: var(--ccol-rust-bright); color: #000; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 900;">${p.qtdOriginal} unidades</span>
                    <button class="btn-icon-only" onclick="window.removerPremioLocal('${p.id}')" style="padding: 0!important; color: #ef4444;" title="Remover Prêmio"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        `;
    });
};

// ================= PREPARAÇÃO E FILTROS =================
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

    let candidatos = [...window.listaParaSorteio];

    if (filtro === 'Ativos') {
        candidatos = candidatos.filter(c => c.plano_saude === 'Sim');
    } else if (filtro === 'NaoAtivos') {
        candidatos = candidatos.filter(c => c.plano_saude !== 'Sim');
    }

    if (filtroFuncao !== '') {
        candidatos = candidatos.filter(c => c.funcao && c.funcao.toLowerCase().includes(filtroFuncao));
    }

    if (filtroMes !== 'Todos') {
        candidatos = candidatos.filter(c => {
            if(!c.data_admissao) return false;
            const mesAdmissao = c.data_admissao.split('-')[1];
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

    const btnPdfExistente = document.getElementById('btnGerarPDFSorteio');
    if (btnPdfExistente) btnPdfExistente.remove();

    window.candidatosSorteioAtual = candidatos;
    window.vencedoresSorteio = [];

    // Prepara o Dropdown de Prêmios na Arena
    const seletorDiv = document.getElementById('containerSeletorPremio');
    if (window.listaPremiosLocal.length > 0) {
        seletorDiv.style.display = 'block';
        window.atualizarDropdownPremiosArena();
    } else {
        seletorDiv.style.display = 'none';
    }

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
    
    document.getElementById('sorteioLobby').style.display = 'none';
    document.getElementById('sorteioArena').style.display = 'flex';
};

window.atualizarDropdownPremiosArena = function() {
    const selectPremio = document.getElementById('selectPremioRodada');
    const valorAtual = selectPremio.value;

    let html = `<option value="aleatorio">🎲 SURPRESA / ALEATÓRIO</option>`;
    html += `<option value="nenhum">Nenhum (Apenas Sortear Nome)</option>`;
    
    window.listaPremiosLocal.forEach(p => {
        if (p.qtdAtual > 0) {
            html += `<option value="${p.id}">${p.nome} (${p.qtdAtual} restantes)</option>`;
        } else {
            html += `<option value="${p.id}" disabled>${p.nome} (ESGOTADO)</option>`;
        }
    });

    selectPremio.innerHTML = html;

    // Mantém a opção que estava selecionada se ela não esgotou
    if (valorAtual) {
        const opcaoAntiga = selectPremio.querySelector(`option[value="${valorAtual}"]`);
        if (opcaoAntiga && !opcaoAntiga.disabled) {
            selectPremio.value = valorAtual;
        } else {
            selectPremio.value = 'aleatorio';
        }
    }
};

window.fecharArenaSorteio = function() {
    if(window.vencedoresSorteio.length > 0 && window.vencedoresSorteio.length < window.quantidadeSorteios) {
        if(!confirm("Aviso: O ciclo de sorteios está em andamento. Deseja sair e descartar o progresso atual?")) {
            return;
        }
    }
    try { window.audioRoletaSorteio.pause(); window.audioVitoriaSorteio.pause(); } catch(e){}
    document.getElementById('sorteioArena').style.display = 'none';
    document.getElementById('sorteioLobby').style.display = 'block';
};

window.resetarSorteio = function() {
    if(confirm("Deseja resetar o sorteio? Isso limpará os ganhadores e restaurará as quantidades originais dos prêmios.")) {
        try { window.audioRoletaSorteio.pause(); window.audioVitoriaSorteio.pause(); } catch(e){}
        window.candidatosSorteioAtual = [];
        window.vencedoresSorteio = [];
        window.quantidadeSorteios = 1;
        
        // Restaura a quantidade dos prêmios
        window.listaPremiosLocal.forEach(p => p.qtdAtual = p.qtdOriginal);
        window.renderizarPremiosLobby();
        
        document.getElementById('sorteioArena').style.display = 'none';
        document.getElementById('sorteioLobby').style.display = 'block';
    }
};

// ================= EXECUÇÃO DO SORTEIO =================
window.sortearProximo = function() {
    if (window.vencedoresSorteio.length >= window.quantidadeSorteios) {
        alert("A cota estipulada de ganhadores para esta rodada já foi preenchida.");
        return;
    }

    // Lógica para capturar qual prêmio o usuário escolheu no Dropdown da Arena
    let premioDestaRodada = null;
    let objPremioRef = null;

    if (window.listaPremiosLocal.length > 0) {
        const selectPremio = document.getElementById('selectPremioRodada');
        let premioEscolhido = selectPremio.value;

        if (premioEscolhido === 'aleatorio') {
            const premiosDisponiveis = window.listaPremiosLocal.filter(p => p.qtdAtual > 0);
            if (premiosDisponiveis.length > 0) {
                const idxRnd = Math.floor(Math.random() * premiosDisponiveis.length);
                objPremioRef = premiosDisponiveis[idxRnd];
            } else {
                alert("⚠️ Todos os prêmios cadastrados já se esgotaram!");
                return;
            }
        } else if (premioEscolhido !== 'nenhum') {
            objPremioRef = window.listaPremiosLocal.find(p => p.id === premioEscolhido);
        }

        if (objPremioRef && objPremioRef.qtdAtual <= 0) {
            alert("⚠️ Este prêmio já esgotou! Escolha outro no menu acima.");
            return;
        }

        if (objPremioRef) {
            premioDestaRodada = objPremioRef.nome;
        }
    }

    const btnSortear = document.getElementById('btnSortearProximo');
    const areaDestaque = document.getElementById('areaDestaqueSorteio');
    const statusHeader = document.getElementById('statusSorteioHeader');

    btnSortear.style.display = 'none';
    document.getElementById('containerSeletorPremio').style.display = 'none'; // Esconde seletor durante a animação

    try { 
        window.audioVitoriaSorteio.pause();
        window.audioVitoriaSorteio.currentTime = 0;
        window.audioRoletaSorteio.play().catch(e => console.log("Áudio bloqueado")); 
    } catch(e){}

    let tempoTotalAnimacao = 3500; 
    let intervaloFrame = 50;  
    let tempoDecorrido = 0;

    let loopRoletaMarquee = setInterval(() => {
        tempoDecorrido += intervaloFrame; 
        
        const idxFake = Math.floor(Math.random() * window.candidatosSorteioAtual.length);
        const candidatoVisual = window.candidatosSorteioAtual[idxFake];

        let htmlAnimacao = `
            <div style="text-align: center; animation: pulseMarqueeFast 0.1s infinite alternate; box-sizing: border-box; max-width: 100%;">
                <i class="fas fa-sync-alt fa-spin fa-4x" style="color: var(--ccol-blue-bright); margin-bottom: 25px; filter: drop-shadow(0 0 20px rgba(96,165,250,0.5));"></i>
        `;
        
        // Exibe o prêmio rodando junto se houver
        if (premioDestaRodada) {
            htmlAnimacao += `<div style="color: var(--ccol-rust-bright); font-size: 1.3rem; font-weight: 800; margin-bottom: 10px; text-transform: uppercase;">🎁 Sorteando: ${premioDestaRodada}</div>`;
        }

        htmlAnimacao += `
                <h2 style="color: #fff; font-size: 3.8rem; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; white-space: nowrap; max-width: 90vw; overflow: hidden; text-overflow: ellipsis; margin: 0;">${candidatoVisual.nome}</h2>
                <p style="color: var(--text-secondary); font-size: 1.6rem; margin-top: 10px; margin-bottom: 0; font-weight: 500;">Função: ${candidatoVisual.funcao || 'Operacional'}</p>
            </div>
        `;
        areaDestaque.innerHTML = htmlAnimacao;

        if (tempoDecorrido >= tempoTotalAnimacao) {
            clearInterval(loopRoletaMarquee);

            try { 
                window.audioRoletaSorteio.pause(); 
                window.audioRoletaSorteio.currentTime = 0;
                window.audioVitoriaSorteio.play().catch(e => console.log("Áudio bloqueado"));
            } catch(e){}

            // Define o Vencedor
            const indexReal = Math.floor(Math.random() * window.candidatosSorteioAtual.length);
            const vencedorDefinitivo = window.candidatosSorteioAtual[indexReal];

            window.candidatosSorteioAtual.splice(indexReal, 1);
            
            // Associação e Desconto do Prêmio na Memória
            if (objPremioRef) {
                objPremioRef.qtdAtual--;
                vencedorDefinitivo.premio_ganho = objPremioRef.nome;
                window.atualizarDropdownPremiosArena();
            }
            
            window.vencedoresSorteio.push(vencedorDefinitivo);
            const numGanhadorAtual = window.vencedoresSorteio.length;
            
            statusHeader.innerText = `Rodada em andamento • Sorteado ${numGanhadorAtual} de ${window.quantidadeSorteios}`;

            let bannerPremioFinal = '';
            if (vencedorDefinitivo.premio_ganho) {
                bannerPremioFinal = `<div style="background: var(--ccol-rust-bright); color: #000; display: inline-block; padding: 6px 20px; border-radius: 30px; font-weight: 900; font-size: 1.3rem; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(251, 146, 60, 0.4); text-transform: uppercase;"><i class="fas fa-gift"></i> PRÊMIO: ${vencedorDefinitivo.premio_ganho}</div>`;
            }

            areaDestaque.innerHTML = `
                <div style="text-align: center; animation: revealEpicCard 0.55s cubic-bezier(0.19, 1, 0.22, 1) forwards; background: rgba(61, 220, 132, 0.08); padding: 40px 70px; border-radius: 24px; border: 2px solid var(--ccol-green-bright); box-shadow: 0 0 60px rgba(61, 220, 132, 0.25); backdrop-filter: blur(12px); max-width: 850px; width: 100%; box-sizing: border-box;">
                    <div style="display: inline-flex; align-items: center; justify-content: center; width: 75px; height: 75px; background: rgba(245, 158, 11, 0.15); border-radius: 50%; margin-bottom: 15px; box-shadow: 0 0 20px rgba(245,158,11,0.25);">
                        <i class="fas fa-trophy" style="color: #f59e0b; font-size: 2.4rem;"></i>
                    </div>
                    <br>
                    ${bannerPremioFinal}
                    <h2 style="color: #fb923c; font-size: 1.4rem; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin-top: 0; margin-bottom: 10px;">COLABORADOR PREMIADO #${numGanhadorAtual}</h2>
                    <h1 style="color: #fff; font-size: 3.5rem; font-weight: 900; text-transform: uppercase; margin-top: 0; margin-bottom: 15px; letter-spacing: -0.5px; text-shadow: 0 4px 15px rgba(0,0,0,0.7); line-height: 1.1; word-wrap: break-word;">${vencedorDefinitivo.nome}</h1>
                    
                    <div style="display: flex; justify-content: center; gap: 40px; margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px; box-sizing: border-box;">
                        <div style="text-align: center;">
                            <span style="color:#94a3b8; font-size: 0.9rem; font-weight:normal; display:block; margin-bottom:5px; text-transform:uppercase; letter-spacing:1px;">Cargo / Função</span>
                            <strong style="color: var(--ccol-blue-bright); font-size: 1.4rem; font-weight: 700;">${vencedorDefinitivo.funcao || 'Não informada'}</strong>
                        </div>
                        <div style="text-align: center;">
                            <span style="color:#94a3b8; font-size: 0.9rem; font-weight:normal; display:block; margin-bottom:5px; text-transform:uppercase; letter-spacing:1px;">Matrícula</span>
                            <strong style="color: #fff; font-size: 1.4rem; font-weight: 700;">${vencedorDefinitivo.cod_funcionario ? String(vencedorDefinitivo.cod_funcionario).padStart(4, '0') : 'N/A'}</strong>
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
            
            let labelPremioMini = vencedorDefinitivo.premio_ganho ? `<div style="color: var(--ccol-rust-bright); font-size: 0.75rem; font-weight: bold; margin-top: 4px;"><i class="fas fa-gift"></i> ${vencedorDefinitivo.premio_ganho}</div>` : '';

            cardMini.style.cssText = 'background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(61, 220, 132, 0.35); border-radius: 10px; padding: 12px 20px; min-width: 190px; text-align: center; animation: terminalFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 4px 10px rgba(0,0,0,0.25); box-sizing: border-box;';
            cardMini.innerHTML = `
                <div style="color: var(--ccol-green-bright); font-weight: 800; font-size: 0.8rem; letter-spacing: 0.5px; margin-bottom: 4px;"><i class="fas fa-check-circle"></i> GANHADOR #${numGanhadorAtual}</div>
                <div style="color: #fff; font-weight: 700; font-size: 1.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${vencedorDefinitivo.nome}">${nomeExibicao}</div>
                ${labelPremioMini}
            `;
            galeriaDiv.appendChild(cardMini);

            if (window.vencedoresSorteio.length < window.quantidadeSorteios) {
                if(window.listaPremiosLocal.length > 0) document.getElementById('containerSeletorPremio').style.display = 'block'; // Volta o seletor
                btnSortear.style.display = 'inline-flex';
                btnSortear.innerHTML = `<i class="fas fa-forward"></i> PRÓXIMO SORTEIO (#${numGanhadorAtual + 1})`;
            } else {
                statusHeader.innerHTML = `Sorteio Finalizado com Sucesso • <span style="color: var(--ccol-green-bright); font-weight: bold;">${window.quantidadeSorteios} Ganhadores Definidos</span>`;
                
                btnSortear.style.display = 'inline-flex';
                btnSortear.className = 'btn-secondary-dark';
                btnSortear.style.borderColor = 'var(--ccol-green-bright)';
                btnSortear.style.color = '#fff';
                btnSortear.innerHTML = '<i class="fas fa-check-double" style="color:var(--ccol-green-bright);"></i> CONCLUIR E FECHAR ARENA';
                btnSortear.onclick = window.fecharArenaSorteio;

                if (!document.getElementById('btnGerarPDFSorteio')) {
                    const btnPdf = document.createElement('button');
                    btnPdf.id = 'btnGerarPDFSorteio';
                    btnPdf.className = 'btn-primary-green';
                    btnPdf.style.cssText = 'font-size: 1.6rem; font-weight: 900; padding: 22px 40px; border-radius: 50px; box-shadow: 0 15px 35px rgba(61,220,132,0.35); cursor: pointer; border: none; display: inline-flex; align-items: center; gap: 15px; transition: transform 0.2s;';
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

// ================= GERAÇÃO DO PDF =================
window.gerarRelatorioSorteioPDF = function() {
    if (window.vencedoresSorteio.length === 0) {
        alert("Nenhum ganhador para gerar o relatório.");
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.setTextColor(41, 128, 185); 
        doc.text("Relatório Oficial de Sorteio - Serrana Florestal", 14, 20);

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
        doc.text(`Filtros: Saúde (${filtroPlano}) | Mês (${filtroMes}) | Função (${filtroFuncao})`, 14, 36);
        doc.text(`Total de Vencedores na Rodada: ${window.vencedoresSorteio.length}`, 14, 42);

        // Verifica se teve distribuição de prêmios para incluir a coluna extra
        const sorteioComPremios = window.vencedoresSorteio.some(v => v.premio_ganho);
        const cabecalho = sorteioComPremios 
            ? [['Ordem', 'Matrícula', 'Nome do Colaborador', 'Função / Cargo', 'Prêmio Entregue']] 
            : [['Ordem', 'Matrícula', 'Nome do Colaborador', 'Função / Cargo']];

        const linhas = window.vencedoresSorteio.map((v, index) => {
            const matricula = v.cod_funcionario ? String(v.cod_funcionario).padStart(4, '0') : 'N/A';
            const linhaTabela = [
                index + 1, 
                matricula,
                v.nome,
                v.funcao || 'Não informada'
            ];
            if (sorteioComPremios) linhaTabela.push(v.premio_ganho || '-');
            return linhaTabela;
        });

        doc.autoTable({
            startY: 48,
            head: cabecalho,
            body: linhas,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] },
            styles: { fontSize: 10 }
        });

        const finalY = doc.lastAutoTable.finalY || 45;
        doc.text("________________________________________________", 105, finalY + 30, { align: 'center' });
        doc.text("Assinatura do Responsável (Recursos Humanos)", 105, finalY + 35, { align: 'center' });

        doc.save(`Relatorio_Sorteio_Serrana_${new Date().getTime()}.pdf`);
        
    } catch (e) {
        console.error(e);
        alert('Erro ao gerar PDF. Verifique se a biblioteca jsPDF foi carregada no index.html.');
    }
};