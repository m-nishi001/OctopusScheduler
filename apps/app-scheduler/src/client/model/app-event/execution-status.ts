import type { ScheduleExecutionStatus } from "../../../server/scheduler-api-contract";

/** 予定イベントの実行状態。未実行(pending)→ 実行中(running)→ 完了(completed)。 */
export type ExecutionStatus = ScheduleExecutionStatus;
