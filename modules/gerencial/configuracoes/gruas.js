// ==========================================
// js/configuracoes/gruas.js - GESTÃO DE GRUAS (DINÂMICO)
// ==========================================

let frentesData = {}; // Agora o objeto nasce vazio e é preenchido dinamicamente pelo banco

async function carregarFrentesGruas() {
    frentesData = {};

    try {
        const { data, error } = await supabaseClient.from('config_gruas').select('*');
        if (error) throw error;

        // Se o banco tiver dados, cria as chaves dinamicamente
        if (data && data.length > 0) {
            data.forEach(item => {
                const nomeFrente = String(item.frente || 'DESCONHECIDA').trim().toUpperCase();
                const colGrua = item.codigos || ''; 
                
                frentesData[nomeFrente] = {
                    id: item.id,
                    gruas: colGrua.split(',').map(g => g.trim().toUpperCase()).filter(g => g)
                };
            });
        } 
        // Só carrega os padrões fixos se a tabela do banco estiver 100% vazia
        else {
            const fallbackData = [
                { frente: 'SERRANA', codigos: 'GSR0001, GSR0002, GSR0003, GSR0007, GSR0008, GRB0015, GRB0022' },
                { frente: 'REFLORESTAR', codigos: 'GRB0017, GRB0020,GRB0029,GRB0013,GRB0014,GRB0028,GRB0026,GRB0016,GRB0012,GRB0023,GRB0018' },
                { frente: 'JSL', codigos: 'GSL0012, GSL0016' }
            ];

            const { data: newData } = await supabaseClient.from('config_gruas').insert(fallbackData).select();
            
            if (newData) {
                newData.forEach(item => {
                    const nomeFrente = String(item.frente || '').trim().toUpperCase();
                    frentesData[nomeFrente] = {
                        id: item.id,
                        gruas: (item.codigos || '').split(',').map(g => g.trim().toUpperCase()).filter(g => g)
                    };
                });
            }
        }
        
        renderizarGruas();
        
    } catch (e) {
        console.error("Erro ao carregar gruas do banco:", e);
    }
}

function renderizarGruas() {
    // Cores das frentes conhecidas. Frentes novas assumem a cor DEFAULT.
    const cores = {
        'SERRANA': 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50 hover:bg-emerald-800',
        'REFLORESTAR': 'bg-amber-900/40 text-amber-300 border-amber-700/50 hover:bg-amber-800',
        'JSL': 'bg-indigo-900/40 text-indigo-300 border-indigo-700/50 hover:bg-indigo-800',
        'DEFAULT': 'bg-slate-800/40 text-slate-300 border-slate-600/50 hover:bg-slate-700'
    };

    // Varre todas as frentes que vieram do banco de dados dinamicamente
    Object.keys(frentesData).forEach(frente => {
        
        // Pega o nome da frente (ex: REFLORESTAR) e transforma em ID do HTML (ex: lista_reflorestar)
        const idFormatado = frente.toLowerCase().replace(/\s+/g, '_');
        const container = document.getElementById(`lista_${idFormatado}`);
        
        if (!container) return; // Se a div não existir no HTML, apenas ignora
        
        container.innerHTML = '';
        
        if (frentesData[frente].gruas.length > 0) {
            frentesData[frente].gruas.forEach(grua => {
                const cor = cores[frente] || cores['DEFAULT'];
                container.insertAdjacentHTML('beforeend', `
                    <div class="inline-flex items-center gap-1.5 border px-2 py-1 rounded-md text-[11px] font-mono transition-all shadow-sm ${cor}">
                        <i class="fas fa-truck-loading text-[10px] opacity-70"></i> ${grua}
                        <button onclick="removerGrua('${frente}', '${grua}')" class="ml-1 opacity-50 hover:opacity-100 hover:text-white focus:outline-none transition-opacity" title="Remover">
                            <i class="fas fa-times-circle text-[12px]"></i>
                        </button>
                    </div>
                `);
            });
        } else {
            container.innerHTML = '<span class="text-[11px] text-slate-500 italic w-full text-center mt-4">Nenhuma grua vinculada.</span>';
        }
    });
}

window.adicionarGrua = async function(frente, inputId) {
    const inputEl = document.getElementById(inputId);
    if (!inputEl) return;
    
    const valor = inputEl.value.trim().toUpperCase();
    if (!valor) return;
    
    // Se a frente ainda não existir no objeto (caso o HTML tente inserir uma nova), a cria.
    if (!frentesData[frente]) {
        frentesData[frente] = { id: null, gruas: [] };
    }
    
    const novasGruas = valor.split(',').map(g => g.trim()).filter(g => g);
    let gruasAtuais = [...frentesData[frente].gruas];
    let adicionou = false;
    
    novasGruas.forEach(ng => {
        if (!gruasAtuais.includes(ng)) {
            gruasAtuais.push(ng);
            adicionou = true;
        }
    });
    
    if (adicionou) {
        inputEl.disabled = true;
        await salvarNoBanco(frente, gruasAtuais.join(', '));
        inputEl.value = '';
        inputEl.disabled = false;
        inputEl.focus();
    } else {
        inputEl.value = ''; // Apenas limpa se já existia
    }
}

window.removerGrua = async function(frente, gruaParaRemover) {
    if (!frentesData[frente]) return;
    if (!confirm(`Deseja excluir a grua ${gruaParaRemover} da frente ${frente}?`)) return;
    
    let gruasAtuais = frentesData[frente].gruas.filter(g => g !== gruaParaRemover);
    await salvarNoBanco(frente, gruasAtuais.join(', '));
}

async function salvarNoBanco(frente, stringGruas) {
    const id = frentesData[frente].id;
    try {
        if (id) {
            // Se já tem ID, faz UPDATE
            await supabaseClient.from('config_gruas').update({ codigos: stringGruas }).eq('id', id);
        } else {
            // Se não tem ID, faz INSERT
            const { data } = await supabaseClient.from('config_gruas').insert([{ frente: frente, codigos: stringGruas }]).select();
            if (data && data.length > 0) frentesData[frente].id = data[0].id;
        }
        await carregarFrentesGruas();
    } catch(e) {
        console.error("Erro no update:", e);
        alert('Erro ao sincronizar com o banco de dados!');
    }
}