import { TimetableDto } from "./Timetable";

export class TimetalbeDomainService {
    /**
     * タイムテーブルより最大ターン数をを経んっきゃっくする
     * @returns 最大ターン数
     */
    public static getMaxTurnCount(timetables: TimetableDto[]): number {
        return timetables
            .filter(timeTable => timeTable.turnName.includes("巡目")) // ここは一旦固定値とする。（修正コストが高い）
            .length;
    }
}