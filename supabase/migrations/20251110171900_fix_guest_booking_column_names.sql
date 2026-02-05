-- Fix column name mismatches in create_guest_booking function
-- 1. Bookings table: was using check_in_date/check_out_date but table has check_in/check_out
-- 2. Guests table: was using name/contact_number but table has guest_name/phone_number
-- 3. Bookings table: removed unit_id (doesn't exist), added guest_name/contact_number/email (required)
-- 4. Bookings table: renamed notes to internal_notes, added is_guest_booking/is_multi_unit flags

CREATE OR REPLACE FUNCTION public.create_guest_booking(
  p_turnstile_token TEXT,
  p_booking_data JSONB,
  p_unit_requests JSONB,
  p_guest_data JSONB DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_guest_id UUID;
  v_booking_id UUID;
  v_result JSONB;
  v_email TEXT;
  v_unit_count INTEGER;
  v_total_guests INTEGER;
  v_validation_error TEXT;
BEGIN
  -- Extract email for later use
  v_email := COALESCE(p_guest_data->>'email', p_booking_data->>'email');

  -- Validate inputs
  IF p_turnstile_token IS NULL OR p_turnstile_token = '' THEN
    RAISE EXCEPTION 'Invalid turnstile token';
  END IF;

  IF NOT jsonb_typeof(p_unit_requests) = 'array' THEN
    RAISE EXCEPTION 'unit_requests must be an array';
  END IF;

  v_unit_count := jsonb_array_length(p_unit_requests);
  IF v_unit_count = 0 THEN
    RAISE EXCEPTION 'At least one unit request is required';
  END IF;

  IF v_unit_count > 10 THEN
    RAISE EXCEPTION 'Maximum 10 units per booking';
  END IF;

  -- Calculate total guests from unit requests
  SELECT SUM((unit_req->>'guests_per_unit')::INTEGER)
  INTO v_total_guests
  FROM jsonb_array_elements(p_unit_requests) AS unit_req;

  -- Create or get guest
  IF p_guest_data IS NOT NULL THEN
    -- Create new guest record
    INSERT INTO public.guests (
      guest_id,
      guest_name,
      email,
      phone_number,
      nationality,
      address,
      date_of_birth,
      id_type,
      id_number,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      p_guest_data->>'guest_name',
      p_guest_data->>'email',
      p_guest_data->>'phone_number',
      p_guest_data->>'nationality',
      p_guest_data->>'address',
      (p_guest_data->>'date_of_birth')::DATE,
      p_guest_data->>'id_type',
      p_guest_data->>'id_number',
      NOW(),
      NOW()
    ) RETURNING guest_id INTO v_guest_id;
  ELSE
    -- Try to find existing guest by email
    SELECT guest_id INTO v_guest_id
    FROM public.guests
    WHERE email = v_email
    LIMIT 1;

    -- If no guest found, create minimal guest record
    IF v_guest_id IS NULL THEN
      INSERT INTO public.guests (
        guest_id,
        guest_name,
        email,
        phone_number,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        p_booking_data->>'guest_name',
        v_email,
        p_booking_data->>'phone_number',
        NOW(),
        NOW()
      ) RETURNING guest_id INTO v_guest_id;
    END IF;
  END IF;

  -- Insert booking with proper column names matching actual schema
  INSERT INTO public.bookings (
    booking_id,
    booking_reference,
    guest_id,
    guest_name,
    contact_number,
    email,
    check_in,
    check_out,
    num_guests,
    special_requests,
    total_amount,
    payment_status,
    booking_status,
    created_at,
    updated_at,
    payment_method,
    payment_proof_url,
    internal_notes,
    is_guest_booking,
    is_multi_unit,
    unit_count,
    unit_assignment_status
  ) VALUES (
    gen_random_uuid(),
    p_booking_data->>'booking_reference',
    v_guest_id,
    p_booking_data->>'guest_name',
    p_booking_data->>'phone_number',
    v_email,
    (p_booking_data->>'check_in')::TIMESTAMPTZ,
    (p_booking_data->>'check_out')::TIMESTAMPTZ,
    v_total_guests,
    p_booking_data->>'special_requests',
    COALESCE((p_booking_data->>'total_amount')::NUMERIC, 0),
    'Pending',
    'Pending',
    NOW(),
    NOW(),
    p_booking_data->>'payment_method',
    p_booking_data->>'payment_proof_url',
    jsonb_build_object(
      'source', 'guest_booking_form',
      'unit_requests', p_unit_requests,
      'unit_count', v_unit_count,
      'created_at', NOW()
    )::TEXT,
    TRUE,
    v_unit_count > 1,
    v_unit_count,
    'pending'
  ) RETURNING booking_id INTO v_booking_id;

  -- Return success with booking details
  SELECT jsonb_build_object(
    'success', true,
    'booking', jsonb_build_object(
      'booking_id', booking_id,
      'booking_reference', booking_reference,
      'guest_id', guest_id,
      'guest_name', p_booking_data->>'guest_name',
      'email', v_email,
      'phone_number', p_booking_data->>'phone_number',
      'check_in', check_in,  -- Fixed: was check_in_date in SELECT
      'check_out', check_out, -- Fixed: was check_out_date in SELECT
      'unit_count', v_unit_count,
      'total_guests', num_guests,
      'special_requests', special_requests,
      'payment_method', payment_method,
      'payment_proof_url', payment_proof_url,
      'status', booking_status,
      'payment_status', payment_status,
      'created_at', created_at
    ),
    'guest', jsonb_build_object(
      'guest_id', v_guest_id,
      'name', COALESCE(p_guest_data->>'name', p_booking_data->>'guest_name'),
      'email', v_email,
      'contact_number', COALESCE(p_guest_data->>'contact_number', p_booking_data->>'phone_number')
    )
  ) INTO v_result
  FROM public.bookings
  WHERE booking_id = v_booking_id;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Rollback happens automatically
    RAISE EXCEPTION 'Booking creation failed: % - All changes rolled back', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the fix (must specify full signature for overloaded functions)
COMMENT ON FUNCTION public.create_guest_booking(TEXT, JSONB, JSONB, JSONB) IS
'Creates a guest booking with multi-unit support. Fixed column names: check_in/check_out (not check_in_date/check_out_date) for bookings table, and guest_name/phone_number (not name/contact_number) for guests table.';