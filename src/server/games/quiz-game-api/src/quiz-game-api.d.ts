/**
 * Quiz game API types
 */

import type { DriveData, DriveJsonData } from "../../../common/src/drive-types";

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
  rawRow?: any[];
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

export interface LoadEmailNameMapArgs {}

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

export interface UpdateDriveDataArgs {
  driveData: DriveData;
}

export interface AddJsonArgs {
  driveJson: DriveJsonData;
}

export interface GetJsonArgs {
  fileId?: string;
}

export interface AddJsonDataArgs {
  driveJson: DriveJsonData;
}

export interface GetJsonDataArgs {
  fileId?: string;
}

export interface ListJsonMetaDataArgs {
  folderId?: string;
}

export interface UpdateJsonDataArgs {
  driveJson: DriveJsonData;
}

export interface TrashFolderContentsArgs {
  folderId?: string;
}
