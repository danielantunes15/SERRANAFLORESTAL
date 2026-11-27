// ==================== modules/manutencao/servicos/servicos.js ====================

let mOS_Atual = null;
let mOS_PecasCache = [];
let mOS_PecasMap = {};
let mOS_KitsCache = [];
let mOS_ListaGeral = [];
let mOS_Requisicoes = [];
let mOS_FrotasCache = [];
let mOS_FrotasMap = {};
let mOS_AbaAtiva = 'aceite';
let mOS_ApenasMinhas = false;
let mOS_FiltroStatusReq = '';
let mOS_StatusReqAnterior = {};
let timerAutoRefreshServicos = null;
let mapaSOSMecanicoInstance = null;
window.mecanicoNomeCompletoCache = null;
let mMecanicosCache = [];

window.itensKitRevisaoAtual = [];
window.kitRevisaoContexto = {};

// ==================== HELPERS DE TEMPO / SLA E SOM ====================
function calcularTempoDecorrido(dataStr) {
    if (!dataStr) return '-';
    const inicio = new Date(dataStr);
    if (isNaN(inicio.getTime())) return '-';
    const diffMs = Math.max(0, Date.now() - inicio.getTime());
    const totalMin = Math.floor(diffMs / 60000);
    const dias = Math.floor(totalMin / 1440);
    const horas = Math.floor((totalMin % 1440) / 60);
    const mins = totalMin % 60;
    if (dias > 0) return `${dias}d ${String(horas).padStart(2, '0')}h`;
    return `${String(horas).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;
}

function verificarPrevisaoEstourada(previsaoStr) {
    if (!previsaoStr || previsaoStr === 'null' || previsaoStr === 'undefined') return false;
    const prev = new Date(previsaoStr);
    return !isNaN(prev.getTime()) && prev.getTime() < Date.now();
}

function tocarAlertaPecaAprovada() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        setTimeout(() => osc.stop(), 180);
    } catch (e) {}
}

// ==================== CARREGAMENTO PRINCIPAL ====================
window.renderizarTelaServicos = async function(mostrarToast = false, silencioso = false) {
    try {
        if (!window.mecanicoNomeCompletoCache) {
            const s = localStorage.getItem('ccol_user_session');
            if (s) {
                const sessObj = JSON.parse(s);
                if (sessObj.username) {
                    const { data: userData } = await window.supabaseClient.from('usuarios').select('nome_completo').eq('username', sessObj.username).maybeSingle();
                    if (userData && userData.nome_completo && userData.nome_completo.trim() !== '') {
                        window.mecanicoNomeCompletoCache = userData.nome_completo;
                    } else {
                        window.mecanicoNomeCompletoCache = sessObj.nome_completo || sessObj.nome || sessObj.username;
                    }
                }
            }
        }

        const promessasIniciais = [];

        if (mMecanicosCache.length === 0) {
            promessasIniciais.push((async () => {
                const { data: setoresData } = await window.supabaseClient.from('setores').select('id').ilike('nome', '%Manuten%');
                if (setoresData && setoresData.length > 0) {
                    let qColabs = window.supabaseClient.from('rh_colaboradores').select('nome').in('setor_id', setoresData.map(s => s.id)).eq('status', 'Ativo').order('nome');
                    if (typeof window.aplicarFiltroFilial === 'function') qColabs = window.aplicarFiltroFilial(qColabs);
                    const { data } = await qColabs;
                    if (data) mMecanicosCache = data.map(c => c.nome).filter(n => n && n.trim() !== '');
                }
            })());
        }

        // Atualiza peças sempre no refresh manual ou se cache vazio para manter saldos reais
        if (mOS_PecasCache.length === 0 || mostrarToast) {
            promessasIniciais.push((async () => {
                let qPecas = window.supabaseClient.from('almoxarifado_pecas').select('*');
                if (typeof window.aplicarFiltroFilial === 'function') qPecas = window.aplicarFiltroFilial(qPecas);
                const { data } = await qPecas;
                mOS_PecasCache = data || [];
                mOS_PecasMap = {};
                mOS_PecasCache.forEach(p => mOS_PecasMap[p.id] = p);
            })());
        }

        if (mOS_KitsCache.length === 0 || mostrarToast) {
            promessasIniciais.push((async () => {
                let qKits = window.supabaseClient.from('almoxarifado_kits').select('*');
                if (typeof window.aplicarFiltroFilial === 'function') qKits = window.aplicarFiltroFilial(qKits);
                const { data } = await qKits;
                mOS_KitsCache = data || [];
            })());
        }

        if (mOS_FrotasCache.length === 0) {
            promessasIniciais.push((async () => {
                let qFrotas = window.supabaseClient.from('frotas_manutencao').select('*');
                if (typeof window.aplicarFiltroFilial === 'function') qFrotas = window.aplicarFiltroFilial(qFrotas);
                const { data } = await qFrotas;
                mOS_FrotasCache = data || [];
                mOS_FrotasMap = {};
                mOS_FrotasCache.forEach(f => {
                    if (f.cavalo) mOS_FrotasMap[f.cavalo] = f;
                    if (f.go) mOS_FrotasMap[f.go] = f;
                });
            })());
        }

        await Promise.all(promessasIniciais);

        let queryOS = window.supabaseClient.from('ordens_servico')
            .select('*')
            .neq('status', 'Concluída')
            .neq('status', 'Cancelada')
            .order('data_abertura', { ascending: false });
            
        if (typeof window.aplicarFiltroFilial === 'function') queryOS = window.aplicarFiltroFilial(queryOS);
        
        const { data: osData, error: osError } = await queryOS;
        if (osError) throw osError;
        
        mOS_ListaGeral = (osData || []).filter(os => os.inativa !== 1 && os.inativa !== true);
        
        const osEmExecucao = mOS_ListaGeral.filter(os => os.status === 'Em Manutenção').map(os => os.id);
        
        if (osEmExecucao.length > 0) {
            let queryReq = window.supabaseClient.from('os_pecas_utilizadas').select('*').in('os_id', osEmExecucao).order('id', { ascending: false });
            if (typeof window.aplicarFiltroFilial === 'function') queryReq = window.aplicarFiltroFilial(queryReq);
            const { data: reqData } = await queryReq;
            mOS_Requisicoes = reqData || [];
        } else {
            mOS_Requisicoes = [];
        }

        // Detecta se alguma peça mudou de Pendente para Aprovado durante auto-refresh
        if (silencioso && Object.keys(mOS_StatusReqAnterior).length > 0) {
            const recemAprovadas = mOS_Requisicoes.filter(r =>
                r.status === 'Aprovado' && mOS_StatusReqAnterior[r.id] === 'Pendente'
            );
            if (recemAprovadas.length > 0) {
                tocarAlertaPecaAprovada();
                const pecaRef = mOS_PecasMap[recemAprovadas[0].peca_id];
                Swal.fire({
                    toast: true, position: 'top-end', icon: 'success',
                    title: `${recemAprovadas.length} peça(s) liberada(s) no Almoxarifado!`,
                    text: pecaRef ? pecaRef.nome : 'Pronta para retirada no balcão.',
                    showConfirmButton: false, timer: 4500, background: '#1e293b', color: '#fff'
                });
            }
        }
        mOS_StatusReqAnterior = {};
        mOS_Requisicoes.forEach(r => { mOS_StatusReqAnterior[r.id] = r.status || 'Pendente'; });
        
        mecanicoAtualizarContadores();
        mecanicoRenderizarTabelas();

        if (mostrarToast) {
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Ordens atualizadas!', showConfirmButton: false, timer: 1500, background: '#1e293b', color: '#fff' });
        }
    } catch (e) {
        console.error("Erro ao carregar serviços:", e);
    }
};

// ==================== CONTROLES DA TOOLBAR ====================
window.mecanicoToggleAutoRefresh = function(ativo) {
    const lbl = document.getElementById('lblAutoRefreshServ');
    if (lbl) lbl.classList.toggle('ativo', ativo);

    if (timerAutoRefreshServicos) {
        clearInterval(timerAutoRefreshServicos);
        timerAutoRefreshServicos = null;
    }
    if (ativo) {
        timerAutoRefreshServicos = setInterval(() => {
            if (document.getElementById('tabelaServicosDisponiveis')) {
                renderizarTelaServicos(false, true);
            } else {
                clearInterval(timerAutoRefreshServicos);
                timerAutoRefreshServicos = null;
            }
        }, 30000);
    }
};

window.mecanicoToggleMinhasOS = function(ativo) {
    mOS_ApenasMinhas = ativo;
    const lbl = document.getElementById('lblApenasMinhasOS');
    if (lbl) lbl.classList.toggle('ativo', ativo);
    mecanicoRenderizarTabelas();
};

window.mecanicoFiltrarStatusReq = function(status, btn) {
    mOS_FiltroStatusReq = status;
    document.querySelectorAll('.req-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    mecanicoRenderizarTabelas();
};

// ==================== NAVEGAÇÃO DE ABAS ====================
window.mecanicoMudarAba = function(aba) {
    mOS_AbaAtiva = aba;
    
    document.getElementById('btnAbaAceite').classList.toggle('active', aba === 'aceite');
    document.getElementById('btnAbaAbertas').classList.toggle('active', aba === 'abertas');
    document.getElementById('btnAbaRequisicoes').classList.toggle('active', aba === 'requisicoes');
    document.getElementById('btnAbaSOS').classList.toggle('active-sos', aba === 'sos');
    
    document.getElementById('divServAceite').style.display = aba === 'aceite' ? 'flex' : 'none';
    document.getElementById('divServAbertas').style.display = aba === 'abertas' ? 'flex' : 'none';
    document.getElementById('divServRequisicoes').style.display = aba === 'requisicoes' ? 'flex' : 'none';
    document.getElementById('divServSOS').style.display = aba === 'sos' ? 'block' : 'none';

    const lblMinhas = document.getElementById('lblApenasMinhasOS');
    if (lblMinhas) lblMinhas.style.display = aba === 'abertas' ? 'inline-flex' : 'none';
    
    if (aba === 'sos') setTimeout(() => mecanicoInicializarMapaSOS(), 300);
    mecanicoRenderizarTabelas();
};

window.mecanicoInicializarMapaSOS = function() {
    if (mapaSOSMecanicoInstance !== null) { mapaSOSMecanicoInstance.remove(); mapaSOSMecanicoInstance = null; }
    mapaSOSMecanicoInstance = L.map('mapaSOSMecanico').setView([-17.9754, -39.7336], 7);
    L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { maxZoom: 20 }).addTo(mapaSOSMecanicoInstance);

    const sosAbertas = mOS_ListaGeral.filter(os => os.tipo && os.tipo.startsWith('S.O.S'));
    const bounds = [];

    sosAbertas.forEach(os => {
        const local = os.localizacao_sos || '';
        if (local.includes('http')) {
            const parts = local.split(' | Ref: ');
            const match = parts[0].trim().match(/(-?\d+\.\d+),(-?\d+\.\d+)/);
            if (match) {
                const lat = parseFloat(match[1]); const lng = parseFloat(match[2]);
                const popupMsg = `<div style="text-align:center;"><b>🚨 S.O.S O.S #${os.numero_os || os.id}</b><br><b>Placa:</b> ${os.placa}<br><a href="${parts[0].trim()}" target="_blank">Abrir GPS</a></div>`;
                L.marker([lat, lng]).addTo(mapaSOSMecanicoInstance).bindPopup(popupMsg);
                bounds.push([lat, lng]);
            }
        }
    });

    if (bounds.length > 0) mapaSOSMecanicoInstance.fitBounds(bounds, { padding: [30, 30] });
};

