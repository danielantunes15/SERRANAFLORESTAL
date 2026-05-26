// ==================== js/servicos.js ====================

let mOS_Atual = null;
let mOS_PecasCache = [];
let mOS_ListaGeral = [];
let mOS_Requisicoes = []; 
let mOS_AbaAtiva = 'aceite';
let mapaSOSMecanicoInstance = null;

window.renderizarTelaServicos = async function() {
    try {
        let queryOS = window.supabaseClient.from('ordens_servico').select('*').in('status', ['Aguardando Oficina', 'Em Manutenção']).order('data_abertura', { ascending: false });
        if (typeof window.aplicarFiltroFilial === 'function') queryOS = window.aplicarFiltroFilial(queryOS);
        
        const { data: osData, error: osError } = await queryOS;
            
        if (osError) throw osError;
        mOS_ListaGeral = osData || [];
        
        const usuarioLogado = mecanicoPegarUsuario();
        const osDesteMecanico = mOS_ListaGeral.filter(os => os.mecanico_responsavel === usuarioLogado).map(os => os.id);
        
        if (osDesteMecanico.length > 0) {
            let queryReq = window.supabaseClient.from('os_pecas_utilizadas').select(`*, almoxarifado_pecas(nome)`).in('os_id', osDesteMecanico).order('id', { ascending: false });
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
    
    document.getElementById('btnAbaSOS').classList.remove('active', 'active-sos');
    if (aba === 'sos') {
        document.getElementById('btnAbaSOS').classList.add('active-sos');
    }
    
    document.getElementById('divServAceite').style.display = aba === 'aceite' ? 'block' : 'none';
    document.getElementById('divServAbertas').style.display = aba === 'abertas' ? 'block' : 'none';
    document.getElementById('divServRequisicoes').style.display = aba === 'requisicoes' ? 'block' : 'none';
    document.getElementById('divServSOS').style.display = aba === 'sos' ? 'block' : 'none';
    
    if (aba === 'sos') {
        setTimeout(() => {
            mecanicoInicializarMapaSOS();
        }, 300);
    }
    
    mecanicoRenderizarTabelas();
};

window.mecanicoInicializarMapaSOS = function() {
    if (mapaSOSMecanicoInstance !== null) {
        mapaSOSMecanicoInstance.remove();
        mapaSOSMecanicoInstance = null;
    }

    mapaSOSMecanicoInstance = L.map('mapaSOSMecanico').setView([-17.9754, -39.7336], 7);

    L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        attribution: '© Google Maps',
        maxZoom: 20
    }).addTo(mapaSOSMecanicoInstance);

    const sosAbertas = mOS_ListaGeral.filter(os => os.tipo && os.tipo.startsWith('S.O.S'));
    const bounds = [];

    sosAbertas.forEach(os => {
        let local = os.localizacao_sos || '';
        if (local.includes('http')) {
            let parts = local.split(' | Ref: ');
            let link = parts[0].trim();
            
            let match = link.match(/(-?\d+\.\d+),(-?\d+\.\d+)/);
            if (match) {
                let lat = parseFloat(match[1]);
                let lng = parseFloat(match[2]);
                
                let popupMsg = `<div style="text-align: center; line-height: 1.4;">
                                    <b style="color: #ef4444; font-size: 1.1rem;">🚨 S.O.S O.S #${os.id}</b><br>
                                    <b>Placa:</b> ${os.placa || '-'}<br>
                                    <b>Motorista:</b> ${os.motorista || '-'}<br>
                                    <b>Problema:</b> ${os.problema || 'Não informado'}<br><br>
                                    <a href="${link}" target="_blank" style="background: #3b82f6; color: white; padding: 5px 10px; border-radius: 4px; text-decoration: none; display: inline-block;">Abrir GPS no Celular</a>
                                </div>`;
                
                L.marker([lat, lng]).addTo(mapaSOSMecanicoInstance).bindPopup(popupMsg);
                bounds.push([lat, lng]);
            }
        }
    });

    if (bounds.length > 0) {
        mapaSOSMecanicoInstance.fitBounds(bounds, { padding: [30, 30] });
    } else {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(function(position) {
                mapaSOSMecanicoInstance.setView([position.coords.latitude, position.coords.longitude], 12);
            });
        }
    }
};

