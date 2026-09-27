// Stato predefinito
const defaultState = {
  salary: 0,
  fixedExpenses: 0,
  piggyBank: 0,
  expenses: [],
  lastCalculatedDate: new Date().toISOString().split('T')[0]
};

// Caricamento dallo storage locale
let appState = defaultState;
function loadSavedState() {
  try {
    const saved = localStorage.getItem('antirosso_state');
    if (saved) {
      appState = Object.assign({}, defaultState, JSON.parse(saved));
    }
  } catch (e) {
    console.error("Errore lettura storage:", e);
  }
}

loadSavedState();

// Inizializzazione al caricamento della pagina
document.addEventListener('DOMContentLoaded', () => {
  checkDateRollover();
  loadSettingsFields();
  updateUI();
  setupEventListeners();
});

function saveState() {
  try {
    localStorage.setItem('antirosso_state', JSON.stringify(appState));
  } catch (e) {
    console.error("Errore salvataggio storage:", e);
  }
}

// Calcolo del ciclo dal 23 al 22
function getCycleDates() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();

  let startDate, endDate;
  if (day >= 23) {
    startDate = new Date(year, month, 23);
    endDate = new Date(year, month + 1, 22);
  } else {
    startDate = new Date(year, month - 1, 23);
    endDate = new Date(year, month, 22);
  }
  return { startDate, endDate };
}

function getDaysRemaining() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { endDate } = getCycleDates();
  endDate.setHours(23, 59, 59, 999);

  const diffTime = endDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(diffDays, 1);
}

function checkDateRollover() {
  const todayStr = new Date().toISOString().split('T')[0];
  if (appState.lastCalculatedDate && appState.lastCalculatedDate !== todayStr) {
    const remainingDays = getDaysRemaining() + 1;
    const baseFund = (appState.salary || 0) - (appState.fixedExpenses || 0);
    const creditSpent = (appState.expenses || [])
      .filter(e => e.type === 'credit')
      .reduce((sum, e) => sum + e.amount, 0);
    const debitSpentPast = (appState.expenses || [])
      .filter(e => e.type === 'debit' && e.date < appState.lastCalculatedDate)
      .reduce((sum, e) => sum + e.amount, 0);

    const prevDaily = (baseFund - creditSpent - debitSpentPast) / remainingDays;
    const spentOnLastDate = (appState.expenses || [])
      .filter(e => e.type === 'debit' && e.date === appState.lastCalculatedDate)
      .reduce((sum, e) => sum + e.amount, 0);

    const diff = prevDaily - spentOnLastDate;
    if (diff > 0) {
      appState.piggyBank = (appState.piggyBank || 0) + diff;
    }
    appState.lastCalculatedDate = todayStr;
    saveState();
  }
}

function calculateCurrentDailyBudget() {
  const salary = Number(appState.salary) || 0;
  const fixed = Number(appState.fixedExpenses) || 0;
  const baseFund = salary - fixed;

  const expenses = appState.expenses || [];
  const creditSpent = expenses
    .filter(e => e.type === 'credit')
    .reduce((sum, e) => sum + e.amount, 0);

  const todayStr = new Date().toISOString().split('T')[0];
  const debitSpentPast = expenses
    .filter(e => e.type === 'debit' && e.date < todayStr)
    .reduce((sum, e) => sum + e.amount, 0);

  const debitSpentToday = expenses
    .filter(e => e.type === 'debit' && e.date === todayStr)
    .reduce((sum, e) => sum + e.amount, 0);

  const netAvailable = baseFund - creditSpent - debitSpentPast;
  const days = getDaysRemaining();

  const rawDaily = days > 0 ? (netAvailable / days) : 0;
  return rawDaily - debitSpentToday;
}

function loadSettingsFields() {
  const salElem = document.getElementById('salary-amount');
  const fixElem = document.getElementById('fixed-expenses');
  if (salElem && appState.salary) salElem.value = appState.salary;
  if (fixElem && appState.fixedExpenses) fixElem.value = appState.fixedExpenses;
}

function renderExpensesList() {
  const listElem = document.getElementById('expenses-list');
  if (!listElem) return;

  listElem.innerHTML = '';
  const expenses = appState.expenses || [];

  if (expenses.length === 0) {
    listElem.innerHTML = '<li style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 10px 0;">Nessuna spesa registrata nel ciclo</li>';
    return;
  }

  const sorted = [...expenses].reverse();
  sorted.forEach(exp => {
    const li = document.createElement('li');
    li.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 0.9rem;';
    
    const typeLabel = exp.type === 'credit' ? 'Carta Credito' : 'Contanti/Bancomat';
    li.innerHTML = `
      <div>
        <strong>€ ${exp.amount.toFixed(2).replace('.', ',')}</strong>
        <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">${exp.date} - ${typeLabel}</span>
      </div>
      <button onclick="deleteExpense(${exp.id})" style="background: none; border: none; color: var(--status-red); font-weight: bold; font-size: 1.1rem; cursor: pointer; padding: 4px 8px;">✕</button>
    `;
    listElem.appendChild(li);
  });
}

