// Escape untrusted text (comments, vendor names, labels) before inserting into innerHTML -
// these can contain free text from any logged-in user, not just the owner.
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
}

// Global category metadata
let categoryMetadata = [];

// Load dashboard data on page load
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('userRole') === 'owner') {
        const trashBtn = document.getElementById('trashBtn');
        if (trashBtn) trashBtn.style.display = '';
    }
    loadCategoryMetadata().then(() => {
        populateCategoryFilter();
        loadDashboardData();
        loadRecentTransactions();
        loadMonthComparison();
        checkAlerts();

        const vendorsLink = document.getElementById('vendorsNavLink');
        if (vendorsLink) vendorsLink.style.display = isFeatureEnabled('feature_vendor_tracking') ? '' : 'none';
    });
});

const dismissedAlerts = new Set();

// Low-balance / expense-spike alert banners. In-memory dismissal only (resets on reload).
async function checkAlerts() {
    try {
        const [balancesRes, comparisonRes, budgetRes, templatesRes] = await Promise.all([
            fetch('/api/dashboard/balances', { credentials: 'include' }),
            fetch('/api/dashboard/month-comparison', { credentials: 'include' }),
            fetch('/api/dashboard/category-budget-status', { credentials: 'include' }),
            fetch('/api/recurring-templates', { credentials: 'include' })
        ]);
        const balances = await balancesRes.json();
        const comparison = comparisonRes.ok ? await comparisonRes.json() : null;
        const templates = templatesRes.ok ? await templatesRes.json() : [];
        const overBudget = budgetRes.ok ? await budgetRes.json() : [];

        const thresholdSetting = categoryMetadata.find(c => c.type === 'app_config' && c.key_id === 'low_balance_threshold');
        const threshold = thresholdSetting ? parseFloat(thresholdSetting.value) || 0 : 5000;

        const alerts = [];

        const totalBalance = parseFloat(balances.totalBalance) || 0;
        if (totalBalance < threshold) {
            alerts.push({
                id: 'low-balance',
                level: 'danger',
                message: `⚠️ Low balance: current balance (₹${totalBalance.toFixed(2)}) is below your alert threshold of ₹${threshold.toFixed(2)}.`
            });
        }

        if (comparison && comparison.previousMonth.expense > 0) {
            const spikeRatio = comparison.currentMonth.expense / comparison.previousMonth.expense;
            if (spikeRatio >= 1.25) {
                alerts.push({
                    id: 'expense-spike',
                    level: 'warning',
                    message: `📈 Expense spike: ${comparison.currentMonth.label} expenses (₹${comparison.currentMonth.expense.toFixed(2)}) are ${((spikeRatio - 1) * 100).toFixed(0)}% higher than ${comparison.previousMonth.label}.`
                });
            }
        }

        overBudget.forEach(cat => {
            alerts.push({
                id: `budget-${cat.key_id}`,
                level: 'warning',
                message: `🎯 Budget exceeded: "${cat.label}" is at ₹${cat.spent.toFixed(2)} this month, ₹${cat.overBy.toFixed(2)} over your ₹${cat.budget.toFixed(2)} budget.`
            });
        });

        const todayDay = new Date().getDate();
        const currentYearMonth = new Date().toISOString().slice(0, 7);
        const dueTemplates = templates.filter(t =>
            t.day_of_month && todayDay >= t.day_of_month && t.last_applied_month !== currentYearMonth
        );
        if (dueTemplates.length > 0) {
            alerts.push({
                id: 'recurring-due',
                level: 'warning',
                message: `🔁 ${dueTemplates.length} recurring item(s) may be due this month: ${dueTemplates.map(t => t.label).join(', ')}. <a href="form.html">Go to form →</a>`
            });
        }

        const container = document.getElementById('alertBanners');
        container.innerHTML = alerts
            .filter(a => !dismissedAlerts.has(a.id))
            .map(a => `
                <div class="alert-banner alert-${a.level}" id="alert-${a.id}">
                    <span>${a.message}</span>
                    <button class="alert-banner-close" onclick="dismissAlert('${a.id}')">&times;</button>
                </div>
            `).join('');
    } catch (error) {
        console.error('Error checking alerts:', error);
    }
}

function dismissAlert(id) {
    dismissedAlerts.add(id);
    const el = document.getElementById(`alert-${id}`);
    if (el) el.remove();
}

// Load "this month vs last month" comparison widget
async function loadMonthComparison() {
    try {
        const res = await fetch('/api/dashboard/month-comparison', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();

        const card = document.getElementById('monthComparisonCard');
        card.style.display = '';

        document.getElementById('mcCurrentLabel').textContent = data.currentMonth.label;
        document.getElementById('mcCurrentIncome').textContent = `₹${data.currentMonth.income.toFixed(2)}`;
        document.getElementById('mcCurrentExpense').textContent = `₹${data.currentMonth.expense.toFixed(2)}`;
        document.getElementById('mcCurrentAvailable').textContent = `₹${data.currentMonth.available.toFixed(2)}`;

        document.getElementById('mcPreviousLabel').textContent = data.previousMonth.label;
        document.getElementById('mcPreviousIncome').textContent = `₹${data.previousMonth.income.toFixed(2)}`;
        document.getElementById('mcPreviousExpense').textContent = `₹${data.previousMonth.expense.toFixed(2)}`;
        document.getElementById('mcPreviousAvailable').textContent = `₹${data.previousMonth.available.toFixed(2)}`;

        const badge = document.getElementById('mcChangeBadge');
        const prevAvailable = data.previousMonth.available;
        const currAvailable = data.currentMonth.available;
        if (prevAvailable !== 0) {
            const pctChange = ((currAvailable - prevAvailable) / Math.abs(prevAvailable)) * 100;
            const arrow = pctChange >= 0 ? '▲' : '▼';
            badge.className = `month-comparison-change ${pctChange >= 0 ? 'positive' : 'negative'}`;
            badge.textContent = `${arrow} ${Math.abs(pctChange).toFixed(1)}% ${pctChange >= 0 ? 'better' : 'worse'} than last month (by available balance)`;
        } else {
            badge.textContent = '';
        }
    } catch (error) {
        console.error('Error loading month comparison:', error);
    }
}

// Load category metadata from settings
async function loadCategoryMetadata() {
    try {
        const [settingsRes, appConfigRes] = await Promise.all([
            fetch('/api/settings', { credentials: 'include' }),
            fetch('/api/app-config', { credentials: 'include' })
        ]);
        if (!settingsRes.ok) throw new Error('Failed to load settings');
        const settings = await settingsRes.json();
        const appConfig = appConfigRes.ok ? await appConfigRes.json() : [];
        categoryMetadata = settings.concat(appConfig);
    } catch (error) {
        console.error('Error loading category metadata:', error);
        categoryMetadata = [];
    }
}

// Load dashboard balances
async function loadDashboardData() {
    try {
        const response = await fetch('/api/dashboard/balances', {
            credentials: 'include'
        });
        const data = await response.json();

        // Update Cash Balance
        document.getElementById('cashBalance').textContent = `₹${data.cashBalance}`;
        document.getElementById('cashIncome').textContent = `₹${data.cashIncome}`;
        document.getElementById('cashExpense').textContent = `₹${data.cashExpense}`;

        // Update UPI Balance
        document.getElementById('upiBalance').textContent = `₹${data.upiBalance}`;
        document.getElementById('upiIncome').textContent = `₹${data.upiIncome}`;
        document.getElementById('upiExpense').textContent = `₹${data.upiExpense}`;

        // Update Total Balance
        document.getElementById('totalBalance').textContent = `₹${data.totalBalance}`;

        // Add positive/negative classes
        updateBalanceColors('cashBalance', data.cashBalance);
        updateBalanceColors('upiBalance', data.upiBalance);
        updateBalanceColors('totalBalance', data.totalBalance);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        alert('Error connecting to server. Make sure the server is running on port 5000.');
    }
}

// Update balance colors based on positive/negative
function updateBalanceColors(elementId, value) {
    const element = document.getElementById(elementId);
    const numValue = parseFloat(value);
    
    if (numValue > 0) {
        element.classList.add('positive');
        element.classList.remove('negative');
    } else if (numValue < 0) {
        element.classList.add('negative');
        element.classList.remove('positive');
    }
}

// Check an owner-configurable feature flag from already-loaded category metadata
function isFeatureEnabled(keyId) {
    const flag = categoryMetadata.find(c => c.type === 'app_config' && c.key_id === keyId);
    return flag ? Number(flag.value) !== 0 : true;
}

// Populate the category filter dropdown from already-loaded category metadata
function populateCategoryFilter() {
    const select = document.getElementById('txCategoryFilter');
    if (!select) return;
    const previousValue = select.value;
    select.innerHTML = '<option value="">All Categories</option>';
    categoryMetadata
        .filter(c => c.type === 'income_category' || c.type === 'expense_category')
        .forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.key_id;
            opt.textContent = `${c.icon || ''} ${c.label}`.trim();
            select.appendChild(opt);
        });
    // Keep the current selection if that category still exists, otherwise reset to "All"
    if ([...select.options].some(o => o.value === previousValue)) {
        select.value = previousValue;
    }
}

