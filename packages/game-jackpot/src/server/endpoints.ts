/**
 * jackpot-game の GAS エンドポイント。
 *
 * 各ハンドラは「引数パース -> use-case 呼び出し -> ApiResponse に詰めて
 * JSON.stringify」という薄い層のみを担う。
 */
import { respond } from "@octopus/infrastructures/interfaces";
import { container } from "tsyringe";
import {
  IKeyValueStorageToken,
} from "@octopus/infrastructures/interfaces";
import type {
  IKeyValueStorage,
} from "@octopus/infrastructures/interfaces";
import type { DriveData, DriveJsonData } from "@octopus/infrastructures/compositions";
import type { JackpotGameEndpointName } from "./jackpot-api-contract";
import { JACKPOT_GAME_PREFIX } from "./jackpot-api-contract";

import { createDriveAssets, StorageKind, StorageModule } from "@octopus/infrastructures/compositions";
import { addJsonBlob } from "./add-json-blob-use-case";
import { getJsonBlob } from "./get-json-blob-use-case";
import { secure } from "@octopus/accounts/secure";

/** この置き場の素材の保存・一覧・取得。 */
const assets = createDriveAssets(StorageModule.Jackpot, StorageKind.Assets);

function resolveDeps() {
  return {
    storage: container.resolve<IKeyValueStorage>(IKeyValueStorageToken),
    now: (): number => Date.now(),
  };
}

declare let _jackpotGame_addDriveData: (driveData: DriveData) => Promise<string>;
declare let _jackpotGame_getDriveMetaData: (folderId?: string) => Promise<string>;
declare let _jackpotGame_getDriveData: (dataId: string) => Promise<string>;
declare let _jackpotGame_updateDriveData: (driveData: DriveData) => Promise<string>;
declare let _jackpotGame_addJson: (driveJson: DriveJsonData) => Promise<string>;
declare let _jackpotGame_getJson: (fileId?: string) => Promise<string>;

_jackpotGame_addDriveData = async (driveData: DriveData): Promise<string> => {
  return respond(() => assets.save(resolveDeps(), driveData));
};

_jackpotGame_getDriveMetaData = async (folderId?: string): Promise<string> => {
  return respond(() => assets.listMetadata(resolveDeps()));
};

_jackpotGame_getDriveData = async (dataId: string): Promise<string> => {
  return respond(() => assets.get(resolveDeps(), dataId));
};

_jackpotGame_updateDriveData = async (driveData: DriveData): Promise<string> => {
  return respond(() => assets.save(resolveDeps(), driveData));
};

_jackpotGame_addJson = async (driveJson: DriveJsonData): Promise<string> => {
  return respond(() => addJsonBlob(resolveDeps(), driveJson));
};

_jackpotGame_getJson = async (fileId?: string): Promise<string> => {
  return respond(() => getJsonBlob(resolveDeps(), fileId));
};

// 認可ポリシー。読み取りも書き込みも管理者のみ(投影用の実行画面もログインして使う。参加者はセッションの公開エンドポイントだけを使う)。
_jackpotGame_addDriveData = secure("admin", _jackpotGame_addDriveData);
_jackpotGame_getDriveMetaData = secure("admin", _jackpotGame_getDriveMetaData);
_jackpotGame_getDriveData = secure("admin", _jackpotGame_getDriveData);
_jackpotGame_updateDriveData = secure("admin", _jackpotGame_updateDriveData);
_jackpotGame_addJson = secure("admin", _jackpotGame_addJson);
_jackpotGame_getJson = secure("admin", _jackpotGame_getJson);

/** Cloudflare Worker から直接importして呼び出すためのハンドラ一覧。 */
export const JACKPOT_GAME_HANDLERS: Record<JackpotGameEndpointName, (args: any) => Promise<string>> = {
  addDriveData: _jackpotGame_addDriveData,
  getDriveMetaData: _jackpotGame_getDriveMetaData,
  getDriveData: _jackpotGame_getDriveData,
  updateDriveData: _jackpotGame_updateDriveData,
  addJson: _jackpotGame_addJson,
  getJson: _jackpotGame_getJson,
};

export { JACKPOT_GAME_PREFIX };
