export interface IRepository {
    insert(tableName: string, records: any[]): number;
    select(tableName: string, predicate: (record: any) => boolean): any[] | null;
    update(tableName: string, predicate: (record: any) => boolean, executor: (record: any) => any): number;
    delete(tableName: string, predicate: (record: any) => boolean): number
}