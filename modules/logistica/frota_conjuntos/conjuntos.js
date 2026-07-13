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
    if (conjuntos.find(c => c.id === idNum)) { alert('Este Conjunto já existe!'); return; }

    let caminhoesArr = [];
    if(c1Placa) caminhoesArr.push({ placa: c1Placa, frota: c1Frota });
    if(c2Placa) caminhoesArr.push({ placa: c2Placa, frota: c2Frota });

    const novoConjunto = { id: idNum, caminhoes: caminhoesArr };
    conjuntos.push(novoConjunto);

    await db.addConjunto(novoConjunto);
    salvarBackupLocal();
    
    document.getElementById('conjuntoId').value = '';
    document.getElementById('caminhao1Placa').value = '';
    document.getElementById('caminhao1Frota').value = '';
    document.getElementById('caminhao2Placa').value = '';
    document.getElementById('caminhao2Frota').value = '';
    
    renderizarConjuntos();
    if(typeof renderizarAlocacao === 'function') renderizarAlocacao();
    if(typeof atualizarStats === 'function') atualizarStats();
    
    alert('Conjunto criado com sucesso!');
}

window.removerConjunto = async function(id) {
    // REMOVIDO O BLOQUEIO DE ADMIN: Qualquer usuário com acesso à tela agora pode excluir
    if (!confirm('Deseja excluir este conjunto inteiro?')) return;
    
    conjuntos = conjuntos.filter(c => c.id !== id);
    await db.deleteConjunto(id);
    
    await db.addLog('Exclusão de Conjunto', `O Conjunto ID ${id} foi inteiramente apagado.`);
    if(typeof renderizarLogs === 'function') renderizarLogs();
    
    salvarBackupLocal();
    renderizarConjuntos();
    if(typeof renderizarAlocacao === 'function') renderizarAlocacao();
    if(typeof atualizarStats === 'function') atualizarStats();
}

window.removerCaminhao = async function(conjId, index) {
    // REMOVIDO O BLOQUEIO DE ADMIN: Qualquer usuário com acesso à tela agora pode remover
    const c = conjuntos.find(x => x.id === conjId);
    if (!c) return;
    
    const camRemovido = c.caminhoes[index].placa || c.caminhoes[index];
    c.caminhoes.splice(index, 1);
    await db.updateConjunto(conjId, c.caminhoes);
    
    await db.addLog('Remoção de Caminhão', `Caminhão Placa ${camRemovido} removido do Conjunto ${conjId}.`);
    if(typeof renderizarLogs === 'function') renderizarLogs();

    salvarBackupLocal();
    renderizarConjuntos();
    if(typeof renderizarAlocacao === 'function') renderizarAlocacao();
    if(typeof atualizarStats === 'function') atualizarStats();
}

window.editarCaminhao = async function(conjId, index) {
    // NOVA FUNÇÃO: Permite a edição direta da Placa e da Frota do caminhão
    const c = conjuntos.find(x => x.id === conjId);
    if (!c) return;
    
    const camAtual = c.caminhoes[index];
    const placaAtual = typeof camAtual === 'string' ? camAtual : camAtual.placa;
    const frotaAtual = typeof camAtual === 'string' ? '' : (camAtual.frota || camAtual.go || '');

    const novaPlaca = prompt("Digite a nova Placa do caminhão:", placaAtual);
    if (novaPlaca === null) return; // O usuário cancelou a ação
    
    const novaFrota = prompt("Digite a nova Frota do caminhão (opcional):", frotaAtual);
    if (novaFrota === null) return; // O usuário cancelou a ação

    const placaFormatada = novaPlaca.trim().toUpperCase();
    if (!placaFormatada) {
        alert("A placa não pode ficar vazia.");
        return;
    }

    // Atualiza o objeto com os novos dados
    c.caminhoes[index] = { placa: placaFormatada, frota: novaFrota.trim() };
    await db.updateConjunto(conjId, c.caminhoes);

    await db.addLog('Edição de Caminhão', `Caminhão alterado no Conjunto ${conjId}: de ${placaAtual} para ${placaFormatada}.`);
    if(typeof renderizarLogs === 'function') renderizarLogs();
    
    salvarBackupLocal();
    renderizarConjuntos();
    if(typeof renderizarAlocacao === 'function') renderizarAlocacao();
    if(typeof atualizarStats === 'function') atualizarStats();
}

window.adicionarCaminhaoAoConjunto = async function(conjId) {
    const placa = document.getElementById(`addCamPlaca_${conjId}`).value.toUpperCase();
    const frota = document.getElementById(`addCamFrota_${conjId}`).value;

    if(!placa) { alert('Informe a placa do caminhão.'); return; }

    const c = conjuntos.find(x => x.id === conjId);
    if(!c) return;

    if(!c.caminhoes) c.caminhoes = [];
    c.caminhoes.push({ placa, frota });

    await db.updateConjunto(conjId, c.caminhoes);
    
    salvarBackupLocal();
    renderizarConjuntos();
    if(typeof renderizarAlocacao === 'function') renderizarAlocacao();
    if(typeof atualizarStats === 'function') atualizarStats();
}