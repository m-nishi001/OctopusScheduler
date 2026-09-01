import { injectable } from "tsyringe";
import { AssetRepository } from "../../infrastructures/assets/asset-repository";
import { AppEventRepository } from "../../infrastructures/app-event/app-event-repository";
import { KeyboardShortcutRepository } from "../../domains/keyboard-shortcut/keyboard-shortcut-repository";
import { exportLocalBackup } from "./backup-util";

type Direction = "local-to-gas" | "gas-to-local";

export type ProgressCallback = (
  stage: string,
  status: string,
  detail?: string,
  percent?: number
) => void;

export const DEFAULT_TIMEOUTS = {
  json: 120000,
  events: 180000,
  assetMeta: 180000,
  assetFile: 600000,
};

@injectable()
export class BulkSyncService {
  private cancelRequested = false;
  constructor(
    private assetRepo: AssetRepository,
    private appEventRepo: AppEventRepository,
    private kbRepo: KeyboardShortcutRepository
  ) {}

  requestCancel() {
    this.cancelRequested = true;
  }

  resetCancel() {
    this.cancelRequested = false;
  }

  async sync(
    direction: Direction,
    options?: {
      backup?: boolean;
      includeAssetsInBackup?: boolean;
      timeouts?: Partial<typeof DEFAULT_TIMEOUTS>;
    },
    onProgress?: ProgressCallback
  ) {
    this.resetCancel();
    const t = { ...DEFAULT_TIMEOUTS, ...(options?.timeouts || {}) };

    onProgress?.("init", "started");

    if (options?.backup) {
      onProgress?.("backup", "creating", "Preparing local backup");
      try {
        const res = await exportLocalBackup({
          includeAssets: !!options.includeAssetsInBackup,
        });
        onProgress?.("backup", "done", `Backup created: ${res.filename}`, 5);
      } catch (e: any) {
        onProgress?.("backup", "error", String(e));
        throw e;
      }
    }

    if (this.cancelRequested) {
      onProgress?.("cancel", "aborted", "User cancelled");
      return;
    }

    // Sync JSON settings: we expect server endpoints to exist: listJsonMetaData/getJsonData/addJsonData/updateJsonData
    onProgress?.("json", "started", "Syncing JSON settings", 10);
    try {
      if (direction === "local-to-gas") {
        // client expects that services will provide methods to export their JSON payloads
        // Use local storage dumps where appropriate — we will reuse existing repositories where possible
        // For now, delegate JSON work to AssetRepository for assets and AppEventRepository for events via their sync methods
      }
      // fallthrough to events and assets
      onProgress?.(
        "json",
        "done",
        "JSON sync skipped (server endpoints required)",
        20
      );
    } catch (e: any) {
      onProgress?.("json", "error", String(e));
      throw e;
    }

    if (this.cancelRequested) {
      onProgress?.("cancel", "aborted", "User cancelled");
      return;
    }

    // Sync events (spreadsheet)
    onProgress?.("events", "started", "Syncing schedule events", 25);
    try {
      if (direction === "local-to-gas") {
        await this.appEventRepo.syncScheduleEvents("drive");
      } else {
        await this.appEventRepo.syncScheduleEvents("local");
      }
      onProgress?.("events", "done", "Events synced", 50);
    } catch (e: any) {
      onProgress?.("events", "error", String(e));
      throw e;
    }

    if (this.cancelRequested) {
      onProgress?.("cancel", "aborted", "User cancelled");
      return;
    }

    // Sync assets
    onProgress?.("assets", "started", "Syncing assets", 55);
    try {
      if (direction === "local-to-gas") {
        await this.assetRepo.syncAssets("drive");
      } else {
        await this.assetRepo.syncAssets("local");
      }
      onProgress?.("assets", "done", "Assets synced", 95);
    } catch (e: any) {
      onProgress?.("assets", "error", String(e));
      throw e;
    }

    // Sync keyboard shortcuts
    onProgress?.("shortcuts", "started", "Syncing keyboard shortcuts", 96);
    try {
      if (direction === "local-to-gas") {
        await this.kbRepo.syncWithServer("server");
      } else {
        await this.kbRepo.syncWithServer("local");
      }
      onProgress?.("shortcuts", "done", "Keyboard shortcuts synced", 100);
    } catch (e: any) {
      onProgress?.("shortcuts", "error", String(e));
      throw e;
    }

    onProgress?.("complete", "finished");
  }
}

export default BulkSyncService;
