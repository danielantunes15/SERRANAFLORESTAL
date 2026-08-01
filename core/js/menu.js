// ==================== core/js/menu.js ====================
// ==================== DEFINIÇÃO CENTRAL DE MENUS ====================
window.MAPA_MENUS = [
    { id: 'escala', label: 'Escala Semanal', setor: 'Logística', icon: 'fas fa-calendar-alt' },
    { id: 'troca_turno', label: 'Troca de Turno', setor: 'Logística', icon: 'fas fa-exchange-alt' },
    { id: 'alocacao', label: 'Alocação Geral', setor: 'Logística', icon: 'fas fa-users-cog' },
    { id: 'recados', label: 'Recados e Anotações', setor: 'Logística', icon: 'fas fa-sticky-note' },
    { id: 'caminhoes', label: 'Conjuntos & Caminhões', setor: 'Logística', icon: 'fas fa-truck' },
    { id: 'documentos_frota', label: 'Documentos da Frota', setor: 'Logística', icon: 'fas fa-file-pdf' },
    
    // --- MÓDULO: CAMPO (ATUALIZADO) ---
    { id: 'campo_escala', label: 'Escala Semanal', setor: 'Campo', icon: 'fas fa-calendar-alt' },
    { id: 'alocacao_campo', label: 'Alocação Geral', setor: 'Campo', icon: 'fas fa-users-cog' },
    { id: 'campo_equipe', label: 'Cadastro de Equipe', setor: 'Campo', icon: 'fas fa-users' },
    { id: 'campo_maquinas', label: 'Máquinas (Frentes)', setor: 'Campo', icon: 'fas fa-tractor' },
    
    { id: 'os', label: 'Gestão de O.S.', setor: 'Manutenção', icon: 'fas fa-clipboard-list' },
    { id: 'historico_os', label: 'Histórico de O.S.', setor: 'Manutenção', icon: 'fas fa-history' },
    { id: 'painel_tv', label: 'Painel TV (Tempo Real)', setor: 'Manutenção', icon: 'fas fa-tv' },
    { id: 'servicos', label: 'Serviços (Mecânicos)', setor: 'Manutenção', icon: 'fas fa-toolbox' },
    { id: 'borracharia', label: 'Borracharia', setor: 'Manutenção', icon: 'fas fa-life-ring' },
    { id: 'cadastro_frota', label: 'Cadastro Frota (O.S.)', setor: 'Manutenção', icon: 'fas fa-truck-moving' },
    { id: 'cadastro_os_classificacoes', label: 'Cadastro Básico (Tipos)', setor: 'Manutenção', icon: 'fas fa-list' },
    
    // --- MÓDULO INDEPENDENTE: ALMOXARIFADO ---
    { id: 'almoxarifado', label: 'Gestão de Estoque', setor: 'Almoxarifado', icon: 'fas fa-boxes' },
    { id: 'almoxarifado_entregas', label: 'Entregas & Requisições', setor: 'Almoxarifado', icon: 'fas fa-clipboard-check' },
    { id: 'requisicao_materiais', label: 'Requisitar Material', setor: 'Almoxarifado', icon: 'fas fa-hand-holding-medical' },
    { id: 'almoxarifado_relatorios', label: 'Painel de Relatórios', setor: 'Almoxarifado', icon: 'fas fa-chart-pie' },
    { id: 'almoxarifado_cadastros', label: 'Cadastros Almoxarifado', setor: 'Almoxarifado', icon: 'fas fa-list-alt' },
    
    { id: 'treinamento', label: 'Treinamento', setor: 'SSMA', icon: 'fas fa-graduation-cap' },
    { id: 'rh_painel', label: 'Painel de RH', setor: 'RH', icon: 'fas fa-users' },
    { id: 'rh_colaboradores', label: 'Cadastro de Colaboradores', setor: 'RH', icon: 'fas fa-id-badge' },
    { id: 'rh_absenteismo', label: 'Absenteísmo', setor: 'RH', icon: 'fas fa-user-clock' },
    { id: 'rh_sorteio', label: 'Sorteio de Colaboradores', setor: 'RH', icon: 'fas fa-random' },
    { id: 'rh_configuracoes', label: 'Configurações Base', setor: 'RH', icon: 'fas fa-cogs' },
    
    { id: 'centro_custo', label: 'Gestão de Custos', setor: 'Controladoria', icon: 'fas fa-sitemap' },
    { id: 'ocorrencias', label: 'Registrar Ocorrência', setor: 'Controladoria', icon: 'fas fa-exclamation-triangle' },
    { id: 'historico_ocorrencias', label: 'Histórico de Ocorrências', setor: 'Controladoria', icon: 'fas fa-history' },
    { id: 'relatorio_ocorrencias', label: 'Relatório de Avarias', setor: 'Controladoria', icon: 'fas fa-chart-bar' },
    
    { id: 'relatorio_gerencial', label: 'Relatório Gerencial', setor: 'Indicadores', icon: 'fas fa-chart-pie' },
    { id: 'indicadores', label: 'Indicadores - Cliente', setor: 'Indicadores', icon: 'fas fa-chart-area' },
    { id: 'indicadores_serrana', label: 'Indicadores Serrana', setor: 'Indicadores', icon: 'fas fa-chart-bar' },
    { id: 'cadastro_indicadores', label: 'Cadastro Indicadores', setor: 'Indicadores', icon: 'fas fa-list-alt' },
    
    { id: 'visao_geral', label: 'Visão Geral (Analítico)', setor: 'Monitoramento', icon: 'fas fa-chart-pie' },
    { id: 'operacional', label: 'Metas Operacionais', setor: 'Monitoramento', icon: 'fas fa-chart-line' },
    { id: 'desempenho_frota', label: 'Desempenho da Frota', setor: 'Monitoramento', icon: 'fas fa-truck-fast' },
    { id: 'desempenho_grua', label: 'Desempenho de Gruas', setor: 'Monitoramento', icon: 'fas fa-truck-loading' },
    { id: 'jornadas', label: 'Monitoramento de Jornadas', setor: 'Monitoramento', icon: 'fas fa-user-clock' },
    { id: 'historico_producao', label: 'Histórico de Produção', setor: 'Monitoramento', icon: 'fas fa-database' },
    { id: 'historico_jornadas', label: 'Histórico de Jornadas', setor: 'Monitoramento', icon: 'fas fa-history' },
    { id: 'configuracoes_gerencial', label: 'Configurações de Metas', setor: 'Monitoramento', icon: 'fas fa-cogs' },
    { id: 'cadastro_up', label: 'Cadastro de UP e Fazendas', setor: 'Monitoramento', icon: 'fas fa-map-marked-alt' },
    
    { id: 'producao_frota', label: 'Produção e Faturamento', setor: 'Gerencial', icon: 'fas fa-money-bill-wave' },
    { id: 'evolucao_fazendas', label: 'Evolução das Fazendas', setor: 'Gerencial', icon: 'fas fa-seedling' },
    { id: 'visao_executiva', label: 'Visão Executiva (Global)', setor: 'Gerencial', icon: 'fas fa-globe-americas' },
    { id: 'tarifador', label: 'Tarifador', setor: 'Gerencial', icon: 'fas fa-calculator' },
    { id: 'configuracoes_gerenciais', label: 'Configurações Gerenciais', setor: 'Gerencial', icon: 'fas fa-cog' },
    
    // --- MÓDULO GLOBAL ---
    { id: 'gestao_filiais', label: 'Gestão de Filiais', setor: 'Global', icon: 'fas fa-network-wired' },
    { id: 'auditoria_logs', label: 'Auditoria de Sistema', setor: 'Global', icon: 'fas fa-shield-alt' },
    
    // --- MÓDULOS DE CONFIGURAÇÕES INDEPENDENTES ---
    { id: 'gestao_usuarios', label: 'Gestão de Usuários', setor: 'Configurações', icon: 'fas fa-users' },
    { id: 'gestao_acessos', label: 'Menus e Acessos', setor: 'Configurações', icon: 'fas fa-user-shield' }
];

