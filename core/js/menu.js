// ==================== core/js/menu.js ====================
// ==================== DEFINIÇÃO CENTRAL DE MENUS ====================
const MAPA_MENUS = [
    { id: 'escala', label: 'Escala Semanal', setor: 'Logística', icon: 'fas fa-calendar-alt' },
    { id: 'troca_turno', label: 'Troca de Turno', setor: 'Logística', icon: 'fas fa-exchange-alt' },
    { id: 'alocacao', label: 'Alocação Geral', setor: 'Logística', icon: 'fas fa-users-cog' },
    { id: 'recados', label: 'Recados e Anotações', setor: 'Logística', icon: 'fas fa-sticky-note' },
    { id: 'motoristas', label: 'Motoristas', setor: 'Logística', icon: 'fas fa-id-card' },
    { id: 'caminhoes', label: 'Conjuntos & Caminhões', setor: 'Logística', icon: 'fas fa-truck' },
    { id: 'documentos_frota', label: 'Documentos da Frota', setor: 'Logística', icon: 'fas fa-file-pdf' },
    
    { id: 'os', label: 'Gestão de O.S.', setor: 'Manutenção', icon: 'fas fa-clipboard-list' },
    { id: 'painel_tv', label: 'Painel TV (Tempo Real)', setor: 'Manutenção', icon: 'fas fa-tv' },
    { id: 'servicos', label: 'Serviços (Mecânicos)', setor: 'Manutenção', icon: 'fas fa-toolbox' },
    { id: 'cadastro_frota', label: 'Cadastro Frota (O.S.)', setor: 'Manutenção', icon: 'fas fa-truck-moving' },
    { id: 'os_apoio', label: 'O.S. Apoio', setor: 'Manutenção', icon: 'fas fa-truck-pickup' },
    { id: 'almoxarifado', label: 'Almoxarifado', setor: 'Manutenção', icon: 'fas fa-boxes' },
    
    { id: 'treinamento', label: 'Treinamento', setor: 'SSMA', icon: 'fas fa-graduation-cap' },
    
    { id: 'relatorio_gerencial', label: 'Relatório Gerencial', setor: 'Indicadores', icon: 'fas fa-chart-pie' },
    { id: 'indicadores', label: 'Indicadores - Cliente', setor: 'Indicadores', icon: 'fas fa-chart-area' },
    { id: 'indicadores_serrana', label: 'Indicadores Serrana', setor: 'Indicadores', icon: 'fas fa-chart-bar' },
    { id: 'cadastro_indicadores', label: 'Cadastro Indicadores', setor: 'Indicadores', icon: 'fas fa-list-alt' },

    { id: 'visao_geral', label: 'Visão Geral (Analítico)', setor: 'Monitoramento', icon: 'fas fa-chart-pie' },
    { id: 'operacional', label: 'Metas Operacionais', setor: 'Monitoramento', icon: 'fas fa-chart-line' },
    { id: 'desempenho_frota', label: 'Desempenho da Frota', setor: 'Monitoramento', icon: 'fas fa-truck-fast' },
    { id: 'jornadas', label: 'Monitoramento de Jornadas', setor: 'Monitoramento', icon: 'fas fa-user-clock' },
    { id: 'historico_producao', label: 'Histórico de Produção', setor: 'Monitoramento', icon: 'fas fa-database' },
    { id: 'historico_jornadas', label: 'Histórico de Jornadas', setor: 'Monitoramento', icon: 'fas fa-history' },
    { id: 'configuracoes_gerencial', label: 'Configurações de Metas', setor: 'Monitoramento', icon: 'fas fa-cogs' },

    { id: 'producao_frota', label: 'Produção e Faturamento', setor: 'Gerencial', icon: 'fas fa-money-bill-wave' },
    
    { id: 'central', label: 'Gestão de Filiais', setor: 'Global', icon: 'fas fa-network-wired' },
    { id: 'logs_globais', label: 'Auditoria de Logs', setor: 'Global', icon: 'fas fa-shield-alt' } 
];

const pageCache = {};