function mecanicoAtualizarContadores() {
    document.getElementById('countAceite').innerText = mOS_ListaGeral.filter(os =>
        os.status !== 'Em Manutenção' &&
        os.status !== 'Agendada' &&
        !(os.tipo && os.tipo.startsWith('S.O.S'))
    ).length;
    
    document.getElementById('countAbertas').innerText = mOS_ListaGeral.filter(os => os.status === 'Em Manutenção').length;
    document.getElementById('countRequisicoes').innerText = mOS_Requisicoes.filter(r => r.status === 'Pendente' || !r.status).length;
    document.getElementById('countSOS').innerText = mOS_ListaGeral.filter(os => os.tipo && os.tipo.startsWith('S.O.S')).length;
}

function mecanicoObterInfoFrota(placa) {
    if (!placa) return '';
    const frota = mOS_FrotasMap[placa];
    if (!frota) return '';
    
    let html = `<div style="font-size: 0.85rem; color: #94a3b8; margin-top: 5px; margin-bottom: 8px; background: rgba(0,0,0,0.2); padding: 6px 10px; border-radius: 6px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">`;
    if (frota.go) html += `<span><strong style="color: #cbd5e1;">GO:</strong> ${frota.go}</span>`;
    if (frota.carreta1) html += `<span><strong style="color: #cbd5e1;">C1:</strong> ${frota.carreta1}</span>`;
    if (frota.carreta2) html += `<span><strong style="color: #cbd5e1;">C2:</strong> ${frota.carreta2}</span>`;
    if (frota.carreta3) html += `<span><strong style="color: #cbd5e1;">C3:</strong> ${frota.carreta3}</span>`;
    html += `</div>`;
    return html;
}

