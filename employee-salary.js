// Global state
let currentViewMode = 'overall';
let allEmployeesData = {};
let employeeSettings = {};
let selectedMonth = null;

// Load salary data for all employees
async function loadEmployeeSalaries() {
    try {
        // Fetch salary records
        const response = await fetch('/api/salary-records/all', {
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Failed to fetch salary records');
        const allRecords = await response.json();

        // Fetch employee settings (with salary_amount)
        let employeeNames = [];
        try {
            const empRes = await fetch('/api/settings?type=employee', { credentials: 'include' });
            const empData = await empRes.json();
            employeeNames = empData.map(e => e.label);
            
            // Store employee settings by name for easy lookup
            empData.forEach(emp => {
                employeeSettings[emp.label] = emp;
            });
        } catch (e) {
            employeeNames = ['Shakti', 'Kabu', 'Kiran', 'Purna'];
        }

        const employees = {};
        employeeNames.forEach(name => { employees[name] = []; });

        allRecords.forEach(record => {
            if (!employees[record.employee_name]) {
                employees[record.employee_name] = [];
            }
            employees[record.employee_name].push(record);
        });

        allEmployeesData = employees;
        window._employeeRecords = employees;
        displayEmployeeSalaries(employees);
        setupMonthSelector();
    } catch (error) {
        console.error('Error loading salary data:', error);
        document.getElementById('employeesContainer').innerHTML = `
            <div class="no-records">
                Error loading salary records. Please try again.
            </div>
        `;
    }
}

// Refresh salary data
function refreshSalaryData() {
    console.log('Refreshing salary data...');
    loadEmployeeSalaries();
}

// Store employee records for modal access
window._employeeRecords = {};

// Switch between view modes
function switchViewMode(mode) {
    currentViewMode = mode;
    selectedMonth = null;
    
    // Update button states
    document.getElementById('btnOverall').classList.toggle('active', mode === 'overall');
    document.getElementById('btnMonthly').classList.toggle('active', mode === 'monthly');
    
    // Show/hide month selector
    document.getElementById('monthSelector').style.display = mode === 'monthly' ? 'block' : 'none';
    
    // Update display
    if (mode === 'overall') {
        displayEmployeeSalaries(allEmployeesData);
    } else {
        displayEmployeeSalariesByMonth(allEmployeesData);
    }
}

// Setup month selector with default values
function setupMonthSelector() {
    const monthInput = document.getElementById('monthInput');
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    monthInput.value = `${year}-${month}`;
}

// Apply month filter
function applyMonthFilter() {
    const monthInput = document.getElementById('monthInput');
    selectedMonth = monthInput.value;
    displayEmployeeSalariesByMonth(allEmployeesData, selectedMonth);
}

// Clear month filter
function clearMonthFilter() {
    selectedMonth = null;
    const monthInput = document.getElementById('monthInput');
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    monthInput.value = `${year}-${month}`;
    displayEmployeeSalariesByMonth(allEmployeesData);
}

// Display employee salaries
function displayEmployeeSalaries(employees) {
    const container = document.getElementById('employeesContainer');
    
    // Store records globally for onclick access
    window._employeeRecords = employees;
    
    let html = '';

    for (const [employeeName, records] of Object.entries(employees)) {
        // Get employee salary from settings
        const empSettings = employeeSettings[employeeName] || {};
        const monthlySalary = empSettings.salary_amount || 0;
        
        // Calculate totals
        const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);
        const advancePayments = records.filter(r => r.payment_type.toLowerCase() === 'advance');
        const fullPayments = records.filter(r => r.payment_type.toLowerCase() === 'full');
        const advanceTotal = advancePayments.reduce((sum, r) => sum + r.amount, 0);
        const fullTotal = fullPayments.reduce((sum, r) => sum + r.amount, 0);
        
        // Calculate remaining (salary - advances - full payments)
        const remaining = monthlySalary - advanceTotal - fullTotal;
        const remainingColor = remaining >= 0 ? '#10b981' : '#ef4444';

        html += `
            <div class="employee-section">
                <div class="employee-header">
                    <h2>${employeeName}</h2>
                    <span style="color: #64748b; font-size: 0.9em;">${records.length} Payment(s)</span>
                </div>

                <div class="total-earned">
                    <div class="label">Total Salary Received</div>
                    <div class="amount">Rs. ${totalAmount.toFixed(2)}</div>
                </div>

                <div class="payment-summary">
                    <div class="summary-card advance">
                        <div class="type">Advance Payments</div>
                        <div class="value">Rs. ${advanceTotal.toFixed(2)}</div>
                        <div style="color: #64748b; font-size: 0.85em; margin-top: 5px;">
                            ${advancePayments.length} payment(s)
                        </div>
                    </div>
                    <div class="summary-card full">
                        <div class="type">Full Payments</div>
                        <div class="value">Rs. ${fullTotal.toFixed(2)}</div>
                        <div style="color: #64748b; font-size: 0.85em; margin-top: 5px;">
                            ${fullPayments.length} payment(s)
                        </div>
                    </div>
                </div>

                ${monthlySalary > 0 ? `
                    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fcd34d 100%); padding: 15px 20px; border-radius: 10px; border-left: 4px solid #f59e0b; margin-top: 15px;">
                        <div style="color: #92400e; font-size: 0.9em; font-weight: 600; margin-bottom: 8px;">Monthly Salary & Remaining</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div style="text-align: center;">
                                <div style="font-size: 0.85em; color: #b45309;">Set Salary</div>
                                <div style="font-size: 1.3em; font-weight: 700; color: #92400e;">Rs. ${monthlySalary.toFixed(2)}</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 0.85em; color: #b45309;">Remaining</div>
                                <div style="font-size: 1.3em; font-weight: 700; color: ${remainingColor};">Rs. ${remaining.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>
                ` : ''}

                <button class="btn-details" onclick="viewEmployeeDetails('${employeeName}')">
                    📋 View All Details
                </button>
            </div>
        `;
    }

    container.innerHTML = html;
}

// Display employee salaries grouped by month
function displayEmployeeSalariesByMonth(employees, filterMonth = null) {
    const container = document.getElementById('employeesContainer');
    let html = '<div class="monthly-grid">';

    for (const [employeeName, records] of Object.entries(employees)) {
        // Get employee salary from settings
        const empSettings = employeeSettings[employeeName] || {};
        const monthlySalary = empSettings.salary_amount || 0;
        
        // Group records by month
        const monthlyData = {};
        
        records.forEach(record => {
            const date = new Date(record.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            // Filter by selected month if provided
            if (filterMonth && monthKey !== filterMonth) {
                return;
            }
            
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = [];
            }
            monthlyData[monthKey].push(record);
        });

        // Sort months in chronological order (oldest first) for carryover calculation
        const allMonths = Object.keys(monthlyData).sort();
        
        // Calculate carryover balances
        let previousBalance = 0;
        const monthlyBalances = {};
        
        allMonths.forEach(monthKey => {
            const monthRecords = monthlyData[monthKey];
            const advanceTotal = monthRecords.filter(r => r.payment_type.toLowerCase() === 'advance')
                .reduce((sum, r) => sum + r.amount, 0);
            const fullTotal = monthRecords.filter(r => r.payment_type.toLowerCase() === 'full')
                .reduce((sum, r) => sum + r.amount, 0);
            
            // Current month balance = Previous balance + Monthly salary - Current advances - Full payments
            const currentBalance = previousBalance + monthlySalary - advanceTotal - fullTotal;
            monthlyBalances[monthKey] = { previous: previousBalance, current: currentBalance, advances: advanceTotal };
            previousBalance = currentBalance;
        });

        // Sort months in descending order for display (newest first)
        const sortedMonths = allMonths.reverse();

        // Display each month's data for this employee
        sortedMonths.forEach(monthKey => {
            const monthRecords = monthlyData[monthKey];
            const [year, month] = monthKey.split('-');
            const monthName = new Date(year, parseInt(month) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            
            // Get balance info for this month
            const balanceInfo = monthlyBalances[monthKey];
            const advanceTotal = balanceInfo.advances;
            const currentBalance = balanceInfo.current;
            const previousBalance = balanceInfo.previous;
            
            // Determine color based on balance
            const balanceColor = currentBalance >= 0 ? '#10b981' : '#ef4444';
            const salaryDisplay = monthlySalary > 0 ? `Rs. ${monthlySalary.toFixed(2)}` : 'Not Set';
            
            // Build payment list HTML
            let paymentsHTML = '';
            monthRecords.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(payment => {
                const paymentDate = new Date(payment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const typeBadge = payment.payment_type.toLowerCase();
                paymentsHTML += `
                    <div class="month-payment-row">
                        <span class="month-payment-date">${paymentDate}</span>
                        <span class="month-payment-type ${typeBadge}">${payment.payment_type}</span>
                        <span class="month-payment-amount">Rs. ${parseFloat(payment.amount).toFixed(2)}</span>
                    </div>
                `;
            });

            // Build carryover info HTML
            let carryoverHTML = '';
            if (previousBalance !== 0) {
                const carryoverColor = previousBalance >= 0 ? '#10b981' : '#ef4444';
                const carryoverLabel = previousBalance >= 0 ? 'Carried Forward (Credit)' : 'Carried Forward (Debt)';
                carryoverHTML = `
                    <div style="background: #f0fdf4; padding: 10px; border-radius: 6px; margin-bottom: 10px; border-left: 3px solid ${carryoverColor};">
                        <div style="font-size: 0.8em; color: #059669; font-weight: 600; margin-bottom: 3px;">📌 ${carryoverLabel}</div>
                        <div style="font-size: 1.1em; font-weight: 700; color: ${carryoverColor};">Rs. ${previousBalance.toFixed(2)}</div>
                    </div>
                `;
            }

            html += `
                <div class="month-summary">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <div class="month-summary-header" style="margin-bottom: 0; border-bottom: none;">
                            👤 ${employeeName}
                        </div>
                        <span style="color: #64748b; font-size: 0.9em; background: #f0f9ff; padding: 4px 12px; border-radius: 20px;">
                            ${monthRecords.length} payment(s)
                        </span>
                    </div>
                    
                    <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0;">
                        <div style="color: #64748b; font-size: 0.9em; font-weight: 600; margin-bottom: 5px;">📅 ${monthName}</div>
                    </div>
                    
                    ${carryoverHTML}
                    
                    <div class="month-summary-stats">
                        <div class="month-stat-item">
                            <div class="month-stat-label">Monthly Salary</div>
                            <div class="month-stat-value" style="color: #3b82f6;">${salaryDisplay}</div>
                        </div>
                        <div class="month-stat-item">
                            <div class="month-stat-label">Advances</div>
                            <div class="month-stat-value" style="color: #f59e0b;">Rs. ${advanceTotal.toFixed(2)}</div>
                        </div>
                        <div class="month-stat-item">
                            <div class="month-stat-label">Remaining</div>
                            <div class="month-stat-value" style="color: ${balanceColor};">Rs. ${currentBalance.toFixed(2)}</div>
                        </div>
                    </div>

                    <div class="month-payments-list">
                        ${paymentsHTML}
                    </div>
                </div>
            `;
        });
    }

    html += '</div>';
    container.innerHTML = html || '<div class="no-records">No salary records found for this period.</div>';
}

// View employee details in modal
function viewEmployeeDetails(employeeName) {
    const records = window._employeeRecords[employeeName] || [];
    const modal = document.getElementById('employeeDetailsModal');
    const modalTitle = document.getElementById('modalEmployeeName');
    const tableBody = document.getElementById('employeeDetailsTableBody');

    // Set modal title
    modalTitle.textContent = `${employeeName} - Salary Details`;

    // Sort records by date (newest first)
    const sortedRecords = records.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Build table rows
    let tableHTML = '';
    sortedRecords.forEach(record => {
        tableHTML += `
            <tr>
                <td>${formatDate(record.date)}</td>
                <td>
                    <span class="payment-type-badge ${record.payment_type.toLowerCase()}">
                        ${record.payment_type}
                    </span>
                </td>
                <td style="color: #047857; font-weight: 700;">Rs. ${record.amount.toFixed(2)}</td>
                <td>
                    <span class="payment-method-badge ${record.payment_method.toLowerCase()}">
                        ${record.payment_method}
                    </span>
                </td>
                <td style="color: #64748b; font-style: italic;">${record.note || '-'}</td>
            </tr>
        `;
    });

    tableBody.innerHTML = tableHTML;

    // Show modal
    modal.style.display = 'flex';
}

// Close employee modal
function closeEmployeeModal() {
    document.getElementById('employeeDetailsModal').style.display = 'none';
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('employeeDetailsModal');
    if (event.target === modal) {
        closeEmployeeModal();
    }
});

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// Load data on page load
document.addEventListener('DOMContentLoaded', loadEmployeeSalaries);
