let usuarioTemporario = null;
let listaFiliais = [];

async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    const sessaoSalva = localStorage.getItem('ccol_user_session');
    if (sessaoSalva) {
        window.location.href = 'index.html';
        return;
    }
    carregarFiliaisDoBanco();
});

async function carregarFiliaisDoBanco() {
    const select = document.getElementById('loginFilial');
    if (!select) return;

    try {
        if (typeof db.getFiliais === 'function') {
            listaFiliais = await db.getFiliais();
        } else if (window.supabaseClient) { 
            const { data } = await window.supabaseClient.from('filiais').select('*').eq('status', 'Ativa').order('nome', { ascending: true });
            listaFiliais = data || [];
        }

        select.innerHTML = '<option value="" disabled selected>Selecione a Base/Filial...</option>';
        
        listaFiliais.forEach(filial => {
            const option = document.createElement('option');
            option.value = filial.id;
            option.textContent = filial.nome;
            select.appendChild(option);
        });

        const adminOption = document.createElement('option');
        adminOption.value = 'CENTRAL';
        adminOption.textContent = 'ADMINISTRADOR';
        adminOption.style.fontWeight = 'bold';
        select.appendChild(adminOption);

    } catch (e) {
        console.error(e);
        select.innerHTML = '<option value="" disabled selected>⚠️ Erro ao carregar filiais</option>';
    }
}

window.realizarLogin = async function(event) {
    if (event) event.preventDefault();

    const filialId = document.getElementById('loginFilial').value;
    const userStr = document.getElementById('loginUser').value.trim().toUpperCase();
    const passStr = document.getElementById('loginPass').value;
    const btn = document.getElementById('btnLogin');

    if (!filialId) { alert('Por favor, selecione uma filial válida.'); return; }
    if(!userStr || !passStr) { alert('Preencha seu usuário e senha.'); return; }

    const prevText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Autenticando...';
    btn.disabled = true;

    try {
        const hashedPass = await hashPassword(passStr);
        const dbUser = await db.getUsuarioByUsername(userStr);

        if (dbUser && (dbUser.senha_hash === hashedPass || dbUser.senha_hash === passStr)) {
            
            let nomeFilialFinal = "Base Geral";
            let filialIdFinal = filialId;

            // Identifica se o usuário é um administrador geral (não está preso a uma filial)
            const isGlobalAdmin = (dbUser.role === 'SuperAdmin') || (dbUser.role === 'Admin' && dbUser.filial_id === null);

            // ================= REGRAS DE SEGURANÇA E BLOQUEIO =================
            if (filialId === 'CENTRAL') {
                if (!isGlobalAdmin) {
                    alert('❌ Acesso Negado! Esta área é estritamente reservada para a Administração do Sistema.');
                    btn.innerHTML = prevText; btn.disabled = false; return;
                }
                nomeFilialFinal = "Administrador Geral";
                filialIdFinal = null; 
            } else {
                // Se o usuário não é um Admin Global e está tentando logar em uma filial diferente da dele
                if (!isGlobalAdmin && dbUser.filial_id != filialId) {
                    alert('❌ Acesso Negado! Seu usuário não tem permissão para operar nesta filial.');
                    btn.innerHTML = prevText; btn.disabled = false; return;
                }

                const filialSelecionada = listaFiliais.find(f => f.id == filialId);
                if (filialSelecionada) nomeFilialFinal = filialSelecionada.nome;
            }
            // =================================================================

            const sessaoData = {
                id: dbUser.id,
                username: dbUser.username,
                role: dbUser.role || 'Operacional', 
                filial_id: filialIdFinal,
                filiais: { nome: nomeFilialFinal },
                primeiro_acesso: dbUser.primeiro_acesso
            };

            if (sessaoData.primeiro_acesso) {
                usuarioTemporario = sessaoData;
                document.getElementById('section-login').style.display = 'none';
                document.getElementById('section-primeiro-acesso').style.display = 'block';
            } else {
                localStorage.setItem('ccol_user_session', JSON.stringify(sessaoData));
                window.location.href = 'index.html';
            }
        } else {
            alert('❌ Usuário ou senha incorretos.');
            btn.innerHTML = prevText;
            btn.disabled = false;
        }
    } catch(e) {
        alert('⚠️ Erro ao conectar com o banco de dados.');
        btn.innerHTML = prevText;
        btn.disabled = false;
    }
}

window.salvarNovaSenha = async function() {
    const p1 = document.getElementById('newPass1').value;
    const p2 = document.getElementById('newPass2').value;
    const btn = document.getElementById('btnSalvarSenha');
    
    if(p1.length < 5) { alert('⚠️ A nova senha deve ter no mínimo 5 caracteres.'); return; }
    if(p1 !== p2) { alert('⚠️ As senhas digitadas não coincidem.'); return; }

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    btn.disabled = true;

    try {
        const hashedNewPass = await hashPassword(p1);
        await db.updateUsuarioSenha(usuarioTemporario.id, hashedNewPass);
        usuarioTemporario.primeiro_acesso = false;
        localStorage.setItem('ccol_user_session', JSON.stringify(usuarioTemporario));
        window.location.href = 'index.html';
    } catch(e) {
        alert('⚠️ Erro ao salvar a nova senha.');
        btn.innerHTML = 'Salvar e Acessar';
        btn.disabled = false;
    }
}