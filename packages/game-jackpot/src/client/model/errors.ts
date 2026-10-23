/** 探したものが無い。 */
export class NotFoundError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/** 抽選の準備(確変の回の決定と景品の予約)がまだ済んでいない。 */
export class StateNotInitializedError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "StateNotInitializedError";
  }
}

/** 確変のために予約した景品が残っていない。 */
export class NoReservedPrizesError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "NoReservedPrizesError";
  }
}

/** 抽選できる景品が残っていない。 */
export class NoAvailablePrizesError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "NoAvailablePrizesError";
  }
}

/** 抽選の対象（例: エントリーした人）に、まだ当選していない人がいない。 */
export class NoEligibleMembersError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "NoEligibleMembersError";
  }
}

/**
 * 抽選の保存先(サーバーの結果ファイル)が、この結果を受け付けなかった。
 * すでに当選している人・景品、公開されていない別の結果、結果のリセット(別の端末から)などで起きる。
 * 保存先から状態を読み直したうえで投げるので、呼び出し側は引き直せる。
 */
export class DrawConflictError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "DrawConflictError";
  }
}
