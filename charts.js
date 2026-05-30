let allTransactions = [];
let charts = {};

const INCOME_KEYS = ['room_rent','mattress_charge','travel_cab','kitchen_facility','clean_charge','misc_receipt'];
const EXPENSE_KEYS = ['brokerage','salary','room_cleaning_charge','generator_maintenance','hotel_stationary','hotel_cleaning_sanitation','rent_taxes','tv_recharge','camera_wifi','plumbing_maintenance','electricity_maintenance','electricity_bill','staff_fooding','laundry','owner_kitchen_cab','office_stationary','misc_expenses'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

document.addEventListener('DOMContentLoaded', async function() {
    const res = await fetch('/api/transactions', { credentials: 'include' });
    allTransactions = await res.json();
    allTransactions.sort((a, b) => a.date.localeCompare(b.date));

    populateFilters();
    renderMonthlyTab();
});

function populateFilters() {
    const monthsSet = new Set(), yearsSet = new Set();
    allTransactions.forEach(t => {
        const [y, m] = t.date.split('-');
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
    const month = document.getElementById('monthFilter').value;
    const filtered = allTransactions.filter(t => t.date.startsWith(month));

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
        const y = t.date.split('-')[0];
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

    renderYearDoughnuts();
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

function fmtDay(d) { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
function fmtLabel(k) { return k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
