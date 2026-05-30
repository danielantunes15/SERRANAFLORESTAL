// ==================== core/js/menu.js ====================
// ==================== DEFINIÇÃO CENTRAL DE MENUS ====================
window.MAPA_MENUS = [
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
    
    // --- MÓDULO INDEPENDENTE: ALMOXARIFADO ---
    { id: 'almoxarifado', label: 'Gestão de Estoque', setor: 'Almoxarifado', icon: 'fas fa-boxes' },
    { id: 'requisicao_materiais', label: 'Requisição de Materiais', setor: 'Almoxarifado', icon: 'fas fa-shopping-basket' },
    
    { id: 'treinamento', label: 'Treinamento', setor: 'SSMA', icon: 'fas fa-graduation-cap' },

    { id: 'rh_painel', label: 'Painel de RH', setor: 'RH', icon: 'fas fa-users' },
    
    { id: 'centro_custo', label: 'Gestão de Custos', setor: 'Controladoria', icon: 'fas fa-sitemap' },
    
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
    { id: 'visao_executiva', label: 'Visão Executiva (Global)', setor: 'Gerencial', icon: 'fas fa-globe-americas' },
    
    { id: 'central', label: 'Gestão de Filiais', setor: 'Global', icon: 'fas fa-network-wired' },
    { id: 'logs_globais', label: 'Auditoria de Logs', setor: 'Global', icon: 'fas fa-shield-alt' },

    // --- MÓDULOS DE CONFIGURAÇÕES INDEPENDENTES ---
    { id: 'gestao_usuarios', label: 'Gestão de Usuários', setor: 'Configurações', icon: 'fas fa-users' },
    { id: 'gestao_acessos', label: 'Menus e Acessos', setor: 'Configurações', icon: 'fas fa-user-shield' },
    { id: 'auditoria_logs', label: 'Auditoria de Logs', setor: 'Configurações', icon: 'fas fa-history' }
];

const pageCache = {};
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
    'servicos': 'modules/manutencao/servicos/servicos.html',
    'treinamento': 'modules/ssma/treinamento/treinamento.html',
    'rh_painel': 'modules/rh/painel/rh_painel.html',
    'centro_custo': 'modules/controladoria/centro_custo/centro_custo.html', 
    'recados': 'modules/ssma/recados/recados.html',
    'relatorio_gerencial': 'modules/monitoramento/painel/relatorio_gerencial.html',
    'indicadores': 'modules/indicadores/indicadores.html',
    'indicadores_serrana': 'modules/indicadores/indicadores_serrana.html',
    'cadastro_indicadores': 'modules/indicadores/cadastro_indicadores.html',
    'central': 'modules/monitoramento/central/central.html',
    'logs_globais': 'modules/monitoramento/central/logs_globais.html',
    'visao_geral': 'modules/monitoramento/visao_geral/visao_geral.html',
    'operacional': 'modules/monitoramento/operacional/operacional.html',
    'desempenho_frota': 'modules/monitoramento/desempenho_frota/desempenho_frota.html',
    'producao_frota': 'modules/gerencial/producao_frota/producao_frota.html', 
    'visao_executiva': 'modules/gerencial/visao_executiva/visao_executiva.html', 
    'jornadas': 'modules/monitoramento/jornadas/jornadas.html',
    'historico_producao': 'modules/monitoramento/historico/historico.html',
    'historico_jornadas': 'modules/monitoramento/historico_jornadas/historico_jornadas.html',
    'configuracoes_gerencial': 'modules/monitoramento/configuracoes/configuracoes_gerencial.html',
    'gestao_usuarios': 'modules/configuracoes/gestao_usuarios.html',
    'gestao_acessos': 'modules/configuracoes/gestao_acessos.html',
    'auditoria_logs': 'modules/configuracoes/auditoria_logs.html',
    
    // --- ROTAS DO ALMOXARIFADO ---
    'almoxarifado': 'modules/almoxarifado/almoxarifado.html',
    'requisicao_materiais': 'modules/almoxarifado/requisicao_materiais.html'
};

