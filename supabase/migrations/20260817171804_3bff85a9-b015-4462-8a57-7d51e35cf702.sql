CREATE POLICY "payout_qr_upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'admin-uploads' AND (storage.foldername(name))[1] = 'payout');
CREATE POLICY "payout_qr_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'admin-uploads' AND (storage.foldername(name))[1] = 'payout');