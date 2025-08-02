export class SpreadsheetLock implements Disposable {
    private constructor() {
    }

    [Symbol.dispose](): void {
        LockService.getScriptLock().releaseLock();
        Logger.log(`[SpreadSheetLock.dispose] Released scriptlock.`);
        return;
    }

    static tryLock(): SpreadsheetLock | null {
        const _timeoutSeconds = 5;

        if (!LockService.getScriptLock().tryLock(_timeoutSeconds * 1000)) {
            Logger.log(`[SpreadSheetService.tryLock] faild to get scriptlock in ${_timeoutSeconds} seconds.`);
            return null;
        }

        Logger.log(`[SpreadSheetService.tryLock] Got scriptlock.`);
        return new SpreadsheetLock();
    }
}