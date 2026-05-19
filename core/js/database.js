// Configuração do Supabase
const supabaseUrl = 'https://tjjrzinpogjrquoosuqn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqanJ6aW5wb2dqcnF1b29zdXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMzMxODksImV4cCI6MjA5NDcwOTE4OX0.IdZOXfXiWeFIUI4LPDVb1sZNyKogo4fOs-_9UcP_xj0';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

window.supabaseClient = supabaseClient; 

// ================= LÓGICA SAAS (MULTI-FILIAL) =================
function aplicarFiltroFilial(query) {
    if (!window.currentUser) return query; 
    
    // Se for SuperAdmin/Admin operando na CENTRAL (filial_id === null), ele tem visão panorâmica de tudo (Modo Deus)
    if (window.currentUser.filial_id === null && (window.currentUser.role === 'SuperAdmin' || window.currentUser.role === 'Admin')) {
        return query; 
    }
    
    // Se o usuário não tiver filial vinculada por erro, bloqueia os dados vazados
    if (window.currentUser.filial_id === undefined || window.currentUser.filial_id === null) {
        return query.is('filial_id', null); 
    }
    
    // Se ele selecionou uma filial (mesmo sendo SuperAdmin) ou for usuário padrão, puxa só os dados daquela filial
    return query.eq('filial_id', window.currentUser.filial_id);
}

function injetarFilial(obj) {
    if (!window.currentUser) return obj; 
    // Se o SuperAdmin está operando na Central, o registro fica como global (sem filial vinculada)
    if (window.currentUser.filial_id === null) return obj; 
    
    // Injeta silenciosamente a filial selecionada
    return { ...obj, filial_id: window.currentUser.filial_id };
}
// ===============================================================

