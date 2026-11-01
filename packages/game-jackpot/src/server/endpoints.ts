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
import { JACKPOT_GAME_PREFIX, JACKPOT_RECORD_FILE, jackpotRecordHashes } from "./jackpot-api-contract";

import { createHashedBlobStore, StorageModule } from "@octopus/infrastructures/compositions";
import { addJsonBlob } from "./add-json-blob-use-case";
import { getJsonBlob } from "./get-json-blob-use-case";
import { secure } from "@octopus/accounts/secure";

/** 景品・画面設定のレコードと、レコードが参照する素材の中身(内容のハッシュを名前にしたファイル)の保存。 */
const store = createHashedBlobStore(StorageModule.Jackpot);

function resolveDeps() {
  return {
    storage: container.resolve<IKeyValueStorage>(IKeyValueStorageToken),
    lock: container.resolve<ILock>(ILockToken),
    now: (): number => Date.now(),
  };
}

declare let _jackpotGame_getRecord: () => Promise<string>;
declare let _jackpotGame_saveRecord: (args: { json: string }) => Promise<string>;
declare let _jackpotGame_existsBlobs: (args: { hashes: string[] }) => Promise<string>;
declare let _jackpotGame_putBlob: (args: { hash: string; dataUrl: string }) => Promise<string>;
declare let _jackpotGame_getBlob: (args: { hash: string }) => Promise<string>;
declare let _jackpotGame_addJson: (blob: JsonBlobWrite) => Promise<string>;
declare let _jackpotGame_getJson: (fileName: string) => Promise<string>;

_jackpotGame_getRecord = async (): Promise<string> =>
  respond(() => store.getRecord(resolveDeps(), { fileName: JACKPOT_RECORD_FILE }));

_jackpotGame_saveRecord = async (args: { json: string }): Promise<string> =>
  respond(() => store.saveRecord(resolveDeps(), { fileName: JACKPOT_RECORD_FILE, json: args.json }, jackpotRecordHashes));

_jackpotGame_existsBlobs = async (args: { hashes: string[] }): Promise<string> =>
  respond(() => store.exists(resolveDeps(), args));

_jackpotGame_putBlob = async (args: { hash: string; dataUrl: string }): Promise<string> =>
  respond(() => store.put(resolveDeps(), args));

_jackpotGame_getBlob = async (args: { hash: string }): Promise<string> =>
  respond(() => store.get(resolveDeps(), args));

_jackpotGame_addJson = async (blob: JsonBlobWrite): Promise<string> => {
  return respond(() => addJsonBlob(resolveDeps(), blob));
};

_jackpotGame_getJson = async (fileName: string): Promise<string> => {
  return respond(() => getJsonBlob(resolveDeps(), fileName));
};

// 認可ポリシー。読み取りも書き込みも管理者のみ(投影用の実行画面もログインして使う。参加者はセッションの公開エンドポイントだけを使う)。
_jackpotGame_getRecord = secure("admin", _jackpotGame_getRecord);
_jackpotGame_saveRecord = secure("admin", _jackpotGame_saveRecord);
_jackpotGame_existsBlobs = secure("admin", _jackpotGame_existsBlobs);
_jackpotGame_putBlob = secure("admin", _jackpotGame_putBlob);
_jackpotGame_getBlob = secure("admin", _jackpotGame_getBlob);
_jackpotGame_addJson = secure("admin", _jackpotGame_addJson);
_jackpotGame_getJson = secure("admin", _jackpotGame_getJson);

/** Cloudflare Worker から直接importして呼び出すためのハンドラ一覧。 */
export const JACKPOT_GAME_HANDLERS: Record<JackpotGameEndpointName, (args: any) => Promise<string>> = {
  getRecord: _jackpotGame_getRecord,
  saveRecord: _jackpotGame_saveRecord,
  existsBlobs: _jackpotGame_existsBlobs,
  putBlob: _jackpotGame_putBlob,
  getBlob: _jackpotGame_getBlob,
  addJson: _jackpotGame_addJson,
  getJson: _jackpotGame_getJson,
};

export { JACKPOT_GAME_PREFIX };
