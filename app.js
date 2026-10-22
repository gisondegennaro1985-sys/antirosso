// Event Listeners
document.getElementById("addExpenseBtn").addEventListener("click", addExpense);

document.getElementById("saveSalaryBtn").addEventListener("click", () => {
  const salaryVal = parseFloat(document.getElementById("monthlySalaryInput").value);
  if (!isNaN(salaryVal) && salaryVal > 0) {
    appState.salary = salaryVal;
    appState.monthlyFund = salaryVal; // <- AGGIORNATO: allinea subito il Fondo Rimanente al nuovo budget
    saveState();
    renderUI();
    alert("Budget aggiornato e applicato subito!");
  }
});

window.onload = initApp;
