#!/usr/bin/env python3
"""
Diagnostic Script - Check live database and connection
Run this on your live server to diagnose issues
"""

import os
import sys

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

print("="*70)
print("🔍 DATABASE DIAGNOSTIC CHECK")
print("="*70)

# Check 1: Configuration
print("\n1️⃣  CONFIGURATION CHECK")
print("-" * 70)
print(f"USE_MYSQL: {USE_MYSQL}")
print(f"Database Host: {MYSQL_CONFIG['host']}")
print(f"Database Name: {MYSQL_CONFIG['database']}")
print(f"Database User: {MYSQL_CONFIG['user']}")
print(f"Database Port: {MYSQL_CONFIG['port']}")

if not USE_MYSQL:
    print("⚠️  WARNING: USE_MYSQL is False! Should be True for live server")

# Check 2: MySQL Connection
print("\n2️⃣  MYSQL CONNECTION CHECK")
print("-" * 70)

try:
    import mysql.connector
    from mysql.connector import Error
    
    conn = mysql.connector.connect(**MYSQL_CONFIG)
    if conn.is_connected():
        print("✅ MySQL connection successful!")
        
        cursor = conn.cursor(dictionary=True)
        
        # Check 3: Settings table
        print("\n3️⃣  SETTINGS TABLE CHECK")
        print("-" * 70)
        
        cursor.execute("SELECT COUNT(*) as count FROM settings")
        count = cursor.fetchone()['count']
        print(f"✅ Total categories in settings: {count}")
        
        cursor.execute("SELECT type, COUNT(*) as count FROM settings GROUP BY type")
        for row in cursor.fetchall():
            print(f"   • {row['type']}: {row['count']}")
        
        # Check 4: Transactions table structure
        print("\n4️⃣  TRANSACTIONS TABLE STRUCTURE")
        print("-" * 70)
        
        cursor.execute("SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='transactions' AND TABLE_SCHEMA=%s", (MYSQL_CONFIG['database'],))
        col_count = cursor.fetchone()['count']
        print(f"✅ Total columns in transactions table: {col_count}")
        
        # Check 5: Sample transaction data
        print("\n5️⃣  SAMPLE TRANSACTION DATA")
        print("-" * 70)
        
        cursor.execute("SELECT COUNT(*) as count FROM transactions")
        tx_count = cursor.fetchone()['count']
        print(f"✅ Total transactions in database: {tx_count}")
        
        if tx_count > 0:
            cursor.execute("SELECT * FROM transactions ORDER BY id DESC LIMIT 1")
            last_tx = cursor.fetchone()
            
            print(f"\n📊 Latest transaction (ID {last_tx['id']}):")
            print(f"   Date: {last_tx['date']}")
            print(f"   Total Income: {last_tx['total_income']}")
            print(f"   Total Expense: {last_tx['total_expense']}")
            print(f"   Closing Balance: {last_tx['closing_balance']}")
            
            # Check what categories have data
            print("\n   Income entries:")
            cursor.execute("SELECT * FROM settings WHERE type='income_category' AND active=1")
            for cat in cursor.fetchall():
                field = cat['key_id']
                amount = last_tx.get(field, 0)
                if amount and float(amount) > 0:
                    print(f"      ✅ {cat['label']}: ₹{amount}")
            
            print("\n   Expense entries:")
            cursor.execute("SELECT * FROM settings WHERE type='expense_category' AND active=1")
            for cat in cursor.fetchall():
                field = cat['key_id']
                amount = last_tx.get(field, 0)
                if amount and float(amount) > 0:
                    print(f"      ✅ {cat['label']}: ₹{amount}")
        else:
            print("⚠️  No transactions found in database!")
        
        # Check 6: Missing columns
        print("\n6️⃣  CHECKING FOR MISSING COLUMNS")
        print("-" * 70)
        
        cursor.execute("SELECT key_id FROM settings WHERE active=1")
        expected_categories = [row['key_id'] for row in cursor.fetchall()]
        
        cursor.execute("SHOW COLUMNS FROM transactions")
        existing_columns = {row['Field'] for row in cursor.fetchall()}
        
        missing_columns = []
        for cat in expected_categories:
            if cat not in existing_columns:
                missing_columns.append(cat)
            if f"{cat}_method" not in existing_columns:
                missing_columns.append(f"{cat}_method")
        
        if missing_columns:
            print(f"⚠️  Missing {len(missing_columns)} columns:")
            for col in missing_columns:
                print(f"   • {col}")
            print("\n🔧 Run sync_database.py to add missing columns")
        else:
            print("✅ All expected columns exist!")
        
        # Check 7: Deep dive - what columns actually have data?
        print("\n7️⃣  CHECKING WHICH COLUMNS HAVE DATA")
        print("-" * 70)
        
        if tx_count > 0:
            cursor.execute("SELECT * FROM transactions ORDER BY id DESC LIMIT 1")
            last_tx = cursor.fetchone()
            
            print("Columns with non-zero values in latest transaction:")
            expense_cols_with_data = []
            income_cols_with_data = []
            
            for col_name, value in last_tx.items():
                if value and isinstance(value, (int, float)) and value != 0:
                    if '_method' not in col_name and '_comment' not in col_name:
                        if not col_name.startswith('total_') and not col_name.startswith('opening_') and not col_name.startswith('closing_'):
                            print(f"   • {col_name}: {value}")
                            
                            # Check if this column is in settings
                            cursor.execute("SELECT * FROM settings WHERE key_id=%s", (col_name,))
                            setting = cursor.fetchone()
                            if setting:
                                print(f"      ✅ Found in settings as: {setting['label']} ({setting['type']})")
                            else:
                                print(f"      ❌ NOT found in settings table!")
        
        cursor.close()
        conn.close()
    else:
        print("❌ MySQL connection failed")
        
except Error as e:
    print(f"❌ MySQL Connection Error: {e}")
    print("\nPossible solutions:")
    print("   1. Check .env file has correct MySQL credentials")
    print("   2. Verify MySQL host is correct (might be IP address)")
    print("   3. Ensure MySQL user has access to the database")
    print("   4. Check if MySQL server is running")
except ImportError:
    print("❌ mysql-connector-python not installed")
    print("   Run: pip install mysql-connector-python")

print("\n" + "="*70)
print("End of diagnostic check")
print("="*70 + "\n")