function mecanicoAtualizarContadores() {
    const usuario = mecanicoPegarUsuario();
    const osDisponiveisNormais = mOS_ListaGeral.filter(os => os.status === 'Aguardando Oficina' && !(os.tipo && os.tipo.startsWith('S.O.S')));
    const countAceite = osDisponiveisNormais.length;
    
    const countAbertas = mOS_ListaGeral.filter(os => os.status === 'Em Manutenção' && os.mecanico_responsavel === usuario).length;
    const countReq = mOS_Requisicoes.filter(r => r.status === 'Pendente').length;
    
    const countSOS = mOS_ListaGeral.filter(os => os.tipo && os.tipo.startsWith('S.O.S')).length;
    
    document.getElementById('countAceite').innerText = countAceite;
    document.getElementById('countAbertas').innerText = countAbertas;
    document.getElementById('countRequisicoes').innerText = countReq;
    document.getElementById('countSOS').innerText = countSOS;
}

function mecanicoRenderizarTabelas() {
    const usuarioLogado = mecanicoPegarUsuario();
    
    if (mOS_AbaAtiva === 'aceite') {
        const tbody = document.getElementById('tabelaServicosDisponiveis');
        const osDisponiveis = mOS_ListaGeral.filter(os => os.status === 'Aguardando Oficina' && !(os.tipo && os.tipo.startsWith('S.O.S')));
        
        if (osDisponiveis.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#94a3b8;">Nenhuma O.S. normal aguardando aceite.</td></tr>';
            return;
        }

        tbody.innerHTML = osDisponiveis.map(os => `
            <tr>
                <td style="font-weight:bold; color:#fff;">#${os.id}</td>
                <td style="color:#94a3b8;">${formatarDataHoraBrasil(os.data_abertura)}</td>
                <td><strong style="color:var(--ccol-blue-bright); font-size:1.1rem;">${os.placa}</strong></td>
                <td style="font-size:0.85rem;">${os.problema || 'Sem descrição'}</td>
                <td style="text-align:right;">
                    <button style="background: #10b981; color: white; border: none; padding: 10px 15px; border-radius: 6px; font-weight: bold; cursor: pointer; width: 100%; white-space: nowrap;" onclick="mecanicoAceitarOS(${os.id}, '${os.placa}')">ACEITAR O.S.</button>
                </td>
            </tr>
        `).join('');
        
    } else if (mOS_AbaAtiva === 'abertas') {
        const container = document.getElementById('listaMinhasOSAbertas');
        const minhasOs = mOS_ListaGeral.filter(os => os.status === 'Em Manutenção' && os.mecanico_responsavel === usuarioLogado);
        
        if (minhasOs.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:40px;">Você não possui O.S. em execução.</p>';
            return;
        }

        container.innerHTML = minhasOs.map(os => {
            const isSOS = os.tipo && os.tipo.startsWith('S.O.S');
            const colorTag = isSOS ? '#f97316' : '#10b981';
            const tagNome = isSOS ? 'EMERGÊNCIA (S.O.S) EM EXECUÇÃO' : 'O.S. EM EXECUÇÃO';

            return `
            <div class="card-os-aberta" style="${isSOS ? 'border-left: 5px solid #f97316;' : ''}">
                <div class="os-header-flex">
                    <div style="flex: 1;">
                        <span style="background:${colorTag}; color:#fff; padding:4px 8px; border-radius:4px; font-size:0.75rem; font-weight:bold;">#${os.id} ${tagNome}</span>
                        <h3 style="margin:8px 0; color:#fff; font-size: 1.3rem;">FROTA / CONJUNTO: ${os.placa}</h3>
                        <p style="color:#94a3b8; font-size:0.95rem; margin:0; line-height: 1.4;"><strong>Problema:</strong> ${os.problema}</p>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 250px;">
                        <button style="background: #10b981; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: bold; font-size: 1rem; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 8px;" onclick="abrirModalFinalizarOS(${os.id}, '${os.placa}')">
                            <i class="fas fa-flag-checkered"></i> FINALIZAR O.S.
                        </button>
                        <button style="background: #3b82f6; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: bold; font-size: 1rem; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 8px;" onclick="mecanicoAbrirApontamento(${os.id}, '${os.placa}', '${os.previsao_entrega}')">
                            <i class="fas fa-edit"></i> PREENCHER OFICINA
                        </button>
                        <button style="background: transparent; border: 1px solid #ef4444; color: #ef4444; padding: 10px; border-radius: 8px; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 8px;" onclick="mecanicoDevolverOS(${os.id}, '${os.placa}')">
                            <i class="fas fa-undo"></i> Devolver O.S.
                        </button>
                    </div>
                </div>
            </div>`;
        }).join('');

    } else if (mOS_AbaAtiva === 'requisicoes') {
        const tbody = document.getElementById('tabelaMinhasRequisicoes');
        if (mOS_Requisicoes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#94a3b8;">Nenhuma requisição feita ainda.</td></tr>';
            return;
        }

        tbody.innerHTML = mOS_Requisicoes.map(r => {
            let statusBadge = '';
            if (r.status === 'Pendente' || !r.status) statusBadge = '<span style="background:#f59e0b; color:#fff; padding:4px 8px; border-radius:4px; font-weight:bold; font-size:0.8rem;"><i class="fas fa-clock"></i> Pendente</span>';
            else if (r.status === 'Aprovado') statusBadge = '<span style="background:#10b981; color:#fff; padding:4px 8px; border-radius:4px; font-weight:bold; font-size:0.8rem;"><i class="fas fa-check"></i> Separado</span>';
            else if (r.status === 'Recusado') statusBadge = '<span style="background:#ef4444; color:#fff; padding:4px 8px; border-radius:4px; font-weight:bold; font-size:0.8rem;"><i class="fas fa-times"></i> Recusado</span>';

            return `
            <tr>
                <td style="font-weight:bold; color:#fff;">#${r.os_id}</td>
                <td><strong style="color:var(--ccol-blue-bright);">${r.almoxarifado_pecas?.nome || 'Peça Indisponível'}</strong></td>
                <td>${r.quantidade}</td>
                <td style="color:#94a3b8;">${r.compartimento || 'GERAL'}</td>
                <td style="text-align:right;">${statusBadge}</td>
            </tr>`;
        }).join('');
        
    } else if (mOS_AbaAtiva === 'sos') {
        const tbody = document.getElementById('tabelaServicosSOS');
        const sosAbertas = mOS_ListaGeral.filter(os => os.tipo && os.tipo.startsWith('S.O.S'));
        
        if (sosAbertas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#94a3b8;">Nenhum chamado S.O.S em aberto no momento.</td></tr>';
            return;
        }

        tbody.innerHTML = sosAbertas.map(os => {
            let local = os.localizacao_sos || '';
            let linkMapa = '';
            let ref = '';

            if (local.includes('http')) {
                let partes = local.split(' | Ref: ');
                linkMapa = partes[0].trim();
                ref = partes.length > 1 ? partes[1].trim() : '';
            }

            const inicioStr = formatarDataHoraBrasil(os.data_abertura);

            // TEXTO ESTRUTURADO PARA WHATSAPP
            let textoZap = `🚨 *NOVO CHAMADO DE S.O.S* 🚨%0A`;
            textoZap += `━━━━━━━━━━━━━━━━━━━━━━━%0A`;
            textoZap += `📄 *O.S. Número:* #${os.id}%0A`;
            textoZap += `🚚 *Placa (Conjunto):* ${os.placa || '-'}%0A`;
            textoZap += `👤 *Motorista:* ${os.motorista || '-'}%0A`;
            textoZap += `⏱️ *Horário Abertura:* ${inicioStr}%0A`;
            textoZap += `⚠️ *Tipo:* ${os.tipo || '-'}%0A`;
            textoZap += `━━━━━━━━━━━━━━━━━━━━━━━%0A`;
            textoZap += `🔧 *Problema Relatado:*%0A${os.problema || 'Não detalhado'}%0A`;
            textoZap += `━━━━━━━━━━━━━━━━━━━━━━━%0A`;
            if (ref) textoZap += `📌 *Ponto de Referência:*%0A${ref}%0A%0A`;
            textoZap += `📍 *Abrir Rota no GPS:*%0A${linkMapa || 'Sem link cadastrado'}`;
            
            const urlZap = `https://api.whatsapp.com/send?text=${textoZap}`;

            let btnMapa = linkMapa ? `<a href="${linkMapa}" target="_blank" style="color: #3b82f6; text-decoration: underline;"><i class="fas fa-location-arrow"></i> Ver GPS Celular</a>` : `<span style="color: #9ca3af;">Sem GPS</span>`;
            
            let acaoHTML = '';
            if (os.status === 'Aguardando Oficina') {
                acaoHTML = `<button style="background: #10b981; color: white; border: none; padding: 8px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; width: 100%; white-space: nowrap; margin-bottom: 5px;" onclick="mecanicoAceitarOS(${os.id}, '${os.placa}')">🚗 ASSUMIR SOCORRO</button>`;
                acaoHTML += `<a href="${urlZap}" target="_blank" style="background: #22c55e; color: white; padding: 8px 12px; border-radius: 6px; text-decoration: none; display: block; text-align: center; font-weight: bold;"><i class="fab fa-whatsapp"></i> Repassar WhatsApp</a>`;
            } else if (os.status === 'Em Manutenção' && os.mecanico_responsavel === usuarioLogado) {
                acaoHTML = `<button style="background: #3b82f6; color: white; border: none; padding: 8px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; width: 100%; white-space: nowrap;" onclick="mecanicoMudarAba('abertas')">📝 JÁ ASSUMIDO (IR P/ O.S)</button>`;
            } else {
                acaoHTML = `<div style="color: #f59e0b; font-weight: bold; font-size: 0.85rem; background: rgba(245,158,11,0.1); padding: 8px; border-radius: 6px;">Em Atendimento (${os.mecanico_responsavel || 'Outro'})</div>`;
            }

            return `
            <tr style="background: rgba(249, 115, 22, 0.05); border-left: 3px solid #f97316;">
                <td style="font-weight:bold; color:#fff;">#${os.id}</td>
                <td style="color:#94a3b8; font-size: 0.85rem;">${inicioStr}</td>
                <td><strong style="color:#f97316; font-size:1.1rem;">${os.placa}</strong><br><span style="font-size: 0.8rem; color: #cbd5e1;">Mot: ${os.motorista || '-'}</span></td>
                <td style="font-size:0.85rem;">${os.problema || 'Sem descrição'}</td>
                <td style="font-size:0.85rem;">
                    ${btnMapa}
                    ${ref ? '<br><span style="color:#94a3b8; font-size: 0.8rem;">Ref: ' + ref + '</span>' : ''}
                </td>
                <td style="text-align:right; vertical-align: middle;">
                    ${acaoHTML}
                </td>
            </tr>`;
        }).join('');
    }
}

