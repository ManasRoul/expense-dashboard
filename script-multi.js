// Category definitions - loaded dynamically from settings API
let incomeCategories = [];
let expenseCategories = [];
let employeeList = [];

// Load settings from API
async function loadSettings() {
    try {
        const res = await fetch('/api/settings', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load settings');
        const items = await res.json();
        incomeCategories = items.filter(i => i.type === 'income_category').map(i => ({ id: i.key_id, label: i.label }));
        expenseCategories = items.filter(i => i.type === 'expense_category').map(i => ({ id: i.key_id, label: i.label }));
        employeeList = items.filter(i => i.type === 'employee').map(i => ({ id: i.key_id, label: i.label }));
    } catch (e) {
        // Fallback to defaults if API fails
        incomeCategories = [
            { id: 'roomRent', label: 'Room Rent' },
            { id: 'mattressCharge', label: 'Mattress Charge' },
            { id: 'travelCab', label: 'Travel/Cab Service' },
            { id: 'kitchenFacility', label: 'Kitchen Facility' },
            { id: 'cleanCharge', label: 'Cleaning Charge' },
            { id: 'miscReceipt', label: 'Misc Receipt' }
        ];
        expenseCategories = [
            { id: 'brokerage', label: 'Brokerage' },
            { id: 'salary', label: 'Salary' },
            { id: 'roomCleaningCharge', label: 'Room Cleaning Charge' },
            { id: 'generatorMaintenance', label: 'Generator & Maintenance' },
            { id: 'hotelStationary', label: 'Hotel Stationary' },
            { id: 'hotelCleaningSanitation', label: 'Hotel Cleaning and Sanitation' },
            { id: 'rentTaxes', label: 'Rent & Taxes' },
            { id: 'tvRecharge', label: 'TV Recharge' },
            { id: 'cameraWifi', label: 'Camera/WiFi' },
            { id: 'plumbingMaintenance', label: 'Plumbing & Maintenance' },
            { id: 'electricityMaintenance', label: 'Electricity & Maintenance' },
            { id: 'electricityBill', label: 'Electricity Bill' },
            { id: 'staffFooding', label: 'Staff Fooding' },
            { id: 'laundry', label: 'Laundry' },
            { id: 'ownerKitchenCab', label: 'Owner Kitchen & Cab Payment' },
            { id: 'officeStationary', label: 'Office Stationary' },
            { id: 'miscExpenses', label: 'Misc Expenses' }
        ];
        employeeList = [
            { id: 'shakti', label: 'Shakti' },
            { id: 'kabu', label: 'Kabu' },
            { id: 'kiran', label: 'Kiran' },
            { id: 'purna', label: 'Purna' }
        ];
    }
}

// Initialize form on page load
document.addEventListener('DOMContentLoaded', async function() {
    setDefaultDate();
    await loadSettings();
    initializeCategories();
    
    // Check if we're editing an existing transaction
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    
    if (editId) {
        loadTransactionForEdit(editId);
    } else {
        loadLastClosingBalance();
    }
    
    setupFormSubmit();
});

// Load last closing balance as opening balance
async function loadLastClosingBalance() {
    try {
        console.log('Starting loadLastClosingBalance...');
        
        const openingBalanceInput = document.getElementById('openingBalance');
        console.log('Opening balance input:', openingBalanceInput);
        
        if (!openingBalanceInput) {
            console.error('Opening balance input element not found!');
            return;
        }
        
        console.log('Fetching last closing balance from API...');
        const response = await fetch('/api/transactions?limit=1', {
            credentials: 'include'
        });
        console.log('API Response status:', response.status);
        
        if (!response.ok) {
            console.error('Failed to fetch transactions:', response.status);
            return;
        }
        
        const transactions = await response.json();
        console.log('Transactions received:', transactions);
        
        if (transactions && transactions.length > 0) {
            const lastTransaction = transactions[0];
            const lastClosingBalance = parseFloat(lastTransaction.closing_balance).toFixed(2);
            
            console.log('Setting opening balance to:', lastClosingBalance);
            openingBalanceInput.value = lastClosingBalance;
            console.log('Value set, input.value is now:', openingBalanceInput.value);
            
            // Trigger calculation after setting value
            if (typeof calculateTotal === 'function') {
                calculateTotal();
                console.log('✓ Opening balance auto-filled and calculated: ₹' + lastClosingBalance);
            } else {
                console.warn('calculateTotal function not found');
            }
        } else {
            console.log('No transactions found in database');
        }
    } catch (error) {
        console.error('Error loading last closing balance:', error);
        console.error('Error stack:', error.stack);
    }
}

// Load transaction for editing
async function loadTransactionForEdit(transactionId) {
    try {
        console.log('Loading transaction for edit:', transactionId);
        
        // Update page title to indicate editing
        const heading = document.querySelector('h1');
        if (heading) {
            heading.textContent = 'Edit Financial Transaction';
        }
        
        // Update submit button text
        const submitButton = document.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.textContent = 'Update Transaction';
        }
        
        const response = await fetch(`/api/transactions/${transactionId}`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            alert('Failed to load transaction');
            return;
        }
        
        const transaction = await response.json();
        console.log('Transaction loaded:', transaction);
        
        // Set the date
        document.getElementById('entryDate').value = transaction.date.split('T')[0];
        
        // Set opening balance
        document.getElementById('openingBalance').value = transaction.opening_balance;
        
        // Load income categories
        incomeCategories.forEach(category => {
            loadCategoryData(category.id, transaction);
        });
        
        // Load expense categories
        expenseCategories.forEach(category => {
            loadCategoryData(category.id, transaction);
        });
        
        // Calculate totals
        calculateTotal();
        
        console.log('Transaction loaded successfully');
    } catch (error) {
        console.error('Error loading transaction:', error);
        alert('Error loading transaction for editing');
    }
}

