/**
 * セッション1件に対する操作(参加・購読・コマンド発行・状態公開・回答ラウンド)の中核ロジック。
 *
 * 永続化は `SessionRepo`、在席は `PresenceStore` に委ね、時刻・ID生成は外から注入するので
 * 副作用を持たず、GAS/R2 のKV実装でも Durable Object でも同じコードを使える。
 * 排他(同一セッションへの同時書き込みの直列化)は呼び出し側の責務
 * (GAS/R2: ILock、Durable Object: 単一スレッド実行)。
 *
 * 実装は操作ごとのファイルに分かれている。外からはこのファイル(`engine.xxx`)だけを使う。
 */
export { authenticate } from "./engine-core";
export type { EngineDeps } from "./engine-core";
export { joinOperator, joinParticipant } from "./engine-join";
export type { TrustedMember } from "./engine-join";
export { buildPresenceView, buildUpdate, poll } from "./engine-feed";
export type { UpdateSource } from "./engine-feed";
export { issueCommand, publishState } from "./engine-commands";
export { closeRound, getAnswers, isRoundOpen, openRound, submitAnswer, toRoundSummary } from "./engine-rounds";
