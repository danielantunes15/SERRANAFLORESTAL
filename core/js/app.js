// ==================== MÓDULO: NAVEGAÇÃO E INICIALIZAÇÃO DO DASHBOARD ====================

window.atualizarStats = function() {
    try {
        const statConjuntos = document.getElementById('statConjuntos');
        const statCaminhoes = document.getElementById('statCaminhoes');
        const statMotoristas = document.getElementById('statMotoristas');
        const statDisponiveis = document.getElementById('statDisponiveis');
        const statCavalos = document.getElementById('statCavalos');
        
        const listaConjuntos = typeof conjuntos !== 'undefined' ? conjuntos : [];
        const listaMotoristas = typeof motoristas !== 'undefined' ? motoristas : [];

        const totalCaminhoes = listaConjuntos.reduce((acc, c) => acc + (c.caminhoes?.length || 0), 0);

        if (statConjuntos) statConjuntos.innerText = listaConjuntos.length;
        if (statCaminhoes) statCaminhoes.innerText = totalCaminhoes;
        if (statCavalos) statCavalos.innerText = totalCaminhoes; 
        if (statMotoristas) statMotoristas.innerText = listaMotoristas.length;
        
        if (statDisponiveis) {
            const qtdeDisponiveis = listaMotoristas.filter(m => !m.conjuntoId).length;
            statDisponiveis.innerText = qtdeDisponiveis;
        }
    } catch (e) { }
}

// NOVO: Função para carregar os modais de suporte dinamicamente de outro arquivo
window.carregarModaisChamados = async function() {
    try {
        const response = await fetch(`modules/global/modais_chamados.html?v=${new Date().getTime()}`);
        if (response.ok) {
            const html = await response.text();
            const container = document.createElement('div');
            container.id = 'containerModaisChamados';
            container.innerHTML = html;
            document.body.appendChild(container);
        }
    } catch (e) {
        console.error("Erro ao carregar modais de chamados", e);
    }
};

window.initDashboard = async function() {
    const containerApp = document.getElementById('conteudo-principal');
    if (containerApp) {
        containerApp.innerHTML = `
            <div id="loadingSincronizacao" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 50vh; text-align: center; padding: 20px;">
                <i class="fas fa-circle-notch fa-spin fa-3x" style="color: #3b82f6; margin-bottom: 20px;"></i>
                <h3 style="color: #f8fafc;">Sincronizando Banco de Dados...</h3>
                <p style="color: #94a3b8;">Aguarde um momento.</p>
            </div>
        `;
    }
    
    // Injeta os modais na tela sem travar o usuário
    await window.carregarModaisChamados();

    try {
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 5000));
        const chamadasBanco = async () => {
            if (typeof carregarDadosIniciais === 'function') await carregarDadosIniciais();
            return 'OK';
        };
        await Promise.race([chamadasBanco(), timeoutPromise]);
    } catch (e) {}

    try {
        if (typeof window.renderizarMenu === 'function') {
            await window.renderizarMenu();
        }
    } catch (e) {}
    atualizarStats();
}

// ==================== MÓDULO: CHAMADOS DE SUPORTE (VISÃO USUÁRIO) ====================

let meusChamadosCache = [];
let idChamadoChatAtual = null;

