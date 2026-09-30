// ==========================================
// GESTIONE BUDGET PWA - LOGICA PRINCIPALE (v1.1 CORRETTA)
// ==========================================

// Stato dell'applicazione
let state = {
    salary: 0,
    monthlyFund: 0,
    dailyBudget: 0,
    piggyBank: 0,
    lastActiveDate: new Date().toISOString().split('T')[0],
    todayExpenses: [],
    futureInstallments: [],
    currentCycleStart: '',
    currentCycleEnd: ''
};

// Inizializzazione all'avvio
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    checkDateChange();
    recalculateDailyBudget();
    updateUI();

    // Event Listeners
    document.getElementById('addExpenseBtn').addEventListener('click', handleAddExpense);
    document.getElementById('add3xBtn').addEventListener('click', handleAddInstallment);
    document.getElementById('saveSettingsBtn').addEventListener('click', handleSaveSettings);
});

// Carica stato da LocalStorage
function loadState() {
    const saved = localStorage.getItem('budget_pwa_data');
    if (saved) {
        try {
            state = { ...state, ...JSON.parse(saved) };
        } catch (e) {
            console.error("Errore caricamento dati:", e);
        }
    }
    initCycleDates();
}

// Salva stato in LocalStorage
function saveState() {
    localStorage.setItem('budget_pwa_data', JSON.stringify(state));
}

// Inizializza le date del ciclo (23 del mese -> 22 del mese successivo)
function initCycleDates() {
    const today = new Date();
    let startYear = today.getFullYear();
    let startMonth = today.getMonth();

    if (today.getDate() < 23) {
        startMonth -= 1;
        if (startMonth < 0) {
            startMonth = 11;
            startYear -= 1;
        }
    }

    const start = new Date(startYear, startMonth, 23);
    const end = new Date(startYear, startMonth + 1, 22);

    state.currentCycleStart = formatDate(start);
    state.currentCycleEnd = formatDate(end);
    state.rawEndDate = end.toISOString().split('T')[0];
}

// Controlla il cambio data a mezzanotte (Regola 50/50)
function checkDateChange() {
    const todayStr = new Date().toISOString().split('T')[0];

    if (state.lastActiveDate !== todayStr) {
        const spentToday = (state.todayExpenses || []).reduce((sum, exp) => sum + exp.amount, 0);
        const unspent = state.dailyBudget - spentToday;

        if (unspent > 0) {
            state.piggyBank = (state.piggyBank || 0) + (unspent * 0.5);
            state.monthlyFund = (state.monthlyFund || 0) - spentToday; 
        } else {
            state.monthlyFund = (state.monthlyFund || 0) - spentToday;
        }

        state.todayExpenses = [];
        state.lastActiveDate = todayStr;
        
        recalculateDailyBudget();
        saveState();
    }
}

// Calcola i giorni rimanenti fino al 22 (incluso oggi)
function getDaysLeft() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parts = state.currentCycleEnd.split('/'); // GG/MM
    if (parts.length < 2) return 1;

    let endYear = today.getFullYear();
    let endMonth = parseInt(parts[1], 10) - 1;

    // Se il mese di fine è prima del mese corrente (es. a dicembre/gennaio)
    if (endMonth < today.getMonth()) {
        endYear += 1;
    }

    const endDate = new Date(endYear, endMonth, parseInt(parts[0], 10));
    endDate.setHours(0, 0, 0, 0);

    const diffTime = endDate.getTime() - today.getTime();
    let days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 include la giornata odierna

    return days > 0 ? days : 1;
}

// Calcola il budget per oggi
function recalculateDailyBudget() {
    const daysLeft = getDaysLeft();
    const currentFund = state.monthlyFund || 0;

    state.dailyBudget = currentFund > 0 ? (currentFund / daysLeft) : 0;
}