window.abrirModalFinalizarOS = function(id, placa) {
    document.getElementById('finOsId').value = id;
    document.getElementById('finOsPlaca').innerText = placa;
    
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('finDataConclusao').value = now.toISOString().slice(0, 16);
    document.getElementById('finObservacoes').value = '';
    
    document.getElementById('modalFinalizarOS').style.display = 'flex';
};

window.fecharModalFinalizarOS = function() {
    document.getElementById('modalFinalizarOS').style.display = 'none';
};

window.mecanicoConfirmarFinalizacao = async function(e) {
    e.preventDefault();
    const id = document.getElementById('finOsId').value;
    const dataConclusao = document.getElementById('finDataConclusao').value;
    const obsOficina = document.getElementById('finObservacoes').value.trim();

    if(!confirm('Tem certeza que deseja FINALIZAR esta O.S.? Ela sairá da sua lista de execução e irá para o CCOL.')) return;

    try {
        const osOriginal = mOS_ListaGeral.find(o => o.id == id);
        let observacoesAtualizadas = osOriginal.observacoes || '';
        
        if (obsOficina !== '') {
            observacoesAtualizadas += `\n[Oficina - ${mecanicoPegarUsuario()}]: ${obsOficina}`;
        }

        const { error } = await window.supabaseClient.from('ordens_servico').update({
            status: 'Concluída',
            data_conclusao: dataConclusao,
            observacoes: observacoesAtualizadas.trim()
        }).eq('id', id);

        if(error) throw error;

        alert('O.S. Finalizada com sucesso! Bom trabalho.');
        fecharModalFinalizarOS();
        await renderizarTelaServicos(); 
        
    } catch(err) {
        console.error(err);
        alert('Erro ao tentar finalizar a O.S. Verifique sua conexão.');
    }
};

