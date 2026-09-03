// ==================== js/ficha_epi_impressao.js ====================

window.gerarHtmlFichaEPI = async function(colaboradores) {
    let pecas = [];
    let reqs = [];
    
    if (window.supabaseClient) {
        const resPecas = await window.supabaseClient.from('almoxarifado_pecas').select('id, codigo, nome, categoria, unidade');
        if (resPecas.data) pecas = resPecas.data;
        
        const resReqs = await window.supabaseClient.from('almoxarifado_requisicoes').select('*').eq('status', 'Aprovado');
        if (resReqs.data) reqs = resReqs.data;
    }

    let html = `<html><head><title>Ficha de EPI / Equipamentos</title><style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #000; }
        .page-break { page-break-after: always; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #000; padding: 8px; text-align: left; }
        th { background-color: #f0f0f0; text-transform: uppercase; font-size: 11px; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .header h2 { margin: 0; font-size: 18px; }
        .header h3 { margin: 5px 0 0 0; font-size: 14px; font-weight: normal; color: #444; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; border: 1px solid #000; padding: 10px; }
        .assinaturas { margin-top: 50px; display: flex; justify-content: space-around; text-align: center; }
        .sig-line { border-top: 1px solid #000; width: 250px; margin: 0 auto 5px auto; }
    </style></head><body>`;

    colaboradores.forEach(c => {
        let itensColab = reqs.filter(r => r.colaborador_nome === c.nome);

        // Verifica se há data de desligamento para exibir no cabeçalho
        let htmlDesligamento = '';
        if (c.data_desligamento) {
            let dataDesligamentoFormatada = c.data_desligamento.split('-').reverse().join('/');
            htmlDesligamento = `<div><strong style="text-transform:uppercase; font-size:10px; color:#555; display:block;">Data Desligamento</strong> ${dataDesligamentoFormatada}</div>`;
        }

        html += `
        <div class="page-break">
            <div class="header">
                <h2>SERRANA FLORESTAL</h2>
                <h3>FICHA DE CONTROLE E ENTREGA DE E.P.I / EQUIPAMENTOS</h3>
            </div>
            <div class="info-grid">
                <div><strong style="text-transform:uppercase; font-size:10px; color:#555; display:block;">Nome do Colaborador</strong> ${c.nome}</div>
                <div><strong style="text-transform:uppercase; font-size:10px; color:#555; display:block;">CPF</strong> ${c.cpf || '-'}</div>
                <div><strong style="text-transform:uppercase; font-size:10px; color:#555; display:block;">Matrícula</strong> ${c.cod_funcionario ? String(c.cod_funcionario).padStart(4, '0') : '-'}</div>
                <div><strong style="text-transform:uppercase; font-size:10px; color:#555; display:block;">Função</strong> ${c.funcao || '-'}</div>
                <div><strong style="text-transform:uppercase; font-size:10px; color:#555; display:block;">Data Admissão</strong> ${c.data_admissao ? c.data_admissao.split('-').reverse().join('/') : '-'}</div>
                ${htmlDesligamento}
            </div>
            
            <p style="text-align: justify; font-size: 11px; line-height: 1.5;">
                Declaro ter recebido os Equipamentos de Proteção Individual (E.P.I) e demais materiais/ferramentas abaixo listadas, 
                comprometendo-me a utilizá-los e conservá-los adequadamente durante o exercício de minhas funções, 
                bem como devolvê-los em caso de desligamento da empresa ou para efetuar a troca do equipamento.
            </p>

            <table>
                <thead>
                    <tr>
                        <th style="width: 15%; text-align:center;">Data e Hora Retirada</th>
                        <th style="width: 15%">C.A. / Cód.</th>
                        <th style="width: 35%">Descrição do Produto</th>
                        <th style="width: 10%; text-align:center;">Qtd</th>
                        <th style="width: 25%; text-align:center;">Assinatura do Colaborador</th>
                    </tr>
                </thead>
                <tbody>`;
                
        if (itensColab.length === 0) {
            html += `<tr><td colspan="5" style="text-align:center; padding: 20px;">Nenhum equipamento registrado para este colaborador.</td></tr>`;
        } else {
            // Utilizando += para concatenar e não sobrescrever os registros iterados
            itensColab.forEach(req => {
                let peca = pecas.find(p => p.id == req.peca_id);
                // Extraindo Data e Hora da Retirada com base no momento de registro
                let dataFormatada = new Date(req.created_at).toLocaleString('pt-BR'); 
                
                let imgAssinaturaNaTabela = req.assinatura_url 
                    ? `<img src="${req.assinatura_url}" style="max-height: 45px; max-width: 100%; object-fit: contain; vertical-align: middle;">` 
                    : `<span style="color: #999; font-size: 10px;">Sem assinatura no sistema</span>`;

                html += `
                    <tr>
                        <td style="text-align:center; vertical-align: middle;">${dataFormatada}</td>
                        <td style="vertical-align: middle;">${peca ? (peca.codigo || '-') : '-'}</td>
                        <td style="vertical-align: middle;">${peca ? peca.nome : 'Item Excluído'}</td>
                        <td style="text-align:center; vertical-align: middle;">${req.quantidade} ${peca ? (peca.unidade||'UN') : ''}</td>
                        <td style="text-align:center; vertical-align: middle; height: 50px;">${imgAssinaturaNaTabela}</td>
                    </tr>
                `;
            });
        }

        html += `
                </tbody>
            </table>

            <div class="assinaturas">
                <div>
                    <div class="sig-line"></div>
                    <strong>Setor SSMA / Segurança do Trabalho</strong>
                </div>
                <div>
                    <div class="sig-line"></div>
                    <strong>${c.nome}</strong><br>
                    <span style="font-size: 11px;">Colaborador</span>
                </div>
            </div>
        </div>`;
    });
    html += `</body></html>`;
    return html;
};

window.imprimirFichaEPI = async function(id) {
    const colab = window.listaColaboradoresDb.find(c => c.id === id);
    if (!colab) return;
    
    const iconBtn = document.activeElement;
    if(iconBtn) iconBtn.style.opacity = '0.5';

    const html = await window.gerarHtmlFichaEPI([colab]);
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    
    if(iconBtn) iconBtn.style.opacity = '1';
    setTimeout(() => { win.print(); win.close(); }, 800);
};

window.exportarTodasFichasEPI = async function() {
    if (window.listaColaboradoresDb.length === 0) return alert("Nenhum colaborador encontrado.");
    
    const html = await window.gerarHtmlFichaEPI(window.listaColaboradoresDb);
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    
    setTimeout(() => { win.print(); win.close(); }, 1500);
};