// Aggiungi Spesa Singola
function handleAddExpense() {
    const amountInput = document.getElementById('expenseAmount');
    const noteInput = document.getElementById('expenseNote');
    const amount = parseFloat(amountInput.value);

    if (isNaN(amount) || amount <= 0) return;

    if (!state.todayExpenses) state.todayExpenses = [];

    state.todayExpenses.push({
        amount: amount,
        note: noteInput.value.trim() || 'Spesa',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    amountInput.value = '';
    noteInput.value = '';

    saveState();
    updateUI();
}

// Aggiungi 3 Rate PayPal
function handleAddInstallment() {
    const totalInput = document.getElementById('installmentTotal');
    const descInput = document.getElementById('installmentDesc');
    const total = parseFloat(totalInput.value);

    if (isNaN(total) || total <= 0) return;

    const singleRate = total / 3;
    const desc = descInput.value.trim() || 'Acquisto 3x';

    if (!state.todayExpenses) state.todayExpenses = [];
    if (!state.futureInstallments) state.futureInstallments = [];

    state.todayExpenses.push({
        amount: singleRate,
        note: `1/3 ${desc}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    state.futureInstallments.push({ desc: `2/3 ${desc}`, amount: singleRate, cycleOffset: 1 });
    state.futureInstallments.push({ desc: `3/3 ${desc}`, amount: singleRate, cycleOffset: 2 });

    totalInput.value = '';
    descInput.value = '';

    saveState();
    updateUI();
}

// Salva Impostazioni e Resetta Ciclo
function handleSaveSettings() {
    const salaryInput = document.getElementById('monthlySalaryInput');
    const newSalary = parseFloat(salaryInput.value);

    if (!isNaN(newSalary) && newSalary >= 0) {
        state.salary = newSalary;
        state.monthlyFund = newSalary;

        applyCurrentCycleInstallments();
        initCycleDates();
        recalculateDailyBudget();
        saveState();
        updateUI();
        alert('Ciclo aggiornato!');
    }
}

// Applica le rate del mese
function applyCurrentCycleInstallments() {
    if (!state.futureInstallments) return;
    let remainingFuture = [];
    state.futureInstallments.forEach(item => {
        item.cycleOffset -= 1;
        if (item.cycleOffset === 0) {
            state.monthlyFund -= item.amount;
        } else {
            remainingFuture.push(item);
        }
    });
    state.futureInstallments = remainingFuture;
}

// Aggiorna la Grafica
function updateUI() {
    document.getElementById('cycleDateLabel').textContent = `Ciclo: ${state.currentCycleStart} - ${state.currentCycleEnd}`;

    const spentToday = (state.todayExpenses || []).reduce((sum, exp) => sum + exp.amount, 0);
    const dailyBudget = state.dailyBudget || 0;
    const remainingToday = dailyBudget - spentToday;

    document.getElementById('dailyBudgetDisplay').textContent = `€ ${remainingToday.toFixed(2)}`;

    const statusBadge = document.getElementById('budgetStatusBadge');
    const progressBar = document.getElementById('dailyProgressBar');

    let percentage = dailyBudget > 0 ? ((spentToday / dailyBudget) * 100) : 0;
    if (percentage > 100) percentage = 100;

    progressBar.style.width = `${percentage}%`;

    if (remainingToday < 0) {
        statusBadge.textContent = "Sforato";
        statusBadge.style.backgroundColor = "rgba(255, 69, 58, 0.2)";
        statusBadge.style.color = "var(--accent-red)";
        progressBar.style.backgroundColor = "var(--accent-red)";
    } else {
        statusBadge.textContent = "In target";
        statusBadge.style.backgroundColor = "rgba(48, 209, 88, 0.15)";
        statusBadge.style.color = "var(--accent-green)";
        progressBar.style.backgroundColor = "var(--accent-green)";
    }

    const monthlyFund = state.monthlyFund || 0;
    document.getElementById('monthlyFundDisplay').textContent = `€ ${(monthlyFund - spentToday).toFixed(2)}`;

    const daysLeft = getDaysLeft();
    document.getElementById('daysLeftDisplay').textContent = daysLeft;

    const piggy = state.piggyBank || 0;
    document.getElementById('piggyBankDisplay').textContent = `€ ${piggy.toFixed(2)}`;

    // Spese di Oggi
    const expenseList = document.getElementById('todayExpenseList');
    expenseList.innerHTML = '';
    (state.todayExpenses || []).forEach(exp => {
        const li = document.createElement('li');
        li.className = 'expense-item';
        li.innerHTML = `
            <span>${exp.note} <small style="color:var(--text-secondary)">(${exp.time})</small></span>
            <span class="expense-amount">- € ${exp.amount.toFixed(2)}</span>
        `;
        expenseList.appendChild(li);
    });

    // Rate
    const instContainer = document.getElementById('installmentsContainer');
    instContainer.innerHTML = '';
    if (state.futureInstallments && state.futureInstallments.length > 0) {
        state.futureInstallments.forEach(inst => {
            const div = document.createElement('div');
            div.className = 'installment-item';
            div.innerHTML = `
                <span>${inst.desc} (Prossimo ciclo)</span>
                <span style="font-weight:700">€ ${inst.amount.toFixed(2)}</span>
            `;
            instContainer.appendChild(div);
        });
    }

    if (state.salary > 0) {
        document.getElementById('monthlySalaryInput').value = state.salary;
    }
}

// Utility formattazione data
function formatDate(dateObj) {
    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}`;
}
