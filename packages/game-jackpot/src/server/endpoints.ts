/**
 * jackpot-game の GAS エンドポイント。
 *
 * 各ハンドラは「引数パース -> use-case 呼び出し -> ApiResponse に詰めて
 * JSON.stringify」という薄い層のみを担う。
 */
import { respond, IKeyValueStorageToken, ILockToken } from "@octopus/infrastructures/interfaces";
import { container } from "tsyringe";
import type { IKeyValueStorage, ILock } from "@octopus/infrastructures/interfaces";
import type { JackpotGameEndpointName, JsonBlobWrite } from "./jackpot-api-contract";
import { ASSET_RECORD_FILE, JACKPOT_GAME_PREFIX, assetRecordHashes } from "./jackpot-api-contract";

import { createHashedBlobStore, StorageModule } from "@octopus/infrastructures/compositions";
import { addJsonBlob } from "./add-json-blob-use-case";
import { getJsonBlob } from "./get-json-blob-use-case";
import { secure } from "@octopus/accounts/secure";

/** 素材の一覧と、一覧が参照する素材の中身(内容のハッシュを名前にしたファイル)の保存。 */
const store = createHashedBlobStore(StorageModule.Jackpot);

function resolveDeps() {
  return {
    storage: container.resolve<IKeyValueStorage>(IKeyValueStorageToken),
    lock: container.resolve<ILock>(ILockToken),
    now: (): number => Date.now(),
  };
}

declare let _jackpotGame_getAssetRecord: () => Promise<string>;
declare let _jackpotGame_saveAssetRecord: (args: { json: string }) => Promise<string>;
declare let _jackpotGame_existsAssetBlobs: (args: { hashes: string[] }) => Promise<string>;
declare let _jackpotGame_putAssetBlob: (args: { hash: string; dataUrl: string }) => Promise<string>;
declare let _jackpotGame_getAssetBlob: (args: { hash: string }) => Promise<string>;
declare let _jackpotGame_addJson: (blob: JsonBlobWrite) => Promise<string>;
declare let _jackpotGame_getJson: (fileName: string) => Promise<string>;

_jackpotGame_getAssetRecord = async (): Promise<string> =>
  respond(() => store.getRecord(resolveDeps(), { fileName: ASSET_RECORD_FILE }));

_jackpotGame_saveAssetRecord = async (args: { json: string }): Promise<string> =>
  respond(() => store.saveRecord(resolveDeps(), { fileName: ASSET_RECORD_FILE, json: args.json }, assetRecordHashes));

_jackpotGame_existsAssetBlobs = async (args: { hashes: string[] }): Promise<string> =>
  respond(() => store.exists(resolveDeps(), args));

_jackpotGame_putAssetBlob = async (args: { hash: string; dataUrl: string }): Promise<string> =>
  respond(() => store.put(resolveDeps(), args));

_jackpotGame_getAssetBlob = async (args: { hash: string }): Promise<string> =>
  respond(() => store.get(resolveDeps(), args));

_jackpotGame_addJson = async (blob: JsonBlobWrite): Promise<string> => {
  return respond(() => addJsonBlob(resolveDeps(), blob));
};

_jackpotGame_getJson = async (fileName: string): Promise<string> => {
  return respond(() => getJsonBlob(resolveDeps(), fileName));
};

// 認可ポリシー。読み取りも書き込みも管理者のみ(投影用の実行画面もログインして使う。参加者はセッションの公開エンドポイントだけを使う)。
_jackpotGame_getAssetRecord = secure("admin", _jackpotGame_getAssetRecord);
_jackpotGame_saveAssetRecord = secure("admin", _jackpotGame_saveAssetRecord);
_jackpotGame_existsAssetBlobs = secure("admin", _jackpotGame_existsAssetBlobs);
_jackpotGame_putAssetBlob = secure("admin", _jackpotGame_putAssetBlob);
_jackpotGame_getAssetBlob = secure("admin", _jackpotGame_getAssetBlob);
_jackpotGame_addJson = secure("admin", _jackpotGame_addJson);
_jackpotGame_getJson = secure("admin", _jackpotGame_getJson);

/** Cloudflare Worker から直接importして呼び出すためのハンドラ一覧。 */
export const JACKPOT_GAME_HANDLERS: Record<JackpotGameEndpointName, (args: any) => Promise<string>> = {
  getAssetRecord: _jackpotGame_getAssetRecord,
  saveAssetRecord: _jackpotGame_saveAssetRecord,
  existsAssetBlobs: _jackpotGame_existsAssetBlobs,
  putAssetBlob: _jackpotGame_putAssetBlob,
  getAssetBlob: _jackpotGame_getAssetBlob,
  addJson: _jackpotGame_addJson,
  getJson: _jackpotGame_getJson,
};

export { JACKPOT_GAME_PREFIX };
