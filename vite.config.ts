import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { build as esbuild } from "esbuild";

// Local Monaco worker bundling. The app is offline-first, so the editor
// worker must come from dist, not a CDN. monaco-editor's export map blocks
// deep worker imports from app code, so this plugin resolves the worker
// entry via the filesystem, bundles it with esbuild, serves it in dev and
// emits it to dist on build. No dev-server cache cleanup, no rmdir calls.
const WORKER_URL = "/monacoeditorwork/editor.worker.bundle.js";

const require = createRequire(import.meta.url);
// Resolve via the package entry: the export map blocks a direct
// `monaco-editor/package.json` subpath lookup.
const monacoEntry = require.resolve("monaco-editor");
const monacoRoot = path.resolve(path.dirname(monacoEntry), "..", "..");
const workerEntry = path.join(monacoRoot, "esm/vs/editor/editor.worker.js");

let workerCache: string | null = null;

async function bundleWorker(): Promise<string> {
  if (workerCache) return workerCache;
  const result = await esbuild({
    entryPoints: [workerEntry],
    bundle: true,
    format: "iife",
    minify: true,
    write: false,
  });
  workerCache = result.outputFiles?.[0]?.text ?? "";
  return workerCache;
}

function localMonacoWorkers() {
  return {
    name: "local-monaco-workers",
    transformIndexHtml(html: string) {
      return [
        {
          tag: "script",
          children: `self["MonacoEnvironment"]={getWorkerUrl:function(){return ${JSON.stringify(WORKER_URL)}}};`,
          injectTo: "head-prepend",
        },
      ];
    },
    configureServer(server: {
      middlewares: {
        use: (
          fn: (
            req: { url?: string },
            res: { setHeader: (k: string, v: string) => void; end: (b: string) => void },
            next: () => void
          ) => void
        ) => void;
      };
    }) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== WORKER_URL) {
          next();
          return;
        }
        bundleWorker()
          .then((code) => {
            res.setHeader("Content-Type", "application/javascript");
            res.end(code);
          })
          .catch(next);
      });
    },
    async writeBundle(options: { dir?: string }) {
      const code = await bundleWorker();
      const outFile = path.join(options.dir ?? "dist", "monacoeditorwork", "editor.worker.bundle.js");
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      fs.writeFileSync(outFile, code);
    },
  };
}

export default defineConfig({
  plugins: [react(), localMonacoWorkers()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "esnext",
    minify: "esbuild",
  },
});
