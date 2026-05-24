# Financial Dashboard - Deployment Guide

This guide will help you deploy your Financial Dashboard to a live server with MySQL database.

---

## 📋 Prerequisites

Before deploying, make sure you have:

- **Shared Hosting Account** with:
  - Python 3.x support
  - MySQL database access
  - cPanel or FTP access
  - SSH access (recommended)
  
- **MySQL Database** with:
  - Database name
  - Database username
  - Database password
  - Database host (usually `localhost`)

---

## 🚀 Step-by-Step Deployment

### Step 1: Configure MySQL Database

1. **Login to cPanel** on your hosting account

2. **Create MySQL Database:**
   - Go to "MySQL Databases"
   - Create a new database (e.g., `your_username_financial`)
   - Note down the database name

3. **Create MySQL User:**
   - Create a new user with a strong password
   - Note down username and password

4. **Add User to Database:**
   - Grant **ALL PRIVILEGES** to the user for your database
   - This allows the app to create tables and manage data

5. **Note Your MySQL Details:**
   ```
   Host: localhost (or specific host from hosting provider)
   Database Name: your_database_name
   Username: your_mysql_username
   Password: your_mysql_password
   Port: 3306 (default)
   ```

---

### Step 2: Update Configuration File

1. **Open `config.py`** in your local project

2. **Update the settings:**
   ```python
   # Database Configuration
   USE_MYSQL = True  # ⚠️ Change this to True for live server

   # MySQL Configuration
   MYSQL_CONFIG = {
       'host': 'localhost',  # Your MySQL host
       'user': 'your_mysql_username',  # Your MySQL username
       'password': 'your_mysql_password',  # Your MySQL password
       'database': 'your_database_name',  # Your database name
       'port': 3306,
   }
   ```

3. **Save the file**

⚠️ **Security Note:** Never commit `config.py` with real credentials to public repositories!

---

### Step 3: Prepare Files for Upload

**Files to Upload:**
```
dashboard/
├── server.py              ✅ Upload
├── config.py              ✅ Upload (with your credentials)
├── requirements.txt       ✅ Upload
├── form.html             ✅ Upload
├── styles.css            ✅ Upload
├── script.js             ✅ Upload
├── dashboard.html        ✅ Upload
├── dashboard.css         ✅ Upload
├── dashboard.js          ✅ Upload
├── categories.html       ✅ Upload
├── categories.css        ✅ Upload
└── categories.js         ✅ Upload
```

**Do NOT Upload:**
```
❌ venv/               (virtual environment - recreate on server)
❌ __pycache__/        (Python cache)
❌ financial.db        (SQLite database - not needed for MySQL)
❌ .git/               (Git repository)
```

---

### Step 4: Upload Files via FTP

1. **Open your FTP Client** (FileZilla, Cyberduck, or cPanel File Manager)

2. **Connect to your server:**
   - Host: Your server address (from hosting provider)
   - Username: Your FTP username
   - Password: Your FTP password
   - Port: 21 (or as specified)

3. **Navigate to web directory:**
   - Usually: `public_html/` or `www/` or `htdocs/`
   - Create a folder: `financial-dashboard/`

4. **Upload all files** from Step 3 to this folder

---

### Step 5: Install Python Dependencies (SSH Method)

**If you have SSH access:**

1. **Connect via SSH:**
   ```bash
   ssh your_username@your_server.com
   ```

2. **Navigate to your app directory:**
   ```bash
   cd public_html/financial-dashboard
   ```

3. **Create virtual environment:**
   ```bash
   python3 -m venv venv
   ```

4. **Activate virtual environment:**
   ```bash
   source venv/bin/activate
   ```

5. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

---

### Step 6: Configure Web Server

#### Option A: Using cPanel Python App

1. **Go to cPanel → "Setup Python App"**

2. **Create New Application:**
   - Python Version: 3.x (highest available)
   - Application Root: `/home/username/public_html/financial-dashboard`
   - Application URL: `/financial-dashboard` or custom domain
   - Application Startup File: `server.py`
   - Application Entry Point: `app`

3. **Save Configuration**

4. **The system will:**
   - Create virtual environment automatically
   - Install dependencies from requirements.txt
   - Start your application

#### Option B: Using Passenger (if available)

1. **Create `.htaccess` file** in your app directory:
   ```apache
   PassengerEnabled On
   PassengerAppRoot /home/username/public_html/financial-dashboard
   PassengerPython /home/username/public_html/financial-dashboard/venv/bin/python3
   PassengerAppType wsgi
   PassengerStartupFile passenger_wsgi.py
   ```

2. **Create `passenger_wsgi.py` file:**
   ```python
   import sys
   import os
   
   # Add your app directory to Python path
   sys.path.insert(0, os.path.dirname(__file__))
   
   # Import your Flask app
   from server import app as application
   ```

