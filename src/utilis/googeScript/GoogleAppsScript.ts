/**
 * @file Google Apps Scriptとの連携を容易にするTypeScriptブリッジ。
 * このファイルは、`google.script.run` および `google.script.history` の型定義と、
 * それらを安全かつ便利に使用するためのラッパー関数を提供します。
 *
 * @summary Google Apps Script (GAS) のクライアントサイドAPI (`google.script.*`) を
 * TypeScriptプロジェクトで型安全に利用するためのユーティリティクラスです。
 * `google.script.history` が未定義となる環境でもエラーにならないように配慮されています。
 */

// ============================================================================
// 1. google.script.* の型定義
//    これらの型定義は、Google Apps Scriptが提供するグローバルオブジェクトの
//    構造をTypeScriptに認識させるために必要です。
// ============================================================================

/**
 * `google.script.run` のインターフェース定義。
 * サーバーサイドの関数を非同期で呼び出すためのメソッドを提供します。
 */
declare namespace google.script {
    interface Run {
        /**
         * サーバーサイド関数が成功した場合に呼び出されるハンドラを設定します。
         * @param handler 成功時に実行されるコールバック関数。サーバーサイド関数の戻り値が引数として渡されます。
         * @returns この`Run`オブジェクト自身を返し、メソッドチェーンを可能にします。
         */
        withSuccessHandler(handler: (value: any) => void): Run;

        /**
         * サーバーサイド関数が失敗した場合に呼び出されるハンドラを設定します。
         * @param handler 失敗時に実行されるコールバック関数。エラーオブジェクトが引数として渡されます。
         * @returns この`Run`オブジェクト自身を返し、メソッドチェーンを可能にします。
         */
        withFailureHandler(handler: (error: Error) => void): Run;

        /**
         * 成功または失敗ハンドラに渡されるカスタムオブジェクトを設定します。
         * @param object ハンドラに渡される任意のオブジェクト。
         * @returns この`Run`オブジェクト自身を返し、メソッドチェーンを可能にします。
         */
        withUserObject(object: Object): Run;

        /**
         * サーバーサイドの関数を動的に呼び出すためのインデックスシグネチャ。
         * サーバーサイドの関数名と引数に応じて型を推論します。
         * 例: `google.script.run.myServerFunction(arg1, arg2)`
         * @param args サーバーサイド関数に渡す引数。
         */
        [functionName: string]: (...args: any[]) => void;
    }

    /**
     * `google.script.history` のインターフェース定義。
     * ブラウザの履歴スタックを操作するためのメソッドを提供します。
     * これはWebアプリでのみ利用可能であり、スタンドアロンのスクリプトでは`undefined`になります。
     */
    interface History {
        /**
         * 新しい状態をブラウザの履歴スタックにプッシュします。
         * @param stateObject 履歴エントリに関連付けられる状態オブジェクト。
         * @param params URLのクエリパラメータとして追加されるオブジェクト。
         */
        push(stateObject: Object, params?: Object): void;

        /**
         * 現在の状態をブラウザの履歴スタックで置き換えます。
         * @param stateObject 履歴エントリに関連付けられる状態オブジェクト。
         * @param params URLのクエリパラメータとして追加されるオブジェクト。
         */
        replace(stateObject: Object, params?: Object): void;

        /**
         * 履歴の状態が変更されたときに呼び出されるコールバック関数を設定します。
         * @param callback 履歴の状態変更時に実行される関数。`HistoryChangeEvent`オブジェクトが引数として渡されます。
         */
        setOnStateChange(callback: (e: HistoryChangeEvent) => void): void;
    }

    /**
     * 履歴の状態変更イベントで渡されるオブジェクトのインターフェース。
     */
    interface HistoryChangeEvent {
        /** 履歴エントリに関連付けられた状態オブジェクト。 */
        state: Object | null;
        /** 現在のURL。 */
        url: string;
    }

    /**
     * サーバーサイド関数を呼び出すためのグローバルオブジェクト。
     * `google.script.run` としてアクセスされます。
     */
    const run: Run;

    /**
     * ブラウザの履歴を操作するためのグローバルオブジェクト。
     * `google.script.history` としてアクセスされます。
     * Webアプリ以外では`undefined`になる可能性があります。
     */
    const history: History | undefined;
}