window.mecanicoAceitarOS = async function(id, placa) {
    if (!confirm(`Deseja assumir o Conjunto ${placa}?`)) return;
    try {
        await window.supabaseClient.from('ordens_servico').update({ 
            status: 'Em Manutenção',
            mecanico_responsavel: mecanicoPegarUsuario(),
            data_inicio_manutencao: new Date().toISOString()
        }).eq('id', id);
        await renderizarTelaServicos();
        mecanicoMudarAba('abertas'); 
    } catch (e) { alert("Erro ao aceitar OS."); }
};

window.mecanicoDevolverOS = async function(id, placa) {
    if (!confirm(`Tem certeza que deseja DEVOLVER a O.S. #${id} (${placa}) para a fila de disponíveis?`)) return;
    try {
        await window.supabaseClient.from('ordens_servico').update({ 
            status: 'Aguardando Oficina',
            mecanico_responsavel: null,
            data_inicio_manutencao: null
        }).eq('id', id);
        await renderizarTelaServicos();
        mecanicoMudarAba('aceite');
    } catch (e) { alert("Erro ao devolver OS."); }
};

window.mecanicoAbrirApontamento = async function(id, placa, previsao) {
    mOS_Atual = id;
    document.getElementById('apontPlaca').innerText = placa;
    document.getElementById('nomeMecanicoLabel').innerText = mecanicoPegarUsuario();
    
    const inputPrev = document.getElementById('aponPrevisaoGlobal');
    if (previsao && previsao !== 'null' && previsao !== 'undefined') {
        inputPrev.value = new Date(new Date(previsao).getTime() - (3 * 3600000)).toISOString().slice(0, 16);
    } else {
        inputPrev.value = '';
    }
    
    document.getElementById('modalApontamentoOS').style.display = 'flex';
    
    await mecanicoCarregarPecas();
    await mecanicoMontarPlacasTritrem(placa);
    mecanicoAtualizarTabelasModal();
};

