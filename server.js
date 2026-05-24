const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Initialize SQLite database
const db = new sqlite3.Database('./financial.db', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

// Create tables
function initializeDatabase() {
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        opening_balance REAL,
        
        -- Income items
        room_rent REAL DEFAULT 0,
        room_rent_method TEXT,
        mattress_charge REAL DEFAULT 0,
        mattress_charge_method TEXT,
        travel_cab REAL DEFAULT 0,
        travel_cab_method TEXT,
        kitchen_facility REAL DEFAULT 0,
        kitchen_facility_method TEXT,
        clean_charge REAL DEFAULT 0,
        clean_charge_method TEXT,
        misc_receipt REAL DEFAULT 0,
        misc_receipt_method TEXT,
        total_income REAL,
        
        -- Expense items
        brokerage REAL DEFAULT 0,
        brokerage_method TEXT,
        salary REAL DEFAULT 0,
        salary_method TEXT,
        room_cleaning_charge REAL DEFAULT 0,
        room_cleaning_charge_method TEXT,
        generator_maintenance REAL DEFAULT 0,
        generator_maintenance_method TEXT,
        hotel_stationary REAL DEFAULT 0,
        hotel_stationary_method TEXT,
        hotel_cleaning_sanitation REAL DEFAULT 0,
        hotel_cleaning_sanitation_method TEXT,
        rent_taxes REAL DEFAULT 0,
        rent_taxes_method TEXT,
        tv_recharge REAL DEFAULT 0,
        tv_recharge_method TEXT,
        camera_wifi REAL DEFAULT 0,
        camera_wifi_method TEXT,
        plumbing_maintenance REAL DEFAULT 0,
        plumbing_maintenance_method TEXT,
        electricity_maintenance REAL DEFAULT 0,
        electricity_maintenance_method TEXT,
        electricity_bill REAL DEFAULT 0,
        electricity_bill_method TEXT,
        staff_fooding REAL DEFAULT 0,
        staff_fooding_method TEXT,
        laundry REAL DEFAULT 0,
        laundry_method TEXT,
        owner_kitchen_cab REAL DEFAULT 0,
        owner_kitchen_cab_method TEXT,
        office_stationary REAL DEFAULT 0,
        office_stationary_method TEXT,
        misc_expenses REAL DEFAULT 0,
        misc_expenses_method TEXT,
        total_expense REAL,
        
        closing_balance REAL
    )`);

    console.log('Database tables initialized');
}

// API Endpoints

// Save transaction
app.post('/api/transactions', (req, res) => {
    const data = req.body;
    
    const sql = `INSERT INTO transactions (
        opening_balance,
        room_rent, room_rent_method,
        mattress_charge, mattress_charge_method,
        travel_cab, travel_cab_method,
        kitchen_facility, kitchen_facility_method,
        clean_charge, clean_charge_method,
        misc_receipt, misc_receipt_method,
        total_income,
        brokerage, brokerage_method,
        salary, salary_method,
        room_cleaning_charge, room_cleaning_charge_method,
        generator_maintenance, generator_maintenance_method,
        hotel_stationary, hotel_stationary_method,
        hotel_cleaning_sanitation, hotel_cleaning_sanitation_method,
        rent_taxes, rent_taxes_method,
        tv_recharge, tv_recharge_method,
        camera_wifi, camera_wifi_method,
        plumbing_maintenance, plumbing_maintenance_method,
        electricity_maintenance, electricity_maintenance_method,
        electricity_bill, electricity_bill_method,
        staff_fooding, staff_fooding_method,
        laundry, laundry_method,
        owner_kitchen_cab, owner_kitchen_cab_method,
        office_stationary, office_stationary_method,
        misc_expenses, misc_expenses_method,
        total_expense,
        closing_balance
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const params = [
        data.openingBalance,
        data.income.roomRent.amount, data.income.roomRent.method,
        data.income.mattressCharge.amount, data.income.mattressCharge.method,
        data.income.travelCab.amount, data.income.travelCab.method,
        data.income.kitchenFacility.amount, data.income.kitchenFacility.method,
        data.income.cleanCharge.amount, data.income.cleanCharge.method,
        data.income.miscReceipt.amount, data.income.miscReceipt.method,
        data.income.totalIncome,
        data.expense.brokerage.amount, data.expense.brokerage.method,
        data.expense.salary.amount, data.expense.salary.method,
        data.expense.roomCleaningCharge.amount, data.expense.roomCleaningCharge.method,
        data.expense.generatorMaintenance.amount, data.expense.generatorMaintenance.method,
        data.expense.hotelStationary.amount, data.expense.hotelStationary.method,
        data.expense.hotelCleaningSanitation.amount, data.expense.hotelCleaningSanitation.method,
        data.expense.rentTaxes.amount, data.expense.rentTaxes.method,
        data.expense.tvRecharge.amount, data.expense.tvRecharge.method,
        data.expense.cameraWifi.amount, data.expense.cameraWifi.method,
        data.expense.plumbingMaintenance.amount, data.expense.plumbingMaintenance.method,
        data.expense.electricityMaintenance.amount, data.expense.electricityMaintenance.method,
        data.expense.electricityBill.amount, data.expense.electricityBill.method,
        data.expense.staffFooding.amount, data.expense.staffFooding.method,
        data.expense.laundry.amount, data.expense.laundry.method,
        data.expense.ownerKitchenCab.amount, data.expense.ownerKitchenCab.method,
        data.expense.officeStationary.amount, data.expense.officeStationary.method,
        data.expense.miscExpenses.amount, data.expense.miscExpenses.method,
        data.expense.totalExpense,
        data.closingBalance
    ];
    
    db.run(sql, params, function(err) {
        if (err) {
            console.error('Error saving transaction:', err);
            res.status(500).json({ error: err.message });
        } else {
            res.json({ id: this.lastID, message: 'Transaction saved successfully' });
        }
    });
});

