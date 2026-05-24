// Calculate total income from all receipt categories
function calculateTotal() {
    // Calculate Total Income
    const roomRent = parseFloat(document.getElementById('roomRent').value) || 0;
    const mattressCharge = parseFloat(document.getElementById('mattressCharge').value) || 0;
    const travelCab = parseFloat(document.getElementById('travelCab').value) || 0;
    const kitchenFacility = parseFloat(document.getElementById('kitchenFacility').value) || 0;
    const cleanCharge = parseFloat(document.getElementById('cleanCharge').value) || 0;
    const miscReceipt = parseFloat(document.getElementById('miscReceipt').value) || 0;

    const totalIncome = roomRent + mattressCharge + travelCab + kitchenFacility + cleanCharge + miscReceipt;
    document.getElementById('totalIncome').value = totalIncome.toFixed(2);

    // Calculate Total Expense
    const brokerage = parseFloat(document.getElementById('brokerage').value) || 0;
    const salary = parseFloat(document.getElementById('salary').value) || 0;
    const roomCleaningCharge = parseFloat(document.getElementById('roomCleaningCharge').value) || 0;
    const generatorMaintenance = parseFloat(document.getElementById('generatorMaintenance').value) || 0;
    const hotelStationary = parseFloat(document.getElementById('hotelStationary').value) || 0;
    const hotelCleaningSanitation = parseFloat(document.getElementById('hotelCleaningSanitation').value) || 0;
    const rentTaxes = parseFloat(document.getElementById('rentTaxes').value) || 0;
    const tvRecharge = parseFloat(document.getElementById('tvRecharge').value) || 0;
    const cameraWifi = parseFloat(document.getElementById('cameraWifi').value) || 0;
    const plumbingMaintenance = parseFloat(document.getElementById('plumbingMaintenance').value) || 0;
    const electricityMaintenance = parseFloat(document.getElementById('electricityMaintenance').value) || 0;
    const electricityBill = parseFloat(document.getElementById('electricityBill').value) || 0;
    const staffFooding = parseFloat(document.getElementById('staffFooding').value) || 0;
    const laundry = parseFloat(document.getElementById('laundry').value) || 0;
    const ownerKitchenCab = parseFloat(document.getElementById('ownerKitchenCab').value) || 0;
    const officeStationary = parseFloat(document.getElementById('officeStationary').value) || 0;
    const miscExpenses = parseFloat(document.getElementById('miscExpenses').value) || 0;

    const totalExpense = brokerage + salary + roomCleaningCharge + generatorMaintenance + 
                        hotelStationary + hotelCleaningSanitation + rentTaxes + tvRecharge + 
                        cameraWifi + plumbingMaintenance + electricityMaintenance + electricityBill + 
                        staffFooding + laundry + ownerKitchenCab + officeStationary + miscExpenses;
    document.getElementById('totalExpense').value = totalExpense.toFixed(2);

    // Calculate Closing Balance
    const openingBalance = parseFloat(document.getElementById('openingBalance').value) || 0;
    const closingBalance = openingBalance + totalIncome - totalExpense;
    document.getElementById('closingBalance').value = closingBalance.toFixed(2);
}

// Load last closing balance as opening balance
async function loadLastClosingBalance() {
    try {
        const response = await fetch('http://localhost:5000/api/transactions?limit=1');
        const transactions = await response.json();
        
        if (transactions.length > 0) {
            const lastTransaction = transactions[0];
            const lastClosingBalance = parseFloat(lastTransaction.closing_balance).toFixed(2);
            document.getElementById('openingBalance').value = lastClosingBalance;
            
            // Show notification
            const notification = document.createElement('div');
            notification.className = 'auto-fill-notification';
            notification.textContent = `✓ Opening balance auto-filled from last entry: ₹${lastClosingBalance}`;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.classList.add('show');
            }, 100);
            
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, 4000);
        }
    } catch (error) {
        console.error('Error loading last closing balance:', error);
    }
}

// Set current date as default
function setDefaultDate() {
    const dateInput = document.getElementById('entryDate');
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    dateInput.value = `${year}-${month}-${day}`;
}

// Auto-calculate when any receipt or expense field changes
document.addEventListener('DOMContentLoaded', function() {
    // Set default date to today
    setDefaultDate();
    
    // Load last closing balance on page load
    loadLastClosingBalance();
    
    const allFields = [
        // Opening Balance
        'openingBalance',
        // Income fields
        'roomRent', 
        'mattressCharge', 
        'travelCab', 
        'kitchenFacility', 
        'cleanCharge', 
        'miscReceipt',
        // Expense fields
        'brokerage',
        'salary',
        'roomCleaningCharge',
        'generatorMaintenance',
        'hotelStationary',
        'hotelCleaningSanitation',
        'rentTaxes',
        'tvRecharge',
        'cameraWifi',
        'plumbingMaintenance',
        'electricityMaintenance',
        'electricityBill',
        'staffFooding',
        'laundry',
        'ownerKitchenCab',
        'officeStationary',
        'miscExpenses'
    ];

    allFields.forEach(fieldId => {
        document.getElementById(fieldId).addEventListener('input', calculateTotal);
    });
});