// Load data for a specific category from transaction
function loadCategoryData(categoryId, transaction) {
    // Convert camelCase to snake_case for database field names
    const amountField = categoryId.replace(/([A-Z])/g, '_$1').toLowerCase();
    const methodField = `${amountField}_method`;
    const commentField = `${amountField}_comment`;
    
    const amount = parseFloat(transaction[amountField]) || 0;
    const method = transaction[methodField] || '';
    const comment = transaction[commentField] || '';
    
    const container = document.getElementById(`entries-${categoryId}`);
    
    if (!container) {
        console.error(`Container not found for category: ${categoryId}`);
        return;
    }
    
    if (amount > 0 || comment) {
        // Parse comment for multiple entries (separated by |)
        const entries = comment ? comment.split('|').map(e => e.trim()).filter(e => e) : [];
        
        // Clear existing entries
        container.innerHTML = '';
        
        if (entries.length === 0 && amount > 0) {
            // Single entry with just amount
            entries.push('');
        }
        
        entries.forEach((entry, index) => {
            // Parse entry format: (₹100 - CASH - Room 101)
            let entryAmount = 0;
            let entryMethod = method;
            let entryComment = '';
            
            if (entry) {
                const match = entry.match(/\(₹([\d.]+)\s*-\s*(\w+)(?:\s*-\s*(.+))?\)/);
                if (match) {
                    entryAmount = parseFloat(match[1]) || 0;
                    entryMethod = match[2].toLowerCase();
                    entryComment = match[3] || '';
                } else {
                    // Entry might be just text without the format
                    entryComment = entry;
                    if (index === 0) {
                        entryAmount = amount;
                    }
                }
            } else if (index === 0) {
                // First entry, use the total amount
                entryAmount = amount;
            }
            
            // Create entry row
            const isSalary = categoryId === 'salary';
            const row = document.createElement('div');
            row.className = isSalary ? 'entry-row salary-entry' : 'entry-row';
            row.dataset.category = categoryId;
            row.dataset.index = index;
            
            // For salary entries, parse employee name and payment type from comment
            let employeeName = '';
            let paymentType = '';
            let actualComment = entryComment;
            if (isSalary && entry) {
                // Parse format: (₹100 - CASH - Shakti - Advance - Note) or (₹100 - CASH - Shakti - Advance)
                const parts = entry.match(/\(₹[\d.]+\s*-\s*(\w+)\s*-\s*(\w+)(?:\s*-\s*(\w+))?(?:\s*-\s*(.+))?\)/);
                if (parts && parts.length >= 3) {
                    employeeName = parts[2] || '';
                    paymentType = parts[3] || '';
                    actualComment = parts[4] || '';
                }
            }
            
            if (isSalary) {
                const employeeOptions = employeeList.map(e => 
                    `<option value="${e.label}" ${employeeName === e.label ? 'selected' : ''}>${e.label}</option>`
                ).join('');
                row.innerHTML = `
                    <select class="employee-select" data-field="employee" onchange="calculateCategoryTotal('${categoryId}')">
                        <option value="">Select Employee</option>
                        ${employeeOptions}
                    </select>
                    <select class="payment-type-select" data-field="paymentType" onchange="calculateCategoryTotal('${categoryId}')">
                        <option value="">Type</option>
                        <option value="Advance" ${paymentType === 'Advance' ? 'selected' : ''}>Advance</option>
                        <option value="Full" ${paymentType === 'Full' ? 'selected' : ''}>Full</option>
                    </select>
                    <select class="payment-select" data-field="method" onchange="calculateCategoryTotal('${categoryId}')">
                        <option value="">Payment</option>
                        <option value="cash" ${entryMethod === 'cash' ? 'selected' : ''}>Cash</option>
                        <option value="upi" ${entryMethod === 'upi' ? 'selected' : ''}>UPI</option>
                    </select>
                    <input type="number" class="amount-input" data-field="amount" step="0.01" placeholder="0.00" 
                        value="${entryAmount}" oninput="calculateCategoryTotal('${categoryId}')">
                    <input type="text" class="comment-input" data-field="comment" placeholder="Add note (optional)" 
                        value="${actualComment}">
                    ${index > 0 ? `<button type="button" class="btn-remove-entry" onclick="removeEntry('${categoryId}', ${index})">×</button>` : '<span></span>'}
                `;
            } else {
                row.innerHTML = `
                    <select class="payment-select" data-field="method" onchange="calculateCategoryTotal('${categoryId}')">
                        <option value="">Payment</option>
                        <option value="cash" ${entryMethod === 'cash' ? 'selected' : ''}>Cash</option>
                        <option value="upi" ${entryMethod === 'upi' ? 'selected' : ''}>UPI</option>
                    </select>
                    <input type="number" class="amount-input" data-field="amount" step="0.01" placeholder="0.00" 
                        value="${entryAmount}" oninput="calculateCategoryTotal('${categoryId}')">
                    <input type="text" class="comment-input" data-field="comment" placeholder="Add comment (optional)" 
                        value="${entryComment}">
                    ${index > 0 ? `<button type="button" class="btn-remove-entry" onclick="removeEntry('${categoryId}', ${index})">×</button>` : '<span></span>'}
                `;
            }
            
            container.appendChild(row);
        });
        
        // Update category total
        calculateCategoryTotal(categoryId);
    }
}

