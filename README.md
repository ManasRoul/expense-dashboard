# Financial Dashboard System

A complete financial tracking system for tracking income, expenses, salaries, and cash/UPI balances, with role-based access, dynamic categories, charts, and exportable reports.

## Features

### Authentication & Access Control
- 🔐 Login/logout with server-side sessions (`/api/login`, `/api/logout`, `/api/check-auth`)
- 👑 Two roles: **Owner** (full access, including Settings) and **Contributor** (data entry/viewing)
- 🧭 Shared top navigation bar (Home, Settings for owners, Logout) injected on every protected page via `auth.js`
- 📜 Audit logging of key actions (login attempts, etc.) to `audit.log`
- 🚦 Rate limiting on the API (Flask-Limiter)

### Dashboard
- 📊 Real-time Cash, UPI, and Total (current) balance cards
- 🔄 Auto-fill opening balance from the last saved transaction
- 📋 Recent transactions table with date-range filtering
- 🔎 Transaction details modal (full income/expense breakdown per entry)
- ✏️ Edit and delete existing transactions

### Transaction Entry
- 📝 Form to record income and expense items by category and payment method (Cash/UPI)
- 🧮 Auto-calculated totals and closing balance
- 🗂️ Supports both single-entry (`form.html`) and multi-item (`form-multi.html`) entry

### Category Insights
- 📊 Category-wise dashboard (`categories.html`) showing total income and expenses per category
- 🏆 Categories sorted by amount, highest first
- ⚙️ Categories are fully dynamic — managed from Settings, not hardcoded

### Charts & Analytics (`charts.html`)
- 📅 **Monthly tab**:
  - 🗓️ Monthly Summary flip-cards — one per month, color-coded, click to flip and reveal Income, Expense, and Available (Income − Expense) for that month, always sorted in correct chronological order
  - 📈 Daily balance trend and daily income vs. expense charts for the selected month
  - 🍩 Income and expense breakdown by category (doughnut charts)
- 📊 **Yearly tab**:
  - 🗓️ Yearly Summary flip-cards — same flip interaction, aggregated per year
  - 📈 Yearly income vs. expense and yearly balance trend charts
  - 🍩 Income and expense breakdown by category for a selected year

### Salary Management
- 💰 Record salary payments per employee with Cash/UPI method and notes (`salary.html`)
- 📊 Employee Salary Report (`employee-salary.html`):
  - Overall summary per employee (total earned, advance vs. full payments)
  - Monthly view with per-month salary, advances, and carryover balance
  - Full payment history in a detail modal

### Settings (Owner only)
- ⚙️ Manage dynamic income/expense categories (add, edit, delete, activate/deactivate)
- 👥 Configure employees and their monthly salary amounts

### Reports
- 📥 Download financial reports for a custom date range as **Excel (.xlsx)** or **PDF**

### Platform
- 💾 SQLite for local development, with optional MySQL for production (`USE_MYSQL` env var)
- 📱 Responsive design for mobile and desktop
- 🌐 CORS-enabled API

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. (First run only) Create an owner user:
```bash
python create_user.py
```

## Configuration

The app runs on SQLite by default. To use MySQL instead, set these environment variables before starting the server:

```bash
export USE_MYSQL=True
export DB_HOST=localhost
export DB_USER=your_username
export DB_PASSWORD=your_password
export DB_NAME=financial_dashboard
export DB_PORT=3306
export SECRET_KEY=your-secret-key-here
export ALLOWED_ORIGINS=https://yourdomain.com
```

See `config.py` and `config.example.py` for details.

## Running the Application

1. Start the Python server:
```bash
python server.py
```

2. Open your browser and navigate to:
   - Login: http://localhost:5001/login.html
   - Home: http://localhost:5001/home.html
   - Dashboard: http://localhost:5001/dashboard.html
   - Charts: http://localhost:5001/charts.html
   - Category View: http://localhost:5001/categories.html
   - Salary: http://localhost:5001/salary.html
   - Employee Salary Report: http://localhost:5001/employee-salary.html
   - Settings (owner only): http://localhost:5001/settings.html
   - New Entry Form: http://localhost:5001/form.html

