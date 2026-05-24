# Database Configuration
# IMPORTANT: Use environment variables in production

import os

# For local development (SQLite) or production (MySQL)
USE_MYSQL = os.environ.get('USE_MYSQL', 'False') == 'True'

# MySQL Configuration (use environment variables for security)
MYSQL_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'user': os.environ.get('DB_USER', 'root'),
    'password': os.environ.get('DB_PASSWORD', ''),
    'database': os.environ.get('DB_NAME', 'financial_dashboard'),
    'port': int(os.environ.get('DB_PORT', '3306')),
}

# Security warning if using defaults in MySQL mode
if USE_MYSQL and not os.environ.get('DB_PASSWORD'):
    print("⚠️  WARNING: No DB_PASSWORD set in environment!")
    print("   Set environment variables before running in production.")

# To set environment variables:
# export SECRET_KEY=your-secret-key-here
# export USE_MYSQL=True
# export DB_HOST=localhost
# export DB_USER=your_username
# export DB_PASSWORD=your_password
# export DB_NAME=financial_dashboard
# export DB_PORT=3306
# export ALLOWED_ORIGINS=https://yourdomain.com
