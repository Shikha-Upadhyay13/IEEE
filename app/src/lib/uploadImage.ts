import { supabase } from "../supabaseClient";
import { generateId } from "./id";

// Mirrors the figures bucket limits in supabase/migrations/005_security_hardening.sql.
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Returns a message explaining why the file can't be uploaded, or null if it can. */
export function imageFileProblem(file: Pick<File, "type" | "size">): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return "Use a PNG, JPEG, GIF or WebP image.";
  if (file.size > MAX_IMAGE_BYTES) return "Images must be 10 MB or smaller.";
  return null;
}

/**
 * Uploads an image for a paper and returns its public URL. The first path
 * segment must be the uploader's id — that's what the storage policies check.
 */
export async function uploadPaperImage(file: File, userId: string, documentId: string): Promise<string> {
  const problem = imageFileProblem(file);
  if (problem) throw new Error(problem);
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const path = `${userId}/${documentId}/${generateId("img")}.${ext}`;
  const { error } = await supabase.storage.from("figures").upload(path, file);
  if (error) throw error;
  return supabase.storage.from("figures").getPublicUrl(path).data.publicUrl;
}
