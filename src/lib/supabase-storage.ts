import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service role key.
 * NEVER import this in client components — the service key bypasses RLS.
 */
function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to upload/read verification documents.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const VERIFICATION_BUCKET = "verification-docs";

/** Upload a document buffer to the private verification-docs bucket. Returns the storage path. */
export async function uploadVerificationDocument(
  path: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage
    .from(VERIFICATION_BUCKET)
    .upload(path, buffer, { contentType, upsert: false });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}

/** Download a document from the private verification-docs bucket. */
export async function downloadVerificationDocument(path: string): Promise<Buffer> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(VERIFICATION_BUCKET).download(path);
  if (error || !data) throw new Error(`Storage download failed: ${error?.message ?? "not found"}`);
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
