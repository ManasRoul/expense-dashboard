-- migrations/001_create_schema.sql
-- Description: Create initial database schema for Expense Dashboard
-- Risk Level: LOW (initial creation, only runs once)
-- Created: 2026-10-05

-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    key_id VARCHAR(100),
    label VARCHAR(100),
    sort_order INT DEFAULT 0,
    active TINYINT DEFAULT 1,
    salary_amount DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_setting (type, key_id)
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATETIME,
    opening_balance DECIMAL(15, 2),
    total_income DECIMAL(15, 2) DEFAULT 0,
    total_expense DECIMAL(15, 2) DEFAULT 0,
    closing_balance DECIMAL(15, 2),
    salary DECIMAL(10, 2) DEFAULT 0,
    salary_method VARCHAR(10),
    salary_comment TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_date (date),
    INDEX idx_salary (salary)
);

-- Create transaction_details table
CREATE TABLE IF NOT EXISTS transaction_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id INT,
    category_type VARCHAR(50),
    category_id VARCHAR(100),
    amount DECIMAL(15, 2),
    payment_method VARCHAR(20),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id),
    INDEX idx_transaction (transaction_id)
);

-- Create salary_records table
CREATE TABLE IF NOT EXISTS salary_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATETIME,
    employee_name VARCHAR(100),
    payment_type VARCHAR(20),
    amount DECIMAL(10, 2),
    payment_method VARCHAR(10),
    note TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_date (date),
    INDEX idx_employee (employee_name)
);

-- Migration complete - schema created
