// =========================================================================
// Módulo: Controladoria -> Impressão de Ocorrências (Layout Otimizado 1 Página)
// Ficheiro: modules/controladoria/ocorrencias/ocorrencias_impressao.js
// =========================================================================

window.imprimirFolhaOcorrencia = function(dados = {}) {
    const isBlank = dados.isBlank === true;

    // Formatação de data e protocolo
    let dataFmt = isBlank ? '' : (dados.data_ocorrido || '');
    if (dataFmt) {
        const [a, m, d] = dataFmt.split('-');
        dataFmt = `${d}/${m}/${a}`;
    }
    const idFmt = isBlank ? '_____/____' : (dados.id ? String(dados.id).padStart(4, '0') : 'S/N');
    const dataRegistro = isBlank ? '__/__/____' : new Date().toLocaleDateString('pt-BR');
    
    // Obter URL base absoluta para garantir que a imagem carrega no popup de impressão
    const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '');
    const logoUrl = baseUrl + 'assets/logoverde.png';

    // Helper para exibir dado ou espaço em branco
    const val = (valor) => isBlank ? '' : (valor || '');

    // Formatar tabela de outros envolvidos
    let htmlOutrosEnvolvidos = '';
    if (!isBlank && dados.outros_envolvidos && dados.outros_envolvidos.length > 0) {
        htmlOutrosEnvolvidos = `
            <div class="section-title">Outros Envolvidos / Equipamentos</div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 30%">Nome / Terceiro</th>
                        <th style="width: 20%">Função</th>
                        <th style="width: 25%">Categoria Equip.</th>
                        <th style="width: 25%">Placa</th>
                    </tr>
                </thead>
                <tbody>
                    ${dados.outros_envolvidos.map(oe => `
                        <tr>
                            <td>${oe.nome || '-'} ${oe.is_responsavel ? '(Causador)' : ''}</td>
                            <td>${oe.funcao || '-'}</td>
                            <td>${oe.equipamento_categoria || '-'}</td>
                            <td>${oe.equipamento_placa || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } else if (isBlank) {
        htmlOutrosEnvolvidos = `
            <div class="section-title">Outros Envolvidos / Equipamentos</div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 30%">Nome / Terceiro</th>
                        <th style="width: 20%">Função</th>
                        <th style="width: 25%">Categoria Equip.</th>
                        <th style="width: 25%">Placa</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
                    <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
                </tbody>
            </table>
        `;
    }

    // Aumentar o espaço para texto manual se a folha for impressa em branco
    const minHeightTextBox = isBlank ? '100px' : '40px';

    // LAYOUT OTIMIZADO PARA CABER EM 1 FOLHA A4
    const htmlImpressao = `
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
        <meta charset="UTF-8">
        <title>Ocorrência ${isBlank ? 'em Branco' : '#' + idFmt}</title>
        <style>
            @page { size: A4 portrait; margin: 10mm; } /* Margem bem pequena para aproveitar a folha */
            * { box-sizing: border-box; }
            body { font-family: 'Arial', sans-serif; color: #1e293b; font-size: 11px; line-height: 1.2; background: #fff; margin: 0; }
            .print-container { width: 100%; max-width: 800px; margin: 0 auto; }
            
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #10b981; padding-bottom: 8px; margin-bottom: 12px; }
            .header-text h1 { margin: 0; font-size: 18px; text-transform: uppercase; color: #10b981; letter-spacing: 1px; }
            .header-text p { margin: 4px 0 0 0; font-size: 11px; color: #475569; font-weight: bold; }
            .header-logo { max-height: 40px; object-fit: contain; }
            
            .section-title { background: #f1f5f9; padding: 4px 8px; font-weight: bold; font-size: 11px; color: #0f172a; border-left: 4px solid #10b981; margin: 10px 0 4px 0; text-transform: uppercase; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
            th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; }
            th { background: #f8fafc; font-size: 10px; color: #64748b; text-transform: uppercase; }
            td { font-weight: bold; font-size: 11px; color: #0f172a; min-height: 18px; height: 18px; }
            
            .w-15 { width: 15%; }
            .w-35 { width: 35%; }

            .text-box { border: 1px solid #cbd5e1; padding: 6px 8px; border-radius: 4px; min-height: ${minHeightTextBox}; margin-bottom: 6px; white-space: pre-wrap; font-size: 11px; }
            .text-box-title { font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 4px; display: block; }
            
            .signatures { display: flex; justify-content: space-between; margin-top: 30px; page-break-inside: avoid; }
            .sig-block { width: 30%; text-align: center; }
            .sig-line { border-bottom: 1px solid #1e293b; height: 30px; margin-bottom: 4px; }
            .sig-name { font-weight: bold; font-size: 11px; color: #0f172a; min-height: 14px; }
            .sig-role { font-size: 9px; color: #64748b; text-transform: uppercase; }
        </style>
    </head>
    <body onload="setTimeout(() => { window.print(); window.close(); }, 500)">
        <div class="print-container">
            <div class="header">
                <div class="header-text">
                    <h1>Registro de Ocorrência</h1>
                    <p>Protocolo: #${idFmt} | Data do Registo: ${dataRegistro}</p>
                </div>
                <img src="${logoUrl}" class="header-logo" alt="Serrana Florestal" onerror="this.style.display='none'">
            </div>

            <div class="section-title">1. Identificação do Equipamento / Frota Principal</div>
            <table>
                <tr>
                    <th class="w-15">Empresa</th><td colspan="3">${val(dados.empresa)}</td>
                </tr>
                <tr>
                    <th class="w-15">Nº da Frota</th><td class="w-35">${val(dados.numero_frota)}</td>
                    <th class="w-15">Placa</th><td class="w-35">${val(dados.placa)}</td>
                </tr>
                <tr>
                    <th class="w-15">Modelo</th><td colspan="3">${val(dados.modelo)}</td>
                </tr>
            </table>

            <div class="section-title">2. Dados do Ocorrido e Envolvido Principal</div>
            <table>
                <tr>
                    <th class="w-15">Nº O.S.</th><td class="w-35">${val(dados.numero_os)}</td>
                    <th class="w-15">Data e Hora</th><td class="w-35">${dataFmt} ${isBlank ? '' : 'às'} ${val(dados.hora_ocorrido)}</td>
                </tr>
                <tr>
                    <th class="w-15">Local/Projeto</th><td colspan="3">${val(dados.local_projeto)}</td>
                </tr>
                <tr>
                    <th class="w-15">Envolvido</th><td colspan="3">${val(dados.nome_envolvido)}</td>
                </tr>
                <tr>
                    <th class="w-15">Função</th><td class="w-35">${val(dados.funcao)}</td>
                    <th class="w-15">Tempo Emp.</th><td class="w-35">${val(dados.tempo_empresa)}</td>
                </tr>
                <tr>
                    <th class="w-15">Escala</th><td colspan="3">${val(dados.escala)}</td>
                </tr>
            </table>

            ${htmlOutrosEnvolvidos}

            <div class="section-title">3. Relato dos Fatos e Pareceres</div>
            <div class="text-box">
                <span class="text-box-title">Descrição dos Fatos:</span>
                ${val(dados.descricao_fatos)}
            </div>
            <div class="text-box">
                <span class="text-box-title">O que poderia ter sido feito para evitar a ocorrência?</span>
                ${val(dados.prevencao_falha)}
            </div>
            <div class="text-box" style="min-height: ${isBlank ? '80px' : '40px'};">
                <span class="text-box-title">Parecer do Gestor:</span>
                ${val(dados.parecer_gestor)}
            </div>

            <div class="signatures">
                <div class="sig-block">
                    <div class="sig-line"></div>
                    <div class="sig-name">${val(dados.nome_envolvido)}</div>
                    <div class="sig-role">Envolvido Principal</div>
                </div>
                <div class="sig-block">
                    <div class="sig-line"></div>
                    <div class="sig-name">${val(dados.gestor_imediato)}</div>
                    <div class="sig-role">Gestor Imediato</div>
                </div>
                <div class="sig-block">
                    <div class="sig-line"></div>
                    <div class="sig-name">${val(dados.gerente)}</div>
                    <div class="sig-role">Gerente</div>
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