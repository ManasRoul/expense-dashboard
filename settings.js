// Escape untrusted text (labels, etc.) before inserting into innerHTML
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', function() {
    if (localStorage.getItem('userRole') !== 'owner') {
        alert("You don't have the right access");
        window.location.href = 'home.html';
        return;
    }
    loadAllSettings();
});

let lowBalanceThresholdId = null;

const FEATURE_FLAGS = [
    { key_id: 'feature_created_by_tracking', label: 'Track who created/edited transactions' },
    { key_id: 'feature_audit_log', label: 'Audit Log Page' },
    { key_id: 'feature_receipts', label: 'Receipt Attachments' }
];

async function loadAllSettings() {
    try {
        const res = await fetch('/api/settings', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load settings');
        const items = await res.json();

        renderList('employee', items.filter(i => i.type === 'employee'), 'employeeList');
        renderList('income_category', items.filter(i => i.type === 'income_category'), 'incomeCategoryList');
        renderList('expense_category', items.filter(i => i.type === 'expense_category'), 'expenseCategoryList');

        const thresholdSetting = items.find(i => i.type === 'app_config' && i.key_id === 'low_balance_threshold');
        if (thresholdSetting) {
            lowBalanceThresholdId = thresholdSetting.id;
            document.getElementById('lowBalanceThreshold').value = thresholdSetting.salary_amount;
        }

        renderFeatureToggles(items.filter(i => i.type === 'app_config'));
    } catch (e) {
        console.error(e);
    }
}

function renderFeatureToggles(appConfigItems) {
    const ul = document.getElementById('featureTogglesList');
    ul.innerHTML = FEATURE_FLAGS.map(flag => {
        const item = appConfigItems.find(i => i.key_id === flag.key_id);
        const enabled = item ? Number(item.salary_amount) !== 0 : true;
        return `
        <li>
            <span class="item-label">${escapeHtml(flag.label)}</span>
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                <input type="checkbox" data-id="${item ? item.id : ''}" data-key="${flag.key_id}" ${enabled ? 'checked' : ''} onchange="toggleFeatureFlag(this)">
                ${enabled ? 'On' : 'Off'}
            </label>
        </li>`;
    }).join('');

    const auditLogItem = appConfigItems.find(i => i.key_id === 'feature_audit_log');
    const auditLogEnabled = auditLogItem ? Number(auditLogItem.salary_amount) !== 0 : true;
    document.getElementById('auditLogLink').style.display = auditLogEnabled ? '' : 'none';
}

async function toggleFeatureFlag(checkbox) {
    const id = checkbox.dataset.id;
    if (!id) {
        alert('This feature flag was not found in settings yet. Please refresh and try again.');
        checkbox.checked = !checkbox.checked;
        return;
    }
    try {
        const res = await fetch(`/api/settings/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ salary_amount: checkbox.checked ? 1 : 0 })
        });
        if (!res.ok) {
            const data = await res.json();
            alert(data.error || 'Failed to update feature');
            checkbox.checked = !checkbox.checked;
            return;
        }
        await loadAllSettings();
    } catch (e) {
        console.error(e);
        alert('Error updating feature');
        checkbox.checked = !checkbox.checked;
    }
}

async function saveLowBalanceThreshold() {
    const value = parseFloat(document.getElementById('lowBalanceThreshold').value);
    if (isNaN(value) || value < 0) {
        alert('Please enter a valid non-negative amount');
        return;
    }
    if (!lowBalanceThresholdId) {
        alert('Threshold setting not loaded yet, please refresh and try again');
        return;
    }
    try {
        const res = await fetch(`/api/settings/${lowBalanceThresholdId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ salary_amount: value })
        });
        if (res.ok) {
            alert('Low balance threshold saved!');
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to save threshold');
        }
    } catch (e) {
        console.error(e);
        alert('Error saving threshold');
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
            <span><span class="item-label">${escapeHtml(item.label)}</span><span class="item-key">(${escapeHtml(item.key_id)})</span>${salaryDisplay}</span>
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
    // Convert "Room Rent" -> "room_rent", "Staff Fooding!!" -> "staff_fooding"
    // Must stay snake_case: server.py creates the DB column using this value
    // verbatim, and a camelCase key_id previously caused "Unknown column" errors
    // when saving an amount (the write path expected snake_case).
    return label.trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
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
        const rawSalary = salaryInput.value.trim();
        if (rawSalary !== '') {
            salary_amount = parseFloat(rawSalary);
            if (isNaN(salary_amount)) {
                alert(`"${rawSalary}" is not a valid salary amount`);
                return;
            }
            if (salary_amount < 0) {
                alert('Salary amount must be positive');
                return;
            }
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

// Parses a prompt()'d salary string. Returns null (and alerts) if invalid,
// otherwise the validated number - never silently coerces bad input to 0.
function parseSalaryPrompt(value) {
    const trimmed = value.trim();
    const amount = parseFloat(trimmed);
    if (trimmed === '' || isNaN(amount)) {
        alert(`"${value}" is not a valid number`);
        return null;
    }
    if (amount < 0) {
        alert('Salary amount must be positive');
        return null;
    }
    return amount;
}

async function editItem(id, currentLabel, containerId, currentSalary) {
    const newLabel = prompt('Edit name:', currentLabel);
    const labelChanged = newLabel !== null && newLabel.trim() !== '' && newLabel.trim() !== currentLabel;

    let updateData = {};
    if (labelChanged) {
        updateData.label = newLabel.trim();
    }

    if (containerId === 'employeeList') {
        const newSalary = prompt('Edit monthly salary (₹):', currentSalary);
        if (newSalary !== null) {
            const salaryAmount = parseSalaryPrompt(newSalary);
            if (salaryAmount === null) {
                // Invalid salary shouldn't discard an already-valid label edit
                if (!labelChanged) return;
            } else {
                updateData.salary_amount = salaryAmount;
            }
        }
    }

    if (Object.keys(updateData).length === 0) return;

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
