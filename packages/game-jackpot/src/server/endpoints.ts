/**
 * jackpot-game の GAS エンドポイント。
 *
 * 各ハンドラは「引数パース -> use-case 呼び出し -> ApiResponse に詰めて
 * JSON.stringify」という薄い層のみを担う。
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
import type { DriveData, DriveJsonData } from "@octopus/infrastructures/compositions";

import {
  addJackpotDriveData,
  getJackpotDriveData,
  getJackpotDriveMetadata,
} from "./drive-asset-use-cases";
import { addJsonBlob } from "./add-json-blob-use-case";
import { getJsonBlob } from "./get-json-blob-use-case";

function resolveDeps() {
  return {
    storage: container.resolve<IKeyValueStorage>(IKeyValueStorageToken),
    cache: container.resolve<ICache>(ICacheToken),
  };
}

declare let _jackpotGame_addDriveData: (driveData: DriveData) => string;
declare let _jackpotGame_getDriveMetaData: (folderId?: string) => string;
declare let _jackpotGame_getDriveData: (dataId: string) => string;
declare let _jackpotGame_addJson: (driveJson: DriveJsonData) => string;
declare let _jackpotGame_getJson: (fileId?: string) => string;

_jackpotGame_addDriveData = (driveData: DriveData): string => {
  try {
    const result = addJackpotDriveData(resolveDeps(), driveData);
    // 既存挙動を保持: duplicate/error でも常に status:"success" として返す。
    return JSON.stringify({ status: "success", data: result.data! });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_jackpotGame_getDriveMetaData = (folderId?: string): string => {
  try {
    const result = getJackpotDriveMetadata(resolveDeps(), folderId);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_jackpotGame_getDriveData = (dataId: string): string => {
  try {
    const result = getJackpotDriveData(resolveDeps(), dataId);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_jackpotGame_addJson = (driveJson: DriveJsonData): string => {
  try {
    const result = addJsonBlob(resolveDeps(), driveJson);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_jackpotGame_getJson = (fileId?: string): string => {
  try {
    const result = getJsonBlob(resolveDeps(), fileId);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    // 既存挙動を保持: 想定外のエラーでも空配列で成功を返す。
    console.error("_jackpotGame_getJson error:", (error as Error).message);
    return JSON.stringify({
      status: "success",
      data: { json: JSON.stringify([]) },
    });
  }
};
