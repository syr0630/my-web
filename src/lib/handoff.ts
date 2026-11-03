export type HandoffTarget =
  | "polisher"
  | "grammar"
  | "translate"
  | "detector"
  | "humanize";

export type HandoffPayload = {
  text: string;
  from: HandoffTarget;
};

const KEY = "draftly.handoff";

/** Move text between tools without putting a whole draft in the URL. */
export function setHandoff(payload: HandoffPayload): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* storage can be unavailable in private mode; navigation still works */
  }
}

export function takeHandoff(target: HandoffTarget): string | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as Partial<HandoffPayload>;
    if (!parsed || typeof parsed.text !== "string" || parsed.from === target) {
      return null;
    }
    return parsed.text.trim() || null;
  } catch {
    return null;
  }
}