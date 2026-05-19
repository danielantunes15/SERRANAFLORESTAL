// Variável temporária para segurar o usuário durante a troca de senha
let usuarioTemporario = null;

// Função de criptografia (idêntica a que você já usava)
async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verifica se já existe uma sessão ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    const sessaoSalva = localStorage.getItem('ccol_user_session');
    if (sessaoSalva) {
        // Se já está logado, manda direto para o sistema
        window.location.href = 'index.html';
    }
});

window.realizarLogin = async function(event) {
    if (event) event.preventDefault();

    const userStr = document.getElementById('loginUser').value.trim().toUpperCase();
    const passStr = document.getElementById('loginPass').value;
    const btn = document.getElementById('btnLogin');

    if(!userStr || !passStr) { 
        alert('Preencha seu usuário e senha.'); 
        return; 
    }

    const prevText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Autenticando...';
    btn.disabled = true;

    try {
        const hashedPass = await hashPassword(passStr);
        // Usa a função do seu database.js para buscar no Supabase
        const dbUser = await db.getUsuarioByUsername(userStr);

        if (dbUser && (dbUser.senha_hash === hashedPass || dbUser.senha_hash === passStr)) {
            
            // Monta o objeto de sessão
            const sessaoData = {
                id: dbUser.id,
                username: dbUser.username,
                role: dbUser.role || 'Operacional', 
                filial_id: dbUser.filial_id,
                filiais: dbUser.filiais,
                primeiro_acesso: dbUser.primeiro_acesso
            };

            if (sessaoData.primeiro_acesso) {
                // Guarda os dados temporariamente para usar na troca de senha
                usuarioTemporario = sessaoData;
                // Alterna a interface
                document.getElementById('section-login').style.display = 'none';
                document.getElementById('section-primeiro-acesso').style.display = 'block';
            } else {
                // Salva no navegador e redireciona para o sistema
                localStorage.setItem('ccol_user_session', JSON.stringify(sessaoData));
                window.location.href = 'index.html';
            }
        } else {
            alert('❌ Usuário ou senha incorretos.');
            btn.innerHTML = prevText;
            btn.disabled = false;
        }
    } catch(e) {
        console.error("Erro no login:", e);
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
        
        // Atualiza a flag de acesso e salva a sessão
        usuarioTemporario.primeiro_acesso = false;
        localStorage.setItem('ccol_user_session', JSON.stringify(usuarioTemporario));
        
        alert('✅ Senha alterada com sucesso! Redirecionando...');
        window.location.href = 'index.html';
    } catch(e) {
        console.error("Erro ao salvar senha:", e);
        alert('⚠️ Erro ao salvar a nova senha.');
        btn.innerHTML = 'Salvar e Acessar';
        btn.disabled = false;
    }
}