// ============================================================================
// 2. AppsScriptBridge クラス
//    google.script.* の関数を安全かつ使いやすくラップします。
// ============================================================================

/**
 * @summary Google Apps Script (GAS) のクライアントサイドAPI (`google.script.run` および `google.script.history`) を
 * 型安全に、かつエラーを回避しながら利用するためのユーティリティクラスです。
 * 特に `google.script.history` が未定義となる環境（例: サイドバー、ダイアログ）でも
 * 安全に動作するように設計されています。
 */
export class AppsScriptBridge {

    private constructor() {
        // シングルトンパターンを強制するため、コンストラクタはプライベートにします。
    }

    /**
     * AppsScriptBridge のシングルトンインスタンスを取得します。
     * @returns AppsScriptBridge の唯一のインスタンス。
     */
    public static getInstance(): AppsScriptBridge {
        if (!(globalThis as any)._appsScriptBridgeInstance) {
            (globalThis as any)._appsScriptBridgeInstance = new AppsScriptBridge();
        }
        return (globalThis as any)._appsScriptBridgeInstance;
    }

    /**
     * @summary サーバーサイドのGoogle Apps Script関数を呼び出します。
     * 成功ハンドラと失敗ハンドラをチェーンして設定できます。
     * @param functionName 呼び出すサーバーサイド関数の名前（文字列）。
     * @param args サーバーサイド関数に渡す引数。
     * @returns `AppsScriptRunBuilder` のインスタンス。これにより、`.onSuccess()` や `.onFailure()` をチェーンできます。
     *
     * @example
     * // サーバーサイドの関数 `getServerData` を呼び出し、成功/失敗ハンドラを設定する例
     * GoogleAppsScript.run('getServerData', 'param1', 123)
     * .onSuccess((data) => {
     * console.log('サーバーからデータを受信しました:', data);
     * // UIの更新など
     * })
     * .onFailure((error) => {
     * console.error('サーバー関数呼び出し中にエラーが発生しました:', error.message);
     * // エラーメッセージの表示など
     * });
     *
     * @example
     * // サーバーサイドの関数 `saveUserData` を呼び出し、ユーザーオブジェクトを渡す例
     * const userId = 'user123';
     * GoogleAppsScript.run('saveUserData', { name: 'Alice', age: 30 })
     * .withUserObject({ id: userId }) // 成功/失敗ハンドラに渡すカスタムオブジェクト
     * .onSuccess((result, userObj) => {
     * console.log(`ユーザー ${userObj.id} のデータ保存が成功しました:`, result);
     * })
     * .onFailure((error, userObj) => {
     * console.error(`ユーザー ${userObj.id} のデータ保存に失敗しました:`, error.message);
     * });
     */
    public run(functionName: string, ...args: any[]): AppsScriptRunBuilder {
        return new AppsScriptRunBuilder(functionName, args);
    }

    /**
     * @summary ブラウザの履歴スタックに新しい状態をプッシュします。
     * `google.script.history` が利用できない環境では何もしません。
     * @param stateObject 履歴エントリに関連付けられる状態オブジェクト。
     * @param params URLのクエリパラメータとして追加されるオブジェクト。
     *
     * @example
     * // 履歴に新しい状態をプッシュする例
     * GoogleAppsScript.pushHistory({ page: 'detail', id: 456 }, { view: 'full' });
     * console.log('履歴に新しい状態がプッシュされました。');
     */
    public pushHistory(stateObject: Object, params?: Object): void {
        if (typeof google !== 'undefined' && google.script && google.script.history) {
            google.script.history.push(stateObject, params);
        } else {
            console.warn('google.script.history はこの環境では利用できません。pushHistoryはスキップされました。');
        }
    }

    /**
     * @summary ブラウザの履歴スタックの現在の状態を置き換えます。
     * `google.script.history` が利用できない環境では何もしません。
     * @param stateObject 履歴エントリに関連付けられる状態オブジェクト。
     * @param params URLのクエリパラメータとして追加されるオブジェクト。
     *
     * @example
     * // 現在の履歴状態を置き換える例
     * GoogleAppsScript.replaceHistory({ page: 'home', user: 'admin' });
     * console.log('現在の履歴状態が置き換えられました。');
     */
    public replaceHistory(stateObject: Object, params?: Object): void {
        if (typeof google !== 'undefined' && google.script && google.script.history) {
            google.script.history.replace(stateObject, params);
        } else {
            console.warn('google.script.history はこの環境では利用できません。replaceHistoryはスキップされました。');
        }
    }

