// ==========================================
// GESTIONE BUDGET PWA - LOGICA PRINCIPALE (v1.1)
// ==========================================

// Stato dell'applicazione
let state = {
    salary: 0,
    monthlyFund: 0,
    dailyBudget: 0,
    piggyBank: 0,
    lastActiveDate: new Date().toISOString().split('T')[0],
    todayExpenses: [],
    futureInstallments: [], // Rate programmate per i cicli futuri
    currentCycleStart: '',
    currentCycleEnd: ''
};

// Inizializzazione all'avvio
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    checkDateChange();
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

// Inizializza o aggiorna le date del ciclo (23 -> 22)
function initCycleDates() {
    const today = new Date();
    let start, end;

    if (today.getDate() >= 23) {
        start = new Date(today.getFullYear(), today.getMonth(), 23);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 22);
    } else {
        start = new Date(today.getFullYear(), today.getMonth() - 1, 23);
        end = new Date(today.getFullYear(), today.getMonth(), 22);
    }

    state.currentCycleStart = formatDate(start);
    state.currentCycleEnd = formatDate(end);
}

// Controlla se la giornata è cambiata per il reset notturno (50/50)
function checkDateChange() {
    const todayStr = new Date().toISOString().split('T')[0];

    if (state.lastActiveDate !== todayStr) {
        // È passato un giorno (o più)
        const spentToday = state.todayExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const unspent = state.dailyBudget - spentToday;

        if (unspent > 0) {
            // REGOLA 50/50: 50% al salvadanaio, 50% resta nel fondo mensile
            const toPiggy = unspent * 0.5;
            const toFund = unspent * 0.5;

            state.piggyBank += toPiggy;
            // Il restante 50% rientra nel fondo mensile (non lo detraiamo)
            state.monthlyFund -= spentToday; 
        } else {
            // Se si è sforato, l'intero importo speso viene scalato dal fondo mensile
            state.monthlyFund -= spentToday;
        }

        // Reset spese odierne
        state.todayExpenses = [];
        state.lastActiveDate = todayStr;
        
        recalculateDailyBudget();
        saveState();
    }
}

// Calcola il budget del giorno: Fondo Mensile / Giorni Rimanenti
function recalculateDailyBudget() {
    const today = new Date();
    const endDate = new Date(state.currentCycleEnd);
    
    // Calcola giorni rimanenti (incluso oggi)
    const diffTime = endDate - today;
    let daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (daysLeft < 1) daysLeft = 1;

    state.dailyBudget = state.monthlyFund > 0 ? (state.monthlyFund / daysLeft) : 0;
}

// Aggiunge una spesa singola
function handleAddExpense() {
    const amountInput = document.getElementById('expenseAmount');
    const noteInput = document.getElementById('expenseNote');
    const amount = parseFloat(amountInput.value);

    if (isNaN(amount) || amount <= 0) return;

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

// Gestione Pagamento 3 Rate PayPal
function handleAddInstallment() {
    const totalInput = document.getElementById('installmentTotal');
    const descInput = document.getElementById('installmentDesc');
    const total = parseFloat(totalInput.value);

    if (isNaN(total) || total <= 0) return;

    const singleRate = total / 3;
    const desc = descInput.value.trim() || 'Acquisto 3x';

    // 1ª Rata addebitata subito oggi come spesa normale
    state.todayExpenses.push({
        amount: singleRate,
        note: `1/3 ${desc}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    // Rate 2 e 3 salvate per i cicli futuri
    state.futureInstallments.push({ desc: `2/3 ${desc}`, amount: singleRate, cycleOffset: 1 });
    state.futureInstallments.push({ desc: `3/3 ${desc}`, amount: singleRate, cycleOffset: 2 });

    totalInput.value = '';
    descInput.value = '';

    saveState();
    updateUI();
}

// Impostazioni e Reset Ciclo
function handleSaveSettings() {
    const salaryInput = document.getElementById('monthlySalaryInput');
    const newSalary = parseFloat(salaryInput.value);

    if (!isNaN(newSalary) && newSalary >= 0) {
        state.salary = newSalary;
        state.monthlyFund = newSalary;

        // Addebito rate programmate per questo ciclo
        applyCurrentCycleInstallments();

        initCycleDates();
        recalculateDailyBudget();
        saveState();
        updateUI();
        alert('Ciclo aggiornato con successo!');
    }
}

// Applica le rate future programmate al reset del ciclo
function applyCurrentCycleInstallments() {
    let remainingFuture = [];
    state.futureInstallments.forEach(item => {
        item.cycleOffset -= 1;
        if (item.cycleOffset === 0) {
            // Scaliamo subito dal fondo mensile prima di fare il budget del giorno
            state.monthlyFund -= item.amount;
        } else {
            remainingFuture.push(item);
        }
    });
    state.futureInstallments = remainingFuture;
}

// Aggiorna l'interfaccia grafica
function updateUI() {
    // Label Ciclo
    document.getElementById('cycleDateLabel').textContent = `Ciclo: ${state.currentCycleStart} - ${state.currentCycleEnd}`;

    // Calcolo spesa odierna
    const spentToday = state.todayExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const remainingToday = state.dailyBudget - spentToday;

    // Budget Giorno Display
    document.getElementById('dailyBudgetDisplay').textContent = `€ ${remainingToday.toFixed(2)}`;
    
    // Status Badge & Progress Bar
    const statusBadge = document.getElementById('budgetStatusBadge');
    const progressBar = document.getElementById('dailyProgressBar');
    
    let percentage = state.dailyBudget > 0 ? ((spentToday / state.dailyBudget) * 100) : 0;
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

    // Fondo Mensile e Giorni Rimanenti
    document.getElementById('monthlyFundDisplay').textContent = `€ ${(state.monthlyFund - spentToday).toFixed(2)}`;
    
    const today = new Date();
    const endDate = new Date(state.currentCycleEnd);
    let daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    document.getElementById('daysLeftDisplay').textContent = daysLeft > 0 ? daysLeft : 1;

    // Salvadanaio
    document.getElementById('piggyBankDisplay').textContent = `€ ${state.piggyBank.toFixed(2)}`;

    // Lista Spese di Oggi
    const expenseList = document.getElementById('todayExpenseList');
    expenseList.innerHTML = '';
    state.todayExpenses.forEach(exp => {
        const li = document.createElement('li');
        li.className = 'expense-item';
        li.innerHTML = `
            <span>${exp.note} <small style="color:var(--text-secondary)">(${exp.time})</small></span>
            <span class="expense-amount">- € ${exp.amount.toFixed(2)}</span>
        `;
        expenseList.appendChild(li);
    });

    // Lista Rate Programmate
    const instContainer = document.getElementById('installmentsContainer');
    instContainer.innerHTML = '';
    if (state.futureInstallments.length > 0) {
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

    // Input Stipendio nelle impostazioni
    if (state.salary > 0) {
        document.getElementById('monthlySalaryInput').value = state.salary;
    }
}

// Utility formattazione data GG/MM
function formatDate(dateObj) {
    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}`;
}
