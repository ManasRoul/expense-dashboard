let allTransactions = [];
let charts = {};

let INCOME_KEYS = [];
let EXPENSE_KEYS = [];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Load categories dynamically from settings
async function loadCategoryKeys() {
    try {
        const res = await fetch('/api/settings', { credentials: 'include' });
        const categories = await res.json();
        
        INCOME_KEYS = categories
            .filter(cat => cat.type === 'income_category' && (cat.active === 1 || cat.active === true))
            .map(cat => cat.key_id);
        
        EXPENSE_KEYS = categories
            .filter(cat => cat.type === 'expense_category' && (cat.active === 1 || cat.active === true))
            .map(cat => cat.key_id);
    } catch (err) {
        console.error('Error loading categories:', err);
        // Fallback to hardcoded lists if API fails
        INCOME_KEYS = ['room_rent','mattress_charge','travel_cab','kitchen_facility','clean_charge','misc_receipt'];
        EXPENSE_KEYS = ['brokerage','salary','room_cleaning_charge','generator_maintenance','hotel_stationary','hotel_cleaning_sanitation','rent_taxes','tv_recharge','camera_wifi','plumbing_maintenance','electricity_maintenance','electricity_bill','staff_fooding','laundry','owner_kitchen_cab','office_stationary','misc_expenses'];
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    await loadCategoryKeys();
    
    const res = await fetch('/api/transactions?limit=all', { credentials: 'include' });
    allTransactions = await res.json();
    allTransactions.sort((a, b) => a.date.localeCompare(b.date));

    populateFilters();
    renderMonthlyTab();
});

function populateFilters() {
    const monthsSet = new Set(), yearsSet = new Set();
    allTransactions.forEach(t => {
        // Extract just the date part (YYYY-MM-DD) if time is included
        const dateOnly = t.date.split(' ')[0];
        const [y, m] = dateOnly.split('-');
        yearsSet.add(y);
        monthsSet.add(`${y}-${m}`);
    });

    const monthSelect = document.getElementById('monthFilter');
    const sortedMonths = [...monthsSet].sort().reverse();
    monthSelect.innerHTML = sortedMonths.map(m => {
        const [y, mo] = m.split('-');
        return `<option value="${m}">${MONTHS[parseInt(mo)-1]} ${y}</option>`;
    }).join('');

    const yearSelect = document.getElementById('yearFilter');
    const sortedYears = [...yearsSet].sort().reverse();
    yearSelect.innerHTML = '<option value="all">All Years</option>' + sortedYears.map(y => `<option value="${y}">${y}</option>`).join('');
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach((btn, i) => {
        btn.classList.toggle('active', (i === 0 && tab === 'monthly') || (i === 1 && tab === 'yearly'));
    });
    document.getElementById('tab-monthly').classList.toggle('active', tab === 'monthly');
    document.getElementById('tab-yearly').classList.toggle('active', tab === 'yearly');
    if (tab === 'monthly') renderMonthlyTab();
    else renderYearlyTab();
}

// --- MONTHLY TAB ---
function renderMonthlyTab() {
    renderMonthlySummaryTable();

    const month = document.getElementById('monthFilter').value;
    const filtered = allTransactions.filter(t => {
        // Extract just the date part (YYYY-MM-DD) if time is included
        const dateOnly = t.date.split(' ')[0];
        return dateOnly.startsWith(month);
    });

    destroy('monthBalance', 'monthDaily', 'monthIncome', 'monthExpense');

    // Daily balance
    charts.monthBalance = lineChart('monthBalanceChart', filtered.map(t => fmtDay(t.date)), filtered.map(t => parseFloat(t.closing_balance)), 'Closing Balance', '#3b82f6');

    // Daily income vs expense
    charts.monthDaily = barChart('monthDailyChart', filtered.map(t => fmtDay(t.date)),
        [{ label: 'Income', data: filtered.map(t => parseFloat(t.total_income)), bg: 'rgba(16,185,129,0.7)' },
         { label: 'Expense', data: filtered.map(t => parseFloat(t.total_expense)), bg: 'rgba(239,68,68,0.7)' }]);

    // Category doughnuts
    const inc = sumCategories(filtered, INCOME_KEYS);
    const exp = sumCategories(filtered, EXPENSE_KEYS);
    charts.monthIncome = doughnutChart('monthIncomeChart', inc, ['#10b981','#3b82f6','#f59e0b','#8b5cf6','#ec4899','#06b6d4']);
    charts.monthExpense = doughnutChart('monthExpenseChart', exp, ['#ef4444','#f97316','#eab308','#84cc16','#14b8a6','#6366f1','#a855f7','#ec4899','#f43f5e','#78716c','#0ea5e9','#22d3ee','#4ade80','#facc15','#fb923c','#c084fc','#94a3b8']);
}

