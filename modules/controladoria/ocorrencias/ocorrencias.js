// =========================================================================
// Módulo: Controladoria -> Ocorrências
// Ficheiro: modules/controladoria/ocorrencias/ocorrencias.js
// =========================================================================

window.initOcorrencias = function() {
    console.log("Módulo de Ocorrências Inicializado com sucesso.");
};

window.salvarOcorrencia = async function(event) {
    event.preventDefault();

    const dadosOcorrencia = {
        numero_frota: document.getElementById('numero_frota').value,
        placa: document.getElementById('placa').value,
        modelo: document.getElementById('modelo').value,
        empresa: document.getElementById('empresa').value,
        numero_os: document.getElementById('numero_os').value,
        data_ocorrido: document.getElementById('data_ocorrido').value,
        hora_ocorrido: document.getElementById('hora_ocorrido').value,
        local_projeto: document.getElementById('local_projeto').value,
        nome_envolvido: document.getElementById('nome_envolvido').value,
        funcao: document.getElementById('funcao').value,
        tempo_empresa: document.getElementById('tempo_empresa').value,
        escala: document.getElementById('escala').value,
        descricao_fatos: document.getElementById('descricao_fatos').value,
        prevencao_falha: document.getElementById('prevencao_falha').value,
        parecer_gestor: document.getElementById('parecer_gestor').value,
        gestor_imediato: document.getElementById('gestor_imediato').value,
        gerente: document.getElementById('gerente').value
    };

    try {
        const payload = window.injetarFilial ? window.injetarFilial(dadosOcorrencia) : dadosOcorrencia;
        
        // O .select() garante que o banco devolva a linha que acabou de criar, incluindo o ID (Protocolo)
        const { data, error } = await supabaseClient.from('ocorrencias').insert([payload]).select();
        if (error) throw error;

        let ocorrenciaSalva = payload;
        if (data && data.length > 0) {
            ocorrenciaSalva = data[0]; // Pega os dados com o ID gerado
        }

        // Pergunta se o utilizador deseja imprimir a folha da ocorrência
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Ocorrência Registada!',
                text: 'A ocorrência foi salva. Deseja imprimir o formulário agora?',
                icon: 'success',
                showCancelButton: true,
                confirmButtonColor: '#10b981',
                cancelButtonColor: '#64748b',
                confirmButtonText: '<i class="fas fa-print"></i> Sim, imprimir',
                cancelButtonText: 'Não, fechar'
            }).then((result) => {
                if (result.isConfirmed) {
                    window.imprimirFolhaOcorrencia(ocorrenciaSalva);
                }
                window.limparFormOcorrencia();
            });
        } else {
            if (confirm("Ocorrência salva com sucesso! Deseja imprimir o formulário agora?")) {
                window.imprimirFolhaOcorrencia(ocorrenciaSalva);
            }
            window.limparFormOcorrencia();
        }

    } catch (error) {
        console.error("Erro ao guardar a ocorrência:", error);
        if (typeof Swal !== 'undefined') {
            Swal.fire('Erro', 'Ocorreu um erro ao guardar a ocorrência.', 'error');
        } else {
            alert("Erro ao guardar a ocorrência. Verifique a consola (F12) para mais detalhes.");
        }
    }
};

window.limparFormOcorrencia = function() {
    const form = document.getElementById('formOcorrencia');
    if (form) {
        form.reset();
        const campoEmpresa = document.getElementById('empresa');
        if (campoEmpresa) {
            campoEmpresa.value = "SERRANALOG FLORESTAL";
        }
    }
};

