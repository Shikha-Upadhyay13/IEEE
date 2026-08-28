import katex from "katex";
import "katex/dist/katex.min.css";
import type {
  ResolvedDocument,
  ResolvedBodyNode,
  ResolvedInlineNode,
} from "../../types/document";
import "../../styles/ieee-template.css";

// ieee-template.css's own font-family rule is the IEEE-compliant default
// (Times New Roman) and is deliberately never edited — this map only
// supplies an inline override for the non-default, non-compliant choices,
// so a document that has never set fontFamily (or explicitly chose "times")
// renders through the CSS file exactly as before.
const FONT_STACKS: Record<string, string> = {
  arial: "Arial, Helvetica, sans-serif",
  helvetica: "Helvetica, Arial, sans-serif",
  georgia: "Georgia, 'Times New Roman', serif",
  calibri: "Calibri, 'Segoe UI', sans-serif",
};

// IEEE's own conference template text (verified directly against the
// official IEEE-EIT-Paper_template.pdf — see ARCHITECTURE.md) gives exact
// A4 margins distinct from the Letter defaults already baked into
// ieee-template.css's base @page rule: top 19mm, bottom 40mm, side 15mm
// (column width/gutter are unchanged between sizes). Declared as a second
// @page rule rather than edited into the CSS file directly — the file's own
// @page stays the permanent, always-compliant Letter default; this only
// ever *overrides* it for a document that opted into A4, so nothing here
// risks the guaranteed-format promise for the common case.
const A4_PAGE_CSS = `@page { size: A4; margin-top: 19mm; margin-bottom: 40mm; margin-left: 15mm; margin-right: 15mm; }`;

// The official template's own text says explicitly "Do not add page
// numbers" — see the research behind this feature — so this is opt-in only
// (Document.meta.showPageNumbers), never part of the base stylesheet.
// counter(page) is standard CSS Paged Media; Paged.js (which does the
// actual pagination here, in both the live preview and the PDF export path
// — see PagedPreview.tsx) resolves it into real page-number text per page,
// the same way it resolves everything else in an @page margin box.
function buildPageNumberCss(fontFamily: string): string {
  return `@page { @bottom-center { content: counter(page); font-family: ${fontFamily}; font-size: 8pt; } }`;
}

