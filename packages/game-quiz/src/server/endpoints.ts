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
import { respond, IKeyValueStorageToken, ILockToken } from "@octopus/infrastructures/interfaces";
import type { IKeyValueStorage, ILock } from "@octopus/infrastructures/interfaces";
import { container } from "tsyringe";
import type {
  ExistsBlobsArgs,
  GetBlobArgs,
  PutBlobArgs,
  QuizGameEndpointName,
  SaveRecordArgs,
} from "./quiz-api-contract";
import { QUIZ_GAME_PREFIX, QUIZ_RECORD_FILE, quizRecordHashes } from "./quiz-api-contract";

import { createHashedBlobStore, StorageModule } from "@octopus/infrastructures/compositions";
import { secure } from "@octopus/accounts/secure";

/** 一覧と、一覧が参照する画像・音声(内容のハッシュを名前にしたファイル)の保存。 */
const store = createHashedBlobStore(StorageModule.Quiz);

function resolveDeps() {
  return {
    storage: container.resolve<IKeyValueStorage>(IKeyValueStorageToken),
    lock: container.resolve<ILock>(ILockToken),
  };
}

declare let _quizGame_getRecord: (args: Record<string, never>) => Promise<string>;
declare let _quizGame_saveRecord: (args: SaveRecordArgs) => Promise<string>;
declare let _quizGame_existsBlobs: (args: ExistsBlobsArgs) => Promise<string>;
declare let _quizGame_putBlob: (args: PutBlobArgs) => Promise<string>;
declare let _quizGame_getBlob: (args: GetBlobArgs) => Promise<string>;

_quizGame_getRecord = async (_args): Promise<string> =>
  respond(() => store.getRecord(resolveDeps(), { fileName: QUIZ_RECORD_FILE }));

_quizGame_saveRecord = async (args: SaveRecordArgs): Promise<string> =>
  respond(() => store.saveRecord(resolveDeps(), { fileName: QUIZ_RECORD_FILE, json: args.json }, quizRecordHashes));

_quizGame_existsBlobs = async (args: ExistsBlobsArgs): Promise<string> =>
  respond(() => store.exists(resolveDeps(), args));

_quizGame_putBlob = async (args: PutBlobArgs): Promise<string> =>
  respond(() => store.put(resolveDeps(), args));

_quizGame_getBlob = async (args: GetBlobArgs): Promise<string> =>
  respond(() => store.get(resolveDeps(), args));

// 認可ポリシー。読み取りも書き込みも管理者のみ(投影用の実行画面もログインして使う。参加者はセッションの公開エンドポイントだけを使う)。
_quizGame_getRecord = secure("admin", _quizGame_getRecord);
_quizGame_saveRecord = secure("admin", _quizGame_saveRecord);
_quizGame_existsBlobs = secure("admin", _quizGame_existsBlobs);
_quizGame_putBlob = secure("admin", _quizGame_putBlob);
_quizGame_getBlob = secure("admin", _quizGame_getBlob);

/** Cloudflare Worker から直接importして呼び出すためのハンドラ一覧。 */
export const QUIZ_GAME_HANDLERS: Record<QuizGameEndpointName, (args: any) => Promise<string>> = {
  getRecord: _quizGame_getRecord,
  saveRecord: _quizGame_saveRecord,
  existsBlobs: _quizGame_existsBlobs,
  putBlob: _quizGame_putBlob,
  getBlob: _quizGame_getBlob,
};

export { QUIZ_GAME_PREFIX };
