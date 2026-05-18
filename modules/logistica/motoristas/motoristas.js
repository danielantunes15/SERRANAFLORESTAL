// ==================== MÓDULO: MOTORISTAS ====================

window.popularSelectsConjuntoMotorista = function() {
    const selectAdd = document.getElementById('motoristaConjunto');
    const selectEdit = document.getElementById('editMotoristaConjunto');
    
    let optionsHtml = '<option value="">Não Alocar (Disponível / Reserva)</option>';
    if (typeof conjuntos !== 'undefined') {
        conjuntos.forEach(c => {
            optionsHtml += `<option value="${c.id}">Conjunto ${c.id}</option>`;
        });
    }

    if (selectAdd && selectAdd.dataset.loaded !== (conjuntos ? conjuntos.length.toString() : "0")) {
        const val = selectAdd.value;
        selectAdd.innerHTML = optionsHtml;
        selectAdd.value = val;
        selectAdd.dataset.loaded = conjuntos ? conjuntos.length.toString() : "0";
    }
    if (selectEdit && selectEdit.dataset.loaded !== (conjuntos ? conjuntos.length.toString() : "0")) {
        const val = selectEdit.value;
        selectEdit.innerHTML = optionsHtml;
        selectEdit.value = val;
        selectEdit.dataset.loaded = conjuntos ? conjuntos.length.toString() : "0";
    }
}

