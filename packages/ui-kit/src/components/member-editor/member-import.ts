/** 名簿の CSV 取込ダイアログと、それを動かす側(accounts)との受け渡しの型。 */
export type MemberImportStatus = 'add' | 'update' | 'unchanged' | 'error';

export interface MemberImportRow {
    /** CSV での行番号 */
    line: number;
    id: string;
    name: string;
    status: MemberImportStatus;
    message?: string;
}

/** 確定した結果。`summary` は1行の要約、`details` は所要時間などの補足。 */
export interface MemberImportResult {
    summary: string;
    details: string[];
}

export type MemberImportPreview =
    | { ok: false; errors: string[] }
    | {
          ok: true;
          rows: MemberImportRow[];
          counts: Record<MemberImportStatus, number>;
          /** 確定する。進捗を `onProgress` に流し、名簿を書き換えて結果を返す。失敗は例外。 */
          apply: (onProgress: (message: string) => void) => Promise<MemberImportResult>;
      };

/** 取込ダイアログで選んだファイル。`table` は CSV または書き出した ZIP、`images` は画像フォルダの中身。 */
export interface MemberImportInput {
    table: File;
    images: File[];
}
