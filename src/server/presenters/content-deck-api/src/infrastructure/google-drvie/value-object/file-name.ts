export class FileName {
    public readonly name: string;

    private constructor(name: string) {
        this.name = name;
    }

    static create(name: string): FileName | null {
        if (!name || name === "") {
            Logger.log(`[FileName] name was invalid. Input value is ${name}`);
            return null;
        }
        return new FileName(name);
    }
}