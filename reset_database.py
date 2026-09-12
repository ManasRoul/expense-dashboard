#!/usr/bin/env python3
"""
Database Reset Script - Delete all tables and recreate fresh with new schema
WARNING: This DELETES all data. Backup will be created first.
"""

import os
import sys
from datetime import datetime

# Load .env file
env_file = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_file):
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

from config import MYSQL_CONFIG, USE_MYSQL
import mysql.connector
from mysql.connector import Error

print("="*70)
print("⚠️  DATABASE RESET SCRIPT - DELETE ALL DATA AND RECREATE")
print("="*70)

# Confirmation
print("\n❗ WARNING: This will DELETE all tables and data!")
print("A backup will be created first.")
print("\nContinue? (type 'YES' to proceed): ", end="")
confirm = input().strip().upper()

if confirm != 'YES':
    print("❌ Cancelled.")
    sys.exit(0)

print("\n" + "="*70)
print("🔄 STARTING DATABASE RESET")
print("="*70)

try:
    # First, create a backup
    print("\n1️⃣  Creating backup...")
    backup_file = f"database_backup_before_reset_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
    
    conn = mysql.connector.connect(**MYSQL_CONFIG)
    cursor = conn.cursor()
    
    with open(backup_file, 'w') as f:
        f.write(f"-- Database Backup before reset\n")
        f.write(f"-- Created: {datetime.now()}\n")
        f.write(f"-- Database: {MYSQL_CONFIG['database']}\n\n")
        
        # Get all tables
        cursor.execute(f"SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = '{MYSQL_CONFIG['database']}'")
        tables = cursor.fetchall()
        
        for (table_name,) in tables:
            # Get CREATE TABLE
            cursor.execute(f"SHOW CREATE TABLE {table_name}")
            create_sql = cursor.fetchone()[1]
            f.write(f"\n-- Table: {table_name}\n")
            f.write(f"DROP TABLE IF EXISTS {table_name};\n")
            f.write(f"{create_sql};\n\n")
            
            # Get data
            cursor.execute(f"SELECT * FROM {table_name}")
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            
            if rows:
                for row in rows:
                    values = ', '.join([f"'{str(val).replace(chr(39), chr(39)+chr(39))}'" if val is not None else 'NULL' for val in row])
                    f.write(f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({values});\n")
    
    print(f"✅ Backup created: {backup_file}")
    
    # Drop all tables
    print("\n2️⃣  Dropping existing tables...")
    cursor.execute(f"SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = '{MYSQL_CONFIG['database']}'")
    tables = cursor.fetchall()
    
    cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
    for (table_name,) in tables:
        print(f"   • Dropping {table_name}...")
        cursor.execute(f"DROP TABLE IF EXISTS {table_name}")
    cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
    conn.commit()
    
    print("✅ All tables dropped")
    
    cursor.close()
    conn.close()
    
    # Now reinitialize the database by importing server.py's init_db
    print("\n3️⃣  Recreating tables with new schema...")
    
    # Import and run init_db
    import sys
    sys.path.insert(0, os.path.dirname(__file__))
    from server import init_db
    
    init_db()
    
    print("✅ Database reinitialized with fresh tables")
    
    # Verify
    print("\n4️⃣  Verifying new database...")
    conn = mysql.connector.connect(**MYSQL_CONFIG)
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute("SELECT COUNT(*) as cnt FROM settings")
    settings_cnt = cursor.fetchone()['cnt']
    print(f"✅ Settings table: {settings_cnt} categories")
    
    cursor.execute("SELECT COUNT(*) as cnt FROM users")
    users_cnt = cursor.fetchone()['cnt']
    print(f"✅ Users table: {users_cnt} users (should be 1 - admin)")
    
    cursor.execute("SELECT COUNT(*) as cnt FROM transactions")
    tx_cnt = cursor.fetchone()['cnt']
    print(f"✅ Transactions table: {tx_cnt} transactions (should be 0)")
    
    cursor.execute("SELECT COUNT(*) as cnt FROM salary_records")
    sal_cnt = cursor.fetchone()['cnt']
    print(f"✅ Salary records table: {sal_cnt} records (should be 0)")
    
    cursor.close()
    conn.close()
    
    print("\n" + "="*70)
    print("✅ DATABASE RESET COMPLETE!")
    print("="*70)
    print(f"\n📝 Backup file: {backup_file}")
    print(f"\n🔐 Default credentials:")
    print(f"   Username: admin")
    print(f"   Password: admin123")
    print(f"\n📊 Fresh database with:")
    print(f"   • 32 categories (income, expense, employee)")
    print(f"   • 1 admin user")
    print(f"   • 0 transactions (ready for new data)")
    print(f"\n💡 Next steps:")
    print(f"   1. Restart Flask: pkill -f 'python server.py'; sleep 2; python3 server.py &")
    print(f"   2. Clear browser cache: Ctrl+Shift+Delete")
    print(f"   3. Reload dashboard: Ctrl+Shift+R")
    print(f"   4. Test by creating a new transaction")
    print("\n" + "="*70 + "\n")

except Error as e:
    print(f"\n❌ Error: {e}")
    sys.exit(1)
