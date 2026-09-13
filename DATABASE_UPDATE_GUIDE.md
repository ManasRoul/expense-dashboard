# 🚀 Live Database Update Guide

This guide will help you safely update your live MySQL database with the latest schema changes (new categories, columns, etc.) from your local development setup.

---

## ⚡ Quick Start (5 minutes)

### On Your Local Machine:

1. **Update your config.py with live server MySQL credentials:**
   ```python
   USE_MYSQL = True
   MYSQL_CONFIG = {
       'host': 'your_live_server_host',
       'user': 'your_mysql_username',
       'password': 'your_mysql_password',
       'database': 'your_database_name',
       'port': 3306,
   }
   ```

2. **Ensure you have the latest dependencies:**
   ```bash
   pip install mysql-connector-python
   ```

3. **Make a backup of your live database (IMPORTANT!):**
   ```bash
   python3 backup_database.py
   ```
   This creates a SQL file you can restore if needed.

4. **Run the sync script:**
   ```bash
   python3 sync_database.py
   ```

5. **Check the output for any errors. It will show:**
   - ✅ New categories added
   - ✅ New columns created
   - ✅ Final verification of what's synced

---

## 📋 What This Does

The sync script:

1. **Reads your local SQLite database** (financial.db)
2. **Connects to your live MySQL database**
3. **Adds missing categories** to the settings table
4. **Creates missing columns** in the transactions table (for new income/expense categories)
5. **Preserves all existing data** - no data is deleted or modified
6. **Verifies the sync** was successful

### Example Changes:
- **Before:** transactions table has: room_rent, room_rent_method, room_rent_comment
- **After:** Added: carpenter, carpenter_method, carpenter_comment, test, test_method, test_comment, etc.

---

## 🔒 Safety & Backups

### ALWAYS backup before running:
```bash
python3 backup_database.py
```

This creates a file like: `database_backup_financial_20260912_120345.sql`

### If something goes wrong, restore:
```bash
mysql -h your_host -u your_user -p your_database < database_backup_financial_20260912_120345.sql
```

---

## 📖 Step-by-Step Instructions

### Step 1: Prepare Configuration

**Edit `config.py` with your live server details:**

```python
USE_MYSQL = True

MYSQL_CONFIG = {
    'host': 'localhost',           # Or your MySQL host from hosting provider
    'user': 'your_mysql_user',     # MySQL username
    'password': 'your_password',   # MySQL password
    'database': 'your_db_name',    # Database name
    'port': 3306,
}
```

### Step 2: Create Backup (CRITICAL)

**Run backup script:**
```bash
python3 backup_database.py
```

**Output:**
```
📦 Creating backup: database_backup_financial_20260912_120345.sql
✅ Backup created successfully!
   File: database_backup_financial_20260912_120345.sql

💾 Store this file in a safe location!
```

### Step 3: Run Sync

**Execute the sync script:**
```bash
python3 sync_database.py
```

**Expected output:**
```
============================================================
🔄 DATABASE SYNC SCRIPT
============================================================

📖 Reading local database...
✅ Found 19 categories locally

🔗 Connecting to live MySQL database...
✅ Connected to MySQL database: your_database

📥 Checking existing categories on live server...
✅ Found 6 categories on live server

🆕 Adding missing categories...
  ✅ Added category: Carpenter (carpenter)
  ✅ Added category: Test (test)
  ✅ Added category: Brokerage (brokerage)
  ... (more categories)

✅ Added 13 new categories

🆕 Adding missing columns...
  ✅ Added column: carpenter
  ✅ Added column: carpenter_method
  ✅ Added column: carpenter_comment
  ... (more columns)

✅ Added 39 new columns

============================================================
📋 SYNC VERIFICATION
============================================================

✅ Total categories in database: 19
✅ Total columns in transactions table: 70

📊 Categories synced:
  • Room Rent (room_rent) - income_category
  • Carpenter (carpenter) - expense_category
  • Test (test) - expense_category
  ... (all categories)

============================================================
✅ DATABASE SYNC COMPLETE!
============================================================

💡 Next steps:
   1. Restart your Flask server
   2. Test the dashboard to verify all changes
   3. Check that all categories appear correctly
```

### Step 4: Restart Your Server

**Via cPanel or SSH:**
```bash
# If using SSH
cd public_html/financial-dashboard
source venv/bin/activate
python3 server.py

# Or restart via cPanel → Python Apps → Restart
```

### Step 5: Verify Everything Works

1. **Open your dashboard:** `https://yourdomain.com/financial-dashboard/dashboard.html`
2. **Login** with your credentials
3. **Check all categories** appear in forms, charts, and reports
4. **Test creating a transaction** with a newly added category (e.g., "Carpenter")
5. **Verify download reports** show new categories correctly

---

## ❓ Troubleshooting

### "Connection Error: Access denied for user"
**Solution:**
- Double-check MySQL credentials in `config.py`
- Verify MySQL username and password are correct
- Make sure user has access to the database

### "Table 'settings' doesn't exist"
**Solution:**
- Your live database wasn't initialized properly
- Run `server.py` once to initialize: `python3 server.py`
- Then re-run the sync script

### "Column already exists"
**Solution:**
- This is normal if the column was already added
- The script skips existing columns automatically
- No data will be lost

### Categories not showing after sync
**Solution:**
1. Clear your browser cache (Ctrl+Shift+Delete)
2. Hard refresh the page (Ctrl+Shift+R)
3. Restart Flask server
4. Check console for JavaScript errors (F12)

### "USE_MYSQL must be True" error
**Solution:**
- Make sure in `config.py`: `USE_MYSQL = True`
- Don't keep it as `False`

---

## 🔄 What Gets Updated

### Settings Table:
- New income categories (if any)
- New expense categories (if any)
- New employee types (if any)
- Labels, icons, sort order for all categories

### Transactions Table:
- New columns for each category (value storage)
- New `_method` columns (payment method: cash/upi)
- New `_comment` columns (transaction notes)

### What Does NOT Change:
- ✅ Existing transaction data - completely safe
- ✅ User accounts and passwords
- ✅ Historical salary records
- ✅ Any other existing data

---

## 📞 Need Help?

If sync fails:

1. **Check MySQL connection:**
   ```bash
   python3 << 'EOF'
   from config import MYSQL_CONFIG
   import mysql.connector
   
   try:
       conn = mysql.connector.connect(**MYSQL_CONFIG)
       print("✅ MySQL connection works!")
       conn.close()
   except Exception as e:
       print(f"❌ Connection failed: {e}")
   EOF
   ```

2. **Restore from backup if needed:**
   ```bash
   mysql -h your_host -u your_user -p your_database < database_backup_financial_20260912_120345.sql
   ```

3. **Check script logs** for detailed error messages

---

## ✅ Verification Checklist

After running sync:
- [ ] Backup file created successfully
- [ ] Sync script completed without errors
- [ ] Dashboard loads after restart
- [ ] All categories visible in forms
- [ ] New categories work in reports
- [ ] Existing transactions still show correctly
- [ ] Charts display all categories
- [ ] No JavaScript console errors

---

## 🎉 You're Done!

Your live database is now synced with all the latest changes from your local development setup. All new categories, columns, and features are ready to use!
