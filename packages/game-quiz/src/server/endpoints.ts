/**
 * quiz-game の GAS エンドポイント。
 *
 * クイズの問題・画像などのデータ(Drive/JSON)だけを扱う。参加者の回答の受付・集計は
 * セッション基盤(@octopus/session-hub の回答ラウンド)が担当する。
 *
 * 各ハンドラは「引数パース -> use-case 呼び出し -> ApiResponse に詰めて
 * JSON.stringify」という薄い層のみを担う。ビジネスロジックは同ディレクトリの
 * 各 use-case ファイルにある。リポジトリ実装は infrastructures/gas/container.ts
 * が起動時に登録したものを tsyringe コンテナから解決する。
 */
import { respond } from "@octopus/infrastructures/interfaces";
import { container } from "tsyringe";
import { IKeyValueStorageToken } from "@octopus/infrastructures/interfaces";
import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";
import type {
  AddDriveDataArgs,
  AddJsonArgs,
  GetDriveDataArgs,
  GetDriveMetaDataArgs,
  GetJsonArgs,
  QuizGameEndpointName,
  UpdateDriveDataArgs,
} from "./quiz-api-contract";
import { QUIZ_GAME_PREFIX } from "./quiz-api-contract";

import { createDriveAssets, StorageKind, StorageModule } from "@octopus/infrastructures/compositions";
import { addJsonBlob } from "./add-json-blob-use-case";
import { getJsonBlob } from "./get-json-blob-use-case";
import { secure } from "@octopus/accounts/secure";

/** この置き場の素材の保存・一覧・取得。 */
const assets = createDriveAssets(StorageModule.Quiz, StorageKind.Assets);

function resolveDeps() {
  return {
    storage: container.resolve<IKeyValueStorage>(IKeyValueStorageToken),
    now: (): number => Date.now(),
  };
}

declare let _quizGame_addDriveData: (args: AddDriveDataArgs) => Promise<string>;
declare let _quizGame_getDriveMetaData: (args: GetDriveMetaDataArgs) => Promise<string>;
declare let _quizGame_getDriveData: (args: GetDriveDataArgs) => Promise<string>;
declare let _quizGame_updateDriveData: (args: UpdateDriveDataArgs) => Promise<string>;
declare let _quizGame_addJson: (args: AddJsonArgs) => Promise<string>;
declare let _quizGame_getJson: (args: GetJsonArgs) => Promise<string>;

_quizGame_addDriveData = async (args: AddDriveDataArgs): Promise<string> => {
  return respond(() => assets.save(resolveDeps(), args.driveData));
};

_quizGame_getDriveMetaData = async (_args: GetDriveMetaDataArgs): Promise<string> => {
  return respond(() => assets.listMetadata(resolveDeps()));
};

_quizGame_getDriveData = async (args: GetDriveDataArgs): Promise<string> => {
  return respond(() => assets.get(resolveDeps(), args.dataId));
};

_quizGame_updateDriveData = async (args: UpdateDriveDataArgs): Promise<string> => {
  return respond(() => assets.save(resolveDeps(), args.driveData));
};

_quizGame_addJson = async (args: AddJsonArgs): Promise<string> => {
  return respond(() => addJsonBlob(resolveDeps(), args));
};

_quizGame_getJson = async (args: GetJsonArgs): Promise<string> => {
  return respond(() => getJsonBlob(resolveDeps(), args.fileName));
};

// 認可ポリシー。読み取りも書き込みも管理者のみ(投影用の実行画面もログインして使う。参加者はセッションの公開エンドポイントだけを使う)。
_quizGame_addDriveData = secure("admin", _quizGame_addDriveData);
_quizGame_getDriveMetaData = secure("admin", _quizGame_getDriveMetaData);
_quizGame_getDriveData = secure("admin", _quizGame_getDriveData);
_quizGame_updateDriveData = secure("admin", _quizGame_updateDriveData);
_quizGame_addJson = secure("admin", _quizGame_addJson);
_quizGame_getJson = secure("admin", _quizGame_getJson);

/** Cloudflare Worker から直接importして呼び出すためのハンドラ一覧。 */
export const QUIZ_GAME_HANDLERS: Record<QuizGameEndpointName, (args: any) => Promise<string>> = {
  addDriveData: _quizGame_addDriveData,
  getDriveMetaData: _quizGame_getDriveMetaData,
  getDriveData: _quizGame_getDriveData,
  updateDriveData: _quizGame_updateDriveData,
  addJson: _quizGame_addJson,
  getJson: _quizGame_getJson,
};

export { QUIZ_GAME_PREFIX };
