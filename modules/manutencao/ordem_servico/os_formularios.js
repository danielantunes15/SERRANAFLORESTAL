// ==================== js/os_formularios.js ====================

let mapaSOSInstance = null;
let marcadorSOS = null;

window.inicializarMapaSOS = function() {
    if (mapaSOSInstance !== null) {
        mapaSOSInstance.invalidateSize();
        return;
    }

    let latInicial = -17.9754;
    let lngInicial = -39.7336;
    let zoomInicial = 7;
    let usouUltimoLocal = false;

    // TENTA ENCONTRAR O ÚLTIMO S.O.S LANÇADO PARA FOCAR A TELA LÁ
    if (ordensServico && ordensServico.length > 0) {
        const ultimasSOS = ordensServico.filter(o => o.tipo && o.tipo.startsWith('S.O.S') && o.localizacao_sos && o.localizacao_sos.includes('http'));
        
        if (ultimasSOS.length > 0) {
            const ultima = ultimasSOS[0];
            let match = ultima.localizacao_sos.match(/(-?\d+\.\d+),(-?\d+\.\d+)/);
            if (match) {
                latInicial = parseFloat(match[1]);
                lngInicial = parseFloat(match[2]);
                zoomInicial = 12; // Dá um zoom focado na região
                usouUltimoLocal = true;
            }
        }
    }

    mapaSOSInstance = L.map('mapaSOS').setView([latInicial, lngInicial], zoomInicial);

    L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        attribution: '© Google Maps',
        maxZoom: 20
    }).addTo(mapaSOSInstance);

    // Se não tinha S.O.S anterior, tenta usar o GPS do navegador
    if (!usouUltimoLocal && "geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            mapaSOSInstance.setView([lat, lng], 13);
        }, function(error) {
            console.log("Geolocalização não permitida ou indisponível.");
        });
    }

    mapaSOSInstance.on('click', function(e) {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;

        if (marcadorSOS) {
            mapaSOSInstance.removeLayer(marcadorSOS);
        }

        marcadorSOS = L.marker([lat, lng]).addTo(mapaSOSInstance);
        
        // CONCATENAÇÃO TRADICIONAL PARA EVITAR O BUG DO '$'
        const linkMaps = 'https://www.google.com/maps?q=' + lat + ',' + lng;
        document.getElementById('osLocalizacaoSOS').value = linkMaps;
    });
};

// NOVA FUNÇÃO: Buscar localização ao colar a coordenada do rastreador
window.buscarCoordenadaNoMapaSOS = function() {
    const inputCoordenadas = document.getElementById('inputCoordenadasBuscaSOS').value.trim();
    
    if (!inputCoordenadas) {
        alert("Por favor, cole as coordenadas geradas pelo rastreador no campo.");
        return;
    }

    // Expressão regular para encontrar as latitudes e longitudes (Ex: -17.7804821, -39.6039536)
    const regex = /(-?\d+\.\d+)(?:,|\s)+(-?\d+\.\d+)/;
    const match = inputCoordenadas.match(regex);

    if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);

        if (mapaSOSInstance) {
            // Foca o mapa na nova coordenada
            mapaSOSInstance.setView([lat, lng], 15);

            // Remove o marcador antigo se houver, e adiciona o novo
            if (marcadorSOS) {
                mapaSOSInstance.removeLayer(marcadorSOS);
            }
            marcadorSOS = L.marker([lat, lng]).addTo(mapaSOSInstance);
            
            // CONCATENAÇÃO TRADICIONAL PARA EVITAR O BUG DO '$'
            const linkMaps = 'https://www.google.com/maps?q=' + lat + ',' + lng;
            document.getElementById('osLocalizacaoSOS').value = linkMaps;
        }
    } else {
        alert("Formato de coordenada inválido. Certifique-se de usar o formato correto. (Ex: -17.7804821, -39.6039536)");
    }
};

