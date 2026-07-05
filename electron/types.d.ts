export type ClipItemType = "text" | "image" | "file";

export interface ClipItem {
  id: string;
  /** "text" for plain/rich text, "image" for bitmap, "file" for copied file paths */
  type: ClipItemType;
  /** For text: the string. For image: a PNG data URL. For file: newline-joined paths. */
  content: string;
  /** Optional rich-text HTML captured alongside plain text (best-effort). */
  html?: string | null;
  /** Image metadata, present only when type === "image". */
  image?: { width: number; height: number } | null;
  /** Source app key (e.g. "chrome") or a raw app name; "unknown" if undetected. */
  app: string;
  /** Last time this content was copied. */
  timestamp: number;
  /** First time this content was seen. */
  firstCopyAt: number;
  /** How many times this exact content has been copied. */
  numberOfCopies: number;
  pinned: boolean;
  label: string | null;
  /** User-editable display title (Pins tab). */
  title?: string | null;
  /** Optional global hotkey (Electron accelerator) to copy this pinned item. */
  hotkey?: string | null;
}

export type SearchMode = "exact" | "fuzzy" | "regexp";
export type SortBy = "lastCopy" | "firstCopy" | "numberOfCopies";
export type PopupAt = "cursor" | "center" | "tray";
export type PinTo = "top" | "bottom";
export type HighlightMatches = "bold" | "underline" | "italic" | "none";

export interface Settings {
  theme: "dark" | "light";
  hasOnboarded: boolean;

  // General
  autoLaunch: boolean;
  checkForUpdatesAutomatically: boolean;
  shortcut: string; // global open/close accelerator
  pinShortcut: string; // in-panel: pin/unpin highlighted (accelerator)
  deleteShortcut: string; // in-panel: delete highlighted (accelerator)
  searchMode: SearchMode;
  pasteAutomatically: boolean;
  pasteWithoutFormatting: boolean;

  // Storage
  saveFiles: boolean;
  saveImages: boolean;
  saveText: boolean;
  maxItems: number; // "Size"
  sortBy: SortBy;

  // Appearance
  popupAt: PopupAt;
  pinTo: PinTo;
  imageHeight: number;
  previewDelay: number;
  highlightMatches: HighlightMatches;
  showSpecialSymbols: boolean;
  showApplicationIcons: boolean;
  showSearchField: boolean;
  showTitleBeforeSearch: boolean;
  showFooter: boolean;
  showRecentInTray: boolean;

  // Ignore
  ignoreApps: string[];
  ignoreTypes: string[];
  ignoreRegexes: string[];

  // Advanced
  turnOff: boolean;
  clearHistoryOnQuit: boolean;
  clearSystemClipboardToo: boolean;
}

export interface StorageInfo {
  bytes: number;
  count: number;
}

export interface DZClipBridge {
  getHistory(): Promise<ClipItem[]>;
  getSettings(): Promise<Settings>;
  setSettings(partial: Partial<Settings>): Promise<Settings>;
  togglePin(id: string): Promise<ClipItem[]>;
  setLabel(id: string, label: string | null): Promise<ClipItem[]>;
  updatePinned(id: string, patch: { title?: string | null; content?: string; hotkey?: string | null }): Promise<ClipItem[]>;
  removeItem(id: string): Promise<ClipItem[]>;
  clearAll(): Promise<ClipItem[]>;
  copyItem(item: Pick<ClipItem, "type" | "content">): Promise<boolean>;
  hideWindow(): Promise<boolean>;
  openPreferences(): Promise<boolean>;
  getPlatform(): Promise<string>;
  getStorageInfo(): Promise<StorageInfo>;
  checkForUpdates(): Promise<{ status: string }>;
  quitApp(): Promise<void>;
  onHistoryUpdated(callback: (items: ClipItem[]) => void): () => void;
  onSettingsUpdated(callback: (settings: Settings) => void): () => void;
}

declare global {
  interface Window {
    clipvault: DZClipBridge;
  }
}
