# Database Migration Strategy for Live Production

## Overview
This document describes how to safely apply database changes to your live MySQL database without downtime.

## Best Practices

### 1. **Always Backup Before Migration**
```bash
# Export your database before any changes
mysqldump -u username -p database_name > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. **Use Migration Files**
- Each change should be in a separate numbered migration file
- Keep migrations in a `migrations/` folder
- Example: `001_add_salary_amount_column.sql`

### 3. **Test First on Local/Staging**
- Apply migration to local/staging environment first
- Verify everything works
- Then apply to production

## Migration File Structure

Create a `migrations/` folder with files like:
```
migrations/
├── 001_initial_schema.sql
├── 002_add_salary_records_table.sql
├── 003_add_salary_amount_to_settings.sql
├── 004_add_carryover_fields.sql
└── migration_log.sql
```

## Migration Tracking Table

Create this table to track which migrations have been applied:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Safe Migration Workflow

### Step 1: Create Migration File
```sql
-- migrations/004_add_carryover_fields.sql
-- Description: Add carryover detection fields to salary_records table
-- Risk Level: LOW (adding columns, backward compatible)

ALTER TABLE salary_records 
ADD COLUMN IF NOT EXISTS carryover_status VARCHAR(20) DEFAULT 'none';

ALTER TABLE salary_records 
ADD COLUMN IF NOT EXISTS carryover_from_date DATE DEFAULT NULL;

-- Migration complete marker
INSERT INTO schema_migrations (migration_name) VALUES ('004_add_carryover_fields');
```

### Step 2: Backup Production
```bash
mysqldump -u your_user -p your_database > backup_before_migration.sql
```

### Step 3: Test Locally First
```bash
mysql -u local_user -p local_database < migrations/004_add_carryover_fields.sql
```

### Step 4: Apply to Production
```bash
mysql -u prod_user -p prod_database < migrations/004_add_carryover_fields.sql
```

### Step 5: Verify Success
```sql
-- Check if migration was recorded
SELECT * FROM schema_migrations ORDER BY applied_at DESC;

-- Verify the table changes
DESCRIBE salary_records;
```

## For Shared Hosting (cPanel/Plesk)

### Using phpMyAdmin:
1. Login to cPanel → phpMyAdmin
2. Select your database
3. Go to "SQL" tab
4. Paste migration SQL code
5. Click "Execute"
6. Check "schema_migrations" table to verify

### Using SSH (if available):
```bash
mysql -h your_host -u your_user -p your_database < migration.sql
```

## Python Script for Safe Migrations

Create `manage_migrations.py`:

```python
#!/usr/bin/env python3
import mysql.connector
from datetime import datetime
import os
import sys

class MigrationManager:
    def __init__(self, host, user, password, database):
        self.conn = mysql.connector.connect(
            host=host,
            user=user,
            password=password,
            database=database
        )
        self.cursor = self.conn.cursor()
        self.ensure_migration_table()
    
    def ensure_migration_table(self):
        """Create schema_migrations table if it doesn't exist"""
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                migration_name VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        self.conn.commit()
    
    def get_applied_migrations(self):
        """Get list of applied migrations"""
        self.cursor.execute('SELECT migration_name FROM schema_migrations')
        return [row[0] for row in self.cursor.fetchall()]
    
    def apply_migration(self, migration_file):
        """Apply a single migration file"""
        migration_name = os.path.basename(migration_file)
        
        # Check if already applied
        applied = self.get_applied_migrations()
        if migration_name in applied:
            print(f"✓ Migration {migration_name} already applied")
            return True
        
        try:
            # Read migration file
            with open(migration_file, 'r') as f:
                sql = f.read()
            
            # Execute migration
            print(f"Applying {migration_name}...")
            self.cursor.execute(sql)
            self.conn.commit()
            
            # Record in tracking table
            self.cursor.execute(
                'INSERT INTO schema_migrations (migration_name) VALUES (%s)',
                (migration_name,)
            )
            self.conn.commit()
            
            print(f"✓ Migration {migration_name} applied successfully")
            return True
            
        except Exception as e:
            print(f"✗ Error applying {migration_name}: {e}")
            self.conn.rollback()
            return False
    
    def apply_all_migrations(self):
        """Apply all pending migrations in order"""
        migration_dir = 'migrations'
        
        # Get list of migration files
        migrations = sorted([f for f in os.listdir(migration_dir) if f.endswith('.sql')])
        
        print(f"Found {len(migrations)} migration(s)")
        
        success_count = 0
        for migration in migrations:
            migration_path = os.path.join(migration_dir, migration)
            if self.apply_migration(migration_path):
                success_count += 1
        
        print(f"\n{success_count}/{len(migrations)} migrations applied successfully")
        return success_count == len(migrations)
    
    def rollback_last_migration(self):
        """Remove last migration (requires rollback SQL file)"""
        # Get last applied migration
        self.cursor.execute(
            'SELECT migration_name FROM schema_migrations ORDER BY applied_at DESC LIMIT 1'
        )
        result = self.cursor.fetchone()
        
        if not result:
            print("No migrations to rollback")
            return
        
        last_migration = result[0]
        rollback_file = f"migrations/rollback_{last_migration}"
        
        if not os.path.exists(rollback_file):
            print(f"Rollback file not found: {rollback_file}")
            return
        
        try:
            with open(rollback_file, 'r') as f:
                sql = f.read()
            
            self.cursor.execute(sql)
            self.cursor.execute(
                'DELETE FROM schema_migrations WHERE migration_name = %s',
                (last_migration,)
            )
            self.conn.commit()
            
            print(f"✓ Rolled back {last_migration}")
        except Exception as e:
            print(f"✗ Error rolling back: {e}")
            self.conn.rollback()
    
    def close(self):
        self.cursor.close()
        self.conn.close()


