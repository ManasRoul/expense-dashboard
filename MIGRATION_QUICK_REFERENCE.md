# Database Migration Quick Reference

## 📋 Quick Start for Shared Hosting

### Using phpMyAdmin (Easiest)

**Step 1: Backup**
```
cPanel → phpMyAdmin → Your Database → Export → Go
```

**Step 2: Migrate**
```
phpMyAdmin → SQL Tab → Paste Migration SQL → Execute
```

**Step 3: Verify**
```
phpMyAdmin → Table Name → Structure Tab → Check new columns
```

**Step 4: Rollback (if needed)**
```
phpMyAdmin → SQL Tab → Paste Backup SQL → Execute
```

---

## 🚀 Common Migration Tasks

### Add a New Column (Low Risk)
```sql
ALTER TABLE salary_records 
ADD COLUMN new_field VARCHAR(100) DEFAULT 'value';
```
✓ Safe - doesn't affect existing data

### Modify Column Type (Medium Risk)
```sql
ALTER TABLE salary_records 
MODIFY COLUMN amount DECIMAL(12, 2);
```
⚠️ Risky - test locally first

### Add Index for Performance (Low Risk)
```sql
ALTER TABLE salary_records 
ADD INDEX idx_name (column_name);
```
✓ Safe - only improves performance

### Rename Column (Medium Risk)
```sql
ALTER TABLE salary_records 
CHANGE old_name new_name VARCHAR(100);
```
⚠️ May break code - update application too

### Delete Column (High Risk)
```sql
ALTER TABLE salary_records 
DROP COLUMN unused_column;
```
🚨 Risky - data is lost forever

### Add Default Value (Low Risk)
```sql
ALTER TABLE salary_records 
ALTER COLUMN status SET DEFAULT 'active';
```
✓ Safe - only affects new records

---

## ⚠️ Before You Deploy

- [ ] Backup database
- [ ] Test locally
- [ ] Review SQL syntax
- [ ] Plan rollback
- [ ] Schedule during low traffic
- [ ] Have login credentials ready
- [ ] Notify team members

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Table already exists" | Add `IF NOT EXISTS` to CREATE statements |
| "Unknown column" | Check column name spelling |
| "Access denied" | Verify username/password |
| "Operation timeout" | Split migration into smaller parts |
| "Syntax error" | Check for missing semicolons/commas |
| "Foreign key constraint" | Migrate foreign key tables first |

---

## 📊 Verify After Migration

```sql
-- Check table structure
DESCRIBE salary_records;

-- Count records (should be same before/after)
SELECT COUNT(*) FROM salary_records;

-- Check for NULL values
SELECT * FROM salary_records WHERE id IS NULL;

-- Verify indexes
SHOW INDEX FROM salary_records;
```

---

## 🔄 Rollback Steps

**If something goes wrong:**

1. **Stop all changes** ⛔
2. **Restore backup** in phpMyAdmin
3. **Verify** application works
4. **Analyze** what went wrong
5. **Create new migration** with fix
6. **Test locally** thoroughly
7. **Deploy again** carefully

---

## 📁 File Locations

```
expense-dashboard/
├── DATABASE_MIGRATIONS.md          ← Full guide
├── SHARED_HOSTING_DEPLOYMENT.md    ← Shared hosting specific
├── migrate.py                       ← Migration script (if using SSH)
└── migrations/
    ├── 001_create_schema.sql
    ├── 002_add_carryover_tracking.sql
    └── backup_2026-10-05.sql        ← Keep backups here
```

---

## 💾 Backup/Restore Commands

### Via SSH
```bash
# Backup
mysqldump -u user -p database > backup.sql

# Restore
mysql -u user -p database < backup.sql
```

### Via phpMyAdmin
```
Database → Export → Download
Database → SQL → Paste backup → Execute
```

---

## 📞 Contact Hosting Provider

Get these details from your hosting support:
- Database hostname
- Database username  
- Database password
- Can you use SSH? (yes/no)
- Max upload size for phpMyAdmin
- Backup retention period

---

## ✅ Deployment Checklist

```
Before Migration:
☐ Database backed up
☐ Changes tested locally
☐ Code reviewed
☐ Migration file created
☐ Rollback plan ready

During Migration:
☐ Execute migration
☐ Verify schema changes
☐ Test one feature
☐ Monitor for errors

After Migration:
☐ Full testing of application
☐ Check all pages load
☐ Verify reports show correct data
☐ Monitor logs for errors
☐ Keep backup for 30 days
```

---

## 🎯 Best Practices

1. **One change per migration** - Easier to debug
2. **Backup always** - No exceptions!
3. **Test locally first** - Never first-time on production
4. **Document changes** - Future you will thank you
5. **Small, frequent deployments** - Easier to fix
6. **Monitor after deploy** - Check logs next morning
7. **Keep backups 30 days** - Recovery window

---

## ❓ Common Questions

**Q: Can I undo a migration?**
A: Yes, restore from backup using the Rollback steps above.

**Q: What if phpMyAdmin times out?**
A: Split migration into smaller queries or contact support.

**Q: Do I need to restart Python?**
A: Usually not - changes to database don't require restart.

**Q: Can I skip schema_migrations table?**
A: You can, but tracking migrations helps prevent duplicates.

**Q: How long to keep backups?**
A: At least 30 days, ideally 90 days for production.

**Q: Can multiple people deploy at once?**
A: No - coordinate with team to prevent conflicts.

---

## 📚 Learn More

- [MySQL ALTER TABLE](https://dev.mysql.com/doc/refman/8.0/en/alter-table.html)
- [Database Migrations](https://en.wikipedia.org/wiki/Schema_migration)
- [Backup Best Practices](https://www.mysql.com/products/mysql/backup-and-recovery/)
