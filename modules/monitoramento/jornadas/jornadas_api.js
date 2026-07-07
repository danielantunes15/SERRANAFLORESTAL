// ==========================================
// js/jornadas/jornadas_api.js
// ==========================================

window.aplicarFiltroLocal = window.aplicarFiltroLocal || function(query) {
    if (!window.currentUser) return query; 
    if (window.currentUser.filial_id === null && (window.currentUser.role === 'SuperAdmin' || window.currentUser.role === 'Admin')) {
        return query; 
    }
    if (window.currentUser.filial_id === undefined || window.currentUser.filial_id === null) {
        return query.is('filial_id', null); 
    }
    return query.eq('filial_id', window.currentUser.filial_id);
};

window.carregarPainelJornadas = async function() {
    try {
        console.log("[Jornadas] Iniciando busca total no banco de dados...");
        let dadosBrutos = [];
        
        const dbClient = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
        
        if (!dbClient) {
            console.error("[Jornadas] Erro Crítico: Conexão com Supabase não encontrada.");
            return;
        }

        // Loop para contornar o limite do Supabase/PostgREST e pegar TODOS os >5000 registros
        // Além disso, foi retirado o bloqueio de buscar apenas os últimos 30 dias.
        let fetchMore = true;
        let from = 0;
        const step = 1000;

        while (fetchMore) {
            let queryJornadas = dbClient
                .from('historico_jornadas')
                .select('*')
                .order('id', { ascending: false })
                .range(from, from + step - 1); 

            // Injeta o Multi-Tenancy (Saas). Se der problema com filial_id, comente a linha abaixo.
            queryJornadas = window.aplicarFiltroLocal(queryJornadas);

            const { data, error } = await queryJornadas;

            if (error) throw error;
            
            if (data && data.length > 0) {
                dadosBrutos = dadosBrutos.concat(data);
                from += step;
                
                // Se a busca retornou menos registros que o step, significa que acabaram os dados
                if (data.length < step) {
                    fetchMore = false; 
                }
            } else {
                fetchMore = false;
            }
        }

        console.log(`[Jornadas] Total de registros encontrados e cacheados no banco: ${dadosBrutos.length}`);

        if (dadosBrutos.length > 0) {
            const dadosLimpos = [];
            const seen = new Set();
            
            dadosBrutos.forEach(d => {
                const nome = (d.motorista || "").toUpperCase();
                
                // Ignora exclusões
                if (window.MOTORISTAS_EXCLUIDOS && window.MOTORISTAS_EXCLUIDOS.includes(nome)) return;
                
                const chave = `${d.motorista || ''}-${d.inicio || ''}-${d.fim || ''}`;
                if (!seen.has(chave)) {
                    seen.add(chave);
                    dadosLimpos.push(d);
                }
            });

            window.fullJornadasData = dadosLimpos;
            console.log("[Jornadas] Total liberado para a tela:", window.fullJornadasData.length);
        } else {
            window.fullJornadasData = [];
        }

        // Chama a nova função que popula os select box de Filtro de Datas e Filtro de Meses
        if (typeof window.popularFiltrosJornadas === 'function') {
            window.popularFiltrosJornadas();
        } else if (typeof window.popularFiltroDatas === 'function') {
            window.popularFiltroDatas(); // Fallback caso ocorra algo
        }

        if (typeof window.renderizarPainelJornadas === 'function') window.renderizarPainelJornadas();

    } catch (error) { 
        console.error("[Jornadas] Falha na API ao carregar dados em massa:", error); 
    }
};