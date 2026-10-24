// ==================== MÓDULO: CONJUNTOS E CAMINHÕES ====================
window.renderizarConjuntos = function() {
    const grid = document.getElementById('conjuntosList');
    if (!grid) return;

    if (conjuntos.length === 0) {
        grid.innerHTML = '<p style="padding: 20px; color: var(--text-secondary);">Nenhum conjunto cadastrado.</p>';
        return;
    }

    let html = '';
    conjuntos.forEach(c => {
        let caminhoesHtml = '';
        if(c.caminhoes) {
            c.caminhoes.forEach((cam, index) => {
                const placa = typeof cam === 'string' ? cam : cam.placa;
                // Lê 'frota' (nova versão) ou 'go' (antiga versão para compatibilidade)
                const frota = typeof cam === 'string' ? '' : (cam.frota || cam.go);

                caminhoesHtml += `
                    <div class="caminhao-item">
                        <span>  <strong>${placa}</strong> ${frota ? `| FROTA: ${frota}` : ''}</span>
                        <div style="display: flex; gap: 5px;">
                            <button class="btn-transferir" onclick="editarCaminhao(${c.id}, ${index})" title="Editar Caminhão"><i class="fas fa-pen"></i></button>
                            <button class="btn-remove-caminhao" onclick="removerCaminhao(${c.id}, ${index})" title="Remover Caminhão"><i class="fas fa-times"></i></button>
                        </div>
                    </div>
                `;
            });
        }

        html += `
            <div class="conjunto-card">
                <div class="conjunto-header" style="justify-content: flex-start; align-items: center; gap: 12px;">
                    <span class="conjunto-id" style="margin: 0;">Conjunto ${c.id}</span>
                    <button class="btn-remove-conjunto" style="padding: 6px 10px;" onclick="removerConjunto(${c.id})" title="Excluir Conjunto"><i class="fas fa-trash"></i></button>
                </div>
                <div class="caminhoes-list">
                    <strong>Caminhões Alocados:</strong>
                    ${caminhoesHtml || '<span style="font-size:0.8rem; color: #888;">Nenhum caminhão vinculado</span>'}
                </div>
                <div class="add-caminhao">
                    <div style="display:flex; gap:5px;">
                        <input type="text" id="addCamPlaca_${c.id}" placeholder="Placa" style="width: 60%; text-transform:uppercase;">
                        <input type="text" id="addCamFrota_${c.id}" placeholder="FROTA" style="width: 40%;">
                    </div>
                    <button class="btn-add-caminhao" onclick="adicionarCaminhaoAoConjunto(${c.id})">  Adicionar Placa</button>
                </div>
            </div>
        `;
    });

    grid.innerHTML = html;
}

window.adicionarConjunto = async function() {
    const idInput = document.getElementById('conjuntoId').value;
    const c1Placa = document.getElementById('caminhao1Placa').value.toUpperCase();
    const c1Frota = document.getElementById('caminhao1Frota').value;
    const c2Placa = document.getElementById('caminhao2Placa').value.toUpperCase();
    const c2Frota = document.getElementById('caminhao2Frota').value;

    if (!idInput) { alert('Informe o ID do Conjunto!'); return; }
    const idNum = parseInt(idInput);
    if (conjuntos.find(c => c.id === idNum)) { alert('Este Conjunto já existe na sua tela!'); return; }

    let caminhoesArr = [];
    if(c1Placa) caminhoesArr.push({ placa: c1Placa, frota: c1Frota });
    if(c2Placa) caminhoesArr.push({ placa: c2Placa, frota: c2Frota });

    let novoConjunto = { id: idNum, caminhoes: caminhoesArr };
    
    // Injeta a filial no objeto de forma padronizada
    if (typeof window.injetarFilial === 'function') {
        novoConjunto = window.injetarFilial(novoConjunto);
    }

    try {
        if (window.supabaseClient) {
            const { error } = await window.supabaseClient.from('conjuntos').insert([novoConjunto]);
            if (error) throw error;
        } else {
            const res = await db.addConjunto(novoConjunto);
            if (res && res.error) throw res.error;
        }

        // SÓ ADICIONA NO ARRAY E LIMPA A TELA SE O BANCO DE DADOS CONFIRMAR O SUCESSO
        conjuntos.push(novoConjunto);
        if (typeof salvarBackupLocal === 'function') salvarBackupLocal();
        
        document.getElementById('conjuntoId').value = '';
        document.getElementById('caminhao1Placa').value = '';
        document.getElementById('caminhao1Frota').value = '';
        document.getElementById('caminhao2Placa').value = '';
        document.getElementById('caminhao2Frota').value = '';
        
        renderizarConjuntos();
        if(typeof renderizarAlocacao === 'function') renderizarAlocacao();
        if(typeof atualizarStats === 'function') atualizarStats();
        
        alert('Conjunto criado com sucesso!');

    } catch (err) {
        console.error("Erro ao salvar conjunto:", err);
        alert('Ocorreu um erro ao salvar o conjunto no banco de dados. Verifique o console.');
    }
}

