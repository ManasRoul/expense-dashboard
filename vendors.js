let allVendors = [];

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/api/vendors/totals', { credentials: 'include' });
        if (res.status === 403) {
            document.getElementById('vendorsBody').innerHTML = '<tr><td colspan="4" class="loading-message">Vendor tracking is currently disabled by the owner.</td></tr>';
            return;
        }
        if (!res.ok) {
            document.getElementById('vendorsBody').innerHTML = '<tr><td colspan="4" class="loading-message">Failed to load vendors</td></tr>';
            return;
        }
        allVendors = await res.json();
        renderVendors();
    } catch (error) {
        console.error('Error loading vendors:', error);
        document.getElementById('vendorsBody').innerHTML = '<tr><td colspan="4" class="loading-message">Error loading vendors</td></tr>';
    }
});

function renderVendors() {
    const term = document.getElementById('vendorSearch').value.trim().toLowerCase();
    const filtered = term ? allVendors.filter(v => v.vendor.toLowerCase().includes(term)) : allVendors;

    const tbody = document.getElementById('vendorsBody');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading-message">No vendors found. Add a vendor/party name to a category entry to see it here.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map((v, i) => `
        <tr>
            <td><span class="rank-badge">${i + 1}</span></td>
            <td>${escapeHtml(v.vendor)}</td>
            <td class="negative">₹${v.total.toFixed(2)}</td>
            <td>${v.paymentCount}</td>
        </tr>
    `).join('');
}
