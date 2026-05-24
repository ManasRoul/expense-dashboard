# Database Configuration - EXAMPLE FILE
# Copy this file to config.py and update with your actual credentials

# For local development (SQLite)
USE_MYSQL = False  # Set to True when deploying to live server

# MySQL Configuration (for live server)
# IMPORTANT: Update these values before deployment
MYSQL_CONFIG = {
    'host': 'localhost',  # Your MySQL host (e.g., 'localhost' or 'mysql.yourhost.com')
    'user': 'your_username',  # Your MySQL username
    'password': 'your_password',  # Your MySQL password
    'database': 'financial_dashboard',  # Your MySQL database name
    'port': 3306,  # Default MySQL port
}

# Alternative: For better security, use environment variables:
# import os
# MYSQL_CONFIG = {
#     'host': os.getenv('DB_HOST', 'localhost'),
#     'user': os.getenv('DB_USER', 'root'),
#     'password': os.getenv('DB_PASSWORD', ''),
#     'database': os.getenv('DB_NAME', 'financial_dashboard'),
#     'port': int(os.getenv('DB_PORT', 3306)),
# }
