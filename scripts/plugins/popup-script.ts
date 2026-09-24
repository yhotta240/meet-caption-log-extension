import type { Plugin } from "vite";
import { build } from "vite";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";
import { resolve } from "node:path";
import { markdownPlugin } from "./markdown.ts";
import { addProjectWatchFiles } from "../watch-files.ts";

/** Popupを単独entryとしてビルドし，依存関係をpopup.jsへ内包するプラグイン */
export function popupScriptPlugin(isDev: boolean, root: string): Plugin {
  const popupEntry = resolve(root, "src/popup/index.ts");
  let building = false;

  return {
    name: "popup-script-bundle",
    apply: "build",

    buildStart() {
      // nested buildは親のwatch graphに入らないため，依存ファイルを親のwatch graphへ追加する．
      addProjectWatchFiles(this, root);
    },

    writeBundle: {
      sequential: true,
      async handler() {
        if (building) return;
        building = true;
        try {
          await build({
            configFile: false,
            logLevel: "info",
            publicDir: false,
            plugins: [markdownPlugin(), cssInjectedByJsPlugin()],
            define: {
              "process.env.NODE_ENV": JSON.stringify(isDev ? "development" : "production"),
            },
            resolve: {
              alias: { src: resolve(root, "src") },
            },
            build: {
              outDir: resolve(root, "dist"),
              emptyOutDir: false,
              sourcemap: isDev ? "inline" : false,
              minify: isDev ? false : undefined,
              rollupOptions: {
                input: { popup: popupEntry },
                output: {
                  format: "es",
                  codeSplitting: false,
                  entryFileNames: "popup.js",
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
          });
        } finally {
          building = false;
        }
      },
    },
  };
}
