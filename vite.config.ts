import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { markdownPlugin } from "./scripts/plugins/markdown.ts";
import { extensionReloaderPlugin } from "./scripts/plugins/extension-reloader.ts";
import { contentScriptPlugin } from "./scripts/plugins/content-script.ts";
import { popupScriptPlugin } from "./scripts/plugins/popup-script.ts";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig(({ mode }) => {
  const isDev = mode === "development";
  const reloaderPort = 6571;
  const bgEntry = isDev
    ? r("./src/background/dev.ts")
    : r("./src/background/index.ts");

  return {
    publicDir: false,

    define: {
      "process.env.NODE_ENV": JSON.stringify(
        isDev ? "development" : "production"
      ),
    },

    build: {
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: isDev,
      // Vite 8 のデフォルト（Oxc）を使う。esbuild minifier は Vite 8 で非推奨。
      minify: isDev ? false : undefined,
      rollupOptions: {
        input: {
          background: bgEntry,
        },
        output: {
          entryFileNames: "[name].js",
          chunkFileNames: "[name].js",
          assetFileNames: ({ names }) => {
            const name = names.length > 0 ? names[0] : "asset";
            if (!name) return "[name][extname]";
            if (/\.(png|jpe?g|gif|svg|webp)$/i.test(name)) {
              return "assets/[name][extname]";
            }
            return "[name][extname]";
          },
        },
      },
    },

    resolve: {
      alias: {
        src: r("./src"),
      },
    },

    plugins: [
      markdownPlugin(),

      viteStaticCopy({
        targets: [
          { src: "public/popup.html", dest: ".", rename: { stripBase: 1 } },
          { src: "public/manifest.meta.json", dest: ".", rename: { stripBase: 1 } },
          { src: "public/icons", dest: ".", rename: { stripBase: 1 } },
          {
            src: `public/manifest.${isDev ? "dev" : "prod"}.json`,
            dest: ".",
            rename: { stripBase: 1, name: "manifest.json" },
          },
        ],
      }),

      contentScriptPlugin(isDev, fileURLToPath(new URL(".", import.meta.url))),
      popupScriptPlugin(isDev, fileURLToPath(new URL(".", import.meta.url))),

      ...(isDev ? [extensionReloaderPlugin(reloaderPort)] : []),
    ],
  };
});
