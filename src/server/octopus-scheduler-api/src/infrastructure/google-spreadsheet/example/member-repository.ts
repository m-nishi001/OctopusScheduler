import { SpreadsheetRepository } from "../core/spreadsheet-repository";

/**
 * メンバーエンティティの型定義。
 */
export interface IMember {
    id: string;
    name: string;
    email: string;
}


export class Member implements IMember {
    id: string;
    name: string;
    email: string;
    constructor(id: string, name: string, email: string) {
        this.id = id;
        this.name = name;
        this.email = email;
    }
}

/**
 * Member エンティティとシート行データの相互変換を行うマッパー。
 */
export class MemberMapper implements IEntityRowMapper<IMember> {
    /**
     * Member オブジェクトをシートの行データに変換します。
     * @param item Member オブジェクト
     * @returns シートの1行のデータ
     */
    entityToRow(item: IMember): unknown[] {
        return [item.id, item.name, item.email];
    }

    /**
     * シートの1行のデータを Member オブジェクトに変換します。
     * @param row シートの1行のデータ
     * @returns 変換された Member オブジェクト
     */
    rowToEntity(row: unknown[]): IMember {
        return {
            id: String(row[0]),
            name: String(row[1]),
            email: String(row[2]),
        };
    }

    getHeader(): string[] {
        return ["ID", "Name", "Email"];
    }
}

/**
 * Member エンティティに特化したリポジトリの実装。
 * 永続化の実装詳細から完全に分離されます。
 */
export class MemberRepository implements IRepository<IMember, string> {
    private repository: IRepository<IMember, string>;

    /**
     * MemberRepository の新しいインスタンスを初期化します。
     * @param repository Member エンティティの永続化を行う IRepository の具体的な実装
     */
    constructor(repository: IRepository<IMember, string>) {
        this.repository = repository;
    }

    /**
     * メンバーを新規作成します（単発）。
     * @param item 作成するメンバーオブジェクト
     * @returns 作成されたメンバーオブジェクト
     */
    create(item: IMember): IMember {
        return this.repository.create(item);
    }

    /**
     * メンバーを新規作成します（バッチ）。
     * @param items 作成するメンバーオブジェクトの配列
     * @returns 作成されたメンバーオブジェクトの配列
     */
    createBatch(items: IMember[]): IMember[] {
        return this.repository.createBatch(items);
    }

    /**
     * 指定されたIDのメンバーを読み込みます（単発）。
     * @param key メンバーのID
     * @returns 読み込まれたメンバーオブジェクト、またはnull
     */
    read(key: string): IMember | null {
        return this.repository.read(key);
    }

    /**
     * 全てのメンバーを読み込みます。
     * @returns 全てのメンバーオブジェクトの配列
     */
    readAll(): IMember[] {
        return this.repository.readAll();
    }

    /**
     * 指定されたIDのメンバーを更新します（単発）。
     * @param key メンバーのID
     * @param updates 更新するメンバーオブジェクト（部分更新可）
     * @returns 更新されたメンバーオブジェクト、またはnull
     */
    update(key: string, updates: Partial<IMember>): IMember | null {
        return this.repository.update(key, updates);
    }

    /**
     * メンバーを更新します（バッチ）。
     * @param updatesMap IDと更新内容のマップ
     * @returns 更新されたメンバーオブジェクトの配列
     */
    updateBatch(updatesMap: Map<string, Partial<IMember>>): (IMember | null)[] {
        return this.repository.updateBatch(updatesMap);
    }

    /**
     * 指定されたIDのメンバーを削除します（単発）。
     * @param key メンバーのID
     * @returns 削除が成功したかどうかの真偽値
     */
    delete(key: string): boolean {
        return this.repository.delete(key);
    }

    /**
     * メンバーを削除します（バッチ）。
     * @param keys 削除するメンバーIDの配列
     * @returns 削除が成功したかどうかの真偽値
     */
    deleteBatch(keys: string[]): boolean {
        return this.repository.deleteBatch(keys);
    }
}

// リポジトリ操作例
// const spreadsheetId = "1CsbGHLha756BEp-J9FAJBgeaP7eSdh6SCVr2sUo-qC0";
// const mapper = new MemberMapper();
// const repository = new SpreadsheetRepository<IMember, string>(spreadsheetId, "シート1", mapper, 0);
// const memberRepository = new MemberRepository(repository);
// const createdMember = memberRepository.create(new Member("001", "Taro", "example@maill.com"));
// memberRepository.update(createdMember.id, { name: "Jiro" });
// memberRepository.readAll().forEach(member => Logger.log(JSON.stringify(member)));