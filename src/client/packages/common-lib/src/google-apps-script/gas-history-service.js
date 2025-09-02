export class HistoryService {
    static push(state, params, bookmark) {
        google.script.history.push(state, params, bookmark);
    }
    static replace(state, params, hash) {
        google.script.history.replace(state, params, hash);
    }
    static setChangeHandler(handler) {
        google.script.history.setChangeHandler(handler);
    }
}
