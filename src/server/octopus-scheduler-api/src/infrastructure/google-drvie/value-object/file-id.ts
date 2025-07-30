export class FileId {
    public readonly id: string;

    private constructor(id: string) {
        this.id = id;
    }

    static create(id: string): FileId | null {
        if (!id || id === "") {
            Logger.log(`[FileId] name was invalid. Input value is ${id}`);
            return null;
        }
        return new FileId(id);
    }
}