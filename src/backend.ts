import { createClient } from "@supabase/supabase-js";
import { attachmentPath, validateFile, type Entry } from "./domain";
const env = (import.meta as unknown as { env: Record<string, string> }).env;
export const supabase =
  env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY
    ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;
export async function loadEntries() {
  const { data, error } = await supabase!
    .from("records")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Entry[];
}
export async function saveEntry(entry: Entry, user: string) {
  const { error } = await supabase!
    .from("records")
    .upsert({ ...entry, user_id: user });
  if (error) throw error;
}
export async function removeEntry(entry: Entry) {
  if (entry.kind === "attachment" && entry.data.path) {
    const { error } = await supabase!.storage
      .from("health-files")
      .remove([entry.data.path]);
    if (error) throw error;
  }
  const { error } = await supabase!.from("records").delete().eq("id", entry.id);
  if (error) throw error;
}
export async function uploadFile(file: File, user: string, id: string) {
  validateFile(file);
  const path = attachmentPath(user, id, file.type);
  const { error } = await supabase!.storage
    .from("health-files")
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "0",
      upsert: false,
    });
  if (error) throw error;
  return path;
}
export async function fileURL(path: string) {
  const { data, error } = await supabase!.storage
    .from("health-files")
    .createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}
