const STORAGE_KEY = 'antirosso_pwa_data_v1';

// Dynamic default state generator
function getDefaultState() {
  const today = new Date();
  return {
    cycleStartDate: null, // e.g. "2026-09-23"
    salary: 0,
    fixedExpenses: 0,
    piggyBank: 0,
    transactions: [], // { id, date, description, amount, type: 'daily' | 'credit', timestamp }
    lastRolloverCheck: today.toISOString().split('T')[0]
  };
}

// Load state from localStorage or create default
let appState = (function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return getDefaultState();
  try {
    return JSON.parse(saved);
  } catch (e) {
    console.error('Failed to parse saved state:', e);
    return getDefaultState();
  }
})();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  renderUI();
}

/**
 * Calculates current cycle boundary dates:
 * Cycle starts on the 23rd of month A and ends on the 22nd of month B.
 */
function getCycleDates() {
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let startYear = currentYear;
  let startMonth = currentMonth;

  // If before the 23rd, the current cycle started on the 23rd of the previous month
  if (currentDay < 23) {
    startMonth = currentMonth - 1;
    if (startMonth < 0) {
      startMonth = 11;
      startYear = currentYear - 1;
    }
  }

  const cycleStart = new Date(startYear, startMonth, 23);
  
  // Cycle ends on the 22nd of next month
  let endMonth = startMonth + 1;
  let endYear = startYear;
  if (endMonth > 11) {
    endMonth = 0;
    endYear = startYear + 1;
  }
  const cycleEnd = new Date(endYear, endMonth, 22, 23, 59, 59);

  return { cycleStart, cycleEnd };
}

/**
 * Returns total days remaining in the current cycle, including today.
 */
function getRemainingDaysInCycle() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const { cycleEnd } = getCycleDates();
  const endOfDay = new Date(cycleEnd);
  endOfDay.setHours(0, 0, 0, 0);

  const diffTime = endOfDay.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(diffDays, 1);
}

/**
 * Calculates remaining total flexible pool for current cycle
 * Formula: Salary - Fixed Expenses - Total Daily Transactions - Total Credit Card Transactions
 */
function calculateFlexiblePool() {
  const { cycleStart, cycleEnd } = getCycleDates();
  
  const cycleTransactions = appState.transactions.filter(t => {
    const tDate = new Date(t.timestamp);
    return tDate >= cycleStart && tDate <= cycleEnd;
  });

  const totalSpent = cycleTransactions.reduce((acc, t) => acc + Number(t.amount), 0);
  const remainingPool = (appState.salary - appState.fixedExpenses) - totalSpent;

  return {
    remainingPool,
    cycleTransactions,
    totalSpent
  };
}

/**
 * Calculates daily allowance for TODAY:
 * Daily Allowance = Remaining Flexible Pool / Remaining Days in Cycle
 */
function calculateTodayAllowance() {
  const { remainingPool } = calculateFlexiblePool();
  const remainingDays = getRemainingDaysInCycle();

  // Spendings already incurred today
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySpent = appState.transactions
    .filter(t => t.timestamp.startsWith(todayStr))
    .reduce((acc, t) => acc + Number(t.amount), 0);

  // Remaining budget left specifically for today
  const dailyTarget = remainingPool / remainingDays;
  const todayLeft = dailyTarget - todaySpent;

  return {
    dailyTarget,
    todaySpent,
    todayLeft,
    remainingDays
  };
}

function checkAndProcessRollover() {
  const todayStr = new Date().toISOString().split('T')[0];
  if (appState.lastRolloverCheck === todayStr) return;

  const lastCheck = new Date(appState.lastRolloverCheck);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  // If a day has passed since last check
  if (lastCheck < new Date(todayStr)) {
    // Process previous day's unused allowance into piggy bank
    const { dailyTarget } = calculateTodayAllowance();
    const prevDaySpent = appState.transactions
      .filter(t => t.timestamp.startsWith(appState.lastRolloverCheck))
      .reduce((acc, t) => acc + Number(t.amount), 0);

    const unusedAllowance = dailyTarget - prevDaySpent;
    if (unusedAllowance > 0) {
      appState.piggyBank += unusedAllowance;
    }

    appState.lastRolloverCheck = todayStr;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  }
}

