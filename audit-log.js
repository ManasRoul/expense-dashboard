let allAuditEntries = [];

// Escape untrusted text before inserting into innerHTML - audit details can contain
// attacker-controlled input (e.g. a login attempt's submitted username)
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/api/audit-log', { credentials: 'include' });
        if (res.status === 403) {
            document.getElementById('auditDisabledMsg').style.display = '';
            return;
        }
        if (!res.ok) {
            document.getElementById('auditContent').style.display = '';
            document.getElementById('auditLogBody').innerHTML = '<tr><td colspan="6" class="loading-message">Failed to load audit log</td></tr>';
            return;
        }

        allAuditEntries = await res.json();
        document.getElementById('auditContent').style.display = '';
        populateActionFilter();
        renderAuditLog();
    } catch (error) {
        console.error('Error loading audit log:', error);
        document.getElementById('auditContent').style.display = '';
        document.getElementById('auditLogBody').innerHTML = '<tr><td colspan="6" class="loading-message">Error loading audit log</td></tr>';
    }
});

function populateActionFilter() {
    const select = document.getElementById('auditActionFilter');
    const actions = [...new Set(allAuditEntries.map(e => e.action))].sort();
    select.innerHTML = '<option value="">All Actions</option>' + actions.map(a => `<option value="${a}">${a}</option>`).join('');
}

function renderAuditLog() {
    const searchTerm = document.getElementById('auditSearch').value.trim().toLowerCase();
    const actionFilter = document.getElementById('auditActionFilter').value;
    const resultFilter = document.getElementById('auditResultFilter').value;

    let filtered = allAuditEntries;

    if (actionFilter) {
        filtered = filtered.filter(e => e.action === actionFilter);
    }
    if (resultFilter) {
        filtered = filtered.filter(e => (resultFilter === 'success') === !!e.success);
    }
    if (searchTerm) {
        filtered = filtered.filter(e => {
            const haystack = `${e.username || ''} ${e.action || ''} ${JSON.stringify(e.details || {})}`.toLowerCase();
            return haystack.includes(searchTerm);
        });
    }

    const tbody = document.getElementById('auditLogBody');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-message">No matching entries</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(e => `
        <tr>
            <td>${e.timestamp ? new Date(e.timestamp).toLocaleString() : '-'}</td>
            <td>${escapeHtml(e.username || '-')}</td>
            <td>${escapeHtml(e.action || '-')}</td>
            <td><span class="result-badge ${e.success ? 'success' : 'fail'}">${e.success ? '✅ Success' : '❌ Failed'}</span></td>
            <td>${escapeHtml(e.ip || '-')}</td>
            <td class="details-cell">${formatDetails(e.details)}</td>
        </tr>
    `).join('');
}

function formatDetails(details) {
    if (!details || Object.keys(details).length === 0) return '-';
    return Object.entries(details).map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(v)}`).join(', ');
}
