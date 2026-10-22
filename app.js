// Financial Brake v1.5
const APP_VERSION = "1.5";

let appState = {
  salary: 800.00,
  monthlyFund: 800.00,
  savings: 0.00,
  lastDate: null,
  todaySpent: 0.00,
  todayExpenses: [],
  cycleExpenses: [], // Storico spese del ciclo corrente per categoria
  installments: []
};

function initApp() {
  loadState();
  checkDateAndRollover();
  renderUI();
}

function loadState() {
  const saved = localStorage.getItem("financial_brake_state");
  if (saved) {
    try {
      appState = { ...appState, ...JSON.parse(saved) };
    } catch(e) { console.error("Error loading state", e); }
  }
}

function saveState() {
  localStorage.setItem("financial_brake_state", JSON.stringify(appState));
}

function getCurrentCycleDates() {
  const now = new Date();
  let startYear = now.getFullYear();
  let startMonth = now.getMonth();

  if (now.getDate() < 23) {
    startMonth--;
    if (startMonth < 0) {
      startMonth = 11;
      startYear--;
    }
  }

  const startDate = new Date(startYear, startMonth, 23);
  const endDate = new Date(startYear, startMonth + 1, 22);
  return { startDate, endDate };
}

function checkDateAndRollover() {
  const todayStr = new Date().toISOString().split('T')[0];
  
  if (!appState.lastDate) {
    appState.lastDate = todayStr;
    saveState();
    return;
  }

  if (appState.lastDate !== todayStr) {
    const { startDate } = getCurrentCycleDates();
    const lastDateObj = new Date(appState.lastDate);

    // Nuovo Ciclo (23 del mese)
    if (new Date(todayStr) >= startDate && lastDateObj < startDate) {
      appState.monthlyFund = appState.salary;
      appState.cycleExpenses = [];
    } else {
      // Rollover Notturno standard
      const { endDate } = getCurrentCycleDates();
      const now = new Date();
      const diffTime = endDate.getTime() - now.getTime();
      const daysLeft = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      const dailyTarget = appState.monthlyFund / daysLeft;
      
      const surplus = dailyTarget - appState.todaySpent;

      if (surplus > 0) {
        const halfSurplus = surplus / 2;
        appState.savings += halfSurplus;
        appState.monthlyFund -= (appState.todaySpent + halfSurplus);
      } else {
        const deficit = Math.abs(surplus);
        if (appState.savings >= deficit) {
          appState.savings -= deficit;
          appState.monthlyFund -= dailyTarget;
        } else {
          const remainingDeficit = deficit - appState.savings;
          appState.savings = 0;
          appState.monthlyFund -= (dailyTarget + remainingDeficit);
        }
      }
    }

    appState.todaySpent = 0.00;
    appState.todayExpenses = [];
    appState.lastDate = todayStr;
    saveState();
  }
}

function addExpense() {
  const amountInput = document.getElementById("expenseAmount");
  const catInput = document.getElementById("expenseCategory");
  const descInput = document.getElementById("expenseDesc");

  const amount = parseFloat(amountInput.value);
  const category = catInput.value;
  const desc = descInput.value.trim() || "Spesa";

  if (isNaN(amount) || amount <= 0) return;

  const newExpense = { amount, category, desc, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) };

  appState.todaySpent += amount;
  appState.todayExpenses.push(newExpense);
  appState.cycleExpenses.push(newExpense);

  amountInput.value = "";
  descInput.value = "";

  saveState();
  renderUI();
}

function renderUI() {
  const { startDate, endDate } = getCurrentCycleDates();
  const now = new Date();
  
  // Date Ciclo
  const formatDate = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}`;
  document.getElementById("cycleDatesDisplay").innerText = `CICLO: ${formatDate(startDate)} - ${formatDate(endDate)}`;

  // Giorni al reset
  const diffTime = endDate.getTime() - now.getTime();
  const daysLeft = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  document.getElementById("daysToResetDisplay").innerText = daysLeft;

  // Budget Giornaliero
  const availableToday = (appState.monthlyFund / daysLeft) - appState.todaySpent;
  const todayDisplay = document.getElementById("todayBudgetDisplay");
  todayDisplay.innerText = `€ ${availableToday.toFixed(2)}`;

  const badge = document.getElementById("statusBadge");
  if (availableToday < 0) {
    todayDisplay.style.color = "var(--danger-color)";
    badge.className = "badge badge-over";
    badge.innerText = "Sforato";
  } else {
    todayDisplay.style.color = "var(--success-color)";
    badge.className = "badge badge-target";
    badge.innerText = "In target";
  }

  // Fondo e Salvadanaio
  document.getElementById("monthlyFundDisplay").innerText = `€ ${appState.monthlyFund.toFixed(2)}`;
  document.getElementById("savingsDisplay").innerText = `€ ${appState.savings.toFixed(2)}`;

  // Lista spese di oggi
  const todayList = document.getElementById("todayExpensesList");
  todayList.innerHTML = "";
  appState.todayExpenses.forEach(exp => {
    const li = document.createElement("li");
    li.innerHTML = `<div><strong>${exp.desc}</strong><span class="expense-cat-tag">${exp.category}</span></div><div>- € ${exp.amount.toFixed(2)}</div>`;
    todayList.appendChild(li);
  });

  // Riepilogo Categorie Ciclo
  renderCategorySummary();
}

function renderCategorySummary() {
  const summaryContainer = document.getElementById("categorySummaryList");
  summaryContainer.innerHTML = "";

  const categoryTotals = {};
  let totalCycleSpent = 0;

  appState.cycleExpenses.forEach(exp => {
    categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
    totalCycleSpent += exp.amount;
  });

  if (totalCycleSpent === 0) {
    summaryContainer.innerHTML = `<p class="card-desc">Nessuna spesa registrata in questo ciclo.</p>`;
    return;
  }

  Object.keys(categoryTotals).forEach(cat => {
    const amount = categoryTotals[cat];
    const percentage = Math.round((amount / totalCycleSpent) * 100);

    const catItem = document.createElement("div");
    catItem.className = "cat-item";
    catItem.innerHTML = `
      <div class="cat-header">
        <span>${cat}</span>
        <span>€ ${amount.toFixed(2)} (${percentage}%)</span>
      </div>
      <div class="cat-bar-bg">
        <div class="cat-bar-fill" style="width: ${percentage}%"></div>
      </div>
    `;
    summaryContainer.appendChild(catItem);
  });
}

// Event Listeners
document.getElementById("addExpenseBtn").addEventListener("click", addExpense);
document.getElementById("saveSalaryBtn").addEventListener("click", () => {
  const salaryVal = parseFloat(document.getElementById("monthlySalaryInput").value);
  if (!isNaN(salaryVal) && salaryVal > 0) {
    appState.salary = salaryVal;
    saveState();
    alert("Budget base aggiornato!");
  }
});

window.onload = initApp;
