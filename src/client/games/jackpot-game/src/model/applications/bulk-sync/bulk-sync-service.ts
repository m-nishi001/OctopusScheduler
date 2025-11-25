import { container, injectable } from "tsyringe";
import { AssetDataService } from "../../applications/asset/asset-data-service";
import { GasFunctionService } from "@common-lib/google-apps-script/gas-script-service";
import { IMemberRepositoryToken } from "../../domains/member/repository/i-member-repository";
import { IPrizeRepositoryToken } from "../../domains/prize/repository/i-prize-repository";
import type { IMemberRepository } from "../../domains/member/repository/i-member-repository";
import type { IPrizeRepository } from "../../domains/prize/repository/i-prize-repository";

export type ProgressCallback = (
  domainId: string,
  message: string,
  progress?: number
) => void;

@injectable()
export class BulkSyncService {
  private assetService = container.resolve(AssetDataService);
  private memberRepo = container.resolve<IMemberRepository>(
    IMemberRepositoryToken as any
  );
  private prizeRepo = container.resolve<IPrizeRepository>(
    IPrizeRepositoryToken as any
  );
  private cancelling = false;

  requestCancel() {
    this.cancelling = true;
  }

  async sync(onProgress?: ProgressCallback): Promise<void> {
    return this.syncDirection("download", onProgress);
  }

