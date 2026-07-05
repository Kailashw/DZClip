import React, { useState } from "react";
import { Pin, PinOff, Tag, Trash2, Image as ImageIcon, File as FileIcon } from "lucide-react";
import type { Tokens } from "../theme";
import { getSource, timeAgo } from "../utils";
import type { ClipItem, HighlightMatches } from "../../electron/types";

interface RowProps {
  item: ClipItem;
  t: Tokens;
  shortcut?: number;
  selected?: boolean;
  query: string;
  highlightMatches: HighlightMatches;
  imageHeight: number;
  showAppIcon: boolean;
  showSpecialSymbols: boolean;
  onCopy: (item: ClipItem) => void;
  onTogglePin: (id: string) => void;
  onRemove: (id: string) => void;
  onOpenLabel: (item: ClipItem) => void;
  editing: boolean;
  labelDraftValue: string;
  setLabelDraftValue: (v: string) => void;
  saveLabel: (id: string) => void;
  labelInputRef: React.RefObject<HTMLInputElement>;
}

function highlightStyle(mode: HighlightMatches): React.CSSProperties {
  if (mode === "underline") return { textDecoration: "underline" };
  if (mode === "italic") return { fontStyle: "italic" };
  if (mode === "bold") return { fontWeight: 700 };
  return {};
}

function renderText(text: string, query: string, mode: HighlightMatches, accent: string, showSpecial: boolean) {
  const display = showSpecial ? text.replace(/\n/g, "⏎ ").replace(/\t/g, "⇥ ") : text;
  const q = query.trim();
  if (!q || mode === "none") return display;
  const idx = display.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return display;
  const style = { ...highlightStyle(mode), color: accent };
  return (
    <>
      {display.slice(0, idx)}
      <span style={style}>{display.slice(idx, idx + q.length)}</span>
      {display.slice(idx + q.length)}
    </>
  );
}

export default function Row({
  item,
  t,
  shortcut,
  selected,
  query,
  highlightMatches,
  imageHeight,
  showAppIcon,
  showSpecialSymbols,
  onCopy,
  onTogglePin,
  onRemove,
  onOpenLabel,
  editing,
  labelDraftValue,
  setLabelDraftValue,
  saveLabel,
  labelInputRef,
}: RowProps) {
  const [hover, setHover] = useState(false);
  const src = getSource(item.app);
  const showActions = hover || selected;
  const displayTitle = item.title || null;

  return (
    <div
      data-row-id={item.id}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="mx-2 rounded-lg px-2.5 py-2 mb-0.5 cursor-pointer group transition-colors"
      style={{ background: selected || hover ? t.rowHover : "transparent", outline: selected ? `1px solid ${t.accent}` : "none" }}
      onClick={() => onCopy(item)}
    >
      <div className="flex items-start gap-2.5">
        {showAppIcon && (
          <div style={{ color: src.color }} className="text-[13px] leading-[18px] w-4 flex-shrink-0 text-center pt-[1px]" title={src.label}>
            {src.glyph}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {item.type === "image" ? (
            <div className="flex items-center gap-2">
              <img
                src={item.content}
                alt="clipboard image"
                className="rounded-md object-cover flex-shrink-0"
                style={{ width: imageHeight, height: imageHeight, border: `1px solid ${t.border}`, background: t.panel }}
                draggable={false}
              />
              <span style={{ color: t.mono }} className="font-mono text-[11.5px] flex items-center gap-1">
                <ImageIcon size={11} style={{ color: t.subtext }} />
                {displayTitle || (item.image ? `${item.image.width}×${item.image.height}` : "Image")}
              </span>
            </div>
          ) : item.type === "file" ? (
            <div style={{ color: t.mono }} className="font-mono text-[12px] leading-[17px] truncate flex items-center gap-1.5">
              <FileIcon size={12} style={{ color: t.subtext }} />
              {displayTitle || item.content.split("\n").map((p) => p.split("/").pop()).join(", ")}
            </div>
          ) : (
            <div style={{ color: t.mono }} className="font-mono text-[12px] leading-[17px] truncate">
              {displayTitle || renderText(item.content, query, highlightMatches, t.accent, showSpecialSymbols)}
            </div>
          )}

          <div className="flex items-center gap-1.5 mt-0.5">
            <span style={{ color: t.subtext }} className="text-[10px]">
              {src.label} · {timeAgo(item.timestamp)}
              {item.numberOfCopies > 1 ? ` · ${item.numberOfCopies}×` : ""}
            </span>

            {item.label && !editing && (
              <span style={{ background: t.accentSoft, color: t.accent }} className="text-[9.5px] font-medium px-1.5 py-[1px] rounded">
                {item.label}
              </span>
            )}
            {item.hotkey && (
              <span style={{ border: `1px solid ${t.border}`, color: t.subtext }} className="text-[9px] font-mono px-1 py-[1px] rounded">
                {item.hotkey}
              </span>
            )}
          </div>

          {editing && (
            <div className="mt-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                ref={labelInputRef}
                value={labelDraftValue}
                onChange={(e) => setLabelDraftValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveLabel(item.id);
                  e.stopPropagation();
                }}
                onBlur={() => saveLabel(item.id)}
                placeholder="Add a label…"
                style={{ background: t.panel, border: `1px solid ${t.accent}`, color: t.text }}
                className="text-[10.5px] px-2 py-1 rounded-md outline-none w-32"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0" style={{ opacity: showActions ? 1 : 0, transition: "opacity 120ms" }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onOpenLabel(item)} title="Add label" style={{ color: t.subtext }} className="p-1 rounded-md hover:bg-white/10">
            <Tag size={12} />
          </button>
          <button
            onClick={() => onTogglePin(item.id)}
            title={item.pinned ? "Unpin" : "Pin"}
            style={{ color: item.pinned ? t.pinAccent : t.subtext }}
            className="p-1 rounded-md hover:bg-white/10"
          >
            {item.pinned ? <PinOff size={12} /> : <Pin size={12} />}
          </button>
          <button onClick={() => onRemove(item.id)} title="Delete" style={{ color: t.subtext }} className="p-1 rounded-md hover:bg-white/10">
            <Trash2 size={12} />
          </button>
        </div>

        {shortcut && (
          <div
            style={{ borderColor: t.border, color: t.subtext, background: showActions ? t.panel : "transparent" }}
            className="flex-shrink-0 text-[9.5px] font-medium px-1.5 py-0.5 rounded border font-mono"
            title={`Quick-copy shortcut ${shortcut}`}
          >
            ⌘{shortcut}
          </div>
        )}
      </div>
    </div>
  );
}
