window.initConfiguracoesGerenciais = function() {
    const formMetas = document.getElementById('form-metas-gerenciais');
    
    if (!formMetas) return;

    const inputMetaDiaTransporte = document.getElementById('meta_diaria_transporte');
    const inputMetaDiaCarregamento = document.getElementById('meta_diaria_carregamento');
    const btnCancelar = document.getElementById('btn-cancelar-metas');
    const alertContainer = document.getElementById('alert-container-metas');
    const labelFilial = document.getElementById('label-filial-atual');

    // Captura a filial do usuário logado
    const filialAtual = (typeof currentUser !== 'undefined' && currentUser.filial_id) ? currentUser.filial_id : 'CENTRAL';
    
    if(labelFilial) {
        labelFilial.innerHTML = `<i class="fas fa-map-marker-alt mr-1"></i> Configurando metas para a filial: <span class="text-white font-bold">${filialAtual}</span>`;
    }

    // --- FUNÇÃO PARA DETECTAR O CLIENTE DO SUPABASE ---
    function getSupabaseClient() {
        if (typeof window.supabaseClient !== 'undefined') return window.supabaseClient;
        if (typeof window.db !== 'undefined' && typeof window.db.from === 'function') return window.db; 
        if (typeof window.db !== 'undefined' && window.db.supabase) return window.db.supabase;
        return null;
    }

    // --- APLICAÇÃO DA MÁSCARA MONETÁRIA ---
    function aplicarMascaraMoeda(inputElement) {
        if (!inputElement) return;

        inputElement.addEventListener('input', function(e) {
            let valor = e.target.value.replace(/\D/g, ''); 
            if (valor === '') {
                e.target.value = '';
                return;
            }
            
            let floatValor = parseInt(valor, 10) / 100;
            
            e.target.value = floatValor.toLocaleString('pt-BR', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            });
        });
    }

    aplicarMascaraMoeda(inputMetaDiaTransporte);
    aplicarMascaraMoeda(inputMetaDiaCarregamento);

    function extrairFloatMoeda(valorString) {
        if (!valorString) return 0.00;
        return parseFloat(valorString.replace(/\./g, '').replace(',', '.')) || 0.00;
    }

    // 1. Carregar as metas atuais do Banco de Dados
    carregarMetas();

    // 2. Evento de submissão
    formMetas.addEventListener('submit', function(event) {
        event.preventDefault(); 
        
        const dadosMetas = {
            filial_id: filialAtual,
            meta_diaria_transporte: extrairFloatMoeda(inputMetaDiaTransporte.value).toFixed(2),
            meta_diaria_carregamento: extrairFloatMoeda(inputMetaDiaCarregamento.value).toFixed(2)
        };

        salvarMetas(dadosMetas);
    });

    // 3. Evento cancelar
    btnCancelar.addEventListener('click', function() {
        formMetas.reset();
        carregarMetas(); 
        mostrarAlerta("Alterações desfeitas.", "info");
    });

    // --- FUNÇÕES DE BANCO DE DADOS E ALERTA ---

    async function carregarMetas() {
        try {
            const dbClient = getSupabaseClient();
            
            if (!dbClient) {
                console.warn("Cliente Supabase não encontrado. Usando LocalStorage.");
                const metasSalvas = JSON.parse(localStorage.getItem(`metas_gerenciais_${filialAtual}`));
                if (metasSalvas) preencherCampos(metasSalvas.meta_diaria_transporte, metasSalvas.meta_diaria_carregamento);
                return;
            }

            // AQUI ESTÁ A CORREÇÃO: Usando .maybeSingle() ao invés de .single()
            const { data, error } = await dbClient
                .from('metas_gerenciais')
                .select('*')
                .eq('filial_id', filialAtual)
                .maybeSingle(); 
            
            if (error) {
                throw error;
            }
            
            if (data) {
                preencherCampos(data.meta_diaria_transporte, data.meta_diaria_carregamento);
            }
        } catch (error) {
            console.error("Erro ao carregar metas do banco:", error);
            mostrarAlerta("Erro ao carregar as metas atuais do servidor.", "error");
        }
    }

    function preencherCampos(transporte, carregamento) {
        const valTransporte = parseFloat(transporte || 0);
        const valCarregamento = parseFloat(carregamento || 0);
        
        inputMetaDiaTransporte.value = valTransporte.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        inputMetaDiaCarregamento.value = valCarregamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    async function salvarMetas(dados) {
        const btnSalvar = document.getElementById('btn-salvar-metas');
        const textoOriginal = btnSalvar.innerHTML;
        
        try {
            const dbClient = getSupabaseClient();
            
            btnSalvar.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Salvando...';
            btnSalvar.disabled = true;
            btnSalvar.classList.add('opacity-75', 'cursor-not-allowed');

            if (!dbClient) {
                localStorage.setItem(`metas_gerenciais_${filialAtual}`, JSON.stringify(dados));
            } else {
                const { error } = await dbClient
                    .from('metas_gerenciais')
                    .upsert(dados, { onConflict: 'filial_id' });
                
                if (error) throw error;
            }
            
            btnSalvar.innerHTML = textoOriginal;
            btnSalvar.disabled = false;
            btnSalvar.classList.remove('opacity-75', 'cursor-not-allowed');
            
            mostrarAlerta("Metas atualizadas com sucesso para a filial " + filialAtual + "!", "success");

        } catch (error) {
            console.error("Erro ao salvar metas no banco:", error);
            mostrarAlerta("Erro ao salvar as configurações. Verifique o banco de dados.", "error");
            
            btnSalvar.innerHTML = textoOriginal;
            btnSalvar.disabled = false;
            btnSalvar.classList.remove('opacity-75', 'cursor-not-allowed');
        }
    }

    function mostrarAlerta(mensagem, tipo) {
        let bgClass, borderClass, textClass, iconClass;

        if (tipo === 'success') {
            bgClass = 'bg-emerald-500/10'; borderClass = 'border-emerald-500/30'; textClass = 'text-emerald-400'; iconClass = 'fa-check-circle';
        } else if (tipo === 'error') {
            bgClass = 'bg-red-500/10'; borderClass = 'border-red-500/30'; textClass = 'text-red-400'; iconClass = 'fa-exclamation-triangle';
        } else {
            bgClass = 'bg-blue-500/10'; borderClass = 'border-blue-500/30'; textClass = 'text-blue-400'; iconClass = 'fa-info-circle';
        }

        alertContainer.innerHTML = `
            <div class="${bgClass} ${borderClass} border p-4 rounded-xl flex items-center gap-4 shadow-lg transform transition-all duration-300 translate-x-0 opacity-100" style="animation: slideInRight 0.3s ease-out;">
                <div class="${textClass} text-2xl">
                    <i class="fas ${iconClass}"></i>
                </div>
                <div>
                    <h4 class="text-white font-semibold text-sm">Notificação do Sistema</h4>
                    <p class="${textClass} text-sm mt-0.5">${mensagem}</p>
                </div>
            </div>
        `;
        
        setTimeout(() => {
            if(alertContainer.firstElementChild) {
                alertContainer.firstElementChild.style.opacity = '0';
                alertContainer.firstElementChild.style.transform = 'translateY(10px)';
                setTimeout(() => { alertContainer.innerHTML = ''; }, 300);
            }
        }, 4000);
    }
}