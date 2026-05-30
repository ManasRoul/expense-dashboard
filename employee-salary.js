// Load salary data for all employees
async function loadEmployeeSalaries() {
    try {
        // Single API call to get all salary records
        const response = await fetch('/api/salary-records/all', {
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Failed to fetch salary records');
        const allRecords = await response.json();

        // Group by employee - load employee list from settings
        let employeeNames = [];
        try {
            const empRes = await fetch('/api/settings?type=employee', { credentials: 'include' });
            const empData = await empRes.json();
            employeeNames = empData.map(e => e.label);
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

        displayEmployeeSalaries(employees);
    } catch (error) {
        console.error('Error loading salary data:', error);
        document.getElementById('employeesContainer').innerHTML = `
            <div class="no-records">
                Error loading salary records. Please try again.
            </div>
        `;
    }
}

// Store employee records for modal access
window._employeeRecords = {};

// Display employee salaries
function displayEmployeeSalaries(employees) {
    const container = document.getElementById('employeesContainer');
    
    // Store records globally for onclick access
    window._employeeRecords = employees;
    
    let html = '';

    for (const [employeeName, records] of Object.entries(employees)) {
        // Calculate totals
        const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);
        const advancePayments = records.filter(r => r.payment_type.toLowerCase() === 'advance');
        const fullPayments = records.filter(r => r.payment_type.toLowerCase() === 'full');
        const advanceTotal = advancePayments.reduce((sum, r) => sum + r.amount, 0);
        const fullTotal = fullPayments.reduce((sum, r) => sum + r.amount, 0);

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

                <button class="btn-details" onclick="viewEmployeeDetails('${employeeName}')">
                    📋 View All Details
                </button>
            </div>
        `;
    }

    container.innerHTML = html;
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
