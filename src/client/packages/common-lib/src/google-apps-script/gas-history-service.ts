declare namespace google {
  namespace script {
    interface History {
      push(
        state: object | null,
        params?: { [key: string]: string },
        hash?: string
      ): void;
      replace(
        state: object | null,
        params?: { [key: string]: string },
        hash?: string
      ): void;
      setChangeHandler(
        callback: (event: { state: object; location: Location }) => void
      ): void;
    }

    interface Location {
      hash: string;
      parameter: { [key: string]: string };
      parameters: { [key: string]: string[] };
    }

    const history: History;
    const location: Location;
  }
}

export class HistoryService {
  static push(
    state: object | null,
    params?: { [key: string]: string },
    bookmark?: string
  ): void {
    if (typeof google === "undefined") {
      console.warn(
        "google global object not found, this is expected in local environment"
      );
      return;
    }
    google.script.history.push(state, params, bookmark);
  }

  static replace(
    state: object | null,
    params?: { [key: string]: string },
    hash?: string
  ): void {
    if (typeof google === "undefined") {
      console.warn(
        "google global object not found, this is expected in local environment"
      );
      return;
    }
    google.script.history.replace(state, params, hash);
  }

  static setChangeHandler(
    handler: (event: {
      state: object;
      location: google.script.Location;
    }) => void
  ): void {
    if (typeof google === "undefined") {
      console.warn(
        "google global object not found, this is expected in local environment"
      );
      return;
    }
    google.script.history.setChangeHandler(handler);
  }
}
