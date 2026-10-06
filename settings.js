document.addEventListener('DOMContentLoaded', function() {
    if (localStorage.getItem('userRole') !== 'owner') {
        alert("You don't have the right access");
        window.location.href = 'home.html';
        return;
    }
    loadAllSettings();
});

async function loadAllSettings() {
    try {
        const res = await fetch('/api/settings', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load settings');
        const items = await res.json();

        renderList('employee', items.filter(i => i.type === 'employee'), 'employeeList');
        renderList('income_category', items.filter(i => i.type === 'income_category'), 'incomeCategoryList');
        renderList('expense_category', items.filter(i => i.type === 'expense_category'), 'expenseCategoryList');
    } catch (e) {
        console.error(e);
    }
}

function renderList(type, items, containerId) {
    const ul = document.getElementById(containerId);
    if (items.length === 0) {
        ul.innerHTML = '<li class="empty-msg">No items yet</li>';
        return;
    }
    ul.innerHTML = items.map(item => {
        let salaryDisplay = '';
        if (type === 'employee' && item.salary_amount > 0) {
            salaryDisplay = ` - <span style="color: #047857; font-weight: 600;">₹${parseFloat(item.salary_amount).toFixed(2)}/month</span>`;
        }
        return `
        <li>
            <span><span class="item-label">${item.label}</span><span class="item-key">(${item.key_id})</span>${salaryDisplay}</span>
            <span class="item-actions">
                <button class="btn-edit" data-id="${item.id}" data-label="${item.label.replace(/"/g, '&quot;')}" data-salary="${item.salary_amount || 0}">✏️</button>
                <button class="btn-del" data-id="${item.id}" data-label="${item.label.replace(/"/g, '&quot;')}">🗑️</button>
            </span>
        </li>
    `}).join('');

    ul.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => editItem(btn.dataset.id, btn.dataset.label, containerId, parseFloat(btn.dataset.salary)));
    });
    ul.querySelectorAll('.btn-del').forEach(btn => {
        btn.addEventListener('click', () => deleteItem(btn.dataset.id, btn.dataset.label));
    });
}

function generateKeyId(label) {
    // Convert "Room Rent" -> "roomRent", "Staff Fooding" -> "staffFooding"
    return label.trim()
        .split(/\s+/)
        .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('')
        .replace(/[^a-zA-Z0-9]/g, '');
}

async function addItem(type) {
    let inputId, label;
    if (type === 'employee') inputId = 'newEmployeeName';
    else if (type === 'income_category') inputId = 'newIncomeName';
    else inputId = 'newExpenseName';

    const input = document.getElementById(inputId);
    label = input.value.trim();
    if (!label) { alert('Please enter a name'); return; }

    const key_id = type === 'employee' ? label.toLowerCase().replace(/\s+/g, '') : generateKeyId(label);

    // For employees, also get the salary amount
    let salary_amount = 0;
    if (type === 'employee') {
        const salaryInput = document.getElementById('newEmployeeSalary');
        salary_amount = parseFloat(salaryInput.value) || 0;
        if (salary_amount < 0) {
            alert('Salary amount must be positive');
            return;
        }
    }

    try {
        const body = { type, key_id, label };
        if (type === 'employee') {
            body.salary_amount = salary_amount;
        }
        
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) { alert(data.error); return; }
        input.value = '';
        if (type === 'employee') {
            document.getElementById('newEmployeeSalary').value = '';
        }
        loadAllSettings();
    } catch (e) {
        alert('Error adding item');
    }
}

async function editItem(id, currentLabel, containerId, currentSalary) {
    const newLabel = prompt('Edit name:', currentLabel);
    if (!newLabel || newLabel.trim() === currentLabel) {
        // Check if salary was updated for employees
        if (containerId === 'employeeList') {
            const newSalary = prompt('Edit monthly salary (₹):', currentSalary);
            if (newSalary === null) return;
            
            const salaryAmount = parseFloat(newSalary) || 0;
            if (salaryAmount < 0) {
                alert('Salary amount must be positive');
                return;
            }
            
            try {
                const res = await fetch(`/api/settings/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ salary_amount: salaryAmount })
                });
                if (!res.ok) { alert('Error updating'); return; }
                loadAllSettings();
            } catch (e) {
                alert('Error updating item');
            }
        }
        return;
    }

    // Also prompt for salary if this is an employee
    let updateData = { label: newLabel.trim() };
    if (containerId === 'employeeList') {
        const newSalary = prompt('Edit monthly salary (₹):', currentSalary);
        if (newSalary !== null) {
            const salaryAmount = parseFloat(newSalary) || 0;
            if (salaryAmount < 0) {
                alert('Salary amount must be positive');
                return;
            }
            updateData.salary_amount = salaryAmount;
        }
    }

    try {
        const res = await fetch(`/api/settings/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(updateData)
        });
        if (!res.ok) { alert('Error updating'); return; }
        loadAllSettings();
    } catch (e) {
        alert('Error updating item');
    }
}

async function deleteItem(id, label) {
    if (!confirm(`Remove "${label}"? This won't delete historical data.`)) return;

    try {
        const res = await fetch(`/api/settings/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!res.ok) { alert('Error removing'); return; }
        loadAllSettings();
    } catch (e) {
        alert('Error removing item');
    }
}
