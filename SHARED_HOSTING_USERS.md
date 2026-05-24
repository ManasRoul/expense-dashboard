# Creating Users on Shared Hosting

## 🌐 For Shared Hosting (cPanel/Bluehost/Hostinger)

Since you won't have direct Python/SQLite access on most shared hosting, here are your options:

---

## ✅ Method 1: Using phpMyAdmin (Easiest)

### Step 1: Access phpMyAdmin
1. Login to your **cPanel**
2. Find and click **"phpMyAdmin"** under Databases section

### Step 2: Select Your Database
1. On the left sidebar, click your database name (e.g., `your_username_financial`)

### Step 3: Find Users Table
1. Click on the **`users`** table in the list

### Step 4: Insert New User
1. Click the **"Insert"** tab at the top
2. Fill in the form:

**For Owner:**
| Field | Value | Notes |
|-------|-------|-------|
| id | Leave empty | Auto-generated |
| username | `john` | Choose your username |
| password_hash | See below | Must hash the password |
| role | `owner` | Type exactly |
| created_at | Leave default | Auto-generated |

**For Contributor:**
| Field | Value | Notes |
|-------|-------|-------|
| id | Leave empty | Auto-generated |
| username | `jane` | Choose your username |
| password_hash | See below | Must hash the password |
| role | `contributor` | Type exactly |
| created_at | Leave default | Auto-generated |

### Step 5: Generate Password Hash

**Option A: Use Online Tool**
1. Go to: https://emn178.github.io/online-tools/sha256.html
2. Enter your password (e.g., `password123`)
3. Copy the hash (e.g., `ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f`)
4. Paste into `password_hash` field

**Option B: Use Browser Console**
1. Open browser console (F12)
2. Paste this code:
```javascript
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    console.log('Password Hash:', hashHex);
    return hashHex;
}
// Usage:
hashPassword('your_password_here');
```
3. Copy the printed hash

### Step 6: Click "Go" to Insert

---

## 📝 Method 2: Using SQL Query in phpMyAdmin

### Step 1: Open SQL Tab
1. In phpMyAdmin, select your database
2. Click **"SQL"** tab at the top

### Step 2: Run SQL Command

**Create Owner:**
```sql
INSERT INTO users (username, password_hash, role) 
VALUES (
    'john',
    'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f',
    'owner'
);
```

**Create Contributor:**
```sql
INSERT INTO users (username, password_hash, role) 
VALUES (
    'jane',
    '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    'contributor'
);
```

### Step 3: Click "Go"

---

## 🔑 Pre-Generated Password Hashes

Here are some common passwords already hashed (SHA256):

| Password | Hash (copy this) |
|----------|------------------|
| password | `5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8` |
| pass123 | `ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f` |
| owner123 | `eaf5ba7362b2a57b8e08d49ae6e9b27ec3e83e1e6e2e30e29e73f4fbe33cd12e` |
| contrib123 | `3de1d1f1c8c89a89b0d65b168c44b2728a3bbad1d53a7af7fd8d70e14a8d9b8f` |
| test123 | `ecd71870d1963316a97e3ac3408c9835ad8cf0f3c1bc703527c30265534f75ae` |
| admin123 | `240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9` |

**⚠️ Security Note:** Change these passwords in production!

---

## 🎯 Quick Example

### Create 2 Users (Owner + Contributor):

**SQL Query:**
```sql
-- Create owner user: john / pass123
INSERT INTO users (username, password_hash, role) 
VALUES ('john', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'owner');

-- Create contributor user: jane / pass123
INSERT INTO users (username, password_hash, role) 
VALUES ('jane', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'contributor');
```

Copy both lines, paste in phpMyAdmin SQL tab, click "Go" ✅

---

## 🔍 Verify Users Created

Run this SQL query to see all users:

```sql
SELECT id, username, role, created_at FROM users;
```

You should see something like:
```
| id | username | role        | created_at          |
|----|----------|-------------|---------------------|
| 1  | admin    | owner       | 2026-05-24 10:00:00 |
| 2  | john     | owner       | 2026-05-24 10:05:00 |
| 3  | jane     | contributor | 2026-05-24 10:06:00 |
```

---

## 🛠️ Manage Users via phpMyAdmin

### View All Users
```sql
SELECT id, username, role, created_at FROM users ORDER BY id;
```

### Change User Role
```sql
-- Make jane an owner
UPDATE users SET role='owner' WHERE username='jane';

-- Make john a contributor
UPDATE users SET role='contributor' WHERE username='john';
```

### Change Password
```sql
-- Change john's password to "newpass123"
UPDATE users 
SET password_hash='a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3'
WHERE username='john';
```

### Delete User
```sql
DELETE FROM users WHERE username='jane';
```

### Reset Admin Password
```sql
-- Reset admin password to "admin123"
UPDATE users 
SET password_hash='240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'
WHERE username='admin';
```

---

## 🌐 Using MySQL Command Line (if available)

Some shared hosts provide MySQL command line access:

```bash
# Connect to database
mysql -u your_username -p your_database_name

# Create owner
INSERT INTO users (username, password_hash, role) 
VALUES ('john', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'owner');

# Create contributor
INSERT INTO users (username, password_hash, role) 
VALUES ('jane', '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', 'contributor');

# View users
SELECT * FROM users;

# Exit
exit;
```

---

## 📋 Complete Workflow for Shared Hosting

### Initial Setup:
1. ✅ Deploy application to shared hosting (see DEPLOYMENT_GUIDE.md)
2. ✅ MySQL database created
3. ✅ Application creates `users` table automatically
4. ✅ Default admin user created (admin/admin123)

### Create Additional Users:
1. **Login to cPanel**
2. **Open phpMyAdmin**
3. **Select your database**
4. **Click SQL tab**
5. **Paste this:**
```sql
-- Create your users (change usernames and passwords!)
INSERT INTO users (username, password_hash, role) 
VALUES ('yourname', 'PASTE_HASH_HERE', 'owner');

INSERT INTO users (username, password_hash, role) 
VALUES ('teammember', 'PASTE_HASH_HERE', 'contributor');
```
6. **Click "Go"**
7. ✅ **Done!**

### Test Login:
1. Go to your website login page
2. Try logging in with new credentials
3. Verify permissions (owner sees delete button, contributor doesn't)

---

## 🔐 Security Best Practices

1. **Change default admin password immediately**
2. **Use strong, unique passwords** for each user
3. **Don't share password hashes** - they're like sharing passwords
4. **Regularly review users** - remove inactive accounts
5. **Use HTTPS** for your site (available in cPanel → SSL/TLS)
6. **Backup your database** regularly via cPanel

---

## ❓ Common Issues

### "Duplicate entry" error
- Username already exists
- Choose a different username

### "Access denied" error
- MySQL user doesn't have INSERT permission
- Contact hosting support

### "Table 'users' doesn't exist"
- Application hasn't been started yet
- Run the application once to create tables

### Can't see delete buttons after creating owner
- Clear browser cache
- Logout and login again
- Check localStorage has 'userRole' = 'owner'

---

## 📞 Need Help?

If you get stuck:
1. Check cPanel error logs
2. Check browser console (F12) for JavaScript errors
3. Verify database connection in config.py
4. Contact your hosting provider support

---

## ✅ Quick Checklist

- [ ] phpMyAdmin accessible
- [ ] Database selected
- [ ] Generated password hash
- [ ] Ran INSERT SQL query
- [ ] Verified user in users table
- [ ] Tested login with new user
- [ ] Verified permissions (owner/contributor)
- [ ] Changed default admin password
