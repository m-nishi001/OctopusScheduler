// ジャックポットの抽選対象(メンバーごとの明示フラグ。管理者かどうかとは無関係)の公開 API。
// ルーターや画面を引き込まないよう、`@octopus/game-jackpot` の本体とは別の入口にしてある。
export { MemberRepository } from "./model/member/member-repository";
export { filterEligibleIds, DEFAULT_ELIGIBLE } from "./model/member/eligibility";
export type { EligibilityExtras } from "./model/member/eligibility";
