import React, { useState } from "react";
import { Clipboard, Lock, Settings as SettingsIcon, Keyboard } from "lucide-react";
import type { Tokens } from "../theme";
import { formatAccelerator } from "../utils";

const STEPS = [
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
    title: "Open DZClip anytime with",
    body: "You can change this later in Settings if it conflicts with another app.",
  },
  {
    kicker: "Power up",
    title: "Everything is a keystroke away",
    body: "Once the panel is open, drive it entirely from the keyboard — no mouse needed. This legend also lives in Settings.",
  },
];

export default function Onboarding({
  t,
  isMac,
  shortcut,
  onFinish,
  onClose,
}: {
  t: Tokens;
  isMac: boolean;
  shortcut: string;
  onFinish: () => void;
  onClose?: () => void;
}) {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const s = STEPS[step];
  const shortcutLabel = formatAccelerator(shortcut, isMac);
  const mod = isMac ? "⌘" : "Ctrl";

  const SHORTCUTS = [
    { keys: [mod, "⇧", "V"], label: "Open / close panel" },
    { keys: ["↑", "↓"], label: "Navigate items" },
    { keys: ["↵"], label: "Copy highlighted" },
    { keys: [mod, "1–9"], label: "Quick-copy" },
    { keys: [mod, "P"], label: "Pin / unpin" },
    { keys: [mod, "E"], label: "Edit label" },
    { keys: [mod, "⌫"], label: "Delete item" },
    { keys: ["Esc"], label: "Clear / close" },
  ];

  return (
    <div style={{ background: t.panel, border: `1px solid ${t.border}` }} className="w-full h-full rounded-2xl shadow-2xl overflow-hidden flex flex-col">
      <div className="px-8 pt-10 pb-6 flex-1 flex flex-col items-center text-center justify-center overflow-y-auto">
        <div style={{ background: t.accentSoft }} className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6">
          {step === 0 && <Clipboard size={24} style={{ color: t.accent }} />}
          {step === 1 && <Lock size={24} style={{ color: t.accent }} />}
          {step === 2 && <SettingsIcon size={24} style={{ color: t.accent }} />}
          {step === 3 && <Keyboard size={24} style={{ color: t.accent }} />}
        </div>

        <span style={{ color: t.accent }} className="text-[10.5px] font-semibold tracking-wide uppercase mb-2">
          {s.kicker}
        </span>
        <h2 style={{ color: t.text }} className="text-[19px] font-semibold tracking-tight mb-2.5 leading-snug">
          {s.title}
        </h2>
        <p style={{ color: t.subtext }} className="text-[13px] leading-relaxed mb-6 max-w-[300px]">
          {s.body}
        </p>

        {step === 1 && (
          <div style={{ background: t.row, border: `1px solid ${t.border}` }} className="w-full flex items-center justify-between px-4 py-3 rounded-xl mb-1">
            <span style={{ color: t.text }} className="text-[12.5px] font-medium">
              Clipboard access
            </span>
            <span style={{ background: t.accent }} className="w-9 h-5 rounded-full relative">
              <span style={{ left: 18, background: "#fff" }} className="absolute top-0.5 w-4 h-4 rounded-full" />
            </span>
          </div>
        )}

        {step === 2 && (
          <div style={{ background: t.row, border: `1px dashed ${t.accent}` }} className="w-full flex items-center justify-center px-4 py-3 rounded-xl mb-1">
            <span style={{ color: t.text }} className="font-mono text-[13px] font-medium tracking-widest">
              {shortcutLabel}
            </span>
          </div>
        )}

        {step === 3 && (
          <div style={{ background: t.row, border: `1px solid ${t.border}` }} className="w-full rounded-xl px-4 py-3 mb-1">
            <div className="flex flex-col gap-2">
              {SHORTCUTS.map((sc) => (
                <div key={sc.label} className="flex items-center justify-between gap-3">
                  <span style={{ color: t.subtext }} className="text-[11.5px]">
                    {sc.label}
                  </span>
                  <span className="flex items-center gap-0.5 flex-shrink-0">
                    {sc.keys.map((k, i) => (
                      <kbd
                        key={i}
                        style={{ background: t.panel, border: `1px solid ${t.border}`, color: t.text }}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded min-w-[18px] text-center"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-6">
          {STEPS.map((_, i) => (
            <span key={i} style={{ background: i === step ? t.accent : t.border, width: i === step ? 16 : 6 }} className="h-1.5 rounded-full transition-all" />
          ))}
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${t.border}` }} className="px-8 py-4 flex items-center justify-between">
        <button
          onClick={() => (step === 0 && onClose ? onClose() : setStep((v) => Math.max(0, v - 1)))}
          style={{ color: t.subtext, opacity: step === 0 && !onClose ? 0.35 : 1 }}
          disabled={step === 0 && !onClose}
          className="text-[12.5px] font-medium"
        >
          {step === 0 && onClose ? "Close" : "Back"}
        </button>
        <button
          onClick={() => (last ? onFinish() : setStep((v) => v + 1))}
          style={{ background: t.accent, color: "#fff" }}
          className="text-[12.5px] font-semibold px-4 py-2 rounded-lg hover:opacity-90"
        >
          {last ? "Start using DZClip" : "Continue"}
        </button>
      </div>
    </div>
  );
}