window.renderizarMenu = async function() {
    const container = document.getElementById('menu-container');
    if (!container) return;

    let permissoesAtuais = {};
    if (typeof db !== 'undefined' && typeof db.getPermissoesDB === 'function') {
        permissoesAtuais = await db.getPermissoesDB();
    } else if (typeof window.getPermissoes === 'function') {
        permissoesAtuais = window.getPermissoes();
    }

    const userRole = (currentUser && currentUser.role) ? currentUser.role : 'Admin';
    const userKey = currentUser ? 'user_' + currentUser.id : '';

    let meusMenus = permissoesAtuais[userRole] || [];
    if (userKey && permissoesAtuais[userKey] && !permissoesAtuais[userKey].includes('__RESET__')) {
        meusMenus = permissoesAtuais[userKey];
    }
    
    const isAdmin = userRole === 'Admin' || userRole === 'SuperAdmin';
    const isGerente = userRole === 'Gerente';
    const isSessaoCentral = (currentUser.filial_id === null || currentUser.filial_id === 'CENTRAL');

    let navHtml = '<nav class="main-nav">';
    const setores = [...new Set(MAPA_MENUS.map(m => m.setor))];

    setores.forEach(setor => {
        if (isSessaoCentral) {
            if (setor !== 'Global') return; 
        } else {
            if (setor === 'Global') return;
        }

        const menusDoSetor = MAPA_MENUS.filter(m => m.setor === setor);
        const temAcessoAoSetor = isAdmin || menusDoSetor.some(m => meusMenus.includes(m.id));

        if (temAcessoAoSetor) {
            navHtml += `<div class="nav-dropdown" onmouseleave="fecharDropdown(this)">
                <button class="nav-item dropdown-toggle" onclick="toggleDropdown(event)">
                    <i class="${getIconSetor(setor)}"></i> ${setor} <i class="fas fa-chevron-down" style="font-size: 0.7rem; margin-left: 5px;"></i>
                </button>
                <div class="dropdown-menu">`;
            
            menusDoSetor.forEach(menu => {
                if (meusMenus.includes(menu.id) || isAdmin) {
                    navHtml += `<button class="dropdown-item" onclick="navegarPara('${menu.id}', this)">
                        <i class="${menu.icon}"></i> ${menu.label}
                    </button>`;
                }
            });
            navHtml += `</div></div>`;
        }
    });

    if ((isAdmin || isGerente) && !isSessaoCentral) {
        navHtml += `<button id="navConfigBtn" class="nav-item" onclick="navegarPara('config', this)"><i class="fas fa-cog"></i> Configurações</button>`;
    }

    navHtml += '</nav>';
    container.innerHTML = navHtml;

    setTimeout(() => {
        const firstBtn = container.querySelector('.dropdown-item') || container.querySelector('.nav-item');
        if (firstBtn) firstBtn.click();
    }, 100);
}

function getIconSetor(setor) {
    const icones = {
        'Logística': 'fas fa-truck',
        'Manutenção': 'fas fa-tools',
        'SSMA': 'fas fa-hard-hat',
        'Indicadores': 'fas fa-chart-line',
        'Monitoramento': 'fas fa-desktop',
        'Gerencial': 'fas fa-briefcase',
        'Global': 'fas fa-globe'
    };
    return icones[setor] || 'fas fa-folder';
}