const db = {
    // --- GESTÃO DE FILIAIS ---
    async getFiliais() {
        const { data, error } = await supabaseClient.from('filiais').select('*').eq('status', 'Ativa').order('nome', { ascending: true });
        if (error) return [];
        return data || [];
    },
    async getTodasFiliaisAdmin() {
        const { data, error } = await supabaseClient.from('filiais').select('*').order('nome', { ascending: true });
        return data || [];
    },
    async addFilial(filial) {
        const { error } = await supabaseClient.from('filiais').insert([filial]);
        if (error) throw error;
    },
    async updateFilialStatus(id, status) {
        const { error } = await supabaseClient.from('filiais').update({ status }).eq('id', id);
        if (error) throw error;
    },
    // NOVO: Função para editar os dados da filial
    async updateFilialDados(id, dados) {
        const { error } = await supabaseClient.from('filiais').update(dados).eq('id', id);
        if (error) throw error;
    },

    // --- LOGIN E USUÁRIOS ---
    async getUsuarioByUsername(username) {
        const { data, error } = await supabaseClient.from('usuarios').select('*, filiais(nome)').eq('username', username).maybeSingle();
        if (error) return null;
        return data;
    },
    async updateUsuarioSenha(id, senha_hash) {
        await supabaseClient.from('usuarios').update({ senha_hash: senha_hash, primeiro_acesso: false }).eq('id', id);
    },
    async getUsuarios() {
        const query = supabaseClient.from('usuarios').select('*, filiais(nome)').order('id', { ascending: true });
        const { data } = await aplicarFiltroFilial(query);
        return data || [];
    },
    async addUsuario(usuario) {
        await supabaseClient.from('usuarios').insert([injetarFilial(usuario)]);
    },
    async updateUsuarioSenhaEReset(id, senha_hash) {
        await supabaseClient.from('usuarios').update({ senha_hash: senha_hash, primeiro_acesso: true }).eq('id', id);
    },
    async deleteUsuario(id) {
        await supabaseClient.from('usuarios').delete().eq('id', id);
    },

    // --- LOGS DE SEGURANÇA ---
    async getLogs() {
        const query = supabaseClient.from('logs_exclusao').select('*').order('data_hora', { ascending: false }).limit(50);
        const { data } = await aplicarFiltroFilial(query);
        return data || [];
    },
    async addLog(acao, detalhes) {
        if (!window.currentUser) return;
        await supabaseClient.from('logs_exclusao').insert([injetarFilial({ usuario: window.currentUser.username, acao, detalhes })]);
    },

    // --- CONJUNTOS / TRINCAS ---
    async getConjuntos() {
        const query = supabaseClient.from('conjuntos').select('*').order('id', { ascending: true });
        const { data } = await aplicarFiltroFilial(query);
        return data || [];
    },
    async addConjunto(conjunto) {
        await supabaseClient.from('conjuntos').insert([injetarFilial(conjunto)]);
    },
    async deleteConjunto(id) {
        await supabaseClient.from('conjuntos').delete().eq('id', id);
    },
    async updateConjunto(id, caminhoes) {
        await supabaseClient.from('conjuntos').update({ caminhoes }).eq('id', id);
    },

    // --- MOTORISTAS ---
    async getMotoristas() {
        const query = supabaseClient.from('motoristas').select('*');
        const { data } = await aplicarFiltroFilial(query);
        return data || [];
    },
    async addMotorista(motorista) {
        await supabaseClient.from('motoristas').insert([injetarFilial(motorista)]);
    },
    async updateMotorista(id, updates) {
        Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);
        const { data, error } = await supabaseClient.from('motoristas').update(updates).eq('id', id).select();
        if (error) throw error;
    },
    async deleteMotorista(id) {
        await supabaseClient.from('motoristas').delete().eq('id', id);
    },

    // --- EXCEÇÕES DA ESCALA ---
    async getEscalas() {
        const query = supabaseClient.from('escalas').select('*');
        const { data } = await aplicarFiltroFilial(query);
        return data || [];
    },
    async upsertEscala(escala) {
        await supabaseClient.from('escalas').upsert([injetarFilial(escala)]);
    },
    async deleteEscalaDia(id) {
        await supabaseClient.from('escalas').delete().eq('id', id);
    },
    async deleteEscalasPorMotorista(motorista_id) {
        await supabaseClient.from('escalas').delete().eq('motorista_id', motorista_id);
    },
    async limparApenasEscalas() {
        const query = supabaseClient.from('escalas').delete().neq('id', '0');
        await aplicarFiltroFilial(query);
    },
    
    // --- TREINAMENTOS ---
    async getInstrutores() {
        const query = supabaseClient.from('instrutores').select('*');
        const { data } = await aplicarFiltroFilial(query);
        return data || [];
    },
    async addInstrutor(instrutor) {
        await supabaseClient.from('instrutores').insert([injetarFilial(instrutor)]);
    },
    async deleteInstrutor(nome) {
        await supabaseClient.from('instrutores').delete().eq('nome', nome);
    },
    async getTreinamentos() {
        const query = supabaseClient.from('treinamentos').select('*');
        const { data } = await aplicarFiltroFilial(query);
        return data || [];
    },
    async upsertTreinamento(treinamento) {
        await supabaseClient.from('treinamentos').upsert([injetarFilial(treinamento)]);
    },
    async deleteTreinamento(id) {
        await supabaseClient.from('treinamentos').delete().eq('id', id);
    },

    // --- PERMISSÕES DE ACESSO ---
    async getPermissoesDB() {
        const { data, error } = await supabaseClient.from('permissoes_perfis').select('*');
        if (error || !data) return {};
        const permissoesObj = {};
        data.forEach(item => { permissoesObj[item.perfil] = item.menus; });
        return permissoesObj;
    },
    async updatePermissoesDB(perfil, menus) {
        await supabaseClient.from('permissoes_perfis').upsert([{ perfil: perfil, menus: menus }]);
    },

    // --- ALMOXARIFADO E DOCUMENTOS ---
    async getPecas() {
        const query = supabaseClient.from('almoxarifado_pecas').select('*').order('nome', { ascending: true });
        const { data } = await aplicarFiltroFilial(query);
        return data || [];
    },
    async upsertPeca(peca) {
        await supabaseClient.from('almoxarifado_pecas').upsert([injetarFilial(peca)]);
    },
    async deletePeca(id) {
        await supabaseClient.from('almoxarifado_pecas').delete().eq('id', id);
    },
    async getMovimentacoesEstoque() {
        const query = supabaseClient.from('almoxarifado_movimentacoes').select('*, almoxarifado_pecas(nome)').order('data_movimentacao', { ascending: false });
        const { data } = await aplicarFiltroFilial(query);
        return data || [];
    },
    async addMovimentacao(movimentacao) {
        await supabaseClient.from('almoxarifado_movimentacoes').insert([injetarFilial(movimentacao)]);
        const { data: peca } = await supabaseClient.from('almoxarifado_pecas').select('quantidade').eq('id', movimentacao.peca_id).single();
        if (peca) {
            const novaQtd = movimentacao.tipo === 'entrada' ? peca.quantidade + parseFloat(movimentacao.quantidade) : peca.quantidade - parseFloat(movimentacao.quantidade);
            await supabaseClient.from('almoxarifado_pecas').update({ quantidade: novaQtd }).eq('id', movimentacao.peca_id);
        }
    },
    async getDocumentosFrota(identificadores) {
        const query = supabaseClient.from('documentos_frota').select('*').in('identificador', identificadores);
        const { data } = await aplicarFiltroFilial(query);
        return data || [];
    },
    async uploadArquivoFrota(file, path) {
        const { data, error } = await supabaseClient.storage.from('documentos_frota').upload(path, file, { upsert: true });
        if (error) throw error;
        return supabaseClient.storage.from('documentos_frota').getPublicUrl(path).data.publicUrl;
    },
    async addDocumentoFrota(doc) {
        const queryDel = supabaseClient.from('documentos_frota').delete().eq('identificador', doc.identificador).eq('tipo_documento', doc.tipo_documento);
        await aplicarFiltroFilial(queryDel);
        await supabaseClient.from('documentos_frota').insert([injetarFilial(doc)]);
    },
    async deleteDocumentoFrota(identificador, tipo_documento, path) {
        await supabaseClient.storage.from('documentos_frota').remove([path]);
        const queryDel = supabaseClient.from('documentos_frota').delete().eq('identificador', identificador).eq('tipo_documento', tipo_documento);
        await aplicarFiltroFilial(queryDel);
    }
};