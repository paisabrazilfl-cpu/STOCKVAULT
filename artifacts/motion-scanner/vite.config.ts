import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Emit a 404.html that's a byte-for-byte copy of index.html. Static hosts
// (Render, GitHub Pages, etc.) serve 404.html for unmatched paths, which makes
// SPA deep-links and hard refreshes resolve to the app even when a host-level
// /* -> /index.html rewrite isn't configured. Belt-and-suspenders with the
// render.yaml routes.
function spaFallback404() {
  return {
    name: "spa-fallback-404",
    apply: "build" as const,
    closeBundle: async () => {
      const { readFile, writeFile } = await import("node:fs/promises");
      const nodePath = await import("node:path");
      const outDir = nodePath.resolve(import.meta.dirname, "dist/public");
      try {
        const html = await readFile(nodePath.join(outDir, "index.html"));
        await writeFile(nodePath.join(outDir, "404.html"), html);
      } catch {
        // index.html not produced (non-build context) — nothing to copy.
      }
    },
  };
}

export default defineConfig(async ({ command }) => {
  // PORT/BASE_PATH are only needed when running the dev/preview server.
  // A production `vite build` (e.g. on Render's static site) must not require
  // them, so we default sensibly and only enforce PORT when serving.
  const rawPort = process.env.PORT;
  if (command === "serve" && !rawPort) {
    throw new Error(
      "PORT environment variable is required but was not provided.",
    );
  }
  const port = rawPort ? Number(rawPort) : 5173;
  if (rawPort && (Number.isNaN(port) || port <= 0)) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  const basePath = process.env.BASE_PATH ?? "/";

  return {
  base: basePath,
  plugins: [
    react(),
    tailwindcss({ optimize: false }),
    runtimeErrorOverlay(),
    spaFallback404(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  };
});
