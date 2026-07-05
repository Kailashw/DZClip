# DZClip

A cross-platform (macOS + Windows) **menu-bar / tray clipboard history manager**. Electron + React + TypeScript renderer, plain-JS Electron main process, local persistence via `electron-store`. On macOS it runs as a menu-bar-only app (no Dock icon, via `LSUIElement`).

---

## 🚀 Quick Download

Select the package that matches your operating system and architecture below to download the latest executable:

| Operating System | Architecture | Download Link |
| :--- | :--- | :--- |
| **Windows** | 64-bit (x64) | [Download for Windows](https://github.com/Kailashw/DZClip/releases/download/v1.0.0/dzclip-windows-amd64.exe) |
| **macOS** | Intel (x64) / Apple Silicon (M1/M2/M3) | [Download for macOS](https://github.com/Kailashw/DZClip/releases/download/v1.0.0/dzclip-darwin.dmg) |
| **Linux** | 64-bit (x64) | [Download for Linux](https://github.com/Kailashw/DZClip/releases/download/v1.0.0/dzclip-linux-amd64.tar.gz) |

> 💡 *Note: If you are on macOS and encounter a "Developer Cannot be Verified" warning, you can bypass it by right-clicking the app, selecting **Open**, and confirming.*

---

## What's implemented

- **Clipboard history** — polls the system clipboard every 600ms, dedupes (bumping a per-item copy count), stores locally
- **Text, image & file capture** — plain text (with best-effort rich-text HTML), bitmaps (thumbnailed, downscaled to 1600px, copyable back), and copied file paths. Each type can be toggled in Preferences → Storage.
- **Source-app detection** — dependency-light: shells out to `osascript` (macOS) / PowerShell (Windows) on a slow interval to tag items with the app they were copied from, mapping known apps (Chrome, VS Code, Terminal, Slack, Figma, Mail) to icons and keeping raw names for the rest.
- **Pin** — pinned items survive "Clear all"; group can sit at the top or bottom (Preferences → Appearance). Pins can get a friendly title and an optional **global hotkey** to copy them from anywhere.
- **Labels** — free, tag any item; searchable.
- **Delete** — per-item (hover trash, or keyboard).
- **Search modes** — Exact (substring), Fuzzy (subsequence), or Regular expression, with match highlighting (bold/underline/italic).
- **Keyboard UX** — open/close with the global shortcut, then ↑/↓ navigate, Enter copies, ⌘/Ctrl + 1–9 quick-copy the first nine, configurable Pin & Delete keys, ⌘/Ctrl + E to edit a label, Esc to clear/close. A legend lives in the in-app guide (the ? button).
- **Preferences window** — a standalone tabbed window (General, Storage, Appearance, Pins, Ignore, Advanced) opened from the tray menu, the panel's gear, or ⌘, — mirroring a Maccy-style layout:
  - **General** — launch at login, check-for-updates (stub), Open/Pin/Delete shortcuts, search mode, paste-automatically & paste-without-formatting.
  - **Storage** — which types to save, max size, storage bytes, sort by last copy / first copy / number of copies.
  - **Appearance** — theme, popup position (cursor / center / menu-bar), pin placement, image height, preview delay, highlight style, and show/hide toggles (app icons, search field, title, footer, special symbols, recent-in-tray).
  - **Pins** — table to edit each pin's hotkey, title, and (text) content.
  - **Ignore** — skip copies by application, pasteboard type, or regular expression.
  - **Advanced** — temporarily turn capture off, clear history on quit, and optionally clear the system clipboard too.
- **Paste automatically** — after picking an item, best-effort types ⌘/Ctrl+V into the previous app (macOS needs Accessibility permission).
- **System tray** with quick actions and real bundled icons (mac uses a monochrome template image); optional recent-copy label next to the icon.
- **App icons** — generated `.icns` / `.ico` / `.png` in `build/`, wired into `electron-builder`.
- **Onboarding guide** — first-run walkthrough + reopenable from the ? button, including the shortcut legend.

## Project structure

```
clipvault/
├─ electron/
│  ├─ main.js        # window, tray, global shortcut, clipboard polling, IPC handlers
│  ├─ preload.js      # contextBridge — the only surface the renderer can call
│  └─ types.d.ts       # shared ClipItem / Settings / bridge types
├─ src/
│  ├─ App.tsx           # routes onboarding → main panel
│  ├─ main.tsx          # entry; renders the panel, or Preferences on the #prefs hash
│  ├─ components/
│  │  ├─ MainApp.tsx    # the history panel, wired to window.clipvault
│  │  ├─ Preferences.tsx # the tabbed Preferences window
│  │  ├─ Row.tsx
│  │  ├─ SectionLabel.tsx
│  │  └─ Onboarding.tsx  # first-run guide + shortcut legend
│  ├─ theme.ts           # dark/light token maps
│  └─ utils.ts            # source-app metadata, search, accelerators
├─ index.html
└─ vite.config.ts
```

## Setup

Requires Node 18+.

```bash
npm install
```

This pulls in `electron` itself (a ~150MB download), so it needs an unrestricted network — it will fail in sandboxed/offline environments.

## Run in development

```bash
npm run dev
```

Starts the Vite dev server and launches Electron pointed at it, with hot reload on the renderer.

## Build for distribution

```bash
npm run dist:mac    # → dist/ .dmg
npm run dist:win    # → dist/ .exe (nsis installer)
```

Uses `electron-builder`, configured in `package.json`. You'll want to add real app icons before shipping — see "Known limitations" below.

## Known limitations / next steps

1. **No payment/licensing yet.** Premium gating has been removed for now — every feature is available. A payment/licensing flow (e.g. Stripe/RevenueCat, verified in the main process) can be added later.
2. **Auto-update is a stub.** "Check for updates" and its toggle exist in Preferences → General, but no release feed is wired. Add `electron-updater` + a published feed to make it live.
3. **Clipboard change detection is polling-based** (600ms), not event-based. Imperceptible in practice; a native listener could replace `startClipboardWatcher()` in `main.js` without touching the renderer.
4. **Source-app detection is best-effort.** It shells out to the OS on a ~1.5s interval and tags new items with the most recently seen frontmost app, so a very fast copy right after switching apps could occasionally be mislabeled. This also drives the app-based Ignore rule. A native addon (e.g. `active-win`) would be exact but pulls in compiled deps.
5. **"Paste automatically" and file capture are best-effort.** Auto-paste simulates ⌘/Ctrl+V via `osascript`/`SendKeys` and needs Accessibility permission on macOS. File capture reads clipboard file URLs where the OS exposes them; copying a file item back writes its path as text.
6. **Pasteboard-type Ignore** matches against Electron's `clipboard.availableFormats()`, which is a smaller set than native UTIs, so some app-specific types may not be detectable.
