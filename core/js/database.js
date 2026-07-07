// Configuração do Supabase
const supabaseUrl = 'https://arjzadbtkhagfydymxda.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyanphZGJ0a2hhZ2Z5ZHlteGRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxODQ3MzUsImV4cCI6MjA5Nzc2MDczNX0.B7d0-lJyYpF9aRgD4t9-ZeyE9haLxBZf4D8WwrKCny8';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

window.supabaseClient = supabaseClient; 

// ================= LÓGICA SAAS (MULTI-FILIAL) =================
function aplicarFiltroFilial(query) {
    if (!window.currentUser) return query; 
    
    if (window.currentUser.filial_id === null && (window.currentUser.role === 'SuperAdmin' || window.currentUser.role === 'Admin')) {
        return query; 
    }
    
    if (window.currentUser.filial_id === undefined || window.currentUser.filial_id === null) {
        return query.is('filial_id', null); 
    }
    
    return query.eq('filial_id', window.currentUser.filial_id);
}

function injetarFilial(obj) {
    if (!window.currentUser) return obj; 
    if (obj.filial_id !== undefined) return obj; 
    if (window.currentUser.filial_id === null) return obj; 
    return { ...obj, filial_id: window.currentUser.filial_id };
}

window.aplicarFiltroFilial = aplicarFiltroFilial;
window.injetarFilial = injetarFilial;
// ===============================================================

