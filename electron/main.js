const { app, BrowserWindow, Tray, Menu, globalShortcut, clipboard, ipcMain, screen, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const Store = require("electron-store");

// ---- defaults / store -------------------------------------------------
const DEFAULT_SHORTCUT = process.platform === "darwin" ? "Command+Shift+V" : "Control+Shift+V";

const DEFAULT_SETTINGS = {
  theme: "dark",
  hasOnboarded: false,

  // General
  autoLaunch: false,
  checkForUpdatesAutomatically: false,
  shortcut: DEFAULT_SHORTCUT,
  pinShortcut: "Alt+P",
  deleteShortcut: "Alt+Backspace",
  searchMode: "exact",
  pasteAutomatically: false,
  pasteWithoutFormatting: false,

  // Storage
  saveFiles: true,
  saveImages: true,
  saveText: true,
  maxItems: 200,
  sortBy: "lastCopy",

  // Appearance
  popupAt: "tray",
  pinTo: "top",
  imageHeight: 40,
  previewDelay: 1500,
  highlightMatches: "bold",
  showSpecialSymbols: true,
  showApplicationIcons: true,
  showSearchField: true,
  showTitleBeforeSearch: true,
  showFooter: true,
  showRecentInTray: false,

  // Ignore
  ignoreApps: [],
  ignoreTypes: ["com.agilebits.onepassword", "com.typeit4me.clipping", "de.petermaurer.TransientPasteboardType", "net.antelle.keeweb"],
  ignoreRegexes: [],

  // Advanced
  turnOff: false,
  clearHistoryOnQuit: false,
  clearSystemClipboardToo: false,
};

const store = new Store({
  defaults: { items: [], settings: { ...DEFAULT_SETTINGS } },
});

function getSettings() {
  return { ...DEFAULT_SETTINGS, ...(store.get("settings") || {}) };
}
store.set("settings", getSettings()); // self-heal on startup

const MAX_CONTENT_LENGTH = 20000;
const MAX_IMAGE_DATAURL_LENGTH = 6_000_000;
const POLL_INTERVAL_MS = 600;
const FRONTMOST_POLL_MS = 1500;

let win = null;
let prefsWin = null;
let tray = null;
let currentSourceApp = "unknown";
let lastSeenText = safeReadText();
let lastSeenImageSig = imageSignature(safeReadImage());
let lastSeenFile = "";
let registeredAccelerators = [];

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function safeReadText() {
  try {
    return clipboard.readText();
  } catch {
    return "";
  }
}

// ---- migration --------------------------------------------------------
(function migrateItems() {
  const items = store.get("items") || [];
  let changed = false;
  const next = items.map((i) => {
    if (i.type && i.numberOfCopies && i.firstCopyAt) return i;
    changed = true;
    return {
      type: "text",
      html: i.html ?? null,
      image: i.image ?? null,
      firstCopyAt: i.firstCopyAt ?? i.timestamp ?? Date.now(),
      numberOfCopies: i.numberOfCopies ?? 1,
      title: i.title ?? null,
      hotkey: i.hotkey ?? null,
      ...i,
    };
  });
  if (changed) store.set("items", next);
})();

// ---- windows ----------------------------------------------------------

function createWindow() {
  const { workAreaSize } = screen.getPrimaryDisplay();
  win = new BrowserWindow({
    width: 480,
    height: 640,
    x: workAreaSize.width - 500,
    y: 60,
    show: false,
    frame: false,
    resizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    // A macOS "panel" floats over other apps and can take key focus without
    // fully activating our (accessory) app or switching Spaces.
    type: process.platform === "darwin" ? "panel" : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Overlay behavior: float above normal windows and appear on the CURRENT
  // Space (including over fullscreen apps), so opening the panel never jumps to
  // another Space / the desktop.
  //
  // skipTransformProcessType:true is the key bit for a menu-bar (accessory) app:
  // without it, Electron flips the app's activation policy from accessory to
  // regular and back when joining all Spaces, which yanks the screen to the
  // app's Space (revealing the desktop). Keeping the process type stable lets
  // the panel simply float over whatever is in front.
  win.setAlwaysOnTop(true, "screen-saver");
  if (process.platform === "darwin") {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
    win.setFullScreenable(false);
  }

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    win.loadURL(devServerUrl);
    win.once("ready-to-show", () => {
      showPanel();
      win.webContents.openDevTools({ mode: "detach" });
    });
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  win.on("blur", () => {
    if (!win.webContents.isDevToolsOpened()) win.hide();
  });
  win.on("close", (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      win.hide();
    }
  });
}

function createPreferencesWindow() {
  if (prefsWin && !prefsWin.isDestroyed()) {
    prefsWin.show();
    prefsWin.focus();
    return;
  }
  prefsWin = new BrowserWindow({
    width: 720,
    height: 640,
    resizable: true,
    minimizable: true,
    maximizable: false,
    title: "DZClip Preferences",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    prefsWin.loadURL(`${devServerUrl}#prefs`);
  } else {
    prefsWin.loadFile(path.join(__dirname, "..", "dist", "index.html"), { hash: "prefs" });
  }

  prefsWin.once("ready-to-show", () => prefsWin.show());
  prefsWin.on("closed", () => {
    prefsWin = null;
  });
}

function showPanel() {
  if (!win) return;
  positionWindow();
  // Re-assert overlay flags every show (Spaces membership can reset).
  if (process.platform === "darwin") {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
  }
  win.setAlwaysOnTop(true, "screen-saver");
  // As a non-activating panel, the window can become key and accept typing
  // WITHOUT activating the whole app — so we do NOT call app.focus({steal})
  // here, which is what was yanking the screen to the desktop.
  win.show();
  win.focus();
}

function toggleWindow() {
  if (!win) return;
  if (win.isVisible()) {
    win.hide();
  } else {
    showPanel();
  }
}

function positionWindow() {
  if (!win) return;
  const settings = getSettings();
  const winBounds = win.getBounds();

  if (settings.popupAt === "center") {
    const { workArea } = screen.getPrimaryDisplay();
    win.setPosition(
      Math.round(workArea.x + workArea.width / 2 - winBounds.width / 2),
      Math.round(workArea.y + workArea.height / 2 - winBounds.height / 2),
      false
    );
    return;
  }

  if (settings.popupAt === "cursor") {
    const pt = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(pt);
    const wa = display.workArea;
    let x = pt.x;
    let y = pt.y;
    x = Math.min(Math.max(wa.x, x), wa.x + wa.width - winBounds.width);
    y = Math.min(Math.max(wa.y, y), wa.y + wa.height - winBounds.height);
    win.setPosition(Math.round(x), Math.round(y), false);
    return;
  }

  // "tray" (default): near the menu bar / tray icon
  const trayBounds = tray ? tray.getBounds() : { x: 0, y: 0, width: 0, height: 0 };
  if (!trayBounds.width && !trayBounds.height) {
    const { workAreaSize } = screen.getPrimaryDisplay();
    win.setPosition(workAreaSize.width - winBounds.width - 20, 60, false);
    return;
  }
  const x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2);
  const y = process.platform === "darwin" ? Math.round(trayBounds.y + trayBounds.height) : Math.round(trayBounds.y - winBounds.height);
  win.setPosition(x, y, false);
}

// ---- tray -------------------------------------------------------------

function loadTrayIcon() {
  const assetsDir = path.join(__dirname, "assets");
  const candidates = process.platform === "darwin" ? ["trayTemplate.png", "tray.png", "icon.png"] : ["tray.png", "icon.png"];
  for (const name of candidates) {
    const img = nativeImage.createFromPath(path.join(assetsDir, name));
    if (!img.isEmpty()) {
      if (process.platform === "darwin" && name.startsWith("trayTemplate")) img.setTemplateImage(true);
      return img;
    }
  }
  return nativeImage.createFromDataURL(FALLBACK_ICON_DATA_URL);
}

function createTray() {
  tray = new Tray(loadTrayIcon());
  tray.setToolTip("DZClip");
  rebuildTrayMenu();
  tray.on("click", toggleWindow);
}

function rebuildTrayMenu() {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: "Open DZClip", click: toggleWindow },
    { label: "Preferences…", accelerator: "CommandOrControl+,", click: createPreferencesWindow },
    { type: "separator" },
    {
      label: "Clear History",
      click: () => {
        const items = store.get("items").filter((i) => i.pinned);
        store.set("items", items);
        broadcastHistory();
      },
    },
    { type: "separator" },
    {
      label: "Quit DZClip",
      click: () => {
        app.isQuiting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
}

function updateTrayTitle() {
  if (!tray) return;
  const settings = getSettings();
  if (!settings.showRecentInTray) {
    tray.setTitle("");
    return;
  }
  const items = getVisibleItems();
  const recent = items.find((i) => i.type === "text");
  const text = recent ? recent.content.replace(/\s+/g, " ").slice(0, 20) : "";
  tray.setTitle(text ? ` ${text}` : "");
}

const FALLBACK_ICON_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKUlEQVR4AWNgGAWjYBSMAggYGRj+M+AAjNgFGRkYQZgJmwJGmARM4SgYPgAAOd0BJfk3vsAAAAAASUVORK5CYII=";

// ---- source-app detection --------------------------------------------

function detectFrontmostApp() {
  return new Promise((resolve) => {
    let cmd = null;
    if (process.platform === "darwin") {
      cmd = `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`;
    } else if (process.platform === "win32") {
      cmd =
        'powershell -NoProfile -Command "' +
        "Add-Type 'using System;using System.Runtime.InteropServices;public class W{[DllImport(\\\"user32.dll\\\")]public static extern IntPtr GetForegroundWindow();[DllImport(\\\"user32.dll\\\")]public static extern int GetWindowThreadProcessId(IntPtr h,out int p);}';" +
        "$h=[W]::GetForegroundWindow();$pid=0;[void][W]::GetWindowThreadProcessId($h,[ref]$pid);" +
        '(Get-Process -Id $pid).ProcessName"';
    } else {
      resolve("unknown");
      return;
    }
    exec(cmd, { timeout: 1200, windowsHide: true }, (err, stdout) => {
      if (err || !stdout) return resolve("unknown");
      resolve(normalizeAppName(stdout.trim()));
    });
  });
}

function normalizeAppName(raw) {
  if (!raw) return "unknown";
  const n = raw.toLowerCase();
  const map = [
    [["google chrome", "chrome", "chromium"], "chrome"],
    [["code", "visual studio code", "vscode", "code - insiders"], "vscode"],
    [["terminal", "iterm", "iterm2", "windowsterminal", "wt", "powershell", "cmd", "conhost"], "terminal"],
    [["slack"], "slack"],
    [["figma"], "figma"],
    [["mail", "outlook", "airmail", "spark"], "mail"],
  ];
  for (const [aliases, key] of map) {
    if (aliases.some((a) => n === a || n.includes(a))) return key;
  }
  if (n.includes("clipvault") || n.includes("electron")) return currentSourceApp;
  return raw;
}

function startFrontmostWatcher() {
  const tick = async () => {
    const appName = await detectFrontmostApp();
    if (appName && appName !== "unknown") currentSourceApp = appName;
  };
  tick();
  setInterval(tick, FRONTMOST_POLL_MS);
}

// ---- clipboard reading helpers ---------------------------------------

function safeReadImage() {
  try {
    return clipboard.readImage();
  } catch {
    return null;
  }
}

function imageSignature(img) {
  if (!img || img.isEmpty()) return null;
  const { width, height } = img.getSize();
  let bytes = 0;
  try {
    bytes = img.toPNG().length;
  } catch {
    bytes = 0;
  }
  return `${width}x${height}:${bytes}`;
}

function capImageDataUrl(img) {
  const { width, height } = img.getSize();
  const maxEdge = 1600;
  let out = img;
  if (Math.max(width, height) > maxEdge) {
    const scale = maxEdge / Math.max(width, height);
    out = img.resize({ width: Math.round(width * scale), height: Math.round(height * scale), quality: "good" });
  }
  return { url: out.toDataURL(), size: out.getSize() };
}

function readClipboardFiles() {
  try {
    const formats = clipboard.availableFormats();
    if (formats.includes("public.file-url")) {
      const url = clipboard.read("public.file-url");
      if (url) return decodeURIComponent(url.replace(/^file:\/\//, ""));
    }
    if (formats.includes("text/uri-list")) {
      const u = clipboard.read("text/uri-list");
      if (u)
        return u
          .split(/\r?\n/)
          .filter(Boolean)
          .map((s) => decodeURIComponent(s.replace(/^file:\/\//, "")))
          .join("\n");
    }
  } catch {
    /* no-op */
  }
  return "";
}

// ---- ignore rules -----------------------------------------------------

function isIgnored(settings, text) {
  // by app
  if (settings.ignoreApps.some((a) => a && currentSourceApp.toLowerCase().includes(a.toLowerCase()))) return true;
  // by pasteboard type
  try {
    const formats = clipboard.availableFormats();
    if (settings.ignoreTypes.some((tpe) => tpe && formats.some((f) => f.includes(tpe)))) return true;
  } catch {
    /* no-op */
  }
  // by regex (text only)
  if (text) {
    for (const r of settings.ignoreRegexes) {
      if (!r) continue;
      try {
        if (new RegExp(r).test(text)) return true;
      } catch {
        /* invalid regex — ignore the rule */
      }
    }
  }
  return false;
}

// ---- capture ----------------------------------------------------------

function addItem(item) {
  const settings = getSettings();
  const items = store.get("items");

  const existing = items.find((i) => i.type === item.type && i.content === item.content);
  let next;
  if (existing) {
    // bump copy count + recency, keep pin/label/title/hotkey
    next = items.map((i) =>
      i === existing ? { ...i, timestamp: item.timestamp, numberOfCopies: (i.numberOfCopies || 1) + 1, app: item.app } : i
    );
  } else {
    next = [item, ...items];
  }

  const cap = settings.maxItems >= 9999 ? Infinity : settings.maxItems;
  const pinned = next.filter((i) => i.pinned);
  const unpinned = next.filter((i) => !i.pinned).sort((a, b) => b.timestamp - a.timestamp).slice(0, Math.max(0, cap - pinned.length));
  store.set("items", [...pinned, ...unpinned]);
  broadcastHistory();
  updateTrayTitle();
}

function startClipboardWatcher() {
  setInterval(() => {
    const settings = getSettings();
    if (settings.turnOff) return;

    // text
    const text = clipboard.readText();
    if (text && text !== lastSeenText) {
      lastSeenText = text;
      lastSeenImageSig = imageSignature(safeReadImage());
      if (settings.saveText && text.length <= MAX_CONTENT_LENGTH && !isIgnored(settings, text)) {
        let html = null;
        try {
          const h = clipboard.readHTML();
          if (h && h.length <= MAX_CONTENT_LENGTH) html = h;
        } catch {
          html = null;
        }
        const now = Date.now();
        addItem({
          id: genId(),
          type: "text",
          content: text,
          html,
          image: null,
          app: currentSourceApp,
          timestamp: now,
          firstCopyAt: now,
          numberOfCopies: 1,
          pinned: false,
          label: null,
          title: null,
          hotkey: null,
        });
      }
      return;
    }

    // files
    if (settings.saveFiles) {
      const files = readClipboardFiles();
      if (files && files !== lastSeenFile) {
        lastSeenFile = files;
        if (!isIgnored(settings, files)) {
          const now = Date.now();
          addItem({
            id: genId(),
            type: "file",
            content: files,
            html: null,
            image: null,
            app: currentSourceApp,
            timestamp: now,
            firstCopyAt: now,
            numberOfCopies: 1,
            pinned: false,
            label: null,
            title: null,
            hotkey: null,
          });
          return;
        }
      }
    }

    // images
    if (settings.saveImages) {
      const img = safeReadImage();
      const sig = imageSignature(img);
      if (sig && sig !== lastSeenImageSig) {
        lastSeenImageSig = sig;
        if (!isIgnored(settings, "")) {
          const { url, size } = capImageDataUrl(img);
          if (url && url.length <= MAX_IMAGE_DATAURL_LENGTH) {
            const now = Date.now();
            addItem({
              id: genId(),
              type: "image",
              content: url,
              html: null,
              image: { width: size.width, height: size.height },
              app: currentSourceApp,
              timestamp: now,
              firstCopyAt: now,
              numberOfCopies: 1,
              pinned: false,
              label: null,
              title: null,
              hotkey: null,
            });
          }
        }
      }
    }
  }, POLL_INTERVAL_MS);
}

// ---- ordering ---------------------------------------------------------

function sortComparator(sortBy) {
  if (sortBy === "firstCopy") return (a, b) => b.firstCopyAt - a.firstCopyAt;
  if (sortBy === "numberOfCopies") return (a, b) => (b.numberOfCopies || 0) - (a.numberOfCopies || 0);
  return (a, b) => b.timestamp - a.timestamp; // lastCopy
}

function getVisibleItems() {
  const settings = getSettings();
  return [...store.get("items")].sort(sortComparator(settings.sortBy));
}

function broadcastHistory() {
  const items = getVisibleItems();
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send("history-updated", items);
  }
}

function broadcastSettings() {
  const settings = getSettings();
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send("settings-updated", settings);
  }
}

// ---- shortcuts --------------------------------------------------------

function registerShortcuts() {
  for (const a of registeredAccelerators) {
    try {
      globalShortcut.unregister(a);
    } catch {
      /* no-op */
    }
  }
  registeredAccelerators = [];

  const settings = getSettings();

  const tryRegister = (accel, handler) => {
    if (!accel) return false;
    try {
      if (globalShortcut.register(accel, handler)) {
        registeredAccelerators.push(accel);
        return true;
      }
    } catch {
      /* invalid accelerator */
    }
    return false;
  };

  const openOk = tryRegister(settings.shortcut, toggleWindow) || tryRegister(DEFAULT_SHORTCUT, toggleWindow);

  // Per-pin global hotkeys → copy that item directly.
  for (const item of store.get("items")) {
    if (item.pinned && item.hotkey) {
      tryRegister(item.hotkey, () => writeItemToClipboard(item));
    }
  }
  return openOk;
}

function applyAutoLaunch(enabled) {
  if (!app.isPackaged) return;
  try {
    app.setLoginItemSettings({ openAtLogin: !!enabled, openAsHidden: true });
  } catch {
    /* no-op */
  }
}

// ---- copy / paste -----------------------------------------------------

function writeItemToClipboard(item) {
  const settings = getSettings();
  if (!item) return false;
  if (item.type === "image") {
    try {
      const img = nativeImage.createFromDataURL(item.content);
      lastSeenImageSig = imageSignature(img);
      clipboard.writeImage(img);
    } catch {
      return false;
    }
  } else {
    lastSeenText = item.content;
    if (!settings.pasteWithoutFormatting && item.html) {
      try {
        clipboard.write({ text: item.content, html: item.html });
      } catch {
        clipboard.writeText(item.content);
      }
    } else {
      clipboard.writeText(item.content);
    }
  }
  return true;
}

function simulatePaste() {
  const settings = getSettings();
  if (!settings.pasteAutomatically) return;
  // Give focus a moment to return to the previously-active app.
  setTimeout(() => {
    if (process.platform === "darwin") {
      exec(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`, { timeout: 1500 }, () => {});
    } else if (process.platform === "win32") {
      exec(`powershell -NoProfile -Command "$w=New-Object -ComObject WScript.Shell; $w.SendKeys('^v')"`, { timeout: 1500, windowsHide: true }, () => {});
    }
  }, 150);
}

// ---- IPC --------------------------------------------------------------

ipcMain.handle("get-history", () => getVisibleItems());
ipcMain.handle("get-settings", () => getSettings());

ipcMain.handle("set-settings", (_e, partial) => {
  const prev = getSettings();
  const next = { ...prev, ...partial };
  store.set("settings", next);

  if (partial.shortcut !== undefined || partial.pinShortcut !== undefined || partial.deleteShortcut !== undefined) registerShortcuts();
  if (partial.autoLaunch !== undefined && partial.autoLaunch !== prev.autoLaunch) applyAutoLaunch(next.autoLaunch);
  if (partial.showRecentInTray !== undefined) updateTrayTitle();
  if (partial.sortBy !== undefined) broadcastHistory();

  broadcastSettings();
  return next;
});

ipcMain.handle("toggle-pin", (_e, id) => {
  const items = store.get("items").map((i) => (i.id === id ? { ...i, pinned: !i.pinned } : i));
  store.set("items", items);
  registerShortcuts();
  broadcastHistory();
  return getVisibleItems();
});

ipcMain.handle("set-label", (_e, { id, label }) => {
  const items = store.get("items").map((i) => (i.id === id ? { ...i, label: label || null } : i));
  store.set("items", items);
  broadcastHistory();
  return getVisibleItems();
});

ipcMain.handle("update-pinned", (_e, { id, patch }) => {
  const items = store.get("items").map((i) => (i.id === id ? { ...i, ...patch } : i));
  store.set("items", items);
  registerShortcuts();
  broadcastHistory();
  return getVisibleItems();
});

ipcMain.handle("remove-item", (_e, id) => {
  store.set(
    "items",
    store.get("items").filter((i) => i.id !== id)
  );
  registerShortcuts();
  broadcastHistory();
  return getVisibleItems();
});

ipcMain.handle("clear-all", () => {
  store.set(
    "items",
    store.get("items").filter((i) => i.pinned)
  );
  broadcastHistory();
  return getVisibleItems();
});

ipcMain.handle("copy-item", (_e, item) => {
  const ok = writeItemToClipboard(item);
  if (win) win.hide();
  simulatePaste();
  return ok;
});

ipcMain.handle("hide-window", () => {
  if (win) win.hide();
  return true;
});

ipcMain.handle("open-preferences", () => {
  createPreferencesWindow();
  return true;
});

ipcMain.handle("get-platform", () => process.platform);

ipcMain.handle("get-storage-info", () => {
  let bytes = 0;
  try {
    bytes = fs.statSync(store.path).size;
  } catch {
    bytes = 0;
  }
  return { bytes, count: store.get("items").length };
});

ipcMain.handle("check-for-updates", () => {
  // No update feed wired yet — see README. This is a stub so the UI is complete.
  return { status: "You're on the latest version." };
});

ipcMain.handle("quit-app", () => {
  app.isQuiting = true;
  app.quit();
});

// ---- lifecycle --------------------------------------------------------

// Menu-bar-only app: no dock icon on macOS.
if (process.platform === "darwin" && app.dock) {
  try {
    app.dock.hide();
  } catch {
    /* no-op */
  }
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  startFrontmostWatcher();
  startClipboardWatcher();

  const settings = getSettings();
  registerShortcuts();
  applyAutoLaunch(settings.autoLaunch);
  updateTrayTitle();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  // Stay alive in the tray. Preferences window closing must not quit the app.
});

app.on("will-quit", () => {
  const settings = getSettings();
  if (settings.clearHistoryOnQuit) {
    store.set("items", store.get("items").filter((i) => i.pinned));
    if (settings.clearSystemClipboardToo) {
      try {
        clipboard.clear();
      } catch {
        /* no-op */
      }
    }
  }
  globalShortcut.unregisterAll();
});
