declare namespace google {
    namespace script {
        interface History {
            push(state: object | null, params?: {
                [key: string]: string;
            }, hash?: string): void;
            replace(state: object | null, params?: {
                [key: string]: string;
            }, hash?: string): void;
            setChangeHandler(callback: (event: {
                state: object;
                location: Location;
            }) => void): void;
        }
        interface Location {
            hash: string;
            parameter: {
                [key: string]: string;
            };
            parameters: {
                [key: string]: string[];
            };
        }
        const history: History;
        const location: Location;
    }
}
export declare class HistoryService {
    static push(state: object | null, params?: {
        [key: string]: string;
    }, bookmark?: string): void;
    static replace(state: object | null, params?: {
        [key: string]: string;
    }, hash?: string): void;
    static setChangeHandler(handler: (event: {
        state: object;
        location: google.script.Location;
    }) => void): void;
}
export {};
//# sourceMappingURL=gas-history-service.d.ts.map