async function mecanicoMontarPlacasTritrem(placaPrincipal) {
    const divChecks = document.getElementById('aponCheckboxesServico');
    const selP = document.getElementById('aponCompartimentoPeca');
    
    divChecks.innerHTML = '<span style="color:#94a3b8;">Buscando frota...</span>';
    selP.innerHTML = `<option value="FROTA - ${placaPrincipal}">Buscando Frota...</option>`;
    
    let query = window.supabaseClient.from('frotas_manutencao').select('*').or(`cavalo.eq.${placaPrincipal},go.eq.${placaPrincipal}`);
    if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
    const { data } = await query.maybeSingle();
    
    let htmlChecks = `<label style="display:flex; align-items:center; gap:8px; color:#fff; font-size:0.95rem; cursor:pointer; background:rgba(255,255,255,0.05); padding:10px 15px; border-radius:6px; border:1px solid #475569; width: 100%;">
                        <input type="checkbox" class="chk-comp-servico" value="FROTA (${placaPrincipal})" checked style="transform: scale(1.3);"> 🚚 FROTA (${placaPrincipal})
                      </label>`;
    
    let optsPeca = `<option value="FROTA - ${placaPrincipal}">FROTA - ${placaPrincipal}</option>`;
    
    if (data) {
        if (data.carreta1) {
            htmlChecks += `<label style="display:flex; align-items:center; gap:8px; color:#fff; font-size:0.95rem; cursor:pointer; background:rgba(255,255,255,0.05); padding:10px 15px; border-radius:6px; border:1px solid #475569; width: 100%;">
                            <input type="checkbox" class="chk-comp-servico" value="1ª C (${data.carreta1})" style="transform: scale(1.3);"> 🔗 1ª C (${data.carreta1})
                           </label>`;
            optsPeca += `<option value="1ª C - ${data.carreta1}">1ª C - ${data.carreta1}</option>`;
        }
        if (data.carreta2) {
            htmlChecks += `<label style="display:flex; align-items:center; gap:8px; color:#fff; font-size:0.95rem; cursor:pointer; background:rgba(255,255,255,0.05); padding:10px 15px; border-radius:6px; border:1px solid #475569; width: 100%;">
                            <input type="checkbox" class="chk-comp-servico" value="2ª C (${data.carreta2})" style="transform: scale(1.3);"> 🔗 2ª C (${data.carreta2})
                           </label>`;
            optsPeca += `<option value="2ª C - ${data.carreta2}">2ª C - ${data.carreta2}</option>`;
        }
        if (data.carreta3) {
            htmlChecks += `<label style="display:flex; align-items:center; gap:8px; color:#fff; font-size:0.95rem; cursor:pointer; background:rgba(255,255,255,0.05); padding:10px 15px; border-radius:6px; border:1px solid #475569; width: 100%;">
                            <input type="checkbox" class="chk-comp-servico" value="3ª C (${data.carreta3})" style="transform: scale(1.3);"> 🔗 3ª C (${data.carreta3})
                           </label>`;
            optsPeca += `<option value="3ª C - ${data.carreta3}">3ª C - ${data.carreta3}</option>`;
        }
    }
    
    divChecks.innerHTML = htmlChecks;
    selP.innerHTML = optsPeca;
}

