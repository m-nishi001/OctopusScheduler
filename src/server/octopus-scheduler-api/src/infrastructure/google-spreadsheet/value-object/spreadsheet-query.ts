import { SpreadSheetId } from "./spreadsheet-id";
import { SpreadSheetName } from "./spreadsheet-name";

export class SpreadSheetQuery<TEntity> {
    spreadSheetId: SpreadSheetId;
    spreadSheetName: SpreadSheetName;
    prediction: (record: {}) => boolean;

    constructor(
        spreadSheetId: SpreadSheetId,
        spreadSheetName: SpreadSheetName,
        entityFactory: () => TEntity,
        prediction: (entity: TEntity) => boolean) {
        this.spreadSheetId = spreadSheetId;
        this.spreadSheetName = spreadSheetName;
        this.prediction = (record: {}) => {
            const instance = entityFactory();
            const assigned = Object.assign(instance as any, record);
            return prediction(assigned);
        };
    }
}