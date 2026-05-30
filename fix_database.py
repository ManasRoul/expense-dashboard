"""
Fix script for production MySQL database:
1. Convert all tables to utf8mb4 (fixes ₹ showing as ?)
2. Add missing _comment columns to transactions table
3. Fix date column type (TIMESTAMP -> DATE for proper formatting)
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))

# Load .env
env_file = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_file):
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

from config import MYSQL_CONFIG
import mysql.connector

conn = mysql.connector.connect(**MYSQL_CONFIG, charset='utf8mb4', collation='utf8mb4_unicode_ci')
cursor = conn.cursor()

print("=" * 50)
print("DATABASE FIX SCRIPT")
print("=" * 50)

# 1. Convert all tables to utf8mb4
print("\n[1] Converting tables to utf8mb4...")
tables = ['transactions', 'salary_records', 'settings', 'users']
for table in tables:
    try:
        cursor.execute(f"ALTER TABLE `{table}` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        print(f"  ✓ {table} converted to utf8mb4")
    except Exception as e:
        print(f"  ✗ {table}: {e}")

# 2. Also set database default charset
print("\n[2] Setting database default charset...")
try:
    cursor.execute(f"ALTER DATABASE `{MYSQL_CONFIG['database']}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
    print("  ✓ Database charset set to utf8mb4")
except Exception as e:
    print(f"  ✗ {e}")

# 3. Add missing comment columns
print("\n[3] Adding missing _comment columns...")
cursor.execute("SHOW COLUMNS FROM transactions")
existing = {row[0] for row in cursor.fetchall()}

comment_columns = [
    'room_rent_comment', 'mattress_charge_comment', 'travel_cab_comment',
    'kitchen_facility_comment', 'clean_charge_comment', 'misc_receipt_comment',
    'brokerage_comment', 'salary_comment', 'room_cleaning_charge_comment',
    'generator_maintenance_comment', 'hotel_stationary_comment',
    'hotel_cleaning_sanitation_comment', 'rent_taxes_comment', 'tv_recharge_comment',
    'camera_wifi_comment', 'plumbing_maintenance_comment',
    'electricity_maintenance_comment', 'electricity_bill_comment',
    'staff_fooding_comment', 'laundry_comment', 'owner_kitchen_cab_comment',
    'office_stationary_comment', 'misc_expenses_comment'
]

added = 0
for col in comment_columns:
    if col not in existing:
        try:
            cursor.execute(f"ALTER TABLE transactions ADD COLUMN `{col}` VARCHAR(500) DEFAULT ''")
            print(f"  ✓ Added: {col}")
            added += 1
        except Exception as e:
            print(f"  ✗ {col}: {e}")

if added == 0:
    print("  All comment columns already exist.")

# 4. Fix date column - change from TIMESTAMP to DATE
print("\n[4] Fixing date column format...")
try:
    cursor.execute("SHOW COLUMNS FROM transactions WHERE Field = 'date'")
    date_col = cursor.fetchone()
    if date_col and 'timestamp' in date_col[1].lower():
        cursor.execute("ALTER TABLE transactions MODIFY COLUMN `date` DATE NOT NULL")
        print("  ✓ Changed 'date' column from TIMESTAMP to DATE")
    elif date_col and 'date' in date_col[1].lower():
        print("  Already DATE type, no change needed.")
    else:
        print(f"  Current type: {date_col[1] if date_col else 'unknown'}")
except Exception as e:
    print(f"  ✗ {e}")

# 5. Fix salary_records date column too
try:
    cursor.execute("SHOW COLUMNS FROM salary_records WHERE Field = 'date'")
    date_col = cursor.fetchone()
    if date_col and 'timestamp' in date_col[1].lower():
        cursor.execute("ALTER TABLE salary_records MODIFY COLUMN `date` DATE NOT NULL")
        print("  ✓ Fixed salary_records date column too")
except Exception as e:
    print(f"  ✗ salary_records date: {e}")

conn.commit()
cursor.close()
conn.close()

print("\n" + "=" * 50)
print("ALL FIXES APPLIED! Restart your app now.")
print("=" * 50)