  async syncDirection(
    direction: "download" | "upload",
    onProgress?: ProgressCallback
  ): Promise<void> {
    this.cancelling = false;
    // Members
    if (direction === "download") {
      onProgress?.("members", "ファイルダウンロード中...", 5);
    } else {
      onProgress?.("members", "ファイルをアップロード中...", 5);
    }
    try {
      if (direction === "download") {
        const lastId = localStorage.getItem("jackpot-members-last-file-id");
        if (lastId) {
          const resp = await new (
            await import("@common-lib/google-apps-script/gas-script-service")
          ).GasFunctionService("getJson").call(lastId);
          if (resp && resp.json) {
            onProgress?.("members", "ダウンロード完了、保存中...", 70);
            const parsed = JSON.parse(resp.json || "[]");
            if (Array.isArray(parsed)) {
              await this.memberRepo.replaceAllMembers(parsed as any);
              onProgress?.("members", "同期完了", 100);
            } else {
              onProgress?.(
                "members",
                "ダウンロードした JSON が配列ではありません",
                100
              );
            }
          } else {
            onProgress?.("members", "Drive からの取得に失敗しました", 100);
          }
        } else {
          onProgress?.(
            "members",
            "Drive 上のメンバーファイルが見つかりません",
            100
          );
        }
      } else {
        // upload members: collect local members and call addJson
        try {
          onProgress?.("members", "ローカルデータを収集中...", 20);
          const members = await this.memberRepo.getMembers();
          const payload = {
            appFileId:
              String(Date.now()) + "-" + Math.random().toString(36).slice(2, 8),
            metadata: {},
            fileName: "members.json",
            jsonText: JSON.stringify(members || []),
            uploadDate: new Date().toISOString(),
            parentFolderId: "",
          } as any;
          onProgress?.("members", "アップロード中...", 50);
          const resp = await new (
            await import("@common-lib/google-apps-script/gas-script-service")
          ).GasFunctionService("addJson").call(payload);
          if (resp && (resp as any).fileId) {
            localStorage.setItem(
              "jackpot-members-last-file-id",
              (resp as any).fileId
            );
            onProgress?.("members", "アップロード完了", 100);
          } else if (resp && (resp as any).data && (resp as any).data.fileId) {
            localStorage.setItem(
              "jackpot-members-last-file-id",
              (resp as any).data.fileId
            );
            onProgress?.("members", "アップロード完了", 100);
          } else {
            onProgress?.("members", "アップロードに失敗しました", 100);
          }
        } catch (e) {
          console.error("members upload error", e);
          onProgress?.("members", "アップロードに失敗しました", 100);
        }
      }
    } catch (e) {
      console.error("members sync error", e);
      onProgress?.("members", "同期に失敗しました", 100);
    }
    if (this.cancelling) return;

    // Prizes
    if (direction === "download")
      onProgress?.("prizes", "ファイルダウンロード中...", 10);
    else onProgress?.("prizes", "ファイルをアップロード中...", 10);
    try {
      if (direction === "download") {
        await this.prizeRepo.importAllPrizesFromDrive();
        onProgress?.("prizes", "同期完了", 100);
      } else {
        // upload prizes
        if (
          typeof (this.prizeRepo as any).exportAllPrizesToDrive === "function"
        ) {
          await (this.prizeRepo as any).exportAllPrizesToDrive();
          onProgress?.("prizes", "アップロード完了", 100);
        } else {
          onProgress?.("prizes", "景品アップロード機能が利用できません", 100);
        }
      }
    } catch (e) {
      console.error("prizes sync error", e);
      onProgress?.(
        "prizes",
        direction === "download"
          ? "Drive 上の景品ファイルが見つからないか取得に失敗しました"
          : "景品のアップロードに失敗しました",
        100
      );
    }
    if (this.cancelling) return;

    // Assets
    onProgress?.(
      "assets",
      direction === "download"
        ? "ファイルメタデータ取得中..."
        : "アセットをアップロード中...",
      10
    );
    try {
      if (direction === "download") {
        if (
          typeof (this.assetService as any).replaceLocalWithDrive === "function"
        ) {
          // Fetch all metadata once and pass to assetService to avoid duplicated metadata calls
          const metaService = new GasFunctionService("getDriveMetaData");
          let remoteMetas: any[] = [];
          try {
            // Explicitly pass undefined so the server-side resolver uses the
            // configured ScriptProperty folder instead of an empty string.
            remoteMetas = (await metaService.call(undefined)) || [];
          } catch (e) {
            onProgress?.(
              "assets",
              `Failed to fetch remote metadata: ${(e as Error).message}`
            );
            // proceed with empty metadata to allow repository fallback behavior
            remoteMetas = [];
          }

          await (this.assetService as any).replaceLocalWithDrive(
            (msg: string) => {
              const m = msg.match(/(\d+)\/(\d+)/);
              if (m) {
                const cur = Number(m[1]);
                const total = Number(m[2]);
                const p = Math.round((cur / Math.max(1, total)) * 100);
                onProgress?.(
                  "assets",
                  `ファイルダウンロード中: ${total}件中${cur}件完了...`,
                  p
                );
              } else {
                onProgress?.("assets", msg);
              }
            },
            remoteMetas
          );
          onProgress?.("assets", "同期完了", 100);
        } else {
          onProgress?.("assets", "アセット同期機能が利用できません", 100);
        }
      } else {
        // upload assets: use syncAssetData / uploadAssets path
        if (typeof (this.assetService as any).syncAssetData === "function") {
          await (this.assetService as any).syncAssetData((msg: string) => {
            const m = msg.match(/(\d+)\/(\d+)/);
            if (m) {
              const cur = Number(m[1]);
              const total = Number(m[2]);
              const p = Math.round((cur / Math.max(1, total)) * 100);
              onProgress?.(
                "assets",
                `ファイルアップロード中: ${total}件中${cur}件完了...`,
                p
              );
            } else {
              onProgress?.("assets", msg);
            }
          });
          onProgress?.("assets", "アップロード完了", 100);
        } else {
          onProgress?.(
            "assets",
            "アセットアップロード機能が利用できません",
            100
          );
        }
      }
    } catch (e) {
      console.error("assets sync error", e);
      onProgress?.("assets", "同期に失敗しました", 100);
    }
    if (this.cancelling) return;

    // Screens
    onProgress?.(
      "screens",
      direction === "download"
        ? "画面設定を同期中..."
        : "画面設定をアップロード中...",
      20
    );
    try {
      const screenRepo = container.resolve(
        (await import("../../infrastructures/screen-config-repository"))
          .ScreenConfigRepository
      );

      if (direction === "download") {
        // Assume assets were already synced above and assetService.replaceLocalWithDrive
        // produced an idMap if available. Try to obtain idMap via assetService if present.
        let idMap: { [k: string]: string } = {};
        try {
          if (
            typeof (this.assetService as any).replaceLocalWithDrive ===
            "function"
          ) {
            const r = await (this.assetService as any).replaceLocalWithDrive();
            if (r && r.idMap) idMap = r.idMap;
          }
        } catch (e) {
          console.warn("Failed to obtain idMap for screens import:", e);
        }

        await (screenRepo as any).importScreenConfigsFromDrive(
          undefined,
          idMap
        );
        onProgress?.("screens", "同期完了", 100);
      } else {
        // upload: export screens to Drive
        const exported = await (screenRepo as any).exportScreenConfigsToDrive();
        if (exported) onProgress?.("screens", "アップロード完了", 100);
        else onProgress?.("screens", "アップロードに失敗しました", 100);
      }
    } catch (e) {
      console.error("screen sync error", e);
      onProgress?.("screens", "同期に失敗しました", 100);
    }

    return;
  }
}

export default BulkSyncService;
