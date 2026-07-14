let cadastrosAlmoxList = [];

window.renderizarCadastrosAlmox = async function() {
    await carregarCadastrosAlmox();
}

async function carregarCadastrosAlmox() {
    if (!window.supabaseClient) return;
    try {
        let query = window.supabaseClient.from('almoxarifado_cadastros').select('*').order('created_at', { ascending: false });
        // Filtra por filial se a função injetarFilial estiver presente no sistema
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
        
        const { data, error } = await query;
        if (error) throw error;
        
        cadastrosAlmoxList = data || [];
        atualizarTabelaCadastrosAlmox();
    } catch (e) {
        console.error("Erro ao carregar cadastros do almoxarifado", e);
    }
}

function atualizarTabelaCadastrosAlmox() {
    const tbody = document.getElementById('tabelaCadastrosAlmoxBody');
    const tipoFiltro = document.getElementById('filtroTipoCadastro').value;
    if (!tbody) return;
    tbody.innerHTML = '';
    
    let lista = cadastrosAlmoxList;
    if (tipoFiltro !== 'TODOS') {
        lista = lista.filter(c => c.tipo === tipoFiltro);
    }

    if(lista.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhum registro encontrado.</td></tr>'; 
        return; 
    }

    lista.forEach(cad => {
        let corBadge = '#60a5fa';
        if(cad.tipo === 'CATEGORIA') corBadge = '#fbbf24';
        if(cad.tipo === 'LOCALIZACAO') corBadge = '#34d399';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="badge" style="background: transparent; border: 1px solid ${corBadge}; color: ${corBadge};">${cad.tipo}</span></td>
            <td style="font-weight: bold; color: #f8fafc;">${cad.descricao}</td>
            <td style="color: #94a3b8;">${new Date(cad.created_at).toLocaleDateString('pt-BR')}</td>
            <td style="text-align: right;">
                <button type="button" class="btn-action-sm btn-delete" onclick="deletarCadastroAlmox(${cad.id})"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.salvarNovoCadastroAlmox = async function(e) {
    e.preventDefault();
    const tipo = document.getElementById('novoCadastroTipo').value;
    const desc = document.getElementById('novoCadastroDesc').value.trim().toUpperCase();
    
    if(!desc) return;

    // Checa duplicidade local
    const existe = cadastrosAlmoxList.find(c => c.tipo === tipo && c.descricao === desc);
    if (existe) {
        alert("Este cadastro já existe na sua filial!");
        return;
    }

    const btn = document.getElementById('btnSalvarCadAlmox');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        let novoCad = { tipo: tipo, descricao: desc };
        if (typeof window.injetarFilial === 'function') novoCad = window.injetarFilial(novoCad);

        const { error } = await window.supabaseClient.from('almoxarifado_cadastros').insert([novoCad]);
        if (error) throw error;

        document.getElementById('novoCadastroDesc').value = '';
        await carregarCadastrosAlmox();
    } catch (error) {
        alert("Erro ao salvar cadastro.");
        console.error(error);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-plus"></i> Adicionar';
    }
}

window.deletarCadastroAlmox = async function(id) {
    if (!confirm("Tem certeza que deseja excluir este cadastro? Ele deixará de aparecer nas opções de Nova Peça.")) return;
    try {
        const { error } = await window.supabaseClient.from('almoxarifado_cadastros').delete().eq('id', id);
        if (error) throw error;
        await carregarCadastrosAlmox();
    } catch (error) {
        alert("Erro ao excluir.");
    }
}