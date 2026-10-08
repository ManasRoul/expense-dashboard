# Shared Hosting Deployment Guide

## Your Hosting Setup: Shared Hosting with MySQL/MariaDB

This guide is specifically for deploying to shared hosting (like cPanel, Plesk, GoDaddy, Bluehost, etc.).

## Pre-Deployment Checklist

- [ ] Test all changes locally first
- [ ] Create complete database backup
- [ ] Create migration files in `migrations/` folder
- [ ] Test migrations on staging (if available)
- [ ] Review DATABASE_MIGRATIONS.md
- [ ] Inform users of maintenance window (if needed)

## Method 1: Using phpMyAdmin (Easiest for Shared Hosting)

### Step 1: Backup Your Database
1. Login to cPanel
2. Go to **phpMyAdmin**
3. Select your database
4. Click **Export** tab
5. Click **Go** to download backup file
6. Save it locally with filename like `backup_2026-10-05.sql`

### Step 2: Apply Migrations
1. In phpMyAdmin, go to **SQL** tab
2. Copy your migration SQL from `migrations/002_add_carryover_tracking.sql`
3. Paste it in the SQL text area
4. Click **Execute**
5. Check for green "success" message
6. Verify the changes in the **Structure** tab

### Step 3: Verify Schema Changes
1. Click on the table name (e.g., `salary_records`)
2. Go to **Structure** tab
3. Verify new columns appear in the list
4. Check the comments and default values match what you expect

### Step 4: Test Your Application
1. Go to your live website
2. Try creating a new salary record
3. Verify it saves correctly
4. Check dashboard updates properly
5. Test employee salary report

### Rollback if Something Goes Wrong
1. In phpMyAdmin, go to **SQL** tab
2. Copy contents of your `backup_2026-10-05.sql` file
3. Paste into SQL text area
4. Click **Execute**
5. This restores your database to pre-migration state

---

## Method 2: Using SSH Terminal (If Available)

### Step 1: Connect via SSH
```bash
# Login to your hosting server
ssh your_username@your_domain.com

# Or if you have a different SSH host
ssh your_username@ssh.yourdomain.com
```

### Step 2: Backup Database
```bash
mysqldump -h localhost -u database_user -p database_name > backup_$(date +%Y%m%d).sql
# Enter your database password when prompted
```

### Step 3: Apply Migration
```bash
# Apply single migration
mysql -h localhost -u database_user -p database_name < migrations/002_add_carryover_tracking.sql
# Enter your database password when prompted

# Or apply all pending migrations using Python script
python3 migrate.py \
  --host localhost \
  --user database_user \
  --password your_password \
  --database database_name
```

### Step 4: Verify
```bash
# Check if migration was applied
mysql -h localhost -u database_user -p database_name -e "SELECT * FROM schema_migrations;"
```

---

## Method 3: Using cPanel File Manager + phpMyAdmin

### Best for: Making code AND database changes together

#### Step 1: Upload Code Changes
1. Login to cPanel
2. Go to **File Manager**
3. Navigate to your application folder
4. Upload updated `.py` files (if using migration script)
5. Upload updated `.js` and `.html` files

#### Step 2: Apply Database Changes
1. Go to phpMyAdmin (in cPanel)
2. Follow "Method 1: Using phpMyAdmin" above

#### Step 3: Restart Application
1. If using Python backend, restart through:
   - Terminal: `pkill -f server.py && python server.py &`
   - Or contact hosting support to restart Python app
2. Test your website

---

## Step-by-Step Example: Adding Carryover Fields

### Scenario: You want to add carryover tracking to production

#### Step 1: Prepare Migration
✓ Already done - see `migrations/002_add_carryover_tracking.sql`

#### Step 2: Test Locally
```bash
# On your local machine
mysql -u local_user -p local_db < migrations/002_add_carryover_tracking.sql

# Verify
mysql -u local_user -p local_db -e "DESCRIBE salary_records;" | grep carryover
```

#### Step 3: Backup Production
```bash
# Via cPanel > phpMyAdmin
# Or via SSH
mysqldump -u prod_user -p prod_db > backup_before_carryover.sql
```

