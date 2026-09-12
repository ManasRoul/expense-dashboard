#!/usr/bin/env python3
"""
Emergency Patch Script - Fix server.py with dynamic category loading
Run this on live server to patch the existing server.py
"""

import os
import shutil
from datetime import datetime

print("="*70)
print("🔧 EMERGENCY PATCH SCRIPT - Adding Dynamic Categories")
print("="*70)

server_file = os.path.join(os.path.dirname(__file__), 'server.py')

if not os.path.exists(server_file):
    print(f"❌ server.py not found at {server_file}")
    exit(1)

# Backup original
backup_file = f"server.py.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
shutil.copy(server_file, backup_file)
print(f"✅ Backed up to: {backup_file}")

# Read current file
with open(server_file, 'r') as f:
    content = f.read()

# Check if already patched
if "SELECT key_id FROM settings WHERE type = 'income_category'" in content:
    print("✅ File already has dynamic categories!")
    exit(0)

print("\n🔍 Analyzing file...")

# Find build_transaction_columns_values function and patch it
old_function = '''def build_transaction_columns_values(data, entry_date):
    """Build columns and values for INSERT/UPDATE from transaction data."""
    placeholder = '%s' if USE_MYSQL else '?'
    columns = ['date', 'opening_balance']
    values_list = [entry_date, data['openingBalance']]
    
    # Process income categories
    for key in KNOWN_INCOME_KEYS:'''

new_function = '''def build_transaction_columns_values(data, entry_date):
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
    for key in income_keys:'''

if old_function in content:
    content = content.replace(old_function, new_function)
    print("✅ Patched: Income categories to load from settings")
else:
    print("⚠️  Could not find old income function pattern")

# Patch expense categories
old_expense = '''    columns.append('total_income')
    values_list.append(data.get('income', {}).get('totalIncome', 0))
    
    # Process expense categories
    for key in KNOWN_EXPENSE_KEYS:'''

new_expense = '''    columns.append('total_income')
    values_list.append(data.get('income', {}).get('totalIncome', 0))
    
    # Get all active expense categories from settings (not just KNOWN_EXPENSE_KEYS)
    expense_categories = execute_query(
        "SELECT key_id FROM settings WHERE type = 'expense_category' AND active = 1 ORDER BY sort_order",
        fetch=True
    )
    expense_keys = [cat['key_id'] for cat in expense_categories] if expense_categories else KNOWN_EXPENSE_KEYS
    
    # Process expense categories
    for key in expense_keys:'''

if old_expense in content:
    content = content.replace(old_expense, new_expense)
    print("✅ Patched: Expense categories to load from settings")
else:
    print("⚠️  Could not find old expense function pattern")

# Write patched file
with open(server_file, 'w') as f:
    f.write(content)

print("\n✅ PATCHING COMPLETE!")
print(f"✅ Patched server.py")
print(f"✅ Backup saved to: {backup_file}")

print("\n🔄 Now restart Flask:")
print("   pkill -f 'python server.py'")
print("   sleep 2")
print("   python3 server.py &")

print("\n✅ After restart, verify with:")
print("   python3 verify_server.py")

print("\n" + "="*70)