function renderUI() {
  checkAndProcessRollover();

  const { todayLeft, dailyTarget, remainingDays } = calculateTodayAllowance();
  const { remainingPool } = calculateFlexiblePool();

  // DOM Elements
  const heroAmountEl = document.getElementById('hero-amount');
  const heroSubtitleEl = document.getElementById('hero-subtitle');
  const heroCardEl = document.getElementById('hero-card');
  const piggyAmountEl = document.getElementById('piggy-amount');
  const historyListEl = document.getElementById('history-list');

  if (heroAmountEl) {
    heroAmountEl.textContent = `€${todayLeft.toFixed(2)}`;
  }

  if (heroSubtitleEl) {
    heroSubtitleEl.textContent = `Pool mensile: €${remainingPool.toFixed(2)} | Giorni rimasti: ${remainingDays}`;
  }

  // Update semaphoric color status
  if (heroCardEl) {
    heroCardEl.classList.remove('status-ok', 'status-warning', 'status-danger');
    if (todayLeft < 0) {
      heroCardEl.classList.add('status-danger');
    } else if (todayLeft < dailyTarget * 0.2) {
      heroCardEl.classList.add('status-warning');
    } else {
      heroCardEl.classList.add('status-ok');
    }
  }

  if (piggyAmountEl) {
    piggyAmountEl.textContent = `€${appState.piggyBank.toFixed(2)}`;
  }

  // Render recent transactions
  if (historyListEl) {
    historyListEl.innerHTML = '';
    const sorted = [...appState.transactions].reverse().slice(0, 10);
    
    if (sorted.length === 0) {
      historyListEl.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:10px;">Nessuna spesa registrata.</div>';
    } else {
      sorted.forEach(t => {
        const item = document.createElement('div');
        item.className = `history-item ${t.type === 'credit' ? 'credit-card' : ''}`;
        const dateFormatted = new Date(t.timestamp).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        
        item.innerHTML = `
          <div class="history-details">
            <span class="history-name">${t.description || (t.type === 'credit' ? 'Carta di Credito' : 'Spesa Giornaliera')}</span>
            <span class="history-date">${dateFormatted} • ${t.type === 'credit' ? '💳 Carta' : '💵 Contante/Conto'}</span>
          </div>
          <span class="history-amount">-€${Number(t.amount).toFixed(2)}</span>
        `;
        historyListEl.appendChild(item);
      });
    }
  }
}

function addTransaction(amount, description, type) {
  if (isNaN(amount) || amount <= 0) return alert('Inserisci un importo valido.');
  
  const newTx = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    amount: Number(amount),
    description: description.trim(),
    type: type // 'daily' or 'credit'
  };

  appState.transactions.push(newTx);
  saveState();
}

function updateSalaryAndFixed(salary, fixed) {
  if (isNaN(salary) || salary < 0) return alert('Inserisci uno stipendio valido.');
  appState.salary = Number(salary);
  appState.fixedExpenses = Number(fixed) || 0;
  saveState();
}

document.addEventListener('DOMContentLoaded', () => {
  renderUI();

  // Transaction form handler
  const txForm = document.getElementById('tx-form');
  if (txForm) {
    txForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const amountInput = document.getElementById('tx-amount');
      const descInput = document.getElementById('tx-desc');
      const typeInput = document.getElementById('tx-type');

      addTransaction(amountInput.value, descInput.value, typeInput.value);
      amountInput.value = '';
      descInput.value = '';
    });
  }

  // Cycle Settings form handler
  const cycleForm = document.getElementById('cycle-form');
  if (cycleForm) {
    cycleForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const salaryInput = document.getElementById('salary-input');
      const fixedInput = document.getElementById('fixed-input');

      updateSalaryAndFixed(salaryInput.value, fixedInput.value);
      const modal = document.getElementById('settings-modal');
      if (modal) modal.classList.remove('active');
    });
  }

  // Service Worker Registration for iOS PWA Offline Mode
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('Service Worker Registrato con successo:', reg.scope))
        .catch(err => console.error('Errore registrazione Service Worker:', err));
    });
  }
});