window.tratarCamposDinamicos = function() {
    const tipo = document.getElementById('osTipo').value;
    const camposPneu = document.getElementById('camposPneu');
    const camposSOS = document.getElementById('camposSOS');

    if (tipo === 'Borracharia (PNEU)') {
        camposPneu.style.display = 'block';
    } else {
        camposPneu.style.display = 'none';
        document.getElementById('osPneuPosicao').value = '';
        document.getElementById('osPneuServico').value = '';
        document.getElementById('osPneuMotivo').value = '';
    }

    if (tipo.startsWith('S.O.S')) {
        camposSOS.style.display = 'block';
        setTimeout(() => {
            inicializarMapaSOS();
        }, 300);
    } else {
        camposSOS.style.display = 'none';
        document.getElementById('osLocalizacaoSOS').value = '';
        document.getElementById('osReferenciaSOS').value = '';
        if (document.getElementById('inputCoordenadasBuscaSOS')) {
            document.getElementById('inputCoordenadasBuscaSOS').value = '';
        }
        if (marcadorSOS && mapaSOSInstance) {
            mapaSOSInstance.removeLayer(marcadorSOS);
            marcadorSOS = null;
        }
    }
};

window.mudarModoEntrada = function() {
    const modo = document.getElementById('osModoEntrada').value;
    const label = document.getElementById('labelDataAbertura');
    const input = document.getElementById('osDataAbertura');
    
    if (modo === 'imediata') {
        label.innerText = 'Data e Hora da Entrada no Pátio (Ocorrência)';
        const agora = new Date();
        const fusoAjuste = new Date(agora.getTime() - (agora.getTimezoneOffset() * 60000));
        input.value = fusoAjuste.toISOString().slice(0, 16); 
    } else {
        label.innerText = 'Agendar para (Data e Hora Futura)';
        input.value = '';
    }
};

window.carregarMotoristasSelectOS = async function() {
    const select = document.getElementById('osMotorista');
    if (!select) return;
    try {
        let query = supabaseClient.from('motoristas').select('nome').order('nome', { ascending: true });
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
        const { data, error } = await query;
            
        if (error) throw error;

        let options = '<option value="">Selecione o motorista...</option>';
        if (data) {
            data.forEach(m => {
                options += `<option value="${m.nome}">${m.nome}</option>`;
            });
        }
        select.innerHTML = options;
    } catch (error) {
        console.error("Erro ao carregar motoristas para OS:", error);
    }
};

window.mudarTipoReferenciaOS = function() {
    const tipoRef = document.getElementById('osTipoReferencia').value;
    const selectPlaca = document.getElementById('osPlaca');
    const labelPlaca = document.getElementById('labelOsPlaca');
    const wrapperMotorista = document.getElementById('wrapperMotorista');
    const wrapperHodometro = document.getElementById('wrapperHodometro');
    
    if (!selectPlaca) return;
    
    selectPlaca.innerHTML = '<option value="">Selecione...</option>';
    
    if (!frotasManutencao || frotasManutencao.length === 0) {
        selectPlaca.innerHTML = '<option value="">Nenhum cadastro encontrado...</option>';
        return;
    }

    if (tipoRef === 'cavalo') {
        labelPlaca.innerText = 'Selecione o Cavalo (Conjunto Completo)';
        if(wrapperMotorista) wrapperMotorista.style.display = 'block';
        if(wrapperHodometro) wrapperHodometro.style.display = 'block';
        
        frotasManutencao.forEach(f => {
            if (f.cavalo && f.categoria === 'TRITREM') {
                const texto = `${f.cavalo.trim().toUpperCase()} ${f.go ? ' - ' + f.go : ''}`;
                selectPlaca.innerHTML += `<option value="${f.cavalo.trim().toUpperCase()}">${texto}</option>`;
            }
        });
    } else if (tipoRef === 'go') {
        labelPlaca.innerText = 'Selecione apenas o GO (Sem Cavalo)';
        if(wrapperMotorista) wrapperMotorista.style.display = 'none';
        if(wrapperHodometro) wrapperHodometro.style.display = 'none';
        
        const osMotorista = document.getElementById('osMotorista');
        const osHodometro = document.getElementById('osHodometro');
        if (osMotorista) osMotorista.value = '';
        if (osHodometro) osHodometro.value = '';
        
        const gosUnicos = [];
        frotasManutencao.forEach(f => {
            if (f.go && f.go.trim() !== '') {
                if (!gosUnicos.find(item => item.go.trim().toUpperCase() === f.go.trim().toUpperCase())) {
                    gosUnicos.push(f);
                }
            }
        });

        if (gosUnicos.length === 0) {
            selectPlaca.innerHTML = '<option value="">Nenhum GO cadastrado...</option>';
        } else {
            gosUnicos.forEach(f => {
                let carretas = [f.carreta1, f.carreta2, f.carreta3].filter(c => c && c.trim() !== '').join(' / ');
                let textoExibicao = `${f.go.trim().toUpperCase()} ${carretas ? '(' + carretas + ')' : ''}`;
                selectPlaca.innerHTML += `<option value="${f.go.trim().toUpperCase()}">${textoExibicao}</option>`;
            });
        }
    }
};

