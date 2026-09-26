/**
 * quiz-game の GAS エンドポイント。
 *
 * 各ハンドラは「引数パース -> use-case 呼び出し -> ApiResponse に詰めて
 * JSON.stringify」という薄い層のみを担う。ビジネスロジックは同ディレクトリの
 * 各 use-case ファイルにある。リポジトリ実装は infrastructures/gas/container.ts
 * が起動時に登録したものを tsyringe コンテナから解決する。
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
import type {
  AddDriveDataArgs,
  AddJsonArgs,
  GetAcceptanceStateArgs,
  GetAnswersArgs,
  GetDriveDataArgs,
  GetDriveMetaDataArgs,
  GetJsonArgs,
  ListJsonMetaDataArgs,
  LoginParticipantArgs,
  RemoveDriveDataArgs,
  ResolveDeviceTokenArgs,
  StartAcceptingAnswersArgs,
  StopAcceptingAnswersArgs,
  SubmitAnswerArgs,
} from "./quiz-api-contract";

import {
  addQuizDriveData,
  getQuizDriveData,
  getQuizDriveMetadata,
  removeQuizDriveData,
} from "./drive-asset-use-cases";
import { addJsonBlob } from "./add-json-blob-use-case";
import { getJsonBlob } from "./get-json-blob-use-case";
import { listJsonBlobMetadata } from "./list-json-blob-metadata-use-case";
import { loginParticipant, resolveDeviceToken } from "./participant-auth-use-cases";
import {
  getAcceptanceState,
  startAcceptingAnswers,
  stopAcceptingAnswers,
} from "./answer-session-use-cases";
import { getAnswers, submitAnswer } from "./answer-submission-use-cases";

function resolveDeps() {
  return {
    storage: container.resolve<IKeyValueStorage>(IKeyValueStorageToken),
    cache: container.resolve<ICache>(ICacheToken),
    // GAS本番のUUID生成。node環境のテストではこの関数はGASグローバルに
    // 触れないよう、各use-caseのテストで別途スタブを注入する。
    generateToken: (): string => Utilities.getUuid(),
    // findMemberById(@octopus/member-directory)呼び出しのために必要
    // (このuse-case経由では新規メンバー作成は行わないため実際には使われない)。
    generateId: (): string => Utilities.getUuid(),
    now: (): number => Date.now(),
  };
}

declare let _quizGame_addDriveData: (args: AddDriveDataArgs) => Promise<string>;
declare let _quizGame_getDriveMetaData: (args: GetDriveMetaDataArgs) => Promise<string>;
declare let _quizGame_getDriveData: (args: GetDriveDataArgs) => Promise<string>;
declare let _quizGame_removeDriveData: (args: RemoveDriveDataArgs) => Promise<string>;
declare let _quizGame_addJson: (args: AddJsonArgs) => Promise<string>;
declare let _quizGame_getJson: (args: GetJsonArgs) => Promise<string>;
declare let _quizGame_listJsonMetaData: (args: ListJsonMetaDataArgs) => Promise<string>;
declare let _quizGame_loginParticipant: (args: LoginParticipantArgs) => Promise<string>;
declare let _quizGame_resolveDeviceToken: (args: ResolveDeviceTokenArgs) => Promise<string>;
declare let _quizGame_startAcceptingAnswers: (args: StartAcceptingAnswersArgs) => Promise<string>;
declare let _quizGame_stopAcceptingAnswers: (args: StopAcceptingAnswersArgs) => Promise<string>;
declare let _quizGame_getAcceptanceState: (args: GetAcceptanceStateArgs) => Promise<string>;
declare let _quizGame_submitAnswer: (args: SubmitAnswerArgs) => Promise<string>;
declare let _quizGame_getAnswers: (args: GetAnswersArgs) => Promise<string>;

_quizGame_addDriveData = async (args: AddDriveDataArgs): Promise<string> => {
  try {
    const result = await addQuizDriveData(resolveDeps(), args.driveData);
    // 既存挙動を保持: duplicate/error でも常に status:"success" として返す。
    return JSON.stringify({ status: "success", data: result.data! });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_quizGame_getDriveMetaData = async (args: GetDriveMetaDataArgs): Promise<string> => {
  try {
    const result = await getQuizDriveMetadata(resolveDeps(), args.folderId);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_quizGame_getDriveData = async (args: GetDriveDataArgs): Promise<string> => {
  try {
    const result = await getQuizDriveData(resolveDeps(), args.dataId);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_quizGame_removeDriveData = async (args: RemoveDriveDataArgs): Promise<string> => {
  try {
    await removeQuizDriveData(resolveDeps(), args.dataId);
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_quizGame_addJson = async (args: AddJsonArgs): Promise<string> => {
  try {
    const result = await addJsonBlob(resolveDeps(), args.driveJson);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_quizGame_getJson = async (args: GetJsonArgs): Promise<string> => {
  try {
    const result = await getJsonBlob(resolveDeps(), args.fileId);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    // 既存挙動を保持: 想定外のエラーでも空配列で成功を返す。
    console.error("_quizGame_getJson error:", (error as Error).message);
    return JSON.stringify({
      status: "success",
      data: { json: JSON.stringify([]) },
    });
  }
};

_quizGame_listJsonMetaData = async (args: ListJsonMetaDataArgs): Promise<string> => {
  try {
    const result = await listJsonBlobMetadata(resolveDeps(), args.folderId);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_quizGame_loginParticipant = async (args: LoginParticipantArgs): Promise<string> => {
  try {
    const result = await loginParticipant(resolveDeps(), args);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_quizGame_resolveDeviceToken = async (args: ResolveDeviceTokenArgs): Promise<string> => {
  try {
    const result = await resolveDeviceToken(resolveDeps(), args);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_quizGame_startAcceptingAnswers = async (args: StartAcceptingAnswersArgs): Promise<string> => {
  try {
    const result = await startAcceptingAnswers(resolveDeps(), args);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_quizGame_stopAcceptingAnswers = async (args: StopAcceptingAnswersArgs): Promise<string> => {
  try {
    const result = await stopAcceptingAnswers(resolveDeps(), args);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_quizGame_getAcceptanceState = async (args: GetAcceptanceStateArgs): Promise<string> => {
  try {
    const result = await getAcceptanceState(resolveDeps(), args);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_quizGame_submitAnswer = async (args: SubmitAnswerArgs): Promise<string> => {
  // 複数参加者からの同時送信でread-modify-writeが競合しないようスクリプトロックで保護する。
  // ドメインの排他制御とは無関係のGAS固有の関心事のため、use-case層には持ち込まずここで直接扱う。
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
  } catch {
    return JSON.stringify({
      status: "error",
      message: "Server is busy, please try again.",
    });
  }
  try {
    const result = await submitAnswer(resolveDeps(), args);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  } finally {
    lock.releaseLock();
  }
};

_quizGame_getAnswers = async (args: GetAnswersArgs): Promise<string> => {
  try {
    const result = await getAnswers(resolveDeps(), args);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};
