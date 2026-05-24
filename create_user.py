#!/usr/bin/env python3
"""
User Creation Script for Financial Dashboard
Creates owner or contributor users in the database
Works with both MySQL (production) and SQLite (local development)
"""

import sys
import os

# Load environment variables from .env if it exists
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

def hash_password(password):
    """Hash password using PBKDF2-SHA256 (same as server.py)"""
    return generate_password_hash(password, method='pbkdf2:sha256', salt_length=16)

def create_user(username, password, role='contributor'):
    """
    Create a new user in the database
    
    Args:
        username: Unique username
        password: Plain text password (will be hashed)
        role: Either 'owner' or 'contributor'
    """
    if role not in ['owner', 'contributor']:
        print("❌ Error: Role must be 'owner' or 'contributor'")
        return False
    
    try:
        if USE_MYSQL:
            # MySQL connection (PRODUCTION)
            import mysql.connector
            from mysql.connector import Error, IntegrityError
            
            print(f"📊 Using MySQL database: {MYSQL_CONFIG['database']} @ {MYSQL_CONFIG['host']}")
            
            conn = mysql.connector.connect(
                host=MYSQL_CONFIG['host'],
                user=MYSQL_CONFIG['user'],
                password=MYSQL_CONFIG['password'],
                database=MYSQL_CONFIG['database'],
                port=MYSQL_CONFIG['port']
            )
            cursor = conn.cursor()
            placeholder = '%s'
        else:
            # SQLite connection (LOCAL DEVELOPMENT ONLY)
            import sqlite3
            print("📊 Using SQLite database: financial.db (local development)")
            conn = sqlite3.connect('financial.db')
            cursor = conn.cursor()
            placeholder = '?'
            IntegrityError = sqlite3.IntegrityError
        
        password_hash = hash_password(password)
        
        query = f"INSERT INTO users (username, password_hash, role) VALUES ({placeholder}, {placeholder}, {placeholder})"
        cursor.execute(query, (username, password_hash, role))
        
        conn.commit()
        conn.close()
        
        print("=" * 50)
        print("✅ User created successfully!")
        print("=" * 50)
        print(f"   Username: {username}")
        print(f"   Password: {password}")
        print(f"   Role: {role}")
        print(f"   Hash length: {len(password_hash)} characters")
        print("=" * 50)
        return True
        
    except IntegrityError:
        print("=" * 50)
        print(f"❌ Error: Username '{username}' already exists!")
        print("=" * 50)
        return False
    except Exception as e:
        print("=" * 50)
        print(f"❌ Error: {e}")
        print("=" * 50)
        return False

def list_users():
    """List all users in the database"""
    try:
        if USE_MYSQL:
            # MySQL connection (PRODUCTION)
            import mysql.connector
            
            print(f"📊 Using MySQL database: {MYSQL_CONFIG['database']} @ {MYSQL_CONFIG['host']}\n")
            
            conn = mysql.connector.connect(
                host=MYSQL_CONFIG['host'],
                user=MYSQL_CONFIG['user'],
                password=MYSQL_CONFIG['password'],
                database=MYSQL_CONFIG['database'],
                port=MYSQL_CONFIG['port']
            )
            cursor = conn.cursor()
        else:
            # SQLite connection (LOCAL DEVELOPMENT ONLY)
            import sqlite3
            print("📊 Using SQLite database: financial.db (local development)\n")
            conn = sqlite3.connect('financial.db')
            cursor = conn.cursor()
        
        cursor.execute("SELECT id, username, role, created_at FROM users ORDER BY id")
        users = cursor.fetchall()
        
        conn.close()
        
        if not users:
            print("No users found in database")
            return
        
        print("=" * 70)
        print("📋 Current Users")
        print("=" * 70)
        print(f"{'ID':<5} {'Username':<20} {'Role':<15} {'Created At':<30}")
        print("-" * 70)
        
        for user in users:
            role_icon = "👑" if user[2] == 'owner' else "👤"
            print(f"{user[0]:<5} {user[1]:<20} {role_icon} {user[2]:<13} {user[3]:<30}")
        
        print("=" * 70 + "\n")
        
    except Exception as e:
        print(f"❌ Error listing users: {e}")

def main():
    """Main function"""
    
    print("\n" + "=" * 50)
    print("👥 Financial Dashboard - User Management")
    print("=" * 50)
    
    # Show which database we're connected to
    if USE_MYSQL:
        print(f"🔗 Connected to: MySQL ({MYSQL_CONFIG['database']})")
    else:
        print("🔗 Connected to: SQLite (financial.db - local only)")
    print("=" * 50 + "\n")
    
    if len(sys.argv) == 1:
        # No arguments, show menu
        print("Choose an option:")
        print("  1. Create new user")
        print("  2. List all users")
        print("  3. Exit")
        print()
        
        choice = input("Enter choice (1-3): ").strip()
        
        if choice == '1':
            print("\n--- Create New User ---\n")
            username = input("Enter username: ").strip()
            password = input("Enter password: ").strip()
            
            print("\nSelect role:")
            print("  1. Owner (can delete transactions)")
            print("  2. Contributor (cannot delete)")
            role_choice = input("Enter choice (1-2): ").strip()
            
            role = 'owner' if role_choice == '1' else 'contributor'
            
            create_user(username, password, role)
            
        elif choice == '2':
            list_users()
            
        elif choice == '3':
            print("Goodbye!")
            sys.exit(0)
        else:
            print("Invalid choice!")
            sys.exit(1)
    
    elif len(sys.argv) == 2 and sys.argv[1] == 'list':
        list_users()
    
    elif len(sys.argv) == 4:
        username = sys.argv[1]
        password = sys.argv[2]
        role = sys.argv[3]
        
        create_user(username, password, role)
    
    else:
        print("Usage:")
        print("  Interactive mode:")
        print("    python3 create_user.py")
        print()
        print("  Command line mode:")
        print("    python3 create_user.py <username> <password> <role>")
        print()
        print("  List users:")
        print("    python3 create_user.py list")
        print()
        print("Examples:")
        print("    python3 create_user.py john password123 owner")
        print("    python3 create_user.py jane mypass456 contributor")

if __name__ == '__main__':
    main()
