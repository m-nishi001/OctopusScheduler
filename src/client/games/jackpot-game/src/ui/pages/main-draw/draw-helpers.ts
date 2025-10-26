export const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export async function safeTry<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
        return await fn();
    } catch (e) {
        return fallback;
    }
}

export default { delay, safeTry };
