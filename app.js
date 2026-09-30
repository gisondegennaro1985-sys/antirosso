// ==========================================
// GESTIONE BUDGET PWA - LOGICA PRINCIPALE (v1.4)
// ==========================================

let state = {
    salary: 0,
    monthlyFund: 0,
    dailyBudget: 0,
    piggyBank: 0,
    lastActiveDate: '',
    todayExpenses: [],
    futureInstallments: [],
    currentCycleStart: '',
    currentCycleEnd: ''
};

document.addEventListener('DOMContentLoaded', () => {
    initApp();

    document.getElementById('addExpenseBtn').addEventListener('click', handleAddExpense);
    document.getElementById('add3xBtn').addEventListener('click', handleAddInstallment);
    document.getElementById('saveSettingsBtn').addEventListener('click', handleSaveSettings);
});

function initApp() {
    loadState();
    initCycleDates();
    checkDateChange();
    recalculateDailyBudget();
    updateUI();
}

function loadState() {
    const saved = localStorage.getItem('budget_pwa_data');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            state = { ...state, ...parsed };
        } catch (e) {
            console.error("Errore lettura dati:", e);
        }
    }

    if (!state.lastActiveDate) {
        state.lastActiveDate = new Date().toISOString().split('T')[0];
    }
    
    if (isNaN(state.monthlyFund)) state.monthlyFund = 0;
    if (isNaN(state.salary)) state.salary = 0;
    if (isNaN(state.dailyBudget)) state.dailyBudget = 0;
    if (isNaN(state.piggyBank)) state.piggyBank = 0;
}

function saveState() {
    localStorage.setItem('budget_pwa_data', JSON.stringify(state));
}

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
}

function getDaysLeft() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let targetMonth = today.getMonth();
    let targetYear = today.getFullYear();

    if (today.getDate() >= 23) {
        targetMonth += 1;
        if (targetMonth > 11) {
            targetMonth = 0;
            targetYear += 1;
        }
    }

    const endDate = new Date(targetYear, targetMonth, 22);
    endDate.setHours(0, 0, 0, 0);

    const diffTime = endDate.getTime() - today.getTime();
    const days = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

    return days > 0 ? days : 1;
}

function recalculateDailyBudget() {
    const daysLeft = getDaysLeft();
    const fund = parseFloat(state.monthlyFund) || 0;
    state.dailyBudget = fund > 0 ? (fund / daysLeft) : 0;
}

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

    recalculateDailyBudget();
    saveState();
    updateUI();
}

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

    recalculateDailyBudget();
    saveState();
    updateUI();
}

function handleSaveSettings() {
    const salaryInput = document.getElementById('monthlySalaryInput');
    const newSalary = parseFloat(salaryInput.value);

    if (!isNaN(newSalary) && newSalary >= 0) {
        state.salary = newSalary;
        state.monthlyFund = newSalary;
        state.todayExpenses = []; 

        initCycleDates();
        recalculateDailyBudget();
        saveState();
        updateUI();
        alert('Ciclo resettato con successo!');
    }
}

function updateUI() {
    initCycleDates();

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

function formatDate(dateObj) {
    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}`;
}
