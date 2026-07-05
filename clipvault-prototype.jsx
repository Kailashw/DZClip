import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Search, Pin, PinOff, Tag, Lock, Settings, X, Trash2,
  Sun, Moon, Sparkles, Clipboard, Check, ChevronDown
} from "lucide-react";

// ---- mock data --------------------------------------------------------

const SOURCES = {
  chrome: { label: "Chrome", glyph: "◐", color: "#4285F4" },
  vscode: { label: "VS Code", glyph: "◧", color: "#22A7F0" },
  terminal: { label: "Terminal", glyph: "▣", color: "#8A8A93" },
  slack: { label: "Slack", glyph: "◆", color: "#E01E5A" },
  figma: { label: "Figma", glyph: "◈", color: "#A259FF" },
  mail: { label: "Mail", glyph: "✉", color: "#5B8DEF" },
};

const seedItems = [
  { content: "git commit -m \"fix: race condition in clipboard poller\"", app: "terminal", minsAgo: 3 },
  { content: "https://github.com/anthropic/clipvault/pull/482", app: "chrome", minsAgo: 9 },
  { content: "const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };", app: "vscode", minsAgo: 14 },
  { content: "sarah.chen@northwind.io", app: "mail", minsAgo: 22 },
  { content: "Can you review the pricing tiers doc before standup?", app: "slack", minsAgo: 31 },
  { content: "#7C5CFC", app: "figma", minsAgo: 45 },
  { content: "ALTER TABLE subscriptions ADD COLUMN trial_ends_at timestamptz;", app: "terminal", minsAgo: 58 },
  { content: "4242 4242 4242 4242", app: "chrome", minsAgo: 72 },
  { content: "docker compose up -d --build", app: "terminal", minsAgo: 95 },
  { content: "https://figma.com/file/9kQ2/clipvault-onboarding", app: "figma", minsAgo: 130 },
  { content: "The quarterly sync moved to Thursday 10am PT.", app: "mail", minsAgo: 180 },
  { content: "npm run test -- --watch clipboard.service", app: "vscode", minsAgo: 240 },
];

