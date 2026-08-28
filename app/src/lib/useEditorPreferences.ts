import { useEffect, useState } from "react";

const STORAGE_KEY = "editor-preferences";

type EditorPreferences = { textScale: number; blockSpacing: number };

const DEFAULTS: EditorPreferences = { textScale: 1, blockSpacing: 1 };

function readStored(): EditorPreferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

// Personal, per-device editing comfort (how big the body content looks and
// how much breathing room sits between blocks while writing) - deliberately
// NOT part of the document schema. This has nothing to do with how the
// paper itself is formatted; it never reaches ieee-template.css or the
// exported PDF, so there's no compliance question here at all.
export function useEditorPreferences() {
  const [prefs, setPrefs] = useState<EditorPreferences>(readStored);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  return {
    textScale: prefs.textScale,
    blockSpacing: prefs.blockSpacing,
    setTextScale: (textScale: number) => setPrefs((p) => ({ ...p, textScale })),
    setBlockSpacing: (blockSpacing: number) => setPrefs((p) => ({ ...p, blockSpacing })),
  };
}