// Load recent transactions
const TX_PAGE_SIZE = 10;
let txPaginationState = { sortedDates: [], transactionsByDate: {}, isOwner: false, page: 1 };

async function loadRecentTransactions(fromDate = null, toDate = null) {
    try {
        if (fromDate === null) fromDate = document.getElementById('filterFromDate')?.value || null;
        if (toDate === null) toDate = document.getElementById('filterToDate')?.value || null;
        const searchTerm = (document.getElementById('txSearchFilter')?.value || '').trim().toLowerCase();
        const categoryFilter = document.getElementById('txCategoryFilter')?.value || '';
        const methodFilter = document.getElementById('txMethodFilter')?.value || '';

        const response = await fetch('/api/transactions?limit=all', {
            credentials: 'include'
        });
        const transactions = await response.json();

        const tbody = document.getElementById('transactionsBody');

        if (transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="loading-message">No transactions found</td></tr>';
            txPaginationState = { sortedDates: [], transactionsByDate: {}, isOwner: false, page: 1 };
            updateTransactionsPageIndicator();
            return;
        }

        // Filter transactions by date range if provided
        let filteredTransactions = transactions;
        if (fromDate || toDate) {
            filteredTransactions = filteredTransactions.filter(transaction => {
                const transactionDateStr = transaction.date.split('T')[0].split(' ')[0];

                if (fromDate && toDate) {
                    return transactionDateStr >= fromDate && transactionDateStr <= toDate;
                } else if (fromDate) {
                    return transactionDateStr >= fromDate;
                } else if (toDate) {
                    return transactionDateStr <= toDate;
                }
                return true;
            });
        }

        // Filter by category - transaction must have a nonzero amount for this category
        if (categoryFilter) {
            filteredTransactions = filteredTransactions.filter(t => (parseFloat(t[categoryFilter]) || 0) > 0);
        }

        // Filter by payment method - any active category paid via this method
        if (methodFilter) {
            const allKeys = categoryMetadata
                .filter(c => c.type === 'income_category' || c.type === 'expense_category')
                .map(c => c.key_id);
            filteredTransactions = filteredTransactions.filter(t =>
                allKeys.some(k => (parseFloat(t[k]) || 0) > 0 && (t[`${k}_method`] || 'cash').toLowerCase() === methodFilter)
            );
        }

        // Filter by free-text search across comments and the date
        if (searchTerm) {
            const allKeys = categoryMetadata
                .filter(c => c.type === 'income_category' || c.type === 'expense_category')
                .map(c => c.key_id);
            filteredTransactions = filteredTransactions.filter(t => {
                const dateStr = t.date.split('T')[0].split(' ')[0];
                if (dateStr.includes(searchTerm)) return true;
                return allKeys.some(k => (t[`${k}_comment`] || '').toLowerCase().includes(searchTerm));
            });
        }

        // Store all transactions globally for detail view
        window.allTransactions = transactions;
        
        // Check if user is owner
        const userRole = localStorage.getItem('userRole');
        const isOwner = userRole === 'owner';

        if (filteredTransactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="loading-message">No transactions found for the selected filters</td></tr>';
            txPaginationState = { sortedDates: [], transactionsByDate: {}, isOwner: false, page: 1 };
            updateTransactionsPageIndicator();
            return;
        }

        // Group transactions by date
        const transactionsByDate = {};
        filteredTransactions.forEach(transaction => {
            const dateStr = transaction.date.split('T')[0].split(' ')[0]; // YYYY-MM-DD format
            if (!transactionsByDate[dateStr]) {
                transactionsByDate[dateStr] = [];
            }
            transactionsByDate[dateStr].push(transaction);
        });

        // Sort dates in descending order (newest first)
        const sortedDates = Object.keys(transactionsByDate).sort().reverse();

        // Store the grouped result and reset to page 1 - rendering/paging from
        // here on is pure client-side slicing (no re-fetch), so Prev/Next are
        // instant even with a large transaction history.
        txPaginationState = { sortedDates, transactionsByDate, isOwner, page: 1 };
        renderTransactionsPage();
    } catch (error) {
        console.error('Error loading transactions:', error);
        document.getElementById('transactionsBody').innerHTML =
            '<tr><td colspan="6" class="loading-message">Error loading transactions</td></tr>';
    }
}

// Renders just the current page of already-filtered/grouped dates - called
// after a fresh load (page reset to 1) and by goToTransactionsPage() (no
// network round-trip, so paging stays fast regardless of total history size).
function renderTransactionsPage() {
    const { sortedDates, transactionsByDate, isOwner, page } = txPaginationState;
    const tbody = document.getElementById('transactionsBody');
    const totalPages = Math.max(1, Math.ceil(sortedDates.length / TX_PAGE_SIZE));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    txPaginationState.page = currentPage;

    const start = (currentPage - 1) * TX_PAGE_SIZE;
    const pageDates = sortedDates.slice(start, start + TX_PAGE_SIZE);

    tbody.innerHTML = pageDates.map(dateStr => {
        let dateTransactions = transactionsByDate[dateStr];

        // Sort transactions by ID (ascending) to ensure last entry is the most recent
        dateTransactions.sort((a, b) => a.id - b.id);

        // Calculate aggregated totals for this date
        let openingBalance = dateTransactions[0].opening_balance; // First entry's opening balance
        let closingBalance = dateTransactions[dateTransactions.length - 1].closing_balance; // Last entry's closing balance
        let totalIncome = 0;
        let totalExpense = 0;
        let totalTransactionsOnDate = dateTransactions.length;

        dateTransactions.forEach(t => {
            totalIncome += parseFloat(t.total_income) || 0;
            totalExpense += parseFloat(t.total_expense) || 0;
        });

        const deleteButton = isOwner ? `<button class="btn-delete" onclick="deleteAllTransactionsForDate('${dateStr}')" title="Delete all entries from ${dateStr}">🗑️</button>` : '';

        return `
            <tr>
                <td>
                    <strong>${new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</strong>
                    <br><small style="color: #666;">${totalTransactionsOnDate} ${totalTransactionsOnDate === 1 ? 'entry' : 'entries'}</small>
                </td>
                <td>₹${parseFloat(openingBalance).toFixed(2)}</td>
                <td class="positive">₹${totalIncome.toFixed(2)}</td>
                <td class="negative">₹${totalExpense.toFixed(2)}</td>
                <td>₹${parseFloat(closingBalance).toFixed(2)}</td>
                <td>
                    <button class="btn-view" onclick="viewDateTransactions('${dateStr}')">View ${totalTransactionsOnDate > 1 ? 'All' : 'Details'}</button>
                    ${deleteButton}
                </td>
            </tr>
        `;
    }).join('');

    updateTransactionsPageIndicator(currentPage, totalPages);
}