// ==================== RENDERIZAÇÃO DAS ABAS ====================
window.mecanicoRenderizarTabelas = function() {
    const termo = (document.getElementById('servSearchInput')?.value || '').toLowerCase().trim();

    const matchBuscaOS = (os) => {
        if (!termo) return true;
        return (os.placa || '').toLowerCase().includes(termo) ||
            String(os.numero_os || os.id).toLowerCase().includes(termo) ||
            (os.motorista || '').toLowerCase().includes(termo) ||
            (os.mecanico_responsavel || '').toLowerCase().includes(termo) ||
            (os.problema || '').toLowerCase().includes(termo);
    };

    if (mOS_AbaAtiva === 'aceite') {
        const container = document.getElementById('tabelaServicosDisponiveis');
        const osDisp = mOS_ListaGeral.filter(os =>
            os.status !== 'Em Manutenção' &&
            os.status !== 'Agendada' &&
            !(os.tipo && os.tipo.startsWith('S.O.S')) &&
            matchBuscaOS(os)
        );
        
        if (osDisp.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#94a3b8; width:100%; grid-column:1/-1; padding:20px;">Nenhuma O.S. aguardando aceite.</p>';
            return;
        }

        container.innerHTML = osDisp.map(os => {
            const tempoEspera = calcularTempoDecorrido(os.data_abertura);
            return `
            <div class="tablet-card" style="border-left: 5px solid #3b82f6;">
                <div class="card-header-flex">
                    <span class="card-badge" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa;">#${os.numero_os || os.id}</span>
                    <span class="sla-pill" title="Tempo aguardando atendimento"><i class="fas fa-stopwatch"></i> ${tempoEspera}</span>
                </div>
                <div class="card-placa">${os.placa} <span style="font-size:0.85rem; color:#94a3b8; font-weight:normal; vertical-align:middle;">(${os.status})</span></div>
                ${mecanicoObterInfoFrota(os.placa)}
                <div class="card-info-text"><strong style="color:#fff;">Mot:</strong> ${os.motorista || '-'}</div>
                <div class="card-info-text" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;"><strong>Problema:</strong> ${os.problema || 'Sem descrição'}</div>
                <div class="card-actions">
                    <button class="btn-acao-grande" style="background: #10b981; color: white;" onclick="abrirModalAssumirOS(${os.id}, '${os.placa}')"><i class="fas fa-hand-holding-medical"></i> Assumir Serviço</button>
                </div>
            </div>`;
        }).join('');
        
    } else if (mOS_AbaAtiva === 'abertas') {
        const container = document.getElementById('listaMinhasOSAbertas');
        const usuarioAtual = mecanicoPegarUsuario();
        const abertasOs = mOS_ListaGeral.filter(os => {
            if (os.status !== 'Em Manutenção') return false;
            if (mOS_ApenasMinhas && os.mecanico_responsavel !== usuarioAtual) return false;
            return matchBuscaOS(os);
        });
        
        if (abertasOs.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#94a3b8; width:100%; grid-column:1/-1; padding:20px;">Não há O.S. em execução para o filtro atual.</p>';
            return;
        }

        container.innerHTML = abertasOs.map(os => {
            const isSOS = os.tipo && os.tipo.startsWith('S.O.S');
            const atrasada = verificarPrevisaoEstourada(os.previsao_entrega);
            const colorBorder = atrasada ? '#ef4444' : (isSOS ? '#f97316' : '#10b981');
            const meucard = os.mecanico_responsavel === usuarioAtual;
            const tempoParado = calcularTempoDecorrido(os.data_inicio_manutencao || os.data_abertura);
            const qtdPendOS = mOS_Requisicoes.filter(r => String(r.os_id) === String(os.id) && (r.status === 'Pendente' || !r.status)).length;

            return `
            <div class="tablet-card ${atrasada ? 'card-atrasada' : ''}" style="border-left: 6px solid ${colorBorder}; ${meucard ? 'background: rgba(16, 185, 129, 0.06);' : ''}">
                <div class="card-header-flex">
                    <span class="card-badge" style="background: ${colorBorder};">#${os.numero_os || os.id} ${atrasada ? 'ATRASADA' : (isSOS ? 'S.O.S' : 'EM EXECUÇÃO')}</span>
                    <span class="sla-pill ${atrasada ? 'atraso' : ''}"><i class="fas fa-stopwatch"></i> ${tempoParado}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
                    <div class="card-placa" style="color: ${colorBorder};">${os.placa}</div>
                    ${qtdPendOS > 0 ? `<span class="card-badge" style="background:#f59e0b; font-size:0.75rem;"><i class="fas fa-box-open"></i> ${qtdPendOS} peça(s) pend.</span>` : ''}
                </div>
                <div style="color:#94a3b8; font-size:0.85rem; margin-bottom:6px;">Responsável: <strong style="color:#fff;">${os.mecanico_responsavel || '-'}</strong></div>
                ${mecanicoObterInfoFrota(os.placa)}
                <div class="card-info-text" style="min-height: 38px; overflow: hidden; text-overflow: ellipsis;">${os.problema || 'Sem descrição'}</div>
                
                <div style="border-top: 1px solid #334155; margin-top: 12px; padding-top: 12px; display: flex; flex-direction: column; gap: 10px;">
                    <div class="card-actions row-tablet" style="margin-top: 0;">
                        <button class="btn-acao-grande" style="background: #3b82f6; color: white; font-size:1rem;" onclick="mecanicoAbrirApontamento(${os.id}, '${os.placa}', '${os.previsao_entrega}')"><i class="fas fa-edit"></i> Preencher</button>
                        <button class="btn-acao-grande" style="background: #10b981; color: white; font-size:1rem;" onclick="abrirModalFinalizarOS(${os.id}, '${os.placa}')"><i class="fas fa-flag-checkered"></i> Finalizar</button>
                    </div>
                    <button style="background:transparent; border:1px solid #ef4444; color:#ef4444; padding:11px; border-radius:10px; font-weight:bold; width:100%; display:flex; justify-content:center; align-items:center; gap:8px; cursor:pointer;" onclick="mecanicoDevolverOS(${os.id}, '${os.placa}')"><i class="fas fa-undo"></i> Devolver O.S.</button>
                </div>
            </div>`;
        }).join('');

    } else if (mOS_AbaAtiva === 'requisicoes') {
        const container = document.getElementById('tabelaMinhasRequisicoes');
        const filtradas = mOS_Requisicoes.filter(r => {
            const st = r.status || 'Pendente';
            if (mOS_FiltroStatusReq && st !== mOS_FiltroStatusReq) return false;
            if (!termo) return true;
            const pecaObj = mOS_PecasMap[r.peca_id];
            const osRef = mOS_ListaGeral.find(o => String(o.id) === String(r.os_id));
            return (pecaObj && ((pecaObj.nome || '').toLowerCase().includes(termo) || (pecaObj.codigo || '').toLowerCase().includes(termo))) ||
                String(r.os_id || '').includes(termo) ||
                (osRef && (osRef.placa || '').toLowerCase().includes(termo)) ||
                (r.mecanico || '').toLowerCase().includes(termo);
        });

        if (filtradas.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#94a3b8; width:100%; grid-column:1/-1; padding:20px;">Nenhuma requisição encontrada para este filtro.</p>';
            return;
        }

        container.innerHTML = filtradas.map(r => {
            const pecaObj = mOS_PecasMap[r.peca_id];
            const pecaNome = pecaObj ? pecaObj.nome : 'Peça Indisponível';
            const pecaCod = (pecaObj && pecaObj.codigo) ? `[${pecaObj.codigo}] ` : '';
            const osRef = mOS_ListaGeral.find(o => String(o.id) === String(r.os_id));
            const placaOS = osRef ? osRef.placa : (r.placa || 'Frota');
            const st = r.status || 'Pendente';
            const bgCor = st === 'Aprovado' ? 'rgba(16, 185, 129, 0.1)' : (st === 'Recusado' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)');
            const borderCor = st === 'Aprovado' ? '#10b981' : (st === 'Recusado' ? '#ef4444' : '#f59e0b');

            return `
            <div class="tablet-card" style="background: ${bgCor}; border-color: ${borderCor}; padding: 14px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px; gap:8px;">
                    <strong style="color:#fff;">O.S. #${r.os_id || 'N/A'} • <span style="color:#60a5fa;">${placaOS}</span></strong>
                    <span style="background:${borderCor}; color:#fff; padding:3px 9px; border-radius:6px; font-size:0.78rem; font-weight:bold;">${st}</span>
                </div>
                <div style="color:#f8fafc; font-size:1.05rem; font-weight:bold; margin-bottom:6px;">${pecaCod}${pecaNome}</div>
                <div style="display:flex; justify-content:space-between; color:#cbd5e1; font-size:0.9rem;">
                    <span>Qtd: <strong>${r.quantidade}</strong></span>
                    <span>Local: <strong>${r.compartimento || 'GERAL'}</strong></span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                    <span style="color:#94a3b8; font-size:0.8rem;"><i class="fas fa-user"></i> ${r.mecanico || 'Não registrado'}</span>
                    ${st === 'Pendente' ? `<button type="button" onclick="mecanicoCancelarPeca(${r.id})" style="background:rgba(239,68,68,0.15); border:1px solid #ef4444; color:#fca5a5; padding:5px 10px; border-radius:6px; font-size:0.8rem; font-weight:700; cursor:pointer;"><i class="fas fa-trash"></i> Cancelar</button>` : ''}
                </div>
            </div>`;
        }).join('');
        
    } else if (mOS_AbaAtiva === 'sos') {
        const container = document.getElementById('tabelaServicosSOS');
        const sosAbertas = mOS_ListaGeral.filter(os => os.tipo && os.tipo.startsWith('S.O.S') && matchBuscaOS(os));
        
        if (sosAbertas.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#94a3b8; width:100%; grid-column:1/-1; padding:20px;">Nenhum chamado S.O.S em aberto.</p>';
            return;
        }

        container.innerHTML = sosAbertas.map(os => {
            const local = os.localizacao_sos || '';
            let linkMapa = ''; let ref = '';
            if (local.includes('http')) {
                const partes = local.split(' | Ref: ');
                linkMapa = partes[0].trim();
                ref = partes.length > 1 ? partes[1].trim() : '';
            }

            let acaoHTML = '';
            if (os.status === 'Aguardando Oficina' || os.status === 'Aberta' || os.status === 'Pendente') {
                acaoHTML = `<button class="btn-acao-grande" style="background: #10b981; color: white;" onclick="abrirModalAssumirOS(${os.id}, '${os.placa}')">🚗 ASSUMIR SOCORRO</button>`;
            } else if (os.status === 'Em Manutenção') {
                acaoHTML = `<div style="background:#3b82f6; color:#fff; padding:10px; border-radius:8px; text-align:center; font-weight:bold;">EM ATEND. (${os.mecanico_responsavel})</div>`;
            }

            return `
            <div class="tablet-card" style="border-left: 5px solid #f97316; background: #1e293b;">
                <div class="card-header-flex">
                    <span class="card-badge" style="background: #f97316;">S.O.S #${os.numero_os || os.id}</span>
                    <span class="sla-pill"><i class="fas fa-stopwatch"></i> ${calcularTempoDecorrido(os.data_abertura)}</span>
                </div>
                <div class="card-placa" style="color: #f97316;">${os.placa} <span style="font-size:0.85rem; color:#94a3b8; font-weight:normal;">(${os.status})</span></div>
                ${mecanicoObterInfoFrota(os.placa)}
                <div class="card-info-text"><strong>Problema:</strong> ${os.problema}</div>
                ${ref ? `<div class="card-info-text"><strong>Ref:</strong> ${ref}</div>` : ''}
                ${linkMapa ? `<a href="${linkMapa}" target="_blank" style="background:rgba(59,130,246,0.1); color:#60a5fa; padding:10px; border-radius:8px; text-align:center; text-decoration:none; font-weight:bold; margin: 10px 0; display:block;"><i class="fas fa-map-marker-alt"></i> ABRIR GPS NO CELULAR</a>` : ''}
                <div class="card-actions">${acaoHTML}</div>
            </div>`;
        }).join('');
    }
};

