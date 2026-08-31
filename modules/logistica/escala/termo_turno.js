// ==============================================================
// GERAÇÃO DE FORMULÁRIOS E TERMOS DE RH / LOGÍSTICA
// ==============================================================

window.gerarFormularioTrocaTurnoPDF = function(motoristaId) {
    const motorista = motoristas.find(m => String(m.id) === String(motoristaId));
    if (!motorista) return;

    let turnoAtual = motorista.turno && motorista.turno !== '-' ? motorista.turno : 'Não definido';
    let turnoAtualStr = turnoAtual;
    let turnoOpostoStr = 'Horário oposto';
    let equipe = window.getEq(motorista);

    if (turnoAtual.includes('-')) {
        const partes = turnoAtual.split('-');
        // Se for equipe da noite (D, E, F), inverte a ordem de exibição do turno
        if (['D', 'E', 'F'].includes(equipe)) {
            turnoAtualStr = `${partes[1]} às ${partes[0]}`;
            turnoOpostoStr = `${partes[0]} às ${partes[1]}`;
        } else {
            turnoAtualStr = `${partes[0]} às ${partes[1]}`;
            turnoOpostoStr = `${partes[1]} às ${partes[0]}`;
        }
    }

    let html = `
    <html>
    <head>
        <title>Termo de Opção de Turno - ${motorista.nome}</title>
        <style>
            @page { size: A4 portrait; margin: 20mm; }
            body { font-family: Arial, sans-serif; margin: 0; color: #000; font-size: 14px; line-height: 1.6; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 30px; }
            h1 { margin: 0; font-size: 18px; text-transform: uppercase; }
            h2 { margin: 5px 0 0 0; font-size: 16px; font-weight: normal; }
            .content { text-align: justify; margin-bottom: 30px; }
            .options { margin-top: 30px; margin-bottom: 40px; }
            .option-item { margin-bottom: 20px; display: flex; align-items: flex-start; }
            .box { width: 20px; height: 20px; border: 2px solid #000; display: inline-block; margin-right: 15px; flex-shrink: 0; }
            .signatures { margin-top: 60px; }
            .signature-line { border-top: 1px solid #000; width: 80%; margin: 40px auto 10px auto; }
            .signature-text { text-align: center; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Serrana Florestal</h1>
            <h2>TERMO DE OPÇÃO E CONCORDÂNCIA DE TURNO DE TRABALHO</h2>
        </div>
        
        <div class="content">
            Eu, <strong>${motorista.nome}</strong>, inscrito(a) no CPF sob o nº _______________________, 
            atualmente exercendo minhas atividades na escala com horário de <strong>${turnoAtualStr}</strong>, 
            declaro estar ciente das regras de jornada de trabalho da empresa. 
            <br><br>
            Em conformidade com a possibilidade de alteração de turno, manifesto abaixo minha opção, 
            estando ciente e de acordo que, após esta escolha, uma nova alteração só poderá ser solicitada ou realizada 
            após o período mínimo de <strong>6 (seis) meses</strong>.
        </div>

        <div class="options">
            <p style="font-weight: bold; margin-bottom: 15px;">Marque com um "X" a sua opção:</p>
            
            <div class="option-item">
                <div class="box"></div>
                <div><strong>OPÇÃO 1:</strong> Desejo <strong>ALTERAR</strong> meu turno de trabalho atual para o horário oposto, passando a trabalhar no horário das <strong>${turnoOpostoStr}</strong>.</div>
            </div>

            <div class="option-item">
                <div class="box"></div>
                <div><strong>OPÇÃO 2:</strong> Desejo <strong>PERMANECER</strong> no meu turno de trabalho atual, continuando no horário das <strong>${turnoAtualStr}</strong>.</div>
            </div>

            <div class="option-item">
                <div class="box"></div>
                <div><strong>OPÇÃO 3:</strong> Tenho preferência por outro horário (Sujeito à análise e viabilidade da operação): <br><br>__________________________________________________________________________________</div>
            </div>
        </div>

        <div class="signatures">
            <p>Local e Data: ______________________________, _____ de ___________________ de _________</p>
            
            <div style="margin-top: 80px;">
                <div class="signature-line"></div>
                <div class="signature-text">${motorista.nome}</div>
                <div class="signature-text" style="font-weight: normal; font-size: 12px;">Colaborador(a)</div>
            </div>
        </div>
        <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>
    `;

    const w = window.open('', '', 'width=900,height=700');
    w.document.write(html);
    w.document.close();
};