// Set default date to today
function setDefaultDate() {
    const dateInput = document.getElementById('entryDate');
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    dateInput.value = `${year}-${month}-${day}`;
}

// Initialize all categories
function initializeCategories() {
    const incomeContainer = document.getElementById('incomeCategories');
    const expenseContainer = document.getElementById('expenseCategories');

    incomeCategories.forEach(category => {
        incomeContainer.appendChild(createCategorySection(category, 'income'));
    });

    expenseCategories.forEach(category => {
        expenseContainer.appendChild(createCategorySection(category, 'expense'));
    });
}

// Create a category section with one initial entry
function createCategorySection(category, type) {
    const section = document.createElement('div');
    section.className = 'category-section';
    section.id = `section-${category.id}`;

    section.innerHTML = `
        <div class="category-header">
            <label><span class="badge-bullet"></span>${category.label}</label>
            <span class="category-total" id="total-${category.id}">₹0.00</span>
        </div>
        <div class="entries-container" id="entries-${category.id}">
            ${createEntryRow(category.id, 0)}
        </div>
        <button type="button" class="btn-add-entry" onclick="addEntry('${category.id}')">
            ➕ Add More
        </button>
    `;

    return section;
}

// Create a single entry row
function createEntryRow(categoryId, index) {
    // Check if this is the salary category
    const isSalary = categoryId === 'salary';
    
    if (isSalary) {
        const employeeOptions = employeeList.map(e => `<option value="${e.label}">${e.label}</option>`).join('');
        return `
            <div class="entry-row salary-entry" data-category="${categoryId}" data-index="${index}">
                <select class="employee-select" data-field="employee" onchange="calculateCategoryTotal('${categoryId}')">
                    <option value="">Select Employee</option>
                    ${employeeOptions}
                </select>
                <select class="payment-type-select" data-field="paymentType" onchange="calculateCategoryTotal('${categoryId}')">
                    <option value="">Type</option>
                    <option value="Advance">Advance</option>
                    <option value="Full">Full</option>
                </select>
                <select class="payment-select" data-field="method" onchange="calculateCategoryTotal('${categoryId}')">
                    <option value="">Payment</option>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                </select>
                <input type="number" class="amount-input" data-field="amount" step="0.01" placeholder="0.00" 
                    oninput="calculateCategoryTotal('${categoryId}')">
                <input type="text" class="comment-input" data-field="comment" placeholder="Add note (optional)">
                ${index > 0 ? `<button type="button" class="btn-remove-entry" onclick="removeEntry('${categoryId}', ${index})">&times;</button>` : '<span></span>'}
            </div>
        `;
    }
    
    // Regular entries
    return `
        <div class="entry-row" data-category="${categoryId}" data-index="${index}">
            <select class="payment-select" data-field="method" onchange="calculateCategoryTotal('${categoryId}')">
                <option value="">Payment</option>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
            </select>
            <input type="number" class="amount-input" data-field="amount" step="0.01" placeholder="0.00" 
                oninput="calculateCategoryTotal('${categoryId}')">
            <input type="text" class="comment-input" data-field="comment" placeholder="Add comment (optional)">
            ${index > 0 ? `<button type="button" class="btn-remove-entry" onclick="removeEntry('${categoryId}', ${index})">×</button>` : '<span></span>'}
        </div>
    `;
}

