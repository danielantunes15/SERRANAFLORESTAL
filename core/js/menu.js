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
    { id: 'servicos', label: 'Serviços (Mecânicos)', setor: 'Manutenção', icon: 'fas fa-toolbox' },
    { id: 'cadastro_frota', label: 'Cadastro Frota (O.S.)', setor: 'Manutenção', icon: 'fas fa-truck-moving' },
    { id: 'os_apoio', label: 'O.S. Apoio', setor: 'Manutenção', icon: 'fas fa-truck-pickup' },
    { id: 'almoxarifado', label: 'Almoxarifado', setor: 'Manutenção', icon: 'fas fa-boxes' },
    
    { id: 'treinamento', label: 'Treinamento', setor: 'SSMA', icon: 'fas fa-graduation-cap' },
    
    { id: 'relatorio_gerencial', label: 'Relatório Gerencial', setor: 'Indicadores', icon: 'fas fa-chart-pie' },
    { id: 'indicadores', label: 'Indicadores Suzano', setor: 'Indicadores', icon: 'fas fa-chart-area' },
    { id: 'indicadores_serrana', label: 'Indicadores Serrana', setor: 'Indicadores', icon: 'fas fa-chart-bar' },
    
    // NOVO MENU DE GESTÃO GLOBAL 
    { id: 'central', label: 'Gestão de Filiais', setor: 'Global', icon: 'fas fa-network-wired' }
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
    let meusMenus = permissoesAtuais[userRole] || [];
    const isAdmin = userRole === 'Admin' || userRole === 'SuperAdmin';
    
    // VERIFICA SE A SESSÃO ATUAL É A DO ADMINISTRADOR GLOBAL
    const isSessaoCentral = (currentUser.filial_id === null || currentUser.filial_id === 'CENTRAL');

    let navHtml = '<nav class="main-nav">';
    const setores = [...new Set(MAPA_MENUS.map(m => m.setor))];

    setores.forEach(setor => {
        
        // ============= ISOLAMENTO VISUAL =============
        if (isSessaoCentral) {
            // Se estiver no painel ADMINISTRADOR, mostra APENAS os recursos Globais
            if (setor !== 'Global') return; 
        } else {
            // Se estiver em uma Filial Normal (Logística, Manutenção), ESCONDE o painel Global
            if (setor === 'Global') return;
        }
        // =============================================

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

    if (isAdmin) {
        navHtml += `<button id="navConfigBtn" class="nav-item" onclick="navegarPara('config', this)"><i class="fas fa-users-cog"></i> Usuários e Permissões</button>`;
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
        'Global': 'fas fa-globe'
    };
    return icones[setor] || 'fas fa-folder';
}

window.carregarCheckboxesPermissoes = async function() {
    const container = document.getElementById('container-permissoes-menus');
    if (!container) return;

    const perfilSelect = document.getElementById('selectPerfilPermissao');
    const perfil = perfilSelect ? perfilSelect.value : 'Controlador de Trefego';
    
    let permissoesAtuais = {};
    if (typeof db !== 'undefined' && typeof db.getPermissoesDB === 'function') {
        permissoesAtuais = await db.getPermissoesDB();
    } else if (typeof window.getPermissoes === 'function') {
        permissoesAtuais = window.getPermissoes();
    }
    const meusAcessos = permissoesAtuais[perfil] || [];

    let html = '';
    const setores = [...new Set(MAPA_MENUS.map(m => m.setor))];

    setores.forEach(setor => {
        html += `
        <div>
            <strong style="display:block; margin-bottom: 8px; color: var(--ccol-blue-bright); font-size: 0.9rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">
                <i class="${getIconSetor(setor)}"></i> ${setor}
            </strong>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">`;
        
        MAPA_MENUS.filter(m => m.setor === setor).forEach(menu => {
            const checked = meusAcessos.includes(menu.id) ? 'checked' : '';
            html += `
                <label style="color: #fff; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                    <input type="checkbox" class="chk-permissao" value="${menu.id}" ${checked}>
                    <i class="${menu.icon}" style="width: 16px; text-align: center; color: var(--text-secondary);"></i> ${menu.label}
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

    if (pagina === 'config' && userRole !== 'Admin' && userRole !== 'SuperAdmin') {
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
        'os_apoio': 'modules/manutencao/ordem_servico/os_apoio.html',
        'almoxarifado': 'modules/manutencao/almoxarifado/almoxarifado.html',
        'servicos': 'modules/manutencao/servicos/servicos.html',
        'treinamento': 'modules/ssma/treinamento/treinamento.html',
        'recados': 'modules/ssma/recados/recados.html',
        'relatorio_gerencial': 'modules/gerencial/painel/relatorio_gerencial.html',
        'indicadores': 'modules/gerencial/indicadores/indicadores.html',
        'indicadores_serrana': 'modules/gerencial/indicadores/indicadores_serrana.html',
        'config': 'modules/gerencial/config/config.html',
        'central': 'modules/gerencial/central/central.html'
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

        if (pagina === 'central' && typeof window.renderizarCentral === 'function') window.renderizarCentral();
        if (pagina === 'escala' && typeof window.renderizarEscala === 'function') window.renderizarEscala();
        if (pagina === 'troca_turno' && typeof window.renderizarTrocaTurno === 'function') window.renderizarTrocaTurno();
        if (pagina === 'alocacao' && typeof window.renderizarAlocacao === 'function') window.renderizarAlocacao();
        if (pagina === 'motoristas' && typeof window.renderizarMotoristas === 'function') window.renderizarMotoristas();
        if (pagina === 'caminhoes' && typeof window.renderizarConjuntos === 'function') window.renderizarConjuntos();
        if (pagina === 'almoxarifado' && typeof window.renderizarAlmoxarifado === 'function') window.renderizarAlmoxarifado();
        if (pagina === 'os' && typeof window.alternarTelaOS === 'function') window.alternarTelaOS('lista');
        if (pagina === 'os_apoio' && typeof window.alternarTelaOSApoio === 'function') window.alternarTelaOSApoio('lista');
        if (pagina === 'recados' && typeof window.carregarRecados === 'function') window.carregarRecados();
        if (pagina === 'treinamento' && typeof window.renderizarPaginaTreinamento === 'function') window.renderizarPaginaTreinamento();
        if (pagina === 'indicadores' && typeof window.carregarDadosDashboard === 'function') window.carregarDadosDashboard();
        if (pagina === 'indicadores_serrana' && typeof window.carregarDadosDashboardSerrana === 'function') window.carregarDadosDashboardSerrana();
        
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

    } catch (error) {
        console.error('Erro ao carregar página:', error);
        mainContent.innerHTML = `<div style="padding: 20px; text-align: center; color: #ef4444;"><h3>Erro de Navegação</h3></div>`;
    }
};