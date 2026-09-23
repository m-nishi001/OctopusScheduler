import { injectable, inject } from "tsyringe";
import { AssetRepository } from "@model/asset/asset-repository";
import { KeyboardShortcutRepository } from "@model/keyboard-shortcut/keyboard-shortcut-repository";
import { exportLocalBackup } from "./backup-util";

type Direction = Parameters<KeyboardShortcutRepository["syncWithServer"]>[0];

type Stage =
  | "init"
  | "backup"
  | "json"
  | "events"
  | "assets"
  | "shortcuts"
  | "complete"
  | "cancel";

type Status = "started" | "creating" | "done" | "error" | "aborted" | "finished";

export type ProgressCallback = (
  stage: Stage,
  status: Status,
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
    @inject(AssetRepository) private assetRepo: AssetRepository,
    @inject(KeyboardShortcutRepository) private kbRepo: KeyboardShortcutRepository
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

    // Sync events: spreadsheet based sync is not available because the
    // server-side endpoints (getSpreadsheetData / addSpreadsheetRecords /
    // updateSpreadsheetRecords) were removed during a staged cleanup.
    // Keep the stage for UI progress consistency and report it as skipped.
    onProgress?.(
      "events",
      "done",
      "Events sync skipped (server endpoints required)",
      50
    );

    if (this.cancelRequested) {
      onProgress?.("cancel", "aborted", "User cancelled");
      return;
    }

    // Sync assets. AssetRepository.syncAssets: "local" = local->drive (diff-based
    // upload), "drive" = drive->local (fetch remote and overwrite local).
    onProgress?.("assets", "started", "Syncing assets", 55);
    try {
      if (direction === "local-to-gas") {
        await this.assetRepo.syncAssets("local");
      } else {
        await this.assetRepo.syncAssets("drive");
      }
      onProgress?.("assets", "done", "Assets synced", 95);
    } catch (e: any) {
      onProgress?.("assets", "error", String(e));
      throw e;
    }

    // Sync keyboard shortcuts
    onProgress?.("shortcuts", "started", "Syncing keyboard shortcuts", 96);
    try {
      await this.kbRepo.syncWithServer(direction);
      onProgress?.("shortcuts", "done", "Keyboard shortcuts synced", 100);
    } catch (e: any) {
      onProgress?.("shortcuts", "error", String(e));
      throw e;
    }

    onProgress?.("complete", "finished");
  }
}

export default BulkSyncService;