window.carregarCheckboxesPermissoes = async function() {
    const container = document.getElementById('container-permissoes-menus');
    if (!container) return;

    if (!document.getElementById('css-permissoes-cards')) {
        const style = document.createElement('style');
        style.id = 'css-permissoes-cards';
        style.innerHTML = `
            .permissao-card { background: #1e293b; border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); display: flex; flex-direction: column; }
            .permissao-header { display:flex; align-items: center; gap: 10px; margin-bottom: 15px; color: #f8fafc; font-size: 1rem; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px; }
            .permissao-icon-box { width: 32px; height: 32px; border-radius: 8px; background: rgba(59, 130, 246, 0.1); display: flex; align-items: center; justify-content: center; color: #3b82f6; }
            .permissao-item { color: #cbd5e1; font-size: 0.85rem; display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 8px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.03); transition: all 0.2s; cursor: pointer; }
            .permissao-item:hover:not(.disabled-item) { background: rgba(255,255,255,0.06); border-color: rgba(59, 130, 246, 0.3); }
            .permissao-item.disabled-item { opacity: 0.4; cursor: not-allowed; }
            .permissao-item input[type="checkbox"] { width: 18px; height: 18px; accent-color: #3b82f6; cursor: inherit; }
            .permissao-item-icon { background: rgba(15, 23, 42, 0.5); width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 0.8rem; }
        `;
        document.head.appendChild(style);
    }

    const tipo = document.querySelector('input[name="tipoPermissao"]:checked')?.value || 'perfil';
    let alvo = 'Controlador de Tráfego';
    
    if (tipo === 'perfil') {
        alvo = document.getElementById('selectPerfilPermissao')?.value || 'Controlador de Tráfego';
    } else {
        alvo = document.getElementById('selectUsuarioPermissao')?.value;
        if(!alvo) return;
    }

    let permissoesAtuais = {};
    if (typeof db !== 'undefined' && typeof db.getPermissoesDB === 'function') {
        permissoesAtuais = await db.getPermissoesDB();
    } else if (typeof window.getPermissoes === 'function') {
        permissoesAtuais = window.getPermissoes();
    }
    
    let meusAcessos = permissoesAtuais[alvo] || [];
    const isSuperAdmin = (currentUser && currentUser.role === 'SuperAdmin');

    if (tipo === 'usuario' && (!permissoesAtuais[alvo] || meusAcessos.includes('__RESET__'))) {
        const selectUser = document.getElementById('selectUsuarioPermissao');
        const textoOpcao = selectUser.options[selectUser.selectedIndex].text;
        const matchRole = textoOpcao.match(/\((.*?)\)/);
        const roleDesteUser = matchRole ? matchRole[1] : null;
        
        if (roleDesteUser && permissoesAtuais[roleDesteUser]) {
            meusAcessos = permissoesAtuais[roleDesteUser];
        } else {
            meusAcessos = [];
        }
    }

    let html = '';
    const setores = [...new Set(MAPA_MENUS.map(m => m.setor))];

    setores.forEach(setor => {
        if (setor === 'Global') return; 

        html += `
        <div class="permissao-card">
            <div class="permissao-header">
                <div class="permissao-icon-box"><i class="${getIconSetor(setor)}"></i></div>
                ${setor}
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px; flex: 1;">`;
        
        MAPA_MENUS.filter(m => m.setor === setor).forEach(menu => {
            const checked = meusAcessos.includes(menu.id) ? 'checked' : '';
            const disabled = (menu.setor === 'Gerencial' && !isSuperAdmin) ? 'disabled' : '';
            const disabledClass = disabled ? 'disabled-item' : '';
            const extraInfo = disabled ? ' title="Apenas SuperAdmin pode alterar este acesso"' : '';

            html += `
                <label class="permissao-item ${disabledClass}" ${extraInfo}>
                    <input type="checkbox" class="chk-permissao" value="${menu.id}" ${checked} ${disabled}>
                    <div class="permissao-item-icon">
                        <i class="${menu.icon}"></i>
                    </div>
                    <span style="flex: 1; font-weight: 500;">${menu.label}</span>
                </label>`;
        });

        html += `</div></div>`;
    });

    container.innerHTML = html;
}

window.toggleDropdown = function(event) {
    const btn = event.currentTarget; 
    const menu = btn.nextElementSibling;
    if (menu) menu.classList.toggle('show');
}

window.fecharDropdown = function(dropdownElement) {
    const menu = dropdownElement.querySelector('.dropdown-menu');
    if (menu) menu.classList.remove('show');
}

