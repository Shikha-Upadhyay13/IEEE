import { z } from "zod";

// Inline content — lives inside a paragraph, caption, or title.
// citeRef/xref carry stable ids, never display numbers (see lib/numbering.ts).
export const InlineNodeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    text: z.string(),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    superscript: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("citeRef"),
    id: z.string(),
    refId: z.string(),
  }),
  z.object({
    type: z.literal("xref"),
    id: z.string(),
    targetType: z.enum(["figure", "table"]),
    targetId: z.string(),
  }),
]);
export type InlineNode = z.infer<typeof InlineNodeSchema>;

const BlockWidthSchema = z.enum(["single-column", "double-column"]);
// IEEE doesn't prescribe an exact table cell padding, unlike margins/fonts/
// column width — so this is safe to make user-adjustable per table without
// risking the "guaranteed IEEE-compliant" promise the rest of the template
// chrome makes. Optional + defaulted to "comfortable" for tables predating
// this field (see numbering.ts's resolveNumbering, which fills in the default).
const TableSpacingSchema = z.enum(["compact", "comfortable", "spacious"]);
export type TableSpacing = z.infer<typeof TableSpacingSchema>;

const FigureImageSchema = z.object({ url: z.string(), alt: z.string() });
export type FigureImage = z.infer<typeof FigureImageSchema>;
const FigureScaleSchema = z.number().int().min(10).max(100);
const FigureAlignSchema = z.enum(["left", "center", "right"]);
export type FigureAlign = z.infer<typeof FigureAlignSchema>;

// BodyNode is recursive (a section contains children that may themselves be sections),
// so the schema is built with z.lazy().
export type BodyNode =
  | { type: "section"; id: string; heading: string; level: number; children: BodyNode[] }
  | { type: "paragraph"; id: string; content: InlineNode[] }
  | {
      type: "figure";
      id: string;
      width: z.infer<typeof BlockWidthSchema>;
      images: FigureImage[]; // 2+ renders as side-by-side subfigures (a), (b), ...
      scale?: number; // percentage, 10-100; default 100 (see numbering.ts)
      align?: FigureAlign; // default "center"
      caption: InlineNode[];
      /** @deprecated legacy single-image shape, read-only for documents predating multi-image support — see numbering.ts's normalization. Never written by new code. */
      image?: { url: string; alt: string };
    }
  | {
      type: "table";
      id: string;
      width: z.infer<typeof BlockWidthSchema>;
      caption: InlineNode[];
      rows: string[][];
      spacing?: TableSpacing;
    }
  | { type: "equation"; id: string; latex: string };

export const BodyNodeSchema: z.ZodType<BodyNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("section"),
      id: z.string(),
      heading: z.string(),
      level: z.number().int().min(1),
      children: z.array(BodyNodeSchema),
    }),
    z.object({
      type: z.literal("paragraph"),
      id: z.string(),
      content: z.array(InlineNodeSchema),
    }),
    z.object({
      type: z.literal("figure"),
      id: z.string(),
      width: BlockWidthSchema,
      images: z.array(FigureImageSchema),
      scale: FigureScaleSchema.optional(),
      align: FigureAlignSchema.optional(),
      caption: z.array(InlineNodeSchema),
      image: FigureImageSchema.optional(), // legacy — see BodyNode's figure variant
    }),
    z.object({
      type: z.literal("table"),
      id: z.string(),
      width: BlockWidthSchema,
      caption: z.array(InlineNodeSchema),
      rows: z.array(z.array(z.string())),
      spacing: TableSpacingSchema.optional(),
    }),
    z.object({
      type: z.literal("equation"),
      id: z.string(),
      latex: z.string(),
    }),
  ])
);

export const AuthorSchema = z.object({
  id: z.string(),
  name: z.string(),
  affiliationRefs: z.array(z.string()),
  email: z.string().optional(),
});
export type Author = z.infer<typeof AuthorSchema>;

export const AffiliationSchema = z.object({
  id: z.string(),
  text: z.string(),
});
export type Affiliation = z.infer<typeof AffiliationSchema>;

export const ReferenceSchema = z.object({
  id: z.string(),
  fields: z.record(z.string(), z.string()),
  renderedText: z.string(),
});
export type Reference = z.infer<typeof ReferenceSchema>;

export const DocumentSchema = z.object({
  schemaVersion: z.literal(1),
  meta: z.object({
    template: z.literal("ieee-conference"),
    paperSize: z.enum(["letter", "a4"]),
    pageLimit: z.number().int().positive().nullable(),
  }),
  titleBlock: z.object({
    title: z.array(InlineNodeSchema),
    authors: z.array(AuthorSchema),
    affiliations: z.array(AffiliationSchema),
  }),
  abstract: z.object({ text: z.string() }),
  keywords: z.array(z.string()),
  body: z.array(BodyNodeSchema),
  references: z.array(ReferenceSchema),
});
export type Document = z.infer<typeof DocumentSchema>;

// The rendered/resolved counterparts — same shape, with computed numbers attached.
// Produced only by lib/numbering.ts; never persisted, never hand-authored.
export type ResolvedInlineNode =
  | Extract<InlineNode, { type: "text" }>
  | (Extract<InlineNode, { type: "citeRef" }> & { resolvedNumber: number })
  | (Extract<InlineNode, { type: "xref" }> & { resolvedNumber: number | string });

export type ResolvedBodyNode =
  | { type: "section"; id: string; heading: string; level: number; resolvedNumber: string; children: ResolvedBodyNode[] }
  | { type: "paragraph"; id: string; content: ResolvedInlineNode[] }
  | {
      type: "figure";
      id: string;
      width: "single-column" | "double-column";
      images: FigureImage[];
      scale: number; // defaulted in resolveNumbering; always present once resolved
      align: FigureAlign; // defaulted in resolveNumbering; always present once resolved
      caption: ResolvedInlineNode[];
      resolvedNumber: number;
    }
  | {
      type: "table";
      id: string;
      width: "single-column" | "double-column";
      caption: ResolvedInlineNode[];
      rows: string[][];
      spacing: TableSpacing; // defaulted in resolveNumbering; always present once resolved
      resolvedNumber: string; // Roman numeral
    }
  | { type: "equation"; id: string; latex: string; resolvedNumber: number };

export type ResolvedReference = Reference & { resolvedNumber: number };

export type ResolvedDocument = Omit<Document, "body" | "references"> & {
  body: ResolvedBodyNode[];
  references: ResolvedReference[];
};
