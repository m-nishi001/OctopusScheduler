declare module "@common/gas" {
  export type FinalGasCallResult<T> = any;
  export class GasFunctionService {
    static create(apiFunctionName: string): GasFunctionService | null;
    createCall<T = any>(functionName: string, ...args: any[]): any;
    call<T = any>(...args: any[]): Promise<FinalGasCallResult<T>>;
  }
}