// Handle form submission
document.getElementById('financialForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Get selected date
    const selectedDate = document.getElementById('entryDate').value;
    
    // Collect form data
    const formData = {
        entryDate: selectedDate,
        openingBalance: document.getElementById('openingBalance').value,
        income: {
            roomRent: {
                method: document.getElementById('roomRentMethod').value,
                amount: document.getElementById('roomRent').value
            },
            mattressCharge: {
                method: document.getElementById('mattressChargeMethod').value,
                amount: document.getElementById('mattressCharge').value
            },
            travelCab: {
                method: document.getElementById('travelCabMethod').value,
                amount: document.getElementById('travelCab').value
            },
            kitchenFacility: {
                method: document.getElementById('kitchenFacilityMethod').value,
                amount: document.getElementById('kitchenFacility').value
            },
            cleanCharge: {
                method: document.getElementById('cleanChargeMethod').value,
                amount: document.getElementById('cleanCharge').value
            },
            miscReceipt: {
                method: document.getElementById('miscReceiptMethod').value,
                amount: document.getElementById('miscReceipt').value
            },
            totalIncome: document.getElementById('totalIncome').value
        },
        expense: {
            brokerage: {
                method: document.getElementById('brokerageMethod').value,
                amount: document.getElementById('brokerage').value
            },
            salary: {
                method: document.getElementById('salaryMethod').value,
                amount: document.getElementById('salary').value
            },
            roomCleaningCharge: {
                method: document.getElementById('roomCleaningChargeMethod').value,
                amount: document.getElementById('roomCleaningCharge').value
            },
            generatorMaintenance: {
                method: document.getElementById('generatorMaintenanceMethod').value,
                amount: document.getElementById('generatorMaintenance').value
            },
            hotelStationary: {
                method: document.getElementById('hotelStationaryMethod').value,
                amount: document.getElementById('hotelStationary').value
            },
            hotelCleaningSanitation: {
                method: document.getElementById('hotelCleaningSanitationMethod').value,
                amount: document.getElementById('hotelCleaningSanitation').value
            },
            rentTaxes: {
                method: document.getElementById('rentTaxesMethod').value,
                amount: document.getElementById('rentTaxes').value
            },
            tvRecharge: {
                method: document.getElementById('tvRechargeMethod').value,
                amount: document.getElementById('tvRecharge').value
            },
            cameraWifi: {
                method: document.getElementById('cameraWifiMethod').value,
                amount: document.getElementById('cameraWifi').value
            },
            plumbingMaintenance: {
                method: document.getElementById('plumbingMaintenanceMethod').value,
                amount: document.getElementById('plumbingMaintenance').value
            },
            electricityMaintenance: {
                method: document.getElementById('electricityMaintenanceMethod').value,
                amount: document.getElementById('electricityMaintenance').value
            },
            electricityBill: {
                method: document.getElementById('electricityBillMethod').value,
                amount: document.getElementById('electricityBill').value
            },
            staffFooding: {
                method: document.getElementById('staffFoodingMethod').value,
                amount: document.getElementById('staffFooding').value
            },
            laundry: {
                method: document.getElementById('laundryMethod').value,
                amount: document.getElementById('laundry').value
            },
            ownerKitchenCab: {
                method: document.getElementById('ownerKitchenCabMethod').value,
                amount: document.getElementById('ownerKitchenCab').value
            },
            officeStationary: {
                method: document.getElementById('officeStationaryMethod').value,
                amount: document.getElementById('officeStationary').value
            },
            miscExpenses: {
                method: document.getElementById('miscExpensesMethod').value,
                amount: document.getElementById('miscExpenses').value
            },
            totalExpense: document.getElementById('totalExpense').value
        },
        closingBalance: document.getElementById('closingBalance').value
    };

    try {
        const response = await fetch('http://localhost:5000/api/transactions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json();
        
        if (response.ok) {
            alert('Transaction saved successfully! ID: ' + result.id);
            // Optionally redirect to dashboard
            if (confirm('Would you like to view the dashboard?')) {
                window.location.href = 'dashboard.html';
            } else {
                // Reset form
                document.getElementById('financialForm').reset();
            }
        } else {
            alert('Error saving transaction: ' + result.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error connecting to server. Make sure the server is running on port 5000.');
    }
});