const pageCache = {};

const ROTAS = {
    'escala': 'modules/logistica/escala/escala.html',
    'troca_turno': 'modules/logistica/troca_turno/troca_turno.html',
    'alocacao': 'modules/logistica/alocacao/alocacao.html',
    'caminhoes': 'modules/manutencao/caminhoes/caminhoes.html',
    'cadastro_frota': 'modules/logistica/frota_conjuntos/cadastro_frota.html',
    'documentos_frota': 'modules/logistica/documentos_frota/documentos_frota.html',
    
    'campo_escala': 'modules/campo/escala/escala.html',
    'alocacao_campo': 'modules/campo/alocacao/alocacao.html',
    'campo_equipe': 'modules/campo/equipe/equipe.html',
    'campo_maquinas': 'modules/campo/maquinas/maquinas.html',
    
    'os': 'modules/manutencao/ordem_servico/os.html',
    'historico_os': 'modules/manutencao/historico_os/historico_os.html',
    'painel_tv': 'modules/manutencao/painel_tv/painel_tv.html',
    'servicos': 'modules/manutencao/servicos/servicos.html',
    'borracharia': 'modules/manutencao/borracharia/borracharia.html',
    'cadastro_os_classificacoes': 'modules/manutencao/cadastros/classificacoes.html',
    
    'treinamento': 'modules/ssma/treinamento/treinamento.html',
    'rh_painel': 'modules/rh/painel/rh_painel.html',
    'rh_colaboradores': 'modules/rh/colaboradores/colaboradores.html',
    'rh_absenteismo': 'modules/rh/absenteismo/absenteismo.html',
    'rh_sorteio': 'modules/rh/sorteio/sorteio.html',
    'rh_configuracoes': 'modules/rh/configuracoes/rh_configuracoes.html',
    
    'centro_custo': 'modules/controladoria/centro_custo/centro_custo.html', 
    'ocorrencias': 'modules/controladoria/ocorrencias/ocorrencias.html',
    'historico_ocorrencias': 'modules/controladoria/ocorrencias/historico_ocorrencias.html',
    'relatorio_ocorrencias': 'modules/controladoria/ocorrencias/relatorio_ocorrencias.html',
    
    'recados': 'modules/ssma/recados/recados.html',
    
    'relatorio_gerencial': 'modules/monitoramento/painel/relatorio_gerencial.html',
    'indicadores': 'modules/indicadores/indicadores.html',
    'indicadores_serrana': 'modules/indicadores/indicadores_serrana.html',
    'cadastro_indicadores': 'modules/indicadores/cadastro_indicadores.html',
    
    'gestao_filiais': 'modules/global/gestao_filiais.html',
    'auditoria_logs': 'modules/global/auditoria_logs.html',
    
    'visao_geral': 'modules/monitoramento/visao_geral/visao_geral.html',
    'operacional': 'modules/monitoramento/operacional/operacional.html',
    'desempenho_frota': 'modules/monitoramento/desempenho_frota/desempenho_frota.html',
    'desempenho_grua': 'modules/monitoramento/desempenho_grua/desempenho_grua.html',
    'producao_frota': 'modules/gerencial/producao_frota/producao_frota.html', 
    'evolucao_fazendas': 'modules/gerencial/evolucao_fazendas/evolucao_fazendas.html',
    'visao_executiva': 'modules/gerencial/visao_executiva/visao_executiva.html', 
    'tarifador': 'modules/gerencial/tarifador/tarifador.html',
    'configuracoes_gerenciais': 'modules/gerencial/configuracoes_gerenciais/configuracoes_gerenciais.html',
    
    'jornadas': 'modules/monitoramento/jornadas/jornadas.html',
    'historico_producao': 'modules/monitoramento/historico/historico.html',
    'historico_jornadas': 'modules/monitoramento/historico_jornadas/historico_jornadas.html',
    'configuracoes_gerencial': 'modules/monitoramento/configuracoes/configuracoes_gerencial.html',
    'cadastro_up': 'modules/monitoramento/cadastro_up/cadastro_up.html',
    
    'gestao_usuarios': 'modules/configuracoes/gestao_usuarios.html',
    'gestao_acessos': 'modules/configuracoes/gestao_acessos.html',
    
    'almoxarifado': 'modules/almoxarifado/almoxarifado.html',
    'almoxarifado_entregas': 'modules/almoxarifado/almoxarifado_entregas.html',
    'almoxarifado_cadastros': 'modules/almoxarifado/almoxarifado_cadastros.html',
    'requisicao_materiais': 'modules/almoxarifado/requisicao_materiais.html',
    'almoxarifado_relatorios': 'modules/almoxarifado/almoxarifado_relatorios.html'
};

