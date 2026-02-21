-- Migration: Make guest email and phone_number optional
-- Reason: Resort guests commonly book via FB Messenger without providing
-- email or phone. Empty strings ("") violate the UNIQUE constraint on email
-- since PostgreSQL treats "" = "" as duplicate, but NULL != NULL as distinct.

-- 1. Drop NOT NULL constraints on guests table
ALTER TABLE public.guests ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.guests ALTER COLUMN phone_number DROP NOT NULL;

-- 2. Clean up existing empty strings to NULL in guests
UPDATE public.guests SET email = NULL WHERE email = '';
UPDATE public.guests SET phone_number = NULL WHERE phone_number = '';

-- 3. Drop NOT NULL constraints on bookings table (contact info mirrors guest)
ALTER TABLE public.bookings ALTER COLUMN contact_number DROP NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN email DROP NOT NULL;

-- 4. Clean up existing empty strings to NULL in bookings
UPDATE public.bookings SET contact_number = NULL WHERE contact_number = '';
UPDATE public.bookings SET email = NULL WHERE email = '';
