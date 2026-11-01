-- A signed upload URL does not check the size or type the client claimed, so the bucket does.
-- Matches FILE_EXTENSIONS and MAX_FILE_SIZE in functions/api/guest-booking/upload-url.ts.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'payment-proofs', 'payment-proofs', false, 5242880,
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