window.carregarSelectCavalosOS = async function() {
    if (typeof window.mudarTipoReferenciaOS === 'function') {
        window.mudarTipoReferenciaOS();
    }
};

window.salvarNovaOS = async function() {
    const tipoRef = document.getElementById('osTipoReferencia').value;
    const placa = document.getElementById('osPlaca').value.trim().toUpperCase();
    let motorista = document.getElementById('osMotorista').value;
    const modoEntrada = document.getElementById('osModoEntrada').value;
    let data_abertura = document.getElementById('osDataAbertura').value;
    const hodometro = document.getElementById('osHodometro').value.trim();
    const prioridade = document.getElementById('osPrioridade').value;
    const tipo = document.getElementById('osTipo').value;
    const problema = document.getElementById('osProblema').value.trim();
    const observacoes = document.getElementById('osObservacoes').value.trim();

    if (!placa || !data_abertura || !tipo) {
        alert("Preencha ao menos a Placa (Cavalo ou GO), Data de Abertura e Tipo de Serviço.");
        return;
    }

    const dataSelecionada = new Date(data_abertura);
    const agora = new Date();
    
    if (modoEntrada === 'imediata' && dataSelecionada > agora) {
        alert("Modo Entrada Imediata selecionado, mas a data/hora colocada está no futuro.");
        return;
    }

    let statusInicial = 'Aguardando Oficina';
    if (modoEntrada === 'agendada') statusInicial = 'Agendada';
    else if (tipo === 'Sinistro') statusInicial = 'Sinistrado';

    if (tipoRef === 'go' && !motorista) {
        motorista = 'N/A (APENAS GO)'; 
    }
    
    let localizacao_sos = '';
    if (tipo.startsWith('S.O.S')) {
        const coordsLink = document.getElementById('osLocalizacaoSOS').value.trim();
        const referencia = document.getElementById('osReferenciaSOS').value.trim();
        
        if (!coordsLink) {
            alert("Para chamados de S.O.S, é obrigatório clicar no mapa ou inserir a coordenada do veículo.");
            return;
        }
        
        localizacao_sos = coordsLink;
        if (referencia) {
            localizacao_sos += ' | Ref: ' + referencia;
        }
    }

    let pacoteDadosOS = {
        placa: placa,
        data_abertura: data_abertura,
        prioridade: prioridade,
        tipo: tipo,
        status: statusInicial
    };

    try {
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.username) {
            pacoteDadosOS.aberto_por = currentUser.username;
        } else {
            const sessaoSalva = localStorage.getItem('ccol_user_session');
            if (sessaoSalva) {
                const userObj = JSON.parse(sessaoSalva);
                if (userObj && userObj.username) {
                    pacoteDadosOS.aberto_por = userObj.username;
                }
            }
        }
    } catch (e) {
        console.warn("Não foi possível capturar o usuário logado automaticamente.", e);
    }

    if (motorista) pacoteDadosOS.motorista = motorista;
    if (observacoes) pacoteDadosOS.observacoes = observacoes;
    if (localizacao_sos) pacoteDadosOS.localizacao_sos = localizacao_sos;

    if (hodometro) {
        let apenasNumeros = hodometro.replace(/[^0-9]/g, '');
        if (apenasNumeros !== '') {
            pacoteDadosOS.hodometro = Number(apenasNumeros);
        }
    }

    let problemaFinal = problema;
    
    if (tipoRef === 'go') {
        const frotaObj = frotasManutencao.find(f => f.go && f.go.trim().toUpperCase() === placa);
        if (frotaObj) {
            let carretas = [frotaObj.carreta1, frotaObj.carreta2, frotaObj.carreta3].filter(c => c && c.trim() !== '').join(' / ');
            if (carretas) {
                problemaFinal = `[MANUTENÇÃO APENAS DO GO] Carretas atreladas: ${carretas}\n${problemaFinal}`;
            } else {
                problemaFinal = `[MANUTENÇÃO APENAS DO GO]\n${problemaFinal}`;
            }
        }
    }
    
    let pneuPosicao = '';
    let pneuServico = '';
    let pneuMotivo = '';
    
    if (tipo === 'Borracharia (PNEU)') {
        pneuPosicao = document.getElementById('osPneuPosicao').value.trim();
        pneuServico = document.getElementById('osPneuServico').value;
        pneuMotivo = document.getElementById('osPneuMotivo').value.trim();
        
        const textoPneu = `[PNEU] Posição: ${pneuPosicao || 'N/I'} | Serviço: ${pneuServico || 'N/I'} | Motivo: ${pneuMotivo || 'N/I'}`;
        problemaFinal = problemaFinal ? textoPneu + "\n" + problemaFinal : textoPneu;
    }

    if (localizacao_sos) {
        problemaFinal = '[LINK S.O.S MAPS: ' + localizacao_sos + ']\n' + problemaFinal;
    }

    if (problemaFinal) pacoteDadosOS.problema = problemaFinal;

    if (typeof window.injetarFilial === 'function') {
        pacoteDadosOS = window.injetarFilial(pacoteDadosOS);
    }

    try {
        const { error } = await supabaseClient.from('ordens_servico').insert([pacoteDadosOS]);
        if (error) {
            alert('Erro na gravação (400).\nDetalhes: ' + error.message);
            return;
        }
        
        await carregarDadosOS();
        
        if (tipo === 'Sinistro') alternarTelaOS('sinistro');
        else if (modoEntrada === 'agendada') alternarTelaOS('historico');
        else alternarTelaOS('lista');
        
    } catch (error) {
        alert("Falha na conexão ao tentar salvar a Ordem de Serviço.");
    }
};

