// Aguarda o carregamento do DOM ou a injeção da tela
document.addEventListener('DOMContentLoaded', initConfiguracoesGerenciais);

// Tratativa para quando a página é injetada via fetch no SPA
if (document.getElementById('form-metas-gerenciais')) {
    initConfiguracoesGerenciais();
}

function initConfiguracoesGerenciais() {
    const formMetas = document.getElementById('form-metas-gerenciais');
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

    // --- APLICAÇÃO DA MÁSCARA MONETÁRIA ---
    function aplicarMascaraMoeda(inputElement) {
        inputElement.addEventListener('input', function(e) {
            let valor = e.target.value.replace(/\D/g, ''); // Remove tudo que não for dígito
            if (valor === '') {
                e.target.value = '';
                return;
            }
            
            // Converte para formato numérico dividido por 100 para criar as casas decimais
            let floatValor = parseInt(valor, 10) / 100;
            
            // Formata para a moeda brasileira (ex: 1.000,00)
            e.target.value = floatValor.toLocaleString('pt-BR', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            });
        });
    }

    // Aplica a máscara aos dois inputs
    aplicarMascaraMoeda(inputMetaDiaTransporte);
    aplicarMascaraMoeda(inputMetaDiaCarregamento);

    // Função para extrair o valor decimal correto do campo mascarado (ex: "1.000,00" vira 1000.00)
    function extrairFloatMoeda(valorString) {
        if (!valorString) return 0.00;
        return parseFloat(valorString.replace(/\./g, '').replace(',', '.')) || 0.00;
    }

    // 1. Carregar as metas atuais ao abrir a tela
    carregarMetas();

    // 2. Evento de submissão do formulário
    formMetas.addEventListener('submit', function(event) {
        event.preventDefault(); 
        
        const dadosMetas = {
            filial_id: filialAtual,
            meta_diaria_transporte: extrairFloatMoeda(inputMetaDiaTransporte.value).toFixed(2),
            meta_diaria_carregamento: extrairFloatMoeda(inputMetaDiaCarregamento.value).toFixed(2)
        };

        salvarMetas(dadosMetas);
    });

    // 3. Evento do botão cancelar
    btnCancelar.addEventListener('click', function() {
        formMetas.reset();
        carregarMetas(); 
        mostrarAlerta("Alterações desfeitas.", "info");
    });

    // --- FUNÇÕES DE BANCO DE DADOS E ALERTA ---

    async function carregarMetas() {
        try {
            // Caso utilize o Supabase, descomente o bloco abaixo e comente o localStorage:
            /*
            const { data, error } = await supabase
                .from('metas_gerenciais')
                .select('*')
                .eq('filial_id', filialAtual)
                .single();
            
            if (data) {
                const transporte = parseFloat(data.meta_diaria_transporte || 0);
                const carregamento = parseFloat(data.meta_diaria_carregamento || 0);
                
                inputMetaDiaTransporte.value = transporte.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                inputMetaDiaCarregamento.value = carregamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
            */
            
            // Simulação com LocalStorage (Enquanto não integra com API)
            const metasSalvas = JSON.parse(localStorage.getItem(`metas_gerenciais_${filialAtual}`));
            
            if (metasSalvas) {
                const transporte = parseFloat(metasSalvas.meta_diaria_transporte || 0);
                const carregamento = parseFloat(metasSalvas.meta_diaria_carregamento || 0);
                
                inputMetaDiaTransporte.value = transporte.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                inputMetaDiaCarregamento.value = carregamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
        } catch (error) {
            console.error("Erro ao carregar metas:", error);
            mostrarAlerta("Erro ao carregar as metas atuais.", "error");
        }
    }

    async function salvarMetas(dados) {
        try {
            const btnSalvar = document.getElementById('btn-salvar-metas');
            const textoOriginal = btnSalvar.innerHTML;
            
            // Efeito de loading no botão
            btnSalvar.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Salvando...';
            btnSalvar.disabled = true;
            btnSalvar.classList.add('opacity-75', 'cursor-not-allowed');

            // Timeout para simular requisição (Substitua por um UPSERT no Supabase)
            /*
            const { error } = await supabase
                .from('metas_gerenciais')
                .upsert(dados, { onConflict: 'filial_id' });
            if (error) throw error;
            */
            
            setTimeout(() => {
                localStorage.setItem(`metas_gerenciais_${filialAtual}`, JSON.stringify(dados));
                
                // Restaura o botão
                btnSalvar.innerHTML = textoOriginal;
                btnSalvar.disabled = false;
                btnSalvar.classList.remove('opacity-75', 'cursor-not-allowed');
                
                mostrarAlerta("Metas atualizadas com sucesso para a filial " + filialAtual + "!", "success");
                
            }, 800);

        } catch (error) {
            console.error("Erro ao salvar metas:", error);
            mostrarAlerta("Erro ao salvar as configurações. Tente novamente.", "error");
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