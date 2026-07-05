export interface Source {
  label: string;
  glyph: string;
  color: string;
}

export const SOURCES: Record<string, Source> = {
  chrome: { label: "Chrome", glyph: "◐", color: "#4285F4" },
  vscode: { label: "VS Code", glyph: "◧", color: "#22A7F0" },
  terminal: { label: "Terminal", glyph: "▣", color: "#8A8A93" },
  slack: { label: "Slack", glyph: "◆", color: "#E01E5A" },
  figma: { label: "Figma", glyph: "◈", color: "#A259FF" },
  mail: { label: "Mail", glyph: "✉", color: "#5B8DEF" },
  unknown: { label: "App", glyph: "○", color: "#8A8A93" },
};

// Resolve an item's `app` field to a display source. Known keys map to a rich
// icon; anything else (a raw OS app name) gets a generic glyph but keeps its
// human-readable label.
export function getSource(app: string | undefined | null): Source {
  if (!app || app === "unknown") return SOURCES.unknown;
  if (SOURCES[app]) return SOURCES[app];
  return { label: app, glyph: "○", color: "#8A8A93" };
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

// Search matching across modes. Returns true if `text` matches `query`.
export function matchesQuery(text: string, query: string, mode: "exact" | "fuzzy" | "regexp"): boolean {
  const q = query.trim();
  if (!q) return true;
  const t = text.toLowerCase();
  const lq = q.toLowerCase();
  if (mode === "regexp") {
    try {
      return new RegExp(q, "i").test(text);
    } catch {
      return t.includes(lq); // fall back to contains on invalid regex
    }
  }
  if (mode === "fuzzy") {
    let i = 0;
    for (const ch of t) {
      if (ch === lq[i]) i++;
      if (i === lq.length) return true;
    }
    return i === lq.length;
  }
  return t.includes(lq); // "exact" = case-insensitive substring
}

export function timeAgo(timestamp: number): string {
  const mins = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Convert a browser KeyboardEvent into an Electron accelerator string, e.g.
// "Command+Shift+V". Returns null until at least one modifier + a main key are
// pressed, so the recorder waits for a valid combo.
export function eventToAccelerator(e: {
  key: string;
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}): string | null {
  const mods: string[] = [];
  if (e.metaKey) mods.push("Command");
  if (e.ctrlKey) mods.push("Control");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");

  const key = normalizeKey(e.key, e.code);
  if (!key) return null; // modifier-only press — keep waiting
  if (mods.length === 0) return null; // require at least one modifier
  return [...mods, key].join("+");
}

function normalizeKey(key: string, code: string): string | null {
  if (["Meta", "Control", "Alt", "Shift"].includes(key)) return null;
  if (key === " " || code === "Space") return "Space";
  if (/^[a-z]$/i.test(key)) return key.toUpperCase();
  if (/^[0-9]$/.test(key)) return key;
  const named: Record<string, string> = {
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Escape: "Escape",
    Enter: "Return",
    Tab: "Tab",
    Backspace: "Backspace",
    Delete: "Delete",
  };
  if (named[key]) return named[key];
  // Function keys and punctuation pass through as-is.
  if (/^F\d{1,2}$/.test(key)) return key;
  if (key.length === 1) return key.toUpperCase();
  return null;
}

// Does a keyboard event match an Electron accelerator string like "Alt+P"?
export function matchesAccelerator(
  e: { key: string; code: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean },
  accel: string | undefined | null
): boolean {
  if (!accel) return false;
  const parts = accel.split("+").map((p) => p.trim());
  const need = { meta: false, ctrl: false, alt: false, shift: false };
  let key = "";
  for (const p of parts) {
    const lp = p.toLowerCase();
    if (lp === "command" || lp === "cmd" || lp === "super" || lp === "meta") need.meta = true;
    else if (lp === "commandorcontrol" || lp === "cmdorctrl") {
      need.meta = true; // matched below as meta-or-ctrl
    } else if (lp === "control" || lp === "ctrl") need.ctrl = true;
    else if (lp === "alt" || lp === "option") need.alt = true;
    else if (lp === "shift") need.shift = true;
    else key = p;
  }
  const isCmdOrCtrl = accel.toLowerCase().includes("commandorcontrol") || accel.toLowerCase().includes("cmdorctrl");
  const modOk = isCmdOrCtrl
    ? (e.metaKey || e.ctrlKey) && e.altKey === need.alt && e.shiftKey === need.shift
    : e.metaKey === need.meta && e.ctrlKey === need.ctrl && e.altKey === need.alt && e.shiftKey === need.shift;
  if (!modOk) return false;

  const ek = normalizeEventKey(e.key, e.code);
  return ek.toLowerCase() === key.toLowerCase();
}

function normalizeEventKey(key: string, code: string): string {
  if (key === " " || code === "Space") return "Space";
  if (key === "Backspace") return "Backspace";
  if (key === "Delete") return "Delete";
  if (/^[a-z]$/i.test(key)) return key.toUpperCase();
  return key;
}

// Pretty-print an accelerator for display (⌘ ⇧ V on mac, Ctrl Shift V on win).
export function formatAccelerator(accel: string | undefined | null, isMac: boolean): string {
  if (!accel) return isMac ? "⌘ ⇧ V" : "Ctrl+Shift+V";
  const symbols: Record<string, string> = isMac
    ? { Command: "⌘", Control: "⌃", Alt: "⌥", Shift: "⇧", CommandOrControl: "⌘" }
    : { Command: "Win", Control: "Ctrl", Alt: "Alt", Shift: "Shift", CommandOrControl: "Ctrl" };
  return accel
    .split("+")
    .map((part) => symbols[part] ?? part)
    .join(isMac ? " " : "+");
}
