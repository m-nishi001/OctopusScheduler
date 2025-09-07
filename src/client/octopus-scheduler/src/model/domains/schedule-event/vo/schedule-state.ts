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

    public static from(value: unknown): ScheduleState {
        if (value instanceof ScheduleState) return value;
        if (typeof value === 'string') return new ScheduleState(value as StateValue);
        const val = value as Record<string, unknown> | undefined;
        if (val && typeof val.value === 'string') return new ScheduleState(val.value as StateValue);
        return new ScheduleState('Pending');
    }
}