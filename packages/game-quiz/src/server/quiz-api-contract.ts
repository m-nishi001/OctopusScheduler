/**
 * quiz-game の GAS エンドポイント契約(唯一の正準定義)。
 *
 * クライアント(client/model/domains/repositories)とサーバー(server/endpoints.ts)の
 * 両方がここから型を参照する。エンドポイント名一覧は infrastructures/gas の
 * esbuild banner/footer コード生成、および scripts/gas-contract.js の集約対象になる。
 */
import type { DriveData, DriveJsonData } from "@octopus/infrastructures/interfaces";

export const QUIZ_GAME_PREFIX = "quizGame" as const;

export const QUIZ_GAME_ENDPOINTS = [
  "stopForm",
  "getSheetData",
  "stopAndGetProcessedResults",
  "loadEmailNameMap",
  "getMappedResponses",
  "addDriveData",
  "getDriveMetaData",
  "getDriveData",
  "removeDriveData",
  "addJson",
  "getJson",
  "listJsonMetaData",
] as const;

export type QuizGameEndpointName = (typeof QUIZ_GAME_ENDPOINTS)[number];

export type QuizGameFunctionName =
  `${typeof QUIZ_GAME_PREFIX}_${QuizGameEndpointName}`;

export interface SheetRow {
  name: string;
  time: number;
}

export interface QuizWithDataUrl {
  id: string;
  title: string;
  question: string;
  options: { no: number; text: string; color: string; image: string | null }[];
  correctNo: number;
  formUrl: string;
  answerFormId: string;
  timeLimit: number;
  bgm: string | null;
  settings?: {
    correctBgmDataUrl: string | null;
    prizeImageDataUrl: string | null;
    prizeName: string;
    prizeBgmDataUrl: string | null;
  };
}

export interface ProcessedResultDto {
  playerId?: string | null;
  playerName?: string | null;
  isCorrect: boolean;
  timeToAnswerMs: number;
  timestampMs: number;
  rank?: number | null;
  rawRow?: unknown[];
}

// GAS function argument types
export interface StopFormArgs {
  quizId: string;
}

export interface GetSheetDataArgs {
  quizId: string;
}

export interface StopAndGetProcessedResultsArgs {
  quizId: string;
  quizStartTimeMs: number;
  answerKey: string;
  correctValue: string;
}

export type LoadEmailNameMapArgs = Record<string, never>;

export interface GetMappedResponsesArgs {
  formId: string;
}

export interface AddDriveDataArgs {
  driveData: DriveData;
}

export interface GetDriveMetaDataArgs {
  folderId?: string;
}

export interface GetDriveDataArgs {
  dataId: string;
}

export interface RemoveDriveDataArgs {
  dataId: string;
}

export interface AddJsonArgs {
  driveJson: DriveJsonData;
}

export interface GetJsonArgs {
  fileId?: string;
}

export interface ListJsonMetaDataArgs {
  folderId?: string;
}
