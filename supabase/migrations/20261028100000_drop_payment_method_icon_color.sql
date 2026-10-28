-- Payment method icons inherit the surrounding text colour (#128).
-- The stored Tailwind palette class escaped the design tokens and was unreadable in dark mode.
ALTER TABLE public.payment_methods DROP COLUMN IF EXISTS icon_color;