// --- YEARLY TAB ---
function renderYearlyTab() {
    destroy('yearBalance', 'yearMonthly', 'yearIncome', 'yearExpense');

    // Aggregate by year
    const yearlyData = {};
    allTransactions.forEach(t => {
        // Extract just the date part (YYYY-MM-DD) if time is included
        const dateOnly = t.date.split(' ')[0];
        const y = dateOnly.split('-')[0];
        if (!yearlyData[y]) yearlyData[y] = { income: 0, expense: 0, lastBalance: 0 };
        yearlyData[y].income += parseFloat(t.total_income) || 0;
        yearlyData[y].expense += parseFloat(t.total_expense) || 0;
        yearlyData[y].lastBalance = parseFloat(t.closing_balance) || 0;
    });

    const years = Object.keys(yearlyData).sort();

    // Yearly income vs expense
    charts.yearMonthly = barChart('yearMonthlyChart', years,
        [{ label: 'Income', data: years.map(y => yearlyData[y].income), bg: 'rgba(16,185,129,0.8)' },
         { label: 'Expense', data: years.map(y => yearlyData[y].expense), bg: 'rgba(239,68,68,0.8)' }]);

    // Yearly balance trend
    charts.yearBalance = lineChart('yearBalanceChart', years, years.map(y => yearlyData[y].lastBalance), 'Closing Balance', '#3b82f6');

    renderYearlySummaryCards(yearlyData, years);
    renderYearDoughnuts();
}

function renderYearlySummaryCards(yearlyData, years) {
    const container = document.getElementById('yearlySummaryCards');
    container.innerHTML = years.map(y => {
        const d = yearlyData[y];
        const available = d.income - d.expense;
        return `<div class="month-card" onclick="this.classList.toggle('flipped')">
            <div class="month-card-inner">
                <div class="month-card-front" style="background: ${monthGradient(y)}">
                    <div class="month-name">${y}</div>
                    <div class="flip-hint">tap to view details</div>
                </div>
                <div class="month-card-back">
                    <div class="row income"><span class="label">Income</span><span class="value">₹${d.income.toFixed(2)}</span></div>
                    <div class="row expense"><span class="label">Expense</span><span class="value">₹${d.expense.toFixed(2)}</span></div>
                    <div class="row available"><span class="label">Available</span><span class="value">₹${available.toFixed(2)}</span></div>
                </div>
            </div>
        </div>`;
    }).join('') || '<p class="loading-message">No data available</p>';
}

// --- MONTHLY SUMMARY CARDS ---
const MONTH_CARD_GRADIENTS = [
    ['#3b82f6', '#6366f1'], ['#10b981', '#059669'], ['#f59e0b', '#ea580c'],
    ['#ec4899', '#db2777'], ['#8b5cf6', '#7c3aed'], ['#06b6d4', '#0891b2'],
    ['#ef4444', '#dc2626'], ['#14b8a6', '#0d9488'], ['#f43f5e', '#e11d48'],
    ['#84cc16', '#65a30d'], ['#6366f1', '#4f46e5'], ['#eab308', '#ca8a04']
];
function monthGradient(ym) {
    let hash = 0;
    for (let i = 0; i < ym.length; i++) hash = (hash * 31 + ym.charCodeAt(i)) >>> 0;
    const [a, b] = MONTH_CARD_GRADIENTS[hash % MONTH_CARD_GRADIENTS.length];
    return `linear-gradient(135deg, ${a}, ${b})`;
}

