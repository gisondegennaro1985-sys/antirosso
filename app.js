function handleSaveSettings() {
    const salaryInput = document.getElementById('monthlySalaryInput');
    const newSalary = parseFloat(salaryInput.value);

    if (!isNaN(newSalary) && newSalary >= 0) {
        state.salary = newSalary;
        state.monthlyFund = newSalary;
        state.todayExpenses = []; // Azzera le spese odierne di test

        applyCurrentCycleInstallments();
        initCycleDates();
        recalculateDailyBudget();
        saveState();
        updateUI();
        alert('Ciclo resettato e aggiornato!');
    }
}