    /**
     * @summary 履歴の状態が変更されたときに呼び出されるコールバック関数を設定します。
     * `google.script.history` が利用できない環境では何もしません。
     * @param callback 履歴の状態変更時に実行される関数。`HistoryChangeEvent`オブジェクトが引数として渡されます。
     *
     * @example
     * // 履歴状態変更ハンドラを設定する例
     * GoogleAppsScript.setOnHistoryChange((event) => {
     * console.log('履歴の状態が変更されました:', event.state, event.url);
     * // URLや状態に基づいてUIを更新するロジック
     * if (event.state && (event.state as any).page === 'detail') {
     * console.log('詳細ページに移動しました。');
     * }
     * });
     * console.log('履歴状態変更ハンドラが設定されました。');
     */
    public setOnHistoryChange(callback: (e: google.script.HistoryChangeEvent) => void): void {
        if (typeof google !== 'undefined' && google.script && google.script.history) {
            google.script.history.setOnStateChange(callback);
        } else {
            console.warn('google.script.history はこの環境では利用できません。setOnHistoryChangeはスキップされました。');
        }
    }
}

/**
 * @summary `AppsScriptBridge.run` の結果に成功/失敗ハンドラをチェーンするためのヘルパークラス。
 */
class AppsScriptRunBuilder {
    private runObject: google.script.Run;
    private functionName: string;
    private args: any[];

    constructor(functionName: string, args: any[]) {
        if (typeof google === 'undefined' || !google.script || !google.script.run) {
            console.error('google.script.run が利用できません。Google Apps Script環境で実行されていることを確認してください。');
            // google.script.run が利用できない場合でも、エラーを投げずにダミーオブジェクトを返すことで、
            // チェーンメソッドが呼び出されてもエラーにならないようにします。
            this.runObject = {
                withSuccessHandler: () => this.runObject,
                withFailureHandler: () => this.runObject,
                withUserObject: () => this.runObject,
                [functionName]: () => { /* no-op */ }
            };
        } else {
            this.runObject = google.script.run;
        }
        this.functionName = functionName;
        this.args = args;
    }

    /**
     * @summary サーバーサイド関数が成功した場合に呼び出されるハンドラを設定し、関数を実行します。
     * @param handler 成功時に実行されるコールバック関数。サーバーサイド関数の戻り値が引数として渡されます。
     * `withUserObject` が設定されている場合、そのオブジェクトも第2引数として渡されます。
     * @returns `AppsScriptRunBuilder` のインスタンス。メソッドチェーンを可能にします。
     *
     * @example
     * // 成功ハンドラを設定して関数を実行する例
     * GoogleAppsScript.run('getData')
     * .onSuccess((data) => {
     * console.log('データ取得成功:', data);
     * });
     *
     * @example
     * // 成功ハンドラと失敗ハンドラをチェーンする例
     * GoogleAppsScript.run('saveData', { item: 'new item' })
     * .onSuccess((result) => console.log('保存成功:', result))
     * .onFailure((error) => console.error('保存失敗:', error.message));
     */
    public onSuccess(handler: (value: any, userObject?: Object) => void): AppsScriptRunBuilder {
        this.runObject.withSuccessHandler(handler)[this.functionName](...this.args);
        return this; // onSuccess の後に onFailure をチェーンできるように this を返す
    }

    /**
     * @summary サーバーサイド関数が失敗した場合に呼び出されるハンドラを設定し、関数を実行します。
     * 通常は `onSuccess` と組み合わせて使用します。
     * @param handler 失敗時に実行されるコールバック関数。エラーオブジェクトが引数として渡されます。
     * `withUserObject` が設定されている場合、そのオブジェクトも第2引数として渡されます。
     * @returns `AppsScriptRunBuilder` のインスタンス。メソッドチェーンを可能にします。
     *
     * @example
     * // 失敗ハンドラを設定する例 (onSuccess と組み合わせる)
     * GoogleAppsScript.run('saveData', { item: 'new item' })
     * .onSuccess((result) => console.log('保存成功:', result))
     * .onFailure((error) => console.error('保存失敗:', error.message));
     */
    public onFailure(handler: (error: Error, userObject?: Object) => void): AppsScriptRunBuilder {
        this.runObject = this.runObject.withFailureHandler(handler);
        return this;
    }

