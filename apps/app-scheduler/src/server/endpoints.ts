/**
 * octopus-scheduler(ホスト本体)の GAS エンドポイント。
 *
 * 各ハンドラは「引数パース -> use-case 呼び出し -> ApiResponse に詰めて
 * JSON.stringify」という薄い層のみを担う。`doGet` は GAS Web アプリの
 * エントリポイントで、HtmlService の呼び出しはこのファイルに留める
 * (エントリポイント固有の関心事であり、ポート化しない)。
 */
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

function resolveDeps() {
  return {
    storage: container.resolve<IKeyValueStorage>(IKeyValueStorageToken),
    cache: container.resolve<ICache>(ICacheToken),
  };
}

declare let _octopusScheduler_doGet: (
  e: GoogleAppsScript.Events.DoGet
) => GoogleAppsScript.HTML.HtmlOutput;
declare let _octopusScheduler_addDriveData: (driveData: DriveData) => string;
declare let _octopusScheduler_getDriveMetaData: (folderId?: string) => string;
declare let _octopusScheduler_getDriveData: (dataId: string) => string;
declare let _octopusScheduler_updateDriveData: (driveData: DriveData) => string;
declare let _octopusScheduler_getKeyboardShortcuts: () => string;
declare let _octopusScheduler_setKeyboardShortcuts: (payload: {
  shortcuts: string[][];
  config: unknown;
}) => string;

_octopusScheduler_addDriveData = (driveData: DriveData): string => {
  try {
    const result = addSchedulerDriveData(resolveDeps(), driveData);
    // 既存挙動を保持: duplicate/error でも常に status:"success" として返す。
    return JSON.stringify({ status: "success", data: result.data! });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_octopusScheduler_getDriveMetaData = (folderId?: string): string => {
  try {
    const result = getSchedulerDriveMetadata(resolveDeps(), folderId);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_octopusScheduler_getDriveData = (dataId: string): string => {
  try {
    const result = getSchedulerDriveData(resolveDeps(), dataId);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_octopusScheduler_updateDriveData = (driveData: DriveData): string => {
  try {
    updateSchedulerDriveData(resolveDeps(), driveData);
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_octopusScheduler_getKeyboardShortcuts = (): string => {
  try {
    const kv = container.resolve<IKeyValueStorage>(IKeyValueStorageToken);
    const result = getKeyboardShortcuts({ kv });
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_octopusScheduler_setKeyboardShortcuts = (payload: {
  shortcuts: string[][];
  config: unknown;
}): string => {
  try {
    const kv = container.resolve<IKeyValueStorage>(IKeyValueStorageToken);
    setKeyboardShortcuts({ kv }, payload);
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
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