// Updates the "Page X of Y" label and Prev/Next disabled state. Defaults to
// an empty 1-of-1 state when called with no args (e.g. zero results).
function updateTransactionsPageIndicator(currentPage = 1, totalPages = 1) {
    const indicator = document.getElementById('txPageIndicator');
    if (indicator) indicator.textContent = `Page ${currentPage} of ${totalPages}`;
    const prevBtn = document.getElementById('txPrevPageBtn');
    const nextBtn = document.getElementById('txNextPageBtn');
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

// Moves the Recent Transactions table by one page without re-fetching.
function goToTransactionsPage(delta) {
    txPaginationState.page += delta;
    renderTransactionsPage();
}

// View all transactions for a specific date
function viewDateTransactions(dateStr) {
    let dateTransactions = window.allTransactions.filter(t => {
        const tDateStr = t.date.split('T')[0].split(' ')[0];
        return tDateStr === dateStr;
    });
    
    // Sort by ID to ensure correct order
    dateTransactions.sort((a, b) => a.id - b.id);
    
    if (dateTransactions.length === 1) {
        // Single entry - show details directly
        viewTransaction(dateTransactions[0].id);
    } else {
        // Multiple entries - show list
        const dateObj = new Date(dateStr + 'T00:00:00');
        const dateFormatted = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        
        let entriesList = '<div style="margin: 20px;">';
        entriesList += `<h3>Transactions on ${dateFormatted}</h3>`;
        entriesList += '<div style="border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">';
        
        dateTransactions.forEach((t, index) => {
            entriesList += `
                <div style="padding: 12px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>Entry ${index + 1}</strong><br>
                        Income: ₹${parseFloat(t.total_income).toFixed(2)} | 
                        Expense: ₹${parseFloat(t.total_expense).toFixed(2)}
                    </div>
                    <button class="btn-view" onclick="viewTransaction(${t.id}); closeMultiTransactionModal();" style="margin-left: 10px;">View</button>
                </div>
            `;
        });
        
        entriesList += '</div></div>';
        
        const modal = document.createElement('div');
        modal.id = 'multiTransactionModal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;';
        modal.innerHTML = `
            <div style="background: white; padding: 20px; border-radius: 12px; max-width: 600px; max-height: 80vh; overflow-y: auto;">
                <button onclick="closeMultiTransactionModal()" style="float: right; font-size: 24px; border: none; background: none; cursor: pointer; padding: 0;">&times;</button>
                ${entriesList}
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeMultiTransactionModal();
        });
    }
}

// Close multi-transaction modal
function closeMultiTransactionModal() {
    const modal = document.getElementById('multiTransactionModal');
    if (modal) modal.remove();
}

// Refresh dashboard
function refreshDashboard(btn) {
    // Show loading state
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Refreshing...';
    btn.disabled = true;
    
    // Reload data - category metadata first, since categories may have changed in Settings
    // since the page was first loaded (new/removed categories, feature flags, etc.)
    loadCategoryMetadata().then(() => {
        populateCategoryFilter();
        return Promise.all([
            loadDashboardData(),
            loadRecentTransactions(),
            loadMonthComparison(),
            checkAlerts()
        ]);
    }).then(() => {
        // Show success briefly
        btn.innerHTML = '✅ Refreshed!';
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }, 1000);
    }).catch(error => {
        console.error('Refresh error:', error);
        btn.innerHTML = '❌ Error';
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }, 2000);
    });
}

// View transaction details
function viewTransaction(id) {
    const transaction = window.allTransactions.find(t => t.id === id);
    if (!transaction) {
        alert('Transaction not found');
        return;
    }

    // Build income and expense items dynamically from categoryMetadata
    let incomeItems = [];
    let expenseItems = [];
    
    if (categoryMetadata && categoryMetadata.length > 0) {
        // Use dynamic categories from metadata
        incomeItems = categoryMetadata
            .filter(cat => cat.type === 'income_category' && (cat.active === 1 || cat.active === true))
            .map(cat => ({
                label: cat.label,
                amount: cat.key_id,
                method: `${cat.key_id}_method`,
                comment: `${cat.key_id}_comment`,
                vendor: `${cat.key_id}_vendor`
            }));

        expenseItems = categoryMetadata
            .filter(cat => cat.type === 'expense_category' && (cat.active === 1 || cat.active === true))
            .map(cat => ({
                label: cat.label,
                amount: cat.key_id,
                method: `${cat.key_id}_method`,
                comment: `${cat.key_id}_comment`,
                vendor: `${cat.key_id}_vendor`
            }));
    } else {
        // Fallback to hardcoded if metadata isn't loaded
        console.warn('Category metadata not loaded, using fallback');
        incomeItems = [
            { label: 'Room Rent', amount: 'room_rent', method: 'room_rent_method', comment: 'room_rent_comment' },
            { label: 'Mattress Charge', amount: 'mattress_charge', method: 'mattress_charge_method', comment: 'mattress_charge_comment' },
            { label: 'Travel/Cab Service', amount: 'travel_cab', method: 'travel_cab_method', comment: 'travel_cab_comment' },
            { label: 'Kitchen Facility', amount: 'kitchen_facility', method: 'kitchen_facility_method', comment: 'kitchen_facility_comment' },
            { label: 'Clean Charge', amount: 'clean_charge', method: 'clean_charge_method', comment: 'clean_charge_comment' },
            { label: 'Misc Receipt', amount: 'misc_receipt', method: 'misc_receipt_method', comment: 'misc_receipt_comment' }
        ];

        expenseItems = [
            { label: 'Brokerage', amount: 'brokerage', method: 'brokerage_method', comment: 'brokerage_comment' },
            { label: 'Salary', amount: 'salary', method: 'salary_method', comment: 'salary_comment' },
            { label: 'Room Cleaning Charge', amount: 'room_cleaning_charge', method: 'room_cleaning_charge_method', comment: 'room_cleaning_charge_comment' },
            { label: 'Generator & Maintenance', amount: 'generator_maintenance', method: 'generator_maintenance_method', comment: 'generator_maintenance_comment' },
            { label: 'Hotel Stationary', amount: 'hotel_stationary', method: 'hotel_stationary_method', comment: 'hotel_stationary_comment' },
            { label: 'Hotel Cleaning & Sanitation', amount: 'hotel_cleaning_sanitation', method: 'hotel_cleaning_sanitation_method', comment: 'hotel_cleaning_sanitation_comment' },
            { label: 'Rent & Taxes', amount: 'rent_taxes', method: 'rent_taxes_method', comment: 'rent_taxes_comment' },
            { label: 'TV Recharge', amount: 'tv_recharge', method: 'tv_recharge_method', comment: 'tv_recharge_comment' },
            { label: 'Recharge', amount: 'recharge', method: 'recharge_method', comment: 'recharge_comment' },
            { label: 'Plumbing & Maintenance', amount: 'plumbing_maintenance', method: 'plumbing_maintenance_method', comment: 'plumbing_maintenance_comment' },
            { label: 'Electricity & Maintenance', amount: 'electricity_maintenance', method: 'electricity_maintenance_method', comment: 'electricity_maintenance_comment' },
            { label: 'Electricity Bill', amount: 'electricity_bill', method: 'electricity_bill_method', comment: 'electricity_bill_comment' },
            { label: 'Staff Fooding', amount: 'staff_fooding', method: 'staff_fooding_method', comment: 'staff_fooding_comment' },
            { label: 'Laundry', amount: 'laundry', method: 'laundry_method', comment: 'laundry_comment' },
            { label: 'Owner Kitchen & Cab Payment', amount: 'owner_kitchen_cab', method: 'owner_kitchen_cab_method', comment: 'owner_kitchen_cab_comment' },
            { label: 'Office Stationary', amount: 'office_stationary', method: 'office_stationary_method', comment: 'office_stationary_comment' },
            { label: 'Misc Expenses', amount: 'misc_expenses', method: 'misc_expenses_method', comment: 'misc_expenses_comment' },
            { label: 'Carpenter', amount: 'carpenter', method: 'carpenter_method', comment: 'carpenter_comment' }
        ];
    }
    
    console.log('categoryMetadata:', categoryMetadata);
    console.log('incomeItems count:', incomeItems.length);
    console.log('expenseItems count:', expenseItems.length);
    console.log('transaction:', transaction);
    
    // Log first few expense items for debugging
    console.log('First expense items:', expenseItems.slice(0, 3).map(item => ({
        label: item.label,
        transactionValue: transaction[item.amount],
        parsed: parseFloat(transaction[item.amount])
    })));

    const showVendorColumn = isFeatureEnabled('feature_vendor_tracking');
    const vendorHeaderHTML = showVendorColumn ? '<th>Vendor/Party</th>' : '';

    let incomeHTML = `<table class="detail-table"><thead><tr><th>Income Source</th><th>Payment Method</th><th>Amount</th>${vendorHeaderHTML}<th>Comment</th></tr></thead><tbody>`;
    incomeItems.forEach(item => {
        const amount = parseFloat(transaction[item.amount]) || 0;
        const method = transaction[item.method] || '-';
        const comment = transaction[item.comment] || '';
        const vendor = item.vendor ? (transaction[item.vendor] || '') : '';
        if (amount > 0) {
            const methodBadge = method === 'cash' ? '<span class="badge badge-cash">Cash</span>' :
                              method === 'upi' ? '<span class="badge badge-upi">UPI</span>' : '-';

            // Format comment - check if it contains multiple entries (separated by |)
            let commentHTML;
            if (comment && comment.includes('|')) {
                const entries = comment.split('|').map(e => e.trim()).filter(e => e);
                commentHTML = `<ul class="multi-entry-list" style="margin: 0; padding-left: 20px; list-style: disc; color: #64748b;">${entries.map(entry => `<li style="margin: 3px 0;">${escapeHtml(entry)}</li>`).join('')}</ul>`;
            } else {
                commentHTML = comment ? `<span class="comment-text">${escapeHtml(comment)}</span>` : '<span style="color: #9ca3af;">-</span>';
            }

            const vendorCellHTML = showVendorColumn ? `<td>${escapeHtml(vendor) || '-'}</td>` : '';
            incomeHTML += `<tr><td>${escapeHtml(item.label)}</td><td>${methodBadge}</td><td class="positive">₹${amount.toFixed(2)}</td>${vendorCellHTML}<td>${commentHTML}</td></tr>`;
        }
    });
    incomeHTML += '</tbody></table>';

    let expenseHTML = `<table class="detail-table"><thead><tr><th>Expense Source</th><th>Payment Method</th><th>Amount</th>${vendorHeaderHTML}<th>Comment</th></tr></thead><tbody>`;
    expenseItems.forEach(item => {
        const amount = parseFloat(transaction[item.amount]) || 0;
        const method = transaction[item.method] || '-';
        const comment = transaction[item.comment] || '';
        const vendor = item.vendor ? (transaction[item.vendor] || '') : '';
        if (amount > 0) {
            const methodBadge = method === 'cash' ? '<span class="badge badge-cash">Cash</span>' :
                              method === 'upi' ? '<span class="badge badge-upi">UPI</span>' : '-';

            // Format comment - check if it contains multiple entries (separated by |)
            let commentHTML;
            if (comment && comment.includes('|')) {
                const entries = comment.split('|').map(e => e.trim()).filter(e => e);
                commentHTML = `<ul class="multi-entry-list" style="margin: 0; padding-left: 20px; list-style: disc; color: #64748b;">${entries.map(entry => `<li style="margin: 3px 0;">${escapeHtml(entry)}</li>`).join('')}</ul>`;
            } else {
                commentHTML = comment ? `<span class="comment-text">${escapeHtml(comment)}</span>` : '<span style="color: #9ca3af;">-</span>';
            }

            const vendorCellHTML = showVendorColumn ? `<td>${escapeHtml(vendor) || '-'}</td>` : '';
            expenseHTML += `<tr><td>${escapeHtml(item.label)}</td><td>${methodBadge}</td><td class="negative">₹${amount.toFixed(2)}</td>${vendorCellHTML}<td>${commentHTML}</td></tr>`;
        }
    });
    expenseHTML += '</tbody></table>';

    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="detail-section">
            <p><strong>Date:</strong> ${new Date(transaction.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
            <p><strong>Opening Balance:</strong> ₹${parseFloat(transaction.opening_balance).toFixed(2)}</p>
        </div>
        
        <div class="detail-section">
            <h3>💰 Income/Receipt</h3>
            ${incomeHTML}
            <p class="detail-total"><strong>Total Income:</strong> <span class="positive">₹${parseFloat(transaction.total_income).toFixed(2)}</span></p>
        </div>
        
        <div class="detail-section">
            <h3>💸 Expenses/Payment</h3>
            ${expenseHTML}
            <p class="detail-total"><strong>Total Expense:</strong> <span class="negative">₹${parseFloat(transaction.total_expense).toFixed(2)}</span></p>
        </div>
        
        <div class="detail-section">
            <p class="detail-total"><strong>Closing Balance:</strong> <span class="balance-amount">₹${parseFloat(transaction.closing_balance).toFixed(2)}</span></p>
        </div>

        ${isFeatureEnabled('feature_created_by_tracking') ? `
        <div class="detail-section">
            <p style="color:#64748b; font-size:0.9em;">Entered by: <strong>${escapeHtml(transaction.created_by) || '—'}</strong>${transaction.updated_by && transaction.updated_by !== transaction.created_by ? ` &middot; Last edited by: <strong>${escapeHtml(transaction.updated_by)}</strong>` : ''}</p>
        </div>` : ''}

        ${isFeatureEnabled('feature_receipts') ? `<div class="detail-section" id="receiptSection_${id}"><h3>📎 Receipts</h3><p class="loading-message">Loading...</p></div>` : ''}

        <div class="modal-actions" style="margin-top: 20px; display: flex; gap: 10px; justify-content: center;">
            <button class="btn btn-primary" onclick="editTransaction(${id})">✏️ Edit Transaction</button>
            ${localStorage.getItem('userRole') === 'owner' ? `<button class="btn btn-danger" onclick="deleteTransaction(${id})" style="background: #ef4444; border-color: #dc2626;">🗑️ Delete Entry</button>` : ''}
            <button class="btn btn-secondary" onclick="closeModal()">Close</button>
        </div>
    `;

    document.getElementById('transactionModal').style.display = 'flex';

    if (isFeatureEnabled('feature_receipts')) {
        loadReceiptSection(id);
    }
}

// Close modal
function closeModal() {
    document.getElementById('transactionModal').style.display = 'none';
}

// --- RECEIPT ATTACHMENTS ---
async function loadReceiptSection(id) {
    const section = document.getElementById(`receiptSection_${id}`);
    if (!section) return;

    try {
        const res = await fetch(`/api/transactions/${id}/receipts`, { credentials: 'include' });
        const receipts = res.ok ? await res.json() : [];
        renderReceiptSection(id, receipts);
    } catch (error) {
        console.error('Error loading receipts:', error);
        section.innerHTML = '<h3>📎 Receipts</h3><p class="loading-message">Error loading receipts</p>';
    }
}

function renderReceiptSection(id, receipts) {
    const section = document.getElementById(`receiptSection_${id}`);
    if (!section) return;
    const isOwner = localStorage.getItem('userRole') === 'owner';

    const listHTML = receipts.length === 0 ? '<p style="color:#9ca3af;">No receipts attached yet.</p>' : `
        <ul style="list-style:none; padding:0; margin:0 0 12px;">
            ${receipts.map(r => `
                <li style="display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid #e2e8f0;">
                    <a href="/api/transactions/${id}/receipts/${r.id}" target="_blank">📄 ${escapeHtml(r.original_filename) || 'Receipt #' + r.id}</a>
                    ${isOwner ? `<button class="btn btn-secondary" onclick="removeReceipt(${id}, ${r.id})">Remove</button>` : ''}
                </li>
            `).join('')}
        </ul>`;

    section.innerHTML = `
        <h3>📎 Receipts</h3>
        ${listHTML}
        <input type="file" id="receiptFiles_${id}" accept=".jpg,.jpeg,.png,.webp,.pdf" multiple>
        <button class="btn btn-primary" onclick="uploadReceipts(${id})">Upload</button>
    `;
}

async function uploadReceipts(id) {
    const input = document.getElementById(`receiptFiles_${id}`);
    const files = input?.files;
    if (!files || files.length === 0) {
        alert('Please choose at least one file first');
        return;
    }

    const formData = new FormData();
    for (const file of files) {
        formData.append('receipts', file);
    }

    try {
        const res = await fetch(`/api/transactions/${id}/receipts`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.error || 'Failed to upload receipts');
            return;
        }
        if (data.errors && data.errors.length > 0) {
            alert(`Some files were skipped:\n${data.errors.join('\n')}`);
        }
        await loadReceiptSection(id);
    } catch (error) {
        console.error('Error uploading receipts:', error);
        alert('Error uploading receipts. Please try again.');
    }
}

async function removeReceipt(id, receiptId) {
    if (!confirm('Remove this receipt?')) return;
    try {
        const res = await fetch(`/api/transactions/${id}/receipts/${receiptId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.error || 'Failed to remove receipt');
            return;
        }
        await loadReceiptSection(id);
    } catch (error) {
        console.error('Error removing receipt:', error);
        alert('Error removing receipt. Please try again.');
    }
}

// Edit transaction
function editTransaction(id) {
    // Redirect to form page with transaction ID
    window.location.href = `form.html?edit=${id}`;
}

// Delete transaction (owner only)
async function deleteTransaction(id) {
    if (!confirm('Are you sure you want to delete this transaction? It will be moved to Trash and can be restored later.')) {
        return;
    }

    try {
        const response = await fetch(`/api/transactions/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok) {
            // Reload dashboard data to reflect changes
            await loadDashboardData();
            await loadRecentTransactions();
            closeModal();
            showUndoToast('Transaction moved to trash.', [id]);
        } else {
            alert(data.error || 'Failed to delete transaction');
        }
    } catch (error) {
        console.error('Error deleting transaction:', error);
        alert('Error deleting transaction. Please try again.');
    }
}

// Delete all transactions for a specific date
async function deleteAllTransactionsForDate(dateStr) {
    const transactionsToDelete = window.allTransactions.filter(t => t.date.split('T')[0].split(' ')[0] === dateStr);
    const count = transactionsToDelete.length;

    if (!confirm(`Are you sure you want to move all ${count} transaction(s) from ${dateStr} to Trash?`)) {
        return;
    }

    try {
        for (const transaction of transactionsToDelete) {
            const response = await fetch(`/api/transactions/${transaction.id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!response.ok) {
                throw new Error(`Failed to delete transaction ${transaction.id}`);
            }
        }
        await loadDashboardData();
        await loadRecentTransactions();
        showUndoToast(`${count} transaction(s) moved to trash.`, transactionsToDelete.map(t => t.id));
    } catch (error) {
        console.error('Error deleting transactions:', error);
        alert('Error deleting transactions. Please try again.');
    }
}

// Show a dismissible toast with an Undo action that restores the given transaction ids
function showUndoToast(message, ids) {
    const existing = document.getElementById('undoToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'undoToast';
    toast.className = 'undo-toast';
    toast.innerHTML = `
        <span>${message}</span>
        <button class="undo-toast-btn" id="undoToastBtn">Undo</button>
        <button class="undo-toast-close" id="undoToastClose">&times;</button>
    `;
    document.body.appendChild(toast);

    const timer = setTimeout(() => toast.remove(), 8000);

    document.getElementById('undoToastBtn').onclick = async () => {
        clearTimeout(timer);
        toast.remove();
        try {
            await Promise.all(ids.map(id => fetch(`/api/transactions/${id}/restore`, {
                method: 'POST',
                credentials: 'include'
            })));
            await loadDashboardData();
            await loadRecentTransactions();
        } catch (error) {
            console.error('Error restoring transaction(s):', error);
            alert('Error undoing delete. Check the Trash to restore manually.');
        }
    };

    document.getElementById('undoToastClose').onclick = () => {
        clearTimeout(timer);
        toast.remove();
    };
}

// --- TRASH MODAL ---
async function openTrashModal() {
    const modal = document.getElementById('trashModal');
    const body = document.getElementById('trashModalBody');
    modal.style.display = 'flex';
    body.innerHTML = '<p class="loading-message">Loading trash...</p>';

    try {
        const res = await fetch('/api/transactions/trash', { credentials: 'include' });
        const trashed = await res.json();

        if (!res.ok) {
            body.innerHTML = `<p class="loading-message">${trashed.error || 'Failed to load trash'}</p>`;
            return;
        }

        if (trashed.length === 0) {
            body.innerHTML = '<p class="loading-message">Trash is empty.</p>';
            return;
        }

        body.innerHTML = `
            <table>
                <thead>
                    <tr><th>Date</th><th>Deleted At</th><th>Income</th><th>Expense</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    ${trashed.map(t => `
                        <tr>
                            <td>${t.date.split('T')[0].split(' ')[0]}</td>
                            <td>${new Date(t.deleted_at).toLocaleString()}</td>
                            <td class="positive">₹${parseFloat(t.total_income || 0).toFixed(2)}</td>
                            <td class="negative">₹${parseFloat(t.total_expense || 0).toFixed(2)}</td>
                            <td>
                                <button class="btn-view" onclick="restoreTrashedTransaction(${t.id})">Restore</button>
                                <button class="btn-delete" onclick="permanentlyDeleteTransaction(${t.id})">Delete Forever</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error loading trash:', error);
        body.innerHTML = '<p class="loading-message">Error loading trash</p>';
    }
}

function closeTrashModal() {
    document.getElementById('trashModal').style.display = 'none';
}

async function restoreTrashedTransaction(id) {
    try {
        const res = await fetch(`/api/transactions/${id}/restore`, { method: 'POST', credentials: 'include' });
        if (!res.ok) {
            const data = await res.json();
            alert(data.error || 'Failed to restore transaction');
            return;
        }
        await loadDashboardData();
        await loadRecentTransactions();
        await openTrashModal();
    } catch (error) {
        console.error('Error restoring transaction:', error);
        alert('Error restoring transaction. Please try again.');
    }
}

async function permanentlyDeleteTransaction(id) {
    if (!confirm('Permanently delete this transaction? This cannot be undone.')) return;
    try {
        const res = await fetch(`/api/transactions/${id}/permanent`, { method: 'DELETE', credentials: 'include' });
        if (!res.ok) {
            const data = await res.json();
            alert(data.error || 'Failed to permanently delete transaction');
            return;
        }
        await openTrashModal();
    } catch (error) {
        console.error('Error permanently deleting transaction:', error);
        alert('Error permanently deleting transaction. Please try again.');
    }
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('transactionModal');
    const downloadModal = document.getElementById('downloadModal');
    if (event.target === modal) {
        closeModal();
    }
    if (event.target === downloadModal) {
        closeDownloadModal();
    }
});

// Apply date filter to recent transactions
function applyDateFilter() {
    const fromDate = document.getElementById('filterFromDate').value;
    const toDate = document.getElementById('filterToDate').value;
    
    if (!fromDate && !toDate) {
        alert('Please select at least one date (From or To)');
        return;
    }
    
    if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
        alert('From date cannot be after To date');
        return;
    }
    
    loadRecentTransactions(fromDate, toDate);
}

// Clear date filter
function clearDateFilter() {
    document.getElementById('filterFromDate').value = '';
    document.getElementById('filterToDate').value = '';
    loadRecentTransactions();
}

// --- CSV/EXCEL IMPORT ---
function getActiveCategoriesByType(type) {
    return categoryMetadata
        .filter(c => c.type === type)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

async function openImportModal() {
    document.getElementById('importResults').innerHTML = '';
    document.getElementById('importFileInput').value = '';
    document.getElementById('importModal').style.display = 'flex';
    // Re-fetch category metadata so the template/import always reflect the current
    // Settings list, not whatever was cached when the dashboard first loaded.
    await loadCategoryMetadata();
}

function closeImportModal() {
    document.getElementById('importModal').style.display = 'none';
}

// Build a template workbook whose columns match the live active categories
function downloadImportTemplate() {
    const incomeCategories = getActiveCategoriesByType('income_category');
    const expenseCategories = getActiveCategoriesByType('expense_category');

    const headers = ['Date (YYYY-MM-DD)', 'Opening Balance (only needed on the first row of a repeated date - later rows auto-chain)'];
    // Amount/Method/Comment accept ;-separated lists for multiple same-day entries
    // under one category (e.g. two Room Rent payments on the same date) - see
    // parseCellEntries()/mergeCategoryEntries() in processImportFile().
    incomeCategories.forEach(c => headers.push(`${c.label} Amount (; separated for multiple same-day entries)`, `${c.label} Method (cash/upi, ; separated)`, `${c.label} Comment (; separated)`));
    expenseCategories.forEach(c => {
        if (c.key_id === 'salary') {
            // Salary needs structured columns (not a free-text comment) so the server can
            // link the payment to an employee - see the matching special-case in processImportFile().
            headers.push('Salary Employee (separate multiple with ;)', 'Salary Payment Type (Advance/Full, ; separated)', 'Salary Amount (; separated)', 'Salary Method (cash/upi, ; separated)', 'Salary Note (; separated)');
        } else {
            headers.push(`${c.label} Amount (; separated for multiple same-day entries)`, `${c.label} Method (cash/upi, ; separated)`, `${c.label} Comment (; separated)`);
        }
    });
    headers.push('Closing Balance (optional - auto-calculated if blank)');

    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Import Template');
    XLSX.writeFile(wb, 'Transaction_Import_Template.xlsx');
}

function dateToLocalISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function normalizeImportDate(value) {
    if (value instanceof Date) {
        // Use local date parts, not toISOString() - that converts to UTC first,
        // which silently shifts the date back a day for any timezone ahead of UTC
        // (e.g. IST), since the Date object represents local midnight.
        return dateToLocalISO(value);
    }
    const str = String(value || '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
    const parsed = new Date(str);
    if (!isNaN(parsed)) return dateToLocalISO(parsed);
    return null;
}

// Reads a row cell trying each candidate header name in order, falling back
// to older header text - templates downloaded before this session's header
// renames (e.g. plain "Salary Amount" instead of "Salary Amount (; separated)")
// would otherwise silently read as blank instead of erroring.
function getCell(row, ...keys) {
    for (const key of keys) {
        const val = row[key];
        if (val !== undefined && val !== null && String(val).trim() !== '') return val;
    }
    return '';
}

// Parses one category's Amount/Method/Comment cell(s) from a single row into
// a flat list of individual entries (not summed/joined yet) via ;-separated
// lists. Used both for one row's own ;-separated values and for merging
// several rows of the same date into one transaction (see batches below) -
// either way the entries end up combined the same way by mergeCategoryEntries().
function parseCellEntries(amountStr, methodStr, commentStr) {
    amountStr = (amountStr || '').toString().trim();
    if (!amountStr) return [];
    const amounts = amountStr.split(';').map(s => parseFloat(s.trim()) || 0);
    const methods = (methodStr || '').toString().split(';').map(s => s.trim().toLowerCase());
    const comments = (commentStr || '').toString().split(';').map(s => s.trim());
    return amounts
        .map((amount, j) => ({
            amount,
            method: methods[j] || methods[0] || 'cash',
            comment: comments[j] || ''
        }))
        .filter(e => e.amount > 0);
}

// Sums entries into one amount; when there's more than one, wraps each into a
// "(₹amt - METHOD - comment)" bullet joined with ' | ' - the same combined
// format the manual multi-entry form produces (buildCategoryData() in
// script-multi.js) - so multiple entries show as one merged transaction with
// bulleted line items, not several separate "Entry N" cards for the same date.
// A single entry keeps the plain, unwrapped comment (original single-row behavior).
function mergeCategoryEntries(entries) {
    if (entries.length === 0) return null;
    if (entries.length === 1) {
        return { amount: entries[0].amount, method: entries[0].method || 'cash', comment: entries[0].comment || '' };
    }
    let total = 0;
    let firstMethod = '';
    const parts = [];
    entries.forEach(e => {
        if (!firstMethod) firstMethod = e.method || 'cash';
        total += e.amount;
        const entryParts = [`₹${e.amount.toFixed(2)}`, (e.method || 'cash').toUpperCase()];
        if (e.comment) entryParts.push(e.comment);
        parts.push(`(${entryParts.join(' - ')})`);
    });
    return { amount: total, method: firstMethod, comment: parts.join(' | ') };
}

// Parses one row's salary columns into {amount, method, employee, paymentType,
// note} entries via the same ;-separated zipping as other categories - salary
// needs structured fields (not just a comment) so the server can link each
// payment to an employee.
function parseSalaryRowEntries(row) {
    const amountsRaw = getCell(row, 'Salary Amount (; separated)', 'Salary Amount').toString().trim();
    if (!amountsRaw) return [];
    const amounts = amountsRaw.split(';').map(s => parseFloat(s.trim()) || 0);
    const employees = getCell(row, 'Salary Employee (separate multiple with ;)', 'Salary Employee').toString().split(';').map(s => s.trim());
    const methods = getCell(row, 'Salary Method (cash/upi, ; separated)', 'Salary Method (cash/upi)').toString().split(';').map(s => s.trim().toLowerCase());
    const paymentTypes = getCell(row, 'Salary Payment Type (Advance/Full, ; separated)', 'Salary Payment Type (Advance/Full)').toString().split(';').map(s => s.trim());
    const notes = getCell(row, 'Salary Note (; separated)', 'Salary Note').toString().split(';').map(s => s.trim());

    if (employees.length !== amounts.length) {
        throw new Error(`Salary Employee count (${employees.length}) doesn't match Salary Amount count (${amounts.length}) - use the same number of ;-separated values in both columns`);
    }

    const entries = [];
    for (let j = 0; j < amounts.length; j++) {
        const amount = amounts[j];
        if (amount <= 0) continue;
        const employee = employees[j] || '';
        if (!employee) {
            throw new Error('Salary Amount is set but the matching Salary Employee is blank');
        }
        if (/\s/.test(employee)) {
            throw new Error(`Salary Employee "${employee}" must be a single word (no spaces) for the server to record it correctly`);
        }
        const method = methods[j] || methods[0] || 'cash';
        let paymentType = (paymentTypes[j] || paymentTypes[0] || 'Full');
        paymentType = paymentType.toLowerCase() === 'advance' ? 'Advance' : 'Full';
        const note = notes[j] || '';
        entries.push({ amount, method, employee, paymentType, note });
    }
    return entries;
}

// Sums salary entries and builds the "(₹amt - METHOD - Employee - Type - Note)"
// comment format save_transaction() parses into one salary_records row per
// employee, joined with ' | ' for however many employees end up in this batch.
function mergeSalaryEntries(entries) {
    if (entries.length === 0) return null;
    let total = 0;
    let firstMethod = '';
    const parts = [];
    entries.forEach(e => {
        if (!firstMethod) firstMethod = e.method;
        total += e.amount;
        parts.push(`(₹${e.amount.toFixed(2)} - ${e.method.toUpperCase()} - ${e.employee} - ${e.paymentType}${e.note ? ' - ' + e.note : ''})`);
    });
    return { amount: total, method: firstMethod, comment: parts.join(' | ') };
}

async function processImportFile() {
    const fileInput = document.getElementById('importFileInput');
    const resultsDiv = document.getElementById('importResults');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please choose a file to import');
        return;
    }

    resultsDiv.innerHTML = '<p class="loading-message">Reading file...</p>';

    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (rows.length === 0) {
            resultsDiv.innerHTML = '<p class="loading-message">No rows found in file</p>';
            return;
        }

        const incomeCategories = getActiveCategoriesByType('income_category');
        const expenseCategories = getActiveCategoriesByType('expense_category');

        const errors = [];

        // Pass 1: resolve each row's date (a blank cell means "same date as the
        // row above") and group consecutive same-date rows into one batch - a
        // batch becomes exactly one transaction, so multiple employees/entries
        // on the same day show up as one entry with combined line items
        // (matching image #2-style merged view), not separate "Entry N" cards.
        const batches = [];
        let lastResolvedDate = null;
        rows.forEach((row, i) => {
            const rowNum = i + 2; // account for header row, 1-indexed
            const rawDateCell = row['Date (YYYY-MM-DD)'];
            const dateCellBlank = String(rawDateCell || '').trim() === '';
            const resolvedDate = dateCellBlank ? lastResolvedDate : normalizeImportDate(rawDateCell);

            if (!resolvedDate) {
                errors.push(`Row ${rowNum}: Invalid or missing date`);
                return;
            }
            lastResolvedDate = resolvedDate;

            const lastBatch = batches[batches.length - 1];
            if (lastBatch && lastBatch.date === resolvedDate) {
                lastBatch.items.push({ row, rowNum });
            } else {
                batches.push({ date: resolvedDate, items: [{ row, rowNum }] });
            }
        });

        let successRows = 0;
        let successBatches = 0;
        let lastClosingBalance = null;

        resultsDiv.innerHTML = `<p class="loading-message">Importing 0 / ${batches.length}...</p>`;

        for (let b = 0; b < batches.length; b++) {
            const batch = batches[b];
            const rowLabel = batch.items.length > 1
                ? `Rows ${batch.items[0].rowNum}-${batch.items[batch.items.length - 1].rowNum}`
                : `Row ${batch.items[0].rowNum}`;

            try {
                // Opening balance: first non-blank cell found across the batch's
                // rows, else chained from the previous batch's closing balance.
                let openingBalance = null;
                for (const { row } of batch.items) {
                    const val = getCell(row, 'Opening Balance (only needed on the first row of a repeated date - later rows auto-chain)', 'Opening Balance');
                    if (val !== '') { openingBalance = parseFloat(val) || 0; break; }
                }
                if (openingBalance === null) {
                    openingBalance = lastClosingBalance !== null ? lastClosingBalance : 0;
                }

                const income = {};
                let totalIncome = 0;
                incomeCategories.forEach(c => {
                    const entries = [];
                    batch.items.forEach(({ row }) => {
                        entries.push(...parseCellEntries(
                            getCell(row, `${c.label} Amount (; separated for multiple same-day entries)`, `${c.label} Amount`),
                            getCell(row, `${c.label} Method (cash/upi, ; separated)`, `${c.label} Method (cash/upi)`),
                            getCell(row, `${c.label} Comment (; separated)`, `${c.label} Comment`)
                        ));
                    });
                    const merged = mergeCategoryEntries(entries);
                    if (merged) {
                        totalIncome += merged.amount;
                        income[c.key_id] = merged;
                    }
                });

                const expense = {};
                let totalExpense = 0;
                expenseCategories.forEach(c => {
                    if (c.key_id === 'salary') {
                        // Salary comments must match "(₹amount - METHOD - Employee - Type)" for the
                        // server to create a salary_records entry (see save_transaction() in server.py) -
                        // a free-text comment (what the generic column would have given) is silently ignored.
                        const salaryEntries = [];
                        batch.items.forEach(({ row }) => {
                            salaryEntries.push(...parseSalaryRowEntries(row));
                        });
                        const merged = mergeSalaryEntries(salaryEntries);
                        if (merged) {
                            totalExpense += merged.amount;
                            expense[c.key_id] = merged;
                        }
                        return;
                    }

                    const entries = [];
                    batch.items.forEach(({ row }) => {
                        entries.push(...parseCellEntries(
                            getCell(row, `${c.label} Amount (; separated for multiple same-day entries)`, `${c.label} Amount`),
                            getCell(row, `${c.label} Method (cash/upi, ; separated)`, `${c.label} Method (cash/upi)`),
                            getCell(row, `${c.label} Comment (; separated)`, `${c.label} Comment`)
                        ));
                    });
                    const merged = mergeCategoryEntries(entries);
                    if (merged) {
                        totalExpense += merged.amount;
                        expense[c.key_id] = merged;
                    }
                });

                // Closing balance: explicit value from the LAST row in the batch
                // if provided, else computed from the merged totals.
                const lastRow = batch.items[batch.items.length - 1].row;
                const rawClosing = lastRow['Closing Balance (optional - auto-calculated if blank)'];
                const closingBalance = rawClosing !== '' && rawClosing !== undefined
                    ? parseFloat(rawClosing)
                    : openingBalance + totalIncome - totalExpense;

                income.totalIncome = totalIncome;
                expense.totalExpense = totalExpense;

                const payload = { openingBalance, entryDate: batch.date, income, expense, closingBalance };

                const res = await fetch('/api/transactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.error || 'Server rejected this entry');
                }

                successRows += batch.items.length;
                successBatches++;
                lastClosingBalance = closingBalance;
            } catch (batchError) {
                errors.push(`${rowLabel}: ${batchError.message}`);
            }

            resultsDiv.innerHTML = `<p class="loading-message">Importing ${b + 1} / ${batches.length}...</p>`;
        }

        resultsDiv.innerHTML = `
            <p><strong>✅ ${successRows} row(s) imported as ${successBatches} transaction(s)</strong>${errors.length ? `, <strong style="color:#ef4444;">❌ ${errors.length} failed</strong>` : ''}</p>
            ${errors.length ? `<ul style="color:#ef4444; font-size:0.9em; max-height:150px; overflow-y:auto;">${errors.map(e => `<li>${e}</li>`).join('')}</ul>` : ''}
        `;

        await loadDashboardData();
        await loadRecentTransactions();
        await loadMonthComparison();
    } catch (error) {
        console.error('Error importing file:', error);
        resultsDiv.innerHTML = `<p class="loading-message">Error reading file: ${error.message}</p>`;
    }
}

// Open download modal
function openDownloadModal() {
    // Set default dates - last 30 days to today
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    document.getElementById('toDate').value = formatDate(today);
    document.getElementById('fromDate').value = formatDate(thirtyDaysAgo);
    
    document.getElementById('downloadModal').style.display = 'flex';
}

// Close download modal
function closeDownloadModal() {
    document.getElementById('downloadModal').style.display = 'none';
}

// Format date to YYYY-MM-DD
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Load report categories dynamically from settings
async function loadReportCategories() {
    try {
        const res = await fetch('/api/settings', { credentials: 'include' });
        const categories = await res.json();
        
        const incomeCategories = categories
            .filter(cat => cat.type === 'income_category' && (cat.active === 1 || cat.active === true))
            .map(cat => ({ label: cat.label, field: cat.key_id, method: cat.key_id + '_method' }));
        
        const expenseCategories = categories
            .filter(cat => cat.type === 'expense_category' && (cat.active === 1 || cat.active === true))
            .map(cat => ({ label: cat.label, field: cat.key_id, method: cat.key_id + '_method' }));
        
        return { incomeCategories, expenseCategories };
    } catch (err) {
        console.error('Error loading report categories:', err);
        // Fallback to empty arrays if API fails
        return { incomeCategories: [], expenseCategories: [] };
    }
}

// Generate and download report
async function generateReport() {
    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;
    const format = document.querySelector('input[name="format"]:checked').value;
    
    if (!fromDate || !toDate) {
        alert('Please select both from and to dates');
        return;
    }
    
    if (new Date(fromDate) > new Date(toDate)) {
        alert('From date cannot be later than to date');
        return;
    }
    
    try {
        // Load categories first
        const { incomeCategories, expenseCategories } = await loadReportCategories();
        
        // Fetch all transactions for the date range
        const response = await fetch('/api/transactions?limit=10000', {
            credentials: 'include'
        });
        const allTransactions = await response.json();
        
        // Filter transactions by date range
        const filteredTransactions = allTransactions.filter(t => {
            const transactionDate = t.date.split('T')[0].split(' ')[0];
            return transactionDate >= fromDate && transactionDate <= toDate;
        });
        
        if (filteredTransactions.length === 0) {
            alert('No transactions found for the selected date range');
            return;
        }
        
        if (format === 'excel') {
            downloadExcel(filteredTransactions, fromDate, toDate, incomeCategories, expenseCategories);
        } else {
            downloadPDF(filteredTransactions, fromDate, toDate, incomeCategories, expenseCategories);
        }
        
        closeDownloadModal();
    } catch (error) {
        console.error('Error generating report:', error);
        alert('Error generating report. Please try again.');
    }
}

// Download as Excel
// Shared P&L computation for both the Excel and PDF exports: per-category totals
// (sorted descending, zero-amount categories dropped) plus income/expense grand totals.
function buildPnlTotals(transactions, incomeCategories, expenseCategories) {
    const sortedTransactions = [...transactions].sort((a, b) => a.id - b.id);

    function categoryTotals(categories) {
        return categories
            .map(cat => ({
                label: cat.label,
                amount: sortedTransactions.reduce((sum, t) => sum + (parseFloat(t[cat.field]) || 0), 0)
            }))
            .filter(c => c.amount > 0)
            .sort((a, b) => b.amount - a.amount);
    }

    const incomeTotals = categoryTotals(incomeCategories);
    const expenseTotals = categoryTotals(expenseCategories);
    const totalIncome = incomeTotals.reduce((sum, c) => sum + c.amount, 0);
    const totalExpense = expenseTotals.reduce((sum, c) => sum + c.amount, 0);

    return { incomeTotals, expenseTotals, totalIncome, totalExpense, sortedTransactions };
}

function downloadExcel(transactions, fromDate, toDate, incomeCategories, expenseCategories) {
    // Create workbook with multiple sheets
    const wb = XLSX.utils.book_new();
    
    // --- P&L STATEMENT SHEET ---
    const { incomeTotals, expenseTotals, totalIncome, totalExpense, sortedTransactions } =
        buildPnlTotals(transactions, incomeCategories, expenseCategories);

    const currentBalance = sortedTransactions.length > 0 ? parseFloat(sortedTransactions[sortedTransactions.length - 1].closing_balance) : 0;

    const summaryData = [];
    summaryData.push(['Profit & Loss Statement']);
    summaryData.push([`Date Range: ${fromDate} to ${toDate}`]);
    summaryData.push([]);
    summaryData.push(['Income', 'Amount (₹)']);
    incomeTotals.forEach(c => summaryData.push([c.label, c.amount.toFixed(2)]));
    summaryData.push(['Total Income', totalIncome.toFixed(2)]);
    summaryData.push([]);
    summaryData.push(['Expenses', 'Amount (₹)']);
    expenseTotals.forEach(c => summaryData.push([c.label, c.amount.toFixed(2)]));
    summaryData.push(['Total Expenses', totalExpense.toFixed(2)]);
    summaryData.push([]);
    summaryData.push(['Net Profit', (totalIncome - totalExpense).toFixed(2)]);
    summaryData.push(['Current Balance', currentBalance.toFixed(2)]);

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWs['!cols'] = [{ wch: 28 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'P&L Statement');
    
    // --- DETAILED TRANSACTIONS SHEET ---
    const detailData = [];
    
    // Column headers
    detailData.push(['Date', 'Opening Balance', 'Income Category', 'Income Method', 'Income Amount', 'Expense Category', 'Expense Method', 'Expense Amount', 'Closing Balance']);
    
    sortedTransactions.forEach(t => {
        const dateStr = new Date(t.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        const openingBal = parseFloat(t.opening_balance).toFixed(2);
        const closingBal = parseFloat(t.closing_balance).toFixed(2);
        
        // Collect income and expense entries
        const incomeEntries = [];
        const expenseEntries = [];
        
        incomeCategories.forEach(cat => {
            const amount = parseFloat(t[cat.field]) || 0;
            if (amount > 0) {
                const method = t[cat.method] || 'Cash';
                incomeEntries.push({ category: cat.label, method: method.toUpperCase(), amount: amount.toFixed(2) });
            }
        });
        
        expenseCategories.forEach(cat => {
            const amount = parseFloat(t[cat.field]) || 0;
            if (amount > 0) {
                const method = t[cat.method] || 'Cash';
                expenseEntries.push({ category: cat.label, method: method.toUpperCase(), amount: amount.toFixed(2) });
            }
        });
        
        // Get max number of rows needed for this transaction
        const maxRows = Math.max(incomeEntries.length, expenseEntries.length, 1);
        
        for (let i = 0; i < maxRows; i++) {
            const row = [];
            
            // Date and balance info only on first row
            if (i === 0) {
                row.push(dateStr);
                row.push(openingBal);
            } else {
                row.push('');
                row.push('');
            }
            
            // Income columns
            if (i < incomeEntries.length) {
                row.push(incomeEntries[i].category);
                row.push(incomeEntries[i].method);
                row.push(incomeEntries[i].amount);
            } else {
                row.push('');
                row.push('');
                row.push('');
            }
            
            // Expense columns
            if (i < expenseEntries.length) {
                row.push(expenseEntries[i].category);
                row.push(expenseEntries[i].method);
                row.push(expenseEntries[i].amount);
            } else {
                row.push('');
                row.push('');
                row.push('');
            }
            
            // Closing balance only on last row
            if (i === maxRows - 1) {
                row.push(closingBal);
            } else {
                row.push('');
            }
            
            detailData.push(row);
        }
    });
    
    const detailWs = XLSX.utils.aoa_to_sheet(detailData);
    detailWs['!cols'] = [
        { wch: 15 }, // Date
        { wch: 16 }, // Opening Balance
        { wch: 20 }, // Income Category
        { wch: 15 }, // Income Method
        { wch: 15 }, // Income Amount
        { wch: 20 }, // Expense Category
        { wch: 15 }, // Expense Method
        { wch: 15 }, // Expense Amount
        { wch: 16 }  // Closing Balance
    ];
    XLSX.utils.book_append_sheet(wb, detailWs, 'Detailed Report');
    
    // Download
    XLSX.writeFile(wb, `Financial_Report_Detailed_${fromDate}_to_${toDate}.xlsx`);
}

// Download as PDF
function downloadPDF(transactions, fromDate, toDate, incomeCategories, expenseCategories) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l'); // landscape mode for wider table
    
    // Title
    doc.setFontSize(18);
    doc.text('Profit & Loss Statement', 14, 20);

    // Date range
    doc.setFontSize(11);
    doc.text(`Date Range: ${fromDate} to ${toDate}`, 14, 30);

    const { incomeTotals, expenseTotals, totalIncome, totalExpense, sortedTransactions } =
        buildPnlTotals(transactions, incomeCategories, expenseCategories);

    const currentBalance = sortedTransactions.length > 0 ? parseFloat(sortedTransactions[sortedTransactions.length - 1].closing_balance) : 0;

    // P&L table: income section, expense section, then net profit/balance
    const pnlBody = [
        ...incomeTotals.map(c => [c.label, c.amount.toFixed(2)]),
        ['Total Income', totalIncome.toFixed(2)],
        ...expenseTotals.map(c => [c.label, c.amount.toFixed(2)]),
        ['Total Expenses', totalExpense.toFixed(2)],
        ['Net Profit', (totalIncome - totalExpense).toFixed(2)],
        ['Current Balance', currentBalance.toFixed(2)]
    ];

    doc.autoTable({
        startY: 40,
        head: [['P&L Statement', 'Amount (Rs.)']],
        body: pnlBody,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        didParseCell: (data) => {
            const label = data.row.raw[0];
            if (['Total Income', 'Total Expenses', 'Net Profit', 'Current Balance'].includes(label)) {
                data.cell.styles.fontStyle = 'bold';
            }
        }
    });
    
    // Prepare detailed table data
    const tableData = [];
    
    sortedTransactions.forEach(t => {
        const dateStr = new Date(t.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        const openingBal = parseFloat(t.opening_balance).toFixed(2);
        const closingBal = parseFloat(t.closing_balance).toFixed(2);
        
        // Collect income and expense entries
        const incomeEntries = [];
        const expenseEntries = [];
        
        incomeCategories.forEach(cat => {
            const amount = parseFloat(t[cat.field]) || 0;
            if (amount > 0) {
                const method = t[cat.method] || 'Cash';
                incomeEntries.push({ category: cat.label, method: method.toUpperCase(), amount: amount.toFixed(2) });
            }
        });
        
        expenseCategories.forEach(cat => {
            const amount = parseFloat(t[cat.field]) || 0;
            if (amount > 0) {
                const method = t[cat.method] || 'Cash';
                expenseEntries.push({ category: cat.label, method: method.toUpperCase(), amount: amount.toFixed(2) });
            }
        });
        
        // Get max number of rows needed for this transaction
        const maxRows = Math.max(incomeEntries.length, expenseEntries.length, 1);
        
        for (let i = 0; i < maxRows; i++) {
            const row = [];
            
            // Date and balance info only on first row
            if (i === 0) {
                row.push(dateStr);
                row.push(openingBal);
            } else {
                row.push('');
                row.push('');
            }
            
            // Income columns
            if (i < incomeEntries.length) {
                row.push(incomeEntries[i].category);
                row.push(incomeEntries[i].method);
                row.push(incomeEntries[i].amount);
            } else {
                row.push('');
                row.push('');
                row.push('');
            }
            
            // Expense columns
            if (i < expenseEntries.length) {
                row.push(expenseEntries[i].category);
                row.push(expenseEntries[i].method);
                row.push(expenseEntries[i].amount);
            } else {
                row.push('');
                row.push('');
                row.push('');
            }
            
            // Closing balance only on last row
            if (i === maxRows - 1) {
                row.push(closingBal);
            } else {
                row.push('');
            }
            
            tableData.push(row);
        }
    });
    
    // Add detailed transactions table
    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 15,
        head: [['Date', 'Opening Bal', 'Income Category', 'Income Method', 'Income Amt', 'Expense Category', 'Expense Method', 'Expense Amt', 'Closing Bal']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
            0: { cellWidth: 18 }, // Date
            1: { cellWidth: 16 }, // Opening Bal
            2: { cellWidth: 20 }, // Income Category
            3: { cellWidth: 16 }, // Income Method
            4: { cellWidth: 14 }, // Income Amt
            5: { cellWidth: 20 }, // Expense Category
            6: { cellWidth: 16 }, // Expense Method
            7: { cellWidth: 14 }, // Expense Amt
            8: { cellWidth: 16 }  // Closing Bal
        },
        margin: { left: 8, right: 8 }
    });
    
    // Download
    doc.save(`Financial_Report_Detailed_${fromDate}_to_${toDate}.pdf`);
}