function timeAgo(mins) {
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ---- app ---------------------------------------------------------------

export default function DZClipPrototype() {
  const [screen, setScreen] = useState("main"); // "onboarding" | "main" | "upgrade"
  const [theme, setTheme] = useState("dark");
  const [premium, setPremium] = useState(false);

  const isDark = theme === "dark";
  const t = tokens(isDark);

  return (
    <div style={{ background: isDark ? "#0B0B0D" : "#E7E7EC" }} className="w-full min-h-[680px] flex flex-col items-center">
      {/* prototype navigation — not part of the product UI, lets you jump between screens */}
      <div className="w-full flex justify-center pt-4 pb-2">
        <div style={{ background: t.panel, border: `1px solid ${t.border}` }} className="flex items-center gap-0.5 rounded-full p-1 shadow-sm">
          {["onboarding", "main", "upgrade"].map((s) => (
            <button
              key={s}
              onClick={() => setScreen(s)}
              style={{ background: screen === s ? t.accent : "transparent", color: screen === s ? "#fff" : t.subtext }}
              className="text-[11px] font-medium px-3 py-1.5 rounded-full capitalize transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center w-full px-6 pb-8">
        {screen === "onboarding" && <Onboarding t={t} isDark={isDark} onFinish={() => setScreen("main")} />}
        {screen === "main" && (
          <MainApp
            t={t}
            isDark={isDark}
            theme={theme}
            setTheme={setTheme}
            premium={premium}
            setPremium={setPremium}
            onUpgrade={() => setScreen("upgrade")}
            onClose={() => setScreen("onboarding")}
          />
        )}
        {screen === "upgrade" && <Upgrade t={t} isDark={isDark} premium={premium} onActivate={() => { setPremium(true); setScreen("main"); }} onBack={() => setScreen("main")} />}
      </div>
    </div>
  );
}

function tokens(isDark) {
  return isDark
    ? {
        bg: "#131316",
        panel: "#1A1A1F",
        row: "#1F1F26",
        rowHover: "#26262F",
        border: "#2A2A33",
        text: "#EDEDF0",
        subtext: "#8A8A93",
        mono: "#C7C7D1",
        accent: "#7C5CFC",
        accentSoft: "rgba(124,92,252,0.14)",
        pinAccent: "#F0B347",
      }
    : {
        bg: "#F5F5F7",
        panel: "#FFFFFF",
        row: "#FAFAFB",
        rowHover: "#F0F0F3",
        border: "#E4E4E9",
        text: "#1C1C21",
        subtext: "#6B6B76",
        mono: "#3A3A42",
        accent: "#7C5CFC",
        accentSoft: "rgba(124,92,252,0.10)",
        pinAccent: "#B9791A",
      };
}

function MainApp({ t, isDark, theme, setTheme, premium, setPremium, onUpgrade, onClose }) {
  const [items, setItems] = useState(() =>
    seedItems.map((it, i) => ({
      id: i + 1,
      ...it,
      pinned: i === 1 || i === 5,
      label: i === 5 ? "Brand accent" : null,
    }))
  );
  const [query, setQuery] = useState("");
  const [maxItems, setMaxItems] = useState(50);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [labelDraftId, setLabelDraftId] = useState(null);
  const [labelDraftValue, setLabelDraftValue] = useState("");
  const [toast, setToast] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const labelInputRef = useRef(null);

  useEffect(() => {
    if (labelDraftId !== null && labelInputRef.current) labelInputRef.current.focus();
  }, [labelDraftId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1400);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items;
    if (q) list = list.filter((it) => it.content.toLowerCase().includes(q) || (it.label || "").toLowerCase().includes(q));
    return list.slice(0, maxItems);
  }, [items, query, maxItems]);

  const pinned = filtered.filter((i) => i.pinned);
  const recent = filtered.filter((i) => !i.pinned);

  function togglePin(id) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, pinned: !it.pinned } : it)));
  }

  function copyItem(content) {
    setToast("Copied to clipboard");
  }

  function openLabelEditor(it) {
    if (!premium) {
      setToast("Labels are a Premium feature");
      return;
    }
    setLabelDraftId(it.id);
    setLabelDraftValue(it.label || "");
  }

  function saveLabel(id) {
    const val = labelDraftValue.trim();
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, label: val || null } : it)));
    setLabelDraftId(null);
  }

  function clearAll() {
    setItems((prev) => prev.filter((it) => it.pinned)); // pinned survive clear-all, like Maccy
    setConfirmClear(false);
    setToast("History cleared");
  }

  // combined display order, used to assign quick-copy shortcut numbers (1-9)
  const combinedOrder = [...pinned, ...recent];
  const shortcutOf = {};
  combinedOrder.slice(0, 9).forEach((it, i) => (shortcutOf[it.id] = i + 1));

  return (
    <div
      style={{ background: t.bg, fontFamily: "'Inter', ui-sans-serif, system-ui" }}
      className="w-full min-h-[640px] flex items-center justify-center p-6"
    >
      <div
        style={{ background: t.panel, border: `1px solid ${t.border}`, width: 480 }}
        className="rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* header */}
        <div style={{ borderBottom: `1px solid ${t.border}` }} className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                style={{ background: t.accent }}
                className="w-6 h-6 rounded-md flex items-center justify-center"
              >
                <Clipboard size={13} color="#fff" strokeWidth={2.5} />
              </div>
              <span style={{ color: t.text }} className="text-[13px] font-semibold tracking-tight">DZClip</span>
              {premium ? (
                <span
                  style={{ background: t.accentSoft, color: t.accent }}
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1"
                >
                  <Sparkles size={9} /> PREMIUM
                </span>
              ) : (
                <button
                  onClick={onUpgrade}
                  style={{ background: t.accent, color: "#fff" }}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 hover:opacity-90"
                >
                  <Sparkles size={9} /> Upgrade
                </button>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setSettingsOpen((s) => !s)}
                style={{ color: t.subtext }}
                className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                aria-label="Settings"
              >
                <Settings size={15} />
              </button>
              <button
                onClick={onClose}
                style={{ color: t.subtext }}
                className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                aria-label="Close"
                title="Close window"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div
            style={{ background: t.row, border: `1px solid ${t.border}` }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
          >
            <Search size={13} style={{ color: t.subtext }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clipboard history…"
              style={{ color: t.text, background: "transparent" }}
              className="flex-1 text-[12.5px] outline-none placeholder:opacity-50"
            />
            {query && (
              <button onClick={() => setQuery("")} style={{ color: t.subtext }}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* settings drawer */}
        {settingsOpen && (
          <div style={{ borderBottom: `1px solid ${t.border}`, background: t.row }} className="px-4 py-3.5 flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <span style={{ color: t.text }} className="text-[12px] font-medium">Theme</span>
              <div style={{ border: `1px solid ${t.border}`, background: t.panel }} className="flex rounded-lg p-0.5">
                <button
                  onClick={() => setTheme("dark")}
                  style={{ background: isDark ? t.accent : "transparent", color: isDark ? "#fff" : t.subtext }}
                  className="px-2 py-1 rounded-md text-[11px] flex items-center gap-1 transition-colors"
                >
                  <Moon size={11} /> Dark
                </button>
                <button
                  onClick={() => setTheme("light")}
                  style={{ background: !isDark ? t.accent : "transparent", color: !isDark ? "#fff" : t.subtext }}
                  className="px-2 py-1 rounded-md text-[11px] flex items-center gap-1 transition-colors"
                >
                  <Sun size={11} /> Light
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span style={{ color: t.text }} className="text-[12px] font-medium">Max items kept</span>
              <div className="relative">
                <select
                  value={maxItems}
                  onChange={(e) => setMaxItems(Number(e.target.value))}
                  style={{ background: t.panel, border: `1px solid ${t.border}`, color: t.text }}
                  className="text-[11px] pl-2.5 pr-6 py-1.5 rounded-lg appearance-none outline-none"
                >
                  <option value={25}>25 items</option>
                  <option value={50}>50 items</option>
                  <option value={100}>100 items</option>
                  <option value={9999} disabled={!premium}>
                    Unlimited {!premium ? "(Premium)" : ""}
                  </option>
                </select>
                <ChevronDown size={11} style={{ color: t.subtext }} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span style={{ color: t.text }} className="text-[12px] font-medium block">Premium</span>
                <span style={{ color: t.subtext }} className="text-[10.5px]">Labels, unlimited history, sync</span>
              </div>
              <button
                onClick={() => setPremium((p) => !p)}
                style={{ background: premium ? t.accent : t.border }}
                className="w-9 h-5 rounded-full relative transition-colors"
              >
                <span
                  style={{ left: premium ? 18 : 2, background: "#fff" }}
                  className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                />
              </button>
            </div>

            <div style={{ borderTop: `1px solid ${t.border}` }} className="pt-3 flex items-center justify-between">
              <span style={{ color: t.subtext }} className="text-[10.5px]">{items.length} items stored · pinned items are kept</span>
              {!confirmClear ? (
                <button
                  onClick={() => setConfirmClear(true)}
                  style={{ color: "#E05A5A" }}
                  className="text-[11px] font-medium flex items-center gap-1 hover:opacity-75"
                >
                  <Trash2 size={11} /> Clear all
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span style={{ color: t.subtext }} className="text-[10.5px]">Sure?</span>
                  <button onClick={clearAll} style={{ color: "#E05A5A" }} className="text-[11px] font-semibold">Yes</button>
                  <button onClick={() => setConfirmClear(false)} style={{ color: t.subtext }} className="text-[11px]">No</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* list */}
        <div className="max-h-[420px] overflow-y-auto py-2">
          {pinned.length > 0 && (
            <SectionLabel text="Pinned" t={t} />
          )}
          {pinned.map((it) => (
            <Row
              key={it.id}
              it={it}
              t={t}
              premium={premium}
              shortcut={shortcutOf[it.id]}
              onCopy={copyItem}
              onTogglePin={togglePin}
              onOpenLabel={openLabelEditor}
              editing={labelDraftId === it.id}
              labelDraftValue={labelDraftValue}
              setLabelDraftValue={setLabelDraftValue}
              saveLabel={saveLabel}
              labelInputRef={labelInputRef}
            />
          ))}

          {recent.length > 0 && (
            <SectionLabel text="Recent" t={t} />
          )}
          {recent.map((it) => (
            <Row
              key={it.id}
              it={it}
              t={t}
              premium={premium}
              shortcut={shortcutOf[it.id]}
              onCopy={copyItem}
              onTogglePin={togglePin}
              onOpenLabel={openLabelEditor}
              editing={labelDraftId === it.id}
              labelDraftValue={labelDraftValue}
              setLabelDraftValue={setLabelDraftValue}
              saveLabel={saveLabel}
              labelInputRef={labelInputRef}
            />
          ))}

          {filtered.length === 0 && (
            <div className="py-10 text-center">
              <span style={{ color: t.subtext }} className="text-[12px]">No matches for "{query}"</span>
            </div>
          )}
        </div>

        {/* toast */}
        {toast && (
          <div className="px-4 pb-3 pt-0">
            <div
              style={{ background: t.accentSoft, color: t.accent }}
              className="text-[11px] font-medium px-3 py-2 rounded-lg flex items-center gap-1.5"
            >
              <Check size={12} /> {toast}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ text, t }) {
  return (
    <div style={{ color: t.subtext }} className="text-[10px] font-semibold tracking-wide uppercase px-4 pt-2 pb-1">
      {text}
    </div>
  );
}

function Row({ it, t, premium, shortcut, onCopy, onTogglePin, onOpenLabel, editing, labelDraftValue, setLabelDraftValue, saveLabel, labelInputRef }) {
  const [hover, setHover] = useState(false);
  const src = SOURCES[it.app];

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="mx-2 rounded-lg px-2.5 py-2 mb-0.5 cursor-pointer group transition-colors"
      style={{ background: hover ? t.rowHover : "transparent" }}
      onClick={() => onCopy(it.content)}
    >
      <div className="flex items-start gap-2.5">
        <div
          style={{ color: src.color }}
          className="text-[13px] leading-[18px] w-4 flex-shrink-0 text-center pt-[1px]"
          title={src.label}
        >
          {src.glyph}
        </div>

        <div className="flex-1 min-w-0">
          <div
            style={{ color: t.mono, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
            className="text-[12px] leading-[17px] truncate"
          >
            {it.content}
          </div>

          <div className="flex items-center gap-1.5 mt-0.5">
            <span style={{ color: t.subtext }} className="text-[10px]">{src.label} · {timeAgo(it.minsAgo)}</span>

            {it.label && !editing && (
              <span
                style={{ background: t.accentSoft, color: t.accent }}
                className="text-[9.5px] font-medium px-1.5 py-[1px] rounded"
              >
                {it.label}
              </span>
            )}
          </div>

          {editing && (
            <div className="mt-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                ref={labelInputRef}
                value={labelDraftValue}
                onChange={(e) => setLabelDraftValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveLabel(it.id)}
                onBlur={() => saveLabel(it.id)}
                placeholder="Add a label…"
                style={{ background: t.panel, border: `1px solid ${t.accent}`, color: t.text }}
                className="text-[10.5px] px-2 py-1 rounded-md outline-none w-32"
              />
            </div>
          )}
        </div>

        {/* hover actions */}
        <div
          className="flex items-center gap-1 flex-shrink-0"
          style={{ opacity: hover ? 1 : 0, transition: "opacity 120ms" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onOpenLabel(it)}
            title={premium ? "Add label" : "Labels are Premium"}
            style={{ color: premium ? t.subtext : t.subtext }}
            className="p-1 rounded-md hover:bg-white/10 relative"
          >
            <Tag size={12} />
            {!premium && (
              <Lock size={7} style={{ color: t.pinAccent }} className="absolute -top-0.5 -right-0.5" />
            )}
          </button>
          <button
            onClick={() => onTogglePin(it.id)}
            title={it.pinned ? "Unpin" : "Pin"}
            style={{ color: it.pinned ? t.pinAccent : t.subtext }}
            className="p-1 rounded-md hover:bg-white/10"
          >
            {it.pinned ? <PinOff size={12} /> : <Pin size={12} />}
          </button>
        </div>

        {/* quick-copy shortcut, always visible for the first 9 items */}
        {shortcut && (
          <div
            style={{ borderColor: t.border, color: t.subtext, background: hover ? t.panel : "transparent" }}
            className="flex-shrink-0 text-[9.5px] font-medium px-1.5 py-0.5 rounded border font-mono"
            title={`Press ⌘${shortcut} (Mac) or Ctrl+${shortcut} (Windows) to copy`}
          >
            ⌘{shortcut}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- onboarding ----------------------------------------------------------

const ONBOARDING_STEPS = [
  {
    kicker: "Welcome",
    title: "Never lose what you copy",
    body: "DZClip quietly keeps a history of everything you copy, so the thing you cut ten minutes ago is still one shortcut away.",
  },
  {
    kicker: "One permission",
    title: "Let DZClip watch your clipboard",
    body: "This is the only permission we ask for. DZClip never reads your screen, keystrokes, or files — just what you explicitly copy.",
  },
  {
    kicker: "Your shortcut",
    title: "Set a key to open DZClip",
    body: "Pick a shortcut that's free on your system. You can always change it later in Settings.",
  },
];

function Onboarding({ t, isDark, onFinish }) {
  const [step, setStep] = useState(0);
  const last = step === ONBOARDING_STEPS.length - 1;
  const s = ONBOARDING_STEPS[step];

  return (
    <div style={{ background: t.panel, border: `1px solid ${t.border}`, width: 420 }} className="rounded-2xl shadow-2xl overflow-hidden">
      <div className="px-8 pt-10 pb-8 flex flex-col items-center text-center">
        <div style={{ background: t.accentSoft }} className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6">
          {step === 0 && <Clipboard size={24} style={{ color: t.accent }} />}
          {step === 1 && <Lock size={24} style={{ color: t.accent }} />}
          {step === 2 && <Settings size={24} style={{ color: t.accent }} />}
        </div>

        <span style={{ color: t.accent }} className="text-[10.5px] font-semibold tracking-wide uppercase mb-2">{s.kicker}</span>
        <h2 style={{ color: t.text }} className="text-[19px] font-semibold tracking-tight mb-2.5 leading-snug">{s.title}</h2>
        <p style={{ color: t.subtext }} className="text-[13px] leading-relaxed mb-7 max-w-[300px]">{s.body}</p>

        {step === 1 && (
          <div style={{ background: t.row, border: `1px solid ${t.border}` }} className="w-full flex items-center justify-between px-4 py-3 rounded-xl mb-1">
            <span style={{ color: t.text }} className="text-[12.5px] font-medium">Clipboard access</span>
            <span style={{ background: t.accent }} className="w-9 h-5 rounded-full relative">
              <span style={{ left: 18, background: "#fff" }} className="absolute top-0.5 w-4 h-4 rounded-full" />
            </span>
          </div>
        )}

        {step === 2 && (
          <div style={{ background: t.row, border: `1px dashed ${t.accent}` }} className="w-full flex items-center justify-center px-4 py-3 rounded-xl mb-1">
            <span style={{ color: t.text, fontFamily: "'JetBrains Mono', monospace" }} className="text-[13px] font-medium tracking-widest">⌘ ⇧ V</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-7">
          {ONBOARDING_STEPS.map((_, i) => (
            <span
              key={i}
              style={{ background: i === step ? t.accent : t.border, width: i === step ? 16 : 6 }}
              className="h-1.5 rounded-full transition-all"
            />
          ))}
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${t.border}` }} className="px-8 py-4 flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          style={{ color: t.subtext, opacity: step === 0 ? 0.35 : 1 }}
          disabled={step === 0}
          className="text-[12.5px] font-medium"
        >
          Back
        </button>
        <button
          onClick={() => (last ? onFinish() : setStep((s) => s + 1))}
          style={{ background: t.accent, color: "#fff" }}
          className="text-[12.5px] font-semibold px-4 py-2 rounded-lg hover:opacity-90"
        >
          {last ? "Start using DZClip" : "Continue"}
        </button>
      </div>
    </div>
  );
}

// ---- upgrade / paywall ----------------------------------------------------

const FEATURES = [
  { label: "Clipboard history", free: true, premium: true },
  { label: "Pin items", free: true, premium: true },
  { label: "Custom labels", free: false, premium: true },
  { label: "Unlimited history", free: false, premium: true },
  { label: "Sync across Mac & Windows", free: false, premium: true },
];

function Upgrade({ t, isDark, premium, onActivate, onBack }) {
  const [billing, setBilling] = useState("annual");

  return (
    <div style={{ background: t.panel, border: `1px solid ${t.border}`, width: 460 }} className="rounded-2xl shadow-2xl overflow-hidden">
      <div className="px-7 pt-7 pb-1 flex items-start justify-between">
        <div>
          <span style={{ color: t.accent }} className="text-[10.5px] font-semibold tracking-wide uppercase">Upgrade</span>
          <h2 style={{ color: t.text }} className="text-[19px] font-semibold tracking-tight mt-1">Keep more, find it faster</h2>
        </div>
        <button onClick={onBack} style={{ color: t.subtext }} className="p-1.5 rounded-md hover:bg-white/5">
          <X size={16} />
        </button>
      </div>

      <div className="px-7 pt-4">
        <div style={{ background: t.row, border: `1px solid ${t.border}` }} className="flex rounded-lg p-1 mb-5">
          <button
            onClick={() => setBilling("monthly")}
            style={{ background: billing === "monthly" ? t.accent : "transparent", color: billing === "monthly" ? "#fff" : t.subtext }}
            className="flex-1 text-[12px] font-medium py-1.5 rounded-md transition-colors"
          >
            Monthly · $4.99
          </button>
          <button
            onClick={() => setBilling("annual")}
            style={{ background: billing === "annual" ? t.accent : "transparent", color: billing === "annual" ? "#fff" : t.subtext }}
            className="flex-1 text-[12px] font-medium py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-colors"
          >
            Annual · $39.99
            <span style={{ background: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)", color: billing === "annual" ? "#fff" : t.accent }} className="text-[9px] font-semibold px-1.5 py-[1px] rounded-full">
              −33%
            </span>
          </button>
        </div>

        <div style={{ border: `1px solid ${t.border}` }} className="rounded-xl overflow-hidden mb-6">
          <div className="grid grid-cols-[1fr,64px,64px]">
            <div style={{ background: t.row, borderBottom: `1px solid ${t.border}` }} className="px-3.5 py-2" />
            <div style={{ background: t.row, borderBottom: `1px solid ${t.border}` }} className="px-2 py-2 text-center">
              <span style={{ color: t.subtext }} className="text-[10px] font-semibold uppercase">Free</span>
            </div>
            <div style={{ background: t.accentSoft, borderBottom: `1px solid ${t.border}` }} className="px-2 py-2 text-center">
              <span style={{ color: t.accent }} className="text-[10px] font-semibold uppercase">Premium</span>
            </div>

            {FEATURES.map((f, i) => (
              <React.Fragment key={f.label}>
                <div style={{ borderBottom: i < FEATURES.length - 1 ? `1px solid ${t.border}` : "none" }} className="px-3.5 py-2.5">
                  <span style={{ color: t.text }} className="text-[12px]">{f.label}</span>
                </div>
                <div style={{ borderBottom: i < FEATURES.length - 1 ? `1px solid ${t.border}` : "none" }} className="flex items-center justify-center py-2.5">
                  {f.free ? <Check size={13} style={{ color: t.subtext }} /> : <span style={{ color: t.border }}>—</span>}
                </div>
                <div style={{ background: t.accentSoft, borderBottom: i < FEATURES.length - 1 ? `1px solid ${t.border}` : "none" }} className="flex items-center justify-center py-2.5">
                  {f.premium ? <Check size={13} style={{ color: t.accent }} /> : <span style={{ color: t.border }}>—</span>}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${t.border}` }} className="px-7 py-4 flex items-center justify-between">
        <button onClick={onBack} style={{ color: t.subtext }} className="text-[12.5px] font-medium">
          Maybe later
        </button>
        <button
          onClick={onActivate}
          disabled={premium}
          style={{ background: t.accent, color: "#fff", opacity: premium ? 0.5 : 1 }}
          className="text-[12.5px] font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 hover:opacity-90"
        >
          <Sparkles size={12} /> {premium ? "Already Premium" : "Start free trial"}
        </button>
      </div>
    </div>
  );
}
