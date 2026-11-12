"""Database schema setup. Split out of server.py purely because it's ~500
lines on its own - all the tolerant "create table / add column if missing"
logic that runs once at every startup."""

import os
import secrets
from config import USE_MYSQL, MYSQL_CONFIG
from helpers import execute_query, create_index_safe, add_category_columns, hash_password

if USE_MYSQL:
    try:
        import mysql.connector
        from mysql.connector import Error
    except ImportError:
        print("ERROR: mysql-connector-python not installed!")
        print("Run: pip install mysql-connector-python")
        exit(1)


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
            recharge DECIMAL(10, 2) DEFAULT 0,
            recharge_method VARCHAR(10),
            recharge_comment TEXT DEFAULT '',
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
            recharge REAL DEFAULT 0,
            recharge_method TEXT,
            recharge_comment TEXT DEFAULT '',
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

    # Add deleted_at column to transactions for soft-delete, if it doesn't exist
    try:
        if USE_MYSQL:
            execute_query("ALTER TABLE transactions ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL")
        else:
            execute_query("ALTER TABLE transactions ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL")
    except:
        # Column might already exist, which is fine
        pass

    # Add created_by/updated_by columns to transactions, if they don't exist
    for col in ('created_by', 'updated_by'):
        try:
            if USE_MYSQL:
                execute_query(f"ALTER TABLE transactions ADD COLUMN {col} VARCHAR(50) DEFAULT NULL")
            else:
                execute_query(f"ALTER TABLE transactions ADD COLUMN {col} TEXT DEFAULT NULL")
        except:
            # Column might already exist, which is fine
            pass

    # Add receipt_path column to transactions, if it doesn't exist
    try:
        if USE_MYSQL:
            execute_query("ALTER TABLE transactions ADD COLUMN receipt_path VARCHAR(255) DEFAULT NULL")
        else:
            execute_query("ALTER TABLE transactions ADD COLUMN receipt_path TEXT DEFAULT NULL")
    except:
        # Column might already exist, which is fine
        pass

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
            transaction_id INT DEFAULT NULL,
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
            transaction_id INTEGER DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )'''

    execute_query(salary_table_query)

    # Add transaction_id column to salary_records if it doesn't exist (older DBs)
    try:
        if USE_MYSQL:
            execute_query("ALTER TABLE salary_records ADD COLUMN transaction_id INT DEFAULT NULL")
        else:
            execute_query("ALTER TABLE salary_records ADD COLUMN transaction_id INTEGER DEFAULT NULL")
    except:
        # Column might already exist, which is fine
        pass

    # Add deleted_at column to salary_records for soft-delete, if it doesn't exist
    # (mirrors a soft-deleted transaction so restoring one restores the other)
    try:
        if USE_MYSQL:
            execute_query("ALTER TABLE salary_records ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL")
        else:
            execute_query("ALTER TABLE salary_records ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL")
    except:
        # Column might already exist, which is fine
        pass

    # Create transaction_receipts table (supports multiple receipts per transaction).
    # Individual receipts are hard-deleted on removal (no trash) - unlike a transaction,
    # losing one is low-stakes since it's just a re-upload.
    if USE_MYSQL:
        receipts_table_query = '''CREATE TABLE IF NOT EXISTS transaction_receipts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            transaction_id INT NOT NULL,
            filename VARCHAR(255) NOT NULL,
            original_filename VARCHAR(255) DEFAULT NULL,
            uploaded_by VARCHAR(50) DEFAULT NULL,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )'''
    else:
        receipts_table_query = '''CREATE TABLE IF NOT EXISTS transaction_receipts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            original_filename TEXT DEFAULT NULL,
            uploaded_by TEXT DEFAULT NULL,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )'''
    execute_query(receipts_table_query)

    # One-time, idempotent migration: move any existing single-receipt data
    # (transactions.receipt_path, from before multi-receipt support) into the
    # new table. Safe to run on every startup - skips filenames already migrated.
    placeholder = '%s' if USE_MYSQL else '?'
    legacy_receipts = execute_query(
        "SELECT id, receipt_path FROM transactions WHERE receipt_path IS NOT NULL",
        fetch=True
    )
    for row in (legacy_receipts or []):
        already_migrated = execute_query(
            f"SELECT id FROM transaction_receipts WHERE transaction_id = {placeholder} AND filename = {placeholder}",
            (row['id'], row['receipt_path']), fetch=True, fetchone=True
        )
        if not already_migrated:
            execute_query(
                f"INSERT INTO transaction_receipts (transaction_id, filename) VALUES ({placeholder}, {placeholder})",
                (row['id'], row['receipt_path'])
            )
            print(f"Migrated legacy receipt for transaction {row['id']} to transaction_receipts")

    # Create recurring_templates table (saved transaction shapes the user can reload
    # into the entry form - no unattended auto-creation of financial entries)
    if USE_MYSQL:
        recurring_table_query = '''CREATE TABLE IF NOT EXISTS recurring_templates (
            id INT AUTO_INCREMENT PRIMARY KEY,
            label VARCHAR(100) NOT NULL,
            payload TEXT NOT NULL,
            day_of_month INT DEFAULT NULL,
            last_applied_month VARCHAR(7) DEFAULT NULL,
            created_by VARCHAR(50) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            active TINYINT DEFAULT 1
        )'''
    else:
        recurring_table_query = '''CREATE TABLE IF NOT EXISTS recurring_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            label TEXT NOT NULL,
            payload TEXT NOT NULL,
            day_of_month INTEGER DEFAULT NULL,
            last_applied_month TEXT DEFAULT NULL,
            created_by TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            active INTEGER DEFAULT 1
        )'''
    execute_query(recurring_table_query)

    # Create indexes for performance
    # Note: MySQL doesn't support "CREATE INDEX IF NOT EXISTS" - create_index_safe()
    # builds backend-appropriate SQL and tolerates "already exists" errors.
    create_index_safe('idx_transactions_date', 'transactions', 'date')
    create_index_safe('idx_transactions_id_desc', 'transactions', 'id DESC')
    create_index_safe('idx_salary_date', 'salary_records', 'date')
    create_index_safe('idx_salary_employee', 'salary_records', 'employee_name')
    create_index_safe('idx_salary_transaction_id', 'salary_records', 'transaction_id')
    create_index_safe('idx_receipts_transaction_id', 'transaction_receipts', 'transaction_id')

    # Create settings table for dynamic employees and categories
    if USE_MYSQL:
        settings_table_query = '''CREATE TABLE IF NOT EXISTS settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            type VARCHAR(50) NOT NULL,
            key_id VARCHAR(100) NOT NULL,
            label VARCHAR(200) NOT NULL,
            icon VARCHAR(10) DEFAULT '',
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
            icon TEXT DEFAULT '',
            sort_order INTEGER DEFAULT 0,
            active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(type, key_id)
        )'''

    execute_query(settings_table_query)

    # Add salary_amount column to settings table if it doesn't exist
    try:
        if USE_MYSQL:
            execute_query("ALTER TABLE settings ADD COLUMN salary_amount DECIMAL(10, 2) DEFAULT 0")
        else:
            execute_query("ALTER TABLE settings ADD COLUMN salary_amount REAL DEFAULT 0")
    except:
        # Column might already exist, which is fine
        pass

    # Add budget_amount column to settings table (expense category spending caps), if it doesn't exist
    try:
        if USE_MYSQL:
            execute_query("ALTER TABLE settings ADD COLUMN budget_amount DECIMAL(10, 2) DEFAULT NULL")
        else:
            execute_query("ALTER TABLE settings ADD COLUMN budget_amount REAL DEFAULT NULL")
    except:
        # Column might already exist, which is fine
        pass

    # Seed default settings if empty
    existing_settings = execute_query("SELECT COUNT(*) as cnt FROM settings", fetch=True, fetchone=True)
    if existing_settings and existing_settings['cnt'] == 0:
        placeholder = '%s' if USE_MYSQL else '?'
        defaults = [
            ('employee', 'shakti', 'Shakti', '', 1),
            ('employee', 'kabu', 'Kabu', '', 2),
            ('employee', 'kiran', 'Kiran', '', 3),
            ('employee', 'purna', 'Purna', '', 4),
            ('income_category', 'room_rent', 'Room Rent', '🏠', 1),
            ('income_category', 'mattress_charge', 'Mattress Charge', '🛏️', 2),
            ('income_category', 'travel_cab', 'Travel/Cab Service', '🚕', 3),
            ('income_category', 'kitchen_facility', 'Kitchen Facility', '🍳', 4),
            ('income_category', 'clean_charge', 'Cleaning Charge', '🧹', 5),
            ('income_category', 'misc_receipt', 'Misc Receipt', '💵', 6),
            ('expense_category', 'brokerage', 'Brokerage', '🤝', 1),
            ('expense_category', 'salary', 'Salary', '💼', 2),
            ('expense_category', 'room_cleaning_charge', 'Room Cleaning Charge', '🧼', 3),
            ('expense_category', 'generator_maintenance', 'Generator & Maintenance', '⚡', 4),
            ('expense_category', 'hotel_stationary', 'Hotel Stationary', '📝', 5),
            ('expense_category', 'hotel_cleaning_sanitation', 'Hotel Cleaning & Sanitation', '🧽', 6),
            ('expense_category', 'rent_taxes', 'Rent & Taxes', '🏢', 7),
            ('expense_category', 'recharge', 'Recharge', '📡', 9),
            ('expense_category', 'plumbing_maintenance', 'Plumbing & Maintenance', '🔧', 10),
            ('expense_category', 'electricity_maintenance', 'Electricity & Maintenance', '💡', 11),
            ('expense_category', 'electricity_bill', 'Electricity Bill', '⚡', 12),
            ('expense_category', 'staff_fooding', 'Staff Fooding', '🍽️', 13),
            ('expense_category', 'laundry', 'Laundry', '👕', 14),
            ('expense_category', 'owner_kitchen_cab', 'Owner Kitchen & Cab Payment', '🚗', 15),
            ('expense_category', 'office_stationary', 'Office Stationary', '📋', 16),
            ('expense_category', 'misc_expenses', 'Misc Expenses', '💳', 17),
        ]
        for item in defaults:
            execute_query(
                f"INSERT INTO settings (type, key_id, label, icon, sort_order) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})",
                item
            )
        print("Default settings seeded (employees, income/expense categories)")

    # Create the dedicated app_config table - thresholds/feature flags used to live as
    # type='app_config' rows in `settings`, piggybacking on the salary_amount column
    # (which otherwise means "employee monthly salary"). That double meaning was
    # confusing, so app_config now gets its own table with an honestly-named `value` column.
    placeholder = '%s' if USE_MYSQL else '?'
    if USE_MYSQL:
        app_config_table_query = '''CREATE TABLE IF NOT EXISTS app_config (
            key_id VARCHAR(100) PRIMARY KEY,
            label VARCHAR(200) NOT NULL,
            icon VARCHAR(10) DEFAULT '',
            value DECIMAL(10, 2) DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )'''
    else:
        app_config_table_query = '''CREATE TABLE IF NOT EXISTS app_config (
            key_id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            icon TEXT DEFAULT '',
            value REAL DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )'''
    execute_query(app_config_table_query)

    # One-time, idempotent migration: move any legacy type='app_config' rows out of
    # `settings` (from before this table existed) into app_config, then remove them from
    # settings so salary_amount there goes back to meaning only "employee monthly salary".
    legacy_app_config_rows = execute_query(
        f"SELECT key_id, label, icon, salary_amount FROM settings WHERE type = {placeholder}",
        ('app_config',), fetch=True
    )
    for row in (legacy_app_config_rows or []):
        already_migrated = execute_query(
            f"SELECT key_id FROM app_config WHERE key_id = {placeholder}",
            (row['key_id'],), fetch=True, fetchone=True
        )
        if not already_migrated:
            execute_query(
                f"INSERT INTO app_config (key_id, label, icon, value) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder})",
                (row['key_id'], row['label'], row['icon'], row['salary_amount'])
            )
            print(f"Migrated legacy app_config row '{row['key_id']}' out of settings")
    if legacy_app_config_rows:
        execute_query(f"DELETE FROM settings WHERE type = {placeholder}", ('app_config',))

    # Seed default app_config rows (alert threshold + feature toggles) if missing. Runs on
    # every startup so it's added for existing databases too.
    app_config_defaults = [
        ('low_balance_threshold', 'Low Balance Alert Threshold', '⚠️', 5000),
        ('feature_created_by_tracking', 'Track who created/edited transactions', '🧩', 1),
        ('feature_audit_log', 'Audit Log Page', '🧩', 1),
        ('feature_receipts', 'Receipt Attachments', '🧩', 1),
        ('feature_vendor_tracking', 'Vendor/Party Tracking', '🧩', 1),
    ]
    for key_id, label, icon, default_value in app_config_defaults:
        existing_config = execute_query(
            f"SELECT key_id FROM app_config WHERE key_id = {placeholder}",
            (key_id,), fetch=True, fetchone=True
        )
        if not existing_config:
            execute_query(
                f"INSERT INTO app_config (key_id, label, icon, value) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder})",
                (key_id, label, icon, default_value)
            )
            print(f"Seeded default app_config: {key_id} = {default_value}")

    # Seed default payment methods (Cash/UPI) as settings rows if missing. Runs on every
    # startup (not just fresh installs) so existing databases - where "cash"/"upi" were
    # only ever hardcoded in the frontend, never stored as data - get them too, letting
    # the owner add further methods (e.g. Card, Bank Transfer) the same way as categories.
    payment_method_defaults = [
        ('cash', 'Cash', '💵', 1),
        ('upi', 'UPI', '📱', 2),
    ]
    for key_id, label, icon, sort_order in payment_method_defaults:
        existing_method = execute_query(
            f"SELECT id FROM settings WHERE type = 'payment_method' AND key_id = {placeholder}",
            (key_id,), fetch=True, fetchone=True
        )
        if not existing_method:
            execute_query(
                f"INSERT INTO settings (type, key_id, label, icon, sort_order) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})",
                ('payment_method', key_id, label, icon, sort_order)
            )
            print(f"Seeded default payment method: {key_id}")

    # Create default owner user on first run only.
    # Password comes from ADMIN_PASSWORD env var if set, otherwise a random
    # one is generated and printed ONCE so a hardcoded credential never ships.
    check_user_query = "SELECT id FROM users WHERE username = 'admin'"
    existing_user = execute_query(check_user_query, fetch=True, fetchone=True)

    if not existing_user:
        admin_password = os.environ.get('ADMIN_PASSWORD') or secrets.token_urlsafe(12)
        default_password_hash = hash_password(admin_password)
        placeholder = '%s' if USE_MYSQL else '?'
        insert_user_query = f"INSERT INTO users (username, password_hash, role) VALUES ({placeholder}, {placeholder}, {placeholder})"
        execute_query(insert_user_query, ('admin', default_password_hash, 'owner'))
        if os.environ.get('ADMIN_PASSWORD'):
            print("Default owner user created - Username: admin, Password: <from ADMIN_PASSWORD env var>, Role: owner")
        else:
            print(f"Default owner user created - Username: admin, Password: {admin_password}, Role: owner")
            print("IMPORTANT: Save this password now - it will not be shown again. Change it after first login.")

    # Ensure all categories in settings table have corresponding columns in transactions table
    all_categories = execute_query(
        "SELECT DISTINCT key_id FROM settings WHERE type IN ('income_category', 'expense_category') AND active = 1",
        fetch=True
    )
    for cat in all_categories:
        add_category_columns(cat['key_id'])

    db_type = "MySQL" if USE_MYSQL else "SQLite"
    print(f"Database initialized successfully ({db_type})")
