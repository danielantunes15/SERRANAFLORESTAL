document.addEventListener('DOMContentLoaded', function() {
    carregarSetoresCorporativos();

    document.getElementById('formResponsavelSetor').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const dados = {
            nome_responsavel: document.getElementById('nomeResponsavel').value,
            cargo: document.getElementById('cargoResponsavel').value,
            setor_id: document.getElementById('setorCorporativo').value
        };

        // Substitua '/api/responsaveis' pela sua rota real de backend
        fetch('/api/responsaveis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        })
        .then(response => response.json())
        .then(data => {
            alert('Responsável cadastrado com sucesso!');
            document.getElementById('formResponsavelSetor').reset();
        })
        .catch(error => console.error('Erro ao salvar:', error));
    });
});

function carregarSetoresCorporativos() {
    // Substitua '/api/setores' pela rota que busca os setores já cadastrados
    fetch('/api/setores')
        .then(response => response.json())
        .then(setores => {
            const select = document.getElementById('setorCorporativo');
            select.innerHTML = '<option value="">Selecione o Setor</option>';
            setores.forEach(setor => {
                select.innerHTML += `<option value="${setor.id}">${setor.nome}</option>`;
            });
        })
        .catch(error => console.error('Erro ao buscar setores:', error));
}