window.abrirPainelMeusChamados = async function() {
    const modal = document.getElementById('modalMeusChamados');
    if(modal) modal.classList.add('show');
    
    const tbody = document.getElementById('corpoTabelaMeusChamados');
    if(tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Buscando...</td></tr>`;
    
    try {
        const { data, error } = await supabaseClient
            .from('chamados_suporte')
            .select('*')
            .eq('nome_usuario', window.currentUser.username)
            .order('data_criacao', { ascending: false });

        if (error) throw error;
        meusChamadosCache = data || [];

        if (meusChamadosCache.length === 0 && tbody) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#9ca3af; padding: 20px;">Você não possui nenhum chamado aberto no momento.</td></tr>`;
            return;
        }

        if(tbody) tbody.innerHTML = '';
        meusChamadosCache.forEach(c => {
            const dataFmt = new Date(c.data_criacao).toLocaleString('pt-BR').substring(0, 16);
            let badge = '';
            if (c.status === 'Aberto') badge = `<span style="color:#ef4444; font-weight:bold;">🔴 Aberto</span>`;
            else if (c.status === 'Em Andamento') badge = `<span style="color:#fb923c; font-weight:bold;">🟡 Em Análise</span>`;
            else if (c.status === 'Resolvido') badge = `<span style="color:var(--ccol-green-bright); font-weight:bold;">🟢 Resolvido</span>`;
            else badge = `<span style="color:#9ca3af; font-weight:bold;">⚫ Cancelado</span>`;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-size: 0.8rem; color: #9ca3af;">${dataFmt}</td>
                <td><strong style="color: #fff; font-size: 0.85rem;">${c.titulo}</strong></td>
                <td>${badge}</td>
                <td>
                    <button class="btn-primary-blue" onclick="window.abrirChatChamado('${c.id}')" style="padding: 4px 10px; font-size: 0.75rem;">
                        <i class="fas fa-comments"></i> Conversar
                    </button>
                </td>
            `;
            if(tbody) tbody.appendChild(tr);
        });

    } catch(e) {
        if(tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#ef4444;">Erro ao buscar chamados.</td></tr>`;
    }
};

window.fecharPainelMeusChamados = function() {
    const modal = document.getElementById('modalMeusChamados');
    if(modal) modal.classList.remove('show');
};

window.abrirModalNovoChamado = function() {
    const modal = document.getElementById('modalChamadoSuporte');
    if(modal) modal.classList.add('show');
};

window.fecharModalNovoChamado = function() {
    const modal = document.getElementById('modalChamadoSuporte');
    if(modal) modal.classList.remove('show');
    
    if(document.getElementById('chamadoTitulo')) document.getElementById('chamadoTitulo').value = '';
    if(document.getElementById('chamadoDescricao')) document.getElementById('chamadoDescricao').value = '';
};

window.salvarChamadoSuporte = async function() {
    const tipo = document.getElementById('chamadoTipo').value;
    const modulo = document.getElementById('chamadoModulo').value;
    const urgencia = document.getElementById('chamadoUrgencia').value;
    const titulo = document.getElementById('chamadoTitulo').value;
    const descricao = document.getElementById('chamadoDescricao').value;

    if (!titulo || !descricao) { 
        alert("Preencha o título e a descrição detalhada para a TI poder te ajudar."); 
        return; 
    }

    const btn = document.getElementById('btnSalvarChamado');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...'; 
    btn.disabled = true;

    try {
        const filialIdDoUsuario = window.currentUser.filial_id === 'CENTRAL' ? null : window.currentUser.filial_id;

        // Anexamos a urgência diretamente na primeira mensagem do chat, assim não precisamos alterar o banco de dados
        const mensagemInicial = `[Urgência: ${urgencia}]\n\n${descricao}`;

        const historicoInicial = [{
            autor: 'Usuário',
            nome: window.currentUser.username,
            data: new Date().toISOString(),
            mensagem: mensagemInicial
        }];

        const { error } = await supabaseClient.from('chamados_suporte').insert([{
            usuario_id: window.currentUser.id || '00000000-0000-0000-0000-000000000000',
            nome_usuario: window.currentUser.username,
            filial_id: filialIdDoUsuario, 
            tipo: tipo,
            modulo: modulo,
            titulo: titulo,
            descricao: descricao, // Descrição crua
            status: 'Aberto',
            historico_conversa: historicoInicial 
        }]);

        if (error) throw error;
        alert("✅ Chamado registrado com sucesso! A equipe de tecnologia já foi notificada.");
        window.fecharModalNovoChamado();
        window.abrirPainelMeusChamados(); 

    } catch (e) {
        console.error(e); 
        alert("Erro ao criar chamado. Verifique sua conexão.");
    } finally {
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Chamado'; 
        btn.disabled = false;
    }
};

window.abrirChatChamado = function(id) {
    idChamadoChatAtual = id;
    const chamado = meusChamadosCache.find(c => c.id === id);
    if (!chamado) return;

    document.getElementById('chatTituloHeader').innerHTML = `<i class="fas fa-comments"></i> Chat: ${chamado.titulo}`;
    document.getElementById('modalChatChamado').classList.add('show');
    
    window.renderizarMensagensChat(chamado.historico_conversa || []);
};

window.fecharChatChamado = function() {
    document.getElementById('modalChatChamado').classList.remove('show');
    idChamadoChatAtual = null;
    document.getElementById('chatNovaMensagem').value = '';
};

window.renderizarMensagensChat = function(historico) {
    const container = document.getElementById('chatMensagensContainer');
    container.innerHTML = '';

    if (!historico || historico.length === 0) {
        container.innerHTML = `<p style="color:#9ca3af; text-align:center; margin-top:20px;">Nenhuma interação registrada.</p>`;
        return;
    }

    historico.forEach(msg => {
        const dataFmt = new Date(msg.data).toLocaleString('pt-BR');
        const isUsuario = msg.autor === 'Usuário';

        const align = isUsuario ? 'align-self: flex-end;' : 'align-self: flex-start;';
        const bgColor = isUsuario ? 'background: #2563eb;' : 'background: #374151;';
        const borderRadius = isUsuario ? 'border-radius: 12px 12px 0 12px;' : 'border-radius: 12px 12px 12px 0;';
        const iconUser = isUsuario ? '👤' : '💻 TI';

        const div = document.createElement('div');
        div.style.cssText = `max-width: 85%; padding: 12px 16px; color: #fff; display: flex; flex-direction: column; box-shadow: 0 4px 6px rgba(0,0,0,0.1); ${align} ${bgColor} ${borderRadius}`;
        
        div.innerHTML = `
            <div style="font-size: 0.75rem; color: #cbd5e1; margin-bottom: 8px; font-weight:bold; display: flex; justify-content: space-between; gap: 15px;">
                <span>${iconUser} ${msg.nome}</span> 
                <span style="font-weight:normal; opacity: 0.8;">${dataFmt}</span>
            </div>
            <div style="font-size: 0.95rem; line-height: 1.5; word-wrap: break-word; white-space: pre-wrap;">${msg.mensagem}</div>
        `;
        container.appendChild(div);
    });

    setTimeout(() => { container.scrollTop = container.scrollHeight; }, 100);
};

window.enviarMensagemUsuario = async function() {
    if (!idChamadoChatAtual) return;
    const txtMsg = document.getElementById('chatNovaMensagem').value.trim();
    if (!txtMsg) return;

    const btn = document.getElementById('btnEnviarMensagemUsuario');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true;

    try {
        const chamado = meusChamadosCache.find(c => c.id === idChamadoChatAtual);
        let historico = chamado.historico_conversa || [];

        historico.push({
            autor: 'Usuário',
            nome: window.currentUser.username,
            data: new Date().toISOString(),
            mensagem: txtMsg
        });

        const { error } = await supabaseClient
            .from('chamados_suporte')
            .update({ historico_conversa: historico })
            .eq('id', idChamadoChatAtual);

        if (error) throw error;

        chamado.historico_conversa = historico;
        window.renderizarMensagensChat(historico);
        document.getElementById('chatNovaMensagem').value = '';

    } catch (e) {
        alert("Erro ao enviar mensagem.");
    } finally {
        btn.innerHTML = '<i class="fas fa-paper-plane"></i>'; btn.disabled = false;
    }
};