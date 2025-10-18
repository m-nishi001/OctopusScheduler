declare module "@common/gas" {
  export type FinalGasCallResult<T> = any;
  export class GasFunctionService {
    constructor(functionName?: string, options?: any);
    static create(apiFunctionName: string): GasFunctionService | null;
    call<T = any>(args?: any): Promise<FinalGasCallResult<T>>;
  }
}
