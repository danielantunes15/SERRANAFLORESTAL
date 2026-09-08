// ==================== IMPRESSÃO DE ORDEM DE SERVIÇO (SSMA) ====================
window.imprimirOS_SSMA = async function(idColaborador) {
    // 1. ABRE A JANELA IMEDIATAMENTE (Evita o bloqueador de pop-ups do Chrome/Edge)
    const win = window.open('', '_blank');
    win.document.write('<h3 style="font-family: Arial, sans-serif; padding: 20px; color: #333;">Buscando dados da Ordem de Serviço, aguarde...</h3>');

    try {
        const colab = window.listaColaboradoresSSMA.find(c => c.id === idColaborador);
        if (!colab) {
            win.close();
            return Swal.fire({ title: 'Erro', text: 'Colaborador não encontrado na lista atual.', icon: 'error', background: '#1e293b', color: '#f8fafc', confirmButtonColor: '#3b82f6' });
        }

        if (!colab.funcao) {
            win.close();
            return Swal.fire({ title: 'Função Ausente', text: 'O colaborador não possui um Cargo/Função registrado no RH.', icon: 'warning', background: '#1e293b', color: '#f8fafc', confirmButtonColor: '#3b82f6' });
        }

        // Busca o ID do cargo na tabela base
        const { data: cargosData, error: errCargo } = await window.supabaseClient
            .from('cargos')
            .select('id, nome')
            .ilike('nome', colab.funcao)
            .limit(1);

        if (errCargo || !cargosData || cargosData.length === 0) {
            win.close();
            return Swal.fire({ title: 'Cargo Não Localizado', text: `O cargo "${colab.funcao}" não foi encontrado na base de cargos do sistema. A Ordem de Serviço não pode ser vinculada.`, icon: 'warning', background: '#1e293b', color: '#f8fafc', confirmButtonColor: '#3b82f6' });
        }

        // Busca a Ordem de Serviço preenchida para este cargo
        const { data: osData, error: errOS } = await window.supabaseClient
            .from('ssma_ordem_servico')
            .select('*')
            .eq('cargo_id', cargosData[0].id)
            .limit(1);

        if (errOS || !osData || osData.length === 0) {
            win.close();
            return Swal.fire({ title: 'O.S. Não Cadastrada', html: `Não existe uma Ordem de Serviço (SSMA) cadastrada para o cargo de <b style="color:#3b82f6;">${colab.funcao}</b>.<br><br>Cadastre primeiro no menu <b>"Cadastros Básicos"</b>.`, icon: 'info', background: '#1e293b', color: '#f8fafc', confirmButtonColor: '#3b82f6' });
        }

        const os = osData[0];
        const dataAdmissaoFormatada = colab.data_admissao ? colab.data_admissao.split('-').reverse().join('/') : '-';
        
        // Monta o HTML
        const html = `
        <html>
        <head>
            <title>Ordem de Serviço - ${colab.nome}</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 11px; color: #000; line-height: 1.4; padding: 10px; margin: 0; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
                th, td { border: 1px solid #000; padding: 6px; text-align: left; vertical-align: middle; }
                .text-center { text-align: center; }
                .font-bold { font-weight: bold; }
                .bg-light { background-color: #f0f0f0; }
                .section-header { text-transform: uppercase; font-weight: bold; background-color: #f0f0f0; border: 1px solid #000; padding: 6px; margin-top: 10px; border-bottom: none; }
                .section-body { border: 1px solid #000; padding: 8px; margin-bottom: 10px; text-align: justify; white-space: pre-wrap; font-size: 11px; }
                @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
            </style>
        </head>
        <body>
            <table>
                <tr>
                    <td colspan="4" class="text-center font-bold" style="font-size: 14px;">ORDEM DE SERVIÇO<br><small style="font-weight: normal; font-size: 10px;">CONFORME ESTABELECIDO NO ITEM 1.7, NR 01 DA PORTARIA 3.214/MTE, CABE AO EMPREGADOR ELABORAR ORDEM DE SERVIÇO (OS) SOBRE SEGURANÇA E MEDICINA DO TRABALHO.</small></td>
                </tr>
                <tr>
                    <td colspan="2"><span class="font-bold">EMPRESA:</span> SERRANALOG FLORESTAL SPE LTDA</td>
                    <td colspan="2"><span class="font-bold">CNPJ:</span> 64.120.338/0001-60</td>
                </tr>
                <tr>
                    <td colspan="4"><span class="font-bold">ENDEREÇO:</span> RODOVIA BR 101 SN, ZONA RURAL. MUCURI-BA</td>
                </tr>
                <tr>
                    <td colspan="2"><span class="font-bold">COLABORADOR:</span> ${colab.nome}</td>
                    <td colspan="2"><span class="font-bold">CPF:</span> ${colab.cpf || '-'}</td>
                </tr>
                <tr>
                    <td colspan="2"><span class="font-bold">SETOR:</span> Logística</td>
                    <td colspan="2"><span class="font-bold">FUNÇÃO:</span> ${colab.funcao}</td>
                </tr>
                <tr>
                    <td colspan="2"><span class="font-bold">DATA DE ADMISSÃO:</span> ${dataAdmissaoFormatada}</td>
                    <td colspan="2"><span class="font-bold">ANO DE REVISÃO:</span> ${os.ano_revisao}</td>
                </tr>
            </table>

            <div class="section-header">ATIVIDADES DESENVOLVIDAS</div>
            <div class="section-body">${os.atividades_desenvolvidas}</div>

            <div class="section-header">RISCOS OCUPACIONAIS EXPOSTOS</div>
            <div class="section-body">${os.riscos_ocupacionais_expostos}</div>

            <div class="section-header">EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL (EPI) – USO OBRIGATÓRIO</div>
            <div class="section-body">${os.equipamentos_protecao_individual}</div>

            <div class="section-header">TREINAMENTOS NECESSÁRIOS PARA O COLABORADOR</div>
            <div class="section-body">${os.treinamentos_necessarios}</div>

            <div class="section-header">NORMAS INTERNAS DA EMPRESA</div>
            <div class="section-body">${os.normas_internas}</div>

            <div class="section-header">PROCEDIMENTOS EM CASO DE ACIDENTE DE TRABALHO</div>
            <div class="section-body">${os.procedimentos_acidente_trabalho}</div>

            <div class="section-header">TERMO DE RESPONSABILIDADE</div>
            <div class="section-body">${os.termo_responsabilidade}</div>

            <table style="margin-top: 40px; border: none;">
                <tr style="border: none;">
                    <td style="border: none; text-align: center; width: 50%;">
                        <div style="border-top: 1px solid #000; width: 80%; margin: 0 auto 5px auto;"></div>
                        <strong>Assinatura do Colaborador</strong><br>
                        ${colab.nome}
                    </td>
                    <td style="border: none; text-align: center; width: 50%;">
                        <div style="border-top: 1px solid #000; width: 80%; margin: 0 auto 5px auto;"></div>
                        <strong>Emitente</strong><br>
                        SERRANALOG FLORESTAL SPE LTDA
                    </td>
                </tr>
                <tr style="border: none;">
                    <td colspan="2" style="border: none; text-align: center; padding-top: 30px; font-size: 11px;">
                        Emitido Eletronicamente via SSMA SERRANALOG em ${new Date().toLocaleDateString('pt-BR')}
                    </td>
                </tr>
            </table>
        </body>
        </html>
        `;

        // Escreve na janela que já foi aberta e chama a impressão
        win.document.open();
        win.document.write(html);
        win.document.close();
        
        setTimeout(() => { 
            win.print(); 
            win.close(); 
        }, 1000);

    } catch (e) {
        console.error("Erro na impressão de OS:", e);
        if(!win.closed) win.close();
        Swal.fire({ title: 'Erro', text: 'Ocorreu um erro inesperado ao gerar a impressão.', icon: 'error', background: '#1e293b', color: '#f8fafc' });
    }
};

