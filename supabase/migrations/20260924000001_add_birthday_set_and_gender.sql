-- Migration: Add birthday_set lock and gender to users table
-- Created: 2024-09-24
-- Purpose: One-time birthday lock + gender field for Personal Info
-- Related: 20260924000000_add_date_of_birth.sql (must be applied first)

-- Add birthday_set column (one-time lock — once TRUE, birthday cannot be changed)
ALTER TABLE users
ADD COLUMN birthday_set BOOLEAN DEFAULT FALSE NOT NULL;

-- Add gender column (nullable, no constraints)
ALTER TABLE users
ADD COLUMN gender TEXT;

-- Add comments for documentation
COMMENT ON COLUMN users.birthday_set IS 'One-time lock: once TRUE, date_of_birth cannot be changed. Set to TRUE after first birthday entry.';
COMMENT ON COLUMN users.gender IS 'User gender for Personal Info section. Nullable. No validation constraints.';
