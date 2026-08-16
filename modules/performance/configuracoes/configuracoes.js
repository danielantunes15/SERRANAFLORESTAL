// ==================== modules/performance/configuracoes/configuracoes.js ====================
window.settingsModule = (function() {
    let settings = { pointsPerEconomy: 10, penaltyPerOccurrence: 100, resetMonthly: false, globalGoal: 1.8 };
    let dbId = null;

    async function load() {
        // ATUALIZADO PARA A TABELA performance_configuracoes
        const { data, error } = await window.supabaseClient.from('performance_configuracoes').select('*').limit(1);
        let backupGoal = localStorage.getItem('sys_meta_geral');
        
        if (!error && data && data.length > 0) {
            dbId = data[0].id;
            let dbGoal = data[0].global_goal;
            let finalGoal = 1.8;
            if (dbGoal !== undefined && dbGoal !== null) {
                finalGoal = parseFloat(String(dbGoal).replace(',', '.'));
            } else if (backupGoal) {
                finalGoal = parseFloat(backupGoal);
            }
            settings = {
                pointsPerEconomy: parseFloat(data[0].points_per_economy || 10),
                penaltyPerOccurrence: parseFloat(data[0].penalty_per_occurrence || 100),
                resetMonthly: data[0].reset_monthly || false,
                globalGoal: finalGoal
            };
        } else if (backupGoal) {
            settings.globalGoal = parseFloat(backupGoal);
        }
        
        const pointsInput = document.getElementById('points-per-economy');
        const penaltyInput = document.getElementById('penalty-per-occurrence');
        const resetSelect = document.getElementById('reset-score');
        const goalInput = document.getElementById('global-goal');
        
        if (pointsInput) pointsInput.value = settings.pointsPerEconomy;
        if (penaltyInput) penaltyInput.value = settings.penaltyPerOccurrence;
        if (resetSelect) resetSelect.value = settings.resetMonthly;
        if (goalInput) goalInput.value = settings.globalGoal;
    }

    async function save() {
        const pointsInput = document.getElementById('points-per-economy').value;
        const penaltyInput = document.getElementById('penalty-per-occurrence').value;
        const resetSelect = document.getElementById('reset-score').value === 'true';
        
        const rawGoalInput = document.getElementById('global-goal').value;
        const safeGoalInput = String(rawGoalInput).replace(',', '.');
        const parsedGoal = parseFloat(safeGoalInput);
        
        settings = {
            pointsPerEconomy: parseFloat(pointsInput),
            penaltyPerOccurrence: parseFloat(penaltyInput),
            resetMonthly: resetSelect,
            globalGoal: isNaN(parsedGoal) ? 1.8 : parsedGoal
        };
        
        localStorage.setItem('sys_meta_geral', settings.globalGoal);
        
        const dbPayload = {
            points_per_economy: settings.pointsPerEconomy,
            penalty_per_occurrence: settings.penaltyPerOccurrence,
            reset_monthly: settings.resetMonthly,
            global_goal: settings.globalGoal
        };
        
        if(window.injetarFilial) Object.assign(dbPayload, window.injetarFilial({}));

        if (dbId) {
            // ATUALIZADO PARA A TABELA performance_configuracoes
            await window.supabaseClient.from('performance_configuracoes').update(dbPayload).eq('id', dbId);
        } else {
            // ATUALIZADO PARA A TABELA performance_configuracoes
            const { data } = await window.supabaseClient.from('performance_configuracoes').insert([dbPayload]).select();
            if (data && data.length > 0) dbId = data[0].id;
        }
        
        if(window.utils && window.utils.showAlert) window.utils.showAlert('Configurações salvas com sucesso!', 'success');
        else alert('Configurações salvas com sucesso!');
    }

    function get() { return settings; }

    async function clearAllData() {
        if (confirm("ATENÇÃO: Você está prestes a apagar TODAS as viagens importadas.\nDeseja continuar?")) {
            await window.supabaseClient.from('performance').delete().neq('id', 0);
            if(window.utils && window.utils.showAlert) window.utils.showAlert('Todas as viagens foram apagadas com sucesso.', 'success');
            else alert('Todas as viagens foram apagadas com sucesso.');
            
            setTimeout(() => { window.location.reload(); }, 1500);
        }
    }

    return { load, save, get, clearAllData };
})();