const VERSAO_SISTEMA = "1.0.10";

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
    const cargoKey = (currentUser && currentUser.cargo_id) ? currentUser.cargo_id.toString() : null;

    let meusMenus = [];

    if (cargoKey && permissoesAtuais[cargoKey]) {
        meusMenus = permissoesAtuais[cargoKey];
    } else if (permissoesAtuais[userRole]) {
        meusMenus = permissoesAtuais[userRole];
    }

    if (userKey && permissoesAtuais[userKey] && !permissoesAtuais[userKey].includes('__RESET__')) {
        meusMenus = permissoesAtuais[userKey];
    }
    
    const isAdmin = userRole === 'Admin' || userRole === 'SuperAdmin';
    const isSessaoCentral = (currentUser.filial_id === null || currentUser.filial_id === 'CENTRAL');

    let navHtml = '<nav class="main-nav">';
    const setores = [...new Set(window.MAPA_MENUS.map(m => m.setor))];

    setores.forEach(setor => {
        if (isSessaoCentral) {
            if (setor !== 'Global' && setor !== 'Controladoria' && setor !== 'Configurações') return;
            if (setor === 'Controladoria' && userRole !== 'SuperAdmin') return;
        } else {
            if (setor === 'Global' || setor === 'Controladoria') return;
        }

        const menusDoSetor = window.MAPA_MENUS.filter(m => m.setor === setor);
        const temAcessoAoSetor = isAdmin || menusDoSetor.some(m => meusMenus.includes(m.id));

        if (temAcessoAoSetor) {
            navHtml += `<div class="nav-dropdown" onmouseleave="fecharDropdown(this)">
                <button class="nav-item dropdown-toggle" onclick="toggleDropdown(event)">
                    <i class="${window.getIconSetor(setor)}"></i> ${setor} <i class="fas fa-chevron-down" style="font-size: 0.7rem; margin-left: 5px;"></i>
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

    navHtml += '</nav>';
    container.innerHTML = navHtml;

    setTimeout(() => {
        const firstBtn = container.querySelector('.dropdown-item') || container.querySelector('.nav-item');
        if (firstBtn) firstBtn.click();
    }, 100);

    setTimeout(() => {
        const menusParaPreCarregar = isAdmin ? window.MAPA_MENUS.map(m => m.id) : meusMenus;
        menusParaPreCarregar.forEach(async (menuId) => {
            const caminhoArquivo = ROTAS[menuId];
            if (caminhoArquivo && !pageCache[menuId]) {
                try {
                    const response = await fetch(`${caminhoArquivo}?v=${VERSAO_SISTEMA}`);
                    if (response.ok) pageCache[menuId] = await response.text();
                } catch (e) { }
            }
        });
    }, 2000); 
}

window.getIconSetor = function(setor) {
    const icones = {
        'Logística': 'fas fa-truck',
        'Manutenção': 'fas fa-tools',
        'Almoxarifado': 'fas fa-boxes', 
        'SSMA': 'fas fa-hard-hat',
        'RH': 'fas fa-users', 
        'Controladoria': 'fas fa-sitemap',
        'Indicadores': 'fas fa-chart-line',
        'Monitoramento': 'fas fa-desktop',
        'Gerencial': 'fas fa-briefcase',
        'Global': 'fas fa-globe',
        'Configurações': 'fas fa-cog'
    };
    return icones[setor] || 'fas fa-folder';
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

    if (pagina === 'centro_custo') {
        const isCentral = (currentUser && (currentUser.filial_id === null || currentUser.filial_id === 'CENTRAL'));
        if (!isCentral && userRole !== 'SuperAdmin') {
            alert('Acesso restrito à Matriz e Gestão Corporativa.'); return;
        }
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

    if (pagina === 'painel_tv') {
        if (typeof window.entrarModoTV === 'function') window.entrarModoTV();
    } else {
        if (typeof window.sairModoTV === 'function') window.sairModoTV();
    }

    const mainContent = document.getElementById('conteudo-principal');

    try {
        if (!pageCache[pagina]) {
            mainContent.innerHTML = '<div style="padding: 20px; text-align: center; color: #fff;"><i class="fas fa-spinner fa-spin"></i> Carregando módulo...</div>';
            
            const caminhoArquivo = ROTAS[pagina];
            if (!caminhoArquivo) throw new Error('Rota não definida para o módulo: ' + pagina);

            const response = await fetch(`${caminhoArquivo}?v=${VERSAO_SISTEMA}`);
            if (!response.ok) throw new Error('Página não encontrada');
            pageCache[pagina] = await response.text();
        }
        
        mainContent.innerHTML = pageCache[pagina];

        if (pagina === 'central' && typeof window.renderizarCentral === 'function') window.renderizarCentral();
        if (pagina === 'logs_globais' && typeof window.renderizarLogsGlobais === 'function') window.renderizarLogsGlobais(); 
        if (pagina === 'escala' && typeof window.renderizarEscala === 'function') window.renderizarEscala();
        if (pagina === 'troca_turno' && typeof window.renderizarTrocaTurno === 'function') window.renderizarTrocaTurno();
        if (pagina === 'alocacao' && typeof window.renderizarAlocacao === 'function') window.renderizarAlocacao();
        if (pagina === 'motoristas' && typeof window.renderizarMotoristas === 'function') window.renderizarMotoristas();
        if (pagina === 'caminhoes' && typeof window.renderizarConjuntos === 'function') window.renderizarConjuntos();
        if (pagina === 'almoxarifado' && typeof window.renderizarAlmoxarifado === 'function') window.renderizarAlmoxarifado();
        
        // Inicializador do novo submenu
        if (pagina === 'requisicao_materiais' && typeof window.renderizarRequisicoes === 'function') window.renderizarRequisicoes();
        
        if (pagina === 'os' && typeof window.alternarTelaOS === 'function') window.alternarTelaOS('lista');
        
        if (pagina === 'painel_tv') {
            try { 
                if (typeof carregarDadosOS === 'function') await carregarDadosOS(); 
                if (typeof window.iniciarRelogioTV === 'function') window.iniciarRelogioTV();
                if (typeof window.renderizarCardsTV === 'function') window.renderizarCardsTV();
            } catch(e) { console.error("Erro no Painel TV:", e); }
        }

        if (pagina === 'os_apoio' && typeof window.alternarTelaOSApoio === 'function') window.alternarTelaOSApoio('lista');
        if (pagina === 'rh_painel' && typeof window.initRHPainel === 'function') window.initRHPainel(); 
        if (pagina === 'centro_custo' && typeof window.initControladoria === 'function') window.initControladoria();
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

        if (pagina === 'visao_geral' && typeof window.carregarDadosDashboardAnalitico === 'function') window.carregarDadosDashboardAnalitico();
        if (pagina === 'operacional' && typeof window.initOperacional === 'function') window.initOperacional();
        if (pagina === 'desempenho_frota' && typeof window.initDesempenhoFrota === 'function') window.initDesempenhoFrota();
        if (pagina === 'producao_frota' && typeof window.initProducaoFrota === 'function') window.initProducaoFrota();
        if (pagina === 'visao_executiva' && typeof window.initVisaoExecutiva === 'function') window.initVisaoExecutiva();
        if (pagina === 'jornadas' && typeof window.initJornadas === 'function') window.initJornadas();
        if (pagina === 'historico_producao' && typeof window.initHistoricoProducao === 'function') window.initHistoricoProducao();
        if (pagina === 'historico_jornadas' && typeof window.initHistoricoJornadas === 'function') window.initHistoricoJornadas();
        if (pagina === 'configuracoes_gerencial' && typeof window.inicializarConfiguracoesGerencial === 'function') window.inicializarConfiguracoesGerencial();

        if (pagina === 'gestao_usuarios' && typeof window.renderizarUsuarios === 'function') window.renderizarUsuarios();
        if (pagina === 'gestao_acessos' && typeof window.carregarCheckboxesPermissoes === 'function') window.carregarCheckboxesPermissoes();
        if (pagina === 'auditoria_logs' && typeof window.renderizarLogs === 'function') window.renderizarLogs();

    } catch (error) {
        console.error('Erro ao carregar página:', error);
        mainContent.innerHTML = `<div style="padding: 20px; text-align: center; color: #ef4444;"><h3>Erro de Navegação</h3></div>`;
    }
};