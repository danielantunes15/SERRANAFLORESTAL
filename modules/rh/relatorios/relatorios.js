document.addEventListener('DOMContentLoaded', function() {
    const formFiltros = document.getElementById('formFiltrosRelatorio');
    
    formFiltros.addEventListener('submit', function(e) {
        e.preventDefault();
        gerarRelatorio();
    });
});

function gerarRelatorio() {
    const tipo = document.getElementById('tipoRelatorio').value;
    const dataInicio = document.getElementById('dataInicio').value;
    const dataFim = document.getElementById('dataFim').value;

    if (!tipo) {
        alert("Por favor, selecione um tipo de relatório.");
        return;
    }

    const cardResultados = document.getElementById('cardResultados');
    // Troca para o display padrão em vez de usar classes do Bootstrap
    cardResultados.style.display = 'block'; 
    
    const tbody = document.getElementById('tabelaCorpo');
    const thead = document.getElementById('tabelaCabecalho');
    
    thead.innerHTML = '';
    tbody.innerHTML = `
        <tr>
            <td colspan="10" style="text-align: center; padding: 40px; color: #94a3b8;">
                <i class="fas fa-circle-notch fa-spin fa-2x" style="color: #10b981; margin-bottom: 15px;"></i>
                <br>Buscando dados no servidor...
            </td>
        </tr>
    `;

    setTimeout(() => {
        let dados = buscarDadosMock(tipo);
        renderizarTabela(tipo, dados);
    }, 800);
}

function renderizarTabela(tipo, dados) {
    const thead = document.getElementById('tabelaCabecalho');
    const tbody = document.getElementById('tabelaCorpo');
    const titulo = document.getElementById('tituloResultado');
    const totalRegistros = document.getElementById('totalRegistros');

    thead.innerHTML = '';
    tbody.innerHTML = '';
    
    if (!dados || dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 30px; color: #94a3b8;">Nenhum registro encontrado para este período.</td></tr>';
        totalRegistros.innerText = "0";
        return;
    }

    let cabecalhos = [];
    let nomeRelatorio = "";

    switch(tipo) {
        case 'sindicato':
            nomeRelatorio = "Relatório de Desconto de Sindicato";
            cabecalhos = ['Matrícula', 'Funcionário', 'Cargo', 'Sindicato', 'Salário Base (R$)', 'Alíquota (%)', 'Desconto (R$)'];
            break;
        case 'plano_saude':
            nomeRelatorio = "Relatório de Plano de Saúde";
            cabecalhos = ['Matrícula', 'Funcionário', 'Plano', 'Acomodação', 'Dependentes', 'Valor Titular (R$)', 'Valor Dependentes (R$)', 'Total Desconto (R$)'];
            break;
        case 'atestados':
            nomeRelatorio = "Relatório de Atestados Médicos";
            cabecalhos = ['Data Recebimento', 'Funcionário', 'CID', 'Médico', 'CRM', 'Dias', 'Status Prev. Social'];
            break;
        case 'ferias':
            nomeRelatorio = "Relatório de Férias Programadas";
            cabecalhos = ['Funcionário', 'Período Aquisitivo', 'Início das Férias', 'Fim das Férias', 'Dias Tirados', 'Abono'];
            break;
    }

    titulo.innerHTML = `<i class="fas fa-table" style="color: #3b82f6;"></i> ${nomeRelatorio}`;

    let trHead = document.createElement('tr');
    cabecalhos.forEach(texto => {
        let th = document.createElement('th');
        th.innerText = texto;
        trHead.appendChild(th);
    });
    thead.appendChild(trHead);

    dados.forEach(linha => {
        let tr = document.createElement('tr');
        
        Object.values(linha).forEach(valor => {
            let td = document.createElement('td');
            td.innerText = valor;
            tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
    });

    totalRegistros.innerText = dados.length;
}

function exportarExcel() {
    alert("Função de exportação para Excel acionada.");
}

function exportarPDF() {
    alert("Função de exportação para PDF acionada.");
}

function buscarDadosMock(tipo) {
    if (tipo === 'sindicato') {
        return [
            { matricula: '00123', nome: 'Daniel Antunes Ribeiro', cargo: 'Motorista Florestal', sindicato: 'SINDIMOTOR', salario: '3.500,00', porcentagem: '2,0%', desconto: '70,00' },
            { matricula: '00145', nome: 'João da Silva', cargo: 'Mecânico', sindicato: 'SINDIMEC', salario: '4.200,00', porcentagem: '1,5%', desconto: '63,00' },
            { matricula: '00201', nome: 'Maria Oliveira', cargo: 'Assistente Administrativo', sindicato: 'SINDICOM', salario: '2.800,00', porcentagem: '1,0%', desconto: '28,00' },
            { matricula: '00210', nome: 'Carlos Souza', cargo: 'Operador de Máquinas', sindicato: 'SINDIMOTOR', salario: '3.800,00', porcentagem: '2,0%', desconto: '76,00' }
        ];
    }
    
    if (tipo === 'plano_saude') {
        return [
            { matricula: '00123', nome: 'Daniel Antunes Ribeiro', plano: 'Unimed Flex', acomodacao: 'Enfermaria', dependentes: '2', valorTitular: '150,00', valorDependentes: '240,00', total: '390,00' },
            { matricula: '00145', nome: 'João da Silva', plano: 'Bradesco Top', acomodacao: 'Apartamento', dependentes: '0', valorTitular: '220,00', valorDependentes: '0,00', total: '220,00' },
            { matricula: '00201', nome: 'Maria Oliveira', plano: 'Amil Fácil', acomodacao: 'Enfermaria', dependentes: '1', valorTitular: '120,00', valorDependentes: '100,00', total: '220,00' }
        ];
    }
    
    if (tipo === 'atestados') {
        return [
            { data: '15/07/2026', nome: 'Maria Oliveira', cid: 'J01.9 (Sinusite)', medico: 'Dr. Roberto Costa', crm: '15488-BA', dias: '3', status: 'Empresa (Pago)' },
            { data: '22/07/2026', nome: 'Carlos Mendes', cid: 'S83.2 (Menisco)', medico: 'Dra. Ana Lima', crm: '22144-BA', dias: '30', status: 'INSS' },
            { data: '01/08/2026', nome: 'João da Silva', cid: 'A09 (Diarreia)', medico: 'Dr. Paulo Nunes', crm: '18999-BA', dias: '2', status: 'Empresa (Pago)' }
        ];
    }

    if (tipo === 'ferias') {
        return [
            { nome: 'Daniel Antunes Ribeiro', periodo: '2024/2025', inicio: '01/08/2026', fim: '30/08/2026', dias: '30', abono: 'Não' },
            { nome: 'Fernanda Souza', periodo: '2025/2026', inicio: '15/08/2026', fim: '03/09/2026', dias: '20', abono: 'Sim (10 dias)' },
            { nome: 'Carlos Souza', periodo: '2024/2025', inicio: '10/09/2026', fim: '09/10/2026', dias: '30', abono: 'Não' }
        ];
    }
    
    return [];
}