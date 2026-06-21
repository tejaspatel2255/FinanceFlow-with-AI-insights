-- ============================================================================
-- Migration: Add currency column to ai_insights and clear stale cache
-- ============================================================================

-- 1. Add currency column (nullable, text)
ALTER TABLE public.ai_insights 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT NULL;

-- 2. Force-clear the existing stale cache so they are regenerated with the correct currency
DELETE FROM public.ai_insights;
