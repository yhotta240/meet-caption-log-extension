import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

type WatchContext = {
  addWatchFile: (id: string) => void;
};

function collectFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(path));
    } else {
      files.push(path);
    }
  }

  return files;
}

/** nested buildで使う依存ファイルを親Viteのwatch graphへ登録する。 */
export function addProjectWatchFiles(context: WatchContext, root: string): void {
  for (const directory of ["src", "docs", "public"]) {
    const path = resolve(root, directory);
    if (!existsSync(path)) continue;

    context.addWatchFile(path);
    for (const file of collectFiles(path)) {
      context.addWatchFile(file);
    }
  }

  for (const file of ["CHANGELOG.md"]) {
    const path = resolve(root, file);
    if (existsSync(path)) context.addWatchFile(path);
  }
}