// Add a new entry row to a category
function addEntry(categoryId) {
    const container = document.getElementById(`entries-${categoryId}`);
    const currentEntries = container.querySelectorAll('.entry-row').length;
    
    const newRow = document.createElement('div');
    newRow.innerHTML = createEntryRow(categoryId, currentEntries);
    container.appendChild(newRow.firstElementChild);
}

// Remove an entry row from a category
function removeEntry(categoryId, index) {
    const container = document.getElementById(`entries-${categoryId}`);
    const rows = container.querySelectorAll('.entry-row');
    
    if (rows.length > 1) {
        rows[index].remove();
        // Reindex remaining rows
        reindexEntries(categoryId);
        calculateCategoryTotal(categoryId);
    }
}

// Reindex entries after removal
function reindexEntries(categoryId) {
    const container = document.getElementById(`entries-${categoryId}`);
    const rows = container.querySelectorAll('.entry-row');
    
    rows.forEach((row, newIndex) => {
        row.dataset.index = newIndex;
        const removeBtn = row.querySelector('.btn-remove-entry');
        if (removeBtn) {
            removeBtn.onclick = () => removeEntry(categoryId, newIndex);
        }
    });
}

// Calculate total for a specific category
function calculateCategoryTotal(categoryId) {
    const container = document.getElementById(`entries-${categoryId}`);
    const rows = container.querySelectorAll('.entry-row');
    
    let total = 0;
    rows.forEach(row => {
        const amountInput = row.querySelector('[data-field="amount"]');
        const amount = parseFloat(amountInput.value) || 0;
        total += amount;
    });

    // Update category total display
    const totalDisplay = document.getElementById(`total-${categoryId}`);
    totalDisplay.textContent = `₹${total.toFixed(2)}`;

    // Trigger overall total calculation
    calculateTotal();
}

// Calculate total income, expense, and closing balance
function calculateTotal() {
    const openingBalance = parseFloat(document.getElementById('openingBalance').value) || 0;

    // Calculate total income
    let totalIncome = 0;
    incomeCategories.forEach(category => {
        const container = document.getElementById(`entries-${category.id}`);
        const rows = container.querySelectorAll('.entry-row');
        rows.forEach(row => {
            const amount = parseFloat(row.querySelector('[data-field="amount"]').value) || 0;
            totalIncome += amount;
        });
    });

    // Calculate total expense
    let totalExpense = 0;
    expenseCategories.forEach(category => {
        const container = document.getElementById(`entries-${category.id}`);
        const rows = container.querySelectorAll('.entry-row');
        rows.forEach(row => {
            const amount = parseFloat(row.querySelector('[data-field="amount"]').value) || 0;
            totalExpense += amount;
        });
    });

    // Update totals
    document.getElementById('totalIncome').value = totalIncome.toFixed(2);
    document.getElementById('totalExpense').value = totalExpense.toFixed(2);
    document.getElementById('closingBalance').value = (openingBalance + totalIncome - totalExpense).toFixed(2);
}