window.excluirOS = async function(id) {
    if(confirm("Excluir esta O.S.?")) {
        await supabaseClient.from('ordens_servico').delete().eq('id', id);
        await carregarDadosOS();
        if(typeof renderizarTabelaHistoricoOS === 'function') renderizarTabelaHistoricoOS();
    }
};

window.aceitarOS = async function(id) {
    let nomeMecanico = 'Mecânico Não Identificado';
    try {
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.username) {
            nomeMecanico = currentUser.username;
        } else {
            const sessaoSalva = localStorage.getItem('ccol_user_session');
            if (sessaoSalva) {
                const userObj = JSON.parse(sessaoSalva);
                if (userObj && userObj.username) {
                    nomeMecanico = userObj.username;
                }
            }
        }
    } catch (e) {
        console.warn("Não foi possível capturar o usuário logado.", e);
    }

    if(confirm('Deseja iniciar o serviço e assumir esta O.S como: ' + nomeMecanico + '?')) {
        try {
            const { error } = await supabaseClient
                .from('ordens_servico')
                .update({ 
                    status: 'Em Manutenção',
                    mecanico: nomeMecanico
                })
                .eq('id', id);

            if (error) throw error;

            await carregarDadosOS();
            if(typeof renderizarTabelaOS === 'function') renderizarTabelaOS();
            alert("O.S. aceita com sucesso! A TV será atualizada no próximo ciclo (15s).");
        } catch (error) {
            alert('Erro ao aceitar a O.S: ' + error.message);
        }
    }
};