window.renderizarMotoristas = function() {
    const tbody = document.getElementById('motoristasList');
    const searchInput = document.getElementById('searchMotorista');
    const termoBusca = searchInput?.value.toLowerCase() || '';
    
    if (!tbody) return;

    if (searchInput && !searchInput.dataset.buscaAtiva) {
        searchInput.addEventListener('input', window.renderizarMotoristas);
        searchInput.dataset.buscaAtiva = "true";
    }

    window.popularSelectsConjuntoMotorista();

    let html = '';
    
    const motoristasFiltrados = motoristas
        .filter(m => m.nome.toLowerCase().includes(termoBusca))
        .sort((a, b) => a.nome.localeCompare(b.nome));

    if (motoristasFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Nenhum motorista encontrado.</td></tr>';
        return;
    }

    motoristasFiltrados.forEach(m => {
        let tags = [];
        if (!m.conjuntoId) {
            tags.push('<span style="background: rgba(245, 158, 11, 0.1); color: #f59e0b; padding: 3px 6px; border-radius: 4px; font-size: 0.65rem; border: 1px solid #f59e0b;">Disponível / Reserva</span>');
        } else {
            tags.push(`<span style="background: rgba(59, 130, 246, 0.1); color: #3b82f6; padding: 3px 6px; border-radius: 4px; font-size: 0.65rem; border: 1px solid #3b82f6;">Conj. ${m.conjuntoId}</span>`);
            if (m.equipe && m.equipe !== '-') tags.push(`<span style="background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 3px 6px; border-radius: 4px; font-size: 0.65rem; border: 1px solid #10b981;">Eq. ${m.equipe}</span>`);
        }

        html += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td><strong style="font-size: 1.05rem; color: var(--text-primary);">${m.nome}</strong><br><div style="margin-top: 5px; display:flex; gap: 5px;">${tags.join('')}</div></td>
                <td><span style="color: ${m.masterDrive === 'Sim' ? 'var(--ccol-green-bright)' : '#ef4444'}; font-weight: bold;">${m.masterDrive}</span></td>
                <td><span style="color: ${m.destra === 'Sim' ? 'var(--ccol-green-bright)' : '#ef4444'}; font-weight: bold;">${m.destra}</span></td>
                <td style="color: var(--text-secondary);">${m.cidade || '-'}</td>
                <td>
                    <button onclick="abrirModalEdicao(${m.id})" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid #3b82f6; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: bold;">✏️ Editar</button>
                    <button onclick="excluirMotorista(${m.id})" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid #ef4444; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: bold; margin-left: 5px;">🗑️ Excluir</button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
};

window.adicionarMotorista = async function() {
    const nome = document.getElementById('motoristaNome').value.trim();
    if (!nome) { alert('⚠️ Digite o nome completo do motorista!'); return; }

    const novoMotorista = {
        id: Date.now(), 
        nome: nome,
        masterDrive: document.getElementById('motoristaMasterDrive').value || null,
        destra: document.getElementById('motoristaDestra').value || null,
        cidade: document.getElementById('motoristaCidade').value || null,
        conjuntoId: document.getElementById('motoristaConjunto').value ? parseInt(document.getElementById('motoristaConjunto').value) : null,
        equipe: document.getElementById('motoristaEquipe').value || '-',
        turno: document.getElementById('motoristaTurno').value || '-',
        data_ancora: document.getElementById('motoristaDataAncora').value || null
    };

    motoristas.push(novoMotorista);
    await db.addMotorista(novoMotorista);
    if(typeof salvarBackupLocal === 'function') salvarBackupLocal();

    document.getElementById('motoristaNome').value = '';
    document.getElementById('motoristaDataAncora').value = '';
    document.getElementById('motoristaConjunto').value = '';
    document.getElementById('motoristaEquipe').value = '-';
    document.getElementById('motoristaTurno').value = '-';
    
    window.renderizarMotoristas();
    if(typeof renderizarAlocacao === 'function') renderizarAlocacao();
    if(typeof renderizarEscala === 'function') renderizarEscala();
    
    alert('✅ Motorista cadastrado com sucesso!');
};

window.abrirModalEdicao = function(id) {
    const m = motoristas.find(mot => mot.id === id);
    if (!m) return;

    window.popularSelectsConjuntoMotorista(); 

    document.getElementById('editMotoristaId').value = m.id;
    document.getElementById('editMotoristaNome').value = m.nome;
    document.getElementById('editMotoristaMasterDrive').value = m.masterDrive || '';
    document.getElementById('editMotoristaDestra').value = m.destra || '';
    document.getElementById('editMotoristaCidade').value = m.cidade || '';
    
    document.getElementById('editMotoristaConjunto').value = m.conjuntoId || '';
    document.getElementById('editMotoristaEquipe').value = m.equipe || '-';
    document.getElementById('editMotoristaTurno').value = m.turno || '-';
    document.getElementById('editMotoristaDataAncora').value = m.data_ancora || '';

    document.getElementById('modalEdicaoMotorista').classList.add('show');
};

window.fecharModalEdicao = function() {
    document.getElementById('modalEdicaoMotorista').classList.remove('show');
};

window.salvarEdicaoMotorista = async function() {
    const id = parseInt(document.getElementById('editMotoristaId').value);
    const m = motoristas.find(mot => mot.id === id);
    if (!m) return;

    m.nome = document.getElementById('editMotoristaNome').value.trim();
    m.masterDrive = document.getElementById('editMotoristaMasterDrive').value || null;
    m.destra = document.getElementById('editMotoristaDestra').value || null;
    m.cidade = document.getElementById('editMotoristaCidade').value || null;
    
    const conjVal = document.getElementById('editMotoristaConjunto').value;
    m.conjuntoId = conjVal ? parseInt(conjVal) : null; 
    m.equipe = document.getElementById('editMotoristaEquipe').value || '-';
    m.turno = document.getElementById('editMotoristaTurno').value || '-';
    m.data_ancora = document.getElementById('editMotoristaDataAncora').value || null;

    // Constrói os dados da mesma forma que são usados na interface
    // ATENÇÃO: Se as colunas no Supabase estiverem com underline (ex: master_drive), você deverá alterar a chave antes dos dois pontos. Ex: "master_drive: m.masterDrive"
    const payload = {
        nome: m.nome, 
        masterDrive: m.masterDrive, 
        destra: m.destra, 
        cidade: m.cidade,
        conjuntoId: m.conjuntoId, 
        equipe: m.equipe, 
        turno: m.turno, 
        data_ancora: m.data_ancora
    };

    // Previne envio de string vazia caso o banco exija null em alguma coluna não preenchida
    Object.keys(payload).forEach(k => {
        if (payload[k] === "") payload[k] = null;
    });

    await db.updateMotorista(id, payload);
    
    if(typeof salvarBackupLocal === 'function') salvarBackupLocal();
    window.fecharModalEdicao();
    
    window.renderizarMotoristas();
    if(typeof renderizarAlocacao === 'function') renderizarAlocacao();
    if(typeof renderizarEscala === 'function') renderizarEscala();
    if(typeof renderizarTrocaTurno === 'function') renderizarTrocaTurno();
    
    alert('🔄 Modificações aplicadas com sucesso!');
};

window.excluirMotorista = async function(id) {
    if(currentUser && currentUser.role !== 'Admin') { alert('⛔ Acesso Negado: Apenas Administradores podem excluir motoristas.'); return; }
    
    const m = motoristas.find(mot => mot.id === id);
    if (!confirm(`⚠️ Deseja excluir DE VEZ o motorista ${m ? m.nome : ''} do sistema?`)) return;
    
    await db.addLog('Exclusão de Motorista', `Motorista removido: ${m.nome} (ID: ${id})`);
    if(typeof renderizarLogs === 'function') renderizarLogs();

    motoristas = motoristas.filter(x => x.id !== id);
    if (typeof escalas !== 'undefined' && escalas[id]) delete escalas[id];
    
    await db.deleteMotorista(id);
    if(typeof salvarBackupLocal === 'function') salvarBackupLocal();
    
    window.renderizarMotoristas();
    if(typeof renderizarAlocacao === 'function') renderizarAlocacao();
    if(typeof renderizarEscala === 'function') renderizarEscala();
    if(typeof renderizarSSMA === 'function') renderizarSSMA();
};