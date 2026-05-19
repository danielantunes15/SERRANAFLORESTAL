// Variável temporária para segurar o usuário durante a troca de senha
let usuarioTemporario = null;
let listaFiliais = [];

// Função de criptografia da senha
async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Inicialização da página
document.addEventListener('DOMContentLoaded', () => {
    const sessaoSalva = localStorage.getItem('ccol_user_session');
    if (sessaoSalva) {
        window.location.href = 'index.html';
        return;
    }
    
    // Executa a busca automática das filiais no banco de dados
    carregarFiliaisDoBanco();
});

// Função para buscar dinamicamente as filiais da tabela do banco de dados
async function carregarFiliaisDoBanco() {
    const select = document.getElementById('loginFilial');
    if (!select) return;

    try {
        // 1. Tenta usar a estrutura existente no seu arquivo database.js
        if (typeof db.getFiliais === 'function') {
            listaFiliais = await db.getFiliais();
        } 
        // 2. Fallback estratégico: Caso a função não esteja mapeada no db, faz a consulta direta no client do Supabase
        else if (db.client && typeof db.client.from === 'function') {
            const { data, error } = await db.client.from('filiais').select('*').order('nome', { ascending: true });
            if (error) throw error;
            listaFiliais = data || [];
        } 
        else if (window.supabase) {
            const { data, error } = await window.supabase.from('filiais').select('*').order('nome', { ascending: true });
            if (error) throw error;
            listaFiliais = data || [];
        } 
        // 3. Fallback de contingência visual para evitar tela travada
        else {
            console.warn("Instância do banco de dados não encontrada. Usando dados locais.");
            listaFiliais = [
                { id: 1, nome: "Matriz - Nanuque (MG)" },
                { id: 2, nome: "Base - Itabatã (BA)" },
                { id: 3, nome: "Base - Teixeira de Freitas (BA)" }
            ];
        }

        // Renderiza as opções dentro do Select
        select.innerHTML = '<option value="" disabled selected>Selecione a Base/Filial...</option>';
        listaFiliais.forEach(filial => {
            const option = document.createElement('option');
            option.value = filial.id; // Define o ID como valor identificador
            option.textContent = filial.nome; // Nome da filial visível para o usuário
            select.appendChild(option);
        });

    } catch (e) {
        console.error("Erro crítico ao carregar filiais do banco:", e);
        select.innerHTML = '<option value="" disabled selected>⚠️ Erro ao carregar filiais</option>';
    }
}

window.realizarLogin = async function(event) {
    if (event) event.preventDefault();

    const filialId = document.getElementById('loginFilial').value;
    const userStr = document.getElementById('loginUser').value.trim().toUpperCase();
    const passStr = document.getElementById('loginPass').value;
    const btn = document.getElementById('btnLogin');

    if (!filialId) {
        alert('Por favor, selecione uma filial válida.');
        return;
    }

    if(!userStr || !passStr) { 
        alert('Preencha seu usuário e senha.'); 
        return; 
    }

    const prevText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Autenticando...';
    btn.disabled = true;

    try {
        const hashedPass = await hashPassword(passStr);
        const dbUser = await db.getUsuarioByUsername(userStr);

        if (dbUser && (dbUser.senha_hash === hashedPass || dbUser.senha_hash === passStr)) {
            
            // Encontra o objeto completo da filial correspondente ao ID selecionado para validação
            const filialSelecionada = listaFiliais.find(f => f.id == filialId);
            const nomeFilialFinal = filialSelecionada ? filialSelecionada.nome : "Base Geral";

            // Monta os dados estruturados de sessão
            const sessaoData = {
                id: dbUser.id,
                username: dbUser.username,
                role: dbUser.role || 'Operacional', 
                filial_id: filialId,
                filiais: { nome: nomeFilialFinal }, // Alimenta dinamicamente o header do app
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
        console.error("Erro no fluxo de login:", e);
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
        
        alert('✅ Senha alterada com sucesso! Redirecionando...');
        window.location.href = 'index.html';
    } catch(e) {
        console.error("Erro ao salvar senha:", e);
        alert('⚠️ Erro ao salvar a nova senha.');
        btn.innerHTML = 'Salvar e Acessar';
        btn.disabled = false;
    }
}