// Real math rendering (KaTeX) rather than displaying the stored LaTeX as
// literal text. throwOnError: false so a mid-edit/incomplete expression
// degrades to KaTeX's own inline error rendering instead of crashing the
// whole paper preview.
function EquationMath({ latex }: { latex: string }) {
  if (!latex.trim()) {
    return <span className="ieee-equation-placeholder">[Empty equation]</span>;
  }
  const html = katex.renderToString(latex, { throwOnError: false, displayMode: true });
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function InlineContent({ nodes }: { nodes: ResolvedInlineNode[] }) {
  return (
    <>
      {nodes.map((node) => {
        if (node.type === "text") {
          let el: React.ReactNode = node.text;
          if (node.bold) el = <strong>{el}</strong>;
          if (node.italic) el = <em>{el}</em>;
          if (node.superscript) el = <sup>{el}</sup>;
          return <span key={node.text}>{el}</span>;
        }
        if (node.type === "citeRef") {
          return (
            <a key={node.id} className="ieee-cite-ref" href={`#ref-${node.refId}`}>
              [{node.resolvedNumber}]
            </a>
          );
        }
        // xref
        return (
          <a key={node.id} className="ieee-xref" href={`#${node.targetType}-${node.targetId}`}>
            {node.targetType === "figure" ? `Fig. ${node.resolvedNumber}` : `Table ${node.resolvedNumber}`}
          </a>
        );
      })}
    </>
  );
}

function BodyNodeRenderer({ node }: { node: ResolvedBodyNode }) {
  switch (node.type) {
    case "section": {
      const HeadingTag = node.level === 1 ? "h2" : "h3";
      const headingClass = node.level === 1 ? "ieee-heading-1" : "ieee-heading-2";
      // IEEE convention: top-level (I., A.) sections use a period, deeper
      // nesting (1), a)) uses a parenthesis — matches numbering.ts's depth rule.
      const label = node.level <= 2 ? `${node.resolvedNumber}. ` : `${node.resolvedNumber}) `;
      return (
        <section id={`sec-${node.id}`}>
          <HeadingTag className={headingClass}>
            {label}
            {node.heading}
          </HeadingTag>
          {node.children.map((child) => (
            <BodyNodeRenderer key={child.id} node={child} />
          ))}
        </section>
      );
    }
    case "paragraph":
      return (
        <p className="ieee-paragraph">
          <InlineContent nodes={node.content} />
        </p>
      );
    case "figure":
      return (
        <figure
          id={`figure-${node.id}`}
          className={`ieee-figure ${node.width === "double-column" ? "ieee-double-column" : ""}`}
          style={{ alignItems: node.align === "left" ? "flex-start" : node.align === "right" ? "flex-end" : "center" }}
        >
          {node.images.length > 0 ? (
            <div className="ieee-figure-images">
              {node.images.map((img, i) => (
                <div key={img.url + i} className="ieee-subfigure" style={{ width: `${node.scale}%` }}>
                  <img src={img.url} alt={img.alt} />
                  {node.images.length > 1 && (
                    <div className="ieee-subfigure-label">({String.fromCharCode(97 + i)})</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="ieee-figure-placeholder">[Image not yet uploaded]</div>
          )}
          <figcaption className="ieee-figure-caption">
            Fig. {node.resolvedNumber}. <InlineContent nodes={node.caption} />
          </figcaption>
        </figure>
      );
    case "table":
      return (
        <div
          id={`table-${node.id}`}
          className={`ieee-table-block ${node.width === "double-column" ? "ieee-double-column" : ""}`}
        >
          <div className="ieee-table-caption">
            TABLE {node.resolvedNumber}. <InlineContent nodes={node.caption} />
          </div>
          <table className="ieee-table" data-spacing={node.spacing}>
            <tbody>
              {node.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "equation":
      return (
        <div className="ieee-equation">
          <EquationMath latex={node.latex} />
          <div className="ieee-equation-number">({node.resolvedNumber})</div>
        </div>
      );
  }
}

export function IEEEConferenceTemplate({ document }: { document: ResolvedDocument }) {
  const fontOverride = FONT_STACKS[document.meta.fontFamily ?? "times"];
  const pageCssOverrides = [
    document.meta.paperSize === "a4" ? A4_PAGE_CSS : "",
    document.meta.showPageNumbers ? buildPageNumberCss(fontOverride ?? "'Times New Roman', Times, serif") : "",
  ]
    .filter(Boolean)
    .join("\n");

  // Same "inline override, base CSS file untouched" pattern as fontOverride
  // above — ieee-template.css's own .ieee-cite-ref/.ieee-xref rule reads
  // these two custom properties with defaults (none/inherit) that match
  // today's behavior exactly, so a document with no meta.linkStyle renders
  // identically to before this feature existed.
  const linkStyleVars: Record<string, string> = {};
  if (document.meta.linkStyle?.underline) linkStyleVars["--ieee-link-decoration"] = "underline";
  if (document.meta.linkStyle?.colored && document.meta.accentColor) {
    linkStyleVars["--ieee-link-color"] = document.meta.accentColor;
  }

  return (
    <div
      className="ieee-paper"
      style={{ ...(fontOverride ? { fontFamily: fontOverride } : {}), ...linkStyleVars }}
    >
      {pageCssOverrides && <style>{pageCssOverrides}</style>}
      <h1 className="ieee-title">
        <InlineContent nodes={document.titleBlock.title as ResolvedInlineNode[]} />
      </h1>

      <div className="ieee-authors-block">
        {document.titleBlock.affiliations.map((aff) => (
          <div className="ieee-author-group" key={aff.id}>
            {document.titleBlock.authors
              .filter((a) => a.affiliationRefs.includes(aff.id))
              .map((a) => (
                <div className="ieee-author-name" key={a.id}>
                  {a.name}
                </div>
              ))}
            <div className="ieee-affiliation">{aff.text}</div>
          </div>
        ))}
      </div>

      <div className="ieee-columns">
        <p className="ieee-abstract">
          <span className="ieee-run-in-heading">Abstract—</span>
          {document.abstract.text}
        </p>

        <p className="ieee-keywords">
          <span className="ieee-run-in-heading">Index Terms—</span>
          {document.keywords.join(", ")}
        </p>

        {document.body.map((node) => (
          <BodyNodeRenderer key={node.id} node={node} />
        ))}

        <h2 className="ieee-references-heading" id="references">
          References
        </h2>
        <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {document.references.map((ref) => (
            <li key={ref.id} id={`ref-${ref.id}`} className="ieee-reference-item">
              [{ref.resolvedNumber}] {ref.renderedText}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
