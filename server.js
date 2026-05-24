from flask import Flask, request, jsonify, send_from_directory, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
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
app.config['SESSION_COOKIE_SECURE'] = not app.debug  # Secure cookies in production
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)

# Session timeout (30 minutes of inactivity)
SESSION_TIMEOUT = 1800  # seconds

# Configure CORS - allow from environment or default to localhost
ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS', 'http://localhost:5000').split(',')
CORS(app, 
     supports_credentials=True, 
     origins=ALLOWED_ORIGINS,
     methods=['GET', 'POST', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type'])

# Rate limiting
if LIMITER_AVAILABLE:
    limiter = Limiter(
        app=app,
        key_func=get_remote_address,
        default_limits=["200 per day", "50 per hour"],
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
                port=MYSQL_CONFIG['port']
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
                columns = [desc[0] for desc in cursor.description]
                rows = cursor.fetchall()
                result = [dict(zip(columns, row)) for row in rows]
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
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {MYSQL_CONFIG['database']}")
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
            mattress_charge DECIMAL(10, 2) DEFAULT 0,
            mattress_charge_method VARCHAR(10),
            travel_cab DECIMAL(10, 2) DEFAULT 0,
            travel_cab_method VARCHAR(10),
            kitchen_facility DECIMAL(10, 2) DEFAULT 0,
            kitchen_facility_method VARCHAR(10),
            clean_charge DECIMAL(10, 2) DEFAULT 0,
            clean_charge_method VARCHAR(10),
            misc_receipt DECIMAL(10, 2) DEFAULT 0,
            misc_receipt_method VARCHAR(10),
            total_income DECIMAL(10, 2),
            
            brokerage DECIMAL(10, 2) DEFAULT 0,
            brokerage_method VARCHAR(10),
            salary DECIMAL(10, 2) DEFAULT 0,
            salary_method VARCHAR(10),
            room_cleaning_charge DECIMAL(10, 2) DEFAULT 0,
            room_cleaning_charge_method VARCHAR(10),
            generator_maintenance DECIMAL(10, 2) DEFAULT 0,
            generator_maintenance_method VARCHAR(10),
            hotel_stationary DECIMAL(10, 2) DEFAULT 0,
            hotel_stationary_method VARCHAR(10),
            hotel_cleaning_sanitation DECIMAL(10, 2) DEFAULT 0,
            hotel_cleaning_sanitation_method VARCHAR(10),
            rent_taxes DECIMAL(10, 2) DEFAULT 0,
            rent_taxes_method VARCHAR(10),
            tv_recharge DECIMAL(10, 2) DEFAULT 0,
            tv_recharge_method VARCHAR(10),
            camera_wifi DECIMAL(10, 2) DEFAULT 0,
            camera_wifi_method VARCHAR(10),
            plumbing_maintenance DECIMAL(10, 2) DEFAULT 0,
            plumbing_maintenance_method VARCHAR(10),
            electricity_maintenance DECIMAL(10, 2) DEFAULT 0,
            electricity_maintenance_method VARCHAR(10),
            electricity_bill DECIMAL(10, 2) DEFAULT 0,
            electricity_bill_method VARCHAR(10),
            staff_fooding DECIMAL(10, 2) DEFAULT 0,
            staff_fooding_method VARCHAR(10),
            laundry DECIMAL(10, 2) DEFAULT 0,
            laundry_method VARCHAR(10),
            owner_kitchen_cab DECIMAL(10, 2) DEFAULT 0,
            owner_kitchen_cab_method VARCHAR(10),
            office_stationary DECIMAL(10, 2) DEFAULT 0,
            office_stationary_method VARCHAR(10),
            misc_expenses DECIMAL(10, 2) DEFAULT 0,
            misc_expenses_method VARCHAR(10),
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
@app.route('/')
def index():
    return send_from_directory('.', 'login.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

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
        
        # Get the user-selected date or use current timestamp
        entry_date = data.get('entryDate', None)
        
        # Use %s for MySQL, ? for SQLite
        placeholder = '%s' if USE_MYSQL else '?'
        
        query = f'''INSERT INTO transactions (
            date,
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
        ) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})'''
        
        values = (
            entry_date,
            data['openingBalance'],
            data['income']['roomRent']['amount'], data['income']['roomRent']['method'],
            data['income']['mattressCharge']['amount'], data['income']['mattressCharge']['method'],
            data['income']['travelCab']['amount'], data['income']['travelCab']['method'],
            data['income']['kitchenFacility']['amount'], data['income']['kitchenFacility']['method'],
            data['income']['cleanCharge']['amount'], data['income']['cleanCharge']['method'],
            data['income']['miscReceipt']['amount'], data['income']['miscReceipt']['method'],
            data['income']['totalIncome'],
            data['expense']['brokerage']['amount'], data['expense']['brokerage']['method'],
            data['expense']['salary']['amount'], data['expense']['salary']['method'],
            data['expense']['roomCleaningCharge']['amount'], data['expense']['roomCleaningCharge']['method'],
            data['expense']['generatorMaintenance']['amount'], data['expense']['generatorMaintenance']['method'],
            data['expense']['hotelStationary']['amount'], data['expense']['hotelStationary']['method'],
            data['expense']['hotelCleaningSanitation']['amount'], data['expense']['hotelCleaningSanitation']['method'],
            data['expense']['rentTaxes']['amount'], data['expense']['rentTaxes']['method'],
            data['expense']['tvRecharge']['amount'], data['expense']['tvRecharge']['method'],
            data['expense']['cameraWifi']['amount'], data['expense']['cameraWifi']['method'],
            data['expense']['plumbingMaintenance']['amount'], data['expense']['plumbingMaintenance']['method'],
            data['expense']['electricityMaintenance']['amount'], data['expense']['electricityMaintenance']['method'],
            data['expense']['electricityBill']['amount'], data['expense']['electricityBill']['method'],
            data['expense']['staffFooding']['amount'], data['expense']['staffFooding']['method'],
            data['expense']['laundry']['amount'], data['expense']['laundry']['method'],
            data['expense']['ownerKitchenCab']['amount'], data['expense']['ownerKitchenCab']['method'],
            data['expense']['officeStationary']['amount'], data['expense']['officeStationary']['method'],
            data['expense']['miscExpenses']['amount'], data['expense']['miscExpenses']['method'],
            data['expense']['totalExpense'],
            data['closingBalance']
        )
        
        transaction_id = execute_query(query, values)
        
        return jsonify({'id': transaction_id, 'message': 'Transaction saved successfully'}), 200
    except Exception as e:
        print(f"Error saving transaction: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    try:
        # Get limit from query parameter, default to 50
        limit = request.args.get('limit', 50, type=int)
        
        placeholder = '%s' if USE_MYSQL else '?'
        query = f'SELECT * FROM transactions ORDER BY date DESC LIMIT {placeholder}'
        
        transactions = execute_query(query, (limit,), fetch=True)
        
        return jsonify(transactions), 200
    except Exception as e:
        print(f"Error fetching transactions: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/transactions/<int:transaction_id>', methods=['DELETE'])
def delete_transaction(transaction_id):
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
        query = '''SELECT 
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
            misc_expenses, misc_expenses_method
        FROM transactions ORDER BY date DESC'''
        
        rows = execute_query(query, fetch=True)
        
        cash_income = 0
        upi_income = 0
        cash_expense = 0
        upi_expense = 0
        
        for row_dict in rows:
            # Calculate income
            if row_dict.get('room_rent_method') == 'cash':
                cash_income += row_dict.get('room_rent', 0) or 0
            elif row_dict.get('room_rent_method') == 'upi':
                upi_income += row_dict.get('room_rent', 0) or 0
                
            if row_dict.get('mattress_charge_method') == 'cash':
                cash_income += row_dict.get('mattress_charge', 0) or 0
            elif row_dict.get('mattress_charge_method') == 'upi':
                upi_income += row_dict.get('mattress_charge', 0) or 0
                
            if row_dict.get('travel_cab_method') == 'cash':
                cash_income += row_dict.get('travel_cab', 0) or 0
            elif row_dict.get('travel_cab_method') == 'upi':
                upi_income += row_dict.get('travel_cab', 0) or 0
                
            if row_dict.get('kitchen_facility_method') == 'cash':
                cash_income += row_dict.get('kitchen_facility', 0) or 0
            elif row_dict.get('kitchen_facility_method') == 'upi':
                upi_income += row_dict.get('kitchen_facility', 0) or 0
                
            if row_dict.get('clean_charge_method') == 'cash':
                cash_income += row_dict.get('clean_charge', 0) or 0
            elif row_dict.get('clean_charge_method') == 'upi':
                upi_income += row_dict.get('clean_charge', 0) or 0
                
            if row_dict.get('misc_receipt_method') == 'cash':
                cash_income += row_dict.get('misc_receipt', 0) or 0
            elif row_dict.get('misc_receipt_method') == 'upi':
                upi_income += row_dict.get('misc_receipt', 0) or 0
            
            # Calculate expenses
            expense_items = [
                ('brokerage', 'brokerage_method'),
                ('salary', 'salary_method'),
                ('room_cleaning_charge', 'room_cleaning_charge_method'),
                ('generator_maintenance', 'generator_maintenance_method'),
                ('hotel_stationary', 'hotel_stationary_method'),
                ('hotel_cleaning_sanitation', 'hotel_cleaning_sanitation_method'),
                ('rent_taxes', 'rent_taxes_method'),
                ('tv_recharge', 'tv_recharge_method'),
                ('camera_wifi', 'camera_wifi_method'),
                ('plumbing_maintenance', 'plumbing_maintenance_method'),
                ('electricity_maintenance', 'electricity_maintenance_method'),
                ('electricity_bill', 'electricity_bill_method'),
                ('staff_fooding', 'staff_fooding_method'),
                ('laundry', 'laundry_method'),
                ('owner_kitchen_cab', 'owner_kitchen_cab_method'),
                ('office_stationary', 'office_stationary_method'),
                ('misc_expenses', 'misc_expenses_method')
            ]
            
            for amount_field, method_field in expense_items:
                if row_dict.get(method_field) == 'cash':
                    cash_expense += row_dict.get(amount_field, 0) or 0
                elif row_dict.get(method_field) == 'upi':
                    upi_expense += row_dict.get(amount_field, 0) or 0
        
        cash_balance = cash_income - cash_expense
        upi_balance = upi_income - upi_expense
        
        # Get the last transaction's closing balance as total balance
        last_transaction = execute_query(
            'SELECT closing_balance FROM transactions ORDER BY date DESC LIMIT 1',
            fetch=True,
            fetchone=True
        )
        total_balance = last_transaction['closing_balance'] if last_transaction else 0
        
        return jsonify({
            'cashIncome': f"{cash_income:.2f}",
            'cashExpense': f"{cash_expense:.2f}",
            'cashBalance': f"{cash_balance:.2f}",
            'upiIncome': f"{upi_income:.2f}",
            'upiExpense': f"{upi_expense:.2f}",
            'upiBalance': f"{upi_balance:.2f}",
            'totalBalance': f"{total_balance:.2f}",
            'transactionCount': len(rows)
        }), 200
    except Exception as e:
        print(f"Error calculating balances: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/category-totals', methods=['GET'])
def get_category_totals():
    try:
        rows = execute_query('SELECT * FROM transactions ORDER BY date DESC', fetch=True)
        
        # Initialize totals
        income_totals = {
            'room_rent': 0,
            'mattress_charge': 0,
            'travel_cab': 0,
            'kitchen_facility': 0,
            'clean_charge': 0,
            'misc_receipt': 0
        }
        
        expense_totals = {
            'brokerage': 0,
            'salary': 0,
            'room_cleaning_charge': 0,
            'generator_maintenance': 0,
            'hotel_stationary': 0,
            'hotel_cleaning_sanitation': 0,
            'rent_taxes': 0,
            'tv_recharge': 0,
            'camera_wifi': 0,
            'plumbing_maintenance': 0,
            'electricity_maintenance': 0,
            'electricity_bill': 0,
            'staff_fooding': 0,
            'laundry': 0,
            'owner_kitchen_cab': 0,
            'office_stationary': 0,
            'misc_expenses': 0
        }
        
        # Sum up all transactions
        for row_dict in rows:
            # Sum income categories
            for category in income_totals.keys():
                value = row_dict.get(category, 0) or 0
                income_totals[category] += float(value) if value else 0
            
            # Sum expense categories
            for category in expense_totals.keys():
                value = row_dict.get(category, 0) or 0
                expense_totals[category] += float(value) if value else 0
        
        # Ensure all values are floats (not Decimal)
        income_totals = {k: float(v) for k, v in income_totals.items()}
        expense_totals = {k: float(v) for k, v in expense_totals.items()}
        
        return jsonify({
            'income': income_totals,
            'expense': expense_totals
        }), 200
    except Exception as e:
        print(f"Error calculating category totals: {e}")
        return jsonify({'error': str(e)}), 500

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
    app.run(debug=True, host='0.0.0.0', port=5000)
