// Load dashboard data on page load
document.addEventListener('DOMContentLoaded', () => {
    loadDashboardData();
    loadRecentTransactions();
});

// Load dashboard balances
async function loadDashboardData() {
    try {
        const response = await fetch('http://localhost:5000/api/dashboard/balances');
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
async function loadRecentTransactions() {
    try {
        const response = await fetch('http://localhost:5000/api/transactions');
        const transactions = await response.json();

        const tbody = document.getElementById('transactionsBody');
        
        if (transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="loading-message">No transactions found</td></tr>';
            return;
        }

        // Store transactions globally for detail view
        window.allTransactions = transactions;
        
        // Check if user is owner
        const userRole = localStorage.getItem('userRole');
        const isOwner = userRole === 'owner';

        tbody.innerHTML = transactions.map(transaction => `
            <tr>
                <td>${new Date(transaction.date).toLocaleString()}</td>
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
        { label: 'Room Rent', amount: 'room_rent', method: 'room_rent_method' },
        { label: 'Mattress Charge', amount: 'mattress_charge', method: 'mattress_charge_method' },
        { label: 'Travel/Cab Service', amount: 'travel_cab', method: 'travel_cab_method' },
        { label: 'Kitchen Facility', amount: 'kitchen_facility', method: 'kitchen_facility_method' },
        { label: 'Clean Charge', amount: 'clean_charge', method: 'clean_charge_method' },
        { label: 'Misc Receipt', amount: 'misc_receipt', method: 'misc_receipt_method' }
    ];

    const expenseItems = [
        { label: 'Brokerage', amount: 'brokerage', method: 'brokerage_method' },
        { label: 'Salary', amount: 'salary', method: 'salary_method' },
        { label: 'Room Cleaning Charge', amount: 'room_cleaning_charge', method: 'room_cleaning_charge_method' },
        { label: 'Generator & Maintenance', amount: 'generator_maintenance', method: 'generator_maintenance_method' },
        { label: 'Hotel Stationary', amount: 'hotel_stationary', method: 'hotel_stationary_method' },
        { label: 'Hotel Cleaning & Sanitation', amount: 'hotel_cleaning_sanitation', method: 'hotel_cleaning_sanitation_method' },
        { label: 'Rent & Taxes', amount: 'rent_taxes', method: 'rent_taxes_method' },
        { label: 'TV Recharge', amount: 'tv_recharge', method: 'tv_recharge_method' },
        { label: 'Camera/WiFi', amount: 'camera_wifi', method: 'camera_wifi_method' },
        { label: 'Plumbing & Maintenance', amount: 'plumbing_maintenance', method: 'plumbing_maintenance_method' },
        { label: 'Electricity & Maintenance', amount: 'electricity_maintenance', method: 'electricity_maintenance_method' },
        { label: 'Electricity Bill', amount: 'electricity_bill', method: 'electricity_bill_method' },
        { label: 'Staff Fooding', amount: 'staff_fooding', method: 'staff_fooding_method' },
        { label: 'Laundry', amount: 'laundry', method: 'laundry_method' },
        { label: 'Owner Kitchen & Cab Payment', amount: 'owner_kitchen_cab', method: 'owner_kitchen_cab_method' },
        { label: 'Office Stationary', amount: 'office_stationary', method: 'office_stationary_method' },
        { label: 'Misc Expenses', amount: 'misc_expenses', method: 'misc_expenses_method' }
    ];

    let incomeHTML = '<table class="detail-table"><thead><tr><th>Income Source</th><th>Payment Method</th><th>Amount</th></tr></thead><tbody>';
    incomeItems.forEach(item => {
        const amount = parseFloat(transaction[item.amount]) || 0;
        const method = transaction[item.method] || '-';
        if (amount > 0) {
            const methodBadge = method === 'cash' ? '<span class="badge badge-cash">Cash</span>' : 
                              method === 'upi' ? '<span class="badge badge-upi">UPI</span>' : '-';
            incomeHTML += `<tr><td>${item.label}</td><td>${methodBadge}</td><td class="positive">₹${amount.toFixed(2)}</td></tr>`;
        }
    });
    incomeHTML += '</tbody></table>';

    let expenseHTML = '<table class="detail-table"><thead><tr><th>Expense Source</th><th>Payment Method</th><th>Amount</th></tr></thead><tbody>';
    expenseItems.forEach(item => {
        const amount = parseFloat(transaction[item.amount]) || 0;
        const method = transaction[item.method] || '-';
        if (amount > 0) {
            const methodBadge = method === 'cash' ? '<span class="badge badge-cash">Cash</span>' : 
                              method === 'upi' ? '<span class="badge badge-upi">UPI</span>' : '-';
            expenseHTML += `<tr><td>${item.label}</td><td>${methodBadge}</td><td class="negative">₹${amount.toFixed(2)}</td></tr>`;
        }
    });
    expenseHTML += '</tbody></table>';

    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="detail-section">
            <p><strong>Date:</strong> ${new Date(transaction.date).toLocaleString()}</p>
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
    `;

    document.getElementById('transactionModal').style.display = 'flex';
}

// Close modal
function closeModal() {
    document.getElementById('transactionModal').style.display = 'none';
}

// Delete transaction (owner only)
async function deleteTransaction(id) {
    if (!confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`http://localhost:5000/api/transactions/${id}`, {
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
window.onclick = function(event) {
    const modal = document.getElementById('transactionModal');
    const downloadModal = document.getElementById('downloadModal');
    if (event.target === modal) {
        closeModal();
    }
    if (event.target === downloadModal) {
        closeDownloadModal();
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
        // Fetch transactions for the date range
        const response = await fetch('http://localhost:5000/api/transactions');
        const allTransactions = await response.json();
        
        // Filter transactions by date range
        const filteredTransactions = allTransactions.filter(t => {
            const transactionDate = new Date(t.date).toISOString().split('T')[0];
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
    data.push(['Financial Report']);
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
    
    // Add transaction details header
    data.push(['Date', 'Opening Balance', 'Total Income', 'Total Expense', 'Closing Balance']);
    
    // Add transactions
    transactions.forEach(t => {
        data.push([
            new Date(t.date).toLocaleString(),
            parseFloat(t.opening_balance).toFixed(2),
            parseFloat(t.total_income).toFixed(2),
            parseFloat(t.total_expense).toFixed(2),
            parseFloat(t.closing_balance).toFixed(2)
        ]);
    });
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Set column widths
    ws['!cols'] = [
        { wch: 25 }, // Date
        { wch: 15 }, // Opening Balance
        { wch: 15 }, // Total Income
        { wch: 15 }, // Total Expense
        { wch: 15 }  // Closing Balance
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Financial Report');
    
    // Download
    XLSX.writeFile(wb, `Financial_Report_${fromDate}_to_${toDate}.xlsx`);
}

// Download as PDF
function downloadPDF(transactions, fromDate, toDate) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text('Financial Report', 14, 20);
    
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
        head: [['Summary', 'Amount (₹)']],
        body: [
            ['Total Income', totalIncome.toFixed(2)],
            ['Total Expenses', totalExpense.toFixed(2)],
            ['Current Balance', currentBalance.toFixed(2)]
        ],
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] }
    });
    
    // Transaction details table
    const tableData = transactions.map(t => [
        new Date(t.date).toLocaleDateString(),
        parseFloat(t.opening_balance).toFixed(2),
        parseFloat(t.total_income).toFixed(2),
        parseFloat(t.total_expense).toFixed(2),
        parseFloat(t.closing_balance).toFixed(2)
    ]);
    
    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Date', 'Opening Balance', 'Income', 'Expense', 'Closing Balance']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] }
    });
    
    // Download
    doc.save(`Financial_Report_${fromDate}_to_${toDate}.pdf`);
}

