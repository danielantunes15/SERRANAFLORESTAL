// ==================== modules/campo/maquinas/maquinas.js ====================

window.maquinasCampo = [];

window.carregarMaquinasCampo = async function() {
    if (typeof window.supabaseClient === 'undefined') return;

    try {
        const { data, error } = await window.supabaseClient.from('maquinas_campo').select('*').order('id');
        if (error) throw error;
        
        window.maquinasCampo = data || [];
        window.renderizarMaquinasCampo();
    } catch (e) {
        console.error("Erro ao carregar conjuntos de máquinas:", e);
    }
};

window.renderizarMaquinasCampo = function() {
    const tbody = document.getElementById('maquinasCampoList');
    if (!tbody) return;

    if (window.maquinasCampo.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="padding: 20px; text-align: center; color: #94a3b8;">Nenhum Conjunto Máquina cadastrado. Clique em "Cadastrar Conjunto" para adicionar.</td></tr>`;
        return;
    }

    let html = '';
    window.maquinasCampo.forEach(m => {
        const mod1 = m.modelo_1 || m.modelo || m.nome || 'Não Informado';
        const frota1 = m.numero_frota_1 || m.numero_frota || m.ficha || 'S/N';
        
        const mod2 = m.modelo_2 || null;
        const frota2 = m.numero_frota_2 || null;

        let maq1Html = `<strong style="font-size:1.05rem;">${mod1}</strong> <br> <span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; border: 1px solid #38bdf8; display: inline-block; margin-top: 4px;">Frota ${frota1}</span>`;
        
        let maq2Html = '<span style="color:#64748b; font-style: italic;">Nenhuma máquina vinculada</span>';
        if (mod2 || frota2) {
            maq2Html = `<strong style="font-size:1.05rem;">${mod2 || 'Não Informado'}</strong> <br> <span style="background: rgba(168, 85, 247, 0.15); color: #c084fc; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; border: 1px solid #a855f7; display: inline-block; margin-top: 4px;">Frota ${frota2 || 'S/N'}</span>`;
        }

        html += `
        <tr style="background-color: transparent; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;">
            <td style="padding: 10px; font-weight: 900; font-size: 1.1rem; color: var(--ccol-blue-bright);">Conjunto ${m.id}</td>
            <td style="padding: 10px; text-align: left; color: #fff;">${maq1Html}</td>
            <td style="padding: 10px; text-align: left; color: #fff;">${maq2Html}</td>
            <td style="padding: 10px;">
                <button class="btn-primary-blue" style="padding: 3px 8px; font-size: 0.75rem; margin-right: 5px;" onclick="window.abrirModalEditarMaquinaCampo(${m.id})">✏️ Editar</button>
                <button class="btn-secondary-dark" style="padding: 3px 8px; font-size: 0.75rem; background: #ef4444; border-color: #ef4444;" onclick="window.excluirMaquinaCampo(${m.id})">🗑️ Remover</button>
            </td>
        </tr>`;
    });

    tbody.innerHTML = html;
    
    const statCavalos = document.getElementById('statCavalos');
    if (statCavalos) statCavalos.innerText = window.maquinasCampo.length;
};

window.abrirModalNovaMaquinaCampo = function() {
    document.getElementById('formMaquinaId').value = '';
    document.getElementById('formMaquinaModelo1').value = '';
    document.getElementById('formMaquinaFrota1').value = '';
    document.getElementById('formMaquinaModelo2').value = '';
    document.getElementById('formMaquinaFrota2').value = '';
    
    document.getElementById('modalMaquinaCampo').classList.add('show');
};

window.abrirModalEditarMaquinaCampo = function(id) {
    const maq = window.maquinasCampo.find(m => String(m.id) === String(id));
    if (!maq) return;

    document.getElementById('formMaquinaId').value = maq.id;
    document.getElementById('formMaquinaModelo1').value = maq.modelo_1 || maq.modelo || maq.nome || '';
    document.getElementById('formMaquinaFrota1').value = maq.numero_frota_1 || maq.numero_frota || maq.ficha || '';
    document.getElementById('formMaquinaModelo2').value = maq.modelo_2 || '';
    document.getElementById('formMaquinaFrota2').value = maq.numero_frota_2 || '';
    
    document.getElementById('modalMaquinaCampo').classList.add('show');
};

window.fecharModalMaquinaCampo = function() {
    document.getElementById('modalMaquinaCampo').classList.remove('show');
};

window.salvarMaquinaCampo = async function() {
    const id = document.getElementById('formMaquinaId').value;
    const mod1 = document.getElementById('formMaquinaModelo1').value.trim();
    const frota1 = document.getElementById('formMaquinaFrota1').value.trim();
    const mod2 = document.getElementById('formMaquinaModelo2').value.trim();
    const frota2 = document.getElementById('formMaquinaFrota2').value.trim();

    if (!mod1 || !frota1) {
        alert("A Máquina 1 (Modelo e Frota) é obrigatória para criar o Conjunto.");
        return;
    }

    // AQUI ESTAVA O ERRO! Removi a coluna 'ficha' que não existia e preenchi o 'nome' e 'tipo' obrigatórios do banco original
    const payload = {
        nome: mod1,
        tipo: 'Conjunto Duplo',
        modelo_1: mod1, 
        numero_frota_1: frota1,
        modelo_2: mod2 || null,
        numero_frota_2: frota2 || null,     
        modelo: mod1, 
        numero_frota: frota1
    };

    try {
        if (id) {
            await window.supabaseClient.from('maquinas_campo').update(payload).eq('id', id);
        } else {
            await window.supabaseClient.from('maquinas_campo').insert([payload]);
        }

        window.fecharModalMaquinaCampo();
        await window.carregarMaquinasCampo(); 
        
        if (typeof window.popularSelectMaquinas === 'function') window.popularSelectMaquinas();
        if (typeof window.popularSelectConjuntoTroca === 'function') window.popularSelectConjuntoTroca();
        
    } catch (e) {
        console.error("Erro ao salvar conjunto máquina:", e);
        alert("Erro ao salvar no banco de dados.");
    }
};

window.excluirMaquinaCampo = async function(id) {
    if (!confirm("Tem certeza que deseja remover este Conjunto permanentemente?")) return;
    
    try {
        await window.supabaseClient.from('maquinas_campo').delete().eq('id', id);
        await window.carregarMaquinasCampo();
    } catch (e) {
        console.error("Erro ao excluir conjunto máquina:", e);
        alert("Erro ao excluir do banco de dados.");
    }
};

setTimeout(() => {
    if (typeof window.carregarMaquinasCampo === 'function') window.carregarMaquinasCampo();
}, 500);