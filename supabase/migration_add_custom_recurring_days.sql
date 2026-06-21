-- ============================================================================
-- Migration: Add custom recurring days interval to transactions table
-- ============================================================================

-- Add recurrence_interval_days column to store custom interval count
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS recurrence_interval_days INTEGER DEFAULT NULL;
