// Configuração do Supabase
const supabaseUrl = 'https://tjjrzinpogjrquoosuqn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqanJ6aW5wb2dqcnF1b29zdXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMzMxODksImV4cCI6MjA5NDcwOTE4OX0.IdZOXfXiWeFIUI4LPDVb1sZNyKogo4fOs-_9UcP_xj0';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// ================= CORREÇÃO DO ERRO SUPABASE =================
window.supabaseClient = supabaseClient; 
// ==============================================================

const db = {
    // --- LOGIN E USUÁRIOS ---
    async getUsuarioByUsername(username) {
        // Correção aplicada: .single() trocado por .maybeSingle() para evitar erro 406
        const { data, error } = await supabaseClient.from('usuarios').select('*').eq('username', username).maybeSingle();
        if (error) return null;
        return data;
    },
    async updateUsuarioSenha(id, senha_hash) {
        await supabaseClient.from('usuarios').update({ senha_hash: senha_hash, primeiro_acesso: false }).eq('id', id);
    },
    async getUsuarios() {
        const { data } = await supabaseClient.from('usuarios').select('*').order('id', { ascending: true });
        return data || [];
    },
    async addUsuario(usuario) {
        await supabaseClient.from('usuarios').insert([usuario]);
    },
    async updateUsuarioSenhaEReset(id, senha_hash) {
        await supabaseClient.from('usuarios').update({ senha_hash: senha_hash, primeiro_acesso: true }).eq('id', id);
    },
    async deleteUsuario(id) {
        await supabaseClient.from('usuarios').delete().eq('id', id);
    },

    // --- LOGS DE SEGURANÇA ---
    async getLogs() {
        const { data } = await supabaseClient.from('logs_exclusao').select('*').order('data_hora', { ascending: false }).limit(50);
        return data || [];
    },
    async addLog(acao, detalhes) {
        if (!currentUser) return;
        await supabaseClient.from('logs_exclusao').insert([{ usuario: currentUser.username, acao, detalhes }]);
    },

    // --- CONJUNTOS / TRINCAS ---
    async getConjuntos() {
        const { data } = await supabaseClient.from('conjuntos').select('*').order('id', { ascending: true });
        return data || [];
    },
    async addConjunto(conjunto) {
        await supabaseClient.from('conjuntos').insert([conjunto]);
    },
    async deleteConjunto(id) {
        await supabaseClient.from('conjuntos').delete().eq('id', id);
    },
    async updateConjunto(id, caminhoes) {
        await supabaseClient.from('conjuntos').update({ caminhoes }).eq('id', id);
    },

    // --- MOTORISTAS ---
    async getMotoristas() {
        const { data } = await supabaseClient.from('motoristas').select('*');
        return data || [];
    },
    async addMotorista(motorista) {
        await supabaseClient.from('motoristas').insert([motorista]);
    },
    async updateMotorista(id, updates) {
        Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);

        const { data, error } = await supabaseClient.from('motoristas')
            .update(updates)
            .eq('id', id)
            .select();
            
        if (error) {
            console.error("⛔ ERRO SUPABASE MOTORISTA:", error);
            alert("ERRO NA BASE DE DADOS (Motorista): A alteração foi rejeitada pelo servidor!\nMotivo: " + error.message);
            throw error;
        }

        if (!data || data.length === 0) {
            console.error("⚠️ Falha Invisível: Nenhuma linha afetada para o ID", id);
            alert("⚠️ ALERTA DE SINCRONIZAÇÃO: O Supabase falhou ao tentar guardar o motorista. Verifique o tipo de dado.");
            throw new Error("Zero rows updated in Supabase");
        }
    },
    async deleteMotorista(id) {
        await supabaseClient.from('motoristas').delete().eq('id', id);
    },

    // --- EXCEÇÕES DA ESCALA (Ajustes Manuais) ---
    async getEscalas() {
        const { data, error } = await supabaseClient.from('escalas').select('*');
        if (error) console.error("Erro a extrair exceções da escala:", error);
        return data || [];
    },
    async upsertEscala(escala) {
        const { error } = await supabaseClient.from('escalas').upsert([escala]);
        if (error) throw error;
    },
    async deleteEscalaDia(id) {
        const { error } = await supabaseClient.from('escalas').delete().eq('id', id);
        if (error) throw error;
    },
    async deleteEscalasPorMotorista(motorista_id) {
        await supabaseClient.from('escalas').delete().eq('motorista_id', motorista_id);
    },
    async limparApenasEscalas() {
        await supabaseClient.from('escalas').delete().neq('id', '0');
    },
    
    // --- TREINAMENTOS ---
    async getInstrutores() {
        const { data } = await supabaseClient.from('instrutores').select('*');
        return data || [];
    },
    async addInstrutor(instrutor) {
        await supabaseClient.from('instrutores').insert([instrutor]);
    },
    async deleteInstrutor(nome) {
        await supabaseClient.from('instrutores').delete().eq('nome', nome);
    },
    async getTreinamentos() {
        const { data } = await supabaseClient.from('treinamentos').select('*');
        return data || [];
    },
    async upsertTreinamento(treinamento) {
        const { error } = await supabaseClient.from('treinamentos').upsert([treinamento]);
        if (error) throw error;
    },
    async deleteTreinamento(id) {
        await supabaseClient.from('treinamentos').delete().eq('id', id);
    },

    // --- PERMISSÕES DE ACESSO ---
    async getPermissoesDB() {
        const { data, error } = await supabaseClient.from('permissoes_perfis').select('*');
        if (error || !data) return {};
        const permissoesObj = {};
        data.forEach(item => {
            permissoesObj[item.perfil] = item.menus;
        });
        return permissoesObj;
    },
    async updatePermissoesDB(perfil, menus) {
        const { error } = await supabaseClient.from('permissoes_perfis').upsert([{ perfil: perfil, menus: menus }]);
        if (error) alert("Erro ao guardar permissões na base de dados. Motivo: " + error.message);
    },

    // ==================== MÓDULO: ALMOXARIFADO ====================
    async getPecas() {
        const { data, error } = await supabaseClient.from('almoxarifado_pecas').select('*').order('nome', { ascending: true });
        if (error) console.error("Erro buscar peças:", error);
        return data || [];
    },
    async upsertPeca(peca) {
        const { error } = await supabaseClient.from('almoxarifado_pecas').upsert([peca]);
        if (error) throw error;
    },
    async deletePeca(id) {
        await supabaseClient.from('almoxarifado_pecas').delete().eq('id', id);
    },
    async getMovimentacoesEstoque() {
        const { data, error } = await supabaseClient.from('almoxarifado_movimentacoes').select('*, almoxarifado_pecas(nome)').order('data_movimentacao', { ascending: false });
        if (error) console.error("Erro buscar movimentações:", error);
        return data || [];
    },
    async addMovimentacao(movimentacao) {
        const { error } = await supabaseClient.from('almoxarifado_movimentacoes').insert([movimentacao]);
        if (error) throw error;
        
        // Atualiza estoque da peça ao dar saída individual
        const { data: peca } = await supabaseClient.from('almoxarifado_pecas').select('quantidade').eq('id', movimentacao.peca_id).single();
        if (peca) {
            const novaQtd = movimentacao.tipo === 'entrada' ? peca.quantidade + parseFloat(movimentacao.quantidade) : peca.quantidade - parseFloat(movimentacao.quantidade);
            await supabaseClient.from('almoxarifado_pecas').update({ quantidade: novaQtd }).eq('id', movimentacao.peca_id);
        }
    },
    async processarEntradaLote(itens, nota_fiscal, fornecedor) {
        for (let item of itens) {
            let peca_id = item.peca_id;

            if (!peca_id) {
                let { data: pecaExistente } = await supabaseClient.from('almoxarifado_pecas')
                    .select('id')
                    .eq('nome', item.nome)
                    .maybeSingle();

                if (pecaExistente) {
                    peca_id = pecaExistente.id;
                } else {
                    const { data: novaPeca, error } = await supabaseClient.from('almoxarifado_pecas')
                        .insert([{
                            codigo: item.codigo,
                            nome: item.nome,
                            unidade: item.unidade || 'UN',
                            quantidade: 0,
                            estoque_minimo: item.estoque_minimo,
                            preco_medio: item.valor_unitario
                        }])
                        .select().single();
                    if (error) throw error;
                    peca_id = novaPeca.id;
                }
            }

            await supabaseClient.from('almoxarifado_movimentacoes').insert([{
                peca_id: peca_id,
                tipo: 'entrada',
                quantidade: item.quantidade,
                valor_unitario: item.valor_unitario,
                nota_fiscal: nota_fiscal,
                fornecedor: fornecedor,
                data_movimentacao: new Date().toISOString()
            }]);

            const { data: pAtual } = await supabaseClient.from('almoxarifado_pecas').select('quantidade').eq('id', peca_id).single();
            await supabaseClient.from('almoxarifado_pecas').update({ quantidade: pAtual.quantidade + parseFloat(item.quantidade) }).eq('id', peca_id);
        }
    },

    // ==================== MÓDULO: DOCUMENTOS FROTA ====================
    async getDocumentosFrota(identificadores) {
        // Recebe array com placas e busca os documentos vinculados a elas
        const { data, error } = await supabaseClient.from('documentos_frota')
            .select('*')
            .in('identificador', identificadores);
        if (error) { console.error("Erro ao buscar documentos:", error); return []; }
        return data || [];
    },
    async uploadArquivoFrota(file, path) {
        const { data, error } = await supabaseClient.storage.from('documentos_frota').upload(path, file, { upsert: true });
        if (error) throw error;
        return supabaseClient.storage.from('documentos_frota').getPublicUrl(path).data.publicUrl;
    },
    async addDocumentoFrota(doc) {
        // Exclui versão antiga (se houver) para evitar duplicidade de metadado
        await supabaseClient.from('documentos_frota').delete()
            .eq('identificador', doc.identificador)
            .eq('tipo_documento', doc.tipo_documento);
            
        const { error } = await supabaseClient.from('documentos_frota').insert([doc]);
        if (error) throw error;
    },
    async deleteDocumentoFrota(identificador, tipo_documento, path) {
        await supabaseClient.storage.from('documentos_frota').remove([path]);
        await supabaseClient.from('documentos_frota').delete()
            .eq('identificador', identificador)
            .eq('tipo_documento', tipo_documento);
    }
};