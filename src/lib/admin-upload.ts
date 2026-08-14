import { supabase } from "@/integrations/supabase/client";

const BUCKET = "admin-uploads";
const TEN_YEARS = 60 * 60 * 24 * 3650;

/** Uploads an image to private storage and returns a long-lived signed URL. */
export async function uploadAdminImage(file: File, folder: string): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
  if (error) throw new Error(error.message);
  const { data, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, TEN_YEARS);
  if (signErr || !data?.signedUrl) throw new Error(signErr?.message ?? "Could not create image link");
  return data.signedUrl;
}