// ==================== modules/campo/maquinas/maquinas.js ====================
window.maquinasCampo = []; 

window.carregarMaquinasCampo = async function() {
    if (typeof window.supabaseClient === 'undefined') return;
    try {
        // Inicia a query
        let query = window.supabaseClient.from('maquinas_campo').select('*').order('id');
        
        // Aplica o filtro de filial global para não vazar dados de outras filiais
        if (typeof window.aplicarFiltroFilial === 'function') {
            query = window.aplicarFiltroFilial(query);
        } else if (window.currentUser && window.currentUser.filial_id) {
            query = query.eq('filial_id', window.currentUser.filial_id);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        window.maquinasCampo = data || [];
        window.renderizarMaquinasCampo();
    } catch (e) {
        console.error("Erro ao carregar frentes de máquinas:", e);
    }
};

window.renderizarMaquinasCampo = function() {
    const tbody = document.getElementById('maquinasCampoList');
    if (!tbody) return;
    
    if (window.maquinasCampo.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding: 20px; text-align: center; color: #94a3b8;">Nenhuma Frente/Conjunto cadastrado. Clique em "Cadastrar Frente" para adicionar.</td></tr>`;
        return;
    }
    
    let html = '';
    window.maquinasCampo.forEach(m => {
        const nomeFrente = m.nome || m.modelo_1 || `Frente ${m.id}`;
        
        const mod1 = m.modelo_1 || 'Não Informado';
        const frota1 = m.numero_frota_1 || 'S/N';
        let maq1Html = `<strong style="font-size:1.05rem;">${mod1}</strong> <br> <span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; border: 1px solid #38bdf8; display: inline-block; margin-top: 4px;">Frota ${frota1}</span>`;
        
        const mod2 = m.modelo_2 || null;
        const frota2 = m.numero_frota_2 || null;
        let maq2Html = '<span style="color:#64748b; font-style: italic;">Nenhuma máquina</span>';
        if (mod2 || frota2) {
            maq2Html = `<strong style="font-size:1.05rem;">${mod2 || 'Não Informado'}</strong> <br> <span style="background: rgba(168, 85, 247, 0.15); color: #c084fc; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; border: 1px solid #a855f7; display: inline-block; margin-top: 4px;">Frota ${frota2 || 'S/N'}</span>`;
        }
        
        const mod3 = m.modelo_3 || null;
        const frota3 = m.numero_frota_3 || null;
        let maq3Html = '<span style="color:#64748b; font-style: italic;">Nenhuma máquina</span>';
        if (mod3 || frota3) {
            maq3Html = `<strong style="font-size:1.05rem;">${mod3 || 'Não Informado'}</strong> <br> <span style="background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; border: 1px solid #10b981; display: inline-block; margin-top: 4px;">Frota ${frota3 || 'S/N'}</span>`;
        }
        
        html += `
        <tr style="background-color: transparent; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;">
            <td style="padding: 10px; font-weight: 900; font-size: 1.1rem; color: var(--ccol-blue-bright);">${nomeFrente}</td>
            <td style="padding: 10px; text-align: left; color: #fff;">${maq1Html}</td>
            <td style="padding: 10px; text-align: left; color: #fff;">${maq2Html}</td>
            <td style="padding: 10px; text-align: left; color: #fff;">${maq3Html}</td>
            <td style="padding: 10px;">
                <button class="btn-primary-blue" style="padding: 3px 8px; font-size: 0.75rem; margin-right: 5px;" onclick="window.abrirModalEditarMaquinaCampo(${m.id})"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn-secondary-dark" style="padding: 3px 8px; font-size: 0.75rem; background: #ef4444; border-color: #ef4444;" onclick="window.excluirMaquinaCampo(${m.id})"><i class="fas fa-trash"></i> Remover</button>
            </td>
        </tr>`;
    });
    
    tbody.innerHTML = html;
};

window.abrirModalNovaMaquinaCampo = function() {
    document.getElementById('formMaquinaId').value = '';
    document.getElementById('formMaquinaNomeFrente').value = '';
    document.getElementById('formMaquinaModelo1').value = '';
    document.getElementById('formMaquinaFrota1').value = '';
    document.getElementById('formMaquinaModelo2').value = '';
    document.getElementById('formMaquinaFrota2').value = '';
    document.getElementById('formMaquinaModelo3').value = '';
    document.getElementById('formMaquinaFrota3').value = '';
    
    document.getElementById('modalMaquinaCampo').classList.add('show');
};

window.abrirModalEditarMaquinaCampo = function(id) {
    const maq = window.maquinasCampo.find(m => String(m.id) === String(id));
    if (!maq) return;
    
    document.getElementById('formMaquinaId').value = maq.id;
    document.getElementById('formMaquinaNomeFrente').value = maq.nome || '';
    
    document.getElementById('formMaquinaModelo1').value = maq.modelo_1 || maq.modelo || '';
    document.getElementById('formMaquinaFrota1').value = maq.numero_frota_1 || maq.numero_frota || '';
    
    document.getElementById('formMaquinaModelo2').value = maq.modelo_2 || '';
    document.getElementById('formMaquinaFrota2').value = maq.numero_frota_2 || '';
    
    document.getElementById('formMaquinaModelo3').value = maq.modelo_3 || '';
    document.getElementById('formMaquinaFrota3').value = maq.numero_frota_3 || '';
    
    document.getElementById('modalMaquinaCampo').classList.add('show');
};

window.fecharModalMaquinaCampo = function() {
    document.getElementById('modalMaquinaCampo').classList.remove('show');
};

window.salvarMaquinaCampo = async function() {
    const id = document.getElementById('formMaquinaId').value;
    const nomeFrente = document.getElementById('formMaquinaNomeFrente').value.trim();
    
    const mod1 = document.getElementById('formMaquinaModelo1').value.trim();
    const frota1 = document.getElementById('formMaquinaFrota1').value.trim();
    const mod2 = document.getElementById('formMaquinaModelo2').value.trim();
    const frota2 = document.getElementById('formMaquinaFrota2').value.trim();
    const mod3 = document.getElementById('formMaquinaModelo3').value.trim();
    const frota3 = document.getElementById('formMaquinaFrota3').value.trim();
    
    if (!mod1 || !frota1) {
        alert("A Máquina 1 (Modelo e Frota) é obrigatória para criar a Frente.");
        return;
    }
    
    const payload = {
        nome: nomeFrente || mod1,
        tipo: 'Frente Operacional',
        modelo_1: mod1, 
        numero_frota_1: frota1,
        modelo_2: mod2 || null,
        numero_frota_2: frota2 || null,
        modelo_3: mod3 || null,
        numero_frota_3: frota3 || null,
        modelo: mod1, 
        numero_frota: frota1
    };
    
    try {
        if (id) {
            await window.supabaseClient.from('maquinas_campo').update(payload).eq('id', id);
        } else {
            // Garante que o ID da Filial atual seja salvo no banco junto com a máquina nova
            let payloadFinal = payload;
            if (typeof window.injetarFilial === 'function') {
                payloadFinal = window.injetarFilial(payload);
            } else if (window.currentUser && window.currentUser.filial_id) {
                payloadFinal.filial_id = window.currentUser.filial_id;
            }
            
            await window.supabaseClient.from('maquinas_campo').insert([payloadFinal]);
        }
        
        window.fecharModalMaquinaCampo();
        await window.carregarMaquinasCampo();
        
        // Se a tela de alocação estiver aberta/cacheada, avisa para ela atualizar o select
        if (typeof window.popularSelectMaquinas === 'function') window.popularSelectMaquinas();
        
    } catch (e) {
        console.error("Erro ao salvar Frente:", e);
        alert("Erro ao salvar no banco de dados.");
    }
};

window.excluirMaquinaCampo = async function(id) {
    if (!confirm("Tem certeza que deseja remover esta Frente permanentemente?")) return;
    
    try {
        await window.supabaseClient.from('maquinas_campo').delete().eq('id', id);
        await window.carregarMaquinasCampo();
    } catch (e) {
        console.error("Erro ao excluir Frente:", e);
        alert("Erro ao excluir do banco de dados.");
    }
};

// Auto-inicialização
setTimeout(() => {
    if (typeof window.carregarMaquinasCampo === 'function') window.carregarMaquinasCampo();
}, 500);