// ==================== ASSUMIR, FINALIZAR E DEVOLVER O.S. ====================
window.abrirModalAssumirOS = function(id, placa) {
    const inputId = document.getElementById('assumirOsId');
    const spanPlaca = document.getElementById('assumirOsPlaca');
    const select = document.getElementById('selMecanicoAssumir');
    const modal = document.getElementById('modalAssumirOS');
    if (!inputId || !select || !modal) return;

    inputId.value = id;
    if (spanPlaca) spanPlaca.innerText = placa;
    
    const userAtual = mecanicoPegarUsuario();
    const listaMecs = [...mMecanicosCache];
    if (!listaMecs.includes(userAtual)) { listaMecs.push(userAtual); listaMecs.sort(); }

    select.innerHTML = listaMecs.map(nome => `<option value="${nome}">${nome}</option>`).join('');
    select.value = userAtual;
    modal.style.display = 'flex';
};

window.fecharModalAssumirOS = () => {
    const modal = document.getElementById('modalAssumirOS');
    if (modal) modal.style.display = 'none';
};

window.confirmarAssumirOS = async function(e) {
    e.preventDefault();
    const id = document.getElementById('assumirOsId').value;
    const nomeParaSalvar = document.getElementById('selMecanicoAssumir').value;
    
    const res = await Swal.fire({
        title: 'Assumir O.S.',
        text: `Deseja assumir esta O.S. como ${nomeParaSalvar}?`,
        icon: 'question', showCancelButton: true,
        background: '#1e293b', color: '#fff',
        confirmButtonColor: '#3b82f6', cancelButtonColor: '#475569',
        confirmButtonText: 'Sim, Assumir', cancelButtonText: 'Cancelar'
    });
    if (!res.isConfirmed) return;
    
    try {
        const { error } = await window.supabaseClient.from('ordens_servico').update({
            status: 'Em Manutenção',
            mecanico_responsavel: nomeParaSalvar,
            data_inicio_manutencao: new Date().toISOString()
        }).eq('id', id);
        if (error) throw error;
        
        Swal.fire({ icon: 'success', title: 'Sucesso', text: 'O.S. Assumida com sucesso!', background: '#1e293b', color: '#fff', timer: 1800, showConfirmButton: false });
        fecharModalAssumirOS();
        await renderizarTelaServicos();
        mecanicoMudarAba('abertas');
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro ao tentar assumir a O.S.', background: '#1e293b', color: '#fff' });
    }
};

window.abrirModalFinalizarOS = function(id, placa) {
    document.getElementById('finOsId').value = id;
    document.getElementById('finOsPlaca').innerText = placa;
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('finDataConclusao').value = now.toISOString().slice(0, 16);
    document.getElementById('finObservacoes').value = '';
    document.getElementById('modalFinalizarOS').style.display = 'flex';
};
window.fecharModalFinalizarOS = () => document.getElementById('modalFinalizarOS').style.display = 'none';

