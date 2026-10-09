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
import type { JackpotGameEndpointName, JackpotRemoteScreen } from "./jackpot-api-contract";
import { JACKPOT_GAME_PREFIX } from "./jackpot-api-contract";

import {
  addJackpotDriveData,
  getJackpotDriveData,
  getJackpotDriveMetadata,
  updateJackpotDriveData,
} from "./drive-asset-use-cases";
import { addJsonBlob } from "./add-json-blob-use-case";
import { getJsonBlob } from "./get-json-blob-use-case";
import {
  advanceRemoteAction,
  getRemoteControlState,
  setRemoteScreen,
} from "./remote-control-use-cases";
import { secure } from "@octopus/accounts/secure";

function resolveDeps() {
  return {
    storage: container.resolve<IKeyValueStorage>(IKeyValueStorageToken),
    cache: container.resolve<ICache>(ICacheToken),
    now: (): number => Date.now(),
  };
}

declare let _jackpotGame_addDriveData: (driveData: DriveData) => Promise<string>;
declare let _jackpotGame_getDriveMetaData: (folderId?: string) => Promise<string>;
declare let _jackpotGame_getDriveData: (dataId: string) => Promise<string>;
declare let _jackpotGame_updateDriveData: (driveData: DriveData) => Promise<string>;
declare let _jackpotGame_addJson: (driveJson: DriveJsonData) => Promise<string>;
declare let _jackpotGame_getJson: (fileId?: string) => Promise<string>;
declare let _jackpotGame_setRemoteScreen: (screen: JackpotRemoteScreen) => Promise<string>;
declare let _jackpotGame_advanceRemoteAction: () => Promise<string>;
declare let _jackpotGame_getRemoteControlState: () => Promise<string>;

_jackpotGame_addDriveData = async (driveData: DriveData): Promise<string> => {
  try {
    const result = await addJackpotDriveData(resolveDeps(), driveData);
    // 既存挙動を保持: duplicate/error でも常に status:"success" として返す。
    return JSON.stringify({ status: "success", data: result.data! });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_jackpotGame_getDriveMetaData = async (folderId?: string): Promise<string> => {
  try {
    const result = await getJackpotDriveMetadata(resolveDeps());
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_jackpotGame_getDriveData = async (dataId: string): Promise<string> => {
  try {
    const result = await getJackpotDriveData(resolveDeps(), dataId);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_jackpotGame_updateDriveData = async (driveData: DriveData): Promise<string> => {
  try {
    await updateJackpotDriveData(resolveDeps(), driveData);
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_jackpotGame_addJson = async (driveJson: DriveJsonData): Promise<string> => {
  try {
    const result = await addJsonBlob(resolveDeps(), driveJson);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_jackpotGame_getJson = async (fileId?: string): Promise<string> => {
  try {
    const result = await getJsonBlob(resolveDeps(), fileId);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    // 既存挙動を保持: 想定外のエラーでも空配列で成功を返す。
    console.error("_jackpotGame_getJson error:", (error as Error).message);
    return JSON.stringify({
      status: "success",
      data: { json: JSON.stringify([]), updatedAt: null },
    });
  }
};

_jackpotGame_setRemoteScreen = async (screen: JackpotRemoteScreen): Promise<string> => {
  try {
    const result = await setRemoteScreen(resolveDeps(), { screen });
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_jackpotGame_advanceRemoteAction = async (): Promise<string> => {
  try {
    const result = await advanceRemoteAction(resolveDeps());
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_jackpotGame_getRemoteControlState = async (): Promise<string> => {
  try {
    const result = await getRemoteControlState(resolveDeps());
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

// 認可ポリシー。表示・参加者向けの読み取りは公開、書き込みと管理操作は管理者のみ(本番モード)。
_jackpotGame_addDriveData = secure("admin", _jackpotGame_addDriveData);
_jackpotGame_getDriveMetaData = secure("public", _jackpotGame_getDriveMetaData);
_jackpotGame_getDriveData = secure("public", _jackpotGame_getDriveData);
_jackpotGame_updateDriveData = secure("admin", _jackpotGame_updateDriveData);
_jackpotGame_addJson = secure("admin", _jackpotGame_addJson);
_jackpotGame_getJson = secure("public", _jackpotGame_getJson);
_jackpotGame_setRemoteScreen = secure("admin", _jackpotGame_setRemoteScreen);
_jackpotGame_advanceRemoteAction = secure("admin", _jackpotGame_advanceRemoteAction);
_jackpotGame_getRemoteControlState = secure("public", _jackpotGame_getRemoteControlState);

/** Cloudflare Worker から直接importして呼び出すためのハンドラ一覧。 */
export const JACKPOT_GAME_HANDLERS: Record<JackpotGameEndpointName, (args: any) => Promise<string>> = {
  addDriveData: _jackpotGame_addDriveData,
  getDriveMetaData: _jackpotGame_getDriveMetaData,
  getDriveData: _jackpotGame_getDriveData,
  updateDriveData: _jackpotGame_updateDriveData,
  addJson: _jackpotGame_addJson,
  getJson: _jackpotGame_getJson,
  setRemoteScreen: _jackpotGame_setRemoteScreen,
  advanceRemoteAction: _jackpotGame_advanceRemoteAction,
  getRemoteControlState: _jackpotGame_getRemoteControlState,
};

export { JACKPOT_GAME_PREFIX };
