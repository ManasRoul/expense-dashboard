// Category labels mapping
const incomeLabels = {
    'room_rent': { name: 'Room Rent', icon: '🏠' },
    'mattress_charge': { name: 'Mattress Charge', icon: '🛏️' },
    'travel_cab': { name: 'Travel/Cab Service', icon: '🚕' },
    'kitchen_facility': { name: 'Kitchen Facility', icon: '🍳' },
    'clean_charge': { name: 'Clean Charge', icon: '🧹' },
    'misc_receipt': { name: 'Misc Receipt', icon: '💵' }
};

const expenseLabels = {
    'brokerage': { name: 'Brokerage', icon: '🤝' },
    'salary': { name: 'Salary', icon: '💼' },
    'room_cleaning_charge': { name: 'Room Cleaning Charge', icon: '🧼' },
    'generator_maintenance': { name: 'Generator & Maintenance', icon: '⚡' },
    'hotel_stationary': { name: 'Hotel Stationary', icon: '📝' },
    'hotel_cleaning_sanitation': { name: 'Hotel Cleaning & Sanitation', icon: '🧽' },
    'rent_taxes': { name: 'Rent & Taxes', icon: '🏢' },
    'tv_recharge': { name: 'TV Recharge', icon: '📺' },
    'camera_wifi': { name: 'Camera/WiFi', icon: '📡' },
    'plumbing_maintenance': { name: 'Plumbing & Maintenance', icon: '🔧' },
    'electricity_maintenance': { name: 'Electricity & Maintenance', icon: '💡' },
    'electricity_bill': { name: 'Electricity Bill', icon: '⚡' },
    'staff_fooding': { name: 'Staff Fooding', icon: '🍽️' },
    'laundry': { name: 'Laundry', icon: '👕' },
    'owner_kitchen_cab': { name: 'Owner Kitchen & Cab Payment', icon: '🚗' },
    'office_stationary': { name: 'Office Stationary', icon: '📋' },
    'misc_expenses': { name: 'Misc Expenses', icon: '💳' }
};

// Load data on page load
document.addEventListener('DOMContentLoaded', () => {
    loadCategoryData();
});

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

        // Display income categories
        const incomeGrid = document.getElementById('incomeGrid');
        incomeGrid.innerHTML = '';
        
        const sortedIncome = Object.entries(data.income).sort((a, b) => b[1] - a[1]);
        
        sortedIncome.forEach(([category, amount]) => {
            totalIncome += amount;
            const label = incomeLabels[category];
            
            // Count number of entries for this category
            const entryCount = window.allTransactions.filter(t => {
                const amt = parseFloat(t[category]) || 0;
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
                    <button class="btn-details" onclick="showCategoryDetails('${category}', 'income', '${label.name}')" ${amount === 0 ? 'disabled' : ''}>
                        View Details
                    </button>
                </div>
            `;
            incomeGrid.appendChild(card);
        });

        // Display expense categories
        const expenseGrid = document.getElementById('expenseGrid');
        expenseGrid.innerHTML = '';
        
        const sortedExpense = Object.entries(data.expense).sort((a, b) => b[1] - a[1]);
        
        sortedExpense.forEach(([category, amount]) => {
            totalExpense += amount;
            const label = expenseLabels[category];
            
            // Count number of entries for this category
            const entryCount = window.allTransactions.filter(t => {
                const amt = parseFloat(t[category]) || 0;
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
                    <button class="btn-details" onclick="showCategoryDetails('${category}', 'expense', '${label.name}')" ${amount === 0 ? 'disabled' : ''}>
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
        const errorMsg = `<div class="error-message">
            <div style="font-size: 48px; margin-bottom: 10px;">❌</div>
            <h3>Error Loading Data</h3>
            <p>${error.message}</p>
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

// Show category details
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
        
        const filteredTransactions = transactions.filter(t => {
            const amount = parseFloat(t[categoryField]) || 0;
            return amount > 0;
        }).map(t => ({
            date: t.date,
            amount: parseFloat(t[categoryField]) || 0,
            method: t[methodField] || '-',
            id: t.id
        }));
        
        if (filteredTransactions.length === 0) {
            modalBody.innerHTML = '<div class="no-data">No entries found for this category</div>';
            return;
        }
        
        // Calculate total
        const total = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
        
        // Build table
        let tableHTML = `
            <table class="details-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Payment Method</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        filteredTransactions.forEach(t => {
            const methodBadge = t.method === 'cash' ? '<span class="method-badge badge-cash">Cash</span>' :
                              t.method === 'upi' ? '<span class="method-badge badge-upi">UPI</span>' :
                              '<span class="method-badge badge-none">-</span>';
            
            tableHTML += `
                <tr>
                    <td>${new Date(t.date).toLocaleString()}</td>
                    <td>${methodBadge}</td>
                    <td class="amount-cell ${type === 'income' ? 'positive' : 'negative'}">₹${t.amount.toFixed(2)}</td>
                </tr>
            `;
        });
        
        tableHTML += `
                    <tr class="total-row">
                        <td colspan="2"><strong>Total ${categoryName}</strong></td>
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
window.onclick = function(event) {
    const modal = document.getElementById('categoryModal');
    if (event.target === modal) {
        closeDetailsModal();
    }
}
