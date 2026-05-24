# User Management Guide

## 📊 Database Schema

### Users Table Structure:
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'contributor',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Columns:
- **id**: Auto-incrementing unique identifier
- **username**: Unique username for login
- **password_hash**: SHA256 hashed password
- **role**: Either 'owner' or 'contributor'
- **created_at**: Timestamp of user creation

---

## 🔐 User Roles

### Owner Role (`role = 'owner'`)
- Full access to all features
- Can view all transactions
- Can add new transactions
- **Can delete transactions**
- Has 👑 crown icon in navigation

### Contributor Role (`role = 'contributor'`)
- Limited access
- Can view all transactions
- Can add new transactions
- **Cannot delete transactions**
- Has 👤 user icon in navigation

---

## 📝 Method 1: Create Users via SQLite Command Line

### Step 1: Open Database
```bash
cd /Users/manas_roul@optum.com/Downloads/dashboard
sqlite3 financial.db
```

### Step 2: Create Owner User
```sql
-- Generate password hash in Python first:
-- python3 -c "import hashlib; print(hashlib.sha256('YOUR_PASSWORD'.encode()).hexdigest())"

INSERT INTO users (username, password_hash, role) 
VALUES ('owner1', 'PASSWORD_HASH_HERE', 'owner');
```

### Step 3: Create Contributor User
```sql
INSERT INTO users (username, password_hash, role) 
VALUES ('contributor1', 'PASSWORD_HASH_HERE', 'contributor');
```

### Step 4: View All Users
```sql
SELECT id, username, role, created_at FROM users;
```

### Step 5: Exit SQLite
```sql
.exit
```

---

## 🚀 Method 2: Create Users with Python Script

Save this as `create_user.py`:

```python
import sqlite3
import hashlib
import sys

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def create_user(username, password, role='contributor'):
    if role not in ['owner', 'contributor']:
        print("Error: Role must be 'owner' or 'contributor'")
        return
    
    try:
        conn = sqlite3.connect('financial.db')
        cursor = conn.cursor()
        
        password_hash = hash_password(password)
        
        cursor.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            (username, password_hash, role)
        )
        
        conn.commit()
        conn.close()
        
        print(f"✅ User created successfully!")
        print(f"   Username: {username}")
        print(f"   Role: {role}")
        
    except sqlite3.IntegrityError:
        print(f"❌ Error: Username '{username}' already exists!")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python3 create_user.py <username> <password> <role>")
        print("Example: python3 create_user.py john pass123 owner")
        print("Example: python3 create_user.py jane pass456 contributor")
        sys.exit(1)
    
    username = sys.argv[1]
    password = sys.argv[2]
    role = sys.argv[3]
    
    create_user(username, password, role)
```

### Usage:
```bash
cd /Users/manas_roul@optum.com/Downloads/dashboard

# Create owner
python3 create_user.py john mypassword123 owner

# Create contributor
python3 create_user.py jane mypassword456 contributor
```

---

## 🔑 Quick Password Hash Generator

Generate password hashes manually:

```bash
# Hash a password
python3 -c "import hashlib; print(hashlib.sha256('your_password'.encode()).hexdigest())"
```

Example:
```bash
python3 -c "import hashlib; print(hashlib.sha256('test123'.encode()).hexdigest())"
# Output: ecd71870d1963316a97e3ac3408c9835ad8cf0f3c1bc703527c30265534f75ae
```

---

## 📋 Example Users to Create

### Create an Owner:
```sql
-- Username: john, Password: owner123
INSERT INTO users (username, password_hash, role) 
VALUES ('john', 'eaf5ba7362b2a57b8e08d49ae6e9b27ec3e83e1e6e2e30e29e73f4fbe33cd12e', 'owner');
```

### Create a Contributor:
```sql
-- Username: jane, Password: contrib123
INSERT INTO users (username, password_hash, role) 
VALUES ('jane', '3de1d1f1c8c89a89b0d65b168c44b2728a3bbad1d53a7af7fd8d70e14a8d9b8f', 'contributor');
```

---

## 🧪 Testing Different Roles

### Test Owner Access:
1. Login as: `admin` / `admin123` (or your created owner)
2. Go to Dashboard
3. You should see **Delete buttons** (🗑️) next to each transaction

### Test Contributor Access:
1. Create a contributor user using methods above
2. Login with contributor credentials
3. Go to Dashboard
4. You should **NOT see Delete buttons** - only "View Details"

---

## 🛠️ View/Manage Users

### List all users:
```bash
sqlite3 financial.db "SELECT id, username, role, created_at FROM users;"
```

### Update user role:
```bash
# Change contributor to owner
sqlite3 financial.db "UPDATE users SET role='owner' WHERE username='jane';"

# Change owner to contributor
sqlite3 financial.db "UPDATE users SET role='contributor' WHERE username='john';"
```

### Delete a user:
```bash
sqlite3 financial.db "DELETE FROM users WHERE username='username_to_delete';"
```

### Change password:
```bash
# Generate new hash
NEW_HASH=$(python3 -c "import hashlib; print(hashlib.sha256('new_password'.encode()).hexdigest())")

# Update in database
sqlite3 financial.db "UPDATE users SET password_hash='$NEW_HASH' WHERE username='john';"
```

---

## 📝 Default Users

The system comes with one default user:

| Username | Password   | Role  | Description |
|----------|------------|-------|-------------|
| admin    | admin123   | owner | Default admin with full access |

---

## ⚠️ Security Notes

1. **Never share your password_hash** - it's like sharing the password
2. **Use strong passwords** for production
3. **Change default admin password** in production
4. For production, consider:
   - Adding password complexity requirements
   - Adding account lockout after failed attempts
   - Using bcrypt instead of SHA256 for password hashing
   - Adding email verification
   - Adding 2FA (two-factor authentication)

---

## 🎯 Quick Start Checklist

- [x] Default admin user exists (admin/admin123)
- [ ] Create additional owner users (optional)
- [ ] Create contributor users for team members
- [ ] Test login with different roles
- [ ] Verify delete permissions work correctly
- [ ] Change default admin password
