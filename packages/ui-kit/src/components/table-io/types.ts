/**
 * 一括取込ダイアログと、それを動かす側(各画面)との受け渡しの型。`@octopus/table-io` の計画の行と同じ形なので、
 * 計画をそのまま渡せる(この層は table-io に依存しない)。
 */
export type TableImportStatus = 'add' | 'update' | 'unchanged' | 'delete' | 'error';

/** `upsert` は追加・更新だけ。`replace` はファイルに無い行を削除する(オプトイン)。 */
export type TableImportMode = 'upsert' | 'replace';

export interface TableImportRow {
    /** CSV での行番号(ファイルに無い=削除の行は null) */
    line: number | null;
    key: string;
    label: string;
    status: TableImportStatus;
    message?: string;
}

/** 確定した結果。`summary` は1行の要約、`details` は所要時間などの補足。 */
export interface TableImportResult {
    summary: string;
    details: string[];
}

export type TableImportPreview =
    | { ok: false; errors: string[] }
    | {
          ok: true;
          rows: TableImportRow[];
          counts: Record<TableImportStatus, number>;
          /** 取り込む素材の件数(新しい名前 / 同じ名前の差し替え)。素材を扱わない画面では省略する。 */
          media?: { added: number; replaced: number };
          /** 確定する。進捗を `onProgress` に流し、書き込みを済ませて結果を返す。失敗は例外。 */
          apply: (onProgress: (message: string) => void) => Promise<TableImportResult>;
      };

/** 取込ダイアログで選んだファイルとモード。`table` は CSV または書き出した ZIP、`media` は素材フォルダの中身。 */
export interface TableImportInput {
    table: File;
    media: File[];
    mode: TableImportMode;
}