window.mecanicoSalvarPrevisaoOS = async function() {
    const novaPrev = document.getElementById('aponPrevisaoGlobal').value;
    if(!novaPrev) return alert("Por favor, defina a data e hora prevista de término.");
    
    await window.supabaseClient.from('ordens_servico').update({ previsao_entrega: novaPrev }).eq('id', mOS_Atual);
    alert("Previsão do conjunto salva!");
};

window.mecanicoAddServico = async function() {
    const desc = document.getElementById('aponDescServico').value.trim();
    const previsao = document.getElementById('aponPrevisaoGlobal').value;

    if (!previsao) return alert("Você deve definir a Previsão de Término no topo antes de adicionar serviços.");

    const checksMarcados = document.querySelectorAll('.chk-comp-servico:checked');
    const compartimentosSelecionados = Array.from(checksMarcados).map(c => c.value).join(' / ');

    if (!desc) return alert("Por favor, descreva o serviço realizado.");
    if (checksMarcados.length === 0) return alert("Marque ao menos um compartimento para este serviço.");

    const descricaoFinal = `[${compartimentosSelecionados}] ${desc}`;
    
    let insertData = { os_id: mOS_Atual, descricao: descricaoFinal, tempo_gasto: 'Ver Previsão Global' };
    if (typeof window.injetarFilial === 'function') insertData = window.injetarFilial(insertData);
    
    const { error } = await window.supabaseClient.from('os_servicos_executados').insert([insertData]);

    if(error) {
        console.error(error);
        return alert("Erro ao salvar serviço.");
    }

    document.getElementById('aponDescServico').value = '';
    mecanicoAtualizarTabelasModal();
};

window.mecanicoAddPeca = async function() {
    const pecaId = document.getElementById('aponPeca').value;
    const comp = document.getElementById('aponCompartimentoPeca').value;
    const qtd = parseFloat(document.getElementById('aponQtdPeca').value);

    if (!pecaId || qtd <= 0) return alert("Selecione a peça e quantidade.");
    
    const pecaDb = mOS_PecasCache.find(p => p.id == pecaId);

    let insertPeca = { os_id: mOS_Atual, peca_id: pecaId, quantidade: qtd, valor_unitario: pecaDb.preco_medio, compartimento: comp, status: 'Pendente' };
    if (typeof window.injetarFilial === 'function') insertPeca = window.injetarFilial(insertPeca);

    const { error } = await window.supabaseClient.from('os_pecas_utilizadas').insert([insertPeca]);
    
    if(error) return alert("Erro ao requisitar peça.");

    document.getElementById('aponQtdPeca').value = '1';
    
    renderizarTelaServicos();
    mecanicoAtualizarTabelasModal();
    alert("Requisição enviada ao Almoxarifado!");
};