    /**
     * @summary 成功または失敗ハンドラに渡されるカスタムオブジェクトを設定します。
     * @param object ハンドラに渡される任意のオブジェクト。
     * @returns `AppsScriptRunBuilder` のインスタンス。メソッドチェーンを可能にします。
     *
     * @example
     * // ユーザーオブジェクトを設定する例
     * GoogleAppsScript.run('processItem', { id: 101 })
     * .withUserObject({ originalId: 101 })
     * .onSuccess((result, userObj) => {
     * console.log(`アイテム ${userObj.originalId} の処理が完了しました。`);
     * });
     */
    public withUserObject(object: Object): AppsScriptRunBuilder {
        this.runObject = this.runObject.withUserObject(object);
        return this;
    }
}

/**
 * @summary Google Apps ScriptのクライアントサイドAPIを操作するためのグローバルインスタンス。
 * `google.script.run` と同様に、`GoogleAppsScript.run()` でサーバーサイド関数を呼び出せます。
 */
export const GoogleAppsScript = AppsScriptBridge.getInstance();


// ============================================================================
// 3. 使用例 (オプション: この部分は実際のアプリケーションコードに組み込む)
// ============================================================================

/**
 * @summary このモジュールの使用方法を示すサンプルコードです。
 * 実際のアプリケーションでは、これらの関数を適切に呼び出してください。
 */
function main(): void {
    // サーバーサイド関数呼び出しの例
    console.log('--- サーバーサイド関数呼び出しの例 ---');
    GoogleAppsScript.run('myServerFunction', 'Hello', 123)
        .onSuccess((response: string) => {
            console.log('成功ハンドラ:', response); // サーバーからの応答
        })
        .onFailure((error: Error) => {
            console.error('失敗ハンドラ:', error.message);
        });

    // ユーザーオブジェクトを伴うサーバーサイド関数呼び出しの例
    console.log('\n--- ユーザーオブジェクトを伴うサーバーサイド関数呼び出しの例 ---');
    const customData = { requestId: 'ABC-123' };
    GoogleAppsScript.run('anotherServerFunction', { data: 'some payload' })
        .withUserObject(customData)
        .onSuccess((result: boolean, userObj: any) => {
            console.log(`成功ハンドラ (リクエストID: ${userObj.requestId}):`, result);
        })
        .onFailure((error: Error, userObj: any) => {
            console.error(`失敗ハンドラ (リクエストID: ${userObj.requestId}):`, error.message);
        });

    // google.script.history の使用例 (Webアプリ環境でのみ動作)
    console.log('\n--- google.script.history の使用例 ---');

    // 履歴状態変更ハンドラの設定
    GoogleAppsScript.setOnHistoryChange((event) => {
        console.log('履歴状態変更イベント:', event);
        console.log('現在の状態:', event.state);
        console.log('現在のURL:', event.url);
        // ここでUIを更新するロジックを実装
    });

    // 履歴へのプッシュ
    GoogleAppsScript.pushHistory({ page: 'dashboard', filter: 'active' }, { param1: 'value1' });

    // 履歴の置き換え
    setTimeout(() => {
        GoogleAppsScript.replaceHistory({ page: 'settings', user: 'guest' });
    }, 1000);

    // google.script.history が利用できない場合の警告メッセージの例
    // (このコードは、historyが未定義の環境で実行された場合に警告を表示します)
    // console.log('\n--- historyが未定義の場合の警告例 ---');
    // // 以下をコメントアウト解除すると、historyが利用できない環境で警告が表示されます
    // // (globalThis as any).google.script.history = undefined; // テスト目的で強制的にundefinedにする
    // GoogleAppsScript.pushHistory({ test: 'no history' });
}

// ページロード時にmain関数を実行
// HTMLファイルでこのTypeScriptファイルを読み込む場合、以下のように呼び出すことができます。
// document.addEventListener('DOMContentLoaded', main);
// または、直接呼び出す場合:
// main();