window.mecanicoConfirmarFinalizacao = async function(e) {
    e.preventDefault();
    const id = document.getElementById('finOsId').value;
    const dataConclusao = document.getElementById('finDataConclusao').value;
    const obsOficina = document.getElementById('finObservacoes').value.trim();

    // Trava de segurança: verifica peças pendentes e mão de obra lançada
    let avisos = [];
    const pecasPendentes = mOS_Requisicoes.filter(r => String(r.os_id) === String(id) && (r.status === 'Pendente' || !r.status));
    if (pecasPendentes.length > 0) {
        avisos.push(`• Existem <b>${pecasPendentes.length} peça(s) pendente(s)</b> aguardando o almoxarifado.`);
    }
    try {
        const { count } = await window.supabaseClient.from('os_servicos_executados').select('id', { count: 'exact', head: true }).eq('os_id', id);
        if (!count || count === 0) {
            avisos.push(`• <b>Nenhuma mão de obra</b> foi lançada nesta O.S. ainda.`);
        }
    } catch (err) {}

    const htmlAviso = avisos.length > 0
        ? `<div style="text-align:left; background:rgba(245,158,11,0.15); border:1px solid #f59e0b; padding:12px; border-radius:8px; margin-bottom:12px; color:#fde68a; font-size:0.9rem;">${avisos.join('<br>')}</div>Deseja finalizar e liberar o veículo mesmo assim?`
        : 'Tem certeza que deseja FINALIZAR esta O.S.? O veículo será liberado.';

    const res = await Swal.fire({
        title: 'Finalizar O.S.',
        html: htmlAviso,
        icon: avisos.length > 0 ? 'warning' : 'question',
        showCancelButton: true,
        background: '#1e293b', color: '#fff',
        confirmButtonColor: '#10b981', cancelButtonColor: '#475569',
        confirmButtonText: 'Sim, Concluir', cancelButtonText: 'Cancelar'
    });
    if (!res.isConfirmed) return;

    try {
        const osOriginal = mOS_ListaGeral.find(o => o.id == id);
        let observacoesAtualizadas = osOriginal ? (osOriginal.observacoes || '') : '';
        if (obsOficina !== '') observacoesAtualizadas += `\n[Oficina - ${mecanicoPegarUsuario()}]: ${obsOficina}`;

        const { error } = await window.supabaseClient.from('ordens_servico').update({
            status: 'Concluída', data_conclusao: dataConclusao, observacoes: observacoesAtualizadas.trim()
        }).eq('id', id);
        if (error) throw error;

        Swal.fire({ icon: 'success', title: 'Concluída!', text: 'O.S. Finalizada com sucesso!', background: '#1e293b', color: '#fff', timer: 1800, showConfirmButton: false });
        fecharModalFinalizarOS();
        await renderizarTelaServicos();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro ao tentar finalizar a O.S.', background: '#1e293b', color: '#fff' });
    }
};

window.mecanicoDevolverOS = async function(id, placa) {
    const res = await Swal.fire({
        title: 'Devolver O.S.',
        text: `Deseja DEVOLVER a O.S. da placa ${placa} para disponíveis?`,
        icon: 'warning', showCancelButton: true,
        background: '#1e293b', color: '#fff',
        confirmButtonColor: '#ef4444', cancelButtonColor: '#475569',
        confirmButtonText: 'Sim, Devolver', cancelButtonText: 'Cancelar'
    });
    if (!res.isConfirmed) return;
    
    try {
        await window.supabaseClient.from('ordens_servico').update({
            status: 'Aguardando Oficina', mecanico_responsavel: null, data_inicio_manutencao: null
        }).eq('id', id);
        await renderizarTelaServicos();
        mecanicoMudarAba('aceite');
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Erro ao devolver OS.', background: '#1e293b', color: '#fff' });
    }
};

// ==================== MODAL APONTAMENTO ====================
window.mecanicoAbrirApontamento = async function(id, placa, previsao) {
    mOS_Atual = id;
    const elPlaca = document.getElementById('apontPlaca');
    if (elPlaca) elPlaca.innerText = placa;
    
    const userAtual = mecanicoPegarUsuario();
    const listaMecs = [...mMecanicosCache];
    if (!listaMecs.includes(userAtual)) { listaMecs.push(userAtual); listaMecs.sort(); }
    const optionsHtml = listaMecs.map(nome => `<option value="${nome}">${nome}</option>`).join('');

    const selectServico = document.getElementById('aponMecanicoServico');
    const selectPeca = document.getElementById('aponMecanicoPeca');
    if (selectServico) { selectServico.innerHTML = optionsHtml; selectServico.value = userAtual; }
    if (selectPeca) { selectPeca.innerHTML = optionsHtml; selectPeca.value = userAtual; }
    
    const inputPrev = document.getElementById('aponPrevisaoGlobal');
    if (inputPrev) {
        if (previsao && previsao !== 'null' && previsao !== 'undefined') {
            const dt = new Date(previsao);
            dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
            inputPrev.value = dt.toISOString().slice(0, 16);
        } else {
            inputPrev.value = '';
        }
    }
    
    const modal = document.getElementById('modalApontamentoOS');
    if (modal) modal.style.display = 'flex';
    
    mecanicoCarregarPecas();
    mecanicoCarregarKits();
    mecanicoMontarPlacasTritrem(placa);
    mecanicoAtualizarTabelasModal();
};

window.mecanicoAplicarAtalhoPrevisao = function(atalho) {
    const inputPrev = document.getElementById('aponPrevisaoGlobal');
    if (!inputPrev) return;
    const alvo = new Date();
    if (atalho === 'amanha08') {
        alvo.setDate(alvo.getDate() + 1);
        alvo.setHours(8, 0, 0, 0);
    } else {
        alvo.setHours(alvo.getHours() + Number(atalho));
    }
    alvo.setMinutes(alvo.getMinutes() - alvo.getTimezoneOffset());
    inputPrev.value = alvo.toISOString().slice(0, 16);
    mecanicoSalvarPrevisaoOS();
};

window.mecanicoAlterarQtdAvulsa = function(delta) {
    const inp = document.getElementById('aponQtdPeca');
    if (!inp) return;
    const atual = parseFloat(inp.value) || 0;
    const novo = Math.max(1, Math.round((atual + delta) * 100) / 100);
    inp.value = novo;
};

function mecanicoMontarPlacasTritrem(placaPrincipal) {
    const divChecks = document.getElementById('aponCheckboxesServico');
    const selP = document.getElementById('aponCompartimentoPeca');
    const data = mOS_FrotasMap[placaPrincipal];
    const baseStyle = "background:rgba(255,255,255,0.05); padding:10px 14px; border-radius:8px; border:1px solid #475569; display:flex; align-items:center; gap:10px; font-weight:bold; cursor:pointer;";
    
    let htmlChecks = `<label style="${baseStyle}"><input type="checkbox" class="chk-comp-servico" value="FROTA (${placaPrincipal})" checked style="transform: scale(1.4);"> 🚚 FROTA</label>`;
    let optsPeca = `<option value="FROTA - ${placaPrincipal}">FROTA</option>`;
    
    if (data) {
        if (data.carreta1) { htmlChecks += `<label style="${baseStyle}"><input type="checkbox" class="chk-comp-servico" value="1ª C (${data.carreta1})" style="transform: scale(1.4);"> 🔗 1ª C</label>`; optsPeca += `<option value="1ª C - ${data.carreta1}">1ª C</option>`; }
        if (data.carreta2) { htmlChecks += `<label style="${baseStyle}"><input type="checkbox" class="chk-comp-servico" value="2ª C (${data.carreta2})" style="transform: scale(1.4);"> 🔗 2ª C</label>`; optsPeca += `<option value="2ª C - ${data.carreta2}">2ª C</option>`; }
        if (data.carreta3) { htmlChecks += `<label style="${baseStyle}"><input type="checkbox" class="chk-comp-servico" value="3ª C (${data.carreta3})" style="transform: scale(1.4);"> 🔗 3ª C</label>`; optsPeca += `<option value="3ª C - ${data.carreta3}">3ª C</option>`; }
    }
    
    if (divChecks) divChecks.innerHTML = htmlChecks;
    if (selP) selP.innerHTML = optsPeca;
}

