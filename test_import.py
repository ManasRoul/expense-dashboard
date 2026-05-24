#!/usr/bin/env python3
"""
Test script to diagnose import and configuration issues
Run this on the server to see what's failing
"""

import sys
import os

print("=" * 60)
print("DIAGNOSTIC TEST SCRIPT")
print("=" * 60)

# Test 1: Python version
print("\n1. Python Version:")
print(f"   {sys.version}")

# Test 2: Check if .env exists
print("\n2. Environment File:")
env_file = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_file):
    print(f"   ✓ .env file found at: {env_file}")
    # Load it
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()
    print("   ✓ Environment variables loaded")
else:
    print(f"   ✗ .env file NOT FOUND at: {env_file}")

# Test 3: Check environment variables
print("\n3. Environment Variables:")
env_vars = ['SECRET_KEY', 'USE_MYSQL', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']
for var in env_vars:
    value = os.environ.get(var)
    if var == 'DB_PASSWORD' and value:
        print(f"   {var} = ****** (hidden)")
    elif var == 'SECRET_KEY' and value:
        print(f"   {var} = {value[:10]}... (truncated)")
    elif value:
        print(f"   {var} = {value}")
    else:
        print(f"   {var} = NOT SET ✗")

# Test 4: Import dependencies
print("\n4. Python Dependencies:")
dependencies = ['flask', 'flask_cors', 'flask_limiter', 'werkzeug']
for dep in dependencies:
    try:
        __import__(dep)
        print(f"   ✓ {dep}")
    except ImportError as e:
        print(f"   ✗ {dep} - {e}")

# Test 5: MySQL connector (if needed)
print("\n5. MySQL Connector:")
if os.environ.get('USE_MYSQL') == 'True':
    try:
        import mysql.connector
        print("   ✓ mysql-connector-python installed")
    except ImportError:
        print("   ✗ mysql-connector-python NOT installed")
else:
    print("   (Not needed - using SQLite)")

# Test 6: Import config
print("\n6. Import config.py:")
try:
    from config import USE_MYSQL, MYSQL_CONFIG
    print(f"   ✓ config imported successfully")
    print(f"   USE_MYSQL = {USE_MYSQL}")
    if USE_MYSQL:
        print(f"   MySQL Host = {MYSQL_CONFIG['host']}")
        print(f"   MySQL Database = {MYSQL_CONFIG['database']}")
except Exception as e:
    print(f"   ✗ Error importing config: {e}")
    import traceback
    traceback.print_exc()

# Test 7: Test MySQL connection (if enabled)
print("\n7. Database Connection Test:")
try:
    from config import USE_MYSQL, MYSQL_CONFIG
    if USE_MYSQL:
        import mysql.connector
        print("   Attempting MySQL connection...")
        conn = mysql.connector.connect(
            host=MYSQL_CONFIG['host'],
            user=MYSQL_CONFIG['user'],
            password=MYSQL_CONFIG['password'],
            port=MYSQL_CONFIG['port']
        )
        print("   ✓ MySQL connection successful!")
        cursor = conn.cursor()
        cursor.execute("SHOW DATABASES")
        databases = cursor.fetchall()
        print(f"   Available databases: {[db[0] for db in databases]}")
        
        # Check if our database exists
        db_name = MYSQL_CONFIG['database']
        if (db_name,) in databases:
            print(f"   ✓ Database '{db_name}' exists")
        else:
            print(f"   ⚠ Database '{db_name}' does not exist (will be created)")
        
        cursor.close()
        conn.close()
    else:
        print("   Using SQLite (no connection test needed)")
except Exception as e:
    print(f"   ✗ Database connection failed: {e}")
    import traceback
    traceback.print_exc()

# Test 8: Import server module
print("\n8. Import server.py:")
try:
    from server import app
    print("   ✓ server.py imported successfully!")
    print(f"   Flask app: {app}")
except Exception as e:
    print(f"   ✗ Error importing server.py: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("DIAGNOSTIC TEST COMPLETE")
print("=" * 60)
