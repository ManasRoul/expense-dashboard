"""Shared, non-route code used across all blueprints: DB access, validation,
auth/audit helpers, and the dynamic category-column machinery. Kept in one
module (rather than many tiny ones) to avoid import-order headaches while
still getting routes out of server.py."""

from flask import request, session, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import os
import json
from datetime import datetime
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

if USE_MYSQL:
    try:
        import mysql.connector
        from mysql.connector import Error
    except ImportError:
        print("ERROR: mysql-connector-python not installed!")
        print("Run: pip install mysql-connector-python")
        exit(1)
else:
    import sqlite3

# Rate limiting - created here without an app bound yet; server.py calls
# limiter.init_app(app) once the Flask app exists (avoids a circular import
# between this module and server.py).
if LIMITER_AVAILABLE:
    limiter = Limiter(
        key_func=get_remote_address,
        default_limits=["5000 per day", "1000 per hour"],
        storage_uri="memory://"
    )
else:
    class DummyLimiter:
        def limit(self, *args, **kwargs):
            def decorator(f):
                return f
            return decorator

        def init_app(self, app):
            pass
    limiter = DummyLimiter()

# Session timeout (30 minutes of inactivity)
SESSION_TIMEOUT = 1800  # seconds

# Receipt uploads - stored outside the generic static-file route (see serve_static
# in server.py) and only ever served through the authenticated
# /api/transactions/<id>/receipts/<id> route.
RECEIPTS_DIR = os.path.join('uploads', 'receipts')
os.makedirs(RECEIPTS_DIR, exist_ok=True)
ALLOWED_RECEIPT_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.pdf'}


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


def add_category_columns(key_id):
    """Add columns to transactions table for a new category"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Column names
        col_value = key_id
        col_method = f"{key_id}_method"
        col_comment = f"{key_id}_comment"
        col_vendor = f"{key_id}_vendor"

        if USE_MYSQL:
            # Check if columns exist
            check_query = f"SHOW COLUMNS FROM transactions LIKE %s"
            cursor.execute(check_query, (col_value,))
            if not cursor.fetchone():
                # Add the value column
                alter_query = f"ALTER TABLE transactions ADD COLUMN {col_value} DECIMAL(10, 2) DEFAULT 0"
                cursor.execute(alter_query)

            cursor.execute(check_query, (col_method,))
            if not cursor.fetchone():
                # Add the method column
                alter_query = f"ALTER TABLE transactions ADD COLUMN {col_method} VARCHAR(10)"
                cursor.execute(alter_query)

            cursor.execute(check_query, (col_comment,))
            if not cursor.fetchone():
                # Add the comment column
                alter_query = f"ALTER TABLE transactions ADD COLUMN {col_comment} TEXT DEFAULT ''"
                cursor.execute(alter_query)

            cursor.execute(check_query, (col_vendor,))
            if not cursor.fetchone():
                # Add the vendor/party column
                alter_query = f"ALTER TABLE transactions ADD COLUMN {col_vendor} VARCHAR(100) DEFAULT ''"
                cursor.execute(alter_query)
        else:
            # SQLite - check if column exists by trying to select it
            cursor.execute(f"PRAGMA table_info(transactions)")
            columns = [row[1] for row in cursor.fetchall()]

            if col_value not in columns:
                alter_query = f"ALTER TABLE transactions ADD COLUMN {col_value} REAL DEFAULT 0"
                cursor.execute(alter_query)

            if col_method not in columns:
                alter_query = f"ALTER TABLE transactions ADD COLUMN {col_method} TEXT"
                cursor.execute(alter_query)

            if col_comment not in columns:
                alter_query = f"ALTER TABLE transactions ADD COLUMN {col_comment} TEXT DEFAULT ''"
                cursor.execute(alter_query)

            if col_vendor not in columns:
                alter_query = f"ALTER TABLE transactions ADD COLUMN {col_vendor} TEXT DEFAULT ''"
                cursor.execute(alter_query)

        conn.commit()
        cursor.close()
        conn.close()
        print(f"✓ Added columns for category: {key_id}")
    except Exception as e:
        print(f"Error adding category columns: {e}")
        # Don't raise - let it continue even if columns already exist


def create_index_safe(index_name, table_name, column_expr):
    """Create an index, tolerating 'already exists' errors.
    Real MySQL (unlike SQLite/MariaDB) doesn't support CREATE INDEX IF NOT EXISTS."""
    if USE_MYSQL:
        sql = f"CREATE INDEX {index_name} ON {table_name}({column_expr})"
    else:
        sql = f"CREATE INDEX IF NOT EXISTS {index_name} ON {table_name}({column_expr})"
    try:
        execute_query(sql)
    except Exception as e:
        if 'duplicate' not in str(e).lower() and 'already exists' not in str(e).lower():
            raise


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


def is_feature_enabled(key_id):
    """Check an app_config feature flag (0/1 stored in the value column)."""
    placeholder = '%s' if USE_MYSQL else '?'
    row = execute_query(
        f"SELECT value FROM app_config WHERE key_id = {placeholder}",
        (key_id,), fetch=True, fetchone=True
    )
    if not row or row.get('value') is None:
        return True  # default to enabled if the flag row is missing for some reason
    return float(row['value']) != 0


