import { z } from "zod";
import { supabase } from "../supabaseClient";
import type { Document } from "../types/document";
import { generateId } from "./id";
import { createBlankDocument } from "./blankDocument";
import type { StarterTemplateId } from "./starterTemplates";

export const PaperDefaultsSchema = z.object({
  template: z.enum(["ieee-conference", "ieee-peer-review", "ieee-journal", "ieee-technote"]).optional(),
  paperSize: z.enum(["letter", "a4"]).optional(),
  mode: z.enum(["submission", "draft", "custom"]).optional(),
  dialect: z.enum(["en-US", "en-GB"]).optional(),
});
export type PaperDefaults = z.infer<typeof PaperDefaultsSchema>;

export const EditorPreferencesSchema = z.object({
  spellcheck: z.boolean().optional(),
});
export type EditorPreferences = z.infer<typeof EditorPreferencesSchema>;

export type Profile = {
  fullName: string;
  orcid: string;
  affiliation: string;
  paperDefaults: PaperDefaults;
  editorPreferences: EditorPreferences;
};

export const EMPTY_PROFILE: Profile = { fullName: "", orcid: "", affiliation: "", paperDefaults: {}, editorPreferences: {} };

export const MAX_NAME = 120;
export const MAX_AFFILIATION = 300;

type Row = {
  full_name: string | null;
  orcid: string | null;
  affiliation: string | null;
  paper_defaults: unknown;
  editor_preferences: unknown;
};

/** Unknown or outdated keys in the stored JSON are dropped rather than failing the whole profile. */
export function fromRow(row: Row | null): Profile {
  if (!row) return EMPTY_PROFILE;
  const defaults = PaperDefaultsSchema.safeParse(row.paper_defaults);
  const editor = EditorPreferencesSchema.safeParse(row.editor_preferences);
  return {
    fullName: row.full_name ?? "",
    orcid: row.orcid ?? "",
    affiliation: row.affiliation ?? "",
    paperDefaults: defaults.success ? defaults.data : {},
    editorPreferences: editor.success ? editor.data : {},
  };
}

/** Accepts "https://orcid.org/0000-0002-1825-0097", spaces or no dashes; returns the canonical form or null. */
export function normalizeOrcid(input: string): string | null {
  const compact = input
    .trim()
    .replace(/^https?:\/\/(www\.)?orcid\.org\//i, "")
    .replace(/[\s-]/g, "")
    .toUpperCase();
  if (!/^\d{15}[\dX]$/.test(compact)) return null;
  // ISO 7064 MOD 11-2 check digit, as ORCID specifies.
  let total = 0;
  for (const digit of compact.slice(0, 15)) total = (total + Number(digit)) * 2;
  const result = (12 - (total % 11)) % 11;
  const check = result === 10 ? "X" : String(result);
  if (check !== compact[15]) return null;
  return compact.match(/.{4}/g)!.join("-");
}

const COLUMNS = "full_name, orcid, affiliation, paper_defaults, editor_preferences";
const cache = new Map<string, Promise<Profile>>();

/** Cached for the session; saveProfile refreshes it. */
export function loadProfile(userId: string): Promise<Profile> {
  let pending = cache.get(userId);
  if (!pending) {
    pending = (async () => {
      const { data, error } = await supabase.from("profiles").select(COLUMNS).eq("id", userId).maybeSingle();
      if (error) throw new Error(error.message);
      return fromRow(data as Row | null);
    })();
    pending.catch(() => cache.delete(userId));
    cache.set(userId, pending);
  }
  return pending;
}

export async function saveProfile(userId: string, profile: Profile): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      full_name: profile.fullName.trim() || null,
      orcid: profile.orcid.trim() || null,
      affiliation: profile.affiliation.trim() || null,
      paper_defaults: profile.paperDefaults,
      editor_preferences: profile.editorPreferences,
    })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  const saved = fromRow(data as Row);
  cache.set(userId, Promise.resolve(saved));
  return saved;
}

/**
 * A new paper starts in the account's default format, size and mode, with the
 * account holder as first author when they have set a name.
 */
export function applyNewPaperDefaults(doc: Document, profile: Profile, email?: string): Document {
  const { template, paperSize, mode } = profile.paperDefaults;
  const meta = {
    ...doc.meta,
    ...(template && { template }),
    ...(paperSize && { paperSize }),
    ...(mode && { mode }),
  };
  const name = profile.fullName.trim();
  if (!name || doc.titleBlock.authors.length > 0) return { ...doc, meta };

  const affiliationText = profile.affiliation.trim();
  const affiliation = affiliationText ? { id: generateId("aff"), text: affiliationText } : null;
  return {
    ...doc,
    meta,
    titleBlock: {
      ...doc.titleBlock,
      authors: [
        {
          id: generateId("author"),
          name,
          affiliationRefs: affiliation ? [affiliation.id] : [],
          ...(email && { email }),
        },
      ],
      affiliations: affiliation ? [affiliation, ...doc.titleBlock.affiliations] : doc.titleBlock.affiliations,
    },
  };
}

/** A starter paper with the account's defaults; a profile that can't load never blocks creating one. */
export async function createBlankPaperFor(user: { id: string; email?: string }, template?: StarterTemplateId): Promise<Document> {
  let profile = EMPTY_PROFILE;
  try {
    profile = await loadProfile(user.id);
  } catch (err) {
    console.warn("Couldn't load profile defaults for a new paper:", err);
  }
  return applyNewPaperDefaults(createBlankDocument(template), profile, user.email);
}
