declare namespace google.script {
    interface Runner {
        [key: string]: (...args: any[]) => void;

        withSuccessHandler<T>(callback: (result: T, userObject?: object) => void): Runner;
        withFailureHandler(callback: (error: Error, userObject?: object) => void): Runner;
        withUserObject(obj: object): Runner;
    }

    interface History {
        push(state: object | null, params?: { [key: string]: string }, bookmark?: string): void;
        replace(state: object | null, params?: { [key: string]: string }, bookmark?: string): void;
        setChangeHandler(callback: (event: { state: object; location: Location }) => void): void;
    }

    interface Host {
        setHeight(height: number): void;
        setWidth(width: number): void;
        close(): void;
        editor: { focus(): void; };
    }

    interface Location {
        hash: string;
        parameter: { [key: string]: string };
        parameters: { [key: string]: string[] };
    }

    interface Url {
        getLocation(callback: (location: Location) => void): void;
    }

    const run: Runner;
    const history: History;
    const host: Host;
    const url: Url;
}
