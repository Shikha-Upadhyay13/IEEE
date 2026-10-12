import { useEffect, useState } from "react";
import { EMPTY_PROFILE, editorAttributes, loadProfile } from "./profile";

/** The account's spelling dialect and spell-check choice, as attributes for the writing area. */
export function useEditorAttributes(userId: string | undefined) {
  const [attributes, setAttributes] = useState(() => editorAttributes(EMPTY_PROFILE));

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadProfile(userId)
      .then((profile) => !cancelled && setAttributes(editorAttributes(profile)))
      .catch((err) => console.warn("Couldn't load editor preferences:", err));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return attributes;
}
