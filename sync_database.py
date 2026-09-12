#!/usr/bin/env python3
"""
Database Sync Script - Synchronize local database schema to live MySQL server
This script:
1. Reads the local SQLite database (financial.db) for the latest categories
2. Connects to the live MySQL database
3. Adds any missing categories to the settings table
4. Creates missing columns in the transactions table
5. Preserves all existing data
"""

import sqlite3
import mysql.connector
from mysql.connector import Error
from config import MYSQL_CONFIG, USE_MYSQL
import sys

def get_local_categories():
    """Read categories from local SQLite database"""
    try:
        conn = sqlite3.connect('financial.db')
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM settings WHERE active = 1 ORDER BY sort_order')
        categories = cursor.fetchall()
        
        conn.close()
        return [dict(cat) for cat in categories]
    except Exception as e:
        print(f"❌ Error reading local database: {e}")
        return []

def connect_mysql():
    """Connect to live MySQL database"""
    try:
        conn = mysql.connector.connect(**MYSQL_CONFIG)
        if conn.is_connected():
            print(f"✅ Connected to MySQL database: {MYSQL_CONFIG['database']}")
            return conn
    except Error as e:
        print(f"❌ MySQL Connection Error: {e}")
        sys.exit(1)

def get_existing_categories(conn):
    """Get all categories currently in MySQL settings table"""
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT * FROM settings ORDER BY sort_order')
        categories = cursor.fetchall()
        cursor.close()
        return categories
    except Error as e:
        print(f"❌ Error reading settings table: {e}")
        return []

def add_missing_categories(conn, local_categories, existing_categories):
    """Add categories that exist locally but not on live server"""
    existing_keys = {cat['key_id'] for cat in existing_categories}
    added_count = 0
    
    cursor = conn.cursor()
    
    for local_cat in local_categories:
        if local_cat['key_id'] not in existing_keys:
            try:
                sql = """
                INSERT INTO settings (type, key_id, label, icon, sort_order, active)
                VALUES (%s, %s, %s, %s, %s, %s)
                """
                values = (
                    local_cat['type'],
                    local_cat['key_id'],
                    local_cat['label'],
                    local_cat['icon'] or '',
                    local_cat['sort_order'],
                    local_cat['active']
                )
                cursor.execute(sql, values)
                print(f"  ✅ Added category: {local_cat['label']} ({local_cat['key_id']})")
                added_count += 1
            except Error as e:
                print(f"  ❌ Error adding {local_cat['label']}: {e}")
    
    if added_count > 0:
        conn.commit()
        print(f"\n✅ Added {added_count} new categories\n")
    else:
        print("  ℹ️  No new categories to add\n")
    
    cursor.close()

def get_existing_columns(conn):
    """Get all columns in the transactions table"""
    try:
        cursor = conn.cursor()
        cursor.execute("DESCRIBE transactions")
        columns = cursor.fetchall()
        cursor.close()
        return [col[0] for col in columns]
    except Error as e:
        print(f"❌ Error reading table structure: {e}")
        return []

def add_missing_columns(conn, categories):
    """Add missing columns to transactions table for new categories"""
    existing_columns = get_existing_columns(conn)
    added_count = 0
    
    cursor = conn.cursor()
    
    for cat in categories:
        field = cat['key_id']
        method_field = f"{field}_method"
        comment_field = f"{field}_comment"
        
        # Check if columns exist
        fields_to_add = []
        
        if field not in existing_columns:
            fields_to_add.append((field, 'DECIMAL(10, 2) DEFAULT 0'))
        
        if method_field not in existing_columns:
            fields_to_add.append((method_field, "VARCHAR(20) DEFAULT 'cash'"))
        
        if comment_field not in existing_columns:
            fields_to_add.append((comment_field, 'TEXT'))
        
        # Add columns if needed
        for col_name, col_type in fields_to_add:
            try:
                sql = f"ALTER TABLE transactions ADD COLUMN {col_name} {col_type}"
                cursor.execute(sql)
                print(f"  ✅ Added column: {col_name}")
                added_count += 1
            except Error as e:
                if "Duplicate column name" in str(e):
                    # Column already exists, skip
                    pass
                else:
                    print(f"  ❌ Error adding column {col_name}: {e}")
    
    if added_count > 0:
        conn.commit()
        print(f"\n✅ Added {added_count} new columns\n")
    else:
        print("  ℹ️  No new columns to add\n")
    
    cursor.close()

def verify_sync(conn, local_categories):
    """Verify sync is complete"""
    print("=" * 60)
    print("📋 SYNC VERIFICATION")
    print("=" * 60)
    
    existing_cats = get_existing_categories(conn)
    print(f"\n✅ Total categories in database: {len(existing_cats)}")
    
    existing_cols = get_existing_columns(conn)
    print(f"✅ Total columns in transactions table: {len(existing_cols)}")
    
    print("\n📊 Categories synced:")
    for cat in existing_cats:
        print(f"  • {cat['label']} ({cat['key_id']}) - {cat['type']}")

def main():
    print("=" * 60)
    print("🔄 DATABASE SYNC SCRIPT")
    print("=" * 60)
    
    if not USE_MYSQL:
        print("\n❌ This script is for MySQL only!")
        print("   Please set USE_MYSQL = True in config.py")
        sys.exit(1)
    
    print("\n📖 Reading local database...")
    local_categories = get_local_categories()
    
    if not local_categories:
        print("❌ No categories found in local database!")
        sys.exit(1)
    
    print(f"✅ Found {len(local_categories)} categories locally\n")
    
    print("🔗 Connecting to live MySQL database...")
    conn = connect_mysql()
    
    print("\n📥 Checking existing categories on live server...")
    existing_categories = get_existing_categories(conn)
    print(f"✅ Found {len(existing_categories)} categories on live server\n")
    
    print("🆕 Adding missing categories...")
    add_missing_categories(conn, local_categories, existing_categories)
    
    print("🆕 Adding missing columns...")
    # Re-fetch after adding categories
    all_categories = get_existing_categories(conn)
    add_missing_columns(conn, all_categories)
    
    verify_sync(conn, local_categories)
    
    print("\n" + "=" * 60)
    print("✅ DATABASE SYNC COMPLETE!")
    print("=" * 60)
    print("\n💡 Next steps:")
    print("   1. Restart your Flask server")
    print("   2. Test the dashboard to verify all changes")
    print("   3. Check that all categories appear correctly")
    
    conn.close()

if __name__ == "__main__":
    main()
