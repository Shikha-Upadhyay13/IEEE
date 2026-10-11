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

export type SaveResult =
  | { status: "saved"; version: number }
  | { status: "conflict"; version: number }
  | { status: "error"; error: Error };

/**
 * Saves a paper only if nobody else has saved since `expectedVersion`; the
 * database bumps `version` on every content change. A lost race comes back
 * as "conflict" with the version now stored, never as a silent overwrite.
 */
export async function saveDocument(
  id: string,
  patch: { title: string; content: unknown },
  expectedVersion: number,
): Promise<SaveResult> {
  const { data, error } = await supabase
    .from("documents")
    .update(patch)
    .eq("id", id)
    .eq("version", expectedVersion)
    .select("version");
  if (error) return { status: "error", error: new Error(error.message) };
  if (data && data.length > 0) return { status: "saved", version: data[0].version as number };

  const { data: current } = await supabase.from("documents").select("version").eq("id", id).maybeSingle();
  if (current && current.version !== expectedVersion) return { status: "conflict", version: current.version as number };
  return { status: "error", error: new Error(NOT_WRITABLE_MESSAGE) };
}

export async function deleteDocument(id: string): Promise<WriteResult> {
  const { data, error } = await supabase.from("documents").delete().eq("id", id).select("id");
  return toWriteResult(data, error);
}
