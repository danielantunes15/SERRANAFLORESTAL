// ==================== modules/manutencao/controle_manutencao/controle_manutencao.js ====================

window.veiculosRevisaoDb = [];
window.veiculosRevisaoFiltrados = [];

// Função auxiliar para resgatar a filial do usuário logado
window.obterFilialUsuarioLogadoRev = function() {
    return (window.currentUser && window.currentUser.filial_id && window.currentUser.filial_id !== 'CENTRAL') 
        ? parseInt(window.currentUser.filial_id) : null;
};

window.initControleManutencao = async function() {
    console.log("Módulo Controle de Manutenção (Revisões) Inicializado.");
    
    // Filtros
    const elPlaca = document.getElementById('filtroPlacaRevisao');
    const elStatus = document.getElementById('filtroStatusRevisao');
    if (elPlaca) elPlaca.value = '';
    if (elStatus) elStatus.value = '';

    await window.carregarVeiculosManutencao(true);
};

window.carregarVeiculosManutencao = async function(forcarSincronizacao = false) {
    const NOME_TABELA_VEICULOS = 'frotas_manutencao'; 
    const filialId = window.obterFilialUsuarioLogadoRev();
    
    try {
        const tbody = document.getElementById('tbControleRevisoes');
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Sincronizando e carregando veículos...</td></tr>`;

        // 1. Sincroniza com Google Sheets antes de buscar do banco e ESPERA terminar
        if (forcarSincronizacao) {
            await window.sincronizarComPlanilhaGoogle();
        }

        // 2. Busca veículos da tabela de frotas (Filtrando por filial)
        let queryFrotas = window.supabaseClient.from(NOME_TABELA_VEICULOS).select('*');
        if (filialId !== null) {
            queryFrotas = queryFrotas.eq('filial_id', filialId);
        }
        
        const { data: frotas, error: errFrota } = await queryFrotas;
        if (errFrota) throw errFrota;
        let frotasGlobais = frotas || [];

        // 3. Filtra TRITREM e GRUA
        const veiculosFiltrados = frotasGlobais.filter(v => {
            const cat = String(v.categoria || '').toUpperCase();
            const status = String(v.status || '').toUpperCase();
            return (cat.includes('TRITREM') || cat.includes('GRUA')) && status !== 'INATIVO';
        });

        // 4. Busca os dados de manutenções (Filtrando por filial)
        let queryRevisoes = window.supabaseClient.from('manutencao_revisoes').select('*');
        if (filialId !== null) {
            queryRevisoes = queryRevisoes.eq('filial_id', filialId);
        }
        
        const { data: revisoes, error: errRev } = await queryRevisoes;
        if (errRev) throw errRev;

        // 5. Mescla informações
        window.veiculosRevisaoDb = veiculosFiltrados.map(frota => {
            const placaPrincipal = frota.cavalo || frota.go || 'N/A';
            const frotaNum = frota.numero_frota || frota.go || 'N/A';
            const tipoVeiculo = frota.categoria || 'N/A';

            const rev = revisoes.find(r => r.placa === placaPrincipal || r.numero_frota === frotaNum) || {};
            
            let compartimentos = [];
            if(frota.carreta1) compartimentos.push(frota.carreta1);
            if(frota.carreta2) compartimentos.push(frota.carreta2);
            if(frota.carreta3) compartimentos.push(frota.carreta3);

            return {
                id: frota.id,
                placa: placaPrincipal,
                numero_frota: frotaNum,
                tipo: tipoVeiculo,
                compartimentos: compartimentos.length > 0 ? compartimentos.join(' / ') : 'Sem compartimentos atrelados',
                km_atual: parseInt(rev.km_atual) || 0,
                km_ultima_revisao: parseInt(rev.km_ultima_revisao) || 0,
                km_proxima_revisao: parseInt(rev.km_proxima_revisao) || 0,
                detalhes_ultima_revisao: rev.detalhes_ultima_revisao || '',
                // CAMPOS DE INSPEÇÃO (TRITREM)
                data_inspecao: rev.data_inspecao || null,
                data_proxima_inspecao: rev.data_proxima_inspecao || null
            };
        });

        window.filtrarRevisoesManutencao();
    } catch (e) {
        console.error("Erro ao carregar e mesclar veículos:", e);
        const tbody = document.getElementById('tbControleRevisoes');
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: #ef4444;"><i class="fas fa-exclamation-triangle"></i> Erro ao buscar dados. Tente novamente.</td></tr>`;
    }
};

