import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { createBlankDocument } from "../../lib/blankDocument";
import { createSamplePaper } from "../../data/samplePaper";
import { btnPrimary } from "../../lib/uiClasses";

interface OnboardingWizardProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

type TemplateChoice = "sample" | "blank" | "skip";

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
      const docContent = choice === "sample" ? createSamplePaper() : createBlankDocument();
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

      navigate(`/editor/${data.id}`);
    } catch (err) {
      console.error("Failed to initialize paper from onboarding wizard:", err);
      setCreating(false);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl max-w-xl w-full p-6 sm:p-8 relative overflow-hidden">
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={`h-2 rounded-full transition-all ${
                  s === step
                    ? "w-8 bg-blue-600 dark:bg-blue-500"
                    : s < step
                      ? "w-2 bg-blue-300 dark:bg-blue-800"
                      : "w-2 bg-gray-200 dark:bg-gray-800"
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => {
              markCompleted();
              onClose();
            }}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Skip tour
          </button>
        </div>

        {/* Step 1: Welcome & Overview */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center text-2xl font-bold">
              ⚡
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                Welcome to IEEE Paper Builder
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                Write submission-ready IEEE conference and journal papers without fighting LaTeX margins,
                column breaks, or equation numbering.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                <p className="text-base mb-1">📄</p>
                <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100">Live 2-Column</h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  Pixel-accurate IEEE typesetting as you type.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                <p className="text-base mb-1">🔢</p>
                <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100">Auto Numbering</h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  Roman headings, figures, tables & equations resolved live.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                <p className="text-base mb-1">📥</p>
                <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100">1-Click PDF</h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  Download conference-ready PDFs in seconds.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button onClick={() => setStep(2)} className={`${btnPrimary} px-5 py-2 text-sm`}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Choose Starter Template */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                Choose your starting point
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                How would you like to begin your research drafting?
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={() => setChoice("sample")}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-start gap-3.5 ${
                  choice === "sample"
                    ? "border-blue-600 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                    : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-transparent"
                }`}
              >
                <span className="text-2xl flex-none mt-0.5">🌟</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Explore Sample Paper
                    </h3>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Pre-populated with sections, equations, a figure, a comparative table, and IEEE citations.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setChoice("blank")}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-start gap-3.5 ${
                  choice === "blank"
                    ? "border-blue-600 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                    : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-transparent"
                }`}
              >
                <span className="text-2xl flex-none mt-0.5">📝</span>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Blank IEEE Conference Paper
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Clean structure with standard headings: Introduction, Methodology, Results, and Conclusion.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setChoice("skip")}
                className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center gap-3.5 ${
                  choice === "skip"
                    ? "border-blue-600 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                    : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 text-gray-600 dark:text-gray-400"
                }`}
              >
                <span className="text-lg">📂</span>
                <span className="text-xs font-medium">I'll create papers from my dashboard later</span>
              </button>
            </div>

            <div className="flex justify-between items-center pt-4">
              <button
                onClick={() => setStep(1)}
                className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ← Back
              </button>
              <button onClick={() => setStep(3)} className={`${btnPrimary} px-5 py-2 text-sm`}>
                Next step →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Quick Tips & Launch */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                Ready to create!
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Here are 3 quick power features to know while drafting:
              </p>
            </div>

            <ul className="space-y-3 pt-1">
              <li className="flex items-start gap-3 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/40 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                <span className="text-sm">🔀</span>
                <div>
                  <strong className="text-gray-900 dark:text-gray-100">Drag to Reorder:</strong> Drag section
                  blocks to reorganize your paper. Section numerals and references update instantly.
                </div>
              </li>
              <li className="flex items-start gap-3 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/40 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                <span className="text-sm">💬</span>
                <div>
                  <strong className="text-gray-900 dark:text-gray-100">AI Assistant:</strong> Ask the integrated
                  research copilot to review sections, rephrase for IEEE style, or suggest improvements.
                </div>
              </li>
              <li className="flex items-start gap-3 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/40 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                <span className="text-sm">📑</span>
                <div>
                  <strong className="text-gray-900 dark:text-gray-100">Export Anytime:</strong> Hit Export in the
                  top right to generate compliant PDF files ready for IEEE Xplore submission.
                </div>
              </li>
            </ul>

            <div className="flex justify-between items-center pt-4">
              <button
                onClick={() => setStep(2)}
                className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ← Back
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
                    : "Launch Editor 🚀"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
