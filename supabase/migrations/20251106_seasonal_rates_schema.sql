-- Create seasonal_rates table for dynamic pricing
CREATE TABLE IF NOT EXISTS public.seasonal_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL, -- Format: MM-DD (e.g., "03-01" for March 1)
    end_date TEXT NOT NULL,   -- Format: MM-DD (e.g., "05-31" for May 31)
    multiplier NUMERIC(3, 2) NOT NULL CHECK (multiplier >= 0.5 AND multiplier <= 3.0),
    priority INTEGER NOT NULL DEFAULT 0, -- Higher priority takes precedence when dates overlap
    is_active BOOLEAN DEFAULT true,
    description TEXT,
    color TEXT, -- For UI display (e.g., "blue", "green", "orange")
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient date range queries
CREATE INDEX idx_seasonal_rates_active ON public.seasonal_rates (is_active);
CREATE INDEX idx_seasonal_rates_dates ON public.seasonal_rates (start_date, end_date);
CREATE INDEX idx_seasonal_rates_priority ON public.seasonal_rates (priority DESC);

-- Add RLS policies
ALTER TABLE public.seasonal_rates ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view seasonal rates
CREATE POLICY "Authenticated users can view seasonal rates"
ON public.seasonal_rates
FOR SELECT
TO authenticated
USING (true);

-- Policy: Only authenticated users can insert seasonal rates
CREATE POLICY "Authenticated users can insert seasonal rates"
ON public.seasonal_rates
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Only authenticated users can update seasonal rates
CREATE POLICY "Authenticated users can update seasonal rates"
ON public.seasonal_rates
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy: Only authenticated users can delete seasonal rates
CREATE POLICY "Authenticated users can delete seasonal rates"
ON public.seasonal_rates
FOR DELETE
TO authenticated
USING (true);

-- Create function to get applicable seasonal rate for a date
CREATE OR REPLACE FUNCTION get_seasonal_rate_for_date(check_date DATE)
RETURNS TABLE (
    season_id TEXT,
    name TEXT,
    multiplier NUMERIC,
    priority INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    month_day TEXT;
BEGIN
    -- Extract MM-DD format from the date
    month_day := TO_CHAR(check_date, 'MM-DD');

    RETURN QUERY
    SELECT
        sr.season_id,
        sr.name,
        sr.multiplier,
        sr.priority
    FROM public.seasonal_rates sr
    WHERE sr.is_active = true
    AND (
        -- Case 1: Season doesn't cross year boundary
        (sr.start_date <= sr.end_date AND month_day BETWEEN sr.start_date AND sr.end_date)
        OR
        -- Case 2: Season crosses year boundary (e.g., Dec 20 to Jan 02)
        (sr.start_date > sr.end_date AND (month_day >= sr.start_date OR month_day <= sr.end_date))
    )
    ORDER BY sr.priority DESC
    LIMIT 1;
END;
$$;

-- Insert default seasonal rates for Philippine resort context
INSERT INTO public.seasonal_rates (season_id, name, start_date, end_date, multiplier, priority, color, description) VALUES
    ('peak_summer', 'Peak Summer Season', '03-01', '05-31', 1.5, 10, 'orange', 'Philippine summer vacation period'),
    ('christmas_new_year', 'Christmas & New Year', '12-20', '01-02', 2.0, 20, 'red', 'Holiday season with highest demand'),
    ('holy_week', 'Holy Week', '03-25', '04-01', 1.8, 15, 'purple', 'Religious holiday period'),
    ('low_season', 'Low Season', '06-01', '09-30', 0.8, 5, 'blue', 'Rainy season with lower occupancy'),
    ('regular_season', 'Regular Season', '10-01', '11-30', 1.0, 1, 'green', 'Standard pricing period')
ON CONFLICT (season_id) DO NOTHING;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_seasonal_rates_updated_at
BEFORE UPDATE ON public.seasonal_rates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add comment to table
COMMENT ON TABLE public.seasonal_rates IS 'Seasonal pricing multipliers for dynamic rate adjustment';
COMMENT ON COLUMN public.seasonal_rates.season_id IS 'Unique identifier for the season (e.g., peak_summer, holy_week)';
COMMENT ON COLUMN public.seasonal_rates.start_date IS 'Season start date in MM-DD format';
COMMENT ON COLUMN public.seasonal_rates.end_date IS 'Season end date in MM-DD format';
COMMENT ON COLUMN public.seasonal_rates.multiplier IS 'Price multiplier (e.g., 1.5 = 50% increase, 0.8 = 20% discount)';
COMMENT ON COLUMN public.seasonal_rates.priority IS 'Higher priority wins when seasons overlap';