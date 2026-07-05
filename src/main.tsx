import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Preferences from "./components/Preferences";
import "./index.css";

// Render any uncaught startup/runtime error visibly into the window instead of
// leaving a silent blank screen (Electron has no browser error UI by default).
function showFatal(message: string) {
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = `
    <div style="font-family: ui-sans-serif, system-ui; color:#EDEDF0; background:#1A1A1F; border:1px solid #2A2A33; border-radius:16px; padding:16px; height:100%; box-sizing:border-box; overflow:auto;">
      <div style="font-weight:600; font-size:13px; margin-bottom:8px;">DZClip hit an error</div>
      <pre style="white-space:pre-wrap; font-size:11px; color:#C7C7D1; margin:0;">${String(message).replace(/</g, "&lt;")}</pre>
    </div>`;
}

window.addEventListener("error", (e) => showFatal(e.error?.stack || e.message));
window.addEventListener("unhandledrejection", (e) => showFatal(e.reason?.stack || String(e.reason)));

try {
  if (!window.clipvault) {
    throw new Error("window.clipvault is undefined — the preload bridge did not load. Check electron/preload.js path and that Electron launched this window.");
  }
  // The preferences window loads the same bundle with a #prefs hash.
  const isPrefs = window.location.hash.replace("#", "") === "prefs";
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>{isPrefs ? <Preferences /> : <App />}</React.StrictMode>
  );
} catch (err) {
  showFatal(err instanceof Error ? err.stack || err.message : String(err));
}
