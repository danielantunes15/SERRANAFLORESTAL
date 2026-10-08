window.initFrotaCompatibilidade = function() {
    const selCavalo = document.getElementById("compatCavaloSelect");
    const resumoCard = document.getElementById("compatResumoCard");
    const simCard = document.getElementById("compatSimulacaoCard");
    
    let dbCavalos = [];
    let dbCarretas = [];

    // Consolida dados dos 3 LocalStorages para o simulador
    function carregarEstoque() {
        const docs = JSON.parse(localStorage.getItem("crlv_veiculos_v1")) || [];
        const aetsFed = JSON.parse(localStorage.getItem("crlv_aets_v1")) || [];
        const aetsEst = JSON.parse(localStorage.getItem("crlv_aets_estaduais_v1")) || [];

        dbCavalos = docs.filter(v => v.tipoVeiculo === 'Cavalo').map(c => c.placa);
        
        // Extrai cavalos também das AETs
        aetsFed.forEach(a => { if(a.u1_placa && !dbCavalos.includes(a.u1_placa)) dbCavalos.push(a.u1_placa); });
        
        dbCarretas = docs.filter(v => ['Carreta', 'Bitrem', 'Tritrem', 'Rodotrem', 'Semirreboque'].includes(v.tipoVeiculo));
    }

    function popularSelects() {
        carregarEstoque();
        selCavalo.innerHTML = '<option value="">— Selecione um cavalo —</option>';
        dbCavalos.forEach(placa => {
            selCavalo.innerHTML += `<option value="${placa}">${placa}</option>`;
        });
    }

    selCavalo.addEventListener("change", () => {
        if (!selCavalo.value) {
            resumoCard.style.display = "none";
            simCard.style.display = "none";
            return;
        }

        resumoCard.style.display = "block";
        simCard.style.display = "block";
        document.getElementById("compatResumoInfo").innerHTML = `<strong>Cavalo:</strong> <span style="color:var(--ccol-blue-bright)">${selCavalo.value}</span>`;

        gerarSlotsSimulacao();
    });

    function gerarSlotsSimulacao() {
        const slotsContainer = document.getElementById("slotsCarretas");
        let html = '';
        
        // Cria 3 slots para simular um Tritrem/Rodotrem
        for (let i = 1; i <= 3; i++) {
            let options = '<option value="">— Selecionar Carreta —</option>';
            dbCarretas.forEach(c => {
                options += `<option value="${c.placa}">${c.placa} (${c.tipoVeiculo})</option>`;
            });

            html += `
                <div style="background: rgba(255,255,255,0.02); padding: 15px; border-radius: 8px; border: 1px solid var(--border-dim);">
                    <h4 style="color: var(--primary); margin-bottom: 10px;">Unidade ${i + 1}</h4>
                    <select class="dark-select carreta-slot" data-index="${i}">
                        ${options}
                    </select>
                </div>
            `;
        }
        slotsContainer.innerHTML = html;

        document.querySelectorAll('.carreta-slot').forEach(select => {
            select.addEventListener('change', validarCombinacao);
        });
    }

    function validarCombinacao() {
        const resultado = document.getElementById("resultadoValidacao");
        const selecionadas = Array.from(document.querySelectorAll('.carreta-slot'))
                                  .map(s => s.value)
                                  .filter(Boolean);

        if (selecionadas.length === 0) {
            resultado.innerHTML = `<p style="color: var(--muted);"><i class="fas fa-info-circle"></i> Selecione as carretas para ver a validação automática.</p>`;
            return;
        }

        // Validação Simples (Placas duplicadas)
        const duplicadas = selecionadas.filter((item, index) => selecionadas.indexOf(item) !== index);
        
        if (duplicadas.length > 0) {
            resultado.innerHTML = `<h3 style="color: var(--danger);"><i class="fas fa-times-circle"></i> Incompatível</h3>
                                   <p style="color: var(--text-secondary); margin-top: 5px;">Placas repetidas: ${duplicadas[0]}</p>`;
            resultado.style.borderColor = "var(--danger)";
        } else {
            resultado.innerHTML = `<h3 style="color: var(--ccol-green-bright);"><i class="fas fa-check-circle"></i> Combinação Válida</h3>
                                   <p style="color: var(--text-secondary); margin-top: 5px;">O conjunto com as carretas ${selecionadas.join(', ')} está pronto para operação.</p>`;
            resultado.style.borderColor = "var(--ccol-green-bright)";
        }
    }

    popularSelects();
};