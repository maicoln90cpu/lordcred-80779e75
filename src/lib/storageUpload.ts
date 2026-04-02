import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'imported-spreadsheets';

/**
 * Upload a file (or text blob) to the imported-spreadsheets bucket.
 * Path: {userId}/{timestamp}_{filename}
 * Returns the storage path or null on error.
 */
export async function uploadSpreadsheet(
  userId: string,
  fileName: string,
  fileOrBlob: File | Blob,
): Promise<string | null> {
  const ts = Date.now();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${userId}/${ts}_${safeName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, fileOrBlob, { upsert: false });

  if (error) {
    console.error('Storage upload error:', error.message);
    return null;
  }
  return path;
}

/**
 * Get a temporary signed URL to download a file from the bucket.
 * Valid for 1 hour.
 */
export async function getSpreadsheetUrl(filePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 3600);

  if (error || !data?.signedUrl) {
    console.error('Storage signed URL error:', error?.message);
    return null;
  }
  return data.signedUrl;
}
