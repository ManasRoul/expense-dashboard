#!/usr/bin/env python3
"""
Quick Database Backup Script - Creates a backup of MySQL database before sync
Run this BEFORE sync_database.py to safely backup your live data
"""

import mysql.connector
from mysql.connector import Error
from config import MYSQL_CONFIG
from datetime import datetime
import sys

def backup_database():
    """Create a backup SQL dump of the MySQL database"""
    
    try:
        conn = mysql.connector.connect(**MYSQL_CONFIG)
        cursor = conn.cursor()
        
        db_name = MYSQL_CONFIG['database']
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"database_backup_{db_name}_{timestamp}.sql"
        
        print(f"📦 Creating backup: {backup_filename}")
        print("  This will take a moment...\n")
        
        # Get all tables
        cursor.execute(f"SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = '{db_name}'")
        tables = cursor.fetchall()
        
        with open(backup_filename, 'w') as f:
            f.write(f"-- Database Backup for {db_name}\n")
            f.write(f"-- Created: {datetime.now()}\n")
            f.write(f"-- Using: {MYSQL_CONFIG['host']}\n\n")
            
            for (table_name,) in tables:
                # Get CREATE TABLE statement
                cursor.execute(f"SHOW CREATE TABLE {table_name}")
                create_table = cursor.fetchone()[1]
                f.write(f"\n-- ========== TABLE: {table_name} ==========\n")
                f.write(f"DROP TABLE IF EXISTS {table_name};\n")
                f.write(create_table + ";\n\n")
                
                # Get data
                cursor.execute(f"SELECT * FROM {table_name}")
                rows = cursor.fetchall()
                
                if rows:
                    # Get column names
                    cursor.execute(f"DESCRIBE {table_name}")
                    columns = [col[0] for col in cursor.fetchall()]
                    
                    for row in rows:
                        values = ', '.join([f"'{str(val).replace(chr(39), chr(39)+chr(39))}'" if val is not None else 'NULL' for val in row])
                        f.write(f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({values});\n")
        
        cursor.close()
        conn.close()
        
        print(f"✅ Backup created successfully!")
        print(f"   File: {backup_filename}")
        print(f"\n💾 Store this file in a safe location!")
        print(f"   If something goes wrong, you can restore from this backup.\n")
        
        return backup_filename
        
    except Error as e:
        print(f"❌ Backup Error: {e}")
        return None

if __name__ == "__main__":
    backup_file = backup_database()
    if not backup_file:
        sys.exit(1)
