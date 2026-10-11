import { supabase } from "../supabaseClient";

export type WorkspaceTemplate = { id: string; name: string; createdAt: string };

export async function listTemplates(workspaceId: string): Promise<WorkspaceTemplate[]> {
  const { data, error } = await supabase
    .from("workspace_templates")
    .select("id, name, created_at")
    .eq("workspace_id", workspaceId)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ id: r.id as string, name: r.name as string, createdAt: r.created_at as string }));
}

export async function templateContent(id: string): Promise<unknown> {
  const { data, error } = await supabase.from("workspace_templates").select("content").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data.content;
}

export async function publishTemplate(workspaceId: string, documentId: string, name: string) {
  const { error } = await supabase.rpc("publish_workspace_template", {
    doc_id: documentId,
    ws: workspaceId,
    template_name: name.trim(),
  });
  if (error) throw new Error(error.message);
}

export async function deleteTemplate(id: string) {
  const { error } = await supabase.from("workspace_templates").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
