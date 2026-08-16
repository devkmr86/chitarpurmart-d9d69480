
CREATE POLICY "sellers upload fssai docs" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'admin-uploads' AND (storage.foldername(name))[1] = 'fssai' AND owner = auth.uid());

CREATE POLICY "sellers read own fssai docs" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'admin-uploads' AND (storage.foldername(name))[1] = 'fssai' AND owner = auth.uid());
