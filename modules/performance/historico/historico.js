// ==================== modules/performance/historico/historico.js ====================

window.tripsModule = window.tripsModule || {};

// Variáveis de controle de página e filtros
window.tripsModule.stateHistorico = {
    page: 1,
    limit: 50, // Quantidade de itens por página
    total: 0,
    busca: '',
    inicio: '',
    fim: ''
};

// É chamada automaticamente ao clicar no menu "Histórico de Viagens"
window.tripsModule.loadTrips = async function() {
    // Reseta o status para a primeira página sempre que abrir a tela
    window.tripsModule.stateHistorico.page = 1;
    window.tripsModule.stateHistorico.busca = '';
    window.tripsModule.stateHistorico.inicio = '';
    window.tripsModule.stateHistorico.fim = '';
    
    // Limpa os campos da tela (se houver algo escrito de antes)
    const iptBusca = document.getElementById('filtroHistoricoBusca');
    const iptInicio = document.getElementById('filtroHistoricoInicio');
    const iptFim = document.getElementById('filtroHistoricoFim');
    if(iptBusca) iptBusca.value = '';
    if(iptInicio) iptInicio.value = '';
    if(iptFim) iptFim.value = '';

    await window.tripsModule.fetchTrips();
};

window.tripsModule.aplicarFiltros = function() {
    window.tripsModule.stateHistorico.busca = document.getElementById('filtroHistoricoBusca').value.trim();
    window.tripsModule.stateHistorico.inicio = document.getElementById('filtroHistoricoInicio').value;
    window.tripsModule.stateHistorico.fim = document.getElementById('filtroHistoricoFim').value;
    window.tripsModule.stateHistorico.page = 1; // Volta para a página 1 ao fazer uma nova busca
    window.tripsModule.fetchTrips();
};

window.tripsModule.limparFiltros = function() {
    document.getElementById('filtroHistoricoBusca').value = '';
    document.getElementById('filtroHistoricoInicio').value = '';
    document.getElementById('filtroHistoricoFim').value = '';
    window.tripsModule.aplicarFiltros();
};

window.tripsModule.mudarPagina = function(novaPagina) {
    window.tripsModule.stateHistorico.page = novaPagina;
    window.tripsModule.fetchTrips();
};

// Função principal que comunica com o banco
window.tripsModule.fetchTrips = async function() {
    const tbody = document.getElementById('historico-list');
    const countBadge = document.getElementById('historico-count');
    const pagContainer = document.getElementById('historico-pagination');
    
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Buscando viagens...</td></tr>';

    try {
        const s = window.tripsModule.stateHistorico;

        // Inicia a query pedindo a contagem exata ({ count: 'exact' }) para montar as páginas
        let query = window.supabaseClient
            .from('performance')
            .select('*', { count: 'exact' });

        // Segurança de Filial
        if (typeof window.aplicarFiltroFilial === 'function') {
            query = window.aplicarFiltroFilial(query);
        }

        // Aplica o filtro de Texto (Nome ou Placa) usando .or()
        if (s.busca) {
            query = query.or(`motorista.ilike.%${s.busca}%,placa.ilike.%${s.busca}%`);
        }
        
        // Aplica o filtro de Data (Maior ou igual / Menor ou igual)
        if (s.inicio) {
            query = query.gte('inicio', `${s.inicio}T00:00:00`);
        }
        if (s.fim) {
            query = query.lte('inicio', `${s.fim}T23:59:59`);
        }

        // Aplica a Paginação no Banco (Range de X até Y)
        const from = (s.page - 1) * s.limit;
        const to = from + s.limit - 1;
        query = query.range(from, to).order('inicio', { ascending: false });

        // Executa a busca
        const { data, count, error } = await query;

        if (error) throw error;

        const trips = data || [];
        s.total = count || 0;

        // Renderiza a Tabela
        if (tbody) {
            if (trips.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhuma viagem encontrada para estes filtros.</td></tr>';
            } else {
                tbody.innerHTML = trips.map(trip => `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.3s ease;">
                        <td>
                            <strong style="color: #f8fafc;">${trip.motorista || '-'}</strong><br>
                            <span style="font-size: 0.75rem; color: #94a3b8;"><i class="fas fa-truck" style="margin-right:4px;"></i> ${trip.placa || '-'}</span>
                        </td>
                        <td style="color: #94a3b8;">${window.utils && window.utils.formatDateTime ? window.utils.formatDateTime(trip.inicio) : trip.inicio}</td>
                        <td style="color: #94a3b8;">${window.utils && window.utils.formatDateTime ? window.utils.formatDateTime(trip.fim) : trip.fim}</td>
                        <td style="font-weight: 600;">${window.utils && window.utils.formatNumber ? window.utils.formatNumber(trip.distancia_km, 0) : trip.distancia_km} km</td>
                        <td style="color: #10b981; font-weight: bold; font-size: 1.05rem;">${window.utils && window.utils.formatNumber ? window.utils.formatNumber(trip.kml) : trip.kml}</td>
                        <td style="color: #e2e8f0;">${window.utils && window.utils.formatNumber ? window.utils.formatNumber(trip.total_litros) : trip.total_litros} L</td>
                    </tr>
                `).join('');
            }
        }

        // Renderiza o total e os botões de paginação
        if (countBadge) countBadge.textContent = `${s.total} viagens localizadas`;

        if (pagContainer) {
            const totalPages = Math.ceil(s.total / s.limit) || 1;
            
            let btnPrevDisabled = s.page === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : '';
            let btnNextDisabled = s.page >= totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : '';

            pagContainer.innerHTML = `
                <button class="btn-secondary-dark" onclick="window.tripsModule.mudarPagina(${s.page - 1})" ${btnPrevDisabled}>
                    <i class="fas fa-chevron-left"></i> Anterior
                </button>
                <span style="color: #f8fafc; font-weight: 600; font-size: 0.9rem;">
                    Página <span style="color: #60a5fa;">${s.page}</span> de ${totalPages}
                </span>
                <button class="btn-secondary-dark" onclick="window.tripsModule.mudarPagina(${s.page + 1})" ${btnNextDisabled}>
                    Próxima <i class="fas fa-chevron-right"></i>
                </button>
            `;
        }

    } catch (error) {
        console.error("Erro fatal ao carregar histórico:", error);
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 20px;">Ocorreu um erro ao carregar os dados.</td></tr>';
    }
};