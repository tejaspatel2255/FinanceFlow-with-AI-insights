-- ============================================================================
-- FinanceFlow Supabase Schema & Row Level Security (RLS) Policies
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. TRANSACTIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
    category VARCHAR(50) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    tags TEXT[] DEFAULT '{}'::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) for transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Transactions Policies
CREATE POLICY "Users can view their own transactions" 
    ON public.transactions FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions" 
    ON public.transactions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions" 
    ON public.transactions FOR UPDATE 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transactions" 
    ON public.transactions FOR DELETE 
    USING (auth.uid() = user_id);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);


-- ----------------------------------------------------------------------------
-- 2. BUDGETS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    period VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (period IN ('weekly', 'monthly', 'yearly')),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Prevent duplicate budgets for the same category, period, and user
    UNIQUE(user_id, category, period)
);

-- Enable Row Level Security (RLS) for budgets
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- Budgets Policies
CREATE POLICY "Users can view their own budgets" 
    ON public.budgets FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own budgets" 
    ON public.budgets FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own budgets" 
    ON public.budgets FOR UPDATE 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own budgets" 
    ON public.budgets FOR DELETE 
    USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON public.budgets(user_id);


-- ----------------------------------------------------------------------------
-- 3. GOALS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    target_amount NUMERIC(12, 2) NOT NULL,
    current_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    deadline DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) for goals
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- Goals Policies
CREATE POLICY "Users can view their own goals" 
    ON public.goals FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goals" 
    ON public.goals FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals" 
    ON public.goals FOR UPDATE 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals" 
    ON public.goals FOR DELETE 
    USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);


-- ----------------------------------------------------------------------------
-- 4. AI INSIGHTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    insight_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) for ai_insights
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- AI Insights Policies
CREATE POLICY "Users can view their own AI insights" 
    ON public.ai_insights FOR SELECT 
    USING (auth.uid() = user_id);

-- If insights are generated on the backend using service_role, RLS is bypassed.
-- However, we still grant insert permissions to users if their client-side actions trigger it.
CREATE POLICY "Users can insert their own AI insights" 
    ON public.ai_insights FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own AI insights" 
    ON public.ai_insights FOR DELETE 
    USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_ai_insights_user_id ON public.ai_insights(user_id);


-- ----------------------------------------------------------------------------
-- 5. USER SETTINGS TABLE (Theme & Preferences)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    theme_preference VARCHAR(30) NOT NULL DEFAULT 'original',
    mode_preference VARCHAR(10) NOT NULL DEFAULT 'light',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) for user_settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- User Settings Policies
CREATE POLICY "Users can view their own settings"
    ON public.user_settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
    ON public.user_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
    ON public.user_settings FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

