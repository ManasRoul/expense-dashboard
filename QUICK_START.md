# 🚀 Quick Deployment Checklist

## Before You Start

1. ✅ You have a shared hosting account with Python and MySQL support
2. ✅ You have created a MySQL database
3. ✅ You have MySQL credentials (host, username, password, database name)

---

## Configuration Steps (Do This First!)

### 1. Update config.py

Open `config.py` and change:

```python
# Change this line:
USE_MYSQL = False

# To this:
USE_MYSQL = True

# Update MySQL credentials:
MYSQL_CONFIG = {
    'host': 'localhost',  # Or your MySQL host
    'user': 'your_actual_username',
    'password': 'your_actual_password',
    'database': 'your_actual_database_name',
    'port': 3306,
}
```

### 2. Test Locally (Optional but Recommended)

```bash
# Install MySQL connector
cd /Users/manas_roul@optum.com/Downloads/dashboard
source venv/bin/activate
pip install mysql-connector-python

# Test the server
python3 server.py
```

---

## Files to Upload via FTP

### ✅ Upload These Files:

```
📁 Upload to: public_html/financial-dashboard/

✅ server.py
✅ config.py (with YOUR credentials!)
✅ requirements.txt
✅ form.html
✅ styles.css
✅ script.js
✅ dashboard.html
✅ dashboard.css
✅ dashboard.js
✅ categories.html
✅ categories.css
✅ categories.js
```

### ❌ DO NOT Upload:

```
❌ venv/ folder
❌ __pycache__/ folder
❌ financial.db file
❌ .git/ folder
❌ config.example.py
```

---

## After Upload - Server Setup

### Option 1: cPanel Python App (Easiest)

1. Go to cPanel → "Setup Python App"
2. Click "Create Application"
3. Fill in:
   - Python Version: Select highest (3.x)
   - App Root: `/home/username/public_html/financial-dashboard`
   - App URL: Choose URL path
   - Startup file: `server.py`
   - Entry point: `app`
4. Click "Create"
5. Done! 🎉

### Option 2: SSH Method

```bash
# Connect to server
ssh your_username@your_server.com

# Go to app directory
cd public_html/financial-dashboard

# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

---

## Testing Your Deployment

Visit these URLs (replace with your domain):

1. **Form Page:**
   ```
   https://yourdomain.com/financial-dashboard/form.html
   ```

2. **Dashboard:**
   ```
   https://yourdomain.com/financial-dashboard/dashboard.html
   ```

3. **Categories:**
   ```
   https://yourdomain.com/financial-dashboard/categories.html
   ```

### Quick Test:

1. Open the form page
2. Enter some test data
3. Click "Submit Transaction"
4. Check if you see success message
5. Go to dashboard and verify data appears
6. Check phpMyAdmin to see if table was created

---

## Common Issues & Quick Fixes

### ❌ "Can't connect to database"
**Fix:** Double-check `config.py` credentials and `USE_MYSQL = True`

### ❌ "Module not found: mysql.connector"
**Fix:** Run `pip install mysql-connector-python` in your venv

### ❌ "Permission denied" on database
**Fix:** Grant ALL PRIVILEGES to MySQL user in cPanel

### ❌ Page shows 500 error
**Fix:** Check error logs in cPanel → Error Log section

### ❌ API calls fail (CORS error)
**Fix:** Make sure Flask-CORS is installed and server is running

---

## URLs to Update (If Not at Root)

If your app is at a subfolder, update these files:

### In script.js:
```javascript
// Change from:
fetch('http://localhost:5000/api/transactions')

// To:
fetch('/financial-dashboard/api/transactions')
```

### In dashboard.js:
```javascript
// Change from:
fetch('http://localhost:5000/api/dashboard/balances')

// To:
fetch('/financial-dashboard/api/dashboard/balances')
```

### In categories.js:
```javascript
// Change from:
fetch('http://localhost:5000/api/category-totals')

// To:
fetch('/financial-dashboard/api/category-totals')
```

---

## Security Checklist

- [ ] Changed default MySQL password to strong password
- [ ] `config.py` has correct credentials
- [ ] Never commit `config.py` to public repository
- [ ] SSL certificate enabled on domain
- [ ] Regular database backups set up

---

## Need More Help?

📖 See detailed guide: `DEPLOYMENT_GUIDE.md`

💡 Contact your hosting provider support for:
- Python app configuration
- MySQL database issues
- Server-specific questions

---

## 🎉 You're Ready!

Once everything is set up:
1. Access your form at the URL
2. Start tracking your finances
3. View reports on dashboard
4. Download Excel/PDF reports

**Good luck with your deployment! 🚀**
