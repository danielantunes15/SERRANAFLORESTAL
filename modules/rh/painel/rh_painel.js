window.listaParaPainelRH = [];

window.initRHPainel = async function() {
    try {
        const tbody = document.getElementById('tbPainelRH');
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Carregando dados do RH...</td></tr>`;
        
        const dados = await db.getColaboradores();
        
        // Filtra garantindo que ignora maiúsculas/minúsculas no status
        window.listaParaPainelRH = dados.filter(c => {
            const status = c.status ? c.status.toLowerCase() : '';
            return status !== 'inativo' && status !== 'desligado';
        });
        
        window.atualizarKPIsPainelRH();
        window.renderizarTabelaPainelRH(window.listaParaPainelRH);
    } catch(e) {
        console.error("Erro ao carregar Painel RH:", e);
        document.getElementById('tbPainelRH').innerHTML = `<tr><td colspan="7" style="color: #ef4444; text-align: center;">Erro ao carregar os dados.</td></tr>`;
    }
};

window.atualizarKPIsPainelRH = function() {
    const total = window.listaParaPainelRH.length;
    
    // Converte para minúsculo para garantir a contagem correta mesmo se no banco estiver "sim", "Sim" ou "SIM"
    const plano = window.listaParaPainelRH.filter(c => c.plano_saude && c.plano_saude.toLowerCase() === 'sim').length;
    const sindicato = window.listaParaPainelRH.filter(c => c.ativo_sindicato && c.ativo_sindicato.toLowerCase() === 'sim').length;
    
    let asoAlertas = 0;
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    
    window.listaParaPainelRH.forEach(c => {
        if(c.aso_vencimento) {
            const venc = new Date(c.aso_vencimento + 'T00:00:00');
            const dif = (venc.getTime() - hoje.getTime()) / (1000 * 3600 * 24);
            if(dif <= 30) asoAlertas++;
        } else {
            asoAlertas++; // Se não tem ASO cadastrado, é um alerta
        }
    });

    document.getElementById('kpiTotalAtivos').innerText = total;
    document.getElementById('kpiPlanoSaude').innerText = plano;
    document.getElementById('kpiSindicato').innerText = sindicato;
    document.getElementById('kpiAsoVencido').innerText = asoAlertas;
};

window.calcularBadgeAsoPainel = function(dataStr) {
    if (!dataStr) return '<span style="color:#ef4444; font-weight:bold;">Não Cadastrado</span>';
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const venc = new Date(dataStr + 'T00:00:00'); 
    const dias = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 3600 * 24));

    if (dias < 0) return '<span style="color:#ef4444; font-weight:bold;">Vencido</span>';
    if (dias <= 30) return `<span style="color:#fb923c; font-weight:bold;">Vence em ${dias}d</span>`;
    return '<span style="color: var(--ccol-green-bright);">Regular</span>';
};

window.renderizarTabelaPainelRH = function(lista) {
    const tbody = document.getElementById('tbPainelRH');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#9ca3af; padding: 20px;">Nenhum colaborador ativo encontrado.</td></tr>`;
        return;
    }

    lista.forEach(c => {
        const mat = c.cod_funcionario ? String(c.cod_funcionario).padStart(4, '0') : '-';
        
        const isPlano = c.plano_saude && c.plano_saude.toLowerCase() === 'sim';
        const planoStr = isPlano ? '<span style="color:var(--ccol-green-bright);">Sim</span>' : '<span style="color:#ef4444;">Não</span>';
        
        const isSind = c.ativo_sindicato && c.ativo_sindicato.toLowerCase() === 'sim';
        const sindStr = isSind ? '<span style="color:#8b5cf6;">Sim</span>' : '<span style="color:#ef4444;">Não</span>';
        
        const asoBadge = window.calcularBadgeAsoPainel(c.aso_vencimento);

        tbody.innerHTML += `
            <tr>
                <td><strong style="color:var(--ccol-blue-bright);">${mat}</strong></td>
                <td style="text-align: left; font-weight: bold;">${c.nome}</td>
                <td>${c.funcao || '-'}</td>
                <td>${c.telefone || '-'}</td>
                <td>${planoStr}</td>
                <td>${sindStr}</td>
                <td>${asoBadge}</td>
            </tr>
        `;
    });
};

window.filtrarTabelaPainelRH = function() {
    const termo = document.getElementById('buscaPainelRH').value.toLowerCase();
    const filtrados = window.listaParaPainelRH.filter(c => 
        (c.nome && c.nome.toLowerCase().includes(termo)) || 
        (c.cod_funcionario && String(c.cod_funcionario).includes(termo)) ||
        (c.funcao && c.funcao.toLowerCase().includes(termo))
    );
    window.renderizarTabelaPainelRH(filtrados);
};