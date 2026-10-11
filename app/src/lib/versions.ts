import { supabase } from "../supabaseClient";
import type { Document } from "../types/document";

/** Saves a named copy of the paper to its version history. */
export async function createSnapshot(documentId: string, label: string, content: Document): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("document_versions").insert({ document_id: documentId, title: label, content });
  return { error: error ? new Error(error.message) : null };
}
