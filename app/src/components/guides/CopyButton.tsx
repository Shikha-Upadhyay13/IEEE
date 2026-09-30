import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { btnSecondary } from "../../lib/uiClasses";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this text:", text);
    }
  }

  return (
    <button type="button" onClick={handleCopy} disabled={!text} className={btnSecondary}>
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}