window.mecanicoFiltrarPecas = function() {
    const termo = document.getElementById('pesquisaPeca').value.toLowerCase();
    const sel = document.getElementById('aponPeca');
    const filtradas = mOS_PecasCache.filter(p => p.nome.toLowerCase().includes(termo) || (p.codigo && p.codigo.toLowerCase().includes(termo)));
    sel.innerHTML = '<option value="">Selecione a peça...</option>' + 
        filtradas.map(x => `<option value="${x.id}">${x.nome} (Estoque: ${x.quantidade} ${x.unidade||'UN'})</option>`).join('');
};

async function mecanicoAtualizarTabelasModal() {
    const { data: s } = await window.supabaseClient.from('os_servicos_executados').select('*').eq('os_id', mOS_Atual).order('id');
    
    document.getElementById('tabelaServicosLancados').innerHTML = (s && s.length > 0) ? s.map(item => `
        <div style="padding:15px; border-bottom:1px solid #334155; font-size:0.9rem; position:relative; display: flex; justify-content: space-between; align-items: center;">
            <strong style="color:#fff; font-size: 1rem; flex: 1;">${item.descricao}</strong>
            <button onclick="mecanicoRemoverServico(${item.id})" style="background:rgba(239, 68, 68, 0.1); border:1px solid #ef4444; color:#ef4444; border-radius: 6px; padding: 10px; cursor:pointer; margin-left: 10px;"><i class="fas fa-trash"></i></button>
        </div>
    `).join('') : '<p style="padding:15px; text-align:center; color: #94a3b8;">Nenhum serviço lançado ainda.</p>';

    const { data: p } = await window.supabaseClient.from('os_pecas_utilizadas').select(`*, almoxarifado_pecas(nome, unidade)`).eq('os_id', mOS_Atual);
    document.getElementById('tabelaPecasLancadas').innerHTML = (p && p.length > 0) ? p.map(item => `
        <div style="padding:15px; border-bottom:1px solid #334155; font-size:0.9rem; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <span style="color:#10b981; font-weight:bold; display: block; margin-bottom: 5px;">[${item.compartimento || 'GERAL'}]</span> 
                <strong style="font-size: 1rem; color: #fff;">${item.quantidade}${item.almoxarifado_pecas?.unidade || 'UN'} de ${item.almoxarifado_pecas?.nome || 'Peça'}</strong>
            </div>
            <div>
                <span style="background:${(item.status === 'Pendente' || !item.status) ? '#f59e0b' : (item.status === 'Aprovado' ? '#10b981' : '#ef4444')}; color:#fff; padding:4px 8px; border-radius:4px; font-weight:bold; font-size:0.8rem;">
                    ${item.status || 'Pendente'}
                </span>
            </div>
        </div>
    `).join('') : '<p style="padding:15px; text-align:center; color: #94a3b8;">Nenhuma peça requisitada ainda.</p>';
}

async function mecanicoCarregarPecas() {
    let query = window.supabaseClient.from('almoxarifado_pecas').select('*').order('nome');
    if (typeof window.aplicarFiltroFilial === 'function') query = window.aplicarFiltroFilial(query);
    const { data } = await query;
    mOS_PecasCache = data || [];
    document.getElementById('pesquisaPeca').value = ''; 
    mecanicoFiltrarPecas(); 
}

window.mecanicoFecharModal = () => { document.getElementById('modalApontamentoOS').style.display = 'none'; mOS_Atual = null; renderizarTelaServicos(); };
function mecanicoPegarUsuario() { const s = localStorage.getItem('ccol_user_session'); return s ? JSON.parse(s).nome || JSON.parse(s).username : 'Mecânico'; }

window.mecanicoRemoverServico = async (id) => { 
    if(confirm("Deseja remover esta Mão de Obra?")) { 
        await window.supabaseClient.from('os_servicos_executados').delete().eq('id', id); 
        mecanicoAtualizarTabelasModal();
    } 
};