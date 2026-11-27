window.initSLA = async function() {
    console.log("[SLA] Módulo iniciado (Modo Alta Performance com DM, Indicadores Visuais e Exportação Excel Executiva).");
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

    // Estado consolidado para exportação gerencial em Excel
    let estadoExportacaoSLA = {
        ano: null,
        mesesDados: [],
        gruasDict: {},
        dmDiariaRegistros: [],
        dmDiariaData: null
    };

    const btnProcessar = document.getElementById('btnProcessarSLA');
    if (btnProcessar) {
        // Passa true para forçar o recarregamento dos dados de OS do banco quando clica em Atualizar
        btnProcessar.addEventListener('click', () => carregarDadosSLA(true));
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
            carregarDadosSLA(true); 
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

    // CORREÇÃO DO FUSO HORÁRIO
    function corrigirDataSupabaseLocal(dateStr) {
        if (!dateStr || dateStr === 'null' || dateStr === 'undefined') return null;
        let str = String(dateStr).trim();
        // Remove a letra T se houver, e trunca no ponto de milissegundos ou fuso (+ ou Z)
        if (str.includes('T')) {
            str = str.split('.')[0].split('+')[0].split('Z')[0]; 
        } else {
            str = str.replace(' ', 'T').split('.')[0].split('+')[0].split('Z')[0];
        }
        // Retorna a data no fuso local exato ignorando a conversão UTC (-3h)
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    }

    function calcularDMMensal(placa, mes, ano) {
        const resultDefault = {
            percentDM: 100,
            hTrabalho: 0,
            mTrabalho: 0,
            hManut: 0,
            mManut: 0,
            horasBase: 0,
            horasManut: 0,
            horasDisp: 0,
            htmlLinhas: '',
            listaOS: []
        };
        if (typeof window.ordensServico === 'undefined' || !window.ordensServico) return resultDefault;
        if (typeof window.frotasManutencao === 'undefined' || !window.frotasManutencao) return resultDefault;
        
        const frota = window.frotasManutencao.find(f => f.cavalo === placa);
        if (!frota) return resultDefault;

        let diaInicio = new Date(ano, mes, 1, 0, 0, 0, 0);
        let hoje = new Date();
        let diaFim = new Date(ano, mes + 1, 0, 23, 59, 59, 999);
        
        if (diaFim > hoje) diaFim = hoje; 
        if (diaInicio > hoje) return { ...resultDefault, percentDM: 0 };

        let frotaInicioStr = frota.data_inicial ? frota.data_inicial : '2026-04-01';
        let dtEntradaVeiculo = new Date(frotaInicioStr + 'T00:00:00');
        
        let msValidoVeiculo = 0;
        let overlapDispInicio = dtEntradaVeiculo > diaInicio ? dtEntradaVeiculo : diaInicio;
        if (overlapDispInicio < diaFim) {
            msValidoVeiculo = (diaFim - overlapDispInicio);
        }
        
        let horasValidoVeiculo = msValidoVeiculo / (1000 * 60 * 60);
        if (horasValidoVeiculo <= 0) return { ...resultDefault, percentDM: 0 };

        const todasOS = window.ordensServico.filter(o => o.placa === placa && o.status !== 'Agendada' && o.tipo !== 'Cavalo Disponível S/ Carreta');
        
        let htmlLinhas = '';
        let intervalos = [];
        let listaOS = [];

        todasOS.forEach(os => {
            const osInicio = corrigirDataSupabaseLocal(os.data_abertura);
            if (!osInicio) return;
            
            let osFim = os.data_conclusao ? corrigirDataSupabaseLocal(os.data_conclusao) : hoje;
            
            let inicioValido = osInicio > dtEntradaVeiculo ? osInicio : dtEntradaVeiculo;
            const overlapInicio = inicioValido > diaInicio ? inicioValido : diaInicio;
            const overlapFim = osFim < diaFim ? osFim : diaFim;

            if (overlapInicio < overlapFim) {
                let duracaoMs = overlapFim - overlapInicio;
                let duracaoHoras = duracaoMs / (1000 * 60 * 60);
                let h = Math.floor(duracaoMs / (1000 * 60 * 60));
                let m = Math.round((duracaoMs - (h * 1000 * 60 * 60)) / (1000 * 60));

                let dtIniStr = `${String(overlapInicio.getDate()).padStart(2,'0')}/${String(overlapInicio.getMonth()+1).padStart(2,'0')} ${String(overlapInicio.getHours()).padStart(2,'0')}:${String(overlapInicio.getMinutes()).padStart(2,'0')}`;
                let dtFimStr = os.data_conclusao ? `${String(overlapFim.getDate()).padStart(2,'0')}/${String(overlapFim.getMonth()+1).padStart(2,'0')} ${String(overlapFim.getHours()).padStart(2,'0')}:${String(overlapFim.getMinutes()).padStart(2,'0')}` : 'Em Andamento';

                intervalos.push([overlapInicio.getTime(), overlapFim.getTime()]);

                let descRaw = (os.problema || os.observacoes || os.descricao || 'Sem descrição.');
                let desc = descRaw.replace(/"/g, '&quot;');

                listaOS.push({
                    numero_os: `#${os.numero_os || os.id}`,
                    dtIniStr,
                    dtFimStr,
                    tipo: os.tipo || 'Manutenção',
                    descricao: descRaw,
                    duracaoHoras,
                    duracaoFormatada: `${h}h ${m}m`
                });

                htmlLinhas += `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.1);">
                        <td style="padding: 12px; text-align: center; width: 40px;">
                            <input type="checkbox" class="chk-soma-os cursor-pointer" data-ms="${duracaoMs}" onchange="window.calcularSomaOSModalSLA()" style="width: 16px; height: 16px; accent-color: #3b82f6;">
                        </td>
                        <td style="padding: 12px; color: #fff; font-weight: bold; white-space: nowrap;">#${os.numero_os || os.id}</td>
                        <td style="padding: 12px; color: #94a3b8; white-space: nowrap;">${dtIniStr}</td>
                        <td style="padding: 12px; color: #94a3b8; white-space: nowrap;">${dtFimStr}</td>
                        <td style="padding: 12px; color: #3b82f6; white-space: nowrap;">${os.tipo || 'Manutenção'}</td>
                        <td style="padding: 12px; color: #cbd5e1; font-size: 0.85rem; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${desc}">${desc}</td>
                        <td style="padding: 12px; color: #ef4444; font-weight: bold; white-space: nowrap;">${h}h ${m}m</td>
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

        return {
            percentDM,
            hTrabalho,
            mTrabalho,
            hManut,
            mManut,
            horasBase: horasValidoVeiculo,
            horasManut: tempoManutencaoTotalHoras,
            horasDisp: horasDisponivel,
            htmlLinhas,
            listaOS
        };
    }

    // Lógica para soma de checkboxes no modal
    window.calcularSomaOSModalSLA = function() {
        const checkboxes = document.querySelectorAll('.chk-soma-os:checked');
        let totalMs = 0;
        checkboxes.forEach(chk => {
            totalMs += parseInt(chk.getAttribute('data-ms') || '0', 10);
        });
        let h = Math.floor(totalMs / (1000 * 60 * 60));
        let m = Math.round((totalMs - (h * 1000 * 60 * 60)) / (1000 * 60));
        const el = document.getElementById('somaSelecionadaOS');
        if(el) {
            if (totalMs === 0) el.innerHTML = '0h 0m';
            else el.innerHTML = `${h}h ${m}m`;
        }
    };

    window.toggleAllOSModalSLA = function(masterChk) {
        const checkboxes = document.querySelectorAll('.chk-soma-os');
        checkboxes.forEach(chk => chk.checked = masterChk.checked);
        window.calcularSomaOSModalSLA();
    };

    window.abrirModalDetalhesDMMensalSLA = function(placa, mes, ano) {
        if (!window.ordensServico || !window.frotasManutencao) {
            Swal.fire('Atenção', 'Dados de manutenção não carregados ainda no sistema. Aguarde alguns segundos.', 'warning');
            return;
        }
        
        const dadosDM = calcularDMMensal(placa, mes, ano);
        if (!dadosDM) return;
        
        const periodoTxt = `${nomeMesesExtenso[mes]} de ${ano}`;
        let corDm = dadosDM.percentDM >= 90 ? '#10b981' : (dadosDM.percentDM >= 80 ? '#f59e0b' : '#ef4444');
        let htmlLinhas = dadosDM.htmlLinhas || '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #94a3b8;">Nenhuma parada registrada no período.</td></tr>';
        
        const modalHtml = `
            <div id="modalDetalhesDMMaquinaSLA" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); z-index: 9999; display: flex; align-items: center; justify-content: center;">
                <div style="background: #1e293b; border: 1px solid #3b82f6; border-radius: 12px; width: 95%; max-width: 1200px; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                    
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
                                    <th style="padding: 12px; text-align: center; width: 40px;">
                                        <input type="checkbox" id="chkAllOS" onchange="window.toggleAllOSModalSLA(this)" style="cursor: pointer; width: 16px; height: 16px; accent-color: #3b82f6;">
                                    </th>
                                    <th style="padding: 12px; color: #94a3b8; text-transform: uppercase; font-size: 0.8rem; font-weight: bold; white-space: nowrap;">Nº O.S</th>
                                    <th style="padding: 12px; color: #94a3b8; text-transform: uppercase; font-size: 0.8rem; font-weight: bold; white-space: nowrap;">Início Parada</th>
                                    <th style="padding: 12px; color: #94a3b8; text-transform: uppercase; font-size: 0.8rem; font-weight: bold; white-space: nowrap;">Fim Parada</th>
                                    <th style="padding: 12px; color: #94a3b8; text-transform: uppercase; font-size: 0.8rem; font-weight: bold; white-space: nowrap;">Tipo/Classificação</th>
                                    <th style="padding: 12px; color: #94a3b8; text-transform: uppercase; font-size: 0.8rem; font-weight: bold; white-space: nowrap;">Descrição do Problema</th>
                                    <th style="padding: 12px; color: #94a3b8; text-transform: uppercase; font-size: 0.8rem; font-weight: bold; white-space: nowrap;">Duração</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${htmlLinhas}
                            </tbody>
                        </table>
                    </div>
                    
                    <div style="padding: 15px 20px; background: rgba(15, 23, 42, 0.95); border-top: 1px solid rgba(255,255,255,0.1); border-radius: 0 0 12px 12px; display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-calculator text-sky-500 text-2xl"></i>
                            <span style="color: #94a3b8; font-weight: bold; text-transform: uppercase; font-size: 0.9rem; letter-spacing: 1px;">Soma Selecionada:</span>
                        </div>
                        <span id="somaSelecionadaOS" style="color: #3b82f6; font-size: 1.6rem; font-weight: 900; font-family: monospace; background: rgba(59, 130, 246, 0.1); padding: 4px 12px; border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3);">0h 0m</span>
                    </div>

                </div>
            </div>
        `;

        const modalAntigo = document.getElementById('modalDetalhesDMMaquinaSLA');
        if (modalAntigo) modalAntigo.remove();
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    };

    // Adicionado parâmetro 'force' para obrigar a recarregar as OSs atualizadas do Supabase
    async function garantirDadosManutencaoSLA(filialId, force = false) {
        if (force || !window.ordensServico || window.ordensServico.length === 0 || !window.frotasManutencao || window.frotasManutencao.length === 0) {
            try {
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

    async function carregarDadosSLA(forceRefreshOS = false) {
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
        
        // Passa o parâmetro 'forceRefreshOS' para obrigar a recarregar as OS se o usuário clicou no botão "Atualizar"
        await garantirDadosManutencaoSLA(filialId, forceRefreshOS);

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
            window.consultarDMDiariaSLA(); // Recalcula a tabela de consulta diária caso exista data selecionada

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

    // NOVA FUNÇÃO: CONSULTA DIÁRIA DE DM
    window.consultarDMDiariaSLA = async function() {
        const inputData = document.getElementById('inputSlaDataDiaria').value;
        const tbody = document.getElementById('tbodyDMDiariaSLA');
        
        if (!inputData) {
            estadoExportacaoSLA.dmDiariaRegistros = [];
            estadoExportacaoSLA.dmDiariaData = null;
            return;
        }

        if (!window.ordensServico || !window.frotasManutencao) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-6 text-amber-500 font-bold">Dados de manutenção não carregados. Clique em Atualizar no topo da tela.</td></tr>';
            return;
        }

        const [ano, mes, dia] = inputData.split('-');
        const diaInicio = new Date(ano, mes - 1, dia, 0, 0, 0);
        const diaFim = new Date(ano, mes - 1, dia, 23, 59, 59, 999);
        const hoje = new Date();

        let fimParaCalculo = diaFim;

        if (diaInicio.toDateString() === hoje.toDateString()) {
            fimParaCalculo = hoje;
        } else if (diaInicio > hoje) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-6 text-slate-500">A data selecionada é no futuro. Nenhuma operação registrada.</td></tr>';
            estadoExportacaoSLA.dmDiariaRegistros = [];
            estadoExportacaoSLA.dmDiariaData = null;
            return;
        }

        let html = '';
        const registrosDiarios = [];
        const frotasValidas = window.frotasManutencao.filter(f => f.status === 'Ativo' && (f.categoria === 'TRITREM' || f.categoria === 'GRUA'));

        frotasValidas.forEach(frota => {
            const placa = frota.cavalo;
            let frotaInicioStr = frota.data_inicial ? frota.data_inicial : '2026-04-01';
            let dtEntradaVeiculo = new Date(frotaInicioStr + 'T00:00:00');

            let overlapDispInicio = dtEntradaVeiculo > diaInicio ? dtEntradaVeiculo : diaInicio;
            let msValidoVeiculo = 0;
            if (overlapDispInicio < fimParaCalculo) {
                msValidoVeiculo = (fimParaCalculo - overlapDispInicio);
            }
            
            let horasValidoVeiculo = msValidoVeiculo / (1000 * 60 * 60);
            if (horasValidoVeiculo <= 0) return;

            const todasOS = window.ordensServico.filter(o => o.placa === placa && o.status !== 'Agendada' && o.tipo !== 'Cavalo Disponível S/ Carreta');
            let intervalos = [];
            let osDetalhesHTML = '';
            let osDetalhesTexto = [];

            todasOS.forEach(os => {
                const osInicio = corrigirDataSupabaseLocal(os.data_abertura);
                if (!osInicio) return;
                
                let osFim = os.data_conclusao ? corrigirDataSupabaseLocal(os.data_conclusao) : hoje;
                
                let inicioValido = osInicio > dtEntradaVeiculo ? osInicio : dtEntradaVeiculo;
                const overlapInicio = inicioValido > diaInicio ? inicioValido : diaInicio;
                const overlapFim = osFim < diaFim ? osFim : diaFim;

                if (overlapInicio < overlapFim) {
                    intervalos.push([overlapInicio.getTime(), overlapFim.getTime()]);
                    
                    let dtIniOS = `${String(osInicio.getDate()).padStart(2,'0')}/${String(osInicio.getMonth()+1).padStart(2,'0')} ${String(osInicio.getHours()).padStart(2,'0')}:${String(osInicio.getMinutes()).padStart(2,'0')}`;
                    let dtFimOS = os.data_conclusao ? `${String(osFim.getDate()).padStart(2,'0')}/${String(osFim.getMonth()+1).padStart(2,'0')} ${String(osFim.getHours()).padStart(2,'0')}:${String(osFim.getMinutes()).padStart(2,'0')}` : 'Em Andamento';

                    let duracaoMs = overlapFim - overlapInicio;
                    let hOS = Math.floor(duracaoMs / (1000 * 60 * 60));
                    let mOS = Math.round((duracaoMs - (hOS * 1000 * 60 * 60)) / (1000 * 60));

                    osDetalhesTexto.push(`#${os.numero_os || os.id} | ${os.tipo || 'Manutenção'} | ${dtIniOS} até ${dtFimOS} (${hOS}h ${mOS}m)`);

                    osDetalhesHTML += `<div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 4px 8px; border-radius: 4px; margin-bottom: 4px; font-size: 0.75rem;">
                        <span class="text-rose-400 font-bold">#${os.numero_os || os.id}</span> | ${os.tipo || 'Manutenção'} | ${dtIniOS} até ${dtFimOS} <span class="text-amber-400 font-bold ml-1">(${hOS}h ${mOS}m)</span>
                    </div>`;
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
            let hDisp = Math.floor(horasDisponivel);
            let mDisp = Math.round((horasDisponivel - hDisp) * 60);

            registrosDiarios.push({
                placa,
                categoria: frota.categoria,
                tempoBaseFmt: `${hTrabalho}h ${mTrabalho}m`,
                tempoManutFmt: `${hManut}h ${mManut}m`,
                tempoDispFmt: `${hDisp}h ${mDisp}m`,
                horasBase: horasValidoVeiculo,
                horasManut: tempoManutencaoTotalHoras,
                horasDisp: horasDisponivel,
                percentDM,
                detalhes: osDetalhesTexto.length > 0 ? osDetalhesTexto.join(' ; ') : '100% Disponível (Sem paradas)'
            });

            let corDm = percentDM >= 90 ? 'text-emerald-400' : (percentDM >= 80 ? 'text-amber-400' : 'text-rose-400');

            if (!osDetalhesHTML) osDetalhesHTML = '<span class="text-slate-500 text-xs italic">Nenhuma parada registrada. Equipamento 100% disponível no dia.</span>';

            html += `
                <tr class="hover:bg-slate-700/30 transition-colors border-b border-slate-700/50">
                    <td class="px-4 py-3 font-mono font-bold text-sky-400">${placa}</td>
                    <td class="px-4 py-3 text-center text-slate-400 text-[10px] uppercase font-bold tracking-widest">${frota.categoria}</td>
                    <td class="px-4 py-3 text-center text-slate-300 font-mono">${hTrabalho}h ${mTrabalho}m</td>
                    <td class="px-4 py-3 text-center text-rose-400 font-bold font-mono">${hManut}h ${mManut}m</td>
                    <td class="px-4 py-3 text-center text-emerald-400 font-bold font-mono">${hDisp}h ${mDisp}m</td>
                    <td class="px-4 py-3 text-center ${corDm} font-black font-mono text-base">${percentDM.toFixed(1)}%</td>
                    <td class="px-4 py-2">${osDetalhesHTML}</td>
                </tr>
            `;
        });

        estadoExportacaoSLA.dmDiariaRegistros = registrosDiarios;
        estadoExportacaoSLA.dmDiariaData = `${dia}/${mes}/${ano}`;

        if (!html) {
            html = '<tr><td colspan="7" class="text-center py-6 text-slate-500">Nenhum equipamento ativo encontrado para a data.</td></tr>';
        }

        tbody.innerHTML = html;
    };

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

        // Armazena no estado global do módulo para exportação Excel instantânea
        estadoExportacaoSLA.ano = ano;
        estadoExportacaoSLA.mesesDados = mesesDados;
        estadoExportacaoSLA.gruasDict = gruasDict;

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
        
        container.className = 'grid grid-cols-1 xl:grid-cols-2 gap-6 pb-8';
        
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
                        <td class="px-2 py-2 font-mono text-sky-400 font-bold tracking-widest bg-slate-900/30 whitespace-nowrap">${grua}</td>
                        <td class="px-2 py-2 text-center text-slate-300 font-mono">${dias}</td>
                        <td class="px-2 py-2 text-center ${corViagens} font-black">
                            <div ${badgeViagens}><span>${stats.viagens}</span> ${iconViagens}</div>
                        </td>
                        <td class="px-2 py-2 text-center ${corMediaViagens} font-mono font-bold">
                            <div ${badgeMediaViagens}><span>${mediaViagens.toFixed(1)}</span> ${iconMediaViagens}</div>
                        </td>
                        <td class="px-2 py-2 text-center font-mono">${badgeDM}</td>
                        <td class="px-2 py-2 text-right text-slate-300 font-mono whitespace-nowrap">${stats.volume.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                        <td class="px-2 py-2 text-right text-slate-300 font-mono font-black bg-slate-900/40 whitespace-nowrap">${mediaVol.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
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
                    <td class="px-2 py-2 text-left uppercase text-[11px] text-slate-400 tracking-wider">Média Frota</td>
                    <td class="px-2 py-2 text-center text-slate-400 font-mono text-xs" title="Máximo de dias operados">${maxDias}</td>
                    <td class="px-2 py-2 text-center text-white font-black">${totalViagens}</td>
                    <td class="px-2 py-2 text-center text-amber-400 font-mono font-bold" title="Média global V/Dia por máquina">${mediaGlobalViagens.toFixed(1)}</td>
                    <td class="px-2 py-2 text-center ${corMediaDm} font-mono font-bold">${mediaGeralDM.toFixed(1)}%</td>
                    <td class="px-2 py-2 text-right text-white font-mono whitespace-nowrap">${totalVolume.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                    <td class="px-2 py-2 text-right text-emerald-400 font-mono font-black bg-emerald-500/10 whitespace-nowrap" title="Média global m³/Dia por máquina">${mediaGlobalVolume.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
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
                                    <th class="px-2 py-2">Grua</th>
                                    <th class="px-2 py-2 text-center">Dias</th>
                                    <th class="px-2 py-2 text-center">Viagens</th>
                                    <th class="px-2 py-2 text-center" title="Média de Viagens por Dia">V/Dia</th>
                                    <th class="px-2 py-2 text-center" title="Disponibilidade Mecânica (%)">DM (%)</th>
                                    <th class="px-2 py-2 text-right">Vol (m³)</th>
                                    <th class="px-2 py-2 text-right text-emerald-400 font-bold" title="Média de Volume por Dia">m³/Dia</th>
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

    // =========================================================================
    // EXPORTAÇÃO EXECUTIVA PARA EXCEL (ExcelJS - FORMATADO, TABULADO E CENTRALIZADO)
    // =========================================================================
    function carregarExcelJS() {
        return new Promise((resolve, reject) => {
            if (window.ExcelJS) return resolve(window.ExcelJS);
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
            script.onload = () => {
                if (window.ExcelJS) resolve(window.ExcelJS);
                else reject(new Error('ExcelJS não inicializado após carregamento.'));
            };
            script.onerror = () => reject(new Error('Falha ao carregar biblioteca ExcelJS via CDN.'));
            document.head.appendChild(script);
        });
    }

    window.exportarExcelSLA = async function() {
        const btn = document.getElementById('btnExportarExcelSLA');
        const originalHtml = btn ? btn.innerHTML : '';

        if (!estadoExportacaoSLA.ano || !estadoExportacaoSLA.mesesDados || estadoExportacaoSLA.mesesDados.length === 0) {
            Swal.fire('Atenção', 'Os dados do SLA ainda estão sendo carregados. Aguarde ou clique em Atualizar.', 'warning');
            return;
        }

        try {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando Excel...';
            }

            const ExcelJS = await carregarExcelJS();
            const wb = new ExcelJS.Workbook();
            wb.creator = 'Sistema de Gestão Florestal - Serrana Florestal';
            wb.created = new Date();
            wb.modified = new Date();

            const ano = estadoExportacaoSLA.ano;
            const mesesDados = estadoExportacaoSLA.mesesDados;
            const gruasDict = estadoExportacaoSLA.gruasDict;
            const gruasNomes = Object.keys(gruasDict).sort();
            const metaFatMensal = parseFloat(metasSlaAtuais.faturamento_previsto_mensal) || 0;
            const metaGarantiaVol = parseFloat(metasSlaAtuais.garantia_minima_volume_mensal) || 0;
            const metaMensalGrua = parseFloat(metasSlaAtuais.meta_viagens_mensal_grua) || 0;
            const metaDiariaGrua = parseFloat(metasSlaAtuais.meta_viagens_diaria_grua) || 0;
            const metaPesoMedio = parseFloat(metasSlaAtuais.peso_medio_transportado) || 0;
            const custoHoraImp = parseFloat(metasSlaAtuais.custo_hora_improdutiva) || 0;

            const filialLabel = (window.currentUser && (window.currentUser.filial_nome || window.currentUser.filial_id))
                ? `Filial: ${window.currentUser.filial_nome || 'ID ' + window.currentUser.filial_id}`
                : 'Filial: Geral';
            const dataEmissao = new Date().toLocaleString('pt-BR');

            // Paleta Executiva
            const CORES = {
                navyEscuro: 'FF0F172A',
                navyMedio: 'FF1E293B',
                azulCorp: 'FF1E3A5F',
                azulDestaque: 'FF0284C7',
                cinzaZebra: 'FFF8FAFC',
                cinzaTotal: 'FFE2E8F0',
                bordaSuave: 'FFCBD5E1',
                bordaEscura: 'FF334155',
                branco: 'FFFFFFFF',
                textoEscuro: 'FF0F172A',
                textoSuave: 'FF475569',
                verdeFundo: 'FFDCFCE7',
                verdeTexto: 'FF166534',
                ambarFundo: 'FFFEF3C7',
                ambarTexto: 'FF92400E',
                vermelhoFundo: 'FFFEE2E2',
                vermelhoTexto: 'FF991B1B'
            };

            const bordaPadrao = {
                top: { style: 'thin', color: { argb: CORES.bordaSuave } },
                left: { style: 'thin', color: { argb: CORES.bordaSuave } },
                bottom: { style: 'thin', color: { argb: CORES.bordaSuave } },
                right: { style: 'thin', color: { argb: CORES.bordaSuave } }
            };

            const bordaTotal = {
                top: { style: 'medium', color: { argb: CORES.bordaEscura } },
                left: { style: 'thin', color: { argb: CORES.bordaSuave } },
                bottom: { style: 'double', color: { argb: CORES.bordaEscura } },
                right: { style: 'thin', color: { argb: CORES.bordaSuave } }
            };

            const alinharCentro = { vertical: 'middle', horizontal: 'center', wrapText: true };

            const aplicarEstiloBanner = (ws, totalCols, titulo, subtitulo) => {
                ws.mergeCells(1, 1, 1, totalCols);
                const c1 = ws.getCell(1, 1);
                c1.value = titulo;
                c1.font = { name: 'Calibri', size: 15, bold: true, color: { argb: CORES.branco } };
                c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.navyEscuro } };
                c1.alignment = { vertical: 'middle', horizontal: 'center' };
                ws.getRow(1).height = 32;

                ws.mergeCells(2, 1, 2, totalCols);
                const c2 = ws.getCell(2, 1);
                c2.value = subtitulo;
                c2.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FFCBD5E1' } };
                c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.navyMedio } };
                c2.alignment = { vertical: 'middle', horizontal: 'center' };
                ws.getRow(2).height = 22;
            };

            const aplicarEstiloHeaderTabela = (row, colCount) => {
                row.height = 28;
                for (let c = 1; c <= colCount; c++) {
                    const cell = row.getCell(c);
                    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: CORES.branco } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.azulCorp } };
                    cell.alignment = alinharCentro;
                    cell.border = {
                        top: { style: 'medium', color: { argb: CORES.navyEscuro } },
                        left: { style: 'thin', color: { argb: 'FF334155' } },
                        bottom: { style: 'medium', color: { argb: CORES.navyEscuro } },
                        right: { style: 'thin', color: { argb: 'FF334155' } }
                    };
                }
            };

            const aplicarCorDM = (cell, percentDM) => {
                if (percentDM >= 90) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.verdeFundo } };
                    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: CORES.verdeTexto } };
                } else if (percentDM >= 80) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.ambarFundo } };
                    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: CORES.ambarTexto } };
                } else {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.vermelhoFundo } };
                    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: CORES.vermelhoTexto } };
                }
            };

            const aplicarCorMeta = (cell, atingiu) => {
                if (atingiu) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.verdeFundo } };
                    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: CORES.verdeTexto } };
                } else {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.vermelhoFundo } };
                    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: CORES.vermelhoTexto } };
                }
            };

            // Pré-cálculo consolidado de Gruas, DM mensal e lista de O.S.
            const dmMedioPorMes = Array(12).fill(null);
            const resumoAnualGruas = {};
            const todasOSAnuais = [];

            for (let mes = 0; mes < 12; mes++) {
                let somaDM = 0;
                let qtdGruasMes = 0;

                gruasNomes.forEach(grua => {
                    const stats = gruasDict[grua][mes];
                    if (stats && stats.viagens > 0) {
                        const dadosDM = calcularDMMensal(grua, mes, ano);
                        somaDM += dadosDM.percentDM;
                        qtdGruasMes++;

                        if (!resumoAnualGruas[grua]) {
                            resumoAnualGruas[grua] = {
                                mesesAtivos: 0,
                                dias: 0,
                                viagens: 0,
                                volume: 0,
                                horasBase: 0,
                                horasManut: 0,
                                horasDisp: 0,
                                somaDM: 0
                            };
                        }
                        resumoAnualGruas[grua].mesesAtivos++;
                        resumoAnualGruas[grua].dias += stats.diasOperados.size;
                        resumoAnualGruas[grua].viagens += stats.viagens;
                        resumoAnualGruas[grua].volume += stats.volume;
                        resumoAnualGruas[grua].horasBase += dadosDM.horasBase;
                        resumoAnualGruas[grua].horasManut += dadosDM.horasManut;
                        resumoAnualGruas[grua].horasDisp += dadosDM.horasDisp;
                        resumoAnualGruas[grua].somaDM += dadosDM.percentDM;

                        if (dadosDM.listaOS && dadosDM.listaOS.length > 0) {
                            dadosDM.listaOS.forEach(os => {
                                todasOSAnuais.push({
                                    mesIdx: mes,
                                    periodo: `${nomeMeses[mes]}/${ano}`,
                                    grua,
                                    ...os
                                });
                            });
                        }
                    }
                });

                if (qtdGruasMes > 0) {
                    dmMedioPorMes[mes] = somaDM / qtdGruasMes;
                }
            }

            // =================================================================
            // ABA 1: RESUMO EXECUTIVO & EVOLUÇÃO ANUAL (MÊS A MÊS)
            // =================================================================
            const ws1 = wb.addWorksheet('Resumo e Evolução Anual', {
                views: [{ state: 'frozen', ySplit: 12 }],
                pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
            });

            aplicarEstiloBanner(
                ws1,
                13,
                `SERRANA FLORESTAL — RELATÓRIO GERENCIAL SLA (${ano})`,
                `Evolução Anual Mês a Mês, Metas Contratuais, Produção e DM | ${filialLabel} | Emitido em: ${dataEmissao}`
            );

            // Totais para bloco de KPIs
            let totFatTransp = 0, totFatCarreg = 0, totFat = 0, totVol = 0, totVT = 0, totVC = 0;
            mesesDados.forEach(m => {
                totFatTransp += m.faturamentoTransp;
                totFatCarreg += m.faturamentoCarreg;
                totFat += m.faturamentoTotal;
                totVol += m.volume;
                totVT += m.viagensTransp;
                totVC += m.viagensCarreg;
            });
            const pesoMedioAnual = totVT > 0 ? (totVol / totVT) : 0;

            ws1.getRow(3).height = 10;

            // Bloco Superior: KPIs Consolidados (Linha 4 a 6) + Metas Contratuais (Linha 7 a 9)
            ws1.mergeCells('A4:M4');
            const secKpi = ws1.getCell('A4');
            secKpi.value = 'INDICADORES CONSOLIDADOS DO EXERCÍCIO & PARÂMETROS DE CONTRATO SLA';
            secKpi.font = { name: 'Calibri', size: 11, bold: true, color: { argb: CORES.branco } };
            secKpi.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.azulDestaque } };
            secKpi.alignment = alinharCentro;
            ws1.getRow(4).height = 24;

            const kpiLabels = [
                { range: 'A5:B5', valRange: 'A6:B6', label: 'FATURAMENTO TOTAL', val: totFat, fmt: '"R$ "#,##0.00' },
                { range: 'C5:D5', valRange: 'C6:D6', label: 'FAT. TRANSPORTE', val: totFatTransp, fmt: '"R$ "#,##0.00' },
                { range: 'E5:F5', valRange: 'E6:F6', label: 'FAT. CARREGAMENTO', val: totFatCarreg, fmt: '"R$ "#,##0.00' },
                { range: 'G5:H5', valRange: 'G6:H6', label: 'VOLUME ANUAL (m³)', val: totVol, fmt: '#,##0.0" m³"' },
                { range: 'I5:J5', valRange: 'I6:J6', label: 'VIAGENS TRANSPORTE', val: totVT, fmt: '#,##0' },
                { range: 'K5:L5', valRange: 'K6:L6', label: 'VIAGENS CARREGAMENTO', val: totVC, fmt: '#,##0' },
                { range: 'M5:M5', valRange: 'M6:M6', label: 'PESO MÉDIO REAL', val: pesoMedioAnual, fmt: '#,##0.00" m³"' }
            ];

            ws1.getRow(5).height = 20;
            ws1.getRow(6).height = 26;
            kpiLabels.forEach(k => {
                if (k.range !== 'M5:M5') ws1.mergeCells(k.range);
                if (k.valRange !== 'M6:M6') ws1.mergeCells(k.valRange);
                const cLbl = ws1.getCell(k.range.split(':')[0]);
                cLbl.value = k.label;
                cLbl.font = { name: 'Calibri', size: 9, bold: true, color: { argb: CORES.textoSuave } };
                cLbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.cinzaTotal } };
                cLbl.alignment = alinharCentro;
                cLbl.border = bordaPadrao;

                const cVal = ws1.getCell(k.valRange.split(':')[0]);
                cVal.value = k.val;
                cVal.numFmt = k.fmt;
                cVal.font = { name: 'Calibri', size: 12, bold: true, color: { argb: CORES.navyEscuro } };
                cVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.branco } };
                cVal.alignment = alinharCentro;
                cVal.border = bordaPadrao;
            });

            // Linha 7 e 8: Parâmetros SLA
            const metaLabels = [
                { range: 'A7:B7', valRange: 'A8:B8', label: 'META FATURAMENTO / MÊS', val: metaFatMensal, fmt: '"R$ "#,##0.00' },
                { range: 'C7:D7', valRange: 'C8:D8', label: 'GARANTIA VOL. / MÊS', val: metaGarantiaVol, fmt: '#,##0.0" m³"' },
                { range: 'E7:F7', valRange: 'E8:F8', label: 'META MENSAL GRUA', val: metaMensalGrua, fmt: '#,##0" cargas"' },
                { range: 'G7:H7', valRange: 'G8:H8', label: 'META DIÁRIA GRUA', val: metaDiariaGrua, fmt: '#,##0" cargas"' },
                { range: 'I7:J7', valRange: 'I8:J8', label: 'PESO MÉDIO CONTRATO', val: metaPesoMedio, fmt: '#,##0.00" m³"' },
                { range: 'K7:M7', valRange: 'K8:M8', label: 'CUSTO HORA IMPRODUTIVA', val: custoHoraImp, fmt: '"R$ "#,##0.00' }
            ];

            ws1.getRow(7).height = 20;
            ws1.getRow(8).height = 24;
            metaLabels.forEach(m => {
                ws1.mergeCells(m.range);
                ws1.mergeCells(m.valRange);
                const cLbl = ws1.getCell(m.range.split(':')[0]);
                cLbl.value = m.label;
                cLbl.font = { name: 'Calibri', size: 9, bold: true, color: { argb: CORES.ambarTexto } };
                cLbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.ambarFundo } };
                cLbl.alignment = alinharCentro;
                cLbl.border = bordaPadrao;

                const cVal = ws1.getCell(m.valRange.split(':')[0]);
                cVal.value = m.val;
                cVal.numFmt = m.fmt;
                cVal.font = { name: 'Calibri', size: 11, bold: true, color: { argb: CORES.textoEscuro } };
                cVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.cinzaZebra } };
                cVal.alignment = alinharCentro;
                cVal.border = bordaPadrao;
            });

            ws1.getRow(9).height = 12;

            // Título da Tabela de Evolução Anual
            ws1.mergeCells('A10:M10');
            const secEvol = ws1.getCell('A10');
            secEvol.value = `EVOLUÇÃO ANUAL — MÊS A MÊS (${ano})`;
            secEvol.font = { name: 'Calibri', size: 11, bold: true, color: { argb: CORES.branco } };
            secEvol.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.navyMedio } };
            secEvol.alignment = alinharCentro;
            ws1.getRow(10).height = 24;

            ws1.getRow(11).height = 6;

            // Cabeçalho da Tabela (Linha 12)
            const headersEvol = [
                'Mês / Ano',
                'Fat. Transporte (R$)',
                'Fat. Carregamento (R$)',
                'Faturamento Total (R$)',
                'Meta Faturamento (R$)',
                'Ating. Fat. (%)',
                'Volume Real (m³)',
                'Garantia Mín. (m³)',
                'Ating. Vol. (%)',
                'Viagens Transp.',
                'Peso Médio (m³/v)',
                'Viagens Carreg.',
                'DM Médio Gruas (%)'
            ];
            const rowHeaderEvol = ws1.getRow(12);
            headersEvol.forEach((h, idx) => rowHeaderEvol.getCell(idx + 1).value = h);
            aplicarEstiloHeaderTabela(rowHeaderEvol, headersEvol.length);

            const primeiraLinhaDados = 13;
            for (let mes = 0; mes < 12; mes++) {
                const rNum = primeiraLinhaDados + mes;
                const m = mesesDados[mes];
                const dmMes = dmMedioPorMes[mes];
                const row = ws1.getRow(rNum);
                row.height = 22;

                const atingFatVal = metaFatMensal > 0 ? (m.faturamentoTotal / metaFatMensal) : 0;
                const atingVolVal = metaGarantiaVol > 0 ? (m.volume / metaGarantiaVol) : 0;
                const pesoMedVal = m.viagensTransp > 0 ? (m.volume / m.viagensTransp) : 0;

                row.getCell(1).value = `${nomeMesesExtenso[mes]}/${ano}`;
                row.getCell(2).value = m.faturamentoTransp;
                row.getCell(3).value = m.faturamentoCarreg;
                row.getCell(4).value = { formula: `B${rNum}+C${rNum}`, result: m.faturamentoTotal };
                row.getCell(5).value = metaFatMensal;
                row.getCell(6).value = metaFatMensal > 0 ? { formula: `IFERROR(D${rNum}/E${rNum},0)`, result: atingFatVal } : 0;
                row.getCell(7).value = m.volume;
                row.getCell(8).value = metaGarantiaVol;
                row.getCell(9).value = metaGarantiaVol > 0 ? { formula: `IFERROR(G${rNum}/H${rNum},0)`, result: atingVolVal } : 0;
                row.getCell(10).value = m.viagensTransp;
                row.getCell(11).value = { formula: `IFERROR(G${rNum}/J${rNum},0)`, result: pesoMedVal };
                row.getCell(12).value = m.viagensCarreg;
                row.getCell(13).value = dmMes !== null ? (dmMes / 100) : '-';

                const fillZebra = mes % 2 === 1 ? CORES.cinzaZebra : CORES.branco;
                for (let c = 1; c <= 13; c++) {
                    const cell = row.getCell(c);
                    cell.font = { name: 'Calibri', size: 10, bold: c === 1 || c === 4, color: { argb: CORES.textoEscuro } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillZebra } };
                    cell.alignment = alinharCentro;
                    cell.border = bordaPadrao;
                }

                // Formatos numéricos
                [2, 3, 4, 5].forEach(c => row.getCell(c).numFmt = '"R$ "#,##0.00');
                [6, 9].forEach(c => row.getCell(c).numFmt = '0.0%');
                [7, 8].forEach(c => row.getCell(c).numFmt = '#,##0.0');
                [10, 12].forEach(c => row.getCell(c).numFmt = '#,##0');
                row.getCell(11).numFmt = '#,##0.00';
                if (dmMes !== null) {
                    row.getCell(13).numFmt = '0.0%';
                    aplicarCorDM(row.getCell(13), dmMes);
                }

                // Destaques condicionais em Atingimento (quando há operação no mês)
                if (m.faturamentoTotal > 0 && metaFatMensal > 0) {
                    aplicarCorMeta(row.getCell(6), m.faturamentoTotal >= metaFatMensal);
                }
                if (m.volume > 0 && metaGarantiaVol > 0) {
                    aplicarCorMeta(row.getCell(9), m.volume >= metaGarantiaVol);
                }
            }

            // Linha TOTAL ANUAL (Linha 25)
            const rTotal = 25;
            const rowTot = ws1.getRow(rTotal);
            rowTot.height = 26;
            const dmMesesValidos = dmMedioPorMes.filter(v => v !== null);
            const mediaDMAnual = dmMesesValidos.length > 0 ? (dmMesesValidos.reduce((a, b) => a + b, 0) / dmMesesValidos.length) : null;

            rowTot.getCell(1).value = `TOTAL ANUAL ${ano}`;
            rowTot.getCell(2).value = { formula: `SUM(B13:B24)`, result: totFatTransp };
            rowTot.getCell(3).value = { formula: `SUM(C13:C24)`, result: totFatCarreg };
            rowTot.getCell(4).value = { formula: `SUM(D13:D24)`, result: totFat };
            rowTot.getCell(5).value = { formula: `SUM(E13:E24)`, result: metaFatMensal * 12 };
            rowTot.getCell(6).value = metaFatMensal > 0 ? { formula: `IFERROR(D25/E25,0)`, result: totFat / (metaFatMensal * 12) } : 0;
            rowTot.getCell(7).value = { formula: `SUM(G13:G24)`, result: totVol };
            rowTot.getCell(8).value = { formula: `SUM(H13:H24)`, result: metaGarantiaVol * 12 };
            rowTot.getCell(9).value = metaGarantiaVol > 0 ? { formula: `IFERROR(G25/H25,0)`, result: totVol / (metaGarantiaVol * 12) } : 0;
            rowTot.getCell(10).value = { formula: `SUM(J13:J24)`, result: totVT };
            rowTot.getCell(11).value = { formula: `IFERROR(G25/J25,0)`, result: pesoMedioAnual };
            rowTot.getCell(12).value = { formula: `SUM(L13:L24)`, result: totVC };
            rowTot.getCell(13).value = mediaDMAnual !== null ? (mediaDMAnual / 100) : '-';

            for (let c = 1; c <= 13; c++) {
                const cell = rowTot.getCell(c);
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: CORES.navyEscuro } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.cinzaTotal } };
                cell.alignment = alinharCentro;
                cell.border = bordaTotal;
            }
            [2, 3, 4, 5].forEach(c => rowTot.getCell(c).numFmt = '"R$ "#,##0.00');
            [6, 9].forEach(c => rowTot.getCell(c).numFmt = '0.0%');
            [7, 8].forEach(c => rowTot.getCell(c).numFmt = '#,##0.0');
            [10, 12].forEach(c => rowTot.getCell(c).numFmt = '#,##0');
            rowTot.getCell(11).numFmt = '#,##0.00';
            if (mediaDMAnual !== null) {
                rowTot.getCell(13).numFmt = '0.0%';
                aplicarCorDM(rowTot.getCell(13), mediaDMAnual);
            }

            // Linha MÉDIA MENSAL (somente meses com movimento)
            const mesesComFat = mesesDados.filter(m => m.faturamentoTotal > 0).length || 1;
            const rMedia = 26;
            const rowMed = ws1.getRow(rMedia);
            rowMed.height = 24;
            rowMed.getCell(1).value = `MÉDIA MENSAL (${mesesComFat}m ativos)`;
            rowMed.getCell(2).value = totFatTransp / mesesComFat;
            rowMed.getCell(3).value = totFatCarreg / mesesComFat;
            rowMed.getCell(4).value = totFat / mesesComFat;
            rowMed.getCell(5).value = metaFatMensal;
            rowMed.getCell(6).value = metaFatMensal > 0 ? ((totFat / mesesComFat) / metaFatMensal) : 0;
            rowMed.getCell(7).value = totVol / mesesComFat;
            rowMed.getCell(8).value = metaGarantiaVol;
            rowMed.getCell(9).value = metaGarantiaVol > 0 ? ((totVol / mesesComFat) / metaGarantiaVol) : 0;
            rowMed.getCell(10).value = totVT / mesesComFat;
            rowMed.getCell(11).value = pesoMedioAnual;
            rowMed.getCell(12).value = totVC / mesesComFat;
            rowMed.getCell(13).value = mediaDMAnual !== null ? (mediaDMAnual / 100) : '-';

            for (let c = 1; c <= 13; c++) {
                const cell = rowMed.getCell(c);
                cell.font = { name: 'Calibri', size: 10, italic: true, bold: true, color: { argb: CORES.textoSuave } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.cinzaZebra } };
                cell.alignment = alinharCentro;
                cell.border = bordaPadrao;
            }
            [2, 3, 4, 5].forEach(c => rowMed.getCell(c).numFmt = '"R$ "#,##0.00');
            [6, 9].forEach(c => rowMed.getCell(c).numFmt = '0.0%');
            [7, 8, 10, 12].forEach(c => rowMed.getCell(c).numFmt = '#,##0.0');
            rowMed.getCell(11).numFmt = '#,##0.00';
            if (mediaDMAnual !== null) rowMed.getCell(13).numFmt = '0.0%';

            ws1.columns = [
                { width: 20 }, { width: 20 }, { width: 21 }, { width: 21 }, { width: 20 },
                { width: 15 }, { width: 17 }, { width: 17 }, { width: 15 }, { width: 16 },
                { width: 17 }, { width: 16 }, { width: 18 }
            ];

            // =================================================================
            // ABA 2: RESUMO ANUAL CONSOLIDADO POR GRUA
            // =================================================================
            const ws2 = wb.addWorksheet('Resumo Anual por Grua', {
                views: [{ state: 'frozen', ySplit: 4 }],
                pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
            });

            aplicarEstiloBanner(
                ws2,
                11,
                `RESUMO ANUAL CONSOLIDADO POR GRUA — ${ano}`,
                `Produtividade Acumulada, Médias Diárias e Disponibilidade Mecânica (DM) | ${filialLabel}`
            );
            ws2.getRow(3).height = 10;

            const headersResumoGrua = [
                'Grua / Máquina',
                'Meses Ativos',
                'Total Dias Operados',
                'Total Viagens',
                'Média Viagens/Dia',
                'Meta V/Dia',
                'Status V/Dia',
                'Volume Total (m³)',
                'Média Vol. (m³/Dia)',
                'Horas Paradas (O.S.)',
                'DM Médio Anual (%)'
            ];
            const rowH2 = ws2.getRow(4);
            headersResumoGrua.forEach((h, i) => rowH2.getCell(i + 1).value = h);
            aplicarEstiloHeaderTabela(rowH2, headersResumoGrua.length);

            let linhaAtualWs2 = 5;
            const gruasListaAnual = Object.keys(resumoAnualGruas).sort();
            let totDiasG = 0, totViagensG = 0, totVolG = 0, totHorasManutG = 0, somaDMGeralG = 0;

            gruasListaAnual.forEach((grua, idx) => {
                const g = resumoAnualGruas[grua];
                const medVDia = g.dias > 0 ? (g.viagens / g.dias) : 0;
                const medVolDia = g.dias > 0 ? (g.volume / g.dias) : 0;
                const dmAnual = g.mesesAtivos > 0 ? (g.somaDM / g.mesesAtivos) : 100;
                const atingiuDiaria = metaDiariaGrua > 0 ? medVDia >= metaDiariaGrua : null;

                totDiasG += g.dias;
                totViagensG += g.viagens;
                totVolG += g.volume;
                totHorasManutG += g.horasManut;
                somaDMGeralG += dmAnual;

                const row = ws2.getRow(linhaAtualWs2);
                row.height = 22;

                row.getCell(1).value = grua;
                row.getCell(2).value = g.mesesAtivos;
                row.getCell(3).value = g.dias;
                row.getCell(4).value = g.viagens;
                row.getCell(5).value = medVDia;
                row.getCell(6).value = metaDiariaGrua > 0 ? metaDiariaGrua : '-';
                row.getCell(7).value = atingiuDiaria === null ? 'N/D' : (atingiuDiaria ? 'ATINGIDA' : 'ABAIXO');
                row.getCell(8).value = g.volume;
                row.getCell(9).value = medVolDia;
                row.getCell(10).value = g.horasManut;
                row.getCell(11).value = dmAnual / 100;

                const fillZebra = idx % 2 === 1 ? CORES.cinzaZebra : CORES.branco;
                for (let c = 1; c <= 11; c++) {
                    const cell = row.getCell(c);
                    cell.font = { name: 'Calibri', size: 10, bold: c === 1 || c === 4, color: { argb: CORES.textoEscuro } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillZebra } };
                    cell.alignment = alinharCentro;
                    cell.border = bordaPadrao;
                }

                [2, 3, 4].forEach(c => row.getCell(c).numFmt = '#,##0');
                row.getCell(5).numFmt = '#,##0.0';
                if (metaDiariaGrua > 0) row.getCell(6).numFmt = '#,##0.0';
                row.getCell(8).numFmt = '#,##0.0';
                row.getCell(9).numFmt = '#,##0.0';
                row.getCell(10).numFmt = '#,##0.0" h"';
                row.getCell(11).numFmt = '0.0%';

                if (atingiuDiaria !== null) aplicarCorMeta(row.getCell(7), atingiuDiaria);
                aplicarCorDM(row.getCell(11), dmAnual);

                linhaAtualWs2++;
            });

            if (gruasListaAnual.length > 0) {
                const rowT2 = ws2.getRow(linhaAtualWs2);
                rowT2.height = 26;
                const medDMFinal = somaDMGeralG / gruasListaAnual.length;
                const medVGlobal = totDiasG > 0 ? (totViagensG / totDiasG) : 0;
                const medVolGlobal = totDiasG > 0 ? (totVolG / totDiasG) : 0;

                rowT2.getCell(1).value = 'CONSOLIDADO FROTA';
                rowT2.getCell(2).value = '-';
                rowT2.getCell(3).value = totDiasG;
                rowT2.getCell(4).value = totViagensG;
                rowT2.getCell(5).value = medVGlobal;
                rowT2.getCell(6).value = metaDiariaGrua > 0 ? metaDiariaGrua : '-';
                rowT2.getCell(7).value = metaDiariaGrua > 0 ? (medVGlobal >= metaDiariaGrua ? 'ATINGIDA' : 'ABAIXO') : 'N/D';
                rowT2.getCell(8).value = totVolG;
                rowT2.getCell(9).value = medVolGlobal;
                rowT2.getCell(10).value = totHorasManutG;
                rowT2.getCell(11).value = medDMFinal / 100;

                for (let c = 1; c <= 11; c++) {
                    const cell = rowT2.getCell(c);
                    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: CORES.navyEscuro } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.cinzaTotal } };
                    cell.alignment = alinharCentro;
                    cell.border = bordaTotal;
                }
                [3, 4].forEach(c => rowT2.getCell(c).numFmt = '#,##0');
                [5, 8, 9].forEach(c => rowT2.getCell(c).numFmt = '#,##0.0');
                rowT2.getCell(10).numFmt = '#,##0.0" h"';
                rowT2.getCell(11).numFmt = '0.0%';
                aplicarCorDM(rowT2.getCell(11), medDMFinal);
            }

            ws2.autoFilter = { from: 'A4', to: 'K4' };
            ws2.columns = [
                { width: 18 }, { width: 14 }, { width: 19 }, { width: 15 }, { width: 18 },
                { width: 13 }, { width: 14 }, { width: 18 }, { width: 18 }, { width: 19 }, { width: 18 }
            ];

            // =================================================================
            // ABA 3: RESUMO DE PRODUÇÃO POR GRUA (MÊS A MÊS) + DM
            // =================================================================
            const ws3 = wb.addWorksheet('Gruas Mês a Mês', {
                views: [{ state: 'frozen', ySplit: 4 }],
                pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
            });

            aplicarEstiloBanner(
                ws3,
                14,
                `RESUMO DE PRODUÇÃO POR GRUA (MÊS A MÊS) & DM — ${ano}`,
                `Tabulação Mensal Detalhada com Metas de Viagens, Volume e Disponibilidade Mecânica | ${filialLabel}`
            );
            ws3.getRow(3).height = 10;

            const headersGruasMes = [
                'Mês / Ano',
                'Grua',
                'Dias Operados',
                'Viagens',
                'Meta Mensal',
                'Status Mensal',
                'Média V/Dia',
                'Meta Diária',
                'Status Diária',
                'Tempo Base (h)',
                'Parado O.S. (h)',
                'DM (%)',
                'Volume (m³)',
                'Média m³/Dia'
            ];
            const rowH3 = ws3.getRow(4);
            headersGruasMes.forEach((h, i) => rowH3.getCell(i + 1).value = h);
            aplicarEstiloHeaderTabela(rowH3, headersGruasMes.length);

            let linhaAtualWs3 = 5;

            for (let mes = 0; mes < 12; mes++) {
                const gruasDoMes = gruasNomes.filter(g => gruasDict[g][mes] && gruasDict[g][mes].viagens > 0);
                if (gruasDoMes.length === 0) continue;

                let totalViagens = 0, totalVolume = 0, maxDias = 0, totalPercentDM = 0, totalHBase = 0, totalHManut = 0;

                gruasDoMes.forEach((grua, idx) => {
                    const stats = gruasDict[grua][mes];
                    const dias = stats.diasOperados.size;
                    const mediaViagens = dias > 0 ? (stats.viagens / dias) : 0;
                    const mediaVol = dias > 0 ? (stats.volume / dias) : 0;
                    const dadosDM = calcularDMMensal(grua, mes, ano);

                    totalViagens += stats.viagens;
                    totalVolume += stats.volume;
                    if (dias > maxDias) maxDias = dias;
                    totalPercentDM += dadosDM.percentDM;
                    totalHBase += dadosDM.horasBase;
                    totalHManut += dadosDM.horasManut;

                    const atingMensal = metaMensalGrua > 0 ? stats.viagens >= metaMensalGrua : null;
                    const atingDiaria = metaDiariaGrua > 0 ? mediaViagens >= metaDiariaGrua : null;

                    const row = ws3.getRow(linhaAtualWs3);
                    row.height = 21;

                    row.getCell(1).value = `${nomeMeses[mes]}/${ano}`;
                    row.getCell(2).value = grua;
                    row.getCell(3).value = dias;
                    row.getCell(4).value = stats.viagens;
                    row.getCell(5).value = metaMensalGrua > 0 ? metaMensalGrua : '-';
                    row.getCell(6).value = atingMensal === null ? 'N/D' : (atingMensal ? 'ATINGIDA' : 'ABAIXO');
                    row.getCell(7).value = mediaViagens;
                    row.getCell(8).value = metaDiariaGrua > 0 ? metaDiariaGrua : '-';
                    row.getCell(9).value = atingDiaria === null ? 'N/D' : (atingDiaria ? 'ATINGIDA' : 'ABAIXO');
                    row.getCell(10).value = dadosDM.horasBase;
                    row.getCell(11).value = dadosDM.horasManut;
                    row.getCell(12).value = dadosDM.percentDM / 100;
                    row.getCell(13).value = stats.volume;
                    row.getCell(14).value = mediaVol;

                    const fillZebra = idx % 2 === 1 ? CORES.cinzaZebra : CORES.branco;
                    for (let c = 1; c <= 14; c++) {
                        const cell = row.getCell(c);
                        cell.font = { name: 'Calibri', size: 10, bold: c === 2 || c === 4, color: { argb: CORES.textoEscuro } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillZebra } };
                        cell.alignment = alinharCentro;
                        cell.border = bordaPadrao;
                    }

                    [3, 4].forEach(c => row.getCell(c).numFmt = '#,##0');
                    if (metaMensalGrua > 0) row.getCell(5).numFmt = '#,##0';
                    row.getCell(7).numFmt = '#,##0.0';
                    if (metaDiariaGrua > 0) row.getCell(8).numFmt = '#,##0.0';
                    [10, 11].forEach(c => row.getCell(c).numFmt = '#,##0.0" h"');
                    row.getCell(12).numFmt = '0.0%';
                    [13, 14].forEach(c => row.getCell(c).numFmt = '#,##0.0');

                    if (atingMensal !== null) aplicarCorMeta(row.getCell(6), atingMensal);
                    if (atingDiaria !== null) aplicarCorMeta(row.getCell(9), atingDiaria);
                    aplicarCorDM(row.getCell(12), dadosDM.percentDM);

                    linhaAtualWs3++;
                });

                // Subtotal / Média Frota do Mês
                const qtdMaq = gruasDoMes.length;
                const mediaGlobalV = maxDias > 0 ? (totalViagens / maxDias) / qtdMaq : 0;
                const mediaGlobalVol = maxDias > 0 ? (totalVolume / maxDias) / qtdMaq : 0;
                const mediaGeralDM = totalPercentDM / qtdMaq;

                const rowSub = ws3.getRow(linhaAtualWs3);
                rowSub.height = 24;
                rowSub.getCell(1).value = `RESUMO ${nomeMeses[mes].toUpperCase()}/${ano}`;
                rowSub.getCell(2).value = `MÉDIA FROTA (${qtdMaq})`;
                rowSub.getCell(3).value = maxDias;
                rowSub.getCell(4).value = totalViagens;
                rowSub.getCell(5).value = '-';
                rowSub.getCell(6).value = '-';
                rowSub.getCell(7).value = mediaGlobalV;
                rowSub.getCell(8).value = '-';
                rowSub.getCell(9).value = '-';
                rowSub.getCell(10).value = totalHBase;
                rowSub.getCell(11).value = totalHManut;
                rowSub.getCell(12).value = mediaGeralDM / 100;
                rowSub.getCell(13).value = totalVolume;
                rowSub.getCell(14).value = mediaGlobalVol;

                for (let c = 1; c <= 14; c++) {
                    const cell = rowSub.getCell(c);
                    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: CORES.navyEscuro } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.cinzaTotal } };
                    cell.alignment = alinharCentro;
                    cell.border = bordaTotal;
                }
                [3, 4].forEach(c => rowSub.getCell(c).numFmt = '#,##0');
                [7, 13, 14].forEach(c => rowSub.getCell(c).numFmt = '#,##0.0');
                [10, 11].forEach(c => rowSub.getCell(c).numFmt = '#,##0.0" h"');
                rowSub.getCell(12).numFmt = '0.0%';
                aplicarCorDM(rowSub.getCell(12), mediaGeralDM);

                linhaAtualWs3 += 2; // Linha em branco entre os meses para leitura executiva
            }

            ws3.autoFilter = { from: 'A4', to: 'N4' };
            ws3.columns = [
                { width: 16 }, { width: 18 }, { width: 14 }, { width: 12 }, { width: 14 },
                { width: 14 }, { width: 13 }, { width: 13 }, { width: 14 }, { width: 15 },
                { width: 15 }, { width: 12 }, { width: 16 }, { width: 15 }
            ];

            // =================================================================
            // ABA 4: DETALHAMENTO DM & ORDENS DE SERVIÇO (AUDITORIA DE PARADAS)
            // =================================================================
            const ws4 = wb.addWorksheet('Detalhamento DM (O.S.)', {
                views: [{ state: 'frozen', ySplit: 4 }],
                pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
            });

            aplicarEstiloBanner(
                ws4,
                8,
                `DETALHAMENTO DE PARADAS (O.S.) QUE IMPACTARAM A DM DAS GRUAS — ${ano}`,
                `Auditoria de Disponibilidade Mecânica por Máquina e Período | ${filialLabel}`
            );
            ws4.getRow(3).height = 10;

            const headersOS = [
                'Mês / Ano',
                'Grua / Placa',
                'Nº O.S.',
                'Início Parada (Mês)',
                'Fim Parada (Mês)',
                'Tipo / Classificação',
                'Descrição do Problema',
                'Duração no Mês (h)'
            ];
            const rowH4 = ws4.getRow(4);
            headersOS.forEach((h, i) => rowH4.getCell(i + 1).value = h);
            aplicarEstiloHeaderTabela(rowH4, headersOS.length);

            let linhaAtualWs4 = 5;
            if (todasOSAnuais.length === 0) {
                ws4.mergeCells('A5:H5');
                const cVazio = ws4.getCell('A5');
                cVazio.value = 'Nenhuma Ordem de Serviço registrada para as gruas ativas no período.';
                cVazio.font = { name: 'Calibri', size: 10, italic: true, color: { argb: CORES.textoSuave } };
                cVazio.alignment = alinharCentro;
                ws4.getRow(5).height = 26;
            } else {
                let somaHorasOS = 0;
                todasOSAnuais.forEach((os, idx) => {
                    somaHorasOS += os.duracaoHoras;
                    const row = ws4.getRow(linhaAtualWs4);
                    row.height = 22;

                    row.getCell(1).value = os.periodo;
                    row.getCell(2).value = os.grua;
                    row.getCell(3).value = os.numero_os;
                    row.getCell(4).value = os.dtIniStr;
                    row.getCell(5).value = os.dtFimStr;
                    row.getCell(6).value = os.tipo;
                    row.getCell(7).value = os.descricao;
                    row.getCell(8).value = os.duracaoHoras;

                    const fillZebra = idx % 2 === 1 ? CORES.cinzaZebra : CORES.branco;
                    for (let c = 1; c <= 8; c++) {
                        const cell = row.getCell(c);
                        cell.font = { name: 'Calibri', size: 10, bold: c === 2 || c === 3, color: { argb: c === 8 ? CORES.vermelhoTexto : CORES.textoEscuro } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillZebra } };
                        cell.alignment = c === 7 ? { vertical: 'middle', horizontal: 'left', wrapText: true } : alinharCentro;
                        cell.border = bordaPadrao;
                    }
                    row.getCell(8).numFmt = '#,##0.00" h"';
                    linhaAtualWs4++;
                });

                const rowTotOS = ws4.getRow(linhaAtualWs4);
                rowTotOS.height = 25;
                ws4.mergeCells(linhaAtualWs4, 1, linhaAtualWs4, 7);
                rowTotOS.getCell(1).value = `TOTAL DE O.S. LISTADAS: ${todasOSAnuais.length}`;
                rowTotOS.getCell(8).value = { formula: `SUM(H5:H${linhaAtualWs4 - 1})`, result: somaHorasOS };
                for (let c = 1; c <= 8; c++) {
                    const cell = rowTotOS.getCell(c);
                    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: CORES.navyEscuro } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.cinzaTotal } };
                    cell.alignment = alinharCentro;
                    cell.border = bordaTotal;
                }
                rowTotOS.getCell(8).numFmt = '#,##0.00" h"';
            }

            ws4.autoFilter = { from: 'A4', to: 'H4' };
            ws4.columns = [
                { width: 14 }, { width: 16 }, { width: 14 }, { width: 20 },
                { width: 20 }, { width: 22 }, { width: 48 }, { width: 18 }
            ];

            // =================================================================
            // ABA 5 (OPCIONAL): CONSULTA DIÁRIA DE DM (SE HOUVER DATA PESQUISADA)
            // =================================================================
            if (estadoExportacaoSLA.dmDiariaRegistros && estadoExportacaoSLA.dmDiariaRegistros.length > 0) {
                const ws5 = wb.addWorksheet('DM Diária (Frota)', {
                    views: [{ state: 'frozen', ySplit: 4 }],
                    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
                });

                aplicarEstiloBanner(
                    ws5,
                    7,
                    `CONSULTA DIÁRIA DE DM — FROTA E MÁQUINAS (${estadoExportacaoSLA.dmDiariaData})`,
                    `Disponibilidade Mecânica Diária por Equipamento Ativo | ${filialLabel}`
                );
                ws5.getRow(3).height = 10;

                const headersDiaria = [
                    'Placa / Máquina',
                    'Categoria',
                    'Tempo Ref. Base',
                    'Tempo em O.S.',
                    'Tempo Disponível',
                    'DM (%)',
                    'Detalhamento O.S. no Dia'
                ];
                const rowH5 = ws5.getRow(4);
                headersDiaria.forEach((h, i) => rowH5.getCell(i + 1).value = h);
                aplicarEstiloHeaderTabela(rowH5, headersDiaria.length);

                let linhaAtualWs5 = 5;
                let somaDMDiaria = 0;

                estadoExportacaoSLA.dmDiariaRegistros.forEach((reg, idx) => {
                    somaDMDiaria += reg.percentDM;
                    const row = ws5.getRow(linhaAtualWs5);
                    row.height = 22;

                    row.getCell(1).value = reg.placa;
                    row.getCell(2).value = reg.categoria;
                    row.getCell(3).value = reg.tempoBaseFmt;
                    row.getCell(4).value = reg.tempoManutFmt;
                    row.getCell(5).value = reg.tempoDispFmt;
                    row.getCell(6).value = reg.percentDM / 100;
                    row.getCell(7).value = reg.detalhes;

                    const fillZebra = idx % 2 === 1 ? CORES.cinzaZebra : CORES.branco;
                    for (let c = 1; c <= 7; c++) {
                        const cell = row.getCell(c);
                        cell.font = { name: 'Calibri', size: 10, bold: c === 1, color: { argb: CORES.textoEscuro } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillZebra } };
                        cell.alignment = c === 7 ? { vertical: 'middle', horizontal: 'left', wrapText: true } : alinharCentro;
                        cell.border = bordaPadrao;
                    }
                    row.getCell(6).numFmt = '0.0%';
                    aplicarCorDM(row.getCell(6), reg.percentDM);
                    linhaAtualWs5++;
                });

                const medDMDiaria = somaDMDiaria / estadoExportacaoSLA.dmDiariaRegistros.length;
                const rowT5 = ws5.getRow(linhaAtualWs5);
                rowT5.height = 25;
                ws5.mergeCells(linhaAtualWs5, 1, linhaAtualWs5, 5);
                rowT5.getCell(1).value = `MÉDIA GERAL DM DO DIA (${estadoExportacaoSLA.dmDiariaRegistros.length} EQUIPAMENTOS)`;
                rowT5.getCell(6).value = medDMDiaria / 100;
                rowT5.getCell(7).value = '';
                for (let c = 1; c <= 7; c++) {
                    const cell = rowT5.getCell(c);
                    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: CORES.navyEscuro } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CORES.cinzaTotal } };
                    cell.alignment = alinharCentro;
                    cell.border = bordaTotal;
                }
                rowT5.getCell(6).numFmt = '0.0%';
                aplicarCorDM(rowT5.getCell(6), medDMDiaria);

                ws5.autoFilter = { from: 'A4', to: 'G4' };
                ws5.columns = [
                    { width: 18 }, { width: 15 }, { width: 17 }, { width: 17 },
                    { width: 17 }, { width: 13 }, { width: 52 }
                ];
            }

            // Download do arquivo .xlsx
            const buffer = await wb.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const hojeStr = new Date().toISOString().slice(0, 10);
            a.href = url;
            a.download = `Relatorio_Gerencial_SLA_${ano}_${hojeStr}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            Swal.fire({
                icon: 'success',
                title: 'Relatório Excel Gerado!',
                text: `Arquivo Relatorio_Gerencial_SLA_${ano}_${hojeStr}.xlsx baixado com sucesso.`,
                timer: 2800,
                showConfirmButton: false,
                background: '#1e293b',
                color: '#f8fafc'
            });

        } catch (err) {
            console.error('[SLA] Erro ao gerar Excel:', err);
            Swal.fire('Erro', 'Não foi possível gerar o relatório Excel. Verifique a conexão e tente novamente.', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    };

    carregarDadosSLA();
};