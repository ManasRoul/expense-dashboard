#!/usr/bin/env python3
"""
Fix password hash column length and reset admin password
Run this on the server to fix the truncated password hash issue
"""

import sys
import os

# Load environment variables
env_file = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_file):
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

from config import USE_MYSQL, MYSQL_CONFIG
from werkzeug.security import generate_password_hash

print("=" * 60)
print("PASSWORD HASH COLUMN FIX")
print("=" * 60)

if not USE_MYSQL:
    print("ERROR: This script is for MySQL only (SQLite uses TEXT which has no limit)")
    sys.exit(1)

try:
    import mysql.connector
    from mysql.connector import Error
except ImportError:
    print("ERROR: mysql-connector-python not installed!")
    sys.exit(1)

# Connect to database
try:
    print("\n1. Connecting to MySQL database...")
    conn = mysql.connector.connect(
        host=MYSQL_CONFIG['host'],
        user=MYSQL_CONFIG['user'],
        password=MYSQL_CONFIG['password'],
        database=MYSQL_CONFIG['database'],
        port=MYSQL_CONFIG['port']
    )
    cursor = conn.cursor(dictionary=True)
    print("   ✓ Connected successfully")
except Error as e:
    print(f"   ✗ Connection failed: {e}")
    sys.exit(1)

# Check current column length
print("\n2. Checking current password_hash column length...")
cursor.execute("""
    SELECT CHARACTER_MAXIMUM_LENGTH 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = %s 
    AND TABLE_NAME = 'users' 
    AND COLUMN_NAME = 'password_hash'
""", (MYSQL_CONFIG['database'],))
result = cursor.fetchone()

if result:
    current_length = result['CHARACTER_MAXIMUM_LENGTH']
    print(f"   Current length: VARCHAR({current_length})")
    
    if current_length < 255:
        print("   ⚠ Length is too small (needs VARCHAR(255))")
        
        # Alter table
        print("\n3. Altering table to increase column length...")
        try:
            cursor.execute("ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) NOT NULL")
            conn.commit()
            print("   ✓ Column altered successfully to VARCHAR(255)")
        except Error as e:
            print(f"   ✗ Failed to alter table: {e}")
            cursor.close()
            conn.close()
            sys.exit(1)
    else:
        print("   ✓ Length is already sufficient (VARCHAR(255))")
else:
    print("   ✗ Could not find password_hash column")
    cursor.close()
    conn.close()
    sys.exit(1)

# Get all users with their current passwords
print("\n4. Fetching existing users...")
cursor.execute("SELECT id, username, password_hash, role FROM users")
users = cursor.fetchall()
print(f"   Found {len(users)} users")

# Check which passwords are truncated
truncated_users = []
for user in users:
    hash_len = len(user['password_hash'])
    print(f"   - {user['username']}: password_hash length = {hash_len}")
    if hash_len < 100:  # PBKDF2 hashes should be ~100-150 chars
        print(f"     ⚠ This password appears truncated!")
        truncated_users.append(user)

# Reset admin password
print("\n5. Resetting admin user password...")
new_password = 'admin123'
new_hash = generate_password_hash(new_password, method='pbkdf2:sha256', salt_length=16)

print(f"   New hash length: {len(new_hash)} characters")
print(f"   Hash preview: {new_hash[:50]}...")

try:
    cursor.execute(
        "UPDATE users SET password_hash = %s WHERE username = 'admin'",
        (new_hash,)
    )
    conn.commit()
    
    if cursor.rowcount > 0:
        print("   ✓ Admin password reset successfully")
        print("   Username: admin")
        print("   Password: admin123")
    else:
        print("   ⚠ Admin user not found in database")
except Error as e:
    print(f"   ✗ Failed to reset password: {e}")

# Verify the update
print("\n6. Verifying password storage...")
cursor.execute("SELECT username, LENGTH(password_hash) as hash_length FROM users WHERE username = 'admin'")
result = cursor.fetchone()
if result:
    print(f"   Admin password_hash length: {result['hash_length']} characters")
    if result['hash_length'] > 100:
        print("   ✓ Password hash is now properly stored!")
    else:
        print("   ✗ Password hash is still truncated - something went wrong")
else:
    print("   ✗ Could not verify admin user")

cursor.close()
conn.close()

print("\n" + "=" * 60)
print("FIX COMPLETE")
print("=" * 60)
print("\nYou can now login with:")
print("  Username: admin")
print("  Password: admin123")
print("\nRestart your application in cPanel if needed.")
