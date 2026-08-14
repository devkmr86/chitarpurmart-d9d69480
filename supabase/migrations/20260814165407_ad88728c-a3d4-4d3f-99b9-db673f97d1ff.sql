
CREATE POLICY "admin_uploads_admin_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'admin-uploads' AND public.is_admin());
CREATE POLICY "admin_uploads_admin_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'admin-uploads' AND public.is_admin());
CREATE POLICY "admin_uploads_admin_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'admin-uploads' AND public.is_admin()) WITH CHECK (bucket_id = 'admin-uploads' AND public.is_admin());
CREATE POLICY "admin_uploads_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'admin-uploads' AND public.is_admin());
