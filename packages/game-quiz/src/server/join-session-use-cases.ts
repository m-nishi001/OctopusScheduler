import { DomainError } from "@octopus/infrastructures/interfaces";
import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";
import type { DriveData } from "@octopus/infrastructures/compositions";
import type { QuizSessionScope } from "./quiz-api-contract";
import { sessionKey } from "./session-key";
import { findUserIdByToken } from "./participant-auth-use-cases";
import { readAcceptanceState } from "./acceptance-state";
import { getAnswers } from "./answer-submission-use-cases";
import type { AnswerSubmissionDeps } from "./answer-submission-use-cases";
import { getQuizDriveData, getQuizDriveMetadata } from "./drive-asset-use-cases";
import type { DriveAssetUseCaseDeps } from "./drive-asset-use-cases";
import type { ParticipantState } from "./quiz-api-contract";

const JOIN_KEY_PREFIX = "quiz-game-join";

export interface JoinSessionDeps {
  storage: IKeyValueStorage;
  generateToken: () => string;
}

/**
 * 参加URLに埋め込むトークンを発行する。QR表示(セッション開始)時に rotate=true で
 * 呼んで新しいトークンに切り替え、前回までのURL/QRを無効にする。同じセッション内の
 * 以降の画面(出題画面のQR表示など)は rotate=false で現在のトークンを取得する。
 */
export async function issueJoinToken(
  deps: JoinSessionDeps,
  args: { quizId: string; scope: QuizSessionScope; rotate: boolean }
): Promise<{ joinToken: string }> {
  const key = sessionKey(JOIN_KEY_PREFIX, args.quizId, args.scope);
  if (!args.rotate) {
    const current = await deps.storage.get(key);
    if (current) return { joinToken: current };
  }
  const joinToken = deps.generateToken();
  await deps.storage.set(key, joinToken);
  return { joinToken };
}

/** 参加URLのトークンが現在有効なものか検証する。無効ならthrowする。 */
export async function assertJoinToken(
  storage: IKeyValueStorage,
  args: { quizId: string; scope: QuizSessionScope; joinToken: string }
): Promise<void> {
  const current = await storage.get(sessionKey(JOIN_KEY_PREFIX, args.quizId, args.scope));
  if (!current || !args.joinToken || current !== args.joinToken) {
    throw new DomainError("Join link is no longer valid");
  }
}

/**
 * 参加者端末のポーリング用。受付状態に加え、リロード後に選択状態を復元できるよう
 * 呼び出し元自身の回答(optionNo)を返す。correctNoなど他人の回答は含めない。
 */
export async function getParticipantState(
  deps: AnswerSubmissionDeps,
  args: { quizId: string; scope: QuizSessionScope; joinToken: string; token?: string }
): Promise<ParticipantState> {
  await assertJoinToken(deps.storage, args);
  const acceptance = (await readAcceptanceState(deps.storage, args.quizId, args.scope)) ?? {
    quizId: args.quizId,
    isAccepting: false,
    acceptStartedAtMs: null,
    options: [],
  };
  let myAnswerNo: number | null = null;
  if (args.token) {
    const userId = await findUserIdByToken(deps.storage, args.token);
    if (userId) {
      const answers = await getAnswers(deps, args);
      myAnswerNo = answers.find((a) => a.userId === userId)?.optionNo ?? null;
    }
  }
  return { acceptance, myAnswerNo };
}

/**
 * 選択肢サムネイル。トークンが有効な間だけ、そのクイズの選択肢画像のみ返す。
 * 画像はスロットid(`<quizId>::option::<idx>`)でDriveアセットを引く。
 */
export async function getOptionImage(
  deps: DriveAssetUseCaseDeps,
  args: { quizId: string; scope: QuizSessionScope; joinToken: string; optionIndex: number }
): Promise<{ fileDataUrl: string | null }> {
  await assertJoinToken(deps.storage, args);
  if (!Number.isInteger(args.optionIndex) || args.optionIndex < 0) {
    throw new DomainError("Invalid option index");
  }
  const slotId = `${args.quizId}::option::${args.optionIndex}`;
  const metas = await getQuizDriveMetadata(deps);
  const meta = metas.find((m) => m.driveDataId === slotId);
  if (!meta) return { fileDataUrl: null };
  const data: DriveData | null = await getQuizDriveData(deps, meta.fileId);
  return { fileDataUrl: data?.fileDataUrl ?? null };
}