const VERSAO_SISTEMA = "1.0.21"; 

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
    
    if (userRole === 'Admin' || userRole === 'SuperAdmin') {
        if (!meusMenus.includes('tarifador')) meusMenus.push('tarifador');
    }
    
    const isAdmin = userRole === 'Admin' || userRole === 'SuperAdmin';
    const isSessaoCentral = (currentUser.filial_id === null || currentUser.filial_id === 'CENTRAL');

    let navHtml = '<nav class="main-nav">';
    const setores = [...new Set(window.MAPA_MENUS.map(m => m.setor))];

    setores.forEach(setor => {
        if (isSessaoCentral) {
            if (setor !== 'Global' && setor !== 'Controladoria' && setor !== 'Configurações') return;
        } else {
            if (setor === 'Global') return;
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
};

window.getIconSetor = function(setor) {
    const icones = {
        'Logística': 'fas fa-truck',
        'Campo': 'fas fa-tractor',
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
};

window.toggleDropdown = function(event) {
    const btn = event.currentTarget; 
    const menu = btn.nextElementSibling;
    if (menu) menu.classList.toggle('show');
};

window.fecharDropdown = function(dropdownElement) {
    const menu = dropdownElement.querySelector('.dropdown-menu');
    if (menu) menu.classList.remove('show');
};

window.navegarPara = async function(pagina, elementoClicado) {
    const userRole = (currentUser && currentUser.role) ? currentUser.role : 'Admin';

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

        // Inicializadores
        if (pagina === 'gestao_filiais' && typeof window.renderizarGestaoFiliais === 'function') window.renderizarGestaoFiliais();
        if (pagina === 'auditoria_logs' && typeof window.renderizarAuditoriaLogs === 'function') window.renderizarAuditoriaLogs();
        
        if (pagina === 'escala' && typeof window.renderizarEscala === 'function') window.renderizarEscala();
        if (pagina === 'troca_turno' && typeof window.renderizarTrocaTurno === 'function') window.renderizarTrocaTurno();
        if (pagina === 'alocacao' && typeof window.renderizarAlocacao === 'function') window.renderizarAlocacao();
        if (pagina === 'caminhoes' && typeof window.renderizarConjuntos === 'function') window.renderizarConjuntos();
        
        if (pagina === 'almoxarifado' && typeof window.renderizarAlmoxarifado === 'function') window.renderizarAlmoxarifado();
        if (pagina === 'almoxarifado_entregas' && typeof window.renderizarAlmoxarifadoEntregas === 'function') window.renderizarAlmoxarifadoEntregas();
        if (pagina === 'almoxarifado_cadastros' && typeof window.renderizarCadastrosAlmox === 'function') window.renderizarCadastrosAlmox();
        if (pagina === 'requisicao_materiais' && typeof window.renderizarRequisicaoMateriais === 'function') window.renderizarRequisicaoMateriais();
        if (pagina === 'almoxarifado_relatorios' && typeof window.renderizarAlmoxRelatorios === 'function') window.renderizarAlmoxRelatorios();

        if (pagina === 'campo_escala' && typeof window.renderizarEscalaCampo === 'function') window.renderizarEscalaCampo();
        if (pagina === 'alocacao_campo' && typeof window.carregarAlocacaoCampo === 'function') window.carregarAlocacaoCampo();
        if (pagina === 'campo_equipe' && typeof window.renderizarEquipeCampo === 'function') window.renderizarEquipeCampo();
        if (pagina === 'campo_maquinas' && typeof window.renderizarMaquinasCampo === 'function') window.renderizarMaquinasCampo();

        if (pagina === 'os' && typeof window.alternarTelaOS === 'function') window.alternarTelaOS('lista');
        if (pagina === 'historico_os' && typeof window.initHistoricoOS === 'function') window.initHistoricoOS();
        if (pagina === 'cadastro_os_classificacoes' && typeof window.renderizarCadastroClassificacoes === 'function') window.renderizarCadastroClassificacoes();
        
        if (pagina === 'painel_tv') {
            try { 
                if (typeof carregarDadosOS === 'function') await carregarDadosOS(); 
                if (typeof window.iniciarRelogioTV === 'function') window.iniciarRelogioTV();
                if (typeof window.renderizarCardsTV === 'function') window.renderizarCardsTV();
            } catch(e) { console.error("Erro no Painel TV:", e); }
        }

        if (pagina === 'rh_painel' && typeof window.initRHPainel === 'function') window.initRHPainel(); 
        if (pagina === 'rh_colaboradores' && typeof window.initRHColaboradores === 'function') window.initRHColaboradores();
        
        // NOVO INIT PARA ABSENTEÍSMO
        if (pagina === 'rh_absenteismo' && typeof window.initRHAbsenteismo === 'function') window.initRHAbsenteismo();
        
        if (pagina === 'rh_sorteio' && typeof window.initRHSorteio === 'function') window.initRHSorteio();
        if (pagina === 'rh_configuracoes' && typeof window.initRHConfiguracoes === 'function') window.initRHConfiguracoes();
        
        if (pagina === 'centro_custo' && typeof window.initControladoria === 'function') window.initControladoria();
        if (pagina === 'ocorrencias' && typeof window.initOcorrencias === 'function') window.initOcorrencias();
        if (pagina === 'historico_ocorrencias' && typeof window.initHistoricoOcorrencias === 'function') window.initHistoricoOcorrencias();
        if (pagina === 'relatorio_ocorrencias' && typeof window.initRelatorioOcorrencias === 'function') window.initRelatorioOcorrencias();
        
        if (pagina === 'recados' && typeof window.carregarRecados === 'function') window.carregarRecados();
        if (pagina === 'treinamento' && typeof window.renderizarPaginaTreinamento === 'function') window.renderizarPaginaTreinamento();

        if (pagina === 'indicadores' && typeof window.carregarDadosDashboard === 'function') window.carregarDadosDashboard();
        if (pagina === 'indicadores_serrana' && typeof window.carregarDadosDashboardSerrana === 'function') window.carregarDadosDashboardSerrana();
        if (pagina === 'cadastro_indicadores' && typeof window.initCadastroIndicadores === 'function') window.initCadastroIndicadores();

        if (pagina === 'servicos' && typeof window.renderizarTelaServicos === 'function') window.renderizarTelaServicos();
        if (pagina === 'cadastro_frota' && typeof window.renderizarTelaCadastroFrota === 'function') window.renderizarTelaCadastroFrota();
        if (pagina === 'documentos_frota' && typeof window.renderizarTelaDocumentosFrota === 'function') window.renderizarTelaDocumentosFrota();
        if (pagina === 'borracharia' && typeof window.initBorracharia === 'function') window.initBorracharia();

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
        if (pagina === 'desempenho_grua' && typeof window.initDesempenhoGrua === 'function') window.initDesempenhoGrua();
        if (pagina === 'producao_frota' && typeof window.initProducaoFrota === 'function') window.initProducaoFrota();
        if (pagina === 'evolucao_fazendas' && typeof window.initEvolucaoFazendas === 'function') window.initEvolucaoFazendas();
        if (pagina === 'visao_executiva' && typeof window.initVisaoExecutiva === 'function') window.initVisaoExecutiva();
        if (pagina === 'tarifador' && typeof window.initTarifador === 'function') window.initTarifador();
        if (pagina === 'configuracoes_gerenciais' && typeof window.initConfiguracoesGerenciais === 'function') window.initConfiguracoesGerenciais();
        
        if (pagina === 'jornadas' && typeof window.initJornadas === 'function') window.initJornadas();
        if (pagina === 'historico_producao' && typeof window.initHistoricoProducao === 'function') window.initHistoricoProducao();
        if (pagina === 'historico_jornadas' && typeof window.initHistoricoJornadas === 'function') window.initHistoricoJornadas();
        if (pagina === 'configuracoes_gerencial' && typeof window.inicializarConfiguracoesGerencial === 'function') window.inicializarConfiguracoesGerencial();
        if (pagina === 'cadastro_up' && typeof window.initCadastroUP === 'function') window.initCadastroUP();

        if (pagina === 'gestao_usuarios' && typeof window.renderizarUsuarios === 'function') window.renderizarUsuarios();
        if (pagina === 'gestao_acessos' && typeof window.carregarCheckboxesPermissoes === 'function') window.carregarCheckboxesPermissoes();

    } catch (error) {
        console.error('Erro ao carregar página:', error);
        mainContent.innerHTML = `<div style="padding: 20px; text-align: center; color: #ef4444;"><h3>Erro de Navegação</h3></div>`;
    }
};