function renderMonthlySummaryTable() {
    const monthlyData = {};
    allTransactions.forEach(t => {
        const dateOnly = t.date.split(' ')[0];
        const ym = dateOnly.slice(0, 7); // YYYY-MM
        if (!monthlyData[ym]) monthlyData[ym] = { income: 0, expense: 0 };
        monthlyData[ym].income += parseFloat(t.total_income) || 0;
        monthlyData[ym].expense += parseFloat(t.total_expense) || 0;
    });

    const months = Object.keys(monthlyData).sort(); // chronological order so back-dated months land in their correct slot
    const container = document.getElementById('monthlySummaryCards');
    container.innerHTML = months.map(ym => {
        const [y, mo] = ym.split('-');
        const d = monthlyData[ym];
        const available = d.income - d.expense;
        return `<div class="month-card" onclick="this.classList.toggle('flipped')">
            <div class="month-card-inner">
                <div class="month-card-front" style="background: ${monthGradient(ym)}">
                    <div class="month-name">${MONTHS[parseInt(mo) - 1]} ${y}</div>
                    <div class="flip-hint">tap to view details</div>
                </div>
                <div class="month-card-back">
                    <div class="row income"><span class="label">Income</span><span class="value">₹${d.income.toFixed(2)}</span></div>
                    <div class="row expense"><span class="label">Expense</span><span class="value">₹${d.expense.toFixed(2)}</span></div>
                    <div class="row available"><span class="label">Available</span><span class="value">₹${available.toFixed(2)}</span></div>
                </div>
            </div>
        </div>`;
    }).join('') || '<p class="loading-message">No data available</p>';
}

function renderYearDoughnuts() {
    destroy('yearIncome', 'yearExpense');
    const year = document.getElementById('yearFilter').value;
    const filtered = year === 'all' ? allTransactions : allTransactions.filter(t => t.date.startsWith(year));

    const inc = sumCategories(filtered, INCOME_KEYS);
    const exp = sumCategories(filtered, EXPENSE_KEYS);
    charts.yearIncome = doughnutChart('yearIncomeChart', inc, ['#10b981','#3b82f6','#f59e0b','#8b5cf6','#ec4899','#06b6d4']);
    charts.yearExpense = doughnutChart('yearExpenseChart', exp, ['#ef4444','#f97316','#eab308','#84cc16','#14b8a6','#6366f1','#a855f7','#ec4899','#f43f5e','#78716c','#0ea5e9','#22d3ee','#4ade80','#facc15','#fb923c','#c084fc','#94a3b8']);
}

// --- HELPERS ---
function sumCategories(transactions, keys) {
    const totals = {};
    keys.forEach(k => { totals[k] = 0; });
    transactions.forEach(t => { keys.forEach(k => { totals[k] += parseFloat(t[k]) || 0; }); });
    return totals;
}

function destroy(...keys) {
    keys.forEach(k => { if (charts[k]) { charts[k].destroy(); delete charts[k]; } });
}

function lineChart(canvasId, labels, data, label, color) {
    return new Chart(document.getElementById(canvasId), {
        type: 'line',
        data: { labels, datasets: [{ label, data, borderColor: color, backgroundColor: color + '1a', fill: true, tension: 0.3 }] },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });
}

function barChart(canvasId, labels, datasets) {
    return new Chart(document.getElementById(canvasId), {
        type: 'bar',
        data: { labels, datasets: datasets.map(d => ({ label: d.label, data: d.data, backgroundColor: d.bg })) },
        options: { responsive: true }
    });
}

function doughnutChart(canvasId, totals, colors) {
    const labels = [], data = [];
    for (const [k, v] of Object.entries(totals)) { if (v > 0) { labels.push(fmtLabel(k)); data.push(v); } }
    return new Chart(document.getElementById(canvasId), {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
}

function fmtDay(d) { 
    // Handle dates with or without time component
    const dateOnly = d.split(' ')[0]; // Extract just YYYY-MM-DD part
    return new Date(dateOnly + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); 
}
function fmtLabel(k) { return k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