function deleteExpense(id) {
  appState.expenses = (appState.expenses || []).filter(e => e.id !== id);
  saveState();
  updateUI();
}

function updateUI() {
  const { startDate, endDate } = getCycleDates();
  const options = { day: 'numeric', month: 'short' };
  const cycleElem = document.getElementById('cycle-dates');
  if (cycleElem) {
    cycleElem.textContent = `Ciclo dal ${startDate.toLocaleDateString('it-IT', options)} al ${endDate.toLocaleDateString('it-IT', options)}`;
  }

  const dailyBudget = calculateCurrentDailyBudget();
  const dailyBudgetElem = document.getElementById('daily-budget');
  if (dailyBudgetElem) {
    dailyBudgetElem.textContent = `€ ${dailyBudget.toFixed(2).replace('.', ',')}`;
  }

  const statusTag = document.getElementById('status-tag');
  if (dailyBudgetElem && statusTag) {
    if (dailyBudget < 0) {
      dailyBudgetElem.style.color = 'var(--status-red)';
      statusTag.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
      statusTag.style.color = 'var(--status-red)';
      statusTag.textContent = 'Budget Superato!';
    } else if (dailyBudget < 10) {
      dailyBudgetElem.style.color = 'var(--status-yellow)';
      statusTag.style.backgroundColor = 'rgba(245, 158, 11, 0.15)';
      statusTag.style.color = 'var(--status-yellow)';
      statusTag.textContent = 'Attenzione al limite';
    } else {
      dailyBudgetElem.style.color = 'var(--status-green)';
      statusTag.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
      statusTag.style.color = 'var(--status-green)';
      statusTag.textContent = 'In bilancio';
    }
  }

  const salary = Number(appState.salary) || 0;
  const fixed = Number(appState.fixedExpenses) || 0;
  const baseFund = salary - fixed;
  const totalSpent = (appState.expenses || []).reduce((sum, e) => sum + e.amount, 0);
  const remainingFund = baseFund - totalSpent;
  
  const monthlyFundElem = document.getElementById('monthly-fund');
  if (monthlyFundElem) {
    monthlyFundElem.textContent = `€ ${remainingFund.toFixed(2).replace('.', ',')}`;
  }

  const daysRemainingElem = document.getElementById('days-remaining');
  if (daysRemainingElem) {
    daysRemainingElem.textContent = getDaysRemaining();
  }

  const piggyElem = document.getElementById('piggy-amount');
  if (piggyElem) {
    piggyElem.textContent = `€ ${(appState.piggyBank || 0).toFixed(2).replace('.', ',')}`;
  }

  renderExpensesList();
}

function updateSettingsFromInputs() {
  const salElem = document.getElementById('salary-amount');
  const fixElem = document.getElementById('fixed-expenses');

  const salVal = salElem ? parseFloat(salElem.value) : 0;
  const fixVal = fixElem ? parseFloat(fixElem.value) : 0;

  appState.salary = isNaN(salVal) ? 0 : salVal;
  appState.fixedExpenses = isNaN(fixVal) ? 0 : fixVal;

  saveState();
  updateUI();
}

function setupEventListeners() {
  const salInput = document.getElementById('salary-amount');
  const fixInput = document.getElementById('fixed-expenses');

  if (salInput) {
    salInput.addEventListener('input', updateSettingsFromInputs);
    salInput.addEventListener('change', updateSettingsFromInputs);
  }
  if (fixInput) {
    fixInput.addEventListener('input', updateSettingsFromInputs);
    fixInput.addEventListener('change', updateSettingsFromInputs);
  }

  const salaryForm = document.getElementById('salary-form');
  if (salaryForm) {
    salaryForm.addEventListener('submit', (e) => {
      e.preventDefault();
      updateSettingsFromInputs();
      alert('Impostazioni aggiornate con successo!');
    });
  }

  const expenseForm = document.getElementById('expense-form');
  if (expenseForm) {
    expenseForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const amountInput = document.getElementById('expense-amount');
      const amount = parseFloat(amountInput.value);
      const paymentRadio = document.querySelector('input[name="payment-method"]:checked');
      const paymentMethod = paymentRadio ? paymentRadio.value : 'debit';

      if (!isNaN(amount) && amount > 0) {
        if (!appState.expenses) appState.expenses = [];
        appState.expenses.push({
          id: Date.now(),
          date: new Date().toISOString().split('T')[0],
          amount: amount,
          type: paymentMethod
        });
        saveState();
        updateUI();
        amountInput.value = '';
      }
    });
  }

  const resetBtn = document.getElementById('btn-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Vuoi davvero azzerare tutte le spese registrate e il salvadanaio?')) {
        appState.expenses = [];
        appState.piggyBank = 0;
        saveState();
        updateUI();
      }
    });
  }
}
