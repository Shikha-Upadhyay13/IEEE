import { supabase } from "../supabaseClient";

type Row = Record<string, unknown>;

export type AccountExport = {
  format: "ieee-paper-builder-export";
  version: 1;
  exportedAt: string;
  user: { id: string; email: string | null; createdAt: string | null };
  documents: Row[];
  documentVersions: Row[];
  projects: Row[];
  conversations: Row[];
  generatedImages: Row[];
  exports: Row[];
};

async function selectAll(table: string, columns = "*"): Promise<Row[]> {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) throw new Error(`Couldn't read ${table}: ${error.message}`);
  return (data ?? []) as unknown as Row[];
}

// Row-level security already limits every select to the signed-in user's rows.
export async function collectAccountData(): Promise<AccountExport> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You need to be signed in to export your data.");

  const [documents, documentVersions, projects, conversations, generatedImages, exports] = await Promise.all([
    selectAll("documents"),
    selectAll("document_versions"),
    selectAll("projects"),
    selectAll("conversations"),
    selectAll("generated_images"),
    selectAll("exports"),
  ]);

  return {
    format: "ieee-paper-builder-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    user: { id: user.id, email: user.email ?? null, createdAt: user.created_at ?? null },
    documents,
    documentVersions,
    projects,
    conversations,
    generatedImages,
    exports,
  };
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportFilename(date = new Date()): string {
  return `ieee-paper-builder-data-${date.toISOString().slice(0, 10)}.json`;
}

// Storage paths are {uid}/{documentId}/{file}; list() is one level deep.
async function listUserFiles(bucket: string, userId: string): Promise<string[]> {
  const storage = supabase.storage.from(bucket);
  const { data: folders, error } = await storage.list(userId, { limit: 1000 });
  if (error) throw new Error(`Couldn't list ${bucket}: ${error.message}`);
  const paths: string[] = [];
  for (const entry of folders ?? []) {
    // Folders come back without an id; files directly under {uid}/ have one.
    if (entry.id) {
      paths.push(`${userId}/${entry.name}`);
      continue;
    }
    const { data: files, error: innerError } = await storage.list(`${userId}/${entry.name}`, { limit: 1000 });
    if (innerError) throw new Error(`Couldn't list ${bucket}: ${innerError.message}`);
    for (const file of files ?? []) paths.push(`${userId}/${entry.name}/${file.name}`);
  }
  return paths;
}

async function removeUserFiles(bucket: string, userId: string) {
  const paths = await listUserFiles(bucket, userId);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage.from(bucket).remove(paths.slice(i, i + 100));
    if (error) throw new Error(`Couldn't delete files in ${bucket}: ${error.message}`);
  }
}

export async function deleteAccount(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You need to be signed in to delete your account.");

  await removeUserFiles("figures", user.id);
  await removeUserFiles("exports", user.id);

  const { error } = await supabase.rpc("delete_own_account");
  if (error) throw new Error(`Couldn't delete your account: ${error.message}`);

  await supabase.auth.signOut();
}
