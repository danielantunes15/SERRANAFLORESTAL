// ==========================================
// js/configuracoes/importacao_bracell.js
// Lógica de importação exclusiva para operação BRACELL
// ==========================================

window.processarImportacaoBracell = async function(input) {
    let file = null;
    if (input instanceof File) file = input;
    else if (input && input.target && input.target.files) file = input.target.files[0];
    
    if (!file) return;

    const errorMsgDiv = document.getElementById('errorMsgBracell');
    const loadingSpinner = document.getElementById('loadingSpinnerBracell');
    
    if (errorMsgDiv) errorMsgDiv.classList.add('hidden'); 
    if (loadingSpinner) { loadingSpinner.classList.remove('hidden'); loadingSpinner.classList.add('flex'); }

    if (typeof XLSX === 'undefined') {
        if(errorMsgDiv) {
            errorMsgDiv.innerText = "A biblioteca Excel (XLSX) não está carregada.";
            errorMsgDiv.classList.remove('hidden');
        } else {
            alert("A biblioteca Excel (XLSX) não está carregada.");
        }
        if (loadingSpinner) { loadingSpinner.classList.add('hidden'); loadingSpinner.classList.remove('flex'); }
        return;
    }

    const parseNumero = (valor) => {
        if (valor === undefined || valor === null || valor === '') return null;
        if (typeof valor === 'number') return valor;
        let str = String(valor).trim().replace(/\./g, '').replace(',', '.');
        return parseFloat(str) || null;
    };

    const formatarDataExcel = (valor) => {
        if (valor === undefined || valor === null || valor === '') return null;
        if (typeof valor === 'number') {
            const dateObj = XLSX.SSF.parse_date_code(valor);
            const d = String(dateObj.d).padStart(2, '0');
            const m = String(dateObj.m).padStart(2, '0');
            const y = dateObj.y;
            const h = String(dateObj.H).padStart(2, '0');
            const min = String(dateObj.M).padStart(2, '0');
            return `${d}/${m}/${y} ${h}:${min}`;
        }
        return String(valor).trim();
    };

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            let dadosCompletosParaSalvar = [];
            const abas = ['SP', 'MG'];

            // 1. LÊ A PLANILHA E MONTA OS OBJETOS
            abas.forEach(nomeAba => {
                if (workbook.SheetNames.includes(nomeAba)) {
                    const worksheet = workbook.Sheets[nomeAba];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null });

                    jsonData.forEach(row => {
                        if (!row['Ordem de busca'] || !row['Equipamento cavalo']) return;

                        const ordemStr = String(row['Ordem de busca']).trim();
                        const cavaloStr = String(row['Equipamento cavalo']).trim();
                        
                        // Chave única para evitar duplicidade de viagem
                        const chaveUnica = `${ordemStr}_${cavaloStr}`;

                        const registro = {
                            ordem_busca: ordemStr,
                            ctm: row['CTM'] ? String(row['CTM']).trim() : null,
                            nota_fiscal: row['Nota Fiscal'] ? String(row['Nota Fiscal']).trim() : null,
                            data_chegada_balanca: formatarDataExcel(row['Data chegada balança']),
                            data_saida_patio: formatarDataExcel(row['Data saida patio']),
                            tipo_conjunto: row['Tipo de conjunto'] ? String(row['Tipo de conjunto']).trim() : null,
                            fornecedor: row['Fornecedor'] ? String(row['Fornecedor']).trim() : null,
                            equipamento_cavalo: cavaloStr,
                            peso_bruto: parseNumero(row['Peso bruto']),
                            tara: parseNumero(row['Tara']),
                            peso_liquido: parseNumero(row['Peso Liquido']),
                            volume: parseNumero(row['Volume']),
                            projeto: row['Projeto'] ? String(row['Projeto']).trim() : null,
                            talhao: row['Talhão'] ? String(row['Talhão']).trim() : null,
                            distancia_total: parseNumero(row['Distancia Total']),
                            distancia_asfalto: parseNumero(row['Distancia Asfalto']),
                            distancia_chao: parseNumero(row['Distancia Chão']),
                            regional: row['Regional'] ? String(row['Regional']).trim() : null,
                            cte: row['CTE'] ? String(row['CTE']).trim() : null,
                            chave_acesso: row['Chave de acesso'] ? String(row['Chave de acesso']).trim() : null,
                            valor_cte: parseNumero(row['VALOR DO CTE']),
                            filial_id: 5,
                            chave_unica: chaveUnica
                        };

                        dadosCompletosParaSalvar.push(registro);
                    });
                }
            });

            if (dadosCompletosParaSalvar.length === 0) {
                throw new Error('Nenhum dado válido encontrado nas abas "SP" ou "MG".');
            }

            // 2. BUSCA NO BANCO QUAIS CHAVES JÁ EXISTEM PARA EVITAR DUPLICIDADE
            const chavesExcel = dadosCompletosParaSalvar.map(r => r.chave_unica);
            let chavesJaNoBanco = new Set();
            
            // Busca em lotes de 1000 para não estourar o limite de requisição da URL do Supabase
            const queryBatchSize = 1000;
            for (let i = 0; i < chavesExcel.length; i += queryBatchSize) {
                const loteChaves = chavesExcel.slice(i, i + queryBatchSize);
                const { data: dadosBanco, error: errBusca } = await window.supabaseClient
                    .from('historico_viagens_sp')
                    .select('chave_unica')
                    .in('chave_unica', loteChaves);

                if (errBusca) throw errBusca;
                if (dadosBanco) {
                    dadosBanco.forEach(d => chavesJaNoBanco.add(d.chave_unica));
                }
            }

            // 3. SEPARA OS REGISTROS NOVOS DOS REPETIDOS
            const registrosNovos = dadosCompletosParaSalvar.filter(r => !chavesJaNoBanco.has(r.chave_unica));
            const qtdRepetidos = dadosCompletosParaSalvar.length - registrosNovos.length;

            // 4. INSERE APENAS OS REGISTROS NOVOS
            if (registrosNovos.length > 0) {
                const insertBatchSize = 1000;
                for (let i = 0; i < registrosNovos.length; i += insertBatchSize) {
                    const loteInsert = registrosNovos.slice(i, i + insertBatchSize);
                    const { error: errInsert } = await window.supabaseClient
                        .from('historico_viagens_sp')
                        .insert(loteInsert);
                    if (errInsert) throw errInsert;
                }

                // 5. REGISTRA O LOG DE IMPORTAÇÃO COM A QUANTIDADE REAL INSERIDA
                const dataLocalExata = window.obterDataHoraLocal();
                const usuarioLogado = window.currentUser ? (window.currentUser.nome_completo || window.currentUser.username) : 'Sistema';
                const filialLogada = (window.currentUser && window.currentUser.filial_id !== null && window.currentUser.filial_id !== undefined) 
                                     ? String(window.currentUser.filial_id) 
                                     : null;

                await window.supabaseClient.from('historico_importacoes').insert([{
                    dataLancamento: dataLocalExata,
                    dataBase: 'Viagens Bracell (SP/MG)',
                    qtdViagens: registrosNovos.length, // Salva apenas os novos
                    usuario: usuarioLogado,
                    filial_id: filialLogada
                }]);

                if(typeof window.carregarHistoricoImportacoes === 'function') {
                    window.carregarHistoricoImportacoes();
                }
            }

            // 6. EXIBE O ALERTA INTELIGENTE PARA O USUÁRIO
            if (typeof Swal !== 'undefined') {
                if (registrosNovos.length === 0) {
                    // Cenario 1: Todos os registros já estavam no banco
                    Swal.fire({
                        icon: 'warning',
                        title: 'Atenção: Nenhuma viagem nova!',
                        html: `A planilha contém <b>${dadosCompletosParaSalvar.length}</b> viagens, mas <b>todas</b> já haviam sido importadas anteriormente.<br><br><span style="color:#94a3b8; font-size:13px;">Nada foi adicionado ao banco.</span>`,
                        background: '#1e293b',
                        color: '#f8fafc'
                    });
                } else if (qtdRepetidos > 0) {
                    // Cenario 2: Importação Parcial (alguns novos, alguns repetidos)
                    Swal.fire({
                        icon: 'info',
                        title: 'Importação Parcial',
                        html: `<span style="color:#10b981; font-weight:bold; font-size:16px;">${registrosNovos.length} novas viagens cadastradas.</span><br><br><span style="color:#ef4444; font-size:13px;">Atenção: ${qtdRepetidos} linhas da planilha foram ignoradas porque já existiam no sistema.</span>`,
                        background: '#1e293b',
                        color: '#f8fafc'
                    });
                } else {
                    // Cenario 3: Tudo 100% novo
                    Swal.fire({
                        icon: 'success',
                        title: 'Sucesso!',
                        text: `${registrosNovos.length} registros enviados com sucesso.`,
                        background: '#1e293b',
                        color: '#f8fafc'
                    });
                }
            } else {
                // Fallback básico caso o SweetAlert não esteja disponível
                if (registrosNovos.length === 0) alert(`Aviso: Todas as ${dadosCompletosParaSalvar.length} viagens já existiam no banco.`);
                else if (qtdRepetidos > 0) alert(`Foram salvas ${registrosNovos.length} novas viagens.\n${qtdRepetidos} linhas repetidas foram ignoradas.`);
                else alert(`Sucesso! ${registrosNovos.length} viagens importadas.`);
            }

        } catch (err) {
            console.error("Erro na importação Bracell:", err);
            if (errorMsgDiv) {
                errorMsgDiv.innerText = "Erro: " + err.message;
                errorMsgDiv.classList.remove('hidden');
            } else {
                alert("Erro: " + err.message);
            }
        } finally {
            if (loadingSpinner) { loadingSpinner.classList.add('hidden'); loadingSpinner.classList.remove('flex'); }
            if (input && input.target) {
                input.target.value = "";
            }
        }
    };

    reader.readAsArrayBuffer(file);
};

window.processAndSaveJornadasFileBracell = async function(file) {
    alert('Importação de jornadas Bracell em desenvolvimento');
};

window.processAndSaveEventosFileBracell = async function(file) {
    alert('Importação de eventos Bracell em desenvolvimento');
};