3. **Restart the server** (usually automatic or via cPanel)

---

### Step 7: Update Application URLs (if needed)

If your app is not at root domain, update the API URLs in JavaScript files:

**In `script.js`, `dashboard.js`, `categories.js`:**

Replace:
```javascript
fetch('http://localhost:5000/api/transactions')
```

With:
```javascript
fetch('/financial-dashboard/api/transactions')
// or
fetch('https://yourdomain.com/financial-dashboard/api/transactions')
```

---

### Step 8: Test Your Deployment

1. **Visit your application:**
   - `https://yourdomain.com/financial-dashboard/form.html`
   - `https://yourdomain.com/financial-dashboard/dashboard.html`
   - `https://yourdomain.com/financial-dashboard/categories.html`

2. **Test functionality:**
   - ✅ Submit a test transaction
   - ✅ Check dashboard loads
   - ✅ Verify category totals
   - ✅ Test download report feature

3. **Check MySQL database:**
   - Go to cPanel → phpMyAdmin
   - Select your database
   - Verify `transactions` table was created
   - Check if test data appears

---

## 🔧 Troubleshooting

### Issue: "Module not found" error
**Solution:** Make sure all dependencies are installed:
```bash
cd /path/to/your/app
source venv/bin/activate
pip install -r requirements.txt
```

### Issue: "Can't connect to MySQL server"
**Solution:** 
- Verify MySQL credentials in `config.py`
- Check if MySQL host is correct (might be IP address instead of localhost)
- Ensure user has proper permissions

### Issue: 500 Internal Server Error
**Solution:**
- Check error logs in cPanel → "Error Log"
- Verify Python version compatibility
- Ensure `config.py` has `USE_MYSQL = True`

### Issue: Static files not loading
**Solution:**
- Verify all HTML, CSS, JS files are uploaded
- Check file permissions (should be 644)
- Clear browser cache

### Issue: CORS errors
**Solution:**
- Already handled by Flask-CORS
- If still occurring, update `server.py`:
  ```python
  CORS(app, origins=['https://yourdomain.com'])
  ```

---

## 🔒 Security Best Practices

1. **Protect config.py:**
   - Add to `.gitignore` if using Git
   - Use environment variables for production:
     ```python
     import os
     MYSQL_CONFIG = {
         'host': os.getenv('DB_HOST', 'localhost'),
         'user': os.getenv('DB_USER'),
         'password': os.getenv('DB_PASSWORD'),
         'database': os.getenv('DB_NAME'),
     }
     ```

2. **Use strong MySQL passwords**

3. **Enable HTTPS** on your domain

4. **Regular backups:**
   - Set up automatic MySQL backups in cPanel
   - Download database exports periodically

5. **Update dependencies:**
   ```bash
   pip install --upgrade -r requirements.txt
   ```

---

## 📊 Database Backup

### Export Database (for backup):
```bash
mysqldump -u username -p database_name > backup.sql
```

### Import Database (to restore):
```bash
mysql -u username -p database_name < backup.sql
```

Or use **phpMyAdmin** in cPanel for GUI-based export/import.

---

## 🌐 Custom Domain Setup

If you want to use a custom domain:

1. **Point domain to your hosting:**
   - Update DNS A record to your server IP
   - Or use nameservers from hosting provider

2. **Add domain in cPanel:**
   - Go to "Addon Domains" or "Parked Domains"
   - Add your domain and point to app directory

3. **Update URLs in JavaScript files** (see Step 7)

4. **Enable SSL Certificate:**
   - Use Let's Encrypt (free) via cPanel
   - Or install custom SSL certificate

---

## 📞 Need Help?

- **Server-specific issues:** Contact your hosting provider support
- **Application issues:** Check the error logs
- **MySQL issues:** Use phpMyAdmin to debug queries

---

## ✅ Quick Checklist

Before going live:

- [ ] MySQL database created
- [ ] MySQL user created with ALL PRIVILEGES
- [ ] `config.py` updated with correct credentials
- [ ] `USE_MYSQL = True` in config.py
- [ ] All files uploaded via FTP
- [ ] Dependencies installed on server
- [ ] Python app configured in cPanel
- [ ] Test transaction submitted successfully
- [ ] Dashboard loads correctly
- [ ] Categories page works
- [ ] Download reports feature tested
- [ ] Database table created in MySQL
- [ ] SSL certificate enabled (recommended)

---

## 🎉 Deployment Complete!

Your Financial Dashboard is now live and running with MySQL!

**Access URLs:**
- Form: `https://yourdomain.com/financial-dashboard/form.html`
- Dashboard: `https://yourdomain.com/financial-dashboard/dashboard.html`
- Categories: `https://yourdomain.com/financial-dashboard/categories.html`
