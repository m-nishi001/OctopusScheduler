/**
 * スクリプト単位のロックの抽象化(GASでは LockService)。
 *
 * 現状の利用箇所(doGet)は「保持しているロックを念のため解放する」という
 * ベストエフォートな呼び出しのみのため、最小限のメソッドだけを定義する。
 */
export interface ILockRepository {
  /** ロックを保持していれば解放する。失敗しても例外を投げない。 */
  tryReleaseScriptLock(): void;
}

export const ILockRepositoryToken = Symbol("ILockRepository");
