// ==================== core/js/auth.js ====================

// Guarda o usuário globalmente para todo o sistema (e database.js) utilizar
window.currentUser = null;

document.addEventListener("DOMContentLoaded", async () => {
    verificarSessaoAtiva();
});

function verificarSessaoAtiva() {
    const session = localStorage.getItem('ccol_session');
    if (session) {
        window.currentUser = JSON.parse(session);
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'flex';
        
        // Exibe o nome da Filial na Navbar superior
        const filialNome = window.currentUser.filiais ? window.currentUser.filiais.nome : 'Matriz';
        const spanUsuario = document.getElementById('navbarUser');
        if (spanUsuario) spanUsuario.innerHTML = `<i class="fas fa-building"></i> ${filialNome} | <i class="fas fa-user-circle"></i> ${window.currentUser.username}`;
        
        if (typeof window.iniciarSistema === 'function') {
            window.iniciarSistema();
        }
    } else {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }
}

window.realizarLogin = async function(event) {
    event.preventDefault();
    const btn = document.getElementById('btnLoginSubmit');
    const prevText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Autenticando...';
    btn.disabled = true;

    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value.trim();

    try {
        const usuarioDb = await db.getUsuarioByUsername(user);

        if (!usuarioDb) {
            alert('Usuário não encontrado!');
            btn.innerHTML = prevText;
            btn.disabled = false;
            return;
        }

        // Verifica a senha 
        // ATENÇÃO: Num SaaS real as senhas devem ser criptografadas (Hash). 
        if (usuarioDb.senha_hash !== pass) {
            alert('Senha incorreta!');
            btn.innerHTML = prevText;
            btn.disabled = false;
            return;
        }

        // SALVA NA SESSÃO GLOBAL DO SISTEMA COM AS INFOS DE FILIAL
        window.currentUser = {
            id: usuarioDb.id,
            username: usuarioDb.username,
            role: usuarioDb.role || 'Operacional', 
            filial_id: usuarioDb.filial_id,
            filiais: usuarioDb.filiais // Traz o nome da filial via Join feito no database.js
        };
        
        localStorage.setItem('ccol_session', JSON.stringify(window.currentUser));
        
        btn.innerHTML = '<i class="fas fa-check"></i> Sucesso!';
        
        setTimeout(() => {
            verificarSessaoAtiva();
        }, 500);

    } catch (e) {
        console.error(e);
        alert('Erro ao conectar com o banco de dados.');
        btn.innerHTML = prevText;
        btn.disabled = false;
    }
};

window.realizarLogoff = function() {
    localStorage.removeItem('ccol_session');
    window.currentUser = null;
    window.location.reload();
};