window.mecanicoSalvarPrevisaoOS = async function() {
    const inputPrev = document.getElementById('aponPrevisaoGlobal');
    if (!inputPrev || !inputPrev.value) {
        Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Defina a data e hora previstas.', background: '#1e293b', color: '#fff' });
        return;
    }
    await window.supabaseClient.from('ordens_servico').update({ previsao_entrega: inputPrev.value }).eq('id', mOS_Atual);
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Previsão salva!', background: '#1e293b', color: '#fff', timer: 1500, showConfirmButton: false });
};

window.mecanicoAddTextoServico = function(texto) {
    const input = document.getElementById('aponDescServico');
    if (input) input.value = input.value ? `${input.value}, ${texto}` : texto;
};

window.mecanicoAddServico = async function() {
    const elDesc = document.getElementById('aponDescServico');
    const elPrev = document.getElementById('aponPrevisaoGlobal');
    const elMecServ = document.getElementById('aponMecanicoServico');
    if (!elDesc) return;
    
    const desc = elDesc.value.trim();
    const mecExecutante = elMecServ ? elMecServ.value : mecanicoPegarUsuario();
    
    if (elPrev && !elPrev.value) {
        Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Defina a Previsão no topo antes de adicionar serviços.', background: '#1e293b', color: '#fff' });
        return;
    }
    const checks = document.querySelectorAll('.chk-comp-servico:checked');
    if (!desc) {
        Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Descreva o serviço ou selecione um atalho.', background: '#1e293b', color: '#fff' });
        return;
    }
    if (checks.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Marque ao menos um compartimento.', background: '#1e293b', color: '#fff' });
        return;
    }

    const comps = Array.from(checks).map(c => c.value).join(' / ');
    let insertData = {
        os_id: mOS_Atual,
        descricao: `[${comps}] ${desc}`,
        tempo_gasto: 'Ver Previsão Global',
        mecanico: mecExecutante
    };
    if (typeof window.injetarFilial === 'function') insertData = window.injetarFilial(insertData);
    
    await window.supabaseClient.from('os_servicos_executados').insert([insertData]);
    elDesc.value = '';
    mecanicoAtualizarTabelasModal();
};

function mecanicoCarregarKits() {
    const selectKit = document.getElementById('aponKitSelecionado');
    if (!selectKit) return;
    selectKit.innerHTML = '<option value="">Selecione um KIT...</option>' +
        mOS_KitsCache.map(k => `<option value="${k.id}">${k.nome}</option>`).join('');
}

// ==================== REVISÃO E LANÇAMENTO DE KIT (COM ESTOQUE E STEPPER) ====================
window.mecanicoAddKit = function() {
    const kitId = document.getElementById('aponKitSelecionado').value;
    const elComp = document.getElementById('aponCompartimentoPeca');
    const elMecPeca = document.getElementById('aponMecanicoPeca');

    if (!kitId) {
        Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Selecione um KIT para lançar.', background: '#1e293b', color: '#fff' });
        return;
    }
    const kit = mOS_KitsCache.find(k => k.id == kitId);
    if (!kit) return Swal.fire({ icon: 'error', title: 'Erro', text: 'Kit não encontrado.', background: '#1e293b', color: '#fff' });

    const comp = elComp ? elComp.value : 'GERAL';
    const mecSolicitante = elMecPeca ? elMecPeca.value : mecanicoPegarUsuario();

    let itensParsed = [];
    try { itensParsed = typeof kit.itens === 'string' ? JSON.parse(kit.itens) : kit.itens; } catch (e) {}

    if (itensParsed.length === 0) {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Este KIT não possui peças cadastradas.', background: '#1e293b', color: '#fff' });
        return;
    }

    window.itensKitRevisaoAtual = JSON.parse(JSON.stringify(itensParsed));
    window.kitRevisaoContexto = { comp, mecanico: mecSolicitante };

    document.getElementById('nomeKitRevisao').innerText = kit.nome;
    window.renderizarItensKitRevisao();
    document.getElementById('modalRevisaoKit').style.display = 'flex';
};

window.fecharModalRevisaoKit = function() {
    document.getElementById('modalRevisaoKit').style.display = 'none';
    const selKit = document.getElementById('aponKitSelecionado');
    if (selKit) selKit.value = '';
};

window.mecanicoAlterarQtdKit = function(index, delta) {
    const item = window.itensKitRevisaoAtual[index];
    if (!item) return;
    item.quantidade = Math.max(1, Math.round((parseFloat(item.quantidade || 0) + delta) * 100) / 100);
    window.renderizarItensKitRevisao();
};

window.renderizarItensKitRevisao = function() {
    const container = document.getElementById('listaItensKitRevisao');
    if (!container) return;

    if (window.itensKitRevisaoAtual.length === 0) {
        container.innerHTML = '<p style="padding:15px; text-align:center; color:#f87171;">Todos os itens foram removidos. Cancele a operação fechando a janela.</p>';
        return;
    }

    container.innerHTML = window.itensKitRevisaoAtual.map((item, index) => {
        const codigo = item.codigo ? `[${item.codigo}] ` : '';
        const pecaReal = mOS_PecasMap[item.peca_id];
        const saldo = pecaReal ? parseFloat(pecaReal.quantidade || 0) : 0;
        const temSaldo = saldo >= parseFloat(item.quantidade || 0);
        const badgeSaldo = `<span style="display:inline-block; margin-top:4px; font-size:0.78rem; font-weight:700; padding:2px 7px; border-radius:4px; background:${temSaldo ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.2)'}; color:${temSaldo ? '#34d399' : '#fca5a5'};">Estoque: ${saldo} ${pecaReal ? pecaReal.unidade || 'UN' : 'UN'}</span>`;

        return `
        <div style="padding:12px; border-bottom:1px solid #334155; display:flex; justify-content:space-between; align-items:center; gap: 10px; flex-wrap:wrap;">
            <div style="flex: 1; min-width:180px; line-height: 1.3;">
                <strong style="color:#fff; font-size: 0.95rem;">${codigo}${item.nome}</strong><br>
                ${badgeSaldo}
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <div class="qty-stepper" style="height:40px;">
                    <button type="button" style="width:36px; font-size:1.1rem;" onclick="mecanicoAlterarQtdKit(${index}, -1)">−</button>
                    <input type="number" step="0.01" min="0.01" value="${item.quantidade}" style="width:55px; font-size:0.95rem;"
                        onchange="window.itensKitRevisaoAtual[${index}].quantidade = parseFloat(this.value); window.renderizarItensKitRevisao();">
                    <button type="button" style="width:36px; font-size:1.1rem;" onclick="mecanicoAlterarQtdKit(${index}, 1)">+</button>
                </div>
                <button type="button" onclick="mecanicoRemoverItemKitRevisao(${index})" style="background:rgba(239,68,68,0.1); border:1px solid #ef4444; color:#ef4444; font-size:1.05rem; padding:8px 11px; border-radius:8px; cursor: pointer;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>`;
    }).join('');
};

