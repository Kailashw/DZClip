import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Electron-specific renderer fixes applied only to the production build:
//   1. Strip Vite's default `crossorigin` attribute. The packaged app loads the
//      renderer over file://, where a crossorigin module script triggers a CORS
//      check that fails and leaves a blank window ("app won't open").
//   2. Inject a Content-Security-Policy that permits `data:`/`blob:` images,
//      which DZClip uses for image-clipboard thumbnails, while keeping
//      scripts locked to 'self'.
// In dev, no CSP meta is emitted so Vite's inline HMR preamble and websocket
// work normally.
function electronRendererFix(): Plugin {
  return {
    name: "electron-renderer-fix",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const stripped = html.replace(/\s+crossorigin/g, "");
        const csp = [
          "default-src 'self'",
          "img-src 'self' data: blob:",
          "style-src 'self' 'unsafe-inline'",
          "script-src 'self'",
          "font-src 'self' data:",
        ].join("; ");
        const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}" />`;
        return stripped.replace("</title>", `</title>\n    ${meta}`);
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), electronRendererFix()],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