# Helper function to hash passwords with salt
def hash_password(password):
    """Hash password with salt using PBKDF2-SHA256"""
    return generate_password_hash(password, method='pbkdf2:sha256', salt_length=16)


def verify_password(stored_hash, provided_password):
    """Verify password against stored hash"""
    return check_password_hash(stored_hash, provided_password)


# Input validation helpers
def validate_decimal(value, field_name, min_value=0):
    """Validate decimal input. Pass min_value=None to allow negative values
    (e.g. a running cash balance that legitimately went into deficit)."""
    try:
        decimal_value = Decimal(str(value))
        if min_value is not None and decimal_value < min_value:
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
# Will be populated on app startup
KNOWN_INCOME_KEYS = []
KNOWN_EXPENSE_KEYS = []


def load_known_category_keys():
    """Load active category keys from settings table at app startup"""
    global KNOWN_INCOME_KEYS, KNOWN_EXPENSE_KEYS
    try:
        placeholder = '%s' if USE_MYSQL else '?'
        categories = execute_query(
            f"SELECT key_id, type FROM settings WHERE type IN ({placeholder}, {placeholder}) AND active = 1 ORDER BY sort_order",
            ('income_category', 'expense_category'), fetch=True
        )

        KNOWN_INCOME_KEYS = [cat['key_id'] for cat in categories if cat['type'] == 'income_category']
        KNOWN_EXPENSE_KEYS = [cat['key_id'] for cat in categories if cat['type'] == 'expense_category']

        print(f"✓ Loaded income categories: {KNOWN_INCOME_KEYS}")
        print(f"✓ Loaded expense categories: {KNOWN_EXPENSE_KEYS}")
    except Exception as e:
        print(f"WARNING: Could not load categories from settings: {e}")
        print("Using empty category lists - form submission will not work until categories are added")
        KNOWN_INCOME_KEYS = []
        KNOWN_EXPENSE_KEYS = []


def build_transaction_columns_values(data, entry_date):
    """Build columns and values for INSERT/UPDATE from transaction data."""
    placeholder = '%s' if USE_MYSQL else '?'
    columns = ['date', 'opening_balance']
    values_list = [entry_date, data['openingBalance']]

    # Get all active income categories from settings (not just KNOWN_INCOME_KEYS)
    income_categories = execute_query(
        "SELECT key_id FROM settings WHERE type = 'income_category' AND active = 1 ORDER BY sort_order",
        fetch=True
    )
    income_keys = [cat['key_id'] for cat in income_categories] if income_categories else KNOWN_INCOME_KEYS

    # Process income categories
    for key in income_keys:
        cat_data = data.get('income', {}).get(key, {})
        if isinstance(cat_data, dict):
            # Use key_id as-is - it must match the actual column name created by
            # add_category_columns(), which never applies camel_to_snake. Transforming
            # it here caused "Unknown column" errors for any multi-word category
            # (e.g. key_id 'roomService' column vs a 'room_service' write target).
            columns.extend([key, f'{key}_method', f'{key}_comment', f'{key}_vendor'])
            values_list.extend([cat_data.get('amount', 0), cat_data.get('method', ''), cat_data.get('comment', ''), cat_data.get('vendor', '')])

    columns.append('total_income')
    values_list.append(data.get('income', {}).get('totalIncome', 0))

    # Get all active expense categories from settings (not just KNOWN_EXPENSE_KEYS)
    expense_categories = execute_query(
        "SELECT key_id FROM settings WHERE type = 'expense_category' AND active = 1 ORDER BY sort_order",
        fetch=True
    )
    expense_keys = [cat['key_id'] for cat in expense_categories] if expense_categories else KNOWN_EXPENSE_KEYS

    # Process expense categories
    for key in expense_keys:
        cat_data = data.get('expense', {}).get(key, {})
        if isinstance(cat_data, dict):
            # Use key_id as-is - it must match the actual column name created by
            # add_category_columns(), which never applies camel_to_snake. Transforming
            # it here caused "Unknown column" errors for any multi-word category
            # (e.g. key_id 'roomService' column vs a 'room_service' write target).
            columns.extend([key, f'{key}_method', f'{key}_comment', f'{key}_vendor'])
            values_list.extend([cat_data.get('amount', 0), cat_data.get('method', ''), cat_data.get('comment', ''), cat_data.get('vendor', '')])

    columns.extend(['total_expense', 'closing_balance'])
    values_list.extend([data.get('expense', {}).get('totalExpense', 0), data['closingBalance']])

    return columns, values_list


def check_session_timeout():
    """Check for session timeout on inactivity. Registered as a before_request
    hook from server.py (not decorated here, to avoid needing `app` in this module)."""
    # Skip for login, logout, and static files. Blueprint-qualified endpoint names
    # (e.g. 'auth.login') since these routes now live in the auth blueprint.
    if request.endpoint in ['auth.login', 'auth.logout', 'serve_static', 'auth.index']:
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
