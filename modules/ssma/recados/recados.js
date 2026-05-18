// ==================== MÓDULO: RECADOS E ANOTAÇÕES (KANBAN) ====================

window.carregarRecados = function() {
    const formRecado = document.getElementById('form-recado');
    
    if (formRecado && !formRecado.hasAttribute('data-listener')) {
        formRecado.addEventListener('submit', async (e) => {
            e.preventDefault();
            await salvarRecado();
        });
        formRecado.setAttribute('data-listener', 'true');
    }

    atualizarListaRecados();
};

window.alternarAbaRecados = function(aba) {
    const viewQuadro = document.getElementById('view-quadro');
    const viewHistorico = document.getElementById('view-historico');
    const btnQuadro = document.getElementById('btn-tab-quadro');
    const btnHistorico = document.getElementById('btn-tab-historico');

    if (aba === 'quadro') {
        viewQuadro.style.display = 'flex';
        viewHistorico.style.display = 'none';
        btnQuadro.classList.add('active');
        btnHistorico.classList.remove('active');
        atualizarListaRecados();
    } else {
        viewQuadro.style.display = 'none';
        viewHistorico.style.display = 'block';
        btnHistorico.classList.add('active');
        btnQuadro.classList.remove('active');
        carregarHistoricoRecados();
    }
};

async function salvarRecado() {
    const titulo = document.getElementById('titulo-recado').value;
    const descricao = document.getElementById('desc-recado').value;
    const prioridade = document.getElementById('prioridade-recado').value;
    const data_agendamento = document.getElementById('data-recado').value;

    try {
        const { error } = await supabaseClient
            .from('recados_anotacoes')
            .insert([
                { 
                    titulo: titulo, 
                    descricao: descricao, 
                    prioridade: prioridade,
                    data_agendamento: data_agendamento,
                    status: 'pendente' 
                }
            ]);

        if (error) throw error;
        
        document.getElementById('form-recado').reset();
        document.getElementById('prioridade-recado').value = 'media';
        atualizarListaRecados(); 
    } catch (error) {
        console.error('Erro ao salvar recado:', error);
        alert('Erro ao salvar o recado no banco: ' + error.message);
    }
}

async function atualizarListaRecados() {
    const listas = {
        baixa: document.getElementById('lista-baixa'),
        media: document.getElementById('lista-media'),
        alta: document.getElementById('lista-alta'),
        troca: document.getElementById('lista-troca')
    };

    Object.values(listas).forEach(lista => {
        if(lista) lista.innerHTML = '<p style="color:#64748b; font-size:0.8rem; padding:10px;">Buscando...</p>';
    });

    try {
        const { data: recados, error } = await supabaseClient
            .from('recados_anotacoes')
            .select('*')
            .eq('status', 'pendente')
            .order('data_agendamento', { ascending: true });

        if (error) throw error;

        Object.values(listas).forEach(lista => { if(lista) lista.innerHTML = ''; });

        const contadores = { baixa: 0, media: 0, alta: 0, troca: 0 };

        if (recados && recados.length > 0) {
            recados.forEach(recado => {
                const prio = recado.prioridade || 'media'; 
                if(contadores.hasOwnProperty(prio)) contadores[prio]++;

                let dataFormatada = recado.data_agendamento 
                    ? new Date(recado.data_agendamento).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) 
                    : 'Sem data';
                
                const card = document.createElement('div');
                card.className = `card-kanban card-${prio}`;
                card.id = `recado-${recado.id}`;
                card.draggable = true;
                card.ondragstart = (event) => arrastarRecado(event, recado.id);
                
                card.innerHTML = `
                    <h4 class="card-title">${recado.titulo}</h4>
                    <p class="card-desc">${recado.descricao}</p>
                    <div class="card-footer">
                        <span class="card-meta">🕒 ${dataFormatada}</span>
                        <button class="btn-concluir-mini" onclick="concluirRecado(${recado.id})">✔ Concluir</button>
                    </div>
                `;
                
                if(listas[prio]) listas[prio].appendChild(card);
            });
        }

        if(document.getElementById('count-baixa')) document.getElementById('count-baixa').innerText = contadores.baixa;
        if(document.getElementById('count-media')) document.getElementById('count-media').innerText = contadores.media;
        if(document.getElementById('count-alta')) document.getElementById('count-alta').innerText = contadores.alta;
        if(document.getElementById('count-troca')) document.getElementById('count-troca').innerText = contadores.troca;

    } catch (error) {
        console.error('Erro ao carregar recados:', error);
    }
}

// ==================== LÓGICA DE DRAG & DROP ====================

window.arrastarRecado = function(event, id) {
    event.dataTransfer.setData('text/plain', id);
};

window.permitirSoltar = function(event) {
    event.preventDefault();
};

window.soltarRecado = async function(event, novaPrioridade) {
    event.preventDefault();
    const idRecado = event.dataTransfer.getData('text/plain');
    if (!idRecado) return;

    try {
        const { error } = await supabaseClient
            .from('recados_anotacoes')
            .update({ prioridade: novaPrioridade })
            .eq('id', idRecado);

        if (error) throw error;
        
        atualizarListaRecados();
    } catch (error) {
        console.error('Erro ao atualizar prioridade:', error);
    }
};

// ==================== LÓGICA DE CONCLUSÃO E HISTÓRICO ====================

window.concluirRecado = async function(id) {
    try {
        const { error } = await supabaseClient
            .from('recados_anotacoes')
            .update({ status: 'concluido' })
            .eq('id', id);

        if (error) throw error;
        atualizarListaRecados();
    } catch (error) {
        console.error('Erro ao concluir recado:', error);
    }
};

window.carregarHistoricoRecados = async function() {
    const container = document.getElementById('lista-historico');
    if(!container) return;
    
    container.innerHTML = '<p style="color: #94a3b8; grid-column: 1 / -1;">Buscando histórico...</p>';

    try {
        const { data: historico, error } = await supabaseClient
            .from('recados_anotacoes')
            .select('*')
            .eq('status', 'concluido')
            .order('data_agendamento', { ascending: true });

        if (error) throw error;

        container.innerHTML = ''; 

        if (!historico || historico.length === 0) {
            container.innerHTML = '<p style="color: #94a3b8; grid-column: 1 / -1;">Nenhum recado no histórico.</p>';
            return;
        }

        historico.forEach(recado => {
            const dataF = recado.data_agendamento 
                ? new Date(recado.data_agendamento).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) 
                : 'Sem data';

            const div = document.createElement('div');
            div.className = 'card-kanban';
            div.style.borderLeft = '4px solid #10b981';
            div.style.opacity = '0.8';
            
            div.innerHTML = `
                <h4 class="card-title" style="text-decoration: line-through; color: #10b981;">${recado.titulo}</h4>
                <p class="card-desc">${recado.descricao}</p>
                <div class="card-footer">
                    <span class="card-meta">📅 Agendado para: ${dataF}</span>
                    <span class="card-meta" style="color:#10b981;">Concluído ✔</span>
                </div>
            `;
            container.appendChild(div);
        });
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
    }
};

window.limparHistoricoRecados = async function() {
    if(confirm('Tem certeza que deseja DELETAR todo o histórico de tarefas concluídas?')) {
        try {
            const { error } = await supabaseClient
                .from('recados_anotacoes')
                .delete()
                .eq('status', 'concluido');

            if (error) throw error;
            carregarHistoricoRecados();
        } catch (error) {
            console.error('Erro ao limpar histórico:', error);
        }
    }
};