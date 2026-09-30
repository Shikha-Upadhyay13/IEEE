import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { GuideLayout } from "../components/guides/GuideLayout";
import { DocumentThumbnail } from "../components/renderer/DocumentThumbnail";
import { createBlankDocument } from "../lib/blankDocument";
import { resolveNumbering } from "../lib/numbering";
import { setPendingTemplate, type GalleryChoice } from "../lib/pendingTemplate";
import { STARTER_TEMPLATES } from "../lib/starterTemplates";
import { btnPrimary, btnSecondary } from "../lib/uiClasses";
import { createSamplePaper } from "../data/samplePaper";
import type { ResolvedDocument } from "../types/document";

type GalleryItem = {
  id: GalleryChoice;
  name: string;
  description: string;
  outline: string[];
  document: ResolvedDocument;
};

function buildGallery(): GalleryItem[] {
  const starters = STARTER_TEMPLATES.map((t) => {
    const doc = createBlankDocument(t.id);
    doc.titleBlock.title = [{ type: "text", text: "Your Paper Title Goes Here" }];
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      outline: t.sections.map((s) => s.heading),
      document: resolveNumbering(doc),
    };
  });
  const sample = createSamplePaper();
  return [
    ...starters,
    {
      id: "sample",
      name: "Finished example",
      description: "A complete sample paper with figures, a table, equations and references — see the end result.",
      outline: sample.body.flatMap((n) => (n.type === "section" ? [n.heading] : [])),
      document: resolveNumbering(sample),
    },
  ];
}

export function TemplatesGalleryPage() {
  const navigate = useNavigate();
  const items = useMemo(buildGallery, []);

  function chooseTemplate(id: GalleryChoice) {
    setPendingTemplate(id);
    navigate("/dashboard");
  }

  return (
    <GuideLayout
      heading="IEEE paper templates"
      intro={
        <p>
          Start from a structure that fits your paper. Every template uses the IEEE conference format — two columns,
          Times, numbered sections, figures, tables and references — and each section comes with a short prompt on
          what belongs there.
        </p>
      }
    >
      <ul className="grid sm:grid-cols-2 gap-6">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col rounded-lg border border-line bg-surface overflow-hidden">
            <div className="aspect-[8.5/9] border-b border-line">
              <DocumentThumbnail document={item.document} />
            </div>
            <div className="flex flex-1 flex-col p-5">
              <h2 className="font-display text-lg font-semibold text-ink">{item.name}</h2>
              <p className="mt-1 text-sm text-muted">{item.description}</p>
              <p className="mt-3 text-xs text-muted">
                <span className="font-semibold uppercase tracking-wide">Sections: </span>
                {item.outline.join(" · ")}
              </p>
              <div className="mt-auto pt-5">
                <button
                  type="button"
                  onClick={() => chooseTemplate(item.id)}
                  className={item.id === "sample" ? btnSecondary : btnPrimary}
                >
                  {item.id === "sample" ? "Open the example" : "Use this template"}
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted">
        You'll be asked to sign in or create a free account first; the paper is created as soon as you're in.
      </p>
    </GuideLayout>
  );
}