// ==================== IMPRESSÃO DE FICHA DE EPI (SSMA) ====================
window.imprimirEPI_SSMA = async function(idColaborador) {
    // 1. ABRE A JANELA IMEDIATAMENTE (Evita o bloqueador de pop-ups)
    const win = window.open('', '_blank');
    win.document.write('<h3 style="font-family: Arial, sans-serif; padding: 20px; color: #333;">Processando registros de EPI, aguarde...</h3>');

    try {
        const colab = window.listaColaboradoresSSMA.find(c => c.id === idColaborador);
        if (!colab) {
            win.close();
            return Swal.fire({ title: 'Erro', text: 'Colaborador não encontrado.', icon: 'error', background: '#1e293b', color: '#f8fafc', confirmButtonColor: '#3b82f6' });
        }

        let atividades_text = 'Atividades não descritas. Cadastre a Ordem de Serviço na base.';
        let pecas = [];
        let reqs = [];

        // Busca o texto das atividades na base de SSMA para preencher a ficha de EPI
        if (colab.funcao) {
            const { data: cData } = await window.supabaseClient.from('cargos').select('id').ilike('nome', colab.funcao).limit(1);
            if (cData && cData.length > 0) {
                const { data: osData } = await window.supabaseClient.from('ssma_ordem_servico').select('atividades_desenvolvidas').eq('cargo_id', cData[0].id).limit(1);
                if (osData && osData.length > 0) atividades_text = osData[0].atividades_desenvolvidas;
            }
        }

        // Busca Equipamentos e Requisições do almoxarifado
        const resPecas = await window.supabaseClient.from('almoxarifado_pecas').select('id, codigo, nome, unidade');
        if (resPecas.data) pecas = resPecas.data;
        
        const resReqs = await window.supabaseClient.from('almoxarifado_requisicoes').select('*').eq('colaborador_nome', colab.nome).eq('status', 'Aprovado');
        if (resReqs.data) reqs = resReqs.data;

        const dataNasc = colab.data_nascimento ? colab.data_nascimento.split('-').reverse().join('/') : '-';
        
        let html = `
        <html>
        <head>
            <title>Ficha de EPI - ${colab.nome}</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 11px; color: #000; line-height: 1.4; padding: 10px; margin: 0; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
                th, td { border: 1px solid #000; padding: 6px; text-align: left; vertical-align: middle; }
                .text-center { text-align: center; }
                .font-bold { font-weight: bold; }
                .bg-light { background-color: #f0f0f0; }
                p { text-align: justify; font-size: 11px; margin-bottom: 8px; }
                @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
            </style>
        </head>
        <body>
            <table>
                <tr><td colspan="4" class="text-center font-bold" style="font-size: 14px;">CONTROLE DE EPI</td></tr>
                <tr><td colspan="4"><span class="font-bold">Empresa:</span> SERRANALOG FLORESTAL SPE LTDA</td></tr>
                <tr>
                    <td colspan="2"><span class="font-bold">Colaborador:</span> ${colab.nome}</td>
                    <td colspan="2"><span class="font-bold">Data Nasc:</span> ${dataNasc}</td>
                </tr>
                <tr>
                    <td colspan="2"><span class="font-bold">Função:</span> ${colab.funcao || '-'}</td>
                    <td colspan="2"><span class="font-bold">Setor:</span> Logística</td>
                </tr>
                <tr>
                    <td colspan="4">
                        <span class="font-bold">Descrição das atividades:</span><br>
                        ${atividades_text}
                    </td>
                </tr>
            </table>

            <p>Declaro para todos os efeitos legais que recebi os Equipamentos de Proteção Individual constantes da lista acima, novos e em perfeitas condições de uso, e que estou ciente das obrigações descritas na NR 06, baixada pela Portaria MTb 3214/78, ítem 6.7.</p>
            <p>Declaro, também, que estou ciente das disposições do Art. 462 e 1º da CLT, e autorizo o desconto salarial proporcional ao custo de reparação do dano que os EPI’s aos meus cuidados venham apresentar.</p>
            <p>Declaro ainda que estou ciente das disposições do artigo 158, alínea (a), da CLT, e do item 1.8 da NR 01, em especial daquela do subitem 1.8.1, de que constitui ato faltoso à recusa injustificada de usar EPI fornecido pela empresa, incorrendo nas penas da Lei.</p>

            <div class="font-bold text-center bg-light" style="border: 1px solid #000; padding: 4px; margin-top: 15px; border-bottom: none;">LEGISLAÇÃO – NORMAS REGULAMENTADORAS</div>
            <div style="border: 1px solid #000; padding: 6px; margin-bottom: 15px;">
                <strong>CABE AO EMPREGADO (NR 01, ITEM 1.8)</strong><br>
                a) cumprir as disposições legais e regulamentares sobre segurança e medicina do trabalho, inclusive as ordens de serviço expedidas pelo empregador;<br>
                b) usar o EPI fornecido pelo empregador;<br>
                c) submeter-se aos exames médicos previstos nas Normas Regulamentadoras - NR;<br>
                d) colaborar com a empresa na aplicação das Normas Regulamentadoras - NR.<br><br>
                
                <strong>CABE AO EMPREGADO (NR 06, ITEM 6.7)</strong><br>
                a) usar, utilizando-o apenas para a finalidade a que se destina;<br>
                b) responsabilizar-se pela guarda e conservação;<br>
                c) comunicar ao empregador qualquer alteração que o torne impróprio para uso;<br>
                d) cumprir as determinações do empregador sobre o uso adequado.
            </div>

            <div class="font-bold text-center bg-light" style="border: 1px solid #000; padding: 4px; border-bottom: none;">REGISTRO DE EPI’S – EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL</div>
            <table>
                <thead>
                    <tr class="bg-light">
                        <th style="width: 35%">Descrição do EPI</th>
                        <th style="width: 10%; text-align: center;">Quanti.</th>
                        <th style="width: 15%; text-align: center;">Nº CA / Cód</th>
                        <th style="width: 15%; text-align: center;">Entrega</th>
                        <th style="width: 25%; text-align: center;">Assinatura</th>
                    </tr>
                </thead>
                <tbody>`;

        if (reqs.length === 0) {
            html += `<tr><td colspan="5" class="text-center" style="padding: 20px;">Nenhum equipamento registrado para este colaborador.</td></tr>`;
        } else {
            reqs.forEach(req => {
                let peca = pecas.find(p => p.id == req.peca_id);
                let dataEntrega = req.created_at ? new Date(req.created_at).toLocaleDateString('pt-BR') : '-';
                let imgAssinatura = req.assinatura_url ? `<img src="${req.assinatura_url}" style="max-height: 25px; object-fit: contain;">` : '<span style="color:#aaa;">___________________</span>';

                html += `
                    <tr>
                        <td>${peca ? peca.nome : '-'}</td>
                        <td class="text-center">${req.quantidade}</td>
                        <td class="text-center">${peca ? (peca.codigo || '-') : '-'}</td>
                        <td class="text-center">${dataEntrega}</td>
                        <td class="text-center" style="height: 35px;">${imgAssinatura}</td>
                    </tr>
                `;
            });
        }

        html += `
                </tbody>
            </table>
            
            <table style="margin-top: 40px; border: none;">
                <tr style="border: none;">
                    <td style="border: none; text-align: center; width: 100%;">
                        <div style="border-top: 1px solid #000; width: 40%; margin: 0 auto 5px auto;"></div>
                        <strong>Assinatura do colaborador</strong>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        `;

        win.document.open();
        win.document.write(html);
        win.document.close();
        
        setTimeout(() => { 
            win.print(); 
            win.close(); 
        }, 1000);

    } catch (e) {
        console.error("Erro na impressão de EPI:", e);
        if(!win.closed) win.close();
        Swal.fire({ title: 'Erro', text: 'Ocorreu um erro ao gerar a impressão.', icon: 'error', background: '#1e293b', color: '#f8fafc' });
    }
};