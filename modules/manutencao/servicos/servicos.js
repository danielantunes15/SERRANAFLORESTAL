// ==================== js/servicos.js ====================

let mOS_Atual = null;
let mOS_PecasCache = [];
let mOS_ListaGeral = [];
let mOS_Requisicoes = []; 
let mOS_FrotasCache = []; // Cache global de frotas
let mOS_AbaAtiva = 'aceite';
let mapaSOSMecanicoInstance = null;
window.mecanicoNomeCompletoCache = null; 
let mMecanicosCache = []; 

window.renderizarTelaServicos = async function() {
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

        if (mMecanicosCache.length === 0) {
            let queryUsuarios = window.supabaseClient.from('usuarios').select('username, nome_completo, role').eq('status', 'Ativo');
            
            if (typeof window.aplicarFiltroFilial === 'function') {
                queryUsuarios = window.aplicarFiltroFilial(queryUsuarios);
            }
            
            const { data: usersData } = await queryUsuarios;
            if (usersData) {
                mMecanicosCache = usersData
                    .filter(u => u.role && (u.role.toLowerCase().includes('mecanico') || u.role.toLowerCase().includes('mecânico') || u.role.toLowerCase().includes('borracheiro')))
                    .map(u => (u.nome_completo && u.nome_completo.trim() !== '') ? u.nome_completo : u.username)
                    .sort();
            }
        }

        if (mOS_PecasCache.length === 0) {
            let qPecas = window.supabaseClient.from('almoxarifado_pecas').select('*');
            if (typeof window.aplicarFiltroFilial === 'function') qPecas = window.aplicarFiltroFilial(qPecas);
            const { data: cachePecas } = await qPecas;
            mOS_PecasCache = cachePecas || [];
        }

        // Cache das frotas para exibir GO e placas extras
        if (mOS_FrotasCache.length === 0) {
            let qFrotas = window.supabaseClient.from('frotas_manutencao').select('*');
            if (typeof window.aplicarFiltroFilial === 'function') qFrotas = window.aplicarFiltroFilial(qFrotas);
            const { data: cacheFrotas } = await qFrotas;
            mOS_FrotasCache = cacheFrotas || [];
        }

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
            let queryReq = window.supabaseClient.from('os_pecas_utilizadas').select(`*`).in('os_id', osEmExecucao).order('id', { ascending: false });
            if (typeof window.aplicarFiltroFilial === 'function') queryReq = window.aplicarFiltroFilial(queryReq);
            const { data: reqData } = await queryReq;
            mOS_Requisicoes = reqData || [];
        } else {
            mOS_Requisicoes = [];
        }
        
        mecanicoAtualizarContadores();
        mecanicoRenderizarTabelas();
    } catch (e) {
        console.error("Erro ao carregar serviços:", e);
    }
};

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
        let local = os.localizacao_sos || '';
        if (local.includes('http')) {
            let parts = local.split(' | Ref: ');
            let match = parts[0].trim().match(/(-?\d+\.\d+),(-?\d+\.\d+)/);
            if (match) {
                let lat = parseFloat(match[1]); let lng = parseFloat(match[2]);
                let popupMsg = `<div style="text-align:center;"><b>🚨 S.O.S O.S #${os.numero_os || os.id}</b><br><b>Placa:</b> ${os.placa}<br><a href="${parts[0].trim()}" target="_blank">Abrir GPS</a></div>`;
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

// Helper para montar as informações de GO e Carretas nos cards
function mecanicoObterInfoFrota(placa) {
    if (!placa) return '';
    const frota = mOS_FrotasCache.find(f => f.cavalo === placa || f.go === placa);
    if (!frota) return '';
    
    let html = `<div style="font-size: 0.85rem; color: #94a3b8; margin-top: 5px; margin-bottom: 8px; background: rgba(0,0,0,0.2); padding: 6px 10px; border-radius: 6px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">`;
    if (frota.go) html += `<span><strong style="color: #cbd5e1;">GO:</strong> ${frota.go}</span>`;
    if (frota.carreta1) html += `<span><strong style="color: #cbd5e1;">C1:</strong> ${frota.carreta1}</span>`;
    if (frota.carreta2) html += `<span><strong style="color: #cbd5e1;">C2:</strong> ${frota.carreta2}</span>`;
    if (frota.carreta3) html += `<span><strong style="color: #cbd5e1;">C3:</strong> ${frota.carreta3}</span>`;
    html += `</div>`;
    return html;
}

function mecanicoRenderizarTabelas() {
    if (mOS_AbaAtiva === 'aceite') {
        const container = document.getElementById('tabelaServicosDisponiveis');
        const osDisp = mOS_ListaGeral.filter(os => 
            os.status !== 'Em Manutenção' && 
            os.status !== 'Agendada' &&
            !(os.tipo && os.tipo.startsWith('S.O.S'))
        );
        
        if (osDisp.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#94a3b8; width:100%; grid-column:1/-1;">Nenhuma O.S. aguardando aceite.</p>';
            return;
        }

        container.innerHTML = osDisp.map(os => `
            <div class="tablet-card" style="border-left: 5px solid #3b82f6;">
                <div class="card-header-flex">
                    <span class="card-badge" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa;">#${os.numero_os || os.id}</span>
                    <span style="color:#94a3b8; font-size:0.85rem;"><i class="fas fa-clock"></i> ${formatarDataHoraBrasil(os.data_abertura)}</span>
                </div>
                <div class="card-placa">${os.placa} <span style="font-size:0.85rem; color:#94a3b8; font-weight:normal; vertical-align:middle;">(${os.status})</span></div>
                ${mecanicoObterInfoFrota(os.placa)}
                <div class="card-info-text"><strong style="color:#fff;">Mot:</strong> ${os.motorista || '-'}</div>
                <div class="card-info-text" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;"><strong>Problema:</strong> ${os.problema || 'Sem descrição'}</div>
                <div class="card-actions">
                    <button class="btn-acao-grande" style="background: #10b981; color: white;" onclick="abrirModalAssumirOS(${os.id}, '${os.placa}')"><i class="fas fa-hand-holding-medical"></i> Assumir Serviço</button>
                </div>
            </div>
        `).join('');
        
    } else if (mOS_AbaAtiva === 'abertas') {
        const container = document.getElementById('listaMinhasOSAbertas');
        const abertasOs = mOS_ListaGeral.filter(os => os.status === 'Em Manutenção');
        
        if (abertasOs.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#94a3b8; width:100%; grid-column:1/-1;">Não há O.S. em execução.</p>';
            return;
        }

        container.innerHTML = abertasOs.map(os => {
            const isSOS = os.tipo && os.tipo.startsWith('S.O.S');
            const colorBorder = isSOS ? '#f97316' : '#10b981';
            const meucard = os.mecanico_responsavel === mecanicoPegarUsuario();

            return `
            <div class="tablet-card" style="border-left: 6px solid ${colorBorder}; ${meucard ? 'background: rgba(16, 185, 129, 0.05);' : ''}">
                <div class="card-header-flex">
                    <span class="card-badge" style="background: ${colorBorder};">#${os.numero_os || os.id} ${isSOS ? 'S.O.S' : 'EM EXECUÇÃO'}</span>
                    <span style="color:#94a3b8; font-size:0.85rem;">Responsável: <strong style="color:#fff;">${os.mecanico_responsavel}</strong></span>
                </div>
                <div class="card-placa" style="color: ${colorBorder};">${os.placa}</div>
                ${mecanicoObterInfoFrota(os.placa)}
                <div class="card-info-text" style="height: 40px; overflow: hidden; text-overflow: ellipsis;">${os.problema}</div>
                
                <div style="border-top: 1px solid #334155; margin-top: 15px; padding-top: 15px; display: flex; flex-direction: column; gap: 10px;">
                    <div class="card-actions row-tablet" style="margin-top: 0;">
                        <button class="btn-acao-grande" style="background: #3b82f6; color: white; font-size:1rem;" onclick="mecanicoAbrirApontamento(${os.id}, '${os.placa}', '${os.previsao_entrega}')"><i class="fas fa-edit"></i> Preencher</button>
                        <button class="btn-acao-grande" style="background: #10b981; color: white; font-size:1rem;" onclick="abrirModalFinalizarOS(${os.id}, '${os.placa}')"><i class="fas fa-flag-checkered"></i> Finalizar</button>
                    </div>
                    <button style="background:transparent; border:1px solid #ef4444; color:#ef4444; padding:12px; border-radius:10px; font-weight:bold; width:100%; display:flex; justify-content:center; align-items:center; gap:8px;" onclick="mecanicoDevolverOS(${os.id}, '${os.placa}')"><i class="fas fa-undo"></i> Devolver O.S.</button>
                </div>
            </div>`;
        }).join('');

    } else if (mOS_AbaAtiva === 'requisicoes') {
        const container = document.getElementById('tabelaMinhasRequisicoes');
        if (mOS_Requisicoes.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#94a3b8; width:100%; grid-column:1/-1;">Nenhuma requisição feita ainda.</p>';
            return;
        }

        container.innerHTML = mOS_Requisicoes.map(r => {
            const pecaObj = mOS_PecasCache.find(p => p.id == r.peca_id);
            const pecaNome = pecaObj ? pecaObj.nome : 'Peça Indisponível';
            const pecaCod = (pecaObj && pecaObj.codigo) ? `[${pecaObj.codigo}] ` : '';
            let bgCor = r.status === 'Aprovado' ? 'rgba(16, 185, 129, 0.1)' : (r.status === 'Recusado' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)');
            let borderCor = r.status === 'Aprovado' ? '#10b981' : (r.status === 'Recusado' ? '#ef4444' : '#f59e0b');

            return `
            <div class="tablet-card" style="background: ${bgCor}; border-color: ${borderCor}; padding: 12px;">
                <div style="display:flex; justify-content:space-between; margin-bottom: 5px;">
                    <strong style="color:#fff;">Ref. ID OS: #${r.os_id || 'N/A'}</strong>
                    <span style="background:${borderCor}; color:#fff; padding:2px 8px; border-radius:4px; font-size:0.8rem; font-weight:bold;">${r.status || 'Pendente'}</span>
                </div>
                <div style="color:#3b82f6; font-size:1.1rem; font-weight:bold; margin-bottom:5px;">${pecaCod}${pecaNome}</div>
                <div style="display:flex; justify-content:space-between; color:#cbd5e1; font-size:0.9rem;">
                    <span>Qtd: <strong>${r.quantidade}</strong></span>
                    <span>Local: <strong>${r.compartimento || 'GERAL'}</strong></span>
                </div>
                <div style="color:#94a3b8; font-size:0.8rem; margin-top:5px;"><i class="fas fa-user"></i> Solicitante: ${r.mecanico || 'Não registrado'}</div>
            </div>`;
        }).join('');
        
    } else if (mOS_AbaAtiva === 'sos') {
        const container = document.getElementById('tabelaServicosSOS');
        const sosAbertas = mOS_ListaGeral.filter(os => os.tipo && os.tipo.startsWith('S.O.S'));
        
        if (sosAbertas.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#94a3b8; width:100%; grid-column:1/-1;">Nenhum chamado S.O.S em aberto.</p>';
            return;
        }

        container.innerHTML = sosAbertas.map(os => {
            let local = os.localizacao_sos || '';
            let linkMapa = ''; let ref = '';
            if (local.includes('http')) {
                let partes = local.split(' | Ref: ');
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
                    <span style="color:#94a3b8; font-size:0.85rem;">${formatarDataHoraBrasil(os.data_abertura)}</span>
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
}

// ==========================================
// FUNÇÕES PARA ASSUMIR SERVIÇO COM MODAL
// ==========================================
window.abrirModalAssumirOS = function(id, placa) {
    const inputId = document.getElementById('assumirOsId');
    const spanPlaca = document.getElementById('assumirOsPlaca');
    const select = document.getElementById('selMecanicoAssumir');
    const modal = document.getElementById('modalAssumirOS');

    if (!inputId || !select || !modal) {
        alert("Erro: O layout do Modal não foi encontrado. Atualize a página (pressione F5 ou limpe o cache) e verifique o arquivo servicos.html.");
        return;
    }

    inputId.value = id;
    if (spanPlaca) spanPlaca.innerText = placa;
    
    let optionsHtml = '';
    const userAtual = mecanicoPegarUsuario();
    let listaMecs = [...mMecanicosCache];
    
    if (!listaMecs.includes(userAtual)) {
        listaMecs.push(userAtual);
        listaMecs.sort();
    }

    listaMecs.forEach(nome => {
        optionsHtml += `<option value="${nome}">${nome}</option>`;
    });
    
    select.innerHTML = optionsHtml;
    select.value = userAtual; 

    modal.style.display = 'flex';
};

window.fecharModalAssumirOS = () => {
    const modal = document.getElementById('modalAssumirOS');
    if(modal) modal.style.display = 'none';
};

window.confirmarAssumirOS = async function(e) {
    e.preventDefault();
    const id = document.getElementById('assumirOsId').value;
    const nomeParaSalvar = document.getElementById('selMecanicoAssumir').value;
    
    if (!confirm(`Deseja assumir esta O.S. como ${nomeParaSalvar}?`)) return;
    
    try {
        const { error } = await window.supabaseClient.from('ordens_servico').update({ 
            status: 'Em Manutenção', 
            mecanico_responsavel: nomeParaSalvar, 
            data_inicio_manutencao: new Date().toISOString()
        }).eq('id', id);
        
        if (error) throw error;
        
        alert('O.S. Assumida com sucesso!');
        fecharModalAssumirOS();
        await renderizarTelaServicos();
        mecanicoMudarAba('abertas'); 
    } catch (err) { 
        alert("Erro ao tentar assumir a O.S."); 
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

    if(!confirm('Tem certeza que deseja FINALIZAR esta O.S.?')) return;

    try {
        const osOriginal = mOS_ListaGeral.find(o => o.id == id);
        let observacoesAtualizadas = osOriginal.observacoes || '';
        if (obsOficina !== '') observacoesAtualizadas += `\n[Oficina - ${mecanicoPegarUsuario()}]: ${obsOficina}`;

        const { error } = await window.supabaseClient.from('ordens_servico').update({
            status: 'Concluída', data_conclusao: dataConclusao, observacoes: observacoesAtualizadas.trim()
        }).eq('id', id);

        if(error) throw error;

        alert('O.S. Finalizada com sucesso!');
        fecharModalFinalizarOS();
        await renderizarTelaServicos(); 
    } catch(err) { alert('Erro ao tentar finalizar a O.S.'); }
};

window.mecanicoDevolverOS = async function(id, placa) {
    if (!confirm(`Deseja DEVOLVER a O.S. para disponíveis?`)) return;
    try {
        await window.supabaseClient.from('ordens_servico').update({ 
            status: 'Aguardando Oficina', mecanico_responsavel: null, data_inicio_manutencao: null
        }).eq('id', id);
        await renderizarTelaServicos();
        mecanicoMudarAba('aceite');
    } catch (e) { alert("Erro ao devolver OS."); }
};

window.mecanicoAbrirApontamento = async function(id, placa, previsao) {
    mOS_Atual = id;
    const elPlaca = document.getElementById('apontPlaca');
    if (elPlaca) elPlaca.innerText = placa;
    
    let optionsHtml = '';
    const userAtual = mecanicoPegarUsuario();
    let listaMecs = [...mMecanicosCache];
    
    if (!listaMecs.includes(userAtual)) {
        listaMecs.push(userAtual);
        listaMecs.sort();
    }

    listaMecs.forEach(nome => {
        optionsHtml += `<option value="${nome}">${nome}</option>`;
    });

    const selectServico = document.getElementById('aponMecanicoServico');
    const selectPeca = document.getElementById('aponMecanicoPeca');
    
    if (selectServico) {
        selectServico.innerHTML = optionsHtml;
        selectServico.value = userAtual;
    }
    if (selectPeca) {
        selectPeca.innerHTML = optionsHtml;
        selectPeca.value = userAtual;
    }
    
    const inputPrev = document.getElementById('aponPrevisaoGlobal');
    if (inputPrev) {
        if (previsao && previsao !== 'null' && previsao !== 'undefined') {
            inputPrev.value = new Date(new Date(previsao).getTime() - (3 * 3600000)).toISOString().slice(0, 16);
        } else { 
            inputPrev.value = ''; 
        }
    }
    
    const modal = document.getElementById('modalApontamentoOS');
    if (modal) modal.style.display = 'flex';
    
    await mecanicoCarregarPecas();
    await mecanicoMontarPlacasTritrem(placa);
    mecanicoAtualizarTabelasModal();
};

async function mecanicoMontarPlacasTritrem(placaPrincipal) {
    const divChecks = document.getElementById('aponCheckboxesServico');
    const selP = document.getElementById('aponCompartimentoPeca');
    
    let query = window.supabaseClient.from('frotas_manutencao').select('*').or(`cavalo.eq.${placaPrincipal},go.eq.${placaPrincipal}`);
    if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
    const { data } = await query.maybeSingle();
    
    const baseStyle = "background:rgba(255,255,255,0.05); padding:10px 15px; border-radius:8px; border:1px solid #475569; display:flex; align-items:center; gap:10px; font-weight:bold; cursor:pointer;";
    
    let htmlChecks = `<label style="${baseStyle}"><input type="checkbox" class="chk-comp-servico" value="FROTA (${placaPrincipal})" checked style="transform: scale(1.5);"> 🚚 FROTA</label>`;
    let optsPeca = `<option value="FROTA - ${placaPrincipal}">FROTA</option>`;
    
    if (data) {
        if (data.carreta1) { htmlChecks += `<label style="${baseStyle}"><input type="checkbox" class="chk-comp-servico" value="1ª C (${data.carreta1})" style="transform: scale(1.5);"> 🔗 1ª C</label>`; optsPeca += `<option value="1ª C - ${data.carreta1}">1ª C</option>`; }
        if (data.carreta2) { htmlChecks += `<label style="${baseStyle}"><input type="checkbox" class="chk-comp-servico" value="2ª C (${data.carreta2})" style="transform: scale(1.5);"> 🔗 2ª C</label>`; optsPeca += `<option value="2ª C - ${data.carreta2}">2ª C</option>`; }
        if (data.carreta3) { htmlChecks += `<label style="${baseStyle}"><input type="checkbox" class="chk-comp-servico" value="3ª C (${data.carreta3})" style="transform: scale(1.5);"> 🔗 3ª C</label>`; optsPeca += `<option value="3ª C - ${data.carreta3}">3ª C</option>`; }
    }
    
    if (divChecks) divChecks.innerHTML = htmlChecks;
    if (selP) selP.innerHTML = optsPeca;
}

window.mecanicoSalvarPrevisaoOS = async function() {
    const inputPrev = document.getElementById('aponPrevisaoGlobal');
    if (!inputPrev) return;
    const novaPrev = inputPrev.value;
    if(!novaPrev) return alert("Defina a data prevista.");
    await window.supabaseClient.from('ordens_servico').update({ previsao_entrega: novaPrev }).eq('id', mOS_Atual);
    alert("Previsão salva!");
};

window.mecanicoAddTextoServico = function(texto) {
    const input = document.getElementById('aponDescServico');
    if (input) {
        if (input.value) {
            input.value = input.value + ", " + texto;
        } else {
            input.value = texto;
        }
    }
};

window.mecanicoAddServico = async function() {
    const elDesc = document.getElementById('aponDescServico');
    const elPrev = document.getElementById('aponPrevisaoGlobal');
    const elMecServ = document.getElementById('aponMecanicoServico');

    if (!elDesc) return;
    
    const desc = elDesc.value.trim();
    const previsao = elPrev ? elPrev.value : 'Ver Previsão Global';
    const mecExecutante = elMecServ ? elMecServ.value : mecanicoPegarUsuario();
    
    if (elPrev && !elPrev.value) return alert("Defina a Previsão no topo antes de adicionar serviços.");
    
    const checks = document.querySelectorAll('.chk-comp-servico:checked');
    if (!desc) return alert("Descreva o serviço ou selecione um atalho.");
    if (checks.length === 0) return alert("Marque ao menos um compartimento.");

    const comps = Array.from(checks).map(c => c.value).join(' / ');
    const descricaoFinal = `[${comps}] ${desc}`;
    
    let insertData = { 
        os_id: mOS_Atual, 
        descricao: descricaoFinal, 
        tempo_gasto: 'Ver Previsão Global',
        mecanico: mecExecutante
    };
    if (typeof window.injetarFilial === 'function') insertData = window.injetarFilial(insertData);
    
    await window.supabaseClient.from('os_servicos_executados').insert([insertData]);
    elDesc.value = '';
    mecanicoAtualizarTabelasModal();
};

window.mecanicoToggleLista = function() {
    const container = document.getElementById('listaPecasCustom');
    const inputPeca = document.getElementById('pesquisaPeca');
    if (!container || !inputPeca) return;

    if (container.style.display === 'block') {
        container.style.display = 'none';
    } else {
        inputPeca.focus();
        mecanicoFiltrarPecas(true);
    }
};

window.mecanicoFiltrarPecas = function(forcarMostrar = false) {
    const input = document.getElementById('pesquisaPeca');
    const elCat = document.getElementById('filtroCategoriaPeca');
    const container = document.getElementById('listaPecasCustom');
    const btnLimpar = document.getElementById('btnLimparPesquisa');

    if (!input || !container) return;

    const termo = input.value.trim().toLowerCase();
    const cat = elCat ? elCat.value : '';

    if (termo.length > 0 && btnLimpar) {
        btnLimpar.style.display = 'flex';
    } else if (btnLimpar) {
        btnLimpar.style.display = 'none';
    }

    if (termo.length === 0 && !forcarMostrar) {
        container.style.display = 'none';
        return;
    }

    let filtradas = mOS_PecasCache.filter(p => {
        const matchTermo = termo === "" || p.nome.toLowerCase().includes(termo) || (p.codigo && p.codigo.toLowerCase().includes(termo));
        const matchCat = cat === "" || p.categoria === cat;
        return matchTermo && matchCat;
    });

    let msgLimite = '';
    if (filtradas.length > 100 && termo === "") {
        filtradas = filtradas.slice(0, 100);
        msgLimite = `<div style="padding:10px; text-align:center; color:#fbbf24; font-size:0.85rem; background:rgba(245, 158, 11, 0.1); border-bottom:1px solid #334155;">Mostrando as 100 primeiras peças. Digite para buscar mais.</div>`;
    }

    if (filtradas.length === 0) {
        container.innerHTML = '<div style="padding:15px; text-align:center; color:#94a3b8;">Nenhuma peça encontrada.</div>';
    } else {
        container.innerHTML = msgLimite + filtradas.map(x => {
            const codigo = x.codigo ? x.codigo : '';
            return `
            <div class="peca-item" onclick="mecanicoSelecionarPecaCustom(${x.id}, '${x.nome.replace(/'/g, "\\'")}', '${codigo}')">
                <div class="peca-item-info">
                    <span class="peca-item-nome">${x.nome}</span>
                    ${codigo ? `<span class="peca-item-codigo"><i class="fas fa-barcode"></i> ${codigo}</span>` : ''}
                </div>
                <div class="peca-item-estoque">
                    <i class="fas fa-box"></i> ${x.quantidade} ${x.unidade||'UN'}
                </div>
            </div>`;
        }).join('');
    }
    
    container.style.display = 'block';
};

window.mecanicoSelecionarPecaCustom = function(id, nome, codigo) {
    const inputId = document.getElementById('aponPecaId');
    const inputPesquisa = document.getElementById('pesquisaPeca');
    const listCustom = document.getElementById('listaPecasCustom');
    const inputQtd = document.getElementById('aponQtdPeca');

    if(inputId) inputId.value = id;
    
    const desc = codigo ? `[${codigo}] ${nome}` : nome;
    if(inputPesquisa) inputPesquisa.value = desc;
    
    if(listCustom) listCustom.style.display = 'none';
    
    if(inputQtd) {
        inputQtd.focus();
        inputQtd.select();
    }
};

window.mecanicoLimparPesquisaPeca = function() {
    const inputPeca = document.getElementById('pesquisaPeca');
    const inputId = document.getElementById('aponPecaId');
    const listaCustom = document.getElementById('listaPecasCustom');
    const btnLimpar = document.getElementById('btnLimparPesquisa');

    if(inputPeca) inputPeca.value = '';
    if(inputId) inputId.value = '';
    if(listaCustom) listaCustom.style.display = 'none';
    if(btnLimpar) btnLimpar.style.display = 'none';
};

document.addEventListener('click', function(e) {
    const searchBox = document.getElementById('pesquisaPeca');
    const list = document.getElementById('listaPecasCustom');
    const btnShow = document.getElementById('btnMostrarLista');
    if(searchBox && list && e.target !== searchBox && !list.contains(e.target) && e.target !== btnShow && !(btnShow && btnShow.contains(e.target))) {
        list.style.display = 'none';
    }
});

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
        return alert("Por favor, pesquise e SELECIONE a peça clicando nela na lista, e informe a quantidade.");
    }
    
    const pecaId = Number(pecaIdVal);

    let insertPeca = { 
        os_id: mOS_Atual, 
        peca_id: pecaId, 
        quantidade: qtd, 
        compartimento: comp, 
        status: 'Pendente',
        mecanico: mecSolicitante
    };
    
    if (typeof window.injetarFilial === 'function') insertPeca = window.injetarFilial(insertPeca);

    let res = await window.supabaseClient.from('os_pecas_utilizadas').insert([insertPeca]);

    if(res.error) return alert("Erro ao requisitar peça. Mensagem do BD: " + res.error.message);

    elQtd.value = '1';
    mecanicoLimparPesquisaPeca();
    
    renderizarTelaServicos();
    mecanicoAtualizarTabelasModal();
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
                <button onclick="mecanicoRemoverServico(${item.id})" style="background:transparent; border:none; color:#ef4444; font-size:1.4rem; padding:5px;"><i class="fas fa-trash"></i></button>
            </div>
        `).join('') : '<p style="padding:15px; text-align:center; color:#94a3b8;">Nenhum serviço lançado.</p>';
    }

    const { data: p } = await window.supabaseClient.from('os_pecas_utilizadas').select(`*`).eq('os_id', mOS_Atual).order('id');
    const tabelaPecas = document.getElementById('tabelaPecasLancadas');

    if (tabelaPecas) {
        tabelaPecas.innerHTML = (p && p.length > 0) ? p.map(item => {
            const pecaObj = mOS_PecasCache.find(x => x.id == item.peca_id);
            const pNome = pecaObj ? pecaObj.nome : 'Peça Indisponível';
            const pCodigo = (pecaObj && pecaObj.codigo) ? `[${pecaObj.codigo}] ` : '';
            return `
            <div style="padding:12px; border-bottom:1px solid #334155; display:flex; justify-content:space-between; align-items:center;">
                <div style="flex: 1; padding-right: 10px;">
                    <span style="color:#10b981; font-weight:bold; font-size:0.8rem;">[${item.compartimento||'GERAL'}]</span> <strong style="color:#fff;">${item.quantidade}x ${pCodigo}${pNome}</strong>
                    <span style="color:#94a3b8; font-size:0.8rem; display:block; margin-top:4px;"><i class="fas fa-user"></i> Solicitado por: ${item.mecanico || mecanicoPegarUsuario()}</span>
                </div>
                <span style="background:${(item.status==='Pendente'||!item.status)?'#f59e0b':(item.status==='Aprovado'?'#10b981':'#ef4444')}; color:#fff; padding:4px 8px; border-radius:4px; font-size:0.8rem; font-weight:bold; height: fit-content;">${item.status || 'Pendente'}</span>
            </div>`;
        }).join('') : '<p style="padding:15px; text-align:center; color:#94a3b8;">Nenhuma peça requisitada.</p>';
    }
}

async function mecanicoCarregarPecas() {
    let query = window.supabaseClient.from('almoxarifado_pecas').select('*').order('nome');
    if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
    const { data } = await query;
    mOS_PecasCache = data || [];
    
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
    if(modal) modal.style.display = 'none'; 
    mOS_Atual = null; 
    renderizarTelaServicos(); 
};

function mecanicoPegarUsuario() { 
    if (window.mecanicoNomeCompletoCache) {
        return window.mecanicoNomeCompletoCache;
    }
    const s = localStorage.getItem('ccol_user_session'); 
    if (s) {
        const sessionObj = JSON.parse(s);
        return sessionObj.nome_completo || sessionObj.nome || sessionObj.username;
    }
    return 'Mecânico'; 
}

window.mecanicoRemoverServico = async (id) => { 
    if(confirm("Deseja remover esta Mão de Obra?")) { 
        await window.supabaseClient.from('os_servicos_executados').delete().eq('id', id); 
        mecanicoAtualizarTabelasModal();
    } 
};