const db = {
    // --- GESTÃO DE FILIAIS ---
    async getFiliais() {
        try {
            const { data, error } = await supabaseClient.from('filiais').select('*').eq('status', 'Ativa').order('nome', { ascending: true });
            if (error) throw error;
            return data || [];
        } catch(e) { console.error("Erro getFiliais:", e); return []; }
    },
    async getTodasFiliaisAdmin() {
        try {
            const { data, error } = await supabaseClient.from('filiais').select('*').order('nome', { ascending: true });
            if (error) throw error;
            return data || [];
        } catch(e) { console.error("Erro getTodasFiliaisAdmin:", e); return []; }
    },
    async addFilial(filial) {
        await supabaseClient.from('filiais').insert([filial]);
    },
    async updateFilialStatus(id, status) {
        await supabaseClient.from('filiais').update({ status }).eq('id', id);
    },
    async updateFilialDados(id, dados) {
        await supabaseClient.from('filiais').update(dados).eq('id', id);
    },

    // --- LOGIN E USUÁRIOS ---
    async getUsuarioByUsername(username) {
        try {
            const { data, error } = await supabaseClient.from('usuarios').select('*, filiais(nome)').eq('username', username).maybeSingle();
            if (error) throw error;
            return data;
        } catch(e) { console.error("Erro getUsuarioByUsername:", e); return null; }
    },
    async updateUsuarioSenha(id, senha_hash) {
        await supabaseClient.from('usuarios').update({ senha_hash: senha_hash, primeiro_acesso: false }).eq('id', id);
    },
    async getUsuarios(filialId = 'TODAS') {
        try {
            let query = supabaseClient.from('usuarios').select('*, filiais(nome)').order('id', { ascending: true });
            if (window.currentUser && ['SuperAdmin', 'Admin'].includes(window.currentUser.role)) {
                if (filialId && filialId !== 'TODAS') {
                    if (filialId === null || filialId === 'NULL' || filialId === 'CENTRAL') query = query.is('filial_id', null);
                    else query = query.eq('filial_id', filialId);
                }
            } else {
                query = aplicarFiltroFilial(query);
            }
            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        } catch(e) { console.error("Erro getUsuarios:", e); return []; }
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
    async updateUsuarioStatus(id, status) {
        await supabaseClient.from('usuarios').update({ status: status }).eq('id', id);
    },

    // --- LOGS DE SEGURANÇA E AUDITORIA ---
    async getLogs() {
        try {
            // MELHORIA DE BANDA: Removido o '*' (evita carregar JSONs pesados na Dashboard inicial)
            const query = supabaseClient.from('logs_exclusao')
                .select('id, data_hora, usuario, acao, detalhes, severidade, ip_address, filial_id')
                .order('data_hora', { ascending: false })
                .limit(50);
            const { data, error } = await aplicarFiltroFilial(query);
            if(error) throw error;
            return data || [];
        } catch(e) { console.error("Erro getLogs:", e); return []; }
    },
    async getLogsPaginados(page = 1, limit = 30, filtros = {}) {
        try {
            const start = (page - 1) * limit;
            const end = start + limit - 1;
            // MELHORIA DE BANDA: Removido o '*'
            let query = supabaseClient.from('logs_exclusao')
                .select('id, data_hora, usuario, acao, detalhes, severidade, ip_address, tabela_afetada, registro_id, filial_id, filiais(nome)', { count: 'exact' })
                .order('data_hora', { ascending: false })
                .range(start, end);
            
            const filialId = filtros.filialId || 'TODAS';
            if (window.currentUser && ['SuperAdmin', 'Admin'].includes(window.currentUser.role)) {
                if (filialId !== 'TODAS') {
                    if (filialId === null || filialId === 'NULL') query = query.is('filial_id', null);
                    else query = query.eq('filial_id', filialId);
                }
            } else {
                query = aplicarFiltroFilial(query);
            }

            if (filtros.modulo && filtros.modulo !== 'TODOS') {
                let chaves = '';
                switch(filtros.modulo) {
                    case 'Logistica': chaves = 'acao.ilike.%motorista%,acao.ilike.%conjunto%,acao.ilike.%escala%,acao.ilike.%frota%,acao.ilike.%documento%,detalhes.ilike.%motorista%,detalhes.ilike.%escala%'; break;
                    case 'Manutencao': chaves = 'acao.ilike.%os%,acao.ilike.%ordem%,acao.ilike.%serviço%,acao.ilike.%peça%,acao.ilike.%almoxarifado%,detalhes.ilike.%os%,detalhes.ilike.%ordem%'; break;
                    case 'SSMA': chaves = 'acao.ilike.%treinamento%,acao.ilike.%instrutor%,acao.ilike.%recado%,detalhes.ilike.%treinamento%'; break;
                    case 'Indicadores': chaves = 'acao.ilike.%indicador%,acao.ilike.%relatório%,detalhes.ilike.%painel%'; break;
                    case 'Configuracoes': chaves = 'acao.ilike.%usuário%,acao.ilike.%filial%,acao.ilike.%permiss%,detalhes.ilike.%usuário%'; break;
                }
                if (chaves !== '') query = query.or(chaves);
            }

            if (filtros.usuario && filtros.usuario !== 'TODOS') query = query.eq('usuario', filtros.usuario);
            if (filtros.dataInicio) query = query.gte('data_hora', `${filtros.dataInicio}T00:00:00`);
            if (filtros.dataFim) query = query.lte('data_hora', `${filtros.dataFim}T23:59:59`);
            
            const { data, count, error } = await query;
            if (error) throw error;
            return { data: data || [], total: count || 0 };
        } catch(e) { console.error("Erro getLogsPaginados:", e); return { data: [], total: 0 }; }
    },
    async addLog(acao, detalhes) {
        try {
            if (!window.currentUser) return;
            await supabaseClient.from('logs_exclusao').insert([injetarFilial({ usuario: window.currentUser.username, acao, detalhes })]);
        } catch(e) { console.error("Erro addLog", e); }
    },

    // --- CONJUNTOS / TRINCAS ---
    async getConjuntos() {
        try {
            const query = supabaseClient.from('conjuntos').select('*').order('id', { ascending: true });
            const { data, error } = await aplicarFiltroFilial(query);
            if(error) throw error;
            return data || [];
        } catch(e) { console.error("Erro getConjuntos:", e); return []; }
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
        try {
            const query = supabaseClient.from('motoristas').select('*');
            const { data, error } = await aplicarFiltroFilial(query);
            if(error) throw error;
            return data || [];
        } catch(e) { console.error("Erro getMotoristas:", e); return []; }
    },
    async addMotorista(motorista) {
        await supabaseClient.from('motoristas').insert([injetarFilial(motorista)]);
    },
    async updateMotorista(id, updates) {
        Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);
        await supabaseClient.from('motoristas').update(updates).eq('id', id).select();
    },
    async deleteMotorista(id) {
        await supabaseClient.from('motoristas').delete().eq('id', id);
    },

    // --- EXCEÇÕES DA ESCALA ---
    async getEscalas() {
        try {
            const query = supabaseClient.from('escalas').select('*');
            const { data, error } = await aplicarFiltroFilial(query);
            if(error) throw error;
            return data || [];
        } catch(e) { console.error("Erro getEscalas:", e); return []; }
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
        try {
            const query = supabaseClient.from('instrutores').select('*');
            const { data, error } = await aplicarFiltroFilial(query);
            if(error) throw error;
            return data || [];
        } catch(e) { console.error("Erro getInstrutores:", e); return []; }
    },
    async addInstrutor(instrutor) {
        await supabaseClient.from('instrutores').insert([injetarFilial(instrutor)]);
    },
    async deleteInstrutor(nome) {
        await supabaseClient.from('instrutores').delete().eq('nome', nome);
    },
    async getTreinamentos() {
        try {
            const query = supabaseClient.from('treinamentos').select('*');
            const { data, error } = await aplicarFiltroFilial(query);
            if(error) throw error;
            return data || [];
        } catch(e) { console.error("Erro getTreinamentos:", e); return []; }
    },
    async upsertTreinamento(treinamento) {
        await supabaseClient.from('treinamentos').upsert([injetarFilial(treinamento)]);
    },
    async deleteTreinamento(id) {
        await supabaseClient.from('treinamentos').delete().eq('id', id);
    },

    // --- PERMISSÕES DE ACESSO ---
    async getPermissoesDB() {
        try {
            const { data, error } = await supabaseClient.from('permissoes_perfis').select('*');
            if (error || !data) return {};
            const permissoesObj = {};
            data.forEach(item => { permissoesObj[item.perfil] = item.menus; });
            return permissoesObj;
        } catch(e) { console.error("Erro getPermissoesDB:", e); return {}; }
    },
    async updatePermissoesDB(perfil, menus) {
        await supabaseClient.from('permissoes_perfis').upsert([{ perfil: perfil, menus: menus }]);
    },

    // --- ALMOXARIFADO E DOCUMENTOS ---
    async getPecas() {
        try {
            const query = supabaseClient.from('almoxarifado_pecas').select('*').order('nome', { ascending: true });
            const { data, error } = await aplicarFiltroFilial(query);
            if(error) throw error;
            return data || [];
        } catch(e) { console.error("Erro getPecas:", e); return []; }
    },
    async upsertPeca(peca) {
        await supabaseClient.from('almoxarifado_pecas').upsert([injetarFilial(peca)]);
    },
    async deletePeca(id) {
        await supabaseClient.from('almoxarifado_pecas').delete().eq('id', id);
    },
    
    // LIMITANDO A BUSCA DE HISTÓRICO PARA EVITAR TRAVAMENTOS
    async getMovimentacoesEstoque(limite = 150) {
        try {
            const query = supabaseClient.from('almoxarifado_movimentacoes')
                .select('*')
                .order('data_movimentacao', { ascending: false })
                .limit(limite); 

            const { data, error } = await aplicarFiltroFilial(query);
            if(error) throw error;
            return data || [];
        } catch(e) { console.error("Erro getMovimentacoesEstoque:", e); return []; }
    },

    async addMovimentacao(movimentacao) {
        await supabaseClient.from('almoxarifado_movimentacoes').insert([injetarFilial(movimentacao)]);
        const { data: peca } = await supabaseClient.from('almoxarifado_pecas').select('quantidade').eq('id', movimentacao.peca_id).single();
        if (peca) {
            const novaQtd = movimentacao.tipo === 'entrada' ? peca.quantidade + parseFloat(movimentacao.quantidade) : peca.quantidade - parseFloat(movimentacao.quantidade);
            await supabaseClient.from('almoxarifado_pecas').update({ quantidade: novaQtd }).eq('id', movimentacao.peca_id);
        }
    },
    
    // Processar Lote de Entrada (XML/PDF)
    async processarEntradaLote(itens, nf, fornecedor) {
        // MELHORIA DE BANDA CRÍTICA: Busca todas as peças de uma vez SÓ, antes do Loop.
        // Anteriormente, se a nota tivesse 50 itens, o sistema baixava a tabela inteira 50 vezes.
        let queryCatalogo = supabaseClient.from('almoxarifado_pecas').select('*');
        queryCatalogo = aplicarFiltroFilial(queryCatalogo);
        let { data: pecasBusca } = await queryCatalogo;
        if (!pecasBusca) pecasBusca = [];

        for (let item of itens) {
            let pecaDB = pecasBusca.find(p => p.codigo === item.codigo || p.nome.toUpperCase() === item.nome.toUpperCase());

            let pecaId;
            let valorUnitarioItem = parseFloat(item.valor_unitario) || 0;
            let qtdItem = parseFloat(item.quantidade) || 0;

            if (pecaDB) {
                pecaId = pecaDB.id;
                const novaQtd = parseFloat(pecaDB.quantidade || 0) + qtdItem;
                
                // Atualiza a peça existente
                await supabaseClient.from('almoxarifado_pecas').update({
                    quantidade: novaQtd,
                    preco_medio: valorUnitarioItem > 0 ? valorUnitarioItem : pecaDB.preco_medio 
                }).eq('id', pecaId);
                
                // Atualiza em memória caso haja outro item igual na mesma nota
                pecaDB.quantidade = novaQtd;
                if (valorUnitarioItem > 0) pecaDB.preco_medio = valorUnitarioItem;

            } else {
                // Cria a nova peça
                const novaPeca = injetarFilial({
                    codigo: item.codigo || '',
                    nome: item.nome || 'Produto Desconhecido',
                    unidade: item.unidade || 'UN',
                    quantidade: qtdItem,
                    preco_medio: valorUnitarioItem,
                    estoque_minimo: item.estoque_minimo || 2,
                    localizacao: 'Entrada NF'
                });
                
                const { data: insertData, error } = await supabaseClient
                    .from('almoxarifado_pecas')
                    .insert([novaPeca])
                    .select();
                    
                if (error) throw error;
                if (insertData && insertData.length > 0) {
                    pecaId = insertData[0].id;
                    pecasBusca.push(insertData[0]); // Adiciona à lista em memória
                }
            }

            // Registra a movimentação no histórico
            if (pecaId) {
                const mov = injetarFilial({
                    peca_id: pecaId,
                    tipo: 'entrada',
                    quantidade: qtdItem,
                    valor_unitario: valorUnitarioItem,
                    nota_fiscal: nf,
                    fornecedor: fornecedor,
                    data_movimentacao: new Date().toISOString()
                });
                await supabaseClient.from('almoxarifado_movimentacoes').insert([mov]);
            }
        }
    },

    async getDocumentosFrota(identificadores) {
        try {
            const query = supabaseClient.from('documentos_frota').select('*').in('identificador', identificadores);
            const { data, error } = await aplicarFiltroFilial(query);
            if(error) throw error;
            return data || [];
        } catch(e) { console.error("Erro getDocumentosFrota:", e); return []; }
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
    },

    // --- CONTROLADORES DE TRÁFEGO ---
    async getControladoresTrafego() {
        try {
            const query = supabaseClient.from('controladores_trafego').select('*').eq('status', 'Ativo').order('nome', { ascending: true });
            const { data, error } = await aplicarFiltroFilial(query);
            if(error) throw error;
            return data || [];
        } catch(e) { console.error("Erro getControladoresTrafego:", e); return []; }
    },
    async addControladorTrafego(controlador) {
        await supabaseClient.from('controladores_trafego').insert([injetarFilial(controlador)]);
    },
    async deleteControladorTrafego(id) {
        await supabaseClient.from('controladores_trafego').update({ status: 'Inativo' }).eq('id', id);
    },

    // --- TURNOS OPERACIONAIS ---
    async getTurnosOperacionais() {
        try {
            const query = supabaseClient.from('turnos_operacionais').select('*').eq('status', 'Ativo').order('nome', { ascending: true });
            const { data, error } = await aplicarFiltroFilial(query);
            if(error) throw error;
            return data || [];
        } catch(e) { console.error("Erro getTurnosOperacionais:", e); return []; }
    },
    async addTurnoOperacional(turno) {
        await supabaseClient.from('turnos_operacionais').insert([injetarFilial(turno)]);
    },
    async deleteTurnoOperacional(id) {
        await supabaseClient.from('turnos_operacionais').update({ status: 'Inativo' }).eq('id', id);
    },

    // --- RH COLABORADORES ---
    async getColaboradores() {
        try {
            const query = supabaseClient.from('rh_colaboradores').select('*').order('nome', { ascending: true });
            const { data, error } = await aplicarFiltroFilial(query);
            if(error) throw error;
            return data || [];
        } catch(e) { console.error("Erro getColaboradores:", e); return []; }
    },
    async addColaborador(colaborador) {
        await supabaseClient.from('rh_colaboradores').insert([injetarFilial(colaborador)]);
    },
    async updateColaborador(id, updates) {
        await supabaseClient.from('rh_colaboradores').update(updates).eq('id', id);
    },
    async deleteColaborador(id) {
        await supabaseClient.from('rh_colaboradores').delete().eq('id', id);
    },

    // --- RH ATESTADOS ---
    async getAtestados() {
        try {
            const query = supabaseClient.from('rh_atestados').select('*, rh_colaboradores(nome, cod_funcionario)').order('data_inicio', { ascending: false });
            const { data, error } = await aplicarFiltroFilial(query);
            if(error) throw error;
            return data || [];
        } catch(e) { console.error("Erro getAtestados:", e); return []; }
    },
    async addAtestado(atestado) {
        await supabaseClient.from('rh_atestados').insert([injetarFilial(atestado)]);
    },
    async deleteAtestado(id) {
        await supabaseClient.from('rh_atestados').delete().eq('id', id);
    },

    // --- CLASSIFICAÇÕES DE O.S. (CADASTRO BÁSICO) ---
    async getClassificacoesOS(incluirInativos = false) {
        try {
            let query = supabaseClient.from('os_classificacoes').select('*').order('nome', { ascending: true });
            if (!incluirInativos) {
                query = query.eq('status', 'Ativo');
            }
            const { data, error } = await aplicarFiltroFilial(query);
            if(error) throw error;
            return data || [];
        } catch(e) { console.error("Erro getClassificacoesOS:", e); return []; }
    },
    async addClassificacaoOS(obj) {
        const { error } = await supabaseClient.from('os_classificacoes').insert([injetarFilial(obj)]);
        if(error) throw error;
    },
    async updateClassificacaoOS(id, obj) {
        const { error } = await supabaseClient.from('os_classificacoes').update(obj).eq('id', id);
        if(error) throw error;
    },
    async deleteClassificacaoOS(id) {
        const { error } = await supabaseClient.from('os_classificacoes').update({ status: 'Inativo' }).eq('id', id);
        if(error) throw error;
    }
};

window.db = db;