window.navegarPara = async function(pagina, elementoClicado) {
    const userRole = (currentUser && currentUser.role) ? currentUser.role : 'Admin';

    if (pagina === 'config' && userRole !== 'Admin' && userRole !== 'SuperAdmin' && userRole !== 'Gerente') {
        alert('Acesso Negado.'); return; 
    }

    if (elementoClicado) {
        document.querySelectorAll('.nav-item, .dropdown-item').forEach(el => el.classList.remove('active'));
        elementoClicado.classList.add('active');
        
        if(elementoClicado.classList.contains('dropdown-item')) {
            const dropdown = elementoClicado.closest('.nav-dropdown');
            if (dropdown) dropdown.querySelector('.dropdown-toggle').classList.add('active');
            const menu = document.querySelector('.dropdown-menu.show');
            if (menu) menu.classList.remove('show');
        }
    }

    // --- LÓGICA DO MODO TV IMERSIVO ---
    if (pagina === 'painel_tv') {
        if (typeof window.entrarModoTV === 'function') window.entrarModoTV();
    } else {
        if (typeof window.sairModoTV === 'function') window.sairModoTV();
    }

    const mainContent = document.getElementById('conteudo-principal');

    const ROTAS = {
        'escala': 'modules/logistica/escala/escala.html',
        'troca_turno': 'modules/logistica/troca_turno/troca_turno.html',
        'alocacao': 'modules/logistica/alocacao/alocacao.html',
        'motoristas': 'modules/logistica/motoristas/motoristas.html',
        'caminhoes': 'modules/manutencao/caminhoes/caminhoes.html',
        'cadastro_frota': 'modules/logistica/frota_conjuntos/cadastro_frota.html',
        'documentos_frota': 'modules/logistica/documentos_frota/documentos_frota.html',
        
        'os': 'modules/manutencao/ordem_servico/os.html',
        'painel_tv': 'modules/manutencao/ordem_servico/painel_tv.html',
        'os_apoio': 'modules/manutencao/ordem_servico/os_apoio.html',
        'almoxarifado': 'modules/manutencao/almoxarifado/almoxarifado.html',
        'servicos': 'modules/manutencao/servicos/servicos.html',
        
        'treinamento': 'modules/ssma/treinamento/treinamento.html',
        'recados': 'modules/ssma/recados/recados.html',
        
        'relatorio_gerencial': 'modules/monitoramento/painel/relatorio_gerencial.html',
        'indicadores': 'modules/monitoramento/indicadores/indicadores.html',
        'indicadores_serrana': 'modules/monitoramento/indicadores/indicadores_serrana.html',
        'cadastro_indicadores': 'modules/monitoramento/indicadores/cadastro_indicadores.html',
        'config': 'modules/monitoramento/config/config.html',
        'central': 'modules/monitoramento/central/central.html',
        'logs_globais': 'modules/monitoramento/central/logs_globais.html',
        
        'visao_geral': 'modules/monitoramento/visao_geral/visao_geral.html',
        'operacional': 'modules/monitoramento/operacional/operacional.html',
        'desempenho_frota': 'modules/monitoramento/desempenho_frota/desempenho_frota.html',
        'producao_frota': 'modules/gerencial/producao_frota/producao_frota.html', 
        'jornadas': 'modules/monitoramento/jornadas/jornadas.html',
        'historico_producao': 'modules/monitoramento/historico/historico.html',
        'historico_jornadas': 'modules/monitoramento/historico_jornadas/historico_jornadas.html',
        'configuracoes_gerencial': 'modules/monitoramento/configuracoes/configuracoes_gerencial.html'
    };

    try {
        if (!pageCache[pagina]) {
            mainContent.innerHTML = '<div style="padding: 20px; text-align: center; color: #fff;"><i class="fas fa-spinner fa-spin"></i> Carregando módulo...</div>';
            
            const caminhoArquivo = ROTAS[pagina];
            if (!caminhoArquivo) throw new Error('Rota não definida para o módulo: ' + pagina);

            const response = await fetch(`${caminhoArquivo}?v=` + new Date().getTime());
            if (!response.ok) throw new Error('Página não encontrada');
            pageCache[pagina] = await response.text();
        }
        
        mainContent.innerHTML = pageCache[pagina];

        // GATILHOS DE INICIALIZAÇÃO
        if (pagina === 'central' && typeof window.renderizarCentral === 'function') window.renderizarCentral();
        if (pagina === 'logs_globais' && typeof window.renderizarLogsGlobais === 'function') window.renderizarLogsGlobais(); 
        if (pagina === 'escala' && typeof window.renderizarEscala === 'function') window.renderizarEscala();
        if (pagina === 'troca_turno' && typeof window.renderizarTrocaTurno === 'function') window.renderizarTrocaTurno();
        if (pagina === 'alocacao' && typeof window.renderizarAlocacao === 'function') window.renderizarAlocacao();
        if (pagina === 'motoristas' && typeof window.renderizarMotoristas === 'function') window.renderizarMotoristas();
        if (pagina === 'caminhoes' && typeof window.renderizarConjuntos === 'function') window.renderizarConjuntos();
        if (pagina === 'almoxarifado' && typeof window.renderizarAlmoxarifado === 'function') window.renderizarAlmoxarifado();
        
        if (pagina === 'os' && typeof window.alternarTelaOS === 'function') window.alternarTelaOS('lista');
        
        if (pagina === 'painel_tv') {
            try { 
                if (typeof carregarDadosOS === 'function') await carregarDadosOS(); 
                if (typeof window.iniciarRelogioTV === 'function') window.iniciarRelogioTV();
                if (typeof window.renderizarCardsTV === 'function') window.renderizarCardsTV();
            } catch(e) { console.error("Erro no Painel TV:", e); }
        }

        if (pagina === 'os_apoio' && typeof window.alternarTelaOSApoio === 'function') window.alternarTelaOSApoio('lista');
        if (pagina === 'recados' && typeof window.carregarRecados === 'function') window.carregarRecados();
        if (pagina === 'treinamento' && typeof window.renderizarPaginaTreinamento === 'function') window.renderizarPaginaTreinamento();
        if (pagina === 'indicadores' && typeof window.carregarDadosDashboard === 'function') window.carregarDadosDashboard();
        if (pagina === 'indicadores_serrana' && typeof window.carregarDadosDashboardSerrana === 'function') window.carregarDadosDashboardSerrana();
        if (pagina === 'cadastro_indicadores' && typeof window.initCadastroIndicadores === 'function') window.initCadastroIndicadores();
        if (pagina === 'servicos' && typeof window.renderizarTelaServicos === 'function') window.renderizarTelaServicos();
        if (pagina === 'cadastro_frota' && typeof window.renderizarTelaCadastroFrota === 'function') window.renderizarTelaCadastroFrota();
        if (pagina === 'documentos_frota' && typeof window.renderizarTelaDocumentosFrota === 'function') window.renderizarTelaDocumentosFrota();

        if (pagina === 'relatorio_gerencial') {
            try { if (typeof carregarDadosOS === 'function') await carregarDadosOS(); } catch(e) {}
            if (typeof window.atualizarKPIsGlobais === 'function') window.atualizarKPIsGlobais();
            if (typeof window.renderizarRelatorioGerencialOS === 'function') window.renderizarRelatorioGerencialOS();
            if (typeof window.renderizarGraficoEvolucaoDM === 'function') window.renderizarGraficoEvolucaoDM();
            if (typeof window.renderizarGraficoStatusFrotaHorario === 'function') window.renderizarGraficoStatusFrotaHorario();
            if (typeof window.renderizarGraficoEvolucaoDMDiaria === 'function') window.renderizarGraficoEvolucaoDMDiaria();
            if (typeof window.renderizarDMIndividual === 'function') window.renderizarDMIndividual();
        }

        if (pagina === 'config') {
            if (typeof window.renderizarUsuarios === 'function') window.renderizarUsuarios();
            if (typeof window.renderizarLogs === 'function') window.renderizarLogs();
            window.carregarCheckboxesPermissoes(); 
        }

        if (pagina === 'visao_geral' && typeof window.carregarDadosDashboardAnalitico === 'function') window.carregarDadosDashboardAnalitico();
        if (pagina === 'operacional' && typeof window.initOperacional === 'function') window.initOperacional();
        if (pagina === 'desempenho_frota' && typeof window.initDesempenhoFrota === 'function') window.initDesempenhoFrota();
        if (pagina === 'producao_frota' && typeof window.initProducaoFrota === 'function') window.initProducaoFrota();
        if (pagina === 'jornadas' && typeof window.initJornadas === 'function') window.initJornadas();
        if (pagina === 'historico_producao' && typeof window.initHistoricoProducao === 'function') window.initHistoricoProducao();
        if (pagina === 'historico_jornadas' && typeof window.initHistoricoJornadas === 'function') window.initHistoricoJornadas();
        if (pagina === 'configuracoes_gerencial' && typeof window.inicializarConfiguracoesGerencial === 'function') window.inicializarConfiguracoesGerencial();

    } catch (error) {
        console.error('Erro ao carregar página:', error);
        mainContent.innerHTML = `<div style="padding: 20px; text-align: center; color: #ef4444;"><h3>Erro de Navegação</h3></div>`;
    }
};