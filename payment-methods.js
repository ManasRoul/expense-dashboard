function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
}

// escapeHtml() only escapes &/</> (safe for text content) - attribute values
// also need quotes escaped, since a label containing one could otherwise break
// out of the data-* attribute this is used for.
function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Cycled per card by index so any number of methods gets a distinct accent
// color, reusing the same palette as the dashboard's Cash/UPI/Total cards.
const CARD_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/api/payment-methods/totals', { credentials: 'include' });
        if (!res.ok) {
            document.getElementById('paymentMethodsGrid').innerHTML = '<p class="loading-message">Failed to load payment method totals</p>';
            return;
        }
        const methods = await res.json();
        renderPaymentMethods(methods);
    } catch (error) {
        console.error('Error loading payment method totals:', error);
        document.getElementById('paymentMethodsGrid').innerHTML = '<p class="loading-message">Error loading payment method totals</p>';
    }
});

function renderPaymentMethods(methods) {
    const grid = document.getElementById('paymentMethodsGrid');
    if (methods.length === 0) {
        grid.innerHTML = '<p class="loading-message">No payment methods found. Add one in Settings.</p>';
        return;
    }

    grid.innerHTML = methods.map((m, i) => {
        const color = CARD_COLORS[i % CARD_COLORS.length];
        return `
        <div class="stat-card method-card" style="border-left: 5px solid ${color}; cursor: pointer;" data-key-id="${escapeAttr(m.key_id)}" data-label="${escapeAttr(m.label)}">
            <div class="card-icon">${escapeHtml(m.icon || '🏦')}</div>
            <div class="card-content">
                <h3>${escapeHtml(m.label)}</h3>
                <div class="balance-amount" style="color: ${m.net >= 0 ? '#1e293b' : '#ef4444'};">₹${m.net.toFixed(2)}</div>
                <div class="balance-details">
                    <span class="income-text">Income: ₹${m.income.toFixed(2)}</span>
                    <span class="expense-text">Expense: ₹${m.expense.toFixed(2)}</span>
                </div>
            </div>
        </div>
    `;
    }).join('');

    grid.querySelectorAll('.method-card').forEach(card => {
        card.addEventListener('click', () => openMethodTransactionsModal(card.dataset.keyId, card.dataset.label));
    });
}

let currentMethodLabel = '';

async function openMethodTransactionsModal(keyId, label) {
    currentMethodLabel = label;
    document.getElementById('methodTransactionsTitle').textContent = `${label} Transactions`;
    const body = document.getElementById('methodTransactionsBody');
    body.innerHTML = '<p class="loading-message">Loading...</p>';
    document.getElementById('methodTransactionsModal').style.display = 'flex';

    try {
        const res = await fetch(`/api/payment-methods/${encodeURIComponent(keyId)}/transactions`, { credentials: 'include' });
        if (!res.ok) {
            body.innerHTML = '<p class="loading-message">Failed to load transactions</p>';
            return;
        }
        const entries = await res.json();
        renderMethodTransactions(entries);
    } catch (error) {
        console.error('Error loading payment method transactions:', error);
        body.innerHTML = '<p class="loading-message">Error loading transactions</p>';
    }
}

const METHOD_TX_PAGE_SIZE = 10;
let methodTxEntries = [];
let methodTxPage = 1;

function renderMethodTransactions(entries) {
    methodTxEntries = entries;
    methodTxPage = 1;
    renderMethodTransactionsPage();
}

