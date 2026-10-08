#!/usr/bin/env python3
"""
Database Migration Manager
Safely applies migrations to MySQL database while tracking changes
"""

import mysql.connector
import os
import sys
from datetime import datetime
import argparse

class MigrationManager:
    def __init__(self, host, user, password, database):
        """Initialize database connection"""
        try:
            self.conn = mysql.connector.connect(
                host=host,
                user=user,
                password=password,
                database=database,
                autocommit=False  # Disable autocommit for transaction control
            )
            self.cursor = self.conn.cursor(dictionary=True)
            print(f"✓ Connected to database '{database}'")
        except mysql.connector.Error as e:
            print(f"✗ Connection failed: {e}")
            sys.exit(1)
        
        self.migration_dir = 'migrations'
        self.ensure_migration_table()
    
    def ensure_migration_table(self):
        """Create schema_migrations table if it doesn't exist"""
        try:
            self.cursor.execute('''
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    migration_name VARCHAR(255) NOT NULL UNIQUE,
                    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    status VARCHAR(20) DEFAULT 'success'
                )
            ''')
            self.conn.commit()
            print("✓ Migration tracking table ready")
        except mysql.connector.Error as e:
            print(f"✗ Error creating migration table: {e}")
            self.conn.rollback()
            sys.exit(1)
    
    def get_applied_migrations(self):
        """Get list of applied migrations"""
        try:
            self.cursor.execute('SELECT migration_name FROM schema_migrations WHERE status = "success"')
            return [row['migration_name'] for row in self.cursor.fetchall()]
        except mysql.connector.Error as e:
            print(f"✗ Error reading migrations: {e}")
            return []
    
    def get_pending_migrations(self):
        """Get list of migrations not yet applied"""
        if not os.path.exists(self.migration_dir):
            print(f"⚠ Migrations directory '{self.migration_dir}' not found")
            return []
        
        applied = self.get_applied_migrations()
        all_migrations = sorted([f for f in os.listdir(self.migration_dir) if f.endswith('.sql')])
        
        return [m for m in all_migrations if m not in applied]
    
    def apply_migration(self, migration_file):
        """Apply a single migration file"""
        migration_path = os.path.join(self.migration_dir, migration_file)
        
        if not os.path.exists(migration_path):
            print(f"✗ Migration file not found: {migration_path}")
            return False
        
        try:
            # Read migration file
            with open(migration_path, 'r') as f:
                sql_content = f.read()
            
            # Split by semicolons to handle multiple statements
            statements = [s.strip() for s in sql_content.split(';') if s.strip()]
            
            print(f"\n📝 Applying migration: {migration_file}")
            print(f"   Executing {len(statements)} SQL statement(s)...")
            
            # Execute each statement
            for i, statement in enumerate(statements, 1):
                try:
                    self.cursor.execute(statement)
                except mysql.connector.Error as e:
                    # Skip if statement contains migration tracking (will add later)
                    if 'schema_migrations' not in statement:
                        print(f"   Statement {i}: {e}")
                        raise
            
            # Record in tracking table
            try:
                self.cursor.execute(
                    'INSERT INTO schema_migrations (migration_name, status) VALUES (%s, %s)',
                    (migration_file, 'success')
                )
            except mysql.connector.Error:
                # Migration might already be recorded if this runs twice
                pass
            
            self.conn.commit()
            print(f"✓ Successfully applied: {migration_file}")
            return True
            
        except Exception as e:
            print(f"✗ Error applying {migration_file}: {e}")
            self.conn.rollback()
            
            # Record failure
            try:
                self.cursor.execute(
                    'INSERT INTO schema_migrations (migration_name, status) VALUES (%s, %s)',
                    (migration_file, 'failed')
                )
                self.conn.commit()
            except:
                pass
            
            return False
    
    def apply_all_migrations(self):
        """Apply all pending migrations in order"""
        pending = self.get_pending_migrations()
        
        if not pending:
            print("✓ No pending migrations")
            return True
        
        print(f"\n📦 Found {len(pending)} pending migration(s):")
        for m in pending:
            print(f"   - {m}")
        
        response = input("\n⚠ Continue with migration? (yes/no): ").lower().strip()
        if response != 'yes':
            print("Migration cancelled")
            return False
        
        print("\n" + "="*60)
        
        success_count = 0
        for migration in pending:
            if self.apply_migration(migration):
                success_count += 1
        
        print("\n" + "="*60)
        print(f"\n📊 Results: {success_count}/{len(pending)} migrations applied")
        
        if success_count == len(pending):
            print("✓ All migrations applied successfully!")
            return True
        else:
            print("⚠ Some migrations failed. Check log above for details.")
            return False
    
    def list_migrations(self):
        """List all migrations (applied and pending)"""
        applied = self.get_applied_migrations()
        pending = self.get_pending_migrations()
        
        print("\n📚 Migration Status:")
        print("="*60)
        
        if applied:
            print("\n✓ Applied Migrations:")
            for m in applied:
                print(f"   [✓] {m}")
        else:
            print("\n✓ No migrations applied yet")
        
        if pending:
            print(f"\n⏳ Pending Migrations ({len(pending)}):")
            for m in pending:
                print(f"   [ ] {m}")
        else:
            print("\n✓ No pending migrations")
        
        print("="*60)
    
    def status(self):
        """Show current database migration status"""
        applied = self.get_applied_migrations()
        pending = self.get_pending_migrations()
        
        print(f"\nDatabase: Migration Status")
        print(f"Applied:  {len(applied)} migration(s)")
        print(f"Pending:  {len(pending)} migration(s)")
        print(f"Total:    {len(applied) + len(pending)} migration(s)")
        
        if pending:
            print(f"\nNext migration to apply: {pending[0]}")
    
    def close(self):
        """Close database connection"""
        self.cursor.close()
        self.conn.close()


def main():
    parser = argparse.ArgumentParser(
        description='Database Migration Manager',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python migrate.py --status                    Show migration status
  python migrate.py --list                      List all migrations
  python migrate.py --host localhost            Apply pending migrations
  python migrate.py --help                      Show this help message

Make sure to backup your database before running migrations!
        '''
    )
    
    parser.add_argument('--host', default='localhost', help='Database host')
    parser.add_argument('--user', default='root', help='Database user')
    parser.add_argument('--password', default='', help='Database password')
    parser.add_argument('--database', default='expense_dashboard', help='Database name')
    parser.add_argument('--status', action='store_true', help='Show migration status')
    parser.add_argument('--list', action='store_true', help='List all migrations')
    
    args = parser.parse_args()
    
    # Create manager
    manager = MigrationManager(args.host, args.user, args.password, args.database)
    
    try:
        if args.status:
            manager.status()
        elif args.list:
            manager.list_migrations()
        else:
            manager.apply_all_migrations()
    finally:
        manager.close()


if __name__ == '__main__':
    main()
