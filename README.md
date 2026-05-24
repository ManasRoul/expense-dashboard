# Financial Dashboard System

A complete financial tracking system with separate Cash and UPI balance tracking.

## Features

- 📊 Real-time dashboard showing Cash and UPI balances
- � Category-wise income and expense tracking
- 💰 Track income and expenses by payment method
- 📝 Form to enter financial transactions
- 💾 SQLite database for data persistence
- 📱 Responsive design for mobile and desktop
- 🔄 Auto-fill opening balance from last transaction

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

## Running the Application

1. Start the Python server:
```bash
python server.py
```

2. Open your browser and navigate to:
   - Dashboard: http://localhost:5000/dashboard.html
   - Category View: http://localhost:5000/categories.html
   - Form: http://localhost:5000/form.html

## How to Use

1. **Enter Transactions**:
   - Open the form (form.html)
   - Opening balance auto-fills from last transaction
   - Enter income items with payment method (Cash/UPI)
   - Enter expense items with payment method (Cash/UPI)
   - Click Calculate Total
   - Click Submit to save to database

2. **View Dashboard**:
   - Open dashboard (dashboard.html)
   - View separate Cash and UPI balances
   - See current balance (latest closing balance)
   - View recent transactions with details
   - Click "View Details" to see transaction breakdown

3. **View Category Totals**:
   - Open categories page (categories.html)
   - See total income for each source (Room Rent, Mattress Charge, etc.)
   - See total expenses for each category (Brokerage, Salary, etc.)
   - Each entry adds to the respective category total
   - Categories sorted by amount (highest first)

## Database

The system uses SQLite and automatically creates a `financial.db` file to store all transactions.

## API Endpoints

- `POST /api/transactions` - Save a new transaction
- `GET /api/transactions?limit=N` - Get transactions (default 50, use limit=1 for latest)
- `GET /api/dashboard/balances` - Get dashboard balances (cash, UPI, total)
- `GET /api/category-totals` - Get cumulative totals for all income and expense categories

## Technologies Used

- Frontend: HTML, CSS, JavaScript
- Backend: Python, Flask
- Database: SQLite3
- CORS enabled for API access

## Requirements

- Python 3.7 or higher
- Flask
- Flask-CORS

