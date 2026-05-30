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
    ul.innerHTML = items.map(item => `
        <li>
            <span><span class="item-label">${item.label}</span><span class="item-key">(${item.key_id})</span></span>
            <span class="item-actions">
                <button class="btn-edit" data-id="${item.id}" data-label="${item.label.replace(/"/g, '&quot;')}">✏️</button>
                <button class="btn-del" data-id="${item.id}" data-label="${item.label.replace(/"/g, '&quot;')}">🗑️</button>
            </span>
        </li>
    `).join('');

    ul.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => editItem(btn.dataset.id, btn.dataset.label));
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

    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ type, key_id, label })
        });
        const data = await res.json();
        if (!res.ok) { alert(data.error); return; }
        input.value = '';
        loadAllSettings();
    } catch (e) {
        alert('Error adding item');
    }
}

async function editItem(id, currentLabel) {
    const newLabel = prompt('Edit name:', currentLabel);
    if (!newLabel || newLabel.trim() === currentLabel) return;

    try {
        const res = await fetch(`/api/settings/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ label: newLabel.trim() })
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
