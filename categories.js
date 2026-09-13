// Category labels and icons - will be loaded dynamically from settings
let incomeLabels = {};
let expenseLabels = {};
let categoryMetadata = [];

// Load category metadata on page load
document.addEventListener('DOMContentLoaded', () => {
    loadCategoryMetadata().then(() => {
        loadCategoryData();
    });
});

// Load category metadata (labels, icons) from settings
async function loadCategoryMetadata() {
    try {
        const res = await fetch('/api/settings', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load settings');
        const items = await res.json();
        
        // Build label and icon maps
        incomeLabels = {};
        expenseLabels = {};
        categoryMetadata = items;
        
        items.forEach(item => {
            if (item.type === 'income_category') {
                incomeLabels[item.key_id] = {
                    name: item.label,
                    icon: item.icon || '💵'
                };
            } else if (item.type === 'expense_category') {
                expenseLabels[item.key_id] = {
                    name: item.label,
                    icon: item.icon || '💳'
                };
            }
        });
    } catch (error) {
        console.error('Error loading category metadata:', error);
        // Fallback to empty objects - categories will still load from API
        incomeLabels = {};
        expenseLabels = {};
    }
}

// Load category totals
async function loadCategoryData() {
    try {
        // Show loading state
        document.getElementById('incomeGrid').innerHTML = '<div class="loading-message">📊 Loading income categories...</div>';
        document.getElementById('expenseGrid').innerHTML = '<div class="loading-message">📊 Loading expense categories...</div>';
        
        // Fetch category totals
        const response = await fetch('/api/category-totals', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to load category totals: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();

        // Also load all transactions for details view
        const transactionsResponse = await fetch('/api/transactions', {
            credentials: 'include'
        });
        
        if (!transactionsResponse.ok) {
            throw new Error(`Failed to load transactions: ${transactionsResponse.status} ${transactionsResponse.statusText}`);
        }
        
        window.allTransactions = await transactionsResponse.json();

        // Calculate totals
        let totalIncome = 0;
        let totalExpense = 0;

        // Display income categories - using dynamic categories from API
        const incomeGrid = document.getElementById('incomeGrid');
        incomeGrid.innerHTML = '';
        
        const incomeCategories = (data.categories || []).filter(c => c.type === 'income_category');
        
        // Sort by amount descending
        const sortedIncome = incomeCategories.sort((a, b) => {
            const amountA = parseFloat(data.income[a.key_id]) || 0;
            const amountB = parseFloat(data.income[b.key_id]) || 0;
            return amountB - amountA;
        });
        
        if (incomeCategories.length === 0) {
            incomeGrid.innerHTML = '<div class="loading-message">No income categories found</div>';
        }
        
        sortedIncome.forEach(category => {
            const amount = parseFloat(data.income[category.key_id]) || 0;
            totalIncome += amount;
            const label = incomeLabels[category.key_id] || { name: category.label, icon: category.icon || '💵' };
            
            // Count number of entries for this category
            const entryCount = window.allTransactions.filter(t => {
                const amt = parseFloat(t[category.key_id]) || 0;
                return amt > 0;
            }).length;
            
            const card = document.createElement('div');
            card.className = 'category-card income-card';
            card.innerHTML = `
                <div class="category-header">
                    <div class="category-name">${label.name}</div>
                    <div class="category-icon">${label.icon}</div>
                </div>
                <div class="category-amount">₹${amount.toFixed(2)}</div>
                <div class="category-count">${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}</div>
                <div class="category-footer">
                    <button class="btn-details" onclick="showCategoryDetails('${category.key_id}', 'income', '${label.name}')" ${amount === 0 ? 'disabled' : ''}>
                        View Details
                    </button>
                </div>
            `;
            incomeGrid.appendChild(card);
        });

        // Display expense categories - using dynamic categories from API
        const expenseGrid = document.getElementById('expenseGrid');
        expenseGrid.innerHTML = '';
        
        const expenseCategories = (data.categories || []).filter(c => c.type === 'expense_category');
        
        // Sort by amount descending
        const sortedExpense = expenseCategories.sort((a, b) => {
            const amountA = parseFloat(data.expense[a.key_id]) || 0;
            const amountB = parseFloat(data.expense[b.key_id]) || 0;
            return amountB - amountA;
        });
        
        if (expenseCategories.length === 0) {
            expenseGrid.innerHTML = '<div class="loading-message">No expense categories found</div>';
        }
        
        sortedExpense.forEach(category => {
            const amount = parseFloat(data.expense[category.key_id]) || 0;
            totalExpense += amount;
            const label = expenseLabels[category.key_id] || { name: category.label, icon: category.icon || '💳' };
            
            // Count number of entries for this category
            const entryCount = window.allTransactions.filter(t => {
                const amt = parseFloat(t[category.key_id]) || 0;
                return amt > 0;
            }).length;
            
            const card = document.createElement('div');
            card.className = 'category-card expense-card';
            card.innerHTML = `
                <div class="category-header">
                    <div class="category-name">${label.name}</div>
                    <div class="category-icon">${label.icon}</div>
                </div>
                <div class="category-amount">₹${amount.toFixed(2)}</div>
                <div class="category-count">${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}</div>
                <div class="category-footer">
                    <button class="btn-details" onclick="showCategoryDetails('${category.key_id}', 'expense', '${label.name}')" ${amount === 0 ? 'disabled' : ''}>
                        View Details
                    </button>
                </div>
            `;
            expenseGrid.appendChild(card);
        });

        // Update summary totals
        document.getElementById('totalIncome').textContent = `₹${totalIncome.toFixed(2)}`;
        document.getElementById('totalExpense').textContent = `₹${totalExpense.toFixed(2)}`;

    } catch (error) {
        console.error('Error loading category data:', error);
        console.error('Error stack:', error.stack);
        const errorMsg = `<div class="error-message">
            <div style="font-size: 48px; margin-bottom: 10px;">❌</div>
            <h3>Error Loading Data</h3>
            <p><strong>Error:</strong> ${error.message}</p>
            <p style="font-size: 12px; color: #666; margin-top: 10px;">Check browser console (F12) for more details</p>
            <button onclick="location.reload()" class="btn btn-primary" style="margin-top: 10px;">🔄 Retry</button>
        </div>`;
        document.getElementById('incomeGrid').innerHTML = errorMsg;
        document.getElementById('expenseGrid').innerHTML = '';
    }
}

// Refresh data
function refreshData(btn) {
    // Show loading state on button
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Refreshing...';
    btn.disabled = true;
    
    // Show loading in grids
    document.getElementById('incomeGrid').innerHTML = '<div class="loading-message">📊 Loading income categories...</div>';
    document.getElementById('expenseGrid').innerHTML = '<div class="loading-message">📊 Loading expense categories...</div>';
    
    // Reload data
    loadCategoryData().then(() => {
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

// Show category details in modal
async function showCategoryDetails(category, type, categoryName) {
    const modal = document.getElementById('categoryModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    modalTitle.textContent = `${categoryName} - Date-wise Entries`;
    modalBody.innerHTML = '<div class="loading-message">Loading details...</div>';
    modal.style.display = 'flex';
    
    try {
        // Use cached transactions
        const transactions = window.allTransactions || [];
        
        // Filter transactions that have this category
        const categoryField = category;
        const methodField = category + '_method';
        const commentField = category + '_comment';
        
        const filteredTransactions = transactions.filter(t => {
            const amount = parseFloat(t[categoryField]) || 0;
            return amount > 0;
        }).map(t => ({
            date: t.date,
            amount: parseFloat(t[categoryField]) || 0,
            method: t[methodField] || '-',
            comment: t[commentField] || '',
            id: t.id
        }));
        
        if (filteredTransactions.length === 0) {
            modalBody.innerHTML = '<div class="no-data">No entries found for this category</div>';
            return;
        }
        
        // Calculate total
        const total = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
        
        // Build table - include comments if present
        const hasComments = filteredTransactions.some(t => t.comment && t.comment.trim());
        let tableHTML = `
            <table class="details-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Payment Method</th>
                        <th>Amount</th>
                        ${hasComments ? '<th>Details/Notes</th>' : ''}
                    </tr>
                </thead>
                <tbody>
        `;
        
        filteredTransactions.forEach(t => {
            const methodBadge = t.method === 'cash' ? '<span class="method-badge badge-cash">Cash</span>' :
                              t.method === 'upi' ? '<span class="method-badge badge-upi">UPI</span>' :
                              '<span class="method-badge badge-none">-</span>';
            
            let commentCell = '';
            if (hasComments) {
                // For salary entries, parse the structured comment
                let displayComment = t.comment;
                if (t.comment && t.comment.includes('₹')) {
                    // This might be a salary entry with multiple sub-entries
                    // Parse format: (₹5000 - CASH - Shakti - Advance - Note) | (₹3000 - UPI - Kabu - Full)
                    displayComment = t.comment.split('|').map(entry => {
                        entry = entry.trim();
                        const match = entry.match(/\(₹([\d.]+)\s*-\s*(\w+)\s*-\s*(\w+)(?:\s*-\s*(\w+))?(?:\s*-\s*(.+))?\)/);
                        if (match) {
                            const amt = match[1];
                            const method = match[2];
                            const name = match[3];
                            const type = match[4] || 'Full';
                            const note = match[5] ? ` - ${match[5]}` : '';
                            return `${name} (${type}) ${note}`;
                        }
                        return entry;
                    }).join(' | ');
                }
                commentCell = `<td title="${displayComment}">${displayComment ? displayComment.substring(0, 40) + (displayComment.length > 40 ? '...' : '') : '-'}</td>`;
            }
            
            tableHTML += `
                <tr>
                    <td>${new Date(t.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                    <td>${methodBadge}</td>
                    <td class="amount-cell ${type === 'income' ? 'positive' : 'negative'}">₹${t.amount.toFixed(2)}</td>
                    ${commentCell}
                </tr>
            `;
        });
        
        tableHTML += `
                    <tr class="total-row">
                        <td colspan="${hasComments ? 4 : 3}"><strong>Total ${categoryName}</strong></td>
                        <td class="amount-cell ${type === 'income' ? 'positive' : 'negative'}">₹${total.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>
        `;
        
        modalBody.innerHTML = tableHTML;
        
    } catch (error) {
        console.error('Error loading category details:', error);
        modalBody.innerHTML = '<div class="no-data">Error loading details</div>';
    }
}

// Close modal
function closeDetailsModal() {
    document.getElementById('categoryModal').style.display = 'none';
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('categoryModal');
    if (event.target === modal) {
        closeDetailsModal();
    }
});
