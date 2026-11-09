window.initSLA = async function() {
    console.log("[SLA] Módulo iniciado (Modo Alta Performance com DM e Indicadores Visuais).");
    const client = window.getSupabaseClient ? window.getSupabaseClient() : (window.db && window.db.supabase ? window.db.supabase : supabaseClient);
    if (!client) return;

    let chartSlaObj = null;
    const nomeMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const nomeMesesExtenso = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    let tarifadorAtivoGlobal = null;
    let gruasPropriasCache = new Map();
    let tarifaCache = new Map();
    
    let metasSlaAtuais = {
        id: null,
        garantia_minima_volume_mensal: 0,
        meta_viagens_mensal_grua: 0,
        meta_viagens_diaria_grua: 0,
        peso_medio_transportado: 0,
        custo_hora_improdutiva: 0,
        faturamento_previsto_mensal: 0
    };

    const btnProcessar = document.getElementById('btnProcessarSLA');
    if (btnProcessar) {
        btnProcessar.addEventListener('click', carregarDadosSLA);
    }
    
    window.addEventListener('resize', () => {
        if (chartSlaObj) chartSlaObj.resize();
    });

    function setupFormatadoresModal() {
        const formatCurrency = (val) => val.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
        const formatNumber = (val, label) => val.toLocaleString('pt-BR') + ' ' + label;

        const binds = [
            { id: 'inpSlaFaturamentoPrevisto', span: 'fmtFaturamentoPrevisto', type: 'currency' },
            { id: 'inpSlaGarantia', span: 'fmtGarantia', type: 'number', label: 'm³/mês' },
            { id: 'inpSlaViagensMensal', span: 'fmtViagensMensal', type: 'number', label: 'Cargas/mês' },
            { id: 'inpSlaViagensDiaria', span: 'fmtViagensDiaria', type: 'number', label: 'Cargas/dia' },
            { id: 'inpSlaPesoMedio', span: 'fmtPesoMedio', type: 'number', label: 'm³/viagem' },
            { id: 'inpSlaHoraImprodutiva', span: 'fmtHoraImprodutiva', type: 'currency' }
        ];

        binds.forEach(b => {
            const el = document.getElementById(b.id);
            const span = document.getElementById(b.span);
            if (el && span) {
                el.addEventListener('input', () => {
                    const val = parseFloat(el.value) || 0;
                    span.innerText = b.type === 'currency' ? formatCurrency(val) : formatNumber(val, b.label);
                });
            }
        });
    }
    setupFormatadoresModal();

    window.abrirModalMetasSLA = function() {
        const ano = document.getElementById('slaAnoSelect').value;
        document.getElementById('lblAnoModalMetas').innerText = ano;
        
        document.getElementById('slaMetaId').value = metasSlaAtuais.id || '';
        document.getElementById('inpSlaFaturamentoPrevisto').value = metasSlaAtuais.faturamento_previsto_mensal || '';
        document.getElementById('inpSlaGarantia').value = metasSlaAtuais.garantia_minima_volume_mensal || '';
        document.getElementById('inpSlaViagensMensal').value = metasSlaAtuais.meta_viagens_mensal_grua || '';
        document.getElementById('inpSlaViagensDiaria').value = metasSlaAtuais.meta_viagens_diaria_grua || '';
        document.getElementById('inpSlaPesoMedio').value = metasSlaAtuais.peso_medio_transportado || '';
        document.getElementById('inpSlaHoraImprodutiva').value = metasSlaAtuais.custo_hora_improdutiva || '';

        ['inpSlaFaturamentoPrevisto', 'inpSlaGarantia', 'inpSlaViagensMensal', 'inpSlaViagensDiaria', 'inpSlaPesoMedio', 'inpSlaHoraImprodutiva'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.dispatchEvent(new Event('input'));
        });

        const modal = document.getElementById('modalMetasSLA');
        if (modal) modal.style.display = 'flex';
    };

    window.fecharModalMetasSLA = function() {
        const modal = document.getElementById('modalMetasSLA');
        if (modal) modal.style.display = 'none';
    };

    window.salvarMetasSLA = async function() {
        const ano = parseInt(document.getElementById('slaAnoSelect').value, 10);
        const filialId = (window.currentUser && window.currentUser.filial_id) ? parseInt(window.currentUser.filial_id, 10) : null;
        
        if (!filialId) {
            Swal.fire('Atenção', 'Você precisa estar vinculado a uma filial para salvar metas.', 'warning');
            return;
        }

        const payload = {
            filial_id: filialId,
            ano: ano,
            faturamento_previsto_mensal: parseFloat(document.getElementById('inpSlaFaturamentoPrevisto').value) || 0,
            garantia_minima_volume_mensal: parseFloat(document.getElementById('inpSlaGarantia').value) || 0,
            meta_viagens_mensal_grua: parseFloat(document.getElementById('inpSlaViagensMensal').value) || 0,
            meta_viagens_diaria_grua: parseFloat(document.getElementById('inpSlaViagensDiaria').value) || 0,
            peso_medio_transportado: parseFloat(document.getElementById('inpSlaPesoMedio').value) || 0,
            custo_hora_improdutiva: parseFloat(document.getElementById('inpSlaHoraImprodutiva').value) || 0
        };

        const metaId = document.getElementById('slaMetaId').value;

        try {
            let res;
            if (metaId) {
                res = await client.from('metas_sla').update(payload).eq('id', metaId);
            } else {
                res = await client.from('metas_sla').insert([payload]);
            }

            if (res.error) throw res.error;
            
            Swal.fire('Sucesso', 'Metas salvas com sucesso!', 'success');
            window.fecharModalMetasSLA();
            carregarDadosSLA(); 
        } catch (e) {
            console.error("Erro ao salvar metas SLA", e);
            Swal.fire('Erro', 'Não foi possível salvar as metas.', 'error');
        }
    };

    window.mostrarDetalhesMetaSLA = function(grua, periodo, tipo, realizado, meta) {
        const atingiu = parseFloat(realizado.replace(',','.')) >= parseFloat(meta.replace(',','.'));
        const icon = atingiu ? 'success' : 'error';
        const title = atingiu ? 'Meta Atingida! 🎉' : 'Meta Não Atingida ⚠️';
        const color = atingiu ? '#10b981' : '#ef4444';
        const bgResult = atingiu ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
        
        let text = `
            <div style="text-align: left; margin-top: 1rem; color: #cbd5e1; font-family: 'Inter', sans-serif;">
                <p style="margin-bottom: 0.5rem; font-size: 1rem;"><strong>Máquina:</strong> <span style="color: #38bdf8; font-family: monospace; font-size: 1.2rem; font-weight: bold; background: rgba(56,189,248,0.1); padding: 2px 6px; border-radius: 4px;">${grua}</span></p>
                <p style="margin-bottom: 0.5rem; font-size: 0.95rem;"><strong>Período:</strong> ${periodo}</p>
                <p style="margin-bottom: 0.5rem; font-size: 0.95rem;"><strong>Indicador (SLA):</strong> ${tipo}</p>
                
                <div style="background-color: #0f172a; padding: 1.5rem; border-radius: 1rem; margin-top: 1.5rem; display: flex; justify-content: space-between; align-items: center; border: 1px solid #334155; box-shadow: inset 0 2px 10px rgba(0,0,0,0.4);">
                    <div style="text-align: center; flex: 1;">
                        <p style="font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; font-weight: bold; margin-bottom: 0.4rem; letter-spacing: 1px;">Meta SLA</p>
                        <p style="font-size: 1.6rem; font-weight: 900; color: #fbbf24; font-family: monospace;">${meta}</p>
                    </div>
                    <div style="font-size: 1.5rem; color: #475569; padding: 0 10px;">
                        <i class="fas fa-chevron-right"></i>
                    </div>
                    <div style="text-align: center; flex: 1; background-color: ${bgResult}; padding: 0.8rem; border-radius: 0.75rem; border: 1px solid ${color}50;">
                        <p style="font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; font-weight: bold; margin-bottom: 0.4rem; letter-spacing: 1px;">Realizado</p>
                        <p style="font-size: 1.8rem; font-weight: 900; color: ${color}; font-family: monospace;">${realizado}</p>
                    </div>
                </div>
            </div>
        `;
        
        Swal.fire({
            title: `<span style="color: #f8fafc; font-size: 1.5rem; font-weight: 800;">${title}</span>`,
            html: text,
            icon: icon,
            background: '#1e293b',
            confirmButtonColor: '#3b82f6',
            confirmButtonText: '<i class="fas fa-check"></i> Entendi',
            customClass: {
                popup: 'border border-slate-700 rounded-2xl shadow-2xl',
                confirmButton: 'font-bold rounded-lg px-6'
            }
        });
    };

    function corrigirDataSupabaseLocal(dateStr) {
        if (!dateStr || dateStr === 'null' || dateStr === 'undefined') return null;
        let str = String(dateStr).trim();
        if (!str.includes('T')) str = str.replace(' ', 'T');
        const partes = str.split('T');
        if (partes.length === 2) {
            const horaStr = partes[1];
            if (!horaStr.includes('Z') && !horaStr.includes('+') && !horaStr.includes('-')) {
                str += 'Z'; 
            }
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    }

    function calcularDMMensal(placa, mes, ano) {
        const resultDefault = { percentDM: 100, hTrabalho:0, mTrabalho:0, hManut:0, mManut:0, htmlLinhas: '' };
        if (typeof window.ordensServico === 'undefined' || !window.ordensServico) return resultDefault;
        if (typeof window.frotasManutencao === 'undefined' || !window.frotasManutencao) return resultDefault;
        
        const frota = window.frotasManutencao.find(f => f.cavalo === placa);
        if (!frota) return resultDefault;

        let diaInicio = new Date(ano, mes, 1, 0, 0, 0, 0);
        let hoje = new Date();
        let diaFim = new Date(ano, mes + 1, 0, 23, 59, 59, 999);
        
        if (diaFim > hoje) diaFim = hoje; 
        if (diaInicio > hoje) return { percentDM: 0, hTrabalho:0, mTrabalho:0, hManut:0, mManut:0, htmlLinhas: '' };

        let frotaInicioStr = frota.data_inicial ? frota.data_inicial : '2026-04-01';
        let dtEntradaVeiculo = new Date(frotaInicioStr + 'T00:00:00');
        
        let msValidoVeiculo = 0;
        let overlapDispInicio = dtEntradaVeiculo > diaInicio ? dtEntradaVeiculo : diaInicio;
        if (overlapDispInicio < diaFim) {
            msValidoVeiculo = (diaFim - overlapDispInicio);
        }
        
        let horasValidoVeiculo = msValidoVeiculo / (1000 * 60 * 60);
        if (horasValidoVeiculo <= 0) return { percentDM: 0, hTrabalho:0, mTrabalho:0, hManut:0, mManut:0, htmlLinhas: '' };

        const todasOS = window.ordensServico.filter(o => o.placa === placa && o.status !== 'Agendada' && o.tipo !== 'Cavalo Disponível S/ Carreta');
        
        let htmlLinhas = '';
        let intervalos = [];

        todasOS.forEach(os => {
            const osInicio = corrigirDataSupabaseLocal(os.data_abertura);
            if (!osInicio) return;
            
            let osFim = os.data_conclusao ? corrigirDataSupabaseLocal(os.data_conclusao) : hoje;
            
            let inicioValido = osInicio > dtEntradaVeiculo ? osInicio : dtEntradaVeiculo;
            const overlapInicio = inicioValido > diaInicio ? inicioValido : diaInicio;
            const overlapFim = osFim < diaFim ? osFim : diaFim;

            if (overlapInicio < overlapFim) {
                let duracaoMs = overlapFim - overlapInicio;
                let h = Math.floor(duracaoMs / (1000 * 60 * 60));
                let m = Math.round((duracaoMs - (h * 1000 * 60 * 60)) / (1000 * 60));

                let dtIniStr = `${String(overlapInicio.getDate()).padStart(2,'0')}/${String(overlapInicio.getMonth()+1).padStart(2,'0')} ${String(overlapInicio.getHours()).padStart(2,'0')}:${String(overlapInicio.getMinutes()).padStart(2,'0')}`;
                let dtFimStr = os.data_conclusao ? `${String(overlapFim.getDate()).padStart(2,'0')}/${String(overlapFim.getMonth()+1).padStart(2,'0')} ${String(overlapFim.getHours()).padStart(2,'0')}:${String(overlapFim.getMinutes()).padStart(2,'0')}` : 'Em Andamento';

                intervalos.push([overlapInicio.getTime(), overlapFim.getTime()]);

                htmlLinhas += `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.1);">
                        <td style="padding: 12px; color: #fff; font-weight: bold;">#${os.numero_os || os.id}</td>
                        <td style="padding: 12px; color: #94a3b8;">${dtIniStr}</td>
                        <td style="padding: 12px; color: #94a3b8;">${dtFimStr}</td>
                        <td style="padding: 12px; color: #3b82f6;">${os.tipo || 'Manutenção'}</td>
                        <td style="padding: 12px; color: #ef4444; font-weight: bold;">${h}h ${m}m</td>
                    </tr>
                `;
            }
        });

        let tempoManutencaoTotalHoras = 0;
        if (intervalos.length > 0) {
            intervalos.sort((a,b) => a[0] - b[0]);
            let merged = [ [intervalos[0][0], intervalos[0][1]] ];
            for (let i = 1; i < intervalos.length; i++) {
                let last = merged[merged.length - 1];
                let current = intervalos[i];
                if (current[0] <= last[1]) {
                    last[1] = Math.max(last[1], current[1]);
                } else {
                    merged.push([current[0], current[1]]);
                }
            }
            merged.forEach(iv => {
                tempoManutencaoTotalHoras += (iv[1] - iv[0]) / (1000 * 60 * 60);
            });
        }

        if (tempoManutencaoTotalHoras > horasValidoVeiculo) tempoManutencaoTotalHoras = horasValidoVeiculo;

        let horasDisponivel = horasValidoVeiculo - tempoManutencaoTotalHoras;
        if (horasDisponivel < 0) horasDisponivel = 0;

        let percentDM = horasValidoVeiculo > 0 ? (horasDisponivel / horasValidoVeiculo) * 100 : 100;
        
        let hTrabalho = Math.floor(horasValidoVeiculo);
        let mTrabalho = Math.round((horasValidoVeiculo - hTrabalho) * 60);
        let hManut = Math.floor(tempoManutencaoTotalHoras);
        let mManut = Math.round((tempoManutencaoTotalHoras - hManut) * 60);

        return { percentDM, hTrabalho, mTrabalho, hManut, mManut, htmlLinhas };
    }

    window.abrirModalDetalhesDMMensalSLA = function(placa, mes, ano) {
        if (!window.ordensServico || !window.frotasManutencao) {
            Swal.fire('Atenção', 'Dados de manutenção não carregados ainda no sistema. Aguarde alguns segundos.', 'warning');
            return;
        }
        
        const dadosDM = calcularDMMensal(placa, mes, ano);
        if (!dadosDM) return;
        
        const periodoTxt = `${nomeMesesExtenso[mes]} de ${ano}`;
        let corDm = dadosDM.percentDM >= 90 ? '#10b981' : (dadosDM.percentDM >= 80 ? '#f59e0b' : '#ef4444');
        let htmlLinhas = dadosDM.htmlLinhas || '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #94a3b8;">Nenhuma parada registrada no período.</td></tr>';
        
        const modalHtml = `
            <div id="modalDetalhesDMMaquinaSLA" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); z-index: 9999; display: flex; align-items: center; justify-content: center;">
                <div style="background: #1e293b; border: 1px solid #3b82f6; border-radius: 12px; width: 95%; max-width: 900px; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                    
                    <div style="padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; background: rgba(59,130,246,0.1); border-radius: 12px 12px 0 0;">
                        <h3 style="color: #fff; margin: 0; font-size: 1.2rem; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-tools" style="color: #3b82f6;"></i> Detalhamento DM: <span style="color: #3b82f6; font-weight: 900; font-size: 1.4rem;">${placa}</span> <span style="font-size: 1rem; color: #94a3b8; font-weight: normal;">(${periodoTxt})</span>
                        </h3>
                        <button onclick="document.getElementById('modalDetalhesDMMaquinaSLA').remove()" style="background: transparent; border: none; color: #94a3b8; font-size: 1.5rem; cursor: pointer; transition: 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#94a3b8'">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div style="display: flex; justify-content: space-around; padding: 20px; background: rgba(0,0,0,0.2);">
                        <div style="text-align: center;">
                            <p style="color: #94a3b8; font-size: 0.8rem; text-transform: uppercase; font-weight: bold; margin-bottom: 5px;">Tempo Total Mês</p>
                            <h4 style="color: #fff; font-size: 1.5rem; margin: 0;">${dadosDM.hTrabalho}h ${dadosDM.mTrabalho}m</h4>
                        </div>
                        <div style="text-align: center; border-left: 1px solid rgba(255,255,255,0.1); padding-left: 20px;">
                            <p style="color: #94a3b8; font-size: 0.8rem; text-transform: uppercase; font-weight: bold; margin-bottom: 5px;">Tempo Parado (O.S.)</p>
                            <h4 style="color: #ef4444; font-size: 1.5rem; margin: 0;">${dadosDM.hManut}h ${dadosDM.mManut}m</h4>
                        </div>
                        <div style="text-align: center; border-left: 1px solid rgba(255,255,255,0.1); padding-left: 20px;">
                            <p style="color: #94a3b8; font-size: 0.8rem; text-transform: uppercase; font-weight: bold; margin-bottom: 5px;">Índice DM</p>
                            <h4 style="color: ${corDm}; font-size: 2rem; margin: 0; font-weight: 900;">${dadosDM.percentDM.toFixed(2)}%</h4>
                        </div>
                    </div>

                    <div style="padding: 20px; overflow-y: auto; flex: 1;" class="custom-scrollbar">
                        <table style="width: 100%; border-collapse: collapse; text-align: left;">
                            <thead style="background: rgba(0,0,0,0.3);">
                                <tr>
                                    <th style="padding: 12px; color: #94a3b8; text-transform: uppercase; font-size: 0.8rem; font-weight: bold;">Nº O.S</th>
                                    <th style="padding: 12px; color: #94a3b8; text-transform: uppercase; font-size: 0.8rem; font-weight: bold;">Início Parada</th>
                                    <th style="padding: 12px; color: #94a3b8; text-transform: uppercase; font-size: 0.8rem; font-weight: bold;">Fim Parada</th>
                                    <th style="padding: 12px; color: #94a3b8; text-transform: uppercase; font-size: 0.8rem; font-weight: bold;">Tipo/Classificação</th>
                                    <th style="padding: 12px; color: #94a3b8; text-transform: uppercase; font-size: 0.8rem; font-weight: bold;">Duração</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${htmlLinhas}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        const modalAntigo = document.getElementById('modalDetalhesDMMaquinaSLA');
        if (modalAntigo) modalAntigo.remove();
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // ==========================================
    // BUSCAS INICIAIS E MOTOR DE CÁLCULO
    // ==========================================
    async function garantirDadosManutencaoSLA(filialId) {
        if (!window.ordensServico || window.ordensServico.length === 0 || !window.frotasManutencao || window.frotasManutencao.length === 0) {
            try {
                // Tenta reaproveitar a função nativa do sistema se ela existir
                if (typeof window.carregarDadosOS === 'function') {
                    await window.carregarDadosOS();
                } else {
                    // Fallback com paginação (evita o Erro 500 do Supabase)
                    let todosOsDados = [];
                    let inicio = 0;
                    const tamanhoLote = 1000;
                    let buscarMais = true;
                    
                    while (buscarMais) {
                        let queryOS = client.from('ordens_servico').select('*').range(inicio, inicio + tamanhoLote - 1);
                        if (filialId && filialId !== 'CENTRAL') queryOS = queryOS.eq('filial_id', filialId);
                        
                        const { data: lote, error: err } = await queryOS;
                        if (err) throw err;
                        
                        if (lote && lote.length > 0) {
                            todosOsDados.push(...lote);
                            if (lote.length < tamanhoLote) {
                                buscarMais = false;
                            } else {
                                inicio += tamanhoLote;
                            }
                        } else {
                            buscarMais = false;
                        }
                    }
                    window.ordensServico = todosOsDados.filter(os => os.inativa !== 1 && os.inativa !== true);

                    let qFrota = client.from('frotas_manutencao').select('*');
                    if (filialId && filialId !== 'CENTRAL') qFrota = qFrota.eq('filial_id', filialId);
                    const { data: frotas, error: errF } = await qFrota;
                    if (errF) throw errF;
                    if (frotas) window.frotasManutencao = frotas;
                }
            } catch(e) { console.error("[SLA] Erro ao carregar OS/Frota:", e); }
        }
    }

    async function buscarMetasSLA(ano, filialId) {
        metasSlaAtuais = { id: null, garantia_minima_volume_mensal: 0, meta_viagens_mensal_grua: 0, meta_viagens_diaria_grua: 0, peso_medio_transportado: 0, custo_hora_improdutiva: 0, faturamento_previsto_mensal: 0 };
        if (!filialId) return;

        try {
            const { data } = await client.from('metas_sla')
                .select('*')
                .eq('filial_id', filialId)
                .eq('ano', ano)
                .maybeSingle();

            if (data) {
                metasSlaAtuais = data;
            }
        } catch (e) { console.error("[SLA] Erro metas:", e); }
    }

    async function buscarTarifadorAtivoSLA() {
        try {
            let query = client.from('tarifadores').select('*').eq('ativo', true).limit(1);
            if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
            const { data } = await query;
            if (data && data.length > 0) {
                tarifadorAtivoGlobal = data[0];
            } else {
                tarifadorAtivoGlobal = null;
            }
        } catch(e) { console.error("[SLA] Erro tarifador:", e); }
    }

    async function buscarGruasConfigSLA() {
        try {
            const { data: gruasData } = await client.from('config_gruas').select('codigos, tipo_frente, ordem, frente');
            gruasPropriasCache.clear();
            if (gruasData) {
                gruasData.forEach(g => {
                    const tipo = String(g.tipo_frente || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    if (tipo.includes('PROPRIA') && g.codigos) {
                        g.codigos.split(',').forEach(c => {
                            const cod = c.trim().toUpperCase().replace(/[-\s]/g, '');
                            if (cod && cod !== 'OUTRAS' && cod !== 'OUTROS' && cod !== '0') {
                                gruasPropriasCache.set(cod, {
                                    ordem: g.ordem || 'CX',
                                    frente: g.frente || 'FRENTE DESCONHECIDA',
                                    tipo_frente: g.tipo_frente
                                });
                            }
                        });
                    }
                });
            }
        } catch(e) { console.error("[SLA] Erro gruas:", e); }
    }

    function getInfoGruaSerranaSLA(gruaString) {
        let g = String(gruaString || '').trim().toUpperCase().replace(/[-\s]/g, '');
        if (!g || g === 'NULL' || g === '-') return null;
        if (gruasPropriasCache.has(g)) return gruasPropriasCache.get(g);
        if (g.startsWith('GSR')) return { ordem: 'CX', frente: 'FRENTE SERRANA (GSR)', tipo_frente: 'PROPRIA' };
        return null;
    }

    function calcularTarifaTransporteSLA(asfalto, terra) {
        if (!tarifadorAtivoGlobal || !tarifadorAtivoGlobal.dados) return 0;
        const chaveCache = `${asfalto}_${terra}`;
        if (tarifaCache.has(chaveCache)) return tarifaCache.get(chaveCache);

        let asfaltoVal = typeof asfalto === 'number' ? asfalto : (parseFloat(String(asfalto).replace(',','.')) || 0);
        let terraVal = typeof terra === 'number' ? terra : (parseFloat(String(terra).replace(',','.')) || 0);
        const dadosMatriz = tarifadorAtivoGlobal.dados;
        
        if (dadosMatriz.length === 0) return 0;

        let resultado = 0;
        if (dadosMatriz[0].is_raio || dadosMatriz[0].raio_inicial !== undefined) {
            let distanciaTotal = asfaltoVal + terraVal;
            let distArredondada = Math.round(distanciaTotal * 100) / 100;
            let faixa = dadosMatriz.find(t => distArredondada >= t.raio_inicial && distArredondada <= t.raio_final);
            
            if (!faixa) {
                let ordenados = [...dadosMatriz].sort((a,b) => a.raio_final - b.raio_final);
                faixa = ordenados.find(t => t.raio_final >= distArredondada);
                if(!faixa) faixa = ordenados[ordenados.length - 1]; 
            }
            resultado = faixa ? parseFloat(faixa.tarifa) : 0;
        } else {
            const exato = dadosMatriz.find(t => Math.abs(t.asfalto - asfaltoVal) < 0.001 && Math.abs(t.terra - terraVal) < 0.001);
            if (exato) {
                resultado = exato.tarifa;
            } else {
                let maisProximo = null;
                let menorDistancia = Infinity;
                for (let i = 0; i < dadosMatriz.length; i++) {
                    const da = dadosMatriz[i].asfalto - asfaltoVal;
                    const dt = dadosMatriz[i].terra - terraVal;
                    const distSq = (da * da) + (dt * dt);
                    if (distSq < menorDistancia) {
                        menorDistancia = distSq;
                        maisProximo = dadosMatriz[i];
                    }
                }
                resultado = maisProximo ? maisProximo.tarifa : 0;
            }
        }
        tarifaCache.set(chaveCache, resultado);
        return resultado;
    }

    function extrairMesData(dataStr, anoDesejado) {
        if (!dataStr) return null;
        const str = String(dataStr).trim();
        let dtObj = null;

        if (str.includes('/')) {
            const p = str.split(' ')[0].split('/');
            if (p.length === 3) {
                let y = parseInt(p[2], 10); if (y < 100) y += 2000;
                dtObj = new Date(y, parseInt(p[1], 10) - 1, parseInt(p[0], 10));
            }
        } else if (str.includes('-')) {
            const p2 = str.split('T')[0].split(' ')[0].split('-');
            if (p2.length >= 3) {
                let y = parseInt(p2[0], 10) > 1000 ? parseInt(p2[0], 10) : parseInt(p2[2], 10);
                if (y < 100) y += 2000;
                let m = parseInt(p2[1], 10);
                let d = parseInt(p2[0], 10) > 1000 ? parseInt(p2[2].substring(0, 2), 10) : parseInt(p2[0], 10);
                dtObj = new Date(y, m - 1, d);
            }
        } else {
            dtObj = new Date(str);
        }

        if (dtObj && !isNaN(dtObj.getTime()) && dtObj.getFullYear() == anoDesejado) {
            return {
                mes: dtObj.getMonth(),
                diaKey: `${dtObj.getFullYear()}-${dtObj.getMonth()}-${dtObj.getDate()}`
            };
        }
        return null;
    }

    async function carregarDadosSLA() {
        const btn = document.getElementById('btnProcessarSLA');
        const icon = btn ? btn.querySelector('i') : null;
        const containerGruas = document.getElementById('containerGruasMensal');

        if (icon) icon.classList.add('fa-spin');
        if (containerGruas) {
            containerGruas.className = 'flex flex-col gap-6 pb-8';
            containerGruas.innerHTML = `
                <div class="bg-slate-800/60 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-700/50 p-8 text-center text-slate-400">
                    <i class="fas fa-circle-notch fa-spin text-3xl mb-3 text-sky-500"></i>
                    <p>Extraindo dados anuais, aguarde...</p>
                </div>
            `;
        }
        
        const ano = parseInt(document.getElementById('slaAnoSelect').value, 10);
        const filialId = (window.currentUser && window.currentUser.filial_id) ? parseInt(window.currentUser.filial_id, 10) : null;
        
        const strMinISO = `${ano}-01-01T00:00:00`;
        const strMaxISO = `${ano}-12-31T23:59:59`;

        tarifaCache.clear();
        await buscarMetasSLA(ano, filialId);
        await buscarTarifadorAtivoSLA();
        await buscarGruasConfigSLA();
        await garantirDadosManutencaoSLA(filialId);

        const fm = v => v > 0 ? v.toLocaleString('pt-BR') : '0';
        const fmR = v => v > 0 ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
        
        document.getElementById('lblMetaGarantiaVolume').innerText = `Garantia Mensal: ${fm(metasSlaAtuais.garantia_minima_volume_mensal)} m³`;
        document.getElementById('lblMetaPesoMedio').innerText = `Peso Médio: ${fm(metasSlaAtuais.peso_medio_transportado)} m³/viagem`;
        document.getElementById('lblMetaViagensGrua').innerText = `Meta Grua: ${fm(metasSlaAtuais.meta_viagens_mensal_grua)}/mês | ${fm(metasSlaAtuais.meta_viagens_diaria_grua)}/dia`;
        
        const lblHoraImp = document.getElementById('lblMetaHoraImprodutiva');
        if(lblHoraImp) lblHoraImp.innerText = `Custo Hora Improdutiva: ${fmR(metasSlaAtuais.custo_hora_improdutiva)}`;

        try {
            let dadosFinais = [];

            const { data: rpcJson, error: rpcErr } = await client.rpc('get_producao_agrupada_json', {
                p_filial_id: filialId,
                p_data_inicio: strMinISO,
                p_data_fim: strMaxISO
            });

            if (!rpcErr && Array.isArray(rpcJson)) {
                dadosFinais = rpcJson.map(r => ({
                    dataReferencia: r.d,
                    transportadora: r.tr,
                    grua: r.g,
                    distanciaAsfalto: parseFloat(r.a) || 0,
                    distanciaTerra: parseFloat(r.te) || 0,
                    qtdViagens: parseInt(r.q, 10) || 1,
                    volumeReal: parseFloat(r.v) || 0,
                    valor_cte: parseFloat(r.c) || 0
                }));
            } else {
                let queryCount = client.from('historico_viagens').select('*', { count: 'exact', head: true })
                    .gte('created_at', strMinISO).lte('created_at', strMaxISO);
                if (filialId) queryCount = queryCount.eq('filial_id', filialId);

                const { count } = await queryCount;
                if (count > 0) {
                    const step = 1000;
                    const promises = [];
                    for (let from = 0; from < count; from += step) {
                        let q = client.from('historico_viagens')
                            .select('transportadora, pesoLiquido, volumeReal, distanciaAsfalto, distanciaTerra, grua, created_at, dtFimDescarFabrica, dataDaBaseExcel, valor_cte')
                            .gte('created_at', strMinISO)
                            .lte('created_at', strMaxISO)
                            .range(from, from + step - 1);
                        if (filialId) q = q.eq('filial_id', filialId);
                        promises.push(q);
                    }
                    const responses = await Promise.all(promises);
                    let dadosBrutos = [];
                    responses.forEach(res => { if (res.data) dadosBrutos = dadosBrutos.concat(res.data); });

                    dadosFinais = dadosBrutos.map(r => {
                        const dtFim = r.dtFimDescarFabrica && r.dtFimDescarFabrica !== '-' ? r.dtFimDescarFabrica : null;
                        const dtBase = r.dataDaBaseExcel && r.dataDaBaseExcel !== '-' ? r.dataDaBaseExcel : null;
                        const dStr = dtFim || dtBase || r.created_at;
                        return {
                            dataReferencia: dStr,
                            transportadora: r.transportadora,
                            grua: r.grua,
                            distanciaAsfalto: parseFloat(r.distanciaAsfalto) || 0,
                            distanciaTerra: parseFloat(r.distanciaTerra) || 0,
                            qtdViagens: 1,
                            volumeReal: parseFloat(r.volumeReal) > 0 ? parseFloat(r.volumeReal) : (parseFloat(r.pesoLiquido) || 0),
                            valor_cte: parseFloat(r.valor_cte) || 0
                        };
                    });
                }
            }

            processarSLA(dadosFinais, ano);

        } catch (e) {
            console.error("[SLA] Erro ao buscar dados:", e);
            if (containerGruas) {
                containerGruas.className = 'flex flex-col gap-6 pb-8';
                containerGruas.innerHTML = `
                    <div class="bg-slate-800/60 backdrop-blur-sm rounded-xl shadow-2xl border border-red-500/30 p-8 text-center text-red-400">
                        <i class="fas fa-exclamation-triangle text-3xl mb-3 text-red-500"></i>
                        <p>Erro ao processar dados do ano.</p>
                    </div>
                `;
            }
        } finally {
            if (icon) icon.classList.remove('fa-spin');
        }
    }

    function processarSLA(dados, ano) {
        const mesesDados = Array.from({length: 12}, () => ({
            faturamentoTransp: 0,
            faturamentoCarreg: 0,
            faturamentoTotal: 0,
            volume: 0,
            viagensTransp: 0,
            viagensCarreg: 0
        }));

        const gruasDict = {}; 
        let precoCarregamento = parseFloat(tarifadorAtivoGlobal?.preco_carregamento) || 0;

        dados.forEach(r => {
            const tr = (r.transportadora || '').toUpperCase().trim();
            const isSerrana = tr.includes('SERRANALOG') || tr.includes('SERRANA LOG') || tr.includes('SERRANA');
            const gruaRaw = (r.grua || '').toUpperCase().trim();
            const infoGrua = getInfoGruaSerranaSLA(gruaRaw);
            const isNossaGrua = !!infoGrua;
            
            if (!isSerrana && !isNossaGrua) return;

            const dtInfo = extrairMesData(r.dataReferencia, ano);
            if (!dtInfo) return; 
            
            const mes = dtInfo.mes; 
            const diaKey = dtInfo.diaKey;
            
            const vol = r.volumeReal;
            const qtdViagens = r.qtdViagens;

            if (isSerrana) {
                let recTransporte = 0;
                if (tarifadorAtivoGlobal) {
                    let tarifa = calcularTarifaTransporteSLA(r.distanciaAsfalto, r.distanciaTerra);
                    recTransporte = tarifa * vol;
                } else {
                    recTransporte = r.valor_cte;
                }
                mesesDados[mes].faturamentoTransp += recTransporte;
                mesesDados[mes].faturamentoTotal += recTransporte;
                mesesDados[mes].volume += vol;
                mesesDados[mes].viagensTransp += qtdViagens;
            }

            if (isNossaGrua) {
                let recCarregamento = vol * precoCarregamento;
                mesesDados[mes].faturamentoCarreg += recCarregamento; 
                mesesDados[mes].faturamentoTotal += recCarregamento; 
                mesesDados[mes].viagensCarreg += qtdViagens;
                
                if (!gruasDict[gruaRaw]) gruasDict[gruaRaw] = {};
                if (!gruasDict[gruaRaw][mes]) gruasDict[gruaRaw][mes] = { viagens: 0, volume: 0, diasOperados: new Set() };
                
                gruasDict[gruaRaw][mes].viagens += qtdViagens;
                gruasDict[gruaRaw][mes].volume += vol;
                gruasDict[gruaRaw][mes].diasOperados.add(diaKey);
            }
        });

        renderizarKpis(mesesDados);
        renderizarGraficoEvolucao(mesesDados, ano);
        renderizarTabelaGruas(gruasDict, ano);
    }

    function renderizarKpis(meses) {
        let totalFat = 0, totalFatTransp = 0, totalFatCarreg = 0, totalVol = 0, totalVT = 0, totalVC = 0;
        meses.forEach(m => {
            totalFat += m.faturamentoTotal;
            totalFatTransp += m.faturamentoTransp;
            totalFatCarreg += m.faturamentoCarreg;
            totalVol += m.volume;
            totalVT += m.viagensTransp;
            totalVC += m.viagensCarreg;
        });

        document.getElementById('slaTotalFaturamento').innerText = totalFat.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        const elTransp = document.getElementById('slaFatTransporte');
        if(elTransp) elTransp.innerText = totalFatTransp.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        const elCarreg = document.getElementById('slaFatCarregamento');
        if(elCarreg) elCarreg.innerText = totalFatCarreg.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        const elVol = document.getElementById('slaTotalVolume');
        elVol.innerText = totalVol.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' m³';
        
        if (metasSlaAtuais.garantia_minima_volume_mensal > 0) {
            const metaAnualGarantia = metasSlaAtuais.garantia_minima_volume_mensal * 12;
            elVol.className = totalVol >= metaAnualGarantia ? "text-2xl font-black text-emerald-400 mt-1" : "text-2xl font-black text-red-400 mt-1";
        } else {
            elVol.className = "text-2xl font-black text-white mt-1";
        }

        document.getElementById('slaTotalViagensTransp').innerText = totalVT.toLocaleString('pt-BR');
        document.getElementById('slaTotalViagensCarreg').innerText = totalVC.toLocaleString('pt-BR');
    }

    function renderizarGraficoEvolucao(meses, ano) {
        const dom = document.getElementById('chartSlaEvolucao');
        if (!dom) return;
        
        const dataFaturamento = meses.map(m => m.faturamentoTotal);
        const dataVolume = meses.map(m => m.volume);
        
        const metaFaturamentoArr = meses.map(() => metasSlaAtuais.faturamento_previsto_mensal || 0);

        if (chartSlaObj && !chartSlaObj.isDisposed()) {
            chartSlaObj.dispose();
        }
        chartSlaObj = echarts.init(dom);
        
        chartSlaObj.setOption({
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' },
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                borderColor: 'rgba(51, 65, 85, 0.8)',
                textStyle: { color: '#f8fafc' },
                formatter: function (params) {
                    let html = `<div style="font-weight:bold; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; margin-bottom: 4px;">${params[0].axisValue}</div>`;
                    params.forEach(p => {
                        let isFaturamento = p.seriesName.includes('Faturamento');
                        let valFormatado = isFaturamento 
                            ? p.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            : p.value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' m³';
                        
                        html += `${p.marker} ${p.seriesName}: <b style="color: #fff">${valFormatado}</b><br/>`;
                    });
                    return html;
                }
            },
            legend: {
                data: ['Faturamento Mensal (R$)', 'Meta Faturamento (R$)', 'Volume Transportado (m³)'],
                textStyle: { color: '#94a3b8' },
                top: 0
            },
            grid: { top: 40, right: '5%', bottom: '5%', left: '5%', containLabel: true },
            xAxis: {
                type: 'category',
                data: nomeMeses.map(m => `${m}/${String(ano).slice(2)}`),
                axisLabel: { color: '#94a3b8' },
                axisLine: { lineStyle: { color: '#334155' } }
            },
            yAxis: [
                {
                    type: 'value',
                    name: 'Faturamento',
                    nameTextStyle: { color: '#38bdf8' },
                    axisLabel: { color: '#38bdf8', formatter: (v) => v >= 1000 ? (v/1000)+'k' : v },
                    splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } }
                },
                {
                    type: 'value',
                    name: 'Volume (m³)',
                    nameTextStyle: { color: '#a855f7' },
                    axisLabel: { color: '#a855f7', formatter: (v) => v >= 1000 ? (v/1000)+'k' : v },
                    splitLine: { show: false }
                }
            ],
            series: [
                {
                    name: 'Faturamento Mensal (R$)',
                    type: 'bar',
                    data: dataFaturamento,
                    itemStyle: { color: '#38bdf8', borderRadius: [4, 4, 0, 0] }
                },
                {
                    name: 'Meta Faturamento (R$)',
                    type: 'line',
                    data: metaFaturamentoArr,
                    symbol: 'none',
                    lineStyle: { color: '#fbbf24', width: 3, type: 'dashed' },
                    z: 10
                },
                {
                    name: 'Volume Transportado (m³)',
                    type: 'line',
                    yAxisIndex: 1,
                    data: dataVolume,
                    symbol: 'circle',
                    symbolSize: 8,
                    lineStyle: { width: 3, color: '#a855f7' },
                    itemStyle: { color: '#a855f7' }
                }
            ]
        });
    }

    function renderizarTabelaGruas(gruasDict, ano) {
        const container = document.getElementById('containerGruasMensal');
        if (!container) return;
        
        container.className = 'grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6 pb-8';
        
        let html = '';
        const gruasNomes = Object.keys(gruasDict).sort();
        let possuiAlgumDado = false;

        const metaMensalViagens = metasSlaAtuais.meta_viagens_mensal_grua;
        const metaDiariaViagens = metasSlaAtuais.meta_viagens_diaria_grua;

        for (let mes = 0; mes < 12; mes++) {
            let temGruaNoMes = false;
            let linhasHtml = '';
            
            let totalViagens = 0;
            let totalVolume = 0;
            let maxDias = 0;
            let qtdMaquinasAtivasNoMes = 0; 
            let totalPercentDM = 0;

            gruasNomes.forEach(grua => {
                const stats = gruasDict[grua][mes];
                if (stats && stats.viagens > 0) {
                    temGruaNoMes = true;
                    possuiAlgumDado = true;
                    qtdMaquinasAtivasNoMes++;
                    
                    const dias = stats.diasOperados.size;
                    const mediaVol = dias > 0 ? (stats.volume / dias) : 0;
                    const mediaViagens = dias > 0 ? (stats.viagens / dias) : 0;
                    
                    totalViagens += stats.viagens;
                    totalVolume += stats.volume;
                    if (dias > maxDias) maxDias = dias;

                    let corViagens = "text-slate-300";
                    let iconViagens = "";
                    let badgeViagens = "";
                    
                    if (metaMensalViagens > 0) {
                        let atingiu = stats.viagens >= metaMensalViagens;
                        corViagens = atingiu ? "text-emerald-400" : "text-red-400";
                        iconViagens = atingiu ? '<i class="fas fa-check-circle text-emerald-500 ml-2"></i>' : '<i class="fas fa-times-circle text-red-500 ml-2"></i>';
                        badgeViagens = `onclick="window.mostrarDetalhesMetaSLA('${grua}', '${nomeMeses[mes]}/${ano}', 'Viagens Mensais', '${stats.viagens}', '${metaMensalViagens}')" class="cursor-pointer hover:bg-slate-700/60 p-1.5 rounded transition-all shadow-sm active:scale-95 inline-flex items-center justify-center border border-transparent hover:border-slate-600 w-full" title="Clique para detalhes da meta"`;
                    } else {
                        badgeViagens = `class="p-1.5 w-full inline-flex items-center justify-center"`;
                    }

                    let corMediaViagens = "text-amber-400";
                    let iconMediaViagens = "";
                    let badgeMediaViagens = "";
                    
                    if (metaDiariaViagens > 0) {
                        let atingiu = mediaViagens >= metaDiariaViagens;
                        corMediaViagens = atingiu ? "text-emerald-400" : "text-red-400";
                        iconMediaViagens = atingiu ? '<i class="fas fa-check-circle text-emerald-500 ml-2"></i>' : '<i class="fas fa-times-circle text-red-500 ml-2"></i>';
                        badgeMediaViagens = `onclick="window.mostrarDetalhesMetaSLA('${grua}', '${nomeMeses[mes]}/${ano}', 'Média Diária de Viagens', '${mediaViagens.toFixed(1)}', '${metaDiariaViagens}')" class="cursor-pointer hover:bg-slate-700/60 p-1.5 rounded transition-all shadow-sm active:scale-95 inline-flex items-center justify-center border border-transparent hover:border-slate-600 w-full" title="Clique para detalhes da meta"`;
                    } else {
                        badgeMediaViagens = `class="p-1.5 w-full inline-flex items-center justify-center"`;
                    }

                    const dadosDM = calcularDMMensal(grua, mes, ano);
                    totalPercentDM += dadosDM.percentDM;
                    
                    let corDm = dadosDM.percentDM >= 90 ? 'text-emerald-400' : (dadosDM.percentDM >= 80 ? 'text-amber-400' : 'text-red-400');
                    let badgeDM = `<div onclick="window.abrirModalDetalhesDMMensalSLA('${grua}', ${mes}, ${ano})" class="cursor-pointer hover:bg-slate-700/60 p-1.5 rounded transition-all shadow-sm active:scale-95 inline-flex items-center justify-center border border-transparent hover:border-slate-600 w-full" title="Clique para ver o histórico de paradas da máquina"><span class="${corDm} font-black">${dadosDM.percentDM.toFixed(1)}%</span></div>`;

                    linhasHtml += `
                    <tr class="hover:bg-slate-700/30 transition-colors border-b border-slate-700/50">
                        <td class="px-3 py-2 font-mono text-sky-400 font-bold tracking-widest bg-slate-900/30 whitespace-nowrap">${grua}</td>
                        <td class="px-3 py-2 text-center text-slate-300 font-mono">${dias}</td>
                        <td class="px-3 py-2 text-center ${corViagens} font-black">
                            <div ${badgeViagens}><span>${stats.viagens}</span> ${iconViagens}</div>
                        </td>
                        <td class="px-3 py-2 text-center ${corMediaViagens} font-mono font-bold">
                            <div ${badgeMediaViagens}><span>${mediaViagens.toFixed(1)}</span> ${iconMediaViagens}</div>
                        </td>
                        <td class="px-3 py-2 text-center font-mono">${badgeDM}</td>
                        <td class="px-3 py-2 text-right text-slate-300 font-mono whitespace-nowrap">${stats.volume.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                        <td class="px-3 py-2 text-right text-slate-300 font-mono font-black bg-slate-900/40 whitespace-nowrap">${mediaVol.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                    </tr>`;
                }
            });

            if (temGruaNoMes) {
                let mediaGlobalViagens = 0;
                let mediaGlobalVolume = 0;
                let mediaGeralDM = 0;
                
                if (qtdMaquinasAtivasNoMes > 0) {
                    mediaGeralDM = totalPercentDM / qtdMaquinasAtivasNoMes;
                    if (maxDias > 0) {
                        mediaGlobalViagens = (totalViagens / maxDias) / qtdMaquinasAtivasNoMes;
                        mediaGlobalVolume = (totalVolume / maxDias) / qtdMaquinasAtivasNoMes;
                    }
                }
                
                let corMediaDm = mediaGeralDM >= 90 ? 'text-emerald-400' : (mediaGeralDM >= 80 ? 'text-amber-400' : 'text-red-400');

                linhasHtml += `
                <tr class="bg-slate-900/90 font-bold text-white border-t-2 border-slate-500">
                    <td class="px-3 py-3 text-left uppercase text-[11px] text-slate-400 tracking-wider">Média Frota</td>
                    <td class="px-3 py-3 text-center text-slate-400 font-mono text-xs" title="Máximo de dias operados">${maxDias}</td>
                    <td class="px-3 py-3 text-center text-white font-black">${totalViagens}</td>
                    <td class="px-3 py-3 text-center text-amber-400 font-mono font-bold" title="Média global V/Dia por máquina">${mediaGlobalViagens.toFixed(1)}</td>
                    <td class="px-3 py-3 text-center ${corMediaDm} font-mono font-bold">${mediaGeralDM.toFixed(1)}%</td>
                    <td class="px-3 py-3 text-right text-white font-mono whitespace-nowrap">${totalVolume.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                    <td class="px-3 py-3 text-right text-emerald-400 font-mono font-black bg-emerald-500/10 whitespace-nowrap" title="Média global m³/Dia por máquina">${mediaGlobalVolume.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                </tr>`;

                html += `
                <div class="bg-slate-800/60 backdrop-blur-sm rounded-xl shadow-2xl overflow-hidden border border-slate-700/50 flex flex-col h-full hover:border-slate-500/80 transition-colors">
                    <div class="bg-slate-700/40 px-5 py-3 border-b border-slate-600 flex justify-between items-center">
                        <h3 class="font-bold text-white tracking-wide flex items-center text-sm uppercase">
                            <i class="fas fa-calendar-alt text-amber-400 mr-2"></i> ${nomeMeses[mes]}/${ano}
                        </h3>
                    </div>
                    <div class="overflow-x-auto custom-scrollbar flex-1">
                        <table class="min-w-full text-xs text-left">
                            <thead class="bg-slate-900/80 text-slate-400 font-semibold uppercase text-[9px] tracking-wider border-b border-slate-700 whitespace-nowrap">
                                <tr>
                                    <th class="px-3 py-3">Grua</th>
                                    <th class="px-3 py-3 text-center">Dias</th>
                                    <th class="px-3 py-3 text-center">Viagens</th>
                                    <th class="px-3 py-3 text-center" title="Média de Viagens por Dia">V/Dia</th>
                                    <th class="px-3 py-3 text-center" title="Disponibilidade Mecânica (%)">DM (%)</th>
                                    <th class="px-3 py-3 text-right">Vol (m³)</th>
                                    <th class="px-3 py-3 text-right text-emerald-400 font-bold" title="Média de Volume por Dia">m³/Dia</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-800/80 text-slate-300">
                                ${linhasHtml}
                            </tbody>
                        </table>
                    </div>
                </div>`;
            }
        }

        if (!possuiAlgumDado) {
            container.className = 'flex flex-col gap-6 pb-8';
            html = `
            <div class="bg-slate-800/60 backdrop-blur-sm rounded-xl shadow-2xl overflow-hidden border border-slate-700/50 flex flex-col p-8 text-center text-slate-500">
                <i class="fas fa-box-open text-4xl mb-3 text-slate-600"></i>
                <p>Nenhum dado de grua encontrado para este ano na sua filial.</p>
            </div>`;
        }

        container.innerHTML = html;
    }

    carregarDadosSLA();
};