import React, { useEffect, useMemo, useRef, useState } from "react";
import { Settings as GeneralIcon, HardDrive, Palette, Pin, Ban, Cog, Plus, Minus, Check, type LucideIcon } from "lucide-react";
import { getTokens, type Tokens } from "../theme";
import { eventToAccelerator, formatAccelerator, formatBytes } from "../utils";
import type { ClipItem, Settings as AppSettings, StorageInfo } from "../../electron/types";

type Tab = "general" | "storage" | "appearance" | "pins" | "ignore" | "advanced";

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "general", label: "General", icon: GeneralIcon },
  { id: "storage", label: "Storage", icon: HardDrive },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "pins", label: "Pins", icon: Pin },
  { id: "ignore", label: "Ignore", icon: Ban },
  { id: "advanced", label: "Advanced", icon: Cog },
];

export default function Preferences() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [tab, setTab] = useState<Tab>("general");
  const [isMac, setIsMac] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    window.clipvault.getPlatform().then((p) => setIsMac(p === "darwin"));
    window.clipvault.getSettings().then(setSettings);
    const unsub = window.clipvault.onSettingsUpdated(setSettings);
    return unsub;
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(id);
  }, [toast]);

  if (!settings) return null;
  const t = getTokens(settings.theme === "dark");

  const update = async (patch: Partial<AppSettings>) => setSettings(await window.clipvault.setSettings(patch));

  return (
    <div style={{ background: t.bg, color: t.text }} className="w-screen h-screen flex flex-col">
      {/* toolbar tabs */}
      <div style={{ borderBottom: `1px solid ${t.border}`, background: t.panel }} className="flex items-end justify-center gap-1 px-4 pt-3 pb-2 select-none">
        {TABS.map((tb) => {
          const active = tab === tb.id;
          const Icon = tb.icon;
          return (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              style={{ background: active ? t.accentSoft : "transparent", color: active ? t.accent : t.subtext }}
              className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
            >
              <Icon size={18} color={active ? t.accent : t.subtext} />
              {tb.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-7">
        {tab === "general" && <General t={t} isMac={isMac} settings={settings} update={update} onToast={setToast} />}
        {tab === "storage" && <Storage t={t} settings={settings} update={update} />}
        {tab === "appearance" && <Appearance t={t} settings={settings} update={update} />}
        {tab === "pins" && <Pins t={t} />}
        {tab === "ignore" && <Ignore t={t} settings={settings} update={update} />}
        {tab === "advanced" && <Advanced t={t} settings={settings} update={update} />}
      </div>

      {toast && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <div style={{ background: t.accentSoft, color: t.accent }} className="text-[12px] font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 shadow">
            <Check size={13} /> {toast}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- shared primitives ---------- */

function Field({ t, label, children }: { t: Tokens; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 mb-4">
      <div style={{ color: t.text }} className="text-[13px] w-32 text-right flex-shrink-0">
        {label}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Toggle({ t, checked, onChange, label }: { t: Tokens; checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer mb-2.5">
      <button
        onClick={() => onChange(!checked)}
        style={{ background: checked ? t.accent : "transparent", border: `1px solid ${checked ? t.accent : t.border}` }}
        className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
        type="button"
      >
        {checked && <Check size={11} color="#fff" strokeWidth={3} />}
      </button>
      <span style={{ color: t.text }} className="text-[13px]">
        {label}
      </span>
    </label>
  );
}

function Select<T extends string | number>({
  t,
  value,
  onChange,
  options,
}: {
  t: Tokens;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => {
        const raw = e.target.value;
        const parsed = (typeof value === "number" ? Number(raw) : raw) as T;
        onChange(parsed);
      }}
      style={{ background: t.panel, border: `1px solid ${t.border}`, color: t.text }}
      className="text-[12.5px] px-2.5 py-1.5 rounded-md outline-none min-w-[160px]"
    >
      {options.map((o) => (
        <option key={String(o.value)} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function NumberInput({ t, value, onChange, min, max }: { t: Tokens; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ background: t.panel, border: `1px solid ${t.border}`, color: t.text }}
      className="text-[12.5px] px-2.5 py-1.5 rounded-md outline-none w-24"
    />
  );
}

function ShortcutRecorder({ t, value, isMac, onChange }: { t: Tokens; value: string; isMac: boolean; onChange: (v: string) => void }) {
  const [recording, setRecording] = useState(false);
  useEffect(() => {
    if (!recording) return;
    function onKey(e: KeyboardEvent) {
      e.preventDefault();
      if (e.key === "Escape") {
        setRecording(false);
        return;
      }
      const accel = eventToAccelerator(e);
      if (accel) {
        onChange(accel);
        setRecording(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [recording, onChange]);

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => setRecording((r) => !r)}
        style={{ background: t.panel, border: `1px ${recording ? "dashed" : "solid"} ${recording ? t.accent : t.border}`, color: recording ? t.accent : t.text }}
        className="text-[12.5px] font-mono px-3 py-1.5 rounded-md min-w-[120px] text-center"
      >
        {recording ? "Press keys…" : formatAccelerator(value, isMac)}
      </button>
    </div>
  );
}

function Divider({ t }: { t: Tokens }) {
  return <div style={{ borderTop: `1px solid ${t.border}` }} className="my-5" />;
}

/* ---------- General ---------- */

function General({
  t,
  isMac,
  settings,
  update,
  onToast,
}: {
  t: Tokens;
  isMac: boolean;
  settings: AppSettings;
  update: (p: Partial<AppSettings>) => void;
  onToast: (s: string) => void;
}) {
  return (
    <div>
      <div className="pl-36">
        <Toggle t={t} checked={settings.autoLaunch} onChange={(v) => update({ autoLaunch: v })} label="Launch at login" />
        <Toggle t={t} checked={settings.checkForUpdatesAutomatically} onChange={(v) => update({ checkForUpdatesAutomatically: v })} label="Check for updates automatically" />
        <button
          onClick={async () => {
            const r = await window.clipvault.checkForUpdates();
            onToast(r.status);
          }}
          style={{ background: t.panel, border: `1px solid ${t.border}`, color: t.text }}
          className="text-[12px] px-3 py-1.5 rounded-md mt-1"
        >
          Check now
        </button>
      </div>

      <Divider t={t} />

      <Field t={t} label="Open:">
        <ShortcutRecorder t={t} isMac={isMac} value={settings.shortcut} onChange={(v) => update({ shortcut: v })} />
      </Field>
      <Field t={t} label="Pin:">
        <ShortcutRecorder t={t} isMac={isMac} value={settings.pinShortcut} onChange={(v) => update({ pinShortcut: v })} />
      </Field>
      <Field t={t} label="Delete:">
        <ShortcutRecorder t={t} isMac={isMac} value={settings.deleteShortcut} onChange={(v) => update({ deleteShortcut: v })} />
      </Field>

      <Divider t={t} />

      <Field t={t} label="Search:">
        <Select
          t={t}
          value={settings.searchMode}
          onChange={(v) => update({ searchMode: v })}
          options={[
            { value: "exact", label: "Exact" },
            { value: "fuzzy", label: "Fuzzy" },
            { value: "regexp", label: "Regular expression" },
          ]}
        />
      </Field>

      <Divider t={t} />

      <Field t={t} label="Behavior:">
        <div>
          <Toggle t={t} checked={settings.pasteAutomatically} onChange={(v) => update({ pasteAutomatically: v })} label="Paste automatically" />
          <Toggle t={t} checked={settings.pasteWithoutFormatting} onChange={(v) => update({ pasteWithoutFormatting: v })} label="Paste without formatting" />
          <p style={{ color: t.subtext }} className="text-[11px] leading-relaxed mt-1 max-w-[380px]">
            “Paste automatically” types ⌘/Ctrl+V into the previous app after you pick an item. On macOS this needs Accessibility permission (System Settings → Privacy &
            Security → Accessibility).
          </p>
        </div>
      </Field>
    </div>
  );
}

/* ---------- Storage ---------- */

function Storage({ t, settings, update }: { t: Tokens; settings: AppSettings; update: (p: Partial<AppSettings>) => void }) {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  useEffect(() => {
    window.clipvault.getStorageInfo().then(setInfo);
  }, [settings]);

  return (
    <div>
      <Field t={t} label="Save:">
        <div>
          <Toggle t={t} checked={settings.saveFiles} onChange={(v) => update({ saveFiles: v })} label="Files" />
          <Toggle t={t} checked={settings.saveImages} onChange={(v) => update({ saveImages: v })} label="Images" />
          <Toggle t={t} checked={settings.saveText} onChange={(v) => update({ saveText: v })} label="Text" />
          <p style={{ color: t.subtext }} className="text-[11px] mt-1">
            Change what types of copied content should be stored.
          </p>
        </div>
      </Field>

      <Divider t={t} />

      <Field t={t} label="Size:">
        <div className="flex items-center gap-3">
          <NumberInput t={t} value={settings.maxItems} min={5} max={99999} onChange={(v) => update({ maxItems: v })} />
          <span style={{ color: t.subtext }} className="text-[12px]">
            {info ? formatBytes(info.bytes) : ""}
          </span>
        </div>
      </Field>

      <Field t={t} label="Sort by:">
        <Select
          t={t}
          value={settings.sortBy}
          onChange={(v) => update({ sortBy: v })}
          options={[
            { value: "lastCopy", label: "Time of last copy" },
            { value: "firstCopy", label: "Time of first copy" },
            { value: "numberOfCopies", label: "Number of copies" },
          ]}
        />
      </Field>
    </div>
  );
}

/* ---------- Appearance ---------- */

function Appearance({ t, settings, update }: { t: Tokens; settings: AppSettings; update: (p: Partial<AppSettings>) => void }) {
  return (
    <div>
      <Field t={t} label="Theme:">
        <Select
          t={t}
          value={settings.theme}
          onChange={(v) => update({ theme: v })}
          options={[
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
          ]}
        />
      </Field>
      <Field t={t} label="Popup at:">
        <Select
          t={t}
          value={settings.popupAt}
          onChange={(v) => update({ popupAt: v })}
          options={[
            { value: "cursor", label: "Cursor" },
            { value: "center", label: "Screen center" },
            { value: "tray", label: "Menu bar icon" },
          ]}
        />
      </Field>
      <Field t={t} label="Pin to:">
        <Select
          t={t}
          value={settings.pinTo}
          onChange={(v) => update({ pinTo: v })}
          options={[
            { value: "top", label: "Top" },
            { value: "bottom", label: "Bottom" },
          ]}
        />
      </Field>
      <Field t={t} label="Image height:">
        <NumberInput t={t} value={settings.imageHeight} min={20} max={200} onChange={(v) => update({ imageHeight: v })} />
      </Field>
      <Field t={t} label="Preview delay:">
        <NumberInput t={t} value={settings.previewDelay} min={0} max={5000} onChange={(v) => update({ previewDelay: v })} />
      </Field>
      <Field t={t} label="Highlight matches:">
        <Select
          t={t}
          value={settings.highlightMatches}
          onChange={(v) => update({ highlightMatches: v })}
          options={[
            { value: "bold", label: "Bold" },
            { value: "underline", label: "Underline" },
            { value: "italic", label: "Italic" },
            { value: "none", label: "None" },
          ]}
        />
      </Field>

      <Divider t={t} />

      <div className="pl-36">
        <Toggle t={t} checked={settings.showSpecialSymbols} onChange={(v) => update({ showSpecialSymbols: v })} label="Show special symbols" />
        <Toggle t={t} checked={settings.showApplicationIcons} onChange={(v) => update({ showApplicationIcons: v })} label="Show application icons" />
        <Toggle t={t} checked={settings.showSearchField} onChange={(v) => update({ showSearchField: v })} label="Show search field" />
        <Toggle t={t} checked={settings.showTitleBeforeSearch} onChange={(v) => update({ showTitleBeforeSearch: v })} label="Show title before search field" />
        <Toggle t={t} checked={settings.showFooter} onChange={(v) => update({ showFooter: v })} label="Show footer" />
        <Toggle t={t} checked={settings.showRecentInTray} onChange={(v) => update({ showRecentInTray: v })} label="Show recent copy next to menu icon" />
      </div>
    </div>
  );
}

/* ---------- Pins ---------- */

function Pins({ t }: { t: Tokens }) {
  const [items, setItems] = useState<ClipItem[]>([]);
  useEffect(() => {
    window.clipvault.getHistory().then(setItems);
    const unsub = window.clipvault.onHistoryUpdated(setItems);
    return unsub;
  }, []);
  const pinned = items.filter((i) => i.pinned);

  const save = async (id: string, patch: { title?: string | null; content?: string; hotkey?: string | null }) => {
    setItems(await window.clipvault.updatePinned(id, patch));
  };

  return (
    <div>
      <div style={{ border: `1px solid ${t.border}` }} className="rounded-lg overflow-hidden">
        <div style={{ background: t.panel, borderBottom: `1px solid ${t.border}`, color: t.subtext }} className="grid grid-cols-[110px,1fr,1fr] text-[11px] font-semibold px-3 py-2">
          <span>Key</span>
          <span>Title</span>
          <span>Content</span>
        </div>
        {pinned.length === 0 && (
          <div style={{ color: t.subtext }} className="text-[12px] px-3 py-6 text-center">
            No pinned items yet. Pin items from the panel to manage them here.
          </div>
        )}
        {pinned.map((it) => (
          <div key={it.id} style={{ borderBottom: `1px solid ${t.border}` }} className="grid grid-cols-[110px,1fr,1fr] gap-2 px-3 py-2 items-center">
            <input
              defaultValue={it.hotkey ?? ""}
              placeholder="e.g. ⌥1"
              onBlur={(e) => save(it.id, { hotkey: e.target.value.trim() || null })}
              style={{ background: t.row, border: `1px solid ${t.border}`, color: t.text }}
              className="text-[11px] font-mono px-2 py-1 rounded outline-none"
            />
            <input
              defaultValue={it.title ?? ""}
              placeholder="Title"
              onBlur={(e) => save(it.id, { title: e.target.value.trim() || null })}
              style={{ background: t.row, border: `1px solid ${t.border}`, color: t.text }}
              className="text-[12px] px-2 py-1 rounded outline-none"
            />
            {it.type === "text" ? (
              <input
                defaultValue={it.content}
                onBlur={(e) => save(it.id, { content: e.target.value })}
                style={{ background: t.row, border: `1px solid ${t.border}`, color: t.mono }}
                className="text-[12px] font-mono px-2 py-1 rounded outline-none"
              />
            ) : (
              <span style={{ color: t.subtext }} className="text-[12px] truncate">
                {it.type === "image" ? "Image" : "File"}
              </span>
            )}
          </div>
        ))}
      </div>
      <p style={{ color: t.subtext }} className="text-[11px] mt-3 leading-relaxed">
        Set an optional global hotkey (Key) to copy a pinned item from anywhere, give it a friendly Title, and edit plain-text Content. Changes save when you click away.
      </p>
    </div>
  );
}

/* ---------- Ignore ---------- */

function Ignore({ t, settings, update }: { t: Tokens; settings: AppSettings; update: (p: Partial<AppSettings>) => void }) {
  const [sub, setSub] = useState<"apps" | "types" | "regex">("apps");
  const key = sub === "apps" ? "ignoreApps" : sub === "types" ? "ignoreTypes" : "ignoreRegexes";
  const list = settings[key] as string[];

  const setList = (next: string[]) => update({ [key]: next } as Partial<AppSettings>);

  return (
    <div>
      <div style={{ background: t.panel, border: `1px solid ${t.border}` }} className="inline-flex rounded-lg p-0.5 mb-4">
        {(
          [
            ["apps", "Applications"],
            ["types", "Pasteboard types"],
            ["regex", "Regular expressions"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSub(id)}
            style={{ background: sub === id ? t.accent : "transparent", color: sub === id ? "#fff" : t.subtext }}
            className="text-[12px] px-3 py-1.5 rounded-md transition-colors"
          >
            {label}
          </button>
        ))}
      </div>

      <ListEditor t={t} list={list} onChange={setList} placeholder={sub === "apps" ? "App name (e.g. 1Password)" : sub === "types" ? "com.example.type" : "regular expression"} />

      <p style={{ color: t.subtext }} className="text-[11px] mt-3 leading-relaxed max-w-[440px]">
        {sub === "apps" && "Ignore copies coming from certain applications (matched against the detected source app name)."}
        {sub === "types" && "Ignore copies whose pasteboard/clipboard type matches. Some app-specific types are added by default."}
        {sub === "regex" && "Ignore copies whose text matches any of these regular expressions."}
      </p>
    </div>
  );
}

function ListEditor({ t, list, onChange, placeholder }: { t: Tokens; list: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...list, v]);
    setDraft("");
    inputRef.current?.focus();
  };
  const removeSel = () => {
    if (selected === null) return;
    onChange(list.filter((_, i) => i !== selected));
    setSelected(null);
  };

  return (
    <div>
      <div style={{ border: `1px solid ${t.border}`, background: t.panel }} className="rounded-lg h-56 overflow-y-auto">
        {list.length === 0 && (
          <div style={{ color: t.subtext }} className="text-[12px] px-3 py-6 text-center">
            Nothing here yet.
          </div>
        )}
        {list.map((v, i) => (
          <div
            key={i}
            onClick={() => setSelected(i)}
            style={{ background: selected === i ? t.accentSoft : "transparent", borderBottom: `1px solid ${t.border}`, color: t.text }}
            className="text-[12.5px] px-3 py-2 cursor-pointer"
          >
            {v}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={placeholder}
          style={{ background: t.panel, border: `1px solid ${t.border}`, color: t.text }}
          className="flex-1 text-[12.5px] px-2.5 py-1.5 rounded-md outline-none"
        />
        <button onClick={add} style={{ background: t.panel, border: `1px solid ${t.border}`, color: t.text }} className="p-1.5 rounded-md" title="Add">
          <Plus size={14} />
        </button>
        <button onClick={removeSel} style={{ background: t.panel, border: `1px solid ${t.border}`, color: t.text }} className="p-1.5 rounded-md" title="Remove selected">
          <Minus size={14} />
        </button>
      </div>
    </div>
  );
}

/* ---------- Advanced ---------- */

function Advanced({ t, settings, update }: { t: Tokens; settings: AppSettings; update: (p: Partial<AppSettings>) => void }) {
  return (
    <div className="max-w-[520px]">
      <Toggle t={t} checked={settings.turnOff} onChange={(v) => update({ turnOff: v })} label="Turn off" />
      <p style={{ color: t.subtext }} className="text-[11px] leading-relaxed mb-5">
        Temporarily ignore all new copies. Useful while copying sensitive data — turn it back on afterward.
      </p>

      <Divider t={t} />

      <Toggle t={t} checked={settings.clearHistoryOnQuit} onChange={(v) => update({ clearHistoryOnQuit: v })} label="Clear history on quit" />
      <Toggle t={t} checked={settings.clearSystemClipboardToo} onChange={(v) => update({ clearSystemClipboardToo: v })} label="Clear the system clipboard too" />
      <p style={{ color: t.subtext }} className="text-[11px] leading-relaxed mt-2">
        Pinned items are always kept, even when clearing history.
      </p>
    </div>
  );
}
