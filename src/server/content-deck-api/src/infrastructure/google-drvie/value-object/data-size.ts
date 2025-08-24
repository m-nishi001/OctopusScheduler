export class DataSize {
    private readonly bytes: number;
    private static readonly BYTES_IN_KB = 1024;
    private static readonly BYTES_IN_MB = 1024 * DataSize.BYTES_IN_KB;
    private static readonly BYTES_IN_GB = 1024 * DataSize.BYTES_IN_MB;

    constructor(value: number | DataSize, unit?: 'B' | 'KB' | 'MB' | 'GB') {
        if (value instanceof DataSize) { this.bytes = value.bytes; return; }
        if (typeof value === 'number') {
            switch (unit) {
                case 'B': this.bytes = value; break;
                case 'KB': this.bytes = value * DataSize.BYTES_IN_KB; break;
                case 'MB': this.bytes = value * DataSize.BYTES_IN_MB; break;
                case 'GB': this.bytes = value * DataSize.BYTES_IN_GB; break;
                default: this.bytes = value; break;
            }
        } else {
            throw new Error('無効なコンストラクタ引数です。');
        }
    }

    public toBytes(): number { return this.bytes; }
    public toKilobytes(): number { return this.bytes / DataSize.BYTES_IN_KB; }
    public toMegabytes(): number { return this.bytes / DataSize.BYTES_IN_MB; }
    public toGigabytes(): number { return this.bytes / DataSize.BYTES_IN_GB; }

    public equals(other: DataSize): boolean { return this.bytes === other.bytes; }

    public toString(unit: 'B' | 'KB' | 'MB' | 'GB' = 'B', fractionDigits: number = 2): string {
        let value: number; let unitString: string;
        switch (unit) {
            case 'B': value = this.toBytes(); unitString = 'B'; break;
            case 'KB': value = this.toKilobytes(); unitString = 'KB'; break;
            case 'MB': value = this.toMegabytes(); unitString = 'MB'; break;
            case 'GB': value = this.toGigabytes(); unitString = 'GB'; break;
            default: value = this.toBytes(); unitString = 'B'; break;
        }
        return `${value.toFixed(fractionDigits)}${unitString}`;
    }
}