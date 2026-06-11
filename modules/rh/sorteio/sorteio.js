window.listaParaSorteio = [];

window.initRHSorteio = async function() {
    try {
        const divResultado = document.getElementById('resultadoSorteio');
        if (divResultado) {
            divResultado.innerHTML = `<span style="color: var(--text-secondary);">Aguardando sorteio...</span>`;
        }
        window.listaParaSorteio = await db.getColaboradores();
        // Filtra para sortear apenas colaboradores que NÃO estão Inativos/Desligados
        window.listaParaSorteio = window.listaParaSorteio.filter(c => c.status !== 'Inativo');
    } catch(e) {
        console.error("Erro ao carregar colaboradores para sorteio:", e);
    }
};

window.realizarSorteio = function() {
    const filtro = document.getElementById('filtroPlanoSaude').value;
    let candidatos = window.listaParaSorteio;

    // Aplica o filtro de plano de saúde
    if (filtro === 'Ativos') {
        candidatos = candidatos.filter(c => c.plano_saude === 'Sim');
    } else if (filtro === 'NaoAtivos') {
        candidatos = candidatos.filter(c => c.plano_saude !== 'Sim');
    }

    if (candidatos.length === 0) {
        alert('Nenhum colaborador encontrado com os critérios selecionados.');
        return;
    }

    // Animação de suspense
    const divResultado = document.getElementById('resultadoSorteio');
    divResultado.innerHTML = `<i class="fas fa-spinner fa-spin fa-3x" style="color: var(--ccol-blue-bright);"></i><p style="margin-top:15px; color:#fff;">Sorteando...</p>`;

    setTimeout(() => {
        const index = Math.floor(Math.random() * candidatos.length);
        const vencedor = candidatos[index];

        divResultado.innerHTML = `
            <div style="animation: terminalFadeIn 0.5s ease-out;">
                <h2 style="color: var(--ccol-green-bright); font-size: 2.2rem; margin-bottom: 15px;"><i class="fas fa-trophy" style="color: #f59e0b;"></i> Parabéns!</h2>
                <h3 style="color: #fff; font-size: 1.6rem; font-weight: 800;">${vencedor.nome}</h3>
                <p style="color: var(--ccol-blue-bright); margin-top: 5px; font-weight: 600;">Função: ${vencedor.funcao || 'Não informada'}</p>
                <p style="color: var(--text-secondary); margin-top: 5px; font-size: 0.85rem;">Matrícula: ${vencedor.cod_funcionario ? String(vencedor.cod_funcionario).padStart(4, '0') : 'N/A'}</p>
            </div>
        `;
    }, 1500); // 1.5 segundos de suspense
};