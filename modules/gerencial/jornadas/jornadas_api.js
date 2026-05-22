// ==========================================
// js/jornadas/jornadas_api.js
// ==========================================

// ================= LÓGICA SAAS (MULTI-FILIAL) =================
function aplicarFiltroLocal(query) {
    if (!window.currentUser) return query; 
    if (window.currentUser.filial_id === null && (window.currentUser.role === 'SuperAdmin' || window.currentUser.role === 'Admin')) {
        return query; 
    }
    if (window.currentUser.filial_id === undefined || window.currentUser.filial_id === null) {
        return query.is('filial_id', null); 
    }
    return query.eq('filial_id', window.currentUser.filial_id);
}
// ===============================================================

async function carregarPainelJornadas() {
    try {
        let dadosBrutos = [];
        let start = 0;
        const step = 1000;
        
        // Loop de paginação para buscar TODOS os registros, não apenas os primeiros 1000
        while (true) {
            let queryJornadas = supabaseClient
                .from('historico_jornadas')
                .select('*')
                .order('id', { ascending: false })
                .range(start, start + step - 1);

            // Injeta a proteção Multi-Tenancy
            queryJornadas = aplicarFiltroLocal(queryJornadas);

            const { data, error } = await queryJornadas;

            if (error) throw error;
            if (!data || data.length === 0) break;
            
            dadosBrutos.push(...data);
            
            if (data.length < step) break; // Chegou no fim do banco
            start += step;
        }

        if (dadosBrutos.length > 0) {
            // REMOVE DUPLICATAS E IGNORA NOMES QUE NÃO SÃO MOTORISTAS
            const dadosLimpos = [];
            const seen = new Set();
            
            dadosBrutos.forEach(d => {
                const nome = (d.motorista || "").toUpperCase();
                
                // Ignora se estiver na lista de exclusão
                if (MOTORISTAS_EXCLUIDOS.includes(nome)) return;
                
                // Cria chave única para identificar duplicatas
                const chave = `${d.motorista || ''}-${d.inicio || ''}-${d.fim || ''}`;
                if (!seen.has(chave)) {
                    seen.add(chave);
                    dadosLimpos.push(d);
                }
            });

            fullJornadasData = dadosLimpos.filter(d => d.total_trabalho_horas >= 8);
        }
        popularFiltroDatas();
        renderizarPainelJornadas();
    } catch (error) { console.error("Erro:", error); }
}