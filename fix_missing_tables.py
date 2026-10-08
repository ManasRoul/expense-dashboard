#!/usr/bin/env python3
"""
Safe Database Table Fix Script
- Checks if tables exist
- Creates only missing tables (skips existing ones)
- Adds missing columns to existing tables
- SAFE FOR LIVE DATABASE - No data loss or deletion
"""

import os
import sys
from datetime import datetime
import json

# Load environment variables from .env if exists
env_file = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_file):
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

from config import USE_MYSQL, MYSQL_CONFIG

# Import database modules
if USE_MYSQL:
    try:
        import mysql.connector
        from mysql.connector import Error as MySQLError
    except ImportError:
        print("❌ mysql-connector-python not installed!")
        print("   Run: pip install mysql-connector-python")
        sys.exit(1)
else:
    import sqlite3

class DatabaseFixer:
    def __init__(self):
        self.conn = None
        self.cursor = None
        self.use_mysql = USE_MYSQL
        self.changes_made = []
        self.skipped_tables = []
        self.errors = []
        
    def connect(self):
        """Establish database connection"""
        try:
            if self.use_mysql:
                self.conn = mysql.connector.connect(
                    host=MYSQL_CONFIG['host'],
                    user=MYSQL_CONFIG['user'],
                    password=MYSQL_CONFIG['password'],
                    database=MYSQL_CONFIG['database'],
                    port=MYSQL_CONFIG['port'],
                    charset='utf8mb4',
                    collation='utf8mb4_unicode_ci'
                )
                self.cursor = self.conn.cursor(dictionary=True)
                db_type = "MySQL"
            else:
                self.conn = sqlite3.connect('financial.db')
                self.conn.row_factory = sqlite3.Row
                self.cursor = self.conn.cursor()
                db_type = "SQLite"
            
            print(f"✅ Connected to {db_type} database")
            return True
        except Exception as e:
            print(f"❌ Connection failed: {e}")
            return False
    
    def table_exists(self, table_name):
        """Check if a table exists"""
        try:
            if self.use_mysql:
                self.cursor.execute(f"SHOW TABLES LIKE '{table_name}'")
                return self.cursor.fetchone() is not None
            else:
                self.cursor.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                    (table_name,)
                )
                return self.cursor.fetchone() is not None
        except Exception as e:
            print(f"⚠️  Error checking table '{table_name}': {e}")
            return None
    
    def column_exists(self, table_name, column_name):
        """Check if a column exists in a table"""
        try:
            if self.use_mysql:
                self.cursor.execute(f"SHOW COLUMNS FROM {table_name} LIKE '{column_name}'")
                return self.cursor.fetchone() is not None
            else:
                self.cursor.execute(f"PRAGMA table_info({table_name})")
                columns = [row[1] for row in self.cursor.fetchall()]
                return column_name in columns
        except Exception as e:
            print(f"⚠️  Error checking column '{column_name}' in '{table_name}': {e}")
            return None
    
    def execute_sql(self, sql, description=""):
        """Execute SQL safely"""
        try:
            self.cursor.execute(sql)
            if self.use_mysql:
                self.conn.commit()
            else:
                self.conn.commit()
            return True
        except Exception as e:
            print(f"   ❌ {description}: {e}")
            self.errors.append(f"{description}: {e}")
            return False
    
    def create_settings_table(self):
        """Create settings table"""
        if self.table_exists('settings'):
            print("⏭️  settings table already exists - skipping")
            self.skipped_tables.append('settings')
            return True
        
        print("📝 Creating settings table...")
        sql = """
        CREATE TABLE settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            type VARCHAR(50) NOT NULL,
            key_id VARCHAR(100),
            label VARCHAR(100),
            sort_order INT DEFAULT 0,
            active TINYINT DEFAULT 1,
            salary_amount DECIMAL(10, 2) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_setting (type, key_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """ if self.use_mysql else """
        CREATE TABLE settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type VARCHAR(50) NOT NULL,
            key_id VARCHAR(100),
            label VARCHAR(100),
            sort_order INTEGER DEFAULT 0,
            active INTEGER DEFAULT 1,
            salary_amount DECIMAL(10, 2) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (type, key_id)
        )
        """
        
        if self.execute_sql(sql, "Create settings table"):
            self.changes_made.append("✅ Created settings table")
            return True
        return False
    
    def create_transactions_table(self):
        """Create transactions table"""
        if self.table_exists('transactions'):
            print("⏭️  transactions table already exists - skipping")
            self.skipped_tables.append('transactions')
            return True
        
        print("📝 Creating transactions table...")
        sql = """
        CREATE TABLE transactions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            date DATETIME,
            opening_balance DECIMAL(15, 2),
            total_income DECIMAL(15, 2) DEFAULT 0,
            total_expense DECIMAL(15, 2) DEFAULT 0,
            closing_balance DECIMAL(15, 2),
            salary DECIMAL(10, 2) DEFAULT 0,
            salary_method VARCHAR(10),
            salary_comment TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_date (date),
            INDEX idx_salary (salary)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """ if self.use_mysql else """
        CREATE TABLE transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date DATETIME,
            opening_balance DECIMAL(15, 2),
            total_income DECIMAL(15, 2) DEFAULT 0,
            total_expense DECIMAL(15, 2) DEFAULT 0,
            closing_balance DECIMAL(15, 2),
            salary DECIMAL(10, 2) DEFAULT 0,
            salary_method VARCHAR(10),
            salary_comment TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
        
        if self.execute_sql(sql, "Create transactions table"):
            self.changes_made.append("✅ Created transactions table")
            return True
        return False
    
    def create_transaction_details_table(self):
        """Create transaction_details table"""
        if self.table_exists('transaction_details'):
            print("⏭️  transaction_details table already exists - skipping")
            self.skipped_tables.append('transaction_details')
            return True
        
        print("📝 Creating transaction_details table...")
        
        # First try with foreign key
        sql_with_fk = """
        CREATE TABLE transaction_details (
            id INT AUTO_INCREMENT PRIMARY KEY,
            transaction_id INT,
            category_type VARCHAR(50),
            category_id VARCHAR(100),
            amount DECIMAL(15, 2),
            payment_method VARCHAR(20),
            comment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (transaction_id) REFERENCES transactions(id),
            INDEX idx_transaction (transaction_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """ if self.use_mysql else """
        CREATE TABLE transaction_details (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_id INTEGER,
            category_type VARCHAR(50),
            category_id VARCHAR(100),
            amount DECIMAL(15, 2),
            payment_method VARCHAR(20),
            comment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (transaction_id) REFERENCES transactions(id)
        )
        """
        
        # If FK fails, create without FK
        sql_without_fk = """
        CREATE TABLE transaction_details (
            id INT AUTO_INCREMENT PRIMARY KEY,
            transaction_id INT,
            category_type VARCHAR(50),
            category_id VARCHAR(100),
            amount DECIMAL(15, 2),
            payment_method VARCHAR(20),
            comment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_transaction (transaction_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """ if self.use_mysql else """
        CREATE TABLE transaction_details (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_id INTEGER,
            category_type VARCHAR(50),
            category_id VARCHAR(100),
            amount DECIMAL(15, 2),
            payment_method VARCHAR(20),
            comment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_transaction (transaction_id)
        )
        """
        
        # Try with foreign key first
        try:
            self.cursor.execute(sql_with_fk)
            if self.use_mysql:
                self.conn.commit()
            else:
                self.conn.commit()
            print("   ✅ Created with foreign key constraint")
            self.changes_made.append("✅ Created transaction_details table (with FK)")
            return True
        except Exception as e:
            # Check if it's a foreign key error
            error_str = str(e).lower()
            if 'foreign key' in error_str or 'error: 150' in error_str:
                print(f"   ⚠️  Foreign key constraint failed: {e}")
                print("   🔧 Retrying without foreign key constraint...")
                
                # Try without foreign key
                try:
                    self.cursor.execute(sql_without_fk)
                    if self.use_mysql:
                        self.conn.commit()
                    else:
                        self.conn.commit()
                    print("   ✅ Created without foreign key (transactions table may need InnoDB)")
                    self.changes_made.append("✅ Created transaction_details table (without FK)")
                    return True
                except Exception as e2:
                    print(f"   ❌ Failed to create table: {e2}")
                    self.errors.append(f"Create transaction_details table: {e2}")
                    return False
            else:
                print(f"   ❌ Failed to create table: {e}")
                self.errors.append(f"Create transaction_details table: {e}")
                return False
    
    def create_salary_records_table(self):
        """Create salary_records table"""
        if self.table_exists('salary_records'):
            print("⏭️  salary_records table already exists - skipping")
            self.skipped_tables.append('salary_records')
            return True
        
        print("📝 Creating salary_records table...")
        sql = """
        CREATE TABLE salary_records (
            id INT AUTO_INCREMENT PRIMARY KEY,
            date DATETIME,
            employee_name VARCHAR(100),
            payment_type VARCHAR(20),
            amount DECIMAL(10, 2),
            payment_method VARCHAR(10),
            note TEXT DEFAULT '',
            carryover_status VARCHAR(20) DEFAULT 'none' COMMENT 'none|pending|carried_over',
            carryover_from_date DATE DEFAULT NULL COMMENT 'Date of advance that carried over',
            carryover_amount DECIMAL(10, 2) DEFAULT 0 COMMENT 'Amount carried over from previous month',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_date (date),
            INDEX idx_employee (employee_name),
            INDEX idx_carryover_status (employee_name, carryover_status, date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """ if self.use_mysql else """
        CREATE TABLE salary_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date DATETIME,
            employee_name VARCHAR(100),
            payment_type VARCHAR(20),
            amount DECIMAL(10, 2),
            payment_method VARCHAR(10),
            note TEXT DEFAULT '',
            carryover_status VARCHAR(20) DEFAULT 'none',
            carryover_from_date DATE DEFAULT NULL,
            carryover_amount DECIMAL(10, 2) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
        
        if self.execute_sql(sql, "Create salary_records table"):
            self.changes_made.append("✅ Created salary_records table")
            return True
        return False
    
    def check_and_fix_transactions_engine(self):
        """Ensure transactions table uses InnoDB engine (required for foreign keys)"""
        if not self.table_exists('transactions') or not self.use_mysql:
            return True
        
        try:
            self.cursor.execute("""
                SELECT ENGINE FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions'
            """)
            result = self.cursor.fetchone()
            
            if result and result.get('ENGINE', '').upper() != 'INNODB':
                print(f"🔧 Converting transactions table to InnoDB...")
                self.cursor.execute("ALTER TABLE transactions ENGINE=InnoDB")
                self.conn.commit()
                self.changes_made.append("✅ Converted transactions table to InnoDB")
                return True
            return True
        except Exception as e:
            print(f"⚠️  Could not check/fix transactions engine: {e}")
            return True  # Don't block execution
    
    def add_foreign_key_to_transaction_details(self):
        """Add foreign key to transaction_details if missing"""
        if not self.table_exists('transaction_details') or not self.use_mysql:
            return True
        
        try:
            # Check if FK already exists
            self.cursor.execute("""
                SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                WHERE TABLE_NAME = 'transaction_details' 
                AND COLUMN_NAME = 'transaction_id' 
                AND REFERENCED_TABLE_NAME = 'transactions'
            """)
            
            if not self.cursor.fetchone():
                print("🔧 Adding foreign key to transaction_details...")
                self.cursor.execute("""
                    ALTER TABLE transaction_details 
                    ADD CONSTRAINT fk_transaction_details_ibfk_1 
                    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
                """)
                self.conn.commit()
                self.changes_made.append("✅ Added foreign key to transaction_details")
            else:
                print("⏭️  Foreign key already exists on transaction_details")
            
            return True
        except Exception as e:
            print(f"⚠️  Could not add foreign key: {e}")
            return True  # Don't block execution
    
    def add_missing_columns_to_salary_records(self):
        """Add missing carryover columns to salary_records if it exists"""
        if not self.table_exists('salary_records'):
            return True  # Table doesn't exist, will be created
        
        print("🔍 Checking salary_records for missing columns...")
        
        columns_to_add = [
            ('carryover_status', "VARCHAR(20) DEFAULT 'none' COMMENT 'none|pending|carried_over'", "carryover status column"),
            ('carryover_from_date', "DATE DEFAULT NULL", "carryover_from_date column"),
            ('carryover_amount', "DECIMAL(10, 2) DEFAULT 0", "carryover_amount column"),
        ]
        
        for col_name, col_type, description in columns_to_add:
            if not self.column_exists('salary_records', col_name):
                print(f"   Adding {description}...")
                if self.use_mysql:
                    sql = f"ALTER TABLE salary_records ADD COLUMN {col_name} {col_type}"
                else:
                    sql = f"ALTER TABLE salary_records ADD COLUMN {col_name} {col_type.split(' COMMENT')[0]}"
                
                if self.execute_sql(sql, f"Add {col_name} to salary_records"):
                    self.changes_made.append(f"✅ Added {col_name} to salary_records")
            else:
                print(f"   ⏭️  {col_name} already exists - skipping")
        
        return True
    
    def add_missing_indexes(self):
        """Add missing indexes for performance"""
        if self.table_exists('salary_records') and self.use_mysql:
            print("🔍 Checking indexes...")
            try:
                self.cursor.execute("SHOW INDEX FROM salary_records WHERE Key_name='idx_carryover_status'")
                if not self.cursor.fetchone():
                    print("   Adding carryover status index...")
                    sql = "ALTER TABLE salary_records ADD INDEX idx_carryover_status (employee_name, carryover_status, date)"
                    if self.execute_sql(sql, "Add carryover index"):
                        self.changes_made.append("✅ Added carryover index")
                else:
                    print("   ⏭️  carryover index already exists")
            except Exception as e:
                print(f"   ⚠️  Error checking indexes: {e}")
    
    def run(self):
        """Run all fixes"""
        print("\n" + "="*60)
        print("🔧 DATABASE TABLE FIX UTILITY")
        print("="*60)
        print("\nThis script will:")
        print("  • Check for missing tables")
        print("  • Create only missing tables (won't touch existing ones)")
        print("  • Add missing columns to existing tables")
        print("  • SAFE FOR LIVE - No data will be deleted")
        print("\n")
        
        # Connect to database
        if not self.connect():
            sys.exit(1)
        
        print("\n📋 Checking database tables...")
        print("-" * 60)
        
        # Create missing tables
        self.create_settings_table()
        self.create_transactions_table()
        self.create_transaction_details_table()
        self.create_salary_records_table()
        
        # Fix engine and foreign keys if using MySQL
        if self.use_mysql:
            print("\n🔧 Checking table compatibility...")
            print("-" * 60)
            self.check_and_fix_transactions_engine()
            self.add_foreign_key_to_transaction_details()
        
        # Add missing columns to existing tables
        print("\n📋 Checking for missing columns...")
        print("-" * 60)
        self.add_missing_columns_to_salary_records()
        
        # Add indexes if using MySQL
        if self.use_mysql:
            self.add_missing_indexes()
        
        # Print summary
        print("\n" + "="*60)
        print("📊 SUMMARY")
        print("="*60)
        
        if self.changes_made:
            print("\n✅ Changes made:")
            for change in self.changes_made:
                print(f"   {change}")
        else:
            print("\n✅ No changes needed - database structure is complete!")
        
        if self.skipped_tables:
            print(f"\n⏭️  Tables already exist (not modified):")
            for table in self.skipped_tables:
                print(f"   • {table}")
        
        if self.errors:
            print(f"\n❌ Errors encountered:")
            for error in self.errors:
                print(f"   • {error}")
        
        print("\n" + "="*60)
        
        # Close connection
        if self.conn:
            if self.use_mysql:
                self.conn.close()
            else:
                self.cursor.close()
                self.conn.close()
        
        return len(self.errors) == 0

def main():
    fixer = DatabaseFixer()
    success = fixer.run()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
