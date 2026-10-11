import { supabase } from "../supabaseClient";

export const NOT_WRITABLE_MESSAGE =
  "This paper no longer exists, or you don't have permission to change it.";

type WriteResult = { error: Error | null };

/**
 * Row-level security turns a write the user isn't allowed to make into a
 * silent no-op (no error, zero rows), so every write asks for the affected ids
 * back and treats an empty result as a failure.
 */
function toWriteResult(data: unknown[] | null, error: { message: string } | null): WriteResult {
  if (error) return { error: new Error(error.message) };
  if (!data || data.length === 0) return { error: new Error(NOT_WRITABLE_MESSAGE) };
  return { error: null };
}

export async function updateDocument(id: string, patch: Record<string, unknown>): Promise<WriteResult> {
  const { data, error } = await supabase.from("documents").update(patch).eq("id", id).select("id");
  return toWriteResult(data, error);
}

export async function deleteDocument(id: string): Promise<WriteResult> {
  const { data, error } = await supabase.from("documents").delete().eq("id", id).select("id");
  return toWriteResult(data, error);
}