window.determinarStatusRevisao = function(v) {
    if (v.km_proxima_revisao === 0) return { status: 'Não Configurado', cor: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)', icon: 'fas fa-question-circle' };
    
    const kmRestante = v.km_proxima_revisao - v.km_atual;
    const isGrua = String(v.tipo).toUpperCase().includes('GRUA');
    const margem = isGrua ? 250 : 1500; // Gruas avisam faltando 250 horas. Outros faltam 1.500 km.

    if (kmRestante <= 0) {
        return { status: 'Atrasada', cor: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', icon: 'fas fa-times-circle' };
    } else if (kmRestante <= margem) {
        return { status: 'Atenção', cor: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', icon: 'fas fa-exclamation-triangle' };
    } else {
        return { status: 'Em Dia', cor: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', icon: 'fas fa-check-circle' };
    }
};

window.filtrarRevisoesManutencao = function() {
    const termo = (document.getElementById('filtroPlacaRevisao').value || '').toLowerCase().trim();
    const statusDesejado = document.getElementById('filtroStatusRevisao').value;

    window.veiculosRevisaoFiltrados = window.veiculosRevisaoDb.filter(v => {
        const matchBusca = (v.placa && v.placa.toLowerCase().includes(termo)) || 
                           (v.numero_frota && v.numero_frota.toLowerCase().includes(termo)) ||
                           (v.compartimentos && v.compartimentos.toLowerCase().includes(termo));
        
        const infoStatus = window.determinarStatusRevisao(v);
        const matchStatus = statusDesejado === '' || infoStatus.status === statusDesejado;

        return matchBusca && matchStatus;
    });

    window.renderizarControleManutencao();
};

window.renderizarControleManutencao = function() {
    const tbody = document.getElementById('tbControleRevisoes');
    if (!tbody) return;

    let totMonitorados = window.veiculosRevisaoDb.length;
    let totDia = 0, totAtencao = 0, totAtrasada = 0;

    window.veiculosRevisaoDb.forEach(v => {
        const info = window.determinarStatusRevisao(v);
        if (info.status === 'Em Dia') totDia++;
        else if (info.status === 'Atenção') totAtencao++;
        else if (info.status === 'Atrasada') totAtrasada++;
    });

    document.getElementById('totRevMonitorados').innerText = totMonitorados;
    document.getElementById('totRevEmDia').innerText = totDia;
    document.getElementById('totRevAtencao').innerText = totAtencao;
    document.getElementById('totRevAtrasadas').innerText = totAtrasada;

    tbody.innerHTML = '';

    if (window.veiculosRevisaoFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-secondary);">Nenhum veículo corresponde aos filtros aplicados.</td></tr>`;
        return;
    }

    const gruposCategoria = {};
    window.veiculosRevisaoFiltrados.forEach(v => {
        const cat = String(v.tipo || 'OUTROS').toUpperCase();
        if (!gruposCategoria[cat]) gruposCategoria[cat] = [];
        gruposCategoria[cat].push(v);
    });

    // Ordenação alfabética (A-Z) das categorias
    Object.keys(gruposCategoria).sort((a, b) => a.localeCompare(b)).forEach(categoria => {
        const veiculosDoGrupo = gruposCategoria[categoria];
        const isGrua = categoria.includes('GRUA');
        const s_und = isGrua ? 'h' : 'km';

        // ORDENAÇÃO POR PLACA/FROTA (Alfanumérica: 01, 02, 03, 04, 05...)
        veiculosDoGrupo.sort((a, b) => {
            return (a.placa || '').localeCompare((b.placa || ''), undefined, { numeric: true, sensitivity: 'base' });
        });

        const trHeader = document.createElement('tr');
        trHeader.innerHTML = `
            <td colspan="6" style="text-align: left; background: rgba(59, 130, 246, 0.1); color: var(--ccol-blue-bright); font-weight: bold; padding: 12px 20px; border-top: 2px solid rgba(59, 130, 246, 0.3); border-bottom: 2px solid rgba(59, 130, 246, 0.3); font-size: 1.1rem; letter-spacing: 1px;">
                <i class="fas fa-layer-group"></i> CATEGORIA: ${categoria} <span style="font-size: 0.85rem; color: var(--text-secondary); margin-left: 10px;">(${veiculosDoGrupo.length} equipamentos)</span>
            </td>
        `;
        tbody.appendChild(trHeader);

        veiculosDoGrupo.forEach(v => {
            const info = window.determinarStatusRevisao(v);
            const isTritrem = String(v.tipo).toUpperCase().includes('TRITREM');
            
            let idVeiculoHtml = `
                <div style="font-weight: 800; color: #fff; font-size: 1.1rem; letter-spacing: 1px;">${v.placa}</div>
                <div style="color: var(--ccol-blue-bright); font-size: 0.85rem; font-weight: bold;">Frota: ${v.numero_frota}</div>
                ${!isGrua ? `<div style="color: var(--text-secondary); font-size: 0.75rem; margin-top: 3px;"><i class="fas fa-link"></i> ${v.compartimentos}</div>` : ''}
            `;

            let rangeTotal = v.km_proxima_revisao - v.km_ultima_revisao;
            if (rangeTotal <= 0) rangeTotal = (isGrua ? 1000 : 10000); 
            
            let kmRodadosCiclo = v.km_atual - v.km_ultima_revisao;
            if (kmRodadosCiclo < 0) kmRodadosCiclo = 0;

            let pct = (kmRodadosCiclo / rangeTotal) * 100;
            if (pct > 100) pct = 100;

            let progressHtml = `
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 2px;">
                    <span style="color: var(--text-secondary);">Última: <strong style="color:#fff;">${v.km_ultima_revisao.toLocaleString('pt-BR')} ${s_und}</strong></span>
                    <span style="color: var(--ccol-blue-bright);">Atual: <strong>${v.km_atual.toLocaleString('pt-BR')} ${s_und}</strong></span>
                    <span style="color: var(--text-secondary);">Próxima: <strong style="color:#fff;">${v.km_proxima_revisao.toLocaleString('pt-BR')} ${s_und}</strong></span>
                </div>
                <div class="km-progress-bg">
                    <div class="km-progress-fill" style="width: ${pct}%; background-color: ${info.cor};"></div>
                </div>
                <div style="text-align: right; font-size: 0.75rem; color: ${info.cor}; margin-top: 3px; font-weight: bold;">
                    ${v.km_proxima_revisao === 0 ? 'Meta não definida' : (v.km_proxima_revisao - v.km_atual) + ` ${s_und} restantes`}
                </div>
            `;

            // COLUNA DE INSPEÇÃO (TRITREM) COM CONTADOR DE DIAS
            let datasHtml = '<span style="color: var(--text-secondary); font-size: 0.8rem;">Não aplicável</span>';
            if (isTritrem) {
                const formatData = (d) => {
                    if (!d) return '--/--/----';
                    const p = d.split('-');
                    if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
                    return d;
                };

                let alertaDiasHtml = '';
                if (v.data_proxima_inspecao) {
                    const hoje = new Date();
                    hoje.setHours(0, 0, 0, 0);
                    
                    const [ano, mes, dia] = v.data_proxima_inspecao.split('-');
                    const dataProx = new Date(ano, mes - 1, dia);
                    dataProx.setHours(0, 0, 0, 0);

                    const diffTime = dataProx.getTime() - hoje.getTime();
                    const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

                    if (diffDays < 0) {
                        alertaDiasHtml = `<span style="color: #ef4444; font-weight: bold;"><i class="fas fa-exclamation-circle"></i> Atrasado ${Math.abs(diffDays)} dia(s)</span>`;
                    } else if (diffDays === 0) {
                        alertaDiasHtml = `<span style="color: #ef4444; font-weight: bold;"><i class="fas fa-exclamation-triangle"></i> Vence HOJE</span>`;
                    } else if (diffDays <= 5) {
                        alertaDiasHtml = `<span style="color: #f59e0b; font-weight: bold;"><i class="fas fa-clock"></i> Vence em ${diffDays} dia(s)</span>`;
                    } else {
                        alertaDiasHtml = `<span style="color: #10b981;"><i class="fas fa-check"></i> Faltam ${diffDays} dia(s)</span>`;
                    }
                } else {
                    alertaDiasHtml = `<span style="color: var(--text-secondary);"><i class="fas fa-question-circle"></i> Sem previsão</span>`;
                }

                datasHtml = `
                    <div style="font-size: 0.85rem; line-height: 1.6;">
                        <div><span style="color: var(--text-secondary);">Inspeção:</span> <strong style="color: #10b981;">${formatData(v.data_inspecao)}</strong></div>
                        <div style="margin-top: 4px;"><span style="color: var(--text-secondary);">Próxima:</span> <strong style="color: #f59e0b;">${formatData(v.data_proxima_inspecao)}</strong></div>
                        <div style="margin-top: 4px; font-size: 0.75rem;">${alertaDiasHtml}</div>
                    </div>
                `;
            }

            let badgeHtml = `
                <div class="badge-status-rev" style="background: ${info.bg}; color: ${info.cor}; border: 1px solid ${info.cor};">
                    <i class="${info.icon}"></i> ${info.status}
                </div>
            `;

            let btnLabelKm = isGrua ? 'Horímetro' : 'KM';
            let acoesHtml = `
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button class="btn-secondary-dark" onclick="window.abrirModalKm('${v.id}')" title="Atualizar ${btnLabelKm}">
                        <i class="fas fa-tachometer-alt" style="color: var(--ccol-blue-bright);"></i> ${isGrua ? 'HORAS' : 'KM'}
                    </button>
                    <button class="btn-primary-green" onclick="window.abrirModalRevisao('${v.id}')" title="Registrar Manutenção / Inspeção">
                        <i class="fas fa-tools"></i> Revisão
                    </button>
                </div>
            `;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${idVeiculoHtml}</td>
                <td style="color: var(--text-secondary); font-weight: 600; font-size: 0.85rem;">${v.tipo.toUpperCase()}</td>
                <td>${progressHtml}</td>
                <td>${datasHtml}</td>
                <td style="text-align: center;">${badgeHtml}</td>
                <td>${acoesHtml}</td>
            `;
            tbody.appendChild(tr);
        });
    });
};

// ======================= IMPORTAÇÃO DE PLANILHA =======================
window.importarPlanilhaKm = function() {
    if (typeof XLSX === 'undefined') {
        alert("A biblioteca XLSX (SheetJS) não está carregada no sistema.\nCertifique-se de adicioná-la no seu index.html.");
        return;
    }

    let fileInput = document.getElementById('inputImportarKmExcel');
    if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'inputImportarKmExcel';
        fileInput.accept = '.xlsx, .xls';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);

        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet, {header: 1});

                    let headerRowIndex = -1;
                    let colPlaca = -1;
                    let colOdo = -1;

                    // Procura o cabeçalho correto
                    for (let i = 0; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        if (row && row.length > 0) {
                            for(let j = 0; j < row.length; j++) {
                                const val = String(row[j] || '').trim();
                                if (val === 'Placa') colPlaca = j;
                                if (val === 'Odômetro Final (GPS)') colOdo = j;
                            }
                            if (colPlaca !== -1 && colOdo !== -1) {
                                headerRowIndex = i;
                                break;
                            }
                        }
                    }

                    if (headerRowIndex === -1) {
                        alert("Não foi possível encontrar as colunas 'Placa' e 'Odômetro Final (GPS)' na planilha importada.");
                        fileInput.value = ''; 
                        return;
                    }

                    let veiculosAtualizados = 0;
                    const filialId = window.obterFilialUsuarioLogadoRev();

                    const tbody = document.getElementById('tbControleRevisoes');
                    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--ccol-blue-bright); padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Lendo planilha e atualizando TRITREMs...</td></tr>`;

                    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        if (!row || !row[colPlaca]) continue;

                        const placaSheet = String(row[colPlaca]).trim().toUpperCase();
                        let odoSheetRaw = String(row[colOdo] || '0').replace(/,/g, '.').replace(/[^\d.-]/g, '');
                        const odoFinal = Math.round(parseFloat(odoSheetRaw));

                        if (isNaN(odoFinal) || odoFinal <= 0) continue;

                        // Verifica a Frota 
                        let queryFrota = window.supabaseClient.from('frotas_manutencao')
                            .select('*')
                            .or(`cavalo.eq."${placaSheet}",go.eq."${placaSheet}",numero_frota.eq."${placaSheet}"`);
                        
                        if (filialId !== null) queryFrota = queryFrota.eq('filial_id', filialId);
                        
                        const { data: f } = await queryFrota.maybeSingle();

                        // Garante que a atualização será APLICADA APENAS AO TRITREM
                        if (f && String(f.categoria || '').toUpperCase().includes('TRITREM')) {
                            const placaReal = f.cavalo || f.go || placaSheet;
                            const numFrotaReal = f.numero_frota || f.go || placaSheet;

                            let queryRev = window.supabaseClient.from('manutencao_revisoes')
                                .select('id, km_atual')
                                .or(`placa.eq."${placaReal}",numero_frota.eq."${numFrotaReal}"`);
                                
                            if (filialId !== null) queryRev = queryRev.eq('filial_id', filialId);
                            
                            const { data: rev } = await queryRev.maybeSingle();

                            if (rev && rev.id) {
                                if (odoFinal > (rev.km_atual || 0)) {
                                    await window.supabaseClient.from('manutencao_revisoes').update({ km_atual: odoFinal }).eq('id', rev.id);
                                    veiculosAtualizados++;
                                }
                            } else {
                                await window.supabaseClient.from('manutencao_revisoes').insert([{
                                    placa: placaReal,
                                    numero_frota: numFrotaReal,
                                    tipo: f.categoria,
                                    km_atual: odoFinal,
                                    km_ultima_revisao: odoFinal,
                                    km_proxima_revisao: 0,
                                    filial_id: filialId
                                }]);
                                veiculosAtualizados++;
                            }
                        }
                    }

                    alert(`Planilha processada com sucesso! ${veiculosAtualizados} TRITREM(s) atualizado(s).`);
                    fileInput.value = '';
                    
                    // Recarrega a tabela imediatamente sem precisar do botão de atualizar dados
                    await window.carregarVeiculosManutencao(false);

                } catch (err) {
                    console.error("Erro ao ler excel:", err);
                    alert("Ocorreu um erro ao processar a planilha. Verifique o console.");
                    await window.carregarVeiculosManutencao(false);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    fileInput.click();
};

// ======================= MODAL: KM / HORÍMETRO =======================
window.abrirModalKm = function(id) {
    const v = window.veiculosRevisaoDb.find(x => String(x.id) === String(id));
    if(!v) return;

    const isGrua = String(v.tipo).toUpperCase().includes('GRUA');
    const lblTexto = isGrua ? 'Horímetro' : 'KM';

    document.getElementById('lblTituloKmHorimetro').innerText = lblTexto;
    document.getElementById('lblAtualSistemaTexto').innerText = lblTexto;

    document.getElementById('kmVeiculoId').value = v.id;
    document.getElementById('kmVeiculoPlacaValor').value = v.placa;
    document.getElementById('kmVeiculoFrotaValor').value = v.numero_frota;
    document.getElementById('kmVeiculoTipoValor').value = v.tipo;
    
    document.getElementById('kmVeiculoPlaca').innerText = `${v.placa} (Frota ${v.numero_frota})`;
    document.getElementById('kmAtualSistema').innerText = v.km_atual.toLocaleString('pt-BR');
    document.getElementById('inputNovoKm').value = v.km_atual;

    document.getElementById('modalAtualizarKm').classList.add('show');
};

window.fecharModalKm = function() {
    document.getElementById('modalAtualizarKm').classList.remove('show');
};

window.salvarNovoKm = async function() {
    const placa = document.getElementById('kmVeiculoPlacaValor').value;
    const frota = document.getElementById('kmVeiculoFrotaValor').value;
    const tipo = document.getElementById('kmVeiculoTipoValor').value;
    const novoKm = parseInt(document.getElementById('inputNovoKm').value);
    const filialId = window.obterFilialUsuarioLogadoRev();

    if (isNaN(novoKm) || novoKm < 0) return alert("Digite um valor válido.");

    try {
        let queryCheck = window.supabaseClient.from('manutencao_revisoes').select('id').eq('placa', placa);
        if (filialId !== null) queryCheck = queryCheck.eq('filial_id', filialId);
        
        const { data: checkExist } = await queryCheck.maybeSingle();

        if (checkExist && checkExist.id) {
            await window.supabaseClient.from('manutencao_revisoes').update({ km_atual: novoKm }).eq('id', checkExist.id);
        } else {
            await window.supabaseClient.from('manutencao_revisoes').insert([{
                placa: placa, numero_frota: frota, tipo: tipo,
                km_atual: novoKm, km_ultima_revisao: novoKm, km_proxima_revisao: 0,
                filial_id: filialId
            }]);
        }

        window.fecharModalKm();
        
        // Dispara a renovação da tabela para efeito "automático"
        await window.carregarVeiculosManutencao(false);

    } catch (e) {
        console.error("Erro ao atualizar:", e);
        alert("Erro ao salvar. Tente novamente.");
    }
};

// ======================= MODAL: REGISTRAR REVISÃO =======================
window.abrirModalRevisao = function(id) {
    const v = window.veiculosRevisaoDb.find(x => String(x.id) === String(id));
    if(!v) return;

    const isGrua = String(v.tipo).toUpperCase().includes('GRUA');
    const isTritrem = String(v.tipo).toUpperCase().includes('TRITREM');
    const lblTexto = isGrua ? 'Horímetro' : 'KM';

    document.getElementById('lblRevRealizadaTexto').innerText = lblTexto;
    document.getElementById('lblRevProximaTexto').innerText = lblTexto;

    document.getElementById('revVeiculoId').value = v.id;
    document.getElementById('revVeiculoPlacaValor').value = v.placa;
    document.getElementById('revVeiculoFrotaValor').value = v.numero_frota;
    document.getElementById('revVeiculoTipoValor').value = v.tipo;

    document.getElementById('revVeiculoPlaca').innerText = `${v.placa} (Frota ${v.numero_frota})`;
    
    const inputRealizada = document.getElementById('inputKmRevisaoRealizada');
    const inputProxima = document.getElementById('inputKmProximaRevisao');
    const inputDetalhes = document.getElementById('inputDetalhesRevisao');

    inputRealizada.value = v.km_atual;
    inputDetalhes.value = v.detalhes_ultima_revisao || '';

    // Gestão do display de datas (Exclusivo Tritrem)
    const divDatas = document.getElementById('divDatasInspecaoTritrem');
    if (isTritrem) {
        divDatas.style.display = 'block';
        document.getElementById('inputDataInspecao').value = v.data_inspecao || '';
        document.getElementById('inputDataProximaInspecao').value = v.data_proxima_inspecao || '';
    } else {
        divDatas.style.display = 'none';
        document.getElementById('inputDataInspecao').value = '';
        document.getElementById('inputDataProximaInspecao').value = '';
    }

    // Lógica para GRUAS (calcula automático a próxima de 500h e trava o input)
    if (isGrua) {
        inputProxima.readOnly = true;
        inputProxima.style.backgroundColor = 'rgba(0,0,0,0.2)'; 
        inputProxima.style.cursor = 'not-allowed';

        inputRealizada.oninput = function() {
            const ultima = parseInt(inputRealizada.value) || 0;
            const proximaRevisao500 = ultima + 500;
            
            let proximaRevisaoGeral = Math.ceil(ultima / 1000) * 1000;
            if (proximaRevisaoGeral === ultima || proximaRevisaoGeral === 0) {
                proximaRevisaoGeral += 1000;
            }

            inputProxima.value = proximaRevisao500;
            inputDetalhes.value = `Aviso automático: Próxima revisão em ${proximaRevisao500}h. Revisão GERAL programada para ${proximaRevisaoGeral}h.`;
        };
        // Aciona o cálculo imediatamente ao abrir o modal
        inputRealizada.dispatchEvent(new Event('input'));
    } else {
        // Libera o campo para outros veículos que não sejam GRUA
        inputProxima.readOnly = false;
        inputProxima.style.backgroundColor = '';
        inputProxima.style.cursor = '';
        
        inputRealizada.oninput = null;
        inputProxima.value = (v.km_proxima_revisao && v.km_proxima_revisao > 0) ? v.km_proxima_revisao : v.km_atual + 10000;
    }

    document.getElementById('modalRegistrarRevisao').classList.add('show');
};

window.fecharModalRevisao = function() {
    document.getElementById('modalRegistrarRevisao').classList.remove('show');
};

window.salvarNovaRevisao = async function() {
    const placa = document.getElementById('revVeiculoPlacaValor').value;
    const frota = document.getElementById('revVeiculoFrotaValor').value;
    const tipo = document.getElementById('revVeiculoTipoValor').value;
    const kmRevisao = parseInt(document.getElementById('inputKmRevisaoRealizada').value);
    const kmProxima = parseInt(document.getElementById('inputKmProximaRevisao').value);
    const detalhes = document.getElementById('inputDetalhesRevisao').value.trim();
    const filialId = window.obterFilialUsuarioLogadoRev();
    const isTritrem = String(tipo).toUpperCase().includes('TRITREM');

    if (isNaN(kmRevisao) || isNaN(kmProxima)) return alert("Preencha corretamente os campos obrigatórios de KM/Hora.");
    if (kmProxima <= kmRevisao) return alert("A próxima revisão deve ser MAIOR que a revisão realizada.");

    let payload = {
        placa: placa,
        numero_frota: frota,
        tipo: tipo,
        km_atual: kmRevisao,
        km_ultima_revisao: kmRevisao,
        km_proxima_revisao: kmProxima,
        detalhes_ultima_revisao: detalhes,
        filial_id: filialId
    };

    if (isTritrem) {
        payload.data_inspecao = document.getElementById('inputDataInspecao').value || null;
        payload.data_proxima_inspecao = document.getElementById('inputDataProximaInspecao').value || null;
    }

    try {
        let queryCheck = window.supabaseClient.from('manutencao_revisoes').select('id').eq('placa', placa);
        if (filialId !== null) queryCheck = queryCheck.eq('filial_id', filialId);
        
        const { data: checkExist } = await queryCheck.maybeSingle();

        if (checkExist && checkExist.id) {
            await window.supabaseClient.from('manutencao_revisoes').update(payload).eq('id', checkExist.id);
        } else {
            await window.supabaseClient.from('manutencao_revisoes').insert([payload]);
        }

        window.fecharModalRevisao();

        // Dispara a renovação da tabela para efeito "automático" sem dar refresh na janela inteira
        await window.carregarVeiculosManutencao(false);

    } catch (e) {
        console.error("Erro ao registrar revisão:", e);
        alert("Erro ao registrar a manutenção. Tente novamente.");
    }
};

// ======================= CONFIGURAÇÕES & GOOGLE SHEETS =======================
window.abrirModalConfigManutencao = async function() {
    document.getElementById('inputGoogleSheetsLink').value = 'Carregando...';
    document.getElementById('modalConfigManutencao').classList.add('show');
    
    const filialId = window.obterFilialUsuarioLogadoRev() || 0;

    try {
        const { data, error } = await window.supabaseClient.from('manutencao_configuracoes').select('google_sheets_link').eq('filial_id', filialId).maybeSingle();
        if (!error && data) {
            document.getElementById('inputGoogleSheetsLink').value = data.google_sheets_link || '';
        } else {
            document.getElementById('inputGoogleSheetsLink').value = '';
        }
    } catch(e) {
        document.getElementById('inputGoogleSheetsLink').value = '';
    }
};

window.fecharModalConfigManutencao = function() {
    document.getElementById('modalConfigManutencao').classList.remove('show');
};

window.salvarConfigManutencao = async function() {
    const link = document.getElementById('inputGoogleSheetsLink').value.trim();
    const filialId = window.obterFilialUsuarioLogadoRev() || 0;

    try {
        const { data: check } = await window.supabaseClient.from('manutencao_configuracoes').select('id').eq('filial_id', filialId).maybeSingle();
        
        if (check && check.id) {
            await window.supabaseClient.from('manutencao_configuracoes').update({ google_sheets_link: link }).eq('id', check.id);
        } else {
            await window.supabaseClient.from('manutencao_configuracoes').insert([{ google_sheets_link: link, filial_id: filialId }]);
        }

        alert("Link da planilha salvo com sucesso!");
        window.fecharModalConfigManutencao();
    } catch(e) {
        console.error(e);
        alert("Erro ao salvar configuração.");
    }
};

window.forcarSincronizacaoPlanilha = async function() {
    await window.salvarConfigManutencao();
    const btn = document.querySelector('#modalConfigManutencao .btn-primary-blue');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
    
    await window.carregarVeiculosManutencao(true);
    
    btn.innerHTML = '<i class="fas fa-sync-alt"></i> Sincronizar Agora';
};

window.sincronizarComPlanilhaGoogle = async function() {
    const filialId = window.obterFilialUsuarioLogadoRev();
    
    try {
        const { data } = await window.supabaseClient.from('manutencao_configuracoes').select('google_sheets_link').eq('filial_id', filialId || 0).maybeSingle();
        if(!data || !data.google_sheets_link) return;
        
        const matchId = data.google_sheets_link.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if(!matchId) return;
        
        const sheetId = matchId[1];
        let csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

        const matchGid = data.google_sheets_link.match(/[#&?]gid=([0-9]+)/);
        if (matchGid) {
            csvUrl += `&gid=${matchGid[1]}`;
        }

        const response = await fetch(csvUrl);
        const csvText = await response.text();
        
        await new Promise((resolve, reject) => {
            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: async function(results) {
                    try {
                        const rows = results.data;
                        let veiculosAtualizados = 0;
                        let ultimosRegistros = {};
                        let rowIndex = 0;
                        
                        for (let row of rows) {
                            rowIndex++;
                            let frotaSheet = null;
                            let valorSheet = null;
                            
                            for (let key in row) {
                                let k = key.trim().toUpperCase();
                                if (k === 'GRUA' || k === 'FROTA' || k === 'PLACA' || k === 'EQUIPAMENTO') frotaSheet = row[key];
                                if (k === 'HORIMETRO FINAL' || k === 'HORIMETRO' || k === 'KM' || k === 'ATUAL') valorSheet = row[key];
                            }
                            
                            if (frotaSheet && valorSheet) {
                                frotaSheet = frotaSheet.trim().toUpperCase();
                                
                                let limpo = String(valorSheet).replace(/,/g, '.').replace(/[^\d.-]/g, '');
                                let valorNum = parseFloat(limpo);
                                
                                if (!isNaN(valorNum) && valorNum > 0) {
                                    if (!ultimosRegistros[frotaSheet] || rowIndex >= ultimosRegistros[frotaSheet].index) {
                                        ultimosRegistros[frotaSheet] = { 
                                            value: valorNum, 
                                            index: rowIndex 
                                        };
                                    }
                                }
                            }
                        }
                        
                        for (const [frotaId, record] of Object.entries(ultimosRegistros)) {
                            let valorFinal = Math.round(record.value); 
                            
                            let queryRev = window.supabaseClient.from('manutencao_revisoes')
                                .select('*')
                                .or(`placa.eq."${frotaId}",numero_frota.eq."${frotaId}"`);
                                
                            if (filialId !== null) queryRev = queryRev.eq('filial_id', filialId);
                            
                            const { data: rev } = await queryRev.maybeSingle();
                            
                            if (rev && rev.id) {
                                if (valorFinal > (rev.km_atual || 0)) {
                                    await window.supabaseClient.from('manutencao_revisoes').update({ km_atual: valorFinal }).eq('id', rev.id);
                                    veiculosAtualizados++;
                                }
                            } else {
                                let queryFrota = window.supabaseClient.from('frotas_manutencao')
                                    .select('*')
                                    .or(`cavalo.eq."${frotaId}",go.eq."${frotaId}",numero_frota.eq."${frotaId}"`);
                                    
                                if (filialId !== null) queryFrota = queryFrota.eq('filial_id', filialId);
                                
                                const { data: f } = await queryFrota.maybeSingle();
                                if (f) {
                                    const placaReal = f.cavalo || f.go || frotaId;
                                    const numFrotaReal = f.numero_frota || f.go || frotaId;

                                    let checkDeNovo = window.supabaseClient.from('manutencao_revisoes')
                                        .select('id, km_atual')
                                        .or(`placa.eq."${placaReal}",numero_frota.eq."${numFrotaReal}"`);
                                        
                                    if (filialId !== null) checkDeNovo = checkDeNovo.eq('filial_id', filialId);

                                    const { data: rev2 } = await checkDeNovo.maybeSingle();

                                    if (rev2 && rev2.id) {
                                        if (valorFinal > (rev2.km_atual || 0)) {
                                            await window.supabaseClient.from('manutencao_revisoes').update({ km_atual: valorFinal }).eq('id', rev2.id);
                                            veiculosAtualizados++;
                                        }
                                    } else {
                                        await window.supabaseClient.from('manutencao_revisoes').insert([{
                                            placa: placaReal,
                                            numero_frota: numFrotaReal,
                                            tipo: f.categoria || 'GRUA',
                                            km_atual: valorFinal,
                                            km_ultima_revisao: valorFinal,
                                            km_proxima_revisao: 0,
                                            filial_id: filialId
                                        }]);
                                        veiculosAtualizados++;
                                    }
                                }
                            }
                        }
                        
                        if(veiculosAtualizados > 0) {
                            console.log(`Planilha sincronizada. ${veiculosAtualizados} equipamentos atualizados.`);
                        }
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                },
                error: function(error) {
                    reject(error);
                }
            });
        });
    } catch(e) {
        console.error("Erro na integração com Google Sheets:", e);
    }
};