// Renders just the current page - called on first load and by
// goToMethodTxPage() (no re-fetch, so paging is instant).
function renderMethodTransactionsPage() {
    const body = document.getElementById('methodTransactionsBody');
    if (methodTxEntries.length === 0) {
        body.innerHTML = '<p class="loading-message">No transactions found for this payment method</p>';
        return;
    }

    const totalPages = Math.max(1, Math.ceil(methodTxEntries.length / METHOD_TX_PAGE_SIZE));
    methodTxPage = Math.min(Math.max(1, methodTxPage), totalPages);
    const start = (methodTxPage - 1) * METHOD_TX_PAGE_SIZE;
    const pageEntries = methodTxEntries.slice(start, start + METHOD_TX_PAGE_SIZE);

    const hasVendor = methodTxEntries.some(e => e.vendor);
    const rows = pageEntries.map(e => {
        const dateStr = new Date(e.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        const amountClass = e.type === 'income' ? 'positive' : 'negative';
        const sign = e.type === 'income' ? '+' : '-';
        const vendorCell = hasVendor ? `<td>${escapeHtml(e.vendor) || '-'}</td>` : '';
        return `
            <tr>
                <td>${dateStr}</td>
                <td>${escapeHtml(e.category)}</td>
                <td class="${amountClass}">${sign}₹${e.amount.toFixed(2)}</td>
                ${vendorCell}
                <td>${escapeHtml(e.comment) || '-'}</td>
            </tr>
        `;
    }).join('');

    body.innerHTML = `
        <div class="table-container">
            <table class="detail-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Category</th>
                        <th>Amount</th>
                        ${hasVendor ? '<th>Vendor/Party</th>' : ''}
                        <th>Comment</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        <div class="pagination-container" style="display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 15px;">
            <button class="btn btn-secondary" ${methodTxPage <= 1 ? 'disabled' : ''} onclick="goToMethodTxPage(-1)">&laquo; Prev</button>
            <span>Page ${methodTxPage} of ${totalPages} (${methodTxEntries.length} entries)</span>
            <button class="btn btn-secondary" ${methodTxPage >= totalPages ? 'disabled' : ''} onclick="goToMethodTxPage(1)">Next &raquo;</button>
        </div>
    `;
}

function goToMethodTxPage(delta) {
    methodTxPage += delta;
    renderMethodTransactionsPage();
}

function closeMethodTransactionsModal() {
    document.getElementById('methodTransactionsModal').style.display = 'none';
}

window.addEventListener('click', function(event) {
    const modal = document.getElementById('methodTransactionsModal');
    if (event.target === modal) closeMethodTransactionsModal();
});

// Totals across the full (already-loaded) entry list - not just the current
// page - so the report reflects everything shown across all pages.
function computeMethodTotals() {
    let income = 0, expense = 0;
    methodTxEntries.forEach(e => {
        if (e.type === 'income') income += e.amount;
        else expense += e.amount;
    });
    return { income, expense, net: income - expense };
}

function downloadMethodExcel() {
    if (methodTxEntries.length === 0) {
        alert('No transactions to export');
        return;
    }

    const { income, expense, net } = computeMethodTotals();
    const wb = XLSX.utils.book_new();

    const summaryData = [
        [`${currentMethodLabel} - Payment Method Report`],
        [],
        ['Total Income (₹)', income.toFixed(2)],
        ['Total Expense (₹)', expense.toFixed(2)],
        ['Net (₹)', net.toFixed(2)],
        ['Transaction Count', methodTxEntries.length]
    ];
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWs['!cols'] = [{ wch: 24 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    const hasVendor = methodTxEntries.some(e => e.vendor);
    const headers = ['Date', 'Category', 'Type', 'Amount (₹)'];
    if (hasVendor) headers.push('Vendor/Party');
    headers.push('Comment');

    const detailData = [headers];
    methodTxEntries.forEach(e => {
        const dateStr = new Date(e.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        const row = [dateStr, e.category, e.type === 'income' ? 'Income' : 'Expense', e.amount.toFixed(2)];
        if (hasVendor) row.push(e.vendor || '');
        row.push(e.comment || '');
        detailData.push(row);
    });
    const detailWs = XLSX.utils.aoa_to_sheet(detailData);
    detailWs['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 18 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, detailWs, 'Transactions');

    XLSX.writeFile(wb, `${currentMethodLabel.replace(/\s+/g, '_')}_Payment_Report.xlsx`);
}

function downloadMethodPDF() {
    if (methodTxEntries.length === 0) {
        alert('No transactions to export');
        return;
    }

    const { income, expense, net } = computeMethodTotals();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l');

    doc.setFontSize(18);
    doc.text(`${currentMethodLabel} - Payment Method Report`, 14, 20);

    doc.autoTable({
        startY: 30,
        head: [['Summary', 'Amount (Rs.)']],
        body: [
            ['Total Income', income.toFixed(2)],
            ['Total Expense', expense.toFixed(2)],
            ['Net', net.toFixed(2)],
            ['Transaction Count', String(methodTxEntries.length)]
        ],
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] }
    });

    const hasVendor = methodTxEntries.some(e => e.vendor);
    const head = hasVendor
        ? [['Date', 'Category', 'Type', 'Amount (Rs.)', 'Vendor/Party', 'Comment']]
        : [['Date', 'Category', 'Type', 'Amount (Rs.)', 'Comment']];

    const body = methodTxEntries.map(e => {
        const dateStr = new Date(e.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        const row = [dateStr, e.category, e.type === 'income' ? 'Income' : 'Expense', e.amount.toFixed(2)];
        if (hasVendor) row.push(e.vendor || '-');
        row.push(e.comment || '-');
        return row;
    });

    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 10,
        head,
        body,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 8 }
    });

    doc.save(`${currentMethodLabel.replace(/\s+/g, '_')}_Payment_Report.pdf`);
}
