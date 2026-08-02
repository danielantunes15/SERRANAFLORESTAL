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

        // A OPÇÃO FIXA "ADMINISTRADOR" FOI REMOVIDA DAQUI PARA SEGURANÇA E CAMUFLAGEM

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

    // A trava da filial continua ativa aqui
    if (!filialId) { alert('Por favor, selecione uma filial válida.'); return; }
    if(!userStr || !passStr) { alert('Preencha seu usuário e senha.'); return; }

    const prevText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Autenticando...';
    btn.disabled = true;

    try {
        const emailFantasma = `${userStr.toLowerCase()}@serranalog.com`;
        let dbUser = null;
        let authIdSeguro = null;

        // TENTA O LOGIN SEGURO VIA SUPABASE AUTH
        const { data: authData, error: authError } = await window.supabaseClient.auth.signInWithPassword({
            email: emailFantasma,
            password: passStr
        });

        if (authError) {
            console.warn("Login Auth falhou. Tentando validação legada para migração...");
            const hashedPass = await hashPassword(passStr);
            dbUser = await db.getUsuarioByUsername(userStr);

            if (!dbUser || (dbUser.senha_hash !== hashedPass && dbUser.senha_hash !== passStr)) {
                alert('Usuário ou senha incorretos.');
                btn.innerHTML = prevText;
                btn.disabled = false;
                return;
            }

            // MIGRAÇÃO SILENCIOSA 
            if (!dbUser.auth_id && !dbUser.primeiro_acesso) {
                console.log("Migrando usuário antigo para autenticação segura...");
                const { data: signUpData, error: signUpError } = await window.supabaseClient.auth.signUp({
                    email: emailFantasma,
                    password: passStr 
                });

                if (signUpError) {
                    console.error("ERRO NO SUPABASE AUTH (signUp):", signUpError);
                } else if (signUpData && signUpData.user) {
                    console.log("Conta criada no Auth com sucesso! ID:", signUpData.user.id);
                    authIdSeguro = signUpData.user.id;
                    
                    const { error: updateError } = await window.supabaseClient.from('usuarios')
                        .update({ auth_id: authIdSeguro })
                        .eq('id', dbUser.id);
                        
                    if (updateError) {
                        console.error("ERRO AO ATUALIZAR TABELA (RLS/Permissão):", updateError);
                    } else {
                        console.log("Coluna auth_id preenchida com sucesso no banco!");
                    }
                }
            }
        } else {
            // LOGIN SEGURO COM SUCESSO
            authIdSeguro = authData.user.id;
            dbUser = await db.getUsuarioByUsername(userStr);
            
            // Verifica se a conta já existe no Supabase mas o banco ainda não sabe o ID
            if (dbUser && !dbUser.auth_id) {
                console.log("Sincronizando auth_id com o banco de dados...");
                await window.supabaseClient.from('usuarios')
                    .update({ auth_id: authIdSeguro })
                    .eq('id', dbUser.id);
            }
        }

        if (dbUser) {
            let nomeFilialFinal = "Base Geral";
            let filialIdFinal = filialId;
            const isGlobalAdmin = (dbUser.role === 'SuperAdmin') || (dbUser.role === 'Admin' && dbUser.filial_id === null);

            // ================= REGRAS DE SEGURANÇA E BLOQUEIO =================
            // O isGlobalAdmin IGNORA ESSE BLOQUEIO (Permite logar camuflado em qualquer filial).
            if (!isGlobalAdmin && dbUser.filial_id != filialId) {
                alert('Acesso Negado! Seu usuário não tem permissão para a filial selecionada.');
                await window.supabaseClient.auth.signOut();
                btn.innerHTML = prevText; btn.disabled = false; return;
            }

            const filialSelecionada = listaFiliais.find(f => f.id == filialId);
            if (filialSelecionada) nomeFilialFinal = filialSelecionada.nome;

            const sessaoData = {
                id: dbUser.id,
                username: dbUser.username,
                role: dbUser.role || 'Operacional', 
                filial_id: filialIdFinal,
                filiais: { nome: nomeFilialFinal },
                primeiro_acesso: dbUser.primeiro_acesso,
                auth_id: authIdSeguro || dbUser.auth_id
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
            alert('Perfil não encontrado no banco de dados da operação.');
            btn.innerHTML = prevText;
            btn.disabled = false;
        }

    } catch(e) {
        console.error("Erro geral no login: ", e);
        alert('Erro ao conectar com o banco de dados.');
        btn.innerHTML = prevText;
        btn.disabled = false;
    }
}

window.salvarNovaSenha = async function() {
    const p1 = document.getElementById('newPass1').value;
    const p2 = document.getElementById('newPass2').value;
    const btn = document.getElementById('btnSalvarSenha');
    
    if(p1.length < 5) { alert('A nova senha deve ter no mínimo 5 caracteres.'); return; }
    if(p1 !== p2) { alert('As senhas digitadas não coincidem.'); return; }

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando credencial segura...';
    btn.disabled = true;

    try {
        const emailFantasma = `${usuarioTemporario.username.toLowerCase()}@serranalog.com`;
        let authIdSeguro = usuarioTemporario.auth_id;

        if (!authIdSeguro) {
            const { data: signUpData, error: signUpError } = await window.supabaseClient.auth.signUp({
                email: emailFantasma,
                password: p1
            });
            if (signUpError) {
                console.error("Erro ao registrar no Supabase Auth:", signUpError);
                alert("Erro de segurança ao gerar sua credencial. Verifique as permissões de confirmação de e-mail no painel.");
                btn.innerHTML = 'Salvar e Acessar';
                btn.disabled = false;
                return;
            }
            authIdSeguro = signUpData.user.id;
        } else {
            await window.supabaseClient.auth.updateUser({ password: p1 });
        }

        const hashedNewPass = await hashPassword(p1);
        
        const { error: dbError } = await window.supabaseClient.from('usuarios')
            .update({ 
                senha_hash: hashedNewPass, 
                primeiro_acesso: false, 
                auth_id: authIdSeguro 
            })
            .eq('id', usuarioTemporario.id);

        if (dbError) throw dbError;

        usuarioTemporario.primeiro_acesso = false;
        usuarioTemporario.auth_id = authIdSeguro;
        localStorage.setItem('ccol_user_session', JSON.stringify(usuarioTemporario));
        window.location.href = 'index.html';
    } catch(e) {
        console.error("Erro fatal ao salvar senha:", e);
        alert('Falha na comunicação com o servidor.');
        btn.innerHTML = 'Salvar e Acessar';
        btn.disabled = false;
    }
}