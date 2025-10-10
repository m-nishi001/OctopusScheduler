export interface GasService {
    readonly serviceName: string;
    readonly functions: Record<string, (args: any) => any>
}