window.removerConjunto = async function(id) {
    if (!confirm('Deseja excluir este conjunto inteiro?')) return;
    
    try {
        // Exclusão protegida pelo filial_id do usuário logado
        if (window.supabaseClient && window.currentUser && window.currentUser.filial_id) {
            const { error } = await window.supabaseClient.from('conjuntos')
                .delete()
                .eq('id', id)
                .eq('filial_id', window.currentUser.filial_id);
            if (error) throw error;
        } else if (typeof db.deleteConjunto === 'function') {
            await db.deleteConjunto(id); // Fallback caso não use o cliente Supabase direto
        }

        conjuntos = conjuntos.filter(c => c.id !== id);
        
        if (typeof db !== 'undefined' && typeof db.addLog === 'function') {
            await db.addLog('Exclusão de Conjunto', `O Conjunto ID ${id} foi inteiramente apagado.`);
        }
        if (typeof renderizarLogs === 'function') renderizarLogs();
        
        if (typeof salvarBackupLocal === 'function') salvarBackupLocal();
        renderizarConjuntos();
        if (typeof renderizarAlocacao === 'function') renderizarAlocacao();
        if (typeof atualizarStats === 'function') atualizarStats();
        
    } catch (e) {
        console.error("Erro ao excluir conjunto:", e);
        alert("Erro ao excluir o conjunto do banco de dados.");
    }
}

window.removerCaminhao = async function(conjId, index) {
    const c = conjuntos.find(x => x.id === conjId);
    if (!c) return;
    
    const camRemovido = c.caminhoes[index].placa || c.caminhoes[index];
    c.caminhoes.splice(index, 1);
    
    try {
        // Atualização protegida pelo filial_id do usuário logado
        if (window.supabaseClient && window.currentUser && window.currentUser.filial_id) {
            const { error } = await window.supabaseClient.from('conjuntos')
                .update({ caminhoes: c.caminhoes })
                .eq('id', conjId)
                .eq('filial_id', window.currentUser.filial_id);
            if (error) throw error;
        } else if (typeof db.updateConjunto === 'function') {
            await db.updateConjunto(conjId, c.caminhoes);
        }

        if (typeof db !== 'undefined' && typeof db.addLog === 'function') {
            await db.addLog('Remoção de Caminhão', `Caminhão Placa ${camRemovido} removido do Conjunto ${conjId}.`);
        }
        if (typeof renderizarLogs === 'function') renderizarLogs();

        if (typeof salvarBackupLocal === 'function') salvarBackupLocal();
        renderizarConjuntos();
        if (typeof renderizarAlocacao === 'function') renderizarAlocacao();
        if (typeof atualizarStats === 'function') atualizarStats();
        
    } catch (e) {
        console.error("Erro ao remover caminhão:", e);
        alert("Erro ao atualizar o conjunto no banco de dados.");
    }
}

window.editarCaminhao = async function(conjId, index) {
    const c = conjuntos.find(x => x.id === conjId);
    if (!c) return;
    
    const camAtual = c.caminhoes[index];
    const placaAtual = typeof camAtual === 'string' ? camAtual : camAtual.placa;
    const frotaAtual = typeof camAtual === 'string' ? '' : (camAtual.frota || camAtual.go || '');

    const novaPlaca = prompt("Digite a nova Placa do caminhão:", placaAtual);
    if (novaPlaca === null) return; 
    
    const novaFrota = prompt("Digite a nova Frota do caminhão (opcional):", frotaAtual);
    if (novaFrota === null) return; 

    const placaFormatada = novaPlaca.trim().toUpperCase();
    if (!placaFormatada) {
        alert("A placa não pode ficar vazia.");
        return;
    }

    c.caminhoes[index] = { placa: placaFormatada, frota: novaFrota.trim() };
    
    try {
        // Atualização protegida pelo filial_id do usuário logado
        if (window.supabaseClient && window.currentUser && window.currentUser.filial_id) {
            const { error } = await window.supabaseClient.from('conjuntos')
                .update({ caminhoes: c.caminhoes })
                .eq('id', conjId)
                .eq('filial_id', window.currentUser.filial_id);
            if (error) throw error;
        } else if (typeof db.updateConjunto === 'function') {
            await db.updateConjunto(conjId, c.caminhoes);
        }

        if (typeof db !== 'undefined' && typeof db.addLog === 'function') {
            await db.addLog('Edição de Caminhão', `Caminhão alterado no Conjunto ${conjId}: de ${placaAtual} para ${placaFormatada}.`);
        }
        if (typeof renderizarLogs === 'function') renderizarLogs();
        
        if (typeof salvarBackupLocal === 'function') salvarBackupLocal();
        renderizarConjuntos();
        if (typeof renderizarAlocacao === 'function') renderizarAlocacao();
        if (typeof atualizarStats === 'function') atualizarStats();
        
    } catch (e) {
        console.error("Erro ao editar caminhão:", e);
        alert("Erro ao atualizar o conjunto no banco de dados.");
    }
}

window.adicionarCaminhaoAoConjunto = async function(conjId) {
    const placa = document.getElementById(`addCamPlaca_${conjId}`).value.toUpperCase();
    const frota = document.getElementById(`addCamFrota_${conjId}`).value;

    if(!placa) { alert('Informe a placa do caminhão.'); return; }

    const c = conjuntos.find(x => x.id === conjId);
    if(!c) return;

    if(!c.caminhoes) c.caminhoes = [];
    c.caminhoes.push({ placa, frota });

    try {
        // Atualização protegida pelo filial_id do usuário logado
        if (window.supabaseClient && window.currentUser && window.currentUser.filial_id) {
            const { error } = await window.supabaseClient.from('conjuntos')
                .update({ caminhoes: c.caminhoes })
                .eq('id', conjId)
                .eq('filial_id', window.currentUser.filial_id);
            if (error) throw error;
        } else if (typeof db.updateConjunto === 'function') {
            await db.updateConjunto(conjId, c.caminhoes);
        }

        if (typeof salvarBackupLocal === 'function') salvarBackupLocal();
        renderizarConjuntos();
        if (typeof renderizarAlocacao === 'function') renderizarAlocacao();
        if (typeof atualizarStats === 'function') atualizarStats();
        
    } catch (e) {
        console.error("Erro ao adicionar caminhão:", e);
        alert("Erro ao atualizar o conjunto no banco de dados.");
    }
}