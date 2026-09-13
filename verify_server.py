#!/usr/bin/env python3
"""
Verify Server.py Code - Check if latest server.py is actually running
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

from config import USE_MYSQL, MYSQL_CONFIG

print("="*70)
print("🔍 SERVER VERIFICATION CHECK")
print("="*70)

print("\n1️⃣  CONFIGURATION LOADED:")
print("-" * 70)
print(f"✅ USE_MYSQL: {USE_MYSQL}")
print(f"✅ Database: {MYSQL_CONFIG['database']}")
print(f"✅ User: {MYSQL_CONFIG['user']}")
print(f"✅ Host: {MYSQL_CONFIG['host']}")

print("\n2️⃣  CHECKING PYTHON PATH:")
print("-" * 70)
print(f"✅ Python: {sys.executable}")
print(f"✅ Version: {sys.version}")
print(f"✅ CWD: {os.getcwd()}")

# Check if server.py file is current version
print("\n3️⃣  CHECKING server.py CODE:")
print("-" * 70)

server_file = os.path.join(os.path.dirname(__file__), 'server.py')
if os.path.exists(server_file):
    with open(server_file, 'r') as f:
        server_code = f.read()
    
    # Check for key function that indicates it's the new version
    checks = {
        'build_transaction_columns_values': 'Dynamic transaction builder',
        'execute_query("SELECT key_id FROM settings WHERE type = \'income_category\'': 'Dynamic income categories',
        'execute_query("SELECT key_id FROM settings WHERE type = \'expense_category\'': 'Dynamic expense categories',
        'COALESCE(NULLIF(': 'Payment method COALESCE/NULLIF logic',
    }
    
    for check_str, description in checks.items():
        if check_str in server_code:
            print(f"✅ {description}")
        else:
            print(f"❌ {description} - NOT FOUND!")
else:
    print(f"❌ server.py not found at {server_file}")

print("\n4️⃣  TESTING DATABASE CONNECTION:")
print("-" * 70)

try:
    import mysql.connector
    from mysql.connector import Error
    
    conn = mysql.connector.connect(**MYSQL_CONFIG)
    if conn.is_connected():
        print("✅ MySQL connection successful!")
        
        cursor = conn.cursor(dictionary=True)
        
        # Check settings table
        cursor.execute("SELECT COUNT(*) as cnt FROM settings")
        cnt = cursor.fetchone()['cnt']
        print(f"✅ Settings table: {cnt} categories")
        
        # Check transactions table
        cursor.execute("SELECT COUNT(*) as cnt FROM transactions")
        tx_cnt = cursor.fetchone()['cnt']
        print(f"✅ Transactions table: {tx_cnt} transactions")
        
        cursor.close()
        conn.close()
    else:
        print("❌ MySQL connection failed")
except Exception as e:
    print(f"❌ Error: {e}")

print("\n5️⃣  CHECKING RUNNING PROCESSES:")
print("-" * 70)
os.system("ps aux | grep 'python.*server' | grep -v grep")

print("\n" + "="*70)
print("✅ VERIFICATION COMPLETE")
print("="*70)
print("\nIf you see ❌ errors above, the uploaded file may not be correct.")
print("Try:")
print("  1. Kill all Python processes: pkill -f 'python server.py'")
print("  2. Re-upload server.py via FTP")
print("  3. Wait 5 seconds")
print("  4. Restart: python3 server.py &")
print("  5. Clear browser cache: Ctrl+Shift+Delete")
print("  6. Reload dashboard: Ctrl+Shift+R")
print()