// Get dashboard balances
app.get('/api/dashboard/balances', (req, res) => {
    const sql = `
        SELECT 
            opening_balance,
            room_rent, room_rent_method,
            mattress_charge, mattress_charge_method,
            travel_cab, travel_cab_method,
            kitchen_facility, kitchen_facility_method,
            clean_charge, clean_charge_method,
            misc_receipt, misc_receipt_method,
            brokerage, brokerage_method,
            salary, salary_method,
            room_cleaning_charge, room_cleaning_charge_method,
            generator_maintenance, generator_maintenance_method,
            hotel_stationary, hotel_stationary_method,
            hotel_cleaning_sanitation, hotel_cleaning_sanitation_method,
            rent_taxes, rent_taxes_method,
            tv_recharge, tv_recharge_method,
            camera_wifi, camera_wifi_method,
            plumbing_maintenance, plumbing_maintenance_method,
            electricity_maintenance, electricity_maintenance_method,
            electricity_bill, electricity_bill_method,
            staff_fooding, staff_fooding_method,
            laundry, laundry_method,
            owner_kitchen_cab, owner_kitchen_cab_method,
            office_stationary, office_stationary_method,
            misc_expenses, misc_expenses_method,
            total_income,
            total_expense,
            closing_balance
        FROM transactions
        ORDER BY date DESC
    `;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            // Calculate cash and UPI balances
            let cashIncome = 0, upiIncome = 0;
            let cashExpense = 0, upiExpense = 0;
            
            rows.forEach(row => {
                // Income
                if (row.room_rent_method === 'cash') cashIncome += row.room_rent || 0;
                if (row.room_rent_method === 'upi') upiIncome += row.room_rent || 0;
                
                if (row.mattress_charge_method === 'cash') cashIncome += row.mattress_charge || 0;
                if (row.mattress_charge_method === 'upi') upiIncome += row.mattress_charge || 0;
                
                if (row.travel_cab_method === 'cash') cashIncome += row.travel_cab || 0;
                if (row.travel_cab_method === 'upi') upiIncome += row.travel_cab || 0;
                
                if (row.kitchen_facility_method === 'cash') cashIncome += row.kitchen_facility || 0;
                if (row.kitchen_facility_method === 'upi') upiIncome += row.kitchen_facility || 0;
                
                if (row.clean_charge_method === 'cash') cashIncome += row.clean_charge || 0;
                if (row.clean_charge_method === 'upi') upiIncome += row.clean_charge || 0;
                
                if (row.misc_receipt_method === 'cash') cashIncome += row.misc_receipt || 0;
                if (row.misc_receipt_method === 'upi') upiIncome += row.misc_receipt || 0;
                
                // Expenses
                if (row.brokerage_method === 'cash') cashExpense += row.brokerage || 0;
                if (row.brokerage_method === 'upi') upiExpense += row.brokerage || 0;
                
                if (row.salary_method === 'cash') cashExpense += row.salary || 0;
                if (row.salary_method === 'upi') upiExpense += row.salary || 0;
                
                if (row.room_cleaning_charge_method === 'cash') cashExpense += row.room_cleaning_charge || 0;
                if (row.room_cleaning_charge_method === 'upi') upiExpense += row.room_cleaning_charge || 0;
                
                if (row.generator_maintenance_method === 'cash') cashExpense += row.generator_maintenance || 0;
                if (row.generator_maintenance_method === 'upi') upiExpense += row.generator_maintenance || 0;
                
                if (row.hotel_stationary_method === 'cash') cashExpense += row.hotel_stationary || 0;
                if (row.hotel_stationary_method === 'upi') upiExpense += row.hotel_stationary || 0;
                
                if (row.hotel_cleaning_sanitation_method === 'cash') cashExpense += row.hotel_cleaning_sanitation || 0;
                if (row.hotel_cleaning_sanitation_method === 'upi') upiExpense += row.hotel_cleaning_sanitation || 0;
                
                if (row.rent_taxes_method === 'cash') cashExpense += row.rent_taxes || 0;
                if (row.rent_taxes_method === 'upi') upiExpense += row.rent_taxes || 0;
                
                if (row.tv_recharge_method === 'cash') cashExpense += row.tv_recharge || 0;
                if (row.tv_recharge_method === 'upi') upiExpense += row.tv_recharge || 0;
                
                if (row.camera_wifi_method === 'cash') cashExpense += row.camera_wifi || 0;
                if (row.camera_wifi_method === 'upi') upiExpense += row.camera_wifi || 0;
                
                if (row.plumbing_maintenance_method === 'cash') cashExpense += row.plumbing_maintenance || 0;
                if (row.plumbing_maintenance_method === 'upi') upiExpense += row.plumbing_maintenance || 0;
                
                if (row.electricity_maintenance_method === 'cash') cashExpense += row.electricity_maintenance || 0;
                if (row.electricity_maintenance_method === 'upi') upiExpense += row.electricity_maintenance || 0;
                
                if (row.electricity_bill_method === 'cash') cashExpense += row.electricity_bill || 0;
                if (row.electricity_bill_method === 'upi') upiExpense += row.electricity_bill || 0;
                
                if (row.staff_fooding_method === 'cash') cashExpense += row.staff_fooding || 0;
                if (row.staff_fooding_method === 'upi') upiExpense += row.staff_fooding || 0;
                
                if (row.laundry_method === 'cash') cashExpense += row.laundry || 0;
                if (row.laundry_method === 'upi') upiExpense += row.laundry || 0;
                
                if (row.owner_kitchen_cab_method === 'cash') cashExpense += row.owner_kitchen_cab || 0;
                if (row.owner_kitchen_cab_method === 'upi') upiExpense += row.owner_kitchen_cab || 0;
                
                if (row.office_stationary_method === 'cash') cashExpense += row.office_stationary || 0;
                if (row.office_stationary_method === 'upi') upiExpense += row.office_stationary || 0;
                
                if (row.misc_expenses_method === 'cash') cashExpense += row.misc_expenses || 0;
                if (row.misc_expenses_method === 'upi') upiExpense += row.misc_expenses || 0;
            });
            
            const cashBalance = cashIncome - cashExpense;
            const upiBalance = upiIncome - upiExpense;
            
            res.json({
                cashIncome: cashIncome.toFixed(2),
                cashExpense: cashExpense.toFixed(2),
                cashBalance: cashBalance.toFixed(2),
                upiIncome: upiIncome.toFixed(2),
                upiExpense: upiExpense.toFixed(2),
                upiBalance: upiBalance.toFixed(2),
                totalBalance: (cashBalance + upiBalance).toFixed(2),
                transactionCount: rows.length
            });
        }
    });
});

// Get all transactions
app.get('/api/transactions', (req, res) => {
    db.all('SELECT * FROM transactions ORDER BY date DESC LIMIT 50', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Dashboard: http://localhost:${PORT}/dashboard.html`);
    console.log(`Form: http://localhost:${PORT}/form.html`);
});
