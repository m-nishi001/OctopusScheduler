
import { injectable } from "tsyringe";
import { ResultRepository } from '../../domain/repositories/result-repository';
import { Result } from '../../domain/entities/result';
import { ISpreadsheetService, SpreadsheetService } from "../../../../../shared-packages/src/google-spreadsheet-service";

@injectable()
export class ResultRepositoryImpl implements ResultRepository {
    private readonly repository: ISpreadsheetService<Result>;
    private readonly sheetName = "Results";

    constructor() {
        this.repository = SpreadsheetService.getService<Result>(this.sheetName);
    }

    saveResult(result: Result): void {
        this.repository.add(result);
    }

    getResults(): Result[] {
        return this.repository.find((r: Result) => true);
    }

    findResultById(memberId: string, prizeId: string): Result | null {
        const results = this.repository.find((r: Result) => r.memberId === memberId && r.prizeId === prizeId);
        return results.length > 0 ? results[0] : null;
    }

    updateResult(memberId: string, prizeId: string, updateEntity: (result: Result) => Result): number {
        return this.repository.update((r: Result) => r.memberId === memberId && r.prizeId === prizeId, updateEntity);
    }

    updateManyResults(ids: Array<{memberId: string, prizeId: string}>, updateEntity: (result: Result) => Result): number {
        return this.repository.update((r: Result) => ids.some(id => id.memberId === r.memberId && id.prizeId === r.prizeId), updateEntity);
    }

    deleteResult(memberId: string, prizeId: string): void {
        this.repository.delete((r: Result) => r.memberId === memberId && r.prizeId === prizeId);
    }

    deleteManyResults(ids: Array<{memberId: string, prizeId: string}>): void {
        this.repository.delete((r: Result) => ids.some(id => id.memberId === r.memberId && id.prizeId === r.prizeId));
    }
}
