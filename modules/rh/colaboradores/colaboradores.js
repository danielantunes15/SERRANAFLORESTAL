// ==================== js/colaboradores.js ====================
window.listaColaboradoresDb = [];
window.colaboradoresFiltradosRH = [];
window.listaCursosAtivos = [];
window.filtroPendenciasAtivo = false;

// Variáveis de Paginação
window.paginaAtualRH = 1;
window.itensPorPaginaRH = 15;

// Campos Base Obrigatórios (Incluindo Setor, Função, ASO e Toxicológico)
window.camposBaseObrigatorios = [
    { key: 'cpf', id: 'colCpf' },
    { key: 'rg', id: 'colRg' },
    { key: 'data_nascimento', id: 'colDataNascimento' },
    { key: 'data_admissao', id: 'colDataAdmissao' },
    { key: 'funcao', id: 'colFuncao' },
    { key: 'setor_id', id: 'colSetorId' },
    { key: 'telefone', id: 'colTelefone' },
    { key: 'endereco', id: 'colEndereco' },
    { key: 'aso_vencimento', id: 'colAsoVencimento' },
    { key: 'toxicologico_vencimento', id: 'colToxicologico' }
];

// FUNÇÃO AUXILIAR PARA RESGATAR A FILIAL DO USUÁRIO NO RH
window.obterFilialUsuarioLogadoRH = function() {
    return (window.currentUser && window.currentUser.filial_id && window.currentUser.filial_id !== 'CENTRAL') 
        ? parseInt(window.currentUser.filial_id) : null;
};

window.initRHColaboradores = async function() {
    document.getElementById('viewListagemColaboradores').style.display = 'block';
    document.getElementById('viewFichaColaborador').style.display = 'none';
    
    // Limpa campos da barra antes de carregar
    const elNome = document.getElementById('filtroNome');
    const elMat = document.getElementById('filtroMatricula');
    if(elNome) elNome.value = '';
    if(elMat) elMat.value = '';
    
    window.filtroPendenciasAtivo = false;
    window.paginaAtualRH = 1;
    
    await window.carregarSetoresGlobal(); 
    await window.carregarCursosGlobais();
    await window.carregarCargosControladoria(); 
    
    await window.carregarColaboradoresLista();
};

// ==================== AÇÕES RÁPIDAS E EFETIVAÇÃO ====================
window.toggleActionMenu = function(id) {
    document.querySelectorAll('.action-dropdown-menu').forEach(m => {
        if (m.id !== `action-menu-${id}`) m.style.display = 'none';
    });
    const menu = document.getElementById(`action-menu-${id}`);
    if (menu) menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
};

document.addEventListener('click', function(e) {
    if(!e.target.closest('.action-menu-container')) {
        document.querySelectorAll('.action-dropdown-menu').forEach(m => m.style.display = 'none');
    }
});

window.efetivarColaborador = async function(id, nome) {
    if(confirm(`Deseja realmente efetivar ${nome}?\nO contrato passará de Temporário (Experiência) para CLT e os alertas de encerramento serão removidos.`)) {
        try {
            await db.updateColaborador(id, { tipo_contrato: 'CLT' });
            if (typeof window.registrarLogAuditoria === 'function') {
                window.registrarLogAuditoria('RH', 'Efetivação', `Colaborador efetivado (CLT): ${nome}`, 'Info');
            }
            alert('Colaborador efetivado com sucesso!');
            await window.carregarColaboradoresLista();
        } catch (e) {
            console.error(e);
            alert('Erro ao efetivar o colaborador. Verifique sua conexão.');
        }
    }
};