window.mecanicoRemoverItemKitRevisao = function(index) {
    window.itensKitRevisaoAtual.splice(index, 1);
    window.renderizarItensKitRevisao();
};

window.mecanicoConfirmarKitRevisao = async function() {
    if (window.itensKitRevisaoAtual.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Atenção', text: 'O KIT está vazio.', background: '#1e293b', color: '#fff' });
        return;
    }

    const inserts = [];
    window.itensKitRevisaoAtual.forEach(item => {
        if (item.quantidade > 0) {
            let insertPeca = {
                os_id: mOS_Atual,
                peca_id: item.peca_id,
                quantidade: item.quantidade,
                compartimento: window.kitRevisaoContexto.comp,
                status: 'Pendente',
                mecanico: window.kitRevisaoContexto.mecanico
            };
            if (typeof window.injetarFilial === 'function') insertPeca = window.injetarFilial(insertPeca);
            inserts.push(insertPeca);
        }
    });

    if (inserts.length === 0) return;

    const res = await window.supabaseClient.from('os_pecas_utilizadas').insert(inserts);
    if (res.error) {
        Swal.fire({ icon: 'error', title: 'Erro', text: "Erro ao requisitar KIT: " + res.error.message, background: '#1e293b', color: '#fff' });
        return;
    }

    window.fecharModalRevisaoKit();
    Swal.fire({ icon: 'success', title: 'Lançado!', text: 'KIT requisitado com sucesso ao almoxarifado.', background: '#1e293b', color: '#fff', timer: 1800, showConfirmButton: false });
    renderizarTelaServicos();
    mecanicoAtualizarTabelasModal();
};

// ==================== AUTOCOMPLETE DE PEÇAS ====================
window.mecanicoToggleLista = function() {
    const container = document.getElementById('listaPecasCustom');
    const inputPeca = document.getElementById('pesquisaPeca');
    if (!container || !inputPeca) return;
    if (container.style.display === 'block') container.style.display = 'none';
    else { inputPeca.focus(); mecanicoFiltrarPecasDebounced(true); }
};

let timerPecasDebounce;
window.mecanicoFiltrarPecasDebounced = function(forcarMostrar = false) {
    clearTimeout(timerPecasDebounce);
    timerPecasDebounce = setTimeout(() => mecanicoFiltrarPecasExec(forcarMostrar), 250);
};

window.mecanicoFiltrarPecas = function(forcarMostrar = false) {
    window.mecanicoFiltrarPecasDebounced(forcarMostrar);
};

function mecanicoFiltrarPecasExec(forcarMostrar = false) {
    const input = document.getElementById('pesquisaPeca');
    const elCat = document.getElementById('filtroCategoriaPeca');
    const container = document.getElementById('listaPecasCustom');
    const btnLimpar = document.getElementById('btnLimparPesquisa');
    if (!input || !container) return;

    const termo = input.value.trim().toLowerCase();
    const cat = elCat ? elCat.value : '';
    if (btnLimpar) btnLimpar.style.display = termo.length > 0 ? 'flex' : 'none';
    if (termo.length === 0 && !forcarMostrar) { container.style.display = 'none'; return; }

    let filtradas = mOS_PecasCache.filter(p => {
        const matchTermo = termo === "" || p.nome.toLowerCase().includes(termo) || (p.codigo && p.codigo.toLowerCase().includes(termo));
        const matchCat = cat === "" || p.categoria === cat;
        return matchTermo && matchCat;
    });

    let msgLimite = '';
    if (filtradas.length > 50 && termo === "") {
        filtradas = filtradas.slice(0, 50);
        msgLimite = `<div style="padding:10px; text-align:center; color:#fbbf24; font-size:0.85rem; background:rgba(245, 158, 11, 0.1); border-bottom:1px solid #334155;">Mostrando as primeiras 50 peças. Digite para buscar.</div>`;
    }

    if (filtradas.length === 0) {
        container.innerHTML = '<div style="padding:15px; text-align:center; color:#94a3b8;">Nenhuma peça encontrada.</div>';
    } else {
        container.innerHTML = msgLimite + filtradas.map(x => {
            const codigo = x.codigo ? x.codigo : '';
            const corEst = parseFloat(x.quantidade || 0) > 0 ? '#10b981' : '#f87171';
            return `
            <div class="peca-item" onclick="mecanicoSelecionarPecaCustom(${x.id}, '${x.nome.replace(/'/g, "\\'")}', '${codigo}')">
                <div class="peca-item-info">
                    <span class="peca-item-nome">${x.nome}</span>
                    ${codigo ? `<span class="peca-item-codigo"><i class="fas fa-barcode"></i> ${codigo}</span>` : ''}
                </div>
                <div class="peca-item-estoque" style="color:${corEst};">
                    <i class="fas fa-box"></i> ${x.quantidade} ${x.unidade || 'UN'}
                </div>
            </div>`;
        }).join('');
    }
    container.style.display = 'block';
}

window.mecanicoSelecionarPecaCustom = function(id, nome, codigo) {
    const inputId = document.getElementById('aponPecaId');
    const inputPesquisa = document.getElementById('pesquisaPeca');
    const listCustom = document.getElementById('listaPecasCustom');
    const inputQtd = document.getElementById('aponQtdPeca');

    if (inputId) inputId.value = id;
    if (inputPesquisa) inputPesquisa.value = codigo ? `[${codigo}] ${nome}` : nome;
    if (listCustom) listCustom.style.display = 'none';
    if (inputQtd) { inputQtd.focus(); inputQtd.select(); }
};

window.mecanicoLimparPesquisaPeca = function() {
    const inputPeca = document.getElementById('pesquisaPeca');
    const inputId = document.getElementById('aponPecaId');
    const listaCustom = document.getElementById('listaPecasCustom');
    const btnLimpar = document.getElementById('btnLimparPesquisa');
    if (inputPeca) inputPeca.value = '';
    if (inputId) inputId.value = '';
    if (listaCustom) listaCustom.style.display = 'none';
    if (btnLimpar) btnLimpar.style.display = 'none';
};

document.addEventListener('click', function(e) {
    const searchBox = document.getElementById('pesquisaPeca');
    const list = document.getElementById('listaPecasCustom');
    const btnShow = document.getElementById('btnMostrarLista');
    if (searchBox && list && e.target !== searchBox && !list.contains(e.target) && e.target !== btnShow && !(btnShow && btnShow.contains(e.target))) {
        list.style.display = 'none';
    }
});

