// ==========================================
// js/jornadas/jornadas_api.js
// ==========================================

async function carregarPainelJornadas() {
    try {
        let dadosBrutos = [];
        let start = 0;
        const step = 1000;
        
        // Loop de paginação para buscar TODOS os registros, não apenas os primeiros 1000
        while (true) {
            const { data, error } = await supabaseClient
                .from('historico_jornadas')
                .select('*')
                .order('id', { ascending: false })
                .range(start, start + step - 1);

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