## How to Use

1. **Log In**: Sign in on `login.html` with an owner or contributor account.

2. **Enter Transactions**:
   - Open the form (`form.html`)
   - Opening balance auto-fills from the last transaction
   - Enter income and expense items with payment method (Cash/UPI)
   - Click Calculate Total, then Submit to save

3. **View Dashboard**:
   - Open `dashboard.html`
   - View separate Cash and UPI balances and the current overall balance
   - Browse and filter recent transactions, view full details, edit, or delete

4. **View Category Totals**:
   - Open `categories.html` to see cumulative totals per income/expense category

5. **Explore Charts**:
   - Open `charts.html`
   - Monthly tab: flip the Monthly Summary cards to see income/expense/available per month, plus daily trend and category charts
   - Yearly tab: flip the Yearly Summary cards for year-level totals, plus yearly trend and category charts

6. **Manage Salaries**:
   - Record payments on `salary.html`
   - Review per-employee history and monthly balances on `employee-salary.html`

7. **Manage Categories & Employees** (owner only):
   - Open `settings.html` to add, edit, deactivate, or delete income/expense categories and configure employee salaries

8. **Download Reports**:
   - From the Dashboard, click "Download Report", pick a date range and format (Excel or PDF)

## Database

By default the system uses SQLite and automatically creates a `financial.db` file. Set `USE_MYSQL=True` with the appropriate `DB_*` environment variables to run against MySQL instead — the same API works against either backend.

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/login` | POST | Log in and start a session |
| `/api/logout` | POST | End the current session |
| `/api/check-auth` | GET | Verify the current session is valid |
| `/api/transactions` | GET | List transactions (`?limit=N`, default 50) |
| `/api/transactions` | POST | Save a new transaction |
| `/api/transactions/<id>` | GET/PUT/DELETE | Fetch, update, or delete a single transaction |
| `/api/dashboard/balances` | GET | Get Cash, UPI, and Total balances |
| `/api/category-totals` | GET | Get cumulative totals for all income/expense categories |
| `/api/salary-records` | GET/POST | List or create salary payment records |
| `/api/salary-records/all` | GET | List all salary records (for the employee report) |
| `/api/salary-records/details/<date>` | GET | Get salary payment details for a specific date |
| `/api/salary-records/<id>` | DELETE | Delete a salary record |
| `/api/settings` | GET/POST | List or create category/employee settings |
| `/api/settings/<id>` | PUT/DELETE | Update or delete a category/employee setting |

## Admin & Maintenance Scripts

These are run manually from the command line, not via the web UI:

- `create_user.py` — create owner/contributor users
- `backup_database.py` — back up the MySQL database before a sync
- `migrate.py` — apply tracked schema migrations to MySQL
- `sync_database.py` — sync local SQLite schema/categories to the live MySQL server
- `reset_database.py` — ⚠️ wipe and recreate all tables (backs up first)
- `diagnose_database.py` — check connectivity/health of the live database
- `repair_data_mismatch.py` — fix transactions where data landed in the wrong columns
- `fix_database.py` / `fix_columns.py` / `fix_missing_tables.py` — targeted schema fixes (encoding, missing columns/tables)
- `verify_server.py` — confirm the deployed `server.py` matches the latest code

## Deployment

The app can run as a standalone Flask server (`python server.py` or via `gunicorn`) or on shared hosting via `passenger_wsgi.py` and `.htaccess`. See `DEPLOYMENT_GUIDE.md`, `SHARED_HOSTING_DEPLOYMENT.md`, and `SHARED_HOSTING_USERS.md` for details.

## Technologies Used

- Frontend: HTML, CSS, JavaScript, Chart.js, SheetJS (xlsx), jsPDF
- Backend: Python, Flask, Flask-CORS, Flask-Limiter
- Database: SQLite3 (default) or MySQL
- Auth: Server-side sessions with role-based access (Werkzeug)

## Requirements

- Python 3.7 or higher
- Flask, Flask-CORS, Flask-Limiter, Werkzeug
- mysql-connector-python (only needed if `USE_MYSQL=True`)
- python-dotenv, gunicorn

See `requirements.txt` for exact versions.