// ==================== ADICIONAR / CANCELAR PEÇA E LISTAR ====================
window.mecanicoAddPeca = async function() {
    const elPecaId = document.getElementById('aponPecaId');
    const elComp = document.getElementById('aponCompartimentoPeca');
    const elMecPeca = document.getElementById('aponMecanicoPeca');
    const elQtd = document.getElementById('aponQtdPeca');
    if (!elPecaId || !elQtd) return;

    const pecaIdVal = elPecaId.value;
    const comp = elComp ? elComp.value : 'GERAL';
    const mecSolicitante = elMecPeca ? elMecPeca.value : mecanicoPegarUsuario();
    const qtd = parseFloat(elQtd.value);

    if (!pecaIdVal || qtd <= 0) {
        Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Pesquise e SELECIONE a peça na lista, e informe a quantidade.', background: '#1e293b', color: '#fff' });
        return;
    }

    let insertPeca = {
        os_id: mOS_Atual,
        peca_id: Number(pecaIdVal),
        quantidade: qtd,
        compartimento: comp,
        status: 'Pendente',
        mecanico: mecSolicitante
    };
    if (typeof window.injetarFilial === 'function') insertPeca = window.injetarFilial(insertPeca);

    const res = await window.supabaseClient.from('os_pecas_utilizadas').insert([insertPeca]);
    if (res.error) {
        Swal.fire({ icon: 'error', title: 'Erro', text: "Erro ao requisitar peça: " + res.error.message, background: '#1e293b', color: '#fff' });
        return;
    }

    elQtd.value = '1';
    mecanicoLimparPesquisaPeca();
    Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1800, background: '#1e293b', color: '#fff', icon: 'success', title: 'Peça solicitada!' });
    renderizarTelaServicos();
    mecanicoAtualizarTabelasModal();
};

window.mecanicoCancelarPeca = async function(reqId) {
    const res = await Swal.fire({
        title: 'Cancelar Requisição',
        text: 'Deseja cancelar este pedido pendente antes da separação?',
        icon: 'warning', showCancelButton: true,
        background: '#1e293b', color: '#fff',
        confirmButtonColor: '#ef4444', cancelButtonColor: '#475569',
        confirmButtonText: 'Sim, Cancelar', cancelButtonText: 'Manter'
    });
    if (!res.isConfirmed) return;

    const { error } = await window.supabaseClient.from('os_pecas_utilizadas').delete().eq('id', reqId);
    if (error) {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Não foi possível cancelar a requisição.', background: '#1e293b', color: '#fff' });
        return;
    }
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Requisição cancelada!', showConfirmButton: false, timer: 1600, background: '#1e293b', color: '#fff' });
    if (mOS_Atual) mecanicoAtualizarTabelasModal();
    renderizarTelaServicos();
};

async function mecanicoAtualizarTabelasModal() {
    const { data: s } = await window.supabaseClient.from('os_servicos_executados').select('*').eq('os_id', mOS_Atual).order('id');
    const tabelaServicos = document.getElementById('tabelaServicosLancados');
    if (tabelaServicos) {
        tabelaServicos.innerHTML = (s && s.length > 0) ? s.map(item => `
            <div style="padding:12px; border-bottom:1px solid #334155; display:flex; justify-content:space-between; align-items:center;">
                <div style="flex: 1; padding-right: 10px;">
                    <strong style="color:#fff; font-size: 0.95rem;">${item.descricao}</strong>
                    <span style="color:#94a3b8; font-size:0.8rem; display:block; margin-top:4px;"><i class="fas fa-user-wrench"></i> ${item.mecanico || mecanicoPegarUsuario()}</span>
                </div>
                <button type="button" onclick="mecanicoRemoverServico(${item.id})" style="background:transparent; border:none; color:#ef4444; font-size:1.35rem; padding:5px; cursor:pointer;"><i class="fas fa-trash"></i></button>
            </div>
        `).join('') : '<p style="padding:15px; text-align:center; color:#94a3b8;">Nenhum serviço lançado.</p>';
    }

    const { data: p } = await window.supabaseClient.from('os_pecas_utilizadas').select('*').eq('os_id', mOS_Atual).order('id');
    const tabelaPecas = document.getElementById('tabelaPecasLancadas');
    if (tabelaPecas) {
        tabelaPecas.innerHTML = (p && p.length > 0) ? p.map(item => {
            const pecaObj = mOS_PecasMap[item.peca_id];
            const pNome = pecaObj ? pecaObj.nome : 'Peça Indisponível';
            const pCodigo = (pecaObj && pecaObj.codigo) ? `[${pecaObj.codigo}] ` : '';
            const st = item.status || 'Pendente';
            const corBadge = st === 'Pendente' ? '#f59e0b' : (st === 'Aprovado' ? '#10b981' : '#ef4444');
            return `
            <div style="padding:12px; border-bottom:1px solid #334155; display:flex; justify-content:space-between; align-items:center; gap:8px;">
                <div style="flex: 1;">
                    <span style="color:#10b981; font-weight:bold; font-size:0.8rem;">[${item.compartimento || 'GERAL'}]</span> <strong style="color:#fff;">${item.quantidade}x ${pCodigo}${pNome}</strong>
                    <span style="color:#94a3b8; font-size:0.8rem; display:block; margin-top:4px;"><i class="fas fa-user"></i> Solicitado por: ${item.mecanico || mecanicoPegarUsuario()}</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="background:${corBadge}; color:#fff; padding:4px 8px; border-radius:4px; font-size:0.78rem; font-weight:bold;">${st}</span>
                    ${st === 'Pendente' ? `<button type="button" onclick="mecanicoCancelarPeca(${item.id})" title="Cancelar pedido" style="background:transparent; border:none; color:#ef4444; font-size:1.25rem; padding:4px; cursor:pointer;"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            </div>`;
        }).join('') : '<p style="padding:15px; text-align:center; color:#94a3b8;">Nenhuma peça requisitada.</p>';
    }
}

async function mecanicoCarregarPecas() {
    if (mOS_PecasCache.length === 0) {
        let query = window.supabaseClient.from('almoxarifado_pecas').select('*').order('nome');
        if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
        const { data } = await query;
        mOS_PecasCache = data || [];
        mOS_PecasMap = {};
        mOS_PecasCache.forEach(p => mOS_PecasMap[p.id] = p);
    }
    
    const selectCat = document.getElementById('filtroCategoriaPeca');
    if (selectCat) {
        const categorias = [...new Set(mOS_PecasCache.map(p => p.categoria).filter(Boolean))].sort();
        selectCat.innerHTML = '<option value="">Buscar em Todas</option>' +
            categorias.map(c => `<option value="${c}">${c}</option>`).join('');
        selectCat.value = '';
    }
    mecanicoLimparPesquisaPeca();
}

window.mecanicoFecharModal = () => {
    const modal = document.getElementById('modalApontamentoOS');
    if (modal) modal.style.display = 'none';
    mOS_Atual = null;
    renderizarTelaServicos();
};

function mecanicoPegarUsuario() {
    if (window.mecanicoNomeCompletoCache) return window.mecanicoNomeCompletoCache;
    const s = localStorage.getItem('ccol_user_session');
    if (s) {
        const sessionObj = JSON.parse(s);
        return sessionObj.nome_completo || sessionObj.nome || sessionObj.username;
    }
    return 'Mecânico';
}

window.mecanicoRemoverServico = async (id) => {
    const res = await Swal.fire({
        title: 'Remover Serviço',
        text: 'Deseja realmente remover esta Mão de Obra?',
        icon: 'warning', showCancelButton: true,
        background: '#1e293b', color: '#fff',
        confirmButtonColor: '#ef4444', cancelButtonColor: '#475569',
        confirmButtonText: 'Sim, Remover'
    });
    if (res.isConfirmed) {
        await window.supabaseClient.from('os_servicos_executados').delete().eq('id', id);
        mecanicoAtualizarTabelasModal();
    }
};