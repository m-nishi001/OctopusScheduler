export type StateValue = 'Pending' | 'Running' | 'Completed';

/**
 * スケジュールの状態を表す値オブジェクト
 */
export class ScheduleState {
    public readonly value: StateValue;

    constructor(value: StateValue) {
        this.value = value;
    }

    public isRunning(): boolean {
        return this.value === 'Running';
    }
}