-- migrations/002_add_carryover_tracking.sql
-- Description: Add carryover detection and tracking fields to salary_records
-- Risk Level: LOW (adds optional columns with defaults, backward compatible)
-- Created: 2026-10-05

ALTER TABLE salary_records 
ADD COLUMN IF NOT EXISTS carryover_status VARCHAR(20) DEFAULT 'none' COMMENT 'none|pending|carried_over';

ALTER TABLE salary_records 
ADD COLUMN IF NOT EXISTS carryover_from_date DATE DEFAULT NULL COMMENT 'Date of advance that carried over';

ALTER TABLE salary_records 
ADD COLUMN IF NOT EXISTS carryover_amount DECIMAL(10, 2) DEFAULT 0 COMMENT 'Amount carried over from previous month';

-- Create index for carryover queries
ALTER TABLE salary_records 
ADD INDEX IF NOT EXISTS idx_carryover_status (employee_name, carryover_status, date);

-- Update server.py to populate these fields
-- No data migration needed - old records will default to 'none'
