"""Run this script on the server to add missing _comment columns to the transactions table."""
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

conn = mysql.connector.connect(**MYSQL_CONFIG)
cursor = conn.cursor()

# Get existing columns
cursor.execute(f"SHOW COLUMNS FROM transactions")
existing = {row[0] for row in cursor.fetchall()}

# All comment columns that should exist
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
        cursor.execute(f"ALTER TABLE transactions ADD COLUMN `{col}` TEXT DEFAULT ''")
        print(f"  Added: {col}")
        added += 1

conn.commit()
cursor.close()
conn.close()

print(f"\nDone! Added {added} missing column(s)." if added else "\nAll columns already exist.")
