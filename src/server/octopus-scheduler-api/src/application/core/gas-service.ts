import { ApiResponse } from "./response/api-response";

export interface GasService {
    readonly serviceName: string;
    readonly functions: Record<string, (...args: any) => ApiResponse<any>>
}

export { ApiResponse };
