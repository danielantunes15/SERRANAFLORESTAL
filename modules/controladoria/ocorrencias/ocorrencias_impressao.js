// =========================================================================
// Módulo: Controladoria -> Impressão de Ocorrências (Layout Otimizado 1 Página)
// Ficheiro: modules/controladoria/ocorrencias/ocorrencias_impressao.js
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

    // LAYOUT OTIMIZADO PARA CABER EM 1 FOLHA A4
    const htmlImpressao = `
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
        <meta charset="UTF-8">
        <title>Ocorrência #${idFmt}</title>
        <style>
            @page { size: A4 portrait; margin: 10mm; } /* Margem bem pequena para aproveitar a folha */
            * { box-sizing: border-box; }
            body { font-family: 'Arial', sans-serif; color: #1e293b; font-size: 11px; line-height: 1.2; background: #fff; margin: 0; }
            .print-container { width: 100%; max-width: 800px; margin: 0 auto; }
            
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #10b981; padding-bottom: 8px; margin-bottom: 12px; }
            .header-text h1 { margin: 0; font-size: 18px; text-transform: uppercase; color: #10b981; letter-spacing: 1px; }
            .header-text p { margin: 4px 0 0 0; font-size: 11px; color: #475569; font-weight: bold; }
            .header-logo { max-height: 40px; object-fit: contain; } /* LOGO REDUZIDA */
            
            .section-title { background: #f1f5f9; padding: 4px 8px; font-weight: bold; font-size: 11px; color: #0f172a; border-left: 4px solid #10b981; margin: 10px 0 4px 0; text-transform: uppercase; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
            th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; }
            th { background: #f8fafc; font-size: 10px; color: #64748b; text-transform: uppercase; width: 20%; }
            td { font-weight: bold; font-size: 11px; color: #0f172a; }
            
            .text-box { border: 1px solid #cbd5e1; padding: 6px 8px; border-radius: 4px; min-height: 40px; margin-bottom: 6px; white-space: pre-wrap; font-size: 11px; }
            .text-box-title { font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 2px; display: block; }
            
            .signatures { display: flex; justify-content: space-between; margin-top: 30px; page-break-inside: avoid; }
            .sig-block { width: 45%; text-align: center; }
            .sig-line { border-bottom: 1px solid #1e293b; height: 30px; margin-bottom: 4px; }
            .sig-name { font-weight: bold; font-size: 11px; color: #0f172a; }
            .sig-role { font-size: 9px; color: #64748b; }
        </style>
    </head>
    <body onload="setTimeout(() => { window.print(); window.close(); }, 500)">
        <div class="print-container">
            <!-- CABEÇALHO -->
            <div class="header">
                <div class="header-text">
                    <h1>Registro de Ocorrência</h1>
                    <p>Protocolo: #${idFmt} | Data do Registo: ${new Date().toLocaleDateString('pt-BR')}</p>
                </div>
                <img src="${logoUrl}" class="header-logo" alt="Serrana Florestal" onerror="this.style.display='none'">
            </div>

            <!-- IDENTIFICAÇÃO DO VEÍCULO -->
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

            <!-- DADOS DO OCORRIDO -->
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
                    <th>Colaborador</th><td colspan="3">${dados.nome_envolvido || '-'}</td>
                </tr>
                <tr>
                    <th>Função</th><td>${dados.funcao || '-'}</td>
                    <th>Tempo Empresa</th><td>${dados.tempo_empresa || '-'}</td>
                </tr>
                <tr>
                    <th>Escala</th><td colspan="3">${dados.escala || '-'}</td>
                </tr>
            </table>

            <!-- RELATO DOS FATOS -->
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

            <!-- ASSINATURAS -->
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