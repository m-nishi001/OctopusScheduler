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
  DataBaseFactoryToken,
} from "@octopus/infrastructures/interfaces";
import type {
  ICache,
  IKeyValueStorage,
  DataBaseFactory,
} from "@octopus/infrastructures/interfaces";
import { GasFormRepository } from "@octopus/infrastructures/gas/gas-form-repository";
import type {
  AddDriveDataArgs,
  AddJsonArgs,
  AddMemberArgs,
  DeleteMemberArgs,
  GetDriveDataArgs,
  GetDriveMetaDataArgs,
  GetJsonArgs,
  GetMappedResponsesArgs,
  GetSheetDataArgs,
  ListJsonMetaDataArgs,
  ListMembersArgs,
  LoadEmailNameMapArgs,
  RemoveDriveDataArgs,
  StopAndGetProcessedResultsArgs,
  StopFormArgs,
  UpdateMemberArgs,
} from "./quiz-api-contract";

import { stopForm } from "./stop-form-use-case";
import { getSheetData } from "./get-sheet-data-use-case";
import { loadEmailNameMap } from "./load-email-name-map-use-case";
import { getMappedResponses } from "./get-mapped-responses-use-case";
import { stopAndGetProcessedResults } from "./stop-and-get-processed-results-use-case";
import {
  addQuizDriveData,
  getQuizDriveData,
  getQuizDriveMetadata,
  removeQuizDriveData,
} from "./drive-asset-use-cases";
import { addJsonBlob } from "./add-json-blob-use-case";
import { getJsonBlob } from "./get-json-blob-use-case";
import { listJsonBlobMetadata } from "./list-json-blob-metadata-use-case";
import {
  addMember,
  deleteMember,
  listMembers,
  updateMember,
} from "./member-use-cases";

function resolveDeps() {
  return {
    storage: container.resolve<IKeyValueStorage>(IKeyValueStorageToken),
    cache: container.resolve<ICache>(ICacheToken),
    form: container.resolve(GasFormRepository),
    dataBaseFactory: container.resolve<DataBaseFactory>(DataBaseFactoryToken),
  };
}

declare let _quizGame_stopForm: (args: StopFormArgs) => string;
declare let _quizGame_getSheetData: (args: GetSheetDataArgs) => string;
declare let _quizGame_stopAndGetProcessedResults: (
  args: StopAndGetProcessedResultsArgs
) => string;
declare let _quizGame_loadEmailNameMap: (args: LoadEmailNameMapArgs) => string;
declare let _quizGame_getMappedResponses: (
  args: GetMappedResponsesArgs
) => string;
declare let _quizGame_addDriveData: (args: AddDriveDataArgs) => string;
declare let _quizGame_getDriveMetaData: (args: GetDriveMetaDataArgs) => string;
declare let _quizGame_getDriveData: (args: GetDriveDataArgs) => string;
declare let _quizGame_removeDriveData: (args: RemoveDriveDataArgs) => string;
declare let _quizGame_addJson: (args: AddJsonArgs) => string;
declare let _quizGame_getJson: (args: GetJsonArgs) => string;
declare let _quizGame_listJsonMetaData: (args: ListJsonMetaDataArgs) => string;
declare let _quizGame_listMembers: (args: ListMembersArgs) => string;
declare let _quizGame_addMember: (args: AddMemberArgs) => string;
declare let _quizGame_updateMember: (args: UpdateMemberArgs) => string;
declare let _quizGame_deleteMember: (args: DeleteMemberArgs) => string;

_quizGame_stopForm = (args: StopFormArgs): string => {
  try {
    stopForm(resolveDeps(), args.quizId);
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_quizGame_getSheetData = (args: GetSheetDataArgs): string => {
  try {
    const rows = getSheetData(resolveDeps(), args.quizId);
    return JSON.stringify({ status: "success", data: rows });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_quizGame_loadEmailNameMap = (_args: LoadEmailNameMapArgs): string => {
  try {
    loadEmailNameMap(resolveDeps());
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_quizGame_getMappedResponses = (args: GetMappedResponsesArgs): string => {
  try {
    const out = getMappedResponses(resolveDeps(), args.formId);
    return JSON.stringify({ status: "success", data: out });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_quizGame_stopAndGetProcessedResults = (
  args: StopAndGetProcessedResultsArgs
): string => {
  try {
    const results = stopAndGetProcessedResults(resolveDeps(), args);
    return JSON.stringify({ status: "success", data: results });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_quizGame_addDriveData = (args: AddDriveDataArgs): string => {
  try {
    const result = addQuizDriveData(resolveDeps(), args.driveData);
    // 既存挙動を保持: duplicate/error でも常に status:"success" として返す。
    return JSON.stringify({ status: "success", data: result.data! });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_quizGame_getDriveMetaData = (args: GetDriveMetaDataArgs): string => {
  try {
    const result = getQuizDriveMetadata(resolveDeps(), args.folderId);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_quizGame_getDriveData = (args: GetDriveDataArgs): string => {
  try {
    const result = getQuizDriveData(resolveDeps(), args.dataId);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_quizGame_removeDriveData = (args: RemoveDriveDataArgs): string => {
  try {
    removeQuizDriveData(resolveDeps(), args.dataId);
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_quizGame_addJson = (args: AddJsonArgs): string => {
  try {
    const result = addJsonBlob(resolveDeps(), args.driveJson);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_quizGame_getJson = (args: GetJsonArgs): string => {
  try {
    const result = getJsonBlob(resolveDeps(), args.fileId);
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

_quizGame_listJsonMetaData = (args: ListJsonMetaDataArgs): string => {
  try {
    const result = listJsonBlobMetadata(resolveDeps(), args.folderId);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_quizGame_listMembers = (_args: ListMembersArgs): string => {
  try {
    const result = listMembers(resolveDeps());
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_quizGame_addMember = (args: AddMemberArgs): string => {
  try {
    const result = addMember(resolveDeps(), args);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_quizGame_updateMember = (args: UpdateMemberArgs): string => {
  try {
    const result = updateMember(resolveDeps(), args);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_quizGame_deleteMember = (args: DeleteMemberArgs): string => {
  try {
    deleteMember(resolveDeps(), args.userId);
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};
