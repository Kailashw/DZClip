import React from "react";
import type { Tokens } from "../theme";

export default function SectionLabel({ text, t }: { text: string; t: Tokens }) {
  return (
    <div style={{ color: t.subtext }} className="text-[10px] font-semibold tracking-wide uppercase px-4 pt-2 pb-1">
      {text}
    </div>
  );
}
