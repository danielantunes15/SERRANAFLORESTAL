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

    // INICIAR MONITORAMENTO DE CHAMADOS E NOTIFICAÇÕES (Para o usuário)
    if (window.currentUser) {
        window.iniciarMonitoramentoChamados();
    }
}

// ==================== MÓDULO: CHAMADOS DE SUPORTE (VISÃO USUÁRIO) ====================

let meusChamadosCache = [];
let idChamadoChatAtual = null;
let chatIntervalUsuario = null; 
let notificacaoInterval = null;
const audioNotificacao = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg'); 

// Monitora ativamente o banco em busca de novas respostas da TI
window.iniciarMonitoramentoChamados = async function() {
    if (notificacaoInterval) clearInterval(notificacaoInterval);
    
    // Carga inicial silenciada para povoar o cache
    try {
        const { data } = await supabaseClient
            .from('chamados_suporte')
            .select('id, historico_conversa, titulo, status')
            .eq('nome_usuario', window.currentUser.username)
            .in('status', ['Aberto', 'Em Andamento', 'Resolvido']);
        if (data) meusChamadosCache = data;
    } catch(e) {}

    // Polling a cada 8 segundos verificando novidades
    notificacaoInterval = setInterval(async () => {
        try {
            const { data } = await supabaseClient
                .from('chamados_suporte')
                .select('id, historico_conversa, titulo, status')
                .eq('nome_usuario', window.currentUser.username)
                .in('status', ['Aberto', 'Em Andamento']);
            
            if (data) {
                data.forEach(chamadoNovo => {
                    const chamadoVelho = meusChamadosCache.find(c => c.id === chamadoNovo.id);
                    const histNovo = chamadoNovo.historico_conversa || [];
                    const histVelho = (chamadoVelho && chamadoVelho.historico_conversa) ? chamadoVelho.historico_conversa : [];

                    // Se a quantidade de mensagens aumentou
                    if (histNovo.length > histVelho.length) {
                        const ultimaMsg = histNovo[histNovo.length - 1];
                        
                        // E se a última for da TI
                        if (ultimaMsg.autor === 'TI') {
                            window.tocarSomNotificacao();
                            
                            // Só exibe o toast se o modal desse chamado específico NÃO estiver aberto no momento
                            if (idChamadoChatAtual !== chamadoNovo.id) {
                                window.exibirToastNotificacao(chamadoNovo.id, chamadoNovo.titulo, ultimaMsg.mensagem);
                                window.adicionarBolinhaNotificacao();
                            }
                        }
                    }
                    
                    // Atualiza o cache local silenciosamente
                    if (chamadoVelho) {
                        chamadoVelho.historico_conversa = histNovo;
                        chamadoVelho.status = chamadoNovo.status;
                    } else {
                        meusChamadosCache.push(chamadoNovo);
                    }
                });
            }
        } catch(e) {}
    }, 8000);
};

window.tocarSomNotificacao = function() {
    try {
        audioNotificacao.play().catch(() => {});
    } catch (e) {}
};