if __name__ == '__main__':
    # Configuration
    HOST = 'your_host'
    USER = 'your_user'
    PASSWORD = 'your_password'
    DATABASE = 'your_database'
    
    manager = MigrationManager(HOST, USER, PASSWORD, DATABASE)
    
    if len(sys.argv) > 1 and sys.argv[1] == 'rollback':
        manager.rollback_last_migration()
    else:
        manager.apply_all_migrations()
    
    manager.close()
```

## Migration File Examples

### Example 1: Add Column (Low Risk)
```sql
-- migrations/005_add_notes_to_transactions.sql
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL AFTER closing_balance;

INSERT INTO schema_migrations (migration_name) VALUES ('005_add_notes_to_transactions');
```

### Example 2: Modify Column (Medium Risk)
```sql
-- migrations/006_increase_amount_precision.sql
-- Backup first! This changes data type
ALTER TABLE salary_records 
MODIFY COLUMN amount DECIMAL(12, 2) NOT NULL;

INSERT INTO schema_migrations (migration_name) VALUES ('006_increase_amount_precision');
```

### Example 3: Add Index (Low Risk, Improves Performance)
```sql
-- migrations/007_add_salary_indexes.sql
ALTER TABLE salary_records 
ADD INDEX IF NOT EXISTS idx_employee_date (employee_name, date);

ALTER TABLE transactions 
ADD INDEX IF NOT EXISTS idx_salary_status (salary, date);

INSERT INTO schema_migrations (migration_name) VALUES ('007_add_salary_indexes');
```

## Deployment Checklist

- [ ] Create migration file with clear description
- [ ] Test on local database first
- [ ] Create backup of production database
- [ ] Document rollback procedure
- [ ] Apply migration during low-traffic time (early morning)
- [ ] Monitor for errors in logs
- [ ] Verify data integrity after migration
- [ ] Test application features work correctly
- [ ] Document the change in version control

## Rollback Procedure

If something goes wrong:

### Quick Rollback (Restore from Backup):
```bash
mysql -u user -p database < backup_before_migration.sql
```

### Automated Rollback (if using migration manager):
```bash
python3 manage_migrations.py rollback
```

## Safety Rules for Production

1. **Never use `DROP TABLE`** - Use soft deletes (add `deleted_at` column)
2. **Add new columns with defaults** - Don't add NOT NULL columns without default
3. **Make changes backwards compatible** - Old code should still work
4. **Test on staging first** - Always!
5. **Backup before every migration** - No exceptions
6. **Document every change** - Future you will thank you
7. **Use transactions** - Wrap changes in BEGIN/COMMIT

## Version Control

Add to your `.gitignore`:
```
*.sql
!migrations/*.sql
backup_*.sql
```

Track migrations in Git:
```bash
git add migrations/
git commit -m "Add migration: add carryover fields to salary_records"
```

## Monitoring After Deployment

```sql
-- Check for any errors or issues
SELECT COUNT(*) as total_records FROM salary_records;
SELECT COUNT(*) as total_transactions FROM transactions;
SELECT * FROM schema_migrations ORDER BY applied_at DESC LIMIT 5;
```

## Questions?

For production deployment help, contact your hosting provider's support team.
