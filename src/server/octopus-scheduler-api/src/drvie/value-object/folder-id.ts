export class FolderId {
    public readonly id: string;

    private constructor(id: string) {
        this.id = id;
    }

    static create(id: string): FolderId | null {
        if (!id || id === "") {
            Logger.log(`[FolderId] name was invalid. Input value is ${id}`);
            return null;
        }
        return new FolderId(id);
    }
}