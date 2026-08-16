// ==================== modules/performance/performance_utils.js ====================

window.utils = {
    formatDate(date) {
        if (!date) return '-';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('pt-BR');
    },
    formatDateTime(date) {
        if (!date) return '-';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '-';
        const dataStr = d.toLocaleDateString('pt-BR');
        const horaStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return `${dataStr} às ${horaStr}`;
    },
    formatNumber(num, decimals = 2) {
        if (num === undefined || num === null) return "0";
        return parseFloat(num).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    },
    showAlert(message, type = 'success') {
        alert(message); // Simplificado temporariamente para o novo sistema
    }
};