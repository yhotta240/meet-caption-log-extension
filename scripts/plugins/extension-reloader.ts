import type { Plugin } from "vite";
import { WebSocketServer, type WebSocket } from "ws";

/** ビルド完了後に WebSocket 経由で拡張機能へ "reload" を送信する Vite プラグイン */
export function extensionReloaderPlugin(port = 6571): Plugin {
  let wss: WebSocketServer | null = null;
  let watchMode = false;

  const sendReload = () => {
    for (const client of (wss?.clients ?? []) as Set<WebSocket>) {
      try {
        if (client.readyState === 1) client.send("reload");
      } catch {
        // 個々のクライアント送信エラーは無視する。
      }
    }
  };

  const cleanup = () => {
    const server = wss;
    wss = null;
    if (!server) return;

    for (const client of server.clients) {
      client.terminate();
    }
    server.close();
  };

  return {
    name: "extension-reloader",
    apply: "build",

    async buildStart() {
      watchMode = this.meta.watchMode;
      if (wss) return;

      const server = new WebSocketServer({ port });
      const onListening = () => {
        console.log(`[extension-reloader] WebSocket server listening on port ${port}`);
      };
      let handleListening: (() => void) | undefined;
      let handleError: ((err: NodeJS.ErrnoException) => void) | undefined;

      try {
        await new Promise<void>((resolve, reject) => {
          handleListening = () => {
            onListening();
            resolve();
          };
          handleError = (err: NodeJS.ErrnoException) => reject(err);

          server.once("listening", handleListening);
          server.once("error", handleError);
        });
      } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException)?.code;
        if (code === "EADDRINUSE") {
          throw new Error(
            `[extension-reloader] port ${port} is already in use. Stop the existing watch process before starting another.`,
          );
        }
        throw err;
      } finally {
        if (handleListening) server.off("listening", handleListening);
        if (handleError) server.off("error", handleError);
      }

      wss = server;
      server.on("error", (err: NodeJS.ErrnoException) => {
        console.warn("[extension-reloader] error:", err.code ?? err);
        cleanup();
      });

      process.once("exit", cleanup);
      process.once("SIGINT", () => {
        cleanup();
        process.exit();
      });
      process.once("SIGTERM", () => {
        cleanup();
        process.exit();
      });
    },

    writeBundle: {
      sequential: true,
      handler: sendReload,
    },

    closeWatcher: cleanup,

    closeBundle() {
      if (!watchMode) cleanup();
    },
  };
}
