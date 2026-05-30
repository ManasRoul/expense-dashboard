let employees = [];

// Load employees from settings and build the form
async function loadEmployees() {
    try {
        const res = await fetch('/api/settings?type=employee', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load employees');
        employees = await res.json();
        renderEmployeeCards();
    } catch (e) {
        document.getElementById('employeeCards').innerHTML = '<p class="loading-message">Error loading employees. <a href="settings.html">Add employees in Settings</a></p>';
    }
}

function renderEmployeeCards() {
    const container = document.getElementById('employeeCards');
    if (employees.length === 0) {
        container.innerHTML = '<p class="loading-message">No employees found. <a href="settings.html">Add employees in Settings</a></p>';
        return;
    }
    container.innerHTML = employees.map(emp => `
        <div class="employee-card">
            <h3>👤 ${emp.label}</h3>
            <div class="salary-inputs">
                <div class="input-row">
                    <label>Payment Type:</label>
                    <select id="${emp.key_id}Type">
                        <option value="">Select Type</option>
                        <option value="advance">Advance</option>
                        <option value="full">Full</option>
                    </select>
                </div>
                <div class="input-row">
                    <label>Payment Method:</label>
                    <select id="${emp.key_id}Method">
                        <option value="">Select Method</option>
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                    </select>
                </div>
                <div class="input-row">
                    <label>Amount (₹):</label>
                    <input type="number" id="${emp.key_id}Amount" step="0.01" placeholder="0.00" oninput="calculateTotal()">
                </div>
                <div class="input-row">
                    <label>Note:</label>
                    <input type="text" id="${emp.key_id}Note" placeholder="Optional note">
                </div>
            </div>
        </div>
    `).join('');
}

// Set default date to today
function setDefaultDate() {
    const dateInput = document.getElementById('salaryDate');
    const today = new Date();
    dateInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

// Calculate total salary
function calculateTotal() {
    let total = 0;
    for (const emp of employees) {
        total += parseFloat(document.getElementById(`${emp.key_id}Amount`).value) || 0;
    }
    document.getElementById('totalSalary').value = total.toFixed(2);
}

// Load salary records
async function loadSalaryRecords() {
    try {
        const response = await fetch('/api/salary-records', { credentials: 'include' });
        const records = await response.json();
        const tbody = document.getElementById('salaryTableBody');
        const userRole = localStorage.getItem('userRole');
        const isOwner = userRole === 'owner';

        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="loading-message">No salary records found</td></tr>';
            return;
        }

        tbody.innerHTML = records.map(record => {
            const date = new Date(record.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            return `<tr>
                <td>${date}</td>
                <td>${record.employee_count} Employee(s)</td>
                <td>₹${parseFloat(record.total_amount).toFixed(2)}</td>
                <td><button class="btn-view" onclick="viewSalaryDetails('${record.date}')">View Details</button></td>
                <td>${isOwner ? `<button class="btn-delete" onclick="deleteSalaryByDate('${record.date}')">🗑️ Delete</button>` : ''}</td>
            </tr>`;
        }).join('');
    } catch (error) {
        document.getElementById('salaryTableBody').innerHTML = '<tr><td colspan="5" class="loading-message">Error loading records</td></tr>';
    }
}

// View salary details
async function viewSalaryDetails(date) {
    try {
        const response = await fetch(`/api/salary-records/details/${date}`, { credentials: 'include' });
        const records = await response.json();

        let detailsHTML = '<div class="salary-details-grid">';
        records.forEach(record => {
            const typeBadge = record.payment_type.toLowerCase() === 'advance'
                ? '<span class="type-badge type-advance">Advance</span>'
                : '<span class="type-badge type-full">Full</span>';
            const methodBadge = record.payment_method.toLowerCase() === 'cash'
                ? '<span class="badge badge-cash">Cash</span>'
                : '<span class="badge badge-upi">UPI</span>';
            detailsHTML += `<div class="employee-detail-card">
                <h4>👤 ${record.employee_name}</h4>
                <div class="detail-row"><strong>Type:</strong> ${typeBadge}</div>
                <div class="detail-row"><strong>Amount:</strong> ₹${parseFloat(record.amount).toFixed(2)}</div>
                <div class="detail-row"><strong>Method:</strong> ${methodBadge}</div>
                <div class="detail-row"><strong>Note:</strong> ${record.note || '-'}</div>
            </div>`;
        });
        detailsHTML += '</div>';

        const totalAmount = records.reduce((sum, r) => sum + parseFloat(r.amount), 0);
        detailsHTML += `<div class="salary-total-summary"><strong>Total Amount Paid:</strong> ₹${totalAmount.toFixed(2)}</div>`;

        document.getElementById('salaryModalBody').innerHTML = detailsHTML;
        document.getElementById('salaryModalDate').textContent = new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        document.getElementById('salaryModal').style.display = 'flex';
    } catch (error) {
        alert('Error loading salary details');
    }
}

function closeSalaryModal() {
    document.getElementById('salaryModal').style.display = 'none';
}

window.addEventListener('click', function(event) {
    const modal = document.getElementById('salaryModal');
    if (event.target === modal) closeSalaryModal();
});

// Delete salary record
async function deleteSalaryByDate(date) {
    if (!confirm('Are you sure you want to delete all salary records for this date?')) return;
    try {
        const response = await fetch(`/api/salary-records/details/${date}`, { credentials: 'include' });
        const records = await response.json();
        for (const record of records) {
            await fetch(`/api/salary-records/${record.id}`, { method: 'DELETE', credentials: 'include' });
        }
        alert('Salary records deleted successfully!');
        loadSalaryRecords();
    } catch (error) {
        alert('Error deleting records. Please try again.');
    }
}

// Handle form submission
document.getElementById('salaryForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const salaryDate = document.getElementById('salaryDate').value;
    const records = [];

    for (const emp of employees) {
        const type = document.getElementById(`${emp.key_id}Type`).value;
        const amount = document.getElementById(`${emp.key_id}Amount`).value;
        const method = document.getElementById(`${emp.key_id}Method`).value;
        const note = document.getElementById(`${emp.key_id}Note`).value;

        if (amount && parseFloat(amount) > 0) {
            if (!type) { alert(`Please select payment type for ${emp.label}`); return; }
            if (!method) { alert(`Please select payment method for ${emp.label}`); return; }
            records.push({
                date: salaryDate,
                employeeName: emp.label,
                paymentType: type,
                amount: parseFloat(amount),
                paymentMethod: method,
                note: note
            });
        }
    }

    if (records.length === 0) { alert('Please enter at least one salary payment'); return; }

    try {
        const response = await fetch('/api/salary-records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ records })
        });
        const result = await response.json();
        if (response.ok) {
            alert(`${records.length} salary record(s) saved successfully!`);
            document.getElementById('salaryForm').reset();
            setDefaultDate();
            calculateTotal();
            loadSalaryRecords();
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert('Error connecting to server.');
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    setDefaultDate();
    await loadEmployees();
    loadSalaryRecords();
});
