#!/usr/bin/env python3
"""
Data Mismatch Repair Script - Fix transactions where data isn't matching columns
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
import mysql.connector
from mysql.connector import Error

print("="*70)
print("🔧 DATA MISMATCH REPAIR SCRIPT")
print("="*70)

try:
    conn = mysql.connector.connect(**MYSQL_CONFIG)
    cursor = conn.cursor(dictionary=True)
    
    print("\n📋 Checking latest transaction...")
    cursor.execute("SELECT * FROM transactions ORDER BY id DESC LIMIT 1")
    last_tx = cursor.fetchone()
    
    print(f"\nTransaction ID: {last_tx['id']}")
    print(f"Date: {last_tx['date']}")
    print(f"Total Income: {last_tx['total_income']}")
    print(f"Total Expense: {last_tx['total_expense']}")
    
    # Get all expense categories from settings
    cursor.execute("SELECT * FROM settings WHERE type='expense_category' AND active=1 ORDER BY sort_order")
    expense_cats = cursor.fetchall()
    
    print(f"\n🔍 Checking {len(expense_cats)} expense columns:")
    print("-" * 70)
    
    total_found = 0
    empty_cols = []
    
    for cat in expense_cats:
        field = cat['key_id']
        amount = last_tx.get(field)
        
        if amount and float(amount) > 0:
            print(f"✅ {cat['label']:30} ({field:20}): ₹{amount}")
            total_found += float(amount)
        else:
            empty_cols.append((field, cat['label']))
    
    if empty_cols:
        print(f"\n⚠️  Empty columns ({len(empty_cols)}):")
        for field, label in empty_cols:
            print(f"   • {label:30} ({field:20}): ₹0.00")
    
    print(f"\n💹 Summary:")
    print(f"   Total Expense in DB: ₹{last_tx['total_expense']}")
    print(f"   Total found in columns: ₹{total_found}")
    print(f"   Missing: ₹{float(last_tx['total_expense']) - total_found}")
    
    if float(last_tx['total_expense']) > total_found:
        print(f"\n❌ ISSUE: Data exists but not in expense columns!")
        print(f"   The ₹{float(last_tx['total_expense']) - total_found} is missing from category columns")
        
        # Check all columns for any data
        print(f"\n🔎 Scanning ALL columns for non-zero values:")
        print("-" * 70)
        data_found = False
        for col_name, value in last_tx.items():
            if value and isinstance(value, (int, float)) and value > 0:
                if col_name not in ['id', 'total_income', 'total_expense', 'closing_balance', 'opening_balance']:
                    if '_method' not in col_name and '_comment' not in col_name:
                        print(f"   • {col_name}: {value}")
                        data_found = True
        
        if not data_found:
            print(f"   ❌ NO category data found anywhere in transaction!")
            print(f"\n💡 This means:")
            print(f"   1. Data was calculated but not inserted into columns")
            print(f"   2. Likely reason: server.py using old hardcoded categories")
            print(f"   3. Solution: Update server.py to use dynamic categories from settings table")
    else:
        print(f"\n✅ Data matches correctly!")
    
    cursor.close()
    conn.close()
    
except Error as e:
    print(f"❌ Error: {e}")

print("\n" + "="*70 + "\n")
