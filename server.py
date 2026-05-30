from flask import Flask, request, jsonify, send_from_directory, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import re
from datetime import datetime, timedelta
import os
import hashlib
import secrets
import json
from decimal import Decimal, InvalidOperation
try:
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address
    LIMITER_AVAILABLE = True
except ImportError:
    LIMITER_AVAILABLE = False
    print("WARNING: Flask-Limiter not installed. Rate limiting disabled.")
    print("Install with: pip install Flask-Limiter")
from config import USE_MYSQL, MYSQL_CONFIG

# Import MySQL connector if needed
if USE_MYSQL:
    try:
        import mysql.connector
        from mysql.connector import Error
    except ImportError:
        print("ERROR: mysql-connector-python not installed!")
        print("Run: pip install mysql-connector-python")
        exit(1)

app = Flask(__name__)
# Generate secure random secret key
app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(32))
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = os.environ.get('SESSION_COOKIE_SECURE', 'false').lower() == 'true'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)

# Session timeout (30 minutes of inactivity)
SESSION_TIMEOUT = 1800  # seconds

# Configure CORS - allow from environment or default to localhost
ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS', 'http://localhost:5000').split(',')
CORS(app, 
     supports_credentials=True, 
     origins=ALLOWED_ORIGINS,
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type'])

# Rate limiting
if LIMITER_AVAILABLE:
    limiter = Limiter(
        app=app,
        key_func=get_remote_address,
        default_limits=["5000 per day", "1000 per hour"],
        storage_uri="memory://"
    )
else:
    # Dummy decorator when limiter not available
    class DummyLimiter:
        def limit(self, *args, **kwargs):
            def decorator(f):
                return f
            return decorator
    limiter = DummyLimiter()

# Database connection helper
def get_db_connection():
    """Get database connection based on configuration"""
    if USE_MYSQL:
        try:
            conn = mysql.connector.connect(
                host=MYSQL_CONFIG['host'],
                user=MYSQL_CONFIG['user'],
                password=MYSQL_CONFIG['password'],
                database=MYSQL_CONFIG['database'],
                port=MYSQL_CONFIG['port'],
                charset='utf8mb4',
                collation='utf8mb4_unicode_ci'
            )
            return conn
        except Error as e:
            print(f"Error connecting to MySQL: {e}")
            raise
    else:
        conn = sqlite3.connect('financial.db')
        conn.row_factory = sqlite3.Row
        return conn

def execute_query(query, params=None, fetch=False, fetchone=False):
    """Execute query with proper handling for both SQLite and MySQL"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)
        
        if fetch:
            if USE_MYSQL:
                from datetime import date as date_type
                from decimal import Decimal as Dec
                columns = [desc[0] for desc in cursor.description]
                rows = cursor.fetchall()
                result = []
                for row in rows:
                    d = dict(zip(columns, row))
                    for k, v in d.items():
                        if isinstance(v, datetime):
                            d[k] = v.strftime('%Y-%m-%d %H:%M:%S')
                        elif isinstance(v, date_type):
                            d[k] = v.strftime('%Y-%m-%d')
                        elif isinstance(v, Dec):
                            d[k] = float(v)
                    result.append(d)
            else:
                rows = cursor.fetchall()
                result = [dict(row) for row in rows]
            
            if fetchone:
                return result[0] if result else None
            return result
        else:
            conn.commit()
            last_id = cursor.lastrowid
            return last_id
    finally:
        cursor.close()
        conn.close()

# Database setup
def init_db():
    """Initialize database with transactions table"""
    if USE_MYSQL:
        # For MySQL, create database if it doesn't exist
        try:
            conn = mysql.connector.connect(
                host=MYSQL_CONFIG['host'],
                user=MYSQL_CONFIG['user'],
                password=MYSQL_CONFIG['password'],
                port=MYSQL_CONFIG['port']
            )
            cursor = conn.cursor()
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{MYSQL_CONFIG['database']}`")
            cursor.close()
            conn.close()
        except Error as e:
            print(f"Error creating database: {e}")
            raise
    
    # Create table
    if USE_MYSQL:
        create_table_query = '''CREATE TABLE IF NOT EXISTS transactions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            opening_balance DECIMAL(10, 2),
            
            room_rent DECIMAL(10, 2) DEFAULT 0,
            room_rent_method VARCHAR(10),
            room_rent_comment TEXT DEFAULT '',
            mattress_charge DECIMAL(10, 2) DEFAULT 0,
            mattress_charge_method VARCHAR(10),
            mattress_charge_comment TEXT DEFAULT '',
            travel_cab DECIMAL(10, 2) DEFAULT 0,
            travel_cab_method VARCHAR(10),
            travel_cab_comment TEXT DEFAULT '',
            kitchen_facility DECIMAL(10, 2) DEFAULT 0,
            kitchen_facility_method VARCHAR(10),
            kitchen_facility_comment TEXT DEFAULT '',
            clean_charge DECIMAL(10, 2) DEFAULT 0,
            clean_charge_method VARCHAR(10),
            clean_charge_comment TEXT DEFAULT '',
            misc_receipt DECIMAL(10, 2) DEFAULT 0,
            misc_receipt_method VARCHAR(10),
            misc_receipt_comment TEXT DEFAULT '',
            total_income DECIMAL(10, 2),
            
            brokerage DECIMAL(10, 2) DEFAULT 0,
            brokerage_method VARCHAR(10),
            brokerage_comment TEXT DEFAULT '',
            salary DECIMAL(10, 2) DEFAULT 0,
            salary_method VARCHAR(10),
            salary_comment TEXT DEFAULT '',
            room_cleaning_charge DECIMAL(10, 2) DEFAULT 0,
            room_cleaning_charge_method VARCHAR(10),
            room_cleaning_charge_comment TEXT DEFAULT '',
            generator_maintenance DECIMAL(10, 2) DEFAULT 0,
            generator_maintenance_method VARCHAR(10),
            generator_maintenance_comment TEXT DEFAULT '',
            hotel_stationary DECIMAL(10, 2) DEFAULT 0,
            hotel_stationary_method VARCHAR(10),
            hotel_stationary_comment TEXT DEFAULT '',
            hotel_cleaning_sanitation DECIMAL(10, 2) DEFAULT 0,
            hotel_cleaning_sanitation_method VARCHAR(10),
            hotel_cleaning_sanitation_comment TEXT DEFAULT '',
            rent_taxes DECIMAL(10, 2) DEFAULT 0,
            rent_taxes_method VARCHAR(10),
            rent_taxes_comment TEXT DEFAULT '',
            tv_recharge DECIMAL(10, 2) DEFAULT 0,
            tv_recharge_method VARCHAR(10),
            tv_recharge_comment TEXT DEFAULT '',
            camera_wifi DECIMAL(10, 2) DEFAULT 0,
            camera_wifi_method VARCHAR(10),
            camera_wifi_comment TEXT DEFAULT '',
            plumbing_maintenance DECIMAL(10, 2) DEFAULT 0,
            plumbing_maintenance_method VARCHAR(10),
            plumbing_maintenance_comment TEXT DEFAULT '',
            electricity_maintenance DECIMAL(10, 2) DEFAULT 0,
            electricity_maintenance_method VARCHAR(10),
            electricity_maintenance_comment TEXT DEFAULT '',
            electricity_bill DECIMAL(10, 2) DEFAULT 0,
            electricity_bill_method VARCHAR(10),
            electricity_bill_comment TEXT DEFAULT '',
            staff_fooding DECIMAL(10, 2) DEFAULT 0,
            staff_fooding_method VARCHAR(10),
            staff_fooding_comment TEXT DEFAULT '',
            laundry DECIMAL(10, 2) DEFAULT 0,
            laundry_method VARCHAR(10),
            laundry_comment TEXT DEFAULT '',
            owner_kitchen_cab DECIMAL(10, 2) DEFAULT 0,
            owner_kitchen_cab_method VARCHAR(10),
            owner_kitchen_cab_comment TEXT DEFAULT '',
            office_stationary DECIMAL(10, 2) DEFAULT 0,
            office_stationary_method VARCHAR(10),
            office_stationary_comment TEXT DEFAULT '',
            misc_expenses DECIMAL(10, 2) DEFAULT 0,
            misc_expenses_method VARCHAR(10),
            misc_expenses_comment TEXT DEFAULT '',
            total_expense DECIMAL(10, 2),
            
            closing_balance DECIMAL(10, 2)
        )'''
    else:
        create_table_query = '''CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            opening_balance REAL,
            
            room_rent REAL DEFAULT 0,
            room_rent_method TEXT,
            room_rent_comment TEXT DEFAULT '',
            mattress_charge REAL DEFAULT 0,
            mattress_charge_method TEXT,
            mattress_charge_comment TEXT DEFAULT '',
            travel_cab REAL DEFAULT 0,
            travel_cab_method TEXT,
            travel_cab_comment TEXT DEFAULT '',
            kitchen_facility REAL DEFAULT 0,
            kitchen_facility_method TEXT,
            kitchen_facility_comment TEXT DEFAULT '',
            clean_charge REAL DEFAULT 0,
            clean_charge_method TEXT,
            clean_charge_comment TEXT DEFAULT '',
            misc_receipt REAL DEFAULT 0,
            misc_receipt_method TEXT,
            misc_receipt_comment TEXT DEFAULT '',
            total_income REAL,
            
            brokerage REAL DEFAULT 0,
            brokerage_method TEXT,
            brokerage_comment TEXT DEFAULT '',
            salary REAL DEFAULT 0,
            salary_method TEXT,
            salary_comment TEXT DEFAULT '',
            room_cleaning_charge REAL DEFAULT 0,
            room_cleaning_charge_method TEXT,
            room_cleaning_charge_comment TEXT DEFAULT '',
            generator_maintenance REAL DEFAULT 0,
            generator_maintenance_method TEXT,
            generator_maintenance_comment TEXT DEFAULT '',
            hotel_stationary REAL DEFAULT 0,
            hotel_stationary_method TEXT,
            hotel_stationary_comment TEXT DEFAULT '',
            hotel_cleaning_sanitation REAL DEFAULT 0,
            hotel_cleaning_sanitation_method TEXT,
            hotel_cleaning_sanitation_comment TEXT DEFAULT '',
            rent_taxes REAL DEFAULT 0,
            rent_taxes_method TEXT,
            rent_taxes_comment TEXT DEFAULT '',
            tv_recharge REAL DEFAULT 0,
            tv_recharge_method TEXT,
            tv_recharge_comment TEXT DEFAULT '',
            camera_wifi REAL DEFAULT 0,
            camera_wifi_method TEXT,
            camera_wifi_comment TEXT DEFAULT '',
            plumbing_maintenance REAL DEFAULT 0,
            plumbing_maintenance_method TEXT,
            plumbing_maintenance_comment TEXT DEFAULT '',
            electricity_maintenance REAL DEFAULT 0,
            electricity_maintenance_method TEXT,
            electricity_maintenance_comment TEXT DEFAULT '',
            electricity_bill REAL DEFAULT 0,
            electricity_bill_method TEXT,
            electricity_bill_comment TEXT DEFAULT '',
            staff_fooding REAL DEFAULT 0,
            staff_fooding_method TEXT,
            staff_fooding_comment TEXT DEFAULT '',
            laundry REAL DEFAULT 0,
            laundry_method TEXT,
            laundry_comment TEXT DEFAULT '',
            owner_kitchen_cab REAL DEFAULT 0,
            owner_kitchen_cab_method TEXT,
            owner_kitchen_cab_comment TEXT DEFAULT '',
            office_stationary REAL DEFAULT 0,
            office_stationary_method TEXT,
            office_stationary_comment TEXT DEFAULT '',
            misc_expenses REAL DEFAULT 0,
            misc_expenses_method TEXT,
            misc_expenses_comment TEXT DEFAULT '',
            total_expense REAL,
            
            closing_balance REAL
        )'''
    
    execute_query(create_table_query)
    
    # Create users table
    if USE_MYSQL:
        users_table_query = '''CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(20) DEFAULT 'contributor',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )'''
    else:
        users_table_query = '''CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'contributor',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )'''
    
    execute_query(users_table_query)
    
    # Create salary_records table
    if USE_MYSQL:
        salary_table_query = '''CREATE TABLE IF NOT EXISTS salary_records (
            id INT AUTO_INCREMENT PRIMARY KEY,
            date DATE NOT NULL,
            employee_name VARCHAR(50) NOT NULL,
            payment_type VARCHAR(20) NOT NULL,
            amount DECIMAL(10, 2) NOT NULL,
            payment_method VARCHAR(10) NOT NULL,
            note TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )'''
    else:
        salary_table_query = '''CREATE TABLE IF NOT EXISTS salary_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            employee_name TEXT NOT NULL,
            payment_type TEXT NOT NULL,
            amount REAL NOT NULL,
            payment_method TEXT NOT NULL,
            note TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )'''
    
    execute_query(salary_table_query)
    
    # Create indexes for performance
    execute_query("CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)")
    execute_query("CREATE INDEX IF NOT EXISTS idx_transactions_id_desc ON transactions(id DESC)")
    execute_query("CREATE INDEX IF NOT EXISTS idx_salary_date ON salary_records(date)")
    execute_query("CREATE INDEX IF NOT EXISTS idx_salary_employee ON salary_records(employee_name)")
    
    # Create settings table for dynamic employees and categories
    if USE_MYSQL:
        settings_table_query = '''CREATE TABLE IF NOT EXISTS settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            type VARCHAR(50) NOT NULL,
            key_id VARCHAR(100) NOT NULL,
            label VARCHAR(200) NOT NULL,
            sort_order INT DEFAULT 0,
            active TINYINT DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_type_key (type, key_id)
        )'''
    else:
        settings_table_query = '''CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            key_id TEXT NOT NULL,
            label TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0,
            active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(type, key_id)
        )'''
    
    execute_query(settings_table_query)
    
    # Seed default settings if empty
    existing_settings = execute_query("SELECT COUNT(*) as cnt FROM settings", fetch=True, fetchone=True)
    if existing_settings and existing_settings['cnt'] == 0:
        placeholder = '%s' if USE_MYSQL else '?'
        defaults = [
            ('employee', 'shakti', 'Shakti', 1),
            ('employee', 'kabu', 'Kabu', 2),
            ('employee', 'kiran', 'Kiran', 3),
            ('employee', 'purna', 'Purna', 4),
            ('income_category', 'roomRent', 'Room Rent', 1),
            ('income_category', 'mattressCharge', 'Mattress Charge', 2),
            ('income_category', 'travelCab', 'Travel/Cab Service', 3),
            ('income_category', 'kitchenFacility', 'Kitchen Facility', 4),
            ('income_category', 'cleanCharge', 'Cleaning Charge', 5),
            ('income_category', 'miscReceipt', 'Misc Receipt', 6),
            ('expense_category', 'brokerage', 'Brokerage', 1),
            ('expense_category', 'salary', 'Salary', 2),
            ('expense_category', 'roomCleaningCharge', 'Room Cleaning Charge', 3),
            ('expense_category', 'generatorMaintenance', 'Generator & Maintenance', 4),
            ('expense_category', 'hotelStationary', 'Hotel Stationary', 5),
            ('expense_category', 'hotelCleaningSanitation', 'Hotel Cleaning and Sanitation', 6),
            ('expense_category', 'rentTaxes', 'Rent & Taxes', 7),
            ('expense_category', 'tvRecharge', 'TV Recharge', 8),
            ('expense_category', 'cameraWifi', 'Camera/WiFi', 9),
            ('expense_category', 'plumbingMaintenance', 'Plumbing & Maintenance', 10),
            ('expense_category', 'electricityMaintenance', 'Electricity & Maintenance', 11),
            ('expense_category', 'electricityBill', 'Electricity Bill', 12),
            ('expense_category', 'staffFooding', 'Staff Fooding', 13),
            ('expense_category', 'laundry', 'Laundry', 14),
            ('expense_category', 'ownerKitchenCab', 'Owner Kitchen & Cab Payment', 15),
            ('expense_category', 'officeStationary', 'Office Stationary', 16),
            ('expense_category', 'miscExpenses', 'Misc Expenses', 17),
        ]
        for item in defaults:
            execute_query(
                f"INSERT INTO settings (type, key_id, label, sort_order) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder})",
                item
            )
        print("Default settings seeded (employees, income/expense categories)")
    
    # Create default owner user (username: admin, password: admin123)
    # Password is hashed using PBKDF2-SHA256 with salt
    default_password_hash = hash_password('admin123')
    
    # Check if default user exists
    check_user_query = "SELECT id FROM users WHERE username = 'admin'"
    existing_user = execute_query(check_user_query, fetch=True, fetchone=True)
    
    if not existing_user:
        placeholder = '%s' if USE_MYSQL else '?'
        insert_user_query = f"INSERT INTO users (username, password_hash, role) VALUES ({placeholder}, {placeholder}, {placeholder})"
        execute_query(insert_user_query, ('admin', default_password_hash, 'owner'))
        print("Default owner user created - Username: admin, Password: admin123, Role: owner")
    
    db_type = "MySQL" if USE_MYSQL else "SQLite"
    print(f"Database initialized successfully ({db_type})")

# Audit logging function
def audit_log(action, success=True, details=None):
    """Log security-relevant actions"""
    log_entry = {
        'timestamp': datetime.now().isoformat(),
        'user_id': session.get('user_id'),
        'username': session.get('username'),
        'action': action,
        'success': success,
        'details': details or {},
        'ip': request.remote_addr,
        'user_agent': request.user_agent.string[:100] if request.user_agent else 'Unknown'
    }
    
    try:
        with open('audit.log', 'a') as f:
            f.write(json.dumps(log_entry) + '\n')
    except Exception as e:
        print(f"Error writing audit log: {e}")

# Helper function to hash passwords with salt
def hash_password(password):
    """Hash password with salt using PBKDF2-SHA256"""
    return generate_password_hash(password, method='pbkdf2:sha256', salt_length=16)

def verify_password(stored_hash, provided_password):
    """Verify password against stored hash"""
    return check_password_hash(stored_hash, provided_password)

# Input validation helpers
def validate_decimal(value, field_name, min_value=0):
    """Validate decimal input"""
    try:
        decimal_value = Decimal(str(value))
        if decimal_value < min_value:
            raise ValueError(f"{field_name} cannot be less than {min_value}")
        return float(decimal_value)
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError(f"Invalid {field_name}")

def validate_date(date_string):
    """Validate date format"""
    if not date_string:
        return None
    try:
        return datetime.strptime(date_string, '%Y-%m-%d').strftime('%Y-%m-%d')
    except ValueError:
        raise ValueError("Invalid date format. Use YYYY-MM-DD")

def validate_payment_method(method):
    """Validate payment method"""
    if method not in ['cash', 'upi', None, '']:
        raise ValueError("Payment method must be 'cash' or 'upi'")
    return method

# Shared constants and utilities
def camel_to_snake(name):
    return re.sub(r'([A-Z])', r'_\1', name).lower()

KNOWN_INCOME_KEYS = ['roomRent', 'mattressCharge', 'travelCab', 'kitchenFacility', 'cleanCharge', 'miscReceipt']
KNOWN_EXPENSE_KEYS = ['brokerage', 'salary', 'roomCleaningCharge', 'generatorMaintenance',
                     'hotelStationary', 'hotelCleaningSanitation', 'rentTaxes', 'tvRecharge',
                     'cameraWifi', 'plumbingMaintenance', 'electricityMaintenance', 'electricityBill',
                     'staffFooding', 'laundry', 'ownerKitchenCab', 'officeStationary', 'miscExpenses']

def build_transaction_columns_values(data, entry_date):
    """Build columns and values for INSERT/UPDATE from transaction data."""
    placeholder = '%s' if USE_MYSQL else '?'
    columns = ['date', 'opening_balance']
    values_list = [entry_date, data['openingBalance']]
    
    for key in KNOWN_INCOME_KEYS:
        cat_data = data.get('income', {}).get(key, {})
        if isinstance(cat_data, dict):
            snake = camel_to_snake(key)
            columns.extend([snake, f'{snake}_method', f'{snake}_comment'])
            values_list.extend([cat_data.get('amount', 0), cat_data.get('method', ''), cat_data.get('comment', '')])
    
    columns.append('total_income')
    values_list.append(data.get('income', {}).get('totalIncome', 0))
    
    for key in KNOWN_EXPENSE_KEYS:
        cat_data = data.get('expense', {}).get(key, {})
        if isinstance(cat_data, dict):
            snake = camel_to_snake(key)
            columns.extend([snake, f'{snake}_method', f'{snake}_comment'])
            values_list.extend([cat_data.get('amount', 0), cat_data.get('method', ''), cat_data.get('comment', '')])
    
    columns.extend(['total_expense', 'closing_balance'])
    values_list.extend([data.get('expense', {}).get('totalExpense', 0), data['closingBalance']])
    
    return columns, values_list

# Session timeout check
@app.before_request
def check_session_timeout():
    """Check for session timeout on inactivity"""
    # Skip for login, logout, and static files
    if request.endpoint in ['login', 'logout', 'serve_static', 'index']:
        return
    
    # Skip for unauthenticated requests
    if 'user_id' not in session:
        return
    
    last_activity = session.get('last_activity')
    now = datetime.now().timestamp()
    
    if last_activity:
        if (now - last_activity) > SESSION_TIMEOUT:
            username = session.get('username')
            session.clear()
            audit_log('SESSION_TIMEOUT', success=True, details={'reason': 'Inactivity timeout'})
            return jsonify({'error': 'Session expired due to inactivity'}), 401
    
    session['last_activity'] = now

# Serve static files
ALLOWED_EXTENSIONS = {'.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf'}

@app.route('/')
def index():
    return send_from_directory('.', 'login.html')

# Authentication Routes
@app.route('/api/login', methods=['POST'])
@limiter.limit("5 per minute")  # Max 5 login attempts per minute
def login():
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            audit_log('LOGIN', success=False, details={'reason': 'Missing credentials'})
            return jsonify({'error': 'Username and password are required'}), 400
        
        # Get user by username only (password_hash included for verification)
        placeholder = '%s' if USE_MYSQL else '?'
        query = f"SELECT id, username, role, password_hash FROM users WHERE username = {placeholder}"
        user = execute_query(query, (username,), fetch=True, fetchone=True)
        
        # Verify password with salt
        if user and verify_password(user['password_hash'], password):
            # Set session
            session['user_id'] = user['id']
            session['username'] = user['username']
            session['role'] = user['role']
            session['last_activity'] = datetime.now().timestamp()
            session.permanent = True
            
            audit_log('LOGIN', success=True, details={'username': username})
            
            return jsonify({
                'message': 'Login successful',
                'username': user['username'],
                'role': user['role']
            }), 200
        else:
            audit_log('LOGIN', success=False, details={'username': username, 'reason': 'Invalid credentials'})
            return jsonify({'error': 'Invalid username or password'}), 401
            
    except Exception as e:
        print(f"Login error: {e}")
        audit_log('LOGIN', success=False, details={'error': str(e)})
        return jsonify({'error': 'An error occurred during login'}), 500

@app.route('/api/logout', methods=['POST'])
def logout():
    username = session.get('username')
    audit_log('LOGOUT', success=True, details={'username': username})
    session.clear()
    return jsonify({'message': 'Logged out successfully'}), 200

@app.route('/api/check-auth', methods=['GET'])
def check_auth():
    if 'user_id' in session:
        return jsonify({
            'authenticated': True,
            'username': session.get('username')
        }), 200
    else:
        return jsonify({'authenticated': False}), 401

@app.route('/api/transactions', methods=['POST'])
def save_transaction():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        
        data = request.json
        
        # Validate opening balance
        try:
            opening_balance = validate_decimal(data.get('openingBalance', 0), 'Opening balance')
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        
        # Validate date if provided
        entry_date = data.get('entryDate')
        if entry_date:
            try:
                entry_date = validate_date(entry_date)
            except ValueError as e:
                return jsonify({'error': str(e)}), 400
        
        # Use %s for MySQL, ? for SQLite
        placeholder = '%s' if USE_MYSQL else '?'
        
        columns, values_list = build_transaction_columns_values(data, entry_date)
        
        placeholders_str = ', '.join([placeholder] * len(columns))
        columns_str = ', '.join(columns)
        
        query = f'INSERT INTO transactions ({columns_str}) VALUES ({placeholders_str})'
        
        transaction_id = execute_query(query, tuple(values_list))
        
        # Also save salary entries to salary_records table
        salary_data = data.get('expense', {}).get('salary', {})
        salary_amount = salary_data.get('amount', 0) if isinstance(salary_data, dict) else 0
        salary_comment = salary_data.get('comment', '') if isinstance(salary_data, dict) else ''
        
        if salary_amount > 0 and salary_comment:
            # Parse salary comment format: (₹5000 - CASH - Shakti - Advance - Note) | (₹3000 - UPI - Kabu - Full)
            entries = salary_comment.split('|')
            
            for entry in entries:
                entry = entry.strip()
                # Match pattern: (₹amount - METHOD - EmployeeName - PaymentType - Note) or (₹amount - METHOD - EmployeeName - PaymentType)
                print(f"DEBUG: Parsing entry: {entry}")
                match = re.match(r'\(₹([\d.]+)\s*-\s*(\w+)\s*-\s*(\w+)(?:\s*-\s*(\w+))?(?:\s*-\s*(.+))?\)', entry)
                if match:
                    amount = float(match.group(1))
                    payment_method = match.group(2).lower()
                    employee_name = match.group(3)
                    payment_type = match.group(4) if match.group(4) else 'Full'
                    note = match.group(5) if match.group(5) else ''
                    
                    print(f"DEBUG: Parsed - employee: {employee_name}, type: {payment_type}, amount: {amount}, method: {payment_method}, note: {note}")
                    
                    # Validate payment type
                    if payment_type not in ['Advance', 'Full']:
                        # If 4th group is not a valid payment type, it might be a note from old format
                        note = payment_type if payment_type else ''
                        payment_type = 'Full'
                        print(f"DEBUG: Adjusted - type: {payment_type}, note: {note}")
                    
                    # Insert into salary_records
                    salary_query = f'''INSERT INTO salary_records 
                        (date, employee_name, payment_type, amount, payment_method, note)
                        VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})'''
                    
                    salary_values = (
                        entry_date,
                        employee_name,
                        payment_type,
                        amount,
                        payment_method,
                        note
                    )
                    
                    execute_query(salary_query, salary_values)
        
        return jsonify({'id': transaction_id, 'message': 'Transaction saved successfully'}), 200
    except Exception as e:
        print(f"Error saving transaction: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        
        # Get limit from query parameter, default to 50
        limit = request.args.get('limit', 50, type=int)
        
        placeholder = '%s' if USE_MYSQL else '?'
        query = f'SELECT * FROM transactions ORDER BY id DESC LIMIT {placeholder}'
        
        transactions = execute_query(query, (limit,), fetch=True)
        
        return jsonify(transactions), 200
    except Exception as e:
        print(f"Error fetching transactions: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/transactions/<int:transaction_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_transaction(transaction_id):
    """Handle GET, PUT, and DELETE operations for a single transaction"""
    
    if request.method == 'GET':
        try:
            placeholder = '%s' if USE_MYSQL else '?'
            query = f'SELECT * FROM transactions WHERE id = {placeholder}'
            transaction = execute_query(query, (transaction_id,), fetch=True, fetchone=True)
            
            if not transaction:
                return jsonify({'error': 'Transaction not found'}), 404
            
            return jsonify(transaction), 200
        except Exception as e:
            print(f"Error fetching transaction: {e}")
            return jsonify({'error': str(e)}), 500
    
    elif request.method == 'PUT':
        try:
            if 'user_id' not in session:
                return jsonify({'error': 'Not authenticated'}), 401
            
            data = request.json
            
            # Validate opening balance
            try:
                opening_balance = validate_decimal(data.get('openingBalance', 0), 'Opening balance')
            except ValueError as e:
                return jsonify({'error': str(e)}), 400
            
            # Validate date if provided
            entry_date = data.get('entryDate')
            if entry_date:
                try:
                    entry_date = validate_date(entry_date)
                except ValueError as e:
                    return jsonify({'error': str(e)}), 400
            
            placeholder = '%s' if USE_MYSQL else '?'
            
            # Known columns in the database
            columns, values_list = build_transaction_columns_values(data, entry_date)
            
            set_parts = [f'{col} = {placeholder}' for col in columns]
            values_list.append(transaction_id)
            
            query = f"UPDATE transactions SET {', '.join(set_parts)} WHERE id = {placeholder}"
            
            execute_query(query, tuple(values_list))
            
            return jsonify({'id': transaction_id, 'message': 'Transaction updated successfully'}), 200
        except Exception as e:
            print(f"Error updating transaction: {e}")
            return jsonify({'error': str(e)}), 500
    
    elif request.method == 'DELETE':
        try:
            # Check if user is logged in and is owner
            if 'user_id' not in session:
                audit_log('DELETE_TRANSACTION', success=False, details={'transaction_id': transaction_id, 'reason': 'Not authenticated'})
                return jsonify({'error': 'Not authenticated'}), 401
            
            if session.get('role') != 'owner':
                audit_log('DELETE_TRANSACTION', success=False, details={'transaction_id': transaction_id, 'reason': 'Insufficient permissions', 'role': session.get('role')})
                return jsonify({'error': 'Only owners can delete transactions'}), 403
            
            # Delete the transaction
            placeholder = '%s' if USE_MYSQL else '?'
            delete_query = f'DELETE FROM transactions WHERE id = {placeholder}'
            execute_query(delete_query, (transaction_id,))
            
            audit_log('DELETE_TRANSACTION', success=True, details={'transaction_id': transaction_id})
            return jsonify({'message': 'Transaction deleted successfully'}), 200
        except Exception as e:
            print(f"Error deleting transaction: {e}")
            audit_log('DELETE_TRANSACTION', success=False, details={'transaction_id': transaction_id, 'error': str(e)})
            return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/balances', methods=['GET'])
def get_balances():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        
        income_fields = ['room_rent', 'mattress_charge', 'travel_cab', 'kitchen_facility', 'clean_charge', 'misc_receipt']
        expense_fields = ['brokerage', 'salary', 'room_cleaning_charge', 'generator_maintenance', 'hotel_stationary', 'hotel_cleaning_sanitation', 'rent_taxes', 'tv_recharge', 'camera_wifi', 'plumbing_maintenance', 'electricity_maintenance', 'electricity_bill', 'staff_fooding', 'laundry', 'owner_kitchen_cab', 'office_stationary', 'misc_expenses']
        
        # Build SQL with CASE WHEN for cash/upi aggregation
        parts = []
        for f in income_fields + expense_fields:
            parts.append(f"SUM(CASE WHEN {f}_method='cash' THEN {f} ELSE 0 END) as {f}_cash")
            parts.append(f"SUM(CASE WHEN {f}_method='upi' THEN {f} ELSE 0 END) as {f}_upi")
        parts.append("COUNT(*) as cnt")
        
        query = f"SELECT {', '.join(parts)} FROM transactions"
        result = execute_query(query, fetch=True, fetchone=True)
        
        cash_income = sum(float(result.get(f'{f}_cash', 0) or 0) for f in income_fields)
        upi_income = sum(float(result.get(f'{f}_upi', 0) or 0) for f in income_fields)
        cash_expense = sum(float(result.get(f'{f}_cash', 0) or 0) for f in expense_fields)
        upi_expense = sum(float(result.get(f'{f}_upi', 0) or 0) for f in expense_fields)
        
        cash_balance = cash_income - cash_expense
        upi_balance = upi_income - upi_expense
        
        # Get the last transaction's closing balance
        last_transaction = execute_query(
            'SELECT closing_balance FROM transactions ORDER BY id DESC LIMIT 1',
            fetch=True, fetchone=True
        )
        total_balance = last_transaction['closing_balance'] if last_transaction and last_transaction['closing_balance'] is not None else 0
        
        return jsonify({
            'cashIncome': f"{cash_income:.2f}",
            'cashExpense': f"{cash_expense:.2f}",
            'cashBalance': f"{cash_balance:.2f}",
            'upiIncome': f"{upi_income:.2f}",
            'upiExpense': f"{upi_expense:.2f}",
            'upiBalance': f"{upi_balance:.2f}",
            'totalBalance': f"{total_balance:.2f}",
            'transactionCount': result.get('cnt', 0)
        }), 200
    except Exception as e:
        print(f"Error calculating balances: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/category-totals', methods=['GET'])
def get_category_totals():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        
        income_fields = ['room_rent', 'mattress_charge', 'travel_cab', 'kitchen_facility', 'clean_charge', 'misc_receipt']
        expense_fields = ['brokerage', 'salary', 'room_cleaning_charge', 'generator_maintenance', 'hotel_stationary', 'hotel_cleaning_sanitation', 'rent_taxes', 'tv_recharge', 'camera_wifi', 'plumbing_maintenance', 'electricity_maintenance', 'electricity_bill', 'staff_fooding', 'laundry', 'owner_kitchen_cab', 'office_stationary', 'misc_expenses']
        
        all_fields = income_fields + expense_fields
        sums = ', '.join(f"COALESCE(SUM({f}), 0) as {f}" for f in all_fields)
        query = f"SELECT {sums} FROM transactions"
        result = execute_query(query, fetch=True, fetchone=True)
        
        income_totals = {f: float(result.get(f, 0) or 0) for f in income_fields}
        expense_totals = {f: float(result.get(f, 0) or 0) for f in expense_fields}
        
        return jsonify({
            'income': income_totals,
            'expense': expense_totals
        }), 200
    except Exception as e:
        print(f"Error calculating category totals: {e}")
        return jsonify({'error': str(e)}), 500

# Salary Records API
@app.route('/api/salary-records', methods=['POST'])
def create_salary_records():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401

        data = request.json
        records = data.get('records', [])

        if not records:
            return jsonify({'error': 'No records provided'}), 400

        placeholder = '%s' if USE_MYSQL else '?'
        saved_count = 0

        # Calculate totals by payment method for the transaction
        total_salary = 0
        cash_salary = 0
        upi_salary = 0
        salary_comments = []

        for record in records:
            query = f'''INSERT INTO salary_records 
                (date, employee_name, payment_type, amount, payment_method, note)
                VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})'''
            
            values = (
                record['date'],
                record['employeeName'],
                record['paymentType'],
                record['amount'],
                record['paymentMethod'],
                record.get('note', '')
            )
            
            execute_query(query, values)
            saved_count += 1
            
            amount = float(record['amount'])
            total_salary += amount
            if record['paymentMethod'] == 'cash':
                cash_salary += amount
            else:
                upi_salary += amount
            salary_comments.append(f"(₹{amount:.2f} - {record['paymentMethod'].upper()} - {record['employeeName']} - {record['paymentType']})")

        # Create a transaction entry so it reflects on dashboard
        # Get last closing balance
        last_tx = execute_query(
            'SELECT closing_balance FROM transactions ORDER BY id DESC LIMIT 1',
            fetch=True, fetchone=True
        )
        opening_balance = float(last_tx['closing_balance']) if last_tx and last_tx['closing_balance'] is not None else 0
        closing_balance = opening_balance - total_salary
        
        # Determine primary method (whichever has higher amount)
        salary_method = 'cash' if cash_salary >= upi_salary else 'upi'
        comment_str = ' | '.join(salary_comments)
        
        # Insert transaction with salary expense
        tx_columns = ['date', 'opening_balance', 'salary', 'salary_method', 'salary_comment', 'total_income', 'total_expense', 'closing_balance']
        tx_values = [records[0]['date'], opening_balance, total_salary, salary_method, comment_str, 0, total_salary, closing_balance]
        
        placeholders_str = ', '.join([placeholder] * len(tx_columns))
        columns_str = ', '.join(tx_columns)
        execute_query(f'INSERT INTO transactions ({columns_str}) VALUES ({placeholders_str})', tuple(tx_values))

        return jsonify({'message': f'{saved_count} record(s) saved successfully', 'count': saved_count}), 200
    except Exception as e:
        print(f"Error saving salary records: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/salary-records', methods=['GET'])
def get_salary_records():
    try:
        limit = request.args.get('limit', 100, type=int)
        
        placeholder = '%s' if USE_MYSQL else '?'
        group_concat = 'GROUP_CONCAT' if USE_MYSQL else 'group_concat'
        
        # Group by date and get summary
        query = f'''
            SELECT 
                date,
                COUNT(*) as employee_count,
                SUM(amount) as total_amount,
                {group_concat}(employee_name) as employees,
                MIN(id) as record_id
            FROM salary_records 
            GROUP BY date 
            ORDER BY date DESC 
            LIMIT {placeholder}
        '''
        
        records = execute_query(query, (limit,), fetch=True)
        
        return jsonify(records), 200
    except Exception as e:
        print(f"Error loading salary records: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/salary-records/all', methods=['GET'])
def get_all_salary_records():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        records = execute_query('SELECT * FROM salary_records ORDER BY date DESC', fetch=True)
        return jsonify(records), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/salary-records/details/<date>', methods=['GET'])
def get_salary_records_by_date(date):
    try:
        placeholder = '%s' if USE_MYSQL else '?'
        query = f'SELECT * FROM salary_records WHERE DATE(date) = DATE({placeholder}) ORDER BY employee_name'
        
        records = execute_query(query, (date,), fetch=True)
        
        return jsonify(records), 200
    except Exception as e:
        print(f"Error loading salary record details: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/salary-records/<int:record_id>', methods=['DELETE'])
def delete_salary_record(record_id):
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        
        if session.get('role') != 'owner':
            return jsonify({'error': 'Only owners can delete salary records'}), 403

        placeholder = '%s' if USE_MYSQL else '?'
        delete_query = f'DELETE FROM salary_records WHERE id = {placeholder}'
        execute_query(delete_query, (record_id,))
        
        return jsonify({'message': 'Salary record deleted successfully'}), 200
    except Exception as e:
        print(f"Error deleting salary record: {e}")
        return jsonify({'error': str(e)}), 500

# Settings API
@app.route('/api/settings', methods=['GET'])
def get_settings():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        
        setting_type = request.args.get('type')
        placeholder = '%s' if USE_MYSQL else '?'
        
        if setting_type:
            query = f"SELECT * FROM settings WHERE type = {placeholder} AND active = 1 ORDER BY sort_order"
            items = execute_query(query, (setting_type,), fetch=True)
        else:
            items = execute_query("SELECT * FROM settings WHERE active = 1 ORDER BY type, sort_order", fetch=True)
        
        return jsonify(items), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/settings', methods=['POST'])
def add_setting():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        if session.get('role') != 'owner':
            return jsonify({'error': 'Only owners can modify settings'}), 403
        
        data = request.json
        setting_type = data.get('type')
        key_id = data.get('key_id')
        label = data.get('label')
        
        if not all([setting_type, key_id, label]):
            return jsonify({'error': 'type, key_id, and label are required'}), 400
        
        if setting_type not in ('employee', 'income_category', 'expense_category'):
            return jsonify({'error': 'Invalid type'}), 400
        
        placeholder = '%s' if USE_MYSQL else '?'
        
        # Check if a soft-deleted entry exists with same type and key_id
        existing = execute_query(
            f"SELECT id, active FROM settings WHERE type = {placeholder} AND key_id = {placeholder}",
            (setting_type, key_id), fetch=True, fetchone=True
        )
        
        if existing:
            if existing['active'] == 1:
                return jsonify({'error': 'This key_id already exists for this type'}), 409
            # Reactivate the soft-deleted entry
            execute_query(
                f"UPDATE settings SET active = 1, label = {placeholder} WHERE id = {placeholder}",
                (label, existing['id'])
            )
            return jsonify({'message': 'Setting reactivated successfully'}), 200
        
        # Get next sort_order
        max_order = execute_query(
            f"SELECT MAX(sort_order) as max_order FROM settings WHERE type = {placeholder}",
            (setting_type,), fetch=True, fetchone=True
        )
        next_order = (max_order['max_order'] or 0) + 1
        
        execute_query(
            f"INSERT INTO settings (type, key_id, label, sort_order) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder})",
            (setting_type, key_id, label, next_order)
        )
        
        return jsonify({'message': 'Setting added successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/settings/<int:setting_id>', methods=['PUT'])
def update_setting(setting_id):
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        if session.get('role') != 'owner':
            return jsonify({'error': 'Only owners can modify settings'}), 403
        
        data = request.json
        label = data.get('label')
        
        if not label:
            return jsonify({'error': 'label is required'}), 400
        
        placeholder = '%s' if USE_MYSQL else '?'
        execute_query(
            f"UPDATE settings SET label = {placeholder} WHERE id = {placeholder}",
            (label, setting_id)
        )
        
        return jsonify({'message': 'Setting updated'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/settings/<int:setting_id>', methods=['DELETE'])
def delete_setting(setting_id):
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        if session.get('role') != 'owner':
            return jsonify({'error': 'Only owners can modify settings'}), 403
        
        placeholder = '%s' if USE_MYSQL else '?'
        # Soft delete - mark as inactive
        execute_query(
            f"UPDATE settings SET active = 0 WHERE id = {placeholder}",
            (setting_id,)
        )
        
        return jsonify({'message': 'Setting removed'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Catch-all static file route (must be AFTER all API routes)
@app.route('/<path:path>')
def serve_static(path):
    ext = os.path.splitext(path)[1].lower()
    basename = os.path.basename(path)
    if ext not in ALLOWED_EXTENSIONS or basename.startswith('.') or '..' in path:
        return jsonify({'error': 'Not found'}), 404
    return send_from_directory('.', path)

# Initialize database on startup
try:
    print("[server.py] Initializing database...")
    print(f"[server.py] USE_MYSQL = {USE_MYSQL}")
    if USE_MYSQL:
        print(f"[server.py] DB_HOST = {MYSQL_CONFIG['host']}")
        print(f"[server.py] DB_USER = {MYSQL_CONFIG['user']}")
        print(f"[server.py] DB_NAME = {MYSQL_CONFIG['database']}")
    init_db()
    print("[server.py] Database initialized successfully")
except Exception as e:
    print(f"[server.py] ERROR: Failed to initialize database: {e}")
    import traceback
    traceback.print_exc()
    # Don't crash the app, but log the error
    print("[server.py] App will continue but database may not be accessible")

if __name__ == '__main__':
    print("=" * 50)
    print("Financial Dashboard Server Starting...")
    print("=" * 50)
    print("Dashboard: http://localhost:5000/dashboard.html")
    print("Categories: http://localhost:5000/categories.html")
    print("Form: http://localhost:5000/form.html")
    print("=" * 50)
    app.run(debug=False, host='0.0.0.0', port=5000)
