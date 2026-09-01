import { useState } from "react";
import { useDocumentStore } from "../../store/documentStore";
import { cardBase, btnSecondary } from "../../lib/uiClasses";
import { useEditorPreferences } from "../../lib/useEditorPreferences";
import {
  getAppearanceDefaults,
  saveAppearanceDefaults,
  clearAppearanceDefaults,
} from "../../lib/paperAppearanceDefaults";
import type { Document } from "../../types/document";

type AccentTargetKey = keyof NonNullable<Document["meta"]["accentTargets"]>;
type LinkStyleKey = keyof NonNullable<Document["meta"]["linkStyle"]>;
type SpacingDensity = NonNullable<Document["meta"]["spacingDensity"]>;

const SPACING_OPTIONS: { value: SpacingDensity; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "standard", label: "Standard" },
  { value: "relaxed", label: "Relaxed" },
];

// Curated, deliberately not-purple palette (see the app-wide graphite pass) —
// these are picked for the *paper's own* accent, a per-document choice the
// author makes, unlike the app's own brand color which stays graphite.
const ACCENT_SWATCHES: { value: string | null; label: string }[] = [
  { value: null, label: "None (default)" },
  { value: "#64748b", label: "Slate" },
  { value: "#2563eb", label: "Blue" },
  { value: "#0ea5e9", label: "Sky" },
  { value: "#14b8a6", label: "Teal" },
  { value: "#10b981", label: "Emerald" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#f97316", label: "Orange" },
  { value: "#f43f5e", label: "Rose" },
  { value: "#ef4444", label: "Red" },
];

const ACCENT_TARGET_OPTIONS: { key: AccentTargetKey; label: string }[] = [
  { key: "dragHandles", label: "Drag handles" },
  { key: "blockBorders", label: "Block borders" },
  { key: "citationChips", label: "Citation & cross-ref chips" },
];

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-xs text-gray-400 dark:text-gray-500">{format(value)}</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-gray-800 dark:accent-gray-300"
        />
        <button
          type="button"
          aria-label={`Decrease ${label.toLowerCase()}`}
          onClick={() => onChange(clamp(value - step))}
          className="w-7 h-7 flex-none rounded border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center text-sm"
        >
          −
        </button>
        <button
          type="button"
          aria-label={`Increase ${label.toLowerCase()}`}
          onClick={() => onChange(clamp(value + step))}
          className="w-7 h-7 flex-none rounded border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center text-sm"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function AppearancePanel() {
  const [expanded, setExpanded] = useState(false);
  const meta = useDocumentStore((s) => s.document.meta);
  const setAccentColor = useDocumentStore((s) => s.setAccentColor);
  const setAccentTarget = useDocumentStore((s) => s.setAccentTarget);
  const setLinkStyle = useDocumentStore((s) => s.setLinkStyle);
  const setSpacingDensity = useDocumentStore((s) => s.setSpacingDensity);
  const { textScale, blockSpacing, setTextScale, setBlockSpacing } = useEditorPreferences();
  const [hasDefault, setHasDefault] = useState(() => getAppearanceDefaults() !== null);
  const [justSaved, setJustSaved] = useState(false);

  const accentColor = meta.accentColor ?? null;

  function handleSaveDefault() {
    saveAppearanceDefaults({
      accentColor: meta.accentColor,
      accentTargets: meta.accentTargets,
      linkStyle: meta.linkStyle,
      spacingDensity: meta.spacingDensity,
    });
    setHasDefault(true);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }

  function handleClearDefault() {
    clearAppearanceDefaults();
    setHasDefault(false);
  }

  return (
    <div className={`${cardBase} p-5 mb-5`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-2 text-left"
      >
        <span
          className="flex-none w-4 h-4 flex items-center justify-center text-gray-400 dark:text-gray-500 transition-transform"
          style={{ transform: expanded ? "rotate(90deg)" : "none" }}
        >
          ▸
        </span>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Appearance</h2>
      </button>

      {expanded && (
        <div className="mt-4 flex flex-col gap-6">
          {/* Colors — editor-workspace only, never printed */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Colors</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              Personalizes your editing workspace only — none of this appears in your exported PDF.
            </p>
            <div className="flex flex-wrap gap-2.5 mb-4">
              {ACCENT_SWATCHES.map((swatch) => (
                <button
                  key={swatch.label}
                  type="button"
                  onClick={() => setAccentColor(swatch.value)}
                  aria-label={swatch.label}
                  aria-pressed={accentColor === swatch.value}
                  title={swatch.label}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                    accentColor === swatch.value
                      ? "border-gray-900 dark:border-gray-100 scale-110"
                      : "border-transparent hover:scale-105"
                  } ${swatch.value === null ? "bg-gray-100 dark:bg-gray-800" : ""}`}
                  style={swatch.value ? { backgroundColor: swatch.value } : undefined}
                >
                  {swatch.value === null && (
                    <span className="text-gray-400 dark:text-gray-500 text-base leading-none">⊘</span>
                  )}
                </button>
              ))}
              <label
                title="Custom color"
                className="relative w-8 h-8 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center cursor-pointer text-gray-400 dark:text-gray-500 hover:border-gray-400 dark:hover:border-gray-500"
              >
                <input
                  type="color"
                  value={accentColor ?? "#64748b"}
                  onChange={(e) => setAccentColor(e.target.value)}
                  aria-label="Custom accent color"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <span className="text-sm leading-none">+</span>
              </label>
            </div>

            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
              Apply accent color to
            </p>
            <div className="flex flex-col gap-2">
              {ACCENT_TARGET_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  className={`flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 ${
                    accentColor ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={!accentColor}
                    checked={meta.accentTargets?.[opt.key] ?? false}
                    onChange={(e) => setAccentTarget(opt.key, e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-400"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Link Styling — the one control here that does reach the export */}
          <div className="pt-5 border-t border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Link Styling</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              Applies to citation <span className="font-mono">[1]</span> and figure/table cross-reference
              links in your exported PDF.
            </p>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={meta.linkStyle?.underline ?? false}
                  onChange={(e) => setLinkStyle("underline" as LinkStyleKey, e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-400"
                />
                Underline
              </label>
              <label
                className={`flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 ${
                  accentColor ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!accentColor}
                  checked={meta.linkStyle?.colored ?? false}
                  onChange={(e) => setLinkStyle("colored" as LinkStyleKey, e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-400"
                />
                Use accent color{!accentColor && " (pick a color above first)"}
              </label>
            </div>
            {meta.linkStyle?.colored && (
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">
                Some venues require plain black text with no special styling in the final PDF — check your
                submission guidelines before enabling this.
              </p>
            )}
          </div>

          {/* Spacing — the other control that reaches the export, bounded to
              three modest presets rather than a free slider */}
          <div className="pt-5 border-t border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Spacing</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              Breathing room around paragraphs, headings, figures, tables, and equations in your exported
              PDF. Margins, fonts, and column width stay fixed to spec regardless of this setting.
            </p>
            <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden">
              {SPACING_OPTIONS.map((opt, i) => {
                const active = (meta.spacingDensity ?? "standard") === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSpacingDensity(opt.value)}
                    aria-pressed={active}
                    className={`px-3 py-1.5 text-sm transition-colors ${i > 0 ? "border-l border-gray-300 dark:border-gray-600" : ""} ${
                      active
                        ? "bg-blue-600 dark:bg-blue-500 text-white font-medium"
                        : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Carries Colors/Link Styling/Spacing into new papers — reads at
              the moment a new paper is created (see blankDocument.ts), never
              retroactively touches an existing one. */}
          <div className="pt-5 border-t border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Defaults</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              Carry this paper's Colors, Link Styling, and Spacing choices into every new paper you create
              on this device.
            </p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={handleSaveDefault} className={btnSecondary}>
                {hasDefault ? "Update default" : "Set as default for new papers"}
              </button>
              {hasDefault && (
                <button
                  type="button"
                  onClick={handleClearDefault}
                  className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                >
                  Clear
                </button>
              )}
            </div>
            {justSaved && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">Saved.</p>}
          </div>

          {/* Editing view — local to this device, never affects the export */}
          <div className="pt-5 border-t border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Editing View</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              Your own reading comfort while writing — saved on this device, never affects the exported PDF.
            </p>
            <SliderRow
              label="Text size"
              value={textScale}
              min={0.85}
              max={1.4}
              step={0.05}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={setTextScale}
            />
            <SliderRow
              label="Space between blocks (this view only)"
              value={blockSpacing}
              min={0.5}
              max={2}
              step={0.1}
              format={(v) => `${v.toFixed(1)}×`}
              onChange={setBlockSpacing}
            />
          </div>
        </div>
      )}
    </div>
  );
}
