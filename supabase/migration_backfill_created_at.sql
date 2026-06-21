-- ============================================================================
-- Migration: Backfill NULL created_at fields in transactions table
-- ============================================================================

-- 1. Ensure the created_at column is defined correctly with DEFAULT NOW() (in case it was missing or modified)
ALTER TABLE public.transactions 
ALTER COLUMN created_at SET DEFAULT NOW();

-- 2. Backfill existing legacy rows where created_at is NULL using the transaction date as a fallback
UPDATE public.transactions
SET created_at = COALESCE(created_at, date::timestamp with time zone, NOW())
WHERE created_at IS NULL;

-- 3. Create composite index to optimize sorting performance
CREATE INDEX IF NOT EXISTS idx_transactions_date_created_at ON public.transactions(date DESC, created_at DESC);
