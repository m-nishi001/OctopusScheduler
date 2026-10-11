/**
 * 抽選の対象（メンバー抽選の候補）を、ジャックポットの外から絞り込むためのポート。
 * 例: イベントにエントリーした人だけを抽選の対象にする（アプリのホストが実装を渡す）。
 * 既定は全メンバー（絞り込みなし）。
 */
export interface DrawPoolProvider {
  /**
   * 抽選の対象にするメンバーIDの一覧。null なら全メンバー（絞り込みなし）。
   * 一覧を取得できないときは、全メンバーにフォールバックせず例外を投げること
   * （対象外の人が当選する事故を防ぐ）。
   */
  getEligibleMemberIds(): Promise<string[] | null>;
}

export const DrawPoolProviderToken = Symbol("DrawPoolProvider");

/** 既定の対象: 全メンバー。 */
export class AllMembersDrawPool implements DrawPoolProvider {
  async getEligibleMemberIds(): Promise<string[] | null> {
    return null;
  }
}
