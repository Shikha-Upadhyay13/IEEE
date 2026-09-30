import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { createBlankDocument } from "../../lib/blankDocument";
import { track } from "../../lib/monitoring";
import { createSamplePaper } from "../../data/samplePaper";
import { STARTER_TEMPLATES, type StarterTemplateId } from "../../lib/starterTemplates";
import { btnPrimary } from "../../lib/uiClasses";
import { BrandMark } from "../BrandMark";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Columns2,
  Download,
  FilePlus2,
  FolderOpen,
  GripVertical,
  ListOrdered,
  MessageSquare,
} from "lucide-react";

interface OnboardingWizardProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

type TemplateChoice = "sample" | StarterTemplateId | "skip";

export function OnboardingWizard({ userId, isOpen, onClose }: OnboardingWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [choice, setChoice] = useState<TemplateChoice>("sample");
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  if (!isOpen) return null;

  async function markCompleted() {
    try {
      localStorage.setItem(`ieee_onboarding_${userId}`, "completed");
      // Best-effort profile update; if migration has not run in Supabase yet, don't crash
      await supabase
        .from("profiles")
        .upsert({ id: userId, has_completed_onboarding: true })
        .select();
    } catch (err) {
      console.warn("Could not persist onboarding state to Supabase profile:", err);
    }
  }

  async function handleFinish() {
    setCreating(true);
    await markCompleted();

    if (choice === "skip") {
      setCreating(false);
      onClose();
      return;
    }

    try {
      const docContent = choice === "sample" ? createSamplePaper() : createBlankDocument(choice);
      const title =
        choice === "sample"
          ? "Sample: Preparation of a Formatted Conference Paper"
          : "Untitled paper";

      const { data, error } = await supabase
        .from("documents")
        .insert({
          owner_id: userId,
          title,
          content: docContent,
        })
        .select("id")
        .single();

      if (error || !data) {
        throw error ?? new Error("Failed to create starter paper");
      }

      track("paper_created", { source: "onboarding", template: choice });
      navigate(`/editor/${data.id}`);
    } catch (err) {
      console.error("Failed to initialize paper from onboarding wizard:", err);
      setCreating(false);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-surface border border-line rounded-2xl shadow-2xl max-w-xl w-full p-6 sm:p-8 relative overflow-hidden">
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={`h-2 rounded-full transition-all ${
                  s === step
                    ? "w-8 bg-accent"
                    : s < step
                      ? "w-2 bg-accent/40"
                      : "w-2 bg-line"
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => {
              markCompleted();
              onClose();
            }}
            className="text-xs text-muted hover:text-ink transition-colors"
          >
            Skip tour
          </button>
        </div>

        {/* Step 1: Welcome & Overview */}
        {step === 1 && (
          <div className="space-y-4">
            <BrandMark size="lg" />
            <div>
              <h2 className="text-xl font-bold text-ink tracking-tight">
                Welcome to IEEE Paper Builder
              </h2>
              <p className="text-sm text-muted mt-1 leading-relaxed">
                Write IEEE conference papers without fighting margins, column breaks, or equation
                numbering.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-canvas border border-line">
                <Columns2 size={18} className="mb-1.5 text-accent" aria-hidden="true" />
                <h4 className="text-xs font-semibold text-ink">Live 2-Column</h4>
                <p className="text-[11px] text-muted mt-0.5">
                  Pixel-accurate IEEE typesetting as you type.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-canvas border border-line">
                <ListOrdered size={18} className="mb-1.5 text-accent" aria-hidden="true" />
                <h4 className="text-xs font-semibold text-ink">Auto Numbering</h4>
                <p className="text-[11px] text-muted mt-0.5">
                  Roman headings, figures, tables & equations resolved live.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-canvas border border-line">
                <Download size={18} className="mb-1.5 text-accent" aria-hidden="true" />
                <h4 className="text-xs font-semibold text-ink">1-Click PDF</h4>
                <p className="text-[11px] text-muted mt-0.5">
                  Download conference-ready PDFs in seconds.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button onClick={() => setStep(2)} className={`${btnPrimary} px-5 py-2 text-sm`}>
                Continue
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Choose Starter Template */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-ink tracking-tight">
                Choose your starting point
              </h2>
              <p className="text-sm text-muted mt-1">
                How would you like to begin your research drafting?
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={() => setChoice("sample")}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-start gap-3.5 ${
                  choice === "sample"
                    ? "border-accent bg-accent-soft/50"
                    : "border-line hover:border-line bg-transparent"
                }`}
              >
                <BookOpen size={22} className="flex-none mt-0.5 text-accent" aria-hidden="true" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink">
                      Explore Sample Paper
                    </h3>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-accent-soft text-accent">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1">
                    Pre-populated with sections, equations, a figure, a comparative table, and IEEE citations.
                  </p>
                </div>
              </button>

              <p className="text-xs font-semibold uppercase tracking-wide text-muted pt-1">Or start from a structure</p>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {STARTER_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setChoice(t.id)}
                    aria-pressed={choice === t.id}
                    className={`text-left p-3.5 rounded-xl border-2 transition-all flex items-start gap-3 ${
                      choice === t.id ? "border-accent bg-accent-soft/50" : "border-line hover:border-muted/50"
                    }`}
                  >
                    <FilePlus2 size={18} className="flex-none mt-0.5 text-accent" aria-hidden="true" />
                    <div>
                      <h3 className="text-sm font-semibold text-ink">{t.name}</h3>
                      <p className="text-xs text-muted mt-1">{t.description}</p>
                    </div>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setChoice("skip")}
                className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center gap-3.5 ${
                  choice === "skip"
                    ? "border-accent bg-accent-soft/50"
                    : "border-line hover:border-line text-muted"
                }`}
              >
                <FolderOpen size={18} className="text-muted" aria-hidden="true" />
                <span className="text-xs font-medium">I'll create papers from my dashboard later</span>
              </button>
            </div>

            <div className="flex justify-between items-center pt-4">
              <button
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
              >
                <ArrowLeft size={14} aria-hidden="true" />
                Back
              </button>
              <button onClick={() => setStep(3)} className={`${btnPrimary} px-5 py-2 text-sm`}>
                Next step
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Quick Tips & Launch */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-ink tracking-tight">
                Ready to create!
              </h2>
              <p className="text-sm text-muted mt-1">
                Here are 3 quick power features to know while drafting:
              </p>
            </div>

            <ul className="space-y-3 pt-1">
              <li className="flex items-start gap-3 text-xs text-muted bg-canvas p-3 rounded-lg border border-line">
                <GripVertical size={16} className="flex-none text-accent" aria-hidden="true" />
                <div>
                  <strong className="text-ink">Drag to Reorder:</strong> Drag section
                  blocks to reorganize your paper. Section numerals and references update instantly.
                </div>
              </li>
              <li className="flex items-start gap-3 text-xs text-muted bg-canvas p-3 rounded-lg border border-line">
                <MessageSquare size={16} className="flex-none text-accent" aria-hidden="true" />
                <div>
                  <strong className="text-ink">AI Assistant:</strong> Ask the integrated
                  research copilot to review sections, rephrase for IEEE style, or suggest improvements.
                </div>
              </li>
              <li className="flex items-start gap-3 text-xs text-muted bg-canvas p-3 rounded-lg border border-line">
                <Download size={16} className="flex-none text-accent" aria-hidden="true" />
                <div>
                  <strong className="text-ink">Export Anytime:</strong> Hit Export in the
                  top right to download a PDF of exactly what the preview shows.
                </div>
              </li>
            </ul>

            <div className="flex justify-between items-center pt-4">
              <button
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
              >
                <ArrowLeft size={14} aria-hidden="true" />
                Back
              </button>
              <button
                onClick={handleFinish}
                disabled={creating}
                className={`${btnPrimary} px-6 py-2.5 text-sm font-semibold`}
              >
                {creating
                  ? "Creating your paper…"
                  : choice === "skip"
                    ? "Go to Dashboard"
                    : "Open the editor"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