#### Step 4: Apply to Production
```bash
# Via phpMyAdmin SQL tab - paste this:
ALTER TABLE salary_records 
ADD COLUMN IF NOT EXISTS carryover_status VARCHAR(20) DEFAULT 'none';

ALTER TABLE salary_records 
ADD COLUMN IF NOT EXISTS carryover_from_date DATE DEFAULT NULL;

ALTER TABLE salary_records 
ADD COLUMN IF NOT EXISTS carryover_amount DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE salary_records 
ADD INDEX IF NOT EXISTS idx_carryover_status (employee_name, carryover_status, date);
```

#### Step 5: Verify in Production
1. In phpMyAdmin, select your database
2. Click on `salary_records` table
3. Click **Structure** tab
4. Verify three new columns:
   - `carryover_status` (VARCHAR 20)
   - `carryover_from_date` (DATE)
   - `carryover_amount` (DECIMAL 10,2)

#### Step 6: Test Application
1. Visit your salary.html page
2. Create a test salary record
3. Check it saves successfully
4. Verify employee report shows correct balances

#### Step 7: Deploy Code Changes
1. Upload updated `employee-salary.js` with carryover logic
2. Upload updated `server.py` with carryover handling
3. Test again in live application

---

## When to Use Each Method

| Method | Best For | Difficulty | Access Required |
|--------|----------|-----------|-----------------|
| phpMyAdmin | Simple schema changes, first-time migration | Easy | Web browser only |
| SSH Terminal | Automated scripts, bulk migrations | Medium | SSH access |
| File Manager + phpMyAdmin | Code + DB changes together | Medium | cPanel access |

---

## Emergency: How to Rollback

### If Migration Failed
1. **Stop** - Don't make any more changes
2. **Backup** - Download current database from phpMyAdmin
3. **Restore** - Upload and run your pre-migration backup in phpMyAdmin SQL tab
4. **Verify** - Test that your application works with rollback

### Command for Full Rollback
```bash
# Restore from backup (replaces everything)
mysql -h localhost -u user -p database_name < backup_2026-10-05.sql
```

---

## Production Safety Rules

1. **ALWAYS backup before migration**
2. **Test on staging first** (if you have staging)
3. **Make changes during low-traffic hours** (e.g., 2-4 AM)
4. **Have rollback plan ready** (backup file downloaded)
5. **Document what you changed** (for future reference)
6. **Monitor for errors** after deployment
7. **Test all application features** after deployment

---

## Shared Hosting Limitations

⚠️ **Things to be aware of:**

- **Limited SSH access** - Use phpMyAdmin instead
- **No direct terminal access** - Can't run migration scripts via command line
- **Memory limits** - Very large database exports might fail
- **Timeout limits** - Very large migrations might timeout in phpMyAdmin
- **Backup space** - Limited storage for backups

### Workarounds:
- Use phpMyAdmin for most migrations
- Split very large migrations into smaller ones
- Ask hosting support to increase memory/timeout temporarily
- Delete old backups after successful migration

---

## Contact Your Hosting Provider

If you need help:

**Common hosting providers:**
- **cPanel** - Control panel in your browser (usually port 2083)
- **Plesk** - Alternative control panel
- **GoDaddy** - Use their hosting control panel
- **Bluehost** - Use cPanel or contact support
- **HostGator** - Use cPanel or contact support

**Ask them for:**
- Database hostname (might be localhost or something else)
- Database username
- Database password/access
- If you can use SSH or only phpMyAdmin

---

## Production Deployment Workflow

```
1. Test Locally
   ↓
2. Create Migration File(s)
   ↓
3. Backup Production
   ↓
4. Apply Migration via phpMyAdmin
   ↓
5. Verify Schema Changes
   ↓
6. Upload Code Changes
   ↓
7. Test Live Application
   ↓
8. Monitor for 24 hours
   ↓
9. Keep Backup for 30 days
```

---

## Questions?

See **DATABASE_MIGRATIONS.md** for more technical details.
