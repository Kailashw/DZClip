import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Trash2, Clipboard, Check, HelpCircle, Settings as SettingsIcon } from "lucide-react";
import type { Tokens } from "../theme";
import Row from "./Row";
import SectionLabel from "./SectionLabel";
import { matchesQuery, matchesAccelerator } from "../utils";
import type { ClipItem, Settings as AppSettings } from "../../electron/types";

interface MainAppProps {
  t: Tokens;
  isMac: boolean;
  settings: AppSettings;
  onSettingsChange: (partial: Partial<AppSettings>) => void;
  onGuide: () => void;
  onPreferences: () => void;
}

export default function MainApp({ t, isMac, settings, onSettingsChange, onGuide, onPreferences }: MainAppProps) {
  const [items, setItems] = useState<ClipItem[]>([]);
  const [query, setQuery] = useState("");
  const [labelDraftId, setLabelDraftId] = useState<string | null>(null);
  const [labelDraftValue, setLabelDraftValue] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const labelInputRef = useRef<HTMLInputElement>(null);

  const {
    searchMode,
    highlightMatches,
    imageHeight,
    showApplicationIcons,
    showSpecialSymbols,
    showSearchField,
    showTitleBeforeSearch,
    showFooter,
    pinTo,
    pinShortcut,
    deleteShortcut,
    maxItems,
  } = settings;

  useEffect(() => {
    window.clipvault.getHistory().then(setItems);
    const unsub = window.clipvault.onHistoryUpdated(setItems);
    return unsub;
  }, []);

  useEffect(() => {
    if (labelDraftId !== null) labelInputRef.current?.focus();
  }, [labelDraftId]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 1400);
    return () => clearTimeout(timer);
  }, [toast]);

  const filtered = useMemo(() => {
    let list = items;
    const q = query.trim();
    if (q) {
      list = list.filter(
        (i) =>
          (i.type === "text" && matchesQuery(i.content, q, searchMode)) ||
          (i.type === "file" && matchesQuery(i.content, q, searchMode)) ||
          matchesQuery(i.label ?? "", q, searchMode) ||
          matchesQuery(i.title ?? "", q, searchMode) ||
          matchesQuery(i.app ?? "", q, searchMode)
      );
    }
    return list.slice(0, maxItems >= 9999 ? undefined : maxItems);
  }, [items, query, searchMode, maxItems]);

  const pinned = filtered.filter((i) => i.pinned);
  const recent = filtered.filter((i) => !i.pinned);

  // pinTo controls whether the pinned group sits above or below recents.
  const combinedOrder = useMemo(() => (pinTo === "bottom" ? [...recent, ...pinned] : [...pinned, ...recent]), [pinned, recent, pinTo]);
  const shortcutOf: Record<string, number> = {};
  combinedOrder.slice(0, 9).forEach((it, i) => (shortcutOf[it.id] = i + 1));

  useEffect(() => {
    setSelectedIndex((i) => Math.min(Math.max(0, i), Math.max(0, combinedOrder.length - 1)));
  }, [combinedOrder.length]);

  useEffect(() => {
    const id = combinedOrder[selectedIndex]?.id;
    if (!id) return;
    document.querySelector(`[data-row-id="${id}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, combinedOrder]);

  async function togglePin(id: string) {
    setItems(await window.clipvault.togglePin(id));
  }
  async function copyItem(item: ClipItem) {
    await window.clipvault.copyItem({ type: item.type, content: item.content });
    setToast(item.type === "image" ? "Image copied" : item.type === "file" ? "Path copied" : "Copied to clipboard");
  }
  async function removeItem(id: string) {
    setItems(await window.clipvault.removeItem(id));
  }
  function openLabelEditor(item: ClipItem) {
    setLabelDraftId(item.id);
    setLabelDraftValue(item.label ?? "");
  }
  async function saveLabel(id: string) {
    const val = labelDraftValue.trim();
    setItems(await window.clipvault.setLabel(id, val || null));
    setLabelDraftId(null);
  }
  async function clearAll() {
    setItems(await window.clipvault.clearAll());
    setToast("History cleared");
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (labelDraftId !== null) {
        if (e.key === "Escape") setLabelDraftId(null);
        return;
      }

      // Quick-copy: Cmd/Ctrl + 1..9
      if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key)) {
        const n = Number(e.key);
        const target = combinedOrder.find((it) => shortcutOf[it.id] === n);
        if (target) {
          e.preventDefault();
          copyItem(target);
        }
        return;
      }

      const selected = combinedOrder[selectedIndex];

      // Configurable per-item actions.
      if (selected && matchesAccelerator(e, pinShortcut)) {
        e.preventDefault();
        togglePin(selected.id);
        return;
      }
      if (selected && matchesAccelerator(e, deleteShortcut)) {
        e.preventDefault();
        removeItem(selected.id);
        return;
      }
      if (selected && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        openLabelEditor(selected);
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(combinedOrder.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        const target = combinedOrder[selectedIndex];
        if (target) {
          e.preventDefault();
          copyItem(target);
        }
      } else if (e.key === "Escape") {
        if (query) setQuery("");
        else window.clipvault.hideWindow();
      } else if (selected && !query && (e.key === "Delete" || e.key === "Backspace")) {
        // plain delete when search box is empty
        e.preventDefault();
        removeItem(selected.id);
      } else if (!showSearchField && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Type-to-search when the search field is hidden.
        if (e.key === "Backspace") {
          setQuery((q) => q.slice(0, -1));
        } else if (e.key.length === 1) {
          setQuery((q) => q + e.key);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelDraftId, combinedOrder, selectedIndex, query, pinShortcut, deleteShortcut, showSearchField]);

  const selectedId = combinedOrder[selectedIndex]?.id;

  function renderRow(it: ClipItem) {
    return (
      <Row
        key={it.id}
        item={it}
        t={t}
        shortcut={shortcutOf[it.id]}
        selected={selectedId === it.id}
        query={query}
        highlightMatches={highlightMatches}
        imageHeight={imageHeight}
        showAppIcon={showApplicationIcons}
        showSpecialSymbols={showSpecialSymbols}
        onCopy={copyItem}
        onTogglePin={togglePin}
        onRemove={removeItem}
        onOpenLabel={openLabelEditor}
        editing={labelDraftId === it.id}
        labelDraftValue={labelDraftValue}
        setLabelDraftValue={setLabelDraftValue}
        saveLabel={saveLabel}
        labelInputRef={labelInputRef}
      />
    );
  }

  const pinnedBlock = pinned.length > 0 && (
    <>
      <SectionLabel text="Pinned" t={t} />
      {pinned.map(renderRow)}
    </>
  );
  const recentBlock = recent.length > 0 && (
    <>
      <SectionLabel text="Recent" t={t} />
      {recent.map(renderRow)}
    </>
  );

  return (
    <div style={{ background: t.panel, border: `1px solid ${t.border}` }} className="w-full h-full rounded-2xl shadow-2xl overflow-hidden flex flex-col">
      {/* header */}
      <div style={{ borderBottom: `1px solid ${t.border}` }} className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div style={{ background: t.accent }} className="w-6 h-6 rounded-md flex items-center justify-center">
              <Clipboard size={13} color="#fff" strokeWidth={2.5} />
            </div>
            {showTitleBeforeSearch && (
              <span style={{ color: t.text }} className="text-[13px] font-semibold tracking-tight">
                DZClip
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={onGuide} style={{ color: t.subtext }} className="p-1.5 rounded-md hover:bg-white/5 transition-colors" title="Guide & shortcuts">
              <HelpCircle size={15} />
            </button>
            <button onClick={onPreferences} style={{ color: t.subtext }} className="p-1.5 rounded-md hover:bg-white/5 transition-colors" title="Preferences">
              <SettingsIcon size={15} />
            </button>
            <button onClick={() => window.clipvault.hideWindow()} style={{ color: t.subtext }} className="p-1.5 rounded-md hover:bg-white/5 transition-colors" title="Close">
              <X size={15} />
            </button>
          </div>
        </div>

        {showSearchField ? (
          <div style={{ background: t.row, border: `1px solid ${t.border}` }} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg">
            <Search size={13} style={{ color: t.subtext }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clipboard history…"
              style={{ color: t.text, background: "transparent" }}
              className="flex-1 text-[12.5px] outline-none placeholder:opacity-50"
              autoFocus
            />
            {query && (
              <button onClick={() => setQuery("")} style={{ color: t.subtext }}>
                <X size={12} />
              </button>
            )}
          </div>
        ) : (
          query && (
            <div style={{ color: t.subtext }} className="text-[11px] px-1">
              Filtering: <span style={{ color: t.text }}>{query}</span>
            </div>
          )
        )}
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto py-2">
        {pinTo === "bottom" ? (
          <>
            {recentBlock}
            {pinnedBlock}
          </>
        ) : (
          <>
            {pinnedBlock}
            {recentBlock}
          </>
        )}

        {filtered.length === 0 && (
          <div className="py-10 text-center">
            <span style={{ color: t.subtext }} className="text-[12px]">
              {items.length === 0 ? "Copy something to get started" : `No matches for "${query}"`}
            </span>
          </div>
        )}
      </div>

      {toast && (
        <div className="px-4 pb-2 pt-0">
          <div style={{ background: t.accentSoft, color: t.accent }} className="text-[11px] font-medium px-3 py-2 rounded-lg flex items-center gap-1.5">
            <Check size={12} /> {toast}
          </div>
        </div>
      )}

      {/* footer */}
      {showFooter && (
        <div style={{ borderTop: `1px solid ${t.border}` }} className="px-4 py-2 flex items-center justify-between">
          <span style={{ color: t.subtext }} className="text-[10.5px]">
            {items.length} item{items.length === 1 ? "" : "s"} · {isMac ? "⌘" : "Ctrl"}, for Preferences
          </span>
          <div className="flex items-center gap-3">
            <button onClick={clearAll} style={{ color: t.subtext }} className="text-[10.5px] font-medium flex items-center gap-1 hover:opacity-75">
              <Trash2 size={11} /> Clear
            </button>
            <button onClick={() => window.clipvault.quitApp()} style={{ color: t.subtext }} className="text-[10.5px] font-medium hover:opacity-75">
              Quit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
