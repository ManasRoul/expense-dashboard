// Load dashboard data on page load
document.addEventListener('DOMContentLoaded', () => {
    loadDashboardData();
    loadRecentTransactions();
});

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

// Load recent transactions
async function loadRecentTransactions(fromDate = null, toDate = null) {
    try {
        const response = await fetch('/api/transactions', {
            credentials: 'include'
        });
        const transactions = await response.json();

        const tbody = document.getElementById('transactionsBody');
        
        if (transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="loading-message">No transactions found</td></tr>';
            return;
        }

        // Filter transactions by date range if provided
        let filteredTransactions = transactions;
        if (fromDate || toDate) {
            filteredTransactions = transactions.filter(transaction => {
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

        // Store all transactions globally for detail view
        window.allTransactions = transactions;
        
        // Check if user is owner
        const userRole = localStorage.getItem('userRole');
        const isOwner = userRole === 'owner';

        if (filteredTransactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="loading-message">No transactions found for selected date range</td></tr>';
            return;
        }

        tbody.innerHTML = filteredTransactions.map(transaction => `
            <tr>
                <td>${new Date(transaction.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                <td>₹${parseFloat(transaction.opening_balance).toFixed(2)}</td>
                <td class="positive">₹${parseFloat(transaction.total_income).toFixed(2)}</td>
                <td class="negative">₹${parseFloat(transaction.total_expense).toFixed(2)}</td>
                <td>₹${parseFloat(transaction.closing_balance).toFixed(2)}</td>
                <td>
                    <button class="btn-view" onclick="viewTransaction(${transaction.id})">View Details</button>
                    ${isOwner ? `<button class="btn-delete" onclick="deleteTransaction(${transaction.id})">🗑️ Delete</button>` : ''}
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading transactions:', error);
        document.getElementById('transactionsBody').innerHTML = 
            '<tr><td colspan="6" class="loading-message">Error loading transactions</td></tr>';
    }
}

// Refresh dashboard
function refreshDashboard(btn) {
    // Show loading state
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Refreshing...';
    btn.disabled = true;
    
    // Reload data
    Promise.all([
        loadDashboardData(),
        loadRecentTransactions()
    ]).then(() => {
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

    const incomeItems = [
        { label: 'Room Rent', amount: 'room_rent', method: 'room_rent_method', comment: 'room_rent_comment' },
        { label: 'Mattress Charge', amount: 'mattress_charge', method: 'mattress_charge_method', comment: 'mattress_charge_comment' },
        { label: 'Travel/Cab Service', amount: 'travel_cab', method: 'travel_cab_method', comment: 'travel_cab_comment' },
        { label: 'Kitchen Facility', amount: 'kitchen_facility', method: 'kitchen_facility_method', comment: 'kitchen_facility_comment' },
        { label: 'Clean Charge', amount: 'clean_charge', method: 'clean_charge_method', comment: 'clean_charge_comment' },
        { label: 'Misc Receipt', amount: 'misc_receipt', method: 'misc_receipt_method', comment: 'misc_receipt_comment' }
    ];

    const expenseItems = [
        { label: 'Brokerage', amount: 'brokerage', method: 'brokerage_method', comment: 'brokerage_comment' },
        { label: 'Salary', amount: 'salary', method: 'salary_method', comment: 'salary_comment' },
        { label: 'Room Cleaning Charge', amount: 'room_cleaning_charge', method: 'room_cleaning_charge_method', comment: 'room_cleaning_charge_comment' },
        { label: 'Generator & Maintenance', amount: 'generator_maintenance', method: 'generator_maintenance_method', comment: 'generator_maintenance_comment' },
        { label: 'Hotel Stationary', amount: 'hotel_stationary', method: 'hotel_stationary_method', comment: 'hotel_stationary_comment' },
        { label: 'Hotel Cleaning & Sanitation', amount: 'hotel_cleaning_sanitation', method: 'hotel_cleaning_sanitation_method', comment: 'hotel_cleaning_sanitation_comment' },
        { label: 'Rent & Taxes', amount: 'rent_taxes', method: 'rent_taxes_method', comment: 'rent_taxes_comment' },
        { label: 'TV Recharge', amount: 'tv_recharge', method: 'tv_recharge_method', comment: 'tv_recharge_comment' },
        { label: 'Camera/WiFi', amount: 'camera_wifi', method: 'camera_wifi_method', comment: 'camera_wifi_comment' },
        { label: 'Plumbing & Maintenance', amount: 'plumbing_maintenance', method: 'plumbing_maintenance_method', comment: 'plumbing_maintenance_comment' },
        { label: 'Electricity & Maintenance', amount: 'electricity_maintenance', method: 'electricity_maintenance_method', comment: 'electricity_maintenance_comment' },
        { label: 'Electricity Bill', amount: 'electricity_bill', method: 'electricity_bill_method', comment: 'electricity_bill_comment' },
        { label: 'Staff Fooding', amount: 'staff_fooding', method: 'staff_fooding_method', comment: 'staff_fooding_comment' },
        { label: 'Laundry', amount: 'laundry', method: 'laundry_method', comment: 'laundry_comment' },
        { label: 'Owner Kitchen & Cab Payment', amount: 'owner_kitchen_cab', method: 'owner_kitchen_cab_method', comment: 'owner_kitchen_cab_comment' },
        { label: 'Office Stationary', amount: 'office_stationary', method: 'office_stationary_method', comment: 'office_stationary_comment' },
        { label: 'Misc Expenses', amount: 'misc_expenses', method: 'misc_expenses_method', comment: 'misc_expenses_comment' }
    ];

    let incomeHTML = '<table class="detail-table"><thead><tr><th>Income Source</th><th>Payment Method</th><th>Amount</th><th>Comment</th></tr></thead><tbody>';
    incomeItems.forEach(item => {
        const amount = parseFloat(transaction[item.amount]) || 0;
        const method = transaction[item.method] || '-';
        const comment = transaction[item.comment] || '';
        if (amount > 0) {
            const methodBadge = method === 'cash' ? '<span class="badge badge-cash">Cash</span>' : 
                              method === 'upi' ? '<span class="badge badge-upi">UPI</span>' : '-';
            
            // Format comment - check if it contains multiple entries (separated by |)
            let commentHTML;
            if (comment && comment.includes('|')) {
                const entries = comment.split('|').map(e => e.trim()).filter(e => e);
                commentHTML = `<ul class="multi-entry-list" style="margin: 0; padding-left: 20px; list-style: disc; color: #64748b;">${entries.map(entry => `<li style="margin: 3px 0;">${entry}</li>`).join('')}</ul>`;
            } else {
                commentHTML = comment ? `<span class="comment-text">${comment}</span>` : '<span style="color: #9ca3af;">-</span>';
            }
            
            incomeHTML += `<tr><td>${item.label}</td><td>${methodBadge}</td><td class="positive">₹${amount.toFixed(2)}</td><td>${commentHTML}</td></tr>`;
        }
    });
    incomeHTML += '</tbody></table>';

    let expenseHTML = '<table class="detail-table"><thead><tr><th>Expense Source</th><th>Payment Method</th><th>Amount</th><th>Comment</th></tr></thead><tbody>';
    expenseItems.forEach(item => {
        const amount = parseFloat(transaction[item.amount]) || 0;
        const method = transaction[item.method] || '-';
        const comment = transaction[item.comment] || '';
        if (amount > 0) {
            const methodBadge = method === 'cash' ? '<span class="badge badge-cash">Cash</span>' : 
                              method === 'upi' ? '<span class="badge badge-upi">UPI</span>' : '-';
            
            // Format comment - check if it contains multiple entries (separated by |)
            let commentHTML;
            if (comment && comment.includes('|')) {
                const entries = comment.split('|').map(e => e.trim()).filter(e => e);
                commentHTML = `<ul class="multi-entry-list" style="margin: 0; padding-left: 20px; list-style: disc; color: #64748b;">${entries.map(entry => `<li style="margin: 3px 0;">${entry}</li>`).join('')}</ul>`;
            } else {
                commentHTML = comment ? `<span class="comment-text">${comment}</span>` : '<span style="color: #9ca3af;">-</span>';
            }
            
            expenseHTML += `<tr><td>${item.label}</td><td>${methodBadge}</td><td class="negative">₹${amount.toFixed(2)}</td><td>${commentHTML}</td></tr>`;
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
        
        <div class="modal-actions" style="margin-top: 20px; display: flex; gap: 10px; justify-content: center;">
            <button class="btn btn-primary" onclick="editTransaction(${id})">✏️ Edit Transaction</button>
            <button class="btn btn-secondary" onclick="closeModal()">Close</button>
        </div>
    `;

    document.getElementById('transactionModal').style.display = 'flex';
}

// Close modal
function closeModal() {
    document.getElementById('transactionModal').style.display = 'none';
}

// Edit transaction
function editTransaction(id) {
    // Redirect to form page with transaction ID
    window.location.href = `form.html?edit=${id}`;
}

// Delete transaction (owner only)
async function deleteTransaction(id) {
    if (!confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/transactions/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('Transaction deleted successfully!');
            // Reload dashboard data to reflect changes
            await loadDashboardData();
            await loadRecentTransactions();
        } else {
            alert(data.error || 'Failed to delete transaction');
        }
    } catch (error) {
        console.error('Error deleting transaction:', error);
        alert('Error deleting transaction. Please try again.');
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
            downloadExcel(filteredTransactions, fromDate, toDate);
        } else {
            downloadPDF(filteredTransactions, fromDate, toDate);
        }
        
        closeDownloadModal();
    } catch (error) {
        console.error('Error generating report:', error);
        alert('Error generating report. Please try again.');
    }
}

// Download as Excel
function downloadExcel(transactions, fromDate, toDate) {
    // Prepare data for Excel
    const data = [];
    
    // Add header
    data.push(['Financial Report - Detailed']);
    data.push([`Date Range: ${fromDate} to ${toDate}`]);
    data.push([]);
    
    // Add summary
    let totalIncome = 0;
    let totalExpense = 0;
    
    transactions.forEach(t => {
        totalIncome += parseFloat(t.total_income) || 0;
        totalExpense += parseFloat(t.total_expense) || 0;
    });
    
    const currentBalance = transactions.length > 0 ? parseFloat(transactions[0].closing_balance) : 0;
    
    data.push(['Summary']);
    data.push(['Total Income', totalIncome.toFixed(2)]);
    data.push(['Total Expenses', totalExpense.toFixed(2)]);
    data.push(['Current Balance', currentBalance.toFixed(2)]);
    data.push([]);
    
    // Income categories
    const incomeCategories = [
        { label: 'Room Rent', field: 'room_rent', method: 'room_rent_method' },
        { label: 'Mattress Charge', field: 'mattress_charge', method: 'mattress_charge_method' },
        { label: 'Travel/Cab Service', field: 'travel_cab', method: 'travel_cab_method' },
        { label: 'Kitchen Facility', field: 'kitchen_facility', method: 'kitchen_facility_method' },
        { label: 'Clean Charge', field: 'clean_charge', method: 'clean_charge_method' },
        { label: 'Misc Receipt', field: 'misc_receipt', method: 'misc_receipt_method' }
    ];
    
    // Expense categories
    const expenseCategories = [
        { label: 'Brokerage', field: 'brokerage', method: 'brokerage_method' },
        { label: 'Salary', field: 'salary', method: 'salary_method' },
        { label: 'Room Cleaning Charge', field: 'room_cleaning_charge', method: 'room_cleaning_charge_method' },
        { label: 'Generator & Maintenance', field: 'generator_maintenance', method: 'generator_maintenance_method' },
        { label: 'Hotel Stationary', field: 'hotel_stationary', method: 'hotel_stationary_method' },
        { label: 'Hotel Cleaning & Sanitation', field: 'hotel_cleaning_sanitation', method: 'hotel_cleaning_sanitation_method' },
        { label: 'Rent & Taxes', field: 'rent_taxes', method: 'rent_taxes_method' },
        { label: 'TV Recharge', field: 'tv_recharge', method: 'tv_recharge_method' },
        { label: 'Camera/WiFi', field: 'camera_wifi', method: 'camera_wifi_method' },
        { label: 'Plumbing & Maintenance', field: 'plumbing_maintenance', method: 'plumbing_maintenance_method' },
        { label: 'Electricity & Maintenance', field: 'electricity_maintenance', method: 'electricity_maintenance_method' },
        { label: 'Electricity Bill', field: 'electricity_bill', method: 'electricity_bill_method' },
        { label: 'Staff Fooding', field: 'staff_fooding', method: 'staff_fooding_method' },
        { label: 'Laundry', field: 'laundry', method: 'laundry_method' },
        { label: 'Owner Kitchen & Cab Payment', field: 'owner_kitchen_cab', method: 'owner_kitchen_cab_method' },
        { label: 'Office Stationary', field: 'office_stationary', method: 'office_stationary_method' },
        { label: 'Misc Expenses', field: 'misc_expenses', method: 'misc_expenses_method' }
    ];
    
    // Add detailed transactions
    data.push(['DETAILED TRANSACTIONS']);
    data.push([]);
    
    transactions.forEach((t, index) => {
        data.push([`Transaction #${index + 1} - ${new Date(t.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`]);
        data.push(['Opening Balance', parseFloat(t.opening_balance).toFixed(2)]);
        data.push([]);
        
        // Income details
        data.push(['INCOME']);
        data.push(['Category', 'Payment Method', 'Amount']);
        incomeCategories.forEach(cat => {
            const amount = parseFloat(t[cat.field]) || 0;
            if (amount > 0) {
                const method = t[cat.method] || '-';
                data.push([cat.label, method.toUpperCase(), amount.toFixed(2)]);
            }
        });
        data.push(['Total Income', '', parseFloat(t.total_income).toFixed(2)]);
        data.push([]);
        
        // Expense details
        data.push(['EXPENSES']);
        data.push(['Category', 'Payment Method', 'Amount']);
        expenseCategories.forEach(cat => {
            const amount = parseFloat(t[cat.field]) || 0;
            if (amount > 0) {
                const method = t[cat.method] || '-';
                data.push([cat.label, method.toUpperCase(), amount.toFixed(2)]);
            }
        });
        data.push(['Total Expense', '', parseFloat(t.total_expense).toFixed(2)]);
        data.push([]);
        
        data.push(['Closing Balance', parseFloat(t.closing_balance).toFixed(2)]);
        data.push([]);
        data.push([]);
    });
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Set column widths
    ws['!cols'] = [
        { wch: 35 }, // Category
        { wch: 18 }, // Payment Method
        { wch: 15 }  // Amount
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Detailed Report');
    
    // Download
    XLSX.writeFile(wb, `Financial_Report_Detailed_${fromDate}_to_${toDate}.xlsx`);
}

// Download as PDF
function downloadPDF(transactions, fromDate, toDate) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text('Financial Report - Detailed', 14, 20);
    
    // Date range
    doc.setFontSize(11);
    doc.text(`Date Range: ${fromDate} to ${toDate}`, 14, 30);
    
    // Calculate summary
    let totalIncome = 0;
    let totalExpense = 0;
    
    transactions.forEach(t => {
        totalIncome += parseFloat(t.total_income) || 0;
        totalExpense += parseFloat(t.total_expense) || 0;
    });
    
    const currentBalance = transactions.length > 0 ? parseFloat(transactions[0].closing_balance) : 0;
    
    // Summary table
    doc.autoTable({
        startY: 40,
        head: [['Summary', 'Amount (Rs.)']],
        body: [
            ['Total Income', totalIncome.toFixed(2)],
            ['Total Expenses', totalExpense.toFixed(2)],
            ['Current Balance', currentBalance.toFixed(2)]
        ],
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] }
    });
    
    // Income categories
    const incomeCategories = [
        { label: 'Room Rent', field: 'room_rent', method: 'room_rent_method' },
        { label: 'Mattress Charge', field: 'mattress_charge', method: 'mattress_charge_method' },
        { label: 'Travel/Cab', field: 'travel_cab', method: 'travel_cab_method' },
        { label: 'Kitchen Facility', field: 'kitchen_facility', method: 'kitchen_facility_method' },
        { label: 'Clean Charge', field: 'clean_charge', method: 'clean_charge_method' },
        { label: 'Misc Receipt', field: 'misc_receipt', method: 'misc_receipt_method' }
    ];
    
    // Expense categories
    const expenseCategories = [
        { label: 'Brokerage', field: 'brokerage', method: 'brokerage_method' },
        { label: 'Salary', field: 'salary', method: 'salary_method' },
        { label: 'Room Cleaning', field: 'room_cleaning_charge', method: 'room_cleaning_charge_method' },
        { label: 'Generator', field: 'generator_maintenance', method: 'generator_maintenance_method' },
        { label: 'Hotel Stationary', field: 'hotel_stationary', method: 'hotel_stationary_method' },
        { label: 'Cleaning', field: 'hotel_cleaning_sanitation', method: 'hotel_cleaning_sanitation_method' },
        { label: 'Rent & Taxes', field: 'rent_taxes', method: 'rent_taxes_method' },
        { label: 'TV Recharge', field: 'tv_recharge', method: 'tv_recharge_method' },
        { label: 'Camera/WiFi', field: 'camera_wifi', method: 'camera_wifi_method' },
        { label: 'Plumbing', field: 'plumbing_maintenance', method: 'plumbing_maintenance_method' },
        { label: 'Electricity Maint', field: 'electricity_maintenance', method: 'electricity_maintenance_method' },
        { label: 'Electricity Bill', field: 'electricity_bill', method: 'electricity_bill_method' },
        { label: 'Staff Fooding', field: 'staff_fooding', method: 'staff_fooding_method' },
        { label: 'Laundry', field: 'laundry', method: 'laundry_method' },
        { label: 'Owner Kitchen', field: 'owner_kitchen_cab', method: 'owner_kitchen_cab_method' },
        { label: 'Office Stationary', field: 'office_stationary', method: 'office_stationary_method' },
        { label: 'Misc Expenses', field: 'misc_expenses', method: 'misc_expenses_method' }
    ];
    
    let currentY = doc.lastAutoTable.finalY + 15;
    
    // Detailed transaction breakdown
    transactions.forEach((t, index) => {
        // Check if we need a new page
        if (currentY > 250) {
            doc.addPage();
            currentY = 20;
        }
        
        // Transaction header
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`Transaction #${index + 1} - ${new Date(t.date).toLocaleDateString()}`, 14, currentY);
        currentY += 7;
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Opening Balance: Rs. ${parseFloat(t.opening_balance).toFixed(2)}`, 14, currentY);
        currentY += 10;
        
        // Income table
        const incomeData = [];
        incomeCategories.forEach(cat => {
            const amount = parseFloat(t[cat.field]) || 0;
            if (amount > 0) {
                const method = t[cat.method] || '-';
                incomeData.push([cat.label, method.toUpperCase(), amount.toFixed(2)]);
            }
        });
        
        if (incomeData.length > 0) {
            doc.autoTable({
                startY: currentY,
                head: [['Income Category', 'Method', 'Amount (Rs.)']],

                body: incomeData,
                theme: 'striped',
                headStyles: { fillColor: [34, 197, 94] },
                margin: { left: 14 },
                tableWidth: 90
            });
            currentY = doc.lastAutoTable.finalY + 3;
            
            doc.setFont(undefined, 'bold');
            doc.text(`Total Income: Rs. ${parseFloat(t.total_income).toFixed(2)}`, 14, currentY);
            currentY += 10;
            doc.setFont(undefined, 'normal');
        }
        
        // Expense table
        const expenseData = [];
        expenseCategories.forEach(cat => {
            const amount = parseFloat(t[cat.field]) || 0;
            if (amount > 0) {
                const method = t[cat.method] || '-';
                expenseData.push([cat.label, method.toUpperCase(), amount.toFixed(2)]);
            }
        });
        
        if (expenseData.length > 0) {
            doc.autoTable({
                startY: currentY,
                head: [['Expense Category', 'Method', 'Amount (Rs.)']],

                body: expenseData,
                theme: 'striped',
                headStyles: { fillColor: [239, 68, 68] },
                margin: { left: 14 },
                tableWidth: 90
            });
            currentY = doc.lastAutoTable.finalY + 3;
            
            doc.setFont(undefined, 'bold');
            doc.text(`Total Expense: Rs. ${parseFloat(t.total_expense).toFixed(2)}`, 14, currentY);
            currentY += 7;
        }
        
        // Closing balance
        doc.setFont(undefined, 'bold');
        doc.text(`Closing Balance: Rs. ${parseFloat(t.closing_balance).toFixed(2)}`, 14, currentY);
        currentY += 15;
        doc.setFont(undefined, 'normal');
    });
    
    // Download
    doc.save(`Financial_Report_Detailed_${fromDate}_to_${toDate}.pdf`);
}