window.exibirToastNotificacao = function(idChamado, titulo, mensagem) {
    let container = document.getElementById('toast-container-chamados');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container-chamados';
        container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px; pointer-events: none;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.style.cssText = 'background: var(--bg-panel, #1e293b); border-left: 4px solid var(--ccol-blue-bright, #3b82f6); color: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); width: 320px; display: flex; flex-direction: column; gap: 10px; transition: transform 0.3s ease-out, opacity 0.3s ease-out; transform: translateX(100%); opacity: 0; pointer-events: auto;';
    
    toast.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="font-size: 0.9rem; color: var(--ccol-blue-bright, #3b82f6);"><i class="fas fa-bell"></i> Nova Resposta da TI</strong>
            <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: #94a3b8; cursor: pointer;"><i class="fas fa-times"></i></button>
        </div>
        <div style="font-size: 0.85rem; color: #e2e8f0; font-weight: bold;">Chamado #${idChamado}: ${titulo}</div>
        <div style="font-size: 0.8rem; color: #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">"${mensagem}"</div>
        <button onclick="window.abrirChatChamadoToast('${idChamado}', this)" style="background: var(--ccol-blue-bright, #3b82f6); color: #fff; border: none; padding: 8px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: bold; margin-top: 5px; transition: 0.2s;">
            Visualizar Conversa
        </button>
    `;

    container.appendChild(toast);
    
    // Animação de entrada
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    }, 10);

    // Some sozinho após 12 segundos
    setTimeout(() => {
        if(toast.parentElement) {
            toast.style.transform = 'translateX(100%)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }
    }, 12000); 
};

window.abrirChatChamadoToast = async function(id, btnElement) {
    if (btnElement && btnElement.parentElement) {
        btnElement.parentElement.remove();
    }
    window.removerBolinhaNotificacao();
    
    await window.abrirPainelMeusChamados();
    window.abrirChatChamado(id);
};

window.adicionarBolinhaNotificacao = function() {
    const btnMenu = document.querySelector('[onclick*="abrirPainelMeusChamados"]');
    if (btnMenu) {
        btnMenu.style.position = 'relative';
        let badge = btnMenu.querySelector('.badge-notificacao-ti');
        if (!badge) {
            btnMenu.insertAdjacentHTML('beforeend', '<span class="badge-notificacao-ti" style="position: absolute; top: 0px; right: 0px; background: #ef4444; width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--bg-panel, #1e293b); box-shadow: 0 0 5px rgba(239, 68, 68, 0.5);"></span>');
        }
    }
};

window.removerBolinhaNotificacao = function() {
    const btnMenu = document.querySelector('[onclick*="abrirPainelMeusChamados"]');
    if (btnMenu) {
        let badge = btnMenu.querySelector('.badge-notificacao-ti');
        if (badge) badge.remove();
    }
};

window.abrirPainelMeusChamados = async function() {
    window.removerBolinhaNotificacao(); // Limpa bolinha visual
    
    const modal = document.getElementById('modalMeusChamados');
    if(modal) modal.classList.add('show');
    
    const tbody = document.getElementById('corpoTabelaMeusChamados');
    if(tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Buscando...</td></tr>`;
    
    try {
        const { data, error } = await supabaseClient
            .from('chamados_suporte')
            .select('*')
            .eq('nome_usuario', window.currentUser.username)
            .order('data_criacao', { ascending: false });

        if (error) throw error;
        meusChamadosCache = data || [];

        if (meusChamadosCache.length === 0 && tbody) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#9ca3af; padding: 20px;">Você não possui nenhum chamado aberto no momento.</td></tr>`;
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
                <td><strong style="color: var(--ccol-blue-bright); font-size: 0.9rem;">#${c.id}</strong></td>
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
        if(tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#ef4444;">Erro ao buscar chamados.</td></tr>`;
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
        const mensagemInicial = `[Urgência: ${urgencia}]\n\n${descricao}`;

        const historicoInicial = [{
            autor: 'Usuário',
            nome: window.currentUser.username,
            data: new Date().toISOString(),
            mensagem: mensagemInicial
        }];

        const { error } = await supabaseClient.from('chamados_suporte').insert([{
            usuario_id: window.currentUser.id || 0, 
            nome_usuario: window.currentUser.username,
            filial_id: filialIdDoUsuario, 
            tipo: tipo,
            modulo: modulo,
            titulo: titulo,
            descricao: descricao, 
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
    window.removerBolinhaNotificacao(); // Limpa bolinha se abrir direto
    idChamadoChatAtual = parseInt(id);
    const chamado = meusChamadosCache.find(c => c.id === idChamadoChatAtual);
    if (!chamado) return;

    document.getElementById('chatTituloHeader').innerHTML = `<i class="fas fa-comments"></i> Chamado #${chamado.id}: ${chamado.titulo}`;
    document.getElementById('modalChatChamado').classList.add('show');
    
    window.renderizarMensagensChat(chamado.historico_conversa || []);

    if (chatIntervalUsuario) clearInterval(chatIntervalUsuario);
    chatIntervalUsuario = setInterval(async () => {
        try {
            const { data } = await supabaseClient
                .from('chamados_suporte')
                .select('historico_conversa')
                .eq('id', idChamadoChatAtual)
                .single();
                
            if (data && data.historico_conversa) {
                const historicoLocal = chamado.historico_conversa || [];
                if (data.historico_conversa.length > historicoLocal.length) {
                    chamado.historico_conversa = data.historico_conversa;
                    window.renderizarMensagensChat(data.historico_conversa);
                    // Toca som se for recebido dentro do chat ativo
                    if(data.historico_conversa[data.historico_conversa.length -1].autor === 'TI') {
                         window.tocarSomNotificacao();
                    }
                }
            }
        } catch(e) {}
    }, 4000);
};

window.fecharChatChamado = function() {
    document.getElementById('modalChatChamado').classList.remove('show');
    idChamadoChatAtual = null;
    document.getElementById('chatNovaMensagem').value = '';
    
    if (chatIntervalUsuario) {
        clearInterval(chatIntervalUsuario);
        chatIntervalUsuario = null;
    }
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