// Get all entries for a category as a detailed string
function getCategoryData(categoryId) {
    const container = document.getElementById(`entries-${categoryId}`);
    const rows = container.querySelectorAll('.entry-row');
    const isSalary = categoryId === 'salary';
    
    let totalAmount = 0;
    let details = [];
    let firstMethod = '';

    rows.forEach((row, index) => {
        const method = row.querySelector('[data-field="method"]').value;
        const amount = parseFloat(row.querySelector('[data-field="amount"]').value) || 0;
        const comment = row.querySelector('[data-field="comment"]').value.trim();
        
        // Get employee name and payment type for salary entries
        const employee = isSalary && row.querySelector('[data-field="employee"]') 
            ? row.querySelector('[data-field="employee"]').value 
            : '';
        const paymentType = isSalary && row.querySelector('[data-field="paymentType"]') 
            ? row.querySelector('[data-field="paymentType"]').value 
            : '';

        if (amount > 0 || comment) {
            totalAmount += amount;
            if (index === 0 && method) firstMethod = method;
            
            const parts = [];
            if (amount > 0) parts.push(`₹${amount.toFixed(2)}`);
            if (method) parts.push(method.toUpperCase());
            if (isSalary && employee) parts.push(employee);
            if (isSalary && paymentType) parts.push(paymentType);
            if (comment) parts.push(comment);
            if (parts.length > 0) {
                details.push(`(${parts.join(' - ')})`);
            }
        }
    });

    return {
        amount: totalAmount,
        method: firstMethod,
        comment: details.join(' | ')
    };
}

// Setup form submit handler
function setupFormSubmit() {
    const form = document.getElementById('financialForm');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Check if we're editing
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('edit');

        // Build income object
        const income = {};
        incomeCategories.forEach(category => {
            const data = getCategoryData(category.id);
            income[category.id] = {
                amount: data.amount,
                method: data.method || '',
                comment: data.comment
            };
        });
        income.totalIncome = parseFloat(document.getElementById('totalIncome').value) || 0;

        // Build expense object
        const expense = {};
        expenseCategories.forEach(category => {
            const data = getCategoryData(category.id);
            expense[category.id] = {
                amount: data.amount,
                method: data.method || '',
                comment: data.comment
            };
        });
        expense.totalExpense = parseFloat(document.getElementById('totalExpense').value) || 0;

        // Gather all data in the format the server expects
        const formData = {
            entryDate: document.getElementById('entryDate').value,
            openingBalance: parseFloat(document.getElementById('openingBalance').value) || 0,
            income: income,
            expense: expense,
            closingBalance: parseFloat(document.getElementById('closingBalance').value) || 0
        };

        try {
            let response;
            
            if (editId) {
                // Update existing transaction
                response = await fetch(`/api/transactions/${editId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify(formData)
                });
            } else {
                // Create new transaction
                response = await fetch('/api/transactions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify(formData)
                });
            }

            const data = await response.json();

            if (response.ok) {
                if (editId) {
                    alert('Transaction updated successfully!');
                    window.location.href = 'dashboard.html';
                } else {
                    alert('Transaction saved successfully!');
                    form.reset();
                    setDefaultDate();
                    // Reinitialize categories to reset all entries
                    document.getElementById('incomeCategories').innerHTML = '';
                    document.getElementById('expenseCategories').innerHTML = '';
                    initializeCategories();
                    // Reload opening balance
                    setTimeout(() => loadLastClosingBalance(), 100);
                }
            } else {
                alert(data.error || `Failed to ${editId ? 'update' : 'save'} transaction`);
            }
        } catch (error) {
            console.error('Error:', error);
            alert(`Error ${editId ? 'updating' : 'saving'} transaction. Please try again.`);
        }
    });

    // Reset handler
    form.addEventListener('reset', function() {
        setTimeout(() => {
            setDefaultDate();
            document.getElementById('incomeCategories').innerHTML = '';
            document.getElementById('expenseCategories').innerHTML = '';
            initializeCategories();
        }, 10);
    });
}
