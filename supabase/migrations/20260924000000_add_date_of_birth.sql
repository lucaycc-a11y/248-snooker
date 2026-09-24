-- Migration: Add date_of_birth column to users table
-- Created: 2024-09-24
-- Purpose: Store user's date of birth for age verification
-- Constraints: Valid date, not in future, not before 1900-01-01

-- Add date_of_birth column (nullable, no default)
ALTER TABLE users
ADD COLUMN date_of_birth DATE;

-- Add check constraint: date must not be in the future
ALTER TABLE users
ADD CONSTRAINT users_date_of_birth_not_future
CHECK (date_of_birth IS NULL OR date_of_birth <= CURRENT_DATE);

-- Add check constraint: date must not be before 1900-01-01
ALTER TABLE users
ADD CONSTRAINT users_date_of_birth_reasonable
CHECK (date_of_birth IS NULL OR date_of_birth >= '1900-01-01'::DATE);

-- Add comment for documentation
COMMENT ON COLUMN users.date_of_birth IS 'User date of birth for age verification. Nullable for existing users. Format: YYYY-MM-DD';