// =========================================================================
// FUNÇÃO CENTRAL PARA GERAR E IMPRIMIR A FOLHA PADRÃO DE OCORRÊNCIA
// =========================================================================
window.imprimirFolhaOcorrencia = function(dados) {
    // Formatação de data e protocolo
    let dataFmt = dados.data_ocorrido || '-';
    if (dataFmt !== '-') {
        const [a, m, d] = dataFmt.split('-');
        dataFmt = `${d}/${m}/${a}`;
    }
    const idFmt = dados.id ? String(dados.id).padStart(4, '0') : 'S/N';
    
    // Obter URL base absoluta para garantir que a imagem carrega no popup de impressão
    const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '');
    const logoUrl = baseUrl + 'assets/logoverde.png';

    const htmlImpressao = `
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
        <meta charset="UTF-8">
        <title>Ocorrência #${idFmt}</title>
        <style>
            @page { size: A4 portrait; margin: 15mm; }
            * { box-sizing: border-box; }
            body { font-family: 'Arial', sans-serif; color: #1e293b; font-size: 12px; line-height: 1.4; background: #fff; margin: 0; }
            .print-container { width: 100%; max-width: 800px; margin: 0 auto; }
            
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #10b981; padding-bottom: 15px; margin-bottom: 20px; }
            .header-text h1 { margin: 0; font-size: 24px; text-transform: uppercase; color: #10b981; letter-spacing: 1px; }
            .header-text p { margin: 5px 0 0 0; font-size: 14px; color: #475569; font-weight: bold; }
            .header-logo { max-height: 65px; object-fit: contain; }
            
            .section-title { background: #f1f5f9; padding: 6px 10px; font-weight: bold; font-size: 14px; color: #0f172a; border-left: 4px solid #10b981; margin: 20px 0 10px 0; text-transform: uppercase; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
            th { background: #f8fafc; font-size: 11px; color: #64748b; text-transform: uppercase; width: 25%; }
            td { font-weight: bold; font-size: 13px; color: #0f172a; }
            
            .text-box { border: 1px solid #cbd5e1; padding: 12px; border-radius: 4px; min-height: 70px; margin-bottom: 15px; white-space: pre-wrap; font-size: 13px; }
            .text-box-title { font-size: 12px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 5px; display: block; }
            
            .signatures { display: flex; justify-content: space-between; margin-top: 60px; page-break-inside: avoid; }
            .sig-block { width: 45%; text-align: center; }
            .sig-line { border-bottom: 1px solid #1e293b; height: 40px; margin-bottom: 10px; }
            .sig-name { font-weight: bold; font-size: 13px; color: #0f172a; }
            .sig-role { font-size: 11px; color: #64748b; }
        </style>
    </head>
    <body onload="setTimeout(() => { window.print(); window.close(); }, 500)">
        <div class="print-container">
            <div class="header">
                <div class="header-text">
                    <h1>Registro de Ocorrência</h1>
                    <p>Protocolo: #${idFmt} | Data do Registo: ${new Date().toLocaleDateString('pt-BR')}</p>
                </div>
                <img src="${logoUrl}" class="header-logo" alt="Serrana Florestal" onerror="this.style.display='none'">
            </div>

            <div class="section-title">1. Identificação do Veículo</div>
            <table>
                <tr>
                    <th>Empresa</th><td colspan="3">${dados.empresa || '-'}</td>
                </tr>
                <tr>
                    <th>Nº da Frota</th><td>${dados.numero_frota || '-'}</td>
                    <th>Placa</th><td>${dados.placa || '-'}</td>
                </tr>
                <tr>
                    <th>Modelo</th><td colspan="3">${dados.modelo || '-'}</td>
                </tr>
            </table>

            <div class="section-title">2. Dados do Ocorrido</div>
            <table>
                <tr>
                    <th>Nº O.S.</th><td>${dados.numero_os || '-'}</td>
                    <th>Data e Hora</th><td>${dataFmt} às ${dados.hora_ocorrido || '-'}</td>
                </tr>
                <tr>
                    <th>Local / Projeto</th><td colspan="3">${dados.local_projeto || '-'}</td>
                </tr>
                <tr>
                    <th>Colaborador Envolvido</th><td colspan="3">${dados.nome_envolvido || '-'}</td>
                </tr>
                <tr>
                    <th>Função</th><td>${dados.funcao || '-'}</td>
                    <th>Tempo Empresa</th><td>${dados.tempo_empresa || '-'}</td>
                </tr>
                <tr>
                    <th>Escala</th><td colspan="3">${dados.escala || '-'}</td>
                </tr>
            </table>

            <div class="section-title">3. Relato dos Fatos e Pareceres</div>
            <div class="text-box">
                <span class="text-box-title">Descrição dos Fatos:</span>
                ${dados.descricao_fatos || '-'}
            </div>
            <div class="text-box">
                <span class="text-box-title">O que poderia ter sido feito para evitar a ocorrência?</span>
                ${dados.prevencao_falha || '-'}
            </div>
            <div class="text-box">
                <span class="text-box-title">Parecer do Gestor:</span>
                ${dados.parecer_gestor || '-'}
            </div>

            <div class="signatures">
                <div class="sig-block">
                    <div class="sig-line"></div>
                    <div class="sig-name">${dados.nome_envolvido || 'Colaborador Envolvido'}</div>
                    <div class="sig-role">Assinatura do Envolvido</div>
                </div>
                <div class="sig-block">
                    <div class="sig-line"></div>
                    <div class="sig-name">${dados.gestor_imediato || 'Gestor Imediato'}</div>
                    <div class="sig-role">Assinatura do Gestor Responsável</div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

    const printWin = window.open('', '_blank');
    printWin.document.open();
    printWin.document.write(htmlImpressao);
    printWin.document.close();
};