// ==================== PAGINAÇÃO E FILTROS ====================
window.carregarColaboradoresLista = async function() {
    try {
        const tbody = document.getElementById('tbListaColaboradores');
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Carregando banco de dados...</td></tr>`;
        
        window.listaColaboradoresDb = await db.getColaboradores();
        window.filtrarColaboradoresLista(); 
    } catch (e) {
        console.error(e);
        alert("Erro ao carregar lista de colaboradores.");
    }
};

window.toggleFiltroPendencias = function() {
    window.filtroPendenciasAtivo = !window.filtroPendenciasAtivo;
    const btn = document.getElementById('btnFiltroPendencias');
    if(window.filtroPendenciasAtivo) {
        btn.classList.remove('btn-danger-outline');
        btn.classList.add('btn-danger-block');
        btn.innerHTML = '<i class="fas fa-filter"></i> Filtrando Pendentes';
    } else {
        btn.classList.remove('btn-danger-block');
        btn.classList.add('btn-danger-outline');
        btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Pendências';
    }
    window.filtrarColaboradoresLista();
};

window.filtrarColaboradoresLista = function() {
    const elNome = document.getElementById('filtroNome');
    const elMat = document.getElementById('filtroMatricula');
    const elSetor = document.getElementById('filtroSetorLista');
    
    if (!elNome || !elMat || !elSetor) return;

    const termoNome = elNome.value.toLowerCase().trim();
    const termoMatricula = elMat.value.toLowerCase().trim();
    const termoSetor = elSetor.value; 
    
    window.colaboradoresFiltradosRH = window.listaColaboradoresDb.filter(c => {
        const nomeMatch = !termoNome || (c.nome && c.nome.toLowerCase().includes(termoNome)) || (c.funcao && c.funcao.toLowerCase().includes(termoNome));
        const matMatch = !termoMatricula || (c.cod_funcionario && String(c.cod_funcionario).includes(termoMatricula));
        const setorMatch = !termoSetor || (String(c.setor_id) === String(termoSetor));
        
        let pendenciaMatch = true;
        if (window.filtroPendenciasAtivo) {
            if(c.status === 'Inativo' || c.status === 'Desligado') {
                pendenciaMatch = false;
            } else {
                let f1 = window.verificarPendenciasCadastro(c);
                let f2 = window.analisarVencimentosColaborador(c);
                pendenciaMatch = (f1.length > 0 || f2.length > 0);
            }
        }
        
        return nomeMatch && matMatch && setorMatch && pendenciaMatch;
    });
    
    window.paginaAtualRH = 1;
    window.renderizarTabelaPaginadaRH();
};

window.mudarPaginaRH = function(direcao) {
    const totalPaginas = Math.ceil(window.colaboradoresFiltradosRH.length / window.itensPorPaginaRH);
    window.paginaAtualRH += direcao;
    
    if (window.paginaAtualRH < 1) window.paginaAtualRH = 1;
    if (window.paginaAtualRH > totalPaginas) window.paginaAtualRH = totalPaginas;
    
    window.renderizarTabelaPaginadaRH();
};

window.renderizarTabelaPaginadaRH = function() {
    const tbody = document.getElementById('tbListaColaboradores');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const totalItens = window.colaboradoresFiltradosRH.length;
    
    if (totalItens === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#9ca3af; padding: 20px;">Nenhum colaborador encontrado com os filtros aplicados.</td></tr>`;
        document.getElementById('infoPaginacaoRH').innerText = 'Mostrando 0 a 0 de 0';
        document.getElementById('displayPageRH').innerText = '1';
        document.getElementById('btnPagePrevRH').disabled = true;
        document.getElementById('btnPageNextRH').disabled = true;
        return;
    }
    
    const totalPaginas = Math.ceil(totalItens / window.itensPorPaginaRH);
    if (window.paginaAtualRH > totalPaginas) window.paginaAtualRH = totalPaginas;
    
    const startIndex = (window.paginaAtualRH - 1) * window.itensPorPaginaRH;
    const endIndex = Math.min(startIndex + window.itensPorPaginaRH, totalItens);
    
    const itensPagina = window.colaboradoresFiltradosRH.slice(startIndex, endIndex);
    const fmtDtTabela = (d) => d ? d.split('-').reverse().join('/') : '-';

    itensPagina.forEach(c => {
        let corStatus = 'var(--ccol-green-bright)';
        if(c.status === 'Inativo' || c.status === 'Desligado') corStatus = '#ef4444';
        else if(c.status === 'Férias' || c.status === 'Afastado') corStatus = '#f59e0b';
        
        const matriculaFormatada = c.cod_funcionario ? String(c.cod_funcionario).padStart(4, '0') : 'S/ Matrícula';
        
        const pendencias = window.verificarPendenciasCadastro(c);
        let badgeAlertaFaltando = '';
        if (pendencias.length > 0 && c.status !== 'Inativo' && c.status !== 'Desligado') {
            let desc = pendencias.map(p => p.nome || p.key).join(', ');
            badgeAlertaFaltando = `<span title="Cadastro / Documentação Incompleta (${pendencias.length} pendências):\n${desc}" style="color: #ef4444; margin-right: 8px; font-size: 1.1rem; cursor: help;"><i class="fas fa-exclamation-triangle"></i></span>`;
        }

        let badgeVencimentos = '';
        if (c.status !== 'Inativo' && c.status !== 'Desligado') {
            let vencimentos = window.analisarVencimentosColaborador(c);
            if (vencimentos.length > 0) {
                let msg = vencimentos.map(v => `${v.nome} (${v.status})`).join('\n');
                let corPior = vencimentos.some(v => v.status === 'Vencido' || v.status === 'Efetivar ou Desligar') ? '#ef4444' : '#f59e0b';
                badgeVencimentos = `<span title="Avisos de Vencimento:\n${msg}" style="color: ${corPior}; margin-right: 8px; font-size: 1.1rem; cursor: help;"><i class="fas fa-clock"></i></span>`;
            }
        }
        
        let alertasHTML = (badgeAlertaFaltando || badgeVencimentos) ? (badgeAlertaFaltando + badgeVencimentos) : '<span style="color: #10b981; font-size:0.85rem;"><i class="fas fa-check-circle"></i> Tudo OK</span>';
        
        const imgAvatar = c.foto_url ? `<img src="${c.foto_url}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-dim);">` : `<div style="width: 32px; height: 32px; border-radius: 50%; background: #3b82f6; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: bold; font-size: 0.8rem;">${c.nome.charAt(0)}</div>`;

        let nomeSetor = 'Sem Setor';
        if (c.setor_id) {
            const selectSetor = document.getElementById('filtroSetorLista');
            if (selectSetor) {
                const option = Array.from(selectSetor.options).find(opt => opt.value == c.setor_id);
                if (option) nomeSetor = option.text;
            }
        }

        let funcaoHtml = `
            <div style="text-align: left;">
                <span style="background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 4px; border: 1px solid var(--border-dim); font-size: 0.85rem; display: inline-block; margin-bottom: 4px; white-space: nowrap;">${c.funcao || 'Função não informada'}</span>
                <div style="font-size: 0.75rem; color: var(--text-secondary); padding-left: 2px;"><i class="fas fa-sitemap"></i> ${nomeSetor}</div>
            </div>
        `;

        let dtAdmissao = fmtDtTabela(c.data_admissao);
        let expFormatada = '-';
        let expStyle = 'color: var(--text-secondary);';
        
        if (c.status === 'Ativo' && c.tipo_contrato === 'Temporário') {
            let expDate = window.getVencimentoExperiencia(c);
            if (expDate) {
                expFormatada = fmtDtTabela(expDate);
                let diasExp = window.diasParaVencer(expDate);
                if (diasExp < 0) {
                    expStyle = 'color: #ef4444; font-weight: bold;'; 
                } else if (diasExp <= 30) {
                    expStyle = 'color: #f59e0b; font-weight: bold;'; 
                } else {
                    expStyle = 'color: var(--ccol-blue-bright);';
                }
            }
        } else if (c.tipo_contrato === 'CLT') {
            expFormatada = '<i class="fas fa-check-circle"></i> Validado';
            expStyle = 'color: #10b981; font-weight: bold;';
        }

        let infoContratoHtml = `
            <div style="font-size: 0.85rem; line-height: 1.5; text-align: left;">
                <div style="color: #94a3b8;">Admissão: <strong style="color: #fff;">${dtAdmissao}</strong></div>
                <div style="color: #94a3b8;">Exp/Status: <span style="${expStyle}">${expFormatada}</span></div>
            </div>
        `;

        let btnEfetivar = '';
        if (c.status === 'Ativo' && c.tipo_contrato === 'Temporário') {
            btnEfetivar = `<button onclick="window.efetivarColaborador('${c.id}', '${c.nome}')"><i class="fas fa-check-double" style="color: #10b981; width: 15px;"></i> Efetivar (Mudar p/ CLT)</button>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong style="color: var(--ccol-blue-bright); font-size: 1.1rem;">${matriculaFormatada}</strong></td>
            <td style="text-align: left; font-weight: bold; font-size: 1rem;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    ${imgAvatar}
                    ${c.nome}
                </div>
            </td>
            <td>${funcaoHtml}</td>
            <td>${infoContratoHtml}</td>
            <td>${alertasHTML}</td>
            <td><span style="color: ${corStatus}; font-weight: bold; font-size: 0.9rem;">${c.status || 'Ativo'}</span></td>
            <td style="text-align: right;">
                <div class="action-menu-container" style="position: relative; display: inline-block; text-align: left;">
                    <button class="btn-secondary-dark" style="padding: 6px 12px; font-size: 0.8rem;" onclick="window.toggleActionMenu('${c.id}')">
                        Ações <i class="fas fa-chevron-down" style="font-size: 0.7rem; margin-left: 5px;"></i>
                    </button>
                    <div id="action-menu-${c.id}" class="action-dropdown-menu">
                        <button onclick="window.abrirFichaCompleta('${c.id}')"><i class="fas fa-folder-open" style="color: var(--ccol-blue-bright); width: 15px;"></i> Abrir Dossiê / Editar</button>
                        ${btnEfetivar}
                        <button onclick="window.imprimirFichaColaborador('${c.id}')"><i class="fas fa-id-card" style="color: #10b981; width: 15px;"></i> Imprimir Ficha RH</button>
                        <button onclick="window.imprimirFichaEPI('${c.id}')"><i class="fas fa-hard-hat" style="color: #f59e0b; width: 15px;"></i> Imprimir Entrega de EPI</button>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    document.getElementById('infoPaginacaoRH').innerText = `Mostrando ${startIndex + 1} a ${endIndex} de ${totalItens}`;
    document.getElementById('displayPageRH').innerText = window.paginaAtualRH;
    document.getElementById('btnPagePrevRH').disabled = window.paginaAtualRH === 1;
    document.getElementById('btnPageNextRH').disabled = window.paginaAtualRH === totalPaginas;
};

// ==================== LÓGICA DE ABAS E HEADER ====================
window.mudarAbaFichaRH = function(abaId) {
    document.querySelectorAll('.rh-tab-content').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('active');
    });
    document.querySelectorAll('.rh-tab-btn').forEach(el => el.classList.remove('active'));
    
    const abaAlvo = document.getElementById(abaId);
    if(abaAlvo) {
        abaAlvo.style.display = 'block';
        abaAlvo.classList.add('active');
    }
    const btnAtivo = document.querySelector(`[onclick="window.mudarAbaFichaRH('${abaId}')"]`);
    if(btnAtivo) btnAtivo.classList.add('active');
};

window.atualizarBadgeStatusHeader = function() {
    const val = document.getElementById('colStatus').value;
    const badge = document.getElementById('displayStatusHeader');
    if(val === 'Ativo') {
        badge.style.background = 'rgba(16, 185, 129, 0.1)';
        badge.style.color = 'var(--ccol-green-bright)';
        badge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        badge.innerHTML = '<i class="fas fa-check-circle"></i> Ativo';
    } else if(val === 'Inativo' || val === 'Desligado') {
        badge.style.background = 'rgba(239, 68, 68, 0.1)';
        badge.style.color = '#ef4444';
        badge.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        badge.innerHTML = '<i class="fas fa-times-circle"></i> Desligado';
    } else if(val === 'Férias') {
        badge.style.background = 'rgba(59, 130, 246, 0.1)';
        badge.style.color = 'var(--ccol-blue-bright)';
        badge.style.borderColor = 'rgba(59, 130, 246, 0.3)';
        badge.innerHTML = '<i class="fas fa-umbrella-beach"></i> Férias';
    } else {
        badge.style.background = 'rgba(245, 158, 11, 0.1)';
        badge.style.color = '#f59e0b';
        badge.style.borderColor = 'rgba(245, 158, 11, 0.3)';
        badge.innerHTML = '<i class="fas fa-briefcase-medical"></i> Afastado';
    }
};

window.previewAvatarRH = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('avatarPreviewRH').src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
};

// ==================== MÁSCARAS E VALIDAÇÕES ====================
window.mascaraCPF = function(campo) {
    let v = campo.value.replace(/\D/g, ""); 
    if (v.length > 11) v = v.substring(0, 11); 
    if (v.length > 9) {
        v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
    } else if (v.length > 6) {
        v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
    } else if (v.length > 3) {
        v = v.replace(/(\d{3})(\d{1,3})/, "$1.$2");
    }
    campo.value = v;
};

window.validarCPF = function(cpf) {
    if (!cpf) return true; 
    let strCPF = cpf.replace(/[^\d]+/g,'');
    if (strCPF.length !== 11 || /^(\d)\1{10}$/.test(strCPF)) return false;
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma = soma + parseInt(strCPF.substring(i-1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if ((resto == 10) || (resto == 11)) resto = 0;
    if (resto != parseInt(strCPF.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma = soma + parseInt(strCPF.substring(i-1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if ((resto == 10) || (resto == 11)) resto = 0;
    if (resto != parseInt(strCPF.substring(10, 11))) return false;
    return true;
};

window.mascaraTelefone = function(campo) {
    let v = campo.value.replace(/\D/g, ""); 
    if (v.length > 11) v = v.substring(0, 11);
    if (v.length > 10) { 
        v = v.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
    } else if (v.length > 5) {
        v = v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
    } else if (v.length > 2) {
        v = v.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
    }
    campo.value = v;
};

window.mascaraMoeda = function(campo) {
    let v = campo.value.replace(/\D/g, ""); 
    if (v === "") { campo.value = ""; return; }
    v = (parseInt(v, 10) / 100).toFixed(2);
    v = v.replace(".", ",");
    v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    campo.value = "R$ " + v;
};

window.parseMoeda = function(valorStr) {
    if (!valorStr) return 0;
    if (typeof valorStr === 'number') return valorStr;
    let str = String(valorStr).replace('R$', '').trim();
    str = str.replace(/\./g, ''); 
    str = str.replace(',', '.');  
    return parseFloat(str) || 0;
};

window.mascaraCEP = function(campo) {
    let v = campo.value.replace(/\D/g, "");
    if (v.length > 8) v = v.substring(0,8);
    v = v.replace(/^(\d{5})(\d)/, "$1-$2");
    campo.value = v;
};

window.buscarCep = async function(cep) {
    let cepLimpo = cep.replace(/\D/g, '');
    if(cepLimpo.length === 8) {
        try {
            let res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
            let data = await res.json();
            if(!data.erro) {
                let enderecoCompleto = `${data.logradouro}, , ${data.bairro}, ${data.localidade} - ${data.uf}`;
                document.getElementById('colEndereco').value = enderecoCompleto;
            }
        } catch(e) { console.log('Erro ao buscar CEP', e); }
    }
};

window.calcularDiferencaDatasAnos = function(dataIso) {
    if(!dataIso) return null;
    let dt = new Date(dataIso + 'T00:00:00');
    let hj = new Date();
    let anos = hj.getFullYear() - dt.getFullYear();
    let m = hj.getMonth() - dt.getMonth();
    if (m < 0 || (m === 0 && hj.getDate() < dt.getDate())) anos--;
    return anos;
};

window.calcularTempoDeCasaTexto = function(dataIso) {
    if (!dataIso) return null;
    let dtAdmissao = new Date(dataIso + 'T00:00:00');
    let hj = new Date();
    hj.setHours(0,0,0,0);

    if (dtAdmissao > hj) return "Admissão no futuro";

    let anos = hj.getFullYear() - dtAdmissao.getFullYear();
    let meses = hj.getMonth() - dtAdmissao.getMonth();
    let dias = hj.getDate() - dtAdmissao.getDate();

    if (dias < 0) {
        meses--;
        let ultimoDiaMesAnterior = new Date(hj.getFullYear(), hj.getMonth(), 0).getDate();
        dias += ultimoDiaMesAnterior;
    }

    if (meses < 0) {
        anos--;
        meses += 12;
    }

    let partes = [];
    if (anos > 0) partes.push(anos + (anos === 1 ? " ano" : " anos"));
    if (meses > 0) partes.push(meses + (meses === 1 ? " mês" : " meses"));
    if (dias > 0) partes.push(dias + (dias === 1 ? " dia" : " dias"));

    if (partes.length === 0) return "Iniciou hoje";
    if (partes.length === 1) return `${partes[0]} de empresa`;
    if (partes.length === 2) return `${partes[0]} e ${partes[1]} de empresa`;
    if (partes.length === 3) return `${partes[0]}, ${partes[1]} e ${partes[2]} de empresa`;
};

window.getVencimentoExperiencia = function(c) {
    if (c.vencimento_experiencia) return c.vencimento_experiencia;
    if (c.data_admissao) {
        let dt = new Date(c.data_admissao + 'T00:00:00');
        dt.setDate(dt.getDate() + 90);
        const ano = dt.getFullYear();
        const mes = String(dt.getMonth() + 1).padStart(2, '0');
        const dia = String(dt.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    }
    return null;
};

window.calcularVencimentoExperiencia = function() {
    const dtAdmissao = document.getElementById('colDataAdmissao').value;
    if(dtAdmissao) {
        let dt = new Date(dtAdmissao + 'T00:00:00');
        dt.setDate(dt.getDate() + 90);
        const ano = dt.getFullYear();
        const mes = String(dt.getMonth() + 1).padStart(2, '0');
        const dia = String(dt.getDate()).padStart(2, '0');
        document.getElementById('colVencimentoExperiencia').value = `${ano}-${mes}-${dia}`;
    }
};

window.atualizarLabelsTempo = function() {
    let dtNascimento = document.getElementById('colDataNascimento').value;
    let dtAdmissao = document.getElementById('colDataAdmissao').value;
    
    let lblIdade = document.getElementById('lblIdade');
    let lblTempo = document.getElementById('lblTempoCasa');
    
    if (dtNascimento) {
        let anos = window.calcularDiferencaDatasAnos(dtNascimento);
        lblIdade.innerHTML = anos !== null ? `<i class="fas fa-birthday-cake"></i> Idade: ${anos} anos` : '';
    } else {
        lblIdade.innerHTML = '';
    }
    
    if (dtAdmissao) {
        let textoTempo = window.calcularTempoDeCasaTexto(dtAdmissao);
        lblTempo.innerHTML = textoTempo ? `<i class="fas fa-clock"></i> ${textoTempo}` : '';
    } else {
        lblTempo.innerHTML = '';
    }
};

window.diasParaVencer = function(dataIso) {
    if(!dataIso) return null;
    let d = new Date(dataIso + 'T00:00:00');
    let hj = new Date();
    hj.setHours(0,0,0,0);
    return Math.floor((d.getTime() - hj.getTime()) / (1000 * 3600 * 24));
};

window.analisarVencimentosColaborador = function(c) {
    let alertas = [];
    ['cnh_vencimento', 'aso_vencimento', 'toxicologico_vencimento'].forEach(campo => {
        if(c[campo]) {
            let dias = window.diasParaVencer(c[campo]);
            let nomeDoAviso = campo.split('_')[0].toUpperCase();
            if(dias < 0) alertas.push({ nome: nomeDoAviso, status: 'Vencido', cor: '#ef4444' });
            else if(dias <= 30) alertas.push({ nome: nomeDoAviso, status: `Vence em ${dias}d`, cor: '#f59e0b' });
        }
    });
    
    if(c.status === 'Ativo' && c.tipo_contrato === 'Temporário') {
        let expDate = window.getVencimentoExperiencia(c);
        if(expDate) {
            let dias = window.diasParaVencer(expDate);
            if(dias < 0) alertas.push({ nome: 'EXP. VENCIDA', status: 'Efetivar ou Desligar', cor: '#ef4444' });
            else if(dias <= 30) alertas.push({ nome: 'FIM EXPERIÊNCIA', status: `Vence em ${dias}d`, cor: '#f59e0b' });
        }
    }
    
    if(c.cursos_vencimentos) {
        Object.keys(c.cursos_vencimentos).forEach(curso => {
            if (c.cursos_vencimentos[curso]) {
                let dias = window.diasParaVencer(c.cursos_vencimentos[curso]);
                if(dias < 0) alertas.push({ nome: curso, status: 'Vencido', cor: '#ef4444' });
                else if(dias <= 30) alertas.push({ nome: curso, status: `Vence em ${dias}d`, cor: '#f59e0b' });
            }
        });
    }
    return alertas;
};

// ==================== CARREGAR DADOS BÁSICOS ====================
window.carregarSetoresGlobal = async function() {
    try {
        let query = window.supabaseClient.from('setores').select('id, nome, filial_id').eq('status', 'Ativo');
        
        // Aplica o filtro de filial para o setor (RH)
        const filialLogada = window.obterFilialUsuarioLogadoRH();
        if (filialLogada !== null) {
            query = query.eq('filial_id', filialLogada);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        const selSetor = document.getElementById('colSetorId');
        if (selSetor) selSetor.innerHTML = '<option value="">Selecione um setor...</option>' + data.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
        
        const selFiltroSetor = document.getElementById('filtroSetorLista');
        if (selFiltroSetor) selFiltroSetor.innerHTML = '<option value="">Todos os Setores</option>' + data.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
    } catch(e) { console.error("Erro ao carregar setores:", e); }
};

window.carregarCargosControladoria = async function() {
    try {
        let query = window.supabaseClient.from('cargos').select('id, nome, filial_id').eq('status', 'Ativo').order('nome', { ascending: true });
        
        // Aplica o filtro de filial para os cargos (RH)
        const filialLogada = window.obterFilialUsuarioLogadoRH();
        if (filialLogada !== null) {
            query = query.eq('filial_id', filialLogada);
        }

        const { data, error } = await query;
        if (error) throw error;

        const selCargo = document.getElementById('colFuncao');
        if (selCargo) selCargo.innerHTML = '<option value="">Selecione um cargo...</option>' + data.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
    } catch(e) { console.error("Erro ao carregar cargos:", e); }
};

window.verificarPendenciasCadastro = function(colaborador) {
    let camposFaltando = [];
    
    // Verificação de campos cadastrais base
    window.camposBaseObrigatorios.forEach(campo => {
        if (!colaborador[campo.key] || String(colaborador[campo.key]).trim() === '') {
            camposFaltando.push({
                key: campo.key,
                id: campo.id,
                nome: campo.key.replace('_', ' ').toUpperCase()
            });
        }
    });

    // Validação de CPF
    if (colaborador.cpf && !window.validarCPF(colaborador.cpf)) {
        camposFaltando.push({ key: 'cpf', id: 'colCpf', nome: 'CPF Inválido' });
    }

    // Validação de Cursos Globais Dinâmicos (Data Pendente)
    if (window.listaCursosAtivos && window.listaCursosAtivos.length > 0) {
        const cursosSalvos = colaborador.cursos_vencimentos || {};
        window.listaCursosAtivos.forEach(curso => {
            const dataCurso = cursosSalvos[curso.nome];
            if (!dataCurso || String(dataCurso).trim() === '') {
                const inputId = `curso_input_${curso.id || curso.nome.replace(/\s+/g, '_')}`;
                camposFaltando.push({
                    key: `curso_${curso.nome}`,
                    id: inputId,
                    nome: `Curso Pendente: ${curso.nome}`,
                    tipo: 'curso'
                });
            }
        });
    }

    return camposFaltando;
};

window.limparValidacaoVisualFicha = function() {
    document.getElementById('alertaCamposPendentes').style.display = 'none';
    window.camposBaseObrigatorios.forEach(campo => {
        const el = document.getElementById(campo.id);
        if (el) {
            el.classList.remove('campo-pendente');
            if (el.previousElementSibling && el.previousElementSibling.tagName === 'LABEL') {
                el.previousElementSibling.classList.remove('label-pendente');
            }
        }
    });

    document.querySelectorAll('.input-curso-dinamico').forEach(el => {
        el.classList.remove('campo-pendente');
        if (el.previousElementSibling && el.previousElementSibling.tagName === 'LABEL') {
            el.previousElementSibling.classList.remove('label-pendente');
        }
    });
};

// ==================== TRANSIÇÃO E LÓGICA DA FICHA COMPLETA ====================
window.voltarParaListagem = function() {
    document.getElementById('viewFichaColaborador').style.display = 'none';
    document.getElementById('viewListagemColaboradores').style.display = 'block';
};

window.calcularProximaMatriculaFull = function() {
    let novoCod = 1;
    if (window.listaColaboradoresDb.length > 0) {
        const codigos = window.listaColaboradoresDb.map(c => parseInt(c.cod_funcionario)).filter(n => !isNaN(n) && n > 0).sort((a, b) => a - b);
        for (let i = 1; i <= codigos.length + 1; i++) {
            if (!codigos.includes(i)) { novoCod = i; break; }
        }
    }
    return novoCod;
};

window.abrirFichaCompleta = async function(id = null) {
    document.getElementById('viewListagemColaboradores').style.display = 'none';
    document.getElementById('viewFichaColaborador').style.display = 'block';
    
    window.mudarAbaFichaRH('tabPessoais');
    window.limparValidacaoVisualFicha();
    await window.carregarSetoresGlobal();
    await window.carregarCargosControladoria();
    
    document.getElementById('colFoto').value = '';
    document.getElementById('colAnexos').value = '';
    document.getElementById('containerLinksArquivos').innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem; font-style: italic; margin:0;">Nenhum arquivo anexado ainda.</p>';
    
    if (id) {
        const c = window.listaColaboradoresDb.find(x => x.id === id);
        if (!c) return;
        
        document.getElementById('tituloFicha').innerText = c.nome;
        document.getElementById('displayCargoHeader').innerText = c.funcao || 'Cargo não informado';
        document.getElementById('colCodFuncionarioDisplay').innerText = c.cod_funcionario ? String(c.cod_funcionario).padStart(4, '0') : 'N/A';
        document.getElementById('avatarPreviewRH').src = c.foto_url ? c.foto_url : `https://ui-avatars.com/api/?name=${encodeURIComponent(c.nome)}&background=1e293b&color=60a5fa&size=150`;
        
        document.getElementById('btnExcluirFicha').style.display = 'flex';
        document.getElementById('colaboradorId').value = c.id;
        
        document.getElementById('colStatus').value = c.status || 'Ativo';
        window.atualizarBadgeStatusHeader();
        
        document.getElementById('colTipoContrato').value = c.tipo_contrato || 'CLT';
        document.getElementById('colSetorId').value = c.setor_id || '';
        document.getElementById('colPlanoSaude').value = c.plano_saude || 'Não';
        document.getElementById('colSindicato').value = c.ativo_sindicato || 'Não';
        
        document.getElementById('colCpf').value = c.cpf || '';
        if (c.cpf) window.mascaraCPF(document.getElementById('colCpf'));

        document.getElementById('colRg').value = c.rg || '';
        document.getElementById('colNome').value = c.nome || '';
        
        document.getElementById('colDataNascimento').value = c.data_nascimento || '';
        document.getElementById('colDataAdmissao').value = c.data_admissao || '';
        document.getElementById('colVencimentoExperiencia').value = c.vencimento_experiencia || '';
        document.getElementById('colDataDesligamento').value = c.data_desligamento || '';
        window.atualizarLabelsTempo(); 
        
        document.getElementById('colFuncao').value = c.funcao || '';
        
        document.getElementById('colTelefone').value = c.telefone || '';
        if (c.telefone) window.mascaraTelefone(document.getElementById('colTelefone'));
        
        if (c.salario_base !== null && c.salario_base !== undefined && c.salario_base !== "") {
            let elSalario = document.getElementById('colSalario');
            elSalario.value = (parseFloat(c.salario_base) * 100).toFixed(0); 
            window.mascaraMoeda(elSalario);
        } else {
            document.getElementById('colSalario').value = '';
        }
        
        document.getElementById('colCep').value = c.cep || '';
        if (c.cep) window.mascaraCEP(document.getElementById('colCep'));
        document.getElementById('colEndereco').value = c.endereco || '';
        
        document.getElementById('colEmailCorp').value = c.email_corp || '';
        document.getElementById('colEmailPessoal').value = c.email_pessoal || '';
        
        document.getElementById('colContatoEmergenciaNome').value = c.emergencia_nome || '';
        document.getElementById('colContatoEmergenciaTel').value = c.emergencia_tel || '';
        if (c.emergencia_tel) window.mascaraTelefone(document.getElementById('colContatoEmergenciaTel'));
        
        document.getElementById('colBanco').value = c.banco || '';
        document.getElementById('colAgencia').value = c.agencia || '';
        document.getElementById('colConta').value = c.conta || '';
        document.getElementById('colChavePix').value = c.chave_pix || '';
        
        document.getElementById('colTamanhoCamisa').value = c.tamanho_camisa || '';
        document.getElementById('colTamanhoCalca').value = c.tamanho_calca || '';
        document.getElementById('colTamanhoCalcado').value = c.tamanho_calcado || '';
        
        document.getElementById('colCnhNumero').value = c.cnh_numero || '';
        document.getElementById('colCnhCategoria').value = c.cnh_categoria || '';
        document.getElementById('colCnhVencimento').value = c.cnh_vencimento || '';
        document.getElementById('colExperiencia').value = c.experiencia_texto || '';
        
        document.getElementById('colAsoVencimento').value = c.aso_vencimento || '';
        document.getElementById('colToxicologico').value = c.toxicologico_vencimento || '';
        document.getElementById('colObservacoes').value = c.observacoes || '';
        
        window.montarCamposCursosDinamicosFull(c.cursos_vencimentos || {});
        
        if (c.foto_url || (c.documentos_urls && c.documentos_urls.length > 0)) {
             document.getElementById('containerLinksArquivos').innerHTML = '';
        }
        if (c.foto_url) {
            document.getElementById('containerLinksArquivos').innerHTML += `<a href="${c.foto_url}" target="_blank" class="btn-primary-green" style="display:inline-flex; padding: 6px 12px; margin-right:10px;"><i class="fas fa-image"></i> Ver Foto de Perfil Atual</a>`;
        }
        if (c.documentos_urls && Array.isArray(c.documentos_urls)) {
            c.documentos_urls.forEach((url, i) => {
                document.getElementById('containerLinksArquivos').innerHTML += `<a href="${url}" target="_blank" class="btn-secondary-dark" style="display:inline-flex; padding: 6px 12px; margin-right:10px;"><i class="fas fa-file-pdf"></i> Visualizar Anexo ${i+1}</a>`;
            });
        }
        
        const pendencias = window.verificarPendenciasCadastro(c);
        if (pendencias.length > 0) {
            document.getElementById('alertaCamposPendentes').style.display = 'flex';
            pendencias.forEach(p => {
                if (p.id) {
                    const el = document.getElementById(p.id);
                    if (el) {
                        el.classList.add('campo-pendente');
                        if (el.previousElementSibling && el.previousElementSibling.tagName === 'LABEL') {
                            el.previousElementSibling.classList.add('label-pendente');
                        }
                    }
                }
            });
        }
    } else {
        document.getElementById('tituloFicha').innerText = 'Novo Colaborador';
        document.getElementById('displayCargoHeader').innerText = 'Função a definir';
        document.getElementById('avatarPreviewRH').src = 'https://ui-avatars.com/api/?name=Colaborador&background=1e293b&color=60a5fa&size=150';
        
        document.getElementById('btnExcluirFicha').style.display = 'none';
        
        document.getElementById('colaboradorId').value = '';
        const proximoCod = window.calcularProximaMatriculaFull();
        document.getElementById('colCodFuncionarioDisplay').innerText = String(proximoCod).padStart(4, '0');
        
        const campos = ['colCpf', 'colRg', 'colNome', 'colDataNascimento', 'colDataAdmissao', 
                        'colFuncao', 'colTelefone', 'colSalario', 'colCep', 'colEndereco', 'colEmailCorp', 'colEmailPessoal',
                        'colContatoEmergenciaNome', 'colContatoEmergenciaTel', 'colBanco', 'colAgencia', 'colConta', 'colChavePix',
                        'colCnhNumero', 'colCnhCategoria', 'colCnhVencimento', 'colExperiencia', 'colAsoVencimento', 'colToxicologico', 'colObservacoes',
                        'colVencimentoExperiencia', 'colDataDesligamento'];
                        
        campos.forEach(el => document.getElementById(el).value = '');
        
        document.getElementById('colTamanhoCamisa').value = '';
        document.getElementById('colTamanhoCalca').value = '';
        document.getElementById('colTamanhoCalcado').value = '';
        
        document.getElementById('colStatus').value = 'Ativo';
        document.getElementById('colTipoContrato').value = 'CLT';
        window.atualizarBadgeStatusHeader();
        
        document.getElementById('colSetorId').value = '';
        document.getElementById('colPlanoSaude').value = 'Não';
        document.getElementById('colSindicato').value = 'Não';
        
        window.atualizarLabelsTempo();
        window.montarCamposCursosDinamicosFull({});
    }
};

window.salvarColaboradorFicha = async function() {
    const id = document.getElementById('colaboradorId').value;
    
    const getValue = (elId) => document.getElementById(elId).value;
    const getDateValue = (elId) => { const val = document.getElementById(elId).value; return val ? val : null; };
    
    let cpfInput = getValue('colCpf');
    if (cpfInput && !window.validarCPF(cpfInput)) {
        alert("O CPF inserido é inválido. Por favor, corrija antes de salvar.");
        window.mudarAbaFichaRH('tabPessoais');
        document.getElementById('colCpf').focus();
        return;
    }
    
    const cursosVencimentosObj = {};
    document.querySelectorAll('.input-curso-dinamico').forEach(input => {
        const nomeCurso = input.getAttribute('data-cursonome');
        const valorData = input.value;
        if(valorData) cursosVencimentosObj[nomeCurso] = valorData;
    });

    let dados = {
        setor_id: getValue('colSetorId') ? parseInt(getValue('colSetorId')) : null,
        status: getValue('colStatus'),
        tipo_contrato: getValue('colTipoContrato'),
        plano_saude: getValue('colPlanoSaude'),
        ativo_sindicato: getValue('colSindicato'),
        nome: getValue('colNome'),
        cpf: cpfInput,
        rg: getValue('colRg'),
        data_nascimento: getDateValue('colDataNascimento'),
        data_admissao: getDateValue('colDataAdmissao'),
        vencimento_experiencia: getDateValue('colVencimentoExperiencia'),
        data_desligamento: getDateValue('colDataDesligamento'),
        funcao: getValue('colFuncao'),
        telefone: getValue('colTelefone'),
        salario_base: window.parseMoeda(getValue('colSalario')),
        cep: getValue('colCep'),
        endereco: getValue('colEndereco'),
        
        email_corp: getValue('colEmailCorp'),
        email_pessoal: getValue('colEmailPessoal'),
        
        emergencia_nome: getValue('colContatoEmergenciaNome'),
        emergencia_tel: getValue('colContatoEmergenciaTel'),
        
        banco: getValue('colBanco'),
        agencia: getValue('colAgencia'),
        conta: getValue('colConta'),
        chave_pix: getValue('colChavePix'),
        
        tamanho_camisa: getValue('colTamanhoCamisa'),
        tamanho_calca: getValue('colTamanhoCalca'),
        tamanho_calcado: getValue('colTamanhoCalcado'),
        
        cnh_numero: getValue('colCnhNumero'),
        cnh_categoria: getValue('colCnhCategoria'),
        cnh_vencimento: getDateValue('colCnhVencimento'),
        experiencia_texto: getValue('colExperiencia'),
        
        aso_vencimento: getDateValue('colAsoVencimento'),
        toxicologico_vencimento: getDateValue('colToxicologico'),
        
        cursos_vencimentos: cursosVencimentosObj,
        observacoes: getValue('colObservacoes')
    };

    if (!id) dados.cod_funcionario = window.calcularProximaMatriculaFull();
    if (!dados.nome) {
        alert('O Nome Completo é obrigatório para salvar a ficha.');
        window.mudarAbaFichaRH('tabPessoais');
        return;
    }

    try {
        const inputFoto = document.getElementById('colFoto');
        const inputAnexos = document.getElementById('colAnexos');
        
        if (window.supabaseClient && (inputFoto.files.length > 0 || inputAnexos.files.length > 0)) {
            let basePath = `colab_${dados.cod_funcionario}_${Date.now()}`;
            
            if (inputFoto.files.length > 0) {
                const file = inputFoto.files[0];
                const fileExt = file.name.split('.').pop();
                const fileName = `${basePath}_foto.${fileExt}`;
                const { error } = await window.supabaseClient.storage.from('rh_arquivos').upload(fileName, file, { upsert: true });
                if (!error) {
                    const { data: publicUrlData } = window.supabaseClient.storage.from('rh_arquivos').getPublicUrl(fileName);
                    dados.foto_url = publicUrlData.publicUrl;
                }
            }
            
            if (inputAnexos.files.length > 0) {
                let docUrls = [];
                for(let i = 0; i < inputAnexos.files.length; i++) {
                    const file = inputAnexos.files[i];
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${basePath}_doc_${i}.${fileExt}`;
                    const { error } = await window.supabaseClient.storage.from('rh_arquivos').upload(fileName, file, { upsert: true });
                    if (!error) {
                        const { data: publicUrlData } = window.supabaseClient.storage.from('rh_arquivos').getPublicUrl(fileName);
                        docUrls.push(publicUrlData.publicUrl);
                    }
                }
                if (docUrls.length > 0) dados.documentos_urls = docUrls; 
            }
        }
        
        // Garante que todo colaborador criado tenha a filial atrelada (a do usuário ou null se matriz)
        if (!id) {
            dados.filial_id = window.obterFilialUsuarioLogadoRH();
        }
        
        if (id) {
            await db.updateColaborador(id, dados);
            if (typeof window.registrarLogAuditoria === 'function') window.registrarLogAuditoria('RH', 'Edição', `Ficha atualizada: ${dados.nome}`, 'Info');
            alert('Ficha atualizada com sucesso!');
        } else {
            await db.addColaborador(dados);
            if (typeof window.registrarLogAuditoria === 'function') window.registrarLogAuditoria('RH', 'Criação', `Novo colaborador: ${dados.nome}`, 'Info');
            alert('Novo colaborador cadastrado com sucesso!');
        }
        
        await window.carregarColaboradoresLista();
        window.filtrarColaboradoresLista();
        window.voltarParaListagem(); 
    } catch (e) {
        console.error(e);
        alert('Erro ao salvar no banco de dados. Verifique a conexão ou se o bucket foi criado.');
    }
};

window.excluirColaboradorAtual = async function() {
    const id = document.getElementById('colaboradorId').value;
    if (!id) return;
    
    if (confirm('AÇÃO IRREVERSÍVEL!\nTem certeza que deseja EXCLUIR PERMANENTEMENTE o cadastro deste colaborador?')) {
        try {
            const nome = document.getElementById('colNome').value;
            await db.deleteColaborador(id);
            if (typeof window.registrarLogAuditoria === 'function') window.registrarLogAuditoria('RH', 'Exclusão', `Colaborador removido: ${nome}`, 'Crítico');
            
            alert('Cadastro excluído com sucesso.');
            await window.carregarColaboradoresLista();
            window.filtrarColaboradoresLista();
            window.voltarParaListagem();
        } catch (e) {
            console.error(e);
            alert('Erro ao processar a exclusão.');
        }
    }
};

// ==================== GESTÃO DOS CURSOS GLOBAIS DINÂMICOS ====================
window.montarCamposCursosDinamicosFull = function(vencimentosSalvos = {}) {
    const container = document.getElementById('containerCursosDinamicos');
    if (!container) return;
    container.innerHTML = '';

    if (window.listaCursosAtivos.length === 0) {
        container.innerHTML = `<p style="color:var(--text-secondary); font-size:0.8rem; grid-column:1/-1;">Nenhum curso cadastrado globalmente.</p>`;
        return;
    }

    window.listaCursosAtivos.forEach(curso => {
        const valorData = vencimentosSalvos[curso.nome] || '';
        const inputId = `curso_input_${curso.id || curso.nome.replace(/\s+/g, '_')}`;
        const div = document.createElement('div');
        div.className = 'form-group-dark';
        div.innerHTML = `
            <label>${curso.nome} *</label>
            <input type="date" id="${inputId}" class="input-curso-dinamico" data-cursonome="${curso.nome}" value="${valorData}">
        `;
        container.appendChild(div);
    });
};

window.carregarCursosGlobais = async function() {
    try {
        let query = window.supabaseClient.from('rh_cursos').select('*').order('nome', { ascending: true });
        
        // Aplica o filtro de filial (RH)
        const filialLogada = window.obterFilialUsuarioLogadoRH();
        if (filialLogada !== null) {
            query = query.eq('filial_id', filialLogada);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        window.listaCursosAtivos = data || [];
    } catch(e) { console.error("Erro ao buscar cursos globais:", e); }
};

window.abrirModalGerenciarCursos = async function() {
    await window.carregarCursosGlobais();
    document.getElementById('novoCursoNome').value = '';
    window.renderizarListaCursosGlobais();
    document.getElementById('modalGerenciarCursos').classList.add('show');
};

window.fecharModalGerenciarCursos = function() {
     document.getElementById('modalGerenciarCursos').classList.remove('show');
};

window.renderizarListaCursosGlobais = function() {
    const container = document.getElementById('listaCursosGlobais');
    if (!container) return;
    container.innerHTML = '';

    if (window.listaCursosAtivos.length === 0) {
        container.innerHTML = `<p style="color: var(--text-secondary); text-align:center; padding:15px; font-size:0.85rem;">Lista de cursos vazia.</p>`;
        return;
    }

    window.listaCursosAtivos.forEach(curso => {
        container.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:6px; border:1px solid var(--border-dim);">
                <span style="color:#fff; font-weight:600; font-size:0.9rem;"><i class="fas fa-graduation-cap" style="color:#8b5cf6; margin-right:8px;"></i> ${curso.nome}</span>
                <button class="btn-icon-only" onclick="window.excluirCursoGlobal('${curso.id}')" title="Excluir Curso"><i class="fas fa-times" style="color:#ef4444;"></i></button>
            </div>
        `;
    });
};

window.salvarNovoCursoGlobal = async function() {
    const nome = document.getElementById('novoCursoNome').value.trim();
    if (!nome) return alert('Digite o nome do curso.');
    
    try {
        let dados = { 
            nome: nome,
            filial_id: window.obterFilialUsuarioLogadoRH() // Associa o curso apenas à filial
        };
        
        await window.supabaseClient.from('rh_cursos').insert([dados]);
        document.getElementById('novoCursoNome').value = '';
        await window.carregarCursosGlobais();
        window.renderizarListaCursosGlobais();
        
        if(document.getElementById('viewFichaColaborador').style.display === 'block') {
            const vencimentos = {};
            document.querySelectorAll('.input-curso-dinamico').forEach(inp => vencimentos[inp.getAttribute('data-cursonome')] = inp.value);
            window.montarCamposCursosDinamicosFull(vencimentos);
        }
    } catch(e) { alert('Erro ao inserir curso.'); }
};

window.excluirCursoGlobal = async function(id) {
    if (confirm('Remover este curso da lista global?')) {
        try {
            await window.supabaseClient.from('rh_cursos').delete().eq('id', id);
            await window.carregarCursosGlobais();
            window.renderizarListaCursosGlobais();
            
            if(document.getElementById('viewFichaColaborador').style.display === 'block') {
                const vencimentos = {};
                document.querySelectorAll('.input-curso-dinamico').forEach(inp => vencimentos[inp.getAttribute('data-cursonome')] = inp.value);
                window.montarCamposCursosDinamicosFull(vencimentos);
            }
        } catch(e) { alert('Erro ao excluir o curso.'); }
    }
};

window.gerarHtmlFichaColaborador = function(colaboradores) {
    let html = `<html><head><title>Ficha Cadastral</title><style>
        body { font-family: Arial, sans-serif; font-size: 13px; color: #000; }
        .page-break { page-break-after: always; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .header h2 { margin: 0; font-size: 18px; }
        .header h3 { margin: 5px 0 0 0; font-size: 14px; font-weight: normal; color: #444; }
        .section-title { background: #f0f0f0; padding: 6px; font-weight: bold; border: 1px solid #000; margin-top: 15px; text-transform: uppercase; font-size: 11px; }
        .row { display: flex; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px solid #000; }
        .row:first-of-type { border-top: 1px solid #000; }
        .col { padding: 8px; border-right: 1px solid #000; flex: 1; }
        .col:last-child { border-right: none; }
        .label { font-size: 10px; color: #555; display: block; text-transform: uppercase; margin-bottom: 2px; }
        .val { font-weight: bold; font-size: 12px; }
    </style></head><body>`;

    const fmtDt = (d) => d ? d.split('-').reverse().join('/') : '-';

    colaboradores.forEach(c => {
        let cursosHtml = '';
        if(c.cursos_vencimentos && Object.keys(c.cursos_vencimentos).length > 0) {
            cursosHtml = `<div class="section-title">Cursos e Treinamentos</div>`;
            for(let [curso, data] of Object.entries(c.cursos_vencimentos)) {
                cursosHtml += `<div class="row"><div class="col"><span class="label">${curso} (Vencimento)</span><span class="val">${fmtDt(data)}</span></div></div>`;
            }
        }

        html += `
        <div class="page-break">
            <div class="header">
                <h2>SERRANA FLORESTAL</h2>
                <h3>FICHA CADASTRAL DE COLABORADOR</h3>
            </div>
            
            <div class="section-title">Dados Pessoais e Contratuais</div>
            <div class="row">
                <div class="col" style="flex:2"><span class="label">Nome Completo</span><span class="val">${c.nome}</span></div>
                <div class="col"><span class="label">Matrícula</span><span class="val">${c.cod_funcionario ? String(c.cod_funcionario).padStart(4, '0') : '-'}</span></div>
            </div>
            <div class="row">
                <div class="col"><span class="label">CPF</span><span class="val">${c.cpf || '-'}</span></div>
                <div class="col"><span class="label">RG</span><span class="val">${c.rg || '-'}</span></div>
                <div class="col"><span class="label">Data de Nascimento</span><span class="val">${fmtDt(c.data_nascimento)}</span></div>
            </div>
            <div class="row">
                <div class="col"><span class="label">Função / Cargo</span><span class="val">${c.funcao || '-'}</span></div>
                <div class="col"><span class="label">Data de Admissão</span><span class="val">${fmtDt(c.data_admissao)}</span></div>
                <div class="col"><span class="label">Status</span><span class="val">${c.status || 'Ativo'}</span></div>
            </div>
            
            <div class="row">
                <div class="col"><span class="label">Tipo de Contrato</span><span class="val">${c.tipo_contrato || '-'}</span></div>
                <div class="col"><span class="label">Vencimento Experiência</span><span class="val">${fmtDt(c.vencimento_experiencia)}</span></div>
                <div class="col"><span class="label">Data Desligamento</span><span class="val">${fmtDt(c.data_desligamento)}</span></div>
            </div>
            
            <div class="row">
                <div class="col" style="flex:2"><span class="label">Endereço</span><span class="val">${c.endereco || '-'}</span></div>
                <div class="col"><span class="label">CEP</span><span class="val">${c.cep || '-'}</span></div>
            </div>
            <div class="row">
                <div class="col"><span class="label">E-mail Corp</span><span class="val">${c.email_corp || '-'}</span></div>
                <div class="col"><span class="label">Telefone</span><span class="val">${c.telefone || '-'}</span></div>
            </div>
            <div class="row">
                <div class="col"><span class="label">Sindicato</span><span class="val">${c.ativo_sindicato || '-'}</span></div>
                <div class="col"><span class="label">Plano de Saúde</span><span class="val">${c.plano_saude || '-'}</span></div>
                <div class="col"><span class="label">Salário Base</span><span class="val">R$ ${c.salario_base || '-'}</span></div>
            </div>

            <div class="section-title">Dados Bancários & Contato de Emergência</div>
            <div class="row">
                <div class="col"><span class="label">Banco</span><span class="val">${c.banco || '-'}</span></div>
                <div class="col"><span class="label">Agência</span><span class="val">${c.agencia || '-'}</span></div>
                <div class="col"><span class="label">Conta</span><span class="val">${c.conta || '-'}</span></div>
                <div class="col"><span class="label">Chave PIX</span><span class="val">${c.chave_pix || '-'}</span></div>
            </div>
            <div class="row">
                <div class="col" style="flex:2"><span class="label">Nome (Emergência)</span><span class="val">${c.emergencia_nome || '-'}</span></div>
                <div class="col"><span class="label">Telefone (Emergência)</span><span class="val">${c.emergencia_tel || '-'}</span></div>
            </div>

            <div class="section-title">Habilitação, Saúde e Uniforme</div>
            <div class="row">
                <div class="col"><span class="label">Nº CNH</span><span class="val">${c.cnh_numero || '-'}</span></div>
                <div class="col"><span class="label">Categoria CNH</span><span class="val">${c.cnh_categoria || '-'}</span></div>
                <div class="col"><span class="label">Vencimento CNH</span><span class="val">${fmtDt(c.cnh_vencimento)}</span></div>
            </div>
            <div class="row">
                <div class="col"><span class="label">Vencimento ASO</span><span class="val">${fmtDt(c.aso_vencimento)}</span></div>
                <div class="col"><span class="label">Vencimento Toxicológico</span><span class="val">${fmtDt(c.toxicologico_vencimento)}</span></div>
            </div>
            <div class="row">
                <div class="col"><span class="label">Tamanho Camisa</span><span class="val">${c.tamanho_camisa || '-'}</span></div>
                <div class="col"><span class="label">Tamanho Calça</span><span class="val">${c.tamanho_calca || '-'}</span></div>
                <div class="col"><span class="label">Nº Calçado</span><span class="val">${c.tamanho_calcado || '-'}</span></div>
            </div>

            ${cursosHtml}

            <div class="section-title">Observações</div>
            <div class="row" style="min-height: 80px;">
                <div class="col"><span class="val">${c.observacoes || '-'}</span></div>
            </div>
        </div>`;
    });
    html += `</body></html>`;
    return html;
};

window.imprimirFichaColaborador = function(id) {
    const colab = window.listaColaboradoresDb.find(c => c.id === id);
    if (!colab) return;
    const html = window.gerarHtmlFichaColaborador([colab]);
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
};

window.exportarTodasFichas = function() {
    if (window.listaColaboradoresDb.length === 0) return alert("Nenhum colaborador encontrado.");
    const html = window.gerarHtmlFichaColaborador(window.listaColaboradoresDb);
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
};

// ==================== EXPORTAÇÃO EXCEL ====================
window.exportarExcelColaboradores = function(statusExportacao = 'todos') {
    // Base de dados a ser exportada
    let baseDados = window.colaboradoresFiltradosRH && window.colaboradoresFiltradosRH.length > 0 
                          ? window.colaboradoresFiltradosRH 
                          : window.listaColaboradoresDb;

    // Aplica o filtro de status (Ativos, Inativos, ou Todos) de acordo com o botão clicado
    let colaboradores = baseDados;
    
    if (statusExportacao === 'ativos') {
        colaboradores = baseDados.filter(c => c.status !== 'Inativo' && c.status !== 'Desligado');
    } else if (statusExportacao === 'inativos') {
        colaboradores = baseDados.filter(c => c.status === 'Inativo' || c.status === 'Desligado');
    }

    if (!colaboradores || colaboradores.length === 0) {
        alert("Não há colaboradores para exportar com o filtro selecionado.");
        return;
    }

    // Função auxiliar para resgatar o nome do setor
    const getNomeSetor = (setor_id) => {
        if (!setor_id) return 'Sem Setor';
        const selectSetor = document.getElementById('filtroSetorLista');
        if (selectSetor) {
            const option = Array.from(selectSetor.options).find(opt => opt.value == setor_id);
            if (option) return option.text;
        }
        return 'Sem Setor';
    };

    // Função auxiliar para formatar a data
    const formatarData = (dataIso) => {
        return dataIso ? dataIso.split('-').reverse().join('/') : '-';
    };

    // Mapeando as colunas solicitadas
    const dadosMapeados = colaboradores.map(c => {
        return {
            "Nome do Colaborador": c.nome || "",
            "Cargo": c.funcao || "Função não informada",
            "Setor": getNomeSetor(c.setor_id),
            "Status": c.status || "Ativo",
            "Data de Admissão": formatarData(c.data_admissao),
            "Vencimento ASO": formatarData(c.aso_vencimento),
            "Vencimento Toxicológico": formatarData(c.toxicologico_vencimento)
        };
    });

    // Construção do arquivo CSV (com marcação UTF-8 BOM para garantir o suporte de acentuação no Excel)
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
    csvContent += "Nome do Colaborador;Cargo;Setor;Status;Data de Admissao;Vencimento ASO;Vencimento Toxicologico\n"; 

    dadosMapeados.forEach(row => {
        // Limpa possíveis ponto e vírgulas já existentes nos textos para não quebrar as colunas no Excel
        const nome = String(row["Nome do Colaborador"]).replace(/;/g, ",");
        const cargo = String(row["Cargo"]).replace(/;/g, ",");
        const setor = String(row["Setor"]).replace(/;/g, ",");
        const status = String(row["Status"]).replace(/;/g, ",");
        const admissao = String(row["Data de Admissão"]).replace(/;/g, ",");
        const aso = String(row["Vencimento ASO"]).replace(/;/g, ",");
        const tox = String(row["Vencimento Toxicológico"]).replace(/;/g, ",");
        
        csvContent += `${nome};${cargo};${setor};${status};${admissao};${aso};${tox}\n`;
    });

    // Cria um link invisível e força o Download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    
    const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    link.setAttribute("download", `Relatorio_Colaboradores_${statusExportacao}_${dataAtual}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Fecha o menu suspenso de exportação após o clique
    const menuExport = document.getElementById('action-menu-export-lote');
    if (menuExport) menuExport.style.display = 'none';
};