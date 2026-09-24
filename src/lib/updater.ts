import { check } from "@tauri-apps/plugin-updater";
import type { Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";

export const isTauriApp =
  typeof window !== "undefined" &&
  ("__TAURI__" in window || "__TAURI_INTERNALS__" in window);

export type UpdateCheck =
  | { kind: "current"; version: string }
  | { kind: "available"; version: string; notes: string | null; date: string | null };

let pendingUpdate: Update | null = null;

export async function getAppVersion(): Promise<string> {
  try {
    return await getVersion();
  } catch {
    return "dev";
  }
}

export async function checkForUpdates(): Promise<UpdateCheck> {
  if (!isTauriApp) throw new Error("updater unavailable outside the installed app");
  const update = await check();
  if (!update) {
    return { kind: "current", version: await getAppVersion() };
  }
  pendingUpdate = update;
  return {
    kind: "available",
    version: update.version,
    notes: update.body ?? null,
    date: update.date ?? null,
  };
}

export async function downloadAndInstall(
  onProgress: (downloaded: number, total?: number) => void
): Promise<void> {
  if (!pendingUpdate) throw new Error("no pending update");
  let downloaded = 0;
  let total: number | undefined;
  await pendingUpdate.downloadAndInstall((event) => {
    if (event.event === "Started") {
      downloaded = 0;
      total = event.data.contentLength ?? undefined;
      onProgress(0, total);
    } else if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      onProgress(downloaded, total);
    }
  });
  pendingUpdate = null;
}

export async function restartApp(): Promise<void> {
  await relaunch();
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
