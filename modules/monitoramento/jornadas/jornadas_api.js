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
        console.log("[Jornadas] Iniciando busca no banco...");
        let dadosBrutos = [];
        
        const dbClient = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
        
        if (!dbClient) {
            console.error("[Jornadas] Erro Crítico: Conexão com Supabase não encontrada.");
            return;
        }

        // BLOQUEIO DE CONSUMO: Limita a busca aos últimos 30 dias de histórico
        const trintaDiasAtras = new Date();
        trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

        let queryJornadas = dbClient
            .from('historico_jornadas')
            .select('*')
            .gte('inicio', trintaDiasAtras.toISOString())
            .order('id', { ascending: false })
            .limit(2000); 

        // Injeta o Multi-Tenancy (Saas). Se der problema com filial_id, comente a linha abaixo.
        queryJornadas = window.aplicarFiltroLocal(queryJornadas);

        const { data, error } = await queryJornadas;

        if (error) throw error;
        
        if (data && data.length > 0) {
            dadosBrutos = data;
        }

        console.log("[Jornadas] Total de registros encontrados no banco:", dadosBrutos.length);

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

            // CORREÇÃO: Removido o filtro ".filter(d => d.total_trabalho_horas >= 8)" 
            // Agora ele vai renderizar até mesmo dados com erro de horas do importador
            window.fullJornadasData = dadosLimpos;
            console.log("[Jornadas] Total liberado para a tela:", window.fullJornadasData.length);
        } else {
            window.fullJornadasData = [];
        }

        if (typeof window.popularFiltroDatas === 'function') window.popularFiltroDatas();
        if (typeof window.renderizarPainelJornadas === 'function') window.renderizarPainelJornadas();

    } catch (error) { 
        console.error("[Jornadas] Falha na API:", error); 
    }
};