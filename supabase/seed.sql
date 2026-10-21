-- Local development seed. Synthetic data only: never paste a production dump here.
-- Local users match the e2e fixture defaults in e2e/fixtures/test-data.ts.

SET session_replication_role = replica;

INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "confirmation_token", "recovery_token", "email_change_token_new", "email_change", "raw_app_meta_data", "raw_user_meta_data", "created_at", "updated_at") VALUES
	('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner@okaeri.test', extensions.crypt('test-password', extensions.gen_salt('bf')), now(), '', '', '', '', '{"provider": "email", "providers": ["email"]}', '{}', now(), now()),
	('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'admin@okaeri.test', extensions.crypt('test-password', extensions.gen_salt('bf')), now(), '', '', '', '', '{"provider": "email", "providers": ["email"]}', '{}', now(), now()),
	('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'manager@okaeri.test', extensions.crypt('test-password', extensions.gen_salt('bf')), now(), '', '', '', '', '{"provider": "email", "providers": ["email"]}', '{}', now(), now()),
	('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'staff@okaeri.test', extensions.crypt('test-password', extensions.gen_salt('bf')), now(), '', '', '', '', '{"provider": "email", "providers": ["email"]}', '{}', now(), now());

INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at")
SELECT "id"::text, "id", jsonb_build_object('sub', "id"::text, 'email', "email", 'email_verified', true), 'email', now(), now(), now()
FROM "auth"."users"
WHERE "email" LIKE '%@okaeri.test';

INSERT INTO "public"."app_roles" ("user_id", "email", "role", "granted_by", "notes") VALUES
	('00000000-0000-4000-8000-000000000001', 'owner@okaeri.test', 'owner', NULL, 'Local seed user'),
	('00000000-0000-4000-8000-000000000002', 'admin@okaeri.test', 'admin', NULL, 'Local seed user'),
	('00000000-0000-4000-8000-000000000003', 'manager@okaeri.test', 'manager', NULL, 'Local seed user'),
	('00000000-0000-4000-8000-000000000004', 'staff@okaeri.test', 'staff', NULL, 'Local seed user');

INSERT INTO "public"."units" ("unit_id", "unit_name", "unit_code", "unit_type", "max_occupancy", "base_rate", "weekend_rate", "unit_status", "amenities", "base_occupancy", "extra_person_rate") VALUES
	('b88857ce-bbc1-474b-ac02-86e8a416c22e', 'Cabin 1', 'C1', 'Standard', 8, 9000.00, 9000.00, 'Available', '["WiFi", "Air Conditioning", "Mini Fridge", "Cable TV"]', 6, 1000.00),
	('4ca070ec-f5b8-4ce9-8901-ffafdad7a76f', 'Cabin 2', 'C2', 'Standard', 8, 9000.00, 9000.00, 'Available', '["WiFi", "Air Conditioning", "Kitchen", "Cable TV", "Sofa Bed"]', 6, 1000.00),
	('60ca3cec-b690-4673-8dc5-897f7b7c18e8', 'Cabin 3', 'C3', 'Standard', 8, 9000.00, 9000.00, 'Available', '["WiFi", "Air Conditioning", "Full Kitchen", "Cable TV", "Living Room", "Balcony"]', 6, 1000.00);

INSERT INTO "storage"."buckets" ("id", "name", "public", "allowed_mime_types") VALUES
	('receipts', 'receipts', false, NULL),
	('payment-proofs', 'payment-proofs', false, '{image/*}');

-- Fake Contact channels; the last one is hidden from guests.
INSERT INTO "public"."contact_channels" ("kind", "value", "label", "is_active", "display_order") VALUES
	('mobile', '+639170000001', 'Maria', true, 0),
	('viber', '+639170000001', 'Maria', true, 1),
	('whatsapp', '+639170000001', NULL, true, 2),
	('messenger', 'okaeri.resort.example', NULL, true, 3),
	('email', 'reservations@okaeri-resort.example', NULL, true, 4),
	('facebook', 'okaeri.resort.example', NULL, true, 5),
	('instagram', 'okaeri.resort.example', NULL, true, 6),
	('mobile', '+639280000002', 'Ben', false, 7);

RESET ALL;
