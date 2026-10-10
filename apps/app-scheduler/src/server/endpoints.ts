/**
 * octopus-scheduler(ホスト本体)の GAS エンドポイント。
 *
 * 各ハンドラは「引数パース -> use-case 呼び出し -> ApiResponse に詰めて
 * JSON.stringify」という薄い層のみを担う。`doGet` は GAS Web アプリの
 * エントリポイントで、HtmlService の呼び出しはこのファイルに留める
 * (エントリポイント固有の関心事であり、ポート化しない)。
 */
import { errorResponse } from "@octopus/infrastructures/interfaces";
import { container } from "tsyringe";
import {
  ICacheToken,
  IKeyValueStorageToken,
} from "@octopus/infrastructures/interfaces";
import type {
  ICache,
  IKeyValueStorage,
} from "@octopus/infrastructures/interfaces";
import type { DriveData } from "@octopus/infrastructures/compositions";
import type {
  KeyboardShortcutWireItem,
  OctopusSchedulerEndpointName,
} from "./scheduler-api-contract";
import { OCTOPUS_SCHEDULER_PREFIX } from "./scheduler-api-contract";

import {
  addSchedulerDriveData,
  getSchedulerDriveData,
  getSchedulerDriveMetadata,
  updateSchedulerDriveData,
} from "./drive-asset-use-cases";
import {
  getKeyboardShortcuts,
  setKeyboardShortcuts,
} from "./keyboard-shortcuts-use-cases";
import { secure } from "@octopus/accounts/secure";

function resolveDeps() {
  return {
    storage: container.resolve<IKeyValueStorage>(IKeyValueStorageToken),
    cache: container.resolve<ICache>(ICacheToken),
  };
}

declare let _octopusScheduler_doGet: (
  e: GoogleAppsScript.Events.DoGet
) => GoogleAppsScript.HTML.HtmlOutput;
declare let _octopusScheduler_addDriveData: (driveData: DriveData) => Promise<string>;
declare let _octopusScheduler_getDriveMetaData: (folderName?: string) => Promise<string>;
declare let _octopusScheduler_getDriveData: (dataId: string) => Promise<string>;
declare let _octopusScheduler_updateDriveData: (driveData: DriveData) => Promise<string>;
declare let _octopusScheduler_getKeyboardShortcuts: () => Promise<string>;
declare let _octopusScheduler_setKeyboardShortcuts: (payload: {
  shortcuts: KeyboardShortcutWireItem[];
  config: unknown;
  updatedAt: string;
}) => Promise<string>;

_octopusScheduler_addDriveData = async (driveData: DriveData): Promise<string> => {
  try {
    const result = await addSchedulerDriveData(resolveDeps(), driveData);
    // 既存挙動を保持: duplicate/error でも常に status:"success" として返す。
    return JSON.stringify({ status: "success", data: result.data! });
  } catch (error) {
    return errorResponse(error);
  }
};

_octopusScheduler_getDriveMetaData = async (folderName?: string): Promise<string> => {
  try {
    const result = await getSchedulerDriveMetadata(resolveDeps(), folderName);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return errorResponse(error);
  }
};

_octopusScheduler_getDriveData = async (dataId: string): Promise<string> => {
  try {
    const result = await getSchedulerDriveData(resolveDeps(), dataId);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return errorResponse(error);
  }
};

_octopusScheduler_updateDriveData = async (driveData: DriveData): Promise<string> => {
  try {
    await updateSchedulerDriveData(resolveDeps(), driveData);
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    return errorResponse(error);
  }
};

_octopusScheduler_getKeyboardShortcuts = async (): Promise<string> => {
  try {
    const kv = container.resolve<IKeyValueStorage>(IKeyValueStorageToken);
    const result = await getKeyboardShortcuts({ kv });
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return errorResponse(error);
  }
};

_octopusScheduler_setKeyboardShortcuts = async (payload: {
  shortcuts: KeyboardShortcutWireItem[];
  config: unknown;
  updatedAt: string;
}): Promise<string> => {
  try {
    const kv = container.resolve<IKeyValueStorage>(IKeyValueStorageToken);
    await setKeyboardShortcuts({ kv }, payload);
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    return errorResponse(error);
  }
};

_octopusScheduler_doGet = (
  _e: GoogleAppsScript.Events.DoGet
): GoogleAppsScript.HTML.HtmlOutput => {
  try {
    try {
      // GAS固有のクリーンアップ: 保持しているスクリプトロックがあれば念のため解放する。
      // ドメインの排他制御とは無関係のため、ポート化せずここで直接呼ぶ。
      LockService.getScriptLock().releaseLock();
    } catch {
      // 既存挙動を保持: ロック解放の失敗は無視する。
    }

    const template = HtmlService.createTemplateFromFile("index");
    return template
      .evaluate()
      .setTitle("Sample App")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  } catch (error) {
    console.error(`Error in doGetInternal: ${(error as Error).stack}`);
    return HtmlService.createHtmlOutput(
      `<html><body><h1>エラー</h1><p>アプリケーションの読み込みに失敗しました。</p></body></html>`
    );
  }
};

// 認可ポリシー。表示・参加者向けの読み取りは公開、書き込みと管理操作は管理者のみ(本番モード)。
_octopusScheduler_addDriveData = secure("admin", _octopusScheduler_addDriveData);
_octopusScheduler_getDriveMetaData = secure("public", _octopusScheduler_getDriveMetaData);
_octopusScheduler_getDriveData = secure("public", _octopusScheduler_getDriveData);
_octopusScheduler_updateDriveData = secure("admin", _octopusScheduler_updateDriveData);
_octopusScheduler_getKeyboardShortcuts = secure("public", _octopusScheduler_getKeyboardShortcuts);
_octopusScheduler_setKeyboardShortcuts = secure("admin", _octopusScheduler_setKeyboardShortcuts);

/**
 * Cloudflare Worker から直接importして呼び出すためのハンドラ一覧。
 * doGet は GAS の HtmlService エントリポイント固有の関心事であり、Cloudflare側は
 * 静的アセット配信で代替するため、ここには含めない。
 */
export const OCTOPUS_SCHEDULER_HANDLERS: Record<
  Exclude<OctopusSchedulerEndpointName, "doGet">,
  (args: any) => Promise<string>
> = {
  addDriveData: _octopusScheduler_addDriveData,
  getDriveMetaData: _octopusScheduler_getDriveMetaData,
  getDriveData: _octopusScheduler_getDriveData,
  updateDriveData: _octopusScheduler_updateDriveData,
  getKeyboardShortcuts: _octopusScheduler_getKeyboardShortcuts,
  setKeyboardShortcuts: _octopusScheduler_setKeyboardShortcuts,
};

export { OCTOPUS_SCHEDULER_PREFIX };
