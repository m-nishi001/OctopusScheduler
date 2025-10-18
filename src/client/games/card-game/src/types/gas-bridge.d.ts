declare module "@common/gas" {
  export type FinalGasCallResult<T> = any;
  export class GasFunctionService {
    static create(apiFunctionName: string): GasFunctionService | null;
    call<T = any>(
      functionName: string,
      ...args: any[]
    ): Promise<FinalGasCallResult<T>>;
  }
}