window.abrirModalConclusaoOS = function(id) {
    osSelecionadaParaConclusao = id;
    const modal = document.getElementById('modalConclusaoOS');
    const inputHora = document.getElementById('horaConclusaoOS');
    const agora = new Date();
    const fusoAjuste = new Date(agora.getTime() - (agora.getTimezoneOffset() * 60000));
    if (inputHora) inputHora.value = fusoAjuste.toISOString().slice(0, 16);
    if (modal) modal.style.display = 'flex';
};

window.fecharModalConclusaoOS = function() {
    osSelecionadaParaConclusao = null;
    const modal = document.getElementById('modalConclusaoOS');
    if (modal) modal.style.display = 'none';
};

window.salvarConclusaoOS = async function() {
    if (!osSelecionadaParaConclusao) return;
    const inputHora = document.getElementById('horaConclusaoOS').value;
    
    if (!inputHora) {
        alert("Por favor, informe o horário de conclusão.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('ordens_servico')
            .update({
                status: 'Concluída',
                data_conclusao: inputHora
            })
            .eq('id', osSelecionadaParaConclusao);

        if (error) throw error;

        fecharModalConclusaoOS();
        await carregarDadosOS();
        
        if(typeof renderizarTabelaOS === 'function') renderizarTabelaOS();
        if(typeof renderizarTabelaSinistro === 'function') renderizarTabelaSinistro();
        
        alert("Ordem de Serviço concluída com sucesso!");
    } catch (error) {
        alert("Erro ao concluir a O.S.");
    }
};

window.abrirModalServicoExtra = function(id) {
    osSelecionadaParaServicoExtra = id;
    const modal = document.getElementById('modalServicoExtra');
    const inputDesc = document.getElementById('extraServicoDescricao');
    const inputPrev = document.getElementById('extraServicoPrevisao');
    
    if (inputDesc) inputDesc.value = '';
    if (inputPrev) inputPrev.value = '';
    
    if (modal) modal.style.display = 'flex';
};

window.fecharModalServicoExtra = function() {
    osSelecionadaParaServicoExtra = null;
    const modal = document.getElementById('modalServicoExtra');
    if (modal) modal.style.display = 'none';
};

window.salvarServicoExtra = async function() {
    if (!osSelecionadaParaServicoExtra) return;
    
    const descricao = document.getElementById('extraServicoDescricao').value.trim();
    const previsao = document.getElementById('extraServicoPrevisao').value;

    if (!descricao && !previsao) {
        alert("Preencha ao menos a descrição do serviço extra ou a nova previsão.");
        return;
    }

    try {
        const osAtual = ordensServico.find(o => o.id === osSelecionadaParaServicoExtra);
        let novoProblema = osAtual.problema || '';
        
        if (descricao) {
            novoProblema += '\n[SERVIÇO EXTRA]: ' + descricao;
        }

        const updateData = { problema: novoProblema };
        if (previsao) {
            updateData.previsao_entrega = previsao;
        }

        const { error } = await supabaseClient
            .from('ordens_servico')
            .update(updateData)
            .eq('id', osSelecionadaParaServicoExtra);

        if (error) throw error;

        fecharModalServicoExtra();
        await carregarDadosOS();
        
        if(typeof renderizarTabelaOS === 'function') renderizarTabelaOS();
        if(typeof renderizarTabelaSinistro === 'function') renderizarTabelaSinistro();
        
        alert("Atualização salva com sucesso!");
    } catch (error) {
        alert("Erro ao salvar serviço extra.");
    }
};

window.carregarFiltrosSelectHistoricoOS = function() {
    const selectPlaca = document.getElementById('filtroHistPlaca');
    const selectMotorista = document.getElementById('filtroHistMotorista');
    const selectMesAno = document.getElementById('filtroHistMesAno');

    if (selectPlaca && typeof ordensServico !== 'undefined') {
        let optionsPlaca = '<option value="">Todas as Placas</option>';
        const placasUnicas = [...new Set(ordensServico.map(os => os.placa))].filter(Boolean).sort();
        placasUnicas.forEach(p => optionsPlaca += `<option value="${p}">${p}</option>`);
        selectPlaca.innerHTML = optionsPlaca;
    }

    if (selectMotorista && typeof ordensServico !== 'undefined') {
        let optionsMot = '<option value="">Todos os Motoristas</option>';
        const motUnicos = [...new Set(ordensServico.map(os => os.motorista))].filter(Boolean).sort();
        motUnicos.forEach(m => optionsMot += `<option value="${m}">${m}</option>`);
        selectMotorista.innerHTML = optionsMot;
    }

    if (selectMesAno && typeof ordensServico !== 'undefined') {
        let optionsMes = '<option value="">Todos os Meses</option>';
        const mesesUnicos = new Set();
        ordensServico.forEach(os => {
            if (os.data_abertura) {
                const d = new Date(os.data_abertura);
                if(!isNaN(d)) {
                    const mesAno = String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
                    mesesUnicos.add(mesAno);
                }
            }
        });
        [...mesesUnicos].sort((a,b) => {
            const [mA, yA] = a.split('/');
            const [mB, yB] = b.split('/');
            return yB - yA || mB - mA;
        }).forEach(ma => optionsMes += `<option value="${ma}">${ma}</option>`);
        selectMesAno.innerHTML = optionsMes;
    }
};

window.setFiltroMesAtualOS = function() {
    const agora = new Date();
    const primeiroDia = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const ultimoDia = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);

    const formatarData = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const inputInicio = document.getElementById('filtroHistDataInicio');
    const inputFim = document.getElementById('filtroHistDataFim');
    
    if (inputInicio) inputInicio.value = formatarData(primeiroDia);
    if (inputFim) inputFim.value = formatarData(ultimoDia);

    if (typeof renderizarTabelaHistoricoOS === 'function') {
        renderizarTabelaHistoricoOS();
    }
};

window.exportarHistoricoOSExcel = function() {
    const table = document.querySelector('#telaHistoricoOS .data-table-modern');
    if (!table) {
        alert("Nenhuma tabela encontrada para exportar.");
        return;
    }
    let csvContent = "\uFEFF";
    const rows = table.querySelectorAll('tr');
    for (let i = 0; i < rows.length; i++) {
        let row = [], cols = rows[i].querySelectorAll('td, th');
        for (let j = 0; j < cols.length - 1; j++) {
            row.push('"' + cols[j].innerText.replace(/"/g, '""') + '"');
        }
        csvContent += row.join(';') + "\n";
    }
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Historico_OS_${new Date().getTime()}.csv`;
    link.click();
};

window.exportarHistoricoOSPDF = function() {
    const table = document.querySelector('#telaHistoricoOS .data-table-modern');
    if (!table) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Histórico de O.S.</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 12px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #000; padding: 5px; text-align: left; }
                th { background-color: #f0f0f0; }
            </style>
        </head>
        <body>
            <h2>Histórico de Ordens de Serviço</h2>
            ${table.outerHTML}
            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};