// Supabase Storage bucket `garden-photos` (private) — ใช้ service_role key ฝั่ง server เท่านั้น
import { StorageClient } from '@supabase/storage-js';

export const GARDEN_PHOTOS_BUCKET = 'garden-photos';

export function createPhotoStorage(opts: { supabaseUrl: string; publicUrl?: string; serviceRoleKey: string }) {
  const client = new StorageClient(`${opts.supabaseUrl}/storage/v1`, {
    apikey: opts.serviceRoleKey,
    Authorization: `Bearer ${opts.serviceRoleKey}`,
  });
  const bucket = () => client.from(GARDEN_PHOTOS_BUCKET);
  // URL ที่ส่งให้เบราว์เซอร์ต้องเป็น host ที่เบราว์เซอร์เข้าถึงได้
  const toPublic = (url: string) => (opts.publicUrl ? url.replace(opts.supabaseUrl, opts.publicUrl) : url);

  return {
    async createUploadUrl(path: string): Promise<string> {
      const { data, error } = await bucket().createSignedUploadUrl(path);
      if (error) throw error;
      return toPublic(data.signedUrl);
    },
    /** null = ไม่มีไฟล์ */
    async download(path: string): Promise<Uint8Array | null> {
      const { data, error } = await bucket().download(path);
      if (error) {
        const status = (error as { status?: number; statusCode?: string | number }).status ?? (error as { statusCode?: string }).statusCode;
        if (String(status) === '404' || String(status) === '400' || /not.?found/i.test(error.message)) return null;
        throw error;
      }
      return new Uint8Array(await data.arrayBuffer());
    },
    async createDownloadUrl(path: string, expiresInSec: number): Promise<string> {
      const { data, error } = await bucket().createSignedUrl(path, expiresInSec);
      if (error) throw error;
      return toPublic(data.signedUrl);
    },
  };
}
export type PhotoStorage = ReturnType<typeof createPhotoStorage>;