window.gerarTodosFormulariosTrocaTurnoPDF = function() {
    if (!motoristas || motoristas.length === 0) {
        alert('Nenhum motorista encontrado no sistema.');
        return;
    }

    let html = `
    <html>
    <head>
        <title>Termos de Opção de Turno - Todos</title>
        <style>
            @page { size: A4 portrait; margin: 20mm; }
            body { font-family: Arial, sans-serif; margin: 0; color: #000; font-size: 14px; line-height: 1.6; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 30px; }
            h1 { margin: 0; font-size: 18px; text-transform: uppercase; }
            h2 { margin: 5px 0 0 0; font-size: 16px; font-weight: normal; }
            .content { text-align: justify; margin-bottom: 30px; }
            .options { margin-top: 30px; margin-bottom: 40px; }
            .option-item { margin-bottom: 20px; display: flex; align-items: flex-start; }
            .box { width: 20px; height: 20px; border: 2px solid #000; display: inline-block; margin-right: 15px; flex-shrink: 0; }
            .signatures { margin-top: 60px; }
            .signature-line { border-top: 1px solid #000; width: 80%; margin: 40px auto 10px auto; }
            .signature-text { text-align: center; font-weight: bold; }
            .page-break { page-break-after: always; }
        </style>
    </head>
    <body>`;

    motoristas.forEach((motorista, index) => {
        let turnoAtual = motorista.turno && motorista.turno !== '-' ? motorista.turno : 'Não definido';
        let turnoAtualStr = turnoAtual;
        let turnoOpostoStr = 'Horário oposto';
        let equipe = window.getEq(motorista);

        if (turnoAtual.includes('-')) {
            const partes = turnoAtual.split('-');
            // Se for equipe da noite (D, E, F), inverte a ordem de exibição do turno
            if (['D', 'E', 'F'].includes(equipe)) {
                turnoAtualStr = `${partes[1]} às ${partes[0]}`;
                turnoOpostoStr = `${partes[0]} às ${partes[1]}`;
            } else {
                turnoAtualStr = `${partes[0]} às ${partes[1]}`;
                turnoOpostoStr = `${partes[1]} às ${partes[0]}`;
            }
        }

        html += `
        <div class="${index < motoristas.length - 1 ? 'page-break' : ''}">
            <div class="header">
                <h1>Serrana Florestal</h1>
                <h2>TERMO DE OPÇÃO E CONCORDÂNCIA DE TURNO DE TRABALHO</h2>
            </div>
            
            <div class="content">
                Eu, <strong>${motorista.nome}</strong>, inscrito(a) no CPF sob o nº _______________________, 
                atualmente exercendo minhas atividades na escala com horário de <strong>${turnoAtualStr}</strong>, 
                declaro estar ciente das regras de jornada de trabalho da empresa. 
                <br><br>
                Em conformidade com a possibilidade de alteração de turno, manifesto abaixo minha opção, 
                estando ciente e de acordo que, após esta escolha, uma nova alteração só poderá ser solicitada ou realizada 
                após o período mínimo de <strong>6 (seis) meses</strong>.
            </div>

            <div class="options">
                <p style="font-weight: bold; margin-bottom: 15px;">Marque com um "X" a sua opção:</p>
                
                <div class="option-item">
                    <div class="box"></div>
                    <div><strong>OPÇÃO 1:</strong> Desejo <strong>ALTERAR</strong> meu turno de trabalho atual para o horário oposto, passando a trabalhar no horário das <strong>${turnoOpostoStr}</strong>.</div>
                </div>

                <div class="option-item">
                    <div class="box"></div>
                    <div><strong>OPÇÃO 2:</strong> Desejo <strong>PERMANECER</strong> no meu turno de trabalho atual, continuando no horário das <strong>${turnoAtualStr}</strong>.</div>
                </div>

                <div class="option-item">
                    <div class="box"></div>
                    <div><strong>OPÇÃO 3:</strong> Tenho preferência por outro horário (Sujeito à análise e viabilidade da operação): <br><br>__________________________________________________________________________________</div>
                </div>
            </div>

            <div class="signatures">
                <p>Local e Data: ______________________________, _____ de ___________________ de _________</p>
                
                <div style="margin-top: 80px;">
                    <div class="signature-line"></div>
                    <div class="signature-text">${motorista.nome}</div>
                    <div class="signature-text" style="font-weight: normal; font-size: 12px;">Colaborador(a)</div>
                </div>
            </div>
        </div>`;
    });

    html += `
        <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>`;

    const w = window.open('', '', 'width=900,height=700');
    w